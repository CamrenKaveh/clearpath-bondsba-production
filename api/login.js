import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseAnonKey, getServerSupabaseUrl } from '../lib/supabase/config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const contentType = req.headers['content-type'] || '';
    let credential = '';
    let csrfToken = '';
    let csrfCookie = '';

    if (contentType.includes('application/json')) {
      const body = req.body || {};
      credential = body.credential || '';
      csrfToken = body.g_csrf_token || '';
      csrfCookie = req.cookies?.g_csrf_token || '';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const body =
        typeof req.body === 'string'
          ? new URLSearchParams(req.body)
          : new URLSearchParams(req.body || {});
      credential = body.get('credential') || '';
      csrfToken = body.get('g_csrf_token') || '';
      csrfCookie = req.cookies?.g_csrf_token || '';
    } else {
      credential = req.body?.credential || '';
      csrfToken = req.body?.g_csrf_token || '';
      csrfCookie = req.cookies?.g_csrf_token || '';
    }

    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential' });
    }

    if (csrfToken && csrfCookie && csrfToken !== csrfCookie) {
      return res.status(400).json({ error: 'Invalid CSRF token' });
    }

    const verifyResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!verifyResponse.ok) {
      return res.status(401).json({ error: 'Google token verification failed' });
    }

    const tokenInfo = await verifyResponse.json();
    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.VITE_GOOGLE_CLIENT_ID,
    ].filter(Boolean);

    if (allowedAudiences.length > 0 && !allowedAudiences.includes(tokenInfo.aud)) {
      return res.status(401).json({ error: 'Google token audience mismatch' });
    }

    if (tokenInfo.exp) {
      const expirationMs = Number(tokenInfo.exp) * 1000;
      if (Number.isFinite(expirationMs) && expirationMs <= Date.now()) {
        return res.status(401).json({ error: 'Google token is expired' });
      }
    }

    if (tokenInfo.email_verified === 'false' || tokenInfo.email_verified === false) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    const supabaseUrl = getServerSupabaseUrl();
    const supabaseAnonKey = getServerSupabaseAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Supabase auth config missing on server' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: signInData, error: signInError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
    });

    if (signInError || !signInData?.session) {
      return res.status(401).json({
        error: signInError?.message || 'Failed to create app session',
      });
    }

    return res.status(200).json({
      ok: true,
      provider: 'google',
      email: tokenInfo.email,
      name: tokenInfo.name,
      picture: tokenInfo.picture,
      sub: tokenInfo.sub,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
        expires_in: signInData.session.expires_in,
        token_type: signInData.session.token_type,
      },
      user: signInData.user || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Google login failed',
      detail: error?.message || 'Unknown error',
    });
  }
}
