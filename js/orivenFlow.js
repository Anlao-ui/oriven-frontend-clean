/* ════════════════════════════════════════════════════════════════
   OrivenAI Flow — the Create → Launch interaction layer.

   Everything here reads and writes the ONE campaign package that is
   stored locally, mirrored to /api/campaigns and sent to
   /api/publish/{platform}. There is no second editor object.

     1. Package model    — per-platform accessors that mirror exactly what
                           each publish route in server.js reads (budget,
                           destination, copy, creative, targeting). An edit
                           made through here is an edit the provider gets.
     2. Error model      — one normalised shape for every generation /
                           publish failure (title, explanation, actions).
     3. Dialog           — one accessible modal (focus trap, Escape,
                           restore focus) used by every confirmation.
     4. Builder          — the Build Campaign construction canvas, driven
                           only by real lifecycle events from cgrGenerate.
     5. Budget / Ad editor / Publish confirmation — Launch interactions.

   Hard rules: no fabricated values, no provider names in user copy, no
   permanent animation loops, nothing publishes without a confirmation.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var OW = window.orvWorkspace = window.orvWorkspace || {};
  var F = OW.flow = OW.flow || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function reduceMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  }
  function toast(msg, kind) {
    if (typeof window.orvToast === 'function') window.orvToast(msg, kind || 'info');
    else if (typeof window.toast === 'function') window.toast(msg, kind || 'info');
  }
  function trunc(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (_) { return o; } }

  F.esc = esc;
  // Text in the user's language (js/flowI18n.js).
  function TX(k, v) { return window.orvTx ? window.orvTx(k, v) : k; }
  var PLAT = { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' };
  var PROVIDER = { google: 'Google', meta: 'Meta', tiktok: 'TikTok', pinterest: 'Pinterest' };
  var PK = { google: 'googleAds', meta: 'metaAds', tiktok: 'tiktokAds', pinterest: 'pinterestAds' };
  F.PLAT = PLAT;
  var HIER = {
    google: ['ofl_hCampaign', 'ofl_hAdGroup', 'ofl_hRsa'],
    meta: ['ofl_hCampaign', 'ofl_hAdSet', 'ofl_hAd'],
    tiktok: ['ofl_hCampaign', 'ofl_hAdGroup', 'ofl_hAd'],
    pinterest: ['ofl_hCampaign', 'ofl_hAdGroup', 'ofl_hPin']
  };

  function costs() { return (typeof window.CREDIT_COSTS === 'object' && window.CREDIT_COSTS) || {}; }

  // ════════════════════════════════════════════════════════════════
  // 1. PACKAGE MODEL — mirrors server.js /api/publish/{platform}
  // ════════════════════════════════════════════════════════════════
  var P = F.pkg = {};
  function platObj(pkg, p, create) {
    var k = PK[p] || 'metaAds';
    if (create && (!pkg[k] || typeof pkg[k] !== 'object')) pkg[k] = {};
    return pkg[k] || {};
  }
  function strat(pkg, create) {
    if (create && (!pkg.strategy || typeof pkg.strategy !== 'object')) pkg.strategy = {};
    return pkg.strategy || {};
  }
  function googleType(pkg) { return ((pkg.googleAds || {}).campaignType) || 'SEARCH'; }
  P.googleType = googleType;

  // Budget. The user always sets the daily budget — publishing is blocked
  // until they do (services/campaignSpec.js budgetOf). Google: strategy.
  // budgetRecommendation as {amount}; Meta / TikTok / Pinterest:
  // {platform}.budget. The AI's recommendation is only shown as a
  // suggestion. TikTok needs more than 20 per day per ad group.
  var BUDGET_RULE = {
    meta: { min: 1 }, tiktok: { min: 20.01, label: 'ofl_moreThan20' }, pinterest: { min: 1 }
  };
  function looseNumber(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
    var m = String(v).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    var n = m ? parseFloat(m[1]) : null;
    return n && n > 0 ? n : null;
  }
  P.budget = function (pkg, p) {
    pkg = pkg || {};
    var s = strat(pkg);
    if (p === 'google') {
      // Only a budget the user confirmed counts — stored as {amount} by
      // setBudget (services/campaignSpec.js budgetOf). A bare number or text
      // is the AI's suggestion, shown but never published as-is.
      var br = s.budgetRecommendation;
      var raw = (br && typeof br === 'object') ? (br.amount != null ? br.amount : br.daily) : null;
      var n = Number(raw);
      var ok = raw !== undefined && raw !== null && raw !== '' && isFinite(n) && n >= 1;
      return {
        platform: p, required: true, min: 1,
        amount: ok ? n : null, applied: ok ? n : null, source: ok ? 'set' : 'missing',
        currency: (br && typeof br === 'object' && br.currency) || null,
        suggestion: ok ? null : (typeof br === 'number' ? looseNumber(br) : looseNumber(typeof br === 'string' ? br : null))
      };
    }
    var rule = BUDGET_RULE[p] || BUDGET_RULE.meta;
    var o = platObj(pkg, p);
    var set = looseNumber(o.budget);
    if (!set) {
      var sb = s.budgetRecommendation;
      return { platform: p, required: true, min: rule.min, amount: null, applied: null, source: 'missing',
        suggestion: looseNumber(sb && typeof sb === 'object' ? (sb.amount || sb.daily) : sb) || looseNumber(s.dailyBudget) || looseNumber(s.budget) };
    }
    return { platform: p, required: true, min: rule.min, amount: set, applied: set, source: 'set', low: set < rule.min, raw: o.budget };
  };
  P.setBudget = function (pkg, p, amount, minOverride) {
    var n = Number(amount);
    var min = typeof minOverride === 'number' ? minOverride : (p === 'google' ? 1 : (BUDGET_RULE[p] || BUDGET_RULE.meta).min);
    if (!isFinite(n) || n < min) return false;
    n = Math.round(n * 100) / 100;
    if (p === 'google') {
      var s = strat(pkg, true);
      var prev = s.budgetRecommendation;
      s.budgetRecommendation = { amount: n, currency: (prev && typeof prev === 'object' && prev.currency) || null };
    } else {
      platObj(pkg, p, true).budget = n;
    }
    return true;
  };
  P.budgetLabel = function (pkg, p, currency) {
    var b = P.budget(pkg, p);
    var cur = currency || b.currency;
    function money(v) { return cur ? (v + ' ' + cur) : String(v); }
    if (b.source === 'missing') return TX('ofl_notSet');
    return TX('ofl_perDayShort', { amount: money(b.applied) });
  };

  // Destination. Every route reads strategy.landingPageUrl first, then a
  // platform field, then pkg.websiteUrl / strategy.websiteUrl. Google
  // rejects a missing URL; Meta/TikTok/Pinterest would fall back to a
  // placeholder domain, so OrivenAI treats a missing URL as a blocker.
  var URL_FIELD = { google: 'finalUrl', meta: 'finalUrl', tiktok: 'finalUrl', pinterest: 'destinationUrl' };
  P.url = function (pkg, p) {
    pkg = pkg || {};
    var s = strat(pkg), o = platObj(pkg, p);
    return String(s.landingPageUrl || o[URL_FIELD[p] || 'finalUrl'] || pkg.websiteUrl || s.websiteUrl || '').trim();
  };
  P.validateUrl = function (u) {
    u = String(u || '').trim();
    if (!u) return TX('ofl_urlEmpty');
    var parsed;
    try { parsed = new URL(u); } catch (_) { return TX('ofl_urlFull'); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return TX('ofl_urlProtocol');
    if (!/\./.test(parsed.hostname)) return TX('ofl_urlDomain');
    return null;
  };
  P.setUrl = function (pkg, p, u) {
    if (P.validateUrl(u)) return false;
    strat(pkg, true).landingPageUrl = String(u).trim();
    return true;
  };

  // Creative — same resolution order as each route.
  P.image = function (pkg, p) {
    pkg = pkg || {};
    var o = platObj(pkg, p);
    var vc = (pkg.visualConcepts || []).filter(function (v) { return v && v.generatedImageUrl; })[0];
    return o.imageUrl || (p === 'meta' ? o.uploadedImageUrl : null) || (vc && vc.generatedImageUrl) || null;
  };
  function hasVideo(pkg, p) { var o = platObj(pkg, p); return !!(o.videoUrl || (Array.isArray(pkg.videoAssets) && pkg.videoAssets.some(function (v) { return v && v.videoUrl; }))); }
  P.needsImage = function (pkg, p) {
    if (p === 'google') return googleType(pkg) !== 'SEARCH';
    // TikTok ads are videos; without a cover image the publish route uses a
    // frame of the video (services/campaignSpec.js tiktok_cover_auto).
    if (p === 'tiktok' && hasVideo(pkg || {}, p)) return false;
    if (p === 'pinterest') {
      var pin = platObj(pkg, 'pinterest');
      if (pin.creativeType === 'video' && ((pkg.videoAssets && pkg.videoAssets[0] && pkg.videoAssets[0].videoUrl) || pin.videoUrl)) return false;
    }
    return true;
  };

  // Copy — a list of editable fields, each bound to the exact path the
  // route reads. Meta and TikTok read pkg.concepts[] first (one variant per
  // concept, cycled across ads), so those are what gets edited.
  function conceptCopy(c) { c.adCopy = c.adCopy && typeof c.adCopy === 'object' ? c.adCopy : {}; return c.adCopy; }
  P.copyFields = function (pkg, p) {
    pkg = pkg || {};
    var o = platObj(pkg, p);
    var concepts = Array.isArray(pkg.concepts) ? pkg.concepts : [];
    var out = [];
    function field(group, key, label, get, set, opts) {
      opts = opts || {};
      out.push({ group: group, key: key, label: label, value: get() || '', set: set, max: opts.max || 0, multiline: !!opts.multiline, note: opts.note || '' });
    }
    if (p === 'google') {
      var g = platObj(pkg, 'google', true);
      var hl = Array.isArray(g.headlines) ? g.headlines : (g.headlines = []);
      var ds = Array.isArray(g.descriptions) ? g.descriptions : (g.descriptions = []);
      hl.forEach(function (h, i) {
        field(TX('ofl_gHeadlines'), 'h' + i, TX('ofl_gHeadlineN', { n: i + 1 }), function () { return h; }, function (v) { hl[i] = v; }, { max: 30, note: TX('ofl_gHeadlineNote') });
      });
      ds.forEach(function (d, i) {
        field(TX('ofl_gDescriptions'), 'd' + i, TX('ofl_gDescriptionN', { n: i + 1 }), function () { return d; }, function (v) { ds[i] = v; }, { max: 90, multiline: true, note: TX('ofl_gDescriptionNote') });
      });
      return out;
    }
    if (p === 'pinterest') {
      var pin = platObj(pkg, 'pinterest', true);
      field(TX('ofl_hPin'), 'title', TX('ofl_pinTitle'), function () { return pin.title; }, function (v) { pin.title = v; }, { max: 100 });
      field(TX('ofl_hPin'), 'description', TX('ofl_description'), function () { return pin.description; }, function (v) { pin.description = v; }, { max: 500, multiline: true });
      field(TX('ofl_hPin'), 'altText', TX('ofl_altText'), function () { return pin.altText; }, function (v) { pin.altText = v; }, { max: 500 });
      return out;
    }
    if (p === 'tiktok') {
      if (concepts.length) {
        concepts.forEach(function (c, i) {
          var grp = TX('ofl_variantN', { n: i + 1 });
          var hookKey = c.hook ? 'hook' : null;
          field(grp, 'hook' + i, TX('ofl_hook'), function () { return c.hook || conceptCopy(c).headline || o.hook; },
            function (v) { if (hookKey) c.hook = v; else conceptCopy(c).headline = v; });
          field(grp, 'text' + i, TX('ofl_adText'), function () { return conceptCopy(c).primaryText || o.script; },
            function (v) { conceptCopy(c).primaryText = v; }, { max: 100, multiline: true, note: TX('ofl_ttTextNote') });
        });
      } else {
        var tk = platObj(pkg, 'tiktok', true);
        field(TX('ofl_hAd'), 'hook', TX('ofl_hook'), function () { return tk.hook; }, function (v) { tk.hook = v; });
        field(TX('ofl_hAd'), 'script', TX('ofl_adText'), function () { return tk.script; }, function (v) { tk.script = v; }, { max: 100, multiline: true, note: TX('ofl_ttTextNote') });
      }
      return out;
    }
    // meta
    if (concepts.length) {
      concepts.forEach(function (c, i) {
        var grp = TX('ofl_variantN', { n: i + 1 });
        field(grp, 'headline' + i, TX('ofl_headline'), function () { return conceptCopy(c).headline || o.headline; }, function (v) { conceptCopy(c).headline = v; }, { max: 40 });
        field(grp, 'primary' + i, TX('ofl_primaryText'), function () { return conceptCopy(c).primaryText || o.primaryText || o.description; }, function (v) { conceptCopy(c).primaryText = v; }, { max: 125, multiline: true, note: TX('ofl_metaPrimaryNote') });
      });
    } else {
      var m = platObj(pkg, 'meta', true);
      field(TX('ofl_hAd'), 'headline', TX('ofl_headline'), function () { return m.headline; }, function (v) { m.headline = v; }, { max: 40 });
      field(TX('ofl_hAd'), 'primaryText', TX('ofl_primaryText'), function () { return m.primaryText || m.description; }, function (v) { m.primaryText = v; }, { max: 125, multiline: true });
    }
    return out;
  };

  // A compact, display-ready summary drawn from the same accessors.
  P.summary = function (pkg, p) {
    pkg = pkg || {};
    var s = strat(pkg), o = platObj(pkg, p);
    var c0 = (Array.isArray(pkg.concepts) && pkg.concepts[0]) || null;
    var cc = (c0 && c0.adCopy) || {};
    var headline, copy, cta;
    if (p === 'google') {
      headline = (o.headlines || [])[0]; copy = (o.descriptions || [])[0]; cta = null;
    } else if (p === 'tiktok') {
      headline = (c0 && (c0.hook || cc.headline)) || o.hook; copy = cc.primaryText || o.script; cta = (c0 && c0.cta) || o.cta;
    } else if (p === 'pinterest') {
      headline = o.title; copy = o.description; cta = o.cta;
    } else {
      headline = cc.headline || o.headline; copy = cc.primaryText || o.primaryText || o.description; cta = (c0 && c0.cta) || o.cta;
    }
    return {
      headline: headline || '', copy: copy || '', cta: cta || '',
      url: P.url(pkg, p), image: P.image(pkg, p), budget: P.budget(pkg, p),
      audienceText: s.targetAudience || o.targetAudience || '',
      goal: s.goal || pkg.goal || '', name: pkg.campaignName || ''
    };
  };

  // Targeting summary from the package alone (the full, validated targeting
  // comes from the campaign spec — js/campaignSpec.js). Countries are the
  // user's choice or the business profile's country; never a default.
  P.targeting = function (pkg, p) {
    pkg = pkg || {};
    var ov = (pkg.spec && pkg.spec.overrides) || {};
    var parts = [];
    parts.push(ov.countries && ov.countries.length ? ov.countries.join(', ') : TX('ofl_countryFromProfile'));
    if (p === 'meta' || p === 'tiktok') parts.push(TX('ofl_ages', { from: ov.ageMin || 18, to: (ov.ageMax || 65) + ((ov.ageMax || 65) === 65 ? '+' : '') }));
    if (p === 'meta') { var pl = platObj(pkg, 'meta').placement; parts.push(TX(pl === 'instagram_only' ? 'ofl_igOnly' : pl === 'facebook_only' ? 'ofl_fbOnly' : 'ofl_fbIg')); }
    if (p === 'google' && googleType(pkg) === 'SEARCH') { var kw = ((pkg.googleAds || {}).keywords || []).filter(Boolean); parts.push(kw.length === 1 ? TX('ofl_nKeyword1') : TX('ofl_nKeywords', { n: kw.length })); }
    return { sent: parts.join(' · '), note: TX('ofl_targetingNote') };
  };

  // Mirrors the route's hard rejections plus OrivenAI's own blockers.
  P.issues = function (pkg, p) {
    var list = [];
    if (!P.url(pkg, p) || P.validateUrl(P.url(pkg, p))) list.push({ key: 'destination', label: TX('ofl_destUrl'), blocker: true });
    var b = P.budget(pkg, p);
    if (b.source === 'missing') list.push({ key: 'budget', label: TX('ofl_dailyBudget'), blocker: true });
    else if (b.low) list.push({ key: 'budget', label: TX('ofl_dailyBudgetNeeds', { platform: PLAT[p], min: minText(p, b.min) }), blocker: true });
    if (P.needsImage(pkg, p) && !P.image(pkg, p)) list.push({ key: 'creative', label: TX('ofl_creativeImage'), blocker: true });
    if (p === 'google' && googleType(pkg) === 'SEARCH') {
      var g = pkg.googleAds || {};
      var h = (g.headlines || []).filter(Boolean).length, d = (g.descriptions || []).filter(Boolean).length;
      if (h < 3 || d < 2) list.push({ key: 'copy', label: TX('ofl_minCopy'), blocker: true });
    }
    return list;
  };
  // "more than 20" (TikTok) or "at least N" — the platform's daily minimum.
  function minText(p, min) { var lbl = (BUDGET_RULE[p] || {}).label; return lbl ? TX(lbl) : TX('ofl_atLeast', { n: min }); }

  // Saves an edited package into the campaign record (local cache + durable
  // mirror via _saveCamps) and tells open Launch views to recalculate.
  F.findCampaign = function (campId) {
    var camps = (typeof window._orvGetCampaigns === 'function') ? window._orvGetCampaigns() : [];
    for (var i = 0; i < camps.length; i++) if (camps[i] && camps[i].id === campId) return camps[i];
    return null;
  };
  F.savePackage = function (campId, pkg) {
    if (typeof window._orvUpdateCampPkg !== 'function') return false;
    var ok = window._orvUpdateCampPkg(campId, pkg);
    // The generation review screen keeps a working copy; keep it in step
    // so its own Save can never overwrite an edit made from Launch.
    try { if (window._cgrCurrentCampId === campId && typeof window._orvSyncReviewPkg === 'function') window._orvSyncReviewPkg(campId, pkg); } catch (_) {}
    if (typeof window._orvReadinessChanged === 'function') window._orvReadinessChanged(campId);
    return ok !== false;
  };

  // ════════════════════════════════════════════════════════════════
  // 2. ERROR MODEL
  // ════════════════════════════════════════════════════════════════
  // input: { status, body, error, phase: 'generate'|'publish'|'creative' }
  // output: { kind, title, message, detail?, retry, edit, action? }

  function safeServerText(t) {
    t = String(t || '');
    t = t.replace(/\(#\d+\)\s*/g, '').trim();
    if (!t || t.length > 220) return '';
    if (/aiml|api[_ -]?key|stack|econn|undefined|null|exception|at\s+\w+\s*\(|<\/?[a-z]/i.test(t)) return '';
    return t;
  }
  // A coded server error in the user's language (js/serverI18n.js); English and
  // uncoded errors keep the server's own (cleaned) text.
  function srvText(b) { return window.orvTx && window.orvTx.serverError ? window.orvTx.serverError(b, safeServerText) : safeServerText(b && (b.error || b.message)); }
  function issueText(i) { return window.orvTx && window.orvTx.issue ? window.orvTx.issue(i) : String(i.message || ''); }
  F.error = function (input) {
    input = input || {};
    var st = input.status || 0, b = input.body || {}, err = input.error, phase = input.phase || 'generate';
    var code = b && b.code;
    var c = costs();
    var msg = err && err.message ? String(err.message) : '';
    // Publishing: no readable answer (dropped connection, a proxy's HTML
    // error page, a crash before the server replied) is NOT proof that
    // nothing was created. Only the status check decides.
    // (input.sending: only a campaign publish request — not pause/resume/budget calls)
    var sending = phase === 'publish' && !!input.sending;
    if (sending && ((err && !st) || (st >= 500 && !code))) {
      return { kind: 'unconfirmed', title: TX('ofl_eUnconfTitle'), message: TX('ofl_eUnconfUnclear'), retry: false, edit: false, unconfirmed: true };
    }
    if (err && !st) {
      if (/could not reach/i.test(msg) || /failed to fetch|network/i.test(msg) || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        if (sending) return { kind: 'unconfirmed', title: TX('ofl_eUnconfTitle'), message: TX('ofl_eUnconfDropped'), retry: false, edit: false, unconfirmed: true };
        return { kind: 'network', title: TX('ofl_eNetTitle'), message: TX(phase === 'publish' ? 'ofl_eNetPublish' : 'ofl_eNetBuild'), retry: true, edit: true };
      }
      if (/unexpected response|not found|starting/i.test(msg)) {
        return { kind: 'backend', title: TX('ofl_eBackendTitle'), message: TX('ofl_eBackendUnexpected'), retry: true, edit: true };
      }
      if (phase === 'generate' && /malformed|incomplete/i.test(msg)) {
        return { kind: 'malformed', title: TX('ofl_eMalformedTitle'), message: TX('ofl_eMalformedMsg'), retry: true, edit: true };
      }
      return { kind: 'unknown', title: TX(phase === 'publish' ? 'ofl_ePubIncomplete' : 'ofl_eBuildIncomplete'), message: TX('ofl_eUnexpected'), retry: true, edit: true };
    }
    if (st === 402 || code === 'CREDITS_EXHAUSTED') {
      var bal = b.balance != null ? Number(b.balance) : null;
      // An image / video that ran out of credits needs its own price, not a campaign's.
      var need = input.required || (phase === 'creative' ? (c.imageAd || 75) : (c.campaign || 25));
      return {
        kind: 'credits', title: TX('ofl_eCreditsTitle'),
        message: TX(phase === 'creative' ? 'ofl_eCreditsCreative' : 'ofl_eCreditsCampaign', { need: need }) + (bal != null ? ' ' + TX('ofl_eCreditsHave', { bal: bal }) : '') +
          (phase === 'creative' ? '' : ' ' + TX('ofl_eCreditsSeparate', { image: c.imageAd || 75, video: c.video || 200 })),
        balance: bal, required: need, retry: false, edit: true,
        action: { label: TX('ofl_viewPlans'), fn: 'plans', ctx: { action: phase === 'creative' ? 'image' : 'create', code: 'CREDITS_EXHAUSTED', balance: bal } }
      };
    }
    if (st === 403 && code === 'SUBSCRIPTION_REQUIRED') {
      return { kind: 'subscription', title: TX('ofl_ePlanTitle'), message: TX('ofl_ePlanMsg'), retry: false, edit: true, action: { label: TX('ofl_viewPlans'), fn: 'plans', ctx: { action: 'create', code: 'SUBSCRIPTION_REQUIRED' } } };
    }
    if (code === 'PROVIDER_UNAVAILABLE') {
      return { kind: 'service', title: TX('ofl_eServiceTitle'),
        message: TX(phase === 'creative' ? 'ofl_eServiceImage' : 'ofl_eServiceCampaign'),
        detail: (b.creditsRefunded || b.refunded) ? TX('ofl_creditsReturned') : '', retry: true, edit: true };
    }
    // An ad platform's expired / revoked connection is not an OrivenAI
    // session problem: provider routes answer it with a code (or, older
    // routes, a 401 whose message says to reconnect). Signing in again
    // wouldn't help — reconnecting the platform does.
    if (code === 'RECONNECT_REQUIRED' || code === 'NOT_CONNECTED' || (st === 401 && !code && /reconnect|access token|token expired|not connected/i.test(String(b.error || '')))) {
      return { kind: 'reconnect', title: TX(code === 'NOT_CONNECTED' ? 'ofl_eNotConnTitle' : 'ofl_eReconnectTitle'),
        message: srvText(b) || TX('ofl_eReconnectMsg'), detail: TX(phase === 'publish' ? 'ofl_nothingChangedPlatform' : 'ofl_nothingBuilt'),
        retry: false, edit: false, action: { label: TX('ofl_openConnections'), fn: 'connections' } };
    }
    if (st === 401 && (!code || code === 'AUTH_REQUIRED')) {
      return { kind: 'session', title: TX('ofl_eSessionTitle'), message: TX(phase === 'publish' ? 'ofl_eSessionPublish' : 'ofl_eSessionBuild'), retry: false, edit: false, action: { label: TX('ofl_signInAgain'), fn: 'signin' } };
    }
    // Paid-action guard (server): the same build is already running, or this
    // exact action was already sent. Nothing new was charged.
    if (st === 409 && code === 'ACTION_IN_PROGRESS') {
      return { kind: 'in_progress', title: TX('ofl_eBuildingTitle'), message: srvText(b) || TX('ofl_eBuildingMsg'), detail: TX('ofl_nothingExtraCharged'), retry: false, edit: false };
    }
    if (st === 409 && code === 'DUPLICATE_ACTION') {
      return { kind: 'in_progress', title: TX('ofl_eSentTitle'), message: TX('ofl_eSentMsg'), detail: TX('ofl_nothingExtraCharged'), retry: true, edit: true };
    }
    if (st === 409 && code === 'PUBLISH_IN_PROGRESS') {
      return { kind: 'in_progress', title: TX('ofl_ePubBusyTitle'), message: TX('ofl_ePubBusyMsg'), retry: false, edit: false };
    }
    if (st === 429) {
      return { kind: 'rate_limit', title: TX('ofl_eRateTitle'), message: TX('ofl_eRateMsg'), retry: true, edit: true };
    }
    // Publishing: a timeout or a gateway error is NOT proof that nothing was
    // created — the server may still be finishing. Only the status check
    // decides (POST /api/publish/{p}/status); never an automatic retry.
    if (sending && (st === 408 || st === 504 || ((st === 502 || st === 503) && !code))) {
      return { kind: 'unconfirmed', title: TX('ofl_eUnconfTitle'), message: TX('ofl_eUnconfTimeout'), retry: false, edit: false, unconfirmed: true };
    }
    if (st === 408 || st === 504) {
      return { kind: 'timeout', title: TX('ofl_eTimeoutTitle'), message: TX(phase === 'publish' ? 'ofl_eTimeoutCampaign' : 'ofl_eTimeoutBuild'), retry: true, edit: true };
    }
    if (phase === 'publish' && code === 'PUBLISH_LEDGER_UNAVAILABLE') {
      return { kind: 'backend', title: TX('ofl_eLedgerTitle'), message: srvText(b) || TX('ofl_eLedgerMsg'), retry: true, edit: false };
    }
    if (phase === 'publish' && (code === 'ALREADY_PUBLISHED' || code === 'RESULT_UNCONFIRMED')) {
      return { kind: code === 'ALREADY_PUBLISHED' ? 'already' : 'unconfirmed', title: TX(code === 'ALREADY_PUBLISHED' ? 'ofl_eAlreadyTitle' : 'ofl_eUnconfTitle'), message: srvText(b) || '', retry: false, edit: false, unconfirmed: code === 'RESULT_UNCONFIRMED' };
    }
    if (phase === 'publish' && code === 'PUBLISH_FAILED') {
      var rb = b.rollback || {};
      return { kind: 'failed', title: TX('ofl_eRejectedTitle'), message: safeServerText(b.error) || TX('ofl_ePubIncompleteDot'),
        detail: rb.complete === false ? (rb.leftovers === 1 ? TX('ofl_eLeftovers1') : TX('ofl_eLeftoversN', { n: rb.leftovers })) : TX('ofl_eRolledBack'), retry: true, edit: true, confirmedFailure: true };
    }
    if (code === 'CONTENT_POLICY' || code === 'POLICY_VIOLATION' || /policy/i.test(String(b.error || '')) && st === 400 && phase === 'generate') {
      return { kind: 'policy', title: TX('ofl_ePolicyTitle'), message: TX('ofl_ePolicyMsg'), retry: false, edit: true };
    }
    if (st === 422 && code === 'CAMPAIGN_INVALID') {
      var errs = (b.issues || []).filter(function (i) { return i && i.level === 'error'; }).map(function (i) { return issueText(i).slice(0, 300); }).filter(Boolean);
      return { kind: 'invalid', title: TX('ofl_eInvalidTitle'), message: errs[0] || TX('ofl_eInvalidMissing'),
        detail: errs.length > 1 ? TX('ofl_eInvalidMore', { n: errs.length - 1 }) : TX('ofl_nothingSent'), retry: false, edit: true };
    }
    if (st === 400 || st === 422) {
      var t = srvText(b);
      return { kind: 'invalid', title: TX(phase === 'publish' ? 'ofl_eNeedsChangeTitle' : 'ofl_eCheckDetailsTitle'),
        message: t || TX(phase === 'publish' ? 'ofl_eNeedsChangeMsg' : 'ofl_eCheckDetailsMsg'),
        retry: false, edit: true };
    }
    if (code === 'CREDIT_CHECK_FAILED') {
      return { kind: 'backend', title: TX('ofl_eCreditCheckTitle'), message: TX('ofl_eCreditCheckMsg'), detail: TX('ofl_nothingCharged'), retry: true, edit: true };
    }
    if (st === 502 || st === 503) {
      return { kind: 'backend', title: TX('ofl_eBackendTitle'), message: TX('ofl_eBackendNoResponse'), detail: b.creditsRefunded ? TX('ofl_creditsReturned') : '', retry: true, edit: true };
    }
    if (code === 'GENERATION_FAILED' || (st >= 500 && phase === 'generate')) {
      return { kind: 'generation', title: TX('ofl_eGenTitle'), message: TX('ofl_eGenMsg'),
        detail: b.creditsRefunded ? TX('ofl_creditsReturnedAttempt') : '', retry: true, edit: true };
    }
    if (st >= 500) {
      var t2 = phase === 'publish' ? srvText(b) : '';
      return { kind: 'unknown', title: TX(phase === 'publish' ? 'ofl_ePubIncomplete' : 'ofl_eWrongTitle'), message: t2 || TX('ofl_eWrongMsg'), retry: true, edit: true };
    }
    return { kind: 'unknown', title: TX('ofl_eWrongTitle'), message: TX('ofl_eWrongMsg'), retry: true, edit: true };
  };
  // ctx (optional): the blocked action — { action, code, balance } — so the
  // plan modal can say what it needs and keep the user's work (onboarding.js).
  F.runAction = function (fn, ctx) {
    if (fn === 'plans') {
      if (ctx && typeof window.orvOpenActionPaywall === 'function') window.orvOpenActionPaywall(ctx.action, ctx);
      else if (typeof window.openPaywall === 'function') window.openPaywall();
      else if (typeof window.openSettingsModal === 'function') window.openSettingsModal();
    } else if (fn === 'signin') {
      try { window.location.reload(); } catch (_) {}
    } else if (fn === 'connections') {
      if (typeof window.bizGoTo === 'function') window.bizGoTo('connections');
    } else if (fn === 'campaigns') {
      if (window.orvWorkspace && window.orvWorkspace.go) window.orvWorkspace.go({ page: 'campaigns' });
      else if (typeof window._orvNav === 'function') window._orvNav('performance', 'page-performance');
    }
  };

  // ════════════════════════════════════════════════════════════════
  // 3. DIALOG — accessible modal
  // ════════════════════════════════════════════════════════════════
  var dlgSeq = 0;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  F.dialog = function (opts) {
    opts = opts || {};
    var id = 'ofd' + (++dlgSeq);
    var opener = document.activeElement;
    var root = document.createElement('div');
    root.className = 'ofd-backdrop';
    root.innerHTML =
      '<div class="ofd' + (opts.wide ? ' ofd-wide' : '') + '" role="' + (opts.alert ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="' + id + 't" aria-describedby="' + id + 'b">' +
        '<div class="ofd-head">' +
          (opts.eyebrow ? '<div class="ofd-eyebrow">' + esc(opts.eyebrow) + '</div>' : '') +
          '<h2 class="ofd-title" id="' + id + 't">' + esc(opts.title || '') + '</h2>' +
          '<button type="button" class="ofd-x" aria-label="' + esc(TX('ofl_close')) + '">×</button>' +
        '</div>' +
        '<div class="ofd-body" id="' + id + 'b"></div>' +
        '<div class="ofd-foot"></div>' +
      '</div>';
    document.body.appendChild(root);
    var box = root.querySelector('.ofd');
    var bodyEl = root.querySelector('.ofd-body');
    var footEl = root.querySelector('.ofd-foot');
    var busy = false, closed = false;
    var api = {
      el: box, body: bodyEl,
      setBody: function (html) { bodyEl.innerHTML = html; return api; },
      setActions: function (actions) {
        footEl.innerHTML = '';
        (actions || []).forEach(function (a) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ofd-btn ofd-btn-' + (a.kind || 'ghost');
          btn.textContent = a.label;
          if (a.disabled) btn.disabled = true;
          btn.addEventListener('click', function () { if (!busy && a.onClick) a.onClick(api, btn); });
          footEl.appendChild(btn);
        });
        return api;
      },
      busy: function (on, label) {
        busy = !!on;
        box.setAttribute('aria-busy', on ? 'true' : 'false');
        footEl.querySelectorAll('button').forEach(function (b) { b.disabled = !!on; });
        root.querySelector('.ofd-x').disabled = !!on;
        if (on && label) { var p = footEl.querySelector('.ofd-btn-primary,.ofd-btn-danger'); if (p) p.textContent = label; }
        return api;
      },
      close: function (result) {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        root.classList.remove('ofd-in');
        setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, reduceMotion() ? 0 : 160);
        if (opener && typeof opener.focus === 'function' && document.contains(opener)) { try { opener.focus(); } catch (_) {} }
        if (opts.onClose) opts.onClose(result);
      },
      focusFirst: function () {
        var t = box.querySelector('[data-autofocus]') || bodyEl.querySelector(FOCUSABLE) || footEl.querySelector(FOCUSABLE) || root.querySelector('.ofd-x');
        if (t) t.focus();
      }
    };
    function onKey(e) {
      if (e.key === 'Escape') { if (!busy) { e.stopPropagation(); e.preventDefault(); api.close(false); } return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (n) { return n.offsetParent !== null || n === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('mousedown', function (e) { if (e.target === root && !busy && opts.dismissible !== false) api.close(false); });
    root.querySelector('.ofd-x').addEventListener('click', function () { if (!busy) api.close(false); });
    if (opts.body) api.setBody(opts.body);
    if (opts.actions) api.setActions(opts.actions);
    requestAnimationFrame(function () { root.classList.add('ofd-in'); api.focusFirst(); });
    return api;
  };
  F.confirm = function (opts) {
    return new Promise(function (resolve) {
      var done = false;
      var d = F.dialog({
        title: opts.title, eyebrow: opts.eyebrow, alert: true,
        body: opts.body || '',
        onClose: function (r) { if (!done) { done = true; resolve(!!r); } },
        actions: [
          { label: opts.cancelLabel || TX('ofl_cancel'), kind: 'ghost', onClick: function (api) { api.close(false); } },
          { label: opts.confirmLabel || TX('ofl_confirm'), kind: opts.danger ? 'danger' : 'primary', onClick: function (api) {
            if (typeof opts.run !== 'function') { api.close(true); return; }
            // Long-running confirmation: keep the dialog open, busy, until the
            // real result arrives, then show the outcome in place.
            api.busy(true, opts.busyLabel || TX('ofl_working'));
            Promise.resolve().then(opts.run).then(function (res) {
              api.busy(false);
              if (res && res.ok === false) {
                api.setBody('<div class="ofd-result ofd-result-err" role="alert"><strong>' + esc(res.title || TX('ofl_didntWork')) + '</strong><p>' + esc(res.message || '') + '</p>' + (res.detail ? '<p>' + esc(res.detail) + '</p>' : '') + '</div>');
                api.setActions([{ label: TX('ofl_close'), kind: 'ghost', onClick: function (a) { a.close(false); } }]);
                api.focusFirst();
              } else {
                done = true; resolve(true); api.close(true);
              }
            }, function () {
              api.busy(false);
              api.setBody('<div class="ofd-result ofd-result-err" role="alert"><strong>' + esc(TX('ofl_didntWork')) + '</strong><p>' + esc(TX('ofl_checkConnection')) + '</p></div>');
              api.setActions([{ label: TX('ofl_close'), kind: 'ghost', onClick: function (a) { a.close(false); } }]);
              api.focusFirst();
            });
          } }
        ]
      });
      d.el.querySelector('.ofd-btn-ghost').setAttribute('data-autofocus', '');
      d.focusFirst();
    });
  };

  // ════════════════════════════════════════════════════════════════
  // 4. BUILDER — campaign generation progress (js/orivenProgress.js)
  // ════════════════════════════════════════════════════════════════
  // Every stage change is driven by a real lifecycle event:
  //   start()        – Build accepted (after Create's own validation and
  //                    the credit pre-flight), before the request is sent
  //   sent()         – POST /api/ai/create-ad dispatched
  //   copy(pkg)      – the real package arrived
  //   creative(ok)   – the real image(s) finished (or failed)
  //   background()   – video mode: the video keeps rendering after reveal;
  //                    its own progress is shown on the video card
  //   fail(model)    – any failure, from any phase
  // Only operations that really happen during generation are listed —
  // nothing about publishing (targeting, budget, tracking) appears here.
  //
  // Fix: callbacks queued while the content stage was still settling
  // (afterCopy) were dropped in video mode, so the reveal never ran and the
  // old canvas stayed on its last tile ("Pixel checked at publish") while
  // the video was in fact already rendering behind it. The queue is now
  // always drained.
  var B = F.builder = {};
  var bs = null;
  function stagesFor(o) {
    var isVideo = o.creativeMode === 'videos';
    var textOnly = !isVideo && o.platform === 'google' && (!o.googleType || o.googleType === 'SEARCH');
    var list = [
      { k: 'prepare', t: TX('ofl_bPrepare') },
      { k: 'content', t: TX('ofl_bContent'), status: TX(o.hasBusiness && o.hasResearch ? 'ofl_bWritingBoth' : o.hasBusiness ? 'ofl_bWritingBiz' : o.hasResearch ? 'ofl_bWritingRes' : 'ofl_bWriting') }
    ];
    if (isVideo) list.push({ k: 'creative', t: TX('ofl_bVideo'), status: TX('ofl_bVideoStart') });
    else if (!textOnly) list.push({ k: 'creative', t: TX('ofl_bImage'), status: TX('ofl_bImage') });
    list.push({ k: 'finalize', t: TX('ofl_bFinalize') });
    list.push({ k: 'ready', t: TX('ofl_bReady') });
    return list;
  }
  function host() { return document.getElementById('cgrLoading'); }
  function later(fn, ms) { if (!bs) return; var tok = bs.token; var t = setTimeout(function () { if (bs && bs.token === tok) fn(); }, ms); bs.timers.push(t); }
  function clearTimers() { if (!bs) return; bs.timers.forEach(clearTimeout); bs.timers = []; }
  function stepMs(ms) { return reduceMotion() ? 0 : ms; }
  var OPR = function () { return window.OrivenProgress; };

  B.start = function (o) {
    o = o || {};
    B.stop();
    var el = host();
    if (!el || !OPR()) return null;
    var p = PLAT[o.platform] ? o.platform : 'meta';
    var isVideo = o.creativeMode === 'videos';
    var textOnly = !isVideo && p === 'google' && (!o.googleType || o.googleType === 'SEARCH');
    bs = { token: Date.now() + Math.random(), platform: p, timers: [], phase: 'request', isVideo: isVideo,
      startedAt: Date.now(), afterCopy: [], copyDone: false };
    el.classList.add('ofb-host');
    bs.ui = OPR().create(el, {
      title: TX('ofl_bTitle'),
      chips: [PLAT[p], o.goal || 'Sales', TX(isVideo ? 'ofl_bChipVideo' : (textOnly ? 'ofl_bChipSearch' : 'ofl_bChipImage'))],
      stages: stagesFor({ creativeMode: o.creativeMode, platform: p, googleType: o.googleType, hasBusiness: o.hasBusiness, hasResearch: o.hasResearch }),
      kind: 'build-content'
    });
    bs.ui.stage('prepare', 'active');
    // Honest long-wait notice, based on this device's real build times
    // when there are enough of them — never a fake ETA.
    var est = OPR().estimateMs('build-content');
    later(function () {
      if (bs && bs.phase === 'request') bs.ui.notice(TX('ofl_bSlow'), 'slow');
    }, Math.max(70000, est ? est * 1.6 : 0));
    return bs.token;
  };
  B.isCurrent = function (token) { return !!bs && bs.token === token; };
  B.active = function () { return !!bs && bs.phase !== 'done' && bs.phase !== 'error'; };
  B.stop = function () { clearTimers(); bs = null; };

  B.sent = function (token) {
    if (!bs || (token && bs.token !== token)) return;
    bs.ui.stage('prepare', 'done').stage('content', 'active');
  };

  B.copy = function (pkg, platform, token) {
    if (!bs || (token && bs.token !== token)) return;
    bs.phase = 'copy';
    clearTimers();
    bs.ui.notice('');
    if (OPR()) OPR().record('build-content', Date.now() - bs.startedAt);
    bs.ui.stage('prepare', 'done').stage('content', 'done');
    bs.creativeAt = Date.now();
    if (bs.ui.q('.op-stage[data-k="creative"]')) bs.ui.stage('creative', 'active');
    bs.copyDone = true;
    var fns = bs.afterCopy.slice(); bs.afterCopy = [];
    fns.forEach(function (fn) { fn(); });
  };

  function afterCopy(fn) { if (!bs) return; if (bs.copyDone) fn(); else bs.afterCopy.push(fn); }

  // Saving happens synchronously in _renderPackage before this runs; the
  // stage reports the real outcome of that save.
  function finishBuild(cb) {
    bs.ui.stage('finalize', 'active');
    later(function () {
      var saveOk = window._orvLastStoreOk !== false;
      bs.ui.stage('finalize', saveOk ? 'done' : 'warn', TX(saveOk ? 'ofl_bSaved' : 'ofl_bSavedPartly'));
      bs.ui.stage('ready', 'done');
      bs.phase = 'done';
      bs.ui.finish('done', TX('ofl_bDone'));
      bs.ui.status(TX(bs.isVideo ? 'ofl_bOpeningVideo' : 'ofl_bOpening'));
      later(function () { var done = cb; B.stop(); if (done) done(); }, stepMs(700));
    }, stepMs(350));
  }

  // info: { pkg, platform, failKind: 'credits'|'service'|'failed', count }
  B.creative = function (ok, info, cb, token) {
    if (!bs || (token && bs.token !== token)) { if (cb) cb(); return; }
    info = info || {};
    afterCopy(function () {
      if (ok && bs.creativeAt && OPR()) OPR().record('build-image', Date.now() - bs.creativeAt);
      var why = TX(info.failKind === 'credits' ? 'ofl_bImgCredits' : info.failKind === 'service' ? 'ofl_bImgService' : 'ofl_bImgFailed');
      bs.ui.stage('creative', ok ? 'done' : 'warn', ok ? '' : why);
      later(function () { finishBuild(cb); }, stepMs(ok ? 250 : 150));
    });
  };
  B.background = function (info, cb, token) {
    if (!bs || (token && bs.token !== token)) { if (cb) cb(); return; }
    afterCopy(function () {
      bs.ui.stage('creative', 'bg', TX('ofl_bVideoBg'));
      finishBuild(cb);
    });
  };

  B.fail = function (model, handlers, token) {
    if (!bs || (token && bs.token !== token)) return false;
    clearTimers();
    handlers = handlers || {};
    bs.phase = 'error';
    var activeLi = bs.ui.q('.op-stage[data-s="active"]');
    if (activeLi) bs.ui.stage(activeLi.getAttribute('data-k'), 'failed');
    bs.ui.root.setAttribute('data-kind', model.kind);
    bs.ui.finish('error', model.title);
    bs.ui.status('');
    var foot = bs.ui.q('.op-foot');
    var creditRow = (model.kind === 'credits' && model.balance != null)
      ? '<dl class="ofb-credits"><div><dt>' + esc(TX('ofl_needed')) + '</dt><dd>' + esc(model.required) + '</dd></div><div><dt>' + esc(TX('ofl_yourBalance')) + '</dt><dd>' + esc(model.balance) + '</dd></div></dl>' : '';
    foot.innerHTML =
      '<div class="ofb-err" role="alert">' +
        '<p class="ofb-err-msg">' + esc(model.message) + '</p>' +
        (model.detail ? '<p class="ofb-err-detail">' + esc(model.detail) + '</p>' : '') +
        creditRow +
        '<div class="ofb-err-actions"></div>' +
      '</div>';
    var row = foot.querySelector('.ofb-err-actions');
    function btn(label, kind, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ofd-btn ofd-btn-' + kind; b.textContent = label;
      b.addEventListener('click', fn);
      row.appendChild(b);
      return b;
    }
    var first = null;
    if (model.action) first = btn(model.action.label, 'primary', function () { F.runAction(model.action.fn, model.action.ctx); });
    if (model.retry && handlers.retry) { var r = btn(TX('ofl_tryAgain'), model.action ? 'ghost' : 'primary', handlers.retry); first = first || r; }
    if (model.edit !== false && handlers.edit) { var e = btn(TX('ofl_backToCreate'), 'ghost', handlers.edit); first = first || e; }
    if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (_) {} }, 30);
    try { var mc = document.querySelector('.mc'); if (mc) mc.scrollTop = 0; window.scrollTo(0, 0); } catch (_) {}
    return true;
  };

  // ════════════════════════════════════════════════════════════════
  // 5a. PROVIDER ACCOUNT (read-only)
  // ════════════════════════════════════════════════════════════════
  F.account = function (p) {
    if (typeof window.apiFetch !== 'function') return Promise.resolve(null);
    return window.apiFetch('/api/' + p + '/status').then(function (r) {
      var d = r && r.ok ? r.data : null;
      if (!d) return null;
      var a = d.active_ad_account || null;
      return { connected: !!d.connected, name: a && (a.account_name || a.name) || '', id: a && (a.account_id || a.id) || '', currency: a && a.currency || '' };
    }).catch(function () { return null; });
  };

  // ════════════════════════════════════════════════════════════════
  // 5b. SET BUDGET
  // ════════════════════════════════════════════════════════════════
  F.openBudget = function (campId, opts) {
    opts = opts || {};
    var camp = F.findCampaign(campId);
    if (!camp || !camp.pkg) { toast(TX('ofl_campNotFound'), 'warn'); return; }
    var p = camp.platform || camp.pkg.platform;
    var b = P.budget(camp.pkg, p);
    var start = b.source === 'set' ? b.applied : (b.suggestion || '');
    var rule = p === 'google' ? { min: 1 } : BUDGET_RULE[p];
    var d = F.dialog({
      title: TX('ofl_setDailyBudget'), eyebrow: PLAT[p] || p,
      body:
        '<form class="ofd-form" novalidate>' +
          '<label class="ofd-lbl" for="ofdBudget">' + esc(TX('ofl_dailyBudget')) + '</label>' +
          '<div class="ofd-money"><input id="ofdBudget" class="ofd-input" type="number" inputmode="decimal" min="' + rule.min + '" step="0.01" value="' + esc(start) + '" aria-describedby="ofdBudgetHint ofdBudgetErr" data-autofocus>' +
          '<span class="ofd-money-unit" id="ofdBudgetUnit">' + esc(TX('ofl_perDay')) + '</span></div>' +
          '<p class="ofd-hint" id="ofdBudgetHint">' + esc(budgetHint(p, b)) + '</p>' +
          '<p class="ofd-err" id="ofdBudgetErr" role="alert" hidden></p>' +
        '</form>',
      actions: [
        { label: TX('ofl_cancel'), kind: 'ghost', onClick: function (api) { api.close(false); } },
        { label: TX('ofl_saveBudget'), kind: 'primary', onClick: save }
      ]
    });
    var input = d.el.querySelector('#ofdBudget');
    var errEl = d.el.querySelector('#ofdBudgetErr');
    d.el.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); save(d); });
    F.account(p).then(function (acct) {
      if (acct && acct.currency) { var u = d.el.querySelector('#ofdBudgetUnit'); if (u) u.textContent = TX('ofl_curPerDay', { currency: acct.currency }); }
      // TikTok's fixed minimum (more than 20) applies to USD/EUR/GBP accounts;
      // for other currencies TikTok sets its own minimum, checked when publishing.
      if (p === 'tiktok' && acct && acct.currency && ['USD', 'EUR', 'GBP'].indexOf(String(acct.currency).toUpperCase()) === -1) { rule = { min: 1 }; input.setAttribute('min', '1'); }
    });
    function save(api) {
      var v = parseFloat(String(input.value).replace(',', '.'));
      var msg = null;
      if (!isFinite(v) || v <= 0) msg = TX('ofl_budgetPositive');
      else if (v < rule.min) msg = TX('ofl_budgetMin', { platform: PLAT[p], min: rule.label ? TX(rule.label) : TX('ofl_atLeast', { n: rule.min }) });
      if (msg) { errEl.textContent = msg; errEl.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      var fresh = F.findCampaign(campId);
      var pkg = clone(fresh.pkg);
      P.setBudget(pkg, p, v, rule.min);
      F.savePackage(campId, pkg);
      api.close(true);
      toast(TX('ofl_budgetSaved', { amount: v }), 'ok');
      if (opts.onSaved) opts.onSaved(v);
    }
  };
  function budgetHint(p, b) {
    var sug = b && b.suggestion ? ' ' + TX('ofl_budgetSuggested', { amount: b.suggestion }) : '';
    if (p === 'tiktok') return TX('ofl_budgetHintTt') + sug;
    return TX('ofl_budgetHint') + sug;
  }

  // ════════════════════════════════════════════════════════════════
  // 5c. GO TO AD — structured editor over the real package
  // ════════════════════════════════════════════════════════════════
  var SECTIONS = [
    { k: 'overview', t: 'ofl_secOverview' }, { k: 'creative', t: 'ofl_secCreative' }, { k: 'copy', t: 'ofl_secCopy' },
    { k: 'settings', t: 'ofl_secSettings' }, { k: 'budget', t: 'ofl_secBudget' },
    { k: 'destination', t: 'ofl_secDestination' }, { k: 'readiness', t: 'ofl_secReadiness' }
  ];
  // Older links ("audience", "platform", "tracking") open the settings review.
  var SECTION_ALIAS = { audience: 'settings', platform: 'settings', tracking: 'settings', targeting: 'settings', compliance: 'settings', identity: 'settings', ads: 'settings', objective: 'settings', assets: 'settings', advanced: 'settings' };
  F.openAd = function (campId, section) {
    var camp = F.findCampaign(campId);
    if (!camp || !camp.pkg) { toast(TX('ofl_campNotFound'), 'warn'); return; }
    var p = camp.platform || camp.pkg.platform;
    var work = clone(camp.pkg);
    var dirty = false;
    var cur = SECTION_ALIAS[section] || section || 'overview';
    var OS = window.OrivenSpec;
    // Campaign settings review (server-built spec). Edits come back as an
    // updated package and are saved with the rest of the ad.
    var specState = { res: null, open: {}, stale: true, loading: null, platform: p };
    if (section && SECTION_ALIAS[section] === 'settings' && section !== 'settings') specState.open[section === 'audience' ? 'targeting' : section] = true;
    function loadSpec(changes) {
      if (!OS) return Promise.resolve(null);
      var p0 = OS.load(work, p, changes ? { changes: changes } : null).then(function (res) {
        if (changes && res && res.pkg && res.applied && res.applied.length) { work = res.pkg; markDirty(); }
        specState.res = res; specState.stale = false;
        if (specState.loading === p0) specState.loading = null;
        if (cur === 'settings' || cur === 'readiness' || cur === 'overview') renderSpecInto();
        return res;
      });
      specState.loading = p0;
      return p0;
    }
    function renderSpecInto() {
      var host = d.body.querySelector('.ocs-host');
      if (host && OS) OS.render(host, specState);
      var rh = d.body.querySelector('.ofe-spec-issues');
      if (rh) { rh.innerHTML = specIssuesHtml(); bindSpecGo(rh); }
    }
    specState.onChange = function (changes) { return loadSpec(changes); };
    specState.onRetry = function () { specState.res = null; renderSpecInto(); loadSpec(); };
    function specIssuesHtml() {
      var r = specState.res;
      if (!OS) return '';
      if (!r) return '<p class="ofe-note" role="status">' + esc(TX('ofl_specChecking')) + '</p>';
      if (r.error) return '<p class="ofe-note">' + esc(r.error) + '</p>';
      var list = (r.issues || []).filter(function (i) { return i.level !== 'info'; });
      if (!list.length) return '<p class="ofe-ok">' + esc(TX('ofl_specComplete')) + '</p>';
      return '<ul class="ofe-issues">' + list.map(function (i) {
        return '<li class="ofe-issue ofe-issue-' + (i.level === 'error' ? 'req' : 'opt') + '"><span class="ofe-issue-tag">' + esc(TX(i.level === 'error' ? 'ofl_tagRequired' : 'ofl_tagCheck')) + '</span> ' + esc(issueText(i)) +
          ' <button type="button" class="ofd-btn ofd-btn-ghost ofe-inline" data-spec-go="' + OS.sectionOf(i.field) + '">' + esc(TX('ofl_fix')) + '</button></li>';
      }).join('') + '</ul>';
    }
    // Local content checks; a destination the spec resolved (e.g. from the
    // business website) isn't reported as missing.
    function adIssues() {
      var r = specState.res, list = P.issues(work, p);
      if (r && !r.error && r.spec && r.spec.tracking.destinationUrl && !specState.stale) list = list.filter(function (i) { return i.key !== 'destination'; });
      return list;
    }
    function bindSpecGo(root) {
      root.querySelectorAll('[data-spec-go]').forEach(function (b) {
        b.addEventListener('click', function () {
          var sec = b.getAttribute('data-spec-go');
          specState.open = {}; specState.open[sec] = true;
          render('settings');
          var el = d.body.querySelector('details.ocs-sec[data-sec="' + sec + '"]');
          if (el) { el.scrollIntoView({ block: 'start' }); var sm = el.querySelector('summary'); if (sm) sm.focus(); }
        });
      });
    }
    var d = F.dialog({
      title: camp.name || TX('ofl_rCampaign'), eyebrow: TX('ofl_adEyebrow', { platform: PLAT[p] || p }), wide: true,
      onClose: function () {},
      actions: []
    });
    d.el.classList.add('ofe');
    function actions() {
      d.setActions([
        { label: TX('ofl_close'), kind: 'ghost', onClick: tryClose },
        { label: TX(dirty ? 'ofl_saveChanges' : 'ofl_saved'), kind: 'primary', disabled: !dirty, onClick: saveAll }
      ]);
    }
    function tryClose(api) {
      if (!dirty) { api.close(false); return; }
      F.confirm({ title: TX('ofl_discardTitle'), body: '<p>' + esc(TX('ofl_discardBody')) + '</p>', confirmLabel: TX('ofl_discard'), danger: true })
        .then(function (yes) { if (yes) d.close(false); });
    }
    function saveAll() {
      var errs = validate();
      if (errs.length) { render(errs[0].section); var f = d.el.querySelector('[aria-invalid="true"]'); if (f) f.focus(); return; }
      F.savePackage(campId, work);
      camp = F.findCampaign(campId) || camp;
      work = clone(camp.pkg);
      if (OS && specState.res && !specState.res.error && !specState.stale) OS.remember(camp, specState.res);
      dirty = false;
      actions();
      render(cur);
      toast(TX('ofl_adSaved'), 'ok');
    }
    function validate() {
      var out = [];
      var u = P.url(work, p);
      if (u && P.validateUrl(u)) out.push({ section: 'destination' });
      return out;
    }
    function markDirty() { if (!dirty) { dirty = true; actions(); } }
    function markEdited() { specState.stale = true; markDirty(); }
    function nav() {
      return '<nav class="ofe-nav" aria-label="' + esc(TX('ofl_adSections')) + '"><ul>' + SECTIONS.map(function (s) {
        return '<li><button type="button" class="ofe-tab" data-sec="' + s.k + '"' + (s.k === cur ? ' aria-current="true"' : '') + '>' + esc(TX(s.t)) + '</button></li>';
      }).join('') + '</ul></nav>';
    }
    function countText(len, max) { return len > max ? TX('ofl_cutsOff', { len: len, max: max, provider: PROVIDER[p] }) : len + ' / ' + max; }
    function row(label, value, note) {
      return '<div class="ofe-row"><dt>' + esc(label) + '</dt><dd>' + value + (note ? '<p class="ofe-note">' + esc(note) + '</p>' : '') + '</dd></div>';
    }
    function sectionHtml(k) {
      var s = P.summary(work, p);
      if (k === 'overview') {
        var issues = adIssues();
        return '<dl class="ofe-dl">' +
          row(TX('ofl_rCampaign'), esc(camp.name || s.name || TX('ofl_untitled'))) +
          row(TX('ofl_rPlatform'), esc(PLAT[p] || p)) +
          row(TX('ofl_rObjective'), esc(s.goal || TX('ofl_notSet'))) +
          row(TX('ofl_rStructure'), esc(HIER[p].map(TX).join(' › '))) +
          row(TX('ofl_rCreatedAs'), esc(TX('ofl_paused')), TX('ofl_pausedNote', { provider: PROVIDER[p] })) +
          row(TX('ofl_rAdContent'), issues.length ? esc(issues.map(function (i) { return TX(i.blocker ? 'ofl_requiredParen' : 'ofl_optionalParen', { label: i.label }); }).join(', ')) : esc(TX('ofl_complete'))) +
        '</dl><h4 class="ofe-sub">' + esc(TX('ofl_secSettings')) + '</h4><div class="ofe-spec-issues">' + specIssuesHtml() + '</div>';
      }
      if (k === 'creative') {
        var img = P.image(work, p);
        var need = P.needsImage(work, p);
        return '<div class="ofe-creative">' +
          (img ? '<figure class="ofe-fig"><img src="' + esc(img) + '" alt="' + esc(TX('ofl_creativeAlt', { name: camp.name || TX('ofl_thisCampaign') })) + '"><figcaption>' + esc(TX('ofl_creativeCaption', { provider: PROVIDER[p] })) + '</figcaption></figure>'
               : '<p class="ofe-empty">' + esc(need ? TX('ofl_noCreativeNeed', { platform: PLAT[p] }) : TX('ofl_searchTextOnly')) + '</p>') +
          (need ? '<button type="button" class="ofd-btn ofd-btn-ghost" data-act="creative">' + esc(TX(img ? 'ofl_changeImage' : 'ofl_addCreative')) + '</button><p class="ofe-note">' + esc(TX('ofl_creativeEditorNote')) + '</p>' : '') +
        '</div>';
      }
      if (k === 'copy') {
        var fields = P.copyFields(work, p);
        if (!fields.length) return '<p class="ofe-empty">' + esc(TX('ofl_noCopyFields')) + '</p>';
        var groups = {};
        fields.forEach(function (f) { (groups[f.group] = groups[f.group] || []).push(f); });
        var html = '';
        Object.keys(groups).forEach(function (g) {
          html += '<fieldset class="ofe-group"><legend>' + esc(g) + '</legend>';
          groups[g].forEach(function (f) {
            var id = 'ofeF_' + f.key;
            var len = String(f.value).length;
            var over = f.max && len > f.max;
            html += '<div class="ofe-field"><label for="' + id + '">' + esc(f.label) + '</label>' +
              (f.multiline ? '<textarea id="' + id + '" class="ofd-input" rows="3" data-copy="' + esc(f.key) + '" aria-describedby="' + id + 'c">' + esc(f.value) + '</textarea>'
                           : '<input id="' + id + '" class="ofd-input" type="text" data-copy="' + esc(f.key) + '" value="' + esc(f.value) + '" aria-describedby="' + id + 'c">') +
              '<p class="ofe-count' + (over ? ' ofe-over' : '') + '" id="' + id + 'c"><span class="ofe-cnum">' + (f.max ? countText(len, f.max) : '') + '</span>' + (f.note ? ' <span>' + esc(f.note) + '</span>' : '') + '</p></div>';
          });
          html += '</fieldset>';
        });
        return html;
      }
      if (k === 'settings') {
        return '<p class="ofe-note">' + esc(TX('ofl_settingsIntro', { provider: PROVIDER[p] })) + '</p><div class="ocs-host"></div>';
      }
      if (k === 'budget') {
        var b = P.budget(work, p);
        return '<dl class="ofe-dl">' +
          row(TX('ofl_dailyBudget'), esc(P.budgetLabel(work, p)) + ' <button type="button" class="ofd-btn ofd-btn-ghost ofe-inline" data-act="budget">' + esc(TX(b.source === 'set' ? 'ofl_change' : 'ofl_setBudget')) + '</button>',
            b.source === 'missing' ? TX('ofl_budgetRequiredNote') + (b.suggestion ? ' ' + TX('ofl_suggestedPerDay', { amount: b.suggestion }) : '') : (b.low ? TX('ofl_budgetMin', { platform: PLAT[p], min: minText(p, b.min) }) : TX('ofl_chargedInCurrency'))) +
          row(TX('ofl_schedule'), esc(TX('ofl_startsWhenActivated')), TX('ofl_scheduleNote', { provider: PROVIDER[p] })) +
        '</dl>';
      }
      if (k === 'destination') {
        var u = P.url(work, p);
        var err = u ? P.validateUrl(u) : null;
        return '<div class="ofe-field"><label for="ofeUrl">' + esc(TX('ofl_destUrl')) + '</label>' +
          '<input id="ofeUrl" class="ofd-input" type="url" inputmode="url" placeholder="https://yourshop.com/offer" value="' + esc(u) + '" aria-describedby="ofeUrlHint ofeUrlErr"' + (err ? ' aria-invalid="true"' : '') + '>' +
          '<p class="ofe-note" id="ofeUrlHint">' + esc(TX('ofl_urlHint')) + '</p>' +
          '<p class="ofd-err" id="ofeUrlErr" role="alert"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p></div>' +
          '<p class="ofe-note">' + esc(TX('ofl_utmNote', { link: '\u0001' })).replace('\u0001', '<button type="button" class="ofd-btn ofd-btn-ghost ofe-inline" data-sec-go="settings">' + esc(TX('ofl_secSettings')) + '</button>') + '</p>';
      }
      if (k === 'readiness') {
        var list = adIssues();
        var adHtml = !list.length ? '<p class="ofe-ok">' + esc(TX('ofl_adContentComplete')) + '</p>' : '<ul class="ofe-issues">' + list.map(function (i) {
          return '<li class="ofe-issue ofe-issue-' + (i.blocker ? 'req' : 'opt') + '"><span class="ofe-issue-tag">' + esc(TX(i.blocker ? 'ofl_tagRequired' : 'ofl_tagOptional')) + '</span> ' + esc(i.label) +
            ' <button type="button" class="ofd-btn ofd-btn-ghost ofe-inline" data-sec-go="' + (i.key === 'budget' ? 'budget' : i.key) + '">' + esc(TX('ofl_fix')) + '</button></li>';
        }).join('') + '</ul>';
        return '<h4 class="ofe-sub">' + esc(TX('ofl_rAdContent')) + '</h4>' + adHtml + '<h4 class="ofe-sub">' + esc(TX('ofl_secSettings')) + '</h4><div class="ofe-spec-issues">' + specIssuesHtml() + '</div>' +
          '<p class="ofe-note">' + esc(TX('ofl_accountChecksInLaunch')) + '</p>';
      }
      return '';
    }
    function render(k) {
      cur = SECTION_ALIAS[k] || k || cur;
      d.setBody('<div class="ofe-wrap">' + nav() + '<div class="ofe-main" tabindex="-1"><h3 class="ofe-h">' + esc(TX(SECTIONS.filter(function (s) { return s.k === cur; })[0].t)) + '</h3>' + sectionHtml(cur) + '</div></div>');
      bind();
      if (cur === 'settings' || cur === 'readiness' || cur === 'overview') {
        if (specState.stale && !specState.loading) { if (cur === 'settings') specState.res = null; loadSpec(); }
        renderSpecInto();
      }
    }
    function bind() {
      bindSpecGo(d.body);
      d.body.querySelectorAll('.ofe-tab').forEach(function (b) {
        b.addEventListener('click', function () { render(b.getAttribute('data-sec')); var m = d.body.querySelector('.ofe-main'); if (m) m.focus(); });
      });
      d.body.querySelectorAll('[data-sec-go]').forEach(function (b) {
        b.addEventListener('click', function () { var k = b.getAttribute('data-sec-go'); render(k === 'creative' ? 'creative' : k); var m = d.body.querySelector('.ofe-main'); if (m) m.focus(); });
      });
      d.body.querySelectorAll('[data-copy]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var key = inp.getAttribute('data-copy');
          var f = P.copyFields(work, p).filter(function (x) { return x.key === key; })[0];
          if (!f) return;
          f.set(inp.value);
          var c = d.body.querySelector('#' + inp.id + 'c');
          if (c && f.max) {
            var len = inp.value.length;
            c.classList.toggle('ofe-over', len > f.max);
            var num = c.querySelector('.ofe-cnum');
            if (num) num.textContent = countText(len, f.max);
          }
          markEdited();
        });
      });
      var url = d.body.querySelector('#ofeUrl');
      if (url) {
        url.addEventListener('input', function () {
          strat(work, true).landingPageUrl = url.value.trim();
          markEdited();
        });
        url.addEventListener('blur', function () {
          var e = url.value.trim() ? P.validateUrl(url.value) : TX('ofl_urlEmpty');
          var el = d.body.querySelector('#ofeUrlErr');
          if (el) { el.textContent = e || ''; el.hidden = !e; }
          if (e) url.setAttribute('aria-invalid', 'true'); else url.removeAttribute('aria-invalid');
        });
      }
      d.body.querySelectorAll('[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-act');
          if (a === 'budget') {
            var go = function () {
              F.openBudget(campId, { onSaved: function () { camp = F.findCampaign(campId) || camp; work = clone(camp.pkg); specState.stale = true; render('budget'); } });
            };
            if (dirty) { F.savePackage(campId, work); dirty = false; actions(); }
            go();
          } else if (a === 'creative' || a === 'review') {
            if (dirty) { F.savePackage(campId, work); dirty = false; }
            d.close(true);
            if (typeof window._lqCloseModal === 'function') { try { window._lqCloseModal(); } catch (_) {} }
            if (typeof window.openCampaignWorkspace === 'function') window.openCampaignWorkspace(campId);
          }
        });
      });
    }
    actions();
    render(cur);
    var m = d.body.querySelector('.ofe-main'); if (m && section) m.focus();
    return d;
  };

  // ════════════════════════════════════════════════════════════════
  // 5d. PUBLISH CONFIRMATION — shown before every provider call
  // ════════════════════════════════════════════════════════════════
  // Resolves true only on an explicit confirm. The caller then makes the
  // real request; this dialog never calls a provider itself.
  var confirmOpen = false;
  F.confirmPublish = function (o) {
    if (confirmOpen) return Promise.resolve(false);
    o = o || {};
    var p = o.platform;
    var pkg = o.pkg || {};
    var issues = P.issues(pkg, p).filter(function (i) { return i.blocker; });
    confirmOpen = true;
    return new Promise(function (resolve) {
      var settled = false;
      function finish(v) { if (!settled) { settled = true; confirmOpen = false; resolve(v); } }
      var d = F.dialog({
        title: TX('ofl_pubTitle', { platform: PLAT[p] || p }), eyebrow: TX('ofl_pubEyebrow'), alert: true,
        onClose: function (r) { finish(!!r); },
        body: '<p class="ofd-muted">' + esc(TX('ofl_pubChecking', { provider: PROVIDER[p] || p })) + '</p>',
        actions: [
          { label: TX('ofl_cancel'), kind: 'ghost', onClick: function (api) { api.close(false); } },
          { label: TX('ofl_publish'), kind: 'primary', disabled: true, onClick: function () {} }
        ]
      });
      // The campaign settings check (server-built spec, live account facts)
      // runs alongside the account check; its errors block publishing here,
      // and the server validates the same spec again before any API call.
      var OS = window.OrivenSpec;
      var specP = OS ? OS.load(pkg, p, { refresh: true, campId: o.campId }) : Promise.resolve(null);
      Promise.all([F.account(p), specP]).then(function (both) {
        var acct = both[0], sr = both[1];
        var tg = P.targeting(pkg, p);
        var cur = acct && acct.currency;
        var acctTxt = acct && (acct.name || acct.id) ? (acct.name ? acct.name + (acct.id ? ' · ' + acct.id : '') : acct.id) : TX('ofl_noAccount');
        var specErrs = sr && !sr.error ? OS.errors(sr) : [];
        var specFail = !!(OS && (!sr || sr.error));
        var specRows = sr && !sr.error ? OS.summaryRows(sr) : null;
        if (sr && sr.spec && sr.spec.budget && sr.spec.budget.currency) cur = sr.spec.budget.currency;
        // The server spec checks destination (incl. the business website),
        // budget, creative and copy itself, so it replaces the local checks.
        if (sr && !sr.error) issues = [];
        // The server's record of this campaign's publish wins over everything.
        var pubState = sr && sr.publish && sr.publish.state;
        var pubBlock = pubState === 'published' ? (sr.publish.campaignId ? TX('ofl_pubAlreadyId', { id: sr.publish.campaignId }) : TX('ofl_pubAlready'))
          : pubState === 'unconfirmed' ? TX('ofl_pubUnconfirmed')
          : pubState === 'publishing' ? TX('ofl_pubInProgress') : '';
        var blocked = !!pubBlock || issues.length > 0 || specErrs.length > 0 || specFail || !(acct && acct.connected) || !(acct && (acct.name || acct.id));
        var dl =
          '<dl class="ofe-dl ofd-summary">' +
            '<div class="ofe-row"><dt>' + esc(TX('ofl_rCampaign')) + '</dt><dd>' + esc(o.name || pkg.campaignName || TX('ofl_untitledCampaign')) + '</dd></div>' +
            '<div class="ofe-row"><dt>' + esc(TX('ofl_rPlatform')) + '</dt><dd>' + esc(PLAT[p] || p) + '</dd></div>' +
            '<div class="ofe-row"><dt>' + esc(TX('ofl_adAccount')) + '</dt><dd>' + esc(acctTxt) + '</dd></div>' +
            '<div class="ofe-row"><dt>' + esc(TX('ofl_dailyBudget')) + '</dt><dd>' + esc(P.budgetLabel(pkg, p, cur)) + '</dd></div>' +
            '<div class="ofe-row"><dt>' + esc(TX('ofl_schedule')) + '</dt><dd>' + esc(TX('ofl_pubSchedule', { provider: PROVIDER[p] })) + '</dd></div>' +
            (specRows ? specRows.map(function (r) { return '<div class="ofe-row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('')
              : '<div class="ofe-row"><dt>' + esc(TX('ofl_targeting')) + '</dt><dd>' + esc(tg.sent) + '</dd></div>' + (o.structure ? '<div class="ofe-row"><dt>' + esc(TX('ofl_rStructure')) + '</dt><dd>' + esc(o.structure) + '</dd></div>' : '')) +
          '</dl>';
        var warn = pubBlock ? '<p class="ofd-err" role="alert">' + esc(pubBlock) + '</p>'
          : issues.length
          ? '<p class="ofd-err" role="alert">' + esc(TX('ofl_fixBeforePublishing')) + ' ' + esc(issues.map(function (i) { return i.label; }).join(', ')) + '.</p>'
          : specFail ? '<p class="ofd-err" role="alert">' + esc((sr && sr.error) || TX('ofl_specCouldntCheck')) + ' ' + esc(TX('ofl_nothingSent')) + '</p>'
          : specErrs.length ? '<div class="ofd-err" role="alert"><p>' + esc(TX('ofl_fixBeforePublishing')) + '</p><ul class="ofd-errlist">' + specErrs.map(function (i) { return '<li>' + esc(issueText(i)) + '</li>'; }).join('') + '</ul></div>'
          : (!(acct && acct.connected) ? '<p class="ofd-err" role="alert">' + esc(TX('ofl_pubNotConnected', { platform: PLAT[p] })) + '</p>'
          : (!(acct.name || acct.id) ? '<p class="ofd-err" role="alert">' + esc(TX('ofl_pubSelectAccount')) + '</p>' : ''));
        d.setBody(dl + warn + '<p class="ofd-muted">' + esc(TX('ofl_pubRealObjects', { provider: PROVIDER[p] })) + '</p>');
        var acts = [{ label: TX('ofl_cancel'), kind: 'ghost', onClick: function (api) { api.close(false); } }];
        if ((specErrs.length || issues.length) && o.campId && F.findCampaign(o.campId)) acts.push({ label: TX('ofl_reviewSettings'), kind: 'ghost', onClick: function (api) { api.close(false); F.openAd(o.campId, 'settings'); } });
        acts.push({ label: TX('ofl_publishPaused'), kind: 'primary', disabled: blocked, onClick: function (api) { api.close(true); } });
        d.setActions(acts);
        d.focusFirst();
      });
    });
  };

  // ════════════════════════════════════════════════════════════════
  // 5e. LIFECYCLE CONFIRMATIONS — wording matches what really happens
  // ════════════════════════════════════════════════════════════════
  //   pause/resume  → real provider call (POST /api/{p}/campaign/:id/…)
  //   remove        → OrivenAI's record only; the provider campaign is untouched
  //   archive       → OrivenAI's list only; the provider campaign is untouched
  //   disconnect    → removes OrivenAI's access; provider campaigns keep running
  F.confirmProviderToggle = function (o) {
    var p = o.platform, toPause = o.action === 'pause';
    var name = PLAT[p] || p;
    // o.first: the campaign has never run (published paused by OrivenAI).
    var verb = toPause ? 'Pause' : o.first ? 'Activate' : 'Resume';
    var nm = trunc(o.name || TX('ofl_thisCampaign'), 60), prov = PROVIDER[p] || p;
    return F.confirm({
      eyebrow: name, title: TX('ofl_t' + verb, { name: nm }),
      body: '<p>' + esc(TX('ofl_body' + verb, { provider: prov, platform: name })) + '</p>',
      confirmLabel: TX('ofl_c' + verb),
      busyLabel: TX(toPause ? 'ofl_pausing' : o.first ? 'ofl_activating' : 'ofl_resuming'),
      run: o.run
    });
  };
  F.confirmRemove = function (o) {
    var p = o.platform, name = PLAT[p] || p || TX('ofl_thePlatform');
    var onProvider = !!o.externalId || !!o.manual;
    var body = o.manual
      ? '<p>' + esc(TX('ofl_rmManual', { platform: name })) + '</p>'
      : onProvider
        ? '<p>' + esc(o.providerStatus ? TX('ofl_rmProviderStatus', { platform: name, status: o.providerStatus }) : TX('ofl_rmProvider', { platform: name })) + '</p>'
        : '<p>' + esc(TX('ofl_rmDraft', { platform: name })) + '</p>';
    return F.confirm({ eyebrow: TX('ofl_campaignsEyebrow'), title: TX(onProvider ? 'ofl_rmTitle' : 'ofl_delTitle', { name: trunc(o.name || TX('ofl_thisCampaign'), 60) }),
      body: body, confirmLabel: TX(onProvider ? 'ofl_rmConfirm' : 'ofl_delConfirm'), danger: true });
  };
  F.confirmArchive = function (o) {
    var name = PLAT[o.platform] || o.platform || TX('ofl_thePlatform');
    return F.confirm({ eyebrow: TX('ofl_campaignsEyebrow'), title: TX('ofl_archTitle', { name: trunc(o.name || TX('ofl_thisCampaign'), 60) }),
      body: '<p>' + esc(TX('ofl_archBody', { platform: name })) + '</p>',
      confirmLabel: TX('ofl_archConfirm') });
  };
  F.confirmDisconnect = function (p, run) {
    var name = PLAT[p] || p;
    return F.confirm({ eyebrow: TX('ofl_connectionsEyebrow'), title: TX('ofl_discTitle', { platform: name }),
      body: '<p>' + esc(TX('ofl_discBody1', { platform: name })) + '</p>' +
        '<p><strong>' + esc(TX('ofl_discBody2', { platform: name })) + '</strong></p>',
      confirmLabel: TX('ofl_disconnect'), danger: true, busyLabel: TX('ofl_disconnecting'), run: run });
  };

  // The Ads Manager live tables call real provider pause/resume handlers
  // directly from row buttons; each gets the same confirmation. Wrapped
  // once the inline scripts that define them have run.
  function wrapLiveHandlers() {
    [['admMetaPauseCampaign', 'meta', 'pause'], ['admMetaResumeCampaign', 'meta', 'resume'],
     ['admGPauseCampaign', 'google', 'pause'], ['admGResumeCampaign', 'google', 'resume'],
     ['admPPauseCampaign', 'pinterest', 'pause'], ['admPResumeCampaign', 'pinterest', 'resume']].forEach(function (w) {
      var orig = window[w[0]];
      if (typeof orig !== 'function' || orig._owConfirm) return;
      var wrapped = function () {
        var self = this, args = arguments;
        F.confirmProviderToggle({ platform: w[1], action: w[2], name: args[2] || '' }).then(function (ok) { if (ok) orig.apply(self, args); });
      };
      wrapped._owConfirm = true;
      window[w[0]] = wrapped;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapLiveHandlers);
  else setTimeout(wrapLiveHandlers, 0);

  // Plain-language result for a publish response (success or failure).
  F.publishOutcome = function (p, res, err) {
    if (res && res.ok && res.data && res.data.ok) {
      var st = String(res.data.status || 'paused').toLowerCase();
      var live = /^(active|enabled|running|live)$/.test(st);
      return { ok: true, title: TX(live ? 'ofl_liveOn' : 'ofl_createdOn', { platform: PLAT[p] }),
        message: TX(live ? 'ofl_liveMsg' : 'ofl_createdMsg', { provider: PROVIDER[p] }) };
    }
    var model = F.error({ status: res && res.status, body: res && res.data, error: err, phase: 'publish', sending: true });
    return { ok: false, title: model.title, message: model.message, detail: model.detail || '', retry: model.retry, kind: model.kind, unconfirmed: !!model.unconfirmed, confirmedFailure: !!model.confirmedFailure };
  };
})();
