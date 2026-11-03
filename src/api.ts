export async function api<T=unknown>(path:string,body?:unknown,method?:string):Promise<T> {
  const response=await fetch('/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Не удалось связаться с сервером. Проверьте соединение.');
  return data as T;
}
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const formatDate=(date:string,full=false)=>new Intl.DateTimeFormat('ru',{day:'numeric',month:full?'long':'short',timeZone:'Europe/Madrid'}).format(new Date(date));
export const percentage=(correct:number,total:number)=>total?Math.round(correct/total*100):0;
export function speak(text:string,slow=false){
  if(!('speechSynthesis'in window))throw new Error('В этом браузере нет озвучки. Попробуйте Chrome или Safari.');
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-ES';utterance.rate=slow?0.65:0.9;
  const voices=speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang==='es-ES')||null;speechSynthesis.speak(utterance);
}
