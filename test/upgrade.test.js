import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {newHand,act} from '../src/game.js';
import {Store} from '../src/store.js';
import {Economy} from '../src/economy.js';
import {Service} from '../src/service.js';
import {bettingInfo,canAct,showdown,handSummary,rememberHand,historyText,themes,replayState,publicRecord} from '../src/table-view.js';
import {quickBet,historyPage} from '../src/interactions.js';
import {publicRows,hostRows,historyRows,embed} from '../src/ui.js';
import {renderTable,esc} from '../src/art.js';
const players=['a','b','c','d','e'].map(id=>({id,chips:1000}));
function fixture(){
 const h=newHand(players,0,10,20);
 return {id:'t',guildId:'g',ownerId:'a',ownerName:'테스트',seats:players.map(p=>p.id).concat([null,null]),players:Object.fromEntries(players.map(p=>[p.id,{name:p.id,quit:false}])),startingMoney:1000,bigBlind:20,smallBlind:10,status:'playing',handNo:1,hand:h,lastAction:Date.now()};
}
function checkdown(h){while(!h.done)act(h,h.turn,h.seats[h.turn].bet<h.currentBet?'call':'check');}
async function setup(){
 const store=new Store(':memory:'),economy=new Economy(store),service=new Service(store,economy);
 const t=await service.create('t','g','c','a','호스트',1000);
 for(const [n,id] of ['b','c','d','e'].entries())await service.join(t,id,id,n+1);
 service.blinds(t,'a',20,10);service.start(t,'a');return {store,economy,service,t};
}
test('pot shortcuts compute raise totals after calling and never mutate live state',()=>{
 const h=newHand(players,0,10,20),before=JSON.stringify(h),info=bettingInfo(h);
 assert.equal(info.call,20);assert.equal(info.min,40);assert.equal(info.max,1000);
 assert.deepEqual(info.presets.map(p=>p.total),[40,45,70]);
 for(const p of info.presets){const copy=structuredClone(h);assert.doesNotThrow(()=>act(copy,copy.turn,'raise',p.total));}
 assert.equal(JSON.stringify(h),before);
});
test('unavailable raise rights and short stacks do not offer illegal shortcuts',()=>{
 const h=newHand([{id:'a',chips:100},{id:'b',chips:35},{id:'c',chips:100}],0,10,20);
 act(h,'a','call');act(h,'b','allin');act(h,'c','call');
 assert.equal(h.turn,'a');assert.equal(bettingInfo(h).canRaise,false);assert.deepEqual(bettingInfo(h).presets,[]);
 assert.equal(canAct(h,'a','allin'),false);assert.equal(canAct(h,'a','call'),true);
 const short=newHand([{id:'a',chips:25},{id:'b',chips:100},{id:'c',chips:100}],0,10,20);
 assert.equal(bettingInfo(short).call,20);assert.equal(bettingInfo(short).canRaise,true);assert.deepEqual(bettingInfo(short).presets,[]);
});
test('when everyone else is all-in, overbet shortcuts are disabled',()=>{
 const h=newHand([{id:'a',chips:100},{id:'b',chips:20},{id:'c',chips:20}],0,10,20);
 act(h,'a','call');act(h,'b','call');
 assert(h.done);assert.deepEqual(bettingInfo(h).presets,[]);
});
test('quick bets enforce user, revision, and key; rejected actions do not debit chips',async()=>{
 const {store,service,t}=await setup();const before=JSON.stringify(t.hand),user=t.hand.turn,rev=t.hand.rev;
 assert.throws(()=>quickBet(service,t,'not-player','pot',rev),/본인 차례/);
 assert.throws(()=>quickBet(service,t,user,'pot',rev+1),/최신 버튼/);
 assert.throws(()=>quickBet(service,t,user,'fabricated',rev),/사용할 수 없는/);
 assert.equal(JSON.stringify(t.hand),before);
 const expected=bettingInfo(t.hand).presets.find(p=>p.key==='pot').total;
 assert.equal(quickBet(service,t,user,'pot',rev),expected);assert.equal(t.hand.seats[user].bet,expected);
 assert.throws(()=>quickBet(service,t,user,'pot',rev));store.close();
});
test('private buttons from a previous hand cannot match a new hand revision',async()=>{
 const {store,service,t}=await setup(),old=t.hand.rev;
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 const end=t.hand.rev;service.next(t,'a');assert(t.hand.rev>end);
 assert.throws(()=>service.action(t,t.hand.turn,'call',null,old),/최신 버튼/);store.close();
});
test('showdown reveals only non-folded hands, never an uncontested winner',()=>{
 const t=fixture(),folded=t.hand.turn;
 act(t.hand,folded,'fold');assert.deepEqual(showdown(t.hand),[]);
 checkdown(t.hand);assert.equal(showdown(t.hand).length,4);assert(!showdown(t.hand).some(p=>p.id===folded));
 const snapshot=handSummary(t);assert(!Object.hasOwn(snapshot,'deck'));assert(!Object.hasOwn(snapshot,'holeCards'));
 assert.equal(Object.values(snapshot.net).reduce((a,b)=>a+b,0),0);
 const uncontested=fixture();while(!uncontested.hand.done)act(uncontested.hand,uncontested.hand.turn,'fold');
 assert.deepEqual(showdown(uncontested.hand),[]);assert.deepEqual(handSummary(uncontested).showdown,[]);
});
test('archive is bounded, immutable, and survives a real SQLite reopen without private cards',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rsf-history-'));let s;
 try{
  const file=path.join(dir,'state.sqlite');s=new Store(file);new Economy(s);const t=fixture();checkdown(t.hand);
  for(let n=1;n<=13;n++){t.handNo=n;rememberHand(t);}
  rememberHand(t);assert.equal(t.history.length,10);assert.equal(t.history[0].handNo,4);
  const board=t.history.at(-1).board[0].id;t.hand.board[0].id='changed';assert.equal(t.history.at(-1).board[0].id,board);
  s.save(t);s.close();s=new Store(file);const service=new Service(s,new Economy(s));const restored=service.tables.get(t.id);
  assert.equal(restored.history.length,10);assert.equal(restored.history.at(-1).handNo,13);
  const serialized=JSON.stringify(restored.history);assert(!serialized.includes('"deck"'));assert(!serialized.includes('"holeCards"'));
  assert(historyPage(restored,4).content.includes('#4'));assert.throws(()=>historyPage(restored,1),/보관된/);
 }finally{s?.close();await rm(dir,{recursive:true,force:true});}
});
test('old saved games without logs/history can still be displayed and archived',()=>{
 const t=fixture();delete t.hand.log;delete t.history;
 assert.doesNotThrow(()=>embed(t,'test').toJSON());assert(historyText(t).includes('아직 완료된'));
 checkdown(t.hand);rememberHand(t);assert.equal(t.history.length,1);assert.deepEqual(t.history[0].actions,[]);
});
test('public Discord payloads keep component limits, clear costs, private START, and non-pinging history',()=>{
 const t=fixture();const live=publicRows(t);
 assert(live.flatMap(r=>r.components).some(b=>b.data.label==='콜 20'));
 assert(!live.flatMap(r=>r.components).some(b=>b.data.label==='START'));
 const description=embed(t,'test',120).toJSON().description;
 assert(description.includes('테스트 잔액'));assert(description.includes('콜 **20**'));assert(description.includes('<t:'));
 checkdown(t.hand);rememberHand(t);
 const payloads=[...publicRows(t),...hostRows(t),...historyRows(t,1)];
 for(const row of payloads){const json=row.toJSON();assert(json.components.length<=5);for(const b of json.components){assert(b.custom_id.length<=100);assert(b.label.length<=80);}}
 assert(live.length<=5);assert(embed(t,'test').toJSON().description.length<=4096);assert(historyText(t).length<=2000);
 assert(historyRows(t,1)[0].components[0].data.disabled);assert(historyRows(t,1)[0].components[1].data.disabled);
});
test('public table image cannot leak active or folded hole cards; supports Korean, hostile names, and every theme',async()=>{
 const t=fixture();t.players.a.name='<svg>&"한글';
 const original=await renderTable(t);assert.equal((await sharp(original).metadata()).width,1200);
 const altered=structuredClone(t);altered.hand.holeCards.a=[...altered.hand.holeCards.b];
 assert.deepEqual(await renderTable(altered),original);
 const folded=t.hand.turn;act(t.hand,folded,'fold');checkdown(t.hand);
 const finished=await renderTable(t);t.hand.holeCards[folded]=t.hand.holeCards[t.hand.ids.find(id=>id!==folded)];
 assert.deepEqual(await renderTable(t),finished);
 const hashes=new Set();for(const theme of Object.keys(themes)){t.theme=theme;const buffer=await renderTable(t);assert.equal((await sharp(buffer).metadata()).height,780);hashes.add(buffer.toString('base64').slice(-300));}
 assert.equal(hashes.size,3);assert.equal(esc('<&>'), '&lt;&amp;&gt;');
});

