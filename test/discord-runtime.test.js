import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags,PermissionsBitField,PermissionFlagsBits} from 'discord.js';
import {Store} from '../src/store.js';
import {Economy} from '../src/economy.js';
import {Service} from '../src/service.js';
import {createDiscordRuntime,amount} from '../src/discord-runtime.js';
import {bettingInfo,cardText} from '../src/table-view.js';
function validateComponents(payload){
 const ids=(payload?.components||[]).flatMap(row=>(row.toJSON?row.toJSON():row).components).map(c=>c.custom_id).filter(Boolean);
 assert.equal(new Set(ids).size,ids.length,'Discord requires unique custom_id values, including disabled buttons');
}
async function setup(){
 const store=new Store(':memory:'),economy=new Economy(store),service=new Service(store,economy),messages=[];
 const messageMap=new Map(),deleted=[];
 const channel={guildId:'g',guild:{members:{me:{id:'bot'}}},permissionsFor:()=>new PermissionsBitField(Object.values(PermissionFlagsBits)),isTextBased:()=>true,messages:{fetch:async id=>{if(!messageMap.has(id))throw Object.assign(Error('Unknown Message'),{code:10008});return messageMap.get(id);}},send:async payload=>{validateComponents(payload);messages.push(payload);const id=`m${messageMap.size+deleted.length}`;const message={id,edit:async p=>{validateComponents(p);messages.push(p);},delete:async()=>{deleted.push(id);messageMap.delete(id);}};messageMap.set(id,message);return message;}};
 const client={channels:{fetch:async()=>channel}};
 const config={mode:'test',guildId:'g',turnSeconds:90};
 const runtime=createDiscordRuntime({client,store,economy,service,config,renderTableImage:async()=>Buffer.from('image-fixture'),renderHandImage:async()=>Buffer.from('private-fixture'),renderBoardImage:async()=>Buffer.from('board-fixture')});
 const t=await service.create('t','g','c','a','A',1000);
 for(const [n,id] of ['b','c','d','e'].entries())await service.join(t,id,id,n+1);
 service.blinds(t,'a',20,10);service.start(t,'a');
 return {store,economy,service,t,messages,runtime,channel,client,deleted};
}
function interaction({user='a',button,command,sub,modal,value,guild='g',number}={}){
 const calls=[];
 return {calls,guildId:guild,channelId:'c',user:{id:user},member:{displayName:user},inGuild:()=>true,
  customId:button||modal,isButton:()=>Boolean(button),isChatInputCommand:()=>Boolean(command),isModalSubmit:()=>Boolean(modal),commandName:command,
  options:{getSubcommand:()=>sub,getInteger:()=>number??null},fields:{getTextInputValue:()=>value},
  reply:async payload=>(validateComponents(payload),calls.push(['reply',payload])),deferReply:async payload=>calls.push(['deferReply',payload]),editReply:async payload=>(validateComponents(payload),calls.push(['editReply',payload])),
  deferUpdate:async()=>calls.push(['deferUpdate']),update:async payload=>(validateComponents(payload),calls.push(['update',payload])),showModal:async payload=>calls.push(['modal',payload.toJSON()])};
}
test('actual Discord handler shows only private cards with no action buttons',async()=>{
 const {store,runtime,t}=await setup();const user=t.hand.turn;
 for(const id of [user,'a']){
  const i=interaction({user:id,button:'cards:t'});await runtime.handle(i);
  assert.equal(i.calls[0][0],'deferReply');assert.equal(i.calls[0][1].flags,MessageFlags.Ephemeral);
  const payload=i.calls.at(-1)[1];assert.equal(payload.files[0].name,'my-cards.png');
  assert.equal(payload.components.length,0);assert.match(payload.content,/내 카드표/);
 }store.close();
});
test('actual handler accepts legal quick bets, persists state, edits the table, and rejects double clicks',async()=>{
 const {store,runtime,t,messages}=await setup();const user=t.hand.turn,rev=t.hand.rev,total=bettingInfo(t.hand).presets.find(p=>p.key==='pot').total;
 const i=interaction({user,button:`quick_pot:t:${rev}`});await runtime.handle(i);
 assert.equal(i.calls[0][1].flags,MessageFlags.Ephemeral);assert.equal(t.hand.seats[user].bet,total);assert.equal(messages.length,1);
 assert.deepEqual(messages[0].allowedMentions,{users:['a']});
 await assert.rejects(()=>runtime.handle(interaction({user,button:`quick_pot:t:${rev}`})));
 assert.equal(store.load()[0].hand.seats[user].bet,total);store.close();
});
test('actual handler rejects cross-server and non-owner theme edits without changing the table',async()=>{
 const {store,runtime,t}=await setup();
 await assert.rejects(()=>runtime.handle(interaction({guild:'elsewhere',button:'theme:t'})),/설정된 서버/);
 await assert.rejects(()=>runtime.handle(interaction({user:'b',button:'theme:t'})),/방장만/);assert.equal(t.theme,undefined);
 await runtime.handle(interaction({user:'a',button:'theme:t'}));assert.equal(t.theme,'midnight');assert.equal(store.load()[0].theme,'midnight');store.close();
});
test('history slash command, pagination and download are ephemeral and omit folded cards/deck',async()=>{
 const {store,service,runtime,t}=await setup();const folded=t.hand.turn;
 service.action(t,folded,'fold',null,t.hand.rev);
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 const i=interaction({user:'a',command:'포커',sub:'기록'});await runtime.handle(i);
 assert.equal(i.calls[0][1].flags,MessageFlags.Ephemeral);assert.equal(i.calls[0][1].allowedMentions.parse.length,0);
 assert(!i.calls[0][1].content.includes(cardText(t.hand.holeCards[folded])));
 const download=interaction({user:'a',button:'export:t'});await runtime.handle(download);
 const payload=download.calls[0][1];assert.equal(payload.flags,MessageFlags.Ephemeral);
 const records=JSON.parse(payload.files[0].attachment.toString());assert.equal(records.length,1);assert(!records[0].showdown.some(p=>p.id===folded));
 assert(!Object.hasOwn(records[0],'deck'));assert(!Object.hasOwn(records[0],'holeCards'));store.close();
});
test('modal raises use round totals and preserve ephemeral acknowledgement',async()=>{
 const {store,runtime,t}=await setup();const user=t.hand.turn;
 const i=interaction({user,modal:`bet:t:${t.hand.rev}`,value:'100'});await runtime.handle(i);
 assert.equal(t.hand.seats[user].bet,100);assert.equal(i.calls[0][1].flags,MessageFlags.Ephemeral);store.close();
});
test('amount input rejects malformed grouping and unsafe/oversized values',()=>{
 assert.equal(amount('10,000'),10000);assert.equal(amount(' 500 '),500);
 for(const value of ['10,00','0','-1','1.5','1e3','100,000,001','999999999999999999999'])assert.throws(()=>amount(value));
});

