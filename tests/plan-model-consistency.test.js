/* ════════════════════════════════════════════════════════════════
   Plan model consistency — frontend vs backend, offline.

   One product since 2026-10-30: five access periods (Flex, Monthly,
   Quarterly, Semi-Annual, Annual), bought once, no automatic renewal, the
   same features for every paying account. The frontend table (js/plans.js)
   and the backend (services/pricing.js, planEntitlements.js, creditManager
   FEATURE_COSTS, email PLAN_INTRO) and the public facts (tools/seo/facts.js)
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
if (!fs.existsSync(path.join(BACKEND, 'services', 'pricing.js'))) {
  console.log('SKIP — backend not found at ' + BACKEND + ' (set ORIVEN_BACKEND_DIR)');
  process.exit(0);
}

// Frontend: js/plans.js in a sandbox, exactly as the browser loads it.
const sandbox = { window: {}, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } }, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'plans.js'), 'utf8') + '\n;this.__P = { ORIVEN_PRICING, ORIVEN_PERIOD_PLANS, ORIVEN_PLANS, CREDIT_COSTS, ORIVEN_PAID_STATUSES, orvPlanHas, orvEffectiveStatus };', sandbox);
const F = sandbox.__P;

const pricing = require(path.join(BACKEND, 'services', 'pricing.js'));
const ent = require(path.join(BACKEND, 'services', 'planEntitlements.js'));
const cm = require(path.join(BACKEND, 'services', 'creditManager.js'));
const tpl = require(path.join(BACKEND, 'services', 'email', 'templates.js'));
const facts = require(path.join(__dirname, '..', 'tools', 'seo', 'facts.js'));

// A. The same five plans everywhere.
check('A1. Five plans in the same order: browser, backend, emails, public facts',
  JSON.stringify(F.ORIVEN_PERIOD_PLANS.map((p) => p.id)) === JSON.stringify(pricing.PLAN_ORDER) &&
  JSON.stringify(facts.plans.map((p) => p.id)) === JSON.stringify(pricing.PLAN_ORDER) &&
  pricing.PLAN_ORDER.every((id) => tpl.PLAN_INTRO[id]));
for (const id of pricing.PLAN_ORDER) {
  const be = pricing.PLANS[id], fe = F.ORIVEN_PERIOD_PLANS.find((p) => p.id === id), fa = facts.plans.find((p) => p.id === id), em = tpl.PLAN_INTRO[id];
  check(`A2.${id} price €${be.priceInclVat}, ${pricing.periodLabel(be)}, ${be.credits} credits identical in plans.js, emails and public facts`,
    fe.price === be.priceInclVat && fa.price === be.priceInclVat && em.price === pricing.priceLabel(be) &&
    fe.credits === be.credits && fa.creditCount === be.credits && em.credits === be.credits &&
    fe.periodLabel === pricing.periodLabel(be) && em.period === pricing.periodLabel(be) && fe.instalments === be.instalments,
    { fe, fa, em: { price: em.price, credits: em.credits, period: em.period } });
}

// B. One product: entitlements.
const KEYS = ['research', 'autopilot', 'orivenChat', 'notifications', 'prioritySupport', 'weeklyReport'];
check('B1. Every paying status gets every entitlement (browser = backend)', JSON.stringify(F.ORIVEN_PAID_STATUSES) === JSON.stringify(pricing.PAID_STATUSES) &&
  pricing.PAID_STATUSES.every((s) => KEYS.every((k) => F.orvPlanHas(s, k) === true && ent.hasEntitlement(s, k) === true)));
check('B2. No access (free) gets nothing (browser = backend)', KEYS.every((k) => F.orvPlanHas('free', k) === false && ent.hasEntitlement('free', k) === false));

// C. Credit costs.
check('C1. plans.js featureCosts = backend FEATURE_COSTS = what creditManager charges', JSON.stringify(F.ORIVEN_PRICING.featureCosts) === JSON.stringify(pricing.FEATURE_COSTS) && JSON.stringify(cm.FEATURE_COSTS) === JSON.stringify(pricing.FEATURE_COSTS));
check('C2. client pre-flight costs map to the server keys', F.CREDIT_COSTS.research === pricing.FEATURE_COSTS.research_report && F.CREDIT_COSTS.chat === pricing.FEATURE_COSTS.ai_chat && F.CREDIT_COSTS.campaign === pricing.FEATURE_COSTS.campaign_generation && F.CREDIT_COSTS.imageAd === pricing.FEATURE_COSTS.image_generation && F.CREDIT_COSTS.videoAd === pricing.FEATURE_COSTS.video_generation && F.CREDIT_COSTS.automation === pricing.FEATURE_COSTS.automation && F.CREDIT_COSTS.intelligence === pricing.FEATURE_COSTS.ai_analysis && F.CREDIT_COSTS.business === pricing.FEATURE_COSTS.website_analysis);
check('C3. public facts quote the same costs', facts.costs.imageAd === F.CREDIT_COSTS.imageAdComplete && facts.costs.videoAd === F.CREDIT_COSTS.videoAdComplete && facts.costs.researchRun === pricing.FEATURE_COSTS.research_report && facts.costs.automationCreate === pricing.FEATURE_COSTS.automation);
check('C4. no free allowance anywhere', !cm.PLAN_ALLOWANCES.free && F.ORIVEN_PLANS.free.credits === 0);

// D. Access is time-based in the browser exactly as on the server.
const now = Date.parse('2026-11-15T12:00:00Z');
const rows = [
  { subscription_status: 'paid', access_expires_at: '2026-12-01T00:00:00Z' },
  { subscription_status: 'paid', access_expires_at: '2026-11-01T00:00:00Z' },
  { subscription_status: 'creator', access_expires_at: '2026-11-20T00:00:00Z' },
  { subscription_status: 'free', access_expires_at: '2026-12-01T00:00:00Z' },
  { subscription_status: 'paid', access_expires_at: null },
  { subscription_status: 'professional' },
];
check('D1. orvEffectiveStatus (browser) agrees with pricing.hasAccess (server) on every case', rows.every((r) => (F.orvEffectiveStatus(r, now) !== 'free') === pricing.hasAccess(r, now)), rows.map((r) => [F.orvEffectiveStatus(r, now), pricing.hasAccess(r, now)]));

// E. Renewal and VAT are stated the same way.
check('E1. manual renewal, credits expire with access, 21% VAT', F.ORIVEN_PRICING.renewal === 'manual' && F.ORIVEN_PRICING.creditsExpireWithAccess === true && F.ORIVEN_PRICING.vatRate === pricing.VAT_RATE);

console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
