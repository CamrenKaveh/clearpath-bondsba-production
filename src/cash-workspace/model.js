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
const validNumber = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1e12;
export function validatePlan(p) {
  if (!p || p.version !== VERSION || !Array.isArray(p.weeks) || p.weeks.length !== 13 || !Array.isArray(p.jobs) || p.jobs.length > 100 || typeof p.company !== 'string' || p.company.length > 200 || typeof p.notes !== 'string' || p.notes.length > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || ![0,1,2,3,4].includes(Number(p.delay)) || !validNumber(p.overrun) || Number(p.overrun) > 50 || !Array.isArray(p.checked) || p.checked.some(x => !Number.isInteger(x) || x < 0 || x >= CHECKLIST.length)) throw new Error('This is not a supported BondSBA plan. Import a JSON backup exported from this workspace.');
  const values = [p.opening,p.reserve,...p.weeks.flatMap(w => [w.receipts,w.costs,w.overhead]),...p.jobs.flatMap(j => [j.contract,j.cost,j.estimate,j.billed])];
  if (values.some(v => v !== '' && !validNumber(v)) || p.jobs.some(j => typeof j.name !== 'string' || j.name.length > 200)) throw new Error('The plan contains invalid values. Amounts must be between zero and one trillion.');
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
