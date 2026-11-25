import type {Example} from './types';
import {parseCardPairs} from './card-pairs';
function joinExampleBlocks(text:string,hasHeading:boolean){
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
  if(!isExampleBlock(lines)||(blocks.length===1&&!hasHeading&&!/[.!?…]\s*$/.test(lines[1])))return block;
  return lines.join(' | ')+'\n'.repeat(lines.length-1);
 }).join('\n\n');
}

export function lessonList(text:string){
 const result:{es:string;ru?:string;example?:Example;topic?:string}[]=[];
 const source=text.replace(/\r\n?/g,'\n').split('\n');
 const headings=new Map<number,string>();
 const nextLines=new Map<number,string>();
 let nextLine='';
 for(let index=source.length-1;index>=0;index--){
  nextLines.set(index,nextLine);
  if(source[index].trim())nextLine=source[index];
 }
 for(const [index,raw] of source.entries()){
  const line=raw.trim();
  const marked=/^(?:#{1,6}\s+|(?:тема|tema)\s*:\s*)(.+)$/iu.exec(line)
    ||/^\*\*(.+)\*\*$/.exec(line)||/^\[([^\]]+)\]$/.exec(line);
  const nextPair=nextLines.get(index)?.split('|',1)[0];
  const plainHeading=(index===0||!source[index-1].trim())&&/\p{Script=Cyrillic}/u.test(line)&&!/[|—–]|\s-\s|[.!?…]$/u.test(line)&&
    !parseCardPairs(line).cards.length&&nextPair&&parseCardPairs(nextPair).cards.length;
  const name=marked?.[1].trim()||(plainHeading?line.replace(/:$/,'').trim():'');
  if(!name)continue;
  if(name.length>200)throw new Error('Название темы в строке '+(index+1)+' должно быть не длиннее 200 символов.');
  headings.set(index,name);
 }
 let topic:string|undefined;
 let start=0;
 for(const [index,name] of [...headings,[source.length,''] as const]){
  readRows(source.slice(start,index).join('\n'),start,topic);
  topic=name;
  start=index+1;
 }
 if(!result.length)throw new Error('Добавьте хотя бы одну запись.');
 return result;

 function readRows(section:string,offset:number,topic?:string){
  for(const [index,raw] of joinExampleBlocks(section,Boolean(topic)).split('\n').entries()){
   const [pair,exampleText,exampleTranslation,...extra]=raw.split('|').map(part=>part.trim());
   const line=pair.replace(/^(?:[•●▪*]\s*|\d+[.)]\s+)/u,'');if(!raw.trim())continue;
   if(!line||extra.length||(!exampleText&&exampleTranslation)||[exampleText,exampleTranslation].some(part=>part&&part.length>4000)){
    throw new Error('Проверьте пример в строке '+(offset+index+1)+'. Формат: слово — перевод | пример | перевод примера.');
   }
   const example=exampleText?{es:exampleText,ru:exampleTranslation||''}:undefined;
   const parsed=parseCardPairs(line);if(parsed.cards.length===1&&!parsed.issues.length){result.push({...parsed.cards[0],example,topic});continue;}
   if(line.length>4000||/[—–]|\s-\s|[А-Яа-яЁё]/u.test(line))throw new Error('Проверьте строку '+(offset+index+1)+': введите испанское слово или пару «слово — перевод».');
   result.push({es:line,example,topic});
  }
 }
}
