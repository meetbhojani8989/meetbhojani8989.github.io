/* GET /api/preview?track=<Spotify track id> → 302 to Spotify's 30 second preview clip (audio/mpeg).

   The record player uses this as the source of its own <audio> element, so a song starts the moment
   a visitor taps, in every browser, Safari and iPhone included (Spotify's embedded player can't be
   started by a tap on the page in Safari). Spotify's Web API no longer hands preview links to new
   apps, so the link is read from the track's public embed page and cached.
   Works as a Vercel serverless function and as Vite dev/preview middleware. Node 18+ fetch. */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const TTL = 12 * 3600 * 1000;
const MAX = 400;
const cache = new Map();

function fail(res, status, error) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 404 ? 'public, s-maxage=3600, max-age=600' : 'no-store');
  res.end(JSON.stringify({ error }));
}

async function previewFor(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.t < TTL) return hit.url;
  const r = await fetch(`https://open.spotify.com/embed/track/${id}`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!r.ok) throw new Error(`embed ${r.status}`);
  const m = (await r.text()).match(/https:\/\/p\.scdn\.co\/mp3-preview\/[A-Za-z0-9]+/);
  const url = m ? m[0] : '';
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(id, { t: Date.now(), url });
  return url;
}

module.exports = async function handler(req, res) {
  const params = new URL(req.url || '/', 'http://local').searchParams;
  const id = String(params.get('track') || '').replace(/^spotify:track:/, '');
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return fail(res, 400, 'bad track id');
  let url;
  try { url = await previewFor(id); } catch (e) { return fail(res, 502, 'spotify unavailable'); }
  if (!url) return fail(res, 404, 'no preview for this track');
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', 'public, s-maxage=43200, max-age=3600');
  res.end();
};
