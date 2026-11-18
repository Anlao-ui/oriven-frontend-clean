/* ════════════════════════════════════════════════════════════════
   Create → Creative Testing (#page-creative-testing)

   Make several genuinely different versions of an ad idea (headlines,
   hooks, descriptions, CTAs, tone variants, image ideas, video angles),
   compare them side by side and keep the strongest. Built on what Create
   already has: /api/creative/variations (saves every set to My Content),
   /api/generate-image for an image of a visual idea (also saved to My
   Content), and /api/creative/testing/pick, which saves a chosen version
   as its own My Content item, ready for Campaign Builder.
   Compare two: any two items side by side — two versions from a set, two
   ads, two images or two concepts from My Content, or two live Meta ads.
   A creative comparison (the content: format, length, image, wording) is
   always shown; a performance comparison only when both are live ads with
   real results (Meta Ads reports results per ad). Nothing here claims a
   version "won" without those results.
   window.orvCreativeTesting.open()
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit; if (!K) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-creative-testing', ROOT = 'ctsRoot';
  var KINDS = [['headline', 'Headlines'], ['hook', 'Hooks'], ['description', 'Descriptions'], ['cta', 'Calls to action'], ['emotional', 'Emotional tone'], ['premium', 'Premium tone'], ['urgency', 'Urgency'], ['image_idea', 'Image ideas'], ['video_angle', 'Video angles']];
  var S = fresh(null);
  function fresh(uid) { return { uid: uid, sets: null, note: '', assets: [], all: [], ads: null, adsErr: false, cmpA: '', cmpB: '', busy: false, msg: null, images: {}, imgBusy: {} }; }
  var MIN_IMPRESSIONS = 500;

  function open() {
    if (!K.mount(PAGE, ROOT, onClick)) return;
    if (K.uid() !== S.uid) S = fresh(K.uid());
    K.show('testing', PAGE);
    render(); load();
  }
  function load() {
    Promise.all([api('/api/creative/testing/sets'), api('/api/creative/assets?sort=newest')]).then(function (rs) {
      if (rs[0].ok && rs[0].data) { S.sets = rs[0].data.sets || []; S.note = rs[0].data.performanceNote || ''; }
      else { S.sets = []; S.msg = K.refused(rs[0]); }
      var list = rs[1].ok && rs[1].data ? (rs[1].data.assets || rs[1].data.items || []) : [];
      // Text you made in Create, to start from (images and research excluded).
      S.assets = list.filter(function (a) { return a && a.content && ['ad', 'text', 'improved_text', 'headline', 'description', 'hook', 'email', 'copy'].indexOf(a.kind) !== -1; }).slice(0, 30);
      S.all = list.filter(function (a) { return a && a.content && a.kind !== 'research'; }).slice(0, 60);
      render();
    });
    loadAds();
  }
  // Live Meta ads with their real results (only when Meta Ads is connected).
  function loadAds() {
    var C = window.orvCampaignSources;
    var st = C && typeof C.status === 'function' ? C.status('meta') : Promise.resolve(null);
    st.then(function (x) {
      if (!x || x.conn !== 'connected') { S.ads = []; render(); return; }
      return api('/api/meta/ads?date_range=LAST_30_DAYS').then(function (r) {
        S.ads = r.ok && r.data && Array.isArray(r.data.ads) ? r.data.ads.filter(function (a) { return a && a.ad_id; }) : [];
        S.adsErr = !r.ok; render();
      });
    }, function () { S.ads = []; render(); });
  }

  // ── Compare two ────────────────────────────────────────────────
  // Every comparable item, normalised: { key, group, label, kind, platform, headline, text, cta, image, live, m }.
  function items() {
    var out = [];
    (S.sets || []).forEach(function (s) {
      var kindLabel = (KINDS.filter(function (k) { return k[0] === s.kind; })[0] || [s.kind, s.kind])[1];
      s.variations.forEach(function (v, i) {
        var key = 'v:' + s.id + ':' + i;
        out.push({ key: key, group: 'Variations · ' + (s.seed || 'Variations'), label: String.fromCharCode(65 + (i % 26)) + ' · ' + String(v).slice(0, 60), kind: kindLabel.replace(/s$/, ''), text: String(v), image: S.images[s.id + ':' + i] || null });
      });
    });
    S.all.forEach(function (a) {
      var c = a.content || {}, p = c.metaAds || c.googleAds || c.tiktokAds || c.pinterestAds || c.snapchatAds || c;
      var text = p.primaryText || p.text || p.description || p.body || c.text || c.copy || (Array.isArray(c.variations) ? c.variations.join(' / ') : '');
      out.push({ key: 'a:' + a.id, group: 'My Content', label: (a.title || a.kind) + ' · ' + kindName(a.kind), kind: kindName(a.kind), platform: a.platform || null, headline: p.headline || null, text: text || null, cta: p.cta || null, image: c.url || c.imageUrl || p.imageUrl || null });
    });
    (S.ads || []).forEach(function (a) {
      out.push({ key: 'm:' + a.ad_id, group: 'Live Meta ads · last 30 days', label: a.ad_name || a.ad_id, kind: 'Live ad', platform: 'meta', live: true,
        m: { impressions: +a.impressions || 0, clicks: +a.clicks || 0, spend: +a.spend || 0, conversions: a.conversions == null ? null : +a.conversions }, status: a.status || null });
    });
    return out;
  }
  function kindName(k) { return ({ ad: 'Ad', image: 'Image', caption: 'Caption', text: 'Text', improved_text: 'Text', headline: 'Headline', description: 'Description', hook: 'Hook', email: 'Email', copy: 'Copy', video: 'Video', concept: 'Concept' })[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Item'); }
  function pickerHtml(id, cur, other, list) {
    var groups = {}; list.forEach(function (x) { (groups[x.group] = groups[x.group] || []).push(x); });
    return '<select class="rx-input" id="' + id + '" data-cts-cmp aria-label="' + (id === 'ctsCmpA' ? 'First to compare' : 'Second to compare') + '"><option value="">Choose…</option>' +
      Object.keys(groups).map(function (g) { return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (x) { return '<option value="' + esc(x.key) + '"' + (x.key === cur ? ' selected' : '') + (x.key === other ? ' disabled' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select>';
  }
  function words(t) { return t ? String(t).trim().split(/\s+/).filter(Boolean).length : 0; }
  // What is different between the two, stated as facts about the content (no judgement).
  function differences(a, b) {
    var d = [];
    if (a.kind !== b.kind) d.push('Different format: ' + a.kind + ' vs ' + b.kind + '.');
    if (a.platform && b.platform && a.platform !== b.platform) d.push('Different platforms: ' + a.platform + ' vs ' + b.platform + '.');
    if (!!a.image !== !!b.image) d.push((a.image ? 'A' : 'B') + ' has an image; ' + (a.image ? 'B' : 'A') + ' is text only.');
    var ta = (a.headline ? a.headline + ' ' : '') + (a.text || ''), tb = (b.headline ? b.headline + ' ' : '') + (b.text || '');
    if (ta && tb) {
      var wa = words(ta), wb = words(tb);
      if (wa !== wb) d.push('Length: A has ' + wa + ' word' + (wa === 1 ? '' : 's') + ', B has ' + wb + '.');
      var q = function (t) { return /\?/.test(t); }, n = function (t) { return /\d/.test(t); }, ex = function (t) { return /!/.test(t); };
      if (q(ta) !== q(tb)) d.push((q(ta) ? 'A' : 'B') + ' asks a question.');
      if (n(ta) !== n(tb)) d.push((n(ta) ? 'A' : 'B') + ' uses a number.');
      if (ex(ta) !== ex(tb)) d.push((ex(ta) ? 'A' : 'B') + ' uses an exclamation mark.');
    }
    if ((a.cta || '') !== (b.cta || '') && (a.cta || b.cta)) d.push('Call to action: ' + (a.cta || 'none') + ' vs ' + (b.cta || 'none') + '.');
    return d.length ? d : ['The two have the same format and a similar length; the wording differs.'];
  }
  function sideHtml(x, tag) {
    return '<div class="cts-side"><span class="gx-var__n">' + tag + '</span><p class="cts-side__k">' + esc(x.kind) + (x.platform ? ' · ' + esc(x.platform) : '') + (x.status ? ' · ' + esc(String(x.status).toLowerCase()) : '') + '</p>'
      + (x.image ? '<img class="cts-side__img" src="' + esc(x.image) + '" alt="' + tag + ': ' + esc(x.label) + '" loading="lazy">' : '')
      + (x.headline ? '<p class="cts-side__h">' + esc(x.headline) + '</p>' : '')
      + (x.text ? '<p class="cts-side__t">' + esc(x.text) + '</p>' : (x.live ? '<p class="cts-side__t rx-muted">' + esc(x.label) + '</p>' : ''))
      + (x.cta ? '<p class="cts-side__c">' + esc(x.cta) + '</p>' : '') + '</div>';
  }
  var f1 = function (v, d) { return v == null || !isFinite(v) ? '—' : v.toFixed(d); };
  var money = function (v) { return v == null || !isFinite(v) ? '—' : (typeof window.orvFormatMoney === 'function' ? window.orvFormatMoney(v, window.orvMetricCurrency || 'EUR') : '€' + v.toFixed(2)); };
  // Two figures count as different only from a 3% gap (smaller gaps are noise).
  var differs = function (x, y) { if (x == null || y == null) return false; var m = Math.max(Math.abs(x), Math.abs(y)); return m > 0 && Math.abs(x - y) / m >= 0.03; };
  function perfHtml(a, b) {
    var row = function (label, va, vb, fa, better) {
      var win = differs(va, vb) && better ? ((better === 'hi') === (va > vb) ? 'a' : 'b') : null;
      return '<tr><th scope="row">' + label + '</th><td' + (win === 'a' ? ' class="is-best"' : '') + '>' + fa(va) + '</td><td' + (win === 'b' ? ' class="is-best"' : '') + '>' + fa(vb) + '</td></tr>';
    };
    var M = function (x) { var m = x.m; return { impr: m.impressions, clicks: m.clicks, ctr: m.impressions ? m.clicks / m.impressions * 100 : null, cpc: m.clicks ? m.spend / m.clicks : null, spend: m.spend, conv: m.conversions, cpa: m.conversions ? m.spend / m.conversions : null }; };
    var A = M(a), B = M(b);
    var low = A.impr < MIN_IMPRESSIONS || B.impr < MIN_IMPRESSIONS;
    var verdict;
    if (low) verdict = 'Too early to tell: each ad needs at least ' + MIN_IMPRESSIONS + ' impressions.';
    else if (A.conv > 0 && B.conv > 0 && differs(A.cpa, B.cpa)) verdict = (A.cpa < B.cpa ? 'A' : 'B') + ' performs better: each conversion costs ' + money(Math.min(A.cpa, B.cpa)) + ' against ' + money(Math.max(A.cpa, B.cpa)) + '.';
    else if ((A.conv > 0) !== (B.conv > 0)) verdict = (A.conv > 0 ? 'A' : 'B') + ' brought conversions and the other none.';
    else if (differs(A.ctr, B.ctr)) verdict = (A.ctr > B.ctr ? 'A' : 'B') + ' gets clicked more often (' + f1(Math.max(A.ctr, B.ctr), 2) + '% vs ' + f1(Math.min(A.ctr, B.ctr), 2) + '% CTR); no conversion difference to judge by.';
    else verdict = 'The two perform about the same.';
    return '<section class="cts-perf" aria-label="Performance comparison"><h4 class="cts-tag is-perf">Performance comparison · real results, Meta Ads, last 30 days</h4>'
      + '<p class="cts-verdict">' + esc(verdict) + '</p>'
      + '<table class="cts-table"><thead><tr><th scope="col">Metric</th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody>'
      + row('Impressions', A.impr, B.impr, function (v) { return v == null ? '—' : Math.round(v).toLocaleString('en'); }, null)
      + row('Clicks', A.clicks, B.clicks, function (v) { return v == null ? '—' : Math.round(v).toLocaleString('en'); }, null)
      + row('CTR', A.ctr, B.ctr, function (v) { return v == null ? '—' : f1(v, 2) + '%'; }, 'hi')
      + row('CPC', A.cpc, B.cpc, money, 'lo')
      + row('Spend', A.spend, B.spend, money, null)
      + row('Conversions', A.conv, B.conv, function (v) { return v == null ? 'Not reported' : String(Math.round(v)); }, 'hi')
      + row('CPA', A.cpa, B.cpa, money, 'lo')
      + '</tbody></table><p class="rx-muted cts-basis">Calculated from Meta Ads’ reported figures; no AI.</p></section>';
  }
  function compareHtml() {
    var list = items();
    var head = '<section class="rx-card gx-card cts-cmp" aria-labelledby="ctsCmpH"><h2 class="rx-h2" id="ctsCmpH">Compare two</h2>'
      + '<p class="rx-muted cts-lead">Two versions, two ads, two images or two concepts, side by side.</p>';
    if (S.sets === null) return head + '<p class="rx-muted gx-loading">Loading…</p></section>';
    if (list.length < 2) return head + '<p class="rx-muted">Create variations, save ads or images in Create, or connect Meta Ads to compare live ads.</p></section>';
    var a = list.filter(function (x) { return x.key === S.cmpA; })[0], b = list.filter(function (x) { return x.key === S.cmpB; })[0];
    var pickers = '<div class="cts-pickers"><label class="rx-lbl">A' + pickerHtml('ctsCmpA', S.cmpA, S.cmpB, list) + '</label><label class="rx-lbl">B' + pickerHtml('ctsCmpB', S.cmpB, S.cmpA, list) + '</label></div>';
    if (!a || !b) return head + pickers + '<p class="rx-muted">Choose two to see them side by side.</p></section>';
    var perf = a.live && b.live;
    return head + pickers
      + '<div class="cts-sides">' + sideHtml(a, 'A') + sideHtml(b, 'B') + '</div>'
      + '<section class="cts-creative" aria-label="Creative comparison"><h4 class="cts-tag">Creative comparison · the content, not results</h4><ul class="cts-diff">' + differences(a, b).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>'
      + (perf ? perfHtml(a, b) : '<p class="cts-note">No performance results to compare: this compares the content only, so neither is a proven winner. Results per version appear once both run as ads on a platform that reports results per ad (Meta Ads).</p>')
      + '</section>';
  }
  function seedOf(a) {
    var c = a.content || {};
    return String(c.text || c.headline || c.primaryText || c.copy || c.body || (Array.isArray(c.variations) ? c.variations[0] : '') || a.title || '').slice(0, 1000);
  }
  function render() {
    var el = document.getElementById(ROOT); if (!el) return;
    el.innerHTML = K.head('Create', 'Creative Testing', 'Write several versions of an ad idea, compare them side by side and keep the strongest. Chosen versions go to My Content, ready for your campaigns.')
      + '<div class="cts-top"><section class="rx-card gx-card" aria-labelledby="ctsNewH"><h2 class="rx-h2" id="ctsNewH">New variations</h2>'
      + (S.assets.length ? '<label class="rx-lbl">Start from something you made <span class="rx-muted">(optional)</span><select class="rx-input" id="ctsFrom"><option value="">—</option>' + S.assets.map(function (a, i) { return '<option value="' + i + '">' + esc((a.title || seedOf(a)).slice(0, 80)) + '</option>'; }).join('') + '</select></label>' : '')
      + '<label class="rx-lbl">Your ad idea<textarea class="rx-input gx-ta" id="ctsSeed" rows="3" maxlength="1000" placeholder="e.g. Hand-poured soy candles from Utrecht — the gift that lasts"></textarea></label>'
      + '<div class="gx-row gx-row--wrap"><label class="rx-lbl gx-inline">What to vary<select class="rx-input" id="ctsKind">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + esc(k[1]) + '</option>'; }).join('') + '</select></label>'
      + '<label class="rx-lbl gx-inline">How many<select class="rx-input" id="ctsCount"><option>3</option><option selected>5</option><option>8</option><option>10</option></select></label></div>'
      + (S.msg ? '<p class="rx-err" role="alert">' + esc(S.msg) + '</p>' : '')
      + '<div class="gx-row"><button type="button" class="rx-btn rx-btn-primary" data-cts-gen' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '<span class="gx-spin" aria-hidden="true"></span> Writing variations…' : 'Create variations') + '</button><span class="rx-cost">' + K.cost('copy', 25) + ' credits</span></div></section>'
      + compareHtml() + '</div>'
      + '<section class="gx-sec" aria-labelledby="ctsSetsH"><h2 class="rx-h2" id="ctsSetsH">Your variation sets</h2>'
      + '<p class="gx-note rx-muted">' + esc(S.note) + '</p>'
      + (S.sets === null ? '<p class="rx-muted gx-loading">Loading…</p>' : S.sets.length ? S.sets.map(setHtml).join('') : '<p class="rx-muted">Your variation sets appear here. Variations you made earlier in Create appear here too.</p>')
      + '</section>';
  }
  function setHtml(s) {
    var label = (KINDS.filter(function (k) { return k[0] === s.kind; })[0] || [s.kind, s.kind])[1];
    var visual = s.kind === 'image_idea', video = s.kind === 'video_angle';
    var picked = {}; (s.picked || []).forEach(function (p) { picked[p.index] = true; });
    return '<article class="rx-card gx-set"><div class="gx-set__h"><div><h3 class="rx-h3">' + esc(s.seed || 'Variations') + '</h3><span class="rx-muted">' + esc(label) + ' · ' + esc(K.day(s.createdAt)) + ' · ' + s.variations.length + ' versions</span></div>'
      + (s.picked && s.picked.length ? '<button type="button" class="rx-btn rx-btn-ghost" data-cts-page="campaign-builder">Use in Campaign Builder</button>' : '') + '</div>'
      + '<ol class="gx-compare">' + s.variations.map(function (v, i) {
        var key = s.id + ':' + i, img = S.images[key];
        return '<li class="gx-var' + (picked[i] ? ' is-picked' : '') + '"><span class="gx-var__n">' + String.fromCharCode(65 + (i % 26)) + '</span><p class="gx-var__t">' + esc(v) + '</p>'
          + (img ? '<img class="gx-var__img" src="' + esc(img) + '" alt="Image for version ' + String.fromCharCode(65 + (i % 26)) + '">' : '')
          + '<div class="gx-var__a">' + (picked[i] ? '<span class="gx-ok">✓ Saved to My Content</span>' : '<button type="button" class="rx-btn" data-cts-pick="' + esc(s.id) + '" data-i="' + i + '">Choose</button>')
          + '<button type="button" class="rx-btn rx-btn-ghost" data-cts-copy="' + esc(key) + '">Copy</button>'
          + (visual && !img ? '<button type="button" class="rx-btn rx-btn-ghost" data-cts-img="' + esc(key) + '"' + (S.imgBusy[key] ? ' disabled' : '') + '>' + (S.imgBusy[key] ? 'Creating…' : 'Create image · ' + K.cost('image', 55) + ' credits') + '</button>' : '')
          + (video ? '<button type="button" class="rx-btn rx-btn-ghost" data-cts-video="' + esc(key) + '">Make a video in Create</button>' : '')
          + '</div></li>';
      }).join('') + '</ol></article>';
  }
  function findVar(key) {
    var p = key.split(':'), i = parseInt(p.pop(), 10), id = p.join(':');
    var s = (S.sets || []).filter(function (x) { return x.id === id; })[0];
    return s ? { set: s, i: i, text: s.variations[i] } : null;
  }
  function generate(btn) {
    var seed = (document.getElementById('ctsSeed') || {}).value || '';
    if (!seed.trim()) { S.msg = 'Write your ad idea first (or start from something you made).'; render(); return; }
    var kind = (document.getElementById('ctsKind') || {}).value || 'headline', count = parseInt((document.getElementById('ctsCount') || {}).value, 10) || 5;
    S.busy = true; S.msg = null; render();
    api('/api/creative/variations', 'POST', { kind: kind, seed: seed.trim(), count: count }).then(function (r) {
      S.busy = false;
      if (!r.ok) { S.msg = K.refused(r, 'create'); render(); return; }
      if (typeof window.consumeUsage === 'function') window.consumeUsage(K.cost('copy', 25));
      // The set was saved by the server; read it back with the others.
      setTimeout(load, 600);
      render();
    });
  }
  function pick(setId, i, btn) {
    btn.disabled = true;
    api('/api/creative/testing/pick', 'POST', { setId: setId, index: i }).then(function (r) {
      if (!r.ok) { btn.disabled = false; if (typeof window.orvToast === 'function') window.orvToast(K.refused(r), 'warn'); return; }
      var s = (S.sets || []).filter(function (x) { return x.id === setId; })[0];
      if (s) { s.picked = (s.picked || []).concat([{ index: i, assetId: r.data.asset && r.data.asset.id }]); }
      if (typeof window.orvToast === 'function') window.orvToast('Saved to My Content — ready for your campaigns', 'ok');
      render();
    });
  }
  function image(key, btn) {
    var v = findVar(key); if (!v) return;
    S.imgBusy[key] = true; render();
    api('/api/generate-image', 'POST', { prompt: String(v.text).slice(0, 900), size: '1:1', imageType: 'display' }).then(function (r) {
      S.imgBusy[key] = false;
      if (!r.ok || !r.data || !r.data.imageUrl) { if (typeof window.orvToast === 'function') window.orvToast(K.refused(r, 'image'), 'warn'); render(); return; }
      S.images[key] = r.data.imageUrl;
      if (typeof window.consumeUsage === 'function') window.consumeUsage(K.cost('image', 55));
      render();
    });
  }
  function copy(key) {
    var v = findVar(key); if (!v) return;
    try { navigator.clipboard.writeText(String(v.text)); if (typeof window.orvToast === 'function') window.orvToast('Copied', 'ok'); } catch (_) {}
  }
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-cts-gen')) { generate(b); return; }
    if (b.hasAttribute('data-cts-pick')) { pick(b.getAttribute('data-cts-pick'), parseInt(b.getAttribute('data-i'), 10), b); return; }
    if (b.hasAttribute('data-cts-img')) { image(b.getAttribute('data-cts-img'), b); return; }
    if (b.hasAttribute('data-cts-copy')) { copy(b.getAttribute('data-cts-copy')); return; }
    if (b.hasAttribute('data-cts-video')) { copy(b.getAttribute('data-cts-video')); if (window.orvPages) window.orvPages.open('create'); return; }
    if (b.hasAttribute('data-cts-page')) { if (window.orvPages) window.orvPages.open(b.getAttribute('data-cts-page')); return; }
  }
  document.addEventListener('change', function (e) {
    if (e.target && (e.target.id === 'ctsCmpA' || e.target.id === 'ctsCmpB')) { S[e.target.id === 'ctsCmpA' ? 'cmpA' : 'cmpB'] = e.target.value; render(); var el = document.getElementById(e.target.id); if (el) el.focus(); return; }
    if (e.target && e.target.id === 'ctsFrom') { var a = S.assets[parseInt(e.target.value, 10)]; var ta = document.getElementById('ctsSeed'); if (a && ta) ta.value = seedOf(a); }
  });
  window.orvCreativeTesting = { open: open, reload: load, _state: function () { return S; }, _differences: differences };
})();
