import type {Card,Lesson} from './types';

export function lessonCards(cards:Card[],lesson?:Lesson){
  const byId=new Map(cards.map(card=>[card.id,card]));
  return [...new Set(lesson?.cardIds||[])].map(id=>byId.get(id)).filter((card):card is Card=>Boolean(card));
}
export function lessonDate(date:string){const value=new Date(date);return Number.isNaN(+value)?'Выберите дату':new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(value);}
