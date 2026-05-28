/**
 * Validation Middleware
 *
 * Shared validation logic for API endpoints.
 * Provides helpers for request validation and error responses.
 */

export function validateHttpMethod(req, allowedMethods = ['POST']) {
  if (!allowedMethods.includes(req.method)) {
    return {
      error: `Method ${req.method} not allowed. Allowed: ${allowedMethods.join(', ')}`,
      statusCode: 405,
    };
  }
  return null;
}

export function validateContentType(req, expectedType = 'application/json') {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes(expectedType)) {
    return {
      error: `Invalid content type. Expected ${expectedType}, got ${contentType}`,
      statusCode: 400,
    };
  }
  return null;
}

export function validateRequiredFields(body, requiredFields) {
  const missingFields = requiredFields.filter(field => !body[field]);
  if (missingFields.length > 0) {
    return {
      error: `Missing required fields: ${missingFields.join(', ')}`,
      statusCode: 400,
    };
  }
  return null;
}

export function formatErrorResponse(error, defaultStatusCode = 500) {
  if (error.statusCode && error.error) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({
        error: error.error,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  return {
    statusCode: defaultStatusCode,
    body: JSON.stringify({
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    }),
  };
}

export function formatSuccessResponse(data, statusCode = 200) {
  return {
    statusCode,
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
  };
}
