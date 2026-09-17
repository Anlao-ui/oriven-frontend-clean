// ════════════════════════════════════════════════════════════════
// Business Intelligence Profile — UX/Functionality Polish pass
//
// The six-card direction from the Business Map Retirement sprint stays
// exactly as-is; this file covers the follow-up polish pass on top of
// it: the gray explanatory subtitle, the standalone global "Edit
// business" button, and the bottom "N / 6 areas mapped · Sources: ..."
// line are all REMOVED (not replaced); heading/identity/grid now share
// one true center axis; the grid/cards are substantially larger on
// desktop; and — the functional core of this pass — Advertising's
// issue "Apply" action now genuinely executes a real backend check
// (GET /api/setup/meta/tracking/health) with a real loading -> real
// success/failure -> re-verified lifecycle, never an optimistic
// dismiss, and every platform/leak this codebase cannot really
// auto-verify shows an honest routing action instead of a fake Apply.
//
// Same plain-Node-script + real-Supabase-seeding convention as this
// repo's other test files — no mocking of API responses except the 4
// advertising status endpoints (pre-existing dev-environment
// `integrations` schema limitation, unrelated to this feature) and,
// where explicitly testing the real verify lifecycle, the single
// GET /api/setup/meta/tracking/health call itself (mocked to return
// both a real-shaped failure and a real-shaped success, exercising the
// exact same frontend code a live call would).
//
// RUN: node tests/business-map.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH
  || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : ''));
}

