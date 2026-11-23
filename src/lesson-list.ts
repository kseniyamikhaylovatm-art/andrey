import type {Example} from './types';
import {parseCardPairs} from './card-pairs';
export function lessonList(text:string){
 const result:{es:string;ru?:string;example?:Example}[]=[];
 for(const [index,raw] of text.split(/\r?\n/).entries()){
  const [pair,exampleText,exampleTranslation,...extra]=raw.split('|').map(part=>part.trim());
  const line=pair.replace(/^(?:[•●▪*]\s*|\d+[.)]\s+)/u,'');if(!raw.trim())continue;
  if(!line||extra.length||(!exampleText&&exampleTranslation)||[exampleText,exampleTranslation].some(part=>part&&part.length>4000)){
   throw new Error('Проверьте пример в строке '+(index+1)+'. Формат: слово — перевод | пример | перевод примера.');
  }
  const example=exampleText?{es:exampleText,ru:exampleTranslation||''}:undefined;
  const parsed=parseCardPairs(line);if(parsed.cards.length===1&&!parsed.issues.length){result.push({...parsed.cards[0],example});continue;}
  if(line.length>4000||/[—–]|\s-\s|[А-Яа-яЁё]/u.test(line))throw new Error('Проверьте строку '+(index+1)+': введите испанское слово или пару «слово — перевод».');
  result.push({es:line,example});
 }
 if(!result.length||result.length>100)throw new Error('Добавьте от 1 до 100 строк за один раз.');
 return result;
}
