import type {AppState,Attempt,PracticeFormat,PracticeSession} from './types';
import {madridDay,practiceStreak} from './study-stats';
export const practiceFormatNames:Record<PracticeFormat,string>={seventeen:'Упражнения формат 17 языков',duolingo:'Упражнение формат дуолинго',anki:'Формат Анки',quizlet:'Формат Quizlet'};
export const practiceFormatIds:PracticeFormat[]=['seventeen','duolingo','anki','quizlet'];
export function attemptFormat(attempt:Attempt):PracticeFormat|undefined{return attempt.format||(attempt.id.startsWith('mixed:')?'seventeen':attempt.id.startsWith('lingva:')?'duolingo':undefined);}
export function practiceProgress(state:AppState,now=new Date()){
 const valid=state.attempts.filter(attempt=>Date.parse(attempt.at)<=+now&&attemptFormat(attempt));const today=madridDay(now),sessions=state.practiceSessions||[];
 const formats=practiceFormatIds.map(format=>{
  const attempts=valid.filter(attempt=>attemptFormat(attempt)===format),latest=new Map<string,Attempt>();for(const attempt of attempts)if(attempt.kind==='card'&&attempt.cardId){const previous=latest.get(attempt.cardId);if(!previous||previous.at<=attempt.at)latest.set(attempt.cardId,attempt);}
  let learned=0,difficult=0,learning=0;for(const [id,attempt] of latest){const card=state.cards.find(card=>card.id===id),stage=attempt.stageAfter??card?.stage??0;if(attempt.difficult??(attempt.correct===false||stage===0&&!!card&&card.seen>card.correct))difficult++;else if(stage>=4)learned++;else learning++;}
  return {format,attempts:attempts.length,words:latest.size,learned,difficult,learning,xp:attempts.reduce((sum,a)=>sum+(a.xp||0),0),today:attempts.filter(a=>madridDay(a.at)===today).length,todayXp:attempts.filter(a=>madridDay(a.at)===today).reduce((sum,a)=>sum+(a.xp||0),0),streak:practiceStreak(attempts,now),completed:sessions.filter(session=>session.format===format&&session.finishedAt).length};
 });
 return {formats,xp:formats.reduce((sum,format)=>sum+format.xp,0),streak:practiceStreak(valid,now),todayXp:formats.reduce((sum,format)=>sum+format.todayXp,0),history:sessions.slice().sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,8).map(session=>sessionSummary(state,session))};
}
function sessionSummary(state:AppState,session:PracticeSession){const attempts=state.attempts.filter(attempt=>attempt.sessionId===session.id&&attempt.format===session.format),words=new Set(attempts.filter(a=>a.kind==='card'&&a.cardId).map(a=>a.cardId));return {...session,answers:attempts.length,words:words.size,xp:attempts.reduce((sum,attempt)=>sum+(attempt.xp||0),0),difficult:new Set(attempts.filter(a=>a.difficult&&a.cardId).map(a=>a.cardId)).size};}
