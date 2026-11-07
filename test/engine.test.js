import {test} from 'node:test';import assert from 'node:assert/strict';
import {makeDeck,evaluateHand,compareScores,settleSidePots} from '../src/poker-engine.js';
import {newHand,act} from '../src/game.js';
const cs=s=>s.split(' ').map(id=>makeDeck().find(c=>c.id===id));
test('52 unique exact rank/suit combinations',()=>{const d=makeDeck();assert.equal(d.length,52);assert.equal(new Set(d.map(c=>c.id)).size,52);});
test('best five out of seven: royal flush and wheel',()=>{
 assert.deepEqual(evaluateHand(cs('AS KS QS JS 10S 2D 3C')).score,[8,14]);
 assert.deepEqual(evaluateHand(cs('AS 2D 3C 4H 5S KD QD')).score,[4,5]);
 assert(compareScores(evaluateHand(cs('AS AD AC KH KD 2C 3S')).score,evaluateHand(cs('KS KD KC QH QD 2C 3S')).score)>0);
});
test('side pots with folded contribution and no chip loss',()=>{
 const holes={a:cs('AS AD'),b:cs('KS KD'),c:cs('QS QD')},board=cs('2S 3H 7D 8C 9S');
 const p=settleSidePots({a:100,b:200,c:300},[],holes,board);
 assert.deepEqual(p.map(x=>x.payouts),[{a:300},{b:200},{c:100}]);
 const q=settleSidePots({a:100,b:200,c:300},['a'],holes,board);assert.equal(q[0].payouts.b,300);
});
test('full hand: calls and checks reach river with 10 unique exposed/held cards',()=>{
 const h=newHand(['a','b','c','d','e'].map(id=>({id,chips:1000})),0,10,20);let n=0;
 while(!h.done&&n++<100)act(h,h.turn,h.seats[h.turn].bet<h.currentBet?'call':'check');
 assert(h.done);assert.equal(h.board.length,5);assert.equal(Object.values(h.seats).reduce((s,p)=>s+p.chips,0),5000);
 assert.equal(new Set([...Object.values(h.holeCards).flat(),...h.board].map(c=>c.id)).size,15);
});
test('surrender donates all chips but cannot win; everyone else may fold',()=>{
 const h=newHand(['a','b','c','d','e'].map(id=>({id,chips:1000})),0,10,20);
 act(h,'a','surrender');assert.equal(h.seats.a.chips,0);assert(h.folded.includes('a'));assert.equal(h.currentBet,20);
 let n=0;while(!h.done&&n++<20)act(h,h.turn,'fold');
 assert(h.done);assert.equal(h.seats.a.chips,0);assert.equal(Object.values(h.seats).reduce((s,p)=>s+p.chips,0),5000);
});
test('surrender after normal fold donates remaining chips',()=>{
 const h=newHand(['a','b','c','d','e'].map(id=>({id,chips:1000})),0,10,20);const id=h.turn;act(h,id,'fold');act(h,id,'surrender');assert.equal(h.seats[id].chips,0);assert.equal(h.folded.filter(x=>x===id).length,1);
});
test('enforce turn and minimum raises without changing chips',()=>{
 const h=newHand(['a','b','c','d','e'].map(id=>({id,chips:1000})),0,10,20);const id=h.turn;
 assert.throws(()=>act(h,h.ids.find(x=>x!==id),'call'));assert.throws(()=>act(h,id,'raise',21));assert.equal(h.seats[id].chips,1000);
 act(h,id,'raise',40);assert.equal(h.currentBet,40);assert.equal(h.minRaise,20);
});
test('short all-in does not reopen raise for a player who already acted',()=>{
 const h=newHand([{id:'a',chips:1000},{id:'b',chips:1000},{id:'c',chips:1000},{id:'d',chips:1000},{id:'e',chips:25}],0,10,20);
 act(h,'d','call');act(h,'e','allin');act(h,'a','call');act(h,'b','call');act(h,'c','call');
 assert.equal(h.turn,'d');assert.throws(()=>act(h,'d','raise',50),/권한/);act(h,'d','call');assert.equal(h.street,'flop');
});
test('random legal games conserve chips across 300 hands',()=>{
 for(let k=0;k<300;k++){
  const h=newHand(Array.from({length:2+k%6},(_,i)=>({id:String(i),chips:25+(i*37+k)%200})),0,5,10);
  const total=Object.values(h.seats).reduce((s,p)=>s+p.chips,0)+h.pot;let n=0;
  while(!h.done&&n++<200){const r=Math.random(),id=h.turn;try{act(h,id,r<.1?'surrender':r<.25?'fold':r<.45?'allin':h.seats[id].bet<h.currentBet?'call':'check');}catch{act(h,id,h.seats[id].bet<h.currentBet?'call':'check');}}
  assert(h.done);assert.equal(Object.values(h.seats).reduce((s,p)=>s+p.chips,0),total);
 }
});
