/* ════════════════════════════════════════════════════════════════
   Automations page (formerly Autopilot) — end to end in a real browser.

   No real backend, no Supabase, no AI, no credits, no ad accounts: a local
   static server serves this repo, Supabase is blocked and every /api/* call
   is answered by a stateful in-test mock of /api/automations/* shaped like
   server/routes/automationRoutes.js. Records every request so the tests can
   check exactly what the page sends.

   Covers: navigation + labels, empty / locked / error / DB-missing states,
   creating a rule (payload, idempotency key, cost shown first), automatic
   budget rule consent + limits, insufficient credits, scheduling (business
   hours template, timezone), Scheduler / Rules / Activity tabs, cancel a
   run, approve / reject, toggle, delete, pause all, settings, keyboard,
   all six languages, light + dark, desktop + mobile (no sideways scroll),
   and that nothing in the app still calls the retired /api/autopilot/*.

   RUN: node tests/automations-ui.test.js
   ════════════════════════════════════════════════════════════════ */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8917, BASE = 'http://127.0.0.1:' + PORT;
const SHOT_DIR = path.join(__dirname, '_shots', 'automations');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (u === '/') u = '/app.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
}).listen(PORT);

let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }
const iso = (ms) => new Date(Date.now() + ms).toISOString();

// ── Stateful mock of the Automations API ─────────────────────────────
function freshState() {
  return {
    automations: [], approvals: [], jobs: [], activity: [], pausedAll: false,
    settings: { pausedAll: false, notifyInApp: true, notifyEmail: true, emailEvents: ['executed', 'failed', 'approval'] },
    calls: [], legacy: [], overviewStatus: 200, overviewBody: null, createStatus: null, accountsConnected: { google: true, meta: true, tiktok: false, pinterest: false },
  };
}
const CAMPAIGNS = {
  meta: { account: { id: 'act_1', currency: 'EUR' }, campaigns: [
    { id: 'm1', name: 'Spring Sale', status: 'active', budget: { scope: 'adsets', amount: 40, currency: 'EUR', editable: true, adsets: 2 } },
    { id: 'm2', name: 'Retargeting', status: 'paused', budget: { scope: 'campaign', amount: 15, currency: 'EUR', editable: true, adsets: 0 } }] },
  google: { account: { id: '123', currency: 'USD' }, campaigns: [
    { id: 'g1', name: 'Brand Search', status: 'active', budget: { scope: 'shared', amount: 30, currency: 'USD', editable: false, reason: 'shared_budget' } }] },
};
function view(a) { return Object.assign({ enabled: true, status: 'active', blocked: null, lastResult: null, nextRun: null, currency: 'EUR' }, a); }
async function arm(page, S) {
  await page.route('**/*supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }));
  await page.route('**/api/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    const json = (status, obj) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (/^\/api\/autopilot\//.test(p)) S.legacy.push(m + ' ' + p);
    if (/^\/api\/automations/.test(p)) S.calls.push({ m, p, q: u.search, body, headers: req.headers() });
    if (p === '/api/credits/status') return json(200, { balance: 1000, plan: 'starter', monthlyAllowance: 1000, featureCosts: { automation: 50 } });
    if (p === '/api/automations/overview') {
      if (S.overviewStatus !== 200) return json(S.overviewStatus, S.overviewBody || { error: 'x' });
      const live = S.automations;
      return json(200, {
        counts: { active: live.filter((a) => a.enabled).length, rules: live.filter((a) => a.kind === 'rule').length, schedules: live.filter((a) => a.kind === 'schedule').length, scheduled: S.jobs.length, pendingApprovals: S.approvals.length, completed7d: S.activity.filter((e) => e.status === 'completed').length, failed7d: S.activity.filter((e) => e.status === 'failed').length, managedCampaigns: 1, accountWide: [] },
        nextRun: S.jobs[0] || null, lastCheckAt: iso(-30 * 60e3), pausedAll: S.pausedAll,
        accounts: ['google', 'meta', 'tiktok', 'pinterest'].map((pl) => ({ platform: pl, connected: !!S.accountsConnected[pl] })),
        system: { executionEnabled: true, backgroundJobs: true, rulesEveryMinutes: 240 },
      });
    }
    if (p === '/api/automations/capabilities') return json(200, { cost: 50, platforms: [{ platform: 'meta', metrics: ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpc', 'cpa', 'roas', 'status'] }, { platform: 'google', metrics: ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpc', 'cpa', 'roas', 'status'] }, { platform: 'tiktok', metrics: ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpc', 'cpa', 'status'] }], defaultMinData: { cpa: { conversions: 3 } } });
    if (p === '/api/automations/campaigns') { const c = CAMPAIGNS[u.searchParams.get('platform')]; return c ? json(200, c) : json(409, { error: 'Connect TikTok Ads first.', code: 'not_connected' }); }
    if (p === '/api/automations/settings') { if (m === 'PUT') { Object.assign(S.settings, body); return json(200, { ok: true }); } return json(200, { settings: S.settings }); }
    if (p === '/api/automations/approvals') return json(200, { approvals: S.approvals });
    if (p === '/api/automations/jobs') return json(200, { jobs: S.jobs });
    if (p === '/api/automations/activity') { const st = u.searchParams.get('status'); const aid = u.searchParams.get('automation_id'); return json(200, { items: S.activity.filter((e) => (!st || e.status === st) && (!aid || e.automation_id === aid)) }); }
    if (p === '/api/automations/pause-all' || p === '/api/automations/resume-all') { S.pausedAll = p.endsWith('pause-all'); return json(200, { ok: true, pausedAll: S.pausedAll }); }
    let mm;
    if ((mm = /^\/api\/automations\/approvals\/([^/]+)\/(approve|reject)$/.exec(p))) { S.approvals = S.approvals.filter((a) => a.id !== mm[1]); return json(200, { ok: true, status: mm[2] === 'approve' ? 'completed' : 'rejected' }); }
    if ((mm = /^\/api\/automations\/jobs\/([^/]+)\/cancel$/.exec(p))) { S.jobs = S.jobs.filter((j) => j.id !== mm[1]); return json(200, { ok: true }); }
    if ((mm = /^\/api\/automations\/([^/]+)\/(pause|resume)$/.exec(p))) { const a = S.automations.find((x) => x.id === mm[1]); a.enabled = mm[2] === 'resume'; return json(200, { ok: true, automation: a }); }
    if ((mm = /^\/api\/automations\/([^/]+)$/.exec(p)) && m === 'DELETE') { S.automations = S.automations.filter((x) => x.id !== mm[1]); return json(200, { ok: true }); }
    if ((mm = /^\/api\/automations\/([^/]+)$/.exec(p)) && m === 'PATCH') { const a = S.automations.find((x) => x.id === mm[1]); Object.assign(a, { name: body.name }); return json(200, { ok: true, automation: a }); }
    if (p === '/api/automations' && m === 'POST') {
      if (S.createStatus) return json(S.createStatus.status, S.createStatus.body);
      if (body.kind === 'rule' && body.action === 'increase_budget' && !(body.limits && body.limits.max_budget)) return json(400, { error: 'Check the highlighted fields.', errors: [{ field: 'limits.max_budget', code: 'max_budget_required', message: 'Set a maximum daily budget before raising budgets.' }] });
      if (body.mode === 'automatic' && /budget|pause|resume/.test(body.action) && !body.confirm_automatic) return json(400, { error: 'x', errors: [{ field: 'confirm_automatic', message: 'Confirm that OrivenAI may make this change automatically.' }] });
      const a = view({ id: 'auto-' + (S.automations.length + 1), name: body.name, kind: body.kind, platform: body.platform, scope: Object.assign({}, body.scope, { campaigns: (body.scope.campaign_ids || []).map((id) => ({ id, name: (CAMPAIGNS[body.platform].campaigns.find((c) => c.id === id) || {}).name })) }), condition: body.condition || null, window: body.window, action: body.action || null, mode: body.mode || null, percent: body.percent || null, limits: body.limits || null, schedule: body.schedule || null });
      S.automations.unshift(a);
      return json(200, { ok: true, automation: a, charged: 50 });
    }
    if (p === '/api/automations') return json(200, { automations: S.automations });
    return json(200, {});
  });
}
async function enter(page, S) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window._getAccessToken = async function () { return 'mock-token'; };
    if (window.orvTour) { window.orvTour.open = function () {}; try { window.orvTour.close(); } catch (_) {} }
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-automations', email: 'mock@example.invalid' });
    window._dbSubscriptionStatus = 'starter';
  });
  await page.evaluate(() => { window.__lastNav = { id: null, at: performance.now() }; setInterval(function () { var a = document.querySelector('.page.active'); var id = a && a.id; if (id !== window.__lastNav.id) window.__lastNav = { id: id, at: performance.now() }; }, 100); });
  for (let i = 0; i < 150; i++) { await page.waitForTimeout(200); const quiet = await page.evaluate(() => performance.now() - window.__lastNav.at > 3000 && performance.now() > 8500); if (quiet) break; }
  await go(page);
  return errors;
}
async function go(page) {
  await page.evaluate(() => { if (window.orvTour) { try { window.orvTour.close(); } catch (_) {} } var b = document.getElementById('orvConsentBanner'); if (b) b.remove(); _orvNav('autopilot', 'page-autopilot'); });
  await page.waitForFunction(() => { var r = document.getElementById('auRoot'); return r && !r.querySelector('.atm-loading') && r.querySelector('.atm-head'); }, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
}
const reload = (page) => page.evaluate(() => orvAutomations.reload()).then(() => page.waitForTimeout(150));
const text = (page, sel) => page.$eval(sel, (e) => e.innerText).catch(() => null);
async function confirmDialog(page) { await page.waitForSelector('.ofd-backdrop .ofd-foot button', { timeout: 3000 }); const btns = await page.$$('.ofd-backdrop .ofd-foot button'); await btns[btns.length - 1].click(); await page.waitForTimeout(250); }
async function tab(page, name) { await page.click('#auTab-' + name); await page.waitForTimeout(120); }
const lastCall = (S, m, p) => S.calls.filter((c) => c.m === m && (p instanceof RegExp ? p.test(c.p) : c.p === p)).pop();
async function noSideScroll(page) { return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && Array.from(document.querySelectorAll('#auRoot *, #auModal *')).filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > window.innerWidth + 1; }).map((e) => e.className).slice(0, 5)); }