test('timeout folds only when facing a bet, otherwise checks, and records the automatic action',async()=>{
 const {store,service,runtime,t}=await setup();const before=t.hand.pot,first=t.hand.turn;
 assert.equal(await runtime.runTimeouts(t.lastAction+89999),0);
 assert.equal(await runtime.runTimeouts(t.lastAction+90001),1);
 assert(t.hand.folded.includes(first));assert.equal(t.hand.pot,before);assert.equal(t.players[first].quit,false);
 assert.equal(t.hand.log.at(-1).automatic,true);assert.equal(t.hand.log.at(-1).kind,'fold');
 while(t.hand.street==='preflop'&&!t.hand.done)service.action(t,t.hand.turn,'call',null,t.hand.rev);
 const next=t.hand.turn,pot=t.hand.pot;
 await runtime.runTimeouts(t.lastAction+90001);
 assert(!t.hand.folded.includes(next));assert.equal(t.hand.pot,pot);assert.equal(t.hand.log.at(-1).kind,'check');store.close();
});
test('history navigation updates the existing private message rather than posting another reply',async()=>{
 const {store,service,runtime,t}=await setup();
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 const i=interaction({user:'a',button:'history:t:1'});await runtime.handle(i);
 assert.equal(i.calls[0][0],'update');assert(i.calls[0][1].content.includes('#1'));store.close();
});

