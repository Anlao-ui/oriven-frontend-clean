/* ════════════════════════════════════════════════════════════════
   OrivenAI assistant creatures: six digital beings made of particles.

   One engine, six identities. Every creature shares the same particle
   language (a dense core, a silhouette that carries the identity, a sparse
   orbiting halo for depth, accent + silver ink) and differs in shape,
   structure and motion:
     scout     nucleus with directional scan arcs and observation points
     vector    compass of straight rays, a leading arrow and an instrument ring
     nova      bright core with asymmetric spiral arms throwing off sparks
     metric    mirrored measurement columns that re-sort, on a precise axis
     momentum  forward chevrons with accelerating trails
     flux      a connected trefoil loop, flowing over and under itself

   Shapes live in unit space (radius ≈ 1, y down). The renderer has no loop
   of its own: the page's shared animation loop calls needsFrame()/frame().
   Pointer: particles move away from a fine pointer and ease back. Touch and
   reduced motion get the still or assembling creature, never a jumpy one.
   Also loaded by the landing builder (Node) to draw the small dot glyphs.
   ════════════════════════════════════════════════════════════════ */
(function (g) {
  var TAU = Math.PI * 2, HALO = 9;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(TAU * R()); }
  function ss(a, b, v) { v = (v - a) / (b - a); v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); }
  function adiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

  // Particle store: home x/y, depth z (0 back … 1 front), size s, brightness b,
  // group, two free parameters (u, v) and a phase. Output: x, y, light l.
  function Store() { this.n = 0; this.hx = []; this.hy = []; this.z = []; this.s = []; this.b = []; this.g = []; this.u = []; this.v = []; this.ph = []; }
  Store.prototype.add = function (x, y, z, s, b, grp, u, v, ph) {
    this.hx.push(x); this.hy.push(y); this.z.push(z); this.s.push(s); this.b.push(b); this.g.push(grp);
    this.u.push(u || 0); this.v.push(v || 0); this.ph.push(ph || 0); this.n++;
  };
  function halo(P, R, n, r0, r1) {
    for (var i = 0; i < n; i++) { var a = R() * TAU, r = r0 + (r1 - r0) * Math.sqrt(R()); P.add(Math.cos(a) * r, Math.sin(a) * r, .05 + R() * .3, .7 + R() * .4, .3 + R() * .25, HALO, a, r, R()); }
  }
  function haloMove(P, i, t, o) {
    var dir = P.ph[i] > .5 ? 1 : -1, a = P.u[i] + t * (.025 + P.ph[i] * .03) * dir, r = P.v[i] * (1 + .03 * Math.sin(t * .6 + P.ph[i] * 9));
    o.x = Math.cos(a) * r; o.y = Math.sin(a) * r; o.l = P.b[i] * (.55 + .45 * Math.sin(t * .8 + P.ph[i] * 11));
  }

  // ── The six shapes ────────────────────────────────────────────────
  var K = {};

  // Scout: a focused nucleus looking up and to the right, three scan arcs in
  // the direction it looks, and small observation points around it.
  var GAZE = -.62, SC = [-.08, .08];
  K.scout = {
    core: [SC[0], SC[1], .5], shimmer: 1,
    build: function (P, R, q) {
      var i, a, r;
      for (i = 0; i < 74 * q; i++) { a = R() * TAU; r = .17 * Math.pow(R(), .6); P.add(SC[0] + Math.cos(a) * r, SC[1] + Math.sin(a) * r, .7 + R() * .3, .85 + R() * .35, .7 + R() * .3, 0, a, r); }
      var nr = Math.round(40 * q); for (i = 0; i < nr; i++) { a = i / nr * TAU; P.add(0, 0, .6, .75, .5, 1, a, .3); }
      [[.56, 2.4, .78], [.77, 1.8, .64], [.97, 1.2, .5]].forEach(function (arc, k) {
        var n = Math.round(arc[0] * 78 * q);
        for (var j = 0; j < n; j++) { var aa = GAZE - arc[1] / 2 + arc[1] * j / (n - 1); P.add(0, 0, .55 - k * .08, .9, arc[2], 2, aa, arc[0], k); }
      });
      [[-1.65, .6], [-.2, 1.08], [.5, .7], [1.25, .9], [2.35, .66], [3.05, .97], [-2.45, .86], [.95, .42]].forEach(function (pt, k) {
        var cx = SC[0] + Math.cos(pt[0]) * pt[1], cy = SC[1] + Math.sin(pt[0]) * pt[1];
        for (var j = 0; j < 5 * q + 1; j++) P.add(cx + gauss(R) * .026, cy + gauss(R) * .026, .5 + R() * .4, .8, .65, 3, 0, 0, k / 8);
      });
      halo(P, R, 46 * q, .35, 1.1);
    },
    move: function (P, i, t, o) {
      var gp = P.g[i], beam = GAZE + Math.sin(t * .55) * .95, br = 1 + .045 * Math.sin(t * 1.2), lx = SC[0] + Math.cos(beam) * .03, ly = SC[1] + Math.sin(beam) * .03;
      if (gp === 0) { o.x = lx + Math.cos(P.u[i]) * P.v[i] * br; o.y = ly + Math.sin(P.u[i]) * P.v[i] * br; o.l = P.b[i]; }
      else if (gp === 1) { var a = P.u[i] + t * .16; o.x = lx + Math.cos(a) * .3 * br; o.y = ly + Math.sin(a) * .3 * br; o.l = P.b[i] * (.7 + .3 * Math.cos(adiff(a, beam))); }
      else if (gp === 2) { var d = adiff(P.u[i], beam), k = Math.exp(-d * d / .05); var rr = P.v[i] + k * .04; o.x = SC[0] + Math.cos(P.u[i]) * rr; o.y = SC[1] + Math.sin(P.u[i]) * rr; o.l = P.b[i] + k * .55; }
      else if (gp === 3) { o.x = P.hx[i] + Math.sin(t * .5 + P.ph[i] * 20) * .01; o.y = P.hy[i] + Math.cos(t * .45 + P.ph[i] * 20) * .01; o.l = P.b[i] * (.5 + .5 * Math.sin(t * 1.4 + P.ph[i] * 13)); }
      else haloMove(P, i, t, o);
    },
  };

  // Vector: a compass. Straight rays of evenly spaced particles, one long
  // leading ray with an arrowhead (up and to the right), a lattice diamond at
  // the centre and a slowly turning instrument ring with ticks.
  var VDIR = -Math.PI / 4, VLEN = [.98, .4, .6, .4, .52, .4, .6, .4];
  K.vector = {
    core: [0, 0, .42], shimmer: .5,
    build: function (P, R, q) {
      var i, j;
      for (i = -4; i <= 4; i++) for (j = -4; j <= 4; j++) if (Math.abs(i) + Math.abs(j) <= 4) P.add(i * .042, j * .042, .9, .85, .95 - (Math.abs(i) + Math.abs(j)) * .07, 0);
      VLEN.forEach(function (len, k) {
        var step = q < .8 ? .056 : .04, rows = k === 0 ? [-.02, .02] : [0];
        rows.forEach(function (off) { for (var r = .24; r <= len + 1e-6; r += step) P.add(0, 0, k === 0 ? .85 : .6, k === 0 ? .95 : .8, k === 0 ? .85 : .72, 1, r / len, off, k); });
      });
      [1, -1].forEach(function (sd) { for (var r = .05; r <= .24; r += .048) P.add(0, 0, .85, .95, .85, 2, r, sd); });
      var nr = Math.round(64 * q); for (i = 0; i < nr; i++) P.add(0, 0, .45, .6, .42, 3, i / nr * TAU, .76);
      for (i = 0; i < 12; i++) for (j = 0; j < 3; j++) P.add(0, 0, .6, .75, .66, 3, i / 12 * TAU + .0001, .8 + j * .045);
      halo(P, R, 30 * q, .5, 1.1);
    },
    move: function (P, i, t, o) {
      var gp = P.g[i];
      if (gp === 0) { var br = 1 + .035 * Math.sin(t * 1.3); o.x = P.hx[i] * br; o.y = P.hy[i] * br; o.l = P.b[i]; return; }
      if (gp === 1 || gp === 2) {
        var k = gp === 2 ? 0 : P.ph[i], len = VLEN[k], ang = VDIR + k * Math.PI / 4, u = gp === 2 ? 1 : P.u[i];
        var pulse = ((t * .3 + k * .37) % 1.6), e = Math.exp(-(u - pulse) * (u - pulse) / .006);
        if (gp === 1) { var r = u * len + e * .03, off = P.v[i]; o.x = Math.cos(ang) * r - Math.sin(ang) * off; o.y = Math.sin(ang) * r + Math.cos(ang) * off; o.l = P.b[i] + e * .6; return; }
        // arrowhead: two short strokes back from the tip of the leading ray
        var tip = len + .02 + e * .03, back = ang + Math.PI + P.v[i] * .5;
        o.x = Math.cos(ang) * tip + Math.cos(back) * P.u[i]; o.y = Math.sin(ang) * tip + Math.sin(back) * P.u[i]; o.l = P.b[i] + e * .5; return;
      }
      if (gp === 3) { var a = P.u[i] + t * .05; o.x = Math.cos(a) * P.v[i]; o.y = Math.sin(a) * P.v[i]; o.l = P.b[i] * (.75 + .25 * Math.cos(adiff(a, VDIR))); return; }
      haloMove(P, i, t, o);
    },
  };

  // Nova: a lively off-centre core with five asymmetric spiral arms of
  // different lengths, breathing slightly, with sparks leaving the tips.
  var NC = [-.1, .08], ARMS = [[-1.75, .98, .9], [-.72, .74, .7], [.25, .92, 1.0], [1.45, .56, .6], [2.55, .78, .8]];
  K.nova = {
    core: [NC[0], NC[1], .55], shimmer: 1.2,
    build: function (P, R, q) {
      var i;
      for (i = 0; i < 104 * q; i++) { var a = R() * TAU, r = .17 * Math.pow(R(), .7); P.add(NC[0] + Math.cos(a) * r, NC[1] + Math.sin(a) * r, .7 + R() * .3, .85 + R() * .4, .75 + R() * .25, 0); }
      ARMS.forEach(function (arm, k) {
        var n = Math.round(arm[1] * 76 * q);
        for (var j = 0; j < n; j++) { var s = Math.pow(R(), .75); P.add(0, 0, .4 + R() * .6, .75 + R() * .4, .95 - .5 * s, 1, s, (R() - .5) * .17 * (.3 + s), k); }
      });
      for (i = 0; i < 36 * q; i++) P.add(0, 0, .5 + R() * .4, .7, .8, 2, R(), (R() - .5) * .3, Math.floor(R() * 5));
      halo(P, R, 34 * q, .4, 1.1);
    },
    move: function (P, i, t, o) {
      var gp = P.g[i];
      if (gp === 0) { var br = 1 + .06 * Math.sin(t * 1.6); o.x = NC[0] + (P.hx[i] - NC[0]) * br; o.y = NC[1] + (P.hy[i] - NC[1]) * br; o.l = P.b[i]; return; }
      if (gp === 1 || gp === 2) {
        var k = P.ph[i], arm = ARMS[k], rot = t * .05, s, fade = 1;
        if (gp === 1) s = P.u[i]; else { var u = (P.u[i] + t * .11) % 1; s = 1 + u * .32; fade = (1 - u) * ss(0, .1, u); }
        var breath = 1 + .055 * Math.sin(t * .9 + k * 1.3), curl = arm[2] + .07 * Math.sin(t * .7 + k);
        var ang = arm[0] + rot + curl * Math.min(s, 1.2), rad = (.15 + s * arm[1]) * breath, px = -Math.sin(ang), py = Math.cos(ang), sp = P.v[i];
        o.x = NC[0] + Math.cos(ang) * rad + px * sp; o.y = NC[1] + Math.sin(ang) * rad + py * sp; o.l = P.b[i] * fade; return;
      }
      haloMove(P, i, t, o);
    },
  };

  // Metric: thirteen measurement columns mirrored on a precise axis, with
  // peak markers and corner brackets. The columns re-sort between patterns
  // while a reading line passes over them.
  var MC = 13, MS = 9, MSTEP = .052;
  var MPAT = [
    function (c) { return .12 + .86 * Math.exp(-Math.pow((c - 6) / 3.1, 2)); },
    function (c) { return .16 + .8 * (c / 12); },
    function (c) { return .3 + .6 * Math.abs(Math.sin(c * .92 + .4)); },
    function (c) { return [.42, .7, .28, .9, .55, .35, .98, .5, .3, .78, .62, .4, .22][c]; },
  ];
  function mHeight(c, t) { var cyc = t / 3.4, a = Math.floor(cyc) % MPAT.length, f = ss(.55, 1, cyc - Math.floor(cyc)); return MPAT[a](c) * (1 - f) + MPAT[(a + 1) % MPAT.length](c) * f; }
  function mx(c) { return -.84 + c * (1.68 / (MC - 1)); }
  K.metric = {
    core: [0, 0, .7], shimmer: .25,
    build: function (P, R, q) {
      var c, k;
      for (c = 0; c < MC; c++) for (k = 1; k <= MS; k++) { P.add(0, 0, .75, .95, .9, 0, c, k); P.add(0, 0, .75, .95, .9, 0, c, -k); }
      for (var x = -.98; x <= .98 + 1e-6; x += q < .8 ? .05 : .035) P.add(x, 0, .5, .6, .45, 1);
      for (c = 0; c < MC; c++) { P.add(0, 0, .8, .8, .7, 2, c, 1); P.add(0, 0, .8, .8, .7, 2, c, -1); }
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (cr) {
        for (k = 0; k < 4; k++) { P.add(cr[0] * (1.0 - k * .05), cr[1] * .66, .5, .7, .45, 3); if (k) P.add(cr[0] * 1.0, cr[1] * (.66 - k * .05), .5, .7, .45, 3); }
      });
      halo(P, R, 16 * q, .7, 1.12);
    },
    move: function (P, i, t, o) {
      var gp = P.g[i], scan = -1.1 + ((t * .22) % 1) * 2.2;
      if (gp === 0 || gp === 2) {
        var c = P.u[i], x = mx(c), hs = mHeight(c, t) * MS, e = Math.exp(-(x - scan) * (x - scan) / .012), sg = P.v[i] > 0 ? 1 : -1;
        if (gp === 2) { o.x = x; o.y = -sg * (hs * MSTEP + .07); o.l = P.b[i] * .9 + e * .3; return; }
        var k = Math.abs(P.v[i]), over = k - hs; // slots above the current height fold into the tip and fade
        o.x = x; o.y = -sg * Math.min(k, hs) * MSTEP; o.l = (over > 0 ? P.b[i] * Math.max(0, 1 - over) : P.b[i] * (.55 + .45 * (k / MS))) + e * .35; return;
      }
      if (gp === 1) { var d = P.hx[i] - scan; o.x = P.hx[i]; o.y = 0; o.l = P.b[i] + Math.exp(-d * d / .004) * .5; return; }
      if (gp === 3) { o.x = P.hx[i]; o.y = P.hy[i]; o.l = P.b[i]; return; }
      haloMove(P, i, t, o);
    },
  };

  // Momentum: a bold forward chevron with two echoes behind it, and trails
  // whose particles speed up as they travel toward the front.
  var MOM = [[.6, 1, .95, 3], [.26, .84, .62, 1], [-.06, .68, .38, 1]];
  K.momentum = {
    core: [.45, 0, .5], shimmer: .8,
    build: function (P, R, q) {
      MOM.forEach(function (cv, k) {
        var rows = cv[3], step = q < .8 ? .07 : .052;
        for (var row = 0; row < rows; row++) for (var sd = -1; sd <= 1; sd += 2) for (var d = sd > 0 ? 0 : step; d <= .62 * cv[1] + 1e-6; d += step) P.add(0, 0, .9 - k * .2, k ? .8 : 1, cv[2], 0, d, (row - (rows - 1) / 2) * .034, k + sd * 10);
      });
      var lines = [-.3, -.2, -.1, 0, .1, .2, .3];
      lines.forEach(function (y, k) { var n = Math.round((18 - Math.abs(y) * 22) * q); for (var j = 0; j < n; j++) P.add(0, y, .5 + R() * .3, .7, .7, 1, j / n, .7 - Math.abs(y) * .9, k); });
      for (var i = 0; i < 8 * q; i++) P.add(.72 + R() * .22, (R() - .5) * .2, .7, .6, .7, 2, 0, 0, R());
      halo(P, R, 22 * q, .6, 1.1);
    },
    move: function (P, i, t, o) {
      var gp = P.g[i], stride = Math.sin(t * 2.1);
      if (gp === 0) {
        var code = P.ph[i], sd = code > 5 ? 1 : -1, k = code - sd * 10, cv = MOM[k], push = Math.max(0, Math.sin(t * 2.1 - k * .7)) * .035;
        var ang = Math.PI - sd * .72, d = P.u[i], off = P.v[i];
        o.x = cv[0] + push + Math.cos(ang) * d + off; o.y = Math.sin(ang) * d; o.l = P.b[i] + push * 4; return;
      }
      if (gp === 1) { var u = (P.u[i] + t * (.16 + P.v[i] * .1)) % 1, x = -1 + Math.pow(u, 1.7) * 1.02; o.x = x; o.y = P.hy[i]; o.l = P.b[i] * ss(0, .35, u) * (1 - ss(.85, 1, u)); return; }
      if (gp === 2) { var f = (t * .8 + P.ph[i]) % 1; o.x = P.hx[i] + f * .12; o.y = P.hy[i]; o.l = P.b[i] * (1 - f) * (.5 + .5 * stride); return; }
      haloMove(P, i, t, o);
    },
  };

  // Flux: a trefoil loop drawn as a ribbon of three strands. Particles flow
  // along it, depth makes it pass over and under itself, the loop slowly
  // changes shape, and neighbours are linked, so it reads as one system.
  function trefoil(u, a2, rot, out) {
    var x = (Math.sin(u) + a2 * Math.sin(2 * u)) / 3.45, y = (Math.cos(u) - a2 * Math.cos(2 * u)) / 3.45, c = Math.cos(rot), s = Math.sin(rot);
    out.x = x * c - y * s; out.y = x * s + y * c + .04; out.z = -Math.sin(3 * u);
  }
  var FT = { x: 0, y: 0, z: 0 }, FT2 = { x: 0, y: 0, z: 0 };
  K.flux = {
    links: true, core: [0, .04, .5], shimmer: .7,
    build: function (P, R, q) {
      var n = Math.round(130 * q), j;
      for (j = 0; j < n; j++) P.add(0, 0, .5, .95, .95, 0, j / n * TAU, 0);
      [-.034, .034].forEach(function (off) { var m = Math.round(96 * q); for (var j2 = 0; j2 < m; j2++) P.add(0, 0, .5, .75, .62, 0, j2 / m * TAU + .02, off); });
      for (var k = 0; k < 3; k++) for (j = 0; j < 10 * q + 2; j++) P.add(0, 0, .8, .95, .9, 1, k, gauss(R) * .035, gauss(R) * .035);
      halo(P, R, 28 * q, .5, 1.1);
    },
    move: function (P, i, t, o) {
      var gp = P.g[i], a2 = 2 + .2 * Math.sin(t * .4), rot = t * .04;
      if (gp === 0) {
        var u = P.u[i] + t * .12; trefoil(u, a2, rot, FT); trefoil(u + .01, a2, rot, FT2);
        var dx = FT2.x - FT.x, dy = FT2.y - FT.y, dl = Math.sqrt(dx * dx + dy * dy) || 1, off = P.v[i];
        o.x = FT.x - dy / dl * off; o.y = FT.y + dx / dl * off; o.z = .5 + FT.z * .45; o.l = P.b[i] * (.6 + .4 * (FT.z * .5 + .5)); return;
      }
      if (gp === 1) { // three hubs riding the outer lobes
        var lu = P.u[i] * TAU / 3 + Math.PI; trefoil(lu, a2, rot, FT); var pul = .5 + .5 * Math.sin(t * 1.5 + P.u[i] * 2);
        o.x = FT.x + P.v[i] * (1 + pul * .3); o.y = FT.y + P.ph[i] * (1 + pul * .3); o.l = P.b[i] * (.7 + .3 * pul); return;
      }
      haloMove(P, i, t, o);
    },
  };

  function build(kind, q, seed) {
    var P = new Store(), R = rng(seed || 11);
    K[kind].build(P, R, q || 1);
    var n = P.n;
    P.x = new Float32Array(n); P.y = new Float32Array(n); P.l = new Float32Array(n); P.zz = new Float32Array(n);
    P.sx = new Float32Array(n); P.sy = new Float32Array(n); // assembly scatter
    for (var i = 0; i < n; i++) { var a = R() * TAU, d = .45 + R() * .8; P.sx[i] = Math.cos(a) * d; P.sy[i] = Math.sin(a) * d; }
    return P;
  }

  // ── Renderer ──────────────────────────────────────────────────────
  // opts: { color: [r,g,b], reduce: mediaQueryList, fine: mediaQueryList, onNeed: fn }
  var NEUTRAL = [200, 203, 193];
  function Creature(canvas, kind, opts) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.kind = kind; this.def = K[kind]; this.o = opts || {};
    this.color = (this.o.color || [234, 253, 19]).slice();
    this.visible = true; this.drawn = false; this.lite = false; this.frameN = 0;
    this.ptr = { x: 0, y: 0, sx: 0, sy: 0, s: 0, to: 0, seen: false };
    this.asm = 1; this.asmFrom = 0; this.asmAt = 0;
    this.layout();
  }
  Creature.prototype.reduced = function () { return !!(this.o.reduce && this.o.reduce.matches); };
  Creature.prototype.layout = function () {
    var w = this.c.clientWidth, h = this.c.clientHeight; // layout size: ignores CSS transforms on the stage
    if (!w || !h) { this.w = 0; return; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = h; this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var q = w < 180 ? .55 : w < 300 ? .8 : 1;
    if (!this.P || this.q !== q) { this.q = q; this.P = build(this.kind, q, 11 + this.kind.length * 7); this.ox = new Float32Array(this.P.n); this.oy = new Float32Array(this.P.n); }
    this.S = Math.min(w, h) * .42; this.cx = w / 2; this.cy = h / 2;
  };
  // Pointer in client coordinates; the canvas may be scaled by its stage.
  Creature.prototype.pointer = function (cx, cy, on) {
    var p = this.ptr;
    if (!on) { p.to = 0; return; }
    var r = this.c.getBoundingClientRect(); if (!r.width) return;
    p.x = (cx - r.left) * (this.w / r.width); p.y = (cy - r.top) * (this.h / r.height); p.to = 1;
    if (!p.seen) { p.sx = p.x; p.sy = p.y; p.seen = true; }
  };
  // Particles gather from a loose cloud into the creature.
  Creature.prototype.assemble = function (from) { if (this.reduced()) { this.asm = 1; return; } this.asmFrom = from == null ? 0 : from; this.asm = this.asmFrom; this.asmAt = performance.now(); };
  Creature.prototype.settling = function () { var P = this.ptr; return P.to > 0 || P.s > .004 || this.offs > .05; };
  Creature.prototype.needsFrame = function () {
    if (!this.visible || !this.w) return false;
    if (!this.drawn || this.asm < 1 || this.settling()) return true;
    return !this.reduced() && !document.hidden;
  };
  Creature.prototype.frame = function (now) {
    if (!this.w) return;
    if (this.lite && this.drawn && this.asm >= 1 && !this.settling() && (this.frameN++ & 1)) return; // side figures: half rate
    var still = this.reduced(), t = still ? 2.4 : now / 1000, P = this.P, n = P.n, def = this.def, ctx = this.ctx;
    var S = this.S, cx = this.cx, cy = this.cy, out = { x: 0, y: 0, l: 0, z: -1 };
    if (this.asm < 1) { var e = (now - this.asmAt) / 1100; this.asm = e >= 1 ? 1 : this.asmFrom + (1 - this.asmFrom) * e; }
    var A = this.asm >= 1 ? 1 : 1 - Math.pow(1 - this.asm, 3), scat = 1 - A;
    var p = this.ptr; p.s += (p.to - p.s) * .12; p.sx += (p.x - p.sx) * .25; p.sy += (p.y - p.sy) * .25;
    var R = S * .42, R2 = R * R, PUSH = S * .075, SWIRL = S * .045, ps = p.s, ox = this.ox, oy = this.oy, offs = 0;
    var base = Math.max(.8, Math.min(2.5, S / 84)), shim = (def.shimmer || 0) * S * .005;
    var B = []; for (var b = 0; b < 16; b++) B.push([]);
    var links = def.links ? [] : null;
    for (var i = 0; i < n; i++) {
      out.z = -1; def.move(P, i, t, out);
      var z = out.z >= 0 ? out.z : P.z[i];
      var x = cx + (out.x + P.sx[i] * scat) * S, y = cy + (out.y + P.sy[i] * scat) * S;
      if (shim) { x += Math.sin(t * 1.3 + i * 1.71) * shim; y += Math.cos(t * 1.1 + i * 2.37) * shim; } // alive, never still
      // Move away from the pointer: the target comes from the particle's own
      // place, never its displaced one, so the motion is smooth and returns.
      var tx = 0, ty = 0, lift = 0;
      if (ps > .004) {
        var dx = x - p.sx, dy = y - p.sy, d2 = dx * dx + dy * dy;
        if (d2 < R2) { // part like water: a gentle push outward plus a slight swirl, so no hard-edged hole opens
          var dd = Math.sqrt(d2) || .001, k = 1 - dd / R; k = k * k * (3 - 2 * k) * ps;
          var nx = dx / dd, ny = dy / dd;
          tx = (nx * PUSH - ny * SWIRL) * k; ty = (ny * PUSH + nx * SWIRL) * k; lift = k;
        }
      }
      ox[i] += (tx - ox[i]) * .16; oy[i] += (ty - oy[i]) * .16; offs += Math.abs(ox[i]) + Math.abs(oy[i]);
      x += ox[i]; y += oy[i];
      var l = out.l * A + lift * .25; if (l <= .02) continue;
      var a = l * (.55 + .45 * z); if (a > 1) a = 1;
      var r = base * P.s[i] * (.55 + .6 * z);
      var halo = P.g[i] === HALO || z < .2;
      B[Math.min(7, Math.floor(a * 8)) + (halo ? 8 : 0)].push(x, y, r);
      if (links && P.g[i] === 0 && P.v[i] === 0) links.push(x, y);
    }
    this.offs = offs / (n || 1);
    ctx.clearRect(0, 0, this.w, this.h);
    if (def.core) { // soft inner light, so the particles read as one body
      var gx = cx + def.core[0] * S, gy = cy + def.core[1] * S, gr = def.core[2] * S, gd = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      gd.addColorStop(0, 'rgba(' + this.color.join(',') + ',' + (.16 * A).toFixed(3) + ')'); gd.addColorStop(1, 'rgba(' + this.color.join(',') + ',0)');
      ctx.fillStyle = gd; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    if (links && links.length > 4) {
      ctx.strokeStyle = 'rgba(' + this.color.join(',') + ',' + (.2 * A).toFixed(3) + ')'; ctx.lineWidth = Math.max(.6, base * .45); ctx.beginPath();
      var maxD = S * .16, md2 = maxD * maxD;
      for (var j = 0; j < links.length; j += 2) { var j2 = (j + 2) % links.length, ddx = links[j2] - links[j], ddy = links[j2 + 1] - links[j + 1]; if (ddx * ddx + ddy * ddy < md2) { ctx.moveTo(links[j], links[j + 1]); ctx.lineTo(links[j2], links[j2 + 1]); } }
      ctx.stroke();
    }
    for (var bi = 0; bi < 16; bi++) {
      var arr = B[bi]; if (!arr.length) continue;
      var col = bi >= 8 ? NEUTRAL : this.color, al = ((bi % 8) + .7) / 8 * (bi >= 8 ? .7 : 1);
      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + al.toFixed(3) + ')';
      ctx.beginPath();
      for (var m = 0; m < arr.length; m += 3) { ctx.moveTo(arr[m] + arr[m + 2], arr[m + 1]); ctx.arc(arr[m], arr[m + 1], arr[m + 2], 0, TAU); }
      ctx.fill();
    }
    if (!this.drawn) { this.drawn = true; this.c.classList.add('is-on'); }
  };

  // ── Small glyphs (24 × 24): the same silhouettes, as a few solid dots ──
  // Returns [x, y, r, opacity] per dot; used for labels, chips and the
  // no-JavaScript fallback.
  function arcDots(cx, cy, r, a0, a1, n, rad, op) { var o = []; for (var i = 0; i < n; i++) { var a = a0 + (a1 - a0) * (n === 1 ? .5 : i / (n - 1)); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, rad, op]); } return o; }
  function lineDots(x0, y0, x1, y1, n, rad, op) { var o = []; for (var i = 0; i < n; i++) { var f = n === 1 ? 0 : i / (n - 1); o.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, rad, op]); } return o; }
  var GL = {
    scout: function () {
      var c = [9, 15], g = GAZE;
      return [[c[0], c[1], 2.7, 1]].concat(arcDots(c[0], c[1], 6.6, g - .95, g + .95, 4, 1.3, .9), arcDots(c[0], c[1], 11.4, g - .62, g + .62, 3, 1.35, .7), [[3.2, 6.2, 1.05, .5], [3.6, 21.2, .95, .4]]);
    },
    vector: function () {
      return [[10, 14, 2.2, 1], [13.6, 10.4, 1.35, .95], [16.6, 7.4, 1.35, .95], [20, 4, 1.6, 1], [16.4, 4, 1.25, .85], [20, 7.6, 1.25, .85],
        [5, 14, 1.05, .55], [10, 19.4, 1.05, .55], [6.4, 17.6, 1.05, .45], [10, 8.6, 1.05, .45], [15.2, 14, 1.05, .45]];
    },
    nova: function () {
      var c = [10.6, 13.4], o = [[c[0], c[1], 2.9, 1]];
      [[-1.75, 9.6, .9], [-.72, 7.4, .7], [.25, 9.2, 1], [1.45, 6, .6], [2.55, 7.8, .8]].forEach(function (a) {
        for (var j = 1; j <= 2; j++) { var s = j / 2, ang = a[0] + a[2] * s, rad = 3.4 + s * (a[1] - 3.2); o.push([c[0] + Math.cos(ang) * rad, c[1] + Math.sin(ang) * rad, 1.5 - s * .45, 1 - s * .35]); }
      });
      return o.concat([[21, 3.4, .9, .5]]);
    },
    metric: function () {
      var o = [];
      [1, 2, 3, 2, 1].forEach(function (h, c) { var x = 4 + c * 4; o.push([x, 12, 1.25, .9]); for (var k = 1; k <= h; k++) { var op = .6 + .4 * k / 3; o.push([x, 12 - k * 3.3, 1.25, op], [x, 12 + k * 3.3, 1.25, op]); } });
      return o;
    },
    momentum: function () {
      return lineDots(19.4, 12, 13, 5.6, 3, 1.6, 1).concat(lineDots(19.4, 12, 13, 18.4, 3, 1.6, 1).slice(1),
        lineDots(12.6, 12, 8.6, 8, 2, 1.2, .6), lineDots(12.6, 12, 8.6, 16, 2, 1.2, .6).slice(1), [[4.6, 12, 1.05, .4], [2.4, 9.2, .85, .25], [2.4, 14.8, .85, .25]]);
    },
    flux: function () {
      var o = [], pt = { x: 0, y: 0, z: 0 };
      for (var j = 0; j < 12; j++) { trefoil(j / 12 * TAU + .26, 2, 0, pt); o.push([12 + pt.x * 10.6, 12 + pt.y * 10.6 - .4, .95 + (pt.z * .5 + .5) * .4, .55 + (pt.z * .5 + .5) * .4]); }
      for (var k = 0; k < 3; k++) { trefoil(k * TAU / 3 + Math.PI, 2, 0, pt); o.push([12 + pt.x * 10.6, 12 + pt.y * 10.6 - .4, 1.9, 1]); }
      return o;
    },
  };
  function glyph(kind) { return GL[kind]().map(function (d) { return d.map(function (v) { return Math.round(v * 100) / 100; }); }); }

  var api = { kinds: ['scout', 'vector', 'nova', 'momentum', 'metric', 'flux'], build: build, Creature: Creature, glyph: glyph };
  if (typeof module === 'object' && module.exports) module.exports = api; else g.IkCreatures = api;
})(typeof window !== 'undefined' ? window : this);
