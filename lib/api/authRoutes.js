import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseAnonKey, getServerSupabaseUrl } from '../supabase/config.js';

function getSupabaseClient() {
  const supabaseUrl = getServerSupabaseUrl();
  const supabaseAnonKey = getServerSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase auth config missing on server');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function handleAuthCallback(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code required',
      redirect: '/auth/login',
    });
  }

  try {
    const supabaseClient = getSupabaseClient();
    const { data, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return res.status(400).json({
        success: false,
        error: `Code exchange failed: ${exchangeError.message}`,
        code: exchangeError.code,
        redirect: '/auth/login',
      });
    }

    if (!data?.user || !data?.session) {
      return res.status(500).json({
        success: false,
        error: 'No user or session returned from OAuth provider',
        redirect: '/auth/login',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
      redirect: '/',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `OAuth callback failed: ${error.message}`,
      redirect: '/auth/login',
    });
  }
}
