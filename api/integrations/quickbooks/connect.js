import { randomUUID } from 'crypto';
import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import { getSupabaseAdminClient } from '../../../lib/billing/supabaseAdmin.js';

const QUICKBOOKS_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const PRIMARY_SCOPE = 'com.intuit.quickbooks.accounting openid profile email';
const FALLBACK_SCOPE = 'com.intuit.quickbooks.accounting';

function parseMode(req) {
  return `${req.query?.mode || req.body?.mode || ''}`.trim().toLowerCase();
}

function shouldUseFallbackScope(req) {
  const raw = `${req.query?.fallback || req.query?.scope_mode || req.query?.scopeMode || ''}`.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'accounting' || raw === 'accounting_only' || raw === 'accounting-only';
}

function buildAuthorizationUrl({ clientId, redirectUri, scope, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  });
  return `${QUICKBOOKS_AUTHORIZE_URL}?${params.toString()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const configured = Boolean(
    process.env.QUICKBOOKS_CLIENT_ID &&
      process.env.QUICKBOOKS_CLIENT_SECRET &&
      process.env.QUICKBOOKS_REDIRECT_URI
  );

  if (!configured) {
    return res.status(200).json({
      connected: false,
      provider: 'quickbooks',
      status: 'not_configured',
      message: 'QuickBooks integration is not configured yet. Manual entry is available now.',
    });
  }

  const mode = parseMode(req);
  const useFallbackScope = shouldUseFallbackScope(req);
  const scope = useFallbackScope ? FALLBACK_SCOPE : PRIMARY_SCOPE;

  if (mode === 'start') {
    const authError = await verifyAndAttachUser(req);
    if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

    const state = randomUUID();
    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from('oauth_states').insert({
        state,
        user_id: req.user.userId,
        provider: 'quickbooks',
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to persist oauth state', detail: err.message });
    }

    const authorizationUrl = buildAuthorizationUrl({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
      scope,
      state,
    });

    return res.status(200).json({
      connected: false,
      provider: 'quickbooks',
      status: 'oauth_redirect',
      authorizationUrl,
      scopeRequested: scope,
      state,
    });
  }

  return res.status(200).json({
    connected: false,
    provider: 'quickbooks',
    status: 'ready_for_oauth',
    primaryScope: PRIMARY_SCOPE,
    fallbackScope: FALLBACK_SCOPE,
    message: 'QuickBooks credentials are configured. Sign in then click Connect to begin OAuth.',
  });
}
