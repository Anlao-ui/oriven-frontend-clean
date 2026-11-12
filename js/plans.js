// ════════════════════════════════════════════════════════════════
// ORIVEN — Central Plan Configuration
//
// SINGLE SOURCE OF TRUTH (frontend) for plans, prices, credits and the
// credit cost of every action. Load this before settings.js, paywall.js,
// and studio.js. The public pages, the in-app paywall, onboarding and
// Settings all render from it; the backend enforces the same numbers
// (server/services/pricing.js) and tests/pricing.test.js in the backend
// fails when the two disagree. Also loadable in Node (module.exports at the
// bottom) for tools/seo and the tests.
//
// Business model (2026-10-30): one product, the same functionality for every
// paying customer. Five access periods are bought once and renewed manually;
// nothing renews automatically. They differ only in price, duration and
// credits. Unused credits expire when access ends. There is no free plan.
// ════════════════════════════════════════════════════════════════

// ── Canonical number formatter — the ONE place credit/plan quantities
// get their thousands separator. Dutch-style dot separator (12000 ->
// "12.000"), applied consistently everywhere a credit/plan number reaches
// the UI. Presentation only.
function orvFormatCredits(n){
  if(typeof n !== "number" || isNaN(n)) return String(n);
  return n.toLocaleString("nl-NL");
}

// ── Pricing (mirrors server/services/pricing.js) ─────────────────────────
// Prices are BEFORE VAT: Stripe Tax calculates the VAT for the customer's
// location at checkout and adds it on top (e.g. 21 % in the Netherlands). credits = the period's total allowance; plans with
// more than one instalment grant it in equal monthly parts, all within the
// access period.
var ORIVEN_PRICING = {
  vatRate: 0.21,
  currency: "EUR",
  renewal: "manual",
  creditsExpireWithAccess: true,
  plans: [
    { id: "flex",       name: "Flex",        priceInclVat: 17,  days: 14, months: 0,  credits: 1050,  instalments: 1,
      description: "Get full access to OrivenAI for 14 days. Explore AI-powered research, content creation, advertising and marketing automation." },
    { id: "monthly",    name: "Monthly",     priceInclVat: 29,  days: 0,  months: 1,  credits: 1750,  instalments: 1,
      description: "Get full access to OrivenAI for one month. Plan, research, create and manage your marketing from one workspace." },
    { id: "quarterly",  name: "Quarterly",   priceInclVat: 78,  days: 0,  months: 3,  credits: 4800,  instalments: 3,
      description: "Get full access to OrivenAI for three months. Build and improve your marketing strategy with AI-powered research, content creation and campaign tools." },
    { id: "semiannual", name: "Semi-Annual", priceInclVat: 143, days: 0,  months: 6,  credits: 8850,  instalments: 6,
      description: "Get full access to OrivenAI for six months. Manage and improve your marketing with AI-powered tools for research, content creation, campaigns and automation." },
    { id: "annual",     name: "Annual",      priceInclVat: 245, days: 0,  months: 12, credits: 15000, instalments: 12,
      description: "Get full access to OrivenAI for twelve months. Get a complete year of AI-powered marketing tools to research, plan, create and manage your campaigns." }
  ],
  // Credit cost of every paid action (server: pricing.FEATURE_COSTS).
  featureCosts: {
    ai_chat: 30, ai_chat_step: 30, research_report: 90, ai_analysis: 45,
    campaign_generation: 65, campaign_improvement: 25, audience_generation: 25,
    product_analysis: 25, competitor_analysis: 30, brand_voice: 35,
    website_analysis: 35, web_generation: 20, image_generation: 55,
    video_generation: 180, video_generation_10s: 350, automation: 20, plan_generation: 90
  }
};

