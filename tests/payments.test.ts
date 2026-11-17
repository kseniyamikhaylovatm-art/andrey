import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
import {paymentBalance,initialState} from '../server/domain.js';
test('different package sizes are summed, legacy payments remain 12 and cancelled or planned lessons are not deducted',()=>{
 const state=initialState();state.payments=[{id:'legacy',date:'2026-11-01'},{id:'small',date:'2026-11-02',lessons:4},{id:'single',date:'2026-11-03',lessons:1}];
 state.lessons=[{id:'held',date:'2026-11-04',title:'Урок',status:'held',note:''},{id:'planned',date:'2026-11-05',title:'Позже',status:'planned',note:''},{id:'cancelled',date:'2026-11-06',title:'Отмена',status:'cancelled',note:''}];
 assert.deepEqual(paymentBalance(state),{paid:17,used:1,remaining:16,last:'2026-11-03'});
 state.payments=[{id:'small',date:'2026-11-01',lessons:1}];state.lessons.push({id:'debt',date:'2026-11-07',title:'Ещё урок',status:'held',note:''});assert.equal(paymentBalance(state).remaining,-1);
});
test('payment quantities and edits are validated, retried creation is counted once and pupil balances stay isolated after restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'payment-count-'));let store=new Store(dir);const server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const a=store.createStudent('Пакет 4','A1'),b=store.createStudent('Пакет 8','B1');
 const send=async(studentId:string,path:string,body:unknown,method='POST')=>{const response=await fetch(base+'/api'+path,{method,headers:{'content-type':'application/json','X-Student-Id':studentId},body:JSON.stringify(body)});return response.status;};
 try{
 for(const lessons of [0,-1,1.5,1001])assert.equal(await send(a.student.id,'/payments',{date:'2026-11-17',lessons}),400);
 const requestId=randomUUID(),payload={date:'2026-11-17',lessons:4,note:'Пакет четыре',requestId};assert.equal(await send(a.student.id,'/payments',payload),200);assert.equal(await send(a.student.id,'/payments',payload),200);assert.equal(store.profile(a.student.id).payment?.paid,4);
 assert.equal(await send(a.student.id,'/payments',{...payload,lessons:8}),409);
 assert.equal(await send(b.student.id,'/payments',{date:'2026-11-17',lessons:8}),200);assert.equal(store.profile(b.student.id).payment?.paid,8);
 assert.equal(await send(a.student.id,'/payments/'+requestId,{date:'2026-11-17',lessons:6,note:'Исправлено'},'PATCH'),200);assert.equal(store.profile(a.student.id).payment?.paid,6);
 assert.equal(await send(b.student.id,'/payments/'+requestId,{date:'2026-11-17',lessons:9},'PATCH'),404);
 assert.equal(await send(a.student.id,'/payments/'+requestId,{date:'2026-11-17',lessons:0},'PATCH'),400);assert.equal(store.profile(a.student.id).payment?.paid,6);
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();}
 try{store=new Store(dir);assert.equal(store.profile(a.student.id).payment?.paid,6);assert.equal(store.profile(b.student.id).payment?.paid,8);}finally{store.close();rmSync(dir,{recursive:true});}
});
