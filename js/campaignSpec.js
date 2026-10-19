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

  // ── Loading ──────────────────────────────────────────────────────
  S.load = function (pkg, platform, opts) {
    opts = opts || {};
    if (typeof window.apiFetch !== 'function') return Promise.resolve({ error: 'OrivenAI isn’t ready yet. Reload and try again.' });
    var body = { pkg: pkg, platform: platform, choices: !choices };
    if (opts.changes) body.changes = opts.changes;
    if (opts.refresh) body.refresh = true;
    if (opts.campId) body.campId = String(opts.campId);
    return window.apiFetch('/api/campaigns/spec', { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
      var d = r && r.data;
      if (!r || !r.ok || !d || !d.ok) return { error: (d && d.error) || 'Campaign settings couldn’t be checked right now.', status: r && r.status };
      if (d.choices) choices = d.choices;
      return d;
    }).catch(function (e) { return { error: (e && e.message) || 'Campaign settings couldn’t be checked right now.' }; });
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
      cache[camp.id] = { key: k, res: res, at: Date.now(), live: !!live };
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
  S.remember = function (camp, res) { if (camp && camp.id && camp.pkg && res && !res.error) { var p = camp.platform || camp.pkg.platform; cache[camp.id] = { key: keyOf(camp, p), res: res, at: Date.now() }; } };
  S.errors = function (res) { return (res && res.issues || []).filter(function (i) { return i.level === 'error'; }); };

  // ── Labels ───────────────────────────────────────────────────────
  var PLAT = { meta: 'Meta', google: 'Google Ads', tiktok: 'TikTok', pinterest: 'Pinterest' };
  var GROUP = { meta: ['Ad set', 'Ad sets'], google: ['Ad group', 'Ad groups'], tiktok: ['Ad group', 'Ad groups'], pinterest: ['Ad group', 'Ad groups'] };
  var CAT = { HOUSING: 'Housing', EMPLOYMENT: 'Employment', FINANCIAL_PRODUCTS_SERVICES: 'Financial products and services', ISSUES_ELECTIONS_POLITICS: 'Social issues, elections or politics' };
  var BADGE = {
    user: ['Your choice', 'user'], profile: ['Business profile', 'profile'], auto: ['Automatic', 'auto'], ai: ['AI suggestion', 'ai'],
    missing: ['Missing', 'missing'], unsupported: ['Not supported', 'unsupported'], invalid: ['Needs a fix', 'invalid']
  };
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
    if (!res) { host.innerHTML = '<p class="ocs-loading" role="status">Checking this campaign’s settings…</p>'; return; }
    if (res.error) {
      host.innerHTML = '<div class="ocs-fail" role="alert"><p>' + esc(res.error) + '</p><button type="button" class="ofd-btn ofd-btn-ghost" data-ocs-retry>Try again</button></div>';
      var rb = host.querySelector('[data-ocs-retry]'); if (rb) rb.addEventListener('click', function () { if (state.onRetry) state.onRetry(); });
      return;
    }
    var spec = res.spec, issues = res.issues || [], opt = res.options || {}, p = state.platform, src = spec.sources || {};
    state.open = state.open || {};
    // Result of the last edit: a refused change keeps its editor open with
    // the reason; an applied one closes it.
    var edErr = null;
    if (res.rejected && res.rejected.length && state.openEd) edErr = res.rejected.map(function (x) { return x.reason; }).join(' ');
    else if (res.applied && res.applied.length) state.openEd = null;
    var bySec = {};
    issues.forEach(function (i) { if (i.level === 'info') return; var k = sectionOf(i.field); (bySec[k] = bySec[k] || []).push(i); });
    function issuesFor(re) { return issues.filter(function (i) { return i.level !== 'info' && re.test(i.field || ''); }); }
    function badge(source, fieldRe) {
      var bad = fieldRe ? issuesFor(fieldRe).filter(function (i) { return i.level === 'error'; }) : [];
      var b = bad.length ? (source === 'missing' || /missing|none|unconfirmed|choose/.test(bad[0].code) ? BADGE.missing : BADGE.invalid) : (BADGE[source] || BADGE.auto);
      return '<span class="ocs-badge ocs-b-' + b[1] + '">' + b[0] + '</span>';
    }
    function fieldIssues(re) {
      var list = issuesFor(re);
      return list.length ? '<ul class="ocs-fi">' + list.map(function (i) { return '<li class="ocs-fi-' + i.level + '">' + esc(i.message) + '</li>'; }).join('') + '</ul>' : '';
    }
    function row(label, value, b, extra) {
      return '<div class="ocs-row"><dt>' + esc(label) + (b || '') + '</dt><dd>' + value + (extra || '') + '</dd></div>';
    }
    function editor(id, inner, applyLabel) {
      return '<details class="ocs-ed"' + (state.openEd === id ? ' open' : '') + ' data-ed="' + id + '"><summary>Change</summary><div class="ocs-ed-body">' + inner +
        (edErr && state.openEd === id ? '<p class="ocs-ed-err" role="alert">' + esc(edErr) + '</p>' : '') +
        '<div class="ocs-ed-act"><button type="button" class="ofd-btn ofd-btn-primary ocs-apply" data-apply="' + id + '">' + esc(applyLabel || 'Apply') + '</button></div></div></details>';
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
        (n ? '<span class="ocs-count ocs-count-err">' + n + ' to fix</span>' : w ? '<span class="ocs-count ocs-count-warn">' + w + ' to check</span>' : '<span class="ocs-count ocs-count-ok">OK</span>') +
        '</summary><dl class="ocs-dl">' + body + '</dl></details>';
    }

    var errs = issues.filter(function (i) { return i.level === 'error'; });
    var warns = issues.filter(function (i) { return i.level === 'warning'; });
    var html = '';
    html += '<div class="ocs-head ' + (errs.length ? 'ocs-head-err' : 'ocs-head-ok') + '" role="status">' +
      '<strong>' + (errs.length ? errs.length + (errs.length === 1 ? ' setting needs' : ' settings need') + ' your input before publishing' : 'Ready to publish — created paused') + '</strong>' +
      '<span>' + (errs.length ? 'Nothing is sent to ' + PLAT[p] + ' until these are fixed and you confirm.' : 'Nothing spends until you activate it on ' + PLAT[p] + '.') + (warns.length ? ' ' + warns.length + ' optional check' + (warns.length === 1 ? '' : 's') + '.' : '') + '</span></div>';
    if (errs.length) {
      html += '<ul class="ocs-todo">' + errs.map(function (i) {
        return '<li><span>' + esc(i.message) + '</span><button type="button" class="ofd-btn ofd-btn-ghost ocs-go" data-go="' + sectionOf(i.field) + '">Fix</button></li>';
      }).join('') + '</ul>';
    }

    // Overview / objective
    var goals = p === 'tiktok' && choices ? choices.tiktokGoals : (choices ? choices.goals : ['Sales', 'Leads', 'Traffic', 'Awareness']);
    var structure = spec.adGroups.length + ' ' + (spec.adGroups.length === 1 ? GROUP[p][0] : GROUP[p][1]).toLowerCase() + ' · ' +
      spec.adGroups.reduce(function (n, g) { return n + (g.ads ? g.ads.length : 0); }, 0) + ' ads';
    html += section('objective', 'Objective & optimisation', [
      row('Status', 'Paused', '<span class="ocs-badge ocs-b-auto">Always</span>', '<p class="ocs-note">OrivenAI never activates campaigns. You switch it on in ' + PLAT[p] + ' when you’re ready.</p>'),
      p === 'google' ? row('Campaign type', esc(pretty(spec.campaignType)), '<span class="ocs-badge ocs-b-auto">Chosen in Create</span>', fieldIssues(/^campaignType/)) : '',
      row('Objective', esc(spec.campaign.goal) + (spec.campaign.objective ? ' <span class="ocs-code">' + esc(spec.campaign.objective) + '</span>' : ''), '<span class="ocs-badge ocs-b-user">Your choice</span>',
        fieldIssues(/^campaign\.goal/) + editor('goal', '<label class="ocs-lbl">Objective' + select('goal', goals, spec.campaign.goal) + '</label>' +
          (p === 'tiktok' ? '<p class="ocs-note">TikTok Sales and Leads aren’t available in OrivenAI yet (they need a TikTok Pixel or instant forms).</p>' : '') +
          '<p class="ocs-note">Optimisation, bidding and conversion settings follow the objective.</p>')),
      spec.optimization ? row('Optimisation', esc([spec.optimization.goal, spec.optimization.billingEvent || spec.optimization.billableEvent].filter(Boolean).map(pretty).join(' · ')), '<span class="ocs-badge ocs-b-auto">Automatic</span>') : '',
      p === 'google' && spec.campaign.bidStrategyLabel ? row('Bidding', esc(spec.campaign.bidStrategyLabel), '<span class="ocs-badge ocs-b-auto">Automatic</span>') : '',
      row('Structure', esc(structure), '<span class="ocs-badge ocs-b-auto">Chosen in Create</span>')
    ].join(''), spec.campaign.goal);

    // Budget
    html += section('budget', 'Budget & schedule', [
      row('Daily budget', spec.budget.amount != null ? esc(money(spec.budget.amount, spec.budget.currency)) + ' per day' : '<span class="ocs-miss">Not set</span>' + (spec.budget.suggestion ? ' <span class="ocs-sugg">AI suggestion: ' + esc(money(spec.budget.suggestion, spec.budget.currency)) + '</span>' : ''),
        badge(spec.sources.budget === 'user' ? 'user' : 'missing', /^budget/),
        fieldIssues(/^budget/) + editor('budget', '<label class="ocs-lbl">Amount per day' + (spec.budget.currency ? ' (' + esc(spec.budget.currency) + ')' : '') +
          '<input class="ofd-input" type="number" inputmode="decimal" min="' + (p === 'tiktok' && choices ? choices.tiktokMinDaily + 1 : 1) + '" step="0.01" name="budget" value="' + esc(spec.budget.amount != null ? spec.budget.amount : (spec.budget.suggestion || '')) + '"></label>' +
          '<p class="ocs-note">' + (p === 'tiktok' ? 'TikTok needs more than ' + (choices ? choices.tiktokMinDaily : 20) + ' per day per ad group. ' : '') + 'Charged in your ad account’s currency. Budgets are never set for you.</p>', 'Save budget')),
      row('Budget level', esc(spec.campaign.budgetLevel === 'CAMPAIGN' ? 'Campaign' : spec.campaign.budgetLevel === 'AD_GROUP' ? 'Each ad group' : spec.campaign.budgetLevel === 'AD_SET' ? 'Each ad set' : 'Campaign'), '<span class="ocs-badge ocs-b-auto">Automatic</span>'),
      row('Schedule', 'Runs continuously once you activate it', '<span class="ocs-badge ocs-b-auto">Automatic</span>')
    ].join(''), spec.budget.amount != null ? money(spec.budget.amount, spec.budget.currency) + '/day' : 'Not set');

    // Targeting
    var cList = spec.targeting.countries || [];
    var countriesEd = '<div class="ocs-chips" data-chips="countries">' + cList.map(function (c) {
      return '<span class="ocs-chip" data-v="' + esc(c) + '">' + esc(countryName(c)) + '<button type="button" aria-label="Remove ' + esc(countryName(c)) + '" data-chip-x>×</button></span>';
    }).join('') + '</div>' +
      '<label class="ocs-lbl">Add a country' + select('countryAdd', [{ v: '', l: 'Choose a country…' }].concat((choices ? choices.countries : []).filter(function (c) { return cList.indexOf(c.iso) < 0; }).map(function (c) { return { v: c.iso, l: c.name + (p === 'pinterest' && !c.pinterest ? ' (not a Pinterest ads market)' : '') }; })), '') + '</label>' +
      '<p class="ocs-note">Ads are shown only in these countries. OrivenAI never targets every country or picks one for you.</p>';
    var lList = spec.targeting.languages || [];
    var langEd = '<label class="ocs-lbl">Languages (hold Ctrl/⌘ to pick several; none = all languages)<select class="ofd-input" name="languages" multiple size="5">' + (choices ? choices.languages : []).map(function (l) {
      return '<option value="' + esc(l.code) + '"' + (lList.indexOf(l.code) >= 0 ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    }).join('') + '</select></label>';
    var hasAge = p === 'meta' || p === 'tiktok';
    var ageOpts = []; for (var a = 18; a <= 65; a++) ageOpts.push({ v: a, l: a === 65 ? '65+' : String(a) });
    html += section('targeting', 'Targeting & audience', [
      row('Countries', cList.length ? esc(cList.map(countryName).join(', ')) : '<span class="ocs-miss">Choose at least one country</span>', badge(src.countries, /^targeting\.countries/),
        fieldIssues(/^targeting\.countries/) + editor('countries', countriesEd, 'Save countries')),
      row('Languages', lList.length ? esc(lList.map(langName).join(', ')) : 'All languages', badge(src.languages, /^targeting\.languages/), editor('languages', langEd, 'Save languages')),
      hasAge ? row('Ages', esc(spec.targeting.ageMin + '–' + spec.targeting.ageMax + (spec.targeting.ageMax === 65 ? '+' : '')), badge(src.age, /^targeting\.age/),
        fieldIssues(/^targeting\.age/) + editor('age', '<div class="ocs-pair"><label class="ocs-lbl">From' + select('ageMin', ageOpts, spec.targeting.ageMin) + '</label><label class="ocs-lbl">To' + select('ageMax', ageOpts, spec.targeting.ageMax) + '</label></div>', 'Save ages')) : '',
      p === 'meta' ? row('Placements', esc(spec.targeting.placementLabel), badge(src.placement), editor('placement', '<label class="ocs-lbl">Placements' + select('placement', Object.keys(choices ? choices.metaPlacements : { automatic: 1 }).map(function (k) { return { v: k, l: choices ? choices.metaPlacements[k] : k }; }), spec.targeting.placement) + '</label>', 'Save placements')) : '',
      p === 'meta' ? row('Advantage+ audience', spec.targeting.advantageAudience ? 'On — Meta may reach beyond your ages and interests' : 'Off — your age range is a hard limit', '<span class="ocs-badge ocs-b-auto">Automatic</span>', '<p class="ocs-note">Countries are always a hard limit.</p>') : '',
      p === 'tiktok' ? row('Placement', 'TikTok feed', '<span class="ocs-badge ocs-b-auto">Automatic</span>') : '',
      p === 'google' && spec.campaignType === 'SEARCH' ? row('Networks', 'Google Search and search partners (no Display)', '<span class="ocs-badge ocs-b-auto">Automatic</span>') : '',
      spec.suggestions && spec.suggestions.audienceDescription ? row('Audience idea', esc(spec.suggestions.audienceDescription), '<span class="ocs-badge ocs-b-ai">AI suggestion</span>', '<p class="ocs-note">Used to write the ads. It isn’t sent as targeting — platforms find this audience through the creative and your objective.</p>') : ''
    ].join(''), cList.length ? cList.map(countryName).join(', ') : 'Country needed');

    // Ad sets / groups + ads
    var canGroups = !(p === 'google' && spec.campaignType !== 'SEARCH');
    var groupsHtml = spec.adGroups.map(function (g, i) {
      var ages = g.ageMin != null ? ' · ages ' + g.ageMin + '–' + g.ageMax : '';
      var ads = (g.ads || []).map(function (ad) { return '<li>' + esc(ad.name) + (ad.headline ? ' — “' + esc(ad.headline) + '”' : '') + '</li>'; }).join('');
      var kw = g.keywords && g.keywords.length ? '<p class="ocs-note">Keywords: ' + esc(g.keywords.map(function (k) { return k.text + (k.matchType && k.matchType !== 'BROAD' ? ' (' + pretty(k.matchType) + ')' : ''); }).join(', ')) + '</p>' : '';
      return '<div class="ocs-group"><div class="ocs-group-h"><strong>' + esc(g.name) + '</strong><span>' + esc(ages) + '</span>' +
        (canGroups && spec.adGroups.length > 1 ? '<button type="button" class="ofd-btn ofd-btn-ghost ocs-mini" data-remove-group="' + i + '">Remove</button>' : '') + '</div>' + kw + '<ul class="ocs-ads">' + ads + '</ul></div>';
    }).join('');
    html += section('ads', GROUP[p][1] + ' & ads', [
      '<div class="ocs-groups">' + groupsHtml + '</div>',
      fieldIssues(/^(assets\.(headlines|descriptions|squareImage|landscapeImage)|creative|pin\.)/),
      p === 'tiktok' ? row('Format', spec.creative.format === 'VIDEO' ? 'Video ad (with cover image)' : '<span class="ocs-miss">Video needed</span>', badge(spec.creative.format === 'VIDEO' ? 'auto' : 'unsupported', /^creative\.video/)) : '',
      p === 'google' && spec.campaignType === 'PERFORMANCE_MAX' ? row('Landscape image', spec.assets.landscapeImageUrl ? 'Ready — cropped to 1.91:1 when publishing' : '<span class="ocs-miss">Missing</span>', badge(spec.assets.landscapeImageUrl ? 'auto' : 'missing', /^assets\.landscapeImage/)) : '',
      canGroups && spec.adGroups.length < 5 ? editor('addGroup', '<label class="ocs-lbl">Name<input class="ofd-input" name="groupName" maxlength="80" placeholder="' + esc(GROUP[p][0]) + ' ' + (spec.adGroups.length + 1) + '"></label>' +
        (hasAge ? '<div class="ocs-pair"><label class="ocs-lbl">Ages from' + select('gAgeMin', ageOpts, spec.targeting.ageMin) + '</label><label class="ocs-lbl">to' + select('gAgeMax', ageOpts, spec.targeting.ageMax) + '</label></div>' : '') +
        '<p class="ocs-note">Uses the same ads, budget and countries. Each ' + GROUP[p][0].toLowerCase() + ' gets its own daily budget on ' + PLAT[p] + '.</p>', 'Add ' + GROUP[p][0].toLowerCase()) : ''
    ].join(''), structure);

    // Conversion tracking
    var trk = [];
    if (p === 'meta') {
      if (spec.tracking.needsConversion) {
        var px = opt.pixels || [];
        trk.push(row('Meta Pixel', spec.tracking.pixelId ? esc((px.filter(function (x) { return x.id === spec.tracking.pixelId; })[0] || {}).name || spec.tracking.pixelId) : '<span class="ocs-miss">' + (px.length ? 'Choose a pixel' : 'No pixel on this ad account') + '</span>', badge(src.pixel, /^tracking\.pixelId/),
          fieldIssues(/^tracking\.pixelId/) + (px.length ? editor('pixel', '<label class="ocs-lbl">Pixel' + select('pixelId', [{ v: '', l: 'Choose…' }].concat(px.map(function (x) { return { v: x.id, l: x.name + ' (' + x.id + ')' }; })), spec.tracking.pixelId || '') + '</label>', 'Use this pixel') : '')));
        trk.push(row('Conversion event', esc(pretty(spec.tracking.conversionEvent)), badge(src.conversionEvent), editor('event', '<label class="ocs-lbl">Event' + select('conversionEvent', (choices ? choices.metaConversionEvents : [spec.tracking.conversionEvent]), spec.tracking.conversionEvent, pretty) + '</label><p class="ocs-note">Must be an event your pixel actually records.</p>', 'Use this event')));
      } else trk.push(row('Conversion tracking', 'Not needed for ' + esc(spec.campaign.goal), '<span class="ocs-badge ocs-b-auto">Automatic</span>'));
    } else if (p === 'pinterest') {
      if (spec.tracking.needsConversion) {
        var tags = opt.conversionTags || [];
        trk.push(row('Pinterest Tag', spec.tracking.conversionTagId ? esc((tags.filter(function (x) { return x.id === spec.tracking.conversionTagId; })[0] || {}).name || spec.tracking.conversionTagId) : '<span class="ocs-miss">' + (tags.length ? 'Choose a tag' : 'No Pinterest Tag on this ad account') + '</span>', badge(src.conversionTag, /^tracking\.conversionTagId/),
          fieldIssues(/^tracking\.conversionTagId/) + (tags.length ? editor('tag', '<label class="ocs-lbl">Tag' + select('conversionTagId', [{ v: '', l: 'Choose…' }].concat(tags.map(function (x) { return { v: x.id, l: (x.name || x.id) }; })), spec.tracking.conversionTagId || '') + '</label>', 'Use this tag') : '')));
        var pev = choices && choices.pinterestConversionEvents[spec.campaign.goal] || [spec.tracking.conversionEvent];
        trk.push(row('Conversion event', esc(pretty(spec.tracking.conversionEvent)), badge('auto'), editor('pevent', '<label class="ocs-lbl">Event' + select('conversionEvent', pev, spec.tracking.conversionEvent, pretty) + '</label>', 'Use this event')));
      } else trk.push(row('Conversion tracking', 'Not needed for ' + esc(spec.campaign.goal), '<span class="ocs-badge ocs-b-auto">Automatic</span>'));
    } else if (p === 'google') {
      var ca = spec.tracking.conversionActions;
      trk.push(row('Conversion actions', spec.tracking.needsConversion ? (ca == null ? 'Couldn’t be checked' : ca ? ca + ' active in your account' : '<span class="ocs-miss">None in your account</span>') : 'Not needed for ' + esc(spec.campaign.goal),
        badge(spec.tracking.needsConversion ? (ca ? 'auto' : 'missing') : 'auto', /^tracking\.conversion/), fieldIssues(/^tracking\.conversion/) + (spec.tracking.needsConversion ? '<p class="ocs-note">Set up conversion actions in Google Ads → Goals. OrivenAI doesn’t create them.</p>' : '')));
    } else {
      trk.push(row('Conversion tracking', 'Not used — TikTok campaigns from OrivenAI optimise for clicks or reach', '<span class="ocs-badge ocs-b-unsupported">Not supported</span>'));
    }
    html += section('tracking', 'Conversion tracking', trk.join(''));

    // Destination & UTM
    var utm = spec.tracking.utm || {};
    html += section('destination', 'Destination & UTM', [
      row('Destination URL', spec.tracking.destinationUrl ? '<span class="ocs-url">' + esc(spec.tracking.destinationUrl) + '</span>' : '<span class="ocs-miss">Missing</span>', badge(src.destinationUrl, /^tracking\.destinationUrl/),
        fieldIssues(/^tracking\.destinationUrl/) + editor('url', '<label class="ocs-lbl">Page people land on<input class="ofd-input" type="url" inputmode="url" name="destinationUrl" value="' + esc(spec.tracking.destinationUrl || '') + '" placeholder="https://yourshop.com/offer"></label>', 'Save URL')),
      row('UTM parameters', '<span class="ocs-code">' + esc(spec.tracking.urlParams) + '</span>', badge(src.utm), editor('utm',
        ['source', 'medium', 'campaign', 'content'].map(function (k) { return '<label class="ocs-lbl">utm_' + k + '<input class="ofd-input" name="utm_' + k + '" maxlength="100" value="' + esc(utm[k] || '') + '"></label>'; }).join(''), 'Save UTM'))
    ].join(''));

    // Google assets
    if (p === 'google') {
      var as = spec.assets || {};
      var assetRows = [];
      if (spec.campaignType === 'SEARCH') {
        assetRows.push(row('Negative keywords', as.negativeKeywords.length ? esc(as.negativeKeywords.join(', ')) : 'None', badge(src.negativeKeywords),
          editor('negatives', '<label class="ocs-lbl">One per line<textarea class="ofd-input" rows="4" name="negativeKeywords">' + esc(as.negativeKeywords.join('\n')) + '</textarea></label><p class="ocs-note">Added as phrase-match negatives at campaign level.</p>', 'Save negatives')));
        assetRows.push(row('Callouts', as.callouts.length ? esc(as.callouts.join(' · ')) : 'None', badge('ai', /^assets\.callouts/), fieldIssues(/^assets\.callouts/) +
          editor('callouts', '<label class="ocs-lbl">One per line (max 25 characters)<textarea class="ofd-input" rows="4" name="callouts">' + esc(as.callouts.join('\n')) + '</textarea></label>', 'Save callouts')));
        assetRows.push(row('Structured snippet', as.structuredSnippet ? esc(as.structuredSnippet.header + ': ' + as.structuredSnippet.values.join(', ')) : 'None', badge('ai', /^assets\.structuredSnippet/), fieldIssues(/^assets\.structuredSnippet/) +
          (as.structuredSnippet ? editor('snippet', '<label class="ocs-lbl">Header' + select('snippetHeader', choices ? choices.googleSnippetHeaders : [as.structuredSnippet.header], as.structuredSnippet.header) + '</label>', 'Save header') : '')));
        var sl = as.sitelinks || [];
        assetRows.push(row('Sitelinks', sl.length ? sl.map(function (x) { return esc(x.text) + (x.url ? ' → <span class="ocs-url">' + esc(x.url) + '</span>' : ' <span class="ocs-miss">(no page yet — not sent)</span>'); }).join('<br>') : 'None', badge(sl.length && sl.every(function (x) { return x.url; }) ? 'user' : 'ai', /^assets\.sitelinks/),
          fieldIssues(/^assets\.sitelinks/) + '<p class="ocs-note">A sitelink is only sent once it points to a real page on your site.</p>' +
          editor('sitelink', '<label class="ocs-lbl">Link text' + (sl.length ? select('slText', sl.map(function (x) { return x.text; }), (sl.filter(function (x) { return !x.url; })[0] || sl[0]).text) : '<input class="ofd-input" name="slText" maxlength="25">') + '</label>' +
            '<label class="ocs-lbl">Page address<input class="ofd-input" type="url" name="slUrl" placeholder="https://yourshop.com/page"></label>', 'Save sitelink')));
      }
      if (spec.campaignType !== 'SEARCH') {
        assetRows.push(row('Business name', as.businessName ? esc(as.businessName) : '<span class="ocs-miss">Missing</span>', badge(src.businessName, /^assets\.businessName/), fieldIssues(/^assets\.businessName/) + '<p class="ocs-note">From Business → Profile.</p>'));
        assetRows.push(row('Logo', as.logoUrl ? '<img class="ocs-logo" src="' + esc(as.logoUrl) + '" alt="Your logo">' : '<span class="ocs-miss">Missing</span>', badge(src.logo, /^assets\.logo/), fieldIssues(/^assets\.logo/) + '<p class="ocs-note">From Business → Profile. Padded to a square when publishing.</p>'));
      }
      html += section('assets', spec.campaignType === 'SEARCH' ? 'Keywords & extensions' : 'Brand assets', assetRows.join(''));
    }

    // Compliance (Meta)
    if (p === 'meta') {
      var cats = spec.campaign.specialAdCategories || [];
      var catEd = (choices ? choices.metaSpecialCategories : Object.keys(CAT)).map(function (c) {
        return '<label class="ocs-check"><input type="checkbox" name="cat" value="' + c + '"' + (cats.indexOf(c) >= 0 ? ' checked' : '') + '> ' + esc(CAT[c] || pretty(c)) + '</label>';
      }).join('') + '<p class="ocs-note">Leave all unticked if your ad isn’t about any of these. Special categories limit age and location targeting.</p>';
      var comp = [row('Special ad categories', spec.campaign.specialAdCategoriesConfirmed ? (cats.length ? esc(cats.map(function (c) { return CAT[c] || c; }).join(', ')) : 'None apply') : '<span class="ocs-miss">Please confirm</span>',
        badge(spec.campaign.specialAdCategoriesConfirmed ? 'user' : 'missing', /^campaign\.specialAdCategories/), fieldIssues(/^campaign\.specialAdCategories/) + editor('cats', catEd, 'Confirm categories'))];
      if (spec.compliance.euTargeted) {
        comp.push(row('EU transparency (DSA)', esc('Beneficiary: ' + (spec.compliance.dsaBeneficiary || '—') + ' · Paid by: ' + (spec.compliance.dsaPayor || '—')), badge(src.dsa, /^compliance/),
          fieldIssues(/^compliance/) + editor('dsa', '<label class="ocs-lbl">Who benefits from the ad<input class="ofd-input" name="dsaBeneficiary" maxlength="200" value="' + esc(spec.compliance.dsaBeneficiary || '') + '"></label><label class="ocs-lbl">Who pays for it<input class="ofd-input" name="dsaPayor" maxlength="200" value="' + esc(spec.compliance.dsaPayor || '') + '"></label>', 'Save')));
      }
      html += section('compliance', 'Compliance', comp.join(''));
    }

    // Identity
    var idRows = [];
    if (p === 'meta') {
      idRows.push(row('Facebook Page', spec.identity.pageId ? 'Connected page' : '<span class="ocs-miss">Not selected</span>', badge(spec.identity.pageId ? 'auto' : 'missing', /^identity\.pageId/), fieldIssues(/^identity\.pageId/)));
      idRows.push(row('Instagram account', spec.identity.instagramUsername ? '@' + esc(spec.identity.instagramUsername) : (spec.targeting.placement === 'facebook_only' ? 'Not needed' : '<span class="ocs-miss">Not linked to your Page</span>'), badge(spec.identity.instagramUserId ? 'auto' : (spec.targeting.placement === 'facebook_only' ? 'auto' : 'missing'), /^identity\.instagram/), fieldIssues(/^identity\.instagram/)));
    }
    if (p === 'tiktok') idRows.push(row('TikTok identity', spec.identity.displayName ? esc(spec.identity.displayName) : '<span class="ocs-miss">Not selected</span>', badge(spec.identity.identityId ? 'auto' : 'missing', /^identity/), fieldIssues(/^identity/) + '<p class="ocs-note">Choose it in Business → Connections.</p>'));
    if (idRows.length) html += section('identity', 'Identity', idRows.join(''));

    // Advanced
    html += section('advanced', 'Advanced', [
      row('Created as', 'Paused (campaign, ' + GROUP[p][1].toLowerCase() + ' and ads)', '<span class="ocs-badge ocs-b-auto">Always</span>'),
      spec.suggestions && (spec.suggestions.retargetingIdea || spec.suggestions.lookalikeIdea) ? row('Audience ideas', esc([spec.suggestions.retargetingIdea, spec.suggestions.lookalikeIdea].filter(Boolean).join(' · ')), '<span class="ocs-badge ocs-b-ai">AI suggestion</span>', '<p class="ocs-note">Not sent — set up retargeting or lookalike audiences in ' + PLAT[p] + ' if you want them.</p>') : '',
      row('Live testing', esc((spec.liveUnverified || []).join(' ')), '<span class="ocs-badge ocs-b-unsupported">Not yet verified</span>')
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
          if (!list.length) { note(b, 'Choose at least one country.'); return; }
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
        else if (id === 'pixel') { if (!v('pixelId')) { note(b, 'Choose a pixel.'); return; } ch.pixelId = v('pixelId'); }
        else if (id === 'tag') { if (!v('conversionTagId')) { note(b, 'Choose a tag.'); return; } ch.conversionTagId = v('conversionTagId'); }
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
    return '<div class="crv-section ocs-tlink"><div class="crv-section-hd">Targeting sent to the platform</div>' +
      '<p class="ocs-note">Countries, languages and ages are set in Campaign settings and checked against your ad account before publishing. ' +
      'If no country is set, OrivenAI asks you to choose one. Gender, interests and audience notes guide the ad copy and aren’t sent as targeting.</p>' +
      (id ? '<button type="button" class="ofd-btn ofd-btn-ghost" onclick="window.orvWorkspace&&orvWorkspace.flow&&orvWorkspace.flow.openAd(\'' + id + '\',\'targeting\')">Open campaign settings</button>' : '') +
      '</div>';
  };

  // Short, plain summary lines for confirmations and the Launch checklist.
  S.summaryRows = function (res) {
    if (!res || !res.spec) return [];
    var sp = res.spec, p = sp.platform, rows = [];
    rows.push(['Objective', sp.campaign.goal + (sp.campaign.objective ? ' (' + pretty(sp.campaign.objective) + ')' : '')]);
    rows.push(['Countries', (sp.targeting.countries || []).length ? sp.targeting.countries.map(countryName).join(', ') : 'Not chosen']);
    rows.push(['Languages', (sp.targeting.languages || []).length ? sp.targeting.languages.map(langName).join(', ') : 'All languages']);
    if (p === 'meta' || p === 'tiktok') rows.push(['Ages', sp.targeting.ageMin + '–' + sp.targeting.ageMax + (sp.targeting.ageMax === 65 ? '+' : '')]);
    if (p === 'meta') rows.push(['Placements', sp.targeting.placementLabel]);
    if (sp.tracking.needsConversion) rows.push(['Conversion', p === 'meta' ? (sp.tracking.pixelId ? 'Pixel ' + sp.tracking.pixelId + ' · ' + pretty(sp.tracking.conversionEvent) : 'No pixel selected') : p === 'pinterest' ? (sp.tracking.conversionTagId ? 'Tag ' + sp.tracking.conversionTagId + ' · ' + pretty(sp.tracking.conversionEvent) : 'No tag selected') : (sp.tracking.conversionActions ? sp.tracking.conversionActions + ' conversion actions' : 'None found')]);
    rows.push(['Structure', sp.adGroups.length + ' ' + (sp.adGroups.length === 1 ? GROUP[p][0] : GROUP[p][1]).toLowerCase() + ', ' + sp.adGroups.reduce(function (n, g) { return n + (g.ads ? g.ads.length : 0); }, 0) + ' ads']);
    rows.push(['Destination', sp.tracking.destinationUrl || 'Missing']);
    return rows;
  };
})();
