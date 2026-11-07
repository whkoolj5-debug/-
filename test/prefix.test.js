import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,ApplicationFlagsBitField,GatewayIntentBits,IntentsBitField,PermissionFlagsBits,PermissionsBitField} from 'discord.js';
import {Store} from '../src/store.js';
import {Economy} from '../src/economy.js';
import {createPrefixCommands,parsePrefix,moneyHelp} from '../src/prefix-commands.js';
import {enablePrefixIntents} from '../src/prefix-intents.js';
const actor='111111111111111111',target='222222222222222222',bot='333333333333333333';
function setup(admin=true){
 const store=new Store(':memory:'),economy=new Economy(store);let time=10000,count=0;
 const members=new Map([[actor,{user:{bot:false},permissions:new PermissionsBitField(admin?[PermissionFlagsBits.Administrator]:[])}],[target,{user:{bot:false},permissions:new PermissionsBitField()}]]);
 const guild={members:{fetch:async raw=>{const id=typeof raw==='string'?raw:raw.user;if(!members.has(id))throw Error('missing');return members.get(id);}}};
 const runtime=createPrefixCommands({store,economy,config:{guildId:'g',mode:'test'},botId:bot,now:()=>time});
 function message(content,options={}){time+=2000;const replies=[];return {id:String(++count),content,guild,guildId:'g',author:{id:actor,bot:false},reply:async payload=>replies.push(payload),replies,...options};}
 return {store,economy,runtime,message,members};
}
test('balance aliases, English transfers and admin commands are parsed exactly',()=>{
 assert.equal(parsePrefix('!add-money',bot).kind,'grant');assert.equal(parsePrefix('!pay',bot).kind,'pay');assert.equal(parsePrefix('!remove-money',bot).kind,'remove');
 assert.equal(parsePrefix('!bal',bot).kind,'balance');assert.equal(parsePrefix(' !BAL ',bot).kind,'balance');
 assert.equal(parsePrefix(`<@${bot}> !bal`,bot).kind,'balance');assert.equal(parsePrefix(`<@!${bot}>!bal`,bot).kind,'balance');
 for(const value of ['hello !bal','!balanceoops','!add-money-other'])assert.equal(parsePrefix(value,bot),null);
});
test('public !bal uses the actual economy adapter, labels test funds, and suppresses pings',async()=>{
 const {store,runtime,message}=setup();const m=message('!bal');assert.equal(await runtime.handle(m),true);
 const e=m.replies[0].embeds[0].toJSON();assert(e.description.includes('5,000,000'));assert(e.footer.text.includes('TEST funds'));
 assert.deepEqual(m.replies[0].allowedMentions,{parse:[],repliedUser:false});store.close();
});
test('administrator with zero wallet can issue money; ordinary users cannot issue, remove or recover funds',async()=>{
 const s=setup();await s.economy.balance('g',actor);s.store.db.prepare('UPDATE balances SET amount=0 WHERE id=?').run(`g:${actor}`);
 const m=s.message(`!add-money <@${target}> 10000`);await s.runtime.handle(m);
 assert(m.replies[0].content.includes('admin balance was not charged'));assert.equal((await s.economy.balance('g',actor)).balance,0);assert.equal((await s.economy.balance('g',target)).balance,5010000);
 // Permissions are fetched for every mutation, not trusted from a role name or old message cache.
 s.members.get(actor).permissions=new PermissionsBitField();
 for(const command of [`!add-money <@${target}> 20000`,`!remove-money <@${target}> 10000`,`!reset-money <@${target}>`,'!money-retry 1']){
  const x=s.message(command);await s.runtime.handle(x);assert(x.replies[0].content.includes('Administrator'));
 }
 assert.equal((await s.economy.balance('g',target)).balance,5010000);s.store.close();
});
test('normal transfer, leaderboard and full admin removal match the documented tutorial',async()=>{
 const {store,economy,runtime,message}=setup();
 const pay=message(`!pay <@${target}> 1000`);await runtime.handle(pay);assert(pay.replies[0].content.includes('Payment complete'));
 assert.equal((await economy.balance('g',actor)).balance,4999000);assert.equal((await economy.balance('g',target)).balance,5001000);
 const lb=message('!lb');await runtime.handle(lb);assert(lb.replies[0].embeds[0].toJSON().description.startsWith(`1. <@${target}>`));
 const clear=message(`!reset-money <@${target}>`);await runtime.handle(clear);assert.equal((await economy.balance('g',target)).balance,0);
 assert.equal(await runtime.handle(message('!bal',{guildId:'other'})),false);assert.equal(await runtime.handle(message('!bal',{author:{id:actor,bot:true}})),false);
 assert.equal(await runtime.handle(message('!bal',{webhookId:'webhook'})),false);store.close();
});
test('money commands reject role mentions, absent members, bots, negative amounts and zero-fund payments',async()=>{
 const {store,economy,runtime,message,members}=setup();
 for(const command of [`!pay <@&${target}> 10`,`!pay <@999999999999999999> 10`,`!pay <@${target}> -10`]){
  const m=message(command);await runtime.handle(m);assert(!m.replies[0].content.includes('complete'));
 }
 members.get(target).user.bot=true;const bot=message(`!add-money <@${target}> 1000`);await runtime.handle(bot);assert(bot.replies[0].content.includes('cannot target bots'));
 members.get(target).user.bot=false;await economy.balance('g',actor);store.db.prepare('UPDATE balances SET amount=0 WHERE id=?').run(`g:${actor}`);
 const empty=message(`!pay <@${target}> 1000`);await runtime.handle(empty);assert(empty.replies[0].content.includes('Insufficient'));store.close();
});
test('!help provides working examples and makes admin zero-balance issuance explicit',async()=>{
 const {store,runtime,message}=setup();const m=message('!help');await runtime.handle(m);
 assert(moneyHelp.includes('!add-money @member 10000'));assert(moneyHelp.includes('can be 0'));assert(m.replies[0].embeds.every(e=>e.toJSON().description.length<4096));store.close();
});
test('privileged message intent is requested only when the app has enabled it',async()=>{
 for(const enabled of [false,true]){
  const client={options:{intents:new IntentsBitField([GatewayIntentBits.Guilds])},rest:{get:async()=>({flags:enabled?ApplicationFlagsBitField.Flags.GatewayMessageContentLimited:0})}};
  const result=await enablePrefixIntents(client,()=>{},{autoEnable:false});assert.equal(result,enabled);
  assert(client.options.intents.has(GatewayIntentBits.GuildMessages));assert.equal(client.options.intents.has(GatewayIntentBits.MessageContent),enabled);
 }
});
test('message intent discovery failure does not prevent the slash-command poker bot from starting',async()=>{
 const client={options:{intents:new IntentsBitField([GatewayIntentBits.Guilds])},rest:{get:async()=>{throw Error('API down');}}};
 assert.equal(await enablePrefixIntents(client,()=>{},{autoEnable:false}),false);assert(client.options.intents.has(GatewayIntentBits.Guilds));assert(!client.options.intents.has(GatewayIntentBits.MessageContent));
});

