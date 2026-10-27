/* ════════════════════════════════════════════════════════════════
   Cookie consent + Google Ads tag (js/consent.js, AW-18538836764).
   Checks: Consent Mode v2 defaults are denied; gtag.js is not loaded before
   advertising consent; Accept loads it exactly once with config
   AW-18538836764; a stored choice is honoured on the next visit; Reject /
   withdrawing denies consent and removes Google cookies; every page offers a
   "Cookie settings" link (the app: Settings → Account); no conversion event
   is sent. Fenced browser (tests/_fence.js); gtag.js is answered with a local
   stub, so nothing reaches Google.
   Needs the static server on :8899. RUN: node tests/consent-tag.test.js
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); } }

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  require('./_fence').fenceBrowser(browser, BASE_URL, { backend401: true });
  const gtagLoads = [];
  async function newPage() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://www.googletagmanager.com/gtag/js**', (r) => { gtagLoads.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__gtagStub=(window.__gtagStub||0)+1;' }); });
    return { ctx, page, errors };
  }
  const dl = (page) => page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)));
  const gtagScripts = (page) => page.evaluate(() => Array.from(document.scripts).filter((s) => /googletagmanager\.com\/gtag\/js/.test(s.src)).map((s) => s.src));

  // ── A. First visit: denied by default, nothing loaded ──
  console.log('── A. First visit ──');
  let { ctx, page, errors } = await newPage();
  await page.goto(BASE_URL + '/pricing.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
  let d = await dl(page);
  check('Consent Mode v2 default is the first dataLayer entry, all ad signals denied', d.length >= 1 && d[0][0] === 'consent' && d[0][1] === 'default' && d[0][2].ad_storage === 'denied' && d[0][2].ad_user_data === 'denied' && d[0][2].ad_personalization === 'denied' && d[0][2].analytics_storage === 'denied', JSON.stringify(d[0]));
  check('banner shown on first visit', await page.locator('.orv-cc[data-cc-view="banner"]').count() === 1);
  check('gtag.js NOT loaded before consent', (await gtagScripts(page)).length === 0 && gtagLoads.length === 0);
  check('no config before consent', !d.some((e) => e[0] === 'config'));

  // ── B. Accept ──
  console.log('── B. Accept advertising ──');
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(400);
  d = await dl(page);
  const scripts = await gtagScripts(page);
  check('Accept → gtag.js requested once, with id AW-18538836764', scripts.length === 1 && /id=AW-18538836764$/.test(scripts[0]) && gtagLoads.length === 1, JSON.stringify(scripts));
  const iUpd = d.findIndex((e) => e[0] === 'consent' && e[1] === 'update'), iCfg = d.findIndex((e) => e[0] === 'config');
  check('consent update (granted) comes before config', iUpd > 0 && iCfg > iUpd && d[iUpd][2].ad_storage === 'granted' && d[iUpd][2].ad_user_data === 'granted' && d[iUpd][2].ad_personalization === 'granted');
  check('config AW-18538836764 sent once', d.filter((e) => e[0] === 'config').length === 1 && d[iCfg][1] === 'AW-18538836764');
  check('choice stored (orv_consent_v1, ads: true)', await page.evaluate(() => JSON.parse(localStorage.getItem('orv_consent_v1')).ads === true));
  check('banner closed', await page.locator('.orv-cc').count() === 0);
  // Accepting again from the settings must not load a second tag.
  await page.click('a[data-cookie-settings]'); await page.waitForTimeout(200);
  check('footer "Cookie settings" on /pricing opens the settings dialog', await page.locator('.orv-cc[data-cc-view="settings"]').count() === 1);
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(300);
  check('accepting again → still one gtag.js, one config (no duplicates)', (await gtagScripts(page)).length === 1 && (await dl(page)).filter((e) => e[0] === 'config').length === 1);
  check('no conversion or signup/purchase event is sent', !(await dl(page)).some((e) => e[0] === 'event' && (/conversion|sign_up|purchase/i.test(String(e[1])) || (e[2] && e[2].send_to))));

  // ── C. Next visit with the stored choice ──
  console.log('── C. Returning visitor ──');
  const before = gtagLoads.length;
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  d = await dl(page);
  check('stored "accept" → no banner, tag loads on page load', await page.locator('.orv-cc').count() === 0 && (await gtagScripts(page)).length === 1 && gtagLoads.length === before + 1);
  check('…default denied first, then update granted, then config', d[0][1] === 'default' && d.findIndex((e) => e[0] === 'consent' && e[1] === 'update') < d.findIndex((e) => e[0] === 'config'));

  // ── D. Withdraw ──
  console.log('── D. Withdraw consent ──');
  await page.evaluate(() => { document.cookie = '_gcl_aw=GCL.test; path=/'; document.cookie = '_gcl_au=1.1.test; path=/'; });
  await page.click('a[data-cookie-settings]'); await page.waitForTimeout(200);
  await page.uncheck('#orvCcAds'); await page.click('.orv-cc [data-cc-act="save"]'); await page.waitForTimeout(300);
  d = await dl(page);
  const last = d.filter((e) => e[0] === 'consent' && e[1] === 'update').pop();
  check('withdrawing → consent update denied', last && last[2].ad_storage === 'denied' && last[2].ad_user_data === 'denied' && last[2].ad_personalization === 'denied');
  check('…Google Ads cookies removed', await page.evaluate(() => !/_gcl_aw|_gcl_au/.test(document.cookie)));
  check('…stored ads: false', await page.evaluate(() => JSON.parse(localStorage.getItem('orv_consent_v1')).ads === false));
  const b2 = gtagLoads.length;
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  check('stored "reject" → no banner and gtag.js not loaded', await page.locator('.orv-cc').count() === 0 && (await gtagScripts(page)).length === 0 && gtagLoads.length === b2);
  await ctx.close();

  // ── E. Reject on first visit ──
  ({ ctx, page, errors } = await newPage());
  await page.goto(BASE_URL + '/faq.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  const b3 = gtagLoads.length;
  await page.click('.orv-cc [data-cc-act="reject"]'); await page.waitForTimeout(300);
  check('Reject → no gtag.js, stored ads: false, banner closed', (await gtagScripts(page)).length === 0 && gtagLoads.length === b3 && await page.evaluate(() => JSON.parse(localStorage.getItem('orv_consent_v1')).ads === false) && await page.locator('.orv-cc').count() === 0);
  await ctx.close();

  // ── F. "Cookie settings" reachable everywhere ──
  console.log('── F. Cookie settings on every page ──');
  for (const p of ['/', '/pricing.html', '/faq.html', '/terms.html', '/privacy.html', '/cookie-policy.html', '/product/google-ads.html', '/create.html', '/about.html', '/404.html', '/learn/index.html']) {
    ({ ctx, page, errors } = await newPage());
    await page.addInitScript(() => { try { localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: true, at: new Date().toISOString() })); } catch (_) {} });
    await page.goto(BASE_URL + p, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
    const link = page.locator('[data-cookie-settings]:visible, a[href="#cookie-settings"]:visible').last();
    const n = await link.count();
    if (n) { await link.scrollIntoViewIfNeeded(); await link.click(); await page.waitForTimeout(200); }
    check(p + ': visible "Cookie settings" link opens the settings (returning visitor)', n > 0 && await page.locator('.orv-cc[data-cc-view="settings"]').count() === 1 && errors.length === 0, 'links:' + n + ' errors:' + errors.join(';'));
    await ctx.close();
  }

  // ── F2. Tag Assistant / debug sessions (?gtm_debug=…) ──
  console.log('── F2. Tag Assistant debug sessions ──');
  const DBG = '/pricing.html?gtm_debug=1761580000000';
  const stored = (ads) => ({ v: 1, ads, stats: true, at: '2026-10-20T00:00:00.000Z' });
  // Fresh debug visit: same as any first visit — banner, nothing loaded before Accept.
  ({ ctx, page, errors } = await newPage());
  const logs = []; page.on('console', (m) => { if (m.type() === 'info') logs.push(m.text()); });
  let n0 = gtagLoads.length;
  await page.goto(BASE_URL + DBG, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  d = await dl(page);
  check('debug, no choice: banner shown, gtag.js not loaded, default denied first', await page.locator('.orv-cc[data-cc-view="banner"]').count() === 1 && (await gtagScripts(page)).length === 0 && gtagLoads.length === n0 && d[0][1] === 'default' && d[0][2].ad_storage === 'denied');
  check('debug: console explains the tag waits for consent', logs.some((l) => /AW-18538836764 waits for advertising consent/.test(l)), JSON.stringify(logs));
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(400);
  d = await dl(page);
  check('debug, Accept: tag initialised exactly once, update(granted) before config', (await gtagScripts(page)).length === 1 && gtagLoads.length === n0 + 1 && d.filter((e) => e[0] === 'config').length === 1 && d.findIndex((e) => e[0] === 'consent' && e[1] === 'update') < d.findIndex((e) => e[0] === 'config'));
  check('debug: orvConsent.get() reports debugSession + tagLoaded', await page.evaluate(() => { const g = orvConsent.get(); return g.debugSession === true && g.tagLoaded === true && g.ads === true; }));
  await ctx.close();
  // Stored "reject" + debug: asks again once (never grants by itself).
  ({ ctx, page, errors } = await newPage());
  await page.addInitScript((s) => { if (!localStorage.getItem('orv_consent_v1')) localStorage.setItem('orv_consent_v1', JSON.stringify(s)); }, stored(false));
  n0 = gtagLoads.length;
  await page.goto(BASE_URL + DBG, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  check('debug + stored reject: banner shown again, tag NOT loaded, consent still denied', await page.locator('.orv-cc[data-cc-view="banner"]').count() === 1 && (await gtagScripts(page)).length === 0 && gtagLoads.length === n0 && !(await dl(page)).some((e) => e[0] === 'consent' && e[1] === 'update'));
  await page.click('.orv-cc [data-cc-act="reject"]'); await page.waitForTimeout(300);
  check('…Reject again: banner closes, nothing loaded, stored ads:false', await page.locator('.orv-cc').count() === 0 && (await gtagScripts(page)).length === 0 && await page.evaluate(() => JSON.parse(localStorage.getItem('orv_consent_v1')).ads === false));
  await page.goto(BASE_URL + '/faq.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  check('…next page in the same debug tab: not asked again, still nothing loaded', await page.locator('.orv-cc').count() === 0 && (await gtagScripts(page)).length === 0 && await page.evaluate(() => orvConsent.get().debugSession === true));
  await ctx.close();
  ({ ctx, page, errors } = await newPage());
  await page.addInitScript((s) => { if (!localStorage.getItem('orv_consent_v1')) localStorage.setItem('orv_consent_v1', JSON.stringify(s)); }, stored(false));
  await page.goto(BASE_URL + DBG, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(400);
  check('debug + stored reject → Accept: tag loads once with config AW-18538836764', (await gtagScripts(page)).length === 1 && (await dl(page)).filter((e) => e[0] === 'config' && e[1] === 'AW-18538836764').length === 1);
  await ctx.close();
  // Stored "accept" + debug: no banner, tag loads once.
  ({ ctx, page, errors } = await newPage());
  await page.addInitScript((s) => localStorage.setItem('orv_consent_v1', JSON.stringify(s)), stored(true));
  await page.goto(BASE_URL + DBG, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  check('debug + stored accept: no banner, tag loaded once', await page.locator('.orv-cc').count() === 0 && (await gtagScripts(page)).length === 1 && (await dl(page)).filter((e) => e[0] === 'config').length === 1);
  check('debug: no conversion / signup / purchase events', !(await dl(page)).some((e) => e[0] === 'event'));
  await ctx.close();
  // Stored "reject" WITHOUT debug: unchanged — no banner, nothing loaded.
  ({ ctx, page, errors } = await newPage());
  await page.addInitScript((s) => localStorage.setItem('orv_consent_v1', JSON.stringify(s)), stored(false));
  await page.goto(BASE_URL + '/pricing.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
  check('normal visit + stored reject: unchanged (no banner, no tag, debugSession false)', await page.locator('.orv-cc').count() === 0 && (await gtagScripts(page)).length === 0 && await page.evaluate(() => orvConsent.get().debugSession === false));
  await ctx.close();

  // ── G. App: Settings → Account ──
  console.log('── G. App ──');
  ({ ctx, page, errors } = await newPage());
  await page.addInitScript(() => { try { localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: true, stats: true, at: new Date().toISOString() })); } catch (_) {} });
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
  await page.evaluate(() => { document.querySelector('.app') && (document.querySelector('.app').style.display = ''); if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-consent', email: 'mock@example.invalid' }); openSettingsModal(); document.querySelector('.smd-ni[data-smd="account"]').click(); });
  await page.waitForTimeout(300);
  await page.click('#smdp-account [data-cookie-settings]'); await page.waitForTimeout(200);
  check('app Settings → Account "Cookie settings" opens the consent settings', await page.locator('.orv-cc[data-cc-view="settings"]').count() === 1);
  check('app: stored accept honoured (tag loaded once)', (await gtagScripts(page)).length === 1);
  const langs = await page.evaluate(() => ['en', 'nl', 'de', 'fr', 'es', 'pt'].map((l) => !!(LANG_STRINGS[l] && LANG_STRINGS[l].smdCookieTitle && LANG_STRINGS[l].smdCookieSub && LANG_STRINGS[l].smdCookieBtn)));
  check('app strings in all six languages', langs.every(Boolean), JSON.stringify(langs));
  check('no JavaScript errors in the app', errors.length === 0, errors.slice(0, 3).join('; '));
  await ctx.close();

  await browser.close();
  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
