/* ════════════════════════════════════════════════════════════════
   Performance Overview → "Platform metrics" (#prfPlatformMetrics)

   The selected platform's own metrics for the page's period (and campaign),
   as period totals from GET /api/analytics/extras: reach and frequency,
   link clicks and landing page views, video, engagement and purchases —
   whatever that platform actually reports. Grouped, each with how the
   platform counts it. The comparable core (spend, impressions, clicks, CTR,
   CPC, CPM, conversions, CPA, value, ROAS) stays in the metric cards above;
   nothing here is added across platforms.

   Data integrity: a number is only shown when the platform returned it.
   "Not reported by <platform>" (the platform doesn't give it) and
   "Not available right now" (the platform refused or failed) are said in
   words, never shown as 0. Shows when it was fetched.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = window.orvAnalytics; if (!A || window.orvPlatformMetrics) return;
  var esc = A.esc, T = A.T;

  // key → [label, kind, definition per platform (falls back to '*')]
  var DEF = {
    reach: ['Reach', 'n', { '*': 'People who saw your ads at least once in this period, de-duplicated by the platform.', pinterest: 'Pinterest users who saw your Pins at least once (total impression users).' }],
    frequency: ['Frequency', 'f', { '*': 'Average number of times each person saw your ads (impressions ÷ reach).' }],
    linkClicks: ['Link clicks', 'n', { meta: 'Clicks on links in your ads that lead to a destination (Meta inline link clicks).' }],
    landingPageViews: ['Landing page views', 'n', { meta: 'Times your landing page loaded after a link click, as measured by the Meta pixel.' }],
    videoViews: ['Video views', 'n', { meta: 'Video plays of at least 3 seconds (Meta “3-second video plays”).', tiktok: 'Times your video started playing (replays not counted).', pinterest: 'Video views of at least 3 seconds.', snapchat: 'Qualified views: at least 2 seconds of watch time, or a swipe-up.' }],
    videoViews2s: ['2-second views', 'n', { tiktok: 'Plays of at least 2 seconds within one impression.' }],
    thruPlays: ['ThruPlays', 'n', { meta: 'Plays to completion, or of at least 15 seconds for longer videos.' }],
    videoQ25: ['Watched 25%', 'n', { snapchat: 'Plays that reached a quarter of the video.' }],
    videoQ50: ['Watched 50%', 'n', { snapchat: 'Plays that reached half of the video.' }],
    videoQ75: ['Watched 75%', 'n', { snapchat: 'Plays that reached three quarters of the video.' }],
    videoCompletions: ['Watched to the end', 'n', { '*': 'Plays that reached 100% of the video.' }],
    postEngagements: ['Post engagements', 'n', { meta: 'Reactions, comments, shares, saves, link clicks and other actions on your ads.' }],
    engagements: ['Engagements', 'n', { google: 'Engagements as Google Ads counts them (e.g. expanding a Lightbox ad, watching a video ad).', pinterest: 'Saves, closeups, link clicks and other actions on your Pins.' }],
    interactions: ['Interactions', 'n', { google: 'The main action for each ad format: clicks for text ads, views for video ads, and so on.' }],
    viewThroughConversions: ['View-through conversions', 'n', { google: 'Conversions after someone saw (but didn’t click) a display or video ad.' }],
    likes: ['Likes', 'n', { tiktok: 'Likes on your ads.' }],
    comments: ['Comments', 'n', { tiktok: 'Comments on your ads.' }],
    shares: ['Shares', 'n', { tiktok: 'Shares of your ads.' }],
    follows: ['Follows', 'n', { tiktok: 'New followers from your ads.' }],
    profileVisits: ['Profile visits', 'n', { tiktok: 'Visits to your TikTok profile from your ads.' }],
    swipeUps: ['Swipe-ups', 'n', { snapchat: 'Swipe-ups to your website (Snapchat counts these as clicks).' }],
    purchases: ['Purchases', 'n', { meta: 'Purchases attributed by Meta (pixel / Conversions API), with your account’s attribution setting.' }],
    purchaseValue: ['Purchase value', 'm', { meta: 'Value of those purchases as reported by Meta.' }],
    checkouts: ['Checkouts', 'n', { pinterest: 'Checkout events attributed by the Pinterest Tag.' }],
    checkoutValue: ['Checkout value', 'm', { pinterest: 'Value of those checkouts reported by the Pinterest Tag.' }],
  };
  var GROUPS = [
    ['Delivery', ['reach', 'frequency']],
    ['Traffic', ['linkClicks', 'landingPageViews', 'swipeUps', 'interactions']],
    ['Video', ['videoViews', 'videoViews2s', 'thruPlays', 'videoQ25', 'videoQ50', 'videoQ75', 'videoCompletions']],
    ['Engagement', ['postEngagements', 'engagements', 'likes', 'comments', 'shares', 'follows', 'profileVisits']],
    ['Conversions & revenue', ['purchases', 'purchaseValue', 'checkouts', 'checkoutValue', 'viewThroughConversions']],
  ];
  var S = { key: '', data: null, gen: 0 };

  function platform() { return window._prfActivePlatform || 'google'; }
  function currency() { return window.orvMetricCurrency || 'EUR'; }
  function win() {
    var r = window._prfActiveRange || 'LAST_30_DAYS', t = A.today();
    if (r === 'CUSTOM' && window._prfCustomSince && window._prfCustomUntil) return { since: window._prfCustomSince, until: window._prfCustomUntil };
    var n = r === 'LAST_7_DAYS' ? 7 : r === 'LAST_90_DAYS' ? 90 : 30;
    return { since: A.addDays(t, -(n - 1)), until: t };
  }
  function campaignId() {
    var key = window._prfActiveCampaign || 'all';
    if (key === 'all' || (window._prfHierarchy || 'campaigns') !== 'campaigns') return null;
    var ents = typeof window._prfActiveEntitiesForTiles === 'function' ? window._prfActiveEntitiesForTiles() : [];
    var e = ents.filter(function (x) { return x.key === key; })[0];
    return e && e.id ? String(e.id) : null;
  }
  function defOf(k, p) { var d = DEF[k][2]; return T(d[p] || d['*'] || ''); }
  function fmt(v, kind) {
    if (v == null) return '—';
    if (kind === 'f') return v.toFixed(2) + '×';
    return A.fmt(v, kind === 'm' ? 'm' : 'n', currency());
  }
  function host() { return document.getElementById('prfPlatformMetrics'); }

  function render() {
    var h = host(); if (!h) return;
    var p = platform(), w = win(), cid = campaignId();
    var key = [p, w.since, w.until, cid || ''].join('|');
    if (key === S.key && S.data) { paint(h, p); return; }
    S.key = key; S.data = null; var gen = ++S.gen;
    h.innerHTML = head(p) + '<div class="ova-loading" role="status">' + esc(T('Loading…')) + '</div>';
    if (typeof window.apiFetch !== 'function') return;
    var qs = 'platform=' + encodeURIComponent(p) + '&since=' + w.since + '&until=' + w.until + (cid ? '&campaignId=' + encodeURIComponent(cid) : '');
    window.apiFetch('/api/analytics/extras?' + qs).then(function (r) {
      if (gen !== S.gen) return;
      S.data = r && r.ok && r.data ? r.data : { failed: true, status: r && r.status, message: r && r.data && r.data.error };
      paint(host(), p);
    }, function () { if (gen !== S.gen) return; S.data = { failed: true }; paint(host(), p); });
  }
  function head(p) {
    return '<div class="pfm-h"><div><h2 id="prfPmH">' + esc(T('Platform metrics')) + '</h2><p class="pfm-sub">' + esc(T('{p} metrics for this period, exactly as {p} reports them. Not added up across platforms.', { p: A.NAME[p] })) + '</p></div></div>';
  }
  function paint(h, p) {
    if (!h) return;
    var d = S.data || {};
    if (d.failed) {
      var nc = d.status === 401 || d.status === 403 || d.status === 404 || d.status === 409;
      h.innerHTML = head(p) + '<div class="ova-empty">' + esc(nc ? T('{p} isn’t connected, so there are no platform metrics to show.', { p: A.NAME[p] }) : T('These metrics couldn’t be loaded right now. The figures above are unaffected.')) + '</div>';
      return;
    }
    if (!d.metrics && !d.error && !d.demo) { h.innerHTML = head(p) + '<div class="ova-empty">' + esc(T('These metrics couldn’t be loaded right now. The figures above are unaffected.')) + '</div>'; return; }
    if (d.demo && !d.metrics) { h.innerHTML = head(p) + '<div class="ova-empty">' + esc(T('Platform metrics come straight from your own ad accounts, so they aren’t part of the demo.')) + '</div>'; return; }
    if (d.error) { h.innerHTML = head(p) + '<div class="ova-empty">' + esc(T(d.error.message || 'Not available right now.')) + '</div>'; return; }
    var m = d.metrics || {};
    var groups = GROUPS.map(function (g) {
      var keys = g[1].filter(function (k) { return k in m; });
      if (!keys.length) return '';
      var open = g[0] === 'Delivery' || g[0] === 'Conversions & revenue' ? ' open' : '';
      return '<details class="pfm-grp"' + open + '><summary><span>' + esc(T(g[0])) + '</span><small>' + keys.length + '</small></summary><dl class="pfm-list">' + keys.map(function (k) {
        var v = m[k];
        return '<div class="pfm-m' + (v == null ? ' is-na' : '') + '"><dt>' + esc(T(DEF[k][0])) + '</dt><dd>' + (v == null ? '<span class="pfm-na">' + esc(T('Not returned')) + '</span>' : esc(fmt(v, DEF[k][1]))) + '</dd><p>' + esc(defOf(k, p)) + '</p></div>';
      }).join('') + '</dl></details>';
    }).join('');
    var missing = Object.keys(d.notReported || {}).filter(function (k) { return DEF[k]; }).map(function (k) { return T(DEF[k][0]); });
    var when = d.fetchedAt ? new Date(d.fetchedAt) : null;
    h.innerHTML = head(p) + (groups ? '<div class="pfm-grid">' + groups + '</div>' : '<div class="ova-empty">' + esc(T('{p} reports no extra metrics here.', { p: A.NAME[p] })) + '</div>') +
      '<p class="pfm-foot">' + (d.clamped ? esc(T('{p} keeps these figures for 90 days: shown from {d}.', { p: A.NAME[p], d: A.shortDate(d.since) })) + ' ' : '') +
      (missing.length ? esc(T('Not reported by {p}: {list}.', { p: A.NAME[p], list: missing.join(', ') })) + ' ' : '') +
      (when ? esc(T('Fetched {t}.', { t: when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })) : '') + '</p>';
  }

  var pending = null;
  function schedule() { clearTimeout(pending); pending = setTimeout(function () { var pg = document.getElementById('page-performance'); if (pg && pg.classList.contains('active')) render(); }, 80); }
  function wrap(name) { var f = window[name]; if (typeof f !== 'function' || f._pfm) return; var w2 = function () { var out = f.apply(this, arguments); schedule(); return out; }; w2._pfm = true; window[name] = w2; }
  function init() {
    var pg = document.getElementById('page-performance'); if (!pg) return;
    var dash = document.getElementById('prfDash');
    if (dash && !host()) { var s = document.createElement('section'); s.className = 'ova-card pfm'; s.id = 'prfPlatformMetrics'; s.setAttribute('aria-labelledby', 'prfPmH'); dash.parentNode.insertBefore(s, dash.nextSibling); }
    ['prfSwitchPlatform', 'prfSwitchCampaign', 'prfSetRange', 'prfApplyCustomRange', 'prfSwitchHierarchy'].forEach(wrap);
    if (!pg._pfm) { pg._pfm = true; new MutationObserver(function () { if (pg.classList.contains('active')) schedule(); }).observe(pg, { attributes: true, attributeFilter: ['class'] }); }
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._pfm) { var o = window.applyLanguage; window.applyLanguage = function () { var r = o.apply(this, arguments); try { if (S.data) paint(host(), platform()); } catch (_) {} return r; }; window.applyLanguage._pfm = true; }
    if (pg.classList.contains('active')) schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { setTimeout(init, 0); });
  window.orvPlatformMetrics = { render: render, DEF: DEF, GROUPS: GROUPS, _state: function () { return S; } };
})();
