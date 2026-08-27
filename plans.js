// ════════════════════════════════════════════════════════════════
// ORIVEN — Central Plan Configuration
//
// SINGLE SOURCE OF TRUTH for all plan data.
// Load this before settings.js, paywall.js, and studio.js.
// ════════════════════════════════════════════════════════════════

// ── Canonical number formatter — the ONE place credit/plan quantities
// get their thousands separator. Dutch-style dot separator (12000 ->
// "12.000"), never a comma and never raw digits, applied consistently
// everywhere a credit/plan number reaches the UI (Subscription, paywall,
// Settings usage rows) instead of some call sites using .toLocaleString()
// and others concatenating raw numbers. This is presentation only -- it
// never touches the underlying numeric value used for math/comparisons.
function orvFormatCredits(n){
  if(typeof n !== "number" || isNaN(n)) return String(n);
  return n.toLocaleString("nl-NL");
}

// ── Credit cost per generation type ───────────────────────────
// Values mirror the backend's authoritative FEATURE_COSTS
// (server/services/creditManager.js) — the server is the real source of
// truth and enforces these amounts regardless of what the client sends;
// this copy exists only so the client can show an accurate pre-flight
// credit check before firing the request. Keep the two in sync.
var CREDIT_COSTS = {
  ideas:          1,   // ai_chat tier — lightweight brainstorm text
  text:           10,  // campaign_improvement tier — ad copy / text generation
  copy:           10,
  email:          10,
  poster:         10,
  infographic:    10,
  presentation:   10,
  deck:           10,
  campaign:       25,  // campaign_generation
  website:        25,  // closest bucket to campaign_generation for full-page generation
  web:            25,
  visual:         75,  // image_generation ("Image Ad")
  image:          75,
  productshoots:  75,
  ads:            75,  // /api/generate-ad ("Ad Creative") — the literal Image Ad generator
  video:          200, // video_generation ("Video Ad")
  ugc:            200,
  videoads:       200,
  motiongraphics: 200,

  // ── Canonical spec-named keys — the five standard costs surfaced
  // directly in the product (Image Ad / Video Ad / Intelligence /
  // Autopilot / AI Chat cost labels, paywalls, Settings). Additive: the
  // legacy keys above stay in place for existing call sites (runBuilder's
  // per-format gateUsage), these are what new UI should read from.
  imageAd:      75,  // == image_generation
  videoAd:      200, // == video_generation
  intelligence: 25,  // == ai_analysis
  autopilot:    25,
  chat:         5    // == ai_chat
};

