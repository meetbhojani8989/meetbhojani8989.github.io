/* Stock model, the trading workbook, running live in the browser.
   Data: /api/stock (a year of daily closes). Maths mirrors the workbook:
   1Y return, annualized volatility (stdev × √252), Sharpe vs a 4% risk-free rate,
   maximum drawdown from the running peak, then Final score = 55% return score + 45% risk score,
   checked against the workbook's limits. Educational, not investment advice. */
(() => {
  if (window.MarketUI) return;

  const LIMITS = { rf: 0.04, target: 0.10, maxVol: 0.35, maxWeight: 0.20, maxDD: -0.30, minSharpe: 0.75 };
  const UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA', 'JPM', 'XOM', 'JNJ', 'KO', 'AMZN'];
  // Workbook snapshot (Portfolio sheet), used only if live data can't be reached.
  const SNAPSHOT = {
    AAPL: ['Apple Inc.', 0.301, 0.247], MSFT: ['Microsoft Corporation', 0.010, 0.328], NVDA: ['NVIDIA Corporation', 0.293, 0.378],
    GOOGL: ['Alphabet Inc.', 0.415, 0.317], TSLA: ['Tesla, Inc.', -0.121, 0.455], JPM: ['JPMorgan Chase & Co.', 0.077, 0.225],
    XOM: ['Exxon Mobil Corporation', 0.440, 0.259], JNJ: ['Johnson & Johnson', 0.349, 0.192], KO: ['The Coca-Cola Company', 0.290, 0.189],
    AMZN: ['Amazon.com, Inc.', 0.290, 0.345],
  };
  const PORTFOLIO_VALUE = 18630, TEST_AMOUNT = 2000;
  const M = window.Motion;
  const live = Boolean(M && M.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Model ---------- */
  function analyze(d) {
    const c = d.closes;
    const rets = [];
    for (let i = 1; i < c.length; i++) rets.push(c[i] / c[i - 1] - 1);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1));
    const vol = sd * Math.sqrt(252);
    const ret = c[c.length - 1] / c[0] - 1;
    let peak = c[0], dd = 0;
    c.forEach((v) => { peak = Math.max(peak, v); dd = Math.min(dd, v / peak - 1); });
    const high = Math.max(...c);
    const sharpe = (ret - LIMITS.rf) / vol;
    const day = d.prevClose ? d.price / d.prevClose - 1 : rets[rets.length - 1];
    return score({ ...d, ret, vol, dd, sharpe, day, fromHigh: d.price / high - 1, live: true });
  }

  // Piecewise-linear scale between anchor points, so close stocks get close (not identical) scores.
  function scale(x, pts) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    }
    return pts[pts.length - 1][1];
  }

  function score(m) {
    // Return score: 10% target = 3.5, 40%+ = 5. Risk score: start at 5, lose points for
    // volatility, drawdown and a weak Sharpe, steepest where the workbook's limits sit.
    const returnScore = scale(m.ret, [[-0.10, 1], [0, 2], [0.10, 3.5], [0.25, 4.5], [0.40, 5]]);
    const volPen = scale(m.vol, [[0.15, 0], [0.25, 0.5], [0.35, 1.5], [0.50, 2.5]]);
    const ddPen = m.dd == null ? 0 : scale(-m.dd, [[0.10, 0], [0.20, 0.5], [0.30, 1.5], [0.50, 2.5]]);
    const sharpePen = scale(m.sharpe, [[-0.5, 2], [0, 1.5], [0.75, 1], [1.5, 0]]);
    const riskScore = Math.max(0.5, 5 - volPen - ddPen - sharpePen);
    const final = returnScore * 0.55 + riskScore * 0.45;
    const checks = [
      { label: 'Return ≥ 10% target', ok: m.ret >= LIMITS.target, value: pct(m.ret, true) },
      { label: 'Volatility ≤ 35%', ok: m.vol <= LIMITS.maxVol, value: pct(m.vol) },
      { label: 'Sharpe ≥ 0.75', ok: m.sharpe >= LIMITS.minSharpe, value: m.sharpe.toFixed(2) },
    ];
    if (m.dd != null) checks.push({ label: 'Drawdown above −30%', ok: m.dd >= LIMITS.maxDD, value: pct(m.dd) });
    const passed = checks.filter((x) => x.ok).length;
    const signal = final >= 3.5 && passed === checks.length ? 'pass' : final >= 2.5 ? 'watch' : 'weak';
    const trigger = m.dd != null && m.dd < LIMITS.maxDD ? 'Drawdown > 30%' : m.vol > LIMITS.maxVol ? 'Volatility > 35%' : m.sharpe < LIMITS.minSharpe ? 'Sharpe < 0.75' : m.ret < LIMITS.target ? 'Return < 10% target' : null;
    return { ...m, returnScore, riskScore, final, checks, passed, signal, trigger };
  }

  const VERDICT = {
    pass: { label: 'Passes the screen', short: 'PASSES', advice: 'Clears every risk limit, worth a closer look.' },
    watch: { label: 'Watch', short: 'WATCH', advice: 'Mixed signals, some limits are met, some aren’t.' },
    weak: { label: 'Doesn’t pass', short: 'WEAK SCREEN', advice: 'Breaks the model’s risk rules, avoid for now.' },
  };

  /* ---------- Formatting ---------- */
  function pct(v, sign) { const s = (v * 100).toFixed(1) + '%'; return sign && v > 0 ? '+' + s : s.replace('-', '−'); }
  const money = (v, cur) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }).format(v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const niceDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // The line is one path (so it can draw itself in); a hard-stop gradient along x paints each day's
  // segment green when the close rose and red when it fell. The area and end dot follow the overall move.
  let sparkId = 0;
  function spark(closes, cls) {
    if (!closes || closes.length < 2) return '';
    const W = 300, H = 80, min = Math.min(...closes), max = Math.max(...closes);
    const xs = closes.map((v, i) => i / (closes.length - 1) * W);
    const pts = closes.map((v, i) => `${xs[i].toFixed(1)},${(H - 4 - (v - min) / (max - min || 1) * (H - 8)).toFixed(1)}`);
    const last = pts[pts.length - 1].split(',');
    const id = `spark-move-${++sparkId}`;
    const stops = closes.slice(1).map((v, i) => {
      const color = v >= closes[i] ? 'var(--up)' : 'var(--down)';
      const a = (xs[i] / W * 100).toFixed(3), b = (xs[i + 1] / W * 100).toFixed(3);
      return `<stop offset="${a}%" style="stop-color:${color}"/><stop offset="${b}%" style="stop-color:${color}"/>`;
    }).join('');
    const trend = closes[closes.length - 1] >= closes[0] ? 'up' : 'down';
    const day = closes[closes.length - 1] >= closes[closes.length - 2] ? 'up' : 'down';
    return `<svg class="spark spark-${trend} ${cls || ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">${stops}</linearGradient></defs><path class="spark-area" d="M0,${H} L${pts.join(' L')} L${W},${H} Z"/><path class="spark-line" pathLength="1" stroke="url(#${id})" d="M${pts.join(' L')}"/><circle class="spark-dot spark-dot-${day}" cx="${last[0]}" cy="${last[1]}" r="3"/></svg>`;
  }

  function narrative(m, rank, total) {
    const v = VERDICT[m.signal];
    const parts = [
      `<b>${esc(m.symbol)}</b> tops today’s screen of ${total} stocks with a score of <b>${m.final.toFixed(2)} / 5</b>.`,
      `It’s ${m.ret >= 0 ? 'up' : 'down'} <b>${pct(Math.abs(m.ret))}</b> over the past year with <b>${pct(m.vol)}</b> volatility, a Sharpe of <b>${m.sharpe.toFixed(2)}</b>, ${m.sharpe >= LIMITS.minSharpe ? 'above' : 'below'} the 0.75 floor.`,
    ];
    if (m.dd != null) parts.push(`Its worst fall from a peak was <b>${pct(m.dd)}</b>, ${m.dd >= LIMITS.maxDD ? 'inside' : 'outside'} the −30% limit, and it sits ${pct(Math.abs(m.fromHigh))} below its 52-week high.`);
    parts.push(m.trigger ? `Verdict: <b>${v.label}</b>, watch the ${m.trigger.toLowerCase()} trigger.` : `Verdict: <b>${v.label}</b>, it clears every rule in the model.`);
    return parts.join(' ');
  }

  /* ---------- Data ---------- */
  let universePromise = null;
  function loadUniverse() {
    if (universePromise) return universePromise;
    universePromise = fetch(`/api/stock?symbols=${UNIVERSE.join(',')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((data) => data.results.map(analyze))
      .catch(() => Object.entries(SNAPSHOT).map(([symbol, [name, ret, vol]]) => score({
        symbol, name, ret, vol, sharpe: (ret - LIMITS.rf) / vol, dd: null, live: false, closes: null,
      })))
      .then((list) => list.sort((a, b) => b.final - a.final || b.sharpe - a.sharpe));
    return universePromise;
  }

  /* ---------- Views ---------- */
  function renderSotd(el, list) {
    const top = list[0];
    const v = VERDICT[top.signal];
    const lastDate = top.dates ? niceDate(top.dates[top.dates.length - 1]) : 'Workbook snapshot';
    const compact = el.dataset.sotd !== 'full';
    el.classList.remove('is-loading');
    el.innerHTML = `
      <div class="sotd-top">
        <p class="meta">Stock of the day · <span>${top.live ? `close of ${lastDate}` : 'offline snapshot'}</span></p>
        <span class="signal signal-${top.signal}">${v.short}</span>
      </div>
      <div class="sotd-id"><b class="sotd-sym">${esc(top.symbol)}</b><span>${esc(top.name)}</span></div>
      ${top.live ? `<p class="sotd-price">${money(top.price, top.currency)} <small class="${top.day >= 0 ? 'up' : 'down'}">${pct(top.day, true)} today</small></p>` : ''}
      ${top.closes ? spark(top.closes) : ''}
      <dl class="sotd-metrics">
        <div><dt>1Y return</dt><dd>${pct(top.ret, true)}</dd></div>
        <div><dt>Volatility</dt><dd>${pct(top.vol)}</dd></div>
        <div><dt>Sharpe</dt><dd>${top.sharpe.toFixed(2)}</dd></div>
        <div><dt>Max drawdown</dt><dd>${top.dd != null ? pct(top.dd) : 'n/a'}</dd></div>
      </dl>
      <div class="sotd-score"><span>Score</span><i><b style="--s:${(top.final / 5).toFixed(3)}"></b></i><strong>${top.final.toFixed(2)}</strong><span>/ 5</span></div>
      ${compact ? '' : `<p class="sotd-story">${narrative(top, 1, list.length)}</p>`}`;
    if (live) {
      const line = el.querySelector('.spark-line');
      if (line) { line.style.strokeDasharray = 1; M.animate(line, { strokeDashoffset: [1, 0] }, { duration: 1.6, ease: [0.65, 0, 0.35, 1] }); }
      M.animate(el.querySelectorAll('.sotd-top, .sotd-id, .sotd-price, .sotd-metrics > div, .sotd-score, .sotd-story'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.5, delay: M.stagger(0.05) });
      const bar = el.querySelector('.sotd-score b');
      if (bar) M.animate(bar, { scaleX: [0, 1] }, { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.4 });
    }
  }

  function renderRanking(el, list) {
    el.innerHTML = `<ol class="ranking">${list.map((m, i) => `
      <li class="${i === 0 ? 'top' : ''}"><span class="rk">${String(i + 1).padStart(2, '0')}</span><b>${esc(m.symbol)}</b><i><em style="--s:${(m.final / 5).toFixed(3)}"></em></i><span class="sc">${m.final.toFixed(2)}</span><span class="signal signal-${m.signal}">${VERDICT[m.signal].short}</span></li>`).join('')}</ol>`;
    if (live) M.animate(el.querySelectorAll('.ranking em'), { scaleX: [0, 1] }, { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: M.stagger(0.05) });
  }

  function renderResult(out, m) {
    const v = VERDICT[m.signal];
    const newWeight = TEST_AMOUNT / (PORTFOLIO_VALUE + TEST_AMOUNT);
    out.innerHTML = `
      <div class="check-card signal-card-${m.signal}">
        <div class="check-head">
          <div><p class="meta">${esc(m.exchange || '')}${m.dates ? ` · close of ${niceDate(m.dates[m.dates.length - 1])}` : ''}</p><h3>${esc(m.name)} <span>${esc(m.symbol)}</span></h3><p class="sotd-price">${money(m.price, m.currency)} <small class="${m.day >= 0 ? 'up' : 'down'}">${pct(m.day, true)} today</small></p></div>
          <div class="verdict"><span class="signal signal-${m.signal}">${v.short}</span><b>${v.label}</b><p>${v.advice}</p></div>
        </div>
        ${spark(m.closes, 'big')}
        <div class="check-grid">
          <ul class="checks">${m.checks.map((c) => `<li class="${c.ok ? 'ok' : 'no'}"><i aria-hidden="true">${c.ok ? '✓' : '✕'}</i><span>${c.label}</span><b>${c.value}</b></li>`).join('')}</ul>
          <div class="check-side">
            <div class="sotd-score"><span>Score</span><i><b style="--s:${(m.final / 5).toFixed(3)}"></b></i><strong>${m.final.toFixed(2)}</strong><span>/ 5</span></div>
            <p class="meta">Return score ${m.returnScore.toFixed(1)} × 55% + risk score ${m.riskScore.toFixed(1)} × 45%</p>
            <p class="fit">Portfolio fit: adding ${money(TEST_AMOUNT)} makes it <b>${pct(newWeight)}</b> of the model portfolio, ${newWeight <= LIMITS.maxWeight ? 'within' : 'above'} the 20% position cap.${m.trigger ? ` Review trigger: <b>${m.trigger}</b>.` : ''}</p>
          </div>
        </div>
      </div>`;
    if (live) {
      const line = out.querySelector('.spark-line');
      if (line) { line.style.strokeDasharray = 1; M.animate(line, { strokeDashoffset: [1, 0] }, { duration: 1.4, ease: [0.65, 0, 0.35, 1] }); }
      M.animate(out.querySelector('.check-card'), { opacity: [0, 1], y: [16, 0] }, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
      M.animate(out.querySelectorAll('.checks li'), { opacity: [0, 1], x: [-8, 0] }, { duration: 0.4, delay: M.stagger(0.08, { startDelay: 0.3 }) });
      const bar = out.querySelector('.sotd-score b');
      if (bar) M.animate(bar, { scaleX: [0, 1] }, { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.5 });
    }
  }

  function setupChecker(form) {
    const input = form.querySelector('input');
    const out = form.parentElement.querySelector('[data-check-out]');
    const status = form.querySelector('.check-status');
    const button = form.querySelector('button[type="submit"]');
    let token = 0;
    const run = async (q) => {
      const query = q.trim();
      if (!query) { status.textContent = 'Type a company name or ticker.'; input.focus(); return; }
      const mine = ++token;
      button.disabled = true;
      status.textContent = `Running the model on “${query}”…`;
      out.innerHTML = '<div class="check-card skeleton" aria-hidden="true"><i></i><i></i><i></i></div>';
      try {
        const res = await fetch(`/api/stock?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (mine !== token) return;
        if (!res.ok) throw new Error(data.error || 'Not found');
        const m = analyze(data);
        renderResult(out, m);
        status.textContent = `${m.symbol}: ${VERDICT[m.signal].label}.`;
      } catch (error) {
        if (mine !== token) return;
        out.innerHTML = '';
        status.textContent = /found/i.test(error.message) ? error.message + ', try the ticker, like AAPL.' : 'Live market data isn’t reachable right now, please try again later.';
      } finally {
        if (mine === token) button.disabled = false;
      }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); });
    form.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.try; run(b.dataset.try); }));
  }

  function mount(scope) {
    const sotds = [...scope.querySelectorAll('[data-sotd]')].filter((el) => !el.dataset.ready);
    const rankings = [...scope.querySelectorAll('[data-ranking]')].filter((el) => !el.dataset.ready);
    const stories = [...scope.querySelectorAll('[data-story]')].filter((el) => !el.dataset.ready);
    [...sotds, ...rankings, ...stories].forEach((el) => { el.dataset.ready = 'true'; el.classList.add('is-loading'); });
    if (sotds.length || rankings.length || stories.length) {
      loadUniverse().then((list) => {
        stories.forEach((el) => {
          el.classList.remove('is-loading');
          el.innerHTML = narrative(list[0], 1, list.length) + (list[0].live ? '' : ' <em>(Live prices unavailable, using the workbook snapshot.)</em>');
        });
        sotds.forEach((el) => renderSotd(el, list));
        rankings.forEach((el) => { el.classList.remove('is-loading'); renderRanking(el, list); });
      });
    }
    scope.querySelectorAll('[data-checker]').forEach((form) => {
      if (form.dataset.ready) return;
      form.dataset.ready = 'true';
      setupChecker(form);
    });
  }

  window.MarketUI = { mount, analyze, score };
})();
