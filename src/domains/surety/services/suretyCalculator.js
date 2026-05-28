/**
 * Surety Bond Calculator Service
 *
 * Calculates surety bond financial analysis using EXACT decimal arithmetic.
 *
 * Handles:
 * - Premium calculations
 * - Loss ratio analysis
 * - Spread analysis (as-allowed adjustments)
 * - Risk scoring
 */

import { decimalMath as dm } from '../../../shared/utils/decimalMath.js';
import { BaseSuretyService } from './BaseSuretyService.js';

export class SuretyCalculator extends BaseSuretyService {
  /**
   * Main analysis entry point
   * Input: normalized financial data from document parser
   * Output: surety-specific risk analysis
   */
  analyzeApplication(financialData, options = {}) {
    this.validateInput(
      financialData,
      ['revenue', 'expenses', 'assets', 'liabilities']
    );

    const {
      premium = 0,
      businessAge = 5,
      industryType = 'general',
    } = options;

    // All calculations use Decimal for precision
    const revenue = dm.parse(financialData.revenue);
    const expenses = dm.parse(financialData.expenses);
    const assets = dm.parse(financialData.assets);
    const liabilities = dm.parse(financialData.liabilities);
    const equity = assets.minus(liabilities);

    // Net income (exact calculation)
    const netIncome = revenue.minus(expenses);

    // Profitability ratio
    const profitMargin = revenue.isZero()
      ? dm.parse(0)
      : dm.divide(netIncome, revenue).times(100);

    // Debt-to-equity ratio
    const debtToEquity = equity.isZero()
      ? dm.parse(999)
      : dm.divide(liabilities, equity);

    // Premium calculation with carrier standards
    const premiumAmount = this.calculatePremium(revenue, businessAge, industryType);

    // Loss ratio (premium vs. expected losses)
    const lossRatio = this.calculateLossRatio(revenue, profitMargin, industryType);

    // Spread analysis (as-allowed adjustments)
    const spreadAnalysis = this.analyzeSpread(financialData);

    // Risk score (0-100)
    const riskScore = this.calculateRiskScore({
      profitMargin: dm.toNumber(profitMargin),
      debtToEquity: dm.toNumber(debtToEquity),
      lossRatio: dm.toNumber(lossRatio),
      businessAge,
      industryType,
    });

    return {
      summary: {
        revenue: dm.toNumber(revenue),
        expenses: dm.toNumber(expenses),
        netIncome: dm.toNumber(netIncome),
        profitMargin: dm.toNumber(dm.round(profitMargin, 2)),
        debtToEquity: dm.toNumber(dm.round(debtToEquity, 2)),
      },
      premium: {
        amount: dm.toNumber(premiumAmount),
        formatted: dm.formatCurrency(premiumAmount),
      },
      lossRatio: {
        ratio: dm.toNumber(dm.round(lossRatio, 2)),
        interpretation: this.interpretLossRatio(dm.toNumber(lossRatio)),
      },
      spread: spreadAnalysis,
      riskScore: {
        score: riskScore,
        rating: this.getRiskRating(riskScore),
        factors: this.identifyRiskFactors(financialData, dm.toNumber(profitMargin)),
      },
    };
  }

  /**
   * Calculate surety premium with EXACT decimal math
   * Formula: Base Premium × Adjustment Factors
   */
  calculatePremium(revenue, businessAge, industryType) {
    // Base premium rate per $1000 of revenue (varies by industry)
    const baseRates = {
      construction: 2.5,
      manufacturing: 2.0,
      service: 1.8,
      retail: 2.2,
      general: 2.0,
    };

    const baseRate = dm.parse(baseRates[industryType] || baseRates.general);

    // Revenue in thousands
    const revenueInThousands = dm.divide(revenue, 1000);

    // Base premium
    const basePremium = dm.multiply(revenueInThousands, baseRate);

    // Business age adjustment (younger = higher premium)
    let ageAdjustment = dm.parse(1.0);
    if (businessAge < 2) {
      ageAdjustment = dm.parse(1.5);  // +50% for new businesses
    } else if (businessAge < 5) {
      ageAdjustment = dm.parse(1.2);  // +20% for < 5 years
    } else if (businessAge > 10) {
      ageAdjustment = dm.parse(0.9);  // -10% for established
    }

    return dm.round(dm.multiply(basePremium, ageAdjustment), 2);
  }

