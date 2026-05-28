/**
 * Role-Based Access Control (RBAC) + MFA Middleware
 *
 * Enforces principle of least privilege across all API endpoints.
 * Supports role hierarchy and permission matrices.
 * MFA enforcement for sensitive operations.
 *
 * Usage:
 * const rbacError = requirePermission(req, 'CREATE_APPLICATION', 'surety');
 * if (rbacError) return res.status(403).json(rbacError);
 */

/**
 * Role Hierarchy (higher value = more privileged)
 */
const ROLE_HIERARCHY = {
  admin: 3,
  underwriter: 2,
  analyst: 1,
  viewer: 0,
};

/**
 * Permission Matrix: resource_type:action → required roles
 */
const PERMISSION_MATRIX = {
  'application:create': ['underwriter', 'admin'],
  'application:read': ['analyst', 'underwriter', 'admin'],
  'application:update': ['underwriter', 'admin'],
  'application:delete': ['admin'],
  'application:export': ['admin'],

  'document:upload': ['underwriter', 'admin'],
  'document:read': ['analyst', 'underwriter', 'admin'],
  'document:delete': ['admin'],

  'calculation:execute': ['underwriter', 'admin'],
  'calculation:export': ['underwriter', 'admin'],

  'analysis:execute': ['underwriter', 'admin'],
  'analysis:read': ['analyst', 'underwriter', 'admin'],
  'analysis:export': ['underwriter', 'admin'],

  'audit:read': ['admin'],
  'audit:export': ['admin'],

  'user:manage': ['admin'],
  'role:assign': ['admin'],
};

/**
 * Domain-specific permissions (surety, sba)
 * Maps action → required domain access
 */
const DOMAIN_PERMISSIONS = {
  'calculate_premium': ['surety'],
  'generate_term_sheet': ['sba', 'surety'],
  'analyze_application': ['sba', 'surety'],
  'upload_financial_doc': ['sba', 'surety'],
};

/**
 * Operations requiring MFA
 */
const MFA_REQUIRED_OPERATIONS = new Set([
  'application:delete',
  'user:manage',
  'role:assign',
  'audit:export',
  'calculate_premium_with_manual_override', // Custom business rule
]);

/**
 * Check if user has required role
 */
function hasRole(user, requiredRoles) {
  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }

  const userRoleLevel = ROLE_HIERARCHY[user.userRole] || -1;

  // User must have one of the required roles
  return requiredRoles.some(role => {
    const requiredLevel = ROLE_HIERARCHY[role] || -1;
    return userRoleLevel >= requiredLevel;
  });
}

/**
 * Check if user has access to domain
 */
function hasDomainAccess(user, domains) {
  if (!Array.isArray(domains)) {
    domains = [domains];
  }

  // Extract user's allowed domains from metadata
  const userDomains = user.metadata?.domains || [];

  // User must have access to at least one required domain
  return domains.some(domain => userDomains.includes(domain));
}

/**
 * Check if user has completed MFA
 */
function hasMFAVerified(user) {
  // Check if MFA was verified in current session
  // In practice, check against token claims or session store
  return user.metadata?.mfa_verified_at &&
         Date.now() - user.metadata.mfa_verified_at < 30 * 60 * 1000; // 30 min window
}

/**
 * Enforce permission requirement
 * Returns error object if permission denied, null if allowed
 */
