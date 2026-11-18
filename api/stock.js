/* GET /api/stock?q=<ticker or company name>   → one stock's last year of daily closes
   GET /api/stock?symbols=AAPL,MSFT,...          → several at once (max 15)

   A tiny server-side proxy for Yahoo Finance's public chart data — browsers can't call it
   directly (CORS). The analysis itself (return, volatility, Sharpe, drawdown, score) runs
   in the browser in market.js, mirroring the trading workbook.

   Works as a Vercel serverless function (this file lives in /api) and as Vite dev/preview
   middleware (see vite.config.js). Uses only Node built-ins (Node 18+ global fetch). */

const UA = 'Mozilla/5.0 (portfolio stock model)';
const TTL = 60 * 1000; // one minute: prices stay live during the session without hammering the source
const cache = new Map();

async function getJSON(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) { const err = new Error(`upstream ${res.status}`); err.status = res.status; throw err; }
  const v = await res.json();
  cache.set(url, { t: Date.now(), v });
  return v;
}

async function chart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&includeAdjustedClose=true`;
  const data = await getJSON(url);
  const r = data && data.chart && data.chart.result && data.chart.result[0];
  if (!r || !r.timestamp) { const err = new Error('not found'); err.status = 404; throw err; }
  const adj = r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose;
  const raw = adj || r.indicators.quote[0].close;
  const dates = [], closes = [];
  r.timestamp.forEach((t, i) => {
    if (raw[i] != null) { dates.push(new Date(t * 1000).toISOString().slice(0, 10)); closes.push(Number(raw[i].toFixed(4))); }
  });
  const m = r.meta || {};
  if (closes.length < 30) { const err = new Error('not enough history'); err.status = 422; throw err; }
  return {
    symbol: m.symbol || symbol.toUpperCase(),
    name: m.longName || m.shortName || m.symbol || symbol.toUpperCase(),
    currency: m.currency || 'USD',
    exchange: m.fullExchangeName || m.exchangeName || '',
    type: m.instrumentType || '',
    price: m.regularMarketPrice != null ? m.regularMarketPrice : closes[closes.length - 1],
    prevClose: m.chartPreviousClose != null && closes.length > 1 ? closes[closes.length - 2] : null,
    asOf: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
    dates,
    closes,
  };
}

async function resolve(q) {
  const query = String(q || '').trim().slice(0, 60);
  if (!query) { const err = new Error('empty query'); err.status = 400; throw err; }
  // Looks like a ticker? Try it directly first.
  if (/^[A-Za-z][A-Za-z0-9.\-^=]{0,9}$/.test(query)) {
    try { return await chart(query.toUpperCase()); } catch (e) { if (e.status && e.status !== 404 && e.status !== 422) throw e; }
  }
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
  const found = await getJSON(url);
  const pick = (found.quotes || []).find((x) => x.quoteType === 'EQUITY' || x.quoteType === 'ETF');
  if (!pick) { const err = new Error(`No stock found for “${query}”`); err.status = 404; throw err; }
  return chart(pick.symbol);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=60, max-age=30' : 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  try {
    if (params.get('symbols')) {
      const list = params.get('symbols').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 15);
      const settled = await Promise.allSettled(list.map(chart));
      const results = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
      return send(res, results.length ? 200 : 502, results.length ? { results } : { error: 'Market data unavailable' });
    }
    return send(res, 200, await resolve(params.get('q')));
  } catch (error) {
    const status = error.status === 404 || error.status === 400 || error.status === 422 ? error.status : 502;
    return send(res, status, { error: status === 502 ? 'Market data unavailable right now' : error.message });
  }
};
