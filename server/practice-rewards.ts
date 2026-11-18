import type {AppState,Attempt,PracticeFormat,PracticeSession} from '../src/types.js';
import {madridDay} from '../src/study-stats.js';
export function beginPractice(state:AppState,session:PracticeSession){state.practiceSessions??=[];if(!state.practiceSessions.some(item=>item.id===session.id))state.practiceSessions.push(session);}
export function recordPractice(state:AppState,attempt:Attempt,format:PracticeFormat,sessionId:string,completed:boolean){
 if(state.attempts.some(item=>item.id===attempt.id))return false;
 const day=madridDay(attempt.at),sameExercise=(item:Attempt)=>item.format===format&&item.cardId===attempt.cardId&&item.kind===attempt.kind&&(item.tense||'')===(attempt.tense||'');
 const rewarded=state.attempts.some(item=>sameExercise(item)&&(item.xp||0)>0&&madridDay(item.at)===day);
 const previousMistake=state.attempts.some(item=>item.format===format&&item.sessionId===sessionId&&item.cardId===attempt.cardId&&item.kind===attempt.kind&&item.correct===false);
 const card=state.cards.find(card=>card.id===attempt.cardId);
 state.attempts.push({...attempt,format,sessionId,completed,xp:completed&&!rewarded?10:0,stageAfter:card?.stage,difficult:attempt.rating==='hard'||attempt.rating==='again'||attempt.correct===false||previousMistake});return true;
}
export function finishPractice(state:AppState,id:string,at=new Date().toISOString()){const session=state.practiceSessions?.find(item=>item.id===id);if(session&&!session.finishedAt)session.finishedAt=at;}
