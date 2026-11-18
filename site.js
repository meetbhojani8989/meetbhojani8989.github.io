/* Motion layer, framer-motion (vanilla DOM build, window.Motion).
   Motion is structural: it reveals hierarchy and answers interaction, never competes with content. */
(() => {
  const root = document.documentElement;
  const M = window.Motion;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = Boolean(M && M.animate && !reduced);
  window.__motionReady = true;
  if (!live) root.classList.remove('motion');

  // Shared motion tokens: one rhythm across the site.
  const EASE_OUT = [0.16, 1, 0.3, 1];
  const EASE_IN = [0.4, 0, 1, 1];
  const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };
  const SOFT_SPRING = { type: 'spring', stiffness: 170, damping: 22 };

  const animate = (...args) => (live ? M.animate(...args) : null);
  let cleanups = [];
  const track = (fn) => { if (typeof fn === 'function') cleanups.push(fn); };
  const teardown = () => { cleanups.forEach((fn) => fn()); cleanups = []; };

  /* ---------- Scroll reveals ---------- */
  // Elements entering the viewport in the same frame are batched so they stagger together.
  let queue = [];
  let queued = false;
  function enqueue(el) {
    queue.push(el);
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      const batch = queue;
      queue = [];
      queued = false;
      animate(batch, { opacity: [0, 1], y: [18, 0] }, { duration: 0.8, ease: EASE_OUT, delay: M.stagger(0.07) });
    });
  }

  function revealLines(heading) {
    heading.classList.add('lit');
    const chars = heading.querySelectorAll('.char');
    if (chars.length) {
      animate(chars, { y: ['110%', '0%'], rotateX: [-60, 0], opacity: [0, 1] }, { duration: 1.1, ease: EASE_OUT, delay: M.stagger(0.035, { startDelay: 0.15 }) });
      return;
    }
    const lines = heading.querySelectorAll('.line > span');
    animate(lines, { y: ['110%', '0%'] }, { duration: 1, ease: EASE_OUT, delay: M.stagger(0.09, { startDelay: 0.05 }) });
  }

  // Split [data-chars] headings into per-letter spans; the heading keeps its accessible name.
  function splitChars(heading) {
    if (heading.dataset.split) return;
    heading.dataset.split = 'true';
    heading.setAttribute('aria-label', [...heading.querySelectorAll('.line')].map((l) => l.textContent.trim()).join(' '));
    heading.querySelectorAll('.line > span').forEach((line) => {
      line.setAttribute('aria-hidden', 'true');
      line.style.transform = 'none';
      const walk = (node) => [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          [...child.textContent].forEach((ch) => {
            const wrap = document.createElement('span');
            wrap.className = 'char-wrap';
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = ch;
            wrap.appendChild(span);
            frag.appendChild(wrap);
          });
          child.replaceWith(frag);
        } else walk(child);
      });
      walk(line);
    });
  }

  // Hairline rules draw across as list rows arrive.
  function addRules(scope) {
    scope.querySelectorAll('.chapter, .experience-item, .capability').forEach((row) => {
      if (row.querySelector(':scope > .rule')) return;
      const rule = document.createElement('i');
      rule.className = 'rule';
      rule.setAttribute('aria-hidden', 'true');
      row.appendChild(rule);
    });
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (parent) parent.appendChild(node);
    return node;
  };

  /* ---------- Project visuals (data taken from the project files) ---------- */
  // Portfolio workbook: 1Y return and annualized volatility of the ten holdings, plus weight.
  const HOLDINGS = [
    ['AAPL', 24.7, 30.1, 18.1], ['MSFT', 32.8, 1.0, 14.2], ['NVDA', 37.8, 29.3, 10.2], ['GOOGL', 31.7, 41.5, 11.3],
    ['TSLA', 45.5, -12.1, 8.1], ['JPM', 22.5, 7.7, 7.1], ['XOM', 25.9, 44.0, 7.9], ['JNJ', 19.2, 34.9, 6.9],
    ['KO', 18.9, 29.0, 7.8], ['AMZN', 34.5, 29.0, 8.4],
  ];
  const MAX_VOL = 35, TARGET = 10;

  function buildScatter(box) {
    if (box.dataset.built) return;
    box.dataset.built = 'true';
    const W = 320, H = 220, L = 30, R = 10, T = 10, B = 26;
    const x = (v) => L + ((v - 15) / 35) * (W - L - R);
    const y = (v) => T + (1 - (v + 20) / 70) * (H - T - B);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' }, box);
    svgEl('rect', { class: 'zone', x: x(15), y: y(50), width: x(MAX_VOL) - x(15), height: y(TARGET) - y(50) }, svg);
    const axis = svgEl('g', { class: 'axis' }, svg);
    svgEl('line', { x1: L, x2: W - R, y1: y(0), y2: y(0) }, axis);
    svgEl('line', { x1: L, x2: L, y1: T, y2: H - B }, axis);
    [[20, '20%'], [30, '30%'], [40, '40%'], [50, '50%']].forEach(([v, t]) => { const n = svgEl('text', { x: x(v), y: H - 8, 'text-anchor': 'middle' }, axis); n.textContent = t; });
    [[-20, '−20%'], [0, '0%'], [25, '25%'], [50, '50%']].forEach(([v, t]) => { const n = svgEl('text', { x: L - 5, y: y(v) + 3, 'text-anchor': 'end' }, axis); n.textContent = t; });
    svgEl('line', { class: 'limit', x1: x(MAX_VOL), x2: x(MAX_VOL), y1: T, y2: H - B }, svg);
    svgEl('line', { class: 'limit', x1: L, x2: W - R, y1: y(TARGET), y2: y(TARGET) }, svg);
    const lim = svgEl('text', { class: 'lbl', x: x(MAX_VOL) + 4, y: T + 8 }, svg); lim.textContent = 'MAX VOL';
    const tgt = svgEl('text', { class: 'lbl', x: W - R, y: y(TARGET) - 4, 'text-anchor': 'end' }, svg); tgt.textContent = 'TARGET';
    const tip = document.createElement('div');
    tip.className = 'scatter-tip';
    box.appendChild(tip);
    const dots = HOLDINGS.map(([t, vol, ret, w]) => {
      const g = svgEl('g', {}, svg);
      const c = svgEl('circle', { class: `dot${vol > MAX_VOL ? ' over' : ''}`, cx: x(vol), cy: y(ret), r: 3 + w * 0.42, tabindex: 0, role: 'img', 'aria-label': `${t}: return ${ret}%, volatility ${vol}%, weight ${w}%` }, g);
      // Labels sit right of the dot, except where a neighbour would collide.
      const left = t === 'AMZN';
      const lab = svgEl('text', { class: 'tick', x: left ? x(vol) - 6 - w * 0.42 : x(vol) + 6 + w * 0.42, y: y(ret) + 3, 'text-anchor': left ? 'end' : 'start' }, g); lab.textContent = t;
      const show = () => {
        box.classList.add('has-focus');
        dots.forEach((d) => d.classList.toggle('on', d === c));
        const r = box.getBoundingClientRect(), cr = c.getBoundingClientRect();
        tip.innerHTML = `<b>${t}</b>1Y return ${ret > 0 ? '+' : ''}${ret}%<br>Volatility ${vol}%<br>Weight ${w}%${vol > MAX_VOL ? '<br>⚠ Above vol limit' : ''}`;
        tip.style.left = `${cr.left - r.left + cr.width / 2}px`;
        tip.style.top = `${cr.top - r.top}px`;
        tip.classList.add('show');
      };
      const hide = () => { box.classList.remove('has-focus'); tip.classList.remove('show'); };
      c.addEventListener('pointerenter', show); c.addEventListener('focus', show);
      c.addEventListener('pointerleave', hide); c.addEventListener('blur', hide);
      return c;
    });
    return dots;
  }

  // Amber: the logo at the centre, its abilities in orbit, and a live transcript of what it's doing.
  // Every exchange mirrors a capability from the Amber report.
  const AMBER_SCRIPT = [
    [0, '“Open my presentation”', 'Opening Keynote, verified it’s in front ✓'],
    [1, 'Pinch in the air', 'Click at the cursor, verified ✓'],
    [2, 'Swipe right across the table', 'Next slide sent to Keynote'],
    [3, 'Push a hand toward the laptop', 'Reflected tone shifted, push detected'],
    [4, '“Explain this chart”', 'Reading the selection on-device, then explaining…'],
    [5, '“No, the other window”', 'Correction saved locally for next time'],
  ];
  function buildAmber(el) {
    const box = el.querySelector('.amber');
    if (!box || box.dataset.built) return null;
    box.dataset.built = 'true';
    const nodes = [...box.querySelectorAll('.amber-node')];
    const you = box.querySelector('.you');
    const bot = box.querySelector('.bot');
    let i = 0, timer = 0, pending = 0;
    const show = (k) => {
      const [node, said, did] = AMBER_SCRIPT[k];
      nodes.forEach((n, j) => n.classList.toggle('on', j === node));
      you.textContent = said;
      bot.textContent = live ? '…' : did;
      if (!live) return;
      animate(you, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, ease: EASE_OUT });
      clearTimeout(pending);
      pending = setTimeout(() => {
        bot.textContent = did;
        animate(bot, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, ease: EASE_OUT });
        box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
      }, 900);
    };
    show(0);
    if (!live) return null;
    return {
      start: () => { clearInterval(timer); timer = setInterval(() => { i = (i + 1) % AMBER_SCRIPT.length; show(i); }, 3200); },
      stop: () => { clearInterval(timer); clearTimeout(pending); },
    };
  }

  const models = {
    dcf(el) {
      animate(el.querySelectorAll('.bar i'), { scaleY: [0, 1] }, { ...SOFT_SPRING, delay: M.stagger(0.09, { startDelay: 0.25 }) });
      animate(el.querySelectorAll('.bar span'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.5, ease: EASE_OUT, delay: M.stagger(0.09, { startDelay: 0.5 }) });
    },
    scatter(el) {
      const dots = el.querySelectorAll('.dot, .tick');
      animate(dots, { opacity: [0, 1] }, { duration: 0.5, delay: M.stagger(0.05, { startDelay: 0.3 }) });
      animate(el.querySelectorAll('.limit'), { opacity: [0, 0.5] }, { duration: 0.8, delay: 0.9 });
    },
    amber(el) {
      animate(el.querySelector('.amber-core'), { scale: [0.6, 1], opacity: [0, 1] }, { ...SOFT_SPRING, delay: 0.2 });
      animate(el.querySelectorAll('.amber-node'), { opacity: [0, 1] }, { duration: 0.5, delay: M.stagger(0.08, { startDelay: 0.5 }) });
    },
  };

  // Static structure for the visuals: built with or without motion so the content is always there.
  function setupViz(scope) {
    scope.querySelectorAll('.scatter').forEach(buildScatter);
    scope.querySelectorAll('[data-model="amber"]').forEach((el) => {
      const ctl = buildAmber(el);
      if (ctl) runWhileVisible(el, ctl.start, ctl.stop);
    });
    // Sensitivity grid: hovering a value lights up its WACC and growth headers.
    scope.querySelectorAll('[data-sens]').forEach((grid) => {
      const heads = grid.querySelectorAll('.h');
      const mark = (cell) => heads.forEach((h) => h.classList.toggle('hl', Boolean(cell) && (h.dataset.row === cell.dataset.row || h.dataset.col === cell.dataset.col)));
      grid.querySelectorAll('.c').forEach((c) => {
        c.tabIndex = 0;
        c.addEventListener('pointerenter', () => mark(c));
        c.addEventListener('focus', () => mark(c));
      });
      grid.addEventListener('pointerleave', () => mark(null));
      grid.addEventListener('focusout', () => mark(null));
    });
  }

  // Line-drawn backdrops (briefcase, light bulb, paper plane) sit behind a page, draw themselves in,
  // and dissolve as you scroll down, scrolling back up brings them back.
  function setupBriefcase(scope) {
    const bc = scope.querySelector('.backdrop');
    if (!bc) return;
    const shapes = bc.querySelectorAll('path, rect, line, circle');
    if (live) {
      shapes.forEach((s) => { s.setAttribute('pathLength', 1); s.style.strokeDasharray = 1; });
      animate(shapes, { strokeDashoffset: [1, 0] }, { duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: M.stagger(0.12, { startDelay: 0.3 }) });
    }
    let ticking = false;
    const update = () => {
      ticking = false;
      const p = clamp01(scrollY / (innerHeight * 0.55));
      bc.style.opacity = String(1 - p);
      bc.style.transform = `translateY(calc(-46% - ${p * 60}px)) scale(${1 + p * 0.06}) rotate(${p * -4}deg)`;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    track(() => removeEventListener('scroll', onScroll));
  }

  // Contact: the message form posts to FormSubmit, which forwards it to Meet's inbox.
  // Without JavaScript the form still submits normally.
  function setupMessage(scope) {
    const form = scope.querySelector('[data-message]');
    if (!form || form.dataset.ready) return;
    form.dataset.ready = 'true';
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const say = (text, kind) => { status.textContent = text; status.className = `form-status ${kind || ''}`; };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (data._honey) return;
      const missing = ['name', 'email', 'message'].find((k) => !String(data[k] || '').trim());
      if (missing) { say(`Please add your ${missing}.`, 'err'); form.elements[missing].focus(); return; }
      if (!form.elements.email.checkValidity()) { say('That email address doesn’t look right.', 'err'); form.elements.email.focus(); return; }
      button.disabled = true;
      say('Sending…');
      try {
        const res = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('send failed');
        form.reset();
        say('Thanks, your message is on its way. I’ll reply soon.', 'ok');
        flyPlane(button);
        if (live) animate(status, { opacity: [0, 1], y: [6, 0] }, { duration: 0.4, ease: EASE_OUT });
      } catch (error) {
        say('Something went wrong. Please email me directly at meetbhojani8989@gmail.com.', 'err');
      } finally {
        button.disabled = false;
      }
    });
  }

  function reveal(scope) {
    setupCopy(scope);
    setupViz(scope);
    setupBriefcase(scope);
    setupMessage(scope);
    if (window.MarketUI) window.MarketUI.mount(scope);
    if (window.Interests) window.Interests.mount(scope);
    if (!live) return;
    const opts = { margin: '0px 0px -8% 0px' };
    scope.querySelectorAll('[data-chars]').forEach(splitChars);
    addRules(scope);
    setupStatement(scope);
    setupJourney(scope);
    setupHoverPreview(scope);
    setupNameScatter(scope);
    setupHeroArt(scope);
    setupPortal(scope);
    setupKnock(scope);
    setupYears(scope);
    setupTalk(scope);
    setupWeight(scope);
    setupMarquee(scope);
    setupScramble(scope);
    setupCounters(scope);
    setupTilt(scope);
    setupSpotlight(scope);

    scope.querySelectorAll('.rule').forEach((rule) => {
      track(M.inView(rule.parentElement, () => {
        animate(rule, { scaleX: [0, 1] }, { duration: 1.2, ease: EASE_OUT, delay: 0.1 });
      }, opts));
    });

    scope.querySelectorAll('[data-lines]').forEach((heading) => {
      track(M.inView(heading, () => revealLines(heading), opts));
    });
    scope.querySelectorAll('[data-reveal]').forEach((el) => {
      track(M.inView(el, () => {
        enqueue(el);
        const kind = el.dataset.model;
        if (kind && models[kind]) models[kind](el);
      }, opts));
    });
    scope.querySelectorAll('.portrait-frame').forEach((frame) => {
      track(M.inView(frame, () => {
        animate(frame, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 1.2, ease: EASE_OUT });
        animate(frame.querySelector('img'), { scale: [1.15, 1] }, { duration: 1.6, ease: EASE_OUT });
      }, opts)); // clip-path makes IntersectionObserver report 0%, so trigger on any intersection
    });


    // Scroll cue nudges downward until someone takes the hint.
    const cue = scope.querySelector('.cue span');
    if (cue) {
      const bob = animate(cue, { y: [0, 5, 0] }, { duration: 1.8, ease: 'easeInOut', repeat: Infinity, delay: 1.6 });
      track(() => bob && bob.stop());
    }

    // Project visuals drift against the scroll for a touch of depth.
    scope.querySelectorAll('.bars').forEach((visual) => {
      track(M.scroll(M.animate(visual, { y: [24, -24] }, { ease: 'linear' }), { target: visual.closest('.model'), offset: ['start end', 'end start'] }));
    });
  }


  /* ---------- Home storytelling (scroll-scrubbed) ---------- */
  const desktop = () => matchMedia('(min-width: 761px)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // Words light up one by one as the statement is scrolled through.
  function setupStatement(scope) {
    const text = scope.querySelector('[data-words]');
    if (!text || !live || !desktop()) return;
    if (!text.dataset.split) {
      text.dataset.split = 'true';
      text.innerHTML = text.textContent.trim().split(/\s+/).map((w) => `<span class="word">${w} </span>`).join('');
    }
    const words = [...text.querySelectorAll('.word')];
    const n = words.length;
    track(M.scroll((progress) => {
      words.forEach((word, i) => { word.style.opacity = 0.12 + 0.88 * clamp01(progress * n * 1.1 - i); });
    }, { target: text, offset: ['start 0.85', 'end 0.45'] }));
  }

  // Pinned chapter track: vertical scroll drives horizontal travel; each chapter brings its own colour.
  function setupJourney(scope) {
    const journey = scope.querySelector('.journey');
    if (!journey || !live || !desktop()) return;
    const sticky = journey.querySelector('.journey-sticky');
    const trackEl = journey.querySelector('.journey-track');
    const bar = journey.querySelector('.journey-bar i');
    const count = journey.querySelector('[data-count]');
    const stops = [0, 0.15, 0.35, 0.65, 0.85, 1];
    const bg = M.transform(stops, ['#F5F5F7', '#F5F5F7', '#EDEDF0', '#EDEDF0', '#E8E8EC', '#E8E8EC']); // soft greys, never black
    const fg = M.transform(stops, ['#1D1D1F', '#1D1D1F', '#1D1D1F', '#1D1D1F', '#1D1D1F', '#1D1D1F']);
    let shown = 1;
    const panels = [...trackEl.querySelectorAll('.panel')];
    const steps = [...journey.querySelectorAll('[data-step]')];
    const markStep = (i) => steps.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    markStep(0);
    // Snap: each project holds the screen; one scroll gesture moves exactly one project,
    // then it lands with a "haptic" knock (a vibration where the device supports it).
    const last = panels.length - 1;
    const span = () => journey.offsetHeight - innerHeight;
    const yFor = (i) => journey.getBoundingClientRect().top + scrollY + (0.04 + (i / last) * 0.92) * span();
    const nearest = () => { let best = 0; for (let i = 1; i <= last; i++) if (Math.abs(yFor(i) - scrollY) < Math.abs(yFor(best) - scrollY)) best = i; return best; };
    const inside = () => scrollY > yFor(0) - 2 && scrollY < yFor(last) + 2;
    let current = 0, moving = null, gestureUsed = false, gestureTimer = 0, settleTimer = 0;
    const knock = (i) => {
      if (navigator.vibrate) navigator.vibrate(14);
      const panel = panels[i];
      M.animate(panel, { x: [0, -10, 6, -2, 0] }, { duration: 0.42, ease: 'easeOut' });
      M.animate(count.parentElement, { scale: [1, 1.18, 1] }, { duration: 0.35, ease: EASE_OUT });
      markStep(i);
    };
    const go = (i) => {
      i = Math.max(0, Math.min(last, i));
      current = i;
      if (moving) moving.stop();
      const from = scrollY, to = yFor(i);
      if (Math.abs(to - from) < 2) { knock(i); return; }
      // own rAF tween (an instant scrollTo per frame, so CSS smooth-scroll doesn't fight it)
      const t0 = performance.now(), dur = 850;
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      let raf = 0;
      moving = { stop: () => { cancelAnimationFrame(raf); moving = null; } };
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' });
        if (t < 1) raf = requestAnimationFrame(step); else { moving = null; knock(i); }
      };
      raf = requestAnimationFrame(step);
    };
    const onWheel = (e) => {
      if (!desktop() || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const dir = Math.sign(e.deltaY);
      if (!dir || !inside()) return;
      const at = moving ? current : nearest();
      // let the page carry on past the first and last project
      if (!moving && ((dir > 0 && at === last && scrollY >= yFor(last) - 4) || (dir < 0 && at === 0 && scrollY <= yFor(0) + 4))) return;
      e.preventDefault();
      clearTimeout(gestureTimer);
      gestureTimer = setTimeout(() => { gestureUsed = false; }, 220); // a gesture (incl. trackpad inertia) ends after a quiet gap
      if (moving || gestureUsed) return;
      gestureUsed = true;
      const off = scrollY - yFor(at);
      go(Math.abs(off) > 8 && Math.sign(off) !== dir ? at : at + dir); // between projects: settle back first
    };
    // Touch, keyboard and scrollbar: when scrolling settles between projects, glide to the nearest one.
    const onScroll = () => {
      clearTimeout(settleTimer);
      if (moving) return;
      settleTimer = setTimeout(() => {
        if (moving || !inside()) return;
        const i = nearest();
        if (Math.abs(yFor(i) - scrollY) > 6) go(i);
      }, 160);
    };
    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('scroll', onScroll, { passive: true });
    steps.forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.step))));
    track(() => { removeEventListener('wheel', onWheel); removeEventListener('scroll', onScroll); clearTimeout(settleTimer); clearTimeout(gestureTimer); if (moving) moving.stop(); });
    track(M.scroll((progress) => {
      const q = clamp01((progress - 0.04) / 0.92);
      trackEl.style.transform = `translate3d(${-q * (trackEl.scrollWidth - innerWidth)}px, 0, 0)`;
      sticky.style.backgroundColor = bg(q);
      sticky.style.color = fg(q);
      bar.style.transform = `scaleX(${q})`;
      const index = Math.round(q * 2) + 1;
      if (index !== shown) {
        shown = index;
        count.textContent = `0${index}`;
        M.animate(count, { y: [10, 0], opacity: [0, 1] }, { duration: 0.4, ease: EASE_OUT });
      }
    }, { target: journey, offset: ['start start', 'end end'] }));
  }

  // Work list: a preview card follows the pointer and slides between chapters.
  function setupHoverPreview(scope) {
    const card = scope.querySelector('.hover-preview');
    if (!card || !live || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const strip = card.querySelector('.hover-track');
    const list = scope.querySelector('.chapter-list');
    const follow = { type: 'spring', stiffness: 260, damping: 26, mass: 0.7 };
    let visible = false;
    const onMove = (event) => {
      const row = event.target.closest('[data-preview]');
      if (!row) return;
      M.animate(card, { x: event.clientX, y: event.clientY }, visible ? follow : { duration: 0 });
      M.animate(strip, { y: `${-Number(row.dataset.preview) * 100}%` }, SPRING);
      if (!visible) {
        visible = true;
        M.animate(card, { opacity: 1, scale: 1 }, { ...SPRING, opacity: { duration: 0.2 } });
      }
    };
    const onLeave = () => {
      visible = false;
      M.animate(card, { opacity: 0, scale: 0.6 }, { duration: 0.25, ease: EASE_IN });
    };
    list.addEventListener('pointermove', onMove);
    list.addEventListener('pointerleave', onLeave);
    track(() => { list.removeEventListener('pointermove', onMove); list.removeEventListener('pointerleave', onLeave); });
  }


  /* ---------- Signature effects ---------- */
  const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  const runWhileVisible = (el, start, stop) => {
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    io.observe(el);
    track(() => { io.disconnect(); stop(); });
  };

  // Hero badge: spins slowly on its own, faster with scroll speed, and reverses when scrolling up.
  function setupHeroArt(scope) {
    const art = scope.querySelector('.hero-art');
    if (!art) return;
    if (!live) return;
    const badge = art.querySelector('.badge');
    let angle = 0, boost = 0, lastY = scrollY, lastT = 0, raf = 0;
    const loop = (t) => {
      const dt = Math.min(48, t - (lastT || t)); lastT = t;
      const dy = scrollY - lastY; lastY = scrollY;
      boost += (Math.min(Math.abs(dy), 120) * 0.04 - boost) * 0.08;
      angle += (0.012 + boost * 0.05) * dt * (dy < 0 ? -1 : 1);
      badge.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    runWhileVisible(art, () => { if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); } }, () => { cancelAnimationFrame(raf); raf = 0; });
    animate(badge, { opacity: [0, 1], scale: [0.5, 1] }, { duration: 0.9, ease: EASE_OUT, delay: 0.8 });
    animate(art, { opacity: [0, 1] }, { duration: 0.4 });
  }

  // About: "MEET" in giant type with the photo showing through the letters. Scrolling zooms
  // into the word until it dissolves into the full photo, then "Hi, I'm Meet." lands on it.
  function setupKnock(scope) {
    const sec = scope.querySelector('.knock');
    if (!sec) return;
    if (!live || !desktop()) { sec.classList.add('static'); return; }
    const mask = sec.querySelector('.knock-mask');
    const hint = sec.querySelector('.knock-hint');
    const cap = sec.querySelector('.knock-caption');
    const photo = sec.querySelector('.knock-photo');
    track(M.scroll((p) => {
      const z = clamp01(p / 0.6);
      mask.style.transform = `scale(${(1 + Math.pow(z, 2.2) * 14).toFixed(3)})`;
      mask.style.opacity = String(1 - clamp01((p - 0.32) / 0.3));
      photo.style.transform = `scale(${(1.25 - 0.25 * clamp01(p / 0.75)).toFixed(3)})`;
      hint.style.opacity = String(1 - clamp01(p / 0.1));
      const c = clamp01((p - 0.62) / 0.2);
      cap.style.opacity = String(c);
      cap.style.transform = `translateY(${((1 - c) * 40).toFixed(1)}px)`;
    }, { target: sec, offset: ['start start', 'end end'] }));
  }

  // Experience: a giant "202_" whose last digit rolls from 5 to 6 as you scroll; each year's
  // role swaps in beside it.
  function setupYears(scope) {
    const sec = scope.querySelector('.years');
    if (!sec) return;
    if (!live || !desktop()) { sec.classList.add('static'); return; }
    const col = sec.querySelector('.odo-col');
    const roles = [...sec.querySelectorAll('.yr')];
    const bar = sec.querySelector('.years-bar i');
    let shown = 0;
    track(M.scroll((p) => {
      // hold on 2025, roll with a little overshoot, hold on 2026
      const t = clamp01((p - 0.35) / 0.25);
      const ease = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.5) : 1;
      col.style.transform = `translateY(${(-ease * 50).toFixed(2)}%)`;
      bar.style.transform = `scaleX(${p.toFixed(3)})`;
      const idx = t > 0.5 ? 1 : 0;
      if (idx !== shown) { shown = idx; roles.forEach((r, i) => r.classList.toggle('on', i === idx)); }
    }, { target: sec, offset: ['start start', 'end end'] }));
  }

  // Contact: two giant bands of type drift in opposite directions and surge/skew with scroll speed.
  function setupTalk(scope) {
    const rows = [...scope.querySelectorAll('.talk-row')];
    if (!rows.length || !live) return;
    const state = rows.map((row) => ({ track: row.querySelector('.talk-track'), x: 0, base: row.dataset.dir === '1' ? 1 : -1 }));
    let lastY = scrollY, boost = 0, skew = 0, lastT = 0, raf = 0;
    const loop = (t) => {
      const dt = Math.min(48, t - (lastT || t)); lastT = t;
      const dy = scrollY - lastY; lastY = scrollY;
      boost += (Math.min(Math.abs(dy), 90) * 0.3 - boost) * 0.1;
      skew += (Math.max(-14, Math.min(14, dy * 0.4)) - skew) * 0.12;
      state.forEach((s) => {
        const half = s.track.scrollWidth / 2;
        s.x += s.base * (0.06 + boost * 0.05) * dt;
        if (s.x <= -half) s.x += half;
        if (s.x > 0) s.x -= half;
        s.track.style.transform = `translate3d(${s.x}px, 0, 0) skewX(${(skew * s.base).toFixed(2)}deg)`;
      });
      raf = requestAnimationFrame(loop);
    };
    runWhileVisible(rows[0].parentElement, () => { if (!raf) { lastT = 0; lastY = scrollY; raf = requestAnimationFrame(loop); } }, () => { cancelAnimationFrame(raf); raf = 0; });
  }

  // "Copy my email", copies, then flips its label to "Copied ✓" for a moment.
  function setupCopy(scope) {
    scope.querySelectorAll('[data-copy]').forEach((btn) => {
      if (btn.dataset.ready) return;
      btn.dataset.ready = 'true';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(btn.dataset.copy); } catch (e) { location.href = `mailto:${btn.dataset.copy}`; return; }
        btn.classList.add('copied');
        btn.setAttribute('aria-label', 'Email copied');
        setTimeout(() => { btn.classList.remove('copied'); btn.removeAttribute('aria-label'); }, 2200);
      });
    });
  }

  // A paper plane launches from the send button and flies off the top-right of the screen.
  function flyPlane(from) {
    if (!live || !from) return;
    const r = from.getBoundingClientRect();
    const plane = document.createElement('div');
    plane.className = 'plane-fly';
    plane.setAttribute('aria-hidden', 'true');
    plane.innerHTML = '<svg viewBox="0 0 64 64"><path d="M4 30 L60 6 L40 58 L29 38 Z M60 6 L29 38"/></svg>';
    document.body.appendChild(plane);
    const x0 = r.left + r.width / 2 - 32, y0 = r.top - 20;
    M.animate(plane, {
      x: [x0, x0 + 120, innerWidth * 0.6, innerWidth + 120],
      y: [y0, y0 - 140, innerHeight * 0.15, -160],
      rotate: [0, -12, 8, -4],
      scale: [0.6, 1.2, 1, 0.7],
    }, { duration: 1.8, ease: 'easeInOut' }).then(() => plane.remove());
  }

  // Portal: scrolling opens a soft moss circle over the page; inside, two rings of words
  // spin in 3D around "Where finance meets code". On phones / reduced motion it's a static
  // black section whose rings turn on their own (or not at all).
  function setupPortal(scope) {
    const sec = scope.querySelector('.portal');
    if (!sec) return;
    if (!live || !desktop()) { sec.classList.add('static'); return; }
    const ink = sec.querySelector('.portal-ink');
    const hint = sec.querySelector('.portal-hint');
    const center = sec.querySelector('.portal-center');
    const rings = [...sec.querySelectorAll('.ring')].map((el, k) => ({ el, dir: k ? 1 : -1, words: [...el.children] }));
    track(M.scroll((p) => {
      const open = clamp01(p / 0.3);
      const eased = 1 - Math.pow(1 - open, 3);
      ink.style.clipPath = `circle(${(eased * 78).toFixed(2)}% at 50% 50%)`;
      hint.style.opacity = String(1 - open * 1.6);
      hint.style.transform = `scale(${1 + open * 0.6})`;
      const show = clamp01((p - 0.18) / 0.2);
      const out = clamp01((p - 0.86) / 0.14);
      rings.forEach(({ el, dir, words }) => {
        const spin = p * 520 * dir;
        el.style.transform = `rotateX(var(--tilt)) rotateY(${spin.toFixed(2)}deg) scale(${(1 - out * 0.25).toFixed(3)})`;
        words.forEach((w, i) => {
          const angle = ((i * 45 + spin) % 360 + 360) % 360;
          const facing = Math.cos(angle * Math.PI / 180);
          w.style.opacity = String(((0.2 + 0.8 * Math.max(0, facing)) * show * (1 - out * 0.7)).toFixed(3));
        });
      });
      center.style.opacity = String(clamp01((p - 0.28) / 0.14));
      center.style.transform = `scale(${(0.85 + 0.15 * clamp01((p - 0.28) / 0.2)).toFixed(3)})`;
    }, { target: sec, offset: ['start start', 'end end'] }));
  }

  // The name responds to the pointer: each letter's weight swells with proximity (Inter is variable),
  // and when nobody is touching it a slow wave of weight rolls through the letters.
  function setupWeight(scope) {
    const name = scope.querySelector('[data-weight]');
    const chars = name ? [...name.querySelectorAll('.char')] : [];
    if (!live || !chars.length) return;
    const MIN = 300, MAX = 900, BASE = 600, RADIUS = 260;
    const cur = chars.map(() => BASE);
    let target = chars.map(() => BASE);
    let pointer = null, lastMove = 0, raf = 0;
    const onMove = (e) => { pointer = { x: e.clientX, y: e.clientY }; lastMove = performance.now(); };
    const onLeave = () => { pointer = null; };
    const loop = (t) => {
      if (pointer && t - lastMove < 2500) {
        target = chars.map((c) => {
          const r = c.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - pointer.x, r.top + r.height / 2 - pointer.y);
          const k = Math.max(0, 1 - d / RADIUS);
          return MIN + (MAX - MIN) * k * k;
        });
      } else {
        target = chars.map((_, i) => BASE + Math.sin(t * 0.0018 - i * 0.55) * 220);
      }
      chars.forEach((c, i) => {
        cur[i] += (target[i] - cur[i]) * 0.14;
        c.style.setProperty('--w', cur[i].toFixed(0));
      });
      raf = requestAnimationFrame(loop);
    };
    addEventListener('pointermove', onMove, { passive: true });
    name.addEventListener('pointerleave', onLeave);
    track(() => { removeEventListener('pointermove', onMove); name.removeEventListener('pointerleave', onLeave); });
    // Let the letters land before the weight starts moving.
    const start = setTimeout(() => runWhileVisible(name, () => { if (!raf) raf = requestAnimationFrame(loop); }, () => { cancelAnimationFrame(raf); raf = 0; }), 1600);
    track(() => clearTimeout(start));
  }

  // The name breaks apart as you scroll away: every letter on its own trajectory.
  function setupNameScatter(scope) {
    const hero = scope.querySelector('.hero');
    const wraps = hero ? [...hero.querySelectorAll('.char-wrap')] : [];
    if (!live || !wraps.length) return;
    wraps.forEach((wrap, i) => {
      const dir = i % 2 ? 1 : -1;
      const anim = M.animate(wrap, {
        y: [0, -(120 + Math.random() * 380)],
        x: [0, dir * (20 + Math.random() * 120)],
        rotate: [0, dir * (10 + Math.random() * 50)],
        opacity: [1, 0.15],
      }, { ease: 'linear' });
      track(M.scroll(anim, { target: hero, offset: ['start start', 'end start'] }));
    });
  }

  // Marquee: drifts on its own, then surges, reverses and skews with scroll velocity.
  function setupMarquee(scope) {
    const marquee = scope.querySelector('.marquee');
    if (!marquee || !live) return;
    const trackEl = marquee.querySelector('.marquee-track');
    let x = 0, dir = -1, boost = 0, skew = 0, lastY = scrollY, lastT = 0, raf = 0;
    const loop = (t) => {
      const dt = Math.min(48, t - (lastT || t)); lastT = t;
      const dy = scrollY - lastY; lastY = scrollY;
      if (dy) dir = dy > 0 ? -1 : 1;
      boost += (Math.min(Math.abs(dy), 80) * 0.25 - boost) * 0.1;
      skew += (Math.max(-12, Math.min(12, dy * 0.35)) - skew) * 0.12;
      x += dir * (0.05 + boost * 0.06) * dt;
      const half = trackEl.scrollWidth / 2;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      trackEl.style.transform = `translate3d(${x}px, 0, 0) skewX(${skew}deg)`;
      raf = requestAnimationFrame(loop);
    };
    runWhileVisible(marquee, () => { if (!raf) { lastT = 0; lastY = scrollY; raf = requestAnimationFrame(loop); } }, () => { cancelAnimationFrame(raf); raf = 0; });
  }

  // Labels decode from noise into their text.
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01ΣΔσρ';
  function scramble(el) {
    if (el.dataset.scrambled) return;
    el.dataset.scrambled = 'true';
    const final = el.textContent;
    el.setAttribute('aria-label', final);
    const total = 700, start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / total);
      const solved = Math.floor(p * final.length);
      el.textContent = final.split('').map((ch, i) => (i < solved || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
      if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    };
    requestAnimationFrame(tick);
  }
  function setupScramble(scope) {
    if (!live) return;
    scope.querySelectorAll('.eyebrow, .journey .meta, .panel .meta').forEach((el) => {
      if (el.children.length) return;
      track(M.inView(el, () => scramble(el), { margin: '0px 0px -8% 0px' }));
    });
  }

  // Numbers count up when they arrive.
  function setupCounters(scope) {
    if (!live) return;
    scope.querySelectorAll('[data-count-to]').forEach((el) => {
      const to = Number(el.dataset.countTo), from = Number(el.dataset.countFrom || 0);
      el.textContent = from;
      track(M.inView(el, () => {
        M.animate(from, to, { duration: to > 100 ? 2.2 : 1.6, ease: EASE_OUT, onUpdate: (val) => { el.textContent = Math.round(val); } });
      }, { amount: 0.6 }));
    });
  }

  // Diagrams tilt in 3D toward the pointer with a moving glare; always spring back on leave.
  function setupTilt(scope) {
    if (!live || !finePointer()) return;
    scope.querySelectorAll('[data-tilt]').forEach((card) => {
      if (!card.querySelector('.glare')) {
        const glare = document.createElement('i');
        glare.className = 'glare';
        card.appendChild(glare);
      }
      const spring = { type: 'spring', stiffness: 220, damping: 20 };
      const move = (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--gx', `${px * 100}%`);
        card.style.setProperty('--gy', `${py * 100}%`);
        M.animate(card, { rotateY: (px - 0.5) * 14, rotateX: (0.5 - py) * 12, transformPerspective: 1000, scale: 1.02 }, spring);
      };
      const leave = () => M.animate(card, { rotateY: 0, rotateX: 0, scale: 1 }, { type: 'spring', stiffness: 160, damping: 18 });
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      track(() => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave); });
    });
  }

  // A warm spotlight follows the cursor across the closing section.
  function setupSpotlight(scope) {
    const finale = scope.querySelector('.finale');
    if (!finale || !live || !finePointer()) return;
    const move = (e) => {
      const r = finale.getBoundingClientRect();
      finale.style.setProperty('--mx', `${e.clientX - r.left}px`);
      finale.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    finale.addEventListener('pointermove', move);
    track(() => finale.removeEventListener('pointermove', move));
  }

  /* ---------- Navigation ---------- */
  const nav = document.querySelector('.nav');
  const lens = nav && nav.querySelector('.glass-lens');
  const toggle = nav && nav.querySelector('.menu-toggle');
  const sheet = document.getElementById('nav-sheet');

  function pageOf(url) {
    const file = new URL(url, location.href).pathname.split('/').pop();
    return !file ? 'index.html' : file.endsWith('.html') ? file : `${file}.html`;
  }

  function markCurrent() {
    const page = pageOf(location.href);
    document.querySelectorAll('.nav a[href$=".html"], .nav-sheet a').forEach((link) => {
      if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  let lensVisible = false;
  function placeLens(link, instant) {
    if (!lens) return;
    if (!link || !link.offsetParent) {
      animate(lens, { opacity: 0 }, { duration: 0.2 });
      if (!live) lens.style.opacity = 0;
      lensVisible = false;
      return;
    }
    const outer = nav.getBoundingClientRect();
    const inner = link.getBoundingClientRect();
    const to = { x: inner.left - outer.left, y: inner.top - outer.top, width: inner.width, height: inner.height };
    if (!live || instant || !lensVisible) {
      lens.style.transform = `translate(${to.x}px, ${to.y}px)`;
      Object.assign(lens.style, { width: `${to.width}px`, height: `${to.height}px` });
      if (live) {
        M.animate(lens, { ...to }, { duration: 0 });
        M.animate(lens, { opacity: 1 }, { duration: 0.25 });
      } else lens.style.opacity = 1;
    } else {
      M.animate(lens, { ...to, opacity: 1 }, SPRING);
    }
    lensVisible = true;
  }
  const restingLink = () => nav.querySelector('.nav-links [aria-current="page"]');

  function setupNav() {
    if (!nav) return;
    animate(nav, { opacity: [0, 1], y: [-14, 0] }, { duration: 0.9, ease: EASE_OUT });

    nav.addEventListener('pointermove', (event) => {
      const box = nav.getBoundingClientRect();
      nav.style.setProperty('--glass-x', `${event.clientX - box.left}px`);
      nav.style.setProperty('--glass-y', `${event.clientY - box.top}px`);
      nav.classList.add('is-active');
    });
    nav.addEventListener('pointerleave', () => {
      nav.classList.remove('is-active');
      placeLens(restingLink());
    });
    nav.querySelectorAll('.nav-links a').forEach((link) => {
      link.addEventListener('pointerenter', () => placeLens(link));
      link.addEventListener('focus', () => placeLens(link));
    });
    nav.addEventListener('focusout', (event) => {
      if (!nav.contains(event.relatedTarget)) placeLens(restingLink());
    });
    addEventListener('resize', () => placeLens(restingLink(), true));
    document.fonts && document.fonts.ready.then(() => placeLens(restingLink(), true));
    placeLens(restingLink(), true);

    if (toggle && sheet) {
      toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
      addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          setMenu(false);
          toggle.focus();
        }
      });
      document.addEventListener('pointerdown', (event) => {
        if (toggle.getAttribute('aria-expanded') === 'true' && !sheet.contains(event.target) && !toggle.contains(event.target)) setMenu(false);
      });
    }
  }

  let menuAnim = null;
  function setMenu(open) {
    if (!sheet || (toggle.getAttribute('aria-expanded') === 'true') === open) return;
    toggle.setAttribute('aria-expanded', String(open));
    if (menuAnim) menuAnim.stop();
    if (open) {
      sheet.hidden = false;
      if (!live) return;
      menuAnim = M.animate(sheet, { opacity: [0, 1], y: [-10, 0], scale: [0.97, 1] }, { duration: 0.45, ease: EASE_OUT });
      M.animate(sheet.querySelectorAll('a'), { opacity: [0, 1], y: [10, 0] }, { duration: 0.5, ease: EASE_OUT, delay: M.stagger(0.045, { startDelay: 0.06 }) });
    } else {
      if (!live) { sheet.hidden = true; return; }
      // Exit is quicker than entry; the final state is set regardless of how the animation ends.
      const anim = M.animate(sheet, { opacity: 0, y: -6, scale: 0.98 }, { duration: 0.18, ease: EASE_IN });
      menuAnim = anim;
      anim.then(() => { if (toggle.getAttribute('aria-expanded') === 'false') sheet.hidden = true; });
    }
  }

  /* ---------- Press feedback ---------- */
  function setupPress() {
    if (!live) return;
    document.addEventListener('pointerdown', (event) => {
      const el = event.target.closest('[data-press]');
      if (!el) return;
      M.animate(el, { scale: 0.97 }, { type: 'spring', stiffness: 700, damping: 32 });
      const release = () => {
        M.animate(el, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 22 });
        removeEventListener('pointerup', release);
        removeEventListener('pointercancel', release);
      };
      addEventListener('pointerup', release);
      addEventListener('pointercancel', release);
    });
  }

  /* ---------- Page transitions ---------- */
  const wipe = (() => {
    const el = document.createElement('div');
    el.className = 'wipe';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="stairs">${'<b></b>'.repeat(5)}</div><span></span><i></i>`;
    document.body.appendChild(el);
    return { el, stairs: el.querySelectorAll('.stairs b'), label: el.querySelector('span'), line: el.querySelector('i') };
  })();
  const cache = new Map();
  let currentUrl = location.href.split('#')[0];
  let navigating = null;

  function isInternalPage(link) {
    const url = new URL(link.href, location.href);
    // the home page (Signal) is its own document: load it normally so its styles and scripts run
    if (/(^|\/)(index\.html)?$/.test(url.pathname)) return false;
    return url.origin === location.origin && /\.html$|\/$/.test(url.pathname) && !link.hasAttribute('download') && link.target !== '_blank';
  }

  function load(href) {
    if (!cache.has(href)) {
      cache.set(href, fetch(href).then((res) => {
        if (!res.ok) throw new Error('Unable to load page');
        return res.text();
      }).catch((error) => { cache.delete(href); throw error; }));
    }
    return cache.get(href);
  }

  async function visit(url, push = true) {
    const href = url.href.split('#')[0];
    if (href === currentUrl) return;
    const token = (navigating = {});
    const current = document.querySelector('main');
    try {
      const html = await load(href);
      if (token !== navigating) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('main');
      if (!next) throw new Error('Missing page content');
      if (live && current) {
        // Five stripes rise one after another, name the destination, then lift away to reveal it.
        wipe.label.textContent = doc.title.split(' · ')[0];
        animate(current, { opacity: 0.4, y: -40 }, { duration: 0.5, ease: EASE_IN });
        animate(wipe.label, { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, ease: EASE_OUT, delay: 0.35 });
        animate(wipe.line, { scaleX: [0, 1] }, { duration: 0.55, ease: EASE_OUT, delay: 0.4 });
        await M.animate(wipe.stairs, { y: ['101%', '0%'] }, { duration: 0.5, ease: [0.76, 0, 0.24, 1], delay: M.stagger(0.06) });
        if (token !== navigating) { M.animate(wipe.stairs, { y: '101%' }, { duration: 0 }); M.animate([wipe.label, wipe.line], { opacity: 0 }, { duration: 0 }); return; }
      }
      teardown();
      document.title = doc.title;
      document.body.className = doc.body.className;
      const incoming = document.importNode(next, true);
      current.replaceWith(incoming);
      if (push) history.pushState({}, '', url.href);
      currentUrl = href;
      scrollTo({ top: 0, behavior: 'instant' });
      markCurrent();
      placeLens(restingLink(), true);
      if (live) M.animate(nav, { y: 0, opacity: 1 }, SPRING);
      reveal(incoming);
      incoming.focus({ preventScroll: true });
      if (live) {
        await new Promise((r) => setTimeout(r, 200));
        M.animate([wipe.label, wipe.line], { opacity: 0 }, { duration: 0.25, ease: EASE_IN });
        M.animate(wipe.stairs, { y: ['0%', '-101%'] }, { duration: 0.55, ease: [0.76, 0, 0.24, 1], delay: M.stagger(0.06, { startDelay: 0.08 }) });
      }
    } catch (error) {
      location.assign(url.href);
    }
  }

  // Going to the home page is a full page load: the stripes cover this page first, the home page lifts them.
  const HOME_SECTIONS = { about: 'About', career: 'Career', experience: 'Experience', contact: 'Contact', work: 'Work' };
  function isHomeLink(link) {
    const url = new URL(link.href, location.href);
    return url.origin === location.origin && /(^|\/)(index\.html)?$/.test(url.pathname) && !link.hasAttribute('download') && link.target !== '_blank';
  }
  async function leaveTo(href, label) {
    wipe.label.textContent = label;
    const current = document.querySelector('main');
    if (current) animate(current, { opacity: 0.4, y: -40 }, { duration: 0.5, ease: EASE_IN });
    animate(wipe.label, { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, ease: EASE_OUT, delay: 0.35 });
    animate(wipe.line, { scaleX: [0, 1] }, { duration: 0.55, ease: EASE_OUT, delay: 0.4 });
    await Promise.race([M.animate(wipe.stairs, { y: ['101%', '0%'] }, { duration: 0.5, ease: [0.76, 0, 0.24, 1], delay: M.stagger(0.06) }), new Promise((r) => setTimeout(r, 1000))]);
    try { sessionStorage.setItem('signal-wipe', label); } catch (e) { /* private mode: just navigate */ }
    location.assign(href);
  }
  // Arriving from the home page: the page starts covered (html.arriving), then the stripes lift away.
  function arriveThroughStripes() {
    let label = null;
    try { label = sessionStorage.getItem('signal-wipe'); sessionStorage.removeItem('signal-wipe'); } catch (e) { /* ignore */ }
    if (!label || !live) { document.documentElement.classList.remove('arriving'); return; }
    wipe.label.textContent = label;
    M.animate(wipe.stairs, { y: '0%' }, { duration: 0 });
    M.animate(wipe.label, { opacity: 1, y: 0 }, { duration: 0 });
    M.animate(wipe.line, { scaleX: 1 }, { duration: 0 });
    setTimeout(() => document.documentElement.classList.remove('arriving'), 30);
    setTimeout(() => {
      M.animate([wipe.label, wipe.line], { opacity: 0 }, { duration: 0.25, ease: EASE_IN });
      M.animate(wipe.stairs, { y: ['0%', '-101%'] }, { duration: 0.55, ease: [0.76, 0, 0.24, 1], delay: M.stagger(0.06, { startDelay: 0.08 }) });
    }, 220);
    setTimeout(() => document.documentElement.classList.remove('arriving'), 1500); // safety net
  }

  function setupRouter() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (live && isHomeLink(link)) {
        event.preventDefault();
        setMenu(false);
        const id = new URL(link.href, location.href).hash.slice(1);
        leaveTo(link.href, HOME_SECTIONS[id] || 'Home');
        return;
      }
      if (!isInternalPage(link)) return;
      const url = new URL(link.href, location.href);
      if (url.hash && url.href.split('#')[0] === currentUrl) {
        setMenu(false);
        return; // same-page anchor: native smooth scroll
      }
      event.preventDefault();
      setMenu(false);
      visit(url);
    });
    // Warm the cache on intent so transitions feel instant.
    document.addEventListener('pointerover', (event) => {
      const link = event.target.closest && event.target.closest('a');
      if (link && isInternalPage(link)) load(link.href.split('#')[0]).catch(() => {});
    });
    addEventListener('popstate', () => visit(new URL(location.href), false));
  }

  /* ---------- Ambient motion ---------- */
  function setupProgress() {
    if (!live || !M.scroll) return;
    const bar = document.createElement('div');
    bar.className = 'progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    M.scroll(M.animate(bar, { scaleX: [0, 1] }, { ease: 'linear' }));
  }

  // Nav steps aside while reading down, returns the moment you scroll up.
  function setupNavScroll() {
    if (!live || !nav) return;
    let last = scrollY;
    let hidden = false;
    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = scrollY;
        const menuOpen = toggle && toggle.getAttribute('aria-expanded') === 'true';
        const hide = !menuOpen && y > 160 && y > last + 4 && !nav.contains(document.activeElement);
        const show = y < last - 4 || y < 160;
        if (hide && !hidden) { hidden = true; M.animate(nav, { y: -90, opacity: 0 }, { duration: 0.35, ease: EASE_IN }); }
        else if (show && hidden) { hidden = false; M.animate(nav, { y: 0, opacity: 1 }, SPRING); }
        last = y;
      });
    }, { passive: true });
    nav.addEventListener('focusin', () => {
      if (hidden) { hidden = false; M.animate(nav, { y: 0, opacity: 1 }, SPRING); }
    });
  }

  // Magnetic controls lean toward the pointer, then spring home.
  function setupMagnetic() {
    if (!live || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let active = null;
    const release = (el) => M.animate(el, { x: 0, y: 0 }, { type: 'spring', stiffness: 300, damping: 15 });
    document.addEventListener('pointermove', (event) => {
      const el = event.target.closest && event.target.closest('[data-magnetic]');
      if (active && active !== el) { release(active); active = null; }
      if (!el) return;
      active = el;
      const box = el.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      M.animate(el, { x: dx * 0.25, y: dy * 0.35 }, { type: 'spring', stiffness: 350, damping: 20 });
    });
  }

  markCurrent();
  setupNav();
  setupProgress();
  setupNavScroll();
  setupMagnetic();
  setupPress();
  setupRouter();
  reveal(document);
  arriveThroughStripes();
})();
