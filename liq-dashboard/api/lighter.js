export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = 'https://mainnet.zklighter.elliot.ai/api/v1';

  const get = async (path) => {
    const url = `${BASE}/${path}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    return { status: r.status, data: await r.text() };
  };

  // Try several possible endpoints to find what works
  const endpoints = ['orderbooks', 'orderBooks', 'markets', 'info', 'tickers', 'instruments', 'products'];
  const results = {};
  await Promise.allSettled(endpoints.map(async ep => {
    try {
      const r = await get(ep);
      results[ep] = { status: r.status, preview: r.data.slice(0, 200) };
    } catch(e) {
      results[ep] = { error: e.message };
    }
  }));

  res.status(200).json(results);
}
