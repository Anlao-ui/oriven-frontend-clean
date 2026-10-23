/* ════════════════════════════════════════════════════════════════
   Plan model consistency — frontend vs backend, offline.

   The frontend plan table (js/plans.js) and the backend's definitions
   (services/planEntitlements.js, creditManager FEATURE_COSTS /
   PLAN_ALLOWANCES, email PLAN_INTRO, the public facts in tools/seo/facts.js)
   must describe the same plans. No browser, no network, no Supabase, no
   Stripe: modules are only loaded and compared.
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');

const BACKEND = process.env.ORIVEN_BACKEND_DIR || path.resolve(__dirname, '..', '..', 'oriven-backend', 'server');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail) : '')); }
}
if (!fs.existsSync(path.join(BACKEND, 'services', 'planEntitlements.js'))) {
  console.log('SKIP — backend not found at ' + BACKEND + ' (set ORIVEN_BACKEND_DIR)');
  process.exit(0);
}

// Frontend: js/plans.js in a sandbox (it only defines globals).
const sandbox = { window: {}, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } }, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'plans.js'), 'utf8') + '\n;this.__P = { ORIVEN_PLANS, CREDIT_COSTS, ORIVEN_PLAN_LIST };', sandbox);
const { ORIVEN_PLANS, CREDIT_COSTS, ORIVEN_PLAN_LIST } = sandbox.__P;

// Backend modules (pure data at require time).
const ent = require(path.join(BACKEND, 'services', 'planEntitlements.js'));
const cm = require(path.join(BACKEND, 'services', 'creditManager.js'));
const tpl = require(path.join(BACKEND, 'services', 'email', 'templates.js'));
const facts = require(path.join(__dirname, '..', 'tools', 'seo', 'facts.js'));

const ORDER = ['free', 'starter', 'creator', 'professional'];

// A. Same plans, same order.
check('A1. Frontend plan order is Free, Starter, Creator, Professional (= backend PLAN_ORDER)', JSON.stringify(ORIVEN_PLAN_LIST.map((p) => p.id)) === JSON.stringify(ORDER) && JSON.stringify(ent.PLAN_ORDER) === JSON.stringify(ORDER), ent.PLAN_ORDER);

// B. Entitlements: frontend table == server enforcement.
ORDER.forEach((id) => {
  check('B.' + id + ' entitlements identical to backend planEntitlements.js', JSON.stringify(ORIVEN_PLANS[id].entitlements) === JSON.stringify(ent.PLAN_ENTITLEMENTS[id]), { fe: ORIVEN_PLANS[id].entitlements, be: ent.PLAN_ENTITLEMENTS[id] });
});
check('B.min Lowest plan per capability: Research/Automations Starter, Oriven Chat + in-app notifications Creator, Priority Support + weekly report Professional',
  ent.minPlanFor('research') === 'starter' && ent.minPlanFor('autopilot') === 'starter' && ent.minPlanFor('orivenChat') === 'creator' && ent.minPlanFor('notifications') === 'creator' && ent.minPlanFor('prioritySupport') === 'professional' && ent.minPlanFor('weeklyReport') === 'professional');

// C. Card lists never claim more (or less) than the entitlements.
const LABEL = { research: 'Research', autopilot: 'Automations', orivenChat: 'Oriven Chat', notifications: 'In-app notifications', prioritySupport: 'Priority Support', weeklyReport: 'Weekly AI Performance Report' };
ORDER.forEach((id) => {
  const p = ORIVEN_PLANS[id], bad = [];
  Object.keys(LABEL).forEach((k) => {
    const inc = (p.features || []).includes(LABEL[k]) || ((p.features || []).includes('Full advertising workflow') && (k === 'research' || k === 'autopilot'));
    // "Limited advertising workflow" (Free) states Research/Automations are not part of it (its note).
    const exc = (p.excludedFeatures || []).includes(LABEL[k]) || ((p.features || []).includes('Limited advertising workflow') && (k === 'research' || k === 'autopilot'));
    if (inc && !p.entitlements[k]) bad.push('claims ' + k);
    if (exc && p.entitlements[k]) bad.push('denies ' + k);
    if (!inc && !exc && (id === 'free' || id === 'starter') && (k === 'research' || k === 'autopilot' || k === 'orivenChat')) bad.push('silent on ' + k);
  });
  check('C.' + id + ' card features / exclusions match entitlements', bad.length === 0, bad);
});

// D. Credit allowances.
ORDER.forEach((id) => {
  check('D.' + id + ' credits ' + ORIVEN_PLANS[id].credits + ' = backend PLAN_ALLOWANCES', ORIVEN_PLANS[id].credits === cm.PLAN_ALLOWANCES[id], { fe: ORIVEN_PLANS[id].credits, be: cm.PLAN_ALLOWANCES[id] });
});
check('D.cycle Free resets daily (FREE_PLAN_CYCLE_DAYS = 1), paid plans monthly', cm.FREE_PLAN_CYCLE_DAYS === 1 && ORIVEN_PLANS.free.creditsCycle === 'day');

// E. Metered costs: CREDIT_COSTS mirrors FEATURE_COSTS.
const F = cm.FEATURE_COSTS;
[['imageAd', 'image_generation'], ['videoAd', 'video_generation'], ['campaign', 'campaign_generation'], ['research', 'ai_analysis'], ['intelligence', 'ai_analysis'], ['chat', 'ai_chat'], ['business', 'website_analysis'], ['automation', 'automation']].forEach(([fe, be]) => {
  check('E.' + fe + ' ' + CREDIT_COSTS[fe] + ' = FEATURE_COSTS.' + be, CREDIT_COSTS[fe] === F[be], { fe: CREDIT_COSTS[fe], be: F[be] });
});
check('E.image complete image ad = draft + image (' + CREDIT_COSTS.imageAdComplete + ')', CREDIT_COSTS.imageAdComplete === F.campaign_generation + F.image_generation);
check('E.video complete video ad = draft + video (' + CREDIT_COSTS.videoAdComplete + ')', CREDIT_COSTS.videoAdComplete === F.campaign_generation + F.video_generation);

// F. Prices: plans.js == email facts == public facts.
['starter', 'creator', 'professional'].forEach((id) => {
  const fe = ORIVEN_PLANS[id].price, em = Number(tpl.PLAN_INTRO[id].price), pub = (facts.plans.find((p) => p.id === id) || {}).price;
  check('F.' + id + ' price €' + fe + ' identical in plans.js, emails and public facts', fe === em && fe === pub && tpl.PLAN_INTRO[id].credits === ORIVEN_PLANS[id].credits, { fe, em, pub });
});
check('F.free Free is €0 everywhere', ORIVEN_PLANS.free.price === 0 && facts.plans[0].price === 0);

// G. Public facts' costs match the registry.
check('G. tools/seo/facts.js costs match CREDIT_COSTS', facts.costs.imageAd === CREDIT_COSTS.imageAdComplete && facts.costs.videoAd === CREDIT_COSTS.videoAdComplete && facts.costs.researchRun === CREDIT_COSTS.research && facts.costs.automationCreate === CREDIT_COSTS.automation && facts.costs.chatMessage === CREDIT_COSTS.chat, facts.costs);

console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) process.exit(1);
