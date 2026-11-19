import {MonthlyPlans} from './monthly-plans';
import {CheckCircle2,Target} from 'lucide-react';
import {useApp} from './context';
import {Button,Panel,SectionTitle,TextArrow} from './ui';

export function StudyDashboard({editPlan}:{editPlan:()=>void}){
  const {state:s,meta,go}=useApp();
  const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const held=s.lessons.filter(lesson=>lesson.status==='held').length;
  return <>
    <SectionTitle eyebrow="" title="Сегодня" description={date}/>
    <MonthlyPlans/>
    <Panel className="study-course-plan"><div className="section-heading"><h2>План обучения</h2>{meta.role==='teacher'&&<TextArrow onClick={editPlan}>Изменить план</TextArrow>}</div><div className="study-course-details"><span><strong>Цель курса:</strong> {s.plan.goal}</span><span><strong>Уровень:</strong> {s.plan.level}</span><span><strong>Проведено занятий:</strong> {held}</span></div><div className="goals-table"><div className="goals-row goals-head"><span>Навык</span><span>Сейчас</span><span>Цель</span></div>{s.plan.goals.map((goal,i)=><div className="goals-row" key={i}><strong>{goal.skill}</strong><span>{goal.now}</span><span>{goal.target}</span></div>)}</div><div className="study-criteria"><h3>Критерии результата</h3><ul className="criteria">{s.plan.criteria.map((criterion,i)=><li key={i}><CheckCircle2 size={18}/><span>{criterion}</span></li>)}</ul></div><Button secondary onClick={()=>go('verbs')}><Target size={19}/>Тренажёр глаголов</Button></Panel>
  </>;
}
