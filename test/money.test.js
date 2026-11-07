import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.js';
import {Economy} from '../src/economy.js';
import {MoneyService,moneyAmount} from '../src/money-service.js';
function setup(){const store=new Store(':memory:'),economy=new Economy(store),money=new MoneyService(store,economy);return {store,economy,money};}
const op=(id,kind='pay',input='1000')=>({id,guild:'g',actor:'admin',target:'user',kind,input});
test('administrator grants mint new money even from a zero balance; duplicate events do not mint again',async()=>{
 const {store,economy,money}=setup();await economy.balance('g','admin');await economy.balance('g','user');
 store.db.prepare('UPDATE balances SET amount=0 WHERE id=?').run('g:admin');
 const request=op('mint','grant');await money.execute(request);await money.execute(request);
 assert.equal((await economy.balance('g','admin')).balance,0);assert.equal((await economy.balance('g','user')).balance,5001000);
 assert.equal(store.transfer('mint:change').amount,1000);assert.equal(money.get('mint').actor,'admin');store.close();
});
test('local transfer is atomic, preserves total money, is idempotent, and rejects insufficient funds',async()=>{
 const {store,economy,money}=setup();await money.execute(op('pay'));
 assert.equal((await economy.balance('g','admin')).balance,4999000);assert.equal((await economy.balance('g','user')).balance,5001000);
 await money.execute(op('pay'));assert.equal((await economy.balance('g','user')).balance,5001000);
 await assert.rejects(()=>money.execute(op('too-much','pay','6000000')),/Insufficient/);
 assert.equal((await economy.balance('g','admin')).balance,4999000);assert.equal(store.transfer('too-much:out'),undefined);
 assert.equal(money.get('too-much').state,'failed');await assert.rejects(()=>money.execute({...op('self'),target:'admin'}),/yourself/);store.close();
});
test('remove and full clear are idempotent and do not debit the administrator',async()=>{
 const {store,economy,money}=setup();await money.execute(op('remove','remove'));await money.execute(op('clear','remove','all'));
 assert.equal((await economy.balance('g','user')).balance,0);await money.execute(op('clear','remove','all'));assert.equal((await economy.balance('g','user')).balance,0);
 assert.equal(money.get('clear').amount,4999000);store.close();
});
test('live ambiguous credit is paused and restart/admin retry cannot debit twice or retry an unknown write',async()=>{
 const store=new Store(':memory:');let calls=[],creditUnknown=true;
 const economy=new Economy(store,{mode:'live',token:'test-token',fetcher:async(url,o)=>{
  calls.push({url,method:o.method});
  if(o.method==='GET')return {ok:true,json:async()=>({cash:10000,bank:0})};
  if(url.endsWith('/user')&&creditUnknown)throw Error('lost response');
  return {ok:true,json:async()=>({})};
 }});
 let money=new MoneyService(store,economy);await assert.rejects(()=>money.execute(op('live')),/pending review/);
 assert.equal(store.transfer('live:out').status,'done');assert.equal(store.transfer('live:in').status,'pending');
 const count=calls.length;money=new MoneyService(store,economy);await assert.rejects(()=>money.retry('live','g'),/pending review/);assert.equal(calls.length,count);
 creditUnknown=false;store.mark('live:in','failed','외부 기록 확인: 미반영');await money.retry('live','g');
 assert.equal(money.get('live').state,'done');assert.equal(calls.filter(c=>c.method==='PATCH'&&c.url.endsWith('/admin')).length,1);store.close();
});
test('a manually confirmed live credit completes recovery without any second external write',async()=>{
 const store=new Store(':memory:');let calls=0;
 const economy=new Economy(store,{mode:'live',token:'test',fetcher:async(url,o)=>{calls++;if(o.method==='GET')return {ok:true,json:async()=>({cash:10000,bank:0})};if(url.endsWith('/user'))throw Error('unknown');return {ok:true,json:async()=>({})};}});
 const money=new MoneyService(store,economy);await assert.rejects(()=>money.execute(op('confirmed')));
 store.mark('confirmed:in','done','관리자 확인');const before=calls;await money.retry('confirmed','g');assert.equal(calls,before);assert.equal(money.get('confirmed').state,'done');store.close();
});
test('balance leaderboard isolates guilds and returns a sorted, paged result',async()=>{
 const {store,economy,money}=setup();await money.execute(op('rank','grant','1234'));await economy.balance('other','alien');
 const lb=await economy.leaderboard('g',1,'total');assert.equal(lb.users[0].id,'user');assert(!lb.users.some(u=>u.id==='alien'));
 await assert.rejects(()=>economy.leaderboard('g',0),/Usage/);store.close();
});
test('live leaderboard uses documented endpoint, sort, pagination and total_pages field',async()=>{
 const store=new Store(':memory:');let requested;
 const economy=new Economy(store,{mode:'live',token:'test',fetcher:async(url)=>{requested=url;return {ok:true,json:async()=>({users:[{user_id:'u',cash:12,bank:34}],total_pages:3})};}});
 const lb=await economy.leaderboard('g',2,'bank');assert(requested.includes('/users/?sort=bank&limit=10&page=2'));assert.equal(lb.users[0].total,46);assert.equal(lb.totalPages,3);store.close();
});
test('money input supports grouped integers but rejects negative, malformed, infinite and API-overflow values',()=>{
 assert.equal(moneyAmount('2,147,483,647'),2147483647);
 for(const s of ['0','-1','1.2','10,00','1e9','Infinity','2147483648'])assert.throws(()=>moneyAmount(s));
});

test('a failure on the second local transfer leg rolls back the sender and both ledger entries',async()=>{
 const {store,economy,money}=setup();await economy.balance('g','admin');await economy.balance('g','user');
 store.db.prepare('UPDATE balances SET amount=? WHERE id=?').run(Number.MAX_SAFE_INTEGER,'g:user');
 const before=(await economy.balance('g','admin')).balance;
 await assert.rejects(()=>money.execute(op('overflow','pay','1')),/safe numeric/);
 assert.equal((await economy.balance('g','admin')).balance,before);assert.equal((await economy.balance('g','user')).balance,Number.MAX_SAFE_INTEGER);
 assert.equal(store.transfer('overflow:out'),undefined);assert.equal(store.transfer('overflow:in'),undefined);store.close();
});
test('uncertain writes block a new payment before debit and also block new poker wallet mutations',async()=>{
 const {store,economy,money}=setup();store.begin('external-unknown','g','user',1000);
 await assert.rejects(()=>money.execute(op('blocked')),/reviewed first/);assert.equal(store.transfer('blocked:out'),undefined);
 await assert.rejects(()=>economy.move('new-poker-payment','g','user',-1000),/먼저 확인/);
 await assert.rejects(()=>money.retry('blocked','other'),/does not belong/);store.close();
});
