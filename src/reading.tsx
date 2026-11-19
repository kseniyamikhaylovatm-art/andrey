import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,Plus,Upload} from 'lucide-react';
import {useApp} from './context';
import {readRoute} from './navigation';
const PdfReader=lazy(()=>import('./pdf-reader').then(module=>({default:module.PdfReader})));
import type {ReadingBook,ReadingLevel} from './types';
import {Button,Empty,Field,Loading,Modal,Panel,SectionTitle} from './ui';
const levels:ReadingLevel[]=['A1-A2','B1-B2','C1-C2'];
export function ReadingPage(){
 const {api,meta,go,notify}=useApp(),params=readRoute().params,level=params.get('level') as ReadingLevel|null,bookId=params.get('book'),[books,setBooks]=useState<ReadingBook[]>(),[adding,setAdding]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;void api<{books:ReadingBook[]}>('/library/books').then(result=>{if(active)setBooks(result.books);}).catch(()=>{if(active)setError('Не удалось загрузить книги.');});return()=>{active=false;};},[api]);
 if(!level||!levels.includes(level))return <section className="reading-levels" aria-label="Уровни чтения">{levels.map(level=><button className="reading-level-card" key={level} onClick={()=>go('reading',{level})}><BookOpen size={32} strokeWidth={1.4}/><strong>{level.replace('-','–')}</strong></button>)}</section>;
 if(error)return <Panel><p role="alert">{error}</p></Panel>;if(!books)return <Loading/>;const book=books.find(book=>book.id===bookId);
 if(book)return <Suspense fallback={<Loading/>}><PdfReader key={book.id} book={book} initialPage={Number(params.get('page'))||undefined} close={()=>go('reading',{level:book.level})}/></Suspense>;
 const selected=books.filter(book=>book.level===level);
 return <><button className="text-link" onClick={()=>go('reading')}><ArrowLeft size={17}/>Уровни</button><SectionTitle eyebrow="" title={level.replace('-','–')} action={meta.role==='teacher'?<Button onClick={()=>setAdding(true)}><Plus size={17}/>Добавить книгу</Button>:undefined}/><div className="reading-books">{selected.map(book=><button key={book.id} className="reading-book-card" onClick={()=>go('reading',{level,book:book.id})}><BookOpen size={32} strokeWidth={1.3}/><strong>{book.title}</strong><small>{book.pages} стр.</small></button>)}</div>{!selected.length&&<Panel><Empty>Книг пока нет.</Empty></Panel>}{adding&&<BookUpload level={level} close={()=>setAdding(false)} saved={book=>{setBooks(current=>current?.some(item=>item.id===book.id)?current:[...current||[],book]);setAdding(false);notify('Книга добавлена');}}/>}</>;
}
function BookUpload({level,close,saved}:{level:ReadingLevel;close:()=>void;saved:(book:ReadingBook)=>void}){
 const [title,setTitle]=useState(''),[file,setFile]=useState<File>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),working=useRef(false);
 return <Modal title="Добавить книгу" close={()=>!busy&&close()}><form className="form" onSubmit={async event=>{event.preventDefault();if(!file||working.current)return;working.current=true;setBusy(true);setError('');try{const response=await fetch('/api/library/books?'+new URLSearchParams({level,title}),{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error);saved(data);}catch(error){setError((error as Error).message);}finally{working.current=false;setBusy(false);}}}><Field label="Название книги"><input required maxLength={200} value={title} disabled={busy} onChange={event=>setTitle(event.target.value)}/></Field><Field label="PDF книги"><input type="file" accept="application/pdf,.pdf" required disabled={busy} onChange={event=>{const file=event.target.files?.[0];setFile(undefined);setError('');if(file&&file.size>30*1024*1024){setError('Выберите PDF до 30 МБ.');return;}setFile(file);if(file&&!title)setTitle(file.name.replace(/\.pdf$/i,''));}}/></Field><p className="small muted">Книга появится в разделе {level.replace('-','–')} у всех учеников. PDF до 30 МБ и 500 страниц.</p>{error&&<p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={busy||!file||!title.trim()}><Upload size={17}/>{busy?'Загружаем…':'Загрузить PDF'}</Button></form></Modal>;
}
