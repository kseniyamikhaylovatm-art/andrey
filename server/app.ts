import {AnkiSessions} from './anki-practice.js';
import {beginPractice,recordPractice,finishPractice} from './practice-rewards.js';
import {MixedPracticeSessions} from './mixed-practice.js';
import {choiceCorrect} from '../src/practice-choices.js';
import {studyMaterial,materialGuidance} from './study-material.js';
import express from 'express';
import {miroBoardId,readMiroBoard} from './miro.js';
import {wordExample,levelGuidance} from './word-example.js';
import {translateWord} from './translate-word.js';
import {LingvaSessions} from './lingva.js';
import {accessControl,type Principal} from './access.js';
import { z } from 'zod';
import { Store } from './store.js';
import { aiJSON, aiReady, AppError, claude, teacherPrompt } from './ai.js';
import { conjugate, id, knownVerbs, localSummary, review } from './domain.js';
import { tenseNames, exampleTenseNames, type AppState, type Card, type Tense, type ExampleTense } from '../src/types.js';
import {exampleTense as resolveExampleTense} from '../src/example-tenses.js';
import {cardContext} from './card-context.js';
import { parseCardPairs } from './card-import.js';
import { extractPdf } from './pdf.js';
import {addLessonWord,lessonWordInput,addLessonWords,lessonWordsInput,wordKey} from './lesson-words.js';

const str=z.string().trim().min(1).max(4000);
const date=z.iso.date();
const seconds=z.number().min(0).max(1800).default(0);
const tense=z.enum(Object.keys(tenseNames) as [Tense,...Tense[]]);
const exampleTense=z.enum(Object.keys(exampleTenseNames) as [ExampleTense,...ExampleTense[]]);
const example=z.object({es:str,ru:str,tense:z.string().max(100).optional(),level:z.string().max(80).optional()});
const cardInput=z.object({imageUrl:z.union([z.literal(''),z.url().startsWith('https://')]).optional(),es:str,ru:str,type:z.enum(['word','chunk','construction']).default('word'),topic:str,register:z.enum(['neutral','colloquial','vulgar']).default('neutral'),source:z.string().max(4000).default('Добавлено преподавателем'),examples:z.array(example).max(20).default([]),enabled:z.boolean().optional(),focused:z.boolean().optional()});
const normalize=wordKey;
const find=<T extends {id:string}>(items:T[],key:string)=>{const x=items.find(v=>v.id===key);if(!x)throw new AppError(404,'Запись не найдена. Обновите страницу.');return x;};
const lessonInput=z.object({date,title:str,note:z.string().max(8000).default(''),status:z.enum(['planned','held','cancelled']).default('planned'),text:z.string().max(100000).optional(),video:z.union([z.literal(''),z.url().startsWith('https://')]).optional()});
const audioInput=z.object({title:str,url:z.union([z.literal(''),z.url().startsWith('https://')]),transcript:z.string().max(15000),question:str,answer:str,topic:str});
const miroUrl=z.string().max(1000).refine(value=>{if(!value)return true;try{miroBoardId(value);return true;}catch{return false;}},'Вставьте ссылку на доску Miro.');
const planSchema=z.object({miroBoardUrl:miroUrl.optional(),level:str,goal:str,goals:z.array(z.object({skill:str,now:str,target:str})).min(1).max(12),criteria:z.array(str).max(20),topics:z.array(str).max(30)});
const documentSchema=z.object({title:str,cards:z.array(cardInput).max(120),topics:z.array(str).max(20),transcript:z.string().max(100000),assignments:z.array(str).max(30)});
function newCard(input:z.infer<typeof cardInput>):Card {return {...input,id:id(),enabled:input.enabled??input.register!=='vulgar',focused:input.focused??false,stage:0,due:new Date(0).toISOString(),seen:0,correct:0};}

