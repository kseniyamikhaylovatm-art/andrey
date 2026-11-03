import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {Store} from '../server/store.js';
import type {AppState} from '../src/types.js';

test('HTTP workflow: answers, teacher corrections, PDF extraction, shared data and unavailable Claude',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'es-api-'));const store=new Store(dir);const server=createApp(store).listen(0,'127.0.0.1');
 await new Promise<void>(r=>server.once('listening',r));const port=(server.address() as {port:number}).port;
 const request=async(path:string,body?:unknown,method?:string)=>{const r=await fetch(`http://127.0.0.1:${port}/api${path}`,{method:method||(body?'POST':'GET'),headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
 try{
  const {body}=await request('/state');const state=body.state as AppState;assert.equal(state.attempts.length,0);assert.equal(state.lessons.length,0);assert.equal(body.meta.ai,false);
  const card=state.cards[0];const correct=await request('/review',{cardId:card.id,answer:card.ru,seconds:12});assert.equal(correct.body.correct,true);assert.equal(correct.body.card.stage,1);
  const wrong=await request('/review',{cardId:card.id,answer:'неправильно',seconds:10});assert.equal(wrong.body.correct,false);assert.equal(wrong.body.card.stage,0);
  assert.equal((await request('/review',{cardId:card.id,answer:card.ru,seconds:-3})).status,400);
  const verb=await request('/verbs/review',{verb:'hablar',tense:'presente',answers:['hablo','hablas','habla','hablamos','hablais','hablan'],seconds:30});assert.deepEqual(verb.body.results,[true,true,true,true,false,true]);
  await request('/verbs/table',{verb:'hablar',tense:'presente',forms:['custom','hablas','habla','hablamos','habláis','hablan']},'PUT');
  assert.equal((await request('/verbs/table?verb=hablar&tense=presente')).body.forms[0],'custom');
  assert.equal((await request('/cards',{es:card.es,ru:'дубль',topic:'Рынок'})).status,409);
  const speech=await request('/ai/speech',{mode:'Монолог',topic:'Дом',text:'Hoy he hablado con mi vecino.',seconds:60});assert.equal(speech.status,503);assert.match(speech.body.error,/не подключена/);assert.equal(store.read().speeches.length,0);
  const audio=state.audios[0];const listening=await request('/listening/review',{audioId:audio.id,answer:'Помидоры и апельсины',seconds:30});assert.equal(listening.body.answer,audio.answer);assert.equal(store.read().attempts.at(-1)?.correct,null);
  const cross=await fetch(`http://127.0.0.1:${port}/api/payments`,{method:'POST',headers:{origin:'https://unrelated.invalid','content-type':'application/json'},body:JSON.stringify({date:'2026-11-01'})});assert.equal(cross.status,403);
  await request('/diary',{text:'He hablado con la vecina.',spoke:true,avoided:false});assert.equal((await request('/state')).body.state.diary.length,1);
  const summary=await request('/ai/summary',{});assert.match(summary.body.text,/ответов/);assert.ok((await request('/state')).body.state.summary);
  const source='Hola, hoy vamos a practicar espanol en el mercado del barrio.';
  const stream=`BT /F1 12 Tf 72 720 Td (${source}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const pr=await fetch(`http://127.0.0.1:${port}/api/import/pdf`,{method:'POST',headers:{'content-type':'application/pdf'},body:Buffer.from(pdf)});assert.equal(pr.status,200);assert.match((await pr.json()).text,/mercado del barrio/);
  const draft={title:'Imported lesson',transcript:source,topics:['Рынок'],assignments:['Рассказать о рынке'],cards:[{es:card.es,ru:card.ru,topic:'Рынок'}, {es:'el puesto',ru:'прилавок',topic:'Рынок'}]};
  const confirmation=await request('/import/confirm',draft);assert.equal(confirmation.body.added,1);assert.equal(confirmation.body.duplicates,1);assert.equal(store.read().lessons.at(-1)?.text,source);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));store.close();rmSync(dir,{recursive:true});}
});
test('shared access code protects data and survives a new browser session only with a valid signed cookie',async()=>{
 const old=process.env.APP_ACCESS_CODE;process.env.APP_ACCESS_CODE='test-access-code-only';const dir=mkdtempSync(join(tmpdir(),'es-auth-'));const store=new Store(dir);const server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 try{assert.equal((await fetch(base+'/api/state')).status,401);assert.equal((await fetch(base+'/api/export')).status,401);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'test-access-code-only'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];assert.equal((await fetch(base+'/api/state',{headers:{cookie}})).status,200);assert.equal((await fetch(base+'/api/state',{headers:{cookie:cookie+'forged'}})).status,401);
 }finally{if(old===undefined)delete process.env.APP_ACCESS_CODE;else process.env.APP_ACCESS_CODE=old;await new Promise<void>(r=>server.close(()=>r()));store.close();rmSync(dir,{recursive:true});}
});
