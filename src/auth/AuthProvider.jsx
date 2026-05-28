/**
 * AuthProvider Component
 *
 * Wraps the entire app and manages authentication state.
 * - Initializes Supabase session on mount
 * - Listens for auth changes
 * - Refreshes tokens automatically
 * - Provides auth state to all children via context
 *
 * Usage:
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../shared/utils/supabaseClient';
import { normalizeSupabaseUrl } from '../shared/utils/supabaseConfig';

// Create context for auth state
export const AuthContext = createContext(null);

const CANONICAL_AUTH_ORIGIN = 'https://bondsba.com';
const CANONICAL_AUTH_CALLBACK_URL = 'https://bondsba.com/auth/callback';
const LEGACY_AUTH_HOSTS = new Set([
  'www.bondsba.com',
  'clearpathsbaloan.com',
  'www.clearpathsbaloan.com',
  'clearpathsba.com',
  'www.clearpathsba.com',
]);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supabaseClient] = useState(supabase);

  // Initialize Supabase client
  useEffect(() => {
    const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      setError('Supabase configuration missing');
      setLoading(false);
      return;
    }

    setError(null);
  }, []);

  // Initialize auth session on mount
  useEffect(() => {
    if (!supabaseClient) return;

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) {
          console.error('Auth initialization error:', sessionError);
          setError(sessionError.message);
        }

        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user || null);

        if (event === 'SIGNED_OUT') {
          // Clear any local state on sign out
          setUser(null);
          setSession(null);
        }

        if (event === 'TOKEN_REFRESHED') {
          // Token was automatically refreshed
          setSession(newSession);
        }
      }
    );

    // Cleanup listener
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabaseClient]);

  // Verify Cloudflare Turnstile token with backend
  const verifyTurnstileToken = useCallback(async (token) => {
    try {
      const response = await fetch('/api/v1/auth/verify-turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Cloudflare verification failed');
      }

      return true;
    } catch (err) {
      console.error('Cloudflare verification error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  const normalizeAuthHost = useCallback(() => {
    if (typeof window === 'undefined') return false;

    const { hostname, pathname, search, hash } = window.location;
    if (!LEGACY_AUTH_HOSTS.has(hostname)) {
      return false;
    }

    window.location.replace(`${CANONICAL_AUTH_ORIGIN}${pathname}${search}${hash}`);
    return true;
  }, []);

  // Sign in with Google
  const signInWithGoogle = useCallback(async (captchaToken) => {
    if (!supabaseClient) {
      setError('Supabase client not initialized');
      return;
    }

    try {
      setError(null);

      if (normalizeAuthHost()) {
        return;
      }

      if (captchaToken) {
        const isTurnstileValid = await verifyTurnstileToken(captchaToken);
        if (!isTurnstileValid) {
          return;
        }
      }

      const { error: signInError } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: CANONICAL_AUTH_CALLBACK_URL,
          captchaToken,
        },
      });

      if (signInError) {
        setError(signInError.message);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [normalizeAuthHost, supabaseClient, verifyTurnstileToken]);

  const signInWithPassword = useCallback(async ({ email, password, captchaToken }) => {
    if (!supabaseClient) {
      setError('Supabase client not initialized');
      return { error: new Error('Supabase client not initialized') };
    }

    try {
      setError(null);
      if (normalizeAuthHost()) {
        return { data: null, error: null };
      }
      if (captchaToken) {
        const isTurnstileValid = await verifyTurnstileToken(captchaToken);
        if (!isTurnstileValid) {
          return { error: new Error('Cloudflare verification failed') };
        }
      }

      const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken,
        },
      });
      if (signInError) {
        setError(signInError.message);
      }
      return { data, error: signInError };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  }, [normalizeAuthHost, supabaseClient, verifyTurnstileToken]);

  const signUpWithPassword = useCallback(async ({ email, password, fullName, captchaToken }) => {
    if (!supabaseClient) {
      setError('Supabase client not initialized');
      return { error: new Error('Supabase client not initialized') };
    }

    try {
      setError(null);
      if (normalizeAuthHost()) {
        return { data: null, error: null };
      }
      if (captchaToken) {
        const isTurnstileValid = await verifyTurnstileToken(captchaToken);
        if (!isTurnstileValid) {
          return { error: new Error('Cloudflare verification failed') };
        }
      }

      const { data, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          captchaToken,
          data: {
            full_name: fullName,
            role: 'underwriter',
            domains: ['sba', 'surety'],
          },
          emailRedirectTo: CANONICAL_AUTH_CALLBACK_URL,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      }
      return { data, error: signUpError };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  }, [normalizeAuthHost, supabaseClient, verifyTurnstileToken]);

  // Sign out
  const signOut = useCallback(async () => {
    if (!supabaseClient) return;

    try {
      setError(null);
      const { error: signOutError } = await supabaseClient.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [supabaseClient]);

  // Get user role (placeholder for Phase 1)
  const getUserRole = useCallback(async () => {
    if (!user || !supabaseClient) return null;

    try {
      // Phase 1 TODO: Query user_roles table
      // For now, return placeholder
      return 'underwriter'; // or 'admin', 'viewer'
    } catch (err) {
      console.error('Failed to fetch user role:', err);
      return null;
    }
  }, [user, supabaseClient]);

  const value = {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user && !!session,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    getUserRole,
    supabaseClient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
