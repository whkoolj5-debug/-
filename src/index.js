import 'dotenv/config';
import {Client,GatewayIntentBits,Events,MessageFlags,ModalBuilder,TextInputBuilder,TextInputStyle,ActionRowBuilder,AttachmentBuilder,ButtonStyle,PermissionFlagsBits} from 'discord.js';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {Store} from './store.js';import {Economy} from './economy.js';import {Service} from './service.js';
import {renderTable,handImage} from './art.js';import {money,btn,rows,confirm,publicRows,hostRows,embed} from './ui.js';
const mode=process.env.ECONOMY_MODE||'test';
const store=new Store(process.env.DATABASE_PATH||'data/poker.sqlite');
const economy=new Economy(store,{mode,token:process.env.UNBELIEVABOAT_API_KEY});
const service=new Service(store,economy);service.recover();
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const E={flags:MessageFlags.Ephemeral};const panels=new Map(),drafts=new Map();
let chain=Promise.resolve(),busy=0;
const serial=fn=>{busy++;const task=chain.then(fn).finally(()=>busy--);chain=task.catch(console.error);return task;};
export function amount(s){if(!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(s.trim()))throw Error('정확한 정수를 입력해주세요. 예: 500,000');const n=Number(s.replaceAll(',',''));if(!Number.isSafeInteger(n)||n<1||n>100000000)throw Error('금액은 1~100,000,000 범위입니다.');return n;}
function modal(i,id,title,label){return i.showModal(new ModalBuilder().setCustomId(id).setTitle(title).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(15))));}
const find=i=>service.forUser(i.guildId,i.user.id);
function table(id,i){const t=service.tables.get(id);if(t?.guildId!==i.guildId)throw Error('이 서버의 테이블이 아닙니다.');return t;}
async function render(t){
 const channel=await client.channels.fetch(t.channelId);if(!channel?.isTextBased())throw Error('테이블 채널을 찾을 수 없습니다.');
 const payload={content:`<@${t.ownerId}>님의 테이블 · 스타트머니 ${money(t.startingMoney)}`,embeds:[embed(t,mode)],files:[new AttachmentBuilder(await renderTable(t),{name:'table.png'})],components:publicRows(t),allowedMentions:{parse:[]}};
 if(t.messageId){try{const m=await channel.messages.fetch(t.messageId);await m.edit({...payload,attachments:[]});}catch(e){if(e.code!==10008)throw e;t.messageId=null;}}
 if(!t.messageId){const m=await channel.send({...payload,allowedMentions:{users:[t.ownerId]}});t.messageId=m.id;service.save(t);}
 const p=panels.get(t.id);if(p)await p.editReply({content:`방장 전용 · 참가 ${t.seats.filter(Boolean).length}/7 · ${t.status}`,components:hostRows(t)}).catch(()=>panels.delete(t.id));
}
async function panel(i,t){service.owner(t,i.user.id);await i.reply({...E,content:`방장 전용 · 참가 ${t.seats.filter(Boolean).length}/7 · ${t.status}`,components:hostRows(t)});panels.set(t.id,i);}
async function cards(i,t){service.require(t);const c=t.hand?.holeCards[i.user.id];if(!c||t.players[i.user.id]?.quit)throw Error('이번 판에 받은 카드가 없습니다.');await i.deferReply(E);await i.editReply({content:'내 카드 · 나에게만 표시됩니다.',files:[new AttachmentBuilder(await handImage(c),{name:'my-cards.png'})]});}
async function surrender(i,t){service.require(t);if(t.status!=='playing'||t.hand.done||!t.hand.seats[i.user.id]||t.players[i.user.id]?.quit)throw Error('진행 중인 참가자만 포기할 수 있습니다.');await i.reply({...E,content:'정말 포기하겠습니까?\n남은 칩 전부를 판에 넣고 폴드하며, 승리해도 팟을 받을 수 없습니다.',components:confirm('quit',t,`:${t.handNo}`)});}
async function postAction(t){await service.finish(t);await render(t);}
async function handle(i){
 if(!i.inGuild())throw Error('서버 채널에서 사용해주세요.');
 if(process.env.GUILD_ID&&i.guildId!==process.env.GUILD_ID)throw Error('설정된 서버에서만 사용할 수 있습니다.');
 if(i.isChatInputCommand()){
  const sub=i.options.getSubcommand(false);
  if(i.commandName==='포커'){
   if(sub==='만들기')return i.reply({...E,content:'게임 스타팅머니를 정해주세요.',components:rows([btn('createinput','시작머니 입력',ButtonStyle.Primary)])});
   if(sub==='관리')return panel(i,find(i));
   if(sub==='카드')return cards(i,find(i));
   if(sub==='카드목록')return i.reply({...E,files:[new AttachmentBuilder('assets/deck-preview.png',{name:'52-cards.png'})]});
   if(sub==='잔액'){await i.deferReply(E);const b=await economy.balance(i.guildId,i.user.id);return i.editReply(`balance ${money(b.balance)}${mode==='test'?' (테스트 잔액)':''}`);}
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
  const [a,id,v]=i.customId.split(':');
  if(a==='createinput')return modal(i,'create','게임 스타팅머니','게임 스타팅머니를 정해주세요.');
  const t=table(id,i);
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
  if(['check','call','raise','allin','fold'].includes(a)){
   service.require(t);if(t.hand?.turn!==i.user.id)throw Error('본인 차례가 아닙니다.');
   if(Number(v)!==t.hand.rev)throw Error('최신 버튼을 이용해주세요.');
   if(a==='raise')return modal(i,`bet:${id}:${v}`,'베팅 / 레이즈','이번 라운드의 내 총 베팅액');
   await i.deferReply(E);service.action(t,i.user.id,a,null,Number(v));await i.editReply('행동을 반영했습니다.');return postAction(t);
  }
 }
 if(i.isModalSubmit()){
  const [a,id,v]=i.customId.split(':'),n=amount(i.fields.getTextInputValue('amount'));
  if(a==='create'){
   await i.deferReply(E);const t=await service.create(randomUUID().slice(0,12),i.guildId,i.channelId,i.user.id,i.member.displayName,n);
   await i.editReply({content:`테이블이 만들어졌습니다. 시작머니 ${money(n)}${mode==='test'?' (테스트)':''}`,components:hostRows(t)});panels.set(t.id,i);return render(t);
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
client.on(Events.InteractionCreate,i=>{
 if(busy)return i.reply({...E,content:'다른 동작을 처리 중입니다. 잠시 후 다시 눌러주세요.'}).catch(()=>{});
 return serial(async()=>{
 try{await handle(i);}catch(e){console.error(e.message);const msg=e.message?.slice(0,1500)||'처리 중 오류가 발생했습니다.';
  if(i.deferred)await i.editReply({content:msg,components:[]}).catch(()=>{});
  else if(i.replied)await i.followUp({...E,content:msg}).catch(()=>{});
  else await i.reply({...E,content:msg}).catch(()=>{});
 }
});});
client.once(Events.ClientReady,async()=>{
 console.log(`Ready: ${client.user.tag} (${mode})`);
 for(const t of service.tables.values())if(t.status!=='closed')await serial(async()=>{try{if(t.status==='settling')await service.finish(t);if(t.status==='refunding')await service.cancel(t,t.ownerId);await render(t);}catch(e){console.error('복구:',t.id,e.message);}});
});
// Timeout defaults to check when possible, otherwise folds. It never surrenders funds.
setInterval(()=>serial(async()=>{
 for(const t of service.tables.values())if(t.status==='playing'&&!t.hand.done&&Date.now()-t.lastAction>Number(process.env.TURN_SECONDS||90)*1000){
  try{const h=t.hand;service.action(t,h.turn,h.seats[h.turn].bet<h.currentBet?'fold':'check',null,h.rev);await postAction(t);}catch(e){console.error('턴 처리:',e.message);}
 }
}),5000).unref();
createServer((_req,res)=>{res.writeHead(client.isReady()?200:503);res.end(client.isReady()?'Poker bot ready':'Connecting');}).listen(Number(process.env.PORT||3000),'0.0.0.0');
if(!process.env.DISCORD_TOKEN)throw Error('.env에 DISCORD_TOKEN을 설정해주세요.');
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{client.destroy();store.close();process.exit(0);});
client.login(process.env.DISCORD_TOKEN);
