import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lessonList} from '../src/lesson-list.js';
test('lesson lists accept pairs and Spanish-only lines, retain compound words and reject malformed rows before saving',()=>{
 const result=lessonList('• el comedor — столовая\r\n\n2. la cocina\nno-sé-qué');assert.equal(result.length,3);assert.equal(result[0].ru,'столовая');assert.equal(result[1].es,'la cocina');assert.equal(result[2].es,'no-sé-qué');
 assert.throws(()=>lessonList('el comedor — столовая\nla cocina —'),/строку 2/);
 assert.throws(()=>lessonList(Array(101).fill('hola — привет').join('\n')),/100/);assert.throws(()=>lessonList('  '));
});
