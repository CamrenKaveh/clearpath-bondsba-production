/**
 * OAuth token refresh helper.
 * Looks up a stored integration_connections row for (user_id, provider),
 * refreshes the access_token if expired, and returns a usable token.
 *
 * Usage:
 *   const token = await getValidAccessToken({ userId, provider: 'quickbooks' });
 *   if (!token) throw new Error('No connection');
 *   fetch(qbApi, { headers: { Authorization: `Bearer ${token.access_token}` } });
 */

import { getSupabaseAdminClient } from '../billing/supabaseAdmin.js';

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

function getProcoreTokenUrl() {
  const env = `${process.env.PROCORE_ENVIRONMENT || 'production'}`.toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.procore.com/oauth/token'
    : 'https://login.procore.com/oauth/token';
}

const SKEW_MS = 60 * 1000; // refresh 60s before actual expiry

function isExpired(row) {
  if (!row?.expires_at) return false;
  return new Date(row.expires_at).getTime() - SKEW_MS < Date.now();
}

async function refreshQuickBooks(refreshToken) {
  const basicAuth = Buffer.from(
    `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error_description || payload?.error || `QB refresh HTTP ${res.status}`);
  }
  return payload;
}

async function refreshProcore(refreshToken) {
  const res = await fetch(getProcoreTokenUrl(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.PROCORE_CLIENT_ID,
      client_secret: process.env.PROCORE_CLIENT_SECRET,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error_description || payload?.error || `Procore refresh HTTP ${res.status}`);
  }
  return payload;
}

const REFRESHERS = {
  quickbooks: refreshQuickBooks,
  procore: refreshProcore,
};

/**
 * Get a valid access token for (user, provider). Refreshes if expired.
 * Returns null if no connection exists or refresh fails.
 */
export async function getValidAccessToken({ userId, provider }) {
  if (!userId || !provider) return null;
  const supabase = getSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (error || !row) return null;

  if (!isExpired(row)) {
    return row;
  }

  const refresher = REFRESHERS[provider];
  if (!refresher || !row.refresh_token) return row; // can't refresh — return what we have

  try {
    const refreshed = await refresher(row.refresh_token);
    const expiresAt = refreshed?.expires_in
      ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
      : null;
    const updates = {
      access_token: refreshed.access_token || row.access_token,
      refresh_token: refreshed.refresh_token || row.refresh_token,
      scope: refreshed.scope || row.scope,
      token_type: refreshed.token_type || row.token_type,
      expires_at: expiresAt,
      raw_response: refreshed,
      updated_at: new Date().toISOString(),
    };
    const { data: updated } = await supabase
      .from('integration_connections')
      .update(updates)
      .eq('id', row.id)
      .select()
      .maybeSingle();
    return updated || { ...row, ...updates };
  } catch (err) {
    console.warn('Token refresh failed:', err.message);
    return row; // fall back to old token; caller will see 401 and re-auth
  }
}

/**
 * Convenience: list connected providers for a user.
 */
export async function listUserConnections(userId) {
  if (!userId) return [];
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('integration_connections')
    .select('provider, realm_id, expires_at, updated_at')
    .eq('user_id', userId);
  return data || [];
}
