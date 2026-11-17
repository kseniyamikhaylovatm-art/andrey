import {parseCardPairs} from './card-pairs';
export function lessonList(text:string){
 const result:{es:string;ru?:string}[]=[];
 for(const [index,raw] of text.split(/\r?\n/).entries()){
  const line=raw.trim().replace(/^(?:[•●▪*]\s*|\d+[.)]\s+)/u,'');if(!line)continue;
  const parsed=parseCardPairs(line);if(parsed.cards.length===1&&!parsed.issues.length){result.push(parsed.cards[0]);continue;}
  if(line.length>4000||/[—–]|\s-\s|[А-Яа-яЁё]/u.test(line))throw new Error('Проверьте строку '+(index+1)+': введите испанское слово или пару «слово — перевод».');
  result.push({es:line});
 }
 if(!result.length||result.length>100)throw new Error('Добавьте от 1 до 100 строк за один раз.');
 return result;
}
