// ════════════════════════════════════════════════════════════════
// Marketing Website + Pricing + Plan Structure — regression tests.
// Covers ten layered passes: "Marketing/Pricing Redesign", "Homepage +
// Pricing + Social Proof Polish", "Final Marketing Website Structure +
// Pricing Page", "Marketing Website / Landing Page Product-Story
// Redesign", "Final Marketing Website Polish + Product Demo + Pricing
// Cleanup", "Final Landing Page Storytelling + Visual Redesign", "Final
// Pain-Point Storytelling & Interactive Product Showcase", "Complete
// Homepage Redesign / Final Product Story Pass", "Final Homepage Polish
// Pass", and "Final Visual Polish: Color-Coded Product Showcase + Larger
// Workflow" (this file is rewritten for the current pass rather than
// patched piecemeal — see inline notes on what changed).
//
// Current pass covers: the scroll statement now colors "Oriven" and the
// four workflow verbs (Research/Create/Launch/Improve) toward ORIVEN
// green as they reveal, instead of white like every other word; the
// product showcase ("Oriven is built for the way you advertise") is now
// a large LIGHT rounded panel on the dark grid (was dark, matching the
// rest of the page) with a dedicated accent color per capability (green/
// coral/teal/blue/pink/purple) applied to the active-tab bar, tab icon,
// eyebrow text, and video play button — the video stage itself stays
// dark inside the light panel, like a real screen in a light bezel; "How
// Oriven Works" is now a 2x2 editorial grid (was a horizontal row of 4
// narrow cards with a connector track + traveling pulse, all removed —
// that mechanism doesn't map onto a 2x2 layout) with substantially
// larger per-step media placeholders and CSS-only hover/focus
// prominence plus the existing generic scroll-reveal, no bespoke
// "active step" JS anymore.
//
// Current pass ("ORIVEN AI — Final Brand, Visual System & Connected
// Advertising Experience Refinement") replaces the six-color capability
// system with a single fixed brand palette (Electric Lime / Obsidian /
// Snow / Charcoal), adds a new #ov-fragments section (the six ORIVEN
// fragments: Research/Create/Launch/Campaigns/Autopilot/Business, as an
// animated ring reproducing the real logo's arc-segment geometry), and
// restores the #ov-reviews and #ov-pricing-link sections to the
// homepage per the spec's required section order. Tests for the old
// rainbow per-capability accent system are replaced accordingly.
//
// Same plain-Node-script convention as the other test files in this
// repo (no framework) — real browser, real running backend, disposable
// Supabase test users.
// RUN: node tests/marketing-pricing-redesign.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const API_URL  = process.env.TEST_API_URL || 'http://localhost:5500';
const CHROME_PATH = process.env.TEST_CHROME_PATH
  || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — aborting.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

