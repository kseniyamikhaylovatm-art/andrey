import {test,expect,dismissMonthlyPrompts,type Page} from './fixtures';
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
  const headers={'X-Student-Id':result.student.id};await page.request.post('/api/payments',{headers,data:{date:'2026-11-01',lessons:4}});await page.request.post('/api/lessons',{headers,data:{date:'2026-11-17',title:'Запланированное занятие',status:'planned',note:'Проверить сохранение'}});await page.reload();
  await page.getByLabel('Дата урока',{exact:true}).fill('2026-11-17');
  const pairs=['el barrio — район','la esquina — угол','cruzar — переходить','el semáforo — светофор','girar — поворачивать','seguir recto — идти прямо','el taller — мастерская','la plaza — площадь','el puente — мост','la acera — тротуар','la entrada — вход','la salida — выход'];
  for(const text of pairs)await record(page,text);
  const requestOptions={headers:{'X-Student-Id':result.student.id}};
  const initial=(await (await page.request.get('/api/state',requestOptions)).json()).state;
  const first=initial.lessons.find((lesson:{date:string})=>lesson.date==='2026-11-17');expect(first.cardIds).toHaveLength(12);expect(first.status).toBe('held');expect(initial.lessons).toHaveLength(1);
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
  await page.getByRole('button',{name:'Все слова',exact:true}).click();await page.getByRole('button',{name:'База слов',exact:true}).click();
  await expect(page.locator('.vocab-row').filter({hasText:'el barrio'})).toContainText('городской район');
  await page.getByRole('link',{name:'Оплата',exact:true}).click();await expect(page.getByRole('combobox',{name:'Статус занятия Запланированное занятие',exact:true})).toHaveValue('held');await expect(page.locator('.stat').filter({hasText:'Оплаченных осталось'}).locator('.stat-value')).toHaveText('2');
});

