import {z} from 'zod';
import type {Store} from './store.js';
import type {MonthlyPlan} from '../src/types.js';
import {AppError} from './ai.js';
import {aspectIds,monthLater,monthlyTimeline} from '../src/monthly-plan-utils.js';
import {madridDay} from '../src/study-stats.js';
const text=z.string().trim().max(4000),aspect=z.enum(aspectIds as [typeof aspectIds[number],...typeof aspectIds[number][]]);
const fields=z.object({layoutVersion:z.literal(2),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(month=>month>='2000-01'&&month<='2100-12'),goal:text.min(1),aspects:z.array(aspect).length(2,'Выберите два аспекта на месяц.').refine(items=>new Set(items).size===2,'Выберите два разных аспекта.'),skills:text,topics:text,situations:text,pointA:text,successCriteria:text,baselineDate:z.iso.date().refine(date=>date>='2000-01-01'&&date<=madridDay(new Date()),'Дата точки А не может быть в будущем.')});
type Role='teacher'|'student';
function criteriaPermission(role:Role,value:string,previous=''){if(role==='teacher'&&value!==previous)throw new AppError(403,'Критерии успеха заполняет ученик в своём кабинете.');}
export function createMonthlyPlan(store:Store,body:unknown,role:Role='teacher'){
 const {requestId,...input}=fields.extend({requestId:z.uuid()}).strict().parse(body);
 return store.mutate(state=>{
  state.monthlyPlans??=[];const prior=state.monthlyPlans.find(plan=>plan.id===requestId);
  if(prior){const same=Object.keys(input).every(key=>JSON.stringify(prior[key as keyof MonthlyPlan])===JSON.stringify(input[key as keyof typeof input]));if(!same)throw new AppError(409,'План уже сохранён. Обновите страницу.');return prior;}
  criteriaPermission(role,input.successCriteria);
  const now=new Date().toISOString(),day=madridDay(now);if(monthlyTimeline(state.monthlyPlans,day).active)throw new AppError(409,'Месячный план уже действует. Измените его, а следующий составим после '+monthlyTimeline(state.monthlyPlans,day).active!.reviewOn+'.');
  // Preserve previous periods even if their reflection has not been filled in yet.
  for(const plan of state.monthlyPlans)plan.archivedAt??=now;
  const plan:MonthlyPlan={...input,id:requestId,revision:1,startedOn:day,reviewOn:monthLater(day),createdAt:now,updatedAt:now,baselines:[],topicsSkills:[input.skills,input.topics,input.situations].filter(Boolean).join('\n')};state.monthlyPlans.push(plan);return plan;
 });
}
export function updateMonthlyPlan(store:Store,id:string,body:unknown,role:Role='teacher'){
 const {revision,...input}=fields.extend({revision:z.number().int().min(1)}).strict().parse(body);
 return store.mutate(state=>{const plan=state.monthlyPlans?.find(plan=>plan.id===id);if(!plan)throw new AppError(404,'План не найден.');if(plan.revision!==revision)throw new AppError(409,'План уже обновлён. Обновите страницу перед изменением.');if(monthlyTimeline(state.monthlyPlans||[],madridDay(new Date())).active?.id!==id)throw new AppError(409,'Этот период уже в архиве. Заполните новый план.');criteriaPermission(role,input.successCriteria,plan.successCriteria);
  Object.assign(plan,input,{revision:plan.revision+1,updatedAt:new Date().toISOString(),topicsSkills:[input.skills,input.topics,input.situations].filter(Boolean).join('\n')});return plan;
 });
}
export function reflectMonthlyPlan(store:Store,id:string,body:unknown){
 const input=z.object({revision:z.number().int().min(1),text:text.min(10),results:z.array(z.object({aspect,result:text.min(1)})).max(2).default([])}).strict().parse(body);
 return store.mutate(state=>{const plan=state.monthlyPlans?.find(plan=>plan.id===id);if(!plan)throw new AppError(404,'План не найден.');if(input.results.some(item=>!plan.aspects.includes(item.aspect))||new Set(input.results.map(item=>item.aspect)).size!==input.results.length)throw new AppError(400,'Результаты должны относиться к аспектам этого плана.');
  if(plan.reflection?.text===input.text&&JSON.stringify(plan.reflection.results)===JSON.stringify(input.results))return plan;
  if(plan.revision!==input.revision)throw new AppError(409,'Результаты уже изменены. Обновите страницу.');const now=new Date().toISOString();plan.reflection={text:input.text,results:input.results,submittedAt:plan.reflection?.submittedAt||now,updatedAt:now};plan.revision++;plan.updatedAt=now;return plan;
 });
}
