/* ════════════════════════════════════════════════════════════════
   The personal assistant — the user's own agent in the app.

   One assistant: the existing Oriven Chat (app.html #orvAiFab launcher,
   #orvAiPanel popup, orvAiSend → POST /api/ai/chat). This file gives it the
   user's agent identity and the pieces around the conversation:

     • who: GET /api/agent — resolved on the SERVER from the account's stored
       choice (onboarding, or the picker here → PUT /api/agent). The browser
       never decides it and never sends an agent id to the chat.
     • look: name, logo (the landing page's dot glyph, js/landing-creatures.js)
       and colour on the launcher and popup, as CSS variables
       (css/oriven-agent.css) on top of the existing dark design.
     • results: toolResults from the chat become cards (campaign drafts are
       saved through Create's own store, research is followed until ready).
     • memory on this device: the conversation per user in localStorage
       (orv_agent_chat_v1:<userId>, last 40 messages, 30 days), cleared on
       sign-out and account deletion. Long-term memory is the server's
       Business memory and business context, not this.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.orvAgent) return;

  // seq/forUid: only the newest /api/agent answer, for the account signed in
  // now, is shown (an older or other account's answer arriving late is
  // ignored).
  var S = { agent: null, assigned: true, agents: [], loading: null, restored: false, seq: 0, forUid: null };
  var CHAT_KEY = 'orv_agent_chat_v1:';
  var MAX_MSGS = 40;
  var TTL_MS = 30 * 864e5;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { try { return (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.id) || null; } catch (_) { return null; } }
  function rgb(hex) { var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(', ') : '183, 255, 42'; }

  // The landing page's mark for each agent: a few dots on a 24×24 grid.
  function glyph(id, cls) {
    var dots = (window.IkCreatures && window.IkCreatures.glyph && id) ? window.IkCreatures.glyph(id) : [];
    if (!dots.length) return '<span class="' + (cls || 'orv-agent-glyph') + ' orv-agent-glyph--empty" aria-hidden="true"></span>';
    return '<svg class="' + (cls || 'orv-agent-glyph') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      dots.map(function (d) { return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill="currentColor" fill-opacity="' + d[3] + '"/>'; }).join('') + '</svg>';
  }

  // ── Identity ────────────────────────────────────────────────────────
  // The account's assistant comes only from the server (GET /api/agent →
  // profiles.preferences.assistant). Nothing in this browser — storage, an
  // earlier account, a default — decides it.
  function load(force) {
    var who = uid();
    if (S.loading && !force && S.forUid === who) return S.loading;
    if (typeof apiFetch !== 'function') return Promise.resolve(null);
    var seq = ++S.seq;
    S.forUid = who;
    var p = apiFetch('/api/agent').then(function (r) {
      if (seq !== S.seq || uid() !== who) return null; // superseded, or another account by now
      if (!r || !r.ok || !r.data || !r.data.agent) { if (S.loading === p) S.loading = null; return null; }
      S.agent = r.data.agent; S.assigned = r.data.assigned !== false; S.agents = r.data.agents || [];
      apply();
      return S.agent;
    }).catch(function () { if (S.loading === p) S.loading = null; return null; });
    S.loading = p;
    return p;
  }
  // Signed out: the launcher no longer wears the previous account's assistant.
  function resetLook() {
    var fab = document.getElementById('orvAiFab');
    if (fab) {
      fab.classList.remove('orv-agent-on'); fab.removeAttribute('data-agent'); fab.style.removeProperty('--orv-agent'); fab.style.removeProperty('--orv-agent-rgb');
      fab.innerHTML = '<span class="orv-ai-fab-dot"></span><span class="orv-ai-fab-label">Your assistant</span>';
      fab.setAttribute('aria-label', 'Open your assistant'); fab.removeAttribute('title');
    }
    var panel = document.getElementById('orvAiPanel');
    if (panel) {
      panel.classList.remove('orv-agent-on'); panel.removeAttribute('data-agent');
      panel.style.removeProperty('--orv-agent'); panel.style.removeProperty('--orv-agent-rgb');
      panel.setAttribute('aria-label', 'Your OrivenAI assistant');
      var left = panel.querySelector('.orv-ai-panel-head-left');
      if (left) left.innerHTML = '<div class="orv-agent-id"><div class="orv-agent-id-text"><div class="orv-ai-panel-name">Your assistant</div></div></div>';
      var intro = document.getElementById('orvAgentIntro'); if (intro) intro.textContent = '';
      var eb = document.getElementById('orvAgentEyebrow'); if (eb) eb.textContent = '';
      var inp = document.getElementById('orvAiInput'); if (inp) inp.placeholder = 'Ask your assistant anything…';
    }
    var old = document.getElementById('orvAgentPicker'); if (old) old.remove();
    renderStarters();
    ensureAboutUI();
    var ab = document.getElementById('orvAgentAbout'); if (ab && window.owUI) window.owUI.close(ab);
  }

  // ── Header: [mark + status dot] Name · status / tagline ─────────────
  // Status is what the widget actually knows: the assistant is loaded
  // (Ready), an answer is being written (Thinking), the last request
  // couldn't reach the server (Offline).
  var STATUS = { ready: 'Ready', thinking: 'Thinking…', offline: 'Offline' };
  var status = 'ready';
  function setStatus(st) {
    status = STATUS[st] ? st : 'ready';
    var panel = document.getElementById('orvAiPanel'); if (!panel) return;
    panel.setAttribute('data-status', status);
    var el = panel.querySelector('.orv-agent-status-t'); if (el) el.textContent = STATUS[status];
  }
  function headHtml(a) {
    return '<div class="orv-agent-id">' +
      '<span class="orv-agent-avatar">' + glyph(a.id, 'orv-agent-head-glyph') + '<span class="orv-agent-status-dot" aria-hidden="true"></span></span>' +
      '<div class="orv-agent-id-text">' +
        '<div class="orv-agent-nameline"><span class="orv-ai-panel-name">' + esc(a.name) + '</span><span class="orv-agent-status" role="status"><span class="orv-agent-status-t">' + STATUS[status] + '</span></span></div>' +
        '<div class="orv-agent-tagline">' + esc(a.tone || a.role) + '</div>' +
      '</div></div>';
  }

  // ── Four starting points (empty conversation) ───────────────────────
  // Each sends a plain question through the normal chat (orvAiSend → POST
  // /api/ai/chat): answered by the user's own assistant, charged like any
  // message, shown in the conversation. The questions ask the assistant to
  // say so when it has no data, so nothing is invented.
  var STARTERS = [
    { k: 'analyze', t: 'Analyze my campaigns', d: 'What’s working, what isn’t, what to change',
      q: 'Analyze my campaigns: what’s working, what isn’t, and what should I change? Use only the data you actually have, and tell me if something is missing.',
      ic: '<path d="M4 19V11M10 19V5M16 19v-6M20 19H3"/>' },
    { k: 'improve', t: 'Improve my advertising', d: 'The most useful changes for my business',
      q: 'How can I improve my advertising? Give me the three most useful changes for my business, based on what you know about it.',
      ic: '<path d="M5 16 10 11l3 3 6-7"/><path d="M15 7h4v4"/>' },
    { k: 'create', t: 'Create something new', d: 'An ad, a campaign or a fresh idea',
      q: 'Help me create something new for my business: suggest a campaign or ad idea, then help me build it.',
      ic: '<path d="M12 4.5v15M4.5 12h15"/>' },
    { k: 'explain', t: 'Explain my performance', d: 'The numbers in plain language',
      q: 'Explain my advertising performance in plain language: what the main numbers mean and how they are trending. If there is no performance data yet, say so and tell me how to get it.',
      ic: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5"/><path d="M12 8h.01"/>' },
  ];
  function renderStarters() {
    var box = document.getElementById('orvAgentStarters'); if (!box) return;
    var on = !!(S.agent && S.assigned);
    box.hidden = !on;
    if (!on) { box.innerHTML = ''; return; }
    if (box.getAttribute('data-for') === S.agent.id && box.children.length) return;
    box.setAttribute('data-for', S.agent.id);
    box.innerHTML = '<div class="orv-agent-starters-h">Start with</div><div class="orv-agent-starters-grid">' + STARTERS.map(function (x) {
      return '<button type="button" class="orv-agent-starter" data-starter="' + x.k + '">' +
        '<span class="orv-agent-starter-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + x.ic + '</svg></span>' +
        '<span class="orv-agent-starter-t">' + esc(x.t) + '</span><span class="orv-agent-starter-d">' + esc(x.d) + '</span></button>';
    }).join('') + '</div>';
    if (!box._bound) {
      box._bound = true;
      box.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-starter]'); if (!b || typeof window.orvAiSend !== 'function') return;
        var x = STARTERS.filter(function (s) { return s.k === b.getAttribute('data-starter'); })[0];
        if (x) window.orvAiSend(x.q);
      });
    }
  }

  // ── Composer: grows with the text; Send only when there is something to
  // send, the assistant is chosen and no answer is on its way. ─────────
  var busyNow = false;
  function syncSend() {
    var inp = document.getElementById('orvAiInput'), btn = document.getElementById('orvAiSendBtn'); if (!inp || !btn) return;
    var locked = !!inp.disabled;
    btn.disabled = locked || busyNow || !inp.value.trim();
    btn.classList.toggle('is-loading', busyNow);
    btn.setAttribute('aria-label', busyNow ? 'Sending…' : 'Send message');
  }
  function grow() {
    var inp = document.getElementById('orvAiInput'); if (!inp) return;
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight + 2, 168) + 'px';
  }
  function bindComposer() {
    var inp = document.getElementById('orvAiInput'); if (!inp || inp._orvAgentBound) return;
    inp._orvAgentBound = true;
    inp.addEventListener('input', function () { grow(); syncSend(); });
    // A send (Enter, the button, a starter) clears the box from script:
    // follow it on the next frame.
    inp.addEventListener('keydown', function () { setTimeout(function () { grow(); syncSend(); }, 0); });
    syncSend();
  }
  function busy(on, st) {
    busyNow = !!on;
    if (on) { setStatus('thinking'); where(); }
    else if (st) setStatus(st);
    else if (status === 'thinking') setStatus('ready');
    setTimeout(function () { grow(); syncSend(); }, 0);
  }

  // ── About your assistant (drawer, css/ow-system.css + js/ow-ui.js) ──
  // Everything shown is real: the profile from GET /api/agent, what the
  // assistant can and can't do (the server's own list, services/agents.js
  // platformGuide), and this device's conversation. Per-assistant usage is
  // not recorded anywhere, so no usage statistics are shown.
  var CAN = ['Create a campaign draft', 'Write headlines, calls to action, emails and landing pages', 'Start research and read your reports', 'List your campaigns and automations', 'Refresh a campaign’s numbers', 'Pause, resume, rename or change the budget of a live campaign, after you confirm', 'Create an automation, after you confirm', 'Remember a fact about your business', 'Check your credit balance', 'Open any page in OrivenAI'];
  var CANT = [['Connect an ad account', 'Ad Platforms (you sign in with the platform)'], ['Publish a draft', 'Ad Studio'], ['Generate a video', 'Create'], ['Buy a plan or change billing', 'Settings'], ['Delete your account', 'Settings']];
  function aboutHtml(a) {
    var mine = read().msgs.filter(function (m) { return m.r === 'u'; }).length;
    var li = function (xs) { return xs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
    return '<div class="orv-about__id" style="--orv-agent:' + esc(a.color) + ';--orv-agent-rgb:' + rgb(a.color) + '">' + glyph(a.id, 'orv-agent-head-glyph') +
        '<div><h2 class="orv-about__name" id="orvAboutTitle">' + esc(a.name) + '</h2><p class="orv-about__role">' + esc(a.role) + '</p></div></div>' +
      '<p class="orv-about__tone">' + esc(a.tone || '') + '</p>' +
      (a.hello || a.intro ? '<p class="orv-about__lead">' + esc(a.hello || a.intro) + '</p>' : '') +
      '<dl class="orv-about__facts">' +
        '<div><dt>Status</dt><dd><span class="ow-tag ow-tag--done">Your personal assistant</span> chosen once; it stays with you in every section.</dd></div>' +
        '<div><dt>This device</dt><dd>' + (mine ? mine + ' message' + (mine === 1 ? '' : 's') + ' in your saved conversation' : 'No messages in your saved conversation yet') + '</dd></div>' +
      '</dl>' +
      ((a.strengths || []).length ? '<h3 class="orv-about__h">Strongest at</h3><ul class="orv-about__list">' + li(a.strengths) + '</ul>' : '') +
      '<h3 class="orv-about__h">What ' + esc(a.name) + ' can do for you</h3><ul class="orv-about__list">' + li(CAN) + '</ul>' +
      '<h3 class="orv-about__h">Done by you, elsewhere in OrivenAI</h3><ul class="orv-about__list orv-about__list--out">' + CANT.map(function (x) { return '<li>' + esc(x[0]) + ' <span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>' +
      ((a.alsoHelps || []).length ? '<p class="orv-about__note">Strongest in its specialisation, and helps across OrivenAI, including ' + esc(a.alsoHelps.join(', ')) + '. Each chat message costs credits; nothing is done without the tools above, and actions on live campaigns wait for your confirmation.</p>' : '') +
      '<p class="orv-about__note">OrivenAI doesn’t record usage statistics per assistant, so none are shown here.</p>';
  }
  function ensureAboutUI() {
    var panel = document.getElementById('orvAiPanel'); if (!panel) return;
    var right = panel.querySelector('.orv-ai-panel-head-right');
    if (right && !document.getElementById('orvAgentAboutBtn')) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'orvAgentAboutBtn'; b.className = 'orv-ai-panel-close orv-agent-hbtn';
      b.setAttribute('aria-label', 'About your assistant'); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', 'orvAgentAbout'); b.title = 'About your assistant';
      b.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" width="15" height="15" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v3.8"/><path d="M8 5h.01"/></svg>';
      b.addEventListener('click', function () {
        if (!S.agent || !S.assigned) return;
        var d = document.getElementById('orvAgentAbout');
        if (!d) {
          d = document.createElement('div'); d.id = 'orvAgentAbout'; d.className = 'ow-drawer orv-about'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'orvAboutTitle'); d.setAttribute('aria-hidden', 'true'); d.hidden = true;
          d.innerHTML = '<div class="ow-drawer__scrim"></div><div class="ow-drawer__panel"><button type="button" class="ow-drawer__close" data-ow-close aria-label="Close"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button><div data-orv-about-body></div></div>';
          document.body.appendChild(d);
        }
        d.querySelector('[data-orv-about-body]').innerHTML = aboutHtml(S.agent);
        if (window.owUI) window.owUI.open(d, b);
      });
      right.insertBefore(b, right.firstChild);
    }
    var btn = document.getElementById('orvAgentAboutBtn');
    if (btn) btn.hidden = !(S.agent && S.assigned);
  }

  // ── The page the assistant knows you're on (sent as context.view) ───
  function where() {
    var el = document.getElementById('orvAgentWhere'); if (!el) return;
    var v = window.orvAppNav && typeof window.orvAppNav.view === 'function' ? window.orvAppNav.view() : null;
    var label = v && window.orvAppNav.viewLabel ? window.orvAppNav.viewLabel(v) : '';
    el.hidden = !label;
    el.innerHTML = label ? '<span class="orv-agent-where-dot" aria-hidden="true"></span>On ' + esc(label) : '';
    el.title = label ? 'Your assistant knows which page you have open' : '';
  }

  // No assistant chosen yet: the widget doesn't wear the server's default
  // (that would show an assistant the user never picked). It asks for the
  // choice, and chat waits until one is made.
  function applyUnchosen() {
    var fab = document.getElementById('orvAiFab');
    if (fab) {
      fab.classList.remove('orv-agent-on'); fab.removeAttribute('data-agent'); fab.style.removeProperty('--orv-agent'); fab.style.removeProperty('--orv-agent-rgb');
      fab.innerHTML = '<span class="orv-ai-fab-dot"></span><span class="orv-ai-fab-label">Choose your assistant</span>';
      fab.setAttribute('aria-label', 'Choose your personal assistant'); fab.title = 'Choose your personal assistant';
    }
    var panel = document.getElementById('orvAiPanel');
    if (panel) {
      panel.classList.remove('orv-agent-on'); panel.removeAttribute('data-agent');
      panel.style.removeProperty('--orv-agent'); panel.style.removeProperty('--orv-agent-rgb');
      panel.setAttribute('aria-label', 'Choose your OrivenAI assistant');
      var left = panel.querySelector('.orv-ai-panel-head-left');
      if (left) left.innerHTML = '<div class="orv-agent-id"><div class="orv-agent-id-text"><div class="orv-ai-panel-name">Your assistant</div><div class="orv-agent-role">Choose one to start</div></div></div>';
      var intro = document.getElementById('orvAgentIntro'); if (intro) intro.textContent = '';
      var eb = document.getElementById('orvAgentEyebrow'); if (eb) eb.textContent = '';
      var div = panel.querySelector('.orv-ai-section-divider span'); if (div) div.textContent = 'Choose your assistant first';
      lockInput(true);
      renderPicker();
      renderStarters();
      ensureAboutUI();
    }
  }
  function lockInput(on) {
    var inp = document.getElementById('orvAiInput'), btn = document.getElementById('orvAiSendBtn');
    if (inp) { inp.disabled = on; if (on) inp.placeholder = 'Choose your assistant above to start chatting'; }
    if (btn) btn.disabled = on;
    if (!on) syncSend();
  }
  // Sends (typed, or prefilled by "Ask" buttons) wait for the choice too.
  function guardSend() {
    var orig = window.orvAiSend;
    if (typeof orig !== 'function' || orig._orvAgentGuard) return;
    var g = function () {
      if (!S.assigned && S.agents.length) {
        var p = document.getElementById('orvAgentPicker');
        if (p) { p.classList.add('is-asking'); var f = p.querySelector('[data-agent-pick]'); if (f) f.focus(); setTimeout(function () { p.classList.remove('is-asking'); }, 1600); }
        return;
      }
      return orig.apply(this, arguments);
    };
    g._orvAgentGuard = true;
    window.orvAiSend = g;
  }

  function apply() {
    var a = S.agent; if (!a) return;
    guardSend();
    if (!S.assigned && S.agents.length) { applyUnchosen(); return; }
    lockInput(false);
    var vars = function (el) { if (!el) return; el.style.setProperty('--orv-agent', a.color); el.style.setProperty('--orv-agent-rgb', rgb(a.color)); el.setAttribute('data-agent', a.id); el.classList.add('orv-agent-on'); };
    var fab = document.getElementById('orvAiFab');
    if (fab) {
      vars(fab);
      fab.innerHTML = glyph(a.id, 'orv-agent-fab-glyph') + '<span class="orv-ai-fab-label">' + esc(a.name) + '</span>';
      fab.setAttribute('aria-label', 'Open ' + a.name + ', your assistant');
      fab.title = a.name + ' · ' + a.role;
    }
    var panel = document.getElementById('orvAiPanel');
    if (panel) {
      vars(panel);
      panel.setAttribute('aria-label', a.name + ', your OrivenAI assistant');
      var left = panel.querySelector('.orv-ai-panel-head-left');
      if (left) left.innerHTML = headHtml(a);
      setStatus(status);
      // Welcome: the specialisation as an eyebrow, the time-of-day greeting
      // (app.html), then the assistant's own opening line in its voice
      // (server: agents.js hello; an older server's intro otherwise). It
      // claims nothing about the user's data.
      var eb = document.getElementById('orvAgentEyebrow'); if (eb) eb.textContent = a.role || '';
      var gt = document.getElementById('orvAiGreetingText');
      var intro = document.getElementById('orvAgentIntro');
      if (gt && !intro) { intro = document.createElement('p'); intro.id = 'orvAgentIntro'; intro.className = 'orv-agent-intro'; gt.parentNode.insertBefore(intro, gt.nextSibling); }
      if (intro) intro.textContent = a.hello || a.intro || '';
      var div = panel.querySelector('.orv-ai-section-divider span');
      if (div) div.textContent = 'Ask ' + a.name;
      var inp = document.getElementById('orvAiInput');
      if (inp) inp.placeholder = 'Message ' + a.name + '…';
      renderPicker();
      renderStarters();
      where();
      bindComposer();
      ensureAboutUI();
    }
  }

  // Accounts that never chose: the six are offered once. The choice is
  // permanent — there is no way to switch afterwards (the server refuses it).
  function renderPicker() {
    var g = document.getElementById('orvAiGreeting'); if (!g) return;
    var old = document.getElementById('orvAgentPicker'); if (old) old.remove();
    if (S.assigned || !S.agents.length) return;
    var box = document.createElement('div');
    box.id = 'orvAgentPicker'; box.className = 'orv-agent-picker';
    box.innerHTML = '<p class="orv-agent-picker-q">Choose your personal assistant. It stays with you everywhere in OrivenAI — choose the one that suits you, it can’t be changed later.</p><div class="orv-agent-picker-list" role="list">' +
      S.agents.map(function (x) { return '<button type="button" role="listitem" class="orv-agent-pick" data-agent-pick="' + esc(x.id) + '" style="--orv-agent:' + esc(x.color) + '">' + glyph(x.id, 'orv-agent-pick-glyph') + '<span><b>' + esc(x.name) + '</b><small>' + esc(x.role) + '</small></span></button>'; }).join('') + '</div>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-agent-pick]'); if (!b) return;
      choose(b.getAttribute('data-agent-pick'), b);
    });
    var anchor = document.getElementById('orvAiRecList');
    g.insertBefore(box, anchor || g.firstChild.nextSibling);
  }
  // The first (and only) choice: PUT /api/agent, stored on the account by the
  // server. If the account already has an assistant (chosen in another tab
  // or the onboarding), the server answers 409 with it and that one is shown.
  function choose(id, btn) {
    if (btn) btn.disabled = true;
    var who = uid();
    return apiFetch('/api/agent', { method: 'PUT', body: JSON.stringify({ agentId: id }) }).then(function (r) {
      if (uid() !== who) return;
      var saved = r && r.data && r.data.agent && (r.ok || r.status === 409) ? r.data.agent : null;
      if (saved) {
        S.seq++; S.agent = saved; S.assigned = true; S.loading = Promise.resolve(S.agent); S.forUid = who; apply();
        if (typeof toast === 'function') toast(r.ok ? S.agent.name + ' is now your personal assistant.' : (r.data.error || S.agent.name + ' is already your personal assistant.'));
      } else { if (btn) btn.disabled = false; if (typeof toast === 'function') toast((r && r.data && r.data.error) || 'Couldn’t save your choice. Please try again.', 'err'); }
    });
  }

  // ── Replies: escaped text with light structure (paragraphs, lists, bold) ──
  // Within a block, runs of bullet / numbered lines become lists, "#" lines
  // short headings, other lines a paragraph. Everything is escaped first;
  // only **bold**, `code` and the contact address get markup.
  function formatReply(text) {
    var blocks = String(text == null ? '' : text).replace(/\r/g, '').split(/\n{2,}/);
    var bullet = /^\s*(?:[-•*])\s+/, num = /^\s*\d+[.)]\s+/, head = /^\s{0,3}#{1,4}\s+/;
    var inline = function (s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/contact@orivenai\.com/g, '<a href="mailto:contact@orivenai.com">contact@orivenai.com</a>'); };
    return blocks.map(function (b) {
      var lines = b.split('\n').filter(function (l) { return l.trim().length; });
      var out = '', run = null, items = [], para = [];
      var flushPara = function () { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
      var flushList = function () { if (run) { out += '<' + run + '>' + items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + run + '>'; run = null; items = []; } };
      lines.forEach(function (l) {
        var kind = bullet.test(l) ? 'ul' : num.test(l) ? 'ol' : head.test(l) ? 'h' : 'p';
        if (kind === 'ul' || kind === 'ol') { flushPara(); if (run && run !== kind) flushList(); run = kind; items.push(l.replace(kind === 'ul' ? bullet : num, '')); return; }
        flushList();
        if (kind === 'h') { flushPara(); out += '<h4>' + inline(l.replace(head, '').replace(/\*\*/g, '')) + '</h4>'; return; }
        para.push(l);
      });
      flushPara(); flushList();
      return out;
    }).join('');
  }

  // ── Opening pages (keys from the server's open_page tool and cards) ──
  // One map for the whole app: js/pageRegistry.js (the same keys the
  // Marketing Plan and Progress use).
  function hasPage(key) { return !!(window.orvPages && window.orvPages.has(key)); }
  function openPage(key) {
    if (!hasPage(key) || !window.orvPages.open(key)) return false;
    if (typeof window.orvCloseAi === 'function' && window.innerWidth < 769) window.orvCloseAi();
    return true;
  }
  function pageBtn(key, label) { return hasPage(key) ? '<button type="button" class="orv-agent-card-btn" data-agent-page="' + esc(key) + '">' + esc(label || ('Open ' + window.orvPages.label(key))) + '</button>' : ''; }

  // ── Result cards ────────────────────────────────────────────────────
  // fresh: true for a live answer (side effects such as saving a campaign
  // draft run once); false when restoring a saved conversation.
  function saveCampaignDraft(c) {
    if (!c.pkg || typeof window._orvStoreCampaign !== 'function') return null;
    var p = c.platform || 'google';
    var modKey = p === 'meta' ? 'meta-ads' : p === 'tiktok' ? 'tiktok-ads' : p === 'pinterest' ? 'pinterest-ads' : 'google-ads';
    var gen = {}; gen[modKey] = { ready: true, data: c.pkg };
    var id = 'agent_' + Date.now();
    window._orvStoreCampaign({ id: id, name: c.pkg.campaignName || c.title || 'Campaign', goal: c.goal || 'Sales', platform: p, status: 'generated', progress: 100, created: new Date().toISOString(), modules: [modKey], generated: gen, pkg: c.pkg, prompt: c.product || '', createdBy: 'assistant' });
    return id;
  }
  function cardHtml(c) {
    var t = c.type, h = '<div class="orv-agent-card orv-agent-card--' + esc(t) + '">';
    if (t === 'campaign') {
      h += '<div class="orv-agent-card-k">Campaign draft · ' + esc(({ google: 'Google', meta: 'Meta', tiktok: 'TikTok', pinterest: 'Pinterest' })[c.platform] || c.platform || '') + '</div><div class="orv-agent-card-t">' + esc(c.title) + '</div>';
      var pk = c.pkg || {};
      var heads = (pk.headlines || (pk.ads && pk.ads[0] && pk.ads[0].headlines) || []).slice(0, 2).map(function (x) { return typeof x === 'string' ? x : (x && (x.text || x.headline)) || ''; }).filter(Boolean);
      if (heads.length) h += '<ul class="orv-agent-card-list">' + heads.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      h += '<div class="orv-agent-card-meta">' + (c.saved === false ? 'Not saved — open Create to build it again.' : 'Saved as a draft. Review, add images and launch it from Launch.') + '</div>' + pageBtn('launch', 'Review in Launch');
    } else if (t === 'research') {
      var running = !c.status || c.status === 'running';
      h += '<div class="orv-agent-card-k">Research' + (c.researchType ? ' · ' + esc(c.researchType) : '') + '</div><div class="orv-agent-card-t">' + esc(c.question || c.title) + '</div>' +
        '<div class="orv-agent-card-meta" data-research-status>' + (running ? '<span class="orv-agent-spin" aria-hidden="true"></span>Running — this takes a few minutes. You can keep working.' : c.status === 'failed' ? 'This research failed. Nothing was charged for it.' : 'Ready.') + '</div>' +
        '<div class="orv-agent-card-row">' + (running ? '' : '<button type="button" class="orv-agent-card-btn orv-agent-card-btn--primary" data-agent-ask="Summarise my research report' + (c.reportId ? ' (id ' + esc(c.reportId) + ')' : '') + ' and tell me what to do next.">Summarise</button>') + pageBtn('research', 'Open Research') + '</div>';
    } else if (t === 'list') {
      h += '<div class="orv-agent-card-t">' + esc(c.title) + '</div>' + (c.items && c.items.length ? '<ul class="orv-agent-card-list">' + c.items.slice(0, 8).map(function (x) { return '<li>' + esc(x.text) + (x.meta ? ' <span>' + esc(x.meta) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '') + pageBtn(c.page);
    } else if (t === 'credits') {
      h += '<div class="orv-agent-card-k">Credits</div><div class="orv-agent-card-t">' + (c.balance == null ? '—' : esc(typeof orvFormatCredits === 'function' ? orvFormatCredits(c.balance) : c.balance)) + ' credits</div>' + pageBtn('settings', 'Plan & credits');
    } else if (t === 'link') {
      h += pageBtn(c.page, c.title);
    } else if (t === 'done') {
      h += '<div class="orv-agent-card-k">Done</div><div class="orv-agent-card-t">' + esc(c.title) + (c.text ? ': ' + esc(c.text) : '') + '</div>' + pageBtn(c.page);
    } else return '';
    return h + '</div>';
  }
  function bindCard(el) {
    el.addEventListener('click', function (e) {
      var p = e.target.closest && e.target.closest('[data-agent-page]');
      if (p) { openPage(p.getAttribute('data-agent-page')); return; }
      var q = e.target.closest && e.target.closest('[data-agent-ask]');
      if (q && typeof window.orvAiSend === 'function') window.orvAiSend(q.getAttribute('data-agent-ask'));
    });
  }
  // Returns { node, cards } — cards are the storable versions (no packages).
  function renderResults(results, fresh) {
    var wrap = document.createElement('div'); wrap.className = 'orv-ai-msg orv-ai-msg-ai orv-agent-results';
    var keep = [];
    (results || []).forEach(function (r) {
      if (!r) return;
      // A tool that failed: the reply already says why (shown as text); it is
      // kept as a note so the conversation remembers it wasn't done.
      var c = r.card || r; if (!c || !c.type) { if (r.ok === false && r.error) keep.push({ type: 'failed', error: r.error }); return; }
      c = Object.assign({}, c);
      if (c.type === 'campaign' && fresh) { var id = saveCampaignDraft(c); c.saved = !!id; c.campId = id; }
      wrap.insertAdjacentHTML('beforeend', cardHtml(c));
      var store = Object.assign({}, c); delete store.pkg; keep.push(store);
      if (c.type === 'research' && c.reportId && (!c.status || c.status === 'running')) followResearch(c, wrap.lastElementChild);
    });
    if (!wrap.children.length) return { node: null, cards: keep };
    bindCard(wrap);
    return { node: wrap, cards: keep };
  }

  // A started research report, followed while the app is open.
  function followResearch(c, el) {
    var tries = 0;
    var tick = function () {
      if (!el || !document.body.contains(el) || ++tries > 40 || typeof apiFetch !== 'function') return;
      apiFetch('/api/research/reports/' + encodeURIComponent(c.reportId)).then(function (r) {
        var st = r && r.ok && r.data && r.data.summary ? r.data.summary.status : null;
        if (st === 'running' || !st) { setTimeout(tick, 15000); return; }
        c.status = st === 'ready' ? 'ready' : 'failed';
        if (r.data.summary.title) c.title = r.data.summary.title;
        var fresh = document.createElement('div'); fresh.innerHTML = cardHtml(c);
        el.replaceWith(fresh.firstChild);
        updateStoredCard(c);
      }).catch(function () { setTimeout(tick, 30000); });
    };
    setTimeout(tick, 15000);
  }

  // ── Conversation on this device ─────────────────────────────────────
  function key() { var u = uid(); return u ? CHAT_KEY + u : null; }
  function read() {
    var k = key(); if (!k) return { msgs: [] };
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && Array.isArray(v.msgs) && Date.now() - (v.at || 0) < TTL_MS) return v; } catch (_) {}
    return { msgs: [] };
  }
  function write(v) { var k = key(); if (!k) return; try { v.at = Date.now(); v.msgs = v.msgs.slice(-MAX_MSGS); localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function record(role, text, cards) { var v = read(); v.msgs.push({ r: role === 'user' ? 'u' : 'a', t: String(text || '').slice(0, 4000), c: cards && cards.length ? cards : undefined }); write(v); }
  function updateStoredCard(c) {
    var v = read(); var hit = false;
    v.msgs.forEach(function (m) { (m.c || []).forEach(function (x) { if (x.type === 'research' && x.reportId === c.reportId) { x.status = c.status; x.title = c.title; hit = true; } }); });
    if (hit) write(v);
  }
  // The model's history: text plus a one-line note per tool result, so a
  // follow-up ("summarise it") still knows which report or draft it means.
  function historyText(text, cards) {
    var notes = (cards || []).map(function (c) {
      if (c.type === 'research') return '[Research ' + (c.status || 'started') + (c.reportId ? ', report id ' + c.reportId : '') + ': ' + (c.question || c.title || '') + ']';
      if (c.type === 'campaign') return '[Campaign draft saved: ' + c.title + ' (' + c.platform + ')]';
      if (c.type === 'failed') return '[Not done: ' + c.error + ']';
      return '';
    }).filter(Boolean);
    return String(text || '') + (notes.length ? '\n' + notes.join('\n') : '');
  }
  // Renders a saved conversation into the feed once per page load.
  function restore(feed, history) {
    if (S.restored || !feed) return; S.restored = true;
    var v = read(); if (!v.msgs.length) return;
    var g = feed.querySelector('.orv-ai-greeting'); if (g) g.style.display = 'none';
    var sep = document.createElement('div'); sep.className = 'orv-agent-earlier'; sep.textContent = 'Earlier in this conversation'; feed.appendChild(sep);
    v.msgs.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'orv-ai-msg ' + (m.r === 'u' ? 'orv-ai-msg-user' : 'orv-ai-msg-ai');
      d.innerHTML = '<div class="orv-ai-msg-bubble' + (m.r === 'u' ? '' : ' orv-agent-fmt') + '">' + (m.r === 'u' ? esc(m.t) : formatReply(m.t)) + '</div>';
      feed.appendChild(d);
      if (m.c && m.c.length) { var rr = renderResults(m.c, false); if (rr.node) feed.appendChild(rr.node); }
      if (history) history.push({ role: m.r === 'u' ? 'user' : 'assistant', content: m.r === 'u' ? m.t : historyText(m.t, m.c) });
    });
    feed.scrollTop = feed.scrollHeight;
  }
  function clear(feed, history) {
    var k = key(); if (k) { try { localStorage.removeItem(k); } catch (_) {} }
    if (history) history.length = 0;
    if (feed) {
      Array.prototype.slice.call(feed.children).forEach(function (el) { if (!el.classList.contains('orv-ai-greeting')) el.remove(); });
      var g = feed.querySelector('.orv-ai-greeting'); if (g) { g.style.display = ''; g.style.opacity = '1'; }
    }
  }
  // Sign-out: nothing of the conversation stays on a shared computer.
  function forgetAll() {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(CHAT_KEY) === 0) localStorage.removeItem(k); }); } catch (_) {}
    S.restored = false; S.agent = null; S.loading = null; S.assigned = true; S.agents = []; S.forUid = null;
    busyNow = false; status = 'ready';
    S.seq++; // an answer still on its way belongs to the account that signed out
    resetLook();
  }

  window.orvAgent = { load: load, apply: apply, current: function () { return S.agent; }, isChosen: function () { return !!(S.agent && S.assigned); }, choose: choose, formatReply: formatReply, renderResults: renderResults, historyText: historyText, record: record, restore: restore, clear: clear, forgetAll: forgetAll, openPage: openPage, glyph: glyph, hasPage: hasPage, busy: busy, where: where, status: function () { return status; } };

  function start() { bindComposer(); if (typeof apiFetch === 'function') load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 400); }); else setTimeout(start, 400);
})();
