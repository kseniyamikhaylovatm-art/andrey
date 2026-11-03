import {test,expect} from '@playwright/test';
test('study, conjugate, track lessons and retain progress after reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Ближе к Испании. С каждым словом.'})).toBeVisible();
 await page.getByRole('button',{name:'Начать практику'}).click();await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
 const word=await page.locator('.flashcard-word h2').innerText();const {state}=await (await page.request.get('/api/state')).json();const card=state.cards.find((c:{es:string})=>c.es===word);
 await page.getByRole('button',{name:card.ru,exact:false}).filter({has:page.locator('.option-letter')}).click();await expect(page.getByRole('status').filter({hasText:'¡Muy bien!'})).toBeVisible();
 await expect(page.locator('.example')).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Слова, которые остаются'})).toBeVisible();
 const after=await (await page.request.get('/api/state')).json();expect(after.state.cards.find((c:{id:string})=>c.id===card.id).seen).toBeGreaterThan(0);
 await page.getByRole('link',{name:'Глаголы',exact:true}).click();await page.getByRole('button',{name:'Практиковать',exact:true}).click();
 const forms=['hablo','hablas','habla','hablamos','habláis','hablan'];const persons=['yo','tú','él / ella / usted','nosotros / nosotras','vosotros / vosotras','ellos / ellas / ustedes'];
 for(let i=0;i<6;i++)await page.getByRole('textbox',{name:persons[i],exact:true}).fill(forms[i]);
 await page.getByRole('button',{name:'Проверить формы'}).click();await expect(page.getByText('6 из 6 · ¡Perfecto!')).toBeVisible();
 await page.getByRole('link',{name:'Оплата',exact:true}).click();await page.getByRole('button',{name:'Отметить оплату',exact:true}).click();await page.getByRole('button',{name:'Подтвердить оплату'}).click();await expect(page.getByRole('dialog')).toBeHidden();
 await expect(page.locator('.stat').filter({hasText:'Оплаченных осталось'}).locator('.stat-value')).toHaveText('12');
 await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').first().fill('Разговор о сёрфинге');await page.getByRole('button',{name:'Сохранить урок'}).click();
 await page.getByRole('combobox',{name:'Статус занятия Разговор о сёрфинге'}).selectOption('held');await expect(page.locator('.stat').filter({hasText:'Оплаченных осталось'}).locator('.stat-value')).toHaveText('11');
 await page.getByRole('combobox',{name:'Статус занятия Разговор о сёрфинге'}).selectOption('cancelled');await expect(page.locator('.stat').filter({hasText:'Оплаченных осталось'}).locator('.stat-value')).toHaveText('12');
 await page.getByRole('link',{name:'Слух',exact:true}).click();await expect(page.getByText('Полкило помидоров',{exact:false})).toHaveCount(0);await page.getByRole('textbox').fill('Покупатель хочет помидоры и апельсины.');await page.getByRole('button',{name:'Сравнить с образцом'}).click();await expect(page.getByText('Полкило помидоров',{exact:false})).toBeVisible();
 await page.getByRole('link',{name:'Прогресс',exact:true}).click();await expect(page.locator('.heatmap .heat-cell')).toHaveCount(84);expect(errors).toEqual([]);
});
test('all eight tabs work on a phone without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 for(const [tab,heading] of [['Кабинет','Кабинет'],['Автоматизация','Слова, которые остаются'],['Глаголы','Глаголы без спешки'],['Речь','Ваш голос на испанском'],['Слух','Услышать и понять'],['Прогресс','Ваш испанский растёт'],['Оплата','Встречаемся и учимся'],['План','Ближе к Испании. С каждым словом.']]){
  await page.getByRole('button',{name:'Открыть меню'}).click();await page.getByRole('link',{name:tab,exact:tab!=='Автоматизация'}).click();
  if(tab==='Глаголы')await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.screenshot({path:'test-results/mobile-plan.png',fullPage:true,animations:'disabled'});
});
test('desktop plan visual',async({page})=>{await page.setViewportSize({width:1440,height:1100});await page.goto('/');await expect(page.getByRole('heading',{name:'Ваш маршрут'})).toBeVisible();await page.screenshot({path:'test-results/desktop-plan.png',fullPage:true,animations:'disabled'});});

