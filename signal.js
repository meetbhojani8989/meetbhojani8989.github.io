/* Signal v2: motion and live data for the home page. Vanilla JS, no dependencies.
   market.js (optional, loaded first) supplies the same scoring maths as the trading workbook.
   html.story = pinned scroll scenes; without it everything renders in its final, readable state. */
(() => {
  window.__signalReady = true;
  const root = document.documentElement;
  const story = root.classList.contains('story');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (p, a, b) => clamp((p - a) / (b - a));
  const win = (p, a, b, c, d) => Math.min(range(p, a, b), 1 - range(p, c, d));
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const seeded = (seed) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const pinProgress = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const pct = (v, sign) => `${v < 0 ? '−' : sign && v > 0 ? '+' : ''}${Math.abs(v * 100).toFixed(1)}%`; // a true minus sign, not a hyphen
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // split a price series into two SVG paths: the days it rose (green) and the days it fell (red)
  function splitPath(c, X, Y) {
    let up = '', down = '';
    for (let i = 1; i < c.length; i++) {
      const seg = `M${X(i - 1).toFixed(2)},${Y(c[i - 1]).toFixed(2)}L${X(i).toFixed(2)},${Y(c[i]).toFixed(2)}`;
      if (c[i] >= c[i - 1]) up += seg; else down += seg;
    }
    return { up: up || 'M0,0', down: down || 'M0,0' };
  }
  let kick = () => {};

  /* ---------- Page change stripes, shared with the Projects and Interests pages ----------
     Leaving: five stripes rise and name the destination, then the next page loads underneath.
     Arriving: the page starts covered (html.arriving) and the stripes lift away. */
  const arrivingLabel = (() => { try { const l = sessionStorage.getItem('signal-wipe'); sessionStorage.removeItem('signal-wipe'); return l; } catch (e) { return null; } })();
  const pw = document.createElement('div');
  pw.className = 's-pw';
  pw.setAttribute('aria-hidden', 'true');
  pw.innerHTML = `<div class="s-pw-st">${'<b></b>'.repeat(5)}</div><span></span><i></i>`;
  document.body.appendChild(pw);
  const PAGES = { 'projects.html': 'Projects', 'interests.html': 'Interests', 'amazon.html': 'Amazon Valuation', 'portfolio.html': 'Portfolio Analytics', 'intelligence.html': 'Amber' };
  const pwTimers = [];
  if (arrivingLabel && !still) {
    $('span', pw).textContent = arrivingLabel;
    pw.className = 's-pw cover instant';
    // timers rather than animation frames, so the lift can never stall (a background tab, a hidden window)
    pwTimers.push(
      setTimeout(() => { root.classList.remove('arriving'); pw.className = 's-pw cover'; }, 30),
      setTimeout(() => { pw.className = 's-pw cover lift'; }, 230),
      setTimeout(() => { pw.className = 's-pw instant'; }, 1300),
      setTimeout(() => { pw.className = 's-pw'; }, 1360),
    );
  }
  else root.classList.remove('arriving');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || still || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.origin !== location.origin || a.hasAttribute('download') || a.target === '_blank') return;
    const file = a.pathname.split('/').pop();
    if (!PAGES[file]) return;
    e.preventDefault();
    pwTimers.forEach(clearTimeout); // a click during the arrival lift takes over cleanly
    root.classList.remove('arriving');
    $('span', pw).textContent = PAGES[file];
    pw.className = 's-pw cover';
    setTimeout(() => { try { sessionStorage.setItem('signal-wipe', PAGES[file]); } catch (err) { /* ignore */ } location.href = a.href; }, 820);
  });

  /* ---------- Boot: a short data load on the first visit of a session ---------- */
  const boot = $('.s-boot');
  let finishBoot = () => {};
  const booted = new Promise((resolve) => { finishBoot = resolve; });
  (function runBoot() {
    let seen = false;
    try { seen = sessionStorage.getItem('signal-boot') === '1'; sessionStorage.setItem('signal-boot', '1'); } catch (e) { /* private mode */ }
    // skip the intro when the visit is aimed at a section (index.html#experience from another page)
    if (!boot || !story || seen || still || location.hash.length > 1 || arrivingLabel) { if (boot) boot.remove(); finishBoot(); return; }
    root.classList.add('booting');
    const n = $('[data-boot]', boot), bar = $('.s-boot-bar b', boot);
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      boot.classList.add('done');
      root.classList.remove('booting');
      setTimeout(() => boot.remove(), 1100);
      finishBoot();
    };
    const t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const k = easeIO(clamp((t - t0) / dur));
      n.textContent = Math.round(k * (dots.length || 2500)).toLocaleString('en-US');
      bar.style.transform = `scaleX(${k.toFixed(3)})`;
      if (k < 1) requestAnimationFrame(step); else setTimeout(end, 180);
    };
    requestAnimationFrame(step);
    setTimeout(end, 3200); // never hold the page hostage
  }());

  /* ---------- Nav, sheet, market clock ---------- */
  const menu = $('.s-menu'), sheet = $('#s-sheet');
  const closeSheet = () => { sheet.hidden = true; menu.setAttribute('aria-expanded', 'false'); menu.textContent = 'Menu'; };
  menu.addEventListener('click', () => { if (!sheet.hidden) { closeSheet(); return; } sheet.hidden = false; menu.setAttribute('aria-expanded', 'true'); menu.textContent = 'Close'; });
  sheet.addEventListener('click', (e) => { if (e.target.closest('a, button')) closeSheet(); });
  const navLinks = $$('.s-links a[href^="#"]').map((a) => ({ a, sec: $(a.hash) })).filter((n) => n.sec);
  const nav = $('.s-nav'), lens = $('.s-lens');
  let activeLink = null, hoverLink = null;
  // a glass droplet slides under the active (or hovered) link, like the iOS tab bar
  function placeLens() {
    const a = hoverLink || activeLink;
    if (!lens) return;
    if (!a || !a.offsetParent) { lens.classList.remove('on'); return; }
    const nr = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
    lens.style.width = `${r.width}px`;
    lens.style.transform = `translateX(${(r.left - nr.left).toFixed(1)}px)`;
    lens.classList.add('on');
  }
  $$('.s-links a').forEach((a) => {
    a.addEventListener('pointerenter', () => { hoverLink = a; placeLens(); });
    a.addEventListener('pointerleave', () => { hoverLink = null; placeLens(); });
  });

  // NYSE hours (9:30 to 16:00 New York time, weekdays, minus full-day holidays; early closes ignored)
  const HOLIDAYS = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
    '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24']);
  const hm = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  function market() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`, mins = Number(parts.hour) * 60 + Number(parts.minute);
    const session = !['Sat', 'Sun'].includes(parts.weekday) && !HOLIDAYS.has(day);
    if (session && mins >= 570 && mins < 960) return { open: true, text: `NYSE open · closes in ${hm(960 - mins)}` };
    if (session && mins < 570) return { open: false, text: `NYSE closed · opens in ${hm(570 - mins)}` };
    return { open: false, text: 'NYSE closed · opens next session' };
  }
  const clocks = $$('[data-clock]');
  const tickClock = () => { const m = market(); clocks.forEach((c) => { c.textContent = m.text; c.classList.toggle('open', m.open); }); };
  tickClock();
  setInterval(tickClock, 30000);

  /* ---------- Copy email ---------- */
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy); } catch (e) { location.href = `mailto:${btn.dataset.copy}`; return; }
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 2200);
  }));

  /* ---------- Contact form: Web3Forms forwards each message to my inbox ---------- */
  const form = $('[data-message]');
  if (form) {
    const status = $('.s-form-status', form), send = $('button[type="submit"]', form);
    const say = (text, kind = '') => { status.textContent = text; status.className = `s-form-status ${kind}`; };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = Object.fromEntries(new FormData(form));
      if (fields.botcheck) return; /* a bot filled the hidden field */
      const missing = ['name', 'email', 'message'].find((k) => !String(fields[k] || '').trim());
      if (missing) { say(`Please add your ${missing}.`, 'err'); form.elements[missing].focus(); return; }
      if (!form.elements.email.checkValidity()) { say('That email address doesn’t look right.', 'err'); form.elements.email.focus(); return; }
      send.disabled = true;
      say('Sending…');
      window.dispatchEvent(new Event('signal:sending')); /* the plane flies off the page straight away */
      /* if the mail service is slow, say so after a few seconds, and give up after 30 rather than hang */
      const slow = setTimeout(() => say('Still sending, the mail service is slow today…'), 6000);
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const giveUp = ctrl && setTimeout(() => ctrl.abort(), 30000);
      try {
        /* a plain form post (no JSON body) skips the browser's extra CORS handshake */
        const res = await fetch(form.action, {
          method: 'POST', headers: { Accept: 'application/json' }, body: new URLSearchParams(fields), signal: ctrl ? ctrl.signal : undefined,
        });
        /* only the mail service's own "success" counts as delivered, not just a 200 reply */
        const reply = await res.json().catch(() => ({}));
        if (!res.ok || String(reply.success) !== 'true') throw new Error(reply.message || `send failed (${res.status})`);
        form.reset();
        say('Thanks, your message is on its way. I’ll reply soon.', 'ok');
        window.dispatchEvent(new Event('signal:sent'));
      } catch (err) {
        console.warn('Message not sent:', err && err.message);
        window.dispatchEvent(new Event('signal:send-failed'));
        say(err && err.name === 'AbortError'
          ? 'The mail service didn’t answer. Please email me directly at meetbhojani8989@gmail.com.'
          : 'That didn’t go through. Please email me directly at meetbhojani8989@gmail.com.', 'err');
      } finally {
        clearTimeout(slow); if (giveUp) clearTimeout(giveUp);
        send.disabled = false;
      }
    });
  }

  /* ---------- Type: decoding labels and masked headings ---------- */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function decode(el) {
    if (still || el.dataset.decoded || el.children.length) return;
    el.dataset.decoded = '1';
    const final = el.textContent;
    el.setAttribute('aria-label', final);
    const t0 = performance.now(), dur = 650 + final.length * 12;
    const step = (t) => {
      const k = clamp((t - t0) / dur), shown = Math.floor(k * final.length);
      el.textContent = [...final].map((c, i) => (i < shown || c === ' ' || c === '·' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
      if (k < 1) requestAnimationFrame(step); else el.textContent = final;
    };
    requestAnimationFrame(step);
  }
  // wrap each word in a mask so it can rise into view; inline tags like <em> are kept
  function mask(el) {
    let i = 0;
    const walk = (node) => [...node.childNodes].forEach((child) => {
      if (child.nodeType === 1) { walk(child); return; }
      if (child.nodeType !== 3 || !child.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const m = document.createElement('span'); m.className = 's-wm';
        const w = document.createElement('span'); w.className = 's-wi'; w.textContent = part; w.style.setProperty('--i', i++);
        m.appendChild(w); frag.appendChild(m);
      });
      child.replaceWith(frag);
    });
    walk(el);
    el.classList.add('s-masked');
  }
  const heroName = $('.s-name');
  if (story) {
    $$('.s-h2, .s-talk, .s-name').forEach((el) => { el.removeAttribute('data-rise'); mask(el); });
    booted.then(() => setTimeout(() => heroName.classList.add('in'), 120));
  }

  /* ---------- Counters and reveals ---------- */
  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const to = Number(el.dataset.count), from = Number(el.dataset.from || 0);
    const dec = (el.dataset.count.split('.')[1] || '').length, pre = el.dataset.prefix || '';
    if (still) { el.textContent = pre + to.toFixed(dec); return; }
    const t0 = performance.now(), dur = to > 1000 ? 1400 : 1700;
    const step = (t) => {
      const k = easeOut(clamp((t - t0) / dur));
      el.textContent = pre + (from + (to - from) * k).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = pre + from.toFixed(dec);
    requestAnimationFrame(step);
  }
  const tiles = $$('[data-tile]');
  tiles.forEach((el, k) => { el.style.transitionDelay = `${(k % 3) * 90}ms`; });
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    $$('[data-count]', el).forEach(countUp);
    $$('.s-kicker, .s-tag', el).forEach(decode);
    if (el.matches('.s-kicker, .s-tag')) decode(el);
    if (el.matches('[data-tile]')) setTimeout(() => { el.style.transitionDelay = ''; }, 1400);
    io.unobserve(el);
  }), { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('[data-rise], [data-tile], .s-masked:not(.s-name), .s-kicker, .s-exp .s-tag').forEach((el) => io.observe(el));

  // About: the paragraph brightens word by word as it is read
  const read = $('[data-read]');
  let words = [];
  if (read) {
    read.innerHTML = read.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    words = $$('.w', read);
    if (!story) words.forEach((w) => w.classList.add('lit'));
  }

  /* ---------- Scrolling stays native (the browser's own scrolling is the smoothest there is) ----------
     A wheel turn simply cancels a menu glide in progress; during the short warp the wheel waits. */
  const glide = null, syncGlide = () => {};
  let travelling = false;
  addEventListener('wheel', (e) => { if (warping) e.preventDefault(); else travelling = false; }, { passive: false });
  addEventListener('touchstart', () => { travelling = false; }, { passive: true });

  /* ---------- Menu jumps: a short eased glide, or for long trips a frosted-glass curtain "warp" ---------- */
  const SECTIONS = { top: ['00', 'Top'], about: ['01', 'About'], snapshot: ['01', 'The 30 second summary'], career: ['02', 'Career'], work: ['03', 'Work'], experience: ['04', 'Experience'], contact: ['05', 'Contact'], message: ['05', 'Write to me'] };
  const warpEl = document.createElement('div');
  warpEl.className = 's-warp';
  warpEl.setAttribute('aria-hidden', 'true');
  warpEl.innerHTML = `<div class="s-warp-cols">${'<i></i>'.repeat(6)}</div><div class="s-warp-label"><p class="s-warp-k"><span></span><i></i></p><p class="s-warp-t"><span></span></p><p class="s-warp-bar"><i></i></p></div>`;
  document.body.appendChild(warpEl);
  let warping = false;
  const quint = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
  function easedScroll(y, ms) {
    const y0 = scrollY, d = y - y0, t0 = performance.now();
    travelling = true;
    const step = (t) => {
      if (!travelling) { syncGlide(scrollY); return; }
      const k = clamp((t - t0) / ms);
      window.scrollTo({ top: y0 + d * quint(k), behavior: 'instant' });
      if (k < 1) requestAnimationFrame(step); else { travelling = false; syncGlide(scrollY); }
    };
    requestAnimationFrame(step);
  }
  function warp(y, id) {
    const [num, name] = SECTIONS[id] || ['', id];
    warping = true;
    syncGlide(scrollY);
    $('.s-warp-k span', warpEl).textContent = `Section ${num}`;
    $('.s-warp-k i', warpEl).textContent = `${Math.round(Math.abs(y - scrollY)).toLocaleString('en-US')} px`;
    $('.s-warp-t span', warpEl).textContent = name;
    warpEl.className = 's-warp in';                 // six glass panes rise in a wave and cover the page
    setTimeout(() => {
      window.scrollTo({ top: y, behavior: 'instant' }); // the jump happens behind the glass
      syncGlide(y);
      kick();
    }, 640);
    setTimeout(() => { warpEl.className = 's-warp in out'; }, 980);  // and lift away to reveal where you landed
    setTimeout(() => { warpEl.className = 's-warp reset'; warping = false; requestAnimationFrame(() => { warpEl.className = 's-warp'; }); }, 1800);
  }
  function travel(y, id) {
    if (warping) return;
    const dist = Math.abs(y - scrollY);
    if (still || dist < 2) { window.scrollTo({ top: y, behavior: 'instant' }); syncGlide(y); return; }
    if (dist > innerHeight * 1.6) warp(y, id);
    else easedScroll(y, clamp(dist * 0.9, 520, 950));
  }

  document.addEventListener('click', (e) => {
    // "#about" and "index.html#about" both mean a section of this page: glide there, no reload
    const a = e.target.closest('a[href*="#"]');
    if (!a || a.classList.contains('s-skip') || !a.hash) return;
    const home = /\/(index\.html)?$/;
    if (a.origin !== location.origin || !(a.pathname === location.pathname || (home.test(a.pathname) && home.test(location.pathname)))) return;
    const dest = a.hash === '#top' ? document.body : $(a.hash);
    if (!dest) return;
    e.preventDefault();
    const y = a.hash === '#top' ? 0 : dest.getBoundingClientRect().top + scrollY;
    travel(y, a.hash.slice(1));
    history.replaceState(null, '', a.hash);
  });

  /* ---------- 01 Hero: a 3D cloud of a year of daily moves flattens into my model's pick ---------- */
  const hero = $('.s-hero'), canvas = $('.s-noise'), ctx = canvas.getContext('2d');
  const stage = { a: $('.st-a'), b: $('.st-b'), c: $('.st-c'), d: $('.st-d') };
  const scanLabel = $('.s-scan-label'), cross = $('.s-cross'), hud = $('.s-hud');
  const endTag = document.createElement('p');
  endTag.className = 's-endtag';
  endTag.setAttribute('aria-hidden', 'true');
  canvas.parentElement.appendChild(endTag);
  const UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA', 'JPM', 'XOM', 'JNJ', 'KO', 'AMZN'];
  let W = 0, H = 0, dots = [], line = [], heroP = story ? 0 : 1, heroTarget = heroP, drift = 0, hoverX = null, pickNow = null;
  let data = UNIVERSE.map((symbol, s) => {
    const r = seeded(11 + s * 7);
    let p = 100;
    const closes = [p];
    for (let i = 1; i < 252; i++) { p *= 1 + (r() - 0.47) * 0.035; closes.push(p); }
    return { symbol, closes, final: closes[251] / closes[0], sample: true };
  });
  const ranked = () => [...data].sort((a, b) => b.final - a.final);

  function layout() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    if (!W || !H) return;
    const dpr = Math.min(1.5, devicePixelRatio || 1); // 1.5x looks identical for 2px dots and costs far less
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pick = ranked()[0];
    pickNow = pick;
    const len = Math.min(...data.map((d) => d.closes.length));
    const x0 = W * 0.06, x1 = W * 0.94;
    const band = story ? [0.5, 0.86] : [0.1, 0.9];
    const pc = pick.closes.slice(-len);
    const lo = Math.min(...pc), hi = Math.max(...pc);
    line = pc.map((c, i) => [x0 + (i / (len - 1)) * (x1 - x0), H * (band[1] - ((c - lo) / (hi - lo || 1)) * (band[1] - band[0]))]);
    line.dates = (pick.dates || []).slice(-len);
    line.closes = pc;
    const rnd = seeded(5);
    dots = [];
    data.forEach((d) => {
      const c = d.closes.slice(-len);
      for (let i = 1; i < len; i++) {
        const r = c[i] / c[i - 1] - 1;
        const nx = line[i][0] + (rnd() - 0.5) * 6;
        const ny = H * (0.52 + clamp(r, -0.15, 0.15) * 5.5 + (rnd() - 0.5) * 0.22); // wider where returns are wilder
        const nz = (rnd() - 0.5) * W * 0.55; // depth: the cloud is a volume until it resolves
        const calm = story ? clamp(Math.hypot((nx - W / 2) / (W * 0.36), (ny - H / 2) / (H * 0.24)), 0.3, 1) : 1;
        dots.push({ nx, ny, nz, tx: line[i][0], ty: line[i][1], up: r >= 0, calm });
      }
    });
    const pts = $('[data-points]');
    if (pts) pts.textContent = dots.length.toLocaleString('en-US');
    const hc = $('[data-hud-count]');
    if (hc) hc.textContent = `${data.length} stocks · ${dots.length.toLocaleString('en-US')} moves${pick.sample ? '' : ' · live'}`;
    drawHero(heroP);
  }

  function drawHero(p) {
    ctx.clearRect(0, 0, W, H);
    if (!line.length) return;
    const x0 = line[0][0], x1 = line[line.length - 1][0];
    const s = story ? range(p, 0.4, 0.76) : 1;
    const band = W * 0.14;
    const front = x0 - band + s * (x1 - x0 + 2 * band);
    const base = story ? 0.24 + 0.5 * range(p, 0.1, 0.22) : 0.5;
    // the camera: tilted into the cloud at first, turning flat to face the chart as you scroll
    const flat = story ? easeIO(range(p, 0.22, 0.46)) : 1;
    const yaw = (1 - flat) * (-0.62 + Math.sin(drift) * 0.1 + (story ? p * 0.9 : 0));
    const pitch = (1 - flat) * (0.34 + Math.cos(drift * 0.8) * 0.05);
    const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
    const cx = W / 2, cy = H * 0.52, f = W * 0.95;
    // dots are batched by colour and one of six opacity levels: a handful of fills instead of 2,500
    const groups = [0, 1, 2].map(() => [[], [], [], [], [], []]);
    for (const d of dots) {
      const e = easeIO(clamp((front - d.nx) / band));
      const a0 = base * d.calm * (1 - e * 0.92);
      if (a0 < 0.01) continue;
      const X = d.nx + (d.tx - d.nx) * e - cx, Y = d.ny + (d.ty - d.ny) * e - cy, Z = d.nz * (1 - e);
      const x1r = X * cY - Z * sY, z1 = X * sY + Z * cY;
      const y1r = Y * cP - z1 * sP, z2 = Y * sP + z1 * cP;
      const k = f / (f + z2);
      const level = Math.min(5, Math.floor(Math.min(1, a0 * clamp(k, 0.45, 1.25)) * 6));
      groups[e > 0.55 ? 2 : d.up ? 0 : 1][level].push(cx + x1r * k, cy + y1r * k, 2.6 * clamp(k, 0.6, 1.5));
    }
    ['#1E8E5A', '#D0453B', '#1D1D1F'].forEach((fill, c) => {
      ctx.fillStyle = fill;
      groups[c].forEach((g, level) => {
        if (!g.length) return;
        ctx.globalAlpha = (level + 0.5) / 6;
        ctx.beginPath();
        for (let i = 0; i < g.length; i += 3) { const r = g[i + 2]; ctx.rect(g[i] - r / 2, g[i + 1] - r / 2, r, r); }
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
    // the signal: drawn up to the scan front, with a soft wash underneath
    const xl = Math.min(x1, front - band * 0.55);
    if (xl > x0) {
      // every day's step is coloured by its move: green when the close rose, red when it fell
      const area = new Path2D(), up = new Path2D(), down = new Path2D();
      area.moveTo(line[0][0], line[0][1]);
      let endX = line[0][0];
      for (let i = 1; i < line.length; i++) {
        const [px, py] = line[i - 1], [qx, qy] = line[i];
        const seg = line.closes[i] >= line.closes[i - 1] ? up : down;
        seg.moveTo(px, py);
        if (qx > xl) { const k = (xl - px) / (qx - px); const yy = py + (qy - py) * k; seg.lineTo(xl, yy); area.lineTo(xl, yy); endX = xl; break; }
        seg.lineTo(qx, qy); area.lineTo(qx, qy); endX = qx;
      }
      area.lineTo(endX, H); area.lineTo(x0, H); area.closePath();
      const wash = ctx.createLinearGradient(0, H * 0.4, 0, H);
      wash.addColorStop(0, 'rgba(29, 29, 31, .06)'); wash.addColorStop(1, 'rgba(29, 29, 31, 0)');
      ctx.fillStyle = wash; ctx.fill(area);
      ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#1E8E5A'; ctx.stroke(up);
      ctx.strokeStyle = '#D0453B'; ctx.stroke(down);
    }
    if (story && s > 0 && s < 1) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#1D1D1F';
      ctx.fillRect(xl, H * 0.3, 1, H * 0.62);
      ctx.globalAlpha = 1;
    }
    if (scanLabel) {
      scanLabel.style.opacity = story ? (Math.min(range(s, 0, 0.06), 1 - range(s, 0.92, 1))).toFixed(3) : '0';
      scanLabel.style.transform = `translateX(${(xl + 8).toFixed(1)}px)`;
    }
    if (s >= 1) {
      const [ex, ey] = line[line.length - 1];
      const n = line.closes.length, lastUp = line.closes[n - 1] >= line.closes[n - 2];
      ctx.fillStyle = lastUp ? '#1E8E5A' : '#D0453B';
      ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.arc(ex, ey, 13, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 7); ctx.fill();
      // the live quote rides on the last point of the line
      if (endTag && pickNow && !pickNow.sample && hoverX == null) {
        endTag.style.transform = `translate(${(canvas.offsetLeft + ex).toFixed(0)}px, ${(canvas.offsetTop + ey).toFixed(0)}px) translate(-100%, -50%) translateX(-24px)`;
        endTag.classList.add('on');
      } else if (endTag) endTag.classList.remove('on');
      // crosshair: hover the finished chart to read any day of the year
      if (hoverX != null) {
        const i = clamp(Math.round(((hoverX - x0) / (x1 - x0)) * (line.length - 1)), 0, line.length - 1);
        const [hx, hy] = line[i];
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#1D1D1F'; ctx.fillRect(hx, H * 0.42, 1, H * 0.5);
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D1D1F'; ctx.stroke();
        if (cross && pickNow && !pickNow.sample) {
          const dt = line.dates[i] ? new Date(`${line.dates[i]}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          const chg = line.closes[i] / line.closes[0] - 1;
          cross.innerHTML = `<b>${esc(pickNow.symbol)} $${line.closes[i].toFixed(2)}</b>${dt} · ${pct(chg, true)} on the year`;
          cross.style.transform = `translate(${(canvas.offsetLeft + clamp(hx + 14, 8, W - 210)).toFixed(0)}px, ${(canvas.offsetTop + hy - 56).toFixed(0)}px)`;
          cross.classList.add('on');
        }
      } else if (cross) cross.classList.remove('on');
    } else {
      if (cross) cross.classList.remove('on');
      if (endTag) endTag.classList.remove('on');
    }
  }
  // text of the live quote tag: price, today's move, and whether the market is open right now
  function fillEndTag() {
    if (!endTag || !pickNow || pickNow.sample) return;
    const day = pickNow.day != null ? pickNow.day : (pickNow.prevClose ? pickNow.price / pickNow.prevClose - 1 : 0);
    const m = market();
    endTag.innerHTML = `<span class="s-endtag-k">${m.open ? '<i class="s-live-dot"></i>Live' : 'Last close'}</span><b>${esc(pickNow.symbol)} $${Number(pickNow.price).toFixed(2)}</b><em class="${day >= 0 ? 's-up' : 's-down'}">${day >= 0 ? '▲' : '▼'} ${Math.abs(day * 100).toFixed(2)}% today</em>`;
  }

  function stagesAt(p) {
    const set = (el, o, dy) => {
      el.style.opacity = o.toFixed(3);
      el.style.translate = `-50% ${dy.toFixed(1)}px`;
      el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
    };
    set(stage.a, 1 - range(p, 0.05, 0.14), -range(p, 0, 0.14) * 120);
    stage.a.style.scale = (1 - range(p, 0, 0.14) * 0.06).toFixed(4);
    set(stage.b, win(p, 0.14, 0.19, 0.29, 0.34), (1 - range(p, 0.14, 0.19)) * 30 - range(p, 0.29, 0.34) * 30);
    set(stage.c, win(p, 0.33, 0.38, 0.54, 0.6), (1 - range(p, 0.33, 0.38)) * 30 - range(p, 0.54, 0.6) * 30);
    set(stage.d, range(p, 0.74, 0.83), (1 - range(p, 0.74, 0.83)) * 30);
    if (hud) hud.style.opacity = (1 - range(p, 0.08, 0.2) * 0.6).toFixed(3);
  }

  if (fine) {
    canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); hoverX = e.clientX - r.left; if (heroP > 0.77 || !story) drawHero(heroP); });
    canvas.addEventListener('pointerleave', () => { hoverX = null; drawHero(heroP); });
    if (story) canvas.style.pointerEvents = 'auto';
  }

  function fillPick(failed) {
    const el = $('[data-pick]');
    const top = ranked()[0];
    if (failed || top.sample) {
      el.innerHTML = 'Live prices are unavailable right now, so this line is a sample. <a href="portfolio.html">Run my model</a>';
      return;
    }
    const day = top.day != null ? top.day : (top.prevClose ? top.price / top.prevClose - 1 : 0);
    const quote = top.price != null ? ` at <b>$${Number(top.price).toFixed(2)}</b> <span class="${day >= 0 ? 's-up' : 's-down'}">${day >= 0 ? '▲' : '▼'} ${Math.abs(day * 100).toFixed(2)}%</span>` : '';
    el.innerHTML = `<i class="s-live-dot" aria-hidden="true"></i>Today’s signal: <b>${esc(top.symbol)}</b>${top.name ? ` · ${esc(top.name)}` : ''}${quote}, scored <b>${top.final.toFixed(2)}</b> / 5 by my trading model. <a href="portfolio.html">See why</a>`;
    fillEndTag();
  }

  // Work tile: the live ranking, with a 6 month sparkline per stock
  function fillRank(failed) {
    const ol = $('[data-rank]');
    if (!ol) return;
    if (failed) { ol.innerHTML = '<li class="is-loading">Live prices are unavailable right now</li>'; return; }
    ol.innerHTML = ranked().slice(0, 5).map((d, k) => {
      const c = d.closes.slice(-126);
      const lo = Math.min(...c), hi = Math.max(...c);
      const sp = splitPath(c, (i) => i / (c.length - 1) * 100, (v) => 29 - ((v - lo) / (hi - lo || 1)) * 27);
      const verdict = d.signal === 'pass' ? 'Passes every rule' : d.signal === 'watch' ? 'Watch' : d.signal === 'weak' ? 'Weak screen' : '';
      const head = k === 0 ? `<span class="verdict"><span>Today’s pick</span><span>${verdict}</span></span>` : '';
      // today's price and move, straight from the live quote
      const day = d.day != null ? d.day : (d.prevClose ? d.price / d.prevClose - 1 : null);
      const quote = d.price != null
        ? `<small>$${Number(d.price).toFixed(2)}${day != null ? ` <i class="${day >= 0 ? 's-up' : 's-down'}">${day >= 0 ? '▲' : '▼'} ${Math.abs(day * 100).toFixed(2)}%</i>` : ''}</small>` : '';
      return `<li class="${k ? '' : 'top'}">${head}<span class="sym">${esc(d.symbol)}${quote}</span><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="${sp.up}" stroke="#1E8E5A"/><path d="${sp.down}" stroke="#D0453B"/></svg><span class="sc">${d.final.toFixed(2)}</span></li>`;
    }).join('');
    const note = $('[data-rank-note]');
    if (note) {
      const m = market();
      const time = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
      const last = ranked()[0].dates;
      const lastDay = last && last.length ? new Date(`${last[last.length - 1]}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      note.textContent = `${m.open ? `Live prices, updated ${time} ET.` : `Prices as of the ${lastDay ? `${lastDay} ` : ''}close.`} Scored out of 5 on return, volatility, Sharpe and drawdown. Line: last six months.`;
    }
  }

  // Load the ten stocks; while the market is open, refresh every five minutes so prices stay live
  let lastPick = null;
  function loadUniverse() {
    return fetch(`/api/stock?symbols=${UNIVERSE.join(',')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((json) => {
        const list = (json.results || []).filter((d) => d && Array.isArray(d.closes) && d.closes.length > 60);
        if (list.length < 3) throw new Error('thin');
        const analyze = window.MarketUI && window.MarketUI.analyze;
        data = list.map((d) => (analyze ? analyze(d) : { ...d, final: d.closes[d.closes.length - 1] / d.closes[0] }));
        const pick = ranked()[0].symbol;
        lastPick = pick;
        layout(); // the hero line always shows the latest prices (the dot cloud is seeded, so it doesn't jump)
        fillPick(); fillRank(); kick();
      });
  }
  loadUniverse().catch(() => { fillPick(true); fillRank(true); });
  // while the market is open, prices refresh every minute; the clock tag is kept current in between
  setInterval(() => { if (!document.hidden && market().open) loadUniverse().catch(() => {}); }, 60 * 1000);
  setInterval(fillEndTag, 30 * 1000);

  /* ---------- ⌘K: run my trading model on any stock ---------- */
  const palette = $('.s-palette'), palForm = $('.s-pal-form'), palIn = $('#pal-q'), palOut = $('.s-pal-out');
  const palBtn = palForm && $('button[type="submit"]', palForm);
  let lastFocus = null, palToken = 0;
  const VERDICT = { pass: 'Passes the screen', watch: 'Watch', weak: 'Doesn’t pass' };
  function openPalette(q) {
    if (!palette) return;
    lastFocus = document.activeElement;
    palette.hidden = false;
    requestAnimationFrame(() => palette.classList.add('open'));
    palIn.focus();
    if (q) { palIn.value = q; runModel(q); }
  }
  function closePalette() {
    palette.classList.remove('open');
    setTimeout(() => { palette.hidden = true; }, still ? 0 : 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function renderResult(m) {
    const c = m.closes.slice(-252), lo = Math.min(...c), hi = Math.max(...c);
    const pts = c.map((v, i) => `${(i / (c.length - 1) * 600).toFixed(1)},${(150 - ((v - lo) / (hi - lo || 1)) * 140).toFixed(1)}`);
    const sp = splitPath(c, (i) => i / (c.length - 1) * 600, (v) => 150 - ((v - lo) / (hi - lo || 1)) * 140);
    const dayCls = (m.day || 0) >= 0 ? 's-up' : 's-down';
    palOut.innerHTML = `<div class="s-res">
      <div class="s-res-head"><div><p class="s-res-sym">${esc(m.symbol)}</p><p class="s-res-name">${esc(m.name || '')}</p></div>
        <div class="s-res-price"><b>$${Number(m.price).toFixed(2)}</b><span class="${dayCls}">${(m.day || 0) >= 0 ? '▲' : '▼'} ${pct(Math.abs(m.day || 0))} today</span></div></div>
      <svg class="s-res-chart" viewBox="0 0 600 150" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="s-res-wash" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1D1D1F" stop-opacity=".1"/><stop offset="1" stop-color="#1D1D1F" stop-opacity="0"/></linearGradient></defs><path class="a" d="M${pts.join('L')}L600,150L0,150Z"/><g class="lines"><path class="lu" d="${sp.up}"/><path class="ld" d="${sp.down}"/></g></svg>
      <div class="s-res-row"><div class="s-ring ${m.signal}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="19" pathLength="1"/><circle class="fg" cx="22" cy="22" r="19" pathLength="1"/></svg><div><b>${m.final.toFixed(2)}</b><small>out of 5</small></div></div>
        <div><p class="s-verdict ${m.signal}">${VERDICT[m.signal] || m.signal}</p>
        <dl class="s-res-metrics"><div><dt>1Y return</dt><dd>${pct(m.ret, true)}</dd></div><div><dt>Volatility</dt><dd>${pct(m.vol)}</dd></div><div><dt>Sharpe</dt><dd>${m.sharpe.toFixed(2)}</dd></div><div><dt>Max drawdown</dt><dd>${m.dd != null ? pct(m.dd) : 'n/a'}</dd></div></dl></div></div>
      <ul class="s-res-checks">${(m.checks || []).map((k) => `<li class="${k.ok ? 'ok' : ''}">${esc(k.label)} <b>${esc(k.value)}</b></li>`).join('')}</ul>
      <a class="s-res-link" href="portfolio.html">How the model works</a>
    </div>`;
    const fg = $('.s-ring .fg', palOut);
    requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDasharray = `${clamp(m.final / 5).toFixed(3)} 1`; }));
  }
  async function runModel(q) {
    const query = q.trim();
    if (!query) { palIn.focus(); return; }
    const mine = ++palToken;
    palBtn.disabled = true;
    palOut.innerHTML = `<p class="s-pal-status">Pulling a year of prices for “${esc(query)}”</p>`;
    try {
      const res = await fetch(`/api/stock?q=${encodeURIComponent(query)}`);
      const d = await res.json();
      if (mine !== palToken) return;
      if (!res.ok) throw new Error(d.error || 'not found');
      const analyze = window.MarketUI && window.MarketUI.analyze;
      if (!analyze) throw new Error('model unavailable');
      renderResult(analyze(d));
    } catch (err) {
      if (mine !== palToken) return;
      palOut.innerHTML = `<p class="s-pal-status">${/found/i.test(err.message) ? `Couldn’t find “${esc(query)}”. Try the ticker, like AAPL.` : 'Live market data isn’t reachable right now. Please try again later.'}</p>`;
    } finally {
      if (mine === palToken) palBtn.disabled = false;
    }
  }
  if (palette) {
    $$('[data-palette-open]').forEach((b) => b.addEventListener('click', () => openPalette()));
    $$('[data-palette-close]', palette).forEach((b) => b.addEventListener('click', closePalette));
    palForm.addEventListener('submit', (e) => { e.preventDefault(); runModel(palIn.value); });
    $$('[data-q]', palette).forEach((b) => b.addEventListener('click', () => { palIn.value = b.dataset.q; runModel(b.dataset.q); }));
    addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (palette.hidden) openPalette(); else closePalette(); return; }
      if (palette.hidden) { if (e.key === 'Escape' && !sheet.hidden) { closeSheet(); menu.focus(); } return; }
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = $$('input, button, a[href]', $('.s-pal-panel')).filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ---------- 03 Career: a price chart from 2024 to today, with a forecast through graduation and the MBA ----------
     "Now" is today's date, so the solid line keeps growing by itself every month, milestone or not. */
  const career = $('.s-career'), svg = $('.s-chart-svg'), dotBox = $('.s-chart-dots');
  const playhead = $('.s-playhead'), quote = $('[data-quote]');
  const moments = $$('.s-moments li');
  const mi = ([y, m]) => y * 12 + (m - 1);
  const today = new Date();
  const NOW = mi([today.getFullYear(), today.getMonth() + 1]) + (today.getDate() - 1) / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const START = mi([2024, 6]), END = Math.max(mi([2027, 12]), Math.ceil(NOW) + 4), SPAN = END - START;
  const X = (m) => 20 + ((m - START) / SPAN) * 960;
  const Y = (v) => 340 - v * 300;
  const LEVELS = [0.1, 0.24, 0.37, 0.48, 0.56, 0.69, 0.85, 0.94];
  const marks = moments.map((li, k) => {
    const [y, m] = li.dataset.at.split('-').map(Number);
    return { li, m: mi([y, m]), v: LEVELS[k] ?? 0.9, fore: li.hasAttribute('data-forecast') && mi([y, m]) > NOW };
  });
  let clipRect = null, todayDot = null;
  (function buildChart() {
    // a quarter-month random walk, pinned to pass exactly through every milestone
    const rnd = seeded(23);
    const anchors = [{ m: START, v: 0.05 }, ...marks.map((k) => ({ m: k.m, v: k.v })), { m: END, v: 0.98 }];
    const pts = [];
    for (let a = 0; a < anchors.length - 1; a++) {
      const A = anchors[a], B = anchors[a + 1];
      for (let m = A.m; m < B.m; m += 0.25) {
        const t = (m - A.m) / (B.m - A.m);
        pts.push([m, A.v + (B.v - A.v) * t + (rnd() - 0.5) * 0.06 * Math.sin(Math.PI * t)]);
      }
    }
    pts.push([END, 0.98]);
    const d = (list) => list.map(([m, v], i) => `${i ? 'L' : 'M'}${X(m).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    /* the line's value today, so the solid line stops exactly at today and the forecast picks up there */
    const after = pts.findIndex(([m]) => m > NOW);
    const [m0, v0] = pts[Math.max(0, after - 1)], [m1, v1] = pts[after < 0 ? pts.length - 1 : after];
    const vNow = m1 > m0 ? v0 + ((v1 - v0) * (NOW - m0)) / (m1 - m0) : v0;
    const solid = [...pts.filter(([m]) => m < NOW), [NOW, vNow]], fore = [[NOW, vNow], ...pts.filter(([m]) => m > NOW)];
    const area = `${d(solid)}L${X(solid[solid.length - 1][0]).toFixed(1)},360L${X(START).toFixed(1)},360Z`;
    const grid = [40, 140, 240, 340].map((y) => `<line x1="0" x2="1000" y1="${y}" y2="${y}"/>`).join('');
    svg.innerHTML = `<defs><linearGradient id="s-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1D1D1F" stop-opacity=".09"/><stop offset="1" stop-color="#1D1D1F" stop-opacity="0"/></linearGradient><clipPath id="s-clip"><rect x="0" y="-40" width="1000" height="440"/></clipPath></defs><g class="grid">${grid}</g><g clip-path="url(#s-clip)"><path class="c-area" d="${area}"/><path class="c-line" d="${d(solid)}"/><path class="c-fore" d="${d(fore)}"/></g>`;
    clipRect = svg.querySelector('#s-clip rect');
    marks.forEach((k) => {
      const dot = document.createElement('i');
      dot.className = `s-dot${k.fore ? ' fore' : ''}`;
      dot.style.left = `${X(k.m) / 10}%`;
      dot.style.top = `${(Y(k.v) / 360) * 100}%`;
      const t = new Date(Math.floor(k.m / 12), k.m % 12);
      dot.innerHTML = `<span>${MONTHS[t.getMonth()]} ${t.getFullYear()}</span>`;
      dotBox.appendChild(dot);
      k.dot = dot;
    });
    /* today: a live dot at the tip of the line, labelled with the current month */
    todayDot = document.createElement('i');
    todayDot.className = 's-dot s-today';
    todayDot.style.left = `${X(NOW) / 10}%`;
    todayDot.style.top = `${(Y(vNow) / 360) * 100}%`;
    todayDot.innerHTML = `<span>${MONTHS[today.getMonth()]} ${today.getFullYear()} · today</span>`;
    dotBox.appendChild(todayDot);
    for (let yr = 2025; mi([yr, 1]) <= END; yr++) {
      const s = document.createElement('span');
      s.className = 's-year';
      s.textContent = yr;
      s.style.left = `${X(mi([yr, 1])) / 10}%`;
      dotBox.appendChild(s);
    }
  }());

  function careerAt(p) {
    const u = story ? range(p, 0.04, 0.94) : 1;
    const x = 20 + u * 960;
    clipRect.setAttribute('width', x.toFixed(1));
    playhead.style.left = `${(x / 10).toFixed(3)}%`;
    let active = 0;
    marks.forEach((k, i) => { if (X(k.m) <= x + 0.5) active = i; });
    const reached = marks.filter((k) => X(k.m) <= x + 0.5).length;
    const atToday = X(NOW) <= x + 0.5;
    if (atToday !== careerAt.atToday) { careerAt.atToday = atToday; todayDot.classList.toggle('hit', atToday); }
    if (active !== careerAt.active || reached !== careerAt.reached) { // only touch the page when a milestone changes
      careerAt.active = active; careerAt.reached = reached;
      marks.forEach((k, i) => { k.dot.classList.toggle('hit', i < reached); k.dot.classList.toggle('now', story && i === active); });
      if (story) moments.forEach((li, i) => li.classList.toggle('on', i === active));
    }
    const m = START + u * SPAN;
    quote.textContent = `${MONTHS[Math.floor(m) % 12]} ${Math.floor(m / 12)}${m > NOW + 0.25 ? ' · forecast' : ''}`;
  }

  /* ---------- 05 Experience: the 6 rises from behind and pushes the 5 out ---------- */
  const exp = $('.s-exp'), odoCol = $('.s-odo-col');
  const digits = odoCol ? [...odoCol.children] : [];
  const roles = $$('.s-role'), expPath = $('.s-exp-path');
  let shownRole = 0;
  function expAt(p) {
    const t = range(p, 0.28, 0.56);
    const e = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.5) : 1; // overshoots, then settles
    const m = Math.min(1, e);
    odoCol.style.transform = `translateY(${(-e * 50).toFixed(2)}%)`;
    digits[0].style.transform = `rotateX(${(m * 75).toFixed(1)}deg) scale(${(1 - m * 0.2).toFixed(3)})`;
    digits[0].style.opacity = (1 - m * 0.9).toFixed(3);
    digits[1].style.transform = `rotateX(${(-Math.max(0, 1 - e) * 75).toFixed(1)}deg)`;
    expPath.style.setProperty('--yp', range(p, 0.05, 0.9).toFixed(3));
    const idx = t > 0.5 ? 1 : 0;
    if (idx !== shownRole) { shownRole = idx; roles.forEach((r, k) => r.classList.toggle('on', k === idx)); }
  }

  /* ---------- 04 Amber tile: a short loop of real commands ---------- */
  const you = $('[data-you]'), bot = $('[data-bot]');
  const LINES = [
    ['“Open my presentation”', 'Opening Keynote, verified it’s in front ✓'],
    ['Pinch in the air', 'Click at the cursor, verified ✓'],
    ['Push a hand toward the laptop', 'Reflected tone shifted, push detected'],
    ['“No, the other window”', 'Correction saved locally for next time'],
  ];
  if (you && bot && !still) {
    let li = 0, timer = 0;
    const next = () => {
      li = (li + 1) % LINES.length;
      you.classList.add('swap'); bot.classList.add('swap');
      setTimeout(() => { you.textContent = LINES[li][0]; you.classList.remove('swap'); }, 350);
      setTimeout(() => { bot.textContent = LINES[li][1]; bot.classList.remove('swap'); }, 1050);
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !timer) timer = setInterval(next, 3600);
      else if (!e.isIntersecting && timer) { clearInterval(timer); timer = 0; }
    }).observe(you.closest('.s-tile'));
  }

  /* ---------- 07 Contact: departures board (vanilla port of 21st.dev's Split Flap Display) ---------- */
  const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,:+%/';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function makeBoard(el, rows, cols) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const row = document.createElement('div');
      row.className = 'flap-row';
      for (let k = 0; k < cols; k++) {
        const f = document.createElement('span');
        f.className = 'flap';
        f.innerHTML = '<span class="ft"><i> </i></span><span class="fb"><i> </i></span><span class="ff"><i></i></span><span class="fk"><i></i></span>';
        row.appendChild(f);
        cells.push({ el: f, ch: ' ', i: [...f.children].map((s) => s.firstChild), job: 0 });
      }
      el.appendChild(row);
    }
    // one mechanical flap: the top leaf falls away, the bottom leaf swings down with the new character
    const flip = async (c, next, ms) => {
      const [ft, fb, ff, fk] = c.i;
      ft.textContent = next; ff.textContent = c.ch; fk.textContent = next;
      const F = ff.parentNode, K = fk.parentNode;
      F.style.visibility = 'visible';
      await Promise.race([F.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: ms, easing: 'ease-in' }).finished, wait(ms + 60)]);
      F.style.visibility = 'hidden'; K.style.visibility = 'visible';
      await Promise.race([K.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: ms, easing: 'ease-out' }).finished, wait(ms + 60)]);
      K.style.visibility = 'hidden'; fb.textContent = next; c.ch = next;
    };
    const run = async (c, target, delay, k) => {
      const job = ++c.job;
      if (still || !c.el.animate) { c.ch = target; c.i[0].textContent = target; c.i[1].textContent = target; return; }
      await wait(delay);
      const spins = 2 + ((k * 7) % 4);
      for (let s = 0; s <= spins && job === c.job; s++) {
        const next = s === spins ? target : CHARS[1 + Math.floor(Math.random() * (CHARS.length - 1))];
        if (s === spins && next === c.ch) break;
        await flip(c, next, 34);
      }
    };
    return {
      set(lines) {
        let n = 0;
        lines.forEach((line, r) => {
          [...line.toUpperCase().padEnd(cols, ' ').slice(0, cols)].forEach((ch, k) => {
            const c = cells[r * cols + k], t = CHARS.includes(ch) ? ch : ' ';
            if (c.ch !== t) run(c, t, (k + r * 3) * 22, (n += 1));
          });
        });
      },
    };
  }
  // Contact backdrop: the 3D paper plane glides in once and turns gently with scroll; glass tags drift
  const contactSec = $('.s-contact'), floats = $$('.s-float'), plane3d = $('.s-plane3d');
  // the dotted trail runs from the Send button, behind the glass, in a loop up to the plane's tail;
  // both ends are read from the page so it stays attached however the plane turns
  const trailPath = $('.s-trail path'), tailMark = $('.pl-tail'), rightCol = $('.s-contact-right');
  const sendBtn = rightCol && $('button[type="submit"]', rightCol);
  function drawTrail() {
    if (!trailPath || !tailMark || !sendBtn) return;
    const c = rightCol.getBoundingClientRect(), b = sendBtn.getBoundingClientRect(), t = tailMark.getBoundingClientRect();
    const bx = b.left + b.width * 0.5 - c.left, by = b.top + b.height * 0.5 - c.top;
    const tx = t.left + t.width / 2 - c.left, ty = t.top + t.height / 2 - c.top;
    const dx = tx - bx;
    trailPath.setAttribute('d', `M${bx.toFixed(1)},${by.toFixed(1)} C${(bx - 20).toFixed(1)},${(by + 140).toFixed(1)} ${(bx - 200).toFixed(1)},${(by + 135).toFixed(1)} ${(bx - 172).toFixed(1)},${(by + 24).toFixed(1)} S${(tx - Math.max(40, dx * -0.2)).toFixed(1)},${(ty + 90).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`);
  }
  // follow the plane frame by frame while it moves on its own (gliding in, taking off)
  const followPlane = (ms) => { const end = performance.now() + ms; const step = (t) => { drawTrail(); if (t < end) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  if (contactSec) new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { contactSec.classList.add('seen'); followPlane(2000); obs.disconnect(); } }, { threshold: 0.12 }).observe(contactSec);
  drawTrail();
  // Send pressed: the plane flies off the page at once and stays away while the message travels;
  // when the mail service answers (delivered or not) it glides back in to its place
  let awayAt = 0, backTimer = 0;
  window.addEventListener('signal:sending', () => {
    if (!plane3d || !rightCol || still) return;
    clearTimeout(backTimer);
    awayAt = performance.now();
    rightCol.classList.add('flying');
    plane3d.classList.remove('back', 'takeoff');
    plane3d.classList.add('away');
  });
  const comeBack = () => {
    if (!plane3d || !rightCol || still || !plane3d.classList.contains('away')) return;
    const wait = Math.max(0, 850 - (performance.now() - awayAt)); /* let it finish leaving first */
    backTimer = setTimeout(() => {
      plane3d.classList.remove('away'); void plane3d.offsetWidth; plane3d.classList.add('back');
      backTimer = setTimeout(() => { plane3d.classList.remove('back'); rightCol.classList.remove('flying'); drawTrail(); }, 1150);
    }, wait);
  };
  window.addEventListener('signal:sent', comeBack);
  window.addEventListener('signal:send-failed', comeBack);
  const boardEl = $('[data-board]');
  if (boardEl) {
    const board = makeBoard(boardEl, 4, 18);
    const msgs = [
      ['STATUS:       OPEN', 'GRADUATING    2027', 'FINANCE PENN STATE', 'SEEKING INTERNSHIP'],
      ['BUILD THE MODEL', 'TEST ASSUMPTIONS', 'MAKE THE TOOL', 'ANSWER:   OBVIOUS'],
      ['AMZN DCF   $158.20', 'AWS REVENUE    17%', 'AWS OP INCOME  55%', 'VERDICT: MIX SHIFT'],
    ];
    let m = 0, timer = 0, seen = false;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!seen) { seen = true; board.set(msgs[0]); }
        if (!still && !timer) timer = setInterval(() => { if (!document.hidden) { m = (m + 1) % msgs.length; board.set(msgs[m]); } }, 6000);
      } else if (timer) { clearInterval(timer); timer = 0; }
    }, { threshold: 0.3 }).observe(boardEl);
  }

  /* ---------- The loop: everything scroll-driven is updated here ---------- */
  const playSec = $('.s-play'), playTrack = $('.s-play-track');
  let raf = 0;
  // Geometry is measured once, and again only when the page changes size, so the frame loop never
  // forces the browser to lay the page out while you scroll.
  const G = new Map();
  let trackW = 0, lastLit = -1;
  function measure() {
    const y = scrollY;
    [hero, career, exp, read, playSec, contactSec, boardEl, ...navLinks.map((n) => n.sec)].filter(Boolean).forEach((el) => {
      const r = el.getBoundingClientRect();
      G.set(el, { top: r.top + y, h: r.height });
    });
    trackW = playTrack ? playTrack.scrollWidth : 0;
  }
  const gTop = (el) => G.get(el).top - scrollY;
  const gPin = (el) => { const g = G.get(el); return clamp((scrollY - g.top) / Math.max(1, g.h - innerHeight)); };
  const gVis = (el) => { const g = G.get(el); return g.top < scrollY + innerHeight && g.top + g.h > scrollY; };
  function tick() {
    raf = 0;
    if (!G.size) measure();
    let again = false;
    if (story) {
      heroTarget = gPin(hero);
      const d = heroTarget - heroP;
      heroP = Math.abs(d) < 0.0004 ? heroTarget : heroP + d * 0.16;
      if (heroP !== heroTarget) again = true;
      if (gVis(hero)) { drawHero(heroP); stagesAt(heroP); }
      if (gVis(career)) careerAt(gPin(career));
      if (gVis(exp)) expAt(gPin(exp));
      if (read && gVis(read)) {
        const prog = range(innerHeight * 0.88 - gTop(read), 0, G.get(read).h + innerHeight * 0.3);
        const lit = Math.round(prog * words.length);
        if (lit !== lastLit) { lastLit = lit; words.forEach((w, k) => w.classList.toggle('lit', k < lit)); }
      }
    }
    if (!still && floats.length && gVis(contactSec)) {
      const prog = range(innerHeight - gTop(contactSec), 0, innerHeight + G.get(contactSec).h);
      floats.forEach((f, k) => f.style.setProperty('--py', `${((0.5 - prog) * (24 + k * 14)).toFixed(1)}px`));
      if (plane3d) { plane3d.style.setProperty('--sp', prog.toFixed(3)); drawTrail(); }
    }
    if (!still && playTrack && gVis(playSec)) {
      const prog = range(innerHeight - gTop(playSec), 0, innerHeight + G.get(playSec).h);
      playTrack.style.transform = `translate3d(${(-prog * trackW * 0.42).toFixed(1)}px, 0, 0)`;
    }
    let on = null;
    navLinks.forEach((n) => { if (gTop(n.sec) <= innerHeight * 0.4) on = n; });
    const nextActive = on ? on.a : null;
    if (nextActive !== activeLink) {
      activeLink = nextActive;
      navLinks.forEach((n) => n.a.classList.toggle('on', n.a === nextActive));
      placeLens();
    }
    if (boardEl) { // over the dark departures board the glass darkens (menu bar: 14px to 64px from the top)
      const bt = gTop(boardEl), dark = bt < 56 && bt + G.get(boardEl).h > 22;
      if (dark !== nav.classList.contains('dark')) nav.classList.toggle('dark', dark);
    }
    if (again) raf = requestAnimationFrame(tick);
  }
  kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  // localhost only: render any scene at a chosen progress, for checking frames without scrolling
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__signalDebug = { hero: (p) => { heroP = heroTarget = p; drawHero(p); stagesAt(p); }, career: careerAt, exp: expAt, palette: openPalette };

  layout();
  careerAt(story ? pinProgress(career) : 1);
  // arriving at index.html#section: land exactly on that section once the page has its full height
  if (location.hash.length > 1) {
    const landing = (() => { try { return $(location.hash); } catch (e) { return null; } })();
    if (landing) {
      const land = () => window.scrollTo({ top: landing.getBoundingClientRect().top + scrollY, behavior: 'instant' });
      land();
      setTimeout(land, 60);
      addEventListener('load', land, { once: true });
    }
  }
  if (story) { heroP = heroTarget = pinProgress(hero); stagesAt(heroP); expAt(pinProgress(exp)); }
  tick();
  addEventListener('scroll', kick, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); kick(); }).observe(document.body);
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { layout(); measure(); placeLens(); drawTrail(); kick(); }); });
  if (document.fonts) document.fonts.ready.then(() => { layout(); kick(); });
})();
