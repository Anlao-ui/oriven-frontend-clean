// Blog post — originally published 13 July 2026 as a short launch note
// inside the single-page app (modal). Rewritten as a full, crawlable page
// at the SAME URL (/blog/oriven-ai-is-now-live, served from
// blog/oriven-ai-is-now-live.html). Intent: branded ("OrivenAI launch",
// "what is OrivenAI"). Describes the product as it is today.
const F = require('../facts');
// One illustrative month on the Monthly plan; every figure comes from js/plans.js.
const MONTHLY = F.plans.find((p) => p.id === 'monthly');
const EX = { research: 3, images: 5, videos: 1, automations: 2, messages: 15 };
const EX_TOTAL = EX.research * F.costs.researchRun + EX.images * F.costs.imageAd + EX.videos * F.costs.videoAd + EX.automations * F.costs.automationCreate + EX.messages * F.costs.chatMessage;
const n = (x) => x.toLocaleString('en-US');
module.exports = {
  path: '/blog/oriven-ai-is-now-live',
  kind: 'article',
  datePublished: '2026-07-13',
  dateModified: '2026-11-08',
  readMinutes: 8,
  title: 'OrivenAI Is Now Live for Small Teams | OrivenAI Blog',
  ogTitle: 'OrivenAI is now live',
  description: 'OrivenAI is live: research your market, create image and video ads, and launch campaigns on Google, Meta, TikTok and Pinterest from one workspace.',
  crumb: 'OrivenAI is now live',
  teaser: 'What OrivenAI is, what it does today, and how to get started.',
  breadcrumbs: [{ name: 'Blog', path: '/blog' }],
  eyebrow: 'Blog · Announcement',
  h1: 'OrivenAI is now live',
  about: 'OrivenAI launch',
  body: `
<p class="sp-note">This post was first published when OrivenAI launched, and updated in November 2026 to describe the product as it is today.</p>

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
  <li><strong>Automate routine decisions.</strong> <a href="/autopilot">Automations</a> schedule campaigns and apply rules you set, such as pausing a campaign or adjusting its budget within your limits.</li>
  <li><strong>Work from a plan.</strong> Your Marketing Plan turns your onboarding answers into tasks you do inside OrivenAI, and Progress ticks a task off when the real result exists, not when you open a page.</li>
  <li><strong>Work with one assistant.</strong> You choose one of six personal AI assistants when you start. It knows your business, answers in its own tone and can do work for you in the app.</li>
</ul>

<h2>Supported ad platforms</h2>
<p>${F.platforms.join(', ').replace(/, ([^,]*)$/, ' and $1')}. Campaigns are created through each platform’s official API in your own ad account, so you keep full ownership and can always see and change them in the platform itself.</p>

<h2>How pricing works</h2>
<p>${F.planLine} Actions in OrivenAI use credits (a complete image ad uses ${F.costs.imageAd}); see <a href="/pricing">Pricing</a> for the details. Prices exclude VAT, which is added at checkout. Your ad spend is separate: you pay it to the ad platforms directly, and OrivenAI never charges ad budgets.</p>
<div class="sp-table-wrap"><table class="sp-table">
  <thead><tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Access</th><th scope="col">Credits</th><th scope="col">How credits arrive</th><th scope="col">Complete image ads, if credits went only to those</th></tr></thead>
  <tbody>
${F.plans.map((p) => '    <tr><th scope="row">' + p.name + '</th><td>' + F.euro(p.price) + '</td><td>' + p.period + '</td><td>' + n(p.creditCount) + '</td><td>' + (p.instalments > 1 ? n(p.creditsPerInstalment) + ' a month' : 'All at once') + '</td><td>' + Math.floor(p.creditCount / F.costs.imageAd) + '</td></tr>').join('\n')}
  </tbody>
</table></div>
<p>Plans don’t renew by themselves, so nothing is charged when one ends; you buy another period if you want to continue. Unused credits expire when your access ends, so a longer plan isn’t a way to bank credits. The trade-off is simple: pay more per month for a shorter commitment, or less per month for a longer one.</p>

<h2>What a month can look like</h2>
<p>Here is one way to use the Monthly plan’s ${n(MONTHLY.creditCount)} credits. It’s an illustration of the arithmetic, not a recommendation or a promise of results.</p>
<ul>
  <li>${EX.research} research reports at ${F.costs.researchRun} credits each: ${n(EX.research * F.costs.researchRun)}</li>
  <li>${EX.images} complete image ads at ${F.costs.imageAd} each: ${n(EX.images * F.costs.imageAd)}</li>
  <li>${EX.videos} video ad with a 5-second video: ${n(EX.videos * F.costs.videoAd)}</li>
  <li>${EX.automations} new automations at ${F.costs.automationCreate} each: ${n(EX.automations * F.costs.automationCreate)}</li>
  <li>${EX.messages} messages to your assistant at ${F.costs.chatMessage} each: ${n(EX.messages * F.costs.chatMessage)}</li>
</ul>
<p>That comes to ${n(EX_TOTAL)} credits and leaves ${n(MONTHLY.creditCount - EX_TOTAL)} for edits and extra versions. A chat message that needs a tool can use more than one step, so heavy assistant use costs more than this suggests. Launching a campaign and following results in Campaigns don’t use credits in normal use.</p>

<h2>How to get started</h2>
<ol>
  <li>Create your account and answer the guided questions about your business, audience, offer, goals and budget.</li>
  <li>Choose your personal assistant and the plan that fits how long you want access. Your Marketing Plan is written for that period after payment.</li>
  <li>Connect the ad account for the platform you want to start with.</li>
  <li>Write a short brief in Create and review the campaign it builds.</li>
  <li>Publish it from Launch, check it in your ad platform, and switch it on.</li>
</ol>
<p>If you’re new to advertising with AI, our <a href="/learn/">Learn</a> guides are a good place to start, for example <a href="/learn/what-is-an-ai-advertising-platform/">What is an AI advertising platform?</a></p>

<h2>What OrivenAI doesn’t do</h2>
<p>It’s worth being clear about the limits, so you can decide whether this is the right tool:</p>
<ul>
  <li><strong>It doesn’t guarantee results.</strong> Ads can lose money. Plans, predictions and suggestions are starting points you judge against your own numbers.</li>
  <li><strong>It doesn’t publish without you.</strong> Campaigns are created paused in your own ad account, and you switch them on.</li>
  <li><strong>It can’t see competitors’ results.</strong> Research uses public sources and links to the platforms’ ad libraries. Nobody’s private ad performance is available to it.</li>
  <li><strong>It doesn’t create saved audiences in the ad platforms.</strong> Audience Builder prepares audiences for your campaigns inside OrivenAI.</li>
  <li><strong>It doesn’t replace the ad platforms.</strong> You still need your own ad account on each platform you use, in good standing with that platform’s policies.</li>
</ul>

<h2>What comes next</h2>
<p>We’ll keep improving OrivenAI based on how people use it, and we’ll share product updates here on the blog. Questions or feedback are always welcome at <a href="mailto:contact@orivenai.com">contact@orivenai.com</a>.</p>`,
  faq: [],
  related: ['/blog/what-you-can-do-with-oriven', '/blog/why-we-built-oriven', '/learn/what-is-an-ai-advertising-platform/'],
  relatedTitle: 'Read next',
  cta: { title: 'Try OrivenAI', text: 'Create your first campaign with any plan, from ' + F.fromPrice + ' for 14 days.', label: 'Get started' },
};
