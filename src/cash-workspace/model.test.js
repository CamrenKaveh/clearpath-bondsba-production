import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, forecast, wip, validatePlan, isCashComplete, cashCsv, parseWeeklyPaste } from './model.js';
test('forecast preserves receipts, moves delays outside horizon, and never invents financing',()=>{
 const p=createPlan(true); p.delay=2; p.overrun=0;
 const base=forecast(p), stress=forecast(p,true);
 assert.equal(base.rows[0].balance,78500);
 assert.equal(stress.rows[0].receipts,0);
 assert.equal(stress.rows[2].receipts,15000);
 assert.equal(stress.deferred,110000);
 assert.equal(base.rows.at(-1).balance-stress.rows.at(-1).balance,110000);
});
test('direct-cost shock excludes overhead, includes opening reserve shortfall',()=>{
 const p=createPlan(true); p.delay=0;p.overrun=10;
 assert.equal(forecast(p,true).rows[0].costs,29700.000000000004);
 assert.equal(forecast(p,true).rows[0].overhead,4500);
 p.opening=0;p.reserve=25000;assert.equal(forecast(p,true).firstBelow,0);
});
test('zero shock exactly equals base and blank data is incomplete',()=>{
 const p=createPlan(true);p.delay=0;p.overrun=0;assert.deepEqual(forecast(p).rows,forecast(p,true).rows);
 assert.equal(isCashComplete(createPlan()),false);assert.equal(isCashComplete(p),true);
});
test('WIP cost-to-cost, loss jobs, and invalid estimates',()=>{
 assert.equal(wip({contract:400000,cost:180000,estimate:320000,billed:200000}).under,25000);
 assert.equal(wip({contract:100,cost:50,estimate:125,billed:50}).profit,-25);
 assert.match(wip({contract:100,cost:101,estimate:100,billed:50}).error,/exceeds/);
 assert.ok(wip({contract:100,cost:'',estimate:100,billed:50}).error);
 assert.ok(wip({contract:0,cost:0,estimate:0,billed:0}).error);
});
test('backups validate and spreadsheet CSV has thirteen weeks',()=>{
 const p=createPlan(true);assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);
 assert.throws(()=>validatePlan({...p, weeks:[]}));assert.throws(()=>validatePlan({...p,delay:-1}));assert.throws(()=>validatePlan({...p,opening:'NaN'}));
 assert.equal(cashCsv(p).split('\n').length,14);
});

test('spreadsheet paste accepts tabs and optional week numbers, rejects partial data',()=>{
 const rows=Array.from({length:13},(_,i)=>`${i+1}\t1000\t500\t100`).join('\n');
 assert.deepEqual(parseWeeklyPaste(rows)[12],{receipts:1000,costs:500,overhead:100});
 assert.throws(()=>parseWeeklyPaste('1,100,200,300'));
 assert.throws(()=>parseWeeklyPaste(Array(13).fill('abc,100,200').join('\n')));
 assert.throws(()=>validatePlan({...createPlan(true),opening:true}));
});

test('formatted spreadsheet cells preserve cents and reject ambiguous amounts',()=>{
 const rows=Array.from({length:13},(_,i)=>`${i+1}\t$20,000.00\t$12,500\t$1,250.50`).join('\n');
 assert.deepEqual(parseWeeklyPaste('Week\tReceipts\tDirect costs\tOther outflows\n'+rows)[12],{receipts:20000,costs:12500,overhead:1250.5});
 for(const value of ['$20,00','1.234,56','(100)','-100','', '$','1e4','1000000000001']) {
  assert.throws(()=>parseWeeklyPaste(Array(13).fill(`${value}\t500\t100`).join('\n')),value);
 }
 assert.throws(()=>parseWeeklyPaste(Array(13).fill('$20,000.00,500,100').join('\n')));
 assert.deepEqual(parseWeeklyPaste(Array(13).fill('20000.25,500,100').join('\n'))[0],{receipts:20000.25,costs:500,overhead:100});
});
