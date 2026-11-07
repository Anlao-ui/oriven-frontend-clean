/* ════════════════════════════════════════════════════════════════
   App navigation — six sections, fifteen pages (js/appNav.js,
   css/app-nav.css) in the real app.html, signed in as an existing paying
   account that finished onboarding long ago; plus the Control Center pages
   (Dashboard fit, Marketing Plan and Progress: js/planPages.js) for that
   account (no plan) and for a paid account whose plan was generated after
   onboarding — the plan and steps built with the backend's own pure
   functions (services/onboardingFlow.js sanitizePlan / planSteps).

   SAFETY: a network fence. The page may reach ONLY this test's own
   server: the app's dev API base (http://localhost:5500 — the real backend
   may be running there) is rewritten to an in-process mock, static CDN GETs
   are allowed, everything else (Supabase, ad platforms, analytics, any
   other backend) is aborted. No real users, nothing written anywhere.

   RUN: node tests/app-nav.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const PORT = 8957, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOTS = path.join(__dirname, '_shots', 'app-nav'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }

// ── Mock backend: an existing, paying account that completed onboarding ──
const calls = [];
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json());
app.use('/api', (q, r, n) => { calls.push({ m: q.method, p: q.originalUrl.split('?')[0], body: q.body }); n(); });
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, reason: 'existing_account', newAccount: false, completed: true, stage: 'done', flow: { enabled: false } }));
app.get('/api/research/reports', (q, r) => r.json({ reports: [{ id: 'r1', title: 'Candle market in Utrecht', status: 'ready', type: 'market', createdAt: new Date().toISOString() }] }));
app.get('/api/research/insights', (q, r) => r.json({ reports: [{ id: 'r1', title: 'Candle market in Utrecht', status: 'ready', type: 'market', createdAt: new Date().toISOString() }], saved: [], findings: [], opportunities: [], actions: [], recurringCompetitors: [] }));
app.get('/api/automations', (q, r) => r.json({ automations: [], activity: [], approvals: [] }));
// M.mode: 'existing' (a paying account without onboarding: no plan),
// 'generating', 'failed', 'ready' (plan for M.period, steps stored in M.done).
const FLOW = require(path.join(BE, 'services', 'onboardingFlow'));
const CATALOG = require(path.join(BE, 'services', 'planCatalog'));
const M = { mode: 'existing', period: 'monthly', done: {}, perPhase: 3, polls: 0, version: 1, regen: null, regenFail: false, regenPolls: 0, request: null, newAt: null, regenBodies: [] };
const STARTED = new Date(Date.now() - 9 * 864e5).toISOString();
const TASK_ACTIONS = [['review_campaigns', 'review the campaign results'], ['create_ad_copy', 'write the workshop ad'], ['build_audience', 'save the gift-shopper audience'], ['review_insights', 'read the new insights'], ['test_creatives', 'test two headlines']];
function planFor(period, perPhase) {
  const h = FLOW.HORIZONS[period];
  const raw = {
    summary: 'Turn local gift shoppers into repeat buyers with Instagram and email, two channels you can keep up each week.',
    overview: { text: 'Bloom & Wick sells hand-poured soy candles from a studio in Utrecht and online, mostly to gift shoppers.' },
    audience: { text: 'Gift shoppers and interior lovers aged 25–45 in and around Utrecht.', segments: [{ name: 'Gift shoppers', needs: 'A personal present that feels handmade' }] },
    positioning: { statement: 'Hand-poured, natural candles from your own Utrecht studio.', proof_points: ['Poured by hand in the studio'] },
    objectives: [{ objective: 'Grow repeat orders', measure: 'Repeat orders per month' }],
    channels: [{ channel: 'Instagram', role: 'Discovery', why: 'Your product is visual', effort: 'medium' }, { channel: 'Email', role: 'Repeat sales', why: 'An audience you own', effort: 'low' }],
    content: { pillars: [{ name: 'In the studio', ideas: ['How one candle is poured'] }], cadence: 'Three posts a week' },
    campaigns: [{ name: 'Saturday workshops', goal: 'Bookings', idea: 'Invite past buyers first' }],
    priorities: ['Start an email list', 'Post three times a week'],
    // In-app tasks (services/planCatalog.js actions): the 1st is confirmed by
    // hand (review_campaigns), the 2nd completes by itself (create_ad_copy).
    roadmap: h.phases.map((n, i) => ({ phase: n, focus: 'Focus for ' + n, tasks: Array.from({ length: perPhase }, (_, j) => {
      const a = TASK_ACTIONS[j % TASK_ACTIONS.length];
      return { title: 'Task ' + (j + 1) + ' of ' + n + ': ' + a[1], why: 'Why ' + n + ' task ' + (j + 1) + ' matters', what: 'What to do for ' + n + ' task ' + (j + 1), action: a[0] };
    }) })),
  };
  const plan = FLOW.sanitizePlan(raw, 2, h);
  plan.generated_at = STARTED; plan.assistant = 'nova';
  if (M.version > 1) { plan.version = M.version; plan.request = M.request; plan.startsAt = M.newAt; plan.generated_at = M.newAt; plan.summary = 'Your new plan puts gift boxes first, on Meta, as you asked.'; }
  return plan;
}
app.get('/api/onboarding/plan', (q, r) => {
  M.polls++;
  if (M.mode === 'existing') return r.json({ status: 'none', locked: false, onboarding: false, plan: null });
  const h = FLOW.HORIZONS[M.period];
  const base = { onboarding: true, locked: false, businessName: 'Bloom & Wick', assistant: 'nova', period: M.period, horizon: { period: M.period, label: h.label, days: h.days }, attemptsLeft: 2, missing: [], sections: [], catalog: CATALOG.clientCatalog() };
  if (M.mode === 'generating') return r.json(Object.assign(base, { status: 'generating', plan: null }));
  if (M.mode === 'failed') return r.json(Object.assign(base, { status: 'failed', error: 'provider_error', plan: null }));
  // A new plan being written: ready after two polls (or failed)
  if (M.regen && M.regen.status === 'generating' && ++M.regenPolls >= 2) {
    if (M.regenFail) M.regen = { status: 'failed', error: 'provider_error', instructions: M.regen.instructions };
    else { M.version += 1; M.request = M.regen.instructions; M.newAt = new Date().toISOString(); M.regen = null; M.done = {}; }
  }
  const plan = planFor(M.period, M.perPhase);
  r.json(Object.assign(base, { status: 'ready', generatedAt: M.version > 1 ? M.newAt : STARTED, unlockedAt: STARTED, plan, horizon: plan.horizon, regen: M.regen, previous: M.version > 1 ? { replacedAt: M.newAt } : null, sections: FLOW.PLAN_SECTIONS.map(([id, title]) => ({ id, title })) }));
});
app.post('/api/onboarding/plan/regenerate', (q, r) => {
  M.regenBodies.push(q.body || {});
  if (M.regen && M.regen.status === 'generating') return r.status(409).json({ error: 'Your new marketing plan is already being written.', code: 'PLAN_REGENERATING' });
  M.regen = { status: 'generating', instructions: (q.body && q.body.instructions) || '', startedAt: new Date().toISOString() }; M.regenPolls = 0;
  const h = FLOW.HORIZONS[M.period], plan = planFor(M.period, M.perPhase);
  r.status(202).json({ onboarding: true, locked: false, businessName: 'Bloom & Wick', assistant: 'nova', period: M.period, horizon: plan.horizon, status: 'ready', generatedAt: STARTED, unlockedAt: STARTED, plan, regen: M.regen, catalog: CATALOG.clientCatalog(), sections: [], missing: [] });
});
app.post('/api/onboarding/plan', (q, r) => { M.mode = 'generating'; r.status(202).json({ status: 'generating', locked: false, onboarding: true, horizon: { label: '1 month' } }); });
app.get('/api/onboarding/progress', (q, r) => {
  if (M.mode === 'existing') return r.json({ locked: false, status: 'none', onboarding: false, phases: [], total: 0, completed: 0 });
  if (M.mode !== 'ready') return r.json({ locked: false, status: M.mode, onboarding: true, phases: [], total: 0, completed: 0 });
  r.json(Object.assign({ locked: false, status: 'ready', onboarding: true, startedAt: STARTED }, FLOW.planSteps(planFor(M.period, M.perPhase), STARTED, M.done)));
});
app.post('/api/onboarding/progress', (q, r) => {
  const b = q.body || {};
  // As the server: a task OrivenAI verifies can't be ticked by hand.
  const st = FLOW.planSteps(planFor(M.period, M.perPhase), STARTED, {}).phases.reduce((h, p) => h || p.steps.find((x) => x.id === b.stepId), null);
  if (st && st.verify === 'auto') return r.status(409).json({ code: 'VERIFIED_AUTOMATICALLY', error: 'This task completes by itself once you’ve done it in Create.' });
  if (b.done) M.done[b.stepId] = M.done[b.stepId] || new Date().toISOString(); else delete M.done[b.stepId];
  r.json(Object.assign({ locked: false, status: 'ready', onboarding: true }, FLOW.planSteps(planFor(M.period, M.perPhase), STARTED, M.done)));
});
app.all(/^\/api\//, (q, r) => r.json({}));
app.get('/', (q, r) => r.redirect('/app.html'));
app.get('/app', (q, r) => r.sendFile(path.join(ROOT, 'app.html'))); // as the real server serves it
app.use(express.static(ROOT));

const blocked = [];
async function fence(page) {
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(BASE + '/')) return r.continue();
    if (u.startsWith(DEV_API + '/')) return r.continue({ url: BASE + u.slice(DEV_API.length) });
    if (/^(data|blob):/.test(u)) return r.continue();
    if (r.request().method() === 'GET' && /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return r.continue();
    blocked.push(u.split('?')[0]); return r.abort('blockedbyclient');
  });
}
const LOCAL_CAMPS = [{ id: 'c-draft', name: 'Spring candles — Meta', platform: 'meta', status: 'draft', created: new Date(Date.now() - 864e5).toISOString(), pkg: { campaignName: 'Spring candles — Meta', strategy: { goal: 'Sales' } } }];
async function signIn(page, url) {
  await page.addInitScript(({ camps }) => { try { localStorage.setItem('oriven_campaigns_mock-nav', JSON.stringify(camps)); } catch (_) {} document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }); }, { camps: LOCAL_CAMPS });
  await page.goto(BASE + (url || '/app.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.orvAppNav, null, { timeout: 15000 });
  await page.evaluate(() => {
    window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token';
    if (window.orvTour) { window.orvTour.open = function () { window.__tourOpened = true; }; }
    window._dbSubscriptionStatus = 'paid';
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-nav', email: 'existing@example.invalid', user_metadata: { first_name: 'Alexandra van Dijk' } });
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { if (typeof window.orvOnboardingGate === 'function') window.orvOnboardingGate(); });
  await page.waitForTimeout(600);
}
const PAGES = [
  ['dashboard', 'Control Center', 'page-business-brain'], ['plan', 'Control Center', 'page-marketing-plan'], ['progress', 'Control Center', 'page-progress'],
  ['research', 'Research', 'page-research'], ['insights', 'Research', 'page-insights'],
  ['create', 'Create', 'page-create'], ['content', 'Create', 'page-my-content'],
  ['adstudio', 'Launch', 'page-launch'],
  ['overview', 'Campaigns', 'page-performance'], ['builder', 'Campaigns', 'page-orv-panel'],
  ['auto-overview', 'Automations', 'page-autopilot'], ['auto-scheduler', 'Automations', 'page-autopilot'], ['auto-rules', 'Automations', 'page-autopilot'], ['auto-activity', 'Automations', 'page-autopilot'],
];

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); await fence(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page);

    // ── 1. Structure ───────────────────────────────────────────────
    console.log('\n1. Structure');
    const st = await page.evaluate(() => {
      const root = document.querySelector('.orv-sb .onv');
      const secs = Array.from(root.querySelectorAll('.onv-sec')).map((s) => ({ h: s.querySelector('.onv-sec__t').textContent, tag: s.querySelector('.onv-sec__h').tagName, items: Array.from(s.querySelectorAll('.onv-item')).map((b) => b.querySelector('.onv-lbl').textContent) }));
      const h = root.querySelector('.onv-sec__h');
      return { secs, headClickable: !!root.querySelector('.onv-sec__h a, .onv-sec__h button, .onv-sec__h[onclick], .onv-sec__h[tabindex]'), cursor: getComputedStyle(h).cursor, pe: getComputedStyle(h).pointerEvents,
        icons: Array.from(root.querySelectorAll('.onv-item')).map((b) => b.querySelector('.onv-ic svg') && b.querySelector('.onv-ic svg').children.length) };
    });
    check('1.1 exactly six sections in order: Control Center, Research, Create, Launch, Campaigns, Automations', JSON.stringify(st.secs.map((s) => s.h)) === '["Control Center","Research","Create","Launch","Campaigns","Automations"]', st.secs.map((s) => s.h));
    check('1.2 the pages under each heading match the agreed structure', JSON.stringify(st.secs.map((s) => s.items)) === JSON.stringify([['Dashboard', 'Marketing Plan', 'Progress'], ['Research', 'Insights', 'Competitor Analysis'], ['Create', 'My Content', 'Creative Testing'], ['Ad Studio', 'Audience Builder'], ['Campaign Overview', 'Campaign Builder', 'Campaign Comparison'], ['Overview', 'Scheduler', 'Rules', 'Activity']]), st.secs.map((s) => s.items));
    check('1.3 section names are headings (h2), not links or buttons, with no pointer cursor', st.secs.every((s) => s.tag === 'H2') && !st.headClickable && st.cursor === 'default' && st.pe === 'none');
    check('1.4 every page has its own icon', st.icons.length === 18 && st.icons.every((n) => n >= 1), st.icons);
    check('1.5 no Analytics or Tasks entry, no seventh section', !(await page.evaluate(() => /Analytics|Tasks/.test(document.querySelector('.orv-sb .onv').textContent))) && st.secs.length === 6);
    check('1.6 the existing account is not sent into any onboarding (no overlay, no tour)', !(await page.$('#onx')) && !(await page.evaluate(() => window.__tourOpened)));
    const sb = await page.evaluate(() => ({ btn: !!document.querySelector('.onv-collapse, [aria-label*="ollapse"]'), cls: document.querySelector('.orv-sb').classList.contains('onv-collapsed'), w: Math.round(document.querySelector('.orv-sb').getBoundingClientRect().width) }));
    check('1.7 no collapse/expand button; the sidebar is always expanded (264px) with its labels', !sb.btn && !sb.cls && sb.w === 264, sb);
    const hd = await page.evaluate(() => { const logo = document.querySelector('.orv-sb .orv-sb-logo'); const img = logo.querySelector('img'); const r = img.getBoundingClientRect(), h = logo.getBoundingClientRect(), sb = document.querySelector('.orv-sb').getBoundingClientRect();
      return { text: logo.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), centre: Math.round((r.top + r.height / 2) - (h.top + h.height / 2)), inside: r.right < sb.right - 20, natural: img.naturalWidth === img.naturalHeight }; });
    check('1.8 the sidebar header is the logo only (no "ORIVEN" text), now 40px, square (not stretched), vertically centred, well inside the sidebar', hd.text === '' && hd.w === 40 && hd.h === 40 && Math.abs(hd.centre) <= 3 && hd.inside, hd);
    const ft = await page.evaluate(() => {
      const f = document.querySelector('.orv-sb .onv-foot'); if (!f) return null;
      const items = Array.from(f.querySelectorAll('[data-onv-foot]')).map((b) => b.getAttribute('data-onv-foot'));
      const cs = (sel) => getComputedStyle(f.querySelector(sel));
      return { items, name: f.querySelector('[data-onv-name]').textContent, plan: f.querySelector('[data-onv-plan]').textContent, platIc: !!f.querySelector('[data-onv-foot="platforms"] .onv-ic svg'), sameItem: f.querySelector('[data-onv-foot="platforms"]').className.indexOf('onv-item') >= 0, tourId: !!document.getElementById('orvNavSettingsBtn'), oldRow: !!document.querySelector('.orv-sb .orv-launcher-dots') };
    });
    check('1.9 the bottom area: Ad Platforms as a sidebar item (same style, its own icon), then one account row with a Settings button', ft && JSON.stringify(ft.items) === '["platforms","account","settings"]' && ft.platIc && ft.sameItem && ft.tourId && !ft.oldRow, ft);
    check('1.10 the account row shows the first name only (“Alexandra”): no surname, no email, never “OrivenAI”', ft && ft.name === 'Alexandra' && !/van Dijk|@|oriven/i.test(ft.name + ' ' + ft.plan) && !/existing@example/.test(await page.textContent('.orv-sb .onv-foot')), ft);
    await page.evaluate(() => { document.getElementById('sidebarUserName').textContent = 'OrivenAI'; });
    await page.waitForTimeout(200);
    check('1.10b the workspace name (“OrivenAI”) is never used as the person’s name', (await page.textContent('.orv-sb [data-onv-name]')) === 'Alexandra');
    await page.evaluate(() => window.orvAppNavSetFirstName('Maximiliana-Evangelina-Bartholomea Lindqvist'));
    await page.waitForTimeout(150);
    const lg = await page.evaluate(() => { const sb = document.querySelector('.orv-sb').getBoundingClientRect(), g = document.querySelector('.orv-sb [data-onv-foot="settings"]').getBoundingClientRect(), n = document.querySelector('.orv-sb [data-onv-name]'), a = document.querySelector('.orv-sb .onv-acct').getBoundingClientRect();
      return { name: n.textContent, gearInside: g.right <= sb.right - 8 && g.left >= sb.left, gearRight: Math.round(a.right - g.right), truncated: n.scrollWidth > n.clientWidth && getComputedStyle(n).textOverflow === 'ellipsis', gearH: Math.round(g.height) }; });
    check('1.10c a very long first name is cut with an ellipsis; the Settings gear stays inside the sidebar, aligned right (surname still left out)', lg.name === 'Maximiliana-Evangelina-Bartholomea' && lg.gearInside && lg.gearRight <= 1 && lg.truncated, lg);
    await page.screenshot({ path: path.join(SHOTS, 'account-long-name.png'), clip: { x: 0, y: 780, width: 280, height: 120 } });
    await page.evaluate(() => window.orvAppNavSetFirstName('Alexandra'));
    await page.waitForTimeout(150);
    await page.click('.orv-sb [data-onv-foot="platforms"]'); await page.waitForTimeout(600);
    const plat = await page.evaluate(() => ({ panel: !!(document.getElementById('bizPanelConnections') || {}).offsetParent, on: document.querySelector('.orv-sb [data-onv-foot="platforms"]').classList.contains('is-on'), back: /Back to Control Center/.test(document.getElementById('page-business-brain').innerText), navOn: document.querySelectorAll('.orv-sb .onv-sec .onv-item.is-on').length }));
    check('1.11 Ad Platforms opens its page, is highlighted like any other page, and has no "Back to Control Center" link', plat.panel && plat.on && !plat.back && plat.navOn === 0, plat);
    check('1.12 no "Back to Control Center" links remain anywhere in the app (the sidebar is the way back)', await page.evaluate(() => !/Back to Control Center/.test(document.body.innerHTML)));
    await page.click('.orv-sb [data-onv-foot="account"]'); await page.waitForTimeout(500);
    const acc = await page.evaluate(() => { const m = document.getElementById('modal-settings'); const on = document.querySelector('.smd-ni.active'); return { open: !!m && getComputedStyle(m).display !== 'none', sec: on && on.dataset.smd }; });
    check('1.13 the account row opens the existing Settings at Account', acc.open && acc.sec === 'account', acc);
    await page.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-settings'); });
    await page.waitForTimeout(300);
    await page.click('.orv-sb [data-onv-foot="settings"]'); await page.waitForTimeout(500);
    const set = await page.evaluate(() => { const m = document.getElementById('modal-settings'); const on = document.querySelector('.smd-ni.active'); return { open: !!m && getComputedStyle(m).display !== 'none', sec: on && on.dataset.smd }; });
    check('1.14 the Settings button opens the same Settings at General (no second settings page)', set.open && set.sec === 'general', set);
    await page.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-settings'); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'sidebar-footer-1440.png'), clip: { x: 0, y: 560, width: 300, height: 340 } });

    // ── 2. Every page ──────────────────────────────────────────────
    console.log('\n2. Every page opens, with the right highlight');
    await page.screenshot({ path: path.join(SHOTS, 'start-1440.png') });
    const res = [];
    for (const [id, sec, pid] of PAGES) {
      await page.click('.orv-sb .onv-item[data-onv="' + id + '"]');
      await page.waitForTimeout(id.startsWith('auto') ? 900 : 500);
      const r = await page.evaluate((id) => {
        const on = Array.from(document.querySelectorAll('.orv-sb .onv-item.is-on')).map((b) => b.dataset.onv);
        const act = document.querySelector('.page.active');
        const secOn = Array.from(document.querySelectorAll('.orv-sb .onv-sec.is-active .onv-sec__t')).map((x) => x.textContent);
        const bar = document.querySelector('#onvCtx, .onv-ctx, .onv-ctx__next');
        const host = act && document.querySelector('.mc').contains(act) ? document.querySelector('.mc') : act;
        return { on, page: act && act.id, secOn, bar: !!bar, first: host && host.firstElementChild ? (host.firstElementChild.id || host.firstElementChild.className) : null,
          aria: (document.querySelector('.orv-sb .onv-item[data-onv="' + id + '"]') || {}).getAttribute && document.querySelector('.orv-sb .onv-item[data-onv="' + id + '"]').getAttribute('aria-current'),
          atmTab: window.orvAutomations && window.orvAutomations.tab ? window.orvAutomations.tab() : null, atmH1: (document.querySelector('#auRoot .atm-title') || {}).textContent, atmTabs: document.querySelectorAll('#auRoot .atm-tab, #auRoot [role="tablist"]').length };
      }, id);
      res.push(Object.assign({ id, sec, pid }, r));
      if (['dashboard', 'insights', 'progress', 'builder', 'auto-rules', 'adstudio'].includes(id)) await page.screenshot({ path: path.join(SHOTS, id + '-1440.png') });
    }
    const badHl = res.filter((r) => r.on.length !== 1 || r.on[0] !== r.id || r.page !== r.pid || r.secOn[0] !== r.sec || r.aria !== 'page');
    check('2.1 all 18 links open their page; exactly one item highlighted, aria-current set, its section marked active', !badHl.length, badHl);
    check('2.2 no top context bar on any page (no section/page line, description, divider or "Next" buttons): pages start with their own content', res.every((r) => !r.bar && !/onv-ctx/.test(String(r.first))), res.filter((r) => r.bar).map((r) => r.id));
    check('2.3 each Automations link opens its own page (Overview, Scheduler, Rules, Activity), headed by its own name, with no tab strip repeating the sidebar', ['overview', 'scheduler', 'rules', 'activity'].every((t) => { const r = res.find((x) => x.id === 'auto-' + t) || {}; return r.atmTab === t && r.atmTabs === 0 && r.atmH1 === t.charAt(0).toUpperCase() + t.slice(1); }), res.filter((r) => r.id.startsWith('auto')).map((r) => [r.id, r.atmTab, r.atmH1, r.atmTabs]));
    await page.click('.orv-sb .onv-item[data-onv="plan"]'); await page.waitForTimeout(600);
    const mp = await page.evaluate(() => { const pg = document.getElementById('page-marketing-plan'); return { active: pg.classList.contains('active'), text: pg.innerText, state: (pg.querySelector('.mpl-empty') || {}).dataset, planning: !!(document.getElementById('bizPanelPlanning') || {}).offsetParent }; });
    check('2.4 Marketing Plan is its own page; this account has no plan: a short empty state (activation and payment), no invented plan', mp.active && mp.state && mp.state.state === 'none' && /No marketing plan yet/.test(mp.text) && /activation and payment/.test(mp.text) && !mp.planning && !/Priorities|Action plan|Week 1/.test(mp.text), mp);
    check('2.4b …and nothing unrelated on it (no Back to Control Center, Plan advertising, Upcoming, Budget plan, Brief, Latest research)', !/Back to Control Center|Plan advertising|Upcoming|Budget plan|Brief|Latest research/i.test(mp.text), mp.text.slice(0, 300));
    await page.click('.orv-sb .onv-item[data-onv="progress"]'); await page.waitForTimeout(600);
    const pgx = await page.evaluate(() => { const pg = document.getElementById('page-progress'); return { active: pg.classList.contains('active'), text: pg.innerText, steps: pg.querySelectorAll('.prg-step').length }; });
    check('2.4c Progress for this account: no steps, an honest empty state, no numbers or fake data', pgx.active && pgx.steps === 0 && /No progress steps yet/.test(pgx.text) && !/\d/.test(pgx.text), pgx);
    check('2.4d opening Marketing Plan / Progress made no paid or write request (no plan generation, no credits)', !calls.some((c) => c.m !== 'GET' && /onboarding\/plan|onboarding\/progress|credits|checkout/.test(c.p)), calls.filter((c) => c.m !== 'GET').map((c) => c.p));
    await page.click('.orv-sb .onv-item[data-onv="insights"]'); await page.waitForTimeout(600);
    await page.click('#insRoot [data-ins="tab"][data-tab="library"]'); await page.waitForTimeout(200);
    const ins = await page.evaluate(() => ({ h: (document.querySelector('#insRoot .rx-title') || {}).textContent, lib: /Candle market in Utrecht/.test((document.getElementById('insRoot') || {}).textContent || ''), form: !!document.querySelector('#page-insights #researchQueryInput') }));
    check('2.5 Insights is its own page with the saved research (real reports, no research form)', ins.h === 'Insights' && ins.lib && !ins.form, ins);
    await page.click('#insRoot [data-ins="new"]'); await page.waitForTimeout(500);
    check('2.6 "New research" from Insights goes to the Research form and the highlight follows', await page.isVisible('#researchQueryInput') && await page.evaluate(() => document.querySelector('.orv-sb .onv-item.is-on').dataset.onv === 'research'));
    await page.click('.orv-sb .onv-item[data-onv="content"]'); await page.waitForTimeout(600);
    const mcx = await page.evaluate(() => ({ soon: /Soon/i.test(document.querySelector('.orv-sb .onv-item[data-onv="content"]').textContent), page: document.querySelector('.page.active').id, h1: (document.querySelector('#mclRoot h1') || {}).textContent, empty: !!document.querySelector('#mclRoot .mcl-empty[data-state="empty"]') }));
    check('2.7 My Content is a real page (no "Soon" badge); this account has nothing saved: an empty state, no sample content', !mcx.soon && mcx.page === 'page-my-content' && mcx.h1 === 'My Content' && mcx.empty, mcx);
    await page.click('.orv-sb .onv-item[data-onv="builder"]'); await page.waitForTimeout(400);
    const cb = await page.evaluate(() => ({ rows: Array.from(document.querySelectorAll('.onv-cb__list li b')).map((b) => b.textContent) }));
    check('2.8 Campaign Builder lists the account’s real campaigns to open', JSON.stringify(cb.rows) === '["Spring candles — Meta"]', cb);
    await page.click('.onv-cb__list [data-onv-open="c-draft"]'); await page.waitForTimeout(800);
    check('2.9 "Open in builder" opens the existing campaign editor, and Campaign Builder stays highlighted', await page.evaluate(() => ['page-campaign-results', 'page-ad-workspace'].includes(document.querySelector('.page.active').id) && document.querySelector('.orv-sb .onv-item.is-on').dataset.onv === 'builder'));
    await page.click('.orv-sb .onv-item[data-onv="dashboard"]'); await page.waitForTimeout(500);
    await page.evaluate(() => window.bizGoTo('planning')); await page.waitForTimeout(500);
    check('2.10 the older advertising Planning tab (reached from the Dashboard) still opens, inside Control Center (Dashboard highlighted)', await page.evaluate(() => !!(document.getElementById('bizPanelPlanning') || {}).offsetParent && document.querySelector('.orv-sb .onv-item.is-on').dataset.onv === 'dashboard'));
    await page.evaluate(() => window._orvNav('performance', 'page-performance')); await page.waitForTimeout(500);
    check('2.11 navigation from elsewhere in the app (not the sidebar) still moves the highlight', await page.evaluate(() => document.querySelector('.orv-sb .onv-item.is-on').dataset.onv === 'overview'));

    // ── 3. Motion ──────────────────────────────────────────────────
    console.log('\n3. Icons and motion');
    await page.click('.orv-sb .onv-item[data-onv="auto-scheduler"]');
    await page.waitForTimeout(80);
    const just = await page.evaluate(() => { const b = document.querySelector('.orv-sb .onv-item[data-onv="auto-scheduler"]'); return { just: b.classList.contains('is-just'), anim: getComputedStyle(b.querySelector('.i-hand')).animationName, enter: getComputedStyle(document.querySelector('.page.active')).animationName }; });
    check('3.1 opening a page plays its icon’s short motion once; the page enters with the app’s own existing transition', just.just && just.anim === 'onv-turn' && /^(orvPageIn|owPageIn)$/.test(just.enter), just);
    await page.waitForTimeout(1000);
    check('3.2 the motion ends (no looping animation left running)', await page.evaluate(() => !document.querySelector('.onv-item.is-just') && Array.from(document.querySelectorAll('.onv *')).every((e) => { const cs = getComputedStyle(e); return cs.animationName === 'none' || cs.animationIterationCount !== 'infinite'; })));
    await page.hover('.orv-sb .onv-item[data-onv="research"]');
    await page.waitForTimeout(60);
    check('3.3 hover plays the icon motion (magnifier scans)', (await page.evaluate(() => getComputedStyle(document.querySelector('.orv-sb .onv-item[data-onv="research"] .i-lens')).animationName)) === 'onv-scan');
    const fill = await page.evaluate(() => { const i = document.querySelector('.orv-sb .onv-sec.is-active .onv-route i'); return i && i.style.getPropertyValue('--fill'); });
    check('3.4 the route line of the open section fills to the open page (Scheduler: 2nd of 4)', fill === '0.375', fill);

    // ── 4. Existing pages still work ───────────────────────────────
    console.log('\n4. Existing functionality');
    await page.click('.orv-sb .onv-item[data-onv="research"]'); await page.waitForTimeout(500);
    await page.fill('#researchQueryInput', 'Who buys handmade candles in Utrecht?');
    check('4.1 Research: the form works (typing, research types, start button)', (await page.inputValue('#researchQueryInput')).length > 10 && await page.isVisible('#researchSubmitBtn'));
    await page.click('.orv-sb .onv-item[data-onv="create"]'); await page.waitForTimeout(700);
    check('4.2 Create opens its builder', await page.evaluate(() => { const p = document.getElementById('page-create'); return p.classList.contains('active') && p.innerText.length > 100; }));
    await page.click('.orv-sb .onv-item[data-onv="adstudio"]'); await page.waitForTimeout(700);
    check('4.3 Ad Studio (Launch) renders its campaign list', await page.evaluate(() => /Spring candles/.test(document.getElementById('page-launch').innerText)));
    await page.click('.orv-sb .onv-item[data-onv="auto-rules"]'); await page.waitForTimeout(800);
    check('4.4 Automations renders its page and panel (and its own actions)', await page.evaluate(() => !!document.querySelector('#auRoot .atm-panel') && !!document.querySelector('#auRoot [data-au="new-rule"]')));
    check('4.5 no credits, subscription or onboarding writes were made by navigating', !calls.some((c) => /credits|checkout|subscription|onboarding\/complete|onboarding\/session/.test(c.p) && c.m !== 'GET'), calls.filter((c) => c.m !== 'GET').map((c) => c.p));

    // ── 5. Always expanded, keyboard ───────────────────────────────
    console.log('\n5. Always expanded, keyboard');
    const pOld = await ctx.newPage(); await fence(pOld);
    await pOld.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('orv_nav_collapsed', '1'); sessionStorage.setItem('seeded', '1'); } } catch (_) {} });
    await signIn(pOld);
    const exp = await pOld.evaluate(() => ({ w: Math.round(document.querySelector('.orv-sb').getBoundingClientRect().width), lbl: getComputedStyle(document.querySelector('.orv-sb .onv-lbl')).display, saved: localStorage.getItem('orv_nav_collapsed') }));
    check('5.1 an old saved "collapsed" setting is ignored and cleared: still expanded with labels', exp.w === 264 && exp.lbl !== 'none' && exp.saved === null, exp);
    await pOld.close();
    await page.focus('.orv-sb .onv-item[data-onv="dashboard"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    check('5.3 keyboard: Enter on a focused page opens it', await page.evaluate(() => document.querySelector('.orv-sb .onv-item.is-on').dataset.onv === 'dashboard'));
    await page.close();

    // ── 6. Widths ──────────────────────────────────────────────────
    console.log('\n6. Desktop, laptop, tablet, mobile');
    for (const [w, h] of [[1440, 900], [1180, 760], [1024, 768], [768, 1024], [390, 844]]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: h } });
      const p2 = await c2.newPage(); await fence(p2); p2.on('pageerror', (e) => errors.push(w + ': ' + e.message));
      await signIn(p2);
      if (w <= 1024) { // the app's drawer breakpoint (styles.css: .orv-sb hidden at <=1024px)
        await p2.click('#orvMobToggle'); await p2.waitForTimeout(400);
        const d = await p2.evaluate(() => ({ secs: document.querySelectorAll('.orv-mob-drawer .onv-sec').length, items: document.querySelectorAll('.orv-mob-drawer .orv-mob-drawer-nav .onv-item').length, small: Array.from(document.querySelectorAll('.orv-mob-drawer .onv-item, .orv-mob-drawer .onv-acct__main')).filter((b) => b.getBoundingClientRect().height < 44).length, foot: !!document.querySelector('.orv-mob-drawer [data-onv-foot="platforms"]') && !!document.querySelector('.orv-mob-drawer [data-onv-foot="account"]') && (function () { const dr = document.getElementById('orvMobDrawer').getBoundingClientRect(), g = document.querySelector('.orv-mob-drawer [data-onv-foot="settings"]').getBoundingClientRect(); return g.right <= dr.right && g.left >= dr.left; })() && document.querySelector('.orv-mob-drawer [data-onv-name]').textContent === 'Alexandra' }));
        await p2.screenshot({ path: path.join(SHOTS, 'drawer-' + w + '.png') });
        await p2.click('.orv-mob-drawer .onv-item[data-onv="auto-activity"]'); await p2.waitForTimeout(900);
        const after = await p2.evaluate(() => ({ open: document.getElementById('orvMobDrawer').classList.contains('open') || document.getElementById('orvMobDrawer').getAttribute('aria-hidden') === 'false', on: (document.querySelector('.orv-mob-drawer .onv-item.is-on') || {}).dataset, page: document.querySelector('.page.active').id, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
        check(`6.${w} mobile drawer: six sections, 18 pages, 44px touch targets; picking a page closes it and opens the page; no horizontal overflow`, d.secs === 6 && d.items === 18 && d.small === 0 && d.foot && !after.open && after.on && after.on.onv === 'auto-activity' && after.page === 'page-autopilot' && after.ov <= 1, { d, after });
        await p2.screenshot({ path: path.join(SHOTS, 'activity-' + w + '.png') });
      } else {
        const d = await p2.evaluate(() => ({ w: Math.round(document.querySelector('.orv-sb').getBoundingClientRect().width), ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
        check(`6.${w} sidebar is expanded (${d.w}px) at this width too, no horizontal overflow`, d.w === 264 && d.ov <= 1, d);
        await p2.click('.orv-sb .onv-item[data-onv="overview"]'); await p2.waitForTimeout(600);
        await p2.screenshot({ path: path.join(SHOTS, 'campaigns-' + w + '.png') });
      }
      await c2.close();
    }
    const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p3 = await c3.newPage(); await fence(p3); p3.on('pageerror', (e) => errors.push('rm: ' + e.message));
    await signIn(p3);
    await p3.click('.orv-sb .onv-item[data-onv="auto-scheduler"]'); await p3.waitForTimeout(80);
    check('6.rm reduced motion: no icon motion and no route animation', (await p3.evaluate(() => [getComputedStyle(document.querySelector('.orv-sb .onv-item[data-onv="auto-scheduler"] .i-hand')).animationName, getComputedStyle(document.querySelector('.orv-sb .onv-route i')).transitionDuration])).every((a) => a === 'none' || a === '0s'));
    await c3.close();

    // ── 7. Dashboard fits the screen ───────────────────────────────
    console.log('\n7. Dashboard without vertical scrolling');
    for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1100, 640]]) {
      const c4 = await browser.newContext({ viewport: { width: w, height: h } });
      const p4 = await c4.newPage(); await fence(p4); p4.on('pageerror', (e) => errors.push('dash ' + w + ': ' + e.message));
      await signIn(p4);
      await p4.click('.orv-sb .onv-item[data-onv="dashboard"]'); await p4.waitForTimeout(900);
      const d = await p4.evaluate(() => {
        const mc = document.querySelector('.mc');
        const ids = ['owNeeds', 'ovPerf', 'ovCamps', 'ovAuto', 'bicGrid'];
        const vis = ids.map((id) => { const e = document.getElementById(id); const r = e && e.getBoundingClientRect(); return { id, shown: !!(e && e.offsetParent !== null && r.height > 0) }; });
        const mods = document.getElementById('bicGrid');
        return { over: mc.scrollHeight - mc.clientHeight, vis: vis.filter((v) => !v.shown).map((v) => v.id), modsScroll: mods ? mods.scrollHeight > mods.clientHeight + 1 : null, modsOverflow: mods ? getComputedStyle(mods).overflowY : null, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      check(`7.${w}x${h} Dashboard: the page doesn't scroll vertically, every block is shown, nothing wider than the screen` + (d.modsScroll ? ' (the business context list scrolls inside its card)' : ''), d.over <= 1 && !d.vis.length && d.ov <= 1 && (!d.modsScroll || d.modsOverflow === 'auto'), d);
      if (w === 1280) await p4.screenshot({ path: path.join(SHOTS, 'dashboard-1280x720.png') });
      await c4.close();
    }
    {
      const c5 = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p5 = await c5.newPage(); await fence(p5);
      await signIn(p5);
      await p5.evaluate(() => window.orvAppNav.go('dashboard')); await p5.waitForTimeout(900);
      const d = await p5.evaluate(() => { const mc = document.querySelector('.mc'); const wrap = document.querySelector('#page-business-brain .orv-page-wrap-biz'); return { scrolls: mc.scrollHeight > mc.clientHeight, wrapOverflow: getComputedStyle(wrap).overflow, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      check('7.390 phone: the stacked Dashboard keeps the normal page scroll (nothing clipped), no horizontal overflow', d.scrolls && d.wrapOverflow !== 'hidden' && d.ov <= 1, d);
      await c5.close();
    }

    // ── 8. Marketing Plan for a paid account with a generated plan ──
    console.log('\n8. Marketing Plan (paid account, plan generated after onboarding)');
    M.mode = 'ready'; M.period = 'monthly'; M.perPhase = 3; M.done = {};
    const c6 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p6 = await c6.newPage(); await fence(p6); p6.on('pageerror', (e) => errors.push('plan: ' + e.message));
    await signIn(p6);
    const calls0 = calls.length;
    await p6.click('.orv-sb .onv-item[data-onv="plan"]'); await p6.waitForTimeout(700);
    const pl = await p6.evaluate(() => {
      const pg = document.getElementById('page-marketing-plan'), mc = document.querySelector('.mc');
      let fixed = null; for (let e = pg.querySelector('.mpl-doc'); e && e !== mc; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll|hidden)/.test(cs.overflowY) && e.clientHeight < e.scrollHeight) fixed = e.className || e.id; }
      return { eyebrow: (pg.querySelector('.mpl-eyebrow') || {}).textContent, h1: (pg.querySelector('h1') || {}).textContent, secs: Array.from(pg.querySelectorAll('.mpl-sec h2')).map((h) => h.textContent), phases: pg.querySelectorAll('.mpl-road > li').length, text: pg.innerText,
        scroll: mc.scrollHeight > mc.clientHeight + 200, fixed, on: document.querySelector('.orv-sb .onv-item.is-on').dataset.onv };
    });
    check('8.1 the whole plan is on the page: business name, the purchased period (1 month), every section, four weekly phases', pl.h1 === 'Bloom & Wick' && /Marketing plan · 1 month/.test(pl.eyebrow) && pl.secs.length === 9 && pl.secs.includes('Action plan · 1 month') && pl.phases === 4 && /Week 4/.test(pl.text) && pl.on === 'plan', pl);
    check('8.2 a long plan scrolls with the page (not squeezed into a small fixed-height box)', pl.scroll && !pl.fixed, { scroll: pl.scroll, fixed: pl.fixed });
    check('8.3 only the plan: no Back to Control Center, Plan advertising, Upcoming, Budget plan, Brief, Latest research or dashboard cards', !/Back to Control Center|Plan advertising|Upcoming|Budget plan|Brief|Latest research|Needs you|Business context/i.test(pl.text));
    await p6.screenshot({ path: path.join(SHOTS, 'plan-1440.png') });
    await p6.click('[data-mpl-update]'); await p6.waitForTimeout(200);
    const up = await p6.evaluate(() => ({ open: !document.getElementById('mplUpdate').hidden, t: document.getElementById('mplUpdate').innerText }));
    check('8.4 "Write a new plan" opens a real form: what should change, ideas, what happens (current plan stays, Progress restarts, nothing else touched), the cost — no "coming soon"', up.open && /What should change\?/.test(up.t) && !!(await p6.$('#mplRegenText')) && /current plan stays until the new one is ready/i.test(up.t) && /Progress starts again/.test(up.t) && /research, content, audiences and campaigns aren’t touched/.test(up.t) && /Write new plan · 90 credits/.test(up.t) && !/soon/i.test(up.t), up.t.slice(0, 300));
    check('8.5 opening the plan and the form made no write or AI request', !calls.slice(calls0).some((c) => c.m !== 'GET'), calls.slice(calls0).filter((c) => c.m !== 'GET').map((c) => c.p));
    await p6.click('[data-mpl-jump="positioning"]'); await p6.waitForTimeout(700);
    const jump = await p6.evaluate(() => ({ top: Math.round(document.getElementById('mpl-positioning').getBoundingClientRect().top), st: document.querySelector('.mc').scrollTop }));
    check('8.6 the section index jumps to a section', jump.top < 200 && jump.top > -50, jump);
    await p6.screenshot({ path: path.join(SHOTS, 'plan-scrolled-1440.png') });
    const tk = await p6.evaluate(() => { const pg = document.getElementById('page-marketing-plan'); const first = pg.querySelector('.mpl-task details'); if (first) first.open = true;
      return { tasks: pg.querySelectorAll('.mpl-task').length, btns: Array.from(pg.querySelectorAll('.mpl-task [data-orv-page]')).map((b) => b.getAttribute('data-orv-page')), known: Array.from(pg.querySelectorAll('.mpl-task [data-orv-page]')).every((b) => window.orvPages.has(b.getAttribute('data-orv-page'))), first: first ? first.innerText : '', now: !!pg.querySelector('.mpl-road > li[data-state="now"]') }; });
    check('8.7 every task: title, why, what to do, its OrivenAI page and a direct button (4 weeks × 3 tasks); the current week marked', tk.tasks === 12 && tk.btns.length === 12 && tk.known && /Why:/.test(tk.first) && /What to do:/.test(tk.first) && /Campaign Overview/.test(tk.first) && tk.now, tk);
    await p6.click('.mpl-road > li:first-child .mpl-task:nth-child(3) details summary'); await p6.waitForTimeout(150);
    await p6.click('.mpl-road > li:first-child .mpl-task:nth-child(3) [data-orv-page]'); await p6.waitForTimeout(700);
    check('8.8 a task’s button opens its page directly (Audience Builder)', await p6.evaluate(() => document.querySelector('.page.active').id === 'page-audience-builder'));
    await p6.click('.orv-sb .onv-item[data-onv="plan"]'); await p6.waitForTimeout(400);

    // ── 9. Progress for that account ───────────────────────────────
    console.log('\n9. Progress');
    await p6.click('.orv-sb .onv-item[data-onv="progress"]'); await p6.waitForTimeout(700);
    const pr = await p6.evaluate(() => { const pg = document.getElementById('page-progress'); return { phases: pg.querySelectorAll('.prg-phase').length, steps: pg.querySelectorAll('.prg-step').length, count: (pg.querySelector('.prg-count') || {}).textContent, eyebrow: (pg.querySelector('.mpl-eyebrow') || {}).textContent, now: (pg.querySelector('.prg-phase[data-state="now"] summary b') || {}).textContent, text: pg.innerText, secs: !!pg.querySelector('.mpl-sec') }; });
    check('9.1 the tasks load from the plan: 4 weekly phases, 12 tasks, 0 of 12 done, the current week marked', pr.phases === 4 && pr.steps === 12 && /0 of 12 tasks done/.test(pr.count) && /Progress · 1 month/.test(pr.eyebrow) && pr.now === 'Week 2', pr);
    check('9.2 only actionable steps: no dashboard cards, plan preview, business info or statistics', !/Needs you|Business context|Performance|Priorities|Positioning/i.test(pr.text) && !pr.secs);
    await p6.screenshot({ path: path.join(SHOTS, 'progress-1440.png') });
    await p6.click('[data-prg-toggle="p1-a1"]'); await p6.waitForTimeout(500);
    const t1 = await p6.evaluate(() => ({ aria: document.querySelector('[data-prg-toggle="p1-a1"]').getAttribute('aria-checked'), count: document.querySelector('.prg-count').textContent, done: document.querySelector('.prg-step[data-step="p1-a1"]').classList.contains('is-done') }));
    check('9.3 ticking a step marks it done and stores it (POST to the server)', t1.aria === 'true' && t1.done && /1 of 12/.test(t1.count) && !!M.done['p1-a1'] && calls.some((c) => c.m === 'POST' && c.p === '/api/onboarding/progress' && c.body.stepId === 'p1-a1' && c.body.done === true), t1);
    await p6.close();
    const p7 = await c6.newPage(); await fence(p7);
    await signIn(p7);
    await p7.click('.orv-sb .onv-item[data-onv="progress"]'); await p7.waitForTimeout(700);
    const t2 = await p7.evaluate(() => ({ aria: (document.querySelector('[data-prg-toggle="p1-a1"]') || {}).getAttribute && document.querySelector('[data-prg-toggle="p1-a1"]').getAttribute('aria-checked'), count: (document.querySelector('.prg-count') || {}).textContent }));
    check('9.4 the completed step is still done when the page is opened again (new session)', t2.aria === 'true' && /1 of 12/.test(t2.count), t2);
    await p7.click('.prg-step[data-step="p2-a2"] .prg-go'); await p7.waitForTimeout(700);
    check('9.5 a step’s "Open Create" button takes you to Create', await p7.evaluate(() => document.querySelector('.page.active').id === 'page-create' && document.querySelector('.orv-sb .onv-item.is-on').dataset.onv === 'create'));
    await p7.click('.orv-sb .onv-item[data-onv="progress"]'); await p7.waitForTimeout(600);
    await p7.click('[data-prg-toggle="p1-a1"]'); await p7.waitForTimeout(500);
    check('9.6 a step can be unticked again', !M.done['p1-a1'] && /0 of 12/.test(await p7.textContent('.prg-count')));
    const au = await p7.evaluate(() => { const li = document.querySelector('.prg-step[data-step="p1-a2"]'); const pg = document.getElementById('page-progress');
      return { toggle: !!li.querySelector('[data-prg-toggle]'), mark: !!li.querySelector('.prg-check--auto'), t: li.innerText, stats: Array.from(pg.querySelectorAll('.prg-stat')).map((x) => x.innerText.replace(/\s+/g, ' ').toLowerCase()), months: pg.querySelectorAll('.prg-months li').length, next: (pg.querySelector('.prg-next') || {}).innerText || '' }; });
    check('9.7 a task OrivenAI verifies has no tick box (opening a page or clicking never completes it) and says it ticks off by itself', !au.toggle && au.mark && /ticks off by itself/.test(au.t), au);
    check('9.8 the overview: current phase, done this phase, completed, remaining, progress per week and the next task with its button', au.stats.length === 4 && /week 2 current phase/.test(au.stats[0]) && /^0 completed/.test(au.stats[2]) && /^12 remaining/.test(au.stats[3]) && au.months === 4 && /Next up/i.test(au.next), au);
    const posts0 = calls.filter((c) => c.m === 'POST' && c.p === '/api/onboarding/progress').length;
    await p7.evaluate(() => apiFetch('/api/onboarding/progress', { method: 'POST', body: JSON.stringify({ stepId: 'p1-a2', done: true }) }).then((r) => r && r.status)).then((st) => check('9.9 …and a hand-made request to tick it is refused (409, as the server does)', st === 409 && !M.done['p1-a2'], { st, posts0 }));
    await p7.close();

    // ── 10. Duration decides the plan and the steps ────────────────
    console.log('\n10. The purchased period');
    for (const [period, per, phases, label, total] of [['flex', 5, 2, '14 days', 10], ['quarterly', 5, 6, '3 months', 30], ['annual', 9, 12, '12 months', 108]]) {
      M.period = period; M.perPhase = per; M.done = {};
      const p8 = await c6.newPage(); await fence(p8);
      await signIn(p8);
      await p8.click('.orv-sb .onv-item[data-onv="plan"]'); await p8.waitForTimeout(600);
      const a = await p8.evaluate(() => ({ eyebrow: document.querySelector('#page-marketing-plan .mpl-eyebrow').textContent, phases: document.querySelectorAll('#page-marketing-plan .mpl-road > li').length }));
      await p8.click('.orv-sb .onv-item[data-onv="progress"]'); await p8.waitForTimeout(600);
      const b = await p8.evaluate(() => ({ count: document.querySelector('.prg-count').textContent, phases: document.querySelectorAll('.prg-phase').length, steps: document.querySelectorAll('.prg-step').length }));
      check(`10.${period} ${label}: the plan covers ${label} (${phases} phases) and Progress has ${total} steps`, new RegExp(label).test(a.eyebrow) && a.phases === phases && b.phases === phases && b.steps === total && new RegExp('0 of ' + total).test(b.count), { a, b });
      if (period === 'annual') await p8.screenshot({ path: path.join(SHOTS, 'progress-annual-1440.png') });
      await p8.close();
    }

    // ── 11. Generating and failed plans ────────────────────────────
    console.log('\n11. Plan being written, failed plan');
    M.mode = 'generating'; M.period = 'monthly'; M.perPhase = 3;
    const p9 = await c6.newPage(); await fence(p9);
    await signIn(p9);
    await p9.click('.orv-sb .onv-item[data-onv="plan"]'); await p9.waitForTimeout(600);
    const g = await p9.evaluate(() => ({ st: (document.querySelector('#page-marketing-plan .mpl-empty') || {}).dataset, t: document.getElementById('page-marketing-plan').innerText }));
    check('11.1 right after payment: "Preparing your marketing plan" for the purchased period, no plan content yet', g.st && g.st.state === 'generating' && /next 1 month/.test(g.t), g);
    const polls0 = M.polls; M.mode = 'ready';
    await p9.waitForTimeout(4800);
    check('11.2 …and it appears by itself when it is ready (polls the server; nothing is started from the page)', M.polls > polls0 && await p9.isVisible('#page-marketing-plan .mpl-doc') && !calls.slice(calls0).some((c) => c.m === 'POST' && c.p === '/api/onboarding/plan'));
    M.mode = 'failed';
    await p9.click('.orv-sb .onv-item[data-onv="dashboard"]'); await p9.waitForTimeout(300);
    await p9.evaluate(() => window.orvPlanPages.reload());
    await p9.click('.orv-sb .onv-item[data-onv="plan"]'); await p9.waitForTimeout(600);
    const f = await p9.evaluate(() => document.getElementById('page-marketing-plan').innerText);
    check('11.3 a failed plan says so, keeps the answers and offers "Try again" (no credits)', /couldn’t be prepared/.test(f) && /2 attempts left · no credits are used/.test(f), f.slice(0, 200));
    await p9.click('[data-mpl-retry]'); await p9.waitForTimeout(500);
    check('11.4 "Try again" asks the server once (POST) and shows the plan being written', calls.filter((c) => c.m === 'POST' && c.p === '/api/onboarding/plan').length === 1 && /Preparing your marketing plan/.test(await p9.textContent('#page-marketing-plan')));
    await p9.close();
    // ── 11b. A new plan on request ───────────────────────────────────
    console.log('\n11b. A new plan on request');
    M.mode = 'ready'; M.period = 'monthly'; M.perPhase = 3; M.done = {};
    const p12 = await c6.newPage(); await fence(p12);
    await signIn(p12);
    await p12.click('.orv-sb .onv-item[data-onv="plan"]'); await p12.waitForTimeout(700);
    await p12.click('[data-mpl-update]'); await p12.waitForTimeout(200);
    await p12.fill('#mplRegenText', 'We now sell gift boxes');
    await p12.click('[data-mpl-idea="Focus on Meta and Instagram only"]'); await p12.waitForTimeout(100);
    const txt12 = await p12.inputValue('#mplRegenText');
    check('11b.1 an idea is added to what the owner wrote', txt12 === 'We now sell gift boxes. Focus on Meta and Instagram only', txt12);
    await p12.click('.mpl-regen [type="submit"]'); await p12.waitForTimeout(600);
    const g12 = await p12.evaluate(() => { const pg = document.getElementById('page-marketing-plan'); return { banner: (pg.querySelector('.mpl-regen-state') || {}).innerText || '', h1: pg.querySelector('h1').textContent, summary: (pg.querySelector('.mpl-summary') || {}).textContent, newBtn: !!pg.querySelector('[data-mpl-update]') }; });
    check('11b.2 submitting sends the instructions; "Writing your new plan…" shows while the current plan stays readable; no second request button meanwhile', M.regenBodies.length === 1 && M.regenBodies[0].instructions === 'We now sell gift boxes. Focus on Meta and Instagram only' && /Writing your new plan/.test(g12.banner) && /current plan below stays/.test(g12.banner) && g12.h1 === 'Bloom & Wick' && !/gift boxes first/.test(g12.summary || '') && !g12.newBtn, g12);
    await p12.screenshot({ path: path.join(SHOTS, 'plan-regenerating-1440.png') });
    await p12.waitForTimeout(11000);
    const d12 = await p12.evaluate(() => { const pg = document.getElementById('page-marketing-plan'); return { summary: (pg.querySelector('.mpl-summary') || {}).textContent, meta: (pg.querySelector('.mpl-meta') || {}).textContent, asked: (pg.querySelector('.mpl-asked') || {}).innerText || '', banner: !!pg.querySelector('.mpl-regen-state') }; });
    check('11b.3 the new plan appears by itself: new summary, "Version 2", what was asked; the banner is gone', /gift boxes first/.test(d12.summary) && /Version 2/.test(d12.meta) && /We now sell gift boxes/.test(d12.asked) && !d12.banner, d12);
    await p12.screenshot({ path: path.join(SHOTS, 'plan-regenerated-1440.png') });
    await p12.click('.orv-sb .onv-item[data-onv="progress"]'); await p12.waitForTimeout(700);
    const pr12 = await p12.evaluate(() => { const pg = document.getElementById('page-progress'); return { now: (pg.querySelector('.prg-phase[data-state="now"] summary b') || {}).textContent, count: (pg.querySelector('.prg-count') || {}).textContent }; });
    check('11b.4 Progress follows the new plan: it starts today (Week 1 is now) with nothing ticked yet', pr12.now === 'Week 1' && /^0 of 12/.test(pr12.count), pr12);
    M.regenFail = true;
    await p12.click('.orv-sb .onv-item[data-onv="plan"]'); await p12.waitForTimeout(500);
    await p12.click('[data-mpl-update]'); await p12.waitForTimeout(150);
    await p12.fill('#mplRegenText', 'More video ads');
    await p12.click('.mpl-regen [type="submit"]'); await p12.waitForTimeout(11000);
    const f12 = await p12.evaluate(() => { const pg = document.getElementById('page-marketing-plan'); return { banner: (pg.querySelector('.mpl-regen-state[data-state="failed"]') || {}).innerText || '', summary: (pg.querySelector('.mpl-summary') || {}).textContent, prefill: (document.getElementById('mplRegenText') || {}).value }; });
    check('11b.5 a failed attempt says so (plan unchanged, credits returned), keeps the plan and the instructions for a retry', /couldn’t be written/.test(f12.banner) && /credits were returned/.test(f12.banner) && /gift boxes first/.test(f12.summary) && f12.prefill === 'More video ads', f12);
    M.regenFail = false; M.regen = null; M.version = 1;
    await p12.close();
    await c6.close();
    M.mode = 'existing';

    // ── 12. Addresses, Back/Forward, refresh, direct links ──────────
    console.log('\n12. Addresses and browser history');
    {
      const c7 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      let p7 = await c7.newPage(); await fence(p7); p7.on('pageerror', (e) => errors.push('hist: ' + e.message));
      await signIn(p7);
      const at = async () => p7.evaluate(() => ({ url: location.pathname + location.search, on: (document.querySelector('.orv-sb .onv-item.is-on, .orv-sb [data-onv-foot].is-on') || {}).dataset || {}, page: (document.querySelector('.page.active') || {}).id }));
      const start = await at();
      check('12.1 after sign-in the address names the start page (/app?view=dashboard)', start.url === '/app?view=dashboard' && start.on.onv === 'dashboard', start);
      for (const id of ['research', 'insights', 'auto-rules', 'content']) { await p7.click('.orv-sb .onv-item[data-onv="' + id + '"]'); await p7.waitForTimeout(id.startsWith('auto') ? 900 : 500); }
      const after = await at();
      check('12.2 each page opened gets its own address', after.url === '/app?view=content' && after.page === 'page-my-content', after);
      await p7.goBack(); await p7.waitForTimeout(900);
      const b1 = await at();
      check('12.3 Back returns to the previous page inside the app (Rules), highlighted', b1.url === '/app?view=auto-rules' && b1.on.onv === 'auto-rules' && b1.page === 'page-autopilot' && (await p7.evaluate(() => window.orvAutomations.tab())) === 'rules', b1);
      await p7.goBack(); await p7.waitForTimeout(700);
      const b2 = await at();
      check('12.4 Back again: Insights', b2.url === '/app?view=insights' && b2.page === 'page-insights' && b2.on.onv === 'insights', b2);
      await p7.goForward(); await p7.waitForTimeout(900);
      const f1 = await at();
      check('12.5 Forward: Rules again', f1.url === '/app?view=auto-rules' && f1.on.onv === 'auto-rules', f1);
      await p7.click('.orv-sb [data-onv-foot="platforms"]'); await p7.waitForTimeout(600);
      check('12.6 Ad Platforms has its own address too', (await at()).url === '/app?view=platforms');
      await p7.close();
      p7 = await c7.newPage(); await fence(p7); p7.on('pageerror', (e) => errors.push('hist2: ' + e.message));
      await signIn(p7, '/app?view=insights'); // refresh / a direct link before sign-in
      const d1 = await at();
      check('12.7 refresh or a direct link (/app?view=insights) opens that page after sign-in, not the Dashboard', d1.page === 'page-insights' && d1.on.onv === 'insights' && d1.url === '/app?view=insights', d1);
      await p7.close();
      p7 = await c7.newPage(); await fence(p7);
      await signIn(p7, '/app?view=bogus');
      check('12.8 an unknown view falls back to the normal start page', (await at()).page === 'page-business-brain');
      await p7.close();
      p7 = await c7.newPage(); await fence(p7);
      await signIn(p7, '/app?view=research&success=true&session_id=cs_test_abcdefghijkl');
      const d3 = await at();
      check('12.9 a Stripe return address is never hijacked by a view (payment handling keeps priority)', d3.page !== 'page-research', d3);
      await c7.close();
    }

    // ── 13. Sidebar follows Settings → Language ─────────────────────
    console.log('\n13. Sidebar language');
    {
      const c8 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p8 = await c8.newPage(); await fence(p8); p8.on('pageerror', (e) => errors.push('lang: ' + e.message));
      await signIn(p8);
      const labels = () => p8.evaluate(() => ({
        sec: Array.from(document.querySelectorAll('.orv-sb .onv-sec__t')).map((e) => e.textContent),
        ins: document.querySelector('.orv-sb .onv-item[data-onv="insights"] .onv-lbl').textContent,
        insTitle: document.querySelector('.orv-sb .onv-item[data-onv="insights"]').getAttribute('title'),
        plat: document.querySelector('.orv-sb [data-onv-foot="platforms"] .onv-lbl').textContent,
        gear: document.querySelector('.orv-sb [data-onv-foot="settings"]').getAttribute('aria-label'),
      }));
      await p8.evaluate(() => { CURRENT_LANG = 'nl'; applyLanguage(); }); await p8.waitForTimeout(150);
      const nl = await labels();
      check('13.1 Dutch: sections, links, tooltips and footer translated (product names kept)', JSON.stringify(nl.sec) === JSON.stringify(['Control Center', 'Onderzoek', 'Maken', 'Launch', 'Campagnes', 'Automatiseringen']) && nl.ins === 'Inzichten' && nl.insTitle === 'Inzichten' && nl.plat === 'Advertentieplatforms' && nl.gear === 'Instellingen', nl);
      await p8.click('.orv-sb .onv-item[data-onv="insights"]'); await p8.waitForTimeout(400);
      check('13.2 a translated link still opens its page', await p8.evaluate(() => document.querySelector('.page.active').id === 'page-insights'));
      await p8.evaluate(() => { CURRENT_LANG = 'en'; applyLanguage(); }); await p8.waitForTimeout(150);
      const en = await labels();
      check('13.3 back to English', en.sec[1] === 'Research' && en.ins === 'Insights' && en.plat === 'Ad Platforms' && en.gear === 'Settings', en);
      await c8.close();
    }

    check('Z. no JavaScript errors from the navigation', errors.filter((e) => /onv|appNav|orvAppNav|planPages|orvPlanPages|mpl|prg/.test(e)).length === 0, errors);
    console.log('\n(Other page errors seen, for information: ' + errors.length + ')');
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); server.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
