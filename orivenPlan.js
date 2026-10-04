/* ════════════════════════════════════════════════════════════════
   OrivenAI — Planning (part of Control Center)

   Advertising planning on top of what OrivenAI knows about the business:
   what to advertise next, when, on which platforms, with what budget and
   for which objective and audience. Plans, briefs, the monthly budget plan
   and naming/UTM templates are the user's own data, stored in
   profiles.preferences "planning" via orvWorkspace.ops.store.

   Planning hands off to the mature workflow — a plan becomes a brief, the
   brief (or plan) prefills Create, and the campaign is launched in Launch
   and managed in Campaigns. Nothing is published or generated from here,
   and no AI call happens on page open.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var OW = window.orvWorkspace = window.orvWorkspace || {};
  var OPS = OW.ops;
  if (!OPS) return;
  var esc = OPS.esc, jsq = OPS.jsq, isNum = OPS.isNum, F = OPS.fmt, CAP = OPS.CAP, UI = OPS.ui, S = OPS.store;
  function toast(m, k) { if (window.orvToast) window.orvToast(m, k || 'info'); }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function head(title, sub, controls) {
    return '<header class="op-head"><div class="op-head-text"><h1 class="op-h1">' + esc(title) + '</h1>' + (sub ? '<p class="op-sub">' + esc(sub) + '</p>' : '') + '</div>' + (controls ? '<div class="op-head-ctl">' + controls + '</div>' : '') + '</header>';
  }
  function field(id, label, value, opts) {
    opts = opts || {};
    var v = value == null ? '' : value;
    var inp = opts.type === 'textarea' ? '<textarea id="' + id + '" class="op-input" rows="' + (opts.rows || 3) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' + esc(v) + '</textarea>'
      : opts.options ? '<select id="' + id + '" class="op-select">' + opts.options.map(function (o) { var ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(ov) + '"' + (String(ov) === String(v) ? ' selected' : '') + '>' + esc(ol) + '</option>'; }).join('') + '</select>'
      : '<input id="' + id + '" class="op-input" type="' + (opts.type || 'text') + '"' + (opts.step ? ' step="' + opts.step + '"' : '') + (opts.min != null ? ' min="' + opts.min + '"' : '') + ' value="' + esc(v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.required ? ' required aria-required="true"' : '') + '>';
    return '<div class="op-field' + (opts.wide ? ' op-field-wide' : '') + '"><label for="' + id + '">' + esc(label) + (opts.required ? ' <span aria-hidden="true">*</span>' : '') + '</label>' + inp + (opts.hint ? '<p class="op-hint">' + esc(opts.hint) + '</p>' : '') + '</div>';
  }
  function val(root, id) { var e = root.querySelector('#' + id); return e ? String(e.value || '').trim() : ''; }
  function platformLabel(p) { return CAP[p] ? CAP[p].short : p === 'multi' ? 'Several platforms' : (p || '—'); }
  var PLAT_OPTS = [['', 'Choose…'], ['meta', 'Meta'], ['google', 'Google'], ['tiktok', 'TikTok'], ['pinterest', 'Pinterest'], ['multi', 'Several platforms']];
  var OBJ_OPTS = [['', 'Choose…'], ['sales', 'Sales'], ['leads', 'Leads'], ['traffic', 'Traffic'], ['awareness', 'Awareness'], ['engagement', 'Engagement'], ['app', 'App installs']];
  var STATUS_OPTS = [['idea', 'Idea'], ['planned', 'Planned'], ['ready', 'Ready'], ['progress', 'In progress'], ['done', 'Completed']];

  // Prefill the AI campaign builder (Create) without starting it.
  function toCreate(prompt) {
    _orvNav('create', 'page-create');
    setTimeout(function () {
      var i = document.getElementById('aicInput');
      if (!i) return;
      i.value = prompt;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.focus();
      toast('Added to Create. Review it, then press Build — nothing is generated until you do.', 'ok');
    }, 60);
  }
  OPS.toCreate = toCreate;

  // ════════════════════════════════════════════════════════════════
  // PLANNING — what we advertise next, when, where and with what budget.
  // Lives in Control Center (#bizPanelPlanning); a summary strip sits on the
  // Control Center overview.
  //   Plan → brief → Create (the mature builder) → Launch → Campaigns.
  // Planning owns the intention; Campaigns owns the real campaign. A plan
  // can point at one of the user's own campaign records, nothing more.
  // OrivenAI does not publish on a schedule: the planned start is a date
  // to work towards, and launching stays a deliberate step in Launch.
  // ════════════════════════════════════════════════════════════════
  var PL = OPS.planning = {};
  function plan() {
    var p = S.get('planning');
    (p.plans || []).forEach(normalizePlan);
    return p;
  }
  // Older plan records (single platform, longer status list) read as the
  // current shape without rewriting them until the user saves.
  var OLD_STATUS = { briefed: 'ready', building: 'progress', live: 'progress', completed: 'done' };
  function normalizePlan(r) {
    if (OLD_STATUS[r.status]) r.status = OLD_STATUS[r.status];
    if (!STATUS_LABEL[r.status]) r.status = 'idea';
    if (!Array.isArray(r.platforms)) r.platforms = r.platform && CAP[r.platform] ? [r.platform] : [];
    return r;
  }
  var STATUS_LABEL = {}; STATUS_OPTS.forEach(function (s) { STATUS_LABEL[s[0]] = s[1]; });
  PL.statusLabel = function (s) { return STATUS_LABEL[OLD_STATUS[s] || s] || 'Idea'; };
  function platformsOf(r) { normalizePlan(r); return r.platforms.filter(function (p) { return CAP[p]; }); }
  PL.platformsText = function (r) { var ps = platformsOf(r); return ps.map(function (p) { return CAP[p].short; }).join(', '); };
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { return ymd(new Date()); }
  function daysUntil(s) { return Math.round((new Date(s + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000); }
  function briefFor(id) { var i = -1; (plan().briefs || []).forEach(function (b, j) { if (b.planId === id) i = j; }); return i; }

  // The user's own campaign records a plan can point at.
  function myCampaigns() {
    var C = OW.campaigns; if (!C || !C.local) return [];
    return C.local().filter(function (c) { return c && c.status !== 'archived'; });
  }
  function linked(r) {
    if (!r.campaignRef) return null;
    var c = myCampaigns().filter(function (x) { return x.id === r.campaignRef; })[0];
    if (!c) return { missing: true };
    var st = OW.campaigns.stage(c);
    return { c: c, st: st, launched: ['live', 'deployed', 'paused'].indexOf(st.key) !== -1 };
  }
  PL.openCampaign = function (id) {
    var r = (plan().plans || []).filter(function (x) { return x.id === id; })[0], l = r && linked(r);
    if (!l || l.missing || !OW.go) return;
    if (l.launched) OW.go({ page: 'campaigns', platform: l.c.platform, campaignName: l.c.name });
    else OW.go({ page: 'launch', platform: l.c.platform, campaignId: l.c.id });
  };

  function sortRows(rows) { return rows.slice().sort(function (a, b) { return String(a.start || '9').localeCompare(String(b.start || '9')); }); }
  function current() { return sortRows((plan().plans || []).filter(function (r) { return r.status !== 'done'; })); }

  // ── The Planning panel (Control Center → Planning) ─────────────────────
  var planTok = 0;
  function renderPlanning() {
    var el = document.getElementById('bizPlanningBody'); if (!el) return;
    var t = ++planTok;
    el.innerHTML = '<div class="pl-tools"><button type="button" class="op-btn op-btn-primary" onclick="orvWorkspace.ops.planning.editPlan()">Plan advertising</button>' +
        '<button type="button" class="op-btn op-btn-ghost" onclick="orvWorkspace.ops.planning.editBrief()">New brief</button>' +
        '<button type="button" class="op-btn op-btn-text" onclick="orvWorkspace.ops.planning.namingTool()">Naming &amp; UTM</button></div>' +
      '<div class="pl-grid">' +
        '<section class="pl-b pl-plans" aria-labelledby="plPlansH"><div class="pl-bh"><h3 id="plPlansH">Upcoming</h3><span class="op-meta">' + esc(countText()) + '</span></div>' + planBlock() + '</section>' +
        '<section class="pl-b pl-budget" aria-labelledby="bcBudH" id="opPlanBudget">' + budgetSection(null) + '</section>' +
        '<section class="pl-b pl-briefs" aria-labelledby="bcBriefH">' + briefList() + '</section>' +
        '<section class="pl-b pl-res" aria-labelledby="plResH"><div class="pl-bh"><h3 id="plResH">Latest research</h3><button type="button" class="op-link" onclick="orvWorkspace.ops.go(\'research\')">Open Research</button></div>' + researchBlock() + '</section>' +
      '</div>';
    if (plan().budget) OPS.data.load({ key: 'THIS_MONTH' }).then(function (m) { if (t !== planTok) return; var b = document.getElementById('opPlanBudget'); if (b) b.innerHTML = budgetSection(m); })
      .catch(function () { if (t !== planTok) return; var b = document.getElementById('opPlanBudget'); if (b) b.innerHTML = budgetSection('error'); });
  }
  PL.render = renderPlanning;
  function countText() {
    var rows = plan().plans || [], open = rows.filter(function (r) { return r.status !== 'done'; }).length;
    return rows.length ? open + ' open' + (rows.length > open ? ' · ' + (rows.length - open) + ' completed' : '') : '';
  }
  function isOpen() { var p = document.getElementById('bizPanelPlanning'); return !!(p && p.style.display !== 'none' && p.offsetParent !== null); }
  function rerenderIfOpen() { if (isOpen()) renderPlanning(); paintStrip(); }

  function researchBlock() {
    var r = OW.researchSession ? OW.researchSession() : null;
    if (!r || !r.result) return '<p class="op-meta">No research yet. Research a market, competitors or an audience before you plan — then use what you find in a brief.</p>';
    var res = r.result, opp = (res.opportunities || []).slice(0, 2).map(function (o) { return o.opportunity; }).filter(Boolean);
    return '<p class="pl-res-q">“' + esc(res.question) + '”</p><p class="op-meta">' + esc(r.savedAt ? rel(r.savedAt) : '') + '</p>' +
      (opp.length ? '<ul class="pl-list">' + opp.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' : '');
  }
  function rel(iso) { return OW.relTime ? OW.relTime(iso) : (iso || ''); }

  // Calendar (six weeks from this Monday) + the open plans, then completed.
  function planBlock() {
    var rows = current(), done = sortRows((plan().plans || []).filter(function (r) { return r.status === 'done'; }));
    if (!rows.length && !done.length) return '<div class="pl-empty"><p>Plan what you want to advertise next: the product or offer, objective, platforms, dates and budget. A plan becomes a brief, then advertising in Create.</p><button type="button" class="op-btn op-btn-primary" onclick="orvWorkspace.ops.planning.editPlan()">Plan the first one</button></div>';
    return calendar(rows) + (rows.length ? '<ul class="pl-plan-list">' + rows.map(planRow).join('') + '</ul>' : '<p class="op-meta">Nothing open. Everything planned is completed.</p>') +
      (done.length ? '<details class="pl-done"><summary>Completed (' + done.length + ')</summary><ul class="pl-plan-list">' + done.map(planRow).join('') + '</ul></details>' : '');
  }
  function planRow(r) {
    var ps = platformsOf(r), l = linked(r), bi = briefFor(r.id);
    var when = r.start ? shortDate(r.start) + (r.end && r.end !== r.start ? ' – ' + shortDate(r.end) : '') : 'No date';
    var soon = r.start && r.status !== 'done' ? daysUntil(r.start) : null;
    var meta = [r.product || r.offer, r.objective && objLabel(r.objective), isNum(+r.budget) && r.budget !== '' && r.budget != null ? F.money(+r.budget, r.currency || null) + ' planned' : ''].filter(Boolean).join(' · ');
    var camp = l ? (l.missing ? '<span class="op-chip op-chip-muted">Linked campaign removed</span>'
      : '<button type="button" class="pl-camp" onclick="orvWorkspace.ops.planning.openCampaign(\'' + jsq(r.id) + '\')">' + UI.platBadge(CAP[l.c.platform] ? l.c.platform : 'meta') + '<span>' + esc(l.c.name || 'Campaign') + '</span><em>' + esc(l.st.label || l.st.key) + '</em></button>') : '';
    var startNote = soon !== null && soon >= 0 && soon <= 7 && !(l && l.launched) ? '<span class="pl-soon">' + (soon === 0 ? 'Starts today' : 'Starts in ' + soon + ' day' + (soon === 1 ? '' : 's')) + ' · launch it yourself from Launch</span>' : '';
    return '<li class="pl-plan-i' + (r.status === 'done' ? ' is-done' : '') + '">' +
      '<span class="pl-when">' + esc(when) + '</span>' +
      '<button type="button" class="pl-name" onclick="orvWorkspace.ops.planning.editPlan(\'' + jsq(r.id) + '\')"><b>' + esc(r.campaign || 'Untitled') + '</b>' +
        '<span class="pl-plats">' + (ps.length ? ps.map(function (p) { return UI.platBadge(p); }).join('') : '<span class="op-meta">No platform yet</span>') + '</span>' +
        (meta ? '<span class="op-meta">' + esc(meta) + '</span>' : '') + '</button>' +
      '<span class="pl-state"><span class="op-chip pl-st-' + esc(r.status) + '">' + esc(PL.statusLabel(r.status)) + '</span>' + camp + startNote + '</span>' +
      '<span class="pl-acts">' + (r.status === 'done' ? '' :
        '<button type="button" class="op-btn op-btn-ghost op-btn-sm" onclick="orvWorkspace.ops.planning.' + (bi >= 0 ? 'editBrief(' + bi + ')' : 'planToBrief(\'' + jsq(r.id) + '\')') + '">' + (bi >= 0 ? 'Brief' : 'Write brief') + '</button>' +
        '<button type="button" class="op-btn op-btn-ghost op-btn-sm" onclick="orvWorkspace.ops.planning.planToCreate(\'' + jsq(r.id) + '\')">Create advertising</button>') + '</span></li>';
  }
  function objLabel(o) { var m = OBJ_OPTS.filter(function (x) { return x[0] === o; })[0]; return m ? m[1] : o; }
  PL.objLabel = objLabel;
  function shortDate(s) { var d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
  function calendar(rows) {
    var start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
    var days = 42, end = new Date(start); end.setDate(end.getDate() + days - 1);
    var S0 = ymd(start), E0 = ymd(end), todayIdx = Math.round((new Date().setHours(0, 0, 0, 0) - start) / 86400000);
    var inView = rows.filter(function (r) { return r.start && r.start <= E0 && (r.end || r.start) >= S0; }).slice(0, 6);
    var weeks = ''; for (var w = 0; w < 6; w++) { var d = new Date(start); d.setDate(d.getDate() + w * 7); weeks += '<span>' + esc(d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) + '</span>'; }
    var idx = function (s) { return Math.max(0, Math.min(days - 1, Math.round((new Date(s + 'T00:00:00') - start) / 86400000))); };
    return '<div class="pl-cal" role="img" aria-label="Planned advertising over the next six weeks: ' + esc(inView.map(function (r) { return r.campaign + ' ' + shortDate(r.start) + (r.end ? ' to ' + shortDate(r.end) : ''); }).join('; ') || 'nothing scheduled') + '">' +
      '<div class="pl-cal-w">' + weeks + '</div><div class="pl-cal-g" style="--today:' + todayIdx + '">' +
      (inView.length ? inView.map(function (r) {
        var a = idx(r.start), b = idx(r.end || r.start), ps = platformsOf(r);
        return '<span class="pl-cal-bar ov-pl-' + (ps.length === 1 ? ps[0] : 'none') + '" style="--a:' + (a + 1) + ';--b:' + (b + 2) + '" title="' + esc(r.campaign) + '">' + esc(r.campaign) + '</span>';
      }).join('') : '<span class="pl-cal-none">Nothing dated in the next six weeks</span>') + '</div></div>';
  }

  // ── Plan dialog ────────────────────────────────────────────────────
  function platformChecks(sel) {
    return '<fieldset class="op-field op-field-wide pl-pf"><legend>Platforms</legend><div class="pl-pf-row">' + OPS.PLATFORMS.map(function (p) {
      return '<label class="pl-pf-o ov-pl-' + p + '"><input type="checkbox" name="mpPlat" value="' + p + '"' + (sel.indexOf(p) !== -1 ? ' checked' : '') + '><span>' + esc(CAP[p].name) + '</span></label>';
    }).join('') + '</div></fieldset>';
  }
  function campaignOptions(cur) {
    var list = myCampaigns();
    return [['', list.length ? 'Not linked yet' : 'No campaigns yet']].concat(list.slice(0, 80).map(function (c) {
      var st = OW.campaigns.stage(c);
      return [c.id, (c.name || 'Untitled campaign') + ' · ' + (CAP[c.platform] ? CAP[c.platform].short : c.platform || '') + ' · ' + (st.label || st.key)];
    })).concat(cur && !list.some(function (c) { return c.id === cur; }) ? [[cur, 'Linked campaign (removed)']] : []);
  }
  PL.editPlan = function (id) {
    var p = plan(), r = id ? (p.plans || []).filter(function (x) { return x.id === id; })[0] : null;
    r = r ? normalizePlan(r) : { status: 'idea', platforms: [] };
    var d = OW.flow.dialog({ title: id ? 'Edit plan' : 'Plan advertising', eyebrow: 'Control Center · Planning', wide: true,
      body: '<form class="op-form" novalidate>' + field('mpCampaign', 'Name', r.campaign, { required: true, wide: true, ph: 'e.g. Spring sale — new customers' }) +
        field('mpProduct', 'Product or offer', r.product || r.offer, { ph: 'What you’ll advertise' }) + field('mpObjective', 'Objective', r.objective, { options: OBJ_OPTS }) +
        platformChecks(r.platforms || []) +
        field('mpStart', 'Start', r.start, { type: 'date' }) + field('mpEnd', 'End', r.end, { type: 'date' }) +
        field('mpBudget', 'Planned budget', r.budget, { type: 'number', step: '0.01', min: 0, hint: 'A plan, not a platform budget — the real budget is set when the campaign is built.' }) +
        field('mpCurrency', 'Currency', r.currency || (p.budget && p.budget.currency) || '', { ph: 'EUR' }) +
        field('mpAudience', 'Audience', r.audience, { wide: true }) +
        field('mpStatus', 'Status', r.status, { options: STATUS_OPTS }) +
        field('mpCampaignRef', 'Campaign', r.campaignRef || '', { options: campaignOptions(r.campaignRef), hint: 'Link the campaign once you’ve built it.' }) +
        '<details class="op-field-wide op-more"' + (r.creative || r.notes ? ' open' : '') + '><summary>Creative requirements and notes</summary><div class="op-form">' +
        field('mpCreative', 'Creative requirements', r.creative, { type: 'textarea', wide: true, ph: 'Formats, sizes, number of variations, must-haves' }) +
        field('mpNotes', 'Notes', r.notes, { type: 'textarea', wide: true }) + '</div></details>' +
        '<p class="op-hint op-field-wide">OrivenAI doesn’t publish on a schedule. The start date is your plan — launch the campaign from Launch when it’s ready.</p>' +
        '<p class="op-err op-field-wide" role="alert" hidden></p></form>',
      actions: (id ? [{ label: 'Delete', kind: 'ghost', onClick: function (a) { a.close(false); PL.deletePlan(id); } }] : []).concat([
        { label: 'Cancel', kind: 'ghost', onClick: function (a) { a.close(false); } },
        { label: 'Save plan', kind: 'primary', onClick: function (a) {
          var root = a.el, name = val(root, 'mpCampaign'), err = root.querySelector('.op-err');
          if (!name) { err.textContent = 'Give the plan a name.'; err.hidden = false; root.querySelector('#mpCampaign').focus(); return; }
          var s = val(root, 'mpStart'), e = val(root, 'mpEnd'), b = val(root, 'mpBudget');
          if (s && e && e < s) { err.textContent = 'The end date is before the start date.'; err.hidden = false; root.querySelector('#mpEnd').focus(); return; }
          if (b !== '' && !(isNum(parseFloat(b)) && parseFloat(b) >= 0)) { err.textContent = 'The planned budget must be a number of 0 or more.'; err.hidden = false; root.querySelector('#mpBudget').focus(); return; }
          var plats = [].slice.call(root.querySelectorAll('input[name="mpPlat"]:checked')).map(function (x) { return x.value; });
          var item = Object.assign(r, { id: r.id || uid('mp'), campaign: name, product: val(root, 'mpProduct'), objective: val(root, 'mpObjective'),
            platforms: plats, platform: plats.length === 1 ? plats[0] : plats.length ? 'multi' : '', start: s, end: e, budget: b, currency: val(root, 'mpCurrency').toUpperCase(),
            audience: val(root, 'mpAudience'), status: val(root, 'mpStatus') || 'idea', campaignRef: val(root, 'mpCampaignRef') || null,
            creative: val(root, 'mpCreative'), notes: val(root, 'mpNotes'), updated: new Date().toISOString() });
          delete item.offer;
          p.plans = (p.plans || []).filter(function (x) { return x.id !== item.id; }).concat([item]);
          S.save('planning'); a.close(true); rerenderIfOpen(); toast('Plan saved.', 'ok');
        } }]) });
    d.el.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); });
  };
  PL.deletePlan = function (id) {
    OW.flow.confirm({ title: 'Delete this plan?', body: '<p>Only the plan is deleted. Briefs and campaigns made from it stay.</p>', confirmLabel: 'Delete', danger: true }).then(function (ok) {
      if (!ok) return; var p = plan(); p.plans = (p.plans || []).filter(function (x) { return x.id !== id; }); S.save('planning'); rerenderIfOpen();
    });
  };
  PL.planToBrief = function (id) {
    var r = (plan().plans || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var ps = platformsOf(r);
    PL.editBrief(null, { title: r.campaign, objective: r.objective, platforms: ps.length === 1 ? ps[0] : ps.length ? 'multi' : '', audience: r.audience, product: r.product, formats: r.creative, planId: r.id });
  };
  // Into the mature Create: the brief if there is one, else the plan itself.
  function planText(r) {
    var ps = platformsOf(r);
    var L = [['Product or offer', r.product], ['Objective', r.objective && objLabel(r.objective)], ['Platforms', ps.map(function (p) { return CAP[p].name; }).join(', ')],
      ['Audience', r.audience], ['Dates', r.start ? shortDate(r.start) + (r.end ? ' – ' + shortDate(r.end) : '') : ''], ['Creative requirements', r.creative]];
    return r.campaign + '\n' + L.filter(function (x) { return x[1]; }).map(function (x) { return x[0] + ': ' + x[1]; }).join('\n');
  }
  PL.planToCreate = function (id) {
    var r = (plan().plans || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var i = briefFor(id);
    toCreate(i >= 0 ? briefText(plan().briefs[i]) : planText(r));
  };

  // ── Summary strip on the Control Center overview ────────────────────────
  function paintStrip() {
    var el = document.getElementById('bicPlanStrip'); if (!el) return;
    if (!(typeof window._getCurrentUser === 'function' && window._getCurrentUser())) { el.innerHTML = ''; return; }
    var rows = current().slice(0, 3);
    el.innerHTML = '<div class="bps-hd"><span class="bps-t">Advertising plan</span><button type="button" class="bps-open" onclick="bizGoTo(\'planning\')">' + (rows.length ? 'Open planning' : 'Plan advertising') + ' <span aria-hidden="true">→</span></button></div>' +
      (rows.length ? '<ul class="bps-list">' + rows.map(function (r) {
        return '<li><button type="button" onclick="bizGoTo(\'planning\')"><span class="bps-d">' + esc(r.start ? shortDate(r.start) : 'No date') + '</span><span class="bps-n">' + esc(r.campaign) + '</span><span class="bps-m">' + esc([PL.platformsText(r), PL.statusLabel(r.status)].filter(Boolean).join(' · ')) + '</span></button></li>';
      }).join('') + '</ul>' : '<p class="bps-empty">Plan what you’ll advertise next: when, where and with what budget.</p>');
  }
  PL.paintStrip = paintStrip;

  // ── Budget plan: planned · spent · remaining · pacing (this month)
  function budgetSection(m) {
    var b = plan().budget;
    var html = '<div class="pl-bh"><h3 id="bcBudH">Budget plan</h3>' + (b ? '<button type="button" class="op-link" onclick="orvWorkspace.ops.planning.editBudget()">Edit</button>' : '') + '</div>';
    if (!b) return html + upcomingLine() + '<div class="pl-empty"><p>Set a monthly budget per platform to see planned against actual spend, what’s left and pacing.</p><button type="button" class="op-btn op-btn-ghost" onclick="orvWorkspace.ops.planning.editBudget()">Set a budget plan</button></div>';
    var now = new Date(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), day = now.getDate(), frac = day / dim;
    var curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var alloc = b.alloc || {}, cur = b.currency || null;
    var allocated = OPS.PLATFORMS.reduce(function (s, p) { var v = +alloc[p]; return s + (isNum(v) ? v : 0); }, 0);
    var tol = S.get('ops').thresholds.pacingTolerancePct;
    var head2 = '<p class="op-meta">' + (b.month && b.month !== curMonth ? 'This plan is for ' + esc(b.month) + ' — update it for this month. ' : '') + 'Planned ' + esc(F.money(isNum(+b.total) && b.total !== null ? +b.total : allocated, cur)) + ' · allocated ' + esc(F.money(allocated, cur)) + ' · day ' + day + ' of ' + dim + '</p>';
    var rows = OPS.PLATFORMS.filter(function (p) { return isNum(+alloc[p]) && +alloc[p] > 0 || (m && m !== 'error' && m.platforms[p] && m.platforms[p].connected); }).map(function (p) {
      var planned = isNum(+alloc[p]) && +alloc[p] > 0 ? +alloc[p] : null;
      var X = m && m !== 'error' ? m.platforms[p] : null;
      var spent = X && X.totals ? X.totals.spend : null, mism = X && X.currency && cur && X.currency !== cur;
      var pace = planned && isNum(spent) && !mism ? F.change(spent, planned * frac) : null;
      var left = planned && isNum(spent) && !mism ? planned - spent : null;
      var paceTxt = mism ? '<span class="op-muted">Plan in ' + esc(cur) + ', account in ' + esc(X.currency) + '</span>' : !isNum(pace) ? '<span class="op-muted">—</span>'
        : '<span class="op-chip op-chip-' + (Math.abs(pace) < tol ? 'ready' : pace > 0 ? 'risk' : 'attention') + '">' + (Math.abs(pace) < tol ? 'On pace' : pace > 0 ? 'Ahead ' + F.changeTxt(pace) : 'Behind ' + F.changeTxt(pace)) + '</span>';
      return '<tr><th scope="row">' + UI.platBadge(p) + '</th><td>' + esc(F.money(planned, cur)) + '</td><td>' + (m === null ? '<span class="op-muted">Loading…</span>' : m === 'error' || (X && X.error) ? '<span class="op-warn-t">Unavailable</span>' : !X || !X.connected ? '<span class="op-muted">Not connected</span>' : esc(F.money(spent, X.currency))) + '</td>' +
        '<td>' + (isNum(left) ? esc(F.money(left, cur)) : '<span class="op-muted">—</span>') + '</td><td>' + paceTxt + '</td></tr>';
    });
    return html + head2 + (rows.length ? '<table class="op-table op-table-tight pl-bud"><thead><tr><th scope="col">Platform</th><th scope="col">Planned</th><th scope="col">Spent</th><th scope="col">Remaining</th><th scope="col">Pacing</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' : '') +
      upcomingLine() +
      '<p class="op-foot">Spent is platform-reported, month to date; pacing compares it with an even daily spend of the plan (±' + tol + '%). Currencies are never added together.</p>';
  }
  // What the open plans add up to, per currency (never mixed).
  function upcomingLine() {
    var by = {};
    current().forEach(function (r) { var v = parseFloat(r.budget); if (isNum(v) && v > 0) { var c = r.currency || '—'; by[c] = (by[c] || 0) + v; } });
    var keys = Object.keys(by);
    return keys.length ? '<p class="op-meta pl-upc">Open plans: ' + keys.map(function (c) { return esc(F.money(by[c], c === '—' ? null : c)); }).join(' · ') + ' planned</p>' : '';
  }
  PL.editBudget = function () {
    var b = plan().budget || {};
    var now = new Date(), month = b.month || (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
    var alloc = b.alloc || {};
    OW.flow.dialog({ title: 'Monthly budget plan', eyebrow: 'Control Center · Planning', wide: true,
      body: '<form class="op-form" novalidate>' + field('bpMonth', 'Month', month, { type: 'month' }) + field('bpCurrency', 'Currency', b.currency || '', { ph: 'EUR', hint: 'Use your ad accounts’ currency so pacing can be compared.' }) +
        field('bpTotal', 'Total for the month', b.total != null ? b.total : '', { type: 'number', step: '0.01', min: 0 }) + '<span></span>' +
        OPS.PLATFORMS.map(function (p) { return field('bpA_' + p, CAP[p].name, alloc[p] != null ? alloc[p] : '', { type: 'number', step: '0.01', min: 0 }); }).join('') + '<p class="op-err op-field-wide" role="alert" hidden></p></form>',
      actions: [{ label: 'Cancel', kind: 'ghost', onClick: function (a) { a.close(false); } }, { label: 'Save budget plan', kind: 'primary', onClick: function (a) {
        var form = a.el.querySelector('form'), g = function (id) { return form.querySelector('#' + id).value; }, err = a.el.querySelector('.op-err');
        var nalloc = {}, bad = false;
        OPS.PLATFORMS.forEach(function (p) { var v = g('bpA_' + p); if (v !== '') { v = parseFloat(v); if (!isNum(v) || v < 0) bad = true; else nalloc[p] = v; } });
        var total = g('bpTotal') === '' ? null : parseFloat(g('bpTotal'));
        if (bad || (total != null && (!isNum(total) || total < 0))) { err.textContent = 'Budgets must be numbers of 0 or more.'; err.hidden = false; return; }
        plan().budget = { month: g('bpMonth'), currency: g('bpCurrency').trim().toUpperCase(), total: total, alloc: nalloc, updated: new Date().toISOString() };
        S.save('planning'); a.close(true); rerenderIfOpen(); toast('Budget plan saved.', 'ok');
      } }] });
  };

  // ── Briefs ─────────────────────────────────────────────────────────
  function briefList() {
    var list = plan().briefs || [];
    var html = '<div class="pl-bh"><h3 id="bcBriefH">Briefs' + (list.length ? ' <span class="op-count">' + list.length + '</span>' : '') + '</h3><button type="button" class="op-link" onclick="orvWorkspace.ops.planning.editBrief()">New</button></div>';
    if (!list.length) return html + '<div class="pl-empty"><p>A brief holds the objective, audience, offer and message. Write it once, then create the advertising from it.</p><button type="button" class="op-btn op-btn-ghost" onclick="orvWorkspace.ops.planning.editBrief()">Write a brief</button></div>';
    return html + '<div class="pl-briefs-l">' + list.map(function (b, i) {
      return '<article class="op-card"><h3>' + esc(b.title) + '</h3><p class="op-meta">' + esc([b.objective && objLabel(b.objective), b.platforms && platformLabel(b.platforms), b.updated ? 'Updated ' + (OW.relTime ? OW.relTime(b.updated) : '') : ''].filter(Boolean).join(' · ')) + '</p>' +
        (b.message ? '<p>' + esc(b.message) + '</p>' : b.offer ? '<p>' + esc(b.offer) + '</p>' : '') +
        '<div class="op-row"><button type="button" class="op-btn op-btn-ghost op-btn-sm" onclick="orvWorkspace.ops.planning.editBrief(' + i + ')">Open</button><button type="button" class="op-btn op-btn-ghost op-btn-sm" onclick="orvWorkspace.ops.planning.briefToCreate(' + i + ')">Create advertising</button></div></article>';
    }).join('') + '</div>';
  }
  var BRIEF_FIELDS = [
    ['title', 'Title', { required: true }], ['objective', 'Objective', { options: OBJ_OPTS }], ['platforms', 'Platform', { options: PLAT_OPTS }],
    ['audience', 'Audience', { type: 'textarea', rows: 2, wide: true }], ['offer', 'Offer', {}], ['product', 'Product', {}],
    ['message', 'Key message', { type: 'textarea', rows: 2, wide: true }], ['proof', 'Proof points', { type: 'textarea', rows: 2, wide: true, ph: 'Reviews, numbers, guarantees' }],
    ['tone', 'Tone', { ph: 'e.g. confident, warm' }], ['cta', 'Call to action', { ph: 'e.g. Shop the sale' }], ['kpi', 'KPI', {}],
    ['formats', 'Formats & creative requirements', { type: 'textarea', rows: 2, wide: true }], ['notes', 'Notes', { type: 'textarea', rows: 2, wide: true }]
  ];
  function briefText(b) {
    var L = { objective: 'Objective', platforms: 'Platform', audience: 'Audience', offer: 'Offer', product: 'Product', message: 'Key message', proof: 'Proof points', tone: 'Tone', cta: 'Call to action', kpi: 'KPI', formats: 'Formats', notes: 'Notes' };
    return b.title + '\n' + Object.keys(L).filter(function (k) { return b[k]; }).map(function (k) { return L[k] + ': ' + (k === 'platforms' ? platformLabel(b[k]) : b[k]); }).join('\n');
  }
  OPS.briefText = briefText;
  PL.editBrief = function (i, seed) {
    var p = plan(), b = i != null && p.briefs[i] ? p.briefs[i] : Object.assign({}, seed || {});
    var d = OW.flow.dialog({ title: i != null ? 'Brief' : 'New brief', eyebrow: 'Control Center · Planning', wide: true,
      body: '<form class="op-form" novalidate>' + BRIEF_FIELDS.map(function (f) { return field('br_' + f[0], f[1], b[f[0]], f[2]); }).join('') +
        '<div class="op-row op-field-wide"><button type="button" class="op-btn op-btn-text" data-act="biz">Fill from business details</button><button type="button" class="op-btn op-btn-text" data-act="ai">Ask AI to improve</button></div>' +
        '<p class="op-err op-field-wide" role="alert" hidden></p></form>',
      actions: (i != null ? [{ label: 'Delete', kind: 'ghost', onClick: function (a) { a.close(false); PL.deleteBrief(i); } }] : []).concat([
        { label: 'Cancel', kind: 'ghost', onClick: function (a) { a.close(false); } },
        { label: 'Save brief', kind: 'primary', onClick: function (a) { if (collect(a.el)) { a.close(true); rerenderIfOpen(); toast('Brief saved.', 'ok'); } } }]) });
    function collect(root) {
      var nb = {}; BRIEF_FIELDS.forEach(function (f) { nb[f[0]] = val(root, 'br_' + f[0]); });
      var err = root.querySelector('.op-err');
      if (!nb.title) { err.textContent = 'Give the brief a title.'; err.hidden = false; root.querySelector('#br_title').focus(); return null; }
      nb.planId = b.planId || null; nb.id = b.id || uid('br'); nb.updated = new Date().toISOString();
      if (i != null) p.briefs[i] = nb; else { p.briefs = (p.briefs || []).concat([nb]); i = p.briefs.length - 1; }
      // A written brief makes an idea/planned item ready to create.
      if (nb.planId) (p.plans || []).forEach(function (x) { normalizePlan(x); if (x.id === nb.planId && (x.status === 'idea' || x.status === 'planned')) x.status = 'ready'; });
      S.save('planning');
      return nb;
    }
    d.el.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); });
    d.el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]'); if (!t) return;
      if (t.getAttribute('data-act') === 'biz') fillFromBusiness(d.el, t);
      else { var nb = collect(d.el); if (!nb) return; d.close(true); OPS.ai.ask('Improve this campaign brief: make the audience, message and proof points sharper and more specific. Keep it short.\n\n' + briefText(nb), { area: 'Control Center · Planning' }); }
    });
  };
  function fillFromBusiness(root, btn) {
    btn.disabled = true; btn.textContent = 'Loading…';
    Promise.all([window.apiFetch('/api/business/profile'), window.apiFetch('/api/business/audiences'), window.apiFetch('/api/business/products')].map(function (p) { return p.catch(function () { return null; }); })).then(function (x) {
      btn.disabled = false; btn.textContent = 'Fill from business details';
      var prof = x[0] && x[0].ok && x[0].data ? x[0].data.profile : null;
      var aud = x[1] && x[1].ok && x[1].data ? x[1].data.items || [] : [];
      var prod = x[2] && x[2].ok && x[2].data ? x[2].data.items || [] : [];
      var set = function (id, v) { var e = root.querySelector('#' + id); if (e && !e.value && v) e.value = v; };
      if (!prof && !aud.length && !prod.length) { toast('No business details saved yet — add them in Control Center.', 'warn'); return; }
      if (aud[0]) set('br_audience', [aud[0].name, aud[0].description].filter(Boolean).join(' — '));
      if (prod[0]) set('br_product', prod[0].name);
      if (prof) set('br_message', prof.description || '');
      toast('Filled empty fields from your business details.', 'ok');
    });
  }
  PL.deleteBrief = function (i) {
    OW.flow.confirm({ title: 'Delete this brief?', body: '<p>Creative and campaigns made from it stay.</p>', confirmLabel: 'Delete', danger: true }).then(function (ok) {
      if (!ok) return; var p = plan(); p.briefs.splice(i, 1); S.save('planning'); rerenderIfOpen();
    });
  };
  PL.briefToCreate = function (i) {
    var b = plan().briefs[i]; if (!b) return;
    toCreate(briefText(b));
  };

  // ── Naming & UTM templates ─────────────────────────────────────────
  var DEF_NAMING = { pattern: '{platform}_{objective}_{campaign}_{date}', sep: '_', case: 'lower' };
  var DEF_UTM = { source: { meta: 'facebook', google: 'google', tiktok: 'tiktok', pinterest: 'pinterest' }, medium: 'paid_social', mediumGoogle: 'cpc', campaign: '{campaign}', content: '{ad}', term: '' };
  function naming() { return Object.assign({}, DEF_NAMING, plan().naming || {}); }
  function utm() { var u = plan().utm || {}; return Object.assign({}, DEF_UTM, u, { source: Object.assign({}, DEF_UTM.source, u.source || {}) }); }
  function slug(s, n) {
    s = String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/[^A-Za-z0-9]+/g, n.sep === '-' ? '-' : n.sep === '.' ? '.' : '_').replace(/^[-_.]+|[-_.]+$/g, '');
    return n.case === 'lower' ? s.toLowerCase() : n.case === 'upper' ? s.toUpperCase() : s;
  }
  // Deterministic: same inputs → same name, every time.
  function applyName(n, v) {
    return n.pattern.replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null && v[k] !== '' ? slug(v[k], n) : ''; })
      .replace(/([-_.|])\1+/g, '$1').replace(/^[-_.|]+|[-_.|]+$/g, '');
  }
  function buildUrl(base, u, v, n) {
    var tok = function (t) { return String(t || '').replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? slug(v[k], { sep: '_', case: 'lower' }) : ''; }); };
    var p = v.platform;
    var q = { utm_source: u.source[p] || p, utm_medium: p === 'google' ? u.mediumGoogle : u.medium, utm_campaign: tok(u.campaign), utm_content: tok(u.content), utm_term: tok(u.term) };
    var qs = Object.keys(q).filter(function (k) { return q[k]; }).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');
    if (!base) return '?' + qs;
    return base + (base.indexOf('?') === -1 ? '?' : '&') + qs;
  }
  OPS.naming = { apply: function (v) { return applyName(naming(), v); }, url: function (base, v) { return buildUrl(base, utm(), v, naming()); } };
  function namingForm() {
    var n = naming(), u = utm();
    return '<div class="op-split op-naming"><form class="op-form op-form-1" oninput="orvWorkspace.ops.planning.namingPreview()" onsubmit="event.preventDefault();orvWorkspace.ops.planning.saveNaming()" novalidate>' +
      '<h2 class="op-h2">Campaign naming</h2>' +
      field('nmPattern', 'Pattern', n.pattern, { wide: true, hint: 'Tokens: {platform} {objective} {campaign} {market} {audience} {date} {product}' }) +
      field('nmSep', 'Separator', n.sep, { options: [['_', 'Underscore _'], ['-', 'Hyphen -'], ['.', 'Dot .'], ['|', 'Pipe |']] }) +
      field('nmCase', 'Letter case', n.case, { options: [['lower', 'lowercase'], ['upper', 'UPPERCASE'], ['keep', 'Keep as typed']] }) +
      '<h2 class="op-h2">UTM parameters</h2>' +
      OPS.PLATFORMS.map(function (p) { return field('utS_' + p, 'utm_source · ' + CAP[p].short, u.source[p]); }).join('') +
      field('utMedium', 'utm_medium (social)', u.medium) + field('utMediumG', 'utm_medium (Google)', u.mediumGoogle) +
      field('utCampaign', 'utm_campaign', u.campaign, { hint: 'Tokens as above, plus {ad}' }) + field('utContent', 'utm_content', u.content) + field('utTerm', 'utm_term', u.term) +
      '<div class="op-row op-field-wide"><button type="submit" class="op-btn op-btn-primary">Save templates</button><button type="button" class="op-btn op-btn-ghost" onclick="orvWorkspace.ops.planning.resetNaming()">Restore defaults</button></div></form>' +
      '<div class="op-preview"><h2 class="op-h2">Preview</h2><div class="op-form op-form-1">' +
      field('pvPlatform', 'Platform', 'meta', { options: OPS.PLATFORMS.map(function (p) { return [p, CAP[p].name]; }) }) +
      field('pvObjective', 'Objective', 'sales') + field('pvCampaign', 'Campaign', 'Spring Sale') + field('pvMarket', 'Market', 'NL') +
      field('pvAudience', 'Audience', 'Prospecting') + field('pvAd', 'Ad', 'Hook A') + field('pvUrl', 'Landing page', 'https://example.com/sale', { type: 'url' }) + '</div>' +
      '<div class="op-out"><span class="op-meta">Campaign name</span><code id="pvName"></code><button type="button" class="op-btn op-btn-text" onclick="orvWorkspace.ops.planning.copy(\'pvName\')">Copy</button></div>' +
      '<div class="op-out"><span class="op-meta">Tracked URL</span><code id="pvLink"></code><button type="button" class="op-btn op-btn-text" onclick="orvWorkspace.ops.planning.copy(\'pvLink\')">Copy</button></div></div></div>';
  }
  function readNaming() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    var src = {}; OPS.PLATFORMS.forEach(function (p) { src[p] = g('utS_' + p).trim(); });
    return { n: { pattern: g('nmPattern').trim() || DEF_NAMING.pattern, sep: g('nmSep') || '_', case: g('nmCase') || 'lower' },
      u: { source: src, medium: g('utMedium').trim(), mediumGoogle: g('utMediumG').trim(), campaign: g('utCampaign').trim(), content: g('utContent').trim(), term: g('utTerm').trim() } };
  }
  function namingPreview() {
    var r = readNaming(); var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    var today = new Date(); var date = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    var v = { platform: g('pvPlatform'), objective: g('pvObjective'), campaign: g('pvCampaign'), market: g('pvMarket'), audience: g('pvAudience'), ad: g('pvAd'), date: date, product: '' };
    var name = applyName(r.n, v), n = document.getElementById('pvName'), l = document.getElementById('pvLink');
    if (n) n.textContent = name;
    if (l) l.textContent = buildUrl(g('pvUrl').trim(), r.u, Object.assign({}, v, { campaign: name }), r.n);
  }
  PL.namingPreview = namingPreview;
  PL.saveNaming = function () { var r = readNaming(); plan().naming = r.n; plan().utm = r.u; S.save('planning'); toast('Templates saved.', 'ok'); };
  PL.resetNaming = function () { plan().naming = null; plan().utm = null; S.save('planning'); if (namingDlg) { namingDlg.setBody(namingForm()); namingPreview(); } };
  var namingDlg = null;
  PL.namingTool = function () {
    namingDlg = OW.flow.dialog({ title: 'Naming & UTM templates', eyebrow: 'Control Center · Planning', wide: true, body: namingForm(), onClose: function () { namingDlg = null; },
      actions: [{ label: 'Close', kind: 'ghost', onClick: function (a) { a.close(false); } }] });
    namingDlg.el.classList.add('op-dlg-xl');
    namingPreview();
  };
  PL.copy = function (id) {
    var t = (document.getElementById(id) || {}).textContent || '';
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('Copied.', 'ok'); }, function () { toast('Couldn’t copy — select the text and copy it manually.', 'warn'); });
  };


  // ── Wiring ──────────────────────────────────────────────────────────
  OPS.store.onChange(function (k) { if (k === 'hydrate' || k === 'planning') { if (isOpen()) renderPlanning(); paintStrip(); } });
  if (OW.on) OW.on(function (what) { if (what === 'campaigns' && isOpen()) renderPlanning(); });
})();
