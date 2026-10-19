/* ════════════════════════════════════════════════════════════════
   Launch — one readiness model, honest publish states, recovery.
   End to end in a real browser against the REAL backend publish routes.

   One local express server serves this repo AND mounts the backend's
   routes/publishRoutes.js + services/campaignSpec.js (../oriven-backend)
   with fake account access, mocked platform calls and an in-memory publish
   ledger. Supabase is blocked; no ad platform, AI or credit call is made;
   nothing is written anywhere but this process and the test browser.

   RUN: node tests/launch-readiness.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
if (!fs.existsSync(path.join(BE, 'routes', 'publishRoutes.js'))) { console.log('SKIP — ../oriven-backend/server not found (this test needs the backend checkout next to the frontend).'); process.exit(0); }
const req = (m) => require(require.resolve(m, { paths: [BE, ROOT] }));
const express = req('express');
const { chromium } = require('playwright');
const S = require(path.join(BE, 'services', 'campaignSpec'));
const PL = require(path.join(BE, 'services', 'publishLedger'));
const PORT = 8935, BASE = 'http://127.0.0.1:' + PORT;
const DEV_API = 'http://localhost:5500'; // js/supabase.js API_BASE_URL on localhost
const blocked = [];
const SHOT_DIR = path.join(__dirname, '_shots', 'launch-readiness');
fs.mkdirSync(SHOT_DIR, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }
const now = Date.now(), iso = (ms) => new Date(now + ms).toISOString();

// ── Fixtures (what Create 2.0 stores) ──────────────────────────────
const IMG = 'https://cdn.example.invalid/a.png', VID = 'https://cdn.example.invalid/v.mp4', URL1 = 'https://shop.example.com/linen';
const concept = { angle: 'a', hook: 'Stay cool all summer', cta: 'Shop now', adCopy: { headline: 'Linen that breathes', primaryText: 'Light linen shirts made in Europe.', description: 'Free returns' } };
const G_COPY = { campaignType: 'SEARCH', headlines: ['Linen shirts', 'Made in Europe', 'Free returns', 'Shop linen'], descriptions: ['Light linen shirts for summer.', 'Order today, free returns.'] };
const camp = (id, name, platform, pkg, extra) => Object.assign({ id, name, platform, status: 'draft', created: iso(-1000 * (100 - id.length)), pkg: Object.assign({ campaignName: name }, pkg) }, extra || {});
const CAMPS = [
  camp('meta-ok', 'Meta — ready', 'meta', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, metaAds: { budget: 20 }, concepts: [concept], visualConcepts: [{ conceptRef: 'a', generatedImageUrl: IMG }], spec: { overrides: { specialAdCategories: [] } } }),
  camp('meta-legacy', 'Meta — legacy Engagement', 'meta', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, metaAds: { budget: 20, objective: 'Engagement' }, concepts: [concept], visualConcepts: [{ generatedImageUrl: IMG }], spec: { overrides: { specialAdCategories: [] } } }),
  camp('google-ok', 'Google — ready', 'google', { strategy: { goal: 'Traffic', landingPageUrl: URL1, budgetRecommendation: { amount: 20 } }, googleAds: Object.assign({ keywords: ['linen shirt', 'linen shirts men'] }, G_COPY) }),
  camp('google-nokw', 'Google — no keywords', 'google', { strategy: { goal: 'Traffic', landingPageUrl: URL1, budgetRecommendation: { amount: 20 } }, googleAds: Object.assign({ keywords: [] }, G_COPY) }),
  camp('google-longh', 'Google — headlines too long', 'google', { strategy: { goal: 'Traffic', landingPageUrl: URL1, budgetRecommendation: { amount: 20 } }, googleAds: { campaignType: 'SEARCH', headlines: ['Linen shirts', 'This headline is far longer than thirty characters', 'Another headline that is way too long for Google'], descriptions: G_COPY.descriptions, keywords: ['linen'] } }),
  camp('google-numbud', 'Google — numeric budget', 'google', { strategy: { goal: 'Traffic', landingPageUrl: URL1, budgetRecommendation: 25 }, googleAds: Object.assign({ keywords: ['linen'] }, G_COPY) }),
  camp('tiktok-video', 'TikTok — video from Create 2.0', 'tiktok', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, tiktokAds: { budget: 30 }, concepts: [concept], videoAssets: [{ ref: 'a', videoUrl: VID }] }, { creativeMode: 'videos' }),
  camp('pin-ok', 'Pinterest — ready', 'pinterest', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, pinterestAds: { budget: 15, title: 'Linen shirts', description: 'Made in Europe', creativeType: 'image' }, visualConcepts: [{ generatedImageUrl: IMG }] }),
  camp('pin-two', 'Pinterest — second', 'pinterest', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, pinterestAds: { budget: 15, title: 'Linen two', creativeType: 'image' }, visualConcepts: [{ generatedImageUrl: IMG }] }),
  camp('pin-three', 'Pinterest — third', 'pinterest', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, pinterestAds: { budget: 15, title: 'Linen three', creativeType: 'image' }, visualConcepts: [{ generatedImageUrl: IMG }] }),
  camp('pin-four', 'Pinterest — fourth', 'pinterest', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, pinterestAds: { budget: 15, title: 'Linen four', creativeType: 'image' }, visualConcepts: [{ generatedImageUrl: IMG }] }),
  camp('meta-pub', 'Meta — published paused', 'meta', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, metaAds: { budget: 20 }, visualConcepts: [{ generatedImageUrl: IMG }] }, { status: 'published', providerStatus: 'paused', platformCampaignId: '9001', publishedAt: iso(-60000) }),
  camp('meta-failed', 'Meta — earlier publish failed', 'meta', { strategy: { goal: 'Traffic', landingPageUrl: URL1 }, metaAds: { budget: 20 }, visualConcepts: [{ generatedImageUrl: IMG }], spec: { overrides: { specialAdCategories: [] } } }, { status: 'failed', failureReason: 'Meta rejected the ad set.' }),
];

// ── Fake backend deps (shapes of the real server.js helpers) ────────
const st = {
  user: 'mock-launch', metaPage: 'pg1', setup: {}, pinFound: [], metaFound: [], pinAdsFail: false, archiveFail: false, specDelay: 0, specFailFor: null,
  pinPosts: 0, publishReqs: [],
};
const SETUP_OK = { connected: true, ready: true, state: 'ready', steps: { account: { status: 'complete' }, assets: { status: 'complete' } } };
['meta', 'google', 'tiktok', 'pinterest'].forEach((p) => { st.setup[p] = JSON.parse(JSON.stringify(SETUP_OK)); });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith(BASE)) return realFetch(url, opts);
  if (/tiktok\.mock/.test(u)) return new Response(JSON.stringify({ code: 0, data: { list: [{ currency: 'EUR' }] } }), { status: 200, headers: { 'content-type': 'application/json' } });
  throw new Error('unexpected outbound request ' + u);
};
const table = (t) => { const q = { select() { return q; }, update() { return q; }, eq() { return q; }, in() { return q; },
  maybeSingle: async () => ({ data: t === 'business_profile' ? { company_name: 'Linnen & Co', website: 'linnenco.example', country: 'Netherlands', logo_url: 'https://cdn.example.invalid/logo.png' } : t === 'profiles' ? { preferences: {} } : null, error: null }),
  then: (r) => r({ data: null, error: null }) }; return q; };
const store = PL.memoryStore();
const locks = new Map();
const deps = {
  requireSubOrFreeStrict: (q, r, n) => n(),
  getUserFromToken: async (q) => ((q.headers.authorization || '') === 'Bearer mock-token' ? { id: st.user } : null),
  supabaseAdmin: { from: table },
  getMetaAccess: async () => ({ accessToken: 'MTOKEN', accountId: 'act_1', accountName: 'Linnen Meta', pageId: st.metaPage }),
  metaFetch: async (p) => {
    if (p === '/act_1') return { currency: 'EUR' };
    if (p === '/act_1/adspixels') return { data: [{ id: 'px1', name: 'Shop' }] };
    if (p === '/pg1') return { instagram_business_account: { id: 'ig1', username: 'linnen' } };
    if (p === '/act_1/campaigns') return { data: st.metaFound };
    throw new Error('unexpected meta GET ' + p);
  },
  META_GRAPH: 'https://graph.mock/v25.0',
  getGadsAccess: async () => ({ accessToken: 'GTOKEN', customerId: '123', accountName: 'Linnen Google', loginCustomerId: null }),
  gadsQuery: async (t, c, q) => (/FROM customer/.test(q) ? [{ customer: { currencyCode: 'EUR' } }] : /conversion_action/.test(q) ? [{}] : []),
  gadsResolveBudgetName: async () => ({ action: 'create', name: 'x' }), extractGadsPolicyFindings: () => [], GOOGLE_ADS_DEVELOPER_TOKEN: 'dev',
  getTikTokAccess: async () => ({ accessToken: 'TTOKEN', advertiserId: 'adv1', accountName: 'Linnen TikTok', identityId: 'id1', identityType: 'TT_USER', identityName: 'linnen' }),
  tiktokPost: async () => ({}), tiktokGet: async () => ({ list: [] }), TIKTOK_API: 'https://tiktok.mock/open_api/v1.3',
  getPinterestAccess: async () => ({ accessToken: 'PTOKEN', adAccountId: 'pa1', accountName: 'Linnen Pins' }),
  pinterestApiRequest: async (t, m, p) => {
    if (m === 'GET' && p === '/ad_accounts/pa1') return { currency: 'EUR' };
    if (m === 'GET' && /conversion_tags$/.test(p)) return { items: [] };
    if (m === 'GET' && /\/campaigns\?/.test(p)) return { items: st.pinFound };
    if (m === 'POST' && /\/campaigns$/.test(p)) { st.pinPosts++; return { id: 'pc' + st.pinPosts }; }
    if (m === 'POST' && /\/ad_groups$/.test(p)) return { id: 'pg' + st.pinPosts };
    if (m === 'POST' && /\/ads$/.test(p)) { if (st.pinAdsFail) throw Object.assign(new Error('Pinterest rejected the ad (mock)'), { status: 400 }); return { id: 'pa' + st.pinPosts }; }
    if (m === 'DELETE') { if (st.archiveFail) throw new Error('mock delete failed'); return {}; }
    return {};
  },
  pinterestGetOrCreateAdsBoard: async () => 'board1', pinterestCreateImagePin: async () => 'pin' + (st.pinPosts + 1), pinterestCreateVideoPin: async () => 'vpin',
  pinterestArchiveEntities: async () => { if (st.archiveFail) throw new Error('mock archive failed'); },
  acquirePublishLock: (u, p, c) => { const k = u + '|' + p + '|' + c; if (locks.has(k)) return null; locks.set(k, 1); return k; },
  releasePublishLock: (k) => locks.delete(k),
  logCampaignEvent: () => {},
  publishLedger: PL.createLedger({ store }),
};
const app = express();
// The page calls the dev API origin (rewritten to here): answer CORS like the real backend.
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json({ limit: '10mb' }));
app.use((q, r, n) => { if (/^\/api\/publish\/[a-z]+$/.test(q.path)) st.publishReqs.push({ path: q.path, campId: q.body && q.body.campId, opId: q.body && q.body.opId }); n(); });
// Spec delay / failure switches for the loading + unavailable states.
app.use('/api/campaigns/spec', async (q, r, n) => {
  if (st.specDelay) await new Promise((x) => setTimeout(x, st.specDelay));
  if (st.specFailFor && q.body && q.body.campId === st.specFailFor) return r.status(500).json({ error: 'Could not check this campaign right now.' });
  n();
});
require(path.join(BE, 'routes', 'publishRoutes'))(app, deps);
app.get(/^\/api\/setup\/(meta|google|tiktok|pinterest)\/status$/, (q, r) => r.json(st.setup[q.params[0]]));
app.get(/^\/api\/(meta|google|tiktok|pinterest)\/status$/, (q, r) => r.json({ connected: !!st.setup[q.params[0]].connected, active_ad_account: { account_id: 'acc-' + q.params[0], account_name: 'Main ' + q.params[0], currency: 'EUR' } }));
app.get('/api/business/profile', (q, r) => r.json({ profile: { company_name: 'Linnen & Co', country: 'Netherlands', website: 'linnenco.example' } }));
app.get('/api/campaigns', (q, r) => r.json({ campaigns: [] }));
app.get('/api/credits/status', (q, r) => r.json({ balance: 1000, plan: 'starter' }));
app.all(/^\/api\//, (q, r) => r.json({}));
app.get('/', (q, r) => r.redirect('/app.html'));
app.use(express.static(ROOT));

async function boot(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Network fence: the page may reach ONLY this test server. The app's API
  // base in dev is http://localhost:5500 — a real backend may be running
  // there, so those calls are rewritten to this process, and every other
  // host (Supabase, CDNs, providers, analytics) is aborted.
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(BASE + '/')) return r.continue();
    if (u.startsWith(DEV_API + '/')) return r.continue({ url: BASE + u.slice(DEV_API.length) });
    if (u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    // Static libraries only (GET): the Supabase JS SDK file itself, fonts, jszip.
    if (r.request().method() === 'GET' && /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return r.continue();
    blocked.push(u.split('?')[0]);
    return r.abort();
  });
  await page.addInitScript(({ camps }) => {
    try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('oriven_campaigns_mock-launch', JSON.stringify(camps)); sessionStorage.setItem('seeded', '1'); } } catch (_) {}
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); });
  }, { camps: CAMPS });
  await signIn(page, 'mock-launch');
  return { ctx, page, errors };
}
async function signIn(page, uid) {
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate((u) => {
    window._getAccessToken = async () => 'mock-token';
    window._apiToken = 'mock-token';
    if (window.orvTour) { window.orvTour.open = function () {}; try { window.orvTour.close(); } catch (_) {} }
    window._dbSubscriptionStatus = 'starter';
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: u, email: u + '@example.invalid' });
  }, uid);
  await page.evaluate(() => { window.__ln = { id: null, at: performance.now() }; setInterval(function () { var a = document.querySelector('.page.active'); var id = a && a.id; if (id !== window.__ln.id) window.__ln = { id: id, at: performance.now() }; }, 100); });
  for (let i = 0; i < 150; i++) { await page.waitForTimeout(200); if (await page.evaluate(() => performance.now() - window.__ln.at > 3000 && performance.now() > 8500)) break; }
}
async function goLaunch(page) {
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => { if (window.orvTour) { try { window.orvTour.close(); } catch (_) {} } document.querySelectorAll('#orvConsentBanner').forEach((e) => e.remove()); _orvNav('launch', 'page-launch'); });
    await page.waitForTimeout(600);
    if (await page.evaluate(() => document.querySelector('.page.active').id === 'page-launch')) return true;
  }
  return false;
}
const settle = (page, ms) => page.waitForTimeout(ms || 900);
async function cards(page, p) {
  await page.evaluate((x) => _launchSetPlatformFilter(x), p);
  await settle(page, 1100);
  return page.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('#launchGrid .lq-card')).map((c) => [c.getAttribute('data-camp-id'), c.querySelector('.lq-readiness').innerText])));
}
async function popup(page, id) {
  await page.evaluate((x) => { var c = _orvGetCampaigns().filter((y) => y.id === x)[0]; _launchSetPlatformFilter(c.platform); }, id);
  await settle(page, 300);
  await page.click('.lq-card[data-camp-id="' + id + '"]');
  await settle(page, 1300);
  return page.evaluate(() => ({
    state: (document.querySelector('#lqControlCol .lqc-state-label') || {}).innerText,
    meta: (document.querySelector('#lqControlCol .lqc-meta') || {}).innerText,
    banner: (document.querySelector('#lqControlCol .lqc-pub') || {}).innerText || null,
    checks: Array.from(document.querySelectorAll('#lqcChecks .lqc-check')).map((b) => ({ key: b.getAttribute('data-key'), label: b.querySelector('.lqc-check-label').innerText, status: b.className.replace(/.*lqc-check-([a-z_]+).*/, '$1') })),
    actions: Array.from(document.querySelectorAll('#lqcActionRow button')).map((b) => (b.disabled ? '[disabled] ' : '') + b.innerText),
    card: (document.querySelector('.lq-card[aria-pressed="true"] .lq-readiness') || {}).innerText,
  }));
}
async function closePopup(page) { await page.keyboard.press('Escape'); await settle(page, 200); }
async function detail(page, key) {
  await page.click('#lqcChecks .lqc-check[data-key="' + key + '"]');
  await settle(page, 150);
  return page.evaluate(() => (document.getElementById('lqcCheckDetail') || {}).innerText || '');
}
async function workspace(page, id) {
  await page.evaluate((x) => { try { _lqCloseModal(); } catch (_) {} _launchOpenControl(x); }, id);
  await settle(page, 1400);
  return page.evaluate(() => ({ btn: document.getElementById('lcLaunchBtn').innerText, disabled: document.getElementById('lcLaunchBtn').disabled, state: document.getElementById('lcLaunchState').innerText.replace(/\s+/g, ' '),
    snapshot: document.getElementById('lcSnapshot').innerText.replace(/\s+/g, ' '), preview: document.getElementById('lcAdPreview').innerHTML.slice(0, 400) }));
}
const local = (page, id) => page.evaluate((x) => { var c = _orvGetCampaigns().filter((y) => y.id === x)[0]; return c ? { status: c.status, providerStatus: c.providerStatus || null, platformCampaignId: c.platformCampaignId || null, destinationAccountId: c.destinationAccountId || null, destinationAccountName: c.destinationAccountName || null, failureReason: c.failureReason || null, publishOp: c.publishOp || null } : null; }, id);
async function publishFromWorkspace(page, id) {
  await workspace(page, id);
  await page.evaluate(() => _launchDeploy());
  const btn = page.locator('button', { hasText: 'Publish paused campaign' });
  await btn.first().waitFor({ timeout: 8000 });
  for (let i = 0; i < 40 && await btn.first().isDisabled(); i++) await settle(page, 150);
  await btn.first().click();
  await settle(page, 1500);
  return page.evaluate(() => document.getElementById('lcDeployPanel').innerText.replace(/\s+/g, ' '));
}

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch();
  try {
    const { ctx, page, errors } = await boot(browser);
    check('Launch opens', await goLaunch(page));
    if (false && process.env.DBG) { console.log('DBG', JSON.stringify(await page.evaluate(() => Promise.all([apiFetch('/api/setup/meta/status'), apiFetch('/api/campaigns/spec', { method: 'POST', body: JSON.stringify({ pkg: _orvGetCampaigns()[0].pkg, platform: 'meta', campId: 'x' }) })]).then((rs) => rs.map((r) => ({ s: r.status, ok: r.ok, d: JSON.stringify(r.data || r.error || null).slice(0, 200) }))).catch((e) => String(e)))), JSON.stringify(blocked.slice(0, 10))); }

    // ── VALIDATION: cards, popup and workspace agree ───────────────
    const meta = await cards(page, 'meta'), google = await cards(page, 'google'), tiktok = await cards(page, 'tiktok'), pin = await cards(page, 'pinterest');
    check('valid Meta campaign → READY TO LAUNCH', meta['meta-ok'] === 'READY TO LAUNCH', meta);
    check('valid Google Search campaign → READY TO LAUNCH', google['google-ok'] === 'READY TO LAUNCH', google);
    check('TikTok video from Create 2.0 (no separate image) → READY TO LAUNCH (was BLOCKED)', tiktok['tiktok-video'] === 'READY TO LAUNCH', tiktok);
    check('valid Pinterest campaign → READY TO LAUNCH', pin['pin-ok'] === 'READY TO LAUNCH', pin);
    check('Google Search without keywords → BLOCKED (was READY)', google['google-nokw'] === 'BLOCKED', google);
    check('Google headlines over 30 chars (only 1 usable) → BLOCKED', google['google-longh'] === 'BLOCKED', google);
    check('Google numeric budget (an AI suggestion) → BLOCKED until confirmed (was READY)', google['google-numbud'] === 'BLOCKED', google);
    check('Meta legacy objective → READY WITH WARNINGS (warning no longer dropped)', meta['meta-legacy'] === 'READY WITH WARNINGS', meta);
    check('published (paused) campaign card → PUBLISHED · PAUSED, not LIVE', meta['meta-pub'] === 'PUBLISHED · PAUSED', meta);
    check('failed campaign stays in Launch → PUBLISH FAILED (used to vanish)', meta['meta-failed'] === 'PUBLISH FAILED', meta);

    let p = await popup(page, 'google-nokw');
    check('popup agrees with card (BLOCKED) and names Keywords & extensions', p.state === 'BLOCKED' && p.card === 'BLOCKED' && p.checks.some((c) => c.key === 'keywords' && c.status === 'blocked'), p);
    check('Google Search popup: "Text ads", no "Images"; keyword + copy rows; no Meta-only rows', /Text ads/.test(p.meta) && !/Images/.test(p.meta) && p.checks.some((c) => c.key === 'copy') && !p.checks.some((c) => c.key === 'compliance' || c.key === 'identity'), p);
    let d = await detail(page, 'keywords');
    check('blocked row explains the server error and offers the fix', /no keywords/i.test(d) && /Edit copy/.test(d), d);
    await closePopup(page);
    check('modal closes on Escape and focus returns to the campaign card', await page.evaluate(() => document.getElementById('lqModalOverlay').style.display === 'none' && document.activeElement && document.activeElement.getAttribute('data-camp-id') === 'google-nokw'));
    p = await popup(page, 'google-longh');
    d = await detail(page, 'copy');
    check('long headlines: Ad copy blocked with the 30-character rule', p.checks.some((c) => c.key === 'copy' && c.status === 'blocked') && /30 characters/.test(d), { p, d });
    await closePopup(page);
    p = await popup(page, 'google-numbud');
    d = await detail(page, 'budget');
    check('numeric Google budget: Budget blocked, "Confirm the daily budget"', /Confirm the daily budget/.test(d) && p.actions[0] === 'Set budget', { d, actions: p.actions });
    await closePopup(page);
    p = await popup(page, 'tiktok-video');
    d = await detail(page, 'creative');
    check('TikTok popup: Video format, creative passes with the cover-frame note, identity row once', /Video/.test(p.meta) && p.checks.find((c) => c.key === 'creative').status === 'pass' && /frame of the video/.test(d) && p.checks.filter((c) => c.key === 'identity').length === 1 && !p.checks.some((c) => c.key === 'keywords' || c.key === 'compliance'), { p, d });
    await page.screenshot({ path: path.join(SHOT_DIR, 'popup-tiktok.png') });
    await closePopup(page);
    p = await popup(page, 'meta-legacy');
    d = await detail(page, 'campaign');
    check('Meta popup: objective warning shown on Campaign & format; one Facebook Page row; compliance present', /Engagement/.test(d) && p.checks.filter((c) => c.key === 'identity').length === 1 && p.checks.find((c) => c.key === 'identity').label === 'Facebook Page' && p.checks.some((c) => c.key === 'compliance'), { p, d });
    await closePopup(page);
    p = await popup(page, 'pin-ok');
    check('Pinterest popup: Pinterest rows only (no Meta/TikTok identity, no keywords)', p.state === 'READY TO LAUNCH' && !p.checks.some((c) => ['identity', 'compliance', 'keywords'].includes(c.key)), p);
    await closePopup(page);

    // Workspace: snapshot from the spec, no invented default, video preview.
    let w = await workspace(page, 'tiktok-video');
    check('workspace (TikTok video): button enabled, video preview, spec snapshot (30 EUR, structure, paused schedule)', !w.disabled && w.btn === 'Launch Campaign' && /<video/.test(w.preview) && /30 EUR \/ day/.test(w.snapshot) && /1 ad group/.test(w.snapshot) && /Created paused/.test(w.snapshot), w);
    w = await workspace(page, 'google-numbud');
    check('workspace (numeric budget): no fake default budget, button disabled', /Not set — required/.test(w.snapshot) && /AI suggested 25/.test(w.snapshot) && w.disabled && !/Default/.test(w.snapshot), w);
    await page.evaluate(() => _launchBackToSelect());

    // Platform setup incomplete → card agrees with popup.
    st.setup.pinterest = { connected: false, ready: false, state: 'not_connected', steps: {} };
    await page.evaluate(() => { orvLaunch.setup('pinterest', true); });
    await settle(page, 600);
    let pc = await cards(page, 'pinterest');
    p = await popup(page, 'pin-ok');
    check('platform not connected → card AND popup BLOCKED (they used to disagree)', pc['pin-ok'] === 'BLOCKED' && p.state === 'BLOCKED' && p.checks.find((c) => c.key === 'connection').status === 'blocked' && p.actions[0] === 'Connect Pinterest Ads', { pc, p });
    await closePopup(page);
    st.setup.pinterest = JSON.parse(JSON.stringify(SETUP_OK));
    await page.evaluate(() => { orvLaunch.setup('pinterest', true); });
    await settle(page, 600);

    // Loading → Checking, never Ready.
    st.specDelay = 2500;
    await page.evaluate(() => { var c = _orvGetCampaigns().filter((x) => x.id === 'meta-ok')[0]; c.pkg.metaAds.headline = 'Changed'; _saveCamps(); });
    await page.evaluate(() => _launchSetPlatformFilter('meta'));
    await settle(page, 400);
    const loading = await page.evaluate(() => document.querySelector('.lq-card[data-camp-id="meta-ok"] .lq-readiness').innerText);
    w = await workspace(page, 'meta-ok');
    check('while the server check runs: card CHECKING…, workspace button disabled "Checking…"', loading === 'CHECKING…' && w.disabled && w.btn === 'Checking…', { loading, w });
    st.specDelay = 0;
    await settle(page, 2600);
    w = await page.evaluate(() => ({ btn: document.getElementById('lcLaunchBtn').innerText, disabled: document.getElementById('lcLaunchBtn').disabled }));
    check('when the answer arrives the workspace updates by itself (no re-render needed)', w.btn === 'Launch Campaign' && !w.disabled, w);
    await page.evaluate(() => _launchBackToSelect());

    // Unavailable → CAN'T CHECK + Try again, never Ready.
    st.specFailFor = 'pin-two';
    await page.evaluate(() => { var c = _orvGetCampaigns().filter((x) => x.id === 'pin-two')[0]; c.pkg.pinterestAds.description = 'v2'; _saveCamps(); });
    pc = await cards(page, 'pinterest');
    p = await popup(page, 'pin-two');
    check('server check unavailable → CAN’T CHECK on card and popup, with Try again', pc['pin-two'] === 'CAN’T CHECK' && p.state === 'CAN’T CHECK' && p.actions[0] === 'Try again', { pc, p });
    st.specFailFor = null;
    await page.click('#lqcActionRow button:first-child');
    await settle(page, 1500);
    p = await page.evaluate(() => document.querySelector('#lqControlCol .lqc-state-label').innerText);
    check('Try again re-checks and the popup updates to READY', p === 'READY TO LAUNCH', p);
    await closePopup(page);

    // Previously blocked, fixed in Connections, no reload.
    st.metaPage = null;
    st.setup.meta.steps.assets = { status: 'action_required', reason: 'Select a Facebook Page to publish ads as.' };
    await page.evaluate(() => { OrivenSpec.invalidatePlatform('meta'); orvLaunch.setup('meta', true); });
    await settle(page, 400);
    let mc = await cards(page, 'meta');
    p = await popup(page, 'meta-ok');
    check('Facebook Page missing → BLOCKED with one Facebook Page row (no duplicate Page/Identity)', mc['meta-ok'] === 'BLOCKED' && p.checks.filter((c) => c.key === 'identity').length === 1 && p.checks.find((c) => c.key === 'identity').status === 'blocked', { mc, p });
    await closePopup(page);
    st.metaPage = 'pg1';
    st.setup.meta = JSON.parse(JSON.stringify(SETUP_OK)); // user selects the Page in Connections
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await settle(page, 1800);
    mc = await cards(page, 'meta');
    check('after the Page is selected: READY again without a page reload (stale block fixed)', mc['meta-ok'] === 'READY TO LAUNCH', mc);

    // Popup for a published campaign.
    p = await popup(page, 'meta-pub');
    check('published-paused popup: "PUBLISHED · PAUSED", Activate offered, no Pause', p.state === 'PUBLISHED · PAUSED' && p.actions.includes('Activate campaign') && !p.actions.includes('Pause campaign'), p);
    await closePopup(page);
    p = await popup(page, 'meta-failed');
    check('failed campaign popup: failure banner + readiness, can publish again', /Last publish failed/.test(p.banner || '') && p.state === 'READY TO LAUNCH' && p.actions[0] === 'Continue to Launch →', p);
    await closePopup(page);

    // ── PUBLISHING ────────────────────────────────────────────────
    st.publishReqs = []; st.pinPosts = 0;
    let panel = await publishFromWorkspace(page, 'pin-ok');
    let L = await local(page, 'pin-ok');
    check('normal publish → "Published — Paused", server ad account recorded (not a client value)', /Published — Paused/.test(panel) && /Linnen Pins/.test(panel) && L.status === 'published' && L.providerStatus === 'paused' && L.destinationAccountId === 'pa1' && L.destinationAccountName === 'Linnen Pins' && !!L.platformCampaignId, { panel, L });
    check('one request carried a stable attempt id', st.publishReqs.length === 1 && /^op_/.test(st.publishReqs[0].opId || ''), st.publishReqs);
    await page.click('button:has-text("Open in Campaigns")');
    await settle(page, 1200);
    const nav = await page.evaluate(() => ({ page: document.querySelector('.page.active').id, side: (document.querySelector('.orv-sb .orv-ni.orv-active') || {}).getAttribute && document.querySelector('.orv-sb .orv-ni.orv-active').getAttribute('data-orv-page') }));
    check('"Open in Campaigns" → the current Campaigns page with the sidebar on Campaigns (was the old hub)', nav.page === 'page-performance' && nav.side === 'performance', nav);
    await goLaunch(page);
    pc = await cards(page, 'pinterest');
    check('after publish the card says PUBLISHED · PAUSED', pc['pin-ok'] === 'PUBLISHED · PAUSED', pc);

    // Duplicate request after success (another device still has it as a draft).
    await page.evaluate(() => { var c = _orvGetCampaigns().filter((x) => x.id === 'pin-ok')[0]; c.status = 'draft'; delete c.platformCampaignId; delete c.providerStatus; _saveCamps(); renderLaunchPage(); });
    await settle(page, 900);
    const postsBefore = st.pinPosts;
    await workspace(page, 'pin-ok');
    await page.evaluate(() => _launchDeploy());
    await settle(page, 1800);
    const dlg = await page.evaluate(() => { const x = Array.from(document.querySelectorAll('[role="alertdialog"], [role="dialog"]')).filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => e.innerText).filter((t) => /Publish to/.test(t)).join(' '); return x.replace(/\s+/g, ' ').slice(0, 500); });
    const pubDisabled = await page.locator('button', { hasText: 'Publish paused campaign' }).first().isDisabled().catch(() => null);
    check('confirm dialog refuses a second publish of an already-published campaign', /already published/i.test(dlg) && pubDisabled === true, { dlg, pubDisabled });
    await page.keyboard.press('Escape'); await settle(page, 300);
    // Even sent directly, the server refuses and the record is repaired.
    const direct = await page.evaluate(() => apiFetch('/api/publish/pinterest', { method: 'POST', body: JSON.stringify({ campId: 'pin-ok', pkg: _orvGetCampaigns().filter((x) => x.id === 'pin-ok')[0].pkg, opId: 'op_dup' }) }).then((r) => { var o = window._orvApplyPublishResult('pin-ok', 'pinterest', r, null); return { status: r.status, code: r.data && r.data.code, kind: o.kind }; }));
    L = await local(page, 'pin-ok');
    check('duplicate request after success → 409 ALREADY_PUBLISHED, nothing created, local record back to published', direct.status === 409 && direct.code === 'ALREADY_PUBLISHED' && direct.kind === 'already' && st.pinPosts === postsBefore && L.status === 'published' && !!L.platformCampaignId, { direct, L });
    await page.evaluate(() => { _launchDeployReset(); _launchBackToSelect(); });

    // Double click + concurrent requests.
    st.publishReqs = [];
    await workspace(page, 'pin-two');
    await page.evaluate(() => { _launchDeploy(); _launchDeploy(); });
    const b2 = page.locator('button', { hasText: 'Publish paused campaign' });
    await b2.first().waitFor({ timeout: 8000 });
    for (let i = 0; i < 40 && await b2.first().isDisabled(); i++) await settle(page, 150);
    await b2.first().click(); await b2.first().click({ timeout: 300 }).catch(() => {});
    await settle(page, 1500);
    check('double click → exactly one publish request', st.publishReqs.filter((x) => x.campId === 'pin-two').length === 1, st.publishReqs);
    const conc = await page.evaluate(() => { var pkg = _orvGetCampaigns().filter((x) => x.id === 'pin-three')[0].pkg; return Promise.all([1, 2, 3].map(() => apiFetch('/api/publish/pinterest', { method: 'POST', body: JSON.stringify({ campId: 'pin-three', pkg: pkg, opId: 'op_c' }) }).then((r) => r.status))); });
    check('three concurrent requests for one campaign → one 200, the rest 409', conc.filter((x) => x === 200).length === 1 && conc.filter((x) => x === 409).length === 2, conc);
    await page.evaluate(() => { _launchDeployReset(); _launchBackToSelect(); });

    // Proxy timeout: the server finishes, the browser gets a 504.
    await page.route(DEV_API + '/api/publish/pinterest', async (route) => { const resp = await route.fetch({ url: BASE + '/api/publish/pinterest' }); await resp.text(); await route.fulfill({ status: 504, contentType: 'text/html', body: '<html>Gateway Timeout</html>' }); });
    panel = await publishFromWorkspace(page, 'pin-four');
    L = await local(page, 'pin-four');
    const retryBtn = await page.evaluate(() => Array.from(document.querySelectorAll('#lcDeployPanel button')).map((b) => b.innerText));
    check('504 → "Publishing result not confirmed", NO retry button, only Check status', /Publishing result not confirmed/.test(panel) && !retryBtn.some((t) => /Try again|Retry/.test(t)) && retryBtn.includes('Check status'), { panel, retryBtn });
    check('504 → local record kept as publishing/unconfirmed (not draft, not failed)', L.status === 'publishing' && L.publishOp && L.publishOp.state === 'unconfirmed', L);
    await page.unroute(DEV_API + '/api/publish/pinterest');
    await page.screenshot({ path: path.join(SHOT_DIR, 'unconfirmed.png') });
    await page.evaluate(() => { _launchDeployReset(); _launchBackToSelect(); });
    // Browser refresh keeps it.
    await signIn(page, 'mock-launch');
    await goLaunch(page);
    pc = await cards(page, 'pinterest');
    p = await popup(page, 'pin-four');
    check('after a browser refresh: card NOT CONFIRMED, popup offers "Check publishing status"', pc['pin-four'] === 'NOT CONFIRMED' && /not confirmed/i.test(p.banner || '') && p.actions[0] === 'Check publishing status', { pc, p });
    await page.click('#lqcActionRow button:first-child');
    await settle(page, 1500);
    L = await local(page, 'pin-four');
    check('Check status → the server had finished: recorded as published with its id and account', L.status === 'published' && !!L.platformCampaignId && L.destinationAccountId === 'pa1', L);
    await page.evaluate(() => { try { _lqCloseModal(); } catch (_) {} _launchDeployReset(); });

    // Server restart mid-publish: stale ledger row, nothing on the platform.
    store.rows.push({ id: 'stale-x', user_id: 'mock-launch', platform: 'meta', client_ref_id: 'meta-legacy', op_id: 'op_old', state: 'publishing', campaign_name: 'Meta — legacy Engagement', external_account_id: 'act_1', started_at: iso(-15 * 60000), updated_at: iso(-15 * 60000) });
    await page.evaluate(() => { var c = _orvGetCampaigns().filter((x) => x.id === 'meta-legacy')[0]; c.status = 'publishing'; c.publishOp = { id: 'op_old', state: 'sending', prevStatus: 'draft' }; _saveCamps(); renderLaunchPage(); });
    mc = await cards(page, 'meta');
    check('interrupted publish (restart) → NOT CONFIRMED, never auto-retried', mc['meta-legacy'] === 'NOT CONFIRMED', mc);
    st.metaFound = [];
    const reqsBefore = st.publishReqs.length;
    await page.evaluate(() => _launchCheckPublishStatus('meta-legacy'));
    await settle(page, 1500);
    L = await local(page, 'meta-legacy');
    check('Check status → platform has no such campaign → failed (safe), nothing re-sent', L.status === 'failed' && /no campaign named/.test(L.failureReason || '') && st.publishReqs.length === reqsBefore, L);
    mc = await cards(page, 'meta');
    check('…and it can be published again from Launch', mc['meta-legacy'] === 'PUBLISH FAILED' && (await popup(page, 'meta-legacy')).actions[0] === 'Continue to Launch →', mc);
    await closePopup(page);

    // Partial provider success + rollback failure.
    st.pinAdsFail = true; st.archiveFail = true;
    await page.evaluate(() => { var list = _orvGetCampaigns(); var c = JSON.parse(JSON.stringify(list.filter((x) => x.id === 'pin-two')[0])); c.id = 'pin-five'; c.name = 'Pinterest — fifth'; c.pkg.campaignName = c.name; c.status = 'draft'; delete c.platformCampaignId; delete c.providerStatus; window._orvStoreCampaign(c); renderLaunchPage(); });
    await settle(page, 800);
    await cards(page, 'pinterest');
    panel = await publishFromWorkspace(page, 'pin-five');
    L = await local(page, 'pin-five');
    check('partial failure with failed rollback → "didn’t accept", leftovers reported, Try again offered', /didn’t accept/.test(panel) && /couldn’t be removed/.test(panel) && /Try again/.test(panel), panel);
    check('…local record is PUBLISH FAILED with the reason (still in Launch)', L.status === 'failed' && /couldn’t be removed/.test(L.failureReason || ''), L);
    st.pinAdsFail = false; st.archiveFail = false;
    await page.evaluate(() => { _launchDeployReset(); _launchBackToSelect(); });

    // ── NAVIGATION ────────────────────────────────────────────────
    await page.evaluate(() => { _orvNav('businessbrain', 'page-business-brain'); });
    await settle(page, 1800);
    const row = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('#owNeeds .ccx-nrow')).find((b) => /fifth/.test(b.innerText) && /failed/i.test(b.innerText)); if (!r) return null; const t = r.innerText.replace(/\s+/g, ' '); r.click(); return t; });
    await settle(page, 1600);
    const sel = await page.evaluate(() => ({ page: document.querySelector('.page.active').id, selected: (document.querySelector('.lq-card[aria-pressed="true"]') || {}).getAttribute && document.querySelector('.lq-card[aria-pressed="true"]').getAttribute('data-camp-id') }));
    check('Control Center "publish failed" → Launch with that campaign selected (was a dead end)', !!row && sel.page === 'page-launch' && sel.selected === 'pin-five', { row, sel });
    await page.evaluate(() => { try { _lqCloseModal(); } catch (_) {} orvWorkspace.go({ page: 'launch', campaignId: 'google-ok' }); });
    await settle(page, 1500);
    const fromCreate = await page.evaluate(() => (document.querySelector('.lq-card[aria-pressed="true"]') || {}).getAttribute && document.querySelector('.lq-card[aria-pressed="true"]').getAttribute('data-camp-id'));
    check('Create → Launch handoff selects the campaign on its platform', fromCreate === 'google-ok', fromCreate);
    await page.evaluate(() => { try { _lqCloseModal(); } catch (_) {} });

    // ── RESPONSIVENESS ────────────────────────────────────────────
    for (const wdt of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width: wdt, height: wdt === 390 ? 844 : 900 });
      await settle(page, 300);
      await popup(page, 'tiktok-video');
      const g = await page.evaluate(() => { const ov = document.getElementById('lqModalOverlay'); const card = ov.firstElementChild.getBoundingClientRect(); const over = Array.from(ov.querySelectorAll('*')).filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1; }).length; return { sw: document.documentElement.scrollWidth, iw: innerWidth, fits: card.right <= innerWidth + 1 && card.left >= -1, over, scroll: getComputedStyle(ov.firstElementChild).overflowY }; });
      check(wdt + 'px: popup fits, no horizontal overflow', g.sw <= g.iw + 1 && g.fits && !g.over, g);
      await page.screenshot({ path: path.join(SHOT_DIR, 'popup-' + wdt + '.png') });
      await closePopup(page);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // ── ACCOUNT SWITCH: nothing carries over ──────────────────────
    await page.evaluate(() => { try { _lqCloseModal(); } catch (_) {} orvWorkspace.reset(); });
    st.user = 'mock-other';
    await page.evaluate(() => { localStorage.setItem('oriven_campaigns_mock-other', JSON.stringify([])); });
    await signIn(page, 'mock-other');
    await goLaunch(page);
    const other = await page.evaluate(() => ({ cards: document.querySelectorAll('#launchGrid .lq-card').length, cached: OrivenSpec.peek({ id: 'meta-ok' }) }));
    check('account switch: no campaigns or cached readiness from the previous account', other.cards === 0 && !other.cached, other);
    const st2 = await page.evaluate(() => apiFetch('/api/publish/pinterest/status', { method: 'POST', body: JSON.stringify({ campId: 'pin-ok' }) }).then((r) => r.data && r.data.publish && r.data.publish.state));
    check('cross-account: the other user can’t see the first user’s publish record', st2 === 'none', st2);

    const real = errors.filter((e) => !/supabase|Failed to fetch/i.test(e));
    check('no page errors', !real.length, real);
    check('network fence held: no request reached any host but this test server', !blocked.some((u) => /localhost:5500|onrender|orivenai\.com\/api/.test(u)), Array.from(new Set(blocked)).slice(0, 8));
    await ctx.close();
  } catch (e) { fail++; console.log('FAIL — test crashed | ' + (e && e.stack || e)); }
  await browser.close(); server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + SHOT_DIR);
  process.exit(fail ? 1 : 0);
});
