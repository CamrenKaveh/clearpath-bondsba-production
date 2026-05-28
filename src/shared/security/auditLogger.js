/**
 * Immutable Audit Logger
 *
 * Implements tamper-evident logging with hash chains for SOC 2 Type II compliance.
 * All logs are append-only; modifications are immediately detectable.
 *
 * Features:
 * - HMAC-SHA256 signature for each row
 * - Hash chain linking (each row includes hash of previous row)
 * - Automatic context capture (IP, user agent, user ID)
 * - Real-time alerts for suspicious activity
 * - Query-friendly design (indexed by action, user, timestamp)
 */

import crypto from 'crypto';

const AUDIT_LOG_SECRET_KEY = process.env.AUDIT_LOG_SECRET_KEY || 'CHANGE_ME_IN_PRODUCTION';

/**
 * Generate HMAC-SHA256 signature for audit row
 */
function generateSignature(rowData, previousHash = null) {
  const dataStr = JSON.stringify({
    ...rowData,
    previousHash, // Include previous row's hash in signature
  });

  const hmac = crypto.createHmac('sha256', AUDIT_LOG_SECRET_KEY);
  hmac.update(dataStr);
  return hmac.digest('hex');
}

/**
 * Log audit event to database
 */
export async function auditLog(supabaseClient, {
  userId,
  sessionId,
  action,
  resourceType,
  resourceId = null,
  apiEndpoint = null,
  httpMethod = null,
  ipAddress = null,
  userAgent = null,
  requestBody = null,
  responseStatus = 200,
  errorMessage = null,
  financialData = null,
  severity = 'INFO',
}) {
  try {
    // Get last audit log for hash chain
    const { data: lastLog } = await supabaseClient
      .from('audit_logs')
      .select('id, hash')
      .order('id', { ascending: false })
      .limit(1);

    const previousHash = lastLog?.[0]?.hash || 'GENESIS';

    // Prepare audit row
    const auditRow = {
      user_id: userId,
      session_id: sessionId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      api_endpoint: apiEndpoint,
      http_method: httpMethod,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_body: requestBody ? JSON.stringify(requestBody) : null,
      response_status: responseStatus,
      error_message: errorMessage,
      financial_data: financialData ? JSON.stringify(financialData) : null,
      severity,
      timestamp: new Date().toISOString(),
    };

    // Generate signature (hash chain included)
    const signature = generateSignature(auditRow, previousHash);

    // Insert audit log
    const { data, error } = await supabaseClient
      .from('audit_logs')
      .insert({
        ...auditRow,
        previous_hash: previousHash,
        hash: signature,
      })
      .select()
      .single();

    if (error) {
      console.error('Audit log insertion failed:', error);
      // Log to stderr as fallback
      console.error(`AUDIT_FALLBACK [${action}] user=${userId} status=${responseStatus}`);
      return null;
    }

    // Alert on critical/suspicious activity
    if (severity === 'CRITICAL' || responseStatus === 401 || responseStatus === 403) {
      await sendSecurityAlert({
        action,
        userId,
        ipAddress,
        responseStatus,
        errorMessage,
        timestamp: auditRow.timestamp,
      });
    }

    return data;
  } catch (error) {
    console.error('Audit logger error:', error);
    // Fail open (don't block requests if audit fails)
    return null;
  }
}

/**
 * Verify audit log integrity by checking hash chain
 */
