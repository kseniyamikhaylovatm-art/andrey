import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {Store} from '../server/store.js';
import {studyMaterial} from '../server/study-material.js';
import {initialState} from '../server/domain.js';
test('self-review validates grades, saves SRS once even on retry and retains errors as relearning',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'recall-test-')),store=new Store(dir),server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+(server.address() as {port:number}).port;const card=store.read().cards[0];
 const send=async(data:unknown)=>{const response=await fetch(base+'/api/review/self',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};};
 try{const payload={cardId:card.id,correct:true,attemptId:randomUUID(),seconds:4};
 assert.equal((await send({...payload,correct:'true'})).status,400);assert.equal(store.read().cards[0].seen,0);
 const first=await send(payload);assert.equal(first.body.card.stage,1);const due=first.body.card.due;
 assert.equal((await send(payload)).body.card.due,due);assert.equal(store.read().cards[0].seen,1);assert.equal(store.read().attempts.length,1);
 assert.equal((await send({...payload,correct:false})).status,409);
 const wrong=await send({...payload,correct:false,attemptId:randomUUID()});assert.equal(wrong.body.card.stage,0);assert.ok(Date.parse(wrong.body.card.due)-Date.now()<=600000);assert.equal(store.read().cards[0].seen,2);
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();rmSync(dir,{recursive:true});}
});
test('example curriculum uses recorded lesson vocabulary and studied words, excluding untouched unrelated cards',()=>{
 const state=initialState();state.cards[0].seen=1;state.lessons.push({id:'own',date:'2026-11-17',title:'Знакомая тема',status:'planned',note:'Урок',cardIds:[state.cards[1].id]});
 state.lessons.push({id:'future',date:'2027-01-01',title:'Не пройденная грамматика',status:'planned',note:'Новый материал'});const material=studyMaterial(state);assert.equal(material.lessons.length,1);assert.deepEqual(material.vocabulary.map(c=>c.es),[state.cards[0].es,state.cards[1].es]);assert.equal(material.lessons[0].title,'Знакомая тема');
});
