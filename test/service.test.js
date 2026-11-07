import {test} from 'node:test';import assert from 'node:assert/strict';
import {Store} from '../src/store.js';import {Economy} from '../src/economy.js';import {Service} from '../src/service.js';
const setup=()=>{const s=new Store(':memory:');const e=new Economy(s);return {s,e,v:new Service(s,e)};};
test('buy-in idempotency, insufficient balance, seat collision, cancel refunds',async()=>{
 const {s,e,v}=setup();const t=await v.create('t','g','c','a','방장',500000);
 assert.equal((await e.balance('g','a')).balance,4500000);
 await e.move('t:buy:a','g','a',-500000);assert.equal((await e.balance('g','a')).balance,4500000);
 await assert.rejects(()=>v.join(t,'b','B',0));assert.equal((await e.balance('g','b')).balance,5000000);
 await v.join(t,'b','B',1);await v.cancel(t,'a');assert.equal((await e.balance('g','a')).balance,5000000);assert.equal((await e.balance('g','b')).balance,5000000);s.close();
});
test('two seats minimum, private owner control, blind validation and complete settlement',async()=>{
 const {s,e,v}=setup();const t=await v.create('t','g','c','a','A',1000);v.blinds(t,'a',20,10);
 assert.throws(()=>v.start(t,'a'));assert.throws(()=>v.blinds(t,'b',20,10));
 for(const [n,id] of ['b','c','d','e'].entries())await v.join(t,id,id,n+1);
 v.start(t,'a');const rev=t.hand.rev;v.action(t,t.hand.turn,'call',null,rev);assert.throws(()=>v.action(t,t.hand.turn,'call',null,rev));
 for(const id of ['b','c','d','e'])if(!t.hand.done)v.action(t,id,'surrender',null,t.hand.rev);
 await v.finish(t);assert.equal(t.status,'closed');assert.equal((await e.balance('g','a')).balance,5004000);assert.equal((await e.balance('g','b')).balance,4999000);await v.finish(t);assert.equal((await e.balance('g','a')).balance,5004000);s.close();
});
test('API PATCH adjusts deltas; ambiguous failures never auto retry',async()=>{
 const s=new Store(':memory:');const calls=[];
 const e=new Economy(s,{mode:'live',token:'fake',fetcher:async(url,o)=>{
  calls.push(o);if(o.method==='GET')return {ok:true,json:async()=>({cash:100,bank:1000})};throw Error('network disconnected');
 }});
 await assert.rejects(()=>e.move('x','g','u',-500));assert.equal(s.transfer('x').status,'pending');
 assert.deepEqual(JSON.parse(calls[1].body),{cash:-100,bank:-400,reason:'Discord poker x'});
 await assert.rejects(()=>e.move('x','g','u',-500));assert.equal(calls.length,2);s.close();
});
test('crash recovery finalizes acknowledged debit membership',async()=>{
 const {s,e,v}=setup();const t=await v.create('t','g','c','a','A',1000);
 t.intent={u:'b',name:'B',seat:1,tx:'t:buy:b'};v.save(t);await e.move('t:buy:b','g','b',-1000);
 const w=new Service(s,e);w.recover();assert.equal(w.tables.get('t').seats[1],'b');assert(!w.tables.get('t').intent);s.close();
});
test('multiple hands rotate dealer, retain chips and settle only at tournament end',async()=>{
 const {s,e,v}=setup();const t=await v.create('t','g','c','a','A',1000);for(const [n,id] of ['b','c','d','e'].entries())await v.join(t,id,id,n+1);v.blinds(t,'a',20,10);v.start(t,'a');
 while(!t.hand.done)v.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 await v.finish(t);assert.equal(t.status,'playing');const old=t.hand;const chips=Object.values(old.seats).reduce((n,p)=>n+p.chips,0);
 v.next(t,'a');assert.equal(t.hand.ids[t.hand.dealerIndex],'b');assert.equal(Object.values(t.hand.seats).reduce((n,p)=>n+p.chips,0)+t.hand.pot,chips);assert.equal(t.handNo,2);
 const recovered=new Service(s,e);assert.equal(recovered.tables.get('t').hand.turn,t.hand.turn);assert.deepEqual(recovered.tables.get('t').hand.deck,t.hand.deck);s.close();
});

