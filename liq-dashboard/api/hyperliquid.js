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
    // Get meta to map coin index -> name, and mids
    const [metaRaw, allMids] = await Promise.all([
      post({ type: 'meta' }),
      post({ type: 'allMids' }),
    ]);

    // Build index->name map from universe
    const universe = metaRaw?.universe || [];
    const indexToName = {};
    universe.forEach((asset, i) => {
      indexToName[`@${i}`] = asset.name;
    });

    const atCoins = Object.keys(allMids).filter(k => k.startsWith('@'));

    if (!atCoins.length) {
      return res.status(200).json({ results: [], debug: 'no @ coins in allMids' });
    }

    const results = [];
    await Promise.allSettled(atCoins.slice(0, 40).map(async (coin) => {
      try {
        const book = await post({ type: 'l2Book', coin });
        const levels = book.levels || [];
        const bids = (levels[0] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        const asks = (levels[1] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        const mid = parseFloat(allMids[coin]);
        if (!mid || (!bids.length && !asks.length)) return;
        // Use mapped name or fall back to coin id
        const name = indexToName[coin] || coin;
        results.push({ coin: name, mid, bids, asks });
      } catch(e) {}
    }));

    res.status(200).json({ results, dex: 'xyz', source: 'hip3' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
