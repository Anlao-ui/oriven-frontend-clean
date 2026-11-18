/* ════════════════════════════════════════════════════════════════
   /demo-app: the real OrivenAI app with sample data, read-only.

   Shown inside the large modal on the marketing page /demo (index.html
   #view-demo, a sandboxed iframe), and on its own at /demo-app. Loaded by
   app.html's first script, only on /demo-app, BEFORE every other script:

   1. Network: fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon and
      window.open are replaced. Every OrivenAI API call and every Supabase
      call is answered here from js/demo-data.js (static sample data); every
      other request is refused, except GETs of this site's own files and of
      the static script/font CDNs the app already uses. A demo visit reaches
      no OrivenAI server, no AI provider, no ad platform and no Stripe: it
      costs nothing per visitor.
   2. Storage: localStorage and sessionStorage are in-memory copies for this
      page, so the demo never reads or changes a real signed-in visitor's
      data (it works the same signed in or not).
   3. Session: a fake signed-in session for the sample user "Sanne" of the
      fictional shop "Amber & Clay" (never valid on any server).
   4. Read-only: creating, generating, saving, connecting, publishing and
      paying show "Not available in the demo — Try 2 weeks for €1". The
      sample content (example ads, research report, plan, automations) is
      pre-written.
   5. In the modal the page shows no banner of its own (the marketing page
      around it carries the offer); links to the website open in the main
      window, never inside the frame.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!/^\/demo-app\/?$/.test(location.pathname)) return;
  if (window.ORV_DEMO) return;
  window.ORV_DEMO = true;

  // js/demo-data.js loads synchronously just before this file (app.html).
  var D = function () { return window.ORV_DEMO_DATA || { api: {}, builtAt: Date.now(), localCampaigns: [] }; };
  var UID = 'demo-amber';
  var EMAIL = 'sanne@amberandclay.example';
  var SB_KEY = 'sb-rsqfoqitooxmkyrkuyzi-auth-token';
  var FRAMED = (function () { try { return window.top !== window; } catch (_) { return true; } })();
  var NOT = 'Not available in the demo';
  var MSG = {
    ai: NOT + ' — Try 2 weeks for €1',
    blocked: NOT + ' — Try 2 weeks for €1',
    pay: NOT + ' — Try 2 weeks for €1',
  };

  // ── 2. Storage: in-memory, per page ───────────────────────────────
  function MemoryStorage() { this._m = {}; }
  MemoryStorage.prototype = {
    get length() { return Object.keys(this._m).length; },
    key: function (i) { var k = Object.keys(this._m); return i >= 0 && i < k.length ? k[i] : null; },
    getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem: function (k, v) { this._m[String(k)] = String(v); },
    removeItem: function (k) { delete this._m[String(k)]; },
    clear: function () { this._m = {}; },
  };
  var LS = new MemoryStorage(), SS = new MemoryStorage();
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return LS; } });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: function () { return SS; } });
  } catch (e) {
    // Never fall back to the real storage: without isolation there is no demo.
    document.documentElement.innerHTML = '<body style="background:#0B0C0A;color:#ECEEE6;font:16px system-ui;padding:40px">The demo can’t run in this browser. <a style="color:#B6FF3B" href="/">Back to OrivenAI</a></body>';
    throw e;
  }
  if (window.localStorage !== LS) throw new Error('demo storage not isolated');

  // The app keeps its page in the address bar as /app?view=…; in the demo it
  // stays /demo-app?view=…, so a reload keeps the demo (never the real /app).
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function (st, title, url) {
      if (url != null) {
        var u = String(url), o = location.origin;
        u = u.replace(new RegExp('^(' + o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')?/app(\\.html)?(?=[?#]|$)'), function (_, host) { return (host || '') + '/demo-app'; });
        url = u;
      }
      return orig.call(history, st, title, url);
    };
  });

  // ── 3. Session + seeded browser state ─────────────────────────────
  var FAR = 4102444800; // 2100-01-01: never refreshed
  var USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z', phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { first_name: 'Sanne' }, identities: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  var SESSION = { access_token: 'demo-token', token_type: 'bearer', expires_in: FAR - Math.floor(Date.now() / 1000), expires_at: FAR, refresh_token: 'demo-refresh', user: USER };
  LS.setItem(SB_KEY, JSON.stringify(SESSION));
  // Cookie choice for this page only: nothing optional (no tags in the demo).
  LS.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: false, hc: false, at: new Date().toISOString() }));
  try { LS.setItem('oriven_campaigns_' + UID, JSON.stringify(D().localCampaigns || []).replace(/"\/assets\//g, '"' + location.origin + '/assets/')); } catch (_) {}

  // ── Sample data, dates moved to "now" ─────────────────────────────
  var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
  function shift(v, delta) {
    if (typeof v === 'string') {
      // Sample media lives on this site; the app accepts absolute URLs only.
      if (/^\/assets\//.test(v)) return location.origin + v;
      if (ISO.test(v)) return new Date(Date.parse(v) + delta).toISOString();
      if (DAY.test(v)) { var t = Date.parse(v + 'T12:00:00Z'); return isNaN(t) ? v : new Date(t + Math.round(delta / 864e5) * 864e5).toISOString().slice(0, 10); }
      return v;
    }
    if (typeof v === 'number') { var b = D().builtAt; return v > b - 4e10 && v < b + 4e10 ? v + delta : v; }
    if (Array.isArray(v)) return v.map(function (x) { return shift(x, delta); });
    if (v && typeof v === 'object') { var o = {}; for (var k in v) o[k] = shift(v[k], delta); return o; }
    return v;
  }
  function sample(pathAndQuery) {
    var api = D().api || {}, p = pathAndQuery.split('?')[0];
    var hit = api[pathAndQuery];
    if (hit === undefined) hit = api[p];
    if (hit === undefined) { for (var k in api) { if (k.split('?')[0] === p) { hit = api[k]; break; } } }
    if (hit === undefined) return undefined;
    return shift(JSON.parse(JSON.stringify(hit)), Date.now() - D().builtAt);
  }
  function profileRow() {
    var r = Object.assign({}, D().profile || {}, { id: UID, email: EMAIL });
    r.access_expires_at = new Date(Date.now() + 21 * 864e5).toISOString();
    return r;
  }

  // ── 1. Network ────────────────────────────────────────────────────
  var nativeFetch = window.fetch.bind(window);
  var SAME = location.origin;
  var STATIC_CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
  var API_HOST = /^(https:\/\/oriven-backand-clean\.onrender\.com|http:\/\/(localhost|127\.0\.0\.1):5500)$/;
  var blockedLog = [];
  window.orvDemoBlocked = blockedLog; // for the tests: what the demo refused

  function json(status, data) { return new Response(status === 204 ? null : JSON.stringify(data), { status: status, headers: { 'Content-Type': 'application/json' } }); }
  function parseBody(b) { try { return typeof b === 'string' ? JSON.parse(b) : null; } catch (_) { return null; } }

  var REFUSE = /^\/api\/(publish|create-checkout-session|create-portal-session|billing\/|account\/delete|schedule-plan-change|[a-z]+\/disconnect|[a-z]+\/campaign\/|automations|autopilot\/rules|manual-campaigns|signup|verify-email|resend-verification|website-monitor|onboarding\/(complete|goal)|setup\/)/;
  var AI = /^\/api\/(ai\/|research\/query|market-research|generate-[a-z-]+|video-ads\/generate|motion-graphics\/generate|product-shoots\/generate|creative\/|create\/analyze|ads\/(analyze|recommend)|business\/(website|reflection|validate)|campaigns\/compare|audiences)/;

  // ── Sample daily figures for the metric tiles and Platform Comparison ──
  // (GET /api/analytics/series): the same numbers every time for a given
  // day, with a weekly rhythm; sizes that match the sample campaigns.
  var PROFILE = {
    google: { spend: 17.3, impressions: 830, clicks: 49, conversions: 1.4, aov: 56 },
    meta: { spend: 33, impressions: 2470, clicks: 72, conversions: 2.7, aov: 68 },
    tiktok: { spend: 14.2, impressions: 3120, clicks: 51, conversions: 0.6 },
    pinterest: { spend: 2.9, impressions: 470, clicks: 7, conversions: 0.12 },
    snapchat: { spend: 2.2, impressions: 1720, clicks: 64, conversions: 0 }, // the Snapchat integration doesn't fetch conversions (STAT_FIELDS)
  };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rnd(s) { var t = hash(s) + 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function dayStr(d) { return d.toISOString().slice(0, 10); }
  function demoSeries(qs) {
    var q = new URLSearchParams(qs || ''), p = q.get('platform'), base = PROFILE[p];
    if (!base) return null;
    var today = dayStr(new Date()), until = /^\d{4}-\d{2}-\d{2}$/.test(q.get('until') || '') && q.get('until') <= today ? q.get('until') : today;
    var since = /^\d{4}-\d{2}-\d{2}$/.test(q.get('since') || '') ? q.get('since') : dayStr(new Date(Date.parse(until) - 29 * 864e5)), clamped = null;
    if ((p === 'pinterest' || p === 'snapchat') && Date.parse(until) - Date.parse(since) > 89 * 864e5) { var min = dayStr(new Date(Date.parse(until) - 89 * 864e5)); clamped = { since: min, wanted: since }; since = min; }
    var scope = q.get('adId') ? 'ad:' + q.get('adId') : q.get('campaignId') ? 'c:' + q.get('campaignId') : 'all';
    var f = scope === 'all' ? 1 : (q.get('adId') ? 0.08 + rnd(scope) * 0.22 : 0.25 + rnd(scope) * 0.35);
    // Each sample ad has its own click-through, cost and conversion profile, so ad vs ad shows real differences.
    var ad = q.get('adId'), mClick = ad ? 0.7 + rnd(scope + 'ctr') * 0.75 : 1, mCost = ad ? 0.85 + rnd(scope + 'cpm') * 0.35 : 1, mConv = ad ? 0.55 + rnd(scope + 'cv') * 0.95 : 1;
    var valued = !!base.aov, series = [];
    for (var t = Date.parse(since + 'T00:00:00Z'); t <= Date.parse(until + 'T00:00:00Z'); t += 864e5) {
      var date = dayStr(new Date(t)), n = Math.round(t / 864e5), k = p + '|' + scope + '|' + date;
      var w = (1 + 0.16 * Math.sin(n * 2 * Math.PI / 7) + 0.06 * Math.sin(n / 9)) * (0.85 + rnd(k) * 0.3) * f;
      var conv = Math.max(0, Math.round(base.conversions * w * mClick * mConv * (0.6 + rnd(k + 'c') * 0.8) + (rnd(k + 'r') - 0.5)));
      series.push({ date: date, spend: Math.round(base.spend * w * mCost * 100) / 100, impressions: Math.round(base.impressions * w), clicks: Math.round(base.clicks * w * mClick * (0.9 + rnd(k + 'k') * 0.2)), conversions: conv,
        conversionValue: valued ? Math.round(conv * base.aov * (0.8 + rnd(k + 'v') * 0.4) * 100) / 100 : null });
    }
    return { platform: p, since: since, until: until, series: series, conversionValue: valued ? 'reported' : 'not_reported', clamped: clamped };
  }
  var DEMO_ADS = [['120200000001', 'Slow evenings — Feed'], ['120200000002', 'Sixty hours of warm light — Reels'], ['120200000003', 'Gift guide — Stories'], ['120200000004', 'Workshop teaser — Feed']];

  function api(method, path, query, body) {
    if ((method === 'GET' || method === 'HEAD') && path === '/api/analytics/series') {
      var ds = demoSeries(String(query || '').replace(/^\?/, ''));
      return Promise.resolve(ds ? json(200, ds) : json(400, { error: 'Choose a platform.', code: 'BAD_PLATFORM' }));
    }
    // The Campaign Overview graph reads kpi-series for Google, Meta and Pinterest: the same sample
    // days as above, so the graph, the metric cards and the comparisons tell one story.
    if ((method === 'GET' || method === 'HEAD') && path === '/api/intelligence/kpi-series') {
      var kq = new URLSearchParams(String(query || '').replace(/^\?/, '')), today = dayStr(new Date()), back = function (n) { return dayStr(new Date(Date.now() - n * 864e5)); };
      var key = kq.get('date_range') || 'LAST_30_DAYS', ks = back(29), ku = today, now = new Date();
      if (key === 'TODAY') ks = today; else if (key === 'YESTERDAY') { ks = ku = back(1); } else if (key === 'LAST_7_DAYS') ks = back(6); else if (key === 'LAST_90_DAYS') ks = back(89);
      else if (key === 'LAST_12_MONTHS' || key === 'LIFETIME') ks = back(364); else if (key === 'THIS_MONTH') ks = today.slice(0, 8) + '01';
      else if (key === 'LAST_MONTH') { var lm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)); ku = dayStr(lm); ks = ku.slice(0, 8) + '01'; }
      else if (key === 'CUSTOM' && /^\d{4}-\d{2}-\d{2}$/.test(kq.get('date_since') || '') && /^\d{4}-\d{2}-\d{2}$/.test(kq.get('date_until') || '')) { ks = kq.get('date_since'); ku = kq.get('date_until'); }
      var kd = demoSeries('platform=' + encodeURIComponent(kq.get('platform') || '') + '&since=' + ks + '&until=' + ku + (kq.get('campaignId') ? '&campaignId=' + encodeURIComponent(kq.get('campaignId')) : ''));
      if (!kd) return Promise.resolve(json(200, { series: [] }));
      var reach = kd.platform === 'meta' || kd.platform === 'pinterest';
      return Promise.resolve(json(200, { platform: kd.platform, series: kd.series.map(function (r) { return { date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, conversions_value: r.conversionValue, reach: reach ? Math.round(r.impressions / 1.7) : undefined }; }) }));
    }
    // Google overview: the sample snapshot predates CPM and impression share; add them from its own figures.
    if ((method === 'GET' || method === 'HEAD') && path === '/api/ads/overview') {
      var go = sample(path + query);
      if (go && go.overview) {
        var cpm = function (o) { return o.impressions ? Math.round((o.spend / o.impressions) * 1000 * 100) / 100 : null; };
        go.overview.avgCpm = cpm(go.overview); go.overview.searchImpressionShare = 63.4;
        (go.campaigns || []).forEach(function (c, i) { c.avgCpm = cpm(c); c.searchImpressionShare = [66.1, 58.9][i % 2]; });
      }
      return Promise.resolve(json(200, go === undefined ? {} : go));
    }
    // Meta campaigns: the sample snapshot predates link clicks and the shop funnel; add them from its own figures.
    if ((method === 'GET' || method === 'HEAD') && path === '/api/meta/campaigns') {
      var mc = sample(path + query);
      (mc && mc.campaigns || []).forEach(function (c) {
        if (c.clicks != null && c.linkClicks == null) c.linkClicks = Math.round(c.clicks * 0.78);
        if (c.conversions != null && c.addToCart == null) { c.addToCart = Math.round(c.conversions * 4.2); c.checkoutInitiated = Math.round(c.conversions * 1.9); }
      });
      return Promise.resolve(json(200, mc === undefined ? {} : mc));
    }
    if ((method === 'GET' || method === 'HEAD') && path === '/api/meta/ads') {
      return Promise.resolve(json(200, { ads: DEMO_ADS.map(function (a, i) { var w = 0.6 + rnd(a[0]) * 0.9; return { ad_id: a[0], ad_name: a[1], status: i === 3 ? 'PAUSED' : 'ACTIVE', spend: Math.round(160 * w) / 1, impressions: Math.round(14000 * w), clicks: Math.round(380 * w), conversions: Math.round(11 * w) }; }) }));
    }
    if (method === 'GET' || method === 'HEAD') {
      if (path === '/api/research/reports' || path.indexOf('/api/research/reports/') === 0) { var r = sample(path + query); return Promise.resolve(r === undefined ? json(404, { error: 'Not found in the demo' }) : json(200, r)); }
      var s = sample(path + query);
      return Promise.resolve(json(200, s === undefined ? {} : s));
    }
    // Read-only: anything that would create, generate, save, connect,
    // publish or pay is refused, with the same short message.
    if (path === '/api/create-checkout-session' || path === '/api/create-portal-session' || /^\/api\/billing\//.test(path) || AI.test(path) || REFUSE.test(path)) {
      toast(); return Promise.resolve(json(403, { ok: false, code: 'DEMO', error: MSG.blocked }));
    }
    // Harmless bookkeeping (preferences, read markers, events): accepted, not kept.
    return Promise.resolve(json(200, { ok: true, demo: true }));
  }

  function supabase(method, u, headers) {
    var p = u.pathname;
    if (/^\/auth\/v1\/user/.test(p)) return json(200, USER);
    if (/^\/auth\/v1\/token/.test(p)) return json(200, SESSION);
    if (/^\/auth\/v1\/logout/.test(p)) return json(204);
    if (/^\/auth\/v1\//.test(p)) return json(403, { error: 'demo', error_description: MSG.blocked, msg: MSG.blocked });
    if (/^\/rest\/v1\//.test(p)) {
      if (method !== 'GET' && method !== 'HEAD') return json(204);
      var one = /vnd\.pgrst\.object/.test(String(headers && (headers.get ? headers.get('accept') : (headers.Accept || headers.accept)) || ''));
      var row = /^\/rest\/v1\/profiles/.test(p) ? profileRow() : null;
      if (one) return row ? json(200, row) : json(406, { code: 'PGRST116', message: 'no rows' });
      return json(200, row ? [row] : []);
    }
    return json(403, { error: MSG.blocked }); // storage, functions, realtime
  }

  function demoFetch(input, init) {
    var req = (typeof Request !== 'undefined' && input instanceof Request) ? input : null;
    var url = req ? req.url : String(input && input.url ? input.url : input);
    var method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
    var u;
    try { u = new URL(url, location.href); } catch (_) { return Promise.reject(new TypeError('Invalid URL')); }
    var origin = u.origin;
    if (API_HOST.test(origin) || (origin === SAME && /^\/api\//.test(u.pathname))) {
      if (!/^\/api\//.test(u.pathname)) { blockedLog.push(method + ' ' + origin + u.pathname); return Promise.resolve(json(403, { ok: false, code: 'DEMO', error: MSG.blocked })); }
      var bodyIn = init && init.body;
      return api(method, u.pathname, u.search, parseBody(bodyIn));
    }
    if (/\.supabase\.co$/.test(u.hostname)) return Promise.resolve(supabase(method, u, (init && init.headers) || (req && req.headers)));
    if ((origin === SAME || STATIC_CDN.test(u.href)) && (method === 'GET' || method === 'HEAD')) return nativeFetch(input, init);
    blockedLog.push(method + ' ' + u.href.split('?')[0]);
    return Promise.reject(new TypeError('Blocked in the demo'));
  }
  window.fetch = demoFetch;

  // XMLHttpRequest: same-origin static GETs only.
  var NativeXHR = window.XMLHttpRequest;
  function DemoXHR() { var x = new NativeXHR(); var open = x.open, send = x.send, ok = true;
    x.open = function (m, url) { try { var u = new URL(url, location.href); ok = u.origin === SAME && /^(GET|HEAD)$/i.test(m) && !/^\/api\//.test(u.pathname); if (!ok) blockedLog.push(String(m).toUpperCase() + ' ' + u.href.split('?')[0]); } catch (_) { ok = false; } return open.apply(x, arguments); };
    x.send = function () { if (ok) return send.apply(x, arguments); setTimeout(function () { try { x.dispatchEvent(new Event('error')); } catch (_) {} if (typeof x.onerror === 'function') x.onerror(new Event('error')); }, 0); };
    return x; }
  DemoXHR.prototype = NativeXHR.prototype;
  window.XMLHttpRequest = DemoXHR;

  // Realtime / streams: never connect.
  function Dead(url) { blockedLog.push('SOCKET ' + String(url).split('?')[0]); var t = new EventTarget(); t.readyState = 3; t.close = function () {}; t.send = function () {}; setTimeout(function () { try { t.dispatchEvent(new Event('error')); t.dispatchEvent(new Event('close')); } catch (_) {} }, 0); return t; }
  Dead.CONNECTING = 0; Dead.OPEN = 1; Dead.CLOSING = 2; Dead.CLOSED = 3;
  window.WebSocket = Dead; window.EventSource = Dead;
  try { navigator.sendBeacon = function (url) { blockedLog.push('BEACON ' + String(url).split('?')[0]); return true; }; } catch (_) {}

  // New windows and links to other sites (OAuth, Stripe, help pages).
  var nativeOpen = window.open;
  window.open = function (url) {
    try { var u = new URL(url, location.href); if (u.origin === SAME && !/^\/(api|auth)\//.test(u.pathname)) return nativeOpen.apply(window, arguments); blockedLog.push('OPEN ' + u.href.split('?')[0]); } catch (_) {}
    toast(MSG.blocked); return null;
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
    if (u.protocol === 'mailto:') return;
    if (u.origin === SAME) {
      if (/^\/app(\.html)?$/.test(u.pathname)) { a.setAttribute('href', '/demo-app' + u.search + u.hash); return; }
      if (FRAMED && !/^\/demo-app/.test(u.pathname) && !/^#/.test(a.getAttribute('href') || '')) a.setAttribute('target', '_top');
    }
    if (API_HOST.test(u.origin) || /\.supabase\.co$/.test(u.hostname) || /stripe\.com$/.test(u.hostname)) { e.preventDefault(); e.stopPropagation(); blockedLog.push('LINK ' + u.href.split('?')[0]); toast(MSG.blocked); }
  }, true);

  // ── 5. Banner + messages ──────────────────────────────────────────
  var CSS = '' +
    '.orv-demo-bar{position:fixed;z-index:2147483000;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;max-width:calc(100vw - 32px);padding:8px 8px 8px 16px;border-radius:999px;background:#0B0C0A;color:#ECEEE6;border:1px solid rgba(255,255,255,.16);box-shadow:0 12px 40px -12px rgba(0,0,0,.8);font:500 13.5px/1.35 Geist,Inter,system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.orv-demo-bar__dot{width:8px;height:8px;border-radius:50%;background:#B6FF3B;flex:0 0 auto}' +
    '.orv-demo-bar__t{white-space:nowrap}.orv-demo-bar__t b{font-weight:600}' +
    '.orv-demo-bar a{flex:0 0 auto;display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:999px;background:#B6FF3B;color:#0B0C0A;font-weight:600;text-decoration:none;white-space:nowrap}' +
    '.orv-demo-bar a:hover{background:#C9FF6B}.orv-demo-bar a:focus-visible,.orv-demo-bar button:focus-visible{outline:2px solid #B6FF3B;outline-offset:2px}' +
    '.orv-demo-bar button{flex:0 0 auto;width:30px;height:30px;border-radius:50%;border:0;background:transparent;color:rgba(236,238,230,.6);font-size:16px;line-height:1;cursor:pointer}.orv-demo-bar button:hover{color:#ECEEE6;background:rgba(255,255,255,.08)}' +
    '.orv-demo-bar.is-min .orv-demo-bar__t span{display:none}.orv-demo-s{display:none}' +
    '@media (max-width:640px){.orv-demo-bar{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));transform:none;max-width:none;gap:10px;padding-left:14px}.orv-demo-bar__t{flex:1 1 auto;font-size:13px}.orv-demo-bar__t span,.orv-demo-l{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.orv-demo-s{display:inline}.orv-demo-bar a{padding:0 12px;font-size:13px}}' +
    '.orv-demo-toast a{color:#B6FF3B;font-weight:600;text-decoration:none;margin-left:6px;white-space:nowrap}.orv-demo-toast a:hover{text-decoration:underline}' +
    '.orv-demo-toast{position:fixed;z-index:2147483001;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(460px,calc(100vw - 32px));padding:12px 16px;border-radius:12px;background:#1C1F1A;color:#ECEEE6;border:1px solid rgba(255,255,255,.14);font:14px/1.45 Geist,Inter,system-ui,sans-serif;box-shadow:0 12px 40px -12px rgba(0,0,0,.8)}' +
    '@media (prefers-reduced-motion:no-preference){.orv-demo-toast{animation:orvDemoIn .18s ease-out}@keyframes orvDemoIn{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}}';
  var toastTimer = null;
  // "Not available in the demo — Try 2 weeks for €1" (the link opens the
  // signup in the main window).
  function toast(text) {
    if (!document.body) return;
    if (!document.getElementById('orvDemoCss')) { var st = document.createElement('style'); st.id = 'orvDemoCss'; st.textContent = CSS; document.head.appendChild(st); }
    var t = document.querySelector('.orv-demo-toast');
    if (!t) { t = document.createElement('div'); t.className = 'orv-demo-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    var c = cta();
    t.innerHTML = '<span>' + (text && text !== MSG.blocked ? String(text).replace(/[&<>]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]; }) : NOT) + '</span>' +
      (c ? ' <a href="/signup" target="_top" data-demo-cta>' + c + '</a>' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }
  window.orvDemoToast = toast;
  // The offer as a new visitor sees it (the sample account itself has a plan,
  // so orvIntroCta() would hide it here).
  function cta() {
    var o = window.ORIVEN_INTRO_OFFER;
    return o && o.enabled ? 'Try 2 weeks for €' + o.price : 'Get started';
  }
  function banner() {
    if (!document.getElementById('orvDemoCss')) { var st = document.createElement('style'); st.id = 'orvDemoCss'; st.textContent = CSS; document.head.appendChild(st); }
    if (FRAMED || document.querySelector('.orv-demo-bar')) return;
    var bar = document.createElement('div'); bar.className = 'orv-demo-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Demo');
    bar.innerHTML = '<span class="orv-demo-bar__dot" aria-hidden="true"></span><span class="orv-demo-bar__t"><b class="orv-demo-l">You’re viewing a demo</b><b class="orv-demo-s" aria-hidden="true">Demo</b><span> with sample data</span></span>' +
      '<a href="/signup" target="_top" data-demo-cta>' + cta() + '</a><button type="button" aria-label="Make the demo banner smaller" title="Smaller">&#8722;</button>';
    bar.querySelector('button').addEventListener('click', function () { var m = bar.classList.toggle('is-min'); this.innerHTML = m ? '&#43;' : '&#8722;'; this.setAttribute('aria-label', m ? 'Show the whole demo banner' : 'Make the demo banner smaller'); });
    document.body.appendChild(bar);
  }

  // ── After the app has started ─────────────────────────────────────
  function settle() {
    banner();
    document.title = 'OrivenAI demo · sample data';
    // No product tour or first-run dialogs over the demo.
    if (window.orvTour) { try { window.orvTour.open = function () {}; window.orvTour.close(); } catch (_) {} }
    document.querySelectorAll('#orvConsentBanner, .orv-cc').forEach(function (e) { e.remove(); });
    // Generating an ad or sending the assistant a message: the message instead
    // of the app's own request-and-error flow (nothing would be answered anyway).
    ['cgrGenerate', 'orvAiSend', 'crwsSendChat'].forEach(function (fn) {
      if (typeof window[fn] === 'function' && !window[fn]._demo) { var w = function () { toast(); return false; }; w._demo = true; window[fn] = w; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle); else settle();
  window.addEventListener('load', function () { setTimeout(settle, 600); setTimeout(settle, 2500); });
})();
