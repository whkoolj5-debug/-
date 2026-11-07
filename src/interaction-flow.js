import {MessageFlags} from 'discord.js';
const ephemeral=payload=>Boolean(Number(payload?.flags?.bitfield??payload?.flags??0)&MessageFlags.Ephemeral);
export function withTransientReplies(interaction,{schedule=(fn,ms)=>{const t=setTimeout(fn,ms);t.unref?.();}}={}){
 let revision=0;
 const methods=new Set(['reply','editReply','followUp','update']);
 return new Proxy(interaction,{get(target,key){
  const value=Reflect.get(target,key,target);
  if(methods.has(key))return async payload=>{
   const rev=++revision,result=await value.call(target,payload);
   const p=typeof payload==='string'?{content:payload}:payload;
   const privateMessage=ephemeral(p)||(key!=='followUp'&&(target.ephemeral===true||target.message?.flags?.has?.(MessageFlags.Ephemeral)));
   if(privateMessage&&p?.content&&!p.files?.length&&!p.components?.length&&!p.embeds?.length&&!p.content.includes('내 카드표')){
    schedule(()=>{
     if(key==='followUp'){if(result?.id)target.webhook?.deleteMessage(result.id).catch(()=>{});}
     else if(revision===rev)target.deleteReply().catch(()=>{});
    },3000);
   }
   return result;
  };
  return typeof value==='function'?value.bind(target):value;
 }});
}
export function opensModal(i){return i.isButton()&&['createinput','biginput','smallinput','blindno','raise'].includes(i.customId.split(':')[0]);}
export async function acknowledgeQueuedInteraction(i){
 const [action,,value]=(i.customId||'').split(':');
 const update=i.isButton()&&(['seat','endcount','endtableyes','endtableno','blindyes','cancelno','quitno','cancelyes','quityes','retry','replay','theme','refresh'].includes(action)||(action==='history'&&value!==undefined));
 if(update)await i.deferUpdate();else await i.deferReply(i.commandName==='족보'?{}:{flags:MessageFlags.Ephemeral});
 return new Proxy(i,{get(target,key){
  if(key==='deferReply'||key==='deferUpdate')return async()=>{};
  if(key==='reply'||key==='update')return payload=>{const p=typeof payload==='string'?{content:payload}:{...payload};delete p.flags;return target.editReply(p);};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}
