import Decimal from 'decimal.js';
export const VERSION = 1;
export const CHECKLIST = ['Current balance sheet and income statement', 'WIP schedule reconciled with the books', 'Receivables and payables aging', 'Debt schedule and available credit', 'Contract, bid date and required bond forms', 'Explanation of losses, underbillings and estimate changes'];
export const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
export const blankJob = () => ({ name: '', contract: '', cost: '', estimate: '', billed: '' });
export function createPlan(example = false) {
  return { version: VERSION, company: example ? 'Example · Oak & Iron Contracting' : '', date: new Date().toLocaleDateString('en-CA'), example,
    opening: example ? 95000 : '', reserve: example ? 25000 : '', delay: 2, overrun: 10,
    weeks: Array.from({ length: 13 }, (_, i) => ({ receipts: example ? [15000,25000,55000,10000,30000,65000,20000,30000,60000,25000,35000,65000,45000][i] : '', costs: example ? 27000 : '', overhead: example ? 4500 : '' })),
    jobs: example ? [{ name: 'Riverside school', contract: 400000, cost: 180000, estimate: 320000, billed: 200000 }, { name: 'Westside fit-out', contract: 250000, cost: 130000, estimate: 265000, billed: 145000 }] : [blankJob()],
    checked: [], notes: '' };
}
const hasCentPrecision = v => {
  try { return new Decimal(typeof v === 'string' ? v.trim() : v).decimalPlaces() <= 2; }
  catch { return false; }
};
const validNumber = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1e12;
export function validatePlan(p) {
  if (!p || p.version !== VERSION || !Array.isArray(p.weeks) || p.weeks.length !== 13 || !Array.isArray(p.jobs) || p.jobs.length > 100 || typeof p.company !== 'string' || p.company.length > 200 || typeof p.notes !== 'string' || p.notes.length > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || ![0,1,2,3,4].includes(Number(p.delay)) || !validNumber(p.overrun) || Number(p.overrun) > 50 || !Array.isArray(p.checked) || p.checked.some(x => !Number.isInteger(x) || x < 0 || x >= CHECKLIST.length)) throw new Error('This is not a supported BondSBA plan. Import a JSON backup exported from this workspace.');
  const values = [p.opening,p.reserve,...p.weeks.flatMap(w => [w.receipts,w.costs,w.overhead]),...p.jobs.flatMap(j => [j.contract,j.cost,j.estimate,j.billed])];
  if (values.some(v => v !== '' && !validNumber(v)) || p.jobs.some(j => typeof j.name !== 'string' || j.name.length > 200)) throw new Error('The plan contains invalid values. Amounts must be between zero and one trillion.');
  if(p.wipControls!==undefined) {
    const c=p.wipControls;
    if(!c || typeof c.source!=='string' || c.source.length>200 || [c.cost,c.billed].some(v=>v!==''&&!validNumber(v))) throw new Error('Invalid WIP report totals or source note.');
  }
  return p;
}
export function forecast(p, stressed = false) {
  const delay = stressed ? Number(p.delay) : 0;
  let balance = Number(p.opening);
  const rows = p.weeks.map((w,i) => {
    const receipts = i >= delay ? Number(p.weeks[i-delay].receipts) : 0;
    const costs = Number(w.costs) * (stressed ? 1 + Number(p.overrun)/100 : 1);
    const overhead = Number(w.overhead);
    balance = Math.round((balance + receipts - costs - overhead) * 100) / 100;
    return { week: i+1, receipts, costs, overhead, balance };
  });
  const min = Math.min(Number(p.opening), ...rows.map(r=>r.balance));
  return { rows, min, gap: Math.max(0,Number(p.reserve)-min), firstBelow: Number(p.opening) < Number(p.reserve) ? 0 : rows.find(r=>r.balance < Number(p.reserve))?.week ?? null, deferred: delay ? p.weeks.slice(-delay).reduce((s,w)=>s+Number(w.receipts),0) : 0 };
}
export function wip(job) {
  if (![job.contract,job.cost,job.estimate,job.billed].every(validNumber)) return { error: 'Enter all four amounts (use 0 when appropriate).' };
  const [contract,cost,estimate,billed] = [job.contract,job.cost,job.estimate,job.billed].map(Number);
  if (!contract || !estimate) return { error: 'Contract value and estimated total cost must be above zero.' };
  if (cost > estimate) return { error: 'Cost to date exceeds the total cost estimate. Update the estimate first.' };
  const complete = cost/estimate, earned = contract*complete;
  return { complete, earned, under: Math.max(0,earned-billed), over: Math.max(0,billed-earned), remaining: estimate-cost, profit: contract-estimate, margin: (contract-estimate)/contract, backlog: contract-earned, aboveContract: billed > contract };
}
export const isCashComplete = p => [p.opening,p.reserve,...p.weeks.flatMap(w=>[w.receipts,w.costs,w.overhead])].every(validNumber);
export function cashCsv(p) {
  const base = forecast(p), stress = forecast(p,true);
  return 'Week,Expected receipts,Direct costs,Overhead and debt,Base ending cash,Stressed receipts,Stressed direct costs,Stressed ending cash\n' + base.rows.map((r,i)=>[r.week,r.receipts,r.costs,r.overhead,r.balance,stress.rows[i].receipts,stress.rows[i].costs,stress.rows[i].balance].map(n=>Number(n).toFixed(2)).join(',')).join('\n');
}

