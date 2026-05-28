function boolEnv(key) {
  const value = process.env[key];
  return Boolean(value && value.trim().length > 0);
}

export default function healthIntegrations(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const supabaseConfigured =
    boolEnv('VITE_SUPABASE_URL') || boolEnv('SUPABASE_URL') || boolEnv('NEXT_PUBLIC_SUPABASE_URL');
  const stripeConfigured = boolEnv('STRIPE_SECRET_KEY');
  const stripeWebhookConfigured = boolEnv('STRIPE_WEBHOOK_SECRET');
  const googleDocumentAiConfigured =
    boolEnv('GOOGLE_DOCUMENT_AI_PROJECT_ID') &&
    boolEnv('GOOGLE_DOCUMENT_AI_LOCATION') &&
    boolEnv('GOOGLE_DOCUMENT_AI_PROCESSOR_ID') &&
    boolEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
    boolEnv('GOOGLE_WORKLOAD_IDENTITY_PROVIDER');
  const mistralConfigured = boolEnv('MISTRAL_API_KEY');
  const awsTextractConfigured =
    boolEnv('AWS_ACCESS_KEY_ID') && boolEnv('AWS_SECRET_ACCESS_KEY') && boolEnv('AWS_REGION');
  const quickbooksConfigured =
    boolEnv('QUICKBOOKS_CLIENT_ID') &&
    boolEnv('QUICKBOOKS_CLIENT_SECRET') &&
    boolEnv('QUICKBOOKS_REDIRECT_URI');
  const procoreConfigured =
    boolEnv('PROCORE_CLIENT_ID') &&
    boolEnv('PROCORE_CLIENT_SECRET') &&
    boolEnv('PROCORE_REDIRECT_URI');

  const extractionAvailable = googleDocumentAiConfigured || mistralConfigured || awsTextractConfigured;
  let extractionProvider = null;
  if (googleDocumentAiConfigured) extractionProvider = 'google_document_ai';
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
        configured: googleDocumentAiConfigured,
        note: 'Uses Vercel OIDC/WIF. Service account JSON keys are not supported.',
        vercelOidcAvailable: boolEnv('VERCEL_OIDC_TOKEN'),
      },
      mistralOcr: { configured: mistralConfigured },
      awsTextract: { configured: awsTextractConfigured },
      quickbooks: {
        configured: quickbooksConfigured,
        note: quickbooksConfigured
          ? 'QuickBooks integration available.'
          : 'Connect later - manual entry works now.',
        environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      },
      procore: {
        configured: procoreConfigured,
        note: procoreConfigured
          ? 'Procore integration available.'
          : 'Connect later - manual entry works now.',
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
