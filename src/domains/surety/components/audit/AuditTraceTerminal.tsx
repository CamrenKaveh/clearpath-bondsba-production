import React, { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, CircleDot, ShieldAlert, XCircle } from 'lucide-react';
import type { AuditTraceStep, AuditTraceTerminalProps, AuditTraceStatus, AuditVariableUsed } from '../../../../shared/types/auditTrace';

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const statusStyles: Record<AuditTraceStatus | 'REQUIRES_REVIEW', string> = {
  PASS: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  WARN: 'border-amber-300/50 bg-amber-300/10 text-amber-100',
  FAIL: 'border-rose-400/50 bg-rose-400/10 text-rose-100',
  REQUIRES_REVIEW: 'border-sky-300/50 bg-sky-300/10 text-sky-100',
};

function StatusIcon({ status }: { status: AuditTraceStatus | 'REQUIRES_REVIEW' }): JSX.Element {
  if (status === 'PASS') return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === 'WARN') return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  if (status === 'FAIL') return <XCircle className="h-4 w-4" aria-hidden="true" />;
  return <ShieldAlert className="h-4 w-4" aria-hidden="true" />;
}

function StatusBadge({ status }: { status: AuditTraceStatus | 'REQUIRES_REVIEW' }): JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${statusStyles[status]}`}>
      <StatusIcon status={status} />
      {status}
    </span>
  );
}

function formatVariableValue(variable: AuditVariableUsed): string {
  if (variable.value === null) return 'NULL';
  if (variable.format === 'currency' && typeof variable.value === 'number') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(variable.value);
  }
  if (variable.format === 'percentage' && typeof variable.value === 'number') return `${(variable.value * 100).toFixed(1)}%`;
  return String(variable.value);
}

function confidenceClass(confidence: number): string {
  if (confidence >= 0.85) return 'text-emerald-200';
  if (confidence >= 0.75) return 'text-amber-100';
  return 'text-rose-100';
}

interface StepRowProps {
  step: AuditTraceStep;
  variables: AuditVariableUsed[];
  isOpen: boolean;
  onToggle: (sequence: number) => void;
  documentBasePath: string;
}

const StepRow = memo(function StepRow({ step, variables, isOpen, onToggle, documentBasePath }: StepRowProps): JSX.Element {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease }}
      className="border border-slate-700/80 bg-slate-950/70"
    >
      <button
        type="button"
        onClick={() => onToggle(step.sequence)}
        className="grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
        aria-expanded={isOpen}
      >
        <span className="font-mono text-xs font-bold text-slate-500">{String(step.sequence).padStart(2, '0')}</span>
        <span>
          <span className="block text-sm font-semibold text-slate-100">{step.stepName}</span>
          <span className="mt-1 block font-mono text-[11px] text-slate-500">{step.thresholdCondition}</span>
        </span>
        <StatusBadge status={step.status} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden border-t border-slate-800"
          >
            <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Formula Pattern</p>
                  <p className="mt-1 font-mono text-sm text-slate-200">{step.formulaPattern}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Substitution Log</p>
                  <p className="mt-1 rounded-sm border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-sky-100">{step.expression}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Rationale</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{step.rationale}</p>
                </div>
              </div>

              <div className="overflow-hidden border border-slate-800">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-slate-900/80 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Variable</th>
                      <th className="px-3 py-2">Value</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((variable) => (
                      <tr key={`${step.sequence}-${variable.key}`} className="border-t border-slate-800 text-xs">
                        <td className="px-3 py-2 text-slate-300">{variable.label}</td>
                        <td className="px-3 py-2 font-mono text-slate-100">{formatVariableValue(variable)}</td>
                        <td className={`px-3 py-2 font-mono font-bold ${confidenceClass(variable.confidence)}`}>
                          {(variable.confidence * 100).toFixed(0)}%
                        </td>
                        <td className="px-3 py-2">
                          <a className="text-sky-200 underline decoration-sky-400/50 underline-offset-4 hover:text-white" href={`${documentBasePath}/${variable.source.documentId}`}>
                            {variable.source.documentName}
                          </a>
                          <span className="block font-mono text-[10px] text-slate-500">{variable.source.fieldName}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
});

function SystemStatusNode({ status }: { status: AuditTraceTerminalProps['trace']['finalStatus'] }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-3 w-3" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-50" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-200" />
      </span>
      <StatusBadge status={status} />
    </div>
  );
}

export const AuditTraceTerminal = memo(function AuditTraceTerminal({ trace, documentBasePath = '/documents' }: AuditTraceTerminalProps): JSX.Element {
  const [openSequence, setOpenSequence] = useState<number | null>(trace.steps[0]?.sequence ?? null);
  const orderedSteps = useMemo(() => [...trace.steps].sort((left, right) => left.sequence - right.sequence), [trace.steps]);
  const variables = useMemo(() => trace.variablesUsed, [trace.variablesUsed]);

  const toggleStep = (sequence: number): void => {
    setOpenSequence((current) => (current === sequence ? null : sequence));
  };

  return (
    <section className="rounded-sm border border-slate-700 bg-[#020617] p-4 text-slate-100 shadow-2xl shadow-slate-950/40">
      <header className="grid gap-4 border-b border-slate-800 pb-4 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200">Immutable Audit Trace</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Underwriting execution path</h2>
          <div className="mt-3 grid gap-2 font-mono text-xs text-slate-400 sm:grid-cols-3">
            <span>TRACE {trace.id}</span>
            <span>ENGINE {trace.engineVersion}</span>
            <span>{trace.executionTimeMs}MS</span>
          </div>
        </div>
        <SystemStatusNode status={trace.finalStatus} />
      </header>

      <div className="mt-4 flex items-center gap-2 border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-400">
        <CircleDot className="h-3.5 w-3.5 text-sky-200" aria-hidden="true" />
        Calculation snapshots are append-only. Historical traces are never overwritten.
      </div>

      <div className="mt-4 space-y-2">
        {orderedSteps.map((step) => (
          <StepRow
            key={step.sequence}
            step={step}
            variables={variables}
            isOpen={openSequence === step.sequence}
            onToggle={toggleStep}
            documentBasePath={documentBasePath}
          />
        ))}
      </div>
    </section>
  );
});
