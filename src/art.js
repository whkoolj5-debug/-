import sharp from 'sharp';
import path from 'node:path';
process.env.FONTCONFIG_FILE=path.resolve('assets/fonts/fonts.conf');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {makeDeck,rankLabel} from './poker-engine.js';
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
 const pos=[[838,162],[903,288],[838,412],[510,468],[188,412],[120,288],[187,162]];
 const labels=t.seats.map((id,i)=>{
  if(!id)return '';
  const [x,y]=pos[i],p=t.players[id],chips=t.hand?(t.hand.seats[id]?.chips??0):t.startingMoney;
  return `<rect x="${x-54}" y="${y-30}" width="108" height="60" rx="12" fill="#fffdf8" stroke="${t.hand?.turn===id?'#edb94e':'#9c9caa'}" stroke-width="3"/><text x="${x}" y="${y-7}" fill="#171921" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="13" font-weight="bold">${i+1} · ${esc(p.name.slice(0,9))}</text><text x="${x}" y="${y+14}" fill="#303844" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="13">${chips.toLocaleString('en-US')}</text>${t.hand?.folded.includes(id)?`<text x="${x}" y="${y+47}" text-anchor="middle" fill="#ffe4e4" font-size="13">FOLD</text>`:''}`;
 }).join('');
 const info=`<text x="512" y="216" fill="#fff4cb" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="19">${t.hand?`POT ${t.hand.pot.toLocaleString('en-US')} · ${t.hand.street.toUpperCase()}`:'TEXAS HOLD’EM'}</text>`;
 const layers=[{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576">${labels}${info}</svg>`),left:0,top:0}];
 if(t.hand)for(let i=0;i<5;i++){
  const c=t.hand.board[i];
  const input=c?await sharp(`assets/cards/${c.id}.png`).resize(64,90).toBuffer():Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="90"><rect x="1" y="1" width="62" height="88" rx="6" fill="#07581f" stroke="#54a46b" stroke-dasharray="4 4"/></svg>');
  layers.push({input,left:336+i*72,top:237});
 }
 return sharp('assets/table.png').composite(layers).png().toBuffer();
}