// Plan comparison focuses on the three things that actually differ between
// plans economically: AI Credits, Intelligence, Autopilot. Campaign/image/
// video generation, platform connections (Google/Meta/TikTok), Business
// Brain, and Brand Memory are part of the product itself (available on
// every plan) and governed by the credit economy, not plan-gated — so they
// are intentionally not listed as comparison rows anymore.
//
// intelligence: display label -- Intelligence is metered per-operation via
// the shared credit pool (creditManager.FEATURE_COSTS.ai_analysis, 25cr/
// analysis, server-enforced) AND capped by a real, separate, server-
// enforced monthly analysis limit (creditManager.PLAN_INTELLIGENCE_LIMITS,
// checked in server.js POST /api/meta/analyze and /api/ads/analyze before
// the AI call runs -- a client cannot bypass it by editing frontend JS).
// "Unlimited" on Professional means no *separate* cap on top of the credit
// pool, not that analyses stop consuming credits.
//
// autopilotLimit: null = not included at all (Starter). A number = real,
// server-enforced monthly execution cap (creditManager.PLAN_AUTOPILOT_LIMITS,
// checked in server.js _evaluateAutomationRules). Infinity = Professional's
// no-separate-cap tier (still subject to the underlying credit economy
// wherever a route already charges credits).
var ORIVEN_PLANS = {
  free: {
    id:          "free",
    name:        "Free",
    price:       0,
    credits:     20,
    limit:       20,
    teamMembers: 1,
    explore:     false,
    desc:        "Start free. Upgrade when you need more.",
    intelligence:   "1 analysis / day",
    autopilotLimit: null,
    // Real, existing capabilities only -- ad generation (via the daily
    // onboarding-generation allowance), Intelligence at 1/day, and the 20
    // AI Credits/day balance for smaller actions (chat, copy rewrites,
    // audience/competitor analysis) between generations.
    allFeatures: [
      "Create ads",
      "1 Intelligence use / day",
      "Experience the core Oriven workflow"
    ],
    features: [
      "Create ads",
      "1 Intelligence use / day",
      "Experience the core Oriven workflow"
    ],
    // Shown as muted/crossed-out items alongside the positive feature list
    // in the paywall (renderPWPricingCards only) -- naming real, existing
    // paid-plan capabilities Free doesn't include, not inventing new ones.
    excludedFeatures: [
      "Autopilot",
      "Higher usage limits",
      "Premium features"
    ]
  },

  starter: {
    id:          "starter",
    name:        "Starter",
    price:       9.95,
    // stripeId is intentionally absent — Stripe price IDs live in server env vars only.
    // Backend reads: process.env.STRIPE_PRICE_STARTER
    credits:     1000,
    limit:       1000,
    teamMembers: 1,
    explore:     false,
    desc:        "For individuals getting started with AI-powered ad analytics.",
    intelligence:   "40 analyses / month",
    autopilotLimit: null,
    allFeatures: [
      "1.000 AI Credits / Month",
      "Intelligence: 40 analyses / month",
      "Autopilot: not included"
    ],
    features: [
      "1.000 AI Credits / Month",
      "Intelligence: 40 analyses / month",
      "Autopilot: not included"
    ]
  },

  creator: {
    id:          "creator",
    name:        "Creator",
    price:       19.95,
    popular:     true,
    // Backend reads: process.env.STRIPE_PRICE_CREATOR
    credits:     2500,
    limit:       2500,
    teamMembers: 1,
    explore:     false,
    desc:        "For creators, founders, and growing brands running multi-channel ads.",
    intelligence:   "100 analyses / month",
    autopilotLimit: 10,
    allFeatures: [
      "2.500 AI Credits / Month",
      "Intelligence: 100 analyses / month",
      "Autopilot: 10 executions / month"
    ],
    features: [
      "2.500 AI Credits / Month",
      "Intelligence: 100 analyses / month",
      "Autopilot: 10 executions / month"
    ]
  },

  professional: {
    id:          "professional",
    name:        "Professional",
    price:       34.95,
    // Backend reads: process.env.STRIPE_PRICE_PROFESSIONAL
    credits:     4000,
    limit:       4000,
    teamMembers: 10,
    explore:     false,
    desc:        "For professional teams scaling ad performance across all channels.",
    intelligence:   "Unlimited",
    autopilotLimit: Infinity,
    allFeatures: [
      "4.000 AI Credits / Month",
      "Intelligence: Unlimited",
      "Autopilot: Unlimited",
      "Team — invite members & collaborate",
      "Priority Support",
      "Up to 10 Team Members"
    ],
    features: [
      "4.000 AI Credits / Month",
      "Intelligence: Unlimited",
      "Autopilot: Unlimited",
      "Team — invite members & collaborate",
      "Priority Support",
      "Up to 10 Team Members"
    ]
  }
};

var ORIVEN_PLAN_LIST  = ["starter","creator","professional"].map(function(k){ return ORIVEN_PLANS[k]; });
var ORIVEN_PAID_PLANS = ORIVEN_PLAN_LIST;

// Free plus the three paid plans, Free first -- used ONLY by the in-app
// paywall (renderPWPricingCards). The public landing page's pricing section
// (renderLPPricingCards, index.html) keeps reading ORIVEN_PAID_PLANS
// unchanged, so it stays exactly as it was before the Free plan existed.
var ORIVEN_PAYWALL_PLANS = ["free","starter","creator","professional"].map(function(k){ return ORIVEN_PLANS[k]; });

// ── SVG check mark (shared across all card styles) ─────────────
var _PLAN_CHK_SVG = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>';

