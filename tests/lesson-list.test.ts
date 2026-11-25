import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lessonList} from '../src/lesson-list.js';
test('lesson lists accept pairs and Spanish-only lines, retain compound words and reject malformed rows before saving',()=>{
 const result=lessonList('• el comedor — столовая\r\n\n2. la cocina\nno-sé-qué');assert.equal(result.length,3);assert.equal(result[0].ru,'столовая');assert.equal(result[1].es,'la cocina');assert.equal(result[2].es,'no-sé-qué');
 assert.throws(()=>lessonList('el comedor — столовая\nla cocina —'),/строку 2/);
 assert.equal(lessonList(Array(101).fill('hola — привет').join('\n')).length,101);assert.throws(()=>lessonList('  '));
});

test('blank-separated words with examples are counted as entries and keep translations',()=>{
 const blocks=Array.from({length:58},(_,i)=>'el barrio — район\nVivo en este barrio.\nЯ живу в этом районе: '+i);
 const rows=lessonList(blocks.join('\n\n'));
 assert.equal(rows.length,58);
 assert.deepEqual(rows[57].example,{es:'Vivo en este barrio.',ru:'Я живу в этом районе: 57'});
 assert.deepEqual(lessonList('la edad — возраст — это число\nLa edad es un número.')[0].example,{es:'La edad es un número.',ru:''});
 assert.equal(lessonList('hola — привет\nla cocina')[1].es,'la cocina');
});

test('reads a large list with topic headings, inline records and examples on separate lines',()=>{
 const entries=Array.from({length:150},(_,i)=>`palabra ${i} — слово ${i} | Esta es la palabra ${i}. | Это слово ${i}.`);
 const rows=lessonList(['# Словарь',...entries,'','Тема: Дом','la cocina — кухня','Estoy en la cocina.','Я на кухне.','','Город','la plaza — площадь'].join('\n'));
 assert.equal(rows.length,152);
 assert.equal(rows[149].topic,'Словарь');
 assert.deepEqual(rows[150].example,{es:'Estoy en la cocina.',ru:'Я на кухне.'});
 assert.equal(rows[150].topic,'Дом');
 assert.equal(rows[151].topic,'Город');
});
