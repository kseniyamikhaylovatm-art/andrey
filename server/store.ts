import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AppState } from '../src/types.js';
import { initialState } from './domain.js';
export class Store {
  db: DatabaseSync;
  constructor(dir:string) {
    mkdirSync(dir,{recursive:true});
    this.db = new DatabaseSync(join(dir,'mi-espanol.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)');
    this.db.prepare('INSERT OR IGNORE INTO workspace VALUES (1,?)').run(JSON.stringify(initialState()));
  }
  read(): AppState { return JSON.parse((this.db.prepare('SELECT json FROM workspace WHERE id=1').get() as {json:string}).json); }
  mutate<T>(fn:(s:AppState)=>T):T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const s=this.read(); s.summary=null; const result=fn(s); this.db.prepare('UPDATE workspace SET json=? WHERE id=1').run(JSON.stringify(s)); this.db.exec('COMMIT'); return result; }
    catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
  close(){this.db.close();}
}
