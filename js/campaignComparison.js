/* ════════════════════════════════════════════════════════════════
   Campaigns → Campaign Comparison (#page-campaign-comparison)

   Compare campaigns side by side on the figures the ad platforms report —
   read through the same endpoints and parsing as Campaign Overview
   (window.orvCampaignSources, app.html), for the period you choose.
   Derived metrics (CTR, CPC, CPM, conversion rate, CPA, ROAS) are computed
   only from reported figures; anything not reported shows as "Not
   reported", never as 0 or an estimate. Money is only compared within one
   currency. An AI explanation (paid) uses exactly the figures shown and is
   saved, so it can be revisited.
   window.orvCampaignComparison.open()
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit; if (!K) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-campaign-comparison', ROOT = 'ccmRoot';
  var RANGES = [['LAST_30_DAYS', 'Last 30 days'], ['LAST_90_DAYS', 'Last 90 days'], ['LAST_12_MONTHS', 'Last 12 months'], ['LIFETIME', 'Lifetime'], ['CUSTOM', 'Custom period']];
  var PLAT = { google: 'Google', meta: 'Meta', tiktok: 'TikTok', pinterest: 'Pinterest', snapchat: 'Snapchat' };
  // [key, label, kind ('n' number, '%', 'm' money, 'x' ratio), better ('hi'|'lo')]
  var METRICS = [['impressions', 'Impressions', 'n', 'hi'], ['reach', 'Reach', 'n', 'hi'], ['clicks', 'Clicks', 'n', 'hi'], ['ctr', 'CTR', '%', 'hi'], ['cpc', 'CPC', 'm', 'lo'], ['cpm', 'CPM', 'm', 'lo'],
    ['conversions', 'Conversions', 'n', 'hi'], ['conversionRate', 'Conversion rate', '%', 'hi'], ['cpa', 'CPA', 'm', 'lo'], ['roas', 'ROAS', 'x', 'hi'], ['spend', 'Ad spend', 'm', null]];
  var SMALL_SAMPLE = 1000; // impressions under which differences may be chance
  var S = { uid: null, range: 'LAST_30_DAYS', since: '', until: '', conn: null, rows: null, loadErr: {}, sel: {}, busy: false, insight: null, msg: null, saved: null, viewing: null };

  function open() {
    if (!K.mount(PAGE, ROOT, onClick)) return;
    if (K.uid() !== S.uid) S = { uid: K.uid(), range: 'LAST_30_DAYS', since: '', until: '', conn: null, rows: null, loadErr: {}, sel: {}, busy: false, insight: null, msg: null, saved: null, viewing: null };
    K.show('compare', PAGE);
    render(); start();
  }
  function src() { return window.orvCampaignSources || null; }
  function start() {
    var C = src();
    if (!C) { S.conn = {}; S.rows = []; render(); return; }
    S.conn = null; render();
    Promise.all(C.platforms.map(function (p) { return C.status(p).then(function (s) { return [p, s]; }); })).then(function (list) {
      S.conn = {}; list.forEach(function (x) { S.conn[x[0]] = x[1]; });
      loadRows();
    });
    loadSaved();
  }
  function connected() { return Object.keys(S.conn || {}).filter(function (p) { return S.conn[p] && S.conn[p].conn === 'connected'; }); }
  function rangeObj() { return { key: S.range, since: S.since, until: S.until, label: (RANGES.filter(function (r) { return r[0] === S.range; })[0] || [0, ''])[1] + (S.range === 'CUSTOM' && S.since ? ' (' + S.since + ' – ' + S.until + ')' : '') }; }
  function loadRows() {
    var C = src(), plats = connected();
    S.rows = null; S.loadErr = {}; S.insight = null; render();
    if (!plats.length) { S.rows = []; render(); return; }
    var range = rangeObj();
    Promise.all(plats.map(function (p) {
      return C.load(p, range, (S.conn[p] || {}).currency).then(function (out) { return out; }, function (err) { S.loadErr[p] = (err && err.kind) || 'unavailable'; return { rows: [] }; });
    })).then(function (outs) {
      var all = [];
      outs.forEach(function (o) { (o.rows || []).forEach(function (r) { all.push(r); }); });
      S.rows = all;
      Object.keys(S.sel).forEach(function (k) { if (!all.some(function (r) { return r.key === k; })) delete S.sel[k]; });
      render();
    });
  }
  function loadSaved() { api('/api/campaigns/compare/saved').then(function (r) { S.saved = r.ok && r.data ? r.data.comparisons || [] : []; render(); }); }

  // ── Figures ───────────────────────────────────────────────────────
  var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
  // The compared metrics of one platform row: reported figures, plus ratios
  // computed only from reported figures (null when an input is missing).
  function metricsOf(r) {
    var impr = num(r.impressions), clicks = num(r.clicks), spend = num(r.spend), conv = num(r.conv), val = num(r.convVal);
    return {
      impressions: impr, reach: num(r.reach), clicks: clicks, spend: spend, conversions: conv,
      ctr: impr && clicks != null ? clicks / impr * 100 : null,
      cpc: clicks && spend != null ? spend / clicks : null,
      cpm: num(r.cpm) != null ? num(r.cpm) : (impr && spend != null ? spend / impr * 1000 : null),
      conversionRate: clicks && conv != null ? conv / clicks * 100 : null,
      cpa: conv && spend != null ? spend / conv : null,
      roas: spend && val != null ? val / spend : null,
    };
  }
  function comparable(r) { return r.metricsLevel === 'campaign'; }
  function hasData(m) { return (m.impressions || 0) > 0 || (m.clicks || 0) > 0 || (m.spend || 0) > 0; }
  function fmt(v, kind, cur) {
    if (v == null) return '<span class="rx-muted" title="The platform didn’t report this for this campaign">Not reported</span>';
    if (kind === '%') return v.toFixed(2) + '%';
    if (kind === 'x') return v.toFixed(2) + '×';
    if (kind === 'm') return typeof window.orvFormatMoney === 'function' && cur ? window.orvFormatMoney(v, cur) : (cur ? cur + ' ' : '') + v.toFixed(2);
    return Math.round(v).toLocaleString();
  }

  // ── Rendering ─────────────────────────────────────────────────────
  function render() {
    var el = document.getElementById(ROOT); if (!el) return;
    if (S.viewing) { el.innerHTML = savedView(S.viewing); return; }
    var head = K.head('Campaigns', 'Campaign Comparison', 'Compare your campaigns side by side on the figures your ad platforms report, and see where they differ.');
    if (S.conn === null) { el.innerHTML = head + '<p class="rx-muted gx-loading">Checking your ad platforms…</p>' + savedBlock(); return; }
    if (!connected().length) {
      el.innerHTML = head + '<section class="rx-card gx-empty"><h2 class="rx-h2">Connect an ad platform first</h2><p class="rx-muted">Campaign Comparison uses your real campaign results. Connect Meta, Google, TikTok or Pinterest, run a campaign, and compare it here.</p><button type="button" class="rx-btn rx-btn-primary" data-ccm-page="ad-platforms">Open Ad Platforms</button></section>' + savedBlock();
      return;
    }
    var rows = S.rows || [];
    var picked = rows.filter(function (r) { return S.sel[r.key]; });
    el.innerHTML = head
      + '<div class="gx-row gx-row--wrap gx-bar"><label class="rx-lbl gx-inline">Period<select class="rx-input" id="ccmRange">' + RANGES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === S.range ? ' selected' : '') + '>' + esc(r[1]) + '</option>'; }).join('') + '</select></label>'
      + (S.range === 'CUSTOM' ? '<label class="rx-lbl gx-inline">From<input class="rx-input" type="date" id="ccmSince" value="' + esc(S.since) + '"></label><label class="rx-lbl gx-inline">To<input class="rx-input" type="date" id="ccmUntil" value="' + esc(S.until) + '"></label><button type="button" class="rx-btn" data-ccm-apply>Apply</button>' : '')
      + '</div>'
      + Object.keys(S.loadErr).map(function (p) { return '<p class="rx-warn">' + esc(PLAT[p] || p) + ' couldn’t be read right now (' + esc(S.loadErr[p]) + '). Its campaigns are missing from the list.</p>'; }).join('')
      + '<div class="gx-cols gx-cols--cmp"><section class="rx-card gx-card" aria-labelledby="ccmPickH"><h2 class="rx-h2" id="ccmPickH">Campaigns</h2>'
      + (S.rows === null ? '<p class="rx-muted gx-loading">Loading campaign results…</p>' : rows.length ? picker(rows) : '<p class="rx-muted">No campaigns found in this period on your connected platforms.</p>')
      + '</section><section class="gx-cmp" aria-labelledby="ccmCmpH"><h2 class="rx-h2" id="ccmCmpH">Comparison</h2>' + compare(picked) + '</section></div>'
      + savedBlock();
  }
  function picker(rows) {
    var by = {}; rows.forEach(function (r) { (by[r.platform] = by[r.platform] || []).push(r); });
    return Object.keys(by).map(function (p) {
      var accountOnly = by[p].every(function (r) { return r.metricsLevel === 'account'; }), noMetrics = by[p].every(function (r) { return r.metricsLevel === 'none'; });
      return '<div class="gx-pgroup"><p class="gx-sub">' + esc(PLAT[p] || p) + '</p>'
        + (accountOnly ? '<p class="rx-muted gx-fine">Pinterest reports results for the whole ad account only, so its campaigns can’t be compared one by one.</p>' : '')
        + (noMetrics ? '<p class="rx-muted gx-fine">This platform didn’t return campaign results for this period.</p>' : '')
        + '<ul class="gx-plist">' + by[p].map(function (r) {
          var ok = comparable(r), m = metricsOf(r);
          return '<li><label class="gx-check' + (ok ? '' : ' is-off') + '"><input type="checkbox" data-ccm-sel="' + esc(r.key) + '"' + (S.sel[r.key] ? ' checked' : '') + (ok ? '' : ' disabled') + '> <span>' + esc(r.name || 'Unnamed campaign') + '</span></label>'
            + '<span class="rx-muted gx-plist__m">' + (ok ? (hasData(m) ? fmt(m.impressions, 'n') + ' impressions' : 'no activity in this period') : '—') + '</span></li>';
        }).join('') + '</ul></div>';
    }).join('');
  }
  function compare(picked) {
    if (picked.length < 2) return '<p class="rx-muted">Choose at least two campaigns to compare.</p>';
    var cols = picked.map(function (r) { return { r: r, m: metricsOf(r), cur: r.currency || null }; });
    var withData = cols.filter(function (c) { return hasData(c.m); });
    var curs = Array.from(new Set(cols.map(function (c) { return c.cur; }).filter(Boolean)));
    var notes = [];
    if (withData.length < 2) notes.push('There isn’t enough data for a meaningful comparison: at least two of these campaigns need impressions, clicks or spend in this period.');
    var small = cols.filter(function (c) { return hasData(c.m) && (c.m.impressions || 0) < SMALL_SAMPLE; });
    if (small.length) notes.push(small.map(function (c) { return c.r.name; }).join(', ') + (small.length === 1 ? ' has' : ' have') + ' fewer than ' + SMALL_SAMPLE.toLocaleString() + ' impressions — differences may be chance.');
    if (curs.length > 1) notes.push('These campaigns use different currencies (' + curs.join(', ') + '), so money figures aren’t compared with each other.');
    var best = {};
    METRICS.forEach(function (mt) {
      if (!mt[3]) return;
      var vals = cols.map(function (c, i) { return { i: i, v: c.m[mt[0]] }; }).filter(function (x) { return x.v != null; });
      if (vals.length < 2 || (mt[2] === 'm' && curs.length > 1)) return;
      vals.sort(function (a, b) { return mt[3] === 'hi' ? b.v - a.v : a.v - b.v; });
      if (vals[0].v !== vals[1].v) best[mt[0]] = vals[0].i;
    });
    var table = '<div class="rx-table-wrap"><table class="rx-table gx-table"><thead><tr><th scope="col">Metric</th>' + cols.map(function (c) { return '<th scope="col">' + esc(c.r.name) + '<span class="rx-muted gx-th">' + esc(PLAT[c.r.platform] || c.r.platform) + (c.cur ? ' · ' + esc(c.cur) : '') + '</span></th>'; }).join('') + '</tr></thead><tbody>'
      + METRICS.map(function (mt) {
        return '<tr><th scope="row">' + esc(mt[1]) + '</th>' + cols.map(function (c, i) { return '<td class="' + (best[mt[0]] === i ? 'gx-best' : '') + '">' + fmt(c.m[mt[0]], mt[2], c.cur) + (best[mt[0]] === i ? ' <span class="gx-best__t">best</span>' : '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    var diffs = diffList(cols, best, curs.length > 1);
    return (notes.length ? '<div class="rx-warn gx-notes">' + notes.map(function (n) { return '<p>' + esc(n) + '</p>'; }).join('') + '</div>' : '')
      + table
      + (diffs ? '<h3 class="rx-h3">Biggest differences</h3><ul class="gx-diffs">' + diffs + '</ul>' : '')
      + insightBlock(withData.length >= 2, cols);
  }
  // Where the best campaign leads the others by the most (relative), per metric.
  function diffList(cols, best, mixed) {
    var out = [];
    METRICS.forEach(function (mt) {
      var bi = best[mt[0]]; if (bi == null) return;
      var b = cols[bi].m[mt[0]];
      cols.forEach(function (c, i) {
        var v = c.m[mt[0]]; if (i === bi || v == null || !v) return;
        if (mt[2] === 'm' && mixed) return;
        var rel = mt[3] === 'hi' ? (b - v) / v : (v - b) / v;
        if (rel >= 0.15) out.push({ rel: rel, t: cols[bi].r.name + ': ' + mt[1] + ' ' + fmt(b, mt[2], cols[bi].cur).replace(/<[^>]+>/g, '') + ' vs ' + fmt(v, mt[2], c.cur).replace(/<[^>]+>/g, '') + ' for ' + c.r.name });
      });
    });
    out.sort(function (a, b) { return b.rel - a.rel; });
    return out.slice(0, 5).map(function (d) { return '<li>' + esc(d.t) + '</li>'; }).join('');
  }
  function insightBlock(enough, cols) {
    if (S.insight) return insightHtml(S.insight.insight, 'Explained from the figures above · saved');
    return '<div class="rx-card gx-ai"><h3 class="rx-h3">Explain the differences</h3><p class="rx-muted">OrivenAI explains what the figures show and what to test next — using only the numbers above.</p>'
      + (S.msg ? '<p class="rx-err" role="alert">' + esc(S.msg) + '</p>' : '')
      + '<div class="gx-row"><button type="button" class="rx-btn rx-btn-primary" data-ccm-explain' + (!enough || S.busy ? ' disabled' : '') + '>' + (S.busy ? '<span class="gx-spin" aria-hidden="true"></span> Explaining…' : 'Explain with AI') + '</button><span class="rx-cost">' + K.cost('intelligence', 45) + ' credits</span></div>'
      + (!enough ? '<p class="rx-muted gx-fine">Available when at least two campaigns have data in this period.</p>' : '') + '</div>';
  }
  function insightHtml(x, tag) {
    var list = function (t, l) { return (l || []).length ? '<h4>' + esc(t) + '</h4><ul class="rx-bul">' + l.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : ''; };
    return '<div class="rx-card gx-ai"><div class="gx-comp__h"><h3 class="rx-h3">What the figures show</h3>' + K.basis('analysis') + '</div><p class="rx-muted gx-fine">' + esc(tag) + '</p><p>' + esc(x.summary) + '</p>'
      + list('Differences', x.differences) + list('Trends', x.trends) + list('What to test next', x.recommendations) + list('What the data can’t show', x.caveats) + '</div>';
  }
  function savedBlock() {
    var s = S.saved;
    if (!s || !s.length) return '';
    return '<section class="gx-sec"><h2 class="rx-h2">Saved comparisons</h2><ul class="gx-saved">' + s.map(function (c) {
      return '<li class="gx-saved__row"><button type="button" class="gx-saved__i" data-ccm-view="' + esc(c.id) + '"><b>' + esc(c.title || 'Comparison') + '</b><span class="rx-muted">' + esc((c.range && c.range.label) || '') + ' · ' + esc(K.day(c.savedAt || c.generatedAt)) + '</span></button><button type="button" class="rx-btn rx-btn-ghost" data-ccm-del="' + esc(c.id) + '">Remove</button></li>';
    }).join('') + '</ul></section>';
  }
  function savedView(c) {
    var cols = (c.campaigns || []).map(function (x) { return { r: { name: x.name, platform: x.platform }, m: x.metrics || {}, cur: x.currency || null }; });
    var table = '<div class="rx-table-wrap"><table class="rx-table gx-table"><thead><tr><th scope="col">Metric</th>' + cols.map(function (x) { return '<th scope="col">' + esc(x.r.name) + '<span class="rx-muted gx-th">' + esc(PLAT[x.r.platform] || x.r.platform) + (x.cur ? ' · ' + esc(x.cur) : '') + '</span></th>'; }).join('') + '</tr></thead><tbody>'
      + METRICS.map(function (mt) { return '<tr><th scope="row">' + esc(mt[1]) + '</th>' + cols.map(function (x) { return '<td>' + fmt(x.m[mt[0]], mt[2], x.cur) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    return '<button type="button" class="rx-back" data-ccm-back>← Campaign Comparison</button>'
      + K.head('Saved comparison', c.title || 'Comparison', 'Figures as reported for ' + ((c.range && c.range.label) || 'the chosen period') + ', saved on ' + K.day(c.savedAt || c.generatedAt) + '. Open Campaign Comparison for today’s figures.')
      + table + (c.insight ? insightHtml(c.insight, 'Explained from these figures') : '');
  }

  // ── Actions ───────────────────────────────────────────────────────
  function explain(btn) {
    var picked = (S.rows || []).filter(function (r) { return S.sel[r.key]; });
    S.busy = true; S.msg = null; render();
    var body = { range: rangeObj(), campaigns: picked.map(function (r) { return { platform: r.platform, id: r.id, name: r.name, status: r.status, currency: r.currency || null, metrics: metricsOf(r) }; }) };
    api('/api/campaigns/compare/insight', 'POST', body).then(function (r) {
      S.busy = false;
      if (r.ok && r.data && r.data.comparison) { S.insight = r.data.comparison; if (typeof window.consumeUsage === 'function') window.consumeUsage(K.cost('intelligence', 45)); loadSaved(); render(); return; }
      S.msg = K.refused(r, 'create'); render();
    });
  }
  function onClick(e) {
    var b = e.target.closest('button, input[data-ccm-sel]'); if (!b) return;
    if (b.matches('[data-ccm-sel]')) { S.sel[b.getAttribute('data-ccm-sel')] = b.checked; S.insight = null; S.msg = null; render(); return; }
    if (b.hasAttribute('data-ccm-explain')) { explain(b); return; }
    if (b.hasAttribute('data-ccm-apply')) { S.since = (document.getElementById('ccmSince') || {}).value || ''; S.until = (document.getElementById('ccmUntil') || {}).value || ''; if (S.since && S.until) loadRows(); return; }
    if (b.hasAttribute('data-ccm-page')) { if (window.orvPages) window.orvPages.open(b.getAttribute('data-ccm-page')); return; }
    if (b.hasAttribute('data-ccm-view')) { var id = b.getAttribute('data-ccm-view'); S.viewing = (S.saved || []).filter(function (c) { return c.id === id; })[0] || null; render(); return; }
    if (b.hasAttribute('data-ccm-back')) { S.viewing = null; render(); return; }
    if (b.hasAttribute('data-ccm-del')) { api('/api/campaigns/compare/' + encodeURIComponent(b.getAttribute('data-ccm-del')), 'DELETE').then(function () { loadSaved(); }); return; }
  }
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'ccmRange') { S.range = e.target.value; if (S.range !== 'CUSTOM') loadRows(); else render(); }
  });
  window.orvCampaignComparison = { open: open, reload: start, _metricsOf: metricsOf };
})();
