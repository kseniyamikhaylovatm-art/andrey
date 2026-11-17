import {test} from 'node:test';
import assert from 'node:assert/strict';
import {miroBoardId,miroText,readMiroBoard} from '../server/miro.js';
test('Miro accepts board links but never uses arbitrary URLs as API destinations',async()=>{
 assert.equal(miroBoardId('https://miro.com/app/board/uXtest%3D/'),'uXtest=');assert.throws(()=>miroBoardId('https://other.invalid/app/board/test/'));
 assert.throws(()=>miroBoardId('http://miro.com/app/board/test/'));await assert.rejects(()=>readMiroBoard('https://miro.com/app/board/test/',''),/MIRO_ACCESS_TOKEN/);
});
test('Miro reads paginated text, reports nontext objects and strips markup without discarding later pages',async()=>{
 let count=0;const result=await readMiroBoard('https://miro.com/app/board/test/','fixture-token',async address=>{assert.ok(address.startsWith('https://api.miro.com/v2/boards/test/items?'));count++;return {ok:true,status:200,json:async()=>count===1?{data:[{data:{content:'<p>cuidar &amp; ayudar</p>'}},{data:{url:'image'}}],cursor:'next token'}:{data:[{data:{title:'Casa',description:'<p>el comedor — столовая</p>'}}]}};});
 assert.equal(count,2);assert.match(result.text,/cuidar & ayudar/);assert.match(result.text,/el comedor/);assert.equal(result.items,3);assert.equal(result.skipped,1);assert.ok(!JSON.stringify(result).includes('fixture-token'));assert.equal(miroText('&#241; &nbsp; hola'),'ñ   hola');
});
test('Miro permission errors remain explicit and never return partial text',async()=>{
 await assert.rejects(()=>readMiroBoard('https://miro.com/app/board/test/','fixture-token',async()=>({ok:false,status:403,json:async()=>({})})),/не разрешил доступ/);
});
