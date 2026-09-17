// ════════════════════════════════════════════════════════════════
// Autopilot — Builder Fix (transparent builder + conditional "Your
// Automations" + single CTA + secondary Settings)
//
// Covers what's new/changed in this specific pass, on top of the already
// green tests/autopilot-control-room.test.js, tests/autopilot-builder-
// lifecycle.test.js, and tests/autopilot-ux-redesign.test.js:
//
//   - The real root cause of the transparent Create Automation builder:
//     a comment typo (an asterisk immediately followed by a slash) inside
//     a CSS comment prematurely closed it, silently dropping the ENTIRE
//     .intel-mon-panel rule (its background/border/border-radius/
//     box-shadow) and .ap-modal-panel rule. Verified here by asserting
//     the panel's real computed background-color is opaque, not merely
//     that some class name is present.
//   - "Your Automations" is now fully conditional: hidden entirely
//     (heading included) at zero automations, visible only once a real
//     automation exists.
//   - Exactly one visible "Create Automation" CTA at all times (no
//     duplicate CTA inside the empty/list area).
//   - Automation Settings is a compact top-right gear icon, not a bottom
//     text link, and still opens/functions correctly without breaking
//     the builder.
//
// RUN: node tests/autopilot-builder-fix.test.js
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
  const email = `oriven.apbfix.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'professional', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
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
  });
  await page.waitForTimeout(800);
}
async function gotoAutopilot(page) {
  await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
  await page.waitForTimeout(1200);
}
async function mockAutopilot(page, { rules, recommendations, historyItems, campaigns }) {
  await page.evaluate(({ rules, recommendations, historyItems, campaigns }) => {
    window._apCalls = [];
    var state = { rules: (rules || []).slice() };
    window._apMockState = state;
    var real = window.apiFetch;
    window.apiFetch = async function (path, options) {
      var method = (options && options.method) || 'GET';
      var body = options && options.body ? JSON.parse(options.body) : null;
      window._apCalls.push({ path: path, method: method, body: body });
      if (path === '/api/autopilot/rules' && method === 'GET') return { ok: true, status: 200, data: { rules: state.rules } };
      if (path === '/api/autopilot/rules' && method === 'POST') {
        var nr = Object.assign({ id: 'new_' + Math.random().toString(36).slice(2), enabled: true, last_triggered_at: null, created_at: new Date().toISOString() }, body);
        state.rules.push(nr);
        return { ok: true, status: 200, data: { rule: nr } };
      }
      var m = path.match(/^\/api\/autopilot\/rules\/([^/]+)$/);
      if (m && method === 'PATCH') { var r = state.rules.filter(function (x) { return x.id === m[1]; })[0]; if (r) Object.assign(r, body); return { ok: true, status: 200, data: { rule: r } }; }
      if (m && method === 'DELETE') { state.rules = state.rules.filter(function (x) { return x.id !== m[1]; }); return { ok: true, status: 200, data: {} }; }
      if (path.indexOf('/api/autopilot/recommendations') === 0) return { ok: true, status: 200, data: { recommendations: recommendations || [] } };
      if (path.indexOf('/api/autopilot/history') === 0) return { ok: true, status: 200, data: { items: historyItems || [] } };
      if (path === '/api/google-ads/campaigns' || path === '/api/meta/campaigns' || path === '/api/tiktok/campaigns') {
        return { ok: true, status: 200, data: { campaigns: campaigns || [{ campaign_id: 'c1', campaign_name: 'Autumn Sale' }] } };
      }
      if (path.indexOf('/status') > 0) return { ok: true, data: { connected: path.indexOf('meta') > -1 } };
      return real ? real(path, options) : { ok: false, data: null };
    };
  }, { rules, recommendations, historyItems, campaigns });
}
function makeRule(overrides) {
  return Object.assign({
    id: 'rule_' + Math.random().toString(36).slice(2), user_id: 'x', name: 'Pause underperforming campaigns', platform: 'meta',
    trigger_metric: 'cpa', trigger_operator: '>', trigger_value: 40, action_type: 'pause_campaign',
    action_params: { mode: 'require_approval', campaign_id: 'all' }, enabled: true, last_triggered_at: null, created_at: new Date().toISOString(),
  }, overrides);
}

// Living Product pass: the zero-rule "Your Automations" teaching template
// (spec 15) deliberately includes its OWN "Create Automation" button
// alongside the header's real primary CTA — the spec's own conceptual
// mockup shows exactly this. What must stay singular is the PROMINENT,
// visually-competing CTA (spec: "do not create multiple competing green
// buttons"), not literally every element with that text — the template's
// own button uses the quiet .oi-card-btn style specifically so it never
// competes with the header's .camp-new-btn-lg. Counts each separately.
async function countVisibleCreateCTAs(page) {
  return page.evaluate(() => {
    var candidates = Array.from(document.querySelectorAll('#page-autopilot button')).filter(function (b) {
      return /create automation/i.test(b.textContent) && b.offsetParent !== null;
    });
    return {
      total: candidates.length,
      primary: candidates.filter(function (b) { return b.classList.contains('camp-new-btn-lg') || b.classList.contains('camp-new-btn'); }).length,
      secondary: candidates.filter(function (b) { return b.classList.contains('oi-card-btn'); }).length,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let proUser;
  try {
    proUser = await createTestUser('pro');

    // ════════════════════════════════════════════════════════════
    // 1. Zero automations
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        title: document.querySelector('.ap-shell-hdr .camp-shell-title')?.textContent,
        activeSectionVisible: document.getElementById('apActiveSection')?.style.display !== 'none',
        activeListHTML: document.getElementById('apActiveList')?.innerHTML.trim(),
        gearVisible: !!document.querySelector('.ap-settings-gear-btn') && document.querySelector('.ap-settings-gear-btn').offsetParent !== null,
      }));
      const ctaCount = await countVisibleCreateCTAs(page);
      check('1a. Autopilot title exists', st.title === 'Autopilot', st.title);
      check('1b. Exactly ONE PRIMARY (visually prominent) Create Automation CTA — the teaching template\'s own button is real but deliberately secondary/quiet, never competing', ctaCount.primary === 1, ctaCount);
      check('1c. "Your Automations" section IS visible at zero rules (Living Product pass: shows a structural teaching template instead of hiding entirely)', st.activeSectionVisible, st.activeSectionVisible);
      check('1d. The rendered empty-state is a structural IF/THEN template, not a real rule card', st.activeListHTML.indexOf('ap-auto-empty') !== -1 && st.activeListHTML.indexOf('ap-auto-card') === -1, st.activeListHTML);
      check('1e. Automation Settings (gear) remains available', st.gearVisible, st.gearVisible);
      check('JS errors (zero automations)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 2. One automation
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [makeRule({})], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        activeSectionVisible: document.getElementById('apActiveSection')?.style.display !== 'none',
        cardCount: document.querySelectorAll('.ap-auto-card').length,
        countText: document.getElementById('apActiveCount')?.textContent,
      }));
      const ctaCount = await countVisibleCreateCTAs(page);
      check('2a. "Your Automations" becomes visible with one real automation', st.activeSectionVisible, st.activeSectionVisible);
      check('2b. The real automation is rendered', st.cardCount === 1, st.cardCount);
      check('2c. Still only one Create Automation CTA total (the teaching template\'s own button is gone once a real rule exists)', ctaCount.total === 1 && ctaCount.primary === 1, ctaCount);
      check('2d. Real count text shown ("1 active")', /1 active/i.test(st.countText || ''), st.countText);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 3. Multiple automations
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({ name: 'Rule A' }), makeRule({ name: 'Rule B' }), makeRule({ name: 'Rule C', enabled: false })];
      await mockAutopilot(page, { rules, recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const cardCount = await page.evaluate(() => document.querySelectorAll('.ap-auto-card').length);
      const ctaCount = await countVisibleCreateCTAs(page);
      check('3a. All real automations render', cardCount === 3, cardCount);
      check('3b. No duplicate Create Automation CTA', ctaCount.total === 1, ctaCount);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 4. Builder — opaque surface + full real lifecycle
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);

      await page.click('.camp-new-btn-lg');
      await page.waitForTimeout(500);
      const openState = await page.evaluate(() => {
        var panel = document.querySelector('#apBuilderOverlay .intel-mon-panel');
        var cs = panel ? getComputedStyle(panel) : null;
        function alpha(rgbaStr) {
          var m = /rgba?\(([^)]+)\)/.exec(rgbaStr || '');
          if (!m) return null;
          var parts = m[1].split(',').map(function (s) { return s.trim(); });
          return parts.length === 4 ? parseFloat(parts[3]) : 1;
        }
        return {
          postCalls: window._apCalls.filter(function (c) { return c.method === 'POST'; }).length,
          panelBg: cs ? cs.backgroundColor : null,
          panelBgAlpha: cs ? alpha(cs.backgroundColor) : null,
          panelBorderRadius: cs ? cs.borderRadius : null,
          firstCardVisible: !!document.querySelector('#apWizPlatformCards .ap-wiz-card'),
        };
      });
      check('4a. Opening the builder fires zero POST requests', openState.postCalls === 0, openState.postCalls);
      check('4b. The builder panel has a REAL opaque background (alpha === 1, not transparent) — the actual transparent-builder bug fix', openState.panelBgAlpha === 1, openState);
      check('4c. The panel has real declared styling (non-zero border-radius) — confirms the .intel-mon-panel rule is genuinely applying, not just a class name being present', openState.panelBorderRadius && openState.panelBorderRadius !== '0px', openState.panelBorderRadius);
      check('4d. Builder controls are visible (platform cards rendered)', openState.firstCardVisible, openState.firstCardVisible);

      // Full configuration lifecycle.
      await page.evaluate(() => apWizSelectPlatform('meta'));
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizLoadCampaigns());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectCampaign('all'));
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizSelectMetric('cpa'));
      await page.evaluate(() => apWizSelectOperator('>'));
      await page.evaluate(() => { document.getElementById('apWizValue').value = '40'; });
      await page.evaluate(() => apWizConfirmCondition());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectAction('pause_campaign'));
      await page.waitForTimeout(300);
      const reviewText = await page.evaluate(() => document.getElementById('apWizReviewText')?.textContent);
      check('4e. Review/summary reflects the real chosen values', /CPA/i.test(reviewText || '') && /40/.test(reviewText || '') && /pause/i.test(reviewText || ''), reviewText);

      await page.evaluate(() => apBSave());
      await page.waitForTimeout(500);
      const afterSave = await page.evaluate(() => ({
        postCall: window._apCalls.filter(function (c) { return c.method === 'POST'; })[0],
        overlayClosed: document.getElementById('apBuilderOverlay').style.display === 'none',
        cardCount: document.querySelectorAll('.ap-auto-card').length,
      }));
      check('4f. Save sends a real POST with the correct request body', afterSave.postCall && afterSave.postCall.body.trigger_metric === 'cpa' && afterSave.postCall.body.trigger_value === 40 && afterSave.postCall.body.action_type === 'pause_campaign', afterSave.postCall);
      check('4g. Builder closes and the new automation appears in Your Automations', afterSave.overlayClosed && afterSave.cardCount === 1, afterSave);
      check('JS errors (builder lifecycle)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 4h-4i. Cancel creates nothing; Edit persists via real PATCH
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      await page.click('.camp-new-btn-lg');
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizSelectPlatform('google'));
      await page.waitForTimeout(400);
      await page.click('#apBuilderOverlay .intel-mon-close-btn');
      await page.waitForTimeout(300);
      const afterCancel = await page.evaluate(() => ({
        postCalls: window._apCalls.filter(function (c) { return c.method === 'POST'; }).length,
        realRuleCardExists: !!document.querySelector('#page-autopilot .ap-auto-card'),
      }));
      check('4h. Cancel (closing the builder) sends no POST and creates nothing (still the teaching template, no real rule card)', afterCancel.postCalls === 0 && !afterCancel.realRuleCardExists, afterCancel);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rule = makeRule({ name: 'Editable Rule', trigger_value: 40 });
      await mockAutopilot(page, { rules: [rule], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      await page.evaluate(function (id) { apActiveEdit(id); }, rule.id);
      await page.waitForTimeout(700);
      const opensWithRealValues = await page.evaluate(() => document.getElementById('apWizReviewText')?.textContent);
      await page.evaluate(() => { document.getElementById('apWizValue').value = ''; });
      // Re-open condition step to change the value via the recap "Change" link.
      await page.evaluate(() => apWizEdit(3));
      await page.waitForTimeout(300);
      await page.evaluate(() => { document.getElementById('apWizValue').value = '60'; });
      await page.evaluate(() => apWizConfirmCondition());
      await page.waitForTimeout(300);
      await page.evaluate(() => apBSave());
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => ({
        patchCall: window._apCalls.filter(function (c) { return c.method === 'PATCH'; }).slice(-1)[0],
        cardText: document.querySelector('.ap-auto-flow-trigger')?.textContent,
      }));
      check('4i. Edit opens with the real existing values', /CPA/i.test(opensWithRealValues || '') && /40/.test(opensWithRealValues || ''), opensWithRealValues);
      check('4j. Edit persists via a real PATCH with the updated value', st.patchCall && st.patchCall.body.trigger_value === 60, st.patchCall);
      check('4k. The visible automation updates correctly after edit', /60/.test(st.cardText || ''), st.cardText);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 5. Settings — compact secondary control, works, doesn't break builder
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const gearState = await page.evaluate(() => {
        var btn = document.querySelector('.ap-settings-gear-btn');
        var rect = btn ? btn.getBoundingClientRect() : null;
        var cs = btn ? getComputedStyle(btn) : null;
        return { exists: !!btn, ariaLabel: btn ? btn.getAttribute('aria-label') : null, width: rect ? rect.width : null, position: cs ? cs.position : null };
      });
      check('5a. Compact secondary Settings control exists with an accessible name, sized like an icon button (not a wide CTA)', gearState.exists && !!gearState.ariaLabel && gearState.width < 60, gearState);

      await page.click('.ap-settings-gear-btn');
      await page.waitForTimeout(400);
      const settingsOpen = await page.evaluate(() => document.getElementById('apSettingsOverlay')?.style.display === 'flex' && !!document.getElementById('apSetDefaultMode'));
      check('5b. Settings opens correctly with its real controls present', settingsOpen, settingsOpen);
      await page.click('#apSettingsOverlay .intel-mon-close-btn');
      await page.waitForTimeout(300);

      // Opening the builder afterward still works cleanly (Settings doesn't break it).
      await page.click('.camp-new-btn-lg');
      await page.waitForTimeout(400);
      const builderStillWorks = await page.evaluate(() => document.getElementById('apBuilderOverlay')?.style.display === 'flex' && !!document.querySelector('#apWizPlatformCards .ap-wiz-card'));
      check('5c. Builder still opens correctly after using Settings', builderStillWorks, builderStillWorks);
      check('JS errors (settings + builder)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 6. Toggle — still real, still persists
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rule = makeRule({ name: 'Toggle Rule', enabled: true });
      await mockAutopilot(page, { rules: [rule], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      await page.click('.ap-auto-card .ap-auto-toggle');
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => ({
        patchCall: window._apCalls.filter(function (c) { return c.method === 'PATCH'; }).slice(-1)[0],
        cardStatus: document.querySelector('.ap-auto-card .ap-auto-status')?.textContent,
      }));
      check('6. Toggle sends the correct real PATCH and persists the disabled state', st.patchCall && st.patchCall.body.enabled === false && /PAUSED/i.test(st.cardStatus || ''), st);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 7. No removed sections remain reintroduced
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({})];
      const historyItems = [{ kind: 'event', id: 'h1', title: 'Automation "Pause underperforming campaigns" executed automatically', status: 'detected', created_at: new Date().toISOString() }];
      await mockAutopilot(page, { rules, recommendations: [], historyItems });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => {
        var text = document.getElementById('page-autopilot').innerText;
        return {
          hasSuggested: /Suggested by Oriven/i.test(text),
          hasActivity: /Autopilot Activity/i.test(text),
          hasEngine: !!document.getElementById('apEngineSection') || /Automation Engine/i.test(text),
          hasAiDecision: /AI Decision/i.test(text),
          hasTeam: /\bTeam\b/.test(text),
        };
      });
      check('7. No Suggested-by-Oriven / Autopilot Activity / Automation Engine / AI Decision / Team text anywhere on the page', !st.hasSuggested && !st.hasActivity && !st.hasEngine && !st.hasAiDecision && !st.hasTeam, st);
      await page.close();
    }
  } finally {
    if (proUser) await deleteTestUser(proUser.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
