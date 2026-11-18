import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState,review} from '../server/domain.js';
import {AnkiSessions} from '../server/anki-practice.js';
import {ankiRatings,ankiSchedule,reviewAnki} from '../src/anki-schedule.js';
import {practiceProgress} from '../src/practice-progress.js';
import {beginPractice,finishPractice,recordPractice} from '../server/practice-rewards.js';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
import type {AppState,Attempt,PracticeFormat} from '../src/types.js';
test('four Anki grades schedule real learning steps and graduate to longer intervals',()=>{
 const card=initialState().cards[0],now=new Date('2026-11-18T12:00:00Z');
 assert.deepEqual(ankiRatings.map(rating=>ankiSchedule(card,rating).delay),[60000,360000,600000,345600000]);
 reviewAnki(card,'good',now);assert.equal(card.ankiStep,1);assert.equal(card.stage,0);assert.equal(Date.parse(card.due)-+now,600000);
 reviewAnki(card,'good',now);assert.equal(card.stage,1);assert.equal(card.ankiLearning,false);assert.equal(Date.parse(card.due)-+now,86400000);
 reviewAnki(card,'easy',now);assert.equal(card.stage,3);reviewAnki(card,'again',now);assert.equal(card.stage,0);assert.equal(Date.parse(card.due)-+now,60000);
 review(card,true);assert.equal(card.ankiLearning,undefined);assert.equal(card.ankiStep,undefined);assert.equal(card.stage,1);
});
test('Anki sessions enforce ownership and order, and retries do not change SRS twice',()=>{
 const state=initialState();state.cards=state.cards.slice(0,2);const sessions=new AnkiSessions(),first=sessions.start('owner',state,{mode:'all'});let count=0;
 const mutate=<T>(fn:(state:AppState)=>T)=>fn(state),record=()=>{count++;};
 assert.throws(()=>sessions.answer('other',first.id,0,'good',mutate,record));assert.throws(()=>sessions.answer('owner',first.id,1,'good',mutate,record));
 const next=sessions.answer('owner',first.id,0,'good',mutate,record),card=state.cards.find(card=>card.id===first.cardId)!;const due=card.due;
 assert.deepEqual(sessions.answer('owner',first.id,0,'good',mutate,record),next);assert.equal(count,1);assert.equal(card.seen,1);assert.equal(card.due,due);assert.throws(()=>sessions.answer('owner',first.id,0,'easy',mutate,record));
 const end=sessions.answer('owner',first.id,1,'easy',mutate,record);assert.equal(end.cardId,null);assert.equal(end.index,2);
});
test('XP is capped per word, format and Madrid day; progress and streaks remain separate',()=>{
 const state=initialState();state.attempts=[];let n=0;const word=state.cards[0];
 const log=(format:PracticeFormat,at:string,correct=true,completed=true,rating?:Attempt['rating'])=>recordPractice(state,{id:String(n++),kind:'card',at,cardId:word.id,correct,seconds:2,rating},format,'session',completed);
 word.stage=4;log('anki','2026-11-16T12:00:00Z',true,true,'easy');log('anki','2026-11-17T12:00:00Z',true,true,'easy');log('anki','2026-11-17T15:00:00Z',true,true,'easy');log('duolingo','2026-11-17T16:00:00Z',false,false);log('duolingo','2026-11-17T16:01:00Z');log('anki','2026-11-17T23:30:00Z',true,true,'hard');
 const now=new Date('2026-11-18T12:00:00Z'),stats=practiceProgress(state,now);assert.equal(stats.xp,40);assert.equal(stats.formats.find(f=>f.format==='anki')!.streak,3);assert.equal(stats.formats.find(f=>f.format==='duolingo')!.streak,1);assert.equal(stats.formats.find(f=>f.format==='anki')!.difficult,1);assert.equal(stats.formats.find(f=>f.format==='duolingo')!.difficult,1);
 const after=practiceProgress(state,new Date('2026-11-20T12:00:00Z'));assert.equal(after.streak,0);assert.equal(after.xp,40);
 const previous=state.attempts.at(-1)!;assert.equal(recordPractice(state,previous,'anki','session',true),false);assert.equal(state.attempts.length,6);
});
test('graded Anki answers and session history persist after reopening the store, server rejects altered retries',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'anki-api-'));let store=new Store(dir);store.mutate(state=>{state.cards=state.cards.slice(0,1);state.attempts=[];});const server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const post=async(path:string,data:unknown)=>{const response=await fetch(base+'/api'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};};
 try{const first=(await post('/anki/start',{mode:'all'})).body,payload={id:first.id,index:0,rating:'easy',seconds:3};assert.equal((await post('/anki/answer',{...payload,rating:'unknown'})).status,400);const end=await post('/anki/answer',payload);assert.equal(end.body.cardId,null);assert.equal((await post('/anki/answer',payload)).status,200);assert.equal((await post('/anki/answer',{...payload,rating:'hard'})).status,409);assert.equal(store.read().attempts.length,1);assert.equal(store.read().attempts[0].xp,10);assert.ok(store.read().practiceSessions?.[0].finishedAt);
 const second=(await post('/anki/start',{mode:'all'})).body;await post('/anki/answer',{...payload,id:second.id});assert.equal(practiceProgress(store.read()).xp,10);
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();}
 try{store=new Store(dir);assert.equal(practiceProgress(store.read()).xp,10);assert.equal(practiceProgress(store.read()).formats.find(f=>f.format==='anki')!.completed,2);assert.equal(store.read().cards[0].stage,5);}finally{store.close();rmSync(dir,{recursive:true});}
});
test('legacy records are retained without inventing format or XP and session completion is idempotent',()=>{
 const state=initialState();state.attempts=[{id:'self:old',kind:'card',at:new Date().toISOString(),correct:true,seconds:1,cardId:state.cards[0].id},{id:'mixed:old',kind:'card',at:new Date().toISOString(),correct:true,seconds:1,cardId:state.cards[0].id}];beginPractice(state,{id:'s',format:'anki',startedAt:new Date().toISOString(),total:1});finishPractice(state,'s','2026-11-18T12:00:00Z');finishPractice(state,'s','2026-11-18T13:00:00Z');assert.equal(state.practiceSessions![0].finishedAt,'2026-11-18T12:00:00Z');const stats=practiceProgress(state);assert.equal(stats.xp,0);assert.equal(stats.formats.find(f=>f.format==='seventeen')!.attempts,1);assert.equal(stats.formats.find(f=>f.format==='anki')!.attempts,0);assert.equal(state.attempts.length,2);
});
test('17 languages and Duolingo record separate server-assigned XP and completion; a wrong choice cannot claim completion',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'format-rewards-')),store=new Store(dir);store.mutate(state=>{state.cards=state.cards.slice(0,4);state.cards.forEach((card,index)=>{card.topic=index<3?'mixed':'duo';card.examples=[];if(index===3){card.es='hola';card.ru='привет';}});state.attempts=[];});const server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const post=async(path:string,data:unknown)=>{const response=await fetch(base+'/api'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});assert.equal(response.status,200);return response.json();};
 try{let step=await post('/practice/start',{mode:'all',topic:'mixed',includeVerbs:false});for(let index=0;index<3;index++){
  if(index===2){const task=step.task,wrong=task.optionIds.find((id:string)=>id!==task.cardId),bad=await post('/practice/answer',{id:step.id,index,answerCardId:wrong,correct:true,seconds:2});assert.equal(bad.answered,false);assert.equal(store.read().attempts.at(-1)!.xp,0);assert.equal(store.read().practiceSessions![0].finishedAt,undefined);}
  const payload={id:step.id,index,...step.task.kind==='recall'?{correct:true}:{answerCardId:step.task.cardId},seconds:2};await post('/practice/answer',payload);await post('/practice/answer',payload);step=await post('/practice/next',{id:step.id,index});
 }assert.equal(step.task,null);
 let duo=await post('/lingva/start',{topic:'duo'});const card=store.read().cards.find(card=>card.topic==='duo')!;for(let index=0;index<13;index++)duo={...await post('/lingva/answer',{id:duo.id,index,answer:card.es,seconds:2}),id:duo.id};assert.equal(duo.task,null);
 const stats=practiceProgress(store.read());assert.equal(stats.xp,40);const mixed=stats.formats.find(item=>item.format==='seventeen')!,lingva=stats.formats.find(item=>item.format==='duolingo')!;assert.equal(mixed.xp,30);assert.equal(mixed.completed,1);assert.equal(mixed.words,3);assert.equal(mixed.difficult,1);assert.equal(lingva.xp,10);assert.equal(lingva.words,1);assert.equal(lingva.completed,1);
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();rmSync(dir,{recursive:true});}
});
