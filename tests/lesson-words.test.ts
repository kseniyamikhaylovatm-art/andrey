import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
import {addLessonWord,addLessonWords,lessonWordsInput,lessonWordInput} from '../server/lesson-words.js';
import {paymentBalance} from '../src/payment-balance.js';
import {lessonCards} from '../src/lesson-vocabulary.js';

test('saving vocabulary marks the existing lesson held, charges it once and rolls back failures',()=>{
 const dir=mkdtempSync(join(tmpdir(),'es-vocabulary-attendance-')),store=new Store(dir);
 const input={date:'2026-11-20',lessonId:'scheduled',text:'la ventana — окно',topic:'Дом',title:''};
 try{
  store.mutate(state=>{state.payments=[{id:'paid',date:'2026-11-01',lessons:4}];state.lessons.push({id:'scheduled',date:input.date,title:'Наш урок',status:'planned',note:'Сохранить заметку'});});
  const before=store.read();assert.throws(()=>store.mutate(state=>addLessonWords(state,lessonWordsInput.parse({...input,text:'la mesa — стол\nстрока без перевода'}))));assert.deepEqual(store.read(),before);assert.equal(paymentBalance(store.read()).remaining,4);
  const result=store.mutate(state=>addLessonWord(state,lessonWordInput.parse(input)));assert.equal(result.lessonId,'scheduled');assert.equal(paymentBalance(store.read()).remaining,3);
  const lesson=store.read().lessons[0];assert.equal(lesson.status,'held');assert.equal(lesson.title,'Наш урок');assert.equal(lesson.note,'Сохранить заметку');
  for(let retry=0;retry<2;retry++)store.mutate(state=>addLessonWords(state,lessonWordsInput.parse({...input,lessonId:undefined,text:'la ventana — окно\nla puerta — дверь'})));
  assert.equal(store.read().lessons.length,1);assert.equal(paymentBalance(store.read()).used,1);assert.equal(paymentBalance(store.read()).remaining,3);
  store.mutate(state=>{state.lessons[0].status='cancelled';});assert.equal(paymentBalance(store.read()).remaining,4);
  store.mutate(state=>addLessonWord(state,lessonWordInput.parse(input)));assert.equal(paymentBalance(store.read()).remaining,3);assert.equal(store.read().lessons.length,1);
  store.mutate(state=>addLessonWords(state,lessonWordsInput.parse({...input,date:'2026-11-21',lessonId:undefined,text:'la ventana — окно\nla puerta — дверь'})));
  assert.equal(store.read().lessons.length,2);assert.equal(paymentBalance(store.read()).remaining,2);
 }finally{store.close();rmSync(dir,{recursive:true});}
});

test('dated lesson vocabulary reuses the same automation cards, preserves progress and persists atomically',()=>{
  const dir=mkdtempSync(join(tmpdir(),'es-words-'));let store=new Store(dir);
  const add=(text:string,date='2026-11-17',lessonId?:string)=>store.mutate(state=>addLessonWord(state,lessonWordInput.parse({text,date,lessonId,topic:'Город',title:'В городе'})));
  try{
    const first=add('el semáforo — светофор'),another=add('cruzar — переходить');
    assert.equal(first.lessonId,another.lessonId);assert.equal(first.created,true);
    const lesson=store.read().lessons.find(item=>item.id===first.lessonId)!;
    assert.equal(lesson.date,'2026-11-17');assert.equal(lesson.title,'В городе');assert.equal(lesson.status,'held');
    assert.deepEqual(lesson.cardIds,[first.cardId,another.cardId]);
    store.mutate(state=>{const card=state.cards.find(item=>item.id===first.cardId)!;Object.assign(card,{seen:7,correct:6,stage:4,due:'2026-11-30T12:00:00Z',focused:true});});
    const before=structuredClone(store.read().cards.find(item=>item.id===first.cardId));
    const reused=add(' EL SEMÁFORO — другое значение','2026-11-19');
    assert.equal(reused.cardId,first.cardId);assert.equal(reused.created,false);assert.equal(reused.translationKept,true);
    assert.deepEqual(store.read().cards.find(item=>item.id===first.cardId),before);
    add('el semáforo — светофор','2026-11-19');
    assert.deepEqual(store.read().lessons.find(item=>item.id===reused.lessonId)?.cardIds,[first.cardId]);
    const prior=store.read();assert.throws(()=>add('неправильная строка','2026-12-01'));assert.deepEqual(store.read(),prior);
    assert.throws(()=>add('nuevo — новый','2026-11-18',first.lessonId));assert.deepEqual(store.read(),prior);
    assert.throws(()=>add('nuevo — новый','2026-11-18','missing'));assert.deepEqual(store.read(),prior);
    store.close();store=new Store(dir);const state=store.read();
    assert.deepEqual(lessonCards(state.cards,state.lessons.find(item=>item.id===first.lessonId)).map(card=>card.id),[first.cardId,another.cardId]);
    assert.equal(lessonCards(state.cards,state.lessons.find(item=>item.id===reused.lessonId))[0].stage,4);
    assert.equal(state.lessons.filter(item=>item.status==='held').length,2,'Vocabulary counts each dated lesson once, including reused words');
  }finally{store.close();rmSync(dir,{recursive:true});}
});