export function parseWeeklyPaste(text) {
  const rows = text.trim().split(/\r?\n/).filter(line=>line.trim());
  if (/week|receipt/i.test(rows[0] || '')) rows.shift();
  if (rows.length !== 13) throw new Error('Paste exactly 13 weekly rows. Each row needs receipts, direct costs and other outflows.');
  const tabSeparated = rows[0].includes('\t');
  return rows.map((line,i)=>{
    let cols=line.split(tabSeparated?'\t':',').map(s=>s.trim());
    if(cols.length===4) { if(Number(cols[0])!==i+1) throw new Error('Week numbers must run from 1 to 13.'); cols=cols.slice(1); }
    if(cols.length!==3) throw new Error(`Week ${i+1}: use three amount columns, with an optional first column for week numbers 1–13.`);
    const amounts=cols.map(value=>{
      // Only tabs make a grouping comma unambiguously part of a cell.
      const pattern=tabSeparated ? /^\$?\s*(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/;
      if(!pattern.test(value)) throw new Error(`Week ${i+1}: enter nonnegative amounts using a decimal point. Dollar signs and grouped commas are accepted only in tab-separated spreadsheet cells. Use 0 for no activity.`);
      const amount=Number(value.replace(/[$,\s]/g,''));
      if(!validNumber(amount)) throw new Error(`Week ${i+1}: amounts must be between zero and one trillion.`);
      return amount;
    });
    return {receipts:amounts[0],costs:amounts[1],overhead:amounts[2]};
  });
}

export function parseWipPaste(text) {
  const rows=text.split(/\r?\n/).filter(row=>row.trim());
  const header = (rows[0] || '').split('\t').map(cell=>cell.trim().toLowerCase().replace(/\s+/g,' '));
  if (/^job(?: name)?$/.test(header[0]) && /[a-z]/i.test(header[1] || '')) {
    const expected = [['job','job name'],['contract','contract value'],['cost to date'],['estimated total cost'],['billed to date']];
    if (header.length !== 5 || !expected.every((names,i)=>names.includes(header[i]))) throw new Error('Column headings must be in this order: Job name, Contract value, Cost to date, Estimated total cost, Billed to date. Use the blank template or reorder your columns.');
    rows.shift();
  }
  if(!rows.length || rows.length>100) throw new Error('Paste between 1 and 100 job rows.');
  return rows.map((row,i)=>{
    const cols=row.split('\t').map(s=>s.trim());
    if(cols.length!==5 || !cols[0] || cols[0].length>200) throw new Error(`Row ${i+1}: use a job name and four amount columns, separated by tabs.`);
    const values=cols.slice(1).map(v=>{
      if(!/^\$?\s*(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(v)) throw new Error(`Row ${i+1}: use nonnegative US amounts; enter 0 instead of a blank.`);
      const n=Number(v.replace(/[$,\s]/g,''));if(!hasCentPrecision(v.replace(/[$,\s]/g,''))) throw new Error(`Row ${i+1}: amounts must use whole cents (no fractions of a cent). Correct the spreadsheet before importing.`);if(!validNumber(n)) throw new Error(`Row ${i+1}: amount exceeds the supported range.`);return n;
    });
    const job={name:cols[0],contract:values[0],cost:values[1],estimate:values[2],billed:values[3]};
    const result=wip(job);if(result.error) throw new Error(`Row ${i+1}: ${result.error}`);
    return job;
  });
}
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
export function reconcileWip(jobs,controls={}) {
  const totals={cost:0,billed:0};let invalidRows=0;
  for(const job of jobs){
    if(wip(job).error) invalidRows++;
    for(const key of ['cost','billed']) if(validNumber(job[key]))totals[key]+=Number(job[key]);
  }
  totals.cost=cents(totals.cost);totals.billed=cents(totals.billed);
  const precisionIssue=jobs.some(job=>['cost','billed'].some(key=>validNumber(job[key])&&!hasCentPrecision(job[key]))) || ['cost','billed'].some(key=>validNumber(controls[key])&&!hasCentPrecision(controls[key]));
  const costDifference=validNumber(controls.cost)?cents(totals.cost-Number(controls.cost)):null;
  const billedDifference=validNumber(controls.billed)?cents(totals.billed-Number(controls.billed)):null;
  return {totals,invalidRows,precisionIssue,costDifference,billedDifference,matched:!precisionIssue && jobs.length>0 && invalidRows===0 && costDifference===0 && billedDifference===0};
}
export function wipCsv(plan) {
  const quote=value=>{let s=String(value??'');if(typeof value==='string' && /^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const rows=[['Job','Contract value','Cost to date','Estimated total cost','Billed to date','Percent complete','Earned revenue','Underbilled','Overbilled','Estimated profit','Status']];
  for(const job of plan.jobs){const r=wip(job);rows.push([job.name,job.contract,job.cost,job.estimate,job.billed,r.error?'':cents(r.complete*100),r.error?'':cents(r.earned),r.error?'':cents(r.under),r.error?'':cents(r.over),r.error?'':cents(r.profit),r.error || (r.aboveContract?'Review: billings exceed contract':r.profit<0?'Review: estimated loss':'Calculated; not independently verified')]);}
  return rows.map(row=>row.map(quote).join(',')).join('\n');
}
