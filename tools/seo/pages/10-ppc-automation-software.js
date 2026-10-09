// Commercial page — intent: "PPC automation software" (rule-based automation
// for paid search/social, with human control). Facts: Autopilot rules on
// Google Ads and Meta Ads (server.js AUTOPILOT_RULE_METRICS / ACTION_TYPES,
// the in-app description "rules on Meta and Google campaigns"), Starter+,
// at most once per day per rule, 25 credits per execution (autopilot.js).
module.exports = {
  path: '/ppc-automation-software/',
  kind: 'commercial',
  lastmod: '2026-10-09',
  title: 'PPC Automation Software with Rules You Control | OrivenAI',
  ogTitle: 'PPC automation software with rules you control',
  description: 'Automate routine PPC decisions on Google Ads and Meta Ads with OrivenAI Autopilot: rules that pause, resume or adjust budgets, notify you, or ask for approval first.',
  crumb: 'PPC automation software',
  teaser: 'Rules that pause, resume, adjust budgets or ask first, on Google Ads and Meta Ads.',
  eyebrow: 'PPC automation',
  h1: 'PPC automation software that keeps you in control',
  lede: 'OrivenAI Autopilot watches your Google Ads and Meta Ads campaigns and acts on the rules you write: pause what’s wasting budget, resume what recovers, shift budget, or simply tell you and wait for your approval.',
  secondary: { href: '/autopilot', label: 'See how Autopilot works' },
  heroNote: 'Autopilot is included from the Starter plan (€9.95/month). The Free plan covers creating, launching and tracking campaigns.',
  body: `
<section class="sp-section" aria-labelledby="why-h"><div class="sp-wrap">
  <h2 id="why-h">Why teams automate PPC, and where it goes wrong</h2>
  <p>Most paid-media work is repetitive: checking whether a campaign’s cost per acquisition drifted overnight, pausing an ad set that stopped converting, nudging budget toward the campaign that is working. Doing that by hand across platforms means either spending hours in dashboards or reacting a day late.</p>
  <p>Automation fixes the speed problem but creates a control problem. Opaque “AI optimizers” can change budgets you never meant to touch, and stacking several automations on one account makes it hard to know why something changed. OrivenAI takes the opposite approach: every automated action comes from a rule you can read, with limits you set, and an activity log of what happened.</p>
</div></section>

<section class="sp-section" aria-labelledby="what-h"><div class="sp-wrap">
  <h2 id="what-h">What OrivenAI automates</h2>
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">Conditions</span><h3>Rules on real campaign metrics</h3><p>Build conditions on ROAS, CPA, CPC, CTR, conversions, spend, clicks, impressions, budget or campaign status, for example “CPA above €40”.</p></div>
    <div class="sp-card"><span class="sp-tag">Actions</span><h3>Pause, resume and adjust budgets</h3><p>When a rule matches, Autopilot can pause or resume a campaign, or increase or decrease its budget on Google Ads and Meta Ads.</p></div>
    <div class="sp-card"><span class="sp-tag">Approval</span><h3>Notify or ask first</h3><p>Prefer to decide yourself? A rule can notify you or request approval instead of acting, so automation never outruns your judgment.</p></div>
    <div class="sp-card"><span class="sp-tag">Limits</span><h3>Built-in guardrails</h3><p>Each rule runs at most once per day, and each execution uses a fixed 25 credits, so costs and changes stay predictable.</p></div>
    <div class="sp-card"><span class="sp-tag">Visibility</span><h3>An activity log</h3><p>Autopilot shows what each rule did and when, so you can see why a campaign changed instead of guessing.</p></div>
    <div class="sp-card"><span class="sp-tag">Beyond rules</span><h3>Automated campaign building</h3><p>Before anything runs, Create turns a short brief into a platform-ready campaign: structure, ad copy, targeting and image or video creative.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="how-h"><div class="sp-wrap">
  <h2 id="how-h">How it works</h2>
  <ol class="sp-steps">
    <li><div><h3>Connect your ad accounts</h3><p>Connect Google Ads and Meta Ads through each platform’s own sign-in. OrivenAI works through the official APIs; nothing is scraped.</p></div></li>
    <li><div><h3>Create or pick a campaign</h3><p>Build a campaign in Create and publish it from Launch, or point a rule at a campaign that already runs in your account.</p></div></li>
    <li><div><h3>Write a rule</h3><p>Choose a metric, a threshold and an action, such as “if CPA is above €40, pause the campaign”, or “if ROAS is above 4, raise the budget”.</p></div></li>
    <li><div><h3>Start cautiously</h3><p>Begin with notify or approval rules. Once you trust a rule’s judgment, let it act on its own.</p></div></li>
    <li><div><h3>Review the activity</h3><p>Check Autopilot’s activity and Campaigns’ performance view to see what changed and whether it helped.</p></div></li>
  </ol>
</div></section>

<section class="sp-section" aria-labelledby="scope-h"><div class="sp-wrap">
  <h2 id="scope-h">What Autopilot does and doesn’t do</h2>
  <p>Being clear about limits is part of automating safely.</p>
  <div class="sp-table-wrap"><table class="sp-table">
    <thead><tr><th scope="col">Capability</th><th scope="col">Google Ads</th><th scope="col">Meta Ads</th><th scope="col">TikTok / Pinterest</th></tr></thead>
    <tbody>
      <tr><th scope="row">Pause / resume rules</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-no">Not yet</td></tr>
      <tr><th scope="row">Budget increase / decrease rules</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-no">Not yet</td></tr>
      <tr><th scope="row">Notify / ask for approval</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-no">Not yet</td></tr>
      <tr><th scope="row">Create and launch campaigns</th><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td><td class="sp-yes">Yes</td></tr>
    </tbody>
  </table></div>
  <p>Autopilot doesn’t bid in the auction or replace each platform’s own delivery systems, and it never launches campaigns on its own: launching is always a manual step you take in Launch.</p>
</div></section>`,
  faq: [
    ['What is PPC automation software?', '<p>PPC automation software applies changes to pay-per-click campaigns automatically, based on rules or models, so that routine decisions such as pausing poor performers or reallocating budget happen without someone checking every dashboard. Good automation keeps a human in charge of the limits.</p>'],
    ['Which platforms does OrivenAI Autopilot support?', '<p>Autopilot rules act on Google Ads and Meta Ads campaigns. OrivenAI also creates and launches campaigns on TikTok Ads and Pinterest Ads, but Autopilot rules don’t act on those platforms yet.</p>'],
    ['Can Autopilot spend more than I want?', '<p>Only through a budget rule you wrote yourself. Each rule runs at most once per day, and rules can be set to notify you or request approval instead of changing anything.</p>'],
    ['Is Autopilot included in the Free plan?', '<p>No. Autopilot is included from the Starter plan (€9.95/month, 1,000 credits a month). Each rule execution uses 25 credits. The Free plan covers creating, launching and tracking campaigns.</p>'],
    ['Does OrivenAI replace Google’s or Meta’s own optimization?', '<p>No. Bidding and delivery still run on each platform’s systems, such as smart bidding on Google Ads. OrivenAI automates the decisions around them: which campaigns run, how budgets move, and when you get involved.</p>'],
  ],
  related: ['/learn/what-is-ppc-automation/', '/learn/how-to-automate-google-ads-safely/', '/cross-platform-ad-management/', '/autopilot', '/pricing', '/learn/what-is-an-ai-advertising-platform/'],
  relatedTitle: 'Related',
  cta: { title: 'Create your first campaign for free', text: 'Build and launch on the Free plan; add Autopilot when you’re ready to automate.', label: 'Get Started Free' },
};
