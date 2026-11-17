/* ════════════════════════════════════════════════════════════════
   Campaign Overview → metric tiles (#ovtRoot inside #page-performance).

   Replaces the single full-width chart and the "Connect your ad accounts"
   banner: one compact tile per metric (Impressions, Clicks, CTR, Spend,
   Conversions, CPC, CPA, ROAS) for the platform, campaign/ad and period
   chosen in the page's own controls — current value, change vs the
   previous period of the same length, and a sparkline. A tile opens the
   metric's detail chart: its own period, one line per connected platform.
   Below: comparison tiles — this period vs the one before (7 or 30 days),
   ad vs ad (Meta ads, daily per ad), and angle vs angle (explains what is
   still missing). Data: js/orvAnalytics.js (GET /api/analytics/series).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = window.orvAnalytics; if (!A || window.orvOverviewTiles) return;
  var esc = A.esc, T = A.T, Th = A.Th, L = A.label;
  var TILE_METRICS = ['impressions', 'clicks', 'ctr', 'spend', 'conversions', 'cpc', 'cpa', 'roas'];
  var DETAIL_RANGES = [['LAST_7_DAYS', 'Last 7 days'], ['LAST_30_DAYS', 'Last 30 days'], ['LAST_90_DAYS', 'Last 90 days'], ['THIS_MONTH', 'This month'], ['LAST_MONTH', 'Last month'], ['CUSTOM', 'Custom']]; // labels go through T()
  var S = { gen: 0, detail: null, detailRange: null, detailSince: '', detailUntil: '', cmpMetric: 'spend', cmpLen: 7, adA: '', adB: '', adMetric: 'clicks', ads: null };

  function root() { return document.getElementById('ovtRoot'); }
  function platform() { return window._prfActivePlatform || 'google'; }
  function currency() { return window.orvMetricCurrency || 'EUR'; }
  function rangeWindow() { return A.windowFor(window._prfActiveRange || 'LAST_30_DAYS', window._prfCustomSince, window._prfCustomUntil); }
  // The page's chosen object → series filter + a label.
  function scope() {
    var key = window._prfActiveCampaign || 'all', h = window._prfHierarchy || 'campaigns', p = platform();
    if (key === 'all') return { opts: {}, label: h === 'campaigns' ? T('All campaigns') : T('Whole account') };
    var ents = typeof window._prfActiveEntitiesForTiles === 'function' ? window._prfActiveEntitiesForTiles() : [];
    var e = ents.filter(function (x) { return x.key === key; })[0];
    if (!e) return { opts: {}, label: T('All campaigns') };
    if (h === 'campaigns') return { opts: { campaignId: e.id }, label: e.name };
    if (h === 'ads' && (p === 'meta' || p === 'google')) return { opts: { adId: e.id }, label: e.name };
    return { opts: {}, label: T('Whole account'), note: T(h === 'ads' ? 'Daily figures per ad aren’t available for {p}: the tiles show the whole account.' : 'Daily figures per ad set aren’t available for {p}: the tiles show the whole account.', { p: A.NAME[p] }) };
  }

  // ── Render ────────────────────────────────────────────────────────
  function render() {
    var el = root(); if (!el) return;
    var g = ++S.gen, p = platform(), w = rangeWindow(), sc = scope();
    el.innerHTML = head(p, w, sc) + '<div class="ova-grid" role="list">' + TILE_METRICS.map(function (k) { return tileShell(k); }).join('') + '</div>' +
      '<div class="ova-detail" id="ovtDetail" hidden></div>' +
      '<h3 class="ova-h3">' + esc(T('Compare')) + '</h3><div class="ova-cmp" id="ovtCmp">' + cmpShell() + '</div>';
    A.connections().then(function (conn) {
      if (g !== S.gen) return;
      var c = conn[p] || {};
      if (c.conn !== 'connected') { fillTiles(g, null, { kind: 'not_connected' }); renderCmp(g, conn, null); return; }
      A.seriesWithPrevious(p, w, sc.opts).then(function (d) { if (g === S.gen) { fillTiles(g, d, null); renderCmp(g, conn, d); } }, function (err) { if (g === S.gen) { fillTiles(g, null, err); renderCmp(g, conn, null); } });
    });
    if (S.detail) openDetail(S.detail, true);
  }
  function head(p, w, sc) {
    var replay = document.getElementById('prfReplaySection') ? '<button type="button" class="ova-btn ova-btn--ghost" data-ovt-replay>' + esc(T('Campaign Replay')) + '</button>' : '';
    return '<div class="ova-head"><div><h2 class="ova-h2">' + esc(A.NAME[p]) + ' · ' + esc(sc.label) + '</h2><p class="ova-sub">' + esc(T('{since} – {until}, compared with the {n} days before', { since: A.shortDate(w.since), until: A.shortDate(w.until), n: A.days(w.since, w.until) })) + '</p>' +
      (sc.note ? '<p class="ova-note">' + esc(sc.note) + '</p>' : '') + '</div>' + replay + '</div>';
  }
  function tileShell(k) {
    var n = L(k);
    return '<button type="button" class="ova-tile is-loading" role="listitem" data-ovt-metric="' + k + '" aria-label="' + esc(T('{m}: open the detail chart', { m: n })) + '"><span class="ova-tile__n">' + esc(n) + '</span><span class="ova-tile__v">&nbsp;</span><span class="ova-tile__d">&nbsp;</span><span class="ova-tile__s"></span></button>';
  }
  function fillTiles(g, d, err) {
    var el = root(); if (!el) return;
    var p = platform();
    var cur = d ? A.sum(d.cur, d.valueReported) : null, prev = d && d.prev ? A.sum(d.prev, d.valueReported) : null;
    var any = cur && (cur.impressions || cur.spend || cur.clicks);
    TILE_METRICS.forEach(function (k) {
      var t = el.querySelector('[data-ovt-metric="' + k + '"]'); if (!t) return;
      var m = A.meta(k); t.classList.remove('is-loading');
      if (err) {
        t.classList.add('is-empty');
        t.querySelector('.ova-tile__v').textContent = err.kind === 'not_connected' ? T('Not connected') : T('Unavailable');
        t.querySelector('.ova-tile__d').innerHTML = err.kind === 'not_connected' ? '<span class="ova-link" data-ovt-connect>' + esc(T('Connect {p}', { p: A.NAME[p] })) + '</span>' : esc(T('{p} didn’t return figures right now.', { p: A.NAME[p] }));
        return;
      }
      var v = A.value(cur, k);
      if (!any) { t.classList.add('is-empty'); t.querySelector('.ova-tile__v').textContent = '—'; t.querySelector('.ova-tile__d').textContent = T('No data yet for this period'); t.querySelector('.ova-tile__s').innerHTML = A.sparkline([]); return; }
      if (k === 'roas' && !d.valueReported) { t.classList.add('is-empty'); t.querySelector('.ova-tile__v').textContent = '—'; t.querySelector('.ova-tile__d').textContent = T('Not reported by {p}', { p: A.NAME[p] }); t.querySelector('.ova-tile__s').innerHTML = A.sparkline([]); return; }
      var ch = A.fmtChange(A.change(v, prev ? A.value(prev, k) : null), m.better);
      t.querySelector('.ova-tile__v').textContent = A.fmt(v, m.kind, currency());
      var dEl = t.querySelector('.ova-tile__d'); dEl.textContent = ch.text; dEl.className = 'ova-tile__d ' + ch.cls;
      t.querySelector('.ova-tile__s').innerHTML = A.sparkline(A.dailyValues(d.cur, k));
    });
  }

  // ── Detail chart: one metric, its own period, one line per platform ──
  function openDetail(k, keep) {
    var el = document.getElementById('ovtDetail'); if (!el) return;
    S.detail = k;
    if (!S.detailRange) S.detailRange = window._prfActiveRange && window._prfActiveRange !== 'CUSTOM' && DETAIL_RANGES.some(function (r) { return r[0] === window._prfActiveRange; }) ? window._prfActiveRange : 'LAST_30_DAYS';
    var m = A.meta(k), n = L(k), w = A.windowFor(S.detailRange, S.detailSince, S.detailUntil), g = S.gen;
    root().querySelectorAll('[data-ovt-metric]').forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-ovt-metric') === k); t.setAttribute('aria-expanded', t.getAttribute('data-ovt-metric') === k ? 'true' : 'false'); });
    el.hidden = false;
    el.innerHTML = '<div class="ova-detail__hd"><h3 class="ova-h3">' + esc(T('{m} by platform', { m: n })) + '</h3><div class="ova-ctrls">' +
      '<select class="ova-select" data-ovt-drange aria-label="' + esc(T('Period')) + '">' + DETAIL_RANGES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === S.detailRange ? ' selected' : '') + '>' + esc(T(r[1])) + '</option>'; }).join('') + '</select>' +
      (S.detailRange === 'CUSTOM' ? '<input type="date" class="ova-date" data-ovt-dsince value="' + esc(S.detailSince || w.since) + '" aria-label="' + esc(T('From')) + '"><input type="date" class="ova-date" data-ovt-duntil value="' + esc(S.detailUntil || w.until) + '" aria-label="' + esc(T('To')) + '">' : '') +
      '<button type="button" class="ova-btn ova-btn--ghost" data-ovt-close aria-label="' + esc(T('Close the detail chart')) + '">' + esc(T('Close')) + '</button></div></div><div class="ova-detail__body"><div class="ova-chart is-loading"></div></div>';
    if (!keep) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    A.connections().then(function (conn) {
      var plats = A.PLATFORMS.filter(function (p) { return conn[p] && conn[p].conn === 'connected'; });
      if (!plats.length) { body('<div class="ova-empty">' + esc(T('Connect an ad platform to see {m} over time.', { m: n })) + '</div>'); return; }
      Promise.all(plats.map(function (p) { return A.series(p, w).then(function (d) { return { p: p, d: d }; }, function () { return { p: p, d: null }; }); })).then(function (list) {
        if (g !== S.gen || S.detail !== k) return;
        var labels = []; for (var day = w.since; day <= w.until; day = A.addDays(day, 1)) labels.push(day);
        var lines = list.filter(function (x) { return x.d; }).map(function (x) {
          var by = {}; x.d.series.forEach(function (r) { by[r.date] = r; });
          var valueOk = x.d.conversionValue === 'reported';
          return { name: A.SHORT[x.p], color: A.COLOR[x.p], values: labels.map(function (dt) { var r = by[dt]; return r && (k !== 'roas' || valueOk) ? A.value(r, k) : null; }), total: A.value(A.sum(x.d.series, valueOk), k), p: x.p, valueOk: valueOk };
        });
        var table = '<table class="ova-table"><thead><tr><th scope="col">' + esc(T('Platform')) + '</th><th scope="col">' + esc(T('{m} (period)', { m: n })) + '</th></tr></thead><tbody>' + list.map(function (x) {
          var l = lines.filter(function (y) { return y.p === x.p; })[0];
          return '<tr><th scope="row"><i class="ova-dot" style="--c:' + A.COLOR[x.p] + '"></i>' + esc(A.NAME[x.p]) + '</th><td>' + (l ? (k === 'roas' && !l.valueOk ? esc(T('Not reported')) : esc(A.fmt(l.total, m.kind, currency()))) : esc(T('Unavailable'))) + '</td></tr>';
        }).join('') + '</tbody></table>';
        body(A.lineChart(lines, labels, { kind: m.kind, currency: currency(), label: T('{m} per platform', { m: n }), empty: T('Nothing reported in this period.') }) + table);
      });
    });
    function body(h) { var b = el.querySelector('.ova-detail__body'); if (b) { b.innerHTML = h; A.bindCharts(b); } }
  }
  function closeDetail() { S.detail = null; var el = document.getElementById('ovtDetail'); if (el) { el.hidden = true; el.innerHTML = ''; } root().querySelectorAll('[data-ovt-metric]').forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-expanded', 'false'); }); }

  // ── Comparison tiles ─────────────────────────────────────────────
  function cmpShell() {
    return '<article class="ova-card" id="ovtWeek"><div class="ova-card__hd"><h4>' + esc(T('This period vs the one before')) + '</h4><div class="ova-ctrls"><div class="ova-seg" role="group" aria-label="' + esc(T('Length')) + '"><button type="button" data-ovt-len="7" aria-pressed="' + (S.cmpLen === 7) + '">' + esc(T('{n} days', { n: 7 })) + '</button><button type="button" data-ovt-len="30" aria-pressed="' + (S.cmpLen === 30) + '">' + esc(T('{n} days', { n: 30 })) + '</button></div>' + metricSelect('data-ovt-cmpmetric', S.cmpMetric) + '</div></div><div class="ova-card__body"><div class="ova-chart is-loading"></div></div></article>' +
      '<article class="ova-card" id="ovtAds"><div class="ova-card__hd"><h4>' + esc(T('Ad vs ad')) + '</h4><div class="ova-ctrls" data-ovt-adctrls></div></div><div class="ova-card__body"><div class="ova-chart is-loading"></div></div></article>' +
      '<article class="ova-card" id="ovtAngles"><div class="ova-card__hd"><h4>' + esc(T('Angle vs angle')) + '</h4></div><div class="ova-card__body"><div class="ova-empty"><b>' + esc(T('Not available yet.')) + '</b> ' + esc(T('Comparing creative angles needs the angle saved with every ad OrivenAI publishes. Your Create drafts keep their angles, but published ads don’t carry them yet, so there are no results per angle to compare.')) + '</div></div></article>';
  }
  function metricSelect(attr, cur) {
    return '<select class="ova-select" ' + attr + ' aria-label="' + esc(T('Metric')) + '">' + TILE_METRICS.map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(L(k)) + '</option>'; }).join('') + '</select>';
  }
  function renderCmp(g, conn, d) { renderWeek(g, conn); renderAds(g, conn); }
  function renderWeek(g, conn) {
    var box = document.querySelector('#ovtWeek .ova-card__body'); if (!box) return;
    var p = platform(), sc = scope(), m = A.meta(S.cmpMetric), n = L(S.cmpMetric);
    if (!conn[p] || conn[p].conn !== 'connected') { box.innerHTML = '<div class="ova-empty">' + Th('{link} to compare periods.', { link: '<span class="ova-link" data-ovt-connect>' + esc(T('Connect {p}', { p: A.NAME[p] })) + '</span>' }) + '</div>'; return; }
    var w = { since: A.addDays(A.today(), -(S.cmpLen - 1)), until: A.today() };
    A.seriesWithPrevious(p, w, sc.opts).then(function (d) {
      if (g !== S.gen) return;
      if (!d.prev) { box.innerHTML = '<div class="ova-empty">' + esc(T('No earlier figures to compare with.')) + '</div>'; return; }
      if (S.cmpMetric === 'roas' && !d.valueReported) { box.innerHTML = '<div class="ova-empty">' + esc(T('ROAS isn’t reported by {p}.', { p: A.NAME[p] })) + '</div>'; return; }
      var cur = A.value(A.sum(d.cur, d.valueReported), S.cmpMetric), prev = A.value(A.sum(d.prev, d.valueReported), S.cmpMetric), ch = A.fmtChange(A.change(cur, prev), m.better);
      var labels = d.cur.map(function (r) { return r.date; }), lastN = T('Last {n} days', { n: S.cmpLen }), beforeN = T('The {n} days before', { n: S.cmpLen });
      box.innerHTML = '<div class="ova-kpis"><div><span>' + esc(lastN) + '</span><b>' + esc(A.fmt(cur, m.kind, currency())) + '</b></div><div><span>' + esc(beforeN) + '</span><b>' + esc(A.fmt(prev, m.kind, currency())) + '</b></div><div><span>' + esc(T('Change')) + '</span><b class="' + ch.cls + '">' + esc(ch.short) + '</b></div></div>' +
        A.lineChart([{ name: lastN, color: A.COLOR[p], values: A.dailyValues(d.cur, S.cmpMetric) }, { name: beforeN, color: 'rgba(242,242,240,.45)', dashed: true, values: A.dailyValues(d.prev, S.cmpMetric) }], labels, { kind: m.kind, currency: currency(), height: 180, label: T('{m}: this period vs the one before', { m: n }) });
      A.bindCharts(box);
    }, function () { if (g === S.gen) box.innerHTML = '<div class="ova-empty">' + esc(T('{p} didn’t return figures right now.', { p: A.NAME[p] })) + '</div>'; });
  }
  function renderAds(g, conn) {
    var box = document.querySelector('#ovtAds .ova-card__body'), ctrls = document.querySelector('[data-ovt-adctrls]'); if (!box) return;
    if (!conn.meta || conn.meta.conn !== 'connected') { ctrls.innerHTML = ''; box.innerHTML = '<div class="ova-empty">' + Th('{link} to compare ads. Daily figures per ad come from Meta Ads (and Google Ads).', { link: '<span class="ova-link" data-ovt-connect>' + esc(T('Connect {p}', { p: 'Meta Ads' })) + '</span>' }) + '</div>'; return; }
    var load = S.ads ? Promise.resolve(S.ads) : window.apiFetch('/api/meta/ads?date_range=LAST_30_DAYS').then(function (r) { S.ads = (r && r.ok && r.data && r.data.ads) || []; return S.ads; }, function () { return []; });
    load.then(function (ads) {
      if (g !== S.gen) return;
      ads = ads.filter(function (a) { return a && a.ad_id; });
      if (ads.length < 2) { ctrls.innerHTML = ''; box.innerHTML = '<div class="ova-empty">' + esc(T('You need at least two Meta ads to compare.')) + '</div>'; return; }
      if (!S.adA || !ads.some(function (a) { return String(a.ad_id) === S.adA; })) S.adA = String(ads[0].ad_id);
      if (!S.adB || S.adB === S.adA || !ads.some(function (a) { return String(a.ad_id) === S.adB; })) S.adB = String((ads.filter(function (a) { return String(a.ad_id) !== S.adA; })[0] || ads[1]).ad_id);
      var opt = function (sel) { return ads.map(function (a) { return '<option value="' + esc(a.ad_id) + '"' + (String(a.ad_id) === sel ? ' selected' : '') + '>' + esc(a.ad_name || a.ad_id) + '</option>'; }).join(''); };
      ctrls.innerHTML = '<select class="ova-select" data-ovt-ada aria-label="' + esc(T('First ad')) + '">' + opt(S.adA) + '</select><select class="ova-select" data-ovt-adb aria-label="' + esc(T('Second ad')) + '">' + opt(S.adB) + '</select>' + metricSelect('data-ovt-admetric', S.adMetric);
      var w = { since: A.addDays(A.today(), -29), until: A.today() }, m = A.meta(S.adMetric), n = L(S.adMetric), name = function (id) { var a = ads.filter(function (x) { return String(x.ad_id) === id; })[0]; return a ? (a.ad_name || id) : id; };
      Promise.all([A.series('meta', w, { adId: S.adA }), A.series('meta', w, { adId: S.adB })]).then(function (r) {
        if (g !== S.gen) return;
        var labels = r[0].series.map(function (x) { return x.date; });
        var ta = A.value(A.sum(r[0].series, true), S.adMetric), tb = A.value(A.sum(r[1].series, true), S.adMetric);
        var better = m.better === 'hi' ? (ta > tb ? 'a' : tb > ta ? 'b' : null) : m.better === 'lo' ? (ta != null && tb != null ? (ta < tb ? 'a' : tb < ta ? 'b' : null) : null) : null;
        box.innerHTML = '<div class="ova-kpis"><div class="' + (better === 'a' ? 'is-best' : '') + '"><span>' + esc(name(S.adA)) + '</span><b>' + esc(A.fmt(ta, m.kind, currency())) + '</b></div><div class="' + (better === 'b' ? 'is-best' : '') + '"><span>' + esc(name(S.adB)) + '</span><b>' + esc(A.fmt(tb, m.kind, currency())) + '</b></div><div><span>' + esc(T('Period')) + '</span><b>' + esc(T('Last 30 days')) + '</b></div></div>' +
          A.lineChart([{ name: name(S.adA), color: A.COLOR.meta, values: A.dailyValues(r[0].series, S.adMetric) }, { name: name(S.adB), color: '#3DD6D0', values: A.dailyValues(r[1].series, S.adMetric) }], labels, { kind: m.kind, currency: currency(), height: 180, label: T('{m}: ad vs ad', { m: n }) });
        A.bindCharts(box);
      }, function () { if (g === S.gen) box.innerHTML = '<div class="ova-empty">' + esc(T('Meta Ads didn’t return figures for these ads right now.')) + '</div>'; });
    });
  }

  // ── Events ───────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var r = root(); if (!r || !r.contains(e.target)) return;
    var t = e.target.closest('[data-ovt-metric]'); if (t) { var k = t.getAttribute('data-ovt-metric'); if (S.detail === k) closeDetail(); else openDetail(k); return; }
    if (e.target.closest('[data-ovt-close]')) { closeDetail(); return; }
    if (e.target.closest('[data-ovt-connect]')) { e.preventDefault(); if (typeof window.bizGoTo === 'function') window.bizGoTo('connections'); else if (window.orvAppNav) window.orvAppNav.go('platforms'); return; }
    if (e.target.closest('[data-ovt-replay]')) { if (typeof window._prfToggleReplay === 'function') window._prfToggleReplay(); return; }
    var len = e.target.closest('[data-ovt-len]'); if (len) { S.cmpLen = +len.getAttribute('data-ovt-len'); document.querySelectorAll('[data-ovt-len]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-ovt-len') === S.cmpLen)); }); A.connections().then(function (c) { renderWeek(S.gen, c); }); }
  });
  document.addEventListener('change', function (e) {
    var r = root(); if (!r || !r.contains(e.target)) return;
    var el = e.target;
    if (el.matches('[data-ovt-drange]')) { S.detailRange = el.value; if (el.value !== 'CUSTOM') { S.detailSince = S.detailUntil = ''; } openDetail(S.detail, true); }
    else if (el.matches('[data-ovt-dsince]') || el.matches('[data-ovt-duntil]')) { var s = r.querySelector('[data-ovt-dsince]'), u = r.querySelector('[data-ovt-duntil]'); if (s.value && u.value) { S.detailSince = s.value; S.detailUntil = u.value; openDetail(S.detail, true); } }
    else if (el.matches('[data-ovt-cmpmetric]')) { S.cmpMetric = el.value; A.connections().then(function (c) { renderWeek(S.gen, c); }); }
    else if (el.matches('[data-ovt-ada]')) { S.adA = el.value; A.connections().then(function (c) { renderAds(S.gen, c); }); }
    else if (el.matches('[data-ovt-adb]')) { S.adB = el.value; A.connections().then(function (c) { renderAds(S.gen, c); }); }
    else if (el.matches('[data-ovt-admetric]')) { S.adMetric = el.value; A.connections().then(function (c) { renderAds(S.gen, c); }); }
  });

  // Re-render when the page's own platform / object / period controls change.
  var pending = null;
  function schedule() { clearTimeout(pending); pending = setTimeout(function () { if (isShown()) render(); }, 60); }
  function isShown() { var pg = document.getElementById('page-performance'); return !!(pg && pg.classList.contains('active') && root()); }
  function wrap(name) {
    var f = window[name]; if (typeof f !== 'function' || f._ovt) return;
    var w = function () { var out = f.apply(this, arguments); schedule(); return out; }; w._ovt = true; window[name] = w;
  }
  function init() {
    var pg = document.getElementById('page-performance'); if (!pg) return;
    var wrapEl = document.getElementById('prfChartWrap');
    if (!root() && wrapEl) { var d = document.createElement('section'); d.className = 'ova'; d.id = 'ovtRoot'; d.setAttribute('aria-label', T('Performance')); wrapEl.insertBefore(d, wrapEl.firstChild); }
    ['prfSwitchPlatform', 'prfSwitchCampaign', 'prfSetRange', 'prfApplyCustomRange', 'prfSwitchHierarchy'].forEach(wrap);
    new MutationObserver(function () { if (pg.classList.contains('active')) schedule(); }).observe(pg, { attributes: true, attributeFilter: ['class'] });
    if (pg.classList.contains('active')) schedule();
    // A language change redraws the tiles in the new language.
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._ovt) {
      var orig = window.applyLanguage;
      window.applyLanguage = function () { var r = orig.apply(this, arguments); try { if (isShown()) render(); } catch (_) {} return r; };
      window.applyLanguage._ovt = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { setTimeout(init, 0); });
  window.orvOverviewTiles = { render: render, openDetail: openDetail, closeDetail: closeDetail };
})();
