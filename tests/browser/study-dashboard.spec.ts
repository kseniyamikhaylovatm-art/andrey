import {test,expect} from '@playwright/test';

test('home is a functional study dashboard with no decorative illustration or slogan',async({page})=>{
  await page.setViewportSize({width:1440,height:1100});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Сегодня',exact:true})).toBeVisible();
  await expect(page.locator('.coast-art,.hero,.daily-icon')).toHaveCount(0);
  await expect(page.getByText('Ближе к Испании.',{exact:false})).toHaveCount(0);
  const {state}=await (await page.request.get('/api/state')).json();
  const total=state.cards.length;
  await expect(page.getByText('Всего в базе: '+total+' карточек',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Тренировка дня',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Испанский на сегодня',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Вспомнить слова'})).toBeVisible();
  await page.goto('/');await page.getByRole('button',{name:'Открыть диалог',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Сначала выберем ситуацию',exact:true})).toBeVisible();
  await page.goto('/');await page.getByRole('button',{name:'Открыть пересказ',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Расскажите своими словами',exact:true})).toBeVisible();
  await page.goto('/');await page.getByRole('button',{name:'Слушать',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Что послушаем?',exact:true})).toBeVisible();
});

test('home adds vocabulary, opens topic practice and retains editable course goals',async({page})=>{
  await page.goto('/');
  await page.getByRole('textbox',{name:'Слово и перевод',exact:true}).fill('el cuaderno — тетрадь');
  await page.getByRole('button',{name:'Добавить',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Карточка добавлена'})).toBeVisible();
  const {state}=await (await page.request.get('/api/state')).json();
  expect(state.cards.find((c:{es:string})=>c.es==='el cuaderno').ru).toBe('тетрадь');
  const row=page.locator('.study-topic-row').filter({hasText:'Повседневное'});
  await row.getByRole('button',{name:'Тренировать',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Выберите тему'})).toHaveValue('Повседневное');
  await expect(page.getByRole('button',{name:'Все фразы',exact:true})).toHaveClass('active');
  await page.goto('/');await page.getByRole('button',{name:'Изменить план',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Ваш план обучения'})).toBeVisible();
});

test('daily dashboard stays usable on mobile and shows the requested study layout',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Сегодня',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Добавить запись',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'test-results/study-home-mobile.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:1586,height:1100});
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'test-results/study-home-preview.png',animations:'disabled'});
  await page.screenshot({path:'test-results/study-home-desktop.png',fullPage:true,animations:'disabled'});
});
