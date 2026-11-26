/* ════════════════════════════════════════════════════════════════
   Advertising Settings (#page-ad-settings) — the advertising
   configuration centre: per platform and per ad account, the tracking
   and measurement infrastructure OrivenAI can genuinely manage.

   One platform at a time (switcher at the top), always with the ad
   account it applies to. What each control does is decided by the
   backend capability registry (oriven-backend services/
   platformCapabilities.js) and its real endpoints (/api/setup/*):

     Native in OrivenAI   Meta Pixel (create/reuse, health), Meta
                          Conversions API test (with Meta's own test
                          code), Google conversion action (create/reuse,
                          status) and its real tag snippet, Pinterest
                          Tag (create/reuse, health), Pinterest
                          Conversions API test (Pinterest's test mode),
                          TikTok pixel linking + one test event.
     Guided               creating a TikTok or Snap Pixel, installing
                          any pixel on a website, domain verification,
                          attribution: the official page + what to do.
   Statuses only from real responses. A pixel id is "ID available —
   installation not verified" until the platform reports an event;
   nothing is "Active" because an id exists. Every create/send asks for
   confirmation first and reports success only from the platform's
   answer. Tokens never reach the browser (all calls are server-side).
   Official links: verified against the platforms' own documentation
   (2026-11-25): see LINKS.
   window.orvAdSettings.open(platform?)
   Since 2026-11-26 it is shown inside Settings (the modal's content area,
   #smdp-ads → #asetEmbedRoot, opened by js/appNav.js orvSettingsAds): the
   platforms are chosen in the Settings navigation, the content is the same.
   The standalone page (#page-ad-settings) is only a fallback when the
   Settings modal isn't available.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit; if (!K) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-ad-settings', ROOT = 'asetRoot', EMBED_ROOT = 'asetEmbedRoot';
  var R = ROOT, EMBED = false; // where it is drawn now: the page, or inside Settings
  var PLATS = ['meta', 'google', 'tiktok', 'pinterest', 'snapchat'];
  var NAME = { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads', snapchat: 'Snapchat Ads' };
  // Official pages, each confirmed on the platform's own documentation:
  //  meta     developers.facebook.com/docs/meta-pixel/get-started → "Ads Manager > Events Manager"
  //  google   support.google.com/google-ads/answer/16560108 → "Summary within the Goals menu" (ads.google.com/aw/conversions)
  //  tiktok   ads.tiktok.com/help/article/get-started-pixel (official steps: Tools → Events Manager → Connect Data Source → Web)
  //  pinterest help.pinterest.com/en/business/article/install-the-pinterest-tag (official steps: Business → Conversions)
  //  snapchat businesshelp.snapchat.com/s/article/pixel-website-install (linked from Snap's Conversions API docs);
  //           developers.snap.com/marketing-api/Conversions-API/Introduction
  var LINKS = {
    meta: { url: 'https://business.facebook.com/events_manager', label: 'Open Meta Events Manager' },
    google: { url: 'https://ads.google.com/aw/conversions', label: 'Open Google Ads conversions' },
    tiktok: { url: 'https://ads.tiktok.com/help/article/get-started-pixel', label: 'TikTok: set up a pixel (official guide)' },
    pinterest: { url: 'https://help.pinterest.com/en/business/article/install-the-pinterest-tag', label: 'Pinterest: install the Pinterest Tag (official guide)' },
    snapchat: { url: 'https://businesshelp.snapchat.com/s/article/pixel-website-install?language=en_US', label: 'Snapchat: install the Snap Pixel (official guide)' },
    snapCapi: { url: 'https://developers.snap.com/marketing-api/Conversions-API/Introduction', label: 'Snap Conversions API documentation' },
  };
  // Where each piece of configuration happens, per platform (from the capability registry).
  var WHERE = { native: 'In OrivenAI', partial: 'In OrivenAI + your website', guided: 'Guided — on the platform', none: 'Not available in OrivenAI yet' };
  function whereLabel(p, w) { return T(WHERE[w]) + ((w === 'native' || w === 'partial') && !REAL_ACCOUNT_VERIFIED[p] ? ' · ' + T('not yet verified with a real account') : ''); }
  var MATRIX = {
    meta: [['Meta Pixel', 'native', 'Create or reuse the pixel on your ad account; OrivenAI reads whether it has received events.'], ['Pixel on your website', 'guided', 'Installing the base code is done on your website (or tag manager).'], ['Conversions API', 'native', 'Send a test event with Meta’s own test code; nothing counts as a real event.'], ['Standard & custom events', 'guided', 'Configured in Meta Events Manager.'], ['Domain verification', 'guided', 'Done in Meta’s business settings.'], ['Attribution settings', 'guided', 'Set per ad set in Meta Ads Manager.']],
    google: [['Conversion action', 'native', 'Create or reuse a conversion action on your Google Ads account and read its status.'], ['Google tag code', 'partial', 'OrivenAI shows the real tag code Google generates; installing it is done on your website.'], ['Enhanced conversions', 'guided', 'Turned on in Google Ads (Goals → Conversions).'], ['Attribution & counting', 'guided', 'Set per conversion action in Google Ads.']],
    tiktok: [['TikTok Pixel', 'guided', 'Created in TikTok Events Manager — TikTok’s API doesn’t offer pixel creation to OrivenAI.'], ['Link pixel to ad account', 'native', 'Link an existing pixel (by its code) to your ad account.'], ['Events API', 'native', 'Send one test event to your pixel.'], ['Attribution settings', 'guided', 'Set in TikTok Ads Manager.']],
    pinterest: [['Pinterest Tag', 'native', 'Create or reuse the Tag on your ad account; OrivenAI reads its status.'], ['Tag on your website', 'guided', 'Installing the base code is done on your website.'], ['Conversions API', 'native', 'Validate a test event with Pinterest’s test mode; it isn’t recorded.'], ['Attribution settings', 'guided', 'Set in Pinterest Ads Manager.']],
    snapchat: [['Snap Pixel', 'guided', 'Created and installed via Snapchat Ads Manager.'], ['Conversions API', 'none', 'Snap offers a Conversions API with a validation mode; OrivenAI doesn’t send to it yet.'], ['Attribution settings', 'guided', 'Set in Snapchat Ads Manager.']],
  };

  // Copy is English here and translated through js/workspaceI18n.js (keyed by the English text).
  function T(s, v) { var f = window.orvWsT; if (f) return f(s, v); return v ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : s; }

  // Real-account verification of the native actions. These calls go to each
  // platform's official API (server-side adapters), but so far they have only
  // been tested against simulated platform responses — never against a real
  // ad account. Flip a platform to true ONLY after its create/read/test actions
  // have actually been run against a real account and checked in the
  // platform's own interface. Until then the page says so on every action.
  var REAL_ACCOUNT_VERIFIED = { meta: false, google: false, pinterest: false, tiktok: false };
  function unverified(p) {
    if (REAL_ACCOUNT_VERIFIED[p]) return '';
    return '<p class="aset-unverified" data-aset-unverified="' + p + '"><span class="aset-unverified__tag">' + esc(T('Not yet verified with a real ad account')) + '</span> ' +
      esc(T('These actions use {p}’s official API, but OrivenAI has only tested them against simulated responses so far. Check the result in {p} itself.', { p: NAME[p] })) + '</p>';
  }

  var S = fresh(null);
  function fresh(uid) { return { uid: uid, plat: 'meta', conn: {}, setup: {}, data: {}, busy: {}, msg: {}, confirm: null, googleName: 'Purchase', tiktokCode: '', metaTestCode: '' }; }

  // Everyone who opens Advertising Settings gets it inside Settings.
  function open(p) {
    if (typeof window.orvSettingsAds === 'function' && document.getElementById('smdp-ads')) { window.orvSettingsAds(p && PLATS.indexOf(p) >= 0 ? p : S.plat); return; }
    openPage(p);
  }
  // Inside Settings: the platform's settings in the modal's content area.
  function openIn(host, p) {
    if (!host) return;
    var root = document.getElementById(EMBED_ROOT);
    if (!root) { root = document.createElement('div'); root.id = EMBED_ROOT; host.appendChild(root); }
    if (!host._asetBound) { host._asetBound = true; host.addEventListener('click', onClick); host.addEventListener('input', onInput); }
    if (K.uid() !== S.uid) S = fresh(K.uid());
    if (p && PLATS.indexOf(p) >= 0) { if (S.plat !== p) S.confirm = null; S.plat = p; }
    R = EMBED_ROOT; EMBED = true;
    hookLang();
    render();
    if (!S.conn[S.plat] || !S.conn[S.plat].ok) loadPlatform(S.plat);
  }
  function openPage(p) {
    R = ROOT; EMBED = false;
    if (!K.mount(PAGE, ROOT, onClick)) return;
    var pg = document.getElementById(PAGE);
    if (pg && !pg._asetBound) { pg._asetBound = true; pg.addEventListener('input', onInput); }
    if (K.uid() !== S.uid) S = fresh(K.uid());
    if (p && PLATS.indexOf(p) >= 0) S.plat = p;
    K.show('adsettings', PAGE);
    hookLang();
    render();
    loadPlatform(S.plat);
  }

  // ── Data ───────────────────────────────────────────────────────
  function loadPlatform(p) {
    if (S.conn[p] && S.conn[p].loading) return;
    S.conn[p] = { loading: true };
    api('/api/' + p + '/status').then(function (r) {
      var d = r.ok && r.data ? r.data : null;
      var a = d && d.active_ad_account;
      S.conn[p] = { loading: false, ok: r.ok, connected: !!(d && (d.connected || d.status === 'connected')), expired: !!(d && d.status === 'expired'), account: a ? { id: a.id || a.account_id || a.customer_id || a.advertiser_id || '', name: a.name || a.account_name || a.descriptive_name || a.advertiser_name || '' } : null, err: r.ok ? '' : K.refused(r) };
      if (p !== 'snapchat') api('/api/setup/' + p + '/status').then(function (x) { S.setup[p] = x.ok ? x.data : null; if (S.plat === p) render(); });
      if (S.conn[p].connected) loadTracking(p);
      if (S.plat === p) render();
    });
  }
  // Live reads from the platform — only for the open platform, and again only on "Refresh".
  function loadTracking(p) {
    if (p === 'meta') get('meta', 'pixel', '/api/setup/meta/tracking/health');
    if (p === 'pinterest') get('pinterest', 'tag', '/api/setup/pinterest/tag/health');
    if (p === 'google') { get('google', 'conversion', '/api/setup/google/conversions/' + encodeURIComponent(S.googleName) + '/status'); }
  }
  function get(p, key, path) {
    S.data[p] = S.data[p] || {}; S.data[p][key] = { loading: true };
    if (S.plat === p) render();
    api(path).then(function (r) { S.data[p][key] = r.ok ? { loading: false, v: r.data } : { loading: false, err: K.refused(r) }; if (S.plat === p) render(); });
  }

  // ── Render ─────────────────────────────────────────────────────
  function render() {
    var root = document.getElementById(R); if (!root) return;
    var p = S.plat, c = S.conn[p] || { loading: true };
    var tabs = '<div class="aset-plats" role="tablist" aria-label="' + esc(T('Advertising platform')) + '">' + PLATS.map(function (x) {
      var cx = S.conn[x], dot = !cx || cx.loading ? 'is-unknown' : cx.connected ? 'is-on' : cx.expired ? 'is-warn' : 'is-off';
      return '<button type="button" role="tab" class="aset-plat' + (x === p ? ' is-on' : '') + '" aria-selected="' + (x === p) + '" data-aset-plat="' + x + '"><i class="aset-dot ' + dot + '" aria-hidden="true"></i>' + esc(NAME[x]) + '</button>';
    }).join('') + '</div>';
    var head = K.head(T('Settings'), T('Advertising Settings'), T('Tracking, conversions and measurement for each advertising platform — set up in OrivenAI where the platform allows it, and guided step by step where it doesn’t.'),
      '<div class="aset-headact"><button type="button" class="rx-btn rx-btn-ghost" data-aset-general>' + esc(T('Account, billing & notifications')) + '</button></div>');
    if (EMBED) {
      // Inside Settings the platforms are picked in the Settings navigation: a compact heading instead of the page title and tabs.
      root.innerHTML = '<div class="aset aset--embed"><div class="aset-emb-h"><span class="aset-lbl">' + esc(T('Advertising Settings')) + '</span><h3 class="aset-emb-t">' + esc(NAME[p]) + '</h3>' +
        '<p class="aset-emb-d">' + esc(T('Tracking, conversions and measurement for each advertising platform — set up in OrivenAI where the platform allows it, and guided step by step where it doesn’t.')) + '</p></div>' +
        contextBar(p, c) + body(p, c) + '</div>';
      return;
    }
    root.innerHTML = '<div class="aset">' + head + tabs + contextBar(p, c) + body(p, c) + '</div>';
  }
  function contextBar(p, c) {
    var acct = c.account && (c.account.name || c.account.id) ? esc(c.account.name || c.account.id) + (c.account.name && c.account.id ? ' <span class="aset-muted">(' + esc(c.account.id) + ')</span>' : '') : '<span class="aset-muted">' + esc(T('No ad account selected')) + '</span>';
    var state = c.loading ? esc(T('Checking connection…')) : c.connected ? '<i class="aset-dot is-on" aria-hidden="true"></i>' + esc(T('Connected')) : c.expired ? '<i class="aset-dot is-warn" aria-hidden="true"></i>' + esc(T('Connection expired')) : '<i class="aset-dot is-off" aria-hidden="true"></i>' + esc(T('Not connected'));
    return '<section class="aset-ctx" aria-label="' + esc(T('What you are configuring')) + '"><div><span class="aset-lbl">' + esc(T('Platform')) + '</span><b>' + esc(NAME[p]) + '</b></div><div><span class="aset-lbl">' + esc(T('Ad account')) + '</span><b>' + acct + '</b></div><div><span class="aset-lbl">' + esc(T('Connection')) + '</span><b>' + state + '</b></div>' +
      '<button type="button" class="rx-btn rx-btn-ghost" data-aset-platforms>' + esc(T(c.connected ? 'Change account' : 'Connect')) + '</button></section>';
  }
  function body(p, c) {
    if (c.loading) return '<section class="rx-card"><p class="aset-muted">' + esc(T('Checking your {p} connection…', { p: NAME[p] })) + '</p></section>';
    var parts = [];
    if (!c.connected) parts.push('<section class="rx-card aset-empty"><h2 class="aset-h">' + esc(T(c.expired ? '{p} needs to be reconnected' : '{p} isn’t connected', { p: NAME[p] })) + '</h2><p class="aset-sub">' + esc(T('Connect {p} and choose an ad account to manage its tracking here.', { p: NAME[p] }) + (c.expired ? ' ' + T('The connection expired; reconnecting keeps your settings.') : '')) + '</p><button type="button" class="rx-btn rx-btn-primary" data-aset-platforms>' + esc(c.expired ? T('Reconnect') : T('Connect {p}', { p: NAME[p] })) + '</button></section>');
    else if (!c.account) parts.push('<section class="rx-card aset-empty"><h2 class="aset-h">' + esc(T('Choose an ad account')) + '</h2><p class="aset-sub">' + esc(T('Tracking is set up per ad account. Choose which {p} ad account OrivenAI works with.', { p: NAME[p] })) + '</p><button type="button" class="rx-btn rx-btn-primary" data-aset-platforms>' + esc(T('Choose ad account')) + '</button></section>');
    else parts = parts.concat(SECTIONS[p]());
    parts.push(matrixHtml(p));
    return '<div class="aset-grid">' + parts.join('') + '</div>';
  }

  // Shared pieces
  function status(kind, text) { return '<span class="aset-st aset-st--' + kind + '"><i aria-hidden="true"></i>' + text + '</span>'; }
  function msg(key) { var m = S.msg[key]; return m ? '<p class="aset-msg aset-msg--' + esc(m.kind) + '" role="status">' + esc(m.text) + '</p>' : ''; }
  function link(k) { var l = LINKS[k]; return '<a class="aset-ext" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(T(l.label)) + '<span class="aset-ext__i" aria-hidden="true">↗</span><span class="sr-only"> ' + esc(T('(opens in a new tab)')) + '</span></a>'; }
  function busyBtn(key, label, attrs, primary) { var b = S.busy[key]; return '<button type="button" class="rx-btn ' + (primary ? 'rx-btn-primary' : 'rx-btn-ghost') + '" ' + attrs + (b ? ' disabled' : '') + '>' + esc(T(b ? b : label)) + '</button>'; }
  function confirmBox(key, what) {
    if (S.confirm !== key) return '';
    var c = S.conn[S.plat] || {}, acct = c.account ? (c.account.name || c.account.id) : '';
    return '<div class="aset-confirm" role="dialog" aria-label="' + esc(T('Confirm')) + '">' +
      '<p><b>' + esc(what.title) + '</b></p><dl><dt>' + esc(T('Platform')) + '</dt><dd>' + esc(NAME[S.plat]) + '</dd><dt>' + esc(T('Ad account')) + '</dt><dd>' + esc(acct || '—') + '</dd><dt>' + esc(T('What happens')) + '</dt><dd>' + esc(what.does) + '</dd><dt>' + esc(T('Afterwards')) + '</dt><dd>' + esc(what.after) + '</dd></dl>' +
      (REAL_ACCOUNT_VERIFIED[S.plat] ? '' : '<p class="aset-unverified__line">' + esc(T('Not yet verified with a real ad account — check the result in {p} afterwards.', { p: NAME[S.plat] })) + '</p>') +
      '<div class="aset-acts"><button type="button" class="rx-btn rx-btn-primary" data-aset-go="' + esc(key) + '">' + esc(what.go) + '</button><button type="button" class="rx-btn rx-btn-ghost" data-aset-cancel>' + esc(T('Cancel')) + '</button></div></div>';
  }
  function card(id, title, sub, inner) { return '<section class="rx-card aset-card" aria-labelledby="' + id + '"><div class="aset-card__h"><h2 class="aset-h" id="' + id + '">' + esc(T(title)) + '</h2></div>' + (sub ? '<p class="aset-sub">' + sub + '</p>' : '') + inner + '</section>'; }
  function when(iso) { if (!iso) return ''; var d = new Date(isNaN(+iso) ? iso : +iso * 1000); return isNaN(d) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function diagnostics(p) {
    var st = S.setup[p], rv = st && st.remoteVerification;
    var last = rv && rv.checked ? (rv.ok ? status('ok', esc(T('Account verified with {p}', { p: NAME[p] }))) : status('warn', esc(T('{p} couldn’t confirm this account', { p: NAME[p] })))) + ' <span class="aset-muted">' + esc(when(rv.lastVerifiedAt)) + '</span>' : '<span class="aset-muted">' + esc(T('Not checked with {p} in this session yet.', { p: NAME[p] })) + '</span>';
    return card('asetDiag' + p, 'Diagnostics', esc(T('Checks the connection and ad account with {p} itself — a live check, only when you ask for it.', { p: NAME[p] })),
      '<div class="aset-row">' + last + '</div><div class="aset-acts">' + busyBtn('recheck', 'Check now', 'data-aset-recheck') + '</div>' + msg('recheck'));
  }

  // ── Per platform ───────────────────────────────────────────────
  var SECTIONS = {
    meta: function () {
      var d = (S.data.meta || {}).pixel || { loading: true }, v = d.v || {};
      var st = d.loading ? '<span class="aset-muted">' + esc(T('Reading your pixel from Meta…')) + '</span>' : d.err ? status('warn', esc(d.err)) :
        !v.exists ? status('off', esc(T('No pixel on this ad account'))) :
        v.receivingEvents ? status('ok', esc(T('Receiving events'))) + (v.lastFiredAt ? ' <span class="aset-muted">' + esc(T('last event {d}', { d: when(v.lastFiredAt) })) + '</span>' : '') :
        v.installed ? status('ok', esc(T('Has received events'))) + (v.lastFiredAt ? ' <span class="aset-muted">' + esc(T('last event {d}', { d: when(v.lastFiredAt) })) + '</span>' : '') :
        status('warn', esc(T('ID available — installation not verified')));
      var id = v.pixel && v.pixel.id ? '<div class="aset-kv"><span>' + esc(T('Pixel ID')) + '</span><code>' + esc(v.pixel.id) + '</code><button type="button" class="aset-link" data-aset-copy="' + esc(v.pixel.id) + '">' + esc(T('Copy')) + '</button></div>' + (v.pixel.name ? '<div class="aset-kv"><span>' + esc(T('Name')) + '</span><b>' + esc(v.pixel.name) + '</b></div>' : '') : '';
      var create = !d.loading && !d.err && !v.exists ? busyBtn('metaPixel', 'Create Meta Pixel', 'data-aset-ask="metaPixel"', true) : '';
      var steps = v.exists && !v.installed ? '<ol class="aset-steps"><li>' + esc(T('Open Meta Events Manager and choose this pixel.')) + '</li><li>' + esc(T('Install the base code on every page of your website — directly, through Google Tag Manager or your shop platform’s Meta integration.')) + '</li><li>' + esc(T('Come back and press Refresh: the status changes once Meta reports an event.')) + '</li></ol>' : '';
      var capi = v.exists ? card('asetMetaCapi', 'Conversions API (server-side events)', T('Sends events from a server instead of the browser. OrivenAI can send a <b>test</b> event to your pixel with Meta’s own test code, so it shows up only under Test events and never in your results.'),
        unverified('meta') + '<label class="aset-field"><span class="aset-lbl">' + esc(T('Test event code')) + '</span><input class="aset-in" data-aset-in="metaTestCode" placeholder="' + esc(T('e.g. {x}', { x: 'TEST12345' })) + '" value="' + esc(S.metaTestCode) + '" autocomplete="off"><span class="aset-hint">' + esc(T('Find it in Meta Events Manager → your pixel → Test events.')) + '</span></label>' +
        '<div class="aset-acts">' + busyBtn('metaCapi', 'Send test event', 'data-aset-metacapi' + (S.metaTestCode.trim() ? '' : ' disabled')) + '</div>' + msg('metaCapi')) : '';
      return [card('asetMetaPixel', 'Meta Pixel', esc(T('The pixel records what visitors do on your website, so Meta can measure and optimise your ads.')),
        unverified('meta') + '<div class="aset-row">' + st + (d.loading ? '' : ' <button type="button" class="aset-link" data-aset-refresh>' + esc(T('Refresh')) + '</button>') + '</div>' + id + create + confirmBox('metaPixel', { title: T('Create a Meta Pixel?'), does: T('OrivenAI asks Meta to create a pixel named “OrivenAI Pixel” on this ad account. If one exists already, it is reused — never duplicated.'), after: T('You install the pixel on your website. Until Meta reports an event, its status stays “installation not verified”.'), go: T('Create pixel') }) + msg('metaPixel') + steps +
        '<div class="aset-links">' + link('meta') + '</div>'), capi, diagnostics('meta')].filter(Boolean);
    },
    google: function () {
      var d = (S.data.google || {}).conversion || { loading: true }, v = d.v || {}, tag = (S.data.google || {}).tag;
      var st = d.loading ? '<span class="aset-muted">' + esc(T('Reading your conversion actions from Google…')) + '</span>' : d.err ? status('warn', esc(d.err)) :
        !v.exists ? status('off', esc(T('No conversion action named “{name}”', { name: S.googleName }))) :
        v.enabled ? status('ok', esc(T('Conversion action enabled'))) + ' <span class="aset-muted">' + esc(T('Google status: {s}', { s: v.status })) + '</span>' : status('warn', esc(T('Exists — Google status: {s}', { s: v.status || T('unknown') })));
      var tagHtml = '';
      if (v.exists) {
        var t = tag && tag.v;
        tagHtml = card('asetGoogleTag', 'Google tag code', esc(T('The real code Google generates for this conversion action. It works once it’s installed on your website; OrivenAI can’t install it for you or see whether it is installed.')),
          unverified('google') + (t && t.snippets && t.snippets.length ? t.snippets.slice(0, 2).map(function (sn) { return (sn.globalSiteTag ? '<p class="aset-lbl">' + esc(T('Google tag ({x})', { x: sn.pageFormat || sn.type || 'page' })) + '</p><pre class="aset-code">' + esc(sn.globalSiteTag) + '</pre>' : '') + (sn.eventSnippet ? '<p class="aset-lbl">' + esc(T('Event snippet')) + '</p><pre class="aset-code">' + esc(sn.eventSnippet) + '</pre>' : ''); }).join('') + status('warn', esc(T('Tag code available — installation not verified')))
            : tag && tag.err ? status('warn', esc(tag.err)) : tag && tag.loading ? '<span class="aset-muted">' + esc(T('Reading the tag code from Google…')) + '</span>' : t && !t.exists ? status('off', esc(T('Google returned no tag code for this action'))) : '') +
          '<div class="aset-acts">' + (tag && tag.v ? '' : busyBtn('googleTag', 'Show tag code', 'data-aset-googletag')) + '</div>');
      }
      var create = !d.loading && !d.err && !v.exists ? busyBtn('googleConv', 'Create conversion action', 'data-aset-ask="googleConv"', true) : '';
      return [card('asetGoogleConv', 'Conversion tracking', esc(T('A conversion action tells Google Ads which result counts — for example a purchase.')),
        unverified('google') + '<label class="aset-field"><span class="aset-lbl">' + esc(T('Conversion action name')) + '</span><span class="aset-pair"><input class="aset-in" data-aset-in="googleName" value="' + esc(S.googleName) + '" maxlength="100"><button type="button" class="rx-btn rx-btn-ghost" data-aset-refresh>' + esc(T('Check')) + '</button></span></label>' +
        '<div class="aset-row">' + st + '</div>' + create + confirmBox('googleConv', { title: T('Create the conversion action “{name}”?', { name: S.googleName }), does: T('OrivenAI asks Google Ads to create a conversion action with this name. If one with the same name exists, it is reused. Existing goals and primary actions are not changed.'), after: T('Install its tag code on your website; Google starts counting once the tag fires.'), go: T('Create conversion action') }) + msg('googleConv') +
        '<div class="aset-links">' + link('google') + '</div>'), tagHtml, diagnostics('google')].filter(Boolean);
    },
    tiktok: function () {
      return [card('asetTtPixel', 'TikTok Pixel', esc(T('TikTok doesn’t let OrivenAI create pixels. Create one in TikTok Events Manager (Tools → Events Manager → Connect Data Source → Web), then paste its pixel code here to link it to your ad account and test it.')),
        '<div class="aset-links">' + link('tiktok') + '</div>' + unverified('tiktok') +
        '<label class="aset-field"><span class="aset-lbl">' + esc(T('Pixel code')) + '</span><input class="aset-in" data-aset-in="tiktokCode" placeholder="' + esc(T('e.g. {x}', { x: 'C1ABCDEF2GHIJK3LMNOP' })) + '" value="' + esc(S.tiktokCode) + '" autocomplete="off"></label>' +
        '<div class="aset-acts">' + busyBtn('ttLink', 'Link to my ad account', 'data-aset-ttlink' + (S.tiktokCode.trim() ? '' : ' disabled')) + busyBtn('ttTest', 'Send test event', 'data-aset-ask="ttTest"' + (S.tiktokCode.trim() ? '' : ' disabled')) + '</div>' +
        confirmBox('ttTest', { title: T('Send a test event to this pixel?'), does: T('OrivenAI sends one ViewContent event to pixel {code} through TikTok’s Events API. TikTok doesn’t offer OrivenAI a separate test mode, so it is a real event.', { code: S.tiktokCode.trim() }), after: T('Check TikTok Events Manager to see that it arrived.'), go: T('Send event') }) +
        msg('ttLink') + msg('ttTest')), diagnostics('tiktok')];
    },
    pinterest: function () {
      var d = (S.data.pinterest || {}).tag || { loading: true }, v = d.v || {};
      var st = d.loading ? '<span class="aset-muted">' + esc(T('Reading your Tag from Pinterest…')) + '</span>' : d.err ? status('warn', esc(d.err)) :
        !v.exists ? status('off', esc(T('No Pinterest Tag on this ad account'))) :
        v.lastReceivedAt ? status('ok', esc(T('Has received events'))) + ' <span class="aset-muted">' + esc(T('last event {d}', { d: when(v.lastReceivedAt) })) + '</span>' :
        status('warn', esc(T('ID available — installation not verified'))) + (v.status ? ' <span class="aset-muted">' + esc(T('Pinterest status: {s}', { s: v.status })) + '</span>' : '');
      var id = v.tag && v.tag.id ? '<div class="aset-kv"><span>' + esc(T('Tag ID')) + '</span><code>' + esc(v.tag.id) + '</code><button type="button" class="aset-link" data-aset-copy="' + esc(v.tag.id) + '">' + esc(T('Copy')) + '</button></div>' : '';
      var create = !d.loading && !d.err && !v.exists ? busyBtn('pinTag', 'Create Pinterest Tag', 'data-aset-ask="pinTag"', true) : '';
      var capi = v.exists ? card('asetPinCapi', 'Conversions API (server-side events)', esc(T('OrivenAI validates a test event with Pinterest’s own test mode — Pinterest checks it but doesn’t record it.')),
        unverified('pinterest') + '<div class="aset-acts">' + busyBtn('pinCapi', 'Validate a test event', 'data-aset-pincapi') + '</div>' + msg('pinCapi')) : '';
      return [card('asetPinTag', 'Pinterest Tag', esc(T('The Tag records what visitors do on your website, so Pinterest can measure your ads.')),
        unverified('pinterest') + '<div class="aset-row">' + st + (d.loading ? '' : ' <button type="button" class="aset-link" data-aset-refresh>' + esc(T('Refresh')) + '</button>') + '</div>' + id + create +
        confirmBox('pinTag', { title: T('Create a Pinterest Tag?'), does: T('OrivenAI asks Pinterest to create a Tag on this ad account. If one exists, it is reused. Enhanced match stays off.'), after: T('Install the Tag on your website (Pinterest: Business → Conversions). Until Pinterest reports an event, it stays “installation not verified”.'), go: T('Create Tag') }) + msg('pinTag') +
        '<div class="aset-links">' + link('pinterest') + '</div>'), capi, diagnostics('pinterest')].filter(Boolean);
    },
    snapchat: function () {
      return [card('asetSnapPixel', 'Snap Pixel', esc(T('OrivenAI can’t create or read Snap Pixels yet: Snapchat’s documentation doesn’t offer this to OrivenAI. Create and install the pixel in Snapchat Ads Manager — the official guide walks you through it.')),
        '<div class="aset-links">' + link('snapchat') + '</div>'),
        card('asetSnapCapi', 'Conversions API', esc(T('Snap’s Conversions API (with a validation mode) exists, but OrivenAI doesn’t send events to it yet.')), '<div class="aset-links">' + link('snapCapi') + '</div>')];
    },
  };
  function matrixHtml(p) {
    return '<section class="rx-card aset-card aset-matrix" aria-labelledby="asetMx"><h2 class="aset-h" id="asetMx">' + esc(T('What you can configure for {p}', { p: NAME[p] })) + '</h2>' +
      '<div class="aset-tablewrap"><table><thead><tr><th scope="col">' + esc(T('Setting')) + '</th><th scope="col">' + esc(T('Where')) + '</th><th scope="col">' + esc(T('What it means')) + '</th></tr></thead><tbody>' +
      MATRIX[p].map(function (r) { return '<tr><th scope="row">' + esc(T(r[0])) + '</th><td><span class="aset-where aset-where--' + r[1] + '">' + esc(whereLabel(p, r[1])) + '</span></td><td>' + esc(T(r[2])) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="aset-muted">' + esc(T('Platforms differ in what they let other tools do; this list follows what each platform’s official API offers OrivenAI today.')) + '</p></section>';
  }

  // ── Actions ────────────────────────────────────────────────────
  function run(key, label, req, onOk) {
    S.busy[key] = label; S.msg[key] = null; S.confirm = null; render();
    req.then(function (r) {
      S.busy[key] = null;
      if (r.ok && r.data) onOk(r.data); else S.msg[key] = { kind: 'warn', text: K.refused(r) };
      render();
    });
  }
  function onClick(e) {
    var b = e.target.closest('button, a'); if (!b || b.disabled) return;
    var a = function (n) { return b.getAttribute(n); };
    var p = S.plat;
    if (b.hasAttribute('data-aset-plat')) { S.plat = a('data-aset-plat'); S.confirm = null; render(); if (!S.conn[S.plat] || !S.conn[S.plat].ok) loadPlatform(S.plat); return; }
    if (b.hasAttribute('data-aset-platforms')) { if (EMBED && typeof window.orvOpenAdPlatformsFromSettings === 'function') window.orvOpenAdPlatformsFromSettings(); else if (window.orvPages) window.orvPages.open('ad-platforms'); return; }
    if (b.hasAttribute('data-aset-general')) { if (window.orvPages) window.orvPages.open('settings'); return; }
    if (b.hasAttribute('data-aset-refresh')) { loadTracking(p); if (p === 'google') { (S.data.google || {}).tag = null; } return; }
    if (b.hasAttribute('data-aset-copy')) { var txt = a('data-aset-copy'); try { navigator.clipboard.writeText(txt); b.textContent = T('Copied'); } catch (_) {} return; }
    if (b.hasAttribute('data-aset-ask')) { S.confirm = a('data-aset-ask'); render(); return; }
    if (b.hasAttribute('data-aset-cancel')) { S.confirm = null; render(); return; }
    if (b.hasAttribute('data-aset-go')) {
      var k = a('data-aset-go');
      if (k === 'metaPixel') run(k, 'Creating…', api('/api/setup/meta/tracking', 'POST', { name: 'OrivenAI Pixel' }), function (d) {
        S.msg[k] = { kind: 'ok', text: T(d.created ? 'Meta created pixel {id}. Install it on your website next.' : 'This ad account already has pixel {id} — OrivenAI is using that one.', { id: d.pixel && d.pixel.id }) };
        S.data.meta.pixel = { loading: false, v: Object.assign({ pixel: d.pixel }, d.health || { exists: true }) };
      });
      if (k === 'googleConv') run(k, 'Creating…', api('/api/setup/google/conversions', 'POST', { name: S.googleName }), function (d) {
        S.msg[k] = { kind: 'ok', text: T(d.created ? 'Google Ads created the conversion action “{name}”.' : 'A conversion action named “{name}” already exists — OrivenAI is using it.', { name: S.googleName }) };
        get('google', 'conversion', '/api/setup/google/conversions/' + encodeURIComponent(S.googleName) + '/status');
      });
      if (k === 'pinTag') run(k, 'Creating…', api('/api/setup/pinterest/tag', 'POST', {}), function (d) {
        S.msg[k] = { kind: 'ok', text: T(d.created ? 'Pinterest created Tag {id}. Install it on your website next.' : 'This ad account already has Tag {id} — OrivenAI is using that one.', { id: d.tag && d.tag.id }) };
        get('pinterest', 'tag', '/api/setup/pinterest/tag/health');
      });
      if (k === 'ttTest') run(k, 'Sending…', api('/api/setup/tiktok/test-event', 'POST', { pixelCode: S.tiktokCode.trim(), event: 'ViewContent' }), function (d) {
        S.msg[k] = d.sent ? { kind: 'ok', text: T('TikTok accepted the event. Check TikTok Events Manager to see it arrive.') } : { kind: 'warn', text: T('TikTok didn’t accept the event — check the pixel code.') };
      });
      return;
    }
    if (b.hasAttribute('data-aset-metacapi')) run('metaCapi', 'Sending…', api('/api/setup/meta/conversions', 'POST', { eventName: 'PageView', testEventCode: S.metaTestCode.trim() }), function (d) {
      S.msg.metaCapi = d.sent ? { kind: 'ok', text: T('Meta received the test event{n}. You’ll see it under Test events in Events Manager.', { n: d.eventsReceived ? ' (' + d.eventsReceived + ')' : '' }) } : { kind: 'warn', text: T('Meta didn’t confirm receiving the event. Check the test code and try again.') };
    });
    if (b.hasAttribute('data-aset-pincapi')) run('pinCapi', 'Validating…', api('/api/setup/pinterest/events', 'POST', { eventName: 'page_visit', actionSource: 'web', test: true }), function (d) {
      S.msg.pinCapi = d.sent ? { kind: 'ok', text: T('Pinterest processed the test event in test mode — the Conversions API connection works.') } : { kind: 'warn', text: T('Pinterest didn’t process the test event.') };
    });
    if (b.hasAttribute('data-aset-googletag')) { S.data.google = S.data.google || {}; get('google', 'tag', '/api/setup/google/conversions/' + encodeURIComponent(S.googleName) + '/tag'); return; }
    if (b.hasAttribute('data-aset-ttlink')) {
      S.busy.ttLink = 'Linking…'; S.msg.ttLink = null; render();
      api('/api/setup/tiktok/business-centers').then(function (r) {
        var bc = r.ok && r.data && r.data.businessCenters && r.data.businessCenters[0];
        if (!bc) { S.busy.ttLink = null; S.msg.ttLink = { kind: 'warn', text: r.ok ? T('No TikTok Business Center found for this connection. Linking a pixel needs one.') : K.refused(r) }; render(); return; }
        return api('/api/setup/tiktok/pixel/link', 'POST', { bcId: bc.bcId, pixelCode: S.tiktokCode.trim() }).then(function (x) {
          S.busy.ttLink = null;
          S.msg.ttLink = x.ok && x.data ? { kind: 'ok', text: T(x.data.alreadyLinked ? 'This pixel is already linked to your ad account.' : 'TikTok linked the pixel to your ad account.') } : { kind: 'warn', text: K.refused(x) };
          render();
        });
      });
      return;
    }
    if (b.hasAttribute('data-aset-recheck')) run('recheck', 'Checking…', api('/api/setup/' + p + '/recheck', 'POST'), function (d) {
      S.msg.recheck = d.ok ? { kind: 'ok', text: T('{p} confirmed this ad account just now.', { p: NAME[p] }) } : { kind: 'warn', text: T('{p} couldn’t confirm this ad account — it may need attention in {p}.', { p: NAME[p] }) };
      api('/api/setup/' + p + '/status').then(function (x) { S.setup[p] = x.ok ? x.data : S.setup[p]; render(); });
    });
  }
  function onInput(e) {
    var el = e.target; if (!el || !el.hasAttribute || !el.hasAttribute('data-aset-in')) return;
    var k = el.getAttribute('data-aset-in'); S[k] = el.value.slice(0, 100);
    // enable/disable the buttons that need this field, without redrawing the field
    var on = !!S[k].trim();
    if (k === 'tiktokCode') document.querySelectorAll('#' + R + ' [data-aset-ttlink], #' + R + ' [data-aset-ask="ttTest"]').forEach(function (b) { if (!S.busy.ttLink && !S.busy.ttTest) b.disabled = !on; });
    if (k === 'metaTestCode') document.querySelectorAll('#' + R + ' [data-aset-metacapi]').forEach(function (b) { if (!S.busy.metaCapi) b.disabled = !on; });
  }

  // Language switch (Settings): redraw in the new language once the page has been opened.
  function hookLang() {
    if (typeof window.applyLanguage !== 'function' || window.applyLanguage._aset) return;
    var orig = window.applyLanguage;
    window.applyLanguage = function () { var r = orig.apply(this, arguments); try { if (document.getElementById(R)) render(); } catch (_) {} return r; };
    window.applyLanguage._aset = true;
  }
  hookLang();
  window.orvAdSettings = { open: open, openIn: openIn, openPage: openPage, current: function () { return S.plat; }, LINKS: LINKS, REAL_ACCOUNT_VERIFIED: REAL_ACCOUNT_VERIFIED, _state: function () { return S; } };
})();
