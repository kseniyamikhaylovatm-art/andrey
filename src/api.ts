export async function api<T=unknown>(path:string,body?:unknown,method?:string):Promise<T> {
  const response=await fetch('/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Не удалось связаться с сервером. Проверьте соединение.');
  return data as T;
}
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const formatDate=(date:string,full=false)=>new Intl.DateTimeFormat('ru',{day:'numeric',month:full?'long':'short',timeZone:'Europe/Madrid'}).format(new Date(date));
export const percentage=(correct:number,total:number)=>total?Math.round(correct/total*100):0;
export function speak(text:string,slow=false,onError?:(message:string)=>void){
  if(typeof window.speechSynthesis?.speak!=='function'||typeof SpeechSynthesisUtterance==='undefined')throw new Error('В этом браузере нет озвучки. Попробуйте Chrome или Safari.');
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-ES';utterance.rate=slow?0.65:0.9;
  const voices=speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang==='es-ES')||null;
  if(onError)utterance.onerror=event=>{if(!['canceled','interrupted'].includes(event.error))onError('Браузер не смог озвучить слово. Нажмите кнопку с динамиком или проверьте голос испанского языка в настройках устройства.');};
  speechSynthesis.speak(utterance);
}
