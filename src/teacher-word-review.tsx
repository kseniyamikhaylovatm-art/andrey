import {useId,useState} from 'react';
import {Shuffle} from 'lucide-react';
import {shuffle} from './practice-choices';
import type {Card} from './types';
import {Button,Empty,Panel} from './ui';

export function TeacherWordReview({cards}:{cards:Card[]}){
  const [ids,setIds]=useState<string[]>([]);
  const [revealed,setRevealed]=useState<string>();
  const prefix=useId();
  const available=new Map<string,Card>();
  for(const card of cards){
    const word=card.es.trim();
    if(card.enabled&&word){
      available.set(word.normalize('NFC').toLocaleLowerCase('es').replace(/\s+/g,' '),card);
    }
  }

  const words=ids.map(id=>cards.find(card=>card.id===id)).filter((card):card is Card=>Boolean(card?.enabled));

  return <Panel>
    <div className="section-heading teacher-review-heading">
      <h2>Повтор слов</h2>
      <Button disabled={!available.size} onClick={()=>{setRevealed(undefined);setIds(shuffle([...available.values()]).slice(0,10).map(card=>card.id));}}>
        <Shuffle size={18}/> {words.length?'Выбрать ещё раз':'Выбрать 10 случайных слов'}
      </Button>
    </div>
    {!available.size&&<Empty>В базе ученика пока нет включённых слов.</Empty>}
    <div aria-live="polite">
      {!!words.length&&<ul className="teacher-review-words" lang="es">
        {words.map(card=>{
          const open=revealed===card.id;
          const translationId=prefix+'-'+card.id;
          return <li key={card.id}
            onPointerEnter={event=>{if(event.pointerType==='mouse')setRevealed(card.id);}}
            onPointerLeave={event=>{if(event.pointerType==='mouse')setRevealed(current=>current===card.id?undefined:current);}}>
            <button type="button" className="teacher-review-word" aria-expanded={open} aria-controls={translationId}
              onClick={()=>setRevealed(current=>current===card.id?undefined:card.id)}
              onBlur={()=>setRevealed(current=>current===card.id?undefined:current)}
              onKeyDown={event=>{if(event.key==='Escape')setRevealed(undefined);}}>
              {card.es.trim()}
            </button>
            <span className="teacher-review-translation" id={translationId} lang="ru" hidden={!open}>
              {card.ru.trim()||'Перевод не добавлен'}
            </span>
          </li>;
        })}
      </ul>}
    </div>
  </Panel>;
}
