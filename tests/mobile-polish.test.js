// ════════════════════════════════════════════════════════════════
// Public site on phones (2026-11-20): the mobile menu opens on every
// public page (it used to work on the homepage only), the workspace's
// lone last block is centred, the tutorial tabs scroll sideways, the
// "one loop" ring bar sticks flush under the navbar, and the footer is
// compact. Local static server only, fenced (tests/_fence.js).
// RUN: node tests/mobile-polish.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8985, BASE = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const check = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + n + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 400))); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.vtt': 'text/vtt' };
const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const slash = (x) => (x.length > 1 ? x.replace(/\/+$/, '') : x);
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, BASE).pathname);
  const m = rules.find((x) => slash(x[0]) === slash(p) && /^200/.test(x[2] || '')); if (m) p = m[1].split('?')[0];
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (_) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
  const browser = await chromium.launch();
  fenceBrowser(browser, BASE);
  const errors = [];
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

  // 1. The mobile menu opens and closes on every public page with a hamburger
  const opened = [];
  for (const pg of ['/', '/demo', '/pricing', '/faq', '/product', '/solutions', '/about', '/blog', '/create', '/case-studies', '/product/google-ads']) {
    const p = await phone.newPage(); p.on('pageerror', (e) => errors.push(pg + ': ' + e.message));
    await p.goto(BASE + pg, { waitUntil: 'load' }); await p.waitForTimeout(1200);
    await p.evaluate(() => { const c = document.querySelector('.orv-cc'); if (c) c.remove(); });
    await p.tap('#lpHamburger'); await p.waitForTimeout(400);
    const open = await p.evaluate(() => { const m = document.getElementById('lpMobileMenu'); return m.classList.contains('open') && getComputedStyle(m).visibility !== 'hidden'; });
    await p.evaluate(() => window.closeMobile && window.closeMobile()); await p.waitForTimeout(300);
    const closed = await p.evaluate(() => !document.getElementById('lpMobileMenu').classList.contains('open'));
    opened.push(pg + '=' + (open && closed ? 'ok' : 'NO'));
    await p.close();
  }
  check('the mobile menu (☰) opens and closes on every public page, not just the homepage', opened.every((x) => /=ok$/.test(x)), opened);

  // 2. Homepage on a phone
  const p = await phone.newPage(); p.on('pageerror', (e) => errors.push('home: ' + e.message));
  await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const c = document.querySelector('.orv-cc'); if (c) c.remove(); });
  const tabs = await p.evaluate(() => { const t = document.querySelector('.ik-tabs'); const before = t.scrollLeft; t.scrollLeft = 400; const after = t.scrollLeft; const fade = getComputedStyle(t).webkitMaskImage || getComputedStyle(t).maskImage; t.scrollLeft = 0; return { sw: t.scrollWidth, cw: t.clientWidth, ox: getComputedStyle(t).overflowX, moved: after > before, fade: /gradient/.test(fade || ''), pageOverflow: document.documentElement.scrollWidth - innerWidth }; });
  check('tutorial tabs: more tabs than fit, and the row scrolls sideways (with an edge fade), no page overflow', tabs.sw > tabs.cw && tabs.ox === 'auto' && tabs.moved && tabs.fade && tabs.pageOverflow <= 0, tabs);
  const base = await p.evaluate(() => document.querySelector('[data-ik-loop]').getBoundingClientRect().top + document.getElementById('view-landing').scrollTop);
  const states = [];
  for (let i = 1; i <= 3; i++) {
    await p.evaluate((y) => { document.getElementById('view-landing').scrollTop = y; }, base - 90 + i * 330); await p.waitForTimeout(400);
    states.push(await p.evaluate(() => { const v = document.querySelector('.ik-loop__visual').getBoundingClientRect(), nav = document.getElementById('lpNav').getBoundingClientRect(), bg = getComputedStyle(document.querySelector('.ik-loop__visual')).backgroundColor; return { top: Math.round(v.top), navB: Math.round(nav.bottom), w: Math.round(v.width), solid: !/rgba\(0, 0, 0, 0\)|transparent/.test(bg) }; }));
  }
  check('one loop: the ring bar sticks flush under the navbar, full width, solid (the sections scroll underneath it)', states.every((s) => s.top === s.navB && s.w >= 388 && s.solid), states);
  const foot = await p.evaluate(() => { const c = document.querySelector('.site-foot__col[aria-label="Company"]'); const cs = getComputedStyle(c); const links = Array.from(c.querySelectorAll('a')).map((a) => Math.round(a.getBoundingClientRect().top)); return { display: cs.display, rows: new Set(links).size, n: links.length, overflow: document.documentElement.scrollWidth - innerWidth }; });
  check('footer: company and legal links as a compact wrapping row (fewer rows than links)', foot.display === 'flex' && foot.rows < foot.n && foot.overflow <= 0, foot);
  await p.close();

  // 3. Two-column phones/tablets: the lone 07 block is centred
  const mid = await browser.newContext({ viewport: { width: 600, height: 900 }, isMobile: true, hasTouch: true });
  const q = await mid.newPage();
  await q.goto(BASE + '/', { waitUntil: 'load' }); await q.waitForTimeout(1200);
  const ws = await q.evaluate(() => { const li = Array.from(document.querySelectorAll('.ik-ws__flow > li')); const flow = document.querySelector('.ik-ws__flow').getBoundingClientRect(); const last = li[li.length - 1].getBoundingClientRect(), first = li[0].getBoundingClientRect(); return { n: li.length, center: Math.round(last.left + last.width / 2), flowCenter: Math.round(flow.left + flow.width / 2), sameWidth: Math.abs(last.width - first.width) < 2 }; });
  check('workspace (two columns): block 07 alone on its row is centred, same width as the others', ws.n === 7 && Math.abs(ws.center - ws.flowCenter) <= 2 && ws.sameWidth, ws);
  await mid.close(); await phone.close();

  await browser.close(); srv.close();
  check('no page errors', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
