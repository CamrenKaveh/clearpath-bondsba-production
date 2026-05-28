function normalizeSeverity(severity = 'medium') {
  const value = String(severity).toLowerCase();
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
}

function titleFromSource(source = 'analysis') {
  return source === 'wip' ? 'WIP Review' : source === 'spreading' ? 'Financial Review' : 'Submission Review';
}

function addUnique(items, entry, matcher = (item) => item === entry) {
  if (!items.some((item) => matcher(item))) {
    items.push(entry);
  }
}

function parseIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function computeDaysOld(isoDate) {
  const dt = parseIsoDate(isoDate);
  if (!dt) return null;
  return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
}

function computeReadinessScore({
  criticalCount,
  importantCount,
  supportingCount,
  staleFlagsCount,
  riskLevel,
  warningCount,
}) {
  let score = 100;
  score -= criticalCount * 18;
  score -= importantCount * 9;
  score -= supportingCount * 4;
  score -= staleFlagsCount * 6;
  score -= warningCount * 3;

  if (riskLevel === 'high') score -= 18;
  if (riskLevel === 'moderate') score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function deriveReadinessStatus(score) {
  if (score < 55) return 'not ready';
  if (score < 80) return 'conditionally ready';
  return 'ready for review';
}

export function buildUnderwritingSummary({ spreadingAnalysis, wipAnalysis, financials = {} }) {
  const summary = {
    overallRiskLevel: 'unknown',
    keyMetrics: {},
    recommendations: [],
    warnings: [],
  };

  const revenue = financials.revenue || 0;
  const netIncome = financials.netIncome || 0;
  const liabilities = financials.liabilities?.total || 0;
  const equity = financials.equity || 0;
  const assets = financials.assets || 0;

  const metrics = {
    profitMargin: revenue > 0 ? netIncome / revenue : 0,
    debtToEquity: equity > 0 ? liabilities / equity : liabilities > 0 ? 9999 : 0,
    debtToAssets: assets > 0 ? liabilities / assets : null,
  };
  summary.keyMetrics.financialRatios = metrics;

  if (spreadingAnalysis && !spreadingAnalysis.error) {
    if (spreadingAnalysis.asAllowed) {
      summary.keyMetrics.asAllowedNetIncome = spreadingAnalysis.asAllowed.asAllowedNetIncome;
      summary.keyMetrics.asAllowedMarginPercent = spreadingAnalysis.asAllowed.asAllowedNetIncomePercentage;
    }

    (spreadingAnalysis.riskFactors || []).forEach((factor, index) => {
      summary.warnings.push({
        source: 'spreading',
        code: factor.code || `SPREADING_${index + 1}`,
        severity: normalizeSeverity(factor.severity),
        message: factor.message,
      });
    });
  }

  if (wipAnalysis && !wipAnalysis.error) {
    if (wipAnalysis.wipSummary) {
      summary.keyMetrics.totalWIP = wipAnalysis.wipSummary.totalWIP;
      summary.keyMetrics.activeContracts = wipAnalysis.wipSummary.activeContracts;
      summary.keyMetrics.averageGrossMargin = wipAnalysis.wipSummary.averageGrossMargin;
    }

    if (wipAnalysis.bondExposure) {
      summary.keyMetrics.totalBondValue = wipAnalysis.bondExposure.totalBondValue;
      summary.keyMetrics.bondsAtRiskPercent = wipAnalysis.bondExposure.bondsAtRiskPercentage;
    }

    (wipAnalysis.riskAssessment || []).forEach((risk, index) => {
      summary.warnings.push({
        source: 'wip',
        code: risk.code || `WIP_${index + 1}`,
        severity: normalizeSeverity(risk.severity),
        message: risk.message,
        contractIds: risk.contractIds || [],
      });
    });
  }

  let riskScore = 0;

  if (metrics.profitMargin < 0) riskScore += 3;
  else if (metrics.profitMargin < 0.05) riskScore += 2;

  if (metrics.debtToEquity > 3) riskScore += 3;
  else if (metrics.debtToEquity > 1.5) riskScore += 1;

  if (metrics.debtToAssets !== null && metrics.debtToAssets > 0.7) riskScore += 2;

  const severityWeights = { critical: 4, high: 2, medium: 1, low: 0.5 };
  summary.warnings.forEach((warning) => {
    riskScore += severityWeights[warning.severity] || 1;
  });

  if (riskScore < 2) {
    summary.overallRiskLevel = 'low';
    summary.recommendations.push('File appears ready for standard underwriting review.');
  } else if (riskScore < 5) {
    summary.overallRiskLevel = 'moderate';
    summary.recommendations.push('Address follow-up items before sending the file deeper into review.');
  } else {
    summary.overallRiskLevel = 'high';
    summary.recommendations.push('Escalate to a senior reviewer after the follow-up list is addressed.');
  }

  if ((summary.keyMetrics.bondsAtRiskPercent || 0) >= 25) {
    summary.recommendations.push('Highlight stressed jobs and margin fade drivers in the underwriter cover memo.');
  }

  if ((summary.keyMetrics.asAllowedMarginPercent || 0) < 5 && revenue > 0) {
    summary.recommendations.push('Prepare a short explanation of current margin support and any normalization assumptions.');
  }

  return summary;
}

export function buildReadinessReport({
  documentName = '',
  documentType = 'general',
  parsed = {},
  spreadingAnalysis = null,
  wipAnalysis = null,
  underwritingSummary = {},
}) {
  const normalized = parsed.normalized || {};
  const financials = normalized.financials || {};
  const metadata = parsed.metadata || {};
  const warnings = underwritingSummary.warnings || [];

  const criticalMissingItems = [];
  const importantMissingItems = [];
  const supportingItems = [];
  const staleDocumentFlags = [];
  const followUpQuestions = [];
  const frictionFlags = [];
  const financialNotes = [];
  const wipNotes = [];
  const recommendedActions = [];

  if (!financials.revenue && !financials.grossProfit && !financials.netIncome) {
    addUnique(criticalMissingItems, 'Current fiscal-year financial statements with income statement and balance sheet.');
  }

  if (documentType !== 'tax-return') {
    addUnique(criticalMissingItems, 'Federal business tax returns with schedules.');
  }

  if (!wipAnalysis?.wipSummary?.activeContracts) {
    addUnique(criticalMissingItems, 'Current WIP schedule or backlog support for open jobs.');
  }

  if (!metadata?.tablesExtracted && !metadata?.hasTables) {
    addUnique(importantMissingItems, 'Tabular support that clearly shows contract status, billings, or financial detail.');
  }

  addUnique(importantMissingItems, 'Requested bond details, obligee context, and underlying opportunity summary.');
  addUnique(importantMissingItems, 'Organizational and indemnity support documents.');

  addUnique(supportingItems, 'Bank support letter or current relationship summary.');
  addUnique(supportingItems, 'Project concentration commentary for top jobs.');
  addUnique(supportingItems, 'Owner continuity / management bench context.');

  const uploadedAt = parseIsoDate(metadata?.uploadedAt || metadata?.processedAt || metadata?.uploaded_at);
  const financialAsOfAge = computeDaysOld(metadata?.financialAsOf || metadata?.statementDate || metadata?.statement_date);
  const wipAsOfAge = computeDaysOld(metadata?.wipAsOf || metadata?.wipDate || metadata?.wip_date);
  const uploadedAge = uploadedAt ? Math.floor((Date.now() - uploadedAt.getTime()) / (1000 * 60 * 60 * 24)) : null;

  if (financialAsOfAge !== null && financialAsOfAge > 90) {
    staleDocumentFlags.push(`Financial statement date is ${financialAsOfAge} days old.`);
  }
  if (wipAsOfAge !== null && wipAsOfAge > 60) {
    staleDocumentFlags.push(`WIP schedule date is ${wipAsOfAge} days old.`);
  }
  if (uploadedAge !== null && uploadedAge > 45) {
    staleDocumentFlags.push(`Uploaded packet is ${uploadedAge} days old and should be refreshed.`);
  }

  const marginPercent = underwritingSummary.keyMetrics?.asAllowedMarginPercent ?? 0;
  const debtToEquity = underwritingSummary.keyMetrics?.financialRatios?.debtToEquity ?? 0;
  const bondsAtRisk = underwritingSummary.keyMetrics?.bondsAtRiskPercent ?? 0;

  if (marginPercent < 5) {
    addUnique(financialNotes, 'As-allowed margin support is thin relative to the file presented.');
    addUnique(followUpQuestions, 'What explains the current margin profile, and which adjustments are expected to normalize earnings?');
    addUnique(recommendedActions, 'Prepare a short margin-bridge narrative for underwriter handoff.');
  } else {
    addUnique(financialNotes, 'Financial presentation appears usable for a first-pass surety review.');
  }

  if (debtToEquity > 3) {
    addUnique(financialNotes, 'Leverage looks elevated and may draw immediate questions around balance-sheet support.');
    addUnique(followUpQuestions, 'What outside support, liquidity, or banking relationships offset the current leverage profile?');
    addUnique(recommendedActions, 'Attach debt structure explanation and bank support note.');
  }

  if (bondsAtRisk >= 25) {
    addUnique(wipNotes, 'A meaningful share of open bond exposure appears to need job-level follow-up.');
    addUnique(followUpQuestions, 'Which jobs account for the stressed WIP exposure, and what is the remediation plan on each one?');
    addUnique(recommendedActions, 'Prioritize job-level action plan for stressed contracts.');
  } else if (wipAnalysis?.wipSummary?.activeContracts) {
    addUnique(wipNotes, 'Open job mix is available for review and can be packaged into a cleaner WIP conversation.');
  } else {
    addUnique(wipNotes, 'No live WIP schedule was available, so job-level stress testing is still incomplete.');
  }

  warnings.forEach((warning) => {
    addUnique(
      frictionFlags,
      {
        title: `${titleFromSource(warning.source)} Flag`,
        severity: warning.severity,
        detail: warning.message,
      },
      (item) => item.title === `${titleFromSource(warning.source)} Flag` && item.detail === warning.message
    );
  });

  if (!frictionFlags.length) {
    frictionFlags.push({
      title: 'No major automated flags detected',
      severity: 'low',
      detail: 'The file still needs a human review, but the first-pass analysis did not surface material automated concerns.',
    });
  }

  const readinessScore = computeReadinessScore({
    criticalCount: criticalMissingItems.length,
    importantCount: importantMissingItems.length,
    supportingCount: supportingItems.length,
    staleFlagsCount: staleDocumentFlags.length,
    riskLevel: underwritingSummary.overallRiskLevel,
    warningCount: warnings.length,
  });

  const readinessStatus = deriveReadinessStatus(readinessScore);

  const recommendedNextStep =
    readinessStatus === 'not ready'
      ? 'Close critical missing items and stale documents before the file reaches underwriting.'
      : readinessStatus === 'conditionally ready'
      ? 'Package a handoff memo that addresses key friction and confirms follow-up ownership.'
      : 'Move the file forward with a concise underwriter cover memo and supporting packet.';

  addUnique(recommendedActions, recommendedNextStep);
  addUnique(recommendedActions, 'Assign clear owner and due date for each unresolved blocker.');

  const artifactSummaries = [
    {
      id: 'cover-memo',
      title: 'Underwriter Cover Memo',
      summary: 'A concise summary of readiness status, key risks, and the exact follow-up points an underwriter should know first.',
    },
    {
      id: 'broker-summary',
      title: 'Broker Summary',
      summary: 'A partner-facing recap of what is complete, what still needs cleanup, and how to tighten the file before market submission.',
    },
    {
      id: 'checklist-packet',
      title: 'Submission Checklist Packet',
      summary: 'A document packet summary showing missing items, confirmed support, and the recommended order of follow-up.',
    },
    {
      id: 'wip-concern-summary',
      title: 'WIP Concern Summary',
      summary: 'A focused WIP note showing job-level concerns, stress indicators, and why certain contracts need attention.',
    },
  ];

  const missingItems = [...criticalMissingItems, ...importantMissingItems];
  const operationalConcernFlags = frictionFlags.map((flag) => `${flag.title}: ${flag.detail}`);
  const lenderReadyIndicator = readinessScore >= 70 && criticalMissingItems.length === 0 ? 'ready' : 'not-ready';
  const suretyReadyIndicator = readinessScore >= 75 && criticalMissingItems.length === 0 && staleDocumentFlags.length === 0
    ? 'ready'
    : 'not-ready';

  return {
    readinessStatus,
    readinessScore,
    readinessBreakdown: {
      criticalMissingItems,
      importantMissingItems,
      supportingItems,
      staleDocumentFlags,
    },
    missingItems,
    followUpQuestions,
    frictionFlags,
    financialNotes,
    wipNotes,
    operationalConcernFlags,
    recommendedActions,
    recommendedNextStep,
    lenderReadyIndicator,
    suretyReadyIndicator,
    artifactSummaries,
    sourceDocument: documentName,
    documentType,
    generatedAt: new Date().toISOString(),
    disclaimer: 'BondSBA provides workflow infrastructure, operational analysis, and readiness support tools. Outputs require professional review and do not replace underwriting, lending, accounting, legal, or surety decisions.',
  };
}
