import type {MonthlyPlan} from './types';
export const languageAspects={monologue:'Речь · монолог',dialog:'Речь · диалог',listening:'Слух',reading:'Чтение',writing:'Письмо',pronunciation:'Произношение',grammar:'Грамматика',vocabulary:'Словарный запас'} as const;
export type LanguageAspect=keyof typeof languageAspects;
export const aspectIds=Object.keys(languageAspects) as LanguageAspect[];
export function monthLater(date:string){const [year,month,day]=date.split('-').map(Number),next=new Date(Date.UTC(year,month,1));const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();next.setUTCDate(Math.min(day,last));return next.toISOString().slice(0,10);}
export function monthTitle(month:string){return new Intl.DateTimeFormat('ru',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));}
export const baselineMethods={test:'Тест или проверочное задание',notes:'Заметки преподавателя',other:'Другая проверка'} as const;

export function monthlyTimeline(plans:MonthlyPlan[],day:string){
 const ordered=plans.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const latest=ordered.at(-1);
 const active=latest&&!latest.archivedAt&&latest.reviewOn>day?latest:undefined;
 return {active,latest,archive:ordered.filter(plan=>plan.id!==active?.id).reverse()};
}
export function pointAText(plan:MonthlyPlan){return plan.pointA??plan.baselines.map(item=>languageAspects[item.aspect]+': '+item.task+'\n'+item.result+(item.url?'\n'+item.url:'')).join('\n\n');}
