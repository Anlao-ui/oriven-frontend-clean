/* ════════════════════════════════════════════════════════════════
   UI sweep — the six workflow pages at 390 / 768 / 1024 / 1440 / 1600 px,
   in English and (at 390 px) German, the language with the longest
   labels. Checks: no horizontal page overflow, no visible element wider
   than the viewport, no broken visible images, no raw translation keys,
   no page errors. OrivenAI is dark-only (js/settings.js), so there is one
   theme to check. Screenshots for review.

   SAFETY: network fence — only this test's in-process mock server is
   reachable (the dev API base localhost:5500 is rewritten to it); static
   CDN GETs are allowed; everything else is aborted and reported.

   RUN: node tests/ui-sweep.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const PORT = 8947, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOT_DIR = path.join(__dirname, '_shots', 'ui-sweep'); fs.mkdirSync(SHOT_DIR, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }
const blocked = [];
const now = Date.now(), iso = (ms) => new Date(now + ms).toISOString();

const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json({ limit: '5mb' }));
const acct = (p) => ({ account_id: 'acc-' + p, account_name: 'Linnen ' + p, currency: 'EUR' });
app.get(/^\/api\/(google|meta|tiktok|pinterest)\/status$/, (q, r) => r.json({ connected: true, status: 'connected', active_ad_account: acct(q.params[0]) }));
app.get(/^\/api\/setup\/(google|meta|tiktok|pinterest)\/status$/, (q, r) => r.json({ connected: true, ready: true, state: 'ready', steps: { account: { status: 'complete', accountName: 'Linnen ' + q.params[0] }, assets: { status: 'complete' } } }));
app.get('/api/business/profile', (q, r) => r.json({ profile: { company_name: 'Linnen & Co', country: 'Netherlands', website: 'linnenco.example', description: 'Light linen clothing for warm days.' } }));
app.get('/api/credits/status', (q, r) => r.json({ balance: 1000, plan: 'starter', monthlyAllowance: 1000, usedThisMonth: 0, resetDate: iso(20 * 864e5) }));
app.get('/api/get-subscription', (q, r) => r.json({ plan: 'starter', status: 'active' }));
app.get('/api/research/reports', (q, r) => r.json({ reports: [] }));
app.get('/api/campaigns', (q, r) => r.json({ campaigns: [] }));
app.get('/api/creative/assets', (q, r) => r.json({ assets: [] }));
app.get('/api/intelligence/events', (q, r) => r.json({ events: [] }));
app.get('/api/automations', (q, r) => r.json({ rules: [], automations: [] }));
app.get('/api/automations/approvals', (q, r) => r.json({ approvals: [] }));
app.get('/api/automations/activity', (q, r) => r.json({ items: [], activity: [] }));
app.get('/api/automations/overview', (q, r) => r.json({ active: 0, completed: 0, connected: ['google', 'meta', 'tiktok', 'pinterest'] }));
app.get('/api/ads/overview', (q, r) => r.json({ campaigns: [], account: { currency: 'EUR' } }));
app.get(/^\/api\/(meta|tiktok|pinterest)\/(campaigns|overview)$/, (q, r) => r.json({ campaigns: [], currency: 'EUR' }));
app.post('/api/campaigns/spec', (q, r) => r.json({ ok: false, error: 'Mock: the campaign check is not available in this test.' }));
app.all(/^\/api\//, (q, r) => r.json({}));
app.use(express.static(ROOT));

const LOCAL = [
  { id: 'sw-draft', name: 'Summer linen', platform: 'meta', status: 'draft', created: iso(-864e5), pkg: { campaignName: 'Summer linen', strategy: { goal: 'Sales', landingPageUrl: 'https://linnenco.example/summer' }, metaAds: { budget: 20, headline: 'Linen for warm days', primaryText: 'Breathable linen shirts.' } } },
  { id: 'sw-pub', name: 'Spring launch', platform: 'google', status: 'published', providerStatus: 'paused', platformCampaignId: '991', publishedAt: iso(-36e5), created: iso(-2 * 864e5), pkg: { campaignName: 'Spring launch', strategy: { goal: 'Traffic' }, googleAds: { campaignType: 'SEARCH', headlines: ['Linen shirts', 'Light and cool', 'Free returns'], descriptions: ['Breathable linen.', 'Order today.'] } } },
];

async function fence(page) {
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(BASE + '/')) return r.continue();
    if (u.startsWith(DEV_API + '/')) return r.continue({ url: BASE + u.slice(DEV_API.length) });
    if (u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    if (r.request().method() === 'GET' && /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return r.continue();
    blocked.push(u.split('?')[0]); return r.abort();
  });
}
async function signIn(page) {
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate((camps) => {
    localStorage.setItem('oriven_campaigns_mock-sweep', JSON.stringify(camps));
    window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token';
    if (window.orvTour) { window.orvTour.open = function () {}; try { window.orvTour.close(); } catch (_) {} }
    window._dbSubscriptionStatus = 'starter';
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-sweep', email: 'sweep@example.invalid' });
  }, LOCAL);
  await page.waitForTimeout(6000);
}
const PAGES = [['businessbrain', 'page-business-brain', 'control-center'], ['research', 'page-research', 'research'], ['create', 'page-create', 'create'], ['launch', 'page-launch', 'launch'], ['performance', 'page-performance', 'campaigns'], ['autopilot', 'page-autopilot', 'automations']];
async function open(page, p) {
  await page.evaluate((x) => { document.querySelectorAll('#orvConsentBanner,.ofd-backdrop').forEach((e) => e.remove()); try { if (window.orvTour) window.orvTour.close(); } catch (_) {} _orvNav(x[0], x[1]); }, p);
  await page.waitForTimeout(1800);
}
const inspect = (page, pageId) => page.evaluate((pid) => {
  const pg = document.getElementById(pid);
  const iw = innerWidth;
  const visible = (e) => { const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  // Containers that scroll sideways on purpose (tab strips, carousels, code, tables).
  const scrollsX = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
  const wide = Array.from(pg ? pg.querySelectorAll('*') : []).filter((e) => { if (!visible(e)) return false; const b = e.getBoundingClientRect(); return (b.right > iw + 2 || b.left < -2) && !scrollsX(e) && getComputedStyle(e).position !== 'fixed'; })
    .slice(0, 5).map((e) => (e.id ? '#' + e.id : '') + '.' + String(e.className || '').split(' ').slice(0, 2).join('.') + ' r=' + Math.round(e.getBoundingClientRect().right));
  const broken = Array.from(pg ? pg.querySelectorAll('img') : []).filter((i) => visible(i) && i.getAttribute('src') && i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src').slice(0, 80));
  // Text under the fixed mobile menu button (shown up to 1024 px).
  const tog = document.getElementById('orvMobToggle');
  const tr = tog && getComputedStyle(tog).display !== 'none' ? tog.getBoundingClientRect() : null;
  const underMenu = !tr ? [] : Array.from(pg ? pg.querySelectorAll('h1, h2, h3, p, span, a, button, label, div') : []).filter((e) => {
    if (!visible(e) || !e.childNodes.length || !Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
    const b = e.getBoundingClientRect();
    return b.left < tr.right && b.right > tr.left && b.top < tr.bottom && b.bottom > tr.top;
  }).slice(0, 3).map((e) => e.tagName + ' "' + e.innerText.slice(0, 24) + '"');
  const text = pg ? pg.innerText : '';
  const raw = (text.match(/\b(lch|ofl|ocs|cmp|prf|ccx)_[A-Za-z]{3,}/) || [])[0] || null;
  return { underMenu, active: (document.querySelector('.page.active') || {}).id, sw: document.documentElement.scrollWidth, iw, wide, broken, raw, len: text.length };
}, pageId);

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    // A request that FINISHED against any host but this test server (or a
    // static CDN) would be a leak; aborted ones never left the browser.
    const leaked = [];
    const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
    page.on('requestfinished', (rq) => { const u = rq.url(); if (!u.startsWith(BASE + '/') && !/^(data|blob):/.test(u) && !CDN.test(u)) leaked.push(u.split('?')[0]); });
    await fence(page);
    await signIn(page);
    for (const [lang, widths] of [['en', [390, 768, 1024, 1440, 1600]], ['de', [390]]]) {
      await page.evaluate((l) => { CURRENT_LANG = l; applyLanguage(); }, lang);
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: w <= 390 ? 844 : w <= 768 ? 1024 : 900 });
        for (const p of PAGES) {
          await open(page, p);
          const v = await inspect(page, p[1]);
          check(lang + ' ' + w + 'px ' + p[2] + ': opens, no horizontal overflow, nothing wider than the screen', v.active === p[1] && v.sw <= v.iw + 1 && !v.wide.length && v.len > 20, v);
          check(lang + ' ' + w + 'px ' + p[2] + ': no broken images, no raw translation keys', !v.broken.length && !v.raw, { broken: v.broken, raw: v.raw });
          if (w <= 1024) check(lang + ' ' + w + 'px ' + p[2] + ': no text under the mobile menu button', !v.underMenu.length, v.underMenu);
          if (lang === 'en' && (w === 390 || w === 1440) || lang === 'de') await page.screenshot({ path: path.join(SHOT_DIR, lang + '-' + w + '-' + p[2] + '.png') });
        }
      }
    }
    // Post-sign-in start page never overrides a page the user already opened
    // (the profile can finish loading after the first click).
    const sp = await page.evaluate(() => {
      window._orvNavSinceSignIn = false; _orvNav('research', 'page-research'); _orvGoStartPage();
      var kept = document.querySelector('.page.active').id;
      window._orvNavSinceSignIn = false; _orvGoStartPage();
      return { kept: kept, start: document.querySelector('.page.active').id };
    });
    await page.waitForTimeout(800);
    check('start-page routing keeps a page opened during sign-in; otherwise opens Control Center', sp.kept === 'page-research' && sp.start === 'page-business-brain', sp);
    // Consent banner: its own labels in the app language (Control Center's
    // relabel used to overwrite them with "reject" / "accept" / "settings").
    const ccDe = await page.evaluate(() => { var r = document.querySelector('.orv-cc'); return r ? r.innerText : null; });
    check('consent banner in German, buttons labelled (not raw action names)', !!ccDe && /Werbung ablehnen/.test(ccDe) && /Datenschutz/.test(ccDe) && !/^\s*(reject|accept|settings)\s*$/im.test(ccDe), ccDe && ccDe.slice(0, 200));
    await page.evaluate(() => { CURRENT_LANG = 'en'; applyLanguage(); });
    const ccEn = await page.evaluate(() => { var r = document.querySelector('.orv-cc'); return r ? r.innerText : null; });
    check('consent banner back in English: "Reject advertising" / "Accept advertising" / "Settings"', !!ccEn && /Reject advertising/.test(ccEn) && /Accept advertising/.test(ccEn) && /Settings/.test(ccEn), ccEn && ccEn.slice(0, 200));
    check('no page errors across the sweep', !errors.length, errors.slice(0, 5));
    check('network fence held: no request completed against any other host (' + blocked.length + ' aborted before leaving the browser)', !leaked.length, Array.from(new Set(leaked)).slice(0, 6));
    await ctx.close();
  } catch (e) { fail++; console.log('FAIL — test crashed | ' + (e && e.stack || e)); }
  await browser.close(); server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + SHOT_DIR);
  process.exit(fail ? 1 : 0);
});
