export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const HL = 'https://api.hyperliquid.xyz/info';

  const post = async (body) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(HL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HL HTTP ${r.status}`);
    return r.json();
  };

  try {
    // Get all mids and log everything for debug
    const allMids = await post({ type: 'allMids' });
    const allKeys = Object.keys(allMids);
    const atCoins = allKeys.filter(k => k.startsWith('@'));
    const xyzCoins = allKeys.filter(k => k.startsWith('xyz:'));

    // Use whichever prefix has coins
    const coins = atCoins.length ? atCoins : xyzCoins.length ? xyzCoins : [];

    if (!coins.length) {
      return res.status(200).json({
        results: [], debug: 'no @ or xyz: coins found',
        sampleKeys: allKeys.slice(0, 20),
        total: allKeys.length
      });
    }

    const results = [];
    await Promise.allSettled(coins.slice(0, 30).map(async (coin) => {
      try {
        const book = await post({ type: 'l2Book', coin });
        const levels = book.levels || [];
        const bids = (levels[0] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        const asks = (levels[1] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        const mid = parseFloat(allMids[coin]);
        if (!mid || (!bids.length && !asks.length)) return;
        results.push({ coin, mid, bids, asks });
      } catch(e) {}
    }));

    res.status(200).json({ results, total_coins: coins.length, prefix: atCoins.length ? '@' : 'xyz:' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
