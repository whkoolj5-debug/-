import {withTransientReplies,opensModal,acknowledgeQueuedInteraction} from './interaction-flow.js';
import {replyInteractionError} from './interaction-errors.js';
import './load-env.js';
import {Client,GatewayIntentBits,Events,MessageFlags,Routes} from 'discord.js';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
import {commands} from './commands.js';
import {Store} from './store.js';
import {Economy} from './economy.js';
import {Service} from './service.js';
import {readConfig} from './config.js';
import {createPrefixCommands,parsePrefix} from './prefix-commands.js';
import {enablePrefixIntents} from './prefix-intents.js';
import {createDiscordRuntime} from './discord-runtime.js';
export {amount} from './discord-runtime.js';
const config=readConfig();
const {mode}=config;
const store=new Store(config.databasePath);
const economy=new Economy(store,{mode,token:config.economyToken});
const service=new Service(store,economy);service.recover();
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages]});
const {handle,render,runTimeouts,refreshClocks}=createDiscordRuntime({client,store,economy,service,config});
const prefix=createPrefixCommands({store,economy,config,botId:()=>client.user?.id});
const E={flags:MessageFlags.Ephemeral};
let chain=Promise.resolve(),busy=0,closing=false;
const serial=fn=>{busy++;const task=chain.then(fn).finally(()=>busy--);chain=task.catch(e=>console.error('작업 처리 실패:',e.message));return task;};
client.on(Events.MessageCreate,m=>{
 if(closing||!parsePrefix(m.content,client.user?.id)||m.author?.bot||m.webhookId||m.guildId!==config.guildId)return;
 serial(()=>prefix.handle(m)).catch(e=>console.error('메시지 명령어 처리:',e.message));
});
client.on(Events.InteractionCreate,async raw=>{
 let i=withTransientReplies(raw);
 if(closing)return i.reply({...E,content:'봇을 종료 중입니다. 잠시 후 다시 이용해주세요.'}).catch(()=>{});
 const execute=async()=>{try{await handle(i);}catch(e){console.error(e.message);await replyInteractionError(i,e.message?.slice(0,1500)||'처리 중 오류가 발생했습니다.').catch(()=>{});}};
 // Discord modals must be the initial response; opening them does not mutate game chips.
 if(opensModal(i))return execute();
 try{i=await acknowledgeQueuedInteraction(i);}catch{return;}
 return serial(execute);
});
client.once(Events.ClientReady,async()=>{
 console.log(`Ready: ${client.user.tag} · RSF Poker ${version} (${mode})`);
 const schema='short-commands-v1';
 if(store.db.prepare("SELECT value FROM metadata WHERE key='command_schema'").get()?.value!==schema){
  await serial(async()=>{try{
   await client.rest.put(Routes.applicationGuildCommands(config.clientId,config.guildId),{body:commands});
   store.db.prepare("INSERT OR REPLACE INTO metadata VALUES('command_schema',?)").run(schema);
   console.log('명령어 갱신 완료: 잔액 확인은 !bal');
  }catch{console.error('슬래시 명령어 갱신 실패. 필요하면 npm run register를 실행하세요.');}});
 }

 for(const t of service.tables.values())if(t.status!=='closed')await serial(async()=>{try{if(t.status==='settling')await service.finish(t);if(t.status==='refunding')await service.cancel(t,t.ownerId);await render(t);}catch(e){console.error('복구:',t.id,e.message);}});
});
// Offline recovery is rendered on ready; do not advance restored hands while disconnected.
const timer=setInterval(()=>{
 if(closing||!client.isReady()||busy)return;
 serial(async()=>{await runTimeouts();await refreshClocks();}).catch(e=>console.error('턴 처리:',e.message));
},1000);timer.unref();
const server=createServer((_req,res)=>{
 const ready=!closing&&client.isReady();
 res.writeHead(ready?200:503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
 res.end(`RSF Poker ${version} ${ready?'ready':'connecting'}`);
}).listen(config.port,'0.0.0.0');
client.on(Events.Error,()=>console.error('Discord 연결 오류. 네트워크와 봇 상태를 확인해주세요.'));
async function shutdown(code=0){
 if(closing)return;
 closing=true;clearInterval(timer);server.close();
 const deadline=setTimeout(()=>process.exit(1),20000);deadline.unref();
 try{await chain;client.destroy();store.close();clearTimeout(deadline);process.exit(code);}
 catch{process.exit(1);}
}
server.on('error',error=>{
 console.error(error.code==='EADDRINUSE'?'PORT가 이미 사용 중입니다. 다른 봇 창을 닫거나 로컬 .env의 PORT를 변경하세요.':'상태 확인 서버를 시작하지 못했습니다. PORT 설정을 확인하세요.');
 shutdown(1);
});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>shutdown());
client.rest.setToken(config.token);
enablePrefixIntents(client,console.log,{autoEnable:config.autoEnableMessageContent}).then(()=>client.login(config.token)).catch(()=>{
 console.error('Discord 로그인 실패. 로컬 .env 토큰과 네트워크를 확인해주세요.');
 shutdown(1);
});
