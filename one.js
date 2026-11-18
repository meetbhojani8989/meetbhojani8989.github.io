/* One-page home: vertical scrolling becomes sideways travel through the panels.
   The page is a normal vertical stack until html.hx is set (desktop, motion allowed, framer-motion
   loaded); then the track is pinned and moved with a little inertia, and each panel animates in. */
(() => {
  const root = document.documentElement;
  const M = window.Motion;
  const EASE = [0.16, 1, 0.3, 1];
  window.__oneReady = true;
  const hx = root.classList.contains('hx') && Boolean(M && M.animate && M.inView);
  if (!hx) root.classList.remove('hx');
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* ---------- Shared: text splitting, counters, copy, live market ---------- */
  // Wrap each word of a heading in .wd and each letter in .ch, keeping inline tags like <em>.
  function splitChars(el) {
    const walk = (node) => [...node.childNodes].forEach((child) => {
      if (child.nodeType === 1) { walk(child); return; }
      if (child.nodeType !== 3 || !child.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const wd = document.createElement('span');
        wd.className = 'wd';
        [...part].forEach((c) => { const ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c; wd.appendChild(ch); });
        frag.appendChild(wd);
      });
      child.replaceWith(frag);
    });
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    el.querySelectorAll('.wd').forEach((w) => w.setAttribute('aria-hidden', 'true'));
  }

  const statement = document.querySelector('[data-words]');
  const words = [];
  if (statement) {
    statement.innerHTML = statement.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    words.push(...statement.querySelectorAll('.w'));
    if (!hx) words.forEach((w) => w.classList.add('lit'));
  }

  function countUp(el) {
    const to = Number(el.dataset.count), from = Number(el.dataset.from || 0);
    const dec = (el.dataset.count.split('.')[1] || '').length, pre = el.dataset.prefix || '';
    M.animate(from, to, { duration: to > 100 && !dec ? 1.8 : 1.4, ease: EASE, onUpdate: (v) => { el.textContent = pre + v.toFixed(dec); } });
  }

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); } catch (e) { location.href = `mailto:${btn.dataset.copy}`; return; }
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2200);
    });
  });

  if (window.MarketUI) window.MarketUI.mount(document);

  /* ---------- Built for everyone: live ticker tape and the candlestick backdrop ---------- */
  const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA', 'JPM', 'XOM', 'JNJ', 'KO', 'AMZN'];
  const tickerTrack = document.querySelector('.ticker-track');
  const fillTicker = (items) => {
    if (!tickerTrack) return;
    const row = items.map((t) => (t.price == null
      ? `<span><b>${t.symbol}</b></span>`
      : `<span><b>${t.symbol}</b>${t.price.toFixed(2)}<i class="${t.change >= 0 ? 'up' : 'down'}">${t.change >= 0 ? '▲' : '▼'} ${Math.abs(t.change).toFixed(2)}%</i></span>`)).join('');
    tickerTrack.innerHTML = row + row; // two copies so the tape can loop seamlessly
  };
  fillTicker(TICKERS.map((symbol) => ({ symbol })));
  fetch(`/api/stock?symbols=${TICKERS.join(',')}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((data) => {
    const items = (data.results || []).filter((d) => d && d.price != null && d.prevClose)
      .map((d) => ({ symbol: d.symbol, price: d.price, change: (d.price / d.prevClose - 1) * 100 }));
    if (items.length) fillTicker(items);
  }).catch(() => {});

  // A month of candles that trends upward; they appear as the statement is read.
  const candleSvg = document.querySelector('.candles');
  const candles = [];
  if (candleSvg) {
    const N = 34, W = 1000, H = 400;
    candleSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let price = 120, seed = 7;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const data = Array.from({ length: N }, () => {
      const open = price;
      price = Math.max(40, price + (rand() - 0.42) * 22);
      return { open, close: price, high: Math.max(open, price) + rand() * 10, low: Math.min(open, price) - rand() * 10 };
    });
    const lo = Math.min(...data.map((d) => d.low)), hi = Math.max(...data.map((d) => d.high));
    const y = (v) => H - 10 - (v - lo) / (hi - lo) * (H - 20);
    const step = W / N;
    const pts = data.map((d, i) => [i * step + step / 2, y(d.close)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    candleSvg.innerHTML = '<defs><linearGradient id="c-glow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fafafa" stop-opacity=".16"/><stop offset="1" stop-color="#fafafa" stop-opacity="0"/></linearGradient></defs>'
      + data.map((d, i) => {
        const cx = pts[i][0], up = d.close >= d.open;
        const top = y(Math.max(d.open, d.close)), h = Math.max(2, Math.abs(y(d.open) - y(d.close)));
        return `<g><line class="wick ${up ? 'w-up' : 'w-down'}" x1="${cx}" x2="${cx}" y1="${y(d.high)}" y2="${y(d.low)}"/><rect class="${up ? 'body-up' : 'body-down'}" x="${cx - step * 0.28}" y="${top}" width="${step * 0.56}" height="${h}" rx="1.5"/></g>`;
      }).join('')
      + `<path class="c-line" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="${line}"/>`;
    candles.push(...candleSvg.querySelectorAll('g'));
    const cLine = candleSvg.querySelector('.c-line');
    const tag = document.createElement('span');
    tag.className = 'c-tag';
    tag.setAttribute('aria-hidden', 'true');
    candleSvg.after(tag);
    // reveal the first n candles, draw the line to the nth close and park the tag on it
    window.__candles = (n) => {
      candles.forEach((g, k) => g.classList.toggle('on', k < n));
      cLine.setAttribute('stroke-dashoffset', n ? (1 - (n - 1) / (N - 1)).toFixed(4) : '1');
      tag.classList.toggle('on', n > 0);
      if (!n) return;
      const k = n - 1, r = candleSvg.getBoundingClientRect(), pr = candleSvg.parentElement.getBoundingClientRect();
      const chg = (data[k].close / data[0].open - 1) * 100;
      tag.textContent = `${chg >= 0 ? '▲ +' : '▼ '}${chg.toFixed(1)}%`;
      tag.style.transform = `translate(${(r.left - pr.left + pts[k][0] / W * r.width + 18).toFixed(1)}px, ${(r.top - pr.top + pts[k][1] / H * r.height - 14).toFixed(1)}px)`;
    };
    if (!hx) requestAnimationFrame(() => window.__candles(N));
  }

  /* ---------- Split-flap boards (vanilla port of 21st.dev's Split Flap Display) ---------- */
  const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,:+-%/';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function makeBoard(el, rows, cols) {
    const cells = [];
    for (let r = 0; r < rows; r += 1) {
      const row = document.createElement('div');
      row.className = 'flap-row';
      for (let k = 0; k < cols; k += 1) {
        const f = document.createElement('span');
        f.className = 'flap';
        f.innerHTML = '<span class="ft"><i> </i></span><span class="fb"><i> </i></span><span class="ff"><i></i></span><span class="fk"><i></i></span>';
        row.appendChild(f);
        cells.push({ el: f, ch: ' ', i: [...f.children].map((s) => s.firstChild), job: 0 });
      }
      el.appendChild(row);
    }
    // one mechanical flap: top leaf falls away, bottom leaf swings down with the new character
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
      // a few random characters rattle past before the board settles on the target
      const spins = 2 + ((k * 7) % 4);
      for (let s = 0; s <= spins && job === c.job; s += 1) {
        const next = s === spins ? target : CHARS[1 + Math.floor(Math.random() * (CHARS.length - 1))];
        if (next === c.ch && s === spins) break;
        await flip(c, next, 34);
      }
    };
    return {
      set(lines) {
        let n = 0;
        lines.forEach((line, r) => {
          const text = line.toUpperCase().padEnd(cols, ' ').slice(0, cols);
          [...text].forEach((ch, k) => {
            const c = cells[r * cols + k];
            const t = CHARS.includes(ch) ? ch : ' ';
            if (c.ch !== t) run(c, t, (k + r * 3) * 24, n += 1);
          });
        });
      },
    };
  }
  // The big departure board in the black section: starts when it scrolls into view, then rotates.
  const bigEl = document.querySelector('[data-flap="big"]');
  if (bigEl) {
    const board = makeBoard(bigEl, 4, 18);
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
    }, { threshold: 0.35 }).observe(bigEl);
  }
  const roleEl = document.querySelector('[data-flap="role"]');
  const roleBoard = roleEl && makeBoard(roleEl, 2, 16);
  const ROLE_ROWS = [['MARKETING INTERN', 'MAY-AUG     2025'], ['FINANCE INTERN', 'MAY-AUG     2026']];

  if (!hx) return;

  /* ---------- Entrances ---------- */
  document.querySelectorAll('[data-split]').forEach(splitChars);

  // Blocks arriving together rise out of a soft blur, one after another.
  let batch = [], queued = false;
  const flush = () => {
    M.animate(batch, { opacity: [0, 1], y: [30, 0], filter: ['blur(8px)', 'blur(0px)'] }, { duration: 0.9, ease: EASE, delay: M.stagger(0.08) });
    batch = []; queued = false;
  };
  document.querySelectorAll('[data-in]').forEach((el) => {
    M.inView(el, () => {
      if (el.matches('.int-grid li')) {
        // interest tiles tumble in like dealt cards
        M.animate(el, { opacity: [0, 1], y: [60, 0], rotate: [Math.random() * 10 - 5, 0] }, { type: 'spring', stiffness: 170, damping: 15, delay: [...el.parentElement.children].indexOf(el) * 0.06 });
        return;
      }
      if (el.matches('.about-photo')) {
        M.animate(el, { opacity: [0, 1], clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'] }, { duration: 1.2, ease: [0.76, 0, 0.24, 1] });
        M.animate(el.querySelector('img'), { scale: [1.18, 1] }, { duration: 1.6, ease: EASE });
        return;
      }
      batch.push(el);
      if (!queued) { queued = true; requestAnimationFrame(flush); }
    }, { amount: 0.2 });
  });

  // Headings rise letter by letter.
  document.querySelectorAll('[data-split]').forEach((el) => {
    M.inView(el, () => {
      M.animate(el.querySelectorAll('.ch'), { y: ['110%', '0%'] }, { duration: 0.9, ease: EASE, delay: M.stagger(0.018) });
      if (el.matches('.htalk')) {
        // "Let's talk." keeps a gentle wave once it has landed
        setTimeout(() => M.animate(el.querySelectorAll('.ch'), { y: ['0%', '-8%', '0%'] }, { duration: 1.6, ease: 'easeInOut', delay: M.stagger(0.06), repeat: Infinity, repeatDelay: 2.4 }), 1400);
      }
    }, { amount: 0.3 });
  });

  document.querySelectorAll('.hbars').forEach((el) => M.inView(el, () => {
    M.animate(el.querySelectorAll('i'), { scaleY: [0, 1] }, { type: 'spring', stiffness: 150, damping: 20, delay: M.stagger(0.1, { startDelay: 0.2 }) });
    M.animate(el.querySelectorAll('b'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.5, delay: M.stagger(0.1, { startDelay: 0.5 }) });
  }, { amount: 0.4 }));

  document.querySelectorAll('.windex').forEach((el) => M.inView(el, () => {
    M.animate(el.querySelectorAll('li'), { opacity: [0, 1], x: [-40, 0] }, { duration: 0.8, ease: EASE, delay: M.stagger(0.1, { startDelay: 0.3 }) });
  }, { amount: 0.4 }));

  document.querySelectorAll('[data-count]').forEach((el) => M.inView(el, () => countUp(el), { amount: 0.6 }));

  /* ---------- The engine: a vertical page with chapters that pin and travel sideways ---------- */
  const tracks = [...document.querySelectorAll('.h-scroller')].map((scroller) => ({
    scroller, track: scroller.querySelector('.h-track'), max: 0, top: 0, x: 0, target: 0,
  }));
  const panels = [...document.querySelectorAll('.hpanel')];
  const ghosts = [...document.querySelectorAll('.hghost')];
  const projNos = [...document.querySelectorAll('.proj-no')];
  const statementPanel = document.querySelector('.p-statement');
  const yrs = document.querySelector('.p-exp');
  const odo = document.querySelector('.odo-col');
  const digits = odo ? [...odo.children] : [];
  const yrRoles = [...document.querySelectorAll('.yrole')];
  const yrsPath = document.querySelector('.yrs-path');
  const yrsPin = document.querySelector('.yrs-pin');
  const odoWin = document.querySelector('.odo-win');
  let yrShown = -1;
  const odoWrap = document.querySelector('.odo');
  let landed = false;
  const wxRows = [...document.querySelectorAll('.windex a')].map((a) => ({ a, panel: document.querySelector(a.hash) }));
  const amber = document.querySelector('.p-amber');
  const amberPin = amber && amber.closest('.h-pin');
  const bar = document.querySelector('.hprogress b');
  const label = document.querySelector('.hp-label');
  const count = document.querySelector('.hp-count');
  const navLinks = [...document.querySelectorAll('.hnav-links a')];
  const navTargets = navLinks.map((a) => panels.indexOf(document.querySelector(a.hash)));
  let raf = 0, lastIndex = -1, lastY = scrollY;

  // Tone morph: every chapter owns a tone, and the whole page dissolves between them as you scroll.
  const TONES = [
    ['.p-statement, .p-amber, .p-contact', '#1B1A18'], // graphite
    ['.p-work-intro, .p-project, .p-facts', '#E6E2DA'], // stone
    ['.p-interests, .p-int-cards', '#DDD7CC'],           // sand
  ];
  const BONE = '#EFECE6';
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const tones = panels.map((p) => rgb((TONES.find(([sel]) => p.matches(sel)) || [0, BONE])[1]));
  let lastTone = '';
  function morph() {
    const area = innerWidth * innerHeight;
    let r = 0, g = 0, b = 0, w = 0;
    panels.forEach((p, k) => {
      const rc = p.getBoundingClientRect();
      const vis = Math.max(0, Math.min(innerWidth, rc.right) - Math.max(0, rc.left)) * Math.max(0, Math.min(innerHeight, rc.bottom) - Math.max(0, rc.top));
      if (!vis) return;
      const a = Math.pow(vis / area, 4); // steep: a chapter holds its tone, then hands over quickly
      r += tones[k][0] * a; g += tones[k][1] * a; b += tones[k][2] * a; w += a;
    });
    if (!w) return;
    const tone = `rgb(${Math.round(r / w)}, ${Math.round(g / w)}, ${Math.round(b / w)})`;
    if (tone !== lastTone) { lastTone = tone; root.style.setProperty('--page', tone); }
  }

  function layout() {
    tracks.forEach((t) => {
      t.max = Math.max(0, t.track.scrollWidth - innerWidth);
      t.scroller.style.height = `${t.max + innerHeight}px`;
    });
    tracks.forEach((t) => { t.top = t.scroller.getBoundingClientRect().top + scrollY; });
  }

  // How far a panel has travelled through the screen, 0 → 1, along whichever axis it moves on.
  const progress = (el) => {
    const r = el.getBoundingClientRect();
    return el.closest('.h-track')
      ? (innerWidth - r.left) / (innerWidth + r.width)
      : (innerHeight - r.top) / (innerHeight + r.height);
  };

  function frame() {
    raf = 0;
    let moving = false;
    tracks.forEach((t) => {
      t.target = Math.min(t.max, Math.max(0, scrollY - t.top));
      const d = t.target - t.x;
      t.x = Math.abs(d) < 0.4 ? t.target : t.x + d * 0.12;
      if (t.x !== t.target) moving = true;
      t.track.style.transform = `translate3d(${-t.x.toFixed(2)}px, 0, 0)`;
    });

    // speed of travel, used to lean the big background words
    const vel = Math.max(-1, Math.min(1, (scrollY - lastY) / 60));
    lastY = scrollY;

    ghosts.forEach((g) => {
      const p = progress(g.parentElement);
      if (p < -0.2 || p > 1.2) return;
      // in vertical chapters the words still drift sideways as you scroll down
      g.style.transform = `translate3d(${((0.5 - p) * innerWidth * 0.45).toFixed(1)}px, 0, 0) skewX(${(vel * -10).toFixed(2)}deg)`;
    });
    projNos.forEach((n) => {
      const p = progress(n.closest('.hpanel'));
      if (p > -0.2 && p < 1.2) n.style.transform = `translate3d(${((p - 0.5) * 160).toFixed(1)}px, 0, 0)`;
    });

    if (statementPanel) {
      const lit = Math.round(clamp01((progress(statementPanel) - 0.3) / 0.35) * words.length);
      words.forEach((w, k) => w.classList.toggle('lit', k < lit));
    }
    // Experience: hold on 2025, then the 6 rises from behind with an overshoot and shoves the 5 out
    if (yrs && odo) {
      const r = yrs.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const p = clamp01(-r.top / Math.max(1, r.height - innerHeight));
        const t = clamp01((p - 0.35) / 0.25);
        const e = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.5) : 1;
        odo.style.transform = `translateY(${(-e * 50).toFixed(2)}%)`;
        digits[0].style.transform = `rotateX(${(Math.min(1, e) * 75).toFixed(1)}deg) scale(${(1 - Math.min(1, e) * 0.2).toFixed(3)})`;
        digits[0].style.opacity = (1 - Math.min(1, e) * 0.9).toFixed(3);
        digits[1].style.transform = `rotateX(${(-Math.max(0, 1 - e) * 75).toFixed(1)}deg)`;
        if (yrsPath) yrsPath.style.setProperty('--yp', clamp01((p - 0.05) / 0.85).toFixed(3));
        // 2026 floods the whole scene in cobalt, spreading out from the 6
        const fl = clamp01((t - 0.42) / 0.38);
        const wr = odoWin.getBoundingClientRect(), pr = yrsPin.getBoundingClientRect();
        yrsPin.style.setProperty('--fx', `${(wr.left + wr.width / 2 - pr.left).toFixed(0)}px`);
        yrsPin.style.setProperty('--fy', `${(wr.top + wr.height / 2 - pr.top).toFixed(0)}px`);
        yrsPin.style.setProperty('--fl', fl.toFixed(3));
        yrsPin.classList.toggle('flooded', fl > 0.3);
        // the moment the 6 slams in, the 202 recoils like dominoes
        if (t > 0.55 && !landed) { landed = true; odoWrap.classList.remove('boom'); void odoWrap.offsetWidth; odoWrap.classList.add('boom'); }
        if (t < 0.3 && landed) { landed = false; odoWrap.classList.remove('boom'); }
        const idx = t > 0.5 ? 1 : 0;
        if (idx !== yrShown) {
          yrShown = idx;
          yrRoles.forEach((el, k) => el.classList.toggle('on', k === idx));
          if (roleBoard) roleBoard.set(ROLE_ROWS[idx]);
        }
      }
    }
    if (statementPanel && candles.length) {
      const on = Math.round(clamp01((progress(statementPanel) - 0.1) / 0.38) * candles.length);
      if (on !== frame.lastOn) { frame.lastOn = on; window.__candles(on); }
    }
    // the project index fills in as each project slides closer
    wxRows.forEach((w) => { if (w.panel) w.a.style.setProperty('--f', clamp01(progress(w.panel) / 0.5).toFixed(3)); });
    // Amber: the lights go out
    if (amberPin) amberPin.classList.toggle('is-dark', progress(amber) > 0.3);

    morph();
    const docMax = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${(docMax > 0 ? scrollY / docMax : 0).toFixed(4)})`;
    let index = panels.findIndex((p) => {
      const r = p.getBoundingClientRect();
      return r.left <= innerWidth / 2 && r.right > innerWidth / 2 && r.top <= innerHeight / 2 && r.bottom > innerHeight / 2;
    });
    if (index >= 0 && index !== lastIndex) {
      lastIndex = index;
      label.textContent = panels[index].dataset.label || '';
      count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(panels.length).padStart(2, '0')}`;
      let active = -1;
      navTargets.forEach((t, k) => { if (t >= 0 && t <= index) active = k; });
      navLinks.forEach((a, k) => a.classList.toggle('on', k === active));
    }

    if (moving || Math.abs(vel) > 0.01) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // Menu links and keyboard focus scroll to the right place, sideways chapters included.
  const yFor = (panel) => {
    const t = tracks.find((tr) => tr.track.contains(panel));
    return t ? t.top + Math.min(t.max, panel.offsetLeft) : panel.getBoundingClientRect().top + scrollY;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const panel = document.querySelector(a.hash);
    if (!panel || !panel.classList.contains('hpanel')) return;
    e.preventDefault();
    scrollTo({ top: yFor(panel), behavior: 'smooth' });
  });
  document.addEventListener('focusin', (e) => {
    const panel = e.target.closest && e.target.closest('.h-track .hpanel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    if (r.left < 0 || r.left > innerWidth - 40) scrollTo({ top: yFor(panel), behavior: 'instant' });
  });

  /* ---------- Ambient: the ticker and the seals keep moving, faster while you scroll ---------- */
  const seals = [...document.querySelectorAll('.seal')].map((el) => ({ el, a: Math.random() * 360 }));
  let tickX = 0, boost = 0, ambY = scrollY, ambRaf = 0, visible = 0;
  const ambient = () => {
    const dy = Math.abs(scrollY - ambY); ambY = scrollY;
    boost += (Math.min(dy, 120) - boost) * 0.08;
    if (tickerTrack && tickerTrack.scrollWidth) {
      tickX -= 0.5 + boost * 0.25;
      const half = tickerTrack.scrollWidth / 2;
      if (-tickX >= half) tickX += half;
      tickerTrack.style.transform = `translate3d(${tickX.toFixed(1)}px, 0, 0)`;
    }
    seals.forEach((s) => { s.a += 0.18 + boost * 0.12; s.el.style.transform = `rotate(${s.a.toFixed(2)}deg)`; });
    ambRaf = visible > 0 ? requestAnimationFrame(ambient) : 0;
  };
  // only animate while the ticker or the contact seal are on screen
  const ambIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { visible += e.isIntersecting ? 1 : -1; });
    visible = Math.max(0, visible);
    if (visible && !ambRaf) ambRaf = requestAnimationFrame(ambient);
  });
  document.querySelectorAll('.ticker, .p-contact').forEach((el) => ambIO.observe(el));

  /* ---------- Cards lean toward the pointer and spring back ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('[data-tilt], .int-row li').forEach((card) => {
      const spring = { type: 'spring', stiffness: 220, damping: 20 };
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        M.animate(card, { rotateY: (px - 0.5) * 12, rotateX: (0.5 - py) * 10, transformPerspective: 900 }, spring);
      });
      card.addEventListener('pointerleave', () => M.animate(card, { rotateY: 0, rotateX: 0 }, { type: 'spring', stiffness: 160, damping: 16 }));
    });
  }

  layout();
  tracks.forEach((t) => { t.x = Math.min(t.max, Math.max(0, scrollY - t.top)); });
  frame();
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { layout(); kick(); });
  if (document.fonts) document.fonts.ready.then(() => { layout(); kick(); });
  addEventListener('load', () => { layout(); kick(); });
})();
