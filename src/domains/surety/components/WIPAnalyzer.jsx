// WIP Intelligence Analyzer
import { LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, AlertTriangle, CheckCircle2, Plus, Trash2, ShieldAlert, TrendingUp, Activity } from 'lucide-react';
import { useMemo, useState } from 'react';

const SAMPLE_JOBS = [
  { id: 1, name: 'Commercial Building A', totalValue: 2500000, spent: 1800000, earned: 2200000, status: 'In Progress' },
  { id: 2, name: 'Highway Expansion B', totalValue: 3500000, spent: 2100000, earned: 2000000, status: 'At Risk' },
  { id: 3, name: 'Parking Structure C', totalValue: 1200000, spent: 950000, earned: 1100000, status: 'On Track' },
];
const STATUS_COLORS = {
  'On Track': 'border-green-200 bg-green-50 text-green-800',
  'At Risk': 'border-red-200 bg-red-50 text-red-800',
  'In Progress': 'border-blue-200 bg-blue-50 text-blue-800',
};
const SIG_COLORS = {
  Elevated: 'border-red-200 bg-red-50',
  'Needs Review': 'border-amber-200 bg-amber-50',
  Moderate: 'border-amber-100 bg-amber-50/60',
  Low: 'border-green-200 bg-green-50',
  'N/A': 'border-slate-200 bg-slate-50',
  Review: 'border-slate-200 bg-slate-50',
};

export function WIPAnalyzer({ onBack }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [newJob, setNewJob] = useState({ name: '', totalValue: '', spent: '', earned: '', status: 'In Progress' });
  const usd = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pct = (v) => (v * 100).toFixed(1);
  const toNum = (val) => Number(String(val).replace(/[^0-9.-]/g, '')) || 0;
  const handleChange = (e) => setNewJob((c) => ({ ...c, [e.target.name]: e.target.value }));
  const handleAdd = (e) => {
    e.preventDefault();
    const job = { id: Date.now(), name: newJob.name.trim() || ('Job ' + (jobs.length + 1)), totalValue: toNum(newJob.totalValue), spent: toNum(newJob.spent), earned: toNum(newJob.earned), status: newJob.status };
    if (job.totalValue <= 0) return;
    setJobs((c) => [...c, job]);
    setSelectedJob(job.id);
    setNewJob({ name: '', totalValue: '', spent: '', earned: '', status: 'In Progress' });
  };
  const handleRemove = (id) => { setJobs((c) => c.filter((j) => j.id !== id)); if (selectedJob === id) setSelectedJob(null); };
  const loadSamples = () => { setJobs(SAMPLE_JOBS); setSelectedJob(SAMPLE_JOBS[0].id); };
  const totalSpent = jobs.reduce((s, j) => s + j.spent, 0);
  const totalEarned = jobs.reduce((s, j) => s + j.earned, 0);
  const totalValue = jobs.reduce((s, j) => s + j.totalValue, 0);
  const totalUnearned = Math.max(totalValue - totalEarned, 0);
  const atRiskCount = jobs.filter((j) => j.status === 'At Risk').length;
  const marginRiskCount = jobs.filter((j) => j.earned > 0 && (j.earned - j.spent) / j.earned < 0.05).length;
  const concentrationShare = totalValue > 0 ? Math.max(...jobs.map((j) => j.totalValue / totalValue), 0) : 0;
  const underbillingCount = jobs.filter((j) => j.spent > j.earned).length;
  const overbillingCount = jobs.filter((j) => j.earned > j.spent * 1.12).length;
  const avgMarginPct = useMemo(() => {
    if (!jobs.length) return 0;
    return jobs.map((j) => (j.earned > 0 ? ((j.earned - j.spent) / j.earned) * 100 : 0)).reduce((s, m) => s + m, 0) / jobs.length;
  }, [jobs]);
  const wipQualityScore = useMemo(() => {
    if (!jobs.length) return 0;
    const p = concentrationShare > 0.5 ? 15 : concentrationShare > 0.4 ? 8 : 0;
    return Math.max(0, Math.min(100, Math.round(100 - p - underbillingCount * 8 - marginRiskCount * 6)));
  }, [concentrationShare, marginRiskCount, underbillingCount, jobs.length]);
  const operationalRiskScore = useMemo(() => {
    if (!jobs.length) return 0;
    const rc = concentrationShare >= 0.5 ? 20 : concentrationShare >= 0.35 ? 10 : 0;
    return Math.max(0, Math.min(100, Math.round(20 + atRiskCount * 18 + rc + underbillingCount * 10)));
  }, [atRiskCount, concentrationShare, underbillingCount, jobs.length]);
  const capacityStress = useMemo(() => {
    if (!jobs.length) return 'N/A';
    if (operationalRiskScore >= 75 || concentrationShare >= 0.55) return 'High';
    if (operationalRiskScore >= 50 || concentrationShare >= 0.4) return 'Moderate';
    return 'Low';
  }, [concentrationShare, jobs.length, operationalRiskScore]);
  const profLabel = useMemo(() => {
    if (!jobs.length) return 'Unknown';
    if (avgMarginPct < 5) return 'Deteriorating';
    if (avgMarginPct < 10) return 'Watchlist';
    return 'Stable';
  }, [jobs.length, avgMarginPct]);
  const reviewFlags = jobs.length > 0 ? [
    atRiskCount > 0 ? (atRiskCount + ' job' + (atRiskCount !== 1 ? 's' : '') + ' flagged at-risk - first in follow-up order.') : 'No jobs tagged at risk. File can move into margin and concentration review.',
    marginRiskCount > 0 ? (marginRiskCount + ' job' + (marginRiskCount !== 1 ? 's' : '') + ' show thin margins below 5% - increases fade sensitivity.') : 'No thin-margin pressure below 5% threshold detected.',
    concentrationShare >= 0.5 ? ('Top job is ' + pct(concentrationShare) + '% of contract value - concentration deserves direct underwriter follow-up.') : 'No single job dominates the WIP mix - concentration pressure is low.',
  ] : [];
  const mk = (s, no, d, a) => (!jobs.length ? { status: 'N/A', detail: no, action: 'Add WIP jobs.' } : s === 0 ? { status: 'Low', detail: d[0], action: a[0] } : s === 1 ? { status: 'Moderate', detail: d[1], action: a[1] } : { status: s < 0 ? 'Needs Review' : 'Elevated', detail: d[2], action: a[2] });
  const fadeSignal = useMemo(() => !jobs.length ? { status: 'N/A', detail: 'Add jobs to evaluate margin fade.', action: 'Upload WIP.' } : (marginRiskCount >= 2 || avgMarginPct < 6) ? { status: 'Moderate', detail: (marginRiskCount || 1) + ' job(s) show gross margin deterioration.', action: 'Review cost-to-complete assumptions.' } : { status: 'Low', detail: 'No major margin fade signals detected.', action: 'Confirm assumptions during routine review.' }, [jobs.length, marginRiskCount, avgMarginPct]);
  const underbillSignal = useMemo(() => !jobs.length ? { status: 'N/A', detail: 'No data.', action: 'Add jobs.' } : underbillingCount >= 2 ? { status: 'Elevated', detail: 'Underbillings concentrated in active projects.', action: 'Review cash conversion and billing timing.' } : underbillingCount === 1 ? { status: 'Moderate', detail: 'One job shows underbilling pressure.', action: 'Validate billing support.' } : { status: 'Low', detail: 'No material underbilling pressure.', action: 'Maintain standard monitoring.' }, [jobs.length, underbillingCount]);
  const overbillSignal = useMemo(() => !jobs.length ? { status: 'N/A', detail: 'No data.', action: 'Add jobs.' } : overbillingCount >= 2 ? { status: 'Needs Review', detail: 'Multiple jobs show potential overbilling exposure.', action: 'Verify earned-to-billed alignment.' } : overbillingCount === 1 ? { status: 'Moderate', detail: 'One job may have overbilling exposure.', action: 'Confirm percent-complete assumptions.' } : { status: 'Low', detail: 'No obvious overbilling exposure.', action: 'Keep monitoring.' }, [jobs.length, overbillingCount]);
  const concSignal = useMemo(() => !jobs.length ? { status: 'N/A', detail: 'No data.', action: 'Add jobs.' } : concentrationShare >= 0.5 ? { status: 'Needs Review', detail: 'Top job is ' + pct(concentrationShare) + '% of entered value.', action: 'Review dependency and capacity exposure.' } : { status: 'Low', detail: 'Backlog concentration appears diversified.', action: 'Maintain normal monitoring.' }, [jobs.length, concentrationShare]);
  const signals = [['Margin Fade', fadeSignal], ['Underbilling Stress', underbillSignal], ['Overbilling Exposure', overbillSignal], ['Backlog Concentration', concSignal]];
  const chartData = jobs.map((j) => ({ name: j.name.length > 14 ? j.name.slice(0, 14) + '...' : j.name, costs: j.spent, earned: j.earned }));

  const chipColor = (s) => s === 'Elevated' ? 'bg-red-100 border-red-300 text-red-700' : s === 'Needs Review' ? 'bg-amber-100 border-amber-300 text-amber-700' : s === 'Moderate' ? 'bg-amber-50 border-amber-200 text-amber-600' : s === 'Low' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-500';
  const trendColor = profLabel === 'Deteriorating' ? 'text-red-700' : profLabel === 'Watchlist' ? 'text-amber-700' : 'text-green-700';

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-amber-200 shadow-sm">
        <div className="bg-[#0A2540] px-5 py-3 flex items-center gap-3">
          <button onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">WIP Analysis</p>
            <h1 className="text-[16px] font-bold text-white leading-snug">WIP Intelligence</h1>
          </div>
          <Activity className="ml-auto h-6 w-6 text-amber-400 opacity-80" />
        </div>
        <div className="bg-amber-50 border-t border-amber-200 px-5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-0.5">What this helps you catch</p>
          <p className="text-[12px] text-amber-900">Surface WIP quality, margin fade, underbilling stress, and capacity risk before the file reaches underwriting.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'WIP Quality Score', value: jobs.length ? wipQualityScore : '—', hint: 'Higher = cleaner packet', color: jobs.length && wipQualityScore < 60 ? 'text-red-700' : 'text-slate-900' },
          { label: 'Operational Risk', value: jobs.length ? operationalRiskScore : '—', hint: 'Composite risk index', color: jobs.length && operationalRiskScore > 60 ? 'text-red-700' : 'text-slate-900' },
          { label: 'Capacity Stress', value: capacityStress, hint: 'Execution strain signal', color: capacityStress === 'High' ? 'text-red-700' : capacityStress === 'Moderate' ? 'text-amber-700' : 'text-green-700' },
          { label: 'Profitability Trend', value: profLabel, hint: jobs.length ? ('Avg margin ' + avgMarginPct.toFixed(1) + '%') : 'Add jobs', color: trendColor },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k.label}</p>
            <p className={'mt-1.5 text-[22px] font-bold tabular-nums leading-none ' + k.color}>{k.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total WIP Costs', value: usd(totalSpent), hint: 'Costs incurred to date' },
          { label: 'Earned Revenue', value: usd(totalEarned), hint: 'Billings recognized' },
          { label: 'Unearned WIP', value: usd(totalUnearned), hint: 'Remaining work to bill' },
          { label: 'At-Risk Jobs', value: atRiskCount, hint: atRiskCount > 0 ? 'Priority follow-up required' : 'No at-risk designations' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k.label}</p>
            <p className="mt-1.5 text-[18px] font-bold tabular-nums leading-none text-slate-800">{k.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{k.hint}</p>
          </div>
        ))}
      </div>

      {reviewFlags.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200">
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Review Flags</p>
          </div>
          {reviewFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3 border-b border-amber-100 last:border-0">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[13px] text-slate-700">{flag}</p>
            </div>
          ))}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {signals.map(([title, signal]) => (
            <div key={title} className={'rounded-xl border p-4 ' + (SIG_COLORS[signal.status] || 'border-slate-200 bg-white')}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
                <span className={'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ' + chipColor(signal.status)}>{signal.status}</span>
              </div>
              <p className="text-[12px] text-slate-700 leading-relaxed">{signal.detail}</p>
              {signal.action && <p className="mt-2 text-[11px] font-semibold text-slate-500">Next: {signal.action}</p>}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Add WIP Job</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Enter contract-level data to identify follow-up before submission.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadSamples} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-400 transition-colors">Load Samples</button>
            <button type="submit" disabled={!newJob.totalValue} className="flex items-center gap-1.5 rounded-lg bg-[#0A2540] px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-[#12365F] disabled:opacity-40 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Job
            </button>
          </div>
        </div>
        <div className="p-5 grid gap-3 md:grid-cols-6">
          <label className="md:col-span-2">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Job Name</span>
            <input name="name" value={newJob.name} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="Municipal Library" />
          </label>
          <label>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Contract Value</span>
            <input name="totalValue" inputMode="decimal" value={newJob.totalValue} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="2500000" required />
          </label>
          <label>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Costs to Date</span>
            <input name="spent" inputMode="decimal" value={newJob.spent} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="1500000" />
          </label>
          <label>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Earned Revenue</span>
            <input name="earned" inputMode="decimal" value={newJob.earned} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="1700000" />
          </label>
          <label>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Status</span>
            <select name="status" value={newJob.status} onChange={handleChange} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400">
              <option>In Progress</option><option>On Track</option><option>At Risk</option>
            </select>
          </label>
        </div>
      </form>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Jobs ({jobs.length})</p>
          </div>
          <div className="divide-y divide-slate-100">
            {!jobs.length && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                  <Activity className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-[13px] font-semibold text-slate-600">No jobs entered yet</p>
                <p className="mt-1 text-[11px] text-slate-400">Add contract data above or load sample jobs.</p>
              </div>
            )}
            {jobs.map((job) => {
              const progress = job.totalValue > 0 ? job.earned / job.totalValue : 0;
              const margin = job.earned > 0 ? ((job.earned - job.spent) / job.earned) * 100 : 0;
              const isSel = selectedJob === job.id;
              return (
                <button key={job.id} onClick={() => setSelectedJob(isSel ? null : job.id)} className={'w-full text-left px-5 py-4 transition-colors hover:bg-amber-50/30 ' + (isSel ? 'bg-amber-50 border-l-2 border-l-amber-500' : '')}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[13px] font-bold text-slate-900">{job.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ' + (STATUS_COLORS[job.status] || STATUS_COLORS['In Progress'])}>{job.status}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemove(job.id); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-500">{pct(progress)}% complete</span>
                      <span className={margin >= 5 ? 'font-bold text-green-700' : margin > 0 ? 'font-bold text-amber-600' : 'font-bold text-red-600'}>{margin.toFixed(1)}% margin</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={'h-full rounded-full transition-all ' + (margin >= 5 ? 'bg-green-500' : margin > 0 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: Math.min(progress * 100, 100) + '%' }} />
                    </div>
                  </div>
                  <p className="text-[12px] text-slate-500"><span className="font-semibold text-slate-700">{usd(job.earned)}</span> of {usd(job.totalValue)} earned</p>
                  {isSel && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[['Contract', usd(job.totalValue)], ['Costs', usd(job.spent)], ['Earned', usd(job.earned)]].map(([lbl, val]) => (
                        <div key={lbl} className="rounded-lg bg-white border border-amber-100 px-2 py-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600">{lbl}</p>
                          <p className="text-[12px] font-bold text-slate-900 tabular-nums">{val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {isSel && job.status === 'At Risk' && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-700"><AlertTriangle className="h-3 w-3" /> Contingent liability review recommended</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">WIP vs Earned Revenue</p>
          </div>
          <div className="p-5">
            {jobs.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => usd(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="costs" stroke="#ef4444" strokeWidth={2} name="Costs (WIP)" dot={{ r: 4, fill: '#ef4444' }} />
                  <Line type="monotone" dataKey="earned" stroke="#d97706" strokeWidth={2} name="Earned Revenue" dot={{ r: 4, fill: '#d97706' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center px-5">
                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                  <TrendingUp className="h-5 w-5 text-amber-400" />
                </div>
                <p className="text-[13px] font-semibold text-slate-600">Add jobs to render the WIP trend</p>
                <p className="mt-1 text-[11px] text-slate-400">Compare costs vs earned revenue across the portfolio.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#0A2540] px-5 py-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Bond Capacity Assessment</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13px] text-slate-700 leading-relaxed">
              Portfolio WIP of <strong>{usd(totalSpent)}</strong> with <strong>{totalValue > 0 ? pct(totalEarned / totalValue) : '0.0'}%</strong> earned. Monitor <strong>{atRiskCount} at-risk job(s)</strong> for schedule and cost contingencies.
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 px-1">BondSBA highlights operational patterns that may require professional review. Outputs do not replace underwriting judgment.</p>
    </div>
  );
}
export default WIPAnalyzer;