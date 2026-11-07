export class Economy{
 constructor(store,{mode='test',token,fetcher=fetch}={}){
  if(!['test','live'].includes(mode))throw Error('ECONOMY_MODE는 test 또는 live');
  if(mode==='live'&&!token)throw Error('UNBELIEVABOAT_API_KEY가 필요합니다.');
  const saved=store.db.prepare("SELECT value FROM metadata WHERE key='economy_mode'").get();
  if(saved&&saved.value!==mode)throw Error('테스트/라이브는 서로 다른 DATABASE_PATH를 사용해주세요.');
  store.db.prepare("INSERT OR IGNORE INTO metadata VALUES('economy_mode',?)").run(mode);
  Object.assign(this,{store,mode,token,fetcher});
 }
 async request(g,u,method='GET',body){
  const r=await this.fetcher(`https://unbelievaboat.com/api/v1/guilds/${g}/users/${u}`,{method,headers:{Authorization:this.token,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok){const err=Error(`Economy API error (${r.status})`);err.definite=r.status>=400&&r.status<500&&r.status!==408;throw err;}
  return r.json();
 }
 async balance(g,u){
  if(this.mode==='live'){const b=await this.request(g,u);return {cash:b.cash,bank:b.bank,balance:b.cash+b.bank,rank:b.rank};}
  const id=`${g}:${u}`;this.store.db.prepare('INSERT OR IGNORE INTO balances VALUES(?,?)').run(id,5000000);
  const amount=this.store.db.prepare('SELECT amount FROM balances WHERE id=?').get(id).amount;
  return {cash:amount,bank:0,balance:amount};
 }
 async move(id,g,u,amount){
  const prev=this.store.transfer(id);
  if(prev?.status==='done')return;
  if(prev?.status==='pending')throw Error(`잔액 처리 확인이 필요합니다. 거래번호 ${id}`);
  const blocked=this.store.pending().find(tx=>tx.guild===g&&tx.user===u&&tx.id!==id);
  if(blocked)throw Error(`미확정 거래 ${blocked.id}를 먼저 확인해주세요.`);
  const b=await this.balance(g,u);
  if(amount<0&&b.balance< -amount)throw Error('Insufficient balance.');
  if(prev)this.store.db.prepare('DELETE FROM transfers WHERE id=?').run(id);
  this.store.begin(id,g,u,amount);
  if(this.mode==='test'){
   this.store.db.exec('BEGIN IMMEDIATE');
   try{this.store.db.prepare('UPDATE balances SET amount=amount+? WHERE id=?').run(amount,`${g}:${u}`);this.store.mark(id,'done');this.store.db.exec('COMMIT');}
   catch(e){this.store.db.exec('ROLLBACK');throw e;}return;
  }
  const cash=amount<0?-Math.min(Math.max(0,b.cash),-amount):amount;
  const bank=amount-cash;
  try{await this.request(g,u,'PATCH',{cash,bank,reason:`Discord poker ${id}`});this.store.mark(id,'done');}
  catch(e){if(e.definite)this.store.mark(id,'failed',e.message);throw e;}
 }
 async leaderboard(g,page=1,sort='total'){
  if(!Number.isInteger(page)||page<1||page>10000||!['cash','bank','total'].includes(sort))throw Error('Usage: !lb [page] [-cash|-bank|-total]');
  if(this.mode==='live'){
   const r=await this.fetcher(`https://unbelievaboat.com/api/v1/guilds/${g}/users/?sort=${sort}&limit=10&page=${page}`,{headers:{Authorization:this.token},signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error(`Economy API error (${r.status})`);
   const data=await r.json(),users=Array.isArray(data)?data:data.users;
   if(!Array.isArray(users))throw Error('Invalid leaderboard API response.');
   return {users:users.map(u=>({id:u.user_id,cash:u.cash,bank:u.bank,total:u.cash+u.bank})),page,totalPages:Array.isArray(data)?undefined:(data.totalPages??data.total_pages)};
  }
  const prefix=g+':';
  const users=this.store.db.prepare('SELECT id,amount FROM balances WHERE substr(id,1,?)=?').all(prefix.length,prefix).map(u=>({id:u.id.slice(prefix.length),cash:u.amount,bank:0,total:u.amount}));
  users.sort((a,b)=>b[sort]-a[sort]||a.id.localeCompare(b.id));
  return {users:users.slice((page-1)*10,page*10),page,totalPages:Math.max(1,Math.ceil(users.length/10))};
 }

}
