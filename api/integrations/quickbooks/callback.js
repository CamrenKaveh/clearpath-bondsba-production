import { getSupabaseAdminClient } from '../../../lib/billing/supabaseAdmin.js';

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FALLBACK_SCOPE_CONNECT_PATH = '/api/integrations/quickbooks/connect?mode=start&scope_mode=accounting_only';

function redirectToApp(res, params) {
  const qs = new URLSearchParams(params).toString();
  res.writeHead(302, { Location: `/workspace?${qs}` });
  res.end();
}

async function consumeOAuthState(supabase, stateToken, provider) {
  if (!stateToken) return null;
  const { data, error } = await supabase
    .from('oauth_states')
    .select('user_id, provider, expires_at')
    .eq('state', stateToken)
    .eq('provider', provider)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  // One-shot use
  await supabase.from('oauth_states').delete().eq('state', stateToken);
  return data.user_id;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const configured = Boolean(
    process.env.QUICKBOOKS_CLIENT_ID &&
      process.env.QUICKBOOKS_CLIENT_SECRET &&
      process.env.QUICKBOOKS_REDIRECT_URI
  );
  if (!configured) {
    return redirectToApp(res, { integration: 'quickbooks', status: 'not_configured' });
  }

  const oauthError = `${req.query?.error || ''}`.trim();
  const oauthErrorDescription = `${req.query?.error_description || ''}`.trim();
  const scopeRejected =
    oauthError.toLowerCase().includes('scope') ||
    oauthErrorDescription.toLowerCase().includes('scope');

  if (oauthError) {
    return redirectToApp(res, {
      integration: 'quickbooks',
      status: scopeRejected ? 'scope_rejected' : 'oauth_error',
      error: oauthError,
      detail: oauthErrorDescription,
      retry: scopeRejected ? FALLBACK_SCOPE_CONNECT_PATH : '',
    });
  }

  const code = `${req.query?.code || ''}`.trim();
  const realmId = `${req.query?.realmId || ''}`.trim();
  const stateToken = `${req.query?.state || ''}`.trim();

  if (!code) {
    return redirectToApp(res, {
      integration: 'quickbooks',
      status: 'missing_code',
      detail: 'OAuth callback did not include an authorization code.',
    });
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (err) {
    return redirectToApp(res, {
      integration: 'quickbooks',
      status: 'config_error',
      detail: err?.message || 'Supabase admin client unavailable.',
    });
  }

  const userId = await consumeOAuthState(supabase, stateToken, 'quickbooks');
  if (!userId) {
    return redirectToApp(res, {
      integration: 'quickbooks',
      status: 'invalid_state',
      detail: 'OAuth state token missing or expired. Restart Connect.',
    });
  }

  try {
    const basicAuth = Buffer.from(
      `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI,
      }),
    });

    const tokenPayload = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      return redirectToApp(res, {
        integration: 'quickbooks',
        status: 'token_exchange_failed',
        detail: tokenPayload?.error_description || tokenPayload?.error || `HTTP ${tokenRes.status}`,
      });
    }

    const expiresAt = tokenPayload?.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
      : null;

    const { error: upsertError } = await supabase
      .from('integration_connections')
      .upsert({
        user_id: userId,
        provider: 'quickbooks',
        realm_id: realmId || null,
        access_token: tokenPayload.access_token,
        refresh_token: tokenPayload.refresh_token || null,
        token_type: tokenPayload.token_type || 'Bearer',
        scope: tokenPayload.scope || null,
        expires_at: expiresAt,
        raw_response: tokenPayload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (upsertError) {
      return redirectToApp(res, {
        integration: 'quickbooks',
        status: 'persist_failed',
        detail: upsertError.message,
      });
    }

    return redirectToApp(res, {
      integration: 'quickbooks',
      status: 'connected',
      realm: realmId,
    });
  } catch (err) {
    return redirectToApp(res, {
      integration: 'quickbooks',
      status: 'callback_error',
      detail: err?.message || 'Unknown error during token exchange.',
    });
  }
}
