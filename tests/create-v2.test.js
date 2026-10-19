/* ════════════════════════════════════════════════════════════════
   Create 2.0 — guided Create flow, end to end in a real browser.

   No real backend, no Supabase, no AI, no credits: a local static server
   serves this repo, every /api/* call is answered by an in-test mock and
   Supabase is blocked. The /api/ai/create-ad mock applies the SAME
   compatibility schema the backend applies (js/createCompat.js — byte-
   identical to server/services/createCompat.js), so a request the real
   server would refuse with 422 is refused here too.

   Covers: options per platform (enabled/disabled + reasons + auto-select),
   the request payload for every kind of publishable ad, assets actually
   requested (images per ad / Performance Max set / none for Search /
   videos with adContext), unsupported combinations never reaching the
   server, the server 422 path, credit cost shown vs computed, insufficient
   credits, advertising language (profile / country / user), conflicting
   notes, Research → Create, onboarding draft save/restore, the legacy
   4-argument cgrGenerate, step validation, keyboard, mobile layout and
   all six interface languages.

   RUN: node tests/create-v2.test.js
   ════════════════════════════════════════════════════════════════ */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const CC = require(path.join(ROOT, 'js', 'createCompat.js'));
const PORT = 8913, BASE = 'http://127.0.0.1:' + PORT;
const SHOT_DIR = path.join(__dirname, '_shots', 'create_v2');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (u === '/') u = '/app.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
}).listen(PORT);

let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 500))); }
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const COSTS = { campaign_generation: 25, image_generation: 75, video_generation: 200 };
function pkgFor(body) {
  const p = body.platform;
  const pkg = {
    campaignName: 'Wallet campaign', platform: p, strategy: { goal: body.goal, targetAudience: 'Gift buyers' },
    concepts: [{ angle: 'Performance', name: 'Concept A', hook: 'Hook', cta: 'Shop Now', adCopy: { headline: 'Handmade wallet', primaryText: 'Leather wallets with engraving', description: 'Made in Amsterdam' } }],
    visualConcepts: [{ conceptRef: 'Performance', imagePrompts: ['A leather wallet on a wooden table'] }],
    creativeFormat: body.format || null, inputs: { format: body.format || null, language: body.brief && body.brief.language, brief: body.brief || null, imageSource: body.format === 'image' ? ((body.brief && body.brief.imageSource) || 'ai') : null },
  };
  if (p === 'google') pkg.googleAds = { headlines: ['Handmade wallets', 'Free engraving', 'Made in Amsterdam'], descriptions: ['Leather wallets made by hand.', 'Order online today.'], keywords: ['leather wallet'], campaignType: body.campaignType || 'SEARCH' };
  if (p === 'meta') pkg.metaAds = { primaryText: 'Leather wallets', headline: 'Handmade', cta: 'Shop Now' };
  if (p === 'tiktok') pkg.tiktokAds = { hook: 'Watch this', script: '[0:00] Wallet', cta: 'Shop now' };
  if (p === 'pinterest') pkg.pinterestAds = { title: 'Handmade wallet', description: 'Leather', creativeType: body.format === 'video' ? 'video' : 'image' };
  // Echo the structure exactly as server.js _generateAdPackage force-writes it.
  const clamp = (n) => Math.max(1, Math.min(5, parseInt(n, 10) || 1));
  if (p === 'meta' && body.metaStructure) pkg.metaStructure = { adSets: clamp(body.metaStructure.adSets), adsPerAdSet: clamp(body.metaStructure.adsPerAdSet) };
  const cs = body.campaignStructure;
  if (cs && (p === 'tiktok' || p === 'pinterest' || (p === 'google' && (!body.campaignType || body.campaignType === 'SEARCH')))) pkg.campaignStructure = { campaigns: 1, groups: clamp(cs.groups), adsPerGroup: clamp(cs.adsPerGroup) };
  // Same estimate server.js writes to pkg.inputs.creditEstimate.
  if (body.format) {
    const g = pkg.metaStructure ? pkg.metaStructure.adSets : (pkg.campaignStructure ? pkg.campaignStructure.groups : 1);
    const a = pkg.metaStructure ? pkg.metaStructure.adsPerAdSet : (pkg.campaignStructure ? pkg.campaignStructure.adsPerGroup : 1);
    const n = CC.adCountFor(p, body.campaignType, g, a);
    pkg.inputs.creditEstimate = CC.estimateCredits(COSTS, CC.assetsFor(p, CC.resolveType(p, body.campaignType), body.format), n, { imageSource: pkg.inputs.imageSource });
  }
  return pkg;
}

