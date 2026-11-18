/* Record player on the Interests page, drawn in lines.
   Tap the deck or any record in the crate and it plays, no Spotify buttons involved:
   the needle lifts, the record drops on (in its own colour), the platter spins up, the arm swings
   onto the outer groove, and the song starts the moment the needle touches. The needle creeps
   inward as it plays. Tap the deck again: the song stops, the platter winds down and the arm
   goes back to its rest on the side.
   Sound is Spotify's 30 second preview of each song (see api/preview.js), played by the page
   itself so it starts on a tap in every browser, Safari and iPhone included.
   The first record is Meet's own Spotify: what he is playing now, or played last (api/spotify.js).
   The songs live in interests.html: one .rec button per record. */
(() => {
  const card = document.querySelector('[data-turntable]');
  if (!card || card.dataset.ready) return;
  card.dataset.ready = '1';

  const $ = (sel) => card.querySelector(sel);
  const deck = $('[data-deck]');
  const disc = $('[data-disc]');
  const vinyl = $('[data-vinyl]');
  const arm = $('[data-arm]');
  const shadow = $('[data-arm-shadow]');
  const stateEl = $('[data-deck-state]');
  const timeEl = $('[data-deck-time]');
  const bar = $('[data-deck-progress]');
  const titleEl = $('[data-deck-title]');
  const artistEl = $('[data-deck-artist]');
  const link = $('[data-deck-link]');
  const lbl = $('[data-label-title]');
  const art = $('[data-label-art]');
  const liveRec = card.querySelector('.rec-live');
  const recs = [...card.querySelectorAll('.rec')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RPM = 33.333 * 6; /* degrees per second at 33⅓ */
  const NS = 'http://www.w3.org/2000/svg';
  const idOf = (uri) => String(uri || '').replace(/^spotify:track:/, '');

  /* ---------- the crate ---------- */
  let cur = Math.max(0, recs.findIndex((r) => r.getAttribute('aria-pressed') === 'true'));
  const rec = () => (recs[cur] ? recs[cur].dataset : card.dataset);
  recs.forEach((r) => { r.style.setProperty('--v', r.dataset.vinyl || '#FFFCF2'); r.style.setProperty('--l', r.dataset.label || '#C8102E'); });

  /* the label: the title on one or two lines, sized to sit inside the label's ring */
  function setLabel(title) {
    if (!lbl) return;
    lbl.textContent = '';
    const words = title.split(' ');
    let lines = [title];
    if (title.length > 9 && words.length > 1) {
      let best = null;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
        const w = Math.max(a.length, b.length);
        if (!best || w < best.w) best = { w, lines: [a, b] };
      }
      lines = best.lines;
    }
    const longest = Math.max(...lines.map((l) => l.length));
    const size = Math.min(12, 56 / (longest * 0.6));
    lbl.style.fontSize = size.toFixed(1) + 'px';
    lines.forEach((line, i) => {
      const t = document.createElementNS(NS, 'tspan');
      t.setAttribute('x', '0');
      t.setAttribute('y', String(lines.length === 1 ? -14 : -21 + i * (size + 1)));
      t.textContent = line;
      lbl.appendChild(t);
    });
  }

  function applyRecord(i) {
    cur = i;
    const d = rec();
    card.style.setProperty('--vinyl', d.vinyl || '#FFFCF2');
    card.style.setProperty('--label', d.label || '#C8102E');
    card.style.setProperty('--label-ink', d.ink || '#FFD23F');
    card.style.setProperty('--groove', d.groove || '#1D1D1F');
    /* Meet's live record wears its album art as the label */
    if (art && vinyl) {
      if (d.art) { art.setAttribute('href', d.art); vinyl.classList.add('has-art'); }
      else { art.removeAttribute('href'); vinyl.classList.remove('has-art'); }
    }
    if (titleEl) titleEl.textContent = d.title || '';
    if (artistEl) artistEl.textContent = d.artist || '';
    if (link && d.track) {
      link.href = `https://open.spotify.com/track/${idOf(d.track)}`;
      link.setAttribute('aria-label', `Full song: ${d.title || 'this song'} on Spotify (opens in a new tab)`);
    }
    setLabel(d.title || '');
    recs.forEach((r, k) => r.setAttribute('aria-pressed', String(k === i)));
    ui();
  }

  /* ---------- grooves and the strobe ring: drawn in the page already, built here only if missing ---------- */
  const grooves = $('[data-grooves]');
  if (grooves && !grooves.children.length) {
    for (let k = 0, r = 62; r <= 162; r += 4, k++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', r);
      if (r === 98 || r === 126 || r === 146) c.setAttribute('class', 'gap');
      else if (k % 2) c.setAttribute('class', 'faint');
      grooves.appendChild(c);
    }
  }
  const ticks = $('[data-ticks]');
  if (ticks && !ticks.getAttribute('d')) {
    let d = '';
    for (let i = 0; i < 72; i++) {
      const a = (i * 5 * Math.PI) / 180, r1 = 171, r2 = i % 6 ? 177 : 180;
      d += `M${(r1 * Math.cos(a)).toFixed(1)},${(r1 * Math.sin(a)).toFixed(1)}L${(r2 * Math.cos(a)).toFixed(1)},${(r2 * Math.sin(a)).toFixed(1)}`;
    }
    ticks.setAttribute('d', d);
  }

  /* ---------- geometry, in the drawing's units (viewBox 600 x 420) ---------- */
  const PIVOT = [500, 96], CENTER = [220, 210], NEEDLE = [-27, 263];
  const needleR = (deg) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const x = PIVOT[0] + NEEDLE[0] * c - NEEDLE[1] * s, y = PIVOT[1] + NEEDLE[0] * s + NEEDLE[1] * c;
    return Math.hypot(x - CENTER[0], y - CENTER[1]);
  };
  const angleFor = (r) => { let lo = 0, hi = 60; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (needleR(m) > r) lo = m; else hi = m; } return (lo + hi) / 2; };
  const REST = 0, LEAD_IN = angleFor(157), RUN_OUT = angleFor(80), CLEAR = angleFor(196);

  /* ---------- state ---------- */
  const st = { angle: REST, lift: 0, spin: 0, vel: 0, target: 0 };
  let phase = 'idle'; /* idle, cueing, playing, stopping */
  let note = '';

  /* ---------- sound: Spotify's preview clip, played by the page itself ---------- */
  const audio = new Audio();
  audio.preload = 'none';
  let loaded = '';     /* the track the audio element holds */
  let cueAt = 0;       /* where the needle lands, in seconds */
  let buffering = false, failed = false, blocked = false;

  function load(uri) {
    if (loaded === uri) return;
    loaded = uri;
    failed = false;
    blocked = false;
    audio.src = `/api/preview?track=${encodeURIComponent(idOf(uri))}`;
  }
  /* Runs inside the tap itself. Browsers (Safari above all) only let sound start from a real tap,
     so the clip is started and paused right here, which unlocks it; it then plays for real the
     moment the needle touches the record, a second later. */
  function prime(uri) {
    const fresh = loaded !== uri || audio.ended;
    blocked = false;
    cueAt = fresh ? 0 : audio.currentTime || 0;
    load(uri);
    audio.preload = 'auto';
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    audio.pause();
  }
  function needleDown() {
    try { audio.currentTime = cueAt; } catch (e) { /* not loaded yet: it starts from the top anyway */ }
    const p = audio.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name === 'AbortError') return; blocked = !!e && e.name === 'NotAllowedError'; failed = !blocked; stop(true); });
    media();
  }
  const dur = () => (audio.duration && isFinite(audio.duration) ? audio.duration : 0);
  const shown = () => (phase === 'cueing' ? cueAt : audio.currentTime || 0);
  const progress = () => (dur() ? Math.min(1, shown() / dur()) : 0);
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  audio.addEventListener('ended', () => { if (phase === 'playing' || phase === 'cueing') stop(true); });
  audio.addEventListener('waiting', () => { buffering = true; ui(); });
  audio.addEventListener('playing', () => { buffering = false; ui(); });
  /* paused from outside the page (headphones, lock screen): the deck follows */
  audio.addEventListener('pause', () => { if (phase === 'playing' && !audio.ended) stop(true); });
  audio.addEventListener('error', () => { if (!loaded) return; failed = true; if (phase === 'cueing' || phase === 'playing') stop(true); else ui(); });

  /* the phone's lock screen and control centre show what is playing */
  function media() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    const d = rec();
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: d.title || '', artist: d.artist || '', album: 'Meet’s record player', artwork: d.art ? [{ src: d.art, sizes: '300x300' }] : [] });
    } catch (e) { /* older browsers */ }
  }

  /* ---------- a tiny tween engine: one tween per property, a new one cancels the old ---------- */
  const tweens = {};
  const ease = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
  };
  function tween(prop, to, ms, fn = ease.inOut) {
    if (tweens[prop]) { const old = tweens[prop]; delete tweens[prop]; old.done(false); }
    if (reduced || ms <= 0) { st[prop] = to; render(); return Promise.resolve(true); }
    return new Promise((done) => { tweens[prop] = { from: st[prop], to, t0: performance.now(), ms, fn, done }; wake(); });
  }

  /* lift, swing, lower. Any newer move cancels this one part way, so rapid taps never fight. */
  let seq = 0;
  async function armTo(angle, lower = true) {
    const my = ++seq;
    const far = Math.abs(angle - st.angle);
    if (!(await tween('lift', 1, 220, ease.out)) || my !== seq) return false;
    if (!(await tween('angle', angle, 420 + far * 16)) || my !== seq) return false;
    if (!lower) return true;
    if (!(await tween('lift', 0, 340, ease.out)) || my !== seq) return false;
    return true;
  }

  let pick = 0; /* bumps whenever the listener does something new, so stale moves give up */

  /* call prime() in the same tap first */
  async function start() {
    if (phase === 'cueing' || phase === 'playing') return;
    const my = ++pick;
    phase = 'cueing'; note = ''; ui();
    st.target = RPM; wake(); /* the platter gets going while the arm travels */
    const at = LEAD_IN + (RUN_OUT - LEAD_IN) * (dur() ? Math.min(1, cueAt / dur()) : 0);
    const down = await armTo(at);
    if (!down || my !== pick || phase !== 'cueing') return;
    phase = 'playing'; ui();
    needleDown(); wake();
  }

  async function stop(fromAudio) {
    if (phase === 'idle' || phase === 'stopping') return;
    ++pick;
    phase = 'stopping'; note = ''; ui();
    if (!fromAudio) audio.pause();
    st.target = 0; wake(); /* the record winds down while the arm goes home */
    const home = await armTo(REST);
    if (home && phase === 'stopping') { phase = 'idle'; ui(); }
  }

  /* the old record lifts off the platter (grows toward you and fades), the new one drops on */
  let swapAnims = [];
  const settle = (a, ms) => Promise.race([a.finished.catch(() => {}), new Promise((r) => setTimeout(r, ms + 120))]);
  async function swapVinyl(i) {
    swapAnims.forEach((a) => a.cancel());
    swapAnims = [];
    if (reduced || !vinyl || !vinyl.animate) { applyRecord(i); return; }
    const off = vinyl.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.12)', opacity: 0 }], { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    swapAnims.push(off);
    await settle(off, 280);
    applyRecord(i);
    const on = vinyl.animate([{ transform: 'scale(1.16)', opacity: 0 }, { transform: 'scale(.985)', opacity: 1, offset: 0.75 }, { transform: 'scale(1)', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    swapAnims.push(on);
    await settle(on, 480);
    off.cancel(); on.cancel();
    swapAnims = [];
  }

  async function choose(i) {
    if (i === cur) { if (phase === 'idle' || phase === 'stopping') { prime(rec().track); start(); } return; }
    const my = ++pick;
    /* the old song stops the instant you pick; the new one is unlocked inside this tap */
    prime(recs[i].dataset.track);
    phase = 'cueing'; note = 'Changing the record'; ui();
    st.target = RPM; wake();
    /* get the needle off the record first */
    if (st.angle > CLEAR - 0.5 || st.lift < 1) { if (!(await armTo(Math.min(st.angle, CLEAR), false)) || my !== pick) return; }
    await swapVinyl(i);
    if (my !== pick) return;
    note = ''; ui(); render();
    const down = await armTo(LEAD_IN);
    if (!down || my !== pick || phase !== 'cueing') return;
    phase = 'playing'; ui();
    needleDown(); wake();
  }

  deck.addEventListener('click', () => {
    if (phase === 'idle' || phase === 'stopping') { prime(rec().track); start(); } else stop(false);
  });
  recs.forEach((r, i) => r.addEventListener('click', () => choose(i)));
  /* a little tease on hover: the arm lifts a touch, ready to go */
  if (matchMedia('(hover: hover)').matches) {
    deck.addEventListener('pointerenter', () => { if (phase === 'idle' && !tweens.angle) tween('lift', 0.35, 260, ease.out); });
    deck.addEventListener('pointerleave', () => { if (phase === 'idle' && !tweens.angle) tween('lift', 0, 300, ease.out); });
  }
  /* start fetching the clip on the record that's on the deck once someone heads for it */
  const warm = () => { if (!loaded && rec().track) { audio.preload = 'auto'; load(rec().track); } };
  card.addEventListener('pointerenter', warm, { once: true });
  card.addEventListener('focusin', warm, { once: true });

  /* ---------- Meet's own Spotify: what he is playing now, or played last (see api/spotify.js) ---------- */
  const liveTitle = liveRec && liveRec.querySelector('[data-live-title]');
  const liveWhen = liveRec && liveRec.querySelector('[data-live-when]');
  const ago = (iso) => {
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!(m >= 0)) return 'recently';
    if (m < 60) return `${Math.max(1, m)} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} d ago`;
  };
  async function fetchLive() {
    if (!liveRec || document.hidden) return;
    try {
      const r = await fetch('/api/spotify', { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const j = await r.json();
      const t = j && j.track;
      if (!j.configured || !t || !/^spotify:track:[A-Za-z0-9]{22}$/.test(t.uri || '')) return;
      const safeArt = /^https:\/\/(i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\/[\w/.-]+$/.test(t.art || '') ? t.art : '';
      const d = liveRec.dataset;
      const changed = d.track !== t.uri;
      d.track = t.uri; d.title = t.title || 'Untitled'; d.artist = t.artist || ''; d.art = safeArt;
      liveRec.style.setProperty('--art', safeArt ? `url("${safeArt}")` : 'none');
      liveTitle.textContent = d.title;
      liveWhen.textContent = j.isPlaying ? 'Meet, live now' : j.playedAt ? `Meet, ${ago(j.playedAt)}` : 'Meet’s Spotify';
      liveRec.classList.toggle('is-live', !!j.isPlaying);
      liveRec.setAttribute('aria-label', `${d.title}${d.artist ? ' by ' + d.artist : ''}, ${j.isPlaying ? 'playing on Meet’s Spotify right now' : 'last played on Meet’s Spotify'}`);
      liveRec.hidden = false;
      /* his record is on the deck with the needle up: show the new song on it */
      if (changed && recs[cur] === liveRec && phase === 'idle') { applyRecord(cur); render(); }
    } catch (e) { /* offline or not connected: the live record stays hidden */ }
  }
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  if (document.readyState === 'complete') idle(fetchLive); else addEventListener('load', () => idle(fetchLive), { once: true });
  if (liveRec) {
    setInterval(fetchLive, 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchLive(); });
  }

  /* ---------- drawing ---------- */
  let lastArm = '', lastSpin = NaN, lastText = '', lastBar = -1;
  function render() {
    const a = st.angle.toFixed(2);
    const armT = `translate(${PIVOT[0]} ${PIVOT[1]}) rotate(${a}) scale(${(1 + st.lift * 0.035).toFixed(4)})`;
    if (armT !== lastArm) {
      lastArm = armT;
      arm.setAttribute('transform', armT);
      shadow.setAttribute('transform', `translate(${(PIVOT[0] + 2 + st.lift * 9).toFixed(2)} ${(PIVOT[1] + 3 + st.lift * 12).toFixed(2)}) rotate(${a})`);
    }
    if (st.spin !== lastSpin) { lastSpin = st.spin; disc.style.transform = `rotate(${st.spin.toFixed(2)}deg)`; }
    const p = Math.round(progress() * 1000) / 1000;
    if (p !== lastBar) { lastBar = p; bar.style.transform = `scaleX(${p})`; }
    const txt = dur() ? `${fmt(shown())} / ${fmt(dur())}` : '0:00';
    if (txt !== lastText) { lastText = txt; timeEl.textContent = txt; }
  }

  function ui() {
    const on = phase === 'cueing' || phase === 'playing';
    const d = rec();
    card.classList.toggle('is-playing', phase === 'playing');
    card.classList.toggle('is-cueing', phase === 'cueing');
    deck.setAttribute('aria-pressed', String(on));
    deck.setAttribute('aria-label', `${on ? 'Stop' : 'Play'} ${d.title || 'the record'}${d.artist ? ' by ' + d.artist : ''}`);
    const words = {
      idle: blocked ? 'Tap the record again' : failed ? 'No preview for this one' : 'Needle up',
      cueing: note || 'Dropping the needle',
      playing: buffering ? 'Loading' : 'Now playing',
      stopping: 'Lifting the needle',
    };
    stateEl.textContent = words[phase];
  }

  /* one loop, running only while something moves */
  let raf = 0, last = 0, visible = true;
  function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    let busy = false;
    for (const k of Object.keys(tweens)) {
      const tw = tweens[k];
      const t = Math.min(1, (now - tw.t0) / tw.ms);
      st[k] = tw.from + (tw.to - tw.from) * tw.fn(t);
      if (t >= 1) { delete tweens[k]; tw.done(true); } else busy = true;
    }
    /* the platter eases to speed like a direct drive motor, and coasts a little longer to a stop */
    if (!reduced) {
      const tau = st.target > st.vel ? 0.45 : 0.85;
      st.vel += (st.target - st.vel) * (1 - Math.exp(-dt / tau));
      if (st.target === 0 && st.vel < 1) st.vel = 0;
      st.spin = (st.spin + st.vel * dt) % 360;
      if (st.vel) busy = true;
    }
    /* the needle follows the groove inward as the song plays */
    if (phase === 'playing' && !tweens.angle && !tweens.lift) {
      const goal = LEAD_IN + (RUN_OUT - LEAD_IN) * progress();
      st.angle = reduced ? goal : st.angle + (goal - st.angle) * Math.min(1, dt * 4);
      busy = true;
    }
    render();
    if (busy && (visible || Object.keys(tweens).length)) raf = requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) wake(); }).observe(card);
  }

  applyRecord(cur);
  render();

  /* localhost only: lets the preview drive the deck when rAF is paused in a hidden pane */
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.__deck = { st, audio, get phase() { return phase; }, get cur() { return cur; }, frame: (t) => frame(t || performance.now()), live: fetchLive, angles: { REST, LEAD_IN, RUN_OUT, CLEAR } };
  }
})();
