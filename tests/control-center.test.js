/* ════════════════════════════════════════════════════════════════
   Control Center redesign (operations + context rail), end to end in a
   real browser, for every account state the page has to tell apart.

   No backend, no Supabase, no AI, no credits: a local static server
   serves this repo, Supabase is blocked and every /api/* read is answered
   by an in-test mock shaped like the real routes (platform status,
   campaign reads, automations, business profile/context). Local
   OrivenAI campaign records are seeded in localStorage.

   RUN: node tests/control-center.test.js
   ════════════════════════════════════════════════════════════════ */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8921, BASE = 'http://127.0.0.1:' + PORT;
const SHOT_DIR = path.join(__dirname, '_shots', 'control-center');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (u === '/') u = '/app.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
}).listen(PORT);
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const UID = 'mock-cc';

// ── Fixtures ─────────────────────────────────────────────────────────
const PROFILE_FULL = { company_name: 'Linnen & Co', industry: 'Apparel', country: 'Netherlands', description: 'Linen shirts made in Europe', website: 'linnenco.nl' };
const ACCT = { account_id: 'act_1', account_name: 'Linnen main', currency: 'EUR' };
const META_CAMPS = [
  { campaign_id: '101', campaign_name: 'Spring linen — prospecting', status: 'ACTIVE', spend: 420.5, impressions: 51000, clicks: 900, conversions: 21, conversionValue: 1890, daily_budget: 3000 },
  { campaign_id: '102', campaign_name: 'Retargeting — site visitors', status: 'ACTIVE', spend: 180, impressions: 12000, clicks: 310, conversions: 9, conversionValue: 760, daily_budget: 1500 },
  { campaign_id: '103', campaign_name: 'Old winter promo', status: 'PAUSED', spend: 0, impressions: 0, clicks: 0, conversions: 0, daily_budget: 1000 },
];
const GOOGLE_CAMPS = [{ id: '201', name: 'Search — linen shirts', status: 'ENABLED', spend: 230, impressions: 8000, clicks: 400, conversions: 12, conversions_value: 980 }];
const LOCAL_DRAFT = { id: 'loc-draft-1', name: 'Summer linen launch', platform: 'meta', status: 'draft', created: iso(-86400e3), updated: iso(-86400e3) };
const LOCAL_FAILED = { id: 'loc-failed-1', name: 'Autumn collection', platform: 'google', status: 'failed', publishError: 'The ad account rejected the budget.', created: iso(-7200e3), updated: iso(-3600e3) };
const APPROVAL = { id: 'ap1', action: 'pause_campaign', campaign_name: 'Retargeting — site visitors', campaign_id: '102', platform: 'meta', created_at: iso(-600e3), reason: 'Cost per result doubled' };

// Each state: what the account really has. status values: true | false | 'abort' (status check fails).
const STATES = {
  newUser:      { profile: {}, status: {}, local: [] },
  incomplete:   { profile: { company_name: 'Linnen & Co' }, status: {}, local: [] },
  noPlatforms:  { profile: PROFILE_FULL, status: {}, local: [LOCAL_DRAFT] },
  connectedNoCamps: { profile: PROFILE_FULL, status: { meta: true }, meta: [], local: [] },
  active:       { profile: PROFILE_FULL, status: { meta: true, google: true }, meta: META_CAMPS, google: GOOGLE_CAMPS, local: [LOCAL_DRAFT], audiences: 2, competitors: 3 },
  approvals:    { profile: PROFILE_FULL, status: { meta: true }, meta: META_CAMPS, local: [], approvals: [APPROVAL], apActive: 2 },
  publishError: { profile: PROFILE_FULL, status: { meta: true }, meta: META_CAMPS, local: [LOCAL_FAILED] },
  unavailable:  { profile: PROFILE_FULL, status: { meta: true, google: true }, meta: 'error', google: GOOGLE_CAMPS, local: [] },
  statusDown:   { profile: PROFILE_FULL, status: { meta: 'abort', google: 'abort', tiktok: 'abort', pinterest: 'abort' }, local: [] },
  full:         { profile: PROFILE_FULL, status: { meta: true, google: true }, meta: META_CAMPS, google: GOOGLE_CAMPS, local: [LOCAL_DRAFT], audiences: 2, competitors: 3, apActive: 2 },
};

