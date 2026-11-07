/* ════════════════════════════════════════════════════════════════
   Create → Creative Testing (#page-creative-testing)

   Make several genuinely different versions of an ad idea (headlines,
   hooks, descriptions, CTAs, tone variants, image ideas, video angles),
   compare them side by side and keep the strongest. Built on what Create
   already has: /api/creative/variations (saves every set to My Content),
   /api/generate-image for an image of a visual idea (also saved to My
   Content), and /api/creative/testing/pick, which saves a chosen version
   as its own My Content item, ready for Campaign Builder.
   Nothing here claims a version "won": results per creative appear only
   when an ad platform reports them for a published campaign.
   window.orvCreativeTesting.open()
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit; if (!K) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-creative-testing', ROOT = 'ctsRoot';
  var KINDS = [['headline', 'Headlines'], ['hook', 'Hooks'], ['description', 'Descriptions'], ['cta', 'Calls to action'], ['emotional', 'Emotional tone'], ['premium', 'Premium tone'], ['urgency', 'Urgency'], ['image_idea', 'Image ideas'], ['video_angle', 'Video angles']];
  var S = { uid: null, sets: null, note: '', assets: [], busy: false, msg: null, images: {}, imgBusy: {} };

  function open() {
    if (!K.mount(PAGE, ROOT, onClick)) return;
    if (K.uid() !== S.uid) S = { uid: K.uid(), sets: null, note: '', assets: [], busy: false, msg: null, images: {}, imgBusy: {} };
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
      render();
    });
  }
  function seedOf(a) {
    var c = a.content || {};
    return String(c.text || c.headline || c.primaryText || c.copy || c.body || (Array.isArray(c.variations) ? c.variations[0] : '') || a.title || '').slice(0, 1000);
  }
  function render() {
    var el = document.getElementById(ROOT); if (!el) return;
    el.innerHTML = K.head('Create', 'Creative Testing', 'Write several versions of an ad idea, compare them side by side and keep the strongest. Chosen versions go to My Content, ready for your campaigns.')
      + '<section class="rx-card gx-card" aria-labelledby="ctsNewH"><h2 class="rx-h2" id="ctsNewH">New variations</h2>'
      + (S.assets.length ? '<label class="rx-lbl">Start from something you made <span class="rx-muted">(optional)</span><select class="rx-input" id="ctsFrom"><option value="">—</option>' + S.assets.map(function (a, i) { return '<option value="' + i + '">' + esc((a.title || seedOf(a)).slice(0, 80)) + '</option>'; }).join('') + '</select></label>' : '')
      + '<label class="rx-lbl">Your ad idea<textarea class="rx-input gx-ta" id="ctsSeed" rows="3" maxlength="1000" placeholder="e.g. Hand-poured soy candles from Utrecht — the gift that lasts"></textarea></label>'
      + '<div class="gx-row gx-row--wrap"><label class="rx-lbl gx-inline">What to vary<select class="rx-input" id="ctsKind">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + esc(k[1]) + '</option>'; }).join('') + '</select></label>'
      + '<label class="rx-lbl gx-inline">How many<select class="rx-input" id="ctsCount"><option>3</option><option selected>5</option><option>8</option><option>10</option></select></label></div>'
      + (S.msg ? '<p class="rx-err" role="alert">' + esc(S.msg) + '</p>' : '')
      + '<div class="gx-row"><button type="button" class="rx-btn rx-btn-primary" data-cts-gen' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '<span class="gx-spin" aria-hidden="true"></span> Writing variations…' : 'Create variations') + '</button><span class="rx-cost">' + K.cost('copy', 25) + ' credits</span></div></section>'
      + '<section class="gx-sec" aria-labelledby="ctsSetsH"><h2 class="rx-h2" id="ctsSetsH">Compare</h2>'
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
    if (e.target && e.target.id === 'ctsFrom') { var a = S.assets[parseInt(e.target.value, 10)]; var ta = document.getElementById('ctsSeed'); if (a && ta) ta.value = seedOf(a); }
  });
  window.orvCreativeTesting = { open: open, reload: load };
})();
