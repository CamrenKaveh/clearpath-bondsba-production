// ── Premium Form Wrapper ──
// Professional, institutional form styling with progress indicators and large touch targets
// Used by EligibilityScreener, DocumentChecklist, and other multi-step forms

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function PremiumForm({
  title,
  subtitle,
  currentStep = 1,
  totalSteps = 1,
  children,
  onBack,
  onNext,
  onSubmit,
  nextLabel = 'Continue',
  backLabel = 'Back',
  submitLabel = 'Submit',
  backDisabled = false,
  nextDisabled = false,
  isLastStep = false,
}) {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Progress Bar */}
      {totalSteps > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wide">
            <span>{title}</span>
            <span className="tabular-nums">
              Step {currentStep} / {totalSteps}
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-sm overflow-hidden">
            <div
              className="h-full bg-[#1B3A6B] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Form Container */}
      <div className="border border-slate-200 overflow-hidden bg-white shadow-sm" role="form" aria-label={title}>
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="font-serif text-lg font-bold text-slate-900 mb-1">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-600 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {children}
        </div>

        {/* Footer with Navigation */}
        {(onBack || onNext || onSubmit) && (
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={onBack}
              disabled={backDisabled}
              className={`inline-flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-lg border transition-colors duration-150 cursor-pointer uppercase tracking-wide
                ${backDisabled
                  ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
                  : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
              {backLabel}
            </button>

            <div className="flex items-center gap-3">
              {!isLastStep && onNext && (
                <button
                  onClick={onNext}
                  disabled={nextDisabled}
                  className={`inline-flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-lg border transition-colors duration-150 cursor-pointer uppercase tracking-wide
                    ${nextDisabled
                      ? 'bg-slate-300 text-slate-600 border-slate-400 cursor-not-allowed'
                      : 'bg-[#0B1F3A] text-white border-[#0B1F3A] hover:bg-[#12365F]'
                    }`}
                >
                  {nextLabel}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {isLastStep && onSubmit && (
                <button
                  onClick={onSubmit}
                  disabled={nextDisabled}
                  className={`inline-flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-lg border transition-colors duration-150 cursor-pointer uppercase tracking-wide
                    ${nextDisabled
                      ? 'bg-slate-300 text-slate-600 border-slate-400 cursor-not-allowed'
                      : 'bg-[#0B1F3A] text-white border-[#0B1F3A] hover:bg-[#12365F]'
                    }`}
                >
                  {submitLabel}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Radio Option Component (for larger touch targets) ──
export function PremiumRadioOption({
  value,
  selected,
  label,
  description,
  flag,
  onChange,
}) {
  const flagConfig = {
    red: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', label: 'Disqualifying' },
    yellow: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', label: 'Conditional' },
    none: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-900', label: '' },
  };
  const cfg = flagConfig[flag] || flagConfig.none;

  return (
    <button
      onClick={() => onChange(value)}
      className={`w-full text-left px-4 py-3 border-2 rounded-sm transition-all duration-150 cursor-pointer flex items-start gap-3 ${
        selected
          ? `bg-[#0A2540] border-[#1B3A6B] text-white`
          : `${cfg.bg} ${cfg.border} hover:border-slate-400 hover:bg-slate-50`
      }`}
    >
      {/* Custom radio button */}
      <div
        className={`w-5 h-5 mt-0.5 border-2 rounded-full shrink-0 flex items-center justify-center transition-colors duration-150 ${
          selected
            ? 'border-white bg-[#1B3A6B]'
            : `border-slate-400 bg-white`
        }`}
      >
        {selected && (
          <div className="w-2 h-2 bg-white rounded-full" />
        )}
      </div>

      {/* Label and description */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold mb-0.5 ${selected ? 'text-white' : 'text-slate-900'}`}>
          {label}
        </p>
        {description && (
          <p className={`text-xs leading-relaxed ${selected ? 'text-slate-100' : 'text-slate-600'}`}>
            {description}
          </p>
        )}
      </div>

      {/* Flag badge */}
      {flag && flag !== 'none' && (
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 border rounded-sm shrink-0 ${cfg.bg} ${cfg.border} border ${cfg.text}`}>
          {cfg.label}
        </span>
      )}
    </button>
  );
}

// ── Checkbox Option Component ──
export function PremiumCheckboxOption({
  value,
  checked,
  label,
  description,
  onChange,
}) {
  return (
    <label className="flex items-start gap-3 px-4 py-3 border border-slate-200 rounded-sm cursor-pointer group hover:bg-slate-50 transition-colors duration-150">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(value, e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-[#1B3A6B] cursor-pointer"
      />
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-slate-900">{label}</p>
        {description && (
          <p className="text-xs text-slate-600 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

// ── Form Input Field (Premium styling) ──
export function PremiumInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  hint,
  id,
  required = false,
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white border rounded-sm text-base font-normal text-slate-900 placeholder-slate-500 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent ${
          disabled
            ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed'
            : 'border-slate-300 focus:bg-white hover:border-slate-400'
        }`}
      />
      {hint && (
        <p className="text-xs text-slate-600 mt-1">{hint}</p>
      )}
    </div>
  );
}

// ── Form Select (Premium styling) ──
export function PremiumSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  hint,
  id,
  required = false,
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white border rounded-sm text-base font-normal text-slate-900 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent ${
          disabled
            ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed'
            : 'border-slate-300 focus:bg-white hover:border-slate-400'
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && (
        <p className="text-xs text-slate-600 mt-1">{hint}</p>
      )}
    </div>
  );
}

export default PremiumForm;
