/* ════════════════════════════════════════════════════════════════
   Shared workspace UI behaviour (css/ow-system.css):

   • Drawers: <div class="ow-drawer" id="…" role="dialog" aria-modal="true">
     opened by any [data-ow-open="id"]; closed by Esc, the scrim, or any
     [data-ow-close] inside. Focus moves into the panel and back to the
     opener; Tab stays inside while it is open.
   • Videos: any [data-ow-video="/path.mp4"] (with data-ow-title,
     data-ow-poster, data-ow-captions) opens one shared player. Playback
     starts only from that click, with sound the user can control; nothing
     autoplays. Closing stops the video.
   No network requests of its own.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.owUI) return;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,video[controls],[tabindex]:not([tabindex="-1"])';
  var stack = [];

  function trap(e) {
    var top = stack[stack.length - 1]; if (!top) return;
    // Esc belongs to the top drawer only: stopped here (capture phase) so a
    // panel underneath (e.g. the assistant) doesn't close as well.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(top.el); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(top.el.querySelectorAll(FOCUSABLE), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function open(el, opener) {
    if (!el || el.classList.contains('is-open')) return;
    el.classList.add('is-open'); el.removeAttribute('hidden'); el.setAttribute('aria-hidden', 'false');
    stack.push({ el: el, opener: opener || document.activeElement });
    if (stack.length === 1) window.addEventListener('keydown', trap, true);
    var target = el.querySelector('[data-ow-autofocus]') || el.querySelector('.ow-drawer__close, .ow-player__close') || el.querySelector(FOCUSABLE);
    if (target) setTimeout(function () { target.focus(); }, 30);
    el.dispatchEvent(new CustomEvent('ow:open'));
  }
  function close(el) {
    if (!el || !el.classList.contains('is-open')) return;
    el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true');
    var i = stack.map(function (s) { return s.el; }).indexOf(el); var item = i >= 0 ? stack.splice(i, 1)[0] : null;
    if (!stack.length) window.removeEventListener('keydown', trap, true);
    el.dispatchEvent(new CustomEvent('ow:close'));
    if (item && item.opener && item.opener.focus) item.opener.focus();
  }

  // ── The one video player ───────────────────────────────────────
  var player = null;
  function ensurePlayer() {
    if (player) return player;
    player = document.createElement('div');
    player.className = 'ow-player'; player.setAttribute('role', 'dialog'); player.setAttribute('aria-modal', 'true'); player.setAttribute('aria-hidden', 'true'); player.setAttribute('aria-labelledby', 'owPlayerTitle');
    player.innerHTML = '<div class="ow-player__box"><div class="ow-player__bar"><p class="ow-player__title" id="owPlayerTitle"></p>' +
      '<button type="button" class="ow-drawer__close ow-player__close" data-ow-close aria-label="Close video"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>' +
      '<div class="ow-player__stage"><video controls playsinline preload="metadata"></video>' +
      '<div class="ow-player__status" role="status" aria-live="polite" hidden><span class="ow-player__spin" aria-hidden="true"></span><span class="ow-player__msg">Loading video…</span><button type="button" class="ow-btn ow-player__retry" hidden>Try again</button></div></div>' +
      '<p class="ow-player__note">Recorded in the real OrivenAI app with a sample business. Captions are on; use the video controls to turn them off.</p></div>';
    document.body.appendChild(player);
    // Loading and error states: a quiet "Loading video…" while the film is
    // fetched or buffering, and a clear message with a retry if it can't load.
    var v0 = player.querySelector('video'), st = player.querySelector('.ow-player__status'), msg = player.querySelector('.ow-player__msg'), retry = player.querySelector('.ow-player__retry');
    var state = function (s) {
      st.hidden = s === 'ok'; st.classList.toggle('is-error', s === 'error'); retry.hidden = s !== 'error';
      msg.textContent = s === 'error' ? 'This video couldn’t load. Check your connection and try again.' : 'Loading video…';
    };
    ['loadstart', 'waiting'].forEach(function (ev) { v0.addEventListener(ev, function () { if (v0.getAttribute('src')) state('loading'); }); });
    ['canplay', 'playing'].forEach(function (ev) { v0.addEventListener(ev, function () { state('ok'); }); });
    v0.addEventListener('error', function () { if (v0.getAttribute('src')) state('error'); });
    retry.addEventListener('click', function () { state('loading'); v0.load(); var pr = v0.play(); if (pr && pr.catch) pr.catch(function () {}); });
    player._owState = state;
    player.addEventListener('click', function (e) { if (e.target === player || (e.target.closest && e.target.closest('[data-ow-close]'))) close(player); });
    player.addEventListener('ow:close', function () { var v = player.querySelector('video'); v.pause(); v.removeAttribute('src'); Array.prototype.slice.call(v.querySelectorAll('track')).forEach(function (t) { t.remove(); }); v.load(); });
    return player;
  }
  function playVideo(btn) {
    var p = ensurePlayer(), v = p.querySelector('video');
    p._owState('loading');
    p.querySelector('.ow-player__title').textContent = btn.getAttribute('data-ow-title') || 'OrivenAI';
    v.setAttribute('poster', btn.getAttribute('data-ow-poster') || '');
    v.src = btn.getAttribute('data-ow-video');
    var cap = btn.getAttribute('data-ow-captions');
    if (cap) { var t = document.createElement('track'); t.kind = 'captions'; t.srclang = 'en'; t.label = 'English'; t.src = cap; t.default = true; v.appendChild(t); }
    open(p, btn);
    // Started by the user's click; plays with sound the user controls (never autoplay on load).
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () { /* the controls are there to start it */ });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var vid = t.closest('[data-ow-video]');
    if (vid) { e.preventDefault(); playVideo(vid); return; }
    var op = t.closest('[data-ow-open]');
    if (op) { e.preventDefault(); open(document.getElementById(op.getAttribute('data-ow-open')), op); return; }
    var dr = t.closest('.ow-drawer.is-open');
    if (dr && (t.closest('[data-ow-close]') || t.classList.contains('ow-drawer__scrim'))) { e.preventDefault(); close(dr); }
  });

  window.owUI = { open: open, close: close, playVideo: playVideo };
})();
