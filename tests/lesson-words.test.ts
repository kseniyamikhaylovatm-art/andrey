import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
import {addLessonWord,lessonWordInput} from '../server/lesson-words.js';
import {lessonCards} from '../src/lesson-vocabulary.js';

test('dated lesson vocabulary reuses the same automation cards, preserves progress and persists atomically',()=>{
  const dir=mkdtempSync(join(tmpdir(),'es-words-'));let store=new Store(dir);
  const add=(text:string,date='2026-11-17',lessonId?:string)=>store.mutate(state=>addLessonWord(state,lessonWordInput.parse({text,date,lessonId,topic:'Город',title:'В городе'})));
  try{
    const first=add('el semáforo — светофор'),another=add('cruzar — переходить');
    assert.equal(first.lessonId,another.lessonId);assert.equal(first.created,true);
    const lesson=store.read().lessons.find(item=>item.id===first.lessonId)!;
    assert.equal(lesson.date,'2026-11-17');assert.equal(lesson.title,'В городе');assert.equal(lesson.status,'planned');
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
    assert.equal(state.lessons.filter(item=>item.status==='held').length,0,'Recording words must not charge a lesson');
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
    const own=(await request('/state',learner)).body.state;assert.equal(own.cards[0].id,cardId);assert.deepEqual(own.lessons[0].cardIds,[cardId]);
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
