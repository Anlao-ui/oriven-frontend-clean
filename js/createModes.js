/* ════════════════════════════════════════════════════════════════
   Create Ads — two ways to make an ad (#page-create)

   1. Create with AI  → the existing guided flow (js/createFlow.js), unchanged.
   2. Create manually → this file: platform FIRST, then the campaign, the
      audience, then the hierarchy  Campaign → ad sets / ad groups / ad squads
      → ads, each ad with its own copy and media, then a review.

   Manual ads are real OrivenAI campaigns: the answers become the campaign
   package (pkg) the server spec reads (services/campaignSpec.js via
   POST /api/campaigns/spec): overrides.adGroups[i] = { name, ageMin, ageMax,
   keywords, ads: [ … each ad's own content … ] }. The server validates it
   against the platform's rules, its limits and the connected account;
   publishing happens in Campaign Studio through /api/publish/<platform>
   (confirmation first, everything created PAUSED). Nothing here publishes.

   What can be built per platform (and how the server publishes it):
     Meta      ad sets → image or video ads (video: uploaded to the ad account,
               processed by Meta, thumbnail from Meta).
     Google    Search: ad groups (own keywords) → responsive search ads.
               Display: ad groups → responsive display ads (square + landscape).
               YouTube video ads (Demand Gen): ad groups → video responsive ads.
               Performance Max / Demand Gen image: one asset group (campaign fields).
               Google Video campaigns can't be created through the Google Ads API.
     TikTok    Traffic, Awareness or Video Views; ad groups → video ads.
     Pinterest ad groups → one Pin per ad (image or video).
     Snapchat  ad squads → full-screen image or video ads (one country).

   Drafts: kept per account on this device (v2 shape; v1 drafts are converted
   on load, nothing is lost). A saved manual campaign keeps its draft
   (pkg.manualDraft) so it can be opened again here and edited.
   Public API: window.orvCreateModes { mode, choose, state, … }.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.orvCreateModes) return;
  var CC = window.OrivenCreateCompat;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { try { return (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.id) || (window._currentUser && window._currentUser.id) || 'anon'; } catch (_) { return 'anon'; } }
  var MODE_KEY = 'orv_create_mode_v1:', DRAFT_KEY = 'orv_manual_ad_v1:';
  function sget(k) { try { return localStorage.getItem(k + uid()); } catch (_) { return null; } }
  function sset(k, v) { try { if (v == null) localStorage.removeItem(k + uid()); else localStorage.setItem(k + uid(), v); } catch (_) {} }

  var PLAT = {
    meta: { name: 'Meta Ads', levels: ['Campaign', 'Ad set', 'Ad'], unit: 'ad set', units: 'ad sets', fmt: 'Image or video ads on Facebook and Instagram', key: 'metaAds' },
    google: { name: 'Google Ads', levels: ['Campaign', 'Ad group', 'Ad'], unit: 'ad group', units: 'ad groups', fmt: 'Search, Display, YouTube video (Demand Gen), Performance Max', key: 'googleAds' },
    tiktok: { name: 'TikTok Ads', levels: ['Campaign', 'Ad group', 'Ad'], unit: 'ad group', units: 'ad groups', fmt: 'Vertical video ads in the TikTok feed', key: 'tiktokAds' },
    pinterest: { name: 'Pinterest Ads', levels: ['Campaign', 'Ad group', 'Pin'], unit: 'ad group', units: 'ad groups', fmt: 'Image or video Pins', key: 'pinterestAds' },
    snapchat: { name: 'Snapchat Ads', levels: ['Campaign', 'Ad squad', 'Ad'], unit: 'ad squad', units: 'ad squads', fmt: 'Full-screen vertical image or video', key: 'snapchatAds' },
  };
  var ORDER = ['meta', 'google', 'tiktok', 'pinterest', 'snapchat'];
  var GOAL_LABEL = { Sales: 'Sales', Leads: 'Leads', Traffic: 'Website traffic', Awareness: 'Brand awareness' };
  var GTYPE = { SEARCH: 'Search (text ads)', DISPLAY: 'Display (responsive image ads)', DEMAND_GEN_VIDEO: 'YouTube video ads (Demand Gen)', DEMAND_GEN: 'Demand Gen (image)', PERFORMANCE_MAX: 'Performance Max' };
  var GTYPE_HELP = {
    SEARCH: 'Text ads on Google Search, triggered by your keywords. Each ad group has its own keywords.',
    DISPLAY: 'Responsive image ads on the Google Display Network: square and landscape images, headlines and a long headline.',
    DEMAND_GEN_VIDEO: 'Video ads on YouTube, Discover and Gmail from your YouTube videos. Google Video campaigns themselves can’t be created through the Google Ads API, so OrivenAI publishes these as a Demand Gen campaign.',
    DEMAND_GEN: 'Image ads on YouTube, Discover and Gmail (one ad group).',
    PERFORMANCE_MAX: 'One campaign across Google’s channels from your images, texts and logo (one asset group). Sales and leads only.',
  };
  var META_CTAS = ['Learn more', 'Shop now', 'Sign up', 'Subscribe', 'Contact us', 'Get offer', 'Book now', 'Download', 'Apply now'];
  var SNAP_CTAS = [['SHOP_NOW', 'Shop now'], ['SIGN_UP', 'Sign up'], ['MORE', 'More'], ['ORDER_NOW', 'Order now'], ['BOOK_NOW', 'Book now'], ['VIEW', 'View'], ['DOWNLOAD', 'Download'], ['APPLY_NOW', 'Apply now']];
  var TIKTOK_CTAS = ['Learn more', 'Shop now', 'Sign up', 'Contact us', 'Download', 'Book now', 'Order now', 'Get quote'];
  var META_CATS = [['', 'None of these'], ['HOUSING', 'Housing'], ['EMPLOYMENT', 'Employment'], ['FINANCIAL_PRODUCTS_SERVICES', 'Financial products and services'], ['ISSUES_ELECTIONS_POLITICS', 'Social issues, elections or politics']];
  // Limits the server enforces too (services/campaignSpec.js G, G_DISPLAY, G_DGV, STRUCTURE_LIMITS, snapchat LIMITS).
  var LIM = { rsaH: 30, rsaD: 90, rsaMinH: 3, rsaMaxH: 15, rsaMinD: 2, rsaMaxD: 4, pmaxLong: 90, dgH: 40, dgMax: 5, dispH: 30, dispMax: 5, dispLong: 90, callout: 25, ttText: 100, pinTitle: 100, pinDesc: 800, snapHead: 34, snapBrand: 32 };
  var STRUCT = {
    meta: { groups: 20, ads: 50, note: 'Meta allows up to 50 ads per ad set; OrivenAI publishes up to 20 ad sets per campaign.' },
    google: { groups: 20, ads: 3, note: 'Google Ads serves at most 3 responsive search ads per ad group; OrivenAI publishes up to 20 ad groups.' },
    googleDisplay: { groups: 20, ads: 5, note: 'OrivenAI publishes up to 20 ad groups with 5 display ads each.' },
    googleVideo: { groups: 10, ads: 5, note: 'OrivenAI publishes up to 10 ad groups with 5 video ads each.' },
    tiktok: { groups: 20, ads: 20, note: 'TikTok allows up to 20 ads per ad group; OrivenAI publishes up to 20 ad groups.' },
    pinterest: { groups: 20, ads: 10, note: 'OrivenAI publishes up to 20 ad groups with 10 Pins each.' },
    snapchat: { groups: 10, ads: 10, note: 'OrivenAI publishes up to 10 ad squads with 10 ads each (Snapchat needs 5 per day for each ad squad).' },
  };
  var STEPS = ['Platform', 'Campaign', 'Audience & delivery', 'Ads', 'Review'];

  var nextId = 1;
  function newAd(src) { return Object.assign({ id: 'a' + Date.now().toString(36) + (nextId++), name: '', headline: '', primaryText: '', description: '', cta: '', adText: '', title: '', pinDescription: '', altText: '', headlines: '', descriptions: '', longHeadline: '', longHeadlines: '', youtube: '', image: null, landscape: null, video: null, open: true }, src || {}); }
  function newGroup(src) { return Object.assign({ id: 'g' + Date.now().toString(36) + (nextId++), name: '', ageMin: '', ageMax: '', keywords: '', ads: [newAd()] }, src || {}); }
  function blank() {
    return { v: 2, step: 1, platform: null, name: '', goal: '', gtype: 'SEARCH', ttObjective: '', budget: '', specialCat: null, dsaBeneficiary: '', dsaPayor: '',
      countries: '', languages: '', ageMin: 18, ageMax: 65, placement: 'automatic', url: '', creative: 'image', brandName: '', matchType: 'PHRASE', negatives: '', callouts: '',
      headlines: '', descriptions: '', longHeadline: '', image: null, landscape: null, groups: [newGroup()], uploading: '' };
  }
  // A v1 draft (one ad set, one ad, flat fields) → v2, keeping every value.
  function migrate(x) {
    if (!x || typeof x !== 'object') return blank();
    if (x.v === 2 && Array.isArray(x.groups) && x.groups.length) return Object.assign(blank(), x, { uploading: '' });
    var d = Object.assign(blank(), x, { v: 2, uploading: '' });
    var ad = newAd({ headline: x.headline || '', primaryText: x.primaryText || '', description: x.description || '', cta: x.cta || '', adText: x.adText || '', title: x.title || '', pinDescription: x.platform === 'pinterest' ? (x.description || '') : '', altText: x.altText || '', headlines: x.headlines || '', descriptions: x.descriptions || '', longHeadline: x.longHeadline || '', image: x.image || null, landscape: x.landscape || null, video: x.video || null });
    d.groups = [newGroup({ name: x.groupName || '', keywords: x.keywords || '', ads: [ad] })];
    ['groupName', 'keywords', 'headline', 'primaryText', 'adText', 'title', 'altText', 'cta', 'video'].forEach(function (k) { delete d[k]; });
    return d;
  }
  var M = { mode: null, d: blank(), review: null, conn: {}, choices: null, saved: null, editId: null };
  function load() {
    M.mode = sget(MODE_KEY) || null;
    try { var x = JSON.parse(sget(DRAFT_KEY) || 'null'); if (x && (x.v === 1 || x.v === 2)) M.d = migrate(x); } catch (_) {}
    M.editId = sget(DRAFT_KEY + 'edit:') || null;
  }
  function clean(d) { var c = JSON.parse(JSON.stringify(d)); delete c.uploading; return c; }
  function save() { sset(DRAFT_KEY, JSON.stringify(clean(M.d))); sset(DRAFT_KEY + 'edit:', M.editId || null); }
  function adFilled(a) { return !!(a && (a.headline || a.primaryText || a.adText || a.title || a.headlines || a.image || a.video || a.youtube)); }
  function hasWork() { var d = M.d; return !!(d.platform || d.name || d.url) || d.groups.some(function (g) { return g.ads.some(adFilled); }); }

  // ── Which shape the current platform/type uses ──────────────────
  function kind() {
    var d = M.d, p = d.platform;
    if (p === 'google') return d.gtype === 'SEARCH' ? 'gsearch' : d.gtype === 'DISPLAY' ? 'gdisplay' : d.gtype === 'DEMAND_GEN_VIDEO' ? 'gvideo' : 'gsingle';
    return p;
  }
  function structLimits() { var k = kind(); return k === 'gsearch' ? STRUCT.google : k === 'gdisplay' ? STRUCT.googleDisplay : k === 'gvideo' ? STRUCT.googleVideo : STRUCT[M.d.platform] || STRUCT.meta; }
  function hasGroups() { return kind() !== 'gsingle'; }
  function apiType() { var t = M.d.gtype; return t === 'DEMAND_GEN_VIDEO' ? 'DEMAND_GEN' : t; }

  // ── Elements ─────────────────────────────────────────────────────
  function page() { return document.getElementById('page-create'); }
  function root() {
    var r = document.getElementById('crmRoot'); if (r) return r;
    var pg = page(), hero = pg && pg.querySelector('.cr2-hero'); if (!hero) return null;
    r = document.createElement('div'); r.id = 'crmRoot'; r.className = 'crm';
    hero.parentNode.insertBefore(r, hero.nextSibling);
    r.addEventListener('click', onClick); r.addEventListener('input', onInput); r.addEventListener('change', onInput);
    return r;
  }
  // The hero's switch button: ONE click handler, reading the target from the
  // button itself (the earlier version had two handlers that fought each other:
  // one reset the mode, the other then switched to the wrong one).
  function heroTexts() {
    var t = document.getElementById('cfTitle'), s = document.getElementById('cfSubtitle'); if (!t || !s) return;
    if (!heroTexts.ai) heroTexts.ai = [t.textContent, s.textContent];
    if (M.mode === 'manual') { t.textContent = 'Create an ad manually'; s.textContent = 'Build it yourself with the settings and fields the platform requires.'; }
    else if (M.mode === 'ai') { t.textContent = heroTexts.ai[0]; s.textContent = heroTexts.ai[1]; }
    else { t.textContent = 'Create an ad'; s.textContent = 'Choose how you want to create it. You can switch later without losing your work.'; }
    var hero = t.closest('.cr2-hero'), sw = document.getElementById('crmSwitch');
    if (hero && !sw) {
      sw = document.createElement('button'); sw.type = 'button'; sw.id = 'crmSwitch'; sw.className = 'crm-switch';
      sw.addEventListener('click', function () { var to = sw.getAttribute('data-crm-to'); if (to === 'ai' || to === 'manual') choose(to); });
      hero.appendChild(sw);
    }
    if (sw) {
      var to = M.mode === 'manual' ? 'ai' : 'manual';
      sw.hidden = !M.mode;
      sw.setAttribute('data-crm-to', to);
      sw.textContent = to === 'ai' ? 'Switch to Create with AI' : 'Create manually instead';
    }
  }
  // Switching never discards: the AI flow keeps its own saved state and the
  // manual draft stays here until it is saved or discarded (with a confirmation).
  function choose(mode) {
    M.mode = mode === 'ai' || mode === 'manual' ? mode : null;
    sset(MODE_KEY, M.mode);
    render();
    if (M.mode === 'ai' && window.orvCreate && typeof window.orvCreate.mount === 'function') { try { window.orvCreate.mount(); } catch (_) {} }
    try { var pg = page(); if (pg) pg.scrollTop = 0; } catch (_) {}
  }

  // ── Render ───────────────────────────────────────────────────────
  function render() {
    var pg = page(), r = root(); if (!pg || !r) return;
    pg.classList.toggle('crm-choose', !M.mode);
    pg.classList.toggle('crm-manual', M.mode === 'manual');
    pg.classList.toggle('crm-ai', M.mode === 'ai');
    heroTexts();
    if (!M.mode) { r.innerHTML = chooser(); return; }
    if (M.mode === 'ai') { r.innerHTML = ''; return; }
    r.innerHTML = wizard();
    if (M.d.step === 3) loadChoices();
    if (M.d.step === 5 && !M.review) runReview();
    if (M.d.step === 1) ORDER.forEach(loadConn); else if (M.d.platform && !M.conn[M.d.platform]) loadConn(M.d.platform);
  }
  function chooser() {
    var draft = hasWork() && M.d.platform ? '<p class="crm-note">You have a manual draft for ' + esc(PLAT[M.d.platform].name) + ' — it’s kept until you save or discard it.</p>' : '';
    return '<div class="crm-choose" role="group" aria-label="How do you want to create your ad?">' +
      card('ai', 'Create with AI', 'Let OrivenAI help you plan and create your advertisement.', ['You answer a few questions', 'OrivenAI writes the copy and can make images or video', 'You review and edit before anything is published'],
        '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>') +
      card('manual', 'Create manually', 'Build your advertisement yourself using the advertising platform’s required settings and fields.', ['Choose the platform first', 'Build ad sets or ad groups with as many ads as the platform allows', 'Checked against the platform’s rules before you save'],
        '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>') +
      '</div>' + draft;
  }
  function card(mode, h, d, bullets, ic) {
    return '<button type="button" class="crm-opt" data-crm-choose="' + mode + '"><span class="crm-opt__ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ic + '</svg></span>' +
      '<span class="crm-opt__t">' + esc(h) + '</span><span class="crm-opt__d">' + esc(d) + '</span><ul>' + bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul><span class="crm-opt__go">' + esc(mode === 'ai' ? 'Start with AI' : 'Start manually') + ' →</span></button>';
  }

  function wizard() {
    var d = M.d, s = d.step;
    var steps = '<ol class="crm-steps">' + STEPS.map(function (n, i) {
      var k = i + 1, can = k === 1 || (d.platform && k <= maxStep());
      var label = k === 4 && d.platform ? (hasGroups() ? cap(PLAT[d.platform].units) + ' & ads' : 'Ad') : n;
      return '<li class="' + (k === s ? 'is-on' : k < s ? 'is-done' : '') + '"><button type="button" ' + (can ? 'data-crm-step="' + k + '"' : 'disabled') + (k === s ? ' aria-current="step"' : '') + '><b>' + k + '</b>' + esc(label) + '</button></li>';
    }).join('') + '</ol>';
    var body = s === 1 ? stepPlatform() : s === 2 ? stepCampaign() : s === 3 ? stepAudience() : s === 4 ? stepAds() : stepReview();
    var errs = s >= 2 && s <= 4 ? problems(s) : [];
    var nav = '<div class="crm-nav">' + (s > 1 ? '<button type="button" class="crm-btn" data-crm-step="' + (s - 1) + '">← Back</button>' : '<span></span>') +
      '<span class="crm-nav__r"><button type="button" class="crm-link" data-crm-discard>Discard draft</button>' +
      (s < 5 ? '<button type="button" class="crm-btn crm-btn--primary" data-crm-next ' + (s === 1 && !d.platform ? 'disabled' : '') + '>' + (s === 4 ? 'Review' : 'Next') + '</button>' : '') + '</span></div>';
    var editing = M.editId ? '<p class="crm-note">Editing a saved campaign — saving updates it in Campaigns.</p>' : '';
    return '<div class="crm-wiz">' + steps + editing + '<section class="crm-card" aria-labelledby="crmH">' + body +
      (errs.length && M.tried === s ? '<div class="crm-errs" role="alert" tabindex="-1"><b>Before you continue:</b><ul>' + errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>' : '') + nav + '</section></div>';
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function maxStep() { var d = M.d; if (!d.platform) return 1; for (var k = 2; k <= 4; k++) if (problems(k).length) return k; return 5; }

  function savedManual() {
    var list = typeof window._orvGetCampaigns === 'function' ? (window._orvGetCampaigns() || []) : [];
    return list.filter(function (c) { return c && c.creationMode === 'manual' && c.pkg && c.pkg.manualDraft && (c.status === 'generated' || c.status === 'draft'); });
  }
  function stepPlatform() {
    var saved = savedManual();
    var list = saved.length ? '<details class="crm-saved"><summary>Edit a saved manual campaign (' + saved.length + ')</summary><ul>' + saved.slice(0, 12).map(function (c) {
      return '<li><span><b>' + esc(c.name) + '</b> · ' + esc((PLAT[c.platform] || {}).name || c.platform) + '</span><button type="button" class="crm-btn" data-crm-edit="' + esc(c.id) + '">Edit</button></li>';
    }).join('') + '</ul></details>' : '';
    return '<h2 id="crmH">Which advertising platform do you want to create an ad for?</h2><p class="crm-sub">Each platform has its own campaign structure, formats and required fields, so this comes first.</p>' +
      '<div class="crm-plats" role="radiogroup" aria-label="Advertising platform">' + ORDER.map(function (p) {
        var c = M.conn[p], st = !c ? '' : c.loading ? 'Checking connection…' : c.connected ? 'Connected' + (c.account ? ' · ' + c.account : '') : 'Not connected — you can prepare the ad now and connect before publishing';
        return '<button type="button" role="radio" aria-checked="' + (M.d.platform === p) + '" class="crm-plat' + (M.d.platform === p ? ' is-on' : '') + '" data-crm-plat="' + p + '"><b>' + esc(PLAT[p].name) + '</b><span>' + esc(PLAT[p].fmt) + '</span><small>' + esc(PLAT[p].levels.join(' → ')) + '</small>' + (st ? '<em class="' + (c && c.connected ? 'is-ok' : '') + '">' + esc(st) + '</em>' : '') + '</button>';
      }).join('') + '</div>' + list;
  }
  function goals() {
    var p = M.d.platform, type = p === 'google' ? apiType() : null;
    var g = CC ? CC.goalOptions(p, type) : ['Sales', 'Leads', 'Traffic', 'Awareness'].map(function (x) { return { goal: x, label: GOAL_LABEL[x], available: true }; });
    if (p === 'tiktok' && M.d.ttObjective === 'VideoViews') g = g.map(function (x) { return Object.assign({}, x, { available: x.goal === 'Awareness', reason: x.goal === 'Awareness' ? null : 'Video Views campaigns use the awareness goal.' }); });
    return g;
  }
  function stepCampaign() {
    var d = M.d, p = d.platform, P = PLAT[p];
    var h = '<h2 id="crmH">' + esc(P.levels[0]) + '</h2><p class="crm-sub">The ' + esc(P.name) + ' campaign: its name, what it should achieve and what it may spend.</p>';
    h += field('Campaign name', '<input class="crm-in" data-crm="name" maxlength="200" value="' + esc(d.name) + '" placeholder="e.g. Autumn candles — website visits">', true);
    if (p === 'google') h += field('Campaign type', '<select class="crm-in" data-crm="gtype">' + Object.keys(GTYPE).map(function (k) { return '<option value="' + k + '"' + (d.gtype === k ? ' selected' : '') + '>' + esc(GTYPE[k]) + '</option>'; }).join('') + '</select>', true, esc(GTYPE_HELP[d.gtype]));
    if (p === 'tiktok') h += '<fieldset class="crm-fs"><legend>Objective type <i>required</i></legend><div class="crm-goals">' +
      [['', 'Standard (traffic or awareness)', 'Website visits or reach, chosen below.'], ['VideoViews', 'Video Views', 'TikTok optimises for video views and charges per view (CPV).']].map(function (o) {
        return '<label class="crm-goal"><input type="radio" name="crmTtObj" data-crm="ttObjective" value="' + o[0] + '"' + (d.ttObjective === o[0] ? ' checked' : '') + '><b>' + esc(o[1]) + '</b><small>' + esc(o[2]) + '</small></label>';
      }).join('') + '</div><p class="crm-help">Not available in OrivenAI: Website conversions (needs a TikTok Pixel event OrivenAI can’t select yet), Lead generation (TikTok instant forms), App promotion (needs an app) and Product sales (needs a catalog or TikTok Shop).</p></fieldset>';
    h += '<fieldset class="crm-fs"><legend>Objective <i>required</i></legend><div class="crm-goals">' + goals().map(function (g) {
      return '<label class="crm-goal' + (g.available ? '' : ' is-off') + '"><input type="radio" name="crmGoal" data-crm="goal" value="' + g.goal + '"' + (d.goal === g.goal ? ' checked' : '') + (g.available ? '' : ' disabled') + '><b>' + esc(g.label || GOAL_LABEL[g.goal]) + '</b>' + (g.available ? '' : '<small>' + esc(g.reason || 'Not available on this platform in OrivenAI.') + '</small>') + '</label>';
    }).join('') + '</div></fieldset>';
    h += field('Daily budget' + (p === 'snapchat' ? ' (split over the ad squads)' : p === 'google' || p === 'pinterest' ? ' (campaign)' : ' (per ' + PLAT[p].unit + ')'), '<input class="crm-in crm-in--num" data-crm="budget" inputmode="decimal" value="' + esc(d.budget) + '" placeholder="e.g. 25">', true,
      'In your ad account’s currency. OrivenAI never spends more than you set.' + (p === 'tiktok' ? ' TikTok requires more than 20 per day per ad group (USD/EUR/GBP).' : p === 'snapchat' ? ' Snapchat requires at least 5 per day for each ad squad.' : ''));
    if (p === 'meta') {
      h += '<fieldset class="crm-fs"><legend>Special ad category <i>required</i></legend><p class="crm-help">Meta requires you to say whether the ad is about one of these. Ads in a category have restricted targeting.</p><div class="crm-goals">' +
        META_CATS.map(function (c) { return '<label class="crm-goal"><input type="radio" name="crmCat" data-crm="specialCat" value="' + c[0] + '"' + (d.specialCat === c[0] ? ' checked' : '') + '><b>' + esc(c[1]) + '</b></label>'; }).join('') + '</div></fieldset>';
    }
    return h;
  }
  function stepAudience() {
    var d = M.d, p = d.platform;
    var h = '<h2 id="crmH">Audience and delivery</h2><p class="crm-sub">Who sees the ads and where.' + (hasGroups() && kind() !== 'gsearch' && kind() !== 'gdisplay' ? ' Each ' + PLAT[p].unit + ' can use its own age range in the next step.' : '') + '</p>';
    var list = M.choices && M.choices.countries;
    var help = p === 'snapchat' ? 'Snapchat: exactly one country per campaign.' : p === 'pinterest' ? 'Pinterest ads aren’t available in every country; the review warns when one isn’t.' : 'Choose at least one.';
    if (list) {
      var sel = csv(d.countries);
      h += '<fieldset class="crm-fs"><legend>Countries <i>required</i></legend><p class="crm-help">' + esc(help) + '</p><div class="crm-countries">' + list.map(function (c) {
        return '<label class="crm-chip' + (sel.indexOf(c.iso) >= 0 ? ' is-on' : '') + '"><input type="checkbox" data-crm-country="' + c.iso + '"' + (sel.indexOf(c.iso) >= 0 ? ' checked' : '') + '>' + esc(c.name) + '</label>';
      }).join('') + '</div></fieldset>';
    } else h += field('Countries (two-letter codes)', '<input class="crm-in" data-crm="countries" value="' + esc(d.countries) + '" placeholder="e.g. NL, BE">', true, help + ' The full list loads from your account connection.');
    h += field('Languages', '<input class="crm-in" data-crm="languages" value="' + esc(d.languages) + '" placeholder="Optional — e.g. nl, en (all languages when empty)">', false, 'Language codes, separated by commas.');
    h += '<div class="crm-row">' + field('Minimum age', '<input class="crm-in crm-in--num" data-crm="ageMin" inputmode="numeric" value="' + esc(d.ageMin) + '">', true) + field('Maximum age', '<input class="crm-in crm-in--num" data-crm="ageMax" inputmode="numeric" value="' + esc(d.ageMax) + '">', true, p === 'meta' ? '65 means 65 and older.' : p === 'tiktok' ? 'TikTok targets age groups (18–24, 25–34, …); the range is matched to them.' : '') + '</div>';
    if (p === 'meta') {
      h += field('Placements', '<select class="crm-in" data-crm="placement"><option value="automatic"' + (d.placement === 'automatic' ? ' selected' : '') + '>Facebook and Instagram (automatic)</option><option value="instagram_only"' + (d.placement === 'instagram_only' ? ' selected' : '') + '>Instagram only</option><option value="facebook_only"' + (d.placement === 'facebook_only' ? ' selected' : '') + '>Facebook only</option></select>', true, 'Instagram only needs an Instagram account linked to your Page.');
      h += '<div class="crm-row">' + field('Beneficiary (EU ads)', '<input class="crm-in" data-crm="dsaBeneficiary" maxlength="120" value="' + esc(d.dsaBeneficiary) + '" placeholder="Who benefits from the ad">', false) + field('Payer (EU ads)', '<input class="crm-in" data-crm="dsaPayor" maxlength="120" value="' + esc(d.dsaPayor) + '" placeholder="Who pays for the ad">', false, 'Required by Meta when you target an EU country. Your business name is used when empty.') + '</div>';
    } else if (p === 'tiktok') h += '<p class="crm-help">Placement: the TikTok feed. (TikTok image ads only run on other placements, which OrivenAI doesn’t publish to.)</p>';
    else if (p === 'snapchat') h += '<p class="crm-help">Placement: Snapchat (automatic placements).</p>';
    return h;
  }

  // ── Step 4: the hierarchy ────────────────────────────────────────
  function stepAds() {
    var d = M.d, p = d.platform, k = kind(), P = PLAT[p], L = structLimits();
    var h = '<h2 id="crmH">' + (hasGroups() ? cap(P.units) + ' and ads' : 'Ad') + '</h2><p class="crm-sub">' + (hasGroups() ? 'Campaign → ' + esc(P.units) + ' → ads. Add as many as you need; each ad has its own copy and ' + (k === 'gsearch' ? 'text' : k === 'gvideo' ? 'YouTube video' : 'media') + '. ' + esc(L.note) : 'Performance Max and Demand Gen image campaigns use one set of assets.') + '</p>';
    h += field('Destination URL', '<input class="crm-in" data-crm="url" type="url" value="' + esc(d.url) + '" placeholder="https://yourshop.com/page">', true, 'The page people land on. OrivenAI adds UTM parameters so you can see the visits in your analytics.');
    if (p === 'meta' || p === 'pinterest' || p === 'snapchat') h += field('Format', select('creative', [['image', p === 'pinterest' ? 'Image Pins' : 'Image ads'], ['video', p === 'pinterest' ? 'Video Pins' : 'Video ads']], d.creative), true,
      p === 'meta' && d.creative === 'video' ? 'Meta video: MP4 or MOV, 1 second to 240 minutes, aspect ratio between 9:16 and 16:9 (1:1, 4:5 or 9:16 work best). OrivenAI uploads it to your ad account, waits for Meta to process it and uses Meta’s thumbnail.' : p === 'snapchat' && d.creative === 'video' ? 'Snapchat video: vertical 9:16 (1080 × 1920), MP4 or MOV, at least 3 seconds.' : '');
    if (p === 'snapchat') h += field('Brand name', '<input class="crm-in" data-crm="brandName" maxlength="32" value="' + esc(d.brandName) + '" placeholder="Your business name">', true, count(d.brandName, LIM.snapBrand, 'Shown on every ad. Up to 32 characters.', true));
    if (k === 'gsearch') h += '<div class="crm-row">' + field('Match type for the keywords', select('matchType', [['PHRASE', 'Phrase match'], ['EXACT', 'Exact match'], ['BROAD', 'Broad match']], d.matchType), true) + field('Negative keywords (one per line)', '<textarea class="crm-in" data-crm="negatives" rows="2" placeholder="Optional — e.g. free, diy">' + esc(d.negatives) + '</textarea>') + '</div>' +
      field('Callouts (one per line)', '<textarea class="crm-in" data-crm="callouts" rows="2" placeholder="Optional — e.g. Free delivery (up to 25 characters)">' + esc(d.callouts) + '</textarea>', false, lines(d.callouts, LIM.callout, 0, 20));
    if (k === 'gdisplay' || k === 'gvideo') h += '<p class="crm-help">Your business name' + (k === 'gvideo' ? ' and logo come' : ' (and logo, when there is one) comes') + ' from your business profile; the review says if ' + (k === 'gvideo' ? 'one is' : 'it is') + ' missing.</p>';
    if (k === 'gsingle') return h + singleAssets();
    h += '<div class="crm-groups">' + d.groups.map(function (g, gi) { return groupHtml(g, gi); }).join('') + '</div>';
    h += '<div class="crm-add"><button type="button" class="crm-btn" data-crm-addgroup' + (d.groups.length >= L.groups ? ' disabled' : '') + '>+ Add ' + esc(P.unit) + '</button><small>' + d.groups.length + ' of ' + L.groups + ' ' + esc(P.units) + '</small></div>';
    return h;
  }
  function groupHtml(g, gi) {
    var d = M.d, p = d.platform, k = kind(), P = PLAT[p], L = structLimits();
    var h = '<section class="crm-group" data-gi="' + gi + '" aria-label="' + esc(cap(P.unit) + ' ' + (gi + 1)) + '"><header class="crm-group__h"><b>' + esc(cap(P.unit) + ' ' + (gi + 1)) + '</b>' +
      (d.groups.length > 1 ? '<button type="button" class="crm-link" data-crm-rmgroup="' + gi + '">Remove ' + esc(P.unit) + '</button>' : '') + '</header>';
    h += '<div class="crm-row">' + field(cap(P.unit) + ' name', '<input class="crm-in" data-crm-g="' + gi + ':name" maxlength="200" value="' + esc(g.name) + '" placeholder="Optional — named after the campaign">') +
      (k === 'gsearch' || k === 'gdisplay' ? '<span></span>' : '<div class="crm-row crm-row--tight">' + field('Age from', '<input class="crm-in crm-in--num" data-crm-g="' + gi + ':ageMin" inputmode="numeric" value="' + esc(g.ageMin) + '" placeholder="' + esc(d.ageMin) + '">') + field('to', '<input class="crm-in crm-in--num" data-crm-g="' + gi + ':ageMax" inputmode="numeric" value="' + esc(g.ageMax) + '" placeholder="' + esc(d.ageMax) + '">') + '</div>') + '</div>';
    if (k === 'gsearch') h += field('Keywords for this ad group (one per line)', '<textarea class="crm-in" data-crm-g="' + gi + ':keywords" rows="3" placeholder="soy candles&#10;handmade candles">' + esc(g.keywords) + '</textarea>', true, 'Up to 20 per ad group, with the match type chosen above.');
    h += '<div class="crm-ads">' + g.ads.map(function (a, ai) { return adHtml(a, gi, ai); }).join('') + '</div>';
    h += '<div class="crm-add"><button type="button" class="crm-btn" data-crm-addad="' + gi + '"' + (g.ads.length >= L.ads ? ' disabled' : '') + '>+ Add ad</button><small>' + g.ads.length + ' of ' + L.ads + ' ads</small></div></section>';
    return h;
  }
  function adTitle(a, ai) {
    var k = kind(), t = k === 'gsearch' || k === 'gdisplay' || k === 'gvideo' ? nl(a.headlines)[0] : M.d.platform === 'tiktok' ? a.adText : M.d.platform === 'pinterest' ? a.title : a.headline;
    return (a.name || 'Ad ' + (ai + 1)) + (t ? ' — ' + t : '');
  }
  function adHtml(a, gi, ai) {
    var d = M.d, p = d.platform, k = kind(), at = gi + ':' + ai + ':';
    var inp = function (key, max, ph) { return '<input class="crm-in" data-crm-a="' + at + key + '" maxlength="' + max + '" value="' + esc(a[key]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'; };
    var ta = function (key, rows, ph, max) { return '<textarea class="crm-in" data-crm-a="' + at + key + '" rows="' + rows + '"' + (max ? ' maxlength="' + max + '"' : '') + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(a[key]) + '</textarea>'; };
    var sel = function (key, opts, val) { return '<select class="crm-in" data-crm-a="' + at + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    var body = field('Ad name', inp('name', 200, 'Optional'), false);
    if (p === 'meta') {
      body += field('Primary text', ta('primaryText', 3, 'The main text above the media', 2200), true, count(a.primaryText, 125, 'Meta shows about 125 characters before “See more”.'));
      body += field('Headline', inp('headline', 255), true, count(a.headline, 40, 'About 40 characters show in most placements.'));
      body += field('Description', inp('description', 255, 'Optional'), false);
      body += field('Call to action', sel('cta', META_CTAS.map(function (c) { return [c, c]; }), a.cta || 'Learn more'), true);
      body += d.creative === 'video' ? upload(a, gi, ai, 'video', 'video', 'Video', true) : upload(a, gi, ai, 'image', 'image', 'Image', true, 'JPG, PNG, WEBP or GIF, at least 600 × 314 px, up to 8 MB. 1:1 or 4:5 works best in feeds.');
    } else if (k === 'gsearch') {
      body += field('Headlines (one per line)', ta('headlines', 5, '3 to 15 headlines, up to 30 characters each'), true, lines(a.headlines, LIM.rsaH, LIM.rsaMinH, LIM.rsaMaxH));
      body += field('Descriptions (one per line)', ta('descriptions', 3, '2 to 4 descriptions, up to 90 characters each'), true, lines(a.descriptions, LIM.rsaD, LIM.rsaMinD, LIM.rsaMaxD));
    } else if (k === 'gdisplay') {
      body += field('Headlines (one per line)', ta('headlines', 3, '1 to 5 headlines, up to 30 characters each'), true, lines(a.headlines, LIM.dispH, 1, LIM.dispMax));
      body += field('Long headline', inp('longHeadline', 90), true, count(a.longHeadline, LIM.dispLong, 'Up to 90 characters.', true));
      body += field('Descriptions (one per line)', ta('descriptions', 3, '1 to 5 descriptions, up to 90 characters each'), true, lines(a.descriptions, LIM.rsaD, 1, LIM.dispMax));
      body += upload(a, gi, ai, 'image', 'image', 'Square image (1:1)', true, 'At least 300 × 300 px.');
      body += upload(a, gi, ai, 'landscape', 'image', 'Landscape image (1.91:1)', true, 'At least 600 × 314 px, e.g. 1200 × 628. OrivenAI crops it to the exact ratio.');
    } else if (k === 'gvideo') {
      body += field('YouTube video', inp('youtube', 200, 'https://www.youtube.com/watch?v=… or the 11-character id'), true, 'The video must be on YouTube (public or unlisted).' + (a.youtube && !ytId(a.youtube) ? ' <span class="crm-count is-bad">That isn’t a YouTube link or id.</span>' : ''));
      body += field('Headlines (one per line)', ta('headlines', 3, '1 to 5 headlines, up to 40 characters each'), true, lines(a.headlines, LIM.dgH, 1, LIM.dgMax));
      body += field('Long headlines (one per line)', ta('longHeadlines', 2, '1 to 5, up to 90 characters each'), true, lines(a.longHeadlines, LIM.pmaxLong, 1, LIM.dgMax));
      body += field('Descriptions (one per line)', ta('descriptions', 3, '1 to 5, up to 90 characters each'), true, lines(a.descriptions, LIM.rsaD, 1, LIM.dgMax));
    } else if (p === 'tiktok') {
      body += field('Ad text', ta('adText', 2, '', 100), true, count(a.adText, LIM.ttText, 'Up to 100 characters.', true));
      body += field('Call to action', sel('cta', TIKTOK_CTAS.map(function (c) { return [c, c]; }), a.cta || 'Learn more'), true);
      body += upload(a, gi, ai, 'video', 'video', 'Video', true, 'Vertical (9:16) MP4, MOV or WEBM, up to 12 MB in OrivenAI. TikTok extracts the cover image from the video.');
    } else if (p === 'pinterest') {
      body += field('Pin title', inp('title', 100), true, count(a.title, LIM.pinTitle, 'Up to 100 characters.', true));
      body += field('Pin description', ta('pinDescription', 3, '', 800), false, count(a.pinDescription, LIM.pinDesc, 'Up to 800 characters.', true));
      body += field('Alt text', inp('altText', 500, 'Describe the image for people using screen readers'), false);
      body += d.creative === 'video' ? upload(a, gi, ai, 'video', 'video', 'Video', true, 'MP4, MOV or WEBM, up to 12 MB in OrivenAI. 2:3 or 9:16 works best.') : upload(a, gi, ai, 'image', 'image', 'Image', true, '2:3 (e.g. 1000 × 1500 px) works best.');
    } else if (p === 'snapchat') {
      body += field('Headline', inp('headline', 34), true, count(a.headline, LIM.snapHead, 'Up to 34 characters.', true));
      body += field('Call to action', sel('cta', SNAP_CTAS, a.cta || 'MORE'), true);
      body += d.creative === 'video' ? upload(a, gi, ai, 'video', 'video', 'Video', true) : upload(a, gi, ai, 'image', 'image', 'Image', true, 'Vertical 9:16 (1080 × 1920 px).');
    }
    var g = d.groups[gi];
    return '<details class="crm-ad" data-ad="' + gi + ':' + ai + '"' + (a.open ? ' open' : '') + '><summary><span>' + esc(adTitle(a, ai)) + '</span><span class="crm-ad__acts">' +
      '<button type="button" class="crm-link" data-crm-dupad="' + gi + ':' + ai + '"' + (g.ads.length >= structLimits().ads ? ' disabled' : '') + '>Duplicate</button>' +
      (g.ads.length > 1 ? '<button type="button" class="crm-link" data-crm-rmad="' + gi + ':' + ai + '">Remove</button>' : '') + '</span></summary><div class="crm-ad__b">' + body + '</div></details>';
  }
  // Performance Max / Demand Gen image: campaign-level assets (one asset group).
  function singleAssets() {
    var d = M.d, dg = d.gtype === 'DEMAND_GEN', h = '';
    h += field('Headlines (one per line)', '<textarea class="crm-in" data-crm="headlines" rows="4" placeholder="' + (dg ? 'Up to 5 headlines, 40 characters each' : '3 to 15 headlines, 30 characters each') + '">' + esc(d.headlines) + '</textarea>', true, dg ? lines(d.headlines, LIM.dgH, 1, LIM.dgMax) : lines(d.headlines, LIM.rsaH, LIM.rsaMinH, LIM.rsaMaxH));
    if (!dg) h += field('Long headline', '<input class="crm-in" data-crm="longHeadline" maxlength="90" value="' + esc(d.longHeadline) + '">', true, count(d.longHeadline, LIM.pmaxLong, 'Up to 90 characters.'));
    h += field('Descriptions (one per line)', '<textarea class="crm-in" data-crm="descriptions" rows="3" placeholder="' + (dg ? 'Up to 5, 90 characters each' : '2 to 4; the first up to 60 characters') + '">' + esc(d.descriptions) + '</textarea>', true, lines(d.descriptions, LIM.rsaD, dg ? 1 : 2, dg ? LIM.dgMax : 4));
    h += campaignUpload('image', 'Square image (1:1)', 'At least 600 × 600 px recommended.');
    if (!dg) h += campaignUpload('landscape', 'Landscape image (1.91:1)', 'Performance Max needs a landscape image as well, e.g. 1200 × 628 px.');
    h += '<p class="crm-help">Your business name and logo come from your business profile; the review says if one is missing.</p>';
    return h;
  }
  function preview(v, kindOf) { return v && v.url ? '<div class="crm-up__p">' + (kindOf === 'video' ? '<video src="' + esc(v.url) + '" muted playsinline preload="metadata"></video>' : '<img src="' + esc(v.url) + '" alt="">') + '<span>' + esc(v.name || '') + (v.width ? ' · ' + v.width + '×' + v.height : '') + (v.duration ? ' · ' + Math.round(v.duration) + ' s' : '') + '</span></div>' : ''; }
  function upload(a, gi, ai, key, kindOf, label, req, help) {
    var v = a[key], path = gi + ':' + ai + ':' + key, busy = M.d.uploading === path;
    var accept = kindOf === 'video' ? (M.d.platform === 'meta' || M.d.platform === 'snapchat' ? 'video/mp4,video/quicktime' : 'video/mp4,video/quicktime,video/webm') : 'image/jpeg,image/png,image/webp,image/gif';
    return field(label, '<div class="crm-up">' + preview(v, kindOf) + '<label class="crm-btn crm-up__b"' + (busy ? ' aria-busy="true"' : '') + '><input type="file" hidden accept="' + accept + '" data-crm-file="' + path + '" data-crm-kind="' + kindOf + '">' + (busy ? 'Uploading…' : v ? 'Replace' : 'Upload ' + kindOf) + '</label>' + (v ? '<button type="button" class="crm-link" data-crm-clear="' + path + '">Remove</button>' : '') + '</div>', req, help);
  }
  function campaignUpload(key, label, help) {
    var v = M.d[key], path = 'c:' + key, busy = M.d.uploading === path;
    return field(label, '<div class="crm-up">' + preview(v, 'image') + '<label class="crm-btn crm-up__b"' + (busy ? ' aria-busy="true"' : '') + '><input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" data-crm-file="' + path + '" data-crm-kind="image">' + (busy ? 'Uploading…' : v ? 'Replace' : 'Upload image') + '</label>' + (v ? '<button type="button" class="crm-link" data-crm-clear="' + path + '">Remove</button>' : '') + '</div>', true, help);
  }

  function stepReview() {
    var d = M.d, p = d.platform, R = M.review, P = PLAT[p];
    var h = '<h2 id="crmH">Review</h2><p class="crm-sub">Checked by OrivenAI against ' + esc(P.name) + '’s rules, its limits and your connected account. Saving keeps it as a draft in Campaigns; you publish it from Campaign Studio, where you confirm first and it is created paused.</p>';
    var nAds = d.groups.reduce(function (n, g) { return n + g.ads.length; }, 0);
    h += '<dl class="crm-sum">' + [
      [P.levels[0], d.name + ' · ' + (GOAL_LABEL[d.goal] || d.goal) + (p === 'google' ? ' · ' + GTYPE[d.gtype] : '') + (p === 'tiktok' && d.ttObjective === 'VideoViews' ? ' · Video Views' : '') + ' · ' + d.budget + ' per day'],
      ['Audience', csv(d.countries).join(', ') + ' · ages ' + d.ageMin + '–' + d.ageMax + (p === 'meta' ? ' · ' + ({ automatic: 'Facebook and Instagram', instagram_only: 'Instagram only', facebook_only: 'Facebook only' })[d.placement] : '')],
      [hasGroups() ? cap(P.units) : 'Ads', hasGroups() ? d.groups.length + ' ' + (d.groups.length === 1 ? P.unit : P.units) + ', ' + nAds + ' ad' + (nAds === 1 ? '' : 's') + (p === 'meta' || p === 'pinterest' || p === 'snapchat' ? ' · ' + d.creative : '') : 'One asset group'],
      ['Destination', d.url],
    ].map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (hasGroups()) h += '<ul class="crm-tree">' + d.groups.map(function (g, gi) { return '<li><b>' + esc(g.name || cap(P.unit) + ' ' + (gi + 1)) + '</b><ul>' + g.ads.map(function (a, ai) { return '<li>' + esc(adTitle(a, ai)) + '</li>'; }).join('') + '</ul></li>'; }).join('') + '</ul>';
    if (!R || R.loading) h += '<div class="crm-check" role="status">Checking with OrivenAI…</div>';
    else if (R.failed) h += '<div class="crm-check is-warn" role="alert">The check couldn’t run right now (' + esc(R.message || 'no answer') + '). You can still save the draft; Campaign Studio checks it again before publishing.</div>';
    else {
      var errs = (R.issues || []).filter(function (i) { return i.level === 'error'; }), warns = (R.issues || []).filter(function (i) { return i.level !== 'error' && i.code !== 'live_unverified'; });
      h += '<div class="crm-check ' + (errs.length ? 'is-bad' : 'is-ok') + '" role="status"><b>' + esc(errs.length ? errs.length + ' thing' + (errs.length === 1 ? '' : 's') + ' to fix before publishing' : 'Ready to publish from Campaign Studio') + '</b>' +
        (errs.length ? '<ul>' + errs.map(function (i) { return '<li>' + esc(i.message) + '</li>'; }).join('') + '</ul>' : '') +
        (warns.length ? '<p>Also worth checking:</p><ul>' + warns.map(function (i) { return '<li>' + esc(i.message) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      if (R.liveUnverified && R.liveUnverified.length) h += '<p class="crm-help">Not yet verified with a real ' + esc(P.name) + ' account: ' + esc(R.liveUnverified.join(' ')) + '</p>';
    }
    if (M.saved) h += '<div class="crm-check is-ok" role="status"><b>' + (M.savedUpdated ? 'Saved — the campaign in Campaigns is updated.' : 'Saved as a draft in Campaigns.') + '</b> <button type="button" class="crm-btn crm-btn--primary" data-crm-open>Open in Campaign Studio</button></div>';
    else h += '<div class="crm-actions"><button type="button" class="crm-btn crm-btn--primary" data-crm-save>' + (M.editId ? 'Save changes' : 'Save as draft campaign') + '</button></div>';
    return h;
  }

  // ── Small builders ───────────────────────────────────────────────
  function field(label, control, req, help) { return '<div class="crm-f"><label class="crm-l">' + esc(label) + (req ? ' <i>required</i>' : '') + '</label>' + control + (help ? '<p class="crm-help">' + help + '</p>' : '') + '</div>'; }
  function select(key, opts, val) { return '<select class="crm-in" data-crm="' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function count(v, n, note, hard) { var l = String(v || '').length; return esc(note) + ' <span class="crm-count' + (l > n ? (hard ? ' is-bad' : ' is-warn') : '') + '">' + l + ' / ' + n + '</span>'; }
  function nl(v) { return String(v || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function csv(v) { return String(v || '').split(/[,;\s]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(function (x) { return /^[A-Z]{2}$/.test(x); }); }
  function lines(v, max, min, most) { var a = nl(v), long = a.filter(function (x) { return x.length > max; }).length; return esc(a.length + ' entered (' + (min ? min + '–' : 'up to ') + most + ')') + (long ? ' <span class="crm-count is-bad">' + long + ' over ' + max + ' characters</span>' : ''); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }
  function ytId(v) { var t = String(v || '').trim(); if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t; var m = t.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; }

  // ── Validation (the basics, per ad; the server review checks everything) ─
  function problems(step) {
    var d = M.d, p = d.platform, e = [];
    if (!p || !PLAT[p]) return step >= 2 ? ['Choose a platform first.'] : [];
    if (step === 2) {
      if (!d.name.trim()) e.push('Give the campaign a name.');
      var g = goals().filter(function (x) { return x.goal === d.goal && x.available; })[0];
      if (!g) e.push('Choose an objective that ' + PLAT[p].name + ' supports' + (p === 'google' ? ' for ' + GTYPE[d.gtype] : '') + '.');
      var b = num(d.budget);
      if (!b || b <= 0) e.push('Set a daily budget above 0.');
      else if (p === 'tiktok' && b <= 20) e.push('TikTok needs a daily budget above 20.');
      else if (p === 'snapchat' && b < 5) e.push('Snapchat needs a daily budget of at least 5.');
      if (p === 'meta' && d.specialCat == null) e.push('Say whether the ad is in a special ad category (or choose “None of these”).');
    }
    if (step === 3) {
      var c = csv(d.countries);
      if (!c.length) e.push('Choose at least one country.');
      if (p === 'snapchat' && c.length > 1) e.push('Snapchat campaigns target one country. Choose one.');
      var lo = parseInt(d.ageMin, 10), hi = parseInt(d.ageMax, 10);
      if (!(lo >= 18) || !(hi >= lo) || hi > 65) e.push('Use an age range between 18 and 65.');
      if (p === 'meta' && d.specialCat && (lo !== 18 || hi !== 65)) e.push('Ads in a special ad category must target ages 18–65.');
    }
    if (step === 4) {
      if (!/^https?:\/\/[^\s/]+\.[^\s]+/i.test(d.url.trim())) e.push('Add a valid destination URL that starts with https://.');
      var k = kind(), L = structLimits(), unit = cap(PLAT[p].unit);
      if (k === 'gsingle') return e.concat(singleProblems());
      if (p === 'snapchat') { if (!d.brandName.trim() || d.brandName.length > LIM.snapBrand) e.push('Add the brand name (up to 32 characters).'); var bb = num(d.budget); if (bb && bb / d.groups.length < 5) e.push('Snapchat needs at least 5 per day for each ad squad: raise the budget or use fewer ad squads.'); }
      if (k === 'gsearch' && nl(d.callouts).some(function (x) { return x.length > LIM.callout; })) e.push('Keep each callout to 25 characters.');
      if (d.groups.length > L.groups) e.push('At most ' + L.groups + ' ' + PLAT[p].units + ' per campaign.');
      d.groups.forEach(function (gr, gi) {
        var gw = unit + ' ' + (gi + 1);
        if (gr.ads.length > L.ads) e.push(gw + ': at most ' + L.ads + ' ads. ' + L.note);
        var glo = gr.ageMin === '' || gr.ageMin == null ? null : parseInt(gr.ageMin, 10), ghi = gr.ageMax === '' || gr.ageMax == null ? null : parseInt(gr.ageMax, 10);
        if ((glo != null && !(glo >= 18)) || (ghi != null && !(ghi <= 65)) || (glo != null && ghi != null && ghi < glo)) e.push(gw + ': use an age range between 18 and 65.');
        if (k === 'gsearch' && !nl(gr.keywords).length) e.push(gw + ': add at least one keyword.');
        gr.ads.forEach(function (a, ai) { adProblems(a).forEach(function (m) { e.push(gw + ' · Ad ' + (ai + 1) + ': ' + m); }); });
      });
    }
    return e;
  }
  function adProblems(a) {
    var d = M.d, p = d.platform, k = kind(), e = [];
    var hs = nl(a.headlines), ds = nl(a.descriptions);
    if (p === 'meta') { if (!a.primaryText.trim()) e.push('write the primary text.'); if (!a.headline.trim()) e.push('write a headline.'); if (d.creative === 'video' ? !a.video : !a.image) e.push('upload ' + (d.creative === 'video' ? 'a video.' : 'an image.')); }
    else if (k === 'gsearch') {
      if (hs.length < LIM.rsaMinH || hs.length > LIM.rsaMaxH) e.push('3 to 15 headlines.');
      if (hs.some(function (x) { return x.length > LIM.rsaH; })) e.push('keep each headline to 30 characters.');
      if (ds.length < LIM.rsaMinD || ds.length > LIM.rsaMaxD) e.push('2 to 4 descriptions.');
      if (ds.some(function (x) { return x.length > LIM.rsaD; })) e.push('keep each description to 90 characters.');
    } else if (k === 'gdisplay') {
      if (!hs.length || hs.length > LIM.dispMax || hs.some(function (x) { return x.length > LIM.dispH; })) e.push('1 to 5 headlines of up to 30 characters.');
      if (!a.longHeadline.trim() || a.longHeadline.length > LIM.dispLong) e.push('a long headline of up to 90 characters.');
      if (!ds.length || ds.length > LIM.dispMax || ds.some(function (x) { return x.length > LIM.rsaD; })) e.push('1 to 5 descriptions of up to 90 characters.');
      if (!a.image) e.push('upload a square image.');
      if (!a.landscape) e.push('upload a landscape image.');
    } else if (k === 'gvideo') {
      if (!ytId(a.youtube)) e.push('add a YouTube video link or id.');
      if (!hs.length || hs.length > LIM.dgMax || hs.some(function (x) { return x.length > LIM.dgH; })) e.push('1 to 5 headlines of up to 40 characters.');
      var lh = nl(a.longHeadlines); if (!lh.length || lh.length > LIM.dgMax || lh.some(function (x) { return x.length > LIM.pmaxLong; })) e.push('1 to 5 long headlines of up to 90 characters.');
      if (!ds.length || ds.length > LIM.dgMax || ds.some(function (x) { return x.length > LIM.rsaD; })) e.push('1 to 5 descriptions of up to 90 characters.');
    } else if (p === 'tiktok') { if (!a.adText.trim() || a.adText.length > LIM.ttText) e.push('ad text of up to 100 characters.'); if (!a.video) e.push('upload a video — TikTok ads are videos.'); }
    else if (p === 'pinterest') { if (!a.title.trim() || a.title.length > LIM.pinTitle) e.push('a Pin title of up to 100 characters.'); if (a.pinDescription.length > LIM.pinDesc) e.push('keep the description to 800 characters.'); if (d.creative === 'video' ? !a.video : !a.image) e.push('upload ' + (d.creative === 'video' ? 'a video.' : 'an image.')); }
    else if (p === 'snapchat') { if (!a.headline.trim() || a.headline.length > LIM.snapHead) e.push('a headline of up to 34 characters.'); if (d.creative === 'video' ? !a.video : !a.image) e.push('upload ' + (d.creative === 'video' ? 'a video.' : 'an image.')); }
    return e;
  }
  function singleProblems() {
    var d = M.d, e = [], hs = nl(d.headlines), ds = nl(d.descriptions);
    if (d.gtype === 'PERFORMANCE_MAX') {
      if (hs.length < 3 || hs.some(function (x) { return x.length > LIM.rsaH; })) e.push('Performance Max needs at least 3 headlines of up to 30 characters.');
      if (!d.longHeadline.trim() || d.longHeadline.length > LIM.pmaxLong) e.push('Write a long headline of up to 90 characters.');
      if (ds.length < 2 || ds.some(function (x) { return x.length > LIM.rsaD; }) || (ds[0] && ds[0].length > 60)) e.push('Add 2 to 4 descriptions (up to 90 characters; the first up to 60).');
      if (!d.image || !d.landscape) e.push('Upload a square and a landscape image.');
    } else {
      if (!hs.length || hs.length > LIM.dgMax || hs.some(function (x) { return x.length > LIM.dgH; })) e.push('Demand Gen needs 1 to 5 headlines of up to 40 characters.');
      if (!ds.length || ds.length > LIM.dgMax || ds.some(function (x) { return x.length > LIM.rsaD; })) e.push('Add 1 to 5 descriptions of up to 90 characters.');
      if (!d.image) e.push('Upload a square image.');
    }
    return e;
  }

  // ── The campaign package (what the server spec reads) ───────────
  function adPayload(a) {
    var d = M.d, p = d.platform, k = kind(), o = { name: (a.name || '').trim() || undefined };
    var media = function () { return d.creative === 'video' ? { videoUrl: a.video ? a.video.url : undefined } : { imageUrl: a.image ? a.image.url : undefined }; };
    if (p === 'meta') Object.assign(o, { headline: a.headline.trim(), primaryText: a.primaryText.trim(), description: a.description.trim(), cta: a.cta || 'Learn more' }, media());
    else if (k === 'gsearch') Object.assign(o, { headlines: nl(a.headlines), descriptions: nl(a.descriptions) });
    else if (k === 'gdisplay') Object.assign(o, { headlines: nl(a.headlines), longHeadline: a.longHeadline.trim(), descriptions: nl(a.descriptions), imageUrl: a.image ? a.image.url : undefined, landscapeImageUrl: a.landscape ? a.landscape.url : undefined });
    else if (k === 'gvideo') Object.assign(o, { youtubeVideo: a.youtube.trim(), headlines: nl(a.headlines), longHeadlines: nl(a.longHeadlines), descriptions: nl(a.descriptions) });
    else if (p === 'tiktok') Object.assign(o, { adText: a.adText.trim(), cta: a.cta || 'Learn more', videoUrl: a.video ? a.video.url : undefined });
    else if (p === 'pinterest') Object.assign(o, { title: a.title.trim(), pinDescription: a.pinDescription.trim(), altText: a.altText.trim() }, media());
    else if (p === 'snapchat') Object.assign(o, { headline: a.headline.trim(), cta: a.cta || 'MORE' }, media());
    Object.keys(o).forEach(function (x) { if (o[x] === undefined) delete o[x]; });
    return o;
  }
  function buildPkg(src) {
    var keep = M.d; if (src) M.d = src;
    try {
      var d = M.d, p = d.platform, b = num(d.budget), k = kind();
      var ov = { countries: csv(d.countries), ageMin: parseInt(d.ageMin, 10), ageMax: parseInt(d.ageMax, 10) };
      var langs = String(d.languages || '').split(/[,;\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); if (langs.length) ov.languages = langs;
      var pkg = { campaignName: d.name.trim(), creationMode: 'manual', strategy: { goal: d.goal, landingPageUrl: d.url.trim() }, spec: { overrides: ov }, inputs: {}, manualDraft: clean(d) };
      var o = pkg[PLAT[p].key] = {};
      if (p !== 'google') o.budget = b; else pkg.strategy.budgetRecommendation = { amount: b };
      if (hasGroups()) {
        ov.adGroups = d.groups.map(function (g) {
          var x = { name: (g.name || '').trim(), ads: g.ads.map(adPayload) };
          if (g.ageMin !== '' && g.ageMin != null && isFinite(parseInt(g.ageMin, 10))) x.ageMin = parseInt(g.ageMin, 10);
          if (g.ageMax !== '' && g.ageMax != null && isFinite(parseInt(g.ageMax, 10))) x.ageMax = parseInt(g.ageMax, 10);
          if (k === 'gsearch') x.keywords = nl(g.keywords).map(function (t) { return { text: t, matchType: d.matchType }; });
          return x;
        });
        pkg.campaignStructure = { groups: d.groups.length, adsPerGroup: Math.max.apply(null, d.groups.map(function (g) { return g.ads.length; })) };
      }
      var first = hasGroups() && d.groups[0] && d.groups[0].ads[0] ? adPayload(d.groups[0].ads[0]) : {};
      var allAds = hasGroups() ? [].concat.apply([], ov.adGroups.map(function (g) { return g.ads; })) : [];
      if (p === 'meta') {
        ov.specialAdCategories = d.specialCat ? [d.specialCat] : [];
        if (d.dsaBeneficiary.trim()) ov.dsaBeneficiary = d.dsaBeneficiary.trim();
        if (d.dsaPayor.trim()) ov.dsaPayor = d.dsaPayor.trim();
        Object.assign(o, { placement: d.placement, creativeType: d.creative, imageUrl: first.imageUrl, videoUrl: first.videoUrl, headline: first.headline, primaryText: first.primaryText, description: first.description, cta: first.cta });
        pkg.inputs.format = d.creative;
      } else if (p === 'google') {
        o.campaignType = apiType();
        if (k === 'gsearch') {
          Object.assign(o, { headlines: first.headlines || [], descriptions: first.descriptions || [], matchType: d.matchType });
          if (nl(d.negatives).length) ov.negativeKeywords = nl(d.negatives);
          if (nl(d.callouts).length) ov.callouts = nl(d.callouts);
          pkg.inputs.format = 'text';
        } else if (k === 'gdisplay') {
          Object.assign(o, { headlines: first.headlines || [], longHeadline: first.longHeadline || '', descriptions: first.descriptions || [], imageUrl: first.imageUrl, pmaxLandscapeImageUrl: first.landscapeImageUrl });
          pkg.inputs.format = 'image';
        } else if (k === 'gvideo') {
          Object.assign(o, { format: 'video', youtubeVideo: first.youtubeVideo, headlines: first.headlines || [], longHeadlines: first.longHeadlines || [], descriptions: first.descriptions || [] });
          pkg.inputs.format = 'video';
        } else {
          Object.assign(o, { headlines: nl(d.headlines), descriptions: nl(d.descriptions) });
          if (d.gtype === 'PERFORMANCE_MAX') { o.longHeadline = d.longHeadline.trim(); o.pmaxLandscapeImageUrl = d.landscape ? d.landscape.url : undefined; }
          o.imageUrl = d.image ? d.image.url : undefined; pkg.inputs.format = 'image';
        }
      } else if (p === 'tiktok') {
        Object.assign(o, { videoUrl: first.videoUrl, cta: first.cta, script: first.adText });
        if (d.ttObjective === 'VideoViews') o.objective = 'VideoViews';
        pkg.inputs.format = 'video';
      } else if (p === 'pinterest') {
        Object.assign(o, { title: first.title, description: first.pinDescription, altText: first.altText, creativeType: d.creative, destinationUrl: d.url.trim(), imageUrl: first.imageUrl, videoUrl: first.videoUrl });
        pkg.inputs.format = d.creative;
      } else if (p === 'snapchat') {
        Object.assign(o, { brandName: d.brandName.trim(), headline: first.headline, cta: first.cta, creativeType: d.creative, imageUrl: first.imageUrl, videoUrl: first.videoUrl });
        pkg.inputs.format = d.creative;
      }
      // Every ad's copy as concepts too, for the places that read concepts (My Creatives, Chat).
      if (allAds.length && p !== 'google') pkg.concepts = allAds.map(function (a, i) { return { angle: 'manual-' + (i + 1), cta: a.cta, hook: a.adText, adCopy: { headline: a.headline || a.title || a.adText || '', primaryText: a.primaryText || a.pinDescription || a.adText || '', description: a.description || '' } }; });
      Object.keys(o).forEach(function (x) { if (o[x] === undefined) delete o[x]; });
      return pkg;
    } finally { M.d = keep; }
  }
  function runReview() {
    var gen = (M.reviewGen = (M.reviewGen || 0) + 1);
    M.review = { loading: true };
    if (typeof window.apiFetch !== 'function') { M.review = { failed: true, message: 'not signed in' }; return; }
    window.apiFetch('/api/campaigns/spec', { method: 'POST', body: JSON.stringify({ pkg: buildPkg(), platform: M.d.platform }) }).then(function (r) {
      if (gen !== M.reviewGen) return;
      if (r && r.ok && r.data && Array.isArray(r.data.issues)) M.review = { issues: r.data.issues, canPublish: !!r.data.canPublish, liveUnverified: (r.data.spec && r.data.spec.liveUnverified) || [] };
      else M.review = { failed: true, message: (r && r.data && (r.data.error || (r.data.demo && 'not available in the demo'))) || ('status ' + (r && r.status)) };
      if (M.d.step === 5) render();
    }, function () { if (gen !== M.reviewGen) return; M.review = { failed: true, message: 'network' }; if (M.d.step === 5) render(); });
  }
  function saveDraft() {
    if (typeof window._orvStoreCampaign !== 'function') { if (typeof orvToast === 'function') orvToast('Campaigns isn’t ready yet — try again in a moment.', 'warn'); return; }
    var d = M.d, p = d.platform, pkg = buildPkg();
    var modKey = { meta: 'meta-ads', google: 'google-ads', tiktok: 'tiktok-ads', pinterest: 'pinterest-ads', snapchat: 'snapchat-ads' }[p];
    var gen = {}; gen[modKey] = { ready: true, data: pkg };
    var list = typeof window._orvGetCampaigns === 'function' ? window._orvGetCampaigns() : [];
    var existing = M.editId ? list.filter(function (c) { return c.id === M.editId; })[0] : null;
    if (existing) {
      // Editing a saved manual campaign: update it in place (same id), keep when it was made.
      Object.assign(existing, { name: pkg.campaignName, goal: d.goal, platform: p, modules: [modKey], generated: gen, pkg: pkg, updated: new Date().toISOString() });
      if (typeof window._saveCamps === 'function') window._saveCamps();
      if (typeof window._orvPersistCampaignDurable === 'function') { try { window._orvPersistCampaignDurable(existing); } catch (_) {} }
      if (typeof window.renderCampaignHub === 'function') setTimeout(window.renderCampaignHub, 0);
      M.saved = existing.id; M.savedUpdated = true;
    } else {
      var id = 'manualad_' + Date.now();
      // Not `source: 'manual'` — that marks a record of a campaign made outside OrivenAI. This one OrivenAI publishes.
      window._orvStoreCampaign({ id: id, name: pkg.campaignName, goal: d.goal, platform: p, status: 'generated', progress: 100, created: new Date().toISOString(), modules: [modKey], generated: gen, pkg: pkg, prompt: '', createdBy: 'manual', creationMode: 'manual' });
      M.saved = id; M.savedUpdated = false;
    }
    M.editId = null;
    sset(DRAFT_KEY, null); sset(DRAFT_KEY + 'edit:', null);
    if (typeof orvToast === 'function') orvToast(M.savedUpdated ? 'Campaign updated' : 'Saved as a draft campaign', 'ok');
    render();
  }
  function editSaved(id) {
    var c = savedManual().filter(function (x) { return x.id === id; })[0]; if (!c) return false;
    if (hasWork() && !window.confirm('Open “' + c.name + '” for editing? The draft you have here now is replaced (the saved campaign isn’t changed until you save).')) return false;
    M.d = migrate(c.pkg.manualDraft); M.d.step = 2; M.editId = c.id; M.review = null; M.saved = null; save(); render();
    return true;
  }

  // ── Data ─────────────────────────────────────────────────────────
  function loadConn(p) {
    if (M.conn[p] || typeof window.apiFetch !== 'function') return;
    M.conn[p] = { loading: true };
    window.apiFetch('/api/' + p + '/status').then(function (r) {
      var x = r && r.ok && r.data ? r.data : null, a = x && x.active_ad_account;
      M.conn[p] = { connected: !!(x && (x.connected || x.status === 'connected')), account: a ? (a.name || a.account_name || a.descriptive_name || a.advertiser_name || '') : '' };
      if (M.mode === 'manual' && M.d.step === 1) render();
    }, function () { M.conn[p] = { connected: false }; });
  }
  function loadChoices() {
    if (M.choices || M.choicesLoading || typeof window.apiFetch !== 'function') return;
    M.choicesLoading = true;
    window.apiFetch('/api/campaigns/spec', { method: 'POST', body: JSON.stringify({ pkg: { campaignName: 'x' }, platform: M.d.platform || 'meta', choices: true }) }).then(function (r) {
      M.choicesLoading = false;
      if (r && r.ok && r.data && r.data.choices && Array.isArray(r.data.choices.countries)) { M.choices = r.data.choices; if (M.d.step === 3) render(); }
    }, function () { M.choicesLoading = false; });
  }

  // ── Events ───────────────────────────────────────────────────────
  function pair(v) { var a = String(v || '').split(':'); return [parseInt(a[0], 10), parseInt(a[1], 10)]; }
  function onClick(e) {
    var b = e.target.closest('button, [data-crm-step]'); if (!b || b.disabled) return;
    var d = M.d, L;
    if (b.hasAttribute('data-crm-choose')) { choose(b.getAttribute('data-crm-choose')); return; }
    if (b.hasAttribute('data-crm-edit')) { editSaved(b.getAttribute('data-crm-edit')); return; }
    if (b.hasAttribute('data-crm-plat')) {
      var np = b.getAttribute('data-crm-plat');
      if (d.platform && d.platform !== np && hasWork() && d.step > 1 && !window.confirm('Switch to ' + PLAT[np].name + '? The ads for ' + PLAT[d.platform].name + ' will be cleared; the campaign name, budget and audience stay.')) return;
      if (d.platform !== np) { var keep = { name: d.name, budget: d.budget, countries: d.countries, languages: d.languages, ageMin: d.ageMin, ageMax: d.ageMax, url: d.url }; M.d = Object.assign(blank(), keep, { platform: np, step: 1 }); }
      M.review = null; M.saved = null; save(); loadConn(np); render(); return;
    }
    if (b.hasAttribute('data-crm-step')) { var k = +b.getAttribute('data-crm-step'); if (k <= maxStep() || k < d.step) { d.step = k; M.tried = 0; if (k === 5) M.review = null; save(); render(); } return; }
    if (b.hasAttribute('data-crm-next')) {
      var s = d.step;
      if (s >= 2 && problems(s).length) { M.tried = s; render(); var er = root().querySelector('.crm-errs'); if (er && er.focus) er.focus(); return; }
      d.step = s + 1; M.tried = 0; if (d.step === 5) M.review = null; save(); render(); return;
    }
    if (b.hasAttribute('data-crm-addgroup')) { L = structLimits(); if (d.groups.length < L.groups) { d.groups.forEach(function (g) { g.ads.forEach(function (a) { a.open = false; }); }); d.groups.push(newGroup()); save(); render(); } return; }
    if (b.hasAttribute('data-crm-rmgroup')) {
      var gi = +b.getAttribute('data-crm-rmgroup'), g = d.groups[gi];
      if (g && d.groups.length > 1 && (!g.ads.some(adFilled) || window.confirm('Remove ' + (g.name || cap(PLAT[d.platform].unit) + ' ' + (gi + 1)) + ' and its ' + g.ads.length + ' ad' + (g.ads.length === 1 ? '' : 's') + '?'))) { d.groups.splice(gi, 1); save(); render(); }
      return;
    }
    if (b.hasAttribute('data-crm-addad')) { var g2 = d.groups[+b.getAttribute('data-crm-addad')]; L = structLimits(); if (g2 && g2.ads.length < L.ads) { g2.ads.forEach(function (a) { a.open = false; }); g2.ads.push(newAd()); save(); render(); } return; }
    if (b.hasAttribute('data-crm-dupad')) {
      e.preventDefault(); var pd = pair(b.getAttribute('data-crm-dupad')), g3 = d.groups[pd[0]]; L = structLimits();
      if (g3 && g3.ads.length < L.ads) { var copy = newAd(JSON.parse(JSON.stringify(g3.ads[pd[1]]))); copy.id = newAd().id; copy.name = ''; copy.open = true; g3.ads.forEach(function (a) { a.open = false; }); g3.ads.splice(pd[1] + 1, 0, copy); save(); render(); }
      return;
    }
    if (b.hasAttribute('data-crm-rmad')) {
      e.preventDefault(); var pr = pair(b.getAttribute('data-crm-rmad')), g4 = d.groups[pr[0]], ad = g4 && g4.ads[pr[1]];
      if (g4 && g4.ads.length > 1 && (!adFilled(ad) || window.confirm('Remove ' + adTitle(ad, pr[1]) + '?'))) { g4.ads.splice(pr[1], 1); save(); render(); }
      return;
    }
    if (b.hasAttribute('data-crm-discard')) { if (!hasWork() || window.confirm('Discard this manual draft? What you entered here is removed. Your AI drafts and saved campaigns are not affected.')) { M.d = blank(); M.review = null; M.saved = null; M.editId = null; sset(DRAFT_KEY, null); sset(DRAFT_KEY + 'edit:', null); render(); } return; }
    if (b.hasAttribute('data-crm-clear')) { setPath(b.getAttribute('data-crm-clear'), null); save(); render(); return; }
    if (b.hasAttribute('data-crm-save')) { saveDraft(); return; }
    if (b.hasAttribute('data-crm-open')) { if (window.orvAppNav) window.orvAppNav.go('adstudio'); M.saved = null; M.d = blank(); render(); return; }
  }
  function setPath(path, value) {
    var parts = String(path).split(':');
    if (parts[0] === 'c') { M.d[parts[1]] = value; return; }
    var g = M.d.groups[+parts[0]], a = g && g.ads[+parts[1]]; if (a) a[parts[2]] = value;
  }
  function onInput(e) {
    var el = e.target, d = M.d;
    if (el.hasAttribute('data-crm-country')) {
      var set = csv(d.countries), iso = el.getAttribute('data-crm-country');
      if (el.checked) { if (d.platform === 'snapchat') set = [iso]; else if (set.indexOf(iso) < 0) set.push(iso); } else set = set.filter(function (x) { return x !== iso; });
      d.countries = set.join(','); save(); if (d.platform === 'snapchat' || e.type === 'change') render(); return;
    }
    if (el.hasAttribute('data-crm-file')) { if (e.type === 'change') uploadFile(el); return; }
    if (el.hasAttribute('data-crm-g')) { var gp = el.getAttribute('data-crm-g').split(':'); var g = d.groups[+gp[0]]; if (g) g[gp[1]] = el.value; save(); return; }
    if (el.hasAttribute('data-crm-a')) {
      var ap = el.getAttribute('data-crm-a').split(':'); var ad = d.groups[+ap[0]] && d.groups[+ap[0]].ads[+ap[1]];
      if (ad) { ad[ap[2]] = el.value; save(); var box = el.closest('.crm-ad'); if (box) { var s = box.querySelector('summary > span'); if (s) s.textContent = adTitle(ad, +ap[1]); } refreshHelp(el); }
      return;
    }
    var k = el.getAttribute('data-crm'); if (!k) return;
    d[k] = el.value;
    if (k === 'gtype') d.goal = '';
    if (k === 'ttObjective' && d.ttObjective === 'VideoViews') d.goal = 'Awareness';
    save();
    if (el.tagName === 'SELECT' || el.type === 'radio') { render(); return; }
    refreshHelp(el);
  }
  // Counters under a field follow the typing without re-rendering the form.
  function refreshHelp(el) {
    var f = el.closest('.crm-f'); if (!f) return;
    var help = f.querySelector('.crm-help'); if (!help || !/crm-count|entered/.test(help.innerHTML)) return;
    var tmp = document.createElement('div'); tmp.innerHTML = M.d.step === 4 ? stepAds() : M.d.step === 2 ? stepCampaign() : stepAudience();
    var attr = el.hasAttribute('data-crm-a') ? '[data-crm-a="' + el.getAttribute('data-crm-a') + '"]' : '[data-crm="' + el.getAttribute('data-crm') + '"]';
    var same = tmp.querySelector(attr); if (same) { var h2 = same.closest('.crm-f').querySelector('.crm-help'); if (h2) help.innerHTML = h2.innerHTML; }
  }
  // Reads a video's length and size in the browser before uploading, for the platform's rules.
  function videoMeta(file) {
    return new Promise(function (res) {
      var settled = false, url = null;
      var done = function (m) { if (settled) return; settled = true; try { if (url) URL.revokeObjectURL(url); } catch (_) {} res(m); };
      try {
        var v = document.createElement('video'); url = URL.createObjectURL(file); v.preload = 'metadata'; v.muted = true;
        v.onloadedmetadata = function () { done({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }); };
        v.onerror = function () { done(null); }; setTimeout(function () { done(null); }, 8000);
        v.src = url;
      } catch (_) { done(null); }
    });
  }
  // The platform's video rules that can be checked before uploading.
  function videoProblems(meta, file, platform) {
    var p = platform || M.d.platform, e = [];
    var type = String((file && file.type) || '').toLowerCase();
    if ((p === 'meta' || p === 'snapchat') && ['video/mp4', 'video/quicktime'].indexOf(type) < 0) e.push((p === 'meta' ? 'Meta' : 'Snapchat') + ' video ads need an MP4 or MOV file.');
    if (!meta) return e.concat(['This video couldn’t be read in the browser. Use an MP4 (H.264) file.']);
    var ratio = meta.width && meta.height ? meta.width / meta.height : null;
    if (p === 'meta') {
      if (!(meta.duration >= 1)) e.push('Meta video ads must be at least 1 second long.');
      if (meta.duration > 240 * 60) e.push('Meta video ads can be at most 240 minutes long.');
      if (ratio && (ratio < 9 / 16 - 0.01 || ratio > 16 / 9 + 0.01)) e.push('Meta video ads need an aspect ratio between 9:16 (vertical) and 16:9 (landscape).');
    }
    if (p === 'snapchat') {
      if (!(meta.duration >= 3)) e.push('Snapchat video ads must be at least 3 seconds long.');
      if (ratio && Math.abs(ratio - 9 / 16) > 0.01) e.push('Snapchat video ads must be vertical 9:16 (1080 × 1920).');
    }
    return e;
  }
  function uploadFile(input) {
    var f = input.files && input.files[0]; if (!f) return;
    var path = input.getAttribute('data-crm-file'), kindOf = input.getAttribute('data-crm-kind');
    var max = kindOf === 'video' ? 12 : 8;
    if (f.size > max * 1024 * 1024) { window.alert('That file is larger than ' + max + ' MB, the most OrivenAI can upload for ' + (kindOf === 'video' ? 'videos' : 'images') + '. Please use a smaller file.'); input.value = ''; return; }
    if (typeof window.apiFetch !== 'function') return;
    var go = function (meta) {
      M.d.uploading = path; render();
      var rd = new FileReader();
      rd.onload = function () {
        window.apiFetch('/api/manual-campaigns/upload-creative', { method: 'POST', body: JSON.stringify(kindOf === 'image' ? { dataUrl: rd.result, purpose: 'ad_image' } : { dataUrl: rd.result }) }).then(function (r) {
          M.d.uploading = '';
          if (r && r.ok && r.data && r.data.url) { setPath(path, { url: r.data.url, name: f.name, width: r.data.width || (meta && meta.width) || null, height: r.data.height || (meta && meta.height) || null, duration: meta && meta.duration ? Math.round(meta.duration * 10) / 10 : null }); save(); }
          else window.alert((r && r.data && (r.data.error || (r.data.problems && r.data.problems.map(function (x) { return x.message; }).join(' ')))) || 'The upload didn’t work. Please try again.');
          render();
        }, function () { M.d.uploading = ''; window.alert('The upload didn’t work. Please try again.'); render(); });
      };
      rd.onerror = function () { M.d.uploading = ''; render(); };
      rd.readAsDataURL(f);
    };
    if (kindOf !== 'video') { go(null); return; }
    videoMeta(f).then(function (meta) {
      var probs = videoProblems(meta, f);
      if (probs.length) { window.alert(probs.join('\n')); input.value = ''; return; }
      go(meta);
    });
  }

  // ── Mount ────────────────────────────────────────────────────────
  function init() {
    if (!page() || !page().querySelector('.cr2-hero')) return;
    var u = uid(); if (init._u === u && root()) { render(); return; }
    init._u = u; M = { mode: null, d: blank(), review: null, conn: {}, choices: null, saved: null, editId: null }; load(); render();
  }
  function watch() {
    var pg = page(); if (!pg || pg._crm) return; pg._crm = true;
    new MutationObserver(function () { if (pg.classList.contains('active')) init(); }).observe(pg, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); watch(); }); else { init(); watch(); }
  // For tests: the package and the checks for a given set of answers (no DOM needed).
  function withDraft(d, fn) { var keep = M.d; M.d = migrate(JSON.parse(JSON.stringify(d))); try { return fn(); } finally { M.d = keep; } }
  window.orvCreateModes = { mode: function () { return M.mode; }, choose: choose, state: function () { return M.d; }, buildPkg: buildPkg, problems: problems, render: render, PLAT: PLAT, STRUCT: STRUCT, migrate: migrate,
    newAd: newAd, newGroup: newGroup, editSaved: editSaved, videoProblems: videoProblems,
    _pkgFor: function (d) { return withDraft(d, function () { return buildPkg(); }); }, _problemsFor: function (d, step) { return withDraft(d, function () { return problems(step); }); } };
})();
