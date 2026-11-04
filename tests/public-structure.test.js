/* ════════════════════════════════════════════════════════════════
   Public site structure: the six sections and their pages, told the same
   way everywhere.
   Checks: the homepage workflow ("One loop. Six sections.") lists Control
   Center → Research → Create → Launch → Campaigns → Automations, its ring
   tags follow the same order, and the twelve pages sit under the right
   section; /product shows the same six in the same order with the same
   pages and real links; each product page names its own pages; the
   homepage FAQ and /faq come from tools/seo/faq.js (every homepage
   question is on /faq with the same answer); desktop and mobile nav list
   the six products in order and have no Agents link; public page headers
   get the shared dot field (one engine, drawn, never in the way of a
   click, no static dot layer under it) and it stays still under reduced
   motion.
   Own Netlify-like server (applies _redirects) + tests/_fence.js: nothing
   leaves the browser except static CDN GETs. No backend, no Supabase.
   RUN: node tests/public-structure.test.js
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = 8893, BASE = 'http://127.0.0.1:' + PORT;
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const FAQ = require('../tools/seo/faq');
let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 600) : '')); } }

const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  const r = rules.find((x) => x[0] === p && /^200/.test(x[2])); if (r) p = r[1];
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (_) { if (fs.existsSync(f + '.html')) f += '.html'; }
  fs.readFile(f, (e, b) => { s.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(e ? 'not found' : b); });
});

const SECTIONS = ['Control Center', 'Research', 'Create', 'Launch', 'Campaigns', 'Automations'];
const PAGES = {
  'Control Center': ['Dashboard', 'Marketing Plan', 'Progress'], Research: ['Research', 'Insights'], Create: ['Create', 'My Content'],
  Launch: ['Ad Studio'], Campaigns: ['Campaign Overview', 'Campaign Builder'], Automations: ['Automations', 'Activity History'],
};
const ROUTE = { 'Control Center': '/business', Research: '/research', Create: '/create', Launch: '/launch', Campaigns: '/campaigns', Automations: '/autopilot' };
const pageNames = (ul) => [...ul.querySelectorAll('li')].map((li) => li.firstChild.textContent.trim());
const norm = (s) => s.replace(/\s+/g, ' ').trim();

async function main() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  require('./_fence').fenceBrowser(browser, BASE);
  const open = async (url, opts = {}) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts));
    await ctx.addInitScript(() => { try { localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: false, at: '2026-10-28T00:00:00.000Z' })); } catch (_) {} });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + url, { waitUntil: 'load' }); await page.waitForTimeout(1800);
    return { ctx, page, errors };
  };

  // ── A. Homepage workflow ──
  console.log('── A. Homepage workflow ──');
  let { ctx, page, errors } = await open('/');
  const wf = await page.evaluate((fnSrc) => {
    const names = eval(fnSrc);
    return {
      steps: [...document.querySelectorAll('.ik-step')].map((s) => ({ name: s.querySelector('.ik-step__num').textContent.replace(/^\d+\s*·\s*/, '').trim(), num: s.querySelector('.ik-step__num').textContent.trim().slice(0, 2), pages: names(s.querySelector('.ik-step__pages')), dev: [...s.querySelectorAll('.ik-step__pages li.is-dev')].map((l) => l.firstChild.textContent.trim()) })),
      tags: [...document.querySelectorAll('.ik-loop__tag')].sort((a, b) => a.dataset.i - b.dataset.i).map((t) => t.textContent.trim()),
      segs: document.querySelectorAll('.ik-ring--loop .ik-seg').length,
      note: !!document.querySelector('.ik-pages-note'),
    };
  }, pageNames.toString());
  check('workflow: six numbered sections in order Control Center → Research → Create → Launch → Campaigns → Automations', JSON.stringify(wf.steps.map((s) => s.name)) === JSON.stringify(SECTIONS) && wf.steps.map((s) => s.num).join() === '01,02,03,04,05,06', wf.steps.map((s) => s.num + ' ' + s.name));
  check('workflow ring: six segments, tags in the same order', wf.segs === 6 && JSON.stringify(wf.tags) === JSON.stringify(SECTIONS), wf.tags);
  check('workflow: the twelve pages, each under its own section', wf.steps.every((s) => JSON.stringify(s.pages) === JSON.stringify(PAGES[s.name])) && wf.steps.reduce((n, s) => n + s.pages.length, 0) === 12, wf.steps);
  check('workflow: pages not in the app yet are still marked "In development" (Progress, My Content); the separate disclaimer line was removed on request', JSON.stringify(wf.steps.flatMap((s) => s.dev)) === '["Progress","My Content"]' && !wf.note, wf.steps.flatMap((s) => s.dev));
  const landingFaq = await page.evaluate(() => [...document.querySelectorAll('#faq details')].map((d) => ({ q: d.querySelector('summary').textContent.trim(), a: d.querySelector('div').textContent.trim() })));
  const nav = await page.evaluate(() => ({
    desk: [...document.querySelectorAll('#lpDdProduct .lp-dd-col')].map((c) => [...c.querySelectorAll('.lp-dd-item-name')].map((n) => n.textContent.trim())),
    deskHref: [...document.querySelectorAll('#lpDdProduct .lp-dd-col:nth-child(2) a')].map((a) => a.getAttribute('href')),
    mob: [...document.querySelectorAll('#lpMobileMenu a')].map((a) => a.getAttribute('href')),
    agents: [...document.querySelectorAll('#lpNav a, #lpMobileMenu a')].filter((a) => /^\s*agents\s*$/i.test(a.textContent)).length,
  }));
  check('desktop nav: Products lists the six sections in order, each to its product page', JSON.stringify(nav.desk[1]) === JSON.stringify(SECTIONS) && JSON.stringify(nav.deskHref) === JSON.stringify(SECTIONS.map((s) => ROUTE[s])), nav.desk[1]);
  const mobProducts = nav.mob.filter((h) => Object.values(ROUTE).includes(h)).slice(0, 6);
  check('mobile nav: the same six product pages in the same order; no Agents link anywhere in the nav', JSON.stringify(mobProducts) === JSON.stringify(SECTIONS.map((s) => ROUTE[s])) && nav.agents === 0, { mobProducts, agents: nav.agents });
  check('homepage: no JavaScript errors', errors.length === 0, errors);
  await ctx.close();

  // ── B. Products ──
  console.log('── B. Products ──');
  ({ ctx, page, errors } = await open('/product'));
  const prod = await page.evaluate((fnSrc) => {
    const names = eval(fnSrc);
    return [...document.querySelectorAll('.ov-section-card')].map((c) => ({ name: c.querySelector('.ov-plat-feat-title').textContent.trim(), num: c.querySelector('.ov-section-num').textContent.trim(), href: c.getAttribute('href'), pages: names(c.querySelector('.ov-section-pages')) }));
  }, pageNames.toString());
  check('/product: exactly the six sections, numbered, in workflow order', JSON.stringify(prod.map((p) => p.name)) === JSON.stringify(SECTIONS) && prod.map((p) => p.num).join() === '01,02,03,04,05,06', prod.map((p) => p.name));
  check('/product: each card links to its product page and lists the same pages as the homepage workflow', prod.every((p) => p.href === ROUTE[p.name] && JSON.stringify(p.pages) === JSON.stringify(PAGES[p.name])), prod);
  check('/product: no JavaScript errors', errors.length === 0, errors);
  await ctx.close();
  for (const s of SECTIONS) {
    ({ ctx, page } = await open(ROUTE[s]));
    const got = await page.evaluate((fnSrc) => { const names = eval(fnSrc); const ul = document.querySelector('.ov-hero-pages'); return { eyebrow: (document.querySelector('.ov-sp-hero .ov-eyebrow') || {}).textContent, pages: ul ? names(ul) : null, h1: document.querySelectorAll('h1').length }; }, pageNames.toString());
    check(`${ROUTE[s]}: ${s} names its pages in the header (one H1)`, got.eyebrow.trim() === s && JSON.stringify(got.pages) === JSON.stringify(PAGES[s]) && got.h1 === 1, got);
    await ctx.close();
  }

  // ── C. FAQ: one source ──
  console.log('── C. FAQ ──');
  ({ ctx, page, errors } = await open('/faq'));
  const pageFaq = await page.evaluate(() => [...document.querySelectorAll('#view-faq .ov-faq')].map((d) => ({ q: d.querySelector('.ov-faq-q span').textContent.trim(), a: d.querySelector('.ov-faq-a').textContent.trim() })));
  check('homepage FAQ = the core questions of tools/seo/faq.js, in order', JSON.stringify(landingFaq.map((x) => x.q)) === JSON.stringify(FAQ.core.map((x) => x[0])), landingFaq.map((x) => x.q));
  check('/faq starts with every homepage question, with the same answer, then the page-only questions', landingFaq.every((x, i) => pageFaq[i] && pageFaq[i].q === x.q && norm(pageFaq[i].a) === norm(x.a)) && pageFaq.length === FAQ.all.length, { home: landingFaq.length, page: pageFaq.length });
  check('/faq: no outdated questions ("What does Oriven do?", "How does signup work?") and no "this page" pointer from the homepage copy', !pageFaq.some((x) => /What does Oriven do\?|How does signup work\?/.test(x.q)) && !pageFaq.some((x) => /on this page/.test(x.a)), pageFaq.map((x) => x.q));
  const ld = await page.evaluate(() => { const s = [...document.querySelectorAll('script[type="application/ld+json"]')].map((x) => JSON.parse(x.textContent)).find((o) => o['@type'] === 'FAQPage'); return s ? s.mainEntity.length : 0; });
  check('/faq: FAQPage structured data covers every visible question', ld === pageFaq.length, { ld, visible: pageFaq.length });
  await page.click('#view-faq .ov-faq-q >> nth=3'); await page.waitForTimeout(300);
  check('/faq: accordion still opens', await page.evaluate(() => document.querySelectorAll('#view-faq .ov-faq')[3].classList.contains('open') || getComputedStyle(document.querySelectorAll('#view-faq .ov-faq-a')[3]).maxHeight !== '0px'));
  await ctx.close();

  // ── D. Header dot field ──
  console.log('── D. Header dot field ──');
  for (const url of ['/product', '/solutions', '/about', '/learn/', '/blog/what-you-can-do-with-oriven']) {
    ({ ctx, page, errors } = await open(url));
    const h = await page.evaluate(() => {
      const hero = document.querySelector('.ov-sp-hero, .sp-hero'), c = hero.querySelector('canvas.ik-field--header'), h1 = hero.querySelector('h1').getBoundingClientRect();
      const top = document.elementFromPoint(h1.left + h1.width / 2, h1.top + h1.height / 2);
      return { one: hero.querySelectorAll('canvas').length === 1 && document.querySelectorAll('canvas.ik-field--header').length === 1, drawn: c.classList.contains('is-on'), pe: getComputedStyle(c).pointerEvents, h1Top: hero.querySelector('h1').contains(top), engine: !!window.IkDotField && window.IkDotField.fields.length === document.querySelectorAll('canvas.ik-field--header, canvas.ik-field--cta').length, staticDots: /radial-gradient\(circle at/.test(getComputedStyle(hero, '::before').backgroundImage) };
    });
    check(`${url}: header has one shared-engine dot field, drawn, under the heading, never blocking clicks, no static dot layer`, h.one && h.drawn && h.pe === 'none' && h.h1Top && h.engine && !h.staticDots && errors.length === 0, Object.assign(h, { errors }));
    await ctx.close();
  }
  ({ ctx, page } = await open('/product'));
  const P = await page.evaluate(() => { const c = document.querySelector('canvas.ik-field--header'); const r = c.getBoundingClientRect(); return { x: Math.round(r.left + 12 + 24 * 8), y: Math.round(r.top + 12 + 24 * 6) }; });
  const ink = () => page.evaluate(({ x, y }) => { const c = document.querySelector('canvas.ik-field--header'); const r = c.getBoundingClientRect(); const k = c.width / r.width, R = 10; const d = c.getContext('2d').getImageData(Math.round((x - r.left - R) * k), Math.round((y - r.top - R) * k), Math.round(2 * R * k), Math.round(2 * R * k)).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s; }, P);
  await page.mouse.move(P.x - 80, P.y + 40); await page.mouse.move(P.x, P.y, { steps: 5 }); await page.waitForTimeout(800);
  const during = await ink();
  await page.mouse.move(1400, 880, { steps: 4 }); await page.waitForTimeout(1600);
  const after = await ink();
  check('header field: the dot under the pointer moves away, and the lattice comes back after the pointer leaves', during === 0 && after > 0, { during, after });
  // The closing CTA: same engine, same behaviour, and nothing static under it.
  await page.evaluate(() => document.querySelector('.site-cta').scrollIntoView({ block: 'center' })); await page.waitForTimeout(1200);
  const C = await page.evaluate(() => { const c = document.querySelector('canvas.ik-field--cta'); const r = c.getBoundingClientRect(); const cta = document.querySelector('.site-cta'); const bg = [getComputedStyle(cta, '::before').backgroundImage, getComputedStyle(cta, '::after').backgroundImage, getComputedStyle(cta).backgroundImage].join(' '); return { x: Math.round(r.left + 12 + 24 * 6), y: Math.round(r.top + 12 + 24 * 3), drawn: c.classList.contains('is-on'), staticDots: /radial-gradient\(circle at/.test(bg), textTop: document.elementFromPoint(innerWidth / 2, cta.querySelector('h2').getBoundingClientRect().top + 10).closest('h2') !== null }; });
  const inkC = () => page.evaluate(({ x, y }) => { const c = document.querySelector('canvas.ik-field--cta'); const r = c.getBoundingClientRect(); const k = c.width / r.width, R = 10; const d = c.getContext('2d').getImageData(Math.round((x - r.left - R) * k), Math.round((y - r.top - R) * k), Math.round(2 * R * k), Math.round(2 * R * k)).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s; }, C);
  await page.mouse.move(C.x - 80, C.y + 30); await page.mouse.move(C.x, C.y, { steps: 5 }); await page.waitForTimeout(800);
  const cDuring = await inkC();
  await page.mouse.move(1400, 880, { steps: 4 }); await page.waitForTimeout(1600);
  const cAfter = await inkC();
  check('closing CTA field: drawn, under the heading, no static dot layer; the dot under the pointer moves away and comes back', C.drawn && C.textTop && !C.staticDots && cDuring === 0 && cAfter > 0, Object.assign(C, { cDuring, cAfter }));
  await page.evaluate(() => { // scroll whatever actually scrolls this page (a view container or the document)
    let el = document.querySelector('.ov-sp-hero').parentElement; while (el && !(el.scrollHeight > el.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    (el || document.scrollingElement).scrollTop = 2400; window.scrollTo(0, 2400);
  }); await page.waitForTimeout(900);
  const s1 = await page.evaluate(() => document.querySelector('canvas.ik-field--header').toDataURL()); await page.waitForTimeout(500);
  check('header field: stops drawing once scrolled off screen', s1 === await page.evaluate(() => document.querySelector('canvas.ik-field--header').toDataURL()));
  await ctx.close();
  ({ ctx, page } = await open('/about', { reducedMotion: 'reduce' }));
  const r1 = await page.evaluate(() => document.querySelector('canvas.ik-field--header').toDataURL()); await page.waitForTimeout(600);
  check('reduced motion: header field drawn once and still', r1.length > 1000 && r1 === await page.evaluate(() => document.querySelector('canvas.ik-field--header').toDataURL()));
  await ctx.close();
  ({ ctx, page, errors } = await open('/solutions', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }));
  const mob = await page.evaluate(() => { // the page's own scrollers: the document and any full-height vertical scroll container
    const scrollers = [document.scrollingElement, ...[...document.querySelectorAll('body *')].filter((x) => /auto|scroll/.test(getComputedStyle(x).overflowY) && x.clientHeight >= innerHeight * 0.8)];
    return { overflow: Math.max(...scrollers.map((x) => x.scrollWidth - x.clientWidth)), drawn: document.querySelector('canvas.ik-field--header').classList.contains('is-on') }; });
  check('mobile 390px: header field drawn, no horizontal overflow, no errors', mob.drawn && mob.overflow <= 0 && errors.length === 0, Object.assign(mob, { errors }));
  await ctx.close();

  // ── E. Shared chrome: one navbar, one footer, one closing CTA ──
  console.log('── E. Shared navbar, footer and closing CTA ──');
  const PUBLIC = ['/', '/product', '/business', '/research', '/create', '/launch', '/campaigns', '/autopilot', '/solutions', '/pricing', '/faq', '/about', '/case-studies', '/blog', '/blog/why-we-built-oriven', '/learn/', '/learn/what-is-ppc-automation/', '/product/meta-ads', '/terms'];
  const chrome = {};
  for (const url of PUBLIC) {
    ({ ctx, page, errors } = await open(url));
    chrome[url] = await page.evaluate(() => {
      const norm = (el) => el ? el.outerHTML.replace(/\s+/g, ' ').replace(/ class="([^"]*?)\s*(lp-nav-scrolled|lp-nav-active)\s*"/g, ' class="$1"') : '';
      const ctaEl = document.querySelector('.site-cta');
      return {
        foot: document.querySelectorAll('footer').length + ':' + norm(document.querySelector('footer.site-foot')).length + ':' + (document.querySelector('footer.site-foot') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
        nav: [...document.querySelectorAll('#lpNav a, #lpMobileMenu a')].map((a) => a.getAttribute('href') + '=' + a.textContent.replace(/\s+/g, ' ').trim()).join('|'),
        cta: !!ctaEl, ctaCanvas: ctaEl ? ctaEl.querySelectorAll('canvas.ik-field--cta').length : 0,
        ctaOrder: ctaEl ? !!(ctaEl.compareDocumentPosition(document.querySelector('footer.site-foot')) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
        ctaLinks: ctaEl ? [...ctaEl.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
        h1: document.querySelectorAll('h1').length,
      };
    });
    chrome[url].errors = errors;
    await ctx.close();
  }
  const ref = chrome['/product'];
  check('every public page has exactly one footer, the shared one, with identical content', PUBLIC.every((u) => chrome[u].foot === ref.foot && /^1:/.test(chrome[u].foot)), PUBLIC.filter((u) => chrome[u].foot !== ref.foot));
  check('every public page has the same navbar (desktop and mobile links), no Agents link', PUBLIC.every((u) => chrome[u].nav === ref.nav) && !/=Agents(\||$)/.test(ref.nav), PUBLIC.filter((u) => chrome[u].nav !== ref.nav));
  const CONTENT = PUBLIC.filter((u) => !['/', '/terms'].includes(u));
  check('content pages close with the shared CTA (before the footer) over its own dot field', CONTENT.every((u) => chrome[u].cta && chrome[u].ctaCanvas === 1 && chrome[u].ctaOrder), CONTENT.filter((u) => !(chrome[u].cta && chrome[u].ctaCanvas === 1 && chrome[u].ctaOrder)).map((u) => u + JSON.stringify(chrome[u])));
  const routes = new Set(rules.map((r) => r[0]));
  const ctaOk = (h) => /^mailto:/.test(h) || routes.has(h) || fs.existsSync(path.join(ROOT, h.replace(/^\//, ''), 'index.html')) || fs.existsSync(path.join(ROOT, h.replace(/^\//, '') + '.html'));
  check('every CTA link points to an existing route', CONTENT.every((u) => chrome[u].ctaLinks.every(ctaOk)), CONTENT.map((u) => chrome[u].ctaLinks.filter((h) => !ctaOk(h))).flat());
  check('all public pages: one H1, no JavaScript errors', PUBLIC.every((u) => chrome[u].h1 === 1 && chrome[u].errors.length === 0), PUBLIC.filter((u) => chrome[u].h1 !== 1 || chrome[u].errors.length).map((u) => u + JSON.stringify(chrome[u].errors)));

  // ── F. Inside each section, and Solutions ──
  console.log('── F. Inside each section, Solutions ──');
  const STATUS = { 'Control Center': ['live', 'live', 'dev'], Research: ['live', 'part'], Create: ['live', 'dev'], Launch: ['live'], Campaigns: ['live', 'part'], Automations: ['live', 'live'] };
  for (const s of SECTIONS) {
    ({ ctx, page, errors } = await open(ROUTE[s]));
    const pp = await page.evaluate(() => {
      const root = document.querySelector('[data-pp]');
      return root && {
        pages: [...root.querySelectorAll('[data-pp-page] h3')].map((h) => h.textContent.trim()),
        nav: [...root.querySelectorAll('[data-pp-link] .pp__name')].map((n) => n.textContent.trim()),
        status: [...root.querySelectorAll('[data-pp-page] .pp__meta .pp-status')].map((x) => x.className.match(/pp-status--(\w+)/)[1]),
        figs: [...root.querySelectorAll('.pp__fig')].every((f) => /^Illustration/.test(f.querySelector('figcaption').textContent) && f.querySelector('.pm').getAttribute('aria-hidden') === 'true' && !f.querySelector('button, input, select, textarea, a')),
        tasks: /\bTasks page\b/.test(root.textContent) && !/no separate Tasks page/i.test(root.textContent),
        generic: !!document.querySelector('.ov-sp-section .ov-sp-tag') && [...document.querySelectorAll('.ov-sp-tag')].some((t) => /^(What You Get|How (Business|Research|Create|Launch|Automations) Works?|The Campaign Workspace)$/i.test(t.textContent.trim())),
      };
    });
    check(`${ROUTE[s]}: "Inside ${s}" shows ${PAGES[s].join(', ')} with honest statuses, illustrations that are not controls, no old generic blocks`,
      pp && JSON.stringify(pp.pages) === JSON.stringify(PAGES[s]) && JSON.stringify(pp.nav) === JSON.stringify(PAGES[s]) && JSON.stringify(pp.status) === JSON.stringify(STATUS[s]) && pp.figs && !pp.tasks && !pp.generic && errors.length === 0, pp);
    if (s === 'Research') {
      await page.click('[data-pp-link] >> nth=1'); await page.waitForTimeout(1200);
      const nav = await page.evaluate(() => ({ focus: document.activeElement && document.activeElement.id, cur: (document.querySelector('[data-pp-link][aria-current="true"] .pp__name') || {}).textContent, top: Math.round(document.getElementById('pp-product-research-insights').getBoundingClientRect().top) }));
      check('page list: a link scrolls to its page, focuses it and marks it current', nav.focus === 'pp-product-research-insights' && nav.cur === 'Insights' && nav.top < 200, nav);
    }
    await ctx.close();
  }
  ({ ctx, page, errors } = await open('/solutions'));
  const sol = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.sol__card')].map((c) => ({ id: c.id, h: c.querySelector('h3').textContent.trim(), links: [...c.querySelectorAll('.sol__links a')].map((a) => a.getAttribute('href')) })), nav: [...document.querySelectorAll('#lpDdSolutions a')].map((a) => a.getAttribute('href')) }));
  const SOL_PAGES = ['/solutions/connected-workflow', '/solutions/research-before-creation', '/solutions/plan-to-content', '/solutions/advertising-campaigns', '/solutions/structured-automation'];
  check('/solutions: five concepts, each leading first to its OWN page, then to existing product sections', sol.cards.length === 5 && JSON.stringify(sol.cards.map((c) => c.links[0])) === JSON.stringify(SOL_PAGES) && sol.cards.every((c) => c.links.length >= 2 && c.links.every(ctaOk)), sol.cards);
  check('Solutions menu (desktop): the same five dedicated pages, no shared destination', JSON.stringify(sol.nav) === JSON.stringify(SOL_PAGES), sol.nav);
  const mobSol = await page.evaluate(() => [...document.querySelectorAll('#lpMobileMenu a[href^="/solutions"]')].map((a) => a.getAttribute('href')));
  check('Solutions menu (mobile): the same five dedicated pages', JSON.stringify(mobSol) === JSON.stringify(SOL_PAGES), mobSol);
  await ctx.close();

  // ── F2. The five solution pages ──
  console.log('── F2. Solution pages ──');
  const seen = { h1: new Set(), title: new Set(), desc: new Set() };
  for (const url of SOL_PAGES) {
    ({ ctx, page, errors } = await open(url));
    const read = () => page.evaluate(() => {
      const links = [...document.querySelectorAll('main a, .site-cta a')].map((a) => a.getAttribute('href'));
      return {
        path: location.pathname, h1: document.querySelector('h1').textContent.trim(), h1n: document.querySelectorAll('h1').length, title: document.title,
        desc: (document.querySelector('meta[name="description"]') || {}).content, canonical: (document.querySelector('link[rel="canonical"]') || {}).href,
        crumb: [...document.querySelectorAll('.sp-crumbs a')].map((a) => a.getAttribute('href')),
        product: [...new Set(links.filter((h) => /^\/(business|research|create|launch|campaigns|autopilot)$/.test(h)))],
        others: [...new Set(links.filter((h) => /^\/solutions\/[a-z-]+$/.test(h) && h !== location.pathname))],
        foot: !!document.querySelector('footer.site-foot'), cta: !!document.querySelector('.site-cta canvas.ik-field--cta'), header: !!document.querySelector('.sp-hero canvas.ik-field--header'),
        words: document.querySelector('main').innerText.split(/\s+/).length,
        claimsAssistant: /choose (an|your) (ai )?assistant/i.test(document.body.innerText),
        devPages: /Progress[^.]*in development|My Content[^.]*in development|in development[^.]*(Progress|My Content)/i.test(document.body.innerText),
      };
    });
    const a = await read();
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
    const b = await read();
    check(`${url}: loads directly and after a refresh, own H1/title/description, canonical, breadcrumb via /solutions, shared header field, CTA and footer, links to product sections and the other solutions`,
      a.path === url && b.path === url && a.h1n === 1 && a.h1 === b.h1 && a.canonical === 'https://orivenai.com' + url && a.crumb.includes('/solutions') && a.foot && a.cta && a.header && a.product.length >= 2 && a.others.length >= 3 && a.words > 400 && !a.claimsAssistant && errors.length === 0, a);
    seen.h1.add(a.h1); seen.title.add(a.title); seen.desc.add(a.desc);
    if (url.endsWith('connected-workflow') || url.endsWith('plan-to-content')) check(`${url}: unfinished pages are named as in development (Progress / My Content)`, a.devPages, a);
    await ctx.close();
  }
  check('the five solution pages are distinct: different H1s, titles and descriptions', seen.h1.size === 5 && seen.title.size === 5 && seen.desc.size === 5, [...seen.h1]);

  // ── G. Restored routes: direct load and refresh ──
  console.log('── G. Restored routes ──');
  for (const [url, h1] of [['/blog', /Blog/], ['/faq', /Questions/], ['/case-studies', /How Oriven replaces/], ['/about', /Built to solve/], ['/pricing', /pricing/i], ['/blog/oriven-ai-is-now-live', /now live/i]]) {
    ({ ctx, page, errors } = await open(url));
    const first = await page.evaluate(() => document.querySelector('h1').textContent);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, path: location.pathname, nf: /not found/i.test(document.body.innerText.slice(0, 400)) }));
    check(`${url}: loads directly and after a refresh`, h1.test(first) && h1.test(after.h1) && after.path === url && !after.nf && errors.length === 0, after);
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); server.close(); process.exit(1); });
