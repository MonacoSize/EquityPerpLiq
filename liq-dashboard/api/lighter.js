export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BASE = 'https://mainnet.zklighter.elliot.ai/api/v1';
  const EQUITY = ['NVDA','TSLA','AAPL','AMZN','MSFT','GOOGL','META','COIN','SPY','QQQ','PLTR','AMD','NFLX','HOOD','XAUUSD','XAGUSD'];

  const get = async (path) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(`${BASE}/${path}`, { headers: { 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`Lighter HTTP ${r.status}`);
    return r.json();
  };

  try {
    const data = await get('orderBooks');
    const allMarkets = data.order_books || [];

    const equityMarkets = allMarkets.filter(m => {
      const sym = (m.symbol || '').toUpperCase();
      return EQUITY.some(t => sym === t || sym.startsWith(t + '-') || sym.startsWith(t + '_') || sym.includes(t));
    });

    if (!equityMarkets.length) {
      return res.status(200).json({ order_books: [], debug: 'no equity markets matched', allSymbols: allMarkets.map(m => m.symbol) });
    }

    // Fetch order book for each equity market by market_id
    const order_books = [];
    await Promise.allSettled(equityMarkets.map(async (mkt) => {
      try {
        const sym = (mkt.symbol || '').toUpperCase();
        const ticker = EQUITY.find(t => sym.includes(t)) || sym;
        const bookData = await get(`orderBook?market_id=${mkt.market_id}&depth=20`);
        const book = bookData.order_book || bookData;
        const bids = (book.bids || []).map(b => Array.isArray(b) ? { px: +b[0], sz: +b[1] } : { px: +(b.price || b.px), sz: +(b.quantity || b.size || b.sz) });
        const asks = (book.asks || []).map(a => Array.isArray(a) ? { px: +a[0], sz: +a[1] } : { px: +(a.price || a.px), sz: +(a.quantity || a.size || a.sz) });
        if (!bids.length && !asks.length) return;
        order_books.push({ symbol: ticker, ticker, bids, asks });
      } catch(e) {}
    }));

    res.status(200).json({ order_books });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
