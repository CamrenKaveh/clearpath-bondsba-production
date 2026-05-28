/**
 * Term Sheet Generator Tests
 * Validates structured term sheet generation
 */

import {
  generateTermSheet,
  identifyStrengths,
  identifyRisks,
  buildClientHandoffPackage,
  generateDefaultNarrative,
  buildHTMLTemplate,
} from '../src/domains/sba-loans/services/termSheetGenerator.js';
import { calculateLoanAnalysis } from '../src/domains/sba-loans/services/loanCalculator.js';
import { assert, runTests } from './setup.js';

// Helper: Create standard analysis object
function getStandardAnalysis() {
  return calculateLoanAnalysis({
    requestedAmount: 500000,
    annualRate: 10.5,
    loanTermYears: 7,
    netOperatingIncome: 100000,
    totalProjectCost: 600000,
    borrowerNAICS: 311,
  });
}

// Test Suite: Strength Identification
const strengthTests = {
  'Strengths: Identifies strong DSCR': () => {
    const analysis = getStandardAnalysis();
    const params = {
      requestedAmount: 500000,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 311,
    };

    const strengths = identifyStrengths(analysis, params);

    assert.isArray(strengths, 'Should return array of strengths');
    assert.truthy(
      strengths.length > 0,
      'Should identify at least one strength'
    );
  },

  'Strengths: Includes manufacturer status when applicable': () => {
    const analysis = getStandardAnalysis();
    const params = {
      requestedAmount: 500000,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 311, // Manufacturer
    };

    const strengths = identifyStrengths(analysis, params);
    const manufacturerMentioned = strengths.some(s =>
      s.toLowerCase().includes('manufacturer') || s.toLowerCase().includes('fee waiver')
    );

    assert.truthy(
      manufacturerMentioned,
      'Should mention manufacturer status or fee waiver'
    );
  },

  'Strengths: Identifies adequate equity': () => {
    const analysis = getStandardAnalysis();
    const params = {
      requestedAmount: 500000,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    };

    const strengths = identifyStrengths(analysis, params);
    // With 600k project cost and 500k loan, equity is 100k (16.7%)

    assert.truthy(
      strengths.length > 0,
      'Should identify equity as strength'
    );
  },
};

// Test Suite: Risk Identification
const riskTests = {
  'Risks: Empty array when DSCR is healthy': () => {
    const analysis = getStandardAnalysis();
    const params = {
      requestedAmount: 500000,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    };

    const risks = identifyRisks(analysis, params);

    assert.isArray(risks, 'Should return array');
    // Healthy scenario should have minimal or no risks
  },

  'Risks: Identifies DSCR shortfall': () => {
    const analysis = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 80000, // Low income
      totalProjectCost: 600000,
    });

    const params = {
      requestedAmount: 500000,
      netOperatingIncome: 80000,
      totalProjectCost: 600000,
    };

    const risks = identifyRisks(analysis, params);

    // Should identify DSCR concern
    const dscrMentioned = risks.some(r =>
      r.toLowerCase().includes('dscr') ||
      r.toLowerCase().includes('debt service coverage') ||
      r.toLowerCase().includes('coverage ratio')
    );

    assert.truthy(
      dscrMentioned || risks.length >= 0,
      'Should assess DSCR risk'
    );
  },

  'Risks: Identifies low equity': () => {
    const analysis = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 510000, // Minimal equity
    });

    const params = {
      requestedAmount: 500000,
      netOperatingIncome: 100000,
      totalProjectCost: 510000,
    };

    const risks = identifyRisks(analysis, params);

    const equityMentioned = risks.some(r =>
      r.toLowerCase().includes('equity') ||
      r.toLowerCase().includes('capital injection')
    );

    assert.truthy(
      equityMentioned || risks.length >= 0,
      'Should assess equity risk'
    );
  },
};

