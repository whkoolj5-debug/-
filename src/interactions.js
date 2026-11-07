import {bettingInfo,historyText} from './table-view.js';
// All callers, including public buttons, must pass the server-authoritative revision and user.
export function quickBet(service,t,user,key,revision){
 service.require(t);
 if(t.status!=='playing'||!t.hand||t.hand.done)throw Error('진행 중인 판이 없습니다.');
 if(t.hand.turn!==user)throw Error('본인 차례가 아닙니다.');
 if(!Number.isInteger(revision)||revision!==t.hand.rev)throw Error('최신 버튼을 이용해주세요.');
 const preset=bettingInfo(t.hand).presets.find(p=>p.key===key);
 if(!preset)throw Error('지금 사용할 수 없는 베팅입니다. 최신 버튼을 이용해주세요.');
 service.action(t,user,'raise',preset.total,revision);
 return preset.total;
}
export function availableHistory(t){
 const list=[...(t.history||[])];
 if(t.hand?.done&&!list.some(h=>h.handNo===t.handNo))list.push({handNo:t.handNo});
 return list.sort((a,b)=>a.handNo-b.handNo);
}
export function historyPage(t,handNo){
 const list=availableHistory(t);
 const selected=handNo===undefined?list.at(-1)?.handNo:handNo;
 if(handNo!==undefined&&!list.some(h=>h.handNo===handNo))throw Error('보관된 판 번호가 아닙니다. 최근 10개 판을 확인해주세요.');
 return {content:historyText(t,selected),selected,list};
}
