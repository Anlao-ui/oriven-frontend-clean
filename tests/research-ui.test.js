/* ════════════════════════════════════════════════════════════════
   Research 2.0 — Home, progress, report, library and Research → Create,
   end to end in a real browser.

   No backend, no Supabase, no AI, no credits: a local static server
   serves this repo, Supabase is blocked and /api/research/* is answered by
   a stateful in-test mock shaped like server.js (202 + reportId, a job
   that advances through real stages on each poll, the library, rename,
   delete). Report fixtures use the exact v2 schema services/researchReport.js
   produces (and one version-1 report, as saved before Research 2.0).

   RUN: node tests/research-ui.test.js
   ════════════════════════════════════════════════════════════════ */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8919, BASE = 'http://127.0.0.1:' + PORT;
const SHOT_DIR = path.join(__dirname, '_shots', 'research2');
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

// ── Fixtures (v2 schema) ─────────────────────────────────────────────
const SRC = [
  { id: 'ws1', title: 'Linnen Huis — Linnen overhemden', url: 'https://www.linnenhuis.nl', domain: 'linnenhuis.nl', publishedDate: '2026-09-01', provenance: 'search', fetched: true, fetchError: null, citedBy: ['competitors', 'keyConclusions'] },
  { id: 'ws2', title: 'Vlas & Co — Duurzaam linnen', url: 'https://vlasco.nl', domain: 'vlasco.nl', publishedDate: null, provenance: 'search', fetched: true, fetchError: null, citedBy: ['competitors'] },
  { id: 'ws3', title: 'Linen shirt reviews', url: 'https://reviews.example.org/linen', domain: 'reviews.example.org', publishedDate: null, provenance: 'search', fetched: false, fetchError: 'The page took too long to load.', citedBy: ['signals'] },
  { id: 'w1', title: 'Linnen & Co', url: 'https://linnenco.nl', domain: 'linnenco.nl', provenance: 'own_website', fetched: true, citedBy: [] },
];
const chk = (id, quote) => ({ basis: 'source_checked', sourceIds: [id], quotes: [{ sourceId: id, quote }] });
const cited = (id) => ({ basis: 'source_cited', sourceIds: [id], quotes: [] });
const base = (type, extra) => Object.assign({ reportVersion: 2, type, title: 'Linen shirt competitors in the Netherlands', question: 'Who are my main competitors and how do they advertise?',
  summary: 'Dutch linen brands compete on European flax and returns; wrinkling is the main complaint and nobody addresses it.',
  keyConclusions: [Object.assign({ text: 'Free returns are standard among competitors', why: 'Returns alone will not differentiate' }, chk('ws1', 'Every order comes with free returns within 30 days')),
    Object.assign({ text: 'Wrinkling is the most common complaint', why: 'An angle no competitor uses' }, cited('ws3')),
    { text: 'Sustainability is a shared claim', why: 'Hard to own alone', basis: 'analysis', sourceIds: [], quotes: [] }],
  limitations: ['No public ad examples could be retrieved'], assumptions: [], confidence: 'moderate', partial: false,
  counts: { source_checked: 3, source_cited: 2, analysis: 2, idea: 4 }, market_country: 'Netherlands', sources: SRC,
  referenceTools: [{ id: 'ref-meta', title: 'Meta Ad Library', url: 'https://www.facebook.com/ads/library/' }], ownWebsite: { url: 'https://linnenco.nl', ok: true }, urlSourceErrors: [],
  retrieval: { searches: 3, searchesOk: 3, results: 4, attempted: 4, read: 3 }, createdAt: iso(-3600e3), completedAt: iso(-3500e3) }, extra);
