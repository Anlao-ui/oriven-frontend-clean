// ════════════════════════════════════════════════════════════════
// ORIVEN — Central Plan Configuration
//
// SINGLE SOURCE OF TRUTH for all plan data.
// Load this before settings.js, paywall.js, and studio.js.
// ════════════════════════════════════════════════════════════════

// ── Credit cost per generation type ───────────────────────────
var CREDIT_COSTS = {
  text:         1,
  copy:         1,
  campaign:     1,
  visual:       1,
  image:        1,
  ideas:        1,
  email:        2,
  poster:       2,
  infographic:  2,
  website:      3,
  web:          3,
  presentation: 4,
  deck:         4,
  video:        10,
  ugc:          10,
  videoads:         5,
  productshoots:    2,
  motiongraphics:   3
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
      "Google Ads Analytics",
      "TikTok Ads Analytics",
      "Meta Ads Analytics",
      "Basic AI Recommendations",
      "500 AI Credits / Month",
      "1 Team Member"
    ],
    features: [
      "Google Ads Analytics",
      "TikTok Ads Analytics",
      "Meta Ads Analytics",
      "Basic AI Recommendations",
      "500 AI Credits / Month",
      "1 Team Member"
    ]
  },

  creator: {
    id:          "creator",
    name:        "Creator",
    price:       29.95,
    popular:     true,
    // Backend reads: process.env.STRIPE_PRICE_CREATOR
    credits:     2500,
    limit:       2500,
    teamMembers: 3,
    explore:     false,
    desc:        "For creators, founders, and growing brands running multi-channel ads.",
    allFeatures: [
      "Google Ads Analytics",
      "TikTok Ads Analytics",
      "Meta Ads Analytics",
      "Advanced AI Recommendations",
      "Social Media Posting",
      "Content Calendar",
      "2,500 AI Credits / Month",
      "Up to 3 Team Members"
    ],
    features: [
      "Google Ads Analytics",
      "TikTok Ads Analytics",
      "Meta Ads Analytics",
      "Advanced AI Recommendations",
      "Social Media Posting",
      "Content Calendar",
      "2,500 AI Credits / Month",
      "Up to 3 Team Members"
    ]
  },

  professional: {
    id:          "professional",
    name:        "Professional",
    price:       59.95,
    // Backend reads: process.env.STRIPE_PRICE_PROFESSIONAL
    credits:     7500,
    limit:       7500,
    teamMembers: 10,
    explore:     false,
    desc:        "For professional teams scaling ad performance across all channels.",
    allFeatures: [
      "Google Ads Analytics",
      "TikTok Ads Analytics",
      "Meta Ads Analytics",
      "Advanced AI Recommendations",
      "Social Media Posting",
      "Content Calendar",
      "White-label Reports",
      "Priority Support",
      "7,500 AI Credits / Month",
      "Up to 10 Team Members"
    ],
    features: [
      "Google Ads Analytics",
      "TikTok Ads Analytics",
      "Meta Ads Analytics",
      "Advanced AI Recommendations",
      "Social Media Posting",
      "Content Calendar",
      "White-label Reports",
      "Priority Support",
      "7,500 AI Credits / Month",
      "Up to 10 Team Members"
    ]
  },

  agency: {
    id:           "agency",
    name:         "Agency",
    price:        null,       // Contact Sales — do not display price
    contactSales: true,       // renders Contact Sales card, not a Stripe checkout
    credits:      null,       // do not display
    limit:        null,
    teamMembers:  null,       // do not display
    explore:      false,
    desc:         "For agencies managing multiple brands at scale.",
    allFeatures:  [],         // do not display features yet
    features:     []
  }
};

var ORIVEN_PLAN_LIST  = ["starter","creator","professional","agency"].map(function(k){ return ORIVEN_PLANS[k]; });
var ORIVEN_PAID_PLANS = ORIVEN_PLAN_LIST;

// ── SVG check mark (shared across all card styles) ─────────────
var _PLAN_CHK_SVG = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>';

