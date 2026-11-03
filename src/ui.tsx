import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X, ArrowUpRight, LoaderCircle, Volume2, Snail } from 'lucide-react';
import { speak } from './api';
export function Modal({title,children,close,wide=false}:{title:string;children:ReactNode;close:()=>void;wide?:boolean}){
  const heading=useId();const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const before=document.activeElement as HTMLElement;const el=ref.current;const focus=()=>el?.querySelector<HTMLElement>('input,textarea,select,button')?.focus();focus();const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close();if(e.key==='Tab'&&el){const focusable=[...el.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href]')].filter(e=>!e.hasAttribute('disabled'));const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',onKey);const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;before?.focus();};},[close]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div ref={ref} className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-labelledby={heading}><div className="section-heading"><h2 id={heading}>{title}</h2><button className="icon-btn" onClick={close} aria-label="Закрыть"><X size={20}/></button></div>{children}</div></div>;
}
export function Button({children,onClick,secondary=false,disabled=false,type='button',className=''}:{children:ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean;type?:'submit'|'button';className?:string}){return <button type={type} disabled={disabled} onClick={onClick} className={`button ${secondary?'secondary':''} ${className}`}>{children}</button>;}
export function SectionTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}){return <header className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</header>;}
export function Panel({children,className=''}:{children:ReactNode;className?:string}){return <section className={'panel '+className}>{children}</section>;}
export function Empty({children}:{children:ReactNode}){return <p className="empty">{children}</p>;}
export function Badge({children,gold=false}:{children:ReactNode;gold?:boolean}){return <span className={'badge '+(gold?'gold':'')}>{children}</span>;}
export function Stat({label,value,detail,icon}:{label:string;value:ReactNode;detail?:string;icon:ReactNode}){return <div className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div>{detail&&<small>{detail}</small>}</div>;}
export function Loading(){return <div className="loading" role="status"><LoaderCircle className="spin"/> Загружаем ваш испанский…</div>;}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
export function Sound({text,notify}:{text:string;notify:(s:string)=>void}){return <span className="sound-buttons"><button title="Обычная озвучка" aria-label="Озвучить по-испански" className="icon-btn" onClick={()=>{try{speak(text);}catch(e){notify((e as Error).message);}}}><Volume2 size={21}/></button><button title="Медленная озвучка" aria-label="Озвучить медленно" className="icon-btn" onClick={()=>{try{speak(text,true);}catch(e){notify((e as Error).message);}}}><Snail size={20}/></button></span>;}
export function TextArrow({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button className="text-link" onClick={onClick}>{children}<ArrowUpRight size={16}/></button>;}
export function useDraft(key:string,initial=''){
  const [value,setValue]=useState(()=>{try{return localStorage.getItem('mi:'+key)||initial;}catch{return initial;}});
  useEffect(()=>{try{localStorage.setItem('mi:'+key,value);}catch{/* storage unavailable */}},[key,value]);
  return [value,setValue] as const;
}
