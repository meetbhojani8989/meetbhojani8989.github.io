/* Ask-Meet assistant, a small, self-contained chat that answers questions about Meet.
   It runs entirely in the browser from the facts below (no API key, no server), so it can
   only say what's written here and never invents details. Lives outside <main>, so it
   persists across the site's page transitions. */
(() => {
  if (window.__askMeet) return;
  window.__askMeet = true;

  const EMAIL = 'meetbhojani8989@gmail.com';
  const link = (href, text) => `<a href="${href}">${text}</a>`;

  // Each topic: words that point to it, and the answer. Answers use only facts from the resume and project files.
  const TOPICS = [
    {
      id: 'intro',
      words: ['who', 'yourself', 'introduce', 'summary', 'background', 'person', 'overview'],
      answer: `Meet Bhojani is a finance student at Penn State’s Smeal College of Business (B.S. Finance, class of 2027). He builds things at the edge of finance and software, a DCF valuation of Amazon, an Excel portfolio analytics platform, and Amber, an offline AI assistant for macOS. More on the ${link('index.html#about', 'About section')}.`,
    },
    {
      id: 'education',
      words: ['education', 'study', 'studying', 'university', 'college', 'penn', 'state', 'psu', 'smeal', 'degree', 'major', 'graduate', 'graduation', 'class', 'certificate', 'real', 'estate'],
      answer: 'He’s at The Pennsylvania State University (University Park, PA), in the Smeal College of Business, B.S. in Finance with the Smeal Real Estate Analysis & Development Certificate. He started in 2024 and graduates with the class of 2027.',
    },
    {
      id: 'school',
      words: ['high', 'school', 'good', 'shepherd', 'international', 'gsis', 'before'],
      answer: 'Before Penn State, Meet attended Good Shepherd International School from 2019 to 2024.',
    },
    {
      id: 'experience',
      words: ['experience', 'work', 'job', 'jobs', 'intern', 'internship', 'internships', 'worked', 'company', 'shree', 'gita', 'ginning', 'gujarat', 'india', 'employment'],
      answer: `Two internships at Shree Gita Ginning & Oil Industries in Gujarat, India:<br>• <b>Finance Intern</b> (May to Aug 2026), built Excel models tracking revenue, production volumes and segment performance across cotton ginning and edible oil, and turned period-over-period trends into insights for senior management.<br>• <b>Marketing Intern</b> (May to Aug 2025), led an eight-episode digital campaign for a brand relaunch and worked on a product redesign projected to lift retail presence by 30%.<br>Details on the ${link('index.html#experience', 'Experience section')}.`,
    },
    {
      id: 'finance-intern',
      words: ['finance', 'intern', 'excel', 'models', 'reporting', '2026'],
      answer: 'As Finance Intern (May to Aug 2026) Meet built structured Excel models tracking revenue, production volumes and segment-level performance across the cotton-ginning and edible-oil operations, and analyzed period-over-period data to surface cost and revenue trends for senior management.',
    },
    {
      id: 'marketing-intern',
      words: ['marketing', 'campaign', 'episode', 'brand', 'reliance', 'mart', '2025'],
      answer: 'As Marketing Intern (May to Aug 2025) Meet led an eight-episode digital campaign for a brand relaunch, collaborated on a product redesign projected to increase retail presence by 30%, and analyzed procurement and distribution economics with Reliance Mart.',
    },
    {
      id: 'projects',
      words: ['projects', 'project', 'built', 'build', 'portfolio', 'work', 'made'],
      answer: `Three independent projects in 2026:<br>1. ${link('amazon.html', 'Amazon equity valuation')}, a five-year DCF + comps model.<br>2. ${link('portfolio.html', 'Portfolio analytics platform')}, an Excel decision engine on live market data.<br>3. ${link('intelligence.html', 'Amber')}, an offline personal AI assistant for macOS.`,
    },
    {
      id: 'amazon',
      words: ['amazon', 'amzn', 'dcf', 'valuation', 'intrinsic', 'aws', 'wacc', 'value', 'share', 'comps', 'comparable'],
      answer: `In January 2026 Meet built a five-year DCF and comparable-company model of Amazon. Key result: an intrinsic value of <b>$158.20 per share</b> (enterprise value ≈ $1.70T) at an 8.5% WACC and 3% terminal growth. His insight: AWS is ~17% of revenue but ~55% of operating income, so the valuation is really a bet on AWS. ${link('amazon.html', 'See the case study')}.`,
    },
    {
      id: 'trading',
      words: ['trading', 'stock', 'stocks', 'day', 'pick', 'buy', 'invest', 'analytics', 'platform', 'sharpe', 'volatility', 'var', 'drawdown', 'risk', 'signal', 'portfolio'],
      answer: `In April 2026 Meet built an Excel trading decision-support system on live market data. It scores single stocks (55% return score + 45% risk score) into a signal, tracks a 10-stock portfolio against limits like 35% max volatility and a 20% position cap, and tests adding or swapping a stock before trading. On this site it runs live: it picks a <b>stock of the day</b> and you can ${link('portfolio.html', 'run the model on any company')}.`,
    },
    {
      id: 'amber',
      words: ['amber', 'offline', 'neural', 'intelligence', 'ai', 'assistant', 'gesture', 'hand', 'tracking', 'voice', 'mac', 'macos', 'bat', 'doppler', 'tauri', 'automation'],
      answer: `Amber (Sep 2026 to present) is Meet’s local-first macOS assistant for hands-free control: camera hand tracking (pinch to click, scroll, zoom), voice commands, a screen tutor, and “Bat Mode”, which uses the speaker and mic to sense hand motion by Doppler shift. It processes everything on the Mac and verifies an action worked before claiming success. ${link('intelligence.html', 'See the case study')}.`,
    },
    {
      id: 'skills',
      words: ['skills', 'skill', 'tools', 'software', 'know', 'good', 'strengths', 'bloomberg', 'powerpoint', 'claude', 'codex', 'modeling', 'technical'],
      answer: 'His toolkit: Excel, DCF & valuation modeling, financial modeling, the Bloomberg Terminal and PowerPoint, plus building software with AI coding tools like Claude Code and Codex (that’s how Amber was built).',
    },
    {
      id: 'interests',
      words: ['hobbies', 'hobby', 'interests', 'interest', 'fun', 'free', 'sports', 'sport', 'cricket', 'f1', 'formula', 'poker', 'basketball', 'pickleball', 'bollywood', 'movies', 'films', 'play', 'outside', 'weekend'],
      answer: `Off the clock Meet loves cricket and F1, plays poker, plays basketball and pickleball regularly, and is a big Bollywood fan. The ${link('interests.html', 'Interests page')} has a live F1 countdown and podium, a flip-number cricket scoreboard for India and IPL games, a hand of poker against him, and a Bollywood movie-night picker.`,
    },
    {
      id: 'contact',
      words: ['contact', 'email', 'reach', 'linkedin', 'message', 'talk', 'connect', 'hire', 'hiring', 'available', 'availability', 'opportunity', 'opportunities', 'interview', 'resume', 'cv'],
      answer: `The best way is to ${link('index.html#contact', 'send a message')}, it goes straight to his inbox. Or email ${link(`mailto:${EMAIL}`, EMAIL)}, connect on ${link('https://www.linkedin.com/in/meetbhojani', 'LinkedIn')}, or ${link('Meet-Bhojani-Resume.pdf', 'download the resume')}.`,
    },
    {
      id: 'location',
      words: ['where', 'location', 'based', 'live', 'from', 'city'],
      answer: 'Meet studies at Penn State’s University Park campus in Pennsylvania. His internships were in Gujarat, India.',
    },
  ];
  const GREET = /^(hi|hey|hello|yo|hola|good (morning|afternoon|evening))\b/i;
  const AVAILABILITY = /\b(open to|available|availability|hiring|hire|looking for|seeking|recruit\w*)\b/i;
  const THANKS = /\b(thanks|thank you|thx|cheers|great|awesome|cool)\b/i;
  const STOP = new Set('meet meets bhojani a an the is are was were do does did of to in on for and or with what whats which how his her he him me my you your i can could would tell about please any some at be has have it this that'.split(' '));

  const tokens = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
  // Light stemming so "internships"/"internship", "studied"/"study" meet in the middle.
  const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');

  function answer(text) {
    const out = reply(text);
    const topic = TOPICS.find((t) => t.answer === out);
    return { html: out, id: topic ? topic.id : 'none' };
  }

  function reply(text) {
    if (GREET.test(text.trim()) && tokens(text).length <= 2) return 'Hi! I can answer questions about Meet, his education, internships, projects or how to contact him. What would you like to know?';
    if (AVAILABILITY.test(text)) return TOPICS.find((t) => t.id === 'contact').answer;
    const words = tokens(text).map(stem);
    if (!words.length) {
      return THANKS.test(text) ? 'Happy to help! Anything else you’d like to know about Meet?' : TOPICS[0].answer;
    }
    let best = null, bestScore = 0;
    TOPICS.forEach((topic, order) => {
      const vocab = topic.words.map(stem);
      let score = 0;
      words.forEach((w) => {
        if (vocab.includes(w)) score += 2;
        else if (w.length > 3 && vocab.some((v) => v.length > 3 && (v.startsWith(w) || w.startsWith(v)))) score += 1;
      });
      score -= order * 0.001; // earlier topics win ties
      if (score > bestScore) { best = topic; bestScore = score; }
    });
    if (best && bestScore >= 1) return best.answer;
    if (THANKS.test(text)) return 'Happy to help! Anything else you’d like to know about Meet?';
    return `I only know about Meet’s background, projects and experience, so I’m not sure about that one. For anything else, ${link('index.html#contact', 'send him a message')} or email ${link(`mailto:${EMAIL}`, EMAIL)}.`;
  }

  /* ---------- UI ---------- */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOLLOW = {
    intro: ['What has he built?', 'Where does he study?', 'Internship experience'],
    education: ['High school?', 'What has he built?', 'How can I contact him?'],
    school: ['Where does he study now?', 'Internship experience'],
    experience: ['Finance internship', 'Marketing internship', 'What has he built?'],
    'finance-intern': ['Marketing internship', 'Tell me about Amber'],
    'marketing-intern': ['Finance internship', 'What has he built?'],
    projects: ['Amazon valuation', 'Trading platform', 'Tell me about Amber'],
    amazon: ['Trading platform', 'Tell me about Amber', 'How can I contact him?'],
    trading: ['Amazon valuation', 'Tell me about Amber'],
    amber: ['Amazon valuation', 'What are his skills?', 'How can I contact him?'],
    skills: ['What has he built?', 'How can I contact him?'],
    contact: ['Who is Meet?', 'What has he built?'],
    location: ['Where does he study?', 'Internship experience'],
    interests: ['What has he built?', 'How can I contact him?'],
    none: ['Who is Meet?', 'What has he built?', 'How can I contact him?'],
  };
  const START = ['Who is Meet?', 'What has he built?', 'What does he do for fun?', 'Internship experience', 'How can I contact him?'];
  const ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1-3.6A7.9 7.9 0 0 1 4 12Z"/></svg>';

  const launch = document.createElement('button');
  launch.className = 'chat-launch';
  launch.type = 'button';
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-controls', 'ask-meet');
  launch.setAttribute('aria-label', 'Ask about Meet, open chat');
  launch.innerHTML = `<span class="orb" aria-hidden="true"></span><span class="label">Ask about Meet</span><span class="ico" aria-hidden="true">${ICON_CHAT}</span>`;

  const nudge = document.createElement('div');
  nudge.className = 'chat-nudge';
  nudge.hidden = true;
  nudge.innerHTML = '<p>Hi! Curious about Meet? Ask me anything.</p><button type="button" aria-label="Dismiss">×</button>';

  const panel = document.createElement('section');
  panel.className = 'chat';
  panel.id = 'ask-meet';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Ask about Meet');
  panel.innerHTML = `
    <header class="chat-head">
      <span class="avatar"><img src="meet-bhojani-portrait.jpg" alt="" width="40" height="40"><i aria-hidden="true"></i></span>
      <div><b>Meet’s assistant</b><small>Answers from his resume &amp; projects</small></div>
      <button class="chat-close" type="button" aria-label="Close chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </header>
    <div class="chat-log" role="log" aria-live="polite"></div>
    <div class="chat-chips" role="group" aria-label="Suggested questions"></div>
    <form class="chat-form"><label class="sr-only" for="ask-input">Your question</label><input id="ask-input" autocomplete="off" placeholder="Ask about projects, school, experience…" maxlength="300"><button type="submit" aria-label="Send" disabled>${ICON_SEND}</button></form>`;
  document.body.append(nudge, launch, panel);

  const log = panel.querySelector('.chat-log');
  const input = panel.querySelector('input');
  const sendBtn = panel.querySelector('.chat-form button');
  const chips = panel.querySelector('.chat-chips');

  function setChips(list) {
    chips.innerHTML = '';
    list.forEach((q, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.style.setProperty('--i', i);
      b.addEventListener('click', () => ask(q));
      chips.appendChild(b);
    });
  }

  // Bot answers type themselves out word by word (instant under reduced motion).
  function stream(el, html) {
    el.innerHTML = html;
    if (reduced) return Promise.resolve();
    const words = [];
    const walk = (node) => [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.textContent = part;
          words.push(w);
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else walk(child);
    });
    walk(el);
    return new Promise((done) => {
      let i = 0;
      const step = () => {
        for (let k = 0; k < 2 && i < words.length; k++) words[i++].classList.add('on');
        log.scrollTop = log.scrollHeight;
        if (i < words.length) setTimeout(step, 22); else done();
      };
      step();
    });
  }

  const add = (who) => {
    const m = document.createElement('div');
    m.className = `msg ${who}`;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  };

  let busy = false;
  async function ask(q) {
    const text = q.trim();
    if (!text || busy) return;
    busy = true;
    add('me').textContent = text;
    input.value = '';
    sendBtn.disabled = true;
    chips.classList.add('hide');
    const typing = add('bot typing');
    typing.innerHTML = '<i></i><i></i><i></i>';
    await new Promise((r) => setTimeout(r, reduced ? 0 : 500 + Math.min(text.length * 10, 500)));
    typing.remove();
    const { html, id } = answer(text);
    await stream(add('bot'), html);
    setChips(FOLLOW[id] || FOLLOW.none);
    chips.classList.remove('hide');
    busy = false;
  }

  let greeted = false;
  function setOpen(open) {
    launch.setAttribute('aria-expanded', String(open));
    launch.classList.toggle('open', open);
    panel.hidden = !open;
    hideNudge();
    if (open) {
      if (!greeted) {
        greeted = true;
        const hello = add('bot');
        stream(hello, 'Hi, I’m Meet’s assistant. Ask me about his <b>projects</b>, <b>education</b>, <b>internships</b> or how to <b>get in touch</b>.').then(() => setChips(START));
      }
      setTimeout(() => input.focus(), 120);
    }
  }
  function hideNudge() { nudge.hidden = true; try { sessionStorage.setItem('askMeetNudge', '1'); } catch (e) { /* storage blocked */ } }

  launch.addEventListener('click', () => setOpen(panel.hidden));
  nudge.querySelector('p').addEventListener('click', () => setOpen(true));
  nudge.querySelector('button').addEventListener('click', hideNudge);
  panel.querySelector('.chat-close').addEventListener('click', () => { setOpen(false); launch.focus(); });
  input.addEventListener('input', () => { sendBtn.disabled = !input.value.trim() || busy; });
  panel.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); launch.focus(); } });
  log.addEventListener('click', (e) => { if (e.target.closest('a[href$=".html"]')) setOpen(false); });

  // A gentle one-time nudge so visitors notice the assistant.
  let seen = false;
  try { seen = sessionStorage.getItem('askMeetNudge') === '1'; } catch (e) { /* storage blocked */ }
  if (!seen) setTimeout(() => { if (panel.hidden && !greeted) nudge.hidden = false; }, 4500);
})();