const COMP = [
  Object.assign({ id: 'c1', name: 'Linnen Huis', website: 'https://linnenhuis.nl', offering: 'Classic linen shirts', positioning: 'Classic basics with free returns', valueProposition: 'Easy returns', pricing: 'From 59 euro', messaging: 'Comfort and ease', adPatterns: ['Seasonal sale'], differentiation: 'Address wrinkling' }, chk('ws1', 'shirts start at 59 euro')),
  Object.assign({ id: 'c2', name: 'Vlas & Co', website: null, offering: null, positioning: 'Sustainable Dutch flax', valueProposition: null, pricing: 'premium', messaging: null, adPatterns: [], differentiation: null }, cited('ws2')),
  { id: 'c3', name: 'Generic Brand', positioning: 'Low-cost linen', adPatterns: [], basis: 'analysis', sourceIds: [], quotes: [] },
];
const OPPS = [{ id: 'o1', title: 'Own the wrinkle conversation', why: 'Main complaint, unaddressed', audience: 'Office workers', angle: 'Lived-in look', test: 'Wrinkle angle vs comfort angle', limitation: 'Based on one review site', relatedCompetitorIds: ['c1'], relatedSignalIds: ['s1'], basis: 'idea', supportBasis: 'source_cited', sourceIds: ['ws3'], quotes: [] }];
const SIG = [Object.assign({ id: 's1', type: 'painPoint', text: 'Linen wrinkles quickly', language: 'creased after an hour' }, cited('ws3')), Object.assign({ id: 's2', type: 'need', text: 'Stay cool in summer' }, chk('ws1', 'We use European flax only')), { id: 's3', type: 'objection', text: 'Too expensive for daily wear', basis: 'analysis', sourceIds: [], quotes: [] }];
const ANG = [{ id: 'g1', angle: 'Lived-in look', message: 'Linen that looks better worn', why: 'Turns the complaint into style', relatedSignalIds: ['s1'], basis: 'idea', sourceIds: [], quotes: [] }, { id: 'g2', angle: 'Cool all day', message: 'Stay fresh at 30°C', basis: 'idea', sourceIds: [], quotes: [] }];
const REPORTS = {
  competitor: base('competitor', { competitors: COMP, adPatterns: [{ id: 'p1', pattern: 'Seasonal sale', description: 'Spring sale banners', basis: 'analysis', sourceIds: [], quotes: [] }], opportunities: OPPS, angles: ANG }),
  market: base('market', { title: 'The Dutch linen shirt market', marketOverview: { name: 'Linen shirts — Netherlands', description: 'A seasonal, sustainability-led category', characteristics: [Object.assign({ text: 'Sustainability claims are common' }, cited('ws2'))] }, trends: [Object.assign({ id: 't1', trend: 'Sustainable fabrics', why: 'Buyers ask about origin' }, cited('ws2'))], challenges: [{ id: 'h1', text: 'Seasonal demand', basis: 'analysis', sourceIds: [], quotes: [] }], competitors: COMP, signals: SIG, opportunities: OPPS, implications: [{ id: 'm1', text: 'Lead with comfort in summer campaigns', basis: 'analysis', sourceIds: [], quotes: [] }] }),
  audience: base('audience', { title: 'Who buys linen shirts', signals: SIG, segments: [{ id: 'a1', name: 'Urban professionals 25–45', description: 'Office-ready summer shirts', needs: 'Look neat all day', why: 'Feel the wrinkle pain most', relatedSignalIds: ['s1'], basis: 'idea', sourceIds: [], quotes: [] }], angles: ANG }),
  opportunity: base('opportunity', { title: 'Opportunities in linen shirts', opportunities: OPPS, signals: SIG, competitors: COMP, angles: ANG, tests: [{ id: 'x1', hypothesis: 'Wrinkle honesty beats comfort', variantA: 'Wrinkle angle', variantB: 'Comfort angle', measure: 'Cost per click', basis: 'idea', sourceIds: [], quotes: [] }], risks: [{ id: 'r1', risk: 'Greenwashing', mitigation: 'Only certified claims', basis: 'idea', sourceIds: [], quotes: [] }] }),
};
const LEGACY = { question: 'Old question about linen', summary: 'Old summary', market: { name: 'Linen', characteristics: ['Seasonal'], sourceIds: ['ws1'], basis: 'verified' }, competitors: [{ id: 'c1', name: 'Old Brand', positioning: 'Old positioning', basis: 'verified', sourceIds: ['ws1'] }], customerSignals: [], advertisingPatterns: [], trends: [], audiences: [{ id: 'a1', segment: 'Old segment', why: 'x', basis: 'recommendation' }], angles: [], creativeConcepts: [], opportunities: [{ id: 'o1', opportunity: 'Old opportunity', evidence: 'x', basis: 'recommendation' }], risks: [], nextSteps: ['Old next step'], dataGaps: ['Old gap'], webSources: [{ id: 'ws1', title: 'Old source', url: 'https://old.example', domain: 'old.example' }], urlSources: [], sources: [] };

