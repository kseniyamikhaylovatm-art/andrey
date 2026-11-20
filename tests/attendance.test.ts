import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendanceReport,attendanceWeek,attendanceSchedules,knownAttendanceDays,weekStart,weekEnd} from '../src/attendance-model.js';
import {saveAttendanceSchedule,saveAttendanceSlot} from '../server/attendance.js';
import {initialState,paymentBalance} from '../server/domain.js';
import {addLessonWord,lessonWordInput} from '../server/lesson-words.js';
const now=new Date('2026-11-23T12:00:00Z');
function state(){const state=initialState();state.lessons=[];state.payments=[{id:'p',date:'2026-11-01',lessons:12}];return state;}
test('provided weekly schedules recognise the named learners and weekdays follow Madrid calendar weeks',()=>{
 assert.deepEqual(knownAttendanceDays('Андрей и Таня'),[2,5,6]);assert.deepEqual(knownAttendanceDays('Andrey Tania'),[2,5,6]);assert.deepEqual(knownAttendanceDays('Александр'),[2,5]);assert.deepEqual(knownAttendanceDays('Алексей'),[2]);assert.deepEqual(knownAttendanceDays('Пётр'),[1,4]);assert.deepEqual(knownAttendanceDays('Мария'),[]);
 assert.equal(weekStart('2026-11-22'),'2026-11-16');assert.equal(weekEnd('2026-11-22'),'2026-11-22');
 const s=state();assert.equal(attendanceSchedules(s,'Пётр','2026-11-23')[0].from,'2026-11-01');s.payments=[];assert.equal(attendanceSchedules(s,'Пётр','2026-11-23')[0].from,'2026-11-23');assert.equal(attendanceReport(s,'Мария',now).weeks.length,0);assert.equal(attendanceReport(s,'Пётр',now,'2026-11','2026-11-02').period.expected,6);assert.equal(attendanceReport(s,'Пётр',new Date('2026-11-30T12:00:00Z'),'2026-11','2026-11-02').period.expected,8);
});
test('week totals wait until Monday; an unlinked makeup within the same week covers one scheduled slot',()=>{
 const s=state();s.attendanceSchedules=[{from:'2026-11-02',days:[2,5,6]}];for(const date of ['2026-11-03','2026-11-06','2026-11-08'])s.lessons.push({id:date,date,title:'Урок',status:'held',note:''});
 const sunday=attendanceReport(s,'Andrey Tania',new Date('2026-11-08T12:00:00Z'));assert.equal(sunday.period.expected,0);const monday=attendanceReport(s,'Andrey Tania',new Date('2026-11-09T12:00:00Z'));assert.equal(monday.period.expected,3);assert.equal(monday.period.held,3);assert.equal(monday.period.missed,0);
 const dst=attendanceReport(s,'Andrey Tania',new Date('2026-11-08T23:30:00Z'));assert.equal(dst.day,'2026-11-09');assert.equal(dst.period.missed,0);
});
test('a cross-week transfer stays tied to the original slot, counts once and vocabulary marks its actual date held',()=>{
 const s=state();s.attendanceSchedules=[{from:'2026-11-02',days:[2,5,6]}];const moved=saveAttendanceSlot(s,'Andrey Tania','2026-11-07',{actualDate:'2026-11-23',status:'planned'},now);
 assert.equal(attendanceReport(s,'Andrey Tania',now).weeks.find(w=>w.start==='2026-11-02')!.slots.find(slot=>slot.date==='2026-11-07')!.status,'moved');assert.equal(paymentBalance(s).used,0);
 const repeated=saveAttendanceSlot(s,'Andrey Tania','2026-11-07',{actualDate:'2026-11-23',status:'planned'},now);assert.equal(repeated.id,moved.id);assert.equal(s.lessons.length,1);
 addLessonWord(s,lessonWordInput.parse({date:'2026-11-23',text:'la clase — урок'}));const original=attendanceWeek(s,s.attendanceSchedules,'2026-11-07','2026-11-23');assert.equal(original.slots.find(slot=>slot.date==='2026-11-07')!.status,'held');assert.equal(s.lessons.length,1);assert.equal(paymentBalance(s).used,1);assert.equal(s.lessons[0].attendanceDate,'2026-11-07');
 const thisWeek=attendanceWeek(s,s.attendanceSchedules,'2026-11-23','2026-11-23');assert.equal(thisWeek.slots.filter(slot=>slot.status==='held').length,0);
});
test('a failed makeup becomes missing only after its new week closes; teacher cancellations are excluded',()=>{
 const s=state();s.attendanceSchedules=[{from:'2026-11-02',days:[2,5,6]}];saveAttendanceSlot(s,'Андрей и Таня','2026-11-07',{actualDate:'2026-11-09',status:'planned'},now);assert.equal(attendanceWeek(s,s.attendanceSchedules,'2026-11-07','2026-11-15').slots[2].status,'moved');assert.equal(attendanceWeek(s,s.attendanceSchedules,'2026-11-07','2026-11-16').slots[2].status,'missing');
 saveAttendanceSlot(s,'Андрей и Таня','2026-11-07',{actualDate:'2026-11-09',status:'excused',note:'Отмена преподавателя'},now);assert.equal(attendanceWeek(s,s.attendanceSchedules,'2026-11-07','2026-11-23').slots[2].status,'excused');assert.equal(paymentBalance(s).used,0);
});
test('linking an already recorded makeup reuses its attendance and payment instead of creating another held lesson',()=>{
 const s=state();s.attendanceSchedules=[{from:'2026-11-02',days:[2,5,6]}];s.lessons=[{id:'actual',date:'2026-11-09',title:'Проведённый перенос',status:'held',note:'Материал сохранён',cardIds:['a']},{id:'placeholder',date:'2026-11-07',title:'План',status:'planned',note:'Исходная заметка',cardIds:['b']}];
 const linked=saveAttendanceSlot(s,'Андрей и Таня','2026-11-07',{actualDate:'2026-11-09',status:'planned',note:'Исходная заметка'},now);assert.equal(linked.id,'actual');assert.equal(linked.status,'held');assert.equal(s.lessons.length,2);assert.equal(s.lessons[1].status,'cancelled');assert.equal(paymentBalance(s).used,1);assert.deepEqual(linked.cardIds,['a','b']);assert.match(linked.note,/Материал сохранён/);assert.match(linked.note,/Исходная заметка/);assert.equal(attendanceWeek(s,s.attendanceSchedules,'2026-11-07','2026-11-23').slots[2].status,'held');
 assert.throws(()=>saveAttendanceSlot(s,'Андрей и Таня','2026-11-10',{actualDate:'2026-11-09',status:'planned'},now));assert.equal(paymentBalance(s).used,1);
});
test('schedule changes preserve earlier weeks; monthly and payment-period totals use their own boundaries',()=>{
 const s=state();saveAttendanceSchedule(s,'Пётр',{from:'2026-11-09',days:[2]},now);assert.deepEqual(s.attendanceSchedules,[{from:'2026-11-01',days:[1,4]},{from:'2026-11-09',days:[2]}]);const report=attendanceReport(s,'Пётр',now);assert.equal(report.period.expected,4);assert.equal(report.period.missed,4);
 s.payments.push({id:'renewal',date:'2026-11-16',lessons:4});const renewed=attendanceReport(s,'Пётр',now);assert.equal(renewed.periodStart,'2026-11-16');assert.equal(renewed.period.expected,1);assert.equal(renewed.month.expected,4);
 saveAttendanceSchedule(s,'Пётр',{from:'2026-11-16',days:[]},now);assert.equal(attendanceReport(s,'Пётр',now).period.expected,0);assert.throws(()=>saveAttendanceSchedule(s,'Пётр',{from:'2026-11-16',days:[2,2]},now));assert.throws(()=>saveAttendanceSlot(s,'Пётр','2026-11-16',{actualDate:'2026-11-16',status:'held'},now));
});
