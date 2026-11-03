import {createContext,useContext} from 'react';
import type {AppState} from './types';
export type Tab='plan'|'cabinet'|'cards'|'verbs'|'speech'|'listening'|'progress'|'payment';
export const tabs:{id:Tab;label:string;caption:string}[]=[{id:'plan',label:'План',caption:'Ваш маршрут'},{id:'cabinet',label:'Кабинет',caption:'Всё о занятиях'},{id:'cards',label:'Автоматизация',caption:'Слова в памяти'},{id:'verbs',label:'Глаголы',caption:'От формы к речи'},{id:'speech',label:'Речь',caption:'Говорим смелее'},{id:'listening',label:'Слух',caption:'Слушаем и понимаем'},{id:'progress',label:'Прогресс',caption:'Маленькие победы'},{id:'payment',label:'Оплата',caption:'Учёт занятий'}];
export interface Context {state:AppState;meta:{ai:boolean;protected:boolean;verbs:string[];demo?:boolean};refresh:()=>Promise<void>;notify:(s:string)=>void;go:(tab:Tab)=>void;run:<T>(task:()=>Promise<T>,success?:string)=>Promise<T|undefined>}
export const AppContext=createContext<Context>(null!);
export const useApp=()=>useContext(AppContext);
