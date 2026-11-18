/* Interests page, what Meet loves, live.
   F1: next race with a live countdown + session times, last race podium, a LIVE badge during sessions.
   Cricket: live matches, latest result and the next match (India and internationals first).
   Poker: heads-up Texas Hold'em against "Meet", deal, flop, turn, river, showdown.
   Bollywood: a movie-night slot machine that ends on a real film suggestion.
   Data comes from /api/sports (see api/sports.js). Respects prefers-reduced-motion. */
(() => {
  if (window.Interests) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const M = window.Motion;
  const anim = (el, kf, opts) => (M && M.animate && !reduced ? M.animate(el, kf, opts) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  /* ---------- Party poppers: confetti bursts from both bottom corners ---------- */
  const COLORS = ['#ff2e88', '#ffb703', '#7c3aed', '#00a99d', '#d10500', '#1d4ed8', '#ffffff', '#0e7a43'];
  function party(power = 1, message) {
    if (message) banner(message);
    if (reduced) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    const bits = [];
    const pop = (x, dir) => {
      for (let i = 0; i < 90 * power; i++) {
        const a = (-Math.PI / 2) + dir * (0.15 + Math.random() * 0.75);
        const v = 9 + Math.random() * 13;
        bits.push({ x, y: H + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 8, h: 4 + Math.random() * 10,
          r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.3, life: 0 });
      }
    };
    pop(W * 0.04, 1);
    pop(W * 0.96, -1);
    if (power > 1.5) setTimeout(() => { pop(W * 0.3, 0.4); pop(W * 0.7, -0.4); }, 450);
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(2, (now - last) / 16.7); last = now;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      bits.forEach((b) => {
        b.life += dt;
        b.vy += 0.32 * dt; b.vx *= 0.99; b.vy *= 0.99;
        b.x += b.vx * dt + Math.sin(b.life / 10) * 0.6; b.y += b.vy * dt; b.r += b.vr * dt;
        if (b.y < H + 40) alive += 1;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c;
        if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.w / 3, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-b.w / 2, -b.h / 2 * Math.abs(Math.cos(b.life / 6)), b.w, b.h * Math.abs(Math.cos(b.life / 6)) + 1);
        ctx.restore();
      });
      if (alive && performance.now() - start < 6000) requestAnimationFrame(step); else cv.remove();
    };
    const start = performance.now();
    requestAnimationFrame(step);
  }
  function banner(text) {
    const b = document.createElement('div');
    b.className = 'party-banner';
    b.setAttribute('role', 'status');
    b.textContent = text;
    document.body.appendChild(b);
    anim(b, { y: [-80, 0], rotate: [-6, -2], opacity: [0, 1] }, { type: 'spring', stiffness: 260, damping: 14 });
    setTimeout(() => { const a = anim(b, { y: -80, opacity: 0 }, { duration: 0.4 }); if (a) a.then(() => b.remove()); else b.remove(); }, 4200);
  }
  // Celebrations that depend on the live data fire once per visit.
  const RECENT = 36 * 36e5;
  const celebrated = new Set();
  const celebrate = (key, power, msg) => { if (celebrated.has(key)) return; celebrated.add(key); setTimeout(() => party(power, msg), 900); };

  const fmtDate = (iso, withTime) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString(undefined, withTime ? { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /* ---------- live data (one request shared by both panels) ---------- */
  let sportsPromise = null;
  const sports = () => {
    if (!sportsPromise) {
      sportsPromise = fetch('/api/sports').then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))));
      sportsPromise.catch(() => { sportsPromise = null; });
    }
    return sportsPromise;
  };
  const offline = (el, what) => { el.innerHTML = `<p class="muted">Live ${what} data isn’t reachable right now, check back soon.</p>`; };

  /* ---------- F1 ---------- */
  const TEAM = { 'red bull': '#3671c6', mercedes: '#27f4d2', ferrari: '#e8002d', mclaren: '#ff8000', 'aston martin': '#229971', alpine: '#0093cc', williams: '#64c4ff', haas: '#b6babd', sauber: '#52e252', audi: '#52e252', 'rb f1': '#6692ff', 'racing bulls': '#6692ff', cadillac: '#c9a227' };
  const teamColor = (name) => { const n = String(name || '').toLowerCase(); const k = Object.keys(TEAM).find((t) => n.includes(t)); return k ? TEAM[k] : '#ffffff'; };
  const secs = (t) => { const m = String(t).match(/(?:(\d+):)?(\d+(?:\.\d+)?)/); return m ? (Number(m[1] || 0) * 60 + Number(m[2])) : NaN; };
  function f1(root) {
    const $ = (s) => root.querySelector(s);
    // Countdown on split-flap plates: the seconds flip every second.
    const cdBox = $('[data-countdown]');
    const units = [['d', 'days', 2], ['h', 'hrs', 2], ['m', 'min', 2], ['s', 'sec', 2]].map(([k, label, w]) => {
      const u = document.createElement('div');
      u.className = 'cd-unit';
      const row = flipRow(w);
      u.append(row);
      u.insertAdjacentHTML('beforeend', `<small>${label}</small>`);
      cdBox.appendChild(u);
      return [k, row];
    });
    const cd = Object.fromEntries(units);
    let target = 0, timer = 0;
    const tick = () => {
      const ms = Math.max(0, target - Date.now());
      cd.d.set(Math.min(99, Math.floor(ms / 864e5)));
      cd.h.set(String(Math.floor(ms / 36e5) % 24).padStart(2, '0'));
      cd.m.set(String(Math.floor(ms / 6e4) % 60).padStart(2, '0'));
      cd.s.set(String(Math.floor(ms / 1e3) % 60).padStart(2, '0'));
    };
    // Timing board: qualifying top 5 (or live best laps) as flip-plate lap times, plus a live lap counter.
    const timing = (rows, label, lap) => {
      const box = $('[data-f1-timing]');
      if (!rows || !rows.length) return;
      box.hidden = false;
      $('[data-f1-timing-label]').textContent = label;
      const list = $('[data-f1-timing-rows]');
      list.innerHTML = '';
      rows.forEach((r, i) => {
        const line = document.createElement('div');
        line.className = `t-row p${r.pos}`;
        const gap = i === 0 ? 'POLE' : `+${(secs(r.time) - secs(rows[0].time)).toFixed(3)}`;
        line.innerHTML = `<b class="t-pos">P${r.pos}</b><span class="t-code">${esc(r.code)}<small>${esc(isNaN(secs(r.time)) ? '' : gap)}</small></span>`;
        const f = flipRow(8);
        line.appendChild(f);
        list.appendChild(line);
        setTimeout(() => f.set(r.time), 300 + i * 180);
      });
      if (lap) { const lb = $('[data-f1-lap]'); lb.hidden = false; const lr = flipRow(3); lb.appendChild(lr); setTimeout(() => lr.set(lap), 200); }
    };
    sports().then(({ f1: data }) => {
      if (!data) throw new Error('no f1');
      if (data.next) {
        const n = data.next;
        $('[data-f1-next-name]').textContent = n.name;
        $('[data-f1-next-where]').textContent = `Round ${n.round} · ${n.circuit} · ${n.locality}, ${n.country}`;
        target = Date.parse(n.start);
        tick();
        const io = new IntersectionObserver(([e]) => { clearInterval(timer); if (e.isIntersecting) timer = setInterval(tick, 1000); });
        io.observe(root);
        const now = Date.now();
        const nextIdx = n.sessions.findIndex((x) => Date.parse(x.start) > now);
        $('[data-f1-sessions]').innerHTML = n.sessions.map((x, i) => `<li class="${Date.parse(x.start) < now ? 'done' : ''}${i === nextIdx ? ' next' : ''}"><span>${esc(x.label)}${i === nextIdx ? ' <em class="next-tag">NEXT</em>' : ''}</span><b>${esc(fmtDate(x.start, true))}</b></li>`).join('');
      }
      if (data.last) {
        const l = data.last;
        $('[data-f1-last-name]').textContent = l.name;
        $('[data-f1-last-where]').textContent = `Round ${l.round} · ${l.circuit} · ${fmtDate(l.date)}`;
        const order = [1, 0, 2]; // P2, P1, P3 for the podium shape
        $('[data-podium]').innerHTML = order.map((i) => {
          const p = l.podium[i];
          return p ? `<div class="step p${p.pos}" style="--team:${teamColor(p.team)}"><span class="code">${esc(p.code)}</span><span class="who">${esc(p.name)}<small>${esc(p.team)} · ${esc(p.time)}</small></span><b>P${p.pos}</b></div>` : '';
        }).join('');
        anim(root.querySelectorAll('.podium .step'), { scaleY: [0, 1], opacity: [0, 1] }, { type: 'spring', stiffness: 140, damping: 14, delay: M && M.stagger ? M.stagger(0.12) : 0 });
        if (l.start && Date.now() - Date.parse(l.start) < RECENT && Date.now() > Date.parse(l.start)) celebrate(`f1-${l.season}-${l.round}`, 1.4, `Race done, ${l.podium[0] ? l.podium[0].name.split(' ').slice(-1)[0] : 'chequered flag'} wins!`);
        if (l.fastest) $('[data-f1-fastest]').textContent = `Fastest lap: ${l.fastest.name}${l.fastest.time ? ` · ${l.fastest.time}` : ''}`;
      }
      if (data.live && data.live.best && data.live.best.length) timing(data.live.best, `Live · ${data.live.session} · best laps`, /race|sprint/i.test(data.live.session) ? data.live.lap : 0);
      else if (data.quali) timing(data.quali.top, data.next && data.quali.round === data.next.round ? `Qualifying · ${data.quali.raceName}` : `Last qualifying · ${data.quali.raceName}`);
      if (data.live) {
        const pill = $('[data-f1-live-pill]');
        pill.hidden = false;
        pill.textContent = `LIVE · ${data.live.session} · ${data.live.place}`;
      }
    }).catch(() => { offline(root.querySelector('.f1-grid'), 'F1'); });
  }

  /* ---------- Cricket: a flip-number scoreboard ---------- */
  // Parse ESPN score strings like "244", "489/9 (132 ov)", "217 & 167/3 (43 ov)",
  // "299/6 (48.5/50 ov, target 299)" into the current innings plus the previous one.
  function parseScore(str) {
    const raw = String(str || '').trim();
    if (!raw) return { runs: '', wkts: '', overs: '', last: '' };
    const inns = raw.split('&').map((x) => x.trim());
    const cur = inns[inns.length - 1];
    const m = cur.match(/^(\d+)(?:\/(\d+))?/);
    const ov = cur.match(/\(([\d.]+)(?:\/\d+)?\s*ov/);
    const prev = inns.length > 1 ? (inns[inns.length - 2].match(/^(\d+)/) || [])[1] || '' : '';
    return { runs: m ? m[1] : '', wkts: m ? (m[2] != null ? m[2] : '10') : '', overs: ov ? ov[1] : '', last: prev };
  }

  // A row of split-flap digits. Changing a value makes the old top half fall and the new bottom half land.
  function flipRow(width) {
    const row = document.createElement('span');
    row.className = 'flip';
    const cells = [];
    for (let i = 0; i < width; i++) {
      const d = document.createElement('span');
      d.className = 'dg';
      d.innerHTML = '<span class="half t"><i></i></span><span class="half b"><i></i></span>';
      row.appendChild(d);
      cells.push({ el: d, top: d.querySelector('.t i'), bot: d.querySelector('.b i'), v: '' });
    }
    // One flap: the old top half falls under gravity (ease-in, darkening as it tips away while its
    // shadow sweeps the lower plate), then the new bottom half lands with a small bounce.
    const flipCell = (c, next, delay) => {
      const prev = c.v;
      c.v = next;
      const sep = next === '.' || next === ':';
      c.el.classList.toggle('dot', sep);
      if (reduced || !c.el.animate || sep || prev === '') { c.top.textContent = next; c.bot.textContent = next; return; }
      setTimeout(() => {
        c.top.textContent = next;
        const leafTop = document.createElement('span');
        leafTop.className = 'half t leaf';
        leafTop.innerHTML = `<i>${prev}</i>`;
        const leafBot = document.createElement('span');
        leafBot.className = 'half b leaf';
        leafBot.innerHTML = `<i>${next}</i>`;
        leafBot.style.transform = 'rotateX(90deg)';
        const shade = document.createElement('span');
        shade.className = 'shade';
        c.el.append(leafTop, leafBot, shade);
        shade.animate([{ opacity: 0 }, { opacity: 0.55 }, { opacity: 0 }], { duration: 520, easing: 'ease-in-out' }).onfinish = () => shade.remove();
        leafTop.animate([
          { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
          { transform: 'rotateX(-90deg)', filter: 'brightness(.45)' },
        ], { duration: 240, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' }).onfinish = () => {
          leafTop.remove();
          leafBot.animate([
            { transform: 'rotateX(90deg)', filter: 'brightness(.55)' },
            { transform: 'rotateX(-14deg)', filter: 'brightness(1.1)', offset: 0.62 },
            { transform: 'rotateX(6deg)', filter: 'brightness(1)', offset: 0.82 },
            { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
          ], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => {
            c.bot.textContent = next;
            leafBot.remove();
          };
        };
      }, delay || 0);
    };
    row.value = '';
    row.set = (value) => {
      row.value = String(value == null ? '' : value);
      const str = String(value == null ? '' : value).slice(-width).padStart(width, ' ');
      let k = 0;
      cells.forEach((c, i) => { const ch = str[i] === ' ' ? '' : str[i]; if (ch !== c.v) flipCell(c, ch, (k++) * 70); });
    };
    return row;
  }

  const matchCard = (m, kind) => {
    const teams = m.teams.map((t) => `<div class="team${t.winner ? ' won' : ''}"><b>${esc(t.abbr || t.name)}</b><span>${esc(t.score || (kind === 'next' ? '' : 'Yet to bat'))}</span></div>`).join('');
    const when = kind === 'next' ? fmtDate(m.date, true) : '';
    return `<article class="match ${kind}"><p class="league">${esc(m.league)}</p><p class="mname">${esc(m.name)}</p>${teams}<p class="summary">${esc(when || m.summary)}</p></article>`;
  };

  function cricket(root) {
    const sides = root.querySelector('[data-sb-sides]');
    const liveList = root.querySelector('[data-cr-live]');
    const nextEl = root.querySelector('[data-cr-next]');
    let boards = null, matchId = null, poll = 0;
    const sb = root.querySelector('.sb');
    const wrap = root.querySelector('.sb-wrap');
    // The board powers on as it scrolls into view. Resolves when it's done (immediately under reduced motion).
    let introDone;
    const introFinished = new Promise((r) => { introDone = r; });
    const intro = () => { sb.classList.add('on'); introDone(); };
    if (M && M.inView) M.inView(wrap, () => { intro(); }, { amount: 0.45 }); else intro();
    const build = (teams) => {
      sides.innerHTML = '';
      boards = teams.map((t) => {
        const side = document.createElement('div');
        side.className = 'side';
        side.innerHTML = `<p class="sb-team"><b>${esc(t.abbr || '')}</b><span>${esc(t.name || '')}</span></p>`;
        const rows = {};
        [['TOTAL', 'runs', 3], ['WKTS', 'wkts', 2], ['OVERS', 'overs', 4], ['LAST INNS', 'last', 3]].forEach(([label, key, w]) => {
          const r = document.createElement('div');
          r.className = `sb-row r-${key}`;
          r.innerHTML = `<span class="sb-label">${label}</span>`;
          const f = flipRow(w);
          r.appendChild(f);
          side.appendChild(r);
          rows[key] = f;
        });
        sides.appendChild(side);
        return rows;
      });
    };
    // Count up from zero so every flap gets to fall, then sit on the real numbers.
    const countUp = (side, sc) => {
      const steps = reduced ? 1 : 6;
      const runs = Number(sc.runs) || 0, wk = Number(sc.wkts) || 0;
      for (let k = 1; k <= steps; k++) {
        setTimeout(() => {
          const f = k / steps, e = 1 - Math.pow(1 - f, 2);
          side.runs.set(sc.runs === '' ? '' : Math.round(runs * e));
          side.wkts.set(sc.wkts === '' ? '' : Math.round(wk * e));
          if (k === steps) { side.overs.set(sc.overs); side.last.set(sc.last); }
        }, k * 720);
      }
    };
    const show = (data, first) => {
      /* the board always shows the latest result: if the feed comes back empty, use the one we last saw */
      if (data.last) store.set('cr-last', data.last);
      const saved = !data.live[0] && !data.last ? store.get('cr-last', null) : null;
      const featured = data.live[0] || data.last || (saved && saved.teams && saved.teams.length ? saved : null);
      root.querySelector('[data-sb-league]').textContent = featured ? featured.league : 'No recent match';
      root.querySelector('[data-sb-name]').textContent = featured ? `${featured.name} · ${data.live[0] ? 'LIVE' : 'RESULT'}` : '';
      root.querySelector('[data-sb-summary]').textContent = featured ? featured.summary : '';
      let stamp = sb.querySelector('.stamp');
      if (!stamp) { stamp = document.createElement('span'); stamp.className = 'stamp'; sb.appendChild(stamp); }
      stamp.textContent = data.live[0] ? 'LIVE' : 'RESULT';
      stamp.classList.toggle('live', Boolean(data.live[0]));
      stamp.hidden = !featured;
      root.querySelector('[data-cricket-live-pill]').hidden = !data.live.length;
      if (featured) {
        const scores = featured.teams.map((t) => parseScore(t.score));
        if (featured.id !== matchId || !boards) {
          matchId = featured.id;
          build(featured.teams);
          const b = boards;
          introFinished.then(() => scores.forEach((sc, i) => countUp(b[i], sc)));
        } else {
          scores.forEach((sc, i) => { const b = boards[i]; b.runs.set(sc.runs); b.wkts.set(sc.wkts); b.overs.set(sc.overs); b.last.set(sc.last); });
        }
      } else if (!boards) {
        build([{}, {}]); /* nothing to show at all: an unlit board, still full size */
      }
      const india = data.last && data.last.teams.find((t) => /^India( Women)?$/.test(t.full || t.name || ''));
      if (india && india.winner && Date.now() - Date.parse(data.last.date) < RECENT) celebrate(`cr-${data.last.id}`, 1.6, `${india.full || 'India'} won today!`);
      const others = data.live.slice(1);
      liveList.innerHTML = others.length ? others.map((m) => matchCard(m, 'live')).join('') : '<p class="muted">Nothing else live right now.</p>';
      nextEl.innerHTML = data.next ? matchCard(data.next, 'next') : '<p class="muted">Nothing scheduled yet.</p>';
      if (first) anim(root.querySelectorAll('.match'), { opacity: [0, 1], y: [24, 0], rotate: [-2, 0] }, { duration: 0.6, delay: M && M.stagger ? M.stagger(0.08) : 0, ease: [0.16, 1, 0.3, 1] });
    };
    sports().then((d) => {
      if (!d.cricket) throw new Error('no cricket');
      show(d.cricket, true);
      // Live matches: re-check every minute while the board is on screen; changed digits flip.
      if (d.cricket.live.length) {
        const refresh = () => fetch('/api/sports').then((r) => r.json()).then((n) => { if (n.cricket) show(n.cricket, false); }).catch(() => {});
        new IntersectionObserver(([e]) => { clearInterval(poll); if (e.isIntersecting) poll = setInterval(refresh, 60000); }).observe(root);
      }
    }).catch(() => {
      /* the feed is down: still show the last result this browser saw, if any */
      const saved = store.get('cr-last', null);
      if (saved && saved.teams && saved.teams.length) show({ live: [], last: null, next: null }, true);
      else offline(root.querySelector('.sb'), 'cricket');
    });
  }

  /* ---------- Poker: heads-up Texas Hold'em ---------- */
  const RANKS = '23456789TJQKA';
  const SUITS = [['♠', false, 'spades'], ['♥', true, 'hearts'], ['♦', true, 'diamonds'], ['♣', false, 'clubs']];
  const NAMES = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush'];
  // Score a 5-card hand as [category, tiebreakers…] so arrays compare lexicographically.
  function score5(cards) {
    const vals = cards.map((c) => c[0]).sort((a, b) => b - a);
    const counts = new Map();
    vals.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = cards.every((c) => c[1] === cards[0][1]);
    const uniq = [...new Set(vals)];
    let high = -1;
    if (uniq.length === 5) { if (uniq[0] - uniq[4] === 4) high = uniq[0]; else if (uniq.join() === '12,3,2,1,0') high = 3; }
    const straight = high >= 0;
    if (straight && flush) return [high === 12 ? 9 : 8, high];
    if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
    if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
    if (flush) return [5, ...vals];
    if (straight) return [4, high];
    if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map((g) => g[0])];
    if (groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
    if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map((g) => g[0])];
    return [0, ...vals];
  }
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  function best(cards) {
    let top = null;
    const n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      if (!top || cmp(s, top) > 0) top = s;
    }
    return top;
  }
  // Casino chips: amounts are drawn as stacks of 100 (black), 25 (green), 10 (blue) and 5 (red).
  const DENOMS = [[100, 'c100'], [25, 'c25'], [10, 'c10'], [5, 'c5']];
  function drawChips(el, amount) {
    let left = amount;
    const cols = DENOMS.map(([v, cls]) => { const n = Math.min(10, Math.floor(left / v)); left -= Math.floor(left / v) * v; return [n, cls]; }).filter(([n]) => n);
    el.innerHTML = cols.map(([n, cls]) => `<span class="col" style="height:${26 + (n - 1) * 5}px">${Array.from({ length: n }, (_, i) => `<i class="chip ${cls}" style="bottom:${i * 5}px"></i>`).join('')}</span>`).join('');
  }
  function holdem(root) {
    const $ = (s) => root.querySelector(s);
    const you = $('[data-you-cards]'), meet = $('[data-meet-cards]'), board = $('[data-board]');
    const youHand = $('[data-you-hand]'), meetHand = $('[data-meet-hand]'), stage = $('[data-stage]'), result = $('[data-result]');
    const btns = Object.fromEntries([...root.querySelectorAll('[data-act]')].map((b) => [b.dataset.act, b]));
    const ui = { youStack: $('[data-you-stack]'), meetStack: $('[data-meet-stack]'), pot: $('[data-pot]'), youChips: $('[data-you-chips]'), meetChips: $('[data-meet-chips]'), potChips: $('[data-pot-chips]') };
    /* every visit starts fresh: 500 chips each and a 0 to 0 tally (nothing is saved between visits) */
    const tally = { you: 0, meet: 0 };
    const bank = { you: 500, meet: 500 };
    try { localStorage.removeItem('mb-holdem'); localStorage.removeItem('mb-holdem-bank'); } catch (e) { /* storage blocked */ }
    const ANTE = 10;
    let deck = [], hand = null, street = -1, pot = 0;
    const showTally = () => { $('[data-you-wins]').textContent = tally.you; $('[data-meet-wins]').textContent = tally.meet; };
    const showMoney = () => {
      ui.youStack.textContent = bank.you; ui.meetStack.textContent = bank.meet; ui.pot.textContent = pot;
      drawChips(ui.youChips, bank.you); drawChips(ui.meetChips, bank.meet); drawChips(ui.potChips, pot);
    };
    const mode = (m) => {
      const betting = m === 'bet';
      btns.deal.hidden = betting;
      ['check', 'bet25', 'bet100', 'fold'].forEach((k) => { btns[k].hidden = !betting; });
      if (betting) { btns.bet25.disabled = bank.you < 25 || bank.meet < 25; btns.bet100.disabled = bank.you < 100 || bank.meet < 100; }
    };
    const chipFly = (from, to) => {
      if (reduced || !from.animate) return;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      for (let i = 0; i < 5; i++) {
        const c = document.createElement('i');
        c.className = `chip flying ${DENOMS[i % 4][1]}`;
        c.style.left = `${a.left + a.width / 2}px`; c.style.top = `${a.top + a.height / 2}px`;
        document.body.appendChild(c);
        c.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: `translate(calc(-50% + ${b.left - a.left + (i - 2) * 6}px), calc(-50% + ${b.top - a.top}px)) scale(.9) rotate(${180 + i * 40}deg)` }], { duration: 520, delay: i * 50, easing: 'cubic-bezier(.3,.8,.3,1)' }).onfinish = () => c.remove();
      }
    };
    const cardEl = (c, faceUp, i) => {
      const [sym, red, suitName] = SUITS[c[1]];
      const label = RANKS[c[0]] === 'T' ? '10' : RANKS[c[0]];
      const el = document.createElement('div');
      el.className = 'pcard';
      el.setAttribute('aria-label', faceUp ? `${label} of ${suitName}` : 'Face-down card');
      el.dataset.name = `${label} of ${suitName}`;
      el.innerHTML = `<div class="pcard-inner"><span class="back"></span><span class="face${red ? ' red' : ''}"><small>${label}${sym}</small>${sym}</span></div>`;
      anim(el, { x: [-160, 0], y: [-80, 0], rotate: [-30, 0], opacity: [0, 1] }, { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] });
      if (faceUp) setTimeout(() => el.firstChild.classList.add('flip'), reduced ? 0 : 420 + i * 90);
      return el;
    };
    const reveal = (container) => container.querySelectorAll('.pcard').forEach((p, i) => setTimeout(() => { p.firstChild.classList.add('flip'); p.setAttribute('aria-label', p.dataset.name); }, reduced ? 0 : i * 140));
    const describe = (cards) => NAMES[best(cards)[0]];
    const award = (who, text) => {
      if (who === 'you') { bank.you += pot; tally.you += 1; chipFly(ui.potChips, ui.youChips); root.classList.add('win'); }
      else if (who === 'meet') { bank.meet += pot; tally.meet += 1; chipFly(ui.potChips, ui.meetChips); root.classList.add('lose'); }
      else { bank.you += pot / 2; bank.meet += pot / 2; }
      pot = 0;
      result.textContent = text;
      anim(result, { scale: [1.4, 1], opacity: [0, 1] }, { type: 'spring', stiffness: 300, damping: 14 });
      setTimeout(showMoney, reduced ? 0 : 450);
      showTally();
      stage.textContent = 'Hand over';
      const broke = bank.you < ANTE || bank.meet < ANTE;
      if (who === 'you' && bank.meet < ANTE) { result.textContent = `You cleaned Meet out, all ${bank.you} chips are yours!`; party(2.4, 'You cleaned Meet out!'); }
      btns.deal.textContent = broke ? 'Rebuy · 500 chips' : 'Deal again';
      mode('deal');
    };
    const dealStreet = () => {
      street += 1;
      if (street > 3) {
        reveal(meet);
        const ys = best(hand.you.concat(hand.board)), ms = best(hand.meet.concat(hand.board));
        const c = cmp(ys, ms);
        meetHand.textContent = `Meet has: ${NAMES[ms[0]]}`;
        if (c > 0) award('you', `You win ${pot} chips with ${NAMES[ys[0]].toLowerCase()}!`);
        else if (c < 0) award('meet', `Meet takes ${pot} chips with ${NAMES[ms[0]].toLowerCase()}.`);
        else award('split', `Split pot, ${pot / 2} each.`);
        stage.textContent = 'Showdown';
        return;
      }
      if (street > 0) {
        const n = street === 1 ? 3 : 1;
        for (let k = 0; k < n; k++) { const card = deck.pop(); hand.board.push(card); board.appendChild(cardEl(card, true, k)); }
        youHand.textContent = `You have: ${describe(hand.you.concat(hand.board))}`;
      }
      stage.textContent = ['Pre-flop', 'Flop', 'Turn', 'River'][street];
      mode('bet');
    };
    const deal = () => {
      if (bank.you < ANTE || bank.meet < ANTE) { bank.you = 500; bank.meet = 500; }
      deck = [];
      for (let r = 0; r < 13; r++) for (let s2 = 0; s2 < 4; s2++) deck.push([r, s2]);
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      hand = { you: [deck.pop(), deck.pop()], meet: [deck.pop(), deck.pop()], board: [] };
      [you, meet, board].forEach((el) => { el.innerHTML = ''; });
      youHand.textContent = ''; meetHand.textContent = ''; result.textContent = ''; root.classList.remove('win', 'lose');
      bank.you -= ANTE; bank.meet -= ANTE; pot = ANTE * 2;
      chipFly(ui.youChips, ui.potChips); chipFly(ui.meetChips, ui.potChips);
      showMoney();
      hand.you.forEach((c, i) => you.appendChild(cardEl(c, true, i)));
      hand.meet.forEach((c, i) => meet.appendChild(cardEl(c, false, i + 2)));
      street = -1;
      dealStreet();
    };
    const bet = (amt) => {
      // Meet always calls, he likes to see your cards.
      bank.you -= amt; bank.meet -= amt; pot += amt * 2;
      chipFly(ui.youChips, ui.potChips); setTimeout(() => chipFly(ui.meetChips, ui.potChips), 200);
      result.textContent = `You bet ${amt}. Meet calls.`;
      showMoney();
      dealStreet();
    };
    btns.deal.addEventListener('click', deal);
    btns.check.addEventListener('click', () => { result.textContent = 'You check. Meet checks.'; dealStreet(); });
    btns.bet25.addEventListener('click', () => bet(25));
    btns.bet100.addEventListener('click', () => bet(100));
    btns.fold.addEventListener('click', () => { reveal(meet); award('meet', `You fold. Meet takes ${pot} chips.`); });
    showTally();
    showMoney();
  }

  /* ---------- Bollywood: movie-night slot machine + a real film to watch ---------- */
  const REELS = [
    ['Action', 'Romance', 'Drama', 'Comedy', 'Thriller', 'Musical', 'Family'],
    ['Rainy night', 'Friday night', 'Sunday afternoon', 'After exams', 'Family dinner', 'Late night', 'Road trip'],
    ['Samosa', 'Popcorn', 'Pani puri', 'Masala chai', 'Vada pav', 'Bhel puri', 'Pav bhaji'],
  ];
  const FILMS = {
    Action: [['Sholay', 1975, 'Two small-time crooks, a vengeful ex-cop and the most famous villain in Hindi cinema.'], ['Dhoom 2', 2006, 'Slick heists, fast bikes and a thief who’s always a step ahead.'], ['War', 2019, 'An agent hunts down his rogue mentor across the globe.'], ['Pathaan', 2023, 'A spy comeback built for the big screen.']],
    Romance: [['Dilwale Dulhania Le Jayenge', 1995, 'The Europe-to-Punjab love story that ran in one Mumbai cinema for decades.'], ['Jab We Met', 2007, 'A chatterbox and a heartbroken businessman miss the same train.'], ['Yeh Jawaani Hai Deewani', 2013, 'Old friends, a mountain trek and the life you didn’t plan.'], ['Rockstar', 2011, 'A musician chases heartbreak to find his sound.']],
    Drama: [['Lagaan', 2001, 'Villagers bet their taxes on a cricket match against the British.'], ['Taare Zameen Par', 2007, 'An art teacher sees what everyone missed in a struggling kid.'], ['Dangal', 2016, 'A father trains his daughters into champion wrestlers.'], ['Swades', 2004, 'A NASA scientist comes home and can’t leave things as they are.']],
    Comedy: [['3 Idiots', 2009, 'Engineering college, friendship and a very different idea of success.'], ['Hera Pheri', 2000, 'Three broke men and one wrong-number ransom call.'], ['Andaz Apna Apna', 1994, 'Two slackers compete for an heiress, a cult classic.'], ['Munna Bhai M.B.B.S.', 2003, 'A gangster enrols in medical school to please his father.']],
    Thriller: [['Andhadhun', 2018, 'A “blind” pianist walks straight into a murder.'], ['Kahaani', 2012, 'A pregnant woman searches Kolkata for her missing husband.'], ['Drishyam', 2015, 'A father builds the perfect alibi, frame by frame.'], ['Special 26', 2013, 'Fake tax raids, real loot, inspired by a true heist.']],
    Musical: [['Om Shanti Om', 2007, 'Reincarnation, revenge and a love letter to 70s Bollywood.'], ['Kabhi Khushi Kabhie Gham', 2001, 'Family, feuds and a soundtrack you already know.'], ['Rock On!!', 2008, 'Old bandmates get a second shot at the stage.'], ['Dil Chahta Hai', 2001, 'Three friends, Goa and growing up.']],
    Family: [['Zindagi Na Milegi Dobara', 2011, 'A bachelor road trip through Spain that changes three lives.'], ['Kapoor & Sons', 2016, 'A messy, funny, honest family reunion.'], ['Piku', 2015, 'A road trip with a very particular father.'], ['Hum Saath-Saath Hain', 1999, 'A joint family, big feelings and bigger celebrations.']],
  };
  function movie(root) {
    const drums = [...root.querySelectorAll('[data-drum]')];
    const btn = root.querySelector('[data-spin]');
    const card = root.querySelector('[data-movie-card]');
    let busy = false, lastTitle = '';
    // Each reel is a vertical drum: scroll / swipe / ▲▼ / arrow keys; the centred item is the pick.
    const itemH = (d) => d.querySelector('.opt').offsetHeight;
    const index = (d) => Math.max(0, Math.min(d.children.length - 1, Math.round(d.scrollTop / itemH(d))));
    const mark = (d) => { const i = index(d); [...d.children].forEach((o, k) => { o.classList.toggle('on', k === i); o.setAttribute('aria-selected', String(k === i)); }); };
    const go = (d, i, smooth = true) => { d.scrollTo({ top: Math.max(0, Math.min(d.children.length - 1, i)) * itemH(d), behavior: smooth && !reduced ? 'smooth' : 'auto' }); };
    drums.forEach((d, n) => {
      let t = 0;
      d.addEventListener('scroll', () => { mark(d); clearTimeout(t); t = setTimeout(() => go(d, index(d)), 120); }, { passive: true });
      d.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); go(d, index(d) + (e.key === 'ArrowDown' ? 1 : -1)); } });
      const reel = d.closest('.reel');
      reel.querySelectorAll('[data-nudge]').forEach((b) => b.addEventListener('click', () => go(d, index(d) + Number(b.dataset.nudge))));
      [...d.children].forEach((o, k) => o.addEventListener('click', () => go(d, k)));
      go(d, [0, 0, 3][n], false); // start on Action · Rainy night · Masala chai
      mark(d);
    });
    btn.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      const picks = drums.map((d) => d.children[index(d)].textContent);
      root.classList.add('open', 'lit');
      card.hidden = true;
      // a quick spin through each drum before settling back on the choice
      drums.forEach((d, i) => {
        const keep = index(d);
        d.classList.add('spinning');
        let k = keep;
        const iv = setInterval(() => { k = (k + 1) % d.children.length; go(d, k, false); }, reduced ? 300 : 60);
        setTimeout(() => {
          clearInterval(iv);
          d.classList.remove('spinning');
          go(d, keep);
          if (i === drums.length - 1) {
            const pool = FILMS[picks[0]].filter((f) => f[0] !== lastTitle);
            const [title, year, pitch] = pool[Math.floor(Math.random() * pool.length)];
            lastTitle = title;
            card.querySelector('[data-movie-title]').textContent = `${title} (${year})`;
            card.querySelector('[data-movie-pitch]').textContent = `${pitch} Perfect for a ${picks[1].toLowerCase()} with ${picks[2].toLowerCase()}.`;
            card.hidden = false;
            anim(card, { opacity: [0, 1], y: [20, 0], rotate: [3, 0] }, { type: 'spring', stiffness: 200, damping: 16 });
            party(0.8, `Tonight: ${title}`);
            busy = false;
            btn.disabled = false;
            btn.textContent = 'Suggest another';
            setTimeout(() => root.classList.remove('lit'), 2400);
          }
        }, (reduced ? 200 : 650) + i * (reduced ? 150 : 350));
      });
    });
  }

  function mount(scope) {
    if (M && M.inView && !reduced) {
      scope.querySelectorAll('.interests .fun').forEach((sec, i) => {
        if (sec.dataset.popped) return;
        sec.dataset.popped = 'true';
        sec.style.opacity = '0';
        M.inView(sec, () => {
          M.animate(sec, { opacity: [0, 1], y: [90, 0], rotate: [i % 2 ? 3 : -3, 0], scale: [0.94, 1] }, { type: 'spring', stiffness: 110, damping: 15 });
        }, { margin: '0px 0px -10% 0px' });
      });
    }
    const run = (sel, fn) => scope.querySelectorAll(sel).forEach((el) => { if (el.dataset.ready) return; el.dataset.ready = 'true'; fn(el); });
    run('[data-f1-live]', f1);
    run('[data-cricket-live]', cricket);
    run('[data-holdem]', holdem);
    run('[data-movie]', movie);
  }

  window.Interests = { mount, score5, best, cmp, parseScore };
})();
