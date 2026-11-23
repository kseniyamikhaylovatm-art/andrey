import {test,expect} from './fixtures';

test.use({baseURL:'http://127.0.0.1:3101',dismissBalanceReminder:false});

for(const paid of [0,10]){
  test(`student acknowledges the balance at entry with ${paid} paid lessons`,async({page})=>{
    const teacherLogin=await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});
    expect(teacherLogin.ok()).toBe(true);
    const created=await page.request.post('/api/students',{data:{name:'Остаток уроков '+paid,level:'A1'}});
    expect(created.ok()).toBe(true);
    const {student,code}=await created.json();
    if(paid){
      const headers={'X-Student-Id':student.id};
      expect((await page.request.post('/api/payments',{headers,data:{date:'2026-11-01',lessons:paid}})).ok()).toBe(true);
      for(const date of ['2026-11-02','2026-11-03']){
        expect((await page.request.post('/api/lessons',{headers,data:{date,status:'held',title:'Проведённый урок'}})).ok()).toBe(true);
      }
    }

    expect((await page.request.post('/api/login',{data:{code}})).ok()).toBe(true);
    await page.goto('/#cards?view=phrases');
    const dialog=page.getByRole('dialog',{name:'Остаток оплаченных уроков',exact:true});
    await expect(dialog).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveAttribute('inert','');
    if(paid){
      await expect(dialog).toContainText('Осталось 8 из 10 оплаченных уроков.');
      await expect(dialog.locator('.lesson-balance-empty')).toHaveCount(0);
    }else{
      await expect(dialog.locator('.lesson-balance-empty')).toContainText('0 на счету');
      await expect(dialog).toContainText('Свяжитесь с преподавателем для оплаты.');
    }
    await dialog.getByRole('button',{name:'ОК',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('link',{name:'Слова',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Слова',exact:true})).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(dialog).toBeVisible();
  });
}
