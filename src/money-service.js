const MAX_AMOUNT=2147483647;
export function moneyAmount(input){
 if(typeof input!=='string'||!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(input))throw Error('Enter a positive whole amount, e.g. 10000 or 10,000');
 const n=Number(input.replaceAll(',',''));
 if(!Number.isSafeInteger(n)||n>MAX_AMOUNT)throw Error(`Each transaction amount must be 1–${MAX_AMOUNT.toLocaleString('ko-KR')}`);
 return n;
}
// Intent + per-leg transfer IDs survive restart. Ambiguous external writes are never retried automatically.
export class MoneyService{
 constructor(store,economy){this.store=store;this.economy=economy;}
 get(id){const row=this.store.db.prepare('SELECT json FROM money_commands WHERE id=?').get(id);return row?JSON.parse(row.json):null;}
 save(op){this.store.db.prepare('INSERT OR REPLACE INTO money_commands VALUES(?,?)').run(op.id,JSON.stringify(op));return op;}
 pending(guild){return this.store.db.prepare('SELECT json FROM money_commands').all().map(r=>JSON.parse(r.json)).filter(o=>o.guild===guild&&o.state==='pending');}
 async execute({id,guild,actor,target,kind,input},retry=false){
  let op=this.get(id);
  if(op){
   if(op.guild!==guild||op.actor!==actor||op.target!==target||op.kind!==kind)throw Error('This transaction ID belongs to a different request.');
   if(op.state==='done')return op;
   if(op.state==='failed')throw Error('This request failed without applying. Check the balance and send a new command.');
   if(!retry)throw Error(`Transaction ${id} needs review. Ask an administrator to check !money-pending.`);
  }else{
   if(kind==='pay'&&actor===target)throw Error('You cannot pay yourself.');
   let amount;
   if(input==='all'){
    if(kind==='grant')throw Error('For admin grants, enter a numeric amount instead of all.');
    const user=kind==='pay'?actor:target,b=await this.economy.balance(guild,user);amount=b.balance;
    if(!Number.isSafeInteger(amount)||amount<=0||amount>MAX_AMOUNT)throw Error('No positive balance to process, or the amount exceeds the per-transaction limit.');
   }else amount=moneyAmount(input);
   if(!['pay','grant','remove'].includes(kind))throw Error('Unsupported money operation.');
   op=this.save({id,guild,actor,target,kind,amount,state:'pending',createdAt:Date.now()});
  }
  const legs=op.kind==='pay'?[{id:`${id}:out`,user:actor,amount:-op.amount},{id:`${id}:in`,user:target,amount:op.amount}]:[{id:`${id}:change`,user:target,amount:op.kind==='grant'?op.amount:-op.amount}];
  // Do not begin a new mutation while another uncertain write affects the same accounts.
  const users=new Set(legs.map(l=>l.user));
  const own=new Set(legs.map(l=>l.id));
  const blocked=this.store.pending().find(tx=>tx.guild===guild&&users.has(tx.user)&&!own.has(tx.id));
  if(blocked)throw Error(`Uncertain transaction ${blocked.id} must be reviewed first.`);
  try{
   if(this.economy.mode==='test'){
    for(const leg of legs)await this.economy.balance(guild,leg.user);
    this.store.db.exec('BEGIN IMMEDIATE');
    try{
     for(const leg of legs){
      const prior=this.store.transfer(leg.id);if(prior?.status==='done')continue;
      const balance=this.store.db.prepare('SELECT amount FROM balances WHERE id=?').get(`${guild}:${leg.user}`).amount;
      if(balance+leg.amount<0)throw Error('Insufficient balance.');
      if(!Number.isSafeInteger(balance+leg.amount))throw Error('The resulting balance exceeds the safe numeric range.');
      this.store.begin(leg.id,guild,leg.user,leg.amount);
      this.store.db.prepare('UPDATE balances SET amount=amount+? WHERE id=?').run(leg.amount,`${guild}:${leg.user}`);
      this.store.mark(leg.id,'done',`${op.kind}; actor=${actor}; command=${id}`);
     }
     op.state='done';this.save(op);this.store.db.exec('COMMIT');
    }catch(error){this.store.db.exec('ROLLBACK');throw error;}
   }else{
    for(const leg of legs)await this.economy.move(leg.id,guild,leg.user,leg.amount);
    op.state='done';this.save(op);
   }
   return op;
  }catch(error){
   const statuses=legs.map(l=>this.store.transfer(l.id)?.status);
   op.state=statuses.some(s=>s==='done'||s==='pending')?'pending':'failed';this.save(op);
   if(op.state==='pending')throw Error(`Transaction ${id} is pending review. Do not repeat the payment. Administrators: check !money-pending.`);
   throw error;
  }
 }
 async retry(id,guild){
  const op=this.get(id);if(!op||op.guild!==guild)throw Error('This transaction does not belong to this server.');
  return this.execute({...op,input:String(op.amount)},true);
 }
}
