// Blog post — originally published 13 July 2026 (short modal post).
// Rewritten at the SAME URL (/blog/what-you-can-do-with-oriven) as a full
// walkthrough of what OrivenAI does today. Intent: branded / product
// ("OrivenAI features", "what can OrivenAI do").
const F = require('../facts');
module.exports = {
  path: '/blog/what-you-can-do-with-oriven',
  kind: 'article',
  datePublished: '2026-07-13',
  dateModified: '2026-10-14',
  readMinutes: 7,
  title: 'What You Can Do With OrivenAI: A Walkthrough of Every Feature | OrivenAI Blog',
  ogTitle: 'What you can do with OrivenAI',
  description: 'A walkthrough of OrivenAI today: Control Center, Research, Create, Launch, Campaigns and Automations, the platforms each supports and what each plan includes.',
  crumb: 'What you can do with OrivenAI',
  teaser: 'A walkthrough of Control Center, Research, Create, Launch, Campaigns and Automations.',
  breadcrumbs: [{ name: 'Blog', path: '/blog' }],
  eyebrow: 'Blog · Product',
  h1: 'What you can do with OrivenAI',
  about: 'OrivenAI features',
  body: `
<p class="sp-note">Updated in October 2026 to describe every part of OrivenAI as it works today.</p>

<p>OrivenAI is organized around the order in which advertising actually happens: understand your business and market, create the ads, launch them, follow the results and automate the routine. Each part uses the same business profile, so you don’t re-explain your company at every step. Here’s what each one does.</p>

<h2>Control Center: your business, in one place</h2>
<p>Control Center is where OrivenAI learns about your business: what you sell, who you sell to, your brand voice and visual identity, and the context behind your campaigns. It’s also the start page that shows what’s happening, what needs your attention and what’s planned. Every other part of OrivenAI reads from it, which is why ads come out sounding like you rather than like a template.</p>

<h2>Research: understand the market before you spend</h2>
<p><a href="/research">Research</a> lets you ask questions about your market, competitors, audiences and opportunities, and returns a structured report for the research type you choose: targeted web searches, the pages it reads, your own website and any pages you attach are used as evidence, and a finding is only marked Source-checked when the passage it quotes was found in a page it read. Reports are saved to your Research library. It links to the platforms’ official ad libraries, such as the Meta Ad Library, so you can look at real ads yourself; it doesn’t pull ads from those libraries or show how competitors’ ads perform. Research is included from the Starter plan. See <a href="/learn/how-to-research-competitor-ads/">how to research competitor ads</a> for the method behind it.</p>

<h2>Create: from a short brief to a complete campaign</h2>
<p>In <a href="/create">Create</a>, you describe what you want to advertise, choose a platform and a goal (Sales, Leads, Traffic or Awareness), and choose image or video. You can attach product photos. OrivenAI builds the campaign in that platform’s own structure (for example campaign, ad sets and ads on Meta) with ad copy, targeting and creative. A complete image ad uses ${F.costs.imageAd} credits and a video ad ${F.costs.videoAd}.</p>

<h2>Launch: check, then publish</h2>
<p><a href="/launch">Launch</a> lists your drafts and shows whether each is ready to publish, for example whether the right ad account is connected. When you publish, OrivenAI creates the campaign in your own ad account through the platform’s official API. Campaigns are created paused, so you can review them in the ad platform and switch them on when you’re ready.</p>

<h2>Campaigns: follow what’s running</h2>
<p><a href="/campaigns">Campaigns</a> shows spend, delivery, traffic and conversions per platform and campaign, for the date range you choose. Each platform’s numbers are shown as that platform reports them, rather than blended into one total that would double-count.</p>

<h2>Automations: schedules and rules that act within your limits</h2>
<p><a href="/autopilot">Automations</a> (from the Starter plan) switch campaigns on and off at times you choose and apply rules you define to your published campaigns, such as pausing a campaign with no conversions, increasing a budget when return on ad spend is above your target, or notifying you when click-through rate drops. You decide the conditions and the limits. Read more about <a href="/ppc-automation-software/">PPC automation with OrivenAI</a>.</p>

<h2>Which platforms are supported</h2>
<div class="sp-table-wrap"><table class="sp-table">
  <thead><tr><th scope="col">Platform</th><th scope="col">Create and launch</th><th scope="col">Automations</th></tr></thead>
  <tbody>
    <tr><td>Google Ads (Search, Performance Max, Demand Gen)</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Meta Ads (Facebook and Instagram)</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>TikTok Ads</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Pinterest Ads</td><td>Yes</td><td>Yes</td></tr>
  </tbody>
</table></div>

<h2>What’s included on each plan</h2>
<p>${F.freePlanLine} Starter (€${F.plans[1].price.toFixed(2)} a month) adds Research and Automations, Creator (€${F.plans[2].price.toFixed(2)}) adds Oriven Chat, and Professional (€${F.plans[3].price.toFixed(2)}) adds notifications and priority support. Full details are on the <a href="/pricing">Pricing</a> page.</p>

<h2>Where to start</h2>
<p>The quickest way to see OrivenAI work is to fill in Control Center, then create one campaign for the platform you already use. If you advertise on several platforms, our guide to <a href="/learn/how-to-manage-multiple-ad-platforms/">managing multiple ad platforms</a> explains how to keep them organized.</p>`,
  faq: [],
  related: ['/blog/oriven-ai-is-now-live', '/blog/why-we-built-oriven', '/learn/how-to-create-facebook-and-instagram-ads-with-ai/'],
  relatedTitle: 'Read next',
  cta: { title: 'See it with your own business', text: 'Control Center, Create, Launch and Campaigns are included on the Free plan.', label: 'Get Started Free' },
};