async function arm(page, S) {
  S.calls = [];
  await page.route('**/*supabase.co/**', (r) => r.abort());
  await page.addInitScript(({ uid, local }) => {
    try { localStorage.setItem('oriven_campaigns_' + uid, JSON.stringify(local)); } catch (_) {}
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); });
  }, { uid: UID, local: S.local || [] });
  await page.route('**/api/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    S.calls.push(m + ' ' + p);
    const json = (status, obj) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    const sm = /^\/api\/(meta|google|tiktok|pinterest)\/status$/.exec(p);
    if (sm) {
      const v = S.status[sm[1]];
      if (v === 'abort') return r.abort();
      return json(200, v ? { connected: true, active_ad_account: ACCT } : { connected: false });
    }
    if (p === '/api/meta/campaigns') return S.meta === 'error' ? json(500, { error: 'Meta did not answer' }) : json(200, { campaigns: S.meta || [] });
    if (p === '/api/ads/overview') return S.google === 'error' ? json(500, { error: 'x' }) : json(200, { campaigns: S.google || [] });
    if (p === '/api/google/campaigns') return json(200, { campaigns: [], currency: 'EUR' });
    if (p === '/api/tiktok/overview' || p === '/api/pinterest/overview') return json(200, { campaigns: [] });
    if (p === '/api/meta/ads') return json(200, { ads: [] });
    if (p === '/api/business/profile') return json(200, { profile: S.profile });
    if (p === '/api/business/audiences') return json(200, { items: Array.from({ length: S.audiences || 0 }, (_, i) => ({ id: 'a' + i, name: 'Audience ' + i })) });
    if (p === '/api/business/competitors') return json(200, { items: Array.from({ length: S.competitors || 0 }, (_, i) => ({ id: 'c' + i, name: 'Competitor ' + i })) });
    if (p === '/api/credits/status') return json(200, { balance: 1000, plan: 'starter' });
    if (p === '/api/campaigns') return json(200, { campaigns: [] });
    if (p === '/api/automations/overview') return json(200, { counts: { active: S.apActive || 0, pendingApprovals: (S.approvals || []).length }, accounts: Object.keys(S.status).filter((k) => S.status[k] === true).map((k) => ({ platform: k, connected: true })), pausedAll: false, nextRun: null });
    if (p === '/api/automations/activity') return json(200, { items: [] });
    if (p === '/api/automations/approvals') return json(200, { approvals: S.approvals || [] });
    if (p === '/api/automations') return json(200, { automations: [] });
    if (p === '/api/intelligence/events') return json(200, { events: [] });
    return json(200, {});
  });
}

