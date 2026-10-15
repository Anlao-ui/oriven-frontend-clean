// Guide — intent: "tiktok ads for small business", "how to start tiktok
// ads", "tiktok ads minimum budget". TikTok facts checked against TikTok
// Ads Manager help on 2026-10-15 (sources). OrivenAI behaviour as
// implemented (services/campaignSpec.js): video ads only, Traffic and
// Awareness, ad group budget above 20/day, created paused.
module.exports = {
  path: '/learn/tiktok-ads-for-small-business/',
  kind: 'article',
  datePublished: '2026-10-15',
  reviewed: '2026-10-15',
  readMinutes: 9,
  title: 'TikTok Ads for Small Business: Budgets, Specs, First Campaign | OrivenAI',
  ogTitle: 'TikTok ads for small business: what you need and how to start',
  description: 'What a small business needs to run TikTok ads: minimum budgets, video specs, the TikTok Pixel, Spark Ads, how to plan a first campaign and how to judge results.',
  crumb: 'TikTok ads for small business',
  teaser: 'Budgets, video specs, the pixel and a first campaign plan.',
  breadcrumbs: [{ name: 'Learn', path: '/learn/' }],
  eyebrow: 'Platform guide',
  h1: 'TikTok ads for small business: what you need and how to start',
  about: 'TikTok advertising',
  sources: [
    { title: 'About Budget — TikTok Ads Manager help', url: 'https://ads.tiktok.com/help/article/budget' },
    { title: 'TikTok Auction In-Feed Ads specifications — TikTok Ads Manager help', url: 'https://ads.tiktok.com/help/article/video-ads-specifications' },
    { title: 'About TikTok Pixel — TikTok Ads Manager help', url: 'https://ads.tiktok.com/help/article/tiktok-pixel' },
    { title: 'About Spark Ads — TikTok Ads Manager help', url: 'https://ads.tiktok.com/help/article/spark-ads' },
    { title: 'TikTok One Creative Suite (formerly Creative Center)', url: 'https://ads.tiktok.com/business/creativecenter' },
  ],
  body: `
<div class="sp-tldr"><strong>Short answer</strong><p>TikTok ads are video ads. To start you need a TikTok Ads Manager account, vertical video (9:16 is recommended), and a daily budget that exceeds $20 per ad group and $50 per campaign, the minimums in TikTok’s help. Install the TikTok Pixel if you want to optimise for purchases or sign-ups. Start with one ad group, three short videos and a traffic or reach goal, and judge it on watch time and clicks before sales.</p></div>

<p>TikTok rewards a different kind of advertising than Google or Meta. People don’t come to TikTok to shop or search; they come to watch. Ads that look like ads get skipped in a second, while ads that look like TikTok videos (a person, a hook, something happening) get watched. For a small business that can film on a phone, that’s an advantage: polish matters less than being interesting in the first two seconds.</p>

<h2>Is TikTok right for your business?</h2>
<ul>
  <li><strong>Good fit:</strong> products you can demonstrate or that look satisfying on camera (food, beauty, fashion, gadgets, home), audiences under about 45, impulse or low-consideration purchases, and businesses that can make several short videos a month.</li>
  <li><strong>Harder fit:</strong> products you can’t show, long B2B sales cycles, and businesses that can only produce one polished video a quarter. TikTok creative wears out quickly, so you need a steady supply.</li>
</ul>

<h2>What you need before you start</h2>
<ol>
  <li><strong>A TikTok Ads Manager account</strong> and a payment method.</li>
  <li><strong>Budget above the minimums.</strong> TikTok’s help lists daily budgets that must exceed $20 at ad group level and $50 at campaign level (in your account currency).</li>
  <li><strong>Vertical video.</strong> TikTok recommends 9:16 and at least 540 × 960 pixels for In-Feed ads; files can be up to 500 MB.</li>
  <li><strong>An identity</strong> (the name and profile picture shown on the ad). Display names show up to 20 characters.</li>
  <li><strong>The TikTok Pixel</strong> on your website if you want to measure or optimise for actions like add-to-cart or purchases. It reports the website events you configure back to TikTok.</li>
</ol>

<h2>Spark Ads or regular In-Feed ads?</h2>
<p>Spark Ads promote an existing organic TikTok post, keeping its likes, comments and the account behind it. Regular (non-Spark) In-Feed ads are uploaded directly in Ads Manager. If you already post on TikTok and one video is doing well organically, promoting it as a Spark Ad is often the simplest start. If you don’t post organically, upload videos as regular ads; note that non-Spark captions can’t include links, “@” mentions or hashtags.</p>

<h2>Making videos that hold attention</h2>
<ul>
  <li><strong>Hook in the first two seconds:</strong> show the result, ask the question, or start mid-action.</li>
  <li><strong>Film vertically, on a phone, in good light.</strong> Native-looking video tends to fit the feed better than a cut-down TV ad.</li>
  <li><strong>Add captions on screen.</strong> Many people watch without sound.</li>
  <li><strong>Keep the caption short.</strong> TikTok shows captions in at most four lines; one sentence is plenty. See <a href="/learn/ad-character-limits/">ad character limits</a>.</li>
  <li><strong>Make three to five versions</strong> with different hooks and test them against each other; see <a href="/learn/how-to-test-ad-creatives/">how to test ad creatives</a>.</li>
</ul>
<p>To see what’s common in your category, browse TikTok’s own creative inspiration tools (the former Creative Center, now part of TikTok One). Learn the patterns, then make your own version rather than copying.</p>

<h2>A first campaign plan</h2>
<ol>
  <li><strong>Goal:</strong> traffic to one product page, or reach if you’re introducing the brand.</li>
  <li><strong>Structure:</strong> one campaign, one ad group, three to five videos.</li>
  <li><strong>Targeting:</strong> your country (or countries) and a broad age range; let the videos find the audience.</li>
  <li><strong>Budget:</strong> above TikTok’s minimums, at a level you can sustain for two weeks.</li>
  <li><strong>Review after a week:</strong> pause videos people swipe past, make new versions of the ones they watch.</li>
</ol>

<h2>Judging results</h2>
<p>In the first weeks, look at the signals TikTok gives you quickly: how long people watch, how many click, and what your cost per click is. Sales take longer and need the Pixel to attribute. Expect to replace videos every few weeks; a drop in watch time on a previously good video is the usual sign of creative fatigue.</p>

<h2>Running a TikTok campaign with OrivenAI</h2>
<p>In <a href="/create">Create</a>, choose TikTok Ads and the Video format. OrivenAI writes the hook and ad text (capped at 100 characters), generates a vertical video, and prepares one ad group per your structure. Before publishing, <a href="/launch">Launch</a> checks what TikTok needs: a video, a TikTok identity, your countries and a daily budget above $20 per ad group, which you always set yourself.</p>
<p>What OrivenAI does not do on TikTok yet, so you know before you start:</p>
<ul>
  <li><strong>Image ads:</strong> not supported, because TikTok’s main feed runs video.</li>
  <li><strong>Sales and Leads goals:</strong> not yet. They need the TikTok Pixel or TikTok’s lead forms, which OrivenAI doesn’t configure. Traffic and Awareness are supported.</li>
</ul>
<p>Campaigns are created on TikTok paused, so you review them in TikTok Ads Manager and switch them on yourself. See <a href="/product/tiktok-ads">OrivenAI for TikTok Ads</a>.</p>
`,
  faq: [
    ['What is the minimum budget for TikTok ads?', '<p>TikTok’s help lists daily budgets that must exceed $20 per ad group and $50 per campaign. Plan to spend at that level for at least a couple of weeks before judging results.</p>'],
    ['Can I run image ads on TikTok?', '<p>TikTok’s main In-Feed placement is video. Plan for vertical video (9:16 recommended); image formats are limited to specific placements.</p>'],
    ['Do I need the TikTok Pixel?', '<p>You need it to measure or optimise for actions on your website, such as purchases. Traffic and reach campaigns can run without it.</p>'],
    ['What are Spark Ads?', '<p>Spark Ads promote an existing organic TikTok post, keeping its engagement and the account behind it. They’re a simple start if one of your organic videos already does well.</p>'],
  ],
  related: ['/product/tiktok-ads', '/learn/ad-character-limits/', '/learn/how-to-test-ad-creatives/'],
};
