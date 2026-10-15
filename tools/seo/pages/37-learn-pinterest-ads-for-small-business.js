// Guide — intent: "pinterest ads for small business", "how to start
// pinterest ads", "is pinterest advertising worth it". Pinterest facts
// checked against Pinterest Business help on 2026-10-15 (sources below).
// OrivenAI behaviour described as implemented in services/campaignSpec.js
// (country targeting, Pinterest Tag required for Sales/Leads, paused).
module.exports = {
  path: '/learn/pinterest-ads-for-small-business/',
  kind: 'article',
  datePublished: '2026-10-15',
  reviewed: '2026-10-15',
  readMinutes: 9,
  title: 'Pinterest Ads for Small Business: A First Campaign Guide | OrivenAI',
  ogTitle: 'Pinterest ads for small business: a practical first campaign',
  description: 'When Pinterest ads make sense for a small business, what to set up first, which objective to choose, creative specs, budgets and measurement.',
  crumb: 'Pinterest ads for small business',
  teaser: 'When Pinterest fits, what to set up, and a first campaign plan.',
  breadcrumbs: [{ name: 'Learn', path: '/learn/' }],
  eyebrow: 'Platform guide',
  h1: 'Pinterest ads for small business: a practical first campaign',
  about: 'Pinterest advertising',
  sources: [
    { title: 'Ads overview (availability and business accounts) — Pinterest Business help', url: 'https://help.pinterest.com/en/business/article/promoted-pins-overview' },
    { title: 'Select a campaign objective — Pinterest Business help', url: 'https://help.pinterest.com/en/business/article/campaign-objectives' },
    { title: 'Review ad specs — Pinterest Business help', url: 'https://help.pinterest.com/en/business/article/pinterest-product-specs' },
    { title: 'Install the Pinterest tag — Pinterest Business help', url: 'https://help.pinterest.com/en/business/article/install-the-pinterest-tag' },
    { title: 'Pinterest Trends', url: 'https://trends.pinterest.com/' },
  ],
  body: `
<div class="sp-tldr"><strong>Short answer</strong><p>Pinterest ads suit businesses whose customers plan ahead: home, fashion, food, beauty, weddings, gifts and DIY. You need a Pinterest business account in a country where ads are available, a website, and the Pinterest tag if you want to measure sales or sign-ups. Start with one campaign, one clear objective and three to five vertical (2:3) images built around what people search for.</p></div>

<p>Pinterest behaves more like a search engine than a social feed. People come to plan: a kitchen, an outfit, a birthday, a garden. That makes it unusual among ad platforms, because your ad can meet someone while they’re still deciding what to buy, often weeks before they buy it. For a small business with visual products, that early moment is cheaper to reach than the last click on Google.</p>

<h2>Is Pinterest right for your business?</h2>
<p>It usually fits when three things are true:</p>
<ul>
  <li><strong>Your product is visual</strong> and looks good in a tall image: furniture, clothing, recipes, crafts, décor, cosmetics, travel.</li>
  <li><strong>People plan the purchase.</strong> Seasonal and project-based buying (holidays, home projects, events) is where Pinterest is strongest.</li>
  <li><strong>You can send people to a page that matches the Pin.</strong> A product or collection page, not a generic homepage.</li>
</ul>
<p>It fits less well for urgent needs (an emergency plumber), complex B2B purchases, or products that are hard to show in a picture. If that’s you, search ads on Google are usually a better first channel; see <a href="/learn/google-ads-vs-meta-ads/">Google Ads vs Meta Ads</a>.</p>

<h2>What you need before you start</h2>
<ol>
  <li><strong>A Pinterest business account.</strong> Ads require one, and the country you pick when you first open Ads Manager sets your billing currency for good.</li>
  <li><strong>A country where Pinterest ads are available.</strong> Pinterest lists about 40 countries where you can set up an ad account directly, and further markets served through partners. Check the ads overview page before you plan a campaign.</li>
  <li><strong>The Pinterest tag on your website</strong> if you want to optimise for or measure purchases, sign-ups or other on-site actions. Without it, you can still run awareness and traffic campaigns, but you can’t see which Pins led to sales.</li>
  <li><strong>Three to five images</strong> in 2:3 format (1000 × 1500 px is Pinterest’s recommendation).</li>
</ol>

<h2>Choosing an objective</h2>
<p>Pinterest’s current objectives are brand awareness, video completion, consideration, leads and sales. For a first campaign, the choice comes down to what you can measure:</p>
<div class="sp-table-wrap"><table class="sp-table"><thead><tr><th>Objective</th><th>Optimises for</th><th>Choose it when</th></tr></thead><tbody>
<tr><td>Brand awareness</td><td>Getting your Pins seen</td><td>You’re new on Pinterest and want people to discover the brand.</td></tr>
<tr><td>Consideration</td><td>Pin clicks and outbound clicks</td><td>You want traffic to product pages and don’t have the tag yet.</td></tr>
<tr><td>Leads / Sales</td><td>Actions on your website, such as checkout or sign-up</td><td>The Pinterest tag is installed and recording those actions.</td></tr>
<tr><td>Video completion</td><td>Completed video views</td><td>You have strong vertical video and want it watched.</td></tr>
</tbody></table></div>
<p>A sensible path for a small shop: start with consideration to learn which Pins earn clicks, install the tag in parallel, then move your best Pins into a sales campaign once the tag has recorded a few weeks of purchases.</p>

<h2>Creative that works on Pinterest</h2>
<ul>
  <li><strong>Go vertical.</strong> Pinterest recommends a 2:3 ratio; taller images may be cropped in feeds.</li>
  <li><strong>Show the product in use</strong> (the shirt on a person, the lamp in a room) rather than on a white background alone.</li>
  <li><strong>Write titles for search.</strong> Titles can be 100 characters, but only the first 40 may show in feeds, so lead with the words people search: “Linen summer shirt”, not “Our new collection”. See <a href="/learn/ad-character-limits/">ad character limits</a>.</li>
  <li><strong>Use the description</strong> (up to 800 characters). It isn’t shown in feeds, but Pinterest uses it to judge where your Pin is relevant.</li>
  <li><strong>Plan ahead of the season.</strong> People plan summer outfits in spring and holiday gifts in autumn. <a href="https://trends.pinterest.com/" rel="noopener">Pinterest Trends</a> shows when searches for a topic rise.</li>
</ul>

<h2>Budgets and expectations</h2>
<p>Start small and give the campaign enough time to learn: one campaign, one ad group, a daily budget you’re comfortable losing while you learn, and at least two to three weeks before judging it. Pinterest is an earlier-funnel channel, so judge it on clicks and saves in the first weeks and on tagged sales over a longer window, not on next-day revenue.</p>

<h2>How to measure it honestly</h2>
<ul>
  <li><strong>Use the tag for conversions</strong> and UTM parameters on every link, so your own analytics can see Pinterest traffic too.</li>
  <li><strong>Compare like with like.</strong> Pinterest often finds people earlier in the buying journey, so last-click reports undercount it.</li>
  <li><strong>Keep a simple log</strong> of which images and titles you ran and what happened. That record is worth more than any single campaign.</li>
</ul>

<h2>Running a Pinterest campaign with OrivenAI</h2>
<figure class="sp-figure"><img src="/assets/films/posters/film-create-800.webp" alt="The OrivenAI Create screen with Google Ads, Meta Ads, TikTok Ads and Pinterest Ads to choose from, campaign goals, and the creative stage" width="800" height="450" loading="lazy" decoding="async"><figcaption>The Create screen in OrivenAI. Pinterest Ads is one of the four platforms you can choose for a campaign.</figcaption></figure>
<p>In <a href="/create">Create</a>, choose Pinterest Ads and describe what you’re selling. OrivenAI drafts the Pin title, description and alt text, generates a vertical image (or uses one you attach), and prepares the campaign structure. Before anything is published, <a href="/launch">Launch</a> checks what Pinterest will need:</p>
<ul>
  <li>The country to target. It comes from your business profile or your choice; OrivenAI never assumes one.</li>
  <li>Your daily budget, which you always set yourself.</li>
  <li>For sales and leads campaigns, a Pinterest tag on your ad account. Without one, OrivenAI won’t publish a conversion campaign it can’t measure.</li>
</ul>
<p>The campaign is created on Pinterest paused, so you can review it in Pinterest Ads Manager and switch it on when you’re ready. See <a href="/product/pinterest-ads">OrivenAI for Pinterest Ads</a>.</p>
`,
  faq: [
    ['Is Pinterest advertising worth it for a small business?', '<p>It can be if your product is visual and people plan the purchase: home, fashion, food, beauty, events and gifts. It is usually weaker for urgent needs or complex B2B products, where search ads tend to work better.</p>'],
    ['Do I need the Pinterest tag?', '<p>Only if you want to optimise for or measure actions on your website, such as purchases or sign-ups. Awareness and traffic campaigns can run without it, but you won’t see which Pins led to sales.</p>'],
    ['What image size should Pinterest ads use?', '<p>Pinterest recommends a 2:3 aspect ratio, for example 1000 × 1500 pixels. Taller images may be cropped in feeds.</p>'],
    ['Can I advertise on Pinterest from any country?', '<p>No. Pinterest lists the countries where you can set up an ad account directly, and others served through advertising partners. Check its ads overview page for the current list.</p>'],
  ],
  related: ['/product/pinterest-ads', '/learn/ad-character-limits/', '/learn/how-to-test-ad-creatives/'],
};
