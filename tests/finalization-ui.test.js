// ════════════════════════════════════════════════════════════════
// Product finalization (2026-11-18), in the demo app (/demo-app: sample
// data for every request, no backend): Dashboard cards (performance,
// campaigns, automations, a compact "Needs you"), Creative Testing
// "Compare two" (creative vs performance comparison), the assistant
// launcher panel (arrow attached on its left; the whole panel slides), Automations overview and Scheduler layout.
// Fenced (tests/_fence.js): only this test's static server is reachable.
// RUN: node tests/finalization-ui.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8983, BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, '_shots', 'finalization'); fs.mkdirSync(SHOTS, { recursive: true });
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
    await p.goto(BASE + '/demo-app', { waitUntil: 'load' }); await p.waitForTimeout(6500);
    return { ctx, p };
  }
  const go = async (p, id, ms) => { await p.evaluate((x) => window.orvAppNav.go(x), id); await p.waitForTimeout(ms || 3500); };

  // ── 1. Dashboard ──
  let { ctx, p } = await boot();
  const d = await p.evaluate(() => {
    const figs = Array.from(document.querySelectorAll('#ovPerf .op-fig')).map((f) => ({ l: f.querySelector('.op-fig-l').textContent, v: f.querySelector('.op-fig-v').textContent.trim(), d: (f.querySelector('.op-fig-d') || {}).textContent || '' }));
    const camps = Array.from(document.querySelectorAll('#ovCamps .ccx-stat')).map((s) => s.querySelector('.ccx-stat-l').textContent + '=' + s.querySelector('.ccx-stat-v').innerText.trim());
    const auto = Array.from(document.querySelectorAll('#ovAuto .ccx-stat')).map((s) => s.querySelector('.ccx-stat-l').textContent + '=' + s.querySelector('.ccx-stat-v').innerText.trim());
    const recent = Array.from(document.querySelectorAll('#ovAuto .ccx-alist li')).map((li) => li.innerText.replace(/\s+/g, ' '));
    const mc = document.querySelector('.mc');
    return { figs, camps, auto, recent, total: (document.querySelector('#ovCamps .ccx-camps-total') || {}).textContent || '', scroll: mc ? mc.scrollHeight - mc.clientHeight : 0, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  check('Dashboard performance: Impressions, Clicks, CTR, Spend, Conversions (ROAS only when reported), real values, change vs the 7 days before', ['Impressions', 'Clicks', 'CTR', 'Spend', 'Conversions'].every((l, i) => d.figs[i] && d.figs[i].l === l && d.figs[i].v && d.figs[i].v !== '—') && d.figs.some((f) => /%/.test(f.d)), d.figs);
  check('Dashboard campaigns: active and paused on the ad platforms, drafts not published yet, need attention, and the total on the platforms', /^Active=\d+$/.test(d.camps[0]) && /^Paused=\d+$/.test(d.camps[1]) && /^Drafts=\d+$/.test(d.camps[2]) && /^Need attention=\d+$/.test(d.camps[3]) && /\d+ campaigns on your ad platforms/.test(d.total), [d.camps, d.total]);
  check('Dashboard automations: active, paused, need attention, errors (7 days) and the recent real runs', /^Active=\d+$/.test(d.auto[0]) && /^Paused=\d+$/.test(d.auto[1]) && /^Need attention=\d+$/.test(d.auto[2]) && /^Errors · 7 days=\d+$/.test(d.auto[3]) && d.recent.length >= 1, [d.auto, d.recent]);
  // 2026-11-26: the new Dashboard (performance first) may scroll as a page; it must never scroll sideways.
  check('Dashboard: the new overview is shown (Performance, Needs attention, Autopilot) and nothing scrolls sideways', d.overflow <= 0 && await p.evaluate(() => !!document.querySelector('#dshRoot .dsh-perf') && !!document.querySelector('#dshRoot .dsh-attn') && !!document.querySelector('#dshRoot .dsh-auto')), d);
  await p.screenshot({ path: path.join(SHOTS, 'dashboard.png') });
  // Nothing needs the user: one compact status line, no big empty panel
  await p.evaluate(() => { document.querySelectorAll('#owNeeds [data-rank]').forEach((r) => r.remove()); window.orvCC.needsSync(); });
  await p.waitForTimeout(300);
  const calm = await p.evaluate(() => { const c = document.getElementById('owNeeds'); return { calm: c.classList.contains('is-calm'), h: Math.round(c.getBoundingClientRect().height), text: c.innerText.replace(/\s+/g, ' ') }; });
  check('"Needs you" with nothing to show is a single compact status line (≤ 60px)', calm.calm && calm.h <= 60 && /caught up|Nothing needs/i.test(calm.text), calm);
  await ctx.close();

  // ── 2. Creative Testing: Compare two ──
  ({ ctx, p } = await boot({ width: 1440, height: 1100 }));
  await go(p, 'testing', 4500);
  const lay = await p.evaluate(() => { const a = document.querySelector('.cts-top > section:first-child').getBoundingClientRect(), b = document.querySelector('.cts-cmp').getBoundingClientRect(); return { side: Math.abs(a.top - b.top) < 2 && a.right <= b.left }; });
  check('Testing layout: "New variations" and "Compare two" side by side (not stacked full width)', lay.side, lay);
  const opts = await p.evaluate(() => Array.from(document.querySelectorAll('#ctsCmpA option')).map((o) => o.value).filter(Boolean));
  check('Compare two offers variations, My Content (ads, images) and live Meta ads', opts.some((o) => o.startsWith('v:')) && opts.some((o) => o.startsWith('a:')) && opts.filter((o) => o.startsWith('m:')).length >= 2, opts.length);
  await p.selectOption('#ctsCmpA', opts.find((o) => o.startsWith('v:'))); await p.waitForTimeout(300);
  await p.selectOption('#ctsCmpB', opts.find((o) => o.startsWith('a:img'))); await p.waitForTimeout(500);
  let cmp = await p.evaluate(() => ({ sides: document.querySelectorAll('.cts-sides .cts-side').length, tag: (document.querySelector('.cts-creative .cts-tag') || {}).textContent, diff: Array.from(document.querySelectorAll('.cts-diff li')).map((l) => l.textContent), perf: !!document.querySelector('.cts-perf'), note: (document.querySelector('.cts-note') || {}).textContent || '' }));
  check('version vs image: side by side, a creative comparison of the content (what differs), and no performance claim', cmp.sides === 2 && /the content, not results/.test(cmp.tag) && cmp.diff.length >= 1 && !cmp.perf && /neither is a proven winner/.test(cmp.note), cmp);
  const live = opts.filter((o) => o.startsWith('m:'));
  await p.selectOption('#ctsCmpA', live[0]); await p.waitForTimeout(300);
  await p.selectOption('#ctsCmpB', live[1]); await p.waitForTimeout(500);
  cmp = await p.evaluate(() => ({ tag: (document.querySelector('.cts-perf .cts-tag') || {}).textContent || '', verdict: (document.querySelector('.cts-verdict') || {}).textContent || '', rows: Array.from(document.querySelectorAll('.cts-table tbody tr')).map((tr) => tr.querySelector('th').textContent) }));
  check('two live ads: a performance comparison from real results, with a verdict and why', /real results/.test(cmp.tag) && /performs better|brought conversions|clicked more often|about the same|Too early/.test(cmp.verdict) && cmp.rows.join() === 'Impressions,Clicks,CTR,CPC,Spend,Conversions,CPA', cmp);
  await p.screenshot({ path: path.join(SHOTS, 'testing.png') });
  await ctx.close();

  // ── 3. The assistant: opened from the sidebar (2026-11-26), no floating launcher ──
  for (const vp of [{ width: 1440, height: 900, n: 'desktop' }, { width: 390, height: 844, n: 'mobile' }]) {
    ({ ctx, p } = await boot({ width: vp.width, height: vp.height }));
    const mob = vp.width <= 1024;
    const floating = await p.evaluate(() => { const d = document.getElementById('orvAiDock'); return !!d && getComputedStyle(d).display !== 'none'; });
    check(vp.n + ': no floating assistant button in the corner', !floating);
    if (mob) { await p.click('#orvMobToggle'); await p.waitForTimeout(350); }
    const item = (mob ? '.orv-mob-drawer' : '.orv-sb') + ' [data-onv-foot="assistant"]';
    const order = await p.evaluate((sel) => [...document.querySelector(sel).closest('.onv-foot').querySelectorAll('[data-onv-foot]')].map((b) => b.getAttribute('data-onv-foot')), item);
    check(vp.n + ': the assistant sits above the account, below Ad Platforms', JSON.stringify(order) === '["settings","platforms","assistant","account"]', order);
    await p.click(item); await p.waitForTimeout(800);
    const st = await p.evaluate(() => { const pn = document.getElementById('orvAiPanel'), r = pn.getBoundingClientRect(); return { open: pn.classList.contains('orv-ai-open'), ws: document.body.classList.contains('orv-ai-ws'), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, ov: document.documentElement.scrollWidth - innerWidth }; });
    check(vp.n + ': it opens the chat workspace (wide, tall, no sideways overflow)', st.open && st.ws && st.w >= (mob ? st.vw - 1 : 1000) && st.h >= 600 && st.ov <= 0, st);
    if (!mob) {
      await p.click('.orv-sb .onv-item[data-onv="overview"]'); await p.waitForTimeout(1500);
      const after = await p.evaluate(() => ({ open: document.getElementById('orvAiPanel').classList.contains('orv-ai-open'), page: (document.querySelector('.page.active') || {}).id }));
      check(vp.n + ': opening a page from the sidebar closes the workspace and shows the page', !after.open && after.page === 'page-performance', after);
    } else {
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      check(vp.n + ': Escape closes it', !(await p.evaluate(() => document.getElementById('orvAiPanel').classList.contains('orv-ai-open'))));
    }
    await ctx.close();
  }

  // ── 4. Automations: overview counts incl. Paused; Scheduler side by side ──
  ({ ctx, p } = await boot());
  await go(p, 'auto-overview', 3500);
  const ao = await p.evaluate(() => Array.from(document.querySelectorAll('.atm-tiles > *')).map((t) => t.innerText.replace(/\s+/g, ' ').trim()));
  check('Automations overview: Active, Paused, Scheduled runs, Awaiting approval, Done · 7 days, Failed · 7 days', ao.length === 6 && /Active/.test(ao[0]) && /Paused/.test(ao[1]) && /Failed/.test(ao[5]), ao);
  await go(p, 'auto-scheduler', 3000);
  const sc = await p.evaluate(() => { const m = document.querySelector('.atm-split-main'), s = document.querySelector('.atm-split-side'); if (!m || !s) return null; const a = m.getBoundingClientRect(), b = s.getBoundingClientRect(); return { side: Math.abs(a.top - b.top) < 2 && a.right <= b.left, runs: s.querySelectorAll('.atm-jobs li').length }; });
  check('Scheduler: the schedules and the upcoming runs side by side', sc && sc.side && sc.runs >= 1, sc);
  await ctx.close();

  await browser.close(); srv.close();
  check('no request left the page (sample data answered inside it)', outside.length === 0, outside.slice(0, 8));
  check('no page errors', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
