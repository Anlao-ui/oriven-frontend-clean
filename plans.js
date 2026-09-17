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
  chat:         5,   // == ai_chat
  research:     25,  // == ai_analysis (Research shares the same server-side
                      // rate as Campaign Insights — confirmed against
                      // server.js POST /api/research/query, 2026-08 audit)
  business:     30,  // == website_analysis (the one AI-metered Business
                      // action — server.js POST /api/business/website/refresh)

  // ── Combined, customer-facing totals (Marketing/Pricing Redesign) —
  // NOT new server charges. A complete image ad, start to finish, is two
  // real steps in the product (generate concept/copy, campaign_generation
  // 25cr, then render the actual image, image_generation 75cr) that
  // together cost 100cr; a complete video ad is the same concept step
  // (25cr) plus video_generation (200cr) = 225cr. Verified exactly against
  // server.js (2026-08 audit) — these are what pricing copy shows as "1
  // image ad"/"1 video ad" so the customer sees one clear number instead
  // of two internal line items; the backend keeps charging the two real
  // steps separately, unchanged.
  imageAdComplete: 100,
  videoAdComplete: 225
};

// ── Canonical, user-facing credit action list (Pricing/Credit Consistency
// pass) — the ONE source every surface (Settings AI Credit Usage, paywall,
// landing pricing "Credits" explainer, onboarding) renders its "what costs
// credits" list from, so this can never drift into three hand-typed copies.
// Deliberately only the six REAL, user-triggered billable actions — no
// internal-only buckets (campaign_generation alone, competitor_analysis,
// brand_voice, etc. exist server-side but are never a standalone thing a
// user consciously "buys" — they're folded into Image Ad/Video Ad or not
// user-facing at all) and no 0-cost actions (Launch/Campaigns are called
// out as free in prose instead, not padded in here as "0 credits" rows).
// Where a live creditStatus.featureCosts is available (Settings, which
// reads real-time server data), prefer that over these static numbers —
// this array exists for surfaces with no authenticated credit-status call
// to make (paywall entitlement copy, the public landing page).
var ORIVEN_CREDIT_ACTIONS = [
  { key: "imageAd",     label: "Image Ad",             cost: CREDIT_COSTS.imageAdComplete },
  { key: "videoAd",     label: "Video Ad",             cost: CREDIT_COSTS.videoAdComplete },
  { key: "research",    label: "Research",             cost: CREDIT_COSTS.research },
  { key: "chat",        label: "ORIVEN Chat",          cost: CREDIT_COSTS.chat },
  { key: "business",    label: "Website Intelligence", cost: CREDIT_COSTS.business },
  { key: "autopilot",   label: "Autopilot Execution",  cost: CREDIT_COSTS.autopilot }
];

