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
export interface Example { es: string; ru: string; tense?: string }
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
  examples: Example[]; source: string; stage: number; due: string; seen: number; correct: number;
}
export interface Attempt {
  id: string; kind: 'card' | 'verb' | 'speech' | 'listening'; at: string; correct: boolean | null;
  seconds: number; cardId?: string; topic?: string; verb?: string; tense?: string; answer?: string;
}
export interface Lesson { id: string; date: string; title: string; status: 'planned' | 'held' | 'cancelled'; note: string; text?: string; video?: string }
export interface Assignment { id: string; title: string; due: string; done: boolean }
export interface Diary { id: string; date: string; text: string; spoke: boolean; avoided: boolean }
export interface SpeechRecord { id: string; date: string; mode: string; topic: string; text: string; feedback: string }
export interface Dialog { id: string; date: string; topic: string; focus: string; messages: { role: 'user' | 'assistant'; content: string }[] }
export interface AudioItem { id: string; title: string; url: string; transcript: string; question: string; answer: string; topic: string }
export interface Plan { level: string; goal: string; goals: { skill: string; now: string; target: string }[]; criteria: string[]; topics: string[] }
export interface AppState {
  cards: Card[]; attempts: Attempt[]; lessons: Lesson[]; assignments: Assignment[]; diary: Diary[];
  speeches: SpeechRecord[]; dialogs: Dialog[]; audios: AudioItem[]; payments: { id: string; date: string }[];
  plan: Plan; verbTables: Record<string, Partial<Record<Tense, string[]>>>;
  summary: { text: string; date: string } | null;
}