test('exactly two seated players can start; heads-up dealer posts SB and acts first before flop',async()=>{
 const {s,e,v}=setup();const t=await v.create('duel','g','c','a','A',1000);
 v.blinds(t,'a',20,10);assert.throws(()=>v.start(t,'a'));
 await v.join(t,'b','B',1);assert.throws(()=>v.start(t,'b'),/방장/);v.start(t,'a');
 assert.equal(t.hand.ids.length,2);assert.equal(t.hand.ids[t.hand.sbIndex],'a');assert.equal(t.hand.ids[t.hand.bbIndex],'b');assert.equal(t.hand.turn,'a');
 v.action(t,'a','call',null,t.hand.rev);assert.equal(t.hand.turn,'b');v.action(t,'b','check',null,t.hand.rev);
 assert.equal(t.hand.street,'flop');assert.equal(t.hand.board.length,3);assert.equal(t.hand.turn,'b');
 while(!t.hand.done)v.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 await v.finish(t);assert.equal(t.status,'playing');v.next(t,'a');assert.equal(t.hand.ids[t.hand.dealerIndex],'b');
 assert.equal(Object.values(t.hand.seats).reduce((n,p)=>n+p.chips,0)+t.hand.pot,2000);s.close();
});

test('host force-end returns current commitments, never leaks a river hand, and prevents duplicate credits',async()=>{
 const {s,e,v}=setup(),t=await v.create('force','g','c','a','A',1000);await v.join(t,'b','B',1);v.blinds(t,'a',20,10);v.start(t,'a');
 await assert.rejects(()=>v.forceEnd(t,'b'),/방장/);assert.equal(t.status,'playing');
 await v.forceEnd(t,'a');assert.equal(t.status,'closed');assert(t.hand.aborted);for(const id of ['a','b'])assert.equal((await e.balance('g',id)).balance,5000000);
 await v.finish(t);for(const id of ['a','b'])assert.equal((await e.balance('g',id)).balance,5000000);s.close();
});
test('configured survivor threshold settles only after a completed hand and returns chip balances',async()=>{
 const {s,e,v}=setup(),t=await v.create('threshold','g','c','a','A',1000);for(const [n,id]of ['b','c'].entries())await v.join(t,id,id,n+1);v.blinds(t,'a',20,10);
 assert.throws(()=>v.setEndCount(t,'b',2),/방장/);v.setEndCount(t,'a',2);v.start(t,'a');await v.finish(t);assert.equal(t.status,'playing');
 // Complete a real hand with one permanent surrender and the other player folding.
 v.action(t,'a','surrender',null,t.hand.rev);v.action(t,t.hand.turn,'fold',null,t.hand.rev);
 const chips=Object.fromEntries(t.seats.filter(Boolean).map(id=>[id,t.hand.seats[id]?.chips||0]));await v.finish(t);assert.equal(t.status,'closed');
 for(const id of Object.keys(chips))assert.equal((await e.balance('g',id)).balance,4999000+chips[id]);s.close();
});
test('ending in lobby refunds buy-ins; configured stop count requires a larger starting field',async()=>{
 const {s,e,v}=setup(),t=await v.create('lobby-end','g','c','a','A',1000);await v.join(t,'b','B',1);v.blinds(t,'a',20,10);v.setEndCount(t,'a',2);assert.throws(()=>v.start(t,'a'));await v.forceEnd(t,'a');assert.equal(t.status,'closed');assert.equal((await e.balance('g','a')).balance,5000000);s.close();
});
