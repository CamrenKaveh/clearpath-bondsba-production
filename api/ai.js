import Anthropic from '@anthropic-ai/sdk';
import { verifyAndAttachUser } from '../lib/middleware/auth.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Allowed origins — same-origin requests have no Origin header (e.g. Vercel SSR),
// so we allow those too. This guards against cross-origin API key drain.
const ALLOWED_ORIGINS = [
  'https://bondsba.com',
  'https://www.bondsba.com',
  'https://clearpathsbaloan.com',
  'https://www.clearpathsbaloan.com',
  'https://clearpathsba.com',
  'https://www.clearpathsba.com',
  'https://clearpath-sba-v2.vercel.app',
];

// Simple in-memory rate limiter (best-effort for serverless instances)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || [];
  const recent = bucket.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  rateBuckets.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Origin check — block cross-origin requests to protect the API key
  const origin = req.headers.origin;
  const isLocalDev = process.env.NODE_ENV !== 'production' || !origin;
  if (origin && !isLocalDev && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const authError = await verifyAndAttachUser(req);
  if (authError) {
    res.status(authError.statusCode);
    res.setHeader('Content-Type', 'application/json');
    return res.end(authError.body);
  }

  const limiterKey = `${getClientIp(req)}:${req.user?.id || 'anon'}`;
  if (isRateLimited(limiterKey)) {
    return res.status(429).json({ error: 'Too many requests. Please wait and retry.' });
  }

  const { prompt, systemInstruction = '', jsonMode = false } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    // Build system prompt with cache_control if a system instruction is provided.
    // Caching stable system prompts saves ~90% on repeated calls with the same instruction.
    const systemParam = systemInstruction
      ? [{ type: 'text', text: systemInstruction, cache_control: { type: 'ephemeral' } }]
      : undefined;

    const userContent = jsonMode
      ? `${prompt}\n\nRespond with valid JSON only. No markdown, no code fences.`
      : prompt;

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      ...(systemParam && { system: systemParam }),
      messages: [{ role: 'user', content: userContent }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    const text = textBlock?.text ?? '';

    if (jsonMode) {
      try {
        return res.status(200).json({ result: JSON.parse(text) });
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return res.status(200).json({ result: JSON.parse(match[0]) });
        return res.status(500).json({ error: 'AI returned invalid JSON' });
      }
    }

    return res.status(200).json({ result: text });
  } catch (error) {
    console.error('AI error:', error);
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limit reached. Please retry in a moment.' });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: 'AI configuration error.' });
    }
    return res.status(500).json({ error: 'AI service unavailable. Please try again.' });
  }
}
