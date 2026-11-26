/* ════════════════════════════════════════════════════════════════
   orvAnalytics — the shared data + chart layer of Campaign Overview's metric
   tiles (js/overviewTiles.js) and Platform Comparison (js/campaignComparison.js).

   Data: GET /api/analytics/series (backend routes/analyticsSeries.js), daily
   figures for one platform over an exact window, optionally one campaign or
   (Google/Meta) one ad. Every metric is computed from those reported
   figures: CTR, CPC, CPA, ROAS and "return per €1" only when their inputs
   exist (ROAS only where the platform reports a conversion value); never an
   estimate, never 0 for "not reported".

   Charts: small inline SVG (sparkline, line chart with hover, paired bars).
   Colours: one per platform (fixed order, never cycled); Electric Lime is
   kept for "best value", never a series colour.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.orvAnalytics) return;
  var PLATFORMS = ['google', 'meta', 'tiktok', 'pinterest', 'snapchat'];
  var NAME = { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads', snapchat: 'Snapchat Ads' };
  var SHORT = { google: 'Google', meta: 'Meta', tiktok: 'TikTok', pinterest: 'Pinterest', snapchat: 'Snapchat' };
  var COLOR = { google: '#5B9BFF', meta: '#B49BFF', tiktok: '#3DD6D0', pinterest: '#FF7A7A', snapchat: '#F2D94E' };
  // [key, label, kind ('n' count, '%', 'm' money, 'x' multiple), better ('hi'|'lo'|null)]
  var METRICS = [
    ['impressions', 'Impressions', 'n', 'hi'], ['clicks', 'Clicks', 'n', 'hi'], ['ctr', 'CTR', '%', 'hi'], ['spend', 'Spend', 'm', null],
    ['conversions', 'Conversions', 'n', 'hi'], ['cpc', 'CPC', 'm', 'lo'], ['cpa', 'CPA', 'm', 'lo'], ['roas', 'ROAS', 'x', 'hi'],
  ];
  var DAY = 864e5;
  function ymd(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function days(since, until) { return Math.round((Date.parse(until + 'T12:00:00') - Date.parse(since + 'T12:00:00')) / DAY) + 1; }
  function today() { return ymd(new Date()); }
  // Translation (js/analyticsI18n.js, keyed by the English text); {x} filled from vars.
  function lang() { return typeof CURRENT_LANG === 'string' ? CURRENT_LANG : 'en'; }
  function tpl(s) { var L = window.ORV_ANALYTICS_I18N, l = lang(); return (L && L[l] && L[l][s]) || s; }
  function T(s, vars) { return vars ? tpl(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : tpl(s); }
  // HTML version: the sentence is escaped, the vars are inserted as given (already safe HTML).
  function Th(s, vars) { return esc(tpl(s)).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; }); }
  // A metric's name in the app's language (the Campaigns cmpM_* names), else English.
  function label(k) { var key = 'cmpM_' + k; if (lang() !== 'en' && typeof window.t === 'function') { var v = window.t(key); if (v && v !== key) return v; } return T(meta(k).label); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── Windows ──────────────────────────────────────────────────────
  // A range key (Campaign Overview's selector, Platform Comparison's presets)
  // → { since, until }, both inclusive, never after today.
  function windowFor(key, customSince, customUntil) {
    var t = today(), d = new Date(t + 'T12:00:00');
    switch (key) {
      case 'TODAY': return { since: t, until: t };
      case 'YESTERDAY': return { since: addDays(t, -1), until: addDays(t, -1) };
      case 'LAST_7_DAYS': return { since: addDays(t, -6), until: t };
      case 'LAST_90_DAYS': return { since: addDays(t, -89), until: t };
      case 'THIS_WEEK': { var dow = (d.getDay() + 6) % 7; return { since: addDays(t, -dow), until: t }; }
      case 'LAST_WEEK': { var dw = (d.getDay() + 6) % 7, mon = addDays(t, -dw - 7); return { since: mon, until: addDays(mon, 6) }; }
      case 'THIS_MONTH': return { since: t.slice(0, 8) + '01', until: t };
      case 'LAST_MONTH': { var f = new Date(d.getFullYear(), d.getMonth(), 1); f.setDate(0); var l = ymd(f); return { since: l.slice(0, 8) + '01', until: l }; }
      case 'LAST_12_MONTHS': return { since: addDays(t, -364), until: t };
      case 'LIFETIME': return { since: addDays(t, -399), until: t };
      case 'CUSTOM': if (/^\d{4}-\d{2}-\d{2}$/.test(customSince || '') && /^\d{4}-\d{2}-\d{2}$/.test(customUntil || '')) return customSince <= customUntil ? { since: customSince, until: customUntil > t ? t : customUntil } : { since: customUntil, until: customSince };
        return { since: addDays(t, -29), until: t };
      default: return { since: addDays(t, -29), until: t };
    }
  }
  // The window of the same length right before (for "vs previous period").
  function previous(w) { var n = days(w.since, w.until); return { since: addDays(w.since, -n), until: addDays(w.since, -1) }; }

  // ── Data ─────────────────────────────────────────────────────────
  var cache = {};
  function apiGet(p) {
    if (typeof window.apiFetch !== 'function') return Promise.reject({ kind: 'unavailable' });
    return window.apiFetch(p).then(function (r) {
      if (r && r.ok && r.data) return r.data;
      return Promise.reject({ kind: r && (r.status === 401 || r.status === 403 || r.status === 404 || r.status === 409) ? 'not_connected' : r && r.status === 422 ? 'unsupported' : 'unavailable', status: r && r.status, message: r && r.data && r.data.error });
    });
  }
  // Daily series for [since, until]; opts: { campaignId, adId }.
  function series(platform, w, opts) {
    opts = opts || {};
    var q = 'platform=' + platform + '&since=' + w.since + '&until=' + w.until + (opts.campaignId ? '&campaignId=' + encodeURIComponent(opts.campaignId) : '') + (opts.adId ? '&adId=' + encodeURIComponent(opts.adId) : '');
    if (!cache[q]) { cache[q] = apiGet('/api/analytics/series?' + q); cache[q].catch(function () { delete cache[q]; }); }
    return cache[q];
  }
  // Current + previous window in ONE request (≤ 400 days together), split here.
  function seriesWithPrevious(platform, w, opts) {
    var p = previous(w), whole = { since: p.since, until: w.until };
    if (days(whole.since, whole.until) > 400) return series(platform, w, opts).then(function (d) { return { cur: d.series, prev: null, valueReported: d.conversionValue === 'reported', clamped: d.clamped }; });
    return series(platform, whole, opts).then(function (d) {
      var cur = [], prev = [];
      d.series.forEach(function (r) { (r.date >= w.since ? cur : prev).push(r); });
      return { cur: cur, prev: d.clamped && d.since > p.since ? null : prev, valueReported: d.conversionValue === 'reported', clamped: d.clamped };
    });
  }
  // Connection state per platform, through Campaign Overview's own source.
  var statusCache = null;
  function connections(force) {
    if (statusCache && !force) return statusCache;
    var C = window.orvCampaignSources;
    statusCache = Promise.all(PLATFORMS.map(function (p) {
      if (!C) return [p, { conn: 'unavailable' }];
      return C.status(p).then(function (s) { return [p, s]; }, function () { return [p, { conn: 'unavailable' }]; });
    })).then(function (list) { var o = {}; list.forEach(function (x) { o[x[0]] = x[1]; }); return o; });
    statusCache.catch(function () { statusCache = null; });
    return statusCache;
  }
  function reset() { cache = {}; statusCache = null; }

  // ── Metrics ──────────────────────────────────────────────────────
  function sum(rows, valueReported) {
    var t = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: valueReported ? 0 : null, days: (rows || []).length };
    (rows || []).forEach(function (r) { t.spend += +r.spend || 0; t.impressions += +r.impressions || 0; t.clicks += +r.clicks || 0; t.conversions += +r.conversions || 0; if (valueReported) t.conversionValue += +r.conversionValue || 0; });
    return t;
  }
  // One metric from totals (or one day's row); null = not computable.
  function value(t, key) {
    if (!t) return null;
    switch (key) {
      case 'impressions': case 'clicks': case 'spend': case 'conversions': return t[key];
      case 'ctr': return t.impressions ? (t.clicks / t.impressions) * 100 : null;
      case 'cpc': return t.clicks ? t.spend / t.clicks : null;
      case 'cpa': return t.conversions ? t.spend / t.conversions : null;
      case 'cpm': return t.impressions ? (t.spend / t.impressions) * 1000 : null;
      case 'conversionRate': return t.clicks ? (t.conversions / t.clicks) * 100 : null;
      case 'roas': return t.conversionValue != null && t.spend ? t.conversionValue / t.spend : null;
      case 'returnPerEuro': return t.conversionValue != null && t.spend ? t.conversionValue / t.spend : null;
      case 'conversionValue': return t.conversionValue;
    }
    return null;
  }
  function change(cur, prev) { if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev) || prev === 0) return null; return ((cur - prev) / Math.abs(prev)) * 100; }
  function meta(key) { for (var i = 0; i < METRICS.length; i++) if (METRICS[i][0] === key) return { key: key, label: METRICS[i][1], kind: METRICS[i][2], better: METRICS[i][3] }; if (EXTRA[key]) return { key: key, label: EXTRA[key][0], kind: EXTRA[key][1], better: EXTRA[key][2] }; return { key: key, label: key, kind: 'n', better: null }; }
  // Metrics the Overview comparisons also show (not part of the Platform Comparison rows above).
  var EXTRA = { returnPerEuro: ['Return per €1 spent', 'm', 'hi'], cpm: ['CPM', 'm', 'lo'], conversionRate: ['Conversion rate', '%', 'hi'], conversionValue: ['Conversion value', 'm', 'hi'] };
  function fmt(v, kind, cur) {
    if (v == null || !isFinite(v)) return '—';
    // Same money format as the metric cards (js/metrics.js orvFormatMoney) when it's loaded.
    if (kind === 'm' && typeof window.orvFormatMoney === 'function') return window.orvFormatMoney(v, cur || 'EUR');
    if (kind === 'm') { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0, minimumFractionDigits: Math.abs(v) < 10 ? 2 : 0 }).format(v); } catch (_) { return '€' + v.toFixed(2); } }
    if (kind === '%') return v.toFixed(v < 10 ? 2 : 1) + '%';
    if (kind === 'x') return v.toFixed(2) + '×';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1) + 'K';
    return Math.round(v * 10) % 10 && v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('en');
  }
  function fmtChange(pct, better) {
    if (pct == null) return { text: T('No earlier figures'), short: '—', cls: 'is-flat' };
    var up = pct > 0.05, down = pct < -0.05, good = better === 'hi' ? up : better === 'lo' ? down : null;
    var short = (up ? '▲ ' : down ? '▼ ' : '') + Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0);
    return { text: T('{v}% vs previous period', { v: short }), short: short + '%', cls: !up && !down ? 'is-flat' : good === null ? 'is-neutral' : good ? 'is-good' : 'is-bad' };
  }
  function dailyValues(rows, key) { return (rows || []).map(function (r) { return value(r, key); }); }

  // ── SVG charts ───────────────────────────────────────────────────
  // lines: [{ id, name, color, values: [number|null], dashed? }], labels: dates
  var chartN = 0;
  function lineChart(lines, labels, opts) {
    opts = opts || {};
    var id = 'ovaC' + (++chartN), W = 640, H = opts.height || 240, L = 52, R = 12, T = 12, B = 26;
    var all = []; lines.forEach(function (l) { l.values.forEach(function (v) { if (v != null && isFinite(v)) all.push(v); }); });
    var legend = '<ul class="ova-legend">' + lines.map(function (l) { return '<li><i style="--c:' + l.color + '"' + (l.dashed ? ' class="is-dashed"' : '') + '></i>' + esc(l.name) + '</li>'; }).join('') + '</ul>';
    // tpl, not T: inside this function T is the chart's top padding (a number).
    if (!all.length) return '<div class="ova-chart is-empty"><p>' + esc(opts.empty || tpl('No figures for this period yet.')) + '</p></div>';
    var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max.apply(null, all) || 1;
    var nice = Math.pow(10, Math.floor(Math.log10(hi))); hi = Math.ceil(hi / nice * 1.1) * nice || 1;
    var n = Math.max(1, labels.length - 1), x = function (i) { return L + (i / n) * (W - L - R); }, y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    var grid = '';
    for (var g = 0; g <= 4; g++) { var gv = lo + (hi - lo) * g / 4, gy = y(gv); grid += '<line class="ova-gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/><text class="ova-axis" x="' + (L - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end">' + esc(fmt(gv, opts.kind === '%' ? '%' : opts.kind === 'm' ? 'm' : opts.kind === 'x' ? 'x' : 'n', opts.currency)) + '</text>'; }
    var ticks = [0, Math.floor(n / 2), n].filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (i) { return '<text class="ova-axis" x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n ? 'end' : 'middle') + '">' + esc(shortDate(labels[i])) + '</text>'; }).join('');
    var paths = lines.map(function (l) {
      var d = '', pen = false;
      l.values.forEach(function (v, i) { if (v == null || !isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; pen = true; });
      return '<path class="ova-line' + (l.dashed ? ' is-dashed' : '') + '" style="--c:' + l.color + '" d="' + d + '"/>';
    }).join('');
    var data = JSON.stringify({ labels: labels, lines: lines.map(function (l) { return { name: l.name, color: l.color, values: l.values }; }), kind: opts.kind || 'n', currency: opts.currency || 'EUR' }).replace(/</g, '\\u003c');
    return '<div class="ova-chart" id="' + id + '">' + legend + '<div class="ova-chart__plot"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(opts.label || 'Chart') + '">' + grid + ticks + paths +
      '<line class="ova-cross" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" hidden/></svg><div class="ova-tip" hidden></div></div><script type="application/json" class="ova-chart__data">' + data + '</script></div>';
  }
  function shortDate(s) { if (!s) return ''; var d = new Date(s + 'T12:00:00'); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
  // Hover: crosshair + tooltip with every line's value that day.
  function bindCharts(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.ova-chart:not([data-bound])'), function (c) {
      var dataEl = c.querySelector('.ova-chart__data'); if (!dataEl) return; c.setAttribute('data-bound', '1');
      var D; try { D = JSON.parse(dataEl.textContent); } catch (_) { return; }
      var plot = c.querySelector('.ova-chart__plot'), svg = plot.querySelector('svg'), cross = svg.querySelector('.ova-cross'), tip = plot.querySelector('.ova-tip');
      function at(ev) {
        var r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * 640, n = Math.max(1, D.labels.length - 1);
        var i = Math.max(0, Math.min(n, Math.round(((px - 52) / (640 - 52 - 12)) * n))), x = 52 + (i / n) * (640 - 64);
        cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.hidden = false;
        tip.innerHTML = '<b>' + esc(shortDate(D.labels[i])) + '</b>' + D.lines.map(function (l) { return '<span><i style="--c:' + l.color + '"></i>' + esc(l.name) + ' <em>' + esc(fmt(l.values[i], D.kind, D.currency)) + '</em></span>'; }).join('');
        tip.hidden = false; var left = ((x / 640) * r.width); tip.style.left = Math.min(Math.max(0, left + 12), r.width - tip.offsetWidth) + 'px';
      }
      plot.addEventListener('mousemove', at); plot.addEventListener('mouseleave', function () { cross.hidden = true; tip.hidden = true; });
    });
  }
  // Paired horizontal bars: rows [{ label, color, a, b }] with a/b as shares 0..1.
  function pairBars(rows, aLabel, bLabel) {
    return '<div class="ova-pairs"><ul class="ova-legend"><li><i class="is-a"></i>' + esc(aLabel) + '</li><li><i class="is-b"></i>' + esc(bLabel) + '</li></ul>' + rows.map(function (r) {
      var a = Math.round((r.a || 0) * 100), b = r.b == null ? null : Math.round(r.b * 100);
      return '<div class="ova-pair"><div class="ova-pair__n"><i style="--c:' + r.color + '"></i>' + esc(r.label) + '</div><div class="ova-pair__bars">' +
        '<div class="ova-bar is-a"><span style="width:' + a + '%"></span><em>' + a + '%</em></div>' +
        '<div class="ova-bar is-b"><span style="width:' + (b || 0) + '%"></span><em>' + (b == null ? '—' : b + '%') + '</em></div></div></div>';
    }).join('') + '</div>';
  }

  window.orvAnalytics = { PLATFORMS: PLATFORMS, NAME: NAME, SHORT: SHORT, COLOR: COLOR, METRICS: METRICS, windowFor: windowFor, previous: previous, days: days, addDays: addDays, today: today,
    T: T, Th: Th, label: label,
    series: series, seriesWithPrevious: seriesWithPrevious, connections: connections, reset: reset, sum: sum, value: value, change: change, meta: meta, fmt: fmt, fmtChange: fmtChange, dailyValues: dailyValues,
    lineChart: lineChart, bindCharts: bindCharts, pairBars: pairBars, shortDate: shortDate, esc: esc };
})();
