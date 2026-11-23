import {useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,CalendarDays,ChevronLeft,ChevronRight,Layers,PenLine,Plus,Star,Volume2} from 'lucide-react';
import {useApp} from './context';
import {today,speak} from './api';
import {readRoute} from './navigation';
import {lessonCards,lessonDate} from './lesson-vocabulary';
import type {Card,Example,LessonWordResult} from './types';
import {CardEditor} from './cards';
import {MaterialsModal} from './materials';
import {lessonList} from './lesson-list';
import {parseCardPairs} from './card-pairs';
import {Badge,Button,Empty,Field,Panel,SectionTitle,Sound} from './ui';

export function WordsPage(){
  const {state:s,meta,api,run,notify,go,refresh}=useApp(),teacher=meta.role==='teacher';
  const [selectedId,setSelectedId]=useState(()=>readRoute().params.get('lesson')||''),[date,setDate]=useState(today);
  const [text,setText]=useState(''),[title,setTitle]=useState(''),[topic,setTopic]=useState('Повседневное'),[busy,setBusy]=useState(false),[translations,setTranslations]=useState(false),[editing,setEditing]=useState<Card|null>(null);
  const [listText,setListText]=useState('');
  const [translation,setTranslation]=useState(''),[exampleText,setExampleText]=useState(''),[exampleTranslation,setExampleTranslation]=useState('');
  const [miro,setMiro]=useState<{text:string;source:string}|null>(null);
  const input=useRef<HTMLInputElement>(null),listInput=useRef<HTMLTextAreaElement>(null);
  const [listMode,setListMode]=useState(false),[progress,setProgress]=useState('');
  const allLessons=s.lessons.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const lessons=teacher?allLessons:allLessons.filter(lesson=>lessonCards(s.cards,lesson).length);
  const lesson=lessons.find(item=>item.id===selectedId)||lessons.find(item=>teacher?item.date===date:true);
  const words=lessonCards(s.cards,lesson),enabled=words.filter(card=>card.enabled).length;
  const index=lessons.findIndex(item=>item.id===lesson?.id);
  function select(id:string){const item=s.lessons.find(lesson=>lesson.id===id);setSelectedId(id);if(item)setDate(item.date);setTranslations(false);}
  // Keep the student's open lesson list up to date while the teacher adds words.
  useEffect(()=>{if(teacher)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});},8000);return()=>clearInterval(timer);},[teacher,refresh]);
  return <><SectionTitle eyebrow="" title="Слова" description="Записи с уроков по датам. Все слова связаны с «Автоматизацией»."/>
    {teacher&&<Panel><div className="section-heading"><h2>Доска Miro ученика</h2>{s.plan.miroBoardUrl&&<a href={s.plan.miroBoardUrl} target="_blank" rel="noreferrer">Открыть доску</a>}</div><p className="small muted">Привяжите доску через «Мои ученики → Имя и уровень». Импорт загружает текст заметок, карточек и надписей через API. Изображения и PDF нужно разбирать отдельно.</p><Button secondary disabled={busy||!s.plan.miroBoardUrl||!meta.miro} onClick={async()=>{setBusy(true);try{const loaded=await api<{text:string;source:string;items:number;skipped:number}>('/miro/text',{});setMiro(loaded);notify('Объектов: '+loaded.items+'. Без доступного текста: '+loaded.skipped+'. Проверьте материал перед добавлением.');}catch(error){notify((error as Error).message);}finally{setBusy(false);}}}>Загрузить из Miro</Button>{!meta.miro&&<p className="small muted">Для импорта добавьте MIRO_ACCESS_TOKEN в Render. Для разбора слов и тем также нужен подключённый ИИ.</p>}</Panel>}
    {miro&&<MaterialsModal initial={miro} close={()=>setMiro(null)}/>}
    {teacher&&<Panel className="lesson-word-entry"><div className="section-heading"><h2>Добавить слово на уроке</h2><Badge><Layers size={15}/>Сразу в «Автоматизацию»</Badge></div>
      <p className="small muted">После сохранения слов урок автоматически отмечается как проведённый.</p>
      <div className="pills"><button type="button" disabled={busy} className={!listMode?'active':''} onClick={()=>setListMode(false)}>По одному</button><button type="button" disabled={busy} className={listMode?'active':''} onClick={()=>setListMode(true)}>Списком</button></div>
      <form className="form" onSubmit={async event=>{
        event.preventDefault();setBusy(true);
        if(listMode){
          const saved=await run(async()=>{
            const rows=lessonList(listText),missing=rows.filter(row=>!row.ru);
            if(missing.length>50)throw new Error('За один раз можно автоматически перевести до 50 слов. Пары с переводом — до 100.');
            if(missing.length&&!meta.ai)throw new Error('Автоперевод пока не подключён. Добавьте русский перевод в каждую строку: слово — перевод.');
            for(let index=0;index<missing.length;index++){setProgress('Переводим '+(index+1)+' из '+missing.length);const translated=await api<{ru:string}>('/ai/translate-word',{es:missing[index].es});missing[index].ru=translated.ru;}
            setProgress('Сохраняем список…');
            return api<{lessonId:string;added:number;reused:number;translationKept:number;disabled:number}>('/lesson-words/batch',{date:lesson?.date||date,lessonId:lesson?.id,rows,topic,title});
          });
          setBusy(false);setProgress('');
          if(saved){setSelectedId(saved.lessonId);setListText('');setTitle('');notify('Список сохранён. Новых карточек: '+saved.added+'. Уже в базе: '+saved.reused+'.'+(saved.translationKept?' Прежние переводы сохранены: '+saved.translationKept+'.':'')+(saved.disabled?' Выключенных карточек: '+saved.disabled+'.':''));requestAnimationFrame(()=>listInput.current?.focus());}
          return;
        }
        const result=await run(async()=>{
          const example=exampleText.trim()?{es:exampleText,ru:exampleTranslation}:undefined;
          if(!example&&exampleTranslation.trim())throw new Error('Добавьте пример на испанском.');
          const lessonDetails={date:lesson?.date||date,lessonId:lesson?.id,topic,title};
          if(translation.trim()){
            return api<LessonWordResult>('/lesson-words',{...lessonDetails,pair:{es:text,ru:translation,example}});
          }
          let pair=text.trim();
          const parsed=parseCardPairs(pair);
          if(parsed.cards.length===0){
            if(/[\r\n]/.test(pair)||/[—–]|\s-\s/.test(pair))throw new Error('Введите одно испанское слово или пару слово — перевод.');
            const translated=await api<{es:string;ru:string}>('/ai/translate-word',{es:pair});
            pair=translated.es+' — '+translated.ru;
          }
          return api<LessonWordResult>('/lesson-words',{...lessonDetails,text:pair,example});
        });
        setBusy(false);
        if(result){setSelectedId(result.lessonId);setText('');setTitle('');setTranslation('');setExampleText('');setExampleTranslation('');notify(!result.enabled?'Слово добавлено к уроку. Карточка выключена — включите её для тренировки.':result.translationKept?'Слово добавлено к уроку. В базе сохранён прежний перевод; его можно исправить кнопкой с карандашом.':result.created?'Слово сохранено в уроке и в «Автоматизации».':'Слово уже было в базе. Оно добавлено к этому уроку, прогресс сохранён.');requestAnimationFrame(()=>input.current?.focus());}
      }}><div className="lesson-entry-meta"><Field label="Дата урока"><input type="date" value={lesson?.date||date} disabled={busy} onChange={event=>{setDate(event.target.value);setSelectedId('');}} required/></Field>{lesson?<div className="lesson-entry-selected"><CalendarDays size={19}/><span>{lesson.title}</span></div>:<Field label="Название урока · необязательно"><input value={title} disabled={busy} maxLength={200} placeholder="Например, В ресторане" onChange={event=>setTitle(event.target.value)}/></Field>}<Field label="Тема слова"><input value={topic} disabled={busy} maxLength={200} list="lesson-word-topics" onChange={event=>setTopic(event.target.value)} required/><datalist id="lesson-word-topics">{s.plan.topics.map(item=><option key={item}>{item}</option>)}</datalist></Field></div>
        {listMode?<><Field label="Список слов"><textarea ref={listInput} value={listText} disabled={busy} onChange={event=>setListText(event.target.value)} rows={8} required maxLength={200000} placeholder={'el comedor — столовая | Comemos en el comedor. | Мы едим в столовой.\nla cocina — кухня'} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/></Field>
          <p className="small muted">Вставьте «слово — перевод», а со следующей строки — пример. Разделяйте записи пустой строкой. Можно записать всё в одну строку через |. До 100 записей.</p>
          <Button type="submit" disabled={busy||!listText.trim()}>{busy?progress||'Проверяем список…':'Добавить список'}</Button>
        </>:<>
          <div className="form-row">
            <Field label="Слово на испанском"><input ref={input} lang="es" value={text} disabled={busy} onChange={event=>setText(event.target.value)} required maxLength={10000} placeholder="Например, el barrio" autoComplete="off"/></Field>
            <Field label="Перевод слова на русский"><input value={translation} disabled={busy} maxLength={4000} placeholder="Например, район" onChange={event=>setTranslation(event.target.value)}/></Field>
          </div>
          <div className="form-row">
            <Field label="Пример на испанском"><input lang="es" value={exampleText} disabled={busy} maxLength={4000} placeholder="Например, Vivo en este barrio." onChange={event=>setExampleText(event.target.value)}/></Field>
            <Field label="Перевод примера на русский"><input value={exampleTranslation} disabled={busy} maxLength={4000} placeholder="Например, Я живу в этом районе." onChange={event=>setExampleTranslation(event.target.value)}/></Field>
          </div>
          <p className="small muted">Добавьте перевод примера, чтобы ученик мог повторить целую фразу в «Автоматизации».</p>
          <Button type="submit" disabled={busy||!text.trim()}><Plus size={19}/>{busy?'Сохраняем…':'Добавить слово'}</Button>
        </>}
      </form>
    </Panel>}
    <Panel className="lesson-words-panel"><div className="lesson-words-heading"><div><div className="eyebrow">СЛОВА УРОКА</div><h2>{lesson?lessonDate(lesson.date):teacher?lessonDate(date):'Записи с занятий'}</h2>{lesson&&<p className="muted">{lesson.title}</p>}</div><div className="lesson-words-controls"><label className="check-label"><input type="checkbox" checked={translations} onChange={event=>setTranslations(event.target.checked)}/>Показать переводы</label><div className="lesson-date-arrows"><button className="icon-btn" aria-label="Предыдущий урок" disabled={busy||index<0||index>=lessons.length-1} onClick={()=>select(lessons[index+1].id)}><ChevronLeft size={21}/></button><button className="icon-btn" aria-label="Следующий урок" disabled={busy||index<=0} onClick={()=>select(lessons[index-1].id)}><ChevronRight size={21}/></button></div></div></div>
      <div className="lesson-words-toolbar"><Field label="Выберите урок"><select value={lesson?.id||''} disabled={busy||!lessons.length} onChange={event=>select(event.target.value)}>{!lesson&&<option value="">{teacher?'Новая запись за выбранную дату':'Пока нет записей'}</option>}{lessons.map(item=><option key={item.id} value={item.id}>{lessonDate(item.date)} · {item.title} · {lessonCards(s.cards,item).length} слов</option>)}</select></Field><span className="small muted">Слов в уроке: <strong>{words.length}</strong> · Выучено: <strong>{words.filter(card=>card.stage>=4).length}</strong></span><Button disabled={!enabled} onClick={()=>go('cards',{lesson:lesson!.id,mode:'all'})}>Тренировать слова урока <ArrowRight size={18}/></Button></div>
      {words.length?<><p className="small muted">Нажмите на слово, чтобы открыть перевод и примеры. Звёздочкой можно отметить слова для повторения.</p><div className="lesson-word-grid">{words.map((card,i)=><WordRow key={(lesson?.id||'')+':'+card.id} card={card} date={lesson!.date} number={i+1} translations={translations} edit={()=>setEditing(card)} remove={async()=>{const result=await run(()=>api('/lessons/'+lesson!.id+'/words/'+card.id,undefined,'DELETE'));if(result)notify('Слово убрано из этого урока. Карточка и её прогресс остаются в «Автоматизации».');}}/>)}</div></>:<Empty>{teacher?'Добавьте первое слово выше — оно появится здесь и в тренажёре.':'Преподаватель запишет сюда слова во время занятия. Они также появятся в «Автоматизации».'}</Empty>}
    </Panel>
    {lessons.length>0&&<Panel className="lesson-vocabulary-history"><div className="section-heading"><h2>Записи с уроков</h2><BookOpen size={23}/></div><div className="lesson-history-grid">{lessons.map(item=><button key={item.id} disabled={busy} aria-pressed={item.id===lesson?.id} className={'lesson-history-item '+(item.id===lesson?.id?'active':'')} onClick={()=>{select(item.id);requestAnimationFrame(()=>document.querySelector('.lesson-words-panel')?.scrollIntoView({behavior:'smooth',block:'start'}));}}><CalendarDays size={20}/><span><strong>{lessonDate(item.date)}</strong><small>{item.title}</small></span><Badge>{lessonCards(s.cards,item).length}</Badge></button>)}</div></Panel>}
    {editing&&<CardEditor card={editing} close={()=>setEditing(null)}/>}
  </>;
}

