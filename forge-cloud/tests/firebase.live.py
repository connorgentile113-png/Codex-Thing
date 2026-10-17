import json,sys,urllib.request,urllib.error,uuid,getpass
password=getpass.getpass('Workspace password: ') if sys.stdin.isatty() else sys.stdin.readline().strip()
key='AIzaSyAxKzzRJyR7DZZHjl2jdQS4YLFv3iaqhQI'
base='https://firestore.googleapis.com/v1/projects/dots-300de/databases/(default)/documents'
def request(url,method='GET',body=None,token=None):
 headers={'Content-Type':'application/json','User-Agent':'ForgeSecurityTest'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(url,method=method,headers=headers,data=json.dumps(body).encode() if body is not None else None)
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
status,user=request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+key,'POST',{'email':'forge-owner@dots-300de.firebaseapp.com','password':password,'returnSecureToken':True})
assert status==200,(status,user.get('error'));token=user['idToken']
results={}
results['owner_read']=request(base+'/forgeCloud/forge-cloud-owner-v1/views/config',token=token)[0]
results['anonymous_denied']=request(base+'/forgeCloud/forge-cloud-owner-v1/views/config')[0]
results['other_workspace_denied']=request(base+'/forgeCloud/someone-else/views/config',token=token)[0]
results['view_tampering_denied']=request(base+'/forgeCloud/forge-cloud-owner-v1/views/config','PATCH',{'fields':{'owner':{'stringValue':'attacker'}}},token)[0]
for name,path,method in [('step_command','/tasks/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/step','POST'),('session_command','/session','POST'),('provider_command','https://api.github.com/user','GET')]:
 command='projects/dots-300de/databases/(default)/documents/forgeCloud/forge-cloud-owner-v1/commands/'+str(uuid.uuid4())
 body={'writes':[{'update':{'name':command,'fields':{'path':{'stringValue':path},'method':{'stringValue':method},'body':{'mapValue':{'fields':{}}},'status':{'stringValue':'pending'}}},'updateTransforms':[{'fieldPath':'createdAt','setToServerValue':'REQUEST_TIME'}]}]}
 results[name+'_denied']=request(base+':commit','POST',body,token)[0]
assert results['owner_read']==200,results
assert all(status==403 for name,status in results.items() if name!='owner_read'),results
print('FIREBASE_AUTHORIZATION_CHECKS',json.dumps(results),flush=True)
