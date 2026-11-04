/* ════════════════════════════════════════════════════════════════
   Research workspace, Research → Insights, the missing-plan recovery on
   Marketing Plan and the local preview — in the real app.html.

   SAFETY: a network fence. The page may reach ONLY this test's own server:
   the app's dev API base (http://localhost:5500 — the real backend may be
   running there) is rewritten to an in-process mock, static CDN GETs are
   allowed, everything else is aborted. No real users, nothing written
   anywhere, no AI call.

   RUN: node tests/research-insights.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const PORT = 8962, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOTS = path.join(__dirname, '_shots', 'research-insights'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }

// ── Mock backend ──
const calls = [];
const M = { preview: false, reports: [], insights: null, query: 'ok', polls: 0, saved: [], recovery: null, planMode: 'recovery' };
const NOW = Date.now();
const REPORT = {
  reportVersion: 2, type: 'trends', question: 'Which trends matter for candles in Utrecht?', title: 'Candle trends in Utrecht', summary: 'Gift buying and natural materials shape demand.',
  keyConclusions: [{ text: 'Gift buying peaks before December', why: 'Plan ads early', basis: 'source_checked', sourceIds: ['ws1'], quotes: [{ sourceId: 'ws1', quote: 'gift purchases peak in late November' }] }],
  trends: [{ id: 't1', trend: 'Natural soy wax', why: 'Buyers ask for it', basis: 'source_cited', sourceIds: ['ws1'], quotes: [] }],
  implications: [{ id: 'm1', text: 'Mention soy wax in ads', basis: 'analysis', sourceIds: [], quotes: [] }],
  nextSteps: [{ id: 'n1', action: 'Start December gift ads in early November', why: 'Gift buying peaks', basis: 'analysis', sourceIds: [], quotes: [] }],
  sources: [{ id: 'ws1', title: 'Candle market 2026', url: 'https://candles.example/report', domain: 'candles.example', fetched: true, provenance: 'search', citedBy: ['keyConclusions'] }],
  retrieval: { searches: 3 }, confidence: 'moderate', limitations: ['No local sales data'], assumptions: [],
};
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json());
app.use('/api', (q, r, n) => { calls.push({ m: q.method, p: q.originalUrl.split('?')[0], body: q.body }); n(); });
app.get('/api/dev/local-preview', (q, r) => (M.preview ? r.json({ localPreview: true }) : r.status(404).json({})));
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, reason: 'existing_account', completed: true, stage: 'done', flow: { enabled: false } }));
app.get('/api/business/profile', (q, r) => r.json({ profile: { company_name: 'Bloom & Wick', industry: 'Candles', country: 'Netherlands', website: 'https://bloomandwick.example' } }));
app.get('/api/research/reports', (q, r) => r.json({ reports: M.reports }));
app.get('/api/research/reports/:id', (q, r) => {
  if (q.params.id === 'job1' && ++M.polls < 2) return r.json({ report: null, summary: { id: 'job1', status: 'running', stage: 'reading', progress: { searches: 3, results: 9 } } });
  M.reports.forEach((x) => { if (x.id === q.params.id) x.status = 'ready'; }); // the job finished
  r.json({ report: Object.assign({}, REPORT, { reportId: q.params.id, savedAt: new Date(NOW).toISOString() }), summary: { id: q.params.id, status: 'ready' } });
});
app.post('/api/research/query', (q, r) => {
  if (M.query === 'nocredits') return r.status(402).json({ error: 'Out of credits', code: 'CREDITS_EXHAUSTED' });
  if (M.query === 'noaccess') return r.status(403).json({ error: 'Choose a plan to use Research.', code: 'PLAN_REQUIRED' });
  M.polls = 0; M.reports = [{ id: 'job1', title: q.body.question, question: q.body.question, type: q.body.type, status: 'running', stage: 'preparing', createdAt: new Date().toISOString() }].concat(M.reports);
  r.status(202).json({ ok: true, reportId: 'job1', status: 'running', type: q.body.type, stage: 'preparing' });
});
app.get('/api/research/insights', (q, r) => r.json(Object.assign({ reports: M.reports, saved: M.saved, findings: [], opportunities: [], actions: [], recurringCompetitors: [] }, M.insights || {})));
app.put('/api/user/preferences', (q, r) => { if (Array.isArray(q.body.savedInsights)) M.saved = q.body.savedInsights; r.json({ preferences: { savedInsights: M.saved } }); });
app.get('/api/onboarding/plan', (q, r) => {
  if (M.planMode === 'generating') return r.json({ status: 'generating', locked: false, onboarding: true, period: 'monthly', horizon: { period: 'monthly', label: '1 month', days: 30 }, missing: [], plan: null });
  r.json({ status: 'none', locked: false, onboarding: false, recovery: true, plan: null });
});
app.get('/api/onboarding/progress', (q, r) => r.json({ locked: false, status: 'none', onboarding: false, phases: [], total: 0, completed: 0 }));
app.get('/api/onboarding/recovery', (q, r) => r.json(M.recovery));
app.post('/api/onboarding/recovery', (q, r) => {
  const b = q.body || {};
  if (!b.answers || !b.answers.budget || !b.answers.budget.time) return r.status(400).json({ error: 'A few answers are still missing.', code: 'ANSWERS_INCOMPLETE', missing: ['budget.time'] });
  M.planMode = 'generating';
  r.status(202).json({ status: 'generating', locked: false, onboarding: true, period: 'monthly', horizon: { period: 'monthly', label: '1 month', days: 30 }, missing: [], plan: null });
});
app.all(/^\/api\//, (q, r) => r.json({}));
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
async function signIn(page, plan) {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }); });
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.orvAppNav && !!window.orvInsights, null, { timeout: 15000 });
  await page.evaluate((p) => {
    window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token';
    if (window.orvTour) window.orvTour.open = function () {};
    window._dbSubscriptionStatus = p;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-rx', email: 'existing@example.invalid' });
    window._dbSubscriptionStatus = p;
  }, plan || 'paid');
  await page.waitForTimeout(2200);
  await page.evaluate((p) => { window._dbSubscriptionStatus = p; }, plan || 'paid');
  await page.waitForTimeout(600);
}
const nav = (page, id) => page.click('.orv-sb .onv-item[data-onv="' + id + '"]');
const onItem = (page) => page.evaluate(() => (document.querySelector('.orv-sb .onv-item.is-on') || {}).dataset ? document.querySelector('.orv-sb .onv-item.is-on').dataset.onv : null);

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    // ── 1. Local preview ───────────────────────────────────────────
    console.log('\n1. Local preview');
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      let page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
      await signIn(page, 'free');
      await nav(page, 'research'); await page.waitForTimeout(500);
      const off = await page.evaluate(() => ({ gate: !!document.querySelector('#page-research > .orv-gate'), pill: !!document.getElementById('orvPreviewPill'), flag: !!window.ORV_LOCAL_PREVIEW }));
      check('1.1 without the local server’s preview answer: a free account still sees the "choose a plan" gate on Research (unchanged)', off.gate && !off.pill && !off.flag, off);
      await page.close();
      M.preview = true;
      page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
      await signIn(page, 'free');
      const res = [];
      for (const id of ['dashboard', 'plan', 'progress', 'research', 'insights', 'create', 'adstudio', 'overview', 'builder', 'auto-overview', 'auto-rules']) {
        await nav(page, id); await page.waitForTimeout(id.startsWith('auto') ? 800 : 450);
        res.push(await page.evaluate((id) => { const a = document.querySelector('.page.active'); return { id, page: a && a.id, gated: !!(a && a.querySelector(':scope > .orv-gate')), text: a ? a.innerText.length : 0, on: (document.querySelector('.orv-sb .onv-item.is-on') || {}).dataset }; }, id));
      }
      check('1.2 local preview: every section opens with its real page (no plan gate) — Control Center, Research, Insights, Create, Launch, Campaigns, Automations', res.every((x) => !x.gated && x.text > 40 && x.on && x.on.onv === x.id), res.filter((x) => x.gated || x.text <= 40));
      check('1.3 no visible "Local preview" label anywhere (the preview itself is on)', await page.evaluate(() => window.ORV_LOCAL_PREVIEW === true && !document.getElementById('orvPreviewPill') && !document.querySelector('.orv-preview-pill') && !/Local preview/i.test(document.body.innerText)));
      await page.screenshot({ path: path.join(SHOTS, 'preview-automations.png') });
      await nav(page, 'research'); await page.waitForTimeout(500);
      M.query = 'noaccess';
      await page.fill('#researchQueryInput', 'Which trends matter for candles in Utrecht?');
      await page.click('#researchSubmitBtn'); await page.waitForTimeout(500);
      const msg = await page.textContent('#rxFormErr');
      check('1.4 a paid action refused by the server (no access) says what’s actually missing in the local preview — not a subscription upsell', /Local preview/.test(msg) && /Stripe/.test(msg) && /no credits were used/.test(msg), msg);
      check('1.5 …and the server was asked (its access check decides; nothing bypassed in the browser)', calls.some((c) => c.m === 'POST' && c.p === '/api/research/query'));
      M.query = 'ok'; M.preview = false;
      await ctx.close();
    }

    // ── 2. Research workspace ──────────────────────────────────────
    console.log('\n2. Research');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page, 'paid');
    await nav(page, 'research'); await page.waitForTimeout(700);
    const home = await page.evaluate(() => ({
      dirs: Array.from(document.querySelectorAll('#rsRoot .rx-dir')).map((d) => d.dataset.dir), icons: document.querySelectorAll('#rsRoot .rx-dir .rx-dir-ic svg').length,
      steps: Array.from(document.querySelectorAll('#rsRoot .rx-stepl .rx-lbl')).map((l) => l.textContent), legend: document.querySelectorAll('#rsRoot .rx-legend > div').length,
      recentEmpty: /collected in Insights/.test((document.querySelector('#rsRoot .rx-recent') || {}).textContent || ''), ctx: /Bloom & Wick/.test(document.getElementById('rsRoot').textContent),
      lib: !!document.querySelector('#rsRoot .rx-lib-list'), h1: (document.querySelector('#rsRoot h1') || {}).textContent,
    }));
    check('2.1 one workspace: seven research directions with their own icons (market, competitor, audience, product & niche, advertising, trends, opportunity)', JSON.stringify(home.dirs) === '["market","competitor","audience","product","advertising","trends","opportunity"]' && home.icons === 7, home.dirs);
    check('2.2 the workflow in three steps: direction → question → context; the business profile is used as context', JSON.stringify(home.steps) === '["Choose a direction","Ask your question","Add context"]' && home.ctx, home.steps);
    check('2.3 the evidence labels are explained (source-checked, cited, analysis, idea); no full library on Research (that’s Insights)', home.legend === 4 && !home.lib && home.recentEmpty);
    await page.screenshot({ path: path.join(SHOTS, 'research-home-1440.png') });
    await page.click('#rsRoot .rx-dir[data-dir="trends"]'); await page.waitForTimeout(200);
    const st = await page.evaluate(() => Array.from(document.querySelectorAll('#rsRoot .rx-starter')).map((b) => b.textContent));
    check('2.4 choosing a direction shows suggested questions filled with the business (industry, country)', st.length === 3 && st.every((q) => /candles/.test(q)) && st.some((q) => /Netherlands/.test(q)), st);
    await page.click('#rsRoot .rx-starter[data-i="0"]'); await page.waitForTimeout(150);
    const qv = await page.inputValue('#researchQueryInput');
    check('2.5 a suggestion fills the question (editable)', qv === st[0]);
    const q0 = calls.length;
    await page.click('#researchSubmitBtn'); await page.waitForTimeout(400);
    const post = calls.slice(q0).find((c) => c.m === 'POST' && c.p === '/api/research/query');
    check('2.6 "Start Research" uses the existing research endpoint once, with the chosen direction and the question', !!post && post.body.type === 'trends' && post.body.question === qv && calls.slice(q0).filter((c) => c.p === '/api/research/query').length === 1, post && post.body);
    const prog = await page.evaluate(() => document.getElementById('rsRoot').getAttribute('data-view'));
    check('2.7 the real progress of the job is shown while it runs', prog === 'progress');
    await page.waitForFunction(() => document.getElementById('rsRoot').getAttribute('data-view') === 'report', null, { timeout: 10000 });
    const rep = await page.evaluate(() => {
      const root = document.getElementById('rsRoot');
      return { h2: Array.from(root.querySelectorAll('.rx-sec h2')).map((h) => h.textContent), checked: !!root.querySelector('.rx-ev-source_checked'), link: (root.querySelector('.rx-ev-src a') || {}).href, srcList: /candles\.example/.test((document.getElementById('rxs-sources') || {}).textContent || ''), text: root.innerText };
    });
    check('2.8 the result is structured: summary, trends, demand, implications, recommended next actions, sources & limitations', ['Executive summary', 'Trends', 'What it means for you', 'Recommended next actions', 'Sources & limitations'].every((h) => rep.h2.includes(h)), rep.h2);
    check('2.9 sources are shown as the report’s real links; sourced findings are labelled apart from analysis and recommendations', rep.checked && rep.link === 'https://candles.example/report' && rep.srcList && /Recommendations from OrivenAI, based on the findings above — not facts\./.test(rep.text) && /Start December gift ads/.test(rep.text));
    await page.screenshot({ path: path.join(SHOTS, 'research-report-1440.png'), fullPage: false });
    await page.click('#rsRoot [data-rx="home"]'); await page.waitForTimeout(400);
    M.query = 'nocredits';
    await page.fill('#researchQueryInput', 'Who buys handmade candles in Utrecht?');
    await page.click('#researchSubmitBtn'); await page.waitForTimeout(400);
    check('2.10 out of credits (402 from the server): the existing credit message and plan picker, nothing started', /credits/.test(await page.textContent('#rxFormErr')) && (await page.evaluate(() => document.getElementById('rsRoot').getAttribute('data-view'))) === 'home');
    M.query = 'ok';
    check('2.11 the browser never decides about credits: no credit or charge request besides the research start', !calls.some((c) => c.m !== 'GET' && /credit|charge|checkout/.test(c.p)));

    // ── 3. Insights ────────────────────────────────────────────────
    console.log('\n3. Insights');
    // The existing out-of-credits flow opens the plan picker; close it.
    const back = await page.$('text=Back to my work'); if (back) await back.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    M.reports = [];
    await nav(page, 'insights'); await page.waitForTimeout(600);
    const em = await page.evaluate(() => { const r = document.getElementById('insRoot'); return { state: (r.querySelector('.ins-empty') || {}).dataset, text: r.innerText, page: document.querySelector('.page.active').id }; });
    check('3.1 no research yet: an empty state that explains how Insights fills up; no numbers or invented findings', em.page === 'page-insights' && em.state && em.state.state === 'empty' && /fills up from the research you complete/.test(em.text) && !/\d/.test(em.text.replace(/Insights/g, '')), em.text.slice(0, 200));
    await page.screenshot({ path: path.join(SHOTS, 'insights-empty-1440.png') });
    const day = (d) => new Date(NOW - d * 864e5).toISOString();
    M.reports = [
      { id: 'rA', title: 'Candle trends in Utrecht', question: 'Which trends matter?', type: 'trends', status: 'ready', createdAt: day(1), sourceCount: 4 },
      { id: 'rB', title: 'Competitor scan', question: 'Who competes?', type: 'competitor', status: 'ready', createdAt: day(40), sourceCount: 5 },
      { id: 'rC', title: 'Audience check', question: 'Who buys?', type: 'audience', status: 'failed', createdAt: day(2), error: 'The research timed out. You were not charged.' },
    ];
    M.insights = {
      findings: [{ id: 'rA:k1', text: 'Gift buying peaks before December', why: 'Plan ads early', basis: 'source_checked', sources: [{ title: 'Candle market 2026', url: 'https://candles.example/report', domain: 'candles.example' }], reportId: 'rA', reportTitle: 'Candle trends in Utrecht', type: 'trends', createdAt: day(1) },
        { id: 'rB:k1', text: 'Competitors rarely show prices', why: null, basis: 'analysis', sources: [], reportId: 'rB', reportTitle: 'Competitor scan', type: 'competitor', createdAt: day(40) }],
      opportunities: [{ id: 'rA:o1', title: 'Workshop gifts', why: 'Gift buyers want experiences', angle: 'Give an evening, not a candle', test: 'Workshop vs candle gift ad', basis: 'idea', supportBasis: 'source_cited', sources: [{ url: 'https://candles.example/report', domain: 'candles.example' }], reportId: 'rA', reportTitle: 'Candle trends in Utrecht', type: 'trends', createdAt: day(1) }],
      actions: [{ id: 'rA:n1', action: 'Start December gift ads in early November', why: 'Gift buying peaks', basis: 'analysis', reportId: 'rA', reportTitle: 'Candle trends in Utrecht', type: 'trends', createdAt: day(1) }],
      recurringCompetitors: [{ name: 'Lumière Candles', website: 'https://lumiere.example', reports: [{ reportId: 'rA', reportTitle: 'Candle trends in Utrecht' }, { reportId: 'rB', reportTitle: 'Competitor scan' }] }],
    };
    await page.evaluate(() => window.orvInsights.reload()); await page.waitForTimeout(600);
    const ov = await page.evaluate(() => { const r = document.getElementById('insRoot'); return { secs: Array.from(r.querySelectorAll('.ins-sec h2')).map((h) => h.textContent), cards: r.querySelectorAll('.ins-card').length, facts: (r.querySelector('.ins-facts') || {}).textContent, ev: Array.from(r.querySelectorAll('.ins-card .rx-ev')).map((e) => e.textContent), src: (r.querySelector('.ins-src a') || {}).href, from: (r.querySelector('.ins-from') || {}).textContent }; });
    check('3.2 saved research appears: key findings, opportunities, next actions and competitors named in more than one report', JSON.stringify(ov.secs) === '["Key findings","Opportunities","Recommended next actions","Named in more than one report"]' && ov.cards === 3, ov.secs);
    check('3.3 only real counts (2 reports, 2 findings, 1 opportunity), evidence labels kept, real source links, each linked to its report', /2 reports · 2 key findings · 1 opportunity/.test(ov.facts) && ov.ev.includes('Source-checked') && ov.ev.includes('Analysis') && ov.ev.includes('Idea to test') && ov.src === 'https://candles.example/report' && /Candle trends in Utrecht/.test(ov.from), ov);
    await page.screenshot({ path: path.join(SHOTS, 'insights-overview-1440.png') });
    await page.fill('#insSearch', 'prices'); await page.waitForTimeout(150);
    const se = await page.evaluate(() => Array.from(document.querySelectorAll('#insRoot .ins-card .ins-card__t')).map((x) => x.textContent));
    check('3.4 search filters the insights', JSON.stringify(se) === '["Competitors rarely show prices"]', se);
    await page.fill('#insSearch', ''); await page.click('#insRoot [data-ins="type"][data-type="trends"]'); await page.waitForTimeout(150);
    const ty = await page.evaluate(() => Array.from(document.querySelectorAll('#insRoot .ins-card .ins-card__t')).map((x) => x.textContent));
    check('3.5 filtering by research direction works', ty.length === 2 && ty.every((t) => !/prices/.test(t)), ty);
    await page.click('#insRoot [data-ins="type"][data-type="all"]');
    await page.click('#insRoot [data-ins="tab"][data-tab="library"]'); await page.waitForTimeout(200);
    const lib = await page.evaluate(() => ({ months: Array.from(document.querySelectorAll('#insRoot .ins-month h2')).map((h) => h.textContent), rows: Array.from(document.querySelectorAll('#insRoot .ins-lib__b b')).map((b) => b.textContent), failed: /timed out/.test(document.getElementById('insRoot').textContent) }));
    // The months the fixture dates fall in (1, 2 and 40 days ago), newest first, in the app language (English).
    const wantMonths = [...new Set([1, 2, 40].map((d) => new Date(day(d)).toLocaleDateString('en', { month: 'long', year: 'numeric' })))];
    check('3.6 Library: every saved report, organised by month (newest first, app language), with failed research shown honestly', lib.rows.length === 3 && JSON.stringify(lib.months) === JSON.stringify(wantMonths) && lib.failed, { lib, wantMonths });
    await page.click('#insRoot .ins-lib__i[data-id="rA"]'); await page.waitForTimeout(800);
    const op = await page.evaluate(() => ({ view: document.getElementById('rsRoot').getAttribute('data-view'), page: document.querySelector('.page.active').id, back: (document.querySelector('#rsRoot .rx-back') || {}).textContent }));
    check('3.7 a report opens in full, Insights stays highlighted, and "back" returns to Insights', op.view === 'report' && op.page === 'page-research' && (await onItem(page)) === 'insights' && /Insights/.test(op.back), op);
    await page.click('#rsRoot .rx-back'); await page.waitForTimeout(600);
    check('3.8 …back on Insights', (await page.evaluate(() => document.querySelector('.page.active').id)) === 'page-insights' && (await onItem(page)) === 'insights');
    await page.click('#insRoot [data-ins="tab"][data-tab="overview"]'); await page.waitForTimeout(150);
    await page.click('#insRoot .ins-card[data-kind="opportunity"] .ins-from'); await page.waitForTimeout(800);
    check('3.9 an insight links back to its source report', (await page.evaluate(() => document.getElementById('rsRoot').getAttribute('data-view'))) === 'report');
    await nav(page, 'insights'); await page.waitForTimeout(500);
    await page.click('#insRoot .ins-card[data-kind="opportunity"] [data-ins="save"]'); await page.waitForTimeout(400);
    check('3.10 saving an opportunity stores it on the account (preferences) and it appears under Saved', JSON.stringify(M.saved) === '["rA:o1"]' && /Saved/.test(await page.textContent('#insRoot .ins-card[data-kind="opportunity"] [data-ins="save"]')));
    await page.click('#insRoot [data-ins="tab"][data-tab="saved"]'); await page.waitForTimeout(150);
    check('3.11 …Saved lists it', (await page.$$eval('#insRoot .ins-card', (c) => c.length)) === 1);
    await page.click('#insRoot [data-ins="tab"][data-tab="overview"]'); await page.waitForTimeout(150);
    await page.click('#insRoot .ins-action [data-ins="create"]'); await page.waitForTimeout(600);
    const hand = await page.evaluate(() => ({ page: document.querySelector('.page.active').id, h: window.orvWorkspace.research.handoff() }));
    check('3.12 "Create ads from this" takes the insight into Create as research context (with its report)', hand.page === 'page-create' && hand.h && hand.h.findings[0].text === 'Start December gift ads in early November' && hand.h.reportId === 'rA' && hand.h.researchType === 'trends', hand.h);
    check('3.13 Insights made no AI call and no charge (reads, plus the saved list)', !calls.some((c) => c.m !== 'GET' && !/^\/api\/(research\/query|user\/preferences|profile\/timezone|events|t)$/.test(c.p)), calls.filter((c) => c.m !== 'GET').map((c) => c.p));
    await page.close();

    // ── 4. Missing marketing plan (recovery) ──────────────────────
    console.log('\n4. Missing marketing plan');
    M.recovery = { available: true, reason: 'ok', period: 'monthly', horizon: { period: 'monthly', label: '1 month', days: 30 }, assistant: null, businessName: 'Bloom & Wick',
      assistants: [{ id: 'nova', name: 'Nova', role: 'Creative & Content' }, { id: 'vector', name: 'Vector', role: 'Strategy & Direction' }],
      known: [{ path: 'business.name', label: 'Business name', type: 'text', max: 120, value: 'Bloom & Wick', display: 'Bloom & Wick', source: 'business_profile' }],
      missing: [{ path: 'budget.time', label: 'Time for marketing each week', type: 'choice', options: [['lt2', 'Less than 2 hours a week'], ['2_5', '2–5 hours a week']] }, { path: 'goals.success', label: 'What success looks like in three months', type: 'text', max: 300 }] };
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page, 'paid');
    await nav(page, 'plan'); await page.waitForTimeout(600);
    const offer = await page.textContent('#page-marketing-plan');
    check('4.1 a paying account without a plan is offered to create it — no new purchase, no credits', /Create your marketing plan/.test(offer) && /No extra charge, no credits/.test(offer) && !!(await page.$('[data-mpl-recover]')));
    await page.click('[data-mpl-recover]'); await page.waitForTimeout(500);
    const form = await page.evaluate(() => { const f = document.querySelector('.mpl-rec'); return { asked: Array.from(f.querySelectorAll('.mpl-rec__sec:first-of-type .mpl-f > label, .mpl-rec__sec:first-of-type .mpl-f > legend')).map((l) => l.textContent), known: Array.from(f.querySelectorAll('.mpl-known__v')).map((v) => v.textContent), src: (f.querySelector('.mpl-known__s') || {}).textContent, period: f.querySelector('.mpl-meta').textContent, asst: f.querySelectorAll('input[name="mplAssistant"]').length }; });
    check('4.2 the form asks only what’s missing, shows what OrivenAI knows (with where it came from), the period and the assistant choice', JSON.stringify(form.asked) === '["Time for marketing each week","What success looks like in three months"]' && form.known[0] === 'Bloom & Wick' && /business profile/.test(form.src) && /next 1 month/.test(form.period) && form.asst === 2, form);
    await page.screenshot({ path: path.join(SHOTS, 'recovery-form-1440.png') });
    await page.fill('.mpl-f[data-path="goals.success"] input', '50 orders a month');
    await page.click('.mpl-chip--a input[value="nova"]', { force: true });
    await page.click('.mpl-rec [type="submit"]'); await page.waitForTimeout(400);
    const inv = await page.evaluate(() => ({ bad: Array.from(document.querySelectorAll('.mpl-f[aria-invalid="true"]')).map((f) => f.dataset.path), err: document.querySelector('.mpl-formerr').textContent }));
    check('4.3 a missing answer is marked and explained; nothing started', JSON.stringify(inv.bad) === '["budget.time"]' && /still missing/.test(inv.err) && M.planMode === 'recovery', inv);
    await page.click('.mpl-f[data-path="budget.time"] input[value="2_5"]', { force: true });
    await page.click('[data-mpl-edit="business.name"]');
    await page.fill('.mpl-known__edit input', 'Bloom & Wick Studio');
    await page.click('.mpl-rec [type="submit"]'); await page.waitForTimeout(500);
    const sent = calls.filter((c) => c.m === 'POST' && c.p === '/api/onboarding/recovery').pop();
    check('4.4 confirming sends the new answers and the correction (and the chosen assistant), then the plan is being written', sent && sent.body.answers.budget.time === '2_5' && sent.body.answers.goals.success === '50 orders a month' && sent.body.answers.business.name === 'Bloom & Wick Studio' && sent.body.assistant === 'nova' && /Preparing your marketing plan/.test(await page.textContent('#page-marketing-plan')), sent && sent.body);
    M.recovery = Object.assign({}, M.recovery, { available: false, reason: 'period_unknown', period: null, horizon: null }); M.planMode = 'recovery';
    await page.evaluate(() => window.orvPlanPages.reload()); await page.waitForTimeout(500);
    await page.click('[data-mpl-recover]'); await page.waitForTimeout(500);
    const pu = await page.textContent('#page-marketing-plan');
    check('4.5 purchased period unknown: explained with the support contact; no form, no plan length invented', /check the length of your plan/.test(pu) && /contact@orivenai\.com/.test(pu) && !(await page.$('.mpl-rec')));
    await nav(page, 'progress'); await page.waitForTimeout(500);
    check('4.6 Progress points a paying account without a plan to Marketing Plan', /this account doesn’t have one yet/.test(await page.textContent('#page-progress')) && !!(await page.$('#page-progress [data-mpl-go="plan"]')));
    await page.close();

    // ── 5. Widths ──────────────────────────────────────────────────
    console.log('\n5. Widths');
    for (const [w, h] of [[1024, 768], [390, 844]]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: h } });
      const p2 = await c2.newPage(); await fence(p2);
      await signIn(p2, 'paid');
      await p2.evaluate(() => window.orvAppNav.go('research')); await p2.waitForTimeout(600);
      const a = await p2.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, dirs: document.querySelectorAll('#rsRoot .rx-dir').length }));
      await p2.screenshot({ path: path.join(SHOTS, 'research-' + w + '.png') });
      await p2.evaluate(() => window.orvInsights.open()); await p2.waitForTimeout(600);
      const b = await p2.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, cards: document.querySelectorAll('#insRoot .ins-card').length }));
      await p2.screenshot({ path: path.join(SHOTS, 'insights-' + w + '.png') });
      check(`5.${w} Research and Insights fit the screen (no horizontal overflow)`, a.ov <= 1 && b.ov <= 1 && a.dirs === 7 && b.cards === 3, { a, b });
      await c2.close();
    }
    await ctx.close();
    check('Z. no JavaScript errors from Research, Insights or the plan pages', errors.filter((e) => /research|insights|rx-|ins-|planPages|mpl|localPreview/i.test(e)).length === 0, errors);
    console.log('\n(Blocked outside requests, aborted by the fence: ' + blocked.length + ')');
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); server.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
