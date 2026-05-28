/**
 * Spreading Engine Tests
 * Validates as-allowed financial statement spreading for surety underwriting
 */

import { SpreadingEngine } from '../src/domains/surety/services/spreadingEngine.js';
import { assert, runTests, usd } from './setup.js';

// Test Suite: Spread Generation
const spreadGenerationTests = {
  'Spread Generation: Creates spread from normalized data': async () => {
    const engine = new SpreadingEngine();
    const mockNormalizedData = {
      financials: {
        revenue: 500000,
        grossProfit: 250000,
        expenses: 150000,
        netIncome: 100000,
        liabilities: { total: 50000 },
        equity: 200000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockNormalizedData);

    assert.truthy(result.metadata, 'Should have metadata');
    assert.truthy(result.original, 'Should have original financials');
    assert.truthy(result.adjustments, 'Should have adjustments');
    assert.truthy(result.asAllowed, 'Should have as-allowed figures');
    assert.equal(result.original.revenue, 500000, 'Should preserve original revenue');
  },

  'Spread Generation: Preserves original values': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 750000,
        grossProfit: 375000,
        expenses: 200000,
        netIncome: 175000,
        liabilities: { total: 100000 },
        equity: 300000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData);

    assert.equal(result.original.revenue, 750000, 'Should preserve revenue');
    assert.equal(result.original.grossProfit, 375000, 'Should preserve gross profit');
    assert.equal(result.original.netIncome, 175000, 'Should preserve net income');
  },

  'Spread Generation: Calculates owner compensation adjustment': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 500000,
        grossProfit: 250000,
        expenses: 150000,
        netIncome: 100000,
        liabilities: { total: 50000 },
        equity: 200000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData);

    // 15% adjustment rule
    const expectedAdjustment = 500000 * 0.15;
    assert.equal(
      result.adjustments.ownerCompensation.amount,
      expectedAdjustment,
      `Owner compensation should be ${expectedAdjustment}`
    );
    assert.truthy(result.adjustments.ownerCompensation.addBack, 'Should add back owner compensation');
  },

  'Spread Generation: Includes depreciation and amortization add-backs': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 500000,
        grossProfit: 250000,
        expenses: 150000,
        netIncome: 100000,
        liabilities: { total: 50000 },
        equity: 200000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData);

    assert.truthy(result.adjustments.depreciation.addBack, 'Should add back depreciation');
    assert.truthy(result.adjustments.amortization.addBack, 'Should add back amortization');
  },

  'Spread Generation: Calculates as-allowed net income': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 500000,
        grossProfit: 250000,
        expenses: 150000,
        netIncome: 100000,
        liabilities: { total: 50000 },
        equity: 200000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData);

    // Should be greater than original due to add-backs
    assert.truthy(
      result.asAllowed.asAllowedNetIncome > result.original.netIncome,
      'As-allowed net income should exceed original with add-backs'
    );
  },

  'Spread Generation: Includes risk assessment': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 500000,
        grossProfit: 250000,
        expenses: 150000,
        netIncome: 100000,
        liabilities: { total: 50000 },
        equity: 200000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData);

    assert.isArray(result.riskFactors, 'Should have risk factors');
  },

  'Spread Generation: Handles low revenue risk': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 30000, // Below $50k threshold
        grossProfit: 15000,
        expenses: 10000,
        netIncome: 5000,
        liabilities: { total: 5000 },
        equity: 25000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData);

    const lowRevenueRisk = result.riskFactors.find((f) => f.code === 'LOW_REVENUE');
    assert.truthy(lowRevenueRisk, 'Should identify low revenue risk');
    assert.equal(lowRevenueRisk.severity, 'high', 'Low revenue should be high severity');
  },

  'Spread Generation: Handles high leverage risk': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 500000,
        grossProfit: 250000,
        expenses: 150000,
        netIncome: 100000,
        liabilities: { total: 400000 }, // 4:1 ratio
        equity: 100000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData);

    const highLeverageRisk = result.riskFactors.find((f) => f.code === 'HIGH_LEVERAGE');
    assert.truthy(highLeverageRisk, 'Should identify high leverage risk');
    assert.equal(highLeverageRisk.severity, 'medium', 'High leverage should be medium severity');
  },

  'Spread Generation: Accepts optional underwriter name': async () => {
    const engine = new SpreadingEngine();
    const mockData = {
      financials: {
        revenue: 500000,
        grossProfit: 250000,
        expenses: 150000,
        netIncome: 100000,
        liabilities: { total: 50000 },
        equity: 200000,
      },
      documentMetadata: { type: 'income-statement' },
    };

    const result = await engine.generateSpread(mockData, { underwriter: 'John Smith' });

    assert.equal(result.metadata.underwriter, 'John Smith', 'Should set underwriter name');
  },

  'Spread Generation: Handles errors gracefully': async () => {
    const engine = new SpreadingEngine();
    const invalidData = {
      documentMetadata: { type: 'income-statement' },
      // Missing financials
    };

    const result = await engine.generateSpread(invalidData);

    assert.truthy(result.error, 'Should return error object');
    assert.equal(result.errorType, 'SPREADING_ERROR', 'Should have error type');
  },
};