// ── Homepage + Pricing Polish Pass — shared feature-comparison categories.
// ALL THREE landing-page pricing cards render this exact same ordered list
// (spec: "Iedere kaart toont dezelfde categorieën... Geen 'Everything in
// Starter' / 'Everything in Creator'") so a viewer can compare plans
// row-by-row without re-reading each card's own prose. Each plan below
// carries a `featureFlags` map keyed by these categories' `key`.
// Final Marketing Website Polish pass — order reverted to Business
// directly above Research (spec: "IMPORTANT: Business must be ABOVE
// Research" — the previous pass had flipped these two, this pass flips
// them back). Order is the single thing that makes the three pricing
// cards row-by-row comparable, so it's centralized here rather than
// hand-typed per card.
// Final Pricing Cleanup pass — "Campaign management"/"Campaign performance
// insights" renamed to Launch/Campaigns (ORIVEN's own real product names,
// same featureFlags keys underneath, no entitlement change); ORIVEN Chat
// added as its own row (was previously not represented in this comparison
// at all). costKey/costUnit are optional: when present, the render
// functions below look up CREDIT_COSTS[costKey] live and append "N
// credits / costUnit" as a small secondary line under the label — never a
// second hardcoded number, so this can never drift from the canonical
// registry (plans.js CREDIT_COSTS, itself mirroring creditManager.js).
var ORIVEN_FEATURE_CATEGORIES = [
  { key: "imageAds",         label: "Create Image Ads",  costKey: "imageAdComplete", costUnit: "ad" },
  { key: "videoAds",         label: "Create Video Ads",  costKey: "videoAdComplete", costUnit: "ad" },
  { key: "chat",             label: "ORIVEN Chat",       costKey: "chat",            costUnit: "message" },
  { key: "research",         label: "Research",          costKey: "research",        costUnit: "investigation" },
  { key: "campaignMgmt",     label: "Launch" },
  { key: "performance",      label: "Campaigns" },
  { key: "creativeMgmt",     label: "Creative management" },
  { key: "business",         label: "Business" },
  { key: "autopilot",        label: "Autopilot",         costKey: "autopilot",       costUnit: "execution" },
  { key: "prioritySupport",  label: "Priority Support" }
];

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
  // Free is NOT a public pricing tier -- it's an in-app exploration/trial
  // state for a new user before they commit to a paid subscription (product
  // decision, "Free plan positioning" change). It stays in this single plan
  // table (internal plan system still recognizes free/starter/creator/
  // professional) but is deliberately excluded from ORIVEN_PAID_PLANS,
  // which the public landing page renders from -- see renderLPPricingCards
  // below. It still renders normally wherever the AUTHENTICATED product
  // shows current-plan state (Settings/Subscription, the paywall) whenever
  // the signed-in user's actual plan genuinely is 'free'.
  free: {
    id:          "free",
    name:        "Free",
    price:       0,
    credits:     10,
    limit:       10,
    // Every other plan's `credits` is a MONTHLY allowance; Free's resets
    // every 24h (creditManager.PLAN_ALLOWANCES.free / ensure_free_daily_cycle,
    // server-side) -- this flag is what lets every render function/Settings
    // panel show "/day" instead of "/month" for Free without a second,
    // duplicated plan table. cycleLabel is the exact unit word used in
    // credit-quantity strings ("10 credits / day").
    creditsCycle: "day",
    cycleLabel:   "day",
    teamMembers: 1,
    explore:     false,
    desc:        "Explore Oriven before you commit.",
    intelligence:   "1 use / month",
    autopilotLimit: null,
    // Pricing/Credit Consistency pass — added so Free can render through
    // the same ORIVEN_FEATURE_CATEGORIES matrix other plans use where that
    // makes sense (Settings' explicit Research row already reads this).
    // imageAds/videoAds/creativeMgmt are honestly false: re-tracing the
    // real credit math (see the allFeatures comment below) confirmed Free
    // cannot actually afford to render an image (75cr) or video (200cr) ad
    // from its 10-credit/day, non-accumulating balance, and most other
    // creative-management routes (/api/creative/*) are paid-only
    // (requireSubIfAuthed). campaignMgmt/performance/business are
    // genuinely true — Campaigns listing/metrics and Business profile/
    // products/audiences/competitors CRUD are auth-only, no plan gate
    // (confirmed directly in server.js).
    // chat:false -- Final Pricing Cleanup pass, verified (not assumed)
    // against the real POST /api/ai/chat route: it uses requireSubIfAuthed,
    // which has no 'free' exception, so an authenticated Free user gets a
    // real 403 SUBSCRIPTION_REQUIRED. This card's ✕ therefore matches
    // actual backend behavior, not just the desired presentation.
    featureFlags: {
      imageAds: false, videoAds: false, chat: false, campaignMgmt: true, performance: true,
      creativeMgmt: false, business: true, research: false, autopilot: false,
      prioritySupport: false
    },
    // Final Pricing Cleanup pass — Free's card content rewritten to concise
    // product-name bullets, matching the rest of this redesign. Two prior
    // lines removed here (not just re-worded):
    //   "10 credits / day" -- moved OUT of this list; it's now rendered
    //   once, near the price/header, the same treatment every other plan
    //   gets (see renderLPPricingCards/renderPWPricingCards below) instead
    //   of being buried as a feature bullet.
    //   "1 Intelligence use / month" -- removed per explicit product
    //   decision: this is a real, server-enforced allowance
    //   (PLAN_INTELLIGENCE_LIMITS.free=1, creditManager.js) but it's a
    //   generic internal-sounding term, not one of ORIVEN's six products,
    //   and easy to misread as implying some Research access (it doesn't
    //   -- Research is a completely separate, fully-blocked gate). The
    //   counter/backend behavior is untouched; only the marketing line is
    //   gone.
    // Launch/Campaigns/Business are real, genuinely reachable for Free
    // (confirmed in the prior pricing-consistency pass: their listing/CRUD
    // routes carry no plan gate at all in server.js) -- named explicitly
    // here instead of the old vaguer "Publish your ads" line.
    allFeatures: [
      "Launch",
      "Campaigns",
      "Business"
    ],
    features: [
      "Launch",
      "Campaigns",
      "Business"
    ],
    // Shown as muted/crossed-out items alongside the positive feature list
    // (paywall/onboarding via renderPWPricingCards, and Free's own landing
    // card via renderLPPricingCards) -- naming real, existing paid-plan
    // capabilities Free doesn't include, not inventing new ones. Every one
    // of these four was individually re-verified against the real backend
    // gate this pass (not assumed): Create Image/Video Ads -- genuinely
    // unaffordable from a 10cr/day, non-resetting-to-more balance (see the
    // featureFlags comment above); Research -- requireCreatorPlus, real
    // 403 for Free; Autopilot -- requireAutopilotAccess, real 403 for
    // Free; ORIVEN Chat -- requireSubIfAuthed on POST /api/ai/chat has no
    // 'free' exception, real 403 for Free (this specific one corrects a
    // stale claim in an earlier version of this comment, which incorrectly
    // asserted Free's daily credits could fund AI Chat -- checked directly
    // against the live route this pass and found Chat is not reachable by
    // Free at all, regardless of balance).
    // Ordered to loosely mirror ORIVEN_FEATURE_CATEGORIES' own row order
    // (Image/Video Ads, Chat, Research, ..., Autopilot) so a reader
    // scanning left-to-right across Free and a paid card sees roughly the
    // same sequence, even though Free renders this as its own short list
    // rather than the full row-by-row matrix.
    excludedFeatures: [
      "Create Ads",
      "ORIVEN Chat",
      "Research",
      "Autopilot"
    ]
  },

  // Marketing/Pricing Redesign — feature lists rewritten around the final
  // 5-pillar product model (Launch/Campaigns/Research/Autopilot/Business),
  // using real feature names and real, server-verified numbers throughout
  // (2026-08 audit — see server.js requireCreatorPlus for the matching
  // real backend gate on Research/Business, added the same pass so the
  // marketing claim below and actual enforcement never diverge). usageEx
  // is computed directly from CREDIT_COSTS.imageAdComplete/videoAdComplete
  // and this plan's own `credits`, never a hand-typed number, so it can
  // never drift out of sync with the real economics above.
  // Homepage + Pricing Polish Pass — Business repositioned as INCLUDED
  // starting at Starter (a deliberate, explicit change from the previous
  // pass, where Business required Creator+). Research remains Creator+;
  // Autopilot/Priority Support remain Professional-only (Team was removed
  // as a product surface entirely — Autopilot Redesign + Team Removal
  // sprint). See
  // server.js POST /api/business/website/refresh — its requireCreatorPlus
  // gate was removed the same pass so the real backend matches this claim
  // (auth-only again, available to any signed-in paid plan).
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
    desc:        "Create advertising without adding another workflow.",
    intelligence:   "40 insights / month",
    autopilotLimit: null,
    // chat:true -- verified against the real POST /api/ai/chat gate
    // (requireSubIfAuthed, PAID_PLANS includes 'starter').
    featureFlags: {
      imageAds: true, videoAds: true, chat: true, campaignMgmt: true, performance: true,
      creativeMgmt: true, business: true, research: false, autopilot: false,
      prioritySupport: false
    },
    // Final Pricing Cleanup pass -- trailing "1.000 credits / month" bullet
    // removed; credits are now shown once, near the price (see
    // renderPWPricingCards/renderLPPricingCards), not repeated here too.
    features: [
      "Create image & video ads",
      "ORIVEN Chat",
      "Full campaign management",
      "Campaign performance & insights",
      "Creative management",
      "Business — brand & context"
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
    desc:        "Manage campaigns from one workspace, backed by research.",
    intelligence:   "100 insights / month",
    autopilotLimit: null,
    featureFlags: {
      imageAds: true, videoAds: true, chat: true, campaignMgmt: true, performance: true,
      creativeMgmt: true, business: true, research: true, autopilot: false,
      prioritySupport: false
    },
    features: [
      "Everything in Starter",
      "Research — what's working in advertising"
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
    desc:        "Automate optimization with rules you control.",
    intelligence:   "Unlimited insights",
    autopilotLimit: Infinity,
    featureFlags: {
      imageAds: true, videoAds: true, chat: true, campaignMgmt: true, performance: true,
      creativeMgmt: true, business: true, research: true, autopilot: true,
      prioritySupport: true
    },
    features: [
      "Everything in Creator",
      "Autopilot — automation rules you control",
      "Priority support"
    ]
  }
};


