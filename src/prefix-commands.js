import {EmbedBuilder,PermissionFlagsBits} from 'discord.js';
import {MoneyService} from './money-service.js';
const names=new Map([
 ['bal','balance'],['balance','balance'],['money','balance'],['lb','leaderboard'],['leaderboard','leaderboard'],
 ['pay','pay'],['give-money','pay'],['add-money','grant'],['remove-money','remove'],['clear-money','clear'],['reset-money','clear'],
 ['money-pending','pending'],['money-retry','retry'],['help','help'],['tutorial','help']
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
Create: /poker table create → enter starting chips.
Blinds: /blinds setup set. With 2–7 players, the host uses /poker manage → START.
Cards: /poker hand. History and replay: /poker history.
/surrender permanently forfeits ALL remaining chips; it is different from a normal fold.

Aliases: !balance and !money = !bal; !give-money = !pay; !leaderboard = !lb; !clear-money = !reset-money.
English slash labels appear in English Discord clients; Korean clients retain Korean labels.\nResults are visible in this channel. Admin commands require Discord Administrator permission.`;
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
   if(kind==='help'){await send(m,{embeds:[new EmbedBuilder().setColor(0x2fbaa0).setTitle('RSF Command Tutorial').setDescription(moneyHelp).setFooter({text:badge})]});return true;}
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
    await send(m,(lines.join('\n')||'No interrupted money commands.').slice(0,1800)+'\nFor uncertain API writes: /poker-transactions list → check external audit records → /poker-transactions confirm → !money-retry transaction-id.');return true;
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
