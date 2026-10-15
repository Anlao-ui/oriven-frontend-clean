/* ════════════════════════════════════════════════════════════════
   OrivenAI — generation progress (window.OrivenProgress)

   One progress pattern for Create (image and video campaigns), the video
   creative cards and Research:
     • stages that correspond to real operations, driven by real events;
     • a status line, an indeterminate bar (never a percentage — no
       provider reports one) and elapsed time;
     • an estimate ONLY when this device has measured at least 3 real
       durations for the same kind of job (median, "usually about …");
       never a countdown or a promised completion time.
   Elapsed time is computed from a start timestamp, so it survives
   re-rendering, leaving the page and returning (video jobs store theirs).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var OP = window.OrivenProgress = window.OrivenProgress || {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  OP.esc = esc;

  // ── Elapsed time ────────────────────────────────────────────────
  function fmtElapsed(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h) return h + ':' + ('0' + (m % 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
    return m + ':' + ('0' + (s % 60)).slice(-2);
  }
  OP.fmtElapsed = fmtElapsed;
  // One ticker for every [data-op-since] element on the page; it stops
  // itself when none are left.
  var ticker = null;
  function tick() {
    var els = document.querySelectorAll('[data-op-since]');
    if (!els.length) { clearInterval(ticker); ticker = null; return; }
    var now = Date.now();
    for (var i = 0; i < els.length; i++) {
      var since = Number(els[i].getAttribute('data-op-since'));
      if (since) els[i].textContent = fmtElapsed(now - since);
    }
    if (OP._onTick) try { OP._onTick(now); } catch (_) {}
  }
  OP.startTicker = function () { if (!ticker) ticker = setInterval(tick, 1000); tick(); };
  OP.elapsedHtml = function (since) {
    return '<span class="op-elapsed" data-op-since="' + Number(since) + '" aria-label="Elapsed time">' + fmtElapsed(Date.now() - since) + '</span>';
  };

  // ── Measured durations (this device only) ───────────────────────
  var HKEY = 'orv.progress.durations.v1';
  function readH() { try { return JSON.parse(localStorage.getItem(HKEY) || '{}') || {}; } catch (_) { return {}; } }
  OP.record = function (kind, ms) {
    if (!kind || !(ms > 0) || ms > 6 * 3600e3) return;
    try {
      var h = readH(); var a = Array.isArray(h[kind]) ? h[kind] : [];
      a.push(Math.round(ms)); h[kind] = a.slice(-15);
      localStorage.setItem(HKEY, JSON.stringify(h));
    } catch (_) {}
  };
  // Median of ≥3 real measurements, or null.
  OP.estimateMs = function (kind) {
    var a = (readH()[kind] || []).filter(function (x) { return x > 0; }).slice().sort(function (x, y) { return x - y; });
    if (a.length < 3) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
  };
  OP.estimateText = function (kind) {
    var ms = OP.estimateMs(kind);
    if (!ms) return '';
    var s = ms / 1000;
    if (s < 50) return 'Usually about ' + Math.max(5, Math.round(s / 5) * 5) + ' sec';
    var m = Math.max(1, Math.round(s / 60));
    return 'Usually about ' + m + ' min';
  };

  // ── Stage list + status panel ───────────────────────────────────
  // opts: { title, chips:[...], stages:[{k,t}], kind, compact, status }
  OP.create = function (host, opts) {
    opts = opts || {};
    var since = opts.since || Date.now();
    var est = opts.kind ? OP.estimateText(opts.kind) : '';
    var root = document.createElement('section');
    root.className = 'op' + (opts.compact ? ' op-compact' : '');
    root.setAttribute('data-state', 'running');
    if (opts.title) root.setAttribute('aria-label', opts.title);
    root.innerHTML =
      (opts.compact ? '' :
        '<header class="op-head">' +
          (opts.chips && opts.chips.length ? '<div class="op-chips">' + opts.chips.filter(Boolean).map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
          '<h1 class="op-title">' + esc(opts.title || 'Working on it') + '</h1>' +
        '</header>') +
      '<div class="op-now">' +
        '<p class="op-status" role="status" aria-live="polite">' + esc(opts.status || (opts.stages && opts.stages[0] ? opts.stages[0].t : 'Working…')) + '</p>' +
        '<p class="op-meta">' + OP.elapsedHtml(since) + (est ? '<span class="op-est">' + esc(est) + '</span>' : '') + '</p>' +
      '</div>' +
      '<div class="op-bar" aria-hidden="true"><span></span></div>' +
      '<ol class="op-stages" aria-label="Progress">' + (opts.stages || []).map(function (s) {
        return '<li class="op-stage" data-k="' + esc(s.k) + '" data-s="pending"><span class="op-mark" aria-hidden="true"></span>' +
          '<span class="op-st"><span class="op-st-t">' + esc(s.t) + '</span><span class="op-st-note"></span></span>' +
          '<span class="op-sr"> — waiting</span></li>';
      }).join('') + '</ol>' +
      '<div class="op-foot"></div>';
    host.innerHTML = '';
    host.appendChild(root);
    OP.startTicker();
    var stages = opts.stages || [];
    var api = {
      root: root, since: since,
      q: function (sel) { return root.querySelector(sel); },
      stage: function (k, state, note) {
        var li = root.querySelector('.op-stage[data-k="' + k + '"]');
        if (!li) return api;
        li.setAttribute('data-s', state);
        var sr = li.querySelector('.op-sr');
        if (sr) sr.textContent = ' — ' + ({ pending: 'waiting', active: 'in progress', done: 'done', skipped: 'not needed', warn: 'finished with a warning', failed: 'failed', bg: 'continues after this screen' }[state] || state);
        var n = li.querySelector('.op-st-note'); if (n) n.textContent = note || '';
        if (state === 'active') { var def = stages.filter(function (s) { return s.k === k; })[0]; if (def) api.status(def.status || def.t); }
        return api;
      },
      status: function (text) { var el = root.querySelector('.op-status'); if (el && el.textContent !== text) el.textContent = text; return api; },
      notice: function (html, kind) {
        var f = root.querySelector('.op-foot');
        if (!f) return api;
        f.innerHTML = html ? '<p class="op-notice' + (kind ? ' op-notice-' + kind : '') + '">' + html + '</p>' : '';
        return api;
      },
      // Ends the running state: stops the elapsed clock at its final value.
      finish: function (state, title) {
        root.setAttribute('data-state', state || 'done');
        var el = root.querySelector('.op-elapsed');
        if (el) { el.textContent = fmtElapsed(Date.now() - since); el.removeAttribute('data-op-since'); }
        if (title) { var t = root.querySelector('.op-title'); if (t) t.textContent = title; }
        return Date.now() - since;
      },
      setTitle: function (t) { var el = root.querySelector('.op-title'); if (el) el.textContent = t; return api; }
    };
    return api;
  };
})();
