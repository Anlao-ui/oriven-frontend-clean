/* ════════════════════════════════════════════════════════════════
   Login and Sign Up: the landing hero's dot field behind the form.

   Checks that both screens reuse the one engine (js/dot-field.js), that the
   field never gets in the way of the form (no pointer events, under the card,
   the card stays opaque), that there is one canvas per screen and one shared
   animation loop that stops when nothing is visible, that a fine pointer
   moves the dots while touch / reduced motion fall back to a calm (or still)
   field, and that nothing overflows or shifts.

   The form itself is never submitted: no sign-in, no sign-up, no reset mail.
   SAFE: this test's own static server only; tests/_fence.js aborts every
   other request (Supabase, localhost:5500, Render, orivenai.com).
   RUN: node tests/auth-background.test.js
   ════════════════════════════════════════════════════════════════ */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT = 8961, BASE = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }

const app = express();
const spa = (q, r) => r.sendFile(path.join(ROOT, 'index.html'));
app.get(['/', '/login', '/signup'], spa);
app.use(express.static(ROOT));

// Counts the engine's frames per canvas (installed after the engine loads).
const COUNT = () => {
  const F = window.IkDotField && window.IkDotField.Field; if (!F || F.prototype._counted) return;
  const orig = F.prototype.frame; F.prototype._counted = true;
  window.__frames = {};
  F.prototype.frame = function (now) { const k = this.c.className.replace('is-on', '').trim(); window.__frames[k] = (window.__frames[k] || 0) + 1; return orig.call(this, now); };
};
const frames = (page) => page.evaluate(() => Object.assign({}, window.__frames || {}));

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const fence = require('./_fence').fenceBrowser(browser, BASE, { backend401: true });
  const errors = [];
  try {
    // ── 1. Login ─────────────────────────────────────────────────────
    console.log('\n1. Login');
    let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => errors.push('login: ' + e.message));
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('view-login') && getComputedStyle(document.getElementById('view-login')).display !== 'none', null, { timeout: 15000 });
    await page.waitForFunction(() => !!document.querySelector('#view-login canvas.ik-field--auth.is-on'), null, { timeout: 15000 });
    await page.evaluate(COUNT);
    await page.waitForTimeout(1300);
    const L = await page.evaluate(() => {
      const wrap = document.querySelector('#view-login .au-view-wrap'), c = wrap.querySelector('canvas.ik-field--auth'), cs = getComputedStyle(c), card = wrap.querySelector('.au-card');
      const inp = document.getElementById('auEmailLogin').getBoundingClientRect(), btn = document.getElementById('auSubmitLogin').getBoundingClientRect(), r = card.getBoundingClientRect();
      const hit = (el) => { const b = el.getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); };
      return {
        canvases: wrap.querySelectorAll('canvas').length, pe: cs.pointerEvents, z: cs.zIndex, aria: c.getAttribute('aria-hidden'), first: wrap.firstElementChild === c, iso: getComputedStyle(wrap).isolation,
        hitInput: hit(document.getElementById('auEmailLogin')) === document.getElementById('auEmailLogin'), hitBtn: hit(document.getElementById('auSubmitLogin')) === document.getElementById('auSubmitLogin'),
        hitForgot: hit(document.getElementById('auForgotLink')) === document.getElementById('auForgotLink'),
        cardBg: getComputedStyle(card).backgroundColor, card: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, cw: Math.round(c.getBoundingClientRect().width), ww: Math.round(wrap.getBoundingClientRect().width),
        engine: !!window.IkDotField, inLoop: window.IkDotField.fields.filter((f) => /ik-field--auth/.test(f.c.className)).length,
        fn: typeof window.auLogin === 'function' && typeof window.auSignup === 'function' && typeof window.auForgotPassword === 'function',
        tint: (function () { const f = window.IkDotField.fields.find((x) => x.c === c); return f && f.cfg.amp; })(),
      };
    });
    const f1 = await frames(page);
    check('1.1 one field canvas behind the Login screen, from the shared engine (js/dot-field.js), in its single loop', L.engine && L.canvases === 1 && L.first && L.inLoop === 2, L);
    check('1.2 the field is decorative: aria-hidden, no pointer events, painted under everything (z-index -1, isolated wrap)', L.aria === 'true' && L.pe === 'none' && L.z === '-1' && L.iso === 'isolate', L);
    check('1.3 the form is on top: the email field, the Login button and "Forgot password?" receive the clicks', L.hitInput && L.hitBtn && L.hitForgot, L);
    check('1.4 the card stays opaque (the dots never run under the text)', /^rgb\(17, 17, 17\)$/.test(L.cardBg), L.cardBg);
    const card0 = await page.evaluate(() => { const c = document.querySelector('#view-login canvas.ik-field--auth'), card = document.querySelector('#view-login .au-card'); const m = () => { const r = card.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','); }; const a = m(); c.style.display = 'none'; const b = m(); c.style.display = ''; return { a, b }; });
    check('1.5 no layout shift: the field takes no space (the card is in the same place with or without it)', card0.a === card0.b, card0);
    check('1.6 no horizontal overflow; the canvas is exactly as wide as the screen', L.ov <= 0 && L.cw === L.ww, L);
    check('1.7 it is animated (the hero’s waves) and only the visible screen draws: Login yes, the hidden Sign Up field no', (f1['ik-field ik-field--auth'] || 0) >= 8 && (await page.evaluate(() => window.IkDotField.fields.find((f) => f.c.closest('#view-signup')).visible)) === false, f1);
    await page.fill('#auEmailLogin', 'someone@example.invalid'); await page.fill('#auPassLogin', 'not-submitted');
    check('1.8 typing in the form works as before (nothing is submitted by this test)', (await page.inputValue('#auEmailLogin')) === 'someone@example.invalid' && (await page.inputValue('#auPassLogin')) === 'not-submitted');
    check('1.9 the sign-in, sign-up and password reset functions are still the page’s own', L.fn);

    // Pointer: the dots move aside for a fine pointer (the hero's push), also over the card.
    await page.mouse.move(200, 450); await page.waitForTimeout(120); await page.mouse.move(260, 470); await page.waitForTimeout(400);
    const ptr = await page.evaluate(() => { const f = window.IkDotField.fields.find((x) => x.c.closest('#view-login')); return { to: f.ptr.to, s: +f.ptr.s.toFixed(2), x: Math.round(f.ptr.x) }; });
    check('1.10 the dots respond to the mouse (pointer push eases in)', ptr.to === 1 && ptr.s > 0.5 && Math.abs(ptr.x - 260) <= 2, ptr);
    const b = await page.locator('#auSubmitLogin').boundingBox();
    await page.mouse.move(b.x + 20, b.y + 10); await page.waitForTimeout(200);
    check('1.11 …and keep responding with the pointer over the form', await page.evaluate(() => window.IkDotField.fields.find((x) => x.c.closest('#view-login')).ptr.to === 1));
    await page.screenshot({ path: path.join(__dirname, '_shots', 'auth-login-1440.png') }).catch(() => {});

    // ── 2. Sign Up (in-page navigation) and no duplicates ──────────────
    console.log('\n2. Sign Up, switching screens');
    for (let i = 0; i < 3; i++) {
      await page.click('#view-login .au-footer a[href="/signup"]'); await page.waitForTimeout(500);
      await page.click('#view-signup .au-footer a[href="/login"]'); await page.waitForTimeout(500);
    }
    await page.click('#view-login .au-footer a[href="/signup"]'); await page.waitForTimeout(900);
    const S = await page.evaluate(() => ({
      path: location.pathname, shown: getComputedStyle(document.getElementById('view-signup')).display !== 'none',
      canvases: document.querySelectorAll('canvas.ik-field--auth').length, inLoop: window.IkDotField.fields.filter((f) => /ik-field--auth/.test(f.c.className)).length,
      vis: window.IkDotField.fields.filter((f) => /ik-field--auth/.test(f.c.className)).map((f) => (f.c.closest('#view-signup') ? 'signup' : 'login') + ':' + f.visible),
      hit: (function () { const el = document.getElementById('auPassConfirmSignup'), r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el; })(),
      opt: (function () { const el = document.getElementById('auOptInSignup'), r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el; })(),
      drawn: !!document.querySelector('#view-signup canvas.ik-field--auth.is-on'),
    }));
    check('2.1 Sign Up has the same field, drawn', S.path === '/signup' && S.shown && S.drawn, S);
    check('2.2 switching Login ↔ Sign Up seven times adds nothing: still two canvases, two fields in the one loop', S.canvases === 2 && S.inLoop === 2, S);
    check('2.3 only the screen on view is drawn (the other field is paused)', JSON.stringify(S.vis.sort()) === '["login:false","signup:true"]', S.vis);
    check('2.4 the Sign Up form receives clicks (confirm password, the email opt-in)', S.hit && S.opt, S);
    await page.click('#auOptInSignup');
    check('2.5 the opt-in still toggles on click', await page.isChecked('#auOptInSignup'));
    await page.screenshot({ path: path.join(__dirname, '_shots', 'auth-signup-1440.png') }).catch(() => {});

    // Leaving the auth screens: the loop stops for them.
    await page.evaluate(() => window.lpNavigate('/')); await page.waitForTimeout(800);
    const before = await frames(page); await page.waitForTimeout(900); const after = await frames(page);
    check('2.6 on another page the auth fields draw nothing (no loop left running for them)', (after['ik-field ik-field--auth'] || 0) === (before['ik-field ik-field--auth'] || 0), { before, after });
    await page.close();

    // ── 3. Reduced motion ───────────────────────────────────────────
    console.log('\n3. Reduced motion, touch, small screens');
    const rmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const rm = await rmCtx.newPage();
    await rm.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await rm.waitForFunction(() => !!document.querySelector('#view-login canvas.ik-field--auth.is-on'), null, { timeout: 15000 });
    await rm.evaluate(COUNT); await rm.mouse.move(300, 400); await rm.mouse.move(340, 420); await rm.waitForTimeout(1200);
    const rmf = await frames(rm), rmp = await rm.evaluate(() => window.IkDotField.fields.find((x) => x.c.closest('#view-login')).ptr.to);
    check('3.1 prefers-reduced-motion: one still frame, no animation and no pointer motion', (rmf['ik-field ik-field--auth'] || 0) === 0 && rmp === 0, { rmf, rmp });
    await rmCtx.close();

    // ── 4. Touch / no fine pointer, phone width ─────────────────────
    for (const [w, h] of [[390, 844], [768, 1024]]) {
      const tCtx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const t = await tCtx.newPage();
      t.on('pageerror', (e) => errors.push('touch: ' + e.message));
      await t.goto(BASE + '/signup', { waitUntil: 'domcontentloaded' });
      await t.waitForFunction(() => !!document.querySelector('#view-signup canvas.ik-field--auth.is-on'), null, { timeout: 15000 });
      await t.tap('#auEmailSignup'); await t.waitForTimeout(300);
      const T = await t.evaluate(() => ({ fine: window.IkDotField.finePointer.matches, to: window.IkDotField.fields.find((x) => x.c.closest('#view-signup')).ptr.to, focus: document.activeElement && document.activeElement.id,
        ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, card: Math.round(document.querySelector('#view-signup .au-card').getBoundingClientRect().right) <= window.innerWidth }));
      check(`4.${w} touch device (${w}px): calm field without pointer push, a tap focuses the field, no horizontal overflow`, !T.fine && T.to === 0 && T.focus === 'auEmailSignup' && T.ov <= 0 && T.card, T);
      if (w === 390) await t.screenshot({ path: path.join(__dirname, '_shots', 'auth-signup-390.png') }).catch(() => {});
      await tCtx.close();
    }

    check('Z. no JavaScript errors from the dot field', !errors.some((e) => /IkDotField|dot-field|Field|frame/.test(e)), errors);
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); server.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
