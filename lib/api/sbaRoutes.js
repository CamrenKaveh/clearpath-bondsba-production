import { getParserInstance } from '../../src/core/parser-instance.js';
import { verifyAndAttachUser } from '../middleware/auth.js';
import { validateHttpMethod, validateRequiredFields, formatErrorResponse, formatSuccessResponse } from '../middleware/validation.js';

export async function handleSbaUpload(req, res) {
  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  const methodError = validateHttpMethod(req, ['POST']);
  if (methodError) {
    const { statusCode, body } = formatErrorResponse(methodError);
    return res.status(statusCode).json(JSON.parse(body));
  }

  try {
    const { document, documentType = 'unknown', extractTables = true, extractText = true } = req.body || {};
    const fieldError = validateRequiredFields({ document }, ['document']);
    if (fieldError) {
      const { statusCode, body } = formatErrorResponse(fieldError);
      return res.status(statusCode).json(JSON.parse(body));
    }

    const parsed = await getParserInstance().parse(document, {
      documentType,
      extractTables,
      extractText,
    });

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
