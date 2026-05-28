/**
 * Core Router
 *
 * Central orchestrator for domain routing and request handling.
 * Coordinates between the core parser engine and domain-specific services.
 *
 * Patterns:
 * - Single upload + analysis pipeline
 * - Domain-specific routes
 * - Centralized error handling
 */

import { getParserInstance } from './parser-instance.js';
import { SpreadingEngine } from '../domains/surety/services/spreadingEngine.js';
import { WIPAnalyzer } from '../domains/surety/services/wipAnalyzer.js';

export class Router {
  constructor() {
    this.parser = getParserInstance();
  }

  /**
   * Full surety analysis pipeline
   * Document -> Parse -> Spread -> WIP Analysis -> Underwriting Summary
   */
  async analyzeSuretybondApplication(document, analysisOptions = {}) {
    const {
      documentType = 'unknown',
      extractTables = true,
      extractText = true,
      wipDetails = {},
      spreadingOptions = {},
      analysisType = 'full',
    } = analysisOptions;

    try {
      // Step 1: Parse document
      const parseResult = await this.parser.parse(document, {
        documentType,
        extractTables,
        extractText,
      });

      if (parseResult.errors && parseResult.errors.length > 0) {
        console.warn('Parse warnings:', parseResult.errors);
      }

      // Step 2: Transform for surety domain
      const suretyData = this.parser.transformForDomain(parseResult.normalized, 'surety');

      // Step 3: Run analyses
      const analysis = {
        metadata: {
          documentId: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          analysisDate: new Date().toISOString(),
          analysisType,
          documentType,
          parseQuality: parseResult.quality,
        },
        parsed: {
          raw: parseResult.raw,
          normalized: suretyData,
        },
      };

      // Run Spreading Engine
      if (['spreading', 'full'].includes(analysisType)) {
        const spreadingEngine = new SpreadingEngine();
        analysis.spreadingAnalysis = await spreadingEngine.generateSpread(
          suretyData,
          spreadingOptions
        );
      }

      // Run WIP Analyzer
      if (['wip', 'full'].includes(analysisType)) {
        const wipAnalyzer = new WIPAnalyzer();
        analysis.wipAnalysis = await wipAnalyzer.analyzeWIP(suretyData, wipDetails);
      }

      // Step 4: Generate underwriting summary
      analysis.underwritingSummary = this.generateSummary(analysis);

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      console.error('Surety bond application analysis failed:', error);
      return {
        success: false,
        error: {
          message: `Analysis failed: ${error.message}`,
          type: 'ANALYSIS_FAILED',
        },
      };
    }
  }

  /**
   * Generate underwriting summary from analyses
   */
  generateSummary(analysis) {
    const summary = {
      overallRiskLevel: 'unknown',
      keyMetrics: {},
      recommendations: [],
      warnings: [],
      analyses: {
        spreadingCompleted: !!analysis.spreadingAnalysis && !analysis.spreadingAnalysis.error,
        wipCompleted: !!analysis.wipAnalysis && !analysis.wipAnalysis.error,
      },
    };

    // Extract metrics from spreading analysis
    if (analysis.spreadingAnalysis && !analysis.spreadingAnalysis.error) {
      const spreading = analysis.spreadingAnalysis;

      if (spreading.asAllowed) {
        summary.keyMetrics.asAllowedNetIncome = spreading.asAllowed.asAllowedNetIncome;
        summary.keyMetrics.asAllowedMarginPercent = spreading.asAllowed.asAllowedNetIncomePercentage;
        summary.keyMetrics.totalAdjustments = spreading.asAllowed.totalAdjustments;
      }

      if (spreading.original) {
        summary.keyMetrics.originalNetIncome = spreading.original.netIncome;
        summary.keyMetrics.originalRevenue = spreading.original.revenue;
      }

      if (spreading.riskFactors && spreading.riskFactors.length > 0) {
        spreading.riskFactors.forEach(factor => {
          summary.warnings.push({
            source: 'spreading',
            code: factor.code,
            severity: factor.severity,
            message: factor.message,
          });
        });
      }
    }

    // Extract metrics from WIP analysis
    if (analysis.wipAnalysis && !analysis.wipAnalysis.error) {
      const wip = analysis.wipAnalysis;

      if (wip.wipSummary) {
        summary.keyMetrics.totalWIP = wip.wipSummary.totalWIP;
        summary.keyMetrics.activeContracts = wip.wipSummary.activeContracts;
        summary.keyMetrics.completedContracts = wip.wipSummary.completedContracts;
        summary.keyMetrics.averageGrossMargin = wip.wipSummary.averageGrossMargin;
      }

      if (wip.bondExposure) {
        summary.keyMetrics.totalBondValue = wip.bondExposure.totalBondValue;
        summary.keyMetrics.performanceBonds = wip.bondExposure.performanceBonds;
        summary.keyMetrics.paymentBonds = wip.bondExposure.paymentBonds;
        summary.keyMetrics.bondsAtRisk = wip.bondExposure.bondsAtRisk;
        summary.keyMetrics.bondsAtRiskPercent = wip.bondExposure.bondsAtRiskPercentage;
      }

      if (wip.riskAssessment && wip.riskAssessment.length > 0) {
        wip.riskAssessment.forEach(risk => {
          summary.warnings.push({
            source: 'wip',
            code: risk.code,
            severity: risk.severity,
            message: risk.message,
            contractIds: risk.contracts,
          });
        });
      }
    }

    // Determine overall risk level based on warnings
    const criticalWarnings = summary.warnings.filter(w => w.severity === 'critical').length;
    const highWarnings = summary.warnings.filter(w => w.severity === 'high').length;
    const totalWarnings = summary.warnings.length;

    if (criticalWarnings > 0) {
      summary.overallRiskLevel = 'critical';
      summary.recommendations.push('ESCALATE: Critical risk factors require senior underwriter review');
      summary.recommendations.push('Do not proceed without executive approval');
    } else if (highWarnings > 0) {
      summary.overallRiskLevel = 'high';
      summary.recommendations.push('Escalate to senior underwriter for exception approval');
      summary.recommendations.push('Request additional documentation or borrower explanation');
    } else if (totalWarnings > 0) {
      summary.overallRiskLevel = 'moderate';
      summary.recommendations.push('Address identified moderate risk factors');
      summary.recommendations.push('Request clarification on specific metrics');
    } else {
      summary.overallRiskLevel = 'low';
      summary.recommendations.push('Proceed with favorable recommendation');
      summary.recommendations.push('Obtain board-level approval for final commitment');
    }

    return summary;
  }
}

// Export singleton instance
export const router = new Router();
