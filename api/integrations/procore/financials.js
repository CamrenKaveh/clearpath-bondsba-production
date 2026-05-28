export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const configured = Boolean(
    process.env.PROCORE_CLIENT_ID &&
      process.env.PROCORE_CLIENT_SECRET &&
      process.env.PROCORE_REDIRECT_URI
  );

  return res.status(200).json({
    provider: 'procore',
    status: configured ? 'demo_data' : 'not_configured',
    summary: {
      activeProjects: 12,
      totalBacklog: 4200000,
      largestJobPercent: 42,
      underbillingsPresent: true,
      overbillingsPresent: false,
      costToCompleteCoverage: 'partial',
    },
    message: configured
      ? 'Demo financial/project summary returned. Replace with provider API call for production.'
      : 'Procore not configured. Manual entry remains available.',
  });
}