(async () => {
  const browser = await chromium.launch();
  try {
    // ── 1. Desktop, light, English ─────────────────────────────────────
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await ctx.newPage();
    const S = freshState();
    await arm(page, S);
    const errors = await enter(page, S);

    check('Automations page is the active page', await page.evaluate(() => document.querySelector('.page.active').id === 'page-autopilot'));
    check('page title says Automations', (await text(page, '.atm-title')) === 'Automations');
    const lay = await page.evaluate(() => { const b = document.querySelector('[data-au="settings"]'); const w = document.querySelector('.atm-wrap').getBoundingClientRect(); const head = document.querySelector('.atm-head-actions').getBoundingClientRect(), title = document.querySelector('.atm-title').getBoundingClientRect(); return { label: b && b.getAttribute('aria-label'), title: b && b.getAttribute('title'), svg: b ? b.querySelector('svg').innerHTML : '', w: Math.round(w.width), actionsBesideTitle: head.top < title.bottom + 40 && head.left > title.right, rail: !!document.querySelector('.atm-ovgrid .atm-ovrail'), railLeft: document.querySelector('.atm-ovrail') ? Math.round(document.querySelector('.atm-ovrail').getBoundingClientRect().left) : 0, mainRight: document.querySelector('.atm-ovmain') ? Math.round(document.querySelector('.atm-ovmain').getBoundingClientRect().right) : 0 }; });
    check('settings button: sliders icon (not the sun-like one), labelled "Automation settings"', lay.label === 'Automation settings' && lay.title === 'Automation settings' && (lay.svg.match(/<circle/g) || []).length === 3 && !/M8 1.5v2/.test(lay.svg), lay);
    check('wider operations layout at 1366: content uses the page width, actions beside the title, rail beside the main column', lay.w >= 1200 && lay.actionsBesideTitle && lay.rail && lay.railLeft > lay.mainRight, lay);
    check('sidebar label renamed', await page.evaluate(() => Array.from(document.querySelectorAll('.orv-ni[data-orv-page="autopilot"] .orv-ni-label')).every((e) => e.textContent.trim() === 'Automations')));
    check('old Autopilot script no longer loaded', await page.evaluate(() => typeof window.apWizStart === 'undefined' && typeof window.orvAutomations === 'object'));
    check('four tabs with roles', await page.evaluate(() => document.querySelectorAll('#auRoot [role="tab"]').length === 4 && document.querySelector('#auRoot [role="tabpanel"]') !== null));
    const empty = await text(page, '.atm-empty');
    check('empty state explains what can be automated', /Nothing is automated yet/.test(empty || '') && /business hours/.test(empty || ''), empty);
    check('status shows check interval', /Running · rules checked every 4 h/.test((await text(page, '.atm-pill')) || ''), await text(page, '.atm-pill'));
    const accts = await text(page, '.atm-accts');
    check('connected accounts listed honestly', /Google Ads\s*Connected/.test(accts) && /TikTok Ads\s*Not connected/.test(accts), accts);
    check('Launch is named as the place to build campaigns', /use Launch/.test((await text(page, '.atm-note')) || ''));
    await page.screenshot({ path: path.join(SHOT_DIR, 'empty-desktop-light.png'), fullPage: true });

    // ── 2. Create a rule (approval mode) ───────────────────────────────
    await page.click('#auRoot [data-au="new-rule"]');
    await page.waitForSelector('#auModal .atm-builder');
    check('builder opens as a dialog', await page.evaluate(() => document.getElementById('auModal').style.display === 'flex' && document.getElementById('auModal').getAttribute('aria-modal') === 'true'));
    const tik = await text(page, '#auModal .atm-cards');
    check('platform cards include TikTok with not-connected hint', /TikTok Ads\s*Not connected yet/.test(tik), tik);
    await page.click('#auModal input[data-bf="platform"][value="meta"]', { force: true });
    await page.waitForSelector('#auModal .atm-camps');
    const camps = await text(page, '#auModal .atm-camps');
    check('campaigns read live with budget scope', /Spring Sale/.test(camps) && /spread over 2 ad sets/.test(camps), camps);
    await page.click('#auModal input[data-bf="camp"][value="m1"]', { force: true });
    await page.selectOption('#auModal select[data-bf="metric"]', 'cpa');
    await page.fill('#auModal input[data-bf="value"]', '30');
    await page.locator('#auModal input[data-bf="value"]').dispatchEvent('change');
    check('metric has a beginner description', /Average amount spent to get one conversion/.test((await text(page, '#auModal')) || ''));
    // default mode = approval, action = pause
    const sum = await text(page, '#auModal .atm-summary');
    check('human-readable summary before saving', /When “Spring Sale” has cost per conversion \(cpa\) more than €30\.00 over the last 7 day\(s\), OrivenAI will ask you to approve: pause it\./.test(sum), sum);
    const cost = await text(page, '#auModal .atm-cost');
    check('cost 50 credits shown before creation', /Cost: 50 credits/i.test(cost) && /Deleting doesn’t refund/.test(cost), cost);
    check('submit button names the cost', /Create automation · 50 credits/.test((await text(page, '#auModal [data-bf="submit"]')) || ''));
    await page.fill('#auModal input[data-bf="name"]', 'Pause expensive ads');
    await page.click('#auModal [data-bf="submit"]');
    await page.waitForTimeout(500);
    const post = lastCall(S, 'POST', '/api/automations');
    check('create sends an idempotency key', post && /^[0-9a-f-]{20,}$/i.test(post.headers['x-idempotency-key'] || ''), post && post.headers);
    check('create payload: stable campaign id, condition, mode, no consent', post && post.body.platform === 'meta' && JSON.stringify(post.body.scope) === JSON.stringify({ type: 'campaigns', campaign_ids: ['m1'] }) && post.body.condition.metric === 'cpa' && post.body.condition.value === 30 && post.body.condition.operator === '>' && post.body.mode === 'approval' && post.body.action === 'pause_campaign' && post.body.confirm_automatic === false && post.body.window === 7, post && post.body);
    check('modal closes after create', await page.evaluate(() => document.getElementById('auModal').style.display === 'none'));
    await tab(page, 'rules');
    const card = await text(page, '#auRoot .atm-auto');
    check('rule card shows name, mode and summary', /Pause expensive ads/.test(card) && /Asks first/.test(card) && /Meta Ads/.test(card), card);

    // ── 3. Automatic budget rule: max budget + consent ─────────────────
    await page.click('#auRoot [data-au="new-rule"]');
    await page.waitForSelector('#auModal .atm-builder');
    await page.click('#auModal input[data-bf="platform"][value="meta"]', { force: true });
    await page.waitForSelector('#auModal .atm-camps');
    await page.click('#auModal input[data-bf="scopeType"][value="account"]', { force: true });
    await page.waitForTimeout(80);
    check('account-wide scope hides campaign list and explains it', !(await page.$('#auModal .atm-camps')) && /Includes campaigns you add later/.test((await text(page, '#auModal')) || ''));
    await page.selectOption('#auModal select[data-bf="metric"]', 'roas');
    await page.fill('#auModal input[data-bf="value"]', '3');
    await page.locator('#auModal input[data-bf="value"]').dispatchEvent('change');
    await page.click('#auModal input[data-bf="mode"][value="automatic"]', { force: true });
    await page.click('#auModal input[data-bf="action"][value="increase_budget"]', { force: true });
    check('consent checkbox appears for automatic changes', !!(await page.$('#auModal input[data-bf="consent"]')));
    check('maximum budget field is required', !!(await page.$('#auModal input[data-k="max_budget"][required]')));
    await page.click('#auModal [data-bf="submit"]');
    await page.waitForTimeout(350);
    const err1 = await text(page, '#auModal [role="alert"]');
    check('missing max budget is refused with a plain message', /Set a maximum daily budget/.test(err1 || ''), err1);
    const k1 = lastCall(S, 'POST', '/api/automations').headers['x-idempotency-key'];
    await page.fill('#auModal input[data-k="max_budget"]', '80');
    await page.locator('#auModal input[data-k="max_budget"]').dispatchEvent('change');
    await page.click('#auModal input[data-bf="consent"]');
    await page.waitForTimeout(80);
    const sum2 = await text(page, '#auModal .atm-summary');
    check('summary names the cap', /automatically raise its daily budget by 15% \(never above €80\.00\)/.test(sum2), sum2);
    await page.click('#auModal [data-bf="submit"]');
    await page.waitForTimeout(450);
    const post2 = lastCall(S, 'POST', '/api/automations');
    check('retry after refusal uses a new idempotency key', post2.headers['x-idempotency-key'] && post2.headers['x-idempotency-key'] !== k1);
    check('automatic payload carries consent and limits', post2.body.confirm_automatic === true && post2.body.limits.max_budget === 80 && post2.body.percent === 15 && post2.body.scope.type === 'account' && post2.body.limits.max_actions_per_day === 2, post2.body);

    // ── 4. Insufficient credits ────────────────────────────────────────
    S.createStatus = { status: 402, body: { error: 'Not enough credits.', code: 'CREDITS_EXHAUSTED' } };
    await page.click('#auRoot [data-au="new-rule"]');
    await page.waitForSelector('#auModal .atm-builder');
    await page.click('#auModal input[data-bf="platform"][value="meta"]', { force: true });
    await page.waitForSelector('#auModal .atm-camps');
    await page.click('#auModal input[data-bf="camp"][value="m2"]', { force: true });
    await page.fill('#auModal input[data-bf="value"]', '100');
    await page.locator('#auModal input[data-bf="value"]').dispatchEvent('change');
    await page.click('#auModal [data-bf="submit"]');
    await page.waitForTimeout(350);
    check('insufficient credits explained, dialog stays open', /costs 50 credits\. You don’t have enough/.test((await text(page, '#auModal [role="alert"]')) || '') && await page.evaluate(() => document.getElementById('auModal').style.display === 'flex'));
    S.createStatus = null;
    await page.keyboard.press('Escape');
    check('Escape closes the dialog', await page.evaluate(() => document.getElementById('auModal').style.display === 'none'));

    // ── 5. Schedule (business hours) ───────────────────────────────────
    await page.click('#auRoot [data-au="new-schedule"]');
    await page.waitForSelector('#auModal .atm-builder');
    await page.click('#auModal input[data-bf="platform"][value="meta"]', { force: true });
    await page.waitForSelector('#auModal .atm-camps');
    await page.click('#auModal input[data-bf="camp"][value="m1"]', { force: true });
    await page.click('#auModal [data-bf="tpl-hours"]');
    await page.waitForTimeout(80);
    check('schedule has no metric step', !(await page.$('#auModal select[data-bf="metric"]')));
    check('DST and missed-run behaviour explained', /daylight saving time/.test((await text(page, '#auModal')) || '') && /never run late/.test((await text(page, '#auModal')) || ''));
    await page.selectOption('#auModal select[data-bf="tz"]', 'Europe/Amsterdam');
    const ssum = await text(page, '#auModal .atm-summary');
    check('schedule summary in plain words', /Switch on every Monday, Tuesday, Wednesday, Thursday, Friday at 09:00; Pause every Monday, Tuesday, Wednesday, Thursday, Friday at 18:00\. \(Europe\/Amsterdam\)/.test(ssum), ssum);
    await page.click('#auModal [data-bf="submit"]');
    await page.waitForTimeout(450);
    const post3 = lastCall(S, 'POST', '/api/automations');
    check('schedule payload: weekly items + IANA timezone', post3.body.kind === 'schedule' && post3.body.schedule.timezone === 'Europe/Amsterdam' && post3.body.schedule.items.length === 2 && post3.body.schedule.items[0].action === 'activate' && JSON.stringify(post3.body.schedule.items[0].days) === '[1,2,3,4,5]' && post3.body.schedule.items[1].time === '18:00', post3.body);

    // A once-only stop cannot be weekly
    await page.click('#auRoot [data-au="new-schedule"]');
    await page.waitForSelector('#auModal .atm-builder');
    await page.click('#auModal input[data-bf="platform"][value="meta"]', { force: true });
    await page.waitForSelector('#auModal .atm-camps');
    await page.selectOption('#auModal select[data-bf="it-action"]', 'stop');
    check('“stop” only offers “once”', await page.$$eval('#auModal select[data-bf="it-type"] option', (o) => o.map((x) => x.value).join()) === 'once');
    await page.keyboard.press('Escape');

    // ── 6. Scheduler tab: upcoming runs + cancel ───────────────────────
    S.jobs = [{ id: 'job-1', automation_id: 'auto-3', action: 'activate', campaign_id: 'm1', campaign_name: 'Spring Sale', platform: 'meta', run_at: iso(3 * 3600e3), local_time: '2026-10-19T09:00', timezone: 'Europe/Amsterdam' }];
    S.automations.find((a) => a.kind === 'schedule').nextRun = { runAt: S.jobs[0].run_at, action: 'activate', campaignName: 'Spring Sale' };
    await reload(page);
    await tab(page, 'scheduler');
    const sched = await text(page, '#auPanel');
    check('scheduler lists upcoming runs in local time + zone', /09:00 \(Europe\/Amsterdam\)/.test(sched) && /Switch on · Spring Sale/.test(sched), sched);
    check('schedule card shows next run', /Next: Switch on · Spring Sale/.test(sched), sched);
    await page.click('#auRoot [data-au="cancel-job"][data-id="job-1"]');
    await page.waitForTimeout(300);
    check('cancel run calls the job cancel endpoint', !!lastCall(S, 'POST', '/api/automations/jobs/job-1/cancel'));
    check('cancelled run disappears', /No upcoming runs/.test((await text(page, '#auPanel')) || ''));

    // ── 7. Approvals on Overview ───────────────────────────────────────
    S.approvals = [{ id: 'ap-1', automation_id: 'auto-1', platform: 'meta', campaign_id: 'm1', campaign_name: 'Spring Sale', action: 'pause_campaign', params: {}, observed: { metric: 'cpa', operator: '>', threshold: 30, observed: 41.5, window_days: 7 }, expires_at: iso(40 * 3600e3), status: 'pending' },
      { id: 'ap-2', automation_id: 'auto-1', platform: 'meta', campaign_id: 'm2', campaign_name: 'Retargeting', action: 'pause_campaign', params: {}, observed: {}, expires_at: iso(2 * 3600e3), status: 'pending' }];
    await reload(page);
    await tab(page, 'overview');
    const ov = await text(page, '#auPanel');
    check('approval shows campaign, reason and expiry', /Pause · Spring Sale/.test(ov) && /Because Cost per conversion \(CPA\) was 41\.5/.test(ov) && /expires in 40 h/.test(ov), ov);
    check('overview tab shows approval count', /Overview\s*2/.test((await text(page, '#auTab-overview')) || ''));
    await page.click('#auRoot [data-au="approve"][data-id="ap-1"]');
    await confirmDialog(page);
    await page.waitForTimeout(300);
    check('approve asks first, then calls approve once', S.calls.filter((c) => c.p === '/api/automations/approvals/ap-1/approve').length === 1);
    await page.click('#auRoot [data-au="reject"][data-id="ap-2"]');
    await page.waitForTimeout(350);
    check('reject calls reject', !!lastCall(S, 'POST', '/api/automations/approvals/ap-2/reject'));
    check('bell/Control Center see approvals in the shared shape', await page.evaluate(() => Array.isArray(window._apPendingApprovals) && Array.isArray(window._apRules) && window._apRules.length === 3 && window._apRules.some((r) => r.campaign_ids && r.campaign_ids[0] === 'm1')));

    // ── 8. Toggle + delete ─────────────────────────────────────────────
    await tab(page, 'rules');
    await page.click('#auRoot .atm-auto[data-id="auto-1"] .atm-switch input', { force: true });
    await page.waitForTimeout(350);
    check('switch off calls pause', !!lastCall(S, 'POST', '/api/automations/auto-1/pause') && S.automations.find((a) => a.id === 'auto-1').enabled === false);
    check('paused automation shows Paused', /Paused/.test((await text(page, '#auRoot .atm-auto[data-id="auto-1"]')) || ''));
    await page.click('#auRoot [data-au="delete"][data-id="auto-1"]');
    await page.waitForSelector('.ofd-backdrop .ofd-body');
    check('delete warns credits are not refunded', /50 credits aren’t refunded/.test((await text(page, '.ofd-backdrop .ofd-body')) || ''));
    await confirmDialog(page);
    await page.waitForTimeout(300);
    check('delete calls DELETE', !!lastCall(S, 'DELETE', '/api/automations/auto-1'));

    // ── 9. Activity + filters ──────────────────────────────────────────
    S.activity = [
      { id: 'e1', automation_id: 'auto-2', automation_name: 'Scale winners', platform: 'meta', campaign_id: 'm1', campaign_name: 'Spring Sale', mode: 'automatic', action: 'increase_budget', status: 'completed', previous_value: { amount: 40, currency: 'EUR' }, new_value: { amount: 46, currency: 'EUR' }, trigger: { metric: 'roas', operator: '>', threshold: 3, observed: 3.4, window_days: 7 }, created_at: iso(-3600e3) },
      { id: 'e2', automation_id: 'auto-2', automation_name: 'Scale winners', platform: 'meta', campaign_id: 'm2', campaign_name: 'Retargeting', mode: 'automatic', action: 'increase_budget', status: 'skipped', reason: 'insufficient_data', created_at: iso(-2 * 3600e3) },
      { id: 'e3', automation_id: 'auto-3', automation_name: 'Hours', platform: 'meta', campaign_id: 'm1', campaign_name: 'Spring Sale', mode: 'scheduled', action: 'pause', status: 'failed', reason: 'auth', error: 'token expired', trigger: { scheduled_for: '2026-10-16T18:00', timezone: 'Europe/Amsterdam' }, created_at: iso(-20 * 3600e3) },
      { id: 'e4', automation_id: 'auto-3', automation_name: 'Hours', platform: 'tiktok', campaign_id: 't1', campaign_name: 'Launch Week', mode: 'scheduled', action: 'activate', status: 'partial', reason: 'activation_partial', error: 'The campaign is on, but 2 of its ad sets and ads are still paused, so they don’t deliver.', created_at: iso(-21 * 3600e3) }];
    await reload(page);
    await tab(page, 'activity');
    const act = await text(page, '#auPanel');
    check('activity shows old → new values', /€40\.00 → €46\.00/.test(act), act);
    check('skips explained, not hidden', /not enough data yet/.test(act));
    check('failures explained with a fix', /connection expired — reconnect the account/.test(act));
    check('scheduled runs show their local time', /Scheduled for .*18:00 \(Europe\/Amsterdam\)/.test(act));
    await page.click('#auRoot [data-au="filter"][data-filter="failed"]');
    await page.waitForTimeout(300);
    check('filter asks the server for that status', /status=failed/.test((lastCall(S, 'GET', '/api/automations/activity') || {}).q || ''));
    check('filtered list shows only failures', (await page.$$('#auPanel .atm-act')).length === 1);
    // Activation that switched the campaign on but left ads paused: never shown as Completed.
    await page.click('#auRoot [data-au="filter"][data-filter="partial"]');
    await page.waitForTimeout(300);
    const partRows = await page.$$eval('#auPanel .atm-act', (els) => els.map((el) => ({ t: el.textContent, badge: (el.querySelector('.atm-badge') || {}).className })));
    check('partial activation: own filter, warn badge "Partly done", reason + counts shown', /status=partial/.test((lastCall(S, 'GET', '/api/automations/activity') || {}).q || '') && partRows.length === 1 && /is-warn/.test(partRows[0].badge) && /Partly done/.test(partRows[0].t) && /some ad sets or ads are still paused/.test(partRows[0].t) && /2 of its ad sets and ads/.test(partRows[0].t) && !/Completed/.test(partRows[0].t), partRows);
    // keyboard: arrow keys move between tabs
    await page.focus('#auTab-activity');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    check('arrow keys switch tabs', await page.evaluate(() => document.activeElement.id === 'auTab-rules' && document.getElementById('auTab-rules').getAttribute('aria-selected') === 'true'));
    await page.click('#auRoot [data-au="history"][data-id="auto-2"]');
    await page.waitForTimeout(350);
    check('history opens with that automation’s activity', /€40\.00 → €46\.00/.test((await text(page, '#auModalBody')) || '') && /automation_id=auto-2/.test((lastCall(S, 'GET', '/api/automations/activity') || {}).q));
    await page.keyboard.press('Escape');

    // ── 10. Pause all + settings ───────────────────────────────────────
    await page.click('#auRoot [data-au="pauseall"]');
    await confirmDialog(page);
    await page.waitForTimeout(350);
    check('pause all is server-side', !!lastCall(S, 'POST', '/api/automations/pause-all') && S.pausedAll);
    check('pause all shown in status and button', /All automations paused/.test((await text(page, '.atm-pill')) || '') && /Resume all automations/.test((await text(page, '[data-au="pauseall"]')) || ''));
    await page.click('#auRoot [data-au="pauseall"]');
    await page.waitForTimeout(350);
    check('resume all needs no confirmation', !!lastCall(S, 'POST', '/api/automations/resume-all') && !S.pausedAll);
    await page.click('#auRoot [data-au="settings"]');
    await page.waitForSelector('#auModal .atm-settings');
    await page.click('#auModal input[data-sf="ev"][value="budget_changed"]');
    await page.click('#auModal input[data-sf="inapp"]');
    await page.click('#auModal [data-sf="save"]');
    await page.waitForTimeout(300);
    const put = lastCall(S, 'PUT', '/api/automations/settings');
    check('settings saved to the server', put && put.body.notifyInApp === false && put.body.notifyEmail === true && put.body.emailEvents.includes('budget_changed'), put && put.body);
    const lsKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /autom|autopilot/i.test(k) || /automation|autopilot/i.test(localStorage.getItem(k) || '') && /notify|paused|email/i.test(localStorage.getItem(k) || '')));
    check('automation settings are not kept in localStorage', !(await page.evaluate(() => /pausedAll|paused_all|notifyEmail|emailEvents/.test(JSON.stringify(localStorage)))), lsKeys);
    await page.screenshot({ path: path.join(SHOT_DIR, 'rules-desktop-light.png'), fullPage: true });

    // ── 11. Six languages ──────────────────────────────────────────────
    const TITLES = { en: 'Automations', nl: 'Automatiseringen', de: 'Automatisierungen', fr: 'Automatisations', es: 'Automatizaciones', pt: 'Automações' };
    for (const l of Object.keys(TITLES)) {
      await page.evaluate((lng) => { CURRENT_LANG = lng; applyLanguage(); }, l);
      await page.waitForTimeout(120);
      await tab(page, 'overview');
      const t = await text(page, '.atm-title');
      const nav = await page.$eval('.orv-ni[data-orv-page="autopilot"] .orv-ni-label', (e) => e.textContent.trim());
      const raw = await page.evaluate(() => /\b(rs|act|ev|metric|op|rel|plat)\.[a-z_]+\b|\{[a-z]+\}/.test(document.getElementById('auRoot').innerText));
      check(l + ': title + nav translated, no raw keys', t === TITLES[l] && nav === TITLES[l] && !raw, { t, nav, raw });
      await page.click('#auRoot [data-au="new-rule"]');
      await page.waitForSelector('#auModal .atm-builder');
      await page.click('#auModal input[data-bf="platform"][value="meta"]', { force: true });
      await page.waitForSelector('#auModal .atm-camps');
      const mt = await page.evaluate(() => document.getElementById('auModal').innerText);
      check(l + ': builder translated (cost shown)', /50/.test(mt) && !/\{[a-z]+\}/.test(mt) && (l === 'en' || !/Cost: 50 credits/.test(mt)), mt.slice(0, 200));
      if (l === 'nl' || l === 'de') await page.screenshot({ path: path.join(SHOT_DIR, 'builder-' + l + '.png') });
      await page.keyboard.press('Escape');
    }
    await page.evaluate(() => { CURRENT_LANG = 'en'; applyLanguage(); });

    // ── 12. Dark mode ──────────────────────────────────────────────────
    await page.evaluate(() => document.body.classList.add('dark-mode'));
    await tab(page, 'overview');
    const dark = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('.atm-tile')); const t = getComputedStyle(document.querySelector('.atm-title')); return { bg: c.backgroundColor, fg: t.color }; });
    check('dark mode uses dark surfaces and light text', /rgb\((1[0-9]|2[0-9]|3[0-9]), /.test(dark.bg) && /rgb\(2[0-9]{2}, /.test(dark.fg), dark);
    await page.screenshot({ path: path.join(SHOT_DIR, 'overview-desktop-dark.png'), fullPage: true });
    await page.click('#auRoot [data-au="new-rule"]');
    await page.waitForSelector('#auModal .atm-builder');
    const mdark = await page.evaluate(() => getComputedStyle(document.querySelector('.atm-modal-panel')).backgroundColor);
    check('dialog follows dark theme', /rgb\((1[0-9]|2[0-9]|3[0-9]), /.test(mdark), mdark);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.body.classList.remove('dark-mode'));
    const mlight = await page.evaluate(() => { document.getElementById('auModal').style.display = 'flex'; const v = getComputedStyle(document.querySelector('.atm-modal-panel')).backgroundColor; document.getElementById('auModal').style.display = 'none'; return v; });
    check('dialog is light in light mode (not the old always-dark panel)', /rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)/.test(mlight), mlight);

    check('no page errors on desktop', errors.length === 0, errors);
    check('nothing calls the retired /api/autopilot/* endpoints', S.legacy.length === 0, S.legacy);
    await ctx.close();

    // ── 13. Mobile (390 × 844) light + dark ────────────────────────────
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage();
    const MS = freshState();
    MS.automations = [view({ id: 'auto-9', name: 'A very long automation name that should wrap nicely on a phone screen', kind: 'rule', platform: 'meta', scope: { type: 'campaigns', campaign_ids: ['m1'], campaigns: [{ id: 'm1', name: 'Spring Sale' }] }, condition: { metric: 'spend', operator: '>', value: 50 }, window: 7, action: 'pause_campaign', mode: 'automatic', lastResult: { at: iso(-600e3), checked: 3, matched: 1, skipped: { insufficient_data: 2 } } })];
    MS.approvals = [{ id: 'ap-9', platform: 'meta', campaign_id: 'm1', campaign_name: 'Spring Sale', action: 'decrease_budget', params: { percent: 10 }, observed: {}, expires_at: iso(5 * 3600e3) }];
    MS.jobs = [{ id: 'job-9', action: 'pause', campaign_id: 'm1', campaign_name: 'Spring Sale', platform: 'meta', run_at: iso(3600e3), local_time: '2026-10-18T18:00', timezone: 'Europe/Amsterdam' }];
    await arm(mp, MS);
    const merr = await enter(mp, MS);
    for (const t of ['overview', 'scheduler', 'rules', 'activity']) {
      await tab(mp, t);
      const over = await noSideScroll(mp);
      check('mobile ' + t + ': no sideways scroll', over === true || (Array.isArray(over) && over.length === 0), over);
    }
    await tab(mp, 'rules');
    check('mobile: last-check result and skips shown', /3 campaign\(s\), 1 matched/.test((await text(mp, '#auPanel')) || '') && /not enough data yet \(2\)/.test((await text(mp, '#auPanel')) || ''));
    await mp.screenshot({ path: path.join(SHOT_DIR, 'rules-mobile-light.png'), fullPage: true });
    await mp.click('#auRoot [data-au="new-schedule"]');
    await mp.waitForSelector('#auModal .atm-builder');
    await mp.click('#auModal input[data-bf="platform"][value="meta"]', { force: true });
    await mp.waitForSelector('#auModal .atm-camps');
    await mp.click('#auModal [data-bf="tpl-hours"]');
    const mo = await noSideScroll(mp);
    check('mobile builder: no sideways scroll', mo === true || (Array.isArray(mo) && mo.length === 0), mo);
    const sheet = await mp.evaluate(() => { const r = document.querySelector('.atm-modal-panel').getBoundingClientRect(); return { w: Math.round(r.width), bottom: Math.round(r.bottom), vh: innerHeight }; });
    check('mobile builder is a full-width bottom sheet', sheet.w >= 388 && Math.abs(sheet.bottom - sheet.vh) <= 2, sheet);
    await mp.screenshot({ path: path.join(SHOT_DIR, 'schedule-mobile-light.png') });
    await mp.keyboard.press('Escape');
    await mp.evaluate(() => document.body.classList.add('dark-mode'));
    await tab(mp, 'overview');
    await mp.screenshot({ path: path.join(SHOT_DIR, 'overview-mobile-dark.png'), fullPage: true });
    check('no page errors on mobile', merr.length === 0, merr);
    await mctx.close();

    // ── 14. Error, DB-missing and locked states ────────────────────────
    const ectx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ep = await ectx.newPage();
    const ES = freshState();
    ES.overviewStatus = 500; ES.overviewBody = { error: 'Something went wrong. Nothing was changed. Please try again.', code: 'UNKNOWN_ERROR' };
    await arm(ep, ES);
    await enter(ep, ES);
    check('server error: message + retry, no fake data', /Something went wrong|Couldn’t load/.test((await text(ep, '#auRoot [role="alert"]')) || '') && !!(await ep.$('#auRoot [data-au="reload"]')) && !(await ep.$('#auRoot .atm-tiles')));
    ES.overviewStatus = 503; ES.overviewBody = { error: 'x', code: 'DB_UNAVAILABLE' };
    await ep.click('#auRoot [data-au="reload"]');
    await ep.waitForTimeout(400);
    check('missing database update explained', /needs a server update/.test((await text(ep, '#auRoot [role="alert"]')) || ''));
    ES.overviewStatus = 403; ES.overviewBody = { error: 'Automations are available from the Starter plan.', code: 'AUTOPILOT_NOT_AVAILABLE' };
    await reload(ep);
    await ep.waitForTimeout(200);
    check('no plan access: intro only, no tabs, no actions', !!(await ep.$('#auRoot .atm-empty')) && !(await ep.$('#auRoot [role="tab"]')) && !(await ep.$('#auRoot [data-au="new-rule"]')));
    ES.overviewStatus = 200; ES.overviewBody = null;
    await reload(ep);
    await ep.waitForTimeout(200);
    check('recovers after the error clears', !!(await ep.$('#auRoot .atm-tiles')));
    await ectx.close();
  } catch (e) {
    fail++; console.log('FAIL — test crashed: ' + (e && e.stack || e));
  } finally {
    await browser.close(); srv.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }
})();
