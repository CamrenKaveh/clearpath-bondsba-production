import React from 'react';
import { ChevronRight, Search, Bell } from 'lucide-react';

const CHIP_VARIANTS = {
  ready: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  review: 'border-amber-300 bg-amber-100 text-amber-900',
  critical: 'border-rose-300 bg-rose-100 text-rose-900',
  info: 'border-blue-300 bg-blue-100 text-blue-900',
  neutral: 'border-slate-300 bg-slate-100 text-slate-800',
};

const SCORE_TONES = {
  ready: { shell: 'border-slate-200 bg-white', value: 'text-emerald-700' },
  review: { shell: 'border-slate-200 bg-white', value: 'text-amber-700' },
  critical: { shell: 'border-slate-200 bg-white', value: 'text-rose-700' },
  info: { shell: 'border-slate-200 bg-white', value: 'text-slate-900' },
  neutral: { shell: 'border-slate-200 bg-white', value: 'text-slate-900' },
};

/**
 * @param {{label: string, variant?: 'ready' | 'review' | 'critical' | 'info' | 'neutral', size?: 'sm' | 'md', dot?: boolean, className?: string}} props
 */
export function StatusChip({ label, variant = 'neutral', size = 'sm', dot = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${
        CHIP_VARIANTS[variant] || CHIP_VARIANTS.neutral
      } ${size === 'md' ? 'px-3 py-1 text-[13px]' : 'px-2.5 py-0.5 text-[12px]'} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {label}
    </span>
  );
}

/**
 * @param {{label: string, value: string | number, statusLabel?: string, statusVariant?: 'ready' | 'review' | 'critical' | 'info' | 'neutral', subtext?: string, className?: string}} props
 */
export function ScoreCard({
  label,
  value,
  statusLabel,
  statusVariant = 'neutral',
  subtext = '',
  className = '',
}) {
  const tone = SCORE_TONES[statusVariant] || SCORE_TONES.neutral;

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${tone.shell} ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 font-bold tabular-nums tracking-[-0.02em] ${tone.value} ${typeof value === 'string' && value.length > 4 ? 'text-xl' : 'text-3xl'}`}>{value}</p>
      {statusLabel && (
        <div className="mt-2">
          <StatusChip label={statusLabel} variant={statusVariant} dot />
        </div>
      )}
      {subtext && <p className="mt-2 text-sm text-slate-600">{subtext}</p>}
    </article>
  );
}

/**
 * @param {{title: string, subtitle?: string, action?: React.ReactNode, className?: string}} props
 */
export function SectionHeader({ title, subtitle = '', action = null, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h2 className="text-3xl font-bold tracking-[-0.03em] text-[#0B1F3A]">{title}</h2>
        {subtitle && <p className="mt-1 text-base text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * @param {{children: React.ReactNode, className?: string}} props
 */
export function ProfessionalDisclaimer({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 ${className}`}>
      {children}
    </div>
  );
}

/**
 * @param {{title: string, description: string, signal: string, ctaLabel: string, onClick: () => void}} props
 */
