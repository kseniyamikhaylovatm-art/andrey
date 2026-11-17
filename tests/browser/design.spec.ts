import {test,expect} from '@playwright/test';

test('the navy and gold cabinet keeps genuine metrics and working teacher actions',async({page})=>{
  await page.setViewportSize({width:1586,height:1100});await page.goto('/#cabinet');
  await expect(page.getByRole('heading',{name:'Кабинет преподавателя',exact:true})).toBeVisible();
  await expect(page.locator('.masthead-brand')).toContainText('MI ESPAÑOL');
  const navigation=page.getByRole('navigation',{name:'Основная навигация'});
  await expect(navigation.locator('a[href^="#"]')).toHaveCount(9);
  const first=await navigation.getByRole('link',{name:'План',exact:true}).boundingBox(),last=await navigation.getByRole('link',{name:'Оплата',exact:true}).boundingBox();
  expect(Math.abs(first!.y-last!.y)).toBeLessThan(2);
  const {state}=await (await page.request.get('/api/state')).json();
  const week=state.attempts.filter((a:{at:string})=>Date.now()-Date.parse(a.at)<7*86400000);
  await expect(page.locator('.cabinet-stats .stat').filter({hasText:'Ответов за 7 дней'}).locator('.stat-value')).toHaveText(String(week.length));
  await page.getByRole('button',{name:'Обновить сводку',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Сводка обновлена'})).toBeVisible();
  await expect(page.locator('.summary-banner')).toContainText('обновлено');
  await expect(page.locator('.saved-summary')).not.toBeEmpty();
  await page.getByRole('button',{name:'Новый урок',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Новый урок'})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Загрузить PDF карточек',exact:false}).click();
  await expect(page.getByRole('dialog',{name:'Загрузить PDF карточек'})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Скрыть уведомление'}).click();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'test-results/navy-gold-preview.png',animations:'disabled'});
  await page.screenshot({path:'test-results/navy-gold-cabinet.png',fullPage:true,animations:'disabled'});
});

test('the redesigned cabinet adapts to a phone and retains data export in the menu',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/#cabinet');
  await expect(page.getByRole('heading',{name:'Кабинет преподавателя',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Открыть меню'}).click();
  await expect(page.getByRole('link',{name:'Скачать резервную копию',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Оплата',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Встречаемся и учимся'})).toBeVisible();
  await page.getByRole('button',{name:'Открыть меню'}).click();await page.getByRole('link',{name:'Кабинет',exact:true}).click();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'test-results/navy-gold-cabinet-mobile.png',fullPage:true,animations:'disabled'});
});
