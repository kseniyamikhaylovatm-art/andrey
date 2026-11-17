import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {choiceCorrect,practiceChoices} from '../src/practice-choices.js';
import {initialState} from '../server/domain.js';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
test('choice options contain the right answer and unique real enabled translations in each direction',()=>{
 const cards=initialState().cards,target=cards[0];
 for(const direction of ['es-ru','ru-es'] as const){for(let run=0;run<8;run++){const choices=practiceChoices(cards,target,direction);assert.equal(choices.length,4);assert.ok(choices.some(c=>c.id===target.id));assert.equal(choices.filter(c=>choiceCorrect(target,c,direction)).length,1);assert.equal(new Set(choices.map(c=>direction==='es-ru'?c.ru:c.es)).size,4);}}
 const synonym={...target,id:'synonym',es:'otro barrio'},disabled={...cards[1],enabled:false};
 assert.deepEqual(practiceChoices([target,synonym,disabled],target,'ru-es').map(c=>c.id),[target.id]);assert.equal(choiceCorrect(target,synonym,'ru-es'),true);
});
test('server verifies both translation directions and retries do not advance SRS twice',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'choice-test-')),store=new Store(dir),server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const send=async(payload:unknown)=>{const response=await fetch(base+'/api/review/choice',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});return {status:response.status,body:await response.json()};};
 try{const [target,other]=store.read().cards,payload={cardId:target.id,answerCardId:target.id,direction:'ru-es',attemptId:randomUUID(),seconds:5};
 assert.equal((await send(payload)).body.correct,true);assert.equal(store.read().cards[0].stage,1);const due=store.read().cards[0].due;
 assert.equal((await send(payload)).body.correct,true);assert.equal(store.read().cards[0].due,due);assert.equal(store.read().attempts.length,1);
 assert.equal((await send({...payload,answerCardId:other.id})).status,409);
 assert.equal((await send({...payload,direction:'es-ru',answerCardId:other.id,attemptId:randomUUID()})).body.correct,false);assert.equal(store.read().cards[0].stage,0);
 assert.equal((await send({...payload,answerCardId:'outside-this-cabinet',attemptId:randomUUID()})).status,404);
 assert.equal((await send({...payload,direction:'unknown'})).status,400);
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();rmSync(dir,{recursive:true});}
});
