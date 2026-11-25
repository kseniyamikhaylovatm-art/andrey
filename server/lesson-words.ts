import {z} from 'zod';
import type {AppState,Card,Example,Lesson,LessonWordResult} from '../src/types.js';
import {AppError} from './ai.js';
import {id} from './domain.js';
import {parseCardPairs} from './card-import.js';

export const wordKey=(value:string)=>value.trim().toLocaleLowerCase('es').normalize('NFC').replace(/[.!?¿¡]+$/g,'').replace(/\s+/g,' ');
const lessonDateFormat=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'});
const lessonExample=z.object({es:z.string().trim().min(1).max(4000),ru:z.string().trim().max(4000).default('')});
const lessonTopic=z.string().trim().min(1).max(200);
const lessonWordDetails=z.object({
  date:z.iso.date(),lessonId:z.string().min(1).max(100).optional(),
  title:z.string().trim().max(200).default(''),topic:lessonTopic.default('Повседневное'),
});
const lessonPair=z.object({es:z.string().trim().min(1).max(4000),ru:z.string().trim().min(1).max(4000),example:lessonExample.optional(),topic:lessonTopic.optional()});
export const lessonWordInput=z.union([
  lessonWordDetails.extend({pair:lessonPair}),
  lessonWordDetails.extend({text:z.string().trim().min(1).max(10000),example:lessonExample.optional()}),
]);
export function addLessonWord(state:AppState,input:z.infer<typeof lessonWordInput>):LessonWordResult {
  if('pair' in input)return saveSingleLessonWord(state,input,input.pair);
  const parsed=parseCardPairs(input.text);
  if(parsed.cards.length!==1||parsed.issues.length)throw new AppError(400,'Введите одну пару: испанское слово — русский перевод. Например: el barrio — район.');
  return saveSingleLessonWord(state,input,{...parsed.cards[0],example:input.example});
}

type LessonDetails=z.infer<typeof lessonWordDetails>;
type LessonPair={es:string;ru:string;example?:Example;topic?:string};

function saveSingleLessonWord(state:AppState,input:LessonDetails,pair:LessonPair){
  const lesson=findLesson(state,input);
  const cards=cardsByWord(state.cards);
  const ids=new Set(lesson.cardIds);
  const result=saveLessonWord(state,lesson,input.topic,pair,cards,ids,new Set(state.plan.topics));
  lesson.cardIds=[...ids];
  return result;
}

function cardsByWord(cards:Card[]){
  const byWord=new Map<string,Card>();
  for(const card of cards){
    const key=wordKey(card.es);
    if(!byWord.has(key))byWord.set(key,card);
  }
  return byWord;
}

function findLesson(state:AppState,input:LessonDetails){
  let lesson=input.lessonId?state.lessons.find(item=>item.id===input.lessonId):state.lessons.find(item=>item.date===input.date);
  if(input.lessonId&&!lesson)throw new AppError(404,'Урок не найден. Выберите урок заново.');
  if(lesson&&lesson.date!==input.date)throw new AppError(400,'Дата не совпадает с выбранным уроком. Выберите урок заново.');
  if(!lesson){lesson={id:id(),date:input.date,title:input.title||'Урок',status:'planned',note:'',cardIds:[]};state.lessons.push(lesson);}
  return lesson;
}

function saveLessonWord(state:AppState,lesson:Lesson,defaultTopic:string,pair:LessonPair,cards:Map<string,Card>,ids:Set<string>,topics:Set<string>):LessonWordResult {
  const key=wordKey(pair.es);
  let card=cards.get(key);
  const created=!card;
  if(!card){
    const label=lessonDateFormat.format(new Date(lesson.date));
    card={id:id(),es:pair.es,ru:pair.ru,type:/\s/.test(pair.es)?'chunk':'word',topic:pair.topic||defaultTopic,register:'neutral',source:lesson.title+' · '+label,examples:[],enabled:true,focused:false,stage:0,due:new Date(0).toISOString(),seen:0,correct:0} satisfies Card;
    state.cards.push(card);
    cards.set(key,card);
  }
  if(pair.topic)card.topic=pair.topic;
  if(!topics.has(card.topic)){
    topics.add(card.topic);
    state.plan.topics.push(card.topic);
  }
  if(pair.example){
    const example=pair.example;
    const existing=card.examples.find(item=>!item.level&&!item.tense&&wordKey(item.es)===wordKey(example.es)&&
      (!item.ru||!example.ru||wordKey(item.ru)===wordKey(example.ru)));
    if(existing){
      if(!existing.ru)existing.ru=example.ru;
    }else{
      if(card.examples.length>=20)throw new AppError(400,'В карточке «'+card.es+'» уже 20 примеров. Удалите лишний пример в редакторе карточки.');
      card.examples.unshift(example);
    }
  }
  ids.add(card.id);
  lesson.status='held';
  return {lessonId:lesson.id,cardId:card.id,created,translationKept:!created&&wordKey(card.ru)!==wordKey(pair.ru),enabled:card.enabled};
}

export const lessonWordsInput=z.union([
  lessonWordDetails.extend({rows:z.array(lessonPair).min(1)}),
  lessonWordDetails.extend({text:z.string().trim().min(1)}),
]);
export function addLessonWords(state:AppState,input:z.infer<typeof lessonWordsInput>){
 const rows='rows' in input?input.rows:parseLessonPairs(input.text);
 const lesson=findLesson(state,input);
 const cards=cardsByWord(state.cards),ids=new Set(lesson.cardIds),topics=new Set(state.plan.topics);
 const results=rows.map(pair=>saveLessonWord(state,lesson,input.topic,pair,cards,ids,topics));
 lesson.cardIds=[...ids];
 return {lessonId:results[0].lessonId,added:results.filter(result=>result.created).length,reused:results.filter(result=>!result.created).length,translationKept:results.filter(result=>result.translationKept).length,disabled:results.filter(result=>!result.enabled).length};
}

function parseLessonPairs(text:string){
 const parsed=parseCardPairs(text);
 if(parsed.issues.length)throw new AppError(400,'Проверьте строки: '+parsed.issues.map(issue=>issue.line).join(', ')+'. Нужны пары «слово — перевод».');
 if(!parsed.cards.length)throw new AppError(400,'Добавьте хотя бы одну запись.');
 return parsed.cards;
}
