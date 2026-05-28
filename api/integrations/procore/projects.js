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
    projects: [
      { id: 'pc-102', name: 'Northline Utility Corridor', status: 'active', value: 2100000 },
      { id: 'pc-118', name: 'Municipal Pump Station Upgrade', status: 'active', value: 1450000 },
      { id: 'pc-132', name: 'County Bridge Package', status: 'planning', value: 980000 },
    ],
    message: configured
      ? 'Demo project list returned. Replace with provider API call for production.'
      : 'Procore not configured. Manual entry remains available.',
  });
}
