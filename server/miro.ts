import {EnvHttpProxyAgent,fetch as proxyFetch} from 'undici';
import {AppError} from './ai.js';
const dispatcher=new EnvHttpProxyAgent();
export function miroBoardId(value:string){
 let url:URL;try{url=new URL(value);}catch{throw new AppError(400,'Вставьте ссылку на доску Miro.');}
 const match=url.pathname.match(/^\/app\/board\/([^/]+)/);let id='';try{id=match?decodeURIComponent(match[1]):'';}catch{throw new AppError(400,'Некорректная ссылка на доску Miro.');}
 if(url.protocol!=='https:'||!['miro.com','www.miro.com'].includes(url.hostname)||!/^[-\w=]{1,200}$/.test(id))throw new AppError(400,'Нужна ссылка https://miro.com/app/board/…');return id;
}
export function miroText(value:string){return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?>|<\/(p|div|li)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(nbsp|amp|lt|gt|quot|apos);/g,(_,key:string)=>(({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[key]||'')).replace(/&#(x[\da-f]+|\d+);/gi,(whole,number)=>{const code=number[0].toLowerCase()==='x'?parseInt(number.slice(1),16):Number(number);return code>0&&code<=0x10ffff?String.fromCodePoint(code):whole;}).trim();}
export async function readMiroBoard(url:string,token:string,request:(url:string)=>Promise<{ok:boolean;status:number;json:()=>Promise<unknown>}>=address=>proxyFetch(address,{dispatcher,headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)})){
 const id=miroBoardId(url);if(!token)throw new AppError(503,'Добавьте MIRO_ACCESS_TOKEN в Environment сервера Render.');
 let cursor='',items=0,skipped=0;const texts:string[]=[],seen=new Set<string>();
 for(let page=0;page<100;page++){
  const response=await request('https://api.miro.com/v2/boards/'+encodeURIComponent(id)+'/items?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  if(!response.ok)throw new AppError(502,response.status===401||response.status===403?'Miro не разрешил доступ. Проверьте токен и доступ приложения к команде и доске.':'Miro недоступен (код '+response.status+'). Повторите загрузку позже.');
  const body=await response.json() as {data?:{data?:{content?:string;title?:string;description?:string}}[];cursor?:string};if(!Array.isArray(body.data))throw new AppError(502,'Miro вернул неожиданный ответ.');
  for(const item of body.data){items++;const text=[item.data?.title,item.data?.content,item.data?.description].filter((value):value is string=>typeof value==='string').map(miroText).filter(Boolean).join('\n');if(text)texts.push(text);else skipped++;}
  if(texts.join('\n\n').length>200000)throw new AppError(400,'На доске больше 200 000 символов. Используйте отдельную доску для части курса.');
  if(!body.cursor){if(!texts.length)throw new AppError(400,'На доске нет доступного текста. Текст на картинках и в PDF требует отдельного распознавания.');return {text:texts.join('\n\n'),source:'Miro · '+id,items,skipped};}
  if(seen.has(body.cursor))throw new AppError(502,'Miro повторил страницу. Повторите импорт.');cursor=body.cursor;seen.add(cursor);
 }
 throw new AppError(400,'На доске слишком много объектов. Разделите её на доски по урокам.');
}
