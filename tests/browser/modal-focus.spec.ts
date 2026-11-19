import {test,expect} from './fixtures';
test.use({baseURL:'http://127.0.0.1:3101'});
test('student name keeps focus through character typing, editing and Escape',async({page})=>{
 await page.request.post('/api/login',{data:{code:'teacher-browser-code-for-tests'}});await page.goto('/');
 const opener=page.getByRole('button',{name:'Новый ученик',exact:true});await opener.click();
 const field=page.getByRole('textbox',{name:'Имя ученика или пары',exact:true});await field.click();
 await field.pressSequentially('Марина Петрова',{delay:40});await expect(field).toHaveValue('Марина Петрова');await expect(field).toBeFocused();
 await field.press('Backspace');await field.pressSequentially('а');await expect(field).toHaveValue('Марина Петрова');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(opener).toBeFocused();
 await opener.click();await page.getByRole('textbox',{name:'Имя ученика или пары',exact:true}).pressSequentially('Новая ученица',{delay:30});
 await page.getByRole('button',{name:'Создать кабинет',exact:true}).click();await expect(page.getByRole('dialog',{name:'Код ученика · Новая ученица',exact:true})).toBeVisible();
});
