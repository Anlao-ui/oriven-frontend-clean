// ════════════════════════════════════════════════════════════════
// "Inside <section>": the pages of each of the six sections, for the six
// product views in index.html (Control Center, Research, Create, Launch,
// Campaigns, Automations), plus the five Solutions concepts.
// Inserted by tools/seo/apply-product-depth.js between <!-- pages:start -->
// and <!-- pages:end --> (and <!-- solutions:start/end -->). Behaviour:
// js/section-pages.js. Styles: css/site-chrome.css (.pp, .pm).
//
// Accuracy (checked against the app, 2026-11-10: js/appNav.js and each page's module):
//   status 'live' = a page or tab that exists today
//   status 'part' = exists, but inside another page (where says which)
//   status 'dev'  = not in the app yet; the copy says what exists instead
// Control Center has no Tasks page: the to-dos are "Needs you" and the
// "Get set up" checklist on the Dashboard (js/controlCenter.js).
// The mock-ups are illustrations (labelled), never working controls.
// ════════════════════════════════════════════════════════════════

// ── Mock-up primitives (pure markup, aria-hidden) ──
const C = require('./facts').costs; // credit costs from js/plans.js, never retyped
const row = (inner, i) => `<div class="pm-row" style="--m:${i}">${inner}</div>`;
const chip = (t, k = '') => `<span class="pm-chip${k ? ' pm-chip--' + k : ''}">${t}</span>`;
const dot = (k = '') => `<i class="pm-dot${k ? ' pm-dot--' + k : ''}"></i>`;
const txt = (t, k = '') => `<span class="pm-t${k ? ' pm-t--' + k : ''}">${t}</span>`;
const bar = (w, k = '') => `<span class="pm-bar${k ? ' pm-bar--' + k : ''}"><i style="--w:${w}%"></i></span>`;
const kpis = (list, i) => `<div class="pm-kpis" style="--m:${i}">${list.map(([l, v]) => `<div class="pm-kpi"><span>${l}</span><b>${v}</b></div>`).join('')}</div>`;
const win = (title, body) => `<div class="pm" aria-hidden="true"><div class="pm-bar-top"><i></i><i></i><i></i><span>${title}</span></div><div class="pm-body">${body}</div></div>`;
const devBox = (title, lines) => `<div class="pm pm--dev" aria-hidden="true"><div class="pm-dev"><span class="pm-dev__k">In development</span><b>${title}</b>${lines.map((l) => `<span>${l}</span>`).join('')}</div></div>`;

