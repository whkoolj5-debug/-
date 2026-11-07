import {test} from 'node:test';
import assert from 'node:assert/strict';
import {turnClock} from '../src/table-view.js';
import {replyInteractionError} from '../src/interaction-errors.js';
test('clock uses configured deadline and clamps remaining time',()=>{
 const t={status:'playing',hand:{done:false},lastAction:1000,turnSeconds:60};
 assert.deepEqual(turnClock(t,31000),{total:60,deadline:61000,remaining:30,ratio:0.5});assert.equal(turnClock(t,62000).remaining,0);assert.equal(turnClock({...t,replay:true}),null);
});
test('errors after public deferUpdate use a private follow-up without overwriting the public table',async()=>{
 let edited=false,payload;await replyInteractionError({deferred:true,isButton:()=>true,message:{flags:{has:()=>false}},editReply:async()=>{edited=true;},followUp:async p=>{payload=p;}},'host only');assert.equal(edited,false);assert.equal(payload.flags,64);
});