// Test Suite: Spread Comparison
const spreadComparisonTests = {
  'Spread Comparison: Compares current to prior spread': async () => {
    const engine = new SpreadingEngine();
    const priorSpread = {
      original: {
        revenue: 400000,
        grossProfit: 200000,
        operatingExpenses: 100000,
        netIncome: 100000,
      },
      asAllowed: {
        asAllowedNetIncome: 120000,
      },
    };

    const currentSpread = {
      original: {
        revenue: 500000,
        grossProfit: 250000,
        operatingExpenses: 150000,
        netIncome: 100000,
      },
      asAllowed: {
        asAllowedNetIncome: 130000,
      },
    };

    const comparison = engine.compareSpread(currentSpread, priorSpread);

    assert.truthy(comparison, 'Should return comparison');
    assert.approximately(comparison.revenueGrowth, 25, 1, 'Revenue should grow 25%');
  },

  'Spread Comparison: Returns null without prior spread': async () => {
    const engine = new SpreadingEngine();
    const currentSpread = {
      original: { revenue: 500000 },
      asAllowed: { asAllowedNetIncome: 100000 },
    };

    const comparison = engine.compareSpread(currentSpread, null);

    assert.falsy(comparison, 'Should return null without prior spread');
  },
};

// Test Suite: Adjustment Calculations
const adjustmentTests = {
  'Adjustments: Calculates all adjustment categories': async () => {
    const engine = new SpreadingEngine();
    const financials = {
      revenue: 500000,
      expenses: 150000,
      grossProfit: 250000,
      netIncome: 100000,
    };

    const adjustments = engine.calculateAdjustments(financials);

    assert.truthy(adjustments.ownerCompensation, 'Should have owner compensation');
    assert.truthy(adjustments.depreciation, 'Should have depreciation');
    assert.truthy(adjustments.amortization, 'Should have amortization');
    assert.truthy(adjustments.interest, 'Should have interest');
  },
};

// Test Suite: Risk Assessment
const riskAssessmentTests = {
  'Risk Assessment: Identifies multiple risk factors': async () => {
    const engine = new SpreadingEngine();
    const financials = {
      revenue: 30000, // Low revenue
      expenses: 20000,
      netIncome: 10000,
      grossProfit: 15000,
      liabilities: { total: 100000 }, // High leverage
      equity: 10000,
    };

    const risks = engine.assessRiskFactors(financials);

    assert.isArray(risks, 'Should return risk factors array');
    assert.truthy(
      risks.some((r) => r.code === 'LOW_REVENUE'),
      'Should identify low revenue risk'
    );
  },
};

// Main test runner
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 SURETY SPREADING ENGINE TEST SUITE');
  console.log('='.repeat(70));

  const suites = [
    { name: 'Spread Generation', tests: spreadGenerationTests },
    { name: 'Spread Comparison', tests: spreadComparisonTests },
    { name: 'Adjustment Calculations', tests: adjustmentTests },
    { name: 'Risk Assessment', tests: riskAssessmentTests },
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
