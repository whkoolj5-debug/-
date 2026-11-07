import './load-env.js';
import {Client,Events,GatewayIntentBits,REST,Routes,PermissionFlagsBits} from 'discord.js';
import {readConfig} from './config.js';
let client;
try{
 const config=readConfig();
 console.log(`로컬 설정 검사 통과 · ${config.mode} 모드 (토큰 값은 표시하지 않습니다.)`);
 if(process.argv.includes('--discord')){
  const rest=new REST({version:'10',timeout:15000,retries:0}).setToken(config.token);
  const app=await rest.get(Routes.oauth2CurrentApplication());
  if(app.id!==config.clientId)throw Error('CLIENT_ID와 봇 토큰의 애플리케이션이 다릅니다.');
  await rest.get(Routes.guild(config.guildId));
  const registered=await rest.get(Routes.applicationGuildCommands(config.clientId,config.guildId));
  console.log(`Discord REST 인증 및 서버 접근 성공 · 등록 명령어 ${registered.length}개`);
  client=new Client({intents:[GatewayIntentBits.Guilds]});
  let timer;
  try{
   await Promise.race([
    new Promise((resolve,reject)=>{client.once(Events.ClientReady,resolve);client.once(Events.Error,reject);client.login(config.token).catch(reject);}),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Gateway 연결 시간 초과 (30초)')),30000);})
   ]);
  }finally{clearTimeout(timer);}
  const guild=await client.guilds.fetch(config.guildId);
  const me=await guild.members.fetchMe();
  const permissions=PermissionFlagsBits;
  const needed=['ViewChannel','SendMessages','ReadMessageHistory','AttachFiles','EmbedLinks'];
  const channels=await guild.channels.fetch();
  const usable=[...channels.values()].filter(c=>c?.isTextBased()&&!c.isThread()&&c.permissionsFor(me)?.has(needed.map(k=>permissions[k])));
  console.log(`Discord Gateway 연결 성공 · 기본 권한을 갖춘 텍스트 채널 ${usable.length}개`);
  if(!usable.length)throw Error('사용할 채널에서 봇의 보기/보내기/기록 보기/파일 첨부/링크 임베드 권한을 허용해주세요.');
  console.log('연결 검사 완료. 메시지 전송, 명령어 등록, 잔액 변경은 하지 않았습니다.');
 }
}catch(error){
 // Do not echo request details, which may contain credentials.
 const status=error.status?` (HTTP ${error.status})`:'';
 const safe=/^(DISCORD_TOKEN|CLIENT_ID|GUILD_ID|ECONOMY_MODE|UNBELIEVABOAT_API_KEY|TURN_SECONDS|PORT|Gateway|사용할 채널)/.test(error.message);
 console.error(safe?error.message:`Discord 연결 검사 실패${status}. 토큰/초대/서버 ID와 네트워크 설정을 확인해주세요.`);
 process.exitCode=1;
}finally{client?.destroy();}
