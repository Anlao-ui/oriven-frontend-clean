/* ════════════════════════════════════════════════════════════════
   The 2026-11 "ad workspace" homepage: the workspace section (seven
   connected steps, each saying where the work happens), the plan roadmap,
   the assistant's facts in the first screen with its full profile in a
   drawer, the shorter final call to action without the list of agents, the
   shared design layer, and no "in development" claims for pages that exist.

   SAFE: this test's own static server; tests/_fence.js aborts every other
   request. No account, no API.
   RUN: node tests/workspace-landing.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  let f = path.join(ROOT, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1', async () => {
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  require('./_fence').fenceBrowser(browser, BASE, { backend401: true });
  const errors = [];
  const open = async (w, h, p) => { const page = await browser.newPage({ viewport: { width: w, height: h } }); page.on('pageerror', (e) => errors.push(e.message)); await page.goto(BASE + (p || '/'), { waitUntil: 'load' }); await page.addStyleTag({ content: '.orv-cc{display:none!important}' }); await page.waitForTimeout(900); return page; };
  const scrollTo = (page, id) => page.evaluate((id) => { const v = document.getElementById('view-landing'); v.scrollTop += document.getElementById(id).getBoundingClientRect().top - 80; }, id);
  try {
    console.log('\n1. The workspace section');
    let page = await open(1440, 900);
    const ws = await page.evaluate(() => {
      const s = document.getElementById('workspace');
      return { h2: s.querySelector('h2').textContent, steps: [...s.querySelectorAll('.ik-ws__step')].map((li) => { const a = li.querySelector('a.ik-ws__block'); return { t: li.querySelector('h3').textContent, href: a && a.getAttribute('href'), num: (li.querySelector('.ik-ws__num') || {}).textContent, icon: !!li.querySelector('.ik-ws__ico svg'), paras: li.querySelectorAll('p').length }; }),
        // Everything in the section besides the eyebrow, the heading and the seven blocks.
        extra: [...s.querySelectorAll('p, ul, .ow-lead, .ik-ws__legend, .ik-ws__honest')].filter((e) => !e.classList.contains('ow-eyebrow') && !e.closest('.ik-ws__flow')).map((e) => e.className || e.tagName),
        ow: !!document.querySelector('link[href="/css/ow-system.css"]'), owJs: !!window.owUI,
        heroCta: [...document.querySelectorAll('.ik-hero .ik-btn')].map((a) => a.getAttribute('href')) };
    });
    check('1.1 exactly seven workflow blocks, in order: Understand your business … Optimize and scale', ws.steps.map((x) => x.t).join('|') === 'Understand your business|Plan your strategy|Research the market|Create the ads|Prepare the campaign|Launch and follow results|Optimize and scale', ws.steps.map((x) => x.t));
    check('1.2 the section is only its heading and the seven blocks: no intro, legend, notes or paragraphs; each block is a number, an icon and a title', ws.h2 === 'Everything your advertising needs, in one place.' && ws.extra.length === 0 && ws.steps.every((x, i) => x.num === String(i + 1).padStart(2, '0') && x.icon && x.paras === 0), { extra: ws.extra, steps: ws.steps });
    const known = ['/business', '/research', '/create', '/launch', '/campaigns', '/autopilot'];
    check('1.3 each block opens the real section page for that step', ws.steps.map((x) => x.href).join() === '/business,/business,/research,/create,/launch,/campaigns,/autopilot' && known.every((k) => fs.existsSync(path.join(ROOT, k.slice(1) + '.html'))), ws.steps.map((x) => x.href));
    check('1.5 the hero leads to the workspace; the shared design layer (css/ow-system.css, js/ow-ui.js) is loaded', ws.heroCta.join() === '/signup,#workspace' && ws.ow && ws.owJs, ws);
    await scrollTo(page, 'workspace'); await page.waitForTimeout(900);
    const lay = await page.evaluate(() => { const c = [...document.querySelectorAll('.ik-ws__block')].map((x) => x.getBoundingClientRect()); const head = document.querySelector('#workspace h2').getBoundingClientRect(); return { tops: [...new Set(c.map((r) => Math.round(r.top)))], heights: [...new Set(c.map((r) => Math.round(r.height)))], widths: [...new Set(c.map((r) => Math.round(r.width)))], left: Math.round(c[0].left), right: Math.round(c[6].right), headLeft: Math.round(head.left), vw: innerWidth }; });
    check('1.6 at 1440 px all seven blocks sit in one row, one width and one height each, aligned with the heading and spanning the content width', lay.tops.length === 1 && lay.heights.length === 1 && lay.widths.length === 1 && lay.left === lay.headLeft && lay.right - lay.left > lay.vw * 0.85, lay);
    // Hover with the real mouse, then keyboard focus: the block lifts, gains a shadow; focus also shows an outline.
    const b4 = await page.locator('#workspace .ik-ws__block').nth(3).boundingBox();
    await page.mouse.move(b4.x + b4.width / 2, b4.y + b4.height / 2); await page.waitForTimeout(450);
    const hov = await page.evaluate(() => { const s = getComputedStyle(document.querySelectorAll('#workspace .ik-ws__block')[3]); return { y: new DOMMatrix(s.transform).m42, shadow: s.boxShadow !== 'none', transition: /transform/.test(s.transitionProperty) }; });
    await page.mouse.move(5, 5); await page.waitForTimeout(400);
    await page.focus('#workspace .ik-ws__block >> nth=5'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(450);
    const foc = await page.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return { isBlock: a.classList.contains('ik-ws__block'), y: new DOMMatrix(s.transform).m42, outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 }; });
    check('1.4 hover lifts a block with a soft shadow (animated); keyboard focus gives the same lift plus an outline', hov.y < 0 && hov.y >= -6 && hov.shadow && hov.transition && foc.isBlock && foc.y < 0 && foc.outline, { hov, foc });
    { const big = await open(1920, 1080); await scrollTo(big, 'workspace'); await big.waitForTimeout(700);
      const l2 = await big.evaluate(() => { const c = [...document.querySelectorAll('.ik-ws__block')].map((x) => x.getBoundingClientRect()); return { tops: [...new Set(c.map((r) => Math.round(r.top)))], span: Math.round(c[6].right - c[0].left), vw: innerWidth }; });
      check('1.7 at 1920 px still one row, using most of the screen width', l2.tops.length === 1 && l2.span > 1400, l2); await big.close(); }

    console.log('\n2. The plan roadmap');
    const plan = await page.evaluate(() => { const s = document.getElementById('plan'); return { h2: s.querySelector('h2').textContent, phases: s.querySelectorAll('.ik-road__phases li').length, now: (s.querySelector('.ik-road__phases [aria-current="step"]') || {}).textContent, tasks: [...s.querySelectorAll('.ik-road__task')].map((t) => t.className.replace('ik-road__task ', '')), dl: [...s.querySelectorAll('.ik-road__task.is-now dt')].map((d) => d.textContent), tool: (s.querySelector('.ik-road__tool') || {}).getAttribute && s.querySelector('.ik-road__tool').getAttribute('href'), label: /Illustrative example/.test(s.textContent), text: s.textContent }; });
    check('2.1 "A plan built around your business." as a roadmap: phases, done / current / next tasks', plan.h2 === 'A plan built around your business.' && plan.phases === 4 && /Week 2/.test(plan.now) && plan.tasks.join() === 'is-done,is-now,is-next', plan);
    check('2.2 the current task says why, what to do and the result, and opens its tool', plan.dl.join() === 'Why,Do,Result' && plan.tool === '/launch', plan);
    check('2.3 labelled as an illustrative example; no "In development" or "undefined"', plan.label && !/In development|undefined/.test(plan.text));

    console.log('\n3. The assistant: facts first, profile in a drawer');
    await scrollTo(page, 'agents'); await page.waitForTimeout(1200);
    const ag = await page.evaluate(() => { const a = [...document.querySelectorAll('.ik-agent')].find((x) => !x.hidden); const vis = (el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom <= innerHeight && r.top >= 0; };
      return { name: a.querySelector('.ik-agent__name').textContent, nameVis: vis(a.querySelector('.ik-agent__name')), skillsVis: vis(a.querySelector('.ik-agent__skills')), moreVis: vis(a.querySelector('[data-ik-profile]')), chatHidden: getComputedStyle(a.querySelector('.ik-chat')).display === 'none', h2: document.getElementById('ik-agents-title').textContent }; });
    check('3.1 heading frames the assistant as part of the workspace', ag.h2 === 'An assistant inside your workspace.', ag.h2);
    check('3.2 at 1440×900 the name, strengths and "View full profile" are on screen without scrolling further', ag.nameVis && ag.skillsVis && ag.moreVis, ag);
    await page.click('.ik-agent:not([hidden]) [data-ik-profile]'); await page.waitForTimeout(400);
    const pr = await page.evaluate(() => { const d = document.getElementById('ikProfile'); return { open: d.classList.contains('is-open'), modal: d.getAttribute('aria-modal'), title: (document.getElementById('ikProfileTitle') || {}).textContent, story: /imagined backstory/i.test(d.textContent), chat: !!d.querySelector('.ik-chat'), focusIn: d.contains(document.activeElement), cta: (d.querySelector('.ik-profile__cta a') || {}).getAttribute && d.querySelector('.ik-profile__cta a').getAttribute('href'), dupIds: [...d.querySelectorAll('[id]')].map((x) => x.id).filter((id) => id !== 'ikProfile' && id !== 'ikProfileTitle' && document.querySelectorAll('#' + id).length > 1) }; });
    check('3.3 "View full profile" opens a dialog with the backstory, strengths and the illustrative conversation; focus moves into it', pr.open && pr.modal === 'true' && pr.title === ag.name && pr.story && pr.chat && pr.focusIn && pr.cta === '/signup' && !pr.dupIds.length, pr);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const cl = await page.evaluate(() => ({ open: document.getElementById('ikProfile').classList.contains('is-open'), focus: document.activeElement && document.activeElement.hasAttribute('data-ik-profile') }));
    check('3.4 Esc closes it and focus returns to the button', !cl.open && cl.focus, cl);

    console.log('\n4. Final call to action');
    const fin = await page.evaluate(() => { const s = document.getElementById('start'); return { h2: s.querySelector('h2').textContent, team: !!s.querySelector('.ik-team, [data-agent]'), h: Math.round(s.getBoundingClientRect().height), links: [...s.querySelectorAll('a')].map((a) => a.getAttribute('href')) }; });
    check('4.1 "Start your ad workspace."; the list of six agents is gone; Get started and Log in stay', fin.h2 === 'Start your ad workspace.' && !fin.team && fin.links.join() === '/signup,/login', fin);
    check('4.2 the section is shorter (under 640px at 1440 wide)', fin.h < 640, fin.h);

    console.log('\n5. Accuracy and layout');
    const html = ['index.html', 'home.html', 'product.html', 'business.html', 'create.html', 'research.html', 'campaigns.html', 'faq.html', 'solutions/connected-workflow.html', 'solutions/plan-to-content.html', 'solutions/advertising-campaigns.html'].map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
    const dev = html.filter(([, s]) => /In development|Not in the app yet|still in development|is in development/.test(s)).map(([f]) => f);
    check('5.1 no page claims that Progress, My Content, Insights or Campaign Builder are "in development" (they are in the app)', dev.length === 0, dev);
    for (const [w, h, want] of [[1024, 768, 4], [800, 1000, 2], [390, 844, 1]]) {
      const p2 = await open(w, h);
      const m = await p2.evaluate(() => ({ ov: document.documentElement.scrollWidth - innerWidth, inner: (() => { const v = document.getElementById('view-landing'); return v.scrollWidth - v.clientWidth; })(), cols: getComputedStyle(document.querySelector('.ik-ws__flow')).gridTemplateColumns.split(' ').length, minW: Math.min(...[...document.querySelectorAll('.ik-ws__block')].map((b) => b.getBoundingClientRect().width)) }));
      check(`5.${w} ${w}px: no horizontal overflow; the seven blocks reflow to ${want} column${want === 1 ? '' : 's'} (never narrower than 160 px)`, m.ov <= 0 && m.inner <= 0 && m.cols === want && m.minW >= 160, m);
      await p2.close();
    }
    check('Z. no page errors', errors.length === 0, errors);
  } catch (e) { console.error(e); fail++; }
  finally { await browser.close(); srv.close(); console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
});