async function boot(browser, S, vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await arm(page, S);
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate((uid) => {
    window._getAccessToken = async function () { return 'mock-token'; };
    if (window.orvTour) { window.orvTour.open = function () {}; try { window.orvTour.close(); } catch (_) {} }
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    window._dbSubscriptionStatus = 'starter';
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: uid, email: 'mock-cc@example.invalid' });
  }, UID);
  await page.evaluate(() => { window.__ln = { id: null, at: performance.now() }; setInterval(function () { var a = document.querySelector('.page.active'); var id = a && a.id; if (id !== window.__ln.id) window.__ln = { id: id, at: performance.now() }; }, 100); });
  for (let i = 0; i < 150; i++) { await page.waitForTimeout(200); if (await page.evaluate(() => performance.now() - window.__ln.at > 3000 && performance.now() > 8500)) break; }
  await openCC(page);
  return { ctx, page, errors };
}
async function openCC(page) {
  for (let k = 0; k < 10; k++) {
    await page.evaluate(() => {
      if (window.orvTour) { try { window.orvTour.close(); } catch (_) {} }
      var b = document.getElementById('orvConsentBanner'); if (b) b.remove();
      document.querySelectorAll('.ob-overlay, .orv-ob, #obOverlay').forEach(function (e) { e.remove(); });
      if (document.querySelector('.page.active') && document.querySelector('.page.active').id !== 'page-business-brain') _orvNav('businessbrain', 'page-business-brain');
      if (typeof bizGoTo === 'function' && !document.querySelector('#bizPanelOverview.active, #bizPanelOverview[style*="block"]')) { try { bizSwitchTab('overview'); } catch (_) {} }
    });
    await page.waitForTimeout(500);
    if (await page.evaluate(() => document.querySelector('.page.active').id === 'page-business-brain' && document.querySelectorAll('#bicGrid .ccx-mod').length === 6)) break;
  }
  // Both Needs sources answered, and the performance block painted.
  await page.waitForFunction(() => { var c = document.getElementById('owNeeds'); var pf = document.getElementById('ovPerf'); return c && c.getAttribute('data-sig-ready') === '1' && c.getAttribute('data-ws-ready') === '1' && pf && pf.innerHTML.trim(); }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
}

function read(page) {
  return page.evaluate(() => {
    const $ = (s) => document.querySelector(s), txt = (s) => ($(s) ? $(s).innerText.trim() : null);
    const needs = $('#owNeeds');
    const rows = Array.from(document.querySelectorAll('#owNeeds [data-rank]')).map((r) => ({ rank: +r.dataset.rank, hidden: r.hidden, order: +r.style.order, text: r.innerText.replace(/\s+/g, ' ').trim() }));
    const setup = $('#ccxSetup');
    return {
      greeting: txt('#owHomeGreeting'), status: txt('#owHomeStatus'), eyebrow: txt('.cc-eyebrow'),
      icon: { html: $('#bizHubIcon').innerHTML, initial: txt('#bizHubIcon .biz-icon-initial'), glyph: !!$('#bizHubIcon .biz-icon-glyph'), img: !!$('#bizHubIcon img'), plus: !!$('#bizHubIcon .biz-icon-plus') },
      create: txt('#ccxCreateBtn'),
      needs: { cls: needs.className, count: txt('#ovAttCount'), calm: $('#ccxNeedsCalm').hidden ? null : txt('#ccxNeedsCalm'), rows, more: $('#ccxNeedsMore').hidden ? null : txt('#ccxNeedsMore') },
      perf: { text: txt('#ovPerf'), figs: document.querySelectorAll('#ovPerf .op-fig').length, connect: !!$('#ovPerf .ccx-btn-primary'), retry: !!$('#ovPerf .ccx-state-warn, #ovPerf .ccx-note-warn'), notes: Array.from(document.querySelectorAll('#ovPerf .op-fig-n')).map((e) => getComputedStyle(e).display) },
      camps: { stats: Array.from(document.querySelectorAll('#ovCamps .ccx-stat')).map((s) => s.querySelector('.ccx-stat-v').innerText.trim()), rows: document.querySelectorAll('#ovCamps .ccx-crow').length, text: txt('#ovCamps') },
      auto: txt('#ovAuto'),
      setup: { hidden: setup.hidden, text: setup.hidden ? null : setup.innerText.replace(/\s+/g, ' ').trim(), done: document.querySelectorAll('#ccxSetup .ccx-step.is-done').length, todo: document.querySelectorAll('#ccxSetup .ccx-step.is-todo button').length, unknown: document.querySelectorAll('#ccxSetup .ccx-step.is-unknown').length },
      plan: txt('#bicPlanStrip'),
      mods: Array.from(document.querySelectorAll('#bicGrid .ccx-mod')).map((b) => ({ name: b.querySelector('.ccx-mod-name').innerText, st: b.querySelector('.ccx-mod-st').innerText, tone: b.querySelector('.ccx-mod-st').className, badge: b.querySelector('.ccx-mod-badge') ? b.querySelector('.ccx-mod-badge').innerText : null })),
      oldCards: document.querySelectorAll('#bicGrid .bic-card').length,
    };
  });
}
const shot = (page, name, full) => page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: full !== false });

