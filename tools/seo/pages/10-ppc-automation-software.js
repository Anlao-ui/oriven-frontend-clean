// Commercial page — intent: "PPC automation software" (rule-based automation
// for paid search/social, with human control). Facts: Automations engine
// (server services/automations/*: metrics.js, budget.js, platforms.js,
// limits.js), Starter+, 50 credits once per new automation; checks and
// changes are free. Platform support is implemented for all four networks
// (mock-tested; see the Automations report for live-verification status).
module.exports = {
  path: '/ppc-automation-software/',
  kind: 'commercial',
  lastmod: '2026-10-09',
  title: 'PPC Automation Software with Rules You Control | OrivenAI',
  ogTitle: 'PPC automation software with rules you control',
  description: 'Automate routine PPC decisions on Google Ads and Meta Ads with rules that pause, resume or adjust budgets, notify you, or ask for approval first.',
  crumb: 'PPC automation software',
  teaser: 'Rules that pause, resume, adjust budgets or ask first, on Google Ads and Meta Ads.',
  eyebrow: 'PPC automation',
  h1: 'PPC automation software that keeps you in control',
  lede: 'OrivenAI Automations schedule your campaigns and watch their performance, then act on the rules you write: pause what’s wasting budget, resume what recovers, adjust budget within limits, or simply tell you and wait for your approval.',
  secondary: { href: '/autopilot', label: 'See how Automations work' },
  heroNote: 'Automations are included from the Starter plan (€9.95/month). The Free plan covers creating, launching and tracking campaigns.',
  body: `
<section class="sp-section" aria-labelledby="why-h"><div class="sp-wrap">
  <h2 id="why-h">Why teams automate PPC, and where it goes wrong</h2>
  <p>Most paid-media work is repetitive: checking whether a campaign’s cost per acquisition drifted overnight, pausing an ad set that stopped converting, nudging budget toward the campaign that is working. Doing that by hand across platforms means either spending hours in dashboards or reacting a day late.</p>
  <p>Automation fixes the speed problem but creates a control problem. Opaque “AI optimizers” can change budgets you never meant to touch, and stacking several automations on one account makes it hard to know why something changed. OrivenAI takes the opposite approach: every automated action comes from a rule you can read, with limits you set, and an activity log of what happened.</p>
</div></section>

<section class="sp-section" aria-labelledby="what-h"><div class="sp-wrap">
  <h2 id="what-h">What OrivenAI automates</h2>
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">Conditions</span><h3>Rules on real campaign metrics</h3><p>Build conditions on spend, impressions, clicks, CTR, CPC, conversions, CPA, ROAS or campaign status, for example “CPA above €40 over the last 7 days”. Missing data is never treated as zero, and rules wait for enough data before acting.</p></div>
    <div class="sp-card"><span class="sp-tag">Actions</span><h3>Pause, resume and adjust budgets</h3><p>When a rule matches, an automation can pause or resume a campaign, or increase or decrease its daily budget. Schedules switch campaigns on, pause, resume or stop them at the times you choose.</p></div>
    <div class="sp-card"><span class="sp-tag">Approval</span><h3>Notify or ask first</h3><p>Prefer to decide yourself? A rule can notify you or request approval instead of acting, so automation never outruns your judgment.</p></div>
    <div class="sp-card"><span class="sp-tag">Limits</span><h3>Built-in guardrails</h3><p>Budget rules need a maximum budget and are limited per change, per day and over several days. Creating an automation costs 50 credits once; its checks and changes don’t use credits.</p></div>
    <div class="sp-card"><span class="sp-tag">Visibility</span><h3>An activity log</h3><p>Automations show what each rule or schedule did and when, with the values before and after, so you can see why a campaign changed instead of guessing.</p></div>
    <div class="sp-card"><span class="sp-tag">Beyond rules</span><h3>Automated campaign building</h3><p>Before anything runs, Create turns a short brief into a platform-ready campaign: structure, ad copy, targeting and image or video creative.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="how-h"><div class="sp-wrap">
  <h2 id="how-h">How it works</h2>
  <ol class="sp-steps">
    <li><div><h3>Connect your ad accounts</h3><p>Connect Google Ads, Meta Ads, TikTok Ads or Pinterest Ads through each platform’s own sign-in. OrivenAI works through the official APIs; nothing is scraped.</p></div></li>
    <li><div><h3>Create or pick a campaign</h3><p>Build a campaign in Create and publish it from Launch, or point a rule at a campaign that already runs in your account.</p></div></li>
    <li><div><h3>Write a rule</h3><p>Choose a metric, a threshold and an action, such as “if CPA is above €40, pause the campaign”, or “if ROAS is above 4, raise the budget”.</p></div></li>
    <li><div><h3>Start cautiously</h3><p>Begin with notify or approval rules. Once you trust a rule’s judgment, let it act on its own.</p></div></li>
    <li><div><h3>Review the activity</h3><p>Check the Automations activity and Campaigns’ performance view to see what changed and whether it helped.</p></div></li>
  </ol>
</div></section>

<section class="sp-section" aria-labelledby="scope-h"><div class="sp-wrap">
  <h2 id="scope-h">What Automations do and don’t do</h2>
  <p>Being clear about limits is part of automating safely.</p>
  <div class="sp-table-wrap"><table class="sp-table">
    <thead><tr><th scope="col">Capability</th><th scope="col">Google Ads</th><th scope="col">Meta Ads</th><th scope="col">TikTok / Pinterest</th></tr></thead>
    <tbody>
      <tr><th scope="row">Schedules (switch on, pause, resume, stop)</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
      <tr><th scope="row">Pause / resume rules</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
      <tr><th scope="row">Daily budget increase / decrease rules</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
      <tr><th scope="row">Notify / ask for approval</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
      <tr><th scope="row">Create and launch campaigns</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
    </tbody>
  </table></div>
  <p>What can change depends on how each campaign is set up: shared Google Ads budgets and lifetime budgets are never changed, and TikTok doesn’t report return on ad spend, so ROAS rules aren’t offered there.</p>
  <p>Automations don’t bid in the auction or replace each platform’s own delivery systems, and they never build or publish campaigns: that is always a step you take in Launch.</p>
</div></section>`,
  faq: [
    ['What is PPC automation software?', '<p>PPC automation software applies changes to pay-per-click campaigns automatically, based on rules or models, so that routine decisions such as pausing poor performers or reallocating budget happen without someone checking every dashboard. Good automation keeps a human in charge of the limits.</p>'],
    ['Which platforms do OrivenAI Automations support?', '<p>Automations are built for campaigns in connected Google Ads, Meta Ads, TikTok Ads and Pinterest Ads accounts. What can change depends on how each campaign is set up: shared Google Ads budgets and lifetime budgets are never changed, and TikTok doesn’t report return on ad spend, so ROAS rules aren’t offered there.</p>'],
    ['Can an automation spend more than I want?', '<p>Only through a budget rule you wrote yourself, never above the maximum budget you set, and only automatically after you confirm it may act on its own. Rules can also notify you or request approval instead of changing anything.</p>'],
    ['Are Automations included in the Free plan?', '<p>No. Automations are included from the Starter plan (€9.95/month, 1,000 credits a month). Creating an automation costs 50 credits once; its checks and changes don’t use credits. The Free plan covers creating, launching and tracking campaigns.</p>'],
    ['Does OrivenAI replace Google’s or Meta’s own optimization?', '<p>No. Bidding and delivery still run on each platform’s systems, such as smart bidding on Google Ads. OrivenAI automates the decisions around them: which campaigns run, how budgets move, and when you get involved.</p>'],
  ],
  related: ['/learn/what-is-ppc-automation/', '/learn/how-to-automate-google-ads-safely/', '/cross-platform-ad-management/', '/autopilot', '/pricing', '/learn/what-is-an-ai-advertising-platform/'],
  relatedTitle: 'Related',
  cta: { title: 'Create your first campaign for free', text: 'Build and launch on the Free plan; add Automations when you’re ready to automate.', label: 'Get Started Free' },
};
