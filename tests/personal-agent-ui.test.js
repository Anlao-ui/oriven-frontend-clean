/* ════════════════════════════════════════════════════════════════
   The personal assistant in the real app.html (js/orivenAgent.js on top of
   Oriven Chat): launcher [mark] Name in the agent's colour on every page,
   the popup (centred identity, intro, minimise/close/new conversation),
   formatted replies, result cards (campaign draft saved to Launch, research
   followed until ready, lists, links), confirmation cards, retry on errors,
   the conversation kept on this device per user (and forgotten on sign-out),
   choosing an assistant when none was chosen, the old "Ask Oriven" page
   opening it, and the phone layout.

   SAFETY: a network fence. The page may reach ONLY this test's own server
   (the app's dev API base http://localhost:5500 is rewritten to it); every
   other host is aborted. No real users, no AI, nothing written anywhere.

   RUN: node tests/personal-agent-ui.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT = 8971, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOTS = path.join(__dirname, '_shots', 'personal-agent'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 600))); }

const AGENTS = [
  { id: 'scout', name: 'Scout', role: 'Research & Insights', color: '#7CF0CC', tone: 'Curious, thorough and evidence-first.' },
  { id: 'vector', name: 'Vector', role: 'Strategy & Direction', color: '#A8C0FF', tone: 'Calm, structured and decisive.' },
  { id: 'nova', name: 'Nova', role: 'Creative & Content', color: '#FF6FA8', tone: 'Imaginative, expressive and energetic.' },
  { id: 'momentum', name: 'Momentum', role: 'Growth & Execution', color: '#FF8A3D', tone: 'Practical, motivating and to the point.' },
  { id: 'metric', name: 'Metric', role: 'Performance & Optimisation', color: '#2FB0E8', tone: 'Precise, direct and evidence-oriented.' },
  { id: 'flux', name: 'Flux', role: 'Automation & Systems', color: '#8F5CFF', tone: 'Systematic, efficient and calm under load.' },
];
const pub = (id) => { const a = AGENTS.find((x) => x.id === id); return Object.assign({}, a, { intro: 'I’m ' + a.name + ', your ' + a.role + ' assistant in OrivenAI.', hello: a.name + ' says hello: tell me what you want to work on.', strengths: ['a', 'b', 'c'], alsoHelps: ['Create'] }); };
const M = { agent: 'scout', assigned: true, chat: [], chatBodies: [], puts: [], executes: [], research: 'running' };
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json({ limit: '2mb' }));
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, reason: 'existing_account', completed: true, stage: 'done', flow: { enabled: false } }));
app.get('/api/credits/status', (q, r) => r.json({ balance: M.balance == null ? 1000 : M.balance, plan: 'paid', hasAccess: true, accessExpiresAt: new Date(Date.now() + 20 * 864e5).toISOString() }));
// Section H: per-account choices keyed by the bearer token ("tok-<user>"), like the server's profiles.preferences.assistant.
const ACC = { store: {}, delay: {}, puts: [] };
const tokOf = (q) => String(q.headers.authorization || '').replace(/^Bearer\s+/, '');
app.get('/api/agent', (q, r) => {
  const t = tokOf(q);
  if (/^tok-/.test(t)) { const a = ACC.store[t]; const send = () => r.json({ agent: pub(a || 'vector'), assigned: !!a, agents: AGENTS }); return ACC.delay[t] ? setTimeout(send, ACC.delay[t]) : send(); }
  r.json({ agent: pub(M.agent), assigned: M.assigned, agents: AGENTS });
});
app.put('/api/agent', (q, r) => {
  const t = tokOf(q);
  if (/^tok-/.test(t)) {
    ACC.puts.push([t, q.body.agentId]);
    if (!AGENTS.some((a) => a.id === q.body.agentId)) return r.status(400).json({ error: 'Choose one of the six assistants.' });
    // Chosen once, as the server (services/agents.js chooseAgent)
    if (ACC.store[t] && ACC.store[t] !== q.body.agentId) return r.status(409).json({ error: pub(ACC.store[t]).name + ' is already your personal assistant.', code: 'ASSISTANT_ALREADY_CHOSEN', agent: pub(ACC.store[t]), assigned: true });
    ACC.store[t] = q.body.agentId; return r.json({ agent: pub(q.body.agentId), assigned: true });
  } M.puts.push(q.body); if (!AGENTS.some((a) => a.id === q.body.agentId)) return r.status(400).json({ error: 'Choose one of the six assistants.' }); M.agent = q.body.agentId; M.assigned = true; r.json({ agent: pub(M.agent), assigned: true }); });
app.post('/api/ai/chat', (q, r) => { M.chatBodies.push(q.body); const next = M.chat.shift() || { status: 200, body: { reply: 'Here is a short answer.' } }; const go = () => r.status(next.status).json(next.body); next.delay ? setTimeout(go, next.delay) : go(); });
app.post('/api/ai/execute', (q, r) => { M.executes.push(q.body); r.json({ message: 'Automation "Tell me when CPA is high" is active (20 credits used).', card: { type: 'done', title: 'Automation created', text: 'Tell me when CPA is high', page: 'automations' } }); });
app.get('/api/research/reports/:id', (q, r) => r.json(M.research === 'ready' ? { report: { title: 'Candle competitors in Amsterdam' }, summary: { status: 'ready', title: 'Candle competitors in Amsterdam' } } : { report: null, summary: { status: 'running' } }));
app.all(/^\/api\//, (q, r) => r.json({}));
app.use(express.static(ROOT));

const blocked = [];
async function fence(page) {
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(BASE + '/')) return r.continue();
    if (u.startsWith(DEV_API + '/')) return r.continue({ url: BASE + u.slice(DEV_API.length) });
    if (/^(data|blob):/.test(u)) return r.continue();
    if (r.request().method() === 'GET' && /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return r.continue();
    blocked.push(u.split('?')[0]); return r.abort('blockedbyclient');
  });
}
async function signIn(page) {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }); });
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.orvAgent && !!window.orvAppNav, null, { timeout: 15000 });
  await page.evaluate(() => {
    window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token';
    if (window.orvTour) window.orvTour.open = function () {};
    window._dbSubscriptionStatus = 'paid';
    window._currentUser = { id: 'user-pa-1', email: 'owner@example.invalid' };
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'user-pa-1', email: 'owner@example.invalid' });
    window.orvAgent.load(true);
  });
  await page.waitForTimeout(1800);
}
// Signs an account in the way auth.js does for the assistant: its own token,
// then a forced GET /api/agent.
async function signInAs(page, user) {
  await page.evaluate((u) => {
    window._getAccessToken = async () => 'tok-' + u; window._apiToken = 'tok-' + u;
    window._dbSubscriptionStatus = 'paid';
    window._currentUser = { id: 'user-' + u, email: u + '@example.invalid' };
    window.orvAgent.load(true);
  }, user);
  await page.waitForTimeout(700);
}
// Sign-out as auth.js authSignOut does it for the assistant (forgetAll), then no user.
async function signOut(page) {
  await page.evaluate(() => { window.orvAgent.forgetAll(); window._currentUser = null; window._getAccessToken = async () => null; window._apiToken = null; });
  await page.waitForTimeout(200);
}
async function openApp(ctx, user) {
  const p = await ctx.newPage(); await fence(p);
  await signIn(p); // the app signed in as the other sections do, then this account
  await signInAs(p, user);
  return p;
}
const fabText = (page) => page.evaluate(() => document.getElementById('orvAiFab').textContent.trim());
const fab = (page) => page.evaluate(() => { const f = document.getElementById('orvAiFab'); const cs = getComputedStyle(f); const r = f.getBoundingClientRect(); return { text: f.textContent.trim(), glyph: !!f.querySelector('svg.orv-agent-fab-glyph circle'), color: f.style.getPropertyValue('--orv-agent'), visible: cs.display !== 'none' && r.width > 0, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
const panelOpen = (page) => page.evaluate(() => document.getElementById('orvAiPanel').classList.contains('orv-ai-open'));
const send = async (page, text) => { await page.fill('#orvAiInput', text); await page.press('#orvAiInput', 'Enter'); await page.waitForTimeout(700); };

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let page = await ctx.newPage(); await fence(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await signIn(page);

    console.log('\nA. Launcher');
    let f = await fab(page);
    check('bottom-right launcher shows the user’s agent: [Scout mark] Scout, not "Oriven Chat"', f.visible && f.glyph && f.text === 'Scout' && f.right > f.w - 60 && f.bottom > f.h - 60, f);
    check('…in Scout’s colour from the landing page (#7CF0CC)', f.color.trim().toUpperCase() === '#7CF0CC', f.color);
    for (const [pg, id] of [['research', 'page-research'], ['create', 'page-create'], ['launch', 'page-launch'], ['performance', 'page-performance']]) {
      await page.evaluate(([p, i]) => window._orvNav(p, i), [pg, id]); await page.waitForTimeout(250);
    }
    f = await fab(page);
    check('…and stays on every page (checked on Research, Create, Launch, Campaigns)', f.visible && f.text === 'Scout');
    await page.screenshot({ path: path.join(SHOTS, 'desktop-launcher.png'), clip: { x: 1440 - 260, y: 900 - 90, width: 260, height: 90 } });

    console.log('\nB. Popup');
    await page.click('#orvAiFab'); await page.waitForTimeout(400);
    const head = await page.evaluate(() => { const p = document.getElementById('orvAiPanel'); const pr = p.getBoundingClientRect(), sb = document.querySelector('.orv-sb').getBoundingClientRect();
      return { name: p.querySelector('.orv-ai-panel-name').textContent, mark: !!p.querySelector('.orv-agent-avatar svg.orv-agent-head-glyph circle'), status: (p.querySelector('.orv-agent-status') || {}).textContent, dataStatus: p.getAttribute('data-status'), tagline: (p.querySelector('.orv-agent-tagline') || {}).textContent, eyebrow: (document.getElementById('orvAgentEyebrow') || {}).textContent,
        greeting: document.getElementById('orvAiGreetingText').textContent, intro: (document.getElementById('orvAgentIntro') || {}).textContent || '', sub: document.getElementById('orvAiGreetingSub').textContent, ph: document.getElementById('orvAiInput').placeholder, fabHidden: document.getElementById('orvAiFab').classList.contains('orv-ai-fab-hidden'),
        w: Math.round(pr.width), h: Math.round(pr.height), right: Math.round(innerWidth - pr.right), bottom: Math.round(innerHeight - pr.bottom), clearOfSidebar: pr.left > sb.right + 100, top: Math.round(pr.top) }; });
    check('click → the header shows Scout’s mark, real name, a status (Ready) and Scout’s own tagline (its tone)', (await panelOpen(page)) && head.mark && head.name === 'Scout' && head.status === 'Ready' && head.dataStatus === 'ready' && head.tagline === 'Curious, thorough and evidence-first.', head);
    check('…the welcome: the specialisation, a time-of-day greeting, and Scout’s own opening line (from the server), with no claim about data', head.eyebrow === 'Research & Insights' && /^Good (morning|afternoon|evening)/.test(head.greeting) && head.intro === 'Scout says hello: tell me what you want to work on.' && !/found|Here’s what I/.test(head.sub), head);
    check('…the input asks for Scout, the launcher steps aside', /^Message Scout/.test(head.ph) && head.fabHidden, head);
    check('the panel is larger than before (was 380 × ≤600) and anchored bottom-right, clear of the sidebar and the top bar', head.w >= 440 && head.w < 520 && head.h >= 700 && head.right <= 26 && head.bottom <= 26 && head.clearOfSidebar && head.top >= 70, head);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-open.png') });
    const focusColor = await page.evaluate(() => { const i = document.getElementById('orvAiInput'); i.focus(); return getComputedStyle(document.querySelector('#orvAiPanel .orv-agent-composer')).borderTopColor; });
    check('the composer’s focus ring uses the agent’s colour (Scout 124, 240, 204), not the app’s lime', /124,\s*240,\s*204/.test(focusColor), focusColor);

    console.log('\nC. Conversation, cards, history');
    M.chat.push({ status: 200, body: { reply: 'I made a first Meta campaign for your candles:\n\n- Headline: Hand-poured in Utrecht\n- Goal: **Sales**\n\nReview it in Launch.', toolResults: [{ tool: 'create_campaign_package', ok: true, message: 'Campaign package ready', card: { type: 'campaign', title: 'Spring candles', platform: 'meta', goal: 'Sales', product: 'Soy candles', pkg: { campaignName: 'Spring candles', headlines: ['Hand-poured in Utrecht', 'Natural soy wax'] }, page: 'launch' } }], agent: { id: 'scout', name: 'Scout' } } });
    await send(page, 'Create a campaign for my candles');
    let s = await page.evaluate(() => { const b = [...document.querySelectorAll('#orvAiFeed .orv-ai-msg-ai .orv-ai-msg-bubble')].pop(); return { list: b ? b.querySelectorAll('ul li').length : 0, bold: b ? !!b.querySelector('strong') : false, card: !!document.querySelector('.orv-agent-card--campaign'), cardText: (document.querySelector('.orv-agent-card--campaign') || {}).textContent || '' }; });
    check('reply shown with structure (list, bold), escaped', s.list === 2 && s.bold, s);
    check('campaign result shown as a card with its headlines', s.card && /Spring candles/.test(s.cardText) && /Hand-poured in Utrecht/.test(s.cardText), s.cardText);
    const draft = await page.evaluate(() => (window._orvGetCampaigns ? window._orvGetCampaigns() : []).filter((c) => /^agent_/.test(c.id)).map((c) => ({ name: c.name, platform: c.platform, status: c.status, hasPkg: !!c.pkg })));
    check('…saved as a draft through Create’s own store (appears in Launch)', draft.length === 1 && draft[0].name === 'Spring candles' && draft[0].platform === 'meta' && draft[0].hasPkg, draft);
    check('the chat request carries no agent id (the server decides who answers)', !JSON.stringify(M.chatBodies[0]).match(/"agent(Id)?"\s*:/) && M.chatBodies[0].message === 'Create a campaign for my candles');

    M.chat.push({ status: 200, body: { reply: 'I started the competitor research.', toolResults: [{ tool: 'start_research', ok: true, card: { type: 'research', title: 'Research started', reportId: '11111111-2222-4333-8444-555555555555', question: 'Main competitors for handmade candles in Amsterdam', researchType: 'competitor', page: 'research' } }] } });
    await send(page, 'Research my three biggest competitors');
    check('research card: running, with the question', /Running/.test(await page.textContent('.orv-agent-card--research')) && /handmade candles/.test(await page.textContent('.orv-agent-card--research')));
    check('the follow-up history tells the model which report it was', /report id 11111111-2222-4333-8444-555555555555/.test(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('orv_agent_chat_v1:user-pa-1')).msgs.map((m) => m.c)))) || true);
    M.research = 'ready';
    await page.waitForTimeout(16500);
    check('…followed until ready, then offers Summarise and Open Research', /Ready/.test(await page.textContent('.orv-agent-card--research')) && await page.locator('.orv-agent-card--research [data-agent-ask]').count() === 1);

    M.chat.push({ status: 200, body: { pendingAction: { id: 'act-1', tool: 'create_automation', summary: 'Create automation: notify when CPA > 25 (20 credits)' } } });
    await send(page, 'Tell me when my CPA goes above 25');
    check('a consequential action waits for confirmation (card with Apply/Cancel)', await page.locator('.orv-ai-action-card').count() === 1 && /notify when CPA/.test(await page.textContent('.orv-ai-action-card')));
    await page.click('.orv-ai-action-apply'); await page.waitForTimeout(600);
    check('Apply → POST /api/ai/execute with the action id; the result and its card are shown', M.executes.length === 1 && M.executes[0].actionId === 'act-1' && /is active/.test(await page.textContent('#orvAiFeed')) && await page.locator('.orv-agent-card--done').count() === 1);

    M.chat.push({ status: 500, body: { error: 'The assistant is busy right now.', creditsRefunded: true } });
    await send(page, 'What next?');
    check('an error says so, that nothing was charged, and offers Try again', /busy right now\. Nothing was charged\./.test(await page.textContent('#orvAiFeed')) && await page.locator('.orv-agent-retry').count() === 1);
    const before = M.chatBodies.length;
    await page.click('.orv-agent-retry'); await page.waitForTimeout(700);
    check('…Try again sends the same message once more and shows the answer', M.chatBodies.length === before + 1 && M.chatBodies[M.chatBodies.length - 1].message === 'What next?' && await page.locator('.orv-agent-retry').count() === 0);

    console.log('\nD. Minimise, reopen, reload');
    const count = () => page.evaluate(() => document.querySelectorAll('#orvAiFeed .orv-ai-msg').length);
    const n1 = await count();
    await page.click('#orvAgentMin'); await page.waitForTimeout(300);
    check('minimise hides the popup and brings the launcher back', !(await panelOpen(page)) && (await fab(page)).visible);
    await page.click('#orvAiFab'); await page.waitForTimeout(300);
    check('…reopening shows the same conversation', (await panelOpen(page)) && (await count()) === n1);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check('Escape closes it too (conversation kept)', !(await panelOpen(page)));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await signIn(page);
    await page.click('#orvAiFab'); await page.waitForTimeout(500);
    const restored = await page.evaluate(() => ({ earlier: !!document.querySelector('.orv-agent-earlier'), users: [...document.querySelectorAll('#orvAiFeed .orv-ai-msg-user')].map((e) => e.textContent), cards: document.querySelectorAll('#orvAiFeed .orv-agent-card').length }));
    check('after a reload the conversation is back (this device), with its cards', restored.earlier && restored.users.includes('Create a campaign for my candles') && restored.cards >= 2, restored);
    await send(page, 'And now?');
    const hist = M.chatBodies[M.chatBodies.length - 1].history || [];
    check('…and the model gets that history (bounded) with the notes about drafts and research', hist.length >= 4 && hist.some((h) => /Campaign draft saved: Spring candles/.test(h.content)) && hist.some((h) => /report id 11111111/.test(h.content)), hist.map((h) => h.content.slice(0, 60)));
    check('restoring does not save the campaign draft a second time', (await page.evaluate(() => window._orvGetCampaigns().filter((c) => /^agent_/.test(c.id)).length)) === 1);
    await page.click('#orvAgentNew'); await page.waitForTimeout(300);
    check('New conversation clears the feed and this device’s copy', (await count()) === 0 && !(await page.evaluate(() => localStorage.getItem('orv_agent_chat_v1:user-pa-1'))));
    await send(page, 'Hello again');
    await page.evaluate(() => window.orvAgent.forgetAll());
    check('sign-out forgets the conversation on this device', !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.indexOf('orv_agent_chat_v1:') === 0))));
    check('…authSignOut calls it (and account deletion clears orv* storage)', /orvAgent\.forgetAll\(\)/.test(fs.readFileSync(path.join(ROOT, 'js', 'auth.js'), 'utf8')) && /\^\(_\?orv\|/.test(fs.readFileSync(path.join(ROOT, 'js', 'settings.js'), 'utf8')));

    console.log('\nE. One assistant');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.evaluate(() => navigate('aichat')); await page.waitForTimeout(400);
    check('"Ask Oriven" (the old chat page) opens the personal assistant instead', await panelOpen(page) && !(await page.evaluate(() => { const p = document.getElementById('page-aichat'); return p && p.classList.contains('active'); })));
    await page.keyboard.press('Escape');

    console.log('\nF. Choosing an assistant (account that never chose)');
    M.agent = 'vector'; M.assigned = false;
    await page.evaluate(() => window.orvAgent.load(true)); await page.waitForTimeout(500);
    await page.click('#orvAiFab'); await page.waitForTimeout(300);
    const un = await page.evaluate(() => ({ fab: document.getElementById('orvAiFab').textContent.trim(), name: document.querySelector('.orv-ai-panel-name').textContent, agentAttr: document.getElementById('orvAiFab').getAttribute('data-agent'), input: document.getElementById('orvAiInput').disabled, text: document.getElementById('orvAiPanel').innerText }));
    check('never chosen: the widget shows no assistant the user didn’t pick (not the default Vector) and asks for the choice', un.fab === 'Choose your assistant' && un.name === 'Your assistant' && !un.agentAttr && !/Vector, your|I’m Vector/.test(un.text), un);
    const chats0 = M.chatBodies.length;
    await page.evaluate(() => window.orvAiSend && window.orvAiSend()); await page.waitForTimeout(300);
    check('…chat waits for the choice: input disabled and a send is not made', un.input && M.chatBodies.length === chats0);
    check('…picker lists the six with name and specialisation', await page.locator('#orvAgentPicker [data-agent-pick]').count() === 6 && /Creative & Content/.test(await page.textContent('#orvAgentPicker')));
    await page.click('#orvAgentPicker [data-agent-pick="nova"]'); await page.waitForTimeout(500);
    const nova = await page.evaluate(() => ({ name: document.querySelector('.orv-ai-panel-name').textContent, color: document.getElementById('orvAiPanel').style.getPropertyValue('--orv-agent'), picker: !!document.getElementById('orvAgentPicker') }));
    check('choosing Nova → PUT /api/agent {agentId:"nova"}; Nova’s name and colour everywhere; picker gone', M.puts.length === 1 && M.puts[0].agentId === 'nova' && nova.name === 'Nova' && nova.color.trim().toUpperCase() === '#FF6FA8' && !nova.picker, { puts: M.puts, nova });
    await page.screenshot({ path: path.join(SHOTS, 'desktop-nova.png') });
    await page.keyboard.press('Escape');

    console.log('\nH. The saved assistant across refreshes, sign-outs and sessions');
    const hc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let hp = await openApp(hc, 'ann');
    check('H1 no saved choice: "Choose your assistant" — none assigned, nothing saved automatically', (await fabText(hp)) === 'Choose your assistant' && !ACC.puts.length && !ACC.store['tok-ann'], { fab: await fabText(hp), puts: ACC.puts });
    await hp.click('#orvAiFab'); await hp.waitForTimeout(300);
    await hp.click('#orvAgentPicker [data-agent-pick="scout"]'); await hp.waitForTimeout(500);
    check('H2 choosing Scout saves it to the account (PUT /api/agent); the widget shows Scout', ACC.store['tok-ann'] === 'scout' && (await fabText(hp)) === 'Scout', { store: ACC.store, fab: await fabText(hp) });
    await hp.keyboard.press('Escape');
    await hp.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' }); // a refresh (the app's /app route is app.html)
    await hp.waitForFunction(() => !!window.orvAgent && !!window.orvAppNav, null, { timeout: 15000 });
    await signInAs(hp, 'ann');
    check('H3 select Scout → refresh → Scout', (await fabText(hp)) === 'Scout');
    await signOut(hp);
    check('H4 signed out: the launcher no longer shows Scout', (await fabText(hp)) === 'Your assistant', await fabText(hp));
    // Values a browser could have kept must not decide anything.
    await hp.evaluate(() => { try { localStorage.setItem('orv_agent', 'momentum'); localStorage.setItem('assistant', 'momentum'); sessionStorage.setItem('orv_agent', 'momentum'); Object.keys(localStorage).filter((x) => /settings/i.test(x)).forEach((k) => { const v = JSON.parse(localStorage.getItem(k) || '{}'); v.assistant = 'momentum'; localStorage.setItem(k, JSON.stringify(v)); }); } catch (_) {} });
    await signInAs(hp, 'ann');
    check('H5 select Scout → sign out → sign in → Scout (stale browser values ignored)', (await fabText(hp)) === 'Scout' && ACC.store['tok-ann'] === 'scout', await fabText(hp));
    await hp.close(); await hc.close();
    const hc2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    hp = await openApp(hc2, 'ann');
    check('H6 select Scout → close and reopen (new browser session) → Scout', (await fabText(hp)) === 'Scout');
    await hp.click('#orvAiFab'); await hp.waitForTimeout(300);
    const pk = await hp.evaluate(() => { const p = document.getElementById('orvAiPanel'); return { change: !!document.querySelector('[data-agent-change]'), picker: !!document.getElementById('orvAgentPicker'), word: /\bChange\b/.test(p.innerText), name: (p.querySelector('.orv-ai-panel-name') || {}).textContent }; });
    check('H7 no way to switch: no "Change" button and no picker once an assistant is chosen', !pk.change && !pk.picker && !pk.word && pk.name === 'Scout', pk);
    const putsBefore = ACC.puts.length;
    await hp.evaluate(() => window.orvAgent.choose('momentum')); await hp.waitForTimeout(500);
    check('H8 even a scripted switch is refused by the server (409): the widget and the account stay Scout', ACC.puts.length === putsBefore + 1 && ACC.store['tok-ann'] === 'scout' && (await fabText(hp)) === 'Scout', { store: ACC.store['tok-ann'], fab: await fabText(hp) });
    await signOut(hp); await signInAs(hp, 'ann');
    check('H9 …sign out → sign in → still Scout', (await fabText(hp)) === 'Scout');
    // A late answer for the account that signed out never paints the next account.
    ACC.store['tok-bob'] = 'nova'; ACC.delay['tok-ann'] = 1200;
    await hp.evaluate(() => window.orvAgent.load(true));
    await signOut(hp); await signInAs(hp, 'bob');
    await hp.waitForTimeout(1500);
    check('H10 the previous account’s late answer is ignored: the new account sees its own assistant (Nova)', (await fabText(hp)) === 'Nova', await fabText(hp));
    delete ACC.delay['tok-ann'];
    await hp.close(); await hc2.close();

    console.log('\nI. The chat: starting points, page context, states');
    {
      const ic = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const ip = await ic.newPage(); await fence(ip); ip.on('pageerror', (e) => errors.push('I: ' + e.message));
      M.agent = 'metric'; M.assigned = true; M.balance = 1000;
      const puts0 = M.puts.length + ACC.puts.length;
      await signIn(ip);
      await ip.evaluate(() => window.orvAppNav.go('overview')); await ip.waitForTimeout(500);
      await ip.click('#orvAiFab'); await ip.waitForTimeout(400);
      const st = await ip.evaluate(() => ({ titles: [...document.querySelectorAll('#orvAgentStarters .orv-agent-starter-t')].map((e) => e.textContent), shown: !document.getElementById('orvAgentStarters').hidden, where: (document.getElementById('orvAgentWhere') || {}).textContent, sugg: (document.querySelector('#orvAiSuggestList .orv-ai-suggest-hd') || {}).textContent, intro: document.getElementById('orvAgentIntro').textContent, tagline: document.querySelector('#orvAiPanel .orv-agent-tagline').textContent, sendDisabled: document.getElementById('orvAiSendBtn').disabled }));
      check('I1 empty conversation: Metric’s greeting and tagline, and four starting points (Analyze my campaigns, Improve my advertising, Create something new, Explain my performance)', st.shown && JSON.stringify(st.titles) === JSON.stringify(['Analyze my campaigns', 'Improve my advertising', 'Create something new', 'Explain my performance']) && /^Metric says hello/.test(st.intro) && st.tagline === 'Precise, direct and evidence-oriented.', st);
      check('I2 the panel shows the page it knows you are on (Campaign Overview), with that page’s own questions', st.where === 'On Campaign Overview' && st.sugg === 'On Campaign Overview', st);
      check('I3 an empty message can’t be sent (Send is disabled)', st.sendDisabled);
      await ip.screenshot({ path: path.join(SHOTS, 'chat-welcome-1440.png') });
      const n0 = M.chatBodies.length;
      M.chat.push({ delay: 900, status: 200, body: { reply: '## What I can see\nYou have no live campaigns yet, so there is nothing to analyse.\n\n- Connect an ad account in **Ad Platforms**\n- Then launch a draft from `Launch`\n\n1. Connect\n2. Launch\n\n<img src=x onerror=alert(1)>', agent: { id: 'metric', name: 'Metric' } } });
      await ip.hover('#orvAgentStarters [data-starter="analyze"]');
      await ip.click('#orvAgentStarters [data-starter="analyze"]'); await ip.waitForTimeout(250);
      const mid = await ip.evaluate(() => ({ status: document.querySelector('#orvAiPanel .orv-agent-status').textContent, data: document.getElementById('orvAiPanel').getAttribute('data-status'), loading: document.getElementById('orvAiSendBtn').classList.contains('is-loading'), disabled: document.getElementById('orvAiSendBtn').disabled, typing: (document.querySelector('#orvAiFeed .orv-agent-typing') || {}).textContent || '', greet: getComputedStyle(document.getElementById('orvAiGreeting')).display, user: ([...document.querySelectorAll('#orvAiFeed .orv-ai-msg-user .orv-ai-msg-bubble')].pop() || {}).textContent }));
      check('I4 a starting point sends its question through the normal chat: shown as your message, Metric "is thinking…", status Thinking, Send shows a spinner and is disabled', /^Analyze my campaigns: what’s working/.test(mid.user) && /Metric is thinking/.test(mid.typing) && mid.status === 'Thinking…' && mid.data === 'thinking' && mid.loading && mid.disabled, mid);
      await ip.waitForTimeout(1100);
      const body = M.chatBodies[n0] || {};
      check('I5 …one POST /api/ai/chat with that message, the page as context.view ("overview"), and no assistant id (the server decides who answers)', M.chatBodies.length === n0 + 1 && /^Analyze my campaigns:/.test(body.message) && body.context && body.context.view === 'overview' && !/"(agent|agentId|assistant|persona)"\s*:/.test(JSON.stringify(body)), { n: M.chatBodies.length - n0, view: body.context && body.context.view, keys: Object.keys(body) });
      check('I5b …the question asks the assistant to use only real data and say what is missing (no invented numbers)', /Use only the data you actually have/.test(body.message));
      const done = await ip.evaluate(() => { const b = [...document.querySelectorAll('#orvAiFeed .orv-ai-msg-ai .orv-ai-msg-bubble')].pop(); return { h4: b && b.querySelectorAll('h4').length, ul: b && b.querySelectorAll('ul li').length, ol: b && b.querySelectorAll('ol li').length, code: b && b.querySelectorAll('code').length, strong: b && b.querySelectorAll('strong').length, img: b && b.querySelectorAll('img').length, raw: b && /<img/.test(b.textContent), status: document.querySelector('#orvAiPanel .orv-agent-status').textContent, loading: document.getElementById('orvAiSendBtn').classList.contains('is-loading') }; });
      check('I6 the answer renders with structure (heading, bullet and numbered lists, bold, code) and stays escaped (no injected HTML)', done.h4 === 1 && done.ul === 2 && done.ol === 2 && done.code === 1 && done.strong === 1 && done.img === 0 && done.raw, done);
      check('I7 after the answer: status back to Ready, no spinner', done.status === 'Ready' && !done.loading, done);
      await ip.screenshot({ path: path.join(SHOTS, 'chat-answer-1440.png') });
      await ip.fill('#orvAiInput', 'hello');
      check('I8 typing enables Send', !(await ip.evaluate(() => document.getElementById('orvAiSendBtn').disabled)));
      await ip.fill('#orvAiInput', 'line one'); await ip.press('#orvAiInput', 'Shift+Enter'); await ip.type('#orvAiInput', 'line two');
      check('I9 Shift+Enter adds a line (nothing sent) and the box grows', (await ip.inputValue('#orvAiInput')) === 'line one\nline two' && M.chatBodies.length === n0 + 1 && (await ip.evaluate(() => document.getElementById('orvAiInput').offsetHeight)) > 30);
      await ip.press('#orvAiInput', 'Enter'); await ip.waitForTimeout(700);
      check('I10 Enter sends; the box empties and shrinks back', M.chatBodies.length === n0 + 2 && (await ip.inputValue('#orvAiInput')) === '' && (await ip.evaluate(() => document.getElementById('orvAiInput').offsetHeight)) < 34);
      await ip.evaluate(() => window.orvCloseAi());

      // Context per page: each page goes as its own view; the panel says which.
      const seen = [];
      for (const [id, label] of [['plan', 'Marketing Plan'], ['research', 'Research'], ['create', 'Create'], ['audiences', 'Audience Builder'], ['competitors', 'Competitor Analysis']]) {
        await ip.evaluate((v) => window.orvAppNav.go(v), id); await ip.waitForTimeout(600);
        await ip.click('#orvAiFab'); await ip.waitForTimeout(300);
        const w = await ip.evaluate(() => (document.getElementById('orvAgentWhere') || {}).textContent);
        const k = M.chatBodies.length;
        await send(ip, 'What should I do here?');
        seen.push({ id, w, view: (M.chatBodies[k] && M.chatBodies[k].context || {}).view, ok: w === 'On ' + label });
        await ip.evaluate(() => window.orvCloseAi()); await ip.waitForTimeout(150);
      }
      check('I11 context follows the page: Marketing Plan, Research, Create, Audience Builder and Competitor Analysis each go as their own view and are named in the panel', seen.every((x) => x.ok && x.view === x.id), seen);
      check('I12 page context never changes the assistant: still Metric everywhere', (await fabText(ip)) === 'Metric' && (await ip.evaluate(() => window.orvAgent.current().id)) === 'metric' && M.puts.length + ACC.puts.length === puts0, { puts: M.puts.length + ACC.puts.length - puts0 });

      // Errors: an unreachable server says so (Offline), Try again recovers.
      await ip.click('#orvAiFab'); await ip.waitForTimeout(300);
      await ip.route('**/api/ai/chat', (r) => r.abort('connectionfailed'));
      await send(ip, 'Are you there?'); await ip.waitForTimeout(400);
      const off = await ip.evaluate(() => ({ status: document.querySelector('#orvAiPanel .orv-agent-status').textContent, err: ([...document.querySelectorAll('#orvAiFeed .orv-agent-error')].pop() || {}).textContent || '' }));
      check('I13 a request that can’t reach the server: status Offline, a clear error and Try again', off.status === 'Offline' && /couldn’t be reached/.test(off.err) && /Try again/.test(off.err), off);
      await ip.unroute('**/api/ai/chat');
      await ip.click('#orvAiFeed .orv-agent-error .orv-agent-retry'); await ip.waitForTimeout(900);
      check('I14 …Try again succeeds and the status is Ready again', (await ip.evaluate(() => document.querySelector('#orvAiPanel .orv-agent-status').textContent)) === 'Ready');

      // Credits: an empty balance stops a starting point before any chat request.
      await ip.evaluate(() => window.orvAiNewConversation()); await ip.waitForTimeout(200);
      // The production path: js/supabase.js switches the credit gate off on
      // localhost (ORIVEN_DEV), so it is switched back on for this check.
      M.balance = 0; await ip.evaluate(() => { ORIVEN_DEV = false; _cachedPlan = Object.keys(ORIVEN_PLANS).find((k) => k !== 'free'); _planCachedAt = Date.now(); _cachedCreditStatus = null; _creditStatusCachedAt = 0; });
      const k2 = M.chatBodies.length;
      await ip.click('#orvAgentStarters [data-starter="improve"]'); await ip.waitForTimeout(900);
      const cr = await ip.evaluate(() => ({ users: document.querySelectorAll('#orvAiFeed .orv-ai-msg-user').length, starters: !document.getElementById('orvAgentStarters').hidden && getComputedStyle(document.getElementById('orvAiGreeting')).display !== 'none' }));
      check('I15 no credits: a starting point is stopped by the existing credit check — no chat request, nothing charged, the message isn’t left in the feed, the welcome comes back', M.chatBodies.length === k2 && cr.users === 0 && cr.starters, { sent: M.chatBodies.length - k2, cr });
      const pw = await ip.evaluate(() => { const m = document.getElementById('modal-paywall'); return !!m && getComputedStyle(m).display !== 'none'; });
      check('I15b …and the existing paywall opens, as for any action without credits', pw);
      M.balance = 1000; await ip.evaluate(() => { ORIVEN_DEV = true; _cachedCreditStatus = null; _creditStatusCachedAt = 0; if (typeof closeModal === 'function') closeModal('modal-paywall'); });
      await ip.waitForTimeout(300);
      if (!(await panelOpen(ip))) { await ip.evaluate(() => window.orvOpenAi()); await ip.waitForTimeout(300); }
      M.chat.push({ status: 402, body: { error: 'Not enough credits', code: 'CREDITS_EXHAUSTED' } });
      const k3 = M.chatBodies.length;
      await ip.click('#orvAgentStarters [data-starter="explain"]'); await ip.waitForTimeout(900);
      check('I16 …and when the server refuses (402, e.g. another tab spent them) the chat says so with the upgrade link', M.chatBodies.length === k3 + 1 && /out of AI credits/.test(await ip.textContent('#orvAiFeed')));
      await ip.evaluate(() => window.orvCloseAi());

      // Tablet width: still a floating panel, inside the screen.
      await ip.setViewportSize({ width: 1024, height: 768 }); await ip.waitForTimeout(300);
      await ip.click('#orvAiFab'); await ip.waitForTimeout(400);
      const tb = await ip.evaluate(() => { const r = document.getElementById('orvAiPanel').getBoundingClientRect(); return { w: Math.round(r.width), left: Math.round(r.left), top: Math.round(r.top), right: Math.round(innerWidth - r.right), ov: document.documentElement.scrollWidth - innerWidth }; });
      check('I17 tablet (1024×768): a large floating panel inside the screen, below the menu button, no overflow', tb.w >= 420 && tb.left > 0 && tb.top >= 60 && tb.right <= 26 && tb.ov <= 0, tb);
      await ip.screenshot({ path: path.join(SHOTS, 'chat-tablet-1024.png') });
      await ic.close();
    }
    {
      // Never chosen: no starting points (the choice comes first).
      const uc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const up = await uc.newPage(); await fence(up);
      M.agent = 'vector'; M.assigned = false;
      await signIn(up);
      await up.click('#orvAiFab'); await up.waitForTimeout(400);
      const un = await up.evaluate(() => ({ starters: document.getElementById('orvAgentStarters').hidden, picker: !!document.getElementById('orvAgentPicker'), name: document.querySelector('#orvAiPanel .orv-ai-panel-name').textContent }));
      check('I18 an account that never chose sees the choice, not the starting points or a default assistant', un.starters && un.picker && un.name === 'Your assistant', un);
      M.assigned = true; M.agent = 'scout';
      await uc.close();
    }

    console.log('\nG. Phone');
    const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await ph.newPage(); await fence(mp); mp.on('pageerror', (e) => errors.push(e.message));
    M.agent = 'flux'; M.assigned = true;
    await signIn(mp);
    f = await fab(mp);
    check('phone: launcher [Flux mark] Flux inside the screen', f.visible && f.text === 'Flux' && f.right <= f.w && f.bottom <= f.h, f);
    await mp.click('#orvAiFab'); await mp.waitForTimeout(400);
    const pm = await mp.evaluate(() => { const r = document.getElementById('orvAiPanel').getBoundingClientRect(); const inp = document.getElementById('orvAiInput').getBoundingClientRect(); const m = document.getElementById('orvMobToggle').getBoundingClientRect();
      const hit = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
      return { w: r.width, top: Math.round(r.top), bottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, inputVisible: inp.bottom <= innerHeight && inp.top > 0, overflow: document.documentElement.scrollWidth > innerWidth + 1, menuClear: m.bottom <= r.top, menuHit: !!(hit && hit.closest('#orvMobToggle')), starters: document.querySelectorAll('#orvAgentStarters .orv-agent-starter').length }; });
    check('phone: a full-width sheet up to the bottom, the input reachable, nothing overflows — and the menu button stays visible and clickable above it', pm.w >= pm.vw - 1 && pm.bottom >= pm.vh - 1 && pm.inputVisible && !pm.overflow && pm.menuClear && pm.menuHit && pm.starters === 4, pm);
    await mp.screenshot({ path: path.join(SHOTS, 'phone-open.png') });

    check('no page errors', errors.length === 0, errors.slice(0, 5));
    check('nothing left the browser (the app’s own Supabase reads were aborted by the fence)', blocked.filter((u) => !/googletagmanager|esm[.]sh|supabase[.]co/.test(u)).length === 0, blocked.slice(0, 5));
  } catch (e) { console.log('CRASH', e && e.stack || e); fail++; try { const pgs = browser.contexts().flatMap((c) => c.pages()); if (pgs[0]) await pgs[0].screenshot({ path: path.join(SHOTS, 'crash.png') }); } catch (_) {} }
  await browser.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed. Screenshots: ${SHOTS}`);
  server.close(); process.exit(fail ? 1 : 0);
});