(async () => {
  const browser = await chromium.launch();
  const all = {};
  try {
    // ── 1. Every account state ────────────────────────────────────────
    for (const key of Object.keys(STATES)) {
      const S = JSON.parse(JSON.stringify(STATES[key]));
      const { ctx, page, errors } = await boot(browser, S);
      const r = await read(page); all[key] = r;
      await shot(page, 'state-' + key);
      const oriven = errors.filter((e) => !/supabase|Failed to fetch|NetworkError|net::/i.test(e));
      check(key + ': no page errors', !oriven.length, oriven);
      check(key + ': six business-context rows, no old coloured cards', r.mods.length === 6 && r.oldCards === 0, r.mods);
      check(key + ': no "+" placeholder in the business icon', !r.icon.plus, r.icon.html.slice(0, 200));
      check(key + ': no raw keys or {placeholders}', !(await page.evaluate(() => /\b(mod|ms|ml|st|sev|att|src|act|fig|stage|auto|autoAct|plat|icon|setup)\.[a-zA-Z]+\b|\{[a-z]+\}/.test(document.getElementById('bizPanelOverview').innerText))));
      check(key + ': no horizontal scroll at 1440', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      if (key === 'full') { all.fullPage = page; all.fullCtx = ctx; all.fullS = S; continue; }
      await ctx.close();
    }
    const A = all;

    // ── 2. State-specific expectations ───────────────────────────────
    // New user
    check('new user: setup checklist visible with 0 of 3 done', !A.newUser.setup.hidden && A.newUser.setup.done === 0 && A.newUser.setup.todo === 3, A.newUser.setup);
    check('new user: Needs you is calm ("caught up"), no amber/red state', A.newUser.needs.calm && /caught up/i.test(A.newUser.needs.calm) && /is-calm/.test(A.newUser.needs.cls) && !/is-risk|is-warn/.test(A.newUser.needs.cls), A.newUser.needs);
    check('new user: Performance says not connected + Connect button, no figures', A.newUser.perf.connect && A.newUser.perf.figs === 0 && !/€\s?0|0[.,]00/.test(A.newUser.perf.text), A.newUser.perf);
    check('new user: Running shows "Not connected", not 0', /not connected/i.test(A.newUser.camps.stats[0]) && !/^0$/.test(A.newUser.camps.stats[0]), A.newUser.camps.stats);
    check('new user: header status says nothing is running yet', A.newUser.status && !/running/i.test(A.newUser.status.replace(/nothing is running/i, '')) && A.newUser.status.length > 5, A.newUser.status);
    check('new user: icon shows a neutral glyph (no name to take an initial from)', A.newUser.icon.glyph && !A.newUser.icon.img, A.newUser.icon);
    check('greeting + eyebrow', /^Good (morning|afternoon|evening)/.test(A.newUser.greeting) && /CONTROL CENTER/i.test(A.newUser.eyebrow), [A.newUser.greeting, A.newUser.eyebrow]);
    // Incomplete profile
    check('incomplete profile: business initial "L" shown', A.incomplete.icon.initial === 'L', A.incomplete.icon);
    check('incomplete profile: Business row is "Incomplete", profile step still to do', A.incomplete.mods[0].st === 'Incomplete' && /todo/.test(A.incomplete.mods[0].tone) && A.incomplete.setup.todo >= 1, [A.incomplete.mods[0], A.incomplete.setup]);
    // No platforms
    check('no platforms: profile step done, connect + campaign steps', A.noPlatforms.setup.done === 2 && A.noPlatforms.setup.todo === 1 || (A.noPlatforms.setup.done >= 1 && /connect/i.test(A.noPlatforms.setup.text)), A.noPlatforms.setup);
    check('no platforms: Advertising row "Not connected"', /not connected/i.test(A.noPlatforms.mods[4].st), A.noPlatforms.mods[4]);
    check('no platforms: drafts counted from OrivenAI records (1)', A.noPlatforms.camps.stats[1] === '1' && /1 draft/i.test(A.noPlatforms.status), [A.noPlatforms.camps.stats, A.noPlatforms.status]);
    // Connected, no campaigns
    check('connected without campaigns: Running is a real 0', A.connectedNoCamps.camps.stats[0] === '0', A.connectedNoCamps.camps.stats);
    check("connected without campaigns: no tiles, says no activity", A.connectedNoCamps.perf.figs === 0 && !A.connectedNoCamps.perf.connect && /no spend/i.test(A.connectedNoCamps.perf.text), A.connectedNoCamps.perf);
    check('connected without campaigns: Advertising row 1/4', /1\s*\/\s*4/.test(A.connectedNoCamps.mods[4].st), A.connectedNoCamps.mods[4]);
    // Active + multiple
    check('active: performance figures shown with partial-value notes visible', A.active.perf.figs >= 3 && A.active.perf.notes.every((d) => d !== 'none'), A.active.perf);
    check('active: spend figure is the real sum (€830.50)', /830[.,]5/.test(A.active.perf.text.replace(/\s/g, '')), A.active.perf.text.slice(0, 300));
    check('active: Running = 3 live platform campaigns, header says running', A.active.camps.stats[0] === '3' && /3 campaigns running/i.test(A.active.status), [A.active.camps.stats, A.active.status]);
    check('active: three campaign rows max', A.active.camps.rows === 3, A.active.camps);
    check('active: Audience/Competition rows from real counts', /2/.test(A.active.mods[2].st) && /3/.test(A.active.mods[3].st), A.active.mods);
    // Approvals
    const apRow = A.approvals.needs.rows.find((x) => /approv|waiting|Retargeting/i.test(x.text));
    check('approvals: an approval row in Needs you (attention, amber)', !!apRow && apRow.rank === 1 && /is-warn|is-risk/.test(A.approvals.needs.cls), A.approvals.needs);
    check('approvals: Automations card shows the waiting approval', /1/.test(A.approvals.auto) && /approv|waiting/i.test(A.approvals.auto), A.approvals.auto);
    // Publish error
    const failRow = A.publishError.needs.rows.find((x) => x.rank === 0);
    check('publish error: a red (risk) row, ranked first', !!failRow && A.publishError.needs.rows.filter((x) => !x.hidden).sort((a, b) => a.order - b.order)[0].rank === 0 && /is-risk/.test(A.publishError.needs.cls), A.publishError.needs);
    check('publish error: counted under "Needs attention" in Campaigns', +A.publishError.camps.stats[2] >= 1, A.publishError.camps.stats);
    // Unavailable
    check('unavailable: Meta read failed → note + retry, Google figures still shown', A.unavailable.perf.retry && /Meta/.test(A.unavailable.perf.text), A.unavailable.perf);
    check('unavailable: Running flagged as partial, not a silent number', /\*/.test(A.unavailable.camps.stats[0]) || /unavailable/i.test(A.unavailable.camps.stats[0]), A.unavailable.camps.stats);
    check('status checks down: "unavailable" state, not "not connected", never 0', A.statusDown.perf.retry && !A.statusDown.perf.connect && /unavailable/i.test(A.statusDown.camps.stats[0]), [A.statusDown.perf, A.statusDown.camps.stats]);
    check('status checks down: header makes no running claim', !/\d+ running/i.test(A.statusDown.status), A.statusDown.status);
    // Fully configured
    check('fully configured: setup checklist hidden', A.full.setup.hidden, A.full.setup);
    check('fully configured: initial "L" icon, status pills ok', A.full.icon.initial === 'L' && A.full.mods[0].st === 'Added' && /is-ok/.test(A.full.mods[0].tone), [A.full.icon, A.full.mods[0]]);

    // ── 3. Interactions on the fully configured account ─────────────
    const page = A.fullPage;
    const calls = await page.evaluate(() => {
      const log = [];
      const wrap = (name) => { const o = window[name]; window[name] = function () { log.push(name + ':' + Array.from(arguments).join(',')); }; return () => { window[name] = o; }; };
      const un = [wrap('bizUploadBusinessIcon'), wrap('bizGoTo'), wrap('_orvNav')];
      document.getElementById('bizHubIcon').click();
      document.getElementById('ccxCreateBtn').click();
      const crow = document.querySelector('#ovCamps .ccx-crow'); const OPS = orvWorkspace.ops; const oc = OPS.openCampaign; OPS.openCampaign = function (p, id, d) { log.push('openCampaign:' + p + ',' + id + ',' + d); }; crow && crow.click(); OPS.openCampaign = oc;
      const og = OPS.go; OPS.go = function (x) { log.push('ops.go:' + x); }; document.querySelector('.ccx-perf .ccx-link').click(); document.querySelector('.ccx-auto .ccx-link').click(); OPS.go = og;
      un.forEach((f) => f());
      return log;
    });
    check('logo click → bizUploadBusinessIcon()', calls.includes('bizUploadBusinessIcon:'), calls);
    check('Create campaign → _orvNav(create)', calls.some((c) => /^_orvNav:create,page-create/.test(c)), calls);
    check('campaign row → OPS.openCampaign(platform, id)', calls.some((c) => /^openCampaign:meta,10[12],false/.test(c)), calls);
    check('card links → Campaigns / Automations', calls.includes('ops.go:campaigns') && calls.includes('ops.go:autopilot'), calls);
    await page.click('#bicGrid .ccx-mod-brand');
    await page.waitForTimeout(300);
    const ov = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('bicFocusOverlay')).display !== 'none', title: document.getElementById('bicFocusTitle').innerText }));
    check('business row → details overlay (_bicFocusNode), titled', ov.shown && ov.title === 'Brand', ov);
    await shot(page, 'overlay-brand', false);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check('overlay closes (_bicCloseFocus)', await page.evaluate(() => getComputedStyle(document.getElementById('bicFocusOverlay')).display === 'none'));
    const hooks = await page.evaluate(() => ({
      fns: ['bizUploadBusinessIcon', 'bizGoTo', '_bicRender', '_bicCardContent', '_bicFocusNode', '_bicCloseFocus', '_bizRenderCentralIcon'].filter((f) => typeof window[f] !== 'function'),
      ow: ['placeBell', 'reset', 'attention'].filter((f) => typeof orvWorkspace[f] !== 'function'),
      ops: ['refreshAll', 'openSignal', 'openCampaign', 'repaintOverview'].filter((f) => typeof orvWorkspace.ops[f] !== 'function'),
      home: typeof orvWorkspace.home.toggleNeeds === 'function', compare: !!(orvWorkspace.ops.data && orvWorkspace.ops.data.compare) || !!(window.orvOps && orvOps.data && orvOps.data.compare) || true,
      ids: ['bizHubIcon', 'bizHubIconActions', 'owDashGrid', 'bicPlanStrip', 'bicGrid', 'owHomeGreeting', 'owHomeStatus', 'owNeeds', 'ovAtt', 'owNeedsList', 'ovPerf', 'ovCamps', 'ovAuto'].filter((i) => !document.getElementById(i)),
      dash: ['owNeeds', 'ovPerf', 'ovCamps', 'ovAuto'].every((i) => document.getElementById('owDashGrid').contains(document.getElementById(i))),
      bell: !!document.querySelector('#page-business-brain #orvNotifBell.ow-in-page, .ow-bell-host #orvNotifBell'),
    }));
    check('preserved functions and ids all exist', !hooks.fns.length && !hooks.ow.length && !hooks.ops.length && hooks.home && !hooks.ids.length, hooks);
    check('#owDashGrid still holds Needs, Performance, Campaigns, Automations (tour spotlight)', hooks.dash, hooks);
    check('notification bell placed in the page', hooks.bell, hooks);
    // Refresh keeps the page painted (no blanking to zeros).
    await page.evaluate(() => orvWorkspace.ops.refreshAll('dash'));
    await page.waitForTimeout(1200);
    const afterRefresh = await read(page);
    check('refresh: figures repaint from the same real data', afterRefresh.perf.figs === A.full.perf.figs && afterRefresh.camps.stats[0] === A.full.camps.stats[0], [afterRefresh.perf.figs, afterRefresh.camps.stats]);

    // ── 4. Widths ────────────────────────────────────────────────────
    for (const w of [1600, 1440, 1280, 1024, 768, 390]) {
      await page.setViewportSize({ width: w, height: w <= 390 ? 844 : w <= 768 ? 1024 : 900 });
      await page.waitForTimeout(450);
      const g = await page.evaluate(() => {
        const R = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
        const over = Array.from(document.querySelectorAll('#bizPanelOverview *')).filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > window.innerWidth + 1; }).slice(0, 5).map((e) => e.className || e.tagName);
        return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, main: R('.ccx-main'), rail: R('.ccx-rail'), dash: R('#owDashGrid'), plan: R('#bicPlanStrip'), grid: R('#bicGrid'), needs: R('#owNeeds'), ctx: R('.cc-ctx'), hd: R('.ccx-hd'), btn: R('#ccxCreateBtn'), over };
      });
      check(w + ': no horizontal scroll / overflow', g.sw <= g.iw + 1 && !g.over.length, { sw: g.sw, iw: g.iw, over: g.over });
      if (w >= 1100) check(w + ': rail beside operations (≈8/4)', g.rail.l > g.main.r - 1 && g.main.w / (g.main.w + g.rail.w) > 0.6 && g.main.w / (g.main.w + g.rail.w) < 0.75, { main: g.main, rail: g.rail });
      else check(w + ': single column, context after operations', g.ctx.t >= g.dash.b - 1 && g.plan.t >= g.dash.b - 1, { dash: g.dash, ctx: g.ctx, plan: g.plan });
      check(w + ': spotlight targets have a box', [g.dash, g.plan, g.grid].every((x) => x && x.w > 0 && x.h > 0), [g.dash, g.plan, g.grid]);
      if (w <= 390) check(w + ': Create campaign full width on phones', g.btn.w > g.iw * 0.7, g.btn);
      await shot(page, 'full-' + w);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // ── 5. Six languages ─────────────────────────────────────────────
    const STR = await page.evaluate(() => orvCC._STR);
    for (const l of ['en', 'nl', 'de', 'fr', 'es', 'pt']) {
      await page.evaluate((lng) => { CURRENT_LANG = lng; applyLanguage(); }, l);
      await page.waitForTimeout(500);
      const t = await page.evaluate(() => ({ needs: document.getElementById('owNeedsTitle').innerText, perf: document.getElementById('ovPerfH').innerText, ctx: document.getElementById('ccCtxH').innerText, create: document.getElementById('ccxCreateBtn').innerText, greet: document.getElementById('owHomeGreeting').innerText, mod0: document.querySelector('#bicGrid .ccx-mod-name').innerText, st0: document.querySelector('#bicGrid .ccx-mod-st').innerText, all: document.getElementById('bizPanelOverview').innerText }));
      const S = STR[l];
      const ok = t.needs === S.needsTitle && t.ctx === S.ctxTitle && t.create === S.createCampaign && t.mod0 === S.mod.business && t.st0 === S.ms.added && Object.values(S.greetings || {}).concat([S.morning, S.afternoon, S.evening]).filter(Boolean).some((g) => t.greet.indexOf(g.replace(/[.!]$/, '')) === 0);
      const raw = /\b(mod|ms|ml|st|sev|att|src|act|fig|stage|auto|autoAct|plat|icon|setup)\.[a-zA-Z]+\b|\{[a-z]+\}/.test(t.all);
      const eng = l !== 'en' && /\b(Needs you|Business context|Create campaign|View campaigns|Not connected|Running|Drafts)\b/.test(t.all);
      check(l + ': Control Center translated, no raw keys, no leftover English', ok && !raw && !eng, { t: Object.assign({}, t, { all: t.all.slice(0, 400) }), raw, eng });
      if (l === 'nl' || l === 'de') await shot(page, 'lang-' + l);
    }
    await page.evaluate(() => { CURRENT_LANG = 'en'; applyLanguage(); });

    // ── 6. Account switch: nothing from the previous account stays ──
    await page.evaluate(() => orvWorkspace.reset());
    await page.waitForTimeout(100);
    const cleared = await page.evaluate(() => ['ovAtt', 'owNeedsList', 'ovPerf', 'ovCamps', 'ovAuto'].map((i) => document.getElementById(i).innerHTML.trim().length));
    check('OW.reset clears every Control Center block', cleared.every((n) => n === 0), cleared);

    // ── 7. Light app theme: the canvas stays dark and readable ──────
    await page.evaluate(() => { document.body.classList.remove('dark-mode'); });
    await openCC(page);
    const theme = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('.ccx-perf')).color, h: getComputedStyle(document.querySelector('.ccx-h')).color }));
    check('light app theme: Control Center text stays light on the dark canvas', /rgb\(24[0-9], 24[0-9], 23[0-9]\)/.test(theme.card) && /rgb\(24[0-9]/.test(theme.h), theme);
    await shot(page, 'full-light-theme');
    await A.fullCtx.close();

    // ── 8. Loading: no zeros before data arrives ─────────────────────
    {
      const S = JSON.parse(JSON.stringify(STATES.full));
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const pg = await ctx.newPage();
      await arm(pg, S);
      let hold = true;
      await pg.route('**/api/meta/campaigns**', async (r) => { while (hold) await new Promise((x) => setTimeout(x, 100)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: META_CAMPS }) }); });
      await pg.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(400);
      await pg.evaluate((uid) => { window._getAccessToken = async () => 'mock-token'; if (window.orvTour) { window.orvTour.open = function () {}; } window._dbSubscriptionStatus = 'starter'; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: uid, email: 'mock-cc@example.invalid' }); }, UID);
      await pg.waitForTimeout(9000);
      await pg.evaluate(() => { if (window.orvTour) { try { window.orvTour.close(); } catch (_) {} } if (document.querySelector('.page.active').id !== 'page-business-brain') _orvNav('businessbrain', 'page-business-brain'); });
      await pg.waitForTimeout(800);
      const L = await pg.evaluate(() => ({ perf: document.getElementById('ovPerf').innerText.trim(), perfH: Math.round(document.getElementById('ovPerf').getBoundingClientRect().height), camps: document.getElementById('ovCamps').innerText.trim(), calm: document.getElementById('ccxNeedsCalm').innerText, status: document.getElementById('owHomeStatus').innerText }));
      check('loading: performance/campaigns show no numbers, space reserved', !/\d/.test(L.perf) && !/\b0\b/.test(L.camps) && L.perfH >= 80, L);
      check('loading: Needs you says it is checking (not "caught up")', !/caught up/i.test(L.calm), L);
      await shot(pg, 'loading', false);
      hold = false;
      await ctx.close();
    }
  } catch (e) {
    fail++; console.log('FAIL — test crashed | ' + (e && e.stack || e));
  } finally {
    await browser.close(); srv.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + SHOT_DIR);
    process.exit(fail ? 1 : 0);
  }
})();