function freshState() {
  const rows = [
    { id: 'aaaaaaaa-0000-0000-0000-000000000001', title: 'Linen shirt competitors in the Netherlands', type: 'competitor', status: 'ready', createdAt: iso(-3600e3), sourceCount: 3, reportVersion: 2, content: REPORTS.competitor },
    { id: 'aaaaaaaa-0000-0000-0000-000000000002', title: 'Old question about linen', type: null, status: 'ready', createdAt: '2026-05-01T10:00:00.000Z', sourceCount: 1, reportVersion: 1, content: LEGACY },
    { id: 'aaaaaaaa-0000-0000-0000-000000000003', title: 'A failed one', type: 'market', status: 'failed', createdAt: iso(-7200e3), sourceCount: 0, reportVersion: 2, error: 'Research came back incomplete. Your credits were returned — please try again.' },
  ];
  return { rows, calls: [], jobs: {}, startStatus: null, biz: { company_name: 'Linnen & Co', industry: 'Apparel', country: 'Netherlands', website: 'linnenco.nl' }, legacyCalls: [], chatCalls: 0, createBody: null };
}
const STAGES = ['preparing', 'searching', 'reading', 'analysing', 'saving'];
async function arm(page, S) {
  await page.route('**/*supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }));
  await page.route('**/api/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    const json = (status, obj) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (p.startsWith('/api/research')) S.calls.push({ m, p, body, headers: req.headers() });
    if (p === '/api/ai/chat') S.chatCalls++;
    if (p === '/api/business/profile') return json(200, { profile: S.biz });
    if (p === '/api/credits/status') return json(200, { balance: 1000, plan: 'starter', featureCosts: { ai_analysis: 25 } });
    if (p === '/api/research/query' && m === 'POST') {
      if (S.startStatus) return json(S.startStatus.status, S.startStatus.body);
      const id = 'bbbbbbbb-0000-0000-0000-' + String(Object.keys(S.jobs).length + 1).padStart(12, '0');
      const t = body.type || 'market';
      S.jobs[id] = { polls: 0, failAt: S.failNext ? 2 : null };
      S.failNext = false;
      S.rows.unshift({ id, title: body.question.slice(0, 110), type: t, status: 'running', createdAt: new Date().toISOString(), sourceCount: 0, reportVersion: 2, content: Object.assign({}, REPORTS[t], { question: body.question }) });
      return json(202, { ok: true, reportId: id, status: 'running', type: t, stage: 'preparing' });
    }
    if (p === '/api/research/reports' && m === 'GET') return json(200, { reports: S.rows.map((x) => ({ id: x.id, title: x.title, question: x.content ? x.content.question : x.title, type: x.type, status: x.status, stage: x.status === 'running' ? STAGES[Math.min(4, (S.jobs[x.id] || { polls: 0 }).polls)] : null, createdAt: x.createdAt, sourceCount: x.sourceCount, reportVersion: x.reportVersion, error: x.error || null, progress: x.status === 'running' ? { searches: 3, results: 4, reading: 4, read: 3, startedAt: x.createdAt } : null })) });
    const mm = /^\/api\/research\/reports\/([^/]+)$/.exec(p);
    if (mm) {
      const row = S.rows.find((x) => x.id === mm[1]);
      if (!row) return json(404, { error: 'Research not found', code: 'NOT_FOUND' });
      if (m === 'PATCH') { if (!body.title || !body.title.trim()) return json(400, { error: 'Give the research a name.' }); row.title = body.title.trim(); return json(200, { ok: true, id: row.id, title: row.title }); }
      if (m === 'DELETE') { if (row.status === 'running') return json(409, { error: 'still running', code: 'RESEARCH_RUNNING' }); S.rows = S.rows.filter((x) => x !== row); return json(200, { ok: true }); }
      const job = S.jobs[row.id];
      if (row.status === 'running' && job) {
        job.polls++;
        if (job.failAt && job.polls >= job.failAt) { row.status = 'failed'; row.error = 'Research is temporarily unavailable. Your credits were returned — please try again in a few minutes.'; }
        else if (job.polls >= 5 && !S.holdJobs) { row.status = 'ready'; row.sourceCount = 3; row.title = row.content.title; }
      }
      const summary = { id: row.id, title: row.title, type: row.type, status: row.status, stage: row.status === 'running' ? STAGES[Math.min(4, job ? job.polls : 0)] : null, error: row.error || null, progress: row.status === 'running' ? { searches: 3, results: 4, reading: 4, read: job && job.polls >= 3 ? 3 : null, startedAt: row.createdAt } : null };
      if (row.status !== 'ready') return json(200, { report: null, summary });
      return json(200, { report: Object.assign({}, row.content, { reportId: row.id, title: row.title, savedAt: row.createdAt }), summary });
    }
    if (/^\/api\/(autopilot|automations)\//.test(p)) return json(200, {});
    if (p === '/api/ai/create-ad') { S.createBody = body; return json(200, { ok: false, error: 'stop here (test)' }); }
    return json(200, {});
  });
}
async function enter(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window._getAccessToken = async function () { return 'mock-token'; };
    if (window.orvTour) { window.orvTour.open = function () {}; try { window.orvTour.close(); } catch (_) {} }
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-research2', email: 'mock@example.invalid' });
    window._dbSubscriptionStatus = 'starter';
  });
  await page.evaluate(() => { window.__ln = { id: null, at: performance.now() }; setInterval(function () { var a = document.querySelector('.page.active'); var id = a && a.id; if (id !== window.__ln.id) window.__ln = { id: id, at: performance.now() }; }, 100); });
  for (let i = 0; i < 150; i++) { await page.waitForTimeout(200); if (await page.evaluate(() => performance.now() - window.__ln.at > 3000 && performance.now() > 8500)) break; }
  await go(page);
  return errors;
}
async function go(page) {
  for (let k = 0; k < 10; k++) {
    await page.evaluate(() => { if (window.orvTour) { try { window.orvTour.close(); } catch (_) {} } var b = document.getElementById('orvConsentBanner'); if (b) b.remove(); _orvNav('research', 'page-research'); });
    await page.waitForTimeout(500);
    if (await page.evaluate(() => document.querySelector('.page.active').id === 'page-research' && !!document.querySelector('#rsRoot .rx-head'))) break;
  }
  await page.waitForFunction(() => document.querySelector('#rsRoot .rx-lib-list, #rsRoot .rx-lib p'), null, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(150);
}
const text = (page, sel) => page.$eval(sel, (e) => e.innerText).catch(() => null);
const lastCall = (S, m, re) => S.calls.filter((c) => c.m === m && re.test(c.p)).pop();
async function waitView(page, v, ms) { await page.waitForFunction((x) => document.getElementById('rsRoot') && document.getElementById('rsRoot').getAttribute('data-view') === x, v, { timeout: ms || 15000 }).catch(() => {}); await page.waitForTimeout(150); }
async function noSideScroll(page) { return page.evaluate(() => { const bad = Array.from(document.querySelectorAll('#rsRoot *')).filter((e) => { if (e.closest('.rx-table-wrap')) return false; const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map((e) => e.className).slice(0, 5); return document.documentElement.scrollWidth <= innerWidth + 1 && !bad.length ? true : bad; }); }

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const S = freshState();
    await arm(page, S);
    const errors = await enter(page);

    // ── Home ───────────────────────────────────────────────────────────
    check('opens on Research Home (no report auto-opened)', await page.evaluate(() => document.getElementById('rsRoot').getAttribute('data-view') === 'home') && !(await page.$('#rsRoot .rx-report')));
    check('title + description', (await text(page, '.rx-title')) === 'Research' && /research-backed advertising insights/.test((await text(page, '.rx-sub')) || ''));
    const rl = await page.evaluate(() => { const R = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; }; const types = Array.from(document.querySelectorAll('#rsRoot .rx-type')).map((e) => Math.round(e.getBoundingClientRect().top)); const btn = R('#researchSubmitBtn'); return { wrap: Math.round(R('.rx-wrap').width), types: new Set(types).size, btnBottom: btn ? Math.round(btn.bottom) : 9999, vh: innerHeight, ctxCols: getComputedStyle(document.querySelector('#rsRoot .rx-ctx')).gridTemplateColumns }; });
    check('wider Research at 1366: content uses the page width, the four types side by side, context next to the websites', rl.wrap >= 1250 && rl.types === 1 && rl.ctxCols.split(' ').length === 2, rl);
    check('the start form (through Start Research) fits a 1366×900 screen', rl.btnBottom <= rl.vh, rl);
    check('four real research types', (await page.$$('#rsRoot input[name="rxType"]')).length === 4 && /Market research[\s\S]*Competitor research[\s\S]*Audience research[\s\S]*Opportunity research/.test(await text(page, '.rx-types')));
    check('cost 25 credits shown with what it pays for', /25 credits/i.test((await text(page, '.rx-cost')) || '') && /3 web searches/.test(await text(page, '.rx-cost')) && /Not charged if it fails/.test(await text(page, '.rx-cost')));
    check('business context shown, website toggle', /Linnen & Co/.test((await text(page, '.rx-ctx')) || '') && /Market: Netherlands/.test(await text(page, '.rx-ctx')) && !!(await page.$('#rsRoot input[data-rx="include-website"]:checked')));
    check('no Focus control any more', !(await page.$('#rsRoot .rsc-focus-pill, #researchFocusToggleBtn')));
    const lib = await text(page, '.rx-lib');
    check('library lists saved reports with type, date, sources, status', /Linen shirt competitors in the Netherlands/.test(lib) && /Competitor research/.test(lib) && /3 sources/.test(lib) && /Failed — not charged/.test(lib) && /Old question about linen/.test(lib), lib);
    check('library titles readable in light mode (contrast)', await page.evaluate(() => { const el = document.querySelector('.rx-lib-t'); const c = getComputedStyle(el).color, bg = getComputedStyle(document.querySelector('.rx-lib')).backgroundColor; const lum = (s) => { const [r, g, b] = s.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }; const a = lum(c), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5; }));
    await page.screenshot({ path: path.join(SHOT_DIR, 'home-desktop-light.png'), fullPage: true });

    // Validation
    await page.click('#researchSubmitBtn');
    check('empty question → clear message, nothing sent', /Describe what you want to research/.test((await text(page, '#rxFormErr')) || '') && !lastCall(S, 'POST', /query/));
    await page.fill('#researchQueryInput', 'linen');
    await page.click('#researchSubmitBtn');
    check('too short → message', /a few more words/.test((await text(page, '#rxFormErr')) || ''));
    check('question field limited to 500 chars, counter shown', (await page.getAttribute('#researchQueryInput', 'maxlength')) === '500' && /5\/500/.test((await text(page, '#rxQCount')) || ''));

    // ── Start a competitor research ───────────────────────────────────
    await page.fill('#researchQueryInput', 'Who are my main competitors and how do they advertise?');
    S.startStatus = { status: 401, body: { error: 'Authentication required' } };
    await page.click('#researchSubmitBtn'); await page.waitForTimeout(300);
    check('not signed in (401) → message, nothing started', /Authentication required/.test((await text(page, '#rxFormErr')) || '') && await page.evaluate(() => document.getElementById('rsRoot').getAttribute('data-view') === 'home'));
    S.startStatus = null;
    await page.click('#rsRoot input[name="rxType"][value="competitor"]', { force: true });
    await page.click('#rsRoot [data-rx="url-open"]');
    await page.fill('#rxUrlInput', 'not a url');
    await page.click('#rsRoot [data-rx="url-add"]');
    check('bad extra website rejected with a message', /full web address/.test((await text(page, '.rx-sites')) || ''));
    await page.fill('#rxUrlInput', 'competitor.example/page');
    await page.press('#rxUrlInput', 'Enter');
    check('extra website added as a chip', /competitor\.example/.test((await text(page, '.rx-sites .rx-chips')) || ''));
    await page.click('#researchSubmitBtn');
    await waitView(page, 'progress', 4000);
    const post = lastCall(S, 'POST', /\/api\/research\/query/);
    check('start sends structured fields (question, type, website toggle, urls) + idempotency key', post && post.body.question === 'Who are my main competitors and how do they advertise?' && post.body.type === 'competitor' && post.body.includeWebsite === true && JSON.stringify(post.body.urls) === '["https://competitor.example/page"]' && /^[0-9a-f-]{20,}$/i.test(post.headers['x-idempotency-key'] || ''), post && post.body);
    check('no internal instruction text appended to the question', post && !/Focus the investigation/.test(post.body.question));
    await page.waitForFunction(() => /Reading sources/.test((document.querySelector('.rx-step.is-on') || {}).textContent || ''), null, { timeout: 12000 }).catch(() => {});
    const prog = await text(page, '.rx-progress');
    check('progress shows the real stages with counts from the job', /Preparing research/.test(prog) && /Searching the web/.test(prog) && /Reading sources/.test(prog) && /3 targeted searches/.test(prog) && /4 results found/.test(prog) && /You can leave this page/.test(prog), prog);
    await page.screenshot({ path: path.join(SHOT_DIR, 'progress-desktop-light.png') });
    await waitView(page, 'report', 20000);

    // ── Report ─────────────────────────────────────────────────────────
    const rep = await text(page, '#rsRoot');
    check('report opens when the job is ready', await page.evaluate(() => !!document.querySelector('#rsRoot .rx-report')));
    check('header: type, title, date, sources read', /Competitor research/i.test(rep) && /Linen shirt competitors in the Netherlands/.test(rep) && /3 of 4 sources read/.test(rep) && /3 searches/.test(rep), (await text(page, '.rx-rhead')));
    check('executive summary with key conclusions first', await page.evaluate(() => document.querySelector('.rx-body .rx-sec').id === 'rxs-summary' && document.querySelectorAll('.rx-kc-i').length === 3));
    const secs = await page.$$eval('.rx-body .rx-sec h2', (h) => h.map((x) => x.textContent));
    check('competitor report sections in order', JSON.stringify(secs) === JSON.stringify(['Executive summary', 'Competitor overview', 'Competitor comparison', 'Public advertising patterns', 'Differentiation opportunities', 'Sources & limitations']), secs);
    check('section navigation links every section', (await page.$$('.rx-toc a')).length === secs.length);
    const card1 = await text(page, '.rx-grid .rx-icard');
    check('competitor card shows real fields only', /Linnen Huis/.test(card1) && /Value proposition\s*Easy returns/.test(card1) && /Public pricing\s*From 59 euro/.test(card1) && /Where you could stand apart\s*Address wrinkling/.test(card1));
    check('missing competitor fields are left out, not invented', !/Offering/.test((await page.$$eval('.rx-grid .rx-icard', (c) => c[1].innerText)) || ''));
    check('comparison table with dashes for unknowns', await page.evaluate(() => { const t = document.querySelector('.rx-table'); return t && t.querySelectorAll('tbody tr').length === 3 && /—/.test(t.innerText); }));
    check('evidence labels: source-checked with quote, cited not checked, analysis', /✓Source-checked/.test(rep.replace(/\s/g, '')) && /Cited, not checked/.test(rep) && /Analysis/.test(rep) && !/\bVerified\b/.test(rep));
    await page.click('.rx-kc-i .rx-quote summary');
    check('source quote can be inspected', /Every order comes with free returns within 30 days/.test((await text(page, '.rx-kc-i .rx-quote blockquote')) || ''));
    check('ideas are framed as ideas, once per section (not a badge on every row)', /Ideas to test — reasoned suggestions/.test(rep) && (await page.$$('.rx-ev-idea')).length === 0);
    const srcSec = await text(page, '#rxs-sources');
    check('sources: read vs not read, why, which findings use them', /OrivenAI ran 3 searches, found 4 results and read 3 pages/.test(srcSec) && /Not read/.test(srcSec) && /took too long/.test(srcSec) && /Used in: Key conclusions|Used in: Competitor/.test(srcSec) && /Your website/.test(srcSec) && /Meta Ad Library/.test(srcSec), srcSec);
    check('limitations + no ad-performance claim', /No public ad examples could be retrieved/.test(srcSec) && /No competitor ad-performance data/.test(srcSec));
    check('no Market Map, no checkbox per row', !(await page.$('#researchMapSvg, .rmap-tooltip')) && (await page.$$('#rsRoot input[type="checkbox"]')).length === 0);
    await page.screenshot({ path: path.join(SHOT_DIR, 'report-competitor-desktop-light.png'), fullPage: true });

    // ── Insight selection → Create ─────────────────────────────────────
    const adds = await page.$$('#rsRoot .rx-add');
    check('“Add to Create” on insight cards', adds.length >= 8, adds.length);
    for (let i = 0; i < 8; i++) await page.click('#rsRoot .rx-add:not(.is-on):not([disabled])');
    const tray = await text(page, '.rx-tray');
    check('tray shows 8/8 and the action', /Selected insights 8\/8/.test(tray) && /Use 8 insights in Create/.test(tray), tray);
    check('9th insight can’t be added (limit shown, nothing dropped silently)', await page.evaluate(() => Array.from(document.querySelectorAll('#rsRoot .rx-add:not(.is-on)')).every((b) => b.disabled && /Up to 8/.test(b.title))));
    await page.click('.rx-tray [data-rx="pick-remove"]');
    check('an insight can be removed in the tray', /Selected insights 7\/8/.test((await text(page, '.rx-tray')) || ''));
    // Selections survive leaving and reopening the report
    await page.click('#rsRoot [data-rx="home"]');
    await waitView(page, 'home');
    check('back to Research Home; Continue link offered', /Continue: Linen shirt competitors/.test((await text(page, '.rx-lib')) || ''));
    await page.click('#rsRoot .rx-continue');
    await waitView(page, 'report');
    check('selections persist when the report is reopened', /Selected insights 7\/8/.test((await text(page, '.rx-tray')) || ''));
    await page.click('.rx-tray [data-rx="use-create"]');
    await page.waitForTimeout(700);
    const handoff = await page.evaluate(() => orvWorkspace.research.handoff());
    const payload = await page.evaluate(() => orvWorkspace.research.payload());
    check('navigates to Create', await page.evaluate(() => document.querySelector('.page.active').id === 'page-create'));
    check('handoff keeps report id, type, evidence labels and sources', handoff && handoff.findings.length === 7 && handoff.researchType === 'competitor' && /^bbbbbbbb/.test(handoff.reportId) && handoff.findings.some((f) => f.basis === 'source_checked' && f.sources[0] && f.sources[0].domain === 'linnenhuis.nl'), handoff);
    check('payload sent to generation is structured and capped at 8', payload && payload.researchType === 'competitor' && payload.reportId === handoff.reportId && payload.findings.length === 7 && payload.findings.every((f) => 'basis' in f && Array.isArray(f.sources)), payload);
    check('Create shows the research insights; notes not auto-filled', await page.evaluate(() => { const st = window.orvCreate && orvCreate.getState(); return st && !/Focus on this opportunity/.test(st.notes || ''); }));

    // ── Library actions ────────────────────────────────────────────────
    await go(page);
    await page.click('#rsRoot .rx-lib-item [data-rx="rename"]');
    await page.fill('#rxRename', 'My competitor scan');
    await page.press('#rxRename', 'Enter');
    await page.waitForTimeout(300);
    check('rename from the library (server-side)', /My competitor scan/.test((await text(page, '.rx-lib')) || '') && lastCall(S, 'PATCH', /reports\//).body.title === 'My competitor scan');
    const delCount = S.rows.length;
    await page.click('#rsRoot .rx-lib-item:nth-child(2) [data-rx="delete"]');
    await page.waitForSelector('.ofd-backdrop .ofd-foot button');
    const btns = await page.$$('.ofd-backdrop .ofd-foot button'); await btns[btns.length - 1].click();
    await page.waitForTimeout(400);
    check('delete asks first, then removes', S.rows.length === delCount - 1 && !!lastCall(S, 'DELETE', /reports\//));

    // Legacy (version 1) report
    const legacyBtn = await page.$('#rsRoot .rx-lib-main[data-id="aaaaaaaa-0000-0000-0000-000000000002"]');
    if (legacyBtn) {
      await legacyBtn.click(); await waitView(page, 'report');
      const lt = await text(page, '#rsRoot');
      check('old reports still open, marked as earlier version, “verified” shown as cited', /earlier version of Research/.test(lt) && /Old Brand/.test(lt) && /Cited, not checked/.test(lt) && !/Source-checked/.test(lt.replace(/Only passages from pages it read can be source-checked/, '')), lt.slice(0, 300));
      await page.click('#rsRoot [data-rx="home"]'); await waitView(page, 'home');
    } else check('old reports still open', false, 'legacy row missing');

    // ── Other types render their own structures ───────────────────────
    for (const [t, expect] of [['market', ['Market overview', 'Market trends', 'Customer demand signals', 'Competitive landscape', 'Market opportunities', 'Advertising implications']], ['audience', ['Audience segments', 'Customer needs & pain points', 'Motivations & objections', 'Messaging opportunities']], ['opportunity', ['Key opportunities', 'Supporting evidence', 'Advertising angles', 'Suggested tests', 'Risks']]]) {
      await page.fill('#researchQueryInput', 'Linen shirts for men in summer, ' + t);
      await page.click('#rsRoot input[name="rxType"][value="' + t + '"]', { force: true });
      await page.click('#researchSubmitBtn');
      await waitView(page, 'report', 20000);
      const h = await page.$$eval('.rx-body .rx-sec h2', (x) => x.map((e) => e.textContent));
      check(t + ' report: own sections, summary first, sources last', h[0] === 'Executive summary' && h[h.length - 1] === 'Sources & limitations' && expect.every((e) => h.includes(e)), h);
      if (t === 'opportunity') {
        await page.screenshot({ path: path.join(SHOT_DIR, 'report-opportunity-desktop-light.png'), fullPage: true });
        const oc = (await text(page, '.rx-icard-opp')) || '';
        check('opportunity card: why, audience, angle, test, limitation, supporting evidence', /Main complaint, unaddressed[\s\S]*Office workers[\s\S]*Lived-in look[\s\S]*Wrinkle angle vs comfort angle[\s\S]*Based on one review site[\s\S]*Supported by/i.test(oc), oc);
        check('test card A vs B', /A · Wrinkle angle\s*vs\s*B · Comfort angle/.test((await text(page, '#rxs-tests')) || ''));
      }
      if (t === 'audience') check('audience: observed signals labelled; hypotheses flagged', /Hypotheses about who to reach/.test((await text(page, '#rxs-segments')) || '') && /In their words: “creased after an hour”/.test((await text(page, '#rxs-needs')) || ''));
      await page.click('#rsRoot [data-rx="home-new"]'); await waitView(page, 'home');
    }

    // ── Failure + errors ───────────────────────────────────────────────
    S.failNext = true;
    await page.fill('#researchQueryInput', 'This research will fail on the provider');
    await page.click('#researchSubmitBtn');
    await page.waitForFunction(() => /didn’t finish/.test((document.getElementById('rsRoot') || {}).innerText || ''), null, { timeout: 15000 }).catch(() => {});
    const ft = await text(page, '#rsRoot');
    check('failed job: friendly message, credits returned, no raw error', /Research didn’t finish/.test(ft) && /credits were returned/.test(ft) && !/503|upstream|stack/i.test(ft));
    await page.click('#rsRoot [data-rx="retry-job"]'); await waitView(page, 'home');
    check('Try again keeps the question', (await page.inputValue('#researchQueryInput')) === 'This research will fail on the provider');
    // Regression: the start that failed in testing (500 RESEARCH_START_FAILED from the server)
    S.startStatus = { status: 500, body: { error: 'Research could not be started. Nothing was charged — please try again.', code: 'RESEARCH_START_FAILED', requestId: 'c78ea664-7cfa-485d-9394-24378a07879e' } };
    await page.click('#researchSubmitBtn'); await page.waitForTimeout(300);
    check('start failure → server message + short reference, still on Home, button usable again, question kept', /Research could not be started\. Nothing was charged/.test((await text(page, '#rxFormErr')) || '') && /Reference: c78ea664/.test((await text(page, '#rxFormErr')) || '') && await page.evaluate(() => document.getElementById('rsRoot').getAttribute('data-view') === 'home' && !document.getElementById('researchSubmitBtn').disabled) && (await page.inputValue('#researchQueryInput')) === 'This research will fail on the provider');
    S.startStatus = { status: 402, body: { error: 'Out of credits', code: 'CREDITS_EXHAUSTED', balance: 3 } };
    await page.click('#researchSubmitBtn'); await page.waitForTimeout(300);
    check('not enough credits → clear message with plans', /costs 25 credits — you don’t have enough/.test((await text(page, '#rxFormErr')) || '') && !!(await page.$('#rxFormErr [data-rx="plans"]')));
    check('…and the app’s own plans dialog opens (nothing charged)', await page.evaluate(() => !!document.querySelector('#modal-paywall.open')));
    await page.evaluate(() => { var m = document.getElementById('modal-paywall'); if (m) m.classList.remove('open'); });
    S.startStatus = { status: 409, body: { error: 'running', code: 'RESEARCH_RUNNING', reportId: S.rows.find((x) => x.status === 'ready' && x.reportVersion === 2).id } };
    await page.click('#researchSubmitBtn'); await page.waitForTimeout(400);
    check('a research already running → its progress/report opens instead of a second charge', await page.evaluate(() => ['progress', 'report'].includes(document.getElementById('rsRoot').getAttribute('data-view'))));
    await waitView(page, 'report', 8000);
    S.startStatus = null;
    await go(page);

    // Running research shows on Home; navigation away keeps it running
    S.holdJobs = true;
    await page.fill('#researchQueryInput', 'A research that keeps running in the background');
    await page.click('#researchSubmitBtn'); await waitView(page, 'progress');
    await page.evaluate(() => _orvNav('create', 'page-create')); await page.waitForTimeout(400);
    await go(page);
    check('after navigating away: Home shows the running research with a link', /Research in progress/.test((await text(page, '.rx-banner')) || '') && await page.evaluate(() => document.getElementById('researchSubmitBtn').disabled));
    S.holdJobs = false;
    await page.click('.rx-banner [data-rx="progress"]');
    await waitView(page, 'report', 20000);
    check('…and it can be followed to the finished report', await page.evaluate(() => !!document.querySelector('#rsRoot .rx-report')));

    // ── Six languages ──────────────────────────────────────────────────
    const TT = { en: 'Research', nl: 'Onderzoek', de: 'Recherche', fr: 'Recherche', es: 'Investigación', pt: 'Pesquisa' };
    for (const l of Object.keys(TT)) {
      await page.evaluate((x) => { CURRENT_LANG = x; applyLanguage(); }, l);
      await page.click('#rsRoot [data-rx="home"]').catch(() => {}); await page.waitForTimeout(200);
      const home = await text(page, '#rsRoot');
      const raw = /\{[a-z]+\}|\b(types|sec|ev|stages|sig|f|rel)\.[a-z]+/i.test(home);
      check(l + ': Home translated, no raw keys', (await text(page, '.rx-title')) === TT[l] && !raw, home.slice(0, 160));
      await page.click('#rsRoot .rx-continue').catch(() => {}); await waitView(page, 'report');
      const rt = await text(page, '#rsRoot');
      check(l + ': report translated', !/\{[a-z]+\}/.test(rt) && (l === 'en' || !/Executive summary|Sources & limitations/.test(rt)), rt.slice(0, 160));
      if (l === 'de' || l === 'nl') await page.screenshot({ path: path.join(SHOT_DIR, 'report-' + l + '.png') });
    }
    await page.evaluate(() => { CURRENT_LANG = 'en'; applyLanguage(); });

    // ── Dark mode ──────────────────────────────────────────────────────
    await page.evaluate(() => document.body.classList.add('dark-mode')); await page.waitForTimeout(150);
    const dk = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('.rx-icard, .rx-kc-i')).backgroundColor, text: getComputedStyle(document.querySelector('.rx-title')).color }));
    check('dark mode: dark cards, light text', /rgb\((1[0-9]|2[0-9]|3[0-9]), /.test(dk.card) && /rgb\(2[0-9]{2}, /.test(dk.text), dk);
    await page.screenshot({ path: path.join(SHOT_DIR, 'report-desktop-dark.png'), fullPage: true });
    await page.click('#rsRoot [data-rx="home"]'); await waitView(page, 'home');
    await page.screenshot({ path: path.join(SHOT_DIR, 'home-desktop-dark.png'), fullPage: true });
    await page.evaluate(() => document.body.classList.remove('dark-mode'));

    check('no follow-up chat calls, no page errors', S.chatCalls === 0 && errors.length === 0, errors);
    await ctx.close();

    // ── Mobile ─────────────────────────────────────────────────────────
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage();
    const MS = freshState();
    await arm(mp, MS);
    const merr = await enter(mp);
    check('mobile home: no sideways scroll', (await noSideScroll(mp)) === true, await noSideScroll(mp));
    await mp.screenshot({ path: path.join(SHOT_DIR, 'home-mobile-light.png'), fullPage: true });
    await mp.click('#rsRoot .rx-lib-main[data-id="aaaaaaaa-0000-0000-0000-000000000001"]'); await waitView(mp, 'report');
    await mp.click('#rsRoot .rx-add');
    check('mobile report: no sideways scroll (table scrolls inside its box)', (await noSideScroll(mp)) === true, await noSideScroll(mp));
    check('mobile tray visible', !!(await mp.$('.rx-tray')));
    await mp.screenshot({ path: path.join(SHOT_DIR, 'report-mobile-light.png'), fullPage: true });
    await mp.evaluate(() => document.body.classList.add('dark-mode'));
    await mp.screenshot({ path: path.join(SHOT_DIR, 'report-mobile-dark.png') });
    check('no page errors on mobile', merr.length === 0, merr);
    await mctx.close();
  } catch (e) {
    fail++; console.log('FAIL — test crashed: ' + (e && e.stack || e));
  } finally {
    await browser.close(); srv.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }
})();