async function arm(page, o) {
  o.createCalls = []; o.imageCalls = []; o.videoCalls = []; o.analyzeCalls = []; o.uploadCalls = [];
  await page.route('**/*supabase.co/**', (r) => r.abort());
  // Screenshots only: keep the cookie banner from covering the form.
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }));
  await page.route('**/api/**', async (r) => {
    const u = r.request().url();
    const json = (status, obj) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
    if (/\/api\/credits\/status/.test(u)) return json(200, { balance: o.balance == null ? 1000 : o.balance, plan: 'starter', monthlyAllowance: 1000, featureCosts: { campaign_generation: 25, image_generation: 75, video_generation: 200 } });
    if (/\/api\/business\/profile/.test(u)) return json(200, { profile: o.profile === undefined ? { company_name: 'Leather Co', country: 'Netherlands' } : o.profile });
    if (/\/api\/business\/audiences/.test(u)) return json(200, { items: [{ name: 'Gift buyers 25–45' }] });
    if (/\/api\/create\/analyze-url/.test(u)) { o.analyzeCalls.push(body); if (o.analyzeFail) return json(200, { ok: false, url: body.url, reason: o.analyzeFail === 'dns_failure' ? 'Could not resolve that domain.' : 'Fetch failed.', code: o.analyzeFail }); return json(200, { ok: true, url: body.url, domain: 'leathershop.example', title: 'Leather Shop', description: 'Wallets', text: 'Handmade leather wallets.' }); }
    if (/\/api\/ai\/create-ad/.test(u)) {
      o.createCalls.push(body);
      // Same rules the real server applies before charging.
      const st = body.platform === 'meta' && body.metaStructure ? { groups: body.metaStructure.adSets, adsPerGroup: body.metaStructure.adsPerAdSet } : (body.campaignStructure || {});
      const cc = CC.check({ platform: body.platform, campaignType: body.campaignType, goal: body.goal || 'Sales', format: body.format || CC.formatFromMode(body.creativeMode), objective: body.platformObjective, groups: st.groups, adsPerGroup: st.adsPerGroup, imageSource: body.brief ? body.brief.imageSource : null }, { legacy: !body.format });
      if (!cc.ok) return json(422, { ok: false, code: 'UNSUPPORTED_COMBINATION', error: cc.issues[0].message, suggestion: cc.issues[0].suggestion, issues: cc.issues });
      if (body.brief && (!CC.parsePrice(body.brief.price, body.brief.currency).ok || (body.brief.price != null && !body.brief.currency))) return json(422, { ok: false, code: 'PRICE_INVALID', error: 'invalid price' });
      return json(200, { ok: true, data: pkgFor(Object.assign({}, body, { campaignType: cc.campaignType })) });
    }
    if (/\/api\/generate-image/.test(u)) { o.imageCalls.push(body); return json(200, { imageUrl: PNG }); }
    // Existing creative upload route ("Use my own image"): stored per user, no AI, no credits.
    if (/\/api\/manual-campaigns\/upload-creative/.test(u)) {
      o.uploadCalls.push(body);
      if (o.uploadStatus) return json(o.uploadStatus, { error: 'refused', code: o.uploadCode });
      return json(200, { url: 'https://storage.example.invalid/manual-campaign-creatives/mock-cf/img-' + o.uploadCalls.length + '.png' });
    }
    if (/\/api\/generate-ugc-video/.test(u)) { o.videoCalls.push(body); return json(200, { ok: true, videoId: 'vid-' + o.videoCalls.length, status: 'processing' }); }
    if (/\/api\/ugc-video-status/.test(u)) return json(200, { status: 'processing' });
    return json(200, {});
  });
}
async function enterCreate(page, o, keepDraft) {
  o.errors = [];
  page.on('pageerror', (e) => o.errors.push(e.message));
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate((keep) => {
    if (!keep) { try { sessionStorage.clear(); } catch (_) {} }
    window._getAccessToken = async function () { return 'mock-token'; };
    // The first-run Discover tour walks through other pages; it has its own suite (tour.test.js).
    if (window.orvTour) { window.orvTour.open = function () {}; try { window.orvTour.close(); } catch (_) {} }
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-create-v2', email: 'mock@example.invalid' });
  }, !!keepDraft);
  // Without a real session the app's own start-up routing (guest landing,
  // then the start page) runs for several seconds; wait until the active
  // page has stayed the same for 3 s before opening Create.
  await page.evaluate(() => { window.__lastNav = { id: null, at: performance.now() }; setInterval(function () { var a = document.querySelector('.page.active'); var id = a && a.id; if (id !== window.__lastNav.id) window.__lastNav = { id: id, at: performance.now() }; }, 100); });
  for (let i = 0; i < 150; i++) { await page.waitForTimeout(200); const quiet = await page.evaluate(() => performance.now() - window.__lastNav.at > 3000 && performance.now() > 8500); if (quiet) break; }
  await page.evaluate(() => { if (window.orvTour) { try { window.orvTour.close(); } catch (_) {} } if (document.getElementById('orvConsentBanner')) document.getElementById('orvConsentBanner').remove(); _orvNav('create', 'page-create');
    // Supabase is blocked here, so its session lookup can stall ~15 s on a token refresh; real users have a live session.
    if (window.SB && SB.auth) SB.auth.getSession = async function () { return { data: { session: null }, error: null }; };
  });
  await page.waitForTimeout(700);
}
const EMPTY = { step: 1, maxStep: 1, productName: '', description: '', website: '', websiteRead: '', offer: '', price: '', imageSource: 'ai', ownImages: [], platform: null, goal: null, format: null, campaignType: null, objective: null, groups: 1, adsPerGroup: 1, audience: '', tone: '', styles: [], notes: '' };
async function reset(page) {
  await page.evaluate((E) => { window._cgrInFlight = null; _orvNav('create', 'page-create'); orvCreate.setState(E); }, EMPTY);
  await page.waitForTimeout(150);
}
const st = (page) => page.evaluate(() => orvCreate.getState());
async function next(page) { await page.click('#cfNext'); await page.waitForTimeout(120); }
async function step1(page, name, desc) { await page.fill('#cfName', name || 'Handmade leather wallet'); await page.fill('#aicInput', desc || 'Leather wallets from our Amsterdam workshop, with free name engraving.'); await next(page); }
async function build(page, o, cfg) {
  await reset(page);
  await step1(page);
  await page.click('#cfPlatforms [data-plat="' + cfg.platform + '"]'); await next(page);
  await page.click('#cr2GoalGrid [data-goal="' + cfg.goal + '"]'); await next(page);
  const fmtBtn = page.locator('#cfFormats [data-format="' + cfg.format + '"]');
  if ((await fmtBtn.getAttribute('aria-checked')) !== 'true') await fmtBtn.click();
  if (cfg.gtype || cfg.objective || cfg.ads) {
    await page.evaluate(() => { document.getElementById('cfAdvanced').open = true; });
    if (cfg.gtype) await page.click('#cfAdvBody [data-gtype="' + cfg.gtype + '"]');
    if (cfg.objective) await page.click('#cfAdvBody [data-obj="' + cfg.objective + '"]');
    if (cfg.ads) { await page.selectOption('#cfGroups', String(cfg.ads[0])); await page.selectOption('#cfPer', String(cfg.ads[1])); }
  }
  await next(page);
  if (cfg.notes) await page.fill('#cfNotes', cfg.notes);
  await next(page);
  const before = { c: o.createCalls.length, i: o.imageCalls.length, v: o.videoCalls.length };
  const shown = await page.evaluate(() => ({ cost: document.getElementById('aicGenCost').textContent, btn: document.getElementById('aicGenBtn').textContent, invalid: !document.getElementById('cfInvalid').hidden }));
  await page.waitForFunction(() => !window._cgrInFlight, null, { timeout: 15000 });
  await page.click('#aicGenBtn');
  for (let i = 0; i < 40 && o.createCalls.length === before.c; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(cfg.format === 'video' ? 1800 : 1500);
  return { shown, req: o.createCalls[before.c], images: o.imageCalls.slice(before.i), videos: o.videoCalls.slice(before.v) };
}

(async () => {
  const browser = await chromium.launch();

  // ── A. Options, validation, notices ─────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const o = {}; await arm(page, o); await enterCreate(page, o);
    console.log('\nA. Guided steps and options');
    check('Create 2.0 mounted: 6 steps, step 1 visible, Next present', await page.evaluate(() => document.querySelectorAll('#cfSteps li').length === 6 && !document.querySelector('.cf-step[data-step="1"]').hidden && !!document.getElementById('cfNext')));
    check('legacy prompt-first composer gone (no Image/Video toggle, no Meta placement control in Create)', await page.evaluate(() => !document.getElementById('ov3ModeSeg') && !document.getElementById('cr2MetaPlacementSection')));
    check('placeholder no longer teaches budget/targeting in the prompt', await page.evaluate(() => !/budget|€30/i.test(document.getElementById('aicInput').placeholder)));
    await next(page);
    check('step 1 Next with empty fields → stays, explains what is missing, no request', (await st(page)).step === 1 && /name/i.test(await page.textContent('#cfNavMsg')) && o.createCalls.length === 0);
    await page.fill('#cfName', 'Wallet'); await next(page);
    check('…description still missing → stays on step 1', (await st(page)).step === 1 && /description/i.test(await page.textContent('#cfNavMsg')));
    await reset(page); await step1(page);
    check('step 2 shows the four platforms with plain explanations', await page.evaluate(() => ['google', 'meta', 'tiktok', 'pinterest'].every((p) => { const b = document.querySelector('#cfPlatforms [data-plat="' + p + '"]'); return b && b.querySelector('.cf-card-d').textContent.length > 20; })));
    await next(page);
    check('step 2 Next without a platform → stays (platform must be chosen explicitly)', (await st(page)).step === 2);
    await page.screenshot({ path: path.join(SHOT_DIR, '02_platforms_1440.png') });

    const EXPECT_GOALS = { google: ['Sales', 'Traffic', 'Leads', 'Awareness'], meta: ['Sales', 'Traffic', 'Leads', 'Awareness'], tiktok: ['Traffic', 'Awareness'], pinterest: ['Sales', 'Traffic', 'Leads', 'Awareness'] };
    for (const p of Object.keys(EXPECT_GOALS)) {
      await reset(page); await step1(page);
      await page.click('#cfPlatforms [data-plat="' + p + '"]'); await next(page);
      const goals = await page.evaluate(() => [...document.querySelectorAll('#cr2GoalGrid .cr2-goal-card')].map((b) => ({ g: b.getAttribute('data-goal'), on: b.getAttribute('aria-disabled') !== 'true', why: (b.querySelector('.cf-card-why') || {}).textContent || '' })));
      check(`${p}: enabled goals = ${EXPECT_GOALS[p].join(', ')}; disabled ones explain why`, JSON.stringify(goals.filter((x) => x.on).map((x) => x.g).sort()) === JSON.stringify(EXPECT_GOALS[p].slice().sort()) && goals.filter((x) => !x.on).every((x) => x.why.length > 30), goals);
    }
    // TikTok sales: disabled goal can't be selected
    await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="tiktok"]'); await next(page);
    await page.click('#cr2GoalGrid [data-goal="Sales"]', { force: true }); // a user CAN click an aria-disabled card
    check('TikTok: clicking the disabled “sales” goal selects nothing and explains the alternative', (await st(page)).goal === null && /website visitors|Meta|Google/.test(await page.textContent('#cfNavMsg')));
    await page.screenshot({ path: path.join(SHOT_DIR, '03_tiktok_goals.png') });
    const navBelow = await page.evaluate(() => { const out = []; for (let n = 1; n <= 6; n++) { orvCreate.setState({ step: n, maxStep: 6 }); const sec = document.querySelector('#page-create .cf-step[data-step="' + n + '"]'); const nav = document.querySelector('#page-create .cf-nav'); out.push(sec.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top + 1); } orvCreate.setState({ step: 3 }); return out; });
    check('Back/Next row sits below the step content on every step (1–6)', navBelow.every(Boolean), navBelow);

    const EXPECT_FORMATS = [
      ['google', 'Sales', ['text', 'image'], ['video']], ['google', 'Traffic', ['text', 'image'], ['video']],
      ['meta', 'Sales', ['image'], ['video']], ['tiktok', 'Traffic', ['video'], ['image']],
      ['pinterest', 'Sales', ['image', 'video'], []],
    ];
    for (const [p, g, on, off] of EXPECT_FORMATS) {
      await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="' + p + '"]'); await next(page);
      await page.click('#cr2GoalGrid [data-goal="' + g + '"]'); await next(page);
      const f = await page.evaluate(() => [...document.querySelectorAll('#cfFormats .cf-fmt')].map((b) => ({ f: b.getAttribute('data-format'), on: b.getAttribute('aria-disabled') !== 'true', sel: b.getAttribute('aria-checked') === 'true', why: (b.querySelector('.cf-card-why') || {}).textContent || '' })));
      const okOn = JSON.stringify(f.filter((x) => x.on).map((x) => x.f)) === JSON.stringify(on);
      const okOff = off.every((x) => f.some((y) => y.f === x && !y.on && y.why.length > 30));
      const auto = on.length === 1 ? f.some((y) => y.f === on[0] && y.sel) && !(await page.locator('#cfFormatNote').isHidden()) : true;
      check(`${p}/${g}: formats offered = ${on.join('+')}${off.length ? ', disabled with reason: ' + off.join('+') : ''}${on.length === 1 ? ', auto-selected with an explanation' : ''}`, okOn && okOff && auto, f);
    }
    // Google: Image → PMax for Sales; Advanced: switching to Search changes format to text, with a notice.
    await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="google"]'); await next(page);
    await page.click('#cr2GoalGrid [data-goal="Sales"]'); await next(page);
    await page.click('#cfFormats [data-format="image"]');
    check('Google image ad for sales → Performance Max, with the business name/logo note', (await st(page)).campaignType === 'PERFORMANCE_MAX' && /logo/i.test(await page.textContent('#cfFormatNote')));
    check('advanced settings are collapsed by default', await page.evaluate(() => !document.getElementById('cfAdvanced').open));
    await page.evaluate(() => { document.getElementById('cfAdvanced').open = true; });
    await page.click('#cfAdvBody [data-gtype="SEARCH"]');
    const s4 = await st(page);
    check('advanced: choosing Search switches the format to Text automatically and says so', s4.campaignType === 'SEARCH' && s4.format === 'text' && /text/i.test(await page.textContent('#cfNavMsg')), s4);
    check('Search has no "number of images" cost; structure control present (Search supports ad groups)', await page.locator('#cfGroups').count() === 1);
    await page.click('#cfAdvBody [data-gtype="DEMAND_GEN"]');
    check('advanced: choosing Demand Gen switches to Image and hides the ad-count control (always one ad)', (await st(page)).format === 'image' && await page.locator('#cfGroups').count() === 0);
    check('the Image format card names the ad type actually chosen (Demand Gen, not the Performance Max default)', /Demand Gen/.test(await page.textContent('#cfFormats [data-format="image"]')), await page.textContent('#cfFormats [data-format="image"]'));
    await page.screenshot({ path: path.join(SHOT_DIR, '04_google_advanced.png') });
    // Platform change after format: Meta → TikTok resets format with a notice.
    await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="pinterest"]'); await next(page);
    await page.click('#cr2GoalGrid [data-goal="Traffic"]'); await next(page); await page.click('#cfFormats [data-format="image"]');
    await page.click('[data-go="2"]'); await page.click('#cfPlatforms [data-plat="tiktok"]');
    const sw = await st(page);
    check('changing platform after choosing an image (Pinterest → TikTok): format becomes video, with an explanation — never silent', sw.format === 'video' && /video/i.test(await page.textContent('#cfNavMsg')), { sw, msg: await page.textContent('#cfNavMsg') });
    await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="meta"]'); await next(page);
    await page.click('#cr2GoalGrid [data-goal="Leads"]');
    await page.click('[data-go="2"]'); await page.click('#cfPlatforms [data-plat="tiktok"]');
    check('changing platform with an unsupported goal (Meta leads → TikTok): goal cleared with a notice', (await st(page)).goal === null && /isn’t available|choose another/i.test(await page.textContent('#cfNavMsg')));
    // Pinterest Video Completion: only with video + awareness
    await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="pinterest"]'); await next(page);
    await page.click('#cr2GoalGrid [data-goal="Sales"]'); await next(page); await page.click('#cfFormats [data-format="video"]');
    await page.evaluate(() => { document.getElementById('cfAdvanced').open = true; });
    check('Pinterest: Video Completion offered but disabled for a sales goal (with reason)', await page.locator('#cfAdvBody [data-obj="Video Completion"][aria-disabled="true"]').count() === 1);
    console.log('  page errors:', o.errors.filter((e) => !/supabase|Failed to fetch/i.test(e)).slice(0, 5));
    check('no JavaScript errors from Create (blocked-Supabase noise excluded)', !o.errors.some((e) => !/supabase|Failed to fetch|fetch/i.test(e)), o.errors);
    await page.close();
  }

  // ── B. Requests per kind of publishable ad ──────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const o = {}; await arm(page, o); await enterCreate(page, o);
    console.log('\nB. Generation requests (structured brief, assets, credits shown)');
    const CASES = [
      { name: 'Google Search text ad', cfg: { platform: 'google', goal: 'Leads', format: 'text' }, type: 'SEARCH', imgs: 0, vids: 0, cost: 25 },
      { name: 'Google Search text ad with 2×2 ad groups (still no images)', cfg: { platform: 'google', goal: 'Sales', format: 'text', ads: [2, 2] }, type: 'SEARCH', imgs: 0, vids: 0, cost: 25 },
      { name: 'Google Performance Max (sales, image)', cfg: { platform: 'google', goal: 'Sales', format: 'image' }, type: 'PERFORMANCE_MAX', imgs: 3, vids: 0, cost: 250 },
      { name: 'Google Demand Gen (visitors, image)', cfg: { platform: 'google', goal: 'Traffic', format: 'image' }, type: 'DEMAND_GEN', imgs: 1, vids: 0, cost: 100 },
      { name: 'Meta image ad (leads)', cfg: { platform: 'meta', goal: 'Leads', format: 'image' }, type: null, imgs: 1, vids: 0, cost: 100 },
      { name: 'Meta image ads 2×2', cfg: { platform: 'meta', goal: 'Sales', format: 'image', ads: [2, 2] }, type: null, imgs: 4, vids: 0, cost: 325 },
      { name: 'TikTok video ad (awareness)', cfg: { platform: 'tiktok', goal: 'Awareness', format: 'video' }, type: null, imgs: 0, vids: 1, cost: 225 },
      { name: 'Pinterest image ad (sales)', cfg: { platform: 'pinterest', goal: 'Sales', format: 'image' }, type: null, imgs: 1, vids: 0, cost: 100 },
      { name: 'Pinterest video ad, Video Completion (awareness)', cfg: { platform: 'pinterest', goal: 'Awareness', format: 'video', objective: 'Video Completion' }, type: null, imgs: 0, vids: 1, cost: 225 },
    ];
    for (const c of CASES) {
      const r = await build(page, o, c.cfg);
      const q = r.req || {};
      const okPayload = q.platform === c.cfg.platform && q.goal === c.cfg.goal && q.format === c.cfg.format && (c.type ? q.campaignType === c.type : true)
        && q.brief && q.brief.productName === 'Handmade leather wallet' && /free name engraving/.test(q.brief.description) && q.brief.language && !q.metaPlacement
        && (c.cfg.objective ? q.platformObjective === c.cfg.objective : !q.platformObjective)
        && (c.cfg.ads && c.cfg.platform === 'meta' ? (q.metaStructure && q.metaStructure.adSets === c.cfg.ads[0] && q.metaStructure.adsPerAdSet === c.cfg.ads[1]) : true);
      check(`${c.name}: payload = explicit platform/goal/format${c.type ? '/' + c.type : ''} + structured brief + language, no placement`, okPayload, q);
      check(`${c.name}: assets requested = ${c.imgs} image(s), ${c.vids} video(s)`, r.images.length === c.imgs && r.videos.length === c.vids, { images: r.images.length, videos: r.videos.length });
      check(`${c.name}: every creative request carries its adContext`, r.images.every((x) => x.adContext && x.adContext.platform === c.cfg.platform) && r.videos.every((x) => x.adContext && x.adContext.platform === c.cfg.platform), r.images.concat(r.videos).map((x) => x.adContext));
      check(`${c.name}: cost shown before creating = ${c.cost} credits (= server prices × assets)`, new RegExp('\\b' + c.cost + '\\b').test(r.shown.cost) && new RegExp('\\b' + c.cost + '\\b').test(r.shown.btn), r.shown);
    }
    // Website + offer + customise reach the brief; website read via the existing (free) analyzer.
    await reset(page);
    await page.fill('#cfName', 'Linen dress'); await page.fill('#aicInput', 'A summer linen dress.'); await page.fill('#cfWebsite', 'leathershop.example/dress'); await page.fill('#cfOffer', '€59');
    await next(page);
    await page.waitForTimeout(500);
    check('website is read with the existing free page analyzer (no credits) when leaving step 1', o.analyzeCalls.length >= 1 && o.analyzeCalls[o.analyzeCalls.length - 1].url === 'https://leathershop.example/dress', o.analyzeCalls);
    await page.click('#cfPlatforms [data-plat="meta"]'); await next(page); await page.click('#cr2GoalGrid [data-goal="Sales"]'); await next(page); await next(page);
    await page.fill('#cfAudience', 'Women 25–40'); await page.selectOption('#cfTone', 'Premium'); await page.click('#cfStyles [data-style="Minimalist"]');
    await page.fill('#cfNotes', 'Make it a TikTok video for TikTok, budget €50 per day');
    const conflicts = await page.textContent('#cfNoteConflicts');
    check('conflicting notes (platform + budget) show friendly notices, settings untouched', /Meta Ads/.test(conflicts) && /budget/i.test(conflicts) && (await st(page)).platform === 'meta', conflicts);
    await next(page);
    await page.waitForFunction(() => !window._cgrInFlight, null, { timeout: 15000 }); // the previous case's build must finish first (one build at a time)
    const c0 = o.createCalls.length; await page.click('#aicGenBtn'); for (let i = 0; i < 40 && o.createCalls.length === c0; i++) await page.waitForTimeout(100);
    const q = o.createCalls[c0] || {};
    check('brief carries website, offer, audience, tone, styles and notes; platform stays Meta despite the note', q.platform === 'meta' && q.brief && q.brief.website === 'leathershop.example/dress' && q.brief.offer === '€59' && q.brief.audience === 'Women 25–40' && q.brief.tone === 'Premium' && q.brief.styles.includes('Minimalist') && /TikTok/.test(q.brief.notes), q.brief);
    check('page context from the website is sent too (existing pageContext field)', q.pageContext && q.pageContext.title === 'Leather Shop');
    await page.waitForTimeout(800);
    // Legacy 4-argument cgrGenerate still works (other callers).
    await page.evaluate(() => { window._cgrInFlight = null; window.cgrGenerate('Organic coffee', 'google', 'images', 'Sales'); });
    await page.waitForTimeout(900);
    const legacy = o.createCalls[o.createCalls.length - 1] || {};
    check('legacy cgrGenerate(prompt, platform, mode, goal) still sends a valid request (no brief, server reads it as a Search ad)', legacy.product === 'Organic coffee' && !legacy.brief && legacy.platform === 'google');
    await page.close();
  }

  // ── C. Unsupported combinations, server 422, insufficient credits ─
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const o = {}; await arm(page, o); await enterCreate(page, o);
    console.log('\nC. Never charge for an ad Launch cannot publish');
    await reset(page);
    await page.evaluate(() => orvCreate.setState({ step: 6, maxStep: 6, productName: 'Wallet', description: 'Leather wallet', platform: 'meta', goal: 'Sales', format: 'video' }));
    const s = await st(page);
    check('forcing Meta + video into the state: corrected to image with a notice (never kept)', s.format === 'image');
    await page.evaluate(() => orvCreate.setState({ step: 6, maxStep: 6, productName: 'Wallet', description: 'Leather wallet', platform: 'tiktok', goal: 'Sales', format: 'video' }));
    check('forcing TikTok + sales: goal cleared, review blocks creation', (await st(page)).goal === null);
    const c0 = o.createCalls.length;
    await page.evaluate(() => orvCreate.generate());
    await page.waitForTimeout(500);
    check('…and generate() sends nothing (no create-ad request, so no charge)', o.createCalls.length === c0 && (await st(page)).step === 3);
    // Server-side refusal is shown clearly (simulates an old client / stale cache).
    await page.evaluate(() => { window._cgrInFlight = null; window.cgrGenerate('Wallet', 'tiktok', 'images', 'Traffic', { format: 'image' }); });
    await page.waitForTimeout(1500);
    const errTxt = await page.evaluate(() => document.body.innerText);
    check('server 422 UNSUPPORTED_COMBINATION → clear message incl. "No credits were used", no images requested', /No credits were used/.test(errTxt) && o.imageCalls.length === 0 && o.videoCalls.length === 0);
    await page.screenshot({ path: path.join(SHOT_DIR, '05_server_422.png') });
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const o = { balance: 50 }; await arm(page, o); await enterCreate(page, o);
    await page.evaluate(() => { window._isFreeUser = function () { return false; }; });
    await reset(page); await step1(page);
    await page.click('#cfPlatforms [data-plat="meta"]'); await next(page); await page.click('#cr2GoalGrid [data-goal="Sales"]'); await next(page); await next(page); await next(page);
    await page.click('#aicGenBtn'); await page.waitForTimeout(900);
    check('insufficient credits (50 for a 100-credit ad): blocked before any request, needed vs balance shown', o.createCalls.length === 0 && /100/.test(await page.evaluate(() => document.body.innerText)) && /50/.test(await page.evaluate(() => document.body.innerText)));
    await page.screenshot({ path: path.join(SHOT_DIR, '06_insufficient.png') });
    await page.close();
  }

  // ── D. Language, Research, onboarding draft, i18n, keyboard, mobile ─
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const o = {}; await arm(page, o); await enterCreate(page, o);
    console.log('\nD. Language, integrations, accessibility, layout');
    const s0 = await st(page);
    check('advertising language from the business COUNTRY (Netherlands) → Dutch, marked as a suggestion (not confirmed)', s0.language === 'nl' && s0.languageSource === 'country');
    await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="meta"]'); await next(page); await page.click('#cr2GoalGrid [data-goal="Sales"]'); await next(page); await next(page);
    check('…the suggestion is visible and editable in step 5', /Suggested from your business country/.test(await page.textContent('#cfLangSrc')) && (await page.inputValue('#cfLanguage')) === 'nl');
    await page.selectOption('#cfLanguage', 'de');
    check('changing the language → source "user"', (await st(page)).language === 'de' && (await st(page)).languageSource === 'user');
    await page.evaluate(() => { window.CURRENT_LANG = 'fr'; });
    await page.evaluate(() => orvCreate.onBusiness({ profile: { languages: ['Dutch'], country: 'BE' } }));
    check('a user-chosen language is never overwritten by the profile', (await st(page)).language === 'de');
    await page.evaluate(() => { window.CURRENT_LANG = 'en'; orvCreate.setState({ languageSource: null }); orvCreate.onBusiness({ profile: { languages: ['Dutch'] } }); });
    check('profile languages → used as confirmed default; interface language is not used', (await st(page)).language === 'nl' && (await st(page)).languageSource === 'profile');
    await page.evaluate(() => { orvCreate.setState({ languageSource: null }); orvCreate.onBusiness({ profile: {} }); });
    check('no profile language/country → English, marked as a default suggestion', (await st(page)).language === 'en' && (await st(page)).languageSource === 'default');

    // Research → Create
    await reset(page);
    await page.fill('#cfName', 'Coffee beans'); await page.fill('#aicInput', 'Single-origin coffee beans.');
    // Research 2.0: only the insights the user selected travel (js/research.js → orvWorkspace.research.setHandoff).
    await page.evaluate(() => {
      orvWorkspace.research.setHandoff({ question: 'coffee market', summary: 'The Dutch coffee market is growing.', researchType: 'opportunity', reportId: 'r-1',
        findings: [{ id: 'Opportunity:o1', group: 'Opportunity', text: 'Subscription bundles for offices', basis: 'idea', sources: [] }, { id: 'Key conclusion:k0', group: 'Key conclusion', text: 'Offices buy in bulk', basis: 'source_checked', sources: [{ title: 'News', url: 'https://news.example/x', domain: 'news.example' }] }] });
      orvCreate.applyResearch({ opportunities: [{ title: 'Subscription bundles for offices' }] });
    });
    await page.waitForTimeout(500);
    const rs = await st(page);
    check('Research → Create: the market summary does NOT overwrite the product description', rs.description === 'Single-origin coffee beans.' && rs.productName === 'Coffee beans');
    check('Research → Create: nothing is written into the notes automatically', !/Subscription bundles/.test(rs.notes || ''));
    const rp = await page.evaluate(() => orvWorkspace.research.payload());
    check('Research → Create: selected insights travel with type, report id, evidence label and sources', rp && rp.researchType === 'opportunity' && rp.reportId === 'r-1' && rp.findings.length === 2 && rp.findings[1].basis === 'source_checked' && rp.findings[1].sources[0].domain === 'news.example', rp);
    await page.evaluate(() => orvWorkspace.research.clearHandoff());

    // Onboarding draft save → restore
    await reset(page); await step1(page, 'Yoga mat', 'A non-slip cork yoga mat.');
    await page.click('#cfPlatforms [data-plat="pinterest"]'); await next(page); await page.click('#cr2GoalGrid [data-goal="Traffic"]');
    const restored = await page.evaluate((E) => {
      if (typeof _ob3SaveDraft !== 'function' || typeof orvResumeDraft !== 'function') return 'missing';
      _ob3SaveDraft('create'); orvCreate.setState(E); orvResumeDraft('payment');
      return new Promise((res) => setTimeout(() => res(orvCreate.getState()), 400));
    }, EMPTY);
    check('onboarding draft (paywall round-trip) restores the full guided state', restored && restored.productName === 'Yoga mat' && restored.platform === 'pinterest' && restored.goal === 'Traffic', restored);
    const legacyRestore = await page.evaluate((E) => { orvCreate.setState(E); try { localStorage.setItem('ob3_draft', ''); } catch (_) {} if (typeof _ob3RestoreCreate !== 'function') return 'missing'; _ob3RestoreCreate({ prompt: 'Old prompt text', platform: 'meta', goal: 'Sales', mode: 'images' }); return new Promise((res) => setTimeout(() => res(orvCreate.getState()), 400)); }, EMPTY);
    check('an OLD draft (prompt/platform/goal) restores into the new flow (prompt → description)', legacyRestore && legacyRestore.description === 'Old prompt text' && legacyRestore.platform === 'meta' && legacyRestore.goal === 'Sales', legacyRestore);
    // A restore that jumps straight to Review must leave the Stage on the restored platform, not a Google default.
    const stageAfter = await page.evaluate(() => { orvCreate.setState({ step: 6, maxStep: 6, productName: 'Wallet', description: 'Leather wallet', platform: 'meta', goal: 'Sales', format: 'image', groups: 1, adsPerGroup: 1 }); const p = document.querySelector('#cr2Stage .cr2-stage-provider'); return p ? p.textContent : ''; });
    check('restored draft: Creative Stage shows the restored platform (Meta), not Google', /Meta/.test(stageAfter) && !/Google/.test(stageAfter), stageAfter);
    const stageNone = await page.evaluate(() => { orvCreate.setState({ step: 1, maxStep: 1, platform: null, goal: null, format: null }); const p = document.querySelector('#cr2Stage .cr2-stage-provider'); return p ? p.textContent : ''; });
    check('no platform chosen yet: Stage says so instead of showing Google Ads', !/Google/.test(stageNone) && /platform/i.test(stageNone), stageNone);
    const stagePmax = await page.evaluate(() => { orvCreate.setState({ step: 4, maxStep: 4, platform: 'google', goal: 'Sales', format: 'image', campaignType: 'PERFORMANCE_MAX', groups: 3, adsPerGroup: 2 }); const p = document.querySelector('#cr2Stage .cr2-stage-struct'); return p ? p.textContent : ''; });
    check('Performance Max on the Stage reads as one ad, not an ad-group count', /1 ad$/.test(stagePmax.trim()) && !/group/.test(stagePmax), stagePmax);

    // Keyboard
    await reset(page); await step1(page);
    await page.focus('#cfPlatforms [data-plat="google"]'); await page.keyboard.press('ArrowRight');
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-plat'));
    await page.keyboard.press('Enter');
    check('keyboard: arrow keys move between platform options, Enter selects', focused === 'meta' && (await st(page)).platform === 'meta', focused);
    check('step headings receive focus on navigation (screen-reader context)', await page.evaluate(() => { orvCreate.goTo(3); return document.activeElement && document.activeElement.id === 'cfS3h'; }));

    // Six interface languages
    const langs = ['en', 'nl', 'de', 'fr', 'es', 'pt'];
    const keys = await page.evaluate(() => { const S = orvCreate._STR; const en = Object.keys(S.en); const out = {}; Object.keys(S).forEach((l) => { out[l] = en.filter((k) => !(k in S[l])); }); return out; });
    check('all six interface languages define every Create text (no missing keys)', langs.every((l) => keys[l] && keys[l].length === 0), keys);
    const titles = {};
    for (const l of langs) titles[l] = await page.evaluate((lg) => { window.CURRENT_LANG = lg; orvCreate.relabel(); return document.getElementById('cfTitle').textContent; }, l);
    check('switching interface language relabels Create (6 different titles)', new Set(Object.values(titles)).size === 6, titles);
    await page.evaluate(() => { window.CURRENT_LANG = 'en'; orvCreate.relabel(); });
    await page.close();
  }
  // ── E. Final polish: price, website errors, ad quantity, own images, Stage ─
  {
    const sharp = require('C:/files/oriven-backend/server/node_modules/sharp');
    const img = async (w, h, fmt) => { const s = sharp({ create: { width: w, height: h, channels: 3, background: '#a07850' } }); return (fmt === 'gif' ? s.gif() : fmt === 'jpeg' ? s.jpeg() : s.png()).toBuffer(); };
    const file = async (name, w, h, fmt) => ({ name, mimeType: fmt === 'gif' ? 'image/gif' : fmt === 'jpeg' ? 'image/jpeg' : 'image/png', buffer: await img(w, h, fmt) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const o = {}; await arm(page, o); await enterCreate(page, o);
    console.log('\nE. Price, website errors, ad quantity, own images, Creative Stage');
    const stageText = () => page.evaluate(() => document.getElementById('cr2Stage').textContent);
    const settle = () => page.waitForTimeout(260); // the Stage re-renders 120 ms after a change

    // Price & currency
    await reset(page);
    check('step 1 has a separate "Product price" and "Special offer" field', (await page.textContent('#cfPriceL')) === 'Product price' && (await page.textContent('#cfOfferL')) === 'Special offer' && (await page.getAttribute('#cfOffer', 'placeholder')) === 'e.g. Free shipping this weekend');
    check('currency suggested from the business country (Netherlands → EUR), shown as a suggestion', (await page.inputValue('#cfCurrency')) === 'EUR' && /suggested from your business country/i.test(await page.textContent('#cfPriceHelp')) && (await st(page)).currencySource === 'country');
    check('price placeholder is a subtle 0.00', (await page.getAttribute('#cfPrice', 'placeholder')) === '0.00');
    await page.fill('#cfPrice', ''); await page.type('#cfPrice', 'ab-12x.345');
    check('letters, minus signs and a third decimal never get into the price ("ab-12x.345" → "12.34")', (await page.inputValue('#cfPrice')) === '12.34', await page.inputValue('#cfPrice'));
    await page.fill('#cfPrice', ''); await page.type('#cfPrice', '29,9'); await page.click('#cfName');
    check('a comma works as decimal separator and the price is completed on blur ("29,9" → "29.90")', (await page.inputValue('#cfPrice')) === '29.90', await page.inputValue('#cfPrice'));
    await page.selectOption('#cfCurrency', 'JPY');
    check('a currency without decimals (JPY): "29.90" becomes "29", placeholder "0"', (await page.inputValue('#cfPrice')) === '29' && (await page.getAttribute('#cfPrice', 'placeholder')) === '0' && (await st(page)).currencySource === 'user');
    await page.selectOption('#cfCurrency', 'USD');
    await page.fill('#cfName', 'Linen dress'); await page.fill('#aicInput', 'A summer linen dress.');
    await page.fill('#cfPrice', '0'); await page.fill('#cfOffer', 'Free shipping this weekend');
    await settle();
    let stg = await stageText();
    check('Stage shows the product name, the price ($0.00) and the special offer live', /Linen dress/.test(stg) && /\$0\.00/.test(stg) && /Free shipping this weekend/.test(stg), stg.slice(0, 300));
    await page.type('#aicInput', ' Light and breathable.'); await page.waitForTimeout(450);
    check('typing the description keeps the Stage’s own status (the old prompt-first label never comes back)', /Ready to create|Next:/.test(await page.textContent('#owStageReady')) && !/Waiting for your brief|Choose a goal|Ready to build/.test(await stageText()), await page.textContent('#owStageReady'));
    await page.fill('#cfPrice', '149.95'); await settle();
    stg = await stageText();
    check('Stage never keeps an old price ($0.00 → $149.95)', /\$149\.95/.test(stg) && !/\$0\.00/.test(stg));
    await page.fill('#cfPrice', ''); await settle();
    check('an emptied price disappears from the Stage and is "no price", not 0', !/\$/.test(await stageText()) && (await st(page)).price === '');
    await page.fill('#cfPrice', '149.95');

    // Website messages
    o.analyzeFail = 'dns_failure';
    await page.fill('#cfWebsite', 'no-such-shop.example'); await page.click('#cfWebRead'); await page.waitForTimeout(400);
    let wm = await page.textContent('#cfWebMsg');
    check('unknown domain → friendly message (no "Could not resolve domain"), website is optional', /We couldn’t open this website\. Please check the address and try again\./.test(wm) && /optional/.test(wm) && !/resolve/i.test(wm), wm);
    check('…and no page context is claimed', await page.evaluate(() => !window._ov3PageContext));
    o.analyzeFail = 'timeout';
    await page.fill('#cfWebsite', 'slow-shop.example'); await page.click('#cfWebRead'); await page.waitForTimeout(400);
    check('temporary failure (timeout) reads differently from a wrong address', /didn’t respond/.test(await page.textContent('#cfWebMsg')));
    const before = o.analyzeCalls.length;
    await page.fill('#cfWebsite', 'not a website'); await page.click('#cfWebRead'); await page.waitForTimeout(200);
    check('an invalid address is explained without calling the analyzer', /doesn’t look like a website address/.test(await page.textContent('#cfWebMsg')) && o.analyzeCalls.length === before);
    o.analyzeFail = null;
    await page.fill('#cfWebsite', 'leathershop.example/dress'); await page.click('#cfWebRead'); await page.waitForTimeout(400);
    check('a readable page → "Page read: Leather Shop" and the page context is set', /Page read: Leather Shop/.test(await page.textContent('#cfWebMsg')) && await page.evaluate(() => !!(window._ov3PageContext && window._ov3PageContext.domain)));
    await page.fill('#cfWebsite', 'leathershop.example/other');
    check('changing the address drops the old page’s content immediately', await page.evaluate(() => !window._ov3PageContext) && await page.isHidden('#cfWebMsg'));
    o.analyzeFail = 'dns_failure';
    await next(page);
    check('a website that can’t be read never blocks the next step', (await st(page)).step === 2);
    o.analyzeFail = null;

    // Ad quantity — Meta ad sets, visible in step 4
    await page.click('#cfPlatforms [data-plat="meta"]'); await next(page);
    await page.click('#cr2GoalGrid [data-goal="Sales"]'); await next(page);
    check('step 4: "Number of ads" is visible in the step itself (not inside Advanced settings)', await page.isVisible('#cfQty') && await page.evaluate(() => !document.getElementById('cfQty').closest('details')));
    check('Meta uses ad sets: "Ad sets" × "Ads per ad set"', /Ad sets/.test(await page.textContent('#cfQty')) && /Ads per ad set/.test(await page.textContent('#cfQty')));
    await page.selectOption('#cfGroups', '2'); await page.selectOption('#cfPer', '3');
    check('2 ad sets × 3 ads → "Total: 6 ads"', (await page.textContent('#cfQtyTotal')) === 'Total: 6 ads');
    check('Meta image ad has no technical settings → Advanced settings not shown', await page.isHidden('#cfAdvanced'));
    check('image ads ask how the image is made (two clear options, AI selected by default)', await page.isVisible('#cfImgSrc') && /How would you like to create your ad image\?/.test(await page.textContent('#cfImgSrc')) && (await page.getAttribute('[data-imgsrc="ai"]', 'aria-checked')) === 'true' && /Upload your own image and let OrivenAI create the ad copy\./.test(await page.textContent('[data-imgsrc="own"]')));
    await settle();
    check('Stage: AI image placeholder (no fake image) and "6 ads"', await page.evaluate(() => !document.querySelector('#cr2Stage .cr2-stage-frame img')) && /created when you create the ad/.test(await stageText()) && /6 ads/.test(await stageText()));
    await next(page); await next(page);
    check('Review (AI images): 25 + 6 × 75 = 475 credits, itemised', /475 credits/.test(await page.textContent('#aicGenCost')) && /Ad text 25/.test(await page.textContent('#cfCostBreak')) && /6 × image \(75 each\)/.test(await page.textContent('#cfCostBreak')));
    check('Review shows "2 ad sets × 3 ads = 6 ads", the price and the special offer', /2 ad sets × 3 ads = 6 ads/.test(await page.textContent('#cfReview')) && /\$149\.95/.test(await page.textContent('#cfReview')) && /Free shipping this weekend/.test(await page.textContent('#cfReview')));

    // Own image
    await page.click('#cfReview [data-go="4"]');
    await page.click('[data-imgsrc="own"]');
    check('"Use my own image" shows an upload area with the requirements', await page.isVisible('#cfDrop') && /JPG or PNG · up to 8 MB · at least 600 × 314 pixels/.test(await page.textContent('#cfDrop')));
    await next(page);
    check('Next without an uploaded image → stays on step 4 and explains', (await st(page)).step === 4 && /Upload your image/.test(await page.textContent('#cfNavMsg')));
    const up0 = o.uploadCalls.length;
    await page.setInputFiles('#cfOwnInput', await file('tiny.png', 400, 300));
    await page.waitForTimeout(400);
    check('too small (400 × 300) → refused with the exact size and the minimum, nothing uploaded', /400 × 300/.test(await page.textContent('#cfImgSrc')) && /600 × 314/.test(await page.textContent('#cfImgSrc')) && o.uploadCalls.length === up0);
    await page.setInputFiles('#cfOwnInput', await file('anim.gif', 800, 800, 'gif'));
    await page.waitForTimeout(400);
    check('GIF → refused ("Use a JPG or PNG image"), nothing uploaded', /Use a JPG or PNG image/.test(await page.textContent('#cfImgSrc')) && o.uploadCalls.length === up0);
    await page.setInputFiles('#cfOwnInput', await file('wallet.png', 1200, 1200));
    for (let i = 0; i < 30 && o.uploadCalls.length === up0; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(300);
    let s1 = await st(page);
    check('valid 1200 × 1200 PNG → uploaded through the existing creative upload route (purpose ad_image)', o.uploadCalls.length === up0 + 1 && o.uploadCalls[up0].purpose === 'ad_image' && /^data:image\/png;base64,/.test(o.uploadCalls[up0].dataUrl) && s1.ownImages.length === 1 && /img-\d+\.png$/.test(s1.ownImages[0].url) && s1.ownImages[0].width === 1200, s1.ownImages);
    check('…preview listed with its size, with Replace and Remove', /wallet\.png/.test(await page.textContent('#cfImgSrc')) && /1200 × 1200 px/.test(await page.textContent('#cfImgSrc')) && await page.isVisible('[data-own-rep="0"]') && await page.isVisible('[data-own-rm="0"]'));
    check('…6 ads, 1 image: told it is reused for all ads (and that more can be added)', /used for all 6 ads/.test(await page.textContent('#cfImgSrc')));
    await settle();
    check('Stage shows the uploaded image immediately', await page.evaluate(() => { const i = document.querySelector('#cr2Stage .cr2-stage-frame img'); return !!i && /wallet|blob:|img-/.test(i.getAttribute('src') + i.getAttribute('alt')); }));
    const firstUrl = s1.ownImages[0].url;
    await page.click('[data-own-rep="0"]').catch(() => {});
    await page.setInputFiles('#cfOwnInput', await file('wallet-2.jpg', 1080, 1350, 'jpeg'));
    for (let i = 0; i < 30 && o.uploadCalls.length === up0 + 1; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(300);
    s1 = await st(page);
    check('Replace swaps the image in place (still 1 image, new file, new URL)', s1.ownImages.length === 1 && s1.ownImages[0].name === 'wallet-2.jpg' && s1.ownImages[0].url !== firstUrl, s1.ownImages);
    await page.click('[data-own-rm="0"]'); await settle();
    check('Remove → no image in the list, Stage back to "Upload your image in step 4" (no stale image)', (await st(page)).ownImages.length === 0 && await page.evaluate(() => !document.querySelector('#cr2Stage .cr2-stage-frame img')) && /Upload your image in step 4/.test(await stageText()));
    o.uploadStatus = 401;
    await page.setInputFiles('#cfOwnInput', await file('wallet.png', 1200, 1200));
    await page.waitForTimeout(700);
    check('upload refused (signed out) → "Sign in to upload your image", nothing kept', /Sign in to upload your image/.test(await page.textContent('#cfImgSrc')) && (await st(page)).ownImages.length === 0);
    o.uploadStatus = null;
    await page.setInputFiles('#cfOwnInput', await file('wallet.png', 1200, 1200));
    await page.waitForTimeout(800);
    await next(page); await next(page);
    check('Review (own image, 6 ads): 25 credits — "6 × your own image (0 credits)", no image charge', /^25 credits$/.test((await page.textContent('#aicGenCost')).trim()) && /6 × your own image \(0 credits\)/.test(await page.textContent('#cfCostBreak')) && !/× image \(75/.test(await page.textContent('#cfCostBreak')), await page.textContent('#cfCostBreak'));
    check('Review row "Image: Your own image (1)"', /Your own image \(1\)/.test(await page.textContent('#cfReview')));

    // Persistence: reload the tab, the draft (with the uploaded image) comes back
    await enterCreate(page, o, true); // a fresh page load in the same tab
    await page.evaluate(() => orvCreate.goTo(4));
    await settle();
    const s2 = await st(page);
    check('after reloading the page, the draft keeps the uploaded image and the 2 × 3 structure', s2.imageSource === 'own' && s2.ownImages.length === 1 && /img-\d+\.png$/.test(s2.ownImages[0].url) && s2.groups === 2 && s2.adsPerGroup === 3 && s2.price === '149.95' && s2.offer === 'Free shipping this weekend', s2);
    check('…and the Stage shows it again', await page.evaluate(() => { const i = document.querySelector('#cr2Stage .cr2-stage-frame img'); return !!i && /img-\d+\.png/.test(i.getAttribute('src')); }));

    // Generate with own image → no image generation call at all
    await page.evaluate(() => orvCreate.goTo(6));
    const c0 = o.createCalls.length, i0 = o.imageCalls.length;
    await page.waitForFunction(() => !window._cgrInFlight, null, { timeout: 15000 });
    await page.click('#aicGenBtn');
    for (let i = 0; i < 40 && o.createCalls.length === c0; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(1600);
    const q = o.createCalls[c0] || {};
    check('create-ad gets imageSource "own", price 149.95 USD, offer, structure 2 × 3', q.brief && q.brief.imageSource === 'own' && q.brief.price === 149.95 && q.brief.currency === 'USD' && q.brief.offer === 'Free shipping this weekend' && q.metaStructure && q.metaStructure.adSets === 2 && q.metaStructure.adsPerAdSet === 3, q.brief);
    check('own image: ZERO /api/generate-image calls (no image credits can be charged)', o.imageCalls.length === i0, o.imageCalls.length - i0);
    check('…every ad slot uses the uploaded image (6 cards marked "your image")', await page.evaluate(() => document.querySelectorAll('#cgrCreativesGrid .cgr-creative-card').length === 6 && [...document.querySelectorAll('#cgrCreativesGrid .cgr-creative-ref')].every((e) => /your image/.test(e.textContent))));
    const pkgImgs = await page.evaluate(() => { const p = window._cgrLastPkg(); return (p.visualConcepts || []).map((v) => v.generatedImageUrl); });
    check('…and the package handed to Launch carries the uploaded image URL', pkgImgs.length && pkgImgs.every((u) => /img-\d+\.png$/.test(u)), pkgImgs);
    const est = await page.evaluate(() => window._cgrLastPkg().inputs.creditEstimate);
    check('server estimate (same shared rule) = the 25 credits Review showed', est && est.total === 25 && est.ownImageSlots === 6, est);

    // AI image path still generates (and the Stage shows the real generated image afterwards)
    await page.waitForFunction(() => !window._cgrInFlight, null, { timeout: 15000 });
    await page.evaluate(() => { _orvNav('create', 'page-create'); orvCreate.setState({ step: 6, maxStep: 6, imageSource: 'ai', groups: 1, adsPerGroup: 1 }); });
    await page.waitForTimeout(200);
    const i1 = o.imageCalls.length, c1 = o.createCalls.length;
    await page.click('#aicGenBtn');
    for (let i = 0; i < 40 && o.createCalls.length === c1; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(1600);
    check('"Generate with AI": the existing image generation runs (1 image for 1 ad)', o.imageCalls.length === i1 + 1 && (o.createCalls[c1].brief || {}).imageSource === 'ai');
    await page.waitForFunction(() => !window._cgrInFlight, null, { timeout: 15000 });
    await page.evaluate(() => { _orvNav('create', 'page-create'); window._cr2RenderStage(); });
    await settle();
    check('back in Create, the Stage shows the real generated image for this ad', await page.evaluate(() => { const i = document.querySelector('#cr2Stage .cr2-stage-frame img'); return !!i && /^data:image\/png/.test(i.getAttribute('src')); }) && /Generated/.test(await stageText()));
    await page.evaluate(() => orvCreate.setState({ format: null, platform: 'tiktok', goal: 'Traffic' }));
    await settle();
    check('switching to TikTok (video): Stage shows TikTok + video placeholder, no image', /TikTok Ads/.test(await stageText()) && await page.evaluate(() => document.querySelector('#cr2Stage .cr2-stage-frame').getAttribute('data-format') === 'video' && !document.querySelector('#cr2Stage .cr2-stage-frame img')) && !/Meta Ads/.test(await stageText()));

    // Google: ad groups / fixed structures; Performance Max own image → crop notice
    await reset(page); await step1(page);
    await page.click('#cfPlatforms [data-plat="google"]'); await next(page); await page.click('#cr2GoalGrid [data-goal="Sales"]'); await next(page);
    await page.click('#cfFormats [data-format="text"]');
    check('Google Search: "Ad groups" × "Ads per ad group", extra ads cost no extra credits', /Ad groups/.test(await page.textContent('#cfQty')) && /Ads per ad group/.test(await page.textContent('#cfQty')) && /cost no extra credits/.test(await page.textContent('#cfQty')) && await page.isHidden('#cfImgSrc'));
    await page.click('#cfFormats [data-format="image"]');
    check('Performance Max: fixed "Total: 1 ad" with the reason, no quantity selects', (await page.locator('#cfGroups').count()) === 0 && /Total: 1 ad/.test(await page.textContent('#cfQty')) && /one asset group/.test(await page.textContent('#cfQty')));
    check('…Advanced settings exist for Google but stay collapsed', await page.isVisible('#cfAdvanced') && await page.evaluate(() => !document.getElementById('cfAdvanced').open));
    await page.click('[data-imgsrc="own"]');
    const up1 = o.uploadCalls.length;
    await page.setInputFiles('#cfOwnInput', await file('square.png', 1200, 1200));
    for (let i = 0; i < 30 && o.uploadCalls.length === up1; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(300);
    check('Performance Max with a square image → told Google needs a landscape (1.91:1) version, centre-cropped at publish (never silent)', /landscape \(1\.91:1\)/.test(await page.textContent('#cfImgSrc')) && /centre-crops/.test(await page.textContent('#cfImgSrc')));
    await next(page); await next(page);
    check('Performance Max own image: 25 credits (3 own image slots, 0 image credits)', /^25 credits$/.test((await page.textContent('#aicGenCost')).trim()) && /3 × your own image/.test(await page.textContent('#cfCostBreak')));
    const i2 = o.imageCalls.length;
    await page.waitForFunction(() => !window._cgrInFlight, null, { timeout: 15000 });
    await page.click('#aicGenBtn');
    await page.waitForTimeout(2200);
    check('…generate: 0 image generation calls, all 3 asset slots use the upload', o.imageCalls.length === i2 && await page.evaluate(() => document.querySelectorAll('#cgrCreativesGrid .cgr-creative-card img').length === 3), o.imageCalls.length - i2);

    // Pinterest wide image notice
    await page.waitForFunction(() => !window._cgrInFlight, null, { timeout: 15000 });
    await page.evaluate(() => { _orvNav('create', 'page-create'); orvCreate.setState({ step: 4, maxStep: 4, platform: 'pinterest', goal: 'Sales', format: 'image', imageSource: 'own', ownImages: [{ url: 'https://storage.example.invalid/x/wide.png', name: 'wide.png', width: 1910, height: 1000, bytes: 1000, type: 'image/png' }] }); });
    check('Pinterest + a wide image → told Pins look best tall (2:3)', /Pins look best tall \(2:3\)/.test(await page.textContent('#cfImgSrc')));

    // Customise choices land on the Stage as they are made
    await page.evaluate(() => orvCreate.setState({ step: 5, maxStep: 5, productName: 'Wallet', description: 'Leather wallet', platform: 'meta', goal: 'Leads', format: 'image', imageSource: 'ai', ownImages: [], tone: '', styles: [], notes: '' }));
    await page.selectOption('#cfTone', 'Playful'); await page.click('#cfStyles [data-style="Minimalist"]'); await page.fill('#cfNotes', 'Mention the engraving'); await page.selectOption('#cfLanguage', 'de'); await page.fill('#cfAudience', 'Gift buyers');
    await settle();
    stg = await stageText();
    check('Stage updates live with goal, language, audience, tone, style and notes', /Generate leads/.test(stg) && /German/.test(stg) && /Gift buyers/.test(stg) && /Playful/.test(stg) && /Minimalist/.test(stg) && /Mention the engraving/.test(stg) && /Generated with AI/.test(stg), stg.slice(0, 400));
    await page.click('#cfStyles [data-style="Minimalist"]'); await page.fill('#cfNotes', ''); await settle();
    check('…and drops a style or note as soon as it is removed', !/Minimalist/.test(await stageText()) && !/Mention the engraving/.test(await stageText()));

    // All six languages render the new texts (no raw keys)
    const L = {};
    for (const l of ['en', 'nl', 'de', 'fr', 'es', 'pt']) {
      L[l] = await page.evaluate((lg) => { window.CURRENT_LANG = lg; orvCreate.relabel(); orvCreate.goTo(4); const t = document.getElementById('cfImgSrc').textContent + document.getElementById('cfQty').textContent + document.getElementById('cr2Stage').textContent; orvCreate.goTo(1); return { src: document.getElementById('cfImgSrcL') ? document.getElementById('cfImgSrcL').textContent : '', price: document.getElementById('cfPriceL').textContent, raw: /\b(qTotal|imgSrcL|src_own|stEyebrow|upChoose|priceL|webErr)\b/.test(t) }; }, l);
    }
    check('six languages: the image-source question, price label and Stage are translated (6 different), no raw keys', new Set(Object.values(L).map((x) => x.src)).size === 6 && new Set(Object.values(L).map((x) => x.price)).size === 6 && Object.values(L).every((x) => !x.raw), L);
    await page.evaluate(() => { window.CURRENT_LANG = 'en'; orvCreate.relabel(); });

    // Old saved draft with the combined "price or offer" field still works
    const old = await page.evaluate(() => { orvCreate.setState({ step: 1, maxStep: 1, productName: 'Old', description: 'Old draft', offer: '€45, or 10% off this week', price: undefined }); return { offer: document.getElementById('cfOffer').value, price: document.getElementById('cfPrice').value, brief: null }; });
    check('an older draft’s combined "price or offer" text stays in Special offer (never guessed into a price)', old.offer === '€45, or 10% off this week' && old.price === '');
    await page.close();

    // Mobile: step 4 with own image + quantity
    for (const [w, h] of [[390, 844], [360, 800]]) {
      const mp = await browser.newPage({ viewport: { width: w, height: h } });
      const mo = {}; await arm(mp, mo); await enterCreate(mp, mo);
      await mp.evaluate(() => orvCreate.setState({ step: 4, maxStep: 4, productName: 'Wallet', description: 'Leather wallet', price: '29.99', platform: 'meta', goal: 'Sales', format: 'image', groups: 2, adsPerGroup: 3, imageSource: 'own', ownImages: [{ url: 'https://storage.example.invalid/x/a.png', name: 'a-very-long-file-name-for-the-wallet-photo.png', width: 1200, height: 1200, bytes: 1000, type: 'image/png' }] }));
      await mp.waitForTimeout(300);
      const ov = await mp.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, box: document.getElementById('aicInputWrap').getBoundingClientRect().right - window.innerWidth }));
      check(`${w}×${h}: step 4 with image source, upload list and quantity fits (no horizontal overflow)`, ov.doc <= 1 && ov.box <= 1, ov);
      await mp.screenshot({ path: path.join(SHOT_DIR, '08_own_qty_' + w + '.png'), fullPage: true });
      await mp.close();
    }
  }
  {
    for (const [w, h] of [[390, 844], [360, 800], [768, 1024]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const o = {}; await arm(page, o); await enterCreate(page, o);
      await reset(page); await step1(page); await page.click('#cfPlatforms [data-plat="tiktok"]'); await next(page); await page.click('#cr2GoalGrid [data-goal="Traffic"]'); await next(page);
      const ov = await page.evaluate(() => { const el = document.getElementById('page-create'); return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, box: (document.getElementById('aicInputWrap').getBoundingClientRect().right - window.innerWidth) }; });
      check(`${w}×${h}: no horizontal overflow, steps usable`, ov.doc <= 1 && ov.box <= 1 && (await st(page)).step === 4, ov);
      await page.screenshot({ path: path.join(SHOT_DIR, '07_format_' + w + '.png'), fullPage: false });
      await page.close();
    }
  }

  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); srv.close(); process.exit(2); });
