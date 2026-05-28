import { buildEntitlementTemplate, normalizePlan } from '../../src/shared/billing/plans.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

function toISOString(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

function applyOrgScope(query, organizationId) {
  if (!organizationId) return query.is('organization_id', null);
  return query.eq('organization_id', organizationId);
}

const USAGE_COUNTERS = {
  file_check: {
    usedField: 'file_checks_used',
    limitField: 'file_checks_limit',
    exceededReason: 'file_checks_exceeded',
  },
  extraction_credit: {
    usedField: 'extraction_credits_used',
    limitField: 'extraction_credits_limit',
    exceededReason: 'extraction_credits_exceeded',
  },
};

export async function getCurrentEntitlement(userId, organizationId = null) {
  const supabase = getSupabaseAdminClient();

  const nowIso = new Date().toISOString();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 23, 59, 59));

  const fallback = buildEntitlementTemplate('starter', monthStart.toISOString(), monthEnd.toISOString(), {
    status: 'inactive',
    active: false,
  });

  try {
    let query = supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (organizationId) query = query.eq('organization_id', organizationId);
    else query = query.is('organization_id', null);

    const { data, error } = await query;
    if (error) throw error;

    let row = data?.[0];
    if (!row && organizationId) {
      const { data: fallbackRows } = await supabase
        .from('entitlements')
        .select('*')
        .eq('user_id', userId)
        .is('organization_id', null)
        .order('created_at', { ascending: false })
        .limit(1);
      row = fallbackRows?.[0] || null;
    }

    if (!row) {
      return fallback;
    }

    const periodEnd = toISOString(row.period_end, fallback.periodEnd);
    const active =
      ['active', 'trialing'].includes((row.status || '').toLowerCase()) &&
      (!periodEnd || periodEnd >= nowIso);

    return {
      plan: normalizePlan(row.plan || 'starter'),
      status: row.status || 'inactive',
      active,
      fileChecksLimit: row.file_checks_limit ?? fallback.fileChecksLimit,
      fileChecksUsed: row.file_checks_used ?? 0,
      extractionCreditsLimit: row.extraction_credits_limit ?? fallback.extractionCreditsLimit,
      extractionCreditsUsed: row.extraction_credits_used ?? 0,
      usersLimit: row.users_limit ?? fallback.usersLimit,
      features: row.features || fallback.features,
      periodStart: toISOString(row.period_start, fallback.periodStart),
      periodEnd,
    };
  } catch (error) {
    console.warn('Failed to read entitlement, using fallback:', error.message);
    return fallback;
  }
}

