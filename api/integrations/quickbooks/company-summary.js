import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import { getValidAccessToken } from '../../../lib/integrations/tokenRefresh.js';

function getQbBase() {
  const env = `${process.env.QUICKBOOKS_ENVIRONMENT || 'production'}`.toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3'
    : 'https://quickbooks.api.intuit.com/v3';
}

async function qb(path, token) {
  const res = await fetch(`${getQbBase()}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`QB ${path} HTTP ${res.status}`);
  return res.json();
}

function findRowSum(report, label) {
  const rows = report?.Rows?.Row || [];
  for (const r of rows) {
    if (r.group === label || r.Summary?.ColData?.[0]?.value === label) {
      const last = r.Summary?.ColData?.slice(-1)?.[0]?.value;
      if (last) return Number(String(last).replace(/[$,]/g, '')) || 0;
    }
    if (r.Rows?.Row) {
      const nested = findRowSum({ Rows: r.Rows }, label);
      if (nested) return nested;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const configured = Boolean(
    process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET
  );
  if (!configured) {
    return res.status(200).json({ provider: 'quickbooks', status: 'not_configured', data: null });
  }

  const authError = await verifyAndAttachUser(req);
  if (authError) return res.status(authError.statusCode).json(JSON.parse(authError.body));

  let conn;
  try {
    conn = await getValidAccessToken({ userId: req.user.userId, provider: 'quickbooks' });
  } catch (err) {
    return res.status(500).json({ status: 'token_error', detail: err.message });
  }
  if (!conn?.access_token || !conn?.realm_id) {
    return res.status(200).json({
      provider: 'quickbooks',
      status: 'not_connected',
      message: 'Connect QuickBooks first to import company financials.',
    });
  }

  const realmId = conn.realm_id;
  try {
    const [info, pl, bs] = await Promise.all([
      qb(`/company/${realmId}/companyinfo/${realmId}`, conn.access_token).catch(() => null),
      qb(`/company/${realmId}/reports/ProfitAndLoss?minorversion=70`, conn.access_token).catch(() => null),
      qb(`/company/${realmId}/reports/BalanceSheet?minorversion=70`, conn.access_token).catch(() => null),
    ]);

    const companyName = info?.CompanyInfo?.CompanyName || null;
    const revenue = pl ? findRowSum(pl, 'Income') || findRowSum(pl, 'Total Income') : null;
    const grossProfit = pl ? findRowSum(pl, 'Gross Profit') : null;
    const netIncome = pl ? findRowSum(pl, 'Net Income') : null;
    const totalAssets = bs ? findRowSum(bs, 'TotalAssets') || findRowSum(bs, 'Total Assets') : null;
    const totalLiabilities = bs ? findRowSum(bs, 'Total Liabilities') : null;
    const totalEquity = bs ? findRowSum(bs, 'Total Equity') || findRowSum(bs, 'TotalEquity') : null;

    return res.status(200).json({
      provider: 'quickbooks',
      status: 'connected',
      data: {
        companyName,
        statementDate: new Date().toISOString().slice(0, 10),
        revenue, grossProfit, netIncome,
        totalAssets, totalLiabilities, equity: totalEquity,
      },
    });
  } catch (err) {
    return res.status(500).json({ provider: 'quickbooks', status: 'fetch_failed', detail: err.message });
  }
}
