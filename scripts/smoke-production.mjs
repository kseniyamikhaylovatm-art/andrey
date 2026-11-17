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
const env={...process.env,NODE_ENV:'production',TEACHER_ACCESS_CODE:code,APP_ACCESS_CODE:randomBytes(20).toString('hex'),SESSION_SECRET:randomBytes(32).toString('hex'),DATA_DIR:dir,PORT:port,HOST:'127.0.0.1',DEMO_MODE:'true'};
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
 const created=await fetch(base+'/api/students',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({name:'Production student',level:'B1'})});assert.equal(created.status,201);const student=await created.json();
 const learnerLogin=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:student.code})});assert.equal(learnerLogin.status,200);const studentCookie=learnerLogin.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(base+'/api/students',{headers:{cookie:studentCookie}})).status,403);
 const recorded=await fetch(base+'/api/lesson-words',{method:'POST',headers:{'content-type':'application/json',cookie,'X-Student-Id':student.student.id},body:JSON.stringify({date:'2026-11-17',text:'la puerta — дверь',title:'Первое занятие'})});assert.equal(recorded.status,200);const vocabulary=await recorded.json();
 const lesson=await fetch(base+'/api/lessons',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({date:'2026-11-03',title:'Production restart check',note:'',status:'planned'})});assert.equal(lesson.status,200);
 await stop();await start();
 const response=await fetch(base+'/api/state',{headers:{cookie}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.state.lessons[0].title,'Production restart check');assert.equal(result.meta.demo,true);
 const own=await (await fetch(base+'/api/state',{headers:{cookie:studentCookie}})).json();assert.equal(own.meta.student.id,student.student.id);assert.equal(own.state.lessons.length,1);assert.deepEqual(own.state.lessons[0].cardIds,[vocabulary.cardId]);assert.equal(own.state.cards[0].ru,'дверь');
 const afterRestart=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:student.code})});assert.equal(afterRestart.status,200);
 console.log('Production OK: built interface, protected roles, secure sessions, student codes and dated vocabulary linked to automation persist after restart.');
}finally{await stop();rmSync(dir,{recursive:true});}