test('import a real Cyrillic PDF as multiple cards without AI, edit before saving and skip duplicates', async ({ page, browser }) => {
 const printPage=await browser.newPage();
 await printPage.setContent('<!doctype html><meta charset="utf-8"><style>p{font:18px Arial; margin:18px}</style><p>Карточки урока</p><p>el faro — маяк</p><p>la marea – прилив</p><p>remar - грести</p>');
 const pdf=await printPage.pdf();await printPage.close();
 await page.goto('/#cards');
 const before=(await (await page.request.get('/api/state')).json()).state;
 await page.getByRole('button',{name:'Загрузить PDF карточек',exact:true}).click();
 const modal=page.getByRole('dialog');
 await modal.getByLabel('Выберите PDF карточек', {exact:true}).setInputFiles({name:'Сёрфинг.pdf',mimeType:'application/pdf',buffer:pdf});
 await expect(modal.getByRole('heading',{name:'Проверьте карточки'})).toBeVisible();
 await expect(modal.getByLabel('Испанский · карточка 1')).toHaveValue('el faro');
 await expect(modal.getByLabel('Перевод · карточка 1')).toHaveValue('маяк');
 await expect(modal.getByLabel('Испанский · карточка 3')).toHaveValue('remar');
 await expect(modal.getByText('Не удалось разобрать строк: 1.')).toBeVisible();
 expect((await (await page.request.get('/api/state')).json()).state.cards.length).toBe(before.cards.length);
 await modal.getByLabel('Перевод · карточка 2').fill('прилив и отлив');
 await modal.getByRole('button',{name:'Не добавлять карточку 3'}).click();
 await modal.getByLabel('Тема для всех карточек').fill('Сёрфинг');
 await modal.getByRole('button',{name:'Добавить все карточки'}).click();
 await expect(modal.getByRole('status')).toContainText('Добавлено: 2');
 await modal.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.getByRole('button',{name:'База фраз',exact:false}).click();
 await page.getByRole('textbox',{name:'Поиск по базе'}).fill('la marea');
 await expect(page.locator('.vocab-row')).toContainText('прилив и отлив');
 await page.reload();await page.getByRole('button',{name:'Загрузить PDF карточек',exact:true}).click();
 await modal.getByLabel('Список карточек · можно вставить текст или исправить строки из PDF').fill('el faro — новое значение\nla marea — другое значение');
 await modal.getByRole('button',{name:'Проверить список'}).click();
 await modal.getByRole('button',{name:'Добавить все карточки'}).click();
 await expect(modal.getByRole('status')).toContainText('Повторов пропущено: 2');
 const after=(await (await page.request.get('/api/state')).json()).state;
 expect(after.cards.length).toBe(before.cards.length+2);
 expect(after.cards.find((c:{es:string})=>c.es==='la marea').ru).toBe('прилив и отлив');
 expect(after.cards.find((c:{es:string})=>c.es==='el faro').source).toBe('Сёрфинг.pdf');
});

test('speech explains why AI feedback is unavailable and retains the answer draft', async ({page}) => {
 await page.goto('/#speech');
 const answer=page.getByLabel('Ваш ответ · текстом или голосом');
 await answer.fill('Hoy he hablado con mi vecino sobre las clases de surf.');
 await expect(page.getByRole('button',{name:'ИИ-проверка не подключена',exact:true})).toBeDisabled();
 await expect(page.getByRole('note').filter({hasText:'Для обратной связи преподавателю нужно подключить ИИ'})).toBeVisible();
 await page.reload();
 await expect(answer).toHaveValue('Hoy he hablado con mi vecino sobre las clases de surf.');
 const {state}=await (await page.request.get('/api/state')).json();
 expect(state.speeches).toHaveLength(0);
});
