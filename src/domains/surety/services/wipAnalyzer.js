/**
 * Work-in-Progress (WIP) Analyzer
 *
 * For construction and contracting surety bonds, this analyzer evaluates:
 * - Current contract backlog
 * - In-progress contracts and their financial health
 * - Gross margin by contract
 * - Payment and performance bond exposure
 *
 * This is critical for surety risk assessment on contractor bonds.
 */

export class WIPAnalyzer {
  constructor() {
    this.version = '1.0.0';
  }

  /**
   * Analyze work-in-progress from financial statements
   * @param {Object} normalizedData - From DocumentParserEngine
   * @param {Object} wipDetails - Contractor-specific WIP data (optional)
   * @returns {Promise<Object>} WIP analysis report
   */
  async analyzeWIP(normalizedData, wipDetails = {}) {
    try {
      const analysis = {
        metadata: {
          analysisDate: new Date().toISOString(),
          documentType: normalizedData.documentMetadata.type,
        },

        wipSummary: this.calculateWIPSummary(wipDetails),
        contractAnalysis: this.analyzeContracts(wipDetails),
        marginAnalysis: this.analyzeMargins(wipDetails),
        bondExposure: this.calculateBondExposure(wipDetails),
        riskAssessment: this.assessWIPRisks(wipDetails),
      };

      return analysis;
    } catch (error) {
      return {
        error: error.message,
        errorType: 'WIP_ANALYSIS_ERROR',
      };
    }
  }

  /**
   * Calculate WIP summary metrics
   */
  calculateWIPSummary(wipDetails) {
    const contracts = wipDetails.contracts || [];

    return {
      totalWIP: contracts.reduce((sum, c) => sum + (c.contractValue || 0), 0),
      completedContracts: contracts.filter((c) => c.status === 'completed').length,
      activeContracts: contracts.filter((c) => c.status === 'in-progress').length,
      averageGrossMargin: this.calculateAverageMargin(contracts),
      estimatedCompletionDate: this.estimateCompletion(contracts),
    };
  }

  /**
   * Analyze individual contracts
   */
  analyzeContracts(wipDetails) {
    const contracts = wipDetails.contracts || [];

    return contracts.map((contract) => ({
      id: contract.id,
      name: contract.name,
      owner: contract.owner,
      contractValue: contract.contractValue,
      costToDate: contract.costToDate,
      billedToDate: contract.billedToDate,
      earnedIncome: contract.contractValue - (contract.contractValue - contract.percentComplete * contract.contractValue),
      grossMarginToDated: this.calculateContractMargin(contract),
      percentComplete: contract.percentComplete || 0,
      status: contract.status, // 'completed', 'in-progress', 'pending'
      estimatedCompletion: contract.estimatedCompletion,
      riskFlags: this.flagContractRisks(contract),
    }));
  }

  /**
   * Analyze gross margins across contracts
   */
  analyzeMargins(wipDetails) {
    const contracts = wipDetails.contracts || [];

    const margins = contracts
      .filter((c) => c.contractValue > 0)
      .map((c) => this.calculateContractMargin(c));

    const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b) / margins.length : 0;

