/**
 * /api/market-rates
 *
 * Live US market reference rates from FRED (Federal Reserve Economic Data).
 * Powers the SBA calculator and Submission Readiness sidebar:
 *   - Prime rate (DPRIME)
 *   - 10-year Treasury yield (DGS10)
 *   - SOFR (SOFR)
 *
 * Requires FRED_API_KEY (free: https://fredaccount.stlouisfed.org/apikey).
 * Cached in-memory per serverless instance for 30 minutes — FRED publishes
 * once per business day so re-hitting is wasteful.
 *
 * Public endpoint, no auth — these are public market data.
 */

const SERIES = {
  prime: 'DPRIME',         // Bank Prime Loan Rate
  treasury10y: 'DGS10',    // 10-Year Treasury Constant Maturity
  treasury5y: 'DGS5',      // 5-Year Treasury Constant Maturity
  sofr: 'SOFR',            // Secured Overnight Financing Rate
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map(); // seriesId -> { value, asOf, fetchedAt }

const ALLOWED_ORIGINS = new Set([
  'https://bondsba.com',
  'https://www.bondsba.com',
  'https://clearpathsbaloan.com',
  'https://www.clearpathsbaloan.com',
  'https://clearpathsba.com',
  'https://www.clearpathsba.com',
  'https://clearpath-sba-v2.vercel.app',
]);

async function fetchSeries(seriesId, apiKey) {
  const cached = cache.get(seriesId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
  const payload = await res.json();
  const obs = (payload.observations || []).find((o) => o.value !== '.');
  if (!obs) throw new Error(`FRED: no recent observation for ${seriesId}`);
  const record = {
    value: Number(obs.value),
    asOf: obs.date,
    fetchedAt: Date.now(),
  };
  cache.set(seriesId, record);
  return record;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Soft origin gate — FRED data is public but limit cross-origin reads.
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin) && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Market data unavailable',
      detail: 'FRED_API_KEY is not configured. Set it in Vercel env to enable live rates.',
    });
  }

  try {
    const requested = `${req.query?.series || 'prime,treasury10y,sofr'}`.split(',').map((s) => s.trim().toLowerCase());
    const result = {};
    await Promise.all(
      requested.map(async (key) => {
        const seriesId = SERIES[key];
        if (!seriesId) return;
        try {
          const row = await fetchSeries(seriesId, apiKey);
          result[key] = { value: row.value, asOf: row.asOf, source: 'FRED', seriesId };
        } catch (err) {
          result[key] = { error: err.message };
        }
      })
    );

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ rates: result, generatedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Market rates fetch failed', detail: err.message });
  }
}
