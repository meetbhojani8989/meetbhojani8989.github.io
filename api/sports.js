/* GET /api/sports → { f1: { live, last, next }, cricket: { live, last, next } }

   Live sports for the Interests page, pulled server-side (the browser can't call some of these
   directly) and trimmed to what the page shows:
   - F1: Jolpica (Ergast-compatible) for the last race result and the next race schedule,
         OpenF1 for whether a session is running right now.
   - Cricket: ESPN's public scorepanel, India and IPL matches only — live now, the latest
         result from the last two weeks (kept even if ESPN hiccups), and the next fixture in the coming week.
   Works as a Vercel serverless function and as Vite dev/preview middleware. Node 18+ fetch. */

const UA = 'Mozilla/5.0 (portfolio interests page)';
const cache = new Map();

/* Upstream feeds (ESPN above all) fail at random, a 502 for one day and fine a second later.
   So: try up to three times, and if every try fails, fall back to the last good copy we have. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url, ttl) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await wait(attempt * 350);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const v = await res.json();
      cache.set(url, { t: Date.now(), v });
      return v;
    } catch (e) { lastErr = e; }
  }
  if (hit) return hit.v;
  throw lastErr;
}

/* ---------- F1 ---------- */
async function f1() {
  const [lastRes, nextRes, sessRes] = await Promise.allSettled([
    getJSON('https://api.jolpi.ca/ergast/f1/current/last/results.json', 10 * 60e3),
    getJSON('https://api.jolpi.ca/ergast/f1/current/next.json', 30 * 60e3),
    getJSON('https://api.openf1.org/v1/sessions?session_key=latest', 60e3),
  ]);
  const out = { live: null, last: null, next: null };
  if (lastRes.status === 'fulfilled') {
    const race = lastRes.value.MRData.RaceTable.Races[0];
    if (race) {
      const fastest = race.Results.find((r) => r.FastestLap && r.FastestLap.rank === '1');
      out.last = {
        name: race.raceName, round: Number(race.round), season: race.season, date: race.date,
        start: race.time ? `${race.date}T${race.time}` : `${race.date}T12:00:00Z`,
        circuit: race.Circuit.circuitName, locality: race.Circuit.Location.locality, country: race.Circuit.Location.country,
        podium: race.Results.slice(0, 3).map((r) => ({
          pos: Number(r.position), code: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(),
          name: `${r.Driver.givenName} ${r.Driver.familyName}`, team: r.Constructor.name,
          time: r.Time ? r.Time.time : r.status,
        })),
        fastest: fastest ? { name: `${fastest.Driver.givenName} ${fastest.Driver.familyName}`, time: fastest.FastestLap.Time && fastest.FastestLap.Time.time } : null,
      };
    }
  }
  if (nextRes.status === 'fulfilled') {
    const race = nextRes.value.MRData.RaceTable.Races[0];
    if (race) {
      const when = (o) => (o && o.date ? `${o.date}T${o.time || '00:00:00Z'}` : null);
      out.next = {
        name: race.raceName, round: Number(race.round), season: race.season,
        circuit: race.Circuit.circuitName, locality: race.Circuit.Location.locality, country: race.Circuit.Location.country,
        start: when(race),
        sessions: [
          ['Practice 1', race.FirstPractice], ['Practice 2', race.SecondPractice], ['Practice 3', race.ThirdPractice],
          ['Sprint Qualifying', race.SprintQualifying || race.SprintShootout], ['Sprint', race.Sprint],
          ['Qualifying', race.Qualifying], ['Race', race],
        ].filter(([, s]) => s && s.date).map(([label, s]) => ({ label, start: when(s) })),
      };
    }
  }
  // Qualifying: the upcoming round's grid once it has run, otherwise the most recent one.
  const qualiFor = async (round) => {
    const d = await getJSON(`https://api.jolpi.ca/ergast/f1/current/${round}/qualifying.json`, 10 * 60e3);
    const race = d.MRData.RaceTable.Races[0];
    if (!race || !race.QualifyingResults || !race.QualifyingResults.length) return null;
    return {
      round: Number(race.round), raceName: race.raceName,
      top: race.QualifyingResults.slice(0, 5).map((q) => ({ pos: Number(q.position), code: q.Driver.code || q.Driver.familyName.slice(0, 3).toUpperCase(), time: q.Q3 || q.Q2 || q.Q1 || '' })),
    };
  };
  try {
    if (out.next) out.quali = await qualiFor(out.next.round);
    if (!out.quali && out.last) out.quali = await qualiFor(out.last.round);
  } catch (e) { out.quali = null; }
  if (sessRes.status === 'fulfilled' && sessRes.value[0]) {
    const s = sessRes.value[0];
    const now = Date.now(), a = Date.parse(s.date_start), b = Date.parse(s.date_end);
    if (now >= a - 5 * 60e3 && now <= b + 15 * 60e3) {
      out.live = { session: s.session_name, place: s.circuit_short_name || s.location, country: s.country_name, start: s.date_start, end: s.date_end };
      // Live timing from OpenF1 (best effort — the free feed may lag or be unavailable mid-session).
      try {
        const [laps, drivers] = await Promise.all([
          getJSON(`https://api.openf1.org/v1/laps?session_key=${s.session_key}`, 20e3),
          getJSON(`https://api.openf1.org/v1/drivers?session_key=${s.session_key}`, 10 * 60e3),
        ]);
        const code = Object.fromEntries(drivers.map((d) => [d.driver_number, d.name_acronym]));
        out.live.lap = laps.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
        const bestBy = {};
        laps.forEach((l) => { if (l.lap_duration && !l.is_pit_out_lap && (!bestBy[l.driver_number] || l.lap_duration < bestBy[l.driver_number])) bestBy[l.driver_number] = l.lap_duration; });
        const fmt = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(3).padStart(6, '0')}`;
        out.live.best = Object.entries(bestBy).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([n, t], i) => ({ pos: i + 1, code: code[n] || `#${n}`, time: fmt(t) }));
      } catch (e) { /* timing unavailable — the LIVE badge still shows */ }
    }
  }
  return out;
}

