import {createHmac,createHash,timingSafeEqual,randomBytes} from 'node:crypto';
import type {Request,Response} from 'express';
import type {Store} from './store.js';
import type {AccessSession} from '../src/types.js';

export type Principal={role:'teacher';tag:string}|{role:'student';studentId:string;revision:number};
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function accessControl(store:Store){
  const legacy=process.env.APP_ACCESS_CODE||'',teacher=process.env.TEACHER_ACCESS_CODE||'';
  const production=process.env.NODE_ENV==='production';
  if(production&&((teacher.length<16&&legacy.length<10)||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32))throw new Error('Production requires TEACHER_ACCESS_CODE (16+ chars) or legacy APP_ACCESS_CODE (10+ chars), and SESSION_SECRET (32+ chars).');
  if(teacher&&teacher.length<16)throw new Error('TEACHER_ACCESS_CODE must have at least 16 characters.');
  if(teacher&&legacy&&equal(digest(teacher),digest(legacy)))throw new Error('Teacher and legacy student access codes must be different.');
  const secret=process.env.SESSION_SECRET||randomBytes(32).toString('hex');
  const signature=(value:string)=>createHmac('sha256',secret).update(value).digest('hex');
  const openDevelopment=!production&&!teacher&&!legacy;
  const owner={role:'teacher' as const,tag:digest(teacher)};
  function principal(req:Request):Principal|null {
    if(openDevelopment)return owner;
    const token=req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('mi_session='))?.slice(11);
    if(!token||token.length>4096)return null;
    const [payload,sig,...extra]=token.split('.');if(extra.length||!sig||!equal(signature(payload),sig))return null;
    try {
      const data=JSON.parse(Buffer.from(payload,'base64url').toString());
      if(data.v!==2||!Number.isFinite(data.exp)||data.exp<=Date.now())return null;
      if(data.role==='teacher'&&teacher&&equal(data.tag||'',owner.tag))return owner;
      if(data.role==='student'&&typeof data.studentId==='string'){
        const student=store.student(data.studentId);
        if(student&&student.revision===data.revision)return {role:'student',studentId:student.id,revision:student.revision};
      }
    }catch{/* malformed or obsolete cookie */}
    return null;
  }
  function login(code:unknown):Principal|null {
    if(typeof code!=='string'||code.length>512)return null;
    if(teacher&&equal(digest(code),digest(teacher)))return owner;
    const student=store.findCode(code);if(student)return {role:'student',studentId:student.id,revision:student.revision};
    const old=store.student('legacy');
    if(legacy&&old&&!old.code_hash&&equal(digest(code),digest(legacy)))return {role:'student',studentId:old.id,revision:old.revision};
    return null;
  }
  function session(value:Principal|null):AccessSession{return {authenticated:Boolean(value),protected:!openDevelopment,teacherConfigured:Boolean(teacher)||openDevelopment,demo:process.env.DEMO_MODE==='true',...value?{role:value.role,...value.role==='student'?{studentId:value.studentId}:{}}:{}};}
  function setCookie(res:Response,value:Principal){const payload=Buffer.from(JSON.stringify({...value,v:2,exp:Date.now()+7*86400000})).toString('base64url');res.setHeader('Set-Cookie',`mi_session=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${production?'; Secure':''}`);}
  return {principal,login,session,setCookie};
}
