// Solution page 2/5 — "Research before you create".
// Facts: js/research.js (four research types, context from the business
// profile / website / attachments, real job stages, saved library with
// rename/delete, confidence labels, sources read, limits and assumptions),
// credits per report from facts.js; included in every plan (planEntitlements).
// Honest scope: Insights is the library inside Research, not its own page;
// findings are labelled by support, never presented as guaranteed; Research
// doesn't pull competitors' ads or performance data.
const path = (items) => `<p class="sol__path" aria-label="Where it happens: ${items.join(', ')}">${items.map((x) => `<span>${x}</span>`).join('<i aria-hidden="true">&rarr;</i>')}</p>`;
const F = require('../facts');
module.exports = {
  path: '/solutions/research-before-creation',
  kind: 'commercial',
  lastmod: '2026-10-29',
  title: 'Market Research for Advertising | OrivenAI Solutions',
  ogTitle: 'Research before you create',
  description: 'Market research for advertising: investigate your market, competitors and audience before you spend, with every finding marked by how well it is supported.',
  breadcrumbs: [{ name: 'Solutions', path: '/solutions' }],
  crumb: 'Research before creation',
  teaser: 'Know your market, competitors and audience before you spend.',
  eyebrow: 'Solution 02 · Research first',
  h1: 'Market research before you spend on ads',
  lede: 'Most ads are written from a hunch. OrivenAI Research investigates your market, competitors and audience first, and tells you how well each finding is supported, so your plan and your ads start from evidence rather than guesswork.',
  secondary: { href: '/research', label: 'Explore Research' },
  heroNote: 'Research is included in every plan. A report costs ' + F.costs.researchRun + ' credits.',
  body: `
<section class="sp-section" aria-labelledby="problem-h"><div class="sp-wrap">
  <h2 id="problem-h">The problem: ads built on assumptions</h2>
  <p>When there is no time to look at the market, an ad is built on what you assume your customers want and what you think competitors say. Sometimes that works. Often the budget is spent before anyone learns the assumption was wrong. Desk research helps, but it takes hours, and the notes rarely make it into the ad itself.</p>
</div></section>

<section class="sp-section" aria-labelledby="how-h"><div class="sp-wrap">
  <h2 id="how-h">How OrivenAI helps</h2>
  ${path(['Research', 'Insights (in Research)', 'Marketing Plan', 'Create'])}
  <div class="sp-grid">
    <div class="sp-card"><span class="sp-tag">Four kinds</span><h3>Ask the question you actually have</h3><p>Choose market, competitor, audience or opportunity research, and ask in your own words, for example “How do premium coffee roasters advertise in Amsterdam?”.</p></div>
    <div class="sp-card"><span class="sp-tag">Your context</span><h3>Specific to your business</h3><p>Research uses your business profile and website, and anything you attach, so findings fit your market rather than a generic one.</p></div>
    <div class="sp-card"><span class="sp-tag">Honest labels</span><h3>How sure each finding is</h3><p>Reports show the sources that were read, how confident each finding is, and the limits and assumptions behind it, so you can tell what is established from what is worth testing.</p></div>
    <div class="sp-card"><span class="sp-tag">Insights</span><h3>A library you can come back to</h3><p>Every report is saved. Reopen, rename or delete it later. Today this library is part of the Research page, not a page of its own.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="flow-h"><div class="sp-wrap">
  <h2 id="flow-h">From research to your next ad</h2>
  <ol class="sp-steps">
    <li><div><h3>Ask</h3><p>Pick a research type and write your question in <a href="/research">Research</a>. You can leave the page while it runs; the job keeps going and lands in your library.</p></div></li>
    <li><div><h3>Read what is supported</h3><p>Separate the well-supported findings from the ideas to test.</p></div></li>
    <li><div><h3>Plan</h3><p>Turn what you learned into an item in the Marketing Plan in <a href="/business">Control Center</a>: what to advertise, when, where and with what budget.</p></div></li>
    <li><div><h3>Create</h3><p>Build the ad in <a href="/create">Create</a> from your plan and business context, then check and publish it in Launch.</p></div></li>
  </ol>
</div></section>

<section class="sp-section" aria-labelledby="who-h"><div class="sp-wrap">
  <h2 id="who-h">When it helps most</h2>
  <div class="sp-grid">
    <div class="sp-card"><h3>Entering a new market</h3><p>Market research on demand, trends and the competitive landscape before the first campaign.</p></div>
    <div class="sp-card"><h3>Repositioning against competitors</h3><p>Competitor research on how others position themselves, price and communicate, and where the gaps are.</p></div>
    <div class="sp-card"><h3>Writing for a new audience</h3><p>Audience research on needs, problems, motives and objections, to shape the message before the creative.</p></div>
  </div>
</div></section>

<section class="sp-section" aria-labelledby="scope-h"><div class="sp-wrap">
  <h2 id="scope-h">What Research doesn’t do</h2>
  <p>Research reads public pages and the context you give it; it doesn’t guarantee that a finding is correct, and it says so. It doesn’t pull ads from platform ad libraries or show how competitors’ ads perform: it points you to the official libraries so you can look yourself. Choosing what to act on stays with you.</p>
</div></section>`,
  faq: [
    ['Is every research finding verified?', '<p>No, and the report doesn’t pretend it is. Each finding is marked by how well it is supported and comes with the sources read, its limits and its assumptions.</p>'],
    ['Where are my research reports kept?', '<p>In your research library on the Research page, which we call Insights. You can reopen, rename or delete reports there.</p>'],
    ['Is Research included in every plan?', '<p>Yes. OrivenAI has no free plan, and every paid plan includes Research. A report costs ' + F.costs.researchRun + ' credits.</p>'],
  ],
  related: ['/solutions/plan-to-content', '/solutions/connected-workflow', '/solutions/advertising-campaigns', '/solutions/structured-automation', '/research', '/learn/how-to-research-competitor-ads/'],
  relatedTitle: 'Other solutions and guides',
  ctaEyebrow: 'Solutions',
  ctaSecondary: ['/research', 'Explore Research'],
  cta: { title: 'Start your next campaign with research', text: 'Run market, competitor, audience or opportunity research with any plan, and keep every report in your library.', label: 'Get started' },
};
