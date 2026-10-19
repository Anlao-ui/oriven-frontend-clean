/* ════════════════════════════════════════════════════════════════
   Discover OrivenAI — the first-run product tour.

   Welcome card over the real app → "Explore OrivenAI" → the card becomes
   a compact dock and the tour walks the six real pages through the real
   router (_orvNav), lighting one piece of the O per page (js/orivenRing.js,
   the landing page's six-part mark) → completion card with the whole O.

   It is a look, not a test drive: while it runs a veil over the app takes
   every click, so nothing on the pages can be started, generated, launched
   or changed. No API call is made here except through onboarding.js.

   Who sees it and what is saved is onboarding.js's job (server-side state,
   GET/POST /api/onboarding/*). This file only reports back:
     orvOnboardingTourDone()    — "Start using OrivenAI" (→ plan step, then saved)
     orvOnboardingTourSkipped() — "Skip tour" (saved as skipped)
   Progress (the step) is kept on this device so a refresh resumes where the
   tour was; it is cleared when the tour ends either way.

   Opened from Settings ("Take a product tour") it runs the same way, but for
   an account that has already finished onboarding nothing is saved and
   finishing simply returns to the Control Center.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STEPS = [
    { nav: ['businessbrain', 'page-business-brain'], name: 'Control Center',
      title: 'Your advertising headquarters.',
      text: 'Everything you need to manage your advertising workflow, all in one place.',
      focus: ['#bizCanvas', '.orv-page-wrap-biz'] },
    { nav: ['research', 'page-research'], name: 'Research',
      title: 'Understand your audience.',
      text: 'Discover valuable insights to build a stronger advertising strategy.',
      focus: ['#researchWorkspace', '#researchPageWrap'] },
    { nav: ['create', 'page-create'], name: 'Create',
      title: 'Bring your ideas to life.',
      text: 'Create compelling advertising visuals with the power of AI.',
      focus: ['.cr2-workspace-row', '.cr2-wrap'] },
    { nav: ['launch', 'page-launch'], name: 'Launch',
      title: 'From creative to campaign.',
      text: 'Prepare and launch advertising campaigns through one connected workflow.',
      focus: ['#lqWorkspaceRow', '#launchSelectView'] },
    { nav: ['performance', 'page-performance'], name: 'Campaigns',
      title: 'Stay in control.',
      text: 'Manage your campaigns from one central workspace.',
      focus: ['#prfPerfCol', '.prf-wrap'] },
    { nav: ['autopilot', 'page-autopilot'], name: 'Automations',
      title: 'Automate your advertising workflows.',
      text: 'Schedule campaigns and set rules that act within limits you choose, or ask you first.',
      focus: ['#auRoot'] }
  ];
  var WELCOME = {
    eyebrow: 'Welcome to OrivenAI',
    title: 'Your advertising journey starts here.',
    text: 'Discover how research, creativity and campaign management come together in one connected workflow.'
  };
  var DONE = {
    eyebrow: 'Six parts · One workflow',
    title: 'You’re ready to create.',
    text: 'From research to campaign management, everything is connected. Your next great advertisement starts here.'
  };
  var RESUME_MS = 24 * 60 * 60 * 1000;

  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var T = null;          // DOM refs, built once
  var S = { open: false, mode: null, step: -1, forced: false, busy: false, returnFocus: null, seq: 0 };

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce.matches ? Math.min(ms, 40) : ms); }); }
  function frames(n) { return new Promise(function (r) { var k = n || 2; (function f() { if (--k < 0) r(); else requestAnimationFrame(f); })(); }); }
  function uid() { try { return (typeof _currentUser !== 'undefined' && _currentUser && _currentUser.id) || null; } catch (_) { return null; } }
  function key() { var u = uid(); return u ? 'oriven_tour_' + u : null; }
  function saveProgress(v) { var k = key(); if (!k) return; try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(Object.assign({ at: Date.now() }, v))); } catch (_) {} }
  function readProgress() {
    var k = key(); if (!k) return null;
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (!v || Date.now() - v.at > RESUME_MS) return null; return v; } catch (_) { return null; }
  }
  // While the tour is open: Research and Autopilot show their real interface
  // instead of the plan card (css/orivenOps.css, body.orv-tour-preview), and
  // the whole app is inert — no clicks, no keyboard focus, hidden from
  // assistive tech — so the preview can only be looked at. Plans are still
  // checked by the server on every request; nothing here grants access.
  function preview(on) {
    document.body.classList.toggle('orv-tour-preview', !!on);
    var app = document.querySelector('.app');
    if (app) { if (on) app.setAttribute('inert', ''); else app.removeAttribute('inert'); }
  }
  function eligible() { var st = window._orvObState; return !!(st && st.eligible); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ── DOM ─────────────────────────────────────────────────────────
  function build() {
    if (T) return T;
    var root = el('div', 'ot-root'); root.id = 'orvTour'; root.hidden = true;
    var scrim = el('div', 'ot-scrim'); scrim.setAttribute('aria-hidden', 'true');
    var focus = el('div', 'ot-focus'); focus.setAttribute('aria-hidden', 'true');
    var shell = el('div', 'ot-shell'); shell.setAttribute('aria-hidden', 'true');
    var panel = el('section', 'ot-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'otTitle'); panel.setAttribute('aria-describedby', 'otDesc'); panel.tabIndex = -1;
    panel.innerHTML =
      '<button type="button" class="ot-skip" data-ot="skip">Skip tour</button>' +
      '<div class="ot-body">' +
        '<div class="ot-ring-slot"><div class="ot-ring"></div></div>' +
        '<div class="ot-copy">' +
          '<div class="ot-eyebrow" id="otEyebrow"></div>' +
          '<h2 class="ot-title" id="otTitle"><span class="ot-mask"><span class="ot-line"></span></span></h2>' +
          '<p class="ot-desc" id="otDesc"></p>' +
        '</div>' +
        '<div class="ot-actions">' +
          '<button type="button" class="ot-btn ot-alt" data-ot="alt"></button>' +
          '<button type="button" class="ot-btn ot-next" data-ot="next"></button>' +
        '</div>' +
      '</div>' +
      '<p class="ot-sr" aria-live="polite" aria-atomic="true"></p>';
    root.appendChild(scrim); root.appendChild(focus); root.appendChild(shell); root.appendChild(panel);
    document.body.appendChild(root);
    T = {
      root: root, scrim: scrim, focus: focus, shell: shell, panel: panel,
      body: panel.querySelector('.ot-body'), copy: panel.querySelector('.ot-copy'),
      eyebrow: panel.querySelector('.ot-eyebrow'), title: panel.querySelector('.ot-line'), desc: panel.querySelector('.ot-desc'),
      ringBox: panel.querySelector('.ot-ring'), next: panel.querySelector('[data-ot="next"]'), alt: panel.querySelector('[data-ot="alt"]'),
      skip: panel.querySelector('[data-ot="skip"]'), live: panel.querySelector('.ot-sr')
    };
    T.ring = window.OrvRing.create(T.ringBox);
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ot]'); if (!b || S.busy) return;
      var a = b.getAttribute('data-ot');
      if (a === 'skip') skip();
      else if (a === 'next') next();
      else if (a === 'alt') { if (S.mode === 'welcome') skip(); else prev(); }
    });
    // The veil takes clicks and wheel/touch scrolling; nothing behind it can be used.
    ['wheel', 'touchmove'].forEach(function (t) { root.addEventListener(t, function (e) { if (!T.panel.contains(e.target)) e.preventDefault(); }, { passive: false }); });
    window.addEventListener('resize', onResize);
    // The cookie banner sits above the tour; once it is answered the dock moves back down.
    document.addEventListener('click', function (e) { if (S.open && e.target.closest && e.target.closest('.orv-cc')) setTimeout(onResize, 50); }, true);
    return T;
  }

  // ── layout ──────────────────────────────────────────────────────
  // Box for each mode; the shell animates between them.
  function boxFor(mode) {
    var vw = window.innerWidth, vh = window.innerHeight, small = vw <= 640;
    var w, left;
    if (mode === 'dock') {
      if (small) { w = vw; left = 0; }
      else {
        // Centred on the content area (right of the sidebar). Some pages lay out
        // outside .mc, so keep the last real measurement to avoid a jump.
        var mc = document.querySelector('.mc'), r = mc ? mc.getBoundingClientRect() : null;
        if (r && r.width >= 200) S.area = { left: r.left, width: r.width };
        r = S.area || { left: 0, width: vw };
        if (r.left + r.width > vw + 1) r = { left: 0, width: vw };
        w = Math.min(600, r.width - 48, vw - 32); left = Math.round(r.left + (r.width - w) / 2);
      }
    } else { w = Math.min(mode === 'done' ? 540 : 520, vw - 32); left = Math.round((vw - w) / 2); }
    T.panel.style.width = w + 'px'; T.panel.style.left = left + 'px';
    var h = T.panel.offsetHeight, top;
    if (mode === 'dock') {
      var gap = small ? 0 : 24, cc = document.querySelector('.orv-cc'), lift = 0;
      // Keep clear of the cookie banner while it is open (it sits above the tour).
      if (cc && cc.getClientRects().length && getComputedStyle(cc).visibility !== 'hidden') { var b = cc.getBoundingClientRect(); if (b.height && b.left < left + w && b.right > left) lift = vh - b.top + 12; }
      top = vh - h - Math.max(gap, lift);
    } else top = Math.max(16, Math.round((vh - h) / 2));
    T.panel.style.top = top + 'px';
    return { left: left, top: top, width: w, height: h, radius: mode === 'dock' && small ? 22 : 24, sheet: mode === 'dock' && small };
  }
  function paintShell(b) {
    var s = T.shell.style;
    s.left = b.left + 'px'; s.top = b.top + 'px'; s.width = b.width + 'px'; s.height = (b.sheet ? b.height + 40 : b.height) + 'px';
    s.borderRadius = b.sheet ? '22px 22px 0 0' : b.radius + 'px';
  }
  // Animate the shell from where it is to the new box (one element: left/top/size).
  function morphShell(b) {
    var from = T.shell.getBoundingClientRect();
    paintShell(b);
    if (reduce.matches || !T.shell.animate || !from.width) return Promise.resolve();
    var to = T.shell.getBoundingClientRect();
    var anim = T.shell.animate([
      { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' },
      { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' }
    ], { duration: 620, easing: 'cubic-bezier(.22,1,.36,1)' });
    return anim.finished.catch(function () {});
  }
  // Shared-element move of the O between layouts (FLIP on its box).
  function flipRing(before) {
    if (reduce.matches || !before || !T.ringBox.animate) return;
    var after = T.ringBox.getBoundingClientRect();
    if (!after.width) return;
    var dx = before.left - after.left, dy = before.top - after.top, s = before.width / after.width;
    T.ringBox.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')' }, { transform: 'none' }],
      { duration: 640, easing: 'cubic-bezier(.22,1,.36,1)' });
  }

  // Spotlight: the step's main area, kept clear of the dock.
  function target(step) {
    var page = document.getElementById(step.nav[1]);
    if (!page) return null;
    // Pages the plan doesn't include show their real interface during the tour (preview).
    var list = step.focus.map(function (s) { return page.querySelector(s); });
    for (var i = 0; i < list.length; i++) { var e = list[i]; if (e && e.getClientRects().length && e.getBoundingClientRect().height > 40) return e; }
    return page;
  }
  function spotlight(step) {
    var t = step && target(step);
    if (!t) { T.focus.classList.remove('is-on'); return; }
    var r = t.getBoundingClientRect(), vw = window.innerWidth, pad = 10;
    var limit = (parseFloat(T.panel.style.top) || window.innerHeight) - 16;
    var left = Math.max(8, r.left - pad), top = Math.max(8, r.top - pad);
    var right = Math.min(vw - 8, r.right + pad), bottom = Math.min(limit, r.bottom + pad);
    if (bottom - top < 80) { T.focus.classList.remove('is-on'); return; }
    var f = T.focus.style;
    f.left = left + 'px'; f.top = top + 'px'; f.width = (right - left) + 'px'; f.height = (bottom - top) + 'px';
    T.focus.classList.add('is-on');
  }
  function focusFullscreen() {
    var f = T.focus.style; f.left = '0px'; f.top = '0px'; f.width = window.innerWidth + 'px'; f.height = window.innerHeight + 'px';
  }
  var _rz = 0;
  function onResize() {
    if (!S.open) return;
    cancelAnimationFrame(_rz);
    _rz = requestAnimationFrame(function () {
      var b = boxFor(S.mode); paintShell(b);
      if (S.mode === 'dock') spotlight(STEPS[S.step]);
    });
  }

  // ── content ─────────────────────────────────────────────────────
  function setText(eyebrowHtml, title, text) {
    T.eyebrow.innerHTML = eyebrowHtml; T.title.textContent = title; T.desc.textContent = text;
  }
  function setButtons(mode, step) {
    T.next.innerHTML = mode === 'welcome' ? 'Explore OrivenAI <span class="ot-arrow" aria-hidden="true">→</span>'
      : mode === 'done' ? 'Start using OrivenAI <span class="ot-arrow" aria-hidden="true">→</span>'
      : step === STEPS.length - 1 ? 'Finish Tour <span class="ot-arrow" aria-hidden="true">→</span>'
      : 'Next Step <span class="ot-arrow" aria-hidden="true">→</span>';
    T.next.setAttribute('aria-label', mode === 'dock' && step < STEPS.length - 1 ? 'Next step: ' + STEPS[step + 1].name : T.next.textContent.replace('→', '').trim());
    T.alt.classList.toggle('is-quiet', mode === 'welcome');
    if (mode === 'welcome') { T.alt.hidden = false; T.alt.disabled = false; T.alt.textContent = 'Skip tour'; T.alt.removeAttribute('aria-label'); }
    else if (mode === 'dock') {
      T.alt.hidden = false; T.alt.innerHTML = '<span class="ot-arrow" aria-hidden="true">←</span> Previous';
      T.alt.disabled = step === 0; T.alt.style.visibility = step === 0 ? 'hidden' : '';
      T.alt.setAttribute('aria-label', step > 0 ? 'Previous step: ' + STEPS[step - 1].name : 'Previous');
    } else T.alt.hidden = true;
    if (mode !== 'dock') T.alt.style.visibility = '';
    T.skip.hidden = mode !== 'dock';
  }
  function stepEyebrow(i) { return '<span>Step ' + pad(i + 1) + ' of ' + pad(STEPS.length) + '</span><i></i><span class="ot-of">' + esc(STEPS[i].name) + '</span>'; }
  // After a layout change: text and buttons come back once the panel has
  // (nearly) settled, rising in through their masks.
  function revealCopy(delay) {
    return wait(delay).then(function () {
      T.copy.classList.add('is-entering'); void T.copy.offsetWidth;
      T.body.classList.remove('is-swapping');
      T.copy.classList.remove('is-entering');
    });
  }
  function announce(s) { T.live.textContent = ''; setTimeout(function () { T.live.textContent = s; }, 30); }

  // Text out (masked, upward), swap, text in (from below). back: reversed.
  function swapCopy(fn, back) {
    var c = T.copy;
    if (reduce.matches) { fn(); return Promise.resolve(); }
    c.classList.toggle('is-back', !!back);
    c.classList.add('is-leaving');
    return wait(200).then(function () {
      fn();
      c.classList.remove('is-leaving'); c.classList.add('is-entering');
      void c.offsetWidth;
      c.classList.remove('is-entering');
    });
  }

  // ── flow ────────────────────────────────────────────────────────
  function navigate(i) {
    if (typeof window._orvNav === 'function') window._orvNav(STEPS[i].nav[0], STEPS[i].nav[1]);
    var mc = document.querySelector('.mc'); if (mc) mc.scrollTop = 0;
    // The page is shown synchronously; give its own init a moment to lay out.
    return frames(2).then(function () { return wait(140); });
  }

  function open(opts) {
    opts = opts || {};
    if (!window.OrvRing) return false;
    build();
    var resume = !opts.force && !opts.back ? readProgress() : null;
    S.forced = !!opts.force && !eligible();
    if (S.open && !opts.back) return true;
    S.open = true; S.busy = false; S.returnFocus = document.activeElement;
    window._ob2Active = true; // other first-run prompts stay quiet while the tour is open
    preview(true);
    document.addEventListener('keydown', onKey, true);
    T.root.hidden = false; T.root.classList.remove('is-out');
    if (opts.back || (resume && resume.done)) return showDone({ fromBack: true });
    if (resume && resume.step >= 0 && resume.step < STEPS.length) return resumeAt(resume.step);
    return showWelcome(opts);
  }

  function showWelcome(opts) {
    S.mode = 'welcome'; S.step = -1;
    T.root.setAttribute('data-mode', 'welcome');
    setText(esc(WELCOME.eyebrow), WELCOME.title, WELCOME.text);
    setButtons('welcome');
    T.ring.set('scattered', null, { instant: true });
    focusFullscreen(); T.focus.classList.remove('is-on');
    paintShell(boxFor('welcome'));
    void T.root.offsetWidth;
    T.root.classList.add('is-in');
    setTimeout(function () { T.next.focus(); }, reduce.matches ? 0 : 120);
    if (!(opts && opts.quiet) && typeof window._ob3TrackTour === 'function') window._ob3TrackTour('shown', opts && opts.force ? 'restart' : 'signup');
    saveProgress(null);
    return true;
  }

  // Welcome → dock: the card shrinks to the bottom, the veil lifts, the O
  // assembles and lights its first piece, the Control Center opens up.
  function start() {
    S.busy = true;
    var ringBefore = T.ringBox.getBoundingClientRect();
    T.body.classList.add('is-swapping');
    return wait(170).then(function () {
      S.mode = 'dock'; S.step = 0;
      T.root.setAttribute('data-mode', 'dock');
      setText(stepEyebrow(0), STEPS[0].title, STEPS[0].text);
      setButtons('dock', 0);
      var b = boxFor('dock');
      flipRing(ringBefore);
      T.ring.set('step', 0);
      var morph = morphShell(b);
      var shown = revealCopy(380);
      return navigate(0).then(function () { spotlight(STEPS[0]); return Promise.all([morph, shown]); });
    }).then(function () {
      S.busy = false; saveProgress({ step: 0 });
      announce('Step 1 of 6, ' + STEPS[0].name + '. ' + STEPS[0].title + ' ' + STEPS[0].text);
      T.next.focus();
    });
  }

  function resumeAt(i) {
    S.mode = 'dock'; S.step = i;
    T.root.setAttribute('data-mode', 'dock');
    setText(stepEyebrow(i), STEPS[i].title, STEPS[i].text);
    setButtons('dock', i);
    T.ring.set('step', i, { instant: true });
    focusFullscreen();
    paintShell(boxFor('dock'));
    void T.root.offsetWidth;
    T.root.classList.add('is-in');
    return navigate(i).then(function () { spotlight(STEPS[i]); T.next.focus(); return true; });
  }

  function go(i, back) {
    if (S.busy || i < 0 || i >= STEPS.length) return;
    S.busy = true; var my = ++S.seq;
    T.ring.set('step', i);
    var copy = swapCopy(function () {
      setText(stepEyebrow(i), STEPS[i].title, STEPS[i].text);
      setButtons('dock', i);
      morphShell(boxFor('dock'));
    }, back);
    S.step = i; saveProgress({ step: i });
    Promise.all([copy, navigate(i)]).then(function () {
      if (my !== S.seq) return;
      spotlight(STEPS[i]);
      S.busy = false;
      announce('Step ' + (i + 1) + ' of 6, ' + STEPS[i].name + '. ' + STEPS[i].title + ' ' + STEPS[i].text);
      if (!T.panel.contains(document.activeElement) || document.activeElement.disabled) T.next.focus();
    });
  }

  function next() {
    if (S.mode === 'welcome') return start();
    if (S.mode === 'done') return finish();
    if (S.step === STEPS.length - 1) return showDone();
    go(S.step + 1, false);
  }
  function prev() { if (S.mode === 'dock' && S.step > 0) go(S.step - 1, true); }

  // Dock → completion card: the veil returns, the card grows to the centre,
  // the O lights all six pieces in order and settles as the closing mark.
  function showDone(o) {
    S.busy = true;
    var ringBefore = T.ringBox.getBoundingClientRect();
    var fromBack = o && o.fromBack;
    T.body.classList.add('is-swapping');
    T.focus.classList.remove('is-on');
    if (fromBack) { T.root.setAttribute('data-mode', 'done'); T.ring.set('complete', null, { instant: true }); }
    return wait(fromBack ? 0 : 170).then(function () {
      S.mode = 'done';
      T.root.setAttribute('data-mode', 'done');
      setText(esc(DONE.eyebrow), DONE.title, DONE.text);
      setButtons('done');
      var b = boxFor('done');
      if (!fromBack) flipRing(ringBefore);
      if (fromBack) { paintShell(b); void T.root.offsetWidth; T.root.classList.add('is-in'); }
      var morph = fromBack ? Promise.resolve() : morphShell(b);
      T.ring.set('complete');
      saveProgress({ done: true });
      return Promise.all([morph, revealCopy(fromBack ? 0 : 420)]);
    }).then(function () {
      S.busy = false;
      announce(DONE.title + ' ' + DONE.text);
      T.next.focus();
      return true;
    });
  }

  function close(afterNav) {
    S.busy = true;
    document.body.classList.remove('orv-tour-preview'); // plan rules apply again at once
    T.root.classList.remove('is-in'); T.root.classList.add('is-out');
    T.focus.classList.remove('is-on');
    document.removeEventListener('keydown', onKey, true);
    return wait(280).then(function () {
      T.root.hidden = true; T.root.classList.remove('is-out');
      S.open = false; S.busy = false; S.mode = null;
      window._ob2Active = false;
      preview(false);
      if (afterNav) afterNav();
    });
  }

  function finish() {
    saveProgress(null);
    var report = !S.forced && typeof window.orvOnboardingTourDone === 'function';
    return close(function () {
      if (typeof window._orvNav === 'function') window._orvNav('businessbrain', 'page-business-brain');
      if (report) window.orvOnboardingTourDone();
      focusApp();
    });
  }

  // Ends the tour where the user is. Saved as skipped for a first-run account.
  function skip() {
    saveProgress(null);
    var report = !S.forced && typeof window.orvOnboardingTourSkipped === 'function';
    return close(function () { if (report) window.orvOnboardingTourSkipped(); focusApp(); });
  }

  function focusApp() {
    var r = S.returnFocus;
    if (r && r.isConnected && r !== document.body && r.offsetParent) { try { r.focus(); return; } catch (_) {} }
    var nav = document.querySelector('.orv-ni.orv-active');
    if (nav && nav.offsetParent) { try { nav.focus(); } catch (_) {} }
  }

  // Keys: Tab stays in the panel; ←/→ move between steps; Esc skips.
  function onKey(e) {
    if (!S.open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!S.busy && S.mode !== 'done') skip(); return; }
    if (e.key === 'Tab') {
      var items = Array.prototype.filter.call(T.panel.querySelectorAll('button'), function (b) { return !b.hidden && !b.disabled && b.offsetParent && b.style.visibility !== 'hidden'; });
      if (!items.length) return;
      var i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1)].focus();
      return;
    }
    if (S.mode === 'dock' && !S.busy && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      if (e.key === 'ArrowRight') next(); else prev();
    }
  }

  window.orvTour = {
    open: open,
    // Closes the tour without saving anything (another onboarding path took over).
    close: function () { return S.open ? close() : Promise.resolve(); },
    isOpen: function () { return S.open; },
    step: function () { return S.mode === 'dock' ? S.step : S.mode; },
    STEPS: STEPS
  };
})();
