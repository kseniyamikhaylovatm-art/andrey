import {tabs,type Tab} from './context';

export function readRoute(hash=typeof window==='undefined'?'':window.location.hash){
  const value=hash.replace(/^#/,'');
  const separator=value.indexOf('?');
  const name=separator===-1?value:value.slice(0,separator);
  const search=separator===-1?'':value.slice(separator+1);
  return {tab:tabs.find(t=>t.id===(name==='practice'?'reading':name))?.id||'plan' as Tab,search,params:new URLSearchParams(search)};
}
export function routeHash(tab:Tab,options?:Record<string,string>){
  const search=new URLSearchParams(options).toString();
  return '#'+tab+(search?'?'+search:'');
}
