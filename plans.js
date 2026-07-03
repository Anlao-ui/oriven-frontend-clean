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
    id:       "starter",
    name:     "Starter",
    price:    5.95,
    stripeId: "price_1TgQmQ066sCcz3jQbSfa6lj4",
    credits:  25,
    limit:    25,
    explore:  false,
    desc:     "For individuals exploring Oriven.",
    brands:      1,
    competitors: 2,
    websites:    1,
    brief:       "Weekly",
    historyDays: 30,
    historyLabel:"30 days",
    // LP card: unified checklist (limits first, credits last)
    allFeatures: [
      "1 Brand",
      "2 Competitors",
      "1 Website",
      "Weekly Brand Brief",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "25 Create Credits"
    ],
    // Settings plan cards
    features: [
      "1 Brand · 1 Website · 2 Competitors",
      "Weekly Brand Brief",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "25 Create Credits / month"
    ]
  },

  creator: {
    id:       "creator",
    name:     "Creator",
    price:    14.95,
    popular:  true,
    stripeId: "price_1TgQmp066sCcz3jQoiKzj393",
    credits:  100,
    limit:    100,
    explore:  false,
    desc:     "For creators, founders and growing brands.",
    brands:      3,
    competitors: 5,
    websites:    3,
    brief:       "Daily",
    historyDays: 90,
    historyLabel:"90 days",
    allFeatures: [
      "3 Brands",
      "5 Competitors",
      "3 Websites",
      "Daily Brand Brief",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "100 Create Credits"
    ],
    features: [
      "3 Brands · 3 Websites · 5 Competitors",
      "Daily Brand Brief",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "100 Create Credits / month"
    ]
  },

  professional: {
    id:       "professional",
    name:     "Professional",
    price:    29.95,
    stripeId: "price_1TgQnT066sCcz3jQe3PUejI8",
    credits:  300,
    limit:    300,
    explore:  false,
    desc:     "For businesses actively growing.",
    brands:      10,
    competitors: 15,
    websites:    5,
    brief:       "Daily",
    historyDays: 365,
    historyLabel:"365 days",
    allFeatures: [
      "10 Brands",
      "15 Competitors",
      "5 Websites",
      "Daily Brand Brief",
      "Historical Tracking",
      "Advanced Monitoring",
      "Priority Intelligence",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "300 Create Credits"
    ],
    features: [
      "10 Brands · 5 Websites · 15 Competitors",
      "Daily Brand Brief",
      "Historical Tracking",
      "Advanced Monitoring",
      "Priority Intelligence",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "300 Create Credits / month"
    ]
  },

  agency: {
    id:       "agency",
    name:     "Agency",
    price:    59.95,
    stripeId: "", // add Stripe price ID when created
    credits:  1000,
    limit:    1000,
    explore:  false,
    desc:     "For agencies and teams managing multiple brands.",
    brands:      25,
    competitors: 50,
    websites:    20,
    brief:       "Daily",
    historyDays: 730,
    historyLabel:"730 days",
    allFeatures: [
      "25 Brands",
      "50 Competitors",
      "20 Websites",
      "Daily Brand Brief",
      "Advanced Historical Tracking",
      "Premium Monitoring",
      "Priority Intelligence",
      "Team Access",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "1000 Create Credits"
    ],
    features: [
      "25 Brands · 20 Websites · 50 Competitors",
      "Daily Brand Brief",
      "Advanced Historical Tracking",
      "Premium Monitoring",
      "Priority Intelligence",
      "Team Access",
      "Brand Core",
      "Competitor Intelligence",
      "Website Monitor",
      "Market Research",
      "Brand Health",
      "Assistant",
      "1000 Create Credits / month"
    ]
  }
};

var ORIVEN_PLAN_LIST  = ["starter","creator","professional","agency"].map(function(k){ return ORIVEN_PLANS[k]; });
var ORIVEN_PAID_PLANS = ORIVEN_PLAN_LIST;

// ── SVG check mark (shared across all card styles) ─────────────
var _PLAN_CHK_SVG = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>';

// ── Render: Landing page pricing ────────────────────────────────
// Unified checklist: limits first, credits last. No summary grid.
function renderLPPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = ORIVEN_PAID_PLANS.map(function(plan){
    var featsHtml = (plan.allFeatures || plan.features || []).map(function(f){
      return '<li class="lp-plan-feat"><div class="lp-plan-feat-check">' + _PLAN_CHK_SVG + '</div><span>' + f + '</span></li>';
    }).join('');

    var isAgency = plan.id === 'agency';
    var cardCls  = 'lp-plan' + (plan.popular ? ' lp-plan-popular' : '') + (isAgency ? ' lp-plan-agency' : '');
    var btnCls   = plan.popular ? 'lp-cta-btn lp-plan-cta' : isAgency ? 'lp-plan-cta-agency' : 'lp-plan-cta-outline';
    var tagHtml  = plan.popular ? '<div class="lp-plan-tag">Most Popular</div>'
                 : isAgency    ? '<div class="lp-plan-tag lp-plan-tag-agency">For Teams</div>'
                 : '';

    return [
      '<div class="' + cardCls + '">',
        tagHtml,
        '<div class="lp-plan-name">' + plan.name + '</div>',
        '<div class="lp-plan-price">',
          '<span class="lp-plan-price-num">€' + plan.price + '</span>',
          '<span class="lp-plan-price-period">/month</span>',
        '</div>',
        '<div class="lp-plan-desc">' + plan.desc + '</div>',
        '<div class="lp-plan-divider"></div>',
        '<ul class="lp-plan-features">' + featsHtml + '</ul>',
        '<button type="button" class="' + btnCls + '" onclick="lpStartPlan(\'' + plan.id + '\',this)">Get Started</button>',
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
    return [
      '<div class="pl-card' + (plan.popular ? ' pl-popular' : '') + '">',
        plan.popular ? '<div class="pl-tag">Most Popular</div>' : '',
        '<div class="pl-card-name">' + plan.name + '</div>',
        '<div class="pl-price">',
          '<span class="pl-price-num">€' + plan.price + '</span>',
          '<span class="pl-price-period">/month</span>',
        '</div>',
        '<div class="pl-divider"></div>',
        '<ul class="pl-feats">' + feats + '</ul>',
        '<button class="pl-btn ' + (plan.popular ? 'pl-btn-primary' : 'pl-btn-outline') + '" onclick="selectPlan(\'' + plan.id + '\',this)">Choose ' + plan.name + '</button>',
      '</div>'
    ].join('');
  }).join('');
}
