import {ApplicationFlagsBitField,GatewayIntentBits,Routes} from 'discord.js';
export async function enablePrefixIntents(client,log=console.log){
 // Only request the privileged intent if the application has enabled it; otherwise keep the poker bot online.
 client.options.intents.add(GatewayIntentBits.GuildMessages);
 try{
  const app=await client.rest.get(Routes.oauth2CurrentApplication());
  const flags=new ApplicationFlagsBitField(app.flags||0);
  const allowed=flags.has(ApplicationFlagsBitField.Flags.GatewayMessageContent)||flags.has(ApplicationFlagsBitField.Flags.GatewayMessageContentLimited);
  if(allowed)client.options.intents.add(GatewayIntentBits.MessageContent);
  log(allowed?'!bal 등 일반 메시지 명령어 사용 가능':'!bal 사용 준비: Developer Portal → Bot → Message Content Intent를 켜고 봇을 재시작하세요. 켜기 전에는 봇을 @멘션한 뒤 !bal을 입력할 수 있습니다.');
  return allowed;
 }catch{
  log('메시지 권한 확인 실패. 포커는 계속 실행합니다. !bal이 반응하지 않으면 Message Content Intent를 확인하세요.');return false;
 }
}
