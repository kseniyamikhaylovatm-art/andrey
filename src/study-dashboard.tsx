import {MonthlyPlans} from './monthly-plans';
import {useState} from 'react';
import {ArrowRight,BookOpen,CalendarDays,CheckCircle2,Headphones,Layers,MessageCircle,Mic,Plus,Target} from 'lucide-react';
import {formatDate,percentage} from './api';
import {useApp} from './context';
import {studyStats,madridDay} from './study-stats';
import {Badge,Button,Empty,Field,Panel,SectionTitle,TextArrow} from './ui';

interface Actions {editPlan:()=>void;addDiary:()=>void;addCard:()=>void;importCards:()=>void}
export function StudyDashboard({editPlan,addDiary,addCard,importCards}:Actions){
  const {api,state:s,meta,go,run,notify}=useApp();
  const stats=studyStats(s),[phrase,setPhrase]=useState(''),[saving,setSaving]=useState(false);
  const practiceMode=stats.due?'review':stats.fresh?'new':'all';
  const active=s.cards.filter(c=>c.enabled).length;
  const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const total=s.cards.length,held=s.lessons.filter(l=>l.status==='held').length;
  const entries=s.diary.filter(d=>madridDay(d.date)===madridDay(new Date()));
  const labels={learned:'Выучено',learning:'Учу',difficult:'Трудные',new:'Новые'};
  return <>
    <SectionTitle eyebrow="" title="Сегодня" description={date} action={<Button disabled={!active} onClick={()=>go('cards',{mode:practiceMode})}>Начать практику <ArrowRight size={18}/></Button>}/>
    <MonthlyPlans/>
    <div className="study-top-grid">
      <Panel className="study-start-panel">
        <h2>Карточки на сегодня</h2>
        <p className="study-queue-counts">К повторению: <strong>{stats.due}</strong><span>Новых слов: <strong>{stats.fresh}</strong></span></p>
        <div className="study-start-actions">
          <Button disabled={!active} onClick={()=>go('cards',{mode:practiceMode})}><Layers size={20}/>{stats.due?'Повторить карточки · '+stats.due:stats.fresh?'Новые слова · '+stats.fresh:'Все карточки · '+active}</Button>
          <Button secondary onClick={()=>go('cards')}><CalendarDays size={20}/>Выбрать формат</Button>
        </div>
        <p className="study-start-detail">Карточки, формы глаголов, речь и задания на слух.</p>
      </Panel>
      <Panel className="study-overview">
        <div className="study-numbers">
          <div><strong>{stats.streak}</strong><span>Дней подряд</span></div>
          <div><strong>{stats.week.length}</strong><span>Ответов за 7 дней</span></div>
          <div><strong>{stats.groups.learned}</strong><span>Выучено</span></div>
          <div><strong>{stats.groups.difficult}</strong><span>Трудных слов</span></div>
        </div>
        <div className="study-status-track" aria-label="Распределение карточек в базе">{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><span key={key} className={'status-'+key} style={{width:(total?stats.groups[key]/total*100:0)+'%'}}/>)}</div>
        <div className="study-status-legend">{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><span key={key}><i className={'status-'+key}/>{labels[key]} · {stats.groups[key]}</span>)}</div>
        <small>Всего в базе: {total} карточек</small>
      </Panel>
    </div>
    <div className="study-skill-grid">
      <Panel><div className="study-card-heading"><MessageCircle size={23}/><h2>Диалог</h2></div><p>{meta.ai?'Разговор на выбранную тему с нужной грамматикой и словарём.':'Выберите тему и грамматику для диалога. Для разговора потребуется подключить ИИ.'}</p><Button secondary onClick={()=>go('speech',{mode:'dialog'})}>Открыть диалог</Button></Panel>
      <Panel><div className="study-card-heading"><Headphones size={23}/><h2>Слух</h2></div><p>Прослушайте испанский текст, ответьте на вопрос и сравните ответ с образцом.</p><Button secondary onClick={()=>go('listening')}>Слушать</Button></Panel>
      <Panel><div className="study-card-heading"><Mic size={23}/><h2>Пересказ</h2></div><p>Перескажите материал урока, используя изученные слова. Ответьте голосом или текстом.</p><Button secondary onClick={()=>go('speech',{mode:'retell'})}>Открыть пересказ</Button></Panel>
    </div>
    <Panel className="study-week-panel"><div className="section-heading"><h2>Итоги недели</h2><Badge>Последние 7 дней</Badge></div><div className="study-week-grid">{[{name:'Карточки',kind:'card'},{name:'Формы глаголов',kind:'verb'},{name:'Речевая практика',kind:'speech'},{name:'Задания на слух',kind:'listening'}].map(item=><div key={item.kind}><strong>{stats.week.filter(a=>a.kind===item.kind).length}</strong><span>{item.name}</span></div>)}</div><p className="small muted">Время практики: {stats.minutes} мин</p></Panel>
    <div className="two-col study-work-grid">
      <Panel><div className="section-heading"><h2>Испанский в жизни</h2><TextArrow onClick={addDiary}>Добавить запись</TextArrow></div><p>Запишите разговор или ситуацию, в которой понадобился испанский.</p><div className="study-diary-counts"><span>Записей сегодня <strong>{entries.length}</strong></span><span>Разговоров <strong>{entries.filter(d=>d.spoke).length}</strong></span></div>{entries.slice(-2).map(entry=><p className="study-diary-entry" key={entry.id}>{entry.text}</p>)}</Panel>
      <Panel><div className="section-heading"><h2>Задания</h2><Badge>{s.assignments.filter(a=>!a.done).length} осталось</Badge></div>{s.assignments.length?s.assignments.slice().reverse().map(task=><label className={'task '+(task.done?'done':'')} key={task.id}><input type="checkbox" checked={task.done} onChange={()=>void run(()=>api('/assignments/'+task.id,{done:!task.done},'PATCH'))}/><span><strong>{task.title}</strong><small>До {formatDate(task.due)}</small></span></label>):<Empty>Заданий пока нет. Преподаватель может добавить их в кабинете.</Empty>}</Panel>
    </div>
    <div className="two-col study-work-grid">
      <Panel><div className="section-heading"><h2>Быстрое добавление</h2><Plus size={21}/></div><p>Введите испанское слово или фразу и русский перевод через тире.</p><form className="study-add-form" onSubmit={async e=>{
        e.preventDefault();setSaving(true);
        const result=await run(async()=>{
          const parsed=await api<{cards:{es:string;ru:string}[];issues:unknown[]}>('/import/cards/preview',{text:phrase});
          if(parsed.cards.length!==1||parsed.issues.length)throw new Error('Введите одну пару, например: el barrio — район.');
          return api<{added:number;duplicates:number}>('/import/cards/confirm',{cards:parsed.cards,topic:'Повседневное',source:'Добавлено с главной страницы'});
        });
        setSaving(false);if(result){setPhrase('');notify(result.added?'Карточка добавлена':'Такая карточка уже есть в базе.');}
      }}><Field label="Слово и перевод"><input value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder="el barrio — район" required maxLength={8000}/></Field><Button type="submit" disabled={saving||!phrase.trim()}>{saving?'Добавляем…':'Добавить'}</Button></form><div className="study-import-actions"><TextArrow onClick={importCards}>Загрузить PDF карточек</TextArrow>{meta.role==='teacher'&&<TextArrow onClick={addCard}>Карточка с примерами</TextArrow>}</div></Panel>
      <Panel><div className="section-heading"><h2>Темы для повторения</h2><BookOpen size={21}/></div>{s.plan.topics.map(topic=>{const cards=s.cards.filter(c=>c.enabled&&c.topic===topic),learned=cards.filter(c=>c.stage>=4).length;return <div className="study-topic-row" key={topic}><div><strong>{topic}</strong><small>{learned} из {cards.length} выучено</small><div className="progress-track"><span style={{width:percentage(learned,cards.length)+'%'}}/></div></div><Button secondary disabled={!cards.length} onClick={()=>go('cards',{topic,mode:'all'})}>Тренировать</Button></div>;})}</Panel>
    </div>
    <Panel className="study-course-plan"><div className="section-heading"><h2>План обучения</h2>{meta.role==='teacher'&&<TextArrow onClick={editPlan}>Изменить план</TextArrow>}</div><div className="study-course-details"><span><strong>Цель курса:</strong> {s.plan.goal}</span><span><strong>Уровень:</strong> {s.plan.level}</span><span><strong>Проведено занятий:</strong> {held}</span></div><div className="goals-table"><div className="goals-row goals-head"><span>Навык</span><span>Сейчас</span><span>Цель</span></div>{s.plan.goals.map((goal,i)=><div className="goals-row" key={i}><strong>{goal.skill}</strong><span>{goal.now}</span><span>{goal.target}</span></div>)}</div><div className="study-criteria"><h3>Критерии результата</h3><ul className="criteria">{s.plan.criteria.map((criterion,i)=><li key={i}><CheckCircle2 size={18}/><span>{criterion}</span></li>)}</ul></div><Button secondary onClick={()=>go('verbs')}><Target size={19}/>Тренажёр глаголов</Button></Panel>
  </>;
}
