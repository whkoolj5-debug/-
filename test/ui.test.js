import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {publicRows,hostRows} from '../src/ui.js';import {commands} from '../src/commands.js';import {Store} from '../src/store.js';import {Economy} from '../src/economy.js';import {makeDeck} from '../src/poker-engine.js';
test('seat layouts fit five-button limit; public START is disabled until two players join',()=>{
 const t={id:'t',ownerName:'A',seats:['1',null,null,null,null,null,null],status:'lobby',blindsConfirmed:true};
 assert(hostRows(t).flatMap(r=>r.components).find(b=>b.data.label==='START').data.disabled);
 t.seats[1]='2';assert(hostRows(t).flatMap(r=>r.components).some(b=>b.data.label==='START'));
 assert.equal(publicRows(t).flatMap(r=>r.components).find(b=>b.data.label==='START').data.disabled,false);
 for(const r of [...publicRows(t),...hostRows(t)])assert(r.toJSON().components.length<=5);
 assert(commands.find(c=>c.name==='포커').options.find(c=>c.name==='테이블').options.find(c=>c.name==='만들기'));
 assert(commands.find(c=>c.name==='빅').options[0].options.find(c=>c.name==='설정'));
});
test('every logical card has the matching correct pip-count SVG and PNG',async()=>{
 const manifest=JSON.parse(await readFile('assets/cards/manifest.json','utf8'));assert.equal(manifest.length,52);
 for(const c of makeDeck()){
  const row=manifest.find(x=>x.id===c.id);assert.equal(row.rank,c.rank);assert.equal(row.suit,c.suit);
  const svg=await readFile(`assets/cards/${c.id}.svg`,'utf8');
  const expectedCenter=c.rank===14?1:c.rank<=10?c.rank:0;
  assert.equal((svg.match(/<path d="M0,9|<path d="M0,-22|<path d="M0,-24|<path d="M-5,-7/g)||[]).length,2+expectedCenter);
  const metadata=await sharp(row.file).metadata();assert.equal(metadata.width,180);assert.equal(metadata.height,252);
 }
});
test('test and live data cannot be mixed',()=>{const s=new Store(':memory:');new Economy(s);assert.throws(()=>new Economy(s,{mode:'live',token:'fake'}),/DATABASE_PATH/);s.close();});
