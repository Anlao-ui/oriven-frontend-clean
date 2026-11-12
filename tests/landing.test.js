/* ════════════════════════════════════════════════════════════════
   Landing page (Ink & Signal): home.html / #view-landing, css/landing.css,
   js/landing.js.
   Checks: section order (no pricing section, FAQ present), one H1, CTA
   routes (/signup, /login), the agent selector (buttons, ring tabs,
   keyboard, swipe, figures, "works with" links, live region), the workflow
   loop and its rail, product films, FAQ disclosure, dot field (draws,
   animates only on screen, still under reduced motion, no static copy
   under a live canvas, only in hero / problem band / final CTA), the six
   particle creatures (drawn when in focus, pointer push and return,
   still under reduced motion), reveals that replay on re-entry, consent (no Google tag before
   Accept, one tag after, no conversion events), no-JavaScript rendering,
   mobile layout (no horizontal overflow, CTA above the fold), contrast,
   and the pricing page still rendering its plans.
   Own Netlify-like server (applies _redirects, like tests/seo-site.test.js)
   + tests/_fence.js: nothing leaves the browser except static CDN GETs.
   RUN: node tests/landing.test.js
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = 8894, BASE = 'http://127.0.0.1:' + PORT;
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 400) : '')); } }

const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.xml': 'application/xml', '.woff2': 'font/woff2' };
const served = [];
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); served.push(p);
  const r = rules.find((x) => x[0] === p && /^200/.test(x[2])); if (r) p = r[1];
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (_) { if (fs.existsSync(f + '.html')) f += '.html'; }
  fs.readFile(f, (e, b) => { s.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(e ? 'not found' : b); });
});

const lum = (rgb) => { const [r, g, b] = rgb.map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);

async function main() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  require('./_fence').fenceBrowser(browser, BASE);
  const REJECT = { v: 1, ads: false, stats: false, at: '2026-10-28T00:00:00.000Z' };

  async function open(opts = {}) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts.ctx || {}));
    const page = await ctx.newPage();
    const errors = [], gtag = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://www.googletagmanager.com/gtag/js**', (r) => { gtag.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__gtagStub=1;' }); });
    if (opts.consent !== null) await page.addInitScript((c) => { try { localStorage.setItem('orv_consent_v1', JSON.stringify(c)); } catch (_) {} }, opts.consent || REJECT);
    await page.goto(BASE + (opts.path || '/'), { waitUntil: 'load' });
    await page.waitForTimeout(opts.wait || 1500);
    return { ctx, page, errors, gtag };
  }
  const scrollTo = (page, id, extra = 0) => page.evaluate(([i, x]) => { const v = document.getElementById('view-landing'); v.scrollTop = document.getElementById(i).offsetTop + x; }, [id, extra]);

  // ── A. Structure, routes, content ──
  console.log('── A. Structure ──');
  let { ctx, page, errors, gtag } = await open();
  const st = await page.evaluate(() => {
    const ik = document.getElementById('ik-home');
    return {
      order: [...ik.querySelectorAll('main > section')].map((s) => s.id),
      footer: !!ik.querySelector('footer.site-foot') /* the shared public footer */, header: !!document.getElementById('lpNav'),
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      js: ik.classList.contains('ik-js'),
      pricing: { grid: !!document.getElementById('lpPricingGrid'), sections: [...ik.querySelectorAll('[id*="pricing" i], [class*="pricing" i]')].length, perMonth: /\/\s?mo\b|per month|€\s?\d+\s?\/|\bmonthly price/i.test(ik.innerText.replace(/€400 a month/, '')), link: !!ik.querySelector('a[href="/pricing"]') },
      faq: ik.querySelectorAll('#faq details').length,
      agents: [...ik.querySelectorAll('.ik-agent')].map((a) => a.querySelector('.ik-agent__name').textContent + ':' + a.querySelector('.ik-agent__id').textContent.split('Specialisation: ')[1]),
      signup: [...ik.querySelectorAll('a.ik-btn--primary, .ik-team a')].map((a) => a.getAttribute('href')),
      login: [...ik.querySelectorAll('a')].filter((a) => /log in/i.test(a.textContent)).map((a) => a.getAttribute('href')),
      navAgents: [...document.querySelectorAll('#lpNav a, #lpMobileMenu a')].filter((a) => /#agents/.test(a.getAttribute('href') || '') || /^\s*Agents\s*$/.test(a.textContent)).length,
      navCta: (document.querySelector('#lpNav .lp-cta-btn') || {}).textContent, navLogin: (document.querySelector('#lpNav .lp-nav-login') || {}).textContent,
      navPricing: !!document.querySelector('#lpNav a[href="/pricing"]') && !!document.querySelector('#lpMobileMenu a[href="/pricing"]'), navLogo: !!document.querySelector('#lpNav .lp-logo .lp-logo-ring'),
      cookieLink: !!ik.querySelector('footer [data-cookie-settings]'), consentFirst: document.head.querySelector('script').getAttribute('src'),
      title: document.title, canonical: (document.querySelector('link[rel="canonical"]') || {}).href, desc: (document.querySelector('meta[name="description"]') || {}).content,
      landingCss: !!document.querySelector('#view-landing link[href="/css/landing.css"]'), oldLanding: !!document.getElementById('ov-system') || !!document.getElementById('ov-pillars'),
    };
  });
  check('sections in the approved order (2026-11 tutorials): hero, problem, workspace, assistant (directly under the workspace section), tutorials, how, inside, plan, integrations, trust, FAQ, final CTA (+ header, footer)', JSON.stringify(st.order) === JSON.stringify(['top', 'problem', 'workspace', 'agents', 'tutorials', 'how', 'inside', 'plan', 'integrations', 'trust', 'faq', 'start']) && st.footer && st.header, st.order);
  check('no pricing section on the landing page (no plan grid, no pricing block, no prices); /pricing still linked', !st.pricing.grid && st.pricing.sections === 0 && !st.pricing.perMonth && st.pricing.link, st.pricing);
  check('FAQ present (10 questions)', st.faq === 10, st.faq);
  check('exactly one H1: "Your new ad workspace."', st.h1.length === 1 && st.h1[0].replace(/\s+/g, ' ') === 'Your new ad workspace.', st.h1);
  check('six assistants with their specialisations', st.agents.join('|') === 'Scout:Research & Insights|Vector:Strategy & Direction|Nova:Creative & Content|Momentum:Growth & Execution|Metric:Performance & Optimisation|Flux:Automation & Systems', st.agents);
  check('every Start CTA goes to /signup; Log in goes to /login', st.signup.length >= 3 && st.signup.every((h) => h === '/signup') && st.login.length >= 1 && st.login.every((h) => h === '/login'), st);
  check('header: no Agents link (desktop or mobile); logo, Pricing, Log in and Get started kept (paid-only: no "Start free")', st.navAgents === 0 && st.navLogo && st.navPricing && /Log in/.test(st.navLogin) && /Get started/.test(st.navCta) && !/free/i.test(st.navCta), [st.navAgents, st.navCta, st.navLogin]);

  // Product positioning: one platform, ONE chosen assistant, no team.
  const pos = await page.evaluate(() => {
    const ik = document.getElementById('ik-home'), text = ik.innerText;
    const faqQs = [...ik.querySelectorAll('#faq summary')].map((s) => s.textContent.trim());
    return {
      banned: (text.match(/one team|your team|team is ready|led by|works with (scout|vector|nova|momentum|metric|flux)|work together|working together|collaborat|hand(s|ing)? (it )?(off|over)|share what they learn|six ai marketers/gi) || []),
      selectorH2: document.getElementById('ik-agents-title').textContent.trim(),
      one: /One assistant stays with you everywhere in OrivenAI/.test(text) && /Every assistant can guide you through all of OrivenAI/.test(text),
      faqOne: faqQs.includes('Do I use all six assistants at once?'),
      perAgent: [...ik.querySelectorAll('.ik-agent')].map((a) => ({ tone: !!a.querySelector('.ik-agent__facts dt'), facts: [...a.querySelectorAll('.ik-agent__facts dt')].map((d) => d.textContent).join(','), strong: a.querySelectorAll('.ik-agent__skills li').length, helps: [...a.querySelectorAll('.ik-with a.ik-chip')].map((c) => c.getAttribute('href')), chatLabel: /Illustrative example/.test(a.querySelector('.ik-chat').textContent), turns: a.querySelectorAll('.ik-chat__msg').length, character: /^An imagined backstory:/.test(a.querySelectorAll('.ik-agent__facts dd')[1].textContent) })),
      stepsAgent: document.querySelectorAll('.ik-step[data-agent], .ik-loop__tag[style*="--sc"], .ik-ring--loop .ik-seg[style*="--sc"]').length,
      heroRingAgent: document.querySelectorAll('.ik-hero .ik-seg[style*="--sc"], .ik-hero__agents').length,
      founder: !!ik.querySelector('.ik-founder, #trust img, #trust aside'),
      capsText: [...ik.querySelectorAll('.ik-shot__cap')].map((c) => c.textContent.trim()),
      chatLine: /Oriven Chat, on the Creator plan/.test(text),
    };
  });
  check('no team / collaboration / section-ownership wording anywhere on the page', pos.banned.length === 0, pos.banned);
  check('assistant heading: "An assistant inside your workspace." (the assistant supports the workspace; it is not the product)', pos.selectorH2 === 'An assistant inside your workspace.', pos.selectorH2);
  check('the page says one assistant stays with you everywhere and can guide you through all of OrivenAI', pos.one && pos.faqOne);
  check('each assistant: tone + character (an illustrative "An imagined backstory:…"), 3 strengths, section links it also helps with, a labelled illustrative multi-turn example', pos.perAgent.length === 6 && pos.perAgent.every((p) => p.facts === 'Tone,Character' && p.character && p.strong === 3 && p.helps.length === 3 && p.helps.every((h) => /^\/(business|research|create|launch|campaigns|autopilot)$/.test(h)) && p.chatLabel && p.turns === 4), pos.perAgent);
  check('workflow and hero ring carry no per-assistant colours (Volt only)', pos.stepsAgent === 0 && pos.heroRingAgent === 0, pos);
  check('trust section: founder card removed', !pos.founder);
  check('product films: each caption is only an "Explore …" link; the Oriven Chat line is gone', pos.capsText.length === 6 && pos.capsText.every((c) => /^Explore (Control Center|Research|Create|Launch|Campaigns|Automations)$/.test(c)) && !pos.chatLine, pos.capsText);
  check('consent.js is still the first script in <head>; footer keeps Cookie settings', st.consentFirst === '/js/consent.js' && st.cookieLink, st.consentFirst);
  check('SEO head kept: title, canonical /, description', /OrivenAI/.test(st.title) && st.canonical === 'https://orivenai.com/' && st.desc.length > 60, [st.title, st.canonical]);
  check('new landing styles loaded; previous landing sections gone', st.landingCss && !st.oldLanding);
  check('no JavaScript errors on the homepage', errors.length === 0, errors);
  check('Google tag not loaded with advertising rejected', gtag.length === 0, gtag);

  // ── B. Agent selector ──
  console.log('── B. Agent selector ──');
  await scrollTo(page, 'agents', 300); await page.waitForTimeout(400);
  const selState = () => page.evaluate(() => {
    const sel = document.querySelector('[data-ik-sel]');
    return {
      tab: [...sel.querySelectorAll('.ik-pager [role="tab"]')].findIndex((t) => t.getAttribute('aria-selected') === 'true'),
      tabindex: [...sel.querySelectorAll('.ik-pager [role="tab"]')].map((t) => t.tabIndex).join(''),
      shown: [...sel.querySelectorAll('.ik-agent')].filter((p) => !p.hidden).map((p) => p.dataset.agent),
      fig: [...sel.querySelectorAll('.ik-fig')].findIndex((f) => f.classList.contains('is-active')),
      start: sel.querySelector('[data-ik-start]').textContent.trim(), count: sel.querySelector('[data-ik-count]').textContent,
      live: sel.querySelector('[data-ik-live]').textContent, seg: [...sel.querySelectorAll('.ik-pager .ik-seg')].findIndex((s) => s.classList.contains('is-active')),
      focus: document.activeElement && document.activeElement.id,
    };
  });
  let s = await selState();
  check('initial agent is Scout: tab, panel, figure, ring segment, count, CTA', s.tab === 0 && s.shown.join() === 'scout' && s.fig === 0 && s.seg === 0 && s.count === '1 / 6' && /Start with Scout/.test(s.start) && s.tabindex === '0-1-1-1-1-1', s);
  check('panels are tabpanels labelled by their ring tabs', await page.evaluate(() => [...document.querySelectorAll('.ik-agent')].every((p) => p.getAttribute('role') === 'tabpanel' && document.getElementById(p.getAttribute('aria-labelledby')).getAttribute('aria-controls') === p.id)));
  await page.click('[data-ik-next]'); s = await selState();
  check('Next → Vector (panel, CTA, live announcement)', s.shown.join() === 'vector' && /Start with Vector/.test(s.start) && /Vector, Strategy & Direction\. 2 of 6/.test(s.live), s);
  await page.click('[data-ik-prev]'); await page.click('[data-ik-prev]'); s = await selState();
  check('Previous wraps around: Scout → Flux', s.shown.join() === 'flux' && s.count === '6 / 6', s);
  await page.focus('#ik-tab-flux'); await page.keyboard.press('ArrowRight'); s = await selState();
  check('keyboard: ArrowRight on the ring tabs selects and focuses Scout', s.shown.join() === 'scout' && s.focus === 'ik-tab-scout', s);
  await page.keyboard.press('End'); s = await selState();
  check('keyboard: End → Flux, Home → Scout', s.shown.join() === 'flux' && s.focus === 'ik-tab-flux' && (await page.keyboard.press('Home'), (await selState()).shown.join() === 'scout'));
  await page.click('#ik-tab-nova'); s = await selState();
  check('clicking a ring segment selects that agent (Nova)', s.shown.join() === 'nova' && s.seg === 2, s);
  await page.locator('.ik-fig[data-agent="momentum"]').click({ force: true }); s = await selState();
  check('clicking a neighbouring figure selects it (Momentum)', s.shown.join() === 'momentum', s);
  const box = await page.locator('.ik-stage').boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 4 }); await page.mouse.up(); s = await selState();
  check('swipe left on the stage → next agent (Metric)', s.shown.join() === 'metric', s);
  await page.click('.site-foot a[data-ik-goto="flux"]'); await page.waitForTimeout(1800); s = await selState();
  check('footer assistant link selects that assistant (Flux) and scrolls to the selector', s.shown.join() === 'flux' && await page.evaluate(() => Math.abs(document.getElementById('agents').getBoundingClientRect().top - document.getElementById('view-landing').getBoundingClientRect().top) < 4), s);
  check('"Also helps you with" chips link to real product pages', await page.evaluate(() => [...document.querySelectorAll('#agent-flux .ik-with a')].map((a) => a.getAttribute('href')).join()) === '/business,/launch,/campaigns');
  await page.waitForTimeout(900); // let the 700 ms colour transition finish
  check('the focused creature is at full strength in its own colour; neighbours are dimmed', await page.evaluate(() => { const f = [...document.querySelectorAll('.ik-fig')]; const a = f.find((x) => x.classList.contains('is-active')); return getComputedStyle(a).color === 'rgb(143, 92, 255)' && getComputedStyle(a.querySelector('.ik-creature')).opacity === '1' && f.filter((x) => x !== a).every((x) => getComputedStyle(x.querySelector('.ik-creature')).opacity === '0.6'); }));
  check('Start with [agent] still goes to the existing /signup route', await page.getAttribute('[data-ik-start]', 'href') === '/signup');

  // ── B2. Particle creatures, dot pattern, reveals ──
  console.log('── B2. Creatures, dot pattern, reveals ──');
  await page.evaluate(() => { const v = document.getElementById('view-landing'); v.scrollTop += document.querySelector('.ik-stage').getBoundingClientRect().top - 120; });
  await page.waitForTimeout(1600);
  const crt = await page.evaluate(() => {
    const all = document.getElementById('ik-home')._ikFields.filter((f) => f.kind);
    const sym = (k) => document.getElementById('ik-g-' + k);
    return {
      kinds: all.map((f) => f.kind).join(), counts: all.map((f) => f.P ? f.P.n : 0),
      active: all.filter((f) => f.slot === [...document.querySelectorAll('.ik-fig')].findIndex((x) => x.classList.contains('is-active'))).map((f) => f.visible && f.c.classList.contains('is-on'))[0],
      hiddenIdle: all.filter((f) => getComputedStyle(f.c.closest('.ik-fig')).opacity === '0').every((f) => !f.visible),
      glyphs: ['scout', 'vector', 'nova', 'momentum', 'metric', 'flux'].map((k) => sym(k).querySelectorAll('circle').length),
      glyphShapes: new Set(['scout', 'vector', 'nova', 'momentum', 'metric', 'flux'].map((k) => sym(k).innerHTML)).size,
      fields: [...document.querySelectorAll('.ik-field')].map((c) => c.dataset.field).join(),
      selectorDots: document.querySelectorAll('#agents .ik-field').length + (getComputedStyle(document.getElementById('agents'), '::before').backgroundImage !== 'none' ? 1 : 0),
      heroFallback: getComputedStyle(document.querySelector('.ik-hero'), '::before').opacity, heroLive: document.querySelector('.ik-hero').classList.contains('ik-live'),
    };
  });
  check('six particle creatures, one per assistant, each built from hundreds of particles', crt.kinds === 'scout,vector,nova,momentum,metric,flux' && crt.counts.every((n) => n >= 200), crt);
  check('the creature in focus is drawn; a figure turned away (opacity 0) is not drawn', crt.active === true && crt.hiddenIdle, crt);
  check('six distinct dot glyphs for labels and chips (same silhouettes, a few dots each)', crt.glyphs.every((n) => n >= 8 && n <= 40) && crt.glyphShapes === 6, crt.glyphs);
  check('dot pattern: canvases only in the hero, the problem band and the final CTA; none in the selector', crt.fields === 'hero,problem,final' && crt.selectorDots === 0, crt);
  check('no double dots: once the hero canvas is live its static lattice is gone', crt.heroLive && crt.heroFallback === '0', crt);
  const cbox = await page.locator('.ik-fig.is-active .ik-creature').boundingBox();
  const offs = () => page.evaluate(() => document.getElementById('ik-home')._ikFields.filter((f) => f.kind && f.visible && !f.lite).map((f) => Math.max(...Array.from(f.ox, Math.abs), ...Array.from(f.oy, Math.abs)))[0]);
  await page.mouse.move(cbox.x + 10, cbox.y + cbox.height / 2); await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2, { steps: 6 }); await page.waitForTimeout(700);
  const pin = await offs();
  await page.mouse.move(20, 880, { steps: 3 }); await page.waitForTimeout(1800);
  const pout = await offs();
  check('creature: particles move away from the pointer (more than 1% of the creature’s width) and return to their shape after it leaves', pin > Math.max(2.5, cbox.width * 0.01) && pout < 0.5, { pin, pout, w: cbox.width });
  const ruleState = () => page.evaluate(() => document.querySelector('.ik-rule').classList.contains('is-in'));
  const toRules = () => page.evaluate(() => { const v = document.getElementById('view-landing'); v.scrollTop += document.querySelector('.ik-rules').getBoundingClientRect().top - 200; });
  await toRules(); await page.waitForTimeout(1000); const rv1 = await ruleState();
  await page.evaluate(() => { document.getElementById('view-landing').scrollTop = 0; }); await page.waitForTimeout(700); const rv2 = await ruleState();
  await toRules(); await page.waitForTimeout(1000); const rv3 = await ruleState();
  check('scroll reveals play again when an element re-enters view', rv1 && !rv2 && rv3, [rv1, rv2, rv3]);

  // ── C. Workflow loop, films, FAQ ──
  console.log('── C. Loop, films, FAQ ──');
  await page.evaluate(() => { const v = document.getElementById('view-landing'); const st = document.querySelectorAll('.ik-step')[3]; v.scrollTop = st.getBoundingClientRect().top + v.scrollTop - v.getBoundingClientRect().top - v.clientHeight * 0.4; });
  await page.waitForTimeout(1100);
  const loop = await page.evaluate(() => { const segs = [...document.querySelectorAll('.ik-ring--loop .ik-seg')]; const act = segs.find((x) => x.classList.contains('is-active')); return { step: [...document.querySelectorAll('.ik-step')].findIndex((x) => x.classList.contains('is-active')), seg: segs.indexOf(act), done: segs.filter((x) => x.classList.contains('is-done')).length, tag: (document.querySelector('.ik-loop__tag.is-active') || {}).textContent, fill: act && getComputedStyle(act).fill, count: document.querySelector('[data-ik-loop-count]').textContent }; });
  check('scrolling the loop activates step 4 (Launch): its segment in Volt, earlier steps marked done, counter 04 / 06', loop.step === 3 && loop.seg === 3 && loop.done === 3 && loop.tag === 'Launch' && loop.fill === 'rgb(234, 253, 19)' && loop.count === '04 / 06', loop);
  const rail = await page.evaluate(() => +getComputedStyle(document.querySelector('.ik-steps')).getPropertyValue('--prog'));
  check('the dotted rail between the steps has filled about halfway at step 4', rail > 0.4 && rail < 0.75, rail);
  await scrollTo(page, 'how', -200); await page.waitForTimeout(300);
  check('the loop starts calm: no step active before the first step reaches the reading line', await page.evaluate(() => !document.querySelector('.ik-step.is-active') && !document.querySelector('[data-ik-loop]').classList.contains('has-active')));
  await scrollTo(page, 'inside'); await page.waitForTimeout(300);
  await page.click('#ik-shot-tab-campaigns');
  const shot = await page.evaluate(() => ({ active: (document.querySelector('.ik-shot.is-active') || {}).id, cap: (document.querySelector('.ik-shot__cap.is-active') || {}).dataset, name: document.querySelector('[data-ik-shot-name]').textContent, sel: document.querySelector('#ik-shot-tab-campaigns').getAttribute('aria-selected') }));
  check('product tabs switch the film, caption and frame label (Campaigns)', shot.active === 'shot-campaigns' && shot.cap.cap === 'campaigns' && shot.name === 'Campaigns' && shot.sel === 'true', shot);
  await page.click('#shot-campaigns [data-ik-play]'); await page.waitForTimeout(800);
  const vid = await page.evaluate(() => { const v = document.querySelector('#shot-campaigns video'); return v && { src: v.getAttribute('src'), controls: v.controls, muted: v.muted }; });
  check('Play loads the real film on demand (local asset, controls, muted)', vid && vid.src === '/assets/films/sections/campaigns.mp4' && vid.controls && vid.muted && served.includes('/assets/films/sections/campaigns.mp4'), vid);
  const films = await page.evaluate(() => [...document.querySelectorAll('.ik-shot')].map((s) => { const img = s.querySelector('img'); const r = s.querySelector('.ik-shot__media').getBoundingClientRect(); return s.id + '=' + s.dataset.film + '|' + img.getAttribute('src') + '|' + (r.height ? (r.width / r.height).toFixed(2) : 'hidden'); }));
  const FILM = { business: 'control-center', research: 'research', create: 'create', launch: 'launch', campaigns: 'campaigns', autopilot: 'automations' }; // the 2026-11 section films (assets/films/sections)
  check('each section shows its own real film and poster (tracked assets), 16:9', films.length === 6 && films.every((f) => { const [k, film, poster, ar] = f.replace('shot-', '').split(/[=|]/); return film === '/assets/films/sections/' + FILM[k] + '.mp4' && poster === '/assets/films/sections/' + FILM[k] + '-800.webp' && (ar === 'hidden' || ar === '1.78') && fs.existsSync(path.join(ROOT, film)) && fs.existsSync(path.join(ROOT, poster)); }), films);
  check('no film was downloaded before Play was pressed', served.filter((p) => /\.mp4$/.test(p)).length === 1, served.filter((p) => /\.mp4$/.test(p)));
  await scrollTo(page, 'faq'); await page.waitForTimeout(200);
  await page.locator('#faq summary', { hasText: 'Which advertising platforms are supported?' }).click();
  const qa = await page.evaluate(() => { const d = [...document.querySelectorAll('#faq details')].find((x) => /Which advertising platforms/.test(x.querySelector('summary').textContent)); return { open: d.open, text: d.textContent }; });
  check('FAQ opens on click and answers with the supported platforms', qa.open && /Google Ads, Meta Ads \(Facebook and Instagram\), TikTok Ads and Pinterest Ads/.test(qa.text), qa);
  await page.focus('#faq details:nth-of-type(1) summary'); await page.keyboard.press('Enter');
  check('FAQ is keyboard-operable', await page.evaluate(() => document.querySelectorAll('#faq details')[0].open));

  // ── D. Header link, dot field ──
  console.log('── D. Header + dot field ──');
  await page.evaluate(() => { document.getElementById('view-landing').scrollTop = 0; }); await page.waitForTimeout(300);
  await page.click('.ik-hero a[href="#workspace"]'); await page.waitForTimeout(1800);
  const nav = await page.evaluate(() => ({ url: location.pathname, top: Math.round(document.getElementById('workspace').getBoundingClientRect().top - document.getElementById('view-landing').getBoundingClientRect().top) }));
  check('hero "See the workspace" scrolls to the workspace section without leaving the page', nav.url === '/' && Math.abs(nav.top) < 4, nav);
  // Pointer displacement, measured on the problem band (no waves, so it is deterministic once
  // the dots have settled into the grid): the lattice dot under the pointer moves away, then returns.
  await page.evaluate(() => { const v = document.getElementById('view-landing'), b = document.querySelector('.ik-band').getBoundingClientRect(); v.scrollTop += b.top + b.height / 2 - innerHeight * 0.4; });
  await page.waitForTimeout(900);
  const P = await page.evaluate(() => { const c = document.querySelector('canvas[data-field="problem"]'); const r = c.getBoundingClientRect(); return { x: Math.round(r.left + 12 + 24 * 16), y: Math.round(r.top + 12 + 24 * 2) }; });
  const inkAt = () => page.evaluate(({ x, y }) => { const c = document.querySelector('canvas[data-field="problem"]'); const r = c.getBoundingClientRect(); const k = c.width / r.width; const R = 12; const d = c.getContext('2d').getImageData(Math.round((x - r.left - R) * k), Math.round((y - r.top - R) * k), Math.round(2 * R * k), Math.round(2 * R * k)).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s; }, P);
  await page.mouse.move(40, 880); await page.waitForTimeout(400);
  const before = await inkAt();
  await page.mouse.move(P.x - 60, P.y, { steps: 3 }); await page.mouse.move(P.x, P.y, { steps: 4 }); await page.waitForTimeout(900);
  const during = await inkAt();
  await page.mouse.move(40, 880, { steps: 3 }); await page.waitForTimeout(1600);
  const after = await inkAt();
  check('pointer: the dot under the pointer moves away, then eases back after the pointer leaves', before > 0 && during === 0 && Math.abs(after - before) <= before * 0.15, { before, during, after, P });
  const handles = await page.evaluate(() => [...document.querySelectorAll('.ik-field')].every((c) => getComputedStyle(c).pointerEvents === 'none'));
  check('dot canvases never intercept clicks (pointer-events: none)', handles);
  await page.evaluate(() => { document.getElementById('view-landing').scrollTop = 0; }); await page.waitForTimeout(600);
  const snap = () => page.evaluate(() => document.querySelector('canvas[data-field="hero"]').toDataURL().length + ':' + document.querySelector('canvas[data-field="hero"]').toDataURL().slice(-60));
  const f1 = await snap(); await page.waitForTimeout(400); const f2 = await snap();
  check('hero dot field is drawn and animates while on screen', await page.evaluate(() => [...document.querySelectorAll('.ik-field')].every((c) => c.classList.contains('is-on'))) && f1 !== f2);
  await scrollTo(page, 'trust'); await page.waitForTimeout(700); const g1 = await snap(); await page.waitForTimeout(500); const g2 = await snap();
  check('hero dot field stops drawing when scrolled off screen', g1 === g2);
  const dots = await page.evaluate(() => { const c = document.querySelector('canvas[data-field="hero"]'); return { w: c.width, h: c.height, dpr: devicePixelRatio, cssW: c.clientWidth }; });
  check('canvas backing store capped at DPR 2', dots.w <= Math.ceil(dots.cssW * 2), dots);
  await ctx.close();

  // ── E. Consent + conversion tracking on the landing page ──
  console.log('── E. Consent ──');
  ({ ctx, page, errors, gtag } = await open({ consent: null }));
  const c0 = await page.evaluate(() => ({ banner: !!document.querySelector('.orv-cc'), gtagScripts: document.querySelectorAll('script[src*="googletagmanager"]').length, def: (window.dataLayer || []).find((a) => a[0] === 'consent' && a[1] === 'default') }));
  check('first visit: consent banner shown, Google tag not loaded, Consent Mode defaults denied', c0.banner && c0.gtagScripts === 0 && gtag.length === 0 && c0.def && c0.def[2].ad_storage === 'denied', c0);
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(500);
  const c1 = await page.evaluate(() => ({ gtagScripts: document.querySelectorAll('script[src*="googletagmanager"]').length, cfg: (window.dataLayer || []).filter((a) => a[0] === 'config').map((a) => a[1]), conv: (window.dataLayer || []).filter((a) => a[0] === 'event').map((a) => a[1]) }));
  check('Accept: one Google tag (AW-18538836764), no conversion or other events from the landing page', c1.gtagScripts === 1 && gtag.length === 1 && /id=AW-18538836764$/.test(gtag[0]) && c1.cfg.join() === 'AW-18538836764' && c1.conv.length === 0, c1);
  await page.click('.ik-hero a.ik-btn--primary'); await page.waitForURL(/\/signup$/, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800);
  check('hero Start free opens the existing signup page (form visible)', /\/signup$/.test(page.url()) && await page.evaluate(() => { const v = document.getElementById('view-signup'); return !!v && getComputedStyle(v).display !== 'none' && !!document.getElementById('auEmailSignup'); }), page.url());
  check('signup page: no conversion fired just by arriving', await page.evaluate(() => !(window.dataLayer || []).some((a) => a[0] === 'event' && a[1] === 'conversion')));
  await ctx.close();

  // ── F. Reduced motion, no JavaScript, mobile, contrast ──
  console.log('── F. Reduced motion / no JS / mobile / contrast ──');
  ({ ctx, page, errors } = await open({ ctx: { reducedMotion: 'reduce' } }));
  const r1 = await page.evaluate(() => document.querySelector('canvas[data-field="hero"]').toDataURL()); await page.waitForTimeout(600);
  const rm = await page.evaluate(() => ({ drawn: document.querySelector('canvas[data-field="hero"]').classList.contains('is-on'), anims: [...document.querySelectorAll('.ik-hero .ik-seg')].reduce((n, s) => n + s.getAnimations().length, 0) }));
  check('reduced motion: field drawn once and still, no ring intro animation', rm.drawn && rm.anims === 0 && r1 === await page.evaluate(() => document.querySelector('canvas[data-field="hero"]').toDataURL()), rm);
  await page.mouse.move(600, 700); await page.mouse.move(660, 820, { steps: 4 }); await page.waitForTimeout(500);
  check('reduced motion: no entrance motion, content visible, pointer does not move the dots', await page.evaluate(() => !document.getElementById('ik-home').classList.contains('ik-motion') && [...document.querySelectorAll('[data-reveal]')].every((e) => getComputedStyle(e).opacity === '1')) && r1 === await page.evaluate(() => document.querySelector('canvas[data-field="hero"]').toDataURL()));
  await page.click('[data-ik-next]');
  check('reduced motion: selector still works', await page.evaluate(() => !document.getElementById('agent-vector').hidden));
  await page.evaluate(() => { const v = document.getElementById('view-landing'); v.scrollTop += document.querySelector('.ik-stage').getBoundingClientRect().top - 120; }); await page.waitForTimeout(700);
  const crSnap = () => page.evaluate(() => document.querySelector('.ik-fig.is-active .ik-creature__c').toDataURL());
  const rc1 = await crSnap(); await page.waitForTimeout(500);
  check('reduced motion: the creature in focus is drawn once, complete and still', await page.evaluate(() => document.querySelector('.ik-fig.is-active .ik-creature__c').classList.contains('is-on')) && rc1.length > 2000 && rc1 === await crSnap());
  await ctx.close();

  // If js/landing.js never arrives, the page must not stay hidden behind its entrance motion.
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); page = await ctx.newPage();
  await page.route('**/js/landing.js', (r) => r.abort());
  await page.goto(BASE + '/', { waitUntil: 'load' }); await page.waitForTimeout(4600);
  check('landing.js blocked: motion switches itself off, every revealed block is visible', await page.evaluate(() => !document.getElementById('ik-home').classList.contains('ik-motion') && [...document.querySelectorAll('[data-reveal]')].every((e) => getComputedStyle(e).opacity === '1')));
  await ctx.close();

  ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } }); page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const nj = await page.evaluate(() => { const v = document.getElementById('view-landing'); const h = document.querySelector('h1'); return { visible: getComputedStyle(v).display !== 'none' && h.getBoundingClientRect().height > 0, agents: [...document.querySelectorAll('.ik-agent')].filter((a) => a.getBoundingClientRect().height > 0).length, faq: document.querySelectorAll('#faq details').length, cta: (document.querySelector('.ik-hero a.ik-btn--primary') || {}).getAttribute && document.querySelector('.ik-hero a.ik-btn--primary').getAttribute('href') }; });
  check('no JavaScript: homepage content visible, all six agents readable, FAQ present, CTA is a real link', nj.visible && nj.agents === 6 && nj.faq === 10 && nj.cta === '/signup', nj);
  await ctx.close();

  ({ ctx, page, errors } = await open({ ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }));
  const mob = await page.evaluate(() => { const v = document.getElementById('view-landing'); const cta = document.querySelector('.ik-hero a.ik-btn--primary').getBoundingClientRect(); return { overflow: v.scrollWidth - v.clientWidth, ctaBottom: Math.round(cta.bottom), vh: innerHeight, minTap: Math.min(...[...document.querySelectorAll('.ik-arrow, .ik-pager [role="tab"], .ik-btn')].map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)).filter((n) => n > 0)) }; });
  check('mobile 390px: no horizontal overflow, Start free above the fold, tap targets ≥ 40px', mob.overflow <= 0 && mob.ctaBottom < mob.vh && mob.minTap >= 40, mob);
  check('mobile: no JavaScript errors', errors.length === 0, errors);
  await ctx.close();

  ({ ctx, page } = await open());
  const pairs = await page.evaluate(() => {
    const css = (el, p) => getComputedStyle(el)[p];
    const bg = css(document.querySelector('.ik'), 'backgroundColor');
    const pick = (sel) => document.querySelector(sel);
    return {
      bg, h1: css(pick('.ik-h1'), 'color'), lead: css(pick('.ik-hero__sub'), 'color'), note: css(pick('.ik-note'), 'color'), meta: css(pick('.ik-problem__answer'), 'color'),
      btnFg: css(pick('.ik-hero a.ik-btn--primary'), 'color'), btnBg: css(pick('.ik-hero a.ik-btn--primary'), 'backgroundColor'),
      ghostBorder: css(pick('.ik-hero a.ik-btn--ghost'), 'borderTopColor'), flux: getComputedStyle(pick('.ik')).getPropertyValue('--flux'),
    };
  });
  const B = rgb(pairs.bg);
  const cr = { h1: contrast(rgb(pairs.h1), B), lead: contrast(rgb(pairs.lead), B), note: contrast(rgb(pairs.note), B), meta: contrast(rgb(pairs.meta), B), button: contrast(rgb(pairs.btnFg), rgb(pairs.btnBg)), ghostBorder: contrast(rgb(pairs.ghostBorder), B) };
  check('contrast: headline, body and notes ≥ 4.5:1; primary button text ≥ 4.5:1; control border ≥ 3:1', cr.h1 >= 7 && cr.lead >= 4.5 && cr.note >= 4.5 && cr.meta >= 4.5 && cr.button >= 4.5 && cr.ghostBorder >= 3, Object.fromEntries(Object.entries(cr).map(([k, v]) => [k, +v.toFixed(2)])));
  check('primary button uses Volt #EAFD13 (the logo colour)', pairs.btnBg === 'rgb(234, 253, 19)', pairs.btnBg);
  await page.goto(BASE + '/pricing', { waitUntil: 'load' }); await page.waitForTimeout(900);
  check('pricing page unchanged: still renders its plan cards', (await page.evaluate(() => document.querySelectorAll('#lpPricingGrid > *').length)) >= 4);
  await ctx.close();

  await browser.close(); server.close();
  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