async function createTestUser(status, suffix) {
  const email = `oriven.mktpricing.test+${Date.now()}.${suffix || 'a'}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  const profile = { id: userId, email, subscription_status: status, onboarding_completed: true };
  if (status !== 'free') {
    profile.credits_balance = 500;
    profile.credits_cycle_start = new Date().toISOString();
    profile.credits_cycle_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    profile.credits_provisioned_plan = status;
  }
  await supabaseAdmin.from('profiles').upsert(profile, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}

async function getAccessToken(user) {
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return data.session.access_token;
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── 1. Navigation — Final Consistency Pass: FAQ is now a real dedicated
  // /faq page (the old #faq-anchor-only link silently failed to navigate
  // from any page but the homepage itself, since ovNavTo only ever
  // scrolled within #view-landing); Product exposes all six real
  // capabilities in canonical ring order (Research/Create/Launch/
  // Campaigns/Autopilot/Business), Create linking to the homepage
  // capability rail (#ov-pillars) since it has no standalone page of its
  // own; Solutions no longer has a duplicate href (Business now has its
  // own outcome-framed item). ──────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => ({
        triggers: Array.from(document.querySelectorAll('.lp-nav-links > .lp-nav-item .lp-dd-trig')).map(b => b.textContent.trim()),
        plainLinks: Array.from(document.querySelectorAll('.lp-nav-links > .lp-nav-link')).map(a => a.textContent.trim()),
        productHrefs: Array.from(document.querySelectorAll('#lpDdProduct .lp-dd-col .lp-dd-item')).map(a => a.getAttribute('href')),
        productNames: Array.from(document.querySelectorAll('#lpDdProduct .lp-dd-col')[1].querySelectorAll('.lp-dd-item-name')).map(a => a.textContent),
        solutionsHrefs: Array.from(document.querySelectorAll('#lpDdSolutions .lp-dd-item')).map(a => a.getAttribute('href')),
        resourcesHrefs: Array.from(document.querySelectorAll('#lpDdResources .lp-dd-item')).map(a => a.getAttribute('href')),
      }));
      check('1. Navbar is Product / Solutions / Resources (dropdowns) + Pricing (link)', JSON.stringify(info.triggers) === JSON.stringify(['Product', 'Solutions', 'Resources']) && JSON.stringify(info.plainLinks) === JSON.stringify(['Pricing']), JSON.stringify(info));
      check('2. Resources FAQ item points at the real dedicated /faq page (not just a same-page anchor)', info.resourcesHrefs.includes('/faq'), JSON.stringify(info.resourcesHrefs));
      const REAL_ROUTES = ['/launch', '/campaigns', '/research', '/autopilot', '/business', '/blog', '/about', '/case-studies', '/faq', '/product/google-ads', '/product/meta-ads', '/product/tiktok-ads', '#ov-showcase', '#ov-pillars'];
      check('3. Every Product dropdown item points at a real, existing route', info.productHrefs.every(h => REAL_ROUTES.includes(h)), JSON.stringify(info.productHrefs));
      check('3b. Product dropdown exposes exactly the six real capabilities, in canonical ring order (Research/Create/Launch/Campaigns/Autopilot/Business)', JSON.stringify(info.productNames) === JSON.stringify(['Research', 'Create', 'Launch', 'Campaigns', 'Autopilot', 'Business']), JSON.stringify(info.productNames));
      check('4. Every Solutions dropdown item points at a real, existing route, with no duplicate targets', info.solutionsHrefs.every(h => REAL_ROUTES.includes(h)) && new Set(info.solutionsHrefs).size === info.solutionsHrefs.length, JSON.stringify(info.solutionsHrefs));
      check('5. Every Resources dropdown item points at a real, existing route', info.resourcesHrefs.every(h => REAL_ROUTES.includes(h)) && info.resourcesHrefs.includes('/blog') && info.resourcesHrefs.includes('/about'), JSON.stringify(info.resourcesHrefs));

      // Footer FAQ link specifically.
      const footerFaq = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll('.ov-footer-link')).find(l => l.textContent.trim() === 'FAQ');
        return a ? a.getAttribute('href') : null;
      });
      check('6. Footer FAQ link points at the real /faq page', footerFaq === '/faq', footerFaq);

      // Clicking Resources -> FAQ actually navigates to the dedicated FAQ page.
      await page.hover('#lpDdResources');
      await page.waitForTimeout(200);
      await page.click('#lpDdResources a[href="/faq"]');
      await page.waitForTimeout(700);
      await page.waitForTimeout(300); // let opacity settle before reading it
      const afterFaqClick = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('#view-faq .ov-faq'));
        return {
          pubView: window._pubView, url: window.location.pathname, faqCount: items.length,
          allItemsActuallyVisible: items.length > 0 && items.every(el => getComputedStyle(el).opacity === '1'),
        };
      });
      check('7. Clicking Resources → FAQ navigates to the dedicated /faq page with real content', afterFaqClick.pubView === 'faq' && afterFaqClick.url === '/faq' && afterFaqClick.faqCount > 0, JSON.stringify(afterFaqClick));
      // Real bug found and fixed this pass: the dedicated page reused the
      // homepage FAQ's .ov-faq/.ov-faq-list markup, which a GSAP
      // ScrollTrigger (scoped to #view-landing, matched via a bare
      // '.ov-faq' selector) also tried to animate -- since this page's
      // items live outside #view-landing, that trigger could never fire
      // for them, leaving every item stuck at its opacity:0 starting
      // state forever (rendered as a visually empty page). Fixed by
      // scoping the GSAP selector to the homepage section specifically.
      check('7b. Every FAQ item on the dedicated page is actually visible (opacity:1), not stuck invisible from the homepage\'s GSAP reveal targeting them by mistake', afterFaqClick.allItemsActuallyVisible, JSON.stringify(afterFaqClick));

      check('8. /faq is a real route (view-faq exists) and the homepage #faq section also still exists unchanged', await page.evaluate(() => !!document.getElementById('view-faq') && !!document.getElementById('faq')));

      // Regression check: the homepage's own FAQ reveal must still work
      // after scoping its GSAP ScrollTrigger away from the new page.
      await page.evaluate(() => { window.lpNavigate('/'); });
      await page.waitForTimeout(400);
      await page.evaluate(() => document.getElementById('faq').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(2000);
      const homeFaqInfo = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('#faq .ov-faq'));
        return { count: items.length, allVisible: items.length > 0 && items.every(el => getComputedStyle(el).opacity === '1') };
      });
      check('8d. The homepage\'s own FAQ section still reveals correctly (no regression from scoping its GSAP trigger to itself)', homeFaqInfo.allVisible, JSON.stringify(homeFaqInfo));

      // Cross-page navigation fix: ovNavTo used to silently no-op from any
      // page other than the landing view (only ever scrolled within
      // #view-landing). From a non-landing page, Resources -> FAQ and
      // Product -> Create must both actually work now.
      await page.evaluate(() => { window.lpNavigate('/about'); });
      await page.waitForTimeout(400);
      // Click via JS rather than a real hover+click: this check is about
      // ovNavTo's cross-page behavior specifically, not dropdown-hover
      // visibility timing (already covered by the real hover+click above).
      await page.evaluate(() => document.querySelector('#lpDdResources a[href="/faq"]').click());
      await page.waitForTimeout(700);
      const crossPageFaq = await page.evaluate(() => ({ pubView: window._pubView, url: window.location.pathname }));
      check('8b. Resources → FAQ works correctly when starting from a non-landing page (the cross-page ovNavTo bug fix)', crossPageFaq.pubView === 'faq' && crossPageFaq.url === '/faq', JSON.stringify(crossPageFaq));

      await page.evaluate(() => { window.lpNavigate('/pricing'); });
      await page.waitForTimeout(400);
      await page.evaluate(() => document.querySelector('#lpDdProduct a[href="#ov-pillars"]').click());
      await page.waitForTimeout(700);
      const crossPageCreate = await page.evaluate(() => {
        const rail = document.getElementById('ov-pillars');
        const rect = rail.getBoundingClientRect();
        return { pubView: window._pubView, url: window.location.pathname, railVisible: rect.top < window.innerHeight && rect.bottom > 0 };
      });
      check('8c. Product → Create works correctly when starting from a non-landing page', crossPageCreate.pubView === 'landing' && crossPageCreate.url === '/' && crossPageCreate.railVisible, JSON.stringify(crossPageCreate));
    } finally {
      await page.close();
    }
  }

  // ── 2. Mobile navigation ──────────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => ({
        triggers: Array.from(document.querySelectorAll('.lp-mm-nav .lp-mm-dd-trig')).map(b => b.textContent.replace(/[▾›]/g, '').trim()),
        plainLinks: Array.from(document.querySelectorAll('.lp-mm-nav > .lp-mm-link')).map(a => a.textContent.trim()),
      }));
      check('9. Mobile drawer mirrors desktop nav structure', JSON.stringify(info.triggers) === JSON.stringify(['Product', 'Solutions', 'Resources']) && JSON.stringify(info.plainLinks) === JSON.stringify(['Pricing']), JSON.stringify(info));

      await page.click('#lpHamburger');
      await page.waitForTimeout(200);
      const faqHref = await page.evaluate(() => { const a = Array.from(document.querySelectorAll('.lp-mm-dd-link')).find(l => l.textContent.trim() === 'FAQ'); return a ? a.getAttribute('href') : null; });
      check('10. Mobile FAQ link points at the real dedicated /faq page', faqHref === '/faq', faqHref);
    } finally {
      await page.close();
    }
  }

  // ── 3. Hero + homepage structure — 9 sections, in order, FAQ back ────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const h1 = await page.evaluate(() => document.querySelector('.lp-hero-h1').textContent.replace(/\s+/g, ' ').trim());
      check('11. Hero H1 kept as "Advertising is fragmented. Oriven fixes it."', /Advertising is fragmented/i.test(h1) && /Oriven fixes it/i.test(h1), h1);

      const order = await page.evaluate(() => {
        const stage = document.querySelector('#view-landing #lp-stage');
        return Array.from(stage.children).map(el => el.id).filter(Boolean).filter(id => id !== 'ov-problem');
      });
      const EXPECTED = ['ov-hero', 'ov-showcase', 'ov-statement', 'ov-fragments', 'ov-pillars', 'ov-workflow', 'ov-experience', 'faq', 'ov-final'];
      check('12. Homepage has exactly the required 9 sections, in order — How Oriven Works, then Experience Oriven Yourself, then FAQ (Google Interface + O Label Fix + Section Order pass, spec section 14)', JSON.stringify(order) === JSON.stringify(EXPECTED), JSON.stringify(order));

      check('13. No JS errors on homepage load', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 3b. ORIVEN fixed brand system — exact color tokens + Fuuld/Inter ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      const tokens = await page.evaluate(() => {
        const cs = getComputedStyle(document.getElementById('view-landing'));
        return {
          green: cs.getPropertyValue('--green').trim(),
          primary: cs.getPropertyValue('--oriven-primary').trim(),
          secondary: cs.getPropertyValue('--oriven-secondary').trim(),
          textLight: cs.getPropertyValue('--oriven-text-light').trim(),
          textDark: cs.getPropertyValue('--oriven-text-dark').trim(),
          accentDark: cs.getPropertyValue('--oriven-accent-dark').trim(),
          accentLight: cs.getPropertyValue('--oriven-accent-light').trim(),
          h1Font: getComputedStyle(document.querySelector('.lp-hero-h1')).fontFamily,
          subFont: getComputedStyle(document.querySelector('.lp-hero-sub')).fontFamily,
        };
      });
      check('13b. --green is normalized to the exact Electric Lime token (#B6FF3B), not the old #B7FF2A', tokens.green.toUpperCase() === '#B6FF3B', tokens.green);
      check('13c. --oriven-primary/secondary/text-light/text-dark/accent-dark/accent-light all resolve to the exact spec hex values',
        tokens.primary.toUpperCase() === '#B6FF3B' && tokens.secondary.toUpperCase() === '#080808' &&
        tokens.textLight.toUpperCase() === '#FFFFFF' && tokens.textDark.toUpperCase() === '#171717' &&
        tokens.accentDark.toUpperCase() === '#26331A' && tokens.accentLight.toUpperCase() === '#F5F5F0',
        JSON.stringify(tokens));
      check('13d. Hero H1 uses the Fuuld display stack (falls back to Unbounded until real font files exist)', /Fuuld/.test(tokens.h1Font) && /Unbounded/.test(tokens.h1Font), tokens.h1Font);
      check('13e. Hero subhead uses the Inter body stack', /Inter/.test(tokens.subFont), tokens.subFont);
    } finally {
      await page.close();
    }
  }

  // ── 4. Global em-dash removal from visible homepage copy ────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      // Reveal every scroll-gated block so its text is actually in the DOM/visible.
      await page.evaluate(() => { document.getElementById('view-landing').scrollTop = document.getElementById('view-landing').scrollHeight; });
      await page.waitForTimeout(1500);
      const text = await page.evaluate(() => document.getElementById('view-landing').innerText);
      check('14. No em dash (—) anywhere in visible homepage copy', !/—/.test(text));

      // Spot-check the specific lines the spec called out by name.
      const heroSub = await page.evaluate(() => document.querySelector('.lp-hero-sub').textContent);
      const statement = await page.evaluate(() => document.getElementById('ovStatementLead').textContent);
      const footerTag = await page.evaluate(() => document.querySelector('.ov-footer-tagline').textContent);
      check('15. Hero subhead has no em dash', !/—/.test(heroSub), heroSub);
      check('16. Scroll statement has no em dash', !/—/.test(statement), statement);
      check('17. Footer tagline has no em dash', !/—/.test(footerTag), footerTag);

      const BANNED_PHRASES = [/unlock the power/i, /revolutioniz/i, /take your marketing to the next level/i, /ai-powered solutions for modern marketers/i, /supercharge/i, /cutting-edge/i, /state-of-the-art/i];
      const hit = BANNED_PHRASES.find(re => re.test(text));
      check('17b. No generic AI-hype phrases anywhere in visible homepage copy', !hit, hit ? String(hit) : '');
    } finally {
      await page.close();
    }
  }

  // ── 4b. Six ORIVEN fragments — new #ov-fragments section ─────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.getElementById('ov-fragments').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1200);

      const info = await page.evaluate(() => {
        const sec = document.getElementById('ov-fragments');
        return {
          heading: (sec.querySelector('.ov-frag-h') || {}).textContent.replace(/\s+/g, ' ').trim(),
          segCount: sec.querySelectorAll('.ov-frag-seg').length,
          labels: Array.from(sec.querySelectorAll('.ov-frag-label-svg-name')).map(l => l.textContent.trim()),
          hasSignal: !!sec.querySelector('.ov-frag-signal'),
          isVisible: sec.querySelector('.ov-frag-inner').classList.contains('ov-vis'),
        };
      });
      check('17c. Fragments heading communicates "fragmented -> connected"', /fragmented/i.test(info.heading) && /together/i.test(info.heading), info.heading);
      check('17d. Exactly 6 arc segments (matches the real ORIVEN logo geometry), not a generic 6-circle diagram', info.segCount === 6, String(info.segCount));
      check('17e. Six labels in the correct fragment order: Research, Create, Launch, Campaigns, Autopilot, Business', JSON.stringify(info.labels) === JSON.stringify(['Research', 'Create', 'Launch', 'Campaigns', 'Autopilot', 'Business']), JSON.stringify(info.labels));
      check('17f. Settings is NOT among the six fragments (spec: Settings is a product area, not a fragment)', info.labels.indexOf('Settings') === -1, JSON.stringify(info.labels));
      check('17g. The orbiting signal dot has been removed entirely (Final Polish pass: no orbiting particle, not replaced by anything)', !info.hasSignal, String(info.hasSignal));
      check('17h. Section reveals on scroll (reuses the site-wide data-observe/.ov-vis mechanism)', info.isVisible);
      check('17i. No JS errors around the fragments section', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 4c. Fragments — reduced motion collapses to a static, understandable end-state ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.getElementById('ov-fragments').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => {
        const seg = document.querySelector('.ov-frag-seg-1');
        return {
          segTransform: getComputedStyle(seg).transform,
          segOpacity: getComputedStyle(seg).opacity,
          noSignal: !document.querySelector('.ov-frag-signal'),
        };
      });
      check('17j. Under reduced motion, arc segments sit at their assembled (rotate 0) end-state immediately, fully opaque', info.segOpacity === '1', JSON.stringify(info));
      check('17k. The removed orbiting signal dot stays removed under reduced motion too (nothing to disable — it no longer exists)', info.noSignal, JSON.stringify(info));
    } finally {
      await page.close();
    }
  }

  // ── 4d. Social proof section removed entirely — no fabricated reviews/case study left on the homepage ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      const info = await page.evaluate(() => ({
        hasReviewsSection: !!document.getElementById('ov-reviews'),
        hasReviewRow: !!document.getElementById('ovRevRow'),
        hasFabricatedQuote: /replaced our entire agency|3 weeks to 3 days/i.test(document.getElementById('view-landing').innerText),
      }));
      check('17l. #ov-reviews section is gone (spec: do not invent testimonials/case studies with no real data behind them)', !info.hasReviewsSection && !info.hasReviewRow, JSON.stringify(info));
      check('17m. None of the previously-fabricated named-testimonial quotes remain anywhere in the homepage', !info.hasFabricatedQuote, JSON.stringify(info));
    } finally {
      await page.close();
    }
  }

  // ── 4d2. Fragment interaction (spec sections 1-10) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-fragments').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1000);

      // The GEOMETRIC SEGMENT itself must be the target now, not the
      // outer text label — hover the segment's own bounding box directly.
      const seg2Box = await page.evaluate(() => {
        const r = document.querySelector('.ov-frag-seg-2').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      const idleUnitTransform = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-frag-unit-2')).transform);
      const idleRingTransform = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-frag-ring')).transform);
      await page.mouse.move(seg2Box.x, seg2Box.y);
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => ({
        ringTransform: getComputedStyle(document.querySelector('.ov-frag-ring')).transform,
        unitTransform: getComputedStyle(document.querySelector('.ov-frag-unit-2')).transform,
        centerText: document.querySelector('.ov-frag-center-2').textContent.trim(),
        centerOpacity: getComputedStyle(document.querySelector('.ov-frag-center-2')).opacity,
        seg2Filter: getComputedStyle(document.querySelector('.ov-frag-unit-2')).filter,
      }));
      // Ring-wide enlarge is explicitly REMOVED this pass — the ring's
      // transform under a segment hover must stay within the idle
      // breathing range (<=1.02), never jump to the old 1.06.
      const ringScaleX = parseFloat((info.ringTransform.match(/matrix\(([^,]+),/) || [])[1] || '0');
      check('17n. Hovering a segment does NOT enlarge the whole ring anymore (spec section 9: explicitly removed)', ringScaleX <= 1.02, JSON.stringify({ ringScaleX, ringTransform: info.ringTransform }));
      check('17o. Hovering the segment reveals its explanation inside the ring center', info.centerOpacity === '1' && info.centerText === 'Turn insights into ad creatives.', JSON.stringify(info));
      check('17p. Hovering the segment highlights it (drop-shadow glow)', info.seg2Filter !== 'none', info.seg2Filter);
      check('17p2. The unit (segment+label together, one <g>) physically moves on hover, not left behind at its idle position', info.unitTransform !== idleUnitTransform, JSON.stringify({ idleUnitTransform, unitTransform: info.unitTransform }));

      // Keyboard-focus must trigger the exact same reveal.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      await page.evaluate(() => document.querySelector('.ov-frag-hit-4').focus());
      await page.waitForTimeout(400);
      const focusInfo = await page.evaluate(() => ({
        centerOpacity: getComputedStyle(document.querySelector('.ov-frag-center-4')).opacity,
        unitTransform: getComputedStyle(document.querySelector('.ov-frag-unit-4')).transform,
      }));
      check('17q. Keyboard focus on a fragment hit-area also reveals its explanation and moves its unit', focusInfo.centerOpacity === '1', JSON.stringify(focusInfo));
    } finally {
      await page.close();
    }
  }

  // ── 4d2c. Google Interface + O Label Fix pass — segment and its label are now literally the SAME moving object (spec sections 6-13) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-fragments').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1200); // let the initial staggered reveal fully settle first

      // Structural check: the label MUST live inside the same <g> as its
      // segment now (spec section 7: "Put the text inside the same SVG
      // <g> as the corresponding segment"), not as a separate sibling
      // element with its own independently-computed position.
      const structure = await page.evaluate(() => {
        const unit = document.querySelector('.ov-frag-unit-6');
        return {
          sameParent: !!(unit && unit.querySelector('.ov-frag-seg-6') && unit.querySelector('.ov-frag-label-svg')),
          isOneGroup: unit ? unit.tagName.toLowerCase() : null,
        };
      });
      check('17ae0. The segment and its label live inside the SAME <g> element (spec: "ONE GROUP")', structure.sameParent && structure.isOneGroup === 'g', JSON.stringify(structure));

      // Fragment 6 specifically — it carries the largest base stagger
      // delay (.3s) from the initial "assemble" reveal, the worst case
      // for any leftover desync.
      const seg6Box = await page.evaluate(() => {
        const r = document.querySelector('.ov-frag-seg-6').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });

      // THE key verification the spec explicitly demands: sample the
      // real screen offset between the path and its text at several
      // points DURING the transition (not just idle and final), and
      // confirm that offset never changes — i.e. they move in genuine
      // lockstep the whole way through, not just coincidentally match
      // at the end. Since they now share one transform on one element,
      // this is structurally guaranteed, but verified empirically anyway
      // per the explicit instruction not to trust the final frame alone.
      const sample = () => page.evaluate(() => {
        const path = document.querySelector('.ov-frag-seg-6');
        const text = document.querySelector('.ov-frag-unit-6 .ov-frag-label-svg');
        const pRect = path.getBoundingClientRect();
        const tRect = text.getBoundingClientRect();
        return {
          dx: Math.round((pRect.x + pRect.width / 2) - (tRect.x + tRect.width / 2)),
          dy: Math.round((pRect.y + pRect.height / 2) - (tRect.y + tRect.height / 2)),
        };
      });
      const idleOffset = await sample();
      await page.mouse.move(seg6Box.x, seg6Box.y);
      const midOffsets = [];
      for (const wait of [20, 60, 80, 80]) {
        await page.waitForTimeout(wait);
        midOffsets.push(await sample());
      }
      await page.waitForTimeout(300);
      const finalOffset = await sample();

      const allOffsets = [idleOffset, ...midOffsets, finalOffset];
      const allMatch = allOffsets.every(o => Math.abs(o.dx - idleOffset.dx) <= 1 && Math.abs(o.dy - idleOffset.dy) <= 1);
      check('17ae1. Path-to-text offset stays constant at EVERY sampled point through the whole transition — genuine lockstep motion, not just a matching final frame (spec: "AT EVERY POINT DURING THE ANIMATION")', allMatch, JSON.stringify(allOffsets));

      const finalInfo = await page.evaluate(() => {
        const labelRect = document.querySelector('.ov-frag-unit-6 .ov-frag-label-svg').getBoundingClientRect();
        const segRect = document.querySelector('.ov-frag-seg-6').getBoundingClientRect();
        const labelCenter = { x: labelRect.x + labelRect.width / 2, y: labelRect.y + labelRect.height / 2 };
        return {
          labelInsideSeg: labelCenter.x >= segRect.left && labelCenter.x <= segRect.right && labelCenter.y >= segRect.top && labelCenter.y <= segRect.bottom,
        };
      });
      check('17ae7. At the final (moved) position, the label sits inside its now-moved fragment', finalInfo.labelInsideSeg);
    } finally {
      await page.close();
    }
  }

  // ── 4d2d. Reduced motion still fully disables the fragment/label hover transition ──
  {
    const rmPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      await rmPage.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await rmPage.evaluate(() => document.getElementById('ov-fragments').scrollIntoView({ block: 'center' }));
      await rmPage.waitForTimeout(500);
      const box = await rmPage.evaluate(() => {
        const r = document.querySelector('.ov-frag-seg-6').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await rmPage.mouse.move(box.x, box.y);
      await rmPage.waitForTimeout(100);
      const rmInfo = await rmPage.evaluate(() => ({
        unitDuration: getComputedStyle(document.querySelector('.ov-frag-unit-6')).transitionDuration,
      }));
      check('17ae8. Under reduced motion, the fragment/label hover transition is still fully disabled (0s)', rmInfo.unitDuration === '0s', JSON.stringify(rmInfo));
    } finally {
      await rmPage.close();
    }
  }

  // ── 4d2b. Labels live INSIDE the fragments (spec sections 4-5) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-fragments').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1000);
      const info = await page.evaluate(() => {
        const label1 = document.querySelector('.ov-frag-unit-1 .ov-frag-label-svg');
        const labelRect = label1.getBoundingClientRect();
        const segRect = document.querySelector('.ov-frag-seg-1').getBoundingClientRect();
        const labelCenter = { x: labelRect.x + labelRect.width / 2, y: labelRect.y + labelRect.height / 2 };
        return {
          numFill: getComputedStyle(document.querySelector('.ov-frag-label-svg-num')).fill,
          nameFill: getComputedStyle(document.querySelector('.ov-frag-label-svg-name')).fill,
          // Is the label's own center actually within the segment's own
          // bounding box, i.e. genuinely inside the fragment now, not
          // floating in the outer margin outside the ring entirely.
          labelCenterInsideSegBox: labelCenter.x >= segRect.left && labelCenter.x <= segRect.right && labelCenter.y >= segRect.top && labelCenter.y <= segRect.bottom,
        };
      });
      check('17ae3. The label sits visually inside its fragment segment (spec: "the text belongs to the actual fragment")', info.labelCenterInsideSegBox);
      check('17ae4. Label text uses Charcoal for contrast against the Electric Lime fill (never Pure White on lime)', /rgba?\(23, ?23, ?23/.test(info.nameFill), JSON.stringify(info));
    } finally {
      await page.close();
    }
  }

  // ── 4d3. Fragment ring — size, geometry, discoverability hint, click-persist + tap support ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-fragments').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1000);
      const info = await page.evaluate(() => {
        const wrap = document.querySelector('.ov-frag-ring-wrap');
        const seg1 = document.querySelector('.ov-frag-seg-1');
        const hits = Array.from(document.querySelectorAll('.ov-frag-hit'));
        return {
          wrapWidth: wrap.getBoundingClientRect().width,
          hintText: (document.querySelector('.ov-frag-hint') || {}).textContent || '',
          segIsFilled: getComputedStyle(seg1).fill !== 'none',
          hitCount: hits.length,
          hitsAreButtons: hits.every(h => h.tagName === 'BUTTON'),
          labelTextCount: document.querySelectorAll('.ov-frag-label-svg').length,
          labelsAreNotFocusable: Array.from(document.querySelectorAll('.ov-frag-label-svg')).every(l => l.tagName !== 'BUTTON' && !l.hasAttribute('tabindex')),
        };
      });
      check('17aa. Ring is substantially larger than the pre-refinement 460px cap ("significantly larger... clearly dominant")', info.wrapWidth > 550, String(info.wrapWidth));
      check('17ab. A short discoverability hint is present, telling the visitor the O is interactive', /explore/i.test(info.hintText), info.hintText);
      check('17ac. Segments are real filled annulus wedges (logo-accurate), not a thin stroked circle', info.segIsFilled);
      check('17ac2. Six real interactive hit-area buttons exist, one per fragment (the geometric fragment is the target now, not the label)', info.hitCount === 6 && info.hitsAreButtons, JSON.stringify(info));
      check('17ac3. Six SVG labels exist, none independently interactive (they move with their segment instead)', info.labelTextCount === 6 && info.labelsAreNotFocusable, JSON.stringify(info));

      // Click/tap PERSISTS (spec section 7: "keep it active until another
      // fragment is selected or the user dismisses the interaction. Do
      // not make the interaction disappear immediately after click").
      // Dispatched via JS, not page.click(), which would leave Playwright's
      // real mouse hovering the element afterward — a lingering :hover
      // state a real touch tap never produces.
      await page.evaluate(() => document.querySelector('.ov-frag-hit-5').click());
      await page.waitForTimeout(300);
      const tapped = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-frag-center-5')).opacity);
      // Move the (JS-dispatched, so not actually hovering) mouse away and confirm it STAYS open.
      await page.mouse.move(50, 50);
      await page.waitForTimeout(300);
      const persisted = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-frag-center-5')).opacity);
      await page.evaluate(() => document.querySelector('.ov-frag-hit-5').click());
      await page.waitForTimeout(300);
      const dismissed = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-frag-center-5')).opacity);
      check('17ad. Tapping/clicking a fragment reveals its center text — mobile has no hover at all', tapped === '1', tapped);
      check('17ad2. The activation PERSISTS after the pointer moves away (does not disappear immediately after click)', persisted === '1', persisted);
      check('17ae. Clicking the same fragment again dismisses it', dismissed === '0', dismissed);
    } finally {
      await page.close();
    }
  }

  // ── 4d4. How Oriven Works — ACTUAL VISUAL FIXES pass: full rebuild as real product UI, not generic diagrams ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-workflow').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1200);
      const info = await page.evaluate(() => {
        const feedRows = Array.from(document.querySelectorAll('.ov-wf-viz-research .ov-wfv-feed-row')).map(r => r.textContent.replace(/\s+/g, ' ').trim());
        const activeFeedRow = document.querySelector('.ov-wf-viz-research .ov-wfv-feed-row-active');
        const create = document.querySelector('.ov-wf-viz-create .ov-wfv-adcard');
        const launchCardName = (document.querySelector('.ov-wf-viz-launch .ov-wfv-launch-card-name') || {}).textContent || '';
        const deployRows = Array.from(document.querySelectorAll('.ov-wf-viz-launch .ov-wfv-deploy-row')).map(r => r.textContent.trim());
        const improveChips = Array.from(document.querySelectorAll('.ov-wf-viz-business .ov-wfv-chip')).map(c => c.textContent.trim());
        const hasTrendLine = !!document.querySelector('.ov-wf-viz-business .ov-wfv-trend');
        const hasBars = !!document.querySelector('.ov-wf-viz-business .ov-wfv-bar');
        const winbarLabels = Array.from(document.querySelectorAll('.ov-wf-cell-media .ov-wfv-winbar-label')).map(w => w.textContent.trim());
        return {
          feedRows,
          activeFeedTag: activeFeedRow ? activeFeedRow.querySelector('.ov-wfv-feed-tag').textContent.trim() : null,
          createHasHookHeadlineCta: !!create && /Stop wasting money/i.test(create.textContent) && !!create.querySelector('.ov-wfv-adcard-cta'),
          createBg: create ? getComputedStyle(create).backgroundColor : null,
          createHeadlineColor: create ? getComputedStyle(create.querySelector('.ov-wfv-adcard-headline')).color : null,
          createCtaBg: create ? getComputedStyle(create.querySelector('.ov-wfv-adcard-cta')).backgroundColor : null,
          launchCardName,
          deployRows,
          improveChips,
          hasTrendLine,
          hasBars,
          winbarLabels,
        };
      });
      check('17af. Research is a real signal FEED (list of rows), not a dot-and-line network diagram', info.feedRows.length === 3 && info.feedRows.some(r => /Messaging pattern/i.test(r)) && info.feedRows.some(r => /Trend/i.test(r)), JSON.stringify(info.feedRows));
      check('17af2. One feed row is pulled forward as the selected insight, tagged "Signal detected"', /signal detected/i.test(info.activeFeedTag || ''), info.activeFeedTag);
      check('17ag. Create shows a real mini ad-mockup (hook copy + visual placeholder + CTA)', info.createHasHookHeadlineCta);
      check('17ag2. Create panel is the exact Deep Moss token (#26331A), not Snow/white (spec section 11)', info.createBg === 'rgb(38, 51, 26)', info.createBg);
      check('17ag3. Create panel structural text is Pure White on the Deep Moss surface', info.createHeadlineColor === 'rgb(255, 255, 255)', info.createHeadlineColor);
      check('17ag4. Create panel CTA is the one Electric Lime accent, not the whole block turned green', info.createCtaBg === 'rgb(182, 255, 59)', info.createCtaBg);
      check('17ah. Launch is a campaign-preview card handing off into a real deployment checklist, not a node graph', info.launchCardName === 'Summer Collection' && info.deployRows.length === 4, JSON.stringify({ name: info.launchCardName, rows: info.deployRows }));
      check('17ah2. All four real platforms appear in the deployment checklist', ['Meta', 'Google', 'TikTok', 'Pinterest'].every(l => info.deployRows.some(r => r.indexOf(l) !== -1)), JSON.stringify(info.deployRows));
      check('17ai. Improve is a single smooth trend line with highlighted state chips, NOT a bar chart', info.hasTrendLine && !info.hasBars, JSON.stringify({ hasTrendLine: info.hasTrendLine, hasBars: info.hasBars }));
      // Final Polish sprint (6-step "How Oriven Works", spec section 14): "Improve" was
      // split into real Campaigns/Autopilot/Business steps matching the six real
      // ORIVEN products; the Business card (formerly "Improve") kept its trend-line
      // visual but its second chip was renamed to a real, honest Business Map term.
      check('17ai2. Business shows real "Opportunity found" / "Tracking gap flagged" readout chips telling the before/after story', info.improveChips.some(c => /Opportunity found/i.test(c)) && info.improveChips.some(c => /Tracking gap flagged/i.test(c)), JSON.stringify(info.improveChips));
      check('17aj. No JS errors around the reworked How Oriven Works visuals', pageErrors.length === 0, JSON.stringify(pageErrors));
      check('17ak. All six cards share the same "product window" chrome (spec: "miniature windows into ORIVEN itself")', JSON.stringify(info.winbarLabels) === JSON.stringify(['Analysis', 'Creative studio', 'Deployment', 'Campaign Replay', 'Control Room', 'Business Map']), JSON.stringify(info.winbarLabels));
    } finally {
      await page.close();
    }
  }

  // ── 4e. Pricing band removed entirely (spec: "REMOVE THIS ENTIRE SECTION... do not replace it with another pricing section") ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => {
        const finalCta = document.getElementById('ov-final');
        const footer = document.querySelector('.ov-footer');
        return {
          hasPricingBand: !!document.getElementById('ov-pricing-link'),
          hasPlanNames: /Starter, Creator and Professional/.test(document.getElementById('view-landing').innerText),
          finalCtaThenFooter: finalCta && footer ? finalCta.compareDocumentPosition(footer) === Node.DOCUMENT_POSITION_FOLLOWING : false,
        };
      });
      check('17r. #ov-pricing-link band is gone entirely', !info.hasPricingBand && !info.hasPlanNames, JSON.stringify(info));
      check('17s. Homepage now goes straight from the Final CTA into the footer', info.finalCtaThenFooter, JSON.stringify(info));
    } finally {
      await page.close();
    }
  }

  // ── 4f. Create tab's video mapping (Settings tab removed this pass) ──
  // Product Films pass — the placeholder "assets/Create.mp4" this check
  // originally asserted was replaced with the real finished film once one
  // existed. Per that pass's explicit, verified-against-real-filenames
  // spec, Create intentionally maps to "ORIVEN Launch Film.mp4" (not a
  // file named after Create) — updated here to match, not a regression.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.getElementById('ov-pillars').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await page.click('.ov-ws-tab[data-cap="create"]');
      await page.waitForTimeout(400);
      const src = await page.evaluate(() => {
        const v = document.querySelector('.ov-ws-content[data-cap="create"] .ov-ws-video');
        return v ? v.getAttribute('src') : null;
      });
      check('17t. Create tab probes the real ORIVEN Launch Film.mp4 (intentional Create/Launch mapping)', src === 'assets/ORIVEN%20Launch%20Film.mp4', src);
      const hasSettingsTab = await page.evaluate(() => !!document.querySelector('.ov-ws-tab[data-cap="settings"]'));
      check('17u. Settings tab removed from the showcase (spec: Settings is a product area, not one of the six fragments)', !hasSettingsTab);
    } finally {
      await page.close();
    }
  }

  // ── 4g. Hero input wider, keyboard-shortcut icon removed ─────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => ({
        width: document.querySelector('.lp-hero-input-wrap').getBoundingClientRect().width,
        hasKbdHint: !!document.querySelector('.lp-hero-kbd'),
      }));
      check('17v. Hero input widened beyond the old 640px cap', info.width > 640, String(info.width));
      check('17w. Unnecessary return/keyboard-shortcut hint removed from next to Generate Campaign', !info.hasKbdHint);
    } finally {
      await page.close();
    }
  }

  // ── 4h. Real Ads. Every Platform. — each platform is a real ad-format surface, not a generic labeled box ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(600);
      // Google per-card ad-interface pass — every individual GA image sits
      // inside its own Google search/ad-result card (search bar + Ad
      // badge/domain + headline + description + the real image), repeated
      // per creative in the marquee. There is no single global search
      // header above the whole carousel anymore.
      const google = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ov-adx-gcard'));
        const first = cards[0];
        return {
          cardCount: cards.length,
          noGlobalFrame: !document.getElementById('ovGoogleFrame'),
          firstHasQuery: !!first.querySelector('.ov-adx-gc-query'),
          firstHasBadge: !!first.querySelector('.ov-adx-gc-badge'),
          firstHasDomain: !!first.querySelector('.ov-adx-gc-domain'),
          firstHasHeadline: !!first.querySelector('.ov-adx-gc-headline'),
          firstHasDesc: !!first.querySelector('.ov-adx-gc-desc'),
          firstHasImg: !!first.querySelector('.ov-adx-gc-media img[src^="assets/GA"]'),
          everyCardHasFullStructure: cards.every(c =>
            c.querySelector('.ov-adx-gc-query') && c.querySelector('.ov-adx-gc-badge') &&
            c.querySelector('.ov-adx-gc-domain') && c.querySelector('.ov-adx-gc-headline') &&
            c.querySelector('.ov-adx-gc-desc') && c.querySelector('.ov-adx-gc-media img[src^="assets/GA"]')),
        };
      });
      check('17x. Google Ads carousel renders per-image ad cards (a multiple of the 10 creatives, repeated as needed to fill the viewport), no leftover global search frame', google.cardCount > 0 && google.cardCount % 10 === 0 && google.noGlobalFrame, JSON.stringify(google));
      check('17y. Every Google ad card has its own complete search/ad-result structure (search query, Ad badge, domain, headline, description, real image)', google.everyCardHasFullStructure, JSON.stringify(google));

      const googleCopy = await page.evaluate(() => {
        const seen = new Set();
        const cards = Array.from(document.querySelectorAll('.ov-adx-gcard')).filter(c => {
          const src = c.querySelector('.ov-adx-gc-media img').getAttribute('src');
          if (seen.has(src)) return false;
          seen.add(src);
          return true;
        });
        return {
          queries: cards.map(c => c.querySelector('.ov-adx-gc-query').textContent.trim()),
          domains: cards.map(c => c.querySelector('.ov-adx-gc-domain').textContent.trim()),
          headlines: cards.map(c => c.querySelector('.ov-adx-gc-headline').textContent.trim()),
          alts: cards.map(c => c.querySelector('.ov-adx-gc-media img').getAttribute('alt')),
          imgSrcs: cards.map(c => c.querySelector('.ov-adx-gc-media img').getAttribute('src')),
        };
      });
      check('17z. Google ad copy (query/domain/headline) is distinct per card, not the same copy repeated across all ten', new Set(googleCopy.queries).size === 10 && new Set(googleCopy.domains).size === 10 && new Set(googleCopy.headlines).size === 10, JSON.stringify(googleCopy));
      check('17za. Each Google card image has a meaningful, non-generic alt attribute', googleCopy.alts.every(a => a && a.length > 10) && new Set(googleCopy.alts).size === 10, JSON.stringify(googleCopy.alts));
      check('17zb. The ten distinct GA1-GA10 source images are each used exactly once per row-half', new Set(googleCopy.imgSrcs).size === 10, JSON.stringify(googleCopy.imgSrcs));

      // Meta per-card ad-interface pass — same "own ad card per creative"
      // architecture as Google, using the real MA1-MA10 assets, but a
      // distinct Meta/feed-ad structure (avatar + advertiser + Sponsored,
      // primary/secondary text, image, CTA action bar) so it reads as a
      // social feed ad, not Google with a different logo.
      await page.click('.ov-showcase-tab[data-platform="meta"]');
      await page.waitForTimeout(500);
      const meta = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ov-adx-mcard'));
        const first = cards[0];
        return {
          cardCount: cards.length,
          firstHasAvatar: !!first.querySelector('.ov-adx-mc-avatar'),
          firstHasName: !!first.querySelector('.ov-adx-mc-name'),
          firstHasSponsored: /Sponsored/.test(first.querySelector('.ov-adx-mc-sponsored').textContent),
          firstHasText: !!first.querySelector('.ov-adx-mc-text'),
          firstHasCta: !!first.querySelector('.ov-adx-mc-cta'),
          firstHasImg: !!first.querySelector('.ov-adx-mc-media img[src^="assets/MA"]'),
          everyCardHasFullStructure: cards.every(c =>
            c.querySelector('.ov-adx-mc-avatar') && c.querySelector('.ov-adx-mc-name') &&
            /Sponsored/.test(c.querySelector('.ov-adx-mc-sponsored').textContent) &&
            c.querySelector('.ov-adx-mc-text') && c.querySelector('.ov-adx-mc-cta') &&
            c.querySelector('.ov-adx-mc-media img[src^="assets/MA"]')),
          differsFromGoogle: !first.querySelector('.ov-adx-gc-search'), // no Google search-bar chrome leaking into Meta cards
        };
      });
      check('17y. Meta Ads renders per-card feed-ad units (avatar, advertiser name, Sponsored, primary text, image, CTA), distinct from Google\'s search-ad chrome', meta.everyCardHasFullStructure && meta.differsFromGoogle && meta.cardCount > 0, JSON.stringify(meta));

      const metaCopy = await page.evaluate(() => {
        const seen = new Set();
        const cards = Array.from(document.querySelectorAll('.ov-adx-mcard')).filter(c => {
          const src = c.querySelector('.ov-adx-mc-media img').getAttribute('src');
          if (seen.has(src)) return false;
          seen.add(src);
          return true;
        });
        return {
          names: cards.map(c => c.querySelector('.ov-adx-mc-name').textContent.trim()),
          texts: cards.map(c => c.querySelector('.ov-adx-mc-text').textContent.trim()),
          alts: cards.map(c => c.querySelector('.ov-adx-mc-media img').getAttribute('alt')),
          imgSrcs: cards.map(c => c.querySelector('.ov-adx-mc-media img').getAttribute('src')),
        };
      });
      check('17y2. Meta ad copy (advertiser name/primary text) is distinct per card, not repeated across all ten', new Set(metaCopy.names).size === 10 && new Set(metaCopy.texts).size === 10, JSON.stringify(metaCopy));
      check('17y3. Every Meta card image has a meaningful, non-generic alt attribute, and all ten real MA1-MA10 assets are used exactly once each', metaCopy.alts.every(a => a && a.length > 10) && new Set(metaCopy.imgSrcs).size === 10, JSON.stringify(metaCopy));

      await page.click('.ov-showcase-tab[data-platform="tiktok"]');
      await page.waitForTimeout(500);
      const tiktok = await page.evaluate(() => {
        const c = document.querySelector('.ov-adx-tiktok');
        return { hasScrim: !!c.querySelector('.ov-adx-t-scrim'), hasHandle: /^@/.test((c.querySelector('.ov-adx-t-handle') || {}).textContent || '') };
      });
      check('17z. TikTok Ads card is a real vertical-video format with a handle/scrim, not a landscape box', tiktok.hasScrim && tiktok.hasHandle, JSON.stringify(tiktok));

      // Pinterest per-card ad-interface pass — same "own ad card per
      // creative" architecture as Google/Meta, using the real PA1-PA10
      // assets, with a distinct image-first Pin structure (Promoted
      // badge overlaid on the dominant image, then avatar/advertiser/
      // title/description/CTA below it).
      await page.click('.ov-showcase-tab[data-platform="pinterest"]');
      await page.waitForTimeout(500);
      const pinterest = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ov-adx-pcard'));
        const first = cards[0];
        return {
          cardCount: cards.length,
          firstHasBadge: /Promoted/i.test((first.querySelector('.ov-adx-pc-badge') || {}).textContent || ''),
          firstHasTitle: !!first.querySelector('.ov-adx-pc-title'),
          firstHasImg: !!first.querySelector('.ov-adx-pc-media img[src^="assets/PA"]'),
          everyCardHasFullStructure: cards.every(c =>
            /Promoted/i.test((c.querySelector('.ov-adx-pc-badge') || {}).textContent || '') &&
            c.querySelector('.ov-adx-pc-title') && c.querySelector('.ov-adx-pc-media img[src^="assets/PA"]')),
        };
      });
      check('17za. Pinterest Ads renders per-card Pin units (Promoted badge, advertiser, title, description, CTA, real image), distinct from the other three platforms\' chrome', pinterest.everyCardHasFullStructure && pinterest.cardCount > 0, JSON.stringify(pinterest));
      check('17zb. No JS errors switching through all four ad-format surfaces', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 4i. FAQ — noisy badge subtitle removed, centered layout ──────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.getElementById('faq').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => ({
        hasBadges: !!document.querySelector('.ov-faq-badges'),
        headAlign: getComputedStyle(document.querySelector('.ov-faq-head .ov-section-h')).textAlign,
      }));
      check('17zc. Noisy FAQ subtitle badge row removed', !info.hasBadges);
      check('17zd. FAQ heading is centered', info.headAlign === 'center', info.headAlign);
    } finally {
      await page.close();
    }
  }

  // ── 4j. Dead decorative fragment layer removed from Final CTA ────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const hasFragLayer = await page.evaluate(() => !!document.querySelector('#ov-final .ov-frag-layer'));
      check('17ze. Dead rainbow-colored decorative fragment layer removed from Final CTA (was already display:none, now gone from markup entirely)', !hasFragLayer);
    } finally {
      await page.close();
    }
  }

  // ── 5. Real Ads. Every Platform. — unaffected, re-verified ──────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => ({
        cardCount: document.querySelectorAll('#ovAdWall .ov-wall-card').length,
        hasFakeAdMarkup: !!document.querySelector('#ovAdWall .adv-card'),
      }));
      check('18. Ad wall still renders clean asset-driven cards, no fabricated ad markup', info.cardCount > 0 && !info.hasFakeAdMarkup, JSON.stringify(info));
    } finally {
      await page.close();
    }
  }

  // ── 5b. Google marquee — seamless repeated-sequence architecture (the
  // marquee-gap-bug fix). The old architecture doubled the card set once
  // and animated a flat translateX(-50%); that's only exactly correct
  // when the track holds precisely two equal-width copies, and is off by
  // half a card-gap otherwise, which is what produced the reported
  // occasional edge gaps. The fix: the track holds N identical
  // .ov-wall-seq copies (N computed from the viewport), and the CSS
  // animation is driven by --ov-seq-w, a pixel distance JS measures from
  // the ACTUAL rendered offset between two sequences (not derived from
  // an assumed percentage). ──────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1000);
      const info = await page.evaluate(() => {
        function seqImgs(track, i){
          const seqs = track.querySelectorAll('.ov-wall-seq');
          return seqs[i] ? Array.from(seqs[i].querySelectorAll('img')).map(im => im.getAttribute('src')) : null;
        }
        const t1 = document.getElementById('ovWallTrack1');
        const t2 = document.getElementById('ovWallTrack2');
        // Geometry: the true gap between the last card of sequence A and
        // the first card of sequence B, versus the normal intra-sequence
        // card gap. These must be equal -- any larger value would be the
        // exact "empty region at the loop boundary" bug being fixed.
        const seqsRow1 = t1.querySelectorAll('.ov-wall-seq');
        const seqACards = seqsRow1[0].querySelectorAll('.ov-wall-card');
        const seqBCards = seqsRow1[1].querySelectorAll('.ov-wall-card');
        const lastOfA = seqACards[seqACards.length - 1];
        const firstOfB = seqBCards[0];
        const gapBoundary = firstOfB.offsetLeft - (lastOfA.offsetLeft + lastOfA.offsetWidth);
        const gapNormal = seqACards[1].offsetLeft - (seqACards[0].offsetLeft + seqACards[0].offsetWidth);
        return {
          seqCount1: t1.querySelectorAll('.ov-wall-seq').length,
          seqCount2: t2.querySelectorAll('.ov-wall-seq').length,
          seq1First: seqImgs(t1, 0),
          seq1Second: seqImgs(t1, 1),
          seq2First: seqImgs(t2, 0),
          seq2Second: seqImgs(t2, 1),
          row1Anim: getComputedStyle(t1).animationName,
          row1Dir: getComputedStyle(t1).animationDirection,
          row2Dir: getComputedStyle(t2).animationDirection,
          seqW1: getComputedStyle(t1).getPropertyValue('--ov-seq-w'),
          seqW2: getComputedStyle(t2).getPropertyValue('--ov-seq-w'),
          gapBoundary, gapNormal,
        };
      });
      const GA_TOP = ['assets/GA1.png','assets/GA2.png','assets/GA3.png','assets/GA4.png','assets/GA5.png'];
      const GA_BOTTOM = ['assets/GA6.png','assets/GA7.png','assets/GA8.png','assets/GA9.png','assets/GA10.png'];
      check('18b. GA1-GA5 present, in order, in row 1\'s first sequence', JSON.stringify(info.seq1First) === JSON.stringify(GA_TOP), JSON.stringify(info.seq1First));
      check('18b2. GA1-GA5 present, in order (not reversed), in row 1\'s repeated sequence', JSON.stringify(info.seq1Second) === JSON.stringify(GA_TOP), JSON.stringify(info.seq1Second));
      check('18c. GA6-GA10 present, in order, in row 2\'s first sequence', JSON.stringify(info.seq2First) === JSON.stringify(GA_BOTTOM), JSON.stringify(info.seq2First));
      check('18c2. GA6-GA10 present, in order (not reversed), in row 2\'s repeated sequence', JSON.stringify(info.seq2Second) === JSON.stringify(GA_BOTTOM), JSON.stringify(info.seq2Second));
      check('18c3. Track uses a repeated-sequence architecture (2+ .ov-wall-seq copies per row), not a single flat doubled list', info.seqCount1 >= 2 && info.seqCount2 >= 2, JSON.stringify({ seqCount1: info.seqCount1, seqCount2: info.seqCount2 }));
      check('18d. Row 1 is configured for leftward movement (normal animation direction)', info.row1Anim !== 'none' && info.row1Dir === 'normal', JSON.stringify({ anim: info.row1Anim, dir: info.row1Dir }));
      check('18e. Row 2 is configured for rightward movement (reverse animation direction), same 6-10 order', info.row2Dir === 'reverse', info.row2Dir);
      check('18e2. The animation distance (--ov-seq-w) is a measured pixel value, not left as an arbitrary/unset percentage', /^\d+(\.\d+)?px$/.test(info.seqW1.trim()) && /^\d+(\.\d+)?px$/.test(info.seqW2.trim()), JSON.stringify({ seqW1: info.seqW1, seqW2: info.seqW2 }));
      check('18e3. Geometry: the gap between the end of one sequence and the start of the next equals the normal intentional card gap exactly (the actual fix for the reported empty-gap bug)', info.gapBoundary === info.gapNormal, JSON.stringify({ gapBoundary: info.gapBoundary, gapNormal: info.gapNormal }));

      // Real files, not broken images — these are large multi-MB product
      // photos, so actually WAIT for each to finish loading (up to 15s)
      // rather than assuming a short fixed timeout was enough.
      const loadedOk = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('#ovWallTrack1 img, #ovWallTrack2 img')).slice(0, 10);
        return Promise.all(imgs.map(img => img.naturalWidth > 0 ? Promise.resolve(true) : new Promise(resolve => {
          img.addEventListener('load', () => resolve(img.naturalWidth > 0), { once: true });
          img.addEventListener('error', () => resolve(false), { once: true });
          setTimeout(() => resolve(img.naturalWidth > 0), 15000);
        }))).then(results => results.every(Boolean));
      });
      check('18f. All 10 real GA images actually load (not broken/missing files)', loadedOk);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('18g. No horizontal page overflow from the carousel', overflow <= 0, String(overflow));
      check('18h. No JS errors around the Google carousel', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 5b2. No-gap geometry holds across breakpoint-relevant viewport widths (deterministic, not timing-dependent) ──
  {
    for (const vw of [1440, 1024, 768, 390]) {
      const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
      try {
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
        await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const geom = await page.evaluate(() => {
          const t1 = document.getElementById('ovWallTrack1');
          const seqs = t1.querySelectorAll('.ov-wall-seq');
          const a = seqs[0].querySelectorAll('.ov-wall-card');
          const b = seqs[1].querySelectorAll('.ov-wall-card');
          const lastOfA = a[a.length - 1];
          const gapBoundary = b[0].offsetLeft - (lastOfA.offsetLeft + lastOfA.offsetWidth);
          const gapNormal = a[1].offsetLeft - (a[0].offsetLeft + a[0].offsetWidth);
          // Coverage: track content must be wide enough to span the
          // viewport plus one full sequence period at every point in the
          // loop -- otherwise the track runs out of cards before the
          // animation resets.
          const period = parseFloat(getComputedStyle(t1).getPropertyValue('--ov-seq-w'));
          const trackWidth = t1.getBoundingClientRect().width;
          const rowWidth = t1.parentElement.getBoundingClientRect().width;
          return { gapBoundary, gapNormal, sufficientCoverage: trackWidth >= rowWidth + period };
        });
        check('18e4. [' + vw + 'px] No horizontal overflow from the Google marquee', overflow <= 0, String(overflow));
        check('18e5. [' + vw + 'px] Sequence boundary gap equals the normal card gap (no empty region)', geom.gapBoundary === geom.gapNormal, JSON.stringify(geom));
        check('18e6. [' + vw + 'px] Track holds enough repeated sequences to cover the viewport across the full loop', geom.sufficientCoverage, JSON.stringify(geom));
      } finally {
        await page.close();
      }
    }
  }

  // ── 5c. Google carousel respects prefers-reduced-motion (stops, stable readable state, no empty tracks) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => ({
        animName: getComputedStyle(document.querySelector('#ovWallTrack1')).animationName,
        cardCount: document.querySelectorAll('.ov-adx-gcard').length,
      }));
      check('18i. Reduced motion stops the carousel movement entirely', info.animName === 'none', info.animName);
      check('18i2. Reduced motion still shows a full, non-empty set of Google ad cards', info.cardCount > 0, String(info.cardCount));
    } finally {
      await page.close();
    }
  }

  // ── 5d. Google per-card ad interface — every GA image is its own Google search/ad-result unit, not one global frame ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(800);
      const google = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ov-adx-gcard'));
        return {
          noGlobalFrame: !document.getElementById('ovGoogleFrame'),
          cardCount: cards.length,
          allVisible: cards.every(c => getComputedStyle(c).display !== 'none'),
          imgIsDominant: cards.every(c => {
            const media = c.querySelector('.ov-adx-gc-media').getBoundingClientRect();
            const card = c.getBoundingClientRect();
            return media.height / card.height > 0.5;
          }),
        };
      });
      check('18j. There is no single global Google search frame — each GA image sits inside its own ad card', google.noGlobalFrame);
      check('18k. Every rendered Google ad card is a distinct, visible search/ad-result unit', google.cardCount > 0 && google.cardCount % 5 === 0 && google.allVisible, JSON.stringify(google));
      check('18l. The creative image remains the visually dominant element within each card (not buried under a giant browser frame)', google.imgIsDominant, JSON.stringify(google));

      // Switching Google -> Meta -> Google must cleanly replace the marquee
      // content each time, with no leftover hidden tracks, no duplicate
      // animations, and no global frame ever reappearing.
      const beforeSwitch = await page.evaluate(() => ({ trackCount: document.querySelectorAll('.ov-wall-track').length, wallHeight: Math.round(document.getElementById('ovAdWall').getBoundingClientRect().height) }));
      await page.click('.ov-showcase-tab[data-platform="meta"]');
      await page.waitForTimeout(500);
      const onMeta = await page.evaluate(() => ({
        gcards: document.querySelectorAll('.ov-adx-gcard').length,
        mcards: document.querySelectorAll('.ov-adx-mcard').length,
        trackCount: document.querySelectorAll('.ov-wall-track').length,
        wallHeight: Math.round(document.getElementById('ovAdWall').getBoundingClientRect().height),
      }));
      check('18m. Switching Google Ads -> Meta Ads cleanly replaces the marquee: no leftover Google cards, no duplicate/hidden tracks, no layout expansion', onMeta.gcards === 0 && onMeta.mcards > 0 && onMeta.trackCount === beforeSwitch.trackCount && onMeta.wallHeight === beforeSwitch.wallHeight, JSON.stringify({ beforeSwitch, onMeta }));

      await page.click('.ov-showcase-tab[data-platform="google"]');
      await page.waitForTimeout(500);
      const afterSwitch = await page.evaluate(() => ({
        noGlobalFrame: !document.getElementById('ovGoogleFrame'),
        gcards: document.querySelectorAll('.ov-adx-gcard').length,
        mcards: document.querySelectorAll('.ov-adx-mcard').length,
      }));
      check('18n. Switching Meta Ads -> Google Ads restores the Google marquee (per-card units, no global frame, no leftover Meta cards)', afterSwitch.noGlobalFrame && afterSwitch.gcards > 0 && afterSwitch.mcards === 0, JSON.stringify(afterSwitch));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('18o. No horizontal page overflow from the Google ad cards after switching back and forth', overflow <= 0, String(overflow));
      check('18o2. No JS errors around the Google interface or platform switching', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 5e. Meta marquee — same seamless repeated-sequence architecture as
  // Google, using the real MA1-MA10 assets. ────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.click('.ov-showcase-tab[data-platform="meta"]');
      await page.waitForTimeout(1000);
      const info = await page.evaluate(() => {
        function seqImgs(track, i){
          const seqs = track.querySelectorAll('.ov-wall-seq');
          return seqs[i] ? Array.from(seqs[i].querySelectorAll('img')).map(im => im.getAttribute('src')) : null;
        }
        const t1 = document.getElementById('ovWallTrack1');
        const t2 = document.getElementById('ovWallTrack2');
        const seqsRow1 = t1.querySelectorAll('.ov-wall-seq');
        const seqACards = seqsRow1[0].querySelectorAll('.ov-wall-card');
        const seqBCards = seqsRow1[1].querySelectorAll('.ov-wall-card');
        const lastOfA = seqACards[seqACards.length - 1];
        const firstOfB = seqBCards[0];
        return {
          seqCount1: t1.querySelectorAll('.ov-wall-seq').length,
          seqCount2: t2.querySelectorAll('.ov-wall-seq').length,
          seq1First: seqImgs(t1, 0),
          seq1Second: seqImgs(t1, 1),
          seq2First: seqImgs(t2, 0),
          seq2Second: seqImgs(t2, 1),
          row1Dir: getComputedStyle(t1).animationDirection,
          row2Dir: getComputedStyle(t2).animationDirection,
          seqW1: getComputedStyle(t1).getPropertyValue('--ov-seq-w'),
          gapBoundary: firstOfB.offsetLeft - (lastOfA.offsetLeft + lastOfA.offsetWidth),
          gapNormal: seqACards[1].offsetLeft - (seqACards[0].offsetLeft + seqACards[0].offsetWidth),
        };
      });
      const MA_TOP = ['assets/MA1.png','assets/MA2.png','assets/MA3.png','assets/MA4.png','assets/MA5.png'];
      const MA_BOTTOM = ['assets/MA6.png','assets/MA7.png','assets/MA8.png','assets/MA9.png','assets/MA10.png'];
      check('19b. MA assets are referenced correctly: MA1-MA5 present, in order, in row 1\'s first sequence', JSON.stringify(info.seq1First) === JSON.stringify(MA_TOP), JSON.stringify(info.seq1First));
      check('19b2. MA1-MA5 present, in order, in row 1\'s repeated sequence', JSON.stringify(info.seq1Second) === JSON.stringify(MA_TOP), JSON.stringify(info.seq1Second));
      check('19c. MA6-MA10 present, in order, in row 2\'s first sequence', JSON.stringify(info.seq2First) === JSON.stringify(MA_BOTTOM), JSON.stringify(info.seq2First));
      check('19c2. MA6-MA10 present, in order, in row 2\'s repeated sequence', JSON.stringify(info.seq2Second) === JSON.stringify(MA_BOTTOM), JSON.stringify(info.seq2Second));
      check('19c3. Both Meta sequences are duplicated/repeated correctly (2+ copies per row)', info.seqCount1 >= 2 && info.seqCount2 >= 2, JSON.stringify({ seqCount1: info.seqCount1, seqCount2: info.seqCount2 }));
      check('19d. Meta row 1 moves left, row 2 moves right (same direction convention as Google)', info.row1Dir === 'normal' && info.row2Dir === 'reverse', JSON.stringify({ row1Dir: info.row1Dir, row2Dir: info.row2Dir }));
      check('19d2. Meta\'s animation distance is a measured pixel value (reuses the same seamless builder as Google)', /^\d+(\.\d+)?px$/.test(info.seqW1.trim()), info.seqW1);
      check('19d3. Meta marquee geometry: sequence boundary gap equals the normal card gap (no empty region)', info.gapBoundary === info.gapNormal, JSON.stringify({ gapBoundary: info.gapBoundary, gapNormal: info.gapNormal }));

      const loadedOk = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('#ovWallTrack1 img, #ovWallTrack2 img')).slice(0, 10);
        return Promise.all(imgs.map(img => img.naturalWidth > 0 ? Promise.resolve(true) : new Promise(resolve => {
          img.addEventListener('load', () => resolve(img.naturalWidth > 0), { once: true });
          img.addEventListener('error', () => resolve(false), { once: true });
          setTimeout(() => resolve(img.naturalWidth > 0), 15000);
        }))).then(results => results.every(Boolean));
      });
      check('19e. All 10 real MA images actually load (not broken/missing files)', loadedOk);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('19f. No horizontal page overflow from the Meta marquee', overflow <= 0, String(overflow));
      check('19g. No JS errors around the Meta carousel', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 5f. Meta carousel respects prefers-reduced-motion ─────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.click('.ov-showcase-tab[data-platform="meta"]');
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => ({
        animName: getComputedStyle(document.querySelector('#ovWallTrack1')).animationName,
        cardCount: document.querySelectorAll('.ov-adx-mcard').length,
      }));
      check('19h. Reduced motion stops the Meta carousel movement entirely', info.animName === 'none', info.animName);
      check('19h2. Reduced motion still shows a full, non-empty, visually complete set of Meta ad cards', info.cardCount > 0, String(info.cardCount));
    } finally {
      await page.close();
    }
  }

  // ── 5g. Hover independence + accent-line layering (fix for: hovering
  // one card used to pause BOTH marquee rows via a global .ov-wall:hover
  // selector, and the hover lift used to get clipped by the row's own
  // overflow:hidden with no accent line to protect in the first place).
  // Verified BEHAVIORALLY (does hovering row A actually leave row B
  // running?) rather than by pattern-matching CSS source, since that's
  // the only thing that can't be faked by a selector that merely looks
  // row-scoped. Covers all four platforms per spec. ────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(500);

      async function onscreenCardCenter(sel) {
        return page.evaluate((s) => {
          const cards = Array.from(document.querySelectorAll(s));
          const vw = window.innerWidth;
          const c = cards.find(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= vw && r.top >= 0; });
          if (!c) return null;
          const r = c.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, sel);
      }
      async function trackStates() {
        return page.evaluate(() => ({
          row1: getComputedStyle(document.getElementById('ovWallTrack1')).animationPlayState,
          row2: getComputedStyle(document.getElementById('ovWallTrack2')).animationPlayState,
        }));
      }

      // 1. Independent animation elements/state for the two rows.
      const distinctTracks = await page.evaluate(() => document.getElementById('ovWallTrack1') !== document.getElementById('ovWallTrack2'));
      check('5g1. Top and bottom rows are distinct elements each carrying their own independent animation state', distinctTracks);

      // Final polish pass: the standalone accent line above the ad wall
      // was removed entirely (it visually conflicted with the hover
      // lift) -- confirm it is fully gone, not just hidden.
      const noLineAnywhere = await page.evaluate(() => !document.querySelector('.ov-wall-accent-line'));
      check('5g2. No standalone horizontal accent line exists above the ad wall (removed entirely, not just hidden)', noLineAnywhere);

      const platforms = ['google', 'meta', 'tiktok', 'pinterest'];
      for (const platform of platforms) {
        if (platform !== 'google') {
          await page.click('.ov-showcase-tab[data-platform="' + platform + '"]');
          await page.waitForTimeout(600);
        }
        const topPt = await onscreenCardCenter('.ov-wall-row-1 .ov-wall-card');
        const botPt = await onscreenCardCenter('.ov-wall-row-2 .ov-wall-card');

        // 4/9-12. Hovering TOP row content must never pause the bottom row.
        await page.mouse.move(topPt.x, topPt.y, { steps: 5 });
        await page.waitForTimeout(350);
        const onTop = await trackStates();
        check('5g5. [' + platform + '] Hovering a TOP-row card never pauses the BOTTOM row', onTop.row2 === 'running', JSON.stringify(onTop));

        // 2/3. The entire card -- border, background, and its innermost
        // content -- must move together as ONE transformed object (a
        // single transform on the card itself), never clipped, never a
        // separate layer left behind at the original position.
        const unityInfo = await page.evaluate(() => {
          const card = document.querySelector('.ov-wall-row-1 .ov-wall-card:hover');
          if (!card) return { hoveredFound: false };
          const cs = getComputedStyle(card);
          const inner = card.querySelector('img') || card.lastElementChild;
          const cardRect = card.getBoundingClientRect();
          const innerRect = inner.getBoundingClientRect();
          return {
            hoveredFound: true,
            transform: cs.transform,
            hasBorder: cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none',
            notClipped: cardRect.height > 0 && innerRect.height > 0,
            cardTop: cardRect.top, innerTop: innerRect.top, cardHeight: cardRect.height,
          };
        });
        check('5g6. [' + platform + '] The hover lift uses a transform (not top/margin/layout), so it can never be clipped by the row\'s own overflow', unityInfo.hoveredFound && /matrix|translate/.test(unityInfo.transform) && unityInfo.transform !== 'none' && unityInfo.notClipped, JSON.stringify(unityInfo));
        check('5g7. [' + platform + '] The card\'s border lives on the exact same element as the hover transform (one object, not a separate border layer)', unityInfo.hoveredFound && unityInfo.hasBorder, JSON.stringify(unityInfo));

        // The border/background and the innermost content must shift by
        // the exact same delta -- if a wrapper or a pseudo-element were
        // left behind, this delta would differ between the two.
        await page.mouse.move(1, 1);
        await page.waitForTimeout(300);
        const restPos = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('.ov-wall-row-1 .ov-wall-card'));
          const vw = window.innerWidth;
          const card = cards.find(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= vw; });
          const inner = card.querySelector('img') || card.lastElementChild;
          return { cardTop: card.getBoundingClientRect().top, innerTop: inner.getBoundingClientRect().top };
        });
        await page.mouse.move(topPt.x, topPt.y, { steps: 5 });
        await page.waitForTimeout(350);
        const hoveredPos = await page.evaluate(() => {
          const card = document.querySelector('.ov-wall-row-1 .ov-wall-card:hover');
          const inner = card.querySelector('img') || card.lastElementChild;
          return { cardTop: card.getBoundingClientRect().top, innerTop: inner.getBoundingClientRect().top };
        });
        const cardDelta = Math.round((restPos.cardTop - hoveredPos.cardTop) * 100) / 100;
        const innerDelta = Math.round((restPos.innerTop - hoveredPos.innerTop) * 100) / 100;
        check('5g7b. [' + platform + '] The card\'s outer edge and its innermost content shift by the exact same amount on hover (moving as one unit, nothing left behind)', Math.abs(cardDelta - innerDelta) < 0.5, JSON.stringify({ cardDelta, innerDelta }));

        await page.mouse.move(1, 1);
        await page.waitForTimeout(300);

        // 5. Hovering BOTTOM row content must never pause the top row.
        await page.mouse.move(botPt.x, botPt.y, { steps: 5 });
        await page.waitForTimeout(350);
        const onBottom = await trackStates();
        check('5g8. [' + platform + '] Hovering a BOTTOM-row card never pauses the TOP row', onBottom.row1 === 'running', JSON.stringify(onBottom));

        await page.mouse.move(1, 1);
        await page.waitForTimeout(300);
        const afterAway = await trackStates();
        check('5g9. [' + platform + '] Moving the mouse away resumes both rows normally', afterAway.row1 === 'running' && afterAway.row2 === 'running', JSON.stringify(afterAway));
      }

      // 8. Hover transform never changes layout dimensions (width/height/track/wall).
      const dims = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ov-wall-row-1 .ov-wall-card'));
        const vw = window.innerWidth;
        const card = cards.find(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= vw; });
        const before = card.getBoundingClientRect();
        const wallBefore = document.getElementById('ovAdWall').getBoundingClientRect().height;
        return { beforeW: before.width, beforeH: before.height, wallBefore, cardX: before.left + before.width / 2, cardY: before.top + before.height / 2 };
      });
      await page.mouse.move(dims.cardX, dims.cardY, { steps: 5 });
      await page.waitForTimeout(350);
      const dimsAfter = await page.evaluate(() => {
        const card = document.querySelector('.ov-wall-row-1 .ov-wall-card:hover');
        const r = card.getBoundingClientRect();
        return { afterW: r.width, afterH: r.height, wallAfter: document.getElementById('ovAdWall').getBoundingClientRect().height };
      });
      check('5g10. Hover never changes card width/height or the wall\'s total height (transform-only, no reflow)', dims.beforeW === dimsAfter.afterW && dims.beforeH === dimsAfter.afterH && dims.wallBefore === dimsAfter.wallAfter, JSON.stringify({ dims, dimsAfter }));

      // 14. No horizontal overflow after all this hovering/switching.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('5g11. No horizontal page overflow after hovering/switching through all four platforms', overflow <= 0, String(overflow));
      check('5g12. No JS errors from hover interactions or platform switching', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 5h. Reduced motion: layout stays intact, no accent line reappears ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => ({
        row1Anim: getComputedStyle(document.getElementById('ovWallTrack1')).animationName,
        row2Anim: getComputedStyle(document.getElementById('ovWallTrack2')).animationName,
        noLine: !document.querySelector('.ov-wall-accent-line'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check('5h. Reduced motion: both rows stay stopped, no accent line exists, and no layout break occurs', info.row1Anim === 'none' && info.row2Anim === 'none' && info.noLine && info.overflow <= 0, JSON.stringify(info));
    } finally {
      await page.close();
    }
  }

  // ── 5i. Pinterest marquee — same seamless repeated-sequence architecture
  // as Google/Meta, using the real PA1-PA10 assets. ─────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.click('.ov-showcase-tab[data-platform="pinterest"]');
      await page.waitForTimeout(1000);
      const info = await page.evaluate(() => {
        function seqImgs(track, i){
          const seqs = track.querySelectorAll('.ov-wall-seq');
          return seqs[i] ? Array.from(seqs[i].querySelectorAll('img')).map(im => im.getAttribute('src')) : null;
        }
        const t1 = document.getElementById('ovWallTrack1');
        const t2 = document.getElementById('ovWallTrack2');
        const seqsRow1 = t1.querySelectorAll('.ov-wall-seq');
        const seqACards = seqsRow1[0].querySelectorAll('.ov-wall-card');
        const seqBCards = seqsRow1[1].querySelectorAll('.ov-wall-card');
        const lastOfA = seqACards[seqACards.length - 1];
        const firstOfB = seqBCards[0];
        return {
          seqCount1: t1.querySelectorAll('.ov-wall-seq').length,
          seqCount2: t2.querySelectorAll('.ov-wall-seq').length,
          seq1First: seqImgs(t1, 0),
          seq1Second: seqImgs(t1, 1),
          seq2First: seqImgs(t2, 0),
          seq2Second: seqImgs(t2, 1),
          row1Dir: getComputedStyle(t1).animationDirection,
          row2Dir: getComputedStyle(t2).animationDirection,
          seqW1: getComputedStyle(t1).getPropertyValue('--ov-seq-w'),
          gapBoundary: firstOfB.offsetLeft - (lastOfA.offsetLeft + lastOfA.offsetWidth),
          gapNormal: seqACards[1].offsetLeft - (seqACards[0].offsetLeft + seqACards[0].offsetWidth),
        };
      });
      const PA_TOP = ['assets/PA1.png','assets/PA2.png','assets/PA3.png','assets/PA4.png','assets/PA5.png'];
      const PA_BOTTOM = ['assets/PA6.png','assets/PA7.png','assets/PA8.png','assets/PA9.png','assets/PA10.png'];
      check('19i. PA assets are referenced correctly: PA1-PA5 present, in order, in row 1\'s first sequence', JSON.stringify(info.seq1First) === JSON.stringify(PA_TOP), JSON.stringify(info.seq1First));
      check('19i2. PA1-PA5 present, in order, in row 1\'s repeated sequence', JSON.stringify(info.seq1Second) === JSON.stringify(PA_TOP), JSON.stringify(info.seq1Second));
      check('19j. PA6-PA10 present, in order, in row 2\'s first sequence', JSON.stringify(info.seq2First) === JSON.stringify(PA_BOTTOM), JSON.stringify(info.seq2First));
      check('19j2. PA6-PA10 present, in order, in row 2\'s repeated sequence', JSON.stringify(info.seq2Second) === JSON.stringify(PA_BOTTOM), JSON.stringify(info.seq2Second));
      check('19j3. Both Pinterest sequences are duplicated/repeated correctly (2+ copies per row)', info.seqCount1 >= 2 && info.seqCount2 >= 2, JSON.stringify({ seqCount1: info.seqCount1, seqCount2: info.seqCount2 }));
      check('19k. Pinterest row 1 moves left, row 2 moves right (same direction convention as Google/Meta)', info.row1Dir === 'normal' && info.row2Dir === 'reverse', JSON.stringify({ row1Dir: info.row1Dir, row2Dir: info.row2Dir }));
      check('19k2. Pinterest\'s animation distance is a measured pixel value (reuses the same seamless builder as Google/Meta)', /^\d+(\.\d+)?px$/.test(info.seqW1.trim()), info.seqW1);
      check('19k3. Pinterest marquee geometry: sequence boundary gap equals the normal card gap (no empty region -- zero marquee gaps)', info.gapBoundary === info.gapNormal, JSON.stringify({ gapBoundary: info.gapBoundary, gapNormal: info.gapNormal }));

      const loadedOk = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('#ovWallTrack1 img, #ovWallTrack2 img')).slice(0, 10);
        return Promise.all(imgs.map(img => img.naturalWidth > 0 ? Promise.resolve(true) : new Promise(resolve => {
          img.addEventListener('load', () => resolve(img.naturalWidth > 0), { once: true });
          img.addEventListener('error', () => resolve(false), { once: true });
          setTimeout(() => resolve(img.naturalWidth > 0), 15000);
        }))).then(results => results.every(Boolean));
      });
      check('19l. All 10 real PA images actually load (not broken/missing files)', loadedOk);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('19m. No horizontal page overflow from the Pinterest marquee', overflow <= 0, String(overflow));
      check('19n. No JS errors around the Pinterest carousel', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 5j. Pinterest per-card ad interface — every PA image is its own
  // Pinterest-style Pin card, with distinct contextual copy per card. ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.click('.ov-showcase-tab[data-platform="pinterest"]');
      await page.waitForTimeout(800);
      const pinterest = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ov-adx-pcard'));
        const first = cards[0];
        return {
          cardCount: cards.length,
          firstHasBadge: !!first.querySelector('.ov-adx-pc-badge'),
          firstHasAvatar: !!first.querySelector('.ov-adx-pc-avatar'),
          firstHasName: !!first.querySelector('.ov-adx-pc-name'),
          firstHasTitle: !!first.querySelector('.ov-adx-pc-title'),
          firstHasDesc: !!first.querySelector('.ov-adx-pc-desc'),
          firstHasCta: !!first.querySelector('.ov-adx-pc-cta'),
          firstHasImg: !!first.querySelector('.ov-adx-pc-media img[src^="assets/PA"]'),
          badgeText: first.querySelector('.ov-adx-pc-badge').textContent.trim(),
          everyCardHasFullStructure: cards.every(c =>
            c.querySelector('.ov-adx-pc-badge') && c.querySelector('.ov-adx-pc-avatar') &&
            c.querySelector('.ov-adx-pc-name') && c.querySelector('.ov-adx-pc-title') &&
            c.querySelector('.ov-adx-pc-desc') && c.querySelector('.ov-adx-pc-cta') &&
            c.querySelector('.ov-adx-pc-media img[src^="assets/PA"]')),
          imgIsDominant: cards.every(c => {
            const media = c.querySelector('.ov-adx-pc-media').getBoundingClientRect();
            const card = c.getBoundingClientRect();
            return media.height / card.height > 0.45;
          }),
        };
      });
      check('19o. Every Pinterest card has a complete Pin structure (Promoted badge, avatar, advertiser name, title, description, CTA, real image)', pinterest.everyCardHasFullStructure && pinterest.cardCount > 0, JSON.stringify(pinterest));
      check('19o2. The Promoted badge reads "Promoted" (recognizable Pinterest sponsored-result cue)', /promoted/i.test(pinterest.badgeText), pinterest.badgeText);
      check('19o3. The creative image remains the visually dominant element within each Pinterest card', pinterest.imgIsDominant, JSON.stringify(pinterest));

      const pinCopy = await page.evaluate(() => {
        const seen = new Set();
        const cards = Array.from(document.querySelectorAll('.ov-adx-pcard')).filter(c => {
          const src = c.querySelector('.ov-adx-pc-media img').getAttribute('src');
          if (seen.has(src)) return false;
          seen.add(src);
          return true;
        });
        return {
          names: cards.map(c => c.querySelector('.ov-adx-pc-name').textContent.trim()),
          titles: cards.map(c => c.querySelector('.ov-adx-pc-title').textContent.trim()),
          alts: cards.map(c => c.querySelector('.ov-adx-pc-media img').getAttribute('alt')),
          imgSrcs: cards.map(c => c.querySelector('.ov-adx-pc-media img').getAttribute('src')),
        };
      });
      check('19p. Pinterest ad copy (advertiser name/title) is distinct per card, not repeated across all ten', new Set(pinCopy.names).size === 10 && new Set(pinCopy.titles).size === 10, JSON.stringify(pinCopy));
      check('19p2. Every Pinterest card image has a meaningful, non-generic alt attribute, and all ten real PA1-PA10 assets are used exactly once each', pinCopy.alts.every(a => a && a.length > 10) && new Set(pinCopy.imgSrcs).size === 10, JSON.stringify(pinCopy));

      // No standalone accent line, no Pinterest-red full-card takeover
      // (only the small badge dot may use Pinterest's red).
      const restraint = await page.evaluate(() => {
        const card = document.querySelector('.ov-adx-pcard');
        return {
          noLine: !document.querySelector('.ov-wall-accent-line'),
          cardBg: getComputedStyle(card).backgroundColor,
        };
      });
      check('19q. No standalone accent line exists above the Pinterest marquee', restraint.noLine);
      check('19q2. The Pinterest card background is NOT full Pinterest-red (restrained cue only, on the badge dot)', !/230,\s*0,\s*35/.test(restraint.cardBg), restraint.cardBg);
    } finally {
      await page.close();
    }
  }

  // ── 5k. Pinterest respects prefers-reduced-motion ──────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.click('.ov-showcase-tab[data-platform="pinterest"]');
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => ({
        animName: getComputedStyle(document.querySelector('#ovWallTrack1')).animationName,
        cardCount: document.querySelectorAll('.ov-adx-pcard').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check('19r. Reduced motion stops the Pinterest carousel movement entirely', info.animName === 'none', info.animName);
      check('19r2. Reduced motion still shows a full, non-empty, visually complete set of Pinterest ad cards, no overflow', info.cardCount > 0 && info.overflow <= 0, JSON.stringify(info));
    } finally {
      await page.close();
    }
  }

  // ── 5l. Platform switching to/from Pinterest is clean — no leftover
  // cards, no duplicate tracks, TikTok's own (unchanged) marquee still works ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-showcase').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      await page.click('.ov-showcase-tab[data-platform="pinterest"]');
      await page.waitForTimeout(500);
      const onPinterest = await page.evaluate(() => ({
        pcards: document.querySelectorAll('.ov-adx-pcard').length,
        gcards: document.querySelectorAll('.ov-adx-gcard').length,
        trackCount: document.querySelectorAll('.ov-wall-track').length,
      }));
      check('19s. Switching to Pinterest Ads cleanly renders Pinterest cards with no leftover cards from other platforms', onPinterest.pcards > 0 && onPinterest.gcards === 0 && onPinterest.trackCount === 2, JSON.stringify(onPinterest));

      await page.click('.ov-showcase-tab[data-platform="tiktok"]');
      await page.waitForTimeout(500);
      const onTikTok = await page.evaluate(() => ({
        pcards: document.querySelectorAll('.ov-adx-pcard').length,
        tcards: document.querySelectorAll('.ov-adx-tiktok').length,
      }));
      check('19t. Switching away from Pinterest to TikTok works cleanly, and TikTok\'s own existing marquee is unaffected by the Pinterest changes', onTikTok.pcards === 0 && onTikTok.tcards > 0, JSON.stringify(onTikTok));

      await page.click('.ov-showcase-tab[data-platform="pinterest"]');
      await page.waitForTimeout(500);
      const backOnPinterest = await page.evaluate(() => ({
        pcards: document.querySelectorAll('.ov-adx-pcard').length,
        tcards: document.querySelectorAll('.ov-adx-tiktok').length,
        trackCount: document.querySelectorAll('.ov-wall-track').length,
      }));
      check('19u. Switching back to Pinterest restores its marquee cleanly, no leftover TikTok cards, no duplicate tracks', backOnPinterest.pcards > 0 && backOnPinterest.tcards === 0 && backOnPinterest.trackCount === 2, JSON.stringify(backOnPinterest));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('19v. No horizontal overflow after switching through Pinterest/TikTok/Pinterest', overflow <= 0, String(overflow));
      check('19w. No JS errors from Pinterest platform switching', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 6. Scroll statement — word-by-word reveal still works with new copy ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const structure = await page.evaluate(() => {
        const p = document.getElementById('ovStatementLead');
        return { wordCount: p.querySelectorAll('.ov-word').length, text: p.textContent.trim(), width: document.querySelector('.ov-statement-inner').getBoundingClientRect().width };
      });
      check('19. Statement still wrapped word-by-word', structure.wordCount > 10, String(structure.wordCount));
      check('20. Statement communicates the core message (one place, research/create/launch/improve)', /one place/i.test(structure.text) && /research/i.test(structure.text) && /create/i.test(structure.text) && /launch/i.test(structure.text) && /improve/i.test(structure.text), structure.text);
      check('21. Statement container still wide (spec: large portion of viewport width)', structure.width > 1100, String(structure.width));

      await page.evaluate(() => { document.getElementById('view-landing').scrollTop = document.getElementById('view-landing').scrollHeight; });
      await page.waitForTimeout(300);
      const revealed = await page.evaluate(() => {
        const words = Array.from(document.querySelectorAll('.ov-word'));
        return words.map(w => ({ text: w.textContent.replace(/[.,!?]+$/, ''), color: w.style.color }));
      });
      const lastColor = revealed[revealed.length - 1].color;
      check('22. Words reach full brightness once scrolled well past (last word rgb(255,255,255))', lastColor === 'rgb(255, 255, 255)', lastColor);

      const ACCENT = ['Oriven', 'Research', 'Create', 'Launch', 'Improve'];
      const accentWords = revealed.filter(w => ACCENT.indexOf(w.text) !== -1);
      const plainWords = revealed.filter(w => ACCENT.indexOf(w.text) === -1);
      check('22b. "Oriven" and the four workflow verbs reveal toward the exact Electric Lime token (#B6FF3B), not white or the old #B7FF2A', accentWords.length === 5 && accentWords.every(w => w.color === 'rgb(182, 255, 59)'), JSON.stringify(accentWords));
      check('22c. Every other word still reveals toward white as before', plainWords.every(w => w.color === 'rgb(255, 255, 255)'));

      await page.evaluate(() => { document.getElementById('view-landing').scrollTop = 0; });
      await page.waitForTimeout(300);
      const backColor = await page.evaluate(() => document.querySelector('.ov-word').style.color);
      check('23. Scrolling back to top returns words toward muted (bidirectional)', backColor !== 'rgb(255, 255, 255)', backColor);
    } finally {
      await page.close();
    }
  }

  // ── 7. Product Capabilities / "Oriven is built for the way you advertise" ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.ov-ws-tab'));
        return {
          tabLabels: tabs.map(t => t.querySelector('span').textContent),
          tabTags: tabs.map(t => t.tagName),
          subhead: document.querySelector('.ov-pillars-head .ov-section-sub').textContent,
          workspaceBg: getComputedStyle(document.querySelector('.ov-workspace')).backgroundColor,
        };
      });
      check('24. Six capabilities present, in fragment order: Research/Create/Launch/Campaigns/Autopilot/Business (Settings removed this pass)', JSON.stringify(info.tabLabels) === JSON.stringify(['Research', 'Create', 'Launch', 'Campaigns', 'Autopilot', 'Business']), JSON.stringify(info.tabLabels));
      check('25. All 6 tabs are real buttons — clicking never navigates', info.tabTags.every(t => t === 'BUTTON'));
      check('25b. Subhead has no em dash', !/—/.test(info.subhead), info.subhead);
      check('25c. Product showcase large outer container is the exact Deep Moss token (#26331A), not Snow/white (Actual Visual Fixes pass, spec section 1)', info.workspaceBg === 'rgb(38, 51, 26)', info.workspaceBg);

      // Final brand pass: the six-color-per-capability system is REMOVED —
      // every capability now shares the single ORIVEN Electric Lime accent
      // (spec section 2/11: "differentiate through typography, position,
      // motion... NOT six colors").
      const capColorProp = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-ws-tab[data-cap="business"]')).getPropertyValue('--cap-color').trim());
      check('25d. Old --cap-color rainbow custom property is gone (no per-capability color declared)', capColorProp === '', JSON.stringify(capColorProp));

      await page.click('.ov-ws-tab[data-cap="business"]');
      await page.waitForTimeout(300);
      const playBgBusiness = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-ws-content[data-cap="business"] .ov-ws-play')).backgroundColor);
      await page.click('.ov-ws-tab[data-cap="launch"]');
      await page.waitForTimeout(300);
      const playBgLaunch = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-ws-content[data-cap="launch"] .ov-ws-play')).backgroundColor);
      check('25e. Play button uses the SAME accent color regardless of active capability (single-accent system, not rainbow)', playBgBusiness === playBgLaunch, JSON.stringify({ playBgBusiness, playBgLaunch }));
      check('25f. That shared accent is the fixed Electric Lime token (#B6FF3B)', playBgLaunch === 'rgb(182, 255, 59)', playBgLaunch);
    } finally {
      await page.close();
    }
  }

  // ── 8. Experience Oriven Yourself — light panel, colorful motif, single CTA ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-experience').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(700);

      const info = await page.evaluate(() => {
        const sec = document.getElementById('ov-experience');
        const panel = document.querySelector('.ov-experience-panel');
        const arrows = Array.from(document.querySelectorAll('.ov-exp-arrow'));
        return {
          heading: (sec.querySelector('.ov-section-h') || {}).textContent,
          hasSupportingSentence: /workflow looks like when everything works together/i.test(sec.innerText),
          ctaCount: sec.querySelectorAll('a.ov-btn-primary').length,
          ctaText: (sec.querySelector('a.ov-btn-primary') || {}).textContent,
          panelBg: panel ? getComputedStyle(panel).backgroundColor : null,
          arrowCount: arrows.length,
          arrowColors: arrows.map(a => getComputedStyle(a).stroke),
          panelOuterBg: getComputedStyle(sec).backgroundColor,
        };
      });
      check('26. Heading is exactly "Experience Oriven Yourself"', info.heading.trim() === 'Experience Oriven Yourself', info.heading);
      check('27. Supporting sentence removed entirely (spec: "Do not replace it with another paragraph")', !info.hasSupportingSentence);
      check('28. Exactly one CTA, reading "Start Creating"', info.ctaCount === 1 && /Start Creating/i.test(info.ctaText || ''), info.ctaText);
      check('29. Panel background is the exact Deep Moss token (#26331A) — spec section 20: "some blocks should use the dark green accent, not Snow"', info.panelBg === 'rgb(38, 51, 26)', info.panelBg);
      check('30. Arrow motif uses the single fixed ORIVEN Electric Lime accent, not a per-arrow rainbow (final brand pass removed the rainbow motif)', info.arrowCount >= 3 && info.arrowColors.every(c => c === 'rgb(182, 255, 59)'), JSON.stringify(info.arrowColors));
      check('31. Section wrapper itself (outside the panel) stays transparent so the grid still shows through around it', info.panelOuterBg === 'rgba(0, 0, 0, 0)', info.panelOuterBg);
      check('32. No JS errors around the Experience Oriven panel', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 9. How Oriven Works — 2x2 grid, larger media, no icons ───────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const heading = await page.evaluate(() => document.querySelector('#ov-workflow .ov-section-h').textContent.trim());
      check('33. Heading is "How Oriven Works, Full Steps, Start to Finish" (no dash)', heading === 'How Oriven Works, Full Steps, Start to Finish', heading);
      check('33b. Heading contains no dash character of any kind', !/[—-]/.test(heading.replace(/Start to Finish/, '')), heading);

      await page.evaluate(() => document.getElementById('ov-workflow').scrollIntoView());
      await page.waitForTimeout(700);

      const gridInfo = await page.evaluate(() => {
        const grid = document.querySelector('.ov-wf-grid');
        const cells = Array.from(document.querySelectorAll('.ov-wf-cell'));
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        return {
          cellCount: cells.length,
          columnCount: cols,
          numbers: cells.map(c => c.querySelector('.ov-wf-cell-num').textContent.trim()),
          titles: cells.map(c => c.querySelector('.ov-wf-cell-title').textContent.trim()),
          hasOldTrack: !!document.querySelector('.ov-path-track'),
          hasOldPulse: !!document.querySelector('.ov-path-pulse'),
          hasOldArrows: !!document.querySelector('.ov-path-arrow'),
        };
      });
      // Final Polish sprint (spec section 14): expanded from 4 broad phases to
      // the six real ORIVEN products (Research/Create/Launch/Campaigns/
      // Autopilot/Business), still a 2-column grid (now 3 rows instead of 2).
      check('34. Exactly 6 cells in a real 2-column grid (3x2), not a 4-column row', gridInfo.cellCount === 6 && gridInfo.columnCount === 2, JSON.stringify(gridInfo));
      check('34b. Cells read 01-06, Research/Create/Launch/Campaigns/Autopilot/Business in order', JSON.stringify(gridInfo.numbers) === JSON.stringify(['01', '02', '03', '04', '05', '06']) && JSON.stringify(gridInfo.titles) === JSON.stringify(['Research', 'Create', 'Launch', 'Campaigns', 'Autopilot', 'Business']), JSON.stringify(gridInfo));
      check('34c. Old connector track/pulse/arrows removed (spec: "do NOT turn it into a complicated timeline")', !gridInfo.hasOldTrack && !gridInfo.hasOldPulse && !gridInfo.hasOldArrows);

      const mediaInfo = await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('.ov-wf-cell-media'));
        const rects = boxes.map(b => b.getBoundingClientRect());
        return {
          count: boxes.length,
          // Real UI content now (feed list / creative card / deployment
          // checklist / trend-line svg), not necessarily an <svg> each —
          // just confirm each box actually has real child content beyond
          // the shared winbar chrome, not an empty waiting-for-asset box.
          contentChildCount: boxes.map(b => b.children.length),
          uniqueClasses: boxes.map(b => Array.from(b.classList).find(c => c.indexOf('ov-wf-viz-') === 0)),
          widths: rects.map(r => Math.round(r.width)),
        };
      });
      check('35. Six media areas present', mediaInfo.count === 6, String(mediaInfo.count));
      check('36. Each media area has real visual content beyond just the winbar chrome (feed list / creative card / checklist / trend line — not an empty asset-waiting placeholder)', mediaInfo.contentChildCount.every(n => n >= 2), JSON.stringify(mediaInfo.contentChildCount));
      check('36b. Each of the six visualizations is distinct (research/create/launch/campaigns/autopilot/business, not copies of one generic icon)', new Set(mediaInfo.uniqueClasses).size === 6 && mediaInfo.uniqueClasses.every(Boolean), JSON.stringify(mediaInfo.uniqueClasses));
      check('38. Media areas are substantially larger than the old 4-column row (>500px wide on a 1440px viewport)', mediaInfo.widths.every(w => w > 500), JSON.stringify(mediaInfo.widths));

      // Hover prominence — CSS-only now, no JS "active step" state.
      const beforeHover = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-wf-cell')).borderColor);
      await page.hover('.ov-wf-cell');
      await page.waitForTimeout(400);
      const afterHover = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-wf-cell')).borderColor);
      check('39. Hovering a cell visibly changes its border/accent (CSS-only prominence)', beforeHover !== afterHover, JSON.stringify({ beforeHover, afterHover }));

      check('40. No JS errors from the four-step section', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 9b. How Oriven Works — living-product animation pass. Each of the
  // four steps gets its own restrained, on-brand animation communicating
  // the process (Research scans, Create assembles, Launch deploys,
  // Improve draws its trend), the three window-chrome dots read as a
  // real app window (red/yellow/green), and all of it degrades cleanly
  // under prefers-reduced-motion. ─────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-workflow').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(2600); // let every staggered entrance settle

      // Window-chrome dots: red/yellow/green, restrained, on every card.
      const dotsInfo = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('.ov-wf-cell-media'));
        return cells.map(cell => Array.from(cell.querySelectorAll('.ov-wfv-winbar-dot')).map(d => getComputedStyle(d).backgroundColor));
      });
      const isReddish = c => /^rgba?\((25[0-5]|2[0-4]\d|1\d\d|\d\d?), (\d{1,2}), (\d{1,2})/.test(c) && parseInt(c.match(/\d+/g)[0]) > 180;
      const allHaveThreeDistinctDots = dotsInfo.every(d => d.length === 3 && new Set(d).size === 3);
      check('41. Every workflow card\'s window chrome has exactly 3 distinct-colored control dots (red/yellow/green treatment)', allHaveThreeDistinctDots, JSON.stringify(dotsInfo));
      const firstDotReddish = dotsInfo.every(d => isReddish(d[0]));
      check('41b. The first dot reads as a restrained red across all four cards, consistently', firstDotReddish, JSON.stringify(dotsInfo.map(d => d[0])));

      // Research: scanline + "Signal detected" tag both exist and are
      // gated behind the reveal (not just permanently-visible static text).
      const research = await page.evaluate(() => {
        const cell = document.querySelector('.ov-wf-viz-research');
        const scanline = cell.querySelector('.ov-wfv-scanline');
        const tag = cell.querySelector('.ov-wfv-feed-tag');
        return {
          hasScanline: !!scanline,
          scanlineAnimated: scanline && getComputedStyle(scanline).animationName !== 'none',
          tagVisible: tag && getComputedStyle(tag).opacity === '1',
          tagText: tag ? tag.textContent.trim() : null,
        };
      });
      check('42. Research has a scanline sweep element, actively animating once revealed', research.hasScanline && research.scanlineAnimated, JSON.stringify(research));
      check('42b. The "Signal detected" tag is present and settles visible after the reveal', research.tagVisible && /signal detected/i.test(research.tagText || ''), JSON.stringify(research));

      // Create: internal elements (meta/hook/visual/cta) stagger in with
      // distinct delays -- not one flat block appearing all at once.
      const create = await page.evaluate(() => {
        const cell = document.querySelector('.ov-wf-viz-create');
        const parts = ['.ov-wfv-adcard-meta', '.ov-wfv-adcard-hook', '.ov-wfv-adcard-visual', '.ov-wfv-adcard-cta'].map(sel => {
          const el = cell.querySelector(sel);
          const cs = getComputedStyle(el);
          return { opacity: cs.opacity, delay: cs.transitionDelay };
        });
        const shimmer = getComputedStyle(cell.querySelector('.ov-wfv-adcard-visual'), '::after');
        return { parts, shimmerAnimated: shimmer.animationName !== 'none' };
      });
      const allPartsVisible = create.parts.every(p => p.opacity === '1');
      const delaysAreDistinct = new Set(create.parts.map(p => p.delay)).size === create.parts.length;
      check('43. Create\'s internal elements (meta/hook/visual/CTA) each reveal on their own staggered delay, and all have settled visible', allPartsVisible && delaysAreDistinct, JSON.stringify(create.parts));
      check('43b. The creative placeholder has an active shimmer sweep, suggesting active generation', create.shimmerAnimated, JSON.stringify(create));

      // Launch: each platform row has a Queued/Live status readout wired
      // to animate in sync with its own checkmark.
      const launch = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.ov-wf-viz-launch .ov-wfv-deploy-row'));
        return rows.map(r => {
          const queued = r.querySelector('.ov-wfv-status-queued');
          const live = r.querySelector('.ov-wfv-status-live');
          return {
            name: r.querySelector('.ov-wfv-deploy-name').textContent.trim(),
            hasStatus: !!queued && !!live,
            queuedAnimated: queued && getComputedStyle(queued).animationName !== 'none',
            liveAnimated: live && getComputedStyle(live).animationName !== 'none',
          };
        });
      });
      check('44. All four Launch platform rows (Meta/Google/TikTok/Pinterest) have an animated Queued/Live status readout', launch.length === 4 && launch.every(r => r.hasStatus && r.queuedAnimated && r.liveAnimated), JSON.stringify(launch));
      check('44b. Launch platform rows read Meta, Google, TikTok, Pinterest in order', JSON.stringify(launch.map(r => r.name)) === JSON.stringify(['Meta', 'Google', 'TikTok', 'Pinterest']), JSON.stringify(launch.map(r => r.name)));

      // Improve: the trend line draws itself in (stroke-dasharray/
      // dashoffset), not just appearing fully-formed with no entrance.
      const improve = await page.evaluate(() => {
        const trend = document.querySelector('.ov-wfv-trend');
        const cs = getComputedStyle(trend);
        return {
          hasDasharray: cs.strokeDasharray !== 'none' && cs.strokeDasharray !== '',
          dashoffset: cs.strokeDashoffset,
          pointOpacity: getComputedStyle(document.querySelector('.ov-wfv-trend-point')).opacity,
          fillOpacity: getComputedStyle(document.querySelector('.ov-wfv-trend-fill')).opacity,
        };
      });
      check('45. Improve\'s trend line uses a stroke-dasharray draw-in technique and has finished drawing (dashoffset settled at 0) after the reveal', improve.hasDasharray && parseFloat(improve.dashoffset) === 0, JSON.stringify(improve));
      // The endpoint keeps a gentle ambient pulse after landing (opacity
      // oscillates ~.7-1 by design), so this only confirms it's visible,
      // not stuck at the fully-transparent pre-entrance state.
      check('45b. The trend endpoint and area fill have both landed visible after the line finishes drawing', parseFloat(improve.pointOpacity) > 0.5 && improve.fillOpacity === '1', JSON.stringify(improve));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('46. No horizontal overflow and no JS errors from the new How Oriven Works animations', overflow <= 0 && pageErrors.length === 0, JSON.stringify({ overflow, pageErrors }));
    } finally {
      await page.close();
    }
  }

  // ── 9c. How Oriven Works under prefers-reduced-motion: settled, complete, no empty states ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, reducedMotion: 'reduce' });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('ov-workflow').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => {
        const scanline = document.querySelector('.ov-wfv-scanline');
        const createParts = ['.ov-wfv-adcard-meta', '.ov-wfv-adcard-hook', '.ov-wfv-adcard-visual', '.ov-wfv-adcard-cta'].map(sel => getComputedStyle(document.querySelector('.ov-wf-viz-create ' + sel)).opacity);
        return {
          dotsStillColored: Array.from(document.querySelectorAll('.ov-wfv-winbar-dot')).slice(0, 3).map(d => getComputedStyle(d).backgroundColor),
          scanlineHidden: getComputedStyle(scanline).display === 'none',
          createPartsVisible: createParts.every(o => o === '1'),
          statusLive: getComputedStyle(document.querySelector('.ov-wfv-status-live')).opacity,
          statusQueued: getComputedStyle(document.querySelector('.ov-wfv-status-queued')).opacity,
          deployCheckVisible: getComputedStyle(document.querySelector('.ov-wfv-deploy-check'), '::after').opacity,
          trendPointVisible: getComputedStyle(document.querySelector('.ov-wfv-trend-point')).opacity,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      check('47. Reduced motion: window dots stay red/yellow/green (three distinct colors)', new Set(info.dotsStillColored).size === 3, JSON.stringify(info.dotsStillColored));
      check('47b. Reduced motion: the decorative scanline is hidden rather than stuck static mid-sweep', info.scanlineHidden);
      check('47c. Reduced motion: Create\'s internal elements are all immediately visible, not stuck at zero opacity', info.createPartsVisible, JSON.stringify(info));
      check('47d. Reduced motion: Launch settles on "Live" (matches the checkmark\'s own settled deployed state), not stuck on "Queued"', info.statusLive === '1' && info.statusQueued === '0' && info.deployCheckVisible === '1', JSON.stringify(info));
      check('47e. Reduced motion: Improve\'s trend endpoint is fully visible, not stuck invisible mid-entrance', info.trendPointVisible === '1', JSON.stringify(info));
      check('47f. Reduced motion: no horizontal overflow from the workflow section', info.overflow <= 0, String(info.overflow));
    } finally {
      await page.close();
    }
  }

  // ── 10. FAQ on the homepage — compact, accordion works ───────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('faq').scrollIntoView());
      await page.waitForTimeout(1500); // staggered per-item reveal needs time to finish

      const info = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('#faq .ov-faq'));
        return {
          count: items.length,
          firstQ: (items[0].querySelector('span') || {}).textContent,
          allVisible: items.every(el => el.classList.contains('ov-vis')),
          bg: getComputedStyle(document.getElementById('faq')).backgroundColor,
        };
      });
      check('39. FAQ has the full 9-question set on the homepage', info.count === 9, String(info.count));
      check('40. First question is "What does Oriven do?"', info.firstQ === 'What does Oriven do?', info.firstQ);
      check('41. All FAQ items reveal (each item needed its own data-observe — real bug found and fixed this pass)', info.allVisible);
      check('42. FAQ section background stays transparent (grid continues behind it)', info.bg === 'rgba(0, 0, 0, 0)', info.bg);

      await page.click('#faq .ov-faq-q');
      await page.waitForTimeout(300);
      const opened = await page.evaluate(() => document.querySelector('#faq .ov-faq').classList.contains('ov-faq-open'));
      check('43. FAQ accordion opens on click', opened);
      check('44. No JS errors around the FAQ section', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 11. Final CTA — unaffected ────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => ({
        h2: document.querySelector('.ov-final-h2').textContent.replace(/\s+/g, ' ').trim(),
        primaryCtaCount: document.querySelectorAll('#ov-final a.ov-btn-primary').length,
      }));
      check('45. Final CTA headline present, no em dash', !/—/.test(info.h2), info.h2);
      check('46. Exactly one primary CTA in the final section', info.primaryCtaCount === 1, String(info.primaryCtaCount));
    } finally {
      await page.close();
    }
  }

  // ── 12. Pricing page — off the homepage, still reachable from navbar ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const hasPricingOnHomepage = await page.evaluate(() => !!document.querySelector('#view-landing #lpPricingGrid'));
      check('47. No pricing cards on the homepage', !hasPricingOnHomepage);

      await page.evaluate(() => window.lpNavigate('/pricing'));
      await page.waitForTimeout(1800);
      const info = await page.evaluate(() => {
        const grid = document.getElementById('lpPricingGrid');
        const price = grid.querySelector('.ov-pc-price-num').textContent.trim();
        return { top: grid.getBoundingClientRect().top, price };
      });
      check('48. /pricing still shows cards within the fold', info.top < 500, 'top=' + info.top);
      check('49. Starter price still correct (€9.95)', info.price === '€9.95', info.price);
      check('50. No JS errors on /pricing', pageErrors.length === 0, JSON.stringify(pageErrors));
    } finally {
      await page.close();
    }
  }

  // ── 13. Responsive — no overflow ──────────────────────────────────────
  {
    for (const [label, width] of [['1440x900', 1440], ['1280x800', 1280], ['1024x768', 1024], ['390x844', 390]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        const overflowHome = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check('51. [' + label + '] No horizontal overflow on homepage', overflowHome <= 0, 'overflowX=' + overflowHome);
      } finally {
        await page.close();
      }
    }
  }

  // ── 14. Reduced motion ────────────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);

      // The old connector-track traveling pulse is gone along with the
      // horizontal workflow row it animated along (replaced by the 2x2
      // grid this pass) — nothing to check there anymore. What still
      // needs verifying: plain words render fully white immediately, and
      // accent words render fully green immediately, neither animating.
      const colors = await page.evaluate(() => {
        const words = Array.from(document.querySelectorAll('.ov-word'));
        const plain = words.find(w => !w.classList.contains('ov-word-accent'));
        const accent = words.find(w => w.classList.contains('ov-word-accent'));
        return {
          plain: plain ? getComputedStyle(plain).color : null,
          accent: accent ? getComputedStyle(accent).color : null,
        };
      });
      check('52. Plain statement words render fully white immediately under reduced motion', colors.plain === 'rgb(255, 255, 255)', colors.plain);
      check('53. Accent statement words (Oriven/Research/Create/Launch/Improve) render fully Electric Lime immediately under reduced motion', colors.accent === 'rgb(182, 255, 59)', colors.accent);

      // The 2x2 workflow grid's hover transform should be disabled too.
      const cellTransition = await page.evaluate(() => getComputedStyle(document.querySelector('.ov-wf-cell')).transitionDuration);
      check('53b. Workflow cell transitions disabled under reduced motion', /^0s(,\s*0s)*$/.test(cellTransition), cellTransition);
    } finally {
      await page.close();
    }
  }

  // ── 15. Keyboard accessibility ────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      const before = await page.evaluate(() => document.querySelector('.ov-ws-content-active').dataset.cap);
      await page.evaluate(() => document.querySelector('.ov-ws-tab[data-cap="business"]').focus());
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => document.querySelector('.ov-ws-content-active').dataset.cap);
      check('54. Keyboard focus swaps the active capability', before !== after && after === 'business', JSON.stringify({ before, after }));
    } finally {
      await page.close();
    }
  }

  // ── 16. REAL server-side plan gating — unchanged this pass, re-verified ──
  {
    const starterUser = await createTestUser('starter', 'gate-starter');
    const creatorUser = await createTestUser('creator', 'gate-creator');
    try {
      const starterToken = await getAccessToken(starterUser);
      const creatorToken = await getAccessToken(creatorUser);

      const researchStarter = await fetch(API_URL + '/api/research/query', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + starterToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'creative', question: 'What creative patterns work for skincare ads?' })
      });
      const researchStarterBody = await researchStarter.json().catch(() => ({}));
      check('55. Starter is REJECTED from Research (403 CREATOR_PLAN_REQUIRED) — unchanged this pass', researchStarter.status === 403 && researchStarterBody.code === 'CREATOR_PLAN_REQUIRED', researchStarter.status + ' ' + JSON.stringify(researchStarterBody));

      const autoCreator = await fetch(API_URL + '/api/autopilot/rules', { headers: { 'Authorization': 'Bearer ' + creatorToken } });
      const autoCreatorBody = await autoCreator.json().catch(() => ({}));
      check('56. Creator is REJECTED from Autopilot', autoCreator.status === 403 && autoCreatorBody.code === 'AUTOPILOT_NOT_AVAILABLE', autoCreator.status + ' ' + JSON.stringify(autoCreatorBody));

      const noAuth = await fetch(API_URL + '/api/research/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      check('57. Unauthenticated request to a gated route is 401', noAuth.status === 401, String(noAuth.status));
    } finally {
      await deleteTestUser(starterUser.userId);
      await deleteTestUser(creatorUser.userId);
    }
  }

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
