export type QuizletMode='cards'|'learn'|'test';
export type QuizletDirection='mixed'|'es-ru'|'ru-es';
export const quizletModeNames:Record<QuizletMode,string>={cards:'Карточки',learn:'Изучение',test:'Тест'};
export const quizletDirectionNames:Record<QuizletDirection,string>={mixed:'Оба направления по очереди','es-ru':'Испанский → русский','ru-es':'Русский → испанский'};
export interface QuizletTask {cardId:string;kind:'flash'|'choice'|'write'|'boolean';direction:'es-ru'|'ru-es';prompt:string;options?:{id:string;label:string}[];statement?:string}
export interface QuizletResult {cardId:string;prompt:string;expected:string;answer:string;correct:boolean;direction:'es-ru'|'ru-es'}
export interface QuizletStep {id:string;mode:QuizletMode;index:number;totalWords:number;completedWords:number;correctFirst:number;remaining:number;answered:boolean;task:QuizletTask|null;reveal?:string;feedback?:QuizletResult;results?:QuizletResult[]}
