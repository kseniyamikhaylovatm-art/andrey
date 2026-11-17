import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3101'});
async function workspace(page:Page){
 await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});
 const a=await (await page.request.post('/api/students',{data:{name:'Темы и оплаты '+Date.now(),level:'A1'}})).json(),b=await (await page.request.post('/api/students',{data:{name:'Другой кабинет '+Date.now(),level:'A2'}})).json();
 await page.addInitScript(id=>sessionStorage.setItem('mi:selected-student',id),a.student.id);return {a,b,headers:{'X-Student-Id':a.student.id}};
}
test('Words to bank imports whole themed lists without AI or dated lessons and leaves other pupils untouched',async({page})=>{
 const {a,b,headers}=await workspace(page);await page.goto('/#cabinet');
 await page.getByRole('button',{name:'Слова в базу',exact:false}).click();await expect(page.getByRole('heading',{name:'Слова в базу · списком по теме',exact:true})).toBeVisible();
 await page.getByLabel('Тема',{exact:true}).fill('Путешествия · список');
 await page.getByRole('textbox',{name:'Список слов по теме',exact:true}).fill('el avión — самолёт\nel aeropuerto — аэропорт');
 await page.getByRole('button',{name:'Проверить список',exact:true}).click();await expect(page.getByRole('heading',{name:'Проверьте карточки',exact:true})).toBeVisible();
 expect((await (await page.request.get('/api/state',{headers})).json()).state.cards).toHaveLength(0);
 await page.screenshot({path:'test-results/topic-bank-preview.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Добавить все карточки',exact:true}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('Добавлено: 2');
 await page.getByLabel('Тема',{exact:true}).fill('Дом · список');await page.getByRole('textbox',{name:'Список слов по теме',exact:true}).fill('la cocina — кухня');
 await page.getByRole('button',{name:'Проверить список',exact:true}).click();await page.getByRole('button',{name:'Добавить все карточки',exact:true}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('Добавлено: 1');
 await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
 const own=(await (await page.request.get('/api/state',{headers})).json()).state,other=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':b.student.id}})).json()).state;
 expect(own.cards).toHaveLength(3);expect(own.lessons).toHaveLength(0);expect(other.cards).toHaveLength(0);expect(other.lessons).toHaveLength(0);expect(new Set(own.cards.map((c:{topic:string})=>c.topic))).toEqual(new Set(['Путешествия · список','Дом · список']));
 await page.goto('/#cards?view=base&topic='+encodeURIComponent('Путешествия · список'));await expect(page.locator('.vocab-row')).toHaveCount(2);await expect(page.locator('.vocab-row').filter({hasText:'el avión'})).toBeVisible();
 await page.goto('/#words');await expect(page.locator('.lesson-word-row')).toHaveCount(0);
 expect(a.student.id).not.toBe(b.student.id);
});
test('teacher records mixed package sizes, corrects them and sees each balance; pupil cannot edit payments',async({page})=>{
 const {a,b,headers}=await workspace(page);const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date());await page.goto('/#payment');
 const stat=(name:string)=>page.locator('.stat').filter({hasText:name}).locator('.stat-value');
 for(const [count,note] of [['4','Первая оплата'],['8','Вторая оплата']]){await page.getByRole('button',{name:'Отметить оплату',exact:true}).click();await expect(page.getByRole('button',{name:'Подтвердить оплату',exact:true})).toBeDisabled();await page.getByRole('spinbutton',{name:'Количество оплаченных уроков',exact:true}).fill(count);await page.getByRole('textbox',{name:'Заметка к оплате · необязательно',exact:true}).fill(note);await page.getByRole('button',{name:'Подтвердить оплату',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
 await expect(stat('Оплачено всего')).toHaveText('12');
 await page.request.post('/api/lessons',{headers,data:{date:day,title:'Состоявшийся урок',status:'held',note:''}});await page.request.post('/api/lessons',{headers,data:{date:day,title:'Отменённый урок',status:'cancelled',note:''}});await page.reload();
 await expect(stat('Проведено')).toHaveText('1');await expect(stat('Оплаченных осталось')).toHaveText('11');
 await page.locator('.payment-entry').filter({hasText:'Первая оплата'}).getByRole('button',{name:'Изменить',exact:true}).click();await page.getByRole('spinbutton',{name:'Количество оплаченных уроков',exact:true}).fill('6');await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(stat('Оплачено всего')).toHaveText('14');await expect(stat('Оплаченных осталось')).toHaveText('13');
 const own=(await (await page.request.get('/api/state',{headers})).json()).state;
 await page.getByRole('button',{name:'Мои ученики',exact:true}).click();const card=page.locator('.student-card').filter({hasText:a.student.name});await expect(card.locator('.student-payment-summary')).toContainText('Оплачено: 14');await expect(card.locator('.student-payment-summary')).toContainText('Осталось: 13');await expect(page.locator('.student-card').filter({hasText:b.student.name}).locator('.student-payment-summary')).toContainText('Оплачено: 0');
 await page.request.post('/api/login',{data:{code:a.code}});await page.setViewportSize({width:390,height:844});await page.goto('/#payment');await page.reload();await expect(stat('Оплачено всего')).toHaveText('14');await expect(page.getByRole('button',{name:'Отметить оплату',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Изменить',exact:true})).toHaveCount(0);
 expect((await page.request.patch('/api/payments/'+own.payments[0].id,{data:{date:day,lessons:100}})).status()).toBe(403);expect((await page.request.get('/api/state',{headers:{'X-Student-Id':b.student.id}})).status()).toBe(403);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/payment-count-mobile.png',fullPage:true,animations:'disabled'});
});
