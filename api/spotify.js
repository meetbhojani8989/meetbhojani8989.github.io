/* GET /api/spotify → { configured, isPlaying, track: { uri, title, artist, album, art, url } | null, playedAt }

   What Meet is listening to on Spotify right now, or the last song he played.
   Reads three server-side secrets (never sent to the browser):
     SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
   Locally they live in .env.local (run `npm run spotify:connect` once to fill in the token);
   on Vercel they are Project Settings → Environment Variables.
   Until all three are set it answers { configured: false } and the page simply hides the live record.
   Works as a Vercel serverless function and as Vite dev/preview middleware. Node 18+ fetch. */

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1/me/player';
const TTL = 30 * 1000;

let token = '', tokenExp = 0;
let cached = null, cachedAt = 0;

async function accessToken(id, secret, refresh) {
  if (token && Date.now() < tokenExp - 60e3) return token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const j = await res.json();
  token = j.access_token;
  tokenExp = Date.now() + (j.expires_in || 3600) * 1000;
  return token;
}

const trim = (t) => {
  if (!t || t.type !== 'track' || !t.uri) return null;
  const imgs = (t.album && t.album.images) || [];
  const art = (imgs.find((i) => i.width && i.width <= 320) || imgs[0] || {}).url || '';
  return {
    uri: t.uri,
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    album: t.album ? t.album.name : '',
    art,
    url: t.external_urls ? t.external_urls.spotify : '',
  };
};

async function listening(tk) {
  const headers = { Authorization: `Bearer ${tk}` };
  const now = await fetch(`${API}/currently-playing`, { headers });
  if (now.status === 200) {
    const j = await now.json();
    const track = trim(j.item);
    if (track) return { isPlaying: !!j.is_playing, track, playedAt: null };
  }
  const last = await fetch(`${API}/recently-played?limit=1`, { headers });
  if (last.ok) {
    const j = await last.json();
    const it = j.items && j.items[0];
    if (it) return { isPlaying: false, track: trim(it.track), playedAt: it.played_at };
  }
  return { isPlaying: false, track: null, playedAt: null };
}

function send(res, status, body, cacheable) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheable ? 'public, s-maxage=30, max-age=20' : 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) return send(res, 200, { configured: false }, false);
  if (cached && Date.now() - cachedAt < TTL) return send(res, 200, cached, true);
  try {
    const body = { configured: true, ...(await listening(await accessToken(id, secret, refresh))), fetchedAt: new Date().toISOString() };
    cached = body; cachedAt = Date.now();
    send(res, 200, body, true);
  } catch (e) {
    token = '';
    send(res, 502, { configured: true, error: 'spotify unavailable' }, false);
  }
};