/* ---------- Cricket ---------- */
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
function shape(ev, league) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp) return null;
  const st = (ev.status && ev.status.type) || {};
  const summary = String((comp.status && comp.status.summary) || st.detail || '').replace(/&amp;/g, '&');
  return {
    id: ev.id, name: ev.name, league, date: ev.date, state: st.state, summary,
    started: st.state === 'in' && !/^Starts at/i.test(summary),
    teams: (comp.competitors || []).map((c) => ({ abbr: c.team && c.team.abbreviation, name: c.team && (c.team.shortDisplayName || c.team.displayName), full: c.team && c.team.displayName, score: c.score || '', winner: c.winner === true || c.winner === 'true' })),
  };
}
// ESPN's undated "today" scorepanel can be served from a stale CDN copy, so every day — today
// included — is requested by explicit date. Today and yesterday (matches crossing midnight UTC)
// refresh every minute; older/future days are cached for 30 minutes.
async function cricketDay(date, fresh) {
  const url = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/scorepanel?lang=en&region=in${date ? `&dates=${date}` : ''}`;
  const data = await getJSON(url, fresh ? 60e3 : 30 * 60e3);
  if (!data || !data.scores) return [];
  const list = [];
  (data.scores || []).forEach((blk) => {
    const league = ((blk.leagues || [])[0] || {}).name || '';
    (blk.events || []).forEach((ev) => { const m = shape(ev, league); if (m) list.push(m); });
  });
  return list;
}
// Only India (senior men's and women's teams) and the IPL.
const isIndiaOrIpl = (m) => /Indian Premier League|\bIPL\b/i.test(m.league) || m.teams.some((t) => /^India( Women)?$/.test(t.full || t.name || ''));
let lastGood = null; /* the newest finished match seen so far, so a bad fetch never blanks the board */
async function cricket() {
  const now = Date.now();
  // dated requests first (today, the last 14 days, the next 6); the undated feed only as a fallback,
  // because the first copy of a match wins when de-duplicating
  const offsets = [0, -1, 1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, 2, 3, 4, 5, 6];
  const results = await Promise.allSettled([
    ...offsets.map((k) => cricketDay(ymd(new Date(now + k * 864e5)), k === 0 || k === -1)),
    cricketDay(null, true),
  ]);
  const all = [];
  const seen = new Set();
  results.forEach((r) => { if (r.status === 'fulfilled') r.value.forEach((m) => { if (!seen.has(m.id) && isIndiaOrIpl(m)) { seen.add(m.id); all.push(m); } }); });
  const live = all.filter((m) => m.started).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 3);
  const found = all.filter((m) => m.state === 'post').sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] || null;
  if (found && (!lastGood || Date.parse(found.date) >= Date.parse(lastGood.date))) lastGood = found;
  const last = lastGood;
  const next = all.filter((m) => m.state === 'pre' || (m.state === 'in' && !m.started)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0] || null;
  return { live, last, next };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=90, max-age=60' : 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const [f, c] = await Promise.allSettled([f1(), cricket()]);
  const body = {
    f1: f.status === 'fulfilled' ? f.value : null,
    cricket: c.status === 'fulfilled' ? c.value : null,
    fetchedAt: new Date().toISOString(),
  };
  send(res, body.f1 || body.cricket ? 200 : 502, body);
};
