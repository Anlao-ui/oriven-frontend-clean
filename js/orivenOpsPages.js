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
    acts.push({ label: 'Open Automations', kind: 'ghost', onClick: function (d) { d.close(true); OPS.go('autopilot'); } });
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
  var lastOverview = null, lastAuto = null;
  // Control Center words (js/controlCenter.js); English fallback if absent.
  function CT(k, v) { return window.orvCC ? window.orvCC.T(k, v) : k; }
  function CN(k, n, v) { return window.orvCC ? window.orvCC.N(k, n, v) : String(n); }
  function needsCard() { return document.getElementById('owNeeds'); }
  function renderOverview() {
    if (!document.getElementById('ovPerf')) return;
    if (!(typeof window._getCurrentUser === 'function' && window._getCurrentUser())) return;
    var t = token('dash');
    ['ovPerf', 'ovCamps', 'ovAuto'].forEach(function (id) { var el = document.getElementById(id); if (el && !el.innerHTML) el.innerHTML = '<span class="ow-skel ow-skel-row"></span><span class="ow-skel ow-skel-row"></span>'; });
    Promise.all([D.compare({ key: 'LAST_7_DAYS' }), OPS.data.metaAds().catch(function () { return null; })]).then(function (x) {
      if (stale('dash', t)) return;
      var snap = x[0], ads = adsIndex(x[1]);
      var sig = OPS.signals.compute(snap, {}).filter(function (s) { return s.severity !== 'info'; });
      OPS.registerSignals(sig, snap);
      lastOverview = { snap: snap, sig: sig, ads: ads, error: false };
      paintPerf(snap); paintAttention(sig); paintCampaignsMini(snap, ads);
    }).catch(function () {
      if (stale('dash', t)) return;
      lastOverview = { snap: null, sig: [], ads: {}, error: true };
      paintPerf(null, true); paintAttention([]); paintCampaignsMini(null, {}, true);
    });
    paintAutopilotMini(t);
  }
  OPS.renderDashSnap = renderOverview;
  // Language change: repaint from what is already loaded (no new requests).
  OPS.repaintOverview = function () {
    if (lastOverview) { paintPerf(lastOverview.snap, lastOverview.error); paintAttention(lastOverview.sig); paintCampaignsMini(lastOverview.snap, lastOverview.ads, lastOverview.error); }
    if (lastAuto) paintAutoFrom(lastAuto);
  };
  // Which connected platforms could not be read (status or data error).
  function unreadable(snap) { return snap ? OPS.PLATFORMS.filter(function (p) { var P = snap.platforms[p]; return P && ((P.connected && P.error) || P.statusError); }) : []; }
  function paintPerf(snap, failed) {
    var el = document.getElementById('ovPerf'); if (!el) return;
    if (failed || !snap) {
      el.innerHTML = '<div class="ccx-state ccx-state-warn" role="status"><p>' + esc(CT('perfErr')) + '</p><button type="button" class="ccx-btn ccx-btn-ghost" onclick="orvWorkspace.ops.refreshAll(\'dash\')">' + esc(CT('retry')) + '</button></div>';
      return;
    }
    var bad = unreadable(snap);
    if (noConnections(snap)) {
      // A status check that failed is "unavailable", not "not connected".
      if (bad.length) { el.innerHTML = '<div class="ccx-state ccx-state-warn" role="status"><p>' + esc(CT('perfStatusErr')) + '</p><button type="button" class="ccx-btn ccx-btn-ghost" onclick="orvWorkspace.ops.refreshAll(\'dash\')">' + esc(CT('retry')) + '</button></div>'; return; }
      el.innerHTML = '<div class="ccx-state"><p class="ccx-state-t">' + esc(CT('perfNone')) + '</p><p>' + esc(CT('perfNoneText')) + '</p><button type="button" class="ccx-btn ccx-btn-primary" onclick="bizGoTo(\'connections\')">' + esc(CT('connect')) + '</button></div>';
      return;
    }
    var tot = snap.totals, ptot = snap.prevTotals, cur = tot.currency;
    var split = OPS.PLATFORMS.filter(function (p) { return snap.platforms[p].connected && snap.platforms[p].totals; });
    var badNote = bad.length ? '<p class="ccx-note ccx-note-warn" role="status">' + esc(CT('perfUnavailable', { list: window.orvCC ? orvCC.list(bad.map(function (p) { return CAP[p].name; })) : bad.join(', ') })) + ' <button type="button" class="ccx-link" onclick="orvWorkspace.ops.refreshAll(\'dash\')">' + esc(CT('retry')) + '</button></p>' : '';
    // Connected, but nothing could be read, or nothing reported: a sentence,
    // never a row of empty tiles. No campaigns at all = no activity.
    if (!split.length || (!isNum(tot.spend) && !isNum(tot.conversions))) {
      var why = !split.length && bad.length ? '' : (snap.campaigns.length ? CT('noFigures') : CT('perfQuiet'));
      el.innerHTML = '<p class="ccx-meta">' + esc(CT('perfMeta')) + '</p>' + badNote + (why ? '<p class="ccx-quiet">' + esc(why) + '</p>' : '');
      return;
    }
    var quiet = !tot.mixedCurrency && isNum(tot.spend) && tot.spend === 0 && (!ptot || !isNum(ptot.spend) || ptot.spend === 0);
    var max = Math.max.apply(null, split.map(function (p) { return snap.platforms[p].totals.spend || 0; }).concat([1]));
    el.innerHTML = '<p class="ccx-meta">' + esc(CT('perfMeta')) + '</p>' + badNote +
      (tot.mixedCurrency ? '<p class="ccx-note">' + esc(CT('perfMixed')) + '</p>' : '') +
      (quiet ? '<p class="ccx-quiet">' + esc(CT('perfQuiet')) + '</p>' : '') +
      '<div class="op-figs op-figs-ov ccx-figs">' + figure(CT('fig.spend'), 'spend', tot, ptot, cur) + figure(CT('fig.conversions'), 'conversions', tot, ptot, cur) + figure(CT('fig.cpa'), 'cpa', tot, ptot, cur) +
        figure(CT('fig.roas'), 'roas', tot, ptot, cur, { why: tot.partialValue ? CT('partialValue') : '' }) + '</div>' +
      '<ul class="ccx-split" aria-label="' + esc(CT('splitAria')) + '">' + split.map(function (p) {
        var T = snap.platforms[p].totals, c = snap.platforms[p].currency;
        return '<li><span class="ccx-split-l">' + UI.platBadge(p) + '</span><span class="ccx-split-bar"><i class="ov-pl-' + p + '" style="width:' + Math.max(3, (T.spend || 0) / max * 100).toFixed(1) + '%"></i></span>' +
          '<span class="ccx-split-v">' + esc(F.money(T.spend, c)) + '</span><span class="ccx-split-c">' + esc(CT('conv', { n: F.num(T.conversions) })) + '</span></li>';
      }).join('') + '</ul>';
  }
  var attSig = [], attAll = false;
  OPS.showAllSignals = function () { attAll = true; if (window.orvCC && needsCard() && needsCard().classList.contains('ccx-needs')) { window.orvCC.needsToggle(); return; } paintAttention(attSig); };
  function sigText(s) {
    var e = s.evidence && s.evidence[0];
    if (s.type === 'no_conv') return CT('sigNoConv', { cur: e.cur });
    if (s.type === 'no_spend') return CT('sigNoSpend');
    if (s.type === 'limited') return CT('sigLimited');
    if (s.type === 'tracking') return CT('sigTracking');
    if (e && e.change && e.change !== '—' && e.prev != null) return CT('sigChange', { label: e.label, change: e.change });
    return sigShort(s);
  }
  function paintAttention(sig) {
    var el = document.getElementById('ovAtt'), card = needsCard(); if (!el) return;
    if (sig !== attSig) attAll = false;
    attSig = sig;
    if (window.orvCC && card && card.classList.contains('ccx-needs')) {
      // Control Center: ranked rows merged with the workspace items.
      el.innerHTML = sig.map(function (s, i) {
        var c = s.campaign && s.campaign.name ? s.campaign.name : (s.platform ? CT('sigAccount', { p: CAP[s.platform].name }) : CT('sigAll'));
        var rank = s.severity === 'high' ? 0 : 1;
        return '<button type="button" class="ccx-nrow ccx-t-' + (rank === 0 ? 'risk' : 'attention') + '" data-rank="' + rank + '" data-i="' + i + '" onclick="orvWorkspace.ops.openSignal(\'' + jsq(s.id) + '\')">' +
          '<i class="ccx-dot" aria-hidden="true"></i><span class="ccx-nbody"><span class="ccx-ntitle"><span class="ccx-sr">' + esc(CT(rank === 0 ? 'sev.risk' : 'sev.attention')) + ': </span>' + (s.platform ? UI.platBadge(s.platform) + ' ' : '') + esc(c) + ' — ' + esc(sigText(s)) + '</span><span class="ccx-nsub">' + esc(CT('sigSource')) + '</span></span>' +
          '<span class="ccx-nact">' + esc(CT('sigView')) + '<span class="op-sr"> ' + esc(CT('sigWhy', { c: c })) + '</span><span aria-hidden="true"> →</span></span></button>';
      }).join('');
      card.setAttribute('data-sig-ready', '1');
      window.orvCC.needsSync();
      if (OW.home && OW.home.render) OW.home.render(); // header attention count
      return;
    }
    var cnt = document.getElementById('ovAttCount');
    var shown = attAll ? sig : sig.slice(0, 2);
    if (cnt) cnt.textContent = sig.length ? sig.length + ' in your ads' : '';
    el.innerHTML = shown.length ? '<ul class="ov-att-list">' + shown.map(function (s) {
      var c = s.campaign && s.campaign.name ? s.campaign.name : (s.platform ? CAP[s.platform].name + ' account' : 'All platforms');
      return '<li class="ov-att-i ov-sev-' + esc(s.severity) + '"><span class="ov-att-w">' + (s.platform ? UI.platBadge(s.platform) : '') + '<b>' + esc(c) + '</b></span>' +
        '<span class="ov-att-m">' + esc(sigShort(s)) + '</span><button type="button" class="op-btn op-btn-ghost ov-att-b" onclick="orvWorkspace.ops.openSignal(\'' + jsq(s.id) + '\')">View<span class="op-sr"> why ' + esc(c) + ' was flagged</span></button></li>';
    }).join('') + '</ul>' + (sig.length > 2 && !attAll ? '<button type="button" class="op-link ov-more" onclick="orvWorkspace.ops.showAllSignals()">View all ' + sig.length + '</button>' : '')
      : '<p class="ov-calm"><i aria-hidden="true"></i>Nothing in your ads needs a decision.</p>';
  }
  // Campaigns: three states from their real sources — running (the live
  // platform read), drafts (OrivenAI's own records) and needing attention
  // (OrivenAI records that failed or are blocked). Never one merged number.
  function paintCampaignsMini(snap, ads, failed) {
    var el = document.getElementById('ovCamps'); if (!el) return;
    var drafts = draftRows();
    var C = OW.campaigns, n = C && C.counts ? C.counts() : { failed: 0, blocked: 0 };
    var needAtt = (n.failed || 0) + (n.blocked || 0);
    var bad = unreadable(snap), connected = snap ? snap.connected.length : 0;
    var live = snap ? snap.campaigns.filter(function (c) { return c.status === 'active'; }) : [];
    live.sort(function (a, b) { return (b.spend || 0) - (a.spend || 0); });
    // "Running" is only claimed from a successful platform read.
    var runningKnown = !!snap && !failed && connected > 0 && bad.length < connected;
    if (window.orvCC) window.orvCC.setRunning(runningKnown ? live.length : null);
    var runningVal = !snap || failed ? '<span class="ccx-stat-na">' + esc(CT('unavailable')) + '</span>' : !connected ? '<span class="ccx-stat-na">' + esc(CT(bad.length ? 'unavailable' : 'notConnected')) + '</span>' : (bad.length === connected ? '<span class="ccx-stat-na">' + esc(CT('unavailable')) + '</span>' : '<b>' + live.length + '</b>' + (bad.length ? '<span class="ccx-stat-flag" title="' + esc(CT('perfUnavailable', { list: bad.map(function (p) { return CAP[p].name; }).join(', ') })) + '">*</span>' : ''));
    var stat = function (val, label, src, cls) { return '<div class="ccx-stat' + (cls ? ' ' + cls : '') + '"><span class="ccx-stat-v">' + val + '</span><span class="ccx-stat-l">' + esc(label) + '</span><span class="ccx-stat-s">' + esc(src) + '</span></div>'; };
    var stats = '<div class="ccx-stats">' + stat(runningVal, CT('running'), CT('runningSrc')) + stat('<b>' + drafts.length + '</b>', CT('drafts'), CT('draftsSrc')) + stat('<b>' + needAtt + '</b>', CT('needAtt'), CT('needAttSrc'), needAtt ? 'is-warn' : '') + '</div>';
    var pick = live.slice(0, 3);
    if (pick.length < 3) pick = pick.concat(drafts.slice(0, 3 - pick.length));
    var total = live.length + drafts.length;
    if (!pick.length) { el.innerHTML = stats + '<div class="ccx-state ccx-state-sm"><p>' + esc(CT('campsNone')) + '</p><button type="button" class="ccx-btn ccx-btn-ghost" onclick="_orvNav(\'create\',\'page-create\')">' + esc(CT('createOne')) + '</button></div>'; return; }
    el.innerHTML = stats + '<ul class="ccx-clist">' + pick.map(function (c) {
      var cr = creativeFor(c, ads);
      var stageTxt = c.draft ? (CT('stage.' + c.stage.key) || c.stage.label) : CT('stage.live');
      return '<li><button type="button" class="ccx-crow" onclick="orvWorkspace.ops.openCampaign(\'' + c.platform + '\',\'' + jsq(c.id) + '\',' + (c.draft ? 'true' : 'false') + ')">' +
        '<span class="ccx-cthumb ov-pl-' + c.platform + '" aria-hidden="true">' + (cr.url ? '<img src="' + esc(cr.url) + '" alt="" loading="lazy">' : PLAT_MARK[c.platform]) + '</span>' +
        '<span class="ccx-cname"><b>' + esc(c.name) + '</b><em>' + esc(CAP[c.platform].short) + ' · ' + esc(stageTxt) + '</em></span><span class="ccx-go" aria-hidden="true">→</span></button></li>';
    }).join('') + '</ul>' + (total > pick.length ? '<p class="ccx-more-line">' + esc(CT('more', { n: total - pick.length })) + ' · <button type="button" class="ccx-link" onclick="orvWorkspace.ops.go(\'campaigns\')">' + esc(CT('viewCampaigns')) + '</button></p>' : '');
  }
  OPS.openCampaign = function (platform, id, isDraft) {
    if (!OW.go) return OPS.go(isDraft ? 'launch' : 'campaigns');
    if (isDraft) { OW.go({ page: 'launch', platform: platform, campaignId: id }); return; }
    var c = lastOverview && lastOverview.snap ? OPS.findCampaign(lastOverview.snap, platform, id) : null;
    OW.go({ page: 'campaigns', platform: platform, campaignName: c ? c.name : null });
  };
  // Automations is included from Starter (plans.js entitlements); unknown plan = not locked.
  function hasAutomationPlan() { return typeof window.orvEntitled === 'function' ? window.orvEntitled('autopilot') !== false : true; }
  // Real counts from /api/automations/overview; the last line is the latest
  // real entry in the automation activity ledger.
  function paintAutopilotMini(t) {
    var el = document.getElementById('ovAuto'); if (!el) return;
    if (!hasAutomationPlan()) { lastAuto = { locked: true }; paintAutoFrom(lastAuto); return; }
    Promise.all([window.apiFetch('/api/automations/overview'), window.apiFetch('/api/automations/activity?limit=1')].map(function (p) { return p.catch(function () { return null; }); })).then(function (x) {
      if (stale('dash', t)) return;
      var o = x[0] && x[0].ok ? x[0].data : null;
      lastAuto = { o: o, last: x[1] && x[1].ok && x[1].data && x[1].data.items ? x[1].data.items[0] : null, error: !o };
      paintAutoFrom(lastAuto);
    });
  }
  function paintAutoFrom(a) {
    var el = document.getElementById('ovAuto'); if (!el) return;
    if (a.locked) { el.innerHTML = '<p class="ccx-line">' + esc(CT('autoFree')) + '</p><p class="ccx-meta">' + esc(CT('autoFreeSub')) + '</p>'; return; }
    if (a.error) { el.innerHTML = '<p class="ccx-meta">' + esc(CT('autoErr')) + '</p>'; return; }
    var o = a.o, last = a.last, c = o.counts || {}, on = c.active || 0, waiting = c.pendingApprovals || 0;
    var conn = (o.accounts || []).filter(function (x) { return x.connected; }).map(function (x) { return (CAP[x.platform] && CAP[x.platform].short) || x.platform; });
    var head = o.pausedAll ? CT('autoPaused') : on ? CN('autoActive', on) : CT('autoNone');
    var sub = on ? (conn.length ? CT('autoManaging', { list: window.orvCC ? orvCC.list(conn) : conn.join(', ') }) : '') : (conn.length ? CT('autoConnected', { list: window.orvCC ? orvCC.list(conn) : conn.join(', ') }) : CT('autoNoAccounts'));
    var lines = [];
    if (o.nextRun) lines.push(CT('autoNext', { when: window.orvCC ? orvCC.rel(o.nextRun.run_at) : rel(o.nextRun.run_at) }));
    if (last && !waiting) lines.push(CT('autoLast', { what: (CT('autoAct.' + last.action) || last.action) + (last.campaign_name ? ' · ' + last.campaign_name : ''), when: window.orvCC ? orvCC.rel(last.created_at) : rel(last.created_at) }));
    el.innerHTML = '<p class="ccx-line"><span class="ccx-sdot' + (on && !o.pausedAll ? ' is-on' : o.pausedAll ? ' is-warn' : '') + '" aria-hidden="true"></span>' + esc(head) + '</p>' +
      (sub ? '<p class="ccx-meta">' + esc(sub) + '</p>' : '') +
      (lines.length ? '<p class="ccx-meta">' + lines.map(esc).join(' · ') + '</p>' : '') +
      (waiting ? '<button type="button" class="ccx-pill-btn" onclick="orvWorkspace.ops.go(\'autopilot\')">' + esc(CN('autoWaiting', waiting)) + ' <span aria-hidden="true">→</span></button>' : '');
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
