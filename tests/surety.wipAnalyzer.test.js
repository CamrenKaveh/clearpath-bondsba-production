/**
 * WIP Analyzer Tests
 * Validates Work-in-Progress schedule analysis for contractor surety bonds
 */

import { WIPAnalyzer } from '../src/domains/surety/services/wipAnalyzer.js';
import { assert, runTests, usd } from './setup.js';

// Test Suite: WIP Analysis
const wipAnalysisTests = {
  'WIP Analysis: Analyzes WIP schedule and returns complete analysis': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-001',
          name: 'Office Building Addition',
          owner: 'ABC Construction',
          contractValue: 1000000,
          costToDate: 400000,
          billedToDate: 450000,
          percentComplete: 50,
          status: 'in-progress',
          estimatedCompletion: '2026-12-31',
          performanceBondValue: 100000,
          paymentBondValue: 100000,
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    assert.truthy(result.metadata, 'Should have metadata');
    assert.truthy(result.wipSummary, 'Should have WIP summary');
    assert.truthy(result.contractAnalysis, 'Should have contract analysis');
    assert.truthy(result.marginAnalysis, 'Should have margin analysis');
    assert.truthy(result.bondExposure, 'Should have bond exposure');
    assert.truthy(result.riskAssessment, 'Should have risk assessment');
  },

  'WIP Analysis: Calculates WIP summary correctly': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-001',
          contractValue: 1000000,
          status: 'in-progress',
          percentComplete: 50,
          costToDate: 400000,
          billedToDate: 450000,
          estimatedCompletion: '2026-12-31',
        },
        {
          id: 'CONTRACT-002',
          contractValue: 500000,
          status: 'completed',
          percentComplete: 100,
          costToDate: 500000,
          billedToDate: 500000,
          estimatedCompletion: '2026-06-30',
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    assert.equal(result.wipSummary.totalWIP, 1500000, 'Total WIP should be $1.5M');
    assert.equal(result.wipSummary.completedContracts, 1, 'Should have 1 completed contract');
    assert.equal(result.wipSummary.activeContracts, 1, 'Should have 1 active contract');
  },

  'WIP Analysis: Analyzes contract margins': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-MARGIN-TEST',
          contractValue: 1000000,
          costToDate: 700000, // 30% margin
          percentComplete: 70,
          billedToDate: 700000,
          status: 'in-progress',
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);
    const contract = result.contractAnalysis[0];

    // (1,000,000 - 700,000) / 1,000,000 * 100 = 30%
    assert.equal(contract.grossMarginToDated, 30, 'Gross margin should be 30%');
  },

  'WIP Analysis: Flags contracts with negative margins': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-LOSS',
          contractValue: 1000000,
          costToDate: 1100000, // Loss-making
          percentComplete: 50,
          billedToDate: 500000,
          status: 'in-progress',
          estimatedCompletion: '2026-12-31',
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    const negativeMarginRisk = result.riskAssessment.find((r) => r.code === 'NEGATIVE_MARGIN');
    assert.truthy(negativeMarginRisk, 'Should flag negative margin risk');
    assert.equal(negativeMarginRisk.severity, 'critical', 'Negative margin should be critical');
  },

  'WIP Analysis: Flags overdue contracts': async () => {
    const analyzer = new WIPAnalyzer();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30); // 30 days ago

    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-OVERDUE',
          contractValue: 1000000,
          costToDate: 500000,
          percentComplete: 50,
          billedToDate: 500000,
          status: 'in-progress',
          estimatedCompletion: pastDate.toISOString(),
          startDate: '2026-01-01',
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    const overdueRisk = result.riskAssessment.find((r) => r.code === 'OVERDUE_CONTRACTS');
    assert.truthy(overdueRisk, 'Should flag overdue contracts');
    assert.equal(overdueRisk.severity, 'high', 'Overdue should be high severity');
  },

  'WIP Analysis: Flags high WIP concentration': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-LARGE',
          contractValue: 4000000, // 80% of total
          costToDate: 2000000,
          percentComplete: 50,
          billedToDate: 2000000,
          status: 'in-progress',
          estimatedCompletion: '2026-12-31',
        },
        {
          id: 'CONTRACT-SMALL',
          contractValue: 1000000, // 20% of total
          costToDate: 500000,
          percentComplete: 50,
          billedToDate: 500000,
          status: 'in-progress',
          estimatedCompletion: '2026-12-31',
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    const concentrationRisk = result.riskAssessment.find((r) => r.code === 'HIGH_CONCENTRATION');
    assert.truthy(concentrationRisk, 'Should flag high concentration');
    assert.equal(concentrationRisk.severity, 'medium', 'Concentration should be medium severity');
  },

  'WIP Analysis: Calculates bond exposure correctly': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-001',
          contractValue: 1000000,
          costToDate: 500000,
          percentComplete: 50,
          billedToDate: 500000,
          status: 'in-progress',
          performanceBondValue: 100000,
          paymentBondValue: 100000,
        },
        {
          id: 'CONTRACT-002',
          contractValue: 500000,
          costToDate: 450000,
          percentComplete: 90, // At risk
          billedToDate: 450000,
          status: 'in-progress',
          performanceBondValue: 50000,
          paymentBondValue: 50000,
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    assert.equal(result.bondExposure.totalBondValue, 300000, 'Total bond value should be $300k');
    assert.equal(result.bondExposure.performanceBonds, 150000, 'Performance bonds should be $150k');
    assert.equal(result.bondExposure.paymentBonds, 150000, 'Payment bonds should be $150k');
    // Only CONTRACT-002 is at risk (>80% complete)
    assert.equal(result.bondExposure.bondsAtRisk, 100000, 'Bonds at risk should be $100k');
  },

  'WIP Analysis: Handles empty contract list': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    assert.equal(result.wipSummary.totalWIP, 0, 'Total WIP should be zero');
    assert.equal(result.wipSummary.activeContracts, 0, 'Active contracts should be zero');
  },

  'WIP Analysis: Handles errors gracefully': async () => {
    const analyzer = new WIPAnalyzer();
    const invalidData = null;

    const result = await analyzer.analyzeWIP(invalidData, {});

    assert.truthy(result.error, 'Should return error');
    assert.equal(result.errorType, 'WIP_ANALYSIS_ERROR', 'Should have error type');
  },
};

// Test Suite: Margin Analysis
const marginAnalysisTests = {
  'Margin Analysis: Calculates average gross margin': async () => {
    const analyzer = new WIPAnalyzer();
    const mockWIPData = {
      contracts: [
        {
          id: 'CONTRACT-A',
          contractValue: 1000000,
          costToDate: 700000, // 30% margin
        },
        {
          id: 'CONTRACT-B',
          contractValue: 1000000,
          costToDate: 800000, // 20% margin
        },
        {
          id: 'CONTRACT-C',
          contractValue: 1000000,
          costToDate: 900000, // 10% margin
        },
      ],
    };

    const mockNormalizedData = {
      documentMetadata: { type: 'wip-schedule' },
    };

    const result = await analyzer.analyzeWIP(mockNormalizedData, mockWIPData);

    // (30 + 20 + 10) / 3 = 20
    assert.approximately(result.marginAnalysis.averageGrossMargin, 20, 1, 'Average margin should be ~20%');
    assert.equal(result.marginAnalysis.highestMargin, 30, 'Highest margin should be 30%');
    assert.equal(result.marginAnalysis.lowestMargin, 10, 'Lowest margin should be 10%');
  },
};

// Test Suite: Helper Methods
const helperMethodsTests = {
  'Helper: Calculates contract margin correctly': async () => {
    const analyzer = new WIPAnalyzer();
    const contract = {
      contractValue: 1000000,
      costToDate: 700000,
    };

    const margin = analyzer.calculateContractMargin(contract);

    assert.equal(margin, 30, 'Margin should be 30%');
  },

  'Helper: Returns zero for zero-value contracts': async () => {
    const analyzer = new WIPAnalyzer();
    const contract = {
      contractValue: 0,
      costToDate: 0,
    };

    const margin = analyzer.calculateContractMargin(contract);

    assert.equal(margin, 0, 'Margin should be 0 for zero contract value');
  },

  'Helper: Flags low-margin contracts': async () => {
    const analyzer = new WIPAnalyzer();
    const contract = {
      id: 'LOW-MARGIN',
      contractValue: 1000000,
      costToDate: 960000, // 4% margin (below 5% threshold)
      percentComplete: 50,
    };

    const flags = analyzer.flagContractRisks(contract);

    assert.truthy(flags.includes('low-margin'), 'Should flag low margin');
  },

  'Helper: Flags near-completion contracts': async () => {
    const analyzer = new WIPAnalyzer();
    const contract = {
      id: 'NEAR-COMPLETION',
      contractValue: 1000000,
      costToDate: 900000,
      percentComplete: 95,
    };

    const flags = analyzer.flagContractRisks(contract);

    assert.truthy(flags.includes('near-completion'), 'Should flag near-completion');
  },
};

// Main test runner
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SURETY WIP ANALYZER TEST SUITE');
  console.log('='.repeat(70));

  const suites = [
    { name: 'WIP Analysis', tests: wipAnalysisTests },
    { name: 'Margin Analysis', tests: marginAnalysisTests },
    { name: 'Helper Methods', tests: helperMethodsTests },
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`\n📂 ${suite.name}`);
    const result = await runTests(suite.tests);
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`🏁 FINAL SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(70) + '\n');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(console.error);