// ── Credit cost per generation type ───────────────────────────
// Client-side names for the server's FEATURE_COSTS, used for the pre-flight
// credit check before a request. The server charges the real amount
// regardless of what the client shows.
var CREDIT_COSTS = (function(fc){
  return {
    ideas:          fc.ai_chat,
    text:           fc.campaign_improvement,
    copy:           fc.campaign_improvement,
    email:          fc.campaign_improvement,
    poster:         fc.campaign_improvement,
    infographic:    fc.campaign_improvement,
    presentation:   fc.campaign_improvement,
    deck:           fc.campaign_improvement,
    campaign:       fc.campaign_generation,
    website:        fc.web_generation,
    web:            fc.web_generation,
    visual:         fc.image_generation,
    image:          fc.image_generation,
    productshoots:  fc.image_generation,
    ads:            fc.image_generation,
    video:          fc.video_generation,          // one 5-second video
    ugc:            fc.video_generation,
    videoads:       fc.video_generation,
    motiongraphics: fc.video_generation,
    video10s:       fc.video_generation_10s,      // one 10-second video
    plan:           fc.plan_generation,           // a new Marketing Plan on request

    imageAd:      fc.image_generation,
    videoAd:      fc.video_generation,
    videoAd10s:   fc.video_generation_10s,
    intelligence: fc.ai_analysis,
    automation:   fc.automation,  // once per new automation; its checks and campaign changes are free
    autopilot:    fc.automation,  // legacy alias of automation
    chat:         fc.ai_chat,     // per message; a message that needs more steps (tools) uses up to 2 more
    chatStep:     fc.ai_chat_step,
    research:     fc.research_report,
    audience:     fc.audience_generation,   // Audience Builder: one set of audience suggestions
    business:     fc.website_analysis,

    // Customer-facing totals: a complete image ad is the concept/copy step
    // (campaign_generation) plus the image (image_generation); a complete
    // video ad is the concept step plus a 5-second video. The server charges
    // the two real steps separately.
    imageAdComplete: fc.campaign_generation + fc.image_generation,
    videoAdComplete: fc.campaign_generation + fc.video_generation
  };
})(ORIVEN_PRICING.featureCosts);

// ── Canonical, user-facing credit action list — the ONE source every
// surface (Settings, paywall, pricing page, onboarding) renders its "what
// costs credits" list from.
var ORIVEN_CREDIT_ACTIONS = [
  { key: "imageAd",     label: "Image ad (copy + image)",  cost: CREDIT_COSTS.imageAdComplete },
  { key: "videoAd",     label: "Video ad (copy + 5 s video)", cost: CREDIT_COSTS.videoAdComplete },
  { key: "research",    label: "Research",                 cost: CREDIT_COSTS.research },
  { key: "chat",        label: "Oriven Chat message",      cost: CREDIT_COSTS.chat },
  { key: "business",    label: "Website Intelligence",     cost: CREDIT_COSTS.business },
  { key: "automation",  label: "New automation",           cost: CREDIT_COSTS.automation }
];

// What every plan includes (one product: no per-plan feature differences).
var ORIVEN_WORKFLOW_STEPS = ["Control Center", "Research", "Create", "Launch", "Campaigns", "Automations"];
var ORIVEN_INCLUDED_FEATURES = [
  "Full advertising workflow",
  "Oriven Chat",
  "In-app notifications",
  "Priority Support",
  "Weekly AI Performance Report"
];
var ORIVEN_ENTITLEMENT_LABELS = {
  research: "Research",
  autopilot: "Automations",
  orivenChat: "Oriven Chat",
  notifications: "In-app notifications",
  prioritySupport: "Priority Support",
  weeklyReport: "Weekly AI Performance Report"
};

