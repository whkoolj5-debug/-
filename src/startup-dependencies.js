import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
export const applicationRoot=fileURLToPath(new URL('../',import.meta.url));
const probeCode="await import('discord.js'); const {default:sharp}=await import('sharp'); await sharp({create:{width:1,height:1,channels:3,background:'#000'}}).png().toBuffer();";
function probe(){
 return spawnSync(process.execPath,['--input-type=module','-e',probeCode],{cwd:applicationRoot,stdio:'ignore',timeout:30000}).status===0;
}
function install(){
 const args=['ci','--omit=dev','--include=optional','--ignore-scripts','--no-audit','--no-fund'];
 const npmPath=process.env.npm_execpath;
 const command=npmPath?process.execPath:process.platform==='win32'?'npm.cmd':'npm';
 const result=spawnSync(command,npmPath?[npmPath,...args]:args,{cwd:applicationRoot,env:{...process.env,npm_config_cache:process.env.npm_config_cache||join(tmpdir(),'rsf-npm-cache')},stdio:'inherit',timeout:180000,shell:!npmPath&&process.platform==='win32'});
 return result.status===0&&!result.error;
}
export function ensureDependencies({check=probe,repair=install,log=console.log}={}){
 if(check())return {repaired:false};
 log('[RSF startup] 필수 라이브러리가 없거나 손상되어 package-lock.json 기준으로 복구합니다.');
 if(!repair())throw Error('라이브러리 설치 실패. 호스팅의 패키지 설치 권한과 네트워크를 확인하고 다시 시작해주세요.');
 if(!check())throw Error('라이브러리 복구 후 로딩 실패. 호스팅의 Node.js 버전 및 네이티브 패키지 지원을 확인해주세요.');
 log('[RSF startup] discord.js / sharp 복구 완료. 봇을 시작합니다.');
 return {repaired:true};
}
