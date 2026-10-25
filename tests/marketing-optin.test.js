/* ════════════════════════════════════════════════════════════════
   Marketing opt-in — Settings "Also send me special offers" and the one-time
   Control Center card. The browser is fenced (tests/_fence.js); the email
   preference API is answered in-page with fixed responses, so nothing real is
   called and no consent is recorded anywhere.
   Checks: nothing is sent without a click; "Yes" sends source offers_invite;
   "No thanks" only dismisses; Settings confirm sends source settings; who sees
   what; six languages present and meaning the same.
   Needs the static server on :8899. RUN: node tests/marketing-optin.test.js
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); } }

// Meaning check per language: the card and the Settings line must name offers.
const OFFERS_WORD = { en: /special offers/i, nl: /speciale aanbiedingen/i, de: /Sonderangebote/i, fr: /offres spéciales/i, es: /ofertas especiales/i, pt: /ofertas especiais/i };
const TIPS_WORD = { en: /tips/i, nl: /tips/i, de: /Tipps/i, fr: /conseils/i, es: /consejos/i, pt: /dicas/i };
const UNSUB_WORD = { en: /unsubscribe/i, nl: /afmelden/i, de: /abmelden/i, fr: /désabonner/i, es: /darte de baja/i, pt: /cancelar a subscrição/i };

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  require('./_fence').fenceBrowser(browser, BASE_URL, { backend401: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const calls = [];
  let GET = { marketing: false, offers: false, offersInvite: false, available: true, suppressed: false };
  let FAILNEXT = false;
  await page.route('**/api/email/preferences**', async (route) => {
    const req = route.request();
    const u = req.url(), m = req.method();
    calls.push({ m, u: u.replace(/^https?:\/\/[^/]+/, ''), body: req.postData() ? JSON.parse(req.postData()) : null });
    if (FAILNEXT && m !== 'GET') { FAILNEXT = false; return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }); }
    if (m === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GET) });
    if (/offers-invite\/dismiss/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    const b = JSON.parse(req.postData() || '{}');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ marketing: b.marketing, offers: b.marketing }) });
  });
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-optin', email: 'mock@example.invalid' });
    window._apiToken = 'test-token'; _apiToken = 'test-token';
  });
  const writes = () => calls.filter((c) => c.m !== 'GET');
  const card = () => page.evaluate(() => { const el = document.getElementById('ccxOffers'); return { hidden: !el || el.hidden, text: el ? el.textContent : '' }; });
  const fresh = async () => { await page.evaluate(() => { orvCC.reset(); }); await page.evaluate(() => orvCC.offersLoad()); await page.waitForTimeout(100); };

  // ── A. Control Center card ──
  console.log('── A. Control Center card ──');
  GET = { marketing: false, offers: false, offersInvite: true, available: true, suppressed: false };
  await fresh();
  let c = await card();
  check('invited user sees the card with the full wording', !c.hidden && /Hear about new features and offers\?/.test(c.text) && /product updates, new features, tips, and special offers/.test(c.text) && /unsubscribe anytime/.test(c.text), c.text);
  check('showing the card records nothing (no write requests)', writes().length === 0);
  check('no option is pre-selected (two plain buttons, no checkbox)', await page.evaluate(() => document.querySelectorAll('#ccxOffers input').length === 0 && document.querySelectorAll('#ccxOffers [data-offers]').length === 2));
  await page.click('#ccxOffers [data-offers="yes"]'); await page.waitForTimeout(200);
  let w = writes();
  check('"Yes, email me" → PUT {marketing:true, source:"offers_invite"}, no user id sent', w.length === 1 && w[0].m === 'PUT' && /\/api\/email\/preferences$/.test(w[0].u) && JSON.stringify(w[0].body) === JSON.stringify({ marketing: true, source: 'offers_invite' }), JSON.stringify(w));
  c = await card(); check('…then a short confirmation, no more buttons', !c.hidden && /Thanks\. You’ll get product updates, tips, and special offers/.test(c.text) && await page.locator('#ccxOffers [data-offers]').count() === 0);

  calls.length = 0; await fresh();
  await page.click('#ccxOffers [data-offers="no"]'); await page.waitForTimeout(200);
  w = writes();
  check('"No thanks" → only the dismiss endpoint; consent not touched', w.length === 1 && w[0].m === 'POST' && /offers-invite\/dismiss$/.test(w[0].u), JSON.stringify(w));
  c = await card(); check('…card hidden', c.hidden);

  calls.length = 0; await fresh(); FAILNEXT = true;
  await page.click('#ccxOffers [data-offers="yes"]'); await page.waitForTimeout(200);
  c = await card();
  check('a failed save shows an error and keeps the buttons (nothing assumed)', !c.hidden && /Couldn’t save that/.test(c.text) && await page.locator('#ccxOffers [data-offers]:not([disabled])').count() === 2);

  for (const [label, g] of [['already covers offers', { marketing: true, offers: true, offersInvite: false }], ['paid / bounced / dismissed (server says no)', { marketing: false, offers: false, offersInvite: false, suppressed: true }]]) {
    GET = Object.assign({ available: true, suppressed: false }, g); calls.length = 0; await fresh();
    c = await card(); check('no card when ' + label, c.hidden && writes().length === 0);
  }
  await page.evaluate(() => { _apiToken = null; window._apiToken = null; orvCC.reset(); });
  calls.length = 0; await page.evaluate(() => orvCC.offersLoad());
  check('not signed in → no request, no card', calls.length === 0 && (await card()).hidden);
  await page.evaluate(() => { _apiToken = 'test-token'; window._apiToken = 'test-token'; });

  // ── B. Settings ──
  console.log('── B. Settings → Email preferences ──');
  const openAccount = async () => { await page.evaluate(() => { if (typeof openSettingsModal === 'function') openSettingsModal(); var b = document.querySelector('.smd-ni[data-smd="account"]'); if (b) b.click(); }); await page.evaluate(() => orvLoadEmailPrefs()); await page.waitForTimeout(100); };
  const box = () => page.evaluate(() => { const b = document.getElementById('emailOffersConfirm'); return b && b.style.display !== 'none'; });
  GET = { marketing: true, offers: false, offersInvite: true, available: true, suppressed: false };
  calls.length = 0; await openAccount();
  check('signup-consent user: switch on + "Also send me special offers" shown', await box() && await page.evaluate(() => document.getElementById('tglMarketingEmail').classList.contains('on')));
  check('…nothing recorded by opening Settings', writes().length === 0);
  await page.click('#emailOffersBtn'); await page.waitForTimeout(200);
  w = writes();
  check('confirm → PUT {marketing:true, source:"settings"}', w.length === 1 && JSON.stringify(w[0].body) === JSON.stringify({ marketing: true, source: 'settings' }), JSON.stringify(w));
  check('…confirm option hidden afterwards', !(await box()));
  GET = { marketing: true, offers: true, offersInvite: false, available: true, suppressed: false }; await openAccount();
  check('consent already covers offers → no confirm option', !(await box()));
  GET = { marketing: false, offers: false, offersInvite: true, available: true, suppressed: false }; await openAccount();
  check('no consent → no confirm option (the switch itself is the choice)', !(await box()));
  GET = { marketing: true, available: true, suppressed: false }; await openAccount();
  check('older backend (no "offers" field) → no confirm option, no card', !(await box()) && (await (async () => { await fresh(); return (await card()).hidden; })()));
  GET = { marketing: true, offers: false, offersInvite: false, available: true, suppressed: true }; await openAccount();
  check('bounced address → no confirm option', !(await box()));
  GET = { marketing: true, offers: false, offersInvite: true, available: true, suppressed: false }; await openAccount();
  calls.length = 0;
  await page.evaluate(() => orvToggleMarketingEmail(document.getElementById('tglMarketingEmail'))); await page.waitForTimeout(200);
  w = writes();
  check('off switch unchanged: PUT {marketing:false}; confirm option hidden', w.length === 1 && JSON.stringify(w[0].body) === JSON.stringify({ marketing: false }) && !(await box()), JSON.stringify(w));

  // ── C. Six languages ──
  console.log('── C. Languages ──');
  const strs = await page.evaluate(() => { const o = {}; ['en', 'nl', 'de', 'fr', 'es', 'pt'].forEach((l) => { const s = orvCC._STR[l] || {}; const L = LANG_STRINGS[l] || {}; o[l] = { title: s.offersTitle, body: s.offersBody, yes: s.offersYes, no: s.offersNo, done: s.offersDone, err: s.offersErr, note: L.emailOffersNote, btn: L.emailOffersBtn, sdone: L.emailOffersDone }; }); return o; });
  for (const l of Object.keys(OFFERS_WORD)) {
    const s = strs[l];
    const all = Object.values(s).every((v) => typeof v === 'string' && v.length > 1);
    check(l + ': all card and Settings strings present', all, JSON.stringify(s));
    check(l + ': card names product updates/tips AND special offers, and unsubscribing', OFFERS_WORD[l].test(s.body) && TIPS_WORD[l].test(s.body) && UNSUB_WORD[l].test(s.body), s.body);
    check(l + ': Settings line says current consent = tips only, button adds special offers', TIPS_WORD[l].test(s.note) && OFFERS_WORD[l].test(s.note) && OFFERS_WORD[l].test(s.btn), s.note + ' / ' + s.btn);
    if (l !== 'en') check(l + ': translated (not English)', s.body !== strs.en.body && s.note !== strs.en.note && s.yes !== strs.en.yes);
  }
  await page.evaluate(() => setLanguage('nl'));
  GET = { marketing: false, offers: false, offersInvite: true, available: true, suppressed: false }; await fresh();
  c = await card(); check('card renders in the selected language (nl)', /speciale aanbiedingen/.test(c.text) && /Ja, mail me/.test(c.text), c.text);
  await page.evaluate(() => setLanguage('en'));
  check('no JavaScript errors', errors.length === 0, errors.slice(0, 3).join('; '));
  await browser.close();
  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
