import {test,expect,type Page} from '@playwright/test';

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
async function cardAnswer(page:Page){
  const word=await page.locator('.flashcard-word h2').innerText();
  const {state}=await (await page.request.get('/api/state')).json();
  return state.cards.find((c:{es:string})=>c.es===word).ru as string;
}
const choose=(page:Page,answer:string)=>page.getByRole('button',{name:answer,exact:false}).filter({has:page.locator('.option-letter')}).click();

test('new cards speak once, verified answers get distinct sounds, and mute preferences survive reload',async({page})=>{
  await observeAudio(page);await page.setViewportSize({width:1440,height:1100});await page.goto('/#cards');
  await expect(page.getByRole('switch',{name:'Автоозвучка слов'})).toBeChecked();
  await expect(page.getByRole('switch',{name:'Звуки ответов'})).toBeChecked();
  expect((await audit(page)).spoken).toHaveLength(0);
  await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
  const first=await page.locator('.flashcard-word h2').innerText();
  expect((await audit(page)).spoken.map(({text,lang})=>({text,lang}))).toEqual([{text:first,lang:'es-ES'}]);
  expect((await audit(page)).spoken[0].rate).toBeCloseTo(0.9);
  const option=page.locator('.answer-options button').first();
  expect(await option.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(20);
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(76);
  await choose(page,await cardAnswer(page));
  await expect(page.getByRole('status').filter({hasText:'¡Muy bien!'})).toBeVisible();
  await expect.poll(async()=>(await audit(page)).tones.length).toBe(2);
  expect((await audit(page)).tones.map(t=>t.frequency)).toEqual([659.25,880]);
  expect((await audit(page)).tones.every(t=>t.state==='running')).toBe(true);
  await page.getByRole('button',{name:'Следующая фраза',exact:false}).click();
  const second=await page.locator('.flashcard-word h2').innerText();
  expect((await audit(page)).spoken.map(s=>s.text)).toEqual([first,second]);
  const right=await cardAnswer(page);
  const translations=await page.locator('.answer-options button').evaluateAll(buttons=>buttons.map(b=>b.querySelectorAll('span')[1].textContent!));
  await choose(page,translations.find(t=>t!==right)!);
  await expect(page.getByRole('status').filter({hasText:'Ничего страшного'})).toBeVisible();
  await expect.poll(async()=>(await audit(page)).tones.length).toBe(4);
  expect((await audit(page)).tones.slice(2).map(t=>t.frequency)).toEqual([220,164.81]);
  expect((await audit(page)).tones.slice(2).every(t=>t.type==='triangle')).toBe(true);
  await page.getByRole('switch',{name:'Звуки ответов'}).click();
  await page.getByRole('button',{name:'Следующая фраза',exact:false}).click();
  await choose(page,await cardAnswer(page));
  await expect(page.getByRole('status').filter({hasText:'¡Muy bien!'})).toBeVisible();
  expect((await audit(page)).tones).toHaveLength(4);
  await page.getByRole('switch',{name:'Автоозвучка слов'}).click();
  const spoken=(await audit(page)).spoken.length;
  await page.getByRole('button',{name:'Следующая фраза',exact:false}).click();
  expect((await audit(page)).spoken).toHaveLength(spoken);
  await page.locator('.flashcard-word').getByRole('button',{name:'Озвучить медленно',exact:true}).click();
  expect((await audit(page)).spoken.at(-1)?.rate).toBeCloseTo(0.65);
  await page.reload();
  await expect(page.getByRole('switch',{name:'Автоозвучка слов'})).not.toBeChecked();
  await expect(page.getByRole('switch',{name:'Звуки ответов'})).not.toBeChecked();
  await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
  expect((await audit(page)).spoken).toHaveLength(0);
  await page.getByRole('switch',{name:'Автоозвучка слов'}).click();
  expect((await audit(page)).spoken).toHaveLength(1);
  const cancelled=(await audit(page)).cancelled;
  await page.getByRole('button',{name:'Закончить сейчас',exact:true}).click();
  expect((await audit(page)).cancelled).toBeGreaterThan(cancelled);
});

test('a failed request never plays an incorrect-answer signal',async({page})=>{
  await observeAudio(page);await page.goto('/#cards');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
  await page.route('**/api/review',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Проверка временно недоступна'})}));
  const answer=await cardAnswer(page);await choose(page,answer);
  await expect(page.getByRole('status').filter({hasText:'Проверка временно недоступна'})).toBeVisible();
  expect((await audit(page)).tones).toHaveLength(0);
  await expect(page.locator('.answer-options button').first()).toBeEnabled();
  await page.unroute('**/api/review');await choose(page,answer);
  await expect(page.getByRole('status').filter({hasText:'¡Muy bien!'})).toBeVisible();
  await expect.poll(async()=>(await audit(page)).tones.length).toBe(2);
});

test('large study text and controls remain readable on a phone',async({page})=>{
  await observeAudio(page);await page.setViewportSize({width:390,height:844});await page.goto('/#cards');
  await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
  const option=page.locator('.answer-options button').first();
  expect(await option.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.locator('.flashcard-word h2').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(40);
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(76);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/readable-practice-mobile.png',fullPage:true,animations:'disabled'});
});
