import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'mi-espanol-production-'));
const code=randomBytes(20).toString('hex');
const port=process.env.SMOKE_PORT||'3201';
const base=`http://127.0.0.1:${port}`;
const env={...process.env,NODE_ENV:'production',APP_ACCESS_CODE:code,SESSION_SECRET:randomBytes(32).toString('hex'),DATA_DIR:dir,PORT:port,HOST:'127.0.0.1',DEMO_MODE:'true'};
let processHandle;
async function start(){
 processHandle=spawn(process.execPath,['--import','tsx','server/index.ts'],{env,stdio:['ignore','ignore','pipe']});
 let error='';processHandle.stderr.on('data',chunk=>{error+=chunk;});
 for(let i=0;i<100;i++){
  if(processHandle.exitCode!==null)throw new Error(`Production exited: ${error}`);
  try{const response=await fetch(base+'/api/health');if(response.ok)return;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 throw new Error('Production did not become ready');
}
async function stop(){if(!processHandle||processHandle.exitCode!==null)return;const handle=processHandle;await new Promise(resolve=>{handle.once('exit',resolve);handle.kill('SIGTERM');});}
try{
 await start();
 assert.equal((await fetch(base+'/api/state')).status,401);
 const html=await (await fetch(base)).text();assert.match(html,/<div id="root"><\/div>/);assert.match(html,/\/assets\/index-/);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});assert.equal(login.status,200);
 const cookieHeader=login.headers.get('set-cookie');assert.match(cookieHeader,/HttpOnly/);assert.match(cookieHeader,/Secure/);
 const cookie=cookieHeader.split(';')[0];
 const lesson=await fetch(base+'/api/lessons',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({date:'2026-11-03',title:'Production restart check',note:'',status:'planned'})});assert.equal(lesson.status,200);
 await stop();await start();
 const response=await fetch(base+'/api/state',{headers:{cookie}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.state.lessons[0].title,'Production restart check');assert.equal(result.meta.demo,true);
 console.log('Production OK: built interface, protected API, secure session, persisted lesson after restart.');
}finally{await stop();rmSync(dir,{recursive:true});}
