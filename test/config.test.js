import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../src/config.js';
const valid={DISCORD_TOKEN:'local-secret',CLIENT_ID:'123456789012345678',GUILD_ID:'234567890123456789'};
test('configuration keeps test mode and existing defaults',()=>{
 const c=readConfig(valid);assert.equal(c.mode,'test');assert.equal(c.turnSeconds,90);assert.equal(c.port,3000);assert.equal(c.databasePath,'data/poker.sqlite');
});
test('missing token fails without exposing any configured secret',()=>{
 assert.throws(()=>readConfig({...valid,DISCORD_TOKEN:''}),/DISCORD_TOKEN.*로컬 .env/);
 assert.throws(()=>readConfig({...valid,CLIENT_ID:'local-secret'}),e=>e.message.includes('CLIENT_ID')&&!e.message.includes('local-secret'));
});
test('live mode requires its separate API key',()=>{
 assert.throws(()=>readConfig({...valid,ECONOMY_MODE:'live'}),/UNBELIEVABOAT_API_KEY/);
 assert.equal(readConfig({...valid,ECONOMY_MODE:'live',UNBELIEVABOAT_API_KEY:'api-secret'}).mode,'live');
 assert.throws(()=>readConfig({...valid,ECONOMY_MODE:'typo'}),/ECONOMY_MODE/);
});
test('invalid timeout and port cannot silently disable turns or break health endpoint',()=>{
 for(const value of ['0','-1','NaN','1.5','Infinity','86401'])assert.throws(()=>readConfig({...valid,TURN_SECONDS:value}),/TURN_SECONDS/);
 for(const value of ['0','65536','oops'])assert.throws(()=>readConfig({...valid,PORT:value}),/PORT/);
 assert.equal(readConfig({...valid,TURN_SECONDS:'120',PORT:'8080'}).turnSeconds,120);
});
