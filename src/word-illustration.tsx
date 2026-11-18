import {useState} from 'react';
import {CircleHelp} from 'lucide-react';
import type {Card} from './types';
/** Small local scenes; no external image search or paid image generation. */
function scene(card:Card){const value=(card.es+' '+card.ru).toLocaleLowerCase('es');
 if(/comedor|comida|compra|mercado|cuenta|tomate|столов|продукт|рынок|счёт|покуп/.test(value))return 'food';
 if(/colegio|escuela|beca|учеб|школ|стипенд|estudi|clase/.test(value))return 'school';
 if(/cuidado|cuidar|осторож|забот/.test(value))return 'care';
 if(/casa|piso|casera|vecin|barrio|puerta|vivienda|дом|квартир|сосед|район|двер/.test(value))return 'home';
 if(/viaj|billet|llegar|autob|viaje|поезд|путешеств|билет|прибы/.test(value))return 'travel';
 if(/ola|surf|mar|brisa|волна|волн|сёрф|бриз|море/.test(value))return 'sea';
 if(/tiempo|tarde|mañana|hora|время|поздно|завтра|час/.test(value))return 'time';
 if(/habl|decir|pregunt|contar|acuerdo|entend|сказ|говор|спрос|соглас|поним/.test(value))return 'talk';
 if(/famil|herman|madre|hijo|familia|семь|брат|мать|ребён/.test(value))return 'people';
 return 'book';
}
export function CardIllustration({card,concealed=false}:{card:Card;concealed?:boolean}){const [failed,setFailed]=useState('');const kind=scene(card);
 if(concealed)return <span className="choice-illustration concealed-illustration" aria-hidden="true"><CircleHelp size={38} strokeWidth={1.3}/></span>;
 if(card.imageUrl&&failed!==card.imageUrl)return <span className="choice-illustration"><img src={card.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(card.imageUrl||'')}/></span>;
 return <span className={'choice-illustration scene-'+kind}><svg viewBox="0 0 180 120" aria-hidden="true" focusable="false"><rect x="4" y="4" width="172" height="112" rx="20" fill="#f3e8d6"/><circle cx="139" cy="28" r="14" fill="#e4c98f" opacity=".65"/><path d="M18 100h144" stroke="#d0b88c" strokeWidth="2"/>
 <g stroke="#244457" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
 {kind==='home'&&<><path d="m38 58 49-35 49 35" fill="#c59c61"/><path d="M48 52v47h78V52L87 24Z" fill="#fffaf1"/><path d="M76 99V71h23v28" fill="#c5d2ca"/><path d="M57 59h15v16H57Zm47 0h15v16h-15Z" fill="#dfc48a"/><path d="M146 99V68m-10 8q10-26 20 0" fill="#b6c7ac"/></>}
 {kind==='food'&&<><path d="M35 60h106l-12 39H47Z" fill="#fffaf1"/><path d="m54 57 14-25m53 25-14-25" fill="none"/><path d="M63 68v21m24-21v21m24-21v21" stroke="#c59c61"/><circle cx="64" cy="51" r="14" fill="#c9856f"/><path d="m64 37 7-9"/><path d="M87 57V32q14-10 19 1l-3 24" fill="#ddbd77"/><path d="M111 55q-9-26 8-30 16 6 8 30" fill="#a9bd9f"/></>}
 {kind==='school'&&<><path d="M35 98V49h112v49Z" fill="#fffaf1"/><path d="m26 49 65-29 65 29Z" fill="#c59c61"/><path d="M78 98V73h24v25" fill="#c5d2ca"/><path d="M48 62h14v15H48Zm72 0h14v15h-14Z" fill="#dfc48a"/><path d="M90 20V9m0 0h24l-7 8H90" fill="#c5d2ca"/></>}
 {kind==='care'&&<><path d="m90 20 45 17v26q-4 25-45 40-41-15-45-40V37Z" fill="#c5d2ca"/><path d="m68 61 15 15 29-33" fill="none" strokeWidth="6"/><path d="M23 47h13m-7-6v12m116 30h12m-6-6v12" stroke="#c59c61"/></>}
 {kind==='travel'&&<><rect x="38" y="40" width="103" height="55" rx="10" fill="#fffaf1"/><path d="M49 52h37v22H49Zm48 0h31v22H97Z" fill="#c5d2ca"/><circle cx="60" cy="96" r="9" fill="#244457"/><circle cx="120" cy="96" r="9" fill="#244457"/><path d="m60 32 28-16 28 16m-28-16v16" fill="none" stroke="#c59c61"/></>}
 {kind==='sea'&&<><path d="M21 81q20-19 39 0t39 0 39 0 23 0M21 97q20-19 39 0t39 0 39 0 23 0" fill="none" stroke="#7a9caa"/><path d="M53 66q-10-20 11-25h51q16 5 10 25Z" fill="#fffaf1"/><path d="M88 42V20l29 22Z" fill="#c59c61"/><path d="M52 66h73"/></>}
 {kind==='time'&&<><circle cx="87" cy="60" r="38" fill="#fffaf1"/><path d="M87 60V37m0 23 19 12" strokeWidth="4"/><path d="M87 26v5m0 58v5m-34-34h5m59 0h5" stroke="#c59c61"/><path d="m128 23 13-7m-3 24 13-1" fill="none"/></>}
 {kind==='talk'&&<><path d="M24 30h90v43H66L48 87V73H24Z" fill="#fffaf1"/><path d="M77 56h76v36h-21l-2 15-19-15H77Z" fill="#c5d2ca"/><path d="M39 44h59M39 58h24m30 11h43m-43 10h30" stroke="#c59c61"/></>}
 {kind==='people'&&<><circle cx="58" cy="42" r="15" fill="#d8b393"/><circle cx="121" cy="42" r="15" fill="#d8b393"/><path d="M29 98V81q29-40 58 0v17" fill="#c5d2ca"/><path d="M91 98V81q29-40 58 0v17" fill="#fffaf1"/><path d="m80 30 9 8 9-8" fill="none" stroke="#c59c61"/></>}
 {kind==='book'&&<><path d="M90 38q-25-17-54-7v59q29-10 54 7 25-17 54-7V31q-29-10-54 7Z" fill="#fffaf1"/><path d="M90 38v59M48 45q14-3 28 4M48 58q14-3 28 4m27-13q14-7 28-4m-28 17q14-7 28-4" fill="none" stroke="#c59c61"/><path d="m61 28 6-13 8 16" fill="#c5d2ca"/></>}
 </g></svg></span>;
}
