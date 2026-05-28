/**
 * SBA Loans Document Upload Endpoint
 *
 * POST /api/v1/sba-loans/upload
 *
 * Accepts a financial document, parses it using the core DocumentParserEngine,
 * and returns normalized financial data ready for SBA analysis.
 *
 * Request body:
 * {
 *   document: { name, content (base64 or text), type },
 *   documentType: 'income-statement' | 'balance-sheet' | 'tax-return' | etc.,
 *   extractTables: boolean (default: true),
 *   extractText: boolean (default: true)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     documentId: string,
 *     parsed: {
 *       raw: { ... },
 *       normalized: { ... },
 *       metadata: { ... }
 *     }
 *   }
 * }
 */

import { getParserInstance } from '../../../src/core/parser-instance.js';
import {
  validateHttpMethod,
  validateRequiredFields,
  formatErrorResponse,
  formatSuccessResponse,
} from '../../../lib/middleware/validation.js';
import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';

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
    const { document, documentType = 'unknown', extractTables = true, extractText = true } = req.body || {};

    // Validate required fields
    const fieldError = validateRequiredFields({ document }, ['document']);
    if (fieldError) {
      const { statusCode, body } = formatErrorResponse(fieldError);
      return res.status(statusCode).json(JSON.parse(body));
    }

    // Get parser instance and parse document
    const parser = getParserInstance();
    const parsed = await parser.parse(document, {
      documentType,
      extractTables,
      extractText,
    });

    // Return success response
    const { statusCode, body } = formatSuccessResponse({
      documentId: `doc_${Date.now()}`,
      parsed,
    });

    return res.status(statusCode).json(JSON.parse(body));
  } catch (error) {
    console.error('[SBA Upload Error]', error);
    const { statusCode, body } = formatErrorResponse({
      message: 'Failed to upload document',
      details: error.message,
    });
    return res.status(statusCode).json(JSON.parse(body));
  }
}