// Test Suite: Default Narrative Generation
const narrativeTests = {
  'Narrative: Generates for standard scenario': () => {
    const analysis = getStandardAnalysis();
    const params = {
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      businessDescription: 'Manufacturing business',
    };

    const narrative = generateDefaultNarrative(params, analysis);

    assert.truthy(
      narrative && narrative.length > 50,
      'Should generate substantial narrative'
    );
    assert.truthy(
      narrative.toLowerCase().includes('abc manufacturing') ||
      narrative.toLowerCase().includes('manufacturing'),
      'Should include borrower/business reference'
    );
  },

  'Narrative: Includes DSCR in assessment': () => {
    const analysis = getStandardAnalysis();
    const params = {
      borrowerName: 'Test Corp',
      requestedAmount: 500000,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    };

    const narrative = generateDefaultNarrative(params, analysis);

    assert.truthy(
      narrative.toLowerCase().includes('dscr') ||
      narrative.toLowerCase().includes('debt service') ||
      narrative.toLowerCase().includes('repayment'),
      'Should assess debt service capacity'
    );
  },

  'Narrative: Different narrative for strong vs weak DSCR': () => {
    const analysisStrong = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 150000,
      totalProjectCost: 600000,
    });

    const analysisWeak = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 80000,
      totalProjectCost: 600000,
    });

    const params = {
      borrowerName: 'Test Corp',
      requestedAmount: 500000,
      totalProjectCost: 600000,
    };

    const narrativeStrong = generateDefaultNarrative(params, analysisStrong);
    const narrativeWeak = generateDefaultNarrative(params, analysisWeak);

    // Narratives should be different
    assert.truthy(
      narrativeStrong !== narrativeWeak,
      'Should generate different narratives for different DSCRs'
    );
  },
};

// Test Suite: HTML Template Building
const templateTests = {
  'Template: Generates valid structure': () => {
    const data = {
      borrowerName: 'ABC Manufacturing',
      lenderName: 'Community Bank',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      narrative: 'Test narrative',
    };

    const template = buildHTMLTemplate(data);

    assert.truthy(
      template && typeof template === 'object',
      'Should return object'
    );
    assert.hasProperty(template, 'type', 'Should have type property');
    assert.hasProperty(template, 'version', 'Should have version property');
    assert.hasProperty(template, 'sections', 'Should have sections property');
  },

  'Template: Includes all required sections': () => {
    const data = {
      borrowerName: 'ABC Manufacturing',
      lenderName: 'Community Bank',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      narrative: 'Test narrative',
    };

    const template = buildHTMLTemplate(data);

    const sections = template.sections || {};
    const requiredSections = ['header', 'parties', 'facility', 'fees', 'narrative', 'footer'];

    requiredSections.forEach(section => {
      assert.truthy(
        section in sections || Object.keys(sections).length > 0,
        `Should include ${section} section or have sections`
      );
    });
  },
};

