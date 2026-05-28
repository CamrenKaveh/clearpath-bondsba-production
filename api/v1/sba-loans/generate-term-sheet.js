/**
 * SBA Loans Term Sheet Generator
 *
 * POST /api/v1/sba-loans/generate-term-sheet
 *
 * Generates a professional term sheet document using Claude AI and a structured template.
 * Combines parsed financial data with loan parameters to create a presentation-ready document.
 *
 * Request body:
 * {
 *   loanParams: {
 *     principal: number,
 *     annualRate: number,
 *     termMonths: number,
 *     program: string
 *   },
 *   borrowerInfo: {
 *     name: string,
 *     industry: string,
 *     yearsInBusiness: number
 *   },
 *   parsedFinancials: {
 *     revenue: number,
 *     netIncome: number,
 *     totalAssets: number,
 *     totalLiabilities: number
 *   },
 *   lenderInfo: {
 *     name: string,
 *     officer: string,
 *     officerEmail: string
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     termSheetId: string,
 *     html: string,           // Full HTML term sheet (suitable for PDF conversion)
 *     narrative: string,      // AI-generated underwriting narrative
 *     createdAt: string
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
import { enforceRateLimit } from '../../../lib/middleware/rbac.js';
import { generateTermSheet } from '../../../src/domains/sba-loans/services/termSheetGenerator.js';

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

  const rateLimitError = enforceRateLimit(req, 20, 60 * 1000);
  if (rateLimitError) {
    const { statusCode, body } = rateLimitError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  try {
    const {
      // Loan parameters
      requestedAmount,
      loanParams,
      principal = requestedAmount || loanParams?.principal,
      annualRate = loanParams?.annualRate,
      termMonths = loanParams?.termMonths,
      loanTermYears = Math.round((termMonths || loanParams?.termMonths || 84) / 12),
      program = 'SBA 7(a)',

      // Borrower information
      borrowerName,
      borrowerInfo,
      businessDescription,
      industry = borrowerInfo?.industry,
      borrowerNAICS,

      // Financial data
      netOperatingIncome,
      parsedFinancials,
      totalProjectCost = principal,

      // Lender information
      lenderName = 'Community Bank',
      lenderInfo,
      loanOfficer = lenderInfo?.officer,
      loanOfficerEmail = lenderInfo?.officerEmail,

      // Optional parameters
      underwritingNarrative,
      useOfProceeds = 'Working capital, equipment, or other business purposes',
    } = req.body || {};

    // Validate required fields
    if (!principal || !annualRate || !loanTermYears) {
      const { statusCode, body } = formatErrorResponse({
        message: 'Missing required loan parameters',
        details: 'Must provide: principal (or requestedAmount), annualRate, loanTermYears (or termMonths)',
      });
      return res.status(statusCode).json(JSON.parse(body));
    }

    if (!borrowerName && !borrowerInfo?.name) {
      const { statusCode, body } = formatErrorResponse({
        message: 'Missing borrower information',
        details: 'Must provide: borrowerName',
      });
      return res.status(statusCode).json(JSON.parse(body));
    }

    // Generate structured term sheet using service layer
    const termSheet = generateTermSheet({
      borrowerName: borrowerName || borrowerInfo?.name,
      lenderName,
      loanOfficer,
      loanOfficerEmail,
      requestedAmount: principal,
      annualRate,
      loanTermYears,
      program,
      netOperatingIncome: netOperatingIncome || parsedFinancials?.netIncome || 0,
      totalProjectCost,
      borrowerNAICS,
      businessDescription: businessDescription || borrowerInfo?.businessDescription,
      underwritingNarrative,
      useOfProceeds,
    });

    const { statusCode, body } = formatSuccessResponse({
      termSheetId: `ts_${Date.now()}`,
      termSheet,
      html: termSheet.htmlTemplate, // For backward compatibility
      narrative: termSheet.narrative.underwriting,
      createdAt: new Date().toISOString(),
    });

    return res.status(statusCode).json(JSON.parse(body));
  } catch (error) {
    console.error('[SBA Term Sheet Error]', error);
    const { statusCode, body } = formatErrorResponse({
      message: 'Failed to generate term sheet',
      details: error.message,
    });
    return res.status(statusCode).json(JSON.parse(body));
  }
}
