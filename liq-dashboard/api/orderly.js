export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = 'https://api-evm.orderly.network/v1';
  const EQUITY = ['AAPL','AMZN','GOOGL','META','MSFT','NVDA','TSLA','COIN','AMD','NFLX','PLTR','HOOD','SPY','QQQ'];

  const get = async (path, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${BASE}/${path}${qs ? '?' + qs : ''}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`Orderly HTTP ${r.status} for ${url}`);
    return r.json();
  };

  // Allow the old pass-through mode for backward compat (path + params in query)
  const { path, ...params } = req.query;
  if (path && path !== 'auto') {
    try {
      const data = await get(path, params);
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Auto mode: discover equity symbols then fetch all their books
  try {
    // Known Orderly equity perp symbol format: PERP_AAPL_USDC
    // Build the list directly — Orderly's public/info can be slow/large
    const symbolCandidates = EQUITY.map(t => `PERP_${t}_USDC`);

    const results = [];
    await Promise.allSettled(symbolCandidates.map(async (symbol) => {
      try {
        const data = await get('public/orderbook', { symbol, max_level: 25 });
        if (!data?.data) return;
        const book = data.data;
        const ticker = symbol.replace('PERP_', '').replace('_USDC', '');
        const bids = (book.bids || []).map(b => ({ px: +b[0], sz: +b[1] }));
        const asks = (book.asks || []).map(a => ({ px: +a[0], sz: +a[1] }));
        if (!bids.length && !asks.length) return;
        results.push({ symbol, ticker, bids, asks });
      } catch (e) {
        // symbol may not exist on Orderly — skip silently
      }
    }));

    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
