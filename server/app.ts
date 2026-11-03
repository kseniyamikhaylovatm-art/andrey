import express from 'express';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Store } from './store.js';
import { aiJSON, aiReady, AppError, claude, teacherPrompt } from './ai.js';
import { conjugate, id, knownVerbs, localSummary, review } from './domain.js';
import { tenseNames, type AppState, type Card, type Tense } from '../src/types.js';
import { parseCardPairs } from './card-import.js';
import { extractPdf } from './pdf.js';

const str=z.string().trim().min(1).max(4000);
const date=z.iso.date();
const seconds=z.number().min(0).max(1800).default(0);
const tense=z.enum(Object.keys(tenseNames) as [Tense,...Tense[]]);
const example=z.object({es:str,ru:str,tense:z.string().max(100).optional()});
const cardInput=z.object({es:str,ru:str,type:z.enum(['word','chunk','construction']).default('word'),topic:str,register:z.enum(['neutral','colloquial','vulgar']).default('neutral'),source:z.string().max(4000).default('Добавлено преподавателем'),examples:z.array(example).max(20).default([]),enabled:z.boolean().optional(),focused:z.boolean().optional()});
const normalize=(s:string)=>s.trim().toLocaleLowerCase('es').normalize('NFC').replace(/[.!?¿¡]+$/g,'').replace(/\s+/g,' ');
const safeEqual=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const find=<T extends {id:string}>(items:T[],key:string)=>{const x=items.find(v=>v.id===key);if(!x)throw new AppError(404,'Запись не найдена. Обновите страницу.');return x;};
const lessonInput=z.object({date,title:str,note:z.string().max(8000).default(''),status:z.enum(['planned','held','cancelled']).default('planned'),text:z.string().max(100000).optional(),video:z.union([z.literal(''),z.url().startsWith('https://')]).optional()});
const audioInput=z.object({title:str,url:z.union([z.literal(''),z.url().startsWith('https://')]),transcript:z.string().max(15000),question:str,answer:str,topic:str});
const planSchema=z.object({level:str,goal:str,goals:z.array(z.object({skill:str,now:str,target:str})).min(1).max(12),criteria:z.array(str).max(20),topics:z.array(str).max(30)});
const documentSchema=z.object({title:str,cards:z.array(cardInput).max(120),topics:z.array(str).max(20),transcript:z.string().max(100000),assignments:z.array(str).max(30)});
function newCard(input:z.infer<typeof cardInput>):Card {return {...input,id:id(),enabled:input.enabled??input.register!=='vulgar',focused:input.focused??false,stage:0,due:new Date(0).toISOString(),seen:0,correct:0};}

