/* ════════════════════════════════════════════════════════════════
   OrivenAI — Campaign settings review (window.OrivenSpec)

   The backend builds one complete, validated campaign spec per platform
   (POST /api/campaigns/spec — services/campaignSpec.js). This module shows
   it and edits it:
     • load(pkg, platform, {changes})  → spec, issues, account options; with
       `changes`, the server applies them under the same rules as Oriven Chat
       and returns the updated package (nothing is stored server-side).
     • forCampaign(camp)               → cached result for Launch readiness;
       fetches in the background and calls _orvReadinessChanged when ready.
     • render(host, state)             → sectioned review with progressive
       disclosure, a source badge per setting (auto / your choice / business
       profile / AI suggestion / missing / not supported / invalid) and
       inline editors for the settings the user controls.
   Nothing here publishes or spends.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var S = window.OrivenSpec = window.OrivenSpec || {};
  var choices = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(o) { var s = ''; try { s = JSON.stringify(o); } catch (_) {} var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
  S.esc = esc;
  // Text in the user's language (js/specI18n.js).
  function T(k, v) { return window.orvTx ? window.orvTx(k, v) : k; }
  var meta_ = function (p) { return p === 'meta' ? 'meta' : 'group'; };
  function groupsText(p, n) { return n === 1 ? T(p === 'meta' ? 'lch_nAdSet1' : 'lch_nAdGroup1') : T(p === 'meta' ? 'lch_nAdSets' : 'lch_nAdGroups', { n: n }); }
  function adsText(n) { return n === 1 ? T('lch_nAd1') : T('lch_nAds', { n: n }); }
  function goalLabel(g) { var k = 'ocs_goal_' + g, s = T(k); return s && s !== k ? s : g; }

  // ── Loading ──────────────────────────────────────────────────────
  S.load = function (pkg, platform, opts) {
    opts = opts || {};
    if (typeof window.apiFetch !== 'function') return Promise.resolve({ error: T('ocs_notReady') });
    var body = { pkg: pkg, platform: platform, choices: !choices };
    if (opts.changes) body.changes = opts.changes;
    if (opts.refresh) body.refresh = true;
    if (opts.campId) body.campId = String(opts.campId);
    return window.apiFetch('/api/campaigns/spec', { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
      var d = r && r.data;
      if (!r || !r.ok || !d || !d.ok) return { error: (d && d.error) || T('ocs_couldntCheck'), status: r && r.status };
      if (d.choices) choices = d.choices;
      return d;
    }).catch(function (e) { return { error: (e && e.message) || T('ocs_couldntCheck') }; });
  };
  S.choices = function () { return choices; };

  // Per-campaign cache for Launch readiness (js/launchReadiness.js). The key
  // is the package content + the platform's account epoch + a per-campaign
  // nonce, so a result is reused only while neither the campaign nor the
  // ad account changed:
  //   invalidatePlatform(p) — the account changed (Page, pixel, identity,
  //     reconnect): the next check for p is run LIVE on the server;
  //   refresh(camp)         — re-check this campaign live now (popup open, Retry);
  //   reset()               — signed out / another account.
  // A failed check is never kept as an answer: it is retried after 15 s.
  var cache = {}, inflight = {}, epoch = {}, liveDone = {}, nonce = {};
  var ERR_TTL = 15000;
  function keyOf(camp, p) { return hash([p, camp.pkg, epoch[p] || 0, nonce[camp.id] || 0]); }
  function fetchFor(camp, p, k, live) {
    inflight[camp.id] = k;
    S.load(camp.pkg, p, { refresh: live, campId: camp.id }).then(function (res) {
      if (inflight[camp.id] !== k) return;
      delete inflight[camp.id];
      cache[camp.id] = { key: k, res: res, at: Date.now(), live: !!live, ph: hash([p, camp.pkg]) };
      if (typeof window._orvReadinessChanged === 'function') window._orvReadinessChanged(camp.id);
    });
  }
  S.forCampaign = function (camp) {
    if (!camp || !camp.id || !camp.pkg) return null;
    var p = camp.platform || camp.pkg.platform;
    var k = keyOf(camp, p);
    var c = cache[camp.id];
    if (c && c.key === k && !(c.res && c.res.error && Date.now() - c.at > ERR_TTL)) return c.res;
    if (inflight[camp.id] !== k) {
      var ek = p + '|' + (epoch[p] || 0);
      var live = !liveDone[ek]; liveDone[ek] = true; // first check after an account change runs live
      fetchFor(camp, p, k, live);
    }
    return null;
  };
  S.refresh = function (camp) {
    if (!camp || !camp.id || !camp.pkg) return;
    var p = camp.platform || camp.pkg.platform;
    var c = cache[camp.id];
    // Just checked live (popup reopened within 20 s): reuse that answer.
    if (c && c.live && c.key === keyOf(camp, p) && !(c.res && c.res.error) && Date.now() - c.at < 20000) return;
    nonce[camp.id] = (nonce[camp.id] || 0) + 1;
    fetchFor(camp, p, keyOf(camp, p), true);
  };
  S.invalidatePlatform = function (p) { epoch[p] = (epoch[p] || 0) + 1; };
  S.invalidateAll = function () { ['meta', 'google', 'tiktok', 'pinterest'].forEach(S.invalidatePlatform); };
  S.reset = function () { cache = {}; inflight = {}; epoch = {}; liveDone = {}; nonce = {}; };
  S.peek = function (camp) { var c = camp && cache[camp.id]; return c ? c.res : null; };
  // The previous answer for exactly this campaign content, while its re-check
  // (account change, periodic refresh) is running — shown so the card doesn't
  // flicker back to "checking"; never used to publish (js/launchReadiness.js).
  S.lastKnown = function (camp) {
    if (!camp || !camp.id || !camp.pkg || !inflight[camp.id]) return null;
    var c = cache[camp.id], p = camp.platform || camp.pkg.platform;
    return c && c.res && !c.res.error && c.ph === hash([p, camp.pkg]) ? c.res : null;
  };
  S.remember = function (camp, res) { if (camp && camp.id && camp.pkg && res && !res.error) { var p = camp.platform || camp.pkg.platform; cache[camp.id] = { key: keyOf(camp, p), res: res, at: Date.now() }; } };
  S.errors = function (res) { return (res && res.issues || []).filter(function (i) { return i.level === 'error'; }); };

  // ── Labels ───────────────────────────────────────────────────────
  var PLAT = { meta: 'Meta', google: 'Google Ads', tiktok: 'TikTok', pinterest: 'Pinterest' };
  var CAT_KEYS = ['HOUSING', 'EMPLOYMENT', 'FINANCIAL_PRODUCTS_SERVICES', 'ISSUES_ELECTIONS_POLITICS'];
  function catLabel(c) { return CAT_KEYS.indexOf(c) >= 0 ? T('ocs_cat_' + c) : pretty(c); }
  var BADGE = {
    user: ['ocs_b_user', 'user'], profile: ['ocs_b_profile', 'profile'], auto: ['ocs_b_auto', 'auto'], ai: ['ocs_b_ai', 'ai'],
    missing: ['ocs_b_missing', 'missing'], unsupported: ['ocs_b_unsupported', 'unsupported'], invalid: ['ocs_b_invalid', 'invalid']
  };
  function autoBadge(k) { return '<span class="ocs-badge ocs-b-' + BADGE[k][1] + '">' + esc(T(BADGE[k][0])) + '</span>'; }
  function pretty(s) { return String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, function (c) { return c.toUpperCase(); }); }
  function countryName(iso) { var c = choices && choices.countries.filter(function (x) { return x.iso === iso; })[0]; return c ? c.name : iso; }
  function langName(code) { var l = choices && choices.languages.filter(function (x) { return x.code === code; })[0]; return l ? l.name : code; }
  function money(v, cur) { if (v == null) return ''; return cur ? v + ' ' + cur : String(v); }

  // Which sections each issue field belongs to (for counts + "Fix" jumps).
  var SECTION_OF = [
    [/^campaign\.goal|^campaignType/, 'objective'], [/^budget/, 'budget'], [/^targeting/, 'targeting'],
    [/^tracking\.(pixelId|conversion)/, 'tracking'], [/^tracking\./, 'destination'], [/^compliance|^campaign\.specialAdCategories/, 'compliance'],
    [/^identity/, 'identity'], [/^assets\.(sitelinks|callouts|structuredSnippet|negativeKeywords|businessName|logo)/, 'assets'],
    [/^assets|^creative|^pin\./, 'ads'], [/./, 'advanced']
  ];
  function sectionOf(field) { for (var i = 0; i < SECTION_OF.length; i++) if (SECTION_OF[i][0].test(field || '')) return SECTION_OF[i][1]; return 'advanced'; }
  S.sectionOf = sectionOf;

  // ── Render ───────────────────────────────────────────────────────
  // state: { pkg, platform, res, onChange(changes) → Promise, open: {sec:true} }
  S.render = function (host, state) {
    if (!host) return;
    var res = state.res;
    if (!res) { host.innerHTML = '<p class="ocs-loading" role="status">' + esc(T('ocs_loading')) + '</p>'; return; }
    if (res.error) {
      host.innerHTML = '<div class="ocs-fail" role="alert"><p>' + esc(res.error) + '</p><button type="button" class="ofd-btn ofd-btn-ghost" data-ocs-retry>' + esc(T('ocs_tryAgain')) + '</button></div>';
      var rb = host.querySelector('[data-ocs-retry]'); if (rb) rb.addEventListener('click', function () { if (state.onRetry) state.onRetry(); });
      return;
    }
    var spec = res.spec, issues = res.issues || [], opt = res.options || {}, p = state.platform, src = spec.sources || {};
    state.open = state.open || {};
    // Result of the last edit: a refused change keeps its editor open with
    // the reason; an applied one closes it.
    var edErr = null;
    if (res.rejected && res.rejected.length && state.openEd) edErr = res.rejected.map(function (x) { return window.orvTx && orvTx.rejection ? orvTx.rejection(x) : x.reason; }).join(' ');
    else if (res.applied && res.applied.length) state.openEd = null;
    // The server's issue text in the user's language (js/serverI18n.js).
    function msgOf(i) { return window.orvTx && orvTx.issue ? orvTx.issue(i) : i.message; }
    var bySec = {};
    issues.forEach(function (i) { if (i.level === 'info') return; var k = sectionOf(i.field); (bySec[k] = bySec[k] || []).push(i); });
    function issuesFor(re) { return issues.filter(function (i) { return i.level !== 'info' && re.test(i.field || ''); }); }
    function badge(source, fieldRe) {
      var bad = fieldRe ? issuesFor(fieldRe).filter(function (i) { return i.level === 'error'; }) : [];
      var b = bad.length ? (source === 'missing' || /missing|none|unconfirmed|choose/.test(bad[0].code) ? BADGE.missing : BADGE.invalid) : (BADGE[source] || BADGE.auto);
      return '<span class="ocs-badge ocs-b-' + b[1] + '">' + esc(T(b[0])) + '</span>';
    }
    function fieldIssues(re) {
      var list = issuesFor(re);
      return list.length ? '<ul class="ocs-fi">' + list.map(function (i) { return '<li class="ocs-fi-' + i.level + '">' + esc(msgOf(i)) + '</li>'; }).join('') + '</ul>' : '';
    }
    function row(label, value, b, extra) {
      return '<div class="ocs-row"><dt>' + esc(label) + (b || '') + '</dt><dd>' + value + (extra || '') + '</dd></div>';
    }
    function editor(id, inner, applyLabel) {
      return '<details class="ocs-ed"' + (state.openEd === id ? ' open' : '') + ' data-ed="' + id + '"><summary>' + esc(T('ocs_change')) + '</summary><div class="ocs-ed-body">' + inner +
        (edErr && state.openEd === id ? '<p class="ocs-ed-err" role="alert">' + esc(edErr) + '</p>' : '') +
        '<div class="ocs-ed-act"><button type="button" class="ofd-btn ofd-btn-primary ocs-apply" data-apply="' + id + '">' + esc(applyLabel || T('ocs_apply')) + '</button></div></div></details>';
    }
    function select(name, list, cur, labelFn) {
      return '<select class="ofd-input" name="' + name + '">' + list.map(function (v) {
        var val = typeof v === 'object' ? v.v : v, lab = typeof v === 'object' ? v.l : (labelFn ? labelFn(v) : v);
        return '<option value="' + esc(val) + '"' + (String(val) === String(cur) ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('') + '</select>';
    }
    function section(k, title, body, sub) {
      var n = (bySec[k] || []).filter(function (i) { return i.level === 'error'; }).length;
      var w = (bySec[k] || []).length - n;
      var open = state.open[k] != null ? state.open[k] : n > 0;
      return '<details class="ocs-sec" data-sec="' + k + '"' + (open ? ' open' : '') + '><summary><span class="ocs-sec-t">' + esc(title) + '</span>' +
        (sub ? '<span class="ocs-sec-sub">' + esc(sub) + '</span>' : '') +
        (n ? '<span class="ocs-count ocs-count-err">' + esc(T('ocs_toFix', { n: n })) + '</span>' : w ? '<span class="ocs-count ocs-count-warn">' + esc(T('ocs_toCheck', { n: w })) + '</span>' : '<span class="ocs-count ocs-count-ok">' + esc(T('ocs_ok')) + '</span>') +
        '</summary><dl class="ocs-dl">' + body + '</dl></details>';
    }

    var errs = issues.filter(function (i) { return i.level === 'error'; });
    var warns = issues.filter(function (i) { return i.level === 'warning'; });
    var html = '';
    html += '<div class="ocs-head ' + (errs.length ? 'ocs-head-err' : 'ocs-head-ok') + '" role="status">' +
      '<strong>' + esc(errs.length ? (errs.length === 1 ? T('ocs_headErr1') : T('ocs_headErrN', { n: errs.length })) : T('ocs_headOk')) + '</strong>' +
      '<span>' + esc(T(errs.length ? 'ocs_headErrSub' : 'ocs_headOkSub', { platform: PLAT[p] }) + (warns.length ? ' ' + (warns.length === 1 ? T('ocs_optional1') : T('ocs_optionalN', { n: warns.length })) : '')) + '</span></div>';
    if (errs.length) {
      html += '<ul class="ocs-todo">' + errs.map(function (i) {
        return '<li><span>' + esc(msgOf(i)) + '</span><button type="button" class="ofd-btn ofd-btn-ghost ocs-go" data-go="' + sectionOf(i.field) + '">' + esc(T('ocs_fix')) + '</button></li>';
      }).join('') + '</ul>';
    }

    // Overview / objective
    var goals = p === 'tiktok' && choices ? choices.tiktokGoals : (choices ? choices.goals : ['Sales', 'Leads', 'Traffic', 'Awareness']);
    var structure = groupsText(p, spec.adGroups.length) + ' · ' +
      adsText(spec.adGroups.reduce(function (n, g) { return n + (g.ads ? g.ads.length : 0); }, 0));
    var inCreate = '<span class="ocs-badge ocs-b-auto">' + esc(T('ocs_chosenInCreate')) + '</span>';
    html += section('objective', T('ocs_secObjective'), [
      row(T('ocs_status'), esc(T('ocs_paused')), '<span class="ocs-badge ocs-b-auto">' + esc(T('ocs_always')) + '</span>', '<p class="ocs-note">' + esc(T('ocs_statusNote', { platform: PLAT[p] })) + '</p>'),
      p === 'google' ? row(T('ocs_campaignType'), esc(pretty(spec.campaignType)), inCreate, fieldIssues(/^campaignType/)) : '',
      row(T('ocs_objective'), esc(goalLabel(spec.campaign.goal)) + (spec.campaign.objective ? ' <span class="ocs-code">' + esc(spec.campaign.objective) + '</span>' : ''), autoBadge('user'),
        fieldIssues(/^campaign\.goal/) + editor('goal', '<label class="ocs-lbl">' + esc(T('ocs_objective')) + select('goal', goals, spec.campaign.goal, goalLabel) + '</label>' +
          (p === 'tiktok' ? '<p class="ocs-note">' + esc(T('ocs_ttGoalsNote')) + '</p>' : '') +
          '<p class="ocs-note">' + esc(T('ocs_followNote')) + '</p>')),
      spec.optimization ? row(T('ocs_optimisation'), esc([spec.optimization.goal, spec.optimization.billingEvent || spec.optimization.billableEvent].filter(Boolean).map(pretty).join(' · ')), autoBadge('auto')) : '',
      p === 'google' && spec.campaign.bidStrategyLabel ? row(T('ocs_bidding'), esc(spec.campaign.bidStrategyLabel), autoBadge('auto')) : '',
      row(T('ocs_structure'), esc(structure), inCreate)
    ].join(''), goalLabel(spec.campaign.goal));

    // Budget
    html += section('budget', T('ocs_secBudget'), [
      row(T('ocs_dailyBudget'), spec.budget.amount != null ? esc(T('ocs_perDayVal', { amount: money(spec.budget.amount, spec.budget.currency) })) : '<span class="ocs-miss">' + esc(T('ocs_notSet')) + '</span>' + (spec.budget.suggestion ? ' <span class="ocs-sugg">' + esc(T('ocs_aiSuggestion', { amount: money(spec.budget.suggestion, spec.budget.currency) })) + '</span>' : ''),
        badge(spec.sources.budget === 'user' ? 'user' : 'missing', /^budget/),
        fieldIssues(/^budget/) + editor('budget', '<label class="ocs-lbl">' + esc(T('ocs_amountPerDay')) + (spec.budget.currency ? ' (' + esc(spec.budget.currency) + ')' : '') +
          '<input class="ofd-input" type="number" inputmode="decimal" min="' + (p === 'tiktok' && choices ? choices.tiktokMinDaily + 1 : 1) + '" step="0.01" name="budget" value="' + esc(spec.budget.amount != null ? spec.budget.amount : (spec.budget.suggestion || '')) + '"></label>' +
          '<p class="ocs-note">' + esc((p === 'tiktok' ? T('ocs_ttMin', { n: choices ? choices.tiktokMinDaily : 20 }) + ' ' : '') + T('ocs_budgetNote')) + '</p>', T('ocs_saveBudget'))),
      row(T('ocs_budgetLevel'), esc(T(spec.campaign.budgetLevel === 'AD_GROUP' ? 'ocs_lvlAdGroup' : spec.campaign.budgetLevel === 'AD_SET' ? 'ocs_lvlAdSet' : 'ocs_lvlCampaign')), autoBadge('auto')),
      row(T('ocs_schedule'), esc(T('ocs_runsContinuously')), autoBadge('auto'))
    ].join(''), spec.budget.amount != null ? T('ocs_perDayShort', { amount: money(spec.budget.amount, spec.budget.currency) }) : T('ocs_notSet'));

    // Targeting
    var cList = spec.targeting.countries || [];
    var countriesEd = '<div class="ocs-chips" data-chips="countries">' + cList.map(function (c) {
      return '<span class="ocs-chip" data-v="' + esc(c) + '">' + esc(countryName(c)) + '<button type="button" aria-label="' + esc(T('ocs_removeX', { name: countryName(c) })) + '" data-chip-x>×</button></span>';
    }).join('') + '</div>' +
      '<label class="ocs-lbl">' + esc(T('ocs_addCountry')) + select('countryAdd', [{ v: '', l: T('ocs_chooseCountry') }].concat((choices ? choices.countries : []).filter(function (c) { return cList.indexOf(c.iso) < 0; }).map(function (c) { return { v: c.iso, l: p === 'pinterest' && !c.pinterest ? T('ocs_notPinMarket', { name: c.name }) : c.name }; })), '') + '</label>' +
      '<p class="ocs-note">' + esc(T('ocs_countriesNote')) + '</p>';
    var lList = spec.targeting.languages || [];
    var langEd = '<label class="ocs-lbl">' + esc(T('ocs_langsLabel')) + '<select class="ofd-input" name="languages" multiple size="5">' + (choices ? choices.languages : []).map(function (l) {
      return '<option value="' + esc(l.code) + '"' + (lList.indexOf(l.code) >= 0 ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    }).join('') + '</select></label>';
    var hasAge = p === 'meta' || p === 'tiktok';
    var ageOpts = []; for (var a = 18; a <= 65; a++) ageOpts.push({ v: a, l: a === 65 ? '65+' : String(a) });
    html += section('targeting', T('ocs_secTargeting'), [
      row(T('ocs_countries'), cList.length ? esc(cList.map(countryName).join(', ')) : '<span class="ocs-miss">' + esc(T('ocs_chooseOneCountry')) + '</span>', badge(src.countries, /^targeting\.countries/),
        fieldIssues(/^targeting\.countries/) + editor('countries', countriesEd, T('ocs_saveCountries'))),
      row(T('ocs_languages'), lList.length ? esc(lList.map(langName).join(', ')) : esc(T('ocs_allLanguages')), badge(src.languages, /^targeting\.languages/), editor('languages', langEd, T('ocs_saveLanguages'))),
      hasAge ? row(T('ocs_ages'), esc(spec.targeting.ageMin + '–' + spec.targeting.ageMax + (spec.targeting.ageMax === 65 ? '+' : '')), badge(src.age, /^targeting\.age/),
        fieldIssues(/^targeting\.age/) + editor('age', '<div class="ocs-pair"><label class="ocs-lbl">' + esc(T('ocs_from')) + select('ageMin', ageOpts, spec.targeting.ageMin) + '</label><label class="ocs-lbl">' + esc(T('ocs_to')) + select('ageMax', ageOpts, spec.targeting.ageMax) + '</label></div>', T('ocs_saveAges'))) : '',
      p === 'meta' ? row(T('ocs_placements'), esc(spec.targeting.placementLabel), badge(src.placement), editor('placement', '<label class="ocs-lbl">' + esc(T('ocs_placements')) + select('placement', Object.keys(choices ? choices.metaPlacements : { automatic: 1 }).map(function (k) { return { v: k, l: choices ? choices.metaPlacements[k] : k }; }), spec.targeting.placement) + '</label>', T('ocs_savePlacements'))) : '',
      p === 'meta' ? row(T('ocs_advantage'), esc(T(spec.targeting.advantageAudience ? 'ocs_advOn' : 'ocs_advOff')), autoBadge('auto'), '<p class="ocs-note">' + esc(T('ocs_countriesHard')) + '</p>') : '',
      p === 'tiktok' ? row(T('ocs_placement'), esc(T('ocs_ttFeed')), autoBadge('auto')) : '',
      p === 'google' && spec.campaignType === 'SEARCH' ? row(T('ocs_networks'), esc(T('ocs_searchNetworks')), autoBadge('auto')) : '',
      spec.suggestions && spec.suggestions.audienceDescription ? row(T('ocs_audienceIdea'), esc(spec.suggestions.audienceDescription), autoBadge('ai'), '<p class="ocs-note">' + esc(T('ocs_audienceIdeaNote')) + '</p>') : ''
    ].join(''), cList.length ? cList.map(countryName).join(', ') : T('ocs_countryNeeded'));

    // Ad sets / groups + ads
    var canGroups = !(p === 'google' && spec.campaignType !== 'SEARCH');
    var groupsHtml = spec.adGroups.map(function (g, i) {
      var ages = g.ageMin != null ? ' · ' + T('ocs_groupAges', { from: g.ageMin, to: g.ageMax }) : '';
      var ads = (g.ads || []).map(function (ad) { return '<li>' + esc(ad.name) + (ad.headline ? ' — “' + esc(ad.headline) + '”' : '') + '</li>'; }).join('');
      var kw = g.keywords && g.keywords.length ? '<p class="ocs-note">' + esc(T('ocs_keywords', { list: g.keywords.map(function (k) { return k.text + (k.matchType && k.matchType !== 'BROAD' ? ' (' + pretty(k.matchType) + ')' : ''); }).join(', ') })) + '</p>' : '';
      return '<div class="ocs-group"><div class="ocs-group-h"><strong>' + esc(g.name) + '</strong><span>' + esc(ages) + '</span>' +
        (canGroups && spec.adGroups.length > 1 ? '<button type="button" class="ofd-btn ofd-btn-ghost ocs-mini" data-remove-group="' + i + '">' + esc(T('ocs_remove')) + '</button>' : '') + '</div>' + kw + '<ul class="ocs-ads">' + ads + '</ul></div>';
    }).join('');
    html += section('ads', T('ocs_secAds_' + meta_(p)), [
      '<div class="ocs-groups">' + groupsHtml + '</div>',
      fieldIssues(/^(assets\.(headlines|descriptions|squareImage|landscapeImage)|creative|pin\.)/),
      p === 'tiktok' ? row(T('ocs_format'), spec.creative.format === 'VIDEO' ? esc(T('ocs_videoWithCover')) : '<span class="ocs-miss">' + esc(T('ocs_videoNeeded')) + '</span>', badge(spec.creative.format === 'VIDEO' ? 'auto' : 'unsupported', /^creative\.video/)) : '',
      p === 'google' && spec.campaignType === 'PERFORMANCE_MAX' ? row(T('ocs_landscape'), spec.assets.landscapeImageUrl ? esc(T('ocs_landscapeReady')) : '<span class="ocs-miss">' + esc(T('ocs_missing')) + '</span>', badge(spec.assets.landscapeImageUrl ? 'auto' : 'missing', /^assets\.landscapeImage/)) : '',
      canGroups && spec.adGroups.length < 5 ? editor('addGroup', '<label class="ocs-lbl">' + esc(T('ocs_name')) + '<input class="ofd-input" name="groupName" maxlength="80" placeholder="' + esc(T('ocs_groupPh_' + meta_(p), { n: spec.adGroups.length + 1 })) + '"></label>' +
        (hasAge ? '<div class="ocs-pair"><label class="ocs-lbl">' + esc(T('ocs_agesFrom')) + select('gAgeMin', ageOpts, spec.targeting.ageMin) + '</label><label class="ocs-lbl">' + esc(T('ocs_toLower')) + select('gAgeMax', ageOpts, spec.targeting.ageMax) + '</label></div>' : '') +
        '<p class="ocs-note">' + esc(T('ocs_addGroupNote_' + meta_(p), { platform: PLAT[p] })) + '</p>', T('ocs_addGroup_' + meta_(p))) : ''
    ].join(''), structure);

    // Conversion tracking
    var trk = [];
    if (p === 'meta') {
      if (spec.tracking.needsConversion) {
        var px = opt.pixels || [];
        trk.push(row(T('ocs_metaPixel'), spec.tracking.pixelId ? esc((px.filter(function (x) { return x.id === spec.tracking.pixelId; })[0] || {}).name || spec.tracking.pixelId) : '<span class="ocs-miss">' + esc(T(px.length ? 'ocs_choosePixel' : 'ocs_noPixel')) + '</span>', badge(src.pixel, /^tracking\.pixelId/),
          fieldIssues(/^tracking\.pixelId/) + (px.length ? editor('pixel', '<label class="ocs-lbl">' + esc(T('ocs_pixel')) + select('pixelId', [{ v: '', l: T('ocs_choose') }].concat(px.map(function (x) { return { v: x.id, l: x.name + ' (' + x.id + ')' }; })), spec.tracking.pixelId || '') + '</label>', T('ocs_usePixel')) : '')));
        trk.push(row(T('ocs_convEvent'), esc(pretty(spec.tracking.conversionEvent)), badge(src.conversionEvent), editor('event', '<label class="ocs-lbl">' + esc(T('ocs_event')) + select('conversionEvent', (choices ? choices.metaConversionEvents : [spec.tracking.conversionEvent]), spec.tracking.conversionEvent, pretty) + '</label><p class="ocs-note">' + esc(T('ocs_eventNote')) + '</p>', T('ocs_useEvent'))));
      } else trk.push(row(T('ocs_convTracking'), esc(T('ocs_notNeededFor', { goal: goalLabel(spec.campaign.goal) })), autoBadge('auto')));
    } else if (p === 'pinterest') {
      if (spec.tracking.needsConversion) {
        var tags = opt.conversionTags || [];
        trk.push(row(T('ocs_pinTag'), spec.tracking.conversionTagId ? esc((tags.filter(function (x) { return x.id === spec.tracking.conversionTagId; })[0] || {}).name || spec.tracking.conversionTagId) : '<span class="ocs-miss">' + esc(T(tags.length ? 'ocs_chooseTag' : 'ocs_noTag')) + '</span>', badge(src.conversionTag, /^tracking\.conversionTagId/),
          fieldIssues(/^tracking\.conversionTagId/) + (tags.length ? editor('tag', '<label class="ocs-lbl">' + esc(T('ocs_tag')) + select('conversionTagId', [{ v: '', l: T('ocs_choose') }].concat(tags.map(function (x) { return { v: x.id, l: (x.name || x.id) }; })), spec.tracking.conversionTagId || '') + '</label>', T('ocs_useTag')) : '')));
        var pev = choices && choices.pinterestConversionEvents[spec.campaign.goal] || [spec.tracking.conversionEvent];
        trk.push(row(T('ocs_convEvent'), esc(pretty(spec.tracking.conversionEvent)), badge('auto'), editor('pevent', '<label class="ocs-lbl">' + esc(T('ocs_event')) + select('conversionEvent', pev, spec.tracking.conversionEvent, pretty) + '</label>', T('ocs_useEvent'))));
      } else trk.push(row(T('ocs_convTracking'), esc(T('ocs_notNeededFor', { goal: goalLabel(spec.campaign.goal) })), autoBadge('auto')));
    } else if (p === 'google') {
      var ca = spec.tracking.conversionActions;
      trk.push(row(T('ocs_convActions'), spec.tracking.needsConversion ? (ca == null ? esc(T('ocs_couldntBeChecked')) : ca ? esc(T('ocs_activeInAccount', { n: ca })) : '<span class="ocs-miss">' + esc(T('ocs_noneInAccount')) + '</span>') : esc(T('ocs_notNeededFor', { goal: goalLabel(spec.campaign.goal) })),
        badge(spec.tracking.needsConversion ? (ca ? 'auto' : 'missing') : 'auto', /^tracking\.conversion/), fieldIssues(/^tracking\.conversion/) + (spec.tracking.needsConversion ? '<p class="ocs-note">' + esc(T('ocs_gConvNote')) + '</p>' : '')));
    } else {
      trk.push(row(T('ocs_convTracking'), esc(T('ocs_ttNoConv')), autoBadge('unsupported')));
    }
    html += section('tracking', T('ocs_convTracking'), trk.join(''));

    // Destination & UTM
    var utm = spec.tracking.utm || {};
    html += section('destination', T('ocs_secDest'), [
      row(T('ocs_destUrl'), spec.tracking.destinationUrl ? '<span class="ocs-url">' + esc(spec.tracking.destinationUrl) + '</span>' : '<span class="ocs-miss">' + esc(T('ocs_missing')) + '</span>', badge(src.destinationUrl, /^tracking\.destinationUrl/),
        fieldIssues(/^tracking\.destinationUrl/) + editor('url', '<label class="ocs-lbl">' + esc(T('ocs_pageLand')) + '<input class="ofd-input" type="url" inputmode="url" name="destinationUrl" value="' + esc(spec.tracking.destinationUrl || '') + '" placeholder="https://yourshop.com/offer"></label>', T('ocs_saveUrl'))),
      row(T('ocs_utm'), '<span class="ocs-code">' + esc(spec.tracking.urlParams) + '</span>', badge(src.utm), editor('utm',
        ['source', 'medium', 'campaign', 'content'].map(function (k) { return '<label class="ocs-lbl">utm_' + k + '<input class="ofd-input" name="utm_' + k + '" maxlength="100" value="' + esc(utm[k] || '') + '"></label>'; }).join(''), T('ocs_saveUtm')))
    ].join(''));

    // Google assets
    if (p === 'google') {
      var as = spec.assets || {};
      var assetRows = [];
      if (spec.campaignType === 'SEARCH') {
        assetRows.push(row(T('ocs_negKeywords'), as.negativeKeywords.length ? esc(as.negativeKeywords.join(', ')) : esc(T('ocs_none')), badge(src.negativeKeywords),
          editor('negatives', '<label class="ocs-lbl">' + esc(T('ocs_onePerLine')) + '<textarea class="ofd-input" rows="4" name="negativeKeywords">' + esc(as.negativeKeywords.join('\n')) + '</textarea></label><p class="ocs-note">' + esc(T('ocs_negNote')) + '</p>', T('ocs_saveNegatives'))));
        assetRows.push(row(T('ocs_callouts'), as.callouts.length ? esc(as.callouts.join(' · ')) : esc(T('ocs_none')), badge('ai', /^assets\.callouts/), fieldIssues(/^assets\.callouts/) +
          editor('callouts', '<label class="ocs-lbl">' + esc(T('ocs_calloutsLabel')) + '<textarea class="ofd-input" rows="4" name="callouts">' + esc(as.callouts.join('\n')) + '</textarea></label>', T('ocs_saveCallouts'))));
        assetRows.push(row(T('ocs_snippet'), as.structuredSnippet ? esc(as.structuredSnippet.header + ': ' + as.structuredSnippet.values.join(', ')) : esc(T('ocs_none')), badge('ai', /^assets\.structuredSnippet/), fieldIssues(/^assets\.structuredSnippet/) +
          (as.structuredSnippet ? editor('snippet', '<label class="ocs-lbl">' + esc(T('ocs_header')) + select('snippetHeader', choices ? choices.googleSnippetHeaders : [as.structuredSnippet.header], as.structuredSnippet.header) + '</label>', T('ocs_saveHeader')) : '')));
        var sl = as.sitelinks || [];
        assetRows.push(row(T('ocs_sitelinks'), sl.length ? sl.map(function (x) { return esc(x.text) + (x.url ? ' → <span class="ocs-url">' + esc(x.url) + '</span>' : ' <span class="ocs-miss">' + esc(T('ocs_noPageYet')) + '</span>'); }).join('<br>') : esc(T('ocs_none')), badge(sl.length && sl.every(function (x) { return x.url; }) ? 'user' : 'ai', /^assets\.sitelinks/),
          fieldIssues(/^assets\.sitelinks/) + '<p class="ocs-note">' + esc(T('ocs_sitelinkNote')) + '</p>' +
          editor('sitelink', '<label class="ocs-lbl">' + esc(T('ocs_linkText')) + (sl.length ? select('slText', sl.map(function (x) { return x.text; }), (sl.filter(function (x) { return !x.url; })[0] || sl[0]).text) : '<input class="ofd-input" name="slText" maxlength="25">') + '</label>' +
            '<label class="ocs-lbl">' + esc(T('ocs_pageAddress')) + '<input class="ofd-input" type="url" name="slUrl" placeholder="https://yourshop.com/page"></label>', T('ocs_saveSitelink'))));
      }
      if (spec.campaignType !== 'SEARCH') {
        assetRows.push(row(T('ocs_businessName'), as.businessName ? esc(as.businessName) : '<span class="ocs-miss">' + esc(T('ocs_missing')) + '</span>', badge(src.businessName, /^assets\.businessName/), fieldIssues(/^assets\.businessName/) + '<p class="ocs-note">' + esc(T('ocs_fromProfile')) + '</p>'));
        assetRows.push(row(T('ocs_logo'), as.logoUrl ? '<img class="ocs-logo" src="' + esc(as.logoUrl) + '" alt="' + esc(T('ocs_yourLogo')) + '">' : '<span class="ocs-miss">' + esc(T('ocs_missing')) + '</span>', badge(src.logo, /^assets\.logo/), fieldIssues(/^assets\.logo/) + '<p class="ocs-note">' + esc(T('ocs_logoNote')) + '</p>'));
      }
      html += section('assets', T(spec.campaignType === 'SEARCH' ? 'ocs_secKeywords' : 'ocs_secBrand'), assetRows.join(''));
    }

    // Compliance (Meta)
    if (p === 'meta') {
      var cats = spec.campaign.specialAdCategories || [];
      var catEd = (choices ? choices.metaSpecialCategories : CAT_KEYS).map(function (c) {
        return '<label class="ocs-check"><input type="checkbox" name="cat" value="' + c + '"' + (cats.indexOf(c) >= 0 ? ' checked' : '') + '> ' + esc(catLabel(c)) + '</label>';
      }).join('') + '<p class="ocs-note">' + esc(T('ocs_catNote')) + '</p>';
      var comp = [row(T('ocs_specialCats'), spec.campaign.specialAdCategoriesConfirmed ? (cats.length ? esc(cats.map(catLabel).join(', ')) : esc(T('ocs_noneApply'))) : '<span class="ocs-miss">' + esc(T('ocs_pleaseConfirm')) + '</span>',
        badge(spec.campaign.specialAdCategoriesConfirmed ? 'user' : 'missing', /^campaign\.specialAdCategories/), fieldIssues(/^campaign\.specialAdCategories/) + editor('cats', catEd, T('ocs_confirmCats')))];
      if (spec.compliance.euTargeted) {
        comp.push(row(T('ocs_dsa'), esc(T('ocs_dsaVal', { b: spec.compliance.dsaBeneficiary || '—', p: spec.compliance.dsaPayor || '—' })), badge(src.dsa, /^compliance/),
          fieldIssues(/^compliance/) + editor('dsa', '<label class="ocs-lbl">' + esc(T('ocs_dsaWho')) + '<input class="ofd-input" name="dsaBeneficiary" maxlength="200" value="' + esc(spec.compliance.dsaBeneficiary || '') + '"></label><label class="ocs-lbl">' + esc(T('ocs_dsaPays')) + '<input class="ofd-input" name="dsaPayor" maxlength="200" value="' + esc(spec.compliance.dsaPayor || '') + '"></label>', T('ocs_save'))));
      }
      html += section('compliance', T('ocs_secCompliance'), comp.join(''));
    }

    // Identity
    var idRows = [];
    if (p === 'meta') {
      idRows.push(row(T('ocs_fbPage'), spec.identity.pageId ? esc(T('ocs_connectedPage')) : '<span class="ocs-miss">' + esc(T('ocs_notSelected')) + '</span>', badge(spec.identity.pageId ? 'auto' : 'missing', /^identity\.pageId/), fieldIssues(/^identity\.pageId/)));
      idRows.push(row(T('ocs_igAccount'), spec.identity.instagramUsername ? '@' + esc(spec.identity.instagramUsername) : (spec.targeting.placement === 'facebook_only' ? esc(T('ocs_notNeeded')) : '<span class="ocs-miss">' + esc(T('ocs_notLinked')) + '</span>'), badge(spec.identity.instagramUserId ? 'auto' : (spec.targeting.placement === 'facebook_only' ? 'auto' : 'missing'), /^identity\.instagram/), fieldIssues(/^identity\.instagram/)));
    }
    if (p === 'tiktok') idRows.push(row(T('ocs_ttIdentity'), spec.identity.displayName ? esc(spec.identity.displayName) : '<span class="ocs-miss">' + esc(T('ocs_notSelected')) + '</span>', badge(spec.identity.identityId ? 'auto' : 'missing', /^identity/), fieldIssues(/^identity/) + '<p class="ocs-note">' + esc(T('ocs_chooseInConnections')) + '</p>'));
    if (idRows.length) html += section('identity', T('ocs_secIdentity'), idRows.join(''));

    // Advanced
    html += section('advanced', T('ocs_secAdvanced'), [
      row(T('ocs_createdAs'), esc(T('ocs_createdAsVal_' + meta_(p))), '<span class="ocs-badge ocs-b-auto">' + esc(T('ocs_always')) + '</span>'),
      spec.suggestions && (spec.suggestions.retargetingIdea || spec.suggestions.lookalikeIdea) ? row(T('ocs_audienceIdeas'), esc([spec.suggestions.retargetingIdea, spec.suggestions.lookalikeIdea].filter(Boolean).join(' · ')), autoBadge('ai'), '<p class="ocs-note">' + esc(T('ocs_audienceIdeasNote', { platform: PLAT[p] })) + '</p>') : '',
      row(T('ocs_liveTesting'), esc((spec.liveUnverified || []).join(' ')), '<span class="ocs-badge ocs-b-unsupported">' + esc(T('ocs_notVerified')) + '</span>')
    ].join(''));

    host.innerHTML = '<div class="ocs">' + html + '</div>';
    bind(host, state);
  };

  function bind(host, state) {
    host.querySelectorAll('details.ocs-sec').forEach(function (d) {
      d.addEventListener('toggle', function () { state.open[d.getAttribute('data-sec')] = d.open; });
    });
    host.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = host.querySelector('details.ocs-sec[data-sec="' + b.getAttribute('data-go') + '"]');
        if (!d) return; d.open = true; state.open[d.getAttribute('data-sec')] = true;
        var ed = d.querySelector('details.ocs-ed'); if (ed) ed.open = true;
        d.scrollIntoView({ block: 'start', behavior: 'smooth' });
        var f = d.querySelector('details.ocs-ed[open] input, details.ocs-ed[open] select, details.ocs-ed[open] textarea, summary'); if (f) f.focus();
      });
    });
    host.querySelectorAll('[data-chip-x]').forEach(function (x) {
      x.addEventListener('click', function () { var c = x.closest('.ocs-chip'); if (c) c.remove(); });
    });
    host.querySelectorAll('[data-remove-group]').forEach(function (b) {
      b.addEventListener('click', function () { apply(state, { removeAdGroup: parseInt(b.getAttribute('data-remove-group'), 10) }, b); });
    });
    host.querySelectorAll('[data-apply]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-apply');
        var box = b.closest('.ocs-ed-body');
        function v(n) { var el = box.querySelector('[name="' + n + '"]'); return el ? el.value : null; }
        var ch = {};
        if (id === 'goal') ch.goal = v('goal');
        else if (id === 'budget') ch.budget = v('budget');
        else if (id === 'countries') {
          var list = Array.prototype.map.call(box.querySelectorAll('.ocs-chip'), function (c) { return c.getAttribute('data-v'); });
          if (v('countryAdd')) list.push(v('countryAdd'));
          if (!list.length) { note(b, T('ocs_chooseOneCountryDot')); return; }
          ch.countries = list;
        } else if (id === 'languages') ch.languages = Array.prototype.map.call(box.querySelector('select[name="languages"]').selectedOptions, function (o) { return o.value; });
        else if (id === 'age') { ch.ageMin = v('ageMin'); ch.ageMax = v('ageMax'); }
        else if (id === 'placement') ch.placement = v('placement');
        else if (id === 'addGroup') {
          var t = state.res && state.res.spec ? state.res.spec.targeting : {};
          var lo = v('gAgeMin') != null ? parseInt(v('gAgeMin'), 10) : null, hi = v('gAgeMax') != null ? parseInt(v('gAgeMax'), 10) : null;
          var own = lo != null && (lo !== t.ageMin || hi !== t.ageMax);
          ch.addAdGroup = { name: v('groupName') || undefined, ageMin: own ? lo : undefined, ageMax: own ? hi : undefined };
        }
        else if (id === 'pixel') { if (!v('pixelId')) { note(b, T('ocs_choosePixelDot')); return; } ch.pixelId = v('pixelId'); }
        else if (id === 'tag') { if (!v('conversionTagId')) { note(b, T('ocs_chooseTagDot')); return; } ch.conversionTagId = v('conversionTagId'); }
        else if (id === 'event' || id === 'pevent') ch.conversionEvent = v('conversionEvent');
        else if (id === 'url') ch.destinationUrl = v('destinationUrl');
        else if (id === 'utm') ch.utm = { source: v('utm_source'), medium: v('utm_medium'), campaign: v('utm_campaign'), content: v('utm_content') };
        else if (id === 'negatives') ch.negativeKeywords = lines(v('negativeKeywords'));
        else if (id === 'callouts') ch.callouts = lines(v('callouts'));
        else if (id === 'snippet') ch.snippetHeader = v('snippetHeader');
        else if (id === 'sitelink') ch.sitelink = { text: v('slText'), url: v('slUrl') };
        else if (id === 'cats') ch.specialAdCategories = Array.prototype.filter.call(box.querySelectorAll('input[name="cat"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
        else if (id === 'dsa') { ch.dsaBeneficiary = v('dsaBeneficiary'); ch.dsaPayor = v('dsaPayor'); }
        state.openEd = id;
        apply(state, ch, b);
      });
    });
  }
  function lines(s) { return String(s || '').split(/\n|,/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function note(btn, msg) {
    var box = btn.closest('.ocs-ed-body') || btn.parentNode;
    var el = box.querySelector('.ocs-ed-err');
    if (!el) { el = document.createElement('p'); el.className = 'ocs-ed-err'; el.setAttribute('role', 'alert'); box.appendChild(el); }
    el.textContent = msg;
  }
  function apply(state, changes, btn) {
    if (!state.onChange) return;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    // The caller re-renders with the result (see edErr in render).
    Promise.resolve(state.onChange(changes)).then(function (r) {
      btn.disabled = false; btn.removeAttribute('aria-busy');
      if (r && r.error && btn.isConnected) note(btn, r.error);
    });
  }

  // Replaces the old free-text Countries / Age / Language fields on the
  // review screens: those were never sent. Real targeting lives in the
  // campaign settings review.
  S.targetingLinkHtml = function (campId) {
    var id = String(campId || '').replace(/[^A-Za-z0-9_-]/g, '');
    return '<div class="crv-section ocs-tlink"><div class="crv-section-hd">' + esc(T('ocs_tlTitle')) + '</div>' +
      '<p class="ocs-note">' + esc(T('ocs_tlNote')) + '</p>' +
      (id ? '<button type="button" class="ofd-btn ofd-btn-ghost" onclick="window.orvWorkspace&&orvWorkspace.flow&&orvWorkspace.flow.openAd(\'' + id + '\',\'targeting\')">' + esc(T('ocs_openSettings')) + '</button>' : '') +
      '</div>';
  };

  // Short, plain summary lines for confirmations and the Launch checklist.
  S.summaryRows = function (res) {
    if (!res || !res.spec) return [];
    var sp = res.spec, p = sp.platform, rows = [];
    rows.push([T('ocs_objective'), goalLabel(sp.campaign.goal) + (sp.campaign.objective ? ' (' + pretty(sp.campaign.objective) + ')' : '')]);
    rows.push([T('ocs_countries'), (sp.targeting.countries || []).length ? sp.targeting.countries.map(countryName).join(', ') : T('ocs_notChosen')]);
    rows.push([T('ocs_languages'), (sp.targeting.languages || []).length ? sp.targeting.languages.map(langName).join(', ') : T('ocs_allLanguages')]);
    if (p === 'meta' || p === 'tiktok') rows.push([T('ocs_ages'), sp.targeting.ageMin + '–' + sp.targeting.ageMax + (sp.targeting.ageMax === 65 ? '+' : '')]);
    if (p === 'meta') rows.push([T('ocs_placements'), sp.targeting.placementLabel]);
    if (sp.tracking.needsConversion) rows.push([T('ocs_conversion'), p === 'meta' ? (sp.tracking.pixelId ? T('ocs_pixelVal', { id: sp.tracking.pixelId, event: pretty(sp.tracking.conversionEvent) }) : T('ocs_noPixelSel')) : p === 'pinterest' ? (sp.tracking.conversionTagId ? T('ocs_tagVal', { id: sp.tracking.conversionTagId, event: pretty(sp.tracking.conversionEvent) }) : T('ocs_noTagSel')) : (sp.tracking.conversionActions ? T('ocs_nConvActions', { n: sp.tracking.conversionActions }) : T('ocs_noneFound'))]);
    rows.push([T('ocs_structure'), groupsText(p, sp.adGroups.length) + ', ' + adsText(sp.adGroups.reduce(function (n, g) { return n + (g.ads ? g.ads.length : 0); }, 0))]);
    rows.push([T('ocs_destination'), sp.tracking.destinationUrl || T('ocs_missing')]);
    return rows;
  };
})();
