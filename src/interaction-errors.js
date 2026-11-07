import {MessageFlags} from 'discord.js';
export async function replyInteractionError(i,content){
 const payload={content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}};
 if(i.deferred){
  // A public deferUpdate acknowledges the table itself. Never replace that table with an error.
  if(i.isButton?.()&&!i.message?.flags?.has(MessageFlags.Ephemeral))return i.followUp(payload);
  return i.editReply({content,components:[],allowedMentions:{parse:[]}});
 }
 if(i.replied)return i.followUp(payload);
 return i.reply(payload);
}
