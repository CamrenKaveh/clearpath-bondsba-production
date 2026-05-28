/**
 * Verify Cloudflare Turnstile Token
 *
 * POST /api/v1/auth/verify-turnstile
 */

const TURNSTILE_TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'Cloudflare verification token is required' });
  }

  if (token === 'dev-turnstile-token' && process.env.NODE_ENV !== 'production') {
    return res.status(200).json({ success: true, mode: 'development' });
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'Cloudflare verification is not configured' });
  }

  if (process.env.NODE_ENV === 'production' && TURNSTILE_TEST_SECRET_KEYS.has(secretKey)) {
    console.error('Cloudflare Turnstile test secret configured in production');
    return res.status(500).json({ error: 'Cloudflare production secret is not configured' });
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare Turnstile API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      return res.status(400).json({
        error: 'Cloudflare verification failed',
        details: data['error-codes'] || [],
      });
    }

    return res.status(200).json({
      success: true,
      challengeTs: data.challenge_ts,
      hostname: data.hostname,
    });
  } catch (error) {
    console.error('Cloudflare Turnstile verification error:', error);
    return res.status(500).json({
      error: 'Failed to verify Cloudflare challenge',
      message: error.message,
    });
  }
}
