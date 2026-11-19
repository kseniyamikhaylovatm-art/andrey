import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {QuizletSessions} from '../server/quizlet.js';
import {initialState} from '../server/domain.js';
import {beginPractice} from '../server/practice-rewards.js';
import {practiceProgress} from '../src/practice-progress.js';
import type {AppState} from '../src/types.js';
import type {QuizletStep,QuizletMode} from '../src/quizlet-types.js';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
function setup(mode:QuizletMode='cards'){
 const state=initialState();state.cards=state.cards.slice(0,3);state.attempts=[];const sessions=new QuizletSessions(),step=sessions.start('a',state,{mode,direction:'mixed',limit:10});beginPractice(state,{id:step.id,format:'quizlet',quizletMode:mode,startedAt:new Date().toISOString(),total:step.totalWords});const mutate=<T>(fn:(state:AppState)=>T)=>fn(state);return {state,sessions,step,mutate};
}
function expected(state:AppState,step:QuizletStep){const card=state.cards.find(card=>card.id===step.task!.cardId)!;return step.task!.direction==='es-ru'?card.ru:card.es;}
test('Quizlet flashcards alternate languages, require revealing, enforce ownership and grade only once',()=>{
 const {state,sessions,mutate}=setup();let step=sessions.start('a',state,{mode:'cards',direction:'mixed',limit:3});const card=state.cards.find(card=>card.id===step.task!.cardId)!;
 assert.equal(step.task!.direction,'es-ru');assert.equal(step.reveal,undefined);assert.throws(()=>sessions.reveal('b',step.id,0));assert.throws(()=>sessions.answer('a',{id:step.id,index:0,value:'yes',seconds:1},mutate));
 assert.equal(sessions.reveal('a',step.id,0).reveal,card.ru);const payload={id:step.id,index:0,value:'yes',seconds:2},graded=sessions.answer('a',payload,mutate),due=card.due;
 assert.deepEqual(sessions.answer('a',payload,mutate),graded);assert.equal(card.seen,1);assert.equal(card.due,due);assert.throws(()=>sessions.answer('a',{...payload,value:'no'},mutate));
 step=sessions.next('a',step.id,0);assert.equal(step.task!.direction,'ru-es');assert.equal(step.reveal,undefined);assert.equal(sessions.reveal('a',step.id,1).reveal,expected(state,step));
 for(const direction of ['es-ru','ru-es'] as const){const fixed=sessions.start('a',state,{mode:'cards',direction,limit:3});assert.equal(fixed.task!.direction,direction);}
});
test('learning counts two different successful steps per word, repeats errors and never inflates SRS or XP',()=>{
 const {state,sessions,mutate}=setup('learn');let step=sessions.start('a',state,{mode:'learn',direction:'mixed',limit:3});beginPractice(state,{id:step.id,format:'quizlet',quizletMode:'learn',startedAt:new Date().toISOString(),total:3});let n=0,badId='',wrongOnce=false;
 while(step.task){const task=step.task;let value=task.kind==='choice'?task.cardId:expected(state,step);if(!wrongOnce){badId=task.cardId;value=task.options!.find(option=>option.id!==task.cardId)!.id;wrongOnce=true;}
  const answer=sessions.answer('a',{id:step.id,index:step.index,value,seconds:2},mutate);if(n===0){assert.equal(answer.completedWords,0);assert.equal(answer.remaining,7);assert.equal(state.attempts[0].xp,0);}if(n<3)assert.equal(answer.completedWords,0);step=sessions.next('a',step.id,step.index);assert.ok(++n<20);
 }
 assert.equal(n,7);assert.equal(step.completedWords,3);assert.equal(state.cards.find(card=>card.id===badId)!.seen,1);assert.equal(state.cards.find(card=>card.id===badId)!.stage,0);assert.equal(practiceProgress(state).formats.find(item=>item.format==='quizlet')!.xp,30);assert.equal(state.practiceSessions!.find(session=>session.id===step.id)!.finishedAt!==undefined,true);
});
test('test answers are checked on the server, results remain hidden until the end, and write accents matter',()=>{
 const {state,sessions,mutate}=setup('test');state.cards[0].es='el café';let step=sessions.start('a',state,{mode:'test',direction:'ru-es',limit:3});const kinds=new Set();let wrong=0;
 while(step.task){const task=step.task;kinds.add(task.kind);const expectedValue=expected(state,step),value=task.kind==='choice'?task.cardId:task.kind==='boolean'?(task.statement===expectedValue?'yes':'no'):'неверный ответ';const answer=sessions.answer('a',{id:step.id,index:step.index,value,seconds:1},mutate);assert.equal(answer.feedback,undefined);assert.equal(answer.results,undefined);if(task.kind==='write')wrong++;step=sessions.next('a',step.id,step.index);}
 assert.deepEqual([...kinds],['choice','write','boolean']);assert.equal(step.results!.filter(item=>!item.correct).length,wrong);assert.equal(step.correctFirst,2);
 state.cards=state.cards.slice(0,1);step=sessions.start('a',state,{mode:'test',direction:'ru-es',limit:1});assert.equal(step.task!.kind,'write');const answer=sessions.answer('a',{id:step.id,index:0,value:'el cafe',seconds:1},mutate);assert.equal(answer.feedback,undefined);assert.equal(sessions.next('a',step.id,0).results![0].correct,false);
});
test('a changed card or failed transaction cannot advance learning or persist an invented answer',()=>{
 const {state,sessions,step,mutate}=setup('learn'),payload={id:step.id,index:0,value:step.task!.cardId,seconds:1};assert.throws(()=>sessions.answer('a',payload,()=>{throw new Error('database unavailable');}));assert.equal(state.attempts.length,0);state.cards.find(card=>card.id===payload.value)!.ru='изменено';assert.throws(()=>sessions.answer('a',payload,mutate));assert.equal(state.attempts.length,0);assert.throws(()=>sessions.next('a',step.id,0));
});
test('Quizlet HTTP rejects another pupil and forged grades; its real attempts and results summary persist after restart',async()=>{
 const previous={teacher:process.env.TEACHER_ACCESS_CODE,secret:process.env.SESSION_SECRET};process.env.TEACHER_ACCESS_CODE='quizlet-teacher-test-code';process.env.SESSION_SECRET='quizlet-test-secret-with-at-least-32-characters';let teacherCookie='';
 const dir=mkdtempSync(join(tmpdir(),'quizlet-api-'));let store=new Store(dir);const student=store.createStudent('Quizlet','A1',true);const server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api';
 const post=async(path:string,body:unknown,cookie=teacherCookie)=>{const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...cookie?{cookie}:{}},body:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 try{teacherCookie=(await post('/login',{code:process.env.TEACHER_ACCESS_CODE})).cookie!;const step=(await post('/quizlet/start',{mode:'cards',direction:'mixed',limit:1})).body;const other=(await post('/login',{code:student.code})).cookie;assert.equal((await post('/quizlet/reveal',{id:step.id,index:0},other)).status,404);await post('/quizlet/reveal',{id:step.id,index:0});const payload={id:step.id,index:0,value:'yes',seconds:2};assert.equal((await post('/quizlet/answer',{...payload,correct:true})).status,400);assert.equal((await post('/quizlet/answer',payload)).status,200);assert.equal((await post('/quizlet/answer',payload)).status,200);await post('/quizlet/next',{id:step.id,index:0});assert.equal(store.read().attempts.length,1);assert.equal(store.read().attempts[0].format,'quizlet');assert.equal(store.withStudent(student.student.id,()=>store.read().attempts.length),0);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();for(const [key,value] of [['TEACHER_ACCESS_CODE',previous.teacher],['SESSION_SECRET',previous.secret]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;}
 try{store=new Store(dir);const stats=practiceProgress(store.read()).formats.find(item=>item.format==='quizlet')!;assert.equal(stats.completed,1);assert.equal(stats.xp,10);assert.equal(stats.words,1);}finally{store.close();rmSync(dir,{recursive:true});}
});
