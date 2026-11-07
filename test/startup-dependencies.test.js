import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensureDependencies} from '../src/startup-dependencies.js';
test('healthy runtime never reinstalls packages',()=>{
 let repaired=false;assert.deepEqual(ensureDependencies({check:()=>true,repair:()=>{repaired=true;},log:()=>{}}),{repaired:false});assert.equal(repaired,false);
});
test('missing dependency is installed once and must load before bot startup',()=>{
 let checks=0,repairs=0;const logs=[];
 assert.deepEqual(ensureDependencies({check:()=>++checks>1,repair:()=>{repairs++;return true;},log:s=>logs.push(s)}),{repaired:true});assert.equal(checks,2);assert.equal(repairs,1);assert.equal(logs.length,2);
});
test('installation errors and still-broken native packages stop startup without a repair loop',()=>{
 let repairs=0;assert.throws(()=>ensureDependencies({check:()=>false,repair:()=>{repairs++;return false;},log:()=>{}}),/설치 실패/);assert.equal(repairs,1);
 repairs=0;assert.throws(()=>ensureDependencies({check:()=>false,repair:()=>{repairs++;return true;},log:()=>{}}),/로딩 실패/);assert.equal(repairs,1);
});
