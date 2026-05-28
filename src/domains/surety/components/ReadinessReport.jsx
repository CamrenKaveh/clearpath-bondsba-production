import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Printer, Save } from 'lucide-react';
import { exportDocumentHTML, exportDocumentPDF, printDocument } from '../../../shared/utils/pdfExport';

const ARTIFACT_LABELS = {
  'cover-memo': 'Underwriter Cover Memo',
  'broker-summary': 'Broker Summary',
  'checklist-packet': 'Submission Checklist Packet',
  'wip-concern-summary': 'WIP Concern Summary',
};

const STATUS_STYLES = {
  'ready for review': 'border-green-200 bg-green-50 text-green-900',
  'conditionally ready': 'border-amber-200 bg-amber-50 text-amber-950',
  'not ready': 'border-red-200 bg-red-50 text-red-900',
};

const SEVERITY_STYLES = {
  critical: 'border-red-300 bg-red-50 text-red-900',
  high: 'border-orange-300 bg-orange-50 text-orange-900',
  medium: 'border-amber-300 bg-amber-50 text-amber-950',
  low: 'border-green-300 bg-green-50 text-green-900',
};

function ArtifactBody({ artifactId, report, analysis }) {
  const warnings = analysis?.underwritingSummary?.warnings || [];
  const recommendations = analysis?.underwritingSummary?.recommendations || [];
  const breakdown = report.readinessBreakdown || {};
  const criticalItems = breakdown.criticalMissingItems || [];
  const importantItems = breakdown.importantMissingItems || [];
  const staleFlags = breakdown.staleDocumentFlags || [];

  if (artifactId === 'broker-summary') {
    return (
      <div className="space-y-4">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Summary for Referral Partner</h2>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">
            This file is currently marked <strong>{report.readinessStatus}</strong>. The next step is to tighten the package around the items below before broader market outreach.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Missing Items</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
            {report.missingItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Recommended Next Step</h2>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{report.recommendedNextStep}</p>
        </section>
      </div>
    );
  }

  if (artifactId === 'checklist-packet') {
    return (
      <div className="space-y-4">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Submission Packet Checklist</h2>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">
            Use this packet to close documentation gaps before the file reaches underwriting.
          </p>
        </section>
        <section>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#0A2540] text-white">
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">Item</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">Priority</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...criticalItems.map((item) => ({ item, priority: 'Critical' })), ...importantItems.map((item) => ({ item, priority: 'Important' }))]
                .map((entry, index) => (
                <tr key={entry.item} className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-3 py-2 text-sm text-slate-800">{entry.item}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-800">{entry.priority}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-amber-700">Outstanding</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {staleFlags.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Stale Document Flags</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
              {staleFlags.map((flag) => <li key={flag}>{flag}</li>)}
            </ul>
          </section>
        )}
      </div>
    );
  }

  if (artifactId === 'wip-concern-summary') {
    return (
      <div className="space-y-4">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">WIP Concern Summary</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
            {report.wipNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Jobs Requiring Follow-Up</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
            {warnings.filter((warning) => warning.source === 'wip').length ? (
              warnings.filter((warning) => warning.source === 'wip').map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))
            ) : (
              <li>No material WIP-specific issues were surfaced by the current automated pass.</li>
            )}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Readiness Position</h2>
        <p className="mt-2 text-sm text-slate-700 leading-relaxed">
          The file is currently marked <strong>{report.readinessStatus}</strong>. This memo packages the main underwriting friction points so review time is not spent rediscovering obvious gaps.
        </p>
      </section>
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Missing Items</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
          {report.missingItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Follow-Up Questions</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
          {report.followUpQuestions.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Recommended Next Step</h2>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{report.recommendedNextStep}</p>
        </section>
      {report.recommendedActions?.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Execution Actions</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
            {report.recommendedActions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Reviewer Guidance</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
          {recommendations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </div>
  );
}

export function ReadinessReport({ report, analysis }) {
  const [artifactId, setArtifactId] = useState('cover-memo');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [memoHistory, setMemoHistory] = useState([]);
  const [memoStatus, setMemoStatus] = useState('');
  const artifactRef = useRef(null);
  const historyKey = useMemo(() => {
    const source = (report.sourceDocument || 'contractor-submission')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `bondsba-memo-history-${source}`;
  }, [report.sourceDocument]);

  const artifactTitle = ARTIFACT_LABELS[artifactId] || ARTIFACT_LABELS['cover-memo'];

  const exportFilenameBase = useMemo(() => {
    const source = (report.sourceDocument || 'contractor-submission')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `bondsba-${source}-${artifactId}`;
  }, [artifactId, report.sourceDocument]);

  const handleExportHtml = () => {
    if (artifactRef.current) {
      exportDocumentHTML(artifactRef.current, `${exportFilenameBase}.html`, artifactTitle);
    }
  };

  const handleExportPdf = () => {
    if (artifactRef.current) {
      exportDocumentPDF(artifactRef.current, `${exportFilenameBase}.pdf`, artifactTitle);
    }
  };

  const handlePrint = () => {
    if (artifactRef.current) {
      printDocument(artifactRef.current, artifactTitle);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(historyKey) || '[]');
      setMemoHistory(Array.isArray(saved) ? saved : []);
    } catch {
      setMemoHistory([]);
    }
  }, [historyKey]);

  const saveMemoDraft = () => {
    if (typeof window === 'undefined') return;
    const next = [
      {
        ts: new Date().toISOString(),
        artifactId,
        operatorNotes,
        readinessStatus: report.readinessStatus,
        readinessScore: report.readinessScore,
      },
      ...memoHistory,
    ].slice(0, 10);
    window.localStorage.setItem(historyKey, JSON.stringify(next));
    setMemoHistory(next);
    setMemoStatus('Draft saved');
    window.setTimeout(() => setMemoStatus(''), 1200);
  };

  const restoreDraft = (draft) => {
    setArtifactId(draft.artifactId || 'cover-memo');
    setOperatorNotes(draft.operatorNotes || '');
    setMemoStatus('Draft restored');
    window.setTimeout(() => setMemoStatus(''), 1200);
  };

  const breakdown = report.readinessBreakdown || {};
  const criticalItems = breakdown.criticalMissingItems || [];
  const importantItems = breakdown.importantMissingItems || [];
  const supportingItems = breakdown.supportingItems || [];
  const staleFlags = breakdown.staleDocumentFlags || [];

  return (
    <section className="space-y-4">
      <div className={`border rounded-sm p-4 ${STATUS_STYLES[report.readinessStatus] || STATUS_STYLES['conditionally ready']}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide">Submission Readiness Report</p>
            <h2 className="mt-1 text-xl font-bold capitalize">{report.readinessStatus}</h2>
            <p className="mt-1 text-sm font-semibold">Readiness Score: {report.readinessScore ?? 'N/A'}%</p>
            <p className="mt-2 text-sm leading-relaxed">{report.recommendedNextStep}</p>
          </div>
          <div className="text-xs text-right">
            <p className="font-semibold text-current">Source File</p>
            <p>{report.sourceDocument || 'Uploaded contractor package'}</p>
            <p className="mt-1">Lender: <strong>{report.lenderReadyIndicator || 'n/a'}</strong></p>
            <p>Surety: <strong>{report.suretyReadyIndicator || 'n/a'}</strong></p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-slate-300 bg-white p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Missing Items by Priority</h3>
              </div>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-red-700">Critical ({criticalItems.length})</p>
                  <ul className="mt-1 space-y-1">
                    {criticalItems.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-0.5 text-red-700">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Important ({importantItems.length})</p>
                  <ul className="mt-1 space-y-1">
                    {importantItems.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-700">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Supporting ({supportingItems.length})</p>
                  <ul className="mt-1 space-y-1">
                    {supportingItems.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-0.5 text-slate-500">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#1B3A6B]" />
                <h3 className="text-sm font-bold text-slate-900">Follow-Up Questions</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {report.followUpQuestions.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#1B3A6B]">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-slate-300 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Financial Review Notes</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {report.financialNotes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-700">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-slate-300 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">WIP Review Notes</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {report.wipNotes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-700">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {staleFlags.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 p-4">
              <h3 className="text-sm font-bold text-amber-900">Stale Document Alerts</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {staleFlags.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border border-slate-300 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Sharable Output</p>
                <h3 className="mt-1 text-sm font-bold text-slate-900">{artifactTitle}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={saveMemoDraft} className="inline-flex items-center gap-1.5 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                  <Save className="h-3.5 w-3.5" /> Save Draft
                </button>
                <button onClick={handlePrint} className="inline-flex items-center gap-1.5 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 border border-[#1B3A6B] bg-[#1B3A6B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0A2540]">
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
                <button onClick={handleExportHtml} className="inline-flex items-center gap-1.5 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                  <FileText className="h-3.5 w-3.5" /> HTML
                </button>
              </div>
            </div>
            {memoStatus && <p className="mt-2 text-xs text-slate-600">{memoStatus}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {report.artifactSummaries.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() => setArtifactId(artifact.id)}
                  className={`border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    artifactId === artifact.id
                      ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {artifact.title}
                </button>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Operator Notes</span>
              <textarea
                value={operatorNotes}
                onChange={(event) => setOperatorNotes(event.target.value)}
                rows={3}
                className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#1B3A6B] focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
                placeholder="Short notes for lender/surety handoff context..."
              />
            </label>

            {memoHistory.length > 0 && (
              <div className="mt-3 border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Draft History</p>
                <div className="mt-2 space-y-2">
                  {memoHistory.slice(0, 3).map((entry) => (
                    <button
                      key={entry.ts}
                      onClick={() => restoreDraft(entry)}
                      className="block w-full border border-slate-300 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {new Date(entry.ts).toLocaleString()} · {ARTIFACT_LABELS[entry.artifactId] || 'Memo'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={artifactRef} className="mt-4 border border-slate-200 bg-slate-50 p-5">
              <header className="border-b border-slate-200 pb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">BondSBA Submission Packet</p>
                <h4 className="mt-1 text-2xl font-bold text-[#0A2540]">{artifactTitle}</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Generated from the contractor submission readiness workflow. This is a decision-support package and not a credit approval or final underwriting decision.
                </p>
              </header>
              <div className="mt-4">
                <ArtifactBody artifactId={artifactId} report={report} analysis={analysis} />
                {operatorNotes ? (
                  <section className="mt-4 border-t border-slate-200 pt-4">
                    <h5 className="text-sm font-bold uppercase tracking-wide text-[#1B3A6B]">Operator Notes</h5>
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{operatorNotes}</p>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="border border-slate-300 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Friction Flags</p>
            <div className="mt-3 space-y-3">
              {report.frictionFlags.map((flag) => (
                <div key={`${flag.title}-${flag.detail}`} className={`border rounded-sm p-3 ${SEVERITY_STYLES[flag.severity] || SEVERITY_STYLES.medium}`}>
                  <p className="text-xs font-bold uppercase tracking-wide">{flag.title}</p>
                  <p className="mt-1 text-xs leading-relaxed">{flag.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-slate-300 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Operational Actions</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {(report.recommendedActions || []).map((action) => (
                <li key={action} className="flex items-start gap-2">
                  <span className="mt-0.5 text-slate-400">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {report.disclaimer || 'BondSBA outputs require professional review and do not replace underwriting or lending decisions.'}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ReadinessReport;
