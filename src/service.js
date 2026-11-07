import {newHand,act} from './game.js';
import {rememberHand,publicFrame,MIN_PLAYERS} from './table-view.js';
export class Service{
 constructor(store,economy){this.store=store;this.economy=economy;this.tables=new Map(store.load().map(t=>[t.id,t]));}
 save(t){this.store.save(t);return t;}
 forUser(g,u){return [...this.tables.values()].find(t=>t.guildId===g&&t.status!=='closed'&&(t.ownerId===u||t.seats.includes(u)));}
 require(t){if(!t||t.status==='closed')throw Error('종료되었거나 없는 테이블입니다.');if(t.status==='paused')throw Error('잔액 거래 확인이 필요해 테이블이 일시정지되었습니다.');}
 owner(t,u){this.require(t);if(t.ownerId!==u)throw Error('방장만 사용할 수 있습니다.');}
 async create(id,g,c,u,name,amount){
  if(this.forUser(g,u))throw Error('이미 참여 중인 테이블이 있습니다.');
  const t={id,guildId:g,channelId:c,ownerId:u,ownerName:name,startingMoney:amount,status:'lobby',seats:Array(7).fill(null),players:{},smallBlind:0,bigBlind:0,blindsConfirmed:false,messageId:null,handNo:0};
  this.tables.set(id,t);this.save(t);
  try{await this.join(t,u,name,0);}catch(e){if(!this.store.pending().some(x=>x.id.startsWith(id+':'))){t.status='closed';this.save(t);}throw e;}return t;
 }
 async join(t,u,name,seat){
  this.require(t);if(t.status!=='lobby')throw Error('이미 시작한 테이블입니다.');
  if(!Number.isInteger(seat)||seat<0||seat>6||t.seats[seat])throw Error('이미 사용 중인 자리입니다.');
  if(this.forUser(t.guildId,u)&&this.forUser(t.guildId,u)!==t ||t.seats.includes(u))throw Error('이미 참여 중입니다.');
  const tx=`${t.id}:buy:${u}`;
  // Persist intended membership before an external mutation. Pending never auto-retries.
  t.intent={u,name,seat,tx};this.save(t);
  try{await this.economy.move(tx,t.guildId,u,-t.startingMoney);}
  catch(e){if(this.store.transfer(tx)?.status==='pending')t.status='paused';else delete t.intent;this.save(t);throw e;}
  t.seats[seat]=u;t.players[u]={name,quit:false};delete t.intent;this.save(t);
 }
 blinds(t,u,big,small){this.owner(t,u);if(t.status!=='lobby')throw Error('게임 시작 전만 설정할 수 있습니다.');if(!(small>0&&small<=big&&big<=t.startingMoney))throw Error('스몰 ≤ 빅 ≤ 시작머니로 입력해주세요.');t.bigBlind=big;t.smallBlind=small;t.blindsConfirmed=true;this.save(t);}
 start(t,u){this.owner(t,u);if(t.endCountConfirmed===false||t.status!=='lobby'||t.seats.filter(Boolean).length<Math.max(MIN_PLAYERS,(t.endAtPlayers||1)+1)||!t.blindsConfirmed)throw Error('최소 2명과 블라인드 확정이 필요합니다.');t.status='playing';this.next(t,u);}
 next(t,u){this.owner(t,u);if(t.status!=='playing'||t.hand&&!t.hand.done)throw Error('현재 판이 끝난 뒤 진행하세요.');
  const ids=t.seats.filter(id=>id&&!t.players[id].quit&&(!t.hand||t.hand.seats[id]?.chips>0));
  if(ids.length<2)throw Error('진행 가능한 인원이 부족합니다.');
  rememberHand(t);
  const old=t.hand;const previousDealer=old?.ids[old.dealerIndex];
  let dealer=0;if(previousDealer){const n=t.seats.indexOf(previousDealer);for(let i=1;i<=7;i++){const candidate=t.seats[(n+i)%7];if(ids.includes(candidate)){dealer=ids.indexOf(candidate);break;}}}
  t.hand=newHand(ids.map(id=>({id,chips:old?old.seats[id].chips:t.startingMoney})),dealer,t.smallBlind,t.bigBlind);
  // Revisions never repeat across hands: old private buttons cannot act in a new hand.
  t.hand.rev+=(old?.rev??-1)+1;
  delete t.nextHandAt;t.handNo++;t.lastAction=Date.now();
  t.hand.log=[{id:t.hand.ids[t.hand.sbIndex],kind:'small',amount:t.hand.seats[t.hand.ids[t.hand.sbIndex]].bet,street:'preflop'},
   {id:t.hand.ids[t.hand.bbIndex],kind:'big',amount:t.hand.seats[t.hand.ids[t.hand.bbIndex]].bet,street:'preflop'}];
  t.hand.opening=publicFrame(t.hand,t.players);
  this.save(t);
 }
 action(t,u,kind,target,rev,source='player'){this.require(t);if(t.status!=='playing'||!t.hand||t.hand.done)throw Error('진행 중인 판이 없습니다.');if(rev!==t.hand.rev)throw Error('화면이 갱신되었습니다. 최신 버튼을 이용해주세요.');
  const before=t.hand.contributions[u]||0,street=t.hand.street;
  act(t.hand,u,kind,target);
  if(kind==='surrender')t.players[u].quit=true;
  // Winnings may already be added by act(); committed chips are tracked independently.
  const entry={id:u,kind,automatic:source==='timeout',amount:(t.hand.contributions[u]||0)-before,street};
  t.hand.actionCount=(t.hand.actionCount||0)+1;
  t.hand.log=[...(t.hand.log||[]),{...entry,frame:publicFrame(t.hand,t.players)}].slice(-200);
  rememberHand(t);
  t.lastAction=Date.now();this.save(t);
 }
 async finish(t){
  if(t.status==='closed')return;
  rememberHand(t);
  if(t.status==='lobby')throw Error('대기 테이블은 취소를 사용하세요.');
  const alive=t.seats.filter(id=>id&&!t.players[id].quit&&t.hand?.seats[id]?.chips>0);
  if(t.status==='playing'&&(!t.hand.done||alive.length>(t.endAtPlayers||1)))return;
  if(!['playing','settling'].includes(t.status))return;
  t.status='settling';this.save(t);
  for(const id of t.seats.filter(Boolean)){
    const amount=t.hand?.seats[id]?.chips??0;
    if(amount)await this.economy.move(`${t.id}:pay:${id}`,t.guildId,id,amount);
  }
  t.status='closed';this.save(t);
 }
 setEndCount(t,u,n){this.owner(t,u);if(t.status!=='lobby'||!Number.isInteger(n)||n<1||n>6)throw Error('종료 인원은 시작 전에 1~6명으로 설정하세요.');t.endAtPlayers=n;t.endCountConfirmed=true;this.save(t);}
 async forceEnd(t,u){
  this.owner(t,u);
  if(t.status==='lobby'||t.status==='refunding')return this.cancel(t,u);
  if(!['playing','settling'].includes(t.status))throw Error('거래 확인 후 종료해주세요.');
  if(t.status==='playing'&&!t.hand.done){
   const h=t.hand;const payouts={};
   for(const id of h.ids){const n=h.contributions[id]||0;h.seats[id].chips+=n;if(n)payouts[id]=n;}
   h.results=[{amount:h.pot,winners:[],payouts}];h.aborted=true;h.done=true;h.rev++;h.turn=null;
  }
  t.forcedEnd=true;t.status='settling';this.save(t);await this.finish(t);
 }
 async cancel(t,u){this.owner(t,u);if(t.status!=='lobby'&&t.status!=='refunding')throw Error('게임 시작 전만 취소할 수 있습니다.');
  t.status='refunding';this.save(t);
  for(const id of t.seats.filter(Boolean))await this.economy.move(`${t.id}:refund:${id}`,t.guildId,id,t.startingMoney);
  t.status='closed';this.save(t);
 }
 recover(){
  for(const t of this.tables.values()){
   if(t.intent){const x=t.intent,tx=this.store.transfer(x.tx);
    if(tx?.status==='done'){t.seats[x.seat]=x.u;t.players[x.u]={name:x.name,quit:false};delete t.intent;}
    else if(tx?.status==='pending')t.status='paused';else delete t.intent;this.save(t);
   }
  }
 }
}
