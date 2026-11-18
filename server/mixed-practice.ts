import {randomUUID} from 'node:crypto';
import type {AppState,Card} from '../src/types.js';
import type {MixedStep,MixedTask} from '../src/mixed-practice-types.js';
import {practiceChoices,choiceCorrect} from '../src/practice-choices.js';
import {conjugate} from './domain.js';
import {AppError} from './ai.js';
type Selection={mode:'new'|'review'|'focus'|'all';topic?:string;lessonId?:string;includeVerbs:boolean};
export interface MixedRecord {id:string;cardId:string;correct:boolean;kind:'card'|'verb';updateSchedule:boolean;answer:string;tense?:'presente';verb?:string}
interface Session {owner:string;expires:number;tasks:MixedTask[];index:number;correctFirst:number;answered:boolean;wrongIds:Set<string>;responses:Map<string,boolean>;feedback?:MixedStep['feedback']}
const shuffle=<T>(list:T[])=>{const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
export function mixedTasks(state:AppState,input:Selection,now=Date.now()):MixedTask[]{
 const lesson=input.lessonId?state.lessons.find(lesson=>lesson.id===input.lessonId):undefined;if(input.lessonId&&!lesson)throw new AppError(404,'Урок не найден в этом кабинете.');
 const available=state.cards.filter(card=>card.enabled&&(!input.topic||card.topic===input.topic)&&(!lesson||lesson.cardIds?.includes(card.id))&&(input.mode==='new'?card.seen===0:input.mode==='review'?card.seen>0&&Date.parse(card.due)<=now:input.mode==='focus'?card.focused:true));
 const selected=shuffle(available).slice(0,lesson?available.length:10);if(!selected.length)throw new AppError(400,'В выбранном режиме пока нет слов для тренировки.');
 const tasks:MixedTask[]=selected.map((card,index)=>{if(index%3===0)return {kind:'recall',cardId:card.id};const direction=index%3===1?'es-ru':'ru-es',options=practiceChoices(state.cards,card,direction);return options.length>=2?{kind:'choice',cardId:card.id,direction,optionIds:options.map(option=>option.id)}:{kind:'recall',cardId:card.id};});
 if(input.includeVerbs){for(const card of selected){const verb=card.es.trim().toLocaleLowerCase('es');if(!/^[a-záéíóúüñ]+(?:ar|er|ir)(?:se)?$/.test(verb)&&!['ir','ser'].includes(verb))continue;const forms=state.verbTables[verb]?.presente||conjugate(verb,'presente');if(forms?.length===6){tasks.push({kind:'verb',cardId:card.id,forms:[...forms],tense:'presente'});break;}}}
 return tasks;
}
export class MixedPracticeSessions {
 private sessions=new Map<string,Session>();
 start(owner:string,state:AppState,input:Selection):MixedStep{
  for(const [id,session] of this.sessions)if(session.expires<Date.now())this.sessions.delete(id);
  const own=[...this.sessions].filter(([,session])=>session.owner===owner);if(own.length>=10)this.sessions.delete(own[0][0]);
  const tasks=mixedTasks(state,input),id=randomUUID();const session:Session={owner,expires:Date.now()+2*3600000,tasks,index:0,correctFirst:0,answered:false,wrongIds:new Set(),responses:new Map()};this.sessions.set(id,session);return this.view(id,session);
 }
 private get(owner:string,id:string){const session=this.sessions.get(id);if(!session||session.owner!==owner)throw new AppError(404,'Тренировка не найдена. Начните новую.');if(session.expires<Date.now()){this.sessions.delete(id);throw new AppError(410,'Время тренировки истекло. Сохранённые ответы остались в кабинете.');}return session;}
 private view(id:string,session:Session):MixedStep{return {id,index:session.index,total:session.tasks.length,correctFirst:session.correctFirst,task:session.tasks[session.index]||null,answered:session.answered,wrongIds:[...session.wrongIds],feedback:session.feedback};}
 answer(owner:string,id:string,index:number,input:{correct?:boolean;answerCardId?:string},state:AppState,record:(value:MixedRecord)=>void):MixedStep{
  const session=this.get(owner,id),task=session.tasks[index];if(index!==session.index||!task)throw new AppError(409,'Задание уже сменилось. Обновите тренировку.');
  const card=state.cards.find(card=>card.id===task.cardId);if(!card?.enabled)throw new AppError(409,'Слово изменено или выключено. Начните тренировку заново.');
  let correct:boolean,key:string;
  if(task.kind==='choice'){if(!input.answerCardId||!task.optionIds?.includes(input.answerCardId))throw new AppError(400,'Выберите один из предложенных вариантов.');const selected=state.cards.find(card=>card.id===input.answerCardId);if(!selected?.enabled)throw new AppError(409,'Вариант больше не доступен. Начните тренировку заново.');correct=choiceCorrect(card,selected,task.direction!);key=selected.id;}
  else{if(typeof input.correct!=='boolean')throw new AppError(400,'Сначала проверьте себя и выберите крестик или галочку.');correct=input.correct;key='self:'+correct;}
  if(session.responses.has(key))return {...this.view(id,session),feedback:{correct:session.responses.get(key)!,firstTry:session.responses.size===1&&session.wrongIds.size===0,selectedId:input.answerCardId,duplicate:true}};
  if(session.answered)throw new AppError(409,'Ответ уже сохранён. Перейдите к следующему заданию.');
  const first=session.responses.size===0;
  record({id:'mixed:'+id+':'+index+':'+key,cardId:card.id,correct,kind:task.kind==='verb'?'verb':'card',updateSchedule:first&&task.kind!=='verb',answer:task.kind==='choice'?input.answerCardId!:correct?'Самооценка: вспомнил':'Самооценка: не вспомнил',...task.kind==='verb'?{tense:task.tense,verb:card.es.trim().toLocaleLowerCase('es')}:{}});
  session.responses.set(key,correct);if(!correct&&input.answerCardId)session.wrongIds.add(input.answerCardId);
  if(first&&correct)session.correctFirst++;
  session.answered=task.kind!=='choice'||correct;session.feedback={correct,firstTry:first&&correct,selectedId:input.answerCardId};return this.view(id,session);
 }
 next(owner:string,id:string,index:number){const session=this.get(owner,id);if(index===session.index-1)return this.view(id,session);if(index!==session.index||!session.answered)throw new AppError(409,'Сначала завершите текущее задание.');session.index++;session.answered=false;session.wrongIds=new Set();session.responses=new Map();session.feedback=undefined;return this.view(id,session);}
}
