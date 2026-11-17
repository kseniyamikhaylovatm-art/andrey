import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3101'});
async function login(page:Page,code:string){await page.goto('/');await page.getByLabel('Личный код доступа', {exact:true}).fill(code);await page.getByRole('button',{name:'Войти',exact:true}).click();}
async function createStudent(page:Page,name:string,examples=false){
  await page.getByRole('button',{name:'Новый ученик',exact:true}).click();
  await page.getByRole('textbox',{name:'Имя ученика или пары'}).fill(name);
  if(examples)await page.getByRole('checkbox',{name:'Добавить стартовые учебные примеры'}).check();
  await page.getByRole('button',{name:'Создать кабинет',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Код ученика · '+name});await expect(dialog).toBeVisible();
  const code=await dialog.getByTestId('issued-code').innerText();
  await page.getByRole('button',{name:'Готово, код сохранён'}).click();return code;
}

test('teacher creates private student spaces; a student signs in, practices and cannot access the teacher or another student',async({page,browser})=>{
  await login(page,'teacher-browser-code-for-tests');await expect(page.getByRole('heading',{name:'Кабинет преподавателя',exact:true})).toBeVisible();
  const code=await createStudent(page,'Мария',true);await createStudent(page,'Павел');
  const roster=(await (await page.request.get('/api/students')).json()).students;
  const maria=roster.find((item:{name:string})=>item.name==='Мария'),pavel=roster.find((item:{name:string})=>item.name==='Павел');
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3101'}),student=await context.newPage();
  try{
    await login(student,code);await expect(student.locator('.student-name')).toContainText('Мария');
    await expect(student.getByRole('button',{name:'Мои ученики',exact:true})).toHaveCount(0);
    await expect(student.getByRole('button',{name:'Изменить план',exact:true})).toHaveCount(0);
    await expect(student.getByRole('link',{name:'Уроки',exact:true})).toBeVisible();
    expect((await student.request.get('/api/students')).status()).toBe(403);
    expect((await student.request.get('/api/state',{headers:{'X-Student-Id':pavel.id}})).status()).toBe(403);
    await student.getByRole('button',{name:'Новые слова · 24',exact:true}).click();
    await student.getByRole('button',{name:'Начать тренировку',exact:true}).click();
    const own=(await (await student.request.get('/api/state')).json()).state;
    const word=await student.locator('.flashcard-word h2').innerText(),card=own.cards.find((item:{es:string})=>item.es===word);
    await student.locator('.answer-options button').filter({hasText:card.ru}).click();
    await expect(student.locator('.answer-feedback')).toBeVisible();
    const mariaState=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':maria.id}})).json()).state;
    const pavelState=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':pavel.id}})).json()).state;
    expect(mariaState.attempts).toHaveLength(1);expect(pavelState.attempts).toHaveLength(0);
    await student.goto('/#payment');await expect(student.getByRole('button',{name:'Отметить оплату'})).toHaveCount(0);
    await student.goto('/#plan');await expect(student.locator('.student-name')).toContainText('Мария');await student.screenshot({path:'test-results/student-cabinet.png',fullPage:true,animations:'disabled'});
    await page.reload();await expect(page.getByRole('heading',{name:'Кабинет преподавателя',exact:true})).toBeVisible();await page.screenshot({path:'test-results/teacher-students.png',fullPage:true,animations:'disabled'});
  }finally{await context.close();}
});

test('teacher switching keeps card imports, exports and unsent speech drafts in the selected student space',async({page})=>{
  await login(page,'teacher-browser-code-for-tests');
  const first=page.locator('.student-card').filter({has:page.getByRole('heading',{name:'Мария',exact:true})});await first.getByRole('button',{name:'Открыть кабинет'}).click();
  await page.getByRole('textbox',{name:'Слово и перевод',exact:true}).fill('el lápiz — карандаш');await page.getByRole('button',{name:'Добавить',exact:true}).click();await expect(page.getByRole('status')).toContainText('Карточка добавлена');
  await page.getByRole('link',{name:'Речь',exact:true}).click();await page.getByRole('textbox',{name:'Ваш ответ · текстом или голосом'}).fill('Private draft of Maria');
  await page.getByRole('button',{name:'Мои ученики',exact:true}).first().click();
  await page.locator('.student-card').filter({has:page.getByRole('heading',{name:'Павел',exact:true})}).getByRole('button',{name:'Открыть кабинет'}).click();
  await expect(page.locator('.student-name')).toContainText('Павел');await expect(page.getByText('Всего в базе: 0 карточек',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Речь',exact:true}).click();await expect(page.getByRole('textbox',{name:'Ваш ответ · текстом или голосом'})).toHaveValue('');
  const href=await page.getByRole('link',{name:'Скачать резервную копию',exact:true}).first().getAttribute('href');
  const backup=await (await page.request.get(href!)).json();expect(backup.student.name).toBe('Павел');expect(backup.state.cards).toHaveLength(0);
  await page.getByRole('button',{name:'Мои ученики',exact:true}).first().click();
  await page.locator('.student-card').filter({has:page.getByRole('heading',{name:'Мария',exact:true})}).getByRole('button',{name:'Открыть кабинет'}).click();
  await page.getByRole('link',{name:'Речь',exact:true}).click();await expect(page.getByRole('textbox',{name:'Ваш ответ · текстом или голосом'})).toHaveValue('Private draft of Maria');
});

test('mobile teacher can issue a replacement code; the old login expires and the new code keeps the same cabinet',async({page,browser})=>{
  await page.setViewportSize({width:390,height:844});await login(page,'teacher-browser-code-for-tests');
  await expect(page.getByRole('button',{name:'Выйти',exact:true})).toBeVisible();
  const old=await createStudent(page,'Елена');const context=await browser.newContext({baseURL:'http://127.0.0.1:3101'}),student=await context.newPage();
  try{
    await login(student,old);await expect(student.locator('.student-name')).toContainText('Елена');
    await page.locator('.student-card').filter({has:page.getByRole('heading',{name:'Елена',exact:true})}).getByRole('button',{name:'Новый код входа'}).click();
    await page.getByRole('button',{name:'Создать новый код',exact:true}).click();
    const code=await page.getByTestId('issued-code').innerText();expect(code).not.toBe(old);await page.getByRole('button',{name:'Готово, код сохранён'}).click();
    await student.reload();await expect(student.getByLabel('Личный код доступа', {exact:true})).toBeVisible();
    await login(student,code);await expect(student.locator('.student-name')).toContainText('Елена');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/teacher-students-mobile.png',fullPage:true,animations:'disabled'});
    await student.getByRole('button',{name:'Выйти',exact:true}).first().click();await expect(student.getByLabel('Личный код доступа', {exact:true})).toBeVisible();
  }finally{await context.close();}
});
