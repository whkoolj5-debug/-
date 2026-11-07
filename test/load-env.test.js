import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const moduleUrl=new URL('../src/load-env.js',import.meta.url).href;
function run(dir,script,env={}){
 return spawnSync(process.execPath,['--input-type=module','-e',`import {loadLocalEnv} from ${JSON.stringify(moduleUrl)};${script}`],{cwd:dir,env:{...process.env,...env},encoding:'utf8'});
}
test('native .env loading reads quoted values and comments without dotenv',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'rsf-env-'));
 try{
  writeFileSync(path.join(dir,'.env'),'RSF_TEST_NATIVE_ENV="hello world"\nRSF_TEST_NATIVE_NUMBER=42 # comment\n');
  const r=run(dir,"console.log(JSON.stringify([process.env.RSF_TEST_NATIVE_ENV,process.env.RSF_TEST_NATIVE_NUMBER]));");
  assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),['hello world','42']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('host-injected environment values are not overwritten by the local file',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'rsf-env-'));
 try{
  writeFileSync(path.join(dir,'.env'),'RSF_TEST_NATIVE_PRECEDENCE=file-value\n');
  const r=run(dir,'console.log(process.env.RSF_TEST_NATIVE_PRECEDENCE);',{RSF_TEST_NATIVE_PRECEDENCE:'host-value'});
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'host-value');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('missing .env is allowed when a hosting platform supplies environment variables',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'rsf-env-'));
 try{const r=run(dir,'console.log(loadLocalEnv());');assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'false');}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('unexpected .env read failures are not hidden and do not print file contents',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'rsf-env-'));
 try{
  mkdirSync(path.join(dir,'env-directory'));
  const r=run(dir,"try{loadLocalEnv('env-directory');process.exit(2);}catch(e){console.log(e.message);}");
  assert.equal(r.status,0,r.stderr);assert(r.stdout.includes('Could not read the local .env file'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
