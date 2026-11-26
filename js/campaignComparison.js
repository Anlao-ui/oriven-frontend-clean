/* ════════════════════════════════════════════════════════════════
   Campaigns → Platform Comparison (#page-campaign-comparison)

   What no single ad manager shows: every connected platform side by side.
     Platforms (default)  Google, Meta, TikTok, Pinterest and Snapchat:
                          a comparison table (cards on small screens) with
                          the best value per metric in Electric Lime and the
                          weakest muted; a summary computed from the figures
                          (no AI); one line chart for a chosen metric, one
                          line per platform; share of spend vs share of
                          conversions.
     Campaigns            2–3 campaigns from any platforms, head to head,
                          with the same table, highlighting and chart.
   One period for both (this week, last week, last 30 days, custom) and an
   optional "vs previous period". Unconnected platforms keep their column
   with a "Connect" button. Figures: js/orvAnalytics.js (GET
   /api/analytics/series); derived metrics only from reported inputs.
   window.orvCampaignComparison.open()   (name kept: the nav and links use it)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit, A = window.orvAnalytics; if (!K || !A) return;
  var esc = A.esc;
  var PAGE = 'page-campaign-comparison', ROOT = 'ccmRoot';
  var RANGES = [['THIS_WEEK', 'This week'], ['LAST_WEEK', 'Last week'], ['LAST_30_DAYS', 'Last 30 days'], ['CUSTOM', 'Custom']];
  var ROWS = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions', 'cpa', 'roas', 'returnPerEuro'];
  var CHART_METRICS = ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpc', 'cpa', 'roas'];
  var MAX_CAMPAIGNS = 3;
  // A metric is compared only for platforms that report it (js/metrics.js ORIVEN_METRICS[id].platforms):
  // e.g. Snapchat Ads doesn't send conversions to OrivenAI, so it shows "Not reported", never a 0.
  function reports(p, k) { var id = k === 'returnPerEuro' ? 'roas' : k, m = (window.ORIVEN_METRICS || {})[id]; return !m || !m.platforms || m.platforms.indexOf(p) !== -1; }
  function convCols(cols) { return cols.filter(function (c) { return reports(c.platform, 'conversions'); }); }
  var S = fresh();
  function fresh() { return { uid: null, mode: 'platforms', range: 'LAST_30_DAYS', since: '', until: '', prevOn: false, chartMetric: 'spend', conn: null, data: null, campaigns: null, picked: [], gen: 0 }; }

  function open() {
    if (!K.mount(PAGE, ROOT, onClick)) return;
    var pg = document.getElementById(PAGE);
    if (pg && !pg._pcmBound) { pg._pcmBound = true; pg.addEventListener('change', onChange); }
    if (K.uid() !== S.uid) { S = fresh(); S.uid = K.uid(); }
    K.show('compare', PAGE);
    load(true); // re-check connections on every visit (a platform may just have been connected)
  }
  function win() { return A.windowFor(S.range, S.since, S.until); }
  function currency() { var c = S.conn || {}; for (var i = 0; i < A.PLATFORMS.length; i++) { var x = c[A.PLATFORMS[i]]; if (x && x.conn === 'connected' && x.currency) return x.currency; } return 'EUR'; }
  function connected() { return A.PLATFORMS.filter(function (p) { return S.conn && S.conn[p] && S.conn[p].conn === 'connected'; }); }

  // ── Data ─────────────────────────────────────────────────────────
  function load(recheck) {
    var g = ++S.gen; S.data = null; render();
    A.connections(!!recheck).then(function (conn) {
      if (g !== S.gen) return;
      S.conn = conn; render();
      var w = win(), targets = S.mode === 'platforms'
        ? connected().map(function (p) { return { key: p, platform: p, name: A.NAME[p], opts: {} }; })
        : S.picked.map(function (c) { return { key: c.key, platform: c.platform, name: c.name, opts: { campaignId: c.id } }; });
      if (S.mode === 'campaigns') loadCampaignList(g);
      Promise.all(targets.map(function (t) {
        var get = S.prevOn ? A.seriesWithPrevious(t.platform, w, t.opts) : A.series(t.platform, w, t.opts).then(function (d) { return { cur: d.series, prev: null, valueReported: d.conversionValue === 'reported', clamped: d.clamped }; });
        return get.then(function (d) { return { t: t, d: d }; }, function (err) { return { t: t, err: err }; });
      })).then(function (list) { if (g === S.gen) { S.data = list; render(); } });
    });
  }
  function loadCampaignList(g) {
    if (S.campaigns) return;
    var C = window.orvCampaignSources, plats = connected();
    if (!C || !plats.length) { S.campaigns = []; return; }
    Promise.all(plats.map(function (p) { return C.load(p, { key: 'LAST_90_DAYS' }, (S.conn[p] || {}).currency).then(function (o) { return o.rows || []; }, function () { return []; }); })).then(function (lists) {
      var all = []; lists.forEach(function (l) { l.forEach(function (r) { if (r && r.id) all.push({ key: r.platform + ':' + r.id, platform: r.platform, id: String(r.id), name: r.name || r.id, spend: r.spend }); }); });
      all.sort(function (a, b) { return (b.spend || 0) - (a.spend || 0); });
      S.campaigns = all;
      if (g === S.gen) render();
    });
  }

  // ── Render ───────────────────────────────────────────────────────
  function render() {
    var root = document.getElementById(ROOT); if (!root) return;
    var w = win();
    var html = K.head('Analytics', 'Cross-platform Comparison', 'Every ad platform side by side: where your budget goes and what it brings back. Figures as the platforms report them.') +
      periodCard(w);
    if (!S.conn) { root.innerHTML = html + '<div class="ova-empty">Loading your ad platforms…</div>'; return; }
    if (!connected().length) { root.innerHTML = html + '<div class="ova-empty"><b>Connect an ad platform first.</b> Connect Google, Meta, TikTok, Pinterest or Snapchat Ads to compare them here. <span class="ova-link" data-pcm-connect>Connect a platform</span></div>' + table([]); return; }
    if (S.mode === 'campaigns') html += picker();
    if (!S.data) { root.innerHTML = html + '<div class="ova-empty">Loading figures…</div>'; return; }
    var cols = columns();
    if (S.mode === 'campaigns' && cols.filter(function (c) { return c.tot; }).length < 2) { root.innerHTML = html + '<div class="ova-empty">Choose two or three campaigns to compare them head to head.</div>'; return; }
    html += summary(cols) + table(cols) + '<div class="pcm-two">' + chartCard(cols) + (S.mode === 'platforms' ? shareCard(cols) : '') + '</div>';
    root.innerHTML = html;
    A.bindCharts(root);
  }
  // The period, in its own card: what is compared, over which dates (always counted
  // from today), and — when switched on — the previous period it is compared with.
  function periodCard(w) {
    var n = A.days(w.since, w.until), pw = A.previous(w);
    var longDate = function (d) { try { return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return A.shortDate(d); } };
    return '<section class="pcm-periodcard" aria-label="Period">' +
      '<div class="pcm-pc__main">' +
        '<div class="pcm-pc__row"><div class="ova-seg" role="group" aria-label="Compare"><button type="button" data-pcm-mode="platforms" aria-pressed="' + (S.mode === 'platforms') + '">Platforms</button><button type="button" data-pcm-mode="campaigns" aria-pressed="' + (S.mode === 'campaigns') + '">Campaigns</button></div>' +
          '<select class="ova-select" data-pcm-range aria-label="Period">' + RANGES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === S.range ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>' +
          (S.range === 'CUSTOM' ? '<input type="date" class="ova-date" data-pcm-since value="' + esc(S.since || w.since) + '" aria-label="From"><input type="date" class="ova-date" data-pcm-until value="' + esc(S.until || w.until) + '" aria-label="To">' : '') + '</div>' +
        '<p class="pcm-pc__range"><span class="pcm-pc__lbl">Selected period</span><b class="pcm-period">' + esc(longDate(w.since) + ' – ' + longDate(w.until)) + '</b><span class="pcm-pc__n">' + n + ' days · up to today</span></p>' +
      '</div>' +
      '<div class="pcm-pc__prev' + (S.prevOn ? ' is-on' : '') + '">' +
        '<label class="ova-check"><input type="checkbox" data-pcm-prev' + (S.prevOn ? ' checked' : '') + '> Compare to previous period</label>' +
        (S.prevOn ? '<p class="pcm-pc__range"><span class="pcm-pc__lbl">Previous period</span><b>' + esc(longDate(pw.since) + ' – ' + longDate(pw.until)) + '</b><span class="pcm-pc__n">the ' + n + ' days right before · the change shows under each value</span></p>'
          : '<p class="pcm-pc__hint">Shows, under every value in the table, how much it changed against the ' + n + ' days right before.</p>') +
      '</div></section>';
  }
  // One column per platform (all five, unconnected ones too) or per campaign.
  function columns() {
    var by = {}; (S.data || []).forEach(function (x) { by[x.t.key] = x; });
    if (S.mode === 'campaigns') return S.picked.map(function (c) { var x = by[c.key]; return col(c.key, c.platform, c.name + ' · ' + A.SHORT[c.platform], x, true); });
    return A.PLATFORMS.map(function (p) { var conn = S.conn[p] && S.conn[p].conn === 'connected'; return col(p, p, A.NAME[p], by[p], conn); });
  }
  function col(key, platform, name, x, conn) {
    var c = { key: key, platform: platform, name: name, conn: conn, color: A.COLOR[platform] };
    if (!conn) { c.state = 'connect'; return c; }
    if (!x) { c.state = 'loading'; return c; }
    if (x.err) { c.state = 'error'; return c; }
    c.valueReported = x.d.valueReported; c.cur = x.d.cur; c.prev = x.d.prev; c.clamped = x.d.clamped || null;
    c.tot = A.sum(x.d.cur, x.d.valueReported); c.ptot = x.d.prev ? A.sum(x.d.prev, x.d.valueReported) : null;
    if (!(c.tot.impressions || c.tot.spend || c.tot.clicks)) c.state = 'nodata';
    return c;
  }
  // Best (lime) / worst (muted) per metric among columns with that figure.
  function rank(cols, key) {
    var m = A.meta(key); if (!m.better) return {};
    var vals = cols.filter(function (c) { return c.tot && c.state !== 'nodata' && reports(c.platform, key); }).map(function (c) { return [c.key, A.value(c.tot, key)]; }).filter(function (x) { return x[1] != null && isFinite(x[1]); });
    if (vals.length < 2) return {};
    vals.sort(function (a, b) { return a[1] - b[1]; });
    var lo = vals[0], hi = vals[vals.length - 1]; if (lo[1] === hi[1]) return {};
    var best = m.better === 'hi' ? hi[0] : lo[0], worst = m.better === 'hi' ? lo[0] : hi[0], o = {}; o[best] = 'best'; o[worst] = 'worst'; return o;
  }
  function table(cols) {
    if (!cols.length) cols = A.PLATFORMS.map(function (p) { return { key: p, platform: p, name: A.NAME[p], state: 'connect', color: A.COLOR[p] }; });
    var ranks = {}; ROWS.forEach(function (k) { ranks[k] = rank(cols, k); });
    var cell = function (c, k) {
      if (c.state === 'connect') return '';
      if (c.state === 'loading') return '<span class="pcm-mut">…</span>';
      if (c.state === 'error') return '<span class="pcm-mut">Unavailable</span>';
      if (!reports(c.platform, k)) return '<span class="pcm-mut">Not reported</span>';
      var m = A.meta(k), v = A.value(c.tot, k);
      if ((k === 'roas' || k === 'returnPerEuro') && !c.valueReported) return '<span class="pcm-mut">Not reported</span>';
      var r = ranks[k][c.key], ch = S.prevOn && c.ptot ? A.fmtChange(A.change(v, A.value(c.ptot, k)), m.better) : null;
      return '<span class="pcm-v' + (r ? ' is-' + r : '') + '">' + esc(A.fmt(v, m.kind, currency())) + (r === 'best' ? '<span class="ova-sr"> (best)</span>' : r === 'worst' ? '<span class="ova-sr"> (weakest)</span>' : '') + '</span>' + (ch ? '<span class="pcm-ch ' + ch.cls + '">' + esc(ch.text.replace(' vs previous period', '')) + '</span>' : '');
    };
    var headCell = function (c) {
      return '<th scope="col" class="pcm-col"><span class="pcm-colname"><i class="ova-dot" style="--c:' + c.color + '"></i>' + esc(c.name) + '</span>' +
        (c.state === 'connect' ? '<span class="ova-link" data-pcm-connect>Connect ' + esc(A.SHORT[c.platform]) + '</span>' : c.state === 'nodata' ? '<span class="pcm-mut">No data yet</span>' : c.state === 'error' ? '<span class="pcm-mut">Couldn’t load</span><button type="button" class="ova-link" data-pcm-retry>Try again</button>' : '') +
        (S.mode === 'campaigns' ? '<button type="button" class="pcm-x" data-pcm-unpick="' + esc(c.key) + '" aria-label="Remove ' + esc(c.name) + '">×</button>' : '') + '</th>';
    };
    var desk = '<div class="pcm-table-wrap"><table class="pcm-table"><thead><tr><th scope="col" class="pcm-rowh">Metric</th>' + cols.map(headCell).join('') + '</tr></thead><tbody>' +
      ROWS.map(function (k) { return '<tr><th scope="row" class="pcm-rowh">' + esc(A.meta(k).label) + '</th>' + cols.map(function (c) { return '<td class="' + (c.state === 'connect' ? 'is-off' : '') + '">' + cell(c, k) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    var cards = '<div class="pcm-cards">' + cols.map(function (c) {
      return '<article class="pcm-card"><h3 class="pcm-card__h"><i class="ova-dot" style="--c:' + c.color + '"></i>' + esc(c.name) + (S.mode === 'campaigns' ? '<button type="button" class="pcm-x" data-pcm-unpick="' + esc(c.key) + '" aria-label="Remove ' + esc(c.name) + '">×</button>' : '') + '</h3>' +
        (c.state === 'connect' ? '<p class="pcm-mut"><span class="ova-link" data-pcm-connect>Connect ' + esc(A.SHORT[c.platform]) + '</span> to compare it.</p>' : c.state === 'nodata' ? '<p class="pcm-mut">No data yet for this period.</p>' : c.state === 'error' ? '<p class="pcm-mut">' + esc(A.NAME[c.platform]) + ' didn’t return figures right now. <button type="button" class="ova-link" data-pcm-retry>Try again</button></p>' :
          '<dl>' + ROWS.map(function (k) { return '<div><dt>' + esc(A.meta(k).label) + '</dt><dd>' + cell(c, k) + '</dd></div>'; }).join('') + '</dl>') + '</article>';
    }).join('') + '</div>';
    return '<section class="pcm-sec" aria-label="Comparison table">' + desk + cards + '<p class="pcm-legend"><span class="pcm-v is-best">Best</span> value per metric &nbsp;·&nbsp; <span class="pcm-v is-worst">Weakest</span> &nbsp;·&nbsp; Spend has no best or worst. Conversions are counted the way each platform defines them.' + (cols.some(function (c) { return c.platform === 'snapchat' && c.tot; }) ? ' Snapchat counts swipe-ups as clicks.' : '') + '</p>' + clampNote(cols) + '</section>';
  }
  function clampNote(cols) {
    var cl = cols.filter(function (c) { return c.clamped; });
    return cl.length ? '<p class="pcm-legend">' + esc(cl.map(function (c) { return A.NAME[c.platform]; }).join(' and ') + ' keep' + (cl.length > 1 ? '' : 's') + ' daily figures for the last 90 days; earlier days in this period aren’t included.') + '</p>' : '';
  }
  // Rule-based summary (no AI): shares, the highest CPA, a budget suggestion.
  function summary(cols) {
    var all = cols.filter(function (c) { return c.tot && c.state !== 'nodata'; });
    if (!all.length) return '';
    var live = S.mode === 'platforms' ? convCols(all) : all, left = all.filter(function (c) { return live.indexOf(c) === -1; });
    var spend = live.reduce(function (s, c) { return s + c.tot.spend; }, 0), conv = live.reduce(function (s, c) { return s + (reports(c.platform, 'conversions') ? c.tot.conversions : 0); }, 0);
    var lines = [];
    if (left.length) lines.push(left.map(function (c) { return c.name; }).join(' and ') + (left.length > 1 ? ' don’t' : ' doesn’t') + ' report conversions to OrivenAI, so ' + (left.length > 1 ? 'they’re' : 'it’s') + ' left out of the conversion comparison.');
    if (!live.length) lines.push('None of these platforms report conversions, so spend can’t be weighed against results.');
    else if (live.length < 2 && all.length < 2) lines.push('Only ' + live[0].name + ' has figures in this period, so there is nothing to compare it with yet.');
    else if (spend > 0 && conv > 0) {
      var withShare = live.filter(function (c) { return reports(c.platform, 'conversions'); }).map(function (c) { return { c: c, s: c.tot.spend / spend, v: c.tot.conversions / conv }; });
      var top = withShare.slice().sort(function (a, b) { return (b.v - b.s) - (a.v - a.s); })[0], low = withShare.slice().sort(function (a, b) { return (a.v - a.s) - (b.v - b.s); })[0];
      lines.push(top.c.name + ' delivers ' + Math.round(top.v * 100) + '% of conversions on ' + Math.round(top.s * 100) + '% of spend.');
      var cpas = live.filter(function (c) { return reports(c.platform, 'cpa') && c.tot.conversions > 0; }).map(function (c) { return [c, c.tot.spend / c.tot.conversions]; }).sort(function (a, b) { return b[1] - a[1]; });
      if (cpas.length >= 2) lines.push(cpas[0][0].name + ' has the highest CPA (' + A.fmt(cpas[0][1], 'm', currency()) + '); ' + cpas[cpas.length - 1][0].name + ' the lowest (' + A.fmt(cpas[cpas.length - 1][1], 'm', currency()) + ').');
      var none = live.filter(function (c) { return reports(c.platform, 'conversions') && c.tot.spend > 0 && c.tot.conversions === 0; });
      if (none.length) lines.push(none.map(function (c) { return c.name; }).join(' and ') + (none.length > 1 ? ' have' : ' has') + ' spend but no reported conversions.');
      var tip = null;
      if (top.c !== low.c && top.v - top.s >= 0.1 && low.s - low.v >= 0.1) tip = 'Consider shifting budget from ' + low.c.name + ' to ' + top.c.name + '.';
      if (conv < 10) lines.push('Fewer than 10 conversions in this period, so these differences may be chance.');
      return '<section class="pcm-summary" aria-label="Summary"><ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' + (tip ? '<p class="pcm-tip">' + esc(tip) + '</p>' : '<p class="pcm-tip is-quiet">No platform is clearly over- or under-funded in this period.</p>') + '<p class="pcm-basis">Calculated from the figures below; no AI.</p></section>';
    } else lines.push(conv ? 'No spend reported in this period.' : 'No conversions reported in this period, so spend can’t be weighed against results yet.');
    return '<section class="pcm-summary" aria-label="Summary"><ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul><p class="pcm-basis">Calculated from the figures below; no AI.</p></section>';
  }
  function chartCard(cols) {
    var w = win(), labels = []; for (var d = w.since; d <= w.until; d = A.addDays(d, 1)) labels.push(d);
    var m = A.meta(S.chartMetric);
    var lines = cols.filter(function (c) { return c.cur && c.state !== 'nodata' && reports(c.platform, S.chartMetric); }).map(function (c) {
      var by = {}; c.cur.forEach(function (r) { by[r.date] = r; });
      return { name: S.mode === 'campaigns' ? c.name : A.SHORT[c.platform], color: c.color, values: labels.map(function (dt) { var r = by[dt]; return r && (S.chartMetric !== 'roas' || c.valueReported) ? A.value(r, S.chartMetric) : null; }) };
    });
    if (S.mode === 'campaigns') { var seen = {}; lines.forEach(function (l, i) { var k = l.color; if (seen[k]) l.color = ['#3DD6D0', '#F2D94E', '#FF7A7A'][i % 3]; seen[l.color] = 1; }); }
    return '<article class="ova-card pcm-chart"><div class="ova-card__hd"><h3 class="ova-h3">Over time</h3><select class="ova-select" data-pcm-metric aria-label="Metric">' + CHART_METRICS.map(function (k) { return '<option value="' + k + '"' + (k === S.chartMetric ? ' selected' : '') + '>' + esc(A.meta(k).label) + '</option>'; }).join('') + '</select></div>' +
      '<div class="ova-card__body">' + A.lineChart(lines, labels, { kind: m.kind, currency: currency(), label: m.label + ' per ' + (S.mode === 'campaigns' ? 'campaign' : 'platform'), empty: 'No ' + m.label.toLowerCase() + ' reported in this period.' }) + '</div></article>';
  }
  function shareCard(cols) {
    var all = cols.filter(function (c) { return c.tot && c.state !== 'nodata'; }), live = convCols(all), left = all.filter(function (c) { return live.indexOf(c) === -1; });
    var spend = live.reduce(function (s, c) { return s + c.tot.spend; }, 0), conv = live.reduce(function (s, c) { return s + c.tot.conversions; }, 0);
    var body = !live.length || !spend ? '<div class="ova-empty">No spend reported in this period.</div>' :
      A.pairBars(live.map(function (c) { return { label: A.SHORT[c.platform], color: c.color, a: c.tot.spend / spend, b: conv ? c.tot.conversions / conv : null }; }), 'Share of spend', 'Share of conversions');
    return '<article class="ova-card pcm-share"><div class="ova-card__hd"><h3 class="ova-h3">Spend vs conversions</h3></div><div class="ova-card__body">' + body +
      '<p class="pcm-basis">A platform with a longer conversion bar than spend bar earns more than its share of the budget.' + (left.length ? ' ' + esc(left.map(function (c) { return A.NAME[c.platform]; }).join(' and ')) + ' doesn’t report conversions, so it isn’t included here.' : '') + '</p></div></article>';
  }
  function picker() {
    if (!S.campaigns) return '<div class="pcm-picker"><span class="pcm-mut">Loading your campaigns…</span></div>';
    var left = S.campaigns.filter(function (c) { return !S.picked.some(function (p) { return p.key === c.key; }); });
    var full = S.picked.length >= MAX_CAMPAIGNS;
    return '<div class="pcm-picker"><label class="pcm-picker__l" for="pcmPick">Add a campaign</label><select class="ova-select" id="pcmPick" data-pcm-pick' + (full || !left.length ? ' disabled' : '') + '><option value="">' + (full ? 'Up to three campaigns' : left.length ? 'Choose a campaign…' : 'No more campaigns') + '</option>' +
      A.PLATFORMS.map(function (p) { var l = left.filter(function (c) { return c.platform === p; }); return l.length ? '<optgroup label="' + esc(A.NAME[p]) + '">' + l.map(function (c) { return '<option value="' + esc(c.key) + '">' + esc(c.name) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('') +
      '</select><span class="pcm-mut">' + S.picked.length + ' of ' + MAX_CAMPAIGNS + ' chosen</span></div>';
  }

  // ── Events ───────────────────────────────────────────────────────
  function onClick(e) {
    var t = e.target.closest('[data-pcm-mode]'); if (t) { S.mode = t.getAttribute('data-pcm-mode'); load(); return; }
    if (e.target.closest('[data-pcm-connect]')) { e.preventDefault(); if (typeof window.bizGoTo === 'function') window.bizGoTo('connections'); return; }
    if (e.target.closest('[data-pcm-retry]')) { A.reset(); load(true); return; }
    var u = e.target.closest('[data-pcm-unpick]'); if (u) { var k = u.getAttribute('data-pcm-unpick'); S.picked = S.picked.filter(function (p) { return p.key !== k; }); load(); }
  }
  function onChange(e) {
    var el = e.target;
    if (el.matches('[data-pcm-range]')) { S.range = el.value; if (el.value !== 'CUSTOM') { S.since = S.until = ''; load(); } else render(); }
    else if (el.matches('[data-pcm-since]') || el.matches('[data-pcm-until]')) { var r = document.getElementById(ROOT), s = r.querySelector('[data-pcm-since]').value, u = r.querySelector('[data-pcm-until]').value; if (s && u) { S.since = s; S.until = u; load(); } }
    else if (el.matches('[data-pcm-prev]')) { S.prevOn = el.checked; load(); }
    else if (el.matches('[data-pcm-metric]')) { S.chartMetric = el.value; render(); }
    else if (el.matches('[data-pcm-pick]')) { var c = (S.campaigns || []).filter(function (x) { return x.key === el.value; })[0]; if (c && S.picked.length < MAX_CAMPAIGNS) { S.picked.push(c); load(); } }
  }
  window.orvCampaignComparison = { open: open, _state: function () { return S; } };
})();
