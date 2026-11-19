import {randomUUID} from 'node:crypto';
import type {AppState} from '../src/types.js';
import type {QuizletDirection,QuizletMode,QuizletTask,QuizletStep,QuizletResult} from '../src/quizlet-types.js';
import {practiceChoices,choiceLabel} from '../src/practice-choices.js';
import {wordKey} from './lesson-words.js';
import {AppError} from './ai.js';
import {review} from './domain.js';
import {recordPractice,finishPractice} from './practice-rewards.js';

interface Task extends QuizletTask {round:number;es:string;ru:string;expected:string;matches?:boolean}
interface Session {owner:string;expires:number;mode:QuizletMode;tasks:Task[];index:number;words:number;revealed:boolean;completed:Set<string>;steps:Set<string>;scheduled:Set<string>;mistakes:Set<string>;results:QuizletResult[];cache:Map<number,{key:string;result:QuizletStep}>;answered:boolean}
export interface QuizletSelection {mode:QuizletMode;direction:QuizletDirection;topic?:string;lessonId?:string;limit:number}
const shuffle=<T>(values:T[])=>values.map(value=>({value,order:Math.random()})).sort((a,b)=>a.order-b.order).map(item=>item.value);
function writtenCorrect(expected:string,value:string){const normalize=(text:string)=>wordKey(text).replace(/^[¿¡]+/,'');const key=normalize(value);return normalize(expected)===key||expected.split(/[;\n]|\s+\/\s+/).some(variant=>normalize(variant)===key);}
export class QuizletSessions {
 private sessions=new Map<string,Session>();
 start(owner:string,state:AppState,input:QuizletSelection){
  for(const [id,session] of this.sessions)if(session.expires<Date.now())this.sessions.delete(id);
  const own=[...this.sessions].filter(([,session])=>session.owner===owner);if(own.length>=10)this.sessions.delete(own[0][0]);
  const lesson=input.lessonId?state.lessons.find(item=>item.id===input.lessonId):undefined;if(input.lessonId&&!lesson)throw new AppError(404,'Урок не найден в этом кабинете.');
  const cards=shuffle(state.cards.filter(card=>card.enabled&&card.es.trim()&&card.ru.trim()&&(!input.topic||card.topic===input.topic)&&(!lesson||lesson.cardIds?.includes(card.id)))).slice(0,input.limit);
  if(!cards.length)throw new AppError(400,'Здесь пока нет слов с переводом. Выберите другую тему или урок.');
  const rounds=input.mode==='learn'?2:1,tasks:Task[]=[];
  for(let round=0;round<rounds;round++)cards.forEach((card,index)=>{
   const direction=input.direction==='mixed'?(index+round)%2===0?'es-ru':'ru-es':input.direction;
   let kind:Task['kind']=input.mode==='cards'?'flash':input.mode==='learn'?(round===0?'choice':'write'):index%3===0?'choice':index%3===1?'write':'boolean';
   const choices=practiceChoices(cards,card,direction);if(kind==='choice'&&choices.length<2)kind='write';
   const matches=Math.random()<.5,alternative=choices.find(item=>item.id!==card.id),statement=kind==='boolean'?choiceLabel(!matches&&alternative?alternative:card,direction):undefined;
   tasks.push({cardId:card.id,kind,direction,prompt:direction==='es-ru'?card.es:card.ru,expected:choiceLabel(card,direction),es:card.es,ru:card.ru,round,...kind==='choice'?{options:choices.map(item=>({id:item.id,label:choiceLabel(item,direction)}))}:{},...kind==='boolean'?{statement,matches:!alternative||matches}:{}});
  });
  const id=randomUUID(),session:Session={owner,expires:Date.now()+7200000,mode:input.mode,tasks,index:0,words:cards.length,revealed:false,completed:new Set(),steps:new Set(),scheduled:new Set(),mistakes:new Set(),results:[],cache:new Map(),answered:false};this.sessions.set(id,session);return this.view(id,session);
 }
 private get(owner:string,id:string){const session=this.sessions.get(id);if(!session||session.owner!==owner||session.expires<Date.now())throw new AppError(404,'Сессия завершена. Начните новую практику.');return session;}
 private view(id:string,s:Session):QuizletStep {const task=s.tasks[s.index];return {id,mode:s.mode,index:s.index,totalWords:s.words,completedWords:s.completed.size,correctFirst:new Set(s.results.filter(result=>result.correct&&!s.mistakes.has(result.cardId)).map(result=>result.cardId)).size,remaining:s.tasks.length-s.index,answered:s.answered,task:task?{cardId:task.cardId,kind:task.kind,direction:task.direction,prompt:task.prompt,options:task.options,statement:task.statement}:null,...s.revealed&&task?{reveal:task.expected}:{},...s.answered&&s.mode!=='test'?{feedback:s.results.at(-1)}:{},...!task?{results:s.results}:{}};}
 reveal(owner:string,id:string,index:number){const s=this.get(owner,id),task=s.tasks[index];if(index!==s.index||task?.kind!=='flash')throw new AppError(409,'Эта карточка уже сменилась.');s.revealed=true;return this.view(id,s);}
 answer(owner:string,input:{id:string;index:number;value:string;seconds:number},mutate:<T>(fn:(state:AppState)=>T)=>T):QuizletStep {
  const s=this.get(owner,input.id),cached=s.cache.get(input.index);if(cached){if(cached.key!==input.value)throw new AppError(409,'Ответ уже сохранён.');return cached.result;}
  if(input.index!==s.index||s.answered)throw new AppError(409,'Задание уже сменилось.');const task=s.tasks[s.index];if(!task)throw new AppError(409,'Практика уже завершена.');
  if(task.kind==='flash'&&(!s.revealed||!['yes','no'].includes(input.value)))throw new AppError(400,'Сначала покажите ответ и оцените себя.');
  if(task.kind==='choice'&&!task.options?.some(option=>option.id===input.value))throw new AppError(400,'Выберите предложенный вариант.');
  if(task.kind==='boolean'&&!['yes','no'].includes(input.value))throw new AppError(400,'Выберите «Верно» или «Неверно».');
  const correct=task.kind==='flash'?input.value==='yes':task.kind==='boolean'?(input.value==='yes')===task.matches:task.kind==='choice'?task.options!.find(option=>option.id===input.value)!.label===task.expected:writtenCorrect(task.expected,input.value);
  const response:QuizletResult={cardId:task.cardId,prompt:task.prompt,expected:task.expected,answer:task.kind==='flash'?(correct?'Вспомнил':'Не вспомнил'):task.kind==='boolean'?(input.value==='yes'?'Верно':'Неверно'):task.kind==='choice'?task.options!.find(option=>option.id===input.value)!.label:input.value,correct,direction:task.direction};
  const stepKey=task.cardId+':'+task.round,complete=s.mode!=='learn'||correct&&(task.round===0?s.steps.has(task.cardId+':1'):s.steps.has(task.cardId+':0'));
  const schedule=!s.scheduled.has(task.cardId)&&(!correct||complete),retry=s.mode==='learn'&&!correct;
  if(retry&&s.tasks.length>=1000)throw new AppError(409,'Сессия стала слишком длинной. Сохранённые ответы остались в кабинете; начните новую.');
  mutate(state=>{
   const card=state.cards.find(card=>card.id===task.cardId);if(!card?.enabled||card.es!==task.es||card.ru!==task.ru)throw new AppError(409,'Словарь изменён. Начните практику заново.');
   if(schedule)review(card,correct);
   recordPractice(state,{id:'quizlet:'+input.id+':'+input.index,kind:'card',cardId:card.id,topic:card.topic,at:new Date().toISOString(),correct,seconds:input.seconds,answer:response.answer},'quizlet',input.id,complete);
   if(!retry&&s.index===s.tasks.length-1)finishPractice(state,input.id);
  });
  if(schedule)s.scheduled.add(task.cardId);if(!correct)s.mistakes.add(task.cardId);if(correct)s.steps.add(stepKey);if(complete)s.completed.add(task.cardId);if(retry)s.tasks.push({...task});s.results.push(response);s.answered=true;
  const result=this.view(input.id,s);s.cache.set(input.index,{key:input.value,result});return result;
 }
 next(owner:string,id:string,index:number){const s=this.get(owner,id);if(index===s.index-1)return this.view(id,s);if(index!==s.index||!s.answered)throw new AppError(409,'Сначала ответьте на задание.');s.index++;s.revealed=false;s.answered=false;return this.view(id,s);}
}
