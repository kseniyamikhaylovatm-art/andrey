import {test,expect} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3101'});
test('13 mixed tasks complete with errors repeated at the end on a phone',async({page})=>{
 await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});
 const student=await (await page.request.post('/api/students',{data:{name:'Лингва тест',level:'A1'}})).json();
 await page.request.post('/api/lesson-words',{headers:{'X-Student-Id':student.student.id},data:{date:'2026-11-17',text:'hola — привет',topic:'Приветствие'}});
 await page.request.post('/api/login',{data:{code:student.code}});
 await page.addInitScript(id=>sessionStorage.setItem('mi:selected-student',id),student.student.id);
 await page.setViewportSize({width:390,height:844});await page.goto('/#cards?view=lingva');
 await expect(page.getByRole('heading',{name:'Упражнение формат дуолинго',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Начать 13 заданий',exact:true}).click();
 for(let i=0;i<14;i++){
  await page.getByRole('textbox',{name:'Ваш ответ',exact:true}).fill(i===0?'adios':'hola');
  await page.getByRole('button',{name:'Проверить ответ',exact:true}).click();
  await expect(page.locator('.lingva-feedback')).toContainText(i===0?'Повторим':'Верно');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 }
 await expect(page.getByText('С первого раза: 12 из 13.',{exact:false})).toBeVisible();
 const saved=(await (await page.request.get('/api/state')).json()).state;expect(saved.attempts).toHaveLength(14);expect(saved.cards[0].stage).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/lingva-mobile.png',fullPage:true});
});
