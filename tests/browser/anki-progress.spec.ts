import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3101'});
async function learner(page:Page){
 await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});const created=await (await page.request.post('/api/students',{data:{name:'Анки прогресс '+Date.now(),level:'A1'}})).json();const headers={'X-Student-Id':created.student.id};
 await page.request.post('/api/lesson-words/batch',{headers,data:{date:'2026-11-18',text:'la casa — дом\nel pan — хлеб\nel coche — машина\nel gato — кот',topic:'Тест Анки'}});
 await page.request.post('/api/login',{data:{code:created.code}});await page.addInitScript(id=>sessionStorage.setItem('mi:selected-student',id),created.student.id);
 await page.addInitScript(()=>{(window as unknown as {spoken:string[]}).spoken=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:()=>{},speak:(u:SpeechSynthesisUtterance)=>(window as unknown as {spoken:string[]}).spoken.push(u.text)}});});return created;
}
test('Anki reveals Russian grades, advances silently to each next word and saves distinct intervals and a cabinet summary',async({page})=>{
 const student=await learner(page);await page.setViewportSize({width:1440,height:1100});await page.goto('/#cards?view=memory');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
 const grades=['Ещё раз','Трудно','Хорошо','Легко'],delays=[60000,360000,600000,345600000];
 for(let i=0;i<4;i++){
  await expect(page.locator('.anki-card .section-heading .muted')).toHaveText((i+1)+' / 4');await expect(page.locator('.anki-rating')).toHaveCount(0);expect(await page.evaluate(()=>(window as unknown as {spoken:string[]}).spoken.length)).toBe(i);
  const word=await page.locator('.flashcard-word h2').innerText();await page.getByRole('button',{name:'Показать ответ',exact:true}).click();await expect(page.locator('.recall-translation')).not.toBeEmpty();await expect(page.locator('.anki-rating')).toHaveCount(4);await expect(page.locator('.anki-rating').nth(0)).toContainText('1 мин');await expect(page.locator('.anki-rating').nth(3)).toContainText('4 дн.');
  if(i===0)await page.screenshot({path:'test-results/anki-grades-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:new RegExp('^'+grades[i])}).click();await expect(page.locator('.anki-saved')).toContainText(grades[i]);const state=(await (await page.request.get('/api/state')).json()).state,card=state.cards.find((c:{es:string})=>c.es===word);expect(Math.abs(Date.parse(card.due)-Date.now()-delays[i])).toBeLessThan(10000);
 }
 await expect(page.getByRole('heading',{name:'Практика сохранена',exact:true})).toBeVisible();const saved=(await (await page.request.get('/api/state')).json()).state;expect(saved.attempts).toHaveLength(4);expect(saved.attempts.reduce((sum:number,a:{xp:number})=>sum+a.xp,0)).toBe(40);expect(saved.practiceSessions[0].finishedAt).toBeTruthy();
 await page.getByRole('button',{name:'Результаты в кабинете',exact:false}).click();const panel=page.getByRole('region',{name:'Формат Анки'});await expect(panel).toContainText('40 XP');await expect(panel.locator('dl>div').filter({hasText:'Слов в практике'}).locator('dd')).toHaveText('4');await expect(panel.locator('dl>div').filter({hasText:'Ещё сложно'}).locator('dd')).toHaveText('2');await expect(panel.locator('dl>div').filter({hasText:'Сессий завершено'}).locator('dd')).toHaveText('1');await page.screenshot({path:'test-results/practice-progress-desktop.png',fullPage:true,animations:'disabled'});
 await page.reload();await expect(panel).toContainText('40 XP');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/practice-progress-mobile.png',fullPage:true,animations:'disabled'});
 // The teacher sees the same selected student's statistics; a new student starts empty.
 await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});await page.reload();await expect(panel).toContainText('40 XP');const other=await (await page.request.post('/api/students',{data:{name:'Другой ученик',level:'A1'}})).json();const empty=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':other.student.id}})).json()).state;expect(empty.attempts).toHaveLength(0);expect(empty.practiceSessions||[]).toHaveLength(0);
 await page.request.post('/api/login',{data:{code:other.code}});const denied=await page.request.post('/api/anki/answer',{data:{id:saved.practiceSessions[0].id,index:0,rating:'easy',seconds:1}});expect(denied.status()).toBe(404);
 expect(student.student.id).not.toBe(other.student.id);
});
test('four Russian grade buttons remain usable on a phone',async({page})=>{
 await learner(page);await page.setViewportSize({width:390,height:844});await page.goto('/#cards?view=memory');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();await page.getByRole('button',{name:'Показать ответ',exact:true}).click();await expect(page.locator('.anki-rating')).toHaveCount(4);for(const button of await page.locator('.anki-rating').all()){const box=await button.boundingBox();expect(box!.width).toBeGreaterThan(80);expect(box!.height).toBeGreaterThanOrEqual(44);}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/anki-grades-mobile.png',fullPage:true,animations:'disabled'});
});
