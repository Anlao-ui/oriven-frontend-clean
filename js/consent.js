/* ════════════════════════════════════════════════════════════════
   OrivenAI cookie & tracking consent (marketing site, app, /learn pages)

   Categories:
     essential   — always on: sign-in session, this choice itself.
     statistics  — OrivenAI's own cookieless page statistics and the
                   first-touch source of a signup (js/site-analytics.js).
                   No cookies, no IP stored, no third party; on by default
                   (low-impact first-party analytics), can be switched off
                   here. Do Not Track / Global Privacy Control switch it off.
     advertising — Google Ads (gtag.js, AW-18538836764). OFF until the
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
  var AW_ID = 'AW-18538836764'; // Google Ads account "OrivenAI" — the only one tracked here
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

  // Google Tag Assistant / tag debug sessions open the site with ?gtm_debug=…
  // (remembered for the tab, since links drop the parameter). The tag still
  // loads only after "Accept advertising" — the cookie policy says "The Google
  // Ads tag isn't loaded until you accept", so Advanced Consent Mode (loading
  // gtag.js before a choice) is deliberately not used. Instead, a debug session
  // without advertising consent asks once, even if "reject" was stored earlier,
  // rather than showing nothing; nothing is granted without the click.
  var DEBUG_KEY = 'orv_tag_debug', ASKED_KEY = 'orv_tag_debug_asked';
  var debugSession = /[?&]gtm_debug=/.test(location.search);
  try { if (debugSession) sessionStorage.setItem(DEBUG_KEY, '1'); else debugSession = sessionStorage.getItem(DEBUG_KEY) === '1'; } catch (_) {}
  function debugAsked() { try { return sessionStorage.getItem(ASKED_KEY) === '1'; } catch (_) { return false; } }
  function markDebugAsked() { try { sessionStorage.setItem(ASKED_KEY, '1'); } catch (_) {} }

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
  // Words in the app's language (window.CURRENT_LANG, js/settings.js);
  // the public site has no language setting and stays English.
  var TXT = {
    en: { title: 'Your privacy choices', body: 'OrivenAI uses essential storage to run the site and its own cookieless statistics to see which pages help people. With your permission, we also use Google Ads cookies to measure our advertising.', policy: 'Cookie policy', reject: 'Reject advertising', accept: 'Accept advertising', settings: 'Settings', sTitle: 'Cookie settings', ess: 'Essential', essD: 'Sign-in and this choice. Always on.', stats: 'Statistics', statsD: 'OrivenAI’s own page statistics and where a signup came from. No cookies, no IP address stored.', gpc: 'Off because your browser sends a privacy signal.', ads: 'Advertising', adsD: 'Google Ads cookies to measure our ads. Off unless you turn it on.', save: 'Save choices' },
    nl: { title: 'Jouw privacykeuzes', body: 'OrivenAI gebruikt noodzakelijke opslag om de site te laten werken en eigen statistieken zonder cookies om te zien welke pagina’s mensen helpen. Met jouw toestemming gebruiken we ook Google Ads-cookies om onze advertenties te meten.', policy: 'Cookiebeleid', reject: 'Advertenties weigeren', accept: 'Advertenties accepteren', settings: 'Instellingen', sTitle: 'Cookie-instellingen', ess: 'Noodzakelijk', essD: 'Inloggen en deze keuze. Altijd aan.', stats: 'Statistieken', statsD: 'De eigen paginastatistieken van OrivenAI en waar een aanmelding vandaan kwam. Geen cookies, geen IP-adres opgeslagen.', gpc: 'Uit omdat je browser een privacysignaal stuurt.', ads: 'Advertenties', adsD: 'Google Ads-cookies om onze advertenties te meten. Uit, tenzij je ze aanzet.', save: 'Keuzes opslaan' },
    de: { title: 'Deine Datenschutzeinstellungen', body: 'OrivenAI nutzt notwendige Speicherung für den Betrieb der Website und eigene Statistiken ohne Cookies, um zu sehen, welche Seiten helfen. Mit deiner Erlaubnis verwenden wir außerdem Google-Ads-Cookies, um unsere Werbung zu messen.', policy: 'Cookie-Richtlinie', reject: 'Werbung ablehnen', accept: 'Werbung akzeptieren', settings: 'Einstellungen', sTitle: 'Cookie-Einstellungen', ess: 'Notwendig', essD: 'Anmeldung und diese Auswahl. Immer an.', stats: 'Statistik', statsD: 'Die eigenen Seitenstatistiken von OrivenAI und woher eine Registrierung kam. Keine Cookies, keine IP-Adresse gespeichert.', gpc: 'Aus, weil dein Browser ein Datenschutzsignal sendet.', ads: 'Werbung', adsD: 'Google-Ads-Cookies, um unsere Anzeigen zu messen. Aus, bis du sie einschaltest.', save: 'Auswahl speichern' },
    fr: { title: 'Vos choix de confidentialité', body: 'OrivenAI utilise un stockage essentiel au fonctionnement du site et ses propres statistiques sans cookies pour voir quelles pages aident les visiteurs. Avec votre accord, nous utilisons aussi des cookies Google Ads pour mesurer nos publicités.', policy: 'Politique relative aux cookies', reject: 'Refuser la publicité', accept: 'Accepter la publicité', settings: 'Paramètres', sTitle: 'Paramètres des cookies', ess: 'Essentiels', essD: 'Connexion et ce choix. Toujours activés.', stats: 'Statistiques', statsD: 'Les statistiques de pages d’OrivenAI et l’origine d’une inscription. Pas de cookies, aucune adresse IP enregistrée.', gpc: 'Désactivées car votre navigateur envoie un signal de confidentialité.', ads: 'Publicité', adsD: 'Cookies Google Ads pour mesurer nos annonces. Désactivés sauf si vous les activez.', save: 'Enregistrer mes choix' },
    es: { title: 'Tus opciones de privacidad', body: 'OrivenAI usa almacenamiento esencial para que el sitio funcione y sus propias estadísticas sin cookies para ver qué páginas ayudan. Con tu permiso, también usamos cookies de Google Ads para medir nuestra publicidad.', policy: 'Política de cookies', reject: 'Rechazar publicidad', accept: 'Aceptar publicidad', settings: 'Ajustes', sTitle: 'Ajustes de cookies', ess: 'Esenciales', essD: 'Inicio de sesión y esta elección. Siempre activas.', stats: 'Estadísticas', statsD: 'Las estadísticas de páginas propias de OrivenAI y de dónde vino un registro. Sin cookies, sin guardar la dirección IP.', gpc: 'Desactivadas porque tu navegador envía una señal de privacidad.', ads: 'Publicidad', adsD: 'Cookies de Google Ads para medir nuestros anuncios. Desactivadas salvo que las actives.', save: 'Guardar opciones' },
    pt: { title: 'As suas escolhas de privacidade', body: 'A OrivenAI usa armazenamento essencial para o site funcionar e estatísticas próprias sem cookies para ver que páginas ajudam as pessoas. Com a sua autorização, usamos também cookies do Google Ads para medir a nossa publicidade.', policy: 'Política de cookies', reject: 'Recusar publicidade', accept: 'Aceitar publicidade', settings: 'Definições', sTitle: 'Definições de cookies', ess: 'Essenciais', essD: 'Sessão e esta escolha. Sempre ativos.', stats: 'Estatísticas', statsD: 'As estatísticas de páginas da própria OrivenAI e a origem de um registo. Sem cookies, sem endereço IP guardado.', gpc: 'Desligadas porque o seu navegador envia um sinal de privacidade.', ads: 'Publicidade', adsD: 'Cookies do Google Ads para medir os nossos anúncios. Desligados, a menos que os ative.', save: 'Guardar escolhas' }
  };
  function L() { var l = window.CURRENT_LANG; return TXT[l] || TXT.en; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
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
    var statsOn = statsAllowed(), adsOn = adsAllowed(), t = L();
    root.setAttribute('data-cc-view', settings ? 'settings' : 'banner');
    if (!settings) {
      root.innerHTML = '<h2 id="orvCcTitle">' + esc(t.title) + '</h2>' +
        '<p>' + esc(t.body) + ' <a href="/cookie-policy">' + esc(t.policy) + '</a></p>' +
        '<div class="orv-cc-row"><button type="button" data-cc-act="reject">' + esc(t.reject) + '</button><button type="button" data-cc-act="accept">' + esc(t.accept) + '</button><button type="button" class="orv-cc-link" data-cc-act="settings">' + esc(t.settings) + '</button></div>';
    } else {
      root.innerHTML = '<h2 id="orvCcTitle">' + esc(t.sTitle) + '</h2>' +
        '<div class="orv-cc-cat"><input type="checkbox" checked disabled id="orvCcEss"><label for="orvCcEss"><strong>' + esc(t.ess) + '</strong><span>' + esc(t.essD) + '</span></label></div>' +
        '<div class="orv-cc-cat"><input type="checkbox" id="orvCcStats"' + (statsOn ? ' checked' : '') + (privacySignal ? ' disabled' : '') + '><label for="orvCcStats"><strong>' + esc(t.stats) + '</strong><span>' + esc(t.statsD + (privacySignal ? ' ' + t.gpc : '')) + '</span></label></div>' +
        '<div class="orv-cc-cat"><input type="checkbox" id="orvCcAds"' + (adsOn ? ' checked' : '') + '><label for="orvCcAds"><strong>' + esc(t.ads) + '</strong><span>' + esc(t.adsD) + '</span></label></div>' +
        '<div class="orv-cc-row"><button type="button" data-cc-act="reject">' + esc(t.reject) + '</button><button type="button" class="orv-cc-strong" data-cc-act="save">' + esc(t.save) + '</button><button type="button" data-cc-act="accept">' + esc(t.accept) + '</button></div>';
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-cc-act]'); if (!b) return;
      var a = b.getAttribute('data-cc-act');
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
    // An open banner follows a language change in the app.
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._cc) {
      var orig = window.applyLanguage;
      window.applyLanguage = function () { var r = orig.apply(this, arguments); try { if (root) banner(root.getAttribute('data-cc-view') === 'settings'); } catch (_) {} return r; };
      window.applyLanguage._cc = true;
    }
  }

  // ── Google Ads "Signup" conversion ───────────────────────────────
  // Sent only (1) after /api/signup has created the account (the callers pass
  // the new account id — never on page load or form submit), (2) when the
  // visitor has granted advertising consent (otherwise nothing is sent or
  // queued), and (3) once per account: a localStorage marker plus Google's own
  // de-duplication via transaction_id. Resolves when Google confirms or after
  // a short timeout, so a redirect right after signup doesn't cut the hit off.
  // Label of the "Aanmelding" action in AW-18538836764 (Google's tag config
  // lists it under that account). Explicit send_to: never sent to another account.
  var SIGNUP_SEND_TO = AW_ID + '/gI2OCMrExasdEJzmgIhF';
  var signupInFlight = {};
  function trackSignupConversion(userId) {
    return new Promise(function (resolve) {
      var id = String(userId || '');
      if (!/^[0-9a-f-]{36}$/i.test(id) || !adsAllowed()) return resolve(false);
      var key = 'orv_signup_conv_' + id;
      try { if (localStorage.getItem(key)) return resolve(false); } catch (_) {}
      if (signupInFlight[id]) return resolve(false);
      signupInFlight[id] = true;
      try { localStorage.setItem(key, new Date().toISOString()); } catch (_) {}
      loadAds(); // already loaded once consent was given; never loads twice
      var done = false; var finish = function () { if (!done) { done = true; resolve(true); } };
      window.gtag('event', 'conversion', { send_to: SIGNUP_SEND_TO, transaction_id: 'signup-' + id, event_callback: finish });
      setTimeout(finish, 1500);
    });
  }

  window.orvConsent = {
    trackSignupConversion: trackSignupConversion,
    get: function () { return { decided: !!state, ads: adsAllowed(), stats: statsAllowed(), privacySignal: privacySignal, debugSession: debugSession, tagLoaded: adsLoaded }; },
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
  function start() {
    if (debugSession) {
      try { console.info('[OrivenAI consent] Google tag ' + AW_ID + (adsLoaded ? ' loaded (advertising consent granted).' : ' waits for advertising consent — choose "Accept advertising" to load it.')); } catch (_) {}
      if (state && !adsAllowed() && !debugAsked()) { markDebugAsked(); banner(false); return; }
    }
    if (!state) banner(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
