import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes,createHash} from 'node:crypto';
import type { AppState,StudentProfile } from '../src/types.js';
import { initialState } from './domain.js';
export class Store {
  db: DatabaseSync;
  private scope=new AsyncLocalStorage<string>();
  constructor(dir:string) {
    mkdirSync(dir,{recursive:true});
    this.db = new DatabaseSync(join(dir,'mi-espanol.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)');
    this.db.prepare('INSERT OR IGNORE INTO workspace VALUES (1,?)').run(JSON.stringify(initialState()));
    this.db.exec(`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, code_hash TEXT UNIQUE, revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS student_workspaces (student_id TEXT PRIMARY KEY REFERENCES students(id), json TEXT NOT NULL);`);
    // Keep the original table as a migration backup. Copy the existing space once, atomically.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT OR IGNORE INTO students (id,name,created_at) VALUES (?,?,?)').run('legacy','Андрей и Таня',new Date().toISOString());
      this.db.prepare('INSERT OR IGNORE INTO student_workspaces SELECT ?,json FROM workspace WHERE id=1').run('legacy');
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  withStudent<T>(studentId:string,fn:()=>T):T {return this.scope.run(studentId,fn);}
  read(): AppState {
    const row=this.db.prepare('SELECT json FROM student_workspaces WHERE student_id=?').get(this.scope.getStore()||'legacy') as {json:string}|undefined;
    if(!row)throw new Error('Student workspace does not exist');
    return JSON.parse(row.json);
  }
  mutate<T>(fn:(s:AppState)=>T):T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const s=this.read(); s.summary=null; const result=fn(s); this.db.prepare('UPDATE student_workspaces SET json=? WHERE student_id=?').run(JSON.stringify(s),this.scope.getStore()||'legacy'); this.db.exec('COMMIT'); return result; }
    catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
  student(id:string){return this.db.prepare('SELECT id,name,created_at,code_hash,revision FROM students WHERE id=?').get(id) as {id:string;name:string;created_at:string;code_hash:string|null;revision:number}|undefined;}
  findCode(code:string){return this.db.prepare('SELECT id,revision FROM students WHERE code_hash=?').get(codeHash(code)) as {id:string;revision:number}|undefined;}
  profile(id:string):StudentProfile {
    const student=this.student(id);if(!student)throw new Error('Student does not exist');
    const state=this.withStudent(id,()=>this.read());
    return {id,name:student.name,createdAt:student.created_at,level:state.plan.level,cards:state.cards.length,attempts:state.attempts.length,lastPractice:state.attempts.at(-1)?.at||null};
  }
  listStudents():StudentProfile[]{return (this.db.prepare('SELECT id FROM students ORDER BY created_at,id').all() as {id:string}[]).map(row=>this.profile(row.id));}
  createStudent(name:string,level:string,examples=false){
    const studentId=randomBytes(16).toString('hex'),code=newCode(),state=initialState();
    state.plan.level=level;state.plan.goal='Изучение испанского языка';
    state.plan.goals=state.plan.goals.map(goal=>({...goal,now:'Определим на занятии',target:'Согласовать с преподавателем'}));state.plan.criteria=[];
    if(!examples){state.cards=[];state.audios=[];state.plan.topics=[];}
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO students (id,name,created_at,code_hash) VALUES (?,?,?,?)').run(studentId,name,new Date().toISOString(),codeHash(code));
      this.db.prepare('INSERT INTO student_workspaces VALUES (?,?)').run(studentId,JSON.stringify(state));
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return {student:this.profile(studentId),code};
  }
  rotateCode(id:string){
    const code=newCode();const result=this.db.prepare('UPDATE students SET code_hash=?,revision=revision+1 WHERE id=?').run(codeHash(code),id);
    if(result.changes!==1)throw new Error('Student does not exist');
    return code;
  }
  renameStudent(id:string,name:string){this.db.prepare('UPDATE students SET name=? WHERE id=?').run(name,id);}
  close(){this.db.close();}
}
function newCode(){return randomBytes(12).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');}
export function codeHash(code:string){return createHash('sha256').update(code.replace(/[\s-]/g,'').toUpperCase()).digest('hex');}
