/* ════════════════════════════════════════════════════════════════
   OrivenAI dot field: the one engine behind every animated dot grid on
   the public site (the landing page's hero, problem band and final CTA,
   the assistant creatures, and the headers of the other public pages).

   • <canvas> lattice with slow waves; dots move aside for a fine pointer
     and ease back. Once a canvas has drawn, its host gets .ik-live so any
     CSS lattice fallback under it can fade out: one layer of dots, never
     a static copy behind moving ones.
   • ONE requestAnimationFrame loop for every registered canvas: ~30 fps
     cap, DPR ≤ 2, nothing drawn off-screen or in a hidden tab, one still
     frame under prefers-reduced-motion.
   • Login and Sign Up get the hero field behind the form card.
   • Page headers (.ov-sp-hero on the prerendered pages, .sp-hero on the
     Learn and Blog pages, the whole .ov-pricing-fold on Pricing) and closing sections
     (.site-cta) get a field automatically after load.
   API: window.IkDotField = { Field, add, tick, fields, rel, VOLT }.
   No network requests.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.IkDotField) return;
  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: true };
  var VOLT = [234, 253, 19], NEUTRAL = [236, 238, 230];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }
  var fields = [];
  function Field(canvas, cfg) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.cfg = cfg;
    this.tint = (cfg.tint || VOLT).slice(); this.tintTo = this.tint.slice();
    this.visible = false; this.progress = cfg.mode === 'assemble' ? 0 : 1; this.drawn = false;
    // Pointer: raw position, smoothed position, and a strength that eases in and out.
    this.ptr = { x: 0, y: 0, sx: 0, sy: 0, s: 0, to: 0, seen: false };
    this.seed = 7;
    var self = this, host = canvas.parentNode;
    if (window.ResizeObserver) new ResizeObserver(function () { self.layout(); self.frame(performance.now()); }).observe(host);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; tick(); }, { rootMargin: '120px 0px' }).observe(host);
    else this.visible = true;
    host.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || !finePointer.matches || reduceMq.matches) return;
      var r = canvas.getBoundingClientRect(), p = self.ptr;
      p.x = e.clientX - r.left; p.y = e.clientY - r.top; p.to = 1;
      if (!p.seen) { p.sx = p.x; p.sy = p.y; p.seen = true; }
      tick();
    }, { passive: true });
    host.addEventListener('pointerleave', function () { self.ptr.to = 0; tick(); });
    this.layout();
  }
  Field.prototype.rand = function () { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; };
  Field.prototype.layout = function () {
    var r = this.c.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) { this.w = 0; return; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = h; this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var max = w < 700 ? 900 : 2600, p = w < 700 ? 26 : 24;
    while (Math.ceil(w / p) * Math.ceil(h / p) > max) p += 2;
    this.p = p; this.seed = 7;
    var xs = [], ys = [], ox = [], oy = [], ph = [];
    for (var y = p / 2; y < h; y += p) for (var x = p / 2; x < w; x += p) {
      xs.push(x); ys.push(y);
      var a = this.rand() * Math.PI * 2, d = 24 + this.rand() * 120;
      ox.push(Math.cos(a) * d); oy.push(Math.sin(a) * d * 0.55); ph.push(this.rand());
    }
    this.xs = xs; this.ys = ys; this.ox = ox; this.oy = oy; this.ph = ph;
  };
  Field.prototype.pointerActive = function () { var p = this.ptr; return p.to > 0 || p.s > 0.004; };
  Field.prototype.needsFrame = function () {
    if (!this.visible || !this.w) return false;
    if (!this.drawn || this.pointerActive()) return true;
    return this.cfg.mode !== 'assemble' && !reduceMq.matches && !document.hidden;
  };
  Field.prototype.frame = function (now) {
    if (!this.w) return;
    var cfg = this.cfg, ctx = this.ctx, w = this.w, h = this.h, n = this.xs.length;
    var still = reduceMq.matches, t = still || cfg.mode === 'assemble' ? 12 : now / 1000;
    for (var k = 0; k < 3; k++) this.tint[k] += (this.tintTo[k] - this.tint[k]) * (still ? 1 : 0.08);
    var p = this.ptr; p.s += (p.to - p.s) * 0.12; p.sx += (p.x - p.sx) * 0.22; p.sy += (p.y - p.sy) * 0.22;
    var push = p.s, R = 140, R2 = R * R, PX = p.sx, PY = p.sy;
    var f = cfg.focus ? cfg.focus(this) : null, fx = f ? f.x : w / 2, fy = f ? f.y : h / 2, fr = f ? f.r : Math.max(w, h) * 0.4;
    var amp = cfg.amp == null ? 1 : cfg.amp, scatter = cfg.mode === 'assemble' ? 1 - smoothstep(this.progress) : 0, sy = cfg.sy == null ? 1 : cfg.sy;
    ctx.clearRect(0, 0, w, h);
    // 12 buckets: 6 alpha steps × neutral/tinted, one path each.
    var B = []; for (var b = 0; b < 12; b++) B.push([]);
    for (var i = 0; i < n; i++) {
      var x0 = this.xs[i], y0 = this.ys[i];
      var w1 = Math.sin(x0 * 0.011 + t * 0.55) * Math.cos(y0 * 0.015 - t * 0.42);
      var w2 = Math.sin((x0 + y0) * 0.0068 - t * 0.75 + this.ph[i] * 0.6);
      var wave = (w1 + w2) * 0.5, e = wave > 0 ? wave * wave * amp : 0;
      var x = x0 + Math.cos(w2 * 3) * 2.4 * e + this.ox[i] * scatter;
      var y = y0 + Math.sin(w1 * 3) * 2.4 * e + this.oy[i] * scatter * sy;
      var lift = 0;
      if (push > 0.004) { // dots move aside for the pointer, and ease back
        var dx = x - PX, dy = y - PY, d2 = dx * dx + dy * dy;
        if (d2 < R2) { var dd = Math.sqrt(d2) || 0.001, kk = 1 - dd / R; kk = kk * kk * push; x += (dd > 0.01 ? dx / dd : 1) * kk * 26; y += (dd > 0.01 ? dy / dd : 0) * kk * 26; lift = kk; }
      }
      var d = Math.sqrt((x - fx) * (x - fx) + (y - fy) * (y - fy)), fo = d < fr ? 1 - d / fr : 0; fo = fo * Math.sqrt(fo);
      var a = 0.075 + e * 0.42 + fo * 0.34 + lift * 0.4, mix = fo * 1.4 + e * fo;
      if (scatter > 0) a = a * (1 - scatter * 0.25) + scatter * 0.05;
      var r = 1.2 + e * 0.9 + fo * 0.5 + lift * 0.7;
      var q = Math.min(5, Math.floor(a * 7));
      B[q + (mix > 0.45 ? 6 : 0)].push(x, y, r);
    }
    for (var bi = 0; bi < 12; bi++) {
      var arr = B[bi]; if (!arr.length) continue;
      var col = bi >= 6 ? this.tint : NEUTRAL, alpha = ((bi % 6) + 0.6) / 7;
      ctx.fillStyle = 'rgba(' + Math.round(col[0]) + ',' + Math.round(col[1]) + ',' + Math.round(col[2]) + ',' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      for (var j = 0; j < arr.length; j += 3) { ctx.moveTo(arr[j] + arr[j + 2], arr[j + 1]); ctx.arc(arr[j], arr[j + 1], arr[j + 2], 0, 6.2832); }
      ctx.fill();
    }
    if (!this.drawn) { this.drawn = true; this.c.classList.add('is-on'); if (this.c.style.opacity === '0') this.c.style.opacity = '1'; this.c.parentNode.classList.add('ik-live'); }
  };

  // One loop for every canvas.
  var rafId = 0, last = 0;
  function loop(now) {
    rafId = 0;
    var busy = fields.filter(function (fl) { return fl.needsFrame(); });
    if (!busy.length) return;
    if (now - last >= 32) { last = now; busy.forEach(function (fl) { fl.frame(now); }); }
    rafId = requestAnimationFrame(loop);
  }
  function tick() { if (!rafId) rafId = requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', tick);
  if (reduceMq.addEventListener) reduceMq.addEventListener('change', function () { fields.forEach(function (fl) { fl.frame(performance.now()); }); tick(); });


  function rel(el, field) { var a = el.getBoundingClientRect(), b = field.c.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width }; }
  function add(f) { if (fields.indexOf(f) < 0) fields.push(f); tick(); return f; }

  // ── Page headers and closing sections ───────────────────────────
  // A quiet version of the landing hero's field behind each page header
  // (.ov-sp-hero on the prerendered pages, .sp-hero on Learn and Blog) and
  // behind each closing call to action (.site-cta): calmer waves, faded
  // toward the edges, always under the content and never in the way of a click.
  var MOUNTS = [
    { sel: '.ov-sp-hero, .sp-hero', cls: 'ik-field--header', mask: 'radial-gradient(ellipse 75% 85% at 50% 35%, #000 25%, transparent 78%)', fy: 0.42 },
    // Pricing: one field behind the whole fold (heading and the five cards),
    // faded at every edge so no rectangle shows; it ends just under the cards.
    { sel: '.ov-pricing-fold', cls: 'ik-field--header', mask: 'linear-gradient(to bottom, transparent 0, #000 48px, #000 calc(100% - 72px), transparent 100%), linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%)', composite: true, fy: 0.16, fr: 0.5 },
    { sel: '.site-cta', cls: 'ik-field--cta', mask: 'radial-gradient(ellipse 85% 90% at 50% 50%, #000 30%, transparent 82%)', fy: 0.5 },
    // Login and Sign Up: the landing hero's field (same waves, same pointer
    // push) behind the whole screen, its glow centred on the form card. The
    // card stays opaque, so the dots never sit under the text. Each view is
    // mounted once; while a view is hidden its field is off-screen and the
    // shared loop skips it (and stops when nothing is visible).
    { sel: '#view-login .au-view-wrap, #view-signup .au-view-wrap', cls: 'ik-field--auth', mask: 'radial-gradient(ellipse 95% 85% at 50% 50%, #000 40%, transparent 88%)', amp: 0.8, around: '.au-card', fr: 0.85 },
  ];
  function mountFields() {
    if (!window.HTMLCanvasElement) return;
    MOUNTS.forEach(function (m) {
      Array.prototype.forEach.call(document.querySelectorAll(m.sel), function (h) {
        if (h._ikField || h.closest('#view-landing')) return;
        var cs = getComputedStyle(h);
        if (cs.position === 'static') { h.style.position = 'relative'; h.setAttribute('data-ik-pos', ''); }
        h.style.isolation = 'isolate';
        // One field per section, even if a copy of an old canvas is in the markup.
        Array.prototype.forEach.call(h.querySelectorAll('canvas.' + m.cls), function (old) { old.remove(); });
        var c = document.createElement('canvas');
        c.className = 'ik-field ' + m.cls;
        c.setAttribute('aria-hidden', 'true');
        c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0;transition:opacity 1.2s ease;-webkit-mask-image:' + m.mask + ';mask-image:' + m.mask + (m.composite ? ';-webkit-mask-composite:source-in;mask-composite:intersect' : '');
        h.insertBefore(c, h.firstChild);
        if (!c.getContext) return;
        var near = m.around && h.querySelector(m.around);
        h._ikField = add(new Field(c, { tint: VOLT, amp: m.amp == null ? 0.5 : m.amp, focus: near ? function (fl) { var p = rel(near, fl); return p.w ? { x: p.x, y: p.y, r: Math.max(300, p.w * m.fr) } : { x: fl.w / 2, y: fl.h / 2, r: Math.min(fl.w, 900) * 0.42 }; } : function (fl) { return { x: fl.w / 2, y: fl.h * m.fy, r: Math.min(fl.w, 900) * (m.fr || 0.42) }; } }));
      });
    });
  }
  function later(fn) { (window.requestIdleCallback || function (f) { return setTimeout(f, 120); })(fn, { timeout: 1200 }); }
  if (document.readyState === 'complete') later(mountFields); else window.addEventListener('load', function () { later(mountFields); });

  window.IkDotField = { Field: Field, add: add, tick: tick, fields: fields, rel: rel, VOLT: VOLT, reduce: reduceMq, finePointer: finePointer };
})();
