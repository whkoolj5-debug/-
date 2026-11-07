export const MIN_PLAYERS=2;
import {act} from './game.js';
import {evaluateHand,rankLabel,suitLabel} from './poker-engine.js';
export const themes={
 emerald:{name:'에메랄드',felt:['#16584f','#103a38'],ink:'#2fbaa0'},
 midnight:{name:'미드나이트',felt:['#243f68','#162b46'],ink:'#729fdb'},
 burgundy:{name:'버건디',felt:['#682e46','#3c1d32'],ink:'#ce819c'}
};
export const tableTheme=t=>themes[t.theme]||themes.emerald;
export const streetName=s=>({preflop:'프리플롭',flop:'플롭',turn:'턴',river:'리버'}[s]||s);
export const actionName=s=>({small:'스몰 블라인드',big:'빅 블라인드',check:'체크',call:'콜',raise:'레이즈',allin:'올인',fold:'폴드',surrender:'영구 포기'}[s]||s);
export const cardText=cards=>cards.map(c=>`${rankLabel(c.rank)}${suitLabel(c.suit)}`).join(' ');
export function canAct(h,id,kind,target){
 if(!h||h.done||h.turn!==id)return false;
 try{act(structuredClone(h),id,kind,target);return true;}catch{return false;}
}
export function bettingInfo(h){
 const p=h?.seats[h.turn];
 if(!p||h.done)return {call:0,min:0,max:0,presets:[],canRaise:false};
 const call=Math.min(p.chips,Math.max(0,h.currentBet-p.bet));
 const min=h.currentBet+h.minRaise,max=p.bet+p.chips;
 const candidates=[['min','최소',min],['half','½ 팟',h.currentBet+Math.max(h.minRaise,Math.ceil((h.pot+call)/2))],['pot','팟',h.currentBet+Math.max(h.minRaise,h.pot+call)]];
 const used=new Set();
 const presets=candidates.filter(([, ,total])=>total<=max&&!used.has(total)&&canAct(h,h.turn,'raise',total)&&(used.add(total),true)).map(([key,label,total])=>({key,label,total}));
 return {call,min,max,presets,canRaise:canAct(h,h.turn,'raise',Math.min(min,max))};
}
// Only non-folded hands at a genuine showdown are public. An uncontested win never exposes cards.
export function showdown(h){
 if(!h?.done||h.board.length!==5)return [];
 const ids=h.ids.filter(id=>!h.folded.includes(id));
 if(ids.length<2)return [];
 return ids.map(id=>({id,cards:h.holeCards[id],category:evaluateHand([...h.holeCards[id],...h.board]).category}));
}
export function handSummary(t){
 const h=t.hand;
 if(!h?.done)return null;
 return {handNo:t.handNo,board:structuredClone(h.board),pot:h.pot,results:structuredClone(h.results),showdown:structuredClone(showdown(h)),actions:(h.log||[]).map(({frame,...a})=>structuredClone(a)),truncated:(h.actionCount||0)>200,frames:[...(h.opening?[structuredClone(h.opening)]:[]),...(h.log||[]).filter(a=>a.frame).map(({frame,...action})=>({...structuredClone(frame),action:structuredClone(action)}))],net:Object.fromEntries(h.ids.map(id=>[id,h.results.reduce((n,p)=>n+(p.payouts[id]||0),0)-(h.contributions[id]||0)]))};
}
export function rememberHand(t){
 const summary=handSummary(t);if(!summary)return;
 t.history=[...(t.history||[]).filter(h=>h.handNo!==summary.handNo),summary].slice(-10);
}
export function historyText(t,handNo){
 const hands=[...(t.history||[])];
 const current=handSummary(t);
 if(current&&!hands.some(h=>h.handNo===current.handNo))hands.push(current);
 const h=handNo===undefined?hands.at(-1):hands.find(h=>h.handNo===handNo);
 if(!h)return '아직 완료된 판 기록이 없습니다. 새 기록은 업그레이드 후 진행한 행동부터 쌓입니다.';
 const lines=[`최근 완료된 판 #${h.handNo} · 팟 ${h.pot.toLocaleString('ko-KR')}`,`공용 카드: ${cardText(h.board)||'없음'}`];
 for(const result of h.results)for(const [id,n] of Object.entries(result.payouts))lines.push(`<@${id}> 수령 +${n.toLocaleString('ko-KR')}`);
 for(const [id,net] of Object.entries(h.net||{}))lines.push(`<@${id}> 순증감 ${net>=0?'+':''}${net.toLocaleString('ko-KR')}`);
 for(const p of h.showdown)lines.push(`<@${p.id}> ${cardText(p.cards)} · ${p.category}`);
 lines.push('── 최근 행동 (최대 15개) ──');
 for(const a of h.actions.slice(-15))lines.push(`${streetName(a.street)} · <@${a.id}> ${actionName(a.kind)}${a.automatic?' (시간 초과)':''}${a.amount?` +${a.amount.toLocaleString('ko-KR')}`:''}`);
 lines.push(`최근 ${Math.min(10,hands.length)}개 판의 요약은 DB에 보관됩니다. 폴드한 패는 공개하지 않습니다.`);
 return lines.join('\n').slice(0,1950);
}

// A replay frame is deliberately a public projection, never a copy of a hand.
export function publicFrame(h,players={}){
 return {street:h.street,board:structuredClone(h.board),pot:h.pot,currentBet:h.currentBet,turn:h.turn,done:h.done,
  quitIds:Object.keys(players).filter(id=>players[id].quit),folded:[...h.folded],ids:[...h.ids],dealerIndex:h.dealerIndex,sbIndex:h.sbIndex,bbIndex:h.bbIndex,
  seats:Object.fromEntries(h.ids.map(id=>[id,{chips:h.seats[id].chips,bet:h.seats[id].bet}]))};
}
export function publicRecord(t,handNo){
 const saved=(t.history||[]).find(h=>h.handNo===handNo);
 return saved||(t.handNo===handNo?handSummary(t):null);
}
export function replayState(t,handNo,step=0){
 const record=publicRecord(t,handNo);
 if(!record?.frames?.length)throw Error('이 판에는 다시보기 기록이 없습니다. 업그레이드 후 진행한 판부터 지원합니다.');
 if(!Number.isInteger(step)||step<0||step>=record.frames.length)throw Error('유효한 다시보기 단계가 아닙니다.');
 const frame=structuredClone(record.frames[step]);
 const last=step===record.frames.length-1&&frame.done;
 const event=frame.action;
 const hand={...frame,rev:0,minRaise:0,holeCards:{},log:event?[event]:[],results:last?record.results:[],publicShowdown:last?record.showdown:[]};
 return {table:{...t,players:Object.fromEntries(Object.entries(t.players).map(([id,p])=>[id,{...p,quit:frame.quitIds?.includes(id)||false}])),status:'playing',handNo,hand},step,count:record.frames.length,
  truncated:record.truncated,label:event?`${actionName(event.kind)}${event.amount?` +${event.amount.toLocaleString('ko-KR')}`:''}${event.automatic?' (시간 초과)':''}`:'블라인드 배치'};
}
