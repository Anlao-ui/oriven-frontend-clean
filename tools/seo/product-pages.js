// ════════════════════════════════════════════════════════════════
// "Inside <section>": the pages of each of the six sections, for the six
// product views in index.html (Overview /business, Campaigns /launch,
// Creative Studio /create, Analytics /campaigns, Research /research,
// Autopilot /autopilot), plus the five Solutions concepts.
// Inserted by tools/seo/apply-product-depth.js between <!-- pages:start -->
// and <!-- pages:end --> (and <!-- solutions:start/end -->). Behaviour:
// js/section-pages.js. Styles: css/site-chrome.css (.pp, .pm).
//
// Accuracy (checked against the app, 2026-11-27: js/appNav.js SECTIONS and each page):
//   status 'live' = a page or tab that exists today
//   status 'part' = exists, but inside another page (where says which)
//   status 'dev'  = not in the app yet; the copy says what exists instead
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
  dashboard: win('Overview · Dashboard',
    row(txt('Good morning', 'h') + txt('2 campaigns running · 1 draft · 2 things need you', 'm'), 0) +
    row(txt('Needs you', 'k'), 1) +
    row(dot('warn') + txt('An automation change is waiting for your approval') + chip('Review'), 2) +
    row(dot('ok') + txt('“Spring menu” is ready to launch') + chip('Review'), 3) +
    kpis([['Spend', '€184'], ['Conversions', '23'], ['CPA', '€8.00'], ['ROAS', '3.1']], 4) +
    row(txt('Get set up', 'k') + bar(66) + txt('2 of 3 done', 'm'), 5)),
  plan: win('Overview · AI Plans &amp; Tasks',
    row(txt('This month', 'k') + bar(58) + txt('€232 of €400 planned', 'm'), 0) +
    row(txt('Morning offer · Google Search') + chip('Live', 'ok'), 1) +
    row(txt('Weekend menu · Meta') + chip('Briefed', 'volt'), 2) +
    row(txt('Autumn launch · TikTok') + chip('Planned'), 3) +
    row(txt('Next task → opens Create Ads', 'm'), 4)),
  progress: win('Control Center · Progress',
    row(txt('Week 1', 'k') + bar(100) + txt('3 of 3 done', 'm'), 0) +
    row(txt('Week 2', 'k') + bar(40) + txt('2 of 5 done', 'm'), 1) +
    row(txt('Week 3', 'k') + bar(0) + txt('Upcoming', 'm'), 2)),
  research: win('Research · Audience Research',
    row(txt('How do premium coffee roasters advertise in Amsterdam?', 'q'), 0) +
    row(chip('Market') + chip('Competitor', 'volt') + chip('Audience') + chip('Opportunity'), 1) +
    row(txt('Researching', 'k') + bar(72, 'volt') + txt('Reading sources', 'm'), 2) +
    row(txt('You can leave this page; the research keeps going.', 'm'), 3)),
  insights: win('Research · Saved Research',
    row(txt('Competitor research · 3 roasters') + txt('2 d ago', 'm'), 0) +
    row(dot('ok') + txt('Moderate confidence') + txt('Checked against the sources it read', 'm'), 1) +
    row(dot() + txt('Low confidence · an idea to test') + txt('Limits and assumptions listed', 'm'), 2) +
    row(txt('Audience research · remote workers') + txt('5 d ago', 'm'), 3)),
  create: win('Creative Studio · Create Ads',
    `<div class="pm-steps" style="--m:0">${['Product', 'Platform', 'Goal', 'Format', 'Customise', 'Review'].map((s, i) => `<span class="${i < 3 ? 'is-done' : i === 3 ? 'is-on' : ''}">${i + 1} ${s}</span>`).join('')}</div>` +
    row(txt('Format', 'k'), 1) +
    row(chip('Image ad', 'volt') + chip('Video ad') + chip('Unsupported: shown disabled', 'off'), 2) +
    row(txt('Copy in your brand voice · then to Campaign Studio', 'm'), 3)),
  content: win('Creative Studio · My Creatives',
    row(chip('Images') + chip('Videos') + chip('Ad text'), 0) +
    row(dot('ok') + txt('Autumn candles · image') + txt('Saved', 'm'), 1) +
    row(dot('ok') + txt('Spring offer · 5-second video') + txt('Saved', 'm'), 2)),
  competitors: win('Research · Competitive Research',
    row(txt('Your competitors', 'k') + txt('3', 'm'), 0) +
    row(dot('ok') + txt('Positioning: handmade, local') + chip('Public source'), 1) +
    row(dot() + txt('Offer: free shipping over €40') + chip('AI analysis'), 2)),
  testing: win('Creative Studio · Creative Testing',
    row(chip('Hook A') + chip('Hook B') + chip('Hook C'), 0) +
    row(txt('Side by side', 'k') + bar(66) + txt('3 versions', 'm'), 1) +
    row(dot('ok') + txt('Kept: “Slow evenings”') + txt('Saved', 'm'), 2)),
  audiences: win('Launch · Audience Builder',
    row(txt('Remote workers within 3 km') + chip('Saved'), 0) +
    row(txt('Meta', 'k') + txt('Age 24–40 · interests: coffee, coworking', 'm'), 1) +
    row(txt('Google', 'k') + txt('Keywords: coffee near me', 'm'), 2)),
  compare: win('Analytics · Cross-platform Comparison',
    kpis([['CTR A', '1.9%'], ['CTR B', '1.2%'], ['CPA A', '€8.40']], 0) +
    row(txt('Same period · same currency', 'm'), 1)),
  adstudio: win('Campaigns · Campaign Studio',
    row(txt('Spring menu · Meta') + chip('Ready', 'ok'), 0) +
    row(txt('Morning offer · Google') + chip('Check warnings', 'warn'), 1) +
    row(txt('Store opening · TikTok') + chip('Blocked: add a landing page', 'bad'), 2) +
    row(txt('Launch → created paused on the platform', 'm'), 3)),
  overview: win('Analytics · Performance Overview',
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
  automations: win('Autopilot · Automation Overview',
    kpis([['Active', '2'], ['Scheduled runs', '2'], ['Awaiting approval', '0'], ['Failed · 7 days', '0']], 0) +
    row(txt('If CPA is above €25 over 7 days') + txt('→ lower the budget by 15%', 'm'), 1) +
    row(chip('Asks first', 'volt') + chip('Notify only') + chip('Automatic'), 2) +
    row(txt('Schedule · on 8:00–22:00, every day') + chip('Active', 'ok'), 3)),
  activity: win('Autopilot · Automation History',
    row(chip('All', 'volt') + chip('Completed') + chip('Failed') + chip('Pending approval'), 0) +
    row(dot('ok') + txt('Budget lowered 15% · Morning offer') + txt('Completed', 'm'), 1) +
    row(dot('warn') + txt('Pause Weekend menu') + txt('Pending approval', 'm'), 2) +
    row(dot('bad') + txt('Resume Store opening') + txt('Failed · platform error', 'm'), 3)),
  attention: win('Overview · Needs Attention',
    kpis([['Problems', '1'], ['Warnings', '3'], ['Ready for you', '1']], 0) +
    row(dot('bad') + txt('Pinterest Ads: no conversions in the last 7 days') + chip('Open Performance'), 1) +
    row(dot('warn') + txt('Conversion tracking isn’t verified for Meta Ads') + chip('Check setup'), 2) +
    row(dot('ok') + txt('6 campaigns are ready to launch') + chip('Review'), 3)),
  simulator: win('Campaigns · Ad Simulator',
    row(chip('Google Ads') + chip('Meta Ads', 'volt') + chip('TikTok Ads'), 0) +
    row(txt('Total budget', 'k') + txt('€1,000 over 30 days · Sales', 'm'), 1) +
    row(txt('Scenario A', 'k') + bar(62, 'volt') + txt('from your assumptions', 'm'), 2) +
    row(txt('A simulation, not a forecast · nothing is published', 'm'), 3)),
  adsvsads: win('Analytics · Ads vs Ads',
    row(txt('Workshop teaser · Feed') + txt('vs', 'm') + txt('Warm light · Reels'), 0) +
    kpis([['CTR', '4.17% · 3.73%'], ['CPA', '€7.57 · €21.62'], ['ROAS', '8.95× · 2.90×']], 1) +
    row(txt('Calculated from the figures shown; no AI', 'm'), 2)),
  rules: win('Autopilot · My Automations',
    row(chip('Active', 'ok') + chip('Asks first', 'volt') + txt('Meta Ads', 'm'), 0) +
    row(txt('If ROAS is above 3× over 7 days') + txt('→ raise the daily budget by 15% (never above €60)', 'm'), 1) +
    row(chip('Notify me') + chip('Ask first', 'volt') + chip('Act within limits'), 2) +
    row(txt('Scheduled pauses &amp; resumes') + txt('1 schedule', 'm'), 3)),
};

