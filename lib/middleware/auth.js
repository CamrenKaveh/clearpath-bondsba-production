/**
 * Authentication Middleware
 *
 * Verifies JWT tokens from Supabase.
 * Checks for valid Authorization: Bearer <token> header.
 * Extracts user information from token payload.
 *
 * Usage:
 * import { requireAuth } from '../../middleware/auth.js';
 *
 * export default function handler(req, res) {
 *   const authError = requireAuth(req);
 *   if (authError) {
 *     return res.status(authError.statusCode).json(authError.body);
 *   }
 *   // User is authenticated, use req.user
 *   const { userId, email, userRole } = req.user;
 * }
 */

import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseAnonKey, getServerSupabaseUrl } from '../supabase/config.js';

/**
 * Verify JWT token and extract user information
 * @param {string} token - JWT token from Authorization header
 * @returns {object|null} - Decoded user object or null if invalid
 */
async function verifyToken(token) {
  try {
    const supabaseUrl = getServerSupabaseUrl();
    const supabaseKey = getServerSupabaseAnonKey();

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase credentials not configured or malformed');
      return null;
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token by attempting to get the current user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn('Token verification failed:', error?.message);
      return null;
    }

    return buildAuthenticatedUser(user);
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

export function buildAuthenticatedUser(user) {
  const appMetadata = user.app_metadata || {};
  const userMetadata = user.user_metadata || {};
  const domains = Array.isArray(appMetadata.domains) && appMetadata.domains.length > 0
    ? appMetadata.domains
    : ['sba', 'surety'];

  return {
    userId: user.id,
    email: user.email,
    userRole: appMetadata.role || 'underwriter',
    metadata: {
      ...userMetadata,
      domains,
    },
  };
}

/**
 * Middleware to require authentication
 * Returns error object if auth fails, null if successful
 */
export function requireAuth(req) {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Unauthorized',
          details: 'Missing or invalid Authorization header. Use: Authorization: Bearer <token>',
        },
      }),
    };
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // Store token in request for verification in async context
  req.authToken = token;

  return null; // Auth check passes at this stage
}

/**
 * Async version: Verify token and attach user to request
 * Must be called within an async function
 */
export async function verifyAndAttachUser(req) {
  const authError = requireAuth(req);
  if (authError) {
    return authError;
  }

  const user = await verifyToken(req.authToken);
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Unauthorized',
          details: 'Invalid or expired token',
        },
      }),
    };
  }

  // Attach user to request for use in handler
  req.user = user;
  return null;
}

/**
 * Check if user has required role
 * @param {object} user - User object from req.user
 * @param {string} requiredRole - Role to check for (admin, underwriter, viewer)
 * @returns {boolean} - True if user has required role or higher
 */
export function hasRequiredRole(user, requiredRole) {
  const roleHierarchy = {
    admin: 3,
    underwriter: 2,
    viewer: 1,
  };

  const userRoleLevel = roleHierarchy[user.userRole] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Middleware to require specific role
 * Must be called after verifyAndAttachUser
 */
export function requireRole(requiredRole) {
  return (req) => {
    if (!req.user) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Unauthorized',
            details: 'User not authenticated',
          },
        }),
      };
    }

    if (!hasRequiredRole(req.user, requiredRole)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Forbidden',
            details: `This action requires ${requiredRole} role or higher. You have: ${req.user.userRole}`,
          },
        }),
      };
    }

    return null;
  };
}
