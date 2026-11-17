import {useApp} from './context';
import {tenseNames,type Tense} from './types';
import {formatDate,percentage} from './api';

export function CabinetSummary(){
  const {state:s}=useApp();
  const week=s.attempts.filter(a=>Date.now()-Date.parse(a.at)<7*86400000);
  const checked=week.filter(a=>a.correct!==null),wrong=week.filter(a=>a.correct===false);
  const problems=s.cards.filter(c=>wrong.some(a=>a.cardId===c.id)).slice(0,4);
  const times=[...new Set(wrong.filter(a=>a.tense).map(a=>a.tense!))].map(t=>tenseNames[t as Tense]||t);
  const diary=s.diary.filter(d=>Date.now()-Date.parse(d.date)<7*86400000);
  const speeches=s.speeches.filter(d=>Date.now()-Date.parse(d.date)<7*86400000);
  const dialogs=s.dialogs.filter(d=>Date.now()-Date.parse(d.date)<7*86400000);
  const suggestions=[
    problems.length?'Повторить в коротком диалоге: '+problems.map(c=>c.es).join(', ')+'.':'Начать с короткого разговора о жизни в Испании: сосед, рынок или сёрфинг.',
    times.length?'Разобрать формы, в которых были ошибки: '+times.join(', ')+'.':'Закрепить настоящее и прошедшие времена на примерах из последнего урока.',
    s.assignments.some(a=>!a.done)?'Проверить незавершённые задания и обсудить, что вызвало трудности.':'Выбрать небольшое задание для самостоятельной практики до следующей встречи.',
  ];
  return <div className="cabinet-summary-body">
    {s.summary?<div className="prose saved-summary">{s.summary.text.split(/\n{2,}/).filter(Boolean).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>:<div className="summary-facts">
      <p><strong>Период:</strong> последние 7 дней, по {formatDate(new Date().toISOString())}.</p>
      <p><strong>Сделано:</strong> {week.length?`${new Set(week.map(a=>a.at.slice(0,10))).size} дней практики, ${week.length} ответов, ${Math.round(week.reduce((n,a)=>n+a.seconds,0)/60)} мин.`:'Практика ещё не началась. Первые ответы помогут увидеть, что уже получается.'} {checked.length>0&&`Точность — ${percentage(checked.filter(a=>a.correct).length,checked.length)}%.`}</p>
      <p><strong>Где нужна поддержка:</strong> {wrong.length?`${wrong.length} ошибок за неделю. ${[...problems.map(c=>c.es),...times].join(', ')}.`:'Пока недостаточно данных о трудностях. После тренировок здесь появятся сложные слова и времена.'}</p>
      <p><strong>Дневник и диалоги:</strong> {diary.length} записей, {dialogs.length} диалогов и {speeches.length} речевых работ за неделю.</p>
    </div>}
    <div className="lesson-suggestions"><h3>На урок:</h3><ol>{suggestions.map((suggestion,i)=><li key={i}><span>{i+1}</span><p>{suggestion}</p></li>)}</ol></div>
  </div>;
}
