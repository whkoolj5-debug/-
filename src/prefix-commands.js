import {EmbedBuilder,PermissionFlagsBits} from 'discord.js';
import {MoneyService} from './money-service.js';
const names=new Map([
 ['bal','balance'],['balance','balance'],['money','balance'],['lb','leaderboard'],['leaderboard','leaderboard'],
 ['pay','pay'],['give-money','pay'],['add-money','grant'],['remove-money','remove'],['clear-money','clear'],['reset-money','clear'],
 ['money-pending','pending'],['money-retry','retry'],['help','help'],['tutorial','help'],['도움말','help']
]);
export function parsePrefix(content,botId){
 let text=String(content||'').trim();
 if(botId){const mention=new RegExp(`^<@!?${botId}>\\s*`);text=text.replace(mention,'');}
 if(!text.startsWith('!'))return null;
 const [name,...args]=text.slice(1).split(/\s+/),kind=names.get(name.toLowerCase());
 return kind?{kind,args}:null;
}
export const moneyHelp=`**EVERYONE**
\`!bal\` — Show your cash, bank and total balance.
\`!bal @member\` — Show another member's balance.
\`!pay @member 10000\` — Send 10,000 from your own funds (cash first, then bank).
\`!pay @member all\` — Send all your available funds.
\`!lb\` — Total balance leaderboard. Example: \`!lb 2 -cash\`.
\`!help\` or \`!tutorial\` — Show this guide.

**ADMINISTRATORS ONLY**
\`!add-money @member 10000\` — Issue NEW money. Your own balance can be 0; it is never charged.
\`!remove-money @member 10000\` — Deduct 10,000 from that member.
\`!reset-money @member\` or \`!remove-money @member all\` — Clear that member's total wallet balance.
\`!money-pending\` — List interrupted transactions.
\`!money-retry transaction-id\` — Resume only after uncertain external writes have been checked.

**POKER**
Create: /table create → enter starting chips.
Blinds: /blinds setup set. With 2–7 players, the host uses the table START button.
Cards: /hand. History and replay: /history.
/surrender permanently forfeits ALL remaining chips; it is different from a normal fold.

Aliases: !balance and !money = !bal; !give-money = !pay; !leaderboard = !lb; !clear-money = !reset-money.
English slash labels appear in English Discord clients; Korean clients retain Korean labels.\nResults are visible in this channel. Admin commands require Discord Administrator permission.`;
export const moneyHelpKo=`**일반 회원 명령어**
\`!bal\` — 내 현금·은행·합계 잔액 확인
\`!bal @유저\` — 다른 회원 잔액 확인
\`!pay @유저 10000\` — 내 잔액에서 10,000 송금 (현금 우선, 부족분 은행)
\`!pay @유저 all\` — 내 사용 가능한 잔액 전부 송금
\`!lb\` — 서버 잔액 순위 · 예: \`!lb 2 -cash\`
\`!help\` / \`!tutorial\` — 한국어·영어 안내 함께 보기

**관리자 전용**
\`!add-money @유저 10000\` — 새 돈 지급. 관리자 잔액이 0이어도 가능하며 본인 돈은 차감하지 않음
\`!remove-money @유저 10000\` — 해당 회원 잔액에서 차감
\`!reset-money @유저\` / \`!remove-money @유저 all\` — 해당 회원의 지갑 잔액 전부 차감
\`!money-pending\` — 확인 대기 거래 목록
\`!money-retry 거래번호\` — 실제 외부 거래 반영 여부를 확인한 뒤 중단된 처리 이어가기

**포커 진행**
/테이블 만들기 → 시작머니 입력 → /빅 스몰 설정 → 2~7명 참가 → 방장이 테이블 아래 START
/카드: 개인 패 · /기록: 판 결과와 다시보기
/ㅈㅈ는 일반 폴드와 달리 남은 칩 전액을 기부하고 영구 포기합니다.

별칭: !balance·!money = !bal, !give-money = !pay, !leaderboard = !lb, !clear-money = !reset-money.
금액 자리는 원하는 숫자로 바꾸고 @유저는 실제 회원을 멘션하세요. 관리자 기능은 Discord Administrator 권한이 필요합니다.
조회 결과는 채널에 공개됩니다.`;
export function createPrefixCommands({store,economy,config,botId,now=Date.now}){
 const money=new MoneyService(store,economy),lastUse=new Map();
 const send=(m,payload)=>m.reply({...(typeof payload==='string'?{content:payload}:payload),allowedMentions:{parse:[],repliedUser:false}});
 const badge=config.mode==='live'?'LIVE server currency · UnbelievaBoat API':'TEST funds · separate from UnbelievaBoat live balances';
 async function admin(m){
  const actor=await m.guild.members.fetch({user:m.author.id,force:true});
  if(!actor.permissions.has(PermissionFlagsBits.Administrator))throw Error('Only members with Discord Administrator permission can use this command.');
 }
 async function member(m,raw){
  const id=/^<@!?(\d{17,20})>$/.exec(raw||'')?.[1]||(/^\d{17,20}$/.test(raw||'')?raw:null);
  if(!id)throw Error('Mention a member. Example: !pay @member 10000');
  let target;try{target=await m.guild.members.fetch({user:id,force:true});}catch{throw Error('Select a current member of this server.');}
  if(target.user.bot)throw Error('Money commands cannot target bots.');return id;
 }
 async function handle(m){
  const parsed=parsePrefix(m.content,typeof botId==='function'?botId():botId);
  if(!parsed||m.author?.bot||m.webhookId||!m.guild||m.guildId!==config.guildId)return false;
  const key=`${m.guildId}:${m.author.id}`,time=now();
  if(time-(lastUse.get(key)??-Infinity)<1500)return true;
  lastUse.set(key,time);if(lastUse.size>5000)for(const [k,v] of lastUse)if(time-v>60000)lastUse.delete(k);
  const {kind,args}=parsed;
  try{
   if(kind==='help'){await send(m,{embeds:[new EmbedBuilder().setColor(0x2fbaa0).setTitle('RSF 명령어 안내 · 한국어').setDescription(moneyHelpKo).setFooter({text:badge}),new EmbedBuilder().setColor(0xd7ad63).setTitle('RSF Command Guide · English').setDescription(moneyHelp).setFooter({text:badge})]});return true;}
   if(kind==='balance'){
    if(args.length>1)throw Error('Usage: !bal or !bal @member');
    const target=args[0]?await member(m,args[0]):m.author.id,b=await economy.balance(m.guildId,target);
    await send(m,{embeds:[new EmbedBuilder().setColor(0xd7ad63).setTitle('Balance').setDescription(`<@${target}>\nCash **${b.cash.toLocaleString('en-US')}**\nBank **${b.bank.toLocaleString('en-US')}**\nTotal **${b.balance.toLocaleString('en-US')}**${b.rank?`\nRank #${b.rank}`:''}`).setFooter({text:badge})]});return true;
   }
   if(kind==='leaderboard'){
    let page=1,sort='total';
    if(args.length>2)throw Error('Usage: !lb [page] [-cash|-bank|-total]');
    for(const arg of args){if(/^\d+$/.test(arg))page=Number(arg);else if(/^-(cash|bank|total)$/.test(arg))sort=arg.slice(1);else throw Error('Usage: !lb [page] [-cash|-bank|-total]');}
    const lb=await economy.leaderboard(m.guildId,page,sort);
    const body=lb.users.map((u,i)=>`${(page-1)*10+i+1}. <@${u.id}> · **${u[sort].toLocaleString('en-US')}**`).join('\n')||'No balances on this page.';
    await send(m,{embeds:[new EmbedBuilder().setColor(0x2fbaa0).setTitle(`Leaderboard · Page ${page} · ${sort}`).setDescription(body).setFooter({text:badge})]});return true;
   }
   if(['grant','remove','clear','pending','retry'].includes(kind))await admin(m);
   if(kind==='pending'){
    const lines=money.pending(m.guildId).map(o=>`${o.id} · ${o.kind} · <@${o.target}> · ${o.amount}`);
    await send(m,(lines.join('\n')||'No interrupted money commands.').slice(0,1800)+'\nFor uncertain API writes: /transactions list → check external audit records → /transactions confirm → !money-retry transaction-id.');return true;
   }
   if(kind==='retry'){
    if(args.length!==1)throw Error('Usage: !money-retry transaction-id');
    const id=args[0].startsWith('money:')?args[0]:`money:${args[0]}`;
    const op=await money.retry(id,m.guildId);await send(m,`Transaction ${op.id} complete · ${op.amount.toLocaleString('en-US')} · ${badge}`);return true;
   }
   if(args.length!==(kind==='clear'?1:2))throw Error(`Usage: ${kind==='grant'?'!add-money @member amount':kind==='pay'?'!pay @member amount':kind==='clear'?'!reset-money @member':'!remove-money @member amount|all'}`);
   const target=await member(m,args[0]),input=kind==='clear'?'all':args[1];
   const op=await money.execute({id:`money:${m.id}`,guild:m.guildId,actor:m.author.id,target,kind:kind==='clear'?'remove':kind,input});
   const label=op.kind==='grant'?'Admin grant':op.kind==='remove'?'Admin deduction':'Payment';
   await send(m,`${label} complete · <@${op.target}> · **${op.amount.toLocaleString('en-US')}**${op.kind==='grant'?' (your admin balance was not charged)':''}\n${badge} · Transaction ${op.id}`);
  }catch(error){await send(m,error.message?.slice(0,1800)||'Could not process the money command.');}
  return true;
 }
 return {handle,money};
}
