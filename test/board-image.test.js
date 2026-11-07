import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {boardImage} from '../src/art.js';
import {makeDeck} from '../src/poker-engine.js';
test('public community-card PNG contains each revealed card in order and covers unrevealed slots',async()=>{
 const deck=makeDeck();
 for(const [street,count] of [['preflop',0],['flop',3],['turn',4],['river',5]]){
  const image=await boardImage(deck.slice(0,count),street),metadata=await sharp(image).metadata();
  assert.equal(metadata.width,840);assert.equal(metadata.height,300);
  for(let i=0;i<count;i++){
   const actual=await sharp(image).extract({left:28+i*158,top:58,width:144,height:202}).flatten({background:'#10242d'}).removeAlpha().raw().toBuffer();
   const expected=await sharp(`assets/cards/${deck[i].id}.png`).resize(144,202).flatten({background:'#10242d'}).removeAlpha().raw().toBuffer();
   // Compare the opaque center; rounded transparent corners are composited onto the background.
   const crop=async b=>sharp(b,{raw:{width:144,height:202,channels:3}}).extract({left:12,top:12,width:120,height:178}).raw().toBuffer();
   assert.deepEqual(await crop(actual),await crop(expected));
  }
 }
});
