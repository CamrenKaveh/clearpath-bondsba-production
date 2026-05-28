// ── Amortization Visualization Charts ──
// Principal vs. Interest and Remaining Balance visualizations for amortization schedules

import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function PrincipalInterestChart({ scheduleData }) {
  if (!scheduleData || scheduleData.length === 0) return null;

  // Sample every 12th month for cleaner display (yearly checkpoints)
  const sampledData = scheduleData.filter((_, i) => i % 12 === 0 || i === scheduleData.length - 1);

  // Calculate cumulative values
  let cumPrincipal = 0;
  let cumInterest = 0;
  const chartData = sampledData.map((row) => {
    cumPrincipal += row.pri;
    cumInterest += row.int;
    return {
      month: row.m,
      year: Math.ceil(row.m / 12),
      cumPrincipal: Math.round(cumPrincipal),
      cumInterest: Math.round(cumInterest),
    };
  });

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
        Principal vs. Interest Over Time
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1B3A6B" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#1B3A6B" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#64748b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="year"
            label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }}
            stroke="#64748b"
          />
          <YAxis
            tickFormatter={formatCurrency}
            stroke="#64748b"
            label={{ value: 'Cumulative Amount', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            labelFormatter={(label) => `Year ${label}`}
            contentStyle={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '8px 12px',
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="cumPrincipal"
            stroke="#1B3A6B"
            fillOpacity={1}
            fill="url(#colorPrincipal)"
            name="Cumulative Principal"
          />
          <Area
            type="monotone"
            dataKey="cumInterest"
            stroke="#64748b"
            fillOpacity={1}
            fill="url(#colorInterest)"
            name="Cumulative Interest"
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-4">
        Shows cumulative principal paid (blue) and total interest paid (gray) over the loan term
      </p>
    </div>
  );
}

export function RemainingBalanceChart({ scheduleData }) {
  if (!scheduleData || scheduleData.length === 0) return null;

  // Sample every 12th month for cleaner display
  const sampledData = scheduleData.filter((_, i) => i % 12 === 0 || i === scheduleData.length - 1);

  const chartData = sampledData.map((row) => ({
    month: row.m,
    year: Math.ceil(row.m / 12),
    balance: Math.round(row.bal),
  }));

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
        Remaining Balance Schedule
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="year"
            label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }}
            stroke="#64748b"
          />
          <YAxis
            tickFormatter={formatCurrency}
            stroke="#64748b"
            label={{ value: 'Outstanding Balance', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            labelFormatter={(label) => `Year ${label}`}
            contentStyle={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '8px 12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#1B3A6B"
            strokeWidth={2}
            dot={{ fill: '#1B3A6B', r: 4 }}
            activeDot={{ r: 6 }}
            name="Outstanding Balance"
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-4">
        Shows loan principal balance declining to $0 at maturity
      </p>
    </div>
  );
}

export default { PrincipalInterestChart, RemainingBalanceChart };
