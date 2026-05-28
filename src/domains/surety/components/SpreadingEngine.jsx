// ?? As-Allowed Spreading Engine ??
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, TrendingUp, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export function SpreadingEngine({ onBack }) {
  const [financialData, setFinancialData] = useState({ grossRevenue: '0', cogs: '0', operatingExpenses: '0' });
  const [results, setResults] = useState(null);

  const handleCalculate = () => {
    const gross = parseFloat(financialData.grossRevenue.replace(/,/g, '')) || 0;
    const cogs = parseFloat(financialData.cogs.replace(/,/g, '')) || 0;
    const opex = parseFloat(financialData.operatingExpenses.replace(/,/g, '')) || 0;
    const grossProfit = gross - cogs;
    const ebitda = gross - cogs - opex;
    const profitMargin = gross > 0 ? ((ebitda / gross) * 100).toFixed(1) : 0;
    setResults({
      grossRevenue: gross, grossProfit, ebitda, profitMargin,
      healthScore: ebitda > 0 && profitMargin > 5 ? 'Strong' : ebitda > 0 ? 'Adequate' : 'Weak',
    });
  };

  const chartData = results
    ? [
        { category: 'Revenue', value: results.grossRevenue, fill: '#0A2540' },
        { category: 'Gross Profit', value: results.grossProfit, fill: '#D97706' },
        { category: 'EBITDA', value: results.ebitda, fill: '#10B981' },
      ]
    : [];

  const usd = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const followUpItems = results
    ? [
        results.profitMargin < 5
          ? 'Ask for margin support and normalization detail before relying on EBITDA.'
          : 'Margin support looks stronger � follow-up can focus on sustainability and trend consistency.',
        results.ebitda <= 0
          ? 'Treat as high-friction for bond capacity until earnings support improves.'
          : 'EBITDA is positive, giving the underwriter a cleaner starting point for capacity discussion.',
        results.grossProfit <= 0
          ? 'Review contract mix and direct cost treatment before moving the file forward.'
          : 'Gross profit is present � test job-level quality and recurring cost pressure in follow-up.',
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="overflow-hidden rounded-xl border border-amber-200 shadow-sm">
        <div className="bg-[#0A2540] px-5 py-3 flex items-center gap-3">
          <button onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Financial Spreading</p>
            <h1 className="text-[16px] font-bold text-white leading-snug">As-Allowed Spreading Engine</h1>
          </div>
          <TrendingUp className="ml-auto h-6 w-6 text-amber-400 opacity-80" />
        </div>
        <div className="bg-amber-50 border-t border-amber-200 px-5 py-2.5">
          <p className="text-[12px] text-amber-900">Normalize contractor financials before full review. Surface thin margins and earnings questions earlier in the cycle.</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-bold text-blue-900">What this helps you catch</p>
          <p className="mt-0.5 text-[12px] text-blue-800 leading-relaxed">Spot thin operating margins, weak earnings support, and financial follow-up items before the contractor file reaches full underwriting review.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Input */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Financial Data Entry</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Convert raw financials into an underwriter-facing starting point.</p>
          </div>
          <div className="p-5 space-y-4">
            {[
              { key: 'grossRevenue', label: 'Gross Revenue (Annual)', hint: 'Total sales before COGS' },
              { key: 'cogs', label: 'Cost of Goods Sold', hint: 'Direct materials + labor' },
              { key: 'operatingExpenses', label: 'Operating Expenses', hint: 'Rent, utilities, overhead' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{field.label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">$</span>
                  <input
                    type="text"
                    value={financialData[field.key]}
                    onChange={(e) => setFinancialData({ ...financialData, [field.key]: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pl-7 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{field.hint}</p>
              </div>
            ))}

            <button onClick={handleCalculate} className="w-full rounded-xl bg-[#0A2540] py-3 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-[#12365F] transition-colors flex items-center justify-center gap-2 shadow-[0_4px_14px_-4px_rgba(10,37,64,0.4)]">
              <TrendingUp className="h-4 w-4" /> Calculate Spreading
            </button>

            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1.5">Methodology</p>
              <ul className="space-y-1 text-[11px] text-amber-800">
                <li className="flex items-start gap-1.5"><span className="mt-0.5 text-amber-400">�</span>Revenue � Gross receipts, less returns and allowances</li>
                <li className="flex items-start gap-1.5"><span className="mt-0.5 text-amber-400">�</span>COGS � Direct materials, direct labor, allocated overhead</li>
                <li className="flex items-start gap-1.5"><span className="mt-0.5 text-amber-400">�</span>EBITDA � Operating income available to support bond capacity discussions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {results ? (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <div className="bg-[#0A2540] px-5 py-4 grid grid-cols-3 gap-4">
                  {[
                    { label: 'Gross Revenue', value: usd(results.grossRevenue), sub: '100% baseline' },
                    { label: 'Gross Profit', value: usd(results.grossProfit), sub: `${results.grossRevenue > 0 ? ((results.grossProfit / results.grossRevenue) * 100).toFixed(1) : 0}% of revenue` },
                    { label: 'EBITDA', value: usd(results.ebitda), sub: `${results.profitMargin}% margin` },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400">{m.label}</p>
                      <p className="mt-1 text-[17px] font-bold text-white tabular-nums leading-none">{m.value}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-xl border-l-4 p-4 ${
                results.healthScore === 'Strong' ? 'bg-green-50 border-l-green-500' :
                results.healthScore === 'Adequate' ? 'bg-amber-50 border-l-amber-500' :
                'bg-red-50 border-l-red-500'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className={`h-4 w-4 ${results.healthScore === 'Strong' ? 'text-green-600' : results.healthScore === 'Adequate' ? 'text-amber-600' : 'text-red-600'}`} />
                  <p className={`text-[13px] font-bold ${results.healthScore === 'Strong' ? 'text-green-800' : results.healthScore === 'Adequate' ? 'text-amber-800' : 'text-red-800'}`}>
                    Financial Health: {results.healthScore}
                  </p>
                </div>
                <p className={`text-[12px] leading-relaxed ${results.healthScore === 'Strong' ? 'text-green-700' : results.healthScore === 'Adequate' ? 'text-amber-700' : 'text-red-700'}`}>
                  {results.healthScore === 'Strong'
                    ? 'Contractor demonstrates stronger cash generation support � gives the underwriter a cleaner basis for bond capacity follow-up.'
                    : results.healthScore === 'Adequate'
                    ? 'Contractor profitability appears workable, but the file still warrants closer follow-up around contingent liabilities and sustainability.'
                    : 'Profitability looks thin for comfortable bond support � this file should move forward with tighter underwriting follow-up.'}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Underwriter Follow-Up</p>
                </div>
                <div className="p-4 space-y-2">
                  {followUpItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <p className="text-[12px] text-slate-700 leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Financial Waterfall</p>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => usd(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center px-6">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-slate-700">Enter financial data to view analysis</p>
              <p className="mt-1 text-[12px] text-slate-400">Results will show gross profit, EBITDA, and where the file needs more underwriting attention.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpreadingEngine;