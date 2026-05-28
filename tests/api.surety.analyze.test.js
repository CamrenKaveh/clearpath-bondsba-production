/**
 * Integration Test: Surety Analysis API Endpoint
 * Tests the /api/v1/surety/analyze endpoint with mock data
 */

import { assert, runTests } from './setup.js';
import { SpreadingEngine } from '../src/domains/surety/services/spreadingEngine.js';
import { WIPAnalyzer } from '../src/domains/surety/services/wipAnalyzer.js';

/**
 * Test Suite: API Endpoint Integration
 */
const apiIntegrationTests = {
  'API: Spreading Engine generates complete analysis': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 1000000,
        grossProfit: 500000,
        expenses: 300000,
        netIncome: 200000,
        liabilities: { total: 200000 },
        equity: 300000,
        assets: 500000,
        businessAge: 5,
        industryType: 'General Contracting'
      },
      documentMetadata: { type: 'income-statement' }
    };

    const result = await engine.generateSpread(mockData, { underwriter: 'Test Analyst' });

    assert.truthy(result.asAllowed, 'Should return as-allowed figures');
    assert.truthy(result.riskFactors, 'Should return risk factors');
    assert.truthy(result.asAllowed.asAllowedNetIncome > 0, 'As-allowed income should be positive');
  },

  'API: WIP Analyzer processes construction contracts': async () => {
    const analyzer = new WIPAnalyzer();
    const mockData = {
      financials: {
        revenue: 5000000,
        grossProfit: 1500000,
        expenses: 1000000,
        netIncome: 500000,
        liabilities: { total: 2000000 },
        equity: 1000000,
        businessAge: 8,
        industryType: 'Heavy Civil Construction'
      },
      documentMetadata: { type: 'wip-schedule' }
    };

    const wipDetails = {
      contracts: [
        {
          id: 'PROJ-001',
          name: 'Highway Expansion',
          contractValue: 3000000,
          costToDate: 1500000,
          billedToDate: 1500000,
          percentComplete: 50,
          status: 'in-progress',
          estimatedCompletion: '2026-12-31',
          performanceBondValue: 300000,
          paymentBondValue: 300000
        },
        {
          id: 'PROJ-002',
          name: 'Bridge Reinforcement',
          contractValue: 2000000,
          costToDate: 1800000,
          billedToDate: 1600000,
          percentComplete: 90,
          status: 'in-progress',
          estimatedCompletion: '2026-06-30',
          performanceBondValue: 200000,
          paymentBondValue: 200000
        }
      ]
    };

    const result = await analyzer.analyzeWIP(mockData, wipDetails);

    assert.truthy(result.wipSummary, 'Should return WIP summary');
    assert.equal(result.wipSummary.totalWIP, 5000000, 'Total WIP should be $5M');
    assert.equal(result.wipSummary.activeContracts, 2, 'Should have 2 active contracts');
    assert.truthy(result.bondExposure, 'Should return bond exposure');
    assert.equal(result.bondExposure.totalBondValue, 1000000, 'Total bonds should be $1M');
  },

  'API: Combined risk assessment identifies critical factors': async () => {
    const spreadingEngine = new SpreadingEngine();
    const wipAnalyzer = new WIPAnalyzer();

    // Create problematic financials
    const mockData = {
      financials: {
        revenue: 40000,  // Below $50k threshold
        grossProfit: 10000,
        expenses: 8000,
        netIncome: 2000,
        liabilities: { total: 100000 },  // High leverage
        equity: 20000,
        assets: 120000,
        businessAge: 1,
        industryType: 'General Contracting'
      },
      documentMetadata: { type: 'financial-statement' }
    };

    const spreadingResult = await spreadingEngine.generateSpread(mockData);
    const wipResult = await wipAnalyzer.analyzeWIP(mockData, { contracts: [] });

    // Verify risk factors are identified
    assert.truthy(
      spreadingResult.riskFactors.some(r => r.code === 'LOW_REVENUE'),
      'Should identify low revenue risk'
    );
    assert.truthy(
      spreadingResult.riskFactors.some(r => r.code === 'HIGH_LEVERAGE'),
      'Should identify high leverage risk'
    );
  },

  'API: Handles parallel analysis execution': async () => {
    const engine = new SpreadingEngine();
    const analyzer = new WIPAnalyzer();

    const mockData = {
      financials: {
        revenue: 2000000,
        grossProfit: 800000,
        expenses: 400000,
        netIncome: 400000,
        liabilities: { total: 500000 },
        equity: 1000000,
        businessAge: 10,
        industryType: 'Specialty Contracting'
      },
      documentMetadata: { type: 'financial-statement' }
    };

    const wipDetails = {
      contracts: [
        {
          id: 'C001',
          contractValue: 1000000,
          costToDate: 600000,
          billedToDate: 600000,
          percentComplete: 60,
          status: 'in-progress',
          performanceBondValue: 100000,
          paymentBondValue: 100000
        }
      ]
    };

    // Run both analyses in parallel (as the API endpoint would)
    const [spreadingResult, wipResult] = await Promise.all([
      engine.generateSpread(mockData),
      analyzer.analyzeWIP(mockData, wipDetails)
    ]);

    assert.truthy(spreadingResult.asAllowed, 'Spreading analysis should complete');
    assert.truthy(wipResult.wipSummary, 'WIP analysis should complete');
    assert.equal(wipResult.wipSummary.totalWIP, 1000000, 'Total WIP should match contract value');
  },

  'API: Error handling for invalid input': async () => {
    const engine = new SpreadingEngine();

    // Missing required financials
    const invalidData = {
      documentMetadata: { type: 'financial-statement' }
      // No financials object
    };

    const result = await engine.generateSpread(invalidData);

    assert.truthy(result.error, 'Should return error for invalid input');
    assert.truthy(result.errorType, 'Should have error type');
  },

  'API: Handles empty WIP schedule': async () => {
    const analyzer = new WIPAnalyzer();

    const mockData = {
      financials: {
        revenue: 1000000,
        grossProfit: 400000,
        expenses: 200000,
        netIncome: 200000,
        liabilities: { total: 200000 },
        equity: 300000,
        businessAge: 5
      },
      documentMetadata: { type: 'wip-schedule' }
    };

    const result = await analyzer.analyzeWIP(mockData, { contracts: [] });

    assert.equal(result.wipSummary.totalWIP, 0, 'Total WIP should be zero');
    assert.equal(result.wipSummary.activeContracts, 0, 'Active contracts should be zero');
    assert.equal(result.bondExposure.totalBondValue, 0, 'Total bonds should be zero');
  }
};

/**
 * Test Suite: Business Logic Accuracy
 */
const businessLogicTests = {
  'Business Logic: Owner compensation adjustment applied correctly': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 1000000,
        grossProfit: 500000,
        expenses: 300000,
        netIncome: 200000,
        liabilities: { total: 100000 },
        equity: 500000
      },
      documentMetadata: { type: 'income-statement' }
    };

    const result = await engine.generateSpread(mockData);

    // Owner compensation should be 15% of revenue
    const expectedOwnerCompensation = 1000000 * 0.15;
    assert.equal(
      result.adjustments.ownerCompensation.amount,
      expectedOwnerCompensation,
      'Owner compensation should be 15% of revenue'
    );
  },

  'Business Logic: Bond at-risk calculation for contracts >80% complete': async () => {
    const analyzer = new WIPAnalyzer();
    const mockData = {
      financials: {
        revenue: 5000000,
        grossProfit: 1500000,
        expenses: 1000000,
        netIncome: 500000,
        liabilities: { total: 2000000 },
        equity: 1000000
      },
      documentMetadata: { type: 'wip-schedule' }
    };

    const wipDetails = {
      contracts: [
        {
          id: 'C1',
          contractValue: 1000000,
          costToDate: 500000,
          billedToDate: 500000,
          percentComplete: 50,
          status: 'in-progress',
          performanceBondValue: 100000,
          paymentBondValue: 100000
        },
        {
          id: 'C2',
          contractValue: 1000000,
          costToDate: 900000,
          billedToDate: 900000,
          percentComplete: 90,  // >80%, should be flagged as at-risk
          status: 'in-progress',
          performanceBondValue: 100000,
          paymentBondValue: 100000
        }
      ]
    };

    const result = await analyzer.analyzeWIP(mockData, wipDetails);

    // Only C2 (90% complete) should be at-risk
    assert.equal(
      result.bondExposure.bondsAtRisk,
      200000,  // 100k performance + 100k payment for C2
      'Bonds at risk should only count contracts >80% complete'
    );
  },

  'Business Logic: Contract gross margin calculation accuracy': async () => {
    const analyzer = new WIPAnalyzer();
    const mockData = {
      financials: {
        revenue: 1000000,
        grossProfit: 400000,
        expenses: 200000,
        netIncome: 200000,
        liabilities: { total: 100000 },
        equity: 300000
      },
      documentMetadata: { type: 'wip-schedule' }
    };

    const wipDetails = {
      contracts: [
        {
          id: 'TEST',
          contractValue: 500000,
          costToDate: 350000,  // 30% margin
          billedToDate: 350000,
          percentComplete: 70,
          status: 'in-progress'
        }
      ]
    };

    const result = await analyzer.analyzeWIP(mockData, wipDetails);
    const contract = result.contractAnalysis[0];

    // Verify margin calculation: (contractValue - costToDate) / contractValue * 100
    // (500,000 - 350,000) / 500,000 * 100 = 30%
    assert.equal(
      contract.grossMarginToDated,
      30,
      'Gross margin should be 30%'
    );
  }
};

// Main test runner
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SURETY API INTEGRATION TEST SUITE');
  console.log('='.repeat(70));

  const suites = [
    { name: 'API Integration', tests: apiIntegrationTests },
    { name: 'Business Logic', tests: businessLogicTests }
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
