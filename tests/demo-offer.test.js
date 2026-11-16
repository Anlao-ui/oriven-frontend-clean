// ════════════════════════════════════════════════════════════════
// Try 2 weeks for €1 (the first Flex purchase), the 14-day money-back
// guarantee on the regular plans, the end-of-Flex prompt, and /demo.
//
// A. Public site: navbar order (Product, Solutions, Resources, Demo,
//    Pricing) on desktop and in the mobile menu, hero CTA + "View live demo"
//    + refund line, the demo note under Integrations, the pricing cards
//    (Flex €1 with €17 struck through, "Try 2 weeks for €1"; the 14-day line on the
//    four regular plans, not on Flex; the regular plans keep their price; a
//    refund line under every button, the refund block), FAQ, no sideways
//    scroll; and the kill switch (ORIVEN_INTRO_OFFER.enabled = false brings
//    back the old copy).
// B. /demo: the real app with sample data. The page itself never even
//    ATTEMPTS a request to another host (OrivenAI API, Supabase, AI, ad
//    platforms, Stripe): every request it makes is recorded. Real browser
//    storage is untouched. Dashboard, the five platforms in Campaign
//    Overview, Research, My Content and Automations show sample data; AI
//    actions return pre-written examples; paying and publishing are refused.
// Fenced (tests/_fence.js): only this test's static server is reachable.
// RUN: node tests/demo-offer.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8973, BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, '_shots', 'demo-offer'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 500))); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
let plansOverride = null; // the kill-switch case serves a modified js/plans.js
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, BASE).pathname);
  const m = rules.find((x) => x[0] === p && /^20?0/.test(x[2] || '')); if (m) p = m[1].split('?')[0];
  if (p === '/js/plans.js' && plansOverride) { r.writeHead(200, { 'Content-Type': TYPES['.js'] }); return r.end(plansOverride); }
  // A bare page with the real plans.js + flexReminder.js; the account's access is stubbed per test.
  if (p === '/__flex.html') { r.writeHead(200, { 'Content-Type': TYPES['.html'] }); return r.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/offer.css"></head><body style="background:#0B0C0A"><div id="pw"></div><script>window.orvAccess=function(){return window.__acc||null};window.openPaywall=function(){window.__pw=(window.__pw||0)+1;renderPWPricingCards(document.getElementById("pw"))};</script><script src="/js/plans.js"></script><script src="/js/flexReminder.js"></script></body></html>'); }
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (_) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const REJECT = { v: 1, ads: false, stats: true, hc: false, at: '2026-11-15T00:00:00.000Z' };

(async () => {
  await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
  const browser = await chromium.launch();
  fenceBrowser(browser, BASE);
  const errors = [];
  async function open(p, o) {
    o = o || {};
    const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const tried = [];
    page.on('pageerror', (e) => errors.push(p + ': ' + e.message));
    page.on('request', (rq) => tried.push(rq.method() + ' ' + rq.url()));
    if (o.consent !== false) await page.addInitScript((c) => { try { localStorage.setItem('orv_consent_v1', JSON.stringify(c)); } catch (_) {} }, REJECT);
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForTimeout(o.wait || 900);
    return { ctx, page, tried };
  }

  // ── A. Public site ──
  let { ctx, page } = await open('/');
  const nav = await page.evaluate(() => Array.from(document.querySelectorAll('#lpNav .lp-nav-links > .lp-nav-item > button, #lpNav .lp-nav-links > .lp-nav-item > a, #lpNav .lp-nav-links > a')).map((e) => e.textContent.trim().split(/\s/)[0]));
  check('desktop navbar: Product, Solutions, Resources, Demo, Pricing', nav.join() === 'Product,Solutions,Resources,Demo,Pricing', nav);
  const mm = await page.evaluate(() => Array.from(document.querySelectorAll('#lpMobileMenu .lp-mm-nav > .lp-mm-item > button, #lpMobileMenu .lp-mm-nav > a')).map((e) => e.textContent.trim().split(/\s/)[0]));
  check('mobile menu: … Demo, Pricing (Demo links to /demo)', mm.slice(-2).join() === 'Demo,Pricing' && await page.evaluate(() => !!document.querySelector('#lpMobileMenu a.lp-mm-link[href="/demo"]')), mm);
  const hero = await page.evaluate(() => { const b = document.querySelectorAll('.ik-hero .ik-actions a'); return { p: b[0] && b[0].textContent.trim(), ph: b[0] && b[0].getAttribute('href'), s: b[1] && b[1].textContent.trim(), sh: b[1] && b[1].getAttribute('href'), fine: (document.querySelector('.ik-hero__fine') || {}).textContent, icon: !!(b[0] && b[0].querySelector('svg')) }; });
  check('hero: "Try 2 weeks for €1" (icon kept), "View live demo" → /demo, "Not happy within 14 days? Money back on regular plans."', hero.p === 'Try 2 weeks for €1' && hero.icon && hero.ph === '/signup' && hero.s === 'View live demo' && hero.sh === '/demo' && /Not happy within 14 days\? Money back on regular plans\./.test(hero.fine || ''), hero);
  const note = await page.evaluate(() => { const n = document.querySelector('#integrations .ik-demo-note'); return n && { t: n.textContent.trim(), h: n.querySelector('a').getAttribute('href') }; });
  check('Integrations: "Want to look around first? Try the demo, no account connection needed."', note && /Want to look around first\? Try the demo, no account connection needed\./.test(note.t) && note.h === '/demo', note);
  const fin = await page.evaluate(() => { const b = document.querySelector('.ik-final .ik-actions a'); return { b: b.textContent.trim(), lead: document.querySelector('.ik-final .ik-lead').textContent.trim() }; });
  check('final call to action: "Try 2 weeks for €1" and line', fin.b === 'Try 2 weeks for €1' && /2 weeks for €1/.test(fin.lead), fin);
  const faq = await page.evaluate(() => Array.from(document.querySelectorAll('#faq summary, .ik-faq summary')).map((s) => s.textContent.trim()));
  check('homepage FAQ has "What if OrivenAI isn’t right for me?"', faq.some((q) => /What if OrivenAI isn’t right for me\?/.test(q)), faq);
  await page.screenshot({ path: path.join(SHOTS, 'home-hero.png') });
  await ctx.close();

  for (const vp of [{ width: 1440, height: 1000 }, { width: 820, height: 1100 }, { width: 390, height: 844 }]) {
    ({ ctx, page } = await open('/pricing', { vp }));
    const pc = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#lpPricingGrid .ov-pc'));
      const by = (id) => cards.find((c) => c.dataset.plan === id);
      const x = by('flex'), mo = by('monthly');
      return {
        n: cards.length,
        fPrice: x.querySelector('.ov-pc-price-num').textContent, fWas: (x.querySelector('.ov-pc-was') || {}).textContent, fPeriod: (x.querySelector('.ov-pc-period') || {}).textContent, fBtn: x.querySelector('.ov-pc-btn').textContent.trim(), fHref: x.querySelector('.ov-pc-btn').getAttribute('href'),
        fNote: x.querySelector('.ov-pc-duration').textContent, fRefund: (x.querySelector('.ov-pc-refund') || {}).textContent.trim(),
        mPrice: mo.querySelector('.ov-pc-price-num').textContent, mBtn: mo.querySelector('.ov-pc-btn').textContent.trim(), mLine: mo.querySelector('.ov-pc-duration').textContent,
        others: cards.filter((c) => c !== x).map((c) => ({ id: c.dataset.plan, was: !!c.querySelector('.ov-pc-was'), refund: (c.querySelector('.ov-pc-refund') || {}).textContent.trim(), btn: c.querySelector('.ov-pc-btn').textContent.trim() })),
        offerLines: document.querySelectorAll('#lpPricingGrid .ov-pc-offer').length,
        block: (document.querySelector('.ov-refund') || {}).textContent || '',
        flexBadge: (by('flex').querySelector('.ov-pc-badge') || {}).textContent || '',
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    if (vp.width === 1440) {
      check('pricing: Flex shows €1 with €17 struck through, "for 2 weeks", "€1 applies to your first Flex purchase." and "Try 2 weeks for €1"', pc.n === 5 && pc.fPrice === '€1' && /€17/.test(pc.fWas || '') && /for 2 weeks/.test(pc.fPeriod || '') && /€1 applies to your first Flex purchase\./.test(pc.fNote) && pc.fBtn === 'Try 2 weeks for €1' && pc.fHref === '/app?plan=flex', pc);
      check('pricing: the regular plans keep their normal price and button (no €1 anywhere else)', pc.mPrice === '€29' && pc.mBtn === 'Choose Monthly' && /€29 per month/.test(pc.mLine) && pc.others.every((o) => !o.was && /^Choose /.test(o.btn)) && pc.offerLines === 0, pc);
      check('pricing: "14-day money-back guarantee" under the four regular plans, not under Flex; the block explains it (Flex not covered) + demo link', pc.others.length === 4 && pc.others.every((o) => o.refund === '14-day money-back guarantee') && !/money-back/.test(pc.fRefund) && /14-day money-back guarantee/.test(pc.block) && /20% of its credits/.test(pc.block) && /€1 Flex trial isn’t covered/.test(pc.block) && /View the live demo/.test(pc.block), pc);
      check('pricing: Flex badge "Try for €1"', pc.flexBadge === 'Try for €1', pc.flexBadge);
    }
    check(vp.width + 'px pricing: nothing scrolls sideways', pc.overflow <= 0, pc.overflow);
    await page.screenshot({ path: path.join(SHOTS, 'pricing-' + vp.width + '.png'), fullPage: false });
    if (vp.width === 1440) { await page.locator('.ov-refund').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(SHOTS, 'pricing-refund.png') }); }
    await ctx.close();
  }

  // Kill switch: the offer off → the old copy everywhere
  plansOverride = fs.readFileSync(path.join(ROOT, 'js', 'plans.js'), 'utf8').replace('var ORIVEN_INTRO_OFFER = { enabled: true,', 'var ORIVEN_INTRO_OFFER = { enabled: false,');
  ({ ctx, page } = await open('/'));
  const off = await page.evaluate(() => ({ hero: document.querySelector('.ik-hero .ik-actions a').textContent.trim(), fin: document.querySelector('.ik-final .ik-lead').textContent.trim() }));
  await ctx.close();
  ({ ctx, page } = await open('/pricing'));
  const offCards = await page.evaluate(() => { const x = document.querySelector('#lpPricingGrid .ov-pc[data-plan="flex"]'); return { m: x.querySelector('.ov-pc-price-num').textContent, offers: document.querySelectorAll('#lpPricingGrid .ov-pc-was').length, btn: x.querySelector('.ov-pc-btn').textContent.trim(), flex: (x.querySelector('.ov-pc-badge') || {}).textContent, refunds: document.querySelectorAll('#lpPricingGrid .ov-pc-refund:not(.ov-pc-refund--none)').length }; });
  check('offer switched off: hero "Get started", final line back to "Plans from €17…", Flex €17 "Choose Flex" "Introductory", nothing struck through, money-back line on all five', off.hero === 'Get started' && /^Plans from €17/.test(off.fin) && offCards.m === '€17' && offCards.offers === 0 && offCards.btn === 'Choose Flex' && offCards.flex === 'Introductory' && offCards.refunds === 5, { off, offCards });
  await ctx.close();
  plansOverride = null;

  // Refund Policy matches the money-back copy
  ({ ctx, page } = await open('/refund-policy'));
  const rp = await page.evaluate(() => document.body.innerText);
  check('Refund Policy: 14-day money-back on the regular plans (≤20% credits), Flex €1 not eligible; no 7-day window left', /Regular plans \(Monthly, Quarterly, Semi-Annual and Annual\) come with a 14-day money-back guarantee/.test(rp) && /no more than 20% of the plan’s credits/.test(rp) && /The Flex introductory offer \(€1\) is not eligible for a refund/.test(rp) && /more than 14 days after the first purchase of a regular plan, renewals or repeat purchases, and the €1 Flex introductory offer/.test(rp) && !/7 days|7-day/.test(rp), rp.slice(rp.indexOf('Refund Eligibility'), rp.indexOf('Refund Eligibility') + 600));
  await ctx.close();

  // ── C. In the app: who sees the €1, and the end of the Flex trial ──
  const flexPage = async (acc) => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await c.newPage();
    pg.on('pageerror', (e) => errors.push('flex: ' + e.message));
    await pg.addInitScript((a) => { window.__acc = a; }, acc);
    await pg.goto(BASE + '/__flex.html'); await pg.waitForTimeout(2200);
    return { c, pg };
  };
  const D = 864e5, now = Date.now();
  {
    const { c, pg } = await flexPage({ active: false, status: 'free', expiresAt: null, plan: null });
    const r = await pg.evaluate(() => { renderPWPricingCards(document.getElementById('pw')); const x = document.querySelector('#pw .pw-card[data-plan="flex"]'); return { price: x.querySelector('.pw-price').textContent, btn: x.querySelector('button').textContent, prompt: !!document.querySelector('.orv-flex-prompt'), guar: document.querySelectorAll('#pw .orv-guarantee').length }; });
    check('in-app plans, account that never paid: Flex €1 "Try 2 weeks for €1"; money-back line on the four regular plans; no end-of-Flex prompt', r.price === '€1' && r.btn === 'Try 2 weeks for €1' && r.guar === 4 && !r.prompt, r);
    await c.close();
  }
  {
    const { c, pg } = await flexPage({ active: true, status: 'paid', expiresAt: new Date(now + 2 * D + 3600e3).toISOString(), plan: 'flex' });
    const p1 = await pg.evaluate(() => { const e = document.querySelector('.orv-flex-prompt'); return e && { t: e.querySelector('.orv-flex-prompt__t').textContent, d: e.querySelector('.orv-flex-prompt__d').textContent }; });
    check('Flex ending in 2 days: "Your 2 weeks end in 3 days/2 days" prompt that names the cheaper longer plans', !!p1 && /^Your 2 weeks end in 2 days$/.test(p1.t) && /Longer plans cost less per month: Annual works out at €20\.42 a month/.test(p1.d), p1);
    await pg.screenshot({ path: path.join(SHOTS, 'flex-ending.png') });
    await pg.click('.orv-flex-prompt [data-flex-plans]'); await pg.waitForTimeout(300);
    const p2 = await pg.evaluate(() => ({ pw: window.__pw, hl: window.ORV_PLANS_HIGHLIGHT_LONG, value: Array.from(document.querySelectorAll('#pw .orv-pw-value')).map((x) => x.dataset.plan), saves: Array.from(document.querySelectorAll('#pw .orv-pw-save')).map((x) => x.textContent), flexPrice: document.querySelector('#pw .pw-card[data-plan="flex"] .pw-price').textContent, gone: !document.querySelector('.orv-flex-prompt') }));
    check('"See plans" opens the plans with Quarterly, Semi-Annual and Annual highlighted (savings vs Monthly); this account pays the normal Flex price', p2.pw === 1 && p2.hl === true && p2.value.join() === 'quarterly,semiannual,annual' && p2.saves.join() === 'Save €9 vs. Monthly,Save €31 vs. Monthly,Save €103 vs. Monthly' && p2.flexPrice === '€17' && p2.gone, p2);
    await pg.reload(); await pg.waitForTimeout(2200);
    check('…the prompt is shown once a day (not again after a reload)', await pg.evaluate(() => !document.querySelector('.orv-flex-prompt')));
    await c.close();
  }
  {
    const { c, pg } = await flexPage({ active: false, status: 'free', expiresAt: new Date(now - 1 * D).toISOString(), plan: 'flex' });
    const t = await pg.evaluate(() => (document.querySelector('.orv-flex-prompt__t') || {}).textContent);
    check('Flex ended yesterday: "Your 2 weeks have ended"', t === 'Your 2 weeks have ended', t);
    await c.close();
  }
  for (const [label, acc] of [['Monthly ending in 2 days', { active: true, status: 'paid', expiresAt: new Date(now + 2 * D).toISOString(), plan: 'monthly' }], ['Flex with 10 days left', { active: true, status: 'paid', expiresAt: new Date(now + 10 * D).toISOString(), plan: 'flex' }], ['Flex ended 40 days ago', { active: false, status: 'free', expiresAt: new Date(now - 40 * D).toISOString(), plan: 'flex' }]]) {
    const { c, pg } = await flexPage(acc);
    check('no end-of-Flex prompt: ' + label, await pg.evaluate(() => !document.querySelector('.orv-flex-prompt')));
    await c.close();
  }

  // ── B. /demo ──
  // Real storage of this origin before the demo
  ({ ctx, page } = await open('/', { consent: false }));
  await page.evaluate(() => { localStorage.setItem('probe', 'real'); });
  const demo = await ctx.newPage();
  const tried = [];
  demo.on('pageerror', (e) => errors.push('/demo: ' + e.message));
  demo.on('request', (rq) => tried.push(rq.method() + ' ' + rq.url()));
  await demo.goto(BASE + '/demo', { waitUntil: 'load' });
  await demo.waitForTimeout(6000);
  const st = await demo.evaluate(() => ({ demo: window.ORV_DEMO === true, isolated: (function () { try { return window.localStorage.getItem('probe') === null; } catch (_) { return false; } })(), bar: (document.querySelector('.orv-demo-bar') || {}).textContent || '', cta: document.querySelector('.orv-demo-bar a') && document.querySelector('.orv-demo-bar a').getAttribute('href'), signedIn: !!document.querySelector('.app') && getComputedStyle(document.querySelector('.app')).display !== 'none', page: (document.querySelector('.page.active') || {}).id, consent: !!document.querySelector('.orv-cc') }));
  check('/demo: demo mode on, the app is open (signed in as the sample user), no cookie banner', st.demo && st.signedIn && !st.consent, st);
  check('/demo: banner "You’re viewing a demo with sample data" + "Try 2 weeks for €1" → /signup', /You’re viewing a demo/.test(st.bar) && /with sample data/.test(st.bar) && /Try 2 weeks for €1/.test(st.bar) && st.cta === '/signup', st);
  check('/demo: the demo cannot see the real storage of this site', st.isolated, st);
  await demo.screenshot({ path: path.join(SHOTS, 'demo-start.png') });

  const go = async (id, ms) => { await demo.evaluate((x) => window.orvAppNav && window.orvAppNav.go(x), id); await demo.waitForTimeout(ms || 2200); };
  await go('dashboard', 3000);
  const dash = await demo.evaluate(() => document.querySelector('.page.active').innerText.replace(/\s+/g, ' ').slice(0, 3000));
  check('Dashboard shows the sample business and real-looking figures', /Amber & Clay|Sanne/.test(dash) && /€\s?\d/.test(dash), dash.slice(0, 300));
  await demo.screenshot({ path: path.join(SHOTS, 'demo-dashboard.png') });
  await go('overview', 2500);
  const plats = await demo.evaluate(() => Array.from(document.querySelectorAll('#page-performance button')).map((b) => b.textContent.trim()).filter((t) => /^(Google|Meta|TikTok|Pinterest|Snapchat) Ads/.test(t)).map((t) => t.split(' Ads')[0]));
  check('Campaign Overview: all five platforms', ['Google', 'Meta', 'TikTok', 'Pinterest', 'Snapchat'].every((p) => plats.includes(p)), plats);
  const metaRows = await demo.evaluate(() => document.getElementById('page-performance').innerText);
  check('Campaign Overview lists sample campaigns', /Candle season|Search — hand-thrown mugs|Pottery workshop/.test(metaRows), metaRows.slice(0, 300));
  await demo.screenshot({ path: path.join(SHOTS, 'demo-campaigns.png') });
  await go('research', 2500);
  const rs = await demo.evaluate(() => document.querySelector('.page.active').innerText);
  check('Research: the sample reports (fictional competitors only)', /Handmade candle brands in the Netherlands/.test(rs) && !/Kaarsenhuis|Wax & Wick/.test(rs), rs.slice(0, 300));
  await go('content', 4000);
  const mc = await demo.evaluate(() => ({ t: document.body.innerText, imgs: Array.from(document.querySelectorAll('#page-my-content img')).filter((i) => /\/assets\/demo\//.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 0).length }));
  check('My Content: the example AI images are shown (loaded from /assets/demo)', mc.imgs >= 3 && /Candle season/.test(mc.t), mc.imgs);
  await demo.screenshot({ path: path.join(SHOTS, 'demo-content.png') });
  await go('auto-overview', 4000);
  const auO = await demo.evaluate(() => document.getElementById('page-autopilot').innerText);
  await go('auto-rules', 3000);
  const auR = await demo.evaluate(() => document.getElementById('page-autopilot').innerText);
  check('Automations: the example schedule (Overview) and rule (Rules)', /Weekday hours/.test(auO) && /Scale winners/.test(auR), [auO.slice(0, 120), auR.slice(0, 120)]);

  // AI and paid actions through the app's own apiFetch
  const ai = await demo.evaluate(async () => {
    const t0 = performance.now();
    const chat = await apiFetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: 'Write three headlines for my candle ad' }) });
    const ad = await apiFetch('/api/ai/create-ad', { method: 'POST', body: JSON.stringify({ platform: 'pinterest', prompt: 'candles' }) });
    const img = await apiFetch('/api/generate-image', { method: 'POST', body: JSON.stringify({ prompt: 'x' }) });
    const res = await apiFetch('/api/research/query', { method: 'POST', body: JSON.stringify({ question: 'x' }) });
    const pay = await apiFetch('/api/create-checkout-session', { method: 'POST', body: JSON.stringify({ plan: 'monthly' }) });
    const pub = await apiFetch('/api/publish/meta', { method: 'POST', body: JSON.stringify({}) });
    const del = await apiFetch('/api/account/delete', { method: 'POST', body: '{}' });
    return { ms: performance.now() - t0, chat: chat.ok && /headlines/i.test(chat.data.reply) && /demo/i.test(chat.data.reply), ad: ad.ok && !!(ad.data.data && (ad.data.data.pinterestAds || ad.data.data.concepts)), img: img.ok && img.data.imageUrl === location.origin + '/assets/demo/ad2.jpg', research: res.status === 403 && res.data.code === 'DEMO', pay: pay.status === 403 && /demo/i.test(pay.data.error), pub: pub.status === 403, del: del.status === 403 };
  });
  check('AI actions return pre-written examples after a short wait (chat, ad, image); research explains the demo', ai.chat && ai.ad && ai.img && ai.research && ai.ms > 3000, ai);
  check('paying, publishing and deleting the account are refused in the demo', ai.pay && ai.pub && ai.del, ai);
  // The real Create flow in the interface: an example campaign, with copy and image, after a short build
  await go('create', 2500);
  await demo.evaluate(() => { window._ov3Platform = 'meta'; window.cgrGenerate('An autumn ad for our hand-poured soy candles', 'meta', 'images'); });
  await demo.waitForTimeout(8000);
  const built = await demo.evaluate(() => { const a = document.querySelector('.page.active'); return { id: a.id, t: a.innerText, img: Array.from(a.querySelectorAll('img')).some((i) => /\/assets\/demo\/ad2\.jpg$/.test(i.currentSrc || i.src) && i.naturalWidth > 0) }; });
  check('Create → build: a finished example Meta campaign (headline, primary text, audience, image)', /Campaign ready/.test(built.t) && /Slow evenings, hand-poured/.test(built.t) && /Gift buyers aged 25–45/.test(built.t) && built.img, { id: built.id, img: built.img, t: built.t.slice(0, 200) });
  await demo.screenshot({ path: path.join(SHOTS, 'demo-create.png') });
  const blockedByDemo = await demo.evaluate(() => (window.orvDemoBlocked || []).slice());

  // Nothing left the page: every request the demo made was to this server or a static CDN GET
  const CDN = /^GET https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
  const outside = tried.filter((t) => !t.split(' ')[1].startsWith(BASE + '/') && !/^GET (data|blob):/.test(t) && !CDN.test(t));
  check('/demo attempted NO request to any other host (no API, Supabase, AI, ad platform, Stripe, analytics)', outside.length === 0, outside.slice(0, 10));
  const toApi = tried.filter((t) => /\/api\//.test(t));
  check('/demo sent no /api request at all (all answered inside the page)', toApi.length === 0, toApi.slice(0, 5));
  console.log('  (refused inside the demo: ' + blockedByDemo.length + ')');
  await demo.close();

  // Real storage after the demo: unchanged
  const after = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  check('after the demo, the real storage is unchanged (no demo session, no sample campaigns)', after.probe === 'real' && !Object.keys(after).some((k) => /^sb-|oriven_campaigns_demo|demo-amber/.test(k)), Object.keys(after));
  await ctx.close();

  // /app is untouched by the demo code
  ({ ctx, page } = await open('/app', { wait: 1500 }));
  check('/app does not load the demo layer', await page.evaluate(() => !window.ORV_DEMO && !window.ORV_DEMO_DATA && !document.querySelector('.orv-demo-bar')));
  await ctx.close();

  // Mobile demo banner
  ({ ctx, page } = await open('/demo', { vp: { width: 390, height: 844 }, wait: 5000, consent: false }));
  const mb = await page.evaluate(() => { const b = document.querySelector('.orv-demo-bar').getBoundingClientRect(); return { l: b.left, r: innerWidth - b.right, bottom: innerHeight - b.bottom, h: b.height, overflow: document.documentElement.scrollWidth - innerWidth }; });
  check('mobile /demo: banner fits the screen (12px gutters, bottom)', mb.l >= 8 && mb.r >= 8 && mb.bottom >= 8 && mb.h < 80, mb);
  await page.screenshot({ path: path.join(SHOTS, 'demo-mobile.png') });
  await ctx.close();

  await browser.close(); srv.close();
  const files = ['js/demo-mode.js', 'js/demo-data.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  check('demo files contain no real competitor names or domains', !/kaarsenhuis|waxandwick|Wax & Wick/i.test(files));
  const head = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8').split('js/consent.js"></script>')[0];
  check('app.html loads the demo layer only on /demo, before consent.js', head.includes("if(/^\\/demo\\/?$/.test(location.pathname))document.write('<script src=\"/js/demo-data.js\"><\\/script><script src=\"/js/demo-mode.js\"><\\/script>');"), head.slice(-400));
  const errs = errors.filter((e) => !/Blocked in the demo|Failed to fetch|NetworkError/.test(e));
  check('no page errors', !errs.length, errs.slice(0, 8));
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
