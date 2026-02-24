export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const HL = 'https://api.hyperliquid.xyz/info';

  const post = async (body) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(HL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return r.json();
  };

  try {
    // Get mids for XYZ dex (HIP-3 equity perps)
    let mids = {};
    try {
      const metaData = await post({ type: 'metaAndAssetCtxs', dex: 'xyz' });
      if (Array.isArray(metaData) && metaData.length === 2) {
        const [meta, ctxs] = metaData;
        (meta.universe || []).forEach((asset, i) => {
          const ctx = ctxs[i];
          if (ctx?.midPx) mids[`xyz:${asset.name}`] = parseFloat(ctx.midPx);
        });
      }
    } catch (e) {
      const allMids = await post({ type: 'allMids' });
      Object.entries(allMids).forEach(([k, v]) => {
        if (k.startsWith('xyz:')) mids[k] = parseFloat(v);
      });
    }

    // Fetch order books for each XYZ asset
    const results = [];
    await Promise.allSettled(Object.keys(mids).slice(0, 20).map(async (coin) => {
      try {
        const book = await post({ type: 'l2Book', coin });
        const bids = (book.levels?.[0] || []).map(l => ({ px: +l.px, sz: +l.sz }));
        const asks = (book.levels?.[1] || []).map(l => ({ px: +l.px, sz: +l.sz }));
        if (!asks.length && !bids.length) return;
        const mid = mids[coin];
        if (!mid) return;
        results.push({ coin, mid, bids, asks });
      } catch (e) {}
    }));

    res.status(200).json({ results, dex: 'xyz', source: 'hip3' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
