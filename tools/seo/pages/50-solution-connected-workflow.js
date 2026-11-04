// Solution page 1/5 — "One connected marketing workflow".
// Facts: the six sections in the app (app.html sidebar: Control Center,
// Research, Create, Launch, Campaigns, Automations), what each one does
// (tools/seo/product-pages.js), the plans (facts.js): one product in every plan.
// Honest scope: nothing runs the whole chain for you; Progress and
// My Content are in development; there is no separate Tasks page.
const path = (items) => `<p class="sol__path" aria-label="Where it happens: ${items.join(', ')}">${items.map((x) => `<span>${x}</span>`).join('<i aria-hidden="true">&rarr;</i>')}</p>`;
const F = require('../facts');
module.exports = {
  path: '/solutions/connected-workflow',
  kind: 'commercial',
  lastmod: '2026-10-29',
  title: 'One Connected Marketing Workflow | OrivenAI Solutions',
  ogTitle: 'One connected marketing workflow',
  description: 'Research, plan, create, launch, follow and automate your advertising in six connected sections, instead of a separate tool for every step.',
  breadcrumbs: [{ name: 'Solutions', path: '/solutions' }],
  crumb: 'Connected workflow',
  teaser: 'Six sections that build on each other instead of a tool for every step.',
  eyebrow: 'Solution 01 · Connected workflow',
  h1: 'Stop rebuilding context in every tool',
  lede: 'Research in one tab, a plan in a document, ads in another tool and results in a fourth: every step starts from scratch. OrivenAI keeps the whole advertising workflow in six sections that share the same business context.',
  secondary: { href: '/product', label: 'See the six sections' },
  heroNote: 'Every plan includes all six sections; plans differ only in period, price and credits.',
  body: `
<section class="sp-section" aria-labelledby="problem-h"><div class="sp-wrap">
  <h2 id="problem-h">The problem: every step lives somewhere else</h2>
  <p>Small teams rarely lack ideas. What slows them down is the gaps between steps. Research findings sit in a document nobody reopens, the plan is a spreadsheet, the ad copy is written without either of them, and results are read in four ad managers that don’t talk to each other. Each step re-explains the business from the beginning, and nothing learned at the end flows back to the start.</p>
</div></section>

<section class="sp-section" aria-labelledby="how-h"><div class="sp-wrap">
  <h2 id="how-h">How OrivenAI connects the steps</h2>
  ${path(['Control Center', 'Research', 'Create', 'Launch', 'Campaigns', 'Automations'])}
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">01 · Start</span><h3><a href="/business">Control Center</a></h3><p>The Dashboard shows what is running, what needs you and what to do next. The Marketing Plan holds what you will advertise, when and with what budget. Your business profile and brand live here too.</p></div>
    <div class="sp-card"><span class="sp-tag">02 · Learn</span><h3><a href="/research">Research</a></h3><p>Investigate your market, competitors, audience or opportunities before you spend. Reports are kept in your research library.</p></div>
    <div class="sp-card"><span class="sp-tag">03 · Make</span><h3><a href="/create">Create</a></h3><p>Image and video ads for Google, Meta, TikTok and Pinterest, built in six short steps from your business context.</p></div>
    <div class="sp-card"><span class="sp-tag">04 · Publish</span><h3><a href="/launch">Launch</a></h3><p>Every draft is checked against what the platform needs. Publishing creates the campaign paused, so you decide when it starts.</p></div>
    <div class="sp-card"><span class="sp-tag">05 · Follow</span><h3><a href="/campaigns">Campaigns</a></h3><p>Spend, clicks, CTR, CPA and ROAS from every connected platform in one view.</p></div>
    <div class="sp-card"><span class="sp-tag">06 · Keep going</span><h3><a href="/autopilot">Automations</a></h3><p>Schedules and rules for published campaigns that notify you, ask first or act within limits you set.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="flow-h"><div class="sp-wrap">
  <h2 id="flow-h">What “connected” means in practice</h2>
  <ol class="sp-steps">
    <li><div><h3>Context is entered once</h3><p>Your business profile, brand, audiences and competitors are set up in Control Center and used by Research and Create, so you don’t re-type them for every ad.</p></div></li>
    <li><div><h3>A plan becomes a brief</h3><p>A Marketing Plan item becomes a brief that prefills Create, so the ad starts from what you planned.</p></div></li>
    <li><div><h3>Drafts move to Launch</h3><p>What you create appears in Launch as a draft with its readiness, ready to check and publish.</p></div></li>
    <li><div><h3>Results come back to the start</h3><p>Campaign results appear on the Dashboard, items that need you are listed in Needs you, and Automations rules can watch the same figures.</p></div></li>
  </ol>
</div></section>

<section class="sp-section" aria-labelledby="who-h"><div class="sp-wrap">
  <h2 id="who-h">Who it’s for</h2>
  <div class="sp-grid">
    <div class="sp-card"><h3>Owners who run their own ads</h3><p>One place to see what is running and what to do next, without learning four ad managers.</p></div>
    <div class="sp-card"><h3>Small marketing teams</h3><p>Plan, make and publish from the same context, so the next campaign builds on the last one.</p></div>
    <div class="sp-card"><h3>Anyone advertising on more than one platform</h3><p>Google Ads, Meta Ads, TikTok Ads and Pinterest Ads, connected over OAuth and followed in one view.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="scope-h"><div class="sp-wrap">
  <h2 id="scope-h">What it doesn’t do</h2>
  <p>Connected doesn’t mean automatic. You move between the sections yourself: nothing researches, plans, creates and publishes on your behalf in one go, and every campaign is created paused. Two pages in the structure are still in development: Progress in Control Center and My Content in Create. Today your to-dos live on the Dashboard (Needs you and the Get set up checklist), not on a separate Tasks page.</p>
</div></section>`,
  faq: [
    ['Do I have to use all six sections?', '<p>No. Each section works on its own, and every plan includes all six, so you use what you need.</p>'],
    ['Does OrivenAI run my whole workflow automatically?', '<p>No. The sections share context, but you take each step yourself. Campaigns are created paused, and Automations only act on schedules and rules you switch on.</p>'],
    ['Which ad platforms are connected?', '<p>Google Ads, Meta Ads (Facebook and Instagram), TikTok Ads and Pinterest Ads, each through its official API over OAuth.</p>'],
  ],
  related: ['/solutions/research-before-creation', '/solutions/plan-to-content', '/solutions/advertising-campaigns', '/solutions/structured-automation', '/product', '/business'],
  relatedTitle: 'Other solutions and sections',
  ctaEyebrow: 'Solutions',
  ctaSecondary: ['/business', 'Start with Control Center'],
  cta: { title: 'Put the whole workflow in one place', text: 'Every plan includes all six sections, from ' + F.fromPrice + ' for 14 days.', label: 'Get started' },
};