const MOCK = {
  dashboard: win('Control Center · Dashboard',
    row(txt('Good morning', 'h') + txt('2 campaigns running · 1 draft · 2 things need you', 'm'), 0) +
    row(txt('Needs you', 'k'), 1) +
    row(dot('warn') + txt('An automation change is waiting for your approval') + chip('Review'), 2) +
    row(dot('ok') + txt('“Spring menu” is ready to launch') + chip('Review'), 3) +
    kpis([['Spend', '€184'], ['Conversions', '23'], ['CPA', '€8.00'], ['ROAS', '3.1']], 4) +
    row(txt('Get set up', 'k') + bar(66) + txt('2 of 3 done', 'm'), 5)),
  plan: win('Control Center · Marketing Plan',
    row(txt('This month', 'k') + bar(58) + txt('€232 of €400 planned', 'm'), 0) +
    row(txt('Morning offer · Google Search') + chip('Live', 'ok'), 1) +
    row(txt('Weekend menu · Meta') + chip('Briefed', 'volt'), 2) +
    row(txt('Autumn launch · TikTok') + chip('Planned'), 3) +
    row(txt('Brief → prefills Create', 'm'), 4)),
  progress: win('Control Center · Progress',
    row(txt('Week 1', 'k') + bar(100) + txt('3 of 3 done', 'm'), 0) +
    row(txt('Week 2', 'k') + bar(40) + txt('2 of 5 done', 'm'), 1) +
    row(txt('Week 3', 'k') + bar(0) + txt('Upcoming', 'm'), 2)),
  research: win('Research',
    row(txt('How do premium coffee roasters advertise in Amsterdam?', 'q'), 0) +
    row(chip('Market') + chip('Competitor', 'volt') + chip('Audience') + chip('Opportunity'), 1) +
    row(txt('Researching', 'k') + bar(72, 'volt') + txt('Reading sources', 'm'), 2) +
    row(txt('You can leave this page; the research keeps going.', 'm'), 3)),
  insights: win('Research · Library',
    row(txt('Competitor research · 3 roasters') + txt('2 d ago', 'm'), 0) +
    row(dot('ok') + txt('Moderate confidence') + txt('Checked against the sources it read', 'm'), 1) +
    row(dot() + txt('Low confidence · an idea to test') + txt('Limits and assumptions listed', 'm'), 2) +
    row(txt('Audience research · remote workers') + txt('5 d ago', 'm'), 3)),
  create: win('Create',
    `<div class="pm-steps" style="--m:0">${['Product', 'Platform', 'Goal', 'Format', 'Customise', 'Review'].map((s, i) => `<span class="${i < 3 ? 'is-done' : i === 3 ? 'is-on' : ''}">${i + 1} ${s}</span>`).join('')}</div>` +
    row(txt('Format', 'k'), 1) +
    row(chip('Image ad', 'volt') + chip('Video ad') + chip('Unsupported: shown disabled', 'off'), 2) +
    row(txt('Copy in your brand voice · then to Launch as a draft', 'm'), 3)),
  content: win('Create · My Content',
    row(chip('Images') + chip('Videos') + chip('Ad text'), 0) +
    row(dot('ok') + txt('Autumn candles · image') + txt('Saved', 'm'), 1) +
    row(dot('ok') + txt('Spring offer · 5-second video') + txt('Saved', 'm'), 2)),
  competitors: win('Research · Competitor Analysis',
    row(txt('Your competitors', 'k') + txt('3', 'm'), 0) +
    row(dot('ok') + txt('Positioning: handmade, local') + chip('Public source'), 1) +
    row(dot() + txt('Offer: free shipping over €40') + chip('AI analysis'), 2)),
  testing: win('Create · Creative Testing',
    row(chip('Hook A') + chip('Hook B') + chip('Hook C'), 0) +
    row(txt('Side by side', 'k') + bar(66) + txt('3 versions', 'm'), 1) +
    row(dot('ok') + txt('Kept: “Slow evenings”') + txt('Saved', 'm'), 2)),
  audiences: win('Launch · Audience Builder',
    row(txt('Remote workers within 3 km') + chip('Saved'), 0) +
    row(txt('Meta', 'k') + txt('Age 24–40 · interests: coffee, coworking', 'm'), 1) +
    row(txt('Google', 'k') + txt('Keywords: coffee near me', 'm'), 2)),
  compare: win('Campaigns · Comparison',
    kpis([['CTR A', '1.9%'], ['CTR B', '1.2%'], ['CPA A', '€8.40']], 0) +
    row(txt('Same period · same currency', 'm'), 1)),
  adstudio: win('Launch',
    row(txt('Spring menu · Meta') + chip('Ready', 'ok'), 0) +
    row(txt('Morning offer · Google') + chip('Check warnings', 'warn'), 1) +
    row(txt('Store opening · TikTok') + chip('Blocked: add a landing page', 'bad'), 2) +
    row(txt('Publish → created paused on the platform', 'm'), 3)),
  overview: win('Campaigns',
    kpis([['Spend', '€412'], ['Clicks', '1,208'], ['CTR', '2.4%'], ['CPA', '€9.10']], 0) +
    `<div class="pm-chart" style="--m:1"><svg viewBox="0 0 200 48" preserveAspectRatio="none"><polyline points="0,40 25,34 50,36 75,26 100,28 125,18 150,22 175,12 200,14"/></svg></div>` +
    row(txt('Morning offer · Google') + chip('Live', 'ok') + txt('€6.80 CPA', 'm'), 2) +
    row(txt('Weekend menu · Meta') + chip('Paused') + txt('€11.20 CPA', 'm'), 3)),
  builder: win('Campaign workspace',
    row(txt('Structure') + txt('1 campaign · 2 ad groups', 'm'), 0) +
    row(txt('Targeting') + txt('Amsterdam · 25–44', 'm'), 1) +
    row(txt('Budget') + txt('€15 a day', 'm'), 2) +
    row(txt('Ads') + txt('3 headlines · 2 images', 'm'), 3) +
    row(txt('Launch checks', 'k') + chip('All required checks pass', 'ok'), 4)),
  automations: win('Automations',
    `<div class="pm-tabs" style="--m:0"><span class="is-on">Overview</span><span>Scheduler</span><span>Rules</span><span>Activity</span></div>` +
    row(txt('If CPA is above €25 over 7 days') + txt('→ lower the budget by 15%', 'm'), 1) +
    row(chip('Asks first', 'volt') + chip('Notify only') + chip('Automatic'), 2) +
    row(txt('Schedule · on 8:00–22:00, every day') + chip('Active', 'ok'), 3)),
  activity: win('Automations · Activity',
    row(chip('All', 'volt') + chip('Completed') + chip('Failed') + chip('Pending approval'), 0) +
    row(dot('ok') + txt('Budget lowered 15% · Morning offer') + txt('Completed', 'm'), 1) +
    row(dot('warn') + txt('Pause Weekend menu') + txt('Pending approval', 'm'), 2) +
    row(dot('bad') + txt('Resume Store opening') + txt('Failed · platform error', 'm'), 3)),
};

