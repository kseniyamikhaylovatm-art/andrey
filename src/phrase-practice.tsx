import {useState} from 'react';
import {ArrowRight,Eye} from 'lucide-react';
import {useApp} from './context';
import type {Card,Example} from './types';
import {Button,Empty,Panel,Sound} from './ui';

export function PhrasePractice({cards}:{cards:Card[]}){
  const {meta,notify}=useApp();
  const [session,setSession]=useState<Example[]>([]);
  const [index,setIndex]=useState(0);
  const [shown,setShown]=useState(false);
  const pairs=new Map<string,Example>();
  for(const card of cards){
    if(!card.enabled)continue;
    const examples=card.examples.filter(example=>!example.level||example.level===meta.student.level);
    if(card.type==='chunk')examples.push(card);
    for(const {es,ru} of examples){
      if(es.trim()&&ru.trim()){
        const key=JSON.stringify([ru,es].map(text=>text.normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ')));
        pairs.set(key,{es,ru});
      }
    }
  }
  function start(){
    setSession([...pairs.values()]);
    setIndex(0);
    setShown(false);
  }

  const phrase=session[index];
  if(!phrase)return <Panel className="practice-start">
    <h2>{session.length?'Практика завершена':'Практика целых фраз'}</h2>
    {session.length>0&&<p>Фраз просмотрено: {session.length}</p>}
    {pairs.size?<Button onClick={start}>{session.length?'Повторить фразы':'Начать практику'} <ArrowRight size={18}/></Button>
      :<Empty>Здесь появятся фразы и примеры с русским переводом.</Empty>}
  </Panel>;

  return <div className="practice-layout memory-layout">
    <Panel className="practice-card anki-card">
      <div className="section-heading"><strong>Практика целых фраз</strong><span className="small muted">{index+1} / {session.length}</span></div>
      <div className="flashcard-word">
        <small>СКАЖИТЕ ПО-ИСПАНСКИ</small>
        <h2 lang="ru">{phrase.ru}</h2>
      </div>
      <div className="recall-hint">
        {shown?<div className="recall-reveal">
          <p className="recall-translation" lang="es" role="status">{phrase.es}</p>
          <Sound text={phrase.es} notify={notify}/>
          <Button onClick={()=>{setShown(false);setIndex(index+1);}}>
            {index+1===session.length?'Завершить':'Следующая фраза'} <ArrowRight size={18}/>
          </Button>
        </div>:<Button secondary onClick={()=>setShown(true)}><Eye size={19}/> Показать ответ</Button>}
      </div>
    </Panel>
  </div>;
}
