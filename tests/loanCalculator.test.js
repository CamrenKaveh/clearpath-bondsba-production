/**
 * Loan Calculator Tests
 * Validates SBA 7(a) loan mathematics
 */

import {
  calculateMonthlyPayment,
  generateAmortizationSchedule,
  calculateDSCR,
  calculateSBAFees,
  calculateSBA7aGuarantyFee,
  calculateSBA504Project,
  validateLoanAffordability,
  calculateEquityRequirement,
  calculateLoanAnalysis,
} from '../src/domains/sba-loans/services/loanCalculator.js';
import { assert, runTests, usd, pct } from './setup.js';

// Test Suite: Monthly Payment Calculation
const monthlyPaymentTests = {
  'Monthly Payment: Standard 7-year SBA loan': () => {
    const monthly = calculateMonthlyPayment(500000, 10.5, 7);
    // Using standard amortization formula
    assert.approximately(monthly, 8430.34, 5, 'Monthly payment should be ~$8,430.34');
  },

  'Monthly Payment: 10-year term': () => {
    const monthly = calculateMonthlyPayment(250000, 8.75, 10);
    assert.approximately(monthly, 3133.17, 5, 'Monthly payment should be ~$3,133.17');
  },

  'Monthly Payment: 5-year equipment term': () => {
    const monthly = calculateMonthlyPayment(100000, 12.0, 5);
    assert.approximately(monthly, 2224.45, 5, 'Monthly payment should be ~$2,224.45');
  },

  'Monthly Payment: Zero percent rate edge case': () => {
    const monthly = calculateMonthlyPayment(100000, 0.01, 5);
    // Should not throw, handles near-zero rate
    assert.truthy(monthly > 0, 'Monthly payment should be positive');
    assert.approximately(monthly, 1666.67, 10, 'Should be principal / months');
  },
};

// Test Suite: Amortization Schedule Generation
const amortizationTests = {
  'Amortization Schedule: Returns correct array length': () => {
    const schedule = generateAmortizationSchedule(500000, 10.5, 7, new Date('2026-04-26'));
    assert.isArray(schedule, 'Should return array');
    assert.equal(schedule.length, 84, 'Should have 84 months (7 years)');
  },

  'Amortization Schedule: First payment breakdown': () => {
    const schedule = generateAmortizationSchedule(500000, 10.5, 7, new Date('2026-04-26'));
    const firstPayment = schedule[0];

    assert.hasProperty(firstPayment, 'month', 'Should have month property');
    assert.hasProperty(firstPayment, 'date', 'Should have date property');
    assert.hasProperty(firstPayment, 'payment', 'Should have payment property');
    assert.hasProperty(firstPayment, 'principal', 'Should have principal property');
    assert.hasProperty(firstPayment, 'interest', 'Should have interest property');
    assert.hasProperty(firstPayment, 'balance', 'Should have balance property');

    assert.approximately(
      firstPayment.interest,
      4375, // 500,000 * 10.5% / 12
      10,
      'First month interest should be ~$4,375'
    );
  },

  'Amortization Schedule: Principal increases over time': () => {
    const schedule = generateAmortizationSchedule(500000, 10.5, 7, new Date('2026-04-26'));
    const principalMonth1 = schedule[0].principal;
    const principalMonth24 = schedule[23].principal;
    const principalMonth84 = schedule[83].principal;

    assert.truthy(
      principalMonth24 > principalMonth1,
      'Principal payment should increase over time (month 24 > month 1)'
    );
    assert.truthy(
      principalMonth84 > principalMonth24,
      'Principal payment should increase over time (month 84 > month 24)'
    );
  },

  'Amortization Schedule: Final balance near zero': () => {
    const schedule = generateAmortizationSchedule(500000, 10.5, 7, new Date('2026-04-26'));
    const finalBalance = schedule[schedule.length - 1].balance;

    assert.approximately(finalBalance, 0, 1, 'Final balance should be ~$0');
  },

  'Amortization Schedule: Total principal paid equals loan amount': () => {
    const schedule = generateAmortizationSchedule(500000, 10.5, 7, new Date('2026-04-26'));
    const totalPrincipal = schedule.reduce((sum, payment) => sum + payment.principal, 0);

    assert.approximately(totalPrincipal, 500000, 10, 'Total principal should equal loan amount');
  },
};

// Test Suite: DSCR Calculation
const dscrTests = {
  'DSCR: Basic calculation': () => {
    const dscr = calculateDSCR(100000, 8321.54 * 12);
    // DSCR = NOI / Annual Debt Service
    assert.approximately(dscr, 1.0, 0.05, 'DSCR should be ~1.0 for this scenario');
  },

  'DSCR: Strong coverage': () => {
    const dscr = calculateDSCR(150000, 8321.54 * 12);
    assert.approximately(dscr, 1.50, 0.05, 'DSCR should be ~1.5 for strong coverage');
  },

  'DSCR: Below minimum': () => {
    const dscr = calculateDSCR(80000, 8321.54 * 12);
    assert.approximately(dscr, 0.80, 0.05, 'DSCR should be ~0.8 for weak coverage');
  },
};

