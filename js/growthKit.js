/* ════════════════════════════════════════════════════════════════
   OrivenAI — shared helpers for the pages Competitor Analysis (Research),
   Creative Testing (Create), Audience Builder (Launch) and Campaign
   Comparison (Campaigns). Each page is its own .page inside .mc, built on
   the Research components (css/research.css: .rx-wrap, .rx-card, .rx-btn,
   .rx-ev …) plus css/growth-pages.css (prefix gx-).
   window.orvGrowthKit
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // { ok, status, data } — never throws (a network failure is status 0).
  function api(path, method, body) {
    if (typeof apiFetch !== 'function') return Promise.resolve({ ok: false, status: 0, data: null });
    var opts = method ? { method: method } : undefined;
    if (method && body !== undefined) opts.body = JSON.stringify(body);
    return apiFetch(path, opts).then(function (r) { return r || { ok: false, status: 0, data: null }; }, function () { return { ok: false, status: 0, data: null }; });
  }
  // The page element (created once) with a root inside; returns the root.
  function mount(pageId, rootId, onClick) {
    var pg = document.getElementById(pageId);
    if (!pg) {
      var mc = document.querySelector('.mc'); if (!mc) return null;
      pg = document.createElement('div'); pg.className = 'page'; pg.id = pageId;
      pg.innerHTML = '<div class="rx-wrap gx" id="' + rootId + '" aria-live="polite"></div>';
      mc.appendChild(pg);
      if (onClick) pg.addEventListener('click', onClick);
    }
    return document.getElementById(rootId);
  }
  function show(navKey, pageId) {
    if (typeof window._orvNav === 'function') window._orvNav(navKey, pageId);
    else { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); var el = document.getElementById(pageId); if (el) el.classList.add('active'); }
    if (window.orvAppNav && window.orvAppNav.sync) window.orvAppNav.sync();
    var mc = document.querySelector('.mc'); if (mc) mc.scrollTop = 0;
  }
  function uid() { try { return (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.id) || null; } catch (_) { return null; } }
  function head(eyebrow, title, lead, extra) {
    return '<header class="rx-head gx-head"><div><p class="rx-eyebrow">' + esc(eyebrow) + '</p><h1 class="rx-title">' + esc(title) + '</h1>' + (lead ? '<p class="rx-lead">' + esc(lead) + '</p>' : '') + '</div>' + (extra || '') + '</header>';
  }
  // Where a finding comes from (Research basis), in the user's words.
  var BASIS = {
    source_checked: ['Verified', 'Quoted word for word from a page OrivenAI read'],
    source_cited: ['Public source', 'From a public source; the exact wording couldn’t be checked'],
    analysis: ['AI analysis', 'OrivenAI’s interpretation — not confirmed by a source'],
    idea: ['AI suggestion', 'An idea to test in your ads, not a fact'],
    user: ['Added by you', 'Information you entered'],
  };
  function basis(kind) { var b = BASIS[kind] || BASIS.analysis; return '<span class="rx-ev rx-ev-' + esc(kind || 'analysis') + ' gx-basis gx-basis--' + esc(kind || 'analysis') + '" title="' + esc(b[1]) + '"><i aria-hidden="true">●</i> ' + esc(b[0]) + '</span>'; }
  function legend() {
    return '<p class="gx-legend">' + ['source_checked', 'source_cited', 'analysis', 'idea'].map(function (k) { return basis(k) + ' <span class="rx-muted">' + esc(BASIS[k][1]) + '</span>'; }).join('<br>') + '</p>';
  }
  // A paid action the server refused: the plans for 402/403, else a message.
  function refused(r, action) {
    var d = (r && r.data) || {};
    if (r && (r.status === 402 || (r.status === 403 && d.code === 'SUBSCRIPTION_REQUIRED'))) {
      if (typeof window.orvOpenActionPaywall === 'function') window.orvOpenActionPaywall(action || 'create', { status: r.status, code: d.code, balance: d.balance });
      return r.status === 402 ? 'You don’t have enough credits for this. Nothing was charged.' : 'This needs an active OrivenAI plan.';
    }
    if (!r || r.status === 0) return 'We couldn’t reach OrivenAI. Check your connection and try again.';
    return d.error || 'Something went wrong. Please try again.';
  }
  function cost(key, fallback) { try { return (typeof CREDIT_COSTS !== 'undefined' && CREDIT_COSTS[key]) || fallback; } catch (_) { return fallback; } }
  function day(iso) { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return ''; } }
  window.orvGrowthKit = { esc: esc, api: api, mount: mount, show: show, uid: uid, head: head, basis: basis, legend: legend, refused: refused, cost: cost, day: day, BASIS: BASIS };
})();
