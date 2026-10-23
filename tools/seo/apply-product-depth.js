#!/usr/bin/env node
// Inserts (or refreshes) the in-depth sections from tools/seo/product-depth.js
// into the product views of index.html, just before each view's closing CTA.
// Idempotent: content between <!-- depth:start --> and <!-- depth:end --> is
// replaced on every run.   node tools/seo/apply-product-depth.js
const fs = require('fs');
const path = require('path');
const { D, block } = require('./product-depth');
const FILE = path.resolve(__dirname, '..', '..', 'index.html');

let html = fs.readFileSync(FILE, 'utf8');
const crlf = html.includes('\r\n');
html = html.split('\r').join('');

for (const [key, data] of Object.entries(D)) {
  const startTag = `<div id="view-${key}" class="pub-view">`;
  const endTag = `<!-- /view-${key} -->`;
  const a = html.indexOf(startTag), b = html.indexOf(endTag, a);
  if (a < 0 || b < 0) throw new Error('view not found: ' + key);
  let view = html.slice(a, b);
  view = view.replace(/\n?\s*<!-- depth:start -->[\s\S]*?<!-- depth:end -->/, '');
  const cta = view.lastIndexOf('<section class="ov-sp-cta">');
  if (cta < 0) throw new Error('no CTA section in ' + key);
  const lineStart = view.lastIndexOf('\n', cta);
  const ctaComment = view.lastIndexOf('<!-- CTA -->', cta);
  const at = ctaComment > lineStart - 40 && ctaComment > 0 && ctaComment < cta ? view.lastIndexOf('\n', ctaComment) : lineStart;
  view = view.slice(0, at) + '\n\n  ' + block(key, data) + '\n' + view.slice(at);
  html = html.slice(0, a) + view + html.slice(b);
}

// Pricing: the plan cards are rendered by JavaScript (plans.js); this static
// comparison gives every visitor (and crawler) the same facts in plain HTML.
// Values from tools/seo/facts.js (mirrors js/plans.js) and the backend's
// planEntitlements.js (Oriven Chat and in-app notifications from Creator;
// Priority Support and the Weekly AI Performance Report on Professional).
{
  const F = require('./facts');
  const yes = '<span aria-label="Included">✓</span>', no = '<span aria-label="Not included">—</span>';
  // The workflow is one row (Free: limited; paid plans: all six steps), never
  // six separate module rows. A string cell is shown as text.
  const ent = { free: ['Limited',1,0,0,0,0], starter: ['Full',1,0,0,0,0], creator: ['Full',1,1,1,0,0], professional: ['Full',1,1,1,1,1] };
  const rows = [['Advertising workflow'], ['Google Ads, Meta Ads, TikTok Ads and Pinterest Ads'], ['Oriven Chat'], ['In-app notifications'], ['Priority Support'], [F.weeklyReportLive ? 'Weekly AI Performance Report' : 'Weekly AI Performance Report (coming soon)']];
  const head = F.plans.map((p) => '<th scope="col">' + p.name + '<br><span>' + (p.price ? '€' + p.price.toFixed(2) + ' / month' : 'Free') + '</span></th>').join('');
  const body = '<tr><th scope="row">Credits</th>' + F.plans.map((p) => '<td>' + p.credits + '</td>').join('') + '</tr>' +
    rows.map((r, i) => '<tr><th scope="row">' + r[0] + '</th>' + F.plans.map((p) => '<td>' + (typeof ent[p.id][i] === 'string' ? ent[p.id][i] : ent[p.id][i] ? yes : no) + '</td>').join('') + '</tr>').join('') +
    '<tr><th scope="row"><span class="ov-sr">Note</span></th><td colspan="4">Limited: Control Center, Create, Launch and Campaigns. Full: all six steps, adding Research and Automations.</td></tr>';
  const costs = [['Campaign draft (copy and structure)', 25], ['Image (per ad)', 75], ['Video (per ad)', 200], ['Research report', 25], ['Oriven Chat message (Creator and Professional)', 5], ['New automation (once; its checks and changes are free)', 50]];
  const block = `<!-- pricing-detail:start -->
  <section class="ov-sp-section ov-deep ov-price-detail" aria-labelledby="price-detail-h">
    <div class="ov-sp-section-inner">
      <div class="ov-sp-tag">Compare plans</div>
      <h2 class="ov-sp-h2" id="price-detail-h">What each plan includes</h2>
      <p class="ov-deep-intro">Every plan uses the same product. Plans differ in how many credits you get and which modules are included. Prices are per month in euros.</p>
      <div class="ov-price-table-wrap"><table class="ov-price-table"><thead><tr><th scope="col"><span class="ov-sr">Feature</span></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <h3>What things cost in credits</h3>
      <div class="ov-price-table-wrap"><table class="ov-price-table ov-price-costs"><tbody>${costs.map((c) => '<tr><th scope="row">' + c[0] + '</th><td>' + c[1] + ' credits</td></tr>').join('')}</tbody></table></div>
      <div class="ov-deep-cols">
        <div><h3>How credits work</h3><ul><li>The Free plan gets 10 credits a day; paid plans get a monthly allowance.</li><li>An image ad campaign typically uses 100 credits (draft plus one image); a video ad campaign 225.</li><li>If a generation fails, its credits are returned.</li></ul></div>
        <div><h3>Good to know</h3><ul><li>You can start on Free and upgrade when you need Research, Automations or more credits.</li><li>Your ad spend is paid to the ad platforms directly; OrivenAI never charges ad budgets.</li><li>Campaigns are created paused, so nothing spends until you switch it on.</li></ul></div>
      </div>
      <p class="ov-deep-links"><span>Questions</span><a href="/faq">Read the FAQ</a><a href="/contact">Contact us</a></p>
    </div>
  </section>
  <!-- pricing-detail:end -->`;
  const a = html.indexOf('<div id="view-pricing" class="pub-view">'), b = html.indexOf('<!-- /view-pricing -->', a);
  let view = html.slice(a, b).replace(/\n?\s*<!-- pricing-detail:start -->[\s\S]*?<!-- pricing-detail:end -->/, '');
  const cta = view.lastIndexOf('<section class="ov-sp-cta">');
  const at = view.lastIndexOf('\n', cta);
  view = view.slice(0, at) + '\n\n  ' + block + '\n' + view.slice(at);
  html = html.slice(0, a) + view + html.slice(b);
}

// Accuracy: the Meta page overstated Conversions API support. OrivenAI can
// create a Pixel and send a test server event; it doesn't forward a site's
// real conversions.
const fixes = [
  ['<div class="ov-plat-connect-item"><span class="ov-plat-check">&#10003;</span>Send server-side conversion events</div>',
   '<div class="ov-plat-connect-item"><span class="ov-plat-check">&#10003;</span>Test server-side (Conversions API) events</div>'],
  ['<div class="ov-plat-feat-desc">Oriven creates and verifies your Meta Pixel, then sends server-side conversion events so tracking stays reliable.</div>',
   '<div class="ov-plat-feat-desc">Oriven finds or creates your Meta Pixel, checks that it receives events, and can send a test server-side event to confirm a Conversions API connection.</div>'],
];
for (const [x, y] of fixes) { if (html.includes(x)) html = html.replace(x, y); }

if (crlf) html = html.split('\n').join('\r\n');
fs.writeFileSync(FILE, html);
console.log('product depth applied to', Object.keys(D).length, 'views');