// ── Usage examples — computed, never hand-typed, so they can never drift
// from the real credit economics above (Marketing/Pricing Redesign: "Do
// not invent... use sensible thresholds and existing available data").
["starter", "creator", "professional"].forEach(function(key){
  var p = ORIVEN_PLANS[key];
  p.usageExample = {
    imageAds: Math.floor(p.credits / CREDIT_COSTS.imageAdComplete),
    videoAds: Math.floor(p.credits / CREDIT_COSTS.videoAdComplete)
  };
});

// Official display order everywhere plans are shown: Free, Starter,
// Creator, Professional. Single source of truth for the in-app paywall
// (renderPWPricingCards) and Settings/Subscription (renderPlanPanel,
// settings.js) -- both read this same array so Free is represented
// consistently there instead of being hard-coded independently in each
// place. Free is a real internal plan, not a public pricing tier: it must
// only ever be shown as an authenticated user's CURRENT state (their actual
// subscription_status genuinely is 'free'), never as a selectable option
// offered to a paid user, and never on the public landing page -- callers
// choose ORIVEN_PLAN_LIST vs ORIVEN_PAID_PLANS accordingly (see paywall.js
// _renderPaywallCards and settings.js renderPlanPanel for the exact
// current-plan-aware selection logic).
var ORIVEN_PLAN_LIST  = ["free","starter","creator","professional"].map(function(k){ return ORIVEN_PLANS[k]; });

