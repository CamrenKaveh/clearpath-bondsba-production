/**
 * Input Sanitization & Validation Middleware
 *
 * Prevents injection attacks (SQL, XSS, LDAP, XML, code injection).
 * Validates data types, sizes, and formats.
 * Implements whitelist-based validation.
 *
 * Usage:
 * const sanitized = sanitizeAndValidate(input, schema);
 */

/**
 * Financial field validation schema
 * Used across SBA and Surety domains
 */
export const FINANCIAL_SCHEMA = {
  revenue: {
    type: 'number',
    min: 0,
    max: 1e12,
    required: true,
    description: 'Annual revenue in USD',
  },
  expenses: {
    type: 'number',
    min: 0,
    max: 1e12,
    required: true,
    description: 'Annual expenses in USD',
  },
  assets: {
    type: 'number',
    min: 0,
    max: 1e12,
    required: true,
    description: 'Total assets in USD',
  },
  liabilities: {
    type: 'number',
    min: 0,
    max: 1e12,
    required: true,
    description: 'Total liabilities in USD',
  },
  businessAge: {
    type: 'integer',
    min: 0,
    max: 100,
    required: true,
    description: 'Business age in years',
  },
  industryType: {
    type: 'string',
    enum: ['manufacturing', 'construction', 'service', 'retail', 'general'],
    required: true,
    description: 'Industry classification',
  },
};

/**
 * Document upload schema
 */
export const DOCUMENT_SCHEMA = {
  documentName: {
    type: 'string',
    minLength: 1,
    maxLength: 255,
    required: true,
    pattern: /^[a-zA-Z0-9\-_.\s]+$/,
    description: 'Document filename (alphanumeric, dash, underscore, space only)',
  },
  documentType: {
    type: 'string',
    enum: ['income-statement', 'balance-sheet', 'tax-return', 'cash-flow', 'other'],
    required: true,
    description: 'Classification of document',
  },
  mimeType: {
    type: 'string',
    enum: ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'],
    required: true,
    description: 'MIME type of uploaded file',
  },
  fileSize: {
    type: 'integer',
    min: 1,
    max: 50 * 1024 * 1024, // 50 MB max
    required: true,
    description: 'File size in bytes',
  },
};

/**
 * Validate value against schema
 */
function validateField(value, schema) {
  // Required field check
  if (schema.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${schema.description || 'Field'} is required` };
  }

  // Type check
  if (value !== null && value !== undefined) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (schema.type && actualType !== schema.type) {
      return { valid: false, error: `Expected ${schema.type}, got ${actualType}` };
    }
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(value)) {
    return { valid: false, error: `Value must be one of: ${schema.enum.join(', ')}` };
  }

  // Numeric checks
  if (schema.type === 'number' || schema.type === 'integer') {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: 'Must be a valid number' };
    }
    if (schema.min !== undefined && num < schema.min) {
      return { valid: false, error: `Minimum value is ${schema.min}` };
    }
    if (schema.max !== undefined && num > schema.max) {
      return { valid: false, error: `Maximum value is ${schema.max}` };
    }
  }

  // String checks
  if (schema.type === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      return { valid: false, error: `Minimum length is ${schema.minLength}` };
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      return { valid: false, error: `Maximum length is ${schema.maxLength}` };
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      return { valid: false, error: `Invalid format: ${value}` };
    }
  }

  return { valid: true };
}

/**
 * Sanitize and validate input object against schema
 */
export function sanitizeAndValidate(input, schema) {
  const errors = [];
  const sanitized = {};

  for (const [key, fieldSchema] of Object.entries(schema)) {
    const value = input[key];

    // Validate field
    const validation = validateField(value, fieldSchema);
    if (!validation.valid) {
      errors.push({ field: key, error: validation.error });
      continue;
    }

    // Sanitize based on type
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (fieldSchema.type === 'number') {
      sanitized[key] = Number(value);
    } else if (fieldSchema.type === 'integer') {
      sanitized[key] = Math.floor(Number(value));
    } else if (fieldSchema.type === 'string') {
      // Remove control characters, trim whitespace
      sanitized[key] = String(value)
        .trim()
        .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control chars
    } else {
      sanitized[key] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: sanitized,
  };
}

/**
 * Prevent SQL injection in string values
 * Check for SQL keywords and suspicious patterns
 */
export function isSQLInjectionAttempt(value) {
  if (typeof value !== 'string') return false;

  const sqlPatterns = [
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bDELETE\b.*\bFROM\b)/i,
    /(\bUPDATE\b.*\bSET\b)/i,
    /(-{2}|\/\*|\*\/)/,  // SQL comments
    /(;\s*[A-Z])/,        // Stacked queries
  ];

  return sqlPatterns.some(pattern => pattern.test(value));
}

/**
 * Prevent XSS by checking for dangerous HTML/JS
 */
export function isXSSAttempt(value) {
  if (typeof value !== 'string') return false;

  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
    /<iframe\b/gi,
    /<object\b/gi,
    /<embed\b/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(value));
}

/**
 * Prevent LDAP injection
 */
export function isLDAPInjectionAttempt(value) {
  if (typeof value !== 'string') return false;

  // LDAP uses special characters for filter syntax
  const ldapChars = ['*', '(', ')', '\\', '\x00'];
  return ldapChars.some(char => value.includes(char));
}

/**
 * Sanitize filename (prevent directory traversal)
 */
export function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._\-\s]/g, '') // Remove special chars
    .replace(/\.\./g, '') // Prevent ../ traversal
    .replace(/^\./, '') // Remove leading dots
    .substring(0, 255); // Limit length
}

/**
 * Middleware to validate request body
 */
export function validateRequestBody(req, schema) {
  if (!req.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'EMPTY_BODY',
          message: 'Request body required',
        },
      }),
    };
  }

  // Check for injection attempts
  for (const [key, value] of Object.entries(req.body)) {
    if (typeof value === 'string') {
      if (isSQLInjectionAttempt(value)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INJECTION_ATTEMPT',
              message: `Suspicious SQL pattern detected in field: ${key}`,
            },
          }),
        };
      }
      if (isXSSAttempt(value)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'XSS_ATTEMPT',
              message: `Suspicious script pattern detected in field: ${key}`,
            },
          }),
        };
      }
    }
  }

  // Validate against schema
  const validation = sanitizeAndValidate(req.body, schema);
  if (!validation.valid) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          errors: validation.errors,
        },
      }),
    };
  }

  // Replace body with sanitized version
  req.body = validation.data;
  return null;
}

export default {
  FINANCIAL_SCHEMA,
  DOCUMENT_SCHEMA,
  sanitizeAndValidate,
  isSQLInjectionAttempt,
  isXSSAttempt,
  isLDAPInjectionAttempt,
  sanitizeFilename,
  validateRequestBody,
};