// ── Render: Landing page pricing ────────────────────────────────
function renderLPPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = ORIVEN_PAID_PLANS.map(function(plan){
    var isAgency = !!plan.contactSales;
    var cardCls  = 'lp-plan' + (plan.popular ? ' lp-plan-popular' : '') + (isAgency ? ' lp-plan-agency' : '');
    var tagHtml  = plan.popular ? '<div class="lp-plan-tag">Most Popular</div>'
                 : isAgency    ? '<div class="lp-plan-tag lp-plan-tag-agency">Contact Sales</div>'
                 : '';

    var priceHtml = isAgency
      ? '<div class="lp-plan-price"><span class="lp-plan-price-num" style="font-size:26px;letter-spacing:-.01em">Contact Sales</span></div>'
      : '<div class="lp-plan-price"><span class="lp-plan-price-num">€' + plan.price + '</span><span class="lp-plan-price-period">/month</span></div>';

    var featsHtml = isAgency ? '' : (plan.allFeatures || []).map(function(f){
      return '<li class="lp-plan-feat"><div class="lp-plan-feat-check">' + _PLAN_CHK_SVG + '</div><span>' + f + '</span></li>';
    }).join('');

    var btnHtml = isAgency
      ? '<a href="mailto:hello@oriven.ai" class="lp-plan-cta-agency">Contact Sales</a>'
      : '<button type="button" class="' + (plan.popular ? 'lp-cta-btn lp-plan-cta' : 'lp-plan-cta-outline') + '" onclick="lpStartPlan(\'' + plan.id + '\',this)">Get Started</button>';

    return [
      '<div class="' + cardCls + '">',
        tagHtml,
        '<div class="lp-plan-name">' + plan.name + '</div>',
        priceHtml,
        '<div class="lp-plan-desc">' + plan.desc + '</div>',
        isAgency ? '' : '<div class="lp-plan-divider"></div>',
        isAgency ? '' : '<ul class="lp-plan-features">' + featsHtml + '</ul>',
        btnHtml,
      '</div>'
    ].join('');
  }).join('');
}

// ── Render: Paywall modal (pw-card) ────────────────────────────
function renderPWPricingCards(containerEl){
  if(!containerEl) return;
  // Paywall only shows purchasable plans (excludes Contact Sales)
  var plansToShow = ORIVEN_PAID_PLANS.filter(function(p){ return !p.contactSales; });
  containerEl.innerHTML = plansToShow.map(function(plan){
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
    var isAgency = !!plan.contactSales;
    var feats = isAgency ? '' : (plan.features || plan.allFeatures || []).map(function(f){
      return '<li class="pl-feat"><div class="pl-feat-chk">' + _PLAN_CHK_SVG + '</div><span>' + f + '</span></li>';
    }).join("");

    var priceHtml = isAgency
      ? '<div class="pl-price"><span class="pl-price-num" style="font-size:22px">Contact Sales</span></div>'
      : '<div class="pl-price"><span class="pl-price-num">€' + plan.price + '</span><span class="pl-price-period">/month</span></div>';

    var btnHtml = isAgency
      ? '<a href="mailto:hello@oriven.ai" class="pl-btn pl-btn-outline">Contact Sales</a>'
      : '<button class="pl-btn ' + (plan.popular ? 'pl-btn-primary' : 'pl-btn-outline') + '" onclick="selectPlan(\'' + plan.id + '\',this)">Choose ' + plan.name + '</button>';

    return [
      '<div class="pl-card' + (plan.popular ? ' pl-popular' : '') + '">',
        plan.popular ? '<div class="pl-tag">Most Popular</div>' : '',
        '<div class="pl-card-name">' + plan.name + '</div>',
        priceHtml,
        '<div class="pl-divider"></div>',
        isAgency ? '' : '<ul class="pl-feats">' + feats + '</ul>',
        btnHtml,
      '</div>'
    ].join('');
  }).join('');
}
