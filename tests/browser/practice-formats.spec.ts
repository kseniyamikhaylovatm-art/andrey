import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3101'});
async function pupil(page:Page){
 await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});
 const created=await (await page.request.post('/api/students',{data:{name:'Форматы · '+Date.now(),level:'A1'}})).json();
 const studentId=created.student.id,headers={'X-Student-Id':studentId};
 const added=await page.request.post('/api/lesson-words/batch',{headers,data:{date:'2026-11-17',text:'la casa — дом\nel colegio — школа\nel mercado — рынок\nel billete — билет',topic:'Первые слова'}});expect(added.ok()).toBe(true);
 const state=(await (await page.request.get('/api/state',{headers})).json()).state;
 await page.request.patch('/api/cards/'+state.cards[0].id,{headers,data:{imageUrl:'https://fixture.invalid/picture.svg'}});
 await page.route('https://fixture.invalid/picture.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect width="100" height="80" fill="#e4c98f"/></svg>'}));
 await page.request.post('/api/login',{data:{code:created.code}});await page.addInitScript(id=>sessionStorage.setItem('mi:selected-student',id),studentId);
 await page.addInitScript(()=>{const audit={tones:[] as number[],spoken:[] as string[]};(window as unknown as {choiceAudit:typeof audit}).choiceAudit=audit;
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:()=>{},speak:(utterance:SpeechSynthesisUtterance)=>audit.spoken.push(utterance.text)}});
 const create=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const oscillator=create.call(this),set=oscillator.frequency.setValueAtTime.bind(oscillator.frequency);oscillator.frequency.setValueAtTime=(value,time)=>{audit.tones.push(value);return set(value,time);};return oscillator;};});
 return state.cards as {id:string;es:string;ru:string;stage:number;seen:number}[];
}
const tones=(page:Page)=>page.evaluate(()=>(window as unknown as {choiceAudit:{tones:number[]}}).choiceAudit.tones);
test('format tiles open illustrated choices, honest recall and Lingva with the same student vocabulary',async({page})=>{
 const cards=await pupil(page);await page.setViewportSize({width:1440,height:1100});await page.goto('/#cards');
 await expect(page.locator('.practice-format-card')).toHaveCount(3);await expect(page.locator('.segmented')).toHaveCount(0);await expect(page.getByRole('combobox',{name:'Слова какого урока'})).toHaveCount(0);
 await page.screenshot({path:'test-results/practice-formats-desktop.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Слова в контексте',exact:true}).click();await page.getByRole('combobox',{name:'Как тренировать'}).selectOption('choice');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
 await expect(page.locator('.picture-choice')).toHaveCount(4);await expect(page.locator('.choice-illustration')).toHaveCount(4);await expect(page.locator('.choice-illustration img')).toHaveCount(1);
 const first=await page.locator('.flashcard-word h2').innerText(),wrong=cards.find(c=>c.es!==first)!;
 await page.locator('.picture-choice').filter({hasText:wrong.ru}).click();await expect(page.locator('.answer-feedback')).toContainText('10 минут');await expect.poll(()=>tones(page)).toEqual([220,164.81]);
 const afterWrong=(await (await page.request.get('/api/state')).json()).state.cards.find((c:{es:string})=>c.es===first);expect(afterWrong.stage).toBe(0);expect(afterWrong.seen).toBe(1);
 await page.getByRole('button',{name:'Следующая фраза',exact:false}).click();const second=await page.locator('.flashcard-word h2').innerText(),right=cards.find(c=>c.es===second)!;
 await page.locator('.picture-choice').filter({hasText:right.ru}).click();await expect(page.locator('.answer-feedback')).toContainText('Поздравляем');await expect.poll(()=>tones(page)).toEqual([220,164.81,659.25,880]);
 await page.screenshot({path:'test-results/illustrated-choices-desktop.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Все форматы',exact:true}).click();await page.getByRole('button',{name:'Карточки памяти',exact:true}).click();await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
 await expect(page.locator('.tense-context')).toHaveCount(0);await expect(page.locator('.picture-choice')).toHaveCount(0);
 await page.getByRole('button',{name:'Подсказка',exact:true}).click();await page.getByRole('button',{name:'Вспомнил',exact:true}).click();await expect(page.locator('.answer-feedback')).toContainText('Поздравляем');await expect(page.locator('.tense-context')).toHaveCount(0);
 await page.getByRole('button',{name:'Все форматы',exact:true}).click();await page.getByRole('button',{name:'Ксюша Лингва',exact:true}).click();await expect(page.getByRole('button',{name:'Начать 13 заданий',exact:true})).toBeVisible();
});
test('Russian to Spanish choices show real Spanish labels and stay usable on a phone',async({page})=>{
 const cards=await pupil(page);await page.setViewportSize({width:390,height:844});await page.goto('/#cards');
 await expect(page.locator('.practice-format-card')).toHaveCount(3);const tile=await page.locator('.practice-format-card').first().boundingBox();expect(Math.abs(tile!.width-tile!.height)).toBeLessThan(2);
 await page.screenshot({path:'test-results/practice-formats-mobile.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Слова в контексте',exact:true}).click();await page.getByRole('combobox',{name:'Как тренировать'}).selectOption('choice');await page.getByRole('combobox',{name:'Направление перевода'}).selectOption('ru-es');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
 const prompt=await page.locator('.flashcard-word h2').innerText(),card=cards.find(c=>c.ru===prompt)!;expect(card).toBeTruthy();await expect(page.locator('.picture-choice')).toHaveCount(4);
 for(const item of cards)await expect(page.locator('.picture-choice-label').filter({hasText:item.es})).toBeVisible();
 await page.locator('.picture-choice').filter({hasText:card.es}).click();await expect(page.locator('.answer-feedback')).toContainText('Поздравляем');await expect(page.locator('.choice-expected')).toContainText(card.es);
 const state=(await (await page.request.get('/api/state')).json()).state;expect(state.cards.find((c:{id:string})=>c.id===card.id).stage).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/illustrated-choices-mobile.png',fullPage:true,animations:'disabled'});
});
