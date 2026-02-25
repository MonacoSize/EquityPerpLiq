export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = 'https://mainnet.zklighter.elliot.ai/api/v1';
  const EQUITY = ['NVDA','TSLA','AAPL','AMZN','MSFT','GOOGL','META','COIN','SPY','QQQ','PLTR','AMD','NFLX','HOOD'];

  const get = async (path) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(`${BASE}/${path}`, { headers: { 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    return { status: r.status, data: await r.json() };
  };

  try {
    const { data } = await get('orderBooks');
    const allMarkets = data.order_books || [];
    const equityMarkets = allMarkets.filter(m => EQUITY.includes((m.symbol || '').toUpperCase()));

    // Test one book fetch to see what comes back
    if (equityMarkets.length) {
      const mkt = equityMarkets[0];
      const r1 = await get(`orderBook?market_id=${mkt.market_id}&depth=5`);
      const r2 = await get(`orderbook?market_id=${mkt.market_id}&depth=5`);
      return res.status(200).json({
        foundMarkets: equityMarkets.map(m => ({ symbol: m.symbol, market_id: m.market_id })),
        testMarket: mkt.symbol,
        orderBook_result: r1,
        orderbook_result: r2,
      });
    }

    res.status(200).json({ order_books: [], debug: 'no equity markets' });
  } catch(e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
