import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X, ArrowUpRight, LoaderCircle, Volume2, Snail } from 'lucide-react';
import { speak } from './api';
import {useApp} from './context';
export function Modal({title,children,close,wide=false}:{title:string;children:ReactNode;close:()=>void;wide?:boolean}){
  const heading=useId();const ref=useRef<HTMLDivElement>(null),latestClose=useRef(close);latestClose.current=close;
  useEffect(()=>{
    const before=document.activeElement as HTMLElement|null,el=ref.current;
    const controls=()=>el?[...el.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href]')].filter(item=>!item.hasAttribute('disabled')&&item.getClientRects().length>0):[];
    const firstInput=el?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled])');
    (firstInput||controls()[0])?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();latestClose.current();}
      if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',onKey);const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;if(before?.isConnected)before.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div ref={ref} className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-labelledby={heading}><div className="section-heading"><h2 id={heading}>{title}</h2><button className="icon-btn" onClick={close} aria-label="Закрыть"><X size={20}/></button></div>{children}</div></div>;
}
export function Button({children,onClick,secondary=false,disabled=false,type='button',className=''}:{children:ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean;type?:'submit'|'button';className?:string}){return <button type={type} disabled={disabled} onClick={onClick} className={`button ${secondary?'secondary':''} ${className}`}>{children}</button>;}
export function SectionTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}){return <header className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</header>;}
export function Panel({children,className=''}:{children:ReactNode;className?:string}){return <section className={'panel '+className}>{children}</section>;}
export function Empty({children}:{children:ReactNode}){return <p className="empty">{children}</p>;}
export function Badge({children,gold=false}:{children:ReactNode;gold?:boolean}){return <span className={'badge '+(gold?'gold':'')}>{children}</span>;}
export function Stat({label,value,detail,icon}:{label:string;value:ReactNode;detail?:string;icon:ReactNode}){return <div className="stat"><span className="stat-icon" aria-hidden="true">{icon}</span><div className="stat-copy"><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{detail&&<small>{detail}</small>}</div></div>;}
export function Loading(){return <div className="loading" role="status"><LoaderCircle className="spin"/> Загружаем ваш испанский…</div>;}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
export function Sound({text,notify}:{text:string;notify:(s:string)=>void}){return <span className="sound-buttons"><button title="Обычная озвучка" aria-label="Озвучить по-испански" className="icon-btn" onClick={()=>{try{speak(text);}catch(e){notify((e as Error).message);}}}><Volume2 size={21}/></button><button title="Медленная озвучка" aria-label="Озвучить медленно" className="icon-btn" onClick={()=>{try{speak(text,true);}catch(e){notify((e as Error).message);}}}><Snail size={20}/></button></span>;}
export function TextArrow({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button className="text-link" onClick={onClick}>{children}<ArrowUpRight size={16}/></button>;}
export function useDraft(key:string,initial=''){
  const {meta}=useApp();const scoped='mi:draft:'+meta.role+':'+meta.student.id+':'+key;
  const [value,setValue]=useState(()=>{try{return sessionStorage.getItem(scoped)||initial;}catch{return initial;}});
  useEffect(()=>{try{sessionStorage.setItem(scoped,value);}catch{/* storage unavailable */}},[scoped,value]);
  return [value,setValue] as const;
}
