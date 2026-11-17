import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
import {initialState} from '../server/domain.js';
import {accessControl} from '../server/access.js';

test('the original SQLite space migrates intact; isolated students survive restart and concurrent asynchronous work',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'es-migration-'));
  const old=new DatabaseSync(join(dir,'mi-espanol.sqlite')),original=initialState();
  original.diary.push({id:'old-diary',date:new Date().toISOString(),text:'Existing personal notes',spoke:true,avoided:false});
  old.exec('CREATE TABLE workspace (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)');old.prepare('INSERT INTO workspace VALUES (1,?)').run(JSON.stringify(original));old.close();
  let store=new Store(dir);
  try{
    assert.deepEqual(store.read(),original);
    const a=store.createStudent('Мария','B1'),b=store.createStudent('Павел','A2',true);
    assert.equal(a.student.cards,0);assert.equal(b.student.cards,24);assert.notEqual(a.code,b.code);
    assert.equal(store.student(a.student.id)?.code_hash?.includes(a.code),false);
    await Promise.all([a,b].map((entry,index)=>store.withStudent(entry.student.id,async()=>{
      await new Promise(resolve=>setTimeout(resolve,index?1:5));
      store.mutate(state=>state.diary.push({id:String(index),date:new Date().toISOString(),text:entry.student.name,spoke:true,avoided:false}));
      await Promise.resolve();assert.equal(store.read().diary[0].text,entry.student.name);
    })));
    store.withStudent(a.student.id,()=>assert.throws(()=>store.mutate(state=>{state.diary=[];throw new Error('rollback');})));
    assert.deepEqual(store.read(),original);
    store.close();store=new Store(dir);
    assert.deepEqual(store.read(),original);
    assert.equal(store.withStudent(a.student.id,()=>store.read().diary[0].text),'Мария');
    assert.equal(store.withStudent(b.student.id,()=>store.read().diary[0].text),'Павел');
    assert.equal(store.findCode(a.code)?.id,a.student.id);
    const metadata=JSON.stringify(store.listStudents());assert.ok(!metadata.includes('code_hash'));assert.ok(!metadata.includes(a.code));
  }finally{store.close();rmSync(dir,{recursive:true});}
});