// ── The six sections ──
const STATUS = { live: 'Available', part: 'Part of another page', dev: 'In development' };
const D = {
  'product-business': {
    name: 'Overview', num: '01', next: ['/launch', 'Campaigns'],
    title: 'Know where you stand.',
    intro: 'Overview is where you start: how your advertising is doing, the plan built around your business, and what needs your attention.',
    pages: [
      { id: 'dashboard', name: 'Dashboard', status: 'live', mock: 'dashboard',
        lead: 'The first page you see: how your advertising is doing and what to do next.',
        can: ['Spend, conversions, CPA and ROAS from your connected platforms, against the previous period, with a chart', 'The most urgent items from Needs Attention', 'Your ad platforms and their connection status, your top campaigns and recommended next steps', 'Autopilot at a glance: active and paused automations and approvals waiting'],
        where: 'Overview → Dashboard.' },
      { id: 'plan', name: 'AI Plans &amp; Tasks', status: 'live', mock: 'plan',
        lead: 'A marketing plan built around your business, and the tasks that come from it.',
        can: ['Written from your answers and business details, for the period you bought', 'An action plan in phases, from research to measuring and improving, with the next task highlighted', 'Each task opens the place where it is done; the Tasks tab shows what OrivenAI runs, what is done and what is up to you', 'Write a new plan when your business changes'],
        where: 'Overview → AI Plans &amp; Tasks (Plans and Tasks tabs).' },
      { id: 'attention', name: 'Needs Attention', status: 'live', mock: 'attention',
        lead: 'Problems and warnings across your ad accounts, tracking, campaigns and automations, most urgent first.',
        can: ['Checked from live data: problems, warnings and what is waiting for your go-ahead', 'Grouped by ad accounts, tracking and conversions, performance, campaigns and automations', 'Each item opens the place where you can act on it', 'Nothing is changed from this page'],
        where: 'Overview → Needs Attention.' },
    ],
    flow: 'The Dashboard and Needs Attention draw on the other sections: campaigns from Campaigns, results from Analytics and automations from Autopilot. Each task in your plan opens the section where it is done.',
  },
  'product-launch': {
    name: 'Campaigns', num: '02', prev: ['/business', 'Overview'], next: ['/create', 'Creative Studio'],
    title: 'Check it. Launch it paused.',
    intro: 'Campaigns is where your campaigns are checked and launched to your connected ad platforms, and where you can try a budget before you commit to it.',
    pages: [
      { id: 'adstudio', name: 'Campaign Studio', status: 'live', mock: 'adstudio',
        lead: 'Every campaign you made in OrivenAI, per platform, with its readiness and the way to launch it.',
        can: ['Each campaign marked published, ready to launch, ready with warnings, blocked or failed', 'A pre-flight check for what the platform needs (account, budget, targeting, tracking and creative), with what blocks a campaign', 'Launch to Google Ads, Meta Ads, TikTok Ads, Pinterest Ads or Snapchat Ads through each platform’s official API; campaigns are created paused', 'Open a campaign in Campaign Builder to adjust its structure, targeting, budget and ads first'],
        where: 'Campaigns → Campaign Studio. Launching needs a connected ad account.' },
      { id: 'simulator', name: 'Ad Simulator', status: 'live', mock: 'simulator',
        lead: 'Try budgets, platforms and assumptions before you spend real money.',
        can: ['Pick platforms, a total budget, a duration and an objective', 'Calculated instantly in your browser from your assumptions: moving a slider never costs credits', 'Compare scenarios side by side and keep them in My Simulations', 'A simulation, not a forecast: nothing is published'],
        where: 'Campaigns → Ad Simulator.' },
    ],
    flow: 'Ads made in Creative Studio arrive here as campaigns; once they run, their results appear in Analytics and Autopilot can manage them. Some platform-side steps, like account verification, still happen on the platform.',
  },
  'product-create': {
    name: 'Creative Studio', num: '03', prev: ['/launch', 'Campaigns'], next: ['/campaigns', 'Analytics'],
    title: 'Make it. Then find it again.',
    intro: 'Creative Studio is where ads are made, with AI or by hand, from your business context. Creative Testing compares versions; My Creatives keeps everything you made.',
    pages: [
      { id: 'create', name: 'Create Ads', status: 'live', mock: 'create',
        lead: 'Make an ad with AI, or build it yourself.',
        can: ['Create with AI: answer a few questions; OrivenAI writes the copy and can make images (' + C.imageAd + ' credits an image ad) or video (' + C.videoAd + ' credits)', 'Create manually: choose the platform first, then build ad sets or ad groups with as many ads as the platform allows', 'Options a platform doesn’t support are shown disabled, with the reason', 'Checked against the platform’s rules before you save; you can switch between AI and manual without losing your work'],
        where: 'Creative Studio → Create Ads. Finished ads go to Campaign Studio, ready to check and launch.' },
      { id: 'content', name: 'My Creatives', status: 'live', mock: 'content',
        lead: 'Everything you’ve made in Creative Studio, in one library.',
        can: ['Images, videos, ad creatives and copy', 'Filter, search and mark favourites; each item says whether it was made with AI or uploaded by you', 'Open, download or copy text', 'Videos appear once they finish rendering'],
        where: 'Creative Studio → My Creatives.' },
      { id: 'testing', name: 'Creative Testing', status: 'live', mock: 'testing',
        lead: 'Several versions of an ad idea, side by side.',
        can: ['Vary headlines, hooks, descriptions, calls to action and more', 'Compare two versions, ads, images or concepts side by side', 'Chosen versions go to My Creatives, ready for your campaigns', 'No version is called a winner: results per ad come only from an ad platform, after publishing'],
        where: 'Creative Studio → Creative Testing.' },
    ],
    flow: 'Your plan and business profile shape what you make; finished ads move to Campaign Studio to be checked and launched.',
  },
  'product-campaigns': {
    name: 'Analytics', num: '04', prev: ['/create', 'Creative Studio'], next: ['/research', 'Research'],
    title: 'See what works. Compare it fairly.',
    intro: 'Analytics shows what your campaigns achieve across your connected platforms: overall performance, platforms side by side, and individual ads head to head.',
    pages: [
      { id: 'overview', name: 'Performance Overview', status: 'live', mock: 'overview',
        lead: 'Results from each connected ad platform, in one view.',
        can: ['Reach, cost and budget, engagement, conversions and revenue, as each platform reports them', 'Per platform and campaign, for a date range you choose', 'Charts over time, and a week, month or custom period compared with the one before', 'A figure a platform doesn’t report is shown as not reported, never as 0'],
        where: 'Analytics → Performance Overview. Figures are what each platform reports.' },
      { id: 'compare', name: 'Cross-platform Comparison', status: 'live', mock: 'compare',
        lead: 'Every ad platform side by side: where your budget goes and what it brings back.',
        can: ['Platforms or campaigns, for a period you choose, optionally against the previous period', 'Spend, impressions, clicks, CTR, CPC, conversions, CPA and ROAS from the figures the platforms report', 'Short notes calculated from the figures shown, without AI', 'A platform that doesn’t report a figure is left out of that comparison'],
        where: 'Analytics → Cross-platform Comparison.' },
      { id: 'adsvsads', name: 'Ads vs Ads', status: 'live', mock: 'adsvsads',
        lead: 'Two individual ads head to head.',
        can: ['Pick two ads and a period', 'Impressions, clicks, CTR, CPC, CPM, spend, conversions, CPA and ROAS for each', 'One metric over time for both ads', 'Which one earns its budget, calculated from the figures shown; no AI'],
        where: 'Analytics → Ads vs Ads. Uses the per-ad figures a platform reports.' },
    ],
    flow: 'The Dashboard in Overview shows the headline figures, and Autopilot rules watch the same results.',
  },
  'product-research': {
    name: 'Research', num: '05', prev: ['/campaigns', 'Analytics'], next: ['/autopilot', 'Autopilot'],
    title: 'Ask a question. Keep what you learn.',
    intro: 'Research investigates your audience and your competitors before you spend, and keeps every finding with its sources. Included in every plan.',
    pages: [
      { id: 'research', name: 'Audience Research', status: 'live', mock: 'research',
        lead: 'Who buys from you and why: needs, frustrations, motivations and how habits change.',
        can: ['Audience research, product and niche research, or trends', 'Start from a suggested question or ask your own', 'Context from your business profile and your website', C.researchRun + ' credits a report; you can leave the page and it keeps going'],
        where: 'Research → Audience Research.' },
      { id: 'competitive', name: 'Competitive Research', status: 'live', mock: 'competitors',
        lead: 'How competitors position, price, message and advertise, and where you can stand apart.',
        can: ['Competitor research, advertising and campaigns, market research or opportunity research', 'Your competitor list, with their positioning side by side', 'Every finding marked source-checked, cited (not checked) or analysis', 'No access to anyone’s private advertising data, and no claims of it'],
        where: 'Research → Competitive Research.' },
      { id: 'insights', name: 'Saved Research', status: 'live', mock: 'insights',
        lead: 'What your research has found, in one place.',
        can: ['Key findings and opportunities from every report, each linked to the report it came from', 'Each finding says how well its sources support it', 'A library of your reports and the findings you saved', 'Create ads straight from a finding'],
        where: 'Research → Saved Research. Nothing is generated or charged on this page.' },
    ],
    flow: 'What you learn shapes your plan in Overview and the ads you make in Creative Studio. Findings are marked by how well they are supported; none is presented as guaranteed.',
  },
  'product-autopilot': {
    name: 'Autopilot', num: '06', prev: ['/research', 'Research'], next: ['/business', 'Overview'],
    title: 'Set the rules. Check what happened.',
    intro: 'Autopilot works on campaigns already running in your connected ad accounts: what may happen, when, and a record of everything that did. Included in every plan.',
    pages: [
      { id: 'automations', name: 'Automation Overview', status: 'live', mock: 'automations',
        lead: 'What runs on its own, what’s coming up and what needs your approval.',
        can: ['Active and paused automations, scheduled runs, approvals waiting, and what was done or failed in the last 7 days', 'The next scheduled action and when rules were last checked', 'Your connected ad accounts', 'One switch pauses every automation'],
        where: 'Autopilot → Automation Overview.' },
      { id: 'rules', name: 'My Automations', status: 'live', mock: 'rules',
        lead: 'Rules that watch your campaigns and notify you, ask first or act within your limits.',
        can: ['Watch spend, cost per result or ROAS over a period you choose', 'Each rule notifies you, asks first, or acts within limits you set', 'Scheduled pauses and resumes for your campaigns, also when you’re offline', C.automationCreate + ' credits once per new automation; its checks and changes are free'],
        where: 'Autopilot → My Automations.' },
      { id: 'activity', name: 'Automation History', status: 'live', mock: 'activity',
        lead: 'What each automation did, and the result.',
        can: ['Every run: completed, partly done, failed, skipped, cancelled or pending approval', 'Filter by result', 'History stays after an automation is deleted'],
        where: 'Autopilot → Automation History.' },
    ],
    flow: 'Nothing acts without a schedule or rule you switched on. To build or launch a campaign, use Campaigns.',
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
    text: 'Six connected sections instead of separate tools, all working from the same business profile, campaigns and results. Use them in the order that suits you; nothing runs the whole chain for you.',
    path: ['Overview', 'Campaigns', 'Creative Studio', 'Analytics', 'Research', 'Autopilot'], links: [['/product', 'See the six sections']] },
  { id: 'research', page: '/solutions/research-before-creation', n: '02', title: 'Research before you create',
    text: 'Investigate your market, competitors and audience before you spend. Reports mark how well each finding is supported, so you can tell what’s established from what’s worth testing, and use that in your plan and ads.',
    path: ['Research', 'AI Plans &amp; Tasks', 'Creative Studio'], links: [['/research', 'Explore Research']] },
  { id: 'plan', page: '/solutions/plan-to-content', n: '03', title: 'From marketing plan to content',
    text: 'Get a marketing plan built around your business in Overview, with tasks that open the place where each one is done, so the ads you make start from what you planned. You still review every step.',
    path: ['AI Plans &amp; Tasks', 'Tasks', 'Creative Studio'], links: [['/business', 'Explore Overview'], ['/create', 'Explore Creative Studio']] },
  { id: 'ads', page: '/solutions/advertising-campaigns', n: '04', title: 'Advertising and campaign workflows',
    text: 'Create image and video ads in Creative Studio, check them in Campaign Studio against what each platform needs, and launch to Google, Meta, TikTok, Pinterest or Snapchat, created paused. Then follow the results in Analytics.',
    path: ['Creative Studio', 'Campaigns', 'Analytics'], links: [['/launch', 'Explore Campaigns'], ['/campaigns', 'Explore Analytics']] },
  { id: 'structure', page: '/solutions/structured-automation', n: '05', title: 'More structure, less repetitive work',
    text: 'Schedules switch published campaigns on or off at set times. Rules watch spend, cost per result or ROAS and notify you, ask first or act within limits you set. Automation History shows what happened. Building and launching campaigns stays manual.',
    path: ['Automation Overview', 'My Automations', 'Automation History'], links: [['/autopilot', 'Explore Autopilot']] },
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
