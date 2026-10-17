const PROJECT='dots-300de';
const ROOT='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents';
const encoder=new TextEncoder();
let tokenCache;
const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
export async function firebaseToken(env){
 if(tokenCache&&tokenCache.expires>Date.now())return tokenCache.value;
 const sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
 const t=Math.floor(Date.now()/1000);
 const head=b64(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const claims=b64(encoder.encode(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:t,exp:t+3600})));
 const raw=Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',raw,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const unsigned=head+'.'+claims;
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(unsigned));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+b64(new Uint8Array(signature))})});
 const result=await response.json();if(!response.ok||!result.access_token)throw new Error('Firebase server authentication failed');
 tokenCache={value:result.access_token,expires:Date.now()+3000000};return tokenCache.value;
}
export function fields(value){return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));}
function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:fields(v)}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};return {stringValue:String(v)};}
function decode(v){if(v.stringValue!==undefined)return v.stringValue;if(v.integerValue!==undefined)return Number(v.integerValue);if(v.doubleValue!==undefined)return v.doubleValue;if(v.booleanValue!==undefined)return v.booleanValue;if(v.timestampValue!==undefined)return v.timestampValue;if(v.nullValue!==undefined)return null;if(v.arrayValue)return (v.arrayValue.values||[]).map(decode);if(v.mapValue)return values(v.mapValue.fields||{});return null;}
export function values(f){return Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,decode(v)]));}
export const workspace=env=>'forgeCloud/'+env.FIREBASE_OWNER_UID;
export const viewPath=(env,name)=>workspace(env)+'/views/'+name;
export const taskPath=(env,id)=>workspace(env)+'/tasks/'+id;
export async function firestore(env,path,method='GET',body){
 const response=await fetch(ROOT+path,{method,headers:{Authorization:'Bearer '+await firebaseToken(env),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error('Firestore '+response.status+': '+(result.error?.message||'request failed'));
 return result;
}
export function enqueueStatement(env,path,data){
 return env.DB.prepare('INSERT INTO firebase_outbox(path,payload,version) VALUES(?,?,1) ON CONFLICT(path) DO UPDATE SET payload=excluded.payload,version=version+1').bind(path,JSON.stringify(data));
}
export async function enqueue(env,path,data){if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!env.FIREBASE_OWNER_UID)return;await enqueueStatement(env,path,data).run();}
export async function taskViews(env,task,state){
 const {state:privateState,...safe}=task;
 const files=await Promise.all(Object.entries(state.files||{}).map(async([name,content])=>({path:taskPath(env,task.id)+'/files/'+b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(name)))),data:{name,content,updated_at:task.updated_at||''}})));
 return [{path:taskPath(env,task.id),data:{...safe,files:Object.keys(state.files||{}),commandResults:state.commandResults||[],pendingCommand:state.pendingRun?.command||null}},...files];
}
export async function mirrorTask(env,id){
 if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!env.FIREBASE_OWNER_UID)return;
 const task=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();if(!task)return;
 const writes=await taskViews(env,task,JSON.parse(task.state));await env.DB.batch(writes.map(w=>enqueueStatement(env,w.path,w.data)));
}
export async function flushOutbox(env){
 if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!env.FIREBASE_OWNER_UID)return;
 const rows=(await env.DB.prepare('SELECT path,payload,version FROM firebase_outbox ORDER BY rowid LIMIT 100').all()).results;
 if(!rows.length)return;
 await firestore(env,':commit','POST',{writes:rows.map(r=>({update:{name:'projects/'+PROJECT+'/databases/(default)/documents/'+r.path,fields:fields(JSON.parse(r.payload))}}))});
 await env.DB.batch(rows.map(r=>env.DB.prepare('DELETE FROM firebase_outbox WHERE path=? AND version=?').bind(r.path,r.version)));
}
export async function seedFirebase(env,config){
 if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!env.FIREBASE_OWNER_UID)return;
 const seeded=await env.DB.prepare("SELECT count FROM usage WHERE key='firebase:seeded:v1'").first();if(seeded)return;
 const tasks=(await env.DB.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100').all()).results;
 const events=(await env.DB.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 2000').all()).results;
 const writes=(await Promise.all(tasks.map(task=>taskViews(env,task,JSON.parse(task.state))))).flat();
 for(const e of events)writes.push({path:taskPath(env,e.task_id)+'/events/'+e.id,data:{id:e.id,kind:e.kind,message:e.message,created_at:e.created_at}});
 writes.push({path:viewPath(env,'config'),data:config});
 for(let i=0;i<writes.length;i+=100)await env.DB.batch(writes.slice(i,i+100).map(w=>enqueueStatement(env,w.path,w.data)));
 await env.DB.prepare("INSERT OR REPLACE INTO usage(key,count) VALUES('firebase:seeded:v1',1)").run();
}
export async function firebaseCommands(env,run){
 if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!env.FIREBASE_OWNER_UID)return;
 const lock=await env.DB.prepare("INSERT INTO usage(key,count) VALUES('firebase:commands:lease',?) ON CONFLICT(key) DO UPDATE SET count=excluded.count WHERE count<? RETURNING count").bind(Date.now()+300000,Date.now()).first();if(!lock)return;
 try{
  const results=await firestore(env,'/'+workspace(env)+':runQuery','POST',{structuredQuery:{from:[{collectionId:'commands'}],where:{fieldFilter:{field:{fieldPath:'status'},op:'IN',value:{arrayValue:{values:[{stringValue:'pending'},{stringValue:'processing'}]}}}},limit:2}});
  const pending=results.filter(r=>r.document).map(r=>({doc:r.document,data:values(r.document.fields)})).sort((a,b)=>String(a.data.createdAt).localeCompare(String(b.data.createdAt)));
  for(const {doc,data} of pending){
   if(data.status==='processing'&&Date.now()-Number(data.processingAt)<300000)continue;
   const id=doc.name.split('/').pop();const path='/'+workspace(env)+'/commands/'+id;
   await firestore(env,path,'PATCH',{fields:fields({...data,status:'processing',processingAt:Date.now()})});
   try{
    const result=await run(id,data);
    await firestore(env,path,'PATCH',{fields:fields({...data,status:'completed',result,completedAt:Date.now()})});
   }catch(e){await firestore(env,path,'PATCH',{fields:fields({...data,status:'failed',error:String(e.message).slice(0,2000),completedAt:Date.now()})});}
  }
 }finally{await env.DB.prepare("UPDATE usage SET count=0 WHERE key='firebase:commands:lease'").run();}
}
