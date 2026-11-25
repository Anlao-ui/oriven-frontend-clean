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
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit; if (!K) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-ad-settings', ROOT = 'asetRoot';
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
  var MATRIX = {
    meta: [['Meta Pixel', 'native', 'Create or reuse the pixel on your ad account; OrivenAI reads whether it has received events.'], ['Pixel on your website', 'guided', 'Installing the base code is done on your website (or tag manager).'], ['Conversions API', 'native', 'Send a test event with Meta’s own test code; nothing counts as a real event.'], ['Standard & custom events', 'guided', 'Configured in Meta Events Manager.'], ['Domain verification', 'guided', 'Done in Meta’s business settings.'], ['Attribution settings', 'guided', 'Set per ad set in Meta Ads Manager.']],
    google: [['Conversion action', 'native', 'Create or reuse a conversion action on your Google Ads account and read its status.'], ['Google tag code', 'partial', 'OrivenAI shows the real tag code Google generates; installing it is done on your website.'], ['Enhanced conversions', 'guided', 'Turned on in Google Ads (Goals → Conversions).'], ['Attribution & counting', 'guided', 'Set per conversion action in Google Ads.']],
    tiktok: [['TikTok Pixel', 'guided', 'Created in TikTok Events Manager — TikTok’s API doesn’t offer pixel creation to OrivenAI.'], ['Link pixel to ad account', 'native', 'Link an existing pixel (by its code) to your ad account.'], ['Events API', 'native', 'Send one test event to your pixel.'], ['Attribution settings', 'guided', 'Set in TikTok Ads Manager.']],
    pinterest: [['Pinterest Tag', 'native', 'Create or reuse the Tag on your ad account; OrivenAI reads its status.'], ['Tag on your website', 'guided', 'Installing the base code is done on your website.'], ['Conversions API', 'native', 'Validate a test event with Pinterest’s test mode; it isn’t recorded.'], ['Attribution settings', 'guided', 'Set in Pinterest Ads Manager.']],
    snapchat: [['Snap Pixel', 'guided', 'Created and installed via Snapchat Ads Manager.'], ['Conversions API', 'none', 'Snap offers a Conversions API with a validation mode; OrivenAI doesn’t send to it yet.'], ['Attribution settings', 'guided', 'Set in Snapchat Ads Manager.']],
  };

  var S = fresh(null);
  function fresh(uid) { return { uid: uid, plat: 'meta', conn: {}, setup: {}, data: {}, busy: {}, msg: {}, confirm: null, googleName: 'Purchase', tiktokCode: '', metaTestCode: '' }; }

  function open(p) {
    if (!K.mount(PAGE, ROOT, onClick)) return;
    var pg = document.getElementById(PAGE);
    if (pg && !pg._asetBound) { pg._asetBound = true; pg.addEventListener('input', onInput); }
    if (K.uid() !== S.uid) S = fresh(K.uid());
    if (p && PLATS.indexOf(p) >= 0) S.plat = p;
    K.show('adsettings', PAGE);
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
    var root = document.getElementById(ROOT); if (!root) return;
    var p = S.plat, c = S.conn[p] || { loading: true };
    var tabs = '<div class="aset-plats" role="tablist" aria-label="Advertising platform">' + PLATS.map(function (x) {
      var cx = S.conn[x], dot = !cx || cx.loading ? 'is-unknown' : cx.connected ? 'is-on' : cx.expired ? 'is-warn' : 'is-off';
      return '<button type="button" role="tab" class="aset-plat' + (x === p ? ' is-on' : '') + '" aria-selected="' + (x === p) + '" data-aset-plat="' + x + '"><i class="aset-dot ' + dot + '" aria-hidden="true"></i>' + esc(NAME[x]) + '</button>';
    }).join('') + '</div>';
    var head = K.head('Settings', 'Advertising Settings', 'Tracking, conversions and measurement for each advertising platform — set up in OrivenAI where the platform allows it, and guided step by step where it doesn’t.',
      '<div class="aset-headact"><button type="button" class="rx-btn rx-btn-ghost" data-aset-general>Account, billing &amp; notifications</button></div>');
    root.innerHTML = '<div class="aset">' + head + tabs + contextBar(p, c) + body(p, c) + '</div>';
  }
  function contextBar(p, c) {
    var acct = c.account && (c.account.name || c.account.id) ? esc(c.account.name || c.account.id) + (c.account.name && c.account.id ? ' <span class="aset-muted">(' + esc(c.account.id) + ')</span>' : '') : '<span class="aset-muted">No ad account selected</span>';
    var state = c.loading ? 'Checking connection…' : c.connected ? '<i class="aset-dot is-on" aria-hidden="true"></i>Connected' : c.expired ? '<i class="aset-dot is-warn" aria-hidden="true"></i>Connection expired' : '<i class="aset-dot is-off" aria-hidden="true"></i>Not connected';
    return '<section class="aset-ctx" aria-label="What you are configuring"><div><span class="aset-lbl">Platform</span><b>' + esc(NAME[p]) + '</b></div><div><span class="aset-lbl">Ad account</span><b>' + acct + '</b></div><div><span class="aset-lbl">Connection</span><b>' + state + '</b></div>' +
      '<button type="button" class="rx-btn rx-btn-ghost" data-aset-platforms>' + (c.connected ? 'Change account' : 'Connect') + '</button></section>';
  }
  function body(p, c) {
    if (c.loading) return '<section class="rx-card"><p class="aset-muted">Checking your ' + esc(NAME[p]) + ' connection…</p></section>';
    var parts = [];
    if (!c.connected) parts.push('<section class="rx-card aset-empty"><h2 class="aset-h">' + esc(NAME[p]) + (c.expired ? ' needs to be reconnected' : ' isn’t connected') + '</h2><p class="aset-sub">Connect ' + esc(NAME[p]) + ' and choose an ad account to manage its tracking here. ' + (c.expired ? 'The connection expired; reconnecting keeps your settings.' : '') + '</p><button type="button" class="rx-btn rx-btn-primary" data-aset-platforms>' + (c.expired ? 'Reconnect' : 'Connect ' + esc(NAME[p])) + '</button></section>');
    else if (!c.account) parts.push('<section class="rx-card aset-empty"><h2 class="aset-h">Choose an ad account</h2><p class="aset-sub">Tracking is set up per ad account. Choose which ' + esc(NAME[p]) + ' ad account OrivenAI works with.</p><button type="button" class="rx-btn rx-btn-primary" data-aset-platforms>Choose ad account</button></section>');
    else parts = parts.concat(SECTIONS[p]());
    parts.push(matrixHtml(p));
    return '<div class="aset-grid">' + parts.join('') + '</div>';
  }

  // Shared pieces
  function status(kind, text) { return '<span class="aset-st aset-st--' + kind + '"><i aria-hidden="true"></i>' + text + '</span>'; }
  function msg(key) { var m = S.msg[key]; return m ? '<p class="aset-msg aset-msg--' + esc(m.kind) + '" role="status">' + esc(m.text) + '</p>' : ''; }
  function link(k) { var l = LINKS[k]; return '<a class="aset-ext" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + '<span class="aset-ext__i" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>'; }
  function busyBtn(key, label, attrs, primary) { var b = S.busy[key]; return '<button type="button" class="rx-btn ' + (primary ? 'rx-btn-primary' : 'rx-btn-ghost') + '" ' + attrs + (b ? ' disabled' : '') + '>' + esc(b ? b : label) + '</button>'; }
  function confirmBox(key, what) {
    if (S.confirm !== key) return '';
    var c = S.conn[S.plat] || {}, acct = c.account ? (c.account.name || c.account.id) : '';
    return '<div class="aset-confirm" role="dialog" aria-label="Confirm">' +
      '<p><b>' + esc(what.title) + '</b></p><dl><dt>Platform</dt><dd>' + esc(NAME[S.plat]) + '</dd><dt>Ad account</dt><dd>' + esc(acct || '—') + '</dd><dt>What happens</dt><dd>' + esc(what.does) + '</dd><dt>Afterwards</dt><dd>' + esc(what.after) + '</dd></dl>' +
      '<div class="aset-acts"><button type="button" class="rx-btn rx-btn-primary" data-aset-go="' + esc(key) + '">' + esc(what.go) + '</button><button type="button" class="rx-btn rx-btn-ghost" data-aset-cancel>Cancel</button></div></div>';
  }
  function card(id, title, sub, inner) { return '<section class="rx-card aset-card" aria-labelledby="' + id + '"><div class="aset-card__h"><h2 class="aset-h" id="' + id + '">' + esc(title) + '</h2></div>' + (sub ? '<p class="aset-sub">' + sub + '</p>' : '') + inner + '</section>'; }
  function when(iso) { if (!iso) return ''; var d = new Date(isNaN(+iso) ? iso : +iso * 1000); return isNaN(d) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function diagnostics(p) {
    var st = S.setup[p], rv = st && st.remoteVerification;
    var last = rv && rv.checked ? (rv.ok ? status('ok', 'Account verified with ' + esc(NAME[p])) : status('warn', esc(NAME[p]) + ' couldn’t confirm this account')) + ' <span class="aset-muted">' + esc(when(rv.lastVerifiedAt)) + '</span>' : '<span class="aset-muted">Not checked with ' + esc(NAME[p]) + ' in this session yet.</span>';
    return card('asetDiag' + p, 'Diagnostics', 'Checks the connection and ad account with ' + esc(NAME[p]) + ' itself — a live check, only when you ask for it.',
      '<div class="aset-row">' + last + '</div><div class="aset-acts">' + busyBtn('recheck', 'Check now', 'data-aset-recheck') + '</div>' + msg('recheck'));
  }

  // ── Per platform ───────────────────────────────────────────────
  var SECTIONS = {
    meta: function () {
      var d = (S.data.meta || {}).pixel || { loading: true }, v = d.v || {};
      var st = d.loading ? '<span class="aset-muted">Reading your pixel from Meta…</span>' : d.err ? status('warn', esc(d.err)) :
        !v.exists ? status('off', 'No pixel on this ad account') :
        v.receivingEvents ? status('ok', 'Receiving events') + (v.lastFiredAt ? ' <span class="aset-muted">last event ' + esc(when(v.lastFiredAt)) + '</span>' : '') :
        v.installed ? status('ok', 'Has received events') + (v.lastFiredAt ? ' <span class="aset-muted">last event ' + esc(when(v.lastFiredAt)) + '</span>' : '') :
        status('warn', 'ID available — installation not verified');
      var id = v.pixel && v.pixel.id ? '<div class="aset-kv"><span>Pixel ID</span><code>' + esc(v.pixel.id) + '</code><button type="button" class="aset-link" data-aset-copy="' + esc(v.pixel.id) + '">Copy</button></div>' + (v.pixel.name ? '<div class="aset-kv"><span>Name</span><b>' + esc(v.pixel.name) + '</b></div>' : '') : '';
      var create = !d.loading && !d.err && !v.exists ? busyBtn('metaPixel', 'Create Meta Pixel', 'data-aset-ask="metaPixel"', true) : '';
      var steps = v.exists && !v.installed ? '<ol class="aset-steps"><li>Open Meta Events Manager and choose this pixel.</li><li>Install the base code on every page of your website — directly, through Google Tag Manager or your shop platform’s Meta integration.</li><li>Come back and press Refresh: the status changes once Meta reports an event.</li></ol>' : '';
      var capi = v.exists ? card('asetMetaCapi', 'Conversions API (server-side events)', 'Sends events from a server instead of the browser. OrivenAI can send a <b>test</b> event to your pixel with Meta’s own test code, so it shows up only under Test events and never in your results.',
        '<label class="aset-field"><span class="aset-lbl">Test event code</span><input class="aset-in" data-aset-in="metaTestCode" placeholder="e.g. TEST12345" value="' + esc(S.metaTestCode) + '" autocomplete="off"><span class="aset-hint">Find it in Meta Events Manager → your pixel → Test events.</span></label>' +
        '<div class="aset-acts">' + busyBtn('metaCapi', 'Send test event', 'data-aset-metacapi' + (S.metaTestCode.trim() ? '' : ' disabled')) + '</div>' + msg('metaCapi')) : '';
      return [card('asetMetaPixel', 'Meta Pixel', 'The pixel records what visitors do on your website, so Meta can measure and optimise your ads.',
        '<div class="aset-row">' + st + (d.loading ? '' : ' <button type="button" class="aset-link" data-aset-refresh>Refresh</button>') + '</div>' + id + create + confirmBox('metaPixel', { title: 'Create a Meta Pixel?', does: 'OrivenAI asks Meta to create a pixel named “OrivenAI Pixel” on this ad account. If one exists already, it is reused — never duplicated.', after: 'You install the pixel on your website. Until Meta reports an event, its status stays “installation not verified”.', go: 'Create pixel' }) + msg('metaPixel') + steps +
        '<div class="aset-links">' + link('meta') + '</div>'), capi, diagnostics('meta')].filter(Boolean);
    },
    google: function () {
      var d = (S.data.google || {}).conversion || { loading: true }, v = d.v || {}, tag = (S.data.google || {}).tag;
      var st = d.loading ? '<span class="aset-muted">Reading your conversion actions from Google…</span>' : d.err ? status('warn', esc(d.err)) :
        !v.exists ? status('off', 'No conversion action named “' + esc(S.googleName) + '”') :
        v.enabled ? status('ok', 'Conversion action enabled') + ' <span class="aset-muted">Google status: ' + esc(v.status) + '</span>' : status('warn', 'Exists — Google status: ' + esc(v.status || 'unknown'));
      var tagHtml = '';
      if (v.exists) {
        var t = tag && tag.v;
        tagHtml = card('asetGoogleTag', 'Google tag code', 'The real code Google generates for this conversion action. It works once it’s installed on your website; OrivenAI can’t install it for you or see whether it is installed.',
          (t && t.snippets && t.snippets.length ? t.snippets.slice(0, 2).map(function (sn) { return (sn.globalSiteTag ? '<p class="aset-lbl">Google tag (' + esc(sn.pageFormat || sn.type || 'page') + ')</p><pre class="aset-code">' + esc(sn.globalSiteTag) + '</pre>' : '') + (sn.eventSnippet ? '<p class="aset-lbl">Event snippet</p><pre class="aset-code">' + esc(sn.eventSnippet) + '</pre>' : ''); }).join('') + status('warn', 'Tag code available — installation not verified')
            : tag && tag.err ? status('warn', esc(tag.err)) : tag && tag.loading ? '<span class="aset-muted">Reading the tag code from Google…</span>' : t && !t.exists ? status('off', 'Google returned no tag code for this action') : '') +
          '<div class="aset-acts">' + (tag && tag.v ? '' : busyBtn('googleTag', 'Show tag code', 'data-aset-googletag')) + '</div>');
      }
      var create = !d.loading && !d.err && !v.exists ? busyBtn('googleConv', 'Create conversion action', 'data-aset-ask="googleConv"', true) : '';
      return [card('asetGoogleConv', 'Conversion tracking', 'A conversion action tells Google Ads which result counts — for example a purchase.',
        '<label class="aset-field"><span class="aset-lbl">Conversion action name</span><span class="aset-pair"><input class="aset-in" data-aset-in="googleName" value="' + esc(S.googleName) + '" maxlength="100"><button type="button" class="rx-btn rx-btn-ghost" data-aset-refresh>Check</button></span></label>' +
        '<div class="aset-row">' + st + '</div>' + create + confirmBox('googleConv', { title: 'Create the conversion action “' + S.googleName + '”?', does: 'OrivenAI asks Google Ads to create a conversion action with this name. If one with the same name exists, it is reused. Existing goals and primary actions are not changed.', after: 'Install its tag code on your website; Google starts counting once the tag fires.', go: 'Create conversion action' }) + msg('googleConv') +
        '<div class="aset-links">' + link('google') + '</div>'), tagHtml, diagnostics('google')].filter(Boolean);
    },
    tiktok: function () {
      return [card('asetTtPixel', 'TikTok Pixel', 'TikTok doesn’t let OrivenAI create pixels. Create one in TikTok Events Manager (Tools → Events Manager → Connect Data Source → Web), then paste its pixel code here to link it to your ad account and test it.',
        '<div class="aset-links">' + link('tiktok') + '</div>' +
        '<label class="aset-field"><span class="aset-lbl">Pixel code</span><input class="aset-in" data-aset-in="tiktokCode" placeholder="e.g. C1ABCDEF2GHIJK3LMNOP" value="' + esc(S.tiktokCode) + '" autocomplete="off"></label>' +
        '<div class="aset-acts">' + busyBtn('ttLink', 'Link to my ad account', 'data-aset-ttlink' + (S.tiktokCode.trim() ? '' : ' disabled')) + busyBtn('ttTest', 'Send test event', 'data-aset-ask="ttTest"' + (S.tiktokCode.trim() ? '' : ' disabled')) + '</div>' +
        confirmBox('ttTest', { title: 'Send a test event to this pixel?', does: 'OrivenAI sends one ViewContent event to pixel ' + S.tiktokCode.trim() + ' through TikTok’s Events API. TikTok doesn’t offer OrivenAI a separate test mode, so it is a real event.', after: 'Check TikTok Events Manager to see that it arrived.', go: 'Send event' }) +
        msg('ttLink') + msg('ttTest')), diagnostics('tiktok')];
    },
    pinterest: function () {
      var d = (S.data.pinterest || {}).tag || { loading: true }, v = d.v || {};
      var st = d.loading ? '<span class="aset-muted">Reading your Tag from Pinterest…</span>' : d.err ? status('warn', esc(d.err)) :
        !v.exists ? status('off', 'No Pinterest Tag on this ad account') :
        v.lastReceivedAt ? status('ok', 'Has received events') + ' <span class="aset-muted">last event ' + esc(when(v.lastReceivedAt)) + '</span>' :
        status('warn', 'ID available — installation not verified') + (v.status ? ' <span class="aset-muted">Pinterest status: ' + esc(v.status) + '</span>' : '');
      var id = v.tag && v.tag.id ? '<div class="aset-kv"><span>Tag ID</span><code>' + esc(v.tag.id) + '</code><button type="button" class="aset-link" data-aset-copy="' + esc(v.tag.id) + '">Copy</button></div>' : '';
      var create = !d.loading && !d.err && !v.exists ? busyBtn('pinTag', 'Create Pinterest Tag', 'data-aset-ask="pinTag"', true) : '';
      var capi = v.exists ? card('asetPinCapi', 'Conversions API (server-side events)', 'OrivenAI validates a test event with Pinterest’s own test mode — Pinterest checks it but doesn’t record it.',
        '<div class="aset-acts">' + busyBtn('pinCapi', 'Validate a test event', 'data-aset-pincapi') + '</div>' + msg('pinCapi')) : '';
      return [card('asetPinTag', 'Pinterest Tag', 'The Tag records what visitors do on your website, so Pinterest can measure your ads.',
        '<div class="aset-row">' + st + (d.loading ? '' : ' <button type="button" class="aset-link" data-aset-refresh>Refresh</button>') + '</div>' + id + create +
        confirmBox('pinTag', { title: 'Create a Pinterest Tag?', does: 'OrivenAI asks Pinterest to create a Tag on this ad account. If one exists, it is reused. Enhanced match stays off.', after: 'Install the Tag on your website (Pinterest: Business → Conversions). Until Pinterest reports an event, it stays “installation not verified”.', go: 'Create Tag' }) + msg('pinTag') +
        '<div class="aset-links">' + link('pinterest') + '</div>'), capi, diagnostics('pinterest')].filter(Boolean);
    },
    snapchat: function () {
      return [card('asetSnapPixel', 'Snap Pixel', 'OrivenAI can’t create or read Snap Pixels yet: Snapchat’s documentation doesn’t offer this to OrivenAI. Create and install the pixel in Snapchat Ads Manager — the official guide walks you through it.',
        '<div class="aset-links">' + link('snapchat') + '</div>'),
        card('asetSnapCapi', 'Conversions API', 'Snap’s Conversions API (with a validation mode) exists, but OrivenAI doesn’t send events to it yet.', '<div class="aset-links">' + link('snapCapi') + '</div>')];
    },
  };
  function matrixHtml(p) {
    return '<section class="rx-card aset-card aset-matrix" aria-labelledby="asetMx"><h2 class="aset-h" id="asetMx">What you can configure for ' + esc(NAME[p]) + '</h2>' +
      '<div class="aset-tablewrap"><table><thead><tr><th scope="col">Setting</th><th scope="col">Where</th><th scope="col">What it means</th></tr></thead><tbody>' +
      MATRIX[p].map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td><span class="aset-where aset-where--' + r[1] + '">' + esc(WHERE[r[1]]) + '</span></td><td>' + esc(r[2]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="aset-muted">Platforms differ in what they let other tools do; this list follows what each platform’s official API offers OrivenAI today.</p></section>';
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
    if (b.hasAttribute('data-aset-platforms')) { if (window.orvPages) window.orvPages.open('ad-platforms'); return; }
    if (b.hasAttribute('data-aset-general')) { if (window.orvPages) window.orvPages.open('settings'); return; }
    if (b.hasAttribute('data-aset-refresh')) { loadTracking(p); if (p === 'google') { (S.data.google || {}).tag = null; } return; }
    if (b.hasAttribute('data-aset-copy')) { var txt = a('data-aset-copy'); try { navigator.clipboard.writeText(txt); b.textContent = 'Copied'; } catch (_) {} return; }
    if (b.hasAttribute('data-aset-ask')) { S.confirm = a('data-aset-ask'); render(); return; }
    if (b.hasAttribute('data-aset-cancel')) { S.confirm = null; render(); return; }
    if (b.hasAttribute('data-aset-go')) {
      var k = a('data-aset-go');
      if (k === 'metaPixel') run(k, 'Creating…', api('/api/setup/meta/tracking', 'POST', { name: 'OrivenAI Pixel' }), function (d) {
        S.msg[k] = { kind: 'ok', text: d.created ? 'Meta created pixel ' + (d.pixel && d.pixel.id) + '. Install it on your website next.' : 'This ad account already has pixel ' + (d.pixel && d.pixel.id) + ' — OrivenAI is using that one.' };
        S.data.meta.pixel = { loading: false, v: Object.assign({ pixel: d.pixel }, d.health || { exists: true }) };
      });
      if (k === 'googleConv') run(k, 'Creating…', api('/api/setup/google/conversions', 'POST', { name: S.googleName }), function (d) {
        S.msg[k] = { kind: 'ok', text: d.created ? 'Google Ads created the conversion action “' + S.googleName + '”.' : 'A conversion action named “' + S.googleName + '” already exists — OrivenAI is using it.' };
        get('google', 'conversion', '/api/setup/google/conversions/' + encodeURIComponent(S.googleName) + '/status');
      });
      if (k === 'pinTag') run(k, 'Creating…', api('/api/setup/pinterest/tag', 'POST', {}), function (d) {
        S.msg[k] = { kind: 'ok', text: d.created ? 'Pinterest created Tag ' + (d.tag && d.tag.id) + '. Install it on your website next.' : 'This ad account already has Tag ' + (d.tag && d.tag.id) + ' — OrivenAI is using that one.' };
        get('pinterest', 'tag', '/api/setup/pinterest/tag/health');
      });
      if (k === 'ttTest') run(k, 'Sending…', api('/api/setup/tiktok/test-event', 'POST', { pixelCode: S.tiktokCode.trim(), event: 'ViewContent' }), function (d) {
        S.msg[k] = d.sent ? { kind: 'ok', text: 'TikTok accepted the event. Check TikTok Events Manager to see it arrive.' } : { kind: 'warn', text: 'TikTok didn’t accept the event — check the pixel code.' };
      });
      return;
    }
    if (b.hasAttribute('data-aset-metacapi')) run('metaCapi', 'Sending…', api('/api/setup/meta/conversions', 'POST', { eventName: 'PageView', testEventCode: S.metaTestCode.trim() }), function (d) {
      S.msg.metaCapi = d.sent ? { kind: 'ok', text: 'Meta received the test event' + (d.eventsReceived ? ' (' + d.eventsReceived + ')' : '') + '. You’ll see it under Test events in Events Manager.' } : { kind: 'warn', text: 'Meta didn’t confirm receiving the event. Check the test code and try again.' };
    });
    if (b.hasAttribute('data-aset-pincapi')) run('pinCapi', 'Validating…', api('/api/setup/pinterest/events', 'POST', { eventName: 'page_visit', actionSource: 'web', test: true }), function (d) {
      S.msg.pinCapi = d.sent ? { kind: 'ok', text: 'Pinterest processed the test event in test mode — the Conversions API connection works.' } : { kind: 'warn', text: 'Pinterest didn’t process the test event.' };
    });
    if (b.hasAttribute('data-aset-googletag')) { S.data.google = S.data.google || {}; get('google', 'tag', '/api/setup/google/conversions/' + encodeURIComponent(S.googleName) + '/tag'); return; }
    if (b.hasAttribute('data-aset-ttlink')) {
      S.busy.ttLink = 'Linking…'; S.msg.ttLink = null; render();
      api('/api/setup/tiktok/business-centers').then(function (r) {
        var bc = r.ok && r.data && r.data.businessCenters && r.data.businessCenters[0];
        if (!bc) { S.busy.ttLink = null; S.msg.ttLink = { kind: 'warn', text: r.ok ? 'No TikTok Business Center found for this connection. Linking a pixel needs one.' : K.refused(r) }; render(); return; }
        return api('/api/setup/tiktok/pixel/link', 'POST', { bcId: bc.bcId, pixelCode: S.tiktokCode.trim() }).then(function (x) {
          S.busy.ttLink = null;
          S.msg.ttLink = x.ok && x.data ? { kind: 'ok', text: x.data.alreadyLinked ? 'This pixel is already linked to your ad account.' : 'TikTok linked the pixel to your ad account.' } : { kind: 'warn', text: K.refused(x) };
          render();
        });
      });
      return;
    }
    if (b.hasAttribute('data-aset-recheck')) run('recheck', 'Checking…', api('/api/setup/' + p + '/recheck', 'POST'), function (d) {
      S.msg.recheck = d.ok ? { kind: 'ok', text: NAME[p] + ' confirmed this ad account just now.' } : { kind: 'warn', text: NAME[p] + ' couldn’t confirm this ad account — it may need attention in ' + NAME[p] + '.' };
      api('/api/setup/' + p + '/status').then(function (x) { S.setup[p] = x.ok ? x.data : S.setup[p]; render(); });
    });
  }
  function onInput(e) {
    var el = e.target; if (!el || !el.hasAttribute || !el.hasAttribute('data-aset-in')) return;
    var k = el.getAttribute('data-aset-in'); S[k] = el.value.slice(0, 100);
    // enable/disable the buttons that need this field, without redrawing the field
    var on = !!S[k].trim();
    if (k === 'tiktokCode') document.querySelectorAll('#' + PAGE + ' [data-aset-ttlink], #' + PAGE + ' [data-aset-ask="ttTest"]').forEach(function (b) { if (!S.busy.ttLink && !S.busy.ttTest) b.disabled = !on; });
    if (k === 'metaTestCode') document.querySelectorAll('#' + PAGE + ' [data-aset-metacapi]').forEach(function (b) { if (!S.busy.metaCapi) b.disabled = !on; });
  }

  window.orvAdSettings = { open: open, LINKS: LINKS, _state: function () { return S; } };
})();
