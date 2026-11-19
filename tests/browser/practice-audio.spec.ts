import {test,expect,type Page} from './fixtures';

/** Headless Chromium has no installed TTS engine; retain real Web Audio playback. */
async function observeAudio(page:Page){
  await page.addInitScript(()=>{
    const audit={spoken:[] as {text:string;lang:string;rate:number}[],cancelled:0,tones:[] as {frequency:number;type:string;state:string}[]};
    (window as unknown as {audioAudit:typeof audit}).audioAudit=audit;
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices:()=>[],cancel:()=>{audit.cancelled++;},
      speak:(utterance:SpeechSynthesisUtterance)=>audit.spoken.push({text:utterance.text,lang:utterance.lang,rate:utterance.rate}),
    }});
    const create=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){
      const context=this,oscillator=create.call(this),setFrequency=oscillator.frequency.setValueAtTime.bind(oscillator.frequency),start=oscillator.start.bind(oscillator);
      let frequency=oscillator.frequency.value;
      oscillator.frequency.setValueAtTime=(value,time)=>{frequency=value;return setFrequency(value,time);};
      oscillator.start=(time=0)=>{audit.tones.push({frequency,type:oscillator.type,state:context.state});start(time);};
      return oscillator;
    };
  });
}
const audit=(page:Page)=>page.evaluate(()=>(window as unknown as {audioAudit:{spoken:{text:string;lang:string;rate:number}[];cancelled:number;tones:{frequency:number;type:string;state:string}[]}}).audioAudit);

const hint=(page:Page)=>page.getByRole('button',{name:'Подсказка',exact:true}).click();
const grade=(page:Page,correct=true)=>page.getByRole('button',{name:correct?'Вспомнил':'Не вспомнил',exact:true}).click();
test('recall stays silent until hint, grades schedule SRS, and a known word reads its saved example after the signal',async({page})=>{
 await observeAudio(page);await page.setViewportSize({width:1440,height:1100});await page.goto('/#cards?view=train');
 await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
 const first=await page.locator('.flashcard-word h2').innerText();
 expect((await audit(page)).spoken).toHaveLength(0);await expect(page.locator('.recall-translation')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Вспомнил',exact:true})).toHaveCount(0);
 const before=(await (await page.request.get('/api/state')).json()).state;const card=before.cards.find((c:{es:string})=>c.es===first);
 await hint(page);await expect(page.locator('.recall-translation')).toHaveText(card.ru);
 expect((await audit(page)).spoken.map(s=>s.text)).toEqual([first]);
 expect((await audit(page)).spoken[0].lang).toBe('es-ES');
 expect((await audit(page)).tones).toHaveLength(0);
 await grade(page);await expect(page.locator('.answer-feedback')).toContainText('Поздравляем');
 await expect.poll(async()=>(await audit(page)).tones.length).toBe(2);
 expect((await audit(page)).tones.map(t=>t.frequency)).toEqual([659.25,880]);
 await expect.poll(async()=>(await audit(page)).spoken.at(-1)?.text).toBe(card.examples[0].es);
 const state=(await (await page.request.get('/api/state')).json()).state;const updated=state.cards.find((c:{id:string})=>c.id===card.id);
 expect(updated.stage).toBe(card.stage+1);expect(Date.parse(updated.due)-Date.now()).toBeGreaterThan(23*3600000);
 await page.getByRole('button',{name:'Следующая фраза',exact:false}).click();
 const spoken=(await audit(page)).spoken.length;await page.waitForTimeout(550);expect((await audit(page)).spoken).toHaveLength(spoken);
 const second=await page.locator('.flashcard-word h2').innerText();const secondCard=state.cards.find((card:{es:string})=>card.es===second);
 await expect(page.locator('.picture-choice')).toHaveCount(4);const wrong=page.locator('.picture-choice').filter({hasNotText:secondCard.ru}).first();await wrong.click();
 await expect(page.locator('.answer-feedback')).toContainText('Попробуйте ещё раз');await expect.poll(async()=>(await audit(page)).tones.length).toBe(4);
 expect((await audit(page)).tones.slice(2).map(t=>t.frequency)).toEqual([220,164.81]);await expect(page.getByRole('button',{name:'Следующая фраза',exact:false})).toHaveCount(0);
 const afterWrong=(await (await page.request.get('/api/state')).json()).state.cards.find((c:{id:string})=>c.id===secondCard.id);const due=afterWrong.due;
 await page.locator('.picture-choice').filter({hasText:secondCard.ru}).click();await expect(page.locator('.answer-feedback')).toContainText('Теперь верно');await expect.poll(async()=>(await audit(page)).tones.length).toBe(6);
 const corrected=(await (await page.request.get('/api/state')).json()).state.cards.find((c:{id:string})=>c.id===secondCard.id);expect(corrected.stage).toBe(0);expect(corrected.due).toBe(due);
 await page.getByRole('switch',{name:'Звуки ответов'}).click();await page.getByRole('switch',{name:'Автоозвучка слов'}).click();await page.getByRole('button',{name:'Следующая фраза',exact:false}).click();
 await expect(page.locator('.flashcard-word h2')).toHaveAttribute('lang','ru');const count=(await audit(page)).spoken.length,prompt=await page.locator('.flashcard-word h2').innerText(),third=state.cards.find((c:{ru:string})=>c.ru===prompt);
 await page.locator('.picture-choice').filter({hasText:third.es}).click();await expect(page.locator('.answer-feedback')).toContainText('Поздравляем');await page.waitForTimeout(650);
 expect((await audit(page)).spoken).toHaveLength(count);expect((await audit(page)).tones).toHaveLength(6);
 await page.locator('.flashcard-word').getByRole('button',{name:'Озвучить медленно',exact:true}).click();expect((await audit(page)).spoken.at(-1)?.rate).toBeCloseTo(0.65);
 await page.reload();await expect(page.getByRole('switch',{name:'Автоозвучка слов'})).not.toBeChecked();await expect(page.getByRole('switch',{name:'Звуки ответов'})).not.toBeChecked();
});
test('a failed self-review request produces no signal or example and lets the learner retry',async({page})=>{
 await observeAudio(page);await page.goto('/#cards?view=train');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();await hint(page);
 await page.route('**/api/practice/answer',route=>route.fulfill({status:503,json:{error:'Сохранение временно недоступно'}}));await grade(page);
 await expect(page.getByRole('status').filter({hasText:'Сохранение временно недоступно'})).toBeVisible();expect((await audit(page)).tones).toHaveLength(0);
 await expect(page.getByRole('button',{name:'Вспомнил',exact:true})).toBeEnabled();await page.unroute('**/api/practice/answer');await grade(page);
 await expect(page.locator('.answer-feedback')).toContainText('Поздравляем');await expect.poll(async()=>(await audit(page)).tones.length).toBe(2);
});
test('a new question cancels the pending example and mobile recall controls stay readable',async({page})=>{
 await observeAudio(page);await page.setViewportSize({width:390,height:844});await page.goto('/#cards?view=train');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
 await hint(page);const button=page.getByRole('button',{name:'Вспомнил',exact:true});expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
 expect(await page.locator('.flashcard-word h2').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(40);
 await grade(page);await expect(page.locator('.answer-feedback')).toBeVisible();await page.getByRole('button',{name:'Следующая фраза',exact:false}).click();
 const spoken=(await audit(page)).spoken.length;await page.waitForTimeout(650);expect((await audit(page)).spoken).toHaveLength(spoken);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/recall-mobile.png',fullPage:true,animations:'disabled'});
});
