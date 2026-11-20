import {z} from 'zod';
import type {AppState} from '../src/types.js';
import {attendanceSchedules,attendanceWeek} from '../src/attendance-model.js';
import {madridDay} from '../src/study-stats.js';
import {id} from './domain.js';
import {AppError} from './ai.js';
export const attendanceDate=z.iso.date().refine(date=>date>='2000-01-01'&&date<='2100-12-31','Выберите дату с 2000 по 2100 год.');
export const scheduleInput=z.object({from:attendanceDate,days:z.array(z.number().int().min(1).max(7)).max(7).refine(days=>new Set(days).size===days.length,'Дни не должны повторяться.')}).strict();
export function saveAttendanceSchedule(state:AppState,name:string,body:unknown,now=new Date(),startedOn?:string){
 const input=scheduleInput.parse(body),schedules=attendanceSchedules(state,name,madridDay(now),startedOn);state.attendanceSchedules=[...schedules.filter(s=>s.from!==input.from),{...input,days:input.days.slice().sort((a,b)=>a-b)}].sort((a,b)=>a.from.localeCompare(b.from));return state.attendanceSchedules;
}
const slotInput=z.object({actualDate:attendanceDate,status:z.enum(['held','planned','missed','excused']),existingLessonId:z.string().min(1).max(100).optional(),note:z.string().max(8000).optional()}).strict();
export function saveAttendanceSlot(state:AppState,name:string,date:string,body:unknown,now=new Date(),startedOn?:string){
 attendanceDate.parse(date);const input=slotInput.parse(body),schedules=attendanceSchedules(state,name,madridDay(now),startedOn),slot=attendanceWeek(state,schedules,date,madridDay(now)).slots.find(slot=>slot.date===date);if(!slot)throw new AppError(400,'За эту дату нет урока в расписании. Проверьте дни занятий.');
 const source=state.lessons.find(l=>l.id===slot.lessonId),candidates=state.lessons.filter(l=>l.id!==source?.id&&l.date===input.actualDate&&(!l.attendanceDate||l.attendanceDate===date)&&l.status!=='cancelled');
 if(input.existingLessonId&&!state.lessons.some(l=>l.id===input.existingLessonId&&l.date===input.actualDate&&(!l.attendanceDate||l.attendanceDate===date)))throw new AppError(400,'Этот урок нельзя связать с выбранной датой.');
 if(!input.existingLessonId&&candidates.length>1&&source?.date!==input.actualDate)throw new AppError(409,'За новую дату есть несколько уроков. Выберите нужный в поле «Уже записанный урок».');
 const target=input.existingLessonId?state.lessons.find(l=>l.id===input.existingLessonId):source?.date!==input.actualDate&&candidates.length===1?candidates[0]:undefined;
 if(source?.status==='held'&&target&&target.id!==source.id&&!input.existingLessonId)throw new AppError(409,'За эту дату уже есть проведённый урок. Выберите существующий урок явно, чтобы объединить записи.');
 if(!target&&source?.date!==input.actualDate&&state.lessons.some(l=>l.date===input.actualDate&&l.attendanceDate&&l.attendanceDate!==date))throw new AppError(409,'Урок за эту дату уже связан с другой исходной датой. Одно занятие нельзя учитывать дважды. Для отдельного занятия сначала добавьте новую запись урока.');
 let lesson=target||source;if(!lesson){lesson={id:id(),date:input.actualDate,title:'Урок',status:'planned',note:''};state.lessons.push(lesson);}
 const alreadyHeld=!!target&&target.id!==source?.id&&target.status==='held';
 if(source&&source.id!==lesson.id){source.status='cancelled';source.attendanceExcused=true;delete source.attendanceDate;lesson.cardIds=[...new Set([...(lesson.cardIds||[]),...(source.cardIds||[])])];}
 lesson.attendanceDate=date;lesson.date=input.actualDate;lesson.status=input.status==='held'||alreadyHeld&&input.status==='planned'?'held':input.status==='planned'?'planned':'cancelled';if(input.status==='excused')lesson.attendanceExcused=true;else delete lesson.attendanceExcused;if(input.note!==undefined)lesson.note=[...new Set([target?.note,input.note].filter((note):note is string=>!!note))].join('\n');return lesson;
}
