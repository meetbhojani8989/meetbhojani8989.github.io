/* One-time: connect Meet's Spotify account to the site.

   1. In the Spotify developer dashboard, create an app with the redirect URI
        http://127.0.0.1:8888/callback
      and tick "Web API".
   2. Paste its Client ID and Client Secret into .env.local (next to package.json).
   3. Run  npm run spotify:connect  and click Agree on Spotify's page.
      The refresh token is written into .env.local for you. Nothing is printed or sent anywhere else.

   The site only asks to read what you are playing now and what you played last. */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const ENV_FILE = path.join(__dirname, '..', '.env.local');
const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-currently-playing user-read-recently-played';

function readEnv() {
  const env = {};
  if (!fs.existsSync(ENV_FILE)) return env;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function writeEnv(key, value) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  const next = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
  fs.writeFileSync(ENV_FILE, next, { mode: 0o600 });
}

const env = readEnv();
const id = env.SPOTIFY_CLIENT_ID;
const secret = env.SPOTIFY_CLIENT_SECRET;
if (!id || !secret) {
  console.error('\nAdd SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local first, then run this again.\n');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  client_id: id, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, state,
});

const page = (title, text) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font:16px/1.5 -apple-system,system-ui,sans-serif;background:#BFE4F8;color:#6B0A17;display:grid;place-items:center;height:100vh;margin:0">
<div style="background:#FFD23F;border:2px solid #1D1D1F;border-radius:22px;padding:28px 34px;box-shadow:0 6px 0 #1D1D1F;max-width:420px">
<h1 style="margin:0 0 8px;font-size:26px;color:#C8102E">${title}</h1><p style="margin:0">${text}</p></div></body>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
  const done = (code, title, text) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page(title, text)); };
  if (url.searchParams.get('state') !== state) return done(400, 'That link has expired', 'Run npm run spotify:connect again.');
  if (url.searchParams.get('error')) { done(400, 'Not connected', 'Spotify said: ' + url.searchParams.get('error')); return finish(1); }
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: REDIRECT }),
    });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) throw new Error(j.error_description || j.error || `status ${r.status}`);
    writeEnv('SPOTIFY_REFRESH_TOKEN', j.refresh_token);
    done(200, 'Spotify connected', 'You can close this tab. The record player will now show what you are listening to.');
    console.log('\nConnected. SPOTIFY_REFRESH_TOKEN was saved to .env.local.');
    console.log('For the live site, add SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN');
    console.log('to your host\'s environment variables (Vercel: Project Settings, Environment Variables).\n');
    finish(0);
  } catch (e) {
    done(500, 'Not connected', 'Spotify refused the request: ' + String(e.message || e));
    console.error('\nSpotify refused the request:', e.message || e, '\n');
    finish(1);
  }
});

function finish(code) { setTimeout(() => { server.close(); process.exit(code); }, 300); }

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nOpening Spotify so you can approve the connection.');
  console.log('If no browser opens, visit this link:\n\n' + authUrl + '\n');
  if (process.platform === 'darwin') execFile('open', [authUrl], () => {});
  else if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', authUrl], () => {});
  else execFile('xdg-open', [authUrl], () => {});
});
server.on('error', (e) => { console.error(`\nCould not listen on 127.0.0.1:${PORT}:`, e.message, '\n'); process.exit(1); });
