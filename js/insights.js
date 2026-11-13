/* ════════════════════════════════════════════════════════════════
   OrivenAI — Research → Insights (#page-insights)

   Research is where you investigate; Insights is where you review and use
   what was learned. Everything here comes from the account's own saved
   research (GET /api/research/insights: key conclusions, opportunities,
   recommended next actions and competitors named in more than one report,
   each linked to its report and the sources it cites). Nothing is
   generated, estimated or charged on this page; with no research yet it
   says how it fills up.

   Saved insights are the account's own list (preferences.savedInsights,
   PUT /api/user/preferences). Opening a report uses Research's report view
   (orvResearch.openFrom), whose back button returns here.
   Styling reuses Research (.rx-*) plus css/insights.css (ins-).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, opts) {
    if (typeof window.apiFetch !== 'function') return Promise.resolve({ ok: false, status: 0, data: null });
    return window.apiFetch(path, opts || {}).then(function (r) { return r || { ok: false, status: 0, data: null }; }, function () { return { ok: false, status: 0, data: null }; });
  }
  function R() { return window.orvResearch || null; }
  function T(k) { var r = R(); return r && r._T ? r._T(k) : k; }
  function typeLabel(t) { var r = R(); return (r && r.typeLabel && t && r.typeLabel(t)) || 'Research'; }
  function icon(t) { var r = R(); return r && r.dirIcon ? r.dirIcon(t || 'market') : ''; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : null; }
  // Dates follow the app language (as Research does), not the browser's.
  function lang() { var l = (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG) || 'en'; return l === 'nl' ? 'nl' : 'en'; }
  function day(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString(lang(), { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function month(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString(lang(), { month: 'long', year: 'numeric' }) : ''; }
  function toast(m, k) { if (typeof window.orvToast === 'function') window.orvToast(m, k || 'ok'); }

  var S = { data: null, err: false, tab: 'overview', q: '', type: 'all', saving: false, tok: 0, uid: null };

  function mount() {
    var mc = document.querySelector('.mc');
    if (!mc || document.getElementById('page-insights')) return;
    var pg = document.createElement('div');
    pg.className = 'page'; pg.id = 'page-insights';
    pg.innerHTML = '<div class="rx-wrap ins" id="insRoot" aria-live="polite"></div>';
    mc.appendChild(pg);
    pg.addEventListener('click', onClick);
    pg.addEventListener('input', function (e) { if (e.target.id === 'insSearch') { S.q = e.target.value; paintBody(); } });
  }

  function open() {
    mount();
    var uid = typeof _currentUser !== 'undefined' && _currentUser ? _currentUser.id : null;
    if (uid !== S.uid) { S.uid = uid; S.data = null; S.q = ''; S.type = 'all'; S.tab = 'overview'; }
    if (typeof window._orvNav === 'function') window._orvNav('insights', 'page-insights');
    else { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); document.getElementById('page-insights').classList.add('active'); }
    render(); load();
    if (window.orvAppNavSync) window.orvAppNavSync();
  }
  function load() {
    var t = ++S.tok;
    api('/api/research/insights').then(function (r) {
      if (t !== S.tok) return;
      if (r.ok && r.data) { S.data = r.data; S.err = false; } else { S.err = true; }
      render();
    });
  }

  // ── Filtering ───────────────────────────────────────────────────
  function match(x, fields) {
    if (S.type !== 'all' && x.type !== S.type) return false;
    var q = S.q.trim().toLowerCase(); if (!q) return true;
    return fields.some(function (f) { return String(x[f] || '').toLowerCase().indexOf(q) !== -1; });
  }
  function readyReports() { return ((S.data && S.data.reports) || []).filter(function (r) { return r.status === 'ready'; }); }
  function savedSet() { var o = {}; ((S.data && S.data.saved) || []).forEach(function (id) { o[id] = true; }); return o; }

  // ── Rendering ───────────────────────────────────────────────────
  function render() {
    var root = document.getElementById('insRoot'); if (!root) return;
    // The title card; the counts line (reports · findings · opportunities) sits inside it.
    var headWith = function (facts) { return '<header class="rx-head ins-head"><div><h1 class="rx-title">Insights</h1><p class="rx-sub">What your research has found, in one place — findings, opportunities and next actions, each linked to the report it came from.</p>' + (facts || '') + '</div>' +
      '<button type="button" class="rx-btn rx-btn-ghost" data-ins="new">New research</button></header>'; };
    var head = headWith('');
    if (!S.data && !S.err) { root.innerHTML = head + '<p class="rx-muted">Loading your insights…</p>'; return; }
    if (S.err && !S.data) { root.innerHTML = head + '<div class="rx-card ins-empty" data-state="error"><p>Your insights couldn’t load.</p><button type="button" class="rx-btn rx-btn-ghost" data-ins="retry">Try again</button></div>'; return; }
    var reps = readyReports(), all = S.data.reports || [];
    if (!reps.length) {
      var running = all.filter(function (r) { return r.status === 'running'; })[0];
      root.innerHTML = head + '<section class="rx-card ins-empty" data-state="empty"><div class="ins-empty__mark" aria-hidden="true">' + icon('opportunity') + '</div>' +
        '<h2 class="rx-h2">Nothing learned yet</h2><p>Insights fills up from the research you complete. Each report adds its key findings, opportunities and recommended next actions here, linked to the report and its sources. Nothing is added until research supports it.</p>' +
        (running ? '<p class="rx-hint">A research is running: “' + esc(running.title) + '”. Its findings appear here when it’s done.</p>' : '') +
        '<button type="button" class="rx-btn rx-btn-primary" data-ins="new">Start your first research</button></section>';
      return;
    }
    var d = S.data, saved = savedSet();
    var types = []; reps.forEach(function (r) { if (r.type && types.indexOf(r.type) === -1) types.push(r.type); });
    var counts = { overview: d.findings.length + d.opportunities.length + d.actions.length, library: all.length, saved: Object.keys(saved).length };
    root.innerHTML = headWith('<p class="ins-facts">' + esc(reps.length + ' report' + (reps.length === 1 ? '' : 's') + ' · ' + d.findings.length + ' key finding' + (d.findings.length === 1 ? '' : 's') + ' · ' + d.opportunities.length + ' opportunit' + (d.opportunities.length === 1 ? 'y' : 'ies')) + '</p>') +
      '<div class="ins-bar">' +
        '<div class="ins-tabs" role="tablist" aria-label="Insights views">' + [['overview', 'Overview'], ['library', 'Library'], ['saved', 'Saved']].map(function (t) {
          return '<button type="button" role="tab" class="ins-tab' + (S.tab === t[0] ? ' is-on' : '') + '" aria-selected="' + (S.tab === t[0]) + '" data-ins="tab" data-tab="' + t[0] + '">' + t[1] + '<span class="ins-n">' + counts[t[0]] + '</span></button>';
        }).join('') + '</div>' +
        '<div class="ins-filters"><label class="rx-sr" for="insSearch">Search insights</label><input id="insSearch" class="rx-input ins-search" type="search" placeholder="Search findings, opportunities and reports" value="' + esc(S.q) + '">' +
          '<div class="ins-chips" role="group" aria-label="Filter by research direction"><button type="button" class="ins-chip' + (S.type === 'all' ? ' is-on' : '') + '" aria-pressed="' + (S.type === 'all') + '" data-ins="type" data-type="all">All</button>' +
          types.map(function (t) { return '<button type="button" class="ins-chip' + (S.type === t ? ' is-on' : '') + '" aria-pressed="' + (S.type === t) + '" data-ins="type" data-type="' + esc(t) + '">' + esc(typeLabel(t)) + '</button>'; }).join('') + '</div></div>' +
      '</div>' +
      '<div class="ins-body" id="insBody" role="tabpanel"></div>';
    paintBody();
  }
  function paintBody() {
    var el = document.getElementById('insBody'); if (!el || !S.data) return;
    el.innerHTML = S.tab === 'library' ? libraryHtml() : S.tab === 'saved' ? savedHtml() : overviewHtml();
  }

  function evPill(basis) { return basis ? '<span class="rx-ev rx-ev-' + esc(basis) + '" title="' + esc(T('evTip.' + basis)) + '">' + esc(T('ev.' + basis)) + '</span>' : ''; }
  function sources(list) {
    var l = (list || []).filter(function (s) { return safeUrl(s.url); });
    return l.length ? '<p class="ins-src"><span>Sources:</span> ' + l.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.domain || s.title) + '</a>'; }).join(', ') + '</p>' : '';
  }
  function from(x) { return '<button type="button" class="ins-from" data-ins="open" data-id="' + esc(x.reportId) + '"><span class="ins-from__ic" aria-hidden="true">' + icon(x.type) + '</span>' + esc(x.reportTitle) + ' · ' + esc(day(x.createdAt)) + '</button>'; }
  function saveBtn(id, on) { return '<button type="button" class="ins-save' + (on ? ' is-on' : '') + '" aria-pressed="' + !!on + '" data-ins="save" data-id="' + esc(id) + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h8v11l-4-2.6-4 2.6z" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>' + (on ? 'Saved' : 'Save') + '</button>'; }
  function createBtn(id) { return '<button type="button" class="ins-act" data-ins="create" data-id="' + esc(id) + '">Create ads from this</button>'; }

  function findingCard(x, saved) {
    return '<article class="ins-card" data-kind="finding"><div class="ins-card__top">' + evPill(x.basis) + '</div><p class="ins-card__t">' + esc(x.text) + '</p>' + (x.why ? '<p class="ins-card__w">' + esc(x.why) + '</p>' : '') + sources(x.sources) +
      '<div class="ins-card__f">' + from(x) + '<span class="ins-card__acts">' + saveBtn(x.id, saved[x.id]) + createBtn(x.id) + '</span></div></article>';
  }
  function oppCard(x, saved) {
    return '<article class="ins-card" data-kind="opportunity"><div class="ins-card__top">' + evPill('idea') + (x.supportBasis && x.supportBasis !== 'idea' ? '<span class="ins-support">' + esc(T('supportedBy')) + ': ' + evPill(x.supportBasis) + '</span>' : '') + '</div>' +
      '<p class="ins-card__t">' + esc(x.title) + '</p>' + (x.why ? '<p class="ins-card__w">' + esc(x.why) + '</p>' : '') +
      ((x.angle || x.test || x.audience) ? '<dl class="ins-dl">' + (x.audience ? '<div><dt>Who</dt><dd>' + esc(x.audience) + '</dd></div>' : '') + (x.angle ? '<div><dt>Angle</dt><dd>' + esc(x.angle) + '</dd></div>' : '') + (x.test ? '<div><dt>Test</dt><dd>' + esc(x.test) + '</dd></div>' : '') + '</dl>' : '') +
      sources(x.sources) + '<div class="ins-card__f">' + from(x) + '<span class="ins-card__acts">' + saveBtn(x.id, saved[x.id]) + createBtn(x.id) + '</span></div></article>';
  }
  function actionRow(x, saved) {
    return '<li class="ins-action"><div class="ins-action__b"><p class="ins-card__t">' + esc(x.action) + '</p>' + (x.why ? '<p class="ins-card__w">' + esc(x.why) + '</p>' : '') + from(x) + '</div><span class="ins-card__acts">' + saveBtn(x.id, saved[x.id]) + createBtn(x.id) + '</span></li>';
  }
  function section(title, note, body, empty) {
    return '<section class="ins-sec"><div class="ins-sec__h"><h2 class="rx-h2">' + esc(title) + '</h2>' + (note ? '<p class="rx-note">' + esc(note) + '</p>' : '') + '</div>' + (body || '<p class="rx-muted ins-none">' + esc(empty) + '</p>') + '</section>';
  }
  function overviewHtml() {
    var d = S.data, saved = savedSet();
    var f = d.findings.filter(function (x) { return match(x, ['text', 'why', 'reportTitle']); });
    var o = d.opportunities.filter(function (x) { return match(x, ['title', 'why', 'angle', 'test', 'reportTitle']); });
    var a = d.actions.filter(function (x) { return match(x, ['action', 'why', 'reportTitle']); });
    var rc = (d.recurringCompetitors || []).filter(function (c) { return !S.q.trim() || String(c.name).toLowerCase().indexOf(S.q.trim().toLowerCase()) !== -1; });
    var none = S.q.trim() || S.type !== 'all' ? 'Nothing matches this filter.' : null;
    return section('Key findings', 'The main conclusions of each report, with how well they’re supported.', f.length ? '<div class="ins-grid">' + f.map(function (x) { return findingCard(x, saved); }).join('') + '</div>' : '', none || 'Your reports didn’t produce key conclusions yet.') +
      section('Opportunities', T('ideasNote'), o.length ? '<div class="ins-grid">' + o.map(function (x) { return oppCard(x, saved); }).join('') + '</div>' : '', none || 'No opportunities in your research yet — Opportunity, Market, Product and Trends research add them.') +
      section('Recommended next actions', T('nextNote'), a.length ? '<ul class="ins-actions">' + a.map(function (x) { return actionRow(x, saved); }).join('') + '</ul>' : '', none || 'Next actions appear for research completed from now on.') +
      (rc.length ? section('Named in more than one report', 'Competitors that came up repeatedly in your research.', '<ul class="ins-rec">' + rc.map(function (c) {
        return '<li><b>' + esc(c.name) + '</b>' + (safeUrl(c.website) ? ' <a href="' + esc(c.website) + '" target="_blank" rel="noopener noreferrer">' + esc(c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>' : '') +
          '<span class="ins-rec__in">In ' + c.reports.length + ' reports: ' + c.reports.map(function (r) { return '<button type="button" class="ins-link" data-ins="open" data-id="' + esc(r.reportId) + '">' + esc(r.reportTitle) + '</button>'; }).join(', ') + '</span></li>';
      }).join('') + '</ul>', '') : '');
  }
  function libraryHtml() {
    var list = (S.data.reports || []).filter(function (r) { return match(r, ['title', 'question']); });
    if (!list.length) return '<p class="rx-muted ins-none">' + (S.q || S.type !== 'all' ? 'No research matches this filter.' : 'No research yet.') + '</p>';
    var groups = [], by = {};
    // Newest first, so the months read in order.
    list = list.slice().sort(function (a, b) { return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0); });
    list.forEach(function (r) { var m = month(r.createdAt); if (!by[m]) { by[m] = []; groups.push(m); } by[m].push(r); });
    return groups.map(function (m) {
      return '<section class="ins-month"><h2 class="rx-lbl-sm">' + esc(m) + '</h2><ul class="ins-lib">' + by[m].map(function (r) {
        var st = r.status === 'running' ? '<span class="rx-st is-run">' + esc(T('stRunning')) + '</span>' : r.status === 'failed' ? '<span class="rx-st is-fail">' + esc(T('stFailed')) + '</span>' : '';
        var meta = [typeLabel(r.type), day(r.createdAt), r.status === 'ready' && r.sourceCount ? r.sourceCount + ' sources read' : null].filter(Boolean).join(' · ');
        return '<li><button type="button" class="ins-lib__i" data-ins="' + (r.status === 'ready' ? 'open' : r.status === 'running' ? 'progress' : 'noop') + '" data-id="' + esc(r.id) + '"' + (r.status === 'failed' ? ' disabled' : '') + '>' +
          '<span class="ins-lib__ic" aria-hidden="true">' + icon(r.type) + '</span><span class="ins-lib__b"><b>' + esc(r.title) + '</b><span>' + esc(meta) + '</span>' + (r.status === 'failed' && r.error ? '<span class="rx-lib-e">' + esc(r.error) + '</span>' : '') + '</span>' + st + '</button></li>';
      }).join('') + '</ul></section>';
    }).join('');
  }
  function savedHtml() {
    var d = S.data, saved = savedSet();
    var f = d.findings.filter(function (x) { return saved[x.id] && match(x, ['text', 'why', 'reportTitle']); });
    var o = d.opportunities.filter(function (x) { return saved[x.id] && match(x, ['title', 'why', 'angle', 'reportTitle']); });
    var a = d.actions.filter(function (x) { return saved[x.id] && match(x, ['action', 'why', 'reportTitle']); });
    if (!f.length && !o.length && !a.length) return '<div class="ins-none-box"><p class="rx-muted">Save findings, opportunities or next actions to keep them here.' + (Object.keys(saved).length ? ' (Saved items from reports you’ve removed aren’t shown.)' : '') + '</p></div>';
    return (f.length ? section('Findings', null, '<div class="ins-grid">' + f.map(function (x) { return findingCard(x, saved); }).join('') + '</div>') : '') +
      (o.length ? section('Opportunities', null, '<div class="ins-grid">' + o.map(function (x) { return oppCard(x, saved); }).join('') + '</div>') : '') +
      (a.length ? section('Next actions', null, '<ul class="ins-actions">' + a.map(function (x) { return actionRow(x, saved); }).join('') + '</ul>') : '');
  }

  // ── Actions ─────────────────────────────────────────────────────
  function item(id) {
    var d = S.data; if (!d) return null;
    var f = d.findings.filter(function (x) { return x.id === id; })[0]; if (f) return { group: 'Key finding', text: f.text, basis: f.basis, sources: f.sources, x: f };
    var o = d.opportunities.filter(function (x) { return x.id === id; })[0]; if (o) return { group: 'Opportunity', text: o.title + (o.angle ? ' — ' + o.angle : ''), basis: 'idea', sources: o.sources, x: o };
    var a = d.actions.filter(function (x) { return x.id === id; })[0]; if (a) return { group: 'Next action', text: a.action, basis: 'analysis', sources: [], x: a };
    return null;
  }
  function toggleSave(id, btn) {
    if (S.saving) return;
    var list = (S.data.saved || []).slice(), i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    S.saving = true; if (btn) btn.disabled = true;
    api('/api/user/preferences', { method: 'PUT', body: JSON.stringify({ savedInsights: list.slice(-200) }) }).then(function (r) {
      S.saving = false;
      if (!r.ok) { if (btn) btn.disabled = false; toast('Couldn’t save that. Please try again.', 'warn'); return; }
      S.data.saved = list; render();
      var again = document.querySelector('#insRoot [data-ins="save"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (again) again.focus({ preventScroll: true });
    });
  }
  function toCreate(id) {
    var it = item(id); if (!it) return;
    var h = { question: '', summary: '', title: it.x.reportTitle, researchType: it.x.type, reportId: it.x.reportId, findings: [{ id: id, group: it.group, text: it.text, basis: it.basis, sources: it.sources || [] }] };
    if (window.orvWorkspace && orvWorkspace.research && orvWorkspace.research.setHandoff) orvWorkspace.research.setHandoff(h);
    if (typeof window._orvNav === 'function') window._orvNav('create', 'page-create');
    setTimeout(function () { if (typeof window._cr2RenderStage === 'function') window._cr2RenderStage(); toast('Added to Create as research context — review it before building.'); }, 80);
  }
  function onClick(e) {
    var b = e.target.closest('[data-ins]'); if (!b) return;
    var a = b.getAttribute('data-ins'), id = b.getAttribute('data-id');
    if (a === 'tab') { S.tab = b.getAttribute('data-tab'); render(); var t = document.querySelector('#insRoot .ins-tab.is-on'); if (t) t.focus(); return; }
    if (a === 'type') { S.type = b.getAttribute('data-type'); render(); return; }
    if (a === 'open') { var r = R(); if (r && r.openFrom) r.openFrom(id, 'insights'); return; }
    if (a === 'progress') { if (typeof window._orvNav === 'function') window._orvNav('research', 'page-research'); return; }
    if (a === 'save') return toggleSave(id, b);
    if (a === 'create') return toCreate(id);
    if (a === 'retry') { S.err = false; render(); load(); return; }
    if (a === 'new') { if (window.orvAppNav) window.orvAppNav.go('research'); return; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.orvInsights = { open: open, reload: function () { S.data = null; load(); } };
})();
