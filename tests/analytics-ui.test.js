// ════════════════════════════════════════════════════════════════
// Campaign Overview metric tiles (js/overviewTiles.js) and Platform
// Comparison (js/campaignComparison.js), on js/orvAnalytics.js.
// Runs in the demo app (/demo-app: js/demo-mode.js answers every request
// with sample data for all five platforms), so no backend is needed.
// Fenced (tests/_fence.js): only this test's static server is reachable.
// RUN: node tests/analytics-ui.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8981, BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, '_shots', 'analytics'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + n + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 500))); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
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
  const errors = [], outside = [];
  async function boot(vp) {
    const ctx = await browser.newContext({ viewport: vp || { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('request', (rq) => { const u = rq.url(); if (!u.startsWith(BASE + '/') && !/^(data|blob):/.test(u) && !/^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) outside.push(rq.method() + ' ' + u); });
    await p.goto(BASE + '/demo-app', { waitUntil: 'load' }); await p.waitForTimeout(5500);
    return { ctx, p };
  }
  const go = async (p, id, ms) => { await p.evaluate((x) => window.orvAppNav.go(x), id); await p.waitForTimeout(ms || 3000); };
  const tiles = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#ovtRoot .ova-tile')).map((t) => ({ k: t.getAttribute('data-ovt-metric'), n: t.querySelector('.ova-tile__n').textContent, v: t.querySelector('.ova-tile__v').textContent.trim(), d: t.querySelector('.ova-tile__d').textContent.trim(), spark: !!t.querySelector('.ova-spark__line'), empty: t.classList.contains('is-empty') })));

  // ── A. Campaign Overview: tiles ──
  let { ctx, p } = await boot();
  await go(p, 'overview', 4000);
  const old = await p.evaluate(() => ['prfConnectBanner', 'prfChartsGrid', 'prfMetricExplorer'].map((id) => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none'; }));
  check('the green "Connect your ad accounts" banner, the single big chart and the old metric list are gone', old.every(Boolean), old);
  let t = await tiles(p);
  check('eight tiles: Impressions, Clicks, CTR, Spend, Conversions, CPC, CPA, ROAS', t.map((x) => x.n).join() === 'Impressions,Clicks,CTR,Spend,Conversions,CPC,CPA,ROAS', t.map((x) => x.n));
  check('each tile: a value, the change vs the previous period and a sparkline', t.every((x) => x.v && x.v !== '—' && /vs previous period/.test(x.d) && x.spark), t);
  const cols = await p.evaluate(() => getComputedStyle(document.querySelector('#ovtRoot .ova-grid')).gridTemplateColumns.split(' ').length);
  check('desktop: 4 tiles per row', cols === 4, cols);
  await p.screenshot({ path: path.join(SHOTS, 'tiles-desktop.png') });

  // Detail chart
  await p.click('#ovtRoot [data-ovt-metric="spend"]'); await p.waitForTimeout(1500);
  let det = await p.evaluate(() => { const d = document.getElementById('ovtDetail'); return { shown: !d.hidden, title: (d.querySelector('.ova-h3') || {}).textContent, legend: Array.from(d.querySelectorAll('.ova-legend li')).map((l) => l.textContent), lines: d.querySelectorAll('.ova-line').length, rows: d.querySelectorAll('.ova-table tbody tr').length, range: (d.querySelector('[data-ovt-drange]') || {}).value }; });
  check('clicking a tile opens the detail chart: one line per platform (5) and a per-platform table', det.shown && /Spend by platform/.test(det.title) && det.lines === 5 && det.legend.join() === 'Google,Meta,TikTok,Pinterest,Snapchat' && det.rows === 5, det);
  await p.selectOption('#ovtDetail [data-ovt-drange]', 'LAST_7_DAYS'); await p.waitForTimeout(1500);
  const days7 = await p.evaluate(() => { const s = document.querySelector('#ovtDetail .ova-chart__data'); return s ? JSON.parse(s.textContent).labels.length : 0; });
  check('the detail chart has its own period (Last 7 days → 7 days)', days7 === 7, days7);
  await p.hover('#ovtDetail .ova-chart__plot', { position: { x: 300, y: 80 } }); await p.waitForTimeout(200);
  const tip = await p.evaluate(() => { const t = document.querySelector('#ovtDetail .ova-tip'); return t && !t.hidden ? t.innerText : ''; });
  check('hovering the chart shows the day with every platform’s value', /Google/.test(tip) && /Snapchat/.test(tip), tip);
  await p.screenshot({ path: path.join(SHOTS, 'detail.png') });
  await p.click('#ovtDetail [data-ovt-close]'); await p.waitForTimeout(300);
  check('the detail chart closes', await p.evaluate(() => document.getElementById('ovtDetail').hidden));

  // Comparison tiles
  let wk = await p.evaluate(() => { const c = document.getElementById('ovtWeek'); return { kpis: Array.from(c.querySelectorAll('.ova-kpis span')).map((s) => s.textContent), lines: c.querySelectorAll('.ova-line').length, dashed: c.querySelectorAll('.ova-line.is-dashed').length }; });
  check('this period vs the one before: last 7 days vs the 7 before, both lines overlaid (previous dashed), with the change', wk.kpis.join() === 'Last 7 days,The 7 days before,Change' && wk.lines === 2 && wk.dashed === 1, wk);
  await p.click('#ovtWeek [data-ovt-len="30"]'); await p.waitForTimeout(1500);
  wk = await p.evaluate(() => Array.from(document.querySelectorAll('#ovtWeek .ova-kpis span')).map((s) => s.textContent));
  check('…the toggle switches to 30 days vs 30 days', wk[0] === 'Last 30 days' && wk[1] === 'The 30 days before', wk);
  const ads = await p.evaluate(() => { const c = document.getElementById('ovtAds'); return { selects: c.querySelectorAll('select').length, lines: c.querySelectorAll('.ova-line').length, legend: Array.from(c.querySelectorAll('.ova-legend li')).map((l) => l.textContent), best: c.querySelectorAll('.ova-kpis .is-best').length }; });
  check('ad vs ad: two ads and a metric to choose, both ads in one chart, the better one marked', ads.selects === 3 && ads.lines === 2 && ads.legend.length === 2 && ads.legend[0] !== ads.legend[1] && ads.best <= 1, ads);
  await p.selectOption('#ovtAds [data-ovt-admetric]', 'spend'); await p.waitForTimeout(1200);
  check('…changing the metric redraws it', await p.evaluate(() => document.querySelectorAll('#ovtAds .ova-line').length === 2));
  const ang = await p.evaluate(() => document.getElementById('ovtAngles').innerText);
  check('angle vs angle: says what is missing (angles aren’t saved with published ads yet)', /Not available yet/.test(ang) && /angle saved with every ad/.test(ang), ang);
  await p.screenshot({ path: path.join(SHOTS, 'compare-tiles.png') });

  // Per platform: ROAS not reported where there is no conversion value; not connected
  await p.evaluate(() => window.prfSwitchPlatform('tiktok', true)); await p.waitForTimeout(2500);
  t = await tiles(p);
  const roas = t.filter((x) => x.k === 'roas')[0];
  check('TikTok: ROAS tile says "Not reported by TikTok Ads" (no conversion value), the others have figures', roas.empty && /Not reported by TikTok Ads/.test(roas.d) && t.filter((x) => x.k !== 'roas').every((x) => !x.empty), t);
  await p.evaluate(() => { const C = window.orvCampaignSources, orig = C.status; window.__origStatus = orig; C.status = (pl) => (pl === 'pinterest' ? Promise.resolve({ conn: 'not_connected', currency: null }) : orig(pl)); window.orvAnalytics.reset(); window.prfSwitchPlatform('pinterest', true); }); await p.waitForTimeout(2500);
  t = await tiles(p);
  check('a platform that isn’t connected: every tile shows "Not connected" with "Connect Pinterest Ads"', t.every((x) => x.empty && x.v === 'Not connected' && /Connect Pinterest Ads/.test(x.d)), t.slice(0, 2));
  await p.screenshot({ path: path.join(SHOTS, 'tiles-not-connected.png') });

  // ── B. Platform Comparison ──
  await p.evaluate(() => { window.orvCampaignSources.status = window.__origStatus; window.orvAnalytics.reset(); });
  await go(p, 'compare', 4000);
  let pc = await p.evaluate(() => {
    const r = document.getElementById('ccmRoot');
    const head = Array.from(r.querySelectorAll('.pcm-table thead .pcm-colname')).map((x) => x.textContent.trim());
    const rows = Array.from(r.querySelectorAll('.pcm-table tbody tr')).map((tr) => ({ m: tr.querySelector('th').textContent, best: tr.querySelectorAll('.is-best').length, worst: tr.querySelectorAll('.is-worst').length }));
    return { title: r.querySelector('.rx-title').textContent, head, rows, connect: Array.from(r.querySelectorAll('.pcm-table thead [data-pcm-connect]')).map((x) => x.textContent), summary: (r.querySelector('.pcm-summary') || {}).innerText || '', legend: Array.from(r.querySelectorAll('.pcm-chart .ova-legend li')).map((l) => l.textContent), share: Array.from(r.querySelectorAll('.pcm-share .ova-pair')).length, shares: Array.from(r.querySelectorAll('.pcm-share .ova-bar.is-a em')).map((e) => parseInt(e.textContent, 10)), nav: (document.querySelector('.anv-item.is-active, [aria-current="page"]') || {}).textContent || '' };
  });
  check('Platform Comparison (renamed): all five platforms side by side', pc.title === 'Platform Comparison' && pc.head.join() === 'Google Ads,Meta Ads,TikTok Ads,Pinterest Ads,Snapchat Ads', pc.head);
  check('rows: Spend, Impressions, Clicks, CTR, CPC, Conversions, CPA, ROAS, Return per €1 spent', pc.rows.map((r) => r.m).join() === 'Spend,Impressions,Clicks,CTR,CPC,Conversions,CPA,ROAS,Return per €1 spent', pc.rows.map((r) => r.m));
  check('best value per metric highlighted and weakest marked (one each; none for Spend)', pc.rows.filter((r) => r.m !== 'Spend').every((r) => r.best === 1 && r.worst === 1) && pc.rows[0].best === 0, pc.rows);
  check('a rule-based summary: shares of conversions vs spend, the highest CPA, "no AI"', /% of conversions on \d+% of spend/.test(pc.summary) && /highest CPA/.test(pc.summary) && /no AI/.test(pc.summary), pc.summary);
  check('one line chart with a line per platform', pc.legend.join() === 'Google,Meta,TikTok,Pinterest,Snapchat', pc.legend);
  const sumShare = pc.shares.reduce((a, b) => a + b, 0);
  check('share of spend vs share of conversions per platform (spend shares add up to ~100%)', pc.share === 5 && sumShare >= 98 && sumShare <= 102, pc.shares);
  await p.screenshot({ path: path.join(SHOTS, 'platforms-desktop.png'), fullPage: false });
  await p.selectOption('#ccmRoot [data-pcm-metric]', 'conversions'); await p.waitForTimeout(500);
  check('the chart metric can be changed', await p.evaluate(() => /Conversions per platform/.test(document.querySelector('#ccmRoot .pcm-chart svg').getAttribute('aria-label'))));
  await p.selectOption('#ccmRoot [data-pcm-range]', 'LAST_WEEK'); await p.waitForTimeout(2500);
  const lw = await p.evaluate(() => JSON.parse(document.querySelector('#ccmRoot .pcm-chart .ova-chart__data').textContent).labels);
  const mon = new Date(lw[0] + 'T12:00:00').getDay();
  check('period "Last week": Monday to Sunday (7 days)', lw.length === 7 && mon === 1, lw);
  await p.click('#ccmRoot [data-pcm-prev]'); await p.waitForTimeout(2500);
  const prev = await p.evaluate(() => ({ ch: document.querySelectorAll('#ccmRoot .pcm-table .pcm-ch').length, period: document.querySelector('#ccmRoot .pcm-period').textContent }));
  check('"Compare to previous period" adds the change under every value', prev.ch >= 30 && /compared with the 7 days before/.test(prev.period), prev);
  await p.selectOption('#ccmRoot [data-pcm-range]', 'CUSTOM'); await p.waitForTimeout(300);
  check('custom period: two date fields', await p.evaluate(() => !!document.querySelector('#ccmRoot [data-pcm-since]') && !!document.querySelector('#ccmRoot [data-pcm-until]')));
  await p.selectOption('#ccmRoot [data-pcm-range]', 'LAST_30_DAYS'); await p.waitForTimeout(2500);
  // An unconnected platform keeps its column with a Connect button
  await p.evaluate(() => { const C = window.orvCampaignSources, orig = C.status; C.status = (pl) => (pl === 'snapchat' ? Promise.resolve({ conn: 'not_connected', currency: null }) : orig(pl)); window.orvAnalytics.reset(); });
  await go(p, 'dashboard', 1000); await go(p, 'compare', 3500);
  pc = await p.evaluate(() => ({ head: Array.from(document.querySelectorAll('#ccmRoot .pcm-table thead .pcm-colname')).map((x) => x.textContent.trim()), connect: Array.from(document.querySelectorAll('#ccmRoot .pcm-table thead [data-pcm-connect]')).map((x) => x.textContent), off: document.querySelectorAll('#ccmRoot .pcm-table td.is-off').length }));
  check('an unconnected platform keeps its column with "Connect Snapchat" (layout unchanged)', pc.head.length === 5 && pc.connect.join() === 'Connect Snapchat' && pc.off === 9, pc);
  await p.evaluate(() => { window.orvCampaignSources.status = window.__origStatus; window.orvAnalytics.reset(); });
  await ctx.close();

  // Campaigns mode
  ({ ctx, p } = await boot());
  await go(p, 'compare', 4000);
  await p.click('#ccmRoot [data-pcm-mode="campaigns"]'); await p.waitForTimeout(3500);
  const opts = await p.evaluate(() => ({ groups: Array.from(document.querySelectorAll('#pcmPick optgroup')).map((g) => g.label), n: document.querySelectorAll('#pcmPick option[value]:not([value=""])').length }));
  check('Campaigns mode: campaigns from every connected platform to pick from', opts.groups.length >= 4 && opts.n >= 6, opts);
  const values = await p.evaluate(() => Array.from(document.querySelectorAll('#pcmPick optgroup')).map((g) => g.querySelector('option').value));
  for (const v of values.slice(0, 3)) { await p.selectOption('#pcmPick', v); await p.waitForTimeout(2500); }
  const cm = await p.evaluate(() => ({ cols: document.querySelectorAll('#ccmRoot .pcm-table thead .pcm-colname').length, lines: document.querySelectorAll('#ccmRoot .pcm-chart .ova-line').length, best: document.querySelectorAll('#ccmRoot .pcm-table .is-best').length, disabled: document.getElementById('pcmPick').disabled, platforms: Array.from(document.querySelectorAll('#ccmRoot .pcm-table thead .pcm-colname')).map((x) => x.textContent.split('·').pop().trim()) }));
  check('three campaigns from different platforms head to head: table, highlighting and an overlay chart; no fourth', cm.cols === 3 && cm.lines === 3 && cm.best >= 3 && cm.disabled && new Set(cm.platforms).size === 3, cm);
  await p.click('#ccmRoot .pcm-table [data-pcm-unpick]'); await p.waitForTimeout(2500);
  check('removing a campaign leaves two', await p.evaluate(() => document.querySelectorAll('#ccmRoot .pcm-table thead .pcm-colname').length === 2));
  await p.screenshot({ path: path.join(SHOTS, 'campaigns-mode.png') });
  await ctx.close();

  // ── C. Responsive ──
  for (const vp of [{ width: 820, height: 1100, n: 'tablet', tiles: 2, cards: 2 }, { width: 390, height: 844, n: 'mobile', tiles: 1, cards: 1 }]) {
    ({ ctx, p } = await boot({ width: vp.width, height: vp.height }));
    await go(p, 'overview', 4000);
    const tc = await p.evaluate(() => ({ cols: getComputedStyle(document.querySelector('#ovtRoot .ova-grid')).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth - innerWidth, wide: Array.from(document.querySelectorAll('#ovtRoot *')).filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
    check(vp.n + ': ' + vp.tiles + ' tile(s) per row, nothing wider than the screen', tc.cols === vp.tiles && tc.overflow <= 0 && tc.wide === 0, tc);
    await p.screenshot({ path: path.join(SHOTS, 'tiles-' + vp.n + '.png') });
    await go(p, 'compare', 4000);
    const cc = await p.evaluate(() => ({ table: getComputedStyle(document.querySelector('#ccmRoot .pcm-table-wrap')).display, cards: getComputedStyle(document.querySelector('#ccmRoot .pcm-cards')).display, cols: getComputedStyle(document.querySelector('#ccmRoot .pcm-cards')).gridTemplateColumns.split(' ').length, n: document.querySelectorAll('#ccmRoot .pcm-card').length, overflow: document.documentElement.scrollWidth - innerWidth, wide: Array.from(document.querySelectorAll('#ccmRoot *')).filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
    check(vp.n + ': the table becomes stacked cards (' + vp.cards + ' per row), no sideways scrolling', cc.table === 'none' && cc.cards === 'grid' && cc.cols === vp.cards && cc.n === 5 && cc.overflow <= 0 && cc.wide === 0, cc);
    await p.screenshot({ path: path.join(SHOTS, 'platforms-' + vp.n + '.png') });
    await ctx.close();
  }

  await browser.close(); srv.close();
  check('no request left the page (sample data answered inside it)', outside.length === 0, outside.slice(0, 8));
  check('no page errors', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