    return {
      averageGrossMargin: avgMargin,
      lowestMargin: Math.min(...margins),
      highestMargin: Math.max(...margins),
      contractsBelow10Percent: contracts.filter((c) => this.calculateContractMargin(c) < 10).length,
      marginTrend: this.calculateMarginTrend(contracts),
    };
  }

  /**
   * Calculate payment and performance bond exposure
   */
  calculateBondExposure(wipDetails) {
    const contracts = wipDetails.contracts || [];

    const totalBondValue = contracts.reduce(
      (sum, c) => sum + ((c.performanceBondValue || 0) + (c.paymentBondValue || 0)),
      0
    );

    const atRiskBonds = contracts
      .filter((c) => c.percentComplete > 80)
      .reduce(
        (sum, c) => sum + ((c.performanceBondValue || 0) + (c.paymentBondValue || 0)),
        0
      );

    return {
      totalBondValue,
      performanceBonds: contracts.reduce((sum, c) => sum + (c.performanceBondValue || 0), 0),
      paymentBonds: contracts.reduce((sum, c) => sum + (c.paymentBondValue || 0), 0),
      bondsAtRisk: atRiskBonds, // Contracts >80% complete
      bondsAtRiskPercentage: totalBondValue > 0 ? (atRiskBonds / totalBondValue) * 100 : 0,
    };
  }

  /**
   * Assess WIP-specific risks for underwriting
   */
  assessWIPRisks(wipDetails) {
    const risks = [];
    const contracts = wipDetails.contracts || [];

    // Check for negative margin contracts
    const negativeMarginContracts = contracts.filter(
      (c) => this.calculateContractMargin(c) < 0
    );
    if (negativeMarginContracts.length > 0) {
      risks.push({
        code: 'NEGATIVE_MARGIN',
        severity: 'critical',
        message: `${negativeMarginContracts.length} contracts with negative margins`,
        contracts: negativeMarginContracts.map((c) => c.id),
      });
    }

    // Check for over-extended project schedules
    const overdueContracts = contracts.filter((c) => {
      if (!c.estimatedCompletion) return false;
      return new Date(c.estimatedCompletion) < new Date();
    });
    if (overdueContracts.length > 0) {
      risks.push({
        code: 'OVERDUE_CONTRACTS',
        severity: 'high',
        message: `${overdueContracts.length} contracts past estimated completion date`,
      });
    }

    // Check for high concentration of WIP
    const totalWIP = contracts.reduce((sum, c) => sum + (c.contractValue || 0), 0);
    const largeContracts = contracts.filter((c) => (c.contractValue || 0) / totalWIP > 0.3);
    if (largeContracts.length > 0) {
      risks.push({
        code: 'HIGH_CONCENTRATION',
        severity: 'medium',
        message: `High concentration in ${largeContracts.length} large contracts (>30% of WIP)`,
      });
    }

    return risks;
  }

  // Helper methods

  calculateContractMargin(contract) {
    if (!contract.contractValue || contract.contractValue === 0) return 0;
    return ((contract.contractValue - (contract.costToDate || 0)) / contract.contractValue) * 100;
  }

  calculateAverageMargin(contracts) {
    if (!contracts.length) return 0;
    const margins = contracts.map((c) => this.calculateContractMargin(c));
    return margins.reduce((a, b) => a + b) / margins.length;
  }

  estimateCompletion(contracts) {
    const activeContracts = contracts.filter((c) => c.status === 'in-progress');
    if (!activeContracts.length) return null;

    const dates = activeContracts
      .map((c) => c.estimatedCompletion)
      .filter((d) => d)
      .map((d) => new Date(d));

    return dates.length ? new Date(Math.max(...dates)) : null;
  }

  calculateMarginTrend(contracts) {
    if (contracts.length < 2) return 'insufficient-data';

    const recentMargins = contracts.slice(-5).map((c) => this.calculateContractMargin(c));
    const avgRecent = recentMargins.reduce((a, b) => a + b) / recentMargins.length;
    const avgPrior = contracts
      .slice(0, -5)
      .map((c) => this.calculateContractMargin(c))
      .reduce((a, b) => a + b, 0) / Math.max(contracts.length - 5, 1);

    if (avgRecent > avgPrior) return 'improving';
    if (avgRecent < avgPrior) return 'declining';
    return 'stable';
  }

  flagContractRisks(contract) {
    const flags = [];

    if (this.calculateContractMargin(contract) < 5) {
      flags.push('low-margin');
    }
    if ((contract.percentComplete || 0) > 90) {
      flags.push('near-completion');
    }
    if (contract.status === 'pending' && new Date(contract.startDate) < new Date()) {
      flags.push('not-started-yet-overdue');
    }

    return flags;
  }
}