// ── Period plans (what can be bought) ──────────────────────────────────
function _orvPeriodLabel(p){
  if(p.days) return p.days + " days";
  return p.months === 1 ? "1 month" : p.months + " months";
}
var ORIVEN_PERIOD_PLANS = ORIVEN_PRICING.plans.map(function(p){
  var perMonth = p.months ? Math.round(p.priceInclVat / p.months * 100) / 100 : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.priceInclVat,
    priceExVat: p.priceInclVat, // the plan price is before VAT (field name kept from the server's priceInclVat)
    days: p.days,
    months: p.months,
    periodLabel: _orvPeriodLabel(p),
    perMonth: perMonth,
    credits: p.credits,
    instalments: p.instalments,
    creditsPerInstalment: p.credits / p.instalments,
    usageExample: {
      imageAds: Math.floor(p.credits / CREDIT_COSTS.imageAdComplete),
      videoAds: Math.floor(p.credits / CREDIT_COSTS.videoAdComplete)
    },
    // The lowest monthly price is a fact, not a popularity claim.
    badge: p.id === "annual" ? "Lowest monthly price" : ""
  };
});
// The plan chosen on the public pricing page, kept for the plans step of
// onboarding (7 days). Only one of the five plan ids is ever stored; the
// server decides price, duration and credits from the id.
var ORV_PLAN_CHOICE_KEY = "oriven_selected_plan";
function orvRememberPlanChoice(id){
  if(!orvPeriodPlan(id)) return;
  try { localStorage.setItem(ORV_PLAN_CHOICE_KEY, JSON.stringify({ id: id, at: Date.now() })); } catch(_){}
}
function orvRememberedPlanChoice(){
  try {
    var v = JSON.parse(localStorage.getItem(ORV_PLAN_CHOICE_KEY) || "null");
    if(v && orvPeriodPlan(v.id) && Date.now() - (v.at || 0) < 7 * 864e5) return v.id;
  } catch(_){}
  return null;
}
function orvForgetPlanChoice(){ try { localStorage.removeItem(ORV_PLAN_CHOICE_KEY); } catch(_){} }
function orvPeriodPlan(id){
  for(var i = 0; i < ORIVEN_PERIOD_PLANS.length; i++){ if(ORIVEN_PERIOD_PLANS[i].id === id) return ORIVEN_PERIOD_PLANS[i]; }
  return null;
}

// ── Account statuses and entitlements ────────────────────────────────────
// Keyed by profiles.subscription_status. 'paid' = a period plan; the
// legacy monthly subscriptions (starter/creator/professional) are honoured
// until they end and get the same functionality. 'free' = no access (never
// bought, or access ended). Access itself is time-based (the server's
// access_expires_at); these entries only say what an account with access
// gets. Server: services/planEntitlements.js.
var _ORV_ALL = { research: true, autopilot: true, orivenChat: true, notifications: true, prioritySupport: true, weeklyReport: true };
var _ORV_NONE = { research: false, autopilot: false, orivenChat: false, notifications: false, prioritySupport: false, weeklyReport: false };
function _orvStatus(id, name, entitlements, extra){
  var o = { id: id, name: name, entitlements: entitlements, features: entitlements === _ORV_ALL ? ORIVEN_INCLUDED_FEATURES.slice() : [], excludedFeatures: [], teamMembers: 1 };
  for(var k in (extra || {})) o[k] = extra[k];
  return o;
}
var ORIVEN_PLANS = {
  free:         _orvStatus("free", "No active plan", _ORV_NONE, { credits: 0, desc: "Choose a plan to use OrivenAI." }),
  paid:         _orvStatus("paid", "OrivenAI", _ORV_ALL, { desc: "The full OrivenAI advertising workflow." }),
  starter:      _orvStatus("starter", "Starter", _ORV_ALL, { legacy: true, credits: 1000, desc: "Your monthly subscription, honoured until it ends." }),
  creator:      _orvStatus("creator", "Creator", _ORV_ALL, { legacy: true, credits: 2500, desc: "Your monthly subscription, honoured until it ends." }),
  professional: _orvStatus("professional", "Professional", _ORV_ALL, { legacy: true, credits: 4000, teamMembers: 10, desc: "Your monthly subscription, honoured until it ends." })
};
var ORIVEN_PAID_STATUSES = ["paid", "starter", "creator", "professional"];

