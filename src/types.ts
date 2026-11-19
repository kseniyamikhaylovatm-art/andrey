import type {LanguageAspect} from './monthly-plan-utils';
export const topics = ['Всё', 'В городе', 'Дом и соседи', 'Рынок', 'Сёрфинг', 'Путешествия', 'Повседневное'];
export const tenseNames = {
  presente: 'Presente',
  futuro_proximo: 'Будущее · ir a + infinitivo',
  perfecto: 'Pretérito perfecto', indefinido: 'Pretérito indefinido', imperfecto: 'Pretérito imperfecto',
  gerundio_presente: 'Estoy hablando', gerundio_imperfecto: 'Estaba hablando', gerundio_perfecto: 'He estado hablando', gerundio_indefinido: 'Estuve hablando',
} as const;
export type Tense = keyof typeof tenseNames;
export const exampleTenseNames = {
  presente: 'Presente',
  futuro_proximo: 'Ir a + infinitivo',
  gerundio_presente: 'Estoy + gerundio',
  perfecto: 'Pretérito perfecto',
  indefinido: 'Pretérito indefinido',
  imperfecto: 'Pretérito imperfecto',
} as const;
export type ExampleTense = keyof typeof exampleTenseNames;
export const exampleTenseDescriptions: Record<ExampleTense,string> = {
  presente: 'Настоящее время', futuro_proximo: 'Планы на будущее · ir a + инфинитив',
  gerundio_presente: 'Действие прямо сейчас · estar + герундий', perfecto: 'Прошедшее, связанное с настоящим',
  indefinido: 'Завершённое действие в прошлом', imperfecto: 'Привычка или фон в прошлом',
};
export interface Example { es: string; ru: string; tense?: string; level?: string }
export interface CardContextData {
  verb: string | null;
  examples: (Example & {tense: ExampleTense; origin: 'card' | 'library'})[];
  forms: Partial<Record<ExampleTense,string[]>>;
  originalExamples: Example[];
  formNotes: Partial<Record<ExampleTense,string>>;
}
export interface Card {
  id: string; es: string; ru: string; type: 'word' | 'chunk' | 'construction'; topic: string;
  register: 'neutral' | 'colloquial' | 'vulgar'; enabled: boolean; focused: boolean;
  ankiLearning?:boolean;ankiStep?:number;imageUrl?: string; examples: Example[]; source: string; stage: number; due: string; seen: number; correct: number;
}
export interface Attempt {
  id: string; kind: 'card' | 'verb' | 'speech' | 'listening'; at: string; correct: boolean | null;
  format?:PracticeFormat;sessionId?:string;xp?:number;stageAfter?:number;difficult?:boolean;completed?:boolean;rating?:'again'|'hard'|'good'|'easy';
  seconds: number; cardId?: string; topic?: string; verb?: string; tense?: string; answer?: string;
}
export interface Lesson { id: string; date: string; title: string; status: 'planned' | 'held' | 'cancelled'; note: string; text?: string; video?: string; cardIds?: string[] }
export interface LessonWordResult {lessonId:string;cardId:string;created:boolean;translationKept:boolean;enabled:boolean}
export interface Assignment { id: string; title: string; due: string; done: boolean }
export interface Diary { id: string; date: string; text: string; spoke: boolean; avoided: boolean }
export interface SpeechRecord { id: string; date: string; mode: string; topic: string; text: string; feedback: string }
export interface Dialog { id: string; date: string; topic: string; focus: string; messages: { role: 'user' | 'assistant'; content: string }[] }
export interface AudioItem { id: string; title: string; url: string; transcript: string; question: string; answer: string; topic: string }
export interface Plan { miroBoardUrl?:string; level: string; goal: string; goals: { skill: string; now: string; target: string }[]; criteria: string[]; topics: string[] }
export interface AppState {
  readingWords?:ReadingWord[];readingProgress?:Record<string,{page:number;updatedAt:string}>;readingPractice?:ReadingExerciseSet[];monthlyPlans?:MonthlyPlan[];practiceSessions?:PracticeSession[];cards: Card[]; attempts: Attempt[]; lessons: Lesson[]; assignments: Assignment[]; diary: Diary[];
  speeches: SpeechRecord[]; dialogs: Dialog[]; audios: AudioItem[]; payments: Payment[];
  plan: Plan; verbTables: Record<string, Partial<Record<Tense, string[]>>>;
  summary: { text: string; date: string } | null;
}
export interface StudentProfile {id:string;name:string;createdAt:string;level:string;cards:number;attempts:number;lastPractice:string|null;miroBoardUrl?:string;payment?:PaymentSummary}
export interface AccessSession {authenticated:boolean;protected:boolean;teacherConfigured:boolean;demo?:boolean;role?:'teacher'|'student';studentId?:string}
export interface WorkspaceMeta {ai:boolean;protected:boolean;verbs:string[];demo?:boolean;miro?:boolean;role:'teacher'|'student';student:StudentProfile}

export interface Payment {id:string;date:string;lessons?:number;note?:string}
export interface PaymentSummary {paid:number;used:number;remaining:number;last:string|null}

export type PracticeFormat='seventeen'|'duolingo'|'anki'|'quizlet';
export interface PracticeSession {quizletMode?:import('./quizlet-types').QuizletMode;direction?:import('./quizlet-types').QuizletDirection;id:string;format:PracticeFormat;startedAt:string;finishedAt?:string;total:number;topic?:string;lessonId?:string}

export interface MonthlyBaseline {aspect:LanguageAspect;method:'test'|'notes'|'other';task:string;result:string;url:string}
export interface MonthlyPlan {
 layoutVersion?:2;startedOn?:string;archivedAt?:string;skills?:string;topics?:string;situations?:string;pointA?:string;
 id:string;revision:number;month:string;goal:string;aspects:LanguageAspect[];topicsSkills:string;successCriteria:string;baselineDate:string;reviewOn:string;baselines:MonthlyBaseline[];createdAt:string;updatedAt:string;
 reflection?:{text:string;results:{aspect:LanguageAspect;result:string}[];submittedAt:string;updatedAt:string};
}

export type ReadingLevel='A1-A2'|'B1-B2'|'C1-C2';
export interface ReadingBook {id:string;title:string;level:ReadingLevel;pages:number;hasText:boolean;createdAt:string}
export interface ReadingRect {x:number;y:number;width:number;height:number}
export interface ReadingWord {id:string;es:string;ru:string|null;addedAt:string;status:'pending'|'ready'|'error';cardId?:string;occurrences:{bookId:string;bookTitle:string;level?:ReadingLevel;page:number;rects:ReadingRect[]}[]}
export interface ReadingTemplate {id:string;title:string;instructions:string;createdAt:string}
export interface ReadingExerciseSet {id:string;templateId:string;title:string;level:string;createdAt:string;wordIds:string[];items:{prompt:string;answer:string}[]}