function WordRow({card,date,number,translations,edit,remove}:{card:Card;date:string;number:number;translations:boolean;edit:()=>void;remove:()=>Promise<void>}){
  const {meta,api,run,notify,refresh}=useApp(),[open,setOpen]=useState(false),[removing,setRemoving]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const examples=card.examples.filter(example=>!example.level||example.level===meta.student.level);
  async function reveal(){setOpen(!open);if(open||loading||examples.length||!meta.ai)return;setLoading(true);setError('');try{await api<Example>('/ai/cards/'+card.id+'/word-example',{});await refresh();}catch(problem){setError((problem as Error).message);}finally{setLoading(false);}}

  return <article className={'lesson-word-row '+(!card.enabled?'word-disabled':'')}><div className="lesson-word-top"><button className="lesson-word-reveal" aria-expanded={open} onClick={()=>void reveal()}><span>{number}</span><strong lang="es">{card.es}</strong></button><div className="lesson-word-actions"><button className="icon-btn" aria-label={'Озвучить '+card.es} onClick={()=>{try{speak(card.es);}catch(error){notify((error as Error).message);}}}><Volume2 size={19}/></button><button className={'star-button '+(card.focused?'selected':'')} aria-label={'В фокус: '+card.es} aria-pressed={card.focused} onClick={()=>void run(()=>api('/cards/'+card.id,{focused:!card.focused},'PATCH'))}><Star size={19} fill={card.focused?'currentColor':'none'}/></button>{meta.role==='teacher'&&<button className="icon-btn" aria-label={'Редактировать '+card.es} onClick={edit}><PenLine size={17}/></button>}</div></div>{!card.enabled&&<small className="word-disabled-note">Выключено в тренажёре</small>}{(open||translations)&&<div className="lesson-word-translation"><p>{card.ru}</p>{open&&<>{loading&&<p role="status">Готовим пример для уровня {meta.student.level}…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!examples.length&&<p className="small muted">{meta.ai?'Закройте и откройте слово, чтобы подготовить пример.':'Пример пока не добавлен.'}</p>}{examples.slice(0,2).map((example,index)=><div className="lesson-word-example" key={index}><p lang="es">{example.es}<Sound text={example.es} notify={notify}/></p>{example.ru&&<p className="muted">{example.ru}</p>}</div>)}<div className="lesson-word-details"><Sound text={card.es} notify={notify}/>{meta.role==='teacher'&&<><label className="check-label"><input type="checkbox" checked={card.enabled} onChange={event=>void run(()=>api('/cards/'+card.id,{enabled:event.target.checked},'PATCH'))}/>В тренажёре</label><button className="text-link" disabled={removing} onClick={async()=>{setRemoving(true);await remove();setRemoving(false);}}>Убрать из урока</button></>}</div></>}</div>}</article>;
}
