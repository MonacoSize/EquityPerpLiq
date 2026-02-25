export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = 'https://mainnet.zklighter.elliot.ai/api/v1';

  const get = async (path, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${BASE}/${path}${qs ? '?' + qs : ''}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`Lighter HTTP ${r.status} for ${url}`);
    return r.json();
  };

  try {
    // Step 1: list all markets to find equity perp market IDs
    const marketsData = await get('markets');
    // Response shape: { markets: [ { market_id, base_asset_symbol, ... } ] }
    const allMarkets = marketsData.markets || marketsData.order_books || marketsData.data || [];

    const EQUITY = ['NVDA','TSLA','AAPL','AMZN','MSFT','GOOGL','META','COIN','SPY','QQQ','PLTR','AMD','NFLX','HOOD','XAUUSD','XAGUSD'];

    const equityMarkets = allMarkets.filter(m => {
      const sym = (m.base_asset_symbol || m.symbol || m.ticker || '').toUpperCase();
      return EQUITY.some(t => sym === t || sym.startsWith(t + '-') || sym.startsWith(t + '_'));
    });

    if (!equityMarkets.length) {
      // Return raw markets for debugging
      return res.status(200).json({ order_books: [], debug: 'no equity markets matched', sample: allMarkets.slice(0, 5) });
    }

    // Step 2: fetch order book for each equity market
    const order_books = [];
    await Promise.allSettled(equityMarkets.map(async (mkt) => {
      try {
        const marketId = mkt.market_id ?? mkt.id;
        const sym = (mkt.base_asset_symbol || mkt.symbol || '').toUpperCase();
        const ticker = EQUITY.find(t => sym === t || sym.startsWith(t));

        // Try fetching order book by market_id
        const bookData = await get('orderBook', { market_id: marketId, depth: 20 });
        const book = bookData.order_book || bookData;

        const bids = (book.bids || []).map(b => Array.isArray(b) ? { px: +b[0], sz: +b[1] } : { px: +(b.price || b.px), sz: +(b.quantity || b.size || b.sz) });
        const asks = (book.asks || []).map(a => Array.isArray(a) ? { px: +a[0], sz: +a[1] } : { px: +(a.price || a.px), sz: +(a.quantity || a.size || a.sz) });

        if (!bids.length && !asks.length) return;
        order_books.push({ symbol: ticker || sym, ticker: ticker || sym, bids, asks });
      } catch (e) {
        // skip
      }
    }));

    res.status(200).json({ order_books });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
