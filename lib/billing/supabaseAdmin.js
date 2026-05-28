import { createClient } from '@supabase/supabase-js';
import {
  getServerSupabaseAnonKey,
  getServerSupabaseServiceRoleKey,
  getServerSupabaseUrl,
} from '../supabase/config.js';

let adminClient = null;
let anonClient = null;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const supabaseUrl = getServerSupabaseUrl();
  const serviceRoleKey = getServerSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role configuration missing.');
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

export function getSupabaseAnonClient() {
  if (anonClient) return anonClient;

  const supabaseUrl = getServerSupabaseUrl();
  const anonKey = getServerSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase anon configuration missing.');
  }

  anonClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return anonClient;
}
