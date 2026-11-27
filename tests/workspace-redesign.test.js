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
  const want = [['Overview', ['Dashboard', 'AI Plans & Tasks', 'Needs Attention']], ['Campaigns', ['Campaigns', 'Ad Simulator']], ['Creative Studio', ['Create Ads', 'My Creatives', 'Creative Testing']], ['Analytics', ['Performance Overview', 'Cross-platform Comparison', 'Ads vs Ads']], ['Research', ['Audience Research', 'Competitive Research', 'Saved Research']], ['Autopilot', ['Automation Overview', 'My Automations', 'Automation History']]];
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
  // Since 2026-11-26 Advertising Settings lives inside Settings (Settings → Advertising settings → a platform).
  check('no separate Advertising Settings item in the sidebar', await p.evaluate(() => !document.querySelector('.orv-sb [data-onv-foot="adsettings"]')));
  await p.click('.orv-sb [data-onv-foot="settings"]'); await p.waitForTimeout(700);
  check('Settings shows two groups: General settings and Advertising settings (Meta, Google, TikTok, Pinterest, Snapchat)', await p.evaluate(() => {
    const h = [...document.querySelectorAll('#modal-settings .smd-grp-h')].map((e) => e.textContent.trim());
    const gen = [...document.querySelectorAll('#modal-settings .smd-grp:first-child .smd-ni')].map((e) => e.getAttribute('data-smd'));
    const ads = [...document.querySelectorAll('#modal-settings [data-smd-ads]')].map((e) => e.getAttribute('data-smd-ads'));
    return JSON.stringify(h) === '["General settings","Advertising settings"]' && JSON.stringify(gen) === '["general","account","notifications","security","subscription","help"]' && JSON.stringify(ads) === '["meta","google","tiktok","pinterest","snapchat"]';
  }));
  await p.click('#modal-settings [data-smd-ads="meta"]'); await p.waitForTimeout(2200);
  // Since the second design pass the platform's settings open inside Settings itself (no page change).
  check('Settings → Advertising settings → Meta shows Meta’s settings inside Settings (modal stays open, no page change, Meta selected)', await p.evaluate(() => !!document.querySelector('#modal-settings.open') && !!document.querySelector('#modal-settings #smdp-ads.active #asetEmbedRoot .aset-ctx') && /Meta Ads/.test(document.querySelector('#smdp-ads .aset-emb-t').textContent) && document.querySelector('#modal-settings .smd-ai.active').getAttribute('data-smd-ads') === 'meta' && !document.querySelector('#modal-settings .smd-ni.active') && !document.querySelector('#page-ad-settings.active') && !/view=adsettings/.test(location.search)));
  check('the selected platform and ad account are shown', await p.evaluate(() => /Meta Ads/.test(document.querySelector('.aset-ctx').textContent) && /Ad account/.test(document.querySelector('.aset-ctx').textContent)));
  const links = [];
  const rows = {};
  for (const pl of ['meta', 'google', 'tiktok', 'pinterest', 'snapchat']) {
    await p.click('#modal-settings [data-smd-ads="' + pl + '"]'); await p.waitForTimeout(1200);
    const d = await p.evaluate(() => ({ still: !!document.querySelector('#modal-settings.open') && !document.querySelector('#page-ad-settings.active'), plat: document.querySelector('#modal-settings .smd-ai.active').textContent + ' ' + document.querySelector('#smdp-ads .aset-emb-t').textContent, ctx: document.querySelector('.aset-ctx b').textContent, links: Array.from(document.querySelectorAll('.aset-ext')).map((a) => a.href), rows: document.querySelectorAll('.aset-matrix tbody tr').length, text: document.querySelector('#asetEmbedRoot').textContent }));
    links.push(...d.links); rows[pl] = d.rows;
    check(pl + ': Settings shows only this platform, without leaving Settings (navigation + context agree)', d.still && d.ctx.toLowerCase().startsWith(pl === 'tiktok' ? 'tiktok' : pl) && d.plat.toLowerCase().includes(pl === 'tiktok' ? 'tiktok' : pl), d);
    check(pl + ': never claims "Active" from an id alone', !/\bActive\b/.test(d.text.replace(/Pinterest status: ACTIVE/g, '')), d.text.match(/.{40}\bActive\b.{40}/));
    check(pl + (pl === 'snapchat' ? ': no OrivenAI actions, so no verification notice' : ': its OrivenAI actions say they are not yet verified with a real account'),
      pl === 'snapchat' ? !/not yet verified/i.test(d.text) : /In OrivenAI · not yet verified with a real account/.test(d.text), d.text.slice(0, 300));
  }
  const hosts = links.map((u) => new URL(u).hostname);
  check('every external setup link goes to an official platform domain', links.length >= 5 && hosts.every((h) => /(^|\.)(facebook\.com|google\.com|tiktok\.com|pinterest\.com|snapchat\.com|snap\.com)$/.test(h)), hosts);
  check('each platform lists what can be configured where', Object.values(rows).every((n) => n >= 3), rows);
  await p.click('#modal-settings [data-smd-ads="tiktok"]'); await p.waitForTimeout(500);
  check('TikTok: the actions need a pixel code first (disabled until entered)', await p.evaluate(() => document.querySelector('[data-aset-ttlink]').disabled && document.querySelector('[data-aset-ask="ttTest"]').disabled));
  await p.fill('[data-aset-in="tiktokCode"]', 'C1TEST');
  await p.click('[data-aset-ask="ttTest"]'); await p.waitForTimeout(200);
  check('sending a test event asks for confirmation first, naming platform, account and effect', await p.evaluate(() => { const c = document.querySelector('.aset-confirm'); return !!c && /TikTok Ads/.test(c.textContent) && /real event/.test(c.textContent); }));
  await p.click('[data-aset-cancel]');
  await p.click('#modal-settings [data-smd-ads="meta"]'); await p.waitForTimeout(1200);
  const metaCards = await p.evaluate(() => ({ connected: /Connected/.test(document.querySelector('.aset-ctx').textContent), notice: document.querySelectorAll('[data-aset-unverified="meta"]').length }));
  check('Meta: the pixel card itself carries the “not yet verified with a real ad account” notice (when connected)', !metaCards.connected || metaCards.notice >= 1, metaCards);

  // ── 3b. Language switch ──────────────────────────────────────
  await p.evaluate(() => { window.CURRENT_LANG = 'nl'; window.applyLanguage(); }); await p.waitForTimeout(400);
  check('language: Advertising Settings redraws in Dutch, with the not-verified notice translated', await p.evaluate(() => { const t = document.querySelector('#asetEmbedRoot').textContent; return /Advertentie-instellingen/.test(t) && /nog niet geverifieerd met een echt account/.test(t) && !/What you can configure/.test(t); }));
  await p.evaluate(() => closeModal('modal-settings'));
  await p.evaluate(() => window.orvAppNav.go('simulator')); await p.waitForTimeout(700);
  await p.click('[data-asim-view="lab"]'); await p.waitForTimeout(400);
  check('language: Ad Simulator is in Dutch (Scenario Lab, compare, method)', await p.evaluate(() => { const t = document.querySelector('#asimRoot').textContent; return /Scenariolab/.test(t) && /Scenario’s vergelijken/.test(t) && /Hoe deze cijfers tot stand komen/.test(t) && !/Compare scenarios/.test(t); }));
  await p.evaluate(() => { window.CURRENT_LANG = 'en'; window.applyLanguage(); }); await p.waitForTimeout(300);
  check('language: back to English', await p.evaluate(() => /Compare scenarios/.test(document.querySelector('#asimRoot').textContent)));

  // ── 3c. Refinement 2026-11-25: structure and alignment ───────
  const bottoms = (sel) => p.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((e) => Math.round(e.getBoundingClientRect().bottom)), sel);
  await p.evaluate(() => window.orvAppNav.go('research')); await p.waitForTimeout(900);
  // 2026-11-26: Audience Research and Competitive Research are separate pages, each with only its own research types.
  const aud = await p.evaluate(() => ({ h: document.querySelector('#rsRoot h1').textContent, dirs: Array.from(document.querySelectorAll('#rsRoot .rx-dir')).map((d) => d.dataset.dir) }));
  await p.evaluate(() => window.orvAppNav.go('competitive')); await p.waitForTimeout(700);
  const comp = await p.evaluate(() => ({ h: document.querySelector('#rsRoot h1').textContent, dirs: Array.from(document.querySelectorAll('#rsRoot .rx-dir')).map((d) => d.dataset.dir), on: document.querySelector('.orv-sb .onv-item.is-on').dataset.onv }));
  check('Audience Research shows only audience research; Competitive Research only competitive research (Competitive Research highlighted)', aud.h === 'Audience Research' && JSON.stringify(aud.dirs) === '["audience","product","trends"]' && comp.h === 'Competitive Research' && JSON.stringify(comp.dirs) === '["competitor","advertising","market","opportunity"]' && comp.on === 'competitive', { aud, comp });
  await p.evaluate(() => window.orvAppNav.go('progress')); await p.waitForTimeout(1500);
  const tk = await p.evaluate(() => { const r = document.querySelector('#prgRoot .prg-rail'), m = document.querySelector('#prgRoot .prg-main'); return r && m ? { rail: Math.round(r.getBoundingClientRect().bottom), main: Math.round(m.getBoundingClientRect().bottom), ai: document.querySelectorAll('#prgRoot .prg-who--ai').length, you: document.querySelectorAll('#prgRoot .prg-who--you').length } : null; });
  check('Tasks: the summary column ends level with the phases; tasks say who does them (OrivenAI can do this / Up to you)', tk && Math.abs(tk.rail - tk.main) <= 2 && tk.ai > 0 && tk.you > 0, tk);
  await p.click('#prgRoot [data-prg-exec-ask]'); await p.waitForTimeout(300);
  check('Tasks: "Let OrivenAI do it" asks first and says the task ticks off only when OrivenAI sees the result', await p.evaluate(() => { const a = document.querySelector('.prg-exec-ask'); return !!a && /ticks off once OrivenAI sees the result/.test(a.textContent) && !!a.querySelector('[data-prg-exec-go]'); }));
  await p.click('[data-prg-exec-cancel]'); await p.waitForTimeout(200);
  await p.evaluate(() => window.orvAppNav.go('adstudio')); await p.waitForTimeout(1500);
  const cm = await p.evaluate(() => ({ tiles: document.querySelectorAll('#cmxSum .cmx-tile').length, list: !!document.querySelector('.cmx-list #lqFilters'), side: document.querySelectorAll('#cmxSide > .cmx-card').length, b: [Math.round(document.querySelector('.cmx-list').getBoundingClientRect().bottom), Math.round(document.querySelector('#cmxSide').getBoundingClientRect().bottom)] }));
  check('Campaigns: four summary cards, the list card with its filters, three side cards; both columns end level', cm.tiles === 4 && cm.list && cm.side === 3 && Math.abs(cm.b[0] - cm.b[1]) <= 2, cm);
  await p.evaluate(() => window.orvAppNav.go('simulator')); await p.waitForTimeout(700);
  await p.evaluate(() => { if (!window.orvAdSimulator._state().sim) document.querySelector('[data-asim-start]').click(); }); await p.waitForTimeout(400);
  const sb = await bottoms('.asim-grid > .asim-setup, .asim-grid .asim-results');
  check('Ad Simulator: Assumptions and Results end level; What if spans below them', sb.length === 2 && Math.abs(sb[0] - sb[1]) <= 2 && await p.evaluate(() => { const w = document.querySelector('.asim-whatif').getBoundingClientRect(), g = document.querySelector('.asim-grid').getBoundingClientRect(); return w.width > g.width * 0.95; }), sb);
  await p.evaluate(() => { document.querySelector('.asim-adv').open = true; }); await p.waitForTimeout(200);
  const sb2 = await bottoms('.asim-grid > .asim-setup, .asim-grid .asim-results');
  check('Ad Simulator: opening Advanced assumptions keeps the two cards level', Math.abs(sb2[0] - sb2[1]) <= 2, sb2);

  // ── 3d. Product structure 2026-11-26 ─────────────────────────
  await p.evaluate(() => window.orvAppNav.go('dashboard')); await p.waitForTimeout(3500);
  const dsh = await p.evaluate(() => ({ perf: !!document.querySelector('#dshRoot .dsh-perf [data-dsh="campaign"]') && !!document.querySelector('#dshRoot .dsh-perf [data-dsh="metric"]'), kpis: document.querySelectorAll('#dshRoot .dsh-kpi').length, chart: !!document.querySelector('#dshRoot .dsh-chart svg'), cards: ['.dsh-attn', '.dsh-plats', '.dsh-campcard', '.dsh-reccard', '.dsh-auto'].every((c) => !!document.querySelector('#dshRoot ' + c)), old: !!(document.getElementById('owNeeds') || {}).offsetParent }));
  check('Dashboard: Performance with a campaign and a metric selector, four key figures and a chart; Needs attention, platforms, top campaigns, recommendations and Autopilot; the old blocks are not shown', dsh.perf && dsh.kpis === 4 && dsh.chart && dsh.cards && !dsh.old, dsh);
  await p.click('#dshRoot [data-dsh-metric="spend"]'); await p.waitForTimeout(300);
  check('Dashboard: choosing a figure makes it the chart metric', await p.evaluate(() => document.querySelector('#dshRoot [data-dsh-metric="spend"]').classList.contains('is-on') && document.querySelector('#dshRoot [data-dsh="metric"]').value === 'spend'));
  await p.evaluate(() => window.orvAppNav.go('attention')); await p.waitForTimeout(3000);
  const nda = await p.evaluate(() => ({ page: document.querySelector('.page.active').id, cards: document.querySelectorAll('#ndaRoot .nda-card').length, tiles: document.querySelectorAll('#ndaRoot .nda-tile').length, items: document.querySelectorAll('#ndaRoot .nda-item').length, on: document.querySelector('.orv-sb .onv-item.is-on').dataset.onv }));
  check('Needs Attention: its own page with four summary tiles and one card per category (accounts, tracking, performance, campaigns, automations) plus how it is checked', nda.page === 'page-needs-attention' && nda.on === 'attention' && nda.tiles === 4 && nda.cards === 6 && nda.items >= 1, nda);
  await p.evaluate(() => window.orvAppNav.go('plan')); await p.waitForTimeout(1500);
  check('AI Plans & Tasks: one destination with Plans and Tasks tabs', await p.evaluate(() => document.querySelectorAll('#page-marketing-plan .pt-tab').length === 2 && document.querySelector('#page-marketing-plan .pt-tab.is-on').textContent.indexOf('Plans') === 0));
  await p.click('#page-marketing-plan .pt-tab[data-mpl-go="progress"]'); await p.waitForTimeout(1500);
  check('…the Tasks tab opens the tasks, AI Plans & Tasks stays highlighted', await p.evaluate(() => document.querySelector('.page.active').id === 'page-progress' && document.querySelector('.orv-sb .onv-item.is-on').dataset.onv === 'plan' && document.querySelector('#page-progress .pt-tab.is-on').textContent.indexOf('Tasks') === 0));
  await p.evaluate(() => window.orvAppNav.go('adsvsads')); await p.waitForTimeout(3000);
  check('Ads vs Ads: its own Analytics page with the two-ad comparison', await p.evaluate(() => document.querySelector('.page.active').id === 'page-ads-vs-ads' && document.querySelectorAll('#advCard select').length >= 2));

  // ── 3e. Second design pass: help, neutral surfaces, assistant identity ──
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-settings'); if (window.orvCloseAi) window.orvCloseAi(); window.orvAppNav.go('dashboard'); }); await p.waitForTimeout(1500);
  const helpIds = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.orv-sb .onv-item[data-onv]')].map((b) => b.getAttribute('data-onv'));
    const helps = [...document.querySelectorAll('.orv-sb .onv-help[data-onv-help]')].map((b) => b.getAttribute('data-onv-help'));
    return { items, helps, missing: items.filter((x) => helps.indexOf(x) < 0 || !window.orvNavHelp.text(x)), foot: ['settings', 'platforms'].every((x) => helps.indexOf(x) >= 0 && window.orvNavHelp.text(x)), nested: !!document.querySelector('.onv-item .onv-help') };
  });
  check('every sidebar destination (and Settings, Ad Platforms) has a “?” with its own explanation — never inside the link itself', helpIds.items.length === 17 && !helpIds.missing.length && helpIds.foot && !helpIds.nested, helpIds);
  const calm = await p.evaluate(() => getComputedStyle(document.querySelector('.orv-sb .onv-help[data-onv-help="simulator"]')).opacity);
  check('the “?” stays out of sight until its row is hovered or focused (no clutter)', calm === '0', calm);
  await p.hover('.orv-sb .onv-item[data-onv="simulator"]'); await p.waitForTimeout(250);
  await p.hover('.orv-sb .onv-help[data-onv-help="simulator"]'); await p.waitForTimeout(350);
  const tipH = await p.evaluate(() => { const t = document.getElementById('onvTip'), r = t.getBoundingClientRect(), sb = document.querySelector('.orv-sb').getBoundingClientRect(); return { shown: !t.hidden, text: t.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, sbRight: sb.right, vw: innerWidth, vh: innerHeight, page: document.querySelector('.page.active').id }; });
  check('hovering the “?” explains the page in a tooltip beside the sidebar, fully inside the window', tipH.shown && /Ad Simulator/.test(tipH.text) && /simulation/i.test(tipH.text) && tipH.left >= tipH.sbRight && tipH.right <= tipH.vw && tipH.top >= 0 && tipH.bottom <= tipH.vh, tipH);
  await p.mouse.move(900, 600); await p.waitForTimeout(400);
  await p.focus('.orv-sb .onv-help[data-onv-help="compare"]'); await p.waitForTimeout(250);
  const tipK = await p.evaluate(() => ({ shown: !document.getElementById('onvTip').hidden, text: document.getElementById('onvTip').textContent, desc: document.querySelector('.orv-sb .onv-help[data-onv-help="compare"]').getAttribute('aria-describedby') }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  const tipEsc = await p.evaluate(() => document.getElementById('onvTip').hidden);
  check('keyboard: focusing the “?” shows the tooltip (linked with aria-describedby), Escape closes it', tipK.shown && /budget/.test(tipK.text) && tipK.desc === 'onvTip' && tipEsc, { tipK, tipEsc });
  await p.click('.orv-sb .onv-help[data-onv-help="insights"]'); await p.waitForTimeout(500);
  check('clicking the “?” explains, it doesn’t open the page', await p.evaluate(() => document.querySelector('.page.active').id !== 'page-insights' && !document.getElementById('onvTip').hidden && /research/i.test(document.getElementById('onvTip').textContent)));
  await p.mouse.click(900, 700); await p.waitForTimeout(200);
  const look = await p.evaluate(() => {
    const bg = (el) => el ? getComputedStyle(el).backgroundColor : null;
    const ic = document.querySelector('.orv-sb .onv-mom__ic'), cs = getComputedStyle(ic), after = getComputedStyle(ic, '::after');
    return { canvas: bg(document.querySelector('.mc')), card: bg(document.querySelector('#bizPanelOverview .dsh-card')), sidebar: bg(document.querySelector('.orv-sb')),
      anim: [cs.animationName, after.animationName, getComputedStyle(ic.querySelector('.onv-mom__core') || ic, '').animationName], afterContent: after.content };
  });
  const green = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ''); return m ? (+m[2] - Math.max(+m[1], +m[3])) : 99; };
  check('the canvas, sidebar and cards are neutral charcoal (no green surfaces)', green(look.canvas) <= 3 && green(look.card) <= 4 && green(look.sidebar) <= 3, look);
  check('the assistant’s icon is static: no rotating or scanning animation', look.anim.every((a) => a === 'none') && (look.afterContent === 'none' || look.afterContent === 'normal'), look);
  const persona = await p.evaluate(() => {
    const item = document.querySelector('.orv-sb [data-onv-foot="assistant"]'), live = item.querySelector('.onv-mom__live');
    const fab = document.getElementById('orvAiFab');
    const navOn = document.querySelector('.orv-sb .onv-item.is-on:not(.onv-mom)');
    return { agent: fab.getAttribute('data-agent'), agentRgb: fab.style.getPropertyValue('--orv-agent-rgb').replace(/\s/g, ''), live: getComputedStyle(live).backgroundColor.replace(/\s/g, ''), navOn: navOn ? getComputedStyle(navOn).backgroundColor : null, btn: getComputedStyle(document.querySelector('[data-asim-start], .dsh-btn--primary, .rx-btn-primary') || document.body).backgroundColor };
  });
  check('the assistant item wears the chosen persona’s colour, not the app green', !!persona.agent && persona.live === 'rgb(' + persona.agentRgb + ')', persona);
  // Pretend the persona were Momentum: the assistant turns orange, the rest of the app keeps its green.
  const mo = await p.evaluate(async () => {
    const a = window.orvAgent.current(); const keep = Object.assign({}, a);
    Object.assign(a, { id: 'momentum', name: 'Momentum', color: '#FF8A3D' }); window.orvAgent.apply(); await new Promise((r) => setTimeout(r, 200));
    window.orvAppNavAssistant.open(); await new Promise((r) => setTimeout(r, 500));
    const item = document.querySelector('.orv-sb [data-onv-foot="assistant"]');
    const out = { hello: document.getElementById('orvAgentHelloText').textContent, live: getComputedStyle(item.querySelector('.onv-mom__live')).backgroundColor, head: getComputedStyle(document.querySelector('#orvAiPanel .orv-ai-panel-head')).boxShadow,
      navOn: getComputedStyle(document.querySelector('.orv-sb .onv-item.is-on:not(.onv-mom)') || document.body).backgroundColor, green: getComputedStyle(document.documentElement).getPropertyValue('--orv-green').trim() };
    window.orvCloseAi(); Object.assign(a, keep); window.orvAgent.apply();
    return out;
  });
  check('Momentum: “Hey, I am Momentum…”, orange on the assistant’s own elements; the app’s navigation keeps the OrivenAI green', /^Hey, I am Momentum\./.test(mo.hello) && mo.live === 'rgb(255, 138, 61)' && /255, 138, 61/.test(mo.head) && !/255, 138, 61/.test(mo.navOn) && mo.green.toUpperCase() === '#B7FF2A', mo);

  // ── 3f. Refinement round: greeting, spacing, Create modes, metrics, headings ──
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-settings'); if (window.orvCloseAi) window.orvCloseAi(); window.orvAppNav.go('dashboard'); }); await p.waitForTimeout(1500);
  await p.evaluate(() => window.orvAppNavSetFirstName('Alex Morgan')); await p.waitForTimeout(300);
  const greet = await p.evaluate(() => ({ h: document.querySelector('#dshRoot [data-dsh-greeting]').textContent, range: !!document.querySelector('#dshRoot select[data-dsh="range"], #dshRoot .dsh-range'), period: /\bPeriod\b/.test(document.querySelector('#dshRoot .dsh-head').textContent) }));
  check('Dashboard greets the signed-in person by first name only (“…, Alex.”), never the workspace name', /^Good (morning|afternoon|evening), Alex\.$/.test(greet.h) && !/Oriven/i.test(greet.h), greet);
  check('Dashboard has no period selector and no “Period” label', !greet.range && !greet.period, greet);
  await p.evaluate(() => window.orvAppNavSetFirstName('OrivenAI')); await p.waitForTimeout(200);
  check('a name that is just the product name is not used as a greeting name', /^Good (morning|afternoon|evening)\.$/.test(await p.evaluate(() => document.querySelector('#dshRoot [data-dsh-greeting]').textContent)));
  await p.evaluate(() => window.orvAppNavSetFirstName('Alex'));
  const frame = [];
  for (const v of ['dashboard', 'attention', 'simulator', 'testing', 'compare', 'research', 'insights', 'overview', 'auto-overview']) {
    await p.evaluate((v) => window.orvAppNav.go(v), v); await p.waitForTimeout(900);
    frame.push(await p.evaluate((v) => {
      const pg = document.querySelector('.page.active'), mc = document.querySelector('.mc').getBoundingClientRect();
      const wrap = [...pg.children].find((c) => c.offsetHeight > 40 && !/notif/.test(c.className));
      const cs = getComputedStyle(wrap);
      return { v, top: parseInt(cs.paddingTop), bottom: parseInt(cs.paddingBottom), left: parseInt(cs.paddingLeft), right: parseInt(cs.paddingRight), above: Math.round(pg.getBoundingClientRect().top - mc.top) };
    }, v));
  }
  check('every page uses the same frame as Needs Attention: 24px top, bottom and sides at 1440px, nothing above the page', frame.every((f) => f.top === 24 && f.bottom === 24 && f.left === 24 && f.right === 24 && f.above === 0), frame);
  await p.evaluate(() => window.orvAppNav.go('adstudio')); await p.waitForTimeout(900);
  check('Campaigns: the sidebar says “Campaigns”, the heading says what it is for (“Campaign Studio”)', await p.evaluate(() => document.querySelector('#page-launch .lq-hdr-title').textContent === 'Campaign Studio' && document.querySelector('.orv-sb .onv-item[data-onv="adstudio"] .onv-lbl').textContent === 'Campaigns'));
  await p.evaluate(() => { try { localStorage.clear(); } catch (_) {} window.orvAppNav.go('create'); window.orvCreateModes.choose(null); }); await p.waitForTimeout(900);
  const ch = await p.evaluate(() => ({ opts: [...document.querySelectorAll('#crmRoot [data-crm-choose]')].map((b) => b.getAttribute('data-crm-choose') + ':' + b.querySelector('.crm-opt__t').textContent), aiHidden: getComputedStyle(document.querySelector('#page-create .cr2-workspace-row')).display === 'none' }));
  check('Create Ads starts with a choice: Create with AI or Create manually (the AI steps wait until AI is chosen)', JSON.stringify(ch.opts) === JSON.stringify(['ai:Create with AI', 'manual:Create manually']) && ch.aiHidden, ch);
  await p.click('[data-crm-choose="ai"]'); await p.waitForTimeout(500);
  check('Create with AI shows the existing guided flow, unchanged, with a way to switch', await p.evaluate(() => getComputedStyle(document.querySelector('#page-create .cr2-workspace-row')).display !== 'none' && !!document.querySelector('#cfSteps li') && !document.getElementById('crmSwitch').hidden));
  await p.click('#crmSwitch'); await p.waitForTimeout(500);
  const m1 = await p.evaluate(() => ({ h: document.querySelector('#crmRoot h2').textContent, plats: [...document.querySelectorAll('[data-crm-plat]')].map((b) => b.getAttribute('data-crm-plat')), next: document.querySelector('[data-crm-next]').disabled, ai: getComputedStyle(document.querySelector('#page-create .cr2-workspace-row')).display }));
  check('Create manually asks the platform FIRST (Meta, Google, TikTok, Pinterest, Snapchat); Next is disabled until one is chosen', m1.h === 'Which advertising platform do you want to create an ad for?' && JSON.stringify(m1.plats) === '["meta","google","tiktok","pinterest","snapchat"]' && m1.next && m1.ai === 'none', m1);
  await p.click('[data-crm-plat="tiktok"]'); await p.click('[data-crm-next]'); await p.waitForTimeout(300);
  const tt = await p.evaluate(() => ({ h: document.querySelector('#crmRoot h2').textContent, goals: [...document.querySelectorAll('#crmRoot input[name="crmGoal"]')].map((i) => i.value + (i.disabled ? '-' : '+')) }));
  check('TikTok manual: campaign step, with only the goals OrivenAI can publish on TikTok enabled (Traffic, Awareness)', tt.h === 'Campaign' && JSON.stringify(tt.goals.slice().sort()) === '["Awareness+","Leads-","Sales-","Traffic+"]', tt);
  await p.click('[data-crm-next]'); await p.waitForTimeout(300);
  const err = await p.evaluate(() => [...document.querySelectorAll('#crmRoot .crm-errs li')].map((l) => l.textContent));
  check('the form says what is missing before continuing (name, objective, budget)', err.length >= 3 && err.some((x) => /name/.test(x)) && err.some((x) => /budget/.test(x)), err);
  await p.fill('[data-crm="name"]', 'Video visits'); await p.check('input[name="crmGoal"][value="Traffic"]'); await p.fill('[data-crm="budget"]', '30'); await p.click('[data-crm-next]'); await p.waitForTimeout(400);
  if (await p.$('[data-crm-country="NL"]')) await p.click('[data-crm-country="NL"]'); else await p.fill('[data-crm="countries"]', 'NL');
  await p.click('[data-crm-next]'); await p.waitForTimeout(300);
  const ad = await p.evaluate(() => ({ h: document.querySelector('#crmRoot h2').textContent, video: !!document.querySelector('[data-crm-file="0:0:video"]'), image: !!document.querySelector('#crmRoot [data-crm-file$=":image"]'), text: !!document.querySelector('[data-crm-a="0:0:adText"]'), addGroup: !!document.querySelector('[data-crm-addgroup]'), addAd: !!document.querySelector('[data-crm-addad="0"]') }));
  check('TikTok manual: the ads step is the hierarchy (ad groups → ads); each ad asks for ad text and a video (no image upload)', ad.h === 'Ad groups and ads' && ad.video && !ad.image && ad.text && ad.addGroup && ad.addAd, ad);
  await p.fill('[data-crm-a="0:0:adText"]', 'First ad');
  await p.click('[data-crm-addad="0"]'); await p.waitForTimeout(150);
  await p.fill('[data-crm-a="0:1:adText"]', 'Second ad');
  await p.click('[data-crm-addgroup]'); await p.waitForTimeout(150);
  await p.fill('[data-crm-g="1:name"]', 'Second ad group');
  let st = await p.evaluate(() => { const d = window.orvCreateModes.state(); return { groups: d.groups.length, ads0: d.groups[0].ads.map((a) => a.adText), name1: d.groups[1].name, summary: document.querySelector('[data-ad="0:1"] summary').textContent }; });
  check('several ad groups and ads: add an ad and an ad group, each with its own content', st.groups === 2 && JSON.stringify(st.ads0) === '["First ad","Second ad"]' && st.name1 === 'Second ad group' && /Second ad/.test(st.summary), st);
  await p.click('[data-crm-dupad="0:0"]'); await p.waitForTimeout(150);
  p.once('dialog', (dlg) => dlg.accept());
  await p.click('[data-crm-rmad="0:2"]'); await p.waitForTimeout(150);
  st = await p.evaluate(() => window.orvCreateModes.state().groups[0].ads.map((a) => a.adText));
  check('duplicate an ad (copy right after it) and remove one (asks first when it has content)', JSON.stringify(st) === '["First ad","First ad"]', st);
  // Mode switching keeps the unfinished draft, in both directions, repeatedly.
  const modeNow = () => p.evaluate(() => ({ mode: window.orvCreateModes.mode(), ai: getComputedStyle(document.querySelector('#page-create .cr2-workspace-row')).display !== 'none', manualUi: !!document.querySelector('#crmRoot .crm-wiz'), sw: document.getElementById('crmSwitch').textContent, step: window.orvCreateModes.state().step, groups: window.orvCreateModes.state().groups.length, first: window.orvCreateModes.state().groups[0].ads[0].adText }));
  await p.click('#crmSwitch'); await p.waitForTimeout(300);
  let m = await modeNow();
  check('Manual → AI: “Switch to Create with AI” really opens the AI flow (and offers the way back)', m.mode === 'ai' && m.ai && !m.manualUi && m.sw === 'Create manually instead', m);
  await p.click('#crmSwitch'); await p.waitForTimeout(300);
  m = await modeNow();
  check('AI → Manual: back in the manual flow at the same step, with the unfinished draft intact', m.mode === 'manual' && !m.ai && m.manualUi && m.step === 4 && m.groups === 2 && m.first === 'First ad' && m.sw === 'Switch to Create with AI', m);
  for (let i = 0; i < 3; i++) { await p.click('#crmSwitch'); await p.waitForTimeout(120); await p.click('#crmSwitch'); await p.waitForTimeout(120); }
  m = await modeNow();
  check('switching back and forth several times never gets stuck or loses the draft', m.mode === 'manual' && m.manualUi && m.groups === 2 && m.first === 'First ad', m);
  await p.evaluate(() => window.orvAppNav.go('dashboard')); await p.waitForTimeout(600);
  await p.evaluate(() => window.orvAppNav.go('create')); await p.waitForTimeout(800);
  m = await modeNow();
  check('after leaving Create Ads and coming back: same mode and draft, and the switch still works', m.mode === 'manual' && m.groups === 2 && m.first === 'First ad', m);
  await p.click('#crmSwitch'); await p.waitForTimeout(300);
  check('…the switch works after coming back', (await modeNow()).mode === 'ai');
  await p.click('#crmSwitch'); await p.waitForTimeout(300);
  p.once('dialog', (dlg) => dlg.dismiss());
  await p.click('[data-crm-discard]'); await p.waitForTimeout(200);
  const kept = await p.evaluate(() => window.orvCreateModes.state().groups[0].ads[0].adText);
  p.once('dialog', (dlg) => dlg.accept());
  await p.click('[data-crm-discard]'); await p.waitForTimeout(200);
  const gone = await p.evaluate(() => ({ platform: window.orvCreateModes.state().platform, step: window.orvCreateModes.state().step }));
  check('discarding asks first: cancel keeps the draft, confirm clears it', kept === 'First ad' && gone.platform === null && gone.step === 1, { kept, gone });
  await p.evaluate(() => window.orvAppNav.go('content')); await p.waitForTimeout(900);
  check('My Creatives says where each item came from (made with AI or uploaded) when that is known', await p.evaluate(() => [...document.querySelectorAll('#mclRoot .mcl-info span')].some((s) => /Made with AI|Uploaded by you/.test(s.textContent))));
  await p.evaluate(() => window.orvAppNav.go('overview')); await p.waitForTimeout(1600);
  const pm = await p.evaluate(() => { const h = document.getElementById('prfPlatformMetrics'); return { ok: !!h, text: h ? h.textContent : '', nums: h ? h.querySelectorAll('.pfm-m dd').length : -1 }; });
  check('Performance Overview has a Platform metrics section that, in the demo, says it needs a real account (no invented numbers)', pm.ok && /Platform metrics/.test(pm.text) && /aren’t part of the demo|couldn’t be loaded|isn’t connected/.test(pm.text) && !/reports no extra metrics/.test(pm.text) && pm.nums === 0, pm);
  const defs = await p.evaluate(() => { const D = window.orvPlatformMetrics.DEF; return Object.keys(D).every((k) => D[k][0] && D[k][2] && (D[k][2]['*'] || Object.keys(D[k][2]).length)); });
  check('every platform metric has a label and a definition of how the platform counts it', defs);

  // ── 4. Phones ────────────────────────────────────────────────
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const q = await phone.newPage(); q.on('pageerror', (e) => errors.push('phone: ' + e.message));
  await q.goto(BASE + '/demo-app', { waitUntil: 'load' }); await q.waitForTimeout(6000);
  await q.evaluate(() => window.orvAppNav.go('simulator')); await q.waitForTimeout(700);
  await q.evaluate(() => { document.querySelector('[data-asim-qp="google"]').click(); document.querySelector('[data-asim-start]').click(); }); await q.waitForTimeout(500);
  const o1 = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await q.evaluate(() => window.orvAdSettings.open('google')); await q.waitForTimeout(1200);
  const o2 = await q.evaluate(() => { const c = document.querySelector('#smdp-ads'); return Math.max(document.documentElement.scrollWidth - innerWidth, c && document.querySelector('#modal-settings.open') ? c.scrollWidth - c.clientWidth : 99); });
  check('phones: Ad Simulator, and Advertising Settings inside Settings, have no sideways overflow', o1 <= 0 && o2 <= 0, { o1, o2 });
  await phone.close();

  await browser.close(); srv.close();
  check('no page errors', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