// Does a status include a capability? Unknown statuses include nothing.
function orvPlanHas(planId, key){
  var p = ORIVEN_PLANS[planId];
  return !!(p && p.entitlements && p.entitlements[key]);
}
// The plan a capability needs: every paid capability needs a paid plan.
function orvMinPlanFor(key){
  return orvPlanHas("paid", key) ? ORIVEN_PLANS.paid : null;
}
// Access is time-based, as on the server (services/pricing.js hasAccess): an
// access end in the future AND either a paying status or one of the five
// plans in access_plan (a plan an operator assigned in Supabase). Returns the
// status the UI should act on: the account's status ('paid' for an assigned
// plan), or 'free' when it has no access now (never bought, or the period
// ended before the expiry job ran).
function orvPlanIdFrom(v){
  if(v == null) return null;
  var k = String(v).toLowerCase().replace(/[^a-z]/g, "");
  return orvPeriodPlan(k) ? k : null;
}
function orvEffectiveStatus(row, now){
  if(!row) return "free";
  var s = row.subscription_status || "free";
  var paidLabel = ORIVEN_PAID_STATUSES.indexOf(s) !== -1;
  if(!paidLabel && !orvPlanIdFrom(row.access_plan)) return "free";
  var exp = row.access_expires_at ? new Date(row.access_expires_at).getTime() : NaN;
  if(!isFinite(exp) || exp <= (now || Date.now())) return "free";
  return paidLabel ? s : "paid";
}

// Lists rendered by the paywall, onboarding and Settings: the five periods.
// (Kept under the old names for existing callers.)
var ORIVEN_PLAN_LIST  = ORIVEN_PERIOD_PLANS;
var ORIVEN_PAID_PLANS = ORIVEN_PERIOD_PLANS;

// ── SVG check mark (shared across all card styles) ─────────────
var _PLAN_CHK_SVG = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>';

// The Weekly AI Performance Report is shown as "Coming soon" until weekly
// delivery is switched on in production (backend WEEKLY_REPORTS_ENABLED and
// a verified test send). Set to true then — and in tools/seo/facts.js.
var ORIVEN_WEEKLY_REPORT_LIVE = false;

// Secondary line for a plan feature (keeps the workflow line concrete
// wherever plans are shown).
function orvPlanFeatureNote(feature){
  if(feature === "Full advertising workflow") return orvPlanT("All six steps: ") + ORIVEN_WORKFLOW_STEPS.join(", ");
  if(feature === "Weekly AI Performance Report") return orvPlanT(ORIVEN_WEEKLY_REPORT_LIVE ? "By email every Monday, from your connected ad accounts" : "Coming soon: by email every Monday, from your connected ad accounts");
  return "";
}

