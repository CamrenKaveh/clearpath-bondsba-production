import { getSupabaseAdminClient } from './supabaseAdmin.js';

export async function getBillingContext(userId) {
  const supabase = getSupabaseAdminClient();

  let organizationId = null;
  let organizationRole = null;

  try {
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    organizationId = member?.organization_id || null;
    organizationRole = member?.role || null;
  } catch {
    // Keep null fallback.
  }

  // Legacy fallback from user_roles table if org memberships are unavailable.
  if (!organizationId) {
    try {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id, role')
        .eq('user_id', userId)
        .maybeSingle();

      organizationId = userRole?.organization_id || null;
      organizationRole = organizationRole || userRole?.role || null;
    } catch {
      // Keep null fallback.
    }
  }

  return {
    userId,
    organizationId,
    organizationRole,
  };
}

export function isOrgAdmin(role = '') {
  return ['owner', 'admin'].includes(`${role}`.toLowerCase());
}
