import {test,expect} from './fixtures';
test('Plan follows the monthly board layout without removed shortcuts and header clutter',async({page})=>{
 await page.setViewportSize({width:1440,height:1100});await page.goto('/');await expect(page.getByRole('heading',{name:'Сегодня',exact:true})).toBeVisible();for(const name of ['План на месяц','Точка А и точка Б','Критерии успеха','Ежемесячная рефлексия'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
 await expect(page.locator('.masthead-brand')).toHaveText('ñMI ESPAÑOL');await expect(page.getByRole('button',{name:'Голос',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Начать практику',exact:true})).toHaveCount(0);await expect(page.locator('.study-top-grid,.study-skill-grid,.study-week-panel,.study-work-grid,.study-course-plan')).toHaveCount(0);await page.getByRole('link',{name:/^Автоматизация/}).click();await expect(page.getByRole('button',{name:'Формат Анки',exact:true})).toBeVisible();
});
test('the monthly board limits the selection to two aspects',async({page})=>{
 await page.goto('/');await page.getByRole('checkbox',{name:'Речь · монолог',exact:true}).check();await page.getByRole('checkbox',{name:'Слух',exact:true}).check();await expect(page.getByRole('checkbox',{name:'Чтение',exact:true})).toBeDisabled();await page.getByRole('checkbox',{name:'Слух',exact:true}).uncheck();await expect(page.getByRole('checkbox',{name:'Чтение',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Сохранить план на месяц',exact:true})).toBeDisabled();
});
test('the monthly board remains usable on a phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'План на месяц',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/study-home-mobile.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:1586,height:1100});await page.screenshot({path:'test-results/study-home-desktop.png',fullPage:true,animations:'disabled'});
});
