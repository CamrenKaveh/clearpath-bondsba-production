/**
 * SBA Loan Calculator Service
 *
 * Handles all SBA 7(a) loan mathematics:
 * - Monthly payment calculation (P&I)
 * - Debt Service Coverage Ratio (DSCR) calculation
 * - Fee calculations (origination, guaranty, manufacturer waiver)
 * - Amortization schedule generation
 * - Equity injection requirements
 *
 * Used by:
 * - /api/v1/sba-loans/calculate-amortization endpoint
 * - Frontend loan parameter calculations
 */

/**
 * Calculate monthly payment (Principal & Interest only)
 * Using standard amortization formula: P = L[c(1+c)^n]/[(1+c)^n-1]
 * where P = monthly payment, L = loan amount, c = monthly rate, n = number of payments
 */
export function calculateMonthlyPayment(principal, annualRate, years) {
  const monthlyRate = annualRate / 100 / 12;
  const numberOfPayments = years * 12;

  if (monthlyRate === 0) {
    // Special case: 0% interest
    return principal / numberOfPayments;
  }

  const numerator = monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments);
  const denominator = Math.pow(1 + monthlyRate, numberOfPayments) - 1;
  return principal * (numerator / denominator);
}

/**
 * Generate full amortization schedule
 * Returns array of {month, payment, principal, interest, balance}
 */
export function generateAmortizationSchedule(principal, annualRate, years, startDate = new Date()) {
  const monthlyRate = annualRate / 100 / 12;
  const numberOfPayments = years * 12;
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, years);

  const schedule = [];
  let balance = principal;
  let date = new Date(startDate);

  for (let month = 1; month <= numberOfPayments; month++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    balance -= principalPayment;

    // Avoid floating point errors on final payment
    if (month === numberOfPayments) {
      balance = 0;
    }

    schedule.push({
      month,
      date: new Date(date).toISOString().split('T')[0],
      payment: Math.round(monthlyPayment * 100) / 100,
      principal: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interestPayment * 100) / 100,
      balance: Math.max(0, Math.round(balance * 100) / 100),
    });

    // Move to next month
    date.setMonth(date.getMonth() + 1);
  }

  return schedule;
}

/**
 * Calculate DSCR (Debt Service Coverage Ratio)
 * DSCR = Net Operating Income / Total Debt Service
 * Minimum acceptable DSCR for SBA 7(a): 1.15x to 1.25x depending on borrower strength
 */
