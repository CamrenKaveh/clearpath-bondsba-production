/**
 * As-Allowed Spreading Engine
 *
 * Responsible for spreading financial data across standard accounting schedules
 * to calculate "as-allowed" metrics for surety bond underwriting.
 *
 * This engine takes normalized financial data and produces spreads that show:
 * - Adjusted gross profit
 * - Allowed expenses vs claimed expenses
 * - Adjusted net income
 * - Surety-specific adjustments
 */

export class SpreadingEngine {
  constructor() {
    this.version = '1.0.0';
    // Surety-specific adjustment rules
    this.adjustmentRules = {
      ownerSalaryAdjustment: 0.15, // 15% adjustment for owner's salary
      depreciationAdd: true, // Add back depreciation
      amortizationAdd: true, // Add back amortization
      interestAdjustment: 0.5, // 50% of interest is "as-allowed"
    };
  }

  /**
   * Generate a spread sheet for the given normalized financial data
   * @param {Object} normalizedData - From DocumentParserEngine
   * @param {Object} options - Spreading options
   * @returns {Promise<Object>} Spread sheet with adjustments and calculations
   */
  async generateSpread(normalizedData, options = {}) {
    try {
      const financials = normalizedData.financials;

      const spread = {
        metadata: {
          spreadDate: new Date().toISOString(),
          underwriter: options.underwriter || 'System',
          documentType: normalizedData.documentMetadata.type,
        },

        // Original values
        original: {
          revenue: financials.revenue,
          grossProfit: financials.grossProfit,
          operatingExpenses: financials.expenses,
          netIncome: financials.netIncome,
        },

        // Adjustments (add-backs, disallowances)
        adjustments: this.calculateAdjustments(financials, options),

        // As-Allowed Calculations
        asAllowed: {},

        // Risk factors for underwriting
        riskFactors: this.assessRiskFactors(financials),
      };

      // Calculate as-allowed figures
      spread.asAllowed = this.computeAsAllowedFigures(
        spread.original,
        spread.adjustments
      );

      return spread;
    } catch (error) {
      return {
        error: error.message,
        errorType: 'SPREADING_ERROR',
      };
    }
  }

  /**
   * Calculate allowed adjustments to financial figures
   */
  calculateAdjustments(financials, options) {
    return {
      ownerCompensation: {
        amount: financials.revenue * this.adjustmentRules.ownerSalaryAdjustment,
        rule: 'Owner salary adjustment',
        addBack: true,
      },
      depreciation: {
        amount: financials.expenses * 0.05, // Estimate 5% of expenses
        rule: 'Depreciation add-back',
        addBack: this.adjustmentRules.depreciationAdd,
      },
      amortization: {
        amount: financials.expenses * 0.02, // Estimate 2% of expenses
        rule: 'Amortization add-back',
        addBack: this.adjustmentRules.amortizationAdd,
      },
      interest: {
        amount: financials.expenses * 0.1, // Estimate 10% of expenses
        rule: 'Interest adjustment (50% disallowed)',
        disallowance: this.adjustmentRules.interestAdjustment,
      },
      nonRecurringItems: {
        amount: 0, // To be populated from detailed expense analysis
        rule: 'Non-recurring expense adjustments',
        addBack: true,
      },
      relatedPartyTransactions: {
        amount: 0, // Flagged for review
        rule: 'Related party transaction review',
        addBack: false,
      },
    };
  }

  /**
   * Compute as-allowed financial figures
   */
  computeAsAllowedFigures(original, adjustments) {
    let totalAdjustments = 0;

    // Sum all add-backs
    Object.values(adjustments).forEach((adj) => {
      if (adj.addBack) {
        totalAdjustments += adj.amount;
      } else if (adj.disallowance) {
        totalAdjustments -= adj.amount * adj.disallowance;
      }
    });

    const asAllowedNetIncome = original.netIncome + totalAdjustments;

    return {
      revenue: original.revenue, // Usually no adjustment
      grossProfit: original.grossProfit,
      asAllowedNetIncome,
      asAllowedNetIncomePercentage: (asAllowedNetIncome / original.revenue) * 100,
      totalAdjustments,
    };
  }

  /**
   * Assess risk factors for underwriting
   */
  assessRiskFactors(financials) {
    const factors = [];

    // Revenue volatility
    if (financials.revenue < 50000) {
      factors.push({
        code: 'LOW_REVENUE',
        severity: 'high',
        message: 'Revenue below $50K threshold',
      });
    }

    // Profit margin
    const profitMargin = (financials.netIncome / financials.revenue) * 100 || 0;
    if (profitMargin < 5) {
      factors.push({
        code: 'LOW_MARGIN',
        severity: 'high',
        message: 'Profit margin below 5%',
      });
    }

    // Debt-to-equity
    const debtToEquity = financials.liabilities.total / (financials.equity || 1);
    if (debtToEquity > 3) {
      factors.push({
        code: 'HIGH_LEVERAGE',
        severity: 'medium',
        message: 'Debt-to-equity ratio exceeds 3:1',
      });
    }

    return factors;
  }

  /**
   * Compare multiple spreads for trend analysis
   */
  compareSpread(currentSpread, priorSpread) {
    if (!priorSpread) return null;

    return {
      revenueGrowth:
        ((currentSpread.original.revenue - priorSpread.original.revenue) /
          priorSpread.original.revenue) *
        100,
      profitGrowth:
        ((currentSpread.asAllowed.asAllowedNetIncome -
          priorSpread.asAllowed.asAllowedNetIncome) /
          priorSpread.asAllowed.asAllowedNetIncome) *
        100,
      trend: 'improving', // To be calculated based on metrics
    };
  }
}