// Paid-only subset. Two uses:
// 1. Anywhere logic specifically means "does this account have an actual
//    (Stripe-billed) subscription", e.g. settings.js switchPlan() deciding
//    between the Stripe-checkout path and the schedule-plan-change path.
// 2. Every PUBLIC-facing plan display: the landing page (renderLPPricingCards)
//    always uses this list so Free never appears as a public pricing tier,
//    and it's what a paid user's Settings/paywall plan grid renders from too
//    (Free must never be offered as one of THEIR selectable options).
var ORIVEN_PAID_PLANS = ["starter","creator","professional"].map(function(k){ return ORIVEN_PLANS[k]; });

// ── SVG check mark (shared across all card styles) ─────────────
var _PLAN_CHK_SVG = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>';

// ── Render: Landing page pricing ────────────────────────────────
// Outputs the .ov-pc* card markup used by the live landing page's Pricing
// section (index.html #pricing) — the .ov-pc* classes are what's actually
// styled/animated there today.
//
// Pricing/Credit Consistency pass — Free now renders here too (this task's
// explicit brief: "Free should visually belong to the pricing system... but
// do not make it appear as feature-rich as paid plans"). Free deliberately
// does NOT render through the same row-by-row ORIVEN_FEATURE_CATEGORIES
// matrix the three paid plans use to stay directly comparable to each
// other — applying that same 9-row technical checklist to Free (which
// genuinely lacks 5 of those 9 things, see its featureFlags above) would
// read as a mostly-crossed-out, broken-looking card. Free instead renders
// its own short, honest features/excludedFeatures prose list — the exact
// same one the paywall (renderPWPricingCards below) already uses for it.
// Final Pricing Cleanup pass — a category row's cost sub-label, shared by
// every render function below so it's built the exact same way everywhere
// (never a hand-typed "100 credits / ad" string). Always reads CREDIT_COSTS
// live -- if a category has no costKey (Launch, Campaigns, Business,
// Creative management, Priority Support), returns ''.
function _ovFeatCostLabel(cat){
  if(!cat.costKey || typeof CREDIT_COSTS === 'undefined') return '';
  var n = CREDIT_COSTS[cat.costKey];
  if(typeof n !== 'number') return '';
  return orvFormatCredits(n) + ' credits / ' + cat.costUnit;
}