// Test Suite: SBA Fees Calculation
const feeTests = {
  'SBA 7(a) Guaranty Fee: FY2026 tiered fee on guaranteed portion': () => {
    const fees = calculateSBA7aGuarantyFee({
      loanAmount: 1200000,
      termMonths: 120,
    });

    assert.approximately(
      fees.guaranteedAmount,
      900000,
      1,
      '7(a) guarantee should default to 75% above $150,000'
    );
    assert.approximately(
      fees.guarantyFee,
      31500,
      1,
      'Fee should be 3.5% of the guaranteed portion up to $1M'
    );
    assert.equal(fees.feeRateLabel, '3.5%', 'Should describe the tier used');
  },

  'SBA 7(a) Guaranty Fee: FY2026 manufacturer waiver only applies up to $950,000': () => {
    const waived = calculateSBA7aGuarantyFee({
      loanAmount: 900000,
      termMonths: 120,
      isManufacturer: true,
    });
    const notWaived = calculateSBA7aGuarantyFee({
      loanAmount: 1000000,
      termMonths: 120,
      isManufacturer: true,
    });

    assert.approximately(waived.guarantyFee, 0, 1, 'Manufacturer loans up to $950k should be waived');
    assert.truthy(waived.waiverApplied, 'Waiver should be marked applied');
    assert.approximately(notWaived.guarantyFee, 26250, 1, 'Manufacturer loans above $950k should use standard tiers');
    assert.falsy(notWaived.waiverApplied, 'Waiver should not apply above $950k');
  },

  'SBA 504 Project: Calculates bank, CDC, equity, upfront fee, and annual service fee': () => {
    const project = calculateSBA504Project({
      projectCost: 2500000,
      cdcRate: 6.35,
      cdcTermYears: 25,
    });

    assert.approximately(project.bankLoanAmount, 1250000, 1, 'Bank portion should default to 50%');
    assert.approximately(project.cdcLoanAmount, 1000000, 1, 'CDC portion should default to 40%');
    assert.approximately(project.borrowerEquity, 250000, 1, 'Borrower injection should default to 10%');
    assert.approximately(project.upfrontGuarantyFee, 5000, 1, '504 upfront guaranty fee should be 0.50% of CDC portion');
    assert.approximately(project.firstYearAnnualServiceFee, 2090, 1, '504 annual service fee should be 0.209% of CDC balance');
    assert.truthy(project.cdcMonthlyPayment > 0, 'CDC monthly payment should be calculated');
  },

  'SBA Fees: Standard origination fee': () => {
    const fees = calculateSBAFees(500000, false);

    assert.hasProperty(fees, 'originationFee', 'Should have originationFee');
    assert.hasProperty(fees, 'guarantyFee', 'Should have guarantyFee');
    assert.hasProperty(fees, 'totalFees', 'Should have totalFees');
    assert.hasProperty(fees, 'netProceeds', 'Should have netProceeds');

    assert.approximately(
      fees.originationFee,
      3750, // 500,000 * 0.75%
      10,
      'Origination fee should be 0.75%'
    );
  },

  'SBA Fees: FY2026 standard guaranty fee (non-manufacturer)': () => {
    const fees = calculateSBAFees(500000, false);

    assert.approximately(
      fees.guarantyFee,
      11250, // 500,000 * 75% guaranteed portion * 3%
      10,
      'Guaranty fee should follow the FY2026 guaranteed-portion tier'
    );
  },

  'SBA Fees: FY2026 manufacturer waiver applies': () => {
    const fees = calculateSBAFees(500000, true);

    assert.approximately(fees.guarantyFee, 0, 1, 'Guaranty fee should be $0 for manufacturer');
    assert.hasProperty(fees, 'isManufacturerWaiverApplied', 'Should indicate waiver applied');
    assert.truthy(
      fees.isManufacturerWaiverApplied,
      'Waiver should be marked as applied'
    );
  },

  'SBA Fees: Net proceeds calculated correctly': () => {
    const fees = calculateSBAFees(500000, false);
    const expectedNetProceeds = 500000 - fees.totalFees;

    assert.approximately(
      fees.netProceeds,
      expectedNetProceeds,
      1,
      'Net proceeds should be principal minus total fees'
    );
  },
};

// Test Suite: Loan Affordability Validation
const affordabilityTests = {
  'Affordability: PASS when DSCR > minimum': () => {
    const result = validateLoanAffordability(1.35, 1.25);

    assert.equal(result.status, 'PASS', 'Should return PASS status');
    assert.approximately(result.shortfall, 0, 0.01, 'Should have no shortfall');
  },

  'Affordability: CONDITIONAL when DSCR close to minimum': () => {
    const result = validateLoanAffordability(1.25, 1.25);

    assert.equal(result.status, 'CONDITIONAL', 'Should return CONDITIONAL status');
  },

  'Affordability: FAIL when DSCR below minimum': () => {
    const result = validateLoanAffordability(1.10, 1.25);

    assert.equal(result.status, 'FAIL', 'Should return FAIL status');
    assert.approximately(result.shortfall, 0.15, 0.01, 'Should calculate shortfall');
  },
};

