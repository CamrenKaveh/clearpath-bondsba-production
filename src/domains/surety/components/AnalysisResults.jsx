import React, { useState } from 'react';

export function AnalysisResults({ analysis }) {
  const [expandedSection, setExpandedSection] = useState('summary');
  const summary = analysis?.underwritingSummary || {};
  const spreading = analysis?.spreadingAnalysis;
  const wip = analysis?.wipAnalysis;

  const getRiskColor = (level) => {
    const colors = {
      critical: 'bg-red-100 text-red-900 border-red-300',
      high: 'bg-orange-100 text-orange-900 border-orange-300',
      moderate: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      low: 'bg-green-100 text-green-900 border-green-300',
    };
    return colors[level] || colors.moderate;
  };

  const getRiskBadgeColor = (level) => {
    const colors = {
      critical: 'bg-red-600',
      high: 'bg-orange-600',
      moderate: 'bg-yellow-600',
      low: 'bg-green-600',
    };
    return colors[level] || colors.moderate;
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className={`rounded-lg border-2 p-8 ${getRiskColor(summary.overallRiskLevel)}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Underwriting Summary</h2>
          <div className={`${getRiskBadgeColor(summary.overallRiskLevel)} text-white px-4 py-2 rounded-lg font-semibold text-lg`}>
            {summary.overallRiskLevel?.toUpperCase()}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summary.keyMetrics?.asAllowedNetIncome !== undefined && (
            <div className="bg-white bg-opacity-50 rounded p-4">
              <p className="text-sm font-medium opacity-75">As-Allowed Net Income</p>
              <p className="text-2xl font-bold mt-1">
                ${(summary.keyMetrics.asAllowedNetIncome || 0).toLocaleString()}
              </p>
            </div>
          )}

          {summary.keyMetrics?.asAllowedMarginPercent !== undefined && (
            <div className="bg-white bg-opacity-50 rounded p-4">
              <p className="text-sm font-medium opacity-75">As-Allowed Margin %</p>
              <p className="text-2xl font-bold mt-1">
                {(summary.keyMetrics.asAllowedMarginPercent || 0).toFixed(2)}%
              </p>
            </div>
          )}

          {summary.keyMetrics?.totalWIP !== undefined && (
            <div className="bg-white bg-opacity-50 rounded p-4">
              <p className="text-sm font-medium opacity-75">Total WIP</p>
              <p className="text-2xl font-bold mt-1">
                ${(summary.keyMetrics.totalWIP || 0).toLocaleString()}
              </p>
            </div>
          )}

          {summary.keyMetrics?.bondsAtRiskPercent !== undefined && (
            <div className="bg-white bg-opacity-50 rounded p-4">
              <p className="text-sm font-medium opacity-75">Bonds at Risk %</p>
              <p className="text-2xl font-bold mt-1">
                {(summary.keyMetrics.bondsAtRiskPercent || 0).toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {summary.recommendations && summary.recommendations.length > 0 && (
          <div className="bg-white bg-opacity-50 rounded p-4">
            <h3 className="font-semibold mb-2">Recommendations</h3>
            <ul className="space-y-1 text-sm">
              {summary.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Warnings/Risk Factors */}
      {summary.warnings && summary.warnings.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Risk Factors</h3>
          <div className="space-y-3">
            {summary.warnings.map((warning, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border-l-4 ${
                  warning.severity === 'critical'
                    ? 'bg-red-50 border-red-500 text-red-900'
                    : warning.severity === 'high'
                    ? 'bg-orange-50 border-orange-500 text-orange-900'
                    : 'bg-yellow-50 border-yellow-500 text-yellow-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{warning.code}</p>
                    <p className="text-sm mt-1">{warning.message}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase px-2 py-1 bg-white bg-opacity-50 rounded">
                    {warning.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spreading Analysis */}
      {spreading && !spreading.error && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <button
            onClick={() => setExpandedSection(expandedSection === 'spreading' ? null : 'spreading')}
            className="w-full flex items-center justify-between text-xl font-bold text-slate-900 hover:text-blue-600 transition-colors"
          >
            <span>Spreading Analysis</span>
            <svg
              className={`w-6 h-6 transition-transform ${expandedSection === 'spreading' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {expandedSection === 'spreading' && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {spreading.original && (
                  <>
                    <div className="bg-slate-50 p-4 rounded">
                      <p className="text-xs text-slate-600 font-semibold">Original Revenue</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">
                        ${(spreading.original.revenue || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded">
                      <p className="text-xs text-slate-600 font-semibold">Original Net Income</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">
                        ${(spreading.original.netIncome || 0).toLocaleString()}
                      </p>
                    </div>
                  </>
                )}

                {spreading.asAllowed && (
                  <>
                    <div className="bg-green-50 p-4 rounded border border-green-200">
                      <p className="text-xs text-green-700 font-semibold">As-Allowed Net Income</p>
                      <p className="text-xl font-bold text-green-900 mt-1">
                        ${(spreading.asAllowed.asAllowedNetIncome || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded border border-green-200">
                      <p className="text-xs text-green-700 font-semibold">Total Adjustments</p>
                      <p className="text-xl font-bold text-green-900 mt-1">
                        ${(spreading.asAllowed.totalAdjustments || 0).toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {spreading.adjustments && (
                <div className="bg-slate-50 p-4 rounded mt-4">
                  <h4 className="font-semibold text-slate-900 mb-3">Adjustment Details</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(spreading.adjustments).map(([key, adj]) => (
                      <div key={key} className="flex justify-between items-center py-1 border-b border-slate-200">
                        <span className="text-slate-700">{adj.rule}</span>
                        <span className={`font-semibold ${adj.addBack ? 'text-green-600' : 'text-red-600'}`}>
                          {adj.addBack ? '+' : '-'}${Math.abs(adj.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* WIP Analysis */}
      {wip && !wip.error && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <button
            onClick={() => setExpandedSection(expandedSection === 'wip' ? null : 'wip')}
            className="w-full flex items-center justify-between text-xl font-bold text-slate-900 hover:text-blue-600 transition-colors"
          >
            <span>Work-in-Progress & Bond Analysis</span>
            <svg
              className={`w-6 h-6 transition-transform ${expandedSection === 'wip' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {expandedSection === 'wip' && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {wip.wipSummary && (
                  <>
                    <div className="bg-slate-50 p-4 rounded">
                      <p className="text-xs text-slate-600 font-semibold">Active Contracts</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">
                        {wip.wipSummary.activeContracts || 0}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded">
                      <p className="text-xs text-slate-600 font-semibold">Avg Gross Margin</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">
                        {(wip.wipSummary.averageGrossMargin || 0).toFixed(2)}%
                      </p>
                    </div>
                  </>
                )}

                {wip.bondExposure && (
                  <>
                    <div className="bg-slate-50 p-4 rounded">
                      <p className="text-xs text-slate-600 font-semibold">Total Bond Value</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">
                        ${(wip.bondExposure.totalBondValue || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded border border-red-200">
                      <p className="text-xs text-red-700 font-semibold">Bonds at Risk %</p>
                      <p className="text-2xl font-bold text-red-900 mt-1">
                        {(wip.bondExposure.bondsAtRiskPercentage || 0).toFixed(1)}%
                      </p>
                    </div>
                  </>
                )}
              </div>

              {wip.contractAnalysis && wip.contractAnalysis.length > 0 && (
                <div className="bg-slate-50 p-4 rounded mt-4">
                  <h4 className="font-semibold text-slate-900 mb-3">Contract Summary</h4>
                  <div className="space-y-2 text-sm">
                    {wip.contractAnalysis.slice(0, 5).map((contract, i) => (
                      <div key={i} className="py-2 border-b border-slate-200">
                        <div className="flex justify-between">
                          <span className="font-medium text-slate-900">{contract.name}</span>
                          <span className="text-slate-600">{contract.percentComplete}% complete</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600 mt-1">
                          <span>Margin: {contract.grossMarginToDated?.toFixed(2)}%</span>
                          <span>${(contract.contractValue || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Document Info */}
      <div className="bg-slate-50 rounded-lg p-6 text-sm text-slate-600">
        <p>
          <span className="font-semibold">Analysis ID:</span>{' '}
          {analysis?.metadata?.documentId}
        </p>
        <p className="mt-2">
          <span className="font-semibold">Generated:</span>{' '}
          {new Date(analysis?.metadata?.analysisDate).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
