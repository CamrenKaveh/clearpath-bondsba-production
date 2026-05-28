// ?? Surety Bond Underwriting Dashboard ??
// Commercial surety bond risk analysis and document processing
import { Clock3, Upload, TrendingUp, Zap, Loader2, ShieldCheck, Building2, CheckCircle2, Circle, ArrowRight, AlertTriangle, FileText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SuretyClient } from '../api/suretyClient';
import ReadinessReport from './ReadinessReport';

export function SuretyDashboard({ onUploadDocument, onNavigate, onRequireAuth, user }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [savedPackets, setSavedPackets] = useState([]);
  const [loadingPackets, setLoadingPackets] = useState(false);
  const [profileKey, setProfileKey] = useState('');
  const [profileNote, setProfileNote] = useState('');
  const profileStoragePrefix = 'bondsba-profile-note-';

  const workflowStages = [
    {
      label: 'Intake File',
      number: '01',
      status: analysis ? 'complete' : selectedFile ? 'in-progress' : 'pending',
      detail: selectedFile ? 'File selected and ready.' : analysis ? 'Structured intake completed.' : 'Collect financials and support docs.',
    },
    {
      label: 'Normalize Financials',
      number: '02',
      status: analysis?.spreadingAnalysis ? 'complete' : analysis ? 'ready' : 'pending',
      detail: analysis?.spreadingAnalysis ? 'Margin and leverage review packaged.' : analysis ? 'Run spreading to surface earnings risk.' : 'Unlocks after initial file upload.',
    },
    {
      label: 'Review WIP',
      number: '03',
      status: analysis?.wipAnalysis ? 'complete' : analysis ? 'ready' : 'pending',
      detail: analysis?.wipAnalysis ? 'WIP concerns packaged.' : analysis ? 'Check concentration and fade risk.' : 'Add WIP schedule to assess live work.',
    },
    {
      label: 'Prep Handoff',
      number: '04',
      status: analysis?.readinessReport ? 'complete' : analysis ? 'ready' : 'pending',
      detail: analysis?.readinessReport ? 'Handoff output ready.' : analysis ? 'Package follow-up items.' : 'Summarize missing items for underwriter.',
    },
  ];

  const handoffChecklist = [
    'Current fiscal-year financial statements',
    'Federal business tax returns with schedules',
    'Current WIP schedule or contract backlog support',
    'Requested bond details and underlying opportunity',
    'Organizational / indemnity support documents',
  ];

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadSavedPackets = async () => {
      setLoadingPackets(true);
      try {
        const records = await SuretyClient.listSavedApplications(6);
        if (!cancelled) setSavedPackets(records);
      } catch {
        if (!cancelled) setSavedPackets([]);
      } finally {
        if (!cancelled) setLoadingPackets(false);
      }
    };
    loadSavedPackets();
    return () => { cancelled = true; };
  }, [user, analysis?.applicationId]);

  const profiles = useMemo(() => {
    const grouped = new Map();
    savedPackets.forEach((packet) => {
      const key = (packet.applicantName || 'Contractor submission').trim();
      const current = grouped.get(key) || { key, packets: 0, lastSavedAt: null, avgReadinessScore: 0, knownRisk: [] };
      current.packets += 1;
      const savedAt = packet.createdAt ? new Date(packet.createdAt) : null;
      if (savedAt && (!current.lastSavedAt || savedAt > current.lastSavedAt)) current.lastSavedAt = savedAt;
      const readinessScore = packet.analysis?.readinessReport?.readinessScore;
      if (typeof readinessScore === 'number') {
        const total = current.avgReadinessScore * (current.packets - 1) + readinessScore;
        current.avgReadinessScore = Math.round(total / current.packets);
      }
      const risk = packet.analysis?.underwritingSummary?.overallRiskLevel || packet.overallRiskLevel;
      if (risk) current.knownRisk.push(risk);
      grouped.set(key, current);
    });
    return Array.from(grouped.values())
      .map((profile) => ({ ...profile, dominantRisk: profile.knownRisk.filter(Boolean)[0] || 'unknown' }))
      .sort((a, b) => (b.lastSavedAt?.getTime() || 0) - (a.lastSavedAt?.getTime() || 0));
  }, [savedPackets]);

  useEffect(() => {
    if (!profiles.length) return;
    if (!profileKey) setProfileKey(profiles[0].key);
  }, [profiles, profileKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !profileKey) return;
    setProfileNote(window.localStorage.getItem(`${profileStoragePrefix}${profileKey}`) || '');
  }, [profileKey]);

  const selectedProfile = profiles.find((profile) => profile.key === profileKey) || null;

  const saveProfileNote = () => {
    if (typeof window === 'undefined' || !profileKey) return;
    window.localStorage.setItem(`${profileStoragePrefix}${profileKey}`, profileNote);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setUploadStatus('ready'); setUploadError(''); setAnalysis(null); }
  };

  const handleUpload = async () => {
    if (!user) { onRequireAuth?.('Sign in to run uploads, save packets, and execute surety analysis workflows.'); return; }
    if (!selectedFile) return;
    setUploadStatus('uploading');
    setUploadError('');
    try {
      const nextAnalysis = await onUploadDocument(selectedFile);
      setAnalysis(nextAnalysis);
      setUploadStatus('success');
      setSelectedFile(null);
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      setUploadStatus('error');
      setUploadError(err.message || 'Upload failed. Please try again.');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const restoreSavedPacket = async (applicationId) => {
    setUploadError('');
    try {
      const saved = await SuretyClient.getSavedApplication(applicationId);
      setAnalysis({ applicationId: saved.applicationId, ...(saved.analysis || {}) });
      setUploadStatus(null);
      setSelectedFile(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setUploadError(error.message || 'Failed to reopen saved packet.');
    }
  };

  const stageIcon = (status) => {
    if (status === 'complete') return <CheckCircle2 className="h-4 w-4 text-amber-500" />;
    if (status === 'in-progress') return <div className="h-4 w-4 rounded-full border-2 border-amber-500 bg-amber-100" />;
    if (status === 'ready') return <Circle className="h-4 w-4 text-amber-400" />;
    return <Circle className="h-4 w-4 text-slate-300" />;
  };

  const metricCards = [
    {
      label: 'Submission Completeness',
      value: analysis?.readinessReport ? analysis.readinessReport.readinessStatus : selectedFile ? 'In Progress' : 'Awaiting File',
      hint: analysis?.readinessReport ? `${analysis.readinessReport.missingItems.length} item(s) need attention` : selectedFile ? 'File selected, ready for triage' : 'Upload financials, WIP, or support docs',
      color: analysis?.readinessReport ? 'text-amber-700' : 'text-slate-600',
      bg: analysis?.readinessReport ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200',
    },
    {
      label: 'Financial Review',
      value: analysis?.spreadingAnalysis ? 'Notes Ready' : 'Pending',
      hint: analysis?.spreadingAnalysis ? 'Margin support and leverage cues packaged' : 'Upload to queue financial review',
      color: analysis?.spreadingAnalysis ? 'text-green-700' : 'text-slate-500',
      bg: analysis?.spreadingAnalysis ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200',
    },
    {
      label: 'WIP Review Status',
      value: analysis?.wipAnalysis ? 'WIP Notes Captured' : 'No WIP Yet',
      hint: analysis?.wipAnalysis ? 'Use analyzer to deepen stressed-job follow-up' : 'Add WIP schedule to pressure-test open work',
      color: analysis?.wipAnalysis ? 'text-green-700' : 'text-slate-500',
      bg: analysis?.wipAnalysis ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="overflow-hidden rounded-xl border border-amber-200 shadow-sm">
        <div className="bg-[#0A2540] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Surety Bond Workspace</p>
            <h1 className="mt-1 text-xl font-bold text-white leading-snug">Surety Submission Triage Workspace</h1>
          </div>
          <ShieldCheck className="h-8 w-8 text-amber-400 opacity-80" />
        </div>
        <div className="bg-amber-50 border-t border-amber-200 px-5 py-3">
          <p className="text-[13px] text-amber-900">Turn contractor financials, WIP schedules, and support documents into a cleaner file for faster underwriter review.</p>
        </div>
      </div>

      {!user && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">Preview mode: you can review the workflow layout now. Sign in to upload files, run analysis, and save readiness packets.</p>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {metricCards.map((card) => (
          <div key={card.label} className={`rounded-xl border px-4 py-3 ${card.bg}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
            <p className={`mt-1.5 text-[17px] font-bold leading-snug ${card.color}`}>{card.value}</p>
            <p className="mt-0.5 text-[12px] text-slate-500 leading-snug">{card.hint}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">What this workspace does differently</p>
        <p className="mt-1 text-[13px] text-slate-600">It turns contractor documents, WIP notes, readiness gaps, and underwriter follow-up into one triage workflow before the file is sent out.</p>
      </div>


      {/* Workflow Pipeline */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-900 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Review Sequence</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {workflowStages.map((stage, i) => (
              <div key={stage.label} className="relative">
                <div className={`rounded-lg border p-4 h-full ${
                  stage.status === 'complete' ? 'border-amber-200 bg-amber-50' :
                  stage.status === 'in-progress' ? 'border-blue-200 bg-blue-50' :
                  stage.status === 'ready' ? 'border-amber-100 bg-amber-50/40' :
                  'border-slate-200 bg-slate-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black tracking-widest ${
                      stage.status === 'pending' ? 'text-slate-300' : 'text-amber-500'
                    }`}>{stage.number}</span>
                    {stageIcon(stage.status)}
                  </div>
                  <p className={`text-[13px] font-bold leading-snug ${
                    stage.status === 'pending' ? 'text-slate-400' : 'text-slate-800'
                  }`}>{stage.label}</p>
                  <p className={`mt-1.5 text-[11px] leading-relaxed ${
                    stage.status === 'pending' ? 'text-slate-400' : 'text-slate-600'
                  }`}>{stage.detail}</p>
                </div>
                {i < workflowStages.length - 1 && (
                  <div className="hidden xl:flex absolute top-1/2 -right-2 z-10 items-center">
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upload + Tools Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Document Upload */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-slate-500" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Document Upload</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Intake the current file for triage and review prep.</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-amber-400 hover:bg-amber-50/30 transition-colors cursor-pointer group">
              <input type="file" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.png" />
              <div className="h-10 w-10 rounded-full bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center mx-auto mb-3 transition-colors">
                <FileText className="h-5 w-5 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </div>
              <p className="text-sm font-semibold text-slate-700">{selectedFile ? selectedFile.name : 'Drop file or click to select'}</p>
              <p className="mt-1 text-[11px] text-slate-400">PDF, Excel, Word, or Image � Max 25MB</p>
            </div>

            {uploadStatus && (
              <div className={`px-4 py-3 rounded-lg text-[13px] font-medium border text-center ${
                uploadStatus === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
                uploadStatus === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
                'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                {uploadStatus === 'success' && 'Document received. Ready for triage and review.'}
                {uploadStatus === 'error' && (uploadError || 'Upload failed. Please try again.')}
                {uploadStatus === 'uploading' && 'Uploading and preparing for structured review...'}
                {uploadStatus === 'ready' && `${selectedFile?.name} � queued for triage`}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadStatus === 'uploading'}
              className={`w-full py-3 px-4 rounded-xl font-bold uppercase tracking-wide text-sm flex items-center justify-center gap-2 transition-all ${
                !selectedFile || uploadStatus === 'uploading' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#0A2540] text-white hover:bg-[#12365F] shadow-[0_4px_14px_-4px_rgba(10,37,64,0.4)]'
              }`}
            >
              {uploadStatus === 'uploading' ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Upload className="h-4 w-4" /> Queue File for Triage</>}
            </button>

            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1.5">Underwriter Handoff Checklist</p>
              <ul className="space-y-1">
                {handoffChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[12px] text-amber-800">
                    <span className="mt-0.5 text-amber-400">�</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Analysis Tools */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0A2540]">
                <TrendingUp className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Financial Spreading</p>
                <p className="mt-0.5 text-[15px] font-bold text-slate-900">As-Allowed Spreading Engine</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">Normalize contractor financials. Surface weak margin support and earnings questions earlier in the review cycle.</p>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Structured inputs</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Earnings quality</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Margin support</span>
            </div>
            <div className="px-5 py-3 border-t border-slate-100">
              <button onClick={() => onNavigate('spreading')} className="w-full rounded-lg bg-[#0A2540] py-2.5 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-[#12365F] transition-colors">
                Run Financial Review
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">WIP Analysis</p>
                <p className="mt-0.5 text-[15px] font-bold text-slate-900">WIP Analyzer</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">Pressure-test open jobs, backlog quality, and likely profit fade before the file moves deeper into review.</p>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Job-by-job triage</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Fade risk</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Concentration</span>
            </div>
            <div className="px-5 py-3 border-t border-slate-100">
              <button onClick={() => onNavigate('wipAnalyzer')} className="w-full rounded-lg bg-amber-600 py-2.5 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-amber-700 transition-colors">
                Run WIP Review
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Packets */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recent Readiness Packets</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Reopen a saved contractor packet without regenerating the analysis.</p>
          </div>
          {loadingPackets && <span className="text-[11px] text-slate-400">Loading...</span>}
        </div>
        <div className="p-5">
          {savedPackets.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {savedPackets.map((packet) => (
                <button key={packet.applicationId} onClick={() => restoreSavedPacket(packet.applicationId)} className="border border-slate-200 rounded-xl bg-slate-50 p-4 text-left hover:border-amber-300 hover:bg-amber-50/30 transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saved Packet</p>
                      <h3 className="mt-1 text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">{packet.applicantName || 'Contractor submission'}</h3>
                    </div>
                    <Clock3 className="h-4 w-4 text-slate-300 shrink-0" />
                  </div>
                  <p className="mt-2 text-[12px] text-slate-500">{(packet.analysis?.readinessReport?.readinessStatus || packet.overallRiskLevel || 'saved').toString()}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Saved {new Date(packet.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-xl px-5 py-6 text-center">
              <p className="text-[13px] text-slate-400">{loadingPackets ? 'Loading saved packets...' : 'No saved packets yet. The next uploaded contractor file will appear here.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contractor Profiles */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-500" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contractor Operational Profiles</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Historical readiness, recent risk posture, and team notes across saved packets.</p>
          </div>
        </div>
        <div className="p-5">
          {profiles.length ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#0A2540] text-white">
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest">Contractor</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest">Packets</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest">Avg Readiness</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest">Risk</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profiles.map((profile, index) => (
                      <tr key={profile.key} onClick={() => setProfileKey(profile.key)} className={`cursor-pointer hover:bg-amber-50 transition-colors ${index % 2 ? 'bg-slate-50' : 'bg-white'} ${profile.key === profileKey ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{profile.key}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{profile.packets}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{profile.avgReadinessScore || 'N/A'}%</td>
                        <td className="px-3 py-2.5 text-slate-600">{profile.dominantRisk}</td>
                        <td className="px-3 py-2.5 text-slate-500">{profile.lastSavedAt ? profile.lastSavedAt.toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">{selectedProfile ? selectedProfile.key : 'Select a profile'}</p>
                <p className="mt-1 text-[12px] text-slate-500">Owner-scoped notes and recurring risk context for repeat submissions.</p>
                <label className="mt-3 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Team Notes</span>
                  <textarea value={profileNote} onChange={(e) => setProfileNote(e.target.value)} rows={5} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="Recurring blockers, margin patterns, handoff context..." />
                </label>
                <button onClick={saveProfileNote} className="mt-3 w-full rounded-lg bg-[#0A2540] px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-[#12365F] transition-colors">
                  Save Profile Note
                </button>
              </aside>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-xl px-5 py-6 text-center">
              <p className="text-[13px] text-slate-400">Upload a contractor file first to create profile history.</p>
            </div>
          )}
        </div>
      </div>

      {/* One-Upload Note */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-slate-900">One Upload Path, Cleaner Review</p>
          <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">Documents move through the same OCR and tabular extraction engine used across BondSBA � less re-keying, faster structured intake, cleaner starting point for surety triage.</p>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 px-1">BondSBA provides workflow infrastructure and readiness support. Outputs require professional review and do not replace underwriting or surety decisions.</p>

      {analysis?.readinessReport && <ReadinessReport report={analysis.readinessReport} analysis={analysis} />}
    </div>
  );
}

export default SuretyDashboard;