import {test} from 'node:test';import assert from 'node:assert/strict';
import {historyRows,replayRows,publicRows,hostRows} from '../src/ui.js';
function validate(rows){
 const ids=rows.flatMap(r=>r.toJSON().components).map(b=>b.custom_id);
 assert.equal(new Set(ids).size,ids.length,'Duplicate Discord component custom_id');
 for(const id of ids)assert(id.length<=100);
}
test('history component IDs remain unique with one hand and at either end of the history',()=>{
 for(let count=1;count<=10;count++){
  const t={id:'table',history:Array.from({length:count},(_,n)=>({handNo:n+1,frames:[{}]}))};
  for(let selected=1;selected<=count;selected++)validate(historyRows(t,selected));
 }
});
test('replay IDs are unique even when first/previous or next/last point at the same step',()=>{
 const t={id:'table'};
 for(let count=1;count<=30;count++)for(let step=0;step<count;step++)validate(replayRows(t,1,step,count));
});
test('lobby and host controls also satisfy message-wide uniqueness',()=>{
 const t={id:'t',ownerName:'Host',seats:['a','b',null,null,null,null,null],status:'lobby',blindsConfirmed:true};
 validate(publicRows(t));validate(hostRows(t));
});
