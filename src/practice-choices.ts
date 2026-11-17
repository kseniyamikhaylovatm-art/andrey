import type {Card} from './types';
export type ChoiceDirection='es-ru'|'ru-es';
const key=(text:string)=>text.normalize('NFC').toLocaleLowerCase('es').trim().replace(/\s+/g,' ').replace(/[.!?¿¡]+$/g,'');
export const choiceLabel=(card:Card,direction:ChoiceDirection)=>direction==='es-ru'?card.ru:card.es;
export function choiceCorrect(card:Card,selected:Card,direction:ChoiceDirection){return key(choiceLabel(card,direction))===key(choiceLabel(selected,direction))||(direction==='ru-es'&&key(card.ru)===key(selected.ru));}
const shuffle=<T>(list:T[])=>{const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
export function practiceChoices(cards:Card[],target:Card,direction:ChoiceDirection){
 const seen=new Set([key(choiceLabel(target,direction))]),options=[target];
 for(const card of shuffle(cards.filter(c=>c.enabled&&c.id!==target.id))){const label=key(choiceLabel(card,direction));if(seen.has(label)||choiceCorrect(target,card,direction))continue;seen.add(label);options.push(card);if(options.length===4)break;}
 return shuffle(options);
}
