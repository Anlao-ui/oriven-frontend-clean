/* ════════════════════════════════════════════════════════════════
   The six product recordings on the public homepage ("The real product,
   not a mock-up.", #inside) — tools/product-films.js, written into the page
   by tools/product-films-section.js. Replaces the earlier tutorial tabs.

   1. Files: one H.264 screen recording per section of the app
      (assets/films/product/<key>.mp4 + the first frame as <key>.jpg),
      1920×1080, 30 fps, video track only (no sound), faststart, the real
      length listed in tools/product-films.js, small enough for a homepage.
   2. Names: the six sections and their pages are exactly the app's own
      sidebar (js/appNav.js SECTIONS), in the same order.
   3. Not inside the signed-in app: no tutorial gallery or "Watch tutorial"
      buttons (unchanged rule from 2026-11-13).
   4. The homepage (prerendered home.html): six tabs in the app's order; the
      visible tab's recording plays muted and looping once the section is
      on screen, switching tabs switches recordings, Pause/Play works, no
      captions or text tracks, nothing plays with reduced motion, every
      recording loads, "Explore …" links go to existing pages, no sideways
      scrolling on phones.

   SAFE: this test's own static server (follows _redirects like Netlify);
   tests/_fence.js aborts every other request.
   RUN: node tests/product-films.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || undefined;
const LIST = require(path.join(ROOT, 'tools/product-films.js'));
const DIR = path.join(ROOT, 'assets/films/product');
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }

function mp4Info(buf) {
  const s = buf.toString('latin1');
  const mv = s.indexOf('mvhd'); let dur = null;
  if (mv > 0) { const v = buf.readUInt8(mv + 4); const ts = v === 1 ? buf.readUInt32BE(mv + 24) : buf.readUInt32BE(mv + 16); const d = v === 1 ? Number(buf.readBigUInt64BE(mv + 28)) : buf.readUInt32BE(mv + 20); dur = d / ts; }
  const handlers = []; let i = -1; while ((i = s.indexOf('hdlr', i + 1)) > 0) handlers.push(s.substr(i + 12, 4));
  return { dur, handlers, avc: s.includes('avc1'), faststart: s.indexOf('moov') < s.indexOf('mdat'), w: null, h: null };
}
function appSections() {
  const src = fs.readFileSync(path.join(ROOT, 'js/appNav.js'), 'utf8');
  const start = src.indexOf('var SECTIONS = ['), end = src.indexOf('];', start);
  const stub = new Proxy({}, { get: () => () => () => {} });
  const ctx = new Proxy({ window: stub }, { has: () => true, get: (t, k) => (k in t ? t[k] : k === 'undefined' ? undefined : () => () => {}) });
  return vm.runInNewContext('(' + src.slice(start + 'var SECTIONS = '.length, end + 1) + ')', ctx);
}

console.log('\n1. The six recordings');
for (const t of LIST) {
  const mp4 = path.join(DIR, t.key + '.mp4'), jpg = path.join(DIR, t.key + '.jpg');
  const ok = fs.existsSync(mp4) && fs.existsSync(jpg);
  const buf = ok ? fs.readFileSync(mp4) : Buffer.alloc(0), m = ok ? mp4Info(buf) : {};
  // Width, height, frame rate and stream types from ffprobe when it is installed (the recording kit needs it anyway).
  let fps = null;
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate', '-of', 'json', mp4], { encoding: 'utf8' });
  if (probe.status === 0) { const st = JSON.parse(probe.stdout).streams || []; const v = st.find((x) => x.codec_type === 'video') || {}; const [a, b] = String(v.r_frame_rate || '0/1').split('/'); fps = +a / +(b || 1); m.w = v.width; m.h = v.height; m.audio = st.some((x) => x.codec_type === 'audio'); }
  check(`1.${t.n} ${t.key}: recording + poster; H.264 ${m.w}×${m.h}, video only (no sound), faststart, ${m.dur ? m.dur.toFixed(1) : '?'} s (listed ${t.seconds} s), ${(buf.length / 1e6).toFixed(2)} MB${fps ? ', ' + fps + ' fps' : ''}`,
    ok && m.avc && (probe.status !== 0 || (m.w === 1920 && m.h === 1080)) && m.handlers.includes('vide') && !m.handlers.includes('soun') && !m.audio && m.faststart && Math.abs(m.dur - t.seconds) < 0.6 && buf.length < 3e6 && (fps === null || fps === 30), m);
}
check('1.7 exactly six recordings in assets/films/product', fs.readdirSync(DIR).filter((f) => f.endsWith('.mp4')).length === 6);

console.log('\n2. Names = the app');
const SECTIONS = appSections();
const appView = SECTIONS.map((s) => [s.name, s.items.filter((i) => !i.hidden).map((i) => (s.name === 'Campaigns' && i.label === 'Campaigns' ? 'Campaign Studio' : i.label))]);
check('2.1 tools/product-films.js lists the app’s six sections, in its sidebar order, with the pages the sidebar shows (Campaign Studio is labelled “Campaigns” there)', JSON.stringify(LIST.map((t) => [t.name, t.pages])) === JSON.stringify(appView), { list: LIST.map((t) => [t.name, t.pages]), app: appView });
check('2.2 numbered 01–06 in that order', LIST.map((t) => t.n).join() === '01,02,03,04,05,06');

console.log('\n3. Not inside the signed-in app');
const app = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
const appJs = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => [f, fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')]);
check('3.1 app.html: no tutorial gallery container, no tutorial or section-film scripts', !/ccxTutorials|ccx-learn|tutorial-library\.js|section-films\.js/.test(app));
check('3.2 no app script makes a tutorial button or points at tutorial or product films', appJs.filter(([f, s]) => f !== 'landing.js' && /orv-film-btn|data-orv-film|Watch tutorial|assets\/films\/(tutorials|product)/.test(s)).length === 0, appJs.filter(([f, s]) => f !== 'landing.js' && /orv-film-btn|data-orv-film|Watch tutorial|assets\/films\/(tutorials|product)/.test(s)).map(([f]) => f));
check('3.3 the old tutorial generator and list are gone', !fs.existsSync(path.join(ROOT, 'tools/tutorials-section.js')) && !fs.existsSync(path.join(ROOT, 'tools/tutorials-list.js')));

console.log('\n4. The homepage');
const gen = spawnSync(process.execPath, [path.join(ROOT, 'tools/product-films-section.js'), '--check'], { encoding: 'utf8' });
const home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');
check('4.1 written from tools/product-films.js (up to date) and prerendered into home.html; no tutorial tabs or Watch tutorial button left', gen.status === 0 && LIST.every((t) => home.includes('/assets/films/product/' + t.key + '.mp4')) && !/films\/tutorials|Watch tutorial/.test(home), gen.stderr || gen.stdout);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const slash = (x) => (x.length > 1 ? x.replace(/\/+$/, '') : x);
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  const m = rules.find((x) => slash(x[0]) === slash(p) && /^200/.test(x[2] || '')); if (m) p = m[1].split('?')[0];
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (_) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  const st = fs.statSync(f), type = TYPES[path.extname(f)] || 'application/octet-stream', range = q.headers.range;
  if (range && type === 'video/mp4') { const [a, b] = range.replace('bytes=', '').split('-'); const s0 = +a, e0 = b ? +b : st.size - 1; r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s0}-${e0}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e0 - s0 + 1 }); return fs.createReadStream(f, { start: s0, end: e0 }).pipe(r); }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1', async () => {
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  require('./_fence').fenceBrowser(browser, BASE, { backend401: true });
  const errors = [];
  const consent = () => { try { localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: false, at: '2026-11-01T00:00:00.000Z' })); } catch (_) {} };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(consent);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#inside .ik-tab')].map((t) => t.textContent.replace(/^\d+/, '').trim()));
    check('4.2 six tabs in the app’s order, with the app’s names', JSON.stringify(tabs) === JSON.stringify(LIST.map((t) => t.name)), tabs);
    const before = await p.evaluate(() => { const v = document.querySelector('#inside .ik-shot.is-active video'); return { paused: v.paused, preload: [...document.querySelectorAll('#inside video')].map((x) => x.preload) }; });
    check('4.3 nothing plays before the section is on screen; only the first recording preloads its metadata', before.paused && before.preload[0] === 'metadata' && before.preload.slice(1).every((x) => x === 'none'), before);
    await p.evaluate(() => document.getElementById('inside').scrollIntoView({ block: 'center' })); await p.waitForTimeout(2500);
    const play1 = await p.evaluate(() => { const v = document.querySelector('#inside .ik-shot.is-active video'); return { paused: v.paused, t: v.currentTime, muted: v.muted, loop: v.loop, inline: v.playsInline, tracks: document.querySelectorAll('#inside video track').length + [...document.querySelectorAll('#inside video')].reduce((n, x) => n + x.textTracks.length, 0), controls: v.controls, ready: v.readyState, w: v.videoWidth }; });
    check('4.4 on screen, the first tab’s recording plays: muted, looping, inline, no captions or text tracks, no player chrome', !play1.paused && play1.t > 0.3 && play1.muted && play1.loop && play1.inline && play1.tracks === 0 && !play1.controls && play1.w === 1920, play1);
    const loaded = [];
    for (let i = 0; i < LIST.length; i++) {
      await p.click('#inside .ik-tab >> nth=' + i); await p.waitForTimeout(1600);
      loaded.push(await p.evaluate((k) => { const shots = [...document.querySelectorAll('#inside .ik-shot')]; const on = shots.filter((s) => s.classList.contains('is-active')); const v = on[0] && on[0].querySelector('video'); return { key: k, one: on.length === 1, id: on[0] && on[0].id, playing: v && !v.paused && v.currentTime > 0.2, ready: v && v.readyState, others: shots.filter((s) => !s.classList.contains('is-active')).every((s) => s.querySelector('video').paused), name: document.querySelector('[data-ik-shot-name]').textContent, pages: (document.querySelector('.ik-shot__pg.is-active') || {}).textContent, cap: (document.querySelector('.ik-shot__cap.is-active') || {}).getAttribute('href') }; }, LIST[i].key));
    }
    check('4.5 every tab shows and plays its own recording (loaded), the others are paused; the frame and page line name the section and its pages', loaded.every((x, i) => x.one && x.id === 'shot-' + LIST[i].key && x.playing && x.ready >= 2 && x.others && x.name === LIST[i].name && x.pages === LIST[i].pages.join(' · ')), loaded);
    check('4.6 each “Explore …” link goes to the section’s public page, and that page exists', loaded.every((x, i) => x.cap === LIST[i].page && rules.some((r) => r[0] === x.cap)), loaded.map((x) => x.cap));
    await p.click('[data-ik-film-toggle]'); await p.waitForTimeout(400);
    const paused = await p.evaluate(() => { const v = document.querySelector('#inside .ik-shot.is-active video'); const b = document.querySelector('[data-ik-film-toggle]'); return { paused: v.paused, pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label') }; });
    await p.click('#inside .ik-tab >> nth=0'); await p.waitForTimeout(800);
    const stays = await p.evaluate(() => document.querySelector('#inside .ik-shot.is-active video').paused);
    await p.click('[data-ik-film-toggle]'); await p.waitForTimeout(900);
    const resumed = await p.evaluate(() => { const v = document.querySelector('#inside .ik-shot.is-active video'); return { paused: v.paused, pressed: document.querySelector('[data-ik-film-toggle]').getAttribute('aria-pressed') }; });
    check('4.7 Pause stops the recording (aria-pressed, label “Play the recording”), a tab switch keeps it paused, Play resumes it', paused.paused && paused.pressed === 'true' && paused.label === 'Play the recording' && stays && !resumed.paused && resumed.pressed === 'false', { paused, stays, resumed });
    await p.evaluate(() => document.getElementById('faq').scrollIntoView({ block: 'start' })); await p.waitForTimeout(1200);
    check('4.8 scrolled away, the recording pauses', await p.evaluate(() => document.querySelector('#inside .ik-shot.is-active video').paused));
    await ctx.close();

    const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); await rctx.addInitScript(consent);
    const rp = await rctx.newPage(); rp.on('pageerror', (e) => errors.push(e.message));
    await rp.goto(BASE + '/', { waitUntil: 'load' }); await rp.waitForTimeout(1200);
    await rp.evaluate(() => document.getElementById('inside').scrollIntoView({ block: 'center' })); await rp.waitForTimeout(1800);
    const red = await rp.evaluate(() => ({ paused: document.querySelector('#inside .ik-shot.is-active video').paused, label: document.querySelector('[data-ik-film-label]').textContent, poster: document.querySelector('#inside .ik-shot.is-active video').getAttribute('poster') }));
    await rp.click('[data-ik-film-toggle]'); await rp.waitForTimeout(1000);
    const redPlay = await rp.evaluate(() => !document.querySelector('#inside .ik-shot.is-active video').paused);
    check('4.9 reduced motion: nothing starts by itself (the poster frame shows, the button says Play); Play starts it on request', red.paused && red.label === 'Play' && /product\/overview\.jpg$/.test(red.poster) && redPlay, { red, redPlay });
    await rctx.close();

    const lay = {};
    for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
      const c = await browser.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(consent);
      const q = await c.newPage(); q.on('pageerror', (e) => errors.push(e.message));
      await q.goto(BASE + '/', { waitUntil: 'load' }); await q.waitForTimeout(1000);
      await q.evaluate(() => document.getElementById('inside').scrollIntoView({ block: 'center' })); await q.waitForTimeout(1200);
      lay[w] = await q.evaluate(() => { const fr = document.querySelector('#inside .ik-frame').getBoundingClientRect(), v = document.querySelector('#inside .ik-shot.is-active video').getBoundingClientRect(); return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, inFrame: v.left >= fr.left - 1 && v.right <= fr.right + 1, ratio: +(v.width / v.height).toFixed(2), btn: document.querySelector('[data-ik-film-toggle]').getBoundingClientRect().right <= innerWidth }; });
      await c.close();
    }
    check('4.10 phone, tablet, small laptop: the recording fills the frame at 16:9, the Pause button is reachable, no sideways scrolling', Object.values(lay).every((l) => l.overflow <= 0 && l.inFrame && Math.abs(l.ratio - 1.78) < 0.02 && l.btn), lay);
    console.log('\n5. Public section pages: "Watch the overview" plays that section’s recording');
    const res = [];
    for (const t of LIST) {
      const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } }); pg.on('pageerror', (e) => errors.push(t.page + ': ' + e.message));
      await pg.goto(BASE + t.page, { waitUntil: 'load' }); await pg.addStyleTag({ content: '.orv-cc{display:none!important}' }); await pg.waitForTimeout(700);
      const btn = await pg.$('.ov-sp-hero [data-ow-video]');
      if (!btn) { res.push({ p: t.page, btn: false }); await pg.close(); continue; }
      await btn.click(); await pg.waitForTimeout(1600);
      const o = await pg.evaluate(() => { const pl = document.querySelector('.ow-player'); const v = pl && pl.querySelector('video'); return { open: !!pl && pl.classList.contains('is-open'), modal: pl && pl.getAttribute('aria-modal'), title: (document.getElementById('owPlayerTitle') || {}).textContent, src: v && v.currentSrc.replace(location.origin, ''), t: v ? +v.currentTime.toFixed(2) : 0, shown: !!v && [...v.textTracks].some((x) => x.mode === 'showing'), focusIn: !!pl && pl.contains(document.activeElement) }; });
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
      const c = await pg.evaluate(() => { const pl = document.querySelector('.ow-player'); const v = pl.querySelector('video'); return { open: pl.classList.contains('is-open'), stopped: !v.getAttribute('src') && v.paused, focus: document.activeElement && document.activeElement.hasAttribute('data-ow-video') }; });
      res.push({ p: t.page, k: t.key, name: t.name, o, c }); await pg.close();
    }
    check('5.1 every section page has "Watch the overview" in its hero', res.every((r) => r.o), res.filter((r) => !r.o).map((r) => r.p));
    check('5.2 it opens a dialog that plays that section’s current recording (no captions drawn); focus moves into it', res.every((r) => r.o && r.o.open && r.o.modal === 'true' && r.o.src === '/assets/films/product/' + r.k + '.mp4' && r.o.t > 0.3 && !r.o.shown && r.o.focusIn && r.o.title.startsWith(r.name + ': a screen recording')), res.map((r) => r.o));
    check('5.3 Esc closes it, stops the video and returns focus to the button', res.every((r) => r.c && !r.c.open && r.c.stopped && r.c.focus), res.map((r) => r.c));
    check('Z. no page errors', errors.length === 0, errors);
  } catch (e) { console.error(e); fail++; }
  await browser.close(); srv.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
});
