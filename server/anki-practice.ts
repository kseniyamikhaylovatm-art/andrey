import {randomUUID} from 'node:crypto';
import type {AppState,Card} from '../src/types.js';
import {ankiRatings,ankiSchedule,reviewAnki,type AnkiRating} from '../src/anki-schedule.js';
import {AppError} from './ai.js';
import {mixedTasks} from './mixed-practice.js';
export interface AnkiStep {id:string;index:number;total:number;cardId:string|null;delays:Record<AnkiRating,number>;last?:{cardId:string;rating:AnkiRating;delay:number}}
interface Session {owner:string;expires:number;cards:string[];index:number;cache:Map<number,{rating:AnkiRating;result:AnkiStep}>}
export class AnkiSessions {
 private sessions=new Map<string,Session>();
 private view(id:string,session:Session,state:AppState):AnkiStep{const card=state.cards.find(card=>card.id===session.cards[session.index]);if(session.index<session.cards.length&&!card?.enabled)throw new AppError(409,'Карточка изменена. Начните тренировку заново.');return {id,index:session.index,total:session.cards.length,cardId:card?.id||null,delays:Object.fromEntries(ankiRatings.map(rating=>[rating,card?ankiSchedule(card,rating).delay:0])) as Record<AnkiRating,number>};}
 start(owner:string,state:AppState,input:{mode:'new'|'review'|'focus'|'all';topic?:string;lessonId?:string}){for(const [id,session] of this.sessions)if(session.expires<Date.now())this.sessions.delete(id);const own=[...this.sessions].filter(([,session])=>session.owner===owner);if(own.length>=10)this.sessions.delete(own[0][0]);const session:Session={owner,expires:Date.now()+7200000,cards:mixedTasks(state,{...input,includeVerbs:false}).map(task=>task.cardId),index:0,cache:new Map()},id=randomUUID();this.sessions.set(id,session);return this.view(id,session,state);}
 answer(owner:string,id:string,index:number,rating:AnkiRating,mutate:<T>(fn:(state:AppState)=>T)=>T,record:(state:AppState,card:Card,last:boolean)=>void){
  const session=this.sessions.get(id);if(!session||session.owner!==owner||session.expires<Date.now())throw new AppError(404,'Сессия завершена. Начните новую тренировку.');const cached=session.cache.get(index);if(cached){if(cached.rating!==rating)throw new AppError(409,'Оценка уже сохранена.');return cached.result;}if(index!==session.index||!session.cards[index])throw new AppError(409,'Карточка уже сменилась.');
  const result=mutate(state=>{const card=state.cards.find(card=>card.id===session.cards[index]);if(!card?.enabled)throw new AppError(409,'Карточка недоступна.');const scheduled=reviewAnki(card,rating);record(state,card,index+1===session.cards.length);const next={...session,index:index+1};return {...this.view(id,next,state),last:{cardId:card.id,rating,delay:scheduled.delay}};});session.index++;session.cache.set(index,{rating,result});return result;
 }
}
