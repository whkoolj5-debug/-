import {availableHistory} from './interactions.js';
import {bettingInfo,canAct,showdown,streetName,actionName,cardText,tableTheme,publicRecord,MIN_PLAYERS,turnClock} from './table-view.js';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder} from 'discord.js';
export const money=n=>Number(n).toLocaleString('ko-KR');
export const btn=(id,label,style=ButtonStyle.Secondary,disabled=false)=>new ButtonBuilder().setCustomId(id).setLabel(label.slice(0,80)).setStyle(style).setDisabled(disabled);
export function rows(buttons){const a=[];for(let i=0;i<buttons.length;i+=5)a.push(new ActionRowBuilder().addComponents(buttons.slice(i,i+5)));return a;}
export const confirm=(prefix,t,suffix='')=>rows([btn(`${prefix}yes:${t.id}${suffix}`,'YES',ButtonStyle.Success),btn(`${prefix}no:${t.id}${suffix}`,'NO',ButtonStyle.Danger)]);
export function publicRows(t){
 if(t.status==='closed')return t.hand?[...rows([btn(`history:${t.id}`,'최근 판 기록')])]:[];
 if(t.status==='lobby')return [...rows([btn(`join:${t.id}`,`${t.ownerName}님의 테이블 참여`,ButtonStyle.Primary,t.seats.every(Boolean))]),...hostRows(t)];
 if(t.status!=='playing')return [];
 const h=t.hand,tag=`:${t.id}:${h.rev}`,info=bettingInfo(h);
 const controls=rows([btn(`cards:${t.id}`,'내 카드 보기',ButtonStyle.Primary),btn(`history:${t.id}`,'최근 판 기록'),btn(`surrender:${t.id}`,'ㅈㅈ · 영구 포기',ButtonStyle.Secondary,h.done)]);
 if(h.done)return [...controls,...hostRows(t)];
 const actions=rows([
  btn(`check${tag}`,'체크',ButtonStyle.Secondary,!canAct(h,h.turn,'check')),
  btn(`call${tag}`,`콜 ${money(info.call)}`,ButtonStyle.Success,info.call===0),
  btn(`raise${tag}`,info.max<info.min?'직접 입력 · 올인만 가능':`직접 입력 · 최소 ${money(info.min)}`,ButtonStyle.Primary,!info.canRaise),
  btn(`allin${tag}`,'올인',ButtonStyle.Danger,!canAct(h,h.turn,'allin')),
  btn(`fold${tag}`,'폴드')]);
 return [...controls,...actions,...rows(info.presets.map(p=>btn(`quick_${p.key}${tag}`,`${p.label} → ${money(p.total)}`))),...hostRows(t)];
}
export function hostRows(t){
 const theme=btn(`theme:${t.id}`,`테마 · ${tableTheme(t).name}`),refresh=btn(`refresh:${t.id}`,'테이블 다시 표시');
 if(t.status==='lobby')return rows([btn(`biginput:${t.id}`,'BIG / SMALL 설정',ButtonStyle.Primary),btn(`start:${t.id}`,'START',ButtonStyle.Success,!t.blindsConfirmed||t.seats.filter(Boolean).length<MIN_PLAYERS),btn(`cancel:${t.id}`,'대기 테이블 취소',ButtonStyle.Danger),theme,refresh]);
 if(t.status==='playing')return rows([...(t.hand?.done?[btn(`next:${t.id}`,'다음 판 시작',ButtonStyle.Success)]:[]),theme,refresh]);
 if(['refunding','settling'].includes(t.status))return rows([btn(`retry:${t.id}`,'정산 이어서 처리',ButtonStyle.Primary),refresh]);
 return [];
}
export function embed(t,mode,turnSeconds=90){
 const h=t.hand;
 const state={lobby:'참가 대기',playing:h?.done?'판 종료':'게임 진행',closed:'정산 완료',paused:'거래 확인 대기',settling:'정산 중',refunding:'환불 중'}[t.status]||t.status;
 let text=`**${state}** · 참가 **${t.seats.filter(Boolean).length}/7** · 시작머니 **${money(t.startingMoney)}**\n블라인드 **${money(t.smallBlind)} / ${money(t.bigBlind)}**\n`;
 if(mode==='test')text+='🧪 **테스트 잔액 · 실제 서버 잔액 사용 안 함**\n';
 if(h){
  text+=`\n**HAND #${t.handNo} · ${streetName(h.street)} · 팟 ${money(h.pot)}**\n공용 카드: ${cardText(h.board)||'공개 전'}\n`;
  if(!h.done){const info=bettingInfo(h);
   text+=`\n▶ <@${h.turn}> 차례 · 콜 **${money(info.call)}**\n`;
   text+=info.canRaise?`레이즈 총액 **${money(Math.min(info.min,info.max))}~${money(info.max)}**${info.max<info.min?' (올인만 가능)':''}\n`:'현재 레이즈 불가\n';
   if(Number.isFinite(t.lastAction))text+=`행동 마감 <t:${Math.floor((t.lastAction+turnSeconds*1000)/1000)}:R> · 시간 초과 시 체크 또는 폴드\n`;
  }else{
   for(const p of h.results)for(const [id,n] of Object.entries(p.payouts))text+=`🏆 <@${id}> 수령 **+${money(n)}**\n`;
   for(const p of showdown(h))text+=`<@${p.id}> · ${cardText(p.cards)} · **${p.category}**\n`;
  }
 }
 text+='\n'+t.seats.map((id,i)=>`${i+1}번 · ${id?`<@${id}> · ${money(h?.seats[id]?.chips??t.startingMoney)} 칩${t.players[id].quit?' · 영구 포기':h?.folded.includes(id)?' · 폴드':''}`:'빈자리'}`).join('\n');
 if(h?.log?.length)text+='\n\n**최근 행동**\n'+h.log.slice(-3).map(a=>`<@${a.id}> ${actionName(a.kind)}${a.automatic?' (시간 초과)':''}${a.amount?` +${money(a.amount)}`:''}`).join('\n');
 if(t.handMail?.handNo===t.handNo&&t.handMail.failed.length)text+='\n\n일부 참가자에게 DM을 보낼 수 없습니다. 해당 참가자는 내 카드 보기 버튼으로 패를 확인하세요.';
 if(t.status==='lobby')text+='\n\n2명 이상 참가 + BIG / SMALL 확정 → 방장이 아래 START · 방장 전용 설정은 다른 참가자가 누를 수 없습니다.';
 return new EmbedBuilder().setColor(h?.done?0xd7ad63:Number.parseInt(tableTheme(t).ink.slice(1),16)).setTitle(`RSF POKER · ${t.ownerName}님의 테이블`).setDescription(text.slice(0,4000)).setImage('attachment://table.png').setFooter({text:'설정/START/다음 판은 방장 전용 · 개인 패는 자동 DM · DM 차단 시 내 카드 보기'});
}

export function historyRows(t,selected){
 const list=availableHistory(t),at=list.findIndex(h=>h.handNo===selected);
 if(at<0)return [];
 return rows([btn(`replay:${t.id}:${selected}:0`,'판 다시보기',ButtonStyle.Primary,!publicRecord(t,selected)?.frames?.length),btn(`history:${t.id}:${list[at-1]?.handNo||selected}:prev`,'← 이전 판',ButtonStyle.Secondary,at===0),btn(`history:${t.id}:${list[at+1]?.handNo||selected}:next`,'다음 판 →',ButtonStyle.Secondary,at===list.length-1),btn(`export:${t.id}`,'최근 10판 기록 파일')]);
}

export function replayRows(t,handNo,step,count){
 const button=(n,label,disabled,key)=>btn(`replay:${t.id}:${handNo}:${n}:${key}`,label,ButtonStyle.Secondary,disabled);
 return rows([button(0,'처음',step===0,'first'),button(Math.max(0,step-1),'← 이전 행동',step===0,'prev'),button(Math.min(count-1,step+1),'다음 행동 →',step===count-1,'next'),button(count-1,'결과',step===count-1,'last'),btn(`history:${t.id}:${handNo}`,'기록으로')]);
}