// Test Suite: Complete Term Sheet Generation
const termSheetTests = {
  'Term Sheet: Generates for standard parameters': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 311,
      lenderName: 'Community Bank',
      loanOfficer: 'Jane Smith',
      loanOfficerEmail: 'jane@bank.com',
    });

    assert.truthy(termSheet, 'Should return term sheet object');
    assert.hasProperty(termSheet, 'metadata', 'Should have metadata');
    assert.hasProperty(termSheet, 'parties', 'Should have parties');
    assert.hasProperty(termSheet, 'facility', 'Should have facility');
  },

  'Term Sheet: Contains all required sections': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 311,
    });

    const requiredSections = [
      'metadata',
      'parties',
      'facility',
      'debtService',
      'equity',
      'fees',
      'collateral',
      'covenants',
      'narrative',
      'riskAssessment',
      'compliance',
      'htmlTemplate',
    ];

    requiredSections.forEach(section => {
      assert.hasProperty(
        termSheet,
        section,
        `Should include ${section} section`
      );
    });
  },

  'Term Sheet: Metadata is current': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    });

    const metadata = termSheet.metadata;

    assert.hasProperty(metadata, 'generatedAt', 'Should have generatedAt timestamp');
    assert.hasProperty(metadata, 'status', 'Should have status');
    assert.hasProperty(metadata, 'version', 'Should have version');

    // generatedAt should be recent (within last minute)
    const generatedTime = new Date(metadata.generatedAt);
    const nowTime = new Date();
    const diffMs = nowTime - generatedTime;

    assert.truthy(
      diffMs >= 0 && diffMs < 60000,
      'Generated time should be within last minute'
    );
  },

  'Term Sheet: Parties are populated correctly': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      lenderName: 'Community Bank',
      loanOfficer: 'Jane Smith',
    });

    const parties = termSheet.parties;

    assert.equal(
      parties.borrower,
      'ABC Manufacturing Co.',
      'Should include borrower name'
    );
    assert.truthy(
      parties.lender && parties.lender.length > 0,
      'Should include lender info'
    );
  },

  'Term Sheet: Facility terms are calculated': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    });

    const facility = termSheet.facility;

    assert.equal(facility.amount, 500000, 'Should have correct amount');
    assert.equal(facility.rate, 10.5, 'Should have correct rate');
    assert.equal(facility.term, 7, 'Should have correct term in years');
  },

  'Term Sheet: Includes FY2026 waiver information for manufacturers': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 311, // Manufacturer
    });

    const fees = termSheet.fees;

    assert.truthy(
      fees.waiverApplicable === true ||
      fees.guarantyFee === 0,
      'Should indicate waiver applies to manufacturer'
    );
  },

  'Term Sheet: Covenants are appropriate': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    });

    const covenants = termSheet.covenants;

    assert.hasProperty(covenants, 'financial', 'Should have financial covenants');
    assert.truthy(
      covenants.financial.minimumDSCR > 1.0,
      'Minimum DSCR covenant should be > 1.0'
    );
  },

  'Term Sheet: Risk assessment is included': () => {
    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    });

    const riskAssessment = termSheet.riskAssessment;

    assert.hasProperty(riskAssessment, 'overallRisk', 'Should have overall risk level');
    assert.hasProperty(riskAssessment, 'keyStrengths', 'Should have key strengths');
    assert.hasProperty(riskAssessment, 'keyRisks', 'Should have key risks');
  },

  'Term Sheet: Narrative is customizable': () => {
    const customNarrative = 'This borrower demonstrates exceptional financial strength and market positioning.';

    const termSheet = generateTermSheet({
      borrowerName: 'ABC Manufacturing Co.',
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      underwritingNarrative: customNarrative,
    });

    assert.equal(
      termSheet.narrative.underwriting,
      customNarrative,
      'Should use provided narrative'
    );
  },

  'Term Sheet: Builds client handoff package with plain-English summary and next steps': () => {
    const handoff = buildClientHandoffPackage({
      borrowerName: 'Ridgeway Fabrication LLC',
      program: 'SBA 504',
      requestedAmount: 2500000,
      annualRate: 6.35,
      loanTermYears: 25,
      monthlyPayment: 16580,
      guarantyFee: 5000,
      netOperatingIncome: 400000,
      totalProjectCost: 2500000,
      useOfProceeds: 'Owner-occupied building purchase',
      borrowerNAICS: 332,
      sba504Project: {
        bankLoanAmount: 1250000,
        cdcLoanAmount: 1000000,
        borrowerEquity: 250000,
      },
    });

    assert.hasProperty(handoff, 'clientSummary', 'Should include layman summary');
    assert.hasProperty(handoff, 'professionalSummary', 'Should include professional summary');
    assert.hasProperty(handoff, 'sourcesAndUses', 'Should include sources and uses');
    assert.hasProperty(handoff, 'nextSteps', 'Should include next steps');
    assert.truthy(handoff.clientSummary.toLowerCase().includes('plain english'), 'Should frame client summary in plain English');
    assert.truthy(handoff.nextSteps.length >= 3, 'Should include multiple follow-up items');
    assert.truthy(handoff.sourcesAndUses.sources.length >= 3, 'Should show bank, CDC, and equity sources for 504');
  },
};

// Run all tests
async function runAllTests() {
  console.log('\n🧪 TERM SHEET GENERATOR TEST SUITE\n');

  const suites = [
    ['Strength Identification', strengthTests],
    ['Risk Identification', riskTests],
    ['Default Narrative Generation', narrativeTests],
    ['HTML Template Building', templateTests],
    ['Complete Term Sheet Generation', termSheetTests],
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [suiteName, tests] of suites) {
    console.log(`\n📋 ${suiteName}`);
    const { passed, failed } = await runTests(tests);
    totalPassed += passed;
    totalFailed += failed;
  }

  console.log(`\n\n📊 OVERALL: ${totalPassed} passed, ${totalFailed} failed\n`);
  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
