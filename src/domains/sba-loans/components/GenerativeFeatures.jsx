// ── Generative Features Panel ──
// Prominent feature cards for structured parameter extraction and term sheet generation
// Elevates the Extract Parameters and Compile Term Sheet functionality with clear status indicators

import { Zap, FileText, Loader2 } from 'lucide-react';

export function GenerativeFeatures({
  onExtractParameters,
  onCompileTermSheet,
  extractLoading = false,
  compileLoading = false,
  extractStatus = null,
  compileStatus = null,
  dealNotes = '',
  onDealNotesChange,
  loanComplete = false,
  extractComplete = false,
}) {
  return (
    <section className="mb-8">
      <header className="mb-4 flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-900">SBA AI Workflow Tools</h2>
        <p className="text-sm text-slate-600">
          Use structured extraction and term-sheet generation to reduce manual re-entry.
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ── Feature 1: Extract Parameters ── */}
      <div className="bg-white border border-slate-300 rounded-md overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#1B3A6B] to-[#0A2540] px-6 py-4 flex items-start gap-4">
          <div className="flex-shrink-0 pt-1">
            <Zap className="w-6 h-6 text-yellow-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              Generate Loan Parameters
            </h3>
            <p className="text-sm text-slate-200 mt-1">
              Structured extraction from deal notes
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Deal Notes & Context
            </label>
            <textarea
              value={dealNotes}
              onChange={(e) => onDealNotesChange(e.target.value)}
              disabled={extractLoading}
              placeholder="Paste client notes, business summary, or deal structure details..."
              className="w-full h-24 px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20 focus:border-[#1B3A6B] disabled:opacity-50"
            />
          </div>

          <button
            onClick={onExtractParameters}
            disabled={extractLoading || !dealNotes.trim()}
            className={`w-full py-3 px-4 rounded-md font-bold uppercase tracking-wide transition-colors duration-150 flex items-center justify-center gap-2 ${
              extractLoading || !dealNotes.trim()
                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                : 'bg-[#1B3A6B] text-white hover:bg-[#0A2540]'
            }`}
          >
            {extractLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Parameters...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Generate Parameters
              </>
            )}
          </button>

          {/* Status Indicator */}
          {extractStatus && (
            <div
              className={`p-3 rounded text-sm font-medium text-center ${
                extractStatus === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : extractStatus === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {extractStatus === 'success' && 'Parameters extracted and populated'}
              {extractStatus === 'error' && 'Error extracting parameters. Please try again.'}
              {extractStatus === 'loading' && 'Extracting parameters...'}
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            BondSBA Terminal reads your notes and populates submission parameters automatically
          </p>
        </div>
      </div>

      {/* ── Feature 2: Compile Term Sheet ── */}
      <div className="bg-white border border-slate-300 rounded-md overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#0A2540] to-[#1B3A6B] px-6 py-4 flex items-start gap-4">
          <div className="flex-shrink-0 pt-1">
            <FileText className="w-6 h-6 text-blue-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              Create Term Sheet
            </h3>
            <p className="text-sm text-slate-200 mt-1">
              Institutional submission document
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Prerequisites:</span>
            </p>
            <ul className="text-sm text-slate-600 mt-2 space-y-1 ml-4 list-disc">
              <li className={extractComplete ? 'text-green-700' : 'text-slate-600'}>
                Loan parameters: {extractComplete ? 'Complete' : 'Pending'}
              </li>
              <li className={loanComplete ? 'text-green-700' : 'text-slate-600'}>
                Loan details: {loanComplete ? 'Complete' : 'Pending'}
              </li>
            </ul>
          </div>

          <button
            onClick={onCompileTermSheet}
            disabled={compileLoading || !loanComplete}
            className={`w-full py-3 px-4 rounded-md font-bold uppercase tracking-wide transition-colors duration-150 flex items-center justify-center gap-2 ${
              compileLoading || !loanComplete
                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                : 'bg-[#0A2540] text-white hover:bg-[#1B3A6B]'
            }`}
          >
            {compileLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Term Sheet...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Create Term Sheet
              </>
            )}
          </button>

          {/* Status Indicator */}
          {compileStatus && (
            <div
              className={`p-3 rounded text-sm font-medium text-center ${
                compileStatus === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : compileStatus === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {compileStatus === 'success' && 'Term sheet generated & ready for download'}
              {compileStatus === 'error' && 'Error generating term sheet. Please try again.'}
              {compileStatus === 'loading' && 'Generating term sheet...'}
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            Generates professional term sheet suitable for executive review
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}

export default GenerativeFeatures;
