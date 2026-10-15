// Reference + free tool — intent: "google ads headline character limit",
// "facebook ad character limit", "pinterest pin description length",
// "tiktok ad text length". Every limit below was checked against the
// platform's own documentation on 2026-10-15 (see sources). TikTok does
// not publish a hard caption limit on its spec page, so none is invented.
const S = {
  rsa: { title: 'About responsive search ads — Google Ads Help', url: 'https://support.google.com/google-ads/answer/7684791' },
  callout: { title: 'About callout assets — Google Ads Help', url: 'https://support.google.com/google-ads/answer/6079510' },
  sitelink: { title: 'About sitelink assets — Google Ads Help', url: 'https://support.google.com/google-ads/answer/2375416' },
  meta: { title: 'Facebook Feed image ad specifications — Meta Ads Guide', url: 'https://www.facebook.com/business/ads-guide/update/image/facebook-feed' },
  tiktok: { title: 'TikTok Auction In-Feed Ads specifications — TikTok Ads Manager help', url: 'https://ads.tiktok.com/help/article/video-ads-specifications' },
  pin: { title: 'Review ad specs — Pinterest Business help', url: 'https://help.pinterest.com/en/business/article/pinterest-product-specs' },
};

// Limits used by the counter: [label, limit, kind, note]
const FIELDS = [
  ['Google Ads — RSA headline', 30, 'max', 'Hard limit. Up to 15 headlines, at least 3.'],
  ['Google Ads — RSA description', 90, 'max', 'Hard limit. Up to 4 descriptions, at least 2.'],
  ['Google Ads — display URL path', 15, 'max', 'Per path field (two fields).'],
  ['Google Ads — callout', 25, 'max', '12 in double-width languages.'],
  ['Google Ads — sitelink text', 25, 'max', '12 in double-width languages.'],
  ['Meta — headline (Feed image)', 27, 'rec', 'Meta’s recommendation; longer text may be cut off.'],
  ['Meta — primary text (Feed image)', 150, 'rec', 'Meta recommends 50–150 characters.'],
  ['TikTok — display name', 20, 'max', '10 for Chinese, Japanese and Korean.'],
  ['Pinterest — Pin title', 100, 'max', 'Only the first 40 may show in feeds on some devices.'],
  ['Pinterest — Pin description', 800, 'max', 'Not shown in feeds, but used for relevance.'],
];

const script = `(function(){var F=${JSON.stringify(FIELDS)};var sel=document.getElementById('ccField'),ta=document.getElementById('ccText'),out=document.getElementById('ccOut');if(!sel||!ta||!out)return;
F.forEach(function(f,i){var o=document.createElement('option');o.value=i;o.textContent=f[0]+' ('+(f[2]==='rec'?'recommended ':'')+f[1]+')';sel.appendChild(o);});
function len(s,dbl){var n=0;for(var ch of s){n+=(dbl&&/[\\u1100-\\u115F\\u2E80-\\uA4CF\\uAC00-\\uD7A3\\uF900-\\uFAFF\\uFE30-\\uFE4F\\uFF00-\\uFF60\\uFFE0-\\uFFE6]/.test(ch))?2:1;}return n;}
function upd(){var f=F[+sel.value],dbl=f[0].indexOf('Google')===0,n=len(ta.value,dbl),left=f[1]-n;
out.innerHTML='<span><strong>'+n+'</strong> characters'+(dbl?' (double-width count as 2)':'')+'</span><span class="'+(left<0?'sp-tool-over':'')+'"><strong>'+(left<0?(-left)+' over':left+' left')+'</strong> of '+f[1]+(f[2]==='rec'?' recommended':'')+'</span><span>'+f[3]+'</span>';}
sel.addEventListener('change',upd);ta.addEventListener('input',upd);upd();})();`;

