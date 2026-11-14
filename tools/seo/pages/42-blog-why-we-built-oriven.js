// Blog post — originally published 13 July 2026 (short modal post).
// Rewritten at the SAME URL (/blog/why-we-built-oriven): the problem
// OrivenAI addresses and the principles behind it. Intent: branded /
// story. Links to the practical guides instead of repeating them.
const F = require('../facts');
module.exports = {
  path: '/blog/why-we-built-oriven',
  kind: 'article',
  datePublished: '2026-07-13',
  dateModified: '2026-11-08',
  readMinutes: 8,
  title: 'Why We Built OrivenAI: No More Tool Sprawl | OrivenAI Blog',
  ogTitle: 'Why we built OrivenAI',
  description: 'Why we built OrivenAI: small teams juggle separate tools to research, create, launch and watch ads. The problem we saw and the principles we follow.',
  crumb: 'Why we built OrivenAI',
  teaser: 'The problem we saw, and the principles behind the product.',
  breadcrumbs: [{ name: 'Blog', path: '/blog' }],
  eyebrow: 'Blog · Company',
  h1: 'Why we built OrivenAI',
  about: 'The story behind OrivenAI',
  body: `
<p class="sp-note">Updated in November 2026.</p>

<p>Running ads as a small team means doing a specialist’s job in between everything else. You research the market in one place, write copy in another, design creative in a third, set up campaigns in each ad platform’s own manager, and check results in yet another set of dashboards. Every switch costs time, and every tool knows only a slice of your business.</p>
<p>We built OrivenAI because we kept seeing the same problems in that setup, and believed they could be solved in one workspace.</p>

<h2>The problems we kept seeing</h2>
<h3>Every tool starts from zero</h3>
<p>Each tool asks what you sell and who you sell to, and none of them remembers. Ads generated without that context come out generic, and editing them back into your voice takes as long as writing them.</p>
<h3>Creative and campaigns live apart</h3>
<p>A good ad is only useful once it’s in a correctly configured campaign. Getting from “we have creative” to “it’s live with the right objective, audience and budget” is where many small advertisers lose days, or launch half-configured campaigns.</p>
<h3>Every platform works differently</h3>
<p>Google, Meta, TikTok, Pinterest and Snapchat each have their own structure, formats and rules. Doing the same work separately for each platform multiplies the effort; our guide on <a href="/learn/how-to-manage-multiple-ad-platforms/">managing multiple ad platforms</a> describes how much discipline that takes.</p>
<h3>Automation without limits is scary</h3>
<p>Automated changes can save time, but many people don’t trust them, for good reason: an automated rule that changes budgets or pauses campaigns at the wrong moment costs real money.</p>

<h2>What one campaign really involves</h2>
<p>Take a simple job: advertise one offer on all four platforms. The idea is the same everywhere, yet almost nothing else carries over:</p>
<div class="sp-table-wrap"><table class="sp-table">
  <thead><tr><th scope="col">Platform</th><th scope="col">How a campaign is organized</th><th scope="col">What you have to produce</th></tr></thead>
  <tbody>
    <tr><th scope="row">Google Ads</th><td>Campaigns and ad groups, with keywords in Search</td><td>Up to 15 headlines of 30 characters and 4 descriptions of 90 for a responsive search ad</td></tr>
    <tr><th scope="row">Meta Ads</th><td>Campaigns and ad sets with an audience, budget and placements</td><td>Images or video, with a recommended 27-character headline and 50–150 characters of primary text</td></tr>
    <tr><th scope="row">TikTok Ads</th><td>Campaigns and ad groups</td><td>Vertical video, with 9:16 recommended</td></tr>
    <tr><th scope="row">Pinterest Ads</th><td>Campaigns organized around Pins</td><td>Vertical images, with 2:3 recommended, and titles of up to 100 characters</td></tr>
  </tbody>
</table></div>
<p>Platforms change these rules, so check the current numbers in our <a href="/learn/ad-character-limits/">ad character limits guide</a> before relying on them. That’s four setups, four sets of creative and four dashboards for one idea, before anyone has looked at whether it worked. A specialist can do that. Someone who also runs the business usually picks one platform and leaves the rest, or copies one version everywhere and gets weaker ads. That was the gap we wanted to close.</p>

<h2>The principles behind OrivenAI</h2>
<ul>
  <li><strong>One business profile, used everywhere.</strong> You describe your business once in Control Center, and Research, Create and every other step build on it.</li>
  <li><strong>Respect each platform’s structure.</strong> Create builds campaigns the way each ad platform expects, instead of forcing one format on all of them.</li>
  <li><strong>You stay in control of what goes live.</strong> Launch shows whether a draft is ready, and campaigns are created paused in your own ad account so you review them before they run.</li>
  <li><strong>Automation within limits you set.</strong> Automations only apply the schedules and rules you define, within the limits you set.</li>
  <li><strong>No invented numbers.</strong> Performance comes from the ad platforms themselves, predictions are labeled as predictions, and Research shows its sources.</li>
</ul>

<h2>The trade-offs we chose</h2>
<p>Principles only mean something if they cost you something. These are the places where we gave up a simpler or more impressive-looking product:</p>
<ul>
  <li><strong>Publishing takes one more step.</strong> Because campaigns are created paused, you have to switch them on in the ad platform. That’s slower than one button, and it means nothing spends money before someone has looked at it.</li>
  <li><strong>There is no single blended number.</strong> Campaigns shows each platform’s figures as that platform reports them. A combined total would look tidier, but platforms count conversions by their own rules, so the same sale can appear twice.</li>
  <li><strong>Missing data stays missing.</strong> If a platform doesn’t report a metric, Campaign Comparison says “Not reported” instead of filling the gap, and AI explanations use only the figures on the page. Some tables look emptier as a result.</li>
  <li><strong>Research won’t show competitors’ results.</strong> That data isn’t public, so we don’t pretend to have it. Findings are labelled by where they came from, which makes some reports read less confidently than a tool that states everything as fact.</li>
  <li><strong>Plans don’t renew on their own.</strong> You pay once for a period and nothing is charged when it ends. That’s easier to trust, though you have to remember to extend if you want to carry on.</li>
  <li><strong>A finished task has to be finished.</strong> Progress ticks a task off only when the real result exists. Opening a page earns nothing, so the numbers can look slower than a checklist you tick yourself.</li>
</ul>

<h2>Who it’s for</h2>
<p>OrivenAI is for small businesses, founders and marketers who run their own ads and want one workspace for the whole process: research, creative, launch, results and routine decisions. It isn’t trying to replace your analytics tool or every specialist tool an agency might use; it’s trying to make the core loop of advertising faster and calmer for small teams.</p>
<p>It’s probably not the right fit if you have a dedicated media buyer who needs every advanced setting, if you need reporting that merges all your platforms into one attribution model, or if you want software that runs your ads with nobody checking them.</p>

<h2>How to judge whether we’re keeping to this</h2>
<p>You don’t have to take our word for any of it. A few things you can check yourself:</p>
<ol>
  <li>Publish a campaign and open it in the ad platform: it should be there, in your own account, paused.</li>
  <li>Open a research report and follow a Source-checked finding to its source: the quoted passage should be on that page.</li>
  <li>Compare a figure in Campaigns with the same campaign and period in the ad platform: they should match what the platform reports.</li>
  <li>Open your task list in Progress before and after doing a task: only a real result should tick it off.</li>
</ol>
<p>If any of these doesn’t hold, we want to know.</p>

<h2>Where we are now</h2>
<p>OrivenAI supports Google Ads, Meta Ads, TikTok Ads, Pinterest Ads and Snapchat Ads today. You can read what each part does in <a href="/blog/what-you-can-do-with-oriven">What you can do with OrivenAI</a>, or learn more about the category in <a href="/learn/what-is-an-ai-advertising-platform/">What is an AI advertising platform?</a> If you have feedback, we’d like to hear it at <a href="mailto:contact@orivenai.com">contact@orivenai.com</a>.</p>`,
  faq: [],
  related: ['/blog/what-you-can-do-with-oriven', '/blog/oriven-ai-is-now-live', '/learn/how-to-manage-multiple-ad-platforms/'],
  relatedTitle: 'Read next',
  cta: { title: 'One workspace for your advertising', text: 'Try it with any plan, from ' + F.fromPrice + ' for 14 days.', label: 'Get started' },
};
