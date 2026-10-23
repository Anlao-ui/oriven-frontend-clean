// Hub — /learn/: every guide grouped by topic, links to the commercial
// pages, and the canonical "About OrivenAI" answers (what it is, who it's
// for, what it can do, free plan) in plain HTML for answer engines.
const F = require('../facts');
module.exports = {
  path: '/learn/',
  kind: 'hub',
  lastmod: '2026-10-14',
  title: 'Learn: Guides to AI Advertising, PPC Automation and Ad Platforms | OrivenAI',
  ogTitle: 'OrivenAI Learn: practical advertising guides',
  description: 'Practical guides to AI advertising: creating and testing ads, competitor research, PPC automation, and Google, Meta, TikTok and Pinterest ads.',
  crumb: 'Learn',
  teaser: 'Guides to AI advertising, PPC automation and ad platforms.',
  eyebrow: 'Learn',
  h1: 'Practical guides to AI advertising and PPC',
  lede: 'Clear explanations of how AI advertising, PPC automation and the major ad platforms work, including where automation helps and where it needs limits.',
  secondary: { href: '/', label: 'What is OrivenAI?' },
  body: `
<section class="sp-section" aria-labelledby="g1"><div class="sp-wrap">
  <div class="sp-hub-group"><h2 id="g1">AI advertising</h2><div class="sp-related">
    <a href="/learn/what-is-an-ai-advertising-platform/"><strong>What is an AI advertising platform?</strong><span>What the category covers, what AI does well in advertising, and its limits.</span></a>
    <a href="/learn/best-ai-advertising-tools-for-small-business/"><strong>The best AI advertising tools for small businesses</strong><span>Which kinds of AI ad tools exist, what they’re good at, and how to choose.</span></a>
    <a href="/learn/adcreative-ai-alternatives/"><strong>AdCreative.ai alternatives</strong><span>Six alternatives, sorted by the job you need done.</span></a>
  </div></div>
  <div class="sp-hub-group"><h2 id="g6">Creating ads</h2><div class="sp-related">
    <a href="/learn/how-to-create-facebook-and-instagram-ads-with-ai/"><strong>How to create Facebook and Instagram ads with AI</strong><span>From brief to launch: objectives, formats, placements and what to check.</span></a>
    <a href="/learn/ai-ads-for-ecommerce/"><strong>AI ads for e-commerce</strong><span>Product imagery, copy, catalog ads and seasonal campaigns with AI.</span></a>
    <a href="/learn/how-to-research-competitor-ads/"><strong>How to research competitor ads</strong><span>Free ad libraries, what to look for, and turning it into a brief.</span></a>
    <a href="/learn/how-to-test-ad-creatives/"><strong>How to test ad creatives</strong><span>What to test first, how to read results, and when creative wears out.</span></a>
    <a href="/learn/ad-character-limits/"><strong>Ad character limits (with a free counter)</strong><span>Google, Meta, TikTok and Pinterest text limits, checked against each platform’s docs.</span></a>
  </div></div>
  <div class="sp-hub-group"><h2 id="g8">TikTok and Pinterest</h2><div class="sp-related">
    <a href="/learn/tiktok-ads-for-small-business/"><strong>TikTok ads for small business</strong><span>Budgets, video specs, the TikTok Pixel and a first campaign plan.</span></a>
    <a href="/learn/pinterest-ads-for-small-business/"><strong>Pinterest ads for small business</strong><span>When Pinterest fits, what to set up, and a first campaign plan.</span></a>
  </div></div>

  <div class="sp-hub-group"><h2 id="g2">PPC automation</h2><div class="sp-related">
    <a href="/learn/what-is-ppc-automation/"><strong>What is PPC automation?</strong><span>The types of PPC automation, rule-based vs AI, and the risks to manage.</span></a>
    <a href="/learn/how-to-automate-google-ads-safely/"><strong>How to automate Google Ads safely</strong><span>A checklist for Google Ads automation that doesn’t surprise you.</span></a>
  </div></div>
  <div class="sp-hub-group"><h2 id="g3">Meta Ads</h2><div class="sp-related">
    <a href="/learn/meta-pixel-vs-conversions-api/"><strong>Meta Pixel vs Conversions API</strong><span>Browser vs server tracking, deduplication, and why to use both.</span></a>
  </div></div>
  <div class="sp-hub-group"><h2 id="g4">Cross-platform advertising</h2><div class="sp-related">
    <a href="/learn/google-ads-vs-meta-ads/"><strong>Google Ads vs Meta Ads</strong><span>Search intent vs discovery: how the two platforms differ and when to use each.</span></a>
    <a href="/learn/how-to-manage-multiple-ad-platforms/"><strong>How to manage multiple ad platforms</strong><span>Shared briefs, naming and UTMs, honest reporting and budget decisions.</span></a>
  </div></div>
  <div class="sp-hub-group"><h2 id="g5">OrivenAI solutions</h2><div class="sp-related">
    <a href="/ppc-automation-software/"><strong>PPC automation software</strong><span>Rules that pause, resume, adjust budgets or ask first, on Google Ads and Meta Ads.</span></a>
    <a href="/cross-platform-ad-management/"><strong>Cross-platform ad management</strong><span>One brief, adapted per platform, launched and followed from one workspace.</span></a>
    <a href="/pricing"><strong>Pricing</strong><span>Free, Starter, Creator and Professional plans.</span></a>
  </div></div>
  <div class="sp-hub-group"><h2 id="g7">From the OrivenAI blog</h2><div class="sp-related">
    <a href="/blog/what-you-can-do-with-oriven"><strong>What you can do with OrivenAI</strong><span>A walkthrough of Control Center, Research, Create, Launch, Campaigns and Automations.</span></a>
    <a href="/blog/why-we-built-oriven"><strong>Why we built OrivenAI</strong><span>The problem we saw, and the principles behind the product.</span></a>
    <a href="/blog/oriven-ai-is-now-live"><strong>OrivenAI is now live</strong><span>What OrivenAI is, what it does today, and how to get started.</span></a>
  </div></div>
</div></section>`,
  faqTitle: 'About OrivenAI',
  faq: [
    ['What is OrivenAI?', `<p>${F.canonical}</p>`],
    ['How does OrivenAI work?', '<p>You describe your business once in Control Center. In Create, you write a short brief and choose a platform; OrivenAI builds a campaign in that platform’s structure, with ad copy, targeting and image or video creative. Launch shows whether each draft is ready and publishes it to your own ad account when you choose. Campaigns tracks results, and Automations can schedule campaigns and apply rules you set.</p>'],
    ['Who is OrivenAI designed for?', '<p>Small businesses, founders and marketers who run ads on Google, Meta, TikTok or Pinterest and want to research, create, launch and follow campaigns in one place, without stitching together separate tools.</p>'],
    ['Can OrivenAI create image and video ads?', `<p>Yes. Create generates image ads and video ads in each platform’s formats. A complete image ad uses ${F.costs.imageAd} credits and a video ad ${F.costs.videoAd} credits.</p>`],
    ['Which ad platforms does OrivenAI support?', '<p>Google Ads (Search, Performance Max and Demand Gen), Meta Ads (Facebook and Instagram), TikTok Ads and Pinterest Ads. Campaigns are created and published through each platform’s official API. Automations work with campaigns in your connected ad accounts; what they can change depends on the platform and how the campaign is set up.</p>'],
    ['Does OrivenAI have a free plan?', '<p>Yes. The Free plan includes Control Center, Create, Launch and Campaigns, with 10 credits a day that reset daily and one campaign build a day. Starter (€9.95/month) adds Research and Automations with 1,000 credits a month; Creator (€19.95) adds Oriven Chat and in-app notifications; Professional (€34.95) adds Priority Support and a Weekly AI Performance Report by email (coming soon).</p>'],
    ['Is OrivenAI related to other companies named “Oriven”?', '<p>OrivenAI is the AI advertising platform at orivenai.com, operated from the Netherlands (KVK 42039993). It isn’t affiliated with other businesses that use the name Oriven.</p>'],
  ],
  related: [],
  cta: { title: 'Try what you’ve read about', text: 'Build your first campaign on the Free plan.', label: 'Get Started Free' },
};
