import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {conjugate,initialState,paymentBalance,review} from '../server/domain.js';
import {Store} from '../server/store.js';

test('SRS schedules actual answers on 1/2/4/8/16/32 days and relearns mistakes',()=>{
 const c=initialState().cards[0];const now=new Date('2026-11-03T12:00:00Z');
 for(const days of [1,2,4,8,16,32,32]){review(c,true,now);assert.equal(Date.parse(c.due)-+now,days*86400000);}
 review(c,false,now);assert.equal(c.stage,0);assert.equal(Date.parse(c.due)-+now,600000);assert.equal(c.seen,8);assert.equal(c.correct,7);
});
test('Spanish forms preserve irregular verbs, accents, reflexives and four progressive times',()=>{
 assert.deepEqual(conjugate('hablar','presente'),['hablo','hablas','habla','hablamos','habláis','hablan']);
 assert.equal(conjugate('decir','perfecto')?.[0],'he dicho');assert.equal(conjugate('llegar','indefinido')?.[0],'llegué');
 assert.equal(conjugate('ir','imperfecto')?.[3],'íbamos');assert.equal(conjugate('contar','presente')?.[3],'contamos');
 assert.equal(conjugate('escaparse','gerundio_perfecto')?.[0],'me he estado escapando');
 assert.equal(conjugate('decir','gerundio_indefinido')?.[2],'estuvo diciendo');
 assert.equal(conjugate('ver','gerundio_imperfecto')?.[4],'estabais viendo');
 assert.equal(conjugate('ir','gerundio_presente')?.[1],'estás yendo');assert.equal(conjugate('inventar','presente'),null);
});
test('12-lesson packages exclude cancelled lessons and express debt in lessons',()=>{
 const s=initialState();s.payments.push({id:'p',date:'2026-10-01'});
 s.lessons=Array.from({length:14},(_,i)=>({id:String(i),date:'2026-11-01',title:'Lesson',note:'',status:i===0?'cancelled':'held'}));
 assert.equal(paymentBalance(s).remaining,-1);assert.equal(paymentBalance(s).used,13);
});
test('SQLite survives restart and transactions cannot partially overwrite data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'es-store-'));let store=new Store(dir);
 try{store.mutate(s=>{s.diary.push({id:'real',date:new Date().toISOString(),text:'Hablé con mi vecino.',spoke:true,avoided:false});});
 assert.throws(()=>store.mutate(s=>{s.diary=[];throw new Error('rollback');}));
 store.mutate(s=>{s.summary={text:'Test summary',date:new Date().toISOString()};});assert.equal(store.read().summary?.text,'Test summary');
 store.close();store=new Store(dir);assert.equal(store.read().diary[0].text,'Hablé con mi vecino.');assert.equal(store.read().summary?.text,'Test summary');
 }finally{store.close();rmSync(dir,{recursive:true});}
});