  /**
   * Calculate loss ratio (expected losses / premium)
   * Used by surety carriers to assess profitability
   */
  calculateLossRatio(revenue, profitMargin, industryType) {
    // Expected loss rate varies by industry
    const expectedLossRates = {
      construction: 0.35,
      manufacturing: 0.25,
      service: 0.20,
      retail: 0.30,
      general: 0.25,
    };

    const expectedLossRate = dm.parse(expectedLossRates[industryType] || 0.25);

    // Adjust by profitability (more profitable = lower loss rate)
    const profitAdjustment = dm.divide(profitMargin, 100);

    return dm.multiply(expectedLossRate, dm.parse(1).minus(profitAdjustment));
  }

  /**
   * Analyze financial spread (as-allowed adjustments)
   * This is where surety does "spreading" - adjusting reported numbers per SBA rules
   */
  analyzeSpread(financialData) {
    const revenue = dm.parse(financialData.revenue);
    const expenses = dm.parse(financialData.expenses);

    // Conservative spreading (typical surety rules)
    const adjustedRevenue = dm.round(dm.multiply(revenue, 0.95), 2);  // 95% of reported
    const adjustedExpenses = dm.round(dm.multiply(expenses, 1.05), 2); // 105% of reported (add 5% contingency)
    const adjustedNetIncome = adjustedRevenue.minus(adjustedExpenses);

    return {
      original: {
        revenue: dm.toNumber(revenue),
        expenses: dm.toNumber(expenses),
        netIncome: dm.toNumber(revenue.minus(expenses)),
      },
      asAllowed: {
        revenue: dm.toNumber(adjustedRevenue),
        expenses: dm.toNumber(adjustedExpenses),
        netIncome: dm.toNumber(adjustedNetIncome),
      },
      adjustments: {
        revenueAdjustment: -5,  // percent
        expenseAdjustment: 5,   // percent
      },
    };
  }

  /**
   * Calculate overall risk score (0-100 scale)
   */
  calculateRiskScore(factors) {
    let score = 50;  // Base score

    // Profitability impact (-30 to +10)
    const profitMargin = factors.profitMargin;
    if (profitMargin > 20) score += 10;
    else if (profitMargin > 15) score += 5;
    else if (profitMargin < 5) score -= 20;
    else if (profitMargin < 0) score -= 30;

    // Leverage impact (-20 to +5)
    const dte = factors.debtToEquity;
    if (dte > 3) score -= 20;
    else if (dte > 2) score -= 10;
    else if (dte < 0.5) score += 5;

    // Business age impact (-10 to +10)
    if (factors.businessAge < 2) score -= 10;
    else if (factors.businessAge > 10) score += 10;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
  }

  getRiskRating(score) {
    if (score >= 80) return 'A - Excellent';
    if (score >= 70) return 'B - Good';
    if (score >= 60) return 'C - Fair';
    if (score >= 50) return 'D - Acceptable';
    if (score >= 40) return 'E - Marginal';
    return 'F - Poor';
  }

  interpretLossRatio(ratio) {
    if (ratio < 0.6) return 'Profitable';
    if (ratio < 0.9) return 'Acceptable';
    if (ratio < 1.0) return 'At-Risk';
    return 'Unprofitable';
  }

  identifyRiskFactors(data, profitMargin) {
    const factors = [];

    if (profitMargin < 5) {
      factors.push({
        factor: 'Low Profitability',
        severity: 'high',
        description: 'Net profit margin below 5% indicates limited cushion for losses',
      });
    }

    if (data.liabilities > data.assets * 0.6) {
      factors.push({
        factor: 'High Leverage',
        severity: 'moderate',
        description: 'Liabilities exceed 60% of assets',
      });
    }

    if (data.assets < 10000) {
      factors.push({
        factor: 'Limited Assets',
        severity: 'low',
        description: 'Minimal asset base',
      });
    }

    return factors;
  }
}

export default SuretyCalculator;