export async function upsertEntitlement({
  userId,
  organizationId = null,
  plan = 'starter',
  status = 'active',
  periodStart,
  periodEnd,
  fileChecksUsed = null,
  extractionCreditsUsed = null,
}) {
  const supabase = getSupabaseAdminClient();
  const template = buildEntitlementTemplate(plan, periodStart, periodEnd, {
    status,
    active: ['active', 'trialing'].includes(status),
  });

  const payload = {
    user_id: userId,
    organization_id: organizationId,
    plan: template.plan,
    status: template.status,
    file_checks_limit: template.fileChecksLimit,
    file_checks_used: fileChecksUsed ?? template.fileChecksUsed,
    extraction_credits_limit: template.extractionCreditsLimit,
    extraction_credits_used: extractionCreditsUsed ?? template.extractionCreditsUsed,
    users_limit: template.usersLimit,
    features: template.features,
    period_start: template.periodStart,
    period_end: template.periodEnd,
    updated_at: new Date().toISOString(),
  };

  let lookup = supabase
    .from('entitlements')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  lookup = applyOrgScope(lookup, organizationId);

  const { data: existing, error: lookupError } = await lookup;
  if (lookupError) throw lookupError;

  if (existing?.[0]?.id) {
    const { data: current, error: currentError } = await supabase
      .from('entitlements')
      .select('file_checks_used, extraction_credits_used, period_start, period_end')
      .eq('id', existing[0].id)
      .single();
    if (currentError) throw currentError;

    const incomingPeriodStart = toISOString(template.periodStart, null);
    const incomingPeriodEnd = toISOString(template.periodEnd, null);
    const existingPeriodStart = toISOString(current?.period_start, null);
    const existingPeriodEnd = toISOString(current?.period_end, null);
    const periodChanged = incomingPeriodStart !== existingPeriodStart || incomingPeriodEnd !== existingPeriodEnd;

    if (fileChecksUsed == null) {
      payload.file_checks_used = periodChanged ? template.fileChecksUsed : (current?.file_checks_used ?? 0);
    }
    if (extractionCreditsUsed == null) {
      payload.extraction_credits_used = periodChanged
        ? template.extractionCreditsUsed
        : (current?.extraction_credits_used ?? 0);
    }

    const { data, error } = await supabase
      .from('entitlements')
      .update(payload)
      .eq('id', existing[0].id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('entitlements')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function recordUsageEvent({
  userId,
  organizationId = null,
  eventType,
  quantity = 1,
  metadata = {},
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('usage_events').insert({
    user_id: userId,
    organization_id: organizationId,
    event_type: eventType,
    quantity,
    metadata,
  });
  if (error) throw error;
}

export async function incrementEntitlementUsage({
  userId,
  organizationId = null,
  counter,
  quantity = 1,
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('entitlements')
    .select('id,file_checks_used,extraction_credits_used')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  query = applyOrgScope(query, organizationId);
  const { data, error } = await query;

  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;

  const update = {};
  if (counter === 'file_checks_used') {
    update.file_checks_used = (row.file_checks_used || 0) + quantity;
  } else if (counter === 'extraction_credits_used') {
    update.extraction_credits_used = (row.extraction_credits_used || 0) + quantity;
  }

  if (!Object.keys(update).length) return row;

  const { data: updated, error: updateError } = await supabase
    .from('entitlements')
    .update(update)
    .eq('id', row.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return updated;
}

export async function consumeEntitlementUsage({
  userId,
  organizationId = null,
  counter,
  quantity = 1,
  maxRetries = 5,
}) {
  const config = USAGE_COUNTERS[counter];
  if (!config) {
    return {
      allowed: false,
      reason: 'unknown_counter',
      remaining: null,
      entitlement: null,
      conflict: false,
    };
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return {
      allowed: false,
      reason: 'invalid_quantity',
      remaining: null,
      entitlement: null,
      conflict: false,
    };
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    let query = supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    query = applyOrgScope(query, organizationId);

    const { data, error } = await query;
    if (error) throw error;

    const row = data?.[0];
    if (!row) {
      return {
        allowed: false,
        reason: 'entitlement_missing',
        remaining: null,
        entitlement: null,
        conflict: false,
      };
    }

    const status = `${row.status || ''}`.toLowerCase();
    const periodEnd = toISOString(row.period_end, null);
    const active = ['active', 'trialing'].includes(status) && (!periodEnd || periodEnd >= nowIso);
    if (!active) {
      return {
        allowed: false,
        reason: 'inactive_plan',
        remaining: null,
        entitlement: row,
        conflict: false,
      };
    }

    const usedField = config.usedField;
    const limitField = config.limitField;
    const used = Number(row[usedField] || 0);
    const limit = row[limitField] == null ? null : Number(row[limitField]);
    const remaining = limit == null ? null : (limit - used);

    if (limit != null && remaining < parsedQuantity) {
      return {
        allowed: false,
        reason: config.exceededReason,
        remaining: Math.max(0, remaining),
        entitlement: row,
        conflict: false,
      };
    }

    const nextUsed = used + parsedQuantity;
    const updatePayload = {
      [usedField]: nextUsed,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedRow, error: updateError } = await supabase
      .from('entitlements')
      .update(updatePayload)
      .eq('id', row.id)
      .eq(usedField, used)
      .select('*')
      .maybeSingle();

    if (updateError) throw updateError;

    if (updatedRow) {
      return {
        allowed: true,
        reason: null,
        remaining: limit == null ? null : Math.max(0, limit - nextUsed),
        entitlement: updatedRow,
        conflict: false,
      };
    }
  }

  return {
    allowed: false,
    reason: 'conflict_retry_exhausted',
    remaining: null,
    entitlement: null,
    conflict: true,
  };
}
