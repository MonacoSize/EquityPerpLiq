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
    const text = await r.text();
    if (!text || !text.trim()) throw new Error(`Empty response from ${path}`);
    return { status: r.status, data: JSON.parse(text) };
  };

  try {
    const { data } = await get('orderBooks');
    const allMarkets = data.order_books || [];
    const equityMarkets = allMarkets.filter(m => EQUITY.includes((m.symbol || '').toUpperCase()));

    if (!equityMarkets.length) {
      return res.status(200).json({ order_books: [], debug: 'no equity markets matched', sample: allMarkets.slice(0,5).map(m=>m.symbol) });
    }

    // Fetch books one at a time to avoid rate limiting
    const order_books = [];
    for (const mkt of equityMarkets) {
      try {
        const { data: bookData } = await get(`orderBook?market_id=${mkt.market_id}&depth=20`);
        const book = bookData.order_book || bookData;
        const bids = (book.bids || []).map(b => Array.isArray(b) ? { px: +b[0], sz: +b[1] } : { px: +(b.price||b.px), sz: +(b.quantity||b.size||b.sz) });
        const asks = (book.asks || []).map(a => Array.isArray(a) ? { px: +a[0], sz: +a[1] } : { px: +(a.price||a.px), sz: +(a.quantity||a.size||a.sz) });
        if (!bids.length && !asks.length) continue;
        order_books.push({ symbol: mkt.symbol, ticker: mkt.symbol, bids, asks });
      } catch(e) {}
    }

    res.status(200).json({ order_books });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
