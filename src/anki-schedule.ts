import type {Card} from './types';
export type AnkiRating='again'|'hard'|'good'|'easy';
export const ankiRatings:AnkiRating[]=['again','hard','good','easy'];
export const ankiRatingNames:Record<AnkiRating,string>={again:'Ещё раз',hard:'Трудно',good:'Хорошо',easy:'Легко'};
const days=[0,1,2,4,8,16,32];
/** A small explicit scheduler for this platform, not Anki's FSRS implementation. */
export function ankiSchedule(card:Card,rating:AnkiRating){
 const learning=card.seen===0||card.stage===0||card.ankiLearning===true;
 if(rating==='again')return {stage:0,learning:true,step:0,delay:60000};
 if(rating==='hard')return {stage:learning?0:card.stage,learning,step:card.ankiStep||0,delay:learning?360000:Math.max(1,Math.round(days[card.stage]*.6))*86400000};
 if(rating==='good'&&learning&&(card.ankiStep||0)===0)return {stage:0,learning:true,step:1,delay:600000};
 const stage=learning?(rating==='easy'?3:1):Math.min(6,card.stage+(rating==='easy'?2:1));
 return {stage,learning:false,step:0,delay:days[stage]*86400000};
}
export function intervalLabel(delay:number){if(delay<3600000)return Math.round(delay/60000)+' мин';if(delay<86400000)return Math.round(delay/3600000)+' ч';return Math.round(delay/86400000)+' дн.';}
export function reviewAnki(card:Card,rating:AnkiRating,now=new Date()){const next=ankiSchedule(card,rating);card.seen++;if(rating!=='again')card.correct++;card.stage=next.stage;card.ankiLearning=next.learning;card.ankiStep=next.step;card.due=new Date(+now+next.delay).toISOString();return next;}
