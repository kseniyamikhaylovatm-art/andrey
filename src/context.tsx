import {createContext,useContext} from 'react';
import type {AppState,WorkspaceMeta} from './types';
import type {ApiClient} from './api';
export type Tab='plan'|'words'|'cabinet'|'cards'|'verbs'|'speech'|'listening'|'reading'|'practice'|'progress'|'payment';
export const tabs:{id:Tab;label:string;caption:string}[]=[{id:'plan',label:'План',caption:'Ваш маршрут'},{id:'words',label:'Слова',caption:'Записи с уроков'},{id:'cabinet',label:'Кабинет',caption:'Всё о занятиях'},{id:'cards',label:'Автоматизация',caption:'Слова в памяти'},{id:'verbs',label:'Глаголы',caption:'От формы к речи'},{id:'speech',label:'Речь',caption:'Говорим смелее'},{id:'listening',label:'Слух',caption:'Слушаем и понимаем'},{id:'reading',label:'Чтение',caption:'Читаем по-испански'},{id:'practice',label:'Практика',caption:'Слова из чтения'},{id:'progress',label:'Прогресс',caption:'Маленькие победы'},{id:'payment',label:'Оплата',caption:'Учёт занятий'}];
export interface Context {state:AppState;meta:WorkspaceMeta;api:ApiClient;uploadPdf:(file:File)=>Promise<{pages:string[];text:string}>;refresh:()=>Promise<void>;notify:(s:string)=>void;go:(tab:Tab,options?:Record<string,string>)=>void;run:<T>(task:()=>Promise<T>,success?:string)=>Promise<T|undefined>}
export const AppContext=createContext<Context>(null!);
export const useApp=()=>useContext(AppContext);
