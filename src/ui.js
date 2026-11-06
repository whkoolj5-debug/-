import {ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder} from 'discord.js';
export const money=n=>Number(n).toLocaleString('ko-KR');
export const btn=(id,label,style=ButtonStyle.Secondary,disabled=false)=>new ButtonBuilder().setCustomId(id).setLabel(label.slice(0,80)).setStyle(style).setDisabled(disabled);
export function rows(buttons){const a=[];for(let i=0;i<buttons.length;i+=5)a.push(new ActionRowBuilder().addComponents(buttons.slice(i,i+5)));return a;}
export const confirm=(prefix,t,suffix='')=>rows([btn(`${prefix}yes:${t.id}${suffix}`,'YES',ButtonStyle.Success),btn(`${prefix}no:${t.id}${suffix}`,'NO',ButtonStyle.Danger)]);
export function publicRows(t){
 if(t.status==='closed')return [];
 if(t.status==='lobby')return rows([btn(`join:${t.id}`,`${t.ownerName}님의 테이블 참여`,ButtonStyle.Primary,t.seats.every(Boolean))]);
 if(t.status!=='playing')return [];
 const h=t.hand,tag=`:${t.id}:${h.rev}`;
 return [...rows([btn(`cards:${t.id}`,'내 카드 보기',ButtonStyle.Primary),btn(`surrender:${t.id}`,'ㅈㅈ',ButtonStyle.Secondary,h.done)]),...(h.done?[]:rows([btn(`check${tag}`,'체크',ButtonStyle.Secondary,h.seats[h.turn]?.bet<h.currentBet),btn(`call${tag}`,'콜',ButtonStyle.Success),btn(`raise${tag}`,'베팅 / 레이즈',ButtonStyle.Primary),btn(`allin${tag}`,'올인',ButtonStyle.Danger),btn(`fold${tag}`,'폴드')]))];
}
export function hostRows(t){
 if(t.status==='lobby')return rows([btn(`biginput:${t.id}`,'블라인드 설정',ButtonStyle.Primary),...(t.seats.filter(Boolean).length>=5?[btn(`start:${t.id}`,'START',ButtonStyle.Success,!t.blindsConfirmed)]:[]),btn(`cancel:${t.id}`,'대기 테이블 취소',ButtonStyle.Danger)]);
 if(t.status==='playing'&&t.hand?.done)return rows([btn(`next:${t.id}`,'다음 판 시작',ButtonStyle.Success)]);
 if(['refunding','settling'].includes(t.status))return rows([btn(`retry:${t.id}`,'정산 이어서 처리',ButtonStyle.Primary)]);
 return [];
}
export function embed(t,mode){
 const h=t.hand;
 let text=`스타트머니 **${money(t.startingMoney)}** · 참가 **${t.seats.filter(Boolean).length}/7**\n빅 **${money(t.bigBlind)}** / 스몰 **${money(t.smallBlind)}**\n`;
 if(mode==='test')text+='**테스트 모드 · 언빌리버봇 실제 잔액을 차감하지 않습니다.**\n';
 text+=t.seats.map((id,i)=>`${i+1}번: ${id?`<@${id}>${h?.seats[id]?` · ${money(h.seats[id].chips)} 칩`:''}${t.players[id].quit?' · 포기':''}`:'빈자리'}`).join('\n');
 if(h){text+=`\n\n${t.handNo}번째 판 · **${h.street}** · 팟 **${money(h.pot)}**`;
  if(!h.done)text+=`\n차례: <@${h.turn}> · 현재 베팅 ${money(h.currentBet)}`;
  else text+='\n'+h.results.filter(p=>Object.keys(p.payouts).length).map(p=>Object.entries(p.payouts).map(([id,n])=>`<@${id}> +${money(n)}`).join(' / ')).join('\n');
 }
 if(t.status==='closed')text+='\n**종료 · 잔액 정산 완료**';
 if(t.status==='paused')text+='\n**거래 확인 대기 · 관리자 확인 필요**';
 return new EmbedBuilder().setColor(0x167b35).setTitle(`${t.ownerName}님의 테이블${t.status==='lobby'?'이 만들어졌습니다.':''}`).setDescription(text).setImage('attachment://table.png').setFooter({text:'방장: /포커 관리 · 5명부터 시작 · 내 카드는 본인만 확인'});
}