test('teacher and student access enforce tenant boundaries, teacher-only writes and code revocation on the server',async()=>{
  const saved={teacher:process.env.TEACHER_ACCESS_CODE,legacy:process.env.APP_ACCESS_CODE,secret:process.env.SESSION_SECRET};
  process.env.TEACHER_ACCESS_CODE='owner-code-for-account-tests';process.env.APP_ACCESS_CODE='legacy-student-code';process.env.SESSION_SECRET='stable-test-secret-for-session-restart';
  const dir=mkdtempSync(join(tmpdir(),'es-accounts-')),store=new Store(dir),server=createApp(store).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api';
  const request=async(path:string,cookie='',body?:unknown,method?:string,studentId?:string)=>{
    const headers:Record<string,string>={cookie};if(body!==undefined)headers['content-type']='application/json';if(studentId)headers['x-student-id']=studentId;
    const response=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
  };
  try{
    assert.equal((await request('/students')).status,401);
    const teacher=await request('/login','',{code:process.env.TEACHER_ACCESS_CODE});assert.equal(teacher.body.role,'teacher');
    const a=(await request('/students',teacher.cookie,{name:'Мария',level:'B1',examples:true})).body;
    const b=(await request('/students',teacher.cookie,{name:'Павел',level:'A2'})).body;
    const learner=await request('/login','',{code:a.code.toLowerCase().replaceAll('-',' ')});assert.equal(learner.status,200);assert.equal(learner.body.role,'student');
    const own=await request('/state',learner.cookie);assert.equal(own.body.meta.student.id,a.student.id);assert.equal(own.body.state.cards.length,24);
    const card=own.body.state.cards[0];
    assert.equal((await request('/review',learner.cookie,{cardId:card.id,answer:card.ru,seconds:8})).body.correct,true);
    assert.equal((await request('/diary',learner.cookie,{text:'Private student A',spoke:true,avoided:false})).status,200);
    assert.equal((await request('/state',teacher.cookie,undefined,'GET',b.student.id)).body.state.diary.length,0);
    for(const path of ['/state','/export','/verbs/table?verb=hablar&tense=presente','/cards/'+card.id+'/context'])assert.equal((await request(path,learner.cookie,undefined,'GET',b.student.id)).status,403,path);
    assert.equal((await request('/export?studentId='+b.student.id,learner.cookie)).status,403);
    assert.equal((await request('/review',learner.cookie,{cardId:card.id,answer:card.ru},'POST',b.student.id)).status,403);
    for(const [path,body,method] of [
      ['/students',undefined,'GET'],['/students',{name:'intruder'},'POST'],['/students/'+b.student.id+'/code',{},'POST'],
      ['/payments',{date:'2026-11-17'},'POST'],['/lessons',{title:'intruder'},'POST'],['/assignments',{title:'intruder'},'POST'],
      ['/plan',own.body.state.plan,'PUT'],['/verbs/table',{verb:'hablar',tense:'presente',forms:Array(6).fill('wrong')},'PUT'],
      ['/cards/'+card.id+'/tense-example',{tense:'presente',es:'Wrong',ru:'Wrong'},'PUT'],['/ai/summary',{},'POST'],['/ai/document',{},'POST'],['/import/confirm',{},'POST'],
    ] as const)assert.equal((await request(path,learner.cookie,body,method)).status,403,path);
    assert.equal((await request('/cards/'+card.id,learner.cookie,{focused:true},'PATCH')).status,200);
    assert.equal((await request('/cards/'+card.id,learner.cookie,{focused:true,ru:'tampered'},'PATCH')).status,400);
    assert.equal((await request('/cards/'+card.id,teacher.cookie,{ru:'Teacher correction'},'PATCH',a.student.id)).status,200);
    const assignment=(await request('/assignments',teacher.cookie,{title:'Do homework',due:'2026-11-18'},'POST',a.student.id)).body;
    assert.equal((await request('/assignments/'+assignment.id,learner.cookie,{done:true},'PATCH')).status,200);
    const list=(await request('/students',teacher.cookie)).body;assert.equal(list.students.length,3);assert.ok(!JSON.stringify(list).includes(a.code));
    const studentExport=(await request('/export',learner.cookie)).body;assert.equal(studentExport.student.id,a.student.id);assert.ok(!JSON.stringify(studentExport).includes(b.student.id));
    const payload=learner.cookie.split('=')[1].split('.')[0],parsed=JSON.parse(Buffer.from(payload,'base64url').toString());parsed.role='teacher';
    const forged='mi_session='+Buffer.from(JSON.stringify(parsed)).toString('base64url')+'.'+learner.cookie.split('.').at(-1);
    assert.equal((await request('/students',forged)).status,401);
    const renewed=(await request('/students/'+a.student.id+'/code',teacher.cookie,{})).body.code;
    assert.equal((await request('/state',learner.cookie)).status,401);assert.equal((await request('/login','',{code:a.code})).status,401);
    const loginAgain=await request('/login','',{code:renewed});assert.equal(loginAgain.status,200);
    assert.equal((await request('/state',loginAgain.cookie)).body.state.diary[0].text,'Private student A');
    const legacy=await request('/login','',{code:process.env.APP_ACCESS_CODE});assert.equal(legacy.body.role,'student');assert.equal(legacy.body.studentId,'legacy');assert.equal((await request('/students',legacy.cookie)).status,403);
    const expires=String(Date.now()+60000),oldSig=createHmac('sha256',process.env.SESSION_SECRET!).update(expires).digest('hex');
    assert.equal((await request('/state','mi_session='+expires+'.'+oldSig)).status,401,'Old role-free cookies must not acquire teacher privileges');
    await request('/students/legacy/code',teacher.cookie,{});assert.equal((await request('/login','',{code:process.env.APP_ACCESS_CODE})).status,401);
  }finally{
    await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();rmSync(dir,{recursive:true});
    for(const [key,value] of Object.entries({TEACHER_ACCESS_CODE:saved.teacher,APP_ACCESS_CODE:saved.legacy,SESSION_SECRET:saved.secret}))if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});

test('a legacy deployment never grants teacher privileges without a separate teacher credential',()=>{
  const teacher=process.env.TEACHER_ACCESS_CODE,legacy=process.env.APP_ACCESS_CODE;delete process.env.TEACHER_ACCESS_CODE;process.env.APP_ACCESS_CODE='legacy-access-test';
  const dir=mkdtempSync(join(tmpdir(),'es-legacy-')),store=new Store(dir);
  try{
    const access=accessControl(store);assert.equal(access.login('legacy-access-test')?.role,'student');assert.equal(access.session(null).teacherConfigured,false);
    process.env.TEACHER_ACCESS_CODE='legacy-access-test';assert.throws(()=>accessControl(store),/must be different/);
  }finally{if(teacher===undefined)delete process.env.TEACHER_ACCESS_CODE;else process.env.TEACHER_ACCESS_CODE=teacher;if(legacy===undefined)delete process.env.APP_ACCESS_CODE;else process.env.APP_ACCESS_CODE=legacy;store.close();rmSync(dir,{recursive:true});}
});
