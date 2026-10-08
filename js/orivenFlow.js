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
  var PLAT = { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' };
  var PROVIDER = { google: 'Google', meta: 'Meta', tiktok: 'TikTok', pinterest: 'Pinterest' };
  var PK = { google: 'googleAds', meta: 'metaAds', tiktok: 'tiktokAds', pinterest: 'pinterestAds' };
  F.PLAT = PLAT;

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

  // Budget. Google: strategy.budgetRecommendation must be a number (or
  // {amount|daily}) ≥ 1, otherwise the route rejects the publish.
  // Meta / TikTok / Pinterest: {platform}.budget → strategy.dailyBudget →
  // strategy.budget, parsed with the route's own expression; missing means
  // the route's built-in default (30 / 30 / 10). TikTok floors at 10.
  var BUDGET_RULE = {
    meta: { def: 30, min: 1 }, tiktok: { def: 30, min: 10 }, pinterest: { def: 10, min: 1 }
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
      var br = s.budgetRecommendation;
      var raw = (br && typeof br === 'object') ? (br.amount != null ? br.amount : br.daily) : br;
      var n = Number(raw);
      var ok = raw !== undefined && raw !== null && raw !== '' && isFinite(n) && n >= 1;
      return {
        platform: p, required: true, min: 1,
        amount: ok ? n : null, applied: ok ? n : null, source: ok ? 'set' : 'missing',
        currency: (br && typeof br === 'object' && br.currency) || null,
        suggestion: ok ? null : looseNumber(typeof br === 'string' ? br : null)
      };
    }
    var rule = BUDGET_RULE[p] || BUDGET_RULE.meta;
    var o = platObj(pkg, p);
    var rawB = o.budget || s.dailyBudget || s.budget;
    if (!rawB) {
      return { platform: p, required: false, min: rule.min, def: rule.def, amount: null, applied: rule.def, source: 'default',
        suggestion: looseNumber(s.budgetRecommendation) };
    }
    var parsed = parseFloat(String(rawB).replace(/[^0-9.]/g, ''));
    var applied = Math.max(rule.min, parsed || rule.def);
    return { platform: p, required: false, min: rule.min, def: rule.def, amount: applied, applied: applied, source: 'set',
      adjusted: applied !== parsed, raw: rawB };
  };
  P.setBudget = function (pkg, p, amount) {
    var n = Number(amount);
    var min = p === 'google' ? 1 : (BUDGET_RULE[p] || BUDGET_RULE.meta).min;
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
    if (b.source === 'missing') return 'Not set';
    if (b.source === 'default') return money(b.applied) + ' / day (OrivenAI default)';
    return money(b.applied) + ' / day';
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
    if (!u) return 'Enter the page people land on after clicking the ad.';
    var parsed;
    try { parsed = new URL(u); } catch (_) { return 'Enter a full address, for example https://yourshop.com/offer.'; }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'The address must start with https:// or http://.';
    if (!/\./.test(parsed.hostname)) return 'That address has no domain. Check it and try again.';
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
  P.needsImage = function (pkg, p) {
    if (p === 'google') return googleType(pkg) !== 'SEARCH';
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
        field('Headlines', 'h' + i, 'Headline ' + (i + 1), function () { return h; }, function (v) { hl[i] = v; }, { max: 30, note: 'Google shows up to 30 characters.' });
      });
      ds.forEach(function (d, i) {
        field('Descriptions', 'd' + i, 'Description ' + (i + 1), function () { return d; }, function (v) { ds[i] = v; }, { max: 90, multiline: true, note: 'Google shows up to 90 characters.' });
      });
      return out;
    }
    if (p === 'pinterest') {
      var pin = platObj(pkg, 'pinterest', true);
      field('Pin', 'title', 'Pin title', function () { return pin.title; }, function (v) { pin.title = v; }, { max: 100 });
      field('Pin', 'description', 'Description', function () { return pin.description; }, function (v) { pin.description = v; }, { max: 500, multiline: true });
      field('Pin', 'altText', 'Image alt text', function () { return pin.altText; }, function (v) { pin.altText = v; }, { max: 500 });
      return out;
    }
    if (p === 'tiktok') {
      if (concepts.length) {
        concepts.forEach(function (c, i) {
          var grp = 'Ad variant ' + (i + 1);
          var hookKey = c.hook ? 'hook' : null;
          field(grp, 'hook' + i, 'Hook', function () { return c.hook || conceptCopy(c).headline || o.hook; },
            function (v) { if (hookKey) c.hook = v; else conceptCopy(c).headline = v; });
          field(grp, 'text' + i, 'Ad text', function () { return conceptCopy(c).primaryText || o.script; },
            function (v) { conceptCopy(c).primaryText = v; }, { max: 100, multiline: true, note: 'TikTok uses the first 100 characters.' });
        });
      } else {
        var tk = platObj(pkg, 'tiktok', true);
        field('Ad', 'hook', 'Hook', function () { return tk.hook; }, function (v) { tk.hook = v; });
        field('Ad', 'script', 'Ad text', function () { return tk.script; }, function (v) { tk.script = v; }, { max: 100, multiline: true, note: 'TikTok uses the first 100 characters.' });
      }
      return out;
    }
    // meta
    if (concepts.length) {
      concepts.forEach(function (c, i) {
        var grp = 'Ad variant ' + (i + 1);
        field(grp, 'headline' + i, 'Headline', function () { return conceptCopy(c).headline || o.headline; }, function (v) { conceptCopy(c).headline = v; }, { max: 40 });
        field(grp, 'primary' + i, 'Primary text', function () { return conceptCopy(c).primaryText || o.primaryText || o.description; }, function (v) { conceptCopy(c).primaryText = v; }, { max: 125, multiline: true, note: 'Meta shows about 125 characters before “See more”.' });
      });
    } else {
      var m = platObj(pkg, 'meta', true);
      field('Ad', 'headline', 'Headline', function () { return m.headline; }, function (v) { m.headline = v; }, { max: 40 });
      field('Ad', 'primaryText', 'Primary text', function () { return m.primaryText || m.description; }, function (v) { m.primaryText = v; }, { max: 125, multiline: true });
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

  // What the publish route actually sends as targeting — stated plainly,
  // because the AI audience text is guidance and not sent everywhere.
  P.targeting = function (pkg, p) {
    pkg = pkg || {};
    if (p === 'meta') {
      var placement = (platObj(pkg, 'meta').placement === 'instagram_only') ? 'Instagram only' : 'Facebook and Instagram';
      return { sent: 'United States · ages 18–65 · ' + placement, note: 'This is OrivenAI’s current Meta publish setting. The audience description is used for copy, not sent as targeting. You can refine targeting on Meta after the paused campaign is created.' };
    }
    if (p === 'pinterest') return { sent: 'United States', note: 'Pinterest campaigns are created with United States location targeting. Refine it on Pinterest after the paused campaign is created.' };
    if (p === 'tiktok') return { sent: 'Automatic placement', note: 'TikTok chooses placements. No audience targeting is sent; refine it on TikTok after the paused campaign is created.' };
    var kw = ((pkg.googleAds || {}).keywords || []).filter(Boolean);
    return googleType(pkg) === 'SEARCH'
      ? { sent: kw.length ? kw.length + ' keyword' + (kw.length === 1 ? '' : 's') : 'No keywords', note: 'Search ads are matched to these keywords.' }
      : { sent: 'Google’s automatic audience', note: 'This campaign type uses Google’s own audience signals.' };
  };

  // Mirrors the route's hard rejections plus OrivenAI's own blockers.
  P.issues = function (pkg, p) {
    var list = [];
    if (!P.url(pkg, p) || P.validateUrl(P.url(pkg, p))) list.push({ key: 'destination', label: 'Destination URL', blocker: true });
    var b = P.budget(pkg, p);
    if (b.source === 'missing') list.push({ key: 'budget', label: 'Daily budget', blocker: true });
    else if (b.source === 'default') list.push({ key: 'budget', label: 'Daily budget (default ' + b.applied + ' / day)', blocker: false });
    if (P.needsImage(pkg, p) && !P.image(pkg, p)) list.push({ key: 'creative', label: 'Creative image', blocker: true });
    if (p === 'google' && googleType(pkg) === 'SEARCH') {
      var g = pkg.googleAds || {};
      var h = (g.headlines || []).filter(Boolean).length, d = (g.descriptions || []).filter(Boolean).length;
      if (h < 3 || d < 2) list.push({ key: 'copy', label: 'At least 3 headlines and 2 descriptions', blocker: true });
    }
    return list;
  };

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
  var SERVICE_MSG = 'OrivenAI cannot generate this campaign right now because the generation service is temporarily unavailable. Please try again later.';
  function safeServerText(t) {
    t = String(t || '');
    t = t.replace(/\(#\d+\)\s*/g, '').trim();
    if (!t || t.length > 220) return '';
    if (/aiml|api[_ -]?key|stack|econn|undefined|null|exception|at\s+\w+\s*\(|<\/?[a-z]/i.test(t)) return '';
    return t;
  }
  F.error = function (input) {
    input = input || {};
    var st = input.status || 0, b = input.body || {}, err = input.error, phase = input.phase || 'generate';
    var code = b && b.code;
    var c = costs();
    var msg = err && err.message ? String(err.message) : '';
    var noun = phase === 'publish' ? 'campaign' : 'build';
    if (err && !st) {
      if (/could not reach/i.test(msg) || /failed to fetch|network/i.test(msg) || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        if (phase === 'publish') return { kind: 'network', title: 'Result not confirmed', message: 'The connection dropped before the platform replied, so OrivenAI can’t confirm whether the campaign was created. Check your ad account before trying again.', retry: false, edit: false };
        return { kind: 'network', title: 'Can’t reach OrivenAI', message: 'Check your internet connection, then try again. Nothing was ' + (phase === 'publish' ? 'published.' : 'built.'), retry: true, edit: true };
      }
      if (/unexpected response|not found|starting/i.test(msg)) {
        return { kind: 'backend', title: 'OrivenAI is temporarily unavailable', message: 'Our servers didn’t respond as expected. Please try again in a minute.', retry: true, edit: true };
      }
      if (phase === 'generate' && /malformed|incomplete/i.test(msg)) {
        return { kind: 'malformed', title: 'The campaign came back incomplete', message: 'OrivenAI received a campaign it couldn’t use, so nothing was saved. Try building it again.', retry: true, edit: true };
      }
      return { kind: 'unknown', title: phase === 'publish' ? 'Publishing didn’t complete' : 'The build didn’t complete', message: 'Something unexpected happened. Try again — if it keeps happening, contact support.', retry: true, edit: true };
    }
    if (st === 402 || code === 'CREDITS_EXHAUSTED') {
      var bal = b.balance != null ? Number(b.balance) : null;
      var need = input.required || c.campaign || 25;
      return {
        kind: 'credits', title: 'Not enough credits',
        message: 'Building a campaign needs ' + need + ' credits' + (bal != null ? ', and you have ' + bal + '.' : '.') +
          ' Images (' + (c.imageAd || 75) + ' each) and videos (' + (c.video || 200) + ' each) are charged separately.',
        balance: bal, required: need, retry: false, edit: true,
        action: { label: 'View plans', fn: 'plans', ctx: { action: phase === 'creative' ? 'image' : 'create', code: 'CREDITS_EXHAUSTED', balance: bal } }
      };
    }
    if (st === 403 && code === 'SUBSCRIPTION_REQUIRED') {
      return { kind: 'subscription', title: 'A plan is required', message: 'Choose a plan to keep building campaigns.', retry: false, edit: true, action: { label: 'View plans', fn: 'plans', ctx: { action: 'create', code: 'SUBSCRIPTION_REQUIRED' } } };
    }
    if (code === 'PROVIDER_UNAVAILABLE') {
      return { kind: 'service', title: 'Generation service unavailable',
        message: phase === 'creative' ? 'OrivenAI can’t create this image right now because the generation service is temporarily unavailable. Please try again later.' : SERVICE_MSG,
        detail: (b.creditsRefunded || b.refunded) ? 'Your credits were returned.' : '', retry: true, edit: true };
    }
    if (st === 401) {
      return { kind: 'session', title: 'Your session has expired', message: 'Sign in again to continue. Nothing was ' + (phase === 'publish' ? 'published.' : 'built.'), retry: false, edit: false, action: { label: 'Sign in again', fn: 'signin' } };
    }
    // Paid-action guard (server): the same build is already running, or this
    // exact action was already sent. Nothing new was charged.
    if (st === 409 && code === 'ACTION_IN_PROGRESS') {
      return { kind: 'in_progress', title: 'Already building', message: safeServerText(b.error) || 'This is still running. Wait for it to finish before starting another.', detail: 'Nothing extra was charged.', retry: false, edit: false };
    }
    if (st === 409 && code === 'DUPLICATE_ACTION') {
      return { kind: 'in_progress', title: 'Already sent', message: 'This exact request was already sent once. Start a new build if you want another.', detail: 'Nothing extra was charged.', retry: true, edit: true };
    }
    if (st === 409 && code === 'PUBLISH_IN_PROGRESS') {
      return { kind: 'in_progress', title: 'Already publishing', message: 'This campaign is already being sent. Wait for that to finish before trying again.', retry: false, edit: false };
    }
    if (st === 429) {
      return { kind: 'rate_limit', title: 'Too many requests', message: 'Wait a minute, then try again.', retry: true, edit: true };
    }
    if (st === 408 || st === 504) {
      return { kind: 'timeout', title: 'This took too long', message: 'The ' + noun + ' didn’t finish in time. Try again.', retry: true, edit: true };
    }
    if (code === 'CONTENT_POLICY' || code === 'POLICY_VIOLATION' || /policy/i.test(String(b.error || '')) && st === 400 && phase === 'generate') {
      return { kind: 'policy', title: 'This request can’t be built', message: 'The description includes content OrivenAI can’t create ads for. Edit the description and try again.', retry: false, edit: true };
    }
    if (st === 400 || st === 422) {
      var t = safeServerText(b.error || b.message);
      return { kind: 'invalid', title: phase === 'publish' ? 'The platform needs a change first' : 'Check the campaign details',
        message: t || (phase === 'publish' ? 'Something in this campaign needs fixing before it can be sent.' : 'Something in this request is missing or invalid. Review it in Create and try again.'),
        retry: false, edit: true };
    }
    if (st === 502 || st === 503) {
      return { kind: 'backend', title: 'OrivenAI is temporarily unavailable', message: 'Our servers didn’t respond. Please try again in a minute.', detail: b.creditsRefunded ? 'Your credits were returned.' : '', retry: true, edit: true };
    }
    if (code === 'GENERATION_FAILED' || (st >= 500 && phase === 'generate')) {
      return { kind: 'generation', title: 'Campaign generation failed', message: 'OrivenAI couldn’t finish building this campaign. Try again, or adjust the description.',
        detail: b.creditsRefunded ? 'Your credits for this attempt were returned.' : '', retry: true, edit: true };
    }
    if (st >= 500) {
      var t2 = phase === 'publish' ? safeServerText(b.error) : '';
      return { kind: 'unknown', title: phase === 'publish' ? 'Publishing didn’t complete' : 'Something went wrong', message: t2 || 'Try again. If it keeps happening, contact support.', retry: true, edit: true };
    }
    return { kind: 'unknown', title: 'Something went wrong', message: 'Try again. If it keeps happening, contact support.', retry: true, edit: true };
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
    } else if (fn === 'campaigns') {
      if (typeof window.navigate === 'function') window.navigate('campaigns');
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
          '<button type="button" class="ofd-x" aria-label="Close">×</button>' +
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
          { label: opts.cancelLabel || 'Cancel', kind: 'ghost', onClick: function (api) { api.close(false); } },
          { label: opts.confirmLabel || 'Confirm', kind: opts.danger ? 'danger' : 'primary', onClick: function (api) {
            if (typeof opts.run !== 'function') { api.close(true); return; }
            // Long-running confirmation: keep the dialog open, busy, until the
            // real result arrives, then show the outcome in place.
            api.busy(true, opts.busyLabel || 'Working…');
            Promise.resolve().then(opts.run).then(function (res) {
              api.busy(false);
              if (res && res.ok === false) {
                api.setBody('<div class="ofd-result ofd-result-err" role="alert"><strong>' + esc(res.title || 'That didn’t work') + '</strong><p>' + esc(res.message || '') + '</p></div>');
                api.setActions([{ label: 'Close', kind: 'ghost', onClick: function (a) { a.close(false); } }]);
                api.focusFirst();
              } else {
                done = true; resolve(true); api.close(true);
              }
            }, function () {
              api.busy(false);
              api.setBody('<div class="ofd-result ofd-result-err" role="alert"><strong>That didn’t work</strong><p>Check your connection and try again.</p></div>');
              api.setActions([{ label: 'Close', kind: 'ghost', onClick: function (a) { a.close(false); } }]);
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
  // 4. BUILDER — Build Campaign construction canvas
  // ════════════════════════════════════════════════════════════════
  // Every state change is triggered by a real lifecycle event:
  //   start()        – Build accepted (after Create's own validation and
  //                    the credit pre-flight), before the request is sent
  //   sent()         – POST /api/ai/create-ad dispatched
  //   copy(pkg)      – the real package arrived
  //   creative(ok)   – the real image(s) finished (or failed)
  //   background()   – video mode: creative continues after reveal
  //   fail(model)    – any failure, from any phase
  // Between events, the only motion is the pen re-drafting outlines on a
  // slow timer (no rAF), paused while the tab is hidden, off under
  // reduced motion, and cleared on completion or error.
  var B = F.builder = {};
  var bs = null;
  var STAGES = [
    { k: 'prepare', t: 'Preparing campaign' },
    { k: 'structure', t: 'Building campaign structure' },
    { k: 'business', t: 'Applying business context' },
    { k: 'research', t: 'Applying research context' },
    { k: 'copy', t: 'Organizing ad copy' },
    { k: 'creative', t: 'Creating creative' },
    { k: 'check', t: 'Checking campaign' },
    { k: 'finalize', t: 'Finalizing' }
  ];
  var HIER = {
    google: ['Campaign', 'Ad group', 'Responsive search ad'],
    meta: ['Campaign', 'Ad set', 'Ad'],
    tiktok: ['Campaign', 'Ad group', 'Ad'],
    pinterest: ['Campaign', 'Ad group', 'Pin']
  };
  var LABELS = {
    google: { headline: 'Headlines', copy: 'Descriptions', cta: 'Keywords' },
    meta: { headline: 'Headline', copy: 'Primary text', cta: 'Call to action' },
    tiktok: { headline: 'Hook', copy: 'Ad text', cta: 'Call to action' },
    pinterest: { headline: 'Pin title', copy: 'Description', cta: 'Call to action' }
  };
  var RATIO = { google: '1.91 / 1', meta: '1 / 1', tiktok: '9 / 16', pinterest: '2 / 3' };

  function host() { return document.getElementById('cgrLoading'); }
  function q(sel) { return bs && bs.root ? bs.root.querySelector(sel) : null; }
  function later(fn, ms) { if (!bs) return; var tok = bs.token; var t = setTimeout(function () { if (bs && bs.token === tok) fn(); }, ms); bs.timers.push(t); }
  function clearTimers() { if (!bs) return; bs.timers.forEach(clearTimeout); bs.timers = []; }
  function stepMs(ms) { return reduceMotion() ? 0 : ms; }

  function partHtml(key, label, extraCls, inner) {
    return '<div class="ofb-part' + (extraCls ? ' ' + extraCls : '') + '" data-part="' + key + '">' +
      '<span class="ofb-part-lbl">' + esc(label) + '</span>' +
      (inner || '<span class="ofb-part-val"></span>') +
      '<span class="ofb-part-edge" aria-hidden="true"></span></div>';
  }

  B.start = function (o) {
    o = o || {};
    B.stop();
    var el = host();
    if (!el) return null;
    var p = PLAT[o.platform] ? o.platform : 'meta';
    var L = LABELS[p], H = HIER[p];
    var isVideo = o.creativeMode === 'videos';
    var searchText = p === 'google' && o.googleType && o.googleType !== 'SEARCH' ? false : (p === 'google');
    bs = { token: Date.now() + Math.random(), platform: p, timers: [], outline: [], phase: 'request', root: null, isVideo: isVideo,
      hasBusiness: !!o.hasBusiness, hasResearch: !!o.hasResearch, startedAt: Date.now(), afterCopy: [], copyDone: false };
    el.classList.add('ofb-host');
    el.innerHTML =
      '<section class="ofb" data-state="building" aria-labelledby="ofbTitle">' +
        '<header class="ofb-head">' +
          '<div class="ofb-meta"><span>' + esc(PLAT[p]) + '</span><span>' + esc(o.goal || 'Sales') + '</span><span>' + (isVideo ? 'Video ad' : (searchText ? 'Search ad' : 'Image ad')) + '</span></div>' +
          '<h1 class="ofb-title" id="ofbTitle">Building your campaign</h1>' +
          '<p class="ofb-now" id="ofbNow" role="status" aria-live="polite">Preparing campaign</p>' +
        '</header>' +
        '<div class="ofb-body">' +
          '<div class="ofb-canvas" aria-hidden="true">' +
            '<div class="ofb-sheet">' +
              partHtml('structure', 'Structure', 'ofb-p-structure', '<span class="ofb-hier">' + H.map(function (h) { return '<span>' + esc(h) + '</span>'; }).join('<i></i>') + '</span>') +
              partHtml('creative', isVideo ? 'Video' : (searchText ? 'Search result' : 'Creative'), 'ofb-p-creative',
                '<span class="ofb-frame" style="aspect-ratio:' + (searchText ? '2.4 / 1' : RATIO[p]) + '"><span class="ofb-frame-x"></span><img class="ofb-frame-img" alt="" hidden></span>') +
              partHtml('headline', L.headline, 'ofb-p-headline') +
              partHtml('copy', L.copy, 'ofb-p-copy') +
              partHtml('cta', L.cta, 'ofb-p-cta') +
              partHtml('destination', 'Destination', 'ofb-p-dest') +
              partHtml('targeting', 'Targeting', 'ofb-p-target') +
              partHtml('budget', 'Budget & schedule', 'ofb-p-budget') +
              partHtml('tracking', 'Tracking', 'ofb-p-track') +
              partHtml('readiness', 'Readiness', 'ofb-p-ready') +
            '</div>' +
            '<span class="ofb-pen"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 21l3.8-1 11-11a2 2 0 0 0-2.8-2.8l-11 11L3 21z" fill="currentColor" opacity=".16"/><path d="M3 21l3.8-1 11-11a2 2 0 0 0-2.8-2.8l-11 11L3 21zM13.5 7.5l3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>' +
          '</div>' +
          '<ol class="ofb-steps" aria-label="Build progress">' +
            STAGES.map(function (s) {
              return '<li class="ofb-step" data-step="' + s.k + '" data-s="pending"><span class="ofb-step-mark" aria-hidden="true"></span><span class="ofb-step-t">' + esc(s.t) + '</span><span class="ofb-step-note"></span><span class="ofb-sr"> — waiting</span></li>';
            }).join('') +
          '</ol>' +
        '</div>' +
        '<div class="ofb-foot" id="ofbFoot"></div>' +
      '</section>';
    bs.root = el.querySelector('.ofb');
    bs.outline = ['structure', 'headline', 'copy', 'cta', 'creative', 'destination', 'targeting', 'budget', 'tracking', 'readiness'];
    setStep('prepare', 'active');
    if (reduceMotion()) {
      bs.outline.forEach(function (k) { markPart(k, 'drafted'); });
      bs.outline = [];
    } else {
      later(idleTick, 350);
    }
    // Honest long-wait notice — never a fake ETA.
    later(function () {
      if (bs && bs.phase === 'request') {
        var f = q('#ofbFoot');
        if (f) f.innerHTML = '<p class="ofb-slow">This is taking longer than usual. The build is still running — keep this page open.</p>';
      }
    }, 70000);
    return bs.token;
  };
  B.isCurrent = function (token) { return !!bs && bs.token === token; };
  B.active = function () { return !!bs && bs.phase !== 'done' && bs.phase !== 'error'; };
  B.stop = function () { clearTimers(); bs = null; };

  function setStep(k, state, note) {
    if (!bs) return;
    var li = q('.ofb-step[data-step="' + k + '"]');
    if (!li) return;
    li.setAttribute('data-s', state);
    var sr = li.querySelector('.ofb-sr');
    if (sr) sr.textContent = ' — ' + ({ pending: 'waiting', active: 'in progress', done: 'done', skipped: 'not included', warn: 'finished with a warning', failed: 'failed', bg: 'continues in the background' }[state] || state);
    var n = li.querySelector('.ofb-step-note');
    if (n) n.textContent = note || '';
    if (state === 'active') {
      var now = q('#ofbNow');
      var def = STAGES.filter(function (s) { return s.k === k; })[0];
      if (now && def) now.textContent = def.t;
    }
  }
  function markPart(k, cls) {
    var el = q('.ofb-part[data-part="' + k + '"]');
    if (el) el.classList.add('ofb-' + cls);
    return el;
  }
  function movePen(k) {
    if (!bs || reduceMotion()) return;
    var el = q('.ofb-part[data-part="' + k + '"]');
    var pen = q('.ofb-pen');
    var canvas = q('.ofb-canvas');
    if (!el || !pen || !canvas) return;
    var x = el.offsetLeft + Math.min(el.offsetWidth - 18, 26 + (el.offsetWidth * 0.55));
    var y = el.offsetTop + Math.min(el.offsetHeight - 10, 22);
    pen.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
    pen.classList.add('ofb-pen-on');
    canvas.querySelectorAll('.ofb-part.ofb-focus').forEach(function (n) { n.classList.remove('ofb-focus'); });
    el.classList.add('ofb-focus');
  }
  function idleTick() {
    if (!bs || bs.phase !== 'request') return;
    if (!document.hidden) {
      var next = bs.outline.shift();
      if (next) { movePen(next); markPart(next, 'drafted'); }
      else {
        // Everything outlined; keep the pen visiting parts that are still
        // waiting for real content, slowly. No values are invented.
        var waiting = ['headline', 'copy', 'creative', 'cta', 'budget', 'targeting'];
        bs.wander = ((bs.wander || 0) + 1) % waiting.length;
        movePen(waiting[bs.wander]);
      }
    }
    later(idleTick, bs.outline.length ? 900 : 2600);
  }

  B.sent = function (token) {
    if (!bs || (token && bs.token !== token)) return;
    setStep('prepare', 'done');
    setStep('structure', 'active');
    setStep('business', bs.hasBusiness ? 'active' : 'skipped', bs.hasBusiness ? '' : 'No business profile yet');
    setStep('research', bs.hasResearch ? 'active' : 'skipped', bs.hasResearch ? '' : 'No research findings selected');
    var now = q('#ofbNow'); if (now) now.textContent = 'Building campaign structure';
  };

  function fillPart(k, text, extraCls) {
    var el = markPart(k, 'filled');
    if (!el) return;
    el.classList.add('ofb-drafted');
    if (extraCls) el.classList.add(extraCls);
    var v = el.querySelector('.ofb-part-val');
    if (v) v.textContent = text;
    movePen(k);
  }

  B.copy = function (pkg, platform, token) {
    if (!bs || (token && bs.token !== token)) return;
    bs.phase = 'copy';
    clearTimers();
    var f = q('#ofbFoot'); if (f) f.innerHTML = '';
    var p = platform || bs.platform;
    var s = P.summary(pkg, p);
    setStep('prepare', 'done');
    setStep('structure', 'done');
    if (bs.hasBusiness) setStep('business', 'done');
    if (bs.hasResearch) setStep('research', 'done');
    setStep('copy', 'active');
    bs.outline.forEach(function (k) { markPart(k, 'drafted'); });
    bs.outline = [];
    var tgt = P.targeting(pkg, p);
    var b = s.budget;
    var kws = ((pkg.googleAds || {}).keywords || []).filter(Boolean);
    var seq = [
      ['structure', null],
      ['headline', trunc(s.headline, 70) || 'Written'],
      ['copy', trunc(s.copy, 120) || 'Written'],
      ['cta', p === 'google' ? (kws.length ? trunc(kws.slice(0, 3).join(' · '), 60) : 'None') : (s.cta || 'Set at publish')],
      ['destination', s.url ? trunc(s.url.replace(/^https?:\/\//, ''), 44) : 'Needs a URL', s.url ? '' : 'ofb-need'],
      ['targeting', trunc(tgt.sent, 48)],
      ['budget', (b.source === 'missing' ? 'Needs a daily budget' : (b.applied + ' / day' + (b.source === 'default' ? ' (default)' : ''))) + ' · created paused', b.source === 'missing' ? 'ofb-need' : ''],
      ['tracking', p === 'meta' ? 'Pixel checked at publish' : 'Checked by ' + PROVIDER[p] + ' at review']
    ];
    var gap = stepMs(170);
    seq.forEach(function (row, i) {
      later(function () {
        if (row[0] === 'structure') { markPart('structure', 'filled'); movePen('structure'); return; }
        fillPart(row[0], row[1], row[2]);
      }, gap * i);
    });
    later(function () {
      setStep('copy', 'done');
      bs.copyDone = true;
      if (bs.isVideo) return;
      setStep('creative', 'active');
      markPart('creative', 'working');
      movePen('creative');
      var fns = bs.afterCopy.slice(); bs.afterCopy = [];
      fns.forEach(function (fn) { fn(); });
    }, gap * seq.length);
  };

  function afterCopy(fn) { if (!bs) return; if (bs.copyDone) fn(); else bs.afterCopy.push(fn); }

  function checkAndFinish(pkg, p, cb) {
    setStep('check', 'active');
    movePen('readiness');
    later(function () {
      var issues = pkg ? P.issues(pkg, p) : [];
      var blockers = issues.filter(function (i) { return i.blocker; });
      var ready = q('.ofb-part[data-part="readiness"]');
      var text = !issues.length ? 'Ready for Launch review'
        : (blockers.length ? blockers.length + ' to finish before launch' : 'Ready, ' + issues.length + ' optional');
      fillPart('readiness', text, blockers.length ? 'ofb-need' : '');
      if (ready) ready.setAttribute('title', issues.map(function (i) { return i.label; }).join(', '));
      setStep('check', blockers.length ? 'warn' : 'done', blockers.length ? blockers.map(function (i) { return i.label; }).join(', ') : '');
      setStep('finalize', 'active');
      later(function () {
        var saveOk = window._orvLastStoreOk !== false;
        setStep('finalize', saveOk ? 'done' : 'warn', saveOk ? 'Saved to Campaigns' : 'Saved to your account; this device’s copy failed');
        bs.phase = 'done';
        bs.root.setAttribute('data-state', 'done');
        var t = q('#ofbTitle'); if (t) t.textContent = 'Campaign ready';
        var now = q('#ofbNow'); if (now) now.textContent = 'Opening your campaign';
        var pen = q('.ofb-pen'); if (pen) pen.classList.remove('ofb-pen-on');
        later(function () { var done = cb; B.stop(); if (done) done(); }, stepMs(650));
      }, stepMs(380));
    }, stepMs(320));
  }

  // info: { pkg, platform, failKind: 'credits'|'service'|'failed', count }
  B.creative = function (ok, info, cb, token) {
    if (!bs || (token && bs.token !== token)) { if (cb) cb(); return; }
    info = info || {};
    afterCopy(function () {
      var p = info.platform || bs.platform;
      var el = q('.ofb-part[data-part="creative"]');
      if (el) el.classList.remove('ofb-working');
      var img = info.pkg ? P.image(info.pkg, p) : null;
      if (ok && img) {
        var im = q('.ofb-frame-img');
        if (im) { im.onload = function () { if (el) el.classList.add('ofb-filled'); }; im.src = img; im.hidden = false; }
      } else if (ok) {
        if (el) el.classList.add('ofb-filled');
      } else if (el) {
        el.classList.add('ofb-need');
      }
      var why = info.failKind === 'credits' ? 'Not enough credits for the image'
        : info.failKind === 'service' ? 'Image service unavailable — add or regenerate it later'
        : 'Image not created — add or regenerate it later';
      setStep('creative', ok ? 'done' : 'warn', ok ? '' : why);
      later(function () { checkAndFinish(info.pkg, p, cb); }, stepMs(ok ? 420 : 200));
    });
  };
  B.background = function (info, cb, token) {
    if (!bs || (token && bs.token !== token)) { if (cb) cb(); return; }
    info = info || {};
    afterCopy(function () {
      setStep('creative', 'bg', 'Video continues in the background');
      markPart('creative', 'working');
      checkAndFinish(info.pkg, info.platform || bs.platform, cb);
    });
  };

  B.fail = function (model, handlers, token) {
    if (!bs || (token && bs.token !== token)) return false;
    clearTimers();
    handlers = handlers || {};
    bs.phase = 'error';
    var activeLi = q('.ofb-step[data-s="active"]');
    q('.ofb-steps').querySelectorAll('.ofb-step[data-s="active"]').forEach(function (li) { li.setAttribute('data-s', 'pending'); });
    if (activeLi) setStep(activeLi.getAttribute('data-step'), 'failed');
    bs.root.setAttribute('data-state', 'error');
    bs.root.setAttribute('data-kind', model.kind);
    var pen = q('.ofb-pen'); if (pen) pen.classList.remove('ofb-pen-on');
    var t = q('#ofbTitle'); if (t) t.textContent = model.title;
    var now = q('#ofbNow'); if (now) { now.textContent = ''; }
    var foot = q('#ofbFoot');
    var creditRow = (model.kind === 'credits' && model.balance != null)
      ? '<dl class="ofb-credits"><div><dt>Needed</dt><dd>' + esc(model.required) + '</dd></div><div><dt>Your balance</dt><dd>' + esc(model.balance) + '</dd></div></dl>' : '';
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
    if (model.retry && handlers.retry) { var r = btn('Try again', model.action ? 'ghost' : 'primary', handlers.retry); first = first || r; }
    if (model.edit !== false && handlers.edit) { var e = btn('Back to Create', 'ghost', handlers.edit); first = first || e; }
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
    if (!camp || !camp.pkg) { toast('This campaign couldn’t be found. Reload and try again.', 'warn'); return; }
    var p = camp.platform || camp.pkg.platform;
    var b = P.budget(camp.pkg, p);
    var start = b.source === 'set' ? b.applied : (b.suggestion || '');
    var rule = p === 'google' ? { min: 1 } : BUDGET_RULE[p];
    var d = F.dialog({
      title: 'Set daily budget', eyebrow: PLAT[p] || p,
      body:
        '<form class="ofd-form" novalidate>' +
          '<label class="ofd-lbl" for="ofdBudget">Daily budget</label>' +
          '<div class="ofd-money"><input id="ofdBudget" class="ofd-input" type="number" inputmode="decimal" min="' + rule.min + '" step="0.01" value="' + esc(start) + '" aria-describedby="ofdBudgetHint ofdBudgetErr" data-autofocus>' +
          '<span class="ofd-money-unit" id="ofdBudgetUnit">per day</span></div>' +
          '<p class="ofd-hint" id="ofdBudgetHint">' + esc(budgetHint(p, b)) + '</p>' +
          '<p class="ofd-err" id="ofdBudgetErr" role="alert" hidden></p>' +
        '</form>',
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: function (api) { api.close(false); } },
        { label: 'Save budget', kind: 'primary', onClick: save }
      ]
    });
    var input = d.el.querySelector('#ofdBudget');
    var errEl = d.el.querySelector('#ofdBudgetErr');
    d.el.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); save(d); });
    F.account(p).then(function (acct) {
      if (acct && acct.currency) { var u = d.el.querySelector('#ofdBudgetUnit'); if (u) u.textContent = acct.currency + ' per day'; }
    });
    function save(api) {
      var v = parseFloat(String(input.value).replace(',', '.'));
      var msg = null;
      if (!isFinite(v) || v <= 0) msg = 'Enter a daily amount greater than zero.';
      else if (v < rule.min) msg = PLAT[p] + ' needs at least ' + rule.min + ' per day.';
      if (msg) { errEl.textContent = msg; errEl.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      var fresh = F.findCampaign(campId);
      var pkg = clone(fresh.pkg);
      P.setBudget(pkg, p, v);
      F.savePackage(campId, pkg);
      api.close(true);
      toast('Daily budget saved: ' + v + ' per day.', 'ok');
      if (opts.onSaved) opts.onSaved(v);
    }
  };
  function budgetHint(p, b) {
    if (p === 'google') return 'Google Ads needs a daily budget before it can publish. Your ad account’s currency is used.';
    if (p === 'tiktok') return 'TikTok requires at least 10 per day. Without a budget, OrivenAI uses ' + b.def + ' per day. Your ad account’s currency is used.';
    return 'Without a budget, OrivenAI uses ' + b.def + ' per day. Your ad account’s currency is used.';
  }

  // ════════════════════════════════════════════════════════════════
  // 5c. GO TO AD — structured editor over the real package
  // ════════════════════════════════════════════════════════════════
  var SECTIONS = [
    { k: 'overview', t: 'Overview' }, { k: 'creative', t: 'Creative' }, { k: 'copy', t: 'Copy' },
    { k: 'audience', t: 'Audience' }, { k: 'budget', t: 'Budget & schedule' },
    { k: 'destination', t: 'Destination & tracking' }, { k: 'platform', t: 'Platform settings' }, { k: 'readiness', t: 'Readiness' }
  ];
  F.openAd = function (campId, section) {
    var camp = F.findCampaign(campId);
    if (!camp || !camp.pkg) { toast('This campaign couldn’t be found. Reload and try again.', 'warn'); return; }
    var p = camp.platform || camp.pkg.platform;
    var work = clone(camp.pkg);
    var dirty = false;
    var cur = section || 'overview';
    var d = F.dialog({
      title: camp.name || 'Campaign', eyebrow: 'Ad · ' + (PLAT[p] || p), wide: true,
      onClose: function () {},
      actions: []
    });
    d.el.classList.add('ofe');
    function actions() {
      d.setActions([
        { label: 'Close', kind: 'ghost', onClick: tryClose },
        { label: dirty ? 'Save changes' : 'Saved', kind: 'primary', disabled: !dirty, onClick: saveAll }
      ]);
    }
    function tryClose(api) {
      if (!dirty) { api.close(false); return; }
      F.confirm({ title: 'Discard unsaved changes?', body: '<p>Your edits to this ad haven’t been saved.</p>', confirmLabel: 'Discard', danger: true })
        .then(function (yes) { if (yes) d.close(false); });
    }
    function saveAll() {
      var errs = validate();
      if (errs.length) { render(errs[0].section); var f = d.el.querySelector('[aria-invalid="true"]'); if (f) f.focus(); return; }
      F.savePackage(campId, work);
      camp = F.findCampaign(campId) || camp;
      work = clone(camp.pkg);
      dirty = false;
      actions();
      render(cur);
      toast('Ad saved. Launch readiness is updated.', 'ok');
    }
    function validate() {
      var out = [];
      var u = P.url(work, p);
      if (u && P.validateUrl(u)) out.push({ section: 'destination' });
      return out;
    }
    function markDirty() { if (!dirty) { dirty = true; actions(); } }
    function nav() {
      return '<nav class="ofe-nav" aria-label="Ad sections"><ul>' + SECTIONS.map(function (s) {
        return '<li><button type="button" class="ofe-tab" data-sec="' + s.k + '"' + (s.k === cur ? ' aria-current="true"' : '') + '>' + esc(s.t) + '</button></li>';
      }).join('') + '</ul></nav>';
    }
    function countText(len, max) { return len + ' / ' + max + (len > max ? ' — ' + PROVIDER[p] + ' cuts off the rest' : ''); }
    function row(label, value, note) {
      return '<div class="ofe-row"><dt>' + esc(label) + '</dt><dd>' + value + (note ? '<p class="ofe-note">' + esc(note) + '</p>' : '') + '</dd></div>';
    }
    function sectionHtml(k) {
      var s = P.summary(work, p);
      if (k === 'overview') {
        var issues = P.issues(work, p);
        return '<dl class="ofe-dl">' +
          row('Campaign', esc(camp.name || s.name || 'Untitled')) +
          row('Platform', esc(PLAT[p] || p)) +
          row('Objective', esc(s.goal || 'Not set')) +
          row('Structure', esc(HIER[p].join(' › '))) +
          row('Created as', 'Paused', 'Nothing spends until you activate it on ' + PROVIDER[p] + '.') +
          row('Readiness', issues.length ? esc(issues.map(function (i) { return i.label + (i.blocker ? ' (required)' : ' (optional)'); }).join(', ')) : 'Nothing left to fix') +
        '</dl>';
      }
      if (k === 'creative') {
        var img = P.image(work, p);
        var need = P.needsImage(work, p);
        return '<div class="ofe-creative">' +
          (img ? '<figure class="ofe-fig"><img src="' + esc(img) + '" alt="Ad creative for ' + esc(camp.name || 'this campaign') + '"><figcaption>Preview of the image sent to ' + esc(PROVIDER[p]) + '. The platform crops it for each placement.</figcaption></figure>'
               : '<p class="ofe-empty">' + (need ? 'No creative yet. ' + PLAT[p] + ' can’t publish this ad without an image.' : 'Search ads are text-only — no image is sent.') + '</p>') +
          (need ? '<button type="button" class="ofd-btn ofd-btn-ghost" data-act="creative">' + (img ? 'Change or regenerate image' : 'Add creative') + '</button><p class="ofe-note">Opens the campaign’s creative editor, where you can attach your own image or generate a new one.</p>' : '') +
        '</div>';
      }
      if (k === 'copy') {
        var fields = P.copyFields(work, p);
        if (!fields.length) return '<p class="ofe-empty">This campaign has no editable copy fields.</p>';
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
      if (k === 'audience') {
        var tg = P.targeting(work, p);
        return '<dl class="ofe-dl">' +
          row('Sent to ' + PROVIDER[p], esc(tg.sent), tg.note) +
          (s.audienceText ? row('Audience description', esc(trunc(s.audienceText, 400)), 'Written by OrivenAI to guide copy.') : '') +
        '</dl>';
      }
      if (k === 'budget') {
        var b = P.budget(work, p);
        return '<dl class="ofe-dl">' +
          row('Daily budget', esc(P.budgetLabel(work, p)) + ' <button type="button" class="ofd-btn ofd-btn-ghost ofe-inline" data-act="budget">' + (b.source === 'set' ? 'Change' : 'Set budget') + '</button>',
            b.source === 'missing' ? 'Required before Google Ads can publish.' : (b.adjusted ? 'The stored value is adjusted to ' + b.applied + ' by ' + PLAT[p] + '’s minimum.' : 'Charged in your ad account’s currency.')) +
          row('Schedule', 'Starts when you activate it', 'OrivenAI creates the campaign paused on ' + PROVIDER[p] + '. There is no end date.') +
        '</dl>';
      }
      if (k === 'destination') {
        var u = P.url(work, p);
        var err = u ? P.validateUrl(u) : null;
        return '<div class="ofe-field"><label for="ofeUrl">Destination URL</label>' +
          '<input id="ofeUrl" class="ofd-input" type="url" inputmode="url" placeholder="https://yourshop.com/offer" value="' + esc(u) + '" aria-describedby="ofeUrlHint ofeUrlErr"' + (err ? ' aria-invalid="true"' : '') + '>' +
          '<p class="ofe-note" id="ofeUrlHint">Where people land after clicking the ad. Required before publishing.</p>' +
          '<p class="ofd-err" id="ofeUrlErr" role="alert"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p></div>' +
          '<dl class="ofe-dl">' + row('Tracking', p === 'meta' ? 'Meta Pixel' : 'Platform conversion tracking',
            p === 'meta' ? 'Sales and Leads objectives need a Meta Pixel on your ad account. OrivenAI checks for one when publishing.' : 'OrivenAI doesn’t verify conversion tracking yet. ' + PROVIDER[p] + ' checks it during ad review.') + '</dl>';
      }
      if (k === 'platform') {
        var o = platObj(work, p);
        var rows = [];
        if (p === 'meta') rows.push(row('Placements', esc(o.placement === 'instagram_only' ? 'Instagram only' : 'Facebook and Instagram')));
        if (p === 'google') rows.push(row('Campaign type', esc(googleType(work).replace(/_/g, ' ').toLowerCase().replace(/^\w/, function (c) { return c.toUpperCase(); }))));
        if (p === 'google' && googleType(work) === 'SEARCH') rows.push(row('Keywords', esc(((o.keywords || []).filter(Boolean).slice(0, 12).join(', ')) || 'None')));
        if (p === 'tiktok') rows.push(row('Identity', 'The TikTok identity selected in Connections'));
        if (p === 'pinterest') rows.push(row('Format', esc(o.creativeType === 'video' ? 'Video pin' : 'Image pin')));
        rows.push(row('Objective', esc(s.goal || 'Not set'), 'Translated to ' + PROVIDER[p] + '’s matching objective when publishing.'));
        return '<dl class="ofe-dl">' + rows.join('') + '</dl><p class="ofe-note">Other platform settings are edited in the campaign’s review screen. <button type="button" class="ofd-btn ofd-btn-ghost ofe-inline" data-act="review">Open review screen</button></p>';
      }
      if (k === 'readiness') {
        var list = P.issues(work, p);
        if (!list.length) return '<p class="ofe-ok">Everything this ad needs is in place. Account and connection checks run in Launch.</p>';
        return '<ul class="ofe-issues">' + list.map(function (i) {
          return '<li class="ofe-issue ofe-issue-' + (i.blocker ? 'req' : 'opt') + '"><span class="ofe-issue-tag">' + (i.blocker ? 'Required' : 'Optional') + '</span> ' + esc(i.label) +
            ' <button type="button" class="ofd-btn ofd-btn-ghost ofe-inline" data-sec-go="' + (i.key === 'budget' ? 'budget' : i.key) + '">Fix</button></li>';
        }).join('') + '</ul>';
      }
      return '';
    }
    function render(k) {
      cur = k || cur;
      d.setBody('<div class="ofe-wrap">' + nav() + '<div class="ofe-main" tabindex="-1"><h3 class="ofe-h">' + esc(SECTIONS.filter(function (s) { return s.k === cur; })[0].t) + '</h3>' + sectionHtml(cur) + '</div></div>');
      bind();
    }
    function bind() {
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
          markDirty();
        });
      });
      var url = d.body.querySelector('#ofeUrl');
      if (url) {
        url.addEventListener('input', function () {
          strat(work, true).landingPageUrl = url.value.trim();
          markDirty();
        });
        url.addEventListener('blur', function () {
          var e = url.value.trim() ? P.validateUrl(url.value) : 'Enter the page people land on after clicking the ad.';
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
              F.openBudget(campId, { onSaved: function () { camp = F.findCampaign(campId) || camp; work = clone(camp.pkg); render('budget'); } });
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
        title: 'Publish to ' + (PLAT[p] || p) + '?', eyebrow: 'Confirm publish', alert: true,
        onClose: function (r) { finish(!!r); },
        body: '<p class="ofd-muted">Checking your ' + esc(PROVIDER[p] || p) + ' account…</p>',
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: function (api) { api.close(false); } },
          { label: 'Publish', kind: 'primary', disabled: true, onClick: function () {} }
        ]
      });
      F.account(p).then(function (acct) {
        var tg = P.targeting(pkg, p);
        var cur = acct && acct.currency;
        var acctTxt = acct && (acct.name || acct.id) ? (acct.name ? acct.name + (acct.id ? ' · ' + acct.id : '') : acct.id) : 'No ad account selected';
        var blocked = issues.length > 0 || !(acct && acct.connected) || !(acct && (acct.name || acct.id));
        var dl =
          '<dl class="ofe-dl ofd-summary">' +
            '<div class="ofe-row"><dt>Campaign</dt><dd>' + esc(o.name || pkg.campaignName || 'Untitled campaign') + '</dd></div>' +
            '<div class="ofe-row"><dt>Platform</dt><dd>' + esc(PLAT[p] || p) + '</dd></div>' +
            '<div class="ofe-row"><dt>Ad account</dt><dd>' + esc(acctTxt) + '</dd></div>' +
            '<div class="ofe-row"><dt>Daily budget</dt><dd>' + esc(P.budgetLabel(pkg, p, cur)) + '</dd></div>' +
            '<div class="ofe-row"><dt>Schedule</dt><dd>Created paused — starts when you activate it on ' + esc(PROVIDER[p]) + '</dd></div>' +
            '<div class="ofe-row"><dt>Targeting</dt><dd>' + esc(tg.sent) + '</dd></div>' +
            (o.structure ? '<div class="ofe-row"><dt>Structure</dt><dd>' + esc(o.structure) + '</dd></div>' : '') +
          '</dl>';
        var warn = issues.length
          ? '<p class="ofd-err" role="alert">Fix before publishing: ' + esc(issues.map(function (i) { return i.label; }).join(', ')) + '.</p>'
          : (!(acct && acct.connected) ? '<p class="ofd-err" role="alert">' + esc(PLAT[p]) + ' isn’t connected. Connect it in Business → Connections.</p>'
          : (!(acct.name || acct.id) ? '<p class="ofd-err" role="alert">Select an ad account in Business → Connections first.</p>' : ''));
        d.setBody(dl + warn + '<p class="ofd-muted">This creates real campaign objects on ' + esc(PROVIDER[p]) + '. Nothing spends until you activate the campaign there.</p>');
        d.setActions([
          { label: 'Cancel', kind: 'ghost', onClick: function (api) { api.close(false); } },
          { label: 'Publish paused campaign', kind: 'primary', disabled: blocked, onClick: function (api) { api.close(true); } }
        ]);
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
    return F.confirm({
      eyebrow: name, title: (toPause ? 'Pause' : 'Resume') + ' “' + trunc(o.name || 'this campaign', 60) + '”?',
      body: toPause
        ? '<p>' + esc(PROVIDER[p] || p) + ' stops delivering this campaign’s ads. Nothing is deleted, and you can resume it from OrivenAI.</p>'
        : '<p>' + esc(PROVIDER[p] || p) + ' starts delivering again and spends at the campaign’s daily budget.</p>',
      confirmLabel: toPause ? 'Pause campaign' : 'Resume campaign',
      busyLabel: toPause ? 'Pausing…' : 'Resuming…',
      run: o.run
    });
  };
  F.confirmRemove = function (o) {
    var p = o.platform, name = PLAT[p] || p || 'the platform';
    var onProvider = !!o.externalId || !!o.manual;
    var body = o.manual
      ? '<p>This removes OrivenAI’s record only. The ad on ' + esc(name) + ' isn’t changed.</p>'
      : onProvider
        ? '<p>This removes the campaign from OrivenAI on every device. <strong>It stays on ' + esc(name) + '</strong>' +
          (o.providerStatus ? ' (currently ' + esc(o.providerStatus) + ')' : '') + ' — pause or delete it there if you don’t want it to run.</p>'
        : '<p>This deletes the draft from OrivenAI on every device. Nothing was ever sent to ' + esc(name) + '.</p>';
    return F.confirm({ eyebrow: 'Campaigns', title: (onProvider ? 'Remove “' : 'Delete “') + trunc(o.name || 'this campaign', 60) + '” from OrivenAI?',
      body: body, confirmLabel: onProvider ? 'Remove from OrivenAI' : 'Delete draft', danger: true });
  };
  F.confirmArchive = function (o) {
    var name = PLAT[o.platform] || o.platform || 'the platform';
    return F.confirm({ eyebrow: 'Campaigns', title: 'Archive “' + trunc(o.name || 'this campaign', 60) + '”?',
      body: '<p>This moves it out of OrivenAI’s active lists. The campaign on ' + esc(name) + ' isn’t paused or changed.</p>',
      confirmLabel: 'Archive in OrivenAI' });
  };
  F.confirmDisconnect = function (p, run) {
    var name = PLAT[p] || p;
    return F.confirm({ eyebrow: 'Connections', title: 'Disconnect ' + name + '?',
      body: '<p>OrivenAI stops reading performance from ' + esc(name) + ' and can’t publish, pause or resume campaigns there. Autopilot rules for ' + esc(name) + ' stop running.</p>' +
        '<p><strong>Campaigns already on ' + esc(name) + ' keep running</strong> — disconnecting doesn’t pause them. Your OrivenAI campaign data is kept.</p>',
      confirmLabel: 'Disconnect', danger: true, busyLabel: 'Disconnecting…', run: run });
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
      return { ok: true, title: live ? 'Live on ' + PLAT[p] : 'Created on ' + PLAT[p],
        message: live ? PROVIDER[p] + ' confirmed the campaign is live.' : PROVIDER[p] + ' created the campaign paused. Activate it on ' + PROVIDER[p] + ' when you’re ready.' };
    }
    var model = F.error({ status: res && res.status, body: res && res.data, error: err, phase: 'publish' });
    return { ok: false, title: model.title, message: model.message, retry: model.retry, kind: model.kind };
  };
})();
