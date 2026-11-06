import 'dotenv/config';
import {REST,Routes} from 'discord.js';
import {commands} from './commands.js';
for(const k of ['DISCORD_TOKEN','CLIENT_ID','GUILD_ID'])if(!process.env[k])throw Error(`${k}를 .env에 설정해주세요.`);
await new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body:commands});
console.log('명령어 등록 완료');