// Test Suite: Equity Requirement
const equityTests = {
  'Equity: Standard 10% requirement': () => {
    const equity = calculateEquityRequirement(500000, 0.1);

    assert.approximately(
      equity.requiredAmount,
      50000,
      10,
      'Should require 10% of project cost'
    );
    assert.approximately(
      equity.maximumLoanAmount,
      450000,
      10,
      'Maximum loan should be 90% of project cost'
    );
  },

  'Equity: Custom percentage': () => {
    const equity = calculateEquityRequirement(600000, 0.15);

    assert.approximately(
      equity.requiredAmount,
      90000,
      10,
      'Should require custom percentage of project cost'
    );
  },
};

// Test Suite: Comprehensive Loan Analysis
const comprehensiveTests = {
  'Comprehensive Analysis: Standard SBA 7(a) scenario': () => {
    const analysis = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 311, // Manufacturer
    });

    assert.hasProperty(analysis, 'monthlyPayment', 'Should have monthly payment');
    assert.hasProperty(analysis, 'annualDebtService', 'Should have annual debt service');
    assert.hasProperty(analysis, 'totalInterest', 'Should have total interest');
    assert.hasProperty(analysis, 'fees', 'Should have fees object');
    assert.hasProperty(analysis, 'dscr', 'Should have DSCR');
    assert.hasProperty(analysis, 'affordability', 'Should have affordability assessment');
    assert.hasProperty(analysis, 'equityAnalysis', 'Should have equity analysis');
    assert.hasProperty(analysis, 'amortizationSchedule', 'Should have schedule');
  },

  'Comprehensive Analysis: Manufacturer waiver applies for NAICS 311': () => {
    const analysis = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 311, // Manufacturing - should trigger waiver
    });

    assert.truthy(
      analysis.fees.isManufacturerWaiverApplied,
      'NAICS 311 should trigger manufacturer waiver'
    );
    assert.approximately(
      analysis.fees.guarantyFee,
      0,
      1,
      'Guaranty fee should be $0 with waiver'
    );
  },

  'Comprehensive Analysis: Manufacturer waiver does NOT apply for NAICS 234': () => {
    const analysis = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
      borrowerNAICS: 234, // Heavy construction - should NOT trigger waiver
    });

    assert.falsy(
      analysis.fees.isManufacturerWaiverApplied,
      'NAICS 234 should not trigger waiver'
    );
    assert.approximately(
      analysis.fees.guarantyFee,
      11250, // 500k * 75% guaranteed portion * 3%
      10,
      'Guaranty fee should follow FY2026 tiers without waiver'
    );
  },

  'Comprehensive Analysis: Amortization schedule has correct length': () => {
    const analysis = calculateLoanAnalysis({
      requestedAmount: 250000,
      annualRate: 9.75,
      loanTermYears: 10,
      netOperatingIncome: 50000,
      totalProjectCost: 300000,
    });

    assert.isArray(
      analysis.amortizationSchedule,
      'Schedule should be array'
    );
    assert.equal(
      analysis.amortizationSchedule.length,
      120, // 10 years * 12 months
      'Schedule should have 120 payments for 10-year term'
    );
  },

  'Comprehensive Analysis: Total interest increases with rate': () => {
    const analysisLow = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 8.0,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    });

    const analysisHigh = calculateLoanAnalysis({
      requestedAmount: 500000,
      annualRate: 12.0,
      loanTermYears: 7,
      netOperatingIncome: 100000,
      totalProjectCost: 600000,
    });

    assert.truthy(
      analysisHigh.totalInterest > analysisLow.totalInterest,
      'Higher rate should result in more total interest'
    );
  },

  'Comprehensive Analysis: Monthly payment increases with amount': () => {
    const analysisSmall = calculateLoanAnalysis({
      requestedAmount: 250000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 50000,
      totalProjectCost: 300000,
    });

    const analysisLarge = calculateLoanAnalysis({
      requestedAmount: 750000,
      annualRate: 10.5,
      loanTermYears: 7,
      netOperatingIncome: 150000,
      totalProjectCost: 900000,
    });

    assert.truthy(
      analysisLarge.monthlyPayment.amount > analysisSmall.monthlyPayment.amount,
      'Larger loan amount should have higher monthly payment'
    );
  },
};

// Run all tests
async function runAllTests() {
  console.log('\n🧪 LOAN CALCULATOR TEST SUITE\n');

  const suites = [
    ['Monthly Payment Calculation', monthlyPaymentTests],
    ['Amortization Schedule Generation', amortizationTests],
    ['DSCR Calculation', dscrTests],
    ['SBA Fees Calculation', feeTests],
    ['Loan Affordability Validation', affordabilityTests],
    ['Equity Requirement', equityTests],
    ['Comprehensive Loan Analysis', comprehensiveTests],
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
