import {useRef,useState} from 'react';
import {useApp} from './context';
import {Badge,Button,Empty,Field,Panel,Sound} from './ui';
import {usePracticeAudio} from './use-practice-audio';
interface Task {id:string;kind:string;title:string;prompt:string;choices?:string[];tiles?:string[];audio?:string}
interface Step {id?:string;index:number;task:Task|null;total:number;correct?:boolean;expected?:string;initialCorrect?:number;mistakes?:number;repeat?:boolean}
export function Lingva(){
 const {state,api,run,notify}=useApp(),audio=usePracticeAudio(notify);
 const [topic,setTopic]=useState(''),[lesson,setLesson]=useState(''),[session,setSession]=useState<Step|null>(null),[feedback,setFeedback]=useState<Step|null>(null),[answer,setAnswer]=useState(''),[tiles,setTiles]=useState<number[]>([]),[busy,setBusy]=useState(false);
 const id=useRef(''),started=useRef(Date.now());
 const task=session?.task;
 function reset(next:Step){setSession(next);setAnswer('');setTiles([]);setFeedback(null);started.current=Date.now();}
 async function submit(skip=false){if(!task||busy||feedback)return;audio.prepareAnswer();setBusy(true);const value=task.kind==='tiles'?tiles.map(index=>task.tiles![index]).join(' '):answer;
 const result=await run(()=>api<Step>('/lingva/answer',{id:id.current,index:session!.index,answer:value,skip,seconds:Math.min(1800,Math.round((Date.now()-started.current)/1000))}));if(result){setFeedback(result);if(!skip)audio.answer(Boolean(result.correct));}setBusy(false);}
 return <Panel className="lingva"><div className="section-heading"><div><h2>Упражнение формат дуолинго</h2><p className="muted">13 заданий по вашим словам, затем — работа над ошибками.</p></div><Badge>Словарь ваших уроков</Badge></div>
 {!session?<><div className="form-row"><Field label="Тема практики"><select value={topic} onChange={e=>setTopic(e.target.value)}><option value="">Все темы</option>{[...new Set(state.cards.filter(c=>c.enabled).map(c=>c.topic))].map(t=><option key={t}>{t}</option>)}</select></Field><Field label="Урок для практики"><select value={lesson} onChange={e=>setLesson(e.target.value)}><option value="">Все уроки</option>{state.lessons.filter(l=>l.cardIds?.length).map(l=><option key={l.id} value={l.id}>{l.date} · {l.title}</option>)}</select></Field></div><p>Задания каждый раз перемешиваются. Переводы проверяются по записям в карточках; учитываем ударения в испанском. Пропуски и сборка фраз появляются, когда для них есть подходящий материал.</p><Button disabled={busy||!state.cards.some(c=>c.enabled)} onClick={async()=>{setBusy(true);const result=await run(()=>api<Step>('/lingva/start',{topic:topic||undefined,lessonId:lesson||undefined}));if(result){id.current=result.id!;reset(result);}setBusy(false);}}>Начать 13 заданий</Button></>:!task?<div className="lingva-finish"><h3>Практика завершена</h3><p>С первого раза: {session.initialCorrect} из 13. Ошибок или пропусков в основном круге: {session.mistakes}.</p><p>Все задания из работы над ошибками выполнены.</p><Button onClick={()=>{audio.stop();setSession(null);}}>Новая практика</Button></div>:<>
 <div className="lingva-progress" role="progressbar" aria-label="Ход практики" aria-valuemin={0} aria-valuemax={13} aria-valuenow={Math.min(session.index,13)}><span style={{width:Math.min(session.index,13)/13*100+'%'}}/></div><p className="small muted">{session.index<13?'Задание '+(session.index+1)+' из 13':'Работа над ошибками · '+(session.index-12)}</p>
 <h3>{task.title}</h3><div className="lingva-prompt">{task.audio?<Sound text={task.audio} notify={notify}/>:task.prompt}</div>
 <form className="form" onSubmit={e=>{e.preventDefault();void submit();}}>
 {task.kind==='choice'?<div className="lingva-choices">{task.choices!.map(choice=><button type="button" key={choice} disabled={busy||Boolean(feedback)} aria-pressed={answer===choice} className={answer===choice?'chosen':''} onClick={()=>setAnswer(choice)}>{choice}</button>)}</div>:task.kind==='tiles'?<><div className="lingva-tile-answer" aria-label="Собранная фраза">{tiles.map((index,i)=><button type="button" key={i} disabled={Boolean(feedback)} onClick={()=>setTiles(list=>list.filter((_,j)=>j!==i))}>{task.tiles![index]}</button>)}</div><div className="lingva-tiles">{task.tiles!.map((word,index)=><button type="button" key={index} disabled={tiles.includes(index)||Boolean(feedback)} onClick={()=>setTiles(list=>[...list,index])}>{word}</button>)}</div></>:<Field label="Ваш ответ"><input value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={4000} disabled={busy||Boolean(feedback)} autoComplete="off" autoCapitalize="none"/></Field>}
 {!feedback&&<div className="form-actions"><Button type="submit" disabled={busy||!(task.kind==='tiles'?tiles.length:answer.trim())}>{busy?'Проверяем…':'Проверить ответ'}</Button><Button secondary disabled={busy} onClick={()=>void submit(true)}>{task.audio?'Сейчас не могу слушать':'Пропустить и повторить в конце'}</Button></div>}
 </form>
 {feedback&&<div className={'lingva-feedback '+(feedback.correct?'right':'incorrect')} role="status"><strong>{feedback.correct?'Верно!':'Повторим это задание ещё раз.'}</strong><p>Ответ: {feedback.expected}</p><Button onClick={()=>reset(feedback)}>Продолжить</Button></div>}
 <button className="text-link" onClick={()=>{audio.stop();setSession(null);setFeedback(null);}}>Закончить практику</button>
 </>}
 </Panel>;
}
