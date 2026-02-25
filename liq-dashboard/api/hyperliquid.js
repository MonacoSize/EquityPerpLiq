export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = 'https://api-evm.orderly.network/v1';
  const EQUITY = ['AAPL','AMZN','GOOGL','META','MSFT','NVDA','TSLA','COIN','AMD','NFLX','PLTR','HOOD','SPY','QQQ'];

  const get = async (url) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  try {
    const results = [];

    // Try both USDT and USDC suffix since Orderly uses both
    const suffixes = ['USDT', 'USDC'];

    await Promise.allSettled(EQUITY.flatMap(ticker =>
      suffixes.map(async suffix => {
        const symbol = `PERP_${ticker}_${suffix}`;
        try {
          const url = `${BASE}/public/orderbook?symbol=${symbol}&max_level=25`;
          const data = await get(url);
          if (!data?.data) return;
          const book = data.data;
          const bids = (book.bids || []).map(b => ({ px: +b[0], sz: +b[1] }));
          const asks = (book.asks || []).map(a => ({ px: +a[0], sz: +a[1] }));
          if (!bids.length && !asks.length) return;
          // Only add if not already added for this ticker
          if (!results.find(r => r.ticker === ticker)) {
            results.push({ symbol, ticker, bids, asks });
          }
        } catch (e) {}
      })
    ));

    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
