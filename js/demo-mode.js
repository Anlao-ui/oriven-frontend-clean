/* ════════════════════════════════════════════════════════════════
   /demo: the real OrivenAI app with sample data, without an account.

   Loaded by app.html's first script, and only on /demo, BEFORE every other
   script. It makes the page self-contained:

   1. Network: fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon and
      window.open are replaced. Every OrivenAI API call and every Supabase
      call is answered here from js/demo-data.js (static sample data); every
      other request is refused, except GETs of this site's own files and of
      the static script/font CDNs the app already uses. So a demo visit
      reaches no OrivenAI server, no AI provider, no ad platform and no
      Stripe: it costs nothing per visitor.
   2. Storage: localStorage and sessionStorage are in-memory copies for this
      page, so the demo never reads or changes a real signed-in visitor's
      data, and nothing from the demo survives a reload.
   3. Session: a fake signed-in session for the sample user "Sanne" of the
      fictional shop "Amber & Clay" (never valid on any server).
   4. AI actions answer with pre-written examples after a short wait.
      Paying, publishing, connecting accounts and deleting are refused with
      a short explanation.
   5. A banner says this is a demo with sample data, with the €1 offer.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!/^\/demo\/?$/.test(location.pathname)) return;
  if (window.ORV_DEMO) return;
  window.ORV_DEMO = true;

  // js/demo-data.js loads synchronously just before this file (app.html).
  var D = function () { return window.ORV_DEMO_DATA || { api: {}, builtAt: Date.now(), localCampaigns: [] }; };
  var UID = 'demo-amber';
  var EMAIL = 'sanne@amberandclay.example';
  var SB_KEY = 'sb-rsqfoqitooxmkyrkuyzi-auth-token';
  var MSG = {
    ai: 'This is a demo, so nothing is generated: you see a ready-made example instead.',
    blocked: 'This is a demo with sample data. Try OrivenAI for 2 weeks for €1 to do this with your own business.',
    pay: 'This is a demo, so there is nothing to buy here. Try OrivenAI for 2 weeks for €1 from the pricing page.',
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

  // ── Pre-written AI answers ────────────────────────────────────────
  var IMAGES = ['/assets/demo/ad2.jpg', '/assets/demo/ad4.jpg', '/assets/demo/ad5.jpg', '/assets/demo/ad6.jpg'];
  var imgTurn = 0;
  // One finished campaign per platform, written by hand for the sample shop.
  var LP = 'https://amberandclay.example/shop';
  var AUDIENCE = 'Gift buyers aged 25–45 in the Netherlands who like candles, interior design and handmade gifts';
  var CONCEPTS = [
    { angle: 'Burn time', hook: 'Sixty hours of warm light', cta: 'Shop now', adCopy: { headline: 'Sixty hours of warm light', primaryText: 'Each soy candle is poured by hand in small batches and burns for about 60 hours.', description: 'Free shipping over €50' } },
    { angle: 'Slow evenings', hook: 'Slow evenings, hand-poured', cta: 'Shop now', adCopy: { headline: 'Slow evenings, hand-poured', primaryText: 'Natural soy wax, cotton wicks and scents inspired by Dutch autumn walks.', description: 'Made in Utrecht' } },
    { angle: 'Gifting', hook: 'The gift that glows for weeks', cta: 'Shop gifts', adCopy: { headline: 'The gift that glows for weeks', primaryText: 'Wrapped by hand, with a note in your words. Ready to give.', description: 'Gift wrapping included' } },
  ];
  var EXAMPLES = {
    meta: { metaAds: { campaignObjective: 'Sales', budget: 25, targetAudience: AUDIENCE, placements: ['Facebook Feed', 'Instagram Feed', 'Instagram Stories', 'Reels'], primaryText: 'Soy candles poured by hand in small batches. About 60 hours of slow, warm light per candle.', headline: 'Slow evenings, hand-poured', description: 'Free shipping over €50', cta: 'Shop now' } },
    google: { googleAds: { campaignType: 'SEARCH', budget: 20, biddingStrategy: 'Maximise conversions', keywords: ['hand poured candles', 'soy candles netherlands', 'handmade candle gift', 'natural soy candle', 'scented candles utrecht', 'candle gift set'], headlines: ['Hand-Poured Soy Candles', '60 Hours of Warm Light', 'Made in Utrecht', 'Free Shipping Over €50', 'Gift Wrapping Included'], descriptions: ['Soy candles poured by hand in small batches. About 60 hours of slow, warm light.', 'Natural wax, cotton wicks, autumn scents. Wrapped by hand, ready to give.'] } },
    tiktok: { tiktokAds: { campaignObjective: 'Traffic', budget: 30, targetAudience: 'People aged 20–40 in the Netherlands interested in home decor, DIY and slow living', hook: 'POV: one candle, sixty hours of slow evenings', script: '0–2s: close-up of wax being poured. 2–6s: wick trimmed, candle lit in a dark room. 6–12s: time-lapse of an evening on the sofa. 12–15s: “Hand-poured in Utrecht. Link in bio.”', cta: 'Shop now', creatorStyleConcept: 'Calm studio footage, natural light, no voice-over, soft ambient sound' } },
    pinterest: { pinterestAds: { campaignObjective: 'Consideration', budget: 15, creativeType: 'image', title: 'Autumn candles, poured by hand', description: 'Natural soy candles with about 60 hours of warm light. Gift-wrapped and made in small batches in Utrecht.', cta: 'Shop now', boardSuggestion: 'Cosy autumn home' } },
  };
  EXAMPLES.snapchat = { snapchatAds: { campaignObjective: 'Traffic', budget: 15, headline: 'Sixty hours of warm light', brandName: 'Amber & Clay', cta: 'Shop now' }, metaAds: EXAMPLES.meta.metaAds };
  function examplePackage(body) {
    var plat = String((body && (body.platform || body.adPlatform)) || 'meta').toLowerCase();
    var key = /google/.test(plat) ? 'google' : /tiktok/.test(plat) ? 'tiktok' : /pinterest/.test(plat) ? 'pinterest' : /snap/.test(plat) ? 'snapchat' : 'meta';
    var pkg = JSON.parse(JSON.stringify(EXAMPLES[key]));
    pkg.campaignName = 'Candle season — autumn (example)';
    pkg.strategy = { goal: key === 'meta' || key === 'google' ? 'Sales' : 'Traffic', targetAudience: AUDIENCE, landingPageUrl: LP, budgetRecommendation: { amount: (pkg[key + 'Ads'] || {}).budget || 20 } };
    pkg.concepts = JSON.parse(JSON.stringify(CONCEPTS));
    if (key === 'tiktok') pkg.videoAssets = [{ ref: 'a', videoUrl: location.origin + '/assets/ads/TA3.mp4' }];
    else if (key !== 'google') pkg.visualConcepts = [{ conceptRef: 'a', generatedImageUrl: location.origin + IMAGES[0] }];
    pkg.demoExample = true;
    return pkg;
  }
  function exampleImage(body) {
    var p = String((body && (body.prompt || body.product)) || '').toLowerCase();
    var i = /oil|serum|botanic/.test(p) ? 1 : /mug|ceramic|tea|cup/.test(p) ? 2 : /glass|ring|jewel/.test(p) ? 3 : /candle|wax|autumn|gift/.test(p) ? 0 : (imgTurn++ % IMAGES.length);
    return location.origin + IMAGES[i];
  }
  function chatReply(body) {
    var m = String((body && (body.message || body.text)) || '').toLowerCase();
    var tail = '\n\n(This is a demo: this answer is a ready-made example, not generated for you.)';
    if (/budget|spend|cost|roas|cpa/.test(m)) return 'Candle season — prospecting on Meta returns the most per euro right now (about €4.70 back for every €1 over 30 days). I’d move €5 a day from the paused Gift guide campaign to it, and keep Retargeting as it is.' + tail;
    if (/headline|copy|text|ad|hook/.test(m)) return 'Three headlines for the autumn candles:\n1. Slow evenings, hand-poured\n2. Sixty hours of warm light\n3. The gift that glows for weeks\nThe second one leads with burn time, the thing reviewers praise most and few shops mention.' + tail;
    if (/pinterest|tiktok|snapchat|google|meta|platform/.test(m)) return 'For Amber & Clay: Meta and Google bring most sales today. Pinterest suits the gift season (people plan purchases there), TikTok works for the pottery workshop videos, and Snapchat reaches younger gift buyers at a low cost per click.' + tail;
    return 'Here’s what I’d do this week: 1) keep Candle season running, it has the best return; 2) start the gift campaign in the last week of October, because buying starts in early November; 3) test the burn-time headline against the scent headline.' + tail;
  }

  // ── 1. Network ────────────────────────────────────────────────────
  var nativeFetch = window.fetch.bind(window);
  var SAME = location.origin;
  var STATIC_CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
  var API_HOST = /^(https:\/\/oriven-backand-clean\.onrender\.com|http:\/\/(localhost|127\.0\.0\.1):5500)$/;
  var blockedLog = [];
  window.orvDemoBlocked = blockedLog; // for the tests: what the demo refused

  function json(status, data) { return new Response(status === 204 ? null : JSON.stringify(data), { status: status, headers: { 'Content-Type': 'application/json' } }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function parseBody(b) { try { return typeof b === 'string' ? JSON.parse(b) : null; } catch (_) { return null; } }

  var REFUSE = /^\/api\/(publish|create-checkout-session|create-portal-session|billing\/|account\/delete|schedule-plan-change|[a-z]+\/disconnect|[a-z]+\/campaign\/|automations|autopilot\/rules|manual-campaigns|signup|verify-email|resend-verification|website-monitor|onboarding\/(complete|goal)|setup\/)/;
  var AI = /^\/api\/(ai\/|research\/query|market-research|generate-[a-z-]+|video-ads\/generate|motion-graphics\/generate|product-shoots\/generate|creative\/|create\/analyze|ads\/(analyze|recommend)|business\/(website|reflection|validate)|campaigns\/compare|audiences)/;

  function api(method, path, query, body) {
    if (method === 'GET' || method === 'HEAD') {
      if (path === '/api/research/reports' || path.indexOf('/api/research/reports/') === 0) { var r = sample(path + query); return Promise.resolve(r === undefined ? json(404, { error: 'Not found in the demo' }) : json(200, r)); }
      var s = sample(path + query);
      return Promise.resolve(json(200, s === undefined ? {} : s));
    }
    if (path === '/api/create-checkout-session' || path === '/api/create-portal-session' || /^\/api\/billing\//.test(path)) return Promise.resolve(json(403, { ok: false, code: 'DEMO', error: MSG.pay }));
    if (path === '/api/ai/chat') return wait(1100).then(function () { return json(200, { ok: true, reply: chatReply(body), demo: true }); });
    if (path === '/api/ai/create-ad') return wait(1600).then(function () { return json(200, { ok: true, data: examplePackage(body), demo: true }); });
    if (/^\/api\/(generate-image|generate-logo|product-shoots\/generate)$/.test(path)) return wait(1400).then(function () { var u = exampleImage(body); return json(200, { ok: true, imageUrl: u, url: u, demo: true }); });
    if (AI.test(path)) return wait(900).then(function () { return json(403, { ok: false, code: 'DEMO', error: MSG.ai + ' ' + MSG.blocked }); });
    if (REFUSE.test(path)) return Promise.resolve(json(403, { ok: false, code: 'DEMO', error: MSG.blocked }));
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
    '.orv-demo-toast{position:fixed;z-index:2147483001;left:50%;bottom:76px;transform:translateX(-50%);max-width:min(460px,calc(100vw - 32px));padding:12px 16px;border-radius:12px;background:#1C1F1A;color:#ECEEE6;border:1px solid rgba(255,255,255,.14);font:14px/1.45 Geist,Inter,system-ui,sans-serif;box-shadow:0 12px 40px -12px rgba(0,0,0,.8)}' +
    '@media (prefers-reduced-motion:no-preference){.orv-demo-toast{animation:orvDemoIn .18s ease-out}@keyframes orvDemoIn{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}}';
  var toastTimer = null;
  function toast(text) {
    if (!document.body) return;
    var t = document.querySelector('.orv-demo-toast');
    if (!t) { t = document.createElement('div'); t.className = 'orv-demo-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }
  window.orvDemoToast = toast;
  // The offer as a new visitor sees it (the sample account itself has a plan,
  // so orvIntroCta() would hide it here).
  function cta() {
    var o = window.ORIVEN_INTRO_OFFER;
    return o && o.enabled ? 'Try 2 weeks for €' + o.price : 'Get started';
  }
  function banner() {
    if (document.querySelector('.orv-demo-bar')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var bar = document.createElement('div'); bar.className = 'orv-demo-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Demo');
    bar.innerHTML = '<span class="orv-demo-bar__dot" aria-hidden="true"></span><span class="orv-demo-bar__t"><b class="orv-demo-l">You’re viewing a demo</b><b class="orv-demo-s" aria-hidden="true">Demo</b><span> with sample data</span></span>' +
      '<a href="/signup" data-demo-cta>' + cta() + '</a><button type="button" aria-label="Make the demo banner smaller" title="Smaller">&#8722;</button>';
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
    // Messages from refused actions arrive as the app's own toasts; ours adds the way forward.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle); else settle();
  window.addEventListener('load', function () { setTimeout(settle, 600); setTimeout(settle, 2500); });
})();