export function createApp(store:Store) {
  const app=express(); app.disable('x-powered-by');
  const code=process.env.APP_ACCESS_CODE||'';
  const secret=process.env.SESSION_SECRET||randomBytes(32).toString('hex');
  if(process.env.NODE_ENV==='production'&&(code.length<10||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)) throw new Error('Production requires APP_ACCESS_CODE (10+ chars) and SESSION_SECRET (32+ chars).');
  const signature=(s:string)=>createHmac('sha256',secret).update(s).digest('hex');
  const authenticated=(req:express.Request)=>{
    if(!code)return true;
    const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('mi_session='))?.slice(11);
    if(!token)return false;
    const [expires,sig]=token.split('.');return Number(expires)>Date.now()&&Boolean(sig)&&safeEqual(signature(expires),sig);
  };
  app.use((req,res,next)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
    const origin=req.headers.origin;
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin&&new URL(origin).host!==req.headers.host){res.status(403).json({error:'Запрос с другого сайта отклонён.'});return;}
    next();
  });
  app.use(express.json({limit:'2mb'}));
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  app.get('/api/session',(req,res)=>res.json({authenticated:authenticated(req),protected:Boolean(code)}));
  const loginAttempts=new Map<string,{n:number;until:number}>();
  app.post('/api/login',(req,res)=>{
    const key=req.ip||'local',current=loginAttempts.get(key),a=current&&current.until>Date.now()?current:{n:0,until:Date.now()+600000};
    loginAttempts.set(key,a);
    if(a.n>=10){res.status(429).json({error:'Слишком много попыток. Повторите через 10 минут.'});return;}
    a.n++;
    if(typeof req.body?.code!=='string'||!safeEqual(req.body.code,code)){res.status(401).json({error:'Неверный код доступа.'});return;}
    loginAttempts.delete(key);const expires=String(Date.now()+7*86400000);
    res.setHeader('Set-Cookie',`mi_session=${expires}.${signature(expires)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);res.json({ok:true});
  });
  app.use('/api',(req,res,next)=>{if(!authenticated(req)){res.status(401).json({error:'Введите общий код доступа.'});return;}next();});
  app.post('/api/logout',(_req,res)=>{res.setHeader('Set-Cookie','mi_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');res.json({ok:true});});
  app.get('/api/state',(_req,res)=>res.json({state:store.read(),meta:{ai:aiReady(),protected:Boolean(code),verbs:knownVerbs,demo:process.env.DEMO_MODE==='true'}}));
  app.get('/api/export',(_req,res)=>{res.setHeader('Content-Disposition','attachment; filename="mi-espanol-backup.json"');res.json({version:1,exportedAt:new Date().toISOString(),state:store.read()});});
  app.post('/api/cards',(req,res)=>{const input=cardInput.parse(req.body);res.json(store.mutate(s=>{
    if(s.cards.some(c=>normalize(c.es)===normalize(input.es)))throw new AppError(409,'Такая фраза уже есть в базе.');
    const card=newCard(input);s.cards.push(card);return card;
  }));});
  app.patch('/api/cards/:id',(req,res)=>{const p=cardInput.partial().parse(req.body);res.json(store.mutate(s=>{const c=find(s.cards,req.params.id);if(p.es&&s.cards.some(x=>x.id!==c.id&&normalize(x.es)===normalize(p.es!)))throw new AppError(409,'Такая фраза уже есть в базе.');Object.assign(c,p);return c;}));});
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
  app.post('/api/assignments',(req,res)=>{const p=z.object({title:str,due:date}).parse(req.body);const item={...p,id:id(),done:false};store.mutate(s=>s.assignments.push(item));res.json(item);});
  app.patch('/api/assignments/:id',(req,res)=>{const p=z.object({done:z.boolean()}).parse(req.body);store.mutate(s=>Object.assign(find(s.assignments,req.params.id),p));res.json({ok:true});});
  app.post('/api/diary',(req,res)=>{const p=z.object({text:str,spoke:z.boolean(),avoided:z.boolean()}).parse(req.body);const item={...p,id:id(),date:new Date().toISOString()};store.mutate(s=>s.diary.push(item));res.json(item);});
  app.post('/api/payments',(req,res)=>{const p=z.object({date}).parse(req.body);store.mutate(s=>s.payments.push({...p,id:id()}));res.json({ok:true});});
  app.post('/api/audios',(req,res)=>{const p=audioInput.parse(req.body);const item={...p,id:id()};store.mutate(s=>s.audios.push(item));res.json(item);});
  app.post('/api/listening/review',(req,res)=>{
    const p=z.object({audioId:str,answer:str,seconds}).parse(req.body);const a=find(store.read().audios,p.audioId);
    // Open comprehension questions require feedback, not exact-string scoring.
    store.mutate(s=>s.attempts.push({id:id(),kind:'listening',at:new Date().toISOString(),correct:null,seconds:p.seconds,topic:a.topic,answer:p.answer}));
    res.json({answer:a.answer,transcript:a.transcript});
  });
  // Bound paid AI requests per workspace, independent of the browser.
  let aiCalls:number[]=[];
  app.use('/api/ai',(_req,res,next)=>{aiCalls=aiCalls.filter(t=>Date.now()-t<3600000);if(aiCalls.length>=80){res.status(429).json({error:'Часовой лимит запросов достигнут. Попробуйте позже.'});return;}aiCalls.push(Date.now());next();});
  app.post('/api/ai/quick-card',async(req,res)=>{const p=z.object({es:str}).parse(req.body);const raw=await claude(teacherPrompt+' Верни только JSON {es,ru,topic,type,register,source,examples:[{es,ru}]}. type: word/chunk/construction, register: neutral/colloquial/vulgar. source: «Быстрое добавление · Claude».',p.es);res.json(cardInput.parse(aiJSON(raw)));});
  app.post('/api/ai/verbs',async(req,res)=>{const p=z.object({verb:z.string().trim().min(2).max(70),tense}).parse(req.body);const raw=await claude(teacherPrompt+' Верни только JSON-массив из 6 точных форм: yo, tú, él, nosotros, vosotros, ellos. Для reflexivos добавь местоимение. Без личных местоимений подлежащего. Проверь ударения.',`${p.verb}, ${tenseNames[p.tense]}`);const forms=z.array(str).length(6).parse(aiJSON(raw));store.mutate(s=>{s.verbTables[p.verb]??={};s.verbTables[p.verb][p.tense]=forms;});res.json({forms});});
  app.post('/api/ai/summary',async(_req,res)=>{const state=store.read();const text=aiReady()?await claude(teacherPrompt+' Напиши краткую сводку к уроку: сделано, проблемы, реальная речь, что взять на урок. Опираться только на данные.',JSON.stringify({summary:localSummary(state),recentAttempts:state.attempts.slice(-100),speech:state.speeches.slice(-5),diary:state.diary.slice(-10),dialogues:state.dialogs.slice(-3)})):localSummary(state);const summary={text,date:new Date().toISOString()};store.mutate(s=>{s.summary=summary;});res.json(summary);});
  app.post('/api/ai/speech',async(req,res)=>{const p=z.object({mode:str,topic:str,text:z.string().trim().min(10).max(16000),seconds}).parse(req.body);const feedback=await claude(teacherPrompt+' Разбери попытку: что получилось, до 5 ошибок с исправлениями и объяснениями, естественный вариант, одна следующая тренировка. Не присваивай оценку произношению по тексту.',JSON.stringify(p));const record={...p,id:id(),date:new Date().toISOString(),feedback};store.mutate(s=>{s.speeches.push(record);s.attempts.push({id:id(),kind:'speech',at:record.date,correct:null,seconds:p.seconds,topic:p.topic});});res.json(record);});
  app.post('/api/ai/dialog',async(req,res)=>{
    const p=z.object({id:z.string().optional(),topic:str,focus:str,text:z.string().max(6000),seconds}).parse(req.body);
    const previous=p.id?find(store.read().dialogs,p.id):null;
    if(previous&&previous.messages.length>=80)throw new AppError(400,'Диалог завершён. Начните новый разговор.');
    if(previous&&!p.text.trim())throw new AppError(400,'Напишите реплику.');
    const messages=[...(previous?.messages||[]),{role:'user' as const,content:p.text||'Начни диалог: короткая реплика на испанском и один вопрос.'}];
    const response=await claude(teacherPrompt+` Ты собеседник. Тема: ${p.topic}. Упор: ${p.focus}. Говори по-испански 1–3 предложения, при ошибке добавь короткое исправление на русском. Всегда оставляй место для ответа.`,messages);
    const d={id:previous?.id||id(),date:previous?.date||new Date().toISOString(),topic:p.topic,focus:p.focus,messages:[...messages,{role:'assistant' as const,content:response}]};
    store.mutate(s=>{if(previous){const current=find(s.dialogs,previous.id);if(current.messages.length!==previous.messages.length)throw new AppError(409,'Диалог изменён в другом окне. Обновите страницу.');current.messages=d.messages;}else s.dialogs.push(d);if(p.text)s.attempts.push({id:id(),kind:'speech',at:new Date().toISOString(),correct:null,seconds:p.seconds,topic:p.topic});});res.json(d);
  });
  app.post('/api/ai/listening',async(req,res)=>{const p=z.object({audioId:str,answer:str,seconds}).parse(req.body);const a=find(store.read().audios,p.audioId);const feedback=await claude(teacherPrompt+' Дай обратную связь на открытый вопрос по аудио. Объясни смысл, что ученик понял и что упустил. Не используй бинарную отметку верно/неверно.',JSON.stringify({text:a.transcript,question:a.question,reference:a.answer,answer:p.answer}));store.mutate(s=>s.attempts.push({id:id(),kind:'listening',at:new Date().toISOString(),correct:null,seconds:p.seconds,topic:a.topic,answer:p.answer}));res.json({feedback,transcript:a.transcript,reference:a.answer});});
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
  app.post('/api/ai/document',async(req,res)=>{const p=z.object({text:z.string().trim().min(30).max(35000),source:str}).parse(req.body);const raw=await claude(teacherPrompt+' Разбери фрагмент урока. Верни только JSON {title,transcript,cards:[{es,ru,type,topic,register,source,examples:[{es,ru,tense}]}],topics:[строки],assignments:[строки]}. Сохраняй транскрипцию целиком, источник и регистр. Добавь примеры к словам без примеров. Ключи к упражнениям не добавляй в открытые формулировки заданий. Строка таблицы — карточка; конструкции с пропуском — construction, фразы — chunk. Не придумывай содержание исходного документа.',JSON.stringify(p));res.json(documentSchema.parse(aiJSON(raw)));});
  app.post('/api/import/confirm',(req,res)=>{const p=documentSchema.parse(req.body);let added=0;store.mutate(s=>{const keys=new Set(s.cards.map(c=>normalize(c.es)));for(const c of p.cards){if(!keys.has(normalize(c.es))){s.cards.push(newCard(c));keys.add(normalize(c.es));added++;}}s.plan.topics=[...new Set([...s.plan.topics,...p.topics])];s.lessons.push({id:id(),date:new Date().toISOString().slice(0,10),title:p.title,status:'planned',note:'Материал из PDF · подтверждено преподавателем',text:p.transcript});for(const title of p.assignments)s.assignments.push({id:id(),title,due:new Date(Date.now()+7*86400000).toISOString().slice(0,10),done:false});});res.json({added,duplicates:p.cards.length-added});});
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