export function calculateDSCR(netOperatingIncome, debtService) {
  if (debtService === 0) return 0;
  const annualDebtService = debtService > netOperatingIncome * 0.5 ? debtService : debtService * 12;
  return netOperatingIncome / annualDebtService;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isManufacturingNAICS(value) {
  return Boolean(value && value.toString().match(/^3[1-3]/));
}

function getDefault7aGuaranteePercent(loanAmount, program = 'standard') {
  if (program === 'express') return 0.5;
  return loanAmount <= 150000 ? 0.85 : 0.75;
}

/**
 * Calculate the SBA 7(a) FY2026 upfront guaranty fee.
 *
 * Source basis: SBA Information Notice 5000-872051, effective for loans
 * approved October 1, 2025 through September 30, 2026. Standard 7(a) fees are
 * applied to the guaranteed portion of the gross approval amount.
 */
export function calculateSBA7aGuarantyFee({
  loanAmount,
  termMonths,
  isManufacturer = false,
  program = 'standard',
  guaranteePercent = getDefault7aGuaranteePercent(loanAmount, program),
  existingGrossApprovals90Days = 0,
} = {}) {
  const grossLoanAmount = Number(loanAmount) || 0;
  const months = Number(termMonths) || 0;
  const combinedGrossAmount = grossLoanAmount + (Number(existingGrossApprovals90Days) || 0);
  const guaranteedAmount = grossLoanAmount * guaranteePercent;

  if (grossLoanAmount <= 0 || guaranteedAmount <= 0) {
    return {
      loanAmount: roundMoney(grossLoanAmount),
      guaranteePercent: guaranteePercent * 100,
      guaranteedAmount: 0,
      guarantyFee: 0,
      feeRateLabel: '0%',
      waiverApplied: false,
      annualServiceFeePercent: 0.55,
      notes: ['Enter a positive loan amount to calculate the guaranty fee.'],
    };
  }

  if (isManufacturer && combinedGrossAmount <= 950000 && program !== 'marc') {
    return {
      loanAmount: roundMoney(grossLoanAmount),
      combinedGrossAmount: roundMoney(combinedGrossAmount),
      guaranteePercent: guaranteePercent * 100,
      guaranteedAmount: roundMoney(guaranteedAmount),
      guarantyFee: 0,
      feeRateLabel: '0%',
      waiverApplied: true,
      annualServiceFeePercent: 0.55,
      notes: ['FY2026 NAICS 31-33 manufacturer upfront fee waiver applied.'],
    };
  }

  if (months > 0 && months <= 12) {
    return {
      loanAmount: roundMoney(grossLoanAmount),
      combinedGrossAmount: roundMoney(combinedGrossAmount),
      guaranteePercent: guaranteePercent * 100,
      guaranteedAmount: roundMoney(guaranteedAmount),
      guarantyFee: roundMoney(guaranteedAmount * 0.0025),
      feeRateLabel: '0.25%',
      waiverApplied: false,
      annualServiceFeePercent: 0.55,
      notes: ['Short-term 7(a) upfront fee applied because maturity is 12 months or less.'],
    };
  }

  let guarantyFee = 0;
  let feeRateLabel = '';

  if (combinedGrossAmount <= 150000) {
    guarantyFee = guaranteedAmount * 0.02;
    feeRateLabel = '2%';
  } else if (combinedGrossAmount <= 700000) {
    guarantyFee = guaranteedAmount * 0.03;
    feeRateLabel = '3%';
  } else {
    const firstTier = Math.min(guaranteedAmount, 1000000);
    const excessTier = Math.max(0, guaranteedAmount - 1000000);
    guarantyFee = (firstTier * 0.035) + (excessTier * 0.0375);
    feeRateLabel = excessTier > 0 ? '3.5% + 3.75%' : '3.5%';
  }

  return {
    loanAmount: roundMoney(grossLoanAmount),
    combinedGrossAmount: roundMoney(combinedGrossAmount),
    guaranteePercent: guaranteePercent * 100,
    guaranteedAmount: roundMoney(guaranteedAmount),
    guarantyFee: roundMoney(guarantyFee),
    feeRateLabel,
    waiverApplied: false,
    annualServiceFeePercent: 0.55,
    notes: existingGrossApprovals90Days > 0
      ? ['90-day aggregation amount included for fee tier selection.']
      : [],
  };
}

/**
 * Calculate SBA fees
 * Keeps the existing origination-fee field while using the FY2026 7(a)
 * guaranty-fee schedule for the SBA upfront fee.
 */
export function calculateSBAFees(loanAmount, isManufacturer = false, options = {}) {
  const originationFeeRate = 0.0075; // 0.75%
  const guaranty = calculateSBA7aGuarantyFee({
    loanAmount,
    termMonths: options.termMonths || ((options.loanTermYears || 10) * 12),
    isManufacturer,
    program: options.program || 'standard',
    guaranteePercent: options.guaranteePercent,
    existingGrossApprovals90Days: options.existingGrossApprovals90Days || 0,
  });

  const originationFee = loanAmount * originationFeeRate;
  const guarantyFee = guaranty.guarantyFee;
  const totalFees = originationFee + guarantyFee;

  const netProceeds = loanAmount - totalFees;

  return {
    originationFee: roundMoney(originationFee),
    originationFeePercent: originationFeeRate * 100,
    guarantyFee: roundMoney(guarantyFee),
    guarantyFeePercent: guaranty.feeRateLabel,
    guarantyFeeBasis: guaranty,
    totalFees: roundMoney(totalFees),
    netProceeds: roundMoney(netProceeds),
    isManufacturerWaiverApplied: guaranty.waiverApplied,
  };
}

/**
 * Calculate an SBA 504 project structure.
 *
 * Defaults to the common 50/40/10 structure: conventional lender / CDC
 * debenture / borrower injection. FY2026 504 fees are applied to the CDC
 * portion, with NAICS 31-33 manufacturer waiver support.
 */
export function calculateSBA504Project({
  projectCost,
  bankPercent = 0.5,
  cdcPercent = 0.4,
  equityPercent = 0.1,
  bankRate = 8.5,
  cdcRate = 6.35,
  bankTermYears = 25,
  cdcTermYears = 25,
  borrowerNAICS,
  isManufacturer = isManufacturingNAICS(borrowerNAICS),
  debtRefinanceWithoutExpansion = false,
} = {}) {
  const totalProjectCost = Number(projectCost) || 0;
  const bankLoanAmount = totalProjectCost * bankPercent;
  const cdcLoanAmount = totalProjectCost * cdcPercent;
  const borrowerEquity = totalProjectCost * equityPercent;
  const upfrontGuarantyFeeRate = isManufacturer ? 0 : 0.005;
  const annualServiceFeeRate = isManufacturer ? 0 : (debtRefinanceWithoutExpansion ? 0.002115 : 0.00209);

  return {
    totalProjectCost: roundMoney(totalProjectCost),
    bankLoanAmount: roundMoney(bankLoanAmount),
    cdcLoanAmount: roundMoney(cdcLoanAmount),
    borrowerEquity: roundMoney(borrowerEquity),
    bankPercent: bankPercent * 100,
    cdcPercent: cdcPercent * 100,
    equityPercent: equityPercent * 100,
    bankMonthlyPayment: roundMoney(calculateMonthlyPayment(bankLoanAmount, bankRate, bankTermYears)),
    cdcMonthlyPayment: roundMoney(calculateMonthlyPayment(cdcLoanAmount, cdcRate, cdcTermYears)),
    blendedMonthlyPayment: roundMoney(
      calculateMonthlyPayment(bankLoanAmount, bankRate, bankTermYears) +
      calculateMonthlyPayment(cdcLoanAmount, cdcRate, cdcTermYears)
    ),
    upfrontGuarantyFee: roundMoney(cdcLoanAmount * upfrontGuarantyFeeRate),
    upfrontGuarantyFeePercent: upfrontGuarantyFeeRate * 100,
    firstYearAnnualServiceFee: roundMoney(cdcLoanAmount * annualServiceFeeRate),
    annualServiceFeePercent: annualServiceFeeRate * 100,
    manufacturerWaiverApplied: isManufacturer,
    debtRefinanceWithoutExpansion,
  };
}

/**
 * Validate loan affordability based on DSCR
 * Returns validation result with minimum DSCR requirement
 */
export function validateLoanAffordability(dscr, minimumDSCR = 1.25) {
  return {
    isAffordable: dscr > minimumDSCR,
    dscr: Math.round(dscr * 100) / 100,
    minimumRequired: minimumDSCR,
    shortfall: Math.max(0, Math.round((minimumDSCR - dscr) * 100) / 100),
    status: dscr > minimumDSCR ? 'PASS' : dscr >= 1.15 ? 'CONDITIONAL' : 'FAIL',
  };
}

/**
 * Calculate required equity injection
 * SBA 7(a) typically requires 10% equity from borrower
 */
export function calculateEquityRequirement(totalProjectCost, equityPercent = 0.1) {
  const equityRequired = totalProjectCost * equityPercent;
  const loanAmount = totalProjectCost - equityRequired;

  return {
    totalProjectCost: Math.round(totalProjectCost * 100) / 100,
    requiredAmount: Math.round(equityRequired * 100) / 100,
    equityRequired: Math.round(equityRequired * 100) / 100,
    equityPercent: equityPercent * 100,
    maximumLoanAmount: Math.round(loanAmount * 100) / 100,
    loanPercent: (1 - equityPercent) * 100,
  };
}

/**
 * Comprehensive loan calculation
 * Input: Financial data and loan parameters
 * Output: Complete loan analysis with amortization, DSCR, fees, etc.
 */
export function calculateLoanAnalysis(params) {
  const {
    requestedAmount,
    annualRate,
    loanTermYears,
    netOperatingIncome,
    totalProjectCost,
    borrowerNAICS,
    minimumDSCR = 1.25,
    equityPercent = 0.1,
  } = params;

  // Determine if manufacturer (NAICS 31-33) for fee waiver
  const isManufacturer = isManufacturingNAICS(borrowerNAICS);

  // Calculate fees
  const fees = calculateSBAFees(requestedAmount, isManufacturer, {
    loanTermYears,
    termMonths: loanTermYears * 12,
    program: params.program || 'standard',
    guaranteePercent: params.guaranteePercent,
    existingGrossApprovals90Days: params.existingGrossApprovals90Days,
  });

  // Generate amortization schedule
  const schedule = generateAmortizationSchedule(
    requestedAmount,
    annualRate,
    loanTermYears
  );

  // Calculate monthly and annual debt service
  const monthlyDebtService = calculateMonthlyPayment(
    requestedAmount,
    annualRate,
    loanTermYears
  );
  const annualDebtService = monthlyDebtService * 12;

  // Calculate total interest
  const totalInterest = schedule.reduce((sum, payment) => sum + payment.interest, 0);

  // Calculate DSCR
  const dscr = calculateDSCR(netOperatingIncome, monthlyDebtService);
  const dscrValidation = validateLoanAffordability(dscr, minimumDSCR);

  // Calculate equity requirement
  const equityAnalysis = calculateEquityRequirement(totalProjectCost, equityPercent);

  return {
    loanParameters: {
      requestedAmount: Math.round(requestedAmount * 100) / 100,
      annualRate: Math.round(annualRate * 100) / 100,
      loanTermYears,
      netProceeds: fees.netProceeds,
    },

    monthlyPayment: {
      amount: Math.round(monthlyDebtService * 100) / 100,
      principal: Math.round((monthlyDebtService - (requestedAmount * (annualRate / 100) / 12)) * 100) / 100,
      interest: Math.round((requestedAmount * (annualRate / 100) / 12) * 100) / 100,
    },

    annualDebtService: Math.round(annualDebtService * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPayments: Math.round((monthlyDebtService * loanTermYears * 12) * 100) / 100,

    fees,

    dscr: dscrValidation,

    equityAnalysis,

    affordability: {
      isAffordable: dscrValidation.isAffordable,
      assessment: dscrValidation.status === 'PASS'
        ? 'Loan is affordable based on DSCR'
        : dscrValidation.status === 'CONDITIONAL'
        ? 'Loan may require additional equity or rate adjustment'
        : 'Loan does not meet DSCR requirements',
    },

    amortizationSchedule: schedule,

    summary: {
      borrowerName: params.borrowerName || 'TBD',
      businessPurpose: params.businessPurpose || 'Working capital / Equipment / Real estate',
      loanProgram: 'SBA 7(a)',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Export all calculation functions for use in different contexts
 */
export default {
  calculateMonthlyPayment,
  generateAmortizationSchedule,
  calculateDSCR,
  calculateSBA7aGuarantyFee,
  calculateSBAFees,
  calculateSBA504Project,
  validateLoanAffordability,
  calculateEquityRequirement,
  calculateLoanAnalysis,
};
