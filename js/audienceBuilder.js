/* ════════════════════════════════════════════════════════════════
   Launch → Audience Builder (#page-audience-builder)

   Audience suggestions from what OrivenAI knows about the business (the
   onboarding answers, business details, saved research), saved audiences
   you can edit, targeting recommendations per ad platform, and a way to use
   an audience in Campaign Builder. Saved audiences are the business's own
   list (/api/audiences → business_audiences, also in Control Center).
   An audience here is PREPARED IN ORIVENAI: nothing is created in Meta,
   Google, TikTok or Pinterest from this page, and it never says otherwise.
   window.orvAudienceBuilder.open()
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit; if (!K) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-audience-builder', ROOT = 'aubRoot';
  var PLATFORMS = ['Meta', 'Google', 'TikTok', 'Pinterest'];
  var S = { uid: null, saved: null, sugg: [], used: null, busy: false, msg: null, editing: null, draft: null };

  function open() {
    if (!K.mount(PAGE, ROOT, onClick)) return;
    if (K.uid() !== S.uid) S = { uid: K.uid(), saved: null, sugg: [], used: null, busy: false, msg: null, editing: null, draft: null };
    K.show('audiences', PAGE);
    render(); load();
  }
  function load() {
    api('/api/audiences').then(function (r) {
      S.saved = r.ok && r.data ? r.data.audiences || [] : [];
      if (!r.ok) S.msg = esc(K.refused(r));
      render();
    });
  }
  var LIST = function (v) { return Array.isArray(v) ? v : String(v || '').split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean); };

  function render() {
    var el = document.getElementById(ROOT); if (!el) return;
    el.innerHTML = K.head('Launch', 'Audience Builder', 'Define who your ads are for. OrivenAI suggests audiences from your onboarding answers, business details and research; you decide what to keep.')
      + '<p class="gx-status-note"><span class="gx-pill">Prepared in OrivenAI</span> Audiences here are prepared for your campaigns. They are not created in Meta, Google, TikTok or Pinterest until a campaign using them is published there.</p>'
      + '<section class="rx-card gx-card" aria-labelledby="aubSugH"><h2 class="rx-h2" id="aubSugH">Suggest audiences</h2>'
      + '<label class="rx-lbl">Anything to focus on? <span class="rx-muted">(optional)</span><input class="rx-input" id="aubFocus" maxlength="300" placeholder="e.g. people buying gifts for Mother’s Day"></label>'
      + (S.msg ? '<p class="rx-err" role="alert">' + S.msg + '</p>' : '')
      + '<div class="gx-row"><button type="button" class="rx-btn rx-btn-primary" data-aub-suggest' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '<span class="gx-spin" aria-hidden="true"></span> Thinking about your audiences…' : 'Suggest audiences') + '</button><span class="rx-cost">' + K.cost('audience', 25) + ' credits</span>'
      + '<button type="button" class="rx-btn rx-btn-ghost" data-aub-new>Create one yourself</button></div>'
      + (S.editing === 'new' ? form(S.draft || {}, 'new') : '')
      + (S.sugg.length ? '<div class="gx-grid gx-grid--wide">' + S.sugg.map(function (s, i) { return S.editing === 's' + i ? '<div class="rx-card gx-aud">' + form(s, 's' + i) + '</div>' : audCard(s, { sugg: i }); }).join('') + '</div>' : '')
      + '</section>'
      + '<section class="gx-sec" aria-labelledby="aubSavedH"><h2 class="rx-h2" id="aubSavedH">Your audiences</h2>'
      + (S.saved === null ? '<p class="rx-muted gx-loading">Loading…</p>' : S.saved.length ? '<div class="gx-grid gx-grid--wide">' + S.saved.map(function (a) { return S.editing === a.id ? '<div class="rx-card gx-aud">' + form(fromSaved(a), a.id) + '</div>' : audCard(fromSaved(a), { saved: a }); }).join('') + '</div>' : '<p class="rx-muted">No saved audiences yet. Save a suggestion or create one yourself.</p>')
      + '</section>';
  }
  function fromSaved(a) {
    var p = a.profile || {};
    return { id: a.id, name: a.name, description: p.description || a.behaviour || '', age_range: a.age_range, location: a.location, language: a.language,
      interests: LIST(a.interests), pain_points: LIST(a.pain_points), goals: LIST(a.goals), objections: LIST(a.objections), buying_triggers: LIST(a.buying_triggers),
      preferred_platforms: LIST(a.preferred_platforms), targeting: p.targeting || {}, basis: p.basis || {}, assumptions: p.assumptions || [], text: a.text };
  }
  function chips(list) { return (list || []).length ? '<span class="gx-chips">' + list.map(function (x) { return '<span class="rx-chip">' + esc(x) + '</span>'; }).join('') + '</span>' : ''; }
  function targeting(t) {
    t = t || {};
    var rows = [];
    var m = t.meta || {}; if ((m.interests || []).length || m.age_min) rows.push(['Meta', [m.age_min && m.age_max ? 'Age ' + m.age_min + '–' + m.age_max : '', (m.locations || []).join(', '), (m.interests || []).length ? 'Interests: ' + m.interests.join(', ') : ''].filter(Boolean).join(' · ')]);
    var g = t.google || {}; if ((g.keywords || []).length || (g.audiences || []).length) rows.push(['Google', [(g.keywords || []).length ? 'Keywords: ' + g.keywords.join(', ') : '', (g.audiences || []).length ? 'Audiences: ' + g.audiences.join(', ') : ''].filter(Boolean).join(' · ')]);
    var k = t.tiktok || {}; if ((k.interests || []).length) rows.push(['TikTok', [(k.age_groups || []).length ? 'Ages ' + k.age_groups.join(', ') : '', 'Interests: ' + k.interests.join(', ')].filter(Boolean).join(' · ')]);
    var p = t.pinterest || {}; if ((p.interests || []).length || (p.keywords || []).length) rows.push(['Pinterest', [(p.interests || []).length ? 'Interests: ' + p.interests.join(', ') : '', (p.keywords || []).length ? 'Keywords: ' + p.keywords.join(', ') : ''].filter(Boolean).join(' · ')]);
    if (!rows.length) return '';
    return '<details class="gx-target"><summary>Targeting recommendations</summary><dl class="rx-dl gx-dl">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl><p class="rx-muted gx-fine">Suggestions to set up in the platform’s targeting. Check them in the platform before you publish.</p></details>';
  }
  function basisLine(b, assumptions) {
    var from = [b.onboarding && 'your onboarding answers', b.business && 'your business details', b.research && 'your research'].filter(Boolean);
    return '<p class="gx-basisline">' + (from.length ? K.basis('user') + ' Based on ' + esc(from.join(', ')) : K.basis('analysis') + ' AI suggestion — not based on your saved information') + '</p>'
      + ((assumptions || []).length ? '<p class="rx-muted gx-fine">Assumed: ' + esc(assumptions.join('; ')) + '</p>' : '');
  }
  function audCard(a, o) {
    var facts = [a.age_range, a.location, a.language].filter(Boolean).join(' · ');
    return '<article class="rx-card gx-aud"><div class="gx-comp__h"><h3 class="rx-h3">' + esc(a.name) + '</h3>' + (o.saved ? '<span class="gx-pill">Prepared in OrivenAI</span>' : '<span class="gx-pill gx-pill--new">Suggestion</span>') + '</div>'
      + (facts ? '<p class="gx-facts">' + esc(facts) + '</p>' : '')
      + (a.description ? '<p>' + esc(a.description) + '</p>' : '')
      + ((a.interests || []).length ? '<p class="gx-sub">Interests</p>' + chips(a.interests) : '')
      + ((a.pain_points || []).length ? '<p class="gx-sub">Problems they want solved</p>' + chips(a.pain_points) : '')
      + ((a.goals || []).length ? '<p class="gx-sub">What they want</p>' + chips(a.goals) : '')
      + ((a.preferred_platforms || []).length ? '<p class="gx-sub">Where to reach them</p>' + chips(a.preferred_platforms) : '')
      + targeting(a.targeting)
      + (o.sugg !== undefined ? basisLine(a.basis || {}, a.assumptions) : '')
      + '<div class="gx-row gx-row--wrap">'
      + (o.sugg !== undefined
        ? '<button type="button" class="rx-btn rx-btn-primary" data-aub-save="' + o.sugg + '">Save audience</button><button type="button" class="rx-btn rx-btn-ghost" data-aub-edit="s' + o.sugg + '">Edit first</button>'
        : '<button type="button" class="rx-btn" data-aub-use="' + esc(a.id) + '">Use in Campaign Builder</button><button type="button" class="rx-btn rx-btn-ghost" data-aub-edit="' + esc(a.id) + '">Edit</button><button type="button" class="rx-btn rx-btn-ghost" data-aub-del="' + esc(a.id) + '">Delete</button>')
      + '</div></article>';
  }
  function form(a, key) {
    var j = function (v) { return esc((v || []).join(', ')); };
    return '<form class="gx-form" data-aub-form="' + esc(key) + '">'
      + '<label class="rx-lbl">Name<input class="rx-input" name="name" required maxlength="80" value="' + esc(a.name || '') + '"></label>'
      + '<label class="rx-lbl">Who they are<textarea class="rx-input gx-ta" name="description" rows="2" maxlength="400">' + esc(a.description || '') + '</textarea></label>'
      + '<div class="gx-row gx-row--wrap"><label class="rx-lbl gx-inline">Age<input class="rx-input" name="age_range" maxlength="40" value="' + esc(a.age_range || '') + '" placeholder="25–44"></label>'
      + '<label class="rx-lbl gx-inline">Location<input class="rx-input" name="location" maxlength="120" value="' + esc(a.location || '') + '"></label>'
      + '<label class="rx-lbl gx-inline">Language<input class="rx-input" name="language" maxlength="60" value="' + esc(a.language || '') + '"></label></div>'
      + '<label class="rx-lbl">Interests <span class="rx-muted">(comma separated)</span><input class="rx-input" name="interests" value="' + j(a.interests) + '"></label>'
      + '<label class="rx-lbl">Problems they want solved<input class="rx-input" name="pain_points" value="' + j(a.pain_points) + '"></label>'
      + '<label class="rx-lbl">What they want<input class="rx-input" name="goals" value="' + j(a.goals) + '"></label>'
      + '<fieldset class="gx-fs"><legend class="rx-lbl">Where to reach them</legend>' + PLATFORMS.map(function (p) { return '<label class="gx-check"><input type="checkbox" name="platforms" value="' + p + '"' + ((a.preferred_platforms || []).indexOf(p) !== -1 ? ' checked' : '') + '> ' + p + '</label>'; }).join('') + '</fieldset>'
      + '<div class="gx-row"><button type="submit" class="rx-btn rx-btn-primary">Save audience</button><button type="button" class="rx-btn rx-btn-ghost" data-aub-cancel>Cancel</button></div></form>';
  }
  function readForm(f, base) {
    var list = function (n) { return LIST(f[n].value); };
    return Object.assign({}, base || {}, { name: f.name.value.trim(), description: f.description.value.trim(), age_range: f.age_range.value.trim(), location: f.location.value.trim(), language: f.language.value.trim(),
      interests: list('interests'), pain_points: list('pain_points'), goals: list('goals'),
      preferred_platforms: Array.prototype.filter.call(f.querySelectorAll('input[name="platforms"]'), function (i) { return i.checked; }).map(function (i) { return i.value; }) });
  }

  // ── Actions ───────────────────────────────────────────────────────
  function suggest() {
    var focus = (document.getElementById('aubFocus') || {}).value || '';
    S.busy = true; S.msg = null; render();
    api('/api/audiences/suggest', 'POST', { focus: focus.trim() }).then(function (r) {
      S.busy = false;
      if (r.ok && r.data) { S.sugg = r.data.segments || []; S.used = r.data.used || null; if (typeof window.consumeUsage === 'function') window.consumeUsage(K.cost('audience', 25)); render(); return; }
      if (r.data && r.data.code === 'NOT_ENOUGH_CONTEXT') S.msg = esc(r.data.error) + ' <a href="#" class="rx-link" data-aub-page="control-center">Open Control Center</a>';
      else S.msg = esc(K.refused(r, 'create'));
      render();
    });
  }
  function save(seg, existingId) {
    api(existingId ? '/api/audiences/' + encodeURIComponent(existingId) : '/api/audiences', existingId ? 'PUT' : 'POST', { audience: seg }).then(function (r) {
      if (!r.ok) { S.msg = esc(K.refused(r)); render(); return; }
      if (typeof window.orvToast === 'function') window.orvToast('Audience saved', 'ok');
      S.editing = null; S.draft = null;
      if (!existingId) S.sugg = S.sugg.filter(function (x) { return x !== seg && x.name !== seg.name; });
      load();
    });
  }
  function use(id) {
    var a = (S.saved || []).filter(function (x) { return x.id === id; })[0]; if (!a) return;
    // Campaign Builder offers it for campaigns that aren't published yet (js/appNav.js).
    try { sessionStorage.setItem('orv_pending_audience', JSON.stringify({ id: a.id, name: a.name, text: a.text || a.name })); } catch (_) {}
    if (window.orvPages) window.orvPages.open('campaign-builder');
  }
  function onClick(e) {
    var b = e.target.closest('button, a'); if (!b) return;
    if (b.hasAttribute('data-aub-suggest')) { suggest(); return; }
    if (b.hasAttribute('data-aub-new')) { S.editing = 'new'; S.draft = {}; render(); return; }
    if (b.hasAttribute('data-aub-cancel')) { S.editing = null; render(); return; }
    if (b.hasAttribute('data-aub-edit')) { S.editing = b.getAttribute('data-aub-edit'); render(); return; }
    if (b.hasAttribute('data-aub-save')) { save(S.sugg[parseInt(b.getAttribute('data-aub-save'), 10)]); return; }
    if (b.hasAttribute('data-aub-use')) { use(b.getAttribute('data-aub-use')); return; }
    if (b.hasAttribute('data-aub-del')) {
      if (!window.confirm('Delete this audience?')) return;
      api('/api/audiences/' + encodeURIComponent(b.getAttribute('data-aub-del')), 'DELETE').then(function (r) { if (!r.ok) { S.msg = esc(K.refused(r)); render(); return; } load(); });
      return;
    }
    if (b.hasAttribute('data-aub-page')) { e.preventDefault(); if (window.orvPages) window.orvPages.open(b.getAttribute('data-aub-page')); return; }
  }
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('[data-aub-form]'); if (!f) return;
    e.preventDefault();
    var key = f.getAttribute('data-aub-form');
    if (key === 'new') { save(readForm(f, {})); return; }
    if (key.charAt(0) === 's' && !(S.saved || []).some(function (x) { return x.id === key; })) { var i = parseInt(key.slice(1), 10); var seg = readForm(f, S.sugg[i]); S.sugg[i] = seg; save(seg); return; }
    var a = (S.saved || []).filter(function (x) { return x.id === key; })[0];
    save(readForm(f, a ? fromSaved(a) : {}), key);
  });
  window.orvAudienceBuilder = { open: open, reload: load };
})();
