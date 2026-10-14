// Blog post — originally published 13 July 2026 as a short launch note
// inside the single-page app (modal). Rewritten as a full, crawlable page
// at the SAME URL (/blog/oriven-ai-is-now-live, served from
// blog/oriven-ai-is-now-live.html). Intent: branded ("OrivenAI launch",
// "what is OrivenAI"). Describes the product as it is today.
const F = require('../facts');
module.exports = {
  path: '/blog/oriven-ai-is-now-live',
  kind: 'article',
  datePublished: '2026-07-13',
  dateModified: '2026-10-14',
  readMinutes: 5,
  title: 'OrivenAI Is Now Live: An AI Advertising Platform for Small Teams | OrivenAI Blog',
  ogTitle: 'OrivenAI is now live',
  description: 'OrivenAI is live: an AI advertising platform to research your market, create image and video ads, and launch campaigns on Google, Meta, TikTok and Pinterest. Here’s what it does and how to start.',
  crumb: 'OrivenAI is now live',
  teaser: 'What OrivenAI is, what it does today, and how to get started.',
  breadcrumbs: [{ name: 'Blog', path: '/blog' }],
  eyebrow: 'Blog · Announcement',
  h1: 'OrivenAI is now live',
  about: 'OrivenAI launch',
  body: `
<p class="sp-note">This post was first published when OrivenAI launched, and updated in October 2026 to describe the product as it is today.</p>

<p>After months of planning, designing and building, OrivenAI is live. Our goal is simple to state and hard to do well: give small teams one place to research their market, create ads, launch them on the platforms they use and keep them under control, without stitching together half a dozen tools.</p>

<h2>What OrivenAI is</h2>
<p>${F.canonical}</p>
<p>It’s built for small businesses, founders and marketers who run ads themselves, often alongside everything else they do, and who want help with the whole process rather than one step of it.</p>

<h2>What you can do today</h2>
<ul>
  <li><strong>Describe your business once.</strong> Control Center holds your offer, audience, brand voice and visual identity, and every other part of OrivenAI uses it.</li>
  <li><strong>Research before you spend.</strong> <a href="/research">Research</a> looks into your market, competitors and audiences and lists its sources.</li>
  <li><strong>Create campaigns from a brief.</strong> <a href="/create">Create</a> turns a short description into a campaign in the chosen platform’s structure, with ad copy, targeting and image or video creative.</li>
  <li><strong>Launch when you’re ready.</strong> <a href="/launch">Launch</a> checks each draft and publishes it to your own ad account through the platform’s official API.</li>
  <li><strong>Follow results.</strong> <a href="/campaigns">Campaigns</a> shows performance per platform.</li>
  <li><strong>Automate routine decisions.</strong> <a href="/autopilot">Autopilot</a> applies rules you set, such as pausing a campaign or adjusting its budget, on Google Ads and Meta Ads.</li>
</ul>

<h2>Supported ad platforms</h2>
<p>${F.platforms.join(', ').replace(/, ([^,]*)$/, ' and $1')}. Campaigns are created through each platform’s official API in your own ad account, so you keep full ownership and can always see and change them in the platform itself.</p>

<h2>How pricing works</h2>
<p>OrivenAI has a Free plan and three paid plans. ${F.freePlanLine} Paid plans start at €${F.plans[1].price.toFixed(2)} a month. Actions in OrivenAI use credits (a complete image ad uses ${F.costs.imageAd}); see <a href="/pricing">Pricing</a> for what each plan includes.</p>

<h2>How to get started</h2>
<ol>
  <li>Create a free account and fill in your business profile in Control Center.</li>
  <li>Connect the ad account for the platform you want to start with.</li>
  <li>Write a short brief in Create and review the campaign it builds.</li>
  <li>Publish it from Launch, check it in your ad platform, and switch it on.</li>
</ol>
<p>If you’re new to advertising with AI, our <a href="/learn/">Learn</a> guides are a good place to start, for example <a href="/learn/what-is-an-ai-advertising-platform/">What is an AI advertising platform?</a></p>

<h2>What comes next</h2>
<p>We’ll keep improving OrivenAI based on how people use it, and we’ll share product updates here on the blog. Questions or feedback are always welcome at <a href="mailto:contact@orivenai.com">contact@orivenai.com</a>.</p>`,
  faq: [],
  related: ['/blog/what-you-can-do-with-oriven', '/blog/why-we-built-oriven', '/learn/what-is-an-ai-advertising-platform/'],
  relatedTitle: 'Read next',
  cta: { title: 'Try OrivenAI for free', text: 'Create your first campaign on the Free plan.', label: 'Get Started Free' },
};
