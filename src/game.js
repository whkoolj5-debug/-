import {randomInt} from 'node:crypto';
import {createHand,commitBet,revealNextStreet,settleSidePots} from './poker-engine.js';
export const active = h => h.ids.filter(id=>!h.folded.includes(id));
const able = h => active(h).filter(id=>h.seats[id].chips>0);
const after = (h,id,predicate) => {
  const start=h.ids.indexOf(id);
  for(let n=1;n<=h.ids.length;n++){const next=h.ids[(start+n)%h.ids.length];if(predicate(next))return next;}
  return null;
};
export function newHand(players,dealer=0,small=10,big=20){
  const h=createHand(players,dealer,small,big,()=>randomInt(0,2**32)/2**32);
  Object.assign(h,{ids:players.map(p=>p.id),minRaise:big,big,acted:[],rev:0,done:false,lastActionBet:{}});
  commitBet(h,h.ids[h.sbIndex],small);commitBet(h,h.ids[h.bbIndex],big);
  h.turn=after(h,h.ids[h.bbIndex],id=>able(h).includes(id));
  advance(h);return h;
}
function award(h){
  // A surrender is a donation, even for layers no remaining hand matched.
  // Roll such orphan layers into the lowest pot with an eligible player.
  const ordered=[...h.ids.slice(h.dealerIndex+1),...h.ids.slice(0,h.dealerIndex+1)];
  const pots=settleSidePots(Object.fromEntries(ordered.map(id=>[id,h.contributions[id]])),h.folded,h.holeCards,h.board);
  const orphan=pots.filter(p=>!p.eligible.length).reduce((s,p)=>s+p.amount,0);
  const base=pots.find(p=>p.eligible.length);
  if(orphan&&base){const each=Math.floor(orphan/base.winners.length),extra=orphan%base.winners.length;
    base.winners.forEach((id,i)=>base.payouts[id]=(base.payouts[id]||0)+each+(i<extra?1:0));}
  return pots;
}
function finish(h){
  h.results=active(h).length===1?[{amount:h.pot,winners:active(h),payouts:{[active(h)[0]]:h.pot}}]:award(h);
  for(const p of h.results)for(const [id,n] of Object.entries(p.payouts))h.seats[id].chips+=n;
  h.done=true;h.turn=null;h.rev++;
}
export function advance(h){
  if(active(h).length===1){finish(h);return;}
  for(;;){
    const actors=able(h);
    const needed=actors.filter(id=>h.seats[id].bet<h.currentBet||!h.acted.includes(id));
    if(actors.length>1&&needed.length || actors.length===1&&h.seats[actors[0]].bet<h.currentBet){
      if(!needed.includes(h.turn))h.turn=after(h,h.turn??h.ids[h.dealerIndex],id=>needed.includes(id));return;
    }
    if(h.street==='river'){finish(h);return;}
    revealNextStreet(h);h.minRaise=h.big;h.lastActionBet={};
    h.turn=after(h,h.ids[h.dealerIndex],id=>able(h).includes(id));
  }
}
export function act(h,id,action,target){
  if(h.done||!h.seats[id]||(h.folded.includes(id)&&action!=='surrender'))throw Error('진행 중인 참가자만 사용할 수 있습니다.');
  if(action!=='surrender'&&h.turn!==id)throw Error('본인 차례가 아닙니다.');
  const p=h.seats[id],old=h.currentBet;
  if(action==='surrender'){
    if(p.chips)commitBet(h,id,p.chips);
    if(!h.folded.includes(id))h.folded.push(id);
    // Forfeit donation does not force opponents to match a new bet.
    h.currentBet=old;
  }else if(action==='fold')h.folded.push(id);
  else if(action==='check'){
    if(p.bet<old)throw Error('체크할 수 없습니다. 콜 또는 폴드를 선택하세요.');
  }else if(action==='call'){
    if(old>p.bet)commitBet(h,id,old-p.bet);
  }else if(action==='raise'||action==='allin'){
    const total=action==='allin'?p.bet+p.chips:target;
    if(!Number.isSafeInteger(total)||total<=p.bet||total>p.bet+p.chips)throw Error('베팅 금액을 확인해주세요.');
    if(total>old){
      if(h.lastActionBet[id]!==undefined&&old-h.lastActionBet[id]<h.minRaise)throw Error('짧은 올인 이후 레이즈 권한이 아직 열리지 않았습니다.');
      if(total-old<h.minRaise&&total!==p.bet+p.chips)throw Error(`최소 레이즈 합계는 ${old+h.minRaise}입니다.`);
      if(able(h).filter(x=>x!==id).length===0)throw Error('상대가 모두 올인 상태입니다. 콜 또는 체크하세요.');
    }else if(action==='raise')throw Error('현재 베팅보다 큰 금액을 입력하세요.');
    commitBet(h,id,total-p.bet);
    if(total-old>=h.minRaise){h.minRaise=total-old;h.acted=[];}
  }else throw Error('알 수 없는 행동입니다.');
  const previousTurn=h.turn;
  if(action!=='surrender'){if(!h.acted.includes(id))h.acted.push(id);h.lastActionBet[id]=h.currentBet;}
  if(action!=='surrender'||previousTurn===id)h.turn=after(h,id,x=>able(h).includes(x));
  h.rev++;advance(h);return h;
}
