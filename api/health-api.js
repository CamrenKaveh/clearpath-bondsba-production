import integrationsHealth from '../lib/api/healthIntegrations.js';

export default function handler(req, res) {
  const segments = Array.isArray(req.query.route) ? req.query.route : (req.query.route ? [req.query.route] : []);
  const route = segments.join('/');

  if (route === 'integrations') {
    return integrationsHealth(req, res);
  }

  return res.status(404).json({ error: `Route /api/health/${route} not found` });
}
