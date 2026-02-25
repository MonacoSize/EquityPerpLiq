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
    // Step 1: get all mids, filter for xyz: prefix (HIP-3 equity perps)
    const allMids = await post({ type: 'allMids' });
    const allKeys = Object.keys(allMids);
    const xyzCoins = allKeys.filter(k => k.startsWith('xyz:'));

    if (!xyzCoins.length) {
      // Return sample of all keys so we can see what prefixes actually exist
      return res.status(200).json({
        results: [], dex: 'xyz', source: 'hip3',
        debug: 'no xyz: coins found in allMids',
        sampleKeys: allKeys.slice(0, 30),
        totalKeys: allKeys.length
      });
    }

    // Step 2: fetch L2 books for each xyz coin in parallel
    const results = [];
    await Promise.allSettled(xyzCoins.slice(0, 25).map(async (coin) => {
      try {
        const book = await post({ type: 'l2Book', coin });
        const levels = book.levels || [];
        const bids = (levels[0] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        const asks = (levels[1] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        const mid = parseFloat(allMids[coin]);
        if (!mid || (!bids.length && !asks.length)) return;
        results.push({ coin, mid, bids, asks });
      } catch (e) {
        // skip failed books silently
      }
    }));

    res.status(200).json({ results, dex: 'xyz', source: 'hip3' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
