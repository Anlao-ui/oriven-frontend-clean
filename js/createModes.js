/* ════════════════════════════════════════════════════════════════
   Create Ads — two ways to make an ad (#page-create)

   1. Create with AI  → the existing guided flow (js/createFlow.js), unchanged.
   2. Create manually → this file: platform FIRST, then that platform's own
      campaign → ad set/ad group/ad squad → ad fields, then a review.

   Manual ads are real OrivenAI campaigns: the answers become the same
   campaign package (pkg) the AI flow produces, read by the same server spec
   (services/campaignSpec.js via POST /api/campaigns/spec), which validates it
   against the platform's rules AND the connected account (Page, pixel,
   conversion tags, identity…). Saving stores it as a draft in Campaigns
   (window._orvStoreCampaign); publishing happens in Campaign Studio, through
   the existing publish routes (/api/publish/<platform>), which ask for
   confirmation and create everything PAUSED. Nothing here publishes or spends.

   Per platform (what OrivenAI can publish today — js/createCompat.js):
     Meta      Campaign → Ad set → Ad. Image ad. All four goals.
     Google    Campaign → Ad group / Asset group → Ad. Search (text),
               Performance Max (images + logo), Demand Gen (image).
     TikTok    Campaign → Ad group → Ad. Vertical video. Traffic, Awareness.
     Pinterest Campaign → Ad group → Pin. Image or video. All four goals.
     Snapchat  Campaign → Ad squad → Ad. Full-screen image or video. Traffic, Awareness.

   The draft is kept per account on this device until it is saved or
   discarded (with a confirmation), so switching between the two ways never
   loses work. Public API: window.orvCreateModes { mode, choose, state }.
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

  // ── Platform facts (labels; the rules themselves live in the server spec) ──
  var PLAT = {
    meta: { name: 'Meta Ads', levels: ['Campaign', 'Ad set', 'Ad'], fmt: 'Image ad on Facebook and Instagram', key: 'metaAds', formats: ['image'] },
    google: { name: 'Google Ads', levels: ['Campaign', 'Ad group', 'Ad'], fmt: 'Search text ads, Performance Max or Demand Gen', key: 'googleAds', formats: ['text', 'image'] },
    tiktok: { name: 'TikTok Ads', levels: ['Campaign', 'Ad group', 'Ad'], fmt: 'Vertical video ad in the TikTok feed', key: 'tiktokAds', formats: ['video'] },
    pinterest: { name: 'Pinterest Ads', levels: ['Campaign', 'Ad group', 'Pin'], fmt: 'Image or video Pin', key: 'pinterestAds', formats: ['image', 'video'] },
    snapchat: { name: 'Snapchat Ads', levels: ['Campaign', 'Ad squad', 'Ad'], fmt: 'Full-screen vertical image or video', key: 'snapchatAds', formats: ['image', 'video'] },
  };
  var ORDER = ['meta', 'google', 'tiktok', 'pinterest', 'snapchat'];
  var GOAL_LABEL = { Sales: 'Sales', Leads: 'Leads', Traffic: 'Website traffic', Awareness: 'Brand awareness' };
  var GTYPE = { SEARCH: 'Search (text ads)', PERFORMANCE_MAX: 'Performance Max', DEMAND_GEN: 'Demand Gen' };
  var META_CTAS = ['Learn more', 'Shop now', 'Sign up', 'Subscribe', 'Contact us', 'Get offer', 'Book now', 'Download', 'Apply now'];
  var SNAP_CTAS = [['SHOP_NOW', 'Shop now'], ['SIGN_UP', 'Sign up'], ['MORE', 'More'], ['ORDER_NOW', 'Order now'], ['BOOK_NOW', 'Book now'], ['VIEW', 'View'], ['DOWNLOAD', 'Download'], ['APPLY_NOW', 'Apply now']];
  var TIKTOK_CTAS = ['Learn more', 'Shop now', 'Sign up', 'Contact us', 'Download', 'Book now', 'Order now', 'Get quote'];
  var META_CATS = [['', 'None of these'], ['HOUSING', 'Housing'], ['EMPLOYMENT', 'Employment'], ['FINANCIAL_PRODUCTS_SERVICES', 'Financial products and services'], ['ISSUES_ELECTIONS_POLITICS', 'Social issues, elections or politics']];
  // Limits the server enforces (services/campaignSpec.js G, snapchatAds LIMITS) — checked here too so mistakes show while typing.
  var LIM = { metaHeadline: 255, rsaH: 30, rsaD: 90, rsaMinH: 3, rsaMaxH: 15, rsaMinD: 2, rsaMaxD: 4, pmaxLong: 90, dgH: 40, dgMax: 5, callout: 25, ttText: 100, pinTitle: 100, pinDesc: 800, pinAlt: 500, snapHead: 34, snapBrand: 32 };
  var STEPS = ['Platform', 'Campaign', 'Audience & delivery', 'Ad', 'Review'];

  function blank() {
    return { v: 1, step: 1, platform: null, name: '', goal: '', gtype: 'SEARCH', budget: '', specialCat: null, dsaBeneficiary: '', dsaPayor: '',
      countries: '', languages: '', ageMin: 18, ageMax: 65, placement: 'automatic', groupName: '',
      url: '', headline: '', primaryText: '', description: '', cta: '', headlines: '', descriptions: '', longHeadline: '', keywords: '', matchType: 'PHRASE', negatives: '', callouts: '',
      adText: '', title: '', altText: '', brandName: '', creative: 'image', image: null, landscape: null, video: null, uploading: '' };
  }
  var M = { mode: null, d: blank(), review: null, conn: {}, choices: null, saved: null };
  function load() {
    M.mode = sget(MODE_KEY) || null;
    try { var x = JSON.parse(sget(DRAFT_KEY) || 'null'); if (x && x.v === 1) M.d = Object.assign(blank(), x, { uploading: '' }); } catch (_) {}
  }
  function save() { var c = Object.assign({}, M.d); delete c.uploading; sset(DRAFT_KEY, JSON.stringify(c)); }
  function hasWork() { var d = M.d; return !!(d.platform || d.name || d.url || d.headline || d.primaryText || d.headlines || d.adText || d.title || d.image || d.video); }

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
  function heroTexts() {
    var t = document.getElementById('cfTitle'), s = document.getElementById('cfSubtitle'); if (!t || !s) return;
    if (!heroTexts.ai) heroTexts.ai = [t.textContent, s.textContent];
    var sw = document.getElementById('crmSwitch');
    if (M.mode === 'manual') { t.textContent = 'Create an ad manually'; s.textContent = 'Build it yourself with the settings and fields the platform requires.'; }
    else if (M.mode === 'ai') { t.textContent = heroTexts.ai[0]; s.textContent = heroTexts.ai[1]; }
    else { t.textContent = 'Create an ad'; s.textContent = 'Choose how you want to create it. You can switch later without losing your work.'; }
    var hero = t.closest('.cr2-hero');
    if (hero && !sw) { sw = document.createElement('button'); sw.type = 'button'; sw.id = 'crmSwitch'; sw.className = 'crm-switch'; sw.addEventListener('click', function () { choose(null); }); hero.appendChild(sw); }
    if (sw) { sw.hidden = !M.mode; sw.textContent = M.mode === 'manual' ? 'Switch to Create with AI' : 'Create manually instead'; sw.setAttribute('data-crm-to', M.mode === 'manual' ? 'ai' : 'manual'); sw.onclick = function () { choose(sw.getAttribute('data-crm-to')); }; }
  }

  function choose(mode) {
    M.mode = mode === 'ai' || mode === 'manual' ? mode : null;
    sset(MODE_KEY, M.mode);
    render();
    var r = root(); if (r && r.scrollIntoView && M.mode) { try { page().scrollTop = 0; } catch (_) {} }
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
      card('manual', 'Create manually', 'Build your advertisement yourself using the advertising platform’s required settings and fields.', ['Choose the platform first', 'Fill in that platform’s campaign, ad set and ad fields', 'Checked against the platform’s rules before you save'],
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
      return '<li class="' + (k === s ? 'is-on' : k < s ? 'is-done' : '') + '"><button type="button" ' + (can ? 'data-crm-step="' + k + '"' : 'disabled') + (k === s ? ' aria-current="step"' : '') + '><b>' + k + '</b>' + esc(n) + '</button></li>';
    }).join('') + '</ol>';
    var body = s === 1 ? stepPlatform() : s === 2 ? stepCampaign() : s === 3 ? stepAudience() : s === 4 ? stepAd() : stepReview();
    var errs = s >= 2 && s <= 4 ? problems(s) : [];
    var nav = '<div class="crm-nav">' + (s > 1 ? '<button type="button" class="crm-btn" data-crm-step="' + (s - 1) + '">← Back</button>' : '<span></span>') +
      '<span class="crm-nav__r"><button type="button" class="crm-link" data-crm-discard>Discard draft</button>' +
      (s < 5 ? '<button type="button" class="crm-btn crm-btn--primary" data-crm-next ' + (s === 1 && !d.platform ? 'disabled' : '') + '>' + (s === 4 ? 'Review' : 'Next') + '</button>' : '') + '</span></div>';
    return '<div class="crm-wiz">' + steps + '<section class="crm-card" aria-labelledby="crmH">' + body +
      (errs.length && M.tried === s ? '<div class="crm-errs" role="alert"><b>Before you continue:</b><ul>' + errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>' : '') + nav + '</section></div>';
  }
  function maxStep() { var d = M.d; if (!d.platform) return 1; for (var k = 2; k <= 4; k++) if (problems(k).length) return k; return 5; }

  function stepPlatform() {
    return '<h2 id="crmH">Which advertising platform do you want to create an ad for?</h2><p class="crm-sub">Each platform has its own campaign structure, formats and required fields, so this comes first.</p>' +
      '<div class="crm-plats" role="radiogroup" aria-label="Advertising platform">' + ORDER.map(function (p) {
        var c = M.conn[p], st = !c ? '' : c.loading ? 'Checking connection…' : c.connected ? 'Connected' + (c.account ? ' · ' + c.account : '') : 'Not connected — you can prepare the ad now and connect before publishing';
        return '<button type="button" role="radio" aria-checked="' + (M.d.platform === p) + '" class="crm-plat' + (M.d.platform === p ? ' is-on' : '') + '" data-crm-plat="' + p + '"><b>' + esc(PLAT[p].name) + '</b><span>' + esc(PLAT[p].fmt) + '</span><small>' + esc(PLAT[p].levels.join(' → ')) + '</small>' + (st ? '<em class="' + (c && c.connected ? 'is-ok' : '') + '">' + esc(st) + '</em>' : '') + '</button>';
      }).join('') + '</div>';
  }
  function goals() {
    var p = M.d.platform, type = p === 'google' ? M.d.gtype : null;
    return CC ? CC.goalOptions(p, type) : ['Sales', 'Leads', 'Traffic', 'Awareness'].map(function (g) { return { goal: g, label: GOAL_LABEL[g], available: true }; });
  }
  function stepCampaign() {
    var d = M.d, p = d.platform, P = PLAT[p];
    var h = '<h2 id="crmH">' + esc(P.levels[0]) + '</h2><p class="crm-sub">The ' + esc(P.name) + ' campaign: its name, what it should achieve and what it may spend.</p>';
    h += field('Campaign name', '<input class="crm-in" data-crm="name" maxlength="200" value="' + esc(d.name) + '" placeholder="e.g. Autumn candles — website visits">', true);
    if (p === 'google') h += field('Campaign type', '<select class="crm-in" data-crm="gtype">' + Object.keys(GTYPE).map(function (k) { return '<option value="' + k + '"' + (d.gtype === k ? ' selected' : '') + '>' + esc(GTYPE[k]) + '</option>'; }).join('') + '</select>', true,
      d.gtype === 'SEARCH' ? 'Text ads on Google Search, triggered by your keywords.' : d.gtype === 'PERFORMANCE_MAX' ? 'One campaign across Google’s channels from your images, texts and logo. Sales and leads only.' : 'Image ads on YouTube, Discover and Gmail.');
    h += '<fieldset class="crm-fs"><legend>Objective <i>required</i></legend><div class="crm-goals">' + goals().map(function (g) {
      return '<label class="crm-goal' + (g.available ? '' : ' is-off') + '"><input type="radio" name="crmGoal" data-crm="goal" value="' + g.goal + '"' + (d.goal === g.goal ? ' checked' : '') + (g.available ? '' : ' disabled') + '><b>' + esc(g.label || GOAL_LABEL[g.goal]) + '</b>' + (g.available ? '' : '<small>' + esc(g.reason || 'Not available on this platform in OrivenAI.') + '</small>') + '</label>';
    }).join('') + '</div></fieldset>';
    h += field(p === 'google' ? 'Daily budget' : 'Daily budget (per ' + (p === 'snapchat' ? 'campaign, split over the ad squad' : 'campaign') + ')', '<input class="crm-in crm-in--num" data-crm="budget" inputmode="decimal" value="' + esc(d.budget) + '" placeholder="e.g. 25">', true,
      'In your ad account’s currency. OrivenAI never spends more than you set.' + (p === 'tiktok' ? ' TikTok requires more than 20 per day per ad group (USD/EUR/GBP).' : p === 'snapchat' ? ' Snapchat requires at least 5 per day.' : ''));
    if (p === 'meta') {
      h += '<fieldset class="crm-fs"><legend>Special ad category <i>required</i></legend><p class="crm-help">Meta requires you to say whether the ad is about one of these. Ads in a category have restricted targeting.</p><div class="crm-goals">' +
        META_CATS.map(function (c) { return '<label class="crm-goal"><input type="radio" name="crmCat" data-crm="specialCat" value="' + c[0] + '"' + (d.specialCat === c[0] ? ' checked' : '') + '><b>' + esc(c[1]) + '</b></label>'; }).join('') + '</div></fieldset>';
    }
    return h;
  }
  function stepAudience() {
    var d = M.d, p = d.platform, P = PLAT[p];
    var h = '<h2 id="crmH">' + esc(P.levels[1]) + ': audience and delivery</h2><p class="crm-sub">Who sees the ad and where.</p>';
    // Performance Max (asset group) and Demand Gen get a fixed name from the campaign: no field for it.
    if (!(p === 'google' && d.gtype !== 'SEARCH')) h += field(P.levels[1] + ' name', '<input class="crm-in" data-crm="groupName" maxlength="200" value="' + esc(d.groupName) + '" placeholder="Optional — OrivenAI names it after the campaign">');
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
    } else if (p === 'tiktok') h += '<p class="crm-help">Placement: the TikTok feed.</p>';
    else if (p === 'snapchat') h += '<p class="crm-help">Placement: Snapchat (automatic placements).</p>';
    return h;
  }
  function upload(label, kind, key, req, help) {
    var v = M.d[key], busy = M.d.uploading === key;
    var accept = kind === 'video' ? 'video/mp4,video/quicktime,video/webm' : 'image/jpeg,image/png,image/webp,image/gif';
    var prev = v && v.url ? (kind === 'video' ? '<video src="' + esc(v.url) + '" muted playsinline preload="metadata"></video>' : '<img src="' + esc(v.url) + '" alt="">') + '<span>' + esc(v.name || '') + (v.width ? ' · ' + v.width + '×' + v.height : '') + '</span>' : '';
    return field(label, '<div class="crm-up">' + (prev ? '<div class="crm-up__p">' + prev + '</div>' : '') + '<label class="crm-btn crm-up__b"' + (busy ? ' aria-busy="true"' : '') + '><input type="file" hidden accept="' + accept + '" data-crm-file="' + key + '" data-crm-kind="' + kind + '">' + (busy ? 'Uploading…' : v ? 'Replace' : 'Upload ' + kind) + '</label>' + (v ? '<button type="button" class="crm-link" data-crm-clear="' + key + '">Remove</button>' : '') + '</div>', req, help);
  }
  function stepAd() {
    var d = M.d, p = d.platform, P = PLAT[p];
    var h = '<h2 id="crmH">' + esc(P.levels[2]) + '</h2><p class="crm-sub">The ad people see, and where it takes them.</p>';
    h += field('Destination URL', '<input class="crm-in" data-crm="url" type="url" value="' + esc(d.url) + '" placeholder="https://yourshop.com/page">', true, 'The page people land on. OrivenAI adds UTM parameters so you can see the visits in your analytics.');
    if (p === 'meta') {
      h += field('Primary text', '<textarea class="crm-in" data-crm="primaryText" rows="3" maxlength="2200" placeholder="The main text above the image">' + esc(d.primaryText) + '</textarea>', true, count(d.primaryText, 125, 'Meta shows about 125 characters before “See more”.'));
      h += field('Headline', '<input class="crm-in" data-crm="headline" maxlength="255" value="' + esc(d.headline) + '">', true, count(d.headline, 40, 'About 40 characters show in most placements.'));
      h += field('Description', '<input class="crm-in" data-crm="description" maxlength="255" value="' + esc(d.description) + '" placeholder="Optional">');
      h += field('Call to action', select('cta', META_CTAS.map(function (c) { return [c, c]; }), d.cta || 'Learn more'), true);
      h += upload('Image', 'image', 'image', true, 'JPG, PNG, WEBP or GIF, at least 600 × 314 px, up to 8 MB. 1:1 or 4:5 works best in feeds.');
    } else if (p === 'google') {
      if (d.gtype === 'SEARCH') {
        h += field('Headlines (one per line)', '<textarea class="crm-in" data-crm="headlines" rows="5" placeholder="3 to 15 headlines, up to 30 characters each">' + esc(d.headlines) + '</textarea>', true, lines(d.headlines, LIM.rsaH, LIM.rsaMinH, LIM.rsaMaxH));
        h += field('Descriptions (one per line)', '<textarea class="crm-in" data-crm="descriptions" rows="3" placeholder="2 to 4 descriptions, up to 90 characters each">' + esc(d.descriptions) + '</textarea>', true, lines(d.descriptions, LIM.rsaD, LIM.rsaMinD, LIM.rsaMaxD));
        h += '<div class="crm-row">' + field('Keywords (one per line)', '<textarea class="crm-in" data-crm="keywords" rows="4" placeholder="handmade candles&#10;soy candles amsterdam">' + esc(d.keywords) + '</textarea>', true, 'What people search for. Up to 20 per ad group.') +
          field('Match type', select('matchType', [['PHRASE', 'Phrase match'], ['EXACT', 'Exact match'], ['BROAD', 'Broad match']], d.matchType), true) + '</div>';
        h += field('Negative keywords (one per line)', '<textarea class="crm-in" data-crm="negatives" rows="2" placeholder="Optional — e.g. free, diy">' + esc(d.negatives) + '</textarea>');
        h += field('Callouts (one per line)', '<textarea class="crm-in" data-crm="callouts" rows="2" placeholder="Optional — e.g. Free delivery (up to 25 characters)">' + esc(d.callouts) + '</textarea>', false, lines(d.callouts, LIM.callout, 0, 20));
      } else {
        var dg = d.gtype === 'DEMAND_GEN';
        h += field('Headlines (one per line)', '<textarea class="crm-in" data-crm="headlines" rows="4" placeholder="' + (dg ? 'Up to 5 headlines, 40 characters each' : '3 to 15 headlines, 30 characters each') + '">' + esc(d.headlines) + '</textarea>', true, dg ? lines(d.headlines, LIM.dgH, 1, LIM.dgMax) : lines(d.headlines, LIM.rsaH, LIM.rsaMinH, LIM.rsaMaxH));
        if (!dg) h += field('Long headline', '<input class="crm-in" data-crm="longHeadline" maxlength="90" value="' + esc(d.longHeadline) + '">', true, count(d.longHeadline, LIM.pmaxLong, 'Up to 90 characters.'));
        h += field('Descriptions (one per line)', '<textarea class="crm-in" data-crm="descriptions" rows="3" placeholder="' + (dg ? 'Up to 5, 90 characters each' : '2 to 4; the first up to 60 characters') + '">' + esc(d.descriptions) + '</textarea>', true, lines(d.descriptions, LIM.rsaD, dg ? 1 : 2, dg ? LIM.dgMax : 4));
        h += upload(dg ? 'Square image (1:1)' : 'Square image (1:1)', 'image', 'image', true, 'At least 600 × 600 px recommended.');
        if (!dg) h += upload('Landscape image (1.91:1)', 'image', 'landscape', true, 'Performance Max needs a landscape image as well, e.g. 1200 × 628 px.');
        h += '<p class="crm-help">Your business name and logo come from your business profile; the review says if one is missing.</p>';
      }
    } else if (p === 'tiktok') {
      h += field('Ad text', '<textarea class="crm-in" data-crm="adText" rows="2" maxlength="100">' + esc(d.adText) + '</textarea>', true, count(d.adText, LIM.ttText, 'Up to 100 characters.', true));
      h += field('Call to action', select('cta', TIKTOK_CTAS.map(function (c) { return [c, c]; }), d.cta || 'Learn more'), true);
      h += upload('Video', 'video', 'video', true, 'Vertical (9:16) MP4, MOV or WEBM, up to 12 MB in OrivenAI. TikTok extracts the cover image from the video.');
    } else if (p === 'pinterest') {
      h += field('Pin title', '<input class="crm-in" data-crm="title" maxlength="100" value="' + esc(d.title) + '">', true, count(d.title, LIM.pinTitle, 'Up to 100 characters.', true));
      h += field('Pin description', '<textarea class="crm-in" data-crm="description" rows="3" maxlength="800">' + esc(d.description) + '</textarea>', false, count(d.description, LIM.pinDesc, 'Up to 800 characters.', true));
      h += field('Alt text', '<input class="crm-in" data-crm="altText" maxlength="500" value="' + esc(d.altText) + '" placeholder="Describe the image for people using screen readers">', false);
      h += field('Format', select('creative', [['image', 'Image Pin'], ['video', 'Video Pin']], d.creative), true);
      h += d.creative === 'video' ? upload('Video', 'video', 'video', true, 'MP4, MOV or WEBM, up to 12 MB in OrivenAI. 2:3 or 9:16 works best.') : upload('Image', 'image', 'image', true, '2:3 (e.g. 1000 × 1500 px) works best.');
    } else if (p === 'snapchat') {
      h += field('Brand name', '<input class="crm-in" data-crm="brandName" maxlength="32" value="' + esc(d.brandName) + '" placeholder="Your business name">', true, count(d.brandName, LIM.snapBrand, 'Up to 32 characters.', true));
      h += field('Headline', '<input class="crm-in" data-crm="headline" maxlength="34" value="' + esc(d.headline) + '">', true, count(d.headline, LIM.snapHead, 'Up to 34 characters.', true));
      h += field('Call to action', select('cta', SNAP_CTAS, d.cta || 'MORE'), true);
      h += field('Format', select('creative', [['image', 'Image'], ['video', 'Video']], d.creative), true);
      h += d.creative === 'video' ? upload('Video', 'video', 'video', true, 'Vertical 9:16 (1080 × 1920), MP4 or MOV, up to 12 MB in OrivenAI.') : upload('Image', 'image', 'image', true, 'Vertical 9:16 (1080 × 1920 px).');
    }
    return h;
  }
  function stepReview() {
    var d = M.d, p = d.platform, R = M.review;
    var h = '<h2 id="crmH">Review</h2><p class="crm-sub">Checked by OrivenAI against ' + esc(PLAT[p].name) + '’s rules and your connected account. Saving keeps it as a draft in Campaigns; you publish it from Campaign Studio, where you confirm first and it is created paused.</p>';
    h += '<dl class="crm-sum">' + [
      [PLAT[p].levels[0], d.name + ' · ' + (GOAL_LABEL[d.goal] || d.goal) + (p === 'google' ? ' · ' + GTYPE[d.gtype] : '') + ' · ' + d.budget + ' per day'],
      [PLAT[p].levels[1], (d.groupName || 'Named after the campaign') + ' · ' + csv(d.countries).join(', ') + ' · ages ' + d.ageMin + '–' + d.ageMax + (p === 'meta' ? ' · ' + ({ automatic: 'Facebook and Instagram', instagram_only: 'Instagram only', facebook_only: 'Facebook only' })[d.placement] : '')],
      [PLAT[p].levels[2], adSummary()],
      ['Destination', d.url],
    ].map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (!R || R.loading) h += '<div class="crm-check" role="status">Checking with OrivenAI…</div>';
    else if (R.failed) h += '<div class="crm-check is-warn" role="alert">The check couldn’t run right now (' + esc(R.message || 'no answer') + '). You can still save the draft; Campaign Studio checks it again before publishing.</div>';
    else {
      var errs = (R.issues || []).filter(function (i) { return i.level === 'error'; }), warns = (R.issues || []).filter(function (i) { return i.level !== 'error'; });
      h += '<div class="crm-check ' + (errs.length ? 'is-bad' : 'is-ok') + '" role="status"><b>' + esc(errs.length ? errs.length + ' thing' + (errs.length === 1 ? '' : 's') + ' to fix before publishing' : 'Ready to publish from Campaign Studio') + '</b>' +
        (errs.length ? '<ul>' + errs.map(function (i) { return '<li>' + esc(i.message) + '</li>'; }).join('') + '</ul>' : '') +
        (warns.length ? '<p>Also worth checking:</p><ul>' + warns.map(function (i) { return '<li>' + esc(i.message) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      if (R.liveUnverified && R.liveUnverified.length) h += '<p class="crm-help">Not yet verified with a real ' + esc(PLAT[p].name) + ' account: ' + esc(R.liveUnverified.join(' ')) + '</p>';
    }
    if (M.saved) h += '<div class="crm-check is-ok" role="status"><b>Saved as a draft in Campaigns.</b> <button type="button" class="crm-btn crm-btn--primary" data-crm-open>Open in Campaign Studio</button></div>';
    else h += '<div class="crm-actions"><button type="button" class="crm-btn crm-btn--primary" data-crm-save>Save as draft campaign</button></div>';
    return h;
  }
  function adSummary() {
    var d = M.d, p = d.platform;
    if (p === 'meta') return '“' + d.headline + '” · ' + (d.cta || 'Learn more') + ' · image ' + (d.image ? 'added' : 'missing');
    if (p === 'google') return d.gtype === 'SEARCH' ? nl(d.headlines).length + ' headlines · ' + nl(d.descriptions).length + ' descriptions · ' + nl(d.keywords).length + ' keywords' : nl(d.headlines).length + ' headlines · ' + nl(d.descriptions).length + ' descriptions · images ' + (d.image ? 'added' : 'missing');
    if (p === 'tiktok') return '“' + d.adText + '” · video ' + (d.video ? 'added' : 'missing');
    if (p === 'pinterest') return '“' + d.title + '” · ' + (d.creative === 'video' ? 'video ' + (d.video ? 'added' : 'missing') : 'image ' + (d.image ? 'added' : 'missing'));
    return d.brandName + ' · “' + d.headline + '” · ' + (d.creative === 'video' ? 'video ' + (d.video ? 'added' : 'missing') : 'image ' + (d.image ? 'added' : 'missing'));
  }

  // ── Small builders ───────────────────────────────────────────────
  function field(label, control, req, help) { return '<div class="crm-f"><label class="crm-l">' + esc(label) + (req ? ' <i>required</i>' : '') + '</label>' + control + (help ? '<p class="crm-help">' + help + '</p>' : '') + '</div>'; }
  function select(key, opts, val) { return '<select class="crm-in" data-crm="' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function count(v, n, note, hard) { var l = String(v || '').length; return esc(note) + ' <span class="crm-count' + (l > n ? (hard ? ' is-bad' : ' is-warn') : '') + '">' + l + ' / ' + n + '</span>'; }
  function nl(v) { return String(v || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function csv(v) { return String(v || '').split(/[,;\s]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(function (x) { return /^[A-Z]{2}$/.test(x); }); }
  function lines(v, max, min, most) { var a = nl(v), long = a.filter(function (x) { return x.length > max; }).length; return esc(a.length + ' entered (' + (min ? min + '–' : 'up to ') + most + ')') + (long ? ' <span class="crm-count is-bad">' + long + ' over ' + max + ' characters</span>' : ''); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }

  // ── Validation (the basics; the server review checks everything) ─
  function problems(step) {
    var d = M.d, p = d.platform, e = [];
    if (!p || !PLAT[p]) return step >= 2 ? ['Choose a platform first.'] : [];
    if (step === 2) {
      if (!d.name.trim()) e.push('Give the campaign a name.');
      var g = goals().filter(function (x) { return x.goal === d.goal && x.available; })[0];
      if (!g) e.push('Choose an objective that ' + PLAT[p].name + ' supports.');
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
      if (p === 'meta') { if (!d.primaryText.trim()) e.push('Write the primary text.'); if (!d.headline.trim()) e.push('Write a headline.'); if (!d.image) e.push('Upload an image.'); }
      if (p === 'google') {
        var hs = nl(d.headlines), ds = nl(d.descriptions);
        if (d.gtype === 'SEARCH') {
          if (hs.length < LIM.rsaMinH || hs.length > LIM.rsaMaxH) e.push('Search ads need 3 to 15 headlines.');
          if (hs.some(function (x) { return x.length > LIM.rsaH; })) e.push('Keep each headline to 30 characters.');
          if (ds.length < LIM.rsaMinD || ds.length > LIM.rsaMaxD) e.push('Search ads need 2 to 4 descriptions.');
          if (ds.some(function (x) { return x.length > LIM.rsaD; })) e.push('Keep each description to 90 characters.');
          if (!nl(d.keywords).length) e.push('Add at least one keyword.');
          if (nl(d.callouts).some(function (x) { return x.length > LIM.callout; })) e.push('Keep each callout to 25 characters.');
        } else if (d.gtype === 'PERFORMANCE_MAX') {
          if (hs.length < 3 || hs.some(function (x) { return x.length > LIM.rsaH; })) e.push('Performance Max needs at least 3 headlines of up to 30 characters.');
          if (!d.longHeadline.trim() || d.longHeadline.length > LIM.pmaxLong) e.push('Write a long headline of up to 90 characters.');
          if (ds.length < 2 || ds.some(function (x) { return x.length > LIM.rsaD; }) || (ds[0] && ds[0].length > 60)) e.push('Add 2 to 4 descriptions (up to 90 characters; the first up to 60).');
          if (!d.image || !d.landscape) e.push('Upload a square and a landscape image.');
        } else {
          if (!hs.length || hs.length > LIM.dgMax || hs.some(function (x) { return x.length > LIM.dgH; })) e.push('Demand Gen needs 1 to 5 headlines of up to 40 characters.');
          if (!ds.length || ds.length > LIM.dgMax || ds.some(function (x) { return x.length > LIM.rsaD; })) e.push('Add 1 to 5 descriptions of up to 90 characters.');
          if (!d.image) e.push('Upload a square image.');
        }
      }
      if (p === 'tiktok') { if (!d.adText.trim() || d.adText.length > LIM.ttText) e.push('Write the ad text (up to 100 characters).'); if (!d.video) e.push('Upload a video — TikTok ads are videos.'); }
      if (p === 'pinterest') { if (!d.title.trim() || d.title.length > LIM.pinTitle) e.push('Write a Pin title (up to 100 characters).'); if (d.description.length > LIM.pinDesc) e.push('Keep the description to 800 characters.'); if (d.creative === 'video' ? !d.video : !d.image) e.push('Upload the ' + (d.creative === 'video' ? 'video' : 'image') + '.'); }
      if (p === 'snapchat') { if (!d.brandName.trim() || d.brandName.length > LIM.snapBrand) e.push('Add the brand name (up to 32 characters).'); if (!d.headline.trim() || d.headline.length > LIM.snapHead) e.push('Write a headline (up to 34 characters).'); if (d.creative === 'video' ? !d.video : !d.image) e.push('Upload the ' + (d.creative === 'video' ? 'video' : 'image') + '.'); }
    }
    return e;
  }

  // ── The campaign package (what the server spec reads) ───────────
  function buildPkg(src) {
    var d = src || M.d, p = d.platform, b = num(d.budget);
    var ov = { countries: csv(d.countries), ageMin: parseInt(d.ageMin, 10), ageMax: parseInt(d.ageMax, 10), adGroups: [{ name: d.groupName.trim() }] };
    var langs = String(d.languages || '').split(/[,;\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); if (langs.length) ov.languages = langs;
    var pkg = { campaignName: d.name.trim(), creationMode: 'manual', strategy: { goal: d.goal, landingPageUrl: d.url.trim() }, campaignStructure: { groups: 1, adsPerGroup: 1 }, spec: { overrides: ov }, inputs: {} };
    var o = pkg[PLAT[p].key] = {};
    if (p !== 'google') o.budget = b; else pkg.strategy.budgetRecommendation = { amount: b };
    if (p === 'meta') {
      ov.specialAdCategories = d.specialCat ? [d.specialCat] : [];
      if (d.dsaBeneficiary.trim()) ov.dsaBeneficiary = d.dsaBeneficiary.trim();
      if (d.dsaPayor.trim()) ov.dsaPayor = d.dsaPayor.trim();
      Object.assign(o, { placement: d.placement, imageUrl: d.image && d.image.url, headline: d.headline.trim(), primaryText: d.primaryText.trim(), description: d.description.trim(), cta: d.cta || 'Learn more' });
      pkg.concepts = [{ angle: 'manual', cta: d.cta || 'Learn more', adCopy: { headline: d.headline.trim(), primaryText: d.primaryText.trim(), description: d.description.trim() } }];
      pkg.inputs.format = 'image';
    } else if (p === 'google') {
      Object.assign(o, { campaignType: d.gtype, headlines: nl(d.headlines), descriptions: nl(d.descriptions) });
      if (d.gtype === 'SEARCH') {
        o.keywords = nl(d.keywords).map(function (k) { return { text: k, matchType: d.matchType }; }); o.matchType = d.matchType;
        if (nl(d.negatives).length) ov.negativeKeywords = nl(d.negatives);
        if (nl(d.callouts).length) ov.callouts = nl(d.callouts);
        pkg.inputs.format = 'text';
      } else {
        if (d.gtype === 'PERFORMANCE_MAX') { o.longHeadline = d.longHeadline.trim(); o.pmaxLandscapeImageUrl = d.landscape && d.landscape.url; }
        o.imageUrl = d.image && d.image.url; pkg.inputs.format = 'image';
      }
    } else if (p === 'tiktok') {
      Object.assign(o, { videoUrl: d.video && d.video.url, cta: d.cta || 'Learn more', script: d.adText.trim() });
      pkg.concepts = [{ angle: 'manual', cta: d.cta || 'Learn more', hook: d.adText.trim(), adCopy: { headline: d.adText.trim(), primaryText: d.adText.trim() } }];
      pkg.inputs.format = 'video';
    } else if (p === 'pinterest') {
      Object.assign(o, { title: d.title.trim(), description: d.description.trim(), altText: d.altText.trim(), creativeType: d.creative, destinationUrl: d.url.trim() });
      if (d.creative === 'video') o.videoUrl = d.video && d.video.url; else o.imageUrl = d.image && d.image.url;
      pkg.concepts = [{ angle: 'manual', adCopy: { headline: d.title.trim(), primaryText: d.description.trim() } }];
      pkg.inputs.format = d.creative;
    } else if (p === 'snapchat') {
      Object.assign(o, { brandName: d.brandName.trim(), headline: d.headline.trim(), cta: d.cta || 'MORE', creativeType: d.creative });
      if (d.creative === 'video') o.videoUrl = d.video && d.video.url; else o.imageUrl = d.image && d.image.url;
      pkg.concepts = [{ angle: 'manual', cta: d.cta || 'MORE', adCopy: { headline: d.headline.trim(), primaryText: d.headline.trim() } }];
      pkg.inputs.format = d.creative;
    }
    return pkg;
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
    var id = 'manualad_' + Date.now();
    // Not `source: 'manual'` — that marks a record of a campaign made outside OrivenAI. This one OrivenAI publishes.
    window._orvStoreCampaign({ id: id, name: pkg.campaignName, goal: d.goal, platform: p, status: 'generated', progress: 100, created: new Date().toISOString(), modules: [modKey], generated: gen, pkg: pkg, prompt: '', createdBy: 'manual', creationMode: 'manual' });
    M.saved = id;
    sset(DRAFT_KEY, null);
    if (typeof orvToast === 'function') orvToast('Saved as a draft campaign', 'ok');
    render();
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
  function onClick(e) {
    var b = e.target.closest('button, [data-crm-step]'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-crm-choose')) { choose(b.getAttribute('data-crm-choose')); return; }
    if (b.hasAttribute('data-crm-plat')) {
      var np = b.getAttribute('data-crm-plat');
      if (M.d.platform && M.d.platform !== np && hasWork() && M.d.step > 1 && !window.confirm('Switch to ' + PLAT[np].name + '? Platform-specific fields for ' + PLAT[M.d.platform].name + ' will be cleared; the campaign name, budget and audience stay.')) return;
      if (M.d.platform !== np) { var keep = { name: M.d.name, budget: M.d.budget, countries: M.d.countries, languages: M.d.languages, ageMin: M.d.ageMin, ageMax: M.d.ageMax, url: M.d.url }; M.d = Object.assign(blank(), keep, { platform: np, step: 1 }); }
      M.review = null; M.saved = null; save(); loadConn(np); render(); return;
    }
    if (b.hasAttribute('data-crm-step')) { var k = +b.getAttribute('data-crm-step'); if (k <= maxStep() || k < M.d.step) { M.d.step = k; M.tried = 0; if (k === 5) M.review = null; save(); render(); } return; }
    if (b.hasAttribute('data-crm-next')) {
      var s = M.d.step;
      if (s >= 2 && problems(s).length) { M.tried = s; render(); var er = root().querySelector('.crm-errs'); if (er && er.focus) { er.tabIndex = -1; er.focus(); } return; }
      M.d.step = s + 1; M.tried = 0; if (M.d.step === 5) M.review = null; save(); render(); return;
    }
    if (b.hasAttribute('data-crm-discard')) { if (!hasWork() || window.confirm('Discard this manual draft? What you entered here is removed. Your AI drafts are not affected.')) { M.d = blank(); M.review = null; M.saved = null; sset(DRAFT_KEY, null); render(); } return; }
    if (b.hasAttribute('data-crm-clear')) { M.d[b.getAttribute('data-crm-clear')] = null; save(); render(); return; }
    if (b.hasAttribute('data-crm-save')) { saveDraft(); return; }
    if (b.hasAttribute('data-crm-open')) { if (window.orvAppNav) window.orvAppNav.go('adstudio'); M.saved = null; M.d = blank(); render(); return; }
  }
  function onInput(e) {
    var el = e.target;
    if (el.hasAttribute('data-crm-country')) {
      var set = csv(M.d.countries), iso = el.getAttribute('data-crm-country');
      if (el.checked) { if (M.d.platform === 'snapchat') set = [iso]; else if (set.indexOf(iso) < 0) set.push(iso); } else set = set.filter(function (x) { return x !== iso; });
      M.d.countries = set.join(','); save(); if (M.d.platform === 'snapchat' || e.type === 'change') render(); return;
    }
    if (el.hasAttribute('data-crm-file')) { if (e.type === 'change') uploadFile(el); return; }
    var k = el.getAttribute('data-crm'); if (!k) return;
    M.d[k] = el.type === 'radio' ? el.value : el.value;
    if (k === 'gtype') { M.d.goal = ''; }
    save();
    // Re-render on choices that change the form; text fields only update their counters.
    if (el.tagName === 'SELECT' || el.type === 'radio') { render(); return; }
    var help = el.parentNode.querySelector('.crm-help');
    if (help && /crm-count|entered/.test(help.innerHTML)) { var fresh = document.createElement('div'); fresh.innerHTML = (M.d.step === 4 ? stepAd() : M.d.step === 2 ? stepCampaign() : stepAudience()); var same = [].slice.call(fresh.querySelectorAll('[data-crm="' + k + '"]'))[0]; if (same) { var h2 = same.parentNode.querySelector('.crm-help'); if (h2) help.innerHTML = h2.innerHTML; } }
  }
  function uploadFile(input) {
    var f = input.files && input.files[0]; if (!f) return;
    var key = input.getAttribute('data-crm-file'), kind = input.getAttribute('data-crm-kind');
    var max = kind === 'video' ? 12 : 8;
    if (f.size > max * 1024 * 1024) { window.alert('That file is larger than ' + max + ' MB. Please use a smaller file.'); return; }
    if (typeof window.apiFetch !== 'function') return;
    M.d.uploading = key; render();
    var rd = new FileReader();
    rd.onload = function () {
      window.apiFetch('/api/manual-campaigns/upload-creative', { method: 'POST', body: JSON.stringify(kind === 'image' ? { dataUrl: rd.result, purpose: 'ad_image' } : { dataUrl: rd.result }) }).then(function (r) {
        M.d.uploading = '';
        if (r && r.ok && r.data && r.data.url) { M.d[key] = { url: r.data.url, name: f.name, width: r.data.width || null, height: r.data.height || null }; save(); }
        else window.alert((r && r.data && (r.data.error || (r.data.problems && r.data.problems.map(function (x) { return x.message; }).join(' ')))) || 'The upload didn’t work. Please try again.');
        render();
      }, function () { M.d.uploading = ''; window.alert('The upload didn’t work. Please try again.'); render(); });
    };
    rd.onerror = function () { M.d.uploading = ''; render(); };
    rd.readAsDataURL(f);
  }

  // ── Mount ────────────────────────────────────────────────────────
  function init() {
    if (!page() || !page().querySelector('.cr2-hero')) return;
    var u = uid(); if (init._u === u && root()) { render(); return; }
    init._u = u; M = { mode: null, d: blank(), review: null, conn: {}, choices: null, saved: null }; load(); render();
  }
  function watch() {
    var pg = page(); if (!pg || pg._crm) return; pg._crm = true;
    new MutationObserver(function () { if (pg.classList.contains('active')) init(); }).observe(pg, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); watch(); }); else { init(); watch(); }
  // For tests: the package and the checks for a given set of answers (no DOM needed).
  function withDraft(d, fn) { var keep = M.d; M.d = Object.assign(blank(), d); try { return fn(); } finally { M.d = keep; } }
  window.orvCreateModes = { mode: function () { return M.mode; }, choose: choose, state: function () { return M.d; }, buildPkg: buildPkg, problems: problems, render: render, PLAT: PLAT,
    _pkgFor: function (d) { return withDraft(d, function () { return buildPkg(); }); }, _problemsFor: function (d, step) { return withDraft(d, function () { return problems(step); }); } };
})();
