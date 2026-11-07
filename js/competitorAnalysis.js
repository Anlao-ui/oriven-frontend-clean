/* ════════════════════════════════════════════════════════════════
   Research → Competitor Analysis (#page-competitor-analysis)

   Your competitors (the business's list: /api/business/competitors, the
   same one Control Center shows) and analyses of them, written by the
   Research job (type "competitor": web search + the competitors' own
   websites, quote-checked). Every finding says where it comes from
   (Verified · Public source · AI analysis · AI suggestion) — OrivenAI has
   no access to anyone's private ad data and never claims to.
   window.orvCompetitors.open()
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit; if (!K) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-competitor-analysis', ROOT = 'cpaRoot';
  var MAX_SITES = 3; // websites attached to one analysis (the Research job's limit)
  var S = { uid: null, comps: null, reports: null, sel: {}, err: null, msg: null, running: null, open: null, report: null, editing: null, poll: 0 };

  function open() {
    if (!K.mount(PAGE, ROOT, onClick)) return;
    if (K.uid() !== S.uid) { S = { uid: K.uid(), comps: null, reports: null, sel: {}, err: null, msg: null, running: null, open: null, report: null, editing: null, poll: 0 }; }
    K.show('competitors', PAGE);
    render(); load();
  }
  function load() {
    Promise.all([api('/api/business/competitors'), api('/api/research/reports')]).then(function (rs) {
      S.comps = rs[0].ok && rs[0].data ? rs[0].data.items || [] : [];
      S.reports = rs[1].ok && rs[1].data ? (rs[1].data.reports || []).filter(function (r) { return r.type === 'competitor'; }) : [];
      S.err = !rs[0].ok ? K.refused(rs[0]) : null;
      var run = S.reports.filter(function (r) { return r.status === 'running'; })[0];
      if (run && !S.running) { S.running = { id: run.id, stage: run.stage }; poll(); }
      render();
    });
  }
  function root() { return document.getElementById(ROOT); }

  // ── Rendering ─────────────────────────────────────────────────────
  function render() {
    var el = root(); if (!el) return;
    if (S.open) { el.innerHTML = reportView(); return; }
    var c = S.comps;
    el.innerHTML = K.head('Research', 'Competitor Analysis', 'See how your competitors position themselves and advertise, and where your ads can stand out. OrivenAI reads their public websites and public sources — it has no access to anyone’s private advertising data.')
      + (S.err ? '<p class="rx-err" role="alert">' + esc(S.err) + '</p>' : '')
      + '<div class="gx-cols">'
      + '<section class="rx-card gx-card" aria-labelledby="cpaListH"><div class="gx-card__h"><h2 class="rx-h2" id="cpaListH">Your competitors</h2>' + (c ? '<span class="rx-muted">' + c.length + '</span>' : '') + '</div>'
      + (c === null ? '<p class="rx-muted gx-loading">Loading…</p>' : c.length ? '<ul class="gx-list">' + c.map(compRow).join('') + '</ul>' : '<p class="rx-muted">No competitors yet. Add the businesses you compete with — their website lets OrivenAI read what they say publicly.</p>')
      + addForm() + '</section>'
      + '<section class="rx-card gx-card" aria-labelledby="cpaRunH"><h2 class="rx-h2" id="cpaRunH">Analyse</h2>' + runBox() + '</section>'
      + '</div>'
      + '<section class="gx-sec" aria-labelledby="cpaSavedH"><h2 class="rx-h2" id="cpaSavedH">Saved analyses</h2>' + savedList() + '</section>';
  }
  function compRow(x) {
    var on = !!S.sel[x.id];
    if (S.editing === x.id) return '<li class="gx-item">' + compForm(x) + '</li>';
    return '<li class="gx-item' + (on ? ' is-on' : '') + '"><label class="gx-check"><input type="checkbox" data-cpa-sel="' + esc(x.id) + '"' + (on ? ' checked' : '') + (x.website ? '' : ' disabled') + '> <span class="gx-item__t">' + esc(x.company || 'Unnamed') + '</span></label>'
      + (x.website ? '<a class="rx-link gx-item__m" href="' + esc(x.website) + '" target="_blank" rel="noopener noreferrer">' + esc(String(x.website).replace(/^https?:\/\//, '')) + '</a>' : '<span class="rx-muted gx-item__m">No website — add one to include it in an analysis</span>')
      + (x.positioning ? '<p class="gx-item__d">' + esc(x.positioning) + '</p>' : '')
      + '<div class="gx-item__a"><button type="button" class="rx-btn rx-btn-ghost" data-cpa-edit="' + esc(x.id) + '">Edit</button><button type="button" class="rx-btn rx-btn-ghost" data-cpa-del="' + esc(x.id) + '">Remove</button></div></li>';
  }
  function compForm(x) {
    x = x || {};
    return '<form class="gx-form" data-cpa-form="' + esc(x.id || '') + '"><label class="rx-lbl">Company<input class="rx-input" name="company" required maxlength="120" value="' + esc(x.company || '') + '"></label>'
      + '<label class="rx-lbl">Website<input class="rx-input" name="website" type="text" inputmode="url" autocomplete="url" placeholder="yourcompetitor.com" maxlength="200" value="' + esc(x.website || '') + '"></label>'
      + '<label class="rx-lbl">What you know about them <span class="rx-muted">(optional)</span><input class="rx-input" name="positioning" maxlength="300" value="' + esc(x.positioning || '') + '"></label>'
      + '<div class="gx-row"><button type="submit" class="rx-btn rx-btn-primary">' + (x.id ? 'Save' : 'Add competitor') + '</button>' + (x.id ? '<button type="button" class="rx-btn rx-btn-ghost" data-cpa-cancel>Cancel</button>' : '') + '</div></form>';
  }
  function addForm() { return S.editing === 'new' ? compForm(null) : '<button type="button" class="rx-btn" data-cpa-new>Add a competitor</button>'; }
  function runBox() {
    if (S.running) {
      return '<div class="gx-running" role="status"><span class="gx-spin" aria-hidden="true"></span><div><b>Analysing…</b><p class="rx-muted">' + esc(stageText(S.running.stage)) + ' You can leave this page; the analysis is saved when it’s ready.</p></div></div>';
    }
    var picked = (S.comps || []).filter(function (x) { return S.sel[x.id]; });
    return '<p class="rx-muted">' + (picked.length ? 'OrivenAI reads the websites of the competitors you selected (' + picked.map(function (x) { return esc(x.company); }).join(', ') + ') and public sources about them.' : 'Select up to ' + MAX_SITES + ' competitors with a website, or analyse your market’s competitors from public sources.') + '</p>'
      + '<label class="rx-lbl">What do you want to know? <span class="rx-muted">(optional)</span><input class="rx-input" id="cpaFocus" maxlength="300" placeholder="e.g. how they advertise their workshops"></label>'
      + (S.msg ? '<p class="rx-err" role="alert">' + esc(S.msg) + '</p>' : '')
      + '<div class="gx-row"><button type="button" class="rx-btn rx-btn-primary" data-cpa-run>' + (picked.length ? 'Analyse ' + picked.length + ' competitor' + (picked.length === 1 ? '' : 's') : 'Analyse my competitors') + '</button><span class="rx-cost">' + K.cost('research', 90) + ' credits</span></div>';
  }
  function stageText(st) { return ({ preparing: 'Preparing the research.', searching: 'Searching public sources.', reading: 'Reading their websites.', writing: 'Writing the analysis.' })[st] || 'Working on it.'; }
  function savedList() {
    var r = S.reports;
    if (r === null) return '<p class="rx-muted gx-loading">Loading…</p>';
    var ready = r.filter(function (x) { return x.status !== 'running'; });
    if (!ready.length) return '<p class="rx-muted">Your competitor analyses appear here.</p>';
    return '<ul class="gx-saved">' + ready.map(function (x) {
      return '<li><button type="button" class="gx-saved__i" data-cpa-open="' + esc(x.id) + '"' + (x.status === 'failed' ? ' disabled' : '') + '><b>' + esc(x.title || x.question) + '</b><span class="rx-muted">' + esc(K.day(x.createdAt)) + (x.status === 'failed' ? ' · couldn’t be completed' : x.sourceCount ? ' · ' + x.sourceCount + ' source' + (x.sourceCount === 1 ? '' : 's') + ' read' : '') + '</span></button></li>';
    }).join('') + '</ul>';
  }

  // ── A report ──────────────────────────────────────────────────────
  function srcLinks(item, sources) {
    var by = {}; (sources || []).forEach(function (s) { by[s.id] = s; });
    var ids = (item.sourceIds || []).filter(function (id) { return by[id] && by[id].url; });
    if (!ids.length) return '';
    return '<span class="rx-ev-src">' + ids.map(function (id) { return '<a href="' + esc(by[id].url) + '" target="_blank" rel="noopener noreferrer">' + esc(by[id].domain || by[id].title) + '</a>'; }).join(', ') + '</span>';
  }
  function quote(item) { var q = (item.quotes || [])[0]; return q ? '<blockquote class="rx-quote gx-quote">“' + esc(q.quote) + '”</blockquote>' : ''; }
  function reportView() {
    var R = S.report;
    var back = '<button type="button" class="rx-back" data-cpa-back>← Competitor Analysis</button>';
    if (!R) return back + '<p class="rx-muted gx-loading">Loading…</p>';
    var src = R.sources || [];
    var known = (S.comps || []).map(function (c) { return String(c.company || '').toLowerCase(); });
    var comps = (R.competitors || []).map(function (c) {
      var mine = known.indexOf(String(c.name || '').toLowerCase()) !== -1;
      var dl = [['Offers', c.offering], ['Positioning', c.positioning], ['Value proposition', c.valueProposition], ['Pricing', c.pricing], ['Messaging', c.messaging], ['Stands apart by', c.differentiation]].filter(function (p) { return p[1]; });
      return '<article class="rx-card gx-comp"><div class="gx-comp__h"><h3 class="rx-h3">' + esc(c.name) + '</h3>' + K.basis(c.basis) + '</div>'
        + (c.website ? '<a class="rx-link" href="' + esc(c.website) + '" target="_blank" rel="noopener noreferrer">' + esc(c.website.replace(/^https?:\/\//, '')) + '</a>' : '')
        + (dl.length ? '<dl class="rx-dl gx-dl">' + dl.map(function (p) { return '<div><dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd></div>'; }).join('') + '</dl>' : '')
        + ((c.adPatterns || []).length ? '<p class="gx-sub">Publicly visible advertising</p><ul class="rx-bul">' + c.adPatterns.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '')
        + quote(c) + srcLinks(c, src)
        + (mine ? '<p class="rx-muted gx-note">In your competitor list</p>' : '<button type="button" class="rx-btn rx-btn-ghost" data-cpa-keep="' + esc(c.id) + '">Add to my competitors</button>')
        + '</article>';
    }).join('');
    var items = function (list, title, text, sub) {
      if (!(list || []).length) return '';
      return '<section class="gx-sec"><h2 class="rx-h2">' + esc(title) + '</h2><div class="gx-grid">' + list.map(function (x) {
        return '<article class="rx-card gx-mini"><div class="gx-comp__h"><h3 class="rx-h3">' + esc(text(x)) + '</h3>' + K.basis(x.basis || 'idea') + '</div>' + (sub(x) ? '<p class="rx-muted">' + esc(sub(x)) + '</p>' : '') + quote(x) + srcLinks(x, src) + '</article>';
      }).join('') + '</div></section>';
    };
    return back + K.head('Competitor analysis', R.title || 'Competitor analysis', R.summary || '', '<a class="rx-link" href="#" data-cpa-research>Open in Research</a>')
      + K.legend()
      + ((R.keyConclusions || []).length ? '<section class="gx-sec"><h2 class="rx-h2">Key findings</h2><ul class="gx-findings">' + R.keyConclusions.map(function (k) { return '<li>' + K.basis(k.basis) + ' <b>' + esc(k.text) + '</b>' + (k.why ? ' <span class="rx-muted">' + esc(k.why) + '</span>' : '') + srcLinks(k, src) + '</li>'; }).join('') + '</ul></section>' : '')
      + (comps ? '<section class="gx-sec"><h2 class="rx-h2">Competitors</h2><div class="gx-grid">' + comps + '</div></section>' : '<p class="rx-muted">No competitor could be confirmed from the sources found.</p>')
      + items(R.adPatterns, 'Advertising patterns', function (x) { return x.pattern; }, function (x) { return x.description; })
      + items(R.opportunities, 'Opportunities for your ads', function (x) { return x.title; }, function (x) { return [x.angle && ('Angle: ' + x.angle), x.test && ('Test: ' + x.test)].filter(Boolean).join(' · '); })
      + items(R.angles, 'Angles to try', function (x) { return x.angle; }, function (x) { return x.message; })
      + ((R.limitations || []).length ? '<section class="gx-sec"><h2 class="rx-h2">What couldn’t be established</h2><ul class="rx-bul">' + R.limitations.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></section>' : '')
      + (src.length ? '<section class="gx-sec"><h2 class="rx-h2">Sources</h2><ul class="gx-sources">' + src.map(function (s) { return '<li><a class="rx-link" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title || s.domain) + '</a> <span class="rx-muted">' + esc(s.domain || '') + (s.fetched ? ' · read by OrivenAI' : ' · search result') + '</span></li>'; }).join('') + '</ul></section>' : '')
      + '<section class="rx-card gx-next"><h2 class="rx-h2">Use it in your ads</h2><p class="rx-muted">Turn what stands out into audiences and creatives.</p><div class="gx-row"><button type="button" class="rx-btn" data-cpa-page="audience-builder">Open Audience Builder</button><button type="button" class="rx-btn" data-cpa-page="creative-testing">Open Creative Testing</button></div></section>';
  }

  // ── Actions ───────────────────────────────────────────────────────
  function run(btn) {
    var picked = (S.comps || []).filter(function (x) { return S.sel[x.id] && x.website; }).slice(0, MAX_SITES);
    var focus = (document.getElementById('cpaFocus') || {}).value || '';
    var names = picked.map(function (x) { return x.company; });
    var q = (names.length ? 'How do ' + names.join(', ') + ' position themselves and advertise, compared with my business' : 'Who are my main competitors and how do they position themselves and advertise') + (focus.trim() ? ' — ' + focus.trim() : '') + '?';
    btn.disabled = true; S.msg = null;
    api('/api/research/query', 'POST', { type: 'competitor', question: q.slice(0, 500), urls: picked.map(function (x) { return x.website; }) }).then(function (r) {
      btn.disabled = false;
      if (r.status === 202 && r.data && r.data.reportId) { S.running = { id: r.data.reportId, stage: 'preparing' }; render(); poll(); return; }
      if (r.status === 409 && r.data && r.data.reportId) { S.running = { id: r.data.reportId, stage: 'preparing' }; render(); poll(); return; }
      S.msg = K.refused(r, 'research'); render();
    });
  }
  function poll() {
    clearTimeout(S.poll);
    if (!S.running) return;
    S.poll = setTimeout(function () {
      var id = S.running && S.running.id; if (!id) return;
      api('/api/research/reports/' + encodeURIComponent(id)).then(function (r) {
        if (!S.running || S.running.id !== id) return;
        var sm = r.data && r.data.summary;
        if (r.ok && sm && sm.status === 'running') { S.running.stage = sm.stage; if (document.getElementById(PAGE) && document.getElementById(PAGE).classList.contains('active')) render(); poll(); return; }
        S.running = null;
        if (r.ok && r.data && r.data.report) { S.open = id; S.report = r.data.report; }
        else if (sm && sm.status === 'failed') S.msg = sm.error || 'The analysis couldn’t be completed. Any credits were returned.';
        load();
      });
    }, 4000);
  }
  function openReport(id) {
    S.open = id; S.report = null; render();
    api('/api/research/reports/' + encodeURIComponent(id)).then(function (r) {
      if (S.open !== id) return;
      if (r.ok && r.data && r.data.report) { S.report = r.data.report; render(); }
      else { S.open = null; S.msg = K.refused(r); render(); }
    });
  }
  function save(form) {
    var id = form.getAttribute('data-cpa-form');
    var body = { company: form.company.value.trim(), website: form.website.value.trim() || null, positioning: form.positioning.value.trim() || null };
    if (!body.company) return;
    if (body.website && !/^https?:\/\//i.test(body.website)) body.website = 'https://' + body.website;
    api(id ? '/api/business/competitors/' + encodeURIComponent(id) : '/api/business/competitors', id ? 'PUT' : 'POST', body).then(function (r) {
      if (!r.ok) { S.err = K.refused(r); render(); return; }
      S.editing = null; S.err = null; load();
    });
  }
  function keep(cid) {
    var c = ((S.report && S.report.competitors) || []).filter(function (x) { return x.id === cid; })[0]; if (!c) return;
    api('/api/business/competitors', 'POST', { company: c.name, website: c.website || null, positioning: c.positioning || null, messaging: c.messaging || null, pricing: c.pricing || null, products: c.offering || null }).then(function (r) {
      if (!r.ok) { if (typeof window.orvToast === 'function') window.orvToast(K.refused(r), 'warn'); return; }
      if (typeof window.orvToast === 'function') window.orvToast(c.name + ' added to your competitors', 'ok');
      api('/api/business/competitors').then(function (x) { if (x.ok && x.data) S.comps = x.data.items || []; render(); });
    });
  }
  function onClick(e) {
    var t = e.target;
    var b = t.closest('button, a, input[data-cpa-sel]'); if (!b) return;
    if (b.matches('[data-cpa-sel]')) {
      var id = b.getAttribute('data-cpa-sel');
      var count = Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).length;
      if (b.checked && count >= MAX_SITES) { b.checked = false; S.msg = 'Select up to ' + MAX_SITES + ' competitors for one analysis.'; render(); return; }
      S.sel[id] = b.checked; S.msg = null; render(); return;
    }
    if (b.hasAttribute('data-cpa-new')) { S.editing = 'new'; render(); return; }
    if (b.hasAttribute('data-cpa-cancel')) { S.editing = null; render(); return; }
    if (b.hasAttribute('data-cpa-edit')) { S.editing = b.getAttribute('data-cpa-edit'); render(); return; }
    if (b.hasAttribute('data-cpa-del')) {
      var did = b.getAttribute('data-cpa-del');
      api('/api/business/competitors/' + encodeURIComponent(did), 'DELETE').then(function (r) { if (!r.ok) { S.err = K.refused(r); render(); return; } delete S.sel[did]; load(); });
      return;
    }
    if (b.hasAttribute('data-cpa-run')) { run(b); return; }
    if (b.hasAttribute('data-cpa-open')) { openReport(b.getAttribute('data-cpa-open')); return; }
    if (b.hasAttribute('data-cpa-back')) { S.open = null; S.report = null; render(); return; }
    if (b.hasAttribute('data-cpa-keep')) { keep(b.getAttribute('data-cpa-keep')); return; }
    if (b.hasAttribute('data-cpa-page')) { if (window.orvPages) window.orvPages.open(b.getAttribute('data-cpa-page')); return; }
    if (b.hasAttribute('data-cpa-research')) { e.preventDefault(); if (window.orvPages) window.orvPages.open('research'); return; }
  }
  document.addEventListener('submit', function (e) { var f = e.target.closest && e.target.closest('[data-cpa-form]'); if (f) { e.preventDefault(); save(f); } });

  window.orvCompetitors = { open: open, reload: load };
})();