// Plan wording in the app's six languages (Settings and the paywall use
// CURRENT_LANG from settings.js). The public website is English, so without
// CURRENT_LANG every string stays as written.
var ORIVEN_PLAN_I18N = {
  "Full advertising workflow": { nl: "Volledige advertentieworkflow", de: "Kompletter Werbe-Workflow", fr: "Workflow publicitaire complet", es: "Flujo publicitario completo", pt: "Fluxo de publicidade completo" },
  "In-app notifications": { nl: "Meldingen in de app", de: "In-App-Benachrichtigungen", fr: "Notifications dans l’app", es: "Notificaciones en la app", pt: "Notificações na app" },
  "Weekly AI Performance Report": { nl: "Wekelijks AI-prestatierapport", de: "Wöchentlicher KI-Leistungsbericht", fr: "Rapport de performance IA hebdomadaire", es: "Informe semanal de rendimiento con IA", pt: "Relatório semanal de desempenho com IA" },
  "All six steps: ": { nl: "Alle zes stappen: ", de: "Alle sechs Schritte: ", fr: "Les six étapes : ", es: "Los seis pasos: ", pt: "Os seis passos: " },
  "Coming soon: by email every Monday, from your connected ad accounts": { nl: "Binnenkort: elke maandag per e-mail, uit je gekoppelde advertentieaccounts", de: "Demnächst: jeden Montag per E-Mail, aus deinen verbundenen Werbekonten", fr: "Bientôt : chaque lundi par e-mail, à partir de vos comptes publicitaires connectés", es: "Próximamente: cada lunes por correo, de tus cuentas publicitarias conectadas", pt: "Em breve: todas as segundas-feiras por email, das suas contas de anúncios ligadas" },
  "By email every Monday, from your connected ad accounts": { nl: "Elke maandag per e-mail, uit je gekoppelde advertentieaccounts", de: "Jeden Montag per E-Mail, aus deinen verbundenen Werbekonten", fr: "Chaque lundi par e-mail, à partir de vos comptes publicitaires connectés", es: "Cada lunes por correo, de tus cuentas publicitarias conectadas", pt: "Todas as segundas-feiras por email, das suas contas de anúncios ligadas" },
  "Coming soon": { nl: "Binnenkort beschikbaar", de: "Demnächst verfügbar", fr: "Bientôt disponible", es: "Próximamente", pt: "Em breve" },
  "14 days": { nl: "14 dagen", de: "14 Tage", fr: "14 jours", es: "14 días", pt: "14 dias" },
  "1 month": { nl: "1 maand", de: "1 Monat", fr: "1 mois", es: "1 mes", pt: "1 mês" },
  "3 months": { nl: "3 maanden", de: "3 Monate", fr: "3 mois", es: "3 meses", pt: "3 meses" },
  "6 months": { nl: "6 maanden", de: "6 Monate", fr: "6 mois", es: "6 meses", pt: "6 meses" },
  "12 months": { nl: "12 maanden", de: "12 Monate", fr: "12 mois", es: "12 meses", pt: "12 meses" },
  "credits": { nl: "credits", de: "Credits", fr: "crédits", es: "créditos", pt: "créditos" },
  "per month": { nl: "per maand", de: "pro Monat", fr: "par mois", es: "al mes", pt: "por mês" },
  "credits a month, added monthly": { nl: "credits per maand, maandelijks toegevoegd", de: "Credits pro Monat, monatlich gutgeschrieben", fr: "crédits par mois, ajoutés chaque mois", es: "créditos al mes, añadidos cada mes", pt: "créditos por mês, adicionados mensalmente" },
  "One payment. No automatic renewal.": { nl: "Eén betaling. Geen automatische verlenging.", de: "Eine Zahlung. Keine automatische Verlängerung.", fr: "Un seul paiement. Pas de renouvellement automatique.", es: "Un solo pago. Sin renovación automática.", pt: "Um pagamento. Sem renovação automática." },
  "Lowest monthly price": { nl: "Laagste prijs per maand", de: "Niedrigster Monatspreis", fr: "Prix mensuel le plus bas", es: "Precio mensual más bajo", pt: "Preço mensal mais baixo" },
  "Choose": { nl: "Kies", de: "Wählen", fr: "Choisir", es: "Elegir", pt: "Escolher" },
  "Included in every plan": { nl: "In elk abonnement inbegrepen", de: "In jedem Plan enthalten", fr: "Inclus dans chaque formule", es: "Incluido en todos los planes", pt: "Incluído em todos os planos" },
  "Prices exclude VAT; the VAT for your location is added at checkout. Unused credits expire when your access ends.": { nl: "Prijzen exclusief btw; de btw voor jouw locatie wordt bij het afrekenen toegevoegd. Ongebruikte credits vervallen wanneer je toegang eindigt.", de: "Preise zzgl. MwSt.; die MwSt. für deinen Standort wird beim Bezahlen hinzugefügt. Ungenutzte Credits verfallen, wenn dein Zugang endet.", fr: "Prix HT ; la TVA applicable à votre pays est ajoutée lors du paiement. Les crédits non utilisés expirent à la fin de votre accès.", es: "Precios sin IVA; el IVA de tu ubicación se añade al pagar. Los créditos no usados caducan cuando termina tu acceso.", pt: "Preços sem IVA; o IVA da sua localização é adicionado no pagamento. Os créditos não usados expiram quando o seu acesso termina." },
  "Excl. VAT — the VAT for your location is added at checkout.": { nl: "Excl. btw — de btw voor jouw locatie wordt bij het afrekenen toegevoegd.", de: "Zzgl. MwSt. — die MwSt. für deinen Standort wird beim Bezahlen hinzugefügt.", fr: "HT — la TVA de votre pays est ajoutée lors du paiement.", es: "Sin IVA — el IVA de tu ubicación se añade al pagar.", pt: "Sem IVA — o IVA da sua localização é adicionado no pagamento." },
  "Lowest monthly price ": { nl: "Laagste prijs per maand ", de: "Niedrigster Monatspreis ", fr: "Prix mensuel le plus bas ", es: "Precio mensual más bajo ", pt: "Preço mensal mais baixo " }
};
function orvPlanT(str){
  var lang = (typeof CURRENT_LANG === "string") ? CURRENT_LANG : "en";
  var row = ORIVEN_PLAN_I18N[str];
  return (row && row[lang]) || str;
}

