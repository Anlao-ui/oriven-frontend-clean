// Solution page 3/5 — "From marketing plan to content".
// Facts: js/orivenPlan.js (Planning in Control Center: plans with status
// planned → briefed → building → live → completed, a monthly budget plan,
// naming/UTM templates; a plan becomes a brief and the brief prefills
// Create; nothing is generated or published from Planning, no AI call on
// page open), js/createFlow.js (six steps, structured brief).
// Honest scope: no automatic conversion of a plan into finished ads; the
// Progress page is live (2026-11).
const path = (items) => `<p class="sol__path" aria-label="Where it happens: ${items.join(', ')}">${items.map((x) => `<span>${x}</span>`).join('<i aria-hidden="true">&rarr;</i>')}</p>`;
module.exports = {
  path: '/solutions/plan-to-content',
  kind: 'commercial',
  lastmod: '2026-10-29',
  title: 'Turn Your Advertising Plan Into Ads | OrivenAI Solutions',
  ogTitle: 'From marketing plan to content',
  description: 'Build an advertising plan (what to advertise, when, where and with what budget), then turn each item into a brief that prefills ad creation in OrivenAI.',
  breadcrumbs: [{ name: 'Solutions', path: '/solutions' }],
  crumb: 'Plan to content',
  teaser: 'A plan becomes a brief that prefills Create.',
  eyebrow: 'Solution 03 · Plan to content',
  h1: 'Make the ads you planned, not the ads you had time for',
  lede: 'Plans written in a spreadsheet drift away from the ads that actually get made. In OrivenAI the Marketing Plan sits in Control Center, and each plan becomes a brief that prefills Create, so content starts from what you decided.',
  secondary: { href: '/business', label: 'Explore Control Center' },
  heroNote: 'Control Center and Create are included in every plan.',
  body: `
<section class="sp-section" aria-labelledby="problem-h"><div class="sp-wrap">
  <h2 id="problem-h">The problem: the plan and the content never meet</h2>
  <p>A good plan says what to promote, to whom, on which platform and with what budget. Then the week gets busy, and the ad is made from whatever is in front of you. The plan stays in a document, the budget is guessed again, and campaign names follow no pattern, which makes the results hard to compare later.</p>
</div></section>

<section class="sp-section" aria-labelledby="how-h"><div class="sp-wrap">
  <h2 id="how-h">How OrivenAI connects plan and content</h2>
  ${path(['Marketing Plan', 'Brief', 'Create', 'Launch'])}
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">Plan</span><h3>What, when, where and how much</h3><p>In the Marketing Plan you set what to advertise next, when, on which platforms, with what budget and for which goal and audience.</p></div>
    <div class="sp-card"><span class="sp-tag">Budget</span><h3>A monthly budget plan</h3><p>See what is planned this month against your budget before you create anything.</p></div>
    <div class="sp-card"><span class="sp-tag">Brief</span><h3>A plan becomes a brief</h3><p>When a plan is ready, it becomes a brief, and the brief prefills Create with what you planned, so you start from your decisions instead of a blank form.</p></div>
    <div class="sp-card"><span class="sp-tag">Consistency</span><h3>Naming and UTM templates</h3><p>Templates for campaign names and UTM tags keep campaigns consistent, so results stay comparable.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="flow-h"><div class="sp-wrap">
  <h2 id="flow-h">How a plan moves</h2>
  <ol class="sp-steps">
    <li><div><h3>Planned</h3><p>Add the idea to the Marketing Plan in <a href="/business">Control Center</a>, with its timing, platforms, budget, goal and audience.</p></div></li>
    <li><div><h3>Briefed</h3><p>Turn it into a brief. Nothing is generated yet, and nothing costs credits.</p></div></li>
    <li><div><h3>In progress</h3><p>Open the brief in <a href="/create">Create</a>, review the prefilled steps, choose an image or video format and create the ad.</p></div></li>
    <li><div><h3>Live, then completed</h3><p>Check and publish the draft in <a href="/launch">Launch</a>; follow it in <a href="/campaigns">Campaigns</a> until the plan is done.</p></div></li>
  </ol>
</div></section>

<section class="sp-section" aria-labelledby="who-h"><div class="sp-wrap">
  <h2 id="who-h">When it helps most</h2>
  <div class="sp-grid">
    <div class="sp-card"><h3>Seasonal campaigns</h3><p>Plan the spring menu or the holiday offer weeks ahead, then create from the plan when the time comes.</p></div>
    <div class="sp-card"><h3>Working to a monthly budget</h3><p>Spread a fixed budget across platforms and campaigns before committing to creative.</p></div>
    <div class="sp-card"><h3>More than one person making ads</h3><p>A shared brief and naming templates keep everyone’s work consistent.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="scope-h"><div class="sp-wrap">
  <h2 id="scope-h">What it doesn’t do</h2>
  <p>A plan doesn’t turn itself into finished ads: the brief prefills Create, and you review every step before anything is generated. Planning never publishes anything. The tasks of your Marketing Plan are tracked in Progress; campaign results over time are in Campaigns, and the Dashboard shows what needs you.</p>
</div></section>`,
  faq: [
    ['Does a plan create ads automatically?', '<p>No. A plan becomes a brief that prefills Create. You review the steps and choose to create the ad; credits are only used when something is generated.</p>'],
    ['Where is the Marketing Plan?', '<p>In Control Center, next to the Dashboard. It’s included in every plan.</p>'],
    ['Can I track progress against the plan?', '<p>Yes. Progress lists every task of your Marketing Plan and which are done; tasks OrivenAI can check tick off only when the result exists. Dated plans on the Planning tab also have a status from planned to completed, and campaign results are in Campaigns.</p>'],
  ],
  related: ['/solutions/research-before-creation', '/solutions/advertising-campaigns', '/solutions/connected-workflow', '/solutions/structured-automation', '/business', '/create'],
  relatedTitle: 'Other solutions and sections',
  ctaEyebrow: 'Solutions',
  ctaSecondary: ['/create', 'Explore Create'],
  cta: { title: 'Plan it, then make it', text: 'Plan your next campaign in Control Center and create it from the brief.', label: 'Get started' },
};
