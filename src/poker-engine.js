// Texas Hold'em core engine: 52-card deck, hand ranking, betting rounds and side pots.
export const SUITS = ["S","H","D","C"];
export const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14];
export const rankLabel = r => ({11:"J",12:"Q",13:"K",14:"A"}[r] ?? String(r));
export const suitLabel = s => ({S:"♠",H:"♥",D:"♦",C:"♣"}[s]);
export function makeDeck() {
  return SUITS.flatMap(s=>RANKS.map(r=>({suit:s,rank:r,id:`${rankLabel(r)}${s}`})));
}
export function shuffle(deck=makeDeck(), rng=Math.random) {
  const a=[...deck];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
export function dealHoles(playerIds, deck=shuffle()) {
  if(playerIds.length<2 || playerIds.length>7) throw new Error("플레이어는 2~7명이어야 합니다.");
  const hands=Object.fromEntries(playerIds.map(id=>[id,[]]));
  for(let n=0;n<2;n++) for(const id of playerIds) hands[id].push(deck.pop());
  return {hands,deck};
}
function combinations(arr,k) {
  const out=[];
  const walk=(start,chosen)=>{if(chosen.length===k){out.push(chosen);return;}
    for(let i=start;i<=arr.length-(k-chosen.length);i++)walk(i+1,[...chosen,arr[i]]);
  };walk(0,[]);return out;
}
function straightHigh(ranks) {
  const u=[...new Set(ranks)].sort((a,b)=>b-a);
  if(u.includes(14))u.push(1);
  for(let i=0;i<=u.length-5;i++) if(u[i]-u[i+4]===4)return u[i];
  return 0;
}
function scoreFive(cards) {
  const rs=cards.map(c=>c.rank).sort((a,b)=>b-a);
  const counts=new Map(); for(const r of rs)counts.set(r,(counts.get(r)||0)+1);
  const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  const flush=cards.every(c=>c.suit===cards[0].suit), sh=straightHigh(rs);
  if(flush&&sh)return [8,sh];
  if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];
  if(groups[0][1]===3&&groups[1][1]===2)return [6,groups[0][0],groups[1][0]];
  if(flush)return [5,...rs];
  if(sh)return [4,sh];
  if(groups[0][1]===3)return [3,groups[0][0],...groups.slice(1).map(g=>g[0]).sort((a,b)=>b-a)];
  if(groups[0][1]===2&&groups[1][1]===2)return [2,Math.max(groups[0][0],groups[1][0]),Math.min(groups[0][0],groups[1][0]),groups[2][0]];
  if(groups[0][1]===2)return [1,groups[0][0],...groups.slice(1).map(g=>g[0]).sort((a,b)=>b-a)];
  return [0,...rs];
}
export function evaluateHand(cards) {
  if(cards.length<5||cards.length>7)throw new Error("족보 판정에는 5~7장의 카드가 필요합니다.");
  const scored=combinations(cards,5).map(c=>scoreFive(c)).sort((a,b)=>compareScores(b,a));
  return {score:scored[0], category:["하이카드","원페어","투페어","쓰리 오브 어 카인드","스트레이트","플러시","풀하우스","포카드","스트레이트 플러시"][scored[0][0]]};
}
export function compareScores(a,b) {
  for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}
  return 0;
}
export function winners(holeCards, board, eligibleIds) {
  const scored=eligibleIds.map(id=>({id,...evaluateHand([...holeCards[id],...board])}));
  scored.sort((a,b)=>compareScores(b.score,a.score));
  return scored.filter(x=>compareScores(x.score,scored[0].score)===0);
}
// Contributions are total chips committed per player. Folded players fund pots but cannot win.
export function buildSidePots(contributions, foldedIds=[]) {
  const levels=[...new Set(Object.values(contributions).filter(v=>v>0))].sort((a,b)=>a-b);
  let prev=0; const pots=[];
  for(const level of levels){
    const contributors=Object.entries(contributions).filter(([,v])=>v>=level);
    const amount=(level-prev)*contributors.length;
    const eligible=contributors.map(([id])=>id).filter(id=>!foldedIds.includes(id));
    if(amount>0)pots.push({amount,eligible,cap:level});
    prev=level;
  }
  return pots;
}
export function settleSidePots(contributions, foldedIds, holeCards, board) {
  const pots=buildSidePots(contributions,foldedIds);
  return pots.map(p=>{
    if(!p.eligible.length)return {...p,winners:[],payouts:{}};
    const ws=winners(holeCards,board,p.eligible), each=Math.floor(p.amount/ws.length), remainder=p.amount%ws.length;
    const payouts={}; ws.forEach((w,i)=>payouts[w.id]=each+(i<remainder?1:0));
    return {...p,winners:ws.map(w=>w.id),payouts};
  });
}
export function createHand(players, dealerIndex=0, smallBlind=100, bigBlind=200, rng=Math.random) {
  if(players.length<2||players.length>7)throw new Error("플레이어 수 오류");
  if(!(smallBlind>0&&bigBlind>=smallBlind))throw new Error("블라인드 설정 오류");
  const deck=shuffle(makeDeck(),rng), ids=players.map(p=>p.id);
  const {hands,deck:remaining}=dealHoles(ids,deck);
  const sb=players.length===2?dealerIndex:(dealerIndex+1)%players.length;
  const bb=(sb+1)%players.length;
  return {deck:remaining,holeCards:hands,board:[],dealerIndex,sbIndex:sb,bbIndex:bb,
    pot:0,currentBet:bigBlind,street:"preflop",acted:[],folded:[],allIn:[],
    contributions:Object.fromEntries(ids.map(id=>[id,0])),
    seats:Object.fromEntries(players.map((p,i)=>[p.id,{chips:p.chips,bet:0}]))};
}
export function commitBet(hand,id,amount) {
  const p=hand.seats[id]; if(!p||amount<=0||!Number.isInteger(amount))throw new Error("베팅 금액 오류");
  const actual=Math.min(amount,p.chips); p.chips-=actual;p.bet+=actual;
  hand.pot+=actual;hand.contributions[id]+=actual;hand.currentBet=Math.max(hand.currentBet,p.bet);
  if(p.chips===0&&!hand.allIn.includes(id))hand.allIn.push(id);
  return actual;
}
export function revealNextStreet(hand) {
  if(hand.street==="preflop"){hand.deck.pop();hand.board.push(...hand.deck.splice(-3));hand.street="flop";}
  else if(hand.street==="flop"){hand.deck.pop();hand.board.push(hand.deck.pop());hand.street="turn";}
  else if(hand.street==="turn"){hand.deck.pop();hand.board.push(hand.deck.pop());hand.street="river";}
  else throw new Error("더 공개할 커뮤니티 카드가 없습니다.");
  for(const p of Object.values(hand.seats))p.bet=0;
  hand.currentBet=0;hand.acted=[];
  return hand.board;
}