// ── Render: Landing page pricing ────────────────────────────────
// Outputs the .ov-pc* card markup used by the live landing page's Pricing
// section (index.html #pricing) — the .ov-pc* classes are what's actually
// styled/animated there today; ORIVEN_PLAN_LIST stays the single data source.
function renderLPPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = ORIVEN_PAID_PLANS.map(function(plan, i){
    var isPro   = !!plan.popular;
    var delay   = i === 0 ? '' : (i * 0.08).toFixed(2).replace(/^0/, '');
    var delayAttr = delay ? ' style="transition-delay:' + delay + 's"' : '';
    var badge   = isPro ? '<div class="ov-pc-badge">Most Popular</div>' : '';
    var feats   = (plan.allFeatures || plan.features || []).map(function(f){
      return '<li>' + f + '</li>';
    }).join('');

    return [
      // No data-observe here (Final Polish) -- .ov-pc is also driven by a
      // dedicated GSAP ScrollTrigger (index.html, "09 PRICING") which sets
      // inline opacity/transform that always wins over the generic
      // data-observe/.ov-vis CSS-class system, so the two were fighting
      // over the same element for no benefit. GSAP alone now re-triggers
      // correctly in both scroll directions (toggleActions, not once:true).
      '<div class="ov-pc' + (isPro ? ' ov-pc-pro' : '') + '"' + delayAttr + '>',
        '<div class="ov-pc-head">' + badge + '<div class="ov-pc-tier">' + plan.name + '</div></div>',
        '<div class="ov-pc-price-block"><div class="ov-pc-price"><span class="ov-pc-price-num" data-count-target="' + plan.price.toFixed(2) + '" data-count-decimals="2" data-count-prefix="€">€0.00</span><span>/mo</span></div><div class="ov-pc-credits">' + orvFormatCredits(plan.credits) + ' AI credits / month</div></div>',
        '<div class="ov-pc-desc">' + plan.desc + '</div>',
        '<ul class="ov-pc-list">' + feats + '</ul>',
        '<a href="#" class="ov-pc-btn' + (isPro ? ' ov-pc-btn-pro' : '') + '" onclick="lpGetStarted(event)">Get Started</a>',
      '</div>'
    ].join('');
  }).join('');
}

// ── Render: Paywall modal (pw-card) ────────────────────────────
function renderPWPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = ORIVEN_PAYWALL_PLANS.map(function(plan){
    var isFree = plan.id === "free";
    var feats = (plan.features || plan.allFeatures || []).map(function(f){
      return '<li class="pw-feat">' + f + '</li>';
    }).join("");
    var excludedFeats = (plan.excludedFeatures || []).map(function(f){
      return '<li class="pw-feat pw-feat-excluded">' + f + '</li>';
    }).join("");
    var btnLabel = isFree ? "Continue Free" : "Get Started";
    return [
      '<div class="pw-card' + (plan.popular ? ' pw-card-featured' : '') + (isFree ? ' pw-card-free' : '') + '">',
        plan.popular ? '<div class="pw-featured-badge">Most Popular</div>' : '',
        '<div class="pw-card-name"' + (plan.popular ? ' style="color:#B7FF2A"' : '') + '>' + plan.name + '</div>',
        '<div class="pw-price-row">',
          '<span class="pw-price">€' + plan.price + '</span>',
          '<span class="pw-period">/mo</span>',
        '</div>',
        plan.desc ? '<div class="pw-card-desc">' + plan.desc + '</div>' : '',
        '<div class="pw-card-divider"></div>',
        '<ul class="pw-feats-list">' + feats + excludedFeats + '</ul>',
        '<button id="paywall-btn-' + plan.id + '" class="pw-btn ' + (plan.popular ? 'pw-btn-primary' : 'pw-btn-outline') + '" onclick="selectPlan(\'' + plan.id + '\')" data-label="' + btnLabel + '">' + btnLabel + '</button>',
      '</div>'
    ].join('');
  }).join('');
}

// ── Render: Plan selection / onboarding (pl-card) ──────────────
function renderPLPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = ORIVEN_PAID_PLANS.map(function(plan){
    var feats = (plan.features || plan.allFeatures || []).map(function(f){
      return '<li class="pl-feat"><div class="pl-feat-chk">' + _PLAN_CHK_SVG + '</div><span>' + f + '</span></li>';
    }).join("");
    var priceHtml = '<div class="pl-price"><span class="pl-price-num">€' + plan.price + '</span><span class="pl-price-period">/month</span></div>';
    var btnHtml = '<button class="pl-btn ' + (plan.popular ? 'pl-btn-primary' : 'pl-btn-outline') + '" onclick="selectPlan(\'' + plan.id + '\',this)">Choose ' + plan.name + '</button>';

    return [
      '<div class="pl-card' + (plan.popular ? ' pl-popular' : '') + '">',
        plan.popular ? '<div class="pl-tag">Most Popular</div>' : '',
        '<div class="pl-card-name">' + plan.name + '</div>',
        priceHtml,
        '<div class="pl-divider"></div>',
        '<ul class="pl-feats">' + feats + '</ul>',
        btnHtml,
      '</div>'
    ].join('');
  }).join('');
}
