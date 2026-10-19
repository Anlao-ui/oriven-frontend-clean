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
  var ASSET_LABEL = { meta: 'Facebook Page', tiktok: 'TikTok identity' };
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
      case 'budget': return { label: bad ? 'Set budget' : 'Change budget', fn: "orvWorkspace.flow.openBudget('" + id + "')" };
      case 'creative': return goAd(id, bad ? 'Add creative' : 'Go to Ad', 'creative');
      case 'copy': case 'keywords': return goAd(id, bad ? 'Edit copy' : 'Go to Ad', 'copy');
      case 'destination': return goAd(id, bad ? 'Add URL' : 'Change URL', 'destination');
      case 'targeting': case 'tracking': case 'compliance': case 'identity': return goAd(id, bad ? 'Fix' : 'Review', key);
      case 'campaign': return goAd(id, bad ? 'Fix' : 'Review', 'objective');
      default: return goAd(id, bad ? 'Fix' : 'Review', 'settings');
    }
  }
  function msgs(list) { return (list || []).map(function (i) { return i.message || i; }).join(' '); }

  // ── The model ───────────────────────────────────────────────────
  L.readiness = function (camp) {
    ensureOwner();
    var p = camp.platform || (camp.pkg && camp.pkg.platform) || 'meta';
    var id = jsq(camp.id);
    var name = PLAT[p] || p;
    var OS = window.OrivenSpec;
    var sr = OS ? OS.forCampaign(camp) : null;
    var st = L.setup(p);
    var checks = [];

    // 1. Campaign content — the server spec, section by section.
    if (!OS) checks.push({ key: 'spec', label: 'Campaign settings', status: 'unavailable', reason: 'Launch checks couldn’t load. Reload the page.' });
    else if (!sr) checks.push({ key: 'spec', label: 'Campaign settings', status: 'checking', reason: 'Checking this campaign against your ' + name + ' account…' });
    else if (sr.error) checks.push({ key: 'spec', label: 'Campaign settings', status: 'unavailable', reason: sr.error + ' Nothing can be published until this check succeeds.', action: { label: 'Try again', fn: "orvLaunch.retry('" + id + "')" } });
    else if (Array.isArray(sr.sections)) {
      sr.sections.forEach(function (sec) {
        var reason = sec.status === 'blocked' ? msgs(sec.errors) : sec.status === 'warning' ? msgs(sec.warnings) : (sec.summary || 'Complete.');
        checks.push({ key: sec.key, label: sec.key === 'identity' ? (ASSET_LABEL[p] || sec.label) : sec.label, status: sec.status, reason: reason,
          warnings: sec.status === 'blocked' ? msgs(sec.warnings) : '', notes: (sec.notes || []).join(' '), action: actionFor(sec.key, sec.status, id) });
      });
    } else {
      // Older server without sections: never drop anything — one row with every issue.
      var errs = (sr.issues || []).filter(function (i) { return i.level === 'error'; });
      var warns = (sr.issues || []).filter(function (i) { return i.level === 'warning'; });
      checks.push({ key: 'settings', label: 'Campaign settings', status: errs.length ? 'blocked' : warns.length ? 'warning' : 'pass', reason: errs.length ? msgs(errs) : warns.length ? msgs(warns) : 'Checked.', action: actionFor('settings', errs.length ? 'blocked' : 'pass', id) });
    }

    // 2. Platform setup — connection, ad account, Page / identity (merged
    // into the spec's identity row so it appears once).
    var conn = { key: 'connection', label: name + ' connection' };
    if (!st.at) { conn.status = 'checking'; conn.reason = 'Checking your ' + name + ' connection…'; }
    else if (st.error) { conn.status = 'unavailable'; conn.reason = 'OrivenAI couldn’t check your ' + name + ' connection right now.'; conn.action = { label: 'Try again', fn: "orvLaunch.retry('" + id + "')" }; }
    else if (!st.data.connected) { conn.status = 'blocked'; conn.reason = name + ' is not connected — connect it before this campaign can be launched.'; conn.action = { label: 'Connect ' + name, fn: "bizGoTo('connections')" }; }
    else if (sr && !sr.error && sr.options && sr.options.connected === false) { conn.status = 'blocked'; conn.reason = (sr.options.connectionError || ('OrivenAI can’t reach your ' + name + ' account.')) + ' Reconnect it in Connections.'; conn.action = { label: 'Review in Connections', fn: "bizGoTo('connections')" }; }
    else { conn.status = 'pass'; conn.reason = name + ' is connected.'; }
    checks.push(conn);
    var steps = st.data && st.data.connected && st.data.steps ? st.data.steps : null;
    if (steps && steps.account) {
      var ok = steps.account.status === 'complete';
      checks.push({ key: 'account', label: 'Ad account', status: ok ? 'pass' : (steps.account.status === 'action_required' ? 'blocked' : 'checking'),
        reason: steps.account.reason || (ok ? 'Ad account selected.' : 'Select the ad account to publish to.'), action: ok ? null : { label: 'Review in Connections', fn: "bizGoTo('connections')" } });
    }
    if (steps && steps.assets && ASSET_LABEL[p] && steps.assets.status === 'action_required') {
      var row = checks.filter(function (c) { return c.key === 'identity'; })[0];
      var why = steps.assets.reason || ('A ' + ASSET_LABEL[p] + ' is required to publish.');
      if (row) { if (row.status !== 'blocked') { row.status = 'blocked'; row.reason = why; } else if (row.reason.indexOf(why) === -1) row.reason += ' ' + why; row.action = { label: 'Review in Connections', fn: "bizGoTo('connections')" }; }
      else checks.push({ key: 'identity', label: ASSET_LABEL[p], status: 'blocked', reason: why, action: { label: 'Review in Connections', fn: "bizGoTo('connections')" } });
    }

    // 3. Aggregate. READY only when the spec was validated, nothing blocks
    // and the account is confirmed.
    var has = function (s) { return checks.some(function (c) { return c.status === s; }); };
    var state = has('blocked') ? 'blocked' : has('unavailable') ? 'unavailable' : has('checking') ? 'checking' : has('warning') ? 'warning' : 'ready';
    var LBL = { blocked: 'BLOCKED', unavailable: 'CAN’T CHECK', checking: 'CHECKING…', warning: 'READY WITH WARNINGS', ready: 'READY TO LAUNCH' };
    var SUB = {
      blocked: 'Required: ' + checks.filter(function (c) { return c.status === 'blocked'; }).map(function (c) { return c.label; }).join(', ') + '.',
      unavailable: 'Some checks couldn’t run. Nothing can be published until they do.',
      checking: 'Running the pre-flight checks…',
      warning: 'Can launch. Review: ' + checks.filter(function (c) { return c.status === 'warning'; }).map(function (c) { return c.label; }).join(', ') + '.',
      ready: 'Everything required for deployment is in place.',
    };
    return { state: state, label: LBL[state], sub: SUB[state], checks: checks, canPublish: state === 'ready' || state === 'warning', spec: sr && !sr.error ? sr : null,
      format: sr && sr.format ? sr.format : null, publish: sr && sr.publish ? sr.publish : null, platform: p };
  };

  // ── Card / status vocabulary (deployed state wins over readiness) ──
  var LIVE_RE = /^(active|enabled|enable|running|live|delivering)$/;
  L.publishedState = function (c) {
    var st = c.status || 'draft', ps = String(c.providerStatus || '').toLowerCase();
    if (st === 'archived') return { state: 'live', kind: 'archived', label: 'ARCHIVED', text: 'Archived in OrivenAI — the campaign on the platform isn’t changed.' };
    if (st === 'paused' || ps === 'paused') return { state: 'live', kind: 'paused', label: 'PUBLISHED · PAUSED', text: 'Published — paused on the platform. Nothing spends until you activate it.' };
    if (LIVE_RE.test(ps)) return { state: 'live', kind: 'active', label: 'ACTIVE', text: 'Active on the platform (last status OrivenAI recorded).' };
    return { state: 'live', kind: 'unknown', label: 'PUBLISHED', text: 'Published — OrivenAI hasn’t confirmed whether it is running.' };
  };
  L.cardState = function (c) {
    var st = c.status || 'draft';
    if (st === 'published' || st === 'paused' || st === 'archived' || st === 'active') return L.publishedState(c);
    if (st === 'publishing') return inFlight[c.id] ? { state: 'publishing', label: 'PUBLISHING…' } : { state: 'unconfirmed', label: 'NOT CONFIRMED' };
    if (st === 'failed') return { state: 'failed', label: 'PUBLISH FAILED' };
    var r = L.readiness(c);
    return { state: r.state, label: r.label };
  };
})();
