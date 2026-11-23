import {useState} from 'react';
import {Shuffle} from 'lucide-react';
import {shuffle} from './practice-choices';
import type {Card} from './types';
import {Button,Empty,Panel} from './ui';

export function TeacherWordReview({cards}:{cards:Card[]}){
  const [words,setWords]=useState<string[]>([]);
  const available=new Map<string,string>();
  for(const card of cards){
    const word=card.es.trim();
    if(card.enabled&&word){
      available.set(word.normalize('NFC').toLocaleLowerCase('es').replace(/\s+/g,' '),word);
    }
  }

  return <Panel>
    <div className="section-heading teacher-review-heading">
      <h2>Повтор слов</h2>
      <Button disabled={!available.size} onClick={()=>setWords(shuffle([...available.values()]).slice(0,10))}>
        <Shuffle size={18}/> {words.length?'Выбрать ещё раз':'Выбрать 10 случайных слов'}
      </Button>
    </div>
    {!available.size&&<Empty>В базе ученика пока нет включённых слов.</Empty>}
    <div aria-live="polite">
      {!!words.length&&<ul className="teacher-review-words" lang="es">
        {words.map(word=><li key={word}>{word}</li>)}
      </ul>}
    </div>
  </Panel>;
}
