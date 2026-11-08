// Blog post — originally published 13 July 2026 (short modal post).
// Rewritten at the SAME URL (/blog/what-you-can-do-with-oriven) as a full
// walkthrough of what OrivenAI does today. Intent: branded / product
// ("OrivenAI features", "what can OrivenAI do").
const F = require('../facts');
const FC = require('../../../js/plans.js').ORIVEN_PRICING.featureCosts;
module.exports = {
  path: '/blog/what-you-can-do-with-oriven',
  kind: 'article',
  datePublished: '2026-07-13',
  dateModified: '2026-11-08',
  readMinutes: 11,
  title: 'What You Can Do With OrivenAI | OrivenAI Blog',
  ogTitle: 'What you can do with OrivenAI',
  description: 'A walkthrough of OrivenAI today: Control Center, Research, Create, Launch, Campaigns and Automations, the platforms each supports and what each plan includes.',
  crumb: 'What you can do with OrivenAI',
  teaser: 'A walkthrough of Control Center, Research, Create, Launch, Campaigns and Automations.',
  breadcrumbs: [{ name: 'Blog', path: '/blog' }],
  eyebrow: 'Blog · Product',
  h1: 'What you can do with OrivenAI',
  about: 'OrivenAI features',
  body: `
<p class="sp-note">Updated in November 2026 to describe every part of OrivenAI as it works today, including the Marketing Plan, Progress, your personal assistant and four newer pages.</p>

<p>OrivenAI is organized around the order in which advertising actually happens: understand your business and market, create the ads, launch them, follow the results and automate the routine. Each part uses the same business profile, so you don’t re-explain your company at every step. Here’s what each one does.</p>

<h2>Control Center: your business, in one place</h2>
<p>Control Center is where OrivenAI learns about your business: what you sell, who you sell to, your brand voice and visual identity, and the context behind your campaigns. It’s also the start page that shows what’s happening, what needs your attention and what’s planned. Every other part of OrivenAI reads from it, which is why ads come out sounding like you rather than like a template.</p>

<h2>Marketing Plan and Progress: what to do next</h2>
<p>Your Marketing Plan is written from your onboarding answers for the period you bought. Every task is something you can do inside OrivenAI, not homework elsewhere, and each one says why it matters, what to do and which page to open. A 14-day plan has two phases, a one-month plan is split into weeks, and six- and twelve-month plans are split into months with about 10 to 15 tasks each.</p>
<p>Progress follows that plan. Tasks OrivenAI can check, such as a finished research report, a saved audience or a published campaign, tick off only when the result really exists; opening a page doesn’t count. Tasks it can’t check have a box you tick yourself.</p>
<p>If your business changes, you can write a new plan by saying what should be different. It costs ${FC.plan_generation} credits, returned if the plan can’t be written. Your current plan stays until the new one is ready, and Progress then starts again with the new tasks. Your research, content, audiences and campaigns aren’t touched.</p>

<h2>Your personal assistant</h2>
<p>When you start, you choose one of six assistants: Scout (research and insights), Vector (strategy and direction), Nova (creative and content), Momentum (growth and execution), Metric (performance and optimisation) or Flux (automation and systems). All six can help with the whole platform; your choice sets the tone and where it starts from. The choice is permanent, so it stays with you as your own assistant.</p>
<p>It can write headlines and emails, create a campaign draft, start and read research, list your campaigns and automations, and open any page. Pausing, resuming, renaming or changing the budget of a live campaign, and creating an automation, wait for your confirmation. It can’t connect an ad account, publish a draft, generate videos or change billing; it sends you to the right page instead. Each message costs ${F.costs.chatMessage} credits, plus up to two extra steps at ${F.costs.chatStep} credits when it needs to use a tool.</p>

<h2>Research: understand the market before you spend</h2>
<p><a href="/research">Research</a> lets you ask questions about your market, competitors, audiences and opportunities, and returns a structured report for the research type you choose: targeted web searches, the pages it reads, your own website and any pages you attach are used as evidence, and a finding is only marked Source-checked when the passage it quotes was found in a page it read. Reports are saved to your Research library. It links to the platforms’ official ad libraries, such as the Meta Ad Library, so you can look at real ads yourself; it doesn’t pull ads from those libraries or show how competitors’ ads perform. Research is included in every plan. See <a href="/learn/how-to-research-competitor-ads/">how to research competitor ads</a> for the method behind it.</p>

<h3>Competitor Analysis</h3>
<p>Keep a list of your competitors and analyse up to three of their websites at a time, or let OrivenAI find competitors in your market from public sources. Each finding is labelled Verified, Public source, AI analysis or AI suggestion, so you can see what a source says and what is OrivenAI’s reading of it. An analysis costs the same ${F.costs.researchRun} credits as other research and is saved so you can come back to it. OrivenAI has no access to anyone’s private advertising data.</p>

<h2>Create: from a short brief to a complete campaign</h2>
<p>In <a href="/create">Create</a>, you describe what you want to advertise, choose a platform and a goal (Sales, Leads, Traffic or Awareness), and choose image or video. You can attach product photos. OrivenAI builds the campaign in that platform’s own structure (for example campaign, ad sets and ads on Meta) with ad copy, targeting and creative. A complete image ad uses ${F.costs.imageAd} credits and a video ad ${F.costs.videoAd}.</p>

<h3>Creative Testing and My Content</h3>
<p>Creative Testing writes 3, 5, 8 or 10 versions of an ad idea for ${FC.campaign_improvement} credits and shows them side by side: headlines, hooks, descriptions, calls to action, emotional, premium or urgent tones, image ideas and video angles. You can create an image from an image idea, and the version you choose is saved to My Content, ready for a campaign. It won’t call a version a winner. Results per version only appear once an ad platform reports them for a published campaign.</p>
<p>My Content keeps what you’ve made: images, videos, ad creatives and copy.</p>

<h2>Launch: check, then publish</h2>
<p><a href="/launch">Launch</a> lists your drafts and shows whether each is ready to publish, for example whether the right ad account is connected. When you publish, OrivenAI creates the campaign in your own ad account through the platform’s official API. Campaigns are created paused, so you can review them in the ad platform and switch them on when you’re ready.</p>

<h3>Audience Builder</h3>
<p>Audience Builder suggests audiences from your onboarding answers, business details and research for ${FC.audience_generation} credits, and says what each suggestion is based on and what it assumes. If OrivenAI doesn’t know enough yet, it says so and charges nothing. You can edit and save suggestions or write your own, with targeting recommendations per platform. A saved audience is prepared in OrivenAI: it can be applied to a campaign in Campaign Builder that isn’t published yet, but it isn’t created as an audience inside Meta, Google, TikTok or Pinterest.</p>

<h2>Campaigns: follow what’s running</h2>
<p><a href="/campaigns">Campaigns</a> shows spend, delivery, traffic and conversions per platform and campaign, for the date range you choose. Each platform’s numbers are shown as that platform reports them, rather than blended into one total that would double-count.</p>

<h3>Campaign Comparison</h3>
<p>Choose two or more campaigns and a period to see impressions, reach, clicks, CTR, CPC, CPM, conversions, conversion rate, CPA, ROAS and spend side by side. Ratios are calculated only from figures the platform reported; anything missing shows as “Not reported”, never as zero or an estimate. Money is only compared within one currency, and campaigns with fewer than 1,000 impressions are flagged because differences may be chance. For ${FC.ai_analysis} credits, OrivenAI explains the differences using only those figures and saves the comparison. Two limits come from the platforms: Pinterest reports results per ad account here, so its campaigns can’t be compared one by one, and TikTok may return no campaign results for a period.</p>

<h2>Automations: schedules and rules that act within your limits</h2>
<p><a href="/autopilot">Automations</a> switch campaigns on and off at times you choose and apply rules you define to your published campaigns, such as pausing a campaign with no conversions, increasing a budget when return on ad spend is above your target, or notifying you when click-through rate drops. You decide the conditions and the limits. Read more about <a href="/ppc-automation-software/">PPC automation with OrivenAI</a>.</p>

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
<p>${F.planLine} Every plan also includes in-app notifications, Priority Support and a Weekly AI Performance Report by email (${F.weeklyReportLive ? 'every Monday' : 'coming soon'}). Full details are on the <a href="/pricing">Pricing</a> page.</p>

<h2>What each action costs</h2>
<div class="sp-table-wrap"><table class="sp-table">
  <thead><tr><th scope="col">Action</th><th scope="col">Credits</th></tr></thead>
  <tbody>
    <tr><td>Complete image ad (copy and image)</td><td>${F.costs.imageAd}</td></tr>
    <tr><td>Complete video ad (copy and 5-second video)</td><td>${F.costs.videoAd}</td></tr>
    <tr><td>Research report or competitor analysis</td><td>${F.costs.researchRun}</td></tr>
    <tr><td>A new Marketing Plan on request</td><td>${FC.plan_generation}</td></tr>
    <tr><td>Creative variations</td><td>${FC.campaign_improvement}</td></tr>
    <tr><td>Audience suggestions</td><td>${FC.audience_generation}</td></tr>
    <tr><td>AI explanation of a campaign comparison</td><td>${FC.ai_analysis}</td></tr>
    <tr><td>Message to your assistant</td><td>${F.costs.chatMessage}</td></tr>
    <tr><td>New automation (its later checks and changes are free)</td><td>${F.costs.automationCreate}</td></tr>
  </tbody>
</table></div>

<h2>Where to start</h2>
<p>The quickest way to see OrivenAI work is to fill in Control Center, then create one campaign for the platform you already use. If you advertise on several platforms, our guide to <a href="/learn/how-to-manage-multiple-ad-platforms/">managing multiple ad platforms</a> explains how to keep them organized.</p>`,
  faq: [],
  related: ['/blog/oriven-ai-is-now-live', '/blog/why-we-built-oriven', '/learn/how-to-create-facebook-and-instagram-ads-with-ai/'],
  relatedTitle: 'Read next',
  cta: { title: 'See it with your own business', text: 'All six sections are included in every plan.', label: 'Get started' },
};
