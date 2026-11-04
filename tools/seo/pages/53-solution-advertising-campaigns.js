// Solution page 4/5 — "Advertising and campaign workflows".
// Facts: Create (image and video ad credits from facts.js; unsupported options
// shown disabled), Launch (readiness: ready / check warnings / blocked /
// failed; checks for account, budget, targeting, tracking and creative;
// publishing through each platform's official API creates campaigns
// PAUSED), Campaigns (spend, clicks, CTR, CPA, ROAS by platform and
// campaign; pause/resume on Google Ads, Meta Ads and Pinterest Ads;
// Campaign Replay). Campaign Builder = the campaign workspace opened from
// Launch. Some platform-side steps (verification) happen on the platform.
const path = (items) => `<p class="sol__path" aria-label="Where it happens: ${items.join(', ')}">${items.map((x) => `<span>${x}</span>`).join('<i aria-hidden="true">&rarr;</i>')}</p>`;
const F = require('../facts');
module.exports = {
  path: '/solutions/advertising-campaigns',
  kind: 'commercial',
  lastmod: '2026-10-29',
  title: 'Create, Launch and Follow Ad Campaigns | OrivenAI Solutions',
  ogTitle: 'Advertising and campaign workflows',
  description: 'Create image and video ads, check them against what each platform needs, publish them paused, and follow every campaign in one place.',
  breadcrumbs: [{ name: 'Solutions', path: '/solutions' }],
  crumb: 'Ads and campaigns',
  teaser: 'Create, check and publish ads, then follow every campaign.',
  eyebrow: 'Solution 04 · Ads and campaigns',
  h1: 'From a finished ad to a campaign you can follow',
  lede: 'Making an ad is half the job. It still has to meet each platform’s requirements, get published to the right account, and be followed once it runs. OrivenAI splits that into two clear steps: Launch gets ads out, Campaigns follows what is running.',
  secondary: { href: '/launch', label: 'Explore Launch' },
  heroNote: 'Create, Launch and Campaigns are included in every plan. An image ad costs ' + F.costs.imageAd + ' credits, a video ad ' + F.costs.videoAd + '.',
  body: `
<section class="sp-section" aria-labelledby="problem-h"><div class="sp-wrap">
  <h2 id="problem-h">The problem: four ad managers, four rulebooks</h2>
  <p>Every platform has its own formats, required fields and review rules. An ad that is ready for Meta may be missing a landing page for Google or the right aspect ratio for TikTok, and you find out only after the upload fails. Once campaigns run, their results are spread across four dashboards with different names for the same numbers.</p>
</div></section>

<section class="sp-section" aria-labelledby="how-h"><div class="sp-wrap">
  <h2 id="how-h">How OrivenAI handles it</h2>
  ${path(['Create', 'Launch · Ad Studio', 'Campaigns'])}
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">Create</span><h3>Ads made for the platform</h3><p>Image and video ads for Google, Meta, TikTok and Pinterest. Options a platform doesn’t support are shown disabled, with the reason, before anything is generated.</p></div>
    <div class="sp-card"><span class="sp-tag">Launch</span><h3>Checked before it’s published</h3><p>Each draft is marked ready, check warnings, blocked or failed, with what blocks it: account, budget, targeting, tracking or creative.</p></div>
    <div class="sp-card"><span class="sp-tag">Publish</span><h3>Created paused</h3><p>Publishing goes through each platform’s official API and creates the campaign paused, so you decide when it starts spending.</p></div>
    <div class="sp-card"><span class="sp-tag">Campaigns</span><h3>One view of every campaign</h3><p>Spend, clicks, CTR, CPA and ROAS by platform and campaign, date ranges, and pause or resume on Google Ads, Meta Ads and Pinterest Ads.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="flow-h"><div class="sp-wrap">
  <h2 id="flow-h">Launch and Campaigns: who does what</h2>
  <div class="sp-table-wrap"><table class="sp-table">
    <thead><tr><th scope="col"></th><th scope="col"><a href="/launch">Launch</a></th><th scope="col"><a href="/campaigns">Campaigns</a></th></tr></thead>
    <tbody>
      <tr><th scope="row">Job</th><td>Getting ads out</td><td>Following what’s running</td></tr>
      <tr><th scope="row">Page</th><td>Ad Studio (called Launch in the app)</td><td>Campaign Overview</td></tr>
      <tr><th scope="row">You see</th><td>Drafts and their readiness</td><td>Results by platform and campaign, trends, Campaign Replay</td></tr>
      <tr><th scope="row">You do</th><td>Fix what blocks a draft, then publish</td><td>Compare campaigns; pause or resume where the platform allows it</td></tr>
    </tbody>
  </table></div>
  <p>A campaign’s setup (structure, targeting, budget and ads) is reviewed and adjusted in the campaign workspace you open from Launch. A Campaign Builder page inside Campaigns is in development.</p>
</div></section>

<section class="sp-section" aria-labelledby="who-h"><div class="sp-wrap">
  <h2 id="who-h">When it helps most</h2>
  <div class="sp-grid">
    <div class="sp-card"><h3>Publishing to a platform you don’t know well</h3><p>Launch shows what TikTok or Pinterest needs before you publish, instead of after a failed upload.</p></div>
    <div class="sp-card"><h3>Running on several platforms at once</h3><p>Follow Google, Meta, TikTok and Pinterest campaigns side by side in Campaigns.</p></div>
    <div class="sp-card"><h3>Keeping control of spend</h3><p>Everything is created paused; nothing spends until you switch it on.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="scope-h"><div class="sp-wrap">
  <h2 id="scope-h">What it doesn’t do</h2>
  <p>OrivenAI doesn’t switch campaigns on for you, and publishing needs a connected ad account. Some platform-side steps, like a platform’s own account verification, still happen on that platform. Campaigns shows the figures each platform reports; it doesn’t edit every platform-level setting, and bidding and delivery stay with each platform.</p>
</div></section>`,
  faq: [
    ['Are campaigns started automatically after publishing?', '<p>No. Campaigns published from Launch are created paused. You switch them on when you’re ready.</p>'],
    ['Which platforms can I publish to?', '<p>Google Ads, Meta Ads (Facebook and Instagram), TikTok Ads and Pinterest Ads, through each platform’s official API, once the ad account is connected.</p>'],
    ['What is the difference between Launch and Campaigns?', '<p>Launch gets ads out: it checks drafts and publishes them. Campaigns follows what is running: results, trends and, where the platform allows it, pause and resume.</p>'],
  ],
  related: ['/solutions/plan-to-content', '/solutions/structured-automation', '/solutions/connected-workflow', '/solutions/research-before-creation', '/launch', '/campaigns'],
  relatedTitle: 'Other solutions and sections',
  ctaEyebrow: 'Solutions',
  ctaSecondary: ['/campaigns', 'Explore Campaigns'],
  cta: { title: 'Get your next ad out, then follow it', text: 'Create, Launch and Campaigns are in every plan. Connect an ad account to publish.', label: 'Get started' },
};