// Shared card facts, so the three card styles can't drift.
function _orvEuro(n){ return "€" + (Math.round(n) === n ? String(n) : n.toFixed(2)); }
function orvPlanCardFacts(plan){
  return {
    price: _orvEuro(plan.price),
    period: orvPlanT(plan.periodLabel),
    perMonth: plan.perMonth && plan.months > 1 ? _orvEuro(plan.perMonth) + " " + orvPlanT("per month") : "",
    credits: orvFormatCredits(plan.credits) + " " + orvPlanT("credits"),
    instalmentNote: plan.instalments > 1 ? orvFormatCredits(plan.creditsPerInstalment) + " " + orvPlanT("credits a month, added monthly") : "",
    renewal: orvPlanT("One payment. No automatic renewal."),
    badge: plan.badge ? orvPlanT(plan.badge) : ""
  };
}
function orvIncludedFeaturesHtml(liClass){
  return ORIVEN_INCLUDED_FEATURES.map(function(f){
    var note = orvPlanFeatureNote(f);
    return '<li' + (liClass ? ' class="' + liClass + '"' : '') + '>' + orvPlanT(f) + (note ? '<span class="ov-pc-feat-cost">' + note + '</span>' : '') + '</li>';
  }).join('');
}

// ── Render: public pricing page (.ov-pc cards) ─────────────────────
// Every card has the same rhythm: plan name, price, access duration, credit
// allowance, the VAT line, the three benefits, the button. The facts come
// from ORIVEN_PERIOD_PLANS; the benefits are the same for every plan (one
// product), so they are three short statements, never a list of sections.
var ORIVEN_CARD_BENEFITS = ["Every feature, in all six sections", "Your personal AI assistant", "Credits for research, ads, chat and automations"];
var ORIVEN_VAT_LINE = "Excl. VAT — the VAT for your location is added at checkout.";
// Who each period is for (shown on the public cards). Same product in every
// plan: only the period, the price and the credits differ.
var ORIVEN_PLAN_FOR = {
  flex:       "Try OrivenAI on a first campaign",
  monthly:    "Work month by month; buy again when you need it",
  quarterly:  "Plan, launch and improve over a quarter",
  semiannual: "A longer-term advertising strategy",
  annual:     "A year of advertising in one workspace"
};
// Saving against buying Monthly for the same number of months (whole euros).
// Only periods of more than one month; never shown when it isn't a saving.
function orvPlanSaving(plan){
  var monthly = ORIVEN_PERIOD_PLANS.filter(function(p){ return p.id === "monthly"; })[0];
  if(!monthly || !(plan.months > 1)) return 0;
  var s = Math.round((monthly.price * plan.months - plan.price) * 100) / 100;
  return s > 0 ? s : 0;
}
function renderLPPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.classList.add('ov-pc-five');
  containerEl.innerHTML = ORIVEN_PERIOD_PLANS.map(function(plan, i){
    var f = orvPlanCardFacts(plan);
    var hi = !!plan.badge;
    var delay = i === 0 ? '' : (i * 0.06).toFixed(2).replace(/^0/, '');
    var delayAttr = delay ? ' style="transition-delay:' + delay + 's"' : '';
    var saving = orvPlanSaving(plan);
    var badge = hi ? f.badge : (plan.id === 'flex' ? 'Introductory' : '');
    // data-eur: the EUR amount, so the pricing page's currency selector can
    // show an approximate conversion (display only; checkout stays in EUR).
    var monthLine = plan.months >= 1
      ? '<span data-eur="' + (plan.perMonth || plan.price) + '">' + _orvEuro(Math.round((plan.perMonth || plan.price) * 100) / 100) + '</span> ' + orvPlanT("per month")
      : 'For 14 days';
    var credits = f.credits + (plan.instalments > 1 ? '<span class="ov-pc-sub"> · ' + orvFormatCredits(plan.creditsPerInstalment) + ' a month</span>' : '');
    return [
      '<div class="ov-pc ov-pc--period ov-pc--ws' + (hi ? ' ov-pc-pro' : '') + '" data-observe data-plan="' + plan.id + '"' + delayAttr + '>',
        '<div class="ov-pc-head">' + '<div class="ov-pc-badge-slot">' + (badge ? '<div class="ov-pc-badge' + (hi ? '' : ' ov-pc-badge--quiet') + '">' + badge + '</div>' : '') + '</div>' + '<div class="ov-pc-tier">' + plan.name + '</div><p class="ov-pc-for">' + ORIVEN_PLAN_FOR[plan.id] + '</p></div>',
        '<div class="ov-pc-price"><span class="ov-pc-price-num" data-eur="' + plan.price + '">' + f.price + '</span><span class="ov-pc-period">' + f.period + '</span></div>',
        '<div class="ov-pc-facts">',
          '<p class="ov-pc-duration">' + monthLine + '</p>',
          '<p class="ov-pc-save">' + (saving ? 'Save <span data-eur="' + saving + '">' + _orvEuro(saving) + '</span> vs. Monthly' : '&nbsp;') + '</p>',
          '<p class="ov-pc-credits">' + credits + '</p>',
          '<p class="ov-pc-pay">One payment · no automatic renewal</p>',
          '<p class="ov-pc-vat">' + ORIVEN_VAT_LINE + '</p>',
        '</div>',
        '<ul class="ov-pc-list ov-pc-benefits">' + ORIVEN_CARD_BENEFITS.map(function(b){ return '<li>' + b + '</li>'; }).join('') + '</ul>',
        '<a href="/app?plan=' + plan.id + '" class="ov-pc-btn' + (hi ? ' ov-pc-btn-pro' : '') + '" data-plan="' + plan.id + '" onclick="orvRememberPlanChoice(\'' + plan.id + '\');if(typeof lpGetStarted===\'function\'){lpGetStarted(event)}">Choose ' + plan.name + '</a>',
      '</div>'
    ].join('');
  }).join('');
}

