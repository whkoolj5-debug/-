import {MessageFlags,ModalBuilder,TextInputBuilder,TextInputStyle,ActionRowBuilder,AttachmentBuilder,ButtonStyle,PermissionFlagsBits,EmbedBuilder} from 'discord.js';
import {randomUUID} from 'node:crypto';
import {renderTable,handImage,boardImage} from './art.js';
import {money,btn,rows,confirm,publicRows,hostRows,embed,historyRows,replayRows} from './ui.js';
import {bettingInfo,handSummary,themes,replayState,streetName,cardText} from './table-view.js';
import {quickBet,historyPage} from './interactions.js';
import {accessError,tableChannel} from './channel-access.js';
import {turnClock} from './table-view.js';
import {evaluateHand} from './poker-engine.js';

export function amount(s){if(!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(s.trim()))throw Error('정확한 정수를 입력해주세요. 예: 500,000');const n=Number(s.replaceAll(',',''));if(!Number.isSafeInteger(n)||n<1||n>100000000)throw Error('금액은 1~100,000,000 범위입니다.');return n;}

export function createDiscordRuntime({client,store,economy,service,config,renderTableImage=renderTable,renderHandImage=handImage,renderBoardImage=boardImage}){
 const {mode}=config;
 const E={flags:MessageFlags.Ephemeral};
 const panels=new Map(),drafts=new Map(),boardKeys=new Map(),clockRenders=new Map();
function modal(i,id,title,label){return i.showModal(new ModalBuilder().setCustomId(id).setTitle(title).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(15))));}
const find=i=>service.forUser(i.guildId,i.user.id);
function table(id,i){const t=service.tables.get(id);if(t?.guildId!==i.guildId)throw Error('이 서버의 테이블이 아닙니다.');return t;}
async function render(t){
 const channel=await tableChannel(client,t.channelId,t.guildId);
 const stamp=`${t.id}-${t.handNo||0}-${t.hand?.rev||0}-${randomUUID().slice(0,8)}`;
 const tableName=`table-${stamp}.png`;
 const clock=turnClock({...t,turnSeconds:config.turnSeconds});
 const title=clock?`# 🟢 YOUR TURN — <@${t.hand.turn}>\n## ⏱ TIME LEFT: <t:${Math.floor(clock.deadline/1000)}:R>\n`:'';
 const payload={content:title+`<@${t.ownerId}>님의 테이블 · 스타트머니 ${money(t.startingMoney)}`,embeds:[embed(t,mode,config.turnSeconds).setImage(null)],files:[new AttachmentBuilder(await renderTableImage({...t,displayMode:mode,turnSeconds:config.turnSeconds,clockNow:Date.now()}),{name:tableName})],components:publicRows(t),allowedMentions:{parse:[]}};
 if(t.messageId){try{const m=await channel.messages.fetch(t.messageId);await m.edit({...payload,attachments:[]});}catch(e){if(e.code!==10008)throw accessError(e);t.messageId=null;}}
 if(!t.messageId){let m;try{m=await channel.send({...payload,allowedMentions:{users:[t.ownerId]}});}catch(error){throw accessError(error);}t.messageId=m.id;service.save(t);}
 clockRenders.set(t.id,Date.now());
 const boardKey=JSON.stringify([t.handNo,t.hand?.street,t.hand?.board]);
 if((t.hand?.board.length||t.boardMessageId)&&boardKeys.get(t.id)!==boardKey){
  const boardName=`board-${stamp}.png`,board=t.hand?.board||[];
  const boardPayload={content:`# Community Cards · ${board.length?streetName(t.hand.street):'Waiting for flop'} · Hand #${t.handNo}\n${cardText(board)}`,files:[new AttachmentBuilder(await renderBoardImage(board,t.hand?.street),{name:boardName})],allowedMentions:{parse:[]}};
  if(t.boardMessageId){try{await (await channel.messages.fetch(t.boardMessageId)).edit({...boardPayload,attachments:[]});}catch(e){if(e.code!==10008)throw accessError(e);t.boardMessageId=null;}}
  if(!t.boardMessageId){t.boardMessageId=(await channel.send(boardPayload)).id;service.save(t);}
  boardKeys.set(t.id,boardKey);
 }
 const p=panels.get(t.id);if(p)await p.editReply({content:`방장 전용 · 참가 ${t.seats.filter(Boolean).length}/7 · ${t.status}`,components:hostRows(t)}).catch(()=>panels.delete(t.id));
}
async function panel(i,t){service.owner(t,i.user.id);await i.reply({...E,content:`방장 전용 · 참가 ${t.seats.filter(Boolean).length}/7 · ${t.status}`,components:hostRows(t)});panels.set(t.id,i);}
async function history(i,t,handNo,update=false){
 const page=historyPage(t,handNo);
 const payload={attachments:[],content:page.content,components:historyRows(t,page.selected),allowedMentions:{parse:[]}};
 return update?i.update(payload):i.reply({...E,...payload});
}
async function cards(i,t){
 service.require(t);const h=t.hand,c=h?.holeCards[i.user.id];if(!c||t.players[i.user.id]?.quit)throw Error('이번 판에 받은 카드가 없습니다.');
 await i.deferReply(E);
 const ownTurn=!h.done&&h.turn===i.user.id,info=bettingInfo(h);
 const category=h.board.length>=3?`\n현재 내 족보: **${evaluateHand([...c,...h.board]).category}** (승리를 보장하지 않습니다.)`:'';
 await i.editReply({content:`🃏 내 카드 · 이 채널에서 나에게만 표시됩니다.${category}\n${ownTurn?`지금 내 차례 · 콜 ${money(info.call)} · 빠른 베팅은 라운드 총액입니다.`:'행동은 내 차례에만 가능합니다. 최신 테이블 버튼을 사용해주세요.'}`,files:[new AttachmentBuilder(await renderHandImage(c),{name:'my-cards.png'})],components:ownTurn?publicRows(t):[]});
}
async function surrender(i,t){service.require(t);if(t.status!=='playing'||t.hand.done||!t.hand.seats[i.user.id]||t.players[i.user.id]?.quit)throw Error('진행 중인 참가자만 포기할 수 있습니다.');await i.reply({...E,content:'정말 포기하겠습니까?\n남은 칩 전부를 판에 넣고 폴드하며, 승리해도 팟을 받을 수 없습니다.',components:confirm('quit',t,`:${t.handNo}`)});}
async function postAction(t){await service.finish(t);await render(t);}
async function handle(i){
 if(!i.inGuild())throw Error('서버 채널에서 사용해주세요.');
 if(i.guildId!==config.guildId)throw Error('설정된 서버에서만 사용할 수 있습니다.');
 if(i.isChatInputCommand()){
  const sub=i.options.getSubcommand(false);
  if(i.commandName==='포커'){
   if(sub==='만들기'&&find(i)?.ownerId===i.user.id)return panel(i,find(i));
   if(sub==='만들기')return i.reply({...E,content:'게임 스타팅머니를 정해주세요.',components:rows([btn('createinput','시작머니 입력',ButtonStyle.Primary)])});
   if(sub==='관리')return panel(i,find(i));
   if(sub==='도움말')return i.reply({...E,content:'잔액·송금·관리자 지급 안내는 !help를 입력하세요.\n① /포커 테이블 만들기 → 시작머니 입력\n② /빅 스몰 설정 → 방장만 설정\n③ 2명 이상 참가 → 방장이 테이블 아래 START\n④ 채널에서 /포커 카드 → 본인 전용 카드 확인 → 내 차례에 행동\n⑤ 판 종료 → 방장이 다음 판 시작\n\n콜은 표시된 금액만 추가합니다. 레이즈와 빠른 베팅의 숫자는 이번 라운드 총액입니다. 팟 버튼은 콜 후 팟 크기만큼 레이즈합니다. ㅈㅈ는 일반 폴드와 달리 남은 칩 전액을 기부하고 영구 포기합니다.\n/포커 기록으로 이전 판 결과와 순증감을 확인할 수 있습니다.'});
   if(sub==='기록'){const t=find(i)||[...service.tables.values()].filter(t=>t.guildId===i.guildId&&t.seats.includes(i.user.id)).at(-1);if(!t)throw Error('참가했던 테이블이 없습니다.');return history(i,t,i.options.getInteger('판')??undefined);}
   if(sub==='카드')return cards(i,find(i));
   if(sub==='카드목록')return i.reply({...E,files:[new AttachmentBuilder('assets/deck-preview.png',{name:'52-cards.png'})]});
   if(sub==='잔액')return i.reply({...E,content:'잔액 확인은 이제 채팅에 !bal을 입력하세요. 전체 안내: !help'});
  }
  if(i.commandName==='빅'){const t=find(i);service.owner(t,i.user.id);if(t.status!=='lobby')throw Error('게임 시작 전만 설정할 수 있습니다.');return i.reply({...E,content:'빅블라인드 금액을 설정해주세요.',components:rows([btn(`biginput:${t.id}`,'금액 입력',ButtonStyle.Primary)])});}
  if(i.commandName==='ㅈㅈ')return surrender(i,find(i));
  if(i.commandName==='포커거래'){
   if(!i.memberPermissions.has(PermissionFlagsBits.Administrator))throw Error('서버 관리자 전용입니다.');
   if(sub==='목록')return i.reply({...E,content:store.pending().filter(x=>x.guild===i.guildId).map(x=>`${x.id} · <@${x.user}> · ${x.amount}`).join('\n').slice(0,1900)||'미확정 거래가 없습니다.'});
   const id=i.options.getString('거래번호'),tx=store.transfer(id);if(!tx||tx.guild!==i.guildId||tx.status!=='pending')throw Error('해당 미확정 거래가 없습니다.');
   store.mark(id,i.options.getBoolean('반영됨')?'done':'failed','관리자가 외부 거래기록을 확인함');
   const t=[...service.tables.values()].find(t=>id.startsWith(t.id+':'));
   if(t?.status==='paused'){t.status='lobby';service.save(t);service.recover();}
   await i.reply({...E,content:'거래 확인을 기록했습니다. 미반영 참가비는 다시 참가해주세요. 정산 거래는 방장 관리에서 이어서 처리하세요.'});if(t)await render(t);return;
  }
 }
 if(i.isButton()){
  const [a,id,v,w]=i.customId.split(':');
  if(a==='createinput')return modal(i,'create','게임 스타팅머니','게임 스타팅머니를 정해주세요.');
  const t=table(id,i);
  if(a==='replay'){
   const replay=replayState(t,Number(v),Number(w));
   await i.deferUpdate();
   return i.editReply({content:`판 #${v} 다시보기 · ${replay.step+1}/${replay.count} · ${replay.label}${replay.truncated?' · 시작 배치와 최근 200개 행동 (중간 생략)':''}\n실제 게임에는 영향을 주지 않는 저장된 기록입니다.`,attachments:[],files:[new AttachmentBuilder(await renderTableImage({...replay.table,replay:true,displayMode:mode}),{name:'replay.png'})],components:replayRows(t,Number(v),replay.step,replay.count),allowedMentions:{parse:[]}});
  }
  if(a==='history')return history(i,t,v===undefined?undefined:Number(v),v!==undefined);
  if(a==='export'){const records=[...(t.history||[])],current=handSummary(t);if(current&&!records.some(h=>h.handNo===current.handNo))records.push(current);return i.reply({...E,content:'공용 카드·공개된 쇼다운·행동·순증감만 포함합니다. 폴드한 패와 덱은 제외됩니다.',files:[new AttachmentBuilder(Buffer.from(JSON.stringify(records.slice(-10),null,2)),{name:'rsf-hand-history.json'})]});}
  if(a==='refresh'){service.owner(t,i.user.id);await i.deferUpdate();if(i.message?.flags?.has(MessageFlags.Ephemeral))panels.set(t.id,i);return render(t);}
  if(a==='theme'){service.owner(t,i.user.id);const keys=Object.keys(themes);t.theme=keys[(keys.indexOf(t.theme||'emerald')+1)%keys.length];service.save(t);await i.deferUpdate();return render(t);}
  if(a==='cards')return cards(i,t);
  if(a==='surrender')return surrender(i,t);
  if(a==='join'){
   service.require(t);if(t.status!=='lobby')throw Error('이미 시작되었습니다.');if(find(i))throw Error('이미 테이블에 참여 중입니다.');
   await i.deferReply(E);if((await economy.balance(i.guildId,i.user.id)).balance<t.startingMoney)throw Error('balance가 부족합니다.');
   return i.editReply({content:'몇번테이블에 참여하실건가요?',components:rows(t.seats.map((u,n)=>btn(`seat:${id}:${n}`,String(n+1),ButtonStyle.Secondary,Boolean(u))))});
  }
  if(a==='seat'){await i.deferUpdate();await service.join(t,i.user.id,i.member.displayName,Number(v));await i.editReply({content:`${Number(v)+1}번 자리에 참여했습니다.`,components:[]});return render(t);}
  if(['biginput','smallinput','blindyes','blindno','start','next','cancel','cancelyes','cancelno','retry'].includes(a))service.owner(t,i.user.id);
  if(a==='biginput'){if(t.status!=='lobby')throw Error('게임 시작 전만 설정 가능합니다.');drafts.delete(`${t.id}:${i.user.id}`);return modal(i,`big:${id}`,'빅블라인드 설정','빅블라인드 금액을 설정해주세요');}
  if(a==='smallinput'){const d=drafts.get(`${id}:${i.user.id}`);if(!d||d.nonce!==v)throw Error('설정을 처음부터 다시 시작해주세요.');return modal(i,`small:${id}:${v}`,'스몰 블라인드 설정','스몰 블라인드 금액을 설정해주세요');}
  if(a==='blindno'){drafts.delete(`${id}:${i.user.id}`);return modal(i,`big:${id}`,'빅블라인드 설정','빅블라인드 금액을 설정해주세요');}
  if(a==='blindyes'){
   const d=drafts.get(`${id}:${i.user.id}`);if(!d||d.nonce!==v||!d.small)throw Error('설정이 만료되었습니다. 다시 설정해주세요.');
   service.blinds(t,i.user.id,d.big,d.small);drafts.delete(`${id}:${i.user.id}`);await i.update({content:'블라인드 설정이 확정되었습니다.',components:[]});return render(t);
  }
  if(a==='start'||a==='next'){await i.deferUpdate();if(a==='start')service.start(t,i.user.id);else service.next(t,i.user.id);await postAction(t);return;}
  if(a==='cancel')return i.reply({...E,content:'대기 테이블을 취소하고 참가비를 모두 반환할까요?',components:confirm('cancel',t)});
  if(a==='cancelno'||a==='quitno')return i.update({content:'취소했습니다. 게임을 계속합니다.',components:[]});
  if(a==='cancelyes'){await i.deferUpdate();await service.cancel(t,i.user.id);await i.editReply({content:'참가비 반환을 완료했습니다.',components:[]});return render(t);}
  if(a==='retry'){await i.deferUpdate();if(t.status==='refunding')await service.cancel(t,i.user.id);else await service.finish(t);return render(t);}
  if(a==='quityes'){
   if(Number(v)!==t.handNo)throw Error('이미 다음 판입니다. 포기를 다시 요청해주세요.');
   await i.deferUpdate();service.action(t,i.user.id,'surrender',null,t.hand.rev);await i.editReply({content:'남은 칩을 모두 넣고 포기했습니다.',components:[]});return postAction(t);
  }
  if(a.startsWith('quick_')||['check','call','raise','allin','fold'].includes(a)){
   service.require(t);if(t.hand?.turn!==i.user.id)throw Error('본인 차례가 아닙니다.');
   if(Number(v)!==t.hand.rev)throw Error('최신 버튼을 이용해주세요.');
   if(a.startsWith('quick_')){
    await i.deferReply(E);const total=quickBet(service,t,i.user.id,a.slice(6),Number(v));await i.editReply(`총 ${money(total)} 베팅을 반영했습니다.`);return postAction(t);
   }
   if(a==='raise')return modal(i,`bet:${id}:${v}`,'베팅 / 레이즈','이번 라운드의 내 총 베팅액');
   await i.deferReply(E);service.action(t,i.user.id,a,null,Number(v));await i.editReply('행동을 반영했습니다.');return postAction(t);
  }
 }
 if(i.isModalSubmit()){
  const [a,id,v]=i.customId.split(':'),n=amount(i.fields.getTextInputValue('amount'));
  if(a==='create'){
   await i.deferReply(E);await tableChannel(client,i.channelId,i.guildId);
   const existing=find(i);
   if(existing?.ownerId===i.user.id){await i.editReply({content:'이전에 만든 테이블을 다시 표시합니다. 참가비를 추가로 차감하지 않습니다.',components:hostRows(existing)});panels.set(existing.id,i);return render(existing);}
   const t=await service.create(randomUUID().slice(0,12),i.guildId,i.channelId,i.user.id,i.member.displayName,n);
   await i.editReply({content:`테이블이 만들어졌습니다. 시작머니 ${money(n)}${mode==='test'?' (테스트)':''}`,components:hostRows(t)});if(i.message?.flags?.has(MessageFlags.Ephemeral))panels.set(t.id,i);return render(t);
  }
  const t=table(id,i);
  if(a==='big'){service.owner(t,i.user.id);if(t.status!=='lobby')throw Error('게임 시작 전만 설정 가능합니다.');if(n>t.startingMoney)throw Error('시작머니 이하로 입력해주세요.');
   const nonce=randomUUID().slice(0,8);drafts.set(`${id}:${i.user.id}`,{big:n,nonce});return i.reply({...E,content:'스몰 블라인드 금액을 설정해주세요.',components:rows([btn(`smallinput:${id}:${nonce}`,'금액 입력',ButtonStyle.Primary)])});}
  if(a==='small'){
   service.owner(t,i.user.id);const d=drafts.get(`${id}:${i.user.id}`);if(!d||d.nonce!==v)throw Error('설정을 다시 시작해주세요.');if(n>d.big)throw Error('스몰은 빅 이하로 입력해주세요.');d.small=n;
   return i.reply({...E,content:`빅블라인드 금액 ${money(d.big)} 스몰블라인드금액 ${money(n)}이 맞나요?`,components:confirm('blind',t,`:${v}`)});
  }
  if(a==='bet'){await i.deferReply(E);service.action(t,i.user.id,'raise',n,Number(v));await i.editReply('베팅을 반영했습니다.');return postAction(t);}
 }
}

 async function runTimeouts(now=Date.now()){
  let processed=0;
  for(const t of service.tables.values()){
   if(t.status!=='playing'||t.hand.done||now-t.lastAction<=config.turnSeconds*1000)continue;
   try{
    const h=t.hand;
    service.action(t,h.turn,h.seats[h.turn].bet<h.currentBet?'fold':'check',null,h.rev,'timeout');
    processed++;await postAction(t);
   }catch(error){console.error('턴 처리:',t.id,error.message);}
  }
  return processed;
 }
 async function refreshClocks(now=Date.now()){
  for(const t of service.tables.values())if(t.status==='playing'&&!t.hand.done&&now-(clockRenders.get(t.id)||0)>=10000)await render(t);
 }
 return {handle,render,postAction,runTimeouts,refreshClocks};
}
