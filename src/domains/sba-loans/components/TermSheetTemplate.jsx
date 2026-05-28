// ── Professional Term Sheet Template ──
// Renders a structured, institutional-quality term sheet suitable for executive review

export default function TermSheetTemplate({ data }) {
  if (!data) return null;

  const usd = (n) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const pct = (n) => `${(n * 100).toFixed(2)}%`;
  const feeRate = (value) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return `${value.toFixed(2)}%`;
    return 'TBD';
  };

  const waiveSavings = data.fees?.waiver_savings || 0;
  const isManufacturer = data.fees?.waiver_applicable;
  const handoff = data.handoff || {};

  return (
    <div
      id="term-sheet-printable"
      className="w-full bg-white text-slate-900"
      style={{
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: '11px',
        lineHeight: '1.5',
        color: '#0f172a'
      }}
    >
      {/* ── Header ── */}
      <div
        className="border-b-2 border-[#1B3A6B] pb-6 mb-6"
        style={{ backgroundColor: '#f8fafc', borderBottomColor: '#1B3A6B', padding: '24px' }}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h1
            style={{
              fontFamily: 'Merriweather, Georgia, serif',
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#0A2540',
              margin: 0
            }}
          >
            BondSBA
          </h1>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
            CONFIDENTIAL - CLIENT HANDOFF MEMO
          </div>
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#0A2540',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginTop: '4px'
          }}
        >
          SBA Term Sheet, Plain-English Summary & Professional Handoff
        </div>
      </div>

      {handoff.clientSummary && (
        <div
          style={{
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            padding: '16px',
            marginBottom: '24px'
          }}
        >
          <h2
            style={{
              fontFamily: 'Merriweather, Georgia, serif',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1B3A6B',
              margin: '0 0 8px 0'
            }}
          >
            CLIENT-FRIENDLY SUMMARY
          </h2>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.6', color: '#334155' }}>
            {data.plain_english || handoff.clientSummary}
          </p>
        </div>
      )}

      {handoff.professionalSummary && (
        <div className="mb-6">
          <h2
            style={{
              fontFamily: 'Merriweather, Georgia, serif',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1B3A6B',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}
          >
            PROFESSIONAL HANDOFF SUMMARY
          </h2>
          <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.6', color: '#334155' }}>
            {handoff.professionalSummary}
          </p>
        </div>
      )}

      {/* ── Parties ── */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#1B3A6B',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}
        >
          PARTIES TO THE TRANSACTION
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600', width: '30%' }}>Borrower:</td>
              <td style={{ padding: '8px 0' }}>{data.parties?.borrower}</td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Lender:</td>
              <td style={{ padding: '8px 0' }}>{data.parties?.lender}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Originating Officer:</td>
              <td style={{ padding: '8px 0' }}>{data.parties?.officer}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Facility Details ── */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#1B3A6B',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}
        >
          FACILITY AMOUNT & RATE
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600', width: '40%' }}>Requested Principal:</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                {usd(data.facility?.amount)}
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Program:</td>
              <td style={{ padding: '8px 0' }}>{data.facility?.program}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Interest Rate:</td>
              <td style={{ padding: '8px 0' }}>
                {data.facility?.index} + {data.facility?.margin}% = {data.facility?.annual_rate}%
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Amortization Term:</td>
              <td style={{ padding: '8px 0' }}>{data.facility?.term} years ({data.facility?.payments} monthly payments)</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Monthly Debt Service:</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                {usd(data.debt_service?.monthly)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Fees ── */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#1B3A6B',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}
        >
          ORIGINATION & GUARANTY FEES
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600', width: '50%' }}>
                SBA Origination Fee (Standard):
              </td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                {data.fees?.origination_pct?.toFixed(2)}% ({usd(data.fees?.origination)})
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>SBA Guaranty Fee (Standard):</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                {isManufacturer ? '0% (WAIVED)' : `${feeRate(data.fees?.guaranty_pct)} (${usd(data.fees?.guaranty)})`}
              </td>
            </tr>
            {isManufacturer && (
              <tr
                style={{
                  backgroundColor: '#fef3c7',
                  borderLeft: '4px solid #f59e0b',
                  padding: '12px'
                }}
              >
                <td colSpan="2" style={{ padding: '12px', fontWeight: 'bold', color: '#92400e' }}>
                  FY2026 MANUFACTURER GUARANTY FEE WAIVER APPLIES
                </td>
              </tr>
            )}
            {isManufacturer && (
              <tr style={{ backgroundColor: '#fef3c7', borderBottom: '1px solid #f59e0b' }}>
                <td style={{ padding: '8px 12px', fontWeight: '600' }}>Waiver Savings:</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {usd(waiveSavings)}
                </td>
              </tr>
            )}
            <tr style={{ backgroundColor: '#f0f9ff', fontWeight: 'bold', borderTop: '2px solid #1B3A6B' }}>
              <td style={{ padding: '12px 0' }}>Net Proceeds to Borrower:</td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                {usd(data.facility?.amount - data.fees?.total_fees)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {handoff.sourcesAndUses && (
        <div className="mb-6">
          <h2
            style={{
              fontFamily: 'Merriweather, Georgia, serif',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1B3A6B',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}
          >
            SOURCES & USES
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {(handoff.sourcesAndUses.sources || []).map((item, idx) => (
                <tr key={`source-${item.label}`} style={{ backgroundColor: idx % 2 ? '#f8fafc' : 'white' }}>
                  <td style={{ padding: '8px 0', fontWeight: '600' }}>{item.label}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace' }}>{usd(item.amount)}</td>
                </tr>
              ))}
              {(handoff.sourcesAndUses.uses || []).map((item) => (
                <tr key={`use-${item.label}`} style={{ backgroundColor: '#f0f9ff', borderTop: '1px solid #bae6fd' }}>
                  <td style={{ padding: '8px 0', fontWeight: '600' }}>Use: {item.label}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace' }}>{usd(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Equity Injection ── */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#1B3A6B',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}
        >
          REQUIRED EQUITY INJECTION
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600', width: '50%' }}>Equity Required:</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                {pct(data.equity?.required_pct / 100)}
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Amount:</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                {usd(data.equity?.required_amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Collateral ── */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#1B3A6B',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}
        >
          COLLATERAL REQUIREMENTS
        </h2>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          {(data.collateral || []).map((item, i) => (
            <li key={i} style={{ padding: '4px 0', fontSize: '11px' }}>
              {item}
            </li>
          ))}
        </ul>
        {(!data.collateral || data.collateral.length === 0) && (
          <p style={{ fontSize: '11px', color: '#64748b' }}>Commercial real estate and/or equipment as primary collateral.</p>
        )}
      </div>

      {/* ── Financial Covenants ── */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#1B3A6B',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}
        >
          FINANCIAL COVENANTS
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600', width: '50%' }}>Minimum DSCR:</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                {data.covenants?.dscr_min?.toFixed(2)}x
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Minimum Current Ratio:</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                {data.covenants?.current_ratio_min?.toFixed(2)}x
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Maximum Debt-to-Equity:</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                {data.covenants?.debt_ratio_max?.toFixed(2)}x
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '8px 0', fontWeight: '600' }}>Compliance Testing:</td>
              <td style={{ padding: '8px 0' }}>{data.covenants?.testing_frequency}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Underwriting Narrative ── */}
      {data.narrative && (
        <div className="mb-6">
          <h2
            style={{
              fontFamily: 'Merriweather, Georgia, serif',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1B3A6B',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}
          >
            UNDERWRITING NARRATIVE
          </h2>
          <p
            style={{
              fontSize: '11px',
              lineHeight: '1.6',
              color: '#334155',
              margin: 0
            }}
          >
            {data.narrative}
          </p>
        </div>
      )}

      {handoff.nextSteps?.length > 0 && (
        <div className="mb-6">
          <h2
            style={{
              fontFamily: 'Merriweather, Georgia, serif',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1B3A6B',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}
          >
            NEXT STEPS FOR CLIENT / LENDER HANDOFF
          </h2>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            {handoff.nextSteps.map((step, index) => (
              <li key={`${step}-${index}`} style={{ padding: '4px 0', fontSize: '11px', color: '#334155' }}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Effective Dates ── */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          padding: '12px',
          marginBottom: '24px',
          borderLeft: '4px solid #1B3A6B'
        }}
      >
        <table style={{ width: '100%', fontSize: '10px' }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: '600' }}>Effective Date:</td>
              <td>{data.effective_date}</td>
              <td style={{ fontWeight: '600', paddingLeft: '24px' }}>Maturity Date:</td>
              <td>{data.maturity_date}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Legal Disclaimer ── */}
      <div
        style={{
          backgroundColor: '#f1f5f9',
          border: '1px solid #cbd5e1',
          padding: '16px',
          marginTop: '24px',
          fontSize: '9px',
          lineHeight: '1.6',
          color: '#475569',
          fontStyle: 'italic'
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>CONFIDENTIAL DISCLAIMER</p>
        <p style={{ margin: 0 }}>
          This term sheet is provided for discussion and preliminary evaluation purposes only. It does not
          constitute a commitment, obligation, or offer to lend. The term sheet remains fully subject to credit
          approval, satisfactory completion of due diligence, legal documentation review, and final board approval.
          All material terms and conditions are subject to further negotiation. SBA guarantees are subject to
          applicable SBA policy, lending limits, and program guidelines in effect at the time of final approval.
          FY2026 manufacturer guaranty fee waivers apply only to approved NAICS codes 31–33 and are subject to
          SBA policy changes. This document is for authorized use only and may not be distributed without written
          consent.
        </p>
      </div>
    </div>
  );
}
