import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translateWord} from '../server/translate-word.js';
import {initialState} from '../server/domain.js';
test('translation keeps the original Spanish input, validates AI output and never saves prematurely',async()=>{
 const state=initialState(),before=JSON.stringify(state);let calls=0;
 const result=await translateWord(state,'el cuaderno',async(_system,input)=>{calls++;assert.equal(input,'el cuaderno');return '{"ru":"тетрадь"}';});
 assert.deepEqual(result,{es:'el cuaderno',ru:'тетрадь',source:'ai'});assert.equal(calls,1);assert.equal(JSON.stringify(state),before);
 await assert.rejects(()=>translateWord(state,'el cuaderno',async()=>'{}'));
 await assert.rejects(()=>translateWord(state,'el cuaderno',async()=>'{"ru":""}'));
});
test('a saved vocabulary translation is reused without an AI call or progress changes',async()=>{
 const state=initialState(),card=state.cards[0],before=JSON.stringify(card);
 const result=await translateWord(state,card.es.toUpperCase(),async()=>{throw new Error('No paid request should occur');});
 assert.equal(result.ru,card.ru);assert.equal(result.source,'saved');assert.equal(JSON.stringify(card),before);
});
