/**
 * GET /api/health/integrations
 *
 * Returns boolean/status for each integration. Never returns secrets.
 * Manual entry works even if all integrations return false.
 *
 * To change Stripe prices later:
 *   1. Create new Price in Stripe under same Product.
 *   2. Copy new price_ ID.
 *   3. Replace corresponding Vercel env var.
 *   4. Redeploy. Do not edit old price IDs in code.
 */

function boolEnv(key) {
  const v = process.env[key];
  return Boolean(v && v.trim().length > 0);
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Supabase
  const supabaseConfigured =
    boolEnv('VITE_SUPABASE_URL') || boolEnv('SUPABASE_URL') || boolEnv('NEXT_PUBLIC_SUPABASE_URL');

  // Stripe
  const stripeConfigured = boolEnv('STRIPE_SECRET_KEY');
  const stripeWebhookConfigured = boolEnv('STRIPE_WEBHOOK_SECRET');

  // Google Document AI — uses Workload Identity Federation, not JSON keys
  // Service account key creation is blocked. Never use GOOGLE_APPLICATION_CREDENTIALS_BASE64.
  const googleDocAiConfigured =
    boolEnv('GOOGLE_DOCUMENT_AI_PROJECT_ID') &&
    boolEnv('GOOGLE_DOCUMENT_AI_LOCATION') &&
    boolEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID') &&
    boolEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
    boolEnv('GOOGLE_WORKLOAD_IDENTITY_PROVIDER');

  const vercelOidcAvailable = boolEnv('VERCEL_OIDC_TOKEN');

  // Mistral OCR
  const mistralConfigured = boolEnv('MISTRAL_API_KEY');

  // AWS Textract
  const awsTextractConfigured =
    boolEnv('AWS_ACCESS_KEY_ID') && boolEnv('AWS_SECRET_ACCESS_KEY') && boolEnv('AWS_REGION');

  // QuickBooks
  const quickbooksConfigured =
    boolEnv('QUICKBOOKS_CLIENT_ID') &&
    boolEnv('QUICKBOOKS_CLIENT_SECRET') &&
    boolEnv('QUICKBOOKS_REDIRECT_URI');

  // Procore
  const procoreConfigured =
    boolEnv('PROCORE_CLIENT_ID') &&
    boolEnv('PROCORE_CLIENT_SECRET') &&
    boolEnv('PROCORE_REDIRECT_URI');

  // Extraction available if any provider is configured
  const extractionAvailable = googleDocAiConfigured || mistralConfigured || awsTextractConfigured;

  // Determine active extraction provider name (no secrets)
  let extractionProvider = null;
  if (googleDocAiConfigured) extractionProvider = 'google_document_ai';
  else if (mistralConfigured) extractionProvider = 'mistral_ocr';
  else if (awsTextractConfigured) extractionProvider = 'aws_textract';

  return res.status(200).json({
    status: 'ok',
    manualEntryAlwaysAvailable: true,
    integrations: {
      supabase: { configured: supabaseConfigured },
      stripe: {
        configured: stripeConfigured,
        webhookConfigured: stripeWebhookConfigured,
      },
      googleDocumentAi: {
        configured: googleDocAiConfigured,
        note: 'Uses Vercel OIDC/WIF. Service account JSON keys are not supported.',
        vercelOidcAvailable,
      },
      mistralOcr: { configured: mistralConfigured },
      awsTextract: { configured: awsTextractConfigured },
      quickbooks: {
        configured: quickbooksConfigured,
        note: quickbooksConfigured
          ? 'QuickBooks integration available.'
          : 'Connect later — manual entry works now.',
        environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      },
      procore: {
        configured: procoreConfigured,
        note: procoreConfigured
          ? 'Procore integration available.'
          : 'Connect later — manual entry works now.',
        environment: process.env.PROCORE_ENVIRONMENT || 'sandbox',
      },
    },
    extraction: {
      available: extractionAvailable,
      provider: extractionProvider,
      fallback: 'manual_entry',
    },
  });
}