function renderLPPricingCards(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = ORIVEN_PLAN_LIST.map(function(plan, i){
    var isFree  = plan.id === 'free';
    var isPro   = !!plan.popular;
    var delay   = i === 0 ? '' : (i * 0.08).toFixed(2).replace(/^0/, '');
    var delayAttr = delay ? ' style="transition-delay:' + delay + 's"' : '';
    var badge   = isPro ? '<div class="ov-pc-badge">Most Popular</div>' : '';
    var feats;
    if(isFree){
      // Same honest, short prose list as the paywall's Free card — real
      // capabilities only (features), real exclusions named explicitly
      // (excludedFeatures), never the full comparison matrix.
      feats = (plan.features || []).map(function(f){ return '<li>' + f + '</li>'; }).join('')
        + (plan.excludedFeatures || []).map(function(f){ return '<li class="ov-pc-feat-excluded">' + f + '</li>'; }).join('');
    } else {
      // Homepage + Pricing Polish Pass — every PAID card renders the same
      // ORIVEN_FEATURE_CATEGORIES list, each row marked included/excluded
      // from plan.featureFlags. The ✓/✕ marks themselves are pure CSS
      // (.ov-pc-list li::before / .ov-pc-feat-excluded::before).
      //
      // Final Landing Pricing Cleanup pass — included rows now render as
      // one unbroken group, then excluded rows as a second group below
      // them (was: a single pass over ORIVEN_FEATURE_CATEGORIES in its
      // raw order, which let an excluded row like Research sit between
      // two included ones and visually interrupt the scan). The canonical
      // taxonomy order (ORIVEN_FEATURE_CATEGORIES itself, unchanged) is
      // preserved WITHIN each group — this is a stable partition, not a
      // re-sort: exactly `included = cats.filter(...); excluded =
      // cats.filter(...); render included then excluded`, per spec.
      // Costed rows (Image/Video Ads, ORIVEN Chat, Research, Autopilot)
      // keep their secondary cost line (.ov-pc-feat-cost) exactly as
      // before, in either group.
      var includedCats = ORIVEN_FEATURE_CATEGORIES.filter(function(cat){ return !!(plan.featureFlags && plan.featureFlags[cat.key]); });
      var excludedCats = ORIVEN_FEATURE_CATEGORIES.filter(function(cat){ return !(plan.featureFlags && plan.featureFlags[cat.key]); });
      var _renderCat = function(cat, included){
        var costLabel = _ovFeatCostLabel(cat);
        return '<li' + (included ? '' : ' class="ov-pc-feat-excluded"') + '>' + cat.label
          + (costLabel ? '<span class="ov-pc-feat-cost">' + costLabel + '</span>' : '')
          + '</li>';
      };
      feats = includedCats.map(function(cat){ return _renderCat(cat, true); }).join('')
        + excludedCats.map(function(cat){ return _renderCat(cat, false); }).join('');
    }
    // Final Pricing Cleanup pass — the price suffix is always "/mo": these
    // are monthly plan cards (even Free, priced at €0/mo) and mixing in
    // Free's own daily CREDIT cadence here read as if the PRICE itself
    // were daily. The credit allowance keeps its own real cadence
    // (creditsCycle, "day" for Free / "month" for the rest) in the
    // dedicated credits line below — these are two separate concepts,
    // shown separately, not conflated.
    var creditsCycle = plan.cycleLabel === 'day' ? 'day' : 'month';
    var btnLabel = isFree ? 'Start Free' : 'Get Started';

    return [
      // Marketing Website Product-Story Redesign pass — data-observe is
      // back. The GSAP ScrollTrigger reveal this was deliberately left
      // out for (index.html, "09 PRICING") was gated behind
      // document.getElementById('pricing'), an element that no longer
      // exists since Pricing moved to its own /pricing route — so that
      // GSAP block has been dead code since that move, and .ov-pc has
      // been stuck at its base opacity:0 with nothing left to reveal it
      // (a real bug: cards were invisible on page load, only exposed now
      // that /pricing needs its cards visible immediately above the
      // fold). Restoring data-observe uses the same reliable
      // IntersectionObserver/.ov-vis mechanism every other section on
      // the site already uses — no GSAP/SPA-view-swap timing fragility.
      '<div class="ov-pc' + (isPro ? ' ov-pc-pro' : '') + '" data-observe' + delayAttr + '>',
        '<div class="ov-pc-head">' + badge + '<div class="ov-pc-tier">' + plan.name + '</div></div>',
        '<div class="ov-pc-price-block"><div class="ov-pc-price"><span class="ov-pc-price-num" data-count-target="' + plan.price.toFixed(2) + '" data-count-decimals="2" data-count-prefix="€">€0.00</span><span>/mo</span></div>',
          // Final Pricing Cleanup pass — credit allowance now shown ONCE,
          // directly under the price (was previously only repeated at the
          // bottom of the card as "Includes N credits / cycle", removed).
          // .ov-pc-credits already existed in styles.css, defined for
          // exactly this spot ("Fixed-height price block: price + credits
          // line") but orphaned once an earlier pass moved this text to
          // the bottom instead -- reused here, not a new class.
          '<div class="ov-pc-credits">' + orvFormatCredits(plan.credits) + ' credits / ' + creditsCycle + '</div>',
        '</div>',
        '<div class="ov-pc-desc">' + plan.desc + '</div>',
        '<ul class="ov-pc-list">' + feats + '</ul>',
        '<a href="#" class="ov-pc-btn' + (isPro ? ' ov-pc-btn-pro' : '') + '" onclick="lpGetStarted(event)">' + btnLabel + '</a>',
      '</div>'
    ].join('');
  }).join('');
}

