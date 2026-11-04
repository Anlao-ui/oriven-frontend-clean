/* ════════════════════════════════════════════════════════════════
   Create → My Content (js/myContent.js) in the real app.html: empty state,
   the library from GET /api/creative/assets, search / filters / sorting,
   preview, download, copy, favourite, delete, a rendering video getting its
   link, and the content still there after a reload.

   SAFETY: a network fence. The page may reach ONLY this test's own server
   (the app's dev API base http://localhost:5500 is rewritten to it); every
   other host is aborted. No real users, nothing written anywhere.

   RUN: node tests/my-content-ui.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const PORT = 8963, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOTS = path.join(__dirname, '_shots', 'my-content'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }

// A 1×1 PNG served as the stored image.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const calls = [];
const M = { assets: [], videoDone: false };
const t = (m) => new Date(Date.now() - m * 60e3).toISOString();
const SEED = () => [
  { id: 'img1', kind: 'image', title: 'Candle on a linen shelf', content: { url: DEV_API + '/__media/candle.png' }, source_route: '/api/generate-image', created_at: t(60 * 24 * 3), favorite: false, status: 'draft' },
  { id: 'vid1', kind: 'video', title: 'Slow pour reel', content: { generationId: 'gen-9', prompt: 'slow pour' }, source_route: '/api/video-ads/generate', created_at: t(30), favorite: false },
  { id: 'ad1', kind: 'ad', platform: 'meta', title: 'Spring candles', product_name: 'Soy candles', content: { campaignName: 'Spring candles', metaAds: { headline: 'Hand-poured in Utrecht', primaryText: 'Natural soy wax, poured by hand.', cta: 'Shop now' } }, source_route: '/api/ai/create-ad', created_at: t(60 * 5), favorite: false, status: 'ready' },
  { id: 'txt1', kind: 'caption', title: 'Instagram caption for workshops', content: { text: 'Join our Saturday candle workshop — pour your own soy candle.' }, source_route: '/api/generate-text', created_at: t(60 * 24), favorite: true },
  { id: 'web1', kind: 'landing_page', title: 'Workshop landing page', content: { html: '<h1>Saturday workshops</h1><p>Pour your own candle.</p>' }, source_route: '/api/generate-web', created_at: t(60 * 24 * 10), favorite: false },
];
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json());
app.use('/api', (q, r, n) => { calls.push({ m: q.method, p: q.originalUrl.split('?')[0], body: q.body }); n(); });
app.get('/__media/candle.png', (q, r) => { r.set('Access-Control-Allow-Origin', '*'); r.type('png').send(PNG); });
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, reason: 'existing_account', completed: true, stage: 'done', flow: { enabled: false } }));
app.get('/api/creative/assets', (q, r) => r.json({ assets: M.assets.map((a) => Object.assign({}, a)) }));
app.patch('/api/creative/assets/:id', (q, r) => { const a = M.assets.find((x) => x.id === q.params.id); if (!a) return r.status(404).json({ error: 'Not found' }); if (q.body.favorite !== undefined) a.favorite = !!q.body.favorite; r.json({ asset: a }); });
app.delete('/api/creative/assets/:id', (q, r) => { M.assets = M.assets.filter((x) => x.id !== q.params.id); r.json({ ok: true }); });
app.get('/api/video-ads/status/:id', (q, r) => {
  if (!M.videoDone) return r.json({ status: 'processing' });
  const a = M.assets.find((x) => x.content && x.content.generationId === q.params.id); if (a) a.content.url = DEV_API + '/__media/reel.mp4'; // what the server writes back
  r.json({ status: 'completed', videoUrl: DEV_API + '/__media/reel.mp4' });
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
  await page.waitForFunction(() => !!window.orvAppNav && !!window.orvMyContent, null, { timeout: 15000 });
  await page.evaluate(() => {
    window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token';
    if (window.orvTour) window.orvTour.open = function () {};
    window._dbSubscriptionStatus = 'paid';
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-mc', email: 'owner@example.invalid' });
  });
  await page.waitForTimeout(2200);
}
const openMine = async (page) => { await page.click('.orv-sb .onv-item[data-onv="content"]'); await page.waitForTimeout(600); };
const titles = (page) => page.$$eval('#mclRoot .mcl-info b', (b) => b.map((x) => x.textContent));

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    let page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page);

    // ── 1. Empty ───────────────────────────────────────────────────
    console.log('\n1. No content yet');
    await openMine(page);
    const em = await page.evaluate(() => ({ page: document.querySelector('.page.active').id, on: document.querySelector('.orv-sb .onv-item.is-on').dataset.onv, soon: /soon/i.test(document.querySelector('.orv-sb .onv-item[data-onv="content"]').textContent), empty: !!document.querySelector('#mclRoot .mcl-empty[data-state="empty"]'), imgs: document.querySelectorAll('#mclRoot img, #mclRoot video').length, text: document.getElementById('mclRoot').innerText }));
    check('1.1 My Content opens from the sidebar (no "Soon"), highlighted, with an empty state and no sample content', em.page === 'page-my-content' && em.on === 'content' && !em.soon && em.empty && em.imgs === 0 && /make in Create are saved here/.test(em.text), em);
    await page.screenshot({ path: path.join(SHOTS, 'empty-1440.png') });
    await page.click('#mclRoot .mcl-empty [data-mcl="create"]'); await page.waitForTimeout(600);
    check('1.2 "Go to Create" opens Create', (await page.evaluate(() => document.querySelector('.page.active').id)) === 'page-create');

    // ── 2. The library ─────────────────────────────────────────────
    console.log('\n2. Saved content');
    M.assets = SEED();
    await openMine(page);
    const lib = await page.evaluate(() => ({
      chips: Array.from(document.querySelectorAll('#mclRoot .mcl-chip')).map((c) => c.textContent),
      img: (document.querySelector('#mclRoot .mcl-item[data-type="image"] img') || {}).src, ad: (document.querySelector('#mclRoot .mcl-item[data-type="ad"] .mcl-adtext b') || {}).textContent,
      pending: (document.querySelector('#mclRoot .mcl-item[data-type="video"] .mcl-st') || {}).textContent, n: document.querySelectorAll('#mclRoot .mcl-item').length,
    }));
    check('2.1 the account’s own content is listed: image, video, ad creative, copy and a page — five items', lib.n === 5, lib);
    check('2.2 type filters only for types that exist, with real counts (plus Favourites)', JSON.stringify(lib.chips) === '["All5","Images1","Videos1","Ad creatives1","Copy1","Pages & documents1","Favourites"]', lib.chips);
    check('2.3 previews: the stored image, the ad’s headline; a video still rendering is marked', /\/__media\/candle\.png$/.test(lib.img || '') && lib.ad === 'Hand-poured in Utrecht' && /processing/i.test(lib.pending || ''), lib);
    check('2.4 the library asked the existing video status route once for the rendering video (nothing generated)', calls.filter((c) => c.p === '/api/video-ads/status/gen-9').length === 1 && !calls.some((c) => c.m === 'POST' && /generate|video-ads\/generate/.test(c.p)));
    const order = await titles(page);
    check('2.5 newest first by default', order[0] === 'Slow pour reel' && order[4] === 'Workshop landing page', order);
    await page.screenshot({ path: path.join(SHOTS, 'library-1440.png') });
    await page.selectOption('#mclSort', 'old'); await page.waitForTimeout(150);
    check('2.6 sorting: oldest first', (await titles(page))[0] === 'Workshop landing page');
    await page.selectOption('#mclSort', 'new');
    await page.fill('#mclSearch', 'workshop'); await page.waitForTimeout(150);
    const se = await titles(page);
    check('2.7 search finds titles and text (workshop: the caption and the landing page)', se.length === 2 && se.includes('Instagram caption for workshops') && se.includes('Workshop landing page'), se);
    await page.fill('#mclSearch', 'hand-poured'); await page.waitForTimeout(150);
    check('2.8 search reaches the ad’s copy', JSON.stringify(await titles(page)) === '["Spring candles"]');
    await page.fill('#mclSearch', '');
    await page.click('#mclRoot [data-mcl="type"][data-type="image"]'); await page.waitForTimeout(150);
    check('2.9 filter by type: images', JSON.stringify(await titles(page)) === '["Candle on a linen shelf"]');
    await page.click('#mclRoot [data-mcl="type"][data-type="all"]');
    await page.click('#mclRoot [data-mcl="fav"]'); await page.waitForTimeout(150);
    check('2.10 Favourites filter', JSON.stringify(await titles(page)) === '["Instagram caption for workshops"]');
    await page.click('#mclRoot [data-mcl="fav"]'); await page.waitForTimeout(150);

    // ── 3. Actions ─────────────────────────────────────────────────
    console.log('\n3. Actions');
    await page.click('#mclRoot .mcl-item[data-type="image"] .mcl-card'); await page.waitForTimeout(300);
    const dlg = await page.evaluate(() => ({ open: !document.getElementById('mclModal').hidden, img: !!document.querySelector('#mclModal .mcl-preview img'), btns: Array.from(document.querySelectorAll('#mclModal .mcl-dialog__f button')).map((b) => b.textContent), focus: document.activeElement && document.activeElement.className }));
    check('3.1 opening an image shows it large with its details and only real actions (download, favourite, delete)', dlg.open && dlg.img && JSON.stringify(dlg.btns) === '["Download","☆ Add to favourites","Delete"]' && /mcl-close/.test(dlg.focus), dlg);
    await page.screenshot({ path: path.join(SHOTS, 'detail-image-1440.png') });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#mclModal [data-mcl="download"]')]);
    check('3.2 Download saves the stored file', !!dl && /\.png$/.test(dl.suggestedFilename()), dl && dl.suggestedFilename());
    await page.click('#mclModal [data-mcl="favorite"]'); await page.waitForTimeout(300);
    check('3.3 favourite is saved on the server (PATCH) and shown', M.assets.find((a) => a.id === 'img1').favorite === true && /★ Favourite/.test(await page.textContent('#mclModal [data-mcl="favorite"]')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check('3.4 Escape closes the preview and focus returns to the item', await page.evaluate(() => document.getElementById('mclModal').hidden && !!document.activeElement.closest('.mcl-item[data-type="image"]')));
    await page.click('#mclRoot .mcl-item[data-type="ad"] .mcl-card'); await page.waitForTimeout(300);
    const ad = await page.evaluate(() => ({ txt: document.querySelector('#mclModal .mcl-adfull').innerText, btns: Array.from(document.querySelectorAll('#mclModal .mcl-dialog__f button')).map((b) => b.textContent) }));
    check('3.5 an ad creative shows its headlines, text and call to action; it can be copied (no download for text)', /Hand-poured in Utrecht/.test(ad.txt) && /Natural soy wax/.test(ad.txt) && /Shop now/.test(ad.txt) && ad.btns.includes('Copy text') && !ad.btns.includes('Download'), ad);
    await page.click('#mclModal [data-mcl="copy"]'); await page.waitForTimeout(200);
    check('3.6 Copy text puts the ad copy on the clipboard', /Hand-poured in Utrecht/.test(await page.evaluate(() => navigator.clipboard.readText())));
    await page.click('#mclModal [data-mcl="close"].mcl-close'); await page.waitForTimeout(200);
    await page.click('#mclRoot .mcl-item[data-type="page"] .mcl-card'); await page.waitForTimeout(300);
    check('3.7 a generated page is previewed in a sandboxed frame (no scripts)', await page.evaluate(() => { const f = document.querySelector('#mclModal iframe.mcl-frame'); return !!f && f.getAttribute('sandbox') === ''; }));
    await page.keyboard.press('Escape');
    await page.evaluate(() => { window.orvWorkspace.flow.confirm = () => Promise.resolve(true); });
    await page.click('#mclRoot .mcl-item[data-type="page"] .mcl-card'); await page.waitForTimeout(300);
    await page.click('#mclModal [data-mcl="delete"]'); await page.waitForTimeout(400);
    check('3.8 Delete (after confirming) removes it on the server and from the library', !M.assets.some((a) => a.id === 'web1') && (await page.$$('#mclRoot .mcl-item')).length === 4 && calls.some((c) => c.m === 'DELETE' && c.p === '/api/creative/assets/web1'));

    // ── 4. Video finishes, reload keeps everything ─────────────────
    console.log('\n4. Video link, after a reload');
    M.videoDone = true;
    await page.close();
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page);
    await openMine(page); await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ n: document.querySelectorAll('#mclRoot .mcl-item').length, web: /Workshop landing page/.test(document.getElementById('mclRoot').textContent), fav: !!document.querySelector('#mclRoot .mcl-item[data-type="image"] .mcl-favmark'), vid: (document.querySelector('#mclRoot .mcl-item[data-type="video"] video') || {}).getAttribute ? document.querySelector('#mclRoot .mcl-item[data-type="video"] video').getAttribute('src') : null }));
    check('4.1 after a reload the content is still there (from the server), the deleted page stays deleted, the favourite stays', after.n === 4 && !after.web && after.fav, after);
    check('4.2 the finished video now shows with its stored link', /\/__media\/reel\.mp4/.test(after.vid || ''), after.vid);
    await page.click('#mclRoot .mcl-item[data-type="video"] .mcl-card'); await page.waitForTimeout(300);
    check('4.3 the video opens in a player with Download', await page.evaluate(() => !!document.querySelector('#mclModal video[controls]') && !!document.querySelector('#mclModal [data-mcl="download"]')));
    await page.keyboard.press('Escape');
    check('4.4 no credit, generation or checkout request from My Content', !calls.some((c) => c.m !== 'GET' && !/^\/api\/(creative\/assets\/[\w-]+|events|t|user\/preferences|profile\/timezone)$/.test(c.p)), calls.filter((c) => c.m !== 'GET').map((c) => c.p));
    await page.close();
    await ctx.close();

    // ── 5. Small screens ───────────────────────────────────────────
    console.log('\n5. Widths');
    for (const [w, h] of [[1024, 768], [390, 844]]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: h } });
      const p2 = await c2.newPage(); await fence(p2);
      await signIn(p2);
      await p2.evaluate(() => window.orvMyContent.open()); await p2.waitForTimeout(600);
      const d = await p2.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, n: document.querySelectorAll('#mclRoot .mcl-item').length }));
      await p2.screenshot({ path: path.join(SHOTS, 'library-' + w + '.png') });
      await p2.click('#orvMobToggle'); await p2.waitForTimeout(400);
      const foot = await p2.evaluate(() => ({ plat: !!document.querySelector('.orv-mob-drawer [data-onv-foot="platforms"]'), acct: !!document.querySelector('.orv-mob-drawer [data-onv-foot="account"]'), set: !!document.querySelector('.orv-mob-drawer [data-onv-foot="settings"]') }));
      await p2.screenshot({ path: path.join(SHOTS, 'drawer-' + w + '.png') });
      check(`5.${w} My Content fits (no horizontal overflow); the menu has Ad Platforms, the account and Settings`, d.ov <= 1 && d.n === 4 && foot.plat && foot.acct && foot.set, { d, foot });
      await c2.close();
    }
    check('Z. no JavaScript errors from My Content or the navigation', errors.filter((e) => /myContent|mcl|appNav|onv/i.test(e)).length === 0, errors);
    console.log('\n(Blocked outside requests, aborted by the fence: ' + blocked.length + ')');
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); server.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