// ── The six sections ──
const STATUS = { live: 'Available', part: 'Part of another page', dev: 'In development' };
const D = {
  'product-business': {
    name: 'Control Center', num: '01', next: ['/research', 'Research'],
    title: 'Three pages. One place to start.',
    intro: 'Control Center is where every session begins: what is happening, what needs you, what you plan to do next, and the business context everything else is built on.',
    pages: [
      { id: 'dashboard', name: 'Dashboard', status: 'live', mock: 'dashboard',
        lead: 'The first page you see: what is running, what needs you and what to do next.',
        can: ['A status line: campaigns running on your ad platforms, drafts in OrivenAI and what needs your attention', 'Needs you: failed or unconfirmed publishes, automation changes waiting for approval, drafts that can’t launch yet or are ready to launch, and tracking that isn’t verified', 'The last 7 days of spend, conversions, CPA and ROAS from your connected accounts', 'A Get set up checklist, and your campaigns, automations, plan and business context a click away'],
        where: 'Control Center’s overview. There is no separate Tasks page: your to-dos are Needs you and the Get set up checklist, both on the Dashboard.' },
      { id: 'plan', name: 'Marketing Plan', status: 'live', mock: 'plan',
        lead: 'Your marketing plan for the period you bought: phases, tasks, and the OrivenAI tool for each task.',
        can: ['Written from your answers and business details', 'Each task says why it matters, what to do and what you’ll have when it’s done', 'Each task opens the tool it’s done in', 'Ask for a new plan when your business changes; the current plan stays until the new one is ready'],
        where: 'Control Center → Marketing Plan. Dated advertising plans, budgets and UTM templates stay on the Dashboard’s Planning tab.' },
      { id: 'progress', name: 'Progress', status: 'live', mock: 'progress',
        lead: 'Every task from your plan, and which ones are done.',
        can: ['Done, current and upcoming tasks for each phase', 'Tasks OrivenAI can check complete only when the result exists, such as a finished research report', 'Other tasks you tick off yourself', 'Each task opens its tool'],
        where: 'Control Center → Progress.' },
    ],
    flow: 'Your plan sends each task to its tool, Progress shows what’s done, and every item in Needs you opens the place to act on it: Launch, Campaigns or Automations.',
  },
  'product-research': {
    name: 'Research', num: '02', prev: ['/business', 'Control Center'], next: ['/create', 'Create'],
    title: 'Ask a question. Keep what you learn.',
    intro: 'Research investigates a market before you spend: run research, review what you learned in Insights, and keep track of your competitors. Included in every plan.',
    pages: [
      { id: 'research', name: 'Research', status: 'live', mock: 'research',
        lead: 'Ask a marketing question and get a structured report back.',
        can: ['Market, competitor, audience or opportunity research', 'Context from your business profile, your website and anything you attach', 'The job’s real stages while it runs; you can leave the page and it keeps going', C.researchRun + ' credits a report'],
        where: 'The Research page.' },
      { id: 'insights', name: 'Insights', status: 'live', mock: 'insights',
        lead: 'Review and use what your research found.',
        can: ['Key conclusions, opportunities and recommended next actions from your saved research', 'Competitors named in more than one report', 'Each finding links to its report and the sources it cites', 'Save the insights you want to keep'],
        where: 'Research → Insights. Nothing is generated or charged on this page.' },
      { id: 'competitors', name: 'Competitor Analysis', status: 'live', mock: 'competitors',
        lead: 'Your competitors, and what their public websites and sources say.',
        can: ['Your competitor list (the same one Control Center shows)', 'Analyses written by Research from web search and the competitors’ own websites', 'Every finding says where it comes from: verified, public source, AI analysis or AI suggestion', 'No access to anyone’s private advertising data, and no claims of it'],
        where: 'Research → Competitor Analysis (linked from the Research header).' },
    ],
    flow: 'What you learn shapes your plan in Control Center and the ads you make in Create. Findings are marked by how well they are supported; none is presented as guaranteed.',
  },
  'product-create': {
    name: 'Create', num: '03', prev: ['/research', 'Research'], next: ['/launch', 'Launch'],
    title: 'Make it. Then find it again.',
    intro: 'Create is where ads are made, step by step, from your business context. Creative Testing compares versions; My Content keeps everything you made.',
    pages: [
      { id: 'create', name: 'Create', status: 'live', mock: 'create',
        lead: 'Platform-ready ads in six short steps.',
        can: ['Product, platform, goal, format, optional details, then a review before anything is generated', 'Image ads (' + C.imageAd + ' credits) and video ads (' + C.videoAd + ' credits) for Google, Meta, TikTok and Pinterest', 'Options a platform doesn’t support are shown disabled, with the reason', 'Headlines and copy from your business profile and brand'],
        where: 'The Create page. What you create goes to Launch as a draft.' },
      { id: 'testing', name: 'Creative Testing', status: 'live', mock: 'testing',
        lead: 'Several genuinely different versions of an ad idea, side by side.',
        can: ['Headlines, hooks, descriptions, CTAs, tone variants, image ideas and video angles', 'Compare them side by side and keep the strongest', 'A kept version is saved to My Content, ready for Campaign Builder', 'No version is called a winner: results per creative come only from an ad platform, after publishing'],
        where: 'Create → Creative Testing.' },
      { id: 'content', name: 'My Content', status: 'live', mock: 'content',
        lead: 'Everything you’ve made in Create, in one library.',
        can: ['The images, videos and ad text you created', 'Open, download, copy text, favourite or delete', 'Videos appear once they finish rendering'],
        where: 'Create → My Content (linked from the Create header).' },
    ],
    flow: 'Your plan and business profile shape what you make; finished drafts move to Launch to be checked and published.',
  },
  'product-launch': {
    name: 'Launch', num: '04', prev: ['/create', 'Create'], next: ['/campaigns', 'Campaigns'],
    title: 'One studio between a draft and a live campaign.',
    intro: 'Launch is about getting ads out: prepare the audience, check every draft against what the platform needs, fix what blocks it, and publish. What happens after publishing is followed in Campaigns.',
    pages: [
      { id: 'adstudio', name: 'Ad Studio', status: 'live', mock: 'adstudio',
        lead: 'Every draft, its readiness and the way to publish it.',
        can: ['Each draft marked ready, check warnings, blocked or failed', 'Checks for what the platform needs (account, budget, targeting, tracking, creative), with what blocks a draft', 'Publish to Google Ads, Meta Ads, TikTok Ads or Pinterest Ads through each platform’s official API', 'Campaigns are created paused: you decide when they start'],
        where: 'In the app this page is called Launch. Publishing needs a connected ad account.' },
      { id: 'audiences', name: 'Audience Builder', status: 'live', mock: 'audiences',
        lead: 'Audiences from what OrivenAI knows about your business, with targeting suggestions per platform.',
        can: ['Suggestions from your answers, business details and saved research', 'Saved audiences you can edit (the same list Control Center shows)', 'Targeting suggestions for Meta, Google, TikTok and Pinterest', 'Use an audience in Campaign Builder'],
        where: 'Launch → Audience Builder. Prepared in OrivenAI: nothing is created in your ad accounts from this page.' },
    ],
    flow: 'Launch publishes; Campaigns follows what’s running. Some platform-side steps, like account verification, still happen on the platform.',
  },
  'product-campaigns': {
    name: 'Campaigns', num: '05', prev: ['/launch', 'Launch'], next: ['/autopilot', 'Automations'],
    title: 'See what’s running. Open how it’s built.',
    intro: 'Campaigns follows your campaigns once they exist: their results across your connected platforms, comparisons, and each campaign’s setup.',
    pages: [
      { id: 'overview', name: 'Campaign Overview', status: 'live', mock: 'overview',
        lead: 'Results from every connected ad platform in one view.',
        can: ['Spend, clicks, CTR, CPA and ROAS by platform and campaign', 'Date ranges, and trends over time where the platform reports them', 'Pause or resume campaigns on Google Ads, Meta Ads and Pinterest Ads', 'Campaign Replay, to look back at how a campaign developed'],
        where: 'The Campaigns page. Figures are what each platform reports.' },
      { id: 'compare', name: 'Campaign Comparison', status: 'live', mock: 'compare',
        lead: 'Campaigns side by side, on the figures the ad platforms report.',
        can: ['Pick the campaigns and the period', 'CTR, CPC, CPM, conversion rate, CPA and ROAS computed only from reported figures', 'Anything not reported shows as “Not reported”, never as 0 or an estimate', 'An optional AI explanation that uses exactly the figures shown'],
        where: 'Campaigns → Campaign Comparison.' },
      { id: 'builder', name: 'Campaign Builder', status: 'live', mock: 'builder',
        lead: 'A campaign’s setup in one place: structure, targeting, budget and ads.',
        can: ['Open a campaign that isn’t published yet and adjust it', 'Use a saved audience or a kept creative from My Content', 'The same checks Launch uses decide whether it can be published'],
        where: 'Campaigns → Campaign Builder (linked from the Campaigns header).' },
    ],
    flow: 'Results here appear on the Dashboard in Control Center and are what Automations rules watch.',
  },
  'product-autopilot': {
    name: 'Automations', num: '06', prev: ['/campaigns', 'Campaigns'], next: ['/business', 'Control Center'],
    title: 'Set the rules. Check what happened.',
    intro: 'Automations works on campaigns already running in your connected ad accounts: what may happen, when, and a record of everything that did. Included in every plan.',
    pages: [
      { id: 'automations', name: 'Automations', status: 'live', mock: 'automations',
        lead: 'Decide what OrivenAI may do for your published campaigns.',
        can: ['Overview: what’s running, scheduled runs, approvals waiting, and what was done or failed in the last 7 days', 'Scheduler: switch campaigns on or off at set times, also when you’re offline', 'Rules: watch spend, cost per result or ROAS and react when a condition is met', 'Every rule notifies you, asks first or acts within limits you set; one switch pauses everything'],
        where: 'The Overview, Scheduler and Rules pages. ' + C.automationCreate + ' credits once per new automation; its checks and changes are free.' },
      { id: 'activity', name: 'Activity', status: 'live', mock: 'activity',
        lead: 'What each automation did, and the result.',
        can: ['Every run: completed, partly done, failed, skipped, cancelled or pending approval', 'Filter by result', 'History stays after an automation is deleted'],
        where: 'Automations → Activity.' },
    ],
    flow: 'Nothing acts without a schedule or rule you switched on. To build or publish a campaign, use Launch.',
  },
};

