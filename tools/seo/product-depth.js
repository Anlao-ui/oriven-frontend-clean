// ════════════════════════════════════════════════════════════════
// In-depth sections for the product views in index.html (how it works,
// who it's for, what to know, questions, related guides). Inserted into
// each view by tools/seo/apply-product-depth.js between the markers
// <!-- depth:start --> / <!-- depth:end -->, so it can be re-applied.
//
// Accuracy: every statement reflects the product code as of 2026-10-15
// (services/campaignSpec.js, routes/publishRoutes.js, Research route,
// Automations engine in services/automations/*, credit costs in js/plans.js).
// Platform publishing creates campaigns PAUSED; nothing is activated.
// ════════════════════════════════════════════════════════════════
const fig = (name, alt, cap) => `<figure class="ov-deep-fig"><img src="/assets/films/posters/film-${name}-800.webp" srcset="/assets/films/posters/film-${name}-800.webp 800w, /assets/films/posters/film-${name}.webp 1600w" sizes="(max-width: 900px) 100vw, 860px" alt="${alt}" width="800" height="450" loading="lazy" decoding="async"><figcaption>${cap}</figcaption></figure>`;

function block(key, d) {
  const steps = d.steps.map((s) => `<li><strong>${s[0]}</strong> ${s[1]}</li>`).join('');
  const list = (a) => a.map((x) => `<li>${x}</li>`).join('');
  const faq = d.faq.map((q) => `<details><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join('');
  const links = d.links.map((l) => `<a href="${l[0]}">${l[1]}</a>`).join('');
  return `<!-- depth:start -->
  <section class="ov-sp-section ov-deep" aria-labelledby="deep-${key}-h">
    <div class="ov-sp-section-inner">
      <div class="ov-sp-tag">${d.tag || 'How it works'}</div>
      <h2 class="ov-sp-h2" id="deep-${key}-h">${d.title}</h2>
      ${d.intro ? `<p class="ov-deep-intro">${d.intro}</p>` : ''}
      <ol class="ov-deep-steps">${steps}</ol>
      ${d.fig || ''}
      <div class="ov-deep-cols">
        <div><h3>Who it’s for</h3><ul>${list(d.who)}</ul></div>
        <div><h3>Good to know</h3><ul>${list(d.know)}</ul></div>
      </div>
      <h3 class="ov-deep-qh">Questions</h3>
      <div class="ov-deep-faq">${faq}</div>
      <p class="ov-deep-links"><span>Related guides</span>${links}</p>
    </div>
  </section>
  <!-- depth:end -->`;
}

const D = {
  'product-create': {
    title: 'From a short brief to a ready-to-review campaign',
    intro: 'Create turns what you know about your product into a complete draft for one ad platform: the campaign structure, the copy for every ad, and the image or video creative, in the format that platform expects.',
    steps: [
      ['Describe what you advertise.', 'A product, an offer, who it’s for. Your business profile from Control Center (name, brand, website) is added automatically, and you can bring in findings from Research.'],
      ['Choose a platform, goal and format.', 'Google Ads, Meta Ads, TikTok Ads or Pinterest Ads; Sales, Leads, Traffic or Awareness; image or video; and how many ad sets or ad groups and ads you want.'],
      ['Review the draft.', 'Headlines, primary text, descriptions and calls to action for each ad; for Google Search, keywords, negative keywords, callouts and sitelinks. Every field is editable and shows a character counter.'],
      ['Generate the creative.', 'One image or video per ad slot, sized for the platform. You can attach your own image or product photo instead.'],
      ['Send it to Launch.', 'Nothing is published from Create. Launch checks the campaign and creates it on the platform paused.'],
    ],
    fig: fig('create', 'The OrivenAI Create screen: the brief, platform choice (Google, Meta, TikTok, Pinterest), image or video, campaign goal, campaign type and structure, and the creative stage', 'The Create screen. Screenshot from the product.'),
    who: ['Small businesses and solo marketers who need ads for more than one platform', 'Teams that want a consistent first draft instead of a blank page', 'Anyone who wants to test several angles quickly'],
    know: ['A campaign draft uses 25 credits; each image 75 and each video 200 (credits are refunded if generation fails)', 'Videos take a few minutes and keep generating if you leave the page', 'TikTok ads need video; the other platforms accept images', 'AI drafts are a starting point: check claims, prices and offers before publishing'],
    faq: [
      ['Can I use my own images?', 'Yes. Attach an image or a product photo and Create uses it instead of generating one for that slot, so no image credits are spent on it.'],
      ['Does Create publish my ads?', 'No. Create prepares the campaign; Launch checks it and creates it on the ad platform paused. You switch it on in the platform when you’re ready.'],
      ['Which languages can I advertise in?', 'You write the brief in the language you want the ads in, and you can set the campaign’s target languages in its settings.'],
    ],
    links: [['/learn/how-to-create-facebook-and-instagram-ads-with-ai/', 'Creating Facebook and Instagram ads with AI'], ['/learn/how-to-test-ad-creatives/', 'How to test ad creatives'], ['/learn/ad-character-limits/', 'Ad character limits']],
  },
  'product-research': {
    title: 'Research your market before you spend',
    intro: 'Research answers questions like “Who are my main competitors and what do they advertise?” with a structured report you can act on, and shows which findings were checked against a source.',
    steps: [
      ['Ask a question and choose a research type.', 'Market, competitor, audience or opportunity research — each searches for different things and returns its own report. Add competitor pages if you want them read too.'],
      ['OrivenAI gathers evidence.', 'Up to three targeted web searches using your industry and country, then it reads up to five of the most relevant pages, your own website and any pages you attached.'],
      ['Get a structured report.', 'An executive summary with the key conclusions, then sections that fit the research type: competitor cards and a comparison, customer needs and objections, trends, or opportunities with suggested tests.'],
      ['See what each finding rests on.', 'Findings are labelled Source-checked (a quoted passage was found in a page it read), Cited (a source was named but not checked), Analysis, or Idea to test. Source-checked findings show the quoted passage and the link.'],
      ['Use it.', 'Reports are saved to your Research library. Add up to eight insights to Create as context for your next campaign.'],
    ],
    fig: fig('research-v2', 'The OrivenAI Research screen: a research question, research types and the business profile used as context', 'The Research screen. Screenshot from the product.'),
    who: ['Businesses planning a first campaign in a new market', 'Marketers who want competitor context before writing ads', 'Anyone who needs evidence, not just AI opinions'],
    know: ['Included from the Starter plan; each report uses 25 credits (refunded if it fails)', 'It has no access to competitors’ ad performance, budgets or results, and never claims an ad “works”', 'It doesn’t pull ads from the Meta Ad Library or Google Ads Transparency Center; it links to them so you can check real ads', 'Set your country in your business profile so findings are specific to your market'],
    faq: [
      ['Is Research based on real data?', 'It runs live web searches and reads the most relevant pages, your website and any pages you attach. A finding is only marked Source-checked when the passage it quotes was found in a page it read; everything else is marked Cited, Analysis or Idea to test.'],
      ['Can it show how my competitors’ ads perform?', 'No. No tool has access to another advertiser’s results. Research describes what competitors publicly do and say, and suggests what to test.'],
      ['Where are my reports kept?', 'In your account, in your Research library, so you can reopen, rename or delete them on any device.'],
    ],
    links: [['/learn/how-to-research-competitor-ads/', 'How to research competitor ads'], ['/learn/best-ai-advertising-tools-for-small-business/', 'AI advertising tools for small businesses'], ['/learn/what-is-an-ai-advertising-platform/', 'What an AI advertising platform does']],
  },
  'product-launch': {
    title: 'Check every campaign before it reaches the platform',
    intro: 'Launch is the step between a draft and a live campaign. It shows what each platform will receive, flags what’s missing, and creates the campaign through the platform’s official API, paused.',
    steps: [
      ['Pick a draft.', 'Every campaign from Create waits in Launch with its readiness status.'],
      ['Review the settings.', 'Objective, countries, languages, ages, placements, budget, conversion tracking, destination and tracking parameters, each marked as your choice, from your business profile, automatic, or missing.'],
      ['Fix what’s flagged.', 'For example: choose a country, set a daily budget, select your Meta Pixel or Pinterest tag, confirm Meta’s special ad categories, or add a logo for Performance Max.'],
      ['Confirm.', 'A summary shows exactly what will be created. Nothing is sent until you confirm.'],
      ['It’s created paused.', 'Campaign, ad sets or ad groups and ads are created on the platform paused. You switch them on in the platform.'],
    ],
    fig: fig('launch', 'The OrivenAI Launch screen with campaign drafts and readiness checks', 'The Launch screen. Screenshot from the product.'),
    who: ['Anyone who wants a second pair of eyes before spending money', 'Businesses running the same campaign on more than one platform', 'Teams that want publishing to be a deliberate step'],
    know: ['You always set the budget and the countries; OrivenAI never fills them in for you', 'Sales and Leads campaigns need conversion tracking on the platform (Pixel, tag or conversion actions)', 'If a platform rejects part of a campaign, everything created in that attempt is removed', 'Each platform still reviews ads under its own policies'],
    faq: [
      ['Will my campaign start spending right away?', 'No. Campaigns are always created paused. Nothing spends until you activate the campaign in the ad platform.'],
      ['What if I publish the same campaign twice?', 'Launch prevents a second publish of the same campaign while one is in progress.'],
      ['Which campaign types can I launch?', 'Google Search, Performance Max and Demand Gen; Meta image ads; TikTok video ads for traffic and awareness; Pinterest image and video Pins.'],
    ],
    links: [['/learn/how-to-manage-multiple-ad-platforms/', 'Managing multiple ad platforms'], ['/learn/meta-pixel-vs-conversions-api/', 'Meta Pixel vs Conversions API'], ['/learn/google-ads-vs-meta-ads/', 'Google Ads vs Meta Ads']],
  },
  'product-campaigns': {
    title: 'See every platform’s results in one place',
    intro: 'Campaigns pulls performance directly from each connected ad platform, so you can compare campaigns without switching between four dashboards.',
    steps: [
      ['Connect your ad accounts.', 'Google Ads, Meta Ads, TikTok Ads and Pinterest Ads, in Control Center.'],
      ['Choose a view.', 'Filter by platform, campaign and date range; read spend, clicks, conversions and the other metrics each platform reports.'],
      ['Act on what you see.', 'Pause or resume Google Ads, Meta Ads and Pinterest Ads campaigns from OrivenAI, with a confirmation first.'],
      ['Automate what repeats.', 'Turn a check you do every week into an automation rule.'],
    ],
    fig: fig('campaigns', 'The OrivenAI Campaigns screen with performance by platform, campaign and date range', 'The Campaigns screen. Screenshot from the product.'),
    who: ['Businesses advertising on two or more platforms', 'Owners who want a quick, honest view of what’s running', 'Marketers who report across platforms'],
    know: ['Numbers come from each platform’s own reporting, so definitions differ between platforms', 'Data refreshes from the platforms; very recent activity can lag', 'Pausing in OrivenAI pauses the real campaign on the platform'],
    faq: [
      ['Are the numbers estimates?', 'No. They are read from each platform’s reporting API. OrivenAI doesn’t invent or blend metrics across platforms.'],
      ['Can I pause campaigns from OrivenAI?', 'Yes, for Google Ads, Meta Ads and Pinterest Ads campaigns, after a confirmation. TikTok campaigns are managed in TikTok Ads Manager.'],
    ],
    links: [['/learn/how-to-manage-multiple-ad-platforms/', 'Managing multiple ad platforms'], ['/learn/how-to-test-ad-creatives/', 'How to test ad creatives'], ['/cross-platform-ad-management/', 'Cross-platform ad management']],
  },
  'product-autopilot': {
    title: 'Rules you can read, actions you can predict',
    intro: 'Automations are schedules and rules for campaigns that already run in your ad accounts: you decide the condition or the time, the action and the limits, and every action is logged.',
    steps: [
      ['Write a rule.', 'A condition on a metric such as CPA, ROAS, CPC, CTR, conversions or spend, for example “if CPA is above €40 over 7 days”.'],
      ['Choose the action and its limits.', 'Pause or resume a campaign, adjust its budget within a range you set, notify you, or ask for your approval first.'],
      ['Checked for you, also when you’re offline.', 'Schedules run at the time you set in your time zone, and rules are checked regularly on OrivenAI’s servers. Budget rules have a maximum budget and limits on how often and how much they change.'],
      ['Review what happened.', 'Every run and action is recorded, so you can see why something changed.'],
    ],
    fig: fig('autopilot', 'The OrivenAI Automations screen with automation rules', 'The Automations screen. Screenshot from the product.'),
    who: ['Advertisers who check the same numbers every day', 'Small teams that can’t watch campaigns around the clock', 'Anyone who wants automation they can explain'],
    know: ['Included from the Starter plan; creating an automation costs 50 credits once, its checks and changes are free', 'Works with the campaigns in your connected ad accounts; shared and lifetime budgets are never changed', 'Rules only do what you wrote; no AI decides what happens', 'Approval mode lets you confirm each change before it happens'],
    faq: [
      ['Can an automation spend more than I want?', 'A rule can only raise a budget up to the maximum you set, by at most the percentage you allow, and only after you confirm it may act on its own. You can also require approval before any change.'],
      ['How is this different from Google’s automated bidding?', 'Smart Bidding sets bids inside a campaign. Automations act on whole campaigns (switch on, pause, resume, budget) at times or on conditions you choose, across your connected ad accounts.'],
    ],
    links: [['/learn/what-is-ppc-automation/', 'What is PPC automation?'], ['/learn/how-to-automate-google-ads-safely/', 'How to automate Google Ads safely'], ['/ppc-automation-software/', 'PPC automation software']],
  },
  'product-business': {
    title: 'One profile that every campaign draws on',
    intro: 'Control Center holds what OrivenAI should know about your business, so Research, Create and Launch use the same facts instead of you re-typing them.',
    steps: [
      ['Add your business profile.', 'Name, website, industry, country, products, audiences and competitors.'],
      ['Set your brand identity.', 'Logo, colours and tone of voice, used when copy and creative are generated.'],
      ['Connect your ad accounts.', 'Google Ads, Meta Ads, TikTok Ads and Pinterest Ads, through each platform’s official sign-in.'],
      ['Let the other modules use it.', 'Research uses your country and website; Create uses your brand; Launch uses your country and business name as defaults you can change.'],
    ],
    fig: fig('control-center-v2', 'The OrivenAI Control Center with the business profile, brand identity and connected ad accounts', 'Control Center. Screenshot from the product.'),
    who: ['Every OrivenAI user: it’s where setup happens', 'Businesses with more than one ad platform to connect'],
    know: ['Your country matters: it’s used as the default market for research and campaigns, and OrivenAI never assumes one', 'Disconnecting an ad account doesn’t pause campaigns already running on it'],
    faq: [
      ['Can I target a different country for one campaign?', 'Yes. Your profile’s country is only the default; you can choose other countries for any campaign before it’s published.'],
      ['Do I need to connect every platform?', 'No. Connect only the platforms you advertise on.'],
    ],
    links: [['/learn/what-is-an-ai-advertising-platform/', 'What an AI advertising platform does'], ['/learn/how-to-manage-multiple-ad-platforms/', 'Managing multiple ad platforms']],
  },
  'product-google-ads': {
    tag: 'In detail',
    title: 'What OrivenAI builds on Google Ads',
    intro: 'OrivenAI connects to your Google Ads account through Google’s official API and creates complete campaigns, paused, for three campaign types.',
    steps: [
      ['Search.', 'Ad groups with keywords and match types, negative keywords, responsive search ads (headlines up to 30 characters, descriptions up to 90), callouts, structured snippets, and sitelinks once they point to a real page.'],
      ['Performance Max.', 'An asset group with headlines, a long headline, descriptions, square and landscape images, plus your business name and logo.'],
      ['Demand Gen.', 'An ad group with images, headlines, descriptions and your logo.'],
      ['Targeting and bidding.', 'Countries and languages you choose; a bidding strategy that follows your goal.'],
    ],
    who: ['Businesses whose customers search for what they sell', 'Advertisers who want Search, Performance Max and Demand Gen from one brief'],
    know: ['Sales and Leads campaigns need conversion actions in your Google Ads account', 'Performance Max and Demand Gen need a logo and business name in your profile', 'Campaigns are created paused; Google reviews ads under its own policies'],
    faq: [
      ['Does OrivenAI change my existing Google Ads campaigns?', 'Not unless you ask it to: it creates new campaigns, and Automations only act through schedules and rules you set up.'],
      ['Which bidding strategy is used?', 'One that matches your goal, for example maximising conversions for Sales or clicks for Traffic. You can change it in Google Ads.'],
    ],
    links: [['/learn/how-to-automate-google-ads-safely/', 'How to automate Google Ads safely'], ['/learn/google-ads-vs-meta-ads/', 'Google Ads vs Meta Ads'], ['/learn/ad-character-limits/', 'Ad character limits']],
  },
  'product-meta-ads': {
    tag: 'In detail',
    title: 'What OrivenAI builds on Meta',
    intro: 'OrivenAI creates Facebook and Instagram campaigns through Meta’s Marketing API, paused: the campaign, ad sets and ads, with targeting and tracking you’ve confirmed.',
    steps: [
      ['Campaign.', 'The objective that matches your goal, and your answer on special ad categories (housing, employment, financial products, social issues), which Meta requires.'],
      ['Ad sets.', 'Countries, languages, age range, placements (Facebook and Instagram, or one of them) and your daily budget. Extra ad sets can target different age groups.'],
      ['Ads.', 'Image ads with your headline, primary text and call to action, published from your Facebook Page and linked Instagram account.'],
      ['Tracking.', 'For Sales and Leads, the Meta Pixel you choose and the conversion event to optimise for. If the ad targets the EU, the transparency details Meta asks for.'],
    ],
    who: ['Businesses selling to consumers on Facebook and Instagram', 'Advertisers who want campaigns built with targeting and tracking already filled in'],
    know: ['Meta video ads aren’t published by OrivenAI yet; image ads are', 'If your ad account has several pixels, you choose which one; OrivenAI never picks silently', 'OrivenAI can create a Pixel and send a test server event; your website still needs the Pixel or a Conversions API integration to report real conversions'],
    faq: [
      ['Do I need a Facebook Page?', 'Yes. Meta ads run from a Page; Instagram placements also need an Instagram account linked to it.'],
      ['Will OrivenAI turn my campaign on?', 'No. It’s created paused, and you activate it in Meta Ads Manager.'],
    ],
    links: [['/learn/how-to-create-facebook-and-instagram-ads-with-ai/', 'Creating Facebook and Instagram ads with AI'], ['/learn/meta-pixel-vs-conversions-api/', 'Meta Pixel vs Conversions API'], ['/learn/ad-character-limits/', 'Ad character limits']],
  },
  'product-tiktok-ads': {
    tag: 'In detail',
    title: 'What OrivenAI builds on TikTok',
    intro: 'OrivenAI prepares TikTok video ads and creates them through TikTok’s Marketing API, paused, for traffic and awareness goals.',
    steps: [
      ['Video.', 'A vertical video generated in Create (or your own), uploaded with a cover image.'],
      ['Ad group.', 'Your countries, age range, language, daily budget and TikTok identity (the name and picture shown on the ad).'],
      ['Ad.', 'A hook and ad text of up to 100 characters, your call to action and a landing page with tracking parameters.'],
    ],
    who: ['Businesses with products that look good on camera', 'Advertisers testing short-form video for the first time'],
    know: ['TikTok ads from OrivenAI are video only', 'Traffic and Awareness goals are supported; Sales and Leads aren’t yet (they need the TikTok Pixel or lead forms)', 'TikTok requires a daily ad group budget above $20 (or the equivalent in your currency)', 'Pausing and editing happen in TikTok Ads Manager'],
    faq: [
      ['Can I run image ads on TikTok with OrivenAI?', 'No. TikTok’s main feed runs video, so OrivenAI only creates video ads for TikTok.'],
      ['What do I need before publishing?', 'A connected TikTok ad account, a TikTok identity, your countries, a video and a daily budget above TikTok’s minimum.'],
    ],
    links: [['/learn/tiktok-ads-for-small-business/', 'TikTok ads for small business'], ['/learn/how-to-test-ad-creatives/', 'How to test ad creatives'], ['/learn/ad-character-limits/', 'Ad character limits']],
  },
  'product-pinterest-ads': {
    tag: 'In detail',
    title: 'What OrivenAI builds on Pinterest',
    intro: 'OrivenAI creates Pinterest campaigns through Pinterest’s API, paused: a Pin from your creative, an ad group targeting your countries, and the ad.',
    steps: [
      ['Pin.', 'Your image (or video) with a title, description and alt text, saved to a board for your ads.'],
      ['Ad group.', 'The countries you advertise in and, for Sales and Leads, your Pinterest tag and the conversion event to optimise for.'],
      ['Campaign and ad.', 'The objective matching your goal, a daily spend cap, and the ad pointing to your page with tracking parameters.'],
    ],
    who: ['Businesses in home, fashion, food, beauty, gifts and events', 'Advertisers who want to reach people while they plan purchases'],
    know: ['Sales and Leads campaigns need a Pinterest tag on your ad account', 'Pinterest ads are only available in some countries; OrivenAI warns you if yours isn’t one of them', 'Pinterest recommends 2:3 images (1000 × 1500 px)'],
    faq: [
      ['Do I need a Pinterest business account?', 'Yes. Pinterest requires a business account to advertise.'],
      ['Can I pause Pinterest campaigns from OrivenAI?', 'Yes, from Campaigns, after a confirmation.'],
    ],
    links: [['/learn/pinterest-ads-for-small-business/', 'Pinterest ads for small business'], ['/learn/ai-ads-for-ecommerce/', 'AI ads for e-commerce'], ['/learn/ad-character-limits/', 'Ad character limits']],
  },
};

module.exports = { D, block };
