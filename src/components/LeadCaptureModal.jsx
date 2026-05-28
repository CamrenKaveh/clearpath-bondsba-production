// src/components/LeadCaptureModal.jsx
// Reusable lead-capture gate modal.
// Usage:
//   <LeadCaptureModal
//     title="Download Your Executive Term Sheet"
//     subtitle="Enter your details to receive the PDF instantly."
//     ctaLabel="Send Me the PDF"
//     onCapture={(lead) => triggerDownload()}
//     onClose={() => setGateOpen(false)}
//   />
import { useState, useRef, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../shared/utils/supabaseClient';

const COMPANY_TYPES = [
  'Loan Broker',
  'SBA Lender / LSO',
  'Fractional CFO',
  'Surety Producer',
  'Construction CPA',
  'Small Business Owner',
  'Other',
];

export function LeadCaptureModal({ title, subtitle, ctaLabel = 'Unlock Now', onCapture, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', companyType: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);

  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email) && form.companyType;

  // Trap focus inside modal while open.
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    modal.addEventListener('keydown', handleKeyDown);
    first?.focus();
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);

    const { error: dbErr } = await supabase
      .from('leads')
      .insert({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        company_type: form.companyType,
        source: window.location.hostname,
        page: window.location.pathname,
        created_at: new Date().toISOString(),
      });

    setLoading(false);
    if (dbErr) {
      console.warn('Lead insert:', dbErr.message);
      // Non-blocking — still unlock content even on DB error.
      setError('Your info was saved but something went wrong. Content unlocked anyway.');
    }
    onCapture?.({ ...form });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-slate-600">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Full Name
            </span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
              placeholder="Jane Smith"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Work Email
            </span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
              placeholder="jane@firm.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Role / Company Type
            </span>
            <select
              required
              value={form.companyType}
              onChange={(e) => setForm({ ...form, companyType: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none focus:ring-1 focus:ring-[#0B1F3A]"
            >
              <option value="">Select your role…</option>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          {error && (
            <p className="text-[12px] font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={!valid || loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-3 text-[13px] font-bold text-white hover:bg-[#12365F] disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {ctaLabel}
          </button>
        </form>

        <p className="mt-3 text-[11px] text-slate-400">
          No spam. We use this to send you the document and occasional product updates.
        </p>
      </div>
    </div>
  );
}

export default LeadCaptureModal;