test('English slash labels keep the original handler names and remove the old balance subcommand',async()=>{
 const {commands}=await import('../src/commands.js');
 const poker=commands.find(c=>c.name==='포커');assert.equal(poker.name_localizations['en-US'],'poker');
 assert(!poker.options.some(o=>o.name==='잔액'));
 assert.equal(poker.options.find(o=>o.name==='카드').name_localizations['en-US'],'hand');
 assert.equal(poker.options.find(o=>o.name==='테이블').options[0].name_localizations['en-US'],'create');
});

test('real discord.js Client frozen intent fields are reassigned so message events are actually subscribed',async()=>{
 for(const enabled of [false,true]){
  const client=new Client({intents:[GatewayIntentBits.Guilds]});
  try{
   assert(Object.isFrozen(client.options.intents));assert(!client.options.intents.has(GatewayIntentBits.GuildMessages));
   client.rest.get=async()=>({flags:enabled?ApplicationFlagsBitField.Flags.GatewayMessageContentLimited:0});
   const result=await enablePrefixIntents(client,()=>{},{autoEnable:false});
   assert.equal(result,enabled);assert(client.options.intents.has(GatewayIntentBits.GuildMessages));
   assert.equal(client.options.intents.has(GatewayIntentBits.MessageContent),enabled);
   assert(Object.isFrozen(client.options.intents));
  }finally{client.destroy();}
 }
});
test('real Client still subscribes to guild messages when application permission lookup fails',async()=>{
 const client=new Client({intents:[GatewayIntentBits.Guilds]});
 try{
  client.rest.get=async()=>{throw Error('API unavailable');};
  assert.equal(await enablePrefixIntents(client,()=>{},{autoEnable:false}),false);
  assert(client.options.intents.has(GatewayIntentBits.GuildMessages));assert(!client.options.intents.has(GatewayIntentBits.MessageContent));
 }finally{client.destroy();}
});

