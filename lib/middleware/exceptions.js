/**
 * Centralized Exception Handling & Security Incident Classification
 *
 * Features:
 * - Classify errors by severity (CRITICAL, HIGH, MEDIUM, LOW)
 * - Generate incident IDs for support/investigations
 * - Prevent information disclosure in error responses
 * - Log to monitoring services (Sentry, etc.)
 * - Track security events for audit logs
 *
 * Usage:
 * try { ... } catch (error) {
 *   return handleException(error, req, res, { severity: 'HIGH' });
 * }
 */

/**
 * Severity levels with corresponding HTTP status and alerting
 */
const SEVERITY_LEVELS = {
  CRITICAL: { httpStatus: 500, alert: true, retryable: false },
  HIGH: { httpStatus: 400, alert: false, retryable: false },
  MEDIUM: { httpStatus: 400, alert: false, retryable: true },
  LOW: { httpStatus: 200, alert: false, retryable: true },
};

/**
 * Error classification
 */
const ERROR_CODES = {
  // Authentication errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',

  // Authorization errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  DOMAIN_ACCESS_DENIED: 'DOMAIN_ACCESS_DENIED',

  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
  INJECTION_ATTEMPT: 'INJECTION_ATTEMPT',

  // Business logic errors
  CALCULATION_ERROR: 'CALCULATION_ERROR',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',

  // Infrastructure errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * Generate unique incident ID for tracking
 */
function generateIncidentId() {
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INC-${timestamp}-${random}`;
}

/**
 * Classify error to determine severity and HTTP status
 */
function classifyError(error) {
  const errorType = error.code || error.name || 'INTERNAL_ERROR';

  const classification = {
    // Authentication failures = HIGH severity
    [ERROR_CODES.INVALID_TOKEN]: { severity: 'HIGH', httpStatus: 401, retryable: false },
    [ERROR_CODES.TOKEN_EXPIRED]: { severity: 'HIGH', httpStatus: 401, retryable: true },
    [ERROR_CODES.UNAUTHENTICATED]: { severity: 'HIGH', httpStatus: 401, retryable: false },

    // Authorization failures = HIGH severity
    [ERROR_CODES.PERMISSION_DENIED]: { severity: 'HIGH', httpStatus: 403, retryable: false },
    [ERROR_CODES.INSUFFICIENT_ROLE]: { severity: 'HIGH', httpStatus: 403, retryable: false },
    [ERROR_CODES.DOMAIN_ACCESS_DENIED]: { severity: 'HIGH', httpStatus: 403, retryable: false },

    // Injection attempts = CRITICAL severity (security incident)
    [ERROR_CODES.INJECTION_ATTEMPT]: { severity: 'CRITICAL', httpStatus: 400, retryable: false },

    // Validation errors = MEDIUM severity
    [ERROR_CODES.INVALID_INPUT]: { severity: 'MEDIUM', httpStatus: 400, retryable: false },
    [ERROR_CODES.SCHEMA_VALIDATION_ERROR]: { severity: 'MEDIUM', httpStatus: 400, retryable: false },

    // Business logic errors = MEDIUM severity
    [ERROR_CODES.CALCULATION_ERROR]: { severity: 'MEDIUM', httpStatus: 400, retryable: true },
    [ERROR_CODES.BUSINESS_RULE_VIOLATION]: { severity: 'MEDIUM', httpStatus: 400, retryable: false },

    // Database errors = HIGH severity
    [ERROR_CODES.DATABASE_ERROR]: { severity: 'HIGH', httpStatus: 500, retryable: true },
    [ERROR_CODES.RECORD_NOT_FOUND]: { severity: 'MEDIUM', httpStatus: 404, retryable: false },

    // Service unavailable = HIGH severity (but retryable)
    [ERROR_CODES.SERVICE_UNAVAILABLE]: { severity: 'HIGH', httpStatus: 503, retryable: true },

    // Default to CRITICAL for unknown errors
    default: { severity: 'CRITICAL', httpStatus: 500, retryable: false },
  };

  return classification[errorType] || classification.default;
}

/**
 * Format error response (no sensitive information leaked)
 */
function formatErrorResponse(error, incidentId, classification) {
  return {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      incident_id: incidentId, // For support tracking
      timestamp: new Date().toISOString(),
      // Retry information (only if retryable)
      ...(classification.retryable && {
        retryable: true,
        retryAfter: 5,
      }),
    },
  };
}

/**
 * Log error to monitoring system
 * In production, send to Sentry, LogRocket, DataDog, etc.
 */
async function logErrorToMonitoring(error, req, incidentId, classification) {
  const errorLog = {
    incident_id: incidentId,
    severity: classification.severity,
    code: error.code,
    message: error.message,
    stack: error.stack,
    user_id: req.user?.userId,
    endpoint: req.url,
    method: req.method,
    ip_address: req.ip,
    timestamp: new Date().toISOString(),
  };

  console.error('ERROR LOG:', JSON.stringify(errorLog));

  // TODO: Integrate with monitoring service
  // await sentry.captureException(error, {
  //   tags: { incident_id: incidentId, severity: classification.severity },
  //   extra: { userId: req.user?.userId, endpoint: req.url }
  // });
}

/**
 * Track security incident (for audit logging)
 * Called for failed auth, permission denials, injection attempts, etc.
 */
async function trackSecurityIncident(req, incidentType, details) {
  const incident = {
    timestamp: new Date().toISOString(),
    type: incidentType,
    user_id: req.user?.userId,
    ip_address: req.ip,
    endpoint: req.url,
    details,
  };

  console.warn('SECURITY INCIDENT:', JSON.stringify(incident));

  // TODO: Send to SIEM/monitoring
  // await securityMonitoring.recordIncident(incident);
}

/**
 * Main exception handler
 */
export function handleException(error, req, res, options = {}) {
  const {
    severity = null,
    skipLogging = false,
    skipIncident = false,
  } = options;

  // Generate incident ID
  const incidentId = generateIncidentId();

  // Classify error
  const classification = classifyError(error);
  const finalSeverity = severity || classification.severity;

  // Log to monitoring
  if (!skipLogging) {
    logErrorToMonitoring(error, req, incidentId, classification);
  }

  // Track security incidents
  if (!skipIncident && finalSeverity === 'CRITICAL') {
    trackSecurityIncident(req, error.code, {
      message: error.message,
      endpoint: req.url,
    });
  }

  // Format response (no stack traces, no system info)
  const errorResponse = formatErrorResponse(error, incidentId, classification);

  // Return response
  return {
    statusCode: classification.httpStatus,
    body: JSON.stringify(errorResponse),
  };
}

/**
 * Middleware to wrap async route handlers with exception handling
 */
export function asyncHandler(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      const { statusCode, body } = handleException(error, req, res);
      return res.status(statusCode).json(JSON.parse(body));
    }
  };
}

/**
 * Specific exception handlers for common cases
 */

export function handleAuthenticationError(req, res, reason = 'Authentication failed') {
  const error = {
    code: 'UNAUTHENTICATED',
    message: reason,
  };
  const { statusCode, body } = handleException(error, req, res, { severity: 'HIGH' });
  return res.status(statusCode).json(JSON.parse(body));
}

export function handleAuthorizationError(req, res, reason = 'Permission denied') {
  const error = {
    code: 'PERMISSION_DENIED',
    message: reason,
  };
  const { statusCode, body } = handleException(error, req, res, { severity: 'HIGH' });
  return res.status(statusCode).json(JSON.parse(body));
}

export function handleValidationError(req, res, errors = []) {
  const error = {
    code: 'SCHEMA_VALIDATION_ERROR',
    message: `Input validation failed: ${errors.length} error(s)`,
    errors, // Include validation details (safe, no system info)
  };
  const { statusCode, body } = handleException(error, req, res, { severity: 'MEDIUM' });
  return res.status(statusCode).json(JSON.parse(body));
}

export function handleDatabaseError(req, res, originalError) {
  // Never expose actual DB errors (they leak schema, queries, etc.)
  const error = {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed. Please try again.',
  };
  const { statusCode, body } = handleException(error, req, res, {
    severity: 'HIGH',
    skipLogging: false, // Log internally but not to user
  });
  return res.status(statusCode).json(JSON.parse(body));
}

export function handleInjectionAttempt(req, res, field) {
  const error = {
    code: 'INJECTION_ATTEMPT',
    message: `Suspicious pattern detected in field: ${field}`,
  };
  const { statusCode, body } = handleException(error, req, res, {
    severity: 'CRITICAL',
    skipIncident: false, // Always create incident for security attempts
  });
  return res.status(statusCode).json(JSON.parse(body));
}

export default {
  ERROR_CODES,
  SEVERITY_LEVELS,
  generateIncidentId,
  classifyError,
  handleException,
  asyncHandler,
  handleAuthenticationError,
  handleAuthorizationError,
  handleValidationError,
  handleDatabaseError,
  handleInjectionAttempt,
};