test('replay button edits a private history panel and never advances live game state',async()=>{
 const {store,service,runtime,t}=await setup();
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 service.next(t,'a');const before=JSON.stringify(t.hand),i=interaction({user:'a',button:'replay:t:1:0'});
 await runtime.handle(i);assert.equal(i.calls[0][0],'deferUpdate');
 const payload=i.calls[1][1];assert.equal(payload.files[0].name,'replay.png');assert(payload.content.includes('실제 게임에는 영향을 주지 않는'));
 assert.equal(payload.components[0].components.length,5);assert.equal(JSON.stringify(t.hand),before);store.close();
});

test('missing access is explained before buy-in; recovery does not charge a second buy-in',async()=>{
 const {store,economy,service,runtime,client,channel,t}=await setup();
 client.channels.fetch=async()=>{throw Object.assign(Error('Missing Access'),{code:50001});};
 const before=(await economy.balance('g','new')).balance;
 await assert.rejects(()=>runtime.handle(interaction({user:'new',modal:'create',value:'1000'})),/채널.*권한/);
 assert.equal((await economy.balance('g','new')).balance,before);assert.equal(service.forUser('g','new'),undefined);
 client.channels.fetch=async()=>channel;
 const balance=(await economy.balance('g','a')).balance;
 await runtime.handle(interaction({user:'a',button:'refresh:t'}));
 assert.equal((await economy.balance('g','a')).balance,balance);assert(t.messageId);store.close();
});
test('missing attachment permission stops creation before a transfer',async()=>{
 const {store,service,runtime,channel}=await setup();
 channel.permissionsFor=()=>new PermissionsBitField([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]);
 await assert.rejects(()=>runtime.handle(interaction({user:'new',modal:'create',value:'1000'})),/파일 첨부.*링크 임베드/);
 assert.equal(service.forUser('g','new'),undefined);assert.equal(store.transfer('t:buy:new'),undefined);store.close();
});
test('public send failure preserves a recoverable table and a repeated create never charges twice',async()=>{
 const {store,economy,service,runtime,channel}=await setup();
 const send=channel.send;channel.send=async()=>{throw Object.assign(Error('Missing Access'),{code:50001});};
 await assert.rejects(()=>runtime.handle(interaction({user:'new',modal:'create',value:'1000'})),/테이블/);
 const existing=service.forUser('g','new');assert(existing);assert.equal(existing.status,'lobby');assert.equal(existing.messageId,null);
 const balance=(await economy.balance('g','new')).balance;assert.equal(balance,4999000);
 channel.send=send;
 await runtime.handle(interaction({user:'new',modal:'create',value:'2000'}));
 assert.equal(service.forUser('g','new').id,existing.id);assert.equal((await economy.balance('g','new')).balance,balance);assert.equal(existing.startingMoney,1000);assert(existing.messageId);store.close();
});

test('flop/turn/river edits attach public-card images and use new filenames to avoid stale previews',async()=>{
 const {store,service,runtime,t,messages}=await setup();
 await runtime.render(t);assert.equal(messages.at(-1).files.length,1);
 for(const [street,count] of [['flop',3],['turn',4],['river',5]]){
  while(!t.hand.done&&t.hand.street!==street)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
  assert.equal(t.hand.board.length,count);await runtime.render(t);
  const payload=messages.at(-1);assert.equal(payload.files.length,1);assert(payload.content.startsWith('# Community Cards'));
  const board=payload.files.find(f=>f.name.startsWith('board-'));assert(board);
  assert.equal(payload.embeds,undefined);
  const oldName=board.name;await runtime.render(t);assert.notEqual(messages.at(-1).files[0].name,oldName);assert.equal(messages.at(-1).embeds[0].toJSON().image,undefined);
  assert.deepEqual(messages.at(-1).attachments,[]);
 }
 store.close();
});

test('tagged previous/next replay and history IDs route correctly at navigation boundaries',async()=>{
 const {store,service,runtime,t}=await setup();
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 for(const customId of ['history:t:1:prev','history:t:1:next','replay:t:1:0:first','replay:t:1:0:prev']){
  const i=interaction({user:'a',button:customId});await runtime.handle(i);assert(i.calls.length);validateComponents(i.calls.at(-1)[1]);
 }
 store.close();
});

