import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTransientReplies,acknowledgeQueuedInteraction,opensModal} from '../src/interaction-flow.js';
function fake(button='call:t:1'){
 const calls=[];return {calls,customId:button,deferred:false,replied:false,ephemeral:false,isButton:()=>true,
 deferReply:async function(p){this.deferred=true;this.ephemeral=Boolean(p.flags);calls.push(['deferReply',p]);},
 deferUpdate:async function(){this.deferred=true;calls.push(['deferUpdate']);},
 reply:async p=>calls.push(['reply',p]),editReply:async p=>calls.push(['editReply',p]),update:async p=>calls.push(['update',p]),
 deleteReply:async()=>calls.push(['delete']),followUp:async p=>{calls.push(['followUp',p]);return {id:'follow'};},webhook:{deleteMessage:async id=>calls.push(['deleteMessage',id])}};
}
test('bet action is acknowledged before it is queued and handler can defer/reply without double acknowledgment',async()=>{
 const raw=fake(),i=await acknowledgeQueuedInteraction(raw);assert.equal(raw.calls[0][0],'deferReply');assert.equal(raw.ephemeral,true);
 await i.deferReply({flags:64});await i.reply({content:'done',flags:64});assert.deepEqual(raw.calls.map(c=>c[0]),['deferReply','editReply']);assert.equal(raw.calls[1][1].flags,undefined);
});
test('private component updates keep their source and modal openers are never pre-deferred',async()=>{
 const raw=fake('seat:t:1'),i=await acknowledgeQueuedInteraction(raw);await i.deferUpdate();await i.update({content:'joined'});assert.deepEqual(raw.calls.map(c=>c[0]),['deferUpdate','editReply']);
 assert(opensModal(fake('raise:t:2')));assert(opensModal(fake('biginput:t')));assert(!opensModal(fake('call:t:2')));
});
test('transient private feedback expires after three seconds, but a replacement card sheet survives',async()=>{
 const raw=fake(),timers=[],i=withTransientReplies(raw,{schedule:(fn,ms)=>timers.push({fn,ms})});raw.ephemeral=true;
 await i.editReply({content:'행동을 반영했습니다.',components:[]});assert.equal(timers[0].ms,3000);await timers[0].fn();assert(raw.calls.some(c=>c[0]==='delete'));
 raw.calls.length=0;await i.editReply({content:'행동을 반영했습니다.'});await i.editReply({content:'내 카드표',files:[{}],components:[]});await timers[1].fn();assert(!raw.calls.some(c=>c[0]==='delete'));
});
test('errors expire privately while public game messages and interactive prompts persist',async()=>{
 const raw=fake(),timers=[],i=withTransientReplies(raw,{schedule:(fn,ms)=>timers.push({fn,ms})});
 await i.reply({content:'public table'});await i.reply({content:'choose',flags:64,components:[{}]});assert.equal(timers.length,0);
 await i.followUp({content:'error',flags:64});await timers[0].fn();assert(raw.calls.some(c=>c[0]==='deleteMessage'&&c[1]==='follow'));
});
