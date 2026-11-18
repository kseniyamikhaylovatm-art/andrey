export interface MixedTask {kind:'recall'|'choice'|'verb';cardId:string;direction?:'es-ru'|'ru-es';optionIds?:string[];forms?:string[];tense?:'presente'}
export interface MixedStep {id:string;index:number;total:number;correctFirst:number;task:MixedTask|null;answered:boolean;wrongIds:string[];feedback?:{correct:boolean;firstTry:boolean;selectedId?:string;duplicate?:boolean}}
