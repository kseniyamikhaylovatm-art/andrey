import {MonthlyPlans} from './monthly-plans';
import {SectionTitle} from './ui';
export function StudyDashboard(){
 const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long'}).format(new Date());
 return <><SectionTitle eyebrow="" title="Сегодня" description={date}/><MonthlyPlans/></>;
}