function block(key, d) {
  const nav = d.pages.map((p, i) => `<li><a class="pp__link" href="#pp-${key}-${p.id}" data-pp-link><span class="pp__n">${d.num}.${i + 1}</span><span class="pp__name">${p.name}</span><span class="pp-status pp-status--${p.status}">${STATUS[p.status]}</span></a></li>`).join('');
  const pages = d.pages.map((p, i) => `
        <article class="pp__page${p.status === 'dev' ? ' pp__page--dev' : ''}" id="pp-${key}-${p.id}" tabindex="-1" data-pp-page aria-labelledby="pp-${key}-${p.id}-h">
          <div class="pp__copy">
            <p class="pp__meta"><span class="pp__n">${d.num}.${i + 1}</span><span class="pp-status pp-status--${p.status}">${STATUS[p.status]}</span></p>
            <h3 id="pp-${key}-${p.id}-h">${p.name}</h3>
            <p class="pp__lead">${p.lead}</p>
            <ul class="pp__can">${p.can.map((c) => `<li>${c}</li>`).join('')}</ul>
            <p class="pp__where">${p.where}</p>
          </div>
          <figure class="pp__fig">${MOCK[p.mock]}<figcaption>Illustration${p.status === 'dev' ? '' : ' · sample data'}</figcaption></figure>
        </article>`).join('');
  const flowLinks = [d.prev && `<a href="${d.prev[0]}">&larr; ${d.prev[1]}</a>`, `<a href="/product">All six sections</a>`, d.next && `<a href="${d.next[0]}">${d.next[1]} &rarr;</a>`].filter(Boolean).join('');
  return `<!-- pages:start -->
  <section class="pp" data-pp aria-labelledby="pp-${key}-h">
    <div class="pp__in">
      <header class="pp__head">
        <p class="pp__eyebrow">${d.num} · Inside ${d.name}</p>
        <h2 class="pp__h" id="pp-${key}-h">${d.title}</h2>
        <p class="pp__intro">${d.intro}</p>
      </header>
      <div class="pp__grid">
        <nav class="pp__nav" aria-label="Pages in ${d.name}"><ol>${nav}</ol></nav>
        <div class="pp__pages">${pages}
        </div>
      </div>
      <div class="pp__flow"><p><b>How it connects.</b> ${d.flow}</p><p class="pp__flowlinks">${flowLinks}</p></div>
    </div>
  </section>
  <!-- pages:end -->`;
}

