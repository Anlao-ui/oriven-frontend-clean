/* ════════════════════════════════════════════════════════════════
   Competitor Analysis, Creative Testing, Audience Builder and Campaign
   Comparison in the real app.html, against a mock API on 127.0.0.1 (the
   app's dev API base http://localhost:5500 is rewritten to it); every
   other host is aborted. No real users, no AI, no ad platforms, nothing
   written anywhere.
   Checks: each page opens from the sidebar; empty, loading and refused
   states; nothing invented (no fake competitors, no "winning" creative,
   no audience claimed live in a platform, "Not reported" instead of 0);
   saved items come back; the links into Campaign Builder, My Content and
   the Research job.
   RUN: node tests/growth-pages-ui.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT = 8983, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOTS = path.join(__dirname, '_shots', 'growth-pages'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }

const UID = 'user-gx-1';
const now = () => new Date().toISOString();
const M = {
  comps: [], reports: [], queries: [], reportPolls: 0,
  sets: [{ id: 'set1', kind: 'headline', seed: 'Hand-poured candles from Utrecht', createdAt: now(), variations: ['Light up slow evenings', 'Poured by hand, made to last', 'The gift that glows for weeks'], picked: [] }],
  variations: [], picks: [],
  auds: [], audPosts: [], suggest: 'ok',
  saved: [], insights: [],
  calls: [],
};
const REPORT = {
  title: 'Candle competitors in Utrecht', summary: 'Two local brands compete on scent and gifting.',
  keyConclusions: [{ text: 'Both lead with gifting', basis: 'source_checked', sourceIds: ['s1'], why: 'Their homepages say so' }],
  competitors: [{ id: 'c1', name: 'Wax & Wick', website: 'https://waxwick.example', positioning: 'Luxury gifting', basis: 'source_checked', sourceIds: ['s1'], quotes: [{ quote: 'The gift they will remember' }], adPatterns: ['Seasonal gift bundles'] }],
  opportunities: [{ title: 'Own the self-care angle', angle: 'Calm evenings', test: 'Two headlines', basis: 'idea' }],
  limitations: ['Their ad spend is not public'],
  sources: [{ id: 's1', url: 'https://waxwick.example', title: 'Wax & Wick', domain: 'waxwick.example', fetched: true }],
};

const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json({ limit: '2mb' }));
app.use((q, r, n) => { if (q.path.startsWith('/api/')) M.calls.push({ m: q.method, p: q.path, body: q.body }); n(); });
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, reason: 'existing_account', completed: true, stage: 'done', flow: { enabled: false } }));
app.get('/api/credits/status', (q, r) => r.json({ balance: 1000, plan: 'paid', hasAccess: true, accessExpiresAt: new Date(Date.now() + 20 * 864e5).toISOString() }));
app.get('/api/agent', (q, r) => r.json({ agent: { id: 'scout', name: 'Scout', role: 'Research & Insights', color: '#7CF0CC' }, assigned: true, agents: [] }));
// Competitors (the business's list) and the Research job
app.get('/api/business/competitors', (q, r) => r.json({ items: M.comps }));
app.post('/api/business/competitors', (q, r) => { const c = Object.assign({ id: 'comp' + (M.comps.length + 1) }, q.body); M.comps.push(c); r.json({ item: c }); });
app.delete('/api/business/competitors/:id', (q, r) => { M.comps = M.comps.filter((c) => c.id !== q.params.id); r.json({ ok: true }); });
app.get('/api/research/reports', (q, r) => r.json({ reports: M.reports }));
app.post('/api/research/query', (q, r) => { M.queries.push(q.body); M.reports.push({ id: 'rep1', type: 'competitor', status: 'running', title: 'Competitors', createdAt: now() }); r.status(202).json({ reportId: 'rep1' }); });
app.get('/api/research/reports/:id', (q, r) => {
  M.reportPolls++;
  const rep = M.reports.find((x) => x.id === q.params.id);
  if (rep && M.reportPolls < 2) return r.json({ report: null, summary: { status: 'running', stage: 'reading' } });
  if (rep) { rep.status = 'ready'; rep.title = REPORT.title; rep.sourceCount = 1; }
  r.json({ report: REPORT, summary: { status: 'ready', title: REPORT.title } });
});
// Creative Testing
app.get('/api/creative/testing/sets', (q, r) => r.json({ sets: M.sets, performance: null, performanceNote: 'No results per version yet: they appear only when an ad platform reports them for a published campaign.' }));
app.get('/api/creative/assets', (q, r) => r.json({ assets: [] }));
app.post('/api/creative/variations', (q, r) => { M.variations.push(q.body); M.sets.unshift({ id: 'set2', kind: q.body.kind, seed: q.body.seed, createdAt: now(), variations: ['Version one', 'Version two', 'Version three'], picked: [] }); r.json({ variations: ['Version one', 'Version two', 'Version three'] }); });
app.post('/api/creative/testing/pick', (q, r) => { M.picks.push(q.body); r.json({ asset: { id: 'asset-pick-1' } }); });
// Audience Builder
app.get('/api/audiences', (q, r) => r.json({ audiences: M.auds }));
app.post('/api/audiences/suggest', (q, r) => {
  if (M.suggest === 'context') return r.status(422).json({ code: 'NOT_ENOUGH_CONTEXT', error: 'Add a few details about your business first.' });
  r.json({ segments: [{ name: 'Local gift shoppers', description: 'People in Utrecht buying a personal gift.', age_range: '25–44', location: 'Utrecht', interests: ['Gifts', 'Home decor'], preferred_platforms: ['Meta'], targeting: { meta: { age_min: 25, age_max: 44, locations: ['Utrecht'], interests: ['Gifts'] } }, basis: { onboarding: true, business: true }, assumptions: ['Most buyers live nearby'] }], used: 25 });
});
app.post('/api/audiences', (q, r) => { const a = q.body.audience; M.audPosts.push(a); const row = { id: 'aud' + (M.auds.length + 1), name: a.name, text: a.name + ': ' + (a.description || ''), age_range: a.age_range, location: a.location, interests: a.interests, preferred_platforms: a.preferred_platforms, profile: { description: a.description, status: 'prepared' } }; M.auds.push(row); r.json({ audience: row }); });
// Campaign Comparison
app.get('/api/campaigns/compare/saved', (q, r) => r.json({ comparisons: M.saved }));
app.post('/api/campaigns/compare/insight', (q, r) => {
  M.insights.push(q.body);
  const c = { id: 'cmp1', title: q.body.campaigns.map((x) => x.name).join(' vs '), range: q.body.range, campaigns: q.body.campaigns, savedAt: now(), insight: { summary: 'Spring Sale reached more people for less per click.', differences: ['CTR is higher for Spring Sale'], trends: [], recommendations: ['Test the Spring Sale headline in Workshop'], caveats: ['Conversions were not reported for Workshop'] } };
  M.saved = [c];
  r.json({ comparison: c });
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
async function signIn(page) {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }); });
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.orvAppNav && !!window.orvPages && !!window.orvAudienceBuilder, null, { timeout: 15000 });
  await page.evaluate((uid) => {
    window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token';
    if (window.orvTour) window.orvTour.open = function () {};
    window._dbSubscriptionStatus = 'paid';
    window._currentUser = { id: uid, email: 'owner@example.invalid' };
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: uid, email: 'owner@example.invalid' });
    window.confirm = () => true;
  }, UID);
  await page.waitForTimeout(1200);
}
const activePage = (page) => page.evaluate(() => (document.querySelector('.page.active') || {}).id);
const txt = (page, sel) => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); await fence(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page);

    // ── 1. In the sidebar, under the existing sections ─────────────
    console.log('\n1. Navigation');
    const nav = await page.evaluate(() => Array.from(document.querySelectorAll('.orv-sb .onv-item')).map((b) => b.dataset.onv));
    check('1.1 Creative Testing, Audience Builder and Campaign Comparison are in the sidebar; Competitor Analysis opens from the Research header (no new section)', ['testing', 'audiences', 'compare'].every((k) => nav.includes(k)) && !nav.includes('competitors'), nav);
    const keys = await page.evaluate(() => ['competitor-analysis', 'creative-testing', 'audience-builder', 'campaign-comparison'].map((k) => window.orvPages.has(k)));
    check('1.2 the shared page keys know the four pages (plan tasks and the assistant open them)', keys.every(Boolean), keys);

    // ── 2. Competitor Analysis ──────────────────────────────────────
    console.log('\n2. Competitor Analysis');
    await page.evaluate(() => window.orvAppNav.go('competitors')); await page.waitForTimeout(500);
    let t = await txt(page, '#cpaRoot');
    check('2.1 opens empty and honest: no invented competitors, says it reads only public information', (await activePage(page)) === 'page-competitor-analysis' && /No competitors yet/.test(t) && /no access to anyone’s private advertising data/.test(t) && /Your competitor analyses appear here/.test(t), t.slice(0, 400));
    await page.click('[data-cpa-new]'); await page.fill('[data-cpa-form] [name="company"]', 'Wax & Wick'); await page.fill('[data-cpa-form] [name="website"]', 'waxwick.example');
    await page.click('[data-cpa-form] [type="submit"]'); await page.waitForTimeout(500);
    check('2.2 adding a competitor saves it to the business list (website gets https://)', M.comps.length === 1 && M.comps[0].website === 'https://waxwick.example' && /Wax & Wick/.test(await txt(page, '#cpaRoot')), M.comps);
    await page.check('[data-cpa-sel="comp1"]'); await page.waitForTimeout(150);
    await page.click('[data-cpa-run]'); await page.waitForTimeout(400);
    check('2.3 the analysis runs as a Research job (type competitor, the selected website) and shows it’s working', M.queries.length === 1 && M.queries[0].type === 'competitor' && M.queries[0].urls[0] === 'https://waxwick.example' && /Analysing/.test(await txt(page, '#cpaRoot')), M.queries);
    await page.waitForTimeout(9000);
    t = await txt(page, '#cpaRoot');
    check('2.4 the finished analysis opens: findings with where each comes from (Verified / AI suggestion), quotes, sources, limits', /Candle competitors in Utrecht/.test(t) && /Verified/.test(t) && /AI suggestion/.test(t) && /The gift they will remember/.test(t) && /Their ad spend is not public/.test(t) && /read by OrivenAI/.test(t), t.slice(0, 600));
    check('2.5 a competitor already in your list isn’t offered again; next steps open Audience Builder / Creative Testing', /In your competitor list/.test(t) && !!(await page.$('[data-cpa-page="audience-builder"]')) && !!(await page.$('[data-cpa-page="creative-testing"]')));
    await page.screenshot({ path: path.join(SHOTS, 'competitor-report.png'), fullPage: false });
    await page.click('[data-cpa-back]'); await page.waitForTimeout(300);
    check('2.6 the analysis is saved and can be opened again', /Candle competitors in Utrecht/.test(await txt(page, '#cpaRoot .gx-saved')));

    // ── 3. Creative Testing ─────────────────────────────────────────
    console.log('\n3. Creative Testing');
    await page.click('.orv-sb .onv-item[data-onv="testing"]'); await page.waitForTimeout(600);
    t = await txt(page, '#ctsRoot');
    check('3.1 earlier variation sets are shown side by side; no version is called a winner; results only from published campaigns', (await activePage(page)) === 'page-creative-testing' && /Poured by hand, made to last/.test(t) && /3 versions/.test(t) && !/winner|won|best performing/i.test(t) && /published campaign/.test(t), t.slice(0, 500));
    await page.click('[data-cts-gen]'); await page.waitForTimeout(200);
    check('3.2 an empty idea isn’t sent (nothing charged)', M.variations.length === 0 && /Write your ad idea first/.test(await txt(page, '#ctsRoot')));
    await page.fill('#ctsSeed', 'Soy candles for slow evenings'); await page.selectOption('#ctsKind', 'hook'); await page.selectOption('#ctsCount', '3');
    await page.click('[data-cts-gen]'); await page.waitForTimeout(1400);
    check('3.3 new variations use the existing generator (kind, idea, count) and appear as a set', M.variations.length === 1 && M.variations[0].kind === 'hook' && M.variations[0].count === 3 && /Version two/.test(await txt(page, '#ctsRoot')), M.variations);
    await page.click('[data-cts-pick="set1"][data-i="1"]'); await page.waitForTimeout(400);
    t = await txt(page, '#ctsRoot');
    check('3.4 choosing a version saves it to My Content and offers Campaign Builder', M.picks.length === 1 && M.picks[0].setId === 'set1' && M.picks[0].index === 1 && /Saved to My Content/.test(t) && !!(await page.$('[data-cts-page="campaign-builder"]')), M.picks);
    await page.screenshot({ path: path.join(SHOTS, 'creative-testing.png') });

    // ── 4. Audience Builder → Campaign Builder ──────────────────────
    console.log('\n4. Audience Builder');
    await page.evaluate((uid) => {
      const pkg = { strategy: { targetAudience: 'Everyone' }, metaAds: { targetAudience: 'Everyone' } };
      localStorage.setItem('oriven_campaigns_' + uid, JSON.stringify([
        { id: 'camp-draft', name: 'Workshop draft', platform: 'meta', status: 'draft', created: new Date().toISOString(), pkg },
        { id: 'camp-live', name: 'Spring Sale', platform: 'meta', status: 'published', publishedAt: new Date().toISOString(), created: new Date(Date.now() - 864e5).toISOString(), pkg: JSON.parse(JSON.stringify(pkg)) },
      ]));
    }, UID);
    M.suggest = 'context';
    await page.click('.orv-sb .onv-item[data-onv="audiences"]'); await page.waitForTimeout(500);
    t = await txt(page, '#aubRoot');
    check('4.1 opens with no audiences and says audiences are prepared in OrivenAI, not created in an ad platform', (await activePage(page)) === 'page-audience-builder' && /No saved audiences yet/.test(t) && /not created in Meta, Google, TikTok or Pinterest/.test(t), t.slice(0, 400));
    await page.click('[data-aub-suggest]'); await page.waitForTimeout(500);
    check('4.2 not enough information: says what’s missing and links to Control Center (no suggestions invented)', /Add a few details about your business first/.test(await txt(page, '#aubRoot')) && !!(await page.$('[data-aub-page="control-center"]')) && !(await page.$('[data-aub-save]')));
    M.suggest = 'ok';
    await page.click('[data-aub-suggest]'); await page.waitForTimeout(600);
    t = await txt(page, '#aubRoot');
    check('4.3 suggestions show who, where, interests, and what they’re based on (your answers) and what was assumed', /Local gift shoppers/.test(t) && /Based on your onboarding answers, your business details/.test(t) && /Assumed: Most buyers live nearby/.test(t), t.slice(0, 600));
    await page.click('[data-aub-save="0"]'); await page.waitForTimeout(600);
    t = await txt(page, '#aubRoot');
    check('4.4 saving stores it in your audiences, marked "Prepared in OrivenAI"', M.audPosts.length === 1 && M.audPosts[0].name === 'Local gift shoppers' && /Your audiences[\s\S]*Local gift shoppers[\s\S]*Prepared in OrivenAI/.test(t), M.audPosts);
    await page.click('[data-aub-use="aud1"]'); await page.waitForTimeout(600);
    const cb = await page.evaluate(() => ({ text: (document.getElementById('onvPanel') || {}).innerText || '', use: Array.from(document.querySelectorAll('[data-onv-aud]')).map((b) => b.getAttribute('data-onv-aud')) }));
    check('4.5 "Use in Campaign Builder" opens Campaign Builder with the audience ready; only the unpublished campaign can take it', /Audience ready to use: Local gift shoppers/.test(cb.text) && cb.use.length === 1 && cb.use[0] === 'camp-draft' && /Published — change its audience in the ad platform/.test(cb.text), cb);
    await page.screenshot({ path: path.join(SHOTS, 'builder-audience.png') });
    await page.click('[data-onv-aud="camp-draft"]'); await page.waitForTimeout(400);
    const after = await page.evaluate((uid) => { const l = JSON.parse(localStorage.getItem('oriven_campaigns_' + uid)); return { draft: l.find((c) => c.id === 'camp-draft').pkg, live: l.find((c) => c.id === 'camp-live').pkg, pending: sessionStorage.getItem('orv_pending_audience'), banner: !!document.querySelector('.onv-cb__aud') }; }, UID);
    check('4.6 applying sets the draft campaign’s audience (strategy and Meta) and leaves the published one alone', /^Local gift shoppers/.test(after.draft.strategy.targetAudience) && /^Local gift shoppers/.test(after.draft.metaAds.targetAudience) && after.live.strategy.targetAudience === 'Everyone' && !after.pending && !after.banner, after);

    // ── 5. Campaign Comparison ──────────────────────────────────────
    console.log('\n5. Campaign Comparison');
    const src = await page.evaluate(() => !!(window.orvCampaignSources && Array.isArray(window.orvCampaignSources.platforms) && typeof window.orvCampaignSources.load === 'function' && typeof window.orvCampaignSources.status === 'function'));
    check('5.1 it reads the same campaign data as Campaign Overview (window.orvCampaignSources)', src);
    // No platform connected
    await page.evaluate(() => { window.__realSources = window.orvCampaignSources; window.orvCampaignSources = { platforms: ['meta', 'google'], status: () => Promise.resolve({ conn: 'disconnected' }), load: () => Promise.resolve({ rows: [] }) }; });
    await page.click('.orv-sb .onv-item[data-onv="compare"]'); await page.waitForTimeout(500);
    t = await txt(page, '#ccmRoot');
    check('5.2 nothing connected: says to connect an ad platform (no sample campaigns)', (await activePage(page)) === 'page-campaign-comparison' && /Connect an ad platform first/.test(t) && !(await page.$('.gx-table')), t.slice(0, 300));
    // Two Meta campaigns with real figures, one without conversions reported; Pinterest account-level only.
    await page.evaluate(() => {
      const rows = {
        meta: [
          { key: 'meta:1', platform: 'meta', id: '1', name: 'Spring Sale', status: 'ACTIVE', metricsLevel: 'campaign', currency: 'EUR', impressions: 12000, reach: 9000, clicks: 360, spend: 120, conv: 12, convVal: 480 },
          { key: 'meta:2', platform: 'meta', id: '2', name: 'Workshop', status: 'ACTIVE', metricsLevel: 'campaign', currency: 'EUR', impressions: 8000, reach: null, clicks: 160, spend: 100, conv: null, convVal: null },
        ],
        pinterest: [{ key: 'pin:a', platform: 'pinterest', id: 'a', name: 'Pinterest account', metricsLevel: 'account', impressions: 5000 }],
      };
      window.orvCampaignSources = { platforms: ['meta', 'pinterest'], status: () => Promise.resolve({ conn: 'connected', currency: 'EUR' }), load: (p, range) => { window.__lastRange = range; return Promise.resolve({ rows: rows[p] || [] }); } };
      window.orvCampaignComparison.reload();
    });
    await page.waitForTimeout(500);
    t = await txt(page, '#ccmRoot');
    check('5.3 campaigns listed per platform; Pinterest explained as account-level only and not selectable', /Spring Sale/.test(t) && /Workshop/.test(t) && /Pinterest reports results for the whole ad account only/.test(t) && await page.evaluate(() => document.querySelector('[data-ccm-sel="pin:a"]').disabled), t.slice(0, 500));
    await page.click('[data-ccm-sel="meta:1"]'); await page.waitForTimeout(150);
    check('5.4 one campaign: asks for at least two (no table, AI not offered)', /Choose at least two campaigns/.test(await txt(page, '#ccmRoot')) && !(await page.$('.gx-table')));
    await page.click('[data-ccm-sel="meta:2"]'); await page.waitForTimeout(200);
    const tb = await page.evaluate(() => { const rows = {}; document.querySelectorAll('.gx-table tbody tr').forEach((tr) => { rows[tr.querySelector('th').textContent] = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.replace(/\s+/g, ' ').trim()); }); return rows; });
    check('5.5 every metric: impressions, reach, clicks, CTR, CPC, CPM, conversions, conversion rate, CPA, ROAS, spend', ['Impressions', 'Reach', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conversion rate', 'CPA', 'ROAS', 'Ad spend'].every((k) => tb[k] && tb[k].length === 2), Object.keys(tb));
    check('5.6 figures computed only from reported numbers: CTR 3.00% vs 2.00%, ROAS 4.00× vs "Not reported" (never 0 or an estimate)', /^3\.00%/.test(tb.CTR[0]) && /^2\.00%/.test(tb.CTR[1]) && /^4\.00×/.test(tb.ROAS[0]) && tb.ROAS[1] === 'Not reported' && tb.Conversions[1] === 'Not reported' && tb.Reach[1] === 'Not reported', tb);
    check('5.7 the better campaign per metric is marked, and the biggest differences are listed', /best/i.test(tb.CTR[0]) && !/best/i.test(tb.CTR[1]) && /Biggest differences/.test(await txt(page, '#ccmRoot')), tb.CTR);
    await page.selectOption('#ccmRange', 'LAST_90_DAYS'); await page.waitForTimeout(400);
    check('5.8 the period can be changed (the platforms are asked for that range); the chosen campaigns stay chosen', await page.evaluate(() => window.__lastRange && window.__lastRange.key === 'LAST_90_DAYS' && document.querySelector('[data-ccm-sel="meta:1"]').checked && document.querySelector('[data-ccm-sel="meta:2"]').checked));
    await page.click('[data-ccm-explain]'); await page.waitForTimeout(600);
    const ins = M.insights[0];
    t = await txt(page, '#ccmRoot');
    check('5.9 "Explain with AI" sends exactly the figures shown (missing ones as null) and shows the explanation as AI analysis', ins && ins.campaigns.length === 2 && ins.campaigns[1].metrics.conversions === null && ins.campaigns[1].metrics.roas === null && ins.campaigns[0].metrics.impressions === 12000 && ins.range.key === 'LAST_90_DAYS' && /What the figures show/.test(t) && /AI analysis/.test(t) && /Conversions were not reported/.test(t), ins);
    check('5.10 the comparison is saved and can be reopened', /Saved comparisons[\s\S]*Spring Sale vs Workshop/.test(t));
    await page.screenshot({ path: path.join(SHOTS, 'comparison.png') });
    await page.click('[data-ccm-view="cmp1"]'); await page.waitForTimeout(300);
    check('5.11 a saved comparison shows its figures as saved, for its period', /Saved comparison/i.test(await txt(page, '#ccmRoot')) && /Last 90 days/.test(await txt(page, '#ccmRoot')));
    await page.evaluate(() => { window.orvCampaignSources = window.__realSources; });

    // ── 6. Phone ────────────────────────────────────────────────────
    console.log('\n6. Phone');
    const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p2 = await ph.newPage(); await fence(p2); p2.on('pageerror', (e) => errors.push(e.message));
    await signIn(p2);
    const widths = [];
    for (const k of ['competitor-analysis', 'creative-testing', 'audience-builder', 'campaign-comparison']) {
      await p2.evaluate((key) => window.orvPages.open(key), k); await p2.waitForTimeout(500);
      widths.push(await p2.evaluate(() => ({ id: document.querySelector('.page.active').id, over: document.documentElement.scrollWidth - window.innerWidth, mc: (() => { const m = document.querySelector('.mc'); return m.scrollWidth - m.clientWidth; })() })));
    }
    check('6.1 all four pages fit a phone (no sideways scrolling)', widths.every((w) => w.over <= 1 && w.mc <= 1), widths);
    await p2.screenshot({ path: path.join(SHOTS, 'phone-comparison.png') });
    await ph.close();

    check('9.1 no page errors', !errors.length, errors);
    check('9.3 no real backend contacted (only the mock on 127.0.0.1)', !blocked.some((u) => /onrender\.com|orivenai\.com\/api/.test(u)), blocked.filter((u) => /onrender|orivenai/.test(u)));
  } catch (e) {
    fail++; console.log('CRASH ' + (e && e.stack || e));
  } finally {
    await browser.close(); server.close();
    console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + SHOTS);
    process.exit(fail ? 1 : 0);
  }
});
