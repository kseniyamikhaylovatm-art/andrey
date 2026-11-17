import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Mic,ArrowUpRight,Info,Check,RefreshCw,LogOut,Download,Menu,X,Users} from 'lucide-react';
import {AppContext,tabs,type Tab} from './context';
import {readRoute,routeHash} from './navigation';
import type {AppState,AccessSession,WorkspaceMeta} from './types';
import {api,workspaceApi,uploadPdf,ApiError} from './api';
import {Button,Loading} from './ui';
import {PlanPage,CabinetPage,StudentLessonsPage,ProgressPage,PaymentPage} from './overview';
import {CardsPage} from './cards';
import {VerbsPage} from './verbs';
import {SpeechPage,ListeningPage} from './speech';
import {TeacherRoster} from './teacher-roster';
import {WordsPage} from './words';
import './styles.css';
import './theme.css';

const components={plan:PlanPage,words:WordsPage,cabinet:CabinetPage,cards:CardsPage,verbs:VerbsPage,speech:SpeechPage,listening:ListeningPage,progress:ProgressPage,payment:PaymentPage};
function App(){
  const [session,setSession]=useState<AccessSession|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState(''),[toast,setToast]=useState(''),[code,setCode]=useState(''),[saving,setSaving]=useState(false);
  const notify=useCallback((text:string)=>setToast(text),[]);
  const init=useCallback(async()=>{try{const value=await api<AccessSession>('/session');setSession(value);if(value.role==='teacher'){setSelected(sessionStorage.getItem('mi:selected-student')||(!value.protected?'legacy':null));}setError('');}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{void init();},[init]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(timer);},[toast]);
  const choose=(id:string|null)=>{setSelected(id);if(id)sessionStorage.setItem('mi:selected-student',id);else sessionStorage.removeItem('mi:selected-student');location.hash='plan';};
  const expired=useCallback(()=>{setSession(null);setSelected(null);void init();},[init]);
  async function logout(){try{await api('/logout',{});sessionStorage.removeItem('mi:selected-student');for(const key of Object.keys(sessionStorage))if(key.startsWith('mi:draft:'))sessionStorage.removeItem(key);setSession(null);setSelected(null);setCode('');await init();}catch(e){notify((e as Error).message);}}
  let page;
  if(error&&!session)page=<main className="login-screen"><h1>Не удалось загрузить приложение</h1><p role="alert">{error}</p><Button onClick={()=>void init()}>Попробовать ещё раз</Button></main>;
  else if(!session)page=<Loading/>;
  else if(!session.authenticated)page=<main className="login-screen"><div className="brand-monogram" aria-hidden="true">ñ</div><h1>Mi español</h1><p>Вход в личный кабинет</p><form onSubmit={async e=>{e.preventDefault();setSaving(true);try{await api('/login',{code});setCode('');sessionStorage.removeItem('mi:selected-student');await init();}catch(e){notify((e as Error).message);}finally{setSaving(false);}}}><label>Личный код доступа<input type="password" value={code} onChange={e=>setCode(e.target.value)} required maxLength={512} autoComplete="current-password"/></label><Button type="submit" disabled={saving}>{saving?'Входим…':'Войти'}<ArrowUpRight size={18}/></Button></form><p className="login-help">Код ученика открывает его кабинет. Преподаватель входит по отдельному личному коду.</p>{!session.teacherConfigured&&<p className="small muted">Вход преподавателя ещё не настроен.</p>}</main>;
  else if(session.role==='teacher'&&!selected)page=<div className="app-shell"><WorkspaceHeader teacher logout={session.protected?logout:undefined}/><div className="workspace-main"><main className="content roster-content">{session.demo&&<TrialNotice/>}<TeacherRoster openStudent={choose} notify={notify} expired={expired}/></main></div></div>;
  else {const studentId=session.role==='student'?session.studentId!:selected!;page=<StudentWorkspace key={session.role+':'+studentId} studentId={studentId} session={session} notify={notify} expired={expired} logout={logout} roster={()=>choose(null)}/>;}
  return <>{page}{toast&&<div className="toast" role="status"><Check size={18}/><span>{toast}</span><button className="icon-btn" aria-label="Скрыть уведомление" onClick={()=>setToast('')}><X size={16}/></button></div>}</>;
}

function TrialNotice(){return <div className="notice" role="note"><Info size={19}/><span><strong>Пробная версия.</strong> После сна или перезапуска сайта данные могут сброситься. Для постоянной работы с учениками нужно постоянное хранилище.</span></div>;}

function WorkspaceHeader({teacher,name,children,logout}:{teacher:boolean;name?:string;children?:React.ReactNode;logout?:()=>void}){
  return <header className={'workspace-header '+(!name?'teacher-roster-header':'')}><div className="masthead"><a className="masthead-brand" href="#plan"><span className="brand-monogram" aria-hidden="true">ñ</span><span><strong>MI ESPAÑOL</strong><small>Слова, фразы и грамматика из занятий</small></span></a><div className="masthead-actions"><span className="header-pill workspace-access">{teacher?'Преподаватель':'Ученик'}</span>{children}{logout&&<button aria-label="Выйти" className="icon-btn" onClick={logout}><LogOut size={18}/></button>}<span className="profile-medallion" title={name||'Преподаватель'}>{name?name.split(' ').slice(0,2).map(part=>part[0]).join('').toUpperCase():'П'}</span></div></div></header>;
}