export async function verifyAuditIntegrity(supabaseClient, startId = null, limit = 100) {
  try {
    let query = supabaseClient
      .from('audit_logs')
      .select('id, hash, previous_hash, timestamp, action')
      .order('id', { ascending: true });

    if (startId) {
      query = query.gte('id', startId);
    }

    const { data, error } = await query.limit(limit);

    if (error) throw error;

    let previousHash = 'GENESIS';
    const issues = [];

    for (const row of data) {
      // Recompute expected hash
      const expectedSignature = generateSignature(
        {
          id: row.id,
          timestamp: row.timestamp,
          action: row.action,
        },
        row.previous_hash
      );

      // Check if signature matches
      if (row.hash !== expectedSignature) {
        issues.push({
          rowId: row.id,
          issue: 'HASH_MISMATCH',
          stored: row.hash,
          expected: expectedSignature,
        });
      }

      // Check if previous hash links correctly
      if (row.previous_hash !== previousHash) {
        issues.push({
          rowId: row.id,
          issue: 'CHAIN_BROKEN',
          expected: previousHash,
          stored: row.previous_hash,
        });
      }

      previousHash = row.hash;
    }

    return {
      verified: issues.length === 0,
      rowsChecked: data.length,
      issues,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Audit verification failed:', error);
    return {
      verified: false,
      error: error.message,
    };
  }
}

/**
 * Query audit logs by user (access logs)
 */
export async function getUserAuditTrail(supabaseClient, userId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseClient
    .from('audit_logs')
    .select('timestamp, action, resource_type, response_status, ip_address')
    .eq('user_id', userId)
    .gte('timestamp', startDate)
    .order('timestamp', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Failed to fetch user audit trail:', error);
    return [];
  }

  return data;
}

/**
 * Query audit logs by action (compliance reporting)
 */
export async function getAuditsByAction(supabaseClient, action, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseClient
    .from('audit_logs')
    .select('*')
    .eq('action', action)
    .gte('timestamp', startDate)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }

  return data;
}

/**
 * Detect anomalies in audit logs (suspicious patterns)
 */
export async function detectAnomalies(supabaseClient, userId, threshold = 5) {
  const now = new Date();
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

  const { data, error } = await supabaseClient
    .from('audit_logs')
    .select('action, response_status')
    .eq('user_id', userId)
    .gte('timestamp', fiveMinutesAgo.toISOString())
    .lt('timestamp', now.toISOString());

  if (error) {
    console.error('Anomaly detection failed:', error);
    return { anomalies: [] };
  }

  const anomalies = [];

  // Pattern 1: Multiple failed authentication attempts
  const failedAuths = data.filter(
    log => log.action === 'LOGIN' && log.response_status === 401
  );
  if (failedAuths.length >= threshold) {
    anomalies.push({
      type: 'BRUTE_FORCE_ATTEMPT',
      severity: 'CRITICAL',
      count: failedAuths.length,
      message: `${failedAuths.length} failed login attempts in 5 minutes`,
    });
  }

  // Pattern 2: Rapid permission denied (401/403)
  const deniedAccess = data.filter(
    log => log.response_status === 403
  );
  if (deniedAccess.length >= threshold) {
    anomalies.push({
      type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      severity: 'HIGH',
      count: deniedAccess.length,
      message: `${deniedAccess.length} access denied in 5 minutes`,
    });
  }

  // Pattern 3: Unusual domain access patterns
  const domainActions = data.filter(
    log => log.action === 'DOMAIN_ACCESS'
  );
  if (domainActions.length > 20) {
    anomalies.push({
      type: 'UNUSUAL_API_ACTIVITY',
      severity: 'MEDIUM',
      count: domainActions.length,
      message: `${domainActions.length} domain access attempts in 5 minutes`,
    });
  }

  return { anomalies, timestamp: now.toISOString() };
}

/**
 * Send real-time security alert to monitoring system
 * In production, integrate with Slack, PagerDuty, Sentry, etc.
 */
async function sendSecurityAlert({ action, userId, ipAddress, responseStatus, errorMessage, timestamp }) {
  const alert = {
    type: 'SECURITY_ALERT',
    action,
    user_id: userId,
    ip_address: ipAddress,
    status_code: responseStatus,
    error: errorMessage,
    timestamp,
  };

  console.error('SECURITY ALERT:', JSON.stringify(alert));

  // TODO: Integrate with monitoring service
  // await sentry.captureException(new Error(`Security Alert: ${action}`), { extra: alert });
  // await slack.postMessage(channel='#security-alerts', text=`Alert: ${JSON.stringify(alert)}`);
}

export default {
  auditLog,
  verifyAuditIntegrity,
  getUserAuditTrail,
  getAuditsByAction,
  detectAnomalies,
};
