// Hub — /learn/: every guide grouped by topic, links to the commercial
// pages, and the canonical "About OrivenAI" answers (what it is, who it's
// for, what it can do, free plan) in plain HTML for answer engines.
const F = require('../facts');
module.exports = {
  path: '/learn/',
  kind: 'hub',
  lastmod: '2026-10-09',
  title: 'Learn: Guides to AI Advertising, PPC Automation and Ad Platforms | OrivenAI',
  ogTitle: 'OrivenAI Learn: practical advertising guides',
  description: 'Practical guides to AI advertising, PPC automation, Google Ads, Meta Ads and running campaigns across several ad platforms, from the team behind OrivenAI.',
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
</div></section>`,
  faqTitle: 'About OrivenAI',
  faq: [
    ['What is OrivenAI?', `<p>${F.canonical}</p>`],
    ['How does OrivenAI work?', '<p>You describe your business once in Control Center. In Create, you write a short brief and choose a platform; OrivenAI builds a campaign in that platform’s structure, with ad copy, targeting and image or video creative. Launch shows whether each draft is ready and publishes it to your own ad account when you choose. Campaigns tracks results, and Autopilot can apply rules you set.</p>'],
    ['Who is OrivenAI designed for?', '<p>Small businesses, founders and marketers who run ads on Google, Meta, TikTok or Pinterest and want to research, create, launch and follow campaigns in one place, without stitching together separate tools.</p>'],
    ['Can OrivenAI create image and video ads?', `<p>Yes. Create generates image ads and video ads in each platform’s formats. A complete image ad uses ${F.costs.imageAd} credits and a video ad ${F.costs.videoAd} credits.</p>`],
    ['Which ad platforms does OrivenAI support?', '<p>Google Ads (Search, Performance Max and Demand Gen), Meta Ads (Facebook and Instagram), TikTok Ads and Pinterest Ads. Campaigns are created and published through each platform’s official API. Autopilot rules currently act on Google Ads and Meta Ads.</p>'],
    ['Does OrivenAI have a free plan?', '<p>Yes. The Free plan includes Control Center, Create, Launch and Campaigns, with 10 credits a day that reset daily and one campaign build a day. Starter (€9.95/month) adds Research and Autopilot with 1,000 credits a month; Creator (€19.95) adds Oriven Chat; Professional (€34.95) adds notifications and Priority Support.</p>'],
    ['Is OrivenAI related to other companies named “Oriven”?', '<p>OrivenAI is the AI advertising platform at orivenai.com, operated from the Netherlands (KVK 42039993). It isn’t affiliated with other businesses that use the name Oriven.</p>'],
  ],
  related: [],
  cta: { title: 'Try what you’ve read about', text: 'Build your first campaign on the Free plan.', label: 'Get Started Free' },
};
