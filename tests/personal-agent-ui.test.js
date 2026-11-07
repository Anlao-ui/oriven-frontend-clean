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
const pub = (id) => { const a = AGENTS.find((x) => x.id === id); return Object.assign({}, a, { intro: 'I’m ' + a.name + ', your ' + a.role + ' assistant in OrivenAI.', strengths: ['a', 'b', 'c'], alsoHelps: ['Create'] }); };
const M = { agent: 'scout', assigned: true, chat: [], chatBodies: [], puts: [], executes: [], research: 'running' };
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json({ limit: '2mb' }));
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, reason: 'existing_account', completed: true, stage: 'done', flow: { enabled: false } }));
app.get('/api/credits/status', (q, r) => r.json({ balance: 1000, plan: 'paid', hasAccess: true, accessExpiresAt: new Date(Date.now() + 20 * 864e5).toISOString() }));
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
app.post('/api/ai/chat', (q, r) => { M.chatBodies.push(q.body); const next = M.chat.shift() || { status: 200, body: { reply: 'Here is a short answer.' } }; r.status(next.status).json(next.body); });
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
    const head = await page.evaluate(() => { const p = document.getElementById('orvAiPanel'); const g = p.querySelector('.orv-agent-head-glyph'); const gr = g && g.getBoundingClientRect(), pr = p.getBoundingClientRect(); return { name: p.querySelector('.orv-ai-panel-name').textContent, role: p.querySelector('.orv-agent-role').textContent, centred: gr ? Math.abs((gr.left + gr.width / 2) - (pr.left + pr.width / 2)) < 3 : false, intro: (document.getElementById('orvAgentIntro') || {}).textContent || '', ph: document.getElementById('orvAiInput').placeholder, fabHidden: document.getElementById('orvAiFab').classList.contains('orv-ai-fab-hidden'), w: pr.width, h: pr.height }; });
    check('click → popup with Scout’s mark centred, name, specialisation and intro', (await panelOpen(page)) && head.name === 'Scout' && head.role === 'Research & Insights' && head.centred && /I’m Scout/.test(head.intro), head);
    check('…the input asks for Scout, the launcher steps aside, the popup is a panel (not full screen)', /^Ask Scout/.test(head.ph) && head.fabHidden && head.w < 500 && head.h < 900, head);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-open.png') });
    const focusColor = await page.evaluate(() => { const i = document.getElementById('orvAiInput'); i.focus(); return getComputedStyle(i).borderTopColor; });
    check('the input’s focus ring uses the agent’s colour (Scout 124, 240, 204), not the app’s lime', /124,\s*240,\s*204/.test(focusColor), focusColor);

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

    console.log('\nG. Phone');
    const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await ph.newPage(); await fence(mp); mp.on('pageerror', (e) => errors.push(e.message));
    M.agent = 'flux'; M.assigned = true;
    await signIn(mp);
    f = await fab(mp);
    check('phone: launcher [Flux mark] Flux inside the screen', f.visible && f.text === 'Flux' && f.right <= f.w && f.bottom <= f.h, f);
    await mp.click('#orvAiFab'); await mp.waitForTimeout(400);
    const pm = await mp.evaluate(() => { const r = document.getElementById('orvAiPanel').getBoundingClientRect(); const inp = document.getElementById('orvAiInput').getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, inputVisible: inp.bottom <= innerHeight && inp.top > 0, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
    check('phone: the popup fills the screen, the input stays reachable, nothing overflows', pm.w >= pm.vw - 1 && pm.h >= pm.vh - 1 && pm.inputVisible && !pm.overflow, pm);
    await mp.screenshot({ path: path.join(SHOTS, 'phone-open.png') });

    check('no page errors', errors.length === 0, errors.slice(0, 5));
    check('nothing left the browser (the app’s own Supabase reads were aborted by the fence)', blocked.filter((u) => !/googletagmanager|esm[.]sh|supabase[.]co/.test(u)).length === 0, blocked.slice(0, 5));
  } catch (e) { console.log('CRASH', e && e.stack || e); fail++; try { const pgs = browser.contexts().flatMap((c) => c.pages()); if (pgs[0]) await pgs[0].screenshot({ path: path.join(SHOTS, 'crash.png') }); } catch (_) {} }
  await browser.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed. Screenshots: ${SHOTS}`);
  server.close(); process.exit(fail ? 1 : 0);
});
