import {SlashCommandBuilder,PermissionFlagsBits} from 'discord.js';
export const commands=[
 new SlashCommandBuilder().setName('족보').setDescription('Royal Straight Flush 길드 포커 족보 이미지'),
 new SlashCommandBuilder().setName('포커').setDescription('텍사스 홀덤')
 .addSubcommandGroup(g=>g.setName('테이블').setDescription('테이블 관리').addSubcommand(c=>c.setName('만들기').setDescription('시작머니를 정하고 테이블 생성')))
 .addSubcommand(c=>c.setName('관리').setDescription('방장 전용 START 및 설정'))
 .addSubcommand(c=>c.setName('도움말').setDescription('처음 하는 사람을 위한 진행·베팅 안내'))
 .addSubcommand(c=>c.setName('기록').setDescription('최근 완료된 판의 공용 카드·행동·결과 확인').addIntegerOption(o=>o.setName('판').setDescription('보관된 판 번호 (생략 시 최근 판)').setMinValue(1)))
 .addSubcommand(c=>c.setName('카드').setDescription('나에게만 내 카드 표시'))
 .addSubcommand(c=>c.setName('카드목록').setDescription('정확한 52장 카드 이미지 미리보기')),
 new SlashCommandBuilder().setName('테이블').setDescription('테이블 종료').addSubcommand(c=>c.setName('종료').setDescription('방장 전용: 테이블 강제 종료 및 칩 반환')),
 new SlashCommandBuilder().setName('빅').setDescription('블라인드 설정').addSubcommandGroup(g=>g.setName('스몰').setDescription('블라인드').addSubcommand(c=>c.setName('설정').setDescription('방장 전용 블라인드 순차 설정'))),
 new SlashCommandBuilder().setName('ㅈㅈ').setDescription('남은 칩을 전부 판에 넣고 포기 (확인 필요)'),
 new SlashCommandBuilder().setName('포커거래').setDescription('관리자 거래 확인').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addSubcommand(c=>c.setName('목록').setDescription('응답 미확정 거래 목록'))
 .addSubcommand(c=>c.setName('확인').setDescription('외부 거래기록 확인 후 수동 확정')
 .addStringOption(o=>o.setName('거래번호').setDescription('목록의 거래번호').setRequired(true))
 .addBooleanOption(o=>o.setName('반영됨').setDescription('언빌리버봇 기록에서 금액 반영 확인 시 true').setRequired(true)))
].map(c=>c.toJSON());

// Discord sends the original option names back to the handler; users see localized English labels.
const englishNames={'포커':'poker','테이블':'table','만들기':'create','관리':'manage','도움말':'help','기록':'history','판':'round','카드':'hand','카드목록':'cards','빅':'blinds','스몰':'setup','설정':'set','ㅈㅈ':'surrender','포커거래':'poker-transactions','목록':'list','확인':'confirm','거래번호':'transaction','반영됨':'applied'};
const englishDescriptions={'포커':'Texas Holdem poker','테이블':'Poker table','만들기':'Create a table with starting chips','관리':'Host controls, start and next hand','도움말':'Poker and economy help','기록':'Review a completed hand and replay','판':'Saved round number; omit for the latest hand','카드':'View your private hole cards','카드목록':'Preview all 52 card images','빅':'Set table blinds','스몰':'Configure blinds','설정':'Host-only small and big blind setup','ㅈㅈ':'Permanently forfeit all remaining chips (confirmation required)','포커거래':'Administrator transaction review','목록':'List uncertain API writes','확인':'Confirm actual external audit results','거래번호':'Transaction ID from the pending list','반영됨':'True only if the external audit proves the write was applied'};
function localize(node){
 if(englishNames[node.name])node.name_localizations={'en-US':englishNames[node.name],'en-GB':englishNames[node.name]};
 if(englishDescriptions[node.name])node.description_localizations={'en-US':englishDescriptions[node.name],'en-GB':englishDescriptions[node.name]};
 for(const option of node.options||[])localize(option);
}
for(const command of commands)localize(command);