test('teacher records words in one student space; the student reads and reviews them but cannot edit the record or access another student',async()=>{
  const saved=process.env.TEACHER_ACCESS_CODE;process.env.TEACHER_ACCESS_CODE='teacher-only-lesson-words-code';
  const dir=mkdtempSync(join(tmpdir(),'es-words-http-')),store=new Store(dir);
  const a=store.createStudent('Слова ученика А','A1'),b=store.createStudent('Слова ученика Б','A2');
  const server=createApp(store).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api';
  const request=async(path:string,cookie='',body?:unknown,method?:string,studentId?:string)=>{
    const headers:Record<string,string>={cookie};if(body!==undefined)headers['content-type']='application/json';if(studentId)headers['x-student-id']=studentId;
    const result=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:result.status,body:await result.json(),cookie:result.headers.get('set-cookie')?.split(';')[0]||''};
  };
  try{
    const owner=(await request('/login','',{code:process.env.TEACHER_ACCESS_CODE})).cookie,learner=(await request('/login','',{code:a.code})).cookie;
    const input={text:'la pizarra — доска',date:'2026-11-17',title:'На уроке',topic:'Занятия'};
    assert.equal((await request('/lesson-words','',input)).status,401);
    const result=await request('/lesson-words',owner,input,'POST',a.student.id);assert.equal(result.status,200);
    const {cardId,lessonId}=result.body;
    const own=(await request('/state',learner)).body.state;assert.equal(own.cards[0].id,cardId);assert.deepEqual(own.lessons[0].cardIds,[cardId]);assert.equal(own.lessons[0].status,'held');
    assert.equal((await request('/lesson-words',learner,input)).status,403);
    assert.equal((await request('/lessons/'+lessonId+'/words/'+cardId,learner,undefined,'DELETE')).status,403);
    assert.equal((await request('/state',learner,undefined,'GET',b.student.id)).status,403);
    assert.equal((await request('/state',owner,undefined,'GET',b.student.id)).body.state.cards.length,0);
    assert.equal((await request('/review',learner,{cardId,answer:'доска',seconds:7})).body.correct,true);
    assert.equal((await request('/state',learner)).body.state.cards[0].seen,1);
    await request('/cards/'+cardId,owner,{ru:'классная доска'},'PATCH',a.student.id);
    const updated=(await request('/state',learner)).body.state;assert.equal(lessonCards(updated.cards,updated.lessons[0])[0].ru,'классная доска');
    assert.equal((await request('/lesson-words',owner,{...input,date:'invalid'},'POST',a.student.id)).status,400);
    assert.equal((await request('/lessons/'+lessonId+'/words/'+cardId,owner,undefined,'DELETE',a.student.id)).status,200);
    const unlinked=(await request('/state',learner)).body.state;assert.deepEqual(unlinked.lessons[0].cardIds,[]);assert.equal(unlinked.cards[0].seen,1,'Removing a lesson link must retain the card and progress');
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();rmSync(dir,{recursive:true});if(saved===undefined)delete process.env.TEACHER_ACCESS_CODE;else process.env.TEACHER_ACCESS_CODE=saved;}
});

test('a whole lesson list saves atomically, reuses cards and preserves their review history',async()=>{
 const {addLessonWords,lessonWordsInput}=await import('../server/lesson-words.js');
 const dir=mkdtempSync(join(tmpdir(),'es-lesson-list-')),store=new Store(dir);
 try{
  const existing=store.read().cards[0],before=structuredClone(existing);
  const result=store.mutate(state=>addLessonWords(state,lessonWordsInput.parse({date:'2026-11-18',text:'el cuaderno — тетрадь\nla pizarra — доска\nel cuaderno — тетрадь\n'+existing.es+' — '+existing.ru})));
  assert.equal(result.added,2);assert.equal(result.reused,2);
  assert.equal(store.read().lessons.find(lesson=>lesson.id===result.lessonId)?.cardIds?.length,3);
  assert.deepEqual(store.read().cards.find(card=>card.id===existing.id),before);
  const saved=store.read();assert.throws(()=>store.mutate(state=>addLessonWords(state,lessonWordsInput.parse({date:'2026-11-19',text:'la mesa — стол\nстрока без перевода'}))));assert.deepEqual(store.read(),saved);
 }finally{store.close();rmSync(dir,{recursive:true});}
});