test('guild /족보 posts the branded image',async()=>{
 const {runtime,store}=await setup(),i=interaction({command:'족보'});await runtime.handle(i);assert.equal(i.calls[0][0],'reply');assert.equal(i.calls[0][1].files[0].attachment,'assets/rsf-hand-rankings.webp');store.close();
});
test('finished-hand board is deleted and next hand starts after five seconds, updating private cards without buttons',async()=>{
 const {runtime,service,t,store,deleted}=await setup();
 const i=interaction({user:'a',command:'포커',sub:'카드'});await runtime.handle(i);
 while(t.hand.street!=='flop')service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 await runtime.render(t);const boardId=t.boardMessageId;assert(boardId);assert.notEqual(boardId,t.messageId);
 while(!t.hand.done)service.action(t,t.hand.turn,t.hand.seats[t.hand.turn].bet<t.hand.currentBet?'call':'check',null,t.hand.rev);
 await runtime.postAction(t);assert(deleted.includes(boardId));assert.equal(t.boardMessageId,null);const deadline=t.nextHandAt;
 await runtime.runTimeouts(deadline-1);assert.equal(t.handNo,1);
 await runtime.runTimeouts(deadline);assert.equal(t.handNo,2);assert.equal(t.hand.done,false);assert.equal(t.nextHandAt,undefined);
 const payload=i.calls.at(-1)[1];assert.match(payload.content,/내 카드표/);assert.equal(payload.components.length,0);assert.equal(payload.files.length,1);store.close();
});
test('joining opens a private waiting card sheet that fills at START without a card command',async()=>{
 const {runtime,service,store}=await setup();const t=await service.create('new','g','c','owner','O',1000);service.blinds(t,'owner',20,10);
 const i=interaction({user:'new-user',button:'seat:new:1'});await runtime.handle(i);assert.match(i.calls.at(-1)[1].content,/게임이 시작되면/);
 await runtime.handle(interaction({user:'owner',button:'start:new'}));const payload=i.calls.at(-1)[1];assert.match(payload.content,/내 카드표/);assert.equal(payload.files[0].name,'my-cards.png');assert.deepEqual(payload.components,[]);store.close();
});

test('short /카드 and /테이블 만들기 routes work without the old poker prefix',async()=>{
 const {runtime,store}=await setup();const hand=interaction({user:'a',command:'카드'});await runtime.handle(hand);assert.equal(hand.calls.at(-1)[1].files[0].name,'my-cards.png');
 const create=interaction({user:'new',command:'테이블',sub:'만들기'});await runtime.handle(create);assert.match(create.calls[0][1].content,/스타팅머니/);store.close();
});

test('/help opens help and registered commands do not require a poker prefix',async()=>{
 const {runtime,store}=await setup(),i=interaction({command:'help'});await runtime.handle(i);assert.match(i.calls[0][1].content,/테이블 만들기/);
 const {commands}=await import('../src/commands.js');assert(commands.some(c=>c.name==='help'));assert(!commands.some(c=>c.name.startsWith('포커')||c.name==='도움말'));store.close();
});
test('heads-up small blind cannot check a live big blind, while big blind can check after a call',async()=>{
 const {runtime,service,store}=await setup(),t=await service.create('heads','g','c','small','S',500000);await service.join(t,'big','B',1);service.blinds(t,'small',20000,10000);service.start(t,'small');
 const {publicRows}=await import('../src/ui.js');const buttons=()=>publicRows(t).flatMap(r=>r.components);assert.equal(t.hand.turn,'small');const check=buttons().find(b=>b.data.custom_id.startsWith('check:'));assert(check.data.disabled);assert.match(check.data.label,/10,000/);
 const call=interaction({user:'small',button:`call:heads:${t.hand.rev}`});await runtime.handle(call);assert.equal(t.hand.turn,'big');assert.equal(buttons().find(b=>b.data.custom_id.startsWith('check:')).data.disabled,false);store.close();
});
