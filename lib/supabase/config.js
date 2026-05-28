function readEnvValue(name) {
  const value = process.env[name];
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function normalizeSupabaseUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getServerSupabaseUrl() {
  const rawUrl = readEnvValue('SUPABASE_URL') || readEnvValue('VITE_SUPABASE_URL');
  return normalizeSupabaseUrl(rawUrl);
}

export function getServerSupabaseAnonKey() {
  return readEnvValue('SUPABASE_ANON_KEY') || readEnvValue('VITE_SUPABASE_ANON_KEY') || null;
}

export function getServerSupabaseServiceRoleKey() {
  return readEnvValue('SUPABASE_SERVICE_ROLE_KEY') || readEnvValue('SUPABASE_SECRET_KEY') || null;
}
