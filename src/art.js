import sharp from 'sharp';
// Bound native image workers and cache for small hosting plans.
sharp.cache({memory:12,files:0,items:64});
sharp.concurrency(1);
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdirSync} from 'node:fs';
function ensureFontCache(){
 if(!process.env.XDG_CACHE_HOME)process.env.XDG_CACHE_HOME=path.join(tmpdir(),'rsf-poker-cache');
 mkdirSync(path.join(process.env.XDG_CACHE_HOME,'fontconfig'),{recursive:true});
}
process.env.FONTCONFIG_FILE=path.resolve('assets/fonts/fonts.conf');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {makeDeck,rankLabel} from './poker-engine.js';
import {showdown,streetName,actionName,tableTheme,turnClock} from './table-view.js';
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function pip(s,x,y,size=28,flip=false){
 const paths={H:'M0,9 C-25,-5 -17,-24 0,-12 C17,-24 25,-5 0,9Z',D:'M0,-22 15,-2 0,18 -15,-2Z',S:'M0,-24 C-6,-14 -25,-3 -16,7 C-10,15 -3,8 -2,5 L-5,19 H5 L2,5 C3,8 10,15 16,7 C25,-3 6,-14 0,-24Z',C:'M-5,-7 C-21,-17 -27,7 -10,9 C-5,10 -2,6 -2,4 L-5,19 H5 L2,4 C2,6 5,10 10,9 C27,7 21,-17 5,-7 C18,-29 -18,-29 -5,-7Z'};
 return `<g transform="translate(${x} ${y}) scale(${size/42})${flip?' rotate(180)':''}"><path d="${paths[s]}"/></g>`;
}
export function cardSVG(c){
 const color=['H','D'].includes(c.suit)?'#b51d2b':'#17202b',label=rankLabel(c.rank);
 const idx=`<text x="12" y="31" font-size="27" font-family="DejaVu Serif" font-weight="bold">${label}</text>${pip(c.suit,22,49,20)}`;
 const layouts={2:[[0,0],[0,4]],3:[[0,0],[0,2],[0,4]],4:[[-1,0],[1,0],[-1,4],[1,4]],5:[[-1,0],[1,0],[0,2],[-1,4],[1,4]],6:[[-1,0],[1,0],[-1,2],[1,2],[-1,4],[1,4]],7:[[-1,0],[1,0],[0,1],[-1,2],[1,2],[-1,4],[1,4]],8:[[-1,0],[1,0],[0,1],[-1,2],[1,2],[0,3],[-1,4],[1,4]],9:[[-1,0],[1,0],[-1,1.33],[1,1.33],[0,2],[-1,2.67],[1,2.67],[-1,4],[1,4]],10:[[-1,0],[1,0],[0,.67],[-1,1.33],[1,1.33],[-1,2.67],[1,2.67],[0,3.33],[-1,4],[1,4]]};
 let center='';
 if(c.rank===14)center=pip(c.suit,90,129,94);
 else if(c.rank<=10)center=layouts[c.rank].map(([x,y])=>pip(c.suit,90+x*32,64+y*31,31,y>2)).join('');
 else {
  const crown=c.rank===13?'<path d="M-23,-30 -28,-54 -10,-43 0,-61 10,-43 28,-54 23,-30Z" fill="#d4a33e"/>':c.rank===12?'<path d="M-20,-31 -25,-47 -8,-41 0,-52 8,-41 25,-47 20,-31Z" fill="#d4a33e"/>':'<path d="M-26,-28 Q-20,-57 20,-42 L30,-26Z" fill="#c53a36"/>';
  const bust=`<path d="M-33,55 L-24,10 0,0 24,10 33,55Z" fill="#193a63" stroke="#d4a33e" stroke-width="3"/><path d="M-15,12 15,45 M15,12 -15,45" stroke="#d4a33e" stroke-width="5"/><ellipse cy="-14" rx="20" ry="25" fill="#f5d4ae" stroke="#704b37" stroke-width="2"/>${crown}<path d="M-10,-14 h4 M6,-14 h4 M-7,0 Q0,5 7,0" stroke="#45372e" fill="none" stroke-width="2"/>`;
  center=`<rect x="40" y="43" width="100" height="166" rx="3" fill="#f9efd7" stroke="${color}"/><g transform="translate(90 100)">${bust}</g><g transform="translate(90 152) rotate(180)">${bust}</g><rect x="43" y="117" width="94" height="18" fill="${color}"/><text x="90" y="131" fill="white" text-anchor="middle" font-family="DejaVu Serif" font-size="16">${label}</text>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="252"><rect x="1" y="1" width="178" height="250" rx="12" fill="#fffdf8" stroke="#c2c5ca" stroke-width="2"/><g fill="${color}">${idx}<g transform="translate(180 252) rotate(180)">${idx}</g>${center}</g></svg>`;
}
export async function generateCards(){
 ensureFontCache();
 await mkdir('assets/cards',{recursive:true});
 const deck=['H','D','C','S'].flatMap(s=>[14,2,3,4,5,6,7,8,9,10,11,12,13].map(rank=>makeDeck().find(c=>c.suit===s&&c.rank===rank)));
 const layers=[];const manifest=[];
 for(let i=0;i<deck.length;i++){
  const c=deck[i],svg=cardSVG(c),file=`assets/cards/${c.id}.png`;
  await sharp(Buffer.from(svg)).png().toFile(file);await writeFile(`assets/cards/${c.id}.svg`,svg);
  layers.push({input:await sharp(Buffer.from(svg)).resize(126,176).png().toBuffer(),left:20+(i%13)*136,top:20+Math.floor(i/13)*188});
  manifest.push({...c,pipCount:c.rank===14?1:c.rank<=10?c.rank:0,file});
 }
 await sharp({create:{width:1798,height:780,channels:4,background:'#20222b'}}).composite(layers).png().toFile('assets/deck-preview.png');
 await writeFile('assets/cards/manifest.json',JSON.stringify(manifest,null,2));
}
export async function handImage(cards){
 const layers=await Promise.all(cards.map(async(c,i)=>({input:await readFile(`assets/cards/${c.id}.png`),left:12+i*192,top:12})));
 return sharp({create:{width:cards.length*192+12,height:276,channels:4,background:'#20222b'}}).composite(layers).png().toBuffer();
}
export async function renderTable(t){
 ensureFontCache();
 const width=3000,height=1950,scale=2.5,h=t.hand,theme=tableTheme(t);
 const clock=turnClock(t,t.clockNow??Date.now());
 const pos=[[600,130],[951,199],[1036,431],[900,636],[300,636],[164,431],[249,199]];
 const fmt=n=>Number(n||0).toLocaleString('en-US');
 const text=(x,y,label,size=16,color='#e4efef',extra='')=>`<text x="${x}" y="${y}" fill="${color}" font-family="Noto Sans KR, sans-serif" font-size="${size}" ${extra}>${esc(label)}</text>`;
 const center='text-anchor="middle"';
 const stage=h?.aborted?'HAND VOID':h?.done?'HAND COMPLETE':h?streetName(h.street).toUpperCase():'WAITING FOR PLAYERS';
 const winners=new Set(h?.done&&!h.aborted?h.results.flatMap(r=>Object.keys(r.payouts)):[]);
 const revealed=new Map((h?.publicShowdown??showdown(h)).map(p=>[p.id,p.cards]));
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 780">
 <defs>
  <radialGradient id="bg"><stop stop-color="#1a3139"/><stop offset="1" stop-color="#0a111b"/></radialGradient>
  <radialGradient id="felt"><stop stop-color="${theme.felt[0]}"/><stop offset="1" stop-color="${theme.felt[1]}"/></radialGradient>
  <linearGradient id="rail" x2="0" y2="1"><stop stop-color="#36434d"/><stop offset="1" stop-color="#18232d"/></linearGradient>
  <linearGradient id="gold"><stop stop-color="#f9db96"/><stop offset="1" stop-color="#b78b45"/></linearGradient>
  <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0L6 6M6 0L0 6" stroke="#e0ffff" stroke-opacity=".025"/></pattern>
 </defs>
 <rect width="1200" height="780" fill="url(#bg)"/>
 <path d="M40 72H1160" stroke="#253541"/>
 ${text(42,42,'RSF',26,'#e4c486','font-weight="bold"')}${text(103,42,'POKER CLUB',17,'#dce7e8','letter-spacing="3"')}
 ${text(1156,39,`${t.demo?'DEMO · ':t.replay?'REPLAY · ':t.displayMode==='test'?'TEST MODE · ':''}${h?`HAND #${String(t.handNo).padStart(3,'0')}`:'PRIVATE TABLE'}`,15,'#92aaa9','text-anchor="end" letter-spacing="2"')}
 <ellipse cx="600" cy="389" rx="482" ry="237" fill="#030a10" opacity=".7"/>
 <ellipse cx="600" cy="375" rx="480" ry="237" fill="url(#rail)" stroke="#43515b" stroke-width="2"/>
 <ellipse cx="600" cy="375" rx="453" ry="211" fill="url(#felt)" stroke="#091d23" stroke-width="6"/>
 <ellipse cx="600" cy="375" rx="443" ry="201" fill="url(#weave)" stroke="#52917f" stroke-opacity=".3"/>
 ${text(600,208,stage,13,'#a2c7b7',center+' letter-spacing="3"')}
 ${text(600,235,`SMALL BLIND ${fmt(t.smallBlind)}   |   BIG BLIND ${fmt(t.bigBlind)}`,19,'#d2e9da',center+' font-weight="bold"')}
 <rect x="480" y="252" width="240" height="46" rx="23" fill="#082b29" stroke="#408b76"/>
 ${text(600,282,h?`POT  ${fmt(h.pot)}`:'TEXAS HOLD’EM',22,'#f2dca9',center+' font-weight="bold"')}
 ${text(600,443,h?.done?'RESULTS BELOW':h?`CURRENT BET  ${fmt(h.currentBet)}`:`${t.seats.filter(Boolean).length} / 7 PLAYERS`,14,'#a7c8ba',center+' letter-spacing="1"')}
 ${text(600,485,'RSF · TEXAS HOLD’EM',12,'#69998d',center+' letter-spacing="4"')}`;
 const cardLayers=[];
 for(let i=0;i<5;i++){
  const left=384+i*88,top=316,c=h?.done&&!t.replay?null:h?.board[i];
  if(c)cardLayers.push({input:await sharp(`assets/cards/${c.id}.png`).resize(Math.round(80*scale),Math.round(112*scale)).toBuffer(),left:Math.round(left*scale),top:Math.round(top*scale)});
  else svg+=`<rect x="${left}" y="${top}" width="80" height="112" rx="9" fill="#092e2b" fill-opacity=".55" stroke="#548f7b" stroke-opacity=".55" stroke-dasharray="5 5"/>${text(left+40,top+65,'RSF',13,'#49806f',center+' letter-spacing="2"')}`;
 }
 const dealer=h?.ids[h.dealerIndex],small=h?.ids[h.sbIndex],big=h?.ids[h.bbIndex];
 for(let i=0;i<7;i++){
  const id=t.seats[i],[x,y]=pos[i];
  if(!id){svg+=`<rect x="${x-91}" y="${y-32}" width="182" height="74" rx="18" fill="#101f29" fill-opacity=".75" stroke="#3a4a53" stroke-dasharray="5 5"/>${text(x,y-1,`SEAT ${i+1}`,12,'#738b96',center+' letter-spacing="2"')}${text(x,y+23,'참가 가능',12,'#94aaa9',center)}`;continue;}
  const p=t.players[id],seat=h?.seats[id],chips=h?(seat?.chips??0):t.startingMoney;
  const turn=!h?.done&&h?.turn===id,win=winners.has(id),folded=h?.folded.includes(id),out=p.quit||(h&&!seat);
  const color=win?'#edcf83':turn?'#55e4c4':out||folded?'#40505b':'#526773';
  if(turn||win)svg+=`<rect x="${x-101}" y="${y-42}" width="202" height="100" rx="22" fill="${color}" opacity=".12"/>`;
  svg+=`<rect x="${x-95}" y="${y-36}" width="190" height="88" rx="18" fill="${turn?'#183e3b':win?'#343228':'#14212c'}" stroke="${color}" stroke-width="${turn||win?3:1.5}"/>`;
  svg+=`<circle cx="${x-67}" cy="${y-7}" r="17" fill="${turn?'#4de1bd':'#293d48'}"/>${text(x-67,y-1,i+1,14,turn?'#0b3028':'#aec4c9',center+' font-weight="bold"')}`;
  svg+=text(x-38,y-6,Array.from(p.name.normalize('NFKC')).slice(0,9).join('')+(Array.from(p.name.normalize('NFKC')).length>9?'…':''),14,folded||out?'#82969b':'#eef4ef','font-weight="bold"');
  svg+=text(x-38,y+23,fmt(chips),21,win?'#f5d787':turn?'#60e6c8':'#e2eae5','font-weight="bold"');
  const status=win?'WINNER':p.quit?'영구 포기':out?'탈락':folded?'FOLD':seat?.chips===0?'ALL-IN':turn?'YOUR TURN':'';
  if(status)svg+=text(x,y+70,status,11,color,center+' letter-spacing="1"');
  const badges=[];if(id===dealer)badges.push(['D','#f1dfae']);if(id===small)badges.push(['SB','#82b9e0']);if(id===big)badges.push(['BB','#e3a084']);
  badges.forEach(([label,fill],j)=>{svg+=`<circle cx="${x+65-j*29}" cy="${y-39}" r="13" fill="${fill}" stroke="#14212c" stroke-width="2"/>${text(x+65-j*29,y-35,label,10,'#14212c',center+' font-weight="bold"')}`;});
  if(seat?.bet>0&&!h.done){const bx=Math.round(x+(600-x)*.31),by=Math.round(y+(375-y)*.34);svg+=`<rect x="${bx-38}" y="${by-12}" width="76" height="24" rx="12" fill="#092522" stroke="#639080"/><circle cx="${bx-24}" cy="${by}" r="6" fill="#d7bb78"/>${text(bx+7,by+4,fmt(seat.bet),11,'#e8d9b2',center)}`;}
  if(seat&&!folded&&!out){
   const top=i===0?y-24:y>500?y-91:y+78;
   const cardX=i===0?x+112:x-37;
   if(revealed.has(id)){
    for(const [n,c] of revealed.get(id).entries())cardLayers.push({input:await sharp(`assets/cards/${c.id}.png`).resize(Math.round(34*scale),Math.round(48*scale)).toBuffer(),left:Math.round((cardX+n*40)*scale),top:Math.round(top*scale)});
   }else if(!h.done){
    for(let n=0;n<2;n++)svg+=`<rect x="${cardX+8+n*31}" y="${top}" width="27" height="38" rx="4" fill="#173343" stroke="#7f9b9b"/><path d="M${cardX+13+n*31} ${top+7}l17 24m0-24l-17 24" stroke="#48727a"/>`;
   }
  }
 }
 if(clock)svg+=`<rect x="430" y="580" width="340" height="132" rx="18" fill="#0c202a" stroke="#2b625d"/>${text(600,612,'YOUR TURN',30,'#65f4cb',center+' font-weight="bold" letter-spacing="3"')}${text(600,639,Array.from((t.players[h.turn]?.name||'').normalize('NFKC')).slice(0,18).join(''),17,'#ebfff5',center+' font-weight="bold"')}${text(600,672,`TIME LEFT  ${clock.remaining}s`,24,clock.remaining<=15?'#ff877e':'#f4d58a',center+' font-weight="bold"')}<rect x="460" y="688" width="280" height="7" rx="3" fill="#092d2a"/><rect x="460" y="688" width="${Math.round(280*clock.ratio)}" height="7" rx="3" fill="${clock.remaining<=15?'#ff877e':'#65f4cb'}"/>`;
 let footer='친구들과 즐기는 텍사스 홀덤 · 개인 카드는 나에게만 표시됩니다';
 if(h?.done)footer=h.results.flatMap(r=>Object.entries(r.payouts).map(([id,n])=>`${t.players[id]?.name||'플레이어'} +${fmt(n)}`)).join('  /  ');
 else if(h?.log?.length){const a=h.log.at(-1);footer=`최근 행동 · ${t.players[a.id]?.name||'플레이어'} ${actionName(a.kind)}${a.amount?` +${fmt(a.amount)}`:''}`;}
 svg+=`<rect x="40" y="728" width="1120" height="34" rx="10" fill="#101e29"/>${text(600,750,Array.from(footer).slice(0,68).join(''),13,h?.done?'#f1d599':'#93b1b5',center)}</svg>`;
 return sharp(Buffer.from(svg)).composite(cardLayers).png().toBuffer();
}

// This image accepts only already-public board cards; future cards and hole cards are never inputs.
export async function boardImage(cards,street){
 ensureFontCache();
 const labels=['플롭 1','플롭 2','플롭 3','턴','리버'];
 const title=`공용 카드 · ${streetName(street)} · ${cards.length}/5장 공개`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="840" height="300"><rect width="840" height="300" rx="16" fill="#10242d"/><text x="28" y="34" fill="#eee4bf" font-family="Noto Sans KR, sans-serif" font-size="19" font-weight="bold">${esc(title)}</text>`;
 const layers=[];
 for(let i=0;i<5;i++){
  const left=28+i*158,top=58;
  if(cards[i])layers.push({input:await sharp(`assets/cards/${cards[i].id}.png`).resize(144,202).toBuffer(),left,top});
  else svg+=`<rect x="${left}" y="${top}" width="144" height="202" rx="10" fill="#173c40" stroke="#507e7a" stroke-dasharray="6 5"/><text x="${left+72}" y="${top+108}" fill="#7caaa5" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="16">미공개</text>`;
  svg+=`<text x="${left+72}" y="284" fill="#b9d2cc" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="13">${labels[i]}</text>`;
 }
 return sharp(Buffer.from(svg+'</svg>')).composite(layers).png().toBuffer();
}
