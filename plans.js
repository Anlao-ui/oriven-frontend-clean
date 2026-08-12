// ════════════════════════════════════════════════════════════════
// ORIVEN — Central Plan Configuration
//
// SINGLE SOURCE OF TRUTH for all plan data.
// Load this before settings.js, paywall.js, and studio.js.
// ════════════════════════════════════════════════════════════════

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
  visual:         40,  // image_generation
  image:          40,
  productshoots:  40,
  video:          120, // video_generation
  ugc:            120,
  videoads:       120,
  motiongraphics: 120
};

var ORIVEN_PLANS = {
  starter: {
    id:          "starter",
    name:        "Starter",
    price:       9.95,
    // stripeId is intentionally absent — Stripe price IDs live in server env vars only.
    // Backend reads: process.env.STRIPE_PRICE_STARTER
    credits:     500,
    limit:       500,
    teamMembers: 1,
    explore:     false,
    desc:        "For individuals getting started with AI-powered ad analytics.",
    allFeatures: [
      "500 AI Credits / Month",
      "Campaign Generation",
      "Google Ads",
      "Meta Ads",
      "TikTok Ads",
      "AI Analysis",
      "Business Brain",
      "Brand Memory",
      "Intelligence"
    ],
    features: [
      "500 AI Credits / Month",
      "Campaign Generation",
      "Google Ads",
      "Meta Ads",
      "TikTok Ads",
      "AI Analysis",
      "Business Brain",
      "Brand Memory",
      "Intelligence"
    ]
  },

  creator: {
    id:          "creator",
    name:        "Creator",
    price:       29.95,
    popular:     true,
    // Backend reads: process.env.STRIPE_PRICE_CREATOR
    credits:     3000,
    limit:       3000,
    teamMembers: 1,
    explore:     false,
    desc:        "For creators, founders, and growing brands running multi-channel ads.",
    allFeatures: [
      "Everything in Starter",
      "Autopilot",
      "3,000 AI Credits / Month"
    ],
    features: [
      "Everything in Starter",
      "Autopilot",
      "3,000 AI Credits / Month"
    ]
  },

  professional: {
    id:          "professional",
    name:        "Professional",
    price:       59.95,
    // Backend reads: process.env.STRIPE_PRICE_PROFESSIONAL
    credits:     12000,
    limit:       12000,
    teamMembers: 10,
    explore:     false,
    desc:        "For professional teams scaling ad performance across all channels.",
    allFeatures: [
      "Everything in Creator",
      "Priority Support",
      "12,000 AI Credits / Month",
      "Up to 10 Team Members"
    ],
    features: [
      "Everything in Creator",
      "Priority Support",
      "12,000 AI Credits / Month",
      "Up to 10 Team Members"
    ]
  }
};

var ORIVEN_PLAN_LIST  = ["starter","creator","professional"].map(function(k){ return ORIVEN_PLANS[k]; });
var ORIVEN_PAID_PLANS = ORIVEN_PLAN_LIST;

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
      '<div class="ov-pc' + (isPro ? ' ov-pc-pro' : '') + '" data-observe' + delayAttr + '>',
        '<div class="ov-pc-head">' + badge + '<div class="ov-pc-tier">' + plan.name + '</div></div>',
        '<div class="ov-pc-price-block"><div class="ov-pc-price"><span class="ov-pc-price-num" data-count-target="' + plan.price.toFixed(2) + '" data-count-decimals="2" data-count-prefix="€">€0.00</span><span>/mo</span></div><div class="ov-pc-credits">' + plan.credits.toLocaleString('en-US') + ' AI credits / month</div></div>',
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
  containerEl.innerHTML = ORIVEN_PAID_PLANS.map(function(plan){
    var feats = (plan.features || plan.allFeatures || []).map(function(f){
      return '<li class="pw-feat">' + f + '</li>';
    }).join("");
    return [
      '<div class="pw-card' + (plan.popular ? ' pw-card-featured' : '') + '">',
        plan.popular ? '<div class="pw-featured-badge">Most Popular</div>' : '',
        '<div class="pw-card-name"' + (plan.popular ? ' style="color:#B7FF2A"' : '') + '>' + plan.name + '</div>',
        '<div class="pw-price-row">',
          '<span class="pw-price">€' + plan.price + '</span>',
          '<span class="pw-period">/mo</span>',
        '</div>',
        plan.desc ? '<div class="pw-card-desc">' + plan.desc + '</div>' : '',
        '<div class="pw-card-divider"></div>',
        '<ul class="pw-feats-list">' + feats + '</ul>',
        '<button id="paywall-btn-' + plan.id + '" class="pw-btn ' + (plan.popular ? 'pw-btn-primary' : 'pw-btn-outline') + '" onclick="selectPlan(\'' + plan.id + '\')" data-label="Get Started">Get Started</button>',
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
