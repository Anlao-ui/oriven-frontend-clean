/* ════════════════════════════════════════════════════════════════
   OrivenAI cookie & tracking consent (marketing site, app, /learn pages)

   Categories:
     essential   — always on: sign-in session, this choice itself.
     statistics  — OrivenAI's own cookieless page statistics and the
                   first-touch source of a signup (js/site-analytics.js).
                   No cookies, no IP stored, no third party; on by default
                   (low-impact first-party analytics), can be switched off
                   here. Do Not Track / Global Privacy Control switch it off.
     advertising — Google Ads (gtag.js, AW-18112493101). OFF until the
                   visitor explicitly accepts. Until then gtag.js is not
                   even loaded; Google Consent Mode v2 defaults are all
                   "denied" so nothing can be stored or sent before consent.

   The choice is kept in localStorage ("orv_consent_v1": strictly necessary
   to remember it) and can be changed any time via orvConsent.open() — the
   "Cookie settings" links in the footers.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.orvConsent) return;
  var KEY = 'orv_consent_v1';
  var AW_ID = 'AW-18112493101';
  var VERSION = 1;
  var privacySignal = (navigator.globalPrivacyControl === true) || (navigator.doNotTrack === '1') || (window.doNotTrack === '1');

  // Google Consent Mode v2 — denied by default, before anything else.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
    functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500,
  });

  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.v === VERSION ? v : null; } catch (_) { return null; }
  }
  function write(c) {
    var v = { v: VERSION, ads: !!c.ads, stats: !!c.stats, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {}
    return v;
  }
  var state = read();

  var adsLoaded = false;
  function loadAds() {
    if (adsLoaded) return;
    adsLoaded = true;
    window.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + AW_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', AW_ID);
  }
  function applyAds(granted) {
    if (granted) { loadAds(); return; }
    window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    // Withdrawn after loading: Google cookies set earlier are removed.
    if (adsLoaded) document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (/^(_gcl_|_gac_|_ga|IDE|test_cookie)/.test(n)) {
        var host = location.hostname.replace(/^www\./, '');
        ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) { document.cookie = n + '=; Max-Age=0; path=/' + d; });
      }
    });
  }

  function statsAllowed() {
    if (privacySignal) return false;
    return state ? state.stats !== false : true;
  }
  function adsAllowed() { return !!(state && state.ads); }

  function emit() { try { document.dispatchEvent(new CustomEvent('orv:consent', { detail: { ads: adsAllowed(), stats: statsAllowed() } })); } catch (_) {} }

  // ── UI ────────────────────────────────────────────────────────────
  var CSS = '' +
    '.orv-cc{position:fixed;z-index:99990;left:16px;right:16px;bottom:16px;max-width:560px;margin-left:auto;background:#121212;color:#F2F2F0;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:20px;box-shadow:0 20px 60px -20px rgba(0,0,0,.7);font:14.5px/1.55 Geist,system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.orv-cc h2{font-size:16px;font-weight:700;margin:0 0 6px}.orv-cc p{margin:0 0 14px;color:rgba(242,242,240,.75)}.orv-cc a{color:#B7FF2A}' +
    '.orv-cc-row{display:flex;flex-wrap:wrap;gap:10px}.orv-cc-row button{flex:1 1 140px;min-height:44px;border-radius:999px;font:600 14px Geist,system-ui,sans-serif;cursor:pointer;padding:0 18px;border:1px solid rgba(255,255,255,.2);background:#1d1d1d;color:#F2F2F0}' +
    '.orv-cc-row button.orv-cc-strong{background:#F2F2F0;color:#0A0A0A;border-color:#F2F2F0}.orv-cc-row button.orv-cc-link{flex:0 0 auto;background:none;border:0;color:rgba(242,242,240,.75);text-decoration:underline;padding:0 6px}' +
    '.orv-cc button:focus-visible,.orv-cc input:focus-visible{outline:2px solid #B7FF2A;outline-offset:2px}' +
    '.orv-cc-cat{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid rgba(255,255,255,.08)}.orv-cc-cat:last-of-type{margin-bottom:14px}' +
    '.orv-cc-cat input{width:20px;height:20px;margin-top:2px;accent-color:#B7FF2A;flex:0 0 auto}.orv-cc-cat strong{display:block;font-size:14.5px}.orv-cc-cat span{display:block;color:rgba(242,242,240,.65);font-size:13.5px}' +
    '@media (max-width:480px){.orv-cc{left:8px;right:8px;bottom:8px;padding:16px}}';
  var root = null;
  function ensureStyle() {
    if (document.getElementById('orvCcStyle')) return;
    var st = document.createElement('style'); st.id = 'orvCcStyle'; st.textContent = CSS; document.head.appendChild(st);
  }
  function close() { if (root && root.parentNode) root.parentNode.removeChild(root); root = null; }
  function save(c) {
    state = write(c);
    applyAds(state.ads);
    close();
    emit();
  }
  function banner(settings) {
    ensureStyle(); close();
    root = document.createElement('div');
    root.className = 'orv-cc'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'false'); root.setAttribute('aria-labelledby', 'orvCcTitle');
    var statsOn = statsAllowed(), adsOn = adsAllowed();
    if (!settings) {
      root.innerHTML = '<h2 id="orvCcTitle">Your privacy choices</h2>' +
        '<p>OrivenAI uses essential storage to run the site and its own cookieless statistics to see which pages help people. With your permission, we also use Google Ads cookies to measure our advertising. <a href="/cookie-policy">Cookie policy</a></p>' +
        '<div class="orv-cc-row"><button type="button" data-cc="reject">Reject advertising</button><button type="button" data-cc="accept">Accept advertising</button><button type="button" class="orv-cc-link" data-cc="settings">Settings</button></div>';
    } else {
      root.innerHTML = '<h2 id="orvCcTitle">Cookie settings</h2>' +
        '<div class="orv-cc-cat"><input type="checkbox" checked disabled id="orvCcEss"><label for="orvCcEss"><strong>Essential</strong><span>Sign-in and this choice. Always on.</span></label></div>' +
        '<div class="orv-cc-cat"><input type="checkbox" id="orvCcStats"' + (statsOn ? ' checked' : '') + (privacySignal ? ' disabled' : '') + '><label for="orvCcStats"><strong>Statistics</strong><span>OrivenAI’s own page statistics and where a signup came from. No cookies, no IP address stored.' + (privacySignal ? ' Off because your browser sends a privacy signal.' : '') + '</span></label></div>' +
        '<div class="orv-cc-cat"><input type="checkbox" id="orvCcAds"' + (adsOn ? ' checked' : '') + '><label for="orvCcAds"><strong>Advertising</strong><span>Google Ads cookies to measure our ads. Off unless you turn it on.</span></label></div>' +
        '<div class="orv-cc-row"><button type="button" data-cc="reject">Reject advertising</button><button type="button" class="orv-cc-strong" data-cc="save">Save choices</button><button type="button" data-cc="accept">Accept advertising</button></div>';
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-cc]'); if (!b) return;
      var a = b.getAttribute('data-cc');
      var statsBox = root.querySelector('#orvCcStats');
      var stats = statsBox ? statsBox.checked : statsAllowed();
      if (a === 'accept') save({ ads: true, stats: stats });
      else if (a === 'reject') save({ ads: false, stats: stats });
      else if (a === 'save') save({ ads: !!root.querySelector('#orvCcAds').checked, stats: stats });
      else if (a === 'settings') banner(true);
    });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state) close(); });
    (document.body || document.documentElement).appendChild(root);
    var first = root.querySelector('button, input:not([disabled])'); if (first && settings) first.focus();
  }

  window.orvConsent = {
    get: function () { return { decided: !!state, ads: adsAllowed(), stats: statsAllowed(), privacySignal: privacySignal }; },
    statsAllowed: statsAllowed, adsAllowed: adsAllowed,
    open: function () { banner(true); },
    set: function (c) { save({ ads: !!c.ads, stats: c.stats !== false }); },
  };

  // Footer/legal links: <a data-cookie-settings> or href="#cookie-settings".
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-cookie-settings],a[href="#cookie-settings"]');
    if (!a) return; e.preventDefault(); banner(true);
  });

  if (state && state.ads) loadAds();
  function start() { if (!state) banner(false); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
