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
      var left = panel.querySelector('.orv-ai-panel-head-left');
      if (left) left.innerHTML = '<div class="orv-agent-id"><div class="orv-agent-id-text"><div class="orv-ai-panel-name">Your assistant</div></div></div>';
      var intro = document.getElementById('orvAgentIntro'); if (intro) intro.textContent = '';
    }
    var old = document.getElementById('orvAgentPicker'); if (old) old.remove();
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
      panel.setAttribute('aria-label', 'Choose your OrivenAI assistant');
      var left = panel.querySelector('.orv-ai-panel-head-left');
      if (left) left.innerHTML = '<div class="orv-agent-id"><div class="orv-agent-id-text"><div class="orv-ai-panel-name">Your assistant</div><div class="orv-agent-role">Choose one to start</div></div></div>';
      var intro = document.getElementById('orvAgentIntro'); if (intro) intro.textContent = '';
      var div = panel.querySelector('.orv-ai-section-divider span'); if (div) div.textContent = 'Choose your assistant first';
      lockInput(true);
      renderPicker();
    }
  }
  function lockInput(on) {
    var inp = document.getElementById('orvAiInput'), btn = document.getElementById('orvAiSendBtn');
    if (inp) { inp.disabled = on; if (on) inp.placeholder = 'Choose your assistant above to start chatting'; }
    if (btn) btn.disabled = on;
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
      var head = panel.querySelector('.orv-ai-panel-head'), cw = panel.querySelector('.orv-ai-ctx-wrap');
      if (head && cw && !cw.classList.contains('orv-agent-ctx')) { cw.classList.add('orv-agent-ctx'); head.insertBefore(cw, head.firstChild); }
      var left = panel.querySelector('.orv-ai-panel-head-left');
      if (left) left.innerHTML = '<div class="orv-agent-id">' + glyph(a.id, 'orv-agent-head-glyph') + '<div class="orv-agent-id-text"><div class="orv-ai-panel-name">' + esc(a.name) + '</div><div class="orv-agent-role">' + esc(a.role) + '</div></div></div>';
      // The agent's short introduction, under the greeting (the line below it
      // stays the recommendations' status).
      var gt = document.getElementById('orvAiGreetingText');
      var intro = document.getElementById('orvAgentIntro');
      if (gt && !intro) { intro = document.createElement('p'); intro.id = 'orvAgentIntro'; intro.className = 'orv-agent-intro'; gt.parentNode.insertBefore(intro, gt.nextSibling); }
      if (intro) intro.textContent = a.intro || '';
      var div = panel.querySelector('.orv-ai-section-divider span');
      if (div) div.textContent = 'Ask ' + a.name;
      var inp = document.getElementById('orvAiInput');
      if (inp) inp.placeholder = 'Ask ' + a.name + ' anything, or what to do…';
      renderPicker();
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
  function formatReply(text) {
    var blocks = String(text == null ? '' : text).replace(/\r/g, '').split(/\n{2,}/);
    return blocks.map(function (b) {
      var lines = b.split('\n').filter(function (l) { return l.trim().length; });
      if (!lines.length) return '';
      var bullet = /^\s*(?:[-•*])\s+/, num = /^\s*\d+[.)]\s+/;
      var inline = function (s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/contact@orivenai\.com/g, '<a href="mailto:contact@orivenai.com">contact@orivenai.com</a>'); };
      if (lines.every(function (l) { return bullet.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(bullet, '')) + '</li>'; }).join('') + '</ul>';
      if (lines.every(function (l) { return num.test(l); })) return '<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(num, '')) + '</li>'; }).join('') + '</ol>';
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
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
    S.seq++; // an answer still on its way belongs to the account that signed out
    resetLook();
  }

  window.orvAgent = { load: load, apply: apply, current: function () { return S.agent; }, choose: choose, formatReply: formatReply, renderResults: renderResults, historyText: historyText, record: record, restore: restore, clear: clear, forgetAll: forgetAll, openPage: openPage, glyph: glyph, hasPage: hasPage };

  function start() { if (typeof apiFetch === 'function') load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 400); }); else setTimeout(start, 400);
})();
