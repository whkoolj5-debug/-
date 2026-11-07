import {loadEnvFile} from 'node:process';
// Use Node's built-in .env parser. Existing host-injected environment variables keep precedence.
export function loadLocalEnv(file='.env'){
 try{loadEnvFile(file);return true;}
 catch(error){
  if(error.code==='ENOENT')return false;
  throw Error(`Could not read the local .env file (${error.code||'configuration error'}). Check the file and its permissions. Do not share its contents.`);
 }
}
loadLocalEnv();
