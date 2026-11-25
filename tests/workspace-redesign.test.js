// ════════════════════════════════════════════════════════════════
// Workspace redesign (2026-11): grouped sidebar with gradient lines,
// Ad Simulator (js/adSimulator.js + js/adSimEngine.js) and Advertising
// Settings (js/adSettings.js), run in the demo workspace (/demo-app:
// sample data, js/demo-mode.js answers every API call in the browser).
// Local static server only, fenced (tests/_fence.js).
// RUN: node tests/workspace-redesign.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8987, BASE = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const check = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + n + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 500))); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
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
  const browser = await chromium.launch({ executablePath: process.env.TEST_CHROME_PATH || undefined });
  fenceBrowser(browser, BASE);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(BASE + '/demo-app', { waitUntil: 'load' }); await p.waitForTimeout(6500);
  await p.addStyleTag({ content: '.orv-demo-bar,.orv-cc,.orv-flex-prompt{display:none!important}' });

  // ── 1. Sidebar ───────────────────────────────────────────────
  const nav = await p.evaluate(() => Array.from(document.querySelectorAll('.orv-sb .onv-sec')).map((s) => [s.querySelector('.onv-sec__t').textContent, Array.from(s.querySelectorAll('.onv-lbl')).map((x) => x.textContent)]));
  const want = [['Overview', ['Dashboard', 'AI Plans', 'Tasks']], ['Campaign Management', ['Campaigns', 'Audiences', 'Ad Simulator']], ['Creative Studio', ['Create Ads', 'My Creatives', 'Creative Testing']], ['Analytics', ['Performance Overview', 'Cross-platform Comparison']], ['Research', ['Research', 'Competitor Analysis', 'Saved Research']], ['Autopilot', ['Automation Overview', 'My Automations', 'Automation History']]];
  check('sidebar: six groups with the redesigned pages, in order', JSON.stringify(nav) === JSON.stringify(want), nav);
  check('no "NEW" badge on Ad Simulator', await p.evaluate(() => !/new/i.test((document.querySelector('.orv-sb [data-onv="simulator"]') || {}).textContent.replace('Ad Simulator', ''))));
  const line = await p.evaluate(() => { const r = document.querySelector('.orv-sb .onv-sec .onv-route'), cs = getComputedStyle(r); return { img: cs.backgroundImage, w: parseFloat(cs.width), h: r.getBoundingClientRect().height }; });
  check('each group has a vertical green gradient line (2–3px wide, along the group)', /linear-gradient/.test(line.img) && line.w >= 2 && line.w <= 3 && line.h > 40, line);
  const fit = await p.evaluate(() => { const n = document.querySelector('.orv-sb .orv-sb-nav'); return n.scrollHeight - n.clientHeight; });
  check('the whole navigation fits a 900px-high window (no sidebar scrolling)', fit <= 0, fit);
  for (const [id, pageId] of [['adstudio', 'page-launch'], ['content', 'page-my-content'], ['competitors', 'page-competitor-analysis'], ['auto-activity', 'page-autopilot']]) {
    await p.evaluate((i) => window.orvAppNav.go(i), id); await p.waitForTimeout(900);
  }
  const titles = await p.evaluate(() => ({ auto: (document.querySelector('#page-autopilot.active h1, #page-autopilot.active h2') || {}).textContent }));
  check('Automation History page carries its new name', /Automation History/.test(titles.auto || ''), titles);

  // ── 2. Ad Simulator ──────────────────────────────────────────
  await p.evaluate(() => window.orvAppNav.go('simulator')); await p.waitForTimeout(900);
  check('Ad Simulator opens, highlighted under Campaign Management, address /app?view=simulator', await p.evaluate(() => !!document.querySelector('#page-ad-simulator.active') && document.querySelector('.orv-sb .onv-item.is-on').getAttribute('data-onv') === 'simulator' && /view=simulator/.test(location.search)));
  check('first visit: a beginner setup, no invented scenario or results', await p.evaluate(() => !!document.querySelector('[data-asim-start]') && !document.querySelector('.asim-tile')));
  await p.click('[data-asim-qp="google"]'); await p.fill('[data-asim-q="budget"]', '2000'); await p.click('[data-asim-start]'); await p.waitForTimeout(500);
  const tiles = await p.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('.asim-tile')).map((t) => [t.querySelector('span').textContent, t.querySelector('b').textContent])));
  check('calculated results follow the assumptions (€2,000 · CPM €8 · CTR 1% · CVR 2% · €50 → 250K impr., 2,500 clicks, 50 conv., ROAS 1.25×)', /250K/.test(tiles.Impressions) && /2[.,]500/.test(tiles.Clicks) && tiles.Conversions === '50' && tiles.ROAS === '1.25×', tiles);
  check('example starting values are labelled as examples, not benchmarks', await p.evaluate(() => /example starting values, not a benchmark/.test(document.querySelector('.asim-src').textContent)));
  check('simulated range shown with conservative / median / optimistic and a chart', await p.evaluate(() => document.querySelectorAll('.asim-band tbody tr').length >= 4 && !!document.querySelector('.asim-hist svg rect')));
  // typing keeps focus and updates results live
  await p.fill('[data-asim-c="cvr"][data-p="meta"]', '4');
  const live = await p.evaluate(() => ({ focus: document.activeElement && document.activeElement.getAttribute('data-asim-c'), conv: Array.from(document.querySelectorAll('.asim-tile')).find((t) => t.querySelector('span').textContent === 'Conversions').querySelector('b').textContent }));
  check('typing an assumption recalculates instantly and keeps the field focused', live.focus === 'cvr' && live.conv === '75', live);
  // duplicate → compare
  await p.click('.asim-sc.is-on [data-asim-dup]'); await p.waitForTimeout(300);
  check('duplicate: a copy with the same values becomes the active scenario', await p.evaluate(() => { const s = window.orvAdSimulator._state().sim; return s.scenarios.length === 2 && s.activeId === s.scenarios[1].id && JSON.stringify(s.scenarios[0].channels) === JSON.stringify(s.scenarios[1].channels); }));
  check('compare: identical scenarios → no "best" highlighted', await p.evaluate(() => !document.querySelector('.asim-ctable td.is-best')));
  await p.fill('[data-asim-c="cvr"][data-p="google"]', '3'); await p.click('.asim-h'); await p.waitForTimeout(300);
  check('compare: after a change the better scenario is highlighted', await p.evaluate(() => document.querySelectorAll('.asim-ctable td.is-best').length > 0));
  // what-if
  await p.evaluate(() => { const r = document.querySelector('[data-asim-wi="budget"]'); r.value = '2'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const wi = await p.evaluate(() => Array.from(document.querySelectorAll('.asim-wi tbody tr')).map((r) => r.lastElementChild.textContent));
  check('what-if: double budget → +100% conversions and revenue, ROAS unchanged, with the auction caveat', wi[0] === '+100%' && wi[1] === '+100%' && wi[2] === '0%' && await p.evaluate(() => !!document.querySelector('.asim-warn')), wi);
  check('the scenario itself is unchanged until the change is applied', await p.evaluate(() => window.orvAdSimulator._state().sim.scenarios[1].budget === 2000));
  await p.click('[data-asim-wiapply]'); await p.waitForTimeout(300);
  check('apply: the scenario takes the change', await p.evaluate(() => window.orvAdSimulator._state().sim.scenarios[1].budget === 4000));
  // account figures
  await p.click('[data-asim-fill="meta"]'); await p.waitForTimeout(1500);
  check('“Use my account’s figures” fills from the account and says where they came from (with dates)', await p.evaluate(() => /From your account · Meta Ads, last 30 days · \d{4}-\d{2}-\d{2}/.test(document.querySelector('.asim-chan[data-plat="meta"] .asim-src').textContent)));
  // save in the demo is refused politely; no credits involved anywhere
  await p.click('[data-asim-save]'); await p.waitForTimeout(600);
  check('saving in the demo is refused with the demo message (nothing pretends to be saved)', await p.evaluate(() => /demo/i.test((document.querySelector('.asim-msg--warn') || {}).textContent || '') && !window.orvAdSimulator._state().id));
  check('the simulator makes no AI call and shows no credit cost for calculations', await p.evaluate(() => !/credit/i.test(document.querySelector('.asim-results').textContent + document.querySelector('.asim-whatif').textContent + document.querySelector('.asim-setup').textContent)));
  await p.click('[data-asim-view="list"]'); await p.waitForTimeout(600);
  check('My Simulations: an honest empty state, no example simulations', await p.evaluate(() => /No saved simulations yet/.test(document.querySelector('#asimRoot').textContent) && !document.querySelector('.asim-li')));

  // ── 3. Advertising Settings ──────────────────────────────────
  await p.click('.orv-sb [data-onv-foot="adsettings"]'); await p.waitForTimeout(2200);
  check('Advertising Settings opens from the sidebar footer, marked active, /app?view=adsettings', await p.evaluate(() => !!document.querySelector('#page-ad-settings.active') && !!document.querySelector('.orv-sb [data-onv-foot="adsettings"].is-on') && /view=adsettings/.test(location.search)));
  check('the selected platform and ad account are shown', await p.evaluate(() => /Meta Ads/.test(document.querySelector('.aset-ctx').textContent) && /Ad account/.test(document.querySelector('.aset-ctx').textContent)));
  const links = [];
  const rows = {};
  for (const pl of ['meta', 'google', 'tiktok', 'pinterest', 'snapchat']) {
    await p.click('[data-aset-plat="' + pl + '"]'); await p.waitForTimeout(1200);
    const d = await p.evaluate(() => ({ plat: document.querySelector('.aset-plat.is-on').textContent, ctx: document.querySelector('.aset-ctx b').textContent, links: Array.from(document.querySelectorAll('.aset-ext')).map((a) => a.href), rows: document.querySelectorAll('.aset-matrix tbody tr').length, text: document.querySelector('#asetRoot').textContent }));
    links.push(...d.links); rows[pl] = d.rows;
    check(pl + ': the page shows only this platform (switcher + context agree)', d.ctx.toLowerCase().startsWith(pl === 'tiktok' ? 'tiktok' : pl) && d.plat.toLowerCase().includes(pl === 'tiktok' ? 'tiktok' : pl), d);
    check(pl + ': never claims "Active" from an id alone', !/\bActive\b/.test(d.text.replace(/Pinterest status: ACTIVE/g, '')), d.text.match(/.{40}\bActive\b.{40}/));
  }
  const hosts = links.map((u) => new URL(u).hostname);
  check('every external setup link goes to an official platform domain', links.length >= 5 && hosts.every((h) => /(^|\.)(facebook\.com|google\.com|tiktok\.com|pinterest\.com|snapchat\.com|snap\.com)$/.test(h)), hosts);
  check('each platform lists what can be configured where', Object.values(rows).every((n) => n >= 3), rows);
  await p.click('[data-aset-plat="tiktok"]'); await p.waitForTimeout(500);
  check('TikTok: the actions need a pixel code first (disabled until entered)', await p.evaluate(() => document.querySelector('[data-aset-ttlink]').disabled && document.querySelector('[data-aset-ask="ttTest"]').disabled));
  await p.fill('[data-aset-in="tiktokCode"]', 'C1TEST');
  await p.click('[data-aset-ask="ttTest"]'); await p.waitForTimeout(200);
  check('sending a test event asks for confirmation first, naming platform, account and effect', await p.evaluate(() => { const c = document.querySelector('.aset-confirm'); return !!c && /TikTok Ads/.test(c.textContent) && /real event/.test(c.textContent); }));
  await p.click('[data-aset-cancel]');

  // ── 4. Phones ────────────────────────────────────────────────
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const q = await phone.newPage(); q.on('pageerror', (e) => errors.push('phone: ' + e.message));
  await q.goto(BASE + '/demo-app', { waitUntil: 'load' }); await q.waitForTimeout(6000);
  await q.evaluate(() => window.orvAppNav.go('simulator')); await q.waitForTimeout(700);
  await q.evaluate(() => { document.querySelector('[data-asim-qp="google"]').click(); document.querySelector('[data-asim-start]').click(); }); await q.waitForTimeout(500);
  const o1 = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await q.evaluate(() => window.orvAdSettings.open('google')); await q.waitForTimeout(1200);
  const o2 = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('phones: Ad Simulator and Advertising Settings have no sideways page overflow', o1 <= 0 && o2 <= 0, { o1, o2 });
  await phone.close();

  await browser.close(); srv.close();
  check('no page errors', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
