import React, {useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BookOpen,LayoutDashboard,Layers,PenLine,Mic,Headphones,ChartNoAxesCombined,Wallet,ArrowUpRight,Sun,Check,RefreshCw,LogOut,Download,Menu,X} from 'lucide-react';
import {AppContext,tabs,type Tab} from './context';
import type {AppState} from './types';
import {api} from './api';
import {Button,Loading} from './ui';
import {PlanPage,CabinetPage,ProgressPage,PaymentPage} from './overview';
import {CardsPage} from './cards';
import {VerbsPage} from './verbs';
import {SpeechPage,ListeningPage} from './speech';
import './styles.css';
const icons={plan:BookOpen,cabinet:LayoutDashboard,cards:Layers,verbs:PenLine,speech:Mic,listening:Headphones,progress:ChartNoAxesCombined,payment:Wallet};
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
    <aside className={'sidebar '+(mobile?'is-open':'')}>
      <a className="brand" href="#plan" onClick={()=>setMobile(false)}><span className="brand-sun"><Sun size={32} strokeWidth={1.3}/></span><span>Mi español<span className="gold-text">.</span><small>АНДРЕЙ И ТАНЯ</small></span></a>
      <div className="nav-caption">ВАШЕ ПРОСТРАНСТВО</div><nav aria-label="Основная навигация">{tabs.map(x=>{const Icon=icons[x.id];return <a key={x.id} href={'#'+x.id} className={tab===x.id?'active':''} aria-current={tab===x.id?'page':undefined} onClick={()=>setMobile(false)}><Icon size={19} strokeWidth={1.65}/><span>{x.label}</span>{x.id==='cards'&&due>0&&<span className="nav-count">{due}</span>}</a>;})}</nav>
      <div className="sidebar-note"><span className="tiny-sun">✺</span><p>Un poquito<br/>cada día.</p><small>Понемногу, каждый день.</small></div>
      <div className="sidebar-bottom"><div className="avatar">А<span>Т</span></div><div><strong>Андрей и Таня</strong><small>Вместе к свободной речи</small></div><span className="online-dot"/></div>
    </aside>{mobile&&<button className="mobile-scrim" aria-label="Закрыть меню" onClick={()=>setMobile(false)}/>}
    <div className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" aria-label="Открыть меню" onClick={()=>setMobile(!mobile)}>{mobile?<X size={22}/>:<Menu size={22}/>}</button><span>Мой испанский</span><span className="topbar-separator">/</span><strong>{tabs.find(t=>t.id===tab)?.label}</strong></div><div className="topbar-actions"><span className="level"><span/> {data.state.plan.level}</span><button className="icon-btn" title="Обновить данные" aria-label="Обновить данные" onClick={()=>void run(()=>api('/state'))}><RefreshCw size={16}/></button><a href="/api/export" className="icon-btn" title="Скачать резервную копию" aria-label="Скачать резервную копию"><Download size={17}/></a>{data.meta.protected&&<button aria-label="Выйти" className="icon-btn" onClick={async()=>{await api('/logout',{});setData(null);await init();}}><LogOut size={17}/></button>}</div></header>
    <main className="content" key={tab}>{data.meta.demo&&<div className="notice" role="note"><Sun size={19}/><span><strong>Пробная версия.</strong> Здесь можно проверить тренировки. После сна или перезапуска сайта прогресс может сброситься. Настоящие оплаты и важные записи пока не вносите.</span></div>}<Page/></main><footer className="footer"><span>Mi español · В своём темпе, к своим целям</span><span>Hecho con calma <Sun size={13}/></span></footer></div>
    {toast&&<div className="toast" role="status"><Check size={18}/><span>{toast}</span><button className="icon-btn" aria-label="Скрыть уведомление" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </div></AppContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
