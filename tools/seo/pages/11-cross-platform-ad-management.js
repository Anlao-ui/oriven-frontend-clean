// Commercial page — intent: "cross-platform ad management" / "manage Google
// and Meta ads together" / "multi-channel PPC software". Facts: create +
// publish on Google, Meta, TikTok, Pinterest (/api/publish/*), Launch
// readiness per platform, Campaigns performance by platform, Control Center
// attention items (incl. unverified conversion tracking), Planning naming/
// UTM templates (js/orivenPlan.js), Autopilot on Google + Meta only.
module.exports = {
  path: '/cross-platform-ad-management/',
  kind: 'commercial',
  lastmod: '2026-10-09',
  title: 'Cross-Platform Ad Management for Google, Meta, TikTok & Pinterest | OrivenAI',
  ogTitle: 'Manage Google, Meta, TikTok and Pinterest ads in one workspace',
  description: 'Plan, create, launch and follow ads on Google Ads, Meta Ads, TikTok Ads and Pinterest Ads from one OrivenAI workspace, with one brief adapted to each platform.',
  crumb: 'Cross-platform ad management',
  teaser: 'One brief, adapted per platform, launched and followed from one workspace.',
  eyebrow: 'Cross-platform advertising',
  h1: 'Manage Google, Meta, TikTok and Pinterest ads from one workspace',
  lede: 'Write one brief and OrivenAI adapts it to each platform’s formats and campaign structures. Launch when each draft is ready, then follow every campaign’s results side by side.',
  secondary: { href: '/product', label: 'See supported platforms' },
  heroNote: 'Creating, launching and tracking campaigns are included in the Free plan.',
  body: `
<section class="sp-section" aria-labelledby="problem-h"><div class="sp-wrap">
  <h2 id="problem-h">The problem with running ads on four platforms</h2>
  <p>Each ad platform has its own editor, its own campaign structure and its own reporting. Google Ads thinks in campaigns and ad groups around search intent; Meta, TikTok and Pinterest think in audiences and creative formats. Running all of them means rewriting the same offer four times, keeping naming and tracking consistent by hand, and stitching reports together in a spreadsheet.</p>
  <p>OrivenAI keeps the shared parts (your business, your brand, your plan) in one place and lets each platform keep what makes it different.</p>
</div></section>

<section class="sp-section" aria-labelledby="flow-h"><div class="sp-wrap">
  <h2 id="flow-h">One workflow across platforms</h2>
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">Control Center</span><h3>Shared business context</h3><p>Your business, brand, audiences and connected accounts live in one place and inform every campaign you create, on every platform.</p></div>
    <div class="sp-card"><span class="sp-tag">Create</span><h3>One brief, platform-specific output</h3><p>Describe what you sell and pick a platform. OrivenAI builds a campaign in that platform’s structure, with ad copy, targeting and image or video creative.</p></div>
    <div class="sp-card"><span class="sp-tag">Launch</span><h3>Readiness before you publish</h3><p>Every draft shows whether it’s ready, ready with warnings, or blocked, and why. You publish when you choose, through the platform’s official API.</p></div>
    <div class="sp-card"><span class="sp-tag">Campaigns</span><h3>Performance side by side</h3><p>Follow spend, delivery, traffic and conversion metrics by platform, campaign and date range, using the data each platform reports.</p></div>
    <div class="sp-card"><span class="sp-tag">Planning</span><h3>Consistent naming and tracking</h3><p>Naming and UTM templates keep campaign names and tracking parameters consistent, so cross-platform reporting stays readable.</p></div>
    <div class="sp-card"><span class="sp-tag">Attention</span><h3>What needs you, in one list</h3><p>Control Center flags what needs attention across accounts, such as conversion tracking that can’t be verified.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="support-h"><div class="sp-wrap">
  <h2 id="support-h">What works on each platform</h2>
  <div class="sp-table-wrap"><table class="sp-table">
    <thead><tr><th scope="col">Platform</th><th scope="col">Create campaigns</th><th scope="col">Publish via API</th><th scope="col">Track performance</th><th scope="col">Autopilot rules</th></tr></thead>
    <tbody>
      <tr><th scope="row">Google Ads (Search, Performance Max, Demand Gen)</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
      <tr><th scope="row">Meta Ads (Facebook and Instagram)</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
      <tr><th scope="row">TikTok Ads</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-no">Not yet</td></tr>
      <tr><th scope="row">Pinterest Ads</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-no">Not yet</td></tr>
    </tbody>
  </table></div>
  <p>Performance tracking shows what each platform’s API reports; the available metrics and history differ by platform.</p>
</div></section>

<section class="sp-section" aria-labelledby="who-h"><div class="sp-wrap">
  <h2 id="who-h">Who it’s for</h2>
  <div class="sp-grid sp-grid-2">
    <div class="sp-card"><h3>Small businesses and founders</h3><p>You know your product, not every ad platform’s editor. Start from a description of what you sell and get campaigns built in each platform’s own structure.</p></div>
    <div class="sp-card"><h3>Marketers running several channels</h3><p>Keep briefs, naming, tracking and results for Google, Meta, TikTok and Pinterest in one place instead of four tabs and a spreadsheet.</p></div>
  </div>
</div></section>`,
  faq: [
    ['Can I manage Google Ads and Meta Ads together in OrivenAI?', '<p>Yes. Connect both accounts, create campaigns for each from the same workspace, publish them through each platform’s API, and follow their results side by side in Campaigns.</p>'],
    ['Does OrivenAI combine conversions from different platforms into one number?', '<p>No. Google, Meta, TikTok and Pinterest each attribute conversions in their own way, so adding them up would double-count. OrivenAI shows each platform’s reported results side by side instead.</p>'],
    ['Do I need an existing ad account on each platform?', '<p>You connect your own ad accounts through each platform’s sign-in. Campaigns are published to, and billed by, those accounts. OrivenAI charges only for its own plan and credits.</p>'],
    ['Does OrivenAI publish campaigns automatically?', '<p>No. Launching is always a manual step. Each draft shows its readiness, and you choose when to publish.</p>'],
    ['Is cross-platform management included in the Free plan?', '<p>Yes. Control Center, Create, Launch and Campaigns are included in the Free plan. Research and Autopilot are included from Starter.</p>'],
  ],
  related: ['/learn/how-to-manage-multiple-ad-platforms/', '/learn/google-ads-vs-meta-ads/', '/ppc-automation-software/', '/product/google-ads', '/product/meta-ads', '/pricing'],
  relatedTitle: 'Related',
  cta: { title: 'Run every platform from one workspace', text: 'Create, launch and track campaigns on the Free plan. No credit card needed to start.', label: 'Get Started Free' },
};
