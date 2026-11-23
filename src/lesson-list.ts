import type {Example} from './types';
import {parseCardPairs} from './card-pairs';
function joinExampleBlocks(text:string){
 const blocks=text.split(/\n[^\S\n]*\n/);
 const linesByBlock=blocks.map(block=>block.trim().split('\n'));
 const cyrillic=/\p{Script=Cyrillic}/u;
 const isExampleBlock=(lines:string[])=>{
  const [pair,example,translation]=lines;
  if(lines.length<2||lines.length>3||lines.some(line=>line.includes('|')))return false;
  const parsed=parseCardPairs(pair);
  const isTranslation=translation===undefined||(cyrillic.test(translation)&&
    !parseCardPairs(translation).cards.some(card=>!cyrillic.test(card.es)&&cyrillic.test(card.ru)));
  return parsed.cards.length===1&&cyrillic.test(parsed.cards[0].ru)&&
    /\p{Script=Latin}/u.test(example)&&!cyrillic.test(example)&&
    isTranslation;
 };
 // Require a blank line between blocks. A lone block also works for a full sentence.
 return blocks.map((block,index)=>{
  const lines=linesByBlock[index];
  if(!isExampleBlock(lines)||(blocks.length===1&&!/[.!?…]\s*$/.test(lines[1])))return block;
  return lines.join(' | ')+'\n'.repeat(lines.length-1);
 }).join('\n\n');
}

export function lessonList(text:string){
 const result:{es:string;ru?:string;example?:Example}[]=[];
 for(const [index,raw] of joinExampleBlocks(text.replace(/\r\n?/g,'\n')).split('\n').entries()){
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
 if(!result.length)throw new Error('Добавьте хотя бы одну запись.');
 if(result.length>100)throw new Error('Распознано '+result.length+' записей. За один раз можно добавить до 100.');
 return result;
}
