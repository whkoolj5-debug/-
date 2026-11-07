// Validate before opening the database or starting network listeners.
export function readConfig(env=process.env){
 const required=key=>{const value=env[key]?.trim();if(!value)throw Error(`${key}를 로컬 .env에 설정해주세요. 토큰은 채팅에 보내지 마세요.`);return value;};
 const id=key=>{const value=required(key);if(!/^\d{17,20}$/.test(value))throw Error(`${key}는 디스코드의 숫자 ID여야 합니다.`);return value;};
 const integer=(key,fallback,min,max)=>{const value=env[key]?.trim()||String(fallback);const n=Number(value);if(!/^\d+$/.test(value)||!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${key}는 ${min}~${max} 정수여야 합니다.`);return n;};
 const mode=env.ECONOMY_MODE?.trim()||'test';
 if(!['test','live'].includes(mode))throw Error('ECONOMY_MODE는 test 또는 live여야 합니다.');
 const autoContent=env.AUTO_ENABLE_MESSAGE_CONTENT?.trim().toLowerCase()||'true';
 if(!['true','false'].includes(autoContent))throw Error('AUTO_ENABLE_MESSAGE_CONTENT must be true or false.');
 const token=required('DISCORD_TOKEN');
 const clientId=id('CLIENT_ID'),guildId=id('GUILD_ID');
 const economyToken=mode==='live'?required('UNBELIEVABOAT_API_KEY'):env.UNBELIEVABOAT_API_KEY?.trim();
 return {autoEnableMessageContent:autoContent==='true',token,clientId,guildId,mode,economyToken,databasePath:env.DATABASE_PATH?.trim()||'data/poker.sqlite',turnSeconds:integer('TURN_SECONDS',90,1,86400),port:integer('PORT',3000,1,65535)};
}
