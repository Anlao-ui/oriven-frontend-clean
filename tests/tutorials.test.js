/* ════════════════════════════════════════════════════════════════
   The six product tutorials (assets/films/tutorials).

   1. Files: one H.264 film per section, video track only (nothing can play
      with sound), faststart, poster, thumbnail and captions; each film has
      a chapter for EVERY page of its section (js/appNav.js is the source of
      truth for which pages belong to which section). tools/tutorials-list.js
      names the same pages and the real length of each file.
   2. Not inside the signed-in app (2026-11-13): no tutorial gallery on the
      Dashboard, no "Watch tutorial" button on any app page, the scripts that
      added them are gone. (tests/app-nav.test.js 14.x checks the running app.)
   3. The public homepage: one tab per section in "The real product, not a
      mock-up." (#inside), each opening its tutorial in the shared player
      with exactly one subtitle layer (in the picture). The Watch tutorial
      button never moves (hover, press) and ONE click opens the player; no
      length label. A film that can't load says so; the cookie banner never
      covers an open video on a phone.

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
const LIST = require(path.join(ROOT, 'tools/tutorials-list.js'));

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
  const stub = new Proxy({}, { get: () => () => () => {} });
  return vm.runInNewContext('(' + src.slice(start + 'var SECTIONS = '.length, end + 1) + ')', { biz: () => 0, planPage: () => 0, page: () => 0, autoTab: () => 0, openPanel: () => 0, window: stub });
}

console.log('\n1. The six films');
const SECTIONS = appSections();
const KEY_OF = { cc: 'control-center', rs: 'research', cr: 'create', la: 'launch', ca: 'campaigns', au: 'automations' };
for (const k of KEYS) {
  const files = [k + '.mp4', k + '.jpg', k + '.vtt', k + '-thumb.webp'].map((f) => path.join(DIR, f));
  const ok = files.every((f) => fs.existsSync(f));
  const m = ok ? mp4Info(fs.readFileSync(files[0])) : {};
  const size = ok ? fs.statSync(files[0]).size : 0;
  check(`1.${k} film, poster, thumbnail and captions; H.264, video only, faststart, ${m.dur ? m.dur.toFixed(1) : '?'} s, ${(size / 1e6).toFixed(2)} MB`, ok && m.avc && m.handlers.includes('vide') && !m.handlers.includes('soun') && m.faststart && m.dur > 40 && m.dur < 150 && size < 4e6, { m, size });
  const pages = SECTIONS.find((s) => KEY_OF[s.id] === k).items.map((it) => it.label);
  const vtt = ok ? fs.readFileSync(files[2], 'utf8') : '';
  const chapters = [...vtt.matchAll(/Page (\d+) of (\d+): ([^.\n]+)\./g)].map((x) => x[3]);
  check(`1.${k} a chapter for every page of the section (${pages.join(', ')})`, /^WEBVTT/.test(vtt) && pages.length === chapters.length && pages.every((p) => chapters.includes(p)), { pages, chapters });
  const t = LIST.find((x) => x.key === k);
  check(`1.${k} tools/tutorials-list.js names the same pages and the file’s real length (${t && t.seconds} s)`, t && JSON.stringify([...t.pages].sort()) === JSON.stringify([...pages].sort()) && Math.abs(t.seconds - m.dur) < 1.5, { list: t, dur: m.dur });
}
check('1.7 exactly six tutorials', fs.readdirSync(DIR).filter((f) => f.endsWith('.mp4')).length === 6);

console.log('\n2. Not inside the signed-in app');
const app = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
const appJs = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => [f, fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')]);
check('2.1 app.html: no tutorial gallery container, no tutorial or section-film scripts', !/ccxTutorials|ccx-learn|tutorial-library\.js|section-films\.js/.test(app), (app.match(/ccxTutorials|ccx-learn|tutorial-library\.js|section-films\.js/g) || []));
check('2.2 the scripts that added the Dashboard gallery and the in-app "Watch tutorial" buttons are gone', !fs.existsSync(path.join(ROOT, 'js/section-films.js')) && !fs.existsSync(path.join(ROOT, 'js/tutorial-library.js')));
const leftovers = appJs.filter(([, s]) => /orv-film-btn|data-orv-film|Watch tutorial|assets\/films\/tutorials/.test(s)).map(([f]) => f);
check('2.3 no app script makes a tutorial button or points at the tutorial films', leftovers.length === 0, leftovers);
const cc = fs.readFileSync(path.join(ROOT, 'css/controlCenter.css'), 'utf8');
check('2.4 the Dashboard styles have no tutorial gallery rules left', !/ccx-learn|ccx-tut/.test(cc));

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const st = fs.statSync(f), type = TYPES[path.extname(f)] || 'application/octet-stream', range = q.headers.range;
  if (range && type === 'video/mp4') { const [a, b] = range.replace('bytes=', '').split('-'); const s0 = +a, e0 = b ? +b : st.size - 1; r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s0}-${e0}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e0 - s0 + 1 }); return fs.createReadStream(f, { start: s0, end: e0 }).pipe(r); }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1', async () => {
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  require('./_fence').fenceBrowser(browser, BASE, { backend401: true });
  const errors = [];
  const ONE = (v) => { const ts = [...v.querySelectorAll('track')]; return ts.length === 1 && ts[0].kind === 'metadata' && [...v.textTracks].length === 1 && [...v.textTracks].every((x) => x.mode !== 'showing'); };
  try {
    console.log('\n3. The public homepage: the six tutorials in "The real product, not a mock-up."');
    const gen = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'tools/tutorials-section.js'), '--check'], { encoding: 'utf8' });
    const homeHtml = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');
    const insideHtml = homeHtml.slice(homeHtml.indexOf('id="inside"'), homeHtml.indexOf('</section>', homeHtml.indexOf('id="inside"')));
    check('3.1 written from tools/tutorials-list.js (up to date), prerendered into home.html inside #inside; no standalone tutorials section; no length label', gen.status === 0 && !/id="tutorials"/.test(homeHtml) && !/ik-play__dur/.test(homeHtml) && KEYS.every((k) => insideHtml.includes('data-ow-video="/assets/films/tutorials/' + k + '.mp4"') && insideHtml.includes('/assets/films/tutorials/' + k + '-thumb.webp')), { gen: gen.stdout + gen.stderr });
    const hp = await browser.newPage({ viewport: { width: 1440, height: 900 } }); hp.on('pageerror', (e) => errors.push('home: ' + e.message));
    const mp4 = []; hp.on('request', (rq) => { if (/\.mp4/.test(rq.url())) mp4.push(rq.url()); });
    await hp.goto(BASE + '/', { waitUntil: 'load' }); await hp.addStyleTag({ content: '.orv-cc,#orvConsentBanner{display:none!important}' }); await hp.waitForTimeout(800);
    await hp.evaluate(() => document.getElementById('inside').scrollIntoView({ block: 'start' })); await hp.waitForTimeout(1600);
    const tabs = await hp.evaluate(() => ({ h2: document.getElementById('ik-inside-title').textContent, tabs: [...document.querySelectorAll('#inside .ik-tab')].map((t) => t.textContent.replace(/^\d+/, '').trim()), plays: [...document.querySelectorAll('#inside .ik-shot [data-ik-play]')].map((b) => ({ v: b.getAttribute('data-ow-video'), c: b.getAttribute('data-ow-captions'), label: b.getAttribute('aria-label'), text: b.textContent.trim() })), videos: document.querySelectorAll('video').length }));
    check('3.2 one tab per section (Control Center … Automations), each with its tutorial and captions file, labelled "Watch tutorial" and nothing else (no length); nothing loaded before a click', tabs.h2 === 'The real product, not a mock-up.' && tabs.tabs.join() === 'Control Center,Research,Create,Launch,Campaigns,Automations' && tabs.plays.length === 6 && tabs.plays.every((p, i) => p.v === '/assets/films/tutorials/' + KEYS[i] + '.mp4' && p.c === '/assets/films/tutorials/' + KEYS[i] + '.vtt' && p.text === 'Watch tutorial' && p.label.startsWith('Play the ' + tabs.tabs[i] + ' tutorial')) && tabs.videos === 0 && mp4.length === 0, tabs);
    // The button bug (2026-11-13): the global button:active style replaced the centring transform,
    // so the button jumped half its size under the pointer and the click never fired.
    const stable = [];
    for (let i = 0; i < 6; i++) {
      await hp.click('#inside .ik-tab >> nth=' + i); await hp.waitForTimeout(350);
      const btn = hp.locator('#inside .ik-shot.is-active .ik-play');
      const r0 = await btn.boundingBox();
      await hp.mouse.move(r0.x + r0.width / 2, r0.y + r0.height / 2); await hp.waitForTimeout(300);
      const rH = await btn.boundingBox();
      await hp.mouse.down(); await hp.waitForTimeout(250);
      const rD = await btn.boundingBox();
      await hp.mouse.up(); await hp.waitForTimeout(1400);
      const st = await hp.evaluate(() => { const pl = document.querySelector('.ow-player'); const v = pl && pl.querySelector('video'); return { open: !!pl && pl.classList.contains('is-open'), src: v && v.currentSrc.replace(location.origin, ''), t: v ? +v.currentTime.toFixed(2) : 0 }; });
      const same = (a, b) => Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6 && Math.abs(a.width - b.width) < 0.6;
      stable.push({ tab: i + 1, stillOnHover: same(r0, rH), stillOnPress: same(r0, rD), oneClickOpens: st.open && st.src === '/assets/films/tutorials/' + KEYS[i] + '.mp4' && st.t > 0.2, r0: [Math.round(r0.x), Math.round(r0.y)], rD: [Math.round(rD.x), Math.round(rD.y)] });
      await hp.keyboard.press('Escape'); await hp.waitForTimeout(350);
    }
    check('3.3 on every tab the Watch tutorial button stays exactly in place on hover and while pressed, and ONE click (real mouse down/up) opens that tutorial in the enlarged player', stable.every((s) => s.stillOnHover && s.stillOnPress && s.oneClickOpens), stable);
    const opened = [];
    for (let i = 0; i < 6; i++) {
      await hp.click('#inside .ik-tab >> nth=' + i); await hp.waitForTimeout(250);
      const thumb = await hp.evaluate(() => { const img = document.querySelector('#inside .ik-shot.is-active img'); return img && img.complete && img.naturalWidth; });
      await hp.click('#inside .ik-shot.is-active [data-ik-play]'); await hp.waitForTimeout(1400);
      opened.push(Object.assign({ thumb }, await hp.evaluate((ONE) => { const pl = document.querySelector('.ow-player'); const v = pl.querySelector('video'); return { open: pl.classList.contains('is-open'), modal: pl.getAttribute('aria-modal'), focusIn: pl.contains(document.activeElement), src: v.currentSrc.replace(location.origin, ''), t: +v.currentTime.toFixed(2), controls: v.controls, oneLayer: new Function('v', 'return (' + ONE + ')(v)')(v) }; }, ONE.toString())));
      await hp.keyboard.press('Escape'); await hp.waitForTimeout(300);
      opened[i].closed = await hp.evaluate(() => { const v = document.querySelector('.ow-player video'); return !document.querySelector('.ow-player').classList.contains('is-open') && v.paused && !v.getAttribute('src'); });
    }
    check('3.4 each tab shows its thumbnail and plays its own tutorial in the enlarged player (dialog, focus moves in, controls) with exactly one subtitle layer; Esc closes it and stops playback', opened.every((o, i) => o.thumb > 0 && o.open && o.modal === 'true' && o.focusIn && o.src === '/assets/films/tutorials/' + KEYS[i] + '.mp4' && o.t > 0.3 && o.controls && o.oneLayer && o.closed), opened);
    // Opening, closing, reopening and switching never adds a second (browser-drawn) subtitle layer.
    const layers = [];
    for (const i of [0, 0, 3, 5, 0]) {
      await hp.click('#inside .ik-tab >> nth=' + i); await hp.waitForTimeout(200);
      await hp.click('#inside .ik-shot.is-active [data-ik-play]'); await hp.waitForTimeout(800);
      layers.push(await hp.evaluate(() => { const v = document.querySelector('.ow-player video'); return { trackEls: v.querySelectorAll('track').length, kinds: [...v.querySelectorAll('track')].map((t) => t.kind).join(), showing: [...v.textTracks].filter((t) => t.mode === 'showing').length }; }));
      await hp.keyboard.press('Escape'); await hp.waitForTimeout(300);
    }
    const playerSrc = fs.readFileSync(path.join(ROOT, 'js/ow-ui.js'), 'utf8');
    check('3.5 exactly one subtitle layer every time: opening, closing, reopening and switching tutorials (one metadata track, none drawn by the browser)', layers.every((l) => l.trackEls === 1 && l.kinds === 'metadata' && l.showing === 0) && !/kind\s*=\s*'captions'|\.default\s*=\s*true/.test(playerSrc), layers);
    // A film that can't load: a clear message and a way to retry.
    await hp.evaluate(() => document.querySelector('#inside .ik-shot.is-active [data-ik-play]').setAttribute('data-ow-video', '/assets/films/tutorials/missing.mp4'));
    await hp.click('#inside .ik-shot.is-active [data-ik-play]'); await hp.waitForTimeout(1500);
    const err = await hp.evaluate(() => { const s = document.querySelector('.ow-player__status'); return { shown: s && !s.hidden, text: s && s.textContent, retry: !!document.querySelector('.ow-player__status button') }; });
    check('3.6 a film that can’t load shows a clear message with a retry button', err.shown && /couldn’t load/i.test(err.text) && err.retry, err);
    await hp.keyboard.press('Escape'); await hp.close();
    const lay = {};
    for (const w of [1440, 800, 390]) {
      const lp = await browser.newPage({ viewport: { width: w, height: 900 } }); lp.on('pageerror', (e) => errors.push('home ' + w + ': ' + e.message));
      await lp.goto(BASE + '/', { waitUntil: 'load' }); await lp.waitForTimeout(700);
      await lp.evaluate(() => document.getElementById('inside').scrollIntoView({ block: 'start' })); await lp.waitForTimeout(1200);
      lay[w] = await lp.evaluate(() => { const st = document.querySelector('#inside .ik-shot.is-active .ik-shot__media').getBoundingClientRect(); const p = document.querySelector('#inside .ik-shot.is-active .ik-play').getBoundingClientRect(); return { overflow: document.documentElement.scrollWidth - innerWidth, playInside: p.left >= st.left && p.right <= st.right && p.top >= st.top && p.bottom <= st.bottom, centred: Math.abs((p.left + p.right) / 2 - (st.left + st.right) / 2) < 2 }; });
      await lp.screenshot({ path: path.join(__dirname, '_shots', 'tutorials-inside-' + w + '.png') }).catch(() => {});
      await lp.close();
    }
    check('3.7 desktop, tablet and phone: the Play button sits centred inside the frame; no sideways scrolling', Object.values(lay).every((l) => l.overflow <= 0 && l.playInside && l.centred), lay);
    {
      const mp = await browser.newPage({ viewport: { width: 390, height: 844 } }); mp.on('pageerror', (e) => errors.push('home banner: ' + e.message));
      await mp.goto(BASE + '/', { waitUntil: 'load' }); await mp.waitForTimeout(1500);
      await mp.evaluate(() => document.getElementById('inside').scrollIntoView({ block: 'start' })); await mp.waitForTimeout(600);
      const bannerShown = await mp.evaluate(() => { const c = document.querySelector('.orv-cc'); return !!c && c.getClientRects().length > 0; });
      await mp.evaluate(() => document.querySelector('#inside .ik-shot.is-active [data-ik-play]').click()); await mp.waitForTimeout(1200);
      const top = await mp.evaluate(() => { const v = document.querySelector('.ow-player video'); const r = v.getBoundingClientRect(); const c = document.querySelector('.orv-cc').getBoundingClientRect(); const pts = [[r.left + r.width / 2, r.bottom - 12], [r.left + r.width / 2, r.top + r.height / 2], [c.left + c.width / 2, c.top + c.height / 2]]; return pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.ow-player')); }); });
      check('3.8 with the cookie banner showing on a phone, the open tutorial is on top of it (video, controls and the banner area belong to the player)', bannerShown && top.every(Boolean), { bannerShown, top });
      await mp.close();
    }
    check('Z. no page errors', errors.length === 0, errors);
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); srv.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