export function createApp(store:Store) {
  const mixedPractice=new MixedPracticeSessions();
  const anki=new AnkiSessions();
  const app=express(); app.disable('x-powered-by');
  const access=accessControl(store);
  const lingva=new LingvaSessions();
  const studentPrompt=()=>{const {plan}=store.read();return teacherPrompt+' '+levelGuidance(plan.level)+' Учебный профиль: '+JSON.stringify({level:plan.level,goal:plan.goal});};
  if(process.env.NODE_ENV==='production')app.set('trust proxy',1);
  app.use((req,res,next)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
    const origin=req.headers.origin;
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin){
      let sameOrigin=false;try{sameOrigin=new URL(origin).host===req.headers.host;}catch{/* reject malformed origins too */}
      if(!sameOrigin){res.status(403).json({error:'Запрос с другого сайта отклонён.'});return;}
    }
    next();
  });
  app.use(express.json({limit:'2mb'}));
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  app.get('/api/session',(req,res)=>res.json(access.session(access.principal(req))));
  const loginAttempts=new Map<string,{n:number;until:number}>();
  app.post('/api/login',(req,res)=>{
    const key=req.ip||'local',current=loginAttempts.get(key),a=current&&current.until>Date.now()?current:{n:0,until:Date.now()+600000};
    loginAttempts.set(key,a);
    if(a.n>=10){res.status(429).json({error:'Слишком много попыток. Повторите через 10 минут.'});return;}
    a.n++;
    const principal=access.login(req.body?.code);
    if(!principal){res.status(401).json({error:'Неверный код доступа.'});return;}
    loginAttempts.delete(key);access.setCookie(res,principal);res.json(access.session(principal));
  });
  app.use('/api',(req,res,next)=>{const principal=access.principal(req);if(!principal){res.status(401).json({error:'Войдите по личному коду доступа.'});return;}res.locals.principal=principal;next();});
  app.post('/api/logout',(_req,res)=>{res.setHeader('Set-Cookie','mi_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');res.json({ok:true});});
  const teacherOnly:express.RequestHandler=(_req,res,next)=>{if((res.locals.principal as Principal).role!=='teacher'){res.status(403).json({error:'Это действие доступно только преподавателю.'});return;}next();};
  app.use('/api/students',teacherOnly);
  app.get('/api/students',(_req,res)=>res.json({students:store.listStudents()}));
  app.post('/api/students',(req,res)=>{
    const input=z.object({name:z.string().trim().min(1).max(120),level:z.string().trim().min(1).max(80).default('A1'),examples:z.boolean().default(false)}).parse(req.body);
    res.status(201).json(store.createStudent(input.name,input.level,input.examples));
  });
  app.post('/api/students/:studentId/code',(req,res)=>{if(!store.student(req.params.studentId))throw new AppError(404,'Ученик не найден.');res.json({code:store.rotateCode(req.params.studentId)});});
  app.patch('/api/students/:studentId',(req,res)=>{if(!store.student(req.params.studentId))throw new AppError(404,'Ученик не найден.');const {name,level,miroBoardUrl}=z.object({name:z.string().trim().min(1).max(120),level:z.enum(['A1','A2','B1','B2','C1','C2']).optional(),miroBoardUrl:miroUrl.optional()}).parse(req.body);store.withStudent(req.params.studentId,()=>store.mutate(state=>{store.renameStudent(req.params.studentId,name);if(level)state.plan.level=level;if(miroBoardUrl!==undefined)state.plan.miroBoardUrl=miroBoardUrl;}));res.json(store.profile(req.params.studentId));});
  app.use('/api',(req,res,next)=>{
    const principal=res.locals.principal as Principal;
    const selected=req.headers['x-student-id']??req.query.studentId;
    if(selected!==undefined&&typeof selected!=='string'){res.status(400).json({error:'Выберите кабинет ученика.'});return;}
    if(principal.role==='student'&&selected&&selected!==principal.studentId){res.status(403).json({error:'Доступ к другому кабинету закрыт.'});return;}
    const studentId=principal.role==='student'?principal.studentId:selected||'legacy';
    if(!store.student(studentId)){res.status(404).json({error:'Кабинет не найден.'});return;}
    res.locals.studentId=studentId;
    store.withStudent(studentId,next);
  });
  // Enforce permissions on the server, including requests made outside the interface.
  app.use('/api',(req,res,next)=>{
    if((res.locals.principal as Principal).role==='teacher'||['GET','HEAD','OPTIONS'].includes(req.method)){next();return;}
    const permitted=(req.method==='POST'&&['/anki/start','/anki/answer','/practice/start','/practice/answer','/practice/next','/lingva/start','/lingva/answer','/review','/review/self','/review/choice','/verbs/review','/diary','/listening/review','/ai/speech','/ai/dialog','/ai/listening','/import/pdf','/import/cards/preview','/import/cards/confirm'].includes(req.path))
      ||(req.method==='POST'&&/^\/ai\/cards\/[^/]+\/word-example$/.test(req.path))
      ||(req.method==='PATCH'&&/^\/assignments\/[^/]+$/.test(req.path));
    if(req.method==='PATCH'&&/^\/cards\/[^/]+$/.test(req.path)){
      req.body=z.object({focused:z.boolean()}).strict().parse(req.body);next();return;
    }
    if(!permitted){res.status(403).json({error:'Это действие доступно только преподавателю.'});return;}
    next();
  });
  app.get('/api/state',(_req,res)=>res.json({state:store.read(),meta:{ai:aiReady(),miro:Boolean(process.env.MIRO_ACCESS_TOKEN),protected:access.session(res.locals.principal).protected,verbs:knownVerbs,demo:process.env.DEMO_MODE==='true',role:(res.locals.principal as Principal).role,student:store.profile(res.locals.studentId)}}));
  app.get('/api/export',(_req,res)=>{res.setHeader('Content-Disposition','attachment; filename="mi-espanol-backup.json"');res.json({version:2,exportedAt:new Date().toISOString(),student:store.profile(res.locals.studentId),state:store.read()});});
  app.post('/api/anki/start',(req,res)=>{const input=z.object({mode:z.enum(['new','review','focus','all']).default('new'),topic:z.string().max(4000).optional(),lessonId:z.string().max(100).optional()}).parse(req.body);const result=anki.start(res.locals.studentId,store.read(),input);store.mutate(state=>beginPractice(state,{id:result.id,format:'anki',startedAt:new Date().toISOString(),total:result.total,topic:input.topic,lessonId:input.lessonId}));res.json(result);});
  app.post('/api/anki/answer',(req,res)=>{const input=z.object({id:z.uuid(),index:z.number().int().min(0).max(100000),rating:z.enum(['again','hard','good','easy']),seconds}).parse(req.body);const result=anki.answer(res.locals.studentId,input.id,input.index,input.rating,fn=>store.mutate(fn),(state,card,last)=>{recordPractice(state,{id:'anki:'+input.id+':'+input.index,kind:'card',at:new Date().toISOString(),correct:input.rating!=='again',seconds:input.seconds,cardId:card.id,topic:card.topic,answer:input.rating,rating:input.rating},'anki',input.id,true);if(last)finishPractice(state,input.id);});res.json(result);});
  app.post('/api/practice/start',(req,res)=>{const input=z.object({mode:z.enum(['new','review','focus','all']).default('new'),topic:z.string().max(4000).optional(),lessonId:z.string().max(100).optional(),includeVerbs:z.boolean().default(true)}).parse(req.body);const result=mixedPractice.start(res.locals.studentId,store.read(),input);store.mutate(state=>beginPractice(state,{id:result.id,format:'seventeen',startedAt:new Date().toISOString(),total:result.total,topic:input.topic,lessonId:input.lessonId}));res.json(result);});
  app.post('/api/practice/answer',(req,res)=>{const input=z.object({id:z.uuid(),index:z.number().int().min(0).max(100000),correct:z.boolean().optional(),answerCardId:z.string().max(100).optional(),seconds}).parse(req.body);const result=mixedPractice.answer(res.locals.studentId,input.id,input.index,input,store.read(),effect=>store.mutate(state=>{if(state.attempts.some(attempt=>attempt.id===effect.id))return;const card=find(state.cards,effect.cardId);if(effect.updateSchedule)review(card,effect.correct);const completed=effect.completed;recordPractice(state,{id:effect.id,kind:effect.kind,at:new Date().toISOString(),correct:effect.correct,seconds:input.seconds,cardId:card.id,topic:effect.kind==='verb'?'Грамматика':card.topic,answer:effect.answer,...effect.verb?{verb:effect.verb,tense:effect.tense}:{}},'seventeen',input.id,completed);const session=state.practiceSessions?.find(item=>item.id===input.id);if(session&&input.index===session.total-1&&completed)finishPractice(state,input.id);}));res.json(result);});
  app.post('/api/practice/next',(req,res)=>{const input=z.object({id:z.uuid(),index:z.number().int().min(0).max(100000)}).parse(req.body);res.json(mixedPractice.next(res.locals.studentId,input.id,input.index));});
  app.post('/api/lingva/start',(req,res)=>{const p=z.object({topic:z.string().max(4000).optional(),lessonId:z.string().max(100).optional()}).parse(req.body);const result=lingva.start(res.locals.studentId,store.read(),p.topic,p.lessonId);store.mutate(state=>beginPractice(state,{id:result.id,format:'duolingo',startedAt:new Date().toISOString(),total:result.total,topic:p.topic,lessonId:p.lessonId}));res.json(result);});
  app.post('/api/lingva/answer',(req,res)=>{const p=z.object({id:z.string().max(100),index:z.number().int().min(0).max(10000),answer:z.string().max(4000),skip:z.boolean().default(false),seconds}).parse(req.body);const result=lingva.answer(res.locals.studentId,p.id,p.index,p.answer,p.skip);if(result.record)store.mutate(s=>{const key='lingva:'+p.id+':'+p.index;if(!s.attempts.some(a=>a.id===key)){const card=s.cards.find(c=>c.id===result.cardId);const alreadyCorrect=s.attempts.some(a=>a.id.startsWith('lingva:'+p.id+':')&&a.cardId===result.cardId&&a.correct===true);if(card&&(!result.correct||!alreadyCorrect))review(card,result.correct);recordPractice(s,{id:key,kind:'card',at:new Date().toISOString(),correct:result.correct,seconds:p.seconds,cardId:result.cardId,topic:card?.topic,answer:p.answer},'duolingo',p.id,result.correct);if(!result.task)finishPractice(s,p.id);}});res.json(result);});
  app.post('/api/cards',(req,res)=>{const input=cardInput.parse(req.body);res.json(store.mutate(s=>{
    if(s.cards.some(c=>normalize(c.es)===normalize(input.es)))throw new AppError(409,'Такая фраза уже есть в базе.');
    const card=newCard(input);s.cards.push(card);return card;
  }));});
  app.patch('/api/cards/:id',(req,res)=>{const p=cardInput.partial().parse(req.body);res.json(store.mutate(s=>{const c=find(s.cards,req.params.id);if(p.es&&s.cards.some(x=>x.id!==c.id&&normalize(x.es)===normalize(p.es!)))throw new AppError(409,'Такая фраза уже есть в базе.');Object.assign(c,p);return c;}));});
  app.get('/api/cards/:id/context',(req,res)=>{
    const state=store.read();const card=find(state.cards,req.params.id);res.json(cardContext({...card,examples:card.examples.filter(e=>!e.level||e.level===state.plan.level)},state.verbTables));
  });
  app.put('/api/cards/:id/tense-example',(req,res)=>{
    const input=z.object({tense:exampleTense,es:str,ru:str}).parse(req.body);
    store.mutate(s=>{const card=find(s.cards,req.params.id);const index=card.examples.findIndex(e=>resolveExampleTense(e.tense)===input.tense);if(index===-1)card.examples.push(input);else card.examples[index]=input;});
    res.json({ok:true});
  });
  app.post('/api/review/choice',(req,res)=>{
    const p=z.object({cardId:str,answerCardId:str,direction:z.enum(['es-ru','ru-es']),attemptId:z.uuid(),seconds}).parse(req.body);
    res.json(store.mutate(s=>{const card=find(s.cards,p.cardId),answer=find(s.cards,p.answerCardId);if(!card.enabled||!answer.enabled)throw new AppError(400,'Карточка выключена.');const correct=choiceCorrect(card,answer,p.direction),key='choice:'+p.attemptId,previous=s.attempts.find(a=>a.id===key);if(previous){if(previous.cardId!==card.id||previous.answer!==p.direction+':'+answer.id)throw new AppError(409,'Этот ответ уже сохранён.');return {correct:previous.correct};}review(card,correct);s.attempts.push({id:key,kind:'card',at:new Date().toISOString(),correct,seconds:p.seconds,cardId:card.id,topic:card.topic,answer:p.direction+':'+answer.id});return {correct};}));
  });
  app.post('/api/review/self',(req,res)=>{
    const p=z.object({cardId:str,correct:z.boolean(),attemptId:z.uuid(),seconds}).parse(req.body);
    res.json(store.mutate(s=>{const c=find(s.cards,p.cardId);if(!c.enabled)throw new AppError(400,'Карточка выключена.');const key='self:'+p.attemptId,previous=s.attempts.find(a=>a.id===key);if(previous){if(previous.cardId!==c.id||previous.correct!==p.correct)throw new AppError(409,'Этот ответ уже сохранён.');return {correct:previous.correct,card:c};}review(c,p.correct);s.attempts.push({id:key,kind:'card',at:new Date().toISOString(),correct:p.correct,seconds:p.seconds,cardId:c.id,topic:c.topic,answer:p.correct?'Вспомнил':'Не вспомнил'});return {correct:p.correct,card:c};}));
  });
  app.post('/api/review',(req,res)=>{
    const p=z.object({cardId:str,answer:str,seconds}).parse(req.body);
    res.json(store.mutate(s=>{const c=find(s.cards,p.cardId);if(!c.enabled)throw new AppError(400,'Карточка выключена.');const correct=normalize(c.ru)===normalize(p.answer);review(c,correct);s.attempts.push({id:id(),kind:'card',at:new Date().toISOString(),correct,seconds:p.seconds,cardId:c.id,topic:c.topic,answer:p.answer});return {correct,expected:c.ru,card:c};}));
  });
  app.get('/api/verbs',(_req,res)=>res.json(knownVerbs));
  app.get('/api/verbs/table',(req,res)=>{const v=str.parse(req.query.verb),t=tense.parse(req.query.tense);const forms=store.read().verbTables[v]?.[t]||conjugate(v,t);res.json({forms,irregular:['ser','estar','tener','hacer','ir','decir','ver','contar','llegar'].includes(v),source:store.read().verbTables[v]?.[t]?'Таблица преподавателя / Claude':'Проверенная стартовая таблица'});});
  app.put('/api/verbs/table',(req,res)=>{const p=z.object({verb:str,tense,forms:z.array(str).length(6)}).parse(req.body);store.mutate(s=>{s.verbTables[p.verb]??={};s.verbTables[p.verb][p.tense]=p.forms;});res.json({ok:true});});
  app.post('/api/verbs/review',(req,res)=>{const p=z.object({verb:str,tense,answers:z.array(z.string().max(500)).length(6),seconds}).parse(req.body);res.json(store.mutate(s=>{const forms=s.verbTables[p.verb]?.[p.tense]||conjugate(p.verb,p.tense);if(!forms)throw new AppError(400,'Сначала создайте таблицу для этого глагола.');const results=forms.map((f,i)=>normalize(f)===normalize(p.answers[i]));results.forEach((correct,i)=>s.attempts.push({id:id(),kind:'verb',at:new Date().toISOString(),correct,seconds:p.seconds/6,verb:p.verb,tense:p.tense,answer:p.answers[i],topic:'Грамматика'}));return {forms,results};}));});
  app.put('/api/plan',(req,res)=>{const p=planSchema.parse(req.body);store.mutate(s=>{s.plan=p;});res.json({ok:true});});
  app.post('/api/lessons',(req,res)=>{const p=lessonInput.parse(req.body);const item={...p,id:id()};store.mutate(s=>{s.lessons.push(item);});res.json(item);});
  app.patch('/api/lessons/:id',(req,res)=>{const p=lessonInput.partial().parse(req.body);store.mutate(s=>Object.assign(find(s.lessons,req.params.id),p));res.json({ok:true});});
  app.post('/api/miro/text',async(_req,res)=>{const url=store.read().plan.miroBoardUrl;if(!url)throw new AppError(400,'Сначала укажите доску Miro в профиле ученика.');res.json(await readMiroBoard(url,process.env.MIRO_ACCESS_TOKEN||''));});
  app.post('/api/lesson-words/batch',(req,res)=>{const input=lessonWordsInput.parse(req.body);res.json(store.mutate(state=>addLessonWords(state,input)));});
  app.post('/api/lesson-words',(req,res)=>{const input=lessonWordInput.parse(req.body);res.json(store.mutate(state=>addLessonWord(state,input)));});
  app.delete('/api/lessons/:id/words/:cardId',(req,res)=>{store.mutate(state=>{const lesson=find(state.lessons,req.params.id);lesson.cardIds=(lesson.cardIds||[]).filter(key=>key!==req.params.cardId);});res.json({ok:true});});
  app.post('/api/assignments',(req,res)=>{const p=z.object({title:str,due:date}).parse(req.body);const item={...p,id:id(),done:false};store.mutate(s=>s.assignments.push(item));res.json(item);});
  app.patch('/api/assignments/:id',(req,res)=>{const p=z.object({done:z.boolean()}).parse(req.body);store.mutate(s=>Object.assign(find(s.assignments,req.params.id),p));res.json({ok:true});});
  app.post('/api/diary',(req,res)=>{const p=z.object({text:str,spoke:z.boolean(),avoided:z.boolean()}).parse(req.body);const item={...p,id:id(),date:new Date().toISOString()};store.mutate(s=>s.diary.push(item));res.json(item);});
  const paymentInput=z.object({date,lessons:z.number().int().min(1).max(1000).default(12),note:z.string().trim().max(1000).default('')});
  app.post('/api/payments',(req,res)=>{const {requestId,...p}=paymentInput.extend({requestId:z.uuid().optional()}).parse(req.body);store.mutate(s=>{const previous=requestId?s.payments.find(payment=>payment.id===requestId):undefined;if(previous){if(previous.date!==p.date||(previous.lessons??12)!==p.lessons||(previous.note||'')!==p.note)throw new AppError(409,'Эта оплата уже сохранена. Обновите страницу.');return;}s.payments.push({...p,id:requestId||id()});});res.json({ok:true});});
  app.patch('/api/payments/:id',(req,res)=>{const p=paymentInput.extend({lessons:z.number().int().min(1).max(1000)}).parse(req.body);store.mutate(s=>Object.assign(find(s.payments,req.params.id),p));res.json({ok:true});});
  app.post('/api/audios',(req,res)=>{const p=audioInput.parse(req.body);const item={...p,id:id()};store.mutate(s=>s.audios.push(item));res.json(item);});
  app.post('/api/listening/review',(req,res)=>{
    const p=z.object({audioId:str,answer:str,seconds}).parse(req.body);const a=find(store.read().audios,p.audioId);
    // Open comprehension questions require feedback, not exact-string scoring.
    store.mutate(s=>s.attempts.push({id:id(),kind:'listening',at:new Date().toISOString(),correct:null,seconds:p.seconds,topic:a.topic,answer:p.answer}));
    res.json({answer:a.answer,transcript:a.transcript});
  });
  // Bound paid AI requests per workspace, independent of the browser.
  const callsByStudent=new Map<string,number[]>();
  app.use('/api/ai',(_req,res,next)=>{const key=res.locals.studentId as string,aiCalls=(callsByStudent.get(key)||[]).filter(t=>Date.now()-t<3600000);callsByStudent.set(key,aiCalls);if(aiCalls.length>=80){res.status(429).json({error:'Часовой лимит запросов достигнут. Попробуйте позже.'});return;}aiCalls.push(Date.now());next();});
  const pendingExamples=new Map<string,Promise<unknown>>();
  app.post('/api/ai/cards/:id/word-example',async(req,res)=>{
    const state=store.read(),card=find(state.cards,req.params.id),level=state.plan.level;
    const saved=card.examples.find(example=>!example.level||example.level===level);if(saved){res.json(saved);return;}
    const key=res.locals.studentId+':'+card.id+':'+level;
    let promise=pendingExamples.get(key);
    if(!promise){promise=(async()=>{const example=await wordExample(card,level,claude,studyMaterial(state));store.mutate(current=>{const target=find(current.cards,card.id);if(current.plan.level!==level||target.es!==card.es||target.ru!==card.ru)throw new AppError(409,'Уровень или слово изменились. Откройте слово заново.');if(!target.examples.some(item=>item.level===level))target.examples.push(example);});return example;})();pendingExamples.set(key,promise);}
    try{res.json(await promise);}finally{if(pendingExamples.get(key)===promise)pendingExamples.delete(key);}
  });
  app.post('/api/ai/cards/:id/examples',async(req,res)=>{
    const initial=store.read(),level=initial.plan.level,card=find(initial.cards,req.params.id);
    const raw=await claude(studentPrompt()+materialGuidance+' Создай 6 естественных коротких примеров именно с данным словом/фразой и его формами. Верни только JSON-массив [{tense,es,ru}]. Обязательно по одному примеру для ключей: presente, futuro_proximo (только ir a + infinitivo), gerundio_presente (estar + gerundio), perfecto, indefinido, imperfecto. Для существительного меняется время предложения, существительное не спрягай. Для состояний не придумывай неестественное estoy estando: покажи слово в контексте с естественным действием прямо сейчас. Не меняй значение слова, учитывай материалы. Переводи весь пример на русский.',JSON.stringify({es:card.es,ru:card.ru,topic:card.topic,examples:card.examples,studyMaterial:studyMaterial(initial)}));
    const examples=z.array(z.object({tense:exampleTense,es:str,ru:str})).length(6).parse(aiJSON(raw));
    if(new Set(examples.map(e=>e.tense)).size!==6)throw new AppError(502,'ИИ не подготовил все шесть времён. Попробуйте ещё раз.');
    store.mutate(s=>{const current=find(s.cards,req.params.id);if(s.plan.level!==level)throw new AppError(409,'Уровень изменился. Повторите запрос.');const saved=new Set(current.examples.filter(e=>!e.level||e.level===level).map(e=>resolveExampleTense(e.tense)));current.examples.push(...examples.filter(e=>!saved.has(e.tense)).map(e=>({...e,level})));});
    res.json({ok:true});
  });
  app.post('/api/ai/translate-word',async(req,res)=>{const {es}=z.object({es:z.string().trim().min(1).max(4000).refine(value=>!/[\r\n]/.test(value),'Введите одно слово или выражение.')} ).parse(req.body);if(!aiReady()&&!store.read().cards.some(card=>normalize(card.es)===normalize(es)))throw new AppError(503,'Автоперевод пока не подключён. Добавьте ANTHROPIC_API_KEY в Render или введите слово — перевод вручную.');res.json(await translateWord(store.read(),es));});
  app.post('/api/ai/quick-card',async(req,res)=>{const p=z.object({es:str}).parse(req.body);const raw=await claude(studentPrompt()+' Верни только JSON {es,ru,topic,type,register,source,examples:[{es,ru}]}. type: word/chunk/construction, register: neutral/colloquial/vulgar. source: «Быстрое добавление · Claude».',p.es);res.json(cardInput.parse(aiJSON(raw)));});
  app.post('/api/ai/verbs',async(req,res)=>{const p=z.object({verb:z.string().trim().min(2).max(70),tense}).parse(req.body);const raw=await claude(studentPrompt()+' Верни только JSON-массив из 6 точных форм: yo, tú, él, nosotros, vosotros, ellos. Для reflexivos добавь местоимение. Без личных местоимений подлежащего. Проверь ударения.',`${p.verb}, ${tenseNames[p.tense]}`);const forms=z.array(str).length(6).parse(aiJSON(raw));store.mutate(s=>{s.verbTables[p.verb]??={};s.verbTables[p.verb][p.tense]=forms;});res.json({forms});});
  app.post('/api/ai/summary',async(_req,res)=>{const state=store.read();const text=aiReady()?await claude(studentPrompt()+' Напиши краткую сводку к уроку: сделано, проблемы, реальная речь, что взять на урок. Опираться только на данные.',JSON.stringify({summary:localSummary(state),recentAttempts:state.attempts.slice(-100),speech:state.speeches.slice(-5),diary:state.diary.slice(-10),dialogues:state.dialogs.slice(-3)})):localSummary(state);const summary={text,date:new Date().toISOString()};store.mutate(s=>{s.summary=summary;});res.json(summary);});
  app.post('/api/ai/speech',async(req,res)=>{const p=z.object({mode:str,topic:str,text:z.string().trim().min(10).max(16000),seconds}).parse(req.body);const feedback=await claude(studentPrompt()+' Разбери попытку: что получилось, до 5 ошибок с исправлениями и объяснениями, естественный вариант, одна следующая тренировка. Не присваивай оценку произношению по тексту.',JSON.stringify(p));const record={...p,id:id(),date:new Date().toISOString(),feedback};store.mutate(s=>{s.speeches.push(record);s.attempts.push({id:id(),kind:'speech',at:record.date,correct:null,seconds:p.seconds,topic:p.topic});});res.json(record);});
  app.post('/api/ai/dialog',async(req,res)=>{
    const p=z.object({id:z.string().optional(),topic:str,focus:str,text:z.string().max(6000),seconds}).parse(req.body);
    const previous=p.id?find(store.read().dialogs,p.id):null;
    if(previous&&previous.messages.length>=80)throw new AppError(400,'Диалог завершён. Начните новый разговор.');
    if(previous&&!p.text.trim())throw new AppError(400,'Напишите реплику.');
    const messages=[...(previous?.messages||[]),{role:'user' as const,content:p.text||'Начни диалог: короткая реплика на испанском и один вопрос.'}];
    const response=await claude(studentPrompt()+` Ты собеседник. Тема: ${p.topic}. Упор: ${p.focus}. Говори по-испански 1–3 предложения, при ошибке добавь короткое исправление на русском. Всегда оставляй место для ответа.`,messages);
    const d={id:previous?.id||id(),date:previous?.date||new Date().toISOString(),topic:p.topic,focus:p.focus,messages:[...messages,{role:'assistant' as const,content:response}]};
    store.mutate(s=>{if(previous){const current=find(s.dialogs,previous.id);if(current.messages.length!==previous.messages.length)throw new AppError(409,'Диалог изменён в другом окне. Обновите страницу.');current.messages=d.messages;}else s.dialogs.push(d);if(p.text)s.attempts.push({id:id(),kind:'speech',at:new Date().toISOString(),correct:null,seconds:p.seconds,topic:p.topic});});res.json(d);
  });
  app.post('/api/ai/listening',async(req,res)=>{const p=z.object({audioId:str,answer:str,seconds}).parse(req.body);const a=find(store.read().audios,p.audioId);const feedback=await claude(studentPrompt()+' Дай обратную связь на открытый вопрос по аудио. Объясни смысл, что ученик понял и что упустил. Не используй бинарную отметку верно/неверно.',JSON.stringify({text:a.transcript,question:a.question,reference:a.answer,answer:p.answer}));store.mutate(s=>s.attempts.push({id:id(),kind:'listening',at:new Date().toISOString(),correct:null,seconds:p.seconds,topic:a.topic,answer:p.answer}));res.json({feedback,transcript:a.transcript,reference:a.answer});});
  app.post('/api/import/pdf',express.raw({type:'application/pdf',limit:'15mb'}),async(req,res)=>{
    if(!Buffer.isBuffer(req.body))throw new AppError(400,'Выберите PDF-файл до 15 МБ.');
    res.json(await extractPdf(req.body));
  });
  app.post('/api/import/cards/preview',(req,res)=>{
    const {text}=z.object({text:z.string().trim().min(1).max(200000)}).parse(req.body);
    const preview=parseCardPairs(text);
    if(preview.cards.length>1000)throw new AppError(400,'За один раз можно добавить до 1000 карточек. Разделите список на части.');
    res.json(preview);
  });
  app.post('/api/import/cards/confirm',(req,res)=>{
    const input=z.object({cards:z.array(z.object({es:str,ru:str})).min(1).max(1000),topic:str,source:str}).parse(req.body);
    let added=0;
    store.mutate(s=>{
      const existing=new Set(s.cards.map(c=>normalize(c.es)));
      for(const pair of input.cards){
        const key=normalize(pair.es);
        if(existing.has(key))continue;
        s.cards.push(newCard(cardInput.parse({...pair,topic:input.topic,source:input.source,type:/\s/.test(pair.es)?'chunk':'word'})));
        existing.add(key);added++;
      }
      if(added&&!s.plan.topics.includes(input.topic))s.plan.topics.push(input.topic);
    });
    res.json({added,duplicates:input.cards.length-added});
  });
  app.post('/api/ai/document',async(req,res)=>{const p=z.object({text:z.string().trim().min(30).max(35000),source:str}).parse(req.body);const raw=await claude(studentPrompt()+' Разбери фрагмент урока. Выбери полезные повседневные слова и фразы по уровню ученика, сгруппируй по темам. Не утверждай статистическую частотность без данных. Глаголы из материала добавляй также отдельными карточками-инфинитивами с русским переводом для тренажёра глаголов. Верни только JSON {title,transcript,cards:[{es,ru,type,topic,register,source,examples:[{es,ru,tense}]}],topics:[строки],assignments:[строки]}. Сохраняй транскрипцию целиком, источник и регистр. Добавь примеры к словам без примеров. Ключи к упражнениям не добавляй в открытые формулировки заданий. Строка таблицы — карточка; конструкции с пропуском — construction, фразы — chunk. Не придумывай содержание исходного документа.',JSON.stringify(p));res.json(documentSchema.parse(aiJSON(raw)));});
  app.post('/api/import/confirm',(req,res)=>{const p=documentSchema.parse(req.body);let added=0;store.mutate(s=>{const keys=new Set(s.cards.map(c=>normalize(c.es)));for(const c of p.cards){if(!keys.has(normalize(c.es))){s.cards.push(newCard(c));keys.add(normalize(c.es));added++;}}s.plan.topics=[...new Set([...s.plan.topics,...p.topics])];s.lessons.push({id:id(),date:new Date().toISOString().slice(0,10),title:p.title,status:'planned',note:'Импорт материалов · подтверждено преподавателем',cardIds:s.cards.filter(card=>p.cards.some(input=>normalize(input.es)===normalize(card.es))).map(card=>card.id),text:p.transcript});for(const title of p.assignments)s.assignments.push({id:id(),title,due:new Date(Date.now()+7*86400000).toISOString().slice(0,10),done:false});});res.json({added,duplicates:p.cards.length-added});});
  app.use('/api',(_req,res)=>res.status(404).json({error:'Такого действия нет.'}));
  app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    if(err instanceof z.ZodError){res.status(400).json({error:'Проверьте поля формы: '+err.issues.map(x=>x.path.join('.')+': '+x.message).join('; ')});return;}
    if(err instanceof AppError){res.status(err.status).json({error:err.message});return;}
    const status=(err as {status?:number})?.status;
    if(status===413){res.status(413).json({error:'Файл слишком большой (максимум 15 МБ).'});return;}
    console.error('Request failed:',err instanceof Error?err.name:'Unknown error');res.status(500).json({error:'Не удалось выполнить действие. Данные сохранены; попробуйте ещё раз.'});
  });
  return app;
}
