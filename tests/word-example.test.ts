import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordExample} from '../server/word-example.js';
import {initialState} from '../server/domain.js';
test('AI example requests include the current learner level and preserve the word meaning',async()=>{
 const card=initialState().cards[0],before=JSON.stringify(card);
 for(const level of ['A1','B2']){
  const example=await wordExample(card,level,async(system,input)=>{assert.ok(system.includes('Уровень ученика: '+level));assert.ok(system.includes('не выше'));const data=JSON.parse(input as string);assert.equal(data.es,card.es);assert.equal(data.ru,card.ru);return JSON.stringify({es:'Un ejemplo.',ru:'Пример.'});});
  assert.equal(example.level,level);assert.equal(example.ru,'Пример.');
 }
 assert.equal(JSON.stringify(card),before);
 await assert.rejects(()=>wordExample(card,'A1',async()=>'{}'));
});