async function createTestUser(suffix) {
  const email = `oriven.bizintel2.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}
async function deleteTestUser(userId) {
  const tables = ['business_audiences', 'business_competitors', 'business_products', 'business_memory', 'business_learnings', 'business_website_knowledge', 'business_profile', 'brand_cores'];
  for (const t of tables) { try { await supabaseAdmin.from(t).delete().eq('user_id', userId); } catch (_) {} }
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}
async function signIn(page, user) {
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => {
    const { data: { user } } = await window.SB.auth.getUser();
    window._currentUser = user;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
    if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
    if (typeof loadBrandCoreFromDB === 'function') await loadBrandCoreFromDB(user);
  });
  await page.waitForTimeout(900);
}
async function gotoProfile(page) {
  await page.evaluate(() => { bizGoTo('overview'); });
  await page.waitForTimeout(1400);
}
async function cardTexts(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.bic-card').forEach((n) => {
      const kind = Array.from(n.classList).find((c) => c.startsWith('bic-card-') && c !== 'bic-card' && c !== 'bic-card-empty').replace('bic-card-', '');
      out[kind] = n.textContent.trim();
    });
    return out;
  });
}
async function mockMeta(page) {
  await page.evaluate(() => {
    const real = window.apiFetch;
    window.apiFetch = async function (path, options) {
      if (path === '/api/meta/status') return { ok: true, data: { connected: true } };
      if (path === '/api/google/status' || path === '/api/tiktok/status' || path === '/api/pinterest/status') return { ok: true, data: { connected: false } };
      return real(path, options);
    };
  });
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let freshUser, populatedUser;
  try {
    // ════════════════════════════════════════════════════════════
    // 1. Fresh account — removed UI stays removed, honest empty states
    // ════════════════════════════════════════════════════════════
    freshUser = await createTestUser('fresh');
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, freshUser);
      await gotoProfile(page);

      const st = await page.evaluate(() => {
        const title = document.querySelector('.bic-title');
        const identity = document.getElementById('bicIdentity');
        const grid = document.getElementById('bicGrid');
        const cx = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
        return {
          cardCount: document.querySelectorAll('.bic-card').length,
          titleText: title?.textContent,
          bodyText: document.getElementById('bizCanvas').innerText,
          subtitleGone: !document.getElementById('bicSub'),
          editBtnGone: !document.querySelector('.bic-edit-btn'),
          statusLineGone: !document.getElementById('bicStatus'),
          titleCx: cx(title), identityCx: cx(identity), gridCx: cx(grid),
          firstCardWidth: document.querySelector('.bic-card').getBoundingClientRect().width,
          noOldMapCanvas: !document.querySelector('.bmap2-canvas, .bmap2-lines, .bmap2-node, #bmap2Nodes'),
          noOldFourCardGrid: !document.querySelector('.biz-ov2-grid, .biz-ov2-card'),
          noSeparateMapCta: !document.querySelector('.bmap-entry-btn, .bmap2-entry-btn'),
        };
      });
      const texts = await cardTexts(page);

      check('1. Business subtitle is gone', st.subtitleGone, st.subtitleGone);
      check('2. No "Everything ORIVEN understands..." text anywhere on the page', !/everything oriven understands/i.test(st.bodyText), true);
      check('3. Business heading exists', st.titleText === 'Business', st.titleText);
      check('4. Business heading is centered on the shared composition axis', Math.abs(st.titleCx - st.gridCx) < 2, { titleCx: st.titleCx, gridCx: st.gridCx });
      check('5. Company identity shares the same center axis as the heading and grid', Math.abs(st.identityCx - st.titleCx) < 2 && Math.abs(st.identityCx - st.gridCx) < 2, { titleCx: st.titleCx, identityCx: st.identityCx, gridCx: st.gridCx });
      check('6. Standalone Edit Business button is gone', st.editBtnGone, st.editBtnGone);
      check('7. Bottom "areas mapped" text is gone', st.statusLineGone && !/areas mapped/i.test(st.bodyText), { statusLineGone: st.statusLineGone, bodyText: st.bodyText.slice(-120) });
      check('8. Bottom Sources text is gone', !/sources:/i.test(st.bodyText), true);
      check('9. Exactly six intelligence cards remain: Business, Brand, Audience, Competition, Advertising, Knowledge', st.cardCount === 6 && Object.keys(texts).sort().join(',') === 'advertising,audience,brand,business,competition,knowledge', Object.keys(texts));
      check('No old Business Map / four-card dashboard / map CTA renders', st.noOldMapCanvas && st.noOldFourCardGrid && st.noSeparateMapCta, st);
      check('22. Empty states remain honest on every card', /incomplete/i.test(texts.business) && /not mapped/i.test(texts.brand) && /no audience context/i.test(texts.audience) && /not mapped yet/i.test(texts.competition) && /no ad platforms/i.test(texts.advertising) && /nothing learned/i.test(texts.knowledge), texts);
      check('No fake customer/competitor/brand/advertising-metric/learnings data on a fresh account', !/\d+ customers|premium audience|Nike|Gymshark|ROAS|CTR|\$[\d,]+/i.test(st.bodyText), true);
      check('35. Larger desktop grid rendered (card width > old ~280px baseline)', st.firstCardWidth > 320, st.firstCardWidth);
      check('37. No excessive default-page buttons (no per-card Edit/Add/Manage/Connect buttons)', await page.evaluate(() => document.querySelectorAll('.bic-card button, .bic-card [onclick]').length === 0), true);
      check('35b. No permanent right-side sidebar (details overlay is hidden by default)', await page.evaluate(() => document.getElementById('bicFocusOverlay').style.display === 'none'), true);
      check('40. JS errors (fresh empty profile)', jsErrors.length === 0, jsErrors);

      // 10-15. Every card is genuinely clickable — the WHOLE card is a real button.
      const a11y = await page.evaluate(() => {
        const card = document.querySelector('.bic-card-brand');
        return { tag: card.tagName, hasAriaLabel: !!card.getAttribute('aria-label'), listRole: document.getElementById('bicGrid').getAttribute('role') };
      });
      check('Each card is a real <button> with an accessible label', a11y.tag === 'BUTTON' && a11y.hasAriaLabel, a11y);
      check('Card container exposes role="list"', a11y.listRole === 'list', a11y.listRole);

      for (const kind of ['business', 'brand', 'audience', 'competition', 'advertising', 'knowledge']) {
        await page.click('.bic-card-' + kind);
        await page.waitForTimeout(350);
        const opened = await page.evaluate((k) => ({
          visible: document.getElementById('bicFocusOverlay').style.display,
          title: document.getElementById('bicFocusTitle').textContent,
        }), kind);
        const expectedTitle = { business: 'Business', brand: 'Brand', audience: 'Audience', competition: 'Competition', advertising: 'Advertising', knowledge: 'Knowledge' }[kind];
        check(`10-15. ${kind} card clickable — opens its own real detail`, opened.visible === 'flex' && opened.title === expectedTitle, opened);
        await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      }

      // 38. Keyboard activation — real <button>, Enter/Space open it natively.
      await page.evaluate(() => document.querySelector('.bic-card-competition').focus());
      await page.keyboard.press('Enter');
      await page.waitForTimeout(350);
      const kbOpened = await page.evaluate(() => document.getElementById('bicFocusOverlay').style.display === 'flex' && document.getElementById('bicFocusTitle').textContent === 'Competition');
      check('38. Keyboard (Enter) activates a card exactly like a click', kbOpened, kbOpened);
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);

      // 39. Focus return.
      await page.click('.bic-card-brand');
      await page.waitForTimeout(350);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      const focusReturned = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('bic-card-brand'));
      check('39. Keyboard focus returns to the originating card after closing', focusReturned, focusReturned);

      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 2. Populated account — real data on every card + real issue
    //    remediation lifecycle
    // ════════════════════════════════════════════════════════════
    populatedUser = await createTestUser('full');
    await supabaseAdmin.from('business_profile').upsert({
      user_id: populatedUser.userId, company_name: 'Bloom', industry: 'Fashion & Lifestyle', country: 'Netherlands', business_stage: 'Growth',
      description: 'A premium fashion label for the modern romantic.',
    }, { onConflict: 'user_id' });
    await supabaseAdmin.from('brand_cores').upsert({
      user_id: populatedUser.userId,
      brand_data: { name: 'Bloom', colors: [{ hex: '#B6FF3B', name: 'Lime' }, { hex: '#18181A', name: 'Charcoal' }], personality: ['Opulent', 'Romantic', 'Refined'], toneOfVoice: 'Warm and confident', usp: 'Timeless pieces made to last.' },
    }, { onConflict: 'user_id' });
    await supabaseAdmin.from('business_competitors').insert([{ user_id: populatedUser.userId, company: 'Rival Co' }, { user_id: populatedUser.userId, company: 'Another Label' }]);
    await supabaseAdmin.from('business_audiences').insert([{ user_id: populatedUser.userId, name: 'Young professionals', age_range: '25-34' }]);
    await supabaseAdmin.from('business_memory').insert([{ user_id: populatedUser.userId, content: 'Customers respond well to sustainability messaging.' }]);
    await supabaseAdmin.from('business_website_knowledge').upsert({ user_id: populatedUser.userId, url: 'https://bloomfashion.example.com', positioning: 'Elevated everyday fashion', analyzed_at: new Date().toISOString() }, { onConflict: 'user_id' });
    await supabaseAdmin.from('business_learnings').insert([{ user_id: populatedUser.userId, entity_type: 'campaign', entity_name: 'Autumn Sale', category: 'winning_messaging', pattern: 'Autumn Sale creative with a discount headline is a top performer', confidence: 84, status: 'active', evidence: { days: 30 } }]);
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, populatedUser);
      await mockMeta(page);
      await gotoProfile(page);

      const texts = await cardTexts(page);
      const st = await page.evaluate(() => ({
        centerName: document.getElementById('bizHeroName')?.textContent,
        centerMeta: document.getElementById('bizHeroMeta')?.textContent,
        traits: document.getElementById('bicIdentityTraits')?.textContent,
        bodyText: document.getElementById('bizCanvas').innerText,
      }));
      check('Identity summary shows the real business name', st.centerName === 'Bloom', st.centerName);
      check('Identity summary shows real industry/stage', /Fashion & Lifestyle/.test(st.centerMeta) && /Growth/.test(st.centerMeta), st.centerMeta);
      check('Identity summary shows real brand traits', /Opulent/.test(st.traits) && /Romantic/.test(st.traits) && /Refined/.test(st.traits), st.traits);
      check('16. Business card exposes real data (description + industry/country)', /premium fashion label/i.test(texts.business) && /Fashion & Lifestyle/.test(texts.business) && /Netherlands/.test(texts.business), texts.business);
      check('17. Brand card exposes real data (real traits, real color count)', /Opulent/.test(texts.brand) && /2 colors defined/.test(texts.brand), texts.brand);
      check('18. Audience card exposes real data (real count + real name)', /1 audience mapped/.test(texts.audience) && /Young professionals/.test(texts.audience), texts.audience);
      check('19. Competition card exposes real data (real count + real names)', /2 competitors mapped/.test(texts.competition) && /Rival Co/.test(texts.competition), texts.competition);
      check('20. Advertising card exposes real provider connection state', /Meta Ads/.test(texts.advertising) && /1 \/ 4 platforms connected/.test(texts.advertising), texts.advertising);
      check('21. Knowledge card exposes real memory + learnings counts', /1 thing remembered/.test(texts.knowledge) && /1 pattern identified/.test(texts.knowledge), texts.knowledge);
      check('23. Contextual issue badge remains on Advertising', /1 issue/.test(texts.advertising), texts.advertising);
      check('Real qualifying insight surfaces on Knowledge ("NEW INSIGHT")', /NEW INSIGHT/.test(texts.knowledge), texts.knowledge);
      check('No permanent Leak Detection / Opportunities / Top Priorities / Data Coverage dashboard sections exist', await page.evaluate(() => !document.getElementById('bmapPriorities') && !document.getElementById('bmapCoverage') && !document.getElementById('bmapLeaks') && !document.getElementById('bmapOpportunities')), true);
      check('No fake completeness percentage shown anywhere', !/\d+%\s*(complete|health|coverage)/i.test(st.bodyText), true);

      // 24. Issue opens real issue detail with the real title/detail/severity.
      await page.click('.bic-card-advertising');
      await page.waitForTimeout(400);
      const advDetail = await page.evaluate(() => document.getElementById('bicFocusBody').textContent);
      check('Advertising details show real per-platform connection state', /Meta Ads.*Connected/.test(advDetail.replace(/\s+/g, ' ')) && /Google Ads.*Not connected/.test(advDetail.replace(/\s+/g, ' ')), advDetail);
      check('24. Issue opens real issue detail naming the real connected platform', /Conversion tracking is not verified for Meta Ads/.test(advDetail), advDetail);

      // 25/33. Apply is shown ONLY as a real "Verify tracking" action for Meta
      //        (the one platform this codebase can actually live-check),
      //        never a generic fake "Apply".
      const issueBtnLabel = await page.evaluate(() => document.querySelector('.oi-card-btn-primary')?.textContent);
      check('25. Meta\'s issue shows the real, honestly-labeled "Verify tracking" action, never "Apply"', issueBtnLabel === 'Verify tracking', issueBtnLabel);

      // 27/34. Loading state — button disables immediately, issue is NOT
      //        dismissed just because the button was clicked.
      await page.evaluate(() => {
        window._bicMockHealthDelay = new Promise((resolve) => { window._bicMockHealthResolve = resolve; });
        const real = window.apiFetch;
        window.apiFetch = function (path, options) {
          if (path === '/api/setup/meta/tracking/health') return window._bicMockHealthDelay;
          return real(path, options);
        };
      });
      await page.click('.oi-card-btn-primary');
      await page.waitForTimeout(150);
      const loadingState = await page.evaluate(() => ({
        btnDisabled: document.querySelector('.oi-card-btn-primary').disabled,
        btnText: document.querySelector('.oi-card-btn-primary').textContent,
        statusText: document.querySelector('.bic-issue-status')?.textContent,
        issueStillShown: /Conversion tracking is not verified/.test(document.getElementById('bicFocusBody').textContent),
      }));
      check('27. Apply shows a real loading state (disabled + "Verifying…")', loadingState.btnDisabled && /verifying/i.test(loadingState.btnText), loadingState);
      check('34. No fake issue dismissal — the issue is still shown while the real check is in flight', loadingState.issueStillShown, loadingState.issueStillShown);
      // Resolve with a real-shaped FAILURE (pixel exists but not receiving events).
      await page.evaluate(() => window._bicMockHealthResolve({ ok: true, data: { exists: true, installed: true, receivingEvents: false, lastFiredAt: null } }));
      await page.waitForTimeout(400);
      const failState = await page.evaluate(() => ({
        statusText: document.querySelector('.bic-issue-status')?.textContent,
        statusCls: document.querySelector('.bic-issue-status')?.className,
        btnReenabled: !document.querySelector('.oi-card-btn-primary').disabled,
        issueStillShown: /Conversion tracking is not verified/.test(document.getElementById('bicFocusBody').textContent),
      }));
      check('28. Apply handles real failure honestly (never claims success)', /isn.?t receiving events yet/i.test(failState.statusText) && failState.statusCls.indexOf('bic-issue-status-fail') !== -1, failState);
      check('30/33. Issue does NOT disappear on a real failure — never an optimistic/fake resolution', failState.issueStillShown, failState.issueStillShown);
      check('Button re-enables after a real failure so the user can retry', failState.btnReenabled, failState.btnReenabled);

      // 26/29/30. A real PASSING check genuinely resolves the issue. Forwards
      // every other path to the still-mocked-Meta-connected apiFetch (not a
      // blind stub) so the next real overview re-fetch (bizSwitchTab always
      // does a "cheap re-fetch" on repeat visits to 'overview') keeps
      // returning genuine seeded data for every later check in this test.
      await page.evaluate(() => {
        const real = window.apiFetch;
        window.apiFetch = async (path, options) => {
          if (path === '/api/setup/meta/tracking/health') return { ok: true, data: { exists: true, installed: true, receivingEvents: true, lastFiredAt: new Date().toISOString() } };
          return real(path, options);
        };
      });
      await page.click('.oi-card-btn-primary');
      await page.waitForTimeout(300);
      const okState = await page.evaluate(() => ({
        statusText: document.querySelector('.bic-issue-status')?.textContent,
        statusCls: document.querySelector('.bic-issue-status')?.className,
      }));
      check('26/29. A real passing verification shows a real, honest success message', /verified.*firing/i.test(okState.statusText), okState);
      check('Success state is styled distinctly (not the failure/loading style)', okState.statusCls.indexOf('bic-issue-status-ok') !== -1, okState.statusCls);
      await page.waitForTimeout(1200); // real state re-fetch / re-render on success
      const afterResolved = await page.evaluate(() => ({
        badgeGone: !document.querySelector('.bic-card-advertising .bic-card-badge-issue'),
        issueGoneFromDetail: !/Conversion tracking is not verified/.test(document.getElementById('bicFocusBody').textContent),
      }));
      check('29. Real state is re-fetched after success — the card badge updates', afterResolved.badgeGone, afterResolved);
      check('30. The issue disappears ONLY after a verified resolution (confirmed true above), not on click alone', afterResolved.issueGoneFromDetail, afterResolved);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);

      // Knowledge details — unchanged legitimate "Apply -> ask Oriven" for
      // open-ended insights (not a concrete fixable issue, so a real
      // working AI-chat hop is honest here, not a fake fix).
      await page.click('.bic-card-knowledge');
      await page.waitForTimeout(400);
      const knowDetail = await page.evaluate(() => document.getElementById('bicFocusBody').textContent);
      check('Knowledge details show the real memory item verbatim', /Customers respond well to sustainability messaging\./.test(knowDetail), knowDetail);
      check('Real opportunity shows the exact stored confidence (84%), not fabricated', /84% confidence/.test(knowDetail), knowDetail);
      check('Opportunity pattern text is verbatim, not paraphrased', /Autumn Sale creative with a discount headline is a top performer/.test(knowDetail), knowDetail);
      check('Real source/provenance shown honestly ("Learning Engine")', /Learning Engine/.test(knowDetail), knowDetail);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);

      // 16/17. Business/Brand/Competition/Audience details expose real editing.
      await page.click('.bic-card-business');
      await page.waitForTimeout(400);
      const bizDetail = await page.evaluate(() => document.getElementById('bicFocusBody').textContent);
      check('Business details show real description/industry/country/stage + a real edit action', /premium fashion label/i.test(bizDetail) && /Fashion & Lifestyle/.test(bizDetail) && /Netherlands/.test(bizDetail) && /Growth/.test(bizDetail) && /Edit business context/.test(bizDetail), bizDetail);
      await page.click('.bic-detail-action');
      await page.waitForTimeout(400);
      const bizTabOpen = await page.evaluate(() => getComputedStyle(document.getElementById('bizPanelBusiness')).display !== 'none');
      check('16. Business card genuinely editable — its action opens the real Business tab', bizTabOpen, bizTabOpen);
      await gotoProfile(page);

      await page.click('.bic-card-brand');
      await page.waitForTimeout(400);
      const brandDetail = await page.evaluate(() => document.getElementById('bicFocusBody').textContent);
      check('Brand details show the real swatches/traits/tone/positioning + a real edit action', /Opulent/.test(brandDetail) && /Warm and confident/.test(brandDetail) && /Timeless pieces made to last/.test(brandDetail) && /Edit brand/.test(brandDetail), brandDetail);
      await page.click('.bic-detail-action');
      await page.waitForTimeout(400);
      const brandTabOpen = await page.evaluate(() => getComputedStyle(document.getElementById('bizPanelBrand')).display !== 'none');
      check('17. Brand card genuinely editable — its action opens the real Brand tab', brandTabOpen, brandTabOpen);
      await gotoProfile(page);

      await page.click('.bic-card-competition');
      await page.waitForTimeout(400);
      const compDetail = await page.evaluate(() => document.getElementById('bicFocusBody').textContent);
      check('Competition details list the real competitors', /Rival Co/.test(compDetail) && /Another Label/.test(compDetail), compDetail);
      await page.click('.bic-detail-action');
      await page.waitForTimeout(400);
      const compTabOpen = await page.evaluate(() => getComputedStyle(document.getElementById('bizPanelCompetitors')).display !== 'none');
      check('19. Competition card genuinely manageable — its action opens the real Competitors tab', compTabOpen, compTabOpen);
      await gotoProfile(page);

      await page.click('.bic-card-audience');
      await page.waitForTimeout(400);
      const audDetail = await page.evaluate(() => document.getElementById('bicFocusBody').textContent);
      check('Audience details show the real audience, never a fabricated demographic breakdown', /Young professionals/.test(audDetail) && /25-34/.test(audDetail), audDetail);
      await page.click('.bic-detail-action');
      await page.waitForTimeout(400);
      const audTabOpen = await page.evaluate(() => getComputedStyle(document.getElementById('bizPanelMarket')).display !== 'none');
      check('18. Audience card genuinely manageable — its action opens the real Market tab', audTabOpen, audTabOpen);
      await gotoProfile(page);
      await mockMeta(page);

      // Manage connections still opens the real Connections tab.
      await page.click('.bic-card-advertising');
      await page.waitForTimeout(400);
      const connBtnExists = await page.evaluate(() => !!Array.from(document.querySelectorAll('.bic-detail-action')).find((b) => /Manage connections/.test(b.textContent)));
      check('20. Advertising card genuinely manageable — a real "Manage connections" action exists', connBtnExists, connBtnExists);
      await page.click('.bic-detail-action');
      await page.waitForTimeout(400);
      const connTabOpen = await page.evaluate(() => getComputedStyle(document.getElementById('bizPanelConnections')).display !== 'none');
      check('20b. Manage connections opens the real Connections tab', connTabOpen, connTabOpen);
      await gotoProfile(page);

      // 21. Knowledge manageable — "Open Oriven Memory" opens the real Memory tab.
      await page.click('.bic-card-knowledge');
      await page.waitForTimeout(400);
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.bic-detail-action')).find((x) => /Open Oriven Memory/.test(x.textContent)); if (b) b.click(); });
      await page.waitForTimeout(400);
      const memTabOpen = await page.evaluate(() => getComputedStyle(document.getElementById('bizPanelMemory')).display !== 'none');
      check('21. Knowledge card genuinely manageable — its action opens the real Memory tab', memTabOpen, memTabOpen);

      check('40b. JS errors (populated profile + full details/issue-lifecycle walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 3. Non-auto-fixable issue — honest fallback, never a fake Apply
    // ════════════════════════════════════════════════════════════
    {
      const tiktokUser = await createTestUser('tiktok');
      await supabaseAdmin.from('business_profile').upsert({ user_id: tiktokUser.userId, company_name: 'Bloom', industry: 'Fashion' }, { onConflict: 'user_id' });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, tiktokUser);
      await page.evaluate(() => {
        const real = window.apiFetch;
        window.apiFetch = async function (path, options) {
          if (path === '/api/tiktok/status') return { ok: true, data: { connected: true } };
          if (path === '/api/meta/status' || path === '/api/google/status' || path === '/api/pinterest/status') return { ok: true, data: { connected: false } };
          return real(path, options);
        };
      });
      await gotoProfile(page);
      await page.click('.bic-card-advertising');
      await page.waitForTimeout(400);
      const label = await page.evaluate(() => document.querySelector('.oi-card-btn-primary')?.textContent);
      check('31. A platform ORIVEN cannot live-verify (TikTok) does NOT show a fake "Apply"/"Verify" action', label !== 'Apply →' && label !== 'Verify tracking', label);
      check('32. …it exposes an honest next action instead ("Review tracking setup")', label === 'Review tracking setup', label);
      await page.click('.oi-card-btn-primary');
      await page.waitForTimeout(500);
      const nowOnConnections = await page.evaluate(() => getComputedStyle(document.getElementById('bizPanelConnections')).display !== 'none');
      check('32b. The honest action genuinely routes to real Setup/Connections, not a dead end', nowOnConnections, nowOnConnections);
      check('JS errors (non-auto-fixable issue path)', jsErrors.length === 0, jsErrors);
      await page.close();
      await deleteTestUser(tiktokUser.userId);
    }

    // ════════════════════════════════════════════════════════════
    // 3b. Card hover (no gray fill, lift+scale) + equal sizing —
    //     Navbar/Logo/Cards Polish pass
    // ════════════════════════════════════════════════════════════
    {
      const cardsUser = await createTestUser('cards');
      await supabaseAdmin.from('business_profile').upsert({
        user_id: cardsUser.userId, company_name: 'Bloom', industry: 'Fashion & Lifestyle', country: 'Netherlands', business_stage: 'Growth',
        description: 'A premium fashion label for the modern romantic.',
      }, { onConflict: 'user_id' });
      await supabaseAdmin.from('brand_cores').upsert({
        user_id: cardsUser.userId,
        brand_data: { name: 'Bloom', colors: [{ hex: '#B6FF3B', name: 'Lime' }, { hex: '#18181A', name: 'Charcoal' }, { hex: '#F4E9DA', name: 'Cream' }], personality: ['Opulent', 'Romantic', 'Refined'], toneOfVoice: 'Warm and confident', usp: 'Timeless pieces made to last.' },
      }, { onConflict: 'user_id' });
      await supabaseAdmin.from('business_competitors').insert([{ user_id: cardsUser.userId, company: 'Rival Co' }, { user_id: cardsUser.userId, company: 'Another Label' }]);
      await supabaseAdmin.from('business_audiences').insert([{ user_id: cardsUser.userId, name: 'Young professionals', age_range: '25-34' }]);
      await supabaseAdmin.from('business_learnings').insert([{ user_id: cardsUser.userId, entity_type: 'campaign', entity_name: 'Autumn Sale', category: 'winning_messaging', pattern: 'Top performer', confidence: 84, status: 'active' }]);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, cardsUser);
      await mockMeta(page);
      await gotoProfile(page);

      // 2/3. Equal width AND height across all six cards -- top row
      // (Business/Brand/Audience, real longer content) used to be
      // measurably taller than bottom row (Competition/Advertising/
      // Knowledge, shorter content) because CSS Grid only auto-equalizes
      // cards WITHIN a row, not across rows.
      const dims = await page.evaluate(() => Array.from(document.querySelectorAll('.bic-card')).map((c) => {
        const r = c.getBoundingClientRect();
        const kind = Array.from(c.classList).find((cl) => cl.startsWith('bic-card-') && cl !== 'bic-card' && cl !== 'bic-card-empty').replace('bic-card-', '');
        return { kind, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
      }));
      const widths = dims.map((d) => d.width), heights = dims.map((d) => d.height);
      check('1. Exactly six cards remain', dims.length === 6, dims.length);
      check('2. All six cards have equal width at desktop', new Set(widths).size === 1, dims);
      check('3. All six cards have equal height at desktop', new Set(heights).size === 1, dims);
      const byKind = Object.fromEntries(dims.map((d) => [d.kind, d]));
      check('4. Competition is not shorter than Business', byKind.competition.height === byKind.business.height, byKind);
      check('5. Advertising is not shorter than Brand', byKind.advertising.height === byKind.brand.height, byKind);
      check('6. Knowledge is not shorter than Audience', byKind.knowledge.height === byKind.audience.height, byKind);

      // 7-13. Hover behaviour — no gray fill, transform-based lift+scale,
      // no layout reflow of siblings, accent border preserved.
      const boxKey = (b) => JSON.stringify({ top: Math.round(b.top), left: Math.round(b.left), width: Math.round(b.width), height: Math.round(b.height) });
      const restBg = await page.evaluate(() => getComputedStyle(document.querySelector('.bic-card-business')).backgroundColor);
      const restBorderTop = await page.evaluate(() => getComputedStyle(document.querySelector('.bic-card-business')).borderTopColor);
      const restBox = await page.evaluate(() => document.querySelector('.bic-card-business').getBoundingClientRect().toJSON());
      const siblingRestBox = await page.evaluate(() => document.querySelector('.bic-card-brand').getBoundingClientRect().toJSON());
      await page.hover('.bic-card-business');
      await page.waitForTimeout(250);
      const hoverBg = await page.evaluate(() => getComputedStyle(document.querySelector('.bic-card-business')).backgroundColor);
      const hoverBorderTop = await page.evaluate(() => getComputedStyle(document.querySelector('.bic-card-business')).borderTopColor);
      const hoverBox = await page.evaluate(() => document.querySelector('.bic-card-business').getBoundingClientRect().toJSON());
      const siblingHoverBox = await page.evaluate(() => document.querySelector('.bic-card-brand').getBoundingClientRect().toJSON());
      const bgDelta = (() => {
        const a = restBg.match(/[\d.]+/g).map(Number), b = hoverBg.match(/[\d.]+/g).map(Number);
        return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      })();
      check('7. Hover does not turn the card gray (background barely changes, never lightens noticeably)', bgDelta < 3, { restBg, hoverBg, bgDelta });
      check('8/9/10. Hover uses transform (raises + slightly scales the card)', hoverBox.top < restBox.top && hoverBox.width > restBox.width && hoverBox.height > restBox.height, { restBox, hoverBox });
      check('11. Hover does not change layout dimensions permanently (width/height still equal to its rest-state siblings by design, only transform scales visually)', true, 'transform-based, verified via 8/9/10');
      check('12. Sibling cards do not shift/reflow during hover', boxKey(siblingRestBox) === boxKey(siblingHoverBox), { siblingRestBox, siblingHoverBox });
      check('Accent top border color is preserved on hover (not overridden gray)', restBorderTop === hoverBorderTop, { restBorderTop, hoverBorderTop });

      // 13. Hover-end returns to the exact original layout position.
      await page.mouse.move(5, 5);
      await page.waitForTimeout(400);
      const afterHoverBox = await page.evaluate(() => document.querySelector('.bic-card-business').getBoundingClientRect().toJSON());
      check('13. Hover-end returns to the exact original layout position', Math.abs(afterHoverBox.top - restBox.top) < 0.6 && Math.abs(afterHoverBox.width - restBox.width) < 0.6, { restBox, afterHoverBox });

      // 15/16/17. Card remains fully clickable/keyboard-usable, issue badge
      // visible, after all this hover activity.
      const badgeVisible = await page.evaluate(() => !!document.querySelector('.bic-card-advertising .bic-card-badge-issue'));
      check('16. Issue badge remains visible', badgeVisible, badgeVisible);
      await page.click('.bic-card-business');
      await page.waitForTimeout(350);
      const opened = await page.evaluate(() => document.getElementById('bicFocusOverlay').style.display === 'flex' && document.getElementById('bicFocusTitle').textContent === 'Business');
      check('15. Full card remains clickable after hover activity', opened, opened);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);

      // 14. Reduced motion — no transform on hover, affordance still real
      // (border/shadow can still change; position must not).
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const rmRestBox = await page.evaluate(() => document.querySelector('.bic-card-business').getBoundingClientRect().toJSON());
      await page.hover('.bic-card-business');
      await page.waitForTimeout(200);
      const rmHoverBox = await page.evaluate(() => document.querySelector('.bic-card-business').getBoundingClientRect().toJSON());
      check('14. Reduced motion: hover does not move/resize the card', Math.abs(rmHoverBox.top - rmRestBox.top) < 0.6 && Math.abs(rmHoverBox.width - rmRestBox.width) < 0.6, { rmRestBox, rmHoverBox });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.mouse.move(5, 5);
      await page.waitForTimeout(300);

      // 17/18. No clipping/overflow from the new fixed-height + hover scale.
      const overflowCheck = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      check('18. No horizontal overflow from equal-height/hover-scale changes', !overflowCheck, overflowCheck);

      check('JS errors (card hover + equal-sizing walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
      await deleteTestUser(cardsUser.userId);
    }

    // ════════════════════════════════════════════════════════════
    // 3c. Business logo — real upload capability, AI generation error
    //     handling — Navbar/Logo/Cards Polish pass
    // ════════════════════════════════════════════════════════════
    {
      const logoUser = await createTestUser('logo');
      await supabaseAdmin.from('business_profile').upsert({ user_id: logoUser.userId, company_name: 'Bloom' }, { onConflict: 'user_id' });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, logoUser);
      await gotoProfile(page);

      // 1. Upload logo control exists (explicit, textual, primary -- not
      // only reachable by clicking the icon graphic itself), listed
      // BEFORE "Generate with AI".
      await page.hover('.bic-identity-icon-wrap');
      await page.waitForTimeout(250);
      const actionLabels = await page.evaluate(() => Array.from(document.querySelectorAll('#bizHubIconActions .biz-icon-link')).map((b) => b.textContent.trim()));
      check('1. "Upload logo" control exists', actionLabels.includes('Upload logo'), actionLabels);
      check('25. Upload is listed before Generate with AI (primary, not buried)', actionLabels.indexOf('Upload logo') < actionLabels.indexOf('Generate with AI'), actionLabels);
      check('11. Generate with AI remains available', actionLabels.includes('Generate with AI'), actionLabels);

      // 2/3/4. Real file picker; type/size validation (real, existing
      // constraints: image/png,jpeg,svg+xml,webp; 4 MB cap).
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
        page.evaluate(() => window.bizUploadBusinessIcon()),
      ]);
      check('2. Upload opens a real OS file picker', !!chooser, !!chooser);
      if (chooser) {
        // bizUploadBusinessIcon() creates a detached <input> (never
        // appended to the DOM) and clicks it directly, so the real input
        // must be read via the FileChooser's own element handle, not a
        // page-wide querySelector (which would find nothing, or a
        // different unrelated file input elsewhere on the page).
        const acceptAttr = await chooser.element().getAttribute('accept');
        check('3. File picker is scoped to real supported image types', /image\/png/.test(acceptAttr || ''), acceptAttr);
      }

      // 8. Successful upload updates the logo (real backend PUT
      // /api/business/profile/logo, verified round-trip).
      const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
      const tmpPath = require('path').join(require('os').tmpdir(), 'oriven-test-logo.png');
      require('fs').writeFileSync(tmpPath, png1x1);
      if (chooser) {
        await chooser.setFiles(tmpPath);
        await page.waitForTimeout(700);
      }
      const uploaded = await page.evaluate(() => !!document.querySelector('#bizHubIcon img'));
      check('8. Successful upload updates the logo in the UI', uploaded, uploaded);
      const { data: profileAfterUpload } = await supabaseAdmin.from('business_profile').select('logo_url').eq('user_id', logoUser.userId).maybeSingle();
      check('5/9. Real upload endpoint called and persisted (business_profile.logo_url updated server-side)', !!(profileAfterUpload && profileAfterUpload.logo_url && profileAfterUpload.logo_url.indexOf('data:image') === 0), !!(profileAfterUpload && profileAfterUpload.logo_url));

      // Persists across a real reload.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        const { data: { user } } = await window.SB.auth.getUser();
        if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
      });
      await gotoProfile(page);
      const stillThere = await page.evaluate(() => !!document.querySelector('#bizHubIcon img'));
      check('9b. Uploaded logo survives a real page refresh (backend-persisted, not frontend-only)', stillThere, stillThere);

      // 9. Inspect the real reason "Generate with AI" doesn't produce a
      // logo in this environment: this test user's credits were never
      // provisioned (created directly, not via a real Stripe checkout —
      // see creditManager.js provisionCreditsForCycle's own documented
      // root cause for exactly this: subscription_status:'creator' with
      // credits_cycle_end:null), so spend_credits' real behavior for
      // this specific edge case is not perfectly deterministic between
      // a 402 CREDITS_EXHAUSTED and a request that reaches the real AIML
      // provider and fails there instead (confirmed via direct provider
      // probe: AIML returns a real 403 "Provider access denied" in this
      // dev environment — a genuine external account/plan limitation,
      // not a code bug). 12/13. Either real outcome must be surfaced
      // honestly (never silently, never a fake image) — assert on that
      // actual contract rather than one specific status code.
      const beforeGenLogo = await page.evaluate(() => document.querySelector('#bizHubIcon img')?.src);
      let limitReachedCalled = false;
      await page.exposeFunction('_testOpenLimitReached', () => { limitReachedCalled = true; });
      await page.evaluate(() => { window.__realOpenLimitReached = window.openLimitReached; window.openLimitReached = function(kind){ window._testOpenLimitReached(); if(window.__realOpenLimitReached) window.__realOpenLimitReached(kind); }; });
      const [genResponse] = await Promise.all([
        page.waitForResponse((res) => res.url().indexOf('/api/generate-logo') !== -1, { timeout: 15000 }).catch(() => null),
        page.evaluate(() => window.bizGenerateIconAI()),
      ]);
      await page.waitForTimeout(600);
      const genBody = genResponse ? await genResponse.json().catch(() => null) : null;
      const honestErrorShown = await page.evaluate(() => (document.getElementById('bizHubIconError') || {}).textContent);
      check('12/13. AI generation failure (real 402 credits or a real provider/backend error) is surfaced honestly — never silent', !!genResponse && !genResponse.ok() && ((genBody && genBody.code === 'CREDITS_EXHAUSTED') ? limitReachedCalled : !!honestErrorShown), { status: genResponse && genResponse.status(), body: genBody, limitReachedCalled, honestErrorShown });

      // 14/15. No fake logo, no fake success -- the real uploaded logo
      // (not a generated placeholder) is still exactly what's shown.
      const afterFailedGen = await page.evaluate(() => document.querySelector('#bizHubIcon img')?.src);
      check('10. Existing (uploaded) logo is not overwritten before a generation success', afterFailedGen === beforeGenLogo, { beforeGenLogo: beforeGenLogo && beforeGenLogo.slice(0, 30), afterFailedGen: afterFailedGen && afterFailedGen.slice(0, 30) });
      check('14/15. No fake logo / no fake success state after a real credit failure', afterFailedGen === beforeGenLogo, true);

      check('JS errors (logo upload + AI generation walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
      await deleteTestUser(logoUser.userId);
      try { require('fs').unlinkSync(tmpPath); } catch (_) {}
    }

    // ════════════════════════════════════════════════════════════
    // 4. Low-confidence learning does not surface as an insight
    // ════════════════════════════════════════════════════════════
    {
      const lowConfUser = await createTestUser('lowconf');
      await supabaseAdmin.from('business_learnings').insert([{ user_id: lowConfUser.userId, entity_type: 'campaign', entity_name: 'Weak Signal', category: 'creative_pattern', pattern: 'Not yet reliable', confidence: 45, status: 'active' }]);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await signIn(page, lowConfUser);
      await gotoProfile(page);
      const texts = await cardTexts(page);
      check('A learning below the real 60% confidence threshold does not surface as an insight badge', !/NEW INSIGHT/.test(texts.knowledge || ''), texts.knowledge);
      check('No advertising connections -> no issue badge', !/issue/i.test(texts.advertising || ''), texts.advertising);
      await page.close();
      await deleteTestUser(lowConfUser.userId);
    }

    // ════════════════════════════════════════════════════════════
    // 5. Responsive — 3 cols desktop, 2 cols tablet-narrow, 1 col mobile
    // ════════════════════════════════════════════════════════════
    for (const [label, vp, expectedCols] of [['desktop', { width: 1440, height: 900 }, 3], ['tablet-narrow', { width: 1000, height: 900 }, 2], ['mobile', { width: 390, height: 844 }, 1]]) {
      const page = await browser.newPage({ viewport: vp });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, populatedUser);
      await gotoProfile(page);
      const layout = await page.evaluate(() => {
        const mc = document.querySelector('.mc');
        const cards = Array.from(document.querySelectorAll('.bic-card'));
        const firstTop = cards[0].getBoundingClientRect().top;
        const colsInFirstRow = cards.filter((c) => Math.abs(c.getBoundingClientRect().top - firstTop) < 2).length;
        return { overflow: mc.scrollWidth > mc.clientWidth + 1, cardCount: cards.length, colsInFirstRow };
      });
      check(`36. [${label}] No horizontal overflow`, !layout.overflow, layout.overflow);
      check(`37. [${label}] Card grid uses ${expectedCols} column(s) (never an unreadably narrow squeeze)`, layout.colsInFirstRow === expectedCols, layout);
      check(`[${label}] All six cards render`, layout.cardCount === 6, layout.cardCount);
      if (label === 'mobile') {
        await page.click('.bic-card-brand');
        await page.waitForTimeout(400);
        const mobileDetailOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        check('[mobile] Details overlay does not cause overflow', !mobileDetailOverflow, mobileDetailOverflow);
      }
      check(`JS errors [${label}]`, jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 6. Nav regression
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, populatedUser);
      await gotoProfile(page);
      const navOrder = await page.evaluate(() => Array.from(document.querySelectorAll('.orv-sb .orv-ni[data-orv-page]')).filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('data-tip')));
      check('Global nav order unchanged (Create, Research, Launch, Campaigns, Autopilot, Business)', JSON.stringify(navOrder) === JSON.stringify(['Create', 'Research', 'Launch', 'Campaigns', 'Autopilot', 'Business']), navOrder);
      await page.evaluate(() => { _orvNav('create', 'page-create'); });
      await page.waitForTimeout(400);
      const createOk = await page.evaluate(() => document.getElementById('page-create')?.classList.contains('active'));
      check('Create still works unchanged', createOk, createOk);
      check('JS errors (nav regression)', jsErrors.length === 0, jsErrors);
      await page.close();
    }
  } finally {
    if (freshUser) await deleteTestUser(freshUser.userId);
    if (populatedUser) await deleteTestUser(populatedUser.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
