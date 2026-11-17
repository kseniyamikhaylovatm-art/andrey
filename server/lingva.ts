import {randomUUID} from 'node:crypto';
import type {AppState,Card} from '../src/types.js';
import {AppError} from './ai.js';
export interface Exercise {id:string;cardId:string;kind:string;title:string;prompt:string;expected:string;choices?:string[];tiles?:string[];audio?:string}
const shuffle=<T>(items:T[])=>items.map(value=>({value,key:Math.random()})).sort((a,b)=>a.key-b.key).map(item=>item.value);
export const answerKey=(text:string)=>text.normalize('NFC').toLocaleLowerCase('es').replace(/[¿¡.,!?;:«»"“”]/g,'').replace(/\s+/g,' ').trim();
export function exercises(cards:Card[]):Exercise[]{
 if(!cards.length)throw new AppError(400,'В выбранной теме пока нет включённых слов.');
 const pool=shuffle(cards),result:Exercise[]=[];
 for(let i=0;i<13;i++){
  const card=pool[i%pool.length],format=i%6;
  const task:Exercise={id:randomUUID(),cardId:card.id,kind:'write',title:'Напишите по-испански',prompt:card.ru,expected:card.es};
  const options=(key:'es'|'ru')=>shuffle([...new Set([card[key],...shuffle(cards.filter(c=>c.id!==card.id)).map(c=>c[key])])].slice(0,4));
  if(format===0||format===1){const key=format===0?'ru':'es',choices=options(key);if(choices.length>1)Object.assign(task,{kind:'choice',title:format===0?'Выберите перевод':'Найдите испанское слово',prompt:format===0?card.es:card.ru,expected:card[key],choices});}
  if(format===3){const words=card.es.split(/\s+/);if(words.length>1)Object.assign(task,{kind:'tiles',title:'Соберите фразу по-испански',tiles:shuffle(words)});}
  if(format===4){const example=card.examples.find(e=>e.es.toLocaleLowerCase('es').includes(card.es.toLocaleLowerCase('es')));const sentence=example?.es||card.es;const words=sentence.split(/\s+/);if(words.length>1){const index=Math.floor(Math.random()*words.length),expected=words[index];words[index]='_____';Object.assign(task,{kind:'gap',title:'Вставьте пропущенное слово',prompt:words.join(' ')+'\n'+(example?.ru||card.ru),expected});} }
  if(format===5)Object.assign(task,{kind:'listen',title:'Напишите, что услышали',prompt:card.ru,audio:card.es,expected:card.es});
  result.push(task);
 }
 return result;
}
export const publicExercise=({expected,...task}:Exercise)=>task;
interface Session {owner:string;until:number;queue:Exercise[];index:number;correct:number;mistakes:number;cache:Map<number,unknown>}
export class LingvaSessions {
 private sessions=new Map<string,Session>();
 start(owner:string,state:AppState,topic?:string,lessonId?:string){
  for(const [key,value] of this.sessions)if(value.until<Date.now())this.sessions.delete(key);
  const owned=[...this.sessions].filter(([,s])=>s.owner===owner);if(owned.length>=10)this.sessions.delete(owned[0][0]);
  const lesson=lessonId?state.lessons.find(l=>l.id===lessonId):null;if(lessonId&&!lesson)throw new AppError(404,'Урок не найден.');
  const cards=state.cards.filter(c=>c.enabled&&(!topic||c.topic===topic)&&(!lessonId||lesson?.cardIds?.includes(c.id)));
  const queue=exercises(cards),id=randomUUID();this.sessions.set(id,{owner,until:Date.now()+2*3600000,queue,index:0,correct:0,mistakes:0,cache:new Map()});
  return {id,index:0,task:publicExercise(queue[0]),total:13};
 }
 answer(owner:string,id:string,index:number,answer:string,skip:boolean){
  const session=this.sessions.get(id);if(!session||session.owner!==owner||session.until<Date.now())throw new AppError(404,'Сессия завершена. Начните новую тренировку.');
  if(session.cache.has(index))return session.cache.get(index) as ReturnType<LingvaSessions['submit']>;
  if(index!==session.index||!session.queue[index])throw new AppError(409,'Задание уже изменилось. Начните новую тренировку.');
  return this.submit(session,index,answer,skip);
 }
 private submit(s:Session,index:number,answer:string,skip:boolean){
  const task=s.queue[index],correct=!skip&&answerKey(answer)===answerKey(task.expected);
  if(!correct)s.queue.push({...task,...skip&&task.kind==='listen'?{kind:'write',title:'Напишите по-испански',audio:undefined}:{},id:randomUUID()});
  if(index<13){if(correct)s.correct++;else s.mistakes++;}
  s.index++;
  const result={correct,expected:task.expected,cardId:task.cardId,index:s.index,task:s.queue[s.index]?publicExercise(s.queue[s.index]):null,total:13,initialCorrect:s.correct,mistakes:s.mistakes,repeat:s.index>=13,record:!skip};
  s.cache.set(index,result);return result;
 }
}
