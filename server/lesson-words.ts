import {z} from 'zod';
import type {AppState,Card,LessonWordResult} from '../src/types.js';
import {AppError} from './ai.js';
import {id} from './domain.js';
import {parseCardPairs} from './card-import.js';

export const wordKey=(value:string)=>value.trim().toLocaleLowerCase('es').normalize('NFC').replace(/[.!?¿¡]+$/g,'').replace(/\s+/g,' ');
export const lessonWordInput=z.object({
  date:z.iso.date(),lessonId:z.string().min(1).max(100).optional(),
  title:z.string().trim().max(200).default(''),topic:z.string().trim().min(1).max(200).default('Повседневное'),
  text:z.string().trim().min(1).max(10000),
});
export function addLessonWord(state:AppState,input:z.infer<typeof lessonWordInput>):LessonWordResult {
  const parsed=parseCardPairs(input.text);
  if(parsed.cards.length!==1||parsed.issues.length)throw new AppError(400,'Введите одну пару: испанское слово — русский перевод. Например: el barrio — район.');
  const pair=parsed.cards[0];
  if(pair.es.length>4000||pair.ru.length>4000)throw new AppError(400,'Слово и перевод должны быть не длиннее 4000 символов.');
  let lesson=input.lessonId?state.lessons.find(item=>item.id===input.lessonId):state.lessons.find(item=>item.date===input.date);
  if(input.lessonId&&!lesson)throw new AppError(404,'Урок не найден. Выберите урок заново.');
  if(lesson&&lesson.date!==input.date)throw new AppError(400,'Дата не совпадает с выбранным уроком. Выберите урок заново.');
  if(!lesson){lesson={id:id(),date:input.date,title:input.title||'Урок',status:'planned',note:'',cardIds:[]};state.lessons.push(lesson);}
  let card=state.cards.find(item=>wordKey(item.es)===wordKey(pair.es));
  const created=!card;
  if(!card){
    const label=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(input.date));
    card={id:id(),es:pair.es,ru:pair.ru,type:/\s/.test(pair.es)?'chunk':'word',topic:input.topic,register:'neutral',source:lesson.title+' · '+label,examples:[],enabled:true,focused:false,stage:0,due:new Date(0).toISOString(),seen:0,correct:0} satisfies Card;
    state.cards.push(card);
    if(!state.plan.topics.includes(card.topic))state.plan.topics.push(card.topic);
  }
  lesson.cardIds=[...new Set([...(lesson.cardIds||[]),card.id])];
  lesson.status='held';
  return {lessonId:lesson.id,cardId:card.id,created,translationKept:!created&&wordKey(card.ru)!==wordKey(pair.ru),enabled:card.enabled};
}

export const lessonWordsInput=lessonWordInput.extend({text:z.string().trim().min(1).max(200000)});
export function addLessonWords(state:AppState,input:z.infer<typeof lessonWordsInput>){
 const parsed=parseCardPairs(input.text);
 if(parsed.issues.length)throw new AppError(400,'Проверьте строки: '+parsed.issues.map(issue=>issue.line).join(', ')+'. Нужны пары «слово — перевод».');
 if(!parsed.cards.length||parsed.cards.length>100)throw new AppError(400,'Добавьте от 1 до 100 слов за один раз.');
 const results=parsed.cards.map(pair=>addLessonWord(state,{...input,text:pair.es+' — '+pair.ru}));
 return {lessonId:results[0].lessonId,added:results.filter(result=>result.created).length,reused:results.filter(result=>!result.created).length,translationKept:results.filter(result=>result.translationKept).length,disabled:results.filter(result=>!result.enabled).length};
}
