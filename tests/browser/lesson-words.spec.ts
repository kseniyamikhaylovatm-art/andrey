import {test,expect,type Page} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3101'});
async function openNewStudent(page:Page,name:string){
  await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});
  const response=await page.request.post('/api/students',{data:{name,level:'A1'}});expect(response.status()).toBe(201);const result=await response.json();
  await page.goto('/');await page.locator('.student-card').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'Открыть кабинет'}).click();
  await page.getByRole('link',{name:'Слова',exact:true}).click();return result;
}
async function record(page:Page,text:string){const field=page.getByRole('textbox',{name:'Слово на испанском',exact:true});await field.fill(text);await field.press('Enter');await expect(field).toHaveValue('');}

test('teacher keeps dated lesson lists and trains all words of the selected lesson using the same editable cards',async({page})=>{
  await page.setViewportSize({width:1586,height:1100});const result=await openNewStudent(page,'Слова · учебный кабинет');
  await page.getByLabel('Дата урока',{exact:true}).fill('2026-11-17');
  const pairs=['el barrio — район','la esquina — угол','cruzar — переходить','el semáforo — светофор','girar — поворачивать','seguir recto — идти прямо','el taller — мастерская','la plaza — площадь','el puente — мост','la acera — тротуар','la entrada — вход','la salida — выход'];
  for(const text of pairs)await record(page,text);
  const requestOptions={headers:{'X-Student-Id':result.student.id}};
  const initial=(await (await page.request.get('/api/state',requestOptions)).json()).state;
  const first=initial.lessons.find((lesson:{date:string})=>lesson.date==='2026-11-17');expect(first.cardIds).toHaveLength(12);
  await page.getByLabel('Дата урока',{exact:true}).fill('2026-11-16');await record(page,'el campo — поле');await record(page,'el barrio — район');
  const state=(await (await page.request.get('/api/state',requestOptions)).json()).state;
  expect(state.cards).toHaveLength(13);expect(state.lessons).toHaveLength(2);
  await page.getByRole('combobox',{name:'Выберите урок',exact:true}).selectOption(first.id);
  await expect(page.locator('.lesson-word-row')).toHaveCount(12);
  await page.locator('.lesson-word-row').filter({hasText:'el barrio'}).getByRole('button',{name:'Редактировать el barrio',exact:true}).click();
  await page.getByRole('dialog').getByRole('textbox',{name:'Перевод на русский',exact:true}).fill('городской район');await page.getByRole('button',{name:'Сохранить карточку',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('checkbox',{name:'Показать переводы'}).check();await expect(page.locator('.lesson-word-row').filter({hasText:'el barrio'})).toContainText('городской район');
  await page.getByRole('checkbox',{name:'Показать переводы'}).uncheck();
  await page.getByRole('button',{name:'Скрыть уведомление'}).click();
  await page.screenshot({path:'test-results/lesson-words-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Тренировать слова урока',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Слова какого урока',exact:true})).toHaveValue(first.id);
  await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();await expect(page.locator('.practice-card .section-heading .small')).toHaveText('1 / 12');
  const current=await page.locator('.flashcard-word h2').innerText();expect(pairs.map(pair=>pair.split(' — ')[0])).toContain(current);
  await page.getByRole('button',{name:'Закончить сейчас',exact:true}).click();
  await page.getByRole('button',{name:'Все слова',exact:true}).click();await page.getByRole('button',{name:'База фраз',exact:false}).click();
  await expect(page.locator('.vocab-row').filter({hasText:'el barrio'})).toContainText('городской район');
});

test('a student sees live lesson vocabulary on a phone and can practice even the first word in an empty cabinet',async({page,browser})=>{
  const result=await openNewStudent(page,'Первый урок · отдельный ученик');await page.getByLabel('Дата урока',{exact:true}).fill('2026-11-17');await record(page,'la puerta — дверь');
  const own=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3101',viewport:{width:390,height:844}}),student=await context.newPage();
  try{
    await student.goto('/');await student.getByLabel('Личный код доступа',{exact:true}).fill(result.code);await student.getByRole('button',{name:'Войти',exact:true}).click();
    await student.getByRole('button',{name:'Открыть меню'}).click();await student.getByRole('link',{name:'Слова',exact:true}).click();
    await expect(student.locator('.lesson-word-row')).toHaveCount(1);await expect(student.getByRole('button',{name:'Добавить слово',exact:true})).toHaveCount(0);
    await expect(student.getByRole('button',{name:'Редактировать la puerta',exact:true})).toHaveCount(0);
    await student.getByRole('button',{name:'Тренировать слова урока',exact:true}).click();await student.getByRole('button',{name:'Начать тренировку',exact:true}).click();
    await student.getByRole('textbox',{name:'Перевод на русский',exact:true}).fill('дверь');await student.getByRole('button',{name:'Проверить перевод',exact:true}).click();
    await expect(student.locator('.answer-feedback')).toContainText('¡Muy bien!');
    await student.getByRole('button',{name:'Открыть меню'}).click();await student.getByRole('link',{name:'Слова',exact:true}).click();
    const added=await page.request.post('/api/lesson-words',{headers:{'X-Student-Id':result.student.id},data:{date:'2026-11-17',lessonId:own.lessons[0].id,text:'la ventana — окно',topic:'Дом'}});expect(added.ok()).toBe(true);
    await expect(student.locator('.lesson-word-row')).toHaveCount(2,{timeout:12000});
    await student.getByRole('checkbox',{name:'Показать переводы'}).check();await expect(student.locator('.lesson-word-row').filter({hasText:'la ventana'})).toContainText('окно');
    expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await student.screenshot({path:'test-results/lesson-words-student-mobile.png',fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.getByRole('heading',{name:'Слова',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/lesson-words-teacher-mobile.png',fullPage:true,animations:'disabled'});
  }finally{await context.close();}
});

test('Spanish-only input is translated, saved in the dated list and visible with its Russian translation',async({page})=>{
 const result=await openNewStudent(page,'Автоперевод · тест');
 await page.route('**/api/ai/translate-word',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({es:'el cuaderno',ru:'тетрадь',source:'ai'})}));
 await record(page,'el cuaderno');
 const row=page.locator('.lesson-word-row').filter({hasText:'el cuaderno'});await expect(row).toContainText('тетрадь');await expect(row.locator('.word-record-date')).not.toBeEmpty();
 const state=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;expect(state.cards[0].ru).toBe('тетрадь');expect(state.lessons[0].cardIds).toContain(state.cards[0].id);
});
test('unavailable AI preserves the entered word and creates no empty lesson or untranslated card',async({page})=>{
 const result=await openNewStudent(page,'Нет ИИ · тест');const field=page.getByRole('textbox',{name:'Слово на испанском',exact:true});await field.fill('el cuaderno');await field.press('Enter');
 await expect(page.getByRole('status')).toContainText('Автоперевод пока не подключён');await expect(field).toHaveValue('el cuaderno');
 const state=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;expect(state.cards).toHaveLength(0);expect(state.lessons).toHaveLength(0);
});