test('replay frames reconstruct public board/chips over time without showing future cards or changing live state',async()=>{
 const {store,service,t}=await setup(),folded=t.hand.turn;
 service.action(t,folded,'fold',null,t.hand.rev);
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 const before=JSON.stringify(t),record=publicRecord(t,1);
 assert(record.frames.length>10);
 const first=replayState(t,1,0);assert.equal(first.table.hand.board.length,0);assert.equal(first.table.hand.pot,30);assert.deepEqual(first.table.hand.publicShowdown,[]);
 const last=replayState(t,1,record.frames.length-1);assert.equal(last.table.hand.board.length,5);assert(last.table.hand.done);assert(!last.table.hand.publicShowdown.some(p=>p.id===folded));
 for(const frame of record.frames){assert(!Object.hasOwn(frame,'deck'));assert(!Object.hasOwn(frame,'holeCards'));}
 await renderTable(first.table);await renderTable(last.table);
 assert.throws(()=>replayState(t,1,-1),/유효한/);assert.throws(()=>replayState(t,1,10000),/유효한/);
 assert.equal(JSON.stringify(t),before);store.close();
});

test('twelve complete hands conserve money and keep only ten public replay archives after recovery',async()=>{
 const {store,service,t}=await setup();const pool=5000;
 for(let n=1;n<=12;n++){
  while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
  await service.finish(t);
  assert.equal(Object.values(t.hand.seats).reduce((sum,p)=>sum+p.chips,0),pool);
  const summary=t.history.at(-1);assert.equal(Object.values(summary.net).reduce((sum,n)=>sum+n,0),0);
  for(const frame of summary.frames){
   const chips=Object.values(frame.seats).reduce((sum,p)=>sum+p.chips,0);
   assert.equal(chips+(frame.done?0:frame.pot),pool);
  }
  if(n<12)service.next(t,'a');
 }
 assert.equal(t.history.length,10);assert.equal(t.history[0].handNo,3);
 const recovered=new Service(store,new Economy(store));assert.equal(recovered.tables.get('t').history.at(-1).handNo,12);
 assert.equal(JSON.stringify(recovered.tables.get('t').history),JSON.stringify(t.history));store.close();
});

test('replay restores surrender status at that moment rather than leaking future permanent quits',async()=>{
 const {store,service,t}=await setup();
 service.action(t,'b','surrender',null,t.hand.rev);
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 const record=publicRecord(t,1);
 assert.equal(t.players.b.quit,true);
 assert.equal(replayState(t,1,0).table.players.b.quit,false);
 assert.equal(replayState(t,1,record.frames.length-1).table.players.b.quit,true);store.close();
});
