import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LingvaSessions,exercises,answerKey} from '../server/lingva.js';
import {initialState} from '../server/domain.js';
test('Lingva uses 13 varied exercises from enabled vocabulary and repeats errors after the initial round',()=>{
 const state=initialState();const sample=exercises(state.cards);assert.equal(sample.length,13);assert.ok(new Set(sample.map(t=>t.kind)).size>=4);
 state.cards=[{...state.cards[0],es:'hola',ru:'привет',examples:[]}];
 const sessions=new LingvaSessions(),start=sessions.start('one',state);assert.ok(!('expected' in start.task));
 assert.throws(()=>sessions.answer('other',start.id,0,'hola',false));
 const wrong=sessions.answer('one',start.id,0,'adiós',false);assert.equal(wrong.correct,false);assert.equal(wrong.index,1);
 assert.deepEqual(sessions.answer('one',start.id,0,'hola',false),wrong,'Retry must not advance twice');
 let step=wrong;for(let i=1;i<13;i++)step=sessions.answer('one',start.id,i,'hola',false);
 assert.equal(step.repeat,true);assert.ok(step.task);assert.equal(step.initialCorrect,12);
 step=sessions.answer('one',start.id,13,'hola',false);assert.equal(step.task,null);assert.equal(step.mistakes,1);
 assert.notEqual(answerKey('sí'),answerKey('si'));assert.equal(answerKey('¡Hola!'),'hola');
});
test('Lingva respects topic and lesson membership and rejects an empty selection',()=>{
 const state=initialState();state.lessons=[{id:'lesson',date:'2026-11-17',title:'Lesson',note:'',status:'planned',cardIds:[state.cards[0].id]}];
 const sessions=new LingvaSessions();assert.equal(sessions.start('one',state,undefined,'lesson').task.cardId,state.cards[0].id);
 assert.throws(()=>sessions.start('one',state,'missing'));assert.throws(()=>sessions.start('one',state,undefined,'missing'));
});
