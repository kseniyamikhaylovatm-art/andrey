import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardContext} from '../server/card-context.js';
import {conjugate,initialState,knownVerbs} from '../server/domain.js';
import {exampleTenseNames,type Card} from '../src/types.js';
import {exampleTense} from '../src/example-tenses.js';

function card(es:string):Card{return {...initialState().cards[0],es,ru:'Перевод',examples:[]};}

test('all 24 starter cards and supported verbs have examples for all six tabs without AI',()=>{
  const starter=initialState().cards;
  for(const item of [...starter,...knownVerbs.map(card)]){
    const context=cardContext(item);
    assert.equal(context.examples.length,6,item.es);
    assert.deepEqual(context.examples.map(e=>e.tense),Object.keys(exampleTenseNames),item.es);
    assert.ok(context.examples.every(e=>e.es.trim()&&e.ru.trim()),item.es);
  }
});
test('future forms use ir a, preserve reflexives and handle the accented actuar family',()=>{
  assert.deepEqual(conjugate('escaparse','futuro_proximo'),['me voy a escapar','te vas a escapar','se va a escapar','nos vamos a escapar','os vais a escapar','se van a escapar']);
  const acting=cardContext(card('actuar'));
  assert.deepEqual(acting.forms.presente,['actúo','actúas','actúa','actuamos','actuáis','actúan']);
  assert.equal(acting.examples.find(e=>e.tense==='futuro_proximo')?.es,'Mañana voy a actuar con calma.');
  assert.equal(acting.examples.find(e=>e.tense==='gerundio_presente')?.es,'Ahora estoy actuando con calma.');
  assert.equal(cardContext(card('decir')).forms.perfecto?.[0],'he dicho');
  assert.equal(cardContext(card('llegar')).forms.indefinido?.[0],'llegué');
});
test('nouns have contextual examples without conjugating the noun; estar avoids unnatural progressive forms',()=>{
  const noun=cardContext(card('el barrio'));
  assert.equal(noun.verb,null);assert.deepEqual(noun.forms,{});
  assert.match(noun.examples.find(e=>e.tense==='indefinido')!.es,/Ayer paseé por el barrio/);
  const estar=cardContext(card('estar a punto de'));
  assert.equal(estar.forms.gerundio_presente,undefined);
  assert.ok(estar.formNotes.gerundio_presente);
  assert.match(estar.examples.find(e=>e.tense==='gerundio_presente')!.es,/Estoy preparando/);
});
test('lesson labels and teacher examples override the library without discarding untagged source examples',()=>{
  const item=card('contar');item.examples=[{es:'Conté una historia.',ru:'Я рассказал историю.',tense:'Pretérito Indefinido'},{es:'Otro contexto.',ru:'Другой контекст.'}];
  const context=cardContext(item,{contar:{presente:['cuento','cuentas','cuenta','contamos','contáis','cuentan']}});
  assert.equal(context.examples.find(e=>e.tense==='indefinido')?.es,'Conté una historia.');
  assert.equal(context.examples.find(e=>e.tense==='indefinido')?.origin,'card');
  assert.deepEqual(context.originalExamples,[item.examples[1]]);
  assert.equal(exampleTense('Pretérito perfecto compuesto'),'perfecto');
  assert.equal(exampleTense('Pluscuamperfecto'),null);
  assert.equal(exampleTense('__proto__'),null);
});
test('unknown imported words stay editable and never receive invented examples or forms',()=>{
  for(const term of ['un término nuevo','constructor','__proto__']){
    const context=cardContext(card(term));assert.deepEqual(context.examples,[]);assert.deepEqual(context.forms,{});
  }
});
