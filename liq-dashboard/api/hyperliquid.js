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
    // Get XYZ dex meta — returns [meta, assetCtxs]
    const xyzMeta = await post({ type: 'metaAndAssetCtxs', dex: 'xyz' });

    if (!Array.isArray(xyzMeta) || xyzMeta.length < 2) {
      return res.status(200).json({ results: [], debug: 'metaAndAssetCtxs dex:xyz returned unexpected format', raw: JSON.stringify(xyzMeta).slice(0, 300) });
    }

    const [meta, ctxs] = xyzMeta;
    const universe = meta.universe || [];

    if (!universe.length) {
      return res.status(200).json({ results: [], debug: 'empty universe from dex:xyz' });
    }

    // Build coin list with mids from ctxs
    const coins = universe.map((asset, i) => ({
      name: asset.name,
      coin: asset.name,
      mid: parseFloat(ctxs[i]?.midPx || 0),
    })).filter(c => c.mid > 0);

    const results = [];
    await Promise.allSettled(coins.slice(0, 30).map(async ({ name, mid }) => {
      try {
        const book = await post({ type: 'l2Book', coin: name, dex: 'xyz' });
        const levels = book.levels || [];
        const bids = (levels[0] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        const asks = (levels[1] || []).map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
        if (!bids.length && !asks.length) return;
        results.push({ coin: name, mid, bids, asks });
      } catch(e) {}
    }));

    res.status(200).json({ results, dex: 'xyz', source: 'hip3', total: coins.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