// ── Render: Paywall modal (pw-card) ────────────────────────────
// plansArr is accepted for older callers; the five periods are always shown.
function renderPWPricingCards(containerEl, plansArr){
  if(!containerEl) return;
  var list = (plansArr && plansArr.length && plansArr[0].credits != null && plansArr[0].periodLabel) ? plansArr : ORIVEN_PERIOD_PLANS;
  containerEl.innerHTML = list.map(function(plan){
    var f = orvPlanCardFacts(plan);
    var hi = !!plan.badge;
    var btnLabel = orvPlanT("Choose") + " " + plan.name;
    return [
      '<div class="pw-card' + (hi ? ' pw-card-featured' : '') + '" data-plan="' + plan.id + '">',
        hi ? '<div class="pw-featured-badge">' + f.badge + '</div>' : '',
        '<div class="pw-card-name">' + plan.name + '</div>',
        '<div class="pw-price-row">',
          '<span class="pw-price">' + f.price + '</span>',
          '<span class="pw-period">/ ' + f.period + '</span>',
        '</div>',
        '<div class="pw-credits-inline">' + f.credits + '</div>',
        f.perMonth ? '<div class="pw-card-desc">' + f.perMonth + '</div>' : '',
        f.instalmentNote ? '<div class="pw-card-desc">' + f.instalmentNote + '</div>' : '',
        '<button id="paywall-btn-' + plan.id + '" class="pw-btn ' + (hi ? 'pw-btn-primary' : 'pw-btn-outline') + '" onclick="selectPlan(\'' + plan.id + '\')" data-label="' + btnLabel + '">' + btnLabel + '</button>',
      '</div>'
    ].join('');
  }).join('');
}

