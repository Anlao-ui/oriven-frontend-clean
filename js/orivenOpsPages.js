/* ════════════════════════════════════════════════════════════════
   OrivenAI — Control Center advertising blocks

   Control Center (step 01, the start page) shows the greeting, status line
   and Needs you list (orivenWorkspace.js) plus the blocks this file fills
   from real data — performance across platforms, what needs attention,
   campaigns and Autopilot. Planning and the business modules sit below. Every block summarises; the detail
   stays in its own page (Campaigns, Autopilot, Launch, Planning).

   Real data only: every number comes from the connected platforms or the
   user's own records; missing data shows "—" or an honest empty state.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var OW = window.orvWorkspace = window.orvWorkspace || {};
  var OPS = OW.ops;
  if (!OPS) return;
  var esc = OPS.esc, jsq = OPS.jsq, isNum = OPS.isNum, F = OPS.fmt, CAP = OPS.CAP, D = OPS.data, UI = OPS.ui;

  // Shared view state (platform + analytics range), per session.
  var VIEW = OPS.view = (function () {
    var v = { range: 'LAST_7_DAYS', platform: 'all' };
    try { var s = JSON.parse(sessionStorage.getItem('oriven_ops_view') || 'null'); if (s) v = Object.assign(v, s); } catch (_) {}
    return v;
  })();
  function saveView() { try { sessionStorage.setItem('oriven_ops_view', JSON.stringify(VIEW)); } catch (_) {} }
  function rerender(area) { if (area === 'dash') renderOverview(); }
  OPS.refreshAll = function (area) { D.invalidate(); rerender(area); };
  OPS.onExternalChange = function () {
    var a = document.querySelector('.page.active');
    if (a && a.id === 'page-business-brain') rerender('dash');
  };

  // ── Shared bits ─────────────────────────────────────────────────────
  function head(title, controls, sub) {
    return '<header class="op-head"><div class="op-head-text"><h1 class="op-h1">' + esc(title) + '</h1>' + (sub ? '<p class="op-sub">' + sub + '</p>' : '') + '</div>' +
      (controls ? '<div class="op-head-ctl">' + controls + '</div>' : '') + '</header>';
  }
  function refreshBtn(area) { return '<button type="button" class="op-btn op-btn-ghost op-btn-icon" aria-label="Refresh" title="Refresh" onclick="orvWorkspace.ops.refreshAll(\'' + area + '\')">↻</button>'; }
  function platCtl(area, snap) { return UI.platformFilter('p', VIEW.platform, "orvWorkspace.ops.setPlatform('%P%','" + area + "')", snap); }
  function plats() { return VIEW.platform === 'all' ? OPS.PLATFORMS : [VIEW.platform]; }
  function noConnections(snap) { return !snap || !snap.connected.length; }
  function connectEmpty(what) {
    return UI.empty('Connect an ad account to ' + what, 'OrivenAI reads your campaigns and performance directly from Meta, Google, TikTok and Pinterest. Nothing is shown until real data is available.',
      '<button type="button" class="op-btn op-btn-primary" onclick="bizGoTo(\'connections\')">Connect a platform</button>');
  }
  function errorsBlock(snap) {
    var errs = plats().filter(function (p) { return snap.platforms[p] && snap.platforms[p].error; });
    if (!errs.length) return '';
    return '<div class="op-note op-note-warn" role="status">' + errs.map(function (p) {
      return '<p><b>' + esc(CAP[p].name) + ':</b> ' + esc(snap.platforms[p].error) + ' <button type="button" class="op-link" onclick="bizGoTo(\'connections\')">Check connection</button></p>';
    }).join('') + '</div>';
  }
  var tokens = {};
  function token(area) { tokens[area] = (tokens[area] || 0) + 1; return tokens[area]; }
  function stale(area, t) { return tokens[area] !== t; }
  function failBlock(area) {
    return UI.empty('Couldn’t load your advertising data', 'OrivenAI couldn’t reach its servers. Check your connection and try again.',
      '<button type="button" class="op-btn op-btn-primary" onclick="orvWorkspace.ops.refreshAll(\'' + area + '\')">Try again</button>');
  }
  // Honest about how context reaches the assistant: the numbers are typed
  // into the question itself, visible and editable before sending.
  var ASK_NOTE = 'Opens the assistant with your question and the key numbers from this screen written into it, so you can see and edit exactly what is sent. Nothing is sent until you press Send (chat credits apply).';

  var GOOD_UP = { spend: null, convValue: true, conversions: true, roas: true, cpa: false, clicks: true, impressions: true, ctr: true, cpc: false, cpm: false, cvr: true, reach: true };
  var KIND = { spend: 'money', convValue: 'money', cpa: 'money', cpc: 'money', cpm: 'money', roas: 'ratio', ctr: 'pct', cvr: 'pct' };
  function fmtK(key, v, cur) { var k = KIND[key] || 'num'; return k === 'money' ? F.money(v, cur) : k === 'ratio' ? F.ratio(v) : k === 'pct' ? F.pct(v) : F.num(v); }
  function deltaCls(key, ch) { return isNum(ch) && Math.abs(ch) >= 0.5 && GOOD_UP[key] != null ? (((ch > 0) === GOOD_UP[key]) ? 'is-good' : 'is-bad') : ''; }
  function figure(label, key, t, p, cur, opts) {
    opts = opts || {};
    var v = t ? t[key] : null, pv = p ? p[key] : null, ch = F.change(v, pv);
    var note = opts.note || (!isNum(v) && opts.why ? opts.why : '');
    return '<div class="op-fig"><div class="op-fig-l">' + esc(label) + '</div><div class="op-fig-v">' + esc(opts.value != null ? opts.value : fmtK(key, v, cur)) + '</div>' +
      (opts.value == null && isNum(ch) ? '<div class="op-fig-d ' + deltaCls(key, ch) + '"><span class="op-sr">Change versus previous period: </span>' + esc(F.changeTxt(ch)) + '</div>' : '') +
      (note ? '<div class="op-fig-n">' + esc(note) + '</div>' : '') + '</div>';
  }
  function prevCombined(snap, P) {
    var prevSnap = { platforms: {}, campaigns: [] };
    P.forEach(function (p) { prevSnap.platforms[p] = { totals: snap.platforms[p].prevTotals, currency: snap.platforms[p].currency }; });
    return D.combine(prevSnap, P);
  }
  function prettyObjective(o) {
    if (!o) return '—';
    return String(o).replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, function (m) { return m.toUpperCase(); });
  }
  function rel(iso) { return OW.relTime ? OW.relTime(iso) : (iso || ''); }

  // One-line "what" for a signal: the first piece of evidence and its change.
  function sigShort(s) {
    var e = s.evidence && s.evidence[0];
    if (s.type === 'no_conv') return 'Spent ' + e.cur + ', no conversions';
    if (s.type === 'no_spend') return 'Active, no spend';
    if (s.type === 'limited') return 'Using its full daily budget';
    if (s.type === 'tracking') return 'Spend reported, no conversions';
    if (e && e.change && e.change !== '—') return e.label + ' ' + e.change + (e.prev != null ? ' vs previous period' : '');
    return s.title;
  }
  OPS.sigShort = sigShort;
  // Compact expandable signal row.
  var SEV = { high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };
  function sigRow(s, opts) {
    opts = opts || {};
    var acts = (s.actions || []).map(function (a, i) {
      if (opts.inModal && a.type === 'open') return '';
      return '<button type="button" class="op-btn ' + (i === 0 ? 'op-btn-primary' : 'op-btn-ghost') + '" onclick="orvWorkspace.ops.runSignalAction(\'' + jsq(s.id) + '\',' + i + ')">' + esc(a.label) + '</button>';
    }).join('');
    var saved = !!(OPS.store.get('ops').saved || {})[s.id];
    return '<details class="op-sr-row op-srs-' + esc(s.severity) + '" data-sig="' + esc(s.id) + '"' + (opts.open ? ' open' : '') + '>' +
      '<summary><span class="op-sev op-sev-' + esc(s.severity) + '">' + esc(SEV[s.severity]) + '</span>' +
        '<span class="op-sr-title">' + esc(s.title) + '</span>' + (s.platform ? UI.platBadge(s.platform) : '') + '</summary>' +
      '<div class="op-sr-body">' + sigDetail(s) +
        '<div class="op-sig-actions">' + acts +
          (opts.manage ? '<button type="button" class="op-btn op-btn-text" onclick="orvWorkspace.ops.saveSignal(\'' + jsq(s.id) + '\')">' + (saved ? 'Saved' : 'Save') + '</button><button type="button" class="op-btn op-btn-text" onclick="orvWorkspace.ops.dismissSignal(\'' + jsq(s.id) + '\')">Dismiss for 7 days</button>' : '') +
        '</div></div></details>';
  }
  function sigDetail(s) {
    return '<p class="op-sig-why">' + esc(s.why) + '</p>' +
      '<table class="op-ev"><thead><tr><th scope="col">Data</th><th scope="col">Now</th><th scope="col">Before</th><th scope="col">Change</th></tr></thead><tbody>' +
      s.evidence.map(function (e) { return '<tr><th scope="row">' + esc(e.label) + '</th><td>' + esc(e.cur) + '</td><td>' + esc(e.prev == null ? '—' : e.prev) + '</td><td>' + esc(e.change == null ? '—' : e.change) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="op-sig-rule"><b>Why it was flagged:</b> ' + esc(s.rule) + '</p>' +
      '<p class="op-sig-rec"><b>Suggested:</b> ' + esc(s.recommendation) + '</p>';
  }
  OPS.ui.sigRow = sigRow;
  // A signal opened in place from Control Center.
  OPS.openSignal = function (id) {
    var e = OPS._sig && OPS._sig(id); if (!e) return;
    var s = e.s;
    var acts = (s.actions || []).map(function (a, i) { return { label: a.label, kind: i === 0 ? 'primary' : 'ghost', onClick: function (d) { d.close(true); OPS.runSignalAction(s.id, i); } }; });
    acts.push({ label: 'Open Autopilot', kind: 'ghost', onClick: function (d) { d.close(true); OPS.go('autopilot'); } });
    OW.flow.dialog({ title: s.title, eyebrow: (s.platform ? CAP[s.platform].name + ' · ' : '') + SEV[s.severity] + ' · ' + s.category, wide: true, body: sigDetail(s), actions: acts });
  };

  function historyList(rows) {
    if (!rows.length) return '<p class="op-muted op-pad">No changes yet. Pauses, resumes and budget changes made through OrivenAI are listed here.</p>';
    return '<ul class="op-hist">' + rows.map(function (h) {
      var what = h.kind === 'budget' ? 'Daily budget ' + F.money(h.from, h.currency) + ' → ' + F.money(h.to, h.currency)
        : h.kind === 'pause' ? 'Paused' : h.kind === 'resume' ? 'Resumed' : h.kind === 'rec' ? (h.detail || 'Recommendation') : (h.detail || h.kind);
      return '<li><span class="op-hist-t">' + esc(rel(h.at)) + '</span>' + (h.platform && CAP[h.platform] ? UI.platBadge(h.platform) : '<span></span>') +
        '<span class="op-hist-w"><b>' + esc(h.campaignName || '') + '</b> ' + esc(what) + '</span><span class="op-meta">' + esc((h.source || '') + (h.by ? ' · ' + h.by : '')) + '</span></li>';
    }).join('') + '</ul>';
  }
  OPS.historyList = historyList;

  // ── Creative for a campaign (truthful: only a real image) ──────────
  function extract(rec) { try { return typeof window._launchExtractFields === 'function' ? window._launchExtractFields(rec.pkg || {}, rec.platform) : null; } catch (_) { return null; } }
  function adsIndex(res) {
    var idx = {};
    ((res && res.ads) || []).forEach(function (a) { (idx[String(a.campaignId)] = idx[String(a.campaignId)] || []).push(a); });
    return idx;
  }
  function creativeFor(c, ads) {
    var rec = c.draft ? c.local : (OW.campaigns && OW.campaigns.findByExternal ? OW.campaigns.findByExternal(c.platform, c.id, null) : null);
    var list = !c.draft && c.platform === 'meta' && ads ? (ads[String(c.id)] || []) : [];
    var withImg = list.filter(function (a) { return a.image; });
    if (withImg.length) return { url: withImg[0].image, ads: list.length, alt: withImg[0].headline || '' };
    var f = rec ? extract(rec) : null;
    if (f && f.imageUrl) return { url: f.imageUrl, ads: list.length || null, alt: '' };
    return { url: null, ads: list.length || null };
  }
  var PLAT_MARK = { meta: 'M', google: 'G', tiktok: 'T', pinterest: 'P' };

  // ════════════════════════════════════════════════════════════════
  // HOME — summary blocks
  // ════════════════════════════════════════════════════════════════
  var lastOverview = null;
  function renderOverview() {
    if (!document.getElementById('ovPerf')) return;
    if (!(typeof window._getCurrentUser === 'function' && window._getCurrentUser())) return;
    var t = token('dash');
    ['ovPerf', 'ovCamps', 'ovAuto'].forEach(function (id) { var el = document.getElementById(id); if (el && !el.innerHTML) el.innerHTML = '<span class="ow-skel ow-skel-row"></span>'; });
    Promise.all([D.compare({ key: 'LAST_7_DAYS' }), OPS.data.metaAds().catch(function () { return null; })]).then(function (x) {
      if (stale('dash', t)) return;
      var snap = x[0], ads = adsIndex(x[1]);
      var sig = OPS.signals.compute(snap, {}).filter(function (s) { return s.severity !== 'info'; });
      OPS.registerSignals(sig, snap);
      lastOverview = { snap: snap, sig: sig, ads: ads };
      paintPerf(snap); paintAttention(sig); paintCampaignsMini(snap, ads);
    }).catch(function () {
      if (stale('dash', t)) return;
      var p = document.getElementById('ovPerf'); if (p) p.innerHTML = '<p class="op-note op-note-warn">Couldn’t load your advertising data. <button type="button" class="op-link" onclick="orvWorkspace.ops.refreshAll(\'dash\')">Try again</button></p>';
      paintAttention([]);
      paintCampaignsMini(null, {});
    });
    paintAutopilotMini(t);
  }
  OPS.renderDashSnap = renderOverview;
  function paintPerf(snap) {
    var el = document.getElementById('ovPerf'); if (!el) return;
    if (noConnections(snap)) {
      el.innerHTML = '<div class="ov-empty"><p>See spend, results and what needs attention across Meta, Google, TikTok and Pinterest — read directly from the platforms.</p><button type="button" class="op-btn op-btn-primary" onclick="bizGoTo(\'connections\')">Connect a platform</button></div>';
      return;
    }
    var tot = snap.totals, ptot = snap.prevTotals, cur = tot.currency;
    var split = OPS.PLATFORMS.filter(function (p) { return snap.platforms[p].connected && snap.platforms[p].totals; });
    var max = Math.max.apply(null, split.map(function (p) { return snap.platforms[p].totals.spend || 0; }).concat([1]));
    el.innerHTML = '<p class="ov-meta">Last 7 days vs the 7 days before · platform-reported</p>' +
      (tot.mixedCurrency ? '<p class="op-foot">Your accounts use different currencies, so spend is shown per platform below.</p>' : '') +
      '<div class="op-figs op-figs-ov">' + figure('Spend', 'spend', tot, ptot, cur) + figure('Conversions', 'conversions', tot, ptot, cur) + figure('CPA', 'cpa', tot, ptot, cur) +
        figure('ROAS', 'roas', tot, ptot, cur, { why: tot.partialValue ? 'Not every platform reports value' : '' }) + '</div>' +
      '<ul class="ov-split" aria-label="Spend by platform">' + split.map(function (p) {
        var T = snap.platforms[p].totals, c = snap.platforms[p].currency;
        return '<li><span class="ov-split-l">' + UI.platBadge(p) + '</span><span class="ov-split-bar"><i class="ov-pl-' + p + '" style="width:' + Math.max(3, (T.spend || 0) / max * 100).toFixed(1) + '%"></i></span>' +
          '<span class="ov-split-v">' + esc(F.money(T.spend, c)) + '</span><span class="ov-split-c op-meta">' + esc(F.num(T.conversions)) + ' conv.</span></li>';
      }).join('') + '</ul>';
  }
  function paintAttention(sig) {
    var el = document.getElementById('ovAtt'), cnt = document.getElementById('ovAttCount'); if (!el) return;
    var shown = sig.slice(0, 2);
    if (cnt) cnt.textContent = sig.length ? sig.length + ' in your ads' : '';
    el.innerHTML = shown.length ? '<ul class="ov-att-list">' + shown.map(function (s) {
      var c = s.campaign && s.campaign.name ? s.campaign.name : (s.platform ? CAP[s.platform].name + ' account' : 'All platforms');
      return '<li class="ov-att-i ov-sev-' + esc(s.severity) + '"><span class="ov-att-w">' + (s.platform ? UI.platBadge(s.platform) : '') + '<b>' + esc(c) + '</b></span>' +
        '<span class="ov-att-m">' + esc(sigShort(s)) + '</span><button type="button" class="op-btn op-btn-ghost ov-att-b" onclick="orvWorkspace.ops.openSignal(\'' + jsq(s.id) + '\')">View<span class="op-sr"> why ' + esc(c) + ' was flagged</span></button></li>';
    }).join('') + '</ul>' + (sig.length > 2 ? '<button type="button" class="op-link ov-more" onclick="orvWorkspace.ops.go(\'autopilot\')">View all ' + sig.length + ' in Autopilot</button>' : '')
      : '<p class="ov-calm"><i aria-hidden="true"></i>Nothing in your ads needs a decision. Rules only fire with enough data.</p>';
  }
  function paintCampaignsMini(snap, ads) {
    var el = document.getElementById('ovCamps'); if (!el) return;
    var drafts = draftRows();
    var live = snap ? snap.campaigns.filter(function (c) { return c.status === 'active'; }) : [];
    live.sort(function (a, b) { return (b.spend || 0) - (a.spend || 0); });
    var pick = live.slice(0, 3);
    if (pick.length < 3) pick = pick.concat(drafts.slice(0, 3 - pick.length));
    var meta = '<p class="ov-cstate">' + (snap ? '<span><b>' + live.length + '</b> active in your ad accounts</span>' : '<span>Platform campaigns unavailable</span>') + '<span><b>' + drafts.length + '</b> not launched</span></p>';
    if (!pick.length) { el.innerHTML = meta + '<div class="ov-empty"><p>No campaigns yet.</p><button type="button" class="op-btn op-btn-ghost" onclick="_orvNav(\'create\',\'page-create\')">Create one</button></div>'; return; }
    el.innerHTML = meta + '<ul class="ov-clist">' + pick.map(function (c) {
      var cr = creativeFor(c, ads);
      return '<li><button type="button" class="ov-crow" onclick="orvWorkspace.ops.openCampaign(\'' + c.platform + '\',\'' + jsq(c.id) + '\',' + (c.draft ? 'true' : 'false') + ')">' +
        '<span class="ov-cthumb ov-pl-' + c.platform + '" aria-hidden="true">' + (cr.url ? '<img src="' + esc(cr.url) + '" alt="" loading="lazy">' : PLAT_MARK[c.platform]) + '</span>' +
        '<span class="ov-cname"><b>' + esc(c.name) + '</b><em>' + esc(CAP[c.platform].short + (c.draft ? ' · ' + c.stage.label : '')) + '</em></span><span class="ov-cgo" aria-hidden="true">→</span></button></li>';
    }).join('') + '</ul>';
  }
  OPS.openCampaign = function (platform, id, isDraft) {
    if (!OW.go) return OPS.go(isDraft ? 'launch' : 'campaigns');
    if (isDraft) { OW.go({ page: 'launch', platform: platform, campaignId: id }); return; }
    var c = lastOverview && lastOverview.snap ? OPS.findCampaign(lastOverview.snap, platform, id) : null;
    OW.go({ page: 'campaigns', platform: platform, campaignName: c ? c.name : null });
  };
  // Autopilot is included from Starter (plans.js entitlements); unknown plan = not locked.
  function hasAutomationPlan() { return typeof window.orvEntitled === 'function' ? window.orvEntitled('autopilot') !== false : true; }
  function paintAutopilotMini(t) {
    var el = document.getElementById('ovAuto'); if (!el) return;
    if (!hasAutomationPlan()) {
      el.innerHTML = '<p class="ov-auto-h">Not included on Free</p><p class="ov-meta">Autopilot is available from Starter.</p>';
      return;
    }
    Promise.all([window.apiFetch('/api/autopilot/rules'), window.apiFetch('/api/autopilot/recommendations?status=suggested'), window.apiFetch('/api/autopilot/history'), D.status()].map(function (p) { return p.catch(function () { return null; }); })).then(function (x) {
      if (stale('dash', t)) return;
      var rules = x[0] && x[0].ok && x[0].data ? x[0].data.rules || [] : null, recs = x[1] && x[1].ok && x[1].data ? x[1].data.recommendations || [] : [];
      var hist = x[2] && x[2].ok && x[2].data ? x[2].data.items || [] : [];
      if (!rules) { el.innerHTML = '<p class="ov-meta">Couldn’t load Autopilot right now.</p>'; return; }
      var on = rules.filter(function (r) { return r.enabled; });
      el.innerHTML = '<p class="ov-auto-h"><span class="ov-dot' + (on.length ? ' is-on' : '') + '" aria-hidden="true"></span>' + (on.length ? on.length + ' rule' + (on.length === 1 ? '' : 's') + ' active' : 'No rules active') + '</p>' +
        '<p class="ov-meta">' + esc(watchLine(on.length, x[3])) + (recs.length ? '' : ' · nothing waiting') + '</p>' +
        (recs.length ? '<button type="button" class="ov-auto-ap" onclick="orvWorkspace.ops.go(\'autopilot\')"><b>' + recs.length + ' waiting for approval →</b></button>'
          : hist[0] ? '<p class="ov-meta ov-auto-last">Last: ' + esc(hist[0].title || '') + ' · ' + esc(rel(hist[0].created_at)) + '</p>' : '');
    });
  }
  // Only claims to watch what is really watched: Meta/Google, connected, with a rule on.
  function watchLine(nRules, st) {
    var mon = ['meta', 'google'].filter(function (p) { return st && st[p] && st[p].connected; });
    if (!mon.length) return 'Autopilot monitors Meta and Google — connect one to start';
    var names = mon.map(function (p) { return CAP[p].short; }).join(' and ');
    return nRules ? 'Watching ' + names : names + ' connected · add a rule to start watching';
  }
  OPS.askOverview = function () {
    var o = lastOverview;
    if (!o || noConnections(o.snap)) { OPS.ai.ask('What should I focus on in my advertising today?', { area: 'Control Center' }); return; }
    OPS.ai.ask('What is happening in my advertising, and what should I look at first?', OPS.ai.factsFor('Control Center', o.snap, o.sig, {}), OPS.ai.factsLine(o.snap, o.sig));
  };


  // Drafts from the user's own campaign records (not yet launched).
  var DRAFT_STAGES = { draft: 1, ready: 1, warning: 1, blocked: 1, publishing: 1, failed: 1 };
  function draftRows() {
    var C = OW.campaigns; if (!C || !C.local) return [];
    return C.local().filter(function (c) { return c && c.status !== 'archived' && DRAFT_STAGES[C.stage(c).key]; }).map(function (c) {
      var st = C.stage(c), f = extract(c);
      var b = f && f.budget != null && isFinite(Number(f.budget)) ? Number(f.budget) : null;
      return { draft: true, local: c, platform: CAP[c.platform] ? c.platform : 'meta', id: c.id, name: c.name || 'Untitled campaign', status: 'draft', stage: st,
        objective: (f && f.s && f.s.goal) || c.goal || '', budget: b, budgetType: b != null ? 'daily' : null, currency: null, updated: c.updated || c.created };
    });
  }

  // ── Wiring ──────────────────────────────────────────────────────────
  OPS.onReset(function () { lastOverview = null; });
  // Rendered when Control Center's overview opens (bizSwitchTab, app.html).
  // Research: its ready-state context panel follows the real page state.
  OPS.onEnter('research', function () { setTimeout(function () { if (window._researchSyncSide) window._researchSyncSide(); }, 50); });
  if (OW.on) OW.on(function (what) {
    if (what !== 'campaigns') return;
    var a = document.querySelector('.page.active');
    if (a && a.id === 'page-business-brain' && lastOverview) paintCampaignsMini(lastOverview.snap, lastOverview.ads || {});
  });
})();
