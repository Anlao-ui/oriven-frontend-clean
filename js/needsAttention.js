/* ════════════════════════════════════════════════════════════════
   Overview → Needs Attention (#page-needs-attention) and the shared
   attention collector the Dashboard uses (window.orvAttention).

   Only real signals, each from its own source:
     • the workspace and ad signals the Dashboard already computes
       (#owNeeds rows: tracking, campaigns ready or blocked, …);
     • the connection state of each ad platform (orvAnalytics.connections);
     • automations waiting for approval and runs that failed this week
       (/api/automations/overview);
     • performance changes, calculated from the figures each platform
       reports: this week against the week before (no AI, no estimates).
   Nothing here is invented: with no signals the cards say so.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PAGE = 'page-needs-attention', ROOT = 'ndaRoot';
  var CATS = [
    ['accounts', 'Accounts & connections', 'Ad accounts OrivenAI works with'],
    ['tracking', 'Tracking & conversions', 'Pixels, tags and conversion actions'],
    ['performance', 'Performance', 'This week against the week before'],
    ['campaigns', 'Campaigns', 'Drafts, launches and campaign changes'],
    ['automations', 'Automations', 'Approvals and failed runs'],
  ];
  var cache = null, cacheAt = 0, S = { items: null, checkedAt: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path) { return typeof window.apiFetch === 'function' ? window.apiFetch(path).catch(function () { return { ok: false }; }) : Promise.resolve({ ok: false }); }
  function go(id) { if (window.orvAppNav) window.orvAppNav.go(id); }

  // ── Collectors ─────────────────────────────────────────────────
  function fromWorkspace() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#owNeeds [data-rank]'));
    return rows.map(function (r) {
      var t = r.querySelector('.ccx-ntitle'), sub = r.querySelector('.ccx-nsub'), act = r.querySelector('.ccx-nact');
      var title = t ? t.textContent.replace(/^(Needs attention|Problem|Ready|Attention):\s*/i, '').trim() : r.textContent.trim();
      var where = sub ? sub.textContent.trim() : '';
      var rank = +r.getAttribute('data-rank');
      var cat = /launch|campaign/i.test(where + title) ? 'campaigns' : /tracking|pixel|conversion|advertising/i.test(where + title) ? 'tracking' : /autopilot|automation/i.test(where + title) ? 'automations' : /connect|account/i.test(where + title) ? 'accounts' : 'campaigns';
      return { sev: rank === 0 ? 'problem' : rank === 1 ? 'warning' : 'ready', cat: cat, title: title, why: where, action: act ? act.textContent.replace(/→/g, '').trim() : 'Open', run: function () { r.click(); } };
    });
  }
  function fromConnections() {
    var A = window.orvAnalytics; if (!A) return Promise.resolve([]);
    return A.connections().then(function (c) {
      var out = [], any = false;
      A.PLATFORMS.forEach(function (p) {
        var x = c[p] || {};
        if (x.conn === 'connected') any = true;
        if (x.conn === 'expired') out.push({ sev: 'problem', cat: 'accounts', title: A.NAME[p] + ' needs to be reconnected', why: 'The connection expired. Campaigns keep running on ' + A.SHORT[p] + ', but OrivenAI can’t read or change them until you reconnect.', action: 'Reconnect', run: function () { if (window.orvPages) window.orvPages.open('ad-platforms'); } });
        else if (x.conn === 'error' || x.conn === 'unavailable') out.push({ sev: 'warning', cat: 'accounts', title: A.NAME[p] + ' couldn’t be checked', why: 'OrivenAI didn’t get an answer from ' + A.SHORT[p] + ' just now. This is often temporary.', action: 'Open Ad Platforms', run: function () { if (window.orvPages) window.orvPages.open('ad-platforms'); } });
      });
      if (!any && !out.length) out.push({ sev: 'warning', cat: 'accounts', title: 'No ad account connected', why: 'Connect Google, Meta, TikTok, Pinterest or Snapchat Ads so OrivenAI can show results and warn you about problems.', action: 'Connect a platform', run: function () { if (window.orvPages) window.orvPages.open('ad-platforms'); } });
      return out;
    }, function () { return []; });
  }
  function fromAutomations() {
    return api('/api/automations/overview').then(function (r) {
      var c = (r && r.ok && r.data && r.data.counts) || null; if (!c) return [];
      var out = [], ap = (c.pendingApprovals || 0) + (c.needsReview || 0);
      if (ap) out.push({ sev: 'warning', cat: 'automations', title: ap === 1 ? '1 automation is waiting for your approval' : ap + ' automations are waiting for your approval', why: 'Nothing changes until you approve or reject it.', action: 'Review', run: function () { go('auto-overview'); } });
      if (c.failed7d) out.push({ sev: 'problem', cat: 'automations', title: c.failed7d === 1 ? '1 automation run failed this week' : c.failed7d + ' automation runs failed this week', why: 'The reason is in Automation History.', action: 'Open history', run: function () { go('auto-activity'); } });
      return out;
    });
  }
  function fromPerformance() {
    var A = window.orvAnalytics; if (!A) return Promise.resolve([]);
    var w = { since: A.addDays(A.today(), -6), until: A.today() };
    return A.connections().then(function (c) {
      var plats = A.PLATFORMS.filter(function (p) { return c[p] && c[p].conn === 'connected'; });
      return Promise.all(plats.map(function (p) {
        return A.seriesWithPrevious(p, w).then(function (d) {
          if (!d.prev) return [];
          var cur = A.sum(d.cur, d.valueReported), prev = A.sum(d.prev, d.valueReported), out = [], cur$ = (c[p] && c[p].currency) || 'EUR';
          var m = function (v) { return A.fmt(v, 'm', cur$); };
          if (cur.spend > 0 && cur.conversions === 0 && prev.conversions > 0) out.push({ sev: 'problem', cat: 'performance', title: A.NAME[p] + ': no conversions in the last 7 days', why: m(cur.spend) + ' spent this week; ' + prev.conversions + ' conversions the week before.', action: 'Open Performance', run: function () { go('overview'); } });
          else {
            var cpa = A.value(cur, 'cpa'), cpaP = A.value(prev, 'cpa');
            if (cur.conversions >= 3 && prev.conversions >= 3 && cpa && cpaP && cpa >= cpaP * 1.3) out.push({ sev: 'warning', cat: 'performance', title: A.NAME[p] + ': cost per conversion up ' + Math.round((cpa / cpaP - 1) * 100) + '%', why: m(cpa) + ' this week against ' + m(cpaP) + ' the week before.', action: 'Open Performance', run: function () { go('overview'); } });
            if (prev.conversions >= 5 && cur.conversions <= prev.conversions * 0.6 && cur.spend >= prev.spend * 0.8) out.push({ sev: 'warning', cat: 'performance', title: A.NAME[p] + ': conversions down ' + Math.round((1 - cur.conversions / prev.conversions) * 100) + '%', why: cur.conversions + ' this week against ' + prev.conversions + ', on a similar spend.', action: 'Open Performance', run: function () { go('overview'); } });
          }
          var ctr = A.value(cur, 'ctr'), ctrP = A.value(prev, 'ctr');
          if (cur.impressions >= 1000 && prev.impressions >= 1000 && ctr != null && ctrP && ctr <= ctrP * 0.7) out.push({ sev: 'warning', cat: 'performance', title: A.NAME[p] + ': click-through rate down ' + Math.round((1 - ctr / ctrP) * 100) + '%', why: ctr.toFixed(2) + '% this week against ' + ctrP.toFixed(2) + '%. Fresh creatives often help.', action: 'Open Creative Testing', run: function () { go('testing'); } });
          return out;
        }, function () { return []; });
      })).then(function (lists) { return [].concat.apply([], lists); });
    }, function () { return []; });
  }
  function collect(force) {
    if (cache && !force && Date.now() - cacheAt < 60000) return cache;
    cacheAt = Date.now();
    cache = Promise.all([Promise.resolve(fromWorkspace()), fromConnections(), fromAutomations(), fromPerformance()]).then(function (lists) {
      var all = [].concat.apply([], lists), seen = {};
      all = all.filter(function (x) { var k = x.title; if (seen[k]) return false; seen[k] = 1; return true; });
      var rank = { problem: 0, warning: 1, ready: 2 };
      all.sort(function (a, b) { return rank[a.sev] - rank[b.sev]; });
      S.items = all; S.checkedAt = new Date();
      return all;
    });
    return cache;
  }

  // ── Page ───────────────────────────────────────────────────────
  function mount() {
    var pg = document.getElementById(PAGE);
    if (!pg) {
      var mc = document.querySelector('.mc'); if (!mc) return null;
      pg = document.createElement('div'); pg.className = 'page'; pg.id = PAGE;
      pg.innerHTML = '<div class="nda" id="' + ROOT + '"></div>';
      mc.appendChild(pg);
      pg.addEventListener('click', function (e) {
        var b = e.target.closest('[data-nda-i]'); if (b) { var it = (S.items || [])[+b.getAttribute('data-nda-i')]; if (it && it.run) it.run(); return; }
        if (e.target.closest('[data-nda-refresh]')) { if (window.orvAnalytics) window.orvAnalytics.reset(); collect(true).then(render); S.items = null; render(); }
      });
    }
    return pg;
  }
  function open() {
    var pg = mount(); if (!pg) return;
    if (typeof window._orvNav === 'function') window._orvNav('needsattention', PAGE);
    else { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); pg.classList.add('active'); }
    document.querySelectorAll('.page').forEach(function (p) { if (p !== pg) p.classList.remove('active'); }); pg.classList.add('active');
    render(); collect(true).then(render);
    if (window.orvAppNavSync) window.orvAppNavSync(); else if (window.orvAppNav) window.orvAppNav.sync();
  }
  function itemHtml(x, i) {
    return '<li class="nda-item is-' + x.sev + '"><i class="nda-dot" aria-hidden="true"></i><div class="nda-item__b"><b>' + esc(x.title) + '</b>' + (x.why ? '<span>' + esc(x.why) + '</span>' : '') + '</div>' +
      '<button type="button" class="nda-act" data-nda-i="' + i + '">' + esc(x.action || 'Open') + ' <span aria-hidden="true">→</span></button></li>';
  }
  function render() {
    var root = document.getElementById(ROOT); if (!root) return;
    var items = S.items, n = function (sev) { return (items || []).filter(function (x) { return x.sev === sev; }).length; };
    var head = '<header class="nda-head"><div><h1>Needs Attention</h1><p>Problems and warnings across your ad accounts, tracking, campaigns and automations — checked from real data, most urgent first.</p></div>' +
      '<button type="button" class="nda-refresh" data-nda-refresh>Check again</button></header>';
    var tiles = '<div class="nda-tiles">' +
      '<div class="nda-tile' + (items && n('problem') ? ' og-tone-warn' : '') + '"><span>Problems</span><b>' + (items ? n('problem') : '…') + '</b><small>act on these first</small></div>' +
      '<div class="nda-tile"><span>Warnings</span><b>' + (items ? n('warning') : '…') + '</b><small>worth a look this week</small></div>' +
      '<div class="nda-tile' + (items && n('ready') ? ' og-tone-fresh' : '') + '"><span>Ready for you</span><b>' + (items ? n('ready') : '…') + '</b><small>waiting for your go-ahead</small></div>' +
      '<div class="nda-tile"><span>Last checked</span><b class="nda-time">' + (S.checkedAt ? S.checkedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '…') + '</b><small>' + (items && !n('problem') && !n('warning') ? 'all clear' : 'from live data') + '</small></div></div>';
    var cards = CATS.map(function (c) {
      var list = (items || []).map(function (x, i) { return [x, i]; }).filter(function (p) { return p[0].cat === c[0]; });
      var worst = list.some(function (p) { return p[0].sev === 'problem'; }) ? 'problem' : list.some(function (p) { return p[0].sev === 'warning'; }) ? 'warning' : list.length ? 'ready' : 'ok';
      var body = items === null ? '<p class="nda-empty">Checking…</p>' : list.length ? '<ul class="nda-list">' + list.map(function (p) { return itemHtml(p[0], p[1]); }).join('') + '</ul>' : '<p class="nda-empty"><i aria-hidden="true">✓</i> Nothing needs your attention here.</p>';
      return '<section class="nda-card is-' + worst + '" aria-labelledby="ndaC_' + c[0] + '"><div class="nda-card__h"><h2 id="ndaC_' + c[0] + '">' + esc(c[1]) + '</h2><span class="nda-badge">' + (items === null ? '…' : list.length) + '</span></div><p class="nda-card__sub">' + esc(c[2]) + '</p>' + body + '</section>';
    }).join('');
    root.innerHTML = head + tiles + '<div class="nda-grid">' + cards + '<section class="nda-card nda-how"><div class="nda-card__h"><h2>How this is checked</h2></div><ul class="nda-howl"><li><b>Signals</b> come from your accounts, campaigns and automations as OrivenAI sees them now.</li><li><b>Performance</b> compares the last 7 days with the 7 days before, per platform, from the figures each platform reports. No AI, no estimates.</li><li><b>Nothing is changed</b> from this page: each item opens the place where you can act.</li></ul></section></div>';
  }

  window.orvAttention = { collect: collect, items: function () { return S.items; } };
  window.orvNeedsAttention = { open: open, render: render };
})();
