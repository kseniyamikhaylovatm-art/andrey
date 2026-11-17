import type {AppState} from './types';
/** Missing quantities belong to existing records created as 12-lesson packages. */
export function paymentBalance(state:AppState){
 const dates=state.payments.map(payment=>payment.date).sort(),first=dates[0];
 const paid=state.payments.reduce((sum,payment)=>sum+(payment.lessons??12),0);
 const used=state.lessons.filter(lesson=>lesson.status==='held'&&(!first||lesson.date>=first)).length;
 return {paid,used,remaining:paid-used,last:dates.at(-1)||null};
}
