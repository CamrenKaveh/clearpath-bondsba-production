import { randomUUID } from 'crypto';
import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import { getSupabaseAdminClient } from '../../../lib/billing/supabaseAdmin.js';
import { getValidAccessToken } from '../../../lib/integrations/tokenRefresh.js';

function getAuthorizeBase() {
  const env = `${process.env.PROCORE_ENVIRONMENT || 'production'}`.toLowerCase();
  return env === 'sandbox' ? 'https://sandbox.procore.com/oauth/authorize' : 'https://login.procore.com/oauth/authorize';
}

function getApiBase() {
  const env = `${process.env.PROCORE_ENVIRONMENT || 'production'}`.toLowerCase();
  return env === 'sandbox' ? 'https://sandbox.procore.com/rest' : 'https://api.procore.com/rest';
}

function parseMode(req) {
  return `${req.query?.mode || req.body?.mode || ''}`.trim().toLowerCase();
}

async function procore(path, token) {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Procore ${path} HTTP ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const configured = Boolean(
    process.env.PROCORE_CLIENT_ID && process.env.PROCORE_CLIENT_SECRET && process.env.PROCORE_REDIRECT_URI
  );

  if (!configured) {
    return res.status(200).json({
      connected: false, provider: 'procore', status: 'not_configured',
      message: 'Procore integration is not configured yet. Manual entry is available now.',
    });
  }

  const mode = parseMode(req);

  // ─── mode=start : begin OAuth ───
  if (mode === 'start') {
    const authError = await verifyAndAttachUser(req);
    if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

    const state = randomUUID();
    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from('oauth_states').insert({
        state, user_id: req.user.userId, provider: 'procore',
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to persist oauth state', detail: err.message });
    }

    const params = new URLSearchParams({
      client_id: process.env.PROCORE_CLIENT_ID,
      redirect_uri: process.env.PROCORE_REDIRECT_URI,
      response_type: 'code',
      state,
    });
    return res.status(200).json({
      connected: false, provider: 'procore', status: 'oauth_redirect',
      authorizationUrl: `${getAuthorizeBase()}?${params.toString()}`,
      state,
    });
  }

  // ─── mode=summary : pull company / project / financial snapshot ───
  if (mode === 'summary') {
    const authError = await verifyAndAttachUser(req);
    if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

    let conn;
    try {
      conn = await getValidAccessToken({ userId: req.user.userId, provider: 'procore' });
    } catch (err) {
      return res.status(500).json({ status: 'token_error', detail: err.message });
    }
    if (!conn?.access_token) {
      return res.status(200).json({
        provider: 'procore', status: 'not_connected',
        message: 'Connect Procore first to import project context.',
      });
    }

    try {
      // 1. Get the user's company
      const companies = await procore('/v1.0/companies', conn.access_token).catch(() => []);
      const company = Array.isArray(companies) ? companies[0] : (companies?.data?.[0] || null);
      if (!company) {
        return res.status(200).json({ provider: 'procore', status: 'no_company', message: 'No Procore company found on this account.' });
      }
      // 2. List active projects
      const projects = await procore(`/v1.0/projects?company_id=${company.id}`, conn.access_token).catch(() => []);
      const projectArr = Array.isArray(projects) ? projects : (projects?.data || []);

      // 3. Aggregate basic counts + sum of original contract amounts (where exposed)
      const active = projectArr.filter((p) => p.active !== false);
      const totalContractValue = active.reduce((sum, p) => {
        const v = Number(p.total_value || p.amount_paid_to_date || 0);
        return sum + (isFinite(v) ? v : 0);
      }, 0);

      return res.status(200).json({
        provider: 'procore', status: 'connected',
        data: {
          companyName: company.name || null,
          activeProjects: active.length,
          totalContractValue: totalContractValue || null,
          projectSample: active.slice(0, 5).map((p) => ({ id: p.id, name: p.name, value: p.total_value || null })),
        },
      });
    } catch (err) {
      return res.status(500).json({ provider: 'procore', status: 'fetch_failed', detail: err.message });
    }
  }

  // default: ready_for_oauth status
  return res.status(200).json({
    connected: false, provider: 'procore', status: 'ready_for_oauth',
    message: 'Procore credentials are configured. Sign in then click Connect to begin OAuth.',
  });
}