test('message-content auto setup patches only supported limited flags and enables plain commands',async()=>{
 const client=new Client({intents:[GatewayIntentBits.Guilds]}),calls=[];
 const F=ApplicationFlagsBitField.Flags;
 try{
  client.rest.get=async route=>{calls.push({type:'get',route});return {flags:F.GatewayPresenceLimited|F.ApplicationCommandBadge,approximate_guild_count:1};};
  client.rest.patch=async(route,{body})=>{calls.push({type:'patch',route,body});return {flags:body.flags|F.ApplicationCommandBadge};};
  assert.equal(await enablePrefixIntents(client,()=>{}),true);
  assert(client.options.intents.has(GatewayIntentBits.MessageContent));
  const patch=calls.find(c=>c.type==='patch');assert.equal(patch.route,'/applications/@me');
  assert.deepEqual(patch.body,{flags:F.GatewayPresenceLimited|F.GatewayMessageContentLimited});
  assert.equal(Object.keys(patch.body).length,1);
 }finally{client.destroy();}
});
test('already-enabled applications do not receive a settings mutation',async()=>{
 const client=new Client({intents:[GatewayIntentBits.Guilds]});let patched=false;
 try{
  client.rest.get=async()=>({flags:ApplicationFlagsBitField.Flags.GatewayMessageContentLimited});client.rest.patch=async()=>{patched=true;};
  assert.equal(await enablePrefixIntents(client,()=>{}),true);assert.equal(patched,false);
 }finally{client.destroy();}
});
test('denied message-content setting changes do not request forbidden intents or stop poker',async()=>{
 const client=new Client({intents:[GatewayIntentBits.Guilds]});const logs=[];
 try{
  client.rest.get=async()=>({flags:0,approximate_guild_count:1});client.rest.patch=async()=>{throw Object.assign(Error('Forbidden'),{status:403});};
  assert.equal(await enablePrefixIntents(client,s=>logs.push(s)),false);
  assert(client.options.intents.has(GatewayIntentBits.GuildMessages));assert(!client.options.intents.has(GatewayIntentBits.MessageContent));
  assert(logs.some(s=>s.includes('403')));
 }finally{client.destroy();}
});
test('verified-scale applications are not auto-granted a limited message intent',async()=>{
 const client=new Client({intents:[GatewayIntentBits.Guilds]});let patched=false;
 try{
  client.rest.get=async()=>({flags:0,approximate_guild_count:100});client.rest.patch=async()=>{patched=true;};
  assert.equal(await enablePrefixIntents(client,()=>{}),false);assert.equal(patched,false);
 }finally{client.destroy();}
});

test('!help sends Korean and English together and stays within Discord embed text limits',async()=>{
 const {store,runtime,message}=setup();const m=message('!help');await runtime.handle(m);
 const embeds=m.replies[0].embeds.map(e=>e.toJSON());assert.equal(embeds.length,2);
 assert(embeds[0].description.includes('관리자 잔액이 0이어도'));assert(embeds[1].description.includes('Your own balance can be 0'));
 const textSize=embeds.reduce((n,e)=>n+e.title.length+e.description.length+e.footer.text.length,0);assert(textSize<=6000);
 for(const command of ['!bal','!pay','!add-money','!remove-money','!reset-money','!lb','!help'])assert(parsePrefix(command,bot));
 store.close();
});
