/* ════════════════════════════════════════════════════════════════
   ORIVEN Workspace — one campaign thread, one state model.

   The six products (Business, Research, Create, Launch, Campaigns,
   Autopilot) each already fetch and render their own real data. This
   file is the thin shared layer that lets them agree with each other:

     1. Campaign store   — the durable /api/campaigns table becomes the
                           canonical source. Its rows are hydrated into the
                           existing per-user localStorage cache that every
                           existing reader (_orvGetCampaigns) already uses,
                           and every later local change is mirrored back.
                           Nothing local is ever deleted by this file.
     2. Workspace data   — connections, Business health, Autopilot and
                           intelligence state, fetched once and cached.
     3. Attention model  — one ranked "Needs you" list built only from
                           real signals (never invented urgency).
     4. Module state     — what each of the six areas is doing right now.
     5. Navigation       — context-carrying handoffs (open Launch with a
                           campaign selected, Campaigns with a campaign
                           selected, Business on the right tab).
     6. Lineage          — where a campaign came from (Business / Research
                           / Create choices), stamped at generation time.
     7. Research handoff — selected findings travel to Create as named,
                           removable context and reach the real payload.
     8. Surfaces         — Home, sidebar marks, Launch/Campaigns/Autopilot
                           helpers, Create Stage sections, Chat helpers.

   Hard rule, same as orivenContext.js: every value shown is real data an
   endpoint or the user's own local state returned, or an honest empty
   state. No fabricated metric, finding, urgency or history.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var OW = window.orvWorkspace = window.orvWorkspace || {};
  var listeners = [];
  OW.on = function (fn) { if (typeof fn === 'function') listeners.push(fn); };
  function emit(topic) {
    listeners.forEach(function (fn) { try { fn(topic); } catch (e) { console.warn('[workspace] listener failed:', e.message); } });
  }

  // ── Utilities ──────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  OW.esc = esc;
  // A JS string literal safe inside a double-quoted HTML onclick attribute.
  function jsStr(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/\n/g, ' '); }
  function user() {
    return (typeof window._getCurrentUser === 'function') ? window._getCurrentUser() : null;
  }
  function uidKey(prefix) { var u = user(); return (u && u.id) ? (prefix + u.id) : null; }
  function readJSON(key, fallback) {
    if (!key) return fallback;
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJSON(key, val) {
    if (!key) return false;
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { console.warn('[workspace] local write skipped:', e.message); return false; }
  }
  function relTime(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var h = Math.round(mins / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.round(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  OW.relTime = relTime;
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function api(path, opts) {
    if (typeof window.apiFetch !== 'function') return Promise.resolve({ ok: false, status: 0, data: null });
    return window.apiFetch(path, opts).catch(function () { return { ok: false, status: 0, data: null }; });
  }
  function hasAutopilotPlan() {
    // Autopilot is included from Starter (plans.js entitlements). An unknown
    // plan (still loading) is not treated as locked.
    if (typeof window.orvEntitled === 'function') return window.orvEntitled('autopilot') !== false;
    return true;
  }
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ── Request de-duplication (performance pass) ──────────────────────
  // Several modules independently ask for the same idempotent reads
  // (measured: each /api/{platform}/status 5–6× and /api/business/profile
  // 4× in a short session). Identical in-flight GETs share one request and
  // a result is reused for 15s. Only this allowlist is affected, and ANY
  // write (POST/PUT/PATCH/DELETE) clears the cache, so a connect,
  // disconnect or profile save is never served stale.
  (function () {
    var orig = window.apiFetch;
    if (typeof orig !== 'function' || orig._owDedupe) return;
    var ALLOW = /^\/api\/((google|meta|tiktok|pinterest)\/status|business\/profile|business\/health)(\?|$)/;
    var TTL = 15000, cache = {};
    var wrapped = function (path, options) {
      var method = ((options && options.method) || 'GET').toUpperCase();
      if (method !== 'GET') { cache = {}; return orig.apply(this, arguments); }
      if (!ALLOW.test(String(path))) return orig.apply(this, arguments);
      var hit = cache[path];
      if (hit && Date.now() - hit.at < TTL) return hit.p;
      var p = orig.apply(this, arguments);
      cache[path] = { at: Date.now(), p: p };
      p.then(function (r) { if (!r || !r.ok) delete cache[path]; }, function () { delete cache[path]; });
      return p;
    };
    wrapped._owDedupe = true;
    window.apiFetch = wrapped;
    OW._clearApiCache = function () { cache = {}; }; // called by OW.reset (account change)
  })();

  var PLAT = {
    google: { label: 'Google Ads', short: 'Google' },
    meta: { label: 'Meta Ads', short: 'Meta' },
    tiktok: { label: 'TikTok Ads', short: 'TikTok' },
    pinterest: { label: 'Pinterest Ads', short: 'Pinterest' }
  };
  OW.PLAT = PLAT;
  // Real provider capability, mirrored from server.js: the 4-hour
  // monitoring cron (_runIntelligenceMonitoring) only analyzes Google Ads
  // and Meta Ads, so only those two can honestly be called "watched".
  var AUTOPILOT_MONITORED = { google: true, meta: true };
  OW.AUTOPILOT_MONITORED = AUTOPILOT_MONITORED;

  function platDot(p) { return '<i class="ow-pdot ow-pdot-' + esc(p || 'none') + '" aria-hidden="true"></i>'; }
  OW.platDot = platDot;

  // ══════════════════════════════════════════════════════════════════
  // 1. CAMPAIGN STORE
  // ══════════════════════════════════════════════════════════════════
  var C = OW.campaigns = { rows: null, loadedAt: 0, loading: null, error: null, settled: false };
  var LOCAL_CAP = 50; // same cap _orvStoreCampaign already enforces locally

  function tombKey() { return uidKey('oriven_campaigns_removed_'); }
  function tombstones() { return readJSON(tombKey(), {}); }

  C.local = function () {
    try { return (typeof window._orvGetCampaigns === 'function') ? (window._orvGetCampaigns() || []).slice() : []; } catch (_) { return []; }
  };

  // Signature of the fields that matter durably — used to detect a real
  // local change that still needs mirroring to /api/campaigns.
  function sig(c) {
    var pkgLen = 0, linLen = 0;
    try { pkgLen = c.pkg ? JSON.stringify(c.pkg).length : 0; } catch (_) {}
    try { linLen = c.lineage ? JSON.stringify(c.lineage).length : 0; } catch (_) {}
    return [c.status || '', c.updated || '', c.publishedAt || '', c.platformCampaignId || '', c.name || '', pkgLen, linLen].join('|');
  }
  var baseline = null; // { id: sig } — only set once the durable state is known

  function buildBaseline() {
    baseline = {};
    C.local().forEach(function (c) { if (c && c.id) baseline[c.id] = sig(c); });
  }

  // Wrap the one durable write path so anything that persists a record
  // (Create's store, a real publish result) updates the baseline too and
  // the sync pass below never sends the same record twice.
  function wrapPersist() {
    var orig = window._orvPersistCampaignDurable;
    if (typeof orig !== 'function' || orig._owWrapped) return;
    var wrapped = function (campObj) {
      if (baseline && campObj && campObj.id) baseline[campObj.id] = sig(campObj);
      return orig.apply(this, arguments);
    };
    wrapped._owWrapped = true;
    window._orvPersistCampaignDurable = wrapped;
  }

  var syncTimer = null;
  // Called from _saveCamps (and the three screen-local writers) after any
  // local campaign write. Debounced; mirrors only records whose durable
  // fields genuinely changed since the durable state was last known.
  C.changed = function () {
    emitSoon('campaigns');
    if (!baseline) return; // durable state not known yet — nothing to diff against
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 1200);
  };
  function syncNow() {
    if (!baseline || typeof window._orvPersistCampaignDurable !== 'function') return;
    C.local().forEach(function (c) {
      if (!c || !c.id || !c.name) return;
      var s = sig(c);
      if (baseline[c.id] === s) return;
      baseline[c.id] = s;
      window._orvPersistCampaignDurable(c);
    });
  }

  // Explicit, user-initiated removal of Oriven's own record (the existing
  // Delete actions). Recorded locally so hydration never resurrects it on
  // this browser, and archived durably (DELETE /api/campaigns/:id is a
  // soft archive of OrivenAI's own row — it never touches a provider).
  C.removed = function (localId) {
    if (!localId) return;
    var t = tombstones(); t[localId] = new Date().toISOString(); writeJSON(tombKey(), t);
    if (baseline) delete baseline[localId];
    var row = (C.rows || []).filter(function (r) { return r.client_ref_id === localId; })[0];
    if (row && row.id) api('/api/campaigns/' + encodeURIComponent(row.id), { method: 'DELETE' });
    emitSoon('campaigns');
  };

  var DRAFTISH = { draft: 1, generated: 1, 'ready-to-publish': 1 };
  function isDraftish(s) { return !!DRAFTISH[s || 'draft']; }
  function isDurableLive(s) { return s === 'published' || s === 'active' || s === 'paused'; }

  // Adds durable records this browser doesn't have yet (a new device, a
  // cleared browser) into the local cache, and carries a newer durable
  // publish state forward. Additive only: never removes or overwrites a
  // local draft's content, never touches imported provider rows.
  function hydrate(rows) {
    var key = (typeof window._orvCampaignsKey === 'function') ? window._orvCampaignsKey() : null;
    if (!key) return { added: 0, updated: 0 };
    var local = readJSON(key, []);
    if (!Array.isArray(local)) return { added: 0, updated: 0 };
    var byId = {};
    local.forEach(function (c) { if (c && c.id) byId[c.id] = c; });
    var tomb = tombstones();
    var added = 0, updated = 0;
    var candidates = rows.filter(function (r) {
      return r && r.source !== 'platform_imported' && r.client_ref_id && !tomb[r.client_ref_id] &&
        r.status !== 'archived' && r.package && typeof r.package === 'object' && r.package.id === r.client_ref_id;
    });
    candidates.forEach(function (r) {
      var l = byId[r.client_ref_id];
      if (!l) {
        if (local.length >= LOCAL_CAP) return;
        var c;
        try { c = JSON.parse(JSON.stringify(r.package)); } catch (_) { return; }
        c._fromServer = true;
        delete c._durableSyncPending;
        local.push(c);
        byId[c.id] = c;
        added++;
        return;
      }
      // Cross-device publish state: only ever moves a local DRAFT forward to
      // a durable, confirmed live/paused state, and only when the durable
      // row is newer. A local change is never rolled back by this.
      var pk = r.package;
      var rowTime = new Date(r.updated_at || 0).getTime();
      var localTime = new Date(l.updated || l.publishedAt || l.created || 0).getTime();
      if (isDurableLive(r.status) && isDraftish(l.status) && pk.status && !isDraftish(pk.status) && rowTime > localTime) {
        ['status', 'publishedAt', 'platformCampaignId', 'platformAdSetId', 'platformAdSetIds', 'platformAdIds', 'destinationAccountId', 'destinationAccountName', 'updated'].forEach(function (f) {
          if (pk[f] !== undefined) l[f] = pk[f];
        });
        updated++;
      }
    });
    if (added || updated) {
      local.sort(function (a, b) { return new Date(b.created || 0) - new Date(a.created || 0); });
      if (!writeJSON(key, local)) return { added: 0, updated: 0 };
      if (typeof window._loadCamps === 'function') { try { window._loadCamps(); } catch (_) {} }
    }
    return { added: added, updated: updated };
  }

  C.refresh = function (force) {
    if (!user()) return Promise.resolve(null);
    if (C.loading) return C.loading;
    if (!force && C.loadedAt && Date.now() - C.loadedAt < 60000) return Promise.resolve(C.rows);
    wrapPersist();
    C.loading = api('/api/campaigns?limit=500').then(function (r) {
      C.loading = null;
      C.loadedAt = Date.now();
      if (r.ok && r.data && Array.isArray(r.data.campaigns)) {
        C.rows = r.data.campaigns;
        C.error = null;
        var res = hydrate(C.rows);
        C.lastHydrate = res;
      } else {
        C.error = (r.data && (r.data.code || r.data.error)) || 'unavailable';
        if (!C.rows) C.rows = [];
      }
      if (!baseline) buildBaseline();
      // Records whose durable save failed earlier carry _durableSyncPending
      // (set by _orvPersistCampaignDurable precisely so a later pass can
      // retry). Retry them once the durable store has just answered —
      // the upsert on client_ref_id makes this idempotent.
      if (!C.error && typeof window._orvPersistCampaignDurable === 'function') {
        C.local().filter(function (c) { return c && c._durableSyncPending && c.id && c.name; }).slice(0, 20)
          .forEach(function (c) { window._orvPersistCampaignDurable(c); });
      }
      C.settled = true;
      emit('campaigns');
      return C.rows;
    });
    return C.loading;
  };

  // Imported provider campaigns (POST /api/campaigns/sync/:platform rows).
  C.imported = function () {
    return (C.rows || []).filter(function (r) { return r.source === 'platform_imported'; });
  };

  // One stage vocabulary for every surface. Uses Launch's own readiness
  // engine (window._launchListReadiness) for anything not yet deployed.
  var STAGES = {
    live:      { label: 'Live', tone: 'live' },
    deployed:  { label: 'Deployed · paused', tone: 'muted' },
    paused:    { label: 'Paused', tone: 'muted' },
    publishing:{ label: 'Publishing', tone: 'info' },
    failed:    { label: 'Publish failed', tone: 'risk' },
    ready:     { label: 'Ready to launch', tone: 'ready' },
    warning:   { label: 'Ready · warnings', tone: 'attention' },
    blocked:   { label: 'Blocked', tone: 'attention' },
    draft:     { label: 'Draft', tone: 'muted' },
    archived:  { label: 'Archived', tone: 'muted' }
  };
  OW.STAGES = STAGES;

  function liveProviderStatus(s) {
    s = String(s || '').toLowerCase();
    return s === 'active' || s === 'enabled' || s === 'enable' || s === 'campaign_status_enable' || s === 'running';
  }
  OW.liveProviderStatus = liveProviderStatus;

  // Is a locally-recorded, deployed campaign actually running? The provider
  // is the source of truth: a synced provider row for the same external ID
  // wins; otherwise the status the provider returned at publish time
  // (publish routes create campaigns paused); only legacy records with
  // neither fall back to the old "published = live" meaning.
  function importedByExternal() {
    var m = {};
    C.imported().forEach(function (r) { if (r.external_campaign_id) m[(r.platform || '') + ':' + r.external_campaign_id] = r; });
    return m;
  }
  function localIsLive(c, imp) {
    if (c.status !== 'published' && c.status !== 'active') return false;
    var row = c.platformCampaignId ? imp[(c.platform || '') + ':' + c.platformCampaignId] : null;
    if (row) return liveProviderStatus(row.status);
    if (c.providerStatus) return liveProviderStatus(c.providerStatus);
    return true;
  }

  C.stage = function (c) {
    var st = (c && c.status) || 'draft';
    if (st === 'published' || st === 'active') return localIsLive(c, importedByExternal()) ? Object.assign({ key: 'live' }, STAGES.live) : Object.assign({ key: 'deployed' }, STAGES.deployed);
    if (st === 'paused') return Object.assign({ key: 'paused' }, STAGES.paused);
    if (st === 'publishing') return Object.assign({ key: 'publishing' }, STAGES.publishing);
    if (st === 'failed') return Object.assign({ key: 'failed' }, STAGES.failed);
    if (st === 'archived') return Object.assign({ key: 'archived' }, STAGES.archived);
    if (typeof window._launchListReadiness === 'function' && c.pkg) {
      try {
        var r = window._launchListReadiness(c);
        if (r && STAGES[r.state]) return Object.assign({ key: r.state }, STAGES[r.state]);
      } catch (_) {}
    }
    return Object.assign({ key: 'draft' }, STAGES.draft);
  };

  // Live campaigns across OrivenAI-launched and imported records, de-duplicated
  // by provider campaign id so the same ad is never counted twice.
  C.live = function () {
    var out = [], seen = {};
    var imp = importedByExternal();
    C.local().forEach(function (c) {
      if (c.status !== 'published' && c.status !== 'active') return;
      var k = (c.platform || '') + ':' + (c.platformCampaignId || c.id);
      seen[k] = 1; // a deployed-but-paused record still claims its ID
      if (!localIsLive(c, imp)) return;
      out.push({ name: c.name, platform: c.platform, localId: c.id, externalId: c.platformCampaignId || null, source: c.manual ? 'manual' : 'oriven', lineage: c.lineage || null });
    });
    C.imported().forEach(function (r) {
      if (!liveProviderStatus(r.status)) return;
      var k = (r.platform || '') + ':' + r.external_campaign_id;
      if (seen[k]) return; seen[k] = 1;
      out.push({ name: r.name, platform: r.platform, externalId: r.external_campaign_id, source: 'imported', syncedAt: r.synced_at || r.updated_at });
    });
    return out;
  };

  C.counts = function () {
    var local = C.local().filter(function (c) { return c.status !== 'archived'; });
    var n = { total: local.length, drafts: 0, ready: 0, warning: 0, blocked: 0, failed: 0, publishing: 0, paused: 0, manual: 0, byPlatform: {} };
    local.forEach(function (c) {
      if (c.manual) n.manual++;
      var s = C.stage(c).key;
      if (s === 'ready' || s === 'warning' || s === 'blocked' || s === 'draft') {
        n.drafts++;
        if (s === 'ready') n.ready++; else if (s === 'warning') n.warning++; else if (s === 'blocked') n.blocked++;
        var p = c.platform || 'meta';
        n.byPlatform[p] = (n.byPlatform[p] || 0) + 1;
      }
      if (s === 'failed') n.failed++;
      if (s === 'publishing') n.publishing++;
      if (s === 'paused') n.paused++;
    });
    var live = C.live();
    n.live = live.length;
    n.livePlatforms = {};
    live.forEach(function (l) { n.livePlatforms[l.platform] = (n.livePlatforms[l.platform] || 0) + 1; });
    return n;
  };

  C.find = function (localId) {
    return C.local().filter(function (c) { return c.id === localId; })[0] || null;
  };
  C.findByExternal = function (platform, externalId, name) {
    var local = C.local();
    var hit = null;
    if (externalId) hit = local.filter(function (c) { return c.platform === platform && String(c.platformCampaignId || '') === String(externalId); })[0];
    if (!hit && name) hit = local.filter(function (c) { return c.platform === platform && c.name === name && (c.status === 'published' || c.status === 'paused'); })[0];
    return hit || null;
  };

  var emitTimer = null;
  function emitSoon(topic) { clearTimeout(emitTimer); emitTimer = setTimeout(function () { emit(topic); }, 60); }

  // ══════════════════════════════════════════════════════════════════
  // 2. WORKSPACE DATA (cached, fetched once per minute at most)
  // ══════════════════════════════════════════════════════════════════
  var D = OW.data = {
    connections: null,   // { google: bool, ... }
    health: null,        // /api/business/health
    profile: null,       // business_profile row
    apRules: null, apRecs: null, apTasks: null,
    events: null,        // unread, undismissed intelligence events
    loadedAt: 0
  };
  var dataLoading = null;

  function loadConnections() {
    var out = {};
    return Promise.all(Object.keys(PLAT).map(function (p) {
      return api('/api/' + p + '/status').then(function (r) { out[p] = !!(r.ok && r.data && r.data.connected); });
    })).then(function () { D.connections = out; emit('connections'); return out; });
  }
  OW.connections = function () { return D.connections ? Promise.resolve(D.connections) : loadConnections(); };

  // Forget everything account-specific (sign-out, or a different account
  // signing in on the same page) — one user's state never renders for
  // another.
  var currentUid = null;
  OW.reset = function () {
    C.rows = null; C.loadedAt = 0; C.loading = null; C.error = null; C.settled = false; C.lastHydrate = null;
    baseline = null;
    D.connections = null; D.health = null; D.profile = null; D.apRules = null; D.apRecs = null; D.apTasks = null; D.events = null; D.loadedAt = 0;
    dataLoading = null; pendingLaunch = null; pendingPrf = null; pendingLineage = null; picked = {};
    currentUid = null;
    if (OW._clearApiCache) OW._clearApiCache();
    document.querySelectorAll('.ow-ni-mark').forEach(function (m) { m.remove(); });
    // Page-level state other scripts keep on window (Autopilot lists, the
    // in-memory Research result, the cached Business profile). Home and
    // Chat read these, so they must not survive into the next account.
    ['_apRules', '_apPendingApprovals', '_apHistoryItems', '_apPlatformCampaigns', '_apSourcesSnapshot',
     '_orvLaunchBiz', '_cr2RecentAssets'].forEach(function (k) { try { window[k] = undefined; } catch (_) {} });
    if (window._researchLastResult && typeof window._researchNewSession === 'function' && !user()) {
      // No user is signed in at this point, so this only resets the view —
      // it cannot touch anyone's persisted research.
      try { window._researchNewSession(); } catch (_) {}
    }
    window._researchLastResult = null;
    if (typeof window._researchSessionRestored !== 'undefined') window._researchSessionRestored = false;
  };
  function checkUser() {
    var u = user();
    var id = u && u.id;
    if (currentUid && id !== currentUid) OW.reset();
    currentUid = id || null;
    return !!id;
  }

  OW.refresh = function (force) {
    if (!checkUser()) return Promise.resolve();
    var fresh = D.loadedAt && Date.now() - D.loadedAt < 60000;
    var tasks = [C.refresh(force)];
    if (!dataLoading && (force || !fresh)) {
      D.loadedAt = Date.now();
      var sub = [
        loadConnections(),
        api('/api/business/health').then(function (r) { D.health = r.ok ? r.data : null; emit('business'); }),
        api('/api/business/profile').then(function (r) { D.profile = (r.ok && r.data && r.data.profile) || null; emit('business'); }),
        api('/api/intelligence/events?days=7&dismissed=false&read=false').then(function (r) {
          D.events = (r.ok && r.data && Array.isArray(r.data.events)) ? r.data.events : null; emit('events');
        })
      ];
      if (hasAutopilotPlan()) {
        sub.push(api('/api/autopilot/rules').then(function (r) { D.apRules = (r.ok && r.data && r.data.rules) || (r.ok ? [] : null); emit('autopilot'); }));
        sub.push(api('/api/autopilot/recommendations?status=suggested').then(function (r) { D.apRecs = (r.ok && r.data && r.data.recommendations) || (r.ok ? [] : null); emit('autopilot'); }));
        sub.push(api('/api/autopilot/tasks').then(function (r) { D.apTasks = (r.ok && r.data && r.data.tasks) || (r.ok ? [] : null); emit('autopilot'); }));
      }
      dataLoading = Promise.all(sub).then(function () { dataLoading = null; });
      tasks.push(dataLoading);
    } else if (dataLoading) tasks.push(dataLoading);
    return Promise.all(tasks);
  };

  // Autopilot's own page loads the same rules/recommendations; prefer its
  // fresher copy when present so both surfaces never disagree.
  function apRules() { return Array.isArray(window._apRules) ? window._apRules : D.apRules; }
  function apRecs() { return Array.isArray(window._apPendingApprovals) ? window._apPendingApprovals : D.apRecs; }

  function businessName() {
    var p = D.profile || (window._orvLaunchBiz && window._orvLaunchBiz.profile) || null;
    var bc = (typeof S !== 'undefined' && S && S.brandCore) || null;
    return (p && p.company_name) || (bc && bc.name) || null;
  }
  OW.businessName = businessName;

  function researchSession() {
    try {
      if (window._researchLastResult && window._researchLastResult.question) return { result: window._researchLastResult, savedAt: null };
      var s = (typeof window._orvLoadResearchSession === 'function') ? window._orvLoadResearchSession() : null;
      return (s && s.result && s.result.question) ? s : null;
    } catch (_) { return null; }
  }
  OW.researchSession = researchSession;

  // Which rules genuinely cover a campaign (same scope semantics the rule
  // builder writes: action_params.campaign_id 'all' or a specific id/name).
  function rulesFor(platform, externalId, name) {
    var rules = apRules() || [];
    return rules.filter(function (r) {
      if (!r.enabled || r.platform !== platform) return false;
      var ap = r.action_params || {};
      if (!ap.campaign_id || ap.campaign_id === 'all') return true;
      return (externalId && String(ap.campaign_id) === String(externalId)) || (name && ap.campaign_name === name);
    });
  }
  OW.rulesFor = rulesFor;

  // ══════════════════════════════════════════════════════════════════
  // 3. ATTENTION MODEL — "Needs you"
  // ══════════════════════════════════════════════════════════════════
  var TONE_ORDER = { risk: 0, attention: 1, ready: 2, info: 3 };
  var BIZ_TAB = { business: 'business', products: 'business', audiences: 'market', competitors: 'competitors', website: 'overview', brand: 'brand', connections: 'connections' };

  OW.attention = function () {
    var items = [];
    var n = C.counts();
    var local = C.local();

    // Publish failures — a real, recorded provider rejection.
    local.filter(function (c) { return c.status === 'failed'; }).slice(0, 2).forEach(function (c) {
      items.push({
        id: 'fail:' + c.id, tone: 'risk', source: 'Launch · ' + ((PLAT[c.platform] || {}).label || 'Publish'),
        title: 'Publishing “' + (c.name || 'Untitled') + '” failed',
        why: c.failureReason ? String(c.failureReason).slice(0, 160) : 'The platform rejected the last publish attempt.',
        action: 'Review', go: { page: 'launch', campaignId: c.id, platform: c.platform }
      });
    });

    // High-severity intelligence events that are still unread.
    (D.events || []).filter(function (e) { return e && !e.dismissed && !e.read && (e.severity === 'high' || e.severity === 'critical'); })
      .slice(0, 2).forEach(function (e) {
        items.push({
          id: 'ev:' + e.id, tone: 'risk', source: 'Campaigns' + (e.platform && PLAT[e.platform] ? ' · ' + PLAT[e.platform].label : ''),
          title: e.title || 'Performance alert', why: e.detail || '',
          action: 'Open', go: { page: 'campaigns', platform: e.platform, campaignName: e.campaign_name }
        });
      });

    // Autopilot recommendations waiting for approval.
    var recs = apRecs();
    if (recs && recs.length) {
      var r0 = recs[0];
      items.push({
        id: 'aprec', tone: 'attention', source: 'Autopilot',
        title: recs.length === 1 ? 'A recommendation is waiting for your approval' : recs.length + ' recommendations are waiting for your approval',
        why: r0.problem ? String(r0.problem).slice(0, 170) : 'Nothing happens until you approve or reject.',
        action: 'Review', go: { page: 'autopilot' }
      });
    }

    // Business: conversion tracking for each connected platform (the same
    // real, standing limitation Business → Advertising shows) and the top
    // real completeness gaps from /api/business/health.
    var conn = D.connections || {};
    var verified = window._bicVerifiedTracking || {};
    var trackingPlats = Object.keys(PLAT).filter(function (p) { return conn[p] && !verified[p]; });
    if (trackingPlats.length) {
      var labels = trackingPlats.map(function (p) { return PLAT[p].label; });
      items.push({
        id: 'tracking', tone: 'attention', source: 'Business context · Advertising',
        title: 'Conversion tracking isn’t verified for ' + labels.join(' and '),
        why: 'OrivenAI can’t confirm pixel or conversion-event setup, so results and Autopilot rules that rely on conversions may be incomplete.',
        action: 'Check setup', go: { page: 'business', tab: 'overview' }
      });
    }
    var recsBiz = (D.health && Array.isArray(D.health.recommendations)) ? D.health.recommendations.filter(function (r) { return r.severity === 'high' || r.severity === 'medium'; }) : [];
    recsBiz.sort(function (a, b) { return (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1); });
    recsBiz.slice(0, 2).forEach(function (r, i) {
      items.push({
        id: 'biz:' + i + ':' + r.title, tone: 'attention', source: 'Business context',
        title: r.title, why: r.detail || '', action: 'Open',
        go: { page: 'business', tab: BIZ_TAB[r.tab] || 'overview' }
      });
    });

    // Launch: blocked drafts (what's actually blocking comes from the same
    // readiness engine Launch renders).
    if (n.blocked) {
      var blockedCamps = local.filter(function (c) { return C.stage(c).key === 'blocked'; });
      var reason = blockedReason(blockedCamps);
      var bp = mostCommon(blockedCamps.map(function (c) { return c.platform || 'meta'; }));
      items.push({
        id: 'blocked', tone: 'attention', source: 'Launch',
        title: n.blocked === 1 ? '“' + (blockedCamps[0].name || 'A draft') + '” can’t launch yet' : n.blocked + ' drafts can’t launch yet',
        why: reason || 'Launch found a required item missing.',
        action: 'Fix in Launch', go: { page: 'launch', platform: bp, status: 'blocked', campaignId: n.blocked === 1 ? blockedCamps[0].id : null }
      });
    }
    if (n.ready) {
      var readyCamps = local.filter(function (c) { return C.stage(c).key === 'ready'; });
      items.push({
        id: 'ready', tone: 'ready', source: 'Launch',
        title: n.ready === 1 ? '“' + (readyCamps[0].name || 'A campaign') + '” is ready to launch' : n.ready + ' campaigns are ready to launch',
        why: 'Every required launch check passes. Review and publish when you’re ready.',
        action: 'Review', go: { page: 'launch', platform: readyCamps[0].platform, status: 'ready', campaignId: n.ready === 1 ? readyCamps[0].id : null }
      });
    }

    items.sort(function (a, b) { return TONE_ORDER[a.tone] - TONE_ORDER[b.tone]; });
    return items;
  };

  function mostCommon(arr) {
    var m = {}, best = null;
    arr.forEach(function (x) { m[x] = (m[x] || 0) + 1; if (best === null || m[x] > m[best]) best = x; });
    return best;
  }
  function blockedReason(camps) {
    if (typeof window._launchExtractFields !== 'function' || typeof window._launchBuildCampaignChecks !== 'function') return '';
    var labels = {};
    camps.forEach(function (c) {
      try {
        var checks = window._launchBuildCampaignChecks(c, window._launchExtractFields(c.pkg, c.platform));
        checks.filter(function (ch) { return ch.status === 'blocked'; }).forEach(function (ch) { labels[ch.label] = (labels[ch.label] || 0) + 1; });
      } catch (_) {}
    });
    var top = Object.keys(labels).sort(function (a, b) { return labels[b] - labels[a]; })[0];
    if (!top) return '';
    var cnt = labels[top];
    return (camps.length === 1 ? 'Missing: ' : cnt + ' of ' + camps.length + ' are missing: ') + top.toLowerCase() + '.';
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. MODULE STATE — the six parts of one system
  // ══════════════════════════════════════════════════════════════════
  // tone: live | ready | active | attention | risk | empty | locked
  OW.modules = function () {
    var n = C.counts();
    var att = OW.attention();
    var conn = D.connections || {};
    var connected = Object.keys(conn).filter(function (p) { return conn[p]; });
    var mods = [];

    // Business
    var bizAtt = att.filter(function (a) { return a.source.indexOf('Business') === 0; }).length;
    var overall = D.health && typeof D.health.overall === 'number' ? D.health.overall : null;
    var hasBiz = !!businessName() || (overall !== null && overall > 0);
    mods.push({
      key: 'business', label: 'Control Center', go: { page: 'business', tab: 'overview' },
      tone: !hasBiz ? 'empty' : (bizAtt ? 'attention' : 'active'),
      state: !hasBiz ? 'Not set up' : (bizAtt ? 'Needs you' : 'In use'),
      summary: !hasBiz ? 'Tell OrivenAI about your business' : ((overall !== null ? overall + '% complete' : 'Profile saved') + (bizAtt ? ' · ' + plural(bizAtt, 'issue') : ''))
    });

    // Research
    var rs = researchSession();
    var usedIn = rs ? C.local().filter(function (c) { return c.lineage && c.lineage.research && c.lineage.research.question === rs.result.question; }).length : 0;
    mods.push({
      key: 'research', label: 'Research', go: { page: 'research' },
      tone: rs ? 'active' : 'empty',
      state: rs ? (usedIn ? 'Used' : 'Saved') : 'No research',
      summary: rs ? ('“' + trunc(rs.result.question, 42) + '”' + (usedIn ? ' · in ' + plural(usedIn, 'campaign') : '')) : 'Explore a market before you build'
    });

    // Create
    mods.push({
      key: 'create', label: 'Create', go: { page: 'create' },
      tone: n.total ? 'active' : 'empty',
      state: n.total ? 'In progress' : 'Nothing yet',
      summary: n.total ? (plural(n.drafts, 'draft') + (n.total - n.drafts > 0 ? ' · ' + (n.total - n.drafts) + ' launched' : '')) : 'Build your first campaign'
    });

    // Launch
    var pending = n.ready + n.warning + n.blocked + (n.drafts - n.ready - n.warning - n.blocked);
    var lParts = [];
    if (n.ready) lParts.push(n.ready + ' ready');
    if (n.warning) lParts.push(n.warning + ' with warnings');
    if (n.blocked) lParts.push(n.blocked + ' blocked');
    mods.push({
      key: 'launch', label: 'Launch', go: { page: 'launch' },
      tone: n.failed ? 'risk' : (n.blocked ? 'attention' : (n.ready ? 'ready' : (pending ? 'active' : 'empty'))),
      state: n.failed ? 'Failed publish' : (n.blocked ? 'Needs you' : (n.ready ? 'Ready' : (pending ? 'Waiting' : 'Nothing waiting'))),
      summary: lParts.length ? lParts.join(' · ') : (pending ? plural(pending, 'draft') + ' to review' : 'Drafts appear here when built')
    });

    // Campaigns
    var livePlats = Object.keys(n.livePlatforms || {});
    mods.push({
      key: 'campaigns', label: 'Campaigns', go: { page: 'campaigns', platform: livePlats[0] || connected[0] || null },
      tone: n.live ? 'live' : (connected.length ? 'active' : 'empty'),
      state: n.live ? 'Live' : (connected.length ? 'Connected' : 'Not connected'),
      summary: n.live ? (n.live + ' live' + (livePlats.length ? ' · ' + livePlats.map(function (p) { return PLAT[p] ? PLAT[p].short : p; }).join(', ') : '')) :
        (connected.length ? connected.map(function (p) { return PLAT[p].short; }).join(', ') + ' connected' : 'Connect an ad platform')
    });

    // Autopilot
    var ap;
    if (!hasAutopilotPlan()) {
      ap = { tone: 'locked', state: 'Starter', summary: 'Available from the Starter plan' };
    } else {
      var rules = apRules();
      var recs = apRecs() || [];
      var enabled = (rules || []).filter(function (r) { return r.enabled && AUTOPILOT_MONITORED[r.platform]; });
      var watched = C.live().filter(function (l) { return AUTOPILOT_MONITORED[l.platform] && rulesFor(l.platform, l.externalId, l.name).length; }).length;
      if (rules === null) ap = { tone: 'empty', state: 'Checking', summary: 'Reading your automations…' };
      else if (recs.length) ap = { tone: 'attention', state: 'Needs you', summary: plural(recs.length, 'approval') + ' waiting' };
      else if (enabled.length) ap = { tone: 'live', state: 'Watching', summary: plural(enabled.length, 'rule') + (watched ? ' · ' + plural(watched, 'campaign') + ' covered' : '') };
      else ap = { tone: 'empty', state: 'Off', summary: rules.length ? 'All rules paused' : 'No rules yet' };
    }
    mods.push(Object.assign({ key: 'autopilot', label: 'Autopilot', go: { page: 'autopilot' } }, ap));
    return mods;
  };

  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  OW.trunc = trunc;

  // ══════════════════════════════════════════════════════════════════
  // 5. NAVIGATION THAT CARRIES CONTEXT
  // ══════════════════════════════════════════════════════════════════
  var pendingLaunch = null, pendingPrf = null;
  OW.go = function (t) {
    if (!t) return;
    if (typeof t === 'string') { try { t = JSON.parse(t); } catch (_) { t = { page: t }; } }
    var nav = window._orvNav;
    if (typeof nav !== 'function') return;
    switch (t.page) {
      case 'home':
        // Home was merged into Control Center (the Business page's overview).
        if (typeof window.bizGoTo === 'function') window.bizGoTo('overview');
        else nav('businessbrain', 'page-business-brain');
        break;
      case 'business':
        if (typeof window.bizGoTo === 'function') window.bizGoTo(t.tab || 'overview');
        else nav('businessbrain', 'page-business-brain');
        break;
      case 'research': nav('research', 'page-research'); break;
      case 'create': nav('create', 'page-create'); break;
      case 'launch':
        pendingLaunch = { platform: t.platform || null, status: t.status || 'all', campaignId: t.campaignId || null, at: Date.now() };
        nav('launch', 'page-launch');
        break;
      case 'campaigns':
        if (t.platform && PLAT[t.platform]) {
          window._prfActivePlatform = t.platform;
          window._prfActiveCampaign = 'all';
          try { localStorage.setItem('_prfPlatform', t.platform); } catch (_) {}
        }
        pendingPrf = t.campaignName ? { name: t.campaignName, at: Date.now() } : null;
        nav('performance', 'page-performance');
        break;
      case 'autopilot': nav('autopilot', 'page-autopilot'); break;
      default: nav(t.page, t.pageId);
    }
  };
  // Launch consumes its target once per navigation (see renderLaunchPage).
  OW.consumeLaunchTarget = function () {
    var t = pendingLaunch; pendingLaunch = null;
    return (t && Date.now() - t.at < 15000) ? t : null;
  };
  // Campaigns consumes the target only once its real name list contains
  // it; it expires rather than applying to a much later reload.
  OW.consumeCampaignTarget = function (names) {
    if (!pendingPrf) return null;
    if (Date.now() - pendingPrf.at > 20000) { pendingPrf = null; return null; }
    if (names && names.indexOf(pendingPrf.name) !== -1) { var n = pendingPrf.name; pendingPrf = null; return n; }
    return null;
  };

  // Delegated click handling for any element carrying data-ow-go — keeps
  // markup free of inline JSON quoting problems.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-ow-go]') : null;
    if (!el) return;
    var raw = el.getAttribute('data-ow-go');
    try { OW.go(JSON.parse(raw)); } catch (_) {}
  });
  function goAttr(t) { return ' data-ow-go="' + esc(JSON.stringify(t)) + '"'; }
  OW.goAttr = goAttr;

  // A brief arrival highlight on the element the user was sent to —
  // spatial continuity between "I clicked this" and "here it is".
  OW.arrive = function (el) {
    if (!el || reduceMotion) return;
    el.classList.remove('ow-arrive'); void el.offsetWidth; el.classList.add('ow-arrive');
    setTimeout(function () { el.classList.remove('ow-arrive'); }, 1600);
  };

  // ══════════════════════════════════════════════════════════════════
  // 6. LINEAGE — where a campaign came from
  // ══════════════════════════════════════════════════════════════════
  var pendingLineage = null;
  OW.lineage = {
    // Called by cgrGenerate with the real payload it is about to send, so
    // lineage reflects exactly what generation used.
    capture: function (payload) {
      try {
        var brandOn = window._ov3BrandIdentityEnabled !== false;
        var bizName = businessName();
        var lin = {
          at: new Date().toISOString(),
          create: {
            platform: payload.platform || null, goal: payload.goal || null,
            format: payload.creativeMode === 'videos' ? 'video' : 'image',
            campaignType: payload.campaignType || null, placement: payload.metaPlacement || null
          }
        };
        if (bizName) lin.business = { name: bizName, brandIdentity: brandOn && !!payload.brandCore };
        if (payload.researchContext) {
          lin.research = {
            question: payload.researchContext.question || null,
            findings: (payload.researchContext.findings || []).map(function (f) { return { group: f.group, text: f.text }; })
          };
        }
        if (payload.pageContext) lin.page = { url: payload.pageContext.url || null };
        if (payload.referenceAdContext) lin.reference = true;
        pendingLineage = lin;
      } catch (_) { pendingLineage = null; }
    },
    take: function () {
      var l = pendingLineage; pendingLineage = null;
      if (l && l.research) OW.research.clearHandoff(true);
      return l;
    }
  };

  // Restrained source chips for any campaign card (Launch, Campaigns, Home).
  OW.lineageChips = function (c, opts) {
    opts = opts || {};
    if (!c) return '';
    var l = c.lineage || null;
    var chips = [];
    if (l && l.research) chips.push('<span class="ow-src ow-src-research" title="' + esc('Research: ' + (l.research.question || '')) + '">From Research</span>');
    if (l && l.business && l.business.name && opts.business !== false) chips.push('<span class="ow-src ow-src-business" title="' + esc('Business context: ' + l.business.name) + '">From Business</span>');
    if (c.manual) chips.push('<span class="ow-src ow-src-manual">Added manually</span>');
    if (c._fromServer && opts.synced) chips.push('<span class="ow-src ow-src-muted" title="Restored from your OrivenAI account on this device">Synced</span>');
    return chips.length ? '<span class="ow-srcs">' + chips.join('') + '</span>' : '';
  };

  // ══════════════════════════════════════════════════════════════════
  // 7. RESEARCH → CREATE HANDOFF
  // ══════════════════════════════════════════════════════════════════
  var R = OW.research = {};
  var picked = {}; // finding id -> { group, text } (current Research view only)
  function handoffKey() { return uidKey('oriven_research_handoff_'); }
  R.handoff = function () { var h = readJSON(handoffKey(), null); return (h && Array.isArray(h.findings) && h.findings.length) ? h : null; };

  R.isPicked = function (id) { return !!picked[id]; };
  R.pickedCount = function () { return Object.keys(picked).length; };
  R.resetPicks = function () { picked = {}; R.syncUseButton(); };
  R.togglePick = function (btn) {
    if (!btn) return;
    var id = btn.getAttribute('data-fid');
    if (picked[id]) delete picked[id];
    else picked[id] = { id: id, group: btn.getAttribute('data-group') || '', text: btn.getAttribute('data-text') || '' };
    var on = !!picked[id];
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('is-on', on);
    var row = btn.closest('.rsc-finding-item');
    if (row) row.classList.toggle('is-picked', on);
    R.syncUseButton();
  };
  R.syncUseButton = function () {
    var btn = document.getElementById('researchUseInCreateBtn');
    if (!btn) return;
    var n = R.pickedCount();
    btn.textContent = n ? ('Use ' + plural(n, 'finding') + ' in Create →') : 'Use in Create →';
    btn.classList.toggle('ow-count-bump', false); void btn.offsetWidth;
    if (n) btn.classList.add('ow-count-bump');
  };

  // Builds the handoff from the real result (selected findings, or the top
  // opportunity when nothing is selected) and stores it for Create.
  R.buildHandoff = function (result) {
    if (!result) return null;
    var findings = Object.keys(picked).map(function (k) { return picked[k]; });
    if (!findings.length) {
      var opp = (result.opportunities || []).filter(function (o) { return o && o.opportunity; })[0];
      if (opp) findings.push({ id: opp.id || 'opp0', group: 'Opportunity', text: opp.opportunity });
    }
    if (!findings.length) return null;
    var h = { question: result.question || '', summary: result.summary || '', savedAt: new Date().toISOString(), findings: findings.slice(0, 8) };
    writeJSON(handoffKey(), h);
    return h;
  };
  R.removeFinding = function (id) {
    var h = R.handoff(); if (!h) return;
    h.findings = h.findings.filter(function (f) { return f.id !== id; });
    if (h.findings.length) writeJSON(handoffKey(), h); else R.clearHandoff();
    if (typeof window._cr2RenderStage === 'function') window._cr2RenderStage();
  };
  R.clearHandoff = function (silent) {
    var k = handoffKey(); if (k) { try { localStorage.removeItem(k); } catch (_) {} }
    if (!silent && typeof window._cr2RenderStage === 'function') window._cr2RenderStage();
  };
  // The exact, capped structure POST /api/ai/create-ad receives as
  // researchContext (server.js frames it as untrusted, directional data).
  R.payload = function () {
    var h = R.handoff(); if (!h) return null;
    return {
      question: trunc(h.question, 300),
      summary: trunc(h.summary, 600),
      findings: h.findings.slice(0, 8).map(function (f) { return { group: trunc(f.group, 40), text: trunc(f.text, 280) }; })
    };
  };

  // ══════════════════════════════════════════════════════════════════
  // 8a. HOME
  // ══════════════════════════════════════════════════════════════════
  var H = OW.home = {};
  // Home is a practical dashboard: greeting + one sentence, four real
  // status blocks, then "Needs you" and "Continue" side by side. All values
  // come from the shared model above; nothing here computes state itself.
  var KPI_ICONS = {
    live: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.2"/><path d="M4.2 11.8a5.4 5.4 0 0 1 0-7.6M11.8 4.2a5.4 5.4 0 0 1 0 7.6"/></svg>',
    drafts: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2.5" width="10" height="11" rx="1.6"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3"/></svg>',
    attention: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 14 13H2z"/><path d="M8 6.5v3"/><circle cx="8" cy="11.2" r=".4" fill="currentColor"/></svg>',
    autopilot: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8.8 1L3.6 9.2h3.5L6.2 15l6.2-8.7H9.1L8.8 1z"/></svg>'
  };
  var lastKpi = {};

  function greetingWord() { var h = new Date().getHours(); return h < 12 ? 'morning' : (h < 18 ? 'afternoon' : 'evening'); }

  function kpiModel(n, att) {
    var urgent = att.filter(function (a) { return a.tone === 'risk' || a.tone === 'attention'; });
    var lp = Object.keys(n.livePlatforms || {});
    var draftParts = [];
    if (n.ready) draftParts.push(n.ready + ' ready');
    if (n.warning) draftParts.push(n.warning + ' with warnings');
    if (n.blocked) draftParts.push(n.blocked + ' blocked');
    var ap;
    if (!hasAutopilotPlan()) ap = { value: '—', sub: 'Available from Starter', tone: 'muted' };
    else {
      var rules = apRules(), recs = apRecs() || [];
      if (rules === null) ap = { value: '…', sub: 'Checking automations', tone: 'muted' };
      else {
        // Only rules the monitoring cron really evaluates (Google/Meta) count.
        var on = rules.filter(function (r) { return r.enabled && AUTOPILOT_MONITORED[r.platform]; }).length;
        ap = on ? { value: String(on), sub: (on === 1 ? 'active rule' : 'active rules') + (recs.length ? ' · ' + recs.length + ' awaiting approval' : ''), tone: recs.length ? 'attention' : 'live' }
                : { value: 'Off', sub: rules.some(function (r) { return r.enabled; }) ? 'Rules not on a monitored platform' : (rules.length ? 'All rules paused' : 'No automations yet'), tone: 'muted' };
      }
    }
    return [
      { key: 'live', label: 'Live', value: String(n.live), sub: n.live ? (n.live === 1 ? 'campaign' : 'campaigns') + (lp.length ? ' on ' + lp.map(function (p) { return PLAT[p] ? PLAT[p].short : p; }).join(', ') : '') : 'Nothing live yet', tone: n.live ? 'live' : 'muted', go: { page: 'campaigns', platform: lp[0] || null } },
      { key: 'drafts', label: 'Drafts', value: String(n.drafts), sub: n.drafts ? (draftParts.join(' · ') || 'in progress') : 'Nothing in progress', tone: n.drafts ? 'info' : 'muted', go: n.drafts ? { page: 'launch' } : { page: 'create' } },
      { key: 'attention', label: 'Needs attention', value: String(urgent.length), sub: urgent.length ? (urgent.length === 1 ? urgent[0].source : 'Across ' + uniqueSources(urgent)) : 'All clear', tone: urgent.length ? 'attention' : 'muted', go: null },
      { key: 'autopilot', label: 'Autopilot', value: ap.value, sub: ap.sub, tone: ap.tone, go: { page: 'autopilot' } }
    ];
  }
  function uniqueSources(items) {
    var s = {};
    items.forEach(function (a) { s[a.source.split(' · ')[0]] = 1; });
    var k = Object.keys(s);
    return k.length > 2 ? k.slice(0, 2).join(', ') + ' and more' : k.join(' and ');
  }

  function renderKpis(n, att) {
    var wrap = document.getElementById('owKpis');
    if (!wrap) return;
    var kpis = kpiModel(n, att);
    var fresh = !wrap.querySelector('.ow-kpi[data-kpi]');
    if (fresh) {
      wrap.innerHTML = kpis.map(function (k, i) {
        return '<button type="button" class="ow-kpi" data-kpi="' + k.key + '" style="--i:' + i + '"><span class="ow-kpi-top"><span class="ow-kpi-ic" aria-hidden="true">' + KPI_ICONS[k.key] + '</span><span class="ow-kpi-lbl"></span></span><span class="ow-kpi-val"></span><span class="ow-kpi-sub"></span></button>';
      }).join('');
    }
    kpis.forEach(function (k) {
      var el = wrap.querySelector('[data-kpi="' + k.key + '"]');
      if (!el) return;
      el.className = 'ow-kpi ow-t-' + k.tone;
      if (k.go) el.setAttribute('data-ow-go', JSON.stringify(k.go)); else el.removeAttribute('data-ow-go');
      el.onclick = k.key === 'attention' ? function () { var p = document.getElementById('owNeeds'); if (p) { p.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' }); OW.arrive(p); } } : null;
      el.setAttribute('aria-label', k.label + ': ' + k.value + ' — ' + k.sub);
      el.querySelector('.ow-kpi-lbl').textContent = k.label;
      el.querySelector('.ow-kpi-sub').textContent = k.sub;
      var v = el.querySelector('.ow-kpi-val');
      if (v.textContent !== k.value) {
        v.textContent = k.value;
        if (!fresh && lastKpi[k.key] !== undefined && !reduceMotion) { v.classList.remove('ow-tick'); void v.offsetWidth; v.classList.add('ow-tick'); }
      }
      lastKpi[k.key] = k.value;
    });
  }

  H.render = function () {
    var root = document.getElementById('owHome');
    if (!root) return;
    if (OW.placeBell) OW.placeBell();
    var g = document.getElementById('owHomeGreeting');
    if (g) g.textContent = 'Good ' + greetingWord() + '.';
    var eb = document.getElementById('owHomeEyebrow');
    var bn = businessName();
    if (eb) eb.textContent = bn || 'Control Center';

    if (!C.settled) { root.classList.add('is-loading'); return; }
    root.classList.remove('is-loading');

    var n = C.counts();
    var att = OW.attention();
    var parts = [];
    if (n.live) parts.push(plural(n.live, 'campaign') + ' live');
    if (n.drafts) parts.push(plural(n.drafts, 'draft') + ' in progress');
    var urgent = att.filter(function (a) { return a.tone === 'risk' || a.tone === 'attention'; }).length;
    if (urgent) parts.push(urgent === 1 ? '1 thing needs your attention' : urgent + ' things need your attention');
    var status = document.getElementById('owHomeStatus');
    if (status) status.textContent = parts.length ? parts.join(' · ') + '.' : 'Nothing is running yet — build your first campaign when you’re ready.';

    renderKpis(n, att);
    renderNeeds(att);
    var hasContinue = renderContinue();
    var grid = document.getElementById('owDashGrid');
    if (grid) grid.classList.toggle('is-single', !hasContinue);
  };

  // "Needs you" — the few most important real items; the rest on request.
  var needsExpanded = false;
  function renderNeeds(att) {
    var list = document.getElementById('owNeedsList');
    if (!list) return;
    // Control Center shows approvals in its Autopilot block, so they are not
    // repeated here; two rows by default, the rest on request.
    if (document.getElementById('ovAuto')) att = att.filter(function (a) { return a.id !== 'aprec'; });
    if (!att.length) {
      list.innerHTML = '<p class="ow-calm"><i aria-hidden="true"></i>Nothing needs you right now.</p>';
      return;
    }
    var shown = needsExpanded ? att : att.slice(0, 2);
    list.innerHTML = shown.map(function (a, i) {
      return '<button type="button" class="ow-row ow-t-' + a.tone + '" style="--i:' + i + '"' + goAttr(a.go) + '>' +
        '<i class="ow-row-dot" aria-hidden="true"></i>' +
        '<span class="ow-row-body"><span class="ow-row-title">' + esc(a.title) + '</span><span class="ow-row-sub">' + esc(a.source) + '</span></span>' +
        '<span class="ow-row-act">' + esc(a.action) + '<span aria-hidden="true"> →</span></span>' +
      '</button>';
    }).join('') + (att.length > 2 ? '<button type="button" class="ow-panel-more" onclick="orvWorkspace.home.toggleNeeds()">' + (needsExpanded ? 'Show less' : 'View all ' + att.length) + '</button>' : '');
  }
  var TONE_WORD = { risk: 'Problem', attention: 'Needs you', ready: 'Ready', info: 'Worth knowing' };
  OW.TONE_WORD = TONE_WORD;
  H.toggleNeeds = function () { needsExpanded = !needsExpanded; renderNeeds(OW.attention()); };

  // "Continue" — platform, name, one meaningful state, one action.
  function renderContinue() {
    var wrap = document.getElementById('owContinueList');
    var sec = document.getElementById('owContinue');
    if (!wrap) return false;
    var rows = [];
    var local = C.local().filter(function (c) { return c.status !== 'archived'; });
    local.sort(function (a, b) {
      return new Date(b.updated || b.publishedAt || b.created || 0) - new Date(a.updated || a.publishedAt || a.created || 0);
    });
    local.slice(0, 4).forEach(function (c, i) {
      var stg = C.stage(c);
      var isLive = stg.key === 'live' || stg.key === 'paused' || stg.key === 'deployed';
      var go = isLive ? { page: 'campaigns', platform: c.platform, campaignName: c.name } : { page: 'launch', platform: c.platform, campaignId: c.id };
      rows.push('<button type="button" class="ow-row" style="--i:' + i + '"' + goAttr(go) + '>' +
        platDot(c.platform) +
        '<span class="ow-row-body"><span class="ow-row-title">' + esc(c.name || 'Untitled campaign') + '</span><span class="ow-row-sub">' + esc((PLAT[c.platform] || {}).label || 'Campaign') + ' · ' + esc(relTime(c.updated || c.publishedAt || c.created)) + '</span></span>' +
        '<span class="ow-row-state ow-t-' + stg.tone + '">' + esc(stg.label) + '</span>' +
        '<span class="ow-row-go" aria-hidden="true">→</span>' +
      '</button>');
    });
    var rs = researchSession();
    if (rs && rows.length < 5) {
      rows.push('<button type="button" class="ow-row" style="--i:' + rows.length + '"' + goAttr({ page: 'research' }) + '>' +
        '<i class="ow-pdot ow-pdot-research" aria-hidden="true"></i>' +
        '<span class="ow-row-body"><span class="ow-row-title">' + esc(trunc(rs.result.question, 80)) + '</span><span class="ow-row-sub">Research' + (rs.savedAt ? ' · ' + esc(relTime(rs.savedAt)) : '') + '</span></span>' +
        '<span class="ow-row-state ow-t-muted">Saved</span><span class="ow-row-go" aria-hidden="true">→</span>' +
      '</button>');
    }
    if (sec) sec.style.display = rows.length ? '' : 'none';
    wrap.innerHTML = rows.join('');
    return rows.length > 0;
  }

  // Notification bell — lives at the top-right of whichever container the
  // active page actually scrolls in (the page itself, or .mc), so it scrolls
  // with the page's top edge instead of floating over content. While Chat
  // is open on mobile, styles.css keeps it docked next to Chat's close.
  OW.placeBell = function () {
    var bell = document.getElementById('orvNotifBell');
    var pg = document.querySelector('.page.active');
    if (!bell || !pg) return;
    var oy = getComputedStyle(pg).overflowY;
    var host = (/(auto|scroll)/.test(oy) || !pg.closest('.mc')) ? pg : pg.closest('.mc');
    document.querySelectorAll('.ow-bell-host').forEach(function (h) { if (h !== host) h.classList.remove('ow-bell-host'); });
    host.classList.add('ow-bell-host');
    if (bell.parentNode !== host) host.insertBefore(bell, host.firstChild);
    bell.classList.add('ow-in-page');
  };
  var bellTimer = null;
  window.addEventListener('resize', function () { clearTimeout(bellTimer); bellTimer = setTimeout(OW.placeBell, 150); });

  // Tablet/phone app bar (orivenWorkspace.css, ≤1024px): fades in behind
  // the hamburger and bell once the active page has actually been
  // scrolled, so scrolled content never runs underneath those controls.
  // One passive capture listener; at most one class change per frame.
  (function () {
    var mq = window.matchMedia('(max-width: 1024px)'), on = false, raf = 0;
    function set(v) { if (v !== on) { on = v; document.body.classList.toggle('ow-scrolled', v); } }
    // Always read the ACTIVE page's real scroller: navigation resets .mc to
    // the top (firing a scroll event) even when the page now showing
    // scrolls itself (Home), which must not switch the bar off.
    function sync() {
      var pg = document.querySelector('.page.active');
      if (!pg) { set(false); return; }
      var sc = pg.scrollHeight > pg.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(pg).overflowY) ? pg : (pg.closest('.mc') || pg);
      set(!!(mq.matches && sc.scrollTop > 4));
    }
    document.addEventListener('scroll', function (e) {
      var t = e.target;
      if (!t || t.nodeType !== 1 || !(t.classList.contains('mc') || t.classList.contains('page'))) return;
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; sync(); });
    }, { capture: true, passive: true });
    var place = OW.placeBell;
    OW.placeBell = function () { place(); sync(); };
  })();

  // Sidebar stays clean: no per-area marks. Kept as a no-op (and it clears
  // any marks an earlier build painted) so existing callers stay valid.
  OW.sidebar = {
    paint: function () { document.querySelectorAll('.ow-ni-mark').forEach(function (m) { m.remove(); }); }
  };

  // ══════════════════════════════════════════════════════════════════
  // 8c. LAUNCH helpers
  // ══════════════════════════════════════════════════════════════════
  OW.launch = {
    userPicked: false,
    // Until the user picks a platform themselves, Launch opens on the
    // platform where most of their real campaigns are; afterwards their
    // choice is kept unless that platform has nothing to show. Launch
    // never opens on an empty platform while real drafts exist elsewhere.
    bestPlatform: function (list, current) {
      var counts = {};
      (list || []).forEach(function (c) { var p = c.platform || 'meta'; counts[p] = (counts[p] || 0) + 1; });
      if (OW.launch.userPicked && counts[current]) return current;
      var best = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      return best || current;
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // 8d. CAMPAIGNS — searchable campaign picker (popover over the native
  // select, which stays the single source of the selected value)
  // ══════════════════════════════════════════════════════════════════
  var P = OW.campPicker = { open: false, q: '', idx: -1 };
  function pickerEls() {
    return { sel: document.getElementById('prfCampSelect'), btn: document.getElementById('owCampPickBtn'), lbl: document.getElementById('owCampPickLbl'), pop: document.getElementById('owCampPickPop') };
  }
  // Real options from the native select, enriched (campaign level only)
  // with the status the provider returned and where the campaign came from.
  function pickerOptions() {
    var e = pickerEls();
    if (!e.sel) return [];
    var plat = window._prfActivePlatform;
    var byName = {};
    (window._prfAllCampaigns || []).forEach(function (c) { if (c.platform === plat && c.name) byName[c.name] = c; });
    var campaignsLevel = (window._prfHierarchy || 'campaigns') === 'campaigns';
    return [].map.call(e.sel.options, function (o) {
      var c = campaignsLevel ? byName[o.value] : null;
      var meta = '';
      var live = false;
      if (c) {
        live = liveProviderStatus(c.status);
        var st = String(c.status || '').toLowerCase();
        var local = C.findByExternal(plat, c.id, c.name);
        meta = (live ? 'Live' : (st ? st.charAt(0).toUpperCase() + st.slice(1) : '')) + (local ? (local.manual ? ' · Added manually' : ' · Made in OrivenAI') : '');
      }
      return { value: o.value, label: o.textContent, meta: meta, live: live, all: o.value === 'all' };
    });
  }
  P.sync = function () {
    var e = pickerEls();
    if (!e.sel || !e.btn) return;
    var opt = e.sel.options[e.sel.selectedIndex];
    if (e.lbl) e.lbl.textContent = opt ? opt.textContent : 'All Campaigns';
    e.btn.disabled = !!e.sel.disabled;
    e.btn.title = e.sel.getAttribute('title') || '';
    e.btn.setAttribute('aria-label', (e.sel.getAttribute('aria-label') || 'Select') + (opt ? ': ' + opt.textContent : ''));
    if (P.open) renderPop();
  };
  function renderPop() {
    var e = pickerEls();
    if (!e.pop) return;
    var opts = pickerOptions();
    var q = P.q.trim().toLowerCase();
    var shown = opts.filter(function (o) { return o.all || !q || o.label.toLowerCase().indexOf(q) !== -1; });
    var cur = e.sel ? e.sel.value : 'all';
    var search = opts.length > 6 ? '<div class="ow-cpick-search"><input type="search" id="owCampPickQ" placeholder="Search campaigns" aria-label="Search campaigns" value="' + esc(P.q) + '" autocomplete="off"></div>' : '';
    e.pop.innerHTML = search + '<div class="ow-cpick-list" role="listbox" aria-label="Campaigns">' + shown.map(function (o, i) {
      var on = o.value === cur;
      return '<button type="button" role="option" class="ow-cpick-opt' + (on ? ' is-on' : '') + (i === P.idx ? ' is-kb' : '') + '" aria-selected="' + on + '" data-v="' + esc(o.value) + '">' +
        (o.all ? '' : '<i class="ow-sdot ' + (o.live ? 'ow-t-live' : 'ow-t-muted') + '" aria-hidden="true"></i>') +
        '<span class="ow-cpick-txt"><span class="ow-cpick-name">' + esc(o.label) + '</span>' + (o.meta ? '<span class="ow-cpick-meta">' + esc(o.meta) + '</span>' : '') + '</span>' +
        (on ? '<span class="ow-cpick-check" aria-hidden="true"></span>' : '') +
      '</button>';
    }).join('') + (shown.length <= 1 && q ? '<p class="ow-cpick-none">No campaign matches “' + esc(P.q) + '”.</p>' : '') + '</div>';
    e.pop.querySelectorAll('.ow-cpick-opt').forEach(function (b) {
      b.addEventListener('click', function () { P.choose(b.getAttribute('data-v')); });
    });
    var inp = document.getElementById('owCampPickQ');
    if (inp) inp.addEventListener('input', function () { P.q = inp.value; P.idx = -1; renderPop(); var i2 = document.getElementById('owCampPickQ'); if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); } });
  }
  P.toggle = function () { P.open ? P.close() : P.show(); };
  P.show = function () {
    var e = pickerEls();
    if (!e.pop || !e.btn || e.btn.disabled) return;
    P.open = true; P.q = ''; P.idx = -1;
    renderPop();
    e.pop.hidden = false;
    e.btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { e.pop.classList.add('is-open'); });
    var focusEl = document.getElementById('owCampPickQ') || e.pop.querySelector('.ow-cpick-opt.is-on') || e.pop.querySelector('.ow-cpick-opt');
    if (focusEl) setTimeout(function () { focusEl.focus(); }, 30);
    setTimeout(function () { document.addEventListener('mousedown', outside); document.addEventListener('keydown', keys); }, 0);
  };
  P.close = function (refocus) {
    var e = pickerEls();
    P.open = false;
    document.removeEventListener('mousedown', outside);
    document.removeEventListener('keydown', keys);
    if (!e.pop) return;
    e.pop.classList.remove('is-open');
    e.btn && e.btn.setAttribute('aria-expanded', 'false');
    setTimeout(function () { if (!P.open) e.pop.hidden = true; }, reduceMotion ? 0 : 140);
    if (refocus && e.btn) e.btn.focus();
  };
  P.choose = function (v) {
    var e = pickerEls();
    if (!e.sel) return;
    P.close(true);
    if (e.sel.value === v) return;
    e.sel.value = v;
    if (typeof window.prfSwitchCampaign === 'function') window.prfSwitchCampaign(v);
  };
  function outside(ev) {
    var wrap = document.querySelector('.ow-cpick');
    if (wrap && !wrap.contains(ev.target)) P.close();
  }
  function keys(ev) {
    if (!P.open) return;
    var e = pickerEls();
    if (ev.key === 'Escape') { ev.preventDefault(); P.close(true); return; }
    var opts = e.pop ? [].slice.call(e.pop.querySelectorAll('.ow-cpick-opt')) : [];
    if (!opts.length) return;
    var i = opts.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); opts[Math.min(opts.length - 1, i + 1)].focus(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (i <= 0) { var q = document.getElementById('owCampPickQ'); (q || opts[0]).focus(); } else opts[i - 1].focus(); }
  }

  // A short, restrained refresh cue on the analytics when the scope
  // changes (platform / campaign / date range) — spatial continuity
  // instead of an instant hard swap. Numbers are not re-animated here.
  OW.refreshMotion = function (scope) {
    if (reduceMotion) return;
    var root = document.querySelector(scope || 'body');
    if (!root) return;
    root.querySelectorAll('#prfChartsGrid, #prfMetricExplorer').forEach(function (el) {
      el.classList.remove('ow-refresh'); void el.offsetWidth; el.classList.add('ow-refresh');
    });
  };

  // ══════════════════════════════════════════════════════════════════
  // 8e. AUTOPILOT — progressive disclosure. Sections exist only once real
  // state makes them useful: "Watching" when enabled rules actually cover
  // live campaigns, "What happened" when there is real history. Nothing
  // is reserved or suggested for state that doesn't exist yet.
  // ══════════════════════════════════════════════════════════════════
  var AP = OW.autopilot = {};
  AP.mount = function () {
    var anchor = document.getElementById('apUnmatchedApprovalsSection');
    if (anchor && !document.getElementById('owApWatching')) {
      var w = document.createElement('div');
      w.className = 'ov3-section ow-ap-section';
      w.id = 'owApWatching';
      w.style.display = 'none';
      w.innerHTML = '<div class="ov3-sh"><span class="ov3-sh-label">Watching</span><span class="ov3-sh-sub" id="owApWatchSub"></span></div><div id="owApWatchList" class="ow-watch"></div>';
      anchor.parentNode.insertBefore(w, anchor);
    }
    var active = document.getElementById('apActiveSection');
    if (active && !document.getElementById('owApHappened')) {
      var h = document.createElement('div');
      h.className = 'ov3-section ow-ap-section';
      h.id = 'owApHappened';
      h.style.display = 'none';
      h.innerHTML = '<div class="ov3-sh"><span class="ov3-sh-label">What happened</span><span class="ov3-sh-sub">Last 30 days</span></div><div id="owApHappenedList" class="ow-timeline"></div>';
      active.parentNode.insertBefore(h, active.nextSibling);
    }
  };
  function reveal(el, show) {
    if (!el) return;
    var was = el.style.display !== 'none';
    el.style.display = show ? '' : 'none';
    if (show && !was && !reduceMotion) { el.classList.remove('ow-enter'); void el.offsetWidth; el.classList.add('ow-enter'); }
  }
  AP.render = function () {
    AP.mount();
    var sec = document.getElementById('owApWatching');
    var list = document.getElementById('owApWatchList');
    var sub = document.getElementById('owApWatchSub');
    if (!list) return;
    var snap = window._apPlatformCampaigns || null;
    var rules = window._apRules;
    var enabled = Array.isArray(rules) ? rules.filter(function (r) { return r.enabled; }) : [];
    if (!snap || !enabled.length) { reveal(sec, false); return; }
    var rows = [];
    Object.keys(PLAT).forEach(function (p) {
      if (!AUTOPILOT_MONITORED[p]) return;
      (snap[p] || []).forEach(function (c) {
        var name = c.campaign_name || c.name, id = c.campaign_id || c.id, status = c.status || c.effective_status || c.operation_status;
        if (!name || !liveProviderStatus(status)) return;
        var rs = rulesFor(p, id, name);
        if (rs.length) rows.push({ platform: p, name: name, rules: rs });
      });
    });
    if (!rows.length) { reveal(sec, false); return; }
    if (sub) sub.textContent = plural(rows.length, 'live campaign') + ' covered by your rules';
    list.innerHTML = rows.map(function (r, i) {
      return '<div class="ow-watch-row" style="--i:' + i + '">' +
        '<i class="ow-pulse is-on" aria-hidden="true"></i>' +
        '<div class="ow-watch-body"><b>' + esc(r.name) + '</b><span>' + esc((PLAT[r.platform] || {}).label) + ' · ' + esc(r.rules.length === 1 ? r.rules[0].name : plural(r.rules.length, 'rule')) + '</span></div>' +
      '</div>';
    }).join('');
    reveal(sec, true);
  };
  var KIND_WORD = { event: 'Detected', recommendation: 'Recommendation', task: 'Task', workflow: 'Workflow' };
  AP.renderHappened = function () {
    AP.mount();
    var sec = document.getElementById('owApHappened');
    var el = document.getElementById('owApHappenedList');
    if (!el) return;
    var items = window._apHistoryItems;
    if (!Array.isArray(items) || !items.length) { reveal(sec, false); return; }
    el.innerHTML = items.slice(0, 8).map(function (i) {
      var st = String(i.status || '').toLowerCase();
      var tone = (st === 'failed' || st === 'rejected') ? 'risk' : ((st === 'executed' || st === 'done' || st === 'completed' || st === 'approved') ? 'live' : (st === 'suggested' || st === 'pending' || st === 'awaiting_approval' ? 'attention' : 'muted'));
      return '<div class="ow-tl-row"><i class="ow-sdot ow-t-' + tone + '" aria-hidden="true"></i>' +
        '<span class="ow-tl-title">' + esc(i.title || '') + '</span>' +
        '<span class="ow-tl-meta">' + esc(KIND_WORD[i.kind] || 'Activity') + (i.created_at ? ' · ' + esc(relTime(i.created_at)) : '') + '</span></div>';
    }).join('');
    reveal(sec, true);
  };

  // ══════════════════════════════════════════════════════════════════
  // 8f. CREATE — Stage sections that make the campaign visibly assemble
  // ══════════════════════════════════════════════════════════════════
  var CR = OW.create = {};
  function createReady() {
    var ta = document.getElementById('aicInput');
    return { brief: !!(ta && ta.value.trim()), goal: !!window._ov3Goal };
  }
  // Stage head: the existing eyebrow plus one quiet readiness label that
  // transitions as the two required decisions (brief, goal) are made.
  CR.stageHead = function () {
    var r = createReady();
    var ready = r.brief && r.goal;
    var genBtn = document.getElementById('aicGenBtn');
    if (genBtn) genBtn.classList.toggle('ow-armed', ready);
    return '<div class="ow-stage-head"><span class="cr2-stage-eyebrow">Creative Stage</span>' +
      '<span class="ow-stage-ready' + (ready ? ' is-ready' : '') + '" id="owStageReady">' + (ready ? 'Ready to build' : (!r.brief ? 'Waiting for your brief' : 'Choose a goal')) + '</span></div>';
  };
  // One line: the brief as the user writes it. Empty stays empty.
  CR.briefLine = function () {
    var ta = document.getElementById('aicInput');
    var v = ta ? ta.value.trim() : '';
    return '<p class="ow-brief' + (v ? '' : ' is-empty') + '" id="owStageBrief">' + esc(v ? trunc(v, 160) : '') + '</p>';
  };
  // Context as a few quiet chips — only what really exists. Business
  // context is added server-side to every generation; Research findings
  // the user brought over are sent as researchContext and can be removed.
  CR.contextSection = function () {
    var name = businessName();
    var h = R.handoff();
    if (!name && !h) return '';
    var chips = [];
    if (name) {
      var brandOn = window._ov3BrandIdentityEnabled !== false;
      var brand = (brandOn && typeof window._cr2ResolveBrandIdentity === 'function') ? window._cr2ResolveBrandIdentity() : null;
      var mark = (brand && brand.logoUrl) ? '<img src="' + esc(brand.logoUrl) + '" alt="">' : '<i aria-hidden="true"></i>';
      var sw = (brand && brand.colors && brand.colors.length) ? '<span class="ow-cchip-sw" aria-hidden="true">' + brand.colors.slice(0, 3).map(function (c) { return '<b style="background:' + esc(c.hex) + '"></b>'; }).join('') + '</span>' : '';
      chips.push('<span class="ow-cchip ow-cchip-biz" title="' + esc(brandOn ? 'Your Business context and brand identity are included' : 'Your Business context is included; Brand Identity is off') + '">' + mark + esc(name) + sw + (brandOn ? '' : '<span class="ow-cchip-off">brand off</span>') + '</span>');
    }
    if (h) h.findings.forEach(function (f) {
      chips.push('<span class="ow-cchip ow-cchip-research ow-pop" title="' + esc('From Research: ' + (h.question || '')) + '"><i aria-hidden="true"></i>' + esc(trunc(f.text, 56)) +
        '<button type="button" class="ow-chip-x" aria-label="Remove this research finding" onclick="orvWorkspace.research.removeFinding(\'' + jsStr(f.id) + '\')">×</button></span>');
    });
    return '<div class="ow-ctx" aria-label="Context used for this campaign">' + chips.join('') + '</div>';
  };
  // Called after every Stage rebuild: when the platform, format or goal
  // actually changed, the preview frame visibly responds (a short settle).
  var lastSig = null;
  CR.afterRender = function (stage) {
    var pill = document.querySelector('.cr2-pp.cr2-pp-on');
    var sig = [(pill && pill.getAttribute('data-plat')) || '', window._ov3ContentMode || '', window._ov3Goal || '', window._ov3GoogleCampaignType || ''].join('|');
    if (lastSig !== null && sig !== lastSig && !reduceMotion) {
      var frame = stage.querySelector('.cr2-stage-frame');
      if (frame) { frame.classList.remove('ow-react'); void frame.offsetWidth; frame.classList.add('ow-react'); }
      var head = stage.querySelector('.cr2-stage-provider');
      if (head) { head.classList.remove('ow-react-soft'); void head.offsetWidth; head.classList.add('ow-react-soft'); }
    }
    lastSig = sig;
  };
  // Live brief + readiness update without rebuilding the Stage per keystroke.
  var briefTimer = null;
  function onPromptInput() {
    clearTimeout(briefTimer);
    briefTimer = setTimeout(function () {
      var el = document.getElementById('owStageBrief');
      if (el) {
        var ta = document.getElementById('aicInput');
        var v = ta ? ta.value.trim() : '';
        el.textContent = v ? trunc(v, 160) : '';
        el.classList.toggle('is-empty', !v);
      }
      var head = document.querySelector('#cr2Stage .ow-stage-head');
      if (head) {
        var t2 = document.createElement('div'); t2.innerHTML = CR.stageHead();
        var nextLbl = t2.querySelector('#owStageReady'), curLbl = head.querySelector('#owStageReady');
        if (curLbl && nextLbl && curLbl.textContent !== nextLbl.textContent) head.replaceWith(t2.firstChild);
      }
    }, 160);
  }
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'aicInput') onPromptInput(); });

  // ══════════════════════════════════════════════════════════════════
  // 8g. CHAT — contextual prompts, object links, workspace summary
  // ══════════════════════════════════════════════════════════════════
  var CH = OW.chat = {};
  CH.summary = function () {
    if (!C.settled) return null;
    var n = C.counts();
    return {
      drafts: n.drafts, readyToLaunch: n.ready, readyWithWarnings: n.warning, blocked: n.blocked, failedPublishes: n.failed,
      live: n.live, livePlatforms: Object.keys(n.livePlatforms),
      needsYou: OW.attention().slice(0, 5).map(function (a) { return a.source + ': ' + a.title; })
    };
  };
  // Real, current-state prompts first; static page examples fill the rest.
  CH.prompts = function (page) {
    var out = [];
    try {
      if (page === 'dashboard' || page === 'businessbrain') {
        var a = OW.attention()[0];
        if (a) out.push('Help me with this: ' + a.title);
      } else if (page === 'launch') {
        var lc = (typeof window._orvGetLaunchState === 'function') ? window._orvGetLaunchState() : null;
        if (lc && lc.camp && lc.camp.name) out.push('Can I launch “' + trunc(lc.camp.name, 40) + '” yet?');
        else if (C.counts().blocked) out.push('What is blocking my drafts from launching?');
      } else if (page === 'performance') {
        var sel = window._prfActiveCampaign;
        if (sel && sel !== 'all') out.push('Summarize how “' + trunc(sel, 40) + '” is performing');
      } else if (page === 'research') {
        var rs = researchSession();
        if (rs) out.push('Which opportunity from this research should I act on first?');
      } else if (page === 'autopilot') {
        var recs = apRecs() || [];
        if (recs.length) out.push('Should I approve the pending Autopilot recommendation?');
      } else if (page === 'businessbrain') {
        if (D.health && D.health.recommendations && D.health.recommendations[0]) out.push(D.health.recommendations[0].message || ('Help me: ' + D.health.recommendations[0].title));
      } else if (page === 'create') {
        if (R.handoff()) out.push('Turn my research findings into a campaign angle');
      }
    } catch (_) {}
    return out;
  };
  // Chips linking to real objects the reply mentions (campaign names this
  // workspace actually has) — Chat participates in the workspace.
  CH.links = function (text) {
    if (!text) return '';
    var t = String(text);
    var found = [], seen = {};
    C.local().forEach(function (c) {
      if (!c.name || c.name.length < 4 || seen[c.name] || t.indexOf(c.name) === -1) return;
      seen[c.name] = 1;
      var st = C.stage(c).key;
      found.push({ label: c.name, go: (st === 'live' || st === 'paused' || st === 'deployed') ? { page: 'campaigns', platform: c.platform, campaignName: c.name } : { page: 'launch', platform: c.platform, campaignId: c.id } });
    });
    C.imported().forEach(function (r) {
      if (!r.name || r.name.length < 4 || seen[r.name] || t.indexOf(r.name) === -1) return;
      seen[r.name] = 1;
      found.push({ label: r.name, go: { page: 'campaigns', platform: r.platform, campaignName: r.name } });
    });
    if (!found.length) return '';
    return '<div class="ow-chat-links">' + found.slice(0, 3).map(function (f) {
      return '<button type="button" class="ow-chat-link"' + goAttr(f.go) + ' onclick="if(typeof orvCloseAi===\'function\')orvCloseAi()">Open “' + esc(trunc(f.label, 36)) + '” →</button>';
    }).join('') + '</div>';
  };
  // Attention items as Chat entry cards (same model as Home).
  CH.entryCards = function () {
    if (!C.settled) return [];
    var ICON = { risk: 'warn', attention: 'gold', ready: 'green', info: 'blue' };
    return OW.attention().slice(0, 3).map(function (a) {
      return { icon: ICON[a.tone] || 'blue', label: a.title, desc: a.source + (a.why ? ' — ' + trunc(a.why, 110) : ''), actionLabel: a.action + ' →', run: function () { if (typeof window.orvCloseAi === 'function') window.orvCloseAi(); OW.go(a.go); } };
    });
  };

  // ══════════════════════════════════════════════════════════════════
  // BOOT + REACTIVITY
  // ══════════════════════════════════════════════════════════════════
  function activePage() {
    var el = document.querySelector('.page.active');
    return el ? el.id : '';
  }
  OW.on(function (topic) {
    var page = activePage();
    if (page === 'page-business-brain') H.render();
    else if (C.settled) OW.sidebar.paint();
    // Durable drafts just arrived on this device — refresh Launch if it's
    // open and no campaign is mid-review in its modal.
    if (topic === 'campaigns' && page === 'page-launch' && C.lastHydrate && (C.lastHydrate.added || C.lastHydrate.updated)) {
      C.lastHydrate = null;
      var modal = document.getElementById('lqModalOverlay');
      var ctrl = document.getElementById('launchControlView');
      if ((!modal || modal.style.display === 'none') && (!ctrl || ctrl.style.display === 'none') && typeof window.renderLaunchPage === 'function') window.renderLaunchPage();
    }
    if (topic === 'campaigns' && page === 'page-create' && typeof window._cr2RenderStage === 'function') {
      // Nothing on the Stage depends on the campaign list today; kept cheap.
    }
  });

  var booted = false;
  OW.boot = function () {
    if (!user()) return;
    wrapPersist();
    if (!booted) {
      booted = true;
      // Keep the workspace fresh while the tab is open, without polling:
      // re-read when the user returns to the tab.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') OW.refresh(false);
      });
    }
    OW.refresh(false);
  };

  // Late-loaded app (session restore): boot once a user exists.
  var bootTries = 0;
  (function waitForUser() {
    if (booted) return;
    if (user()) { OW.boot(); return; }
    if (++bootTries < 60) setTimeout(waitForUser, 500);
  })();
})();
