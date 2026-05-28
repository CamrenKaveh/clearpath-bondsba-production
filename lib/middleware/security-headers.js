/**
 * Security Headers Middleware
 *
 * Enforces OWASP security headers:
 * - Content-Security-Policy (prevent XSS, clickjacking)
 * - Strict-Transport-Security (enforce HTTPS)
 * - X-Content-Type-Options (prevent MIME type sniffing)
 * - X-Frame-Options (prevent clickjacking)
 * - Referrer-Policy (control referrer leakage)
 * - Permissions-Policy (disable dangerous APIs)
 *
 * Usage:
 * applySecurityHeaders(res);
 */

export function applySecurityHeaders(res) {
  // Enforce HTTPS for 1 year (31536000 seconds)
  // includeSubDomains ensures all subdomains use HTTPS
  // preload allows inclusion in HSTS preload list
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Prevent MIME type sniffing
  // Browsers must respect Content-Type header
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking attacks
  // DENY: no embedding anywhere
  // SAMEORIGIN: allow embedding on same domain only
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Content Security Policy (CSP)
  // Prevents XSS, injection, and unauthorized resource loading
  // Default source: self only
  // Script: self + inline-scripts (not recommended, but needed for React)
  // Style: self + unsafe-inline (Tailwind requires this)
  // Font: self + Google Fonts
  // Image: self + data URLs + https
  // Frame: self only
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net", // unsafe-eval needed for React
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https: https://accounts.google.com",
    "frame-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "manifest-src 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspPolicy);

  // Control how much referrer info is leaked
  // strict-no-referrer: never send referrer
  // strict-no-referrer-when-downgrade: no referrer on http (from https)
  res.setHeader('Referrer-Policy', 'strict-no-referrer');

  // Permissions Policy (Feature-Policy successor)
  // Disable dangerous APIs that could be exploited
  res.setHeader(
    'Permissions-Policy',
    [
      'geolocation=()',           // Disable location tracking
      'microphone=()',            // Disable mic access
      'camera=()',                // Disable camera access
      'payment=()',               // Disable payment API
      'usb=()',                   // Disable USB API
      'magnetometer=()',          // Disable compass
      'gyroscope=()',             // Disable motion sensors
      'accelerometer=()',         // Disable accelerometer
      'vr=()',                    // Disable VR APIs
    ].join(', ')
  );

  // Additional headers
  res.setHeader('X-UA-Compatible', 'IE=edge'); // For older IE versions
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none'); // Disable Flash/PDF policies
}

/**
 * CORS middleware - restrict to known domains
 */
export function applyCORSHeaders(res, allowedOrigins = []) {
  // Default allowed origins
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://bondsba.com',
    'https://www.bondsba.com',
    'https://clearpathsba.com',
    'https://www.clearpathsba.com',
    'https://clearpathsbaloan.com',
    'https://www.clearpathsbaloan.com',
  ];

  const origins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

  return (req, res) => {
    const origin = req.headers.origin;

    // Only allow whitelisted origins
    if (origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    return res;
  };
}

/**
 * Middleware to prevent open redirects
 * Validates redirect URLs
 */
export function validateRedirectURL(url, allowedDomains = []) {
  const defaultDomains = [
    'localhost',
    'bondsba.com',
    'clearpathsba.com',
    'clearpathsbaloan.com',
  ];

  const domains = allowedDomains.length > 0 ? allowedDomains : defaultDomains;

  try {
    const parsed = new URL(url, 'http://localhost'); // relative URLs

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Check if domain is whitelisted
    return domains.some(domain => parsed.hostname.endsWith(domain));
  } catch (e) {
    // Invalid URL
    return false;
  }
}

/**
 * Rate limiting headers
 */
export function applyRateLimitHeaders(res, limit, remaining, resetTime) {
  res.setHeader('RateLimit-Limit', limit.toString());
  res.setHeader('RateLimit-Remaining', remaining.toString());
  res.setHeader('RateLimit-Reset', resetTime.toString());
}

/**
 * Cache control headers
 * Prevent sensitive data from being cached by browsers/proxies
 */
export function applyCacheControlHeaders(res, isPublic = false) {
  if (isPublic) {
    // Public resources: cache for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');
  } else {
    // Sensitive resources: never cache
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}

/**
 * Comprehensive middleware to apply all security headers
 */
export function applyAllSecurityHeaders(req, res, options = {}) {
  applySecurityHeaders(res);

  if (options.cors !== false) {
    const corsMiddleware = applyCORSHeaders(res, options.allowedOrigins);
    corsMiddleware(req, res);
  }

  if (options.cacheControl !== false) {
    const isPublic = options.isPublic === true;
    applyCacheControlHeaders(res, isPublic);
  }

  // Handle OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Request handled
  }

  return false; // Continue to handler
}

export default {
  applySecurityHeaders,
  applyCORSHeaders,
  validateRedirectURL,
  applyRateLimitHeaders,
  applyCacheControlHeaders,
  applyAllSecurityHeaders,
};
