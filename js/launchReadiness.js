/* ════════════════════════════════════════════════════════════════
   Launch readiness — ONE model for every Launch surface.

   Used by the Launch cards, the Launch Control popup, the Launch workspace
   and the publish button (and, through the existing _launch* bridges in
   app.html, by Control Center and Oriven Chat context).

   Sources, in order of authority:
     1. The server campaign spec (POST /api/campaigns/spec, js/campaignSpec.js)
        — every campaign-content rule, grouped by the server into sections.
        Nothing is ever dropped: unknown issues arrive in "Other settings".
     2. Platform setup (GET /api/setup/{platform}/status) — connection, ad
        account, Facebook Page / TikTok identity.
     3. The recorded publish operation (server ledger + this browser).
   There are no separate local content rules any more: while the spec is
   loading a campaign is "Checking", never "Ready".

   States: checking · ready · warning · blocked · unavailable
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PLAT = { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' };
  var ASSET_KEY = { meta: 'lch_fbPage', tiktok: 'lch_ttIdentity' };
  // Text in the user's language (js/launchI18n.js); keys only — no English here.
  function T(k, v) { return window.orvTx ? window.orvTx(k, v) : k; }
  function assetLabel(p) { return ASSET_KEY[p] ? T(ASSET_KEY[p]) : null; }
  // Section labels by key; a section the app doesn't know keeps the server's label.
  function secLabel(sec) { var k = 'lch_sec_' + sec.key; var s = T(k); return s && s !== k ? s : sec.label; }
  var SETUP_TTL = 60000, SETUP_ERR_TTL = 10000;
  var L = window.orvLaunch = {};
  var setup = {};          // platform -> { at, data, error, inflight, sig }
  var inFlight = {};       // campId -> true while THIS tab is publishing it
  var owner = null;

  function uid() { var u = typeof window._getCurrentUser === 'function' ? window._getCurrentUser() : null; return (u && u.id) || ''; }
  function jsq(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function ensureOwner() {
    var u = uid();
    if (u !== owner) { owner = u; setup = {}; inFlight = {}; if (window.OrivenSpec && window.OrivenSpec.reset) window.OrivenSpec.reset(); }
  }
  L.reset = function () { owner = null; setup = {}; inFlight = {}; if (window.OrivenSpec && window.OrivenSpec.reset) window.OrivenSpec.reset(); };

  // ── Repaint (debounced) ─────────────────────────────────────────
  var paintTimer = null;
  L.changed = function () {
    clearTimeout(paintTimer);
    paintTimer = setTimeout(function () {
      if (typeof window._launchRepaint === 'function') { try { window._launchRepaint(); } catch (e) { console.warn('[launch] repaint', e); } }
    }, 30);
  };

  // ── Platform setup (one shared read per platform) ──────────────
  L.setup = function (p, force) {
    ensureOwner();
    var s = setup[p] || (setup[p] = {});
    var ttl = s.error ? SETUP_ERR_TTL : SETUP_TTL;
    if (!force && s.at && Date.now() - s.at < ttl) return s;
    if (!s.inflight && typeof window.apiFetch === 'function') {
      var who = owner;
      s.inflight = window.apiFetch('/api/setup/' + p + '/status').then(function (r) {
        if (who !== owner) return;
        var d = r && r.ok && r.data ? r.data : null;
        var sig = d ? JSON.stringify([d.connected, d.ready, d.state, d.steps && d.steps.account && d.steps.account.status, d.steps && d.steps.assets && d.steps.assets.status]) : null;
        var changed = s.sig !== undefined && d && sig !== s.sig;
        s.data = d; s.error = !d; s.at = Date.now(); s.inflight = null; if (d) s.sig = sig;
        // The account changed (Page added, identity chosen, reconnected…):
        // the campaign checks for this platform are re-run live.
        if (changed && window.OrivenSpec && window.OrivenSpec.invalidatePlatform) window.OrivenSpec.invalidatePlatform(p);
        L.changed();
      }, function () {
        if (who !== owner) return;
        s.data = null; s.error = true; s.at = Date.now(); s.inflight = null; L.changed();
      });
    }
    return s;
  };

  // Launch opened / tab focused again: re-read setup; campaign checks are
  // re-run live when anything changed or the last live check is old.
  var lastEnter = 0;
  L.enter = function (platforms) {
    ensureOwner();
    (platforms || Object.keys(PLAT)).forEach(function (p) { L.setup(p, true); });
    if (Date.now() - lastEnter > 30000 && window.OrivenSpec && window.OrivenSpec.invalidateAll) window.OrivenSpec.invalidateAll();
    lastEnter = Date.now();
  };
  L.retry = function (campId) {
    var c = findCamp(campId); if (!c) return;
    L.setup(c.platform, true);
    if (window.OrivenSpec && window.OrivenSpec.refresh) window.OrivenSpec.refresh(c);
    L.changed();
  };
  function findCamp(id) {
    var list = typeof window._orvGetCampaigns === 'function' ? window._orvGetCampaigns() : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }

  // Connection changes made elsewhere in the app (Business → Connections).
  var connSig = null;
  function watchConnections() {
    var OW = window.orvWorkspace;
    if (!OW || !OW.on || watchConnections.done) return;
    watchConnections.done = true;
    OW.on(function (topic) {
      if (topic !== 'connections' || !OW.connections) return;
      OW.connections().then(function (c) {
        var sig = null; try { sig = JSON.stringify(c); } catch (_) {}
        if (connSig !== null && sig !== connSig) {
          setup = {};
          if (window.OrivenSpec && window.OrivenSpec.invalidateAll) window.OrivenSpec.invalidateAll();
          L.changed();
        }
        connSig = sig;
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchConnections); else setTimeout(watchConnections, 0);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var pg = document.querySelector('.page.active');
    if (pg && pg.id === 'page-launch') { Object.keys(setup).forEach(function (p) { L.setup(p, true); }); }
  });

  // ── Publishing state (this tab + the record) ───────────────────
  L.markInFlight = function (campId, on) { if (on) inFlight[campId] = true; else delete inFlight[campId]; L.changed(); };
  L.isInFlight = function (campId) { return !!inFlight[campId]; };

  // ── Actions per section (existing editors only) ─────────────────
  function goAd(id, label, sec) { return { label: label, fn: "orvWorkspace.flow.openAd('" + id + "','" + sec + "')" }; }
  function actionFor(key, status, id) {
    var bad = status === 'blocked';
    switch (key) {
      case 'budget': return { label: T(bad ? 'lch_aSetBudget' : 'lch_aChangeBudget'), fn: "orvWorkspace.flow.openBudget('" + id + "')" };
      case 'creative': return goAd(id, T(bad ? 'lch_aAddCreative' : 'lch_aGoToAd'), 'creative');
      case 'copy': case 'keywords': return goAd(id, T(bad ? 'lch_aEditCopy' : 'lch_aGoToAd'), 'copy');
      case 'destination': return goAd(id, T(bad ? 'lch_aAddUrl' : 'lch_aChangeUrl'), 'destination');
      case 'targeting': case 'tracking': case 'compliance': case 'identity': return goAd(id, T(bad ? 'lch_aFix' : 'lch_aReview'), key);
      case 'campaign': return goAd(id, T(bad ? 'lch_aFix' : 'lch_aReview'), 'objective');
      default: return goAd(id, T(bad ? 'lch_aFix' : 'lch_aReview'), 'settings');
    }
  }
  // Server messages in the user's language (js/serverI18n.js; English = the server's own text).
  function msgs(list) { return (list || []).map(function (i) { return window.orvTx && orvTx.issue ? orvTx.issue(i) : (i.message || i); }).join(' '); }
  function sumText(sec) { return window.orvTx && orvTx.summary ? orvTx.summary(sec) : sec.summary; }
  function stepText(st) { return st && (window.orvTx && orvTx.setupReason ? orvTx.setupReason(st) : st.reason); }

  // ── The model ───────────────────────────────────────────────────
  L.readiness = function (camp) {
    ensureOwner();
    var p = camp.platform || (camp.pkg && camp.pkg.platform) || 'meta';
    var id = jsq(camp.id);
    var name = PLAT[p] || p;
    var OS = window.OrivenSpec;
    var sr = OS ? OS.forCampaign(camp) : null;
    // Re-check running for unchanged content: keep showing the last answer,
    // but nothing can be published until the fresh one arrives.
    var refreshing = false;
    if (!sr && OS && OS.lastKnown) { sr = OS.lastKnown(camp); refreshing = !!sr; }
    var st = L.setup(p);
    var checks = [];

    // 1. Campaign content — the server spec, section by section.
    if (!OS) checks.push({ key: 'spec', label: T('lch_sec_settings'), status: 'unavailable', reason: T('lch_specUnavailable') });
    else if (!sr) checks.push({ key: 'spec', label: T('lch_sec_settings'), status: 'checking', reason: T('lch_specChecking', { platform: name }) });
    else if (sr.error) checks.push({ key: 'spec', label: T('lch_sec_settings'), status: 'unavailable', reason: sr.error + ' ' + T('lch_specErrTail'), action: { label: T('lch_tryAgain'), fn: "orvLaunch.retry('" + id + "')" } });
    else if (Array.isArray(sr.sections)) {
      sr.sections.forEach(function (sec) {
        var reason = sec.status === 'blocked' ? msgs(sec.errors) : sec.status === 'warning' ? msgs(sec.warnings) : (sumText(sec) || T('lch_complete'));
        checks.push({ key: sec.key, label: sec.key === 'identity' ? (assetLabel(p) || secLabel(sec)) : secLabel(sec), status: sec.status, reason: reason,
          warnings: sec.status === 'blocked' ? msgs(sec.warnings) : '', notes: (sec.notes || []).join(' '), action: actionFor(sec.key, sec.status, id) });
      });
    } else {
      // Older server without sections: never drop anything — one row with every issue.
      var errs = (sr.issues || []).filter(function (i) { return i.level === 'error'; });
      var warns = (sr.issues || []).filter(function (i) { return i.level === 'warning'; });
      checks.push({ key: 'settings', label: T('lch_sec_settings'), status: errs.length ? 'blocked' : warns.length ? 'warning' : 'pass', reason: errs.length ? msgs(errs) : warns.length ? msgs(warns) : T('lch_checked'), action: actionFor('settings', errs.length ? 'blocked' : 'pass', id) });
    }

    // 2. Platform setup — connection, ad account, Page / identity (merged
    // into the spec's identity row so it appears once).
    var conn = { key: 'connection', label: T('lch_connLabel', { platform: name }) };
    if (!st.at) { conn.status = 'checking'; conn.reason = T('lch_connChecking', { platform: name }); }
    else if (st.error) { conn.status = 'unavailable'; conn.reason = T('lch_connCouldnt', { platform: name }); conn.action = { label: T('lch_tryAgain'), fn: "orvLaunch.retry('" + id + "')" }; }
    else if (!st.data.connected) { conn.status = 'blocked'; conn.reason = T('lch_connMissing', { platform: name }); conn.action = { label: T('lch_connect', { platform: name }), fn: "bizGoTo('connections')" }; }
    else if (sr && !sr.error && sr.options && sr.options.connected === false) { conn.status = 'blocked'; conn.reason = ((window.orvTx && orvTx._serverLang && orvTx._serverLang() !== 'en' ? '' : sr.options.connectionError) || T('lch_connCantReach', { platform: name })) + ' ' + T('lch_reconnectIn'); conn.action = { label: T('lch_reviewConnections'), fn: "bizGoTo('connections')" }; }
    else { conn.status = 'pass'; conn.reason = T('lch_connOk', { platform: name }); }
    checks.push(conn);
    var steps = st.data && st.data.connected && st.data.steps ? st.data.steps : null;
    if (steps && steps.account) {
      var ok = steps.account.status === 'complete';
      checks.push({ key: 'account', label: T('lch_adAccount'), status: ok ? 'pass' : (steps.account.status === 'action_required' ? 'blocked' : 'checking'),
        reason: stepText(steps.account) || (ok ? T('lch_acctOk') : T('lch_selectAccount')), action: ok ? null : { label: T('lch_reviewConnections'), fn: "bizGoTo('connections')" } });
    }
    if (steps && steps.assets && ASSET_KEY[p] && steps.assets.status === 'action_required') {
      var row = checks.filter(function (c) { return c.key === 'identity'; })[0];
      var why = stepText(steps.assets) || T('lch_assetRequired', { asset: assetLabel(p) });
      if (row) { if (row.status !== 'blocked') { row.status = 'blocked'; row.reason = why; } else if (row.reason.indexOf(why) === -1) row.reason += ' ' + why; row.action = { label: T('lch_reviewConnections'), fn: "bizGoTo('connections')" }; }
      else checks.push({ key: 'identity', label: assetLabel(p), status: 'blocked', reason: why, action: { label: T('lch_reviewConnections'), fn: "bizGoTo('connections')" } });
    }

    // 3. Aggregate. READY only when the spec was validated, nothing blocks
    // and the account is confirmed.
    var has = function (s) { return checks.some(function (c) { return c.status === s; }); };
    var state = has('blocked') ? 'blocked' : has('unavailable') ? 'unavailable' : has('checking') ? 'checking' : has('warning') ? 'warning' : 'ready';
    var LBL = { blocked: 'lch_aggBlocked', unavailable: 'lch_aggUnavailable', checking: 'lch_aggChecking', warning: 'lch_aggWarning', ready: 'lch_aggReady' };
    var labelsOf = function (s) { return checks.filter(function (c) { return c.status === s; }).map(function (c) { return c.label; }).join(', '); };
    var sub = state === 'blocked' ? T('lch_subRequired', { list: labelsOf('blocked') })
      : state === 'unavailable' ? T('lch_aggUnavailableSub')
      : state === 'checking' || refreshing ? T('lch_aggCheckingSub')
      : state === 'warning' ? T('lch_subCanLaunchReview', { list: labelsOf('warning') })
      : T('lch_subReadyInPlace');
    return { state: state, label: T(LBL[state]), sub: sub, checks: checks, canPublish: !refreshing && (state === 'ready' || state === 'warning'), refreshing: refreshing, spec: sr && !sr.error ? sr : null,
      format: sr && sr.format ? sr.format : null, publish: sr && sr.publish ? sr.publish : null, platform: p };
  };

  // ── Card / status vocabulary (deployed state wins over readiness) ──
  var LIVE_RE = /^(active|enabled|enable|running|live|delivering)$/;
  L.publishedState = function (c) {
    var st = c.status || 'draft', ps = String(c.providerStatus || '').toLowerCase();
    if (st === 'archived') return { state: 'live', kind: 'archived', label: T('lch_psArchived'), text: T('lch_psArchivedText') };
    var act = c.activation || {};
    // The last Activate didn't finish: the campaign was left paused (nothing spends).
    if ((st === 'paused' || ps === 'paused' || !LIVE_RE.test(ps)) && act.state === 'failed') return { state: 'live', kind: 'paused', label: T('lch_psActFailed'), text: T('lch_psActFailedText') };
    if (st === 'paused' || ps === 'paused') return { state: 'live', kind: 'paused', label: T('lch_psPaused'), text: T('lch_psPausedText') };
    // On, but OrivenAI couldn't read back the ad sets and ads: not "active".
    if (LIVE_RE.test(ps) && act.state === 'unverified') return { state: 'live', kind: 'unknown', label: T('lch_psUnverified'), text: T('lch_psUnverifiedText') };
    if (LIVE_RE.test(ps) && (act.state === 'partial' || c.childrenPaused) && act.stillPaused) return { state: 'live', kind: 'unknown', label: T('lch_psOnAdsPaused'), text: T('lch_psOnAdsPausedCount', { n: act.stillPaused }) };
    // Switched on, but the platform answer didn't confirm that the ad sets /
    // ads OrivenAI created paused were switched on too: nothing delivers yet.
    // Kind 'unknown' offers both Activate (which retries them) and Pause.
    if (LIVE_RE.test(ps) && c.childrenPaused) return { state: 'live', kind: 'unknown', label: T('lch_psOnAdsPaused'), text: T('lch_psOnAdsPausedText') };
    if (LIVE_RE.test(ps)) return { state: 'live', kind: 'active', label: T('lch_psActive'), text: T('lch_psActiveText') };
    return { state: 'live', kind: 'unknown', label: T('lch_psPublished'), text: T('lch_psPublishedText') };
  };
  L.cardState = function (c) {
    var st = c.status || 'draft';
    if (st === 'published' || st === 'paused' || st === 'archived' || st === 'active') return L.publishedState(c);
    if (st === 'publishing') return inFlight[c.id] ? { state: 'publishing', label: T('lch_publishingCaps') } : { state: 'unconfirmed', label: T('lch_notConfirmed') };
    if (st === 'failed') return { state: 'failed', label: T('lch_publishFailed') };
    var r = L.readiness(c);
    return { state: r.state, label: r.label };
  };
})();
