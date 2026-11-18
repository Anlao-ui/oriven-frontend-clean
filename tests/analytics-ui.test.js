// ════════════════════════════════════════════════════════════════
// Campaign Overview (metric cards, the selected metric's graph, period and
// ad-vs-ad comparisons: js/overviewCompare.js) and Platform Comparison
// (js/campaignComparison.js), on js/orvAnalytics.js.
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

  // ── A. Campaign Overview ──
  let { ctx, p } = await boot();
  await go(p, 'overview', 4000);
  const cards = (pg) => pg.evaluate(() => Array.from(document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile')).map((t) => { const b = t.getBoundingClientRect(); return { id: t.getAttribute('data-metric'), n: t.querySelector('.prf-explorer-label').textContent.trim(), v: t.querySelector('.prf-explorer-val').textContent.trim(), w: Math.round(b.width), h: Math.round(b.height), active: t.classList.contains('prf-explorer-tile-active') }; }));
  const gone = await p.evaluate(() => ({ banner: !!document.getElementById('prfConnectBanner'), replay: ['prfReplaySection', 'prfReplayToggleBtn'].filter((id) => document.getElementById(id)).length, header: !!document.querySelector('#orvHubTabsCampaigns .camp-shell-hdr'), angle: !!document.getElementById('ovtAngles'), tiles: !!document.getElementById('ovtRoot'), tiktokSoon: !!document.getElementById('prfTikTokComing') }));
  check('removed: green connect banner, Campaign Replay, the header block (Campaigns / subtitle / Campaign Builder link), angle vs angle, the big tiles', !gone.banner && !gone.replay && !gone.header && !gone.angle && !gone.tiles && !gone.tiktokSoon, gone);
  const top = await p.evaluate(() => { const h = document.getElementById('prfOvTitle'), g = document.getElementById('prfExplorerGrid');
    const groups = Array.from(document.querySelectorAll('#prfExplorerGrid .prf-mgroup')).map((x) => ({ g: x.getAttribute('data-group'), label: x.querySelector('.prf-mgroup-h').textContent, bg: getComputedStyle(x).backgroundColor, dot: getComputedStyle(x.querySelector('.prf-explorer-dot')).backgroundColor, ids: Array.from(x.querySelectorAll('.prf-explorer-tile')).map((t) => t.getAttribute('data-metric')) }));
    return { title: h && h.textContent, above: h && g && h.getBoundingClientRect().bottom <= g.getBoundingClientRect().top, groups }; });
  check('the title "Campaign Overview" above the cards', top.title === 'Campaign Overview' && top.above, top.title);
  check('Google: metrics grouped as Reach, Cost & budget, Engagement, Conversions, Revenue — each group its own muted colour (no orange everywhere)', top.groups.map((x) => x.g).join() === 'reach,cost,engagement,conversions,revenue' && new Set(top.groups.map((x) => x.bg)).size === 5 && new Set(top.groups.map((x) => x.dot)).size === 5 && !top.groups.some((x) => /245, 166, 35/.test(x.dot)), top.groups);
  check('…the right metrics in each group (Engagement: clicks, CTR, CPC; Revenue: conversion value, ROAS)', top.groups[2].ids.join() === 'clicks,ctr,cpc' && top.groups[4].ids.join() === 'conversionValue,roas' && top.groups[0].ids.indexOf('impressions') === 0, top.groups.map((x) => x.g + ':' + x.ids.join('/')));
  let c = await cards(p);
  const want = ['Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Spend', 'Conversions', 'Conversion Value', 'ROAS'];
  check('Google Ads: compact metric cards with real values, incl. Impressions, Clicks, CTR, CPC, CPM, Spend, Conversions, Conversion value, ROAS', want.every((n) => c.some((x) => x.n.toLowerCase() === n.toLowerCase() && x.v && x.v !== '—')), c.map((x) => x.n + '=' + x.v));
  const ws = new Set(c.map((x) => x.w)), hs = new Set(c.map((x) => x.h));
  const fit = await p.evaluate(() => { const grid = document.getElementById('prfExplorerGrid').getBoundingClientRect().width; return { grid: Math.round(grid), groups: Array.from(document.querySelectorAll('#prfExplorerGrid .prf-mgroup')).map((x) => { const r = x.getBoundingClientRect(), tiles = Array.from(x.querySelectorAll('.prf-explorer-tile')).map((t) => t.getBoundingClientRect()); return { g: x.getAttribute('data-group'), n: tiles.length, w: Math.round(r.width), spare: Math.round(r.width - (Math.max.apply(null, tiles.map((t) => t.right)) - Math.min.apply(null, tiles.map((t) => t.left)))) }; }) }; });
  check('metric groups are only as wide as their cards (no group stretches across the row; a two-metric group stays small)', fit.groups.every((x) => x.spare <= 30) && fit.groups.filter((x) => x.n <= 2).every((x) => x.w < fit.grid * 0.35), fit);
  check('compact cards: all the same height, none wide (each 110–260px on desktop)', hs.size === 1 && [...ws].every((w) => w >= 110 && w <= 260), { ws: [...ws], hs: [...hs] });
  // Clicking a card: that metric's graph, clearly selected, not full width
  await p.click('#prfExplorerGrid [data-metric="ctr"]'); await p.waitForTimeout(1500);
  let gr = await p.evaluate(() => { const card = document.querySelector('#prfChartsGrid .prf-chart-card'), dash = document.getElementById('prfDash'); return { title: (card.querySelector('.prf-chart-title') || {}).textContent, w: Math.round(card.getBoundingClientRect().width), dashW: Math.round(dash.getBoundingClientRect().width), locked: !!card.querySelector('.prf-lock-show'), bars: card.querySelectorAll('.prf-bars *').length }; });
  c = await cards(p);
  check('clicking the CTR card shows "CTR over time", the card stays highlighted, and the graph shares the row (not full width)', gr.title === 'CTR over time' && c.filter((x) => x.active).map((x) => x.id).join() === 'ctr' && gr.w < gr.dashW * 0.7 && !gr.locked && gr.bars > 0, { gr, active: c.filter((x) => x.active).map((x) => x.id) });
  await p.click('#prfExplorerGrid [data-metric="cpc"]'); await p.waitForTimeout(1200);
  check('…and the CPC card shows "CPC over time"', await p.evaluate(() => document.querySelector('#prfChartsGrid .prf-chart-title').textContent === 'CPC over time'));
  await p.screenshot({ path: path.join(SHOTS, 'overview-desktop.png') });

  // Period comparison
  const per = () => p.evaluate(() => { const el = document.getElementById('ovtPeriod'); return { head: Array.from(el.querySelectorAll('thead th')).map((x) => x.textContent), rows: Array.from(el.querySelectorAll('tbody tr')).map((tr) => [tr.querySelector('th').textContent].concat(Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))), sub: (el.querySelector('.ova-sub') || {}).textContent || '', dates: el.querySelectorAll('input[type="date"]').length }; });
  let pd = await per();
  const ctrRow = pd.rows.find((r) => r[0] === 'CTR') || [];
  check('period comparison, default this week vs last week (the same days): current, previous, difference and % change per metric', pd.head.join() === 'Metric,This week,Last week,Difference,Change' && /This week \(.+\) vs Last week \(.+\)/.test(pd.sub) && ctrRow.length === 5 && /%$/.test(ctrRow[1]) && /pt$/.test(ctrRow[3]) && /%/.test(ctrRow[4]), pd);
  check('…only metrics Google reports (ROAS and conversion value included for Google)', pd.rows.map((r) => r[0]).join().toLowerCase() === 'impressions,clicks,ctr,cpc,cpm,spend,conversions,conversion rate,cpa,conversion value,roas', pd.rows.map((r) => r[0]));
  await p.click('#ovtPeriod [data-ovc-mode="month"]'); await p.waitForTimeout(1500);
  pd = await per();
  check('month toggle: this month vs last month (same days)', pd.head[1] === 'This month' && pd.head[2] === 'Last month' && /This month \(.+\) vs Last month/.test(pd.sub), pd.head);
  await p.click('#ovtPeriod [data-ovc-mode="custom"]'); await p.waitForTimeout(1500);
  pd = await per();
  check('custom: two periods with their own dates (A and B)', pd.dates === 4 && pd.head[1] === 'Period A' && pd.head[2] === 'Period B', pd);
  await p.fill('#ovtPeriod [data-ovc-date="bSince"]', await p.evaluate(() => window.orvAnalytics.addDays(window.orvAnalytics.today(), -40))); await p.dispatchEvent('#ovtPeriod [data-ovc-date="bSince"]', 'change'); await p.waitForTimeout(1500);
  pd = await per();
  check('…changing a date recalculates the comparison', pd.rows.length >= 5 && pd.dates === 4, pd.sub);
  await p.click('#ovtPeriod [data-ovc-mode="week"]'); await p.waitForTimeout(1000);

  // Ad vs ad: Google doesn't report per-ad results → says so, offers Meta
  let ad = await p.evaluate(() => document.getElementById('ovtAds').innerText);
  check('ad vs ad on Google Ads: explains results per ad come from Meta Ads, with a button to compare Meta ads', /Results per ad come from Meta Ads/.test(ad) && /Compare Meta ads/.test(ad), ad);
  await p.click('#ovtAds [data-ovc-meta]'); await p.waitForTimeout(3500);
  ad = await p.evaluate(() => { const el = document.getElementById('ovtAds'); return { plat: window._prfActivePlatform, selects: el.querySelectorAll('select').length, verdict: (el.querySelector('.ovc-verdict') || {}).textContent || '', rows: Array.from(el.querySelectorAll('.ovc-adtable tbody tr')).map((tr) => ({ m: tr.querySelector('th').textContent, a: tr.children[1].childNodes[0].textContent, b: tr.children[2].childNodes[0].textContent, best: tr.querySelectorAll('.is-best').length })), lines: el.querySelectorAll('.ova-line').length }; });
  check('…Meta: pick two ads and a period; a plain-language verdict (which ad does better and why, no AI), the figures side by side and both ads over time', ad.plat === 'meta' && ad.selects === 4 && /is doing better: .+ \(.+ vs .+\)|perform about the same|Too early/.test(ad.verdict) && ad.rows.length >= 8 && ad.lines === 2, ad);
  check('…"better" is marked only on efficiency metrics, and never where both ads show the same figure', ad.rows.every((r) => !r.best || (['ctr', 'cpc', 'cpm', 'conversion rate', 'cpa', 'roas'].includes(r.m.toLowerCase()) && r.a !== r.b)) && ad.rows.some((r) => r.best), ad.rows);
  const secondAd = await p.evaluate(() => Array.from(document.querySelectorAll('#ovtAds [data-ovc-ad="B"] option')).filter((o) => !o.disabled && !o.selected)[0].value);
  await p.selectOption('#ovtAds [data-ovc-ad="B"]', secondAd); await p.waitForTimeout(2500);
  check('…choosing another ad recalculates', await p.evaluate((v) => document.querySelector('#ovtAds [data-ovc-ad="B"]').value === v && document.querySelectorAll('#ovtAds .ova-line').length === 2, secondAd));
  await p.selectOption('#ovtAds [data-ovc-admetric]', 'cpc'); await p.waitForTimeout(1500);
  check('…and the chart metric can be changed', await p.evaluate(() => /CPC over time/.test(document.querySelector('#ovtAds .ovc-adchart h4').textContent)));
  await p.screenshot({ path: path.join(SHOTS, 'overview-meta.png'), fullPage: true });

  // Per platform: different metric sets; TikTok and Snapchat graphs from their own figures
  await p.evaluate(() => window.prfSwitchPlatform('snapchat', true)); await p.waitForTimeout(3000);
  c = await cards(p);
  gr = await p.evaluate(() => { const card = document.querySelector('#prfChartsGrid .prf-chart-card'); return { locked: !!card.querySelector('.prf-lock-show'), lock: (card.querySelector('.prf-chart-lock') || {}).innerText || '', bars: card.querySelectorAll('.prf-bars *').length }; });
  pd = await per();
  check('Snapchat Ads: no Conversions, CPA, Conversion value or ROAS cards (not reported), the others with values', !c.some((x) => /^(Conversions|CPA|Conversion Value|ROAS)$/i.test(x.n)) && c.some((x) => x.n === 'Impressions' && x.v !== '—'), c.map((x) => x.n));
  check('Snapchat Ads: the graph shows Snapchat’s own daily figures (before: none, or other platforms’ figures)', !gr.locked && gr.bars > 0, gr);
  check('Snapchat Ads: the period comparison leaves out what Snapchat doesn’t report', !pd.rows.some((r) => /^(Conversions|CPA|ROAS)$/.test(r[0])) && pd.rows.some((r) => r[0] === 'CTR'), pd.rows.map((r) => r[0]));
  await p.evaluate(() => window.prfSwitchPlatform('tiktok', true)); await p.waitForTimeout(3000);
  c = await cards(p);
  gr = await p.evaluate(() => { const card = document.querySelector('#prfChartsGrid .prf-chart-card'); return { locked: !!card.querySelector('.prf-lock-show'), bars: card.querySelectorAll('.prf-bars *').length }; });
  check('TikTok Ads: no ROAS / Conversion value cards; the graph has TikTok’s daily figures (before: "no analytics yet")', !c.some((x) => /^(ROAS|Conversion Value)$/i.test(x.n)) && c.some((x) => x.n === 'Conversions') && !gr.locked && gr.bars > 0, { cards: c.map((x) => x.n), gr });
  // Not connected
  await p.evaluate(() => { const C = window.orvCampaignSources, orig = C.status; window.__origStatus = orig; C.status = (pl) => (pl === 'pinterest' ? Promise.resolve({ conn: 'not_connected', currency: null }) : orig(pl)); window.orvAnalytics.reset(); window._prfConnectedPlatforms = (window._prfConnectedPlatforms || []).filter((x) => x !== 'pinterest'); window.prfSwitchPlatform('pinterest', true); }); await p.waitForTimeout(2500);
  const nc = await p.evaluate(() => ({ period: document.getElementById('ovtPeriod').innerText, ads: document.getElementById('ovtAds').innerText }));
  check('a platform that isn’t connected: the comparison says "Connect Pinterest Ads to compare periods" (no figures, no banner)', /Connect Pinterest Ads to compare periods/.test(nc.period) && !/\d+%/.test(nc.period), nc);

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
  check('a rule-based summary: shares of conversions vs spend, the highest CPA, "no AI"; Snapchat (no conversions reported) left out and said so', /% of conversions on \d+% of spend/.test(pc.summary) && /highest CPA/.test(pc.summary) && /no AI/.test(pc.summary) && /Snapchat Ads doesn’t report conversions/.test(pc.summary), pc.summary);
  const snapConv = await p.evaluate(() => Array.from(document.querySelectorAll('#ccmRoot .pcm-table tbody tr')).filter((tr) => /^(Conversions|CPA)$/.test(tr.querySelector('th').textContent)).map((tr) => tr.children[5].textContent));
  check('Snapchat conversions and CPA read "Not reported" (never 0 or "no conversions")', snapConv.join() === 'Not reported,Not reported', snapConv);
  check('one line chart with a line per platform', pc.legend.join() === 'Google,Meta,TikTok,Pinterest,Snapchat', pc.legend);
  const sumShare = pc.shares.reduce((a, b) => a + b, 0);
  check('share of spend vs share of conversions for the platforms that report conversions (spend shares add up to ~100%)', pc.share === 4 && sumShare >= 98 && sumShare <= 102, pc.shares);
  await p.screenshot({ path: path.join(SHOTS, 'platforms-desktop.png'), fullPage: false });
  await p.selectOption('#ccmRoot [data-pcm-metric]', 'conversions'); await p.waitForTimeout(500);
  check('the chart metric can be changed (conversions: no line for Snapchat)', await p.evaluate(() => /Conversions per platform/.test(document.querySelector('#ccmRoot .pcm-chart svg').getAttribute('aria-label')) && !Array.from(document.querySelectorAll('#ccmRoot .pcm-chart .ova-legend li')).some((l) => l.textContent === 'Snapchat')));
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
  for (const vp of [{ width: 820, height: 1100, n: 'tablet', cards: 2 }, { width: 390, height: 844, n: 'mobile', cards: 1 }]) {
    ({ ctx, p } = await boot({ width: vp.width, height: vp.height }));
    await go(p, 'overview', 4000);
    const tc = await p.evaluate(() => { const g = document.getElementById('prfExplorerGrid'), ch = document.querySelector('#prfDash .prf-chart-wrap').getBoundingClientRect(), per = document.getElementById('ovtPeriod').getBoundingClientRect(), th = document.querySelector('#ovtPeriod thead');
      return { cols: (function (t) { var tops = Array.from(t.children).map(function (c) { return Math.round(c.getBoundingClientRect().top); }); return tops.filter(function (x) { return x === tops[0]; }).length; })(g.querySelector('.prf-mgroup-tiles')), stacked: Math.abs(ch.width - per.width) < 2 && per.top > ch.top, tableHead: th ? getComputedStyle(th).display : null, overflow: document.documentElement.scrollWidth - innerWidth, wide: Array.from(document.querySelectorAll('#page-performance *')).filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && !e.closest('#prfPlatTabsInner') && !e.closest('.prf-chart-body') && getComputedStyle(e).position !== 'fixed'; }).length }; });
    check(vp.n + ': metric cards ' + (vp.n === 'mobile' ? '2' : '2+') + ' per row in a group, graph and comparison stacked, nothing wider than the screen' + (vp.n === 'mobile' ? ', comparison table as one block per metric' : ''), (vp.n === 'mobile' ? tc.cols === 2 && tc.tableHead === 'none' : tc.cols >= 2) && tc.stacked && tc.overflow <= 0 && tc.wide === 0, tc);
    await p.screenshot({ path: path.join(SHOTS, 'overview-' + vp.n + '.png'), fullPage: true });
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
