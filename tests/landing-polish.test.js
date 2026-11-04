/* ════════════════════════════════════════════════════════════════
   Landing and pricing polish — regression checks for the final visual pass:
   pricing cards (three benefits, VAT line under the credits, no page-wide
   statement), the pricing header's shared dot field, "Scroll to top" in the
   shared footer, the navbar logo hover (the hero ring's short turn and
   spread, not a long sweep), the hero (no badge, no pricing line, "Show how
   it works"), the problem section's scroll-triggered sequence, the two
   removed workflow sentences and the dev disclaimer, and the assistants'
   illustrative backstories.

   SAFE: static server on :8899 only; tests/_fence.js aborts every other
   request before it leaves the browser. No account, no API, no Supabase.
   RUN: node tests/landing-polish.test.js  (static server on :8899)
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 400) : '')); }
}
const HIDE = '.orv-cc{display:none!important}';
// rotation in degrees from a computed transform matrix
const ROT = 'function(t){ if(!t || t === "none") return 0; var m = t.match(/matrix\\(([^)]+)\\)/); if(!m) return 0; var v = m[1].split(",").map(Number); return Math.round(Math.atan2(v[1], v[0]) * 180 / Math.PI); }';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  require('./_fence').fenceBrowser(browser, BASE, { backend401: true });
  const errors = [];
  const open = async (path, opts) => {
    const page = await browser.newPage(Object.assign({ viewport: { width: 1440, height: 900 } }, opts || {}));
    page.on('pageerror', (e) => errors.push(path + ': ' + e.message));
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(500);
    return page;
  };

  // ── 1. Pricing ────────────────────────────────────────────────────
  console.log('\n1. Pricing page');
  let page = await open('/pricing.html');
  const pr = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll('#lpPricingGrid .ov-pc')).map((c) => ({
      order: Array.from(c.children).map((x) => x.className.split(' ')[0]),
      facts: Array.from(c.querySelectorAll('.ov-pc-facts > p')).map((p) => p.className),
      vat: (c.querySelector('.ov-pc-vat') || {}).textContent,
      vatAfterCredits: !!(c.querySelector('.ov-pc-credits') && c.querySelector('.ov-pc-credits').nextElementSibling === c.querySelector('.ov-pc-vat')),
      benefits: Array.from(c.querySelectorAll('.ov-pc-benefits li')).map((l) => l.textContent),
      duration: (c.querySelector('.ov-pc-duration') || {}).textContent, credits: (c.querySelector('.ov-pc-credits') || {}).textContent,
      vatSize: parseFloat(getComputedStyle(c.querySelector('.ov-pc-vat')).fontSize), priceSize: parseFloat(getComputedStyle(c.querySelector('.ov-pc-price')).fontSize),
      top: { name: c.querySelector('.ov-pc-tier').getBoundingClientRect().top, price: c.querySelector('.ov-pc-price').getBoundingClientRect().top, list: c.querySelector('.ov-pc-benefits').getBoundingClientRect().top, btn: c.querySelector('.ov-pc-btn').getBoundingClientRect().top },
    })),
    text: document.getElementById('view-pricing') ? document.getElementById('view-pricing').innerText : document.body.innerText,
    note: !!document.querySelector('.ov-pricing-compare-note'),
    foldCanvases: document.querySelectorAll('.ov-pricing-fold canvas').length,
    headCanvases: document.querySelectorAll('.ov-pricing-head canvas').length,
    allHeaderCanvases: document.querySelectorAll('canvas.ik-field--header').length,
    headers: document.querySelectorAll('.ov-sp-hero, .sp-hero, .ov-pricing-fold').length,
  }));
  const BEN = ['Full OrivenAI workflow', 'Use credits across all AI features', 'No automatic renewal'];
  check('1.1 the page-wide "Every plan includes the full product…" statement is gone', !pr.note && !/Every plan includes the full product/.test(pr.text));
  check('1.2 five cards, each with exactly the three benefit statements in order', pr.cards.length === 5 && pr.cards.every((c) => JSON.stringify(c.benefits) === JSON.stringify(BEN)), pr.cards.map((c) => c.benefits));
  check('1.3 no product sections listed on the cards', pr.cards.every((c) => !c.benefits.some((b) => /Research|Create|Launch|Campaigns|Automations/.test(b))));
  check('1.4 "Price includes VAT." (no fixed rate; Stripe Tax decides) on all five cards, directly under the credit allowance', pr.cards.every((c) => c.vat === 'Price includes VAT.' && c.vatAfterCredits), pr.cards.map((c) => [c.vat, c.vatAfterCredits]));
  check('1.5 card order: name, price, duration + credits + VAT, benefits, button', pr.cards.every((c) => JSON.stringify(c.order) === JSON.stringify(['ov-pc-head', 'ov-pc-price', 'ov-pc-facts', 'ov-pc-list', 'ov-pc-btn']) && JSON.stringify(c.facts) === JSON.stringify(['ov-pc-duration', 'ov-pc-credits', 'ov-pc-vat'])), pr.cards[0] && pr.cards[0].order);
  check('1.6 duration and credits visible above the benefits (e.g. "1 month of access", "1.750 credits")', /1 month of access/.test(pr.cards[1].duration) && /1\.750 credits/.test(pr.cards[1].credits), [pr.cards[1].duration, pr.cards[1].credits]);
  check('1.7 VAT line visually secondary to price and credits', pr.cards.every((c) => c.vatSize < 14 && c.vatSize < c.priceSize / 2), pr.cards.map((c) => c.vatSize));
  const same = (k) => pr.cards.every((c) => Math.abs(c.top[k] - pr.cards[0].top[k]) < 2);
  check('1.8 names, prices, benefit lists and buttons aligned across the five cards', same('name') && same('price') && same('list') && same('btn'), pr.cards.map((c) => c.top));
  check('1.9 pricing has ONE shared dot field for the whole section (not a second one in the header), no duplicates on the page', pr.foldCanvases === 1 && pr.headCanvases === 0 && pr.allHeaderCanvases === pr.headers, pr);
  const field = await page.evaluate(() => { var h = document.querySelector('.ov-pricing-fold'); var c = h.querySelector(':scope > canvas'); return { z: getComputedStyle(c).zIndex, pe: getComputedStyle(c).pointerEvents, registered: !!(window.IkDotField && window.IkDotField.fields.some((f) => f.c === c)), oneEngine: typeof window.IkDotField === 'object' }; });
  check('1.10 pricing field behind the content, not clickable, registered with the one shared engine', field.z === '-1' && field.pe === 'none' && field.registered && field.oneEngine, field);
  // Coverage at every width: the field spans the heading and every card and
  // ends a short breath below the cards (it follows the section's real size).
  const cover = () => page.evaluate(() => {
    var fold = document.querySelector('.ov-pricing-fold'), c = fold.querySelector(':scope > canvas'), cr = c.getBoundingClientRect();
    var head = document.querySelector('.ov-pricing-head').getBoundingClientRect(), nav = document.getElementById('lpNav');
    var cards = Array.from(document.querySelectorAll('#lpPricingGrid .ov-pc')).map(function (x) { return x.getBoundingClientRect(); });
    var cardsBottom = Math.max.apply(null, cards.map(function (r) { return r.bottom; }));
    var f = window.IkDotField.fields.find(function (x) { return x.c === c; });
    var mask = getComputedStyle(c).maskImage || getComputedStyle(c).webkitMaskImage || '';
    return { top: Math.round(cr.top), navBottom: nav ? Math.round(nav.getBoundingClientRect().bottom) : 0, headTop: Math.round(head.top), headBottom: Math.round(head.bottom),
      covered: cards.every(function (r) { return r.top >= cr.top && r.bottom <= cr.bottom && r.left >= cr.left - 1 && r.right <= cr.right + 1; }),
      below: Math.round(cr.bottom - cardsBottom), laidOut: !!f && f.h === Math.round(cr.height) && f.w === Math.round(cr.width), w: Math.round(cr.width), vw: innerWidth,
      fades: (mask.match(/gradient/g) || []).length, canvases: fold.querySelectorAll('canvas').length,
      ov: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  const nFields = await page.evaluate(() => window.IkDotField.fields.length);
  for (const [w, h] of [[1440, 900], [1024, 900], [768, 1000], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500);
    const cv = await cover();
    check(`1.11 ${w}px: the field covers the heading and all five cards, full width, ending just below the cards`, cv.top >= cv.navBottom - 1 && cv.top <= cv.headTop && cv.covered && cv.below >= 20 && cv.below <= 110 && cv.w >= cv.vw - 20, cv);
    check(`1.12 ${w}px: resized with the section (no stale size), soft edges (faded mask), one canvas, no overflow`, cv.laidOut && cv.fades >= 2 && cv.canvases === 1 && cv.ov <= 1, cv);
  }
  check('1.13 resizing never adds fields to the shared engine (no duplicate canvases or loops)', nFields === await page.evaluate(() => window.IkDotField.fields.length) && await page.evaluate(() => document.querySelectorAll('canvas.ik-field--header').length) === pr.allHeaderCanvases);
  const mob = await page.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, vat: Array.from(document.querySelectorAll('.ov-pc-vat')).every((v) => v.getBoundingClientRect().width > 0) }));
  check('1.14 phone width: no horizontal overflow, VAT line visible on every card', mob.ov <= 1 && mob.vat, mob);
  await page.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/pricing.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const still = await page.evaluate(() => new Promise((res) => { var c = document.querySelector('.ov-pricing-fold > canvas'); var a = c.toDataURL(); setTimeout(() => res({ drawn: a.length > 2000, same: a === c.toDataURL() }), 700); }));
  check('1.15 reduced motion: the pricing field is drawn once and stays still', still.drawn && still.same, still);
  await page.close();

  // ── 2. Footer "Scroll to top" and the navbar logo ───────────────────
  console.log('\n2. Navigation');
  for (const path of ['/', '/pricing.html', '/learn/']) {
    page = await open(path);
    const f = await page.evaluate(() => { var b = document.querySelector('.site-foot [data-scroll-top]'); return { tag: b && b.tagName, text: b && b.textContent.trim(), plans: !!document.querySelector('[data-cta="footer_plans"]'), seePlans: /See plans\s*→/.test(document.querySelector('.site-foot') ? document.querySelector('.site-foot').innerText : '') }; });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    await page.locator('.site-foot [data-scroll-top]').first().scrollIntoViewIfNeeded();
    await page.locator('.site-foot [data-scroll-top]').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1600);
    const y = await page.evaluate(() => ({ y: window.scrollY, path: location.pathname, focus: document.activeElement && document.activeElement.className }));
    check(`2.1 ${path}: footer button "Scroll to top" (a button, keyboard-operable), no "See plans"`, f.tag === 'BUTTON' && /^Scroll to top/.test(f.text) && !f.plans && !f.seePlans, f);
    check(`2.2 ${path}: activating it scrolls to the top, stays on the page, focus to the top`, y.y === 0 && y.path === new URL(BASE + path).pathname && /lp-logo/.test(String(y.focus)), y);
    await page.close();
  }
  page = await open('/');
  const logo = await page.evaluate(() => ({ ring: !!document.querySelector('#lpNav .lp-logo .lp-logo-ring'), segs: document.querySelectorAll('#lpNav .lp-logo-seg').length, img: !!document.querySelector('#lpNav .lp-logo img'), href: document.querySelector('#lpNav .lp-logo').getAttribute('href'), label: document.querySelector('#lpNav .lp-logo').getAttribute('aria-label') }));
  check('2.3 navbar logo is the six-segment ring (same paths as the hero), still a link home', logo.ring && logo.segs === 6 && !logo.img && logo.href === '/' && /OrivenAI/.test(logo.label), logo);
  await page.hover('#lpNav .lp-logo'); await page.waitForTimeout(1200);
  const hov = await page.evaluate('(function(){ var R=' + ROT + '; var r=document.querySelector("#lpNav .lp-logo-ring"); var s=document.querySelectorAll("#lpNav .lp-logo-seg"); return { rot: R(getComputedStyle(r).transform), spread: Array.from(s).map(function(x){ return getComputedStyle(x).transform; }) }; })()');
  check('2.4 hover: a short turn (10°, the hero\'s), not the old 60° sweep', hov.rot >= 8 && hov.rot <= 12, hov.rot);
  check('2.5 hover: the six segments spread apart (each moved)', hov.spread.length === 6 && hov.spread.every((t) => t !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(t)), hov.spread);
  await page.mouse.move(700, 600); await page.waitForTimeout(1200);
  const back = await page.evaluate('(function(){ var R=' + ROT + '; return R(getComputedStyle(document.querySelector("#lpNav .lp-logo-ring")).transform); })()');
  check('2.6 pointer leaves: it returns to rest', back === 0, back);
  await page.close();
  page = await open('/');
  await page.keyboard.press('Tab'); await page.waitForTimeout(100);
  for (let i = 0; i < 4; i++) { if (await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('lp-logo'))) break; await page.keyboard.press('Tab'); }
  await page.waitForTimeout(1100);
  const kb = await page.evaluate('(function(){ var R=' + ROT + '; return { focused: document.activeElement.classList.contains("lp-logo"), rot: R(getComputedStyle(document.querySelector("#lpNav .lp-logo-ring")).transform) }; })()');
  check('2.7 keyboard focus shows the same short movement', kb.focused && kb.rot >= 8 && kb.rot <= 12, kb);
  await page.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.addStyleTag({ content: HIDE });
  await page.hover('#lpNav .lp-logo'); await page.waitForTimeout(400);
  const rm = await page.evaluate('(function(){ var R=' + ROT + '; return R(getComputedStyle(document.querySelector("#lpNav .lp-logo-ring")).transform); })()');
  check('2.8 reduced motion: the logo does not move on hover', rm === 0, rm);
  await page.close();

  // ── 3. Hero ───────────────────────────────────────────────────────
  console.log('\n3. Hero');
  page = await open('/');
  const hero = await page.evaluate(() => { var h = document.querySelector('.ik-hero'); var b = Array.from(h.querySelectorAll('.ik-actions a')); return { text: h.innerText, eyebrow: !!h.querySelector('.ik-eyebrow'), meta: !!h.querySelector('.ik-hero__meta'), btns: b.map((a) => [a.textContent.trim(), a.getAttribute('href')]) }; });
  check('3.1 no "AI marketing platform" badge', !hero.eyebrow && !/AI marketing platform/i.test(hero.text), hero);
  check('3.2 no pricing sentence ("From €17 for 14 days…")', !hero.meta && !/From €17|automatic renewal/.test(hero.text));
  check('3.3 CTAs: "Get started" (unchanged) and "Show how it works" → #how', hero.btns.length === 2 && /^Get started/.test(hero.btns[0][0]) && hero.btns[0][1] === '/signup' && /^Show how it works/.test(hero.btns[1][0]) && hero.btns[1][1] === '#how', hero.btns);
  await page.click('.ik-hero .ik-actions a[href="#how"]'); await page.waitForTimeout(1500);
  const how = await page.evaluate(() => { var r = document.getElementById('how').getBoundingClientRect(); return { top: Math.round(r.top), title: document.getElementById('ik-how-title').textContent }; });
  check('3.4 "Show how it works" scrolls to the workflow section (One loop. Six sections.)', how.top > -40 && how.top < 200 && /One loop/.test(how.title), how);
  await page.close();

  // ── 4. Problem sequence ──────────────────────────────────────────
  console.log('\n4. Problem section');
  page = await open('/');
  const before = await page.evaluate(() => {
    var lines = Array.from(document.querySelectorAll('.ik-problem__line'));
    return { n: lines.length, dirs: lines.map((l) => l.getAttribute('data-reveal')), delays: lines.map((l) => parseFloat(getComputedStyle(l).transitionDelay)), in: lines.map((l) => l.classList.contains('is-in')), op: lines.map((l) => getComputedStyle(l).opacity), tx: lines.map((l) => getComputedStyle(l).transform),
      punch: (function(){ var p = document.querySelector('.ik-problem__punch'); return { r: p.getAttribute('data-reveal'), d: parseFloat(getComputedStyle(p).transitionDelay), in: p.classList.contains('is-in') }; })(),
      answer: (function(){ var a = document.querySelector('.ik-problem__answer'); return { text: a.textContent, in: a.classList.contains('is-in') }; })(),
      motion: document.getElementById('ik-home').classList.contains('ik-motion'),
      h: document.querySelector('.ik-problem').getBoundingClientRect().height };
  });
  check('4.1 four statements, alternating left / right', before.n === 4 && JSON.stringify(before.dirs) === '["left","right","left","right"]', before.dirs);
  check('4.2 nothing revealed at page load: hidden and offset to its side until scrolled to', before.motion && before.in.every((x) => !x) && before.op.every((o) => o === '0') && before.tx.every((t) => t !== 'none'), before);
  check('4.3 staggered: each statement later than the one before; the punch line after all four', before.delays.every((d, i) => i === 0 || d > before.delays[i - 1]) && before.punch.d > before.delays[3] && before.punch.r === 'punch', [before.delays, before.punch.d]);
  check('4.4 copy: the four statements and the clean conclusion', /Your research lives in one tab/.test(await page.evaluate(() => document.querySelector('.ik-problem').innerText)) && /OrivenAI connects it all/.test(before.answer.text));
  await page.evaluate(() => document.querySelector('.ik-problem__lines').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2600);
  const after = await page.evaluate(() => ({ in: Array.from(document.querySelectorAll('.ik-problem__line')).map((l) => l.classList.contains('is-in')), op: Array.from(document.querySelectorAll('.ik-problem__line')).map((l) => getComputedStyle(l).opacity), tx: Array.from(document.querySelectorAll('.ik-problem__line')).map((l) => getComputedStyle(l).transform), punch: getComputedStyle(document.querySelector('.ik-problem__punch')).opacity, h: document.querySelector('.ik-problem').getBoundingClientRect().height, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  check('4.5 scrolled into view: every statement in place and fully visible, then the punch line', after.in.every(Boolean) && after.op.every((o) => o === '1') && after.tx.every((t) => t === 'none') && after.punch === '1', after);
  check('4.6 no layout shift (section height unchanged) and no horizontal overflow during the entrance', Math.abs(after.h - before.h) < 1 && after.ov <= 1, [before.h, after.h, after.ov]);
  await page.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  const rmP = await page.evaluate(() => Array.from(document.querySelectorAll('.ik-problem__line, .ik-problem__punch, .ik-problem__answer')).map((l) => getComputedStyle(l).opacity));
  check('4.7 reduced motion: all statements readable immediately, no movement', rmP.every((o) => o === '1'), rmP);
  await page.close();

  // ── 5. Removals and the assistants ─────────────────────────────────
  console.log('\n5. Copy');
  page = await open('/');
  const copy = await page.evaluate(() => ({
    home: document.getElementById('ik-home').innerText,
    how: document.getElementById('how').innerText,
    chars: Array.from(document.querySelectorAll('.ik-agent')).map((a) => { var dts = Array.from(a.querySelectorAll('.ik-agent__facts dt')); return { tone: !!dts.find((d) => d.textContent === 'Tone'), story: (dts.find((d) => d.textContent === 'Character') || {}).nextElementSibling ? dts.find((d) => d.textContent === 'Character').nextElementSibling.textContent : '' }; }),
    aside: (function(){ var h = document.querySelector('.ik-agents .ik-head'); var a = h.querySelector('.ik-head__aside'); var t = h.querySelector('.ik-h2'); return a && t ? { asideBottom: Math.round(a.getBoundingClientRect().bottom), titleBottom: Math.round(t.getBoundingClientRect().bottom) } : null; })(),
  }));
  check('5.1 "Pages marked In development are part of the structure but not available yet" is gone', !/part of the structure but not available yet/.test(copy.home));
  check('5.2 the two loop sentences are gone; the section is otherwise intact (six steps)', !/feed the next round of research and planning/.test(copy.how) && !/The loop starts again/.test(copy.how) && /One loop/.test(copy.how) && (copy.how.match(/0[1-6] ·/g) || []).length >= 6);
  check('5.3 every assistant keeps Tone and has an illustrative backstory, all six distinct', copy.chars.length === 6 && copy.chars.every((c) => c.tone && /^An imagined backstory:/.test(c.story) && c.story.length < 360) && new Set(copy.chars.map((c) => c.story)).size === 6, copy.chars.map((c) => c.story.slice(0, 60)));
  check('5.4 the section says the stories are illustrative', /stories and example conversations are illustrative/.test(copy.home));
  check('5.5 assistant header: lead + note end on the heading\'s last line (one composition)', copy.aside && Math.abs(copy.aside.asideBottom - copy.aside.titleBottom) < 24, copy.aside);
  await page.close();

  // ── 6. Clicking text changes nothing ──────────────────────────────
  // Reported: "clicking text starts a typing animation". Clicks on static
  // text (headings, paragraphs, card text) must not change any text, make
  // anything editable or move focus into an editable element; selection,
  // links and buttons keep working.
  console.log('\n6. Clicking static text');
  for (const path of ['/', '/pricing.html', '/learn/']) {
    page = await open(path);
    await page.evaluate(() => {
      window.__mut = 0;
      new MutationObserver((ms) => ms.forEach((m) => {
        var el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
        if (!el || el.closest('canvas, [aria-live], script, style')) return;
        if (m.type === 'characterData' || [].concat(Array.from(m.addedNodes), Array.from(m.removedNodes)).some((n) => n.nodeType === 3 && n.textContent.trim())) window.__mut++;
      })).observe(document.body, { subtree: true, characterData: true, childList: true });
      var vis = (e) => { var r = e.getBoundingClientRect(); return r.width > 40 && r.height > 8 && r.top > 70 && getComputedStyle(e).opacity !== '0' && !e.closest('a, button, label, summary, .ik-stage'); };
      Array.from(document.querySelectorAll('h1, h2, h3, p, li, dd, .ov-pc-price')).filter(vis).slice(0, 10).forEach((e, i) => e.setAttribute('data-click', i));
    });
    const n = await page.evaluate(() => document.querySelectorAll('[data-click]').length);
    let changed = 0, editable = 0;
    for (let i = 0; i < n; i++) {
      const el = page.locator('[data-click="' + i + '"]');
      const before = await el.textContent();
      await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      if ((await el.textContent()) !== before) changed++;
      if (await page.evaluate(() => !!(document.activeElement && document.activeElement.isContentEditable) || document.designMode === 'on' || !!document.querySelector('[contenteditable]:not([contenteditable="false"])'))) editable++;
    }
    const mut = await page.evaluate(() => window.__mut);
    check(`6.1 ${path}: clicking ${n} headings, paragraphs and card texts changed no text (no typing / deleting), nothing editable`, n >= 6 && changed === 0 && mut === 0 && editable === 0, { n, changed, mut, editable });
    const sel = await page.evaluate(() => { var e = document.querySelector('[data-click="1"]'); var r = document.createRange(); r.selectNodeContents(e); var s = getSelection(); s.removeAllRanges(); s.addRange(r); var norm = (x) => x.replace(/s+/g, ' ').trim(); return norm(s.toString()).length > 0 && norm(s.toString()) === norm(e.innerText); });
    check(`6.2 ${path}: text can still be selected (and so copied)`, sel);
    await page.close();
  }
  page = await open('/pricing.html');
  await page.locator('.ov-pc-btn').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const navOk = await page.evaluate(() => { var a = document.querySelector('#lpNav a[href="/pricing"]'), b = document.querySelector('.ov-pc-btn'); return !!a && !!b && getComputedStyle(b).pointerEvents !== 'none' && document.elementFromPoint(b.getBoundingClientRect().left + 10, b.getBoundingClientRect().top + 10) === b; });
  check('6.3 links and buttons still respond (a pricing button is the element under the pointer, not the dot field)', navOk);
  await page.close();

  // ── 7. A blinking caret on clicked text: the website or the browser? ──
  // A painted caret blinks (Chrome: every 500 ms), so two crops ~530 ms
  // apart differ only if a caret is drawn. Run in a normal browser (must
  // never blink: the site must not create a caret or editable text) and,
  // as a positive control proving the detector works, in a browser with
  // Chrome's Caret Browsing on (must blink, with nothing editable).
  console.log('\n7. Caret on clicked text');
  const caretRun = async (args) => {
    const b2 = await chromium.launch({ executablePath: CHROME_PATH, headless: true, args });
    require('./_fence').fenceBrowser(b2, BASE, { backend401: true });
    const out = [];
    for (const [path, sel] of [['/', '.ik-hero__sub'], ['/pricing.html', '.ov-pc-duration'], ['/pricing.html', '.ov-pc-benefits li'], ['/learn/', '.sp-lede']]) {
      const p2 = await b2.newPage({ viewport: { width: 1440, height: 900 } });
      await p2.goto(BASE + path, { waitUntil: 'networkidle' }); await p2.waitForTimeout(800);
      await p2.addStyleTag({ content: HIDE + ' canvas{visibility:hidden!important}' });
      const el = p2.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p2.waitForTimeout(300);
      const bx = await el.boundingBox(); const x = Math.round(bx.x + Math.min(60, bx.width / 3)), y = Math.round(bx.y + Math.min(12, bx.height / 2));
      await p2.mouse.click(x, y); await p2.waitForTimeout(250);
      const clip = { x: x - 14, y: Math.max(0, y - 22), width: 28, height: 44 };
      const a = await p2.screenshot({ clip }); await p2.waitForTimeout(530); const c = await p2.screenshot({ clip }); await p2.waitForTimeout(530); const d = await p2.screenshot({ clip });
      const st = await p2.evaluate(() => ({ editable: !!(document.activeElement && document.activeElement.isContentEditable) || document.designMode === 'on' || !!document.querySelector('[contenteditable]:not([contenteditable="false"])') }));
      out.push({ path, sel, blinks: !a.equals(c) || !c.equals(d), editable: st.editable });
      await p2.close();
    }
    await b2.close();
    return out;
  };
  const normal = await caretRun([]);
  const caretBrowsing = await caretRun(['--enable-caret-browsing']);
  check('7.1 normal browser: clicking ordinary text paints no caret and makes nothing editable (the website adds no caret)', normal.every((r) => !r.blinks && !r.editable), normal);
  check('7.2 control: with Chrome Caret Browsing on, the same clicks DO paint a blinking caret, with nothing editable (browser feature, detector works)', caretBrowsing.filter((r) => r.blinks).length >= 3 && caretBrowsing.every((r) => !r.editable), caretBrowsing);

  // ── 8. Pricing explanation section ───────────────────────────────
  console.log('\n8. Pricing explanation');
  for (const [w, h] of [[1440, 900], [1024, 900], [768, 1000], [390, 844]]) {
    page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => errors.push('pricing ' + w + ': ' + e.message));
    await page.goto(BASE + '/pricing.html', { waitUntil: 'networkidle' }); await page.addStyleTag({ content: HIDE }); await page.waitForTimeout(400);
    const d = await page.evaluate(() => {
      var s = document.querySelector('.ov-price-detail');
      var parts = Array.from(s.querySelectorAll('.ov-pd-part')).map((p) => (p.querySelector('h3') || {}).textContent);
      var rows = Array.from(s.querySelectorAll('.ov-pd-table tbody tr')).map((r) => r.querySelector('th').textContent);
      var cols = Array.from(s.querySelectorAll('.ov-pd-table thead th')).map((t) => t.textContent);
      var shown = Array.from(s.querySelectorAll('.ov-pd-table tbody tr')).map((r) => Array.from(r.querySelectorAll('td')).filter((td) => td.getBoundingClientRect().width > 0).map((td) => td.getAttribute('data-label')).join('|'));
      var cellsFit = Array.from(s.querySelectorAll('.ov-pd-table tbody td, .ov-pd-table tbody th')).every((c) => c.scrollWidth <= c.clientWidth + 1);
      var planText = s.querySelector('.ov-pd-part').innerText;
      var boxed = Array.from(s.querySelectorAll('.ov-pd-part, .ov-pd-group, .ov-pd-know li')).filter((e) => parseFloat(getComputedStyle(e).borderLeftWidth) > 0).length;
      var tw = s.querySelector('.ov-pd-table-wrap');
      return { cols, shown, cellsFit, removedGone: !/per month|credits arrive|all at once/i.test(planText), parts, rows, groups: Array.from(s.querySelectorAll('.ov-pd-group h4')).map((x) => x.textContent), know: s.querySelectorAll('.ov-pd-know li').length, boxed,
        shared: (s.querySelector('.ov-pd-shared') || {}).textContent || '', tableOverflow: tw.scrollWidth - tw.clientWidth,
        ov: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    check(`8.1 ${w}px: three titled parts (plans, credits, good to know), five plan rows, three cost groups, no boxed panels, no overflow`,
      JSON.stringify(d.parts) === JSON.stringify(['Plans side by side', 'How credits work', 'Good to know']) && d.rows.join() === 'Flex,Monthly,Quarterly,Semi-Annual,Annual' && d.groups.length === 3 && d.know === 3 && d.boxed === 0 && d.tableOverflow <= 1 && d.ov <= 1, d);
    check(`8.3 ${w}px: plans table shows exactly Plan, Access, Price, Credits (no price per month, no credits arrive), every value readable`, JSON.stringify(d.cols) === JSON.stringify(['Plan', 'Access', 'Price', 'Credits']) && d.shown.length === 5 && d.shown.every((x) => x === 'Access|Price|Credits') && d.cellsFit && d.removedGone, { cols: d.cols, shown: d.shown, fit: d.cellsFit });
    if (w === 1440) check('8.2 what every plan shares is stated once (every feature, no automatic renewal), not repeated per plan', /Every feature/.test(d.shared) && /Renews automatically: no/.test(d.shared));
    await page.close();
  }

  check('Z. no JavaScript errors on any page', errors.length === 0, errors);
  await browser.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