test('a student sees live lesson vocabulary on a phone and can practice even the first word in an empty cabinet',async({page,browser})=>{
  const result=await openNewStudent(page,'Первый урок · отдельный ученик');await page.getByLabel('Дата урока',{exact:true}).fill('2026-11-17');await record(page,'la puerta — дверь');
  const own=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3101',viewport:{width:390,height:844}}),student=await context.newPage();await dismissMonthlyPrompts(student);
  try{
    await student.goto('/');await student.getByLabel('Личный код доступа',{exact:true}).fill(result.code);await student.getByRole('button',{name:'Войти',exact:true}).click();
    await student.getByRole('button',{name:'Открыть меню'}).click();await student.getByRole('link',{name:'Слова',exact:true}).click();
    await expect(student.locator('.lesson-word-row')).toHaveCount(1);await expect(student.getByRole('button',{name:'Добавить слово',exact:true})).toHaveCount(0);
    await expect(student.getByRole('button',{name:'Редактировать la puerta',exact:true})).toHaveCount(0);
    await student.getByRole('button',{name:'Тренировать слова урока',exact:true}).click();await student.getByRole('button',{name:'Начать тренировку',exact:true}).click();
    await student.getByRole('button',{name:'Подсказка',exact:true}).click();await student.getByRole('button',{name:'Вспомнил',exact:true}).click();
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
 const row=page.locator('.lesson-word-row').filter({hasText:'el cuaderno'});await expect(row.locator('.lesson-word-translation')).toHaveCount(0);await row.locator('.lesson-word-reveal').click();await expect(row).toContainText('тетрадь');await expect(page.locator('.lesson-words-heading')).not.toBeEmpty();
 const state=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;expect(state.cards[0].ru).toBe('тетрадь');expect(state.lessons[0].cardIds).toContain(state.cards[0].id);
});
test('unavailable AI preserves the entered word and creates no empty lesson or untranslated card',async({page})=>{
 const result=await openNewStudent(page,'Нет ИИ · тест');const field=page.getByRole('textbox',{name:'Слово на испанском',exact:true});await field.fill('el cuaderno');await field.press('Enter');
 await expect(page.getByRole('status')).toContainText('Автоперевод пока не подключён');await expect(field).toHaveValue('el cuaderno');
 const state=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;expect(state.cards).toHaveLength(0);expect(state.lessons).toHaveLength(0);
});

test('teacher pastes a whole list into Words and saves one dated record without duplicates or partial invalid imports',async({page})=>{
 const result=await openNewStudent(page,'Список целиком · тест');await page.getByRole('button',{name:'Списком',exact:true}).click();
 const field=page.getByRole('textbox',{name:'Список слов',exact:true});
 await field.fill('el comedor — столовая\nla cocina —');await page.getByRole('button',{name:'Добавить список',exact:true}).click();await expect(page.getByRole('status')).toContainText('строку 2');await expect(field).toHaveValue('el comedor — столовая\nla cocina —');
 let state=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;expect(state.cards).toHaveLength(0);expect(state.lessons).toHaveLength(0);
 await field.fill('el comedor — столовая\nla cocina — кухня\nla ventana — окно\nel comedor — столовая');await page.getByRole('button',{name:'Добавить список',exact:true}).click();await expect(field).toHaveValue('');await expect(page.locator('.lesson-word-row')).toHaveCount(3);
 state=(await (await page.request.get('/api/state',{headers:{'X-Student-Id':result.student.id}})).json()).state;expect(state.cards).toHaveLength(3);expect(state.lessons).toHaveLength(1);expect(state.lessons[0].cardIds).toHaveLength(3);
 const row=page.locator('.lesson-word-row').filter({hasText:'el comedor'});await row.locator('.lesson-word-reveal').click();await expect(row).toContainText('столовая');
 await page.getByRole('button',{name:'Тренировать слова урока',exact:true}).click();await expect(page.getByRole('combobox',{name:'Слова какого урока',exact:true})).toHaveValue(state.lessons[0].id);
});

test('compact word rows reveal meanings and examples on click; teacher can change the learner level',async({page})=>{
 const result=await openNewStudent(page,'Уровень и примеры · тест');await record(page,'el comedor — столовая');
 const options={headers:{'X-Student-Id':result.student.id}};const state=(await (await page.request.get('/api/state',options)).json()).state;
 await page.request.patch('/api/cards/'+state.cards[0].id,{...options,data:{examples:[{es:'Como en el comedor.',ru:'Я ем в столовой.'}]}});await page.reload();
 const row=page.locator('.lesson-word-row').filter({hasText:'el comedor'});await expect(row.locator('.lesson-word-translation')).toHaveCount(0);await row.locator('.lesson-word-reveal').click();await expect(row).toContainText('Я ем в столовой.');await expect(row.getByRole('button',{name:'Озвучить el comedor',exact:true})).toBeVisible();
 await row.locator('.lesson-word-reveal').click();await expect(row.locator('.lesson-word-translation')).toHaveCount(0);
 await page.getByRole('button',{name:'Мои ученики',exact:true}).first().click();const profile=page.locator('.student-card').filter({has:page.getByRole('heading',{name:'Уровень и примеры · тест',exact:true})});await profile.getByRole('button',{name:'Имя и уровень',exact:true}).click();
 await page.getByRole('combobox',{name:'Уровень ученика',exact:true}).selectOption('B1');await page.getByRole('dialog').getByRole('button',{name:'Сохранить',exact:true}).click();await expect(profile).toContainText('B1');
 await profile.getByRole('button',{name:'Открыть кабинет',exact:true}).click();await expect(page.locator('.student-name')).toContainText('B1');
});

test('Miro board belongs to the selected learner and imported vocabulary reaches dated words and verb practice',async({page})=>{
 const student=await openNewStudent(page,'Доска Miro · тест');
 await page.request.patch('/api/students/'+student.student.id,{data:{name:student.student.name,miroBoardUrl:'https://miro.com/app/board/test/'}});
 await page.route('**/api/state',async route=>{const response=await route.fetch();const body=await response.json();body.meta.ai=true;body.meta.miro=true;await route.fulfill({json:body});});
 await page.route('**/api/miro/text',route=>route.fulfill({json:{text:'el comedor — столовая\ncuidar — заботиться\nPalabras del colegio',source:'Miro · test',items:2,skipped:0}}));
 const draft={title:'Слова с доски',transcript:'el comedor — столовая\ncuidar — заботиться\nPalabras del colegio',topics:['Школа'],assignments:[],cards:[{es:'el comedor',ru:'столовая',topic:'Школа',type:'word',register:'neutral',source:'Miro · test',examples:[]},{es:'cuidar',ru:'заботиться',topic:'Школа',type:'word',register:'neutral',source:'Miro · test',examples:[]}]};
 await page.route('**/api/ai/document',route=>route.fulfill({json:draft}));await page.reload();
 await expect(page.getByRole('link',{name:'Открыть доску',exact:true})).toHaveAttribute('href','https://miro.com/app/board/test/');
 await page.getByRole('button',{name:'Загрузить из Miro',exact:true}).click();await expect(page.getByRole('textbox',{name:'Текст фрагмента · можно вставить вручную'})).toHaveValue(/el comedor/);
 await page.getByRole('button',{name:'Разобрать фрагмент с Claude',exact:true}).click();await expect(page.getByRole('heading',{name:'Проверьте перед добавлением'})).toBeVisible();
 await page.getByRole('button',{name:'Подтвердить и добавить',exact:true}).click();await expect(page.getByRole('status')).toContainText('Добавлено карточек: 2');
 await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('.lesson-word-row')).toHaveCount(2);
 await page.getByRole('link',{name:'Глаголы',exact:true}).click();await expect(page.getByRole('button',{name:'cuidar',exact:true})).toBeVisible();
});

