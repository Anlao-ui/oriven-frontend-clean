/* ════════════════════════════════════════════════════════════════
   Campaign Overview → comparison cards (#ovtPeriod, #ovtAds inside
   #prfDash, next to the selected metric's graph).

   Period comparison: this week vs last week, this month vs last month
   (both "so far": the same days of the earlier period) or two custom
   periods — current, previous, difference and % change per metric.
   Ad vs ad: two Meta ads over a chosen period — figures side by side,
   the better value marked, a plain-language verdict and both ads over
   time. Only Meta Ads reports results per ad to OrivenAI; other
   platforms say so instead of showing a comparison.

   Data: real figures only, GET /api/analytics/series (js/orvAnalytics.js)
   for the platform, campaign or ad chosen in the page's own controls, and
   GET /api/meta/ads for the ad names. Metrics follow the per-platform
   registry (js/metrics.js ORIVEN_METRICS[id].platforms): a metric a
   platform doesn't report is never shown for it.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = window.orvAnalytics; if (!A || window.orvOverviewCompare) return;
  var esc = A.esc, T = A.T, Th = A.Th, L = A.label;
  // Everything these cards can calculate from daily spend/impressions/clicks/conversions/value.
  var CALC = ['impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'spend', 'conversions', 'conversionRate', 'cpa', 'conversionValue', 'roas'];
  // Efficiency metrics: the ones where "better" is meaningful between two ads (volume depends on budget).
  var EFFICIENCY = ['ctr', 'cpc', 'cpm', 'conversionRate', 'cpa', 'roas'];
  var MIN_IMPRESSIONS = 500;
  // Two values count as different only from a 3% gap (smaller gaps are noise, and often round to the same figure).
  function differs(a, b, min) { if (a == null || b == null) return false; var m = Math.max(Math.abs(a), Math.abs(b)); return m > 0 && Math.abs(a - b) / m >= (min || 0.03); }
  var S = { gen: 0, mode: 'week', aSince: '', aUntil: '', bSince: '', bUntil: '', ads: null, adsKey: '', adA: '', adB: '', adDays: 30, adMetric: 'ctr' };

  function platform() { return window._prfActivePlatform || 'google'; }
  function currency() { return window.orvMetricCurrency || 'EUR'; }
  function card(id) { return document.getElementById(id); }
  // Metrics this platform reports (registry) that the cards can calculate.
  function metricsFor(p, valueReported) {
    var reg = window.ORIVEN_METRICS || {};
    return CALC.filter(function (id) {
      var m = reg[id];
      if (m && m.platforms && m.platforms.indexOf(p) === -1) return false;
      if ((id === 'conversionValue' || id === 'roas') && !valueReported) return false;
      return true;
    });
  }
  // The page's chosen campaign/ad → series filter (+ a note when only the whole account is possible).
  function scope() {
    var key = window._prfActiveCampaign || 'all', h = window._prfHierarchy || 'campaigns', p = platform();
    if (key === 'all') return { opts: {}, label: '' };
    var ents = typeof window._prfActiveEntitiesForTiles === 'function' ? window._prfActiveEntitiesForTiles() : [];
    var e = ents.filter(function (x) { return x.key === key; })[0];
    if (!e) return { opts: {}, label: '' };
    if (h === 'campaigns') return { opts: { campaignId: e.id }, label: e.name };
    if (h === 'ads' && (p === 'meta' || p === 'google')) return { opts: { adId: e.id }, label: e.name };
    return { opts: {}, label: '', note: T(h === 'ads' ? 'Daily figures per ad aren’t available for {p}: this compares the whole account.' : 'Daily figures per ad set aren’t available for {p}: this compares the whole account.', { p: A.NAME[p] }) };
  }
  function connectLink(p) { return '<button type="button" class="ova-link" data-ovc-connect>' + esc(T('Connect {p}', { p: A.NAME[p] })) + '</button>'; }
  function empty(html) { return '<div class="ova-empty">' + html + '</div>'; }
  function loading() { return '<div class="ova-loading" role="status">' + esc(T('Loading…')) + '</div>'; }
  function signed(v, kind) {
    if (v == null || !isFinite(v)) return '—';
    var s = v > 0 ? '+' : v < 0 ? '−' : '±';
    if (kind !== '%' && A.fmt(Math.abs(v), kind, currency()) === A.fmt(0, kind, currency())) s = '±';
    if (kind === '%') return s + Math.abs(v).toFixed(2) + ' ' + T('pt');
    return s + A.fmt(Math.abs(v), kind, currency());
  }
  function range(w) { return A.shortDate(w.since) + (w.since === w.until ? '' : ' – ' + A.shortDate(w.until)); }

  // ── Periods ──────────────────────────────────────────────────────
  function periods() {
    var t = A.today(), d = new Date(t + 'T12:00:00');
    if (S.mode === 'week') {
      var dow = (d.getDay() + 6) % 7, mon = A.addDays(t, -dow);
      return { a: { since: mon, until: t }, b: { since: A.addDays(mon, -7), until: A.addDays(t, -7) }, aName: T('This week'), bName: T('Last week'), sameDays: dow > 0 };
    }
    if (S.mode === 'month') {
      var first = t.slice(0, 8) + '01', day = d.getDate();
      var pm = new Date(d.getFullYear(), d.getMonth(), 0); // last day of last month
      var pFirst = pm.getFullYear() + '-' + String(pm.getMonth() + 1).padStart(2, '0') + '-01';
      var pUntil = A.addDays(pFirst, Math.min(day, pm.getDate()) - 1);
      return { a: { since: first, until: t }, b: { since: pFirst, until: pUntil }, aName: T('This month'), bName: T('Last month'), sameDays: day < 28 };
    }
    var def = { since: A.addDays(t, -6), until: t };
    var a = valid(S.aSince, S.aUntil) ? { since: S.aSince, until: S.aUntil } : def;
    var b = valid(S.bSince, S.bUntil) ? { since: S.bSince, until: S.bUntil } : A.previous(a);
    return { a: a, b: b, aName: T('Period A'), bName: T('Period B'), custom: true };
  }
  function valid(s, u) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && /^\d{4}-\d{2}-\d{2}$/.test(u || '') && s <= u && u <= A.today(); }

  function renderPeriod(g, conn) {
    var el = card('ovtPeriod'); if (!el) return;
    var p = platform(), sc = scope(), pr = periods();
    var seg = function (k, label) { return '<button type="button" data-ovc-mode="' + k + '" aria-pressed="' + (S.mode === k) + '">' + esc(label) + '</button>'; };
    var head = '<div class="ova-card__hd"><h3 class="ova-h3" id="ovtPeriodH">' + esc(T('Compare periods')) + '</h3>' +
      '<div class="ova-seg" role="group" aria-label="' + esc(T('Periods')) + '">' + seg('week', T('Week')) + seg('month', T('Month')) + seg('custom', T('Custom')) + '</div></div>';
    var custom = pr.custom ? '<div class="ovc-custom">' +
      '<fieldset><legend>' + esc(T('Period A')) + '</legend><input type="date" class="ova-date" data-ovc-date="aSince" value="' + pr.a.since + '" max="' + A.today() + '" aria-label="' + esc(T('Period A from')) + '"><input type="date" class="ova-date" data-ovc-date="aUntil" value="' + pr.a.until + '" max="' + A.today() + '" aria-label="' + esc(T('Period A to')) + '"></fieldset>' +
      '<fieldset><legend>' + esc(T('Period B')) + '</legend><input type="date" class="ova-date" data-ovc-date="bSince" value="' + pr.b.since + '" max="' + A.today() + '" aria-label="' + esc(T('Period B from')) + '"><input type="date" class="ova-date" data-ovc-date="bUntil" value="' + pr.b.until + '" max="' + A.today() + '" aria-label="' + esc(T('Period B to')) + '"></fieldset></div>' : '';
    var sub = '<p class="ova-sub">' + esc(pr.aName + ' (' + range(pr.a) + ') ' + T('vs') + ' ' + pr.bName + ' (' + range(pr.b) + ')') +
      (pr.sameDays ? ' · ' + esc(T('the same days, so the two are comparable')) : '') + '</p>' +
      (sc.label ? '<p class="ova-note">' + esc(A.NAME[p] + ' · ' + sc.label) + '</p>' : '') + (sc.note ? '<p class="ova-note">' + esc(sc.note) + '</p>' : '');
    var c = conn[p] || {};
    if (c.conn !== 'connected') { el.innerHTML = head + empty(Th('{link} to compare periods.', { link: connectLink(p) })); return; }
    el.innerHTML = head + custom + sub + '<div class="ovc-body">' + loading() + '</div>';
    Promise.all([A.series(p, pr.a, sc.opts), A.series(p, pr.b, sc.opts)]).then(function (r) {
      if (g !== S.gen) return;
      var body = el.querySelector('.ovc-body'); if (!body) return;
      var valued = r[0].conversionValue === 'reported' && r[1].conversionValue === 'reported';
      var ta = A.sum(r[0].series, valued), tb = A.sum(r[1].series, valued);
      if (!(ta.impressions || ta.spend || tb.impressions || tb.spend)) { body.innerHTML = empty(esc(T('No figures for either period yet.'))); return; }
      var clamped = r[0].clamped || r[1].clamped;
      var rows = metricsFor(p, valued).map(function (id) {
        var m = A.meta(id), va = A.value(ta, id), vb = A.value(tb, id);
        var diff = va != null && vb != null ? va - vb : null, ch = A.fmtChange(A.change(va, vb), m.better);
        return '<tr><th scope="row">' + esc(L(id)) + '</th><td data-l="' + esc(pr.aName) + '">' + esc(A.fmt(va, m.kind, currency())) + '</td><td data-l="' + esc(pr.bName) + '">' + esc(A.fmt(vb, m.kind, currency())) + '</td>' +
          '<td data-l="' + esc(T('Difference')) + '">' + esc(signed(diff, m.kind)) + '</td><td data-l="' + esc(T('Change')) + '" class="' + ch.cls + '">' + esc(ch.short) + '</td></tr>';
      }).join('');
      body.innerHTML = '<table class="ova-table ovc-table"><thead><tr><th scope="col">' + esc(T('Metric')) + '</th><th scope="col">' + esc(pr.aName) + '</th><th scope="col">' + esc(pr.bName) + '</th><th scope="col">' + esc(T('Difference')) + '</th><th scope="col">' + esc(T('Change')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        (clamped ? '<p class="ova-note">' + esc(T('{p} keeps daily figures for the last 90 days; earlier days aren’t included.', { p: A.NAME[p] })) + '</p>' : '');
    }, function () {
      if (g !== S.gen) return;
      var body = el.querySelector('.ovc-body'); if (body) body.innerHTML = empty(esc(T('{p} didn’t return figures right now.', { p: A.NAME[p] })) + ' <button type="button" class="ova-link" data-ovc-retry>' + esc(T('Try again')) + '</button>');
    });
  }

  // ── Ad vs ad ─────────────────────────────────────────────────────
  function renderAds(g, conn) {
    var el = card('ovtAds'); if (!el) return;
    var p = platform();
    var head = function (ctrls) { return '<div class="ova-card__hd"><h3 class="ova-h3" id="ovtAdsH">' + esc(T('Ad vs ad')) + '</h3>' + (ctrls || '') + '</div>'; };
    if (p !== 'meta') {
      var metaOn = conn.meta && conn.meta.conn === 'connected';
      el.innerHTML = head() + empty(esc(T('Results per ad come from Meta Ads. {p} doesn’t report results per ad to OrivenAI yet.', { p: A.NAME[p] })) +
        (metaOn ? ' <button type="button" class="ova-link" data-ovc-meta>' + esc(T('Compare Meta ads')) + '</button>' : ''));
      return;
    }
    if (!conn.meta || conn.meta.conn !== 'connected') { el.innerHTML = head() + empty(Th('{link} to compare ads.', { link: connectLink('meta') })); return; }
    var w = { since: A.addDays(A.today(), -(S.adDays - 1)), until: A.today() }, key = w.since + '_' + w.until;
    if (!S.ads || S.adsKey !== key) el.innerHTML = head() + loading();
    var list = S.ads && S.adsKey === key ? Promise.resolve(S.ads) : window.apiFetch('/api/meta/ads?date_since=' + w.since + '&date_until=' + w.until + '&date_range=CUSTOM').then(function (r) {
      if (!(r && r.ok && r.data && Array.isArray(r.data.ads))) throw new Error('ads');
      S.ads = r.data.ads.filter(function (a) { return a && a.ad_id; }).sort(function (x, y) { return (+y.spend || 0) - (+x.spend || 0); }); S.adsKey = key; return S.ads;
    });
    list.then(function (ads) {
      if (g !== S.gen) return;
      if (ads.length < 2) { el.innerHTML = head() + empty(esc(T('You need at least two Meta ads to compare.'))); return; }
      var has = function (id) { return ads.some(function (a) { return String(a.ad_id) === id; }); };
      if (!S.adA || !has(S.adA)) S.adA = String(ads[0].ad_id);
      if (!S.adB || S.adB === S.adA || !has(S.adB)) S.adB = String(ads.filter(function (a) { return String(a.ad_id) !== S.adA; })[0].ad_id);
      var name = function (id) { var a = ads.filter(function (x) { return String(x.ad_id) === id; })[0]; return a ? (a.ad_name || id) : id; };
      var opt = function (sel, other) { return ads.map(function (a) { var id = String(a.ad_id); return '<option value="' + esc(id) + '"' + (id === sel ? ' selected' : '') + (id === other ? ' disabled' : '') + '>' + esc(a.ad_name || id) + '</option>'; }).join(''); };
      var ctrls = '<div class="ova-ctrls">' +
        '<select class="ova-select" data-ovc-ad="A" aria-label="' + esc(T('First ad')) + '">' + opt(S.adA, S.adB) + '</select>' +
        '<span class="ovc-vs" aria-hidden="true">' + esc(T('vs')) + '</span>' +
        '<select class="ova-select" data-ovc-ad="B" aria-label="' + esc(T('Second ad')) + '">' + opt(S.adB, S.adA) + '</select>' +
        '<select class="ova-select" data-ovc-days aria-label="' + esc(T('Period')) + '">' + [7, 30, 90].map(function (n) { return '<option value="' + n + '"' + (n === S.adDays ? ' selected' : '') + '>' + esc(T('Last {n} days', { n: n })) + '</option>'; }).join('') + '</select></div>';
      el.innerHTML = head(ctrls) + '<div class="ovc-body">' + loading() + '</div>';
      Promise.all([A.series('meta', w, { adId: S.adA }), A.series('meta', w, { adId: S.adB })]).then(function (r) {
        if (g !== S.gen) return;
        var body = el.querySelector('.ovc-body'); if (!body) return;
        var valued = r[0].conversionValue === 'reported' && r[1].conversionValue === 'reported';
        var ta = A.sum(r[0].series, valued), tb = A.sum(r[1].series, valued), nA = name(S.adA), nB = name(S.adB);
        var ids = metricsFor('meta', valued);
        if (ids.indexOf(S.adMetric) === -1) S.adMetric = 'ctr';
        var best = {};
        ids.forEach(function (id) {
          if (EFFICIENCY.indexOf(id) === -1) return;
          var m = A.meta(id), va = A.value(ta, id), vb = A.value(tb, id);
          if (!differs(va, vb)) return;
          best[id] = (m.better === 'hi') === (va > vb) ? 'a' : 'b';
        });
        var rows = ids.map(function (id) {
          var m = A.meta(id), va = A.value(ta, id), vb = A.value(tb, id);
          var mark = function (side) { return best[id] === side ? ' class="is-best"' : ''; };
          return '<tr><th scope="row">' + esc(L(id)) + '</th><td data-l="' + esc(nA) + '"' + mark('a') + '>' + esc(A.fmt(va, m.kind, currency())) + (best[id] === 'a' ? '<span class="ova-sr"> (' + esc(T('better')) + ')</span>' : '') + '</td><td data-l="' + esc(nB) + '"' + mark('b') + '>' + esc(A.fmt(vb, m.kind, currency())) + (best[id] === 'b' ? '<span class="ova-sr"> (' + esc(T('better')) + ')</span>' : '') + '</td></tr>';
        }).join('');
        var labels = r[0].series.map(function (x) { return x.date; }), cm = A.meta(S.adMetric);
        body.innerHTML = '<div class="ovc-ads">' +
          '<div>' + verdict(ta, tb, nA, nB) + '<table class="ova-table ovc-table ovc-adtable"><thead><tr><th scope="col">' + esc(T('Metric')) + '</th><th scope="col"><i class="ova-dot" style="--c:' + A.COLOR.meta + '"></i>' + esc(nA) + '</th><th scope="col"><i class="ova-dot" style="--c:#3DD6D0"></i>' + esc(nB) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '<div class="ovc-adchart"><div class="ova-card__hd ovc-sub-hd"><h4>' + esc(T('{m} over time', { m: L(S.adMetric) })) + '</h4><select class="ova-select" data-ovc-admetric aria-label="' + esc(T('Metric')) + '">' + ids.map(function (id) { return '<option value="' + id + '"' + (id === S.adMetric ? ' selected' : '') + '>' + esc(L(id)) + '</option>'; }).join('') + '</select></div>' +
          A.lineChart([{ name: nA, color: A.COLOR.meta, values: A.dailyValues(r[0].series, S.adMetric) }, { name: nB, color: '#3DD6D0', values: A.dailyValues(r[1].series, S.adMetric) }], labels, { kind: cm.kind, currency: currency(), height: 200, label: T('{m}: ad vs ad', { m: L(S.adMetric) }) }) + '</div></div>';
        A.bindCharts(body);
      }, function () {
        if (g !== S.gen) return;
        var body = el.querySelector('.ovc-body'); if (body) body.innerHTML = empty(esc(T('Meta Ads didn’t return figures for these ads right now.')) + ' <button type="button" class="ova-link" data-ovc-retry>' + esc(T('Try again')) + '</button>');
      });
    }, function () {
      if (g !== S.gen) return;
      el.innerHTML = head() + empty(esc(T('Meta Ads didn’t return your ads right now.')) + ' <button type="button" class="ova-link" data-ovc-retry>' + esc(T('Try again')) + '</button>');
    });
  }
  // Which ad does better, and why — from the figures above only (no AI).
  function verdict(ta, tb, nA, nB) {
    if (ta.impressions < MIN_IMPRESSIONS || tb.impressions < MIN_IMPRESSIONS) return '<p class="ovc-verdict is-muted">' + esc(T('Too early to tell: each ad needs at least {n} impressions in this period.', { n: MIN_IMPRESSIONS })) + '</p>';
    var v = function (t, k) { return A.value(t, k); }, cur = currency(), f = function (t, k) { return A.fmt(v(t, k), A.meta(k).kind, cur); };
    var win = null, reasons = [];
    var reason = function (k, w, l) {
      var phr = { cpa: 'each conversion costs less ({a} vs {b} CPA)', conversionRate: 'more of its clicks turn into conversions ({a} vs {b})', ctr: 'people click it more often ({a} vs {b} CTR)', cpc: 'each click costs less ({a} vs {b} CPC)', roas: 'it brings back more per euro ({a} vs {b} ROAS)' }[k];
      reasons.push(T(phr, { a: f(w, k), b: f(l, k) }));
    };
    var cA = ta.conversions, cB = tb.conversions;
    if (cA > 0 && cB > 0 && differs(v(ta, 'cpa'), v(tb, 'cpa'))) {
      win = v(ta, 'cpa') < v(tb, 'cpa') ? 'a' : 'b';
    } else if ((cA > 0) !== (cB > 0)) {
      win = cA > 0 ? 'a' : 'b';
    } else if (differs(v(ta, 'ctr'), v(tb, 'ctr'))) {
      win = v(ta, 'ctr') > v(tb, 'ctr') ? 'a' : 'b';
    }
    if (!win) return '<p class="ovc-verdict is-muted">' + esc(T('These two ads perform about the same in this period.')) + '</p>';
    var W = win === 'a' ? ta : tb, Lo = win === 'a' ? tb : ta;
    if (W.conversions > 0 && Lo.conversions > 0 && v(W, 'cpa') < v(Lo, 'cpa') && differs(v(W, 'cpa'), v(Lo, 'cpa'))) reason('cpa', W, Lo);
    if (W.conversions > 0 && Lo.conversions === 0) reasons.push(T('it brought {n} conversions, the other none', { n: Math.round(W.conversions) }));
    if (v(W, 'roas') != null && v(Lo, 'roas') != null && v(W, 'roas') > v(Lo, 'roas') && differs(v(W, 'roas'), v(Lo, 'roas'))) reason('roas', W, Lo);
    if (v(W, 'conversionRate') != null && v(Lo, 'conversionRate') != null && v(W, 'conversionRate') > v(Lo, 'conversionRate') && differs(v(W, 'conversionRate'), v(Lo, 'conversionRate'))) reason('conversionRate', W, Lo);
    if (v(W, 'ctr') > v(Lo, 'ctr') && differs(v(W, 'ctr'), v(Lo, 'ctr'))) reason('ctr', W, Lo);
    if (v(W, 'cpc') != null && v(Lo, 'cpc') != null && v(W, 'cpc') < v(Lo, 'cpc') && differs(v(W, 'cpc'), v(Lo, 'cpc'))) reason('cpc', W, Lo);
    var but = v(Lo, 'ctr') > v(W, 'ctr') && differs(v(Lo, 'ctr'), v(W, 'ctr'), 0.05) ? T('{l} does get clicked more often ({a} vs {b} CTR).', { l: win === 'a' ? nB : nA, a: f(Lo, 'ctr'), b: f(W, 'ctr') }) : '';
    return '<p class="ovc-verdict"><b>' + esc(T('{w} is doing better', { w: win === 'a' ? nA : nB })) + '</b>' + (reasons.length ? esc(': ' + reasons.slice(0, 2).join(T(' and ')) + '.') : '.') + (but ? ' ' + esc(but) : '') + '</p>' +
      '<p class="ova-note">' + esc(T('Calculated from the figures below; no AI.')) + '</p>';
  }

  // ── Render / events ──────────────────────────────────────────────
  function render() {
    var h = card('prfOvTitle'); if (h) h.textContent = T('Campaign Overview');
    if (!card('ovtPeriod')) return;
    var g = ++S.gen;
    A.connections().then(function (conn) { if (g !== S.gen) return; renderPeriod(g, conn); renderAds(g, conn); });
  }
  document.addEventListener('click', function (e) {
    var root = card('prfDash'); if (!root || !root.contains(e.target)) return;
    var m = e.target.closest('[data-ovc-mode]'); if (m) { S.mode = m.getAttribute('data-ovc-mode'); var g = ++S.gen; A.connections().then(function (c) { renderPeriod(g, c); renderAds(g, c); }); return; }
    if (e.target.closest('[data-ovc-connect]')) { if (typeof window.bizGoTo === 'function') window.bizGoTo('connections'); return; }
    if (e.target.closest('[data-ovc-meta]')) { if (typeof window.prfSwitchPlatform === 'function') window.prfSwitchPlatform('meta', true); return; }
    if (e.target.closest('[data-ovc-retry]')) { A.reset(); S.ads = null; render(); }
  });
  document.addEventListener('change', function (e) {
    var root = card('prfDash'); if (!root || !root.contains(e.target)) return;
    var el = e.target;
    if (el.matches('[data-ovc-date]')) {
      var k = el.getAttribute('data-ovc-date'), pr = periods();
      S.aSince = S.aSince || pr.a.since; S.aUntil = S.aUntil || pr.a.until; S.bSince = S.bSince || pr.b.since; S.bUntil = S.bUntil || pr.b.until;
      S[k] = el.value; if (valid(S.aSince, S.aUntil) && valid(S.bSince, S.bUntil)) render();
    } else if (el.matches('[data-ovc-ad]')) { S['ad' + el.getAttribute('data-ovc-ad')] = el.value; render(); }
    else if (el.matches('[data-ovc-days]')) { S.adDays = +el.value; render(); }
    else if (el.matches('[data-ovc-admetric]')) { S.adMetric = el.value; render(); }
  });

  // Re-render when the page's platform / campaign / period / level changes, on showing the page and on a language change.
  var pending = null;
  function schedule() { clearTimeout(pending); pending = setTimeout(function () { var pg = document.getElementById('page-performance'); if (pg && pg.classList.contains('active')) render(); }, 60); }
  function wrap(name) {
    var f = window[name]; if (typeof f !== 'function' || f._ovc) return;
    var w = function () { var out = f.apply(this, arguments); schedule(); return out; }; w._ovc = true; window[name] = w;
  }
  function init() {
    var pg = document.getElementById('page-performance'); if (!pg) return;
    ['prfSwitchPlatform', 'prfSwitchCampaign', 'prfSetRange', 'prfApplyCustomRange', 'prfSwitchHierarchy'].forEach(wrap);
    if (!pg._ovc) { pg._ovc = true; new MutationObserver(function () { if (pg.classList.contains('active')) schedule(); }).observe(pg, { attributes: true, attributeFilter: ['class'] }); }
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._ovc) {
      var orig = window.applyLanguage;
      window.applyLanguage = function () { var r = orig.apply(this, arguments); try { schedule(); } catch (_) {} return r; };
      window.applyLanguage._ovc = true;
    }
    if (pg.classList.contains('active')) schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { setTimeout(init, 0); });
  window.orvOverviewCompare = { render: render, _state: function () { return S; } };
})();