// ── Solutions: five reasons to use OrivenAI ──
const SOLUTIONS = [
  { id: 'workflow', page: '/solutions/connected-workflow', n: '01', title: 'One connected marketing workflow',
    text: 'Six sections that build on each other instead of separate tools: research shapes the plan, the plan shapes the ads, and results shape what comes next. You move between them yourself; nothing runs the whole chain for you.',
    path: ['Control Center', 'Research', 'Create', 'Launch', 'Campaigns', 'Automations'], links: [['/product', 'See the six sections']] },
  { id: 'research', page: '/solutions/research-before-creation', n: '02', title: 'Research before you create',
    text: 'Investigate your market, competitors and audience before you spend. Reports mark how well each finding is supported, so you can tell what’s established from what’s worth testing, and use that in your plan and ads.',
    path: ['Research', 'Marketing Plan', 'Create'], links: [['/research', 'Explore Research']] },
  { id: 'plan', page: '/solutions/plan-to-content', n: '03', title: 'From marketing plan to content',
    text: 'Plan what to advertise, when, where and with what budget in Control Center. A plan becomes a brief that prefills Create, so the ads you make start from what you planned. You still review every step.',
    path: ['Marketing Plan', 'Brief', 'Create'], links: [['/business', 'Explore Control Center'], ['/create', 'Explore Create']] },
  { id: 'ads', page: '/solutions/advertising-campaigns', n: '04', title: 'Advertising and campaign workflows',
    text: 'Create image and video ads, check them in Launch against what each platform needs, and publish to Google, Meta, TikTok or Pinterest, created paused. Then follow results in Campaigns. Launch gets ads out; Campaigns follows what’s running.',
    path: ['Create', 'Launch', 'Campaigns'], links: [['/launch', 'Explore Launch'], ['/campaigns', 'Explore Campaigns']] },
  { id: 'structure', page: '/solutions/structured-automation', n: '05', title: 'More structure, less repetitive work',
    text: 'Schedules switch published campaigns on or off at set times. Rules watch spend, cost per result or ROAS and notify you, ask first or act within limits you set. Activity shows what happened. Building and publishing campaigns stays manual.',
    path: ['Scheduler', 'Rules', 'Activity'], links: [['/autopilot', 'Explore Automations']] },
];

