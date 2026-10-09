/* ════════════════════════════════════════════════════════════════
   OrivenAI site analytics (marketing site + /learn pages) — first-party,
   cookieless. Requires js/consent.js (statistics category).

   • Page views: one beacon per page (and per SPA route change) to the
     backend's /api/t. The browser sends no identifier; the server keeps a
     daily-rotating hash, never the IP (backend services/analytics.js).
   • First touch: the source of the visit (UTM tags, referrer host, landing
     page, whether it was a Google/LinkedIn/Meta ad click) is kept for this
     tab in sessionStorage and sent with the signup, so the account remembers
     how the person found OrivenAI. Captured once per tab; never overwritten.
   • Nothing runs when statistics are switched off (Cookie settings, Do Not
     Track or Global Privacy Control): signups then carry {optOut:true}.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.orvSiteAnalytics) return;
  var KEY = 'orv_first_touch_v1';
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5500' : 'https://oriven-backand-clean.onrender.com';
  var allowed = function () { return !!(window.orvConsent && window.orvConsent.statsAllowed()); };

  function cut(v, n) { return typeof v === 'string' ? v.slice(0, n) : undefined; }
  function capture() {
    var q; try { q = new URLSearchParams(location.search); } catch (_) { q = { get: function () { return null; } }; }
    var click = q.get('gclid') || q.get('gbraid') || q.get('wbraid') ? 'google' : q.get('li_fat_id') ? 'linkedin' : q.get('fbclid') && /cpc|paid/i.test(q.get('utm_medium') || '') ? 'meta' : undefined;
    return {
      source: cut(q.get('utm_source'), 80), medium: cut(q.get('utm_medium'), 60), campaign: cut(q.get('utm_campaign'), 100),
      referrer: cut(document.referrer ? document.referrer.split('?')[0] : '', 200), landing: cut(location.pathname, 200), click: click,
      firstSeen: new Date().toISOString(),
    };
  }
  function firstTouch() {
    if (!allowed()) return null;
    try {
      var v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (v) return v;
      v = capture();
      sessionStorage.setItem(KEY, JSON.stringify(v));
      return v;
    } catch (_) { return capture(); }
  }

  var lastPath = null, lastAt = 0;
  function send(kind, path) {
    if (!allowed()) return;
    var ft = firstTouch() || {};
    var q; try { q = new URLSearchParams(location.search); } catch (_) { q = { get: function () { return null; } }; }
    // Referrer and UTM tags describe how THIS page load arrived; on SPA route
    // changes the previous page is the referrer.
    var body = JSON.stringify({
      k: kind, p: path || location.pathname,
      r: kind === 'pageview' && lastPath ? location.origin + lastPath : (document.referrer || '').split('?')[0],
      us: lastPath ? undefined : cut(q.get('utm_source'), 80), um: lastPath ? undefined : cut(q.get('utm_medium'), 60), uc: lastPath ? undefined : cut(q.get('utm_campaign'), 100),
      c: lastPath ? undefined : ft.click,
    });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(API + '/api/t', new Blob([body], { type: 'text/plain' }))) return;
    } catch (_) {}
    try { fetch(API + '/api/t', { method: 'POST', body: body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(function () {}); } catch (_) {}
  }

  function pageview(path) {
    if (window.ORV_NO_PAGEVIEW) return;
    path = path || location.pathname;
    var now = Date.now();
    if (path === lastPath && now - lastAt < 1500) return; // same route reported twice by the SPA
    send('pageview', path);
    lastPath = path; lastAt = now;
  }

  window.orvSiteAnalytics = {
    pageview: pageview,
    signupStarted: function () { send('signup_started', '/signup'); },
    // Attribution sent with signup requests (sanitized and classified on the server).
    attribution: function () { return allowed() ? (firstTouch() || undefined) : { optOut: true }; },
  };

  // A visitor who switches statistics off loses the stored first touch.
  document.addEventListener('orv:consent', function (e) {
    if (e.detail && !e.detail.stats) { try { sessionStorage.removeItem(KEY); } catch (_) {} }
  });

  firstTouch(); // capture on the landing page, before any navigation
  if (!window.ORV_NO_PAGEVIEW) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { pageview(); }); else pageview();
  }
})();
