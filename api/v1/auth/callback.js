/**
 * OAuth Callback Handler - Exchange Auth Code for Session
 *
 * POST /api/v1/auth/callback
 *
 * Handles the OAuth redirect from Google via Supabase.
 * Receives the authorization code and exchanges it for session tokens.
 *
 * Request body:
 * {
 *   code: string (from ?code=X in URL)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   user: { email, id, user_metadata },
 *   session: { access_token, refresh_token },
 *   redirect: '/dashboard'
 * }
 *
 * Error response:
 * {
 *   success: false,
 *   error: string,
 *   redirect: '/auth/login'
 * }
 */

import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseAnonKey, getServerSupabaseUrl } from '../../../lib/supabase/config.js';

function getSupabaseClient() {
  const supabaseUrl = getServerSupabaseUrl();
  const supabaseAnonKey = getServerSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase auth config missing on server');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const { code } = req.body || {};

  // Validate code exists
  if (!code) {
    console.error('❌ OAuth callback: No authorization code provided');
    return res.status(400).json({
      success: false,
      error: 'Authorization code required',
      redirect: '/auth/login',
    });
  }

  try {
    console.log('🔄 Exchanging authorization code for session...');
    const supabaseClient = getSupabaseClient();

    // Exchange the authorization code for a session
    // This is the critical step that was failing before
    const { data, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('❌ Code exchange failed:', exchangeError);
      return res.status(400).json({
        success: false,
        error: `Code exchange failed: ${exchangeError.message}`,
        code: exchangeError.code,
        redirect: '/auth/login',
      });
    }

    if (!data?.user || !data?.session) {
      console.error('❌ Code exchange returned empty user or session');
      return res.status(500).json({
        success: false,
        error: 'No user or session returned from OAuth provider',
        redirect: '/auth/login',
      });
    }

    console.log('✅ OAuth successful. User ID:', data.user.id); // email omitted from logs (PII)

    // Session is now created. Client will receive this and:
    // 1. Store in localStorage via Supabase client
    // 2. AuthProvider's onAuthStateChange will detect it
    // 3. User will be redirected to dashboard

    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
      redirect: '/dashboard',
    });
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    return res.status(500).json({
      success: false,
      error: `OAuth callback failed: ${error.message}`,
      redirect: '/auth/login',
    });
  }
}
