/**
 * Supabase Client Initialization
 *
 * Provides authenticated Supabase client for use in React components.
 * Handles session management and JWT token extraction for API authentication.
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from './supabaseConfig';

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CANONICAL_AUTH_CALLBACK_URL = 'https://bondsba.com/auth/callback';

const canInitializeSupabase = Boolean(supabaseUrl && supabaseAnonKey);

if (!canInitializeSupabase) {
  console.error('Supabase credentials not configured or malformed in environment variables');
}

export const supabase = canInitializeSupabase
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Get the current JWT token for API requests
 * @returns {Promise<string|null>} JWT token or null if not authenticated
 */
export async function getAuthToken() {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Get the current authenticated user
 * @returns {Promise<object|null>} User object or null if not authenticated
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: CANONICAL_AUTH_CALLBACK_URL,
      },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
}

/**
 * Listen for auth state changes
 * @param {function} callback - Called with (session) whenever auth state changes
 * @returns {function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  if (!supabase) {
    return () => {};
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(session);
    }
  );
  return () => subscription?.unsubscribe();
}
