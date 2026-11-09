// Solution page 5/5 — "More structure, less repetitive work".
// Facts: js/automations.js (Overview · Scheduler · Rules · Activity; rules
// watch real campaign data and notify, ask first or act automatically
// within limits; schedules switch published campaigns on/off at set times,
// also when you're offline; one switch pauses all; Activity filters by
// completed / partly done / failed / skipped / cancelled / pending approval;
// history stays after deletion), credits once per new automation (facts.js) with
// free checks and changes, every plan. Shared Google
// Ads budgets and lifetime budgets are never changed; TikTok has no ROAS
// rules (10-ppc-automation-software.js). Building and publishing stay manual.
const path = (items) => `<p class="sol__path" aria-label="Where it happens: ${items.join(', ')}">${items.map((x) => `<span>${x}</span>`).join('<i aria-hidden="true">&rarr;</i>')}</p>`;
const F = require('../facts');
module.exports = {
  path: '/solutions/structured-automation',
  kind: 'commercial',
  lastmod: '2026-10-29',
  title: 'Automate Repetitive Ad Work With Rules | OrivenAI Solutions',
  ogTitle: 'More structure, less repetitive work',
  description: 'Schedules and rules for your published campaigns that notify you, ask first or act within limits you set, with a record of everything they did.',
  breadcrumbs: [{ name: 'Solutions', path: '/solutions' }],
  crumb: 'Structured automation',
  teaser: 'Schedules and rules for published campaigns, within your limits.',
  eyebrow: 'Solution 05 · Structured automation',
  h1: 'Hand the routine checks to rules you can read',
  lede: 'Switching campaigns on in the morning, checking overnight cost per result, pausing what stopped converting: the same checks, every week. OrivenAI Automations take the repetitive part, only in the way you set up, and keep a record of everything they did.',
  secondary: { href: '/autopilot', label: 'Explore Automations' },
  heroNote: 'Automations are included in every plan. A new automation costs ' + F.costs.automationCreate + ' credits once; its checks and changes are free.',
  body: `
<section class="sp-section" aria-labelledby="problem-h"><div class="sp-wrap">
  <h2 id="problem-h">The problem: the same checks, every day</h2>
  <p>Much of running ads is routine: is the campaign on during opening hours, did cost per result drift overnight, is something spending without converting. Done by hand it takes time and happens late. Handed to an opaque optimiser, it changes things you can’t explain. The useful middle ground is automation you can read, with limits, and a log.</p>
</div></section>

<section class="sp-section" aria-labelledby="how-h"><div class="sp-wrap">
  <h2 id="how-h">How OrivenAI adds structure</h2>
  ${path(['Scheduler', 'Rules', 'Activity'])}
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">Scheduler</span><h3>On and off at set times</h3><p>Switch published campaigns on or off at the times you choose, for example during business hours, also when you’re offline.</p></div>
    <div class="sp-card"><span class="sp-tag">Rules</span><h3>React to real campaign data</h3><p>Watch spend, cost per result or ROAS, and react when a condition is met, such as “if CPA is above €25 over 7 days, lower the budget by 15%”.</p></div>
    <div class="sp-card"><span class="sp-tag">Control</span><h3>Notify, ask first or act</h3><p>Every rule either notifies you, asks for your approval, or acts within the limits you set. One switch pauses all automations.</p></div>
    <div class="sp-card"><span class="sp-tag">Activity History</span><h3>A record of every run</h3><p>The Activity tab lists each run with its result: completed, partly done, failed, skipped, cancelled or pending approval. History stays after an automation is deleted.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="flow-h"><div class="sp-wrap">
  <h2 id="flow-h">Starting safely</h2>
  <ol class="sp-steps">
    <li><div><h3>Publish first</h3><p>Automations work on campaigns that already run in your connected ad accounts. Building and publishing happens in <a href="/create">Create</a> and <a href="/launch">Launch</a>.</p></div></li>
    <li><div><h3>Start with a schedule or a notify-only rule</h3><p>See what a rule would do before letting it change anything.</p></div></li>
    <li><div><h3>Move to “asks first”</h3><p>Approve or reject each change in Automations; Needs you on the <a href="/business">Control Center</a> Dashboard tells you when one is waiting.</p></div></li>
    <li><div><h3>Let it act within limits</h3><p>Once you trust a rule, let it act automatically, within the budget limits you set, and check <a href="/autopilot">Activity</a> to see what changed.</p></div></li>
  </ol>
</div></section>

<section class="sp-section" aria-labelledby="who-h"><div class="sp-wrap">
  <h2 id="who-h">When it helps most</h2>
  <div class="sp-grid">
    <div class="sp-card"><h3>Opening hours</h3><p>A shop or café that only wants ads running while it can serve customers.</p></div>
    <div class="sp-card"><h3>Cost guardrails</h3><p>Lower a budget when cost per result climbs, or get told first.</p></div>
    <div class="sp-card"><h3>Weekly routine</h3><p>Replace the Monday check of every campaign with rules and a log you can scan.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="scope-h"><div class="sp-wrap">
  <h2 id="scope-h">What is automated, and what isn’t</h2>
  <p>Automated, once you switch it on: schedules, and rules that pause, resume or adjust daily budgets, or notify you. Not automated: researching, planning, creating and publishing campaigns, which stay steps you take yourself. Shared Google Ads budgets and lifetime budgets are never changed, and TikTok doesn’t report return on ad spend, so ROAS rules aren’t offered there. OrivenAI doesn’t run your whole marketing operation.</p>
</div></section>`,
  faq: [
    ['Will an automation change something I didn’t ask for?', '<p>No. Automations only act on schedules and rules you switched on, and a rule can be set to notify you or ask first instead of acting.</p>'],
    ['Can I see what an automation did?', '<p>Yes. The Activity tab shows every run with its result, and history stays after an automation is deleted.</p>'],
    ['Are Automations included in every plan?', '<p>Yes. OrivenAI has no free plan, and every paid plan includes Automations. A new automation costs ' + F.costs.automationCreate + ' credits once; its checks and changes are free.</p>'],
  ],
  related: ['/solutions/advertising-campaigns', '/solutions/connected-workflow', '/solutions/research-before-creation', '/solutions/plan-to-content', '/autopilot', '/ppc-automation-software/'],
  relatedTitle: 'Other solutions and guides',
  ctaEyebrow: 'Solutions',
  ctaSecondary: ['/autopilot', 'Explore Automations'],
  cta: { title: 'Automate the routine, keep the decisions', text: 'Every plan includes Automations, from ' + F.fromPrice + ' for 14 days.', label: 'Get started' },
};
