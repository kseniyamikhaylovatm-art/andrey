import type {AppState,Attempt} from './types';

const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
export function madridDay(value:string|Date){return dayFormatter.format(new Date(value));}
export function practiceStreak(attempts:Attempt[],now=new Date()){
  const days=new Set(attempts.filter(a=>Date.parse(a.at)<=+now).map(a=>madridDay(a.at)));
  let anchor=Date.parse(madridDay(now)+'T00:00:00Z'),count=0;
  const key=(value:number)=>new Date(value).toISOString().slice(0,10);
  if(!days.has(key(anchor)))anchor-=86400000;
  while(days.has(key(anchor))){count++;anchor-=86400000;}
  return count;
}
export function studyStats(state:AppState,now=new Date()){
  const week=state.attempts.filter(a=>{const age=+now-Date.parse(a.at);return age>=0&&age<7*86400000;});
  const groups={learned:0,learning:0,difficult:0,new:0};
  for(const card of state.cards){
    if(card.stage>=4)groups.learned++;
    else if(card.seen===0)groups.new++;
    else if(card.seen>card.correct)groups.difficult++;
    else groups.learning++;
  }
  return {
    week,groups,streak:practiceStreak(state.attempts,now),
    due:state.cards.filter(c=>c.enabled&&c.seen>0&&Date.parse(c.due)<=+now).length,
    fresh:state.cards.filter(c=>c.enabled&&c.seen===0).length,
    minutes:Math.round(week.reduce((n,a)=>n+a.seconds,0)/60),
  };
}
