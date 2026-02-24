export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path = 'orderBooks', ...params } = req.query;
  const qs = new URLSearchParams(params).toString();
  const url = `https://mainnet.zklighter.elliot.ai/api/v1/${path}${qs ? '?' + qs : ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await response.text();
    if (!text || text.trim() === '') {
      return res.status(200).json({ error: 'Empty response from Lighter API' });
    }
    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