// ── Render: Plan selection / onboarding (pl-card) ──────────────
function renderPLPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = ORIVEN_PERIOD_PLANS.map(function(plan){
    var f = orvPlanCardFacts(plan);
    var hi = !!plan.badge;
    var lines = [f.credits + ' · ' + f.period, f.instalmentNote, f.perMonth, f.renewal].filter(Boolean).map(function(t){
      return '<li class="pl-feat"><div class="pl-feat-chk">' + _PLAN_CHK_SVG + '</div><span>' + t + '</span></li>';
    }).join("");
    return [
      '<div class="pl-card' + (hi ? ' pl-popular' : '') + '" data-plan="' + plan.id + '">',
        hi ? '<div class="pl-tag">' + f.badge + '</div>' : '',
        '<div class="pl-card-name">' + plan.name + '</div>',
        '<div class="pl-price"><span class="pl-price-num">' + f.price + '</span><span class="pl-price-period">/ ' + f.period + '</span></div>',
        '<div class="pl-divider"></div>',
        '<ul class="pl-feats">' + lines + '</ul>',
        '<button class="pl-btn ' + (hi ? 'pl-btn-primary' : 'pl-btn-outline') + '" onclick="selectPlan(\'' + plan.id + '\',this)">' + orvPlanT("Choose") + ' ' + plan.name + '</button>',
      '</div>'
    ].join('');
  }).join('');
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ORIVEN_PRICING: ORIVEN_PRICING, CREDIT_COSTS: CREDIT_COSTS, ORIVEN_CREDIT_ACTIONS: ORIVEN_CREDIT_ACTIONS,
    ORIVEN_PERIOD_PLANS: ORIVEN_PERIOD_PLANS, ORIVEN_PLANS: ORIVEN_PLANS, ORIVEN_PAID_STATUSES: ORIVEN_PAID_STATUSES,
    ORIVEN_INCLUDED_FEATURES: ORIVEN_INCLUDED_FEATURES, ORIVEN_WORKFLOW_STEPS: ORIVEN_WORKFLOW_STEPS,
    ORIVEN_WEEKLY_REPORT_LIVE: ORIVEN_WEEKLY_REPORT_LIVE, orvPlanHas: orvPlanHas, orvMinPlanFor: orvMinPlanFor, orvEffectiveStatus: orvEffectiveStatus,
    orvPeriodPlan: orvPeriodPlan, orvPlanCardFacts: orvPlanCardFacts, ORIVEN_CARD_BENEFITS: ORIVEN_CARD_BENEFITS, ORIVEN_VAT_LINE: ORIVEN_VAT_LINE, orvFormatCredits: orvFormatCredits
  };
}
