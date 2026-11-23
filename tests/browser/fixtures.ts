import {test as base,expect,type Page} from '@playwright/test';
export async function dismissMonthlyPrompts(page:Page){await page.addLocatorHandler(page.getByRole('dialog',{name:/^(Какой план у тебя|Месяц завершён)/}),async dialog=>{await dialog.getByRole('button',{name:'Позже',exact:true}).click();});}
export async function dismissBalanceReminder(page:Page){
 await page.addLocatorHandler(page.getByRole('dialog',{name:'Остаток оплаченных уроков',exact:true}),dialog=>dialog.getByRole('button',{name:'ОК',exact:true}).click());
}
export const test=base.extend<{dismissMonthlyPrompts:boolean;dismissBalanceReminder:boolean}>({dismissMonthlyPrompts:[true,{option:true}],dismissBalanceReminder:[true,{option:true}],page:async({page,dismissMonthlyPrompts:shouldDismiss,dismissBalanceReminder:shouldDismissBalance},use)=>{if(shouldDismissBalance)await dismissBalanceReminder(page);if(shouldDismiss)await dismissMonthlyPrompts(page);await use(page);}});
export {expect};export type {Page};
