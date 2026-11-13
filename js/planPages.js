/* ════════════════════════════════════════════════════════════════
   OrivenAI — Control Center → Marketing Plan and Progress

   Marketing Plan shows the customer's own marketing plan and nothing else:
   the plan generated after payment from their onboarding answers, for the
   period they bought (GET /api/onboarding/plan; content only with paid
   access, checked by the server). Progress lists the steps of that plan's
   roadmap with their completion, stored on the server
   (GET/POST /api/onboarding/progress).

   Opening either page never starts a paid action: the server starts the
   plan once after payment by itself, and a retry after a failed attempt is
   the customer's explicit click (no credits). Accounts without a plan see
   a short empty state, never a sample plan.
   Prefixes: mpl- (Marketing Plan), prg- (Progress).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, method, body) {
    if (typeof apiFetch !== 'function') return Promise.resolve({ ok: false, status: 0, data: null });
    return apiFetch(path, method ? { method: method, body: JSON.stringify(body || {}) } : undefined).then(function (r) { return r || { ok: false, status: 0, data: null }; }, function () { return { ok: false, status: 0, data: null }; });
  }
  function day(iso, withYear) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return '';
    return d.toLocaleDateString(undefined, withYear ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
  }
  var ASSISTANT_NAMES = { scout: 'Scout', vector: 'Vector', nova: 'Nova', momentum: 'Momentum', metric: 'Metric', flux: 'Flux' };
  // Every task names an OrivenAI page (shared keys: server services/pageKeys.js,
  // client js/pageRegistry.js). Older plans' steps name an area instead.
  var AREA_PAGE = { research: 'research', create: 'create', launch: 'launch', campaigns: 'campaigns', automations: 'automations' };
  function pageLabel(page) { return window.orvPages && window.orvPages.has(page) ? window.orvPages.label(page) : ''; }
  function pageBtn(page, text, primary) {
    if (!page || !(window.orvPages && window.orvPages.has(page))) return '';
    return '<button type="button" class="' + (primary ? 'onv-btn onv-btn--primary mpl-task__go' : 'prg-go') + '" data-orv-page="' + esc(page) + '">' + esc(text || ('Open ' + pageLabel(page))) + '</button>';
  }
  // The phase the calendar is in now (phases spread evenly over the period).
  function phaseNow(count, startIso, days) {
    var start = Date.parse(startIso || ''); if (!start || !count || !days) return -1;
    var i = Math.floor((Date.now() - start) / (days * 86400000 / count));
    return i < 0 ? 0 : Math.min(count - 1, i);
  }

  var PAGES = { plan: 'page-marketing-plan', progress: 'page-progress' };
  var S = { tok: 0, poll: 0, plan: null, planAt: 0, progress: null, open: null, uid: null };

  function mount() {
    var mc = document.querySelector('.mc');
    if (!mc || document.getElementById(PAGES.plan)) return;
    Object.keys(PAGES).forEach(function (k) {
      var pg = document.createElement('div');
      pg.className = 'page'; pg.id = PAGES[k];
      pg.innerHTML = '<div class="onv-panel ' + (k === 'plan' ? 'mpl' : 'prg') + '" id="' + (k === 'plan' ? 'mplRoot' : 'prgRoot') + '" aria-live="polite"></div>';
      mc.appendChild(pg);
      pg.addEventListener('click', onClick);
      pg.addEventListener('submit', function (e) {
        if (e.target.matches('[data-mpl-form]')) { e.preventDefault(); submitRecovery(e.target); }
        if (e.target.matches('[data-mpl-regen]')) { e.preventDefault(); submitRegen(e.target); }
      });
    });
  }

  function open(which) {
    mount();
    var id = PAGES[which]; if (!id) return;
    S.open = which;
    sameUser();
    if (typeof window._orvNav === 'function') window._orvNav(which === 'plan' ? 'marketingplan' : 'progress', id);
    else { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); document.getElementById(id).classList.add('active'); }
    if (which === 'plan') loadPlan(); else loadProgress();
    if (window.orvAppNavSync) window.orvAppNavSync();
  }
  function isOpen(which) { var el = document.getElementById(PAGES[which]); return !!(el && el.classList.contains('active')); }
  function stopPoll() { clearTimeout(S.poll); S.poll = 0; }
  // Sign-out doesn't reload the page: what was shown belongs to one account.
  function sameUser() {
    var uid = typeof _currentUser !== 'undefined' && _currentUser ? _currentUser.id : null;
    if (uid === S.uid) return;
    S.uid = uid; S.plan = null; S.progress = null;
    ['mplRoot', 'prgRoot'].forEach(function (id) { var el = document.getElementById(id); if (el) el.innerHTML = ''; });
  }

  // ── Shared pieces ───────────────────────────────────────────────
  function empty(kind, title, body, extra) {
    return '<section class="mpl-empty" data-state="' + esc(kind) + '">' +
      '<div class="mpl-empty__mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7.5L19 8v12.5H7z"/><path d="M14.5 3.5V8H19"/><path d="M10 12.5h6M10 16h4"/></svg></div>' +
      '<h1>' + esc(title) + '</h1><p>' + body + '</p>' + (extra || '') + '</section>';
  }
  function noPlanState() {
    return empty('none', 'No marketing plan yet',
      'Your marketing plan is created from your onboarding answers once your activation and payment are complete. This account doesn’t have one.');
  }
  function working(title, body) {
    return '<section class="mpl-empty" data-state="generating" aria-busy="true">' +
      '<div class="mpl-empty__mark is-working" aria-hidden="true"><span class="mpl-spin"></span></div>' +
      '<h1>' + esc(title) + '</h1><p>' + esc(body) + '</p></section>';
  }

  // ── Marketing Plan ──────────────────────────────────────────────
  function loadPlan(force) {
    var root = document.getElementById('mplRoot'); if (!root) return;
    stopPoll();
    var t = ++S.tok;
    if (!force && S.plan && Date.now() - S.planAt < 60000 && S.plan.plan) { root.innerHTML = planHtml(S.plan); return; }
    if (!root.innerHTML) root.innerHTML = '<p class="mpl-loading">Loading your marketing plan…</p>';
    api('/api/onboarding/plan').then(function (r) {
      if (t !== S.tok || !isOpen('plan')) return;
      renderPlan(r);
    });
  }
  // The roadmap's done states: Progress's own read (no write, no credits).
  // Only the roadmap block is redrawn, so an open form is left alone.
  function planProgress() {
    var t = S.tok;
    api('/api/onboarding/progress').then(function (r) {
      if (t !== S.tok || !isOpen('plan') || !S.plan || !r || !r.ok || !r.data || !Array.isArray(r.data.phases)) return;
      S.progress = r.data;
      var box = document.getElementById('mplRoadBody'); var P = S.plan.plan;
      if (box && P) box.innerHTML = roadmapHtml(P, S.plan, P.horizon || S.plan.horizon || null);
    });
  }
  function renderPlan(r) {
    var root = document.getElementById('mplRoot'); if (!root) return;
    var d = r && r.data;
    if (!r || !r.ok || !d) {
      // 503: the plan isn't available on this server yet; 401/403: not signed in / not set up.
      root.innerHTML = r && r.status === 0 ? empty('error', 'Your marketing plan couldn’t load', 'Check your connection and try again.', '<button type="button" class="onv-btn" data-mpl-reload>Try again</button>') : noPlanState();
      return;
    }
    if (d.locked === false && d.recovery) { root.innerHTML = recoveryOffer(); return; }
    if (d.locked !== false || d.onboarding === false) { root.innerHTML = noPlanState(); return; }
    var h = d.horizon && d.horizon.label ? d.horizon.label : '';
    if (d.status === 'ready' && d.plan) {
      S.plan = d; S.planAt = Date.now(); root.innerHTML = planHtml(d);
      planProgress();
      if (d.regen && d.regen.status === 'generating') S.poll = setTimeout(function () { if (isOpen('plan')) loadPlan(true); }, 5000);
      return;
    }
    if (d.status === 'generating' || (d.status === 'none' && !(d.missing || []).length && d.period)) {
      root.innerHTML = working('Preparing your marketing plan', 'We’re writing your plan' + (h ? ' for the next ' + h : '') + ' from your onboarding answers. This usually takes under a minute — you can leave this page and come back.');
      S.poll = setTimeout(function () { if (isOpen('plan')) loadPlan(true); }, 4000);
      return;
    }
    if (d.status === 'none' && (d.missing || []).length && !d.recovery) {
      root.innerHTML = empty('missing', 'Some onboarding answers are missing', 'Your plan is built from your onboarding answers, and a few are missing. Email <a href="mailto:contact@orivenai.com">contact@orivenai.com</a> and we’ll complete it with you.');
      return;
    }
    if (d.status === 'failed') {
      var left = d.attemptsLeft || 0;
      root.innerHTML = empty('failed', 'Your marketing plan couldn’t be prepared',
        (d.error === 'busy' ? 'OrivenAI was very busy. ' : 'Something went wrong while writing your plan. ') + 'Your answers are saved.',
        left > 0 ? '<button type="button" class="onv-btn onv-btn--primary" data-mpl-retry>Try again</button><p class="mpl-fine">' + left + ' attempt' + (left === 1 ? '' : 's') + ' left · no credits are used</p>'
          : '<p class="mpl-fine">Email <a href="mailto:contact@orivenai.com">contact@orivenai.com</a> and we’ll prepare it for you.</p>');
      return;
    }
    root.innerHTML = noPlanState();
  }
  function retryPlan(btn) {
    btn.disabled = true; btn.textContent = 'Starting…';
    api('/api/onboarding/plan', 'POST', {}).then(function (r) {
      if (!isOpen('plan')) return;
      if (r.ok) { renderPlan(r); return; }
      btn.disabled = false; btn.textContent = 'Try again';
      if (window.orvToast) window.orvToast((r.data && r.data.error) || 'Couldn’t start your plan. Please try again.', 'warn');
      if (r.data && r.data.code === 'PLAN_ATTEMPTS_USED') loadPlan(true);
    });
  }

  // ── Missing plan: paying customers from before the onboarding ──────
  // GET/POST /api/onboarding/recovery: OrivenAI reuses what it knows, asks
  // only what's missing, and writes the plan for the purchased period. No
  // purchase, no access time, no credits.
  function recoveryOffer() {
    return empty('recovery', 'Create your marketing plan',
      'Your OrivenAI plan is active, but your account doesn’t have a marketing plan yet — they were introduced after you joined. OrivenAI uses what it already knows about your business and only asks what’s missing. No extra charge, no credits.',
      '<button type="button" class="onv-btn onv-btn--primary" data-mpl-recover>Create my marketing plan</button>');
  }
  var REC = null;
  function loadRecovery(btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    api('/api/onboarding/recovery').then(function (r) {
      var root = document.getElementById('mplRoot'); if (!root || !isOpen('plan')) return;
      var d = r && r.ok && r.data;
      if (!d) { root.innerHTML = empty('error', 'This couldn’t load', 'Check your connection and try again.', '<button type="button" class="onv-btn" data-mpl-recover>Try again</button>'); return; }
      if (d.reason === 'period_unknown') {
        root.innerHTML = empty('period', 'We need to check the length of your plan',
          'Your marketing plan covers the period of the plan you bought, and we couldn’t find it for this account. Email <a href="mailto:contact@orivenai.com">contact@orivenai.com</a> and we’ll set it up — nothing is charged.');
        return;
      }
      if (!d.available) { loadPlan(true); return; }
      REC = d; root.innerHTML = recoveryForm(d);
      var first = root.querySelector('.mpl-rec input, .mpl-rec textarea'); if (first) first.focus({ preventScroll: true });
    });
  }
  function fieldHtml(f, value, idp) {
    var id = idp + f.path.replace('.', '-'), v = value == null ? '' : value;
    if (f.type === 'choice' || f.type === 'multi') {
      var multi = f.type === 'multi', vals = multi ? (Array.isArray(v) ? v : []) : [v];
      return '<fieldset class="mpl-f" data-path="' + esc(f.path) + '"><legend>' + esc(f.label) + '</legend><div class="mpl-chips">' + f.options.map(function (o) {
        return '<label class="mpl-chip"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + id + '" value="' + esc(o[0]) + '"' + (vals.indexOf(o[0]) >= 0 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
      }).join('') + '</div><p class="mpl-ferr" hidden></p></fieldset>';
    }
    var input = f.type === 'textarea'
      ? '<textarea id="' + id + '" class="mpl-in" rows="2" maxlength="' + (f.max || 500) + '">' + esc(v) + '</textarea>'
      : '<input id="' + id + '" class="mpl-in" type="text" maxlength="' + (f.max || 300) + '" value="' + esc(v) + '">';
    return '<div class="mpl-f" data-path="' + esc(f.path) + '"><label for="' + id + '">' + esc(f.label) + '</label>' + input + '<p class="mpl-ferr" hidden></p></div>';
  }
  var SOURCE = { business_profile: 'From your business profile', onboarding: 'From your onboarding answers' };
  function recoveryForm(d) {
    var h = d.horizon;
    return '<form class="mpl-rec" data-mpl-form novalidate aria-labelledby="mplRecH">' +
      '<header class="mpl-head"><p class="mpl-eyebrow">Marketing plan · ' + esc(h.label) + '</p><h1 id="mplRecH">Create your marketing plan</h1>' +
        '<p class="mpl-meta">It covers the next ' + esc(h.label) + ' — the length of your current plan. No extra charge and no credits used.</p></header>' +
      (d.missing.length ? '<section class="mpl-rec__sec"><h2>' + (d.known.length ? 'A few questions' : 'About your business') + '</h2><p class="mpl-fine">' + (d.known.length ? 'Only what OrivenAI doesn’t know yet.' : 'OrivenAI doesn’t have saved answers for this account yet, so these are the questions the plan is built from.') + '</p>' +
        d.missing.map(function (f) { return fieldHtml(f, null, 'mplM-'); }).join('') + '</section>' : '') +
      (!d.assistant ? '<section class="mpl-rec__sec"><h2>Choose your assistant</h2><p class="mpl-fine">The plan is written in its voice, and it’s the assistant you talk to in OrivenAI.</p><fieldset class="mpl-f" data-path="assistant"><legend class="rx-sr">Assistant</legend><div class="mpl-chips">' +
        d.assistants.map(function (a) { return '<label class="mpl-chip mpl-chip--a"><input type="radio" name="mplAssistant" value="' + esc(a.id) + '"><span><b>' + esc(a.name) + '</b> ' + esc(a.role) + '</span></label>'; }).join('') + '</div><p class="mpl-ferr" hidden></p></fieldset></section>' : '') +
      (d.known.length ? '<section class="mpl-rec__sec"><h2>What OrivenAI already knows</h2><p class="mpl-fine">Check it, and change anything that’s out of date.</p><ul class="mpl-known">' + d.known.map(function (k) {
        return '<li data-path="' + esc(k.path) + '"><div class="mpl-known__b"><span class="mpl-known__l">' + esc(k.label) + '</span><span class="mpl-known__v">' + esc(k.display) + '</span><span class="mpl-known__s">' + esc(SOURCE[k.source] || '') + '</span></div>' +
          '<button type="button" class="prg-go" data-mpl-edit="' + esc(k.path) + '">Change</button><div class="mpl-known__edit" hidden>' + fieldHtml(k, k.value, 'mplK-') + '</div></li>';
      }).join('') + '</ul></section>' : '') +
      '<p class="mpl-formerr" role="alert" hidden></p>' +
      '<div class="mpl-rec__go"><button type="submit" class="onv-btn onv-btn--primary">Create my marketing plan</button><span class="mpl-fine">Writing it takes about a minute.</span></div></form>';
  }
  function valueOf(box) {
    if (box.tagName === 'FIELDSET') {
      var inputs = box.querySelectorAll('input');
      if (inputs[0] && inputs[0].type === 'checkbox') return Array.prototype.filter.call(inputs, function (i) { return i.checked; }).map(function (i) { return i.value; });
      var c = box.querySelector('input:checked'); return c ? c.value : '';
    }
    var el = box.querySelector('input, textarea'); return el ? el.value.trim() : '';
  }
  function submitRecovery(form) {
    var answers = {}, assistant = null;
    form.querySelectorAll('.mpl-f[data-path]').forEach(function (box) {
      var path = box.getAttribute('data-path');
      if (box.closest('.mpl-known__edit[hidden]')) return; // known and unchanged
      var v = valueOf(box);
      if (path === 'assistant') { assistant = v || null; return; }
      var p = path.split('.'); answers[p[0]] = answers[p[0]] || {}; answers[p[0]][p[1]] = v;
    });
    var btn = form.querySelector('[type="submit"]'), err = form.querySelector('.mpl-formerr');
    form.querySelectorAll('.mpl-ferr').forEach(function (e) { e.hidden = true; });
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
    err.hidden = true; btn.disabled = true; btn.textContent = 'Starting…';
    api('/api/onboarding/recovery', 'POST', assistant ? { answers: answers, assistant: assistant } : { answers: answers }).then(function (r) {
      if (!isOpen('plan')) return;
      if (r.ok) { S.plan = null; renderPlan(r); return; }
      btn.disabled = false; btn.textContent = 'Create my marketing plan';
      var d = r.data || {};
      var bad = d.code === 'ANSWERS_INCOMPLETE' ? (d.missing || []) : d.code === 'ASSISTANT_REQUIRED' ? ['assistant'] : [];
      bad.forEach(function (path) {
        var box = form.querySelector('.mpl-f[data-path="' + path + '"]');
        if (!box) return;
        var edit = box.closest('.mpl-known__edit'); if (edit) edit.hidden = false;
        box.setAttribute('aria-invalid', 'true');
        var fe = box.querySelector('.mpl-ferr'); if (fe) { fe.textContent = path === 'assistant' ? 'Choose an assistant.' : 'Please answer this.'; fe.hidden = false; }
      });
      err.textContent = bad.length ? 'A few answers are still missing — they’re marked above.' : (d.error || 'Your plan couldn’t be started. Please try again.');
      err.hidden = false;
      var firstBad = form.querySelector('[aria-invalid="true"]'); if (firstBad && firstBad.scrollIntoView) firstBad.scrollIntoView({ block: 'center' });
      if (d.code === 'PLAN_EXISTS' || d.code === 'PLAN_GENERATING' || d.code === 'PLAN_FAILED') loadPlan(true);
    });
  }

  var SECTIONS = [
    ['roadmap', 'Action plan'], ['priorities', 'Priorities'], ['overview', 'Business overview'], ['audience', 'Audience'],
    ['positioning', 'Positioning'], ['objectives', 'Objectives'], ['channels', 'Channels'], ['content', 'Content'], ['campaigns', 'Campaign ideas'],
  ];
  function planHtml(d) {
    var P = d.plan, h = P.horizon || d.horizon || null;
    var li = function (a) { return (a || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
    // The assistant that wrote this plan (stored with it), not necessarily today's.
    var by = P.assistant || d.assistant, who = ASSISTANT_NAMES[by] ? 'Prepared with ' + ASSISTANT_NAMES[by] : '';
    var meta = [who, P.version > 1 ? 'Version ' + P.version : '', d.generatedAt ? (P.version > 1 ? 'written ' : '') + day(d.generatedAt, true) : ''].filter(Boolean).join(' · ');
    var body = {
      priorities: (P.priorities || []).length ? '<ol class="mpl-pri">' + li(P.priorities) + '</ol>' : '',
      roadmap: (function () { var x = roadmapHtml(P, d, h); return x ? '<div id="mplRoadBody">' + x + '</div>' : ''; })(),
      overview: P.overview && P.overview.text ? '<p>' + esc(P.overview.text) + '</p>' : '',
      audience: (P.audience && P.audience.text ? '<p>' + esc(P.audience.text) + '</p>' : '') +
        ((P.audience && P.audience.segments || []).length ? '<dl class="mpl-dl">' + P.audience.segments.map(function (s) { return '<dt>' + esc(s.name) + '</dt><dd>' + esc(s.needs) + '</dd>'; }).join('') + '</dl>' : ''),
      positioning: (P.positioning && P.positioning.statement ? '<blockquote class="mpl-quote">' + esc(P.positioning.statement) + '</blockquote>' : '') +
        ((P.positioning && P.positioning.proof_points || []).length ? '<ul>' + li(P.positioning.proof_points) + '</ul>' : ''),
      objectives: (P.objectives || []).length ? '<dl class="mpl-dl">' + P.objectives.map(function (o) { return '<dt>' + esc(o.objective) + '</dt><dd>' + (o.measure ? 'Measured by ' + esc(o.measure) : '') + '</dd>'; }).join('') + '</dl>' : '',
      channels: (P.channels || []).length ? '<dl class="mpl-dl">' + P.channels.map(function (c) { return '<dt>' + esc(c.channel) + ' <span class="mpl-tag">' + esc(c.effort) + ' effort</span></dt><dd>' + (c.role ? '<b>' + esc(c.role) + '.</b> ' : '') + esc(c.why) + '</dd>'; }).join('') + '</dl>' : '',
      content: ((P.content && P.content.pillars) || []).map(function (pl) { return '<h4>' + esc(pl.name) + '</h4><ul>' + li(pl.ideas) + '</ul>'; }).join('') + (P.content && P.content.cadence ? '<p><b>Cadence:</b> ' + esc(P.content.cadence) + '</p>' : ''),
      campaigns: (P.campaigns || []).length ? '<dl class="mpl-dl">' + P.campaigns.map(function (c) { return '<dt>' + esc(c.name) + '</dt><dd>' + (c.goal ? '<b>' + esc(c.goal) + '.</b> ' : '') + esc(c.idea) + '</dd>'; }).join('') + '</dl>' : '',
    };
    var present = SECTIONS.filter(function (s) { return body[s[0]]; });
    var busy = d.regen && d.regen.status === 'generating';
    return '<article class="mpl-doc" aria-labelledby="mplTitle">' +
      '<header class="mpl-head">' +
        '<p class="mpl-eyebrow">Marketing plan' + (h && h.label ? ' · ' + esc(h.label) : '') + '</p>' +
        '<h1 id="mplTitle">' + esc(d.businessName ? d.businessName : 'Your marketing plan') + '</h1>' +
        '<p class="mpl-promise">A plan built around your business: a personalised advertising strategy, organised into clear phases and tasks you can act on.</p>' +
        (meta ? '<p class="mpl-meta">' + esc(meta) + '</p>' : '') +
        // The plan's one-line summary belongs to the title card.
        (P.summary ? '<p class="mpl-summary">' + esc(P.summary) + '</p>' : '') +
        regenBanner(d) +
        (P.request ? '<p class="mpl-asked"><span>You asked</span>“' + esc(P.request) + '”</p>' : '') +
        (busy ? '' : '<div class="mpl-tools"><button type="button" class="onv-btn" data-mpl-update aria-expanded="false" aria-controls="mplUpdate">Write a new plan</button></div>' +
        '<div class="mpl-update" id="mplUpdate" hidden>' + updateHtml(d) + '</div>') +
      '</header>' +
      '<nav class="mpl-toc" aria-label="Sections of your plan"><ol>' + present.map(function (s) { return '<li><a href="#mpl-' + s[0] + '" data-mpl-jump="' + s[0] + '">' + esc(s[0] === 'roadmap' && h && h.label ? 'Action plan · ' + h.label : s[1]) + '</a></li>'; }).join('') + '</ol></nav>' +
      (function () {
        var sec = function (s, cls) { return '<section class="mpl-sec' + (cls ? ' ' + cls : '') + '" id="mpl-' + s[0] + '" aria-labelledby="mpl-' + s[0] + '-h"><h2 id="mpl-' + s[0] + '-h">' + esc(s[0] === 'roadmap' && h && h.label ? 'Action plan · ' + h.label : s[1]) + '</h2>' + body[s[0]] + '</section>'; };
        // The action plan keeps its own cards; the strategy sections (priorities,
        // audience, positioning…) are cards in a grid, equal height per row.
        var road = present.filter(function (s) { return s[0] === 'roadmap'; }), rest = present.filter(function (s) { return s[0] !== 'roadmap'; });
        return road.map(function (s) { return sec(s); }).join('') + (rest.length ? '<div class="mpl-cards">' + rest.map(function (s) { return sec(s, 'mpl-card'); }).join('') + '</div>' : '');
      })() +
    '</article>';
  }
  // The action plan: per period phase, the tasks to do in OrivenAI, each
  // with why it matters, what to do and a button to the page it's done on.
  // Older plans (steps without a catalogue action) still show as a list.
  // How each task happens (services/planCatalog.js mode) — the same three
  // words as the website, so the user always knows what OrivenAI does itself.
  var MODE = { done: ['done', 'In OrivenAI'], prepared: ['prepared', 'Prepared for you'], platform: ['platform', 'Through your ad account'] };
  // The workflow stages the catalogue's stages roll up into.
  var FLOW = [['Understand', ['setup']], ['Research', ['research']], ['Strategy', ['audience', 'strategy']], ['Create', ['creative']], ['Launch', ['build', 'launch']], ['Measure & improve', ['analyse', 'optimise']]];
  // Done states come from Progress (GET /api/onboarding/progress: verified
  // tasks are done only when the result exists). Step ids are p<phase>-a<task>.
  function doneMap() {
    var m = {}, pr = S.progress;
    if (pr && Array.isArray(pr.phases)) pr.phases.forEach(function (p) { (p.steps || []).forEach(function (x) { if (x.done) m[x.id] = true; }); });
    return m;
  }
  function roadmapOverview(road, cat, now, done, known) {
    var all = [], next = null;
    road.forEach(function (r, i) { (r.tasks || []).forEach(function (t, j) { var id = 'p' + (i + 1) + '-a' + (j + 1); all.push({ t: t, id: id, i: i, c: cat[t.action] || {} }); }); });
    if (!all.length) return '';
    var n = all.filter(function (x) { return done[x.id]; }).length;
    for (var k = 0; k < all.length; k++) { if (!done[all[k].id] && all[k].i <= Math.max(now, 0)) { next = all[k]; break; } }
    if (!next) for (var k2 = 0; k2 < all.length; k2++) if (!done[all[k2].id]) { next = all[k2]; break; }
    var stages = FLOW.map(function (f) {
      var xs = all.filter(function (x) { return f[1].indexOf(x.c.stage) !== -1; });
      var d = xs.filter(function (x) { return done[x.id]; }).length;
      return xs.length ? '<li class="mpl-flow__s' + (d === xs.length ? ' is-done' : d ? ' is-part' : '') + '"><b>' + esc(f[0]) + '</b><span>' + (known ? d + ' of ' + xs.length : xs.length + ' task' + (xs.length === 1 ? '' : 's')) + '</span></li>' : '';
    }).join('');
    return '<div class="mpl-where" aria-label="Where you are">' +
      '<div class="mpl-where__top"><p><b>' + esc(now >= 0 && road[now] ? road[now].phase : road[0].phase) + '</b>' + (known ? ' · ' + n + ' of ' + all.length + ' tasks done' : ' · ' + all.length + ' tasks in this plan') + '</p>' +
        (known ? '<span class="mpl-where__bar" role="img" aria-label="' + n + ' of ' + all.length + ' tasks done"><i style="width:' + Math.round(n / all.length * 100) + '%"></i></span>' : '') + '</div>' +
      '<ol class="mpl-flow" aria-label="Your plan by workflow stage">' + stages + '</ol>' +
      (next ? '<div class="mpl-next"><p class="mpl-next__k">Next task</p><p class="mpl-next__t">' + esc(next.t.title || next.c.label || '') + '</p>' +
        (next.c.result ? '<p class="mpl-next__r">You’ll have: ' + esc(next.c.result) + '</p>' : '') + '<div class="mpl-next__a">' + pageBtn(next.c.page, next.c.button, true) + '</div></div>'
        : (known ? '<p class="mpl-next__done">Every task in this plan is done.</p>' : '')) +
    '</div>';
  }
  function roadmapHtml(P, d, h) {
    var road = P.roadmap || []; if (!road.length) return '';
    var cat = d.catalog || {};
    var now = phaseNow(road.length, P.startsAt || d.unlockedAt || d.generatedAt, h && h.days);
    var anyTask = road.some(function (r) { return Array.isArray(r.tasks); });
    var done = doneMap(), known = !!(S.progress && Array.isArray(S.progress.phases));
    var flat = []; road.forEach(function (r) { (Array.isArray(r.tasks) ? r.tasks : []).forEach(function (t) { flat.push(t); }); });
    var html = (anyTask ? roadmapOverview(road, cat, now, done, known) : '') + '<ol class="mpl-road">' + road.map(function (r, i) {
      var tag = i === now ? '<span class="prg-now">Now</span>' : '';
      if (!Array.isArray(r.tasks)) {
        return '<li><div class="mpl-road__h"><b>' + esc(r.phase) + '</b>' + tag + (r.focus ? '<span>' + esc(r.focus) + '</span>' : '') + '</div><ul>' +
          (r.actions || []).map(function (a) { return '<li>' + esc(typeof a === 'string' ? a : a.step) + '</li>'; }).join('') + '</ul></li>';
      }
      return '<li' + (i === now ? ' data-state="now"' : '') + '><div class="mpl-road__h"><b>' + esc(r.phase) + '</b>' + tag + '<em>' + r.tasks.length + ' task' + (r.tasks.length === 1 ? '' : 's') + '</em>' + (r.focus ? '<span>' + esc(r.focus) + '</span>' : '') + '</div>' +
        '<ol class="mpl-tasks">' + r.tasks.map(function (t, j) {
          var c = cat[t.action] || {};
          var where = pageLabel(c.page);
          var id = 'p' + (i + 1) + '-a' + (j + 1), isDone = !!done[id];
          var mode = MODE[c.mode];
          var after = flat[flat.indexOf(t) + 1];
          return '<li class="mpl-task' + (isDone ? ' is-done' : '') + '" data-step="' + id + '"><details><summary>' + (known ? '<span class="mpl-task__s" aria-hidden="true"></span>' : '') + '<span class="mpl-task__t">' + esc(t.title || c.label || '') + (isDone ? '<span class="mpl-task__done">Done</span>' : '') + '</span>' + (where ? '<span class="mpl-task__p">' + esc(where) + '</span>' : '') + '</summary>' +
            '<div class="mpl-task__b">' +
              (mode ? '<p class="mpl-task__how"><span class="ow-tag ow-tag--' + mode[0] + '">' + mode[1] + '</span></p>' : '') +
              (t.why ? '<p><b>Why:</b> ' + esc(t.why) + '</p>' : '') +
              (t.what ? '<p><b>What to do:</b> ' + esc(t.what) + '</p>' : '') +
              (c.needs ? '<p><b>You’ll need:</b> ' + esc(c.needs) + '</p>' : '') +
              (c.result ? '<p><b>Result:</b> ' + esc(c.result) + '</p>' : '') +
              (after ? '<p class="mpl-task__next"><b>Then:</b> ' + esc(after.title || ((cat[after.action] || {}).label) || '') + '</p>' : '') +
              '<div class="mpl-task__a">' + pageBtn(c.page, c.button, true) +
                '<span class="mpl-fine">' + (c.verify === 'auto' ? 'Ticks off in Progress by itself once it’s done.' : 'You confirm this one in Progress.') + '</span></div>' +
            '</div></details></li>';
        }).join('') + '</ol></li>';
    }).join('') + '</ol>';
    return html + (anyTask ? '' : '<p class="mpl-fine">This plan was written in an earlier format. Its steps are shown as written.</p>') +
      '<p class="mpl-more"><button type="button" class="onv-btn" data-mpl-go="progress">Track these tasks in Progress</button></p>';
  }

  // ── A new plan on request (POST /api/onboarding/plan/regenerate) ──
  // The owner says what should change; the server writes a new plan from
  // their onboarding answers, business details, what they saved in OrivenAI
  // and these instructions. The current plan stays until the new one is
  // ready; credits are returned when it can't be written.
  var IDEAS = ['Focus on Meta and Instagram only', 'My budget is lower now — keep it lean', 'I’m launching a new product', 'Target a new audience', 'More video ads, fewer images'];
  function planCost() { try { return (typeof CREDIT_COSTS !== 'undefined' && CREDIT_COSTS.plan) || 90; } catch (_) { return 90; } }
  function updateHtml(d) {
    var left = (d && d.regen && d.regen.status === 'failed' && d.regen.instructions) || '';
    return '<form class="mpl-regen" data-mpl-regen novalidate>' +
      '<h2 class="mpl-regen__t">Write a new version of your plan</h2>' +
      '<p class="mpl-fine">Tell ' + esc(ASSISTANT_NAMES[(d.plan && d.plan.assistant) || d.assistant] || 'your assistant') + ' what has changed or what you want differently. The new plan uses your onboarding answers, business details and what you’ve saved in OrivenAI — research, audiences, competitors and campaigns.</p>' +
      '<label class="mpl-regen__l" for="mplRegenText">What should change?</label>' +
      '<textarea id="mplRegenText" class="mpl-in" rows="3" maxlength="600" placeholder="e.g. We now sell gift boxes too, our budget is €500 a month and we want to focus on Meta.">' + esc(left) + '</textarea>' +
      '<div class="mpl-chips mpl-regen__ideas" aria-label="Ideas">' + IDEAS.map(function (x) { return '<button type="button" class="mpl-chip mpl-chip--btn" data-mpl-idea="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<ul class="mpl-regen__facts">' +
        '<li>Your current plan stays until the new one is ready. The plan it replaces is kept.</li>' +
        '<li>Progress starts again with the new plan’s tasks. Your research, content, audiences and campaigns aren’t touched.</li>' +
        '<li>It covers the rest of your access and uses ' + planCost() + ' credits — returned if it can’t be written.</li>' +
      '</ul>' +
      '<p class="mpl-formerr" role="alert" hidden></p>' +
      '<div class="mpl-regen__go"><button type="submit" class="onv-btn onv-btn--primary">Write new plan · ' + planCost() + ' credits</button><button type="button" class="onv-btn" data-mpl-update-close>Cancel</button></div>' +
    '</form>';
  }
  function regenBanner(d) {
    var r = d.regen; if (!r) return '';
    if (r.status === 'generating') return '<div class="mpl-regen-state" role="status" data-state="generating"><span class="mpl-spin" aria-hidden="true"></span><div><b>Writing your new plan…</b><p>This takes a minute or two. Your current plan below stays until the new one is ready — you can keep working.</p></div></div>';
    if (r.status === 'failed') {
      var why = r.error === 'busy' ? 'OrivenAI was very busy.' : r.error === 'timeout' ? 'It took too long.' : 'Something went wrong while writing it.';
      return '<div class="mpl-regen-state" role="alert" data-state="failed"><div><b>Your new plan couldn’t be written.</b><p>' + why + ' Your current plan hasn’t changed and the credits were returned. You can try again below.</p></div></div>';
    }
    return '';
  }
  function submitRegen(form) {
    var text = (form.querySelector('#mplRegenText').value || '').trim();
    var btn = form.querySelector('[type="submit"]'), err = form.querySelector('.mpl-formerr');
    err.hidden = true; btn.disabled = true; btn.textContent = 'Starting…';
    api('/api/onboarding/plan/regenerate', 'POST', { instructions: text }).then(function (r) {
      if (!isOpen('plan')) return;
      if (r.ok && r.data) {
        if (typeof window.consumeUsage === 'function') window.consumeUsage(planCost());
        S.plan = null; renderPlan(r); return;
      }
      btn.disabled = false; btn.textContent = 'Write new plan · ' + planCost() + ' credits';
      var dd = r.data || {};
      if ((r.status === 402) && typeof window.orvOpenActionPaywall === 'function') window.orvOpenActionPaywall('create', { status: 402, code: dd.code, balance: dd.balance });
      err.textContent = dd.error || (r.status === 0 ? 'We couldn’t reach OrivenAI. Check your connection and try again.' : 'Your new plan couldn’t be started. Please try again.');
      err.hidden = false;
      if (dd.code === 'PLAN_REGENERATING') loadPlan(true);
    });
  }

  // ── Progress ────────────────────────────────────────────────────
  function loadProgress() {
    var root = document.getElementById('prgRoot'); if (!root) return;
    stopPoll();
    var t = ++S.tok;
    if (!root.innerHTML) root.innerHTML = '<p class="mpl-loading">Loading your progress…</p>';
    api('/api/onboarding/progress').then(function (r) {
      if (t !== S.tok || !isOpen('progress')) return;
      var d = r && r.data;
      if (!r || !r.ok || !d) {
        root.innerHTML = r && r.status === 0 ? empty('error', 'Your progress couldn’t load', 'Check your connection and try again.', '<button type="button" class="onv-btn" data-prg-reload>Try again</button>') : noSteps();
        return;
      }
      // Paying, but no plan yet (account from before the onboarding): the steps come once the plan exists.
      if (!d.locked && (d.onboarding === false || d.status === 'none')) { root.innerHTML = empty('none', 'No progress steps yet', 'Your steps come from your marketing plan, and this account doesn’t have one yet. Create it on the Marketing Plan page — OrivenAI reuses what it already knows about your business.', '<button type="button" class="onv-btn onv-btn--primary" data-mpl-go="plan">Open Marketing Plan</button>'); return; }
      if (d.locked || d.status === 'locked') { root.innerHTML = noSteps(); return; }
      if (d.status !== 'ready') {
        root.innerHTML = d.status === 'generating' ? working('Your steps are on their way', 'They come from your marketing plan, which is being written right now.')
          : empty('failed', 'No steps yet', 'Your steps come from your marketing plan, which isn’t ready. Open Marketing Plan to see why.', '<button type="button" class="onv-btn" data-mpl-go="plan">Open Marketing Plan</button>');
        if (d.status === 'generating') S.poll = setTimeout(function () { if (isOpen('progress')) loadProgress(); }, 5000);
        return;
      }
      S.progress = d;
      root.innerHTML = progressHtml(d);
    });
  }
  function noSteps() {
    return empty('none', 'No progress steps yet', 'Your steps come from your marketing plan, which is created after your activation and payment are complete. This account doesn’t have one.');
  }
  function currentPhase(d) {
    var now = Date.now(), idx = 0;
    d.phases.forEach(function (p, i) { if (Date.parse(p.starts) <= now) idx = i; });
    return idx;
  }
  function progressHtml(d) {
    var cur = currentPhase(d), pct = d.total ? Math.round(d.completed / d.total * 100) : 0;
    var h = d.horizon || {};
    var curP = d.phases[cur] || null;
    var curDone = curP ? curP.steps.filter(function (x) { return x.done; }).length : 0;
    // Next up: the first open task from the current phase on, else an earlier one left open.
    var open1 = function (from, to) { for (var i = from; i < to; i++) { var s = d.phases[i].steps.filter(function (x) { return !x.done; })[0]; if (s) return s; } return null; };
    var next = open1(Math.max(0, cur), d.phases.length) || open1(0, Math.max(0, cur));
    var stat = function (n, l) { return '<div class="prg-stat"><b>' + n + '</b><span>' + esc(l) + '</span></div>'; };
    return '<article class="prg-doc" aria-labelledby="prgTitle">' +
      '<header class="mpl-head prg-head">' +
        '<p class="mpl-eyebrow">Progress' + (h.label ? ' · ' + esc(h.label) : '') + '</p>' +
        '<h1 id="prgTitle">Your next steps</h1>' +
        '<p class="prg-count" aria-live="polite"><b class="prg-done-n">' + d.completed + '</b> of ' + d.total + ' tasks done · ' + pct + '%</p>' +
        '<div class="prg-bar" role="progressbar" aria-label="Tasks done" aria-valuemin="0" aria-valuemax="' + d.total + '" aria-valuenow="' + d.completed + '"><i style="width:' + pct + '%"></i></div>' +
      '</header>' +
      // Summary in a rail of cards (beside the phases on wide screens, above them on narrow ones).
      '<div class="prg-layout"><aside class="prg-rail" aria-label="Progress summary">' +
        '<div class="prg-stats">' +
          stat(curP ? esc(curP.phase) : '—', 'Current phase') +
          stat(curP ? curDone + '/' + curP.steps.length : '—', 'Done this phase') +
          stat(d.completed, 'Completed') +
          stat(d.total - d.completed, 'Remaining') +
        '</div>' +
        (next ? '<div class="prg-next"><span>Next up</span><b>' + esc(next.step) + '</b>' + (next.page ? pageBtn(next.page, next.button, true) : '') + '</div>' : '') +
        '<section class="prg-card" aria-labelledby="prgPhasesH"><h2 class="prg-card__h" id="prgPhasesH">Per phase</h2>' +
        '<ol class="prg-months" aria-label="Progress per phase">' + d.phases.map(function (p, i) {
          var n = p.steps.filter(function (x) { return x.done; }).length, w = p.steps.length ? Math.round(n / p.steps.length * 100) : 0;
          return '<li' + (i === cur ? ' data-state="now"' : '') + ' title="' + esc(p.phase + ': ' + n + ' of ' + p.steps.length + ' done') + '"><span>' + esc(p.phase) + '</span><i><em style="width:' + w + '%"></em></i><span class="prg-months__n">' + n + '/' + p.steps.length + '</span></li>';
        }).join('') + '</ol>' +
        '<p class="mpl-fine">Tasks OrivenAI can see — research, audiences, creatives, campaigns, automations, connected platforms — tick off by themselves once they’re really done. Opening a page doesn’t count. Only tasks OrivenAI can’t check have a box to tick yourself.</p>' +
        '</section>' +
      '</aside><div class="prg-main">' +
      d.phases.map(function (p, i) {
        var done = p.steps.filter(function (x) { return x.done; }).length;
        var state = i < cur ? 'past' : i === cur ? 'now' : 'next';
        var openIt = i === cur || i === cur + 1 || (i < cur && done < p.steps.length);
        return '<details class="prg-phase" data-state="' + state + '"' + (openIt ? ' open' : '') + '>' +
          '<summary><span class="prg-phase__t"><b>' + esc(p.phase) + '</b><span class="prg-phase__d">' + esc(day(p.starts) + ' – ' + day(p.ends)) + '</span>' + (state === 'now' ? '<span class="prg-now">Now</span>' : '') + '</span>' +
            '<span class="prg-phase__n">' + done + '/' + p.steps.length + '</span></summary>' +
          (p.focus ? '<p class="prg-focus">' + esc(p.focus) + '</p>' : '') +
          '<ul class="prg-steps">' + p.steps.map(stepHtml).join('') + '</ul></details>';
      }).join('') +
      '</div></div>' +
    '</article>';
  }
  var TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function stepHtml(x) {
    var page = x.page || AREA_PAGE[x.area] || null;
    var where = pageLabel(page) || (x.legacy ? 'In your business' : '');
    var auto = x.verify === 'auto';
    // A verified task shows its state; only the user can't change it.
    var mark = auto
      ? '<span class="prg-check prg-check--auto" role="img" aria-checked="' + (x.done ? 'true' : 'false') + '" aria-label="' + esc((x.done ? 'Done: ' : 'Not done yet: ') + x.step) + '">' + TICK + '</span>'
      : '<button type="button" class="prg-check" role="checkbox" aria-checked="' + (x.done ? 'true' : 'false') + '" data-prg-toggle="' + esc(x.id) + '" aria-label="' + esc((x.done ? 'Done: ' : 'Mark as done: ') + x.step) + '">' + TICK + '</button>';
    var info = [where, auto ? (x.done ? 'done — checked by OrivenAI' : 'ticks off by itself') : (x.done ? 'confirmed by you' + (x.doneAt ? ' ' + day(x.doneAt) : '') : 'confirm it yourself')].filter(Boolean).join(' · ');
    return '<li class="prg-step' + (x.done ? ' is-done' : '') + '" data-step="' + esc(x.id) + '">' + mark +
      '<div class="prg-step__b"><p>' + esc(x.step) + '</p>' +
        (!x.done && x.what ? '<p class="prg-what">' + esc(x.what) + '</p>' : '') +
        '<span class="prg-area">' + esc(info) + '</span></div>' +
      (!x.done ? pageBtn(page, x.button) : '') + '</li>';
  }
  function toggleStep(btn) {
    var id = btn.getAttribute('data-prg-toggle'), want = btn.getAttribute('aria-checked') !== 'true';
    var li = btn.closest('.prg-step');
    // Shown at once; put back if the server doesn't confirm.
    paintStep(li, want);
    btn.disabled = true;
    api('/api/onboarding/progress', 'POST', { stepId: id, done: want }).then(function (r) {
      btn.disabled = false;
      if (!(r.ok && r.data && r.data.phases)) {
        paintStep(li, !want);
        if (r.data && r.data.code === 'VERIFIED_AUTOMATICALLY') { if (window.orvToast) window.orvToast(r.data.error, 'info'); loadProgress(); return; }
        if (window.orvToast) window.orvToast((r.data && r.data.error) || 'Couldn’t save that step. Please try again.', 'warn');
        return;
      }
      S.progress = r.data;
      var root = document.getElementById('prgRoot');
      var openIdx = Array.prototype.map.call(root.querySelectorAll('.prg-phase'), function (p) { return p.open; });
      root.innerHTML = progressHtml(r.data);
      Array.prototype.forEach.call(root.querySelectorAll('.prg-phase'), function (p, i) { if (openIdx[i] != null) p.open = openIdx[i]; });
      var again = root.querySelector('[data-prg-toggle="' + id + '"]'); if (again) again.focus({ preventScroll: true });
    });
  }
  function paintStep(li, on) {
    if (!li) return;
    li.classList.toggle('is-done', on);
    var b = li.querySelector('.prg-check'); if (b) b.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  function onClick(e) {
    var b = e.target.closest('button, a'); if (!b) return;
    if (b.hasAttribute('data-prg-toggle')) { toggleStep(b); return; }
    if (b.hasAttribute('data-orv-page')) { if (window.orvPages) window.orvPages.open(b.getAttribute('data-orv-page')); return; }
    if (b.hasAttribute('data-mpl-go')) { var to = b.getAttribute('data-mpl-go'); if (to === 'plan' || to === 'progress') open(to); else if (window.orvAppNav) window.orvAppNav.go(to); return; }
    if (b.hasAttribute('data-mpl-retry')) { retryPlan(b); return; }
    if (b.hasAttribute('data-mpl-recover')) { loadRecovery(b); return; }
    if (b.hasAttribute('data-mpl-edit')) { var li = b.closest('li'), ed = li && li.querySelector('.mpl-known__edit'); if (ed) { ed.hidden = false; b.hidden = true; var fi = ed.querySelector('input, textarea'); if (fi) fi.focus(); } return; }
    if (b.hasAttribute('data-mpl-reload')) { loadPlan(true); return; }
    if (b.hasAttribute('data-prg-reload')) { loadProgress(); return; }
    if (b.hasAttribute('data-mpl-update')) { var u = document.getElementById('mplUpdate'); u.hidden = !u.hidden; b.setAttribute('aria-expanded', String(!u.hidden)); if (!u.hidden) { var ta = u.querySelector('textarea'); if (ta) ta.focus(); } return; }
    if (b.hasAttribute('data-mpl-update-close')) { var u2 = document.getElementById('mplUpdate'); if (u2) u2.hidden = true; var ob = document.querySelector('[data-mpl-update]'); if (ob) { ob.setAttribute('aria-expanded', 'false'); ob.focus(); } return; }
    if (b.hasAttribute('data-mpl-idea')) { var t2 = document.getElementById('mplRegenText'); if (t2) { var add = b.getAttribute('data-mpl-idea'); t2.value = t2.value.trim() ? t2.value.trim().replace(/[.]?$/, '. ') + add : add; t2.focus(); } return; }
    if (b.hasAttribute('data-mpl-jump')) {
      e.preventDefault();
      var t = document.getElementById('mpl-' + b.getAttribute('data-mpl-jump'));
      if (t) { t.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    }
  }

  // ── Control Center card: where the plan stands and the next task ────
  // Rendered into the dashboard's plan slot (js/orivenPlan.js paintStrip).
  // extra: a secondary link the caller adds (the campaign calendar).
  var CARD = { at: 0, data: null, uid: null, busy: null };
  function paintCard(el, extra) {
    if (!el) return;
    var uid = typeof _currentUser !== 'undefined' && _currentUser ? _currentUser.id : null;
    var fresh = CARD.uid === uid && CARD.data && Date.now() - CARD.at < 60000;
    var draw = function (d) {
      var head = '<div class="ccx-card-hd bps-hd"><h2 class="ccx-h bps-t">Marketing plan</h2><button type="button" class="ccx-link bps-open" data-mpc-open="plan">Open plan →</button></div>';
      var body;
      if (!d || d.status !== 'ready' || !d.total) {
        body = '<p class="bps-empty">' + (d && d.status === 'generating' ? 'Your marketing plan is being written — it appears here when it’s ready.' : 'Your marketing plan turns your goals into tasks you do in OrivenAI, month by month.') + '</p>';
      } else {
        var cur = currentPhase(d), p = d.phases[cur], pct = Math.round(d.completed / d.total * 100);
        var pDone = p ? p.steps.filter(function (x) { return x.done; }).length : 0;
        var next = null;
        for (var i = Math.max(0, cur); i < d.phases.length && !next; i++) next = d.phases[i].steps.filter(function (x) { return !x.done; })[0] || null;
        body = '<p class="mpc-line"><b>' + esc(p ? p.phase : '') + '</b><span>' + pDone + ' of ' + (p ? p.steps.length : 0) + ' done this phase · ' + pct + '% overall</span></p>' +
          '<div class="prg-bar mpc-bar" role="progressbar" aria-label="Plan progress" aria-valuemin="0" aria-valuemax="' + d.total + '" aria-valuenow="' + d.completed + '"><i style="width:' + pct + '%"></i></div>' +
          (next ? '<div class="mpc-next"><span>Next up</span><b>' + esc(next.step) + '</b>' + (next.page && window.orvPages && window.orvPages.has(next.page) ? '<button type="button" class="ccx-link" data-orv-page="' + esc(next.page) + '">' + esc(next.button || 'Open') + ' →</button>' : '') + '</div>' : '<p class="bps-empty">Every task in this plan is done.</p>') +
          '<button type="button" class="ccx-link mpc-all" data-mpc-open="progress">See all tasks in Progress</button>';
      }
      el.innerHTML = head + body + (extra || '');
      if (!el._mpcBound) {
        el._mpcBound = true;
        el.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.hasAttribute('data-mpc-open')) open(b.getAttribute('data-mpc-open'));
          else if (b.hasAttribute('data-orv-page') && window.orvPages) window.orvPages.open(b.getAttribute('data-orv-page'));
        });
      }
    };
    if (fresh) { draw(CARD.data); return; }
    if (!CARD.data || CARD.uid !== uid) draw(null);
    if (CARD.busy) return;
    CARD.busy = api('/api/onboarding/progress').then(function (r) {
      CARD.busy = null;
      var now = typeof _currentUser !== 'undefined' && _currentUser ? _currentUser.id : null;
      if (now !== uid) return;
      CARD.uid = uid; CARD.at = Date.now(); CARD.data = r.ok && r.data ? r.data : null;
      if (document.contains(el)) draw(CARD.data);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.orvPlanPages = { open: open, paintCard: paintCard, reload: function () { S.plan = null; CARD.at = 0; if (isOpen('plan')) loadPlan(true); if (isOpen('progress')) loadProgress(); } };
})();
