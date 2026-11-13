/* ════════════════════════════════════════════════════════════════
   OrivenAI landing page behaviour (markup: #view-landing in index.html,
   styles: css/landing.css).

   • Dot field: <canvas class="ik-field"> in the hero, the problem band and
     the final CTA, drawn by the shared engine in js/dot-field.js (also used
     by the other public pages' headers). Once a canvas draws, its host gets
     .ik-live and the CSS lattice under it fades out: one layer of dots.
   • Assistant creatures (js/landing-creatures.js) render in the same loop:
     ~30 fps cap, DPR ≤ 2, nothing drawn off-screen or in hidden tabs, one
     still frame under prefers-reduced-motion, started only after load.
   • Motion system: .ik-motion (set in the page when motion is allowed)
     drives reveals ([data-reveal]) and section entrances (.is-in). They play
     each time an element enters view and reset once it is fully out of view.
   • Assistant selector, workflow loop and rail, product films, in-page scrolling.
   No network requests and no tracking: links go to the existing routes.
   ════════════════════════════════════════════════════════════════ */
(function () {
  var root = document.getElementById('ik-home');
  if (!root || root._ik) return;
  root._ik = true;
  root.classList.add('ik-js');

  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: true };
  var scroller = document.getElementById('view-landing') || window;
  var VOLT = [234, 253, 19];
  function $(sel, ctx) { return (ctx || root).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }
  function hexRgb(h) { h = String(h || '').trim().replace('#', ''); if (h.length !== 6) return VOLT.slice(); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function agentColor(el) { return hexRgb(getComputedStyle(el).getPropertyValue('--ac')); }
  function smooth() { return reduceMq.matches ? 'auto' : 'smooth'; }
  function onScroll(fn) { var q = false; scroller.addEventListener('scroll', function () { if (q) return; q = true; requestAnimationFrame(function () { q = false; fn(); }); }, { passive: true }); }

  // ── Motion system: reveals and section entrances ─────────────────
  var motion = root.classList.contains('ik-motion') && !reduceMq.matches && !!window.IntersectionObserver;
  if (!motion) root.classList.remove('ik-motion');
  if (motion) {
    // In: once 12% shows above the lower edge. Out: only when completely off
    // screen, so nothing fades while it can still be seen; it plays again on
    // the way back, mirrored (.ik-above) when it comes back from above.
    var inIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('is-in'); });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    var outIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) return;
        var top = e.rootBounds ? e.rootBounds.top : 0;
        e.target.classList.remove('is-in');
        e.target.classList.toggle('ik-above', e.boundingClientRect.bottom <= top + 1);
      });
    }, { threshold: 0 });
    $$('[data-reveal], [data-ik-doc], [data-ik-ints], [data-ik-final]').forEach(function (el) { inIO.observe(el); outIO.observe(el); });
    var heroRing = $('.ik-ring--hero');
    if (heroRing) setTimeout(function () { heroRing.classList.add('is-done'); }, 2200); // hand transforms back to hover
  } else {
    $$('[data-reveal], [data-ik-doc], [data-ik-ints], [data-ik-final]').forEach(function (el) { el.classList.add('is-in'); });
  }

  // ── Dot field: js/dot-field.js holds the engine and the one shared loop ──
  var DF = window.IkDotField, Field = DF && DF.Field;
  var fields = DF ? DF.fields : [];
  root._ikFields = fields; // read-only handle for tests
  function tick() { if (DF) DF.tick(); }

  function rel(el, field) { var a = el.getBoundingClientRect(), b = field.c.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width }; }
  function startFields() {
    if (!window.HTMLCanvasElement || !Field) return;
    var hero = $('canvas[data-field="hero"]'), mark = $('.ik-hero__mark');
    if (hero && hero.getContext) fields.push(new Field(hero, { tint: VOLT, focus: function (fl) { var p = rel(mark, fl); return { x: p.x, y: p.y, r: p.w * 0.7 }; } }));
    var prob = $('canvas[data-field="problem"]');
    if (prob && prob.getContext) {
      // The band: scatter stays inside it (sy), and once the dots are in
      // order the signal lights up from the middle.
      var pf = new Field(prob, { mode: 'assemble', amp: 0, tint: VOLT, sy: 0.22, focus: function (fl) { return { x: fl.w / 2, y: fl.h / 2, r: 0.0001 + smoothstep((fl.progress - 0.55) / 0.45) * fl.w * 0.3 }; } });
      fields.push(pf);
      // Scroll-linked: dots settle into the grid as the band rises to the
      // middle of the screen, fully ordered when it is centred.
      var sync = function () {
        var r = prob.getBoundingClientRect(), vh = window.innerHeight || 800;
        var target = reduceMq.matches ? 1 : clamp((vh - r.top) / (vh * 0.5 + r.height * 0.5), 0, 1);
        if (Math.abs(target - pf.progress) < 0.002 && pf.drawn) return;
        pf.progress = target;
        if (pf.visible || !pf.drawn) pf.frame(performance.now());
      };
      onScroll(sync); window.addEventListener('resize', sync); sync();
    }
    var fin = $('canvas[data-field="final"]'), fring = $('.ik-final__ring');
    if (fin && fin.getContext) fields.push(new Field(fin, { tint: VOLT, amp: 0.6, focus: function (fl) { var p = rel(fring, fl); return { x: p.x, y: p.y, r: Math.max(280, p.w * 2.6) }; } }));
    startCreatures();
    tick();
  }

  // ── Assistant creatures: one per figure, drawn in the shared loop ──
  var creatures = [], stageIn = false;
  function figOffset(j) { var o = j - cur; if (o > 3) o -= 6; if (o < -2) o += 6; return o; }
  function syncCreatures() {
    creatures.forEach(function (cr) { var ab = Math.abs(figOffset(cr.slot)); cr.visible = stageIn && ab < 3; cr.lite = ab !== 0; });
  }
  function startCreatures() {
    if (!window.IkCreatures || !sel) return;
    figs.forEach(function (fig, j) {
      var cv = $('.ik-creature__c', fig);
      if (!cv || !cv.getContext) return;
      var cr = new window.IkCreatures.Creature(cv, cv.getAttribute('data-creature'), { color: agentColor(fig), reduce: reduceMq });
      cr.slot = j; cr.visible = false;
      creatures.push(cr); fields.push(cr);
      if (window.ResizeObserver) new ResizeObserver(function () { cr.layout(); if (cr.visible) cr.frame(performance.now()); }).observe(cv);
      fig.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || !finePointer.matches || reduceMq.matches) return;
        cr.pointer(e.clientX, e.clientY, true); tick();
      }, { passive: true });
      fig.addEventListener('pointerleave', function () { cr.pointer(0, 0, false); tick(); });
    });
    var stage = $('.ik-stage', sel);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) {
      var was = stageIn; stageIn = es[0].isIntersecting;
      // Each time the stage comes into view, the assistant in focus gathers itself.
      if (stageIn && !was) creatures.forEach(function (cr) { cr.assemble(cr.slot === cur ? 0 : 0.4); });
      syncCreatures(); tick();
    }, { threshold: 0.15 }).observe(stage);
    else { stageIn = true; syncCreatures(); }
  }

  // ── Assistant selector ───────────────────────────────────────────
  var sel = $('[data-ik-sel]'), cur = 0;
  var figs = sel ? $$('.ik-fig', sel) : [], tabs = sel ? $$('.ik-pager [role="tab"]', sel) : [], panels = sel ? $$('.ik-agent', sel) : [];
  var pagerSegs = sel ? $$('.ik-pager .ik-seg', sel) : [];
  function setAgent(i, how) {
    if (!panels.length) return;
    i = ((i % panels.length) + panels.length) % panels.length;
    var changed = i !== cur; cur = i;
    figs.forEach(function (f, j) {
      var o = j - i; if (o > 3) o -= 6; if (o < -2) o += 6;
      var ab = Math.abs(o);
      f.style.setProperty('--x', o === 3 ? 0 : (ab === 2 ? o * 0.86 : o));
      f.style.setProperty('--s', ab === 0 ? 1 : ab === 1 ? 0.52 : 0.36);
      f.style.setProperty('--o', ab === 0 ? 1 : ab === 1 ? 0.55 : ab === 2 ? 0.16 : 0);
      f.style.zIndex = String(10 - ab);
      f.classList.toggle('is-active', ab === 0);
    });
    tabs.forEach(function (t, j) { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
    pagerSegs.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
    panels.forEach(function (p, j) { p.hidden = j !== i; });
    var name = panels[i].querySelector('.ik-agent__name').textContent;
    var role = (panels[i].querySelector('.ik-agent__id').textContent.split('Specialisation:')[1] || '').trim();
    var nm = $('[data-ik-name]', sel); if (nm) nm.textContent = name;
    var start = $('[data-ik-start]', sel); if (start) start.setAttribute('aria-label', 'Get started with ' + name);
    var count = $('[data-ik-count]', sel); if (count) count.textContent = (i + 1) + ' / ' + panels.length;
    if (how && how !== 'init') { var live = $('[data-ik-live]', sel); if (live) live.textContent = name + ', ' + role + '. ' + (i + 1) + ' of ' + panels.length + '.'; }
    syncCreatures();
    // The newly chosen assistant gathers itself: feedback that works for touch too.
    if (changed && how !== 'init') creatures.forEach(function (cr) { if (cr.slot === i) cr.assemble(0.3); });
    tick();
  }
  if (sel && panels.length) {
    panels.forEach(function (p) { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'ik-tab-' + p.getAttribute('data-agent')); p.tabIndex = 0; });
    $('[data-ik-prev]', sel).addEventListener('click', function () { setAgent(cur - 1, 'button'); });
    $('[data-ik-next]', sel).addEventListener('click', function () { setAgent(cur + 1, 'button'); });
    tabs.forEach(function (t, j) { t.addEventListener('click', function () { setAgent(j, 'tab'); }); });
    $('.ik-pager', sel).addEventListener('keydown', function (e) {
      var k = e.key, to = null;
      if (k === 'ArrowRight' || k === 'ArrowDown') to = cur + 1; else if (k === 'ArrowLeft' || k === 'ArrowUp') to = cur - 1; else if (k === 'Home') to = 0; else if (k === 'End') to = panels.length - 1;
      if (to === null) return;
      e.preventDefault(); setAgent(to, 'key'); tabs[cur].focus();
    });
    // A click that ends a swipe is part of the swipe, not a choice of figure.
    var swipedAt = 0;
    figs.forEach(function (f, j) { f.addEventListener('click', function () { if (Date.now() - swipedAt < 400) return; if (j !== cur) setAgent(j, 'figure'); }); });
    var stage = $('.ik-stage', sel), sx = null, sy = 0;
    stage.style.touchAction = 'pan-y';
    stage.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', function (e) {
      if (sx === null) return; var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) { swipedAt = Date.now(); setAgent(cur + (dx < 0 ? 1 : -1), 'swipe'); }
    });
    stage.addEventListener('pointercancel', function () { sx = null; });
    setAgent(0, 'init');
  }
  // ── Full profile: backstory, strengths and the example conversation in a
  // side drawer (css/ow-system.css, js/ow-ui.js), filled from the agent's
  // own article so nothing is written twice.
  var profile = document.getElementById('ikProfile');
  if (profile && panels.length) {
    panels.forEach(function (p) {
      var b = p.querySelector('[data-ik-profile]'); if (!b) return;
      var nm = p.querySelector('.ik-agent__name').textContent;
      b.setAttribute('aria-label', 'View ' + nm + '’s full profile'); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', 'ikProfile');
      b.addEventListener('click', function () {
        var body = profile.querySelector('[data-ik-profile-body]');
        var main = p.querySelector('.ik-agent__main').cloneNode(true), chat = p.querySelector('.ik-chat');
        var more = main.querySelector('[data-ik-profile]'); if (more) more.remove();
        Array.prototype.forEach.call(main.querySelectorAll('[id]'), function (el) { el.removeAttribute('id'); });
        var h = main.querySelector('.ik-agent__name'); if (h) h.id = 'ikProfileTitle';
        body.innerHTML = '';
        body.appendChild(main);
        if (chat) { var c = chat.cloneNode(true); c.removeAttribute('id'); body.appendChild(c); }
        var cta = document.createElement('div'); cta.className = 'ik-profile__cta';
        cta.innerHTML = '<a class="ik-btn ik-btn--primary" href="/signup">Get started</a>';
        var note = document.createElement('p'); note.className = 'ik-profile__note';
        note.textContent = 'You choose one assistant during setup; it stays with you everywhere in OrivenAI. The backstory and conversation are illustrative.';
        body.appendChild(cta); body.appendChild(note);
        profile.querySelector('.ow-drawer__panel').setAttribute('data-agent', p.getAttribute('data-agent'));
        profile.querySelector('.ow-drawer__panel').style.setProperty('--ac', getComputedStyle(p).getPropertyValue('--ac'));
        if (window.owUI) window.owUI.open(profile, b);
      });
    });
  }
  function gotoAgent(k) {
    var j = panels.map(function (p) { return p.getAttribute('data-agent'); }).indexOf(k);
    if (j < 0) return false;
    setAgent(j, 'link');
    var r = sel.getBoundingClientRect(), vh = window.innerHeight || 800;
    if (r.top < 0 || r.top > vh * 0.6) $('#agents').scrollIntoView({ behavior: smooth(), block: 'start' });
    return true;
  }

  // ── Workflow loop: scroll-linked, Volt only ──────────────────────
  var loopEl = $('[data-ik-loop]'), steps = $$('.ik-step'), loopSegs = $$('.ik-ring--loop .ik-seg'), loopTags = $$('.ik-loop__tag'), loopCount = $('[data-ik-loop-count]');
  var curStep = -2;
  function setStep(i) {
    if (i === curStep) return; curStep = i;
    steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); s.classList.toggle('is-done', j < i); });
    loopSegs.forEach(function (s, j) { s.classList.toggle('is-active', j === i); s.classList.toggle('is-done', j < i); });
    loopTags.forEach(function (s, j) { s.classList.toggle('is-active', j === i); s.classList.toggle('is-done', j < i); });
    if (loopEl) loopEl.classList.toggle('has-active', i >= 0);
    if (loopCount) loopCount.textContent = (i < 0 ? '01' : String(i + 1).padStart(2, '0')) + ' / 06';
  }
  var stepList = $('.ik-steps');
  if (steps.length) {
    // The active step is the last one whose top has passed 55% of the viewport;
    // the rail fills to the same reading line.
    var syncSteps = function () {
      var line = (window.innerHeight || 800) * 0.55, idx = -1;
      for (var s = 0; s < steps.length; s++) if (steps[s].getBoundingClientRect().top < line) idx = s;
      setStep(idx);
      if (stepList) { var r = stepList.getBoundingClientRect(); stepList.style.setProperty('--prog', clamp((line - r.top) / (r.height || 1), 0, 1).toFixed(3)); }
    };
    onScroll(syncSteps); window.addEventListener('resize', syncSteps); syncSteps();
  }

  // ── Inside OrivenAI: product films ───────────────────────────────
  var inside = $('[data-ik-inside]');
  if (inside) {
    var shotTabs = $$('[role="tab"]', $('.ik-tabs', inside)), shots = $$('.ik-shot', inside), caps = $$('.ik-shot__cap', inside);
    var shotName = $('[data-ik-shot-name]', inside);
    var showShot = function (i, focus) {
      shots.forEach(function (s, j) { var on = j === i; s.classList.toggle('is-active', on); var v = s.querySelector('video'); if (v && !on) v.pause(); });
      caps.forEach(function (c, j) { c.classList.toggle('is-active', j === i); });
      shotTabs.forEach(function (t, j) { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
      if (shotName) shotName.textContent = shotTabs[i].textContent.replace(/^\d+/, '');
      if (focus) shotTabs[i].focus();
    };
    shotTabs.forEach(function (t, j) { t.addEventListener('click', function () { showShot(j); }); });
    $('.ik-tabs', inside).addEventListener('keydown', function (e) {
      var i = shotTabs.indexOf(document.activeElement); if (i < 0) return;
      var to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? shotTabs.length - 1 : null;
      if (to === null) return; e.preventDefault(); showShot((to + shotTabs.length) % shotTabs.length, true);
    });
    $$('[data-ik-play]', inside).forEach(function (btn) {
      // A tab's tutorial (data-ow-video, written by tools/tutorials-section.js)
      // opens in the shared player (js/ow-ui.js), not inline in the frame.
      if (btn.hasAttribute('data-ow-video')) return;
      btn.addEventListener('click', function () {
        var shot = btn.closest('.ik-shot'), media = btn.parentNode, v = media.querySelector('video');
        if (!v) {
          v = document.createElement('video');
          v.muted = true; v.loop = true; v.playsInline = true; v.controls = true; v.preload = 'auto';
          v.setAttribute('aria-label', btn.getAttribute('aria-label').replace('Play the ', ''));
          v.src = shot.getAttribute('data-film');
          // Captions for the section films (assets/films/sections/<key>.vtt).
          var cap = shot.getAttribute('data-captions');
          if (cap) { var tr = document.createElement('track'); tr.kind = 'captions'; tr.srclang = 'en'; tr.label = 'English'; tr.src = cap; tr.default = true; v.appendChild(tr); }
          media.appendChild(v);
        }
        shot.classList.add('is-playing');
        var p = v.play(); if (p && p.catch) p.catch(function () {});
        v.focus();
      });
    });
  }

  // ── In-page links: scroll inside the landing scroll container ────
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var goto = a.getAttribute('data-ik-goto');
    if (goto && root.contains(a)) { if (gotoAgent(goto)) e.preventDefault(); return; }
    var m = /^\/?#([A-Za-z][\w-]*)$/.exec(a.getAttribute('href') || '');
    if (!m || (a.getAttribute('href').charAt(0) === '/' && location.pathname !== '/' && location.pathname !== '/index.html')) return;
    var target = document.getElementById(m[1]);
    if (!target || !root.contains(target) || root.closest('.pub-view')) return;
    e.preventDefault();
    if (typeof window.lpCloseMm === 'function') { try { window.lpCloseMm(); } catch (_) {} }
    if (/^agent-/.test(m[1]) && gotoAgent(m[1].slice(6))) return;
    target.scrollIntoView({ behavior: smooth(), block: 'start' });
  });
  function fromHash() {
    var id = (location.hash || '').slice(1); if (!id) return;
    if (/^agent-/.test(id) && gotoAgent(id.slice(6))) return;
    var t = document.getElementById(id); if (t && root.contains(t)) t.scrollIntoView({ block: 'start' });
  }

  // Start the canvases after the page has loaded, so they never compete with
  // the headline, CTA or images for the first render.
  function later() { (window.requestIdleCallback || function (f) { return setTimeout(f, 120); })(startFields, { timeout: 1200 }); }
  if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
  if (location.hash) setTimeout(fromHash, 60);
})();
