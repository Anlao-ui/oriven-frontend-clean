/* ════════════════════════════════════════════════════════════════
   The six product tutorials (assets/films/tutorials) and the "Learn
   OrivenAI" library on the Dashboard (js/tutorial-library.js).

   1. Files: one H.264 film per section, video track only (nothing can play
      with sound), faststart, poster, thumbnail and captions; each film has
      a chapter for EVERY page of its section (js/appNav.js is the source
      of truth for which pages belong to which section).
   2. Library: six cards with title, what you learn, pages and thumbnail;
      each plays its own film with captions in the shared player; nothing
      loads or plays before a click; Esc closes and stops; a missing file
      shows a clear message; 3 / 2 / 1 columns without sideways scrolling.
   3. The section buttons ("Watch tutorial", js/section-films.js) use the
      same films.

   SAFE: this test's own static server; tests/_fence.js aborts every other
   request. RUN: node tests/tutorials.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }
const DIR = path.join(ROOT, 'assets/films/tutorials');
const KEYS = ['control-center', 'research', 'create', 'launch', 'campaigns', 'automations'];

function mp4Info(buf) {
  const s = buf.toString('latin1');
  const mv = s.indexOf('mvhd'); let dur = null;
  if (mv > 0) { const v = buf.readUInt8(mv + 4); const ts = v === 1 ? buf.readUInt32BE(mv + 24) : buf.readUInt32BE(mv + 16); const d = v === 1 ? Number(buf.readBigUInt64BE(mv + 28)) : buf.readUInt32BE(mv + 20); dur = d / ts; }
  const handlers = []; let i = -1; while ((i = s.indexOf('hdlr', i + 1)) > 0) handlers.push(s.substr(i + 12, 4));
  return { dur, handlers, avc: s.includes('avc1'), faststart: s.indexOf('moov') < s.indexOf('mdat') };
}

// The section → pages map, read from the real navigation (js/appNav.js).
function appSections() {
  const src = fs.readFileSync(path.join(ROOT, 'js/appNav.js'), 'utf8');
  const start = src.indexOf('var SECTIONS = ['), end = src.indexOf('];', start);
  const body = src.slice(start + 'var SECTIONS = '.length, end + 1);
  const stub = new Proxy({}, { get: () => () => () => {} });
  return vm.runInNewContext('(' + body + ')', { biz: () => 0, planPage: () => 0, page: () => 0, autoTab: () => 0, openPanel: () => 0, window: stub });
}

console.log('\n1. The six films');
const SECTIONS = appSections();
const KEY_OF = { cc: 'control-center', rs: 'research', cr: 'create', la: 'launch', ca: 'campaigns', au: 'automations' };
const lib = fs.readFileSync(path.join(ROOT, 'js/tutorial-library.js'), 'utf8');
const LIST = vm.runInNewContext(lib.slice(lib.indexOf('var LIST = ['), lib.indexOf('];', lib.indexOf('var LIST = [')) + 2) + ' LIST');
for (const k of KEYS) {
  const files = [k + '.mp4', k + '.jpg', k + '.vtt', k + '-thumb.webp'].map((f) => path.join(DIR, f));
  const ok = files.every((f) => fs.existsSync(f));
  const m = ok ? mp4Info(fs.readFileSync(files[0])) : {};
  const size = ok ? fs.statSync(files[0]).size : 0;
  check(`1.${k} film, poster, thumbnail and captions; H.264, video only, faststart, ${m.dur ? m.dur.toFixed(1) : '?'} s, ${(size / 1e6).toFixed(2)} MB`, ok && m.avc && m.handlers.includes('vide') && !m.handlers.includes('soun') && m.faststart && m.dur > 40 && m.dur < 150 && size < 4e6, { m, size });
  const sec = SECTIONS.find((s) => KEY_OF[s.id] === k);
  const pages = sec.items.map((it) => it.label);
  const vtt = ok ? fs.readFileSync(files[2], 'utf8') : '';
  const chapters = [...vtt.matchAll(/Page (\d+) of (\d+): ([^.\n]+)\./g)].map((x) => x[3]);
  check(`1.${k} a chapter for every page of the section (${pages.join(', ')})`, /^WEBVTT/.test(vtt) && pages.length === chapters.length && pages.every((p) => chapters.includes(p)), { pages, chapters });
  const t = LIST.find((x) => x.key === k);
  check(`1.${k} the library card lists the same pages, and its length matches the file (${t && t.seconds} s)`, t && JSON.stringify([...t.pages].sort()) === JSON.stringify([...pages].sort()) && Math.abs(t.seconds - m.dur) < 1.5, { card: t, dur: m.dur });
}
check('1.7 exactly six tutorials', fs.readdirSync(DIR).filter((f) => f.endsWith('.mp4')).length === 6);

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
// A small host page: the Dashboard's real container ids and stylesheets, the real scripts.
const HOST = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/css/ow-system.css"><link rel="stylesheet" href="/css/controlCenter.css">
<style>body{margin:0;background:#070707;color:#F2F2EE;font-family:system-ui,sans-serif}main{padding:16px;max-width:1200px;margin:0 auto}</style></head>
<body><main><div id="bizPanelOverview"><div class="bic-composition cc-root"><section class="ccx-card ccx-learn" id="ccxTutorials" aria-labelledby="ccxTutH"></section></div></div></main>
<script src="/js/ow-ui.js"></script><script src="/js/tutorial-library.js"></script></body></html>`;
const srv = http.createServer((q, r) => {
  const p = q.url.split('?')[0];
  if (p === '/host.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(HOST); }
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const st = fs.statSync(f), type = TYPES[path.extname(f)] || 'application/octet-stream', range = q.headers.range;
  if (range && type === 'video/mp4') { const [a, b] = range.replace('bytes=', '').split('-'); const s0 = +a, e0 = b ? +b : st.size - 1; r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s0}-${e0}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e0 - s0 + 1 }); return fs.createReadStream(f, { start: s0, end: e0 }).pipe(r); }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1', async () => {
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  require('./_fence').fenceBrowser(browser, BASE);
  const errors = [];
  try {
    console.log('\n2. The Dashboard library');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', (e) => errors.push(e.message));
    const mp4 = []; page.on('request', (rq) => { if (/\.mp4/.test(rq.url())) mp4.push(rq.url()); });
    await page.goto(BASE + '/host.html', { waitUntil: 'load' }); await page.waitForTimeout(600);
    const cards = await page.evaluate(() => [...document.querySelectorAll('#ccxTutorials .ccx-tut')].map((b) => ({ video: b.getAttribute('data-ow-video'), caps: b.getAttribute('data-ow-captions'), poster: b.getAttribute('data-ow-poster'), title: b.querySelector('.ccx-tut__t').textContent, learn: b.querySelector('.ccx-tut__learn').textContent, pages: b.querySelector('.ccx-tut__pages').textContent, label: b.getAttribute('aria-label'), thumb: b.querySelector('img') && b.querySelector('img').naturalWidth, type: b.type, dur: (b.querySelector('.ccx-tut__dur') || {}).textContent })));
    const head = await page.evaluate(() => ({ h: (document.getElementById('ccxTutH') || {}).textContent, videos: document.querySelectorAll('video').length }));
    check('2.1 heading and six cards in section order, each a button with title, what you learn, pages, duration and a loaded thumbnail', head.h === 'Learn OrivenAI' && cards.length === 6 && cards.every((c, i) => c.type === 'button' && c.video === '/assets/films/tutorials/' + KEYS[i] + '.mp4' && c.caps === '/assets/films/tutorials/' + KEYS[i] + '.vtt' && c.title && c.learn.length > 30 && c.pages && /^\d:\d\d$/.test(c.dur) && c.thumb > 0 && /^Play the .+ tutorial, /.test(c.label)), cards);
    check('2.2 nothing loads or plays before a click (no video element, no film request)', head.videos === 0 && mp4.length === 0, { head, mp4 });
    const played = [];
    for (let i = 0; i < 6; i++) {
      await page.click('#ccxTutorials .ccx-tut >> nth=' + i); await page.waitForTimeout(1700);
      played.push(await page.evaluate(() => { const pl = document.querySelector('.ow-player'); const v = pl.querySelector('video'); return { open: pl.classList.contains('is-open'), src: v.currentSrc.replace(location.origin, ''), t: +v.currentTime.toFixed(2), track: !!v.querySelector('track[kind="captions"][default]'), controls: v.controls, title: document.getElementById('owPlayerTitle').textContent, focusIn: pl.contains(document.activeElement), status: (pl.querySelector('.ow-player__status') || {}).hidden }; }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    }
    check('2.3 each card plays its own film in the player: it advances, has controls and captions, focus moves in, the loading note is gone', played.every((x, i) => x.open && x.src === '/assets/films/tutorials/' + KEYS[i] + '.mp4' && x.t > 0.3 && x.track && x.controls && /tutorial$/.test(x.title) && x.focusIn && x.status === true), played);
    const closed = await page.evaluate(() => { const pl = document.querySelector('.ow-player'); const v = pl.querySelector('video'); return { open: pl.classList.contains('is-open'), stopped: !v.getAttribute('src') && v.paused, focus: document.activeElement && document.activeElement.classList.contains('ccx-tut') }; });
    check('2.4 Esc closes the player, stops the film and returns focus to the card', !closed.open && closed.stopped && closed.focus, closed);
    // A film that can't load: a clear message and a way to retry.
    await page.evaluate(() => { const b = document.querySelector('#ccxTutorials .ccx-tut'); b.setAttribute('data-ow-video', '/assets/films/tutorials/missing.mp4'); });
    await page.click('#ccxTutorials .ccx-tut >> nth=0'); await page.waitForTimeout(1500);
    const err = await page.evaluate(() => { const s = document.querySelector('.ow-player__status'); return { shown: s && !s.hidden, text: s && s.textContent, retry: !!document.querySelector('.ow-player__status button') }; });
    check('2.5 a film that can’t load shows a clear message with a retry button', err.shown && /couldn’t load/i.test(err.text) && err.retry, err);
    await page.keyboard.press('Escape'); await page.close();

    console.log('\n3. Layout');
    const cols = {};
    for (const [w, want] of [[1440, 3], [900, 2], [390, 1]]) {
      const pg = await browser.newPage({ viewport: { width: w, height: 900 } }); pg.on('pageerror', (e) => errors.push(e.message));
      await pg.goto(BASE + '/host.html', { waitUntil: 'load' }); await pg.waitForTimeout(400);
      cols[w] = await pg.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.ccx-tut__grid')).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth - innerWidth, h: Math.round(document.querySelector('.ccx-tut').getBoundingClientRect().height) }));
      cols[w].ok = cols[w].cols === want && cols[w].overflow <= 0;
      await pg.screenshot({ path: path.join(__dirname, '_shots', 'tutorials-' + w + '.png'), fullPage: true }).catch(() => {});
      await pg.close();
    }
    check('3.1 three columns on desktop, two on tablet, one on a phone; no sideways scrolling', Object.values(cols).every((c) => c.ok), cols);

    console.log('\n4. The section buttons');
    const sf = fs.readFileSync(path.join(ROOT, 'js/section-films.js'), 'utf8');
    check('4.1 "Watch tutorial" on each section uses the tutorial films (via js/tutorial-library.js)', /orvTutorials/.test(sf) && /Watch tutorial/.test(sf) && !/assets\/films\/sections/.test(sf));
    const app = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
    check('4.2 app.html: the library container on the Dashboard, the script loaded before section-films.js', /id="ccxTutorials"/.test(app) && app.indexOf('js/tutorial-library.js') > 0 && app.indexOf('js/tutorial-library.js') < app.indexOf('js/section-films.js'));
    check('Z. no page errors', errors.length === 0, errors);
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); srv.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
