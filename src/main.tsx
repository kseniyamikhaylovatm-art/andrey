import React, {useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Mic,ArrowUpRight,Sun,Check,RefreshCw,LogOut,Download,Menu,X} from 'lucide-react';
import {AppContext,tabs,type Tab} from './context';
import type {AppState} from './types';
import {api} from './api';
import {Button,Loading} from './ui';
import {PlanPage,CabinetPage,ProgressPage,PaymentPage} from './overview';
import {CardsPage} from './cards';
import {VerbsPage} from './verbs';
import {SpeechPage,ListeningPage} from './speech';
import './styles.css';
import './theme.css';
const components={plan:PlanPage,cabinet:CabinetPage,cards:CardsPage,verbs:VerbsPage,speech:SpeechPage,listening:ListeningPage,progress:ProgressPage,payment:PaymentPage};
function App(){
  const [session,setSession]=useState<{authenticated:boolean;protected:boolean}|null>(null);
  const [data,setData]=useState<{state:AppState;meta:{ai:boolean;protected:boolean;verbs:string[];demo?:boolean}}|null>(null);
  const [tab,setTab]=useState<Tab>(()=>tabs.find(x=>x.id===location.hash.slice(1))?.id||'plan');
  const [error,setError]=useState(''),[toast,setToast]=useState(''),[code,setCode]=useState(''),[mobile,setMobile]=useState(false),[saving,setSaving]=useState(false);
  const notify=useCallback((s:string)=>setToast(s),[]);
  const refresh=useCallback(async()=>{const result=await api<NonNullable<typeof data>>('/state');setData(result);},[]);
  const init=useCallback(async()=>{try{const s=await api<NonNullable<typeof session>>('/session');setSession(s);if(s.authenticated)await refresh();setError('');}catch(e){setError((e as Error).message);}},[refresh]);
  useEffect(()=>{void init();const hash=()=>{setTab(tabs.find(x=>x.id===location.hash.slice(1))?.id||'plan');setMobile(false);};window.addEventListener('hashchange',hash);return()=>window.removeEventListener('hashchange',hash);},[init]);
  useEffect(()=>{if(toast){const timeout=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(timeout);}},[toast]);
  useEffect(()=>{if(!session?.authenticated)return;const onFocus=()=>{void refresh().catch(()=>notify('Не удалось обновить данные. Проверьте соединение.'));};window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);},[session,refresh,notify]);
  const go=useCallback((id:Tab)=>{location.hash=id;setTab(id);window.scrollTo({top:0,behavior:'smooth'});},[]);
  async function run<T,>(task:()=>Promise<T>,success?:string):Promise<T|undefined>{try{const result=await task();await refresh();if(success)notify(success);return result;}catch(e){notify((e as Error).message);return undefined;}}
  if(error&&!data)return <div className="login-screen"><h1>Вернёмся к испанскому</h1><p role="alert">{error}</p><Button onClick={()=>void init()}>Попробовать ещё раз</Button></div>;
  if(session&&!session.authenticated)return <main className="login-screen"><div className="brand-sun"><Sun size={36}/></div><div className="eyebrow">АНДРЕЙ И ТАНЯ</div><h1>Mi español<span>.</span></h1><p>Ваш маленький шаг к большой жизни в Испании.</p><form onSubmit={async e=>{e.preventDefault();setSaving(true);try{await api('/login',{code});await init();}catch(e){notify((e as Error).message);}finally{setSaving(false);}}}><label>Общий код доступа<input type="password" value={code} onChange={e=>setCode(e.target.value)} required autoComplete="current-password"/></label><Button type="submit" disabled={saving}>{saving?'Входим…':'Войти в свой испанский'}<ArrowUpRight size={18}/></Button></form>{toast&&<p role="alert">{toast}</p>}</main>;
  if(!data)return <Loading/>;
  const Page=components[tab];const due=data.state.cards.filter(c=>c.enabled&&(c.seen===0||Date.parse(c.due)<=Date.now())).length;
  return <AppContext.Provider value={{...data,refresh,notify,go,run}}><div className="app-shell">
    <header className="workspace-header">
      <div className="masthead">
        <a className="masthead-brand" href="#plan" onClick={()=>setMobile(false)}><span className="brand-monogram" aria-hidden="true">ñ</span><span><strong>MI ESPAÑOL</strong><small>Слова, фразы и грамматика из занятий</small></span></a>
        <div className="masthead-actions">
          <button className="header-pill voice-link" onClick={()=>go('speech')} title="Открыть речевую практику"><Mic size={18}/><span>Голос</span></button>
          <span className="header-pill workspace-access">Общий кабинет</span>
          <button className="icon-btn" title="Обновить данные" aria-label="Обновить данные" onClick={()=>void run(()=>api('/state'))}><RefreshCw size={18}/></button>
          <a href="/api/export" className="icon-btn" title="Скачать резервную копию" aria-label="Скачать резервную копию"><Download size={19}/></a>
          {data.meta.protected&&<button aria-label="Выйти" className="icon-btn" onClick={async()=>{await api('/logout',{});setData(null);await init();}}><LogOut size={18}/></button>}
          <span className="profile-medallion" title="Андрей и Таня">АТ</span>
          <button className="icon-btn navigation-toggle" aria-label={mobile?'Закрыть меню':'Открыть меню'} aria-expanded={mobile} aria-controls="main-navigation" onClick={()=>setMobile(!mobile)}>{mobile?<X size={24}/>:<Menu size={24}/>}</button>
        </div>
      </div>
    </header>
    <div className="workspace-main">
      <nav id="main-navigation" className={'primary-nav '+(mobile?'is-open':'')} aria-label="Основная навигация">{tabs.map(x=><a key={x.id} href={'#'+x.id} className={tab===x.id?'active':''} aria-current={tab===x.id?'page':undefined} onClick={()=>setMobile(false)}><span>{x.label}</span>{x.id==='cards'&&due>0&&<span className="nav-count">{due}</span>}</a>)}<div className="mobile-utilities"><button className="text-link" onClick={()=>void run(()=>api('/state'))}><RefreshCw size={17}/> Обновить данные</button><a href="/api/export" className="text-link"><Download size={17}/> Скачать резервную копию</a>{data.meta.protected&&<button className="text-link" onClick={async()=>{await api('/logout',{});setData(null);await init();}}><LogOut size={17}/> Выйти</button>}</div></nav>
      <div className="student-context"><span>Ученики:</span><span className="student-name">Андрей и Таня <span>· {data.state.plan.level.split('·')[0].trim()}</span></span><span className="context-caption">Общий прогресс и материалы</span></div>
    <main className="content" key={tab}>{data.meta.demo&&<div className="notice" role="note"><Sun size={19}/><span><strong>Пробная версия.</strong> Здесь можно проверить тренировки. После сна или перезапуска сайта прогресс может сброситься. Настоящие оплаты и важные записи пока не вносите.</span></div>}<Page/></main><footer className="footer"><span>Mi español · В своём темпе, к своим целям</span><span>Hecho con calma <Sun size={13}/></span></footer></div>
    {toast&&<div className="toast" role="status"><Check size={18}/><span>{toast}</span><button className="icon-btn" aria-label="Скрыть уведомление" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </div></AppContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
