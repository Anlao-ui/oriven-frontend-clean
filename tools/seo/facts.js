// ════════════════════════════════════════════════════════════════
// OrivenAI product facts for the static public pages — ONE place, so every
// page (and its structured data) describes the product the same way.
// Every value here is taken from the product code, not from marketing
// wishes. Keep in sync with:
//   js/plans.js (ORIVEN_PRICING, CREDIT_COSTS) — prices, credits, costs (read below, never retyped)
//   backend services/pricing.js + planEntitlements.js — one product, the same features in every plan
//   backend server.js (/api/publish/{google,meta,tiktok,pinterest})
//   backend services/automations/* (engine, limits, platforms) + js/automations.js
// When a fact changes, change it here and re-run: node tools/seo/build.js
// ════════════════════════════════════════════════════════════════

const ORIGIN = 'https://orivenai.com';
const P = require('../../js/plans.js');

// The five access periods, with their facts written out for static pages.
const plans = P.ORIVEN_PERIOD_PLANS.map((p) => ({
  id: p.id, name: p.name, price: p.price, period: p.periodLabel, months: p.months, days: p.days,
  perMonth: p.months > 1 ? p.perMonth : null, instalments: p.instalments, creditsPerInstalment: p.creditsPerInstalment,
  creditCount: p.credits, credits: p.credits.toLocaleString('en-US') + ' credits',
}));
const euro = (n) => '€' + (Number.isInteger(n) ? String(n) : n.toFixed(2));

module.exports = {
  // The canonical one-line description, used verbatim wherever OrivenAI is defined.
  canonical: 'OrivenAI is an AI advertising platform that helps businesses research their market, create image and video ads, launch campaigns on Google Ads, Meta Ads, TikTok Ads and Pinterest Ads, and automate routine campaign decisions with rules they control.',
  tagline: 'The AI advertising platform. Research, create, launch and automate ads from one workspace.',
  planLine: 'Every plan includes the full product: Research, Create, Launch, Campaigns, Automations and Oriven Chat. Plans run from ' + euro(plans[0].price) + ' for ' + plans[0].period + ' to ' + euro(plans[plans.length - 1].price) + ' for a year, paid once, with no automatic renewal.',
  plans,
  euro,
  fromPrice: euro(plans[0].price),
  // The Weekly AI Performance Report is labelled "coming soon" until weekly
  // delivery is live in production (mirrors js/plans.js ORIVEN_WEEKLY_REPORT_LIVE).
  weeklyReportLive: false,
  // automationCreate: charged once per new automation; its checks and changes are free (pricing FEATURE_COSTS.automation).
  costs: { imageAd: P.CREDIT_COSTS.imageAdComplete, videoAd: P.CREDIT_COSTS.videoAdComplete, campaignDraft: P.CREDIT_COSTS.campaign, image: P.CREDIT_COSTS.imageAd, video: P.CREDIT_COSTS.videoAd, video10s: P.CREDIT_COSTS.videoAd10s, automationCreate: P.CREDIT_COSTS.automation, researchRun: P.CREDIT_COSTS.research, chatMessage: P.CREDIT_COSTS.chat, chatStep: P.CREDIT_COSTS.chatStep, websiteRefresh: P.CREDIT_COSTS.business, analysis: P.CREDIT_COSTS.intelligence },
  platforms: ['Google Ads', 'Meta Ads (Facebook and Instagram)', 'TikTok Ads', 'Pinterest Ads'],

  fmtDate(iso) {
    const d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  },

  organizationLd: {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': ORIGIN + '/#organization',
    name: 'OrivenAI', alternateName: ['Oriven', 'ORIVEN', 'Oriven AI'], url: ORIGIN + '/',
    logo: ORIGIN + '/assets/orivenlogo-192.png', email: 'contact@orivenai.com',
    description: 'OrivenAI (orivenai.com) is an AI advertising platform for researching, creating, launching and automating ad campaigns.',
  },

  // Prices from js/plans.js. No ratings, reviews or user counts: none exist.
  softwareLd: {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'OrivenAI',
    applicationCategory: 'BusinessApplication', applicationSubCategory: 'Advertising software', operatingSystem: 'Web browser',
    url: ORIGIN + '/',
    description: 'AI advertising platform for researching markets, creating image and video ads, launching campaigns on Google Ads, Meta Ads, TikTok Ads and Pinterest Ads, and automating campaign rules.',
    offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: plans[0].price.toFixed(2), highPrice: plans[plans.length - 1].price.toFixed(2), offerCount: plans.length,
      offers: plans.map((p) => ({ '@type': 'Offer', name: 'OrivenAI ' + p.name, price: p.price.toFixed(2), priceCurrency: 'EUR', description: p.period + ' of access, ' + p.credits + ', one payment (VAT included)', url: ORIGIN + '/pricing' })) },
    publisher: { '@id': ORIGIN + '/#organization' },
  },

  // Existing (single-page-app) routes that generated pages may link to.
  sitePages: {
    '/': { name: 'OrivenAI home', description: 'The AI advertising platform: research, create, launch and automate ads.' },
    '/pricing': { name: 'Pricing', description: 'Five plans from 14 days to a year: the same product, paid once, no automatic renewal.' },
    '/faq': { name: 'FAQ', description: 'Answers about credits, plans and connecting ad accounts.' },
    '/blog': { name: 'Blog', description: 'Product updates and the story behind OrivenAI.' },
    '/autopilot': { name: 'Automations', description: 'Schedules and rules that switch campaigns on or off, pause, resume or adjust budgets within limits you set.' },
    '/create': { name: 'Create', description: 'Turn a brief into platform-ready image or video ad creative and campaign structure.' },
    '/launch': { name: 'Launch', description: 'Review each draft’s readiness and publish when you choose.' },
    '/research': { name: 'Research', description: 'Investigate a market, competitors and audiences, with sources.' },
    '/campaigns': { name: 'Campaigns', description: 'Follow live performance by platform, campaign and date range.' },
    '/solutions': { name: 'Solutions', description: 'Five reasons to use OrivenAI, each with its own page.' },
    '/product': { name: 'Supported platforms', description: 'Google Ads, Meta Ads, TikTok Ads and Pinterest Ads in one workspace.' },
    '/product/google-ads': { name: 'OrivenAI for Google Ads', description: 'Search, Performance Max and Demand Gen campaigns, created and launched from OrivenAI.' },
    '/product/meta-ads': { name: 'OrivenAI for Meta Ads', description: 'Facebook and Instagram campaigns, created and launched through Meta’s API.' },
    '/product/tiktok-ads': { name: 'OrivenAI for TikTok Ads', description: 'Vertical video ads prepared in OrivenAI and created on TikTok paused, ready for review.' },
    '/product/pinterest-ads': { name: 'OrivenAI for Pinterest Ads', description: 'Pins, campaigns and country targeting prepared in OrivenAI and created on Pinterest paused.' },
    '/business': { name: 'Control Center', description: 'Your dashboard, marketing plan and business context in one place.' },
  },
};
