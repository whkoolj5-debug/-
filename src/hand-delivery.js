import {AttachmentBuilder} from 'discord.js';
import {bettingInfo,turnClock} from './table-view.js';
export function createHandDelivery({client,service,renderHandImage,turnSeconds}){
 const key=t=>`${t.handNo}:${t.hand.street}:${t.hand.turn}`;
 function content(t,id){
  const h=t.hand,clock=turnClock({...t,turnSeconds}),mine=clock&&h.turn===id;
  const header=mine?`# 🟢 YOUR TURN\n## ⏱ <t:${Math.floor(clock.deadline/1000)}:R>`:'# 🃏 YOUR PRIVATE CARDS';
  const info=mine?`Call: ${bettingInfo(h).call.toLocaleString('en-US')} · Act at the public table.`:'Wait for your turn. These cards are visible only to you.';
  return `${header}\nHand #${t.handNo} · ${info}\nhttps://discord.com/channels/${t.guildId}/${t.channelId}/${t.messageId||''}`;
 }
 async function send(t,id){
  const user=await client.users.fetch(id);
  await user.send({content:content(t,id),files:[new AttachmentBuilder(await renderHandImage(t.hand.holeCards[id]),{name:`my-cards-${t.id}-${t.handNo}.png`})],allowedMentions:{parse:[]}});
 }
 async function deal(t){
  if(!t.hand)return;
  if(t.handMail?.handNo!==t.handNo)t.handMail={handNo:t.handNo,attempted:[],failed:[]};
  for(const id of t.hand.ids){
   if(t.handMail.attempted.includes(id))continue;
   try{await send(t,id);}catch{t.handMail.failed.push(id);}
   t.handMail.attempted.push(id);
   if(t.hand.turn===id)t.turnNoticeKey=key(t);
   service.save(t);
  }
 }
 async function notifyTurn(t){
  if(t.status!=='playing'||!t.hand||t.hand.done||!t.hand.turn||t.turnNoticeKey===key(t))return;
  const id=t.hand.turn;t.turnNoticeKey=key(t);service.save(t);
  // Failed DMs retain the private 'View cards' button as a fallback; do not spam retries.
  if(t.handMail?.handNo===t.handNo&&t.handMail.failed.includes(id))return;
  try{await send(t,id);}catch{
   if(t.handMail?.handNo===t.handNo&&!t.handMail.failed.includes(id)){t.handMail.failed.push(id);service.save(t);}
  }
 }
 return {deal,notifyTurn};
}
