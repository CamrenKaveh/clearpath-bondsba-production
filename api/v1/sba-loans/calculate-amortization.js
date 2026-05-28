/**
 * SBA Loans Amortization Calculator
 *
 * POST /api/v1/sba-loans/calculate-amortization
 *
 * Calculates loan amortization schedule using SBA 7(a) rules.
 * Applies mandatory financial spreading (13(c)(2)) and guaranty fee calculations.
 *
 * Request body:
 * {
 *   principal: number,         // Loan amount in dollars
 *   annualRate: number,        // Annual interest rate (e.g., 10.5 for 10.5%)
 *   termMonths: number,        // Loan term in months
 *   program: 'Equipment' | 'Working Capital' | 'Real Estate',
 *   fy2026MfrWaiver: boolean   // Apply FY2026 manufacturer guaranty fee waiver
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     monthlyPayment: number,
 *     totalPayment: number,
 *     totalInterest: number,
 *     dscr: number,
 *     fees: {
 *       originationFee: number,
 *       guarantyFee: number,
 *       waiverApplied: boolean,
 *       waiverSavings: number
 *     },
 *     schedule: [
 *       {
 *         month: number,
 *         payment: number,
 *         principal: number,
 *         interest: number,
 *         balance: number
 *       },
 *       ...
 *     ]
 *   }
 * }
 */

import {
  validateHttpMethod,
  validateRequiredFields,
  formatErrorResponse,
  formatSuccessResponse,
} from '../../../lib/middleware/validation.js';
import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import { calculateLoanAnalysis, calculateSBA504Project } from '../../../src/domains/sba-loans/services/loanCalculator.js';

export default async function handler(req, res) {
  // Verify authentication
  const authError = await verifyAndAttachUser(req);
  if (authError) {
    const { statusCode, body } = authError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  // Validate HTTP method
  const methodError = validateHttpMethod(req, ['POST']);
  if (methodError) {
    const { statusCode, body } = formatErrorResponse(methodError);
    return res.status(statusCode).json(JSON.parse(body));
  }

  try {
    const {
      requestedAmount,
      principal = requestedAmount, // Support both naming conventions
      annualRate,
      termMonths,
      loanTermYears = Math.round(termMonths / 12),
      program = 'Working Capital',
      netOperatingIncome = 0,
      totalProjectCost = principal,
      borrowerNAICS,
      fy2026MfrWaiver = false,
      borrowerName,
      businessPurpose,
    } = req.body || {};

    // Validate required fields
    const fieldError = validateRequiredFields(
      { principal, annualRate, loanTermYears },
      ['principal', 'annualRate', 'loanTermYears']
    );
    if (fieldError) {
      const { statusCode, body } = formatErrorResponse(fieldError);
      return res.status(statusCode).json(JSON.parse(body));
    }

    // Validate numeric ranges
    if (principal <= 0 || annualRate <= 0 || loanTermYears <= 0) {
      const { statusCode, body } = formatErrorResponse({
        message: 'Invalid parameters: principal, rate, and term must be positive',
      });
      return res.status(statusCode).json(JSON.parse(body));
    }

    // Use loanCalculator service
    const analysis = calculateLoanAnalysis({
      requestedAmount: principal,
      annualRate,
      loanTermYears,
      netOperatingIncome,
      totalProjectCost,
      borrowerNAICS: fy2026MfrWaiver ? 311 : borrowerNAICS, // 311 = Food Manufacturing
      program: String(program).toLowerCase().includes('express') ? 'express' : 'standard',
    });
    const sba504Project = String(program).toLowerCase().includes('504')
      ? calculateSBA504Project({
          projectCost: totalProjectCost || principal,
          cdcRate: annualRate,
          cdcTermYears: loanTermYears,
          borrowerNAICS: fy2026MfrWaiver ? 311 : borrowerNAICS,
        })
      : null;

    const { statusCode, body } = formatSuccessResponse({
      monthlyPayment: analysis.monthlyPayment.amount,
      annualPayment: analysis.annualDebtService,
      totalPayment: analysis.monthlyPayment.amount * loanTermYears * 12,
      totalInterest: analysis.totalInterest,
      netProceeds: analysis.fees.netProceeds,
      fees: {
        originationFee: analysis.fees.originationFee,
        originationFeePercent: analysis.fees.originationFeePercent,
        guarantyFee: analysis.fees.guarantyFee,
        guarantyFeePercent: analysis.fees.guarantyFeePercent,
        totalFees: analysis.fees.totalFees,
        waiverApplied: analysis.fees.isManufacturerWaiverApplied,
        waiverSavings: analysis.fees.isManufacturerWaiverApplied
          ? analysis.fees.guarantyFee + (principal * 0.015) - analysis.fees.guarantyFee
          : 0,
      },
      program,
      termYears: loanTermYears,
      annualRate,
      dscr: analysis.dscr,
      affordability: analysis.affordability,
      equityAnalysis: analysis.equityAnalysis,
      sba504Project,
      schedule: analysis.amortizationSchedule,
    });

    return res.status(statusCode).json(JSON.parse(body));
  } catch (error) {
    console.error('[SBA Amortization Error]', error);
    const { statusCode, body } = formatErrorResponse({
      message: 'Failed to calculate amortization',
      details: error.message,
    });
    return res.status(statusCode).json(JSON.parse(body));
  }
}
