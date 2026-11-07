import 'dotenv/config';
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
const {handle,render,runTimeouts}=createDiscordRuntime({client,store,economy,service,config});
const prefix=createPrefixCommands({store,economy,config,botId:()=>client.user?.id});
const E={flags:MessageFlags.Ephemeral};
let chain=Promise.resolve(),busy=0,closing=false;
const serial=fn=>{busy++;const task=chain.then(fn).finally(()=>busy--);chain=task.catch(e=>console.error('작업 처리 실패:',e.message));return task;};
client.on(Events.MessageCreate,m=>{
 if(closing||!parsePrefix(m.content,client.user?.id)||m.author?.bot||m.webhookId||m.guildId!==config.guildId)return;
 if(busy)return m.reply({content:'처리 중입니다. 잠시 후 다시 입력해주세요.',allowedMentions:{parse:[],repliedUser:false}}).catch(()=>{});
 serial(()=>prefix.handle(m)).catch(e=>console.error('메시지 명령어 처리:',e.message));
});
client.on(Events.InteractionCreate,i=>{
 if(closing||busy)return i.reply({...E,content:'다른 동작을 처리 중입니다. 잠시 후 다시 눌러주세요.'}).catch(()=>{});
 return serial(async()=>{
 try{await handle(i);}catch(e){console.error(e.message);const msg=e.message?.slice(0,1500)||'처리 중 오류가 발생했습니다.';
  if(i.deferred)await i.editReply({content:msg,components:[]}).catch(()=>{});
  else if(i.replied)await i.followUp({...E,content:msg}).catch(()=>{});
  else await i.reply({...E,content:msg}).catch(()=>{});
 }
});});
client.once(Events.ClientReady,async()=>{
 console.log(`Ready: ${client.user.tag} · RSF Poker ${version} (${mode})`);
 const schema='prefix-economy-v1';
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
 if(closing||!client.isReady())return;
 serial(()=>runTimeouts()).catch(e=>console.error('턴 처리:',e.message));
},5000);timer.unref();
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
enablePrefixIntents(client).then(()=>client.login(config.token)).catch(()=>{
 console.error('Discord 로그인 실패. 로컬 .env 토큰과 네트워크를 확인해주세요.');
 shutdown(1);
});
