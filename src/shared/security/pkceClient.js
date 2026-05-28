/**
 * PKCE (Proof Key for Code Exchange) OAuth 2.0 Client
 *
 * Implements RFC 7636 for secure authorization code flow without client secrets.
 * Protects against authorization code interception attacks.
 *
 * Usage:
 * const pkce = new PKCEClient(clientId, redirectUri);
 * const authUrl = pkce.getAuthorizationURL();
 * // After redirect: const tokens = await pkce.exchangeCode(code);
 */

export class PKCEClient {
  constructor(clientId, redirectUri, options = {}) {
    this.clientId = clientId;
    this.redirectUri = this._validateRedirectUri(redirectUri);
    this.discoveryEndpoint = options.discoveryEndpoint || 'https://accounts.google.com/.well-known/openid-configuration';

    // PKCE state stored in session storage (cleared after exchange)
    this.storageKey = 'pkce_state';
  }

  /**
   * Generate PKCE code verifier (43-128 characters, unreserved characters)
   * RFC 7636 Section 4.1
   */
  _generateCodeVerifier() {
    const array = new Uint8Array(96); // 96 bytes = 128 base64url chars
    crypto.getRandomValues(array);

    // Convert to base64url (no padding)
    const binaryString = String.fromCharCode(...array);
    const base64 = btoa(binaryString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Use first 128 chars (guarantees ≥43)
    return base64.substring(0, 128);
  }

  /**
   * Generate code challenge from verifier using S256 method
   * RFC 7636 Section 4.2
   */
  async _generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return hashBase64;
  }

  /**
   * Validate redirect URI against registered URIs
   * Prevent open redirect attacks
   */
  _validateRedirectUri(uri) {
    // Registered redirect URIs (from Google Console)
    const allowedUris = [
      'http://localhost:3000/auth/callback',
      'http://localhost:5173/auth/callback',
      'https://bondsba.com/auth/callback',
      'https://www.bondsba.com/auth/callback',
      // Add more as needed
    ];

    // Exact match only (no prefix, no variations)
    if (!allowedUris.includes(uri)) {
      throw new Error(`Redirect URI not registered: ${uri}. Must be exact match.`);
    }

    return uri;
  }

  /**
   * Generate authorization URL with PKCE parameters
   * Returns { authUrl, state, codeVerifier } for storage
   */
  async getAuthorizationURL(scopes = ['openid', 'email', 'profile']) {
    const codeVerifier = this._generateCodeVerifier();
    const codeChallenge = await this._generateCodeChallenge(codeVerifier);
    const state = this._generateRandomState();

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
      prompt: 'login', // Force user to authenticate (prevent cached sessions)
      nonce: this._generateRandomState(), // Prevent token replay
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Store PKCE state in session storage (NOT localStorage for security)
    sessionStorage.setItem(this.storageKey, JSON.stringify({
      codeVerifier,
      state,
      nonce: params.get('nonce'),
      timestamp: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    }));

    return {
      authUrl,
      state, // Useful for debugging
      codeVerifier, // DEBUG ONLY - never expose in production
    };
  }

  /**
   * Exchange authorization code for tokens using PKCE
   */
  async exchangeCode(code, returnedState) {
    // Retrieve stored PKCE state
    const storedStateStr = sessionStorage.getItem(this.storageKey);
    if (!storedStateStr) {
      throw new Error('PKCE state not found. Session may have expired.');
    }

    const storedState = JSON.parse(storedStateStr);

    // Verify state (CSRF protection)
    if (storedState.state !== returnedState) {
      throw new Error('State mismatch. Possible CSRF attack.');
    }

    // Verify not expired (10 minutes)
    if (Date.now() > storedState.expiresAt) {
      sessionStorage.removeItem(this.storageKey);
      throw new Error('PKCE state expired. Please try again.');
    }

    // Exchange code for tokens using backend endpoint
    // Backend will validate code_verifier
    try {
      const response = await fetch('/api/v1/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: storedState.codeVerifier,
          nonce: storedState.nonce,
        }),
        credentials: 'include', // Send cookies for session management
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Token exchange failed');
      }

      const tokens = await response.json();

      // Clear PKCE state (one-time use)
      sessionStorage.removeItem(this.storageKey);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
      };
    } catch (error) {
      console.error('Token exchange failed:', error);
      throw error;
    }
  }

  /**
   * Generate random state for CSRF protection
   */
  _generateRandomState() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if user is authenticated (has valid session)
   */
  static isAuthenticated() {
    const token = localStorage.getItem('auth_token');
    const expiresAt = localStorage.getItem('auth_token_expires_at');

    if (!token || !expiresAt) return false;
    if (Date.now() > parseInt(expiresAt, 10)) {
      // Token expired
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_token_expires_at');
      return false;
    }

    return true;
  }

  /**
   * Get stored access token
   */
  static getAccessToken() {
    if (!this.isAuthenticated()) return null;
    return localStorage.getItem('auth_token');
  }

  /**
   * Sign out and clear credentials
   */
  static signOut() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_expires_at');
    localStorage.removeItem('auth_refresh_token');
    sessionStorage.removeItem('pkce_state');
  }
}

export default PKCEClient;
