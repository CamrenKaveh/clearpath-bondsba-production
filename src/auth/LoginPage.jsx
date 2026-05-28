/**
 * LoginPage Component
 *
 * Landing page for unauthenticated users.
 * Displays "Sign in with Google" button with company branding.
 * Handles authentication flow entry point with Cloudflare Turnstile.
 *
 * Usage:
 * <LoginPage />
 */

import React, { useEffect } from 'react';
import { AuthModal } from './AuthModal';
import { useAuth } from './useAuth';

export function LoginPage() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '[PASTE_YOUR_CLIENT_ID_HERE]';
  const { supabaseClient } = useAuth();

  useEffect(() => {
    if (!supabaseClient || typeof window === 'undefined') return undefined;

    window.handleGoogleCredentialResponse = async (response) => {
      try {
        const loginResponse = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            credential: response?.credential,
            g_csrf_token: response?.g_csrf_token || '',
          }),
        });

        const payload = await loginResponse.json();
        if (!loginResponse.ok) {
          throw new Error(payload?.error || 'Google login failed');
        }

        const session = payload?.session;
        if (!session?.access_token || !session?.refresh_token) {
          throw new Error('Missing session payload from login endpoint');
        }

        const { error: sessionError } = await supabaseClient.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (sessionError) {
          throw sessionError;
        }

        window.location.replace('/');
      } catch (error) {
        console.error('One Tap login failed:', error);
      }
    };

    return () => {
      delete window.handleGoogleCredentialResponse;
    };
  }, [supabaseClient]);

  // AuthModal is always open on this page - it handles all auth flow
  // The modal takes care of Turnstile, Google OAuth, and error handling

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a2540] to-[#1b3a6b] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div
          id="g_id_onload"
          data-client_id={googleClientId}
          data-callback="handleGoogleCredentialResponse"
          data-auto_prompt="true"
          data-itp_support="true"
          data-ux_mode="popup"
        />

        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-2">BondSBA Terminal</h1>
          <p className="text-slate-300 text-lg">SBA, bond, and business financing submissions</p>
        </div>

        {/* Auth Modal - Always visible on login page */}
        <AuthModal isOpen={true} onClose={() => {}} />

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-slate-400 text-xs">
            Secure login with Google and Supabase
          </p>
          <p className="text-slate-400 text-xs">
            Questions? Contact <a href="mailto:contactbondsba@gmail.com" className="text-sky-300 hover:underline">contactbondsba@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