// ── Render: Paywall modal (pw-card) ────────────────────────────
// plansArr lets the caller (paywall.js _renderPaywallCards) decide which
// plans are actually eligible to show: ORIVEN_PLAN_LIST (includes Free)
// only when the signed-in user's real plan IS free, so Free renders as
// their current-state card, never as a selectable option offered to a
// paid user -- defaults to ORIVEN_PLAN_LIST for backward compatibility
// with any caller that doesn't pass one.
function renderPWPricingCards(containerEl, plansArr){
  if(!containerEl) return;
  var list = plansArr || ORIVEN_PLAN_LIST;
  containerEl.innerHTML = list.map(function(plan){
    var isFree = plan.id === "free";
    var feats = (plan.features || plan.allFeatures || []).map(function(f){
      return '<li class="pw-feat">' + f + '</li>';
    }).join("");
    var excludedFeats = (plan.excludedFeatures || []).map(function(f){
      return '<li class="pw-feat pw-feat-excluded">' + f + '</li>';
    }).join("");
    var btnLabel = isFree ? "Continue Free" : "Get Started";
    // Final Pricing Cleanup pass — price suffix always "/mo" (same reasoning
    // as renderLPPricingCards above); credit allowance shown once, right
    // under the price, using its own real cadence (creditsCycle).
    var creditsCycle = plan.cycleLabel === 'day' ? 'day' : 'month';
    return [
      '<div class="pw-card' + (plan.popular ? ' pw-card-featured' : '') + (isFree ? ' pw-card-free' : '') + '">',
        plan.popular ? '<div class="pw-featured-badge">Most Popular</div>' : '',
        '<div class="pw-card-name"' + (plan.popular ? ' style="color:#B7FF2A"' : '') + '>' + plan.name + '</div>',
        '<div class="pw-price-row">',
          '<span class="pw-price">€' + plan.price + '</span>',
          '<span class="pw-period">/mo</span>',
        '</div>',
        '<div class="pw-credits-inline">' + orvFormatCredits(plan.credits) + ' credits / ' + creditsCycle + '</div>',
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
