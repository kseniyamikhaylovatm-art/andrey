import {test,expect} from '@playwright/test';

test('Plan shows the date and learning plans without removed shortcuts and header clutter',async({page})=>{
  await page.setViewportSize({width:1440,height:1100});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Сегодня',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'План на месяц',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'План обучения',exact:true})).toBeVisible();
  await expect(page.locator('.masthead-brand')).toHaveText('ñMI ESPAÑOL');
  await expect(page.getByRole('button',{name:'Голос',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Начать практику',exact:true})).toHaveCount(0);
  await expect(page.locator('.study-top-grid,.study-skill-grid,.study-week-panel,.study-work-grid')).toHaveCount(0);
  await page.getByRole('link',{name:/^Автоматизация/}).click();
  await expect(page.getByRole('button',{name:'Формат Анки',exact:true})).toBeVisible();
});

test('the simplified Plan retains editable course goals',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Изменить план',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Ваш план обучения'})).toBeVisible();
});

test('the simplified Plan and monthly editor remain usable on a phone',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Сегодня',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Новый месяц',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Новый план на месяц'})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.screenshot({path:'test-results/study-home-mobile.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:1586,height:1100});
  await page.screenshot({path:'test-results/study-home-desktop.png',fullPage:true,animations:'disabled'});
});
