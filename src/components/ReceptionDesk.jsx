/**
 * ReceptionDesk — homepage entry.
 * Split wordmark Bond | SBA. Each half lights when hovering the matching glass
 * panel — the product name itself is the interaction. Click routes into the
 * full lane home page (/sba or /bonds).
 */
import React, { useState } from 'react';
import { Shield, Landmark, ArrowRight } from 'lucide-react';

export function ReceptionDesk({ onPickLane }) {
  const [hover, setHover] = useState(null); // 'bond' | 'sba' | null

  const pick = (lane) => onPickLane?.(lane);

  return (
    <section className="reception-desk relative overflow-hidden pt-10 pb-12 md:pt-16 md:pb-20">
      <div aria-hidden className="reception-ambient" />
      <div className="relative mx-auto max-w-5xl px-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          BondSBA Terminal
        </p>

        {/* Split wordmark — each half lights on the matching hover */}
        <h1 className="mt-3 text-[64px] font-semibold leading-[1.02] tracking-[-0.04em] md:text-[88px] xl:text-[112px]">
          <span
            className={`reception-wordmark-half transition-all duration-300 ${
              hover === 'bond'
                ? 'text-[#0B1F3A] drop-shadow-[0_2px_24px_rgba(11,31,58,0.25)]'
                : hover === 'sba'
                ? 'text-slate-300'
                : 'text-slate-900'
            }`}
          >
            Bond
          </span>
          <span
            className={`reception-wordmark-half transition-all duration-300 ${
              hover === 'sba'
                ? 'text-emerald-700 drop-shadow-[0_2px_24px_rgba(5,150,105,0.25)]'
                : hover === 'bond'
                ? 'text-slate-300'
                : 'text-slate-900'
            }`}
          >
            SBA
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-slate-600 md:text-[16px]">
          Two workflows under one roof. Pick a side to enter.
        </p>

        {/* Glass panels */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-6">
          {/* Bond side */}
          <button
            type="button"
            onMouseEnter={() => setHover('bond')}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover('bond')}
            onBlur={() => setHover(null)}
            onClick={() => pick('bond')}
            className="reception-panel reception-panel-bond group text-left"
          >
            <div className="reception-glass-sheen" aria-hidden />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white/70 backdrop-blur">
                  <Shield className="h-5 w-5 text-[#0B1F3A]" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Surety</span>
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bond side</p>
              <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[26px]">Bond readiness and WIP analysis.</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                Score contractor files, review WIP risk, and produce a structured surety packet before carrier submission.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-[#0B1F3A]">
                Enter the bond side <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>

          {/* SBA side */}
          <button
            type="button"
            onMouseEnter={() => setHover('sba')}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover('sba')}
            onBlur={() => setHover(null)}
            onClick={() => pick('sba')}
            className="reception-panel reception-panel-sba group text-left"
          >
            <div className="reception-glass-sheen" aria-hidden />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white/70 backdrop-blur">
                  <Landmark className="h-5 w-5 text-emerald-700" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">SBA Lending</span>
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">SBA side</p>
              <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[26px]">SBA eligibility, calculators, and file prep.</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                Screen 7(a) eligibility, calculate guaranty fees, and build the lender packet — before the file moves.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                Enter the SBA side <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        </div>

        <p className="mt-6 text-[11px] text-slate-400">
          No sign-up required to preview tools
        </p>
      </div>
    </section>
  );
}
