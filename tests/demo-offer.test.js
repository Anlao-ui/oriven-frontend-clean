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
  // Like Netlify: a trailing slash is ignored when rules are matched (/demo/ matches the /demo rule).
  const slash = (x) => (x.length > 1 ? x.replace(/\/+$/, '') : x);
  const m = rules.find((x) => slash(x[0]) === slash(p) && /^20?0/.test(x[2] || '')); if (m) p = m[1].split('?')[0];
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
  check('hero: "Try 2 weeks for €1" (icon kept), "View live demo" → /demo, "14-day money-back guarantee on regular plans."', hero.p === 'Try 2 weeks for €1' && hero.icon && hero.ph === '/signup' && hero.s === 'View live demo' && hero.sh === '/demo' && /^14-day money-back guarantee on regular plans\.$/.test((hero.fine || '').trim()), hero);
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
  check('offer switched off: hero "Get started", final line back to "Plans from €17…", Flex €17 "Choose Flex" "Introductory", nothing struck through, money-back line on the four regular plans only (never Flex: Refund Policy §3)', off.hero === 'Get started' && /^Plans from €17/.test(off.fin) && offCards.m === '€17' && offCards.offers === 0 && offCards.btn === 'Choose Flex' && offCards.flex === 'Introductory' && offCards.refunds === 4, { off, offCards });
  await ctx.close();
  plansOverride = null;

  // No redirect loops: with Netlify's slash-insensitive matching, no 3xx rule may send a path to itself
  const loops = rules.filter((x) => /^30\d/.test(x[2] || '') && x[0].replace(/\/+$/, '') === x[1].split('?')[0].replace(/\/+$/, ''));
  check('_redirects: no rule redirects a path to itself (Netlify ignores the trailing slash)', loops.length === 0, loops);

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

  // ── B. /demo: a marketing page whose modal shows the read-only demo app ──
  const CDN = /^GET https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
  const outsideOf = (list) => list.filter((t) => !t.split(' ')[1].startsWith(BASE + '/') && !/^GET (data|blob):/.test(t) && !CDN.test(t));
  // A signed-in visitor: a real-looking session in this site's storage (the demo must not use or change it)
  ({ ctx, page } = await open('/', { consent: false }));
  await page.evaluate(() => { localStorage.setItem('probe', 'real'); localStorage.setItem('sb-rsqfoqitooxmkyrkuyzi-auth-token', JSON.stringify({ access_token: 'real-user-token', refresh_token: 'r', expires_at: 4102444800, user: { id: 'real-user' } })); localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: true, hc: false, at: 'x' })); });
  const demo = await ctx.newPage();
  const tried = [], navs = [], framed = [];
  demo.on('pageerror', (e) => errors.push('/demo: ' + e.message));
  demo.on('request', (rq) => { const t = rq.method() + ' ' + rq.url(); tried.push(t); if (rq.frame() !== demo.mainFrame()) framed.push(t); if (rq.isNavigationRequest()) navs.push(rq.url()); });
  await demo.goto(BASE + '/demo', { waitUntil: 'load' });
  await demo.waitForTimeout(8000);
  const pg1 = await demo.evaluate(() => { const nav = document.getElementById('lpNav').getBoundingClientRect(), hero = document.querySelector('.ov-demo-hero').getBoundingClientRect(), box = document.querySelector('.ov-demo-hero__frame').getBoundingClientRect(), win = document.querySelector('.ov-demo-hero__frame'), fr = document.getElementById('orvDemoFrame'), bar = document.querySelector('.ov-demo-hero__bar'), foot = document.querySelector('#view-demo .site-foot');
    return { url: location.pathname, nav: getComputedStyle(document.getElementById('lpNav')).display !== 'none', login: !!document.querySelector('#lpNav .lp-nav-login'), start: !!document.querySelector('#lpNav .lp-cta-btn'), navDemo: !!document.querySelector('#lpNav a.lp-nav-link[href="/demo"]'), foot: !!foot, footTop: foot ? Math.round(foot.getBoundingClientRect().top) : 0, vh: innerHeight, navB: Math.round(nav.bottom), heroTop: Math.round(hero.top), boxTop: Math.round(box.top), boxL: Math.round(box.left), boxR: Math.round(innerWidth - box.right), barB: Math.round(bar.getBoundingClientRect().bottom), radius: parseFloat(getComputedStyle(win).borderRadius), border: getComputedStyle(win).borderTopWidth, chrome: (document.querySelector('.ov-demo-hero__chrome') || {}).textContent || '', frameH: Math.round(fr.getBoundingClientRect().height),
      src: fr.getAttribute('src'), sandbox: fr.getAttribute('sandbox'), modal: !!document.querySelector('#orvDemoModal, .ov-demo-modal, [data-demo-open], .ov-demo-modal__x'), bar: bar ? bar.innerText : '', cta: (document.querySelector('.ov-demo-hero__cta') || {}).textContent, ctaHref: document.querySelector('.ov-demo-hero__cta').getAttribute('href') }; });
  check('/demo is a normal page: landing navbar (Log in, Get started, Demo) and the footer after scrolling', pg1.url === '/demo' && pg1.nav && pg1.login && pg1.start && pg1.navDemo && pg1.foot && pg1.footTop >= pg1.vh, pg1);
  check('/demo: the demo sits in a contained workspace frame on the page: space under the navbar and at both sides, rounded, bordered, “sample workspace · read-only” strip, never touching the window’s top or bottom (no pop-up)', !pg1.modal && pg1.heroTop === pg1.navB && pg1.boxTop >= pg1.navB + 16 && pg1.boxL >= 16 && pg1.boxR >= 16 && pg1.barB < pg1.vh && pg1.radius >= 12 && pg1.border === '1px' && /sample workspace/.test(pg1.chrome) && /Read-only/.test(pg1.chrome) && pg1.frameH > pg1.vh * 0.55 && pg1.src === '/demo-app', pg1);
  check('/demo: sandboxed frame (it can’t move the page without a click)', /allow-scripts/.test(pg1.sandbox) && !/allow-top-navigation(\s|$)/.test(pg1.sandbox) && /allow-top-navigation-by-user-activation/.test(pg1.sandbox), pg1.sandbox);
  check('/demo: a slim bar under the frame: the line and "Try 2 weeks for €1" (the money-back sentence once, in the section below, not twice)', /Explore OrivenAI with sample data/.test(pg1.bar) && !/money-back/.test(pg1.bar) && /Try 2 weeks for €1/.test(pg1.cta || '') && pg1.ctaHref === '/signup', pg1);
  const fr = demo.frames().find((f) => /\/demo-app/.test(f.url()));
  const inside = fr && await fr.evaluate(() => ({ demo: window.ORV_DEMO === true, path: location.pathname, isolated: (function () { try { return window.localStorage.getItem('probe') === null; } catch (_) { return false; } })(), sampleUser: !!document.querySelector('.app') && getComputedStyle(document.querySelector('.app')).display !== 'none', ownBar: !!document.querySelector('.orv-demo-bar'), consent: !!document.querySelector('.orv-cc') }));
  check('inside the window: the demo app with the sample account, its own storage (not the visitor’s), no banner or cookie dialog of its own', !!inside && inside.demo && inside.path === '/demo-app' && inside.isolated && inside.sampleUser && !inside.ownBar && !inside.consent, inside);
  await demo.screenshot({ path: path.join(SHOTS, 'demo-start.png') });

  // Every main section inside the window
  const go = async (id, ms) => { await fr.evaluate((x) => window.orvAppNav && window.orvAppNav.go(x), id); await demo.waitForTimeout(ms || 2200); };
  const activeText = () => fr.evaluate(() => { const a = document.querySelector('.page.active'); return a ? a.id + ' | ' + a.innerText.replace(/\s+/g, ' ').slice(0, 2500) : ''; });
  await go('dashboard', 3000); const dash = await activeText();
  check('section: Dashboard (sample business and figures)', /Amber & Clay|Sanne/.test(dash) && /€\s?\d/.test(dash), dash.slice(0, 200));
  await go('plan', 2500); const plan = await activeText();
  check('section: Marketing Plan', /Week|phase|plan/i.test(plan) && plan.length > 200, plan.slice(0, 160));
  await go('progress', 2500); const prog = await activeText();
  check('section: Progress', prog.length > 150, prog.slice(0, 160));
  await go('research', 2500); const rs = await activeText();
  check('section: Research (the sample report, fictional competitors only)', /Handmade candle brands in the Netherlands/.test(rs) && !/Kaarsenhuis|Wax & Wick/.test(rs), rs.slice(0, 160));
  await go('insights', 2500); const ins = await activeText();
  check('section: Insights', ins.length > 150, ins.slice(0, 160));
  await go('create', 2500); const cr = await activeText();
  check('section: Create', cr.length > 100, cr.slice(0, 160));
  await go('content', 4000);
  const mc = await fr.evaluate(() => ({ t: document.body.innerText, imgs: Array.from(document.querySelectorAll('#page-my-content img')).filter((i) => /\/assets\/demo\//.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 0).length }));
  check('section: My Content with the pre-written example AI ads (images shown)', mc.imgs >= 3 && /Candle season/.test(mc.t), mc.imgs);
  await go('testing', 2500); const ct = await activeText();
  check('section: Creative Testing (example headlines)', /Slow evenings, hand-poured|Sixty hours/.test(ct), ct.slice(0, 160));
  await go('adstudio', 2500); const as = await activeText();
  check('section: Ad Studio (Launch)', as.length > 100, as.slice(0, 160));
  await go('audiences', 2500); const au = await activeText();
  check('section: Audience Builder (sample audiences)', /Gift buyers|Home lovers/.test(au), au.slice(0, 160));
  await go('overview', 2500);
  const plats = await fr.evaluate(() => Array.from(document.querySelectorAll('#page-performance button')).map((b) => b.textContent.trim()).filter((t) => /^(Google|Meta|TikTok|Pinterest|Snapchat) Ads/.test(t)).map((t) => t.split(' Ads')[0]));
  check('section: Campaign Overview with all five ad platforms', ['Google', 'Meta', 'TikTok', 'Pinterest', 'Snapchat'].every((p) => plats.includes(p)), plats);
  for (const name of ['Meta Ads', 'TikTok Ads', 'Pinterest Ads', 'Snapchat Ads', 'Google Ads']) {
    await fr.evaluate((n) => { const b = Array.from(document.querySelectorAll('#page-performance button')).find((x) => x.textContent.trim().indexOf(n) === 0); if (b) b.click(); }, name); await demo.waitForTimeout(1500);
    const t = await fr.evaluate(() => document.getElementById('page-performance').innerText);
    check('  ' + name + ': sample campaigns shown', /Ad account\s*Amber & Clay|Amber & Clay/.test(t) && /€/.test(t), t.slice(0, 120));
  }
  await demo.screenshot({ path: path.join(SHOTS, 'demo-campaigns.png') });
  await go('compare', 2500); const cmp = await activeText();
  check('section: Campaign Comparison', cmp.length > 100, cmp.slice(0, 160));
  await go('auto-overview', 4000); const aO = await fr.evaluate(() => document.getElementById('page-autopilot').innerText);
  await go('auto-rules', 3000); const aR = await fr.evaluate(() => document.getElementById('page-autopilot').innerText);
  check('section: Automations (the example schedule and rule)', /Weekday hours/.test(aO) && /Scale winners/.test(aR), [aO.slice(0, 80), aR.slice(0, 80)]);
  const asst = await fr.evaluate(async () => { const b = document.querySelector('#orvAiFab, .orv-ai-fab, [data-assistant-open], .oa-launcher, .orv-agent-launcher'); if (b) b.click(); else if (typeof window.orvAiOpen === 'function') window.orvAiOpen(); await new Promise((r) => setTimeout(r, 900)); const p = document.querySelector('#orvAiPanel'); return { open: !!p && getComputedStyle(p).display !== 'none' && p.getBoundingClientRect().height > 100, name: /Nova/.test(document.body.innerText) }; });
  check('section: the AI assistant (Nova) opens', asst.open && asst.name, asst);
  await fr.evaluate(() => { if (typeof window.orvAiClose === 'function') window.orvAiClose(); document.querySelectorAll('#orvAiPanel').forEach((p) => p.classList.remove('open')); });
  const sett = await fr.evaluate(async () => { if (typeof window.openSettingsModal === 'function') window.openSettingsModal(); await new Promise((r) => setTimeout(r, 1200)); const m = document.querySelector('#settingsModal, .smd-modal, #modal-settings, .settings-modal'); return { open: !!m && m.getBoundingClientRect().height > 100, text: m ? m.innerText.slice(0, 160) : '' }; });
  check('section: Settings open (sample account)', sett.open, sett);
  await demo.screenshot({ path: path.join(SHOTS, 'demo-settings.png') });
  await fr.evaluate(() => { if (typeof window.closeSettingsModal === 'function') window.closeSettingsModal(); document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open')); });

  // Read-only: nothing can be created, generated, saved, connected, published or paid
  await go('create', 2000);
  const ro1 = await fr.evaluate(async () => { window._ov3Platform = 'meta'; window.cgrGenerate('An autumn ad for our candles', 'meta', 'images'); await new Promise((r) => setTimeout(r, 400)); const t = document.querySelector('.orv-demo-toast'); return { toast: t ? t.innerText : '', link: t && t.querySelector('a') ? [t.querySelector('a').getAttribute('href'), t.querySelector('a').getAttribute('target')] : null, page: document.querySelector('.page.active').id }; });
  check('Create → generate: "Not available in the demo — Try 2 weeks for €1" (link opens the signup in the main window), nothing generated', /Not available in the demo/.test(ro1.toast) && /Try 2 weeks for €1/.test(ro1.toast) && ro1.link && ro1.link[0] === '/signup' && ro1.link[1] === '_top' && ro1.page !== 'page-ad-workspace', ro1);
  await demo.screenshot({ path: path.join(SHOTS, 'demo-readonly.png') });
  const ro2 = await fr.evaluate(async () => { window.orvAiSend('Write me an ad'); await new Promise((r) => setTimeout(r, 300)); return (document.querySelector('.orv-demo-toast') || {}).innerText || ''; });
  check('assistant → send a message: the same message, no answer is generated', /Not available in the demo/.test(ro2), ro2);
  const ro3 = await fr.evaluate(async () => {
    const r = {};
    for (const [k, p, b] of [['chat', '/api/ai/chat', { message: 'x' }], ['ad', '/api/ai/create-ad', { platform: 'meta' }], ['image', '/api/generate-image', { prompt: 'x' }], ['research', '/api/research/query', { question: 'x' }], ['automation', '/api/automations', { name: 'x' }], ['publish', '/api/publish/meta', {}], ['connect', '/api/meta/disconnect', {}], ['pay', '/api/create-checkout-session', { plan: 'flex' }], ['delete', '/api/account/delete', {}], ['audience', '/api/audiences', { name: 'x' }]]) {
      const x = await apiFetch(p, { method: 'POST', body: JSON.stringify(b) }); r[k] = x.status + ':' + (x.data && x.data.code);
    }
    return r;
  });
  check('every create / generate / save / connect / publish / pay request is refused inside the page (403 DEMO), no example result', Object.values(ro3).every((v) => v === '403:DEMO'), ro3);
  const url1 = await fr.evaluate(() => location.pathname + location.search);
  check('the demo stays on /demo-app inside the window (the app’s /app?view=… is kept as /demo-app?view=…)', /^\/demo-app(\?|$)/.test(url1), url1);

  // Never /app, nothing left the page
  const top1 = await demo.evaluate(() => location.pathname);
  check('the page itself stays on /demo, never /app (no navigation to /app anywhere)', top1 === '/demo' && !navs.some((u) => /\/app(\?|$|\.html)/.test(u.replace(BASE, ''))), { top1, navs });
  const outside = outsideOf(framed);
  check('the demo window attempted NO request to any other host (no API, Supabase, AI, ad platform, Stripe, analytics) and no /api request', framed.length > 10 && outside.length === 0 && !framed.some((t) => /\/api\//.test(t)), outside.slice(0, 10));
  const pageOnly = outsideOf(tried.filter((t) => framed.indexOf(t) < 0));
  check('the /demo page itself: only what every marketing page sends (its cookieless page count, the consent-gated HeyCatch script); no Supabase, AI or Stripe', pageOnly.every((t) => /^POST http:\/\/localhost:5500\/api\/t$|^GET https:\/\/esm\.sh\/@heycatch\//.test(t)), pageOnly);

  // Scrolling down: what's in the demo, the €1 CTA, the money-back line, the footer
  await demo.evaluate(() => { const v = document.getElementById('view-demo'); v.scrollTop = v.scrollHeight; }); await demo.waitForTimeout(400);
  const below = await demo.evaluate(() => ({ text: document.querySelector('#view-demo .ov-demo').innerText, foot: document.querySelector('#view-demo .site-foot').getBoundingClientRect().top < innerHeight }));
  check('below the demo: what’s inside, "Try 2 weeks for €1", "14-day money-back guarantee on regular plans.", then the footer', /What’s in the demo/i.test(below.text) && /Try 2 weeks for €1/.test(below.text) && /14-day money-back guarantee on regular plans\./.test(below.text) && below.foot, below);
  await demo.screenshot({ path: path.join(SHOTS, 'demo-below.png') });
  await demo.close();

  // The visitor's own session and storage are untouched
  const after = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  check('signed-in visitor: their session and storage are unchanged by the demo (no sample campaigns, same token)', after.probe === 'real' && /real-user-token/.test(after['sb-rsqfoqitooxmkyrkuyzi-auth-token'] || '') && !Object.keys(after).some((k) => /oriven_campaigns_demo|demo-amber/.test(k)), Object.keys(after));
  await ctx.close();

  // "Demo" in the navbar: desktop and the mobile menu, from the homepage
  for (const vp of [{ width: 1440, height: 900, n: 'desktop' }, { width: 390, height: 844, n: 'mobile' }]) {
    ({ ctx, page } = await open('/', { vp }));
    if (vp.n === 'mobile') { await page.click('#lpHamburger'); await page.waitForTimeout(400); await page.click('#lpMobileMenu a.lp-mm-link[href="/demo"]'); }
    else await page.click('#lpNav a.lp-nav-link[href="/demo"]');
    await page.waitForURL(/\/demo$/, { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(6000);
    const r = await page.evaluate(() => { const h = document.querySelector('.ov-demo-hero__frame').getBoundingClientRect(), b = document.querySelector('.ov-demo-hero__bar').getBoundingClientRect(); return { url: location.pathname, frame: document.getElementById('orvDemoFrame').getAttribute('src'), l: Math.round(h.left), r: Math.round(innerWidth - h.right), top: Math.round(h.top), bottom: Math.round(innerHeight - b.bottom), overflow: document.documentElement.scrollWidth - innerWidth }; });
    const inner = await page.frames().find((f) => /\/demo-app/.test(f.url())).evaluate(() => ({ demo: window.ORV_DEMO === true, overflow: document.documentElement.scrollWidth - innerWidth }));
    check('navbar "Demo" (' + vp.n + ') → /demo with the demo in its frame: margins at both sides, space under the navbar and above the window’s bottom, never /app; no sideways scroll outside or inside', r.url === '/demo' && r.frame === '/demo-app' && r.l >= 16 && r.r >= 16 && r.top >= 64 + 16 && r.bottom > 0 && r.overflow <= 0 && inner.demo && inner.overflow <= 0, { r, inner });
    if (vp.n === 'mobile') await page.screenshot({ path: path.join(SHOTS, 'demo-mobile.png') });
    await ctx.close();
  }

  // /demo/ (trailing slash) is the same page; /demo-app/ goes on to /demo-app
  {
    const c2 = await browser.newContext(); const p2 = await c2.newPage();
    await p2.goto(BASE + '/demo/', { waitUntil: 'load' }); await p2.waitForTimeout(3000);
    const a = await p2.evaluate(() => ({ view: !!document.querySelector('#view-demo:not(.pub-view)'), open: document.getElementById('orvDemoFrame').getAttribute('src') === '/demo-app' }));
    await p2.goto(BASE + '/demo-app/', { waitUntil: 'load' }); await p2.waitForTimeout(4000);
    const b = await p2.evaluate(() => ({ path: location.pathname, demo: window.ORV_DEMO === true }));
    check('/demo/ shows the demo page; /demo-app/ ends up on /demo-app with the demo running', a.view && a.open && b.path === '/demo-app' && b.demo, { a, b });
    await c2.close();
  }

  // /app is untouched by the demo code
  ({ ctx, page } = await open('/app', { wait: 1500 }));
  check('/app does not load the demo layer', await page.evaluate(() => !window.ORV_DEMO && !window.ORV_DEMO_DATA && !document.querySelector('.orv-demo-bar')));
  await ctx.close();

  await browser.close(); srv.close();
  const files = ['js/demo-mode.js', 'js/demo-data.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  check('demo files contain no real competitor names or domains', !/kaarsenhuis|waxandwick|Wax & Wick/i.test(files));
  const head = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8').split('js/consent.js"></script>')[0];
  check('app.html loads the demo layer only on /demo-app, before consent.js', head.includes("if(/^\\/demo-app\\/?$/.test(location.pathname))document.write('<script src=\"/js/demo-data.js\"><\\/script><script src=\"/js/demo-mode.js\"><\\/script>');"), head.slice(-400));
  const red = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
  check('_redirects: /demo is the marketing page (demo.html), /demo-app the app shell', /^\/demo\s+\/demo\.html\s+200!/m.test(red) && /^\/demo-app\s+\/app\.html\s+200/m.test(red) && !/^\/demo\s+\/app\.html/m.test(red));
  const errs = errors.filter((e) => !/Blocked in the demo|Failed to fetch|NetworkError/.test(e));
  check('no page errors', !errs.length, errs.slice(0, 8));
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
