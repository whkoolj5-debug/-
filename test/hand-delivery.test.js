import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandDelivery} from '../src/hand-delivery.js';
import {turnClock} from '../src/table-view.js';
import {replyInteractionError} from '../src/interaction-errors.js';
test('private delivery sends only recipient cards, survives blocked DMs and deduplicates recovery and turns',async()=>{
 const deliveries=[],t={id:'t',handNo:1,status:'playing',guildId:'g',channelId:'c',lastAction:Date.now(),hand:{ids:['a','b'],turn:'a',street:'preflop',done:false,holeCards:{a:['AS','AH'],b:['KS','KH']},seats:{a:{bet:0,chips:100},b:{bet:0,chips:100}},currentBet:0,minRaise:10}};
 const client={users:{fetch:async id=>({send:async payload=>{if(id==='b')throw Error('blocked');deliveries.push({id,payload});}})}};
 const d=createHandDelivery({client,service:{save(){}},renderHandImage:async cards=>Buffer.from(cards.join(',')),turnSeconds:60});
 await d.deal(t);await d.deal(t);await d.notifyTurn(t);
 assert.equal(deliveries.length,1);assert.equal(deliveries[0].id,'a');assert.equal(deliveries[0].payload.files[0].attachment.toString(),'AS,AH');assert.deepEqual(t.handMail.failed,['b']);
 t.hand.street='flop';await d.notifyTurn(t);await d.notifyTurn(t);assert.equal(deliveries.length,2);
 t.hand.turn='b';await d.notifyTurn(t);assert.equal(deliveries.length,2);
});
test('clock uses configured deadline and clamps remaining time',()=>{
 const t={status:'playing',hand:{done:false},lastAction:1000,turnSeconds:60};
 assert.deepEqual(turnClock(t,31000),{total:60,deadline:61000,remaining:30,ratio:0.5});assert.equal(turnClock(t,62000).remaining,0);assert.equal(turnClock({...t,replay:true}),null);
});
test('errors after public deferUpdate use a private follow-up without overwriting the public table',async()=>{
 let edited=false,payload;await replyInteractionError({deferred:true,isButton:()=>true,message:{flags:{has:()=>false}},editReply:async()=>{edited=true;},followUp:async p=>{payload=p;}},'host only');assert.equal(edited,false);assert.equal(payload.flags,64);
});