module.exports = {
  path: '/learn/ad-character-limits/',
  kind: 'article',
  datePublished: '2026-10-15',
  reviewed: '2026-10-15',
  readMinutes: 6,
  title: 'Ad Character Limits: Google, Meta, TikTok & Pinterest | OrivenAI',
  ogTitle: 'Ad character limits for Google, Meta, TikTok and Pinterest',
  description: 'Character limits for Google Ads, Meta, TikTok and Pinterest ads, checked against each platform’s documentation, with a free counter for your copy.',
  crumb: 'Ad character limits',
  teaser: 'Every platform’s text limits in one table, with a free counter.',
  breadcrumbs: [{ name: 'Learn', path: '/learn/' }],
  eyebrow: 'Reference',
  h1: 'Ad character limits for Google, Meta, TikTok and Pinterest',
  about: 'Advertising text limits',
  script,
  sources: [S.rsa, S.callout, S.sitelink, S.meta, S.tiktok, S.pin],
  body: `
<div class="sp-tldr"><strong>Short answer</strong><p>Google Ads responsive search ads allow 30 characters per headline and 90 per description. Callouts and sitelink text allow 25. Meta recommends a 27-character headline and 50–150 characters of primary text for Feed image ads. Pinterest allows a 100-character title and an 800-character description. TikTok’s spec page doesn’t state a hard caption limit, but shows captions in at most four lines and display names in up to 20 characters.</p></div>

<p>Character limits decide whether your message survives. Some are hard limits: the ad platform won’t accept longer text. Others are recommendations: longer text is accepted but gets cut off behind “See more”, so the part people actually read is shorter than what you wrote. This page separates the two, and every number links to the platform’s own documentation.</p>

<h2>Check your copy</h2>
<div class="sp-tool" role="group" aria-labelledby="ccLabel">
  <label id="ccLabel" for="ccField">Field</label>
  <select id="ccField"></select>
  <label for="ccText">Your text</label>
  <textarea id="ccText" placeholder="Type or paste your headline, description or caption"></textarea>
  <div class="sp-tool-out" id="ccOut" aria-live="polite"></div>
</div>
<p class="sp-note">The counter runs in your browser; nothing you type is sent anywhere. For Google Ads, Chinese, Japanese and Korean characters count as two, as Google does.</p>

<h2>Google Ads</h2>
<div class="sp-table-wrap"><table class="sp-table"><thead><tr><th>Field</th><th>Limit</th><th>Notes</th></tr></thead><tbody>
<tr><td>Responsive search ad headline</td><td>30 characters</td><td>Up to 15 headlines; at least 3 required.</td></tr>
<tr><td>Responsive search ad description</td><td>90 characters</td><td>Up to 4 descriptions; at least 2 required.</td></tr>
<tr><td>Display URL path (each of 2)</td><td>15 characters</td><td>Shown after your domain in the ad.</td></tr>
<tr><td>Callout</td><td>25 characters</td><td>12 in double-width languages.</td></tr>
<tr><td>Sitelink text</td><td>25 characters</td><td>12 in double-width languages.</td></tr>
</tbody></table></div>
<p>Google counts double-width characters (such as Chinese, Japanese and Korean) as two. Because responsive search ads mix your headlines in different combinations, each headline should make sense on its own: avoid headlines that only work next to one specific other headline.</p>

<h2>Meta (Facebook and Instagram)</h2>
<div class="sp-table-wrap"><table class="sp-table"><thead><tr><th>Field (Feed image ad)</th><th>Guidance</th><th>Notes</th></tr></thead><tbody>
<tr><td>Primary text</td><td>50–150 characters recommended</td><td>Longer text is truncated behind “See more”.</td></tr>
<tr><td>Headline</td><td>27 characters recommended</td><td>Placement decides how much shows.</td></tr>
<tr><td>Image</td><td>4:5, 1440 × 1800 px recommended</td><td>From the same ads guide page.</td></tr>
</tbody></table></div>
<p>Meta publishes recommendations per placement rather than one set of hard limits, and they differ between Feed, Stories and Reels. Put the hook in the first line of primary text, because that is often all people see before tapping.</p>

<h2>TikTok</h2>
<div class="sp-table-wrap"><table class="sp-table"><thead><tr><th>Field (In-Feed ad)</th><th>Guidance</th><th>Notes</th></tr></thead><tbody>
<tr><td>Display name</td><td>Up to 20 characters</td><td>10 for Chinese, Japanese and Korean; shown on one line.</td></tr>
<tr><td>Caption</td><td>Shown in up to 4 lines</td><td>TikTok’s spec page states no hard character limit. Non-Spark captions can’t include links, “@” or hashtags.</td></tr>
<tr><td>Video</td><td>9:16 recommended, at least 540 × 960 px</td><td>Up to 500 MB for non-Spark ads.</td></tr>
</tbody></table></div>
<p>Keep TikTok captions to one short sentence: the video does the work, and four lines go fast on a small screen. OrivenAI caps TikTok ad text at 100 characters for the same reason.</p>

<h2>Pinterest</h2>
<div class="sp-table-wrap"><table class="sp-table"><thead><tr><th>Field (standard image ad)</th><th>Limit</th><th>Notes</th></tr></thead><tbody>
<tr><td>Title</td><td>100 characters</td><td>Only the first 40 may show in feeds on some devices (30 for double-byte languages).</td></tr>
<tr><td>Description</td><td>800 characters</td><td>Not shown in feeds, but Pinterest uses it to judge relevance.</td></tr>
<tr><td>Image</td><td>2:3, 1000 × 1500 px recommended</td><td>Taller images may be cropped.</td></tr>
</tbody></table></div>
<p>Put the keyword people search for early in the title: Pinterest is a search engine as much as a feed, and the first 40 characters are what most people see.</p>

<h2>Writing within the limits</h2>
<ul>
  <li><strong>Lead with the specific benefit.</strong> “Linen shirts that stay cool” beats “Discover our new collection” in the same space.</li>
  <li><strong>Write each field to stand alone.</strong> Google combines headlines; Meta and TikTok cut text; Pinterest hides descriptions.</li>
  <li><strong>Cut words, not meaning.</strong> Numbers (“Ships in 24h”) and concrete nouns carry more in fewer characters.</li>
  <li><strong>Keep a longer version</strong> for placements that show more, rather than writing to the shortest limit everywhere.</li>
</ul>

<h2>How OrivenAI handles limits</h2>
<p>When <a href="/create">Create</a> drafts a campaign, it writes copy for the platform you chose, and the ad editor shows a live counter on each field so you can see when text runs over. Google Ads headlines and descriptions are checked against the 30 and 90 character limits before <a href="/launch">Launch</a> will publish them. Nothing is published until you review it, and campaigns are created paused.</p>
`,
  faq: [
    ['What is the character limit for a Google Ads headline?', '<p>30 characters for each responsive search ad headline, and 90 characters for each description. You can add up to 15 headlines and 4 descriptions.</p>'],
    ['How long should Facebook ad primary text be?', '<p>Meta recommends 50–150 characters of primary text for Feed image ads. Longer text is allowed but is cut off behind “See more”, so put the hook first.</p>'],
    ['How many characters can a Pinterest Pin description have?', '<p>Up to 800 characters. Descriptions are not shown in feeds, but Pinterest uses them to decide where your Pin is relevant. Titles allow up to 100 characters.</p>'],
    ['Is there a character limit for TikTok ad captions?', '<p>TikTok’s ad specification page does not state a hard character limit. It shows captions in at most four lines, so keep them to one short sentence.</p>'],
  ],
  related: ['/learn/how-to-create-facebook-and-instagram-ads-with-ai/', '/learn/how-to-test-ad-creatives/', '/product/google-ads'],
};
