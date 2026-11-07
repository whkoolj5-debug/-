import {PermissionFlagsBits} from 'discord.js';
const labels={ViewChannel:'채널 보기',SendMessages:'메시지 보내기',SendMessagesInThreads:'스레드에서 메시지 보내기',ReadMessageHistory:'메시지 기록 보기',AttachFiles:'파일 첨부',EmbedLinks:'링크 임베드'};
export function accessError(error){
 if(![50001,50013,10003].includes(Number(error?.code)))return error;
 const e=Error('봇이 테이블 채널에 접근하거나 메시지를 보낼 권한이 없습니다. 이 채널의 권한에서 RSF POKER BOT의 채널 보기·메시지 보내기·메시지 기록 보기·파일 첨부·링크 임베드를 허용해주세요. 권한 수정 후 /포커 관리 → 테이블 다시 표시를 누르세요.');
 e.code=error.code;return e;
}
export async function tableChannel(client,channelId,guildId){
 try{
  const channel=await client.channels.fetch(channelId);
  if(!channel?.isTextBased()||typeof channel.send!=='function'||channel.guildId!==guildId)throw Error('이 서버의 메시지를 보낼 수 있는 채널에서 테이블을 만들어주세요.');
  if(channel.isThread?.()&&(channel.archived||channel.locked))throw Error('보관되거나 잠긴 스레드에는 테이블을 만들 수 없습니다. 일반 채팅 채널을 사용해주세요.');
  const me=channel.guild.members.me||await channel.guild.members.fetchMe();
  const permissions=channel.permissionsFor(me);
  const keys=['ViewChannel',channel.isThread?.()?'SendMessagesInThreads':'SendMessages','ReadMessageHistory','AttachFiles','EmbedLinks'];
  const missing=keys.filter(key=>!permissions?.has(PermissionFlagsBits[key]));
  if(missing.length)throw Error(`봇의 채널 권한이 부족합니다: ${missing.map(key=>labels[key]).join(', ')}. 이 채널의 권한 설정에서 RSF POKER BOT에 허용해주세요. 권한 수정 후 방장이 /포커 관리 → 테이블 다시 표시를 눌러주세요.`);
  return channel;
 }catch(error){throw accessError(error);}
}