export function requirePermission(req, resource, action, requiredDomain = null) {
  if (!req.user) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
        },
      }),
    };
  }

  const { user } = req;
  const permissionKey = `${resource}:${action}`;

  // Get required roles for this permission
  const requiredRoles = PERMISSION_MATRIX[permissionKey];
  if (!requiredRoles) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_PERMISSION',
          message: `Permission ${permissionKey} not defined`,
        },
      }),
    };
  }

  // Check role
  if (!hasRole(user, requiredRoles)) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `This action requires role: ${requiredRoles.join(' or ')}. You have: ${user.userRole}`,
          requiredRoles,
          userRole: user.userRole,
        },
      }),
    };
  }

  // Check domain access if specified
  if (requiredDomain && !hasDomainAccess(user, requiredDomain)) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INSUFFICIENT_DOMAIN_ACCESS',
          message: `Your account does not have access to ${requiredDomain} domain`,
          requiredDomain,
          accessibleDomains: user.metadata?.domains || [],
        },
      }),
    };
  }

  // Check MFA if required for this operation
  if (MFA_REQUIRED_OPERATIONS.has(permissionKey)) {
    if (!hasMFAVerified(user)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MFA_REQUIRED',
            message: `Multi-factor authentication required for ${action}`,
            mfa_challenge_url: '/api/auth/mfa/challenge',
          },
        }),
      };
    }
  }

  return null; // Permission granted
}

/**
 * Enforce domain isolation (can't access other domain's data)
 */
export function enforceDomainIsolation(req, resourceDomain) {
  if (!req.user) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      }),
    };
  }

  const userDomains = req.user.metadata?.domains || [];

  // Admins can access any domain
  if (req.user.userRole === 'admin') {
    return null;
  }

  // Non-admins must have explicit domain access
  if (!userDomains.includes(resourceDomain)) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'DOMAIN_ISOLATION_VIOLATION',
          message: `Cannot access ${resourceDomain} domain`,
          attemptedDomain: resourceDomain,
          accessibleDomains: userDomains,
        },
      }),
    };
  }

  return null;
}

/**
 * Check if user can read specific resource (row-level security)
 * Implements: user is owner OR has admin/underwriter role in same domain
 */
export function canReadResource(req, resource, resourceOwnerId, resourceDomain) {
  const { user } = req;

  // Admins can read anything
  if (user.userRole === 'admin') return true;

  // Owner can read own resources
  if (resource.user_id === user.userId) return true;

  // Domain access + analyst/underwriter role
  if (hasDomainAccess(user, resourceDomain) &&
      (user.userRole === 'analyst' || user.userRole === 'underwriter')) {
    return true;
  }

  return false;
}

/**
 * Check if user can modify resource (row-level security)
 * Implements: user is owner OR has admin role in same domain
 */
export function canModifyResource(req, resource, resourceDomain) {
  const { user } = req;

  // Admins can modify anything
  if (user.userRole === 'admin') return true;

  // Owner can modify own resources
  if (resource.user_id === user.userId && user.userRole === 'underwriter') {
    return true;
  }

  return false;
}

/**
 * Rate limiting: prevent abuse (brute force, DoS)
 * In production, use Redis for distributed rate limiting
 */
const rateLimits = new Map(); // In-memory store (replace with Redis)

export function enforceRateLimit(req, limit = 100, windowMs = 60000) {
  const key = `${req.user?.userId || req.ip}:${req.url}`;
  const now = Date.now();

  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 0, resetAt: now + windowMs });
  }

  const record = rateLimits.get(key);

  // Reset window if expired
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count++;

  if (record.count > limit) {
    return {
      statusCode: 429,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        },
      }),
    };
  }

  return null;
}

/**
 * Middleware composition: combine multiple checks
 */
export function requireFullAuth(req, config = {}) {
  const {
    resource,
    action,
    domain = null,
    mfaRequired = false,
    rateLimit = { limit: 100, windowMs: 60000 },
  } = config;

  // Rate limiting check
  if (rateLimit) {
    const rateLimitError = enforceRateLimit(req, rateLimit.limit, rateLimit.windowMs);
    if (rateLimitError) return rateLimitError;
  }

  // Permission check
  if (resource && action) {
    const permError = requirePermission(req, resource, action, domain);
    if (permError) return permError;
  }

  // Domain isolation check
  if (domain) {
    const domainError = enforceDomainIsolation(req, domain);
    if (domainError) return domainError;
  }

  return null;
}

export default {
  requirePermission,
  enforceDomainIsolation,
  canReadResource,
  canModifyResource,
  enforceRateLimit,
  requireFullAuth,
};