export function ProductModuleCard({ title, description, signal, ctaLabel, onClick }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</p>
      <p className="mt-2 text-base leading-relaxed text-slate-700">{description}</p>
      <p className="mt-2 text-xs text-slate-500">{signal}</p>
      <button
        onClick={onClick}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
      >
        {ctaLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

/**
 * @param {{before: string[], after: string[]}} props
 */
export function BeforeAfterPanel({ before, after }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Workflow</p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {before.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">With BondSBA</p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {after.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}

/**
 * @param {{steps: Array<{step: string, title: string, copy: string}>}} props
 */
export function WorkflowStepper({ steps }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((item) => (
        <article key={`${item.step}-${item.title}`} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {item.step}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{item.title}</p>
          <p className="mt-1 text-sm text-slate-700">{item.copy}</p>
        </article>
      ))}
    </div>
  );
}

/**
 * @param {{children: React.ReactNode, className?: string}} props
 */
export function MarketingShell({ children, className = '' }) {
  return <div className={`mx-auto max-w-6xl px-4 md:px-8 ${className}`}>{children}</div>;
}

/**
 * @param {{items: string[]}} props
 */
export function TrustPills({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((pill, idx) => (
        <span
          key={pill}
          className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
            idx % 3 === 0
              ? 'border-slate-200 bg-slate-50 text-slate-700'
              : idx % 3 === 1
              ? 'border-slate-200 bg-slate-50 text-slate-700'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

/**
 * @param {{metrics: Array<{label: string, value: string}>, details: Array<{label: string, value: string, variant?: 'ready' | 'review' | 'critical' | 'info' | 'neutral'}>, alerts: string[]}} props
 */
export function DashboardMockup({ metrics, details, alerts }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submission Workspace</p>
        <StatusChip label="Live Sample" variant="neutral" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{m.label}</p>
            <p className="mt-0.5 text-3xl font-bold tracking-[-0.03em] tabular-nums text-[#0B1F3A]">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {details.map((d) => (
          <div key={d.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{d.label}</span>
            <StatusChip label={d.value} variant={d.variant || 'neutral'} />
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operational Alerts</p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {alerts.map((a) => (
            <li key={a}>• {a}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/**
 * @param {{sidebar: React.ReactNode, topbar: React.ReactNode, children: React.ReactNode}} props
 */
export function AppShell({ sidebar, topbar, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.10)] overflow-hidden">
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-slate-50 p-4">{sidebar}</aside>
        <section>
          <div className="border-b border-slate-200 bg-white px-4 py-3">{topbar}</div>
          <div className="p-4">{children}</div>
        </section>
      </div>
    </div>
  );
}

/**
 * @param {{items: Array<{label: string, value: string, active?: boolean}>}} props
 */
export function SidebarNav({ items }) {
  return (
    <nav aria-label="Workspace navigation" className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Workspace</p>
      {items.map((item) => (
        <button
          key={item.label}
          className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
            item.active
              ? 'border-slate-300 bg-slate-100 text-slate-900'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{item.label}</span>
            <span className="text-xs uppercase tracking-wide text-slate-500">{item.value}</span>
          </div>
        </button>
      ))}
    </nav>
  );
}

/**
 * @param {{searchValue: string, onSearchChange: (value: string) => void, organizationLabel: string, alertsCount: number}} props
 */
export function TopSearchBar({ searchValue, onSearchChange, organizationLabel, alertsCount }) {
  return (
    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_160px]">
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search contractors, submission ID, owner..."
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          aria-label="Search contractors and submissions"
        />
      </label>
      <div className="h-10 rounded-lg border border-slate-300 bg-white px-3 flex items-center text-sm text-slate-700">
        {organizationLabel}
      </div>
      <div className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 flex items-center justify-between text-sm text-slate-700">
        <span className="inline-flex items-center gap-2"><Bell className="w-4 h-4" /> Alerts</span>
        <span className="font-semibold tabular-nums">{alertsCount}</span>
      </div>
    </div>
  );
}

/**
 * @param {{title: string, status: string, detail: string, action?: string, variant?: 'ready' | 'review' | 'critical' | 'info' | 'neutral'}} props
 */
export function RiskIndicator({ title, status, detail, action = '', variant = 'neutral' }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <StatusChip label={status} variant={variant} />
      </div>
      <p className="mt-2 text-sm text-slate-700">{detail}</p>
      {action && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Action: {action}</p>}
    </article>
  );
}

/**
 * @param {{children: React.ReactNode, className?: string}} props
 */
export function FilterBar({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

/**
 * @param {{columns: Array<{key: string, label: string, align?: 'left' | 'right' | 'center'}>, rows: any[], renderCell: (row: any, key: string) => React.ReactNode, emptyTitle?: string, emptyBody?: string}} props
 */
export function SubmissionTable({
  columns,
  rows,
  renderCell,
  emptyTitle = 'No records',
  emptyBody = 'No rows match the current filters.',
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1120px] border-collapse">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="border-b border-slate-200">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 ${
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, index) => (
            <tr key={row.id || `${index}`} className="bg-white hover:bg-slate-50">
              {columns.map((column) => (
                <td
                  key={`${row.id || index}-${column.key}`}
                  className={`px-4 py-3 text-sm text-slate-800 ${
                    column.align === 'right' ? 'text-right tabular-nums' : column.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {renderCell(row, column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * @param {{groups: Array<{title: string, items: Array<{label: string, state: 'complete'|'missing'|'stale'|'review'|'na'}>}>, className?: string}} props
 */
export function ReadinessChecklist({ groups, className = '' }) {
  const stateMap = {
    complete: { label: 'Complete', variant: 'ready' },
    missing: { label: 'Missing', variant: 'critical' },
    stale: { label: 'Stale', variant: 'review' },
    review: { label: 'Needs review', variant: 'info' },
    na: { label: 'Not applicable', variant: 'neutral' },
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {groups.map((group) => (
        <article key={group.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
          <div className="mt-3 space-y-2">
            {group.items.map((item) => {
              const state = stateMap[item.state] || stateMap.na;
              return (
                <div key={`${group.title}-${item.label}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm text-slate-700">{item.label}</p>
                  <StatusChip label={state.label} variant={state.variant} />
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * @param {{name: string, tradeType: string, location: string, readinessScore: number, wipQualityScore: number, riskLevel: string, onPrimaryAction?: () => void, onSecondaryAction?: () => void, onTertiaryAction?: () => void}} props
 */
export function ContractorProfileHeader({
  name,
  tradeType,
  location,
  readinessScore,
  wipQualityScore,
  riskLevel,
  onPrimaryAction,
  onSecondaryAction,
  onTertiaryAction,
}) {
  const riskVariant =
    riskLevel.toLowerCase() === 'high'
      ? 'critical'
      : riskLevel.toLowerCase() === 'moderate'
      ? 'review'
      : 'ready';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
          <p className="mt-1 text-sm text-slate-600">{tradeType} · {location}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusChip label={`Readiness ${readinessScore}%`} variant={readinessScore >= 85 ? 'ready' : readinessScore >= 70 ? 'info' : 'review'} />
            <StatusChip label={`WIP Quality ${wipQualityScore}`} variant={wipQualityScore >= 85 ? 'ready' : wipQualityScore >= 70 ? 'info' : 'review'} />
            <StatusChip label={`${riskLevel} risk`} variant={riskVariant} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onPrimaryAction} className="rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#12365F]">New Submission</button>
          <button onClick={onSecondaryAction} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Analyze WIP</button>
          <button onClick={onTertiaryAction} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Generate Memo</button>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{sections: Array<{title: string, body: string}>, className?: string}} props
 */
export function HandoffMemoPreview({ sections, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Memo Preview</p>
      <div className="mt-3 space-y-3">
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{section.title}</p>
            <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {{items: Array<{title: string, owner: string, due: string, priority: 'low' | 'medium' | 'high'}>}} props
 */
export function WorkflowTaskList({ items }) {
  const priorityVariant = {
    low: 'neutral',
    medium: 'review',
    high: 'critical',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow Tasks</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={`${item.title}-${item.owner}-${item.due}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{item.title}</p>
              <StatusChip label={item.priority} variant={priorityVariant[item.priority] || 'neutral'} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{item.owner} · due {item.due}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {{title: string, detail: string, severity?: 'info'|'review'|'critical'|'ready'}} props
 */
export function OperationalAlert({ title, detail, severity = 'info' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <StatusChip label={severity === 'critical' ? 'Critical' : severity === 'review' ? 'Needs review' : severity === 'ready' ? 'Ready' : 'Info'} variant={severity === 'critical' ? 'critical' : severity === 'review' ? 'review' : severity === 'ready' ? 'ready' : 'info'} />
      </div>
      <p className="mt-1 text-sm text-slate-700">{detail}</p>
    </div>
  );
}

/**
 * @param {{className?: string}} props
 */
export function LoadingSkeleton({ className = '' }) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="h-4 w-full rounded bg-slate-200" />
      <div className="h-4 w-5/6 rounded bg-slate-200" />
    </div>
  );
}

/**
 * @param {{title: string, body: string, ctaLabel: string, onCta: () => void}} props
 */
export function EmptyState({ title, body, ctaLabel, onCta }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1">{body}</p>
      <button onClick={onCta} className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#12365F]">
        {ctaLabel}
      </button>
    </div>
  );
}
