export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = 'https://mainnet.zklighter.elliot.ai/api/v1';

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(`${BASE}/orderBooks`, { headers: { 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    const data = await r.json();
    const allMarkets = data.order_books || [];
    return res.status(200).json({ allSymbols: allMarkets.map(m => m.symbol), total: allMarkets.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
