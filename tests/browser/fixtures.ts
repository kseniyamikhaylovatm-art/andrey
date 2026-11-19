import {test as base,expect,type Page} from '@playwright/test';
export async function dismissMonthlyPrompts(page:Page){await page.addLocatorHandler(page.getByRole('dialog',{name:/^(Какой план у тебя|Месяц завершён)/}),async dialog=>{await dialog.getByRole('button',{name:'Позже',exact:true}).click();});}
export const test=base.extend<{dismissMonthlyPrompts:boolean}>({dismissMonthlyPrompts:[true,{option:true}],page:async({page,dismissMonthlyPrompts:shouldDismiss},use)=>{if(shouldDismiss)await dismissMonthlyPrompts(page);await use(page);}});
export {expect};export type {Page};
