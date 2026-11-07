import 'dotenv/config';
import {REST,Routes} from 'discord.js';
import {commands} from './commands.js';
import {readConfig} from './config.js';
const config=readConfig();
try{
 await new REST({version:'10',timeout:15000,retries:0}).setToken(config.token).put(Routes.applicationGuildCommands(config.clientId,config.guildId),{body:commands});
 console.log('명령어 등록 완료');
}catch(error){
 console.error(`명령어 등록 실패${error.status?` (HTTP ${error.status})`:''}. npm run check:discord로 토큰/서버/네트워크를 확인해주세요.`);
 process.exitCode=1;
}
