import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
export class Store{
 constructor(file='data/poker.sqlite'){
  mkdirSync(path.dirname(file),{recursive:true});this.db=new DatabaseSync(file);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS state(id TEXT PRIMARY KEY,json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS transfers(id TEXT PRIMARY KEY,guild TEXT,user TEXT,amount INTEGER,status TEXT,detail TEXT);
   CREATE TABLE IF NOT EXISTS money_commands(id TEXT PRIMARY KEY,json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS balances(id TEXT PRIMARY KEY,amount INTEGER NOT NULL);`);
 }
 load(){return this.db.prepare('SELECT json FROM state').all().map(x=>JSON.parse(x.json));}
 save(t){this.db.prepare('INSERT OR REPLACE INTO state VALUES(?,?)').run(t.id,JSON.stringify(t));}
 transfer(id){return this.db.prepare('SELECT * FROM transfers WHERE id=?').get(id);}
 pending(){return this.db.prepare("SELECT * FROM transfers WHERE status='pending'").all();}
 begin(id,g,u,n){this.db.prepare('INSERT INTO transfers VALUES(?,?,?,?,?,?)').run(id,g,u,n,'pending','');}
 mark(id,status,detail=''){this.db.prepare('UPDATE transfers SET status=?,detail=? WHERE id=?').run(status,detail,id);}
 close(){this.db.close();}
}
