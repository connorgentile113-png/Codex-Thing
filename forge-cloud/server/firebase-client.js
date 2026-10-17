import {initializeApp} from 'firebase/app';
import {getAuth,signInWithEmailAndPassword,signOut,browserLocalPersistence,setPersistence} from 'firebase/auth';
import {getFirestore,doc,collection,getDoc,getDocs,onSnapshot,setDoc,serverTimestamp,query,orderBy,limit} from 'firebase/firestore';
const firebaseConfig={apiKey:'AIzaSyAxKzzRJyR7DZZHjl2jdQS4YLFv3iaqhQI',authDomain:'dots-300de.firebaseapp.com',projectId:'dots-300de',storageBucket:'dots-300de.firebasestorage.app',messagingSenderId:'1050759668459',appId:'1:1050759668459:web:aed32f5ffed5302a1a54ae'};
const app=initializeApp(firebaseConfig);const auth=getAuth(app);const db=getFirestore(app);
const OWNER='forge-cloud-owner-v1';
const base='forgeCloud/'+OWNER;
let taskCache=[],taskReady,taskStop,changed=()=>{},detailId,detailCache,detailEvents=[],detailStop,eventsStop;
const observers=new Map();
let lastError;
function error(message){return new Error(message);}
function assertOwner(){if(auth.currentUser?.uid!==OWNER)throw error('Sign in to your workspace');}
function attachTasks(){
 if(taskReady)return taskReady;
 taskReady=new Promise((resolve,reject)=>{
  taskStop=onSnapshot(query(collection(db,base+'/tasks'),orderBy('created_at','desc'),limit(100)),snapshot=>{taskCache=snapshot.docs.map(d=>d.data());resolve();changed();},e=>{lastError=e;reject(e);});
 });return taskReady;
}
async function view(name){const snapshot=await getDoc(doc(db,base+'/views/'+name));if(!snapshot.exists())throw error('Cloud workspace is initializing. Try again shortly.');return snapshot.data();}
function attachDetail(id){
 if(detailId===id)return observers.get(id);
 detailStop?.();eventsStop?.();detailId=id;detailCache=undefined;detailEvents=[];
 const ready=new Promise((resolve,reject)=>{
  let loaded=0;const done=()=>{if(++loaded===2)resolve();changed();};
  detailStop=onSnapshot(doc(db,base+'/tasks/'+id),snapshot=>{if(!snapshot.exists()){reject(error('Task not found'));return;}detailCache=snapshot.data();done();},reject);
  eventsStop=onSnapshot(query(collection(db,base+'/tasks/'+id+'/events'),orderBy('id')),snapshot=>{detailEvents=snapshot.docs.map(d=>d.data());done();},reject);
 });observers.clear();observers.set(id,ready);return ready;
}
function command(path,method,body){
 assertOwner();const id=crypto.randomUUID();if(path==='/tasks'&&method==='POST')body={...body,taskId:id};
 const ref=doc(db,base+'/commands/'+id);
 return new Promise((resolve,reject)=>{
  let settled=false,stop=()=>{};
  const timer=setTimeout(()=>{if(!settled){settled=true;stop();reject(error('Your command is still queued in the cloud. It will continue after you close the browser.'));}},240000);
  const done=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);stop();fn(value);};
  stop=onSnapshot(ref,snapshot=>{const data=snapshot.data();if(data?.status==='completed')done(resolve,data.result);if(data?.status==='failed')done(reject,error(data.error||'Cloud command failed'));},e=>done(reject,e));
  setDoc(ref,{path,method,body:body||{},status:'pending',createdAt:serverTimestamp()}).catch(e=>done(reject,e));
 });
}
export async function request(path,options={}){
 await auth.authStateReady();const method=options.method||'GET';const body=options.body?JSON.parse(options.body):{};
 if(path==='/session'&&method==='POST'){
  await setPersistence(auth,browserLocalPersistence);
  try{await signInWithEmailAndPassword(auth,'forge-owner@dots-300de.firebaseapp.com',body.password);}catch{throw error('Incorrect workspace password');}
  assertOwner();return {ok:true};
 }
 if(path==='/session'&&method==='DELETE'){taskStop?.();detailStop?.();eventsStop?.();taskReady=null;taskCache=[];detailId=null;await signOut(auth);return {ok:true};}
 assertOwner();
 if(path==='/config')return view('config');
 if(path==='/repos'){try{return (await view('repos')).items;}catch{return (await command('/repos','GET',{}));}}
 if(path.startsWith('/branches?')){const repo=new URLSearchParams(path.split('?')[1]).get('repo');try{return (await view('branches__'+repo.replace('/','__'))).items;}catch{return command(path,'GET',{});}}
 if(path==='/tasks'&&method==='GET'){await attachTasks();return taskCache;}
 const match=path.match(/^\/tasks\/([a-f0-9-]+)(?:\/(files|checks|step|cancel|retry|followup))?$/);
 if(match&&method==='GET'){
  const [,id,action]=match;
  if(!action){await attachDetail(id);return {...detailCache,events:detailEvents};}
  if(action==='files'){const snapshot=await getDocs(collection(db,base+'/tasks/'+id+'/files'));const selected=new Map();for(const d of snapshot.docs){const f=d.data();const old=selected.get(f.name);if(!old||String(f.updated_at||'')>=String(old.updated_at||''))selected.set(f.name,f);}return Object.fromEntries([...selected].map(([name,f])=>[name,f.content]));}
  if(action==='checks')return command(path,'GET',{});
 }
 if(match?.[2]==='step')return {ok:true}; // All execution is owned by the cloud scheduler.
 if(method==='POST')return command(path,method,body);
 throw error('Unsupported Firebase operation');
}
export function subscribe(callback){changed=()=>queueMicrotask(callback);return ()=>{changed=()=>{};};}
export function isSignedIn(){return auth.currentUser?.uid===OWNER;}
