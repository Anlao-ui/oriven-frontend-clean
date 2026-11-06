/* ════════════════════════════════════════════════════════════════
   Guided onboarding — the screens in a real browser (js/onboardingFlow.js,
   css/onboarding-flow.css), opened by the real gate (js/onboarding.js) in
   the real app.html.

   SAFETY: a network fence. The page may reach ONLY this test's own server:
   the app's dev API base (http://localhost:5500 — a real backend may be
   running there) is rewritten to an in-process mock of the onboarding
   endpoints, static CDN GETs are allowed, everything else (Supabase,
   Stripe, analytics, any other backend) is aborted. No real users, no AI
   calls, no payments, nothing written anywhere.

   The mock mirrors the server's rules (services/onboardingFlow.js): the plan
   is returned only when the mock account "has paid"; the server's own
   enforcement is tested in oriven-backend/server/tests/onboarding-flow.test.js.

   RUN: node tests/onboarding-flow-ui.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const PORT = 8951, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOTS = path.join(__dirname, '_shots', 'onboarding-flow'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Mock backend ─────────────────────────────────────────────────
const PLAN = {
  summary: 'SECRET-PLAN-SUMMARY: focus on Instagram and email.', overview: { text: 'SECRET overview text' },
  audience: { text: 'Gift shoppers', segments: [{ name: 'Gift shoppers', needs: 'A personal gift' }] },
  positioning: { statement: 'Hand-poured candles from Utrecht', proof_points: ['Poured by hand'] },
  objectives: [{ objective: 'Grow repeat orders', measure: 'Orders a month' }],
  channels: [{ channel: 'Instagram', role: 'Discovery', why: 'Visual', effort: 'medium' }],
  content: { pillars: [{ name: 'Studio', ideas: ['Pouring process'] }], cadence: 'Three posts a week' },
  campaigns: [{ name: 'SECRET-CAMPAIGN workshops', goal: 'Bookings', idea: 'Local promotion' }],
  priorities: ['Set up an email list'],
  roadmap: [{ phase: 'Days 1–30', focus: 'Foundations', actions: ['Set up email'] }, { phase: 'Days 31–60', focus: 'Grow', actions: ['Workshop campaign'] }, { phase: 'Days 61–90', focus: 'Repeat', actions: ['Loyalty offer'] }],
};
const SECRET = /SECRET-PLAN-SUMMARY|SECRET-CAMPAIGN|SECRET overview/;
const M = { calls: [], responses: [] };
function reset(session, opts) {
  M.session = Object.assign({ status: 'in_progress', step: 'welcome', answers: {}, assistant: null, website: null, websiteReadsLeft: 5, plan: { status: 'none', attemptsLeft: 3, error: null }, unlocked: false, missing: [] }, session || {});
  M.paid = false; M.planFails = (opts && opts.planFails) || 0; M.polls = 0; M.calls = []; M.state = null; M.completed = false; M.pending = !!(opts && opts.pending); M.paidReads = 0; M.period = 'monthly';
}
reset();
const ANSWERS = {
  business: { name: 'Bloom & Wick', industry: 'Retail & e-commerce', offer: 'Hand-poured soy candles', area: 'Utrecht', website: 'bloom.example', socials: [] },
  audience: { type: 'b2c', ideal: 'Gift shoppers', location: 'regional', problem: 'Finding a personal gift' },
  offer: { main: 'Soy candles', different: 'Poured by hand', price: 'premium', why: '' },
  goals: { primary: 'sales', secondary: '', success: '50 orders a month' },
  marketing: { channels: ['instagram'], working: ['instagram'], challenge: 'time', paidAds: 'no' },
  budget: { budget: '250_500', time: '2_5', team: 'me' },
};
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json());
app.use('/api', (q, r, n) => { M.calls.push({ m: q.method, p: q.originalUrl.split('?')[0], body: q.body }); n(); });
app.use('/api', (q, r, n) => { if ((q.headers.authorization || '') !== 'Bearer mock-token') return r.status(401).json({ error: 'Authentication required' }); n(); });
const send = (r, status, body) => { M.responses.push(JSON.stringify(body)); r.status(status).json(body); };
// The server's onboarding gate (server.js): until payment completes the
// onboarding, every app route answers 403 ONBOARDING_REQUIRED.
const GATE_OPEN = /^\/api\/(onboarding\/|events$|t$|create-checkout-session$|billing\/sync-checkout$|get-subscription$|user\/preferences$|profile\/|email\/)/;
app.use('/api', (q, r, n) => {
  const gated = !M.state && !M.completed && !M.paid;
  if (gated && !GATE_OPEN.test(q.originalUrl.split('?')[0])) return send(r, 403, { error: 'Finish setting up your account to continue.', code: 'ONBOARDING_REQUIRED' });
  n();
});
// M.state: override for the integration checks (table missing, existing account).
app.get('/api/onboarding/state', (q, r) => send(r, 200, M.state || (M.completed ? { eligible: false, reason: 'completed', completed: true, stage: 'done', flow: { enabled: false } }
  : { eligible: true, reason: 'new_account', newAccount: true, completed: false, stage: 'welcome', flow: { enabled: true, session: Object.assign({}, M.session, { checkoutPending: M.pending }) } })));
app.get('/api/onboarding/session', (q, r) => {
  if (M.session.plan.status === 'generating' && ++M.polls >= 2) {
    if (M.planFails > 0) { M.planFails--; M.session.plan = { status: 'failed', attemptsLeft: M.session.plan.attemptsLeft, error: 'provider_error' }; M.session.step = 'assistant'; }
    else { M.session.plan = { status: 'ready', attemptsLeft: M.session.plan.attemptsLeft, error: null }; M.session.status = 'plan_ready'; M.session.step = 'ready'; }
  }
  send(r, 200, { session: M.session });
});
app.put('/api/onboarding/session', (q, r) => {
  const b = q.body || {};
  if ((b.answers || b.assistant) && ['generating', 'ready'].includes(M.session.plan.status)) return send(r, 409, { error: 'Locked', code: 'ANSWERS_LOCKED' });
  if (b.step) M.session.step = b.step;
  if (b.answers) { Object.keys(b.answers).forEach((k) => { if (k === 'suggested') M.session.answers.suggested = b.answers.suggested; else M.session.answers[k] = Object.assign({}, M.session.answers[k] || {}, b.answers[k]); }); }
  if (b.assistant) M.session.assistant = b.assistant;
  send(r, 200, { session: M.session });
});
app.post('/api/onboarding/website', (q, r) => {
  const url = String((q.body || {}).url || '');
  M.session.websiteReadsLeft--;
  M.session.website = /bloom/.test(url)
    ? { status: 'ok', url: 'https://' + url, domain: 'bloom.example', title: 'Bloom', message: 'Suggestions from your website. Check each one — you decide what to keep.', suggestions: { audience: { value: 'Gift shoppers and interior lovers', quote: 'We sell to gift shoppers and interior lovers' }, offer: { value: 'Hand-poured soy candles', quote: 'makes hand-poured soy candles' } } }
    : { status: 'blocked', url, domain: url, message: 'The website didn’t let us read it (it may block automated visits). Continue with your own answers.', suggestions: null };
  send(r, 200, { session: M.session });
});
app.post('/api/onboarding/plan', (q, r) => {
  if (M.session.plan.status === 'ready') return send(r, 200, { session: M.session });
  if (M.session.plan.status !== 'generating') { M.session.plan = { status: 'generating', attemptsLeft: M.session.plan.attemptsLeft - 1, error: null }; M.polls = 0; M.session.step = 'analyzing'; }
  send(r, 202, { session: M.session });
});
const LABEL = { flex: '14 days', monthly: '1 month', quarterly: '3 months', semiannual: '6 months', annual: '12 months' };
app.get('/api/onboarding/plan', (q, r) => {
  const meta = { onboarding: true, businessName: (M.session.answers.business || {}).name, assistant: M.session.assistant };
  if (!M.paid) return send(r, 200, Object.assign(meta, { status: M.session.plan.status, locked: true, checkoutPending: M.pending }));
  // Paid: onboarding completes and the plan is written for the purchased period.
  M.completed = true; M.pending = false;
  const horizon = { period: M.period, label: LABEL[M.period], days: 30 };
  if (++M.paidReads <= 2) return send(r, 200, Object.assign(meta, { status: 'generating', locked: false, period: M.period, horizon, attemptsLeft: 3, missing: [], plan: null }));
  send(r, 200, Object.assign(meta, { status: 'ready', locked: false, period: M.period, horizon, generatedAt: new Date().toISOString(), plan: Object.assign({ horizon }, PLAN), sections: [] }));
});
app.post('/api/create-checkout-session', (q, r) => { M.pending = true; M.period = (q.body || {}).plan || M.period; send(r, 200, { url: 'https://checkout.stripe.com/c/pay/cs_test_mock?plan=' + encodeURIComponent((q.body || {}).plan || '') }); });
app.get('/app', (q, r) => r.sendFile(path.join(ROOT, 'app.html')));
app.get('/__mock_stripe_checkout', (q, r) => r.send('<!doctype html><title>mock checkout</title><p>mock checkout</p>'));
app.all(/^\/api\//, (q, r) => r.json({}));
app.use(express.static(ROOT));

const blocked = [];
async function fence(page) {
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(BASE + '/')) return r.continue();
    if (u.startsWith(DEV_API + '/')) return r.continue({ url: BASE + u.slice(DEV_API.length) });
    // The Checkout URL the mock returns: answered here, never reaches Stripe.
    if (u.startsWith('https://checkout.stripe.com/c/pay/cs_test_mock')) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>mock checkout</title><p>mock checkout</p>' });
    if (/^(data|blob):/.test(u)) return r.continue();
    if (r.request().method() === 'GET' && /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return r.continue();
    blocked.push(u.split('?')[0]); return r.abort('blockedbyclient');
  });
}
async function boot(page, query, opts) {
  if (!(opts && opts.keepUrl)) await page.goto(BASE + '/app.html' + (query || ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.orvOnboardingFlow && typeof window.orvOnboardingGate === 'function', null, { timeout: 15000 });
  await page.evaluate(() => {
    window._apiToken = 'mock-token'; window._getAccessToken = async () => 'mock-token';
    if (window.orvTour) window.orvTour.open = function () { window.__tourOpened = true; };
  });
  // The consent banner stays above the onboarding (it must always be answerable): answer it like a user.
  const cc = await page.$('.orv-cc [data-cc-act="reject"]');
  if (cc && await cc.isVisible()) await cc.click();
  await page.evaluate(() => window.orvOnboardingGate());
  if (opts && opts.noFlow) { await page.waitForTimeout(800); return; }
  await page.waitForSelector('#onx .onx-main h1', { timeout: 8000 });
  await page.waitForTimeout(300);
}
const step = (page) => page.evaluate(() => document.getElementById('onx') && document.getElementById('onx').getAttribute('data-step'));
const overflow = (page) => page.evaluate(() => { const o = document.getElementById('onx'); return o ? o.scrollWidth - o.clientWidth : -1; });
async function clickNext(page) { await page.click('#onx .onx-nav [data-next]'); await page.waitForTimeout(250); }
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let page = await ctx.newPage(); await fence(page);
    page.on('pageerror', (e) => errors.push(e.message));

    // ── 1. Gate and welcome ────────────────────────────────────────
    console.log('\n1. Gate and welcome');
    await boot(page);
    check('1.1 the gate opens the guided flow (not the old tour) for an eligible account', (await step(page)) === 'welcome' && !(await page.evaluate(() => window.__tourOpened)));
    const w = await page.evaluate(() => ({ h: document.querySelector('#onx h1').textContent, t: document.querySelector('#onx .onx-welcome').textContent, logo: !!document.querySelector('#onx .onx-brand img'), field: getComputedStyle(document.querySelector('#onx .onx-field')).display, dialog: document.getElementById('onx').getAttribute('aria-modal') }));
    check('1.2 welcome copy, logo, estimated time, Continue, modal dialog', w.h === 'Welcome to OrivenAI.' && /Let’s build a marketing strategy around your business, your goals and the way you want to grow\./.test(w.t) && /Answer a few questions and we’ll prepare a personalized marketing strategy for your business\./.test(w.t) && /About 5 minutes/.test(w.t) && w.logo && w.dialog === 'true', w);
    check('1.3 the dot field shows on the welcome screen', w.field === 'block');
    await page.waitForTimeout(800);
    check('1.4 one dot-field canvas in the page and it has drawn', await page.evaluate(() => document.querySelectorAll('#onx canvas.onx-field__c').length === 1 && document.querySelector('#onx canvas.onx-field__c').classList.contains('is-on')));
    await shot(page, 'welcome-1440');

    // ── 2. Business: one question per screen ───────────────────────
    console.log('\n2. Business (one question per screen)');
    await clickNext(page);
    const b1 = await page.evaluate(() => ({ h: document.querySelector('#onx h1').textContent, intro: (document.querySelector('#onx .onx-intro') || {}).textContent, inputs: document.querySelectorAll('#onx .onx-ask__body input, #onx .onx-ask__body textarea').length, prog: document.querySelector('#onx .onx-progress b').textContent, field: getComputedStyle(document.querySelector('#onx .onx-field')).display }));
    check('2.1 Continue → one question: "What’s your business called?", one field, topic intro, progress "Step 1 of 7 · Your business", no dot field', (await step(page)) === 'business' && b1.h === 'What’s your business called?' && b1.intro === 'First, let’s get to know your business.' && b1.inputs === 1 && /^Step 1 of 7 · Your business/.test(b1.prog) && b1.field === 'none', b1);
    await clickNext(page);
    const v = await page.evaluate(() => ({ err: (document.getElementById('onx-name-err') || {}).textContent, focus: document.activeElement && document.activeElement.id, inv: document.getElementById('onx-name').getAttribute('aria-invalid') }));
    check('2.2 empty answer: inline error, aria-invalid, focus on the field, the screen stays', (await step(page)) === 'business' && v.err === 'Enter your business name.' && v.focus === 'onx-name' && v.inv === 'true', v);
    await page.fill('#onx-name', 'Bloom & Wick');
    await page.press('#onx-name', 'Enter');
    await page.waitForTimeout(250);
    check('2.3 Enter continues (a guided conversation) → "Which industry are you in?"', (await step(page)) === 'business-industry' && (await page.textContent('#onx h1')) === 'Which industry are you in?');
    await page.fill('#onx-industry', 'Other');
    check('2.4 industry "Other" asks for a description on the same screen', await page.isVisible('#onx-industryOther'));
    await clickNext(page);
    check('2.5 "Other" without a description → its own error, the screen stays', (await step(page)) === 'business-industry' && (await page.textContent('#onx-industryOther-err')) === 'Describe your industry.');
    await page.fill('#onx-industryOther', 'Candle studio');
    await clickNext(page);
    check('2.6 → "What do you offer?"', (await step(page)) === 'business-offer' && (await page.textContent('#onx h1')) === 'What do you offer?');
    await page.fill('#onx-offer', 'Hand-poured soy candles');
    await clickNext(page);
    check('2.7 → "Where are you active?"', (await step(page)) === 'business-area');
    await page.fill('#onx-area', 'Utrecht');
    await page.waitForTimeout(1100);
    const put = M.calls.filter((c) => c.m === 'PUT' && c.p === '/api/onboarding/session' && c.body.answers && c.body.answers.business).pop();
    check('2.8 autosave: every business answer reaches the server', put && M.session.answers.business.name === 'Bloom & Wick' && M.session.answers.business.industryOther === 'Candle studio' && M.session.answers.business.offer === 'Hand-poured soy candles' && M.session.answers.business.area === 'Utrecht', M.session.answers.business);
    await clickNext(page);
    check('2.9 online presence is optional: its button reads "Skip for now" until something is entered', (await step(page)) === 'business-online' && /Skip for now/.test(await page.textContent('#onx .onx-nav [data-next]')));
    await page.fill('#onx-website', 'guarded.example');
    await page.click('#onx [data-read-site]');
    await page.waitForSelector('#onx .onx-site__m:not(:has(.onx-spin))');
    check('2.10 a site that blocks reading → clear message, continue without it', /didn’t let us read it/.test(await page.textContent('#onx .onx-site')));
    await page.fill('#onx-website', 'bloom.example');
    await page.click('#onx [data-read-site]');
    await page.waitForFunction(() => /suggestion/.test((document.querySelector('#onx .onx-site') || {}).textContent || ''));
    check('2.11 a readable site → "suggestions in the next steps"; nothing filled in automatically', /2 suggestions/.test(await page.textContent('#onx .onx-site')) && (M.session.answers.audience || {}).ideal === undefined);
    await shot(page, 'business-1440');
    await clickNext(page);

    // ── 3. Quote, audience, offer ──────────────────────────────────
    console.log('\n3. Quote, audience, offer');
    check('3.1 quote 1: editorial line, no attribution', (await step(page)) === 'quote1' && (await page.textContent('#onx h1')) === 'Great marketing starts with understanding who you’re trying to reach.' && !(await page.$('#onx cite, #onx .onx-quote__by')));
    await shot(page, 'quote1-1440');
    await clickNext(page);
    check('3.2 audience: "Who are you trying to reach?" — customer type, with where they are as its follow-up', (await page.textContent('#onx h1')) === 'Who are you trying to reach?' && (await page.$$('#onx [data-key="type"] [role="radio"]')).length === 3 && (await page.$$('#onx [data-key="location"] [role="radio"]')).length === 4);
    await page.focus('#onx [data-key="type"] [role="radio"]');
    await page.keyboard.press('ArrowRight');
    check('3.3 keyboard: arrow keys select within a radio group', await page.evaluate(() => document.activeElement.getAttribute('data-v') === 'b2b' && document.activeElement.getAttribute('aria-checked') === 'true'));
    await clickNext(page);
    check('3.4 a missing follow-up (location) is caught on the same screen', (await step(page)) === 'audience' && (await page.textContent('#onx-loc-err')) === 'Choose where your customers are.');
    await page.click('#onx [data-key="location"] [data-v="regional"]');
    await clickNext(page);
    check('3.5 → "Describe your ideal customer." with the website suggestion and its quote', (await step(page)) === 'audience-ideal' && await page.isVisible('#onx [data-path="audience.ideal"] [data-use]') && /“We sell to gift shoppers and interior lovers”/.test(await page.textContent('#onx [data-path="audience.ideal"]')));
    await page.click('#onx [data-path="audience.ideal"] [data-use]');
    check('3.6 "Use this" fills the field, which stays editable', (await page.inputValue('#onx-ideal')) === 'Gift shoppers and interior lovers' && await page.isEditable('#onx-ideal'));
    await clickNext(page);
    check('3.7 → "What’s the biggest problem you solve for them?"', (await step(page)) === 'audience-problem');
    await page.fill('#onx-problem', 'Finding a personal gift');
    await clickNext(page);
    check('3.8 offer: topic intro "What makes your business different?", question "What’s your main product or service?"', (await step(page)) === 'offer' && (await page.textContent('#onx .onx-intro')) === 'What makes your business different?' && (await page.textContent('#onx h1')) === 'What’s your main product or service?');
    await page.fill('#onx-main', 'Soy candles');
    await clickNext(page);
    await page.fill('#onx-different', 'Poured by hand in our studio');
    await clickNext(page);
    check('3.9 → "How is it priced?" with the optional "why choose you" and a value-proposition draft from the user’s own answers', (await step(page)) === 'offer-price' && await page.isVisible('#onx-why') && /Bloom & Wick helps/.test(await page.textContent('#onx .onx-vp')) && /soy candles/.test(await page.textContent('#onx .onx-vp')));
    await page.click('#onx [data-key="price"] [data-v="premium"]');
    await clickNext(page);

    // ── 4. Goals, marketing, budget, Back ──────────────────────────
    console.log('\n4. Goals, marketing, budget');
    check('4.1 goals: seven primary goals', (await page.textContent('#onx h1')) === 'What do you want to achieve?' && (await page.$$('#onx [data-key="primary"] [role="radio"]')).length === 7);
    await page.click('#onx [data-key="primary"] [data-v="leads"]');
    check('4.2 the optional second goal excludes the primary', (await page.$$('#onx [data-key="secondary"] [role="radio"]')).length === 6);
    await clickNext(page);
    check('4.3 → "What would success look like over the next 3 months?" with examples for the chosen goal', (await step(page)) === 'goals-success' && /qualified leads/.test(await page.textContent('#onx .onx-examples')));
    await page.click('#onx .onx-examples .onx-chip');
    check('4.4 an example chip fills the answer', /qualified leads/.test(await page.inputValue('#onx-success')));
    await clickNext(page);
    check('4.5 marketing: "Which channels do you use today?" — 11 options, multi-select', (await page.textContent('#onx h1')) === 'Which channels do you use today?' && (await page.$$('#onx [data-key="channels"] .onx-choice')).length === 11);
    await page.click('#onx [data-key="channels"] [data-v="instagram"]');
    await page.click('#onx [data-key="channels"] [data-v="email"]');
    check('4.6 "which bring results" lists only the channels in use', (await page.$$('#onx [data-key="working"] .onx-choice')).length === 2);
    await page.click('#onx [data-key="channels"] [data-v="none"]');
    check('4.7 "None yet" clears the others', await page.evaluate(() => Array.from(document.querySelectorAll('#onx [data-key="channels"] [aria-pressed="true"]')).map((b) => b.getAttribute('data-v')).join() === 'none') && !(await page.$('#onx [data-key="working"]')));
    await page.click('#onx [data-key="channels"] [data-v="instagram"]');
    await clickNext(page);
    check('4.8 → "What’s your biggest marketing challenge?"', (await step(page)) === 'marketing-challenge');
    await page.click('#onx [data-key="challenge"] [data-v="time"]');
    await clickNext(page);
    check('4.9 → "Have you run paid ads before?"', (await step(page)) === 'marketing-paid');
    await page.click('#onx [data-key="paidAds"] [data-v="no"]');
    await clickNext(page);
    check('4.10 budget: intro "Let’s make your strategy realistic.", the seven ranges', (await page.textContent('#onx .onx-intro')) === 'Let’s make your strategy realistic.' && (await page.$$('#onx [data-key="budget"] [role="radio"]')).length === 7);
    await page.click('#onx [data-key="budget"] [data-v="250_500"]');
    await clickNext(page);
    check('4.11 → time each week (5 options) with who handles it (5 options)', (await step(page)) === 'budget-capacity' && (await page.$$('#onx [data-key="time"] [role="radio"]')).length === 5 && (await page.$$('#onx [data-key="team"] [role="radio"]')).length === 5);
    await page.click('#onx [data-key="time"] [data-v="2_5"]');
    await page.click('#onx [data-key="team"] [data-v="me"]');
    await shot(page, 'budget-1440');
    await page.click('#onx .onx-nav [data-go]');
    await page.waitForTimeout(200);
    check('4.12 Back returns to the previous screen with its answer intact', (await step(page)) === 'budget' && await page.evaluate(() => document.querySelector('#onx [data-key="budget"] [data-v="250_500"]').getAttribute('aria-checked') === 'true'));
    await clickNext(page);
    await clickNext(page);
    check('4.13 quote 2: centred, a second composition (drawn rule, serif accent)', (await step(page)) === 'quote2' && await page.evaluate(() => !!document.querySelector('#onx .onx-quote--b em') && !!document.querySelector('#onx .onx-quote__rule') && getComputedStyle(document.querySelector('#onx .onx-quote--b')).textAlign === 'center'));
    const visited = new Set(M.calls.filter((c) => c.m === 'PUT' && c.body && c.body.step).map((c) => c.body.step));
    const QUESTIONS = ['business', 'business-industry', 'business-offer', 'business-area', 'business-online', 'audience', 'audience-ideal', 'audience-problem', 'offer', 'offer-different', 'offer-price', 'goals', 'goals-success', 'marketing', 'marketing-challenge', 'marketing-paid', 'budget', 'budget-capacity'];
    check('4.14 each of the question screens saved its step to the server (resume works from any of them)', QUESTIONS.every((q) => visited.has(q)), QUESTIONS.filter((q) => !visited.has(q)));
    check('4.15 every answer the old form collected is still collected', ['name', 'industry', 'industryOther', 'offer', 'area', 'website'].every((k) => k in M.session.answers.business) && ['type', 'ideal', 'location', 'problem'].every((k) => k in M.session.answers.audience) && ['main', 'different', 'price'].every((k) => k in M.session.answers.offer) && ['primary', 'success'].every((k) => k in M.session.answers.goals) && ['channels', 'working', 'challenge', 'paidAds'].every((k) => k in M.session.answers.marketing) && ['budget', 'time', 'team'].every((k) => k in M.session.answers.budget), M.session.answers);
    await shot(page, 'quote2-1440');
    await clickNext(page);

    // ── 5. Assistant ───────────────────────────────────────────────
    console.log('\n5. Assistant');
    const asst = await page.evaluate(() => Array.from(document.querySelectorAll('#onx .onx-agent')).map((b) => ({ id: b.getAttribute('data-agent'), n: b.querySelector('.onx-agent__n').textContent, r: b.querySelector('.onx-agent__r').textContent, c: getComputedStyle(b).getPropertyValue('--ac').trim() })));
    check('5.1 the six assistants with their names, roles and colours', JSON.stringify(asst.map((a) => a.n)) === '["Scout","Vector","Nova","Momentum","Metric","Flux"]' && asst[2].r === 'Creative & Content' && asst[2].c.toUpperCase() === '#FF6FA8', asst);
    await page.waitForTimeout(800);
    check('5.2 a live creature (the real particle engine) and the dot field, two canvases in total', await page.evaluate(() => document.querySelectorAll('#onx canvas').length === 2 && document.querySelector('#onx .onx-creature').classList.contains('is-on')));
    await page.click('#onx .onx-agent[data-agent="nova"]');
    await page.waitForTimeout(300);
    const pv = await page.evaluate(() => ({ name: document.querySelector('#onx .onx-asst__name').textContent, tone: document.querySelector('#onx .onx-asst__dl dd').textContent, story: /An imagined backstory: Nova ran a small design studio/.test(document.querySelector('#onx .onx-asst__card').textContent), btn: document.querySelector('#onx [data-confirm-agent]').textContent, canv: document.querySelectorAll('#onx canvas').length, loop: window.IkDotField.fields.length }));
    check('5.3 preview: Nova’s tone, backstory and strengths; still one creature canvas', pv.name === 'Nova' && pv.tone === 'Imaginative, expressive and energetic.' && pv.story && /Continue with Nova/.test(pv.btn) && pv.canv === 2 && pv.loop === 2, pv);
    await page.click('#onx [data-compare]');
    check('5.4 compare: a table of all six', (await page.$$('#onx .onx-table tbody tr')).length === 6);
    await shot(page, 'assistant-1440');
    const plans0 = M.calls.filter((c) => c.m === 'POST' && c.p === '/api/onboarding/plan').length;
    await page.click('#onx [data-confirm-agent]');
    await page.waitForTimeout(400);
    const ap = M.calls.find((c) => c.m === 'PUT' && c.body && c.body.assistant);
    check('5.5 the choice is saved to the server', ap && ap.body.assistant === 'nova' && M.session.assistant === 'nova');

    // ── 6. Assistant → the plans (no plan before payment) ──────────
    console.log('\n6. Straight to the plans');
    await page.waitForTimeout(200);
    check('6.1 after the assistant: straight to the plans — no plan request, no "preparing" or "ready" screen before payment', (await step(page)) === 'paywall' && M.calls.filter((c) => c.m === 'POST' && c.p === '/api/onboarding/plan').length === plans0 && !(await page.$('#onx .onx-analyze')) && !/is ready/.test(await page.textContent('#onx')));
    check('6.2 the creature canvas was released when leaving the assistant screen', await page.evaluate(() => !document.querySelector('#onx .onx-asst') && window.IkDotField.fields.length <= 1));
    const ph = await page.textContent('#onx .onx-pay__head');
    check('6.3 the plans say the marketing plan is written after payment, for the period chosen', /written for exactly that period/.test(ph) && /Right after payment/.test(ph) && /14 days, 1, 3, 6 or 12 months/.test(ph), ph);
    for (const old of ['analyzing', 'ready']) {
      await page.evaluate(() => window.orvOnboardingFlow.close());
      await page.evaluate((s) => window.orvOnboardingFlow.open(s), Object.assign({}, M.session, { step: old }));
      await page.waitForTimeout(250);
      check('6.4 an older saved step "' + old + '" reopens at the plans (nothing generated)', (await step(page)) === 'paywall' && M.calls.filter((c) => c.m === 'POST' && c.p === '/api/onboarding/plan').length === plans0);
    }
    await page.evaluate(() => window.orvOnboardingFlow.close());
    await page.evaluate((s) => window.orvOnboardingFlow.open(s), Object.assign({}, M.session, { step: 'paywall', assistant: null }));
    await page.waitForTimeout(250);
    check('6.5 the plans need a chosen assistant: a session without one opens the assistant screen', (await step(page)) === 'assistant');
    await page.evaluate(() => window.orvOnboardingFlow.close());
    await page.evaluate((s) => window.orvOnboardingFlow.open(s), Object.assign({}, M.session, { step: 'paywall' }));
    await page.waitForSelector('#onx .onx-plans');

    // ── 7. Paywall ─────────────────────────────────────────────────
    console.log('\n7. Paywall');
    const pw = await page.evaluate(() => ({ plans: Array.from(document.querySelectorAll('#onx .onx-plan')).map((p) => p.getAttribute('data-plan') + ':' + p.querySelector('.onx-plan__p').textContent), free: /free|trial|explore first/i.test(document.querySelector('#onx .onx-pay').innerText), close: !!document.querySelector('#onx [aria-label="Close"], #onx .onx-close') }));
    check('7.1 five plans from plans.js (no free plan, trial, "explore first" or close button)', pw.plans.length === 5 && pw.plans[0] === 'flex:€17' && pw.plans[4] === 'annual:€245' && !pw.free && !pw.close, pw);
    const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#onx .onx-plan')).map((c) => {
      const top = (s) => Math.round(c.querySelector(s).getBoundingClientRect().top), r = c.getBoundingClientRect();
      return { id: c.dataset.plan, badge: c.querySelector('.onx-plan__badge').textContent, featured: c.classList.contains('is-featured'), n: top('.onx-plan__n'), p: top('.onx-plan__p'), d: top('.onx-plan__d'), c: top('.onx-plan__c'), b: top('[data-buy]'), h: Math.round(r.height), t: Math.round(r.top) };
    }));
    const same = (k) => new Set(cards.map((x) => x[k])).size === 1;
    check('7.1b badges: Monthly "Most Popular", Annual "Lowest Monthly Price", no other badges', cards.find((x) => x.id === 'monthly').badge === 'Most Popular' && cards.find((x) => x.id === 'annual').badge === 'Lowest Monthly Price' && cards.filter((x) => x.badge).length === 2, cards.map((x) => x.id + ':' + x.badge));
    check('7.1c the five cards line up: same top, height, name, price, period, credits and button rows', ['t', 'h', 'n', 'p', 'd', 'c', 'b'].every(same), cards);
    check('7.1d prices, periods and credits unchanged (plans.js)', JSON.stringify(pw.plans) === JSON.stringify(['flex:€17', 'monthly:€29', 'quarterly:€78', 'semiannual:€143', 'annual:€245']));
    await page.keyboard.press('Escape');
    check('7.2 Escape doesn’t dismiss the paywall', (await step(page)) === 'paywall');
    const html = await page.content();
    const storage = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)));
    check('7.3 before payment no plan content anywhere: page, storage, or any API response the browser received', !SECRET.test(html) && !SECRET.test(storage) && !M.responses.some((r) => SECRET.test(r)));
    await page.evaluate(() => { try { localStorage.setItem('onx_unlocked', '1'); } catch (_) {} window.orvOnboardingFlow.close(); window.orvOnboardingFlow.open({ step: 'done', plan: { status: 'ready', attemptsLeft: 2 }, answers: {}, unlocked: true }); });
    await page.waitForTimeout(300);
    await page.waitForTimeout(500); // the plans screen asks the server, which says locked
    check('7.4 state manipulation (a forged session saying "done"/"unlocked", a storage flag) shows no plan and unlocks nothing: back to the questions (no assistant, no answers)', ['assistant', 'paywall'].includes(await step(page)) && !SECRET.test(await page.content()) && !(await page.$('#onx .onx-ready--done')));
    await page.evaluate((sess) => { window.orvOnboardingFlow.close(); window.orvOnboardingFlow.open(sess); }, Object.assign({}, M.session, { step: 'paywall' }));
    await page.waitForSelector('#onx .onx-plans');
    await page.waitForTimeout(8500); // the forged "unlocked" session's short payment check ends
    await shot(page, 'paywall-1440');
    // A plan chosen on the public pricing page is marked at the plans.
    await page.evaluate(() => { orvRememberPlanChoice('semiannual'); window.orvOnboardingFlow.close(); });
    await page.evaluate((sess) => window.orvOnboardingFlow.open(sess), Object.assign({}, M.session, { step: 'paywall' }));
    await page.waitForSelector('#onx .onx-plans');
    const chosen = await page.evaluate(() => ({ marked: Array.from(document.querySelectorAll('#onx .onx-plan.is-chosen')).map((c) => c.dataset.plan), note: (document.querySelector('#onx .onx-pay__chosen') || {}).textContent }));
    check('7.4b the plan picked on the public pricing page (Semi-Annual) is marked at the plans — nothing is bought automatically', JSON.stringify(chosen.marked) === '["semiannual"]' && /Semi-Annual/.test(chosen.note || '') && !M.calls.some((c) => c.p === '/api/create-checkout-session'), chosen);
    // Choosing a plan shows exactly that plan before Stripe (js/planConfirm.js).
    await page.click('#onx [data-buy="quarterly"]'); await page.waitForTimeout(250);
    const cf = await page.evaluate(() => { const d = document.getElementById('orvPlanConfirm'); return d ? { name: d.querySelector('.pcf__name').textContent, price: d.querySelector('.pcf__price b').textContent, period: d.querySelector('[data-fact="period"]').textContent, credits: d.querySelector('[data-fact="credits"]').textContent, top: getComputedStyle(d).zIndex } : null; });
    check('7.5a "Choose Quarterly" first shows the plan being bought: Quarterly, €78, 3 months, 4,800 credits (1,600 a month) — above the onboarding, no checkout yet', cf && cf.name === 'Quarterly' && /78/.test(cf.price) && /3 months/.test(cf.period) && /1[.,]600 added each month/.test(cf.credits) && +cf.top > 10050 && !M.calls.some((c) => c.p === '/api/create-checkout-session'), cf);
    await page.click('#orvPlanConfirm .pcf__back'); await page.waitForTimeout(200);
    check('7.5b "Choose a different plan": back at the plans, every button usable, nothing sent', !(await page.$('#orvPlanConfirm')) && await page.isEnabled('#onx [data-buy="monthly"]') && !M.calls.some((c) => c.p === '/api/create-checkout-session'));
    await page.click('#onx [data-buy="quarterly"]'); await page.waitForTimeout(250);
    const [nav] = await Promise.all([page.waitForNavigation({ url: /checkout\.stripe\.com\/c\/pay\/cs_test_mock/, timeout: 8000 }).catch(() => null), page.click('#orvPlanConfirm [data-pcf="go"]')]);
    const ck = M.calls.find((c) => c.p === '/api/create-checkout-session');
    check('7.5 confirming → the existing checkout endpoint with only the plan id ("quarterly") → redirect to Stripe', !!nav && ck && ck.body.plan === 'quarterly' && Object.keys(ck.body).every((k) => ['plan', 'source'].includes(k)), ck && ck.body);

    // Back from Stripe before the payment is confirmed: still locked.
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await boot(page, '?unlocked=1&step=done');
    check('7.6 URL manipulation (?unlocked=1&step=done) without payment → back on the paywall, nothing unlocked', ['ready', 'paywall'].includes(await step(page)) && !SECRET.test(await page.content()));
    await page.close();

    // ── 8. Payment confirmed → unlock → Control Center ─────────────
    console.log('\n8. Payment and unlock');
    M.session.step = 'paywall';
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await boot(page, '?success=true&session_id=cs_test_mock');
    check('8.1 back from checkout: the paywall confirms the payment (server not yet confirmed)', (await step(page)) === 'paywall' && /Confirming your payment/.test(await page.textContent('#onx .onx-pay__confirm')));
    M.paid = true; // the webhook / sync-checkout confirmed it on the server
    await page.waitForFunction(() => document.getElementById('onx').getAttribute('data-step') === 'done', null, { timeout: 10000 });
    const dn = await page.textContent('#onx .onx-ready');
    check('8.2 once the server confirms: "You’re in." — the plan is being written for the purchased period (Quarterly: the next 3 months)', /You’re in\./.test(dn) && /writing your marketing plan for the next 3 months/.test(dn) && /Control Center → Marketing Plan/.test(dn), dn);
    const navs8 = []; page.on('request', (rq) => { if (rq.isNavigationRequest() && rq.frame() === page.mainFrame()) navs8.push(rq.url()); });
    await shot(page, 'done-1440');
    for (let i = 0; i < 60 && !navs8.includes(BASE + '/app'); i++) await page.waitForTimeout(100);
    // (Without a real Supabase session in this test, the app's guest mode then rewrites the address; in real use the signed-in app stays on /app.)
    check('8.3 automatically on to /app: a real page load of /app, no click needed, the Stripe return URL left behind', navs8.includes(BASE + '/app'), navs8);
    await boot(page, '', { noFlow: true, keepUrl: true });
    await page.waitForTimeout(1500);
    const cc = await page.evaluate(() => ({ open: !!document.getElementById('onx'), lock: document.documentElement.classList.contains('onx-lock'), page: (document.querySelector('.page.active') || {}).id, text: (document.getElementById('page-marketing-plan') || {}).innerText || '' }));
    check('8.4 in the app: no onboarding again; Control Center → Marketing Plan opens with the plan being written for 3 months', !cc.open && !cc.lock && cc.page === 'page-marketing-plan' && /Preparing your marketing plan/.test(cc.text) && /next 3 months/.test(cc.text), cc);
    await page.waitForFunction(() => /SECRET-PLAN-SUMMARY/.test((document.getElementById('page-marketing-plan') || {}).innerText || ''), null, { timeout: 9000 }).catch(() => {});
    const cc2 = await page.evaluate(() => (document.getElementById('page-marketing-plan') || {}).innerText || '');
    check('8.5 …and the plan appears there when it’s ready, labelled with its period', /SECRET-PLAN-SUMMARY/.test(cc2) && /Marketing plan · 3 months/i.test(cc2), cc2.slice(0, 200));
    await page.close();

    // ── 9. Resume, failure and retry ───────────────────────────────
    console.log('\n9. Resume, failure and retry');
    reset({ step: 'offer', answers: JSON.parse(JSON.stringify(ANSWERS)) });
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    check('9.1 resume: reopens at the saved step with saved answers', (await step(page)) === 'offer' && (await page.inputValue('#onx-main')) === 'Soy candles');
    await page.close();
    reset({ step: 'analyzing', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'metric', plan: { status: 'failed', attemptsLeft: 2, error: 'provider_error' } });
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await page.waitForTimeout(600);
    const r92 = { st: await step(page), retry: !!(await page.$('#onx [data-retry]')), posts: M.calls.filter((c) => c.m === 'POST' && c.p === '/api/onboarding/plan').length };
    check('9.2 an older session left at a failed generation reopens at the plans: no retry inside the onboarding, no plan request', r92.st === 'paywall' && !r92.retry && r92.posts === 0, r92);
    await page.close();

    // ── 11. Integration with the rest of the app ───────────────────
    console.log('\n11. Integration');
    // Signed out: the app's sign-in screen, nothing from onboarding.
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset();
    await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // Supabase is fenced off here, so the app can't learn it's signed out by
    // itself; show its sign-in screen the way auth.js does.
    const so = await page.evaluate(() => { window.showAuthPage(); const o = document.getElementById('authOverlay');
      return { onx: !!document.getElementById('onx'), lock: document.documentElement.classList.contains('onx-lock'), auth: getComputedStyle(o).display !== 'none' && !!document.getElementById('authSigninForm') && !!document.getElementById('authSignupForm'), top: document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('#authOverlay') !== null }; });
    check('11.1 signed out: the sign-in/sign-up screen works and is on top; no onboarding, no scroll lock, no onboarding request', !so.onx && !so.lock && so.auth && so.top && !M.calls.some((c) => /onboarding/.test(c.p)), so);
    await page.close();
    // Migration not applied: the server says flow disabled → the existing tour.
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset(); M.state = { eligible: true, reason: 'new_account', newAccount: true, completed: false, stage: 'welcome', flow: { enabled: false } };
    await boot(page, '', { noFlow: true });
    check('11.2 flow unavailable (table missing): the existing welcome tour opens instead', !(await page.$('#onx')) && await page.evaluate(() => window.__tourOpened === true));
    await page.close();
    // An existing (pre-rollout) or completed account: nothing opens.
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset(); M.state = { eligible: false, reason: 'existing_account', newAccount: false, completed: false, stage: 'done', flow: { enabled: false } };
    await boot(page, '', { noFlow: true });
    check('11.3 existing account: no onboarding, no tour (unchanged behaviour)', !(await page.$('#onx')) && !(await page.evaluate(() => window.__tourOpened)));
    // Control Center → Planning with a locked plan: the planner as before, no strategy block.
    reset({ step: 'paywall', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'nova', plan: { status: 'ready', attemptsLeft: 2 } });
    await page.evaluate(() => { if (window._orvNav) window._orvNav('dashboard', 'page-dashboard'); setTimeout(() => window.bizGoTo && window.bizGoTo('planning'), 150); });
    await page.waitForTimeout(1500);
    const pl = await page.evaluate(() => { const s = document.getElementById('plStrategy'); return { strat: !!s, hidden: s ? s.hidden : null, secs: Array.from(document.querySelectorAll('#bizPlanningBody .pl-b')).map((x) => x.className.replace('pl-b ', '')), html: document.getElementById('bizPlanningBody') ? document.getElementById('bizPlanningBody').innerHTML : '' }; });
    check('11.4 Planning before payment: the existing planner sections, the strategy block hidden and empty', pl.strat && pl.hidden === true && ['pl-plans', 'pl-budget', 'pl-briefs', 'pl-res'].every((c) => pl.secs.some((x) => x.indexOf(c) === 0)) && !SECRET.test(pl.html), pl.secs);
    await page.close();
    // Paid, then the tab closed before the confirmation; back later (no ?success).
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset({ step: 'paywall', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'nova', plan: { status: 'ready', attemptsLeft: 2 } });
    await boot(page);
    const resumeMsg = await page.textContent('#onx .onx-pay__confirm');
    M.paid = true; // the webhook lands while they look at the screen
    await page.waitForFunction(() => document.getElementById('onx').getAttribute('data-step') === 'done', null, { timeout: 10000 });
    check('11.5 back after closing the tab: "Checking for a recent payment…", then unlocked without paying again', /Checking for a recent payment/.test(resumeMsg) && !M.calls.some((c) => c.p === '/api/create-checkout-session'));
    await page.close();
    // No payment on its way: the short check ends and the plans stay usable.
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset({ step: 'paywall', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'nova', plan: { status: 'ready', attemptsLeft: 2 } });
    await boot(page);
    await page.waitForTimeout(8500);
    check('11.6 no recent payment: after a short check the message goes away and the plans can be chosen', (await step(page)) === 'paywall' && await page.isHidden('#onx .onx-pay__confirm') && await page.isEnabled('#onx [data-buy="monthly"]'));
    await page.close();
    // Refresh during the confirmation, then the webhook arrives.
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset({ step: 'paywall', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'nova', plan: { status: 'ready', attemptsLeft: 2 } });
    await boot(page, '?success=true&session_id=cs_test_mock');
    await page.waitForTimeout(1500);
    await page.goto('about:blank');
    await boot(page, '?success=true&session_id=cs_test_mock');
    const confirming = await page.textContent('#onx .onx-pay__confirm');
    M.paid = true;
    await page.waitForFunction(() => document.getElementById('onx').getAttribute('data-step') === 'done', null, { timeout: 10000 });
    const unlockReads = M.calls.filter((c) => c.m === 'GET' && c.p === '/api/onboarding/plan').length;
    check('11.7 refresh during confirmation: confirmation resumes and unlocks; only status reads, no new checkout', /Confirming your payment/.test(confirming) && !M.calls.some((c) => c.p === '/api/create-checkout-session') && unlockReads >= 2);
    await page.close();

    // ── 12. Activation: no way around the paywall, resume, never stuck ──
    console.log('\n12. Activation');
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset({ step: 'paywall', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'nova', plan: { status: 'ready', attemptsLeft: 2 } });
    await boot(page);
    await page.waitForTimeout(8500);
    await page.evaluate(() => window.orvOnboardingFlow.close());
    const shown = await page.evaluate(async () => { const r = await apiFetch('/api/campaigns'); return { status: r.status, code: r.data && r.data.code }; });
    await page.waitForTimeout(800);
    check('12.1 closing the onboarding with a script: the next app request is refused by the server (403 ONBOARDING_REQUIRED) and the onboarding comes back', shown.status === 403 && shown.code === 'ONBOARDING_REQUIRED' && (await step(page)) === 'paywall', shown);
    await page.evaluate(() => { document.querySelectorAll('#onx [data-buy]').forEach((b) => { b.disabled = true; b.textContent = 'Opening secure checkout…'; }); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    await page.waitForTimeout(300);
    check('12.2 back from Stripe with the browser’s Back button (page from the back-forward cache): the plan buttons work again and the payment is re-checked', await page.isEnabled('#onx [data-buy="monthly"]') && /Choose Monthly/.test(await page.textContent('#onx [data-buy="monthly"]')) && /Confirming your payment/.test(await page.textContent('#onx .onx-pay__confirm')));
    await page.close();
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset({ step: 'paywall', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'nova', plan: { status: 'ready', attemptsLeft: 2 } }, { pending: true });
    await boot(page);
    check('12.3 signing in again with a checkout started but not confirmed: the payment status is shown and checked with the server', (await step(page)) === 'paywall' && /Confirming your payment/.test(await page.textContent('#onx .onx-pay__confirm')));
    await page.close();
    page = await ctx.newPage(); await fence(page); page.on('pageerror', (e) => errors.push(e.message));
    reset({ step: 'paywall', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'nova' });
    await boot(page);
    await page.waitForTimeout(300);
    check('12.4 at the plans with no plan generated at all (the normal case now): the five plans are offered', (await step(page)) === 'paywall' && (await page.$$('#onx .onx-plan')).length === 5);
    M.paid = true; M.period = 'flex';
    const navs12 = []; page.on('request', (rq) => { if (rq.isNavigationRequest() && rq.frame() === page.mainFrame()) navs12.push(rq.url()); });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.waitForFunction(() => document.getElementById('onx') && document.getElementById('onx').getAttribute('data-step') === 'done', null, { timeout: 10000 });
    check('12.5 after payment: active at once, the plan is being written for the purchased Flex period (14 days)', /You’re in\./.test(await page.textContent('#onx h1')) && /for the next 14 days/.test(await page.textContent('#onx .onx-ready')));
    for (let i = 0; i < 60 && !navs12.includes(BASE + '/app'); i++) await page.waitForTimeout(100);
    check('12.6 …and continues to /app', navs12.includes(BASE + '/app'), navs12);
    check('12.7 the browser never asked for a plan to be generated (the server starts it after payment)', !M.calls.some((c) => c.m === 'POST' && c.p === '/api/onboarding/plan'));
    await page.close();

    // ── 10. Widths, reduced motion ─────────────────────────────────
    console.log('\n10. Responsive and reduced motion');
    const A = () => JSON.parse(JSON.stringify(ANSWERS));
    const screens = [['welcome', {}]].concat(
      ['business', 'business-industry', 'business-offer', 'business-area', 'business-online', 'quote1', 'audience', 'audience-ideal', 'audience-problem', 'offer', 'offer-different', 'offer-price',
        'goals', 'goals-success', 'marketing', 'marketing-challenge', 'marketing-paid', 'budget', 'budget-capacity', 'quote2'].map((s) => [s, { step: s, answers: A() }]),
      [['assistant', { step: 'assistant', answers: A(), assistant: 'flux' }],
        ['paywall', { step: 'paywall', answers: A(), assistant: 'flux', plan: { status: 'ready', attemptsLeft: 2 } }]]);
    for (const [wd, ht] of [[390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
      const c2 = await browser.newContext({ viewport: { width: wd, height: ht } });
      const p2 = await c2.newPage(); await fence(p2); p2.on('pageerror', (e) => errors.push(wd + ': ' + e.message));
      const res = [];
      for (const [name, sess] of screens) {
        await p2.goto('about:blank'); // the previous screen's last autosave can't land after the reset
        reset(sess);
        await boot(p2);
        const o = await overflow(p2), st2 = await step(p2);
        const small = await p2.evaluate(() => Array.from(document.querySelectorAll('#onx button:not([hidden])')).filter((b) => b.offsetParent && b.getBoundingClientRect().height < 32).length);
        // Centred: the screen's container has the same space left and right,
        // and so does its heading and its main control block.
        const ctr = await p2.evaluate(() => {
          const W = document.getElementById('onx').clientWidth, off = (el) => { if (!el) return 0; const r = el.getBoundingClientRect(); return Math.abs(Math.round(r.left) - Math.round(W - r.right)); };
          const sec = document.querySelector('#onx .onx-main > section');
          return { section: off(sec), h1: off(document.querySelector('#onx h1')), body: off(document.querySelector('#onx .onx-ask__body, #onx .onx-plans, #onx .onx-asst__grid, #onx .onx-nav')) };
        });
        res.push({ name, st: st2, o, small, ctr });
        if (wd !== 1440 && ['business', 'audience', 'offer-price', 'goals', 'budget-capacity', 'assistant', 'paywall'].includes(name)) await shot(p2, name + '-' + wd);
      }
      check(`10.1 ${wd}px: every screen opens with no horizontal overflow and no tap target under 32px`, res.every((r) => r.st === r.name && r.o <= 1 && r.small === 0), res.filter((r) => r.st !== r.name || r.o > 1 || r.small));
      check(`10.2 ${wd}px: every screen is centred (container, heading and controls within 2px)`, res.every((r) => r.ctr.section <= 2 && r.ctr.h1 <= 2 && r.ctr.body <= 2), res.filter((r) => r.ctr.section > 2 || r.ctr.h1 > 2 || r.ctr.body > 2).map((r) => [r.name, r.ctr]));
      await c2.close();
    }
    const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p3 = await c3.newPage(); await fence(p3); p3.on('pageerror', (e) => errors.push('rm: ' + e.message));
    reset({ step: 'assistant', answers: JSON.parse(JSON.stringify(ANSWERS)), assistant: 'scout' });
    await boot(p3);
    await p3.waitForTimeout(900);
    const rm = await p3.evaluate(() => ({ anim: getComputedStyle(document.querySelector('#onx .onx-main > *')).animationName, field: document.querySelector('#onx .onx-field__c').classList.contains('is-on'), creature: document.querySelector('#onx .onx-creature').classList.contains('is-on') }));
    check('10.3 reduced motion: no entrance animation; field and creature drawn as still frames', rm.anim === 'none' && rm.field && rm.creature, rm);
    await c3.close();

    check('Z. no JavaScript errors from the flow', errors.filter((e) => /onx|onboardingFlow|IkCreatures|IkDotField/.test(e)).length === 0, errors);
    console.log('\n(Blocked outside requests, aborted by the fence: ' + blocked.length + ')');
  } catch (e) {
    console.error(e); fail++;
  } finally {
    await browser.close();
    server.close();
    console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
    process.exit(fail ? 1 : 0);
  }
});
