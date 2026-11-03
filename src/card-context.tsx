import {useEffect,useId,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,PenLine,Sparkles} from 'lucide-react';
import {api,speak} from './api';
import {useApp} from './context';
import {exampleTenseNames,exampleTenseDescriptions,type Card,type CardContextData,type Example,type ExampleTense} from './types';
import {Badge,Button,Empty,Field,Modal,Panel,Sound} from './ui';

const tenses=Object.keys(exampleTenseNames) as ExampleTense[];
const people=['yo','tú','él / ella','nosotros','vosotros','ellos / ellas'];

export function CardContext({card,revealed}:{card:Card;revealed:boolean}){
  const {state,meta,run,notify}=useApp();
  const [selected,setSelected]=useState<ExampleTense>('presente');
  const [data,setData]=useState<CardContextData|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false),[generating,setGenerating]=useState(false);
  const prefix=useId();
  const examplesKey=JSON.stringify(card.examples),tablesKey=JSON.stringify(state.verbTables);
  useEffect(()=>{
    if(!revealed)return;
    let cancelled=false;
    setLoading(true);setError('');
    api<CardContextData>('/cards/'+encodeURIComponent(card.id)+'/context').then(result=>{if(!cancelled)setData(result);}).catch(e=>{if(!cancelled)setError((e as Error).message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[card.id,revealed,examplesKey,tablesKey]);
  const index=tenses.indexOf(selected),active=data?.examples.filter(e=>e.tense===selected)||[];
  function move(offset:number,focus=false){
    const next=tenses[(index+offset+tenses.length)%tenses.length];setSelected(next);
    if(focus)document.getElementById(prefix+'-'+next)?.focus();
  }
  return <Panel className="tense-context">
    <div className="section-heading"><div><div className="eyebrow">ОДНО СЛОВО · РАЗНЫЕ СИТУАЦИИ</div><h2>Слово в разных временах</h2></div><BookOpen size={21}/></div>
    {!revealed?<Empty>Сначала попробуйте ответить. После ответа откроются шесть вкладок с примерами.</Empty>:<>
      <div className="tense-tabs" role="tablist" aria-label="Времена примеров" onKeyDown={e=>{
        if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1,true);}
        if(e.key==='Home'||e.key==='End'){e.preventDefault();const tense=e.key==='Home'?tenses[0]:tenses.at(-1)!;setSelected(tense);document.getElementById(prefix+'-'+tense)?.focus();}
      }}>{tenses.map((tense,i)=><button key={tense} id={prefix+'-'+tense} role="tab" aria-selected={selected===tense} aria-controls={prefix+'-panel'} tabIndex={selected===tense?0:-1} className={'tense-tab tone-'+i} onClick={()=>setSelected(tense)}><span>{i+1}</span>{exampleTenseNames[tense]}</button>)}</div>
      <div className="tense-example-panel" role="tabpanel" id={prefix+'-panel'} aria-labelledby={prefix+'-'+selected} aria-busy={loading}>
        <div className="tense-example-heading"><div><Badge gold>{exampleTenseDescriptions[selected]}</Badge><h3>{exampleTenseNames[selected]}</h3></div><div className="tense-arrows"><button className="icon-btn" aria-label="Предыдущее время" onClick={()=>move(-1)}><ChevronLeft size={21}/></button><button className="icon-btn" aria-label="Следующее время" onClick={()=>move(1)}><ChevronRight size={21}/></button></div></div>
        {loading?<p className="empty" role="status">Открываем примеры…</p>:error?<p className="form-error" role="alert">{error}</p>:<>
          {active.length?active.map((example,i)=><div className="example tense-example" key={i}>
            <div className="tense-sentence"><p lang="es">{example.es}</p><Sound text={example.es} notify={notify}/></div>
            <p className="tense-translation">{example.ru}</p>
            <small>{example.origin==='library'?'Стартовый учебный пример':'Пример из карточки'}</small>
          </div>):<Empty>Для «{card.es}» пока нет примера в этом времени. Добавьте предложение с переводом — оно сохранится в этой вкладке.</Empty>}
          {data?.forms[selected]&&<div className="tense-forms-section"><div className="eyebrow">{data.verb} · ФОРМЫ ДЛЯ ПОВТОРЕНИЯ</div><div className="tense-forms">{data.forms[selected]!.map((form,i)=><button key={i} title="Нажмите, чтобы послушать" aria-label={'Озвучить '+people[i]+': '+form} onClick={()=>{try{speak(form);}catch(e){notify((e as Error).message);}}}><small>{people[i]}</small><strong lang="es">{form}</strong></button>)}</div><p className="small muted">Нажмите на форму, чтобы послушать её.</p></div>}
          {data?.formNotes[selected]&&<p className="small muted">{data.formNotes[selected]}</p>}
          {!data?.verb&&active.length>0&&<p className="small muted">Время меняется в предложении. Само существительное не спрягается, а готовая фраза используется в контексте.</p>}
          <div className="panel-bottom"><button className="text-link" onClick={()=>setEditing(true)}><PenLine size={15}/>{active.length?'Исправить или добавить свой пример':'Добавить пример'}</button>{meta.ai&&<Button secondary disabled={generating} onClick={async()=>{setGenerating(true);await run(()=>api('/ai/cards/'+card.id+'/examples',{}),'Примеры добавлены. Проверьте их перед занятием.');setGenerating(false);}}><Sparkles size={15}/>{generating?'Готовим примеры…':'Дополнить с ИИ'}</Button>}</div>
        </>}
      </div>
      {!!data?.originalExamples.length&&<details className="context-materials"><summary>Примеры из материалов · {card.source}</summary>{data.originalExamples.map((example,i)=><div className="material-example" key={i}><p lang="es">{example.es}<Sound text={example.es} notify={notify}/></p><p className="muted">{example.ru}</p>{example.tense&&<small>{example.tense}</small>}</div>)}</details>}
      {editing&&<TenseExampleEditor card={card} tense={selected} example={active[0]} close={()=>setEditing(false)}/>}
    </>}
  </Panel>;
}

function TenseExampleEditor({card,tense,example,close}:{card:Card;tense:ExampleTense;example?:Example;close:()=>void}){
  const {run}=useApp();const [es,setEs]=useState(example?.es||''),[ru,setRu]=useState(example?.ru||''),[busy,setBusy]=useState(false);
  return <Modal title={card.es+' · '+exampleTenseNames[tense]} close={close}><form className="form" onSubmit={async e=>{
    e.preventDefault();setBusy(true);const result=await run(()=>api('/cards/'+card.id+'/tense-example',{tense,es,ru},'PUT'),'Пример сохранён');setBusy(false);if(result)close();
  }}><p className="small muted">Добавьте пример из своего урока. Он заменит стартовый пример только в выбранной вкладке.</p><Field label="Пример на испанском"><textarea lang="es" rows={3} value={es} onChange={e=>setEs(e.target.value)} required maxLength={4000}/></Field><Field label="Перевод примера"><textarea rows={3} value={ru} onChange={e=>setRu(e.target.value)} required maxLength={4000}/></Field><Button type="submit" disabled={busy||!es.trim()||!ru.trim()}>{busy?'Сохраняем…':'Сохранить пример'}</Button></form></Modal>;
}
