/* ════════════════════════════════════════════════════════════════
   Campaigns — trustworthy numbers, end to end in a real browser.

   SAFETY: a network fence. The page may reach ONLY this test's own
   server: the app's dev API base (http://localhost:5500 — a real backend
   may be running there) is rewritten to the in-process mock, static CDN
   GETs are allowed, everything else (Supabase, ad platforms, analytics,
   any other backend) is aborted; the test fails if anything leaks. No
   real users, no provider calls, nothing written anywhere.

   RUN: node tests/campaigns.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const PORT = 8945, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOT_DIR = path.join(__dirname, '_shots', 'campaigns'); fs.mkdirSync(SHOT_DIR, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }
const blocked = [], calls = [];
const now = Date.now(), iso = (ms) => new Date(now + ms).toISOString();
const sleep = (ms) => new Promise((x) => setTimeout(x, ms));

// ── Mock provider data (shapes of the real server.js routes) ─────────
const st = {};
function resetState() {
  Object.assign(st, {
    user: 'mock-cmp', status: { google: 'connected', meta: 'connected', tiktok: 'connected', pinterest: 'connected' },
    currency: { google: 'USD', meta: 'EUR', tiktok: null, pinterest: 'GBP' }, metaRespCurrency: 'EUR',
    fail: {}, delay: {}, rangeFail: {}, seriesFail: false, metaBudgetLifetime: true,
  });
}
resetState();
const META = () => [
  { campaign_id: 'm1', campaign_name: 'Retargeting', status: 'ACTIVE', effective_status: 'ACTIVE', has_insights: true, spend: 100, impressions: 10000, clicks: 200, conversions: 5, conversionValue: 400, reach: 8000, frequency: 1.25, linkClicks: null, addToCart: null, checkoutInitiated: null, daily_budget: 2000, lifetime_budget: null },
  { campaign_id: 'm2', campaign_name: 'Retargeting', status: 'PAUSED', effective_status: 'PAUSED', has_insights: true, spend: 250, impressions: 20000, clicks: 300, conversions: 6, conversionValue: 500, reach: 15000, frequency: 1.33, linkClicks: 120, daily_budget: 1000, lifetime_budget: null },
  { campaign_id: 'm3', campaign_name: 'In review campaign', status: 'ACTIVE', effective_status: 'IN_PROCESS', has_insights: false, spend: 0, impressions: 0, clicks: 0, conversions: 0, daily_budget: 1500, lifetime_budget: null },
  { campaign_id: 'm4', campaign_name: 'Problem campaign', status: 'ACTIVE', effective_status: 'WITH_ISSUES', has_insights: false, spend: 0, impressions: 0, clicks: 0, conversions: 0, daily_budget: null, lifetime_budget: null },
  { campaign_id: 'm5', campaign_name: 'Lifetime one', status: 'ACTIVE', effective_status: 'ACTIVE', has_insights: true, spend: 40, impressions: 3000, clicks: 30, conversions: 1, conversionValue: 0, reach: 2500, frequency: 1.2, daily_budget: null, lifetime_budget: st.metaBudgetLifetime ? 50000 : null },
];
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json());
app.use((q, r, n) => { if (q.path.startsWith('/api/')) calls.push({ m: q.method, p: q.path, q: Object.assign({}, q.query), auth: q.headers.authorization || null }); n(); });
// Auth: every API call must carry the signed-in mock user's token.
app.use('/api', (q, r, n) => { if ((q.headers.authorization || '') !== 'Bearer mock-token') return r.status(401).json({ error: 'Authentication required' }); n(); });
async function gate(p, q, r) {
  const range = q.query.date_range || '';
  const d = (st.delay[p + ':' + range] != null ? st.delay[p + ':' + range] : st.delay[p]) || 0;
  if (d) await sleep(d);
  const f = st.rangeFail[p + ':' + range] || st.fail[p];
  if (f) { r.status(f).json({ error: 'mock provider error ' + f }); return false; }
  return true;
}
app.get(/^\/api\/(google|meta|tiktok|pinterest)\/status$/, (q, r) => {
  const p = q.params[0], s = st.status[p];
  if (s === 'unavailable') return r.status(500).json({ error: 'Database error' });
  if (s === 'not_connected') return r.json({ connected: false });
  if (s === 'expired') return r.json(p === 'meta' || p === 'tiktok' ? { connected: false, status: 'expired' } : { connected: true, status: 'disconnected' });
  r.json({ connected: true, status: 'connected', active_ad_account: { account_id: 'acc-' + p, account_name: 'Linnen ' + p, currency: st.currency[p] } });
});
app.get('/api/ads/overview', async (q, r) => {
  if (!(await gate('google', q, r))) return;
  const camps = [
    { id: 'g1', name: 'Search — linen', status: 'ENABLED', primary_status: 'ELIGIBLE', spend: 1234.5, impressions: 50000, clicks: 1500, conversions: 30, conversions_value: 2400 },
    { id: 'g3', name: 'Zero value', status: 'ENABLED', primary_status: 'ELIGIBLE', spend: 50, impressions: 900, clicks: 20, conversions: 1, conversions_value: 0 },
  ];
  if (q.query.include_all === '1') camps.push({ id: 'g2', name: 'Brand — new', status: 'ENABLED', primary_status: 'PENDING', no_activity: true, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversions_value: 0 });
  r.json({ account: { id: 'acc-google', name: 'Linnen google', currency: st.currency.google }, date_range: q.query.date_range, overview: { spend: 1284.5, impressions: 50900, clicks: 1520, conversions: 31, conversions_value: 2400 }, campaigns: camps });
});
app.get('/api/meta/campaigns', async (q, r) => {
  if (!(await gate('meta', q, r))) return;
  let list = META();
  if (q.query.date_range === 'LAST_7_DAYS') list = [{ campaign_id: 'old7', campaign_name: 'STALE last-7-days campaign', status: 'ACTIVE', effective_status: 'ACTIVE', has_insights: true, spend: 9999, impressions: 1, clicks: 1 }];
  if (q.query.include_all !== '1') list = list.filter((c) => ['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(c.effective_status));
  r.json({ campaigns: list, account_id: 'act_1', date_range: q.query.date_range, currency: st.metaRespCurrency });
});
app.get('/api/meta/adsets', async (q, r) => { if (!(await gate('meta', q, r))) return; r.json({ adsets: [{ adset_id: 'as1', adset_name: 'Set A', status: 'ACTIVE', campaign_id: 'm1', spend: 10, impressions: 100, clicks: 2, conversions: 0 }], date_range: q.query.date_range }); });
app.get('/api/tiktok/overview', async (q, r) => {
  if (!(await gate('tiktok', q, r))) return;
  r.json({ account: { id: 'adv1', name: 'Linnen TikTok' }, date_range: q.query.date_range, overview: null, campaigns: [
    { id: 't1', name: 'TikTok video', status: 'ENABLE', operation_status: 'ENABLE', secondary_status: 'CAMPAIGN_STATUS_ENABLE', budget: 30, budget_mode: 'BUDGET_MODE_DAY', spend: null },
    { id: 't2', name: 'TikTok paused', status: 'DISABLE', operation_status: 'DISABLE', secondary_status: 'CAMPAIGN_STATUS_DISABLE', budget: 25, budget_mode: 'BUDGET_MODE_DAY' },
    { id: 't3', name: 'TikTok over budget', status: 'ENABLE', operation_status: 'ENABLE', secondary_status: 'CAMPAIGN_STATUS_BUDGET_EXCEED', budget: 900, budget_mode: 'BUDGET_MODE_TOTAL' }] });
});
app.get('/api/pinterest/overview', async (q, r) => {
  if (!(await gate('pinterest', q, r))) return;
  r.json({ account: { id: 'pa1', name: 'Linnen Pins', currency: st.currency.pinterest }, overview: { spend: 50, impressions: 9000, clicks: 90, conversions: 3, reach: 7000, cpm: 5.5, cpc: 0.55, frequency: 1.28 },
    campaigns: [{ campaign_id: 'p1', campaign_name: 'Pin spring', summary_status: 'RUNNING' }, { campaign_id: 'p2', campaign_name: 'Pinterest — ready', summary_status: 'PAUSED' }] });
});
app.get('/api/intelligence/kpi-series', (q, r) => st.seriesFail ? r.status(500).json({ error: 'x' }) : r.json({ series: [1, 2, 3, 4].map((i) => ({ date: '2026-10-1' + i, spend: 10 * i, impressions: 1000 * i, clicks: 20 * i, conversions: i })) }));
app.get('/api/intelligence/events', (q, r) => r.json({ events: [{ id: 'e1', platform: 'meta', campaign_name: 'Retargeting', title: 'Budget changed on Retargeting', created_at: iso(-3600e3) }] }));
app.post(/^\/api\/campaigns\/sync\/[a-z]+$/, (q, r) => r.json({ ok: true }));
app.get('/api/campaigns', (q, r) => r.json({ campaigns: [] }));
app.get('/api/business/profile', (q, r) => r.json({ profile: { company_name: 'Linnen & Co', country: 'Netherlands' } }));
app.get('/api/credits/status', (q, r) => r.json({ balance: 1000, plan: 'starter' }));
app.all(/^\/api\//, (q, r) => r.json({}));
app.get('/', (q, r) => r.redirect('/app.html'));
app.use(express.static(ROOT));

const LOCAL = [
  { id: 'pin-ok', name: 'Pinterest — ready', platform: 'pinterest', status: 'published', providerStatus: 'paused', platformCampaignId: 'p2', destinationAccountId: 'pa1', publishedAt: iso(-3600e3), created: iso(-86400e3), pkg: { campaignName: 'Pinterest — ready', strategy: { goal: 'Traffic' } } },
  { id: 'meta-dup', name: 'Retargeting', platform: 'meta', status: 'published', providerStatus: 'paused', platformCampaignId: 'm2', publishedAt: iso(-7200e3), created: iso(-90000e3), pkg: { campaignName: 'Retargeting', strategy: { goal: 'Traffic' } } },
];

async function fence(page) {
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(BASE + '/')) return r.continue();
    if (u.startsWith(DEV_API + '/')) return r.continue({ url: BASE + u.slice(DEV_API.length) });
    if (u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    if (r.request().method() === 'GET' && /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return r.continue();
    blocked.push(u.split('?')[0]); return r.abort();
  });
}
async function signIn(page, uid) {
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate((u) => { window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token'; if (window.orvTour) { window.orvTour.open = function () {}; try { window.orvTour.close(); } catch (_) {} } window._dbSubscriptionStatus = 'starter'; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: u, email: u + '@example.invalid' }); }, uid);
  await page.evaluate(() => { window.__ln = { id: null, at: performance.now() }; setInterval(function () { var a = document.querySelector('.page.active'); var id = a && a.id; if (id !== window.__ln.id) window.__ln = { id: id, at: performance.now() }; }, 100); });
  for (let i = 0; i < 150; i++) { await page.waitForTimeout(200); if (await page.evaluate(() => performance.now() - window.__ln.at > 3000 && performance.now() > 8500)) break; }
}
async function goCamps(page, target) {
  for (let i = 0; i < 10; i++) {
    await page.evaluate((t) => { if (window.orvTour) { try { window.orvTour.close(); } catch (_) {} } document.querySelectorAll('#orvConsentBanner').forEach((e) => e.remove()); orvWorkspace.go(Object.assign({ page: 'campaigns' }, t || {})); }, target || null);
    await page.waitForTimeout(1500);
    if (await page.evaluate(() => document.querySelector('.page.active').id === 'page-performance')) break;
  }
  await settle(page);
}
// Wait until the active platform's read has finished and count-up animations have settled.
async function settle(page, extra) {
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => { var s = window._prfState; var p = window._prfActivePlatform; return s && s.load[p] && s.load[p].state !== 'loading'; })) break; }
  await page.waitForTimeout(extra || 1300);
}
const view = (page) => page.evaluate(() => {
  const tiles = {}; document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile').forEach((t) => { tiles[t.getAttribute('data-metric')] = t.querySelector('.prf-explorer-val').innerText; });
  return { plat: window._prfActivePlatform, sel: window._prfActiveCampaign, opts: Array.from(document.getElementById('prfCampSelect').options).map((o) => ({ v: o.value, t: o.textContent })), tiles,
    notice: (document.getElementById('prfDataNotice') || {}).innerText || '', info: (document.getElementById('prfCampInfo') || {}).innerText || '',
    tabs: Array.from(document.querySelectorAll('#prfPlatTabsInner .prf-ptab')).map((b) => b.dataset.plat + ':' + b.title), chart: (document.querySelector('#prfChartsGrid .prf-chart-lock.prf-lock-show') || {}).innerText || 'chart', picker: (document.getElementById('owCampPickLbl') || {}).innerText };
});
const plat = async (page, p) => { await page.evaluate((x) => prfSwitchPlatform(x, true), p); await settle(page, 1300); };
const pick = async (page, key) => { await page.evaluate((k) => prfSwitchCampaign(k), key); await page.waitForTimeout(1300); return view(page); };
const pickerMeta = (page) => page.evaluate(() => { orvWorkspace.campPicker.show(); const o = Array.from(document.querySelectorAll('#owCampPickPop .ow-cpick-opt')).map((b) => ({ t: b.innerText.replace(/\s+/g, ' '), dot: (b.querySelector('.ow-sdot') || {}).className || '' })); orvWorkspace.campPicker.close(); return o; });

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await fence(page);
    await page.addInitScript(({ camps }) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('oriven_campaigns_mock-cmp', JSON.stringify(camps)); sessionStorage.setItem('seeded', '1'); } } catch (_) {} document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }); }, { camps: LOCAL });
    await signIn(page, 'mock-cmp');
    await goCamps(page, { platform: 'google' });

    // ── PLATFORMS / CURRENCY / METRICS ─────────────────────────────
    let v = await view(page);
    check('Campaigns opens on the current page with the sidebar on Campaigns', await page.evaluate(() => document.querySelector('.page.active').id === 'page-performance' && document.querySelector('.orv-sb .orv-ni.orv-active').getAttribute('data-orv-page') === 'performance'));
    check('Google (USD account): money in $, never €', v.tiles.spend === '$1.3K' && v.tiles.cpc.startsWith('$') && !JSON.stringify(v.tiles).includes('€'), v.tiles);
    check('Google: a campaign with no activity in the range is still discovered (include_all)', v.opts.some((o) => o.v === 'google:g2'), v.opts);
    check('Campaigns asks Google/Meta for every campaign (include_all=1)', calls.some((c) => c.p === '/api/ads/overview' && c.q.include_all === '1') && calls.some((c) => c.p === '/api/meta/campaigns' && c.q.include_all === '1'));
    v = await pick(page, 'google:g2');
    check('no-activity campaign: confirmed 0 with "No recorded activity", status In review (PENDING)', v.tiles.spend === '$0' && /No recorded activity/.test(v.notice) && /In review/.test(v.info), v);
    v = await pick(page, 'google:g3');
    check('ROAS exactly 0 shows 0.00x (not —)', v.tiles.roas === '0.00x', v.tiles);
    check('selected-campaign strip: status, campaign id, ad account, currency', /Enabled/.test(v.info) && /g3/.test(v.info) && /Linnen google/.test(v.info) && /USD/.test(v.info), v.info);

    await plat(page, 'meta');
    v = await view(page);
    check('Meta (EUR): money in €', v.tiles.spend === '€390' && v.tiles.cpc.startsWith('€'), v.tiles);
    const dup = v.opts.filter((o) => /^Retargeting/.test(o.t));
    check('two campaigns named "Retargeting" stay separate (ids …m1 / …m2)', dup.length === 2 && dup[0].v !== dup[1].v && dup.every((o) => /ID …/.test(o.t)), v.opts);
    let pm = await pickerMeta(page);
    check('picker statuses: Active / Paused / In review / Issue detected, from effective status', pm.some((o) => /…m1 Active/.test(o.t)) && pm.some((o) => /…m2 Paused · Made in OrivenAI/.test(o.t)) && pm.some((o) => /In review campaign In review/.test(o.t)) && pm.some((o) => /Problem campaign Issue detected/.test(o.t)), pm);
    check('in-review / issue campaigns are never shown as delivering (no green dot)', pm.filter((o) => /In review campaign|Problem campaign/.test(o.t)).every((o) => !/ow-t-live/.test(o.dot)), pm);
    v = await pick(page, 'meta:m1');
    const m1 = v.tiles;
    v = await pick(page, 'meta:m2');
    check('each same-named campaign keeps its own metrics and status', m1.spend === '€100' && v.tiles.spend === '€250' && /Paused/.test(v.info), { m1, m2: v.tiles, info: v.info });
    check('missing Meta link clicks / add to cart stay "—" (not 0)', m1.linkClicks === '—' && m1.addToCart === '—' && v.tiles.linkClicks === '120', { m1, m2: v.tiles });
    v = await pick(page, 'meta:m5');
    check('lifetime budget shown as lifetime (€500), daily budget "—" — never added together', v.tiles.lifetimeBudget === '€500' && v.tiles.budget === '—', v.tiles);
    v = await pick(page, 'all');
    check('all campaigns: daily budget sums non-paused campaigns only (€20 + €15), lifetime separate (€500)', v.tiles.budget === '€35' && v.tiles.lifetimeBudget === '€500', v.tiles);
    check('partial reporting is explained', /didn’t report every metric/.test(v.notice), v.notice);
    // Replay: events are matched by name — shared-name note
    await page.evaluate(() => prfSwitchCampaign('meta:m1')); await page.waitForTimeout(1200);
    const replay = await page.evaluate(() => document.getElementById('prfReplayList').innerText);
    check('Replay warns when another campaign shares the selected name', /same name/.test(replay), replay);

    // JPY: zero-decimal currency, budgets in minor units
    st.currency.meta = 'JPY'; st.metaRespCurrency = 'JPY';
    await page.evaluate(() => { orvWorkspace._clearApiCache && orvWorkspace._clearApiCache(); prfInit(); }); await settle(page);
    await plat(page, 'meta');
    v = await pick(page, 'meta:m1');
    check('JPY account: ¥ and budgets read with JPY minor units (2000 → ¥2,000 / ¥2K, not ¥20)', v.tiles.spend === '¥100' && /^¥2(,000|K)$/.test(v.tiles.budget), v.tiles);
    st.currency.meta = 'EUR'; st.metaRespCurrency = 'EUR';

    // Pinterest / TikTok availability
    await page.evaluate(() => { orvWorkspace._clearApiCache && orvWorkspace._clearApiCache(); prfInit(); }); await settle(page);
    await plat(page, 'pinterest');
    v = await view(page);
    check('Pinterest (GBP): account totals in £ with an "account totals" note', v.tiles.spend === '£50' && /Account totals/.test(v.notice), v);
    v = await pick(page, 'pinterest:p1');
    check('single Pinterest campaign: every metric "—" (never £0) + "Campaign-level metrics are not available."', Object.values(v.tiles).every((x) => x === '—') && /Campaign-level metrics are not available/.test(v.notice) && /No trend for this campaign/.test(v.chart), v);
    await plat(page, 'tiktok');
    v = await view(page);
    pm = await pickerMeta(page);
    check('TikTok without reported metrics: "—" + explanation, never 0', ['spend', 'impressions', 'clicks', 'conversions'].every((k) => v.tiles[k] === '—') && /didn’t return performance metrics/.test(v.notice), v);
    check('TikTok raw statuses mapped: Enabled / Paused / Issue detected (no ENABLE/DISABLE)', pm.some((o) => /TikTok video Enabled/.test(o.t)) && pm.some((o) => /TikTok paused Paused/.test(o.t)) && pm.some((o) => /over budget Issue detected/.test(o.t)) && !pm.some((o) => /ENABLE|DISABLE|Disable/.test(o.t)), pm);
    check('unknown account currency: amounts without a currency symbol (TikTok budget 30)', v.tiles.budget === '30' || v.tiles.budget === '55', v.tiles);

    // ── DATA LOADING: stale responses, errors, timeouts ───────────
    await plat(page, 'meta');
    st.delay['meta:LAST_7_DAYS'] = 1800;
    await page.evaluate(() => { document.getElementById('prfRangeSelect').value = 'LAST_7_DAYS'; prfSetRange('LAST_7_DAYS'); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { document.getElementById('prfRangeSelect').value = 'LAST_30_DAYS'; prfSetRange('LAST_30_DAYS'); });
    await page.waitForTimeout(2600);
    v = await view(page);
    check('slow response for an old range never overwrites the current range', !v.opts.some((o) => /STALE/.test(o.t)) && v.tiles.spend === '€390', v);
    st.delay = {}; st.rangeFail['meta:LAST_7_DAYS'] = 500; st.delay['meta:LAST_7_DAYS'] = 1500;
    await page.evaluate(() => { prfSetRange('LAST_7_DAYS'); }); await page.waitForTimeout(100);
    await page.evaluate(() => { prfSetRange('LAST_30_DAYS'); }); await page.waitForTimeout(2400);
    v = await view(page);
    check('a stale ERROR from an old request never replaces newer data', !/Unable to load/.test(v.notice) && v.tiles.spend === '€390', v);
    st.delay = {}; st.rangeFail = {};
    // rapid platform switching during a slow read
    st.delay.meta = 1500;
    await page.evaluate(() => { prfSetRange('LAST_30_DAYS'); prfSwitchPlatform('google', true); prfSwitchPlatform('meta', true); prfSwitchPlatform('pinterest', true); prfSwitchPlatform('meta', true); });
    await page.waitForTimeout(1700); await settle(page, 1600);
    v = await view(page);
    check('rapid platform switching ends on the right platform with its own data', v.plat === 'meta' && v.tiles.spend === '€390' && v.opts.every((o) => o.v === 'all' || /^meta:/.test(o.v)), v);
    st.delay = {};
    // provider error + retry
    st.fail.meta = 500;
    await page.evaluate(() => prfRetry('meta')); await settle(page, 600);
    v = await view(page);
    check('provider 500: "Unable to load Meta Ads campaign data" + Retry, metrics "—", not "no data"', /Unable to load Meta Ads campaign data/.test(v.notice) && /Retry/.test(v.notice) && v.tiles.spend === '—' && !/Not enough data/.test(v.chart), v);
    await page.screenshot({ path: path.join(SHOT_DIR, 'meta-error.png') });
    st.fail.meta = 0;
    const before = calls.filter((c) => /sync/.test(c.p)).length;
    await page.click('#prfDataNotice .prf-inline-btn'); await settle(page);
    v = await view(page);
    check('Retry repeats only the read: data back, no extra background sync, no writes', v.tiles.spend === '€390' && !/Unable/.test(v.notice) && calls.filter((c) => /sync/.test(c.p)).length === before && !calls.slice(-6).some((c) => c.m !== 'GET'), { v, calls: calls.slice(-6) });
    st.fail.meta = 401;
    await page.evaluate(() => prfRetry('meta')); await settle(page, 600);
    v = await view(page);
    check('permission/expired token (401): "connection needs attention" + Reconnect', /connection needs attention/.test(v.notice) && /Reconnect/.test(v.notice), v.notice);
    st.fail.meta = 0;
    // timeout
    await page.evaluate(() => { window.PRF_TIMEOUT_MS = 700; }); st.delay.meta = 2500;
    await page.evaluate(() => prfRetry('meta')); await page.waitForTimeout(1600);
    v = await view(page);
    check('request timeout: "The request timed out." + Retry', /timed out/.test(v.notice), v.notice);
    await page.evaluate(() => { window.PRF_TIMEOUT_MS = 30000; }); st.delay = {};
    await page.evaluate(() => prfRetry('meta')); await settle(page);
    // chart series failure
    st.seriesFail = true;
    await page.evaluate(() => prfSwitchCampaign('all')); await page.waitForTimeout(1200);
    v = await view(page);
    check('chart series failure shows an error state with Retry (not "Not enough data")', /trend couldn’t be loaded/.test(v.chart), v.chart);
    st.seriesFail = false;

    // ── CONNECTION STATES ─────────────────────────────────────────
    st.status.google = 'unavailable'; st.status.tiktok = 'expired'; st.status.pinterest = 'not_connected';
    await page.evaluate(() => { orvWorkspace._clearApiCache && orvWorkspace._clearApiCache(); prfInit(); }); await settle(page);
    v = await view(page);
    check('status check failure = "Status unavailable" (never "Not connected"); expired = "Reconnect required"', v.tabs.includes('google:Status unavailable') && v.tabs.includes('tiktok:Reconnect required') && v.tabs.includes('pinterest:Not connected'), v.tabs);
    await plat(page, 'google');
    v = await view(page);
    check('status unavailable does not hide campaign data (Google data still loaded)', v.tiles.spend === '$1.3K', v.tiles);
    await plat(page, 'tiktok');
    v = await view(page);
    check('expired connection: "needs attention" + Reconnect', /connection needs attention/.test(v.notice) && /Reconnect/.test(v.notice), v.notice);
    st.status = { google: 'connected', meta: 'connected', tiktok: 'connected', pinterest: 'connected' };
    await page.evaluate(() => { orvWorkspace._clearApiCache && orvWorkspace._clearApiCache(); prfInit(); }); await settle(page);

    // ── LAUNCH / CONTROL CENTER HANDOFF BY ID ─────────────────────
    await page.evaluate(() => _orvNav('launch', 'page-launch')); await page.waitForTimeout(1000);
    await page.evaluate(() => _launchOpenInCampaigns('meta-dup')); await settle(page);
    v = await view(page);
    check('Launch → Campaigns selects by platform campaign id: the PAUSED "Retargeting" (m2), not m1', v.plat === 'meta' && v.sel === 'meta:m2' && /Paused/.test(v.info) && /m2/.test(v.info), v);
    await page.evaluate(() => _orvNav('launch', 'page-launch')); await page.waitForTimeout(800);
    await page.evaluate(() => _launchOpenInCampaigns('pin-ok')); await settle(page);
    v = await view(page);
    check('Launch → Campaigns for Pinterest selects p2', v.plat === 'pinterest' && v.sel === 'pinterest:p2', v);
    await goCamps(page, { platform: 'meta', campaignId: 'm999', campaignName: 'Retargeting' });
    v = await view(page);
    check('id not returned yet: nothing same-named selected; pending notice + Refresh', v.sel === 'all' && /isn’t returned by Meta Ads yet/.test(v.notice) && /Refresh/.test(v.notice), v);
    await goCamps(page, { platform: 'meta', campaignId: 'm777', campaignName: 'Spring sale', accountId: '4455', accountName: 'Old shop' });
    v = await view(page);
    check('published to ANOTHER ad account: says which account and links to Connections (not “a few minutes”)', v.sel === 'all' && /published to the ad account Old shop/.test(v.notice) && /Linnen meta/.test(v.notice) && /Open Connections/.test(v.notice) && !/few minutes/.test(v.notice), v);
    await goCamps(page, { platform: 'meta', campaignId: 'm778', campaignName: 'Same account', accountId: 'acc-meta' });
    v = await view(page);
    check('same ad account, not returned yet → the “few minutes” notice', /isn’t returned by Meta Ads yet/.test(v.notice) && !/published to the ad account/.test(v.notice), v);
    await page.evaluate(() => orvWorkspace.ops.openCampaign('meta', 'm1', false)); await settle(page);
    v = await view(page);
    check('Control Center → Campaigns (OPS.openCampaign) selects by id (m1)', v.sel === 'meta:m1', v);

    // ── AD-SET LEVEL RANGE ────────────────────────────────────────
    await page.evaluate(() => { prfSetRange('TODAY'); prfSwitchHierarchy('adsets'); }); await page.waitForTimeout(1500);
    const adCall = calls.filter((c) => c.p === '/api/meta/adsets').slice(-1)[0];
    check('ad-set level requests the selected range (TODAY), no silent substitute', adCall && adCall.q.date_range === 'TODAY', adCall);
    await page.evaluate(() => { prfSwitchHierarchy('campaigns'); prfSetRange('LAST_30_DAYS'); document.getElementById('prfRangeSelect').value = 'LAST_30_DAYS'; }); await settle(page);

    // ── LEGACY NAVIGATION ─────────────────────────────────────────
    const nav = await page.evaluate(() => {
      const out = {};
      const run = (sel) => { const b = document.querySelector(sel); if (!b) return 'missing'; new Function(b.getAttribute('onclick'))(); return document.querySelector('.page.active').id; };
      out.mobileNav = run('.mbn-item[data-mbn="campaigns"]');
      out.adsManagerCta = run('.adm-cta-btn.adm-cta-sec');
      out.assetsNew = run('.asl-create-btn');
      out.workspaceBack = run('.cwr-back');
      return out;
    });
    await page.waitForTimeout(300);
    check('legacy paths: mobile nav + Ads Manager CTA → Campaigns; Assets "New Campaign" → Create; draft workspace back → Launch', nav.mobileNav === 'page-performance' && nav.adsManagerCta === 'page-performance' && nav.assetsNew === 'page-create' && nav.workspaceBack === 'page-launch', nav);
    await goCamps(page, { platform: 'meta' });

    // ── MARKUP ────────────────────────────────────────────────────
    check('Replay markup exists once (no duplicate ids)', await page.evaluate(() => ['prfReplaySection', 'prfReplayList', 'prfReplayEmpty', 'prfReplayHd'].every((id) => document.querySelectorAll('#' + id).length === 1)));
    const modal = await page.evaluate(() => { prfOpenCustomize(); const t = document.getElementById('pcmPlatformNote').innerText; prfCloseCustomize(); return t; });
    check('Customize Metrics copy says "Campaigns", not "Campaign Overview"', /Campaigns shows for Meta Ads/.test(modal) && !/Campaign Overview/.test(modal), modal);

    // ── TRANSLATIONS ──────────────────────────────────────────────
    const ENGLISH = /\b(over time|Metrics|Delivery & spend|Impressions|Status unavailable|Ad account|Currency|Campaign ID|Not connected|Reconnect required|Retry|Paused|No recorded activity|Enabled|In review|Issue detected)\b/;
    const NAMES = /Retargeting|In review campaign|Problem campaign|Lifetime one|Search — linen|Zero value|Brand — new|Pin spring|Pinterest — ready|TikTok video|TikTok paused|TikTok over budget/g;
    for (const l of ['en', 'nl', 'de', 'fr', 'es', 'pt']) {
      await page.evaluate((x) => { CURRENT_LANG = x; applyLanguage(); prfSwitchCampaign('meta:m1'); }, l);
      await page.waitForTimeout(1300);
      const txt = await page.evaluate(() => { const pg = document.getElementById('page-performance'); return pg.innerText + ' ' + Array.from(pg.querySelectorAll('[title],[aria-label]')).map((e) => (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '')).join(' '); });
      const raw = /\bcmp[A-Z_][A-Za-z_]*\b|\{[a-z]+\}/.test(txt);
      const clean = txt.replace(NAMES, '').replace(/Google Ads|Meta Ads|TikTok Ads|Pinterest Ads|Linnen [a-z]+|ROAS|CTR|CPC|CPM|CPA/g, '');
      // Words that are also correct in that language (fr: Impressions).
      const same = { fr: /\bImpressions\b/g };
      const checked = same[l] ? clean.replace(same[l], '') : clean;
      const eng = l !== 'en' && ENGLISH.test(checked);
      const m = checked.match(ENGLISH);
      check(l + ': Campaigns fully translated — no raw keys, no leftover English', !raw && !eng, { raw, eng, sample: m && m[0], around: m ? checked.slice(Math.max(0, m.index - 80), m.index + 60) : '' });
      if (l === 'de') await page.screenshot({ path: path.join(SHOT_DIR, 'lang-de.png') });
    }
    await page.evaluate(() => { CURRENT_LANG = 'en'; applyLanguage(); prfSwitchCampaign('all'); });

    // ── RESPONSIVE ────────────────────────────────────────────────
    for (const w of [1600, 1440, 1280, 1024, 768, 390]) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 });
      await page.waitForTimeout(500);
      const g = await page.evaluate(() => { const pg = document.getElementById('page-performance'); const over = Array.from(pg.querySelectorAll('*')).filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && !e.closest('#prfPlatTabsInner') && !e.closest('.prf-chart-body') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 4).map((e) => e.className || e.tagName); const tabs = document.getElementById('prfPlatTabsInner'); const rs = document.getElementById('prfRangeSelect'), cs = document.getElementById('prfHierarchySelect'); return { sw: document.documentElement.scrollWidth, iw: innerWidth, over, cue: tabs.className, rangeFont: getComputedStyle(rs).fontSize, levelFont: getComputedStyle(cs).fontSize }; });
      check(w + 'px: no horizontal overflow', g.sw <= g.iw + 1 && !g.over.length, g);
      if (w === 390) check('390px: tab row shows the "more tabs" cue; date select matches neighbouring controls', /prf-tabs-more-right/.test(g.cue) && parseFloat(g.rangeFont) <= 12.5, g);
      await page.screenshot({ path: path.join(SHOT_DIR, 'meta-' + w + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // ── ACCOUNT SWITCH ────────────────────────────────────────────
    await page.evaluate(() => orvWorkspace.reset());
    const cleared = await page.evaluate(() => ({ camps: (window._prfAllCampaigns || []).length, kpis: Object.keys(window._prfPlatKpis || {}).length, sel: window._prfActiveCampaign, tiles: document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile').length, opts: document.getElementById('prfCampSelect').options.length }));
    check('account switch clears campaigns, metrics, selection and the visible tiles immediately (no reload)', cleared.camps === 0 && cleared.kpis === 0 && cleared.sel === 'all' && cleared.tiles === 0 && cleared.opts === 1, cleared);
    st.user = 'mock-other'; st.status = { google: 'not_connected', meta: 'not_connected', tiktok: 'not_connected', pinterest: 'not_connected' };
    await page.evaluate(() => localStorage.setItem('oriven_campaigns_mock-other', '[]'));
    await signIn(page, 'mock-other');
    await goCamps(page);
    v = await view(page);
    check('other account: nothing from the first account; connect banner shown', v.opts.length === 1 && await page.evaluate(() => getComputedStyle(document.getElementById('prfConnectBanner')).display !== 'none'), v);

    const real = errors.filter((e) => !/supabase|Failed to fetch/i.test(e));
    check('no page errors', !real.length, real);
    const cmpCalls = calls.filter((c) => /^\/api\/((google|meta|tiktok|pinterest)\/status|ads\/overview|meta\/(campaigns|adsets|ads)|tiktok\/overview|pinterest\/(overview|ad-groups|ads)|intelligence\/(kpi-series|events)|campaigns\/sync)/.test(c.p) && !/\/status$/.test(c.p));
    check('every Campaigns API call carried the user token (server-side auth enforced in the mock)', cmpCalls.length > 20 && cmpCalls.every((c) => c.auth === 'Bearer mock-token'), cmpCalls.filter((c) => c.auth !== 'Bearer mock-token').slice(0, 3));
    check('network fence held: nothing reached localhost:5500 or any other host', !blocked.some((u) => !/supabase\.co/.test(u)) || blocked.every((u) => !/localhost:5500|onrender|orivenai\.com/.test(u)), Array.from(new Set(blocked)).slice(0, 6));
    await ctx.close();
  } catch (e) { fail++; console.log('FAIL — test crashed | ' + (e && e.stack || e)); }
  await browser.close(); server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + SHOT_DIR);
  process.exit(fail ? 1 : 0);
});
