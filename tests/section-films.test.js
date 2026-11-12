/* ════════════════════════════════════════════════════════════════
   The six section films (assets/films/sections): one per main section,
   H.264 without an audio track (nothing can autoplay with sound), a poster
   and captions each; on the homepage's "Inside OrivenAI" tabs and behind
   "Watch the overview" on each public section page. Checks the files, then
   real playback in the browser: nothing loads or plays before a click,
   captions are attached, the video advances, closing stops it.

   SAFE: this test's own static server; tests/_fence.js aborts every other
   request. RUN: node tests/section-films.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }
const DIR = path.join(ROOT, 'assets/films/sections');
const KEYS = ['control-center', 'research', 'create', 'launch', 'campaigns', 'automations'];

// mp4 box helpers: duration from mvhd, and which track types exist (hdlr)
function mp4Info(buf) {
  const s = buf.toString('latin1');
  const mv = s.indexOf('mvhd'); let dur = null;
  if (mv > 0) { const v = buf.readUInt8(mv + 4); const ts = v === 1 ? buf.readUInt32BE(mv + 24) : buf.readUInt32BE(mv + 16); const d = v === 1 ? Number(buf.readBigUInt64BE(mv + 28)) : buf.readUInt32BE(mv + 20); dur = d / ts; }
  const handlers = []; let i = -1; while ((i = s.indexOf('hdlr', i + 1)) > 0) handlers.push(s.substr(i + 12, 4));
  return { dur, handlers, avc: s.includes('avc1'), faststart: s.indexOf('moov') < s.indexOf('mdat') };
}

console.log('\n1. The files');
const info = {};
for (const k of KEYS) {
  const mp4 = path.join(DIR, k + '.mp4'), ok = ['mp4', 'jpg', 'vtt', 'webp'].every((x) => fs.existsSync(path.join(DIR, k + '.' + x))) && fs.existsSync(path.join(DIR, k + '-800.webp'));
  const m = ok ? mp4Info(fs.readFileSync(mp4)) : {}; info[k] = m;
  const size = ok ? fs.statSync(mp4).size : 0;
  const vtt = ok ? fs.readFileSync(path.join(DIR, k + '.vtt'), 'utf8') : '';
  check(`1.${k} film, poster (jpg + webp) and captions; H.264, video track only, faststart, ${m.dur ? m.dur.toFixed(1) : '?'} s, ${(size / 1e6).toFixed(2)} MB`, ok && m.avc && m.handlers.includes('vide') && !m.handlers.includes('soun') && m.faststart && m.dur > 20 && m.dur < 90 && size < 3e6 && /^WEBVTT/.test(vtt) && (vtt.match(/-->/g) || []).length >= 3, { m, size });
}
check('1.7 exactly six films, one per main section', fs.readdirSync(DIR).filter((f) => f.endsWith('.mp4')).length === 6);

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.ico': 'image/x-icon' };
const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  let f = path.join(ROOT, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  const st = fs.statSync(f), type = TYPES[path.extname(f)] || 'application/octet-stream', range = q.headers.range;
  if (range && type === 'video/mp4') { const [a, b] = range.replace('bytes=', '').split('-'); const s0 = +a, e0 = b ? +b : st.size - 1; r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s0}-${e0}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e0 - s0 + 1 }); return fs.createReadStream(f, { start: s0, end: e0 }).pipe(r); }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1', async () => {
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  require('./_fence').fenceBrowser(browser, BASE, { backend401: true });
  const errors = [];
  try {
    console.log('\n2. Homepage: "Inside OrivenAI", one tab per section');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', (e) => errors.push(e.message));
    const mp4Requests = []; page.on('request', (rq) => { if (/\.mp4/.test(rq.url())) mp4Requests.push(rq.url()); });
    await page.goto(BASE + '/', { waitUntil: 'load' }); await page.addStyleTag({ content: '.orv-cc{display:none!important}' }); await page.waitForTimeout(900);
    const pre = await page.evaluate(() => ({ films: [...document.querySelectorAll('#inside .ik-shot')].map((s) => s.getAttribute('data-film')), caps: [...document.querySelectorAll('#inside .ik-shot')].map((s) => s.getAttribute('data-captions')), videos: document.querySelectorAll('#inside video').length, tabs: [...document.querySelectorAll('#inside .ik-tab')].map((t) => t.textContent.replace(/^\d+/, '').trim()) }));
    check('2.1 six tabs (Control Center … Automations), each with its new film and captions; no video element and no film download before a click', pre.films.length === 6 && pre.films.every((f, i) => f === '/assets/films/sections/' + KEYS[i] + '.mp4') && pre.caps.every((c, i) => c === '/assets/films/sections/' + KEYS[i] + '.vtt') && pre.videos === 0 && mp4Requests.length === 0, pre);
    await page.evaluate(() => { const v = document.getElementById('view-landing'); v.scrollTop += document.getElementById('inside').getBoundingClientRect().top - 80; }); await page.waitForTimeout(900);
    const played = [];
    for (let i = 0; i < 6; i++) {
      await page.click('#inside .ik-tab >> nth=' + i); await page.waitForTimeout(200);
      await page.click('#inside .ik-shot.is-active [data-ik-play]'); await page.waitForTimeout(1600);
      played.push(await page.evaluate(() => { const v = document.querySelector('#inside .ik-shot.is-active video'); return v ? { t: +v.currentTime.toFixed(2), src: v.currentSrc.replace(location.origin, ''), track: !!v.querySelector('track[kind="captions"][default]'), muted: v.muted, controls: v.controls, err: v.error && v.error.code } : null; }));
    }
    check('2.2 each tab’s Play starts that film: it advances, has controls and a default captions track, and plays without sound (the files have no audio)', played.every((x, i) => x && x.t > 0.3 && x.src === '/assets/films/sections/' + KEYS[i] + '.mp4' && x.track && x.muted && x.controls && !x.err), played);
    await page.close();

    console.log('\n3. Public section pages: "Watch the overview"');
    const pages = [['/business', 'control-center'], ['/research', 'research'], ['/create', 'create'], ['/launch', 'launch'], ['/campaigns', 'campaigns'], ['/autopilot', 'automations']];
    const res = [];
    for (const [p, k] of pages) {
      const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } }); pg.on('pageerror', (e) => errors.push(p + ': ' + e.message));
      await pg.goto(BASE + p, { waitUntil: 'load' }); await pg.addStyleTag({ content: '.orv-cc{display:none!important}' }); await pg.waitForTimeout(700);
      const btn = await pg.$('.ov-sp-hero [data-ow-video]');
      if (!btn) { res.push({ p, btn: false }); await pg.close(); continue; }
      await btn.click(); await pg.waitForTimeout(1600);
      const o = await pg.evaluate(() => { const pl = document.querySelector('.ow-player'); const v = pl && pl.querySelector('video'); return { open: !!pl && pl.classList.contains('is-open'), modal: pl && pl.getAttribute('aria-modal'), title: (document.getElementById('owPlayerTitle') || {}).textContent, src: v && v.currentSrc.replace(location.origin, ''), t: v ? +v.currentTime.toFixed(2) : 0, track: !!(v && v.querySelector('track[default]')), focusIn: !!pl && pl.contains(document.activeElement) }; });
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
      const c = await pg.evaluate(() => { const pl = document.querySelector('.ow-player'); const v = pl.querySelector('video'); return { open: pl.classList.contains('is-open'), stopped: !v.getAttribute('src') && v.paused, focus: document.activeElement && document.activeElement.hasAttribute('data-ow-video') }; });
      res.push({ p, k, o, c }); await pg.close();
    }
    check('3.1 every section page has "Watch the overview" in its hero', res.every((r) => r.o), res.filter((r) => !r.o).map((r) => r.p));
    check('3.2 it opens a dialog that plays that section’s film with captions; focus moves into it', res.every((r) => r.o && r.o.open && r.o.modal === 'true' && r.o.src === '/assets/films/sections/' + r.k + '.mp4' && r.o.t > 0.3 && r.o.track && r.o.focusIn && /a short tour/.test(r.o.title)), res.map((r) => r.o));
    check('3.3 Esc closes it, stops the video and returns focus to the button', res.every((r) => r.c && !r.c.open && r.c.stopped && r.c.focus), res.map((r) => r.c));
    check('Z. no page errors', errors.length === 0, errors);
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); srv.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
