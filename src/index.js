// This entry point intentionally imports only Node built-ins before repairing dependencies.
import {ensureDependencies} from './startup-dependencies.js';
try{
 ensureDependencies();
 if(process.argv.includes('--check-dependencies'))console.log('[RSF startup] 필수 라이브러리 검사 통과.');
 else await import('./bot.js');
}catch(error){
 console.error(error.message);
 process.exitCode=1;
}
