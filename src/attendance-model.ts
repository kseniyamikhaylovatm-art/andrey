import type {AppState,AttendanceSchedule,Lesson} from './types';
import {madridDay} from './study-stats';
export const attendanceDays=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
export const shortAttendanceDays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
export function addDays(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export const weekday=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay()||7;
export const weekStart=(date:string)=>addDays(date,1-weekday(date));
export const weekEnd=(date:string)=>addDays(weekStart(date),6);
export function knownAttendanceDays(name:string){const n=name.toLocaleLowerCase('ru');if(/андрей|andrey|andrei/.test(n)&&/таня|татьяна|tania|tanya|tatiana/.test(n))return [2,5,6];if(/александр|alexand|aleksand/.test(n))return [2,5];if(/алексей|alexey|aleksey|alexei|aleksei/.test(n))return [2];if(/п[её]тр|petr|pyotr|piotr|peter/.test(n))return [1,4];return [];}
export function attendanceSchedules(state:AppState,name:string,day:string,startedOn?:string):AttendanceSchedule[]{
 if(state.attendanceSchedules?.length)return state.attendanceSchedules.slice().sort((a,b)=>a.from.localeCompare(b.from));
 const days=knownAttendanceDays(name);return days.length?[{from:state.payments.map(p=>p.date).filter(date=>date<=day).sort()[0]||startedOn||day,days}]:[];
}
export function scheduleAt(schedules:AttendanceSchedule[],date:string){return schedules.filter(item=>item.from<=date).at(-1);}
export type AttendanceStatus='held'|'missing'|'moved'|'excused'|'planned';
export interface AttendanceSlot {date:string;lessonId?:string;actualDate?:string;status:AttendanceStatus}
export function attendanceWeek(state:AppState,schedules:AttendanceSchedule[],date:string,day:string){
 const start=weekStart(date),end=weekEnd(date),slots:AttendanceSlot[]=[];
 for(let i=0;i<7;i++){const d=addDays(start,i);if(scheduleAt(schedules,d)?.days.includes(weekday(d)))slots.push({date:d,status:'planned'});}
 const assigned=new Map<string,Lesson>(),used=new Set<string>();
 const preferred=(lessons:Lesson[])=>lessons.find(l=>l.status==='held')||lessons[0];
 for(const slot of slots){const lesson=preferred(state.lessons.filter(l=>l.attendanceDate===slot.date));if(lesson){assigned.set(slot.date,lesson);used.add(lesson.id);}}
 for(const slot of slots){if(assigned.has(slot.date))continue;const lesson=preferred(state.lessons.filter(l=>!l.attendanceDate&&l.date===slot.date&&!used.has(l.id)));if(lesson){assigned.set(slot.date,lesson);used.add(lesson.id);}}
 // An unlinked makeup in the same week fulfils one remaining weekly slot.
 for(const lesson of state.lessons.filter(l=>!l.attendanceDate&&l.status==='held'&&l.date>=start&&l.date<=end&&l.date<=day&&!used.has(l.id))){const slot=slots.find(slot=>{const old=assigned.get(slot.date);return !old||old.status!=='held'&&!old.attendanceExcused;});if(slot){assigned.set(slot.date,lesson);used.add(lesson.id);}}
 for(const slot of slots){const lesson=assigned.get(slot.date);slot.lessonId=lesson?.id;slot.actualDate=lesson?.date;if(lesson?.status==='held'&&lesson.date<=day)slot.status='held';else if(lesson?.attendanceExcused&&lesson.status==='cancelled')slot.status='excused';else if(lesson&&lesson.date!==slot.date&&lesson.status!=='cancelled'&&weekEnd(lesson.date)>=day)slot.status='moved';else slot.status=end<day?'missing':'planned';}
 return {start,end,closed:end<day,slots};
}
function totals(slots:AttendanceSlot[]){return {expected:slots.length,held:slots.filter(s=>s.status==='held').length,missed:slots.filter(s=>s.status==='missing').length,moved:slots.filter(s=>s.status==='moved').length,excused:slots.filter(s=>s.status==='excused').length};}
export function attendanceReport(state:AppState,name:string,now=new Date(),month=madridDay(now).slice(0,7),startedOn?:string){
 const day=madridDay(now),schedules=attendanceSchedules(state,name,day,startedOn),periodStart=state.payments.map(p=>p.date).filter(d=>d<=day).sort().at(-1)||schedules[0]?.from||day;
 const from=[periodStart,month+'-01'].sort()[0],end=weekEnd(day),weeks:ReturnType<typeof attendanceWeek>[]=[];
 if(schedules.length){let date=weekStart(from>schedules[0].from?from:schedules[0].from);for(let n=0;date<=end&&n<6000;n++,date=addDays(date,7)){const week=attendanceWeek(state,schedules,date,day);if(week.slots.length)weeks.push(week);}}
 const closed=weeks.filter(w=>w.closed).flatMap(w=>w.slots);
 return {day,schedules,periodStart,through:addDays(weekStart(day),-1),period:totals(closed.filter(slot=>slot.date>=periodStart)),month:totals(closed.filter(slot=>slot.date.startsWith(month))),weeks:weeks.filter(week=>week.slots.some(slot=>slot.date.startsWith(month))).reverse()};
}
