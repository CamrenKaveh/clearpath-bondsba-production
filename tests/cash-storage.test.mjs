import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan } from '../src/cash-workspace/model.js';
import { savePlan } from '../src/cash-workspace/storage.js';

function store(initial, fail=false) {
  let value=initial;
  return { getItem:()=>value, setItem:(_key,next)=>{if(fail)throw new Error('Storage full');value=next;} };
}
for (const old of ['{broken', '{}', '']) {
  test(`cancel preserves unreadable copy: ${old}`,()=>{
    const storage=store(old);
    assert.equal(savePlan(storage,'plan',createPlan(true),()=>false).saved,false);
    assert.equal(storage.getItem(),old);
  });
  test(`confirmed replacement recovers: ${old}`,()=>{
    const storage=store(old), plan=createPlan(true);
    assert.deepEqual(savePlan(storage,'plan',plan,()=>true),{saved:true,previous:null});
    assert.deepEqual(JSON.parse(storage.getItem()),plan);
  });
}
test('valid previous plan is returned only after successful save',()=>{
  const old=createPlan(true), plan={...old,company:'New'};
  const storage=store(JSON.stringify(old));
  assert.deepEqual(savePlan(storage,'plan',plan,()=>{throw Error('Unexpected prompt');}).previous,old);
  assert.equal(JSON.parse(storage.getItem()).company,'New');
});
test('failed write preserves old data and throws',()=>{
  const storage=store('{broken',true);
  assert.throws(()=>savePlan(storage,'plan',createPlan(true),()=>true),/Storage full/);
  assert.equal(storage.getItem(),'{broken');
});
test('invalid current plan never touches storage or asks to replace',()=>{
  let reads=0, prompts=0;
  assert.throws(()=>savePlan({getItem:()=>{reads++;return null;}},'plan',{},()=>{prompts++;return true;}));
  assert.equal(reads,0);
  assert.equal(prompts,0);
});
test('first save requires no replacement prompt',()=>{
  const storage=store(null);
  assert.equal(savePlan(storage,'plan',createPlan(true),()=>{throw Error('Unexpected prompt');}).saved,true);
});