function solutionsBlock() {
  return `<!-- solutions:start -->
  <section class="pp pp--solutions" data-pp aria-labelledby="sol-h">
    <div class="pp__in">
      <header class="pp__head">
        <p class="pp__eyebrow">Five reasons to use OrivenAI</p>
        <h2 class="pp__h" id="sol-h">Start with what slows you down.</h2>
        <p class="pp__intro">Each one maps to sections that exist in OrivenAI today. No customer stories or numbers here: just what the product does.</p>
      </header>
      <div class="sol">${SOLUTIONS.map((s) => `
        <article class="sol__card" id="${s.id}" data-pp-page tabindex="-1" aria-labelledby="sol-${s.id}-h">
          <p class="pp__meta"><span class="pp__n">${s.n}</span></p>
          <h3 id="sol-${s.id}-h"><a href="${s.page}">${s.title}</a></h3>
          <p>${s.text}</p>
          <p class="sol__path" aria-label="Where it happens: ${s.path.join(', ')}">${s.path.map((x) => `<span>${x}</span>`).join('<i aria-hidden="true">&rarr;</i>')}</p>
          <p class="sol__links"><a class="sol__more" href="${s.page}">Read: ${s.title} &rarr;</a>${s.links.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</p>
        </article>`).join('')}
      </div>
    </div>
  </section>
  <!-- solutions:end -->`;
}

module.exports = { D, block, SOLUTIONS, solutionsBlock, STATUS };
