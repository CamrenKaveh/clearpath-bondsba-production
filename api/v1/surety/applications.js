import { createClient } from '@supabase/supabase-js';
import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import { enforceRateLimit } from '../../../lib/middleware/rbac.js';
import { createApplication, getApplication, initializeSuretyDB, listApplications } from '../../../src/domains/surety/db/suretyDatabase.js';
import { getServerSupabaseServiceRoleKey, getServerSupabaseUrl } from '../../../lib/supabase/config.js';

let serviceRoleClient = null;
let suretyDbInitialized = false;

function getServiceRoleClient() {
  if (serviceRoleClient) return serviceRoleClient;

  const supabaseUrl = getServerSupabaseUrl();
  const serviceRoleKey = getServerSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role config missing on server');
  }

  serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceRoleClient;
}

function ensureSuretyDB() {
  if (suretyDbInitialized) return;
  initializeSuretyDB(getServiceRoleClient());
  suretyDbInitialized = true;
}

async function getRequestOrganizationId(client, userId) {
  if (!userId) return null;

  try {
    const { data, error } = await client
      .from('user_roles')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data?.organization_id || null;
  } catch {
    return null;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function formatApplication(application) {
  return {
    applicationId: application.id,
    createdAt: application.created_at,
    updatedAt: application.updated_at,
    applicantName: application.applicant_name,
    businessType: application.business_type,
    industry: application.industry,
    overallRiskLevel: application.overall_risk_level,
    status: application.status,
    analysis: application.analysis_result,
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    ensureSuretyDB();
    client = getServiceRoleClient();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  const authError = await verifyAndAttachUser(req);
  if (authError) {
    const { statusCode, body } = authError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  const rateLimitError = enforceRateLimit(req, 30, 60 * 1000);
  if (rateLimitError) {
    const { statusCode, body } = rateLimitError;
    return res.status(statusCode).json(JSON.parse(body));
  }

  const organizationId = await getRequestOrganizationId(client, req.user.userId);

  if (req.method === 'GET') {
    try {
      const { applicationId, limit = '6' } = req.query || {};

      if (applicationId) {
        if (!isUuid(applicationId)) {
          return res.status(400).json({ error: 'Invalid applicationId format' });
        }

        const record = await getApplication(applicationId, req.user.userId, organizationId);
        return res.status(200).json({
          success: true,
          data: {
            ...formatApplication(record.application),
            analyses: record.analyses,
            documents: record.documents,
            riskFactors: record.riskFactors,
            recommendations: record.recommendations,
          },
        });
      }

      const records = await listApplications({
        userId: req.user.userId,
        organizationId,
        limit: Math.max(1, Math.min(Number.parseInt(limit, 10) || 6, 20)),
      });

      return res.status(200).json({
        success: true,
        data: records.map(formatApplication),
      });
    } catch (error) {
      console.error('Failed to load surety applications:', error);
      return res.status(500).json({ error: `Failed to load surety applications: ${error.message}` });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        documentId,
        documentName,
        documentType,
        applicantName,
        businessType,
        industry,
        analysis,
      } = req.body || {};

      if (!analysis) {
        return res.status(400).json({ error: 'Missing analysis payload' });
      }

      const result = await createApplication({
        userId: req.user.userId,
        organizationId,
        documentId,
        documentName,
        documentType,
        applicantName,
        businessType,
        industry,
        analysis,
      });

      const record = await getApplication(result.applicationId, req.user.userId, organizationId);

      return res.status(200).json({
        success: true,
        data: {
          ...formatApplication(record.application),
          analyses: record.analyses,
          documents: record.documents,
          riskFactors: record.riskFactors,
          recommendations: record.recommendations,
        },
      });
    } catch (error) {
      console.error('Failed to save surety application:', error);
      return res.status(500).json({ error: `Failed to save surety application: ${error.message}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
