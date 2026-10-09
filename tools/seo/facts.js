// ════════════════════════════════════════════════════════════════
// OrivenAI product facts for the static public pages — ONE place, so every
// page (and its structured data) describes the product the same way.
// Every value here is taken from the product code, not from marketing
// wishes. Keep in sync with:
//   js/plans.js (ORIVEN_PLANS, CREDIT_COSTS) — prices, credits, costs
//   backend services/planEntitlements.js     — Research/Autopilot from Starter
//   backend server.js (/api/publish/{google,meta,tiktok,pinterest})
//   backend server.js AUTOPILOT_* + the Autopilot UI ("At most once per day")
// When a fact changes, change it here and re-run: node tools/seo/build.js
// ════════════════════════════════════════════════════════════════

const ORIGIN = 'https://orivenai.com';

const plans = [
  { id: 'free', name: 'Free', price: 0, credits: '10 credits a day' },
  { id: 'starter', name: 'Starter', price: 9.95, credits: '1,000 credits a month' },
  { id: 'creator', name: 'Creator', price: 19.95, credits: '2,500 credits a month' },
  { id: 'professional', name: 'Professional', price: 34.95, credits: '4,000 credits a month' },
];

module.exports = {
  // The canonical one-line description, used verbatim wherever OrivenAI is defined.
  canonical: 'OrivenAI is an AI advertising platform that helps businesses research their market, create image and video ads, launch campaigns on Google Ads, Meta Ads, TikTok Ads and Pinterest Ads, and automate routine campaign decisions with rules they control.',
  tagline: 'The AI advertising platform. Research, create, launch and automate ads from one workspace.',
  freePlanLine: 'The Free plan includes Control Center, Create, Launch and Campaigns. Upgrade only when you need Research, Autopilot or more credits.',
  plans,
  costs: { imageAd: 100, videoAd: 225, autopilotRun: 25, researchRun: 25 },
  platforms: ['Google Ads', 'Meta Ads (Facebook and Instagram)', 'TikTok Ads', 'Pinterest Ads'],

  fmtDate(iso) {
    const d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  },

  organizationLd: {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': ORIGIN + '/#organization',
    name: 'OrivenAI', alternateName: ['Oriven', 'ORIVEN', 'Oriven AI'], url: ORIGIN + '/',
    logo: ORIGIN + '/assets/orivenlogo.png', email: 'contact@orivenai.com',
    description: 'OrivenAI (orivenai.com) is an AI advertising platform for researching, creating, launching and automating ad campaigns.',
  },

  // Prices from js/plans.js. No ratings, reviews or user counts: none exist.
  softwareLd: {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'OrivenAI',
    applicationCategory: 'BusinessApplication', applicationSubCategory: 'Advertising software', operatingSystem: 'Web browser',
    url: ORIGIN + '/',
    description: 'AI advertising platform for researching markets, creating image and video ads, launching campaigns on Google Ads, Meta Ads, TikTok Ads and Pinterest Ads, and automating campaign rules.',
    offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: '0', highPrice: '34.95', offerCount: 4,
      offers: plans.map((p) => ({ '@type': 'Offer', name: p.name, price: p.price.toFixed(2), priceCurrency: 'EUR', description: p.credits, url: ORIGIN + '/pricing' })) },
    publisher: { '@id': ORIGIN + '/#organization' },
  },

  // Existing (single-page-app) routes that generated pages may link to.
  sitePages: {
    '/': { name: 'OrivenAI home', description: 'The AI advertising platform: research, create, launch and automate ads.' },
    '/pricing': { name: 'Pricing', description: 'Free, Starter, Creator and Professional plans, with what each includes.' },
    '/faq': { name: 'FAQ', description: 'Answers about credits, plans and connecting ad accounts.' },
    '/autopilot': { name: 'Autopilot', description: 'Rules that pause, resume or adjust Google and Meta campaigns within limits you set.' },
    '/create': { name: 'Create', description: 'Turn a brief into platform-ready image or video ad creative and campaign structure.' },
    '/launch': { name: 'Launch', description: 'Review each draft’s readiness and publish when you choose.' },
    '/research': { name: 'Research', description: 'Investigate a market, competitors and audiences, with sources.' },
    '/campaigns': { name: 'Campaigns', description: 'Follow live performance by platform, campaign and date range.' },
    '/product': { name: 'Supported platforms', description: 'Google Ads, Meta Ads, TikTok Ads and Pinterest Ads in one workspace.' },
    '/product/google-ads': { name: 'OrivenAI for Google Ads', description: 'Search, Performance Max and Demand Gen campaigns, created and launched from OrivenAI.' },
    '/product/meta-ads': { name: 'OrivenAI for Meta Ads', description: 'Facebook and Instagram campaigns, created and launched through Meta’s API.' },
  },
};
