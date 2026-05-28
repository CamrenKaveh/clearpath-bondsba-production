/**
 * Data Normalizer Module
 *
 * Converts raw extracted data into a standardized schema
 * that both SBA and Surety domains understand.
 *
 * This is the contract layer between the core parser and domain-specific logic.
 */

export class DataNormalizer {
  /**
   * Normalize extracted data into standard format
   * @param {Object} rawData - Output from OCR + Table Extractor
   * @param {string} documentType - Type of document being parsed
   * @returns {Object} Normalized data adhering to standard schema
   */
  normalize(rawData, documentType) {
    return {
      documentMetadata: {
        type: documentType,
        extractedAt: new Date().toISOString(),
        sourceFormat: 'pdf', // Could be image, pdf, csv, etc.
      },
      financials: this.extractFinancialData(rawData),
      business: this.extractBusinessData(rawData),
      owners: this.extractOwnershipData(rawData),
      raw: rawData, // Keep raw for reference/debugging
    };
  }

  /**
   * Extract financial metrics from raw data
   */
  extractFinancialData(rawData) {
    const financials = {
      // Income Statement
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      grossProfit: 0,
      operatingIncome: 0,

      // Balance Sheet
      assets: {
        current: 0,
        fixed: 0,
        total: 0,
      },
      liabilities: {
        current: 0,
        longTerm: 0,
        total: 0,
      },
      equity: 0,

      // Cash Flow
      operatingCashFlow: 0,
      investingCashFlow: 0,
      financingCashFlow: 0,

      // Ratios (calculated)
      currentRatio: 0,
      debtToEquity: 0,
      profitMargin: 0,
      dscr: 0, // Debt Service Coverage Ratio
    };

    // TODO: Parse rawData.tables to populate these fields
    // This requires intelligent table parsing and column identification

    return financials;
  }

  /**
   * Extract business information from raw data
   */
  extractBusinessData(rawData) {
    return {
      name: null,
      industry: null,
      yearsFounded: null,
      numberOfEmployees: null,
      businessType: null, // sole-proprietor, llc, corporation, etc.
      principalAddress: null,
      taxId: null, // EIN/TIN
      description: null,
    };
  }

  /**
   * Extract ownership and principal information
   */
  extractOwnershipData(rawData) {
    return {
      principals: [
        {
          name: null,
          title: null,
          ownership: 0, // percentage
          personalCreditScore: null,
          netWorth: null,
        },
      ],
      guarantors: [],
    };
  }

  /**
   * Validate that normalized data meets minimum requirements
   */
  validate(normalized) {
    const errors = [];

    // Check required financial fields
    if (!normalized.financials) {
      errors.push('Missing financials section');
    }

    if (!normalized.business) {
      errors.push('Missing business section');
    }

    // Check data quality
    if (normalized.financials.revenue === 0) {
      errors.push('Revenue is zero - check extraction');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Transform normalized data for a specific domain
   * Each domain gets a consistent starting point but can request custom fields
   */
  transformForDomain(normalized, domainName) {
    const baseTransform = {
      documentMetadata: normalized.documentMetadata,
      financials: normalized.financials,
      business: normalized.business,
      owners: normalized.owners,
    };

    // Add domain-specific fields if needed
    if (domainName === 'surety') {
      baseTransform.suretyContext = {
        // Fields that surety domain cares about
        underwritingDate: new Date().toISOString(),
        spreaderRequired: true,
        wipAnalysisRequired: true,
      };
    }

    if (domainName === 'sba') {
      baseTransform.sbaContext = {
        // Fields that SBA domain cares about
        loanPurpose: null,
        sbaProgram: null,
        guarantyPercentage: 0,
      };
    }

    return baseTransform;
  }
}