function StudentWorkspace({studentId,session,notify,expired,logout,roster}:{studentId:string;session:AccessSession;notify:(message:string)=>void;expired:()=>void;logout:()=>void;roster:()=>void}){
  const client=useMemo(()=>workspaceApi(studentId),[studentId]);
  const [data,setData]=useState<{state:AppState;meta:WorkspaceMeta}|null>(null),[error,setError]=useState(''),[route,setRoute]=useState(readRoute),[mobile,setMobile]=useState(false);
  const teacher=session.role==='teacher',tab=route.tab;
  const refresh=useCallback(async()=>{try{const result=await client<NonNullable<typeof data>>('/state');setData(result);setError('');}catch(e){if(e instanceof ApiError&&e.status===401)expired();else setError((e as Error).message);throw e;}},[client,expired]);
  useEffect(()=>{void refresh().catch(()=>{});const hash=()=>{setRoute(readRoute());setMobile(false);};window.addEventListener('hashchange',hash);return()=>window.removeEventListener('hashchange',hash);},[refresh]);
  useEffect(()=>{const focus=()=>{void refresh().catch(()=>notify('Не удалось обновить данные.'));};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[refresh,notify]);
  const go=useCallback((id:Tab,options?:Record<string,string>)=>{location.hash=routeHash(id,options);setRoute(readRoute());window.scrollTo({top:0,behavior:'smooth'});},[]);
  async function run<T,>(task:()=>Promise<T>,success?:string):Promise<T|undefined>{try{const result=await task();await refresh();if(success)notify(success);return result;}catch(e){if(e instanceof ApiError&&e.status===401)expired();else notify((e as Error).message);return undefined;}}
  if(error&&!data)return <div className="login-screen"><h1>Не удалось открыть кабинет</h1><p role="alert">{error}</p><Button onClick={()=>void refresh().catch(()=>{})}>Попробовать ещё раз</Button>{teacher&&<Button secondary onClick={roster}>Мои ученики</Button>}</div>;
  if(!data)return <Loading/>;
  const Page=tab==='cabinet'&&!teacher?StudentLessonsPage:components[tab],due=data.state.cards.filter(c=>c.enabled&&(c.seen===0||Date.parse(c.due)<=Date.now())).length;
  const available=tabs,exportURL='/api/export?studentId='+encodeURIComponent(studentId);
  return <AppContext.Provider value={{...data,api:client,uploadPdf:file=>uploadPdf(file,studentId),refresh,notify,go,run}}><div className="app-shell">
    <WorkspaceHeader teacher={teacher} name={data.meta.student.name} logout={data.meta.protected?logout:undefined}>
      {teacher&&<button className="header-pill students-link" onClick={roster}><Users size={18}/>Мои ученики</button>}
      <button className="header-pill voice-link" onClick={()=>go('speech')} title="Открыть речевую практику"><Mic size={18}/><span>Голос</span></button>
      <button className="icon-btn" title="Обновить данные" aria-label="Обновить данные" onClick={()=>void refresh().catch(()=>{})}><RefreshCw size={18}/></button>
      <a href={exportURL} className="icon-btn" title="Скачать резервную копию" aria-label="Скачать резервную копию"><Download size={19}/></a>
      <button className="icon-btn navigation-toggle" aria-label={mobile?'Закрыть меню':'Открыть меню'} aria-expanded={mobile} aria-controls="main-navigation" onClick={()=>setMobile(!mobile)}>{mobile?<X size={24}/>:<Menu size={24}/>}</button>
    </WorkspaceHeader>
    <div className="workspace-main"><nav id="main-navigation" className={'primary-nav '+(mobile?'is-open':'')} aria-label="Основная навигация">{available.map(item=><a key={item.id} href={'#'+item.id} className={tab===item.id?'active':''} aria-current={tab===item.id?'page':undefined}><span>{item.id==='cabinet'?(teacher?'Кабинет':'Уроки'):item.label}</span>{item.id==='cards'&&due>0&&<span className="nav-count">{due}</span>}</a>)}<div className="mobile-utilities">{teacher&&<button className="text-link" onClick={roster}><Users size={17}/> Мои ученики</button>}<button className="text-link" onClick={()=>void refresh().catch(()=>{})}><RefreshCw size={17}/> Обновить данные</button><a href={exportURL} className="text-link"><Download size={17}/> Скачать резервную копию</a>{data.meta.protected&&<button className="text-link" onClick={logout}><LogOut size={17}/> Выйти</button>}</div></nav>
      <div className="student-context"><span>{teacher?'Кабинет ученика:':'Ваш кабинет:'}</span><span className="student-name">{data.meta.student.name} <span>· {data.state.plan.level.split('·')[0].trim()}</span></span><span className="context-caption">{teacher?'Доступ преподавателя':'Личные материалы и прогресс'}</span></div>
      <main className="content" key={tab+route.search}>{data.meta.demo&&<TrialNotice/>}{error&&<p role="alert">{error}</p>}<Page/></main><footer className="footer"><span>Mi español · {data.meta.student.name}</span><span>Учебные материалы и практика</span></footer>
    </div></div></AppContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
