import { getSupabaseAdminClient } from '../../../lib/billing/supabaseAdmin.js';

function getTokenUrl() {
  const env = `${process.env.PROCORE_ENVIRONMENT || 'production'}`.toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.procore.com/oauth/token'
    : 'https://login.procore.com/oauth/token';
}

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
  await supabase.from('oauth_states').delete().eq('state', stateToken);
  return data.user_id;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const configured = Boolean(
    process.env.PROCORE_CLIENT_ID &&
      process.env.PROCORE_CLIENT_SECRET &&
      process.env.PROCORE_REDIRECT_URI
  );
  if (!configured) {
    return redirectToApp(res, { integration: 'procore', status: 'not_configured' });
  }

  const oauthError = `${req.query?.error || ''}`.trim();
  const oauthErrorDescription = `${req.query?.error_description || ''}`.trim();
  if (oauthError) {
    return redirectToApp(res, {
      integration: 'procore',
      status: 'oauth_error',
      error: oauthError,
      detail: oauthErrorDescription,
    });
  }

  const code = `${req.query?.code || ''}`.trim();
  const stateToken = `${req.query?.state || ''}`.trim();

  if (!code) {
    return redirectToApp(res, {
      integration: 'procore',
      status: 'missing_code',
      detail: 'OAuth callback did not include an authorization code.',
    });
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (err) {
    return redirectToApp(res, {
      integration: 'procore',
      status: 'config_error',
      detail: err?.message || 'Supabase admin client unavailable.',
    });
  }

  const userId = await consumeOAuthState(supabase, stateToken, 'procore');
  if (!userId) {
    return redirectToApp(res, {
      integration: 'procore',
      status: 'invalid_state',
      detail: 'OAuth state token missing or expired. Restart Connect.',
    });
  }

  try {
    const tokenRes = await fetch(getTokenUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.PROCORE_CLIENT_ID,
        client_secret: process.env.PROCORE_CLIENT_SECRET,
        redirect_uri: process.env.PROCORE_REDIRECT_URI,
      }),
    });

    const tokenPayload = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      return redirectToApp(res, {
        integration: 'procore',
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
        provider: 'procore',
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
        integration: 'procore',
        status: 'persist_failed',
        detail: upsertError.message,
      });
    }

    return redirectToApp(res, {
      integration: 'procore',
      status: 'connected',
    });
  } catch (err) {
    return redirectToApp(res, {
      integration: 'procore',
      status: 'callback_error',
      detail: err?.message || 'Unknown error during token exchange.',
    });
  }
}
