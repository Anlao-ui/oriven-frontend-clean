/* ════════════════════════════════════════════════════════════════
   ORIVEN Continuity / Context Layer

   Connects the six existing products (Create, Research, Launch,
   Campaigns, Autopilot, Business) without adding a new page. This file
   does NOT own any product's data — it only reads real state that each
   product's own code already computed/fetched, and exposes it through
   window.orvContext (the existing "Global Context Engine" object
   declared in app.html) so the bottom-right ORIVEN AI panel can be
   genuinely context-aware instead of a blank generic chat.

   Hard rule throughout this file: every function either returns real
   data derived from something a product already loaded, or returns
   null/[]/0 honestly. Nothing here invents a metric, a status, an
   event, or a reason to return. See PHASE 14 of the sprint brief this
   file implements.

   Sections (kept small and composable — Phase 19):
     1. Research session persistence (durable, was in-memory only)
     2. Last-visit tracking
     3. Launch blocker scan (deterministic, local, no network)
     4. Change detection ("what changed since last visit")
     5. Deterministic current-state engine (answers real questions)
     6. window.orvContext extension (real, live getters)
     7. ORIVEN AI entry-state signals (feeds the panel greeting)
     8. Navigation shortcuts (client-side, zero AI cost)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _orvCtxUser() {
    return (typeof _getCurrentUser === 'function') ? _getCurrentUser()
      : (typeof window._getCurrentUser === 'function' ? window._getCurrentUser() : null);
  }

  // ── 1. Research session persistence ────────────────────────────────
  // Research previously lived only in window._researchLastResult (a
  // plain in-memory variable, lost on reload — confirmed via direct
  // inspection, no localStorage key, no backend table). This mirrors the
  // exact key convention _orvCampaignsKey already uses.
  function _orvResearchKey() {
    var user = _orvCtxUser();
    return (user && user.id) ? ('oriven_research_' + user.id) : null;
  }
  window._orvSaveResearchSession = function (result) {
    var key = _orvResearchKey();
    if (!key || !result) return;
    try { localStorage.setItem(key, JSON.stringify({ result: result, savedAt: new Date().toISOString() })); } catch (_) {}
  };
  window._orvLoadResearchSession = function () {
    var key = _orvResearchKey();
    if (!key) return null;
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  };
  // Real bug fix (Research UX/product pass) — "New investigation" only
  // ever cleared in-memory state (window._researchLastResult etc, see
  // _researchNewSession, app.html); the persisted key above was never
  // removed, so starting fresh and then hard-reloading silently
  // resurrected the OLD research instead of the real (empty) READY
  // state. Called from _researchNewSession so a genuinely fresh start
  // stays fresh across a reload too.
  window._orvClearResearchSession = function () {
    var key = _orvResearchKey();
    if (!key) return;
    try { localStorage.removeItem(key); } catch (_) {}
  };

  // ── 2. Last-visit tracking ──────────────────────────────────────────
  // Client-authoritative, same tier as campaign storage (Phase 10: don't
  // break existing localStorage-as-source-of-truth behavior). Updated
  // only when the ORIVEN AI panel is actually opened (app.html's
  // orvOpenAi), never silently, so "since last visit" means what a user
  // would expect it to mean.
  function _orvLastVisitKey() {
    var user = _orvCtxUser();
    return (user && user.id) ? ('oriven_lastvisit_' + user.id) : null;
  }
  window._orvGetLastVisitAt = function () {
    var key = _orvLastVisitKey();
    if (!key) return null;
    try { return localStorage.getItem(key) || null; } catch (_) { return null; }
  };
  window._orvSetLastVisitAt = function (iso) {
    var key = _orvLastVisitKey();
    if (!key) return;
    try { localStorage.setItem(key, iso || new Date().toISOString()); } catch (_) {}
  };

  // ── 3. Launch blocker scan — deterministic, local, no network ──────
  // Reuses the exact same readiness engine Launch itself renders from
  // (window._launchListReadiness, exposed in app.html specifically for
  // this) — never a second/parallel readiness calculation.
  window._orvFindBlockedCampaigns = function () {
    if (typeof window._orvGetCampaigns !== 'function' || typeof window._launchListReadiness !== 'function') return [];
    var camps;
    try { camps = window._orvGetCampaigns() || []; } catch (_) { return []; }
    var pending = camps.filter(function (c) {
      var st = c.status || 'draft';
      return st === 'draft' || st === 'generated' || st === 'ready-to-publish';
    });
    var blocked = [];
    pending.forEach(function (c) {
      var r;
      try { r = window._launchListReadiness(c); } catch (_) { r = null; }
      if (r && r.state === 'blocked') blocked.push(c);
    });
    return blocked;
  };

  // ── 4. Change detection — real events + real campaign timestamps ───
  // Reuses the existing GET /api/intelligence/events route (the same one
  // the Live Feed / Notifications already call) rather than a new
  // endpoint. Local campaign timestamps are checked too since
  // intelligence_events correlates to a campaign only imperfectly by
  // platform+name (a known, documented limitation elsewhere in this
  // codebase), so a locally-created/published campaign is still counted
  // as a real change even if no matching event exists yet.
  function _orvCollectLocalChanges(sinceIso) {
    if (typeof window._orvGetCampaigns !== 'function') return [];
    var since = sinceIso ? new Date(sinceIso).getTime() : 0;
    var camps;
    try { camps = window._orvGetCampaigns() || []; } catch (_) { return []; }
    var items = [];
    camps.forEach(function (c) {
      if (c.created && new Date(c.created).getTime() > since) {
        items.push({ type: 'campaign_created', label: 'New campaign: ' + (c.name || 'Untitled'), timestamp: c.created });
      }
      if (c.status === 'published' && c.updated && new Date(c.updated).getTime() > since) {
        items.push({ type: 'campaign_published', label: 'Deployed: ' + (c.name || 'Untitled'), timestamp: c.updated });
      }
    });
    return items;
  }

  window._orvComputeChangesSinceLastVisit = function () {
    var since = window._orvGetLastVisitAt();
    var localItems = _orvCollectLocalChanges(since);
    if (typeof apiFetch !== 'function') {
      return Promise.resolve({ count: localItems.length, items: localItems, since: since });
    }
    // days is generous but bounded (1-30) so a first-ever visit or a
    // very old lastVisit doesn't request an unbounded window.
    var days = 7;
    if (since) {
      var elapsedDays = Math.ceil((Date.now() - new Date(since).getTime()) / 86400000);
      days = Math.max(1, Math.min(30, elapsedDays || 1));
    }
    return apiFetch('/api/intelligence/events?days=' + days).then(function (res) {
      var events = (res && res.ok && res.data && res.data.events) || [];
      var sinceMs = since ? new Date(since).getTime() : 0;
      var eventItems = events
        .filter(function (e) { return e && e.created_at && new Date(e.created_at).getTime() > sinceMs; })
        .map(function (e) { return { type: e.type || 'event', label: e.title || 'Update', timestamp: e.created_at }; });
      var seen = {};
      var deduped = localItems.concat(eventItems).filter(function (it) {
        if (seen[it.label]) return false;
        seen[it.label] = true;
        return true;
      });
      return { count: deduped.length, items: deduped, since: since };
    }).catch(function () {
      return { count: localItems.length, items: localItems, since: since };
    });
  };

  // ── 5. Deterministic "current state" engine (Phase 3) ───────────────
  // Answers real, structural questions ("what do they have, what's
  // ready, what's blocked") purely from real application state. AI may
  // summarize this later, but this function is never itself AI-driven —
  // it's the source of truth AI is not allowed to override.
  window._orvCurrentState = function () {
    var camps = [];
    try { camps = (typeof window._orvGetCampaigns === 'function') ? (window._orvGetCampaigns() || []) : []; } catch (_) {}
    var pending = camps.filter(function (c) {
      var st = c.status || 'draft';
      return st === 'draft' || st === 'generated' || st === 'ready-to-publish';
    });
    var published = camps.filter(function (c) { return c.status === 'published'; });
    var blocked = window._orvFindBlockedCampaigns();
    var researchSession = window._researchLastResult || (window._orvLoadResearchSession() && window._orvLoadResearchSession().result) || null;
    var pd = window._orvPlatformData || {};
    return {
      hasAnyCampaigns: camps.length > 0,
      pendingCampaignCount: pending.length,
      publishedCampaignCount: published.length,
      blockedCampaignCount: blocked.length,
      hasResearch: !!researchSession,
      autopilotRulesKnown: Array.isArray(window._apRules),
      autopilotActiveRuleCount: Array.isArray(window._apRules) ? window._apRules.filter(function (r) { return r.enabled; }).length : null,
      connectedProviders: {
        google: !!(window._gadsConnected || (pd.google && pd.google.connected)),
        meta: !!(window._metaConnected || (pd.meta && pd.meta.connected)),
        tiktok: !!(window._tiktokConnected || (pd.tiktok && pd.tiktok.connected)),
        pinterest: !!(pd.pinterest && pd.pinterest.connected)
      }
    };
  };

  // ── 6. Extend window.orvContext with real, live getters ─────────────
  // window.orvContext already exists (app.html's own "Global Context
  // Engine (Epic 1)") — this ADDS fields to that same object rather than
  // creating a parallel one. Runs after DOMContentLoaded, which is
  // guaranteed to fire after every synchronous inline <script> (including
  // the one that declares window.orvContext) has already executed, so
  // this is safe regardless of where this file's own <script> tag sits.
  function _orvExtendContext() {
    if (!window.orvContext) return; // base object genuinely absent — nothing to extend onto
    var oc = window.orvContext;

    // LAUNCH — real readiness of whatever campaign is currently open in
    // the Launch workspace (window._orvGetLaunchState(), a live getter
    // over app.html's closure-scoped _lcState, already maintained by
    // _launchOpenControl). Mirrors orvContext.review's existing pattern
    // exactly: real data a page already computed, no second engine.
    Object.defineProperty(oc, 'launch', {
      configurable: true, enumerable: true,
      get: function () {
        try {
          var lc = (typeof window._orvGetLaunchState === 'function') ? window._orvGetLaunchState() : null;
          if (!lc || !lc.camp || !lc.checks || !lc.checks.length || typeof window._launchAggregateReadiness !== 'function') return null;
          var agg = window._launchAggregateReadiness(lc.checks);
          var blockers = lc.checks.filter(function (c) { return c.status === 'blocked'; }).map(function (c) { return c.label + ' — ' + c.reason; });
          var warnings = lc.checks.filter(function (c) { return c.status === 'warning'; }).map(function (c) { return c.label + ' — ' + c.reason; });
          return { campaignName: lc.camp.name || 'Untitled campaign', platform: lc.camp.platform || null, state: agg.state, label: agg.label, sub: agg.sub, blockers: blockers, warnings: warnings };
        } catch (_) { return null; }
      }
    });

    // RESEARCH — compact real summary (never the full heavy payload —
    // this rides along on every chat message, so keep it light).
    Object.defineProperty(oc, 'research', {
      configurable: true, enumerable: true,
      get: function () {
        try {
          var stored = window._orvLoadResearchSession();
          var r = window._researchLastResult || (stored && stored.result);
          if (!r || !r.question) return null;
          return {
            question: r.question, category: r.category || null, summary: r.summary || null,
            competitorCount: (r.competitors || []).length, opportunityCount: (r.opportunities || []).length,
            confidence: r.confidence || null
          };
        } catch (_) { return null; }
      }
    });

    // AUTOPILOT — real counts only, never invented. null (not 0) when
    // Autopilot genuinely hasn't been visited this session — an unknown
    // state must never be presented as a confirmed zero.
    Object.defineProperty(oc, 'autopilot', {
      configurable: true, enumerable: true,
      get: function () {
        try {
          var rulesKnown = Array.isArray(window._apRules);
          var pendingKnown = Array.isArray(window._apPendingApprovals);
          if (!rulesKnown && !pendingKnown) return null;
          var recentExecutions = [];
          if (Array.isArray(window._apHistoryItems)) {
            recentExecutions = window._apHistoryItems
              .filter(function (i) { return i && (i.status === 'executed' || i.status === 'done' || i.status === 'completed'); })
              .slice(0, 5).map(function (i) { return i.title; }).filter(Boolean);
          }
          return {
            activeRulesCount: rulesKnown ? window._apRules.filter(function (r) { return r.enabled; }).length : null,
            pendingApprovalsCount: pendingKnown ? window._apPendingApprovals.length : null,
            recentExecutions: recentExecutions
          };
        } catch (_) { return null; }
      }
    });

    // BUSINESS SIGNALS — the same real leak/gap/opportunity consolidation
    // Business Map already renders (_bmapConsolidateSignals), not a
    // second implementation. Safe to call even before Business Map has
    // ever been visited — it degrades to an empty array, never throws.
    Object.defineProperty(oc, 'businessSignals', {
      configurable: true, enumerable: true,
      get: function () {
        if (typeof window._bmapConsolidateSignals !== 'function') return [];
        try {
          var signals = window._bmapConsolidateSignals() || [];
          if (typeof window._bmapPrioritySort === 'function') signals = window._bmapPrioritySort(signals);
          return signals.slice(0, 5);
        } catch (_) { return []; }
      }
    });

    // PRIMARY GOAL — the product the user chose in onboarding's Step 2
    // ("What do you want to achieve first?"), real and server-persisted
    // (profiles.primary_goal via PUT /api/onboarding/goal, onboarding.js).
    // A plain fact about what the user came to do, not an instruction —
    // consumed as light context, never as a command the AI should act on
    // or a reason to hide the other five products.
    Object.defineProperty(oc, 'primaryGoal', {
      configurable: true, enumerable: true,
      get: function () { return (typeof window._dbPrimaryGoal !== 'undefined') ? window._dbPrimaryGoal : null; }
    });

    // CONNECTED ACCOUNTS — Pinterest gap already fixed directly at the
    // source (app.html's own orvContext.connectedAccounts getter, right
    // next to campaign/brand) rather than redefined here: that getter was
    // declared without `configurable: true`, so Object.defineProperty
    // from a separate script throws ("Cannot redefine property") instead
    // of silently overriding it — confirmed via a real Playwright run.
    // Editing the original declaration in place was the correct fix, not
    // a workaround, and avoids two competing definitions of the same field.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _orvExtendContext);
  } else {
    _orvExtendContext();
  }

  // ── 7. ORIVEN AI entry-state signals (Phase 4/6) ────────────────────
  // Real, prioritized signals for the AI panel's greeting — deterministic,
  // never AI-invented. Consumed by app.html's _orvAiLoadRecs as a higher-
  // priority tier ahead of the existing /api/intelligence/home-driven
  // recommendations. Returns [] (not a fabricated card) when there is
  // genuinely nothing to report at this tier.
  window._orvComputeEntrySignals = function () {
    var blocked = window._orvFindBlockedCampaigns();
    var blockedCard = blocked.length ? [{
      icon: 'warn',
      label: blocked.length === 1 ? '1 campaign can’t launch yet' : blocked.length + ' campaigns can’t launch yet',
      desc: blocked.length === 1 ? ('“' + (blocked[0].name || 'Untitled') + '” is missing something Launch needs.') : 'Review what’s blocking them in Launch.',
      actionLabel: 'Review →',
      run: function () { if (typeof _orvNav === 'function') _orvNav('launch', 'page-launch'); }
    }] : [];

    return window._orvComputeChangesSinceLastVisit().then(function (changes) {
      var changeCard = [];
      if (changes.count > 0) {
        changeCard = [{
          icon: 'blue',
          label: changes.count === 1 ? '1 thing changed' : changes.count + ' things changed',
          desc: changes.items.slice(0, 3).map(function (i) { return i.label; }).join(' · '),
          actionLabel: 'Ask →',
          message: 'What changed since I was last here?'
        }];
      }
      // _orvComputeChangesSinceLastVisit is a pure read (safe to call
      // repeatedly, e.g. from tests, without side effects) — updating the
      // stored marker is this function's job alone, and only happens here
      // because _orvAiLoadRecs's own _orvAiRecsLoaded gate already ensures
      // this runs at most once per real session/panel-open.
      window._orvSetLastVisitAt(new Date().toISOString());
      return blockedCard.concat(changeCard);
    }).catch(function () { return blockedCard; });
  };

  // ── 8. Navigation shortcuts (Phase 8) ───────────────────────────────
  // Pure client-side, deterministic pattern match, zero AI/credit cost —
  // a real shortcut through EXISTING navigation (_orvNav), never a new
  // page and never routed through the AI/tool-confirmation flow (which
  // exists for consequential, mutating actions — navigation has no side
  // effects and needs no confirmation step).
  var ORV_NAV_TARGETS = [
    { re: /\b(open|go to|take me to|show me|switch to)\s+(the\s+)?research\b/i, page: 'research', pageId: 'page-research', label: 'Research' },
    { re: /\b(open|go to|take me to|show me|switch to)\s+(the\s+)?create\b/i, page: 'create', pageId: 'page-create', label: 'Create' },
    { re: /\b(open|go to|take me to|show me|switch to)\s+(the\s+)?launch\b/i, page: 'launch', pageId: 'page-launch', label: 'Launch' },
    { re: /\b(open|go to|take me to|show me|switch to)\s+(the\s+)?campaigns?\b/i, page: 'performance', pageId: 'page-performance', label: 'Campaigns' },
    { re: /\b(open|go to|take me to|show me|switch to)\s+(the\s+)?autopilot\b/i, page: 'autopilot', pageId: 'page-autopilot', label: 'Autopilot' },
    { re: /\b(open|go to|take me to|show me|switch to)\s+(the\s+)?business\b/i, page: 'businessbrain', pageId: 'page-business-brain', label: 'Business' }
  ];
  window._orvAiTryNavigate = function (msg) {
    if (!msg || typeof window._orvNav !== 'function') return null;
    for (var i = 0; i < ORV_NAV_TARGETS.length; i++) {
      if (ORV_NAV_TARGETS[i].re.test(msg)) return ORV_NAV_TARGETS[i];
    }
    return null;
  };
})();