test('manual examples become Russian-to-Spanish self-check cards without AI',async({page})=>{
  const {student}=await openNewStudent(page,'Ручные примеры · целые фразы');
  const spanishExample='La lámpara está encendida.';
  const russianExample='Лампа включена.';
  await page.getByLabel('Слово на испанском',{exact:true}).fill('lámpara');
  await page.getByLabel('Перевод слова на русский',{exact:true}).fill('лампа');
  await page.getByLabel('Пример на испанском',{exact:true}).fill(spanishExample);
  await page.getByLabel('Перевод примера на русский',{exact:true}).fill(russianExample);
  await page.getByRole('button',{name:'Добавить слово',exact:true}).click();
  await page.locator('.lesson-word-row').filter({hasText:'lámpara'}).locator('.lesson-word-reveal').click();
  await expect(page.getByText(spanishExample,{exact:true})).toBeVisible();

  await page.getByRole('button',{name:'Списком',exact:true}).click();
  await page.getByLabel('Список слов',{exact:true}).fill(
    'ventana — окно | Abro la ventana. | Я открываю окно.\nvaso — стакан | El vaso es de cristal.'
  );
  await page.getByRole('button',{name:'Добавить список',exact:true}).click();
  await expect(page.locator('.lesson-word-row')).toHaveCount(3);
  const headers={'X-Student-Id':student.id};
  const {state}=await (await page.request.get('/api/state',{headers})).json();
  expect(state.cards.map((card:{examples:unknown[]})=>card.examples)).toEqual([
    [{es:spanishExample,ru:russianExample}],
    [{es:'Abro la ventana.',ru:'Я открываю окно.'}],
    [{es:'El vaso es de cristal.',ru:''}]
  ]);

  await page.getByRole('link',{name:/^Автоматизация/}).click();
  await page.getByRole('button',{name:'Практика целых фраз',exact:true}).click();
  await page.getByRole('button',{name:'Начать практику'}).click();
  await expect(page.getByRole('heading',{name:russianExample,exact:true})).toBeVisible();
  await expect(page.getByText(spanishExample,{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Показать ответ'}).click();
  await expect(page.getByText(spanishExample,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Следующая фраза'}).click();
  await expect(page.getByRole('heading',{name:'Я открываю окно.',exact:true})).toBeVisible();
  await expect(page.getByText('Abro la ventana.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Показать ответ'}).click();
  await expect(page.getByText('Abro la ventana.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Завершить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Практика завершена'})).toBeVisible();
});
