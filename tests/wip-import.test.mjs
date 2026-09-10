import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWipPaste,reconcileWip,wipCsv,createPlan,validatePlan} from '../src/cash-workspace/model.js';
const rows='Job name\tContract value\tCost to date\tEstimated total cost\tBilled to date\nSchool\t$400,000\t180,000.25\t320000\t200000.50\nFit-out\t250000\t130000\t265000\t145000';
test('formatted spreadsheet import preserves cents and rejects a bad batch',()=>{
 const jobs=parseWipPaste(rows);assert.equal(jobs.length,2);assert.equal(jobs[0].cost,180000.25);
 for(const suffix of ['Bad\t1\t2\t1\t0','Bad\t1\t\t1\t0','Bad\t1,20\t0\t1\t0'])assert.throws(()=>parseWipPaste(rows+'\n'+suffix),/Row 3/);
 assert.throws(()=>parseWipPaste(''),/between 1/);
 assert.throws(()=>parseWipPaste(Array(101).fill('A\t1\t0\t1\t0').join('\n')),/100/);
});
test('controls require two independent totals, all valid jobs and exact cents',()=>{
 const jobs=parseWipPaste(rows);const controls={cost:310000.25,billed:345000.50};
 assert.equal(reconcileWip(jobs).matched,false);assert.equal(reconcileWip(jobs,controls).matched,true);
 assert.equal(reconcileWip(jobs,{...controls,cost:310000.24}).costDifference,.01);
 assert.equal(reconcileWip([{...jobs[0],estimate:0}],{cost:180000.25,billed:200000.50}).matched,false);
 assert.equal(reconcileWip([],{cost:0,billed:0}).matched,false);
});
test('old backups work and new controls validate',()=>{
 const p=createPlan(true);assert.equal(validatePlan(p),p);
 p.wipControls={source:'August ledger',cost:310000.25,billed:''};assert.equal(validatePlan(p),p);
 p.wipControls.cost=-1;assert.throws(()=>validatePlan(p),/WIP report/);
});
test('CSV escapes job names and retains numeric losses with warnings',()=>{
 const jobs=parseWipPaste(rows);jobs[1].name='=SUM(1,2)';
 const csv=wipCsv({jobs});assert.match(csv,/"'=SUM\(1,2\)"/);assert.match(csv,/"-15000"/);assert.match(csv,/Review: estimated loss/);
 jobs[0].estimate=0;assert.match(wipCsv({jobs}),/must be above zero/);
});
