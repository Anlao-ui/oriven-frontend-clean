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
  // Where a step is done → the page that opens it (js/appNav.js item ids).
  var AREA = {
    research: ['research', 'Open Research'], create: ['create', 'Open Create'], launch: ['adstudio', 'Open Ad Studio'],
    campaigns: ['overview', 'Open Campaigns'], automations: ['auto-overview', 'Open Automations'],
  };
  var AREA_LABEL = { research: 'Research', create: 'Create', launch: 'Launch', campaigns: 'Campaigns', automations: 'Automations', outside: 'In your business' };

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
      pg.addEventListener('submit', function (e) { if (e.target.matches('[data-mpl-form]')) { e.preventDefault(); submitRecovery(e.target); } });
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
    if (d.status === 'ready' && d.plan) { S.plan = d; S.planAt = Date.now(); root.innerHTML = planHtml(d); return; }
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
      (!d.assistant ? '<section class="mpl-rec__sec"><h2>Choose your assistant</h2><p class="mpl-fine">The plan is written in its voice; Oriven Chat uses it too.</p><fieldset class="mpl-f" data-path="assistant"><legend class="rx-sr">Assistant</legend><div class="mpl-chips">' +
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
    ['priorities', 'Priorities'], ['roadmap', 'Action plan'], ['overview', 'Business overview'], ['audience', 'Audience'],
    ['positioning', 'Positioning'], ['objectives', 'Objectives'], ['channels', 'Channels'], ['content', 'Content'], ['campaigns', 'Campaign ideas'],
  ];
  function planHtml(d) {
    var P = d.plan, h = P.horizon || d.horizon || null;
    var li = function (a) { return (a || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
    var who = ASSISTANT_NAMES[d.assistant] ? 'Prepared with ' + ASSISTANT_NAMES[d.assistant] : '';
    var meta = [who, d.generatedAt ? day(d.generatedAt, true) : ''].filter(Boolean).join(' · ');
    var body = {
      priorities: (P.priorities || []).length ? '<ol class="mpl-pri">' + li(P.priorities) + '</ol>' : '',
      roadmap: (P.roadmap || []).length ? '<ol class="mpl-road">' + P.roadmap.map(function (r) {
        return '<li><div class="mpl-road__h"><b>' + esc(r.phase) + '</b>' + (r.focus ? '<span>' + esc(r.focus) + '</span>' : '') + '</div><ul>' +
          (r.actions || []).map(function (a) { return '<li>' + esc(typeof a === 'string' ? a : a.step) + '</li>'; }).join('') + '</ul></li>';
      }).join('') + '</ol><p class="mpl-more"><button type="button" class="onv-btn" data-mpl-go="progress">Track these steps in Progress</button></p>' : '',
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
    return '<article class="mpl-doc" aria-labelledby="mplTitle">' +
      '<header class="mpl-head">' +
        '<p class="mpl-eyebrow">Marketing plan' + (h && h.label ? ' · ' + esc(h.label) : '') + '</p>' +
        '<h1 id="mplTitle">' + esc(d.businessName ? d.businessName : 'Your marketing plan') + '</h1>' +
        (meta ? '<p class="mpl-meta">' + esc(meta) + '</p>' : '') +
        '<div class="mpl-tools"><button type="button" class="onv-btn" data-mpl-update aria-expanded="false" aria-controls="mplUpdate">Update plan<span class="onv-dev">Soon</span></button></div>' +
        '<div class="mpl-update" id="mplUpdate" hidden>' + updateHtml() + '</div>' +
      '</header>' +
      (P.summary ? '<p class="mpl-summary">' + esc(P.summary) + '</p>' : '') +
      '<nav class="mpl-toc" aria-label="Sections of your plan"><ol>' + present.map(function (s) { return '<li><a href="#mpl-' + s[0] + '" data-mpl-jump="' + s[0] + '">' + esc(s[0] === 'roadmap' && h && h.label ? 'Action plan · ' + h.label : s[1]) + '</a></li>'; }).join('') + '</ol></nav>' +
      present.map(function (s) {
        return '<section class="mpl-sec" id="mpl-' + s[0] + '" aria-labelledby="mpl-' + s[0] + '-h"><h2 id="mpl-' + s[0] + '-h">' + esc(s[0] === 'roadmap' && h && h.label ? 'Action plan · ' + h.label : s[1]) + '</h2>' + body[s[0]] + '</section>';
      }).join('') +
    '</article>';
  }
  // Targeted updates need a backend that rewrites only the affected parts of
  // a stored plan, with a credit cost confirmed first. It doesn't exist yet,
  // so this says so instead of offering a full regeneration.
  function updateHtml() {
    return '<p><b>Plan updates are coming soon.</b> You’ll be able to change one thing — your target audience, advertising budget, product focus or marketing objective — and only the parts of the plan it affects will be rewritten. The rest stays as it is.</p>' +
      '<p>Each update will show its credit cost and ask you to confirm before anything is charged. Writing a completely new plan will be a separate choice. Nothing is charged today.</p>';
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
    return '<article class="prg-doc" aria-labelledby="prgTitle">' +
      '<header class="mpl-head prg-head">' +
        '<p class="mpl-eyebrow">Progress' + (h.label ? ' · ' + esc(h.label) : '') + '</p>' +
        '<h1 id="prgTitle">Your next steps</h1>' +
        '<p class="prg-count" aria-live="polite"><b class="prg-done-n">' + d.completed + '</b> of ' + d.total + ' steps done</p>' +
        '<div class="prg-bar" role="progressbar" aria-label="Steps done" aria-valuemin="0" aria-valuemax="' + d.total + '" aria-valuenow="' + d.completed + '"><i style="width:' + pct + '%"></i></div>' +
      '</header>' +
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
    '</article>';
  }
  function stepHtml(x) {
    var a = AREA[x.area];
    return '<li class="prg-step' + (x.done ? ' is-done' : '') + '" data-step="' + esc(x.id) + '">' +
      '<button type="button" class="prg-check" role="checkbox" aria-checked="' + (x.done ? 'true' : 'false') + '" data-prg-toggle="' + esc(x.id) + '" aria-label="' + esc((x.done ? 'Done: ' : 'Mark as done: ') + x.step) + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<div class="prg-step__b"><p>' + esc(x.step) + '</p><span class="prg-area">' + esc(AREA_LABEL[x.area] || 'In your business') + (x.done && x.doneAt ? ' · done ' + esc(day(x.doneAt)) : '') + '</span></div>' +
      (a && !x.done ? '<button type="button" class="prg-go" data-mpl-go="' + a[0] + '">' + esc(a[1]) + '</button>' : '') + '</li>';
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
    if (b.hasAttribute('data-mpl-go')) { var to = b.getAttribute('data-mpl-go'); if (to === 'plan' || to === 'progress') open(to); else if (window.orvAppNav) window.orvAppNav.go(to); return; }
    if (b.hasAttribute('data-mpl-retry')) { retryPlan(b); return; }
    if (b.hasAttribute('data-mpl-recover')) { loadRecovery(b); return; }
    if (b.hasAttribute('data-mpl-edit')) { var li = b.closest('li'), ed = li && li.querySelector('.mpl-known__edit'); if (ed) { ed.hidden = false; b.hidden = true; var fi = ed.querySelector('input, textarea'); if (fi) fi.focus(); } return; }
    if (b.hasAttribute('data-mpl-reload')) { loadPlan(true); return; }
    if (b.hasAttribute('data-prg-reload')) { loadProgress(); return; }
    if (b.hasAttribute('data-mpl-update')) { var u = document.getElementById('mplUpdate'); u.hidden = !u.hidden; b.setAttribute('aria-expanded', String(!u.hidden)); return; }
    if (b.hasAttribute('data-mpl-jump')) {
      e.preventDefault();
      var t = document.getElementById('mpl-' + b.getAttribute('data-mpl-jump'));
      if (t) { t.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.orvPlanPages = { open: open, reload: function () { S.plan = null; if (isOpen('plan')) loadPlan(true); if (isOpen('progress')) loadProgress(); } };
})();
