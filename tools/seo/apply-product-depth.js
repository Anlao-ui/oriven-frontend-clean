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

// Shared footer, bottom CTA, "Inside <section>" and Solutions (tools/seo/apply-site-chrome.js).
html = require('./apply-site-chrome')(html);

// The closing CTA: the shared one (between markers), or the old CTA section.
function ctaAt(view) { const m = view.lastIndexOf('<!-- site-cta:start -->'); return m >= 0 ? m : view.lastIndexOf('<section class="ov-sp-cta">'); }

for (const [key, data] of Object.entries(D)) {
  const startTag = `<div id="view-${key}" class="pub-view">`;
  const endTag = `<!-- /view-${key} -->`;
  const a = html.indexOf(startTag), b = html.indexOf(endTag, a);
  if (a < 0 || b < 0) throw new Error('view not found: ' + key);
  let view = html.slice(a, b);
  view = view.replace(/\n?\s*<!-- depth:start -->[\s\S]*?<!-- depth:end -->/, '');
  const cta = ctaAt(view);
  if (cta < 0) throw new Error('no CTA section in ' + key);
  const lineStart = view.lastIndexOf('\n', cta);
  const ctaComment = view.lastIndexOf('<!-- CTA -->', cta);
  const at = ctaComment > lineStart - 40 && ctaComment > 0 && ctaComment < cta ? view.lastIndexOf('\n', ctaComment) : lineStart;
  view = view.slice(0, at) + '\n\n  ' + block(key, data) + '\n' + view.slice(at);
  html = html.slice(0, a) + view + html.slice(b);
}

// Pricing: the plan cards are rendered by JavaScript (plans.js); this static
// section gives every visitor (and crawler) the same facts in plain HTML.
// Values from tools/seo/facts.js, which reads js/plans.js (the mirror of the
// backend's services/pricing.js); nothing here is typed by hand.
// Three parts, each with its own heading: the plans side by side (one row
// per plan: access, full price, credits; what every plan shares is said once
// under the table), credits
// (the rules next to a grouped price list) and good to know.
{
  const F = require('./facts');
  const fmt = (n) => n.toLocaleString('en-US');
  const C = F.costs;
  const best = F.plans.reduce((a, p) => (p.months && (!a || p.price / p.months < a.price / a.months) ? p : a), null);
  const rows = F.plans.map((p) => {
    const mark = best && p.id === best.id ? ' class="is-best"' : '';
    return `<tr${mark}><th scope="row">${p.name}</th><td data-label="Access">${p.period}</td><td data-label="Price" class="ov-pd-num" data-eur="${p.price}">${F.euro(p.price)}</td><td data-label="Credits" class="ov-pd-num">${fmt(p.creditCount)}</td></tr>`;
  }).join('');
  const groups = [
    ['Creating ads', [['Campaign draft (copy and structure)', C.campaignDraft], ['Image (per ad)', C.image], ['Video, 5 seconds', C.video], ['Video, 10 seconds', C.video10s]]],
    ['Research and analysis', [['Research report', C.researchRun], ['Analyze with AI', C.analysis], ['Website refresh', C.websiteRefresh]]],
    ['Assistant and automation', [['Oriven Chat message', C.chatMessage, 'Each extra step in the same message, such as using a tool, is ' + C.chatStep + ' more; at most 2.'], ['New automation', C.automationCreate, 'Once; its checks and changes are free.']]],
  ];
  const costList = groups.map(([g, items]) => `<div class="ov-pd-group"><h4>${g}</h4><dl>${items.map((i) => `<div><dt>${i[0]}${i[2] ? `<span>${i[2]}</span>` : ''}</dt><dd>${i[1]} credits</dd></div>`).join('')}</dl></div>`).join('');
  const block = `<!-- pricing-detail:start -->
  <section class="ov-sp-section ov-deep ov-price-detail" aria-labelledby="price-detail-h">
    <div class="ov-sp-section-inner">
      <div class="ov-sp-tag">Compare plans</div>
      <h2 class="ov-sp-h2" id="price-detail-h">The same product, five periods</h2>
      <p class="ov-deep-intro">Every plan includes every feature. Plans differ only in how long your access runs, what it costs and how many credits it includes. Prices are in euros and include VAT, calculated at checkout for your location. You pay once; nothing renews automatically.</p>

      <div class="ov-pd-part" aria-labelledby="pd-plans-h">
        <h3 id="pd-plans-h">Plans side by side</h3>
        <div class="ov-pd-table-wrap"><table class="ov-pd-table"><thead><tr><th scope="col">Plan</th><th scope="col">Access</th><th scope="col" class="ov-pd-num">Price</th><th scope="col" class="ov-pd-num">Credits</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="ov-pd-shared"><span>Every plan</span>Every feature (Research, Create, Launch, Campaigns, Automations, Oriven Chat, Priority Support) · Renews automatically: no</p>
      </div>

      <div class="ov-pd-part ov-pd-credits" aria-labelledby="pd-credits-h">
        <div class="ov-pd-rules">
          <h3 id="pd-credits-h">How credits work</h3>
          <ul><li>An image ad typically uses ${C.imageAd} credits (draft plus one image); a video ad ${C.videoAd} (draft plus a 5-second video).</li><li>Plans of three months or longer add their credits in equal monthly parts, all within your access period.</li><li>Unused credits expire when your access ends. If a generation fails, its credits are returned.</li></ul>
        </div>
        <div class="ov-pd-costs">
          <h3>What things cost in credits</h3>
          ${costList}
        </div>
      </div>

      <div class="ov-pd-part ov-pd-know" aria-labelledby="pd-know-h">
        <h3 id="pd-know-h">Good to know</h3>
        <ul><li><b>When your access ends</b>Nothing is charged: buy a new period whenever you want to continue. Your work stays in your account.</li><li><b>Before your access ends</b>Buying again adds the new period after the current one.</li><li><b>Your ad spend</b>Your ad spend is paid to the ad platforms directly; OrivenAI never charges ad budgets. Campaigns are created paused.</li></ul>
      </div>
      <p class="ov-deep-links"><span>Questions</span><a href="/faq">Read the FAQ</a><a href="/refund-policy">Refund policy</a><a href="/contact">Contact us</a></p>
    </div>
  </section>
  <!-- pricing-detail:end -->`;
  const a = html.indexOf('<div id="view-pricing" class="pub-view">'), b = html.indexOf('<!-- /view-pricing -->', a);
  let view = html.slice(a, b).replace(/\n?\s*<!-- pricing-detail:start -->[\s\S]*?<!-- pricing-detail:end -->/, '');
  const cta = ctaAt(view);
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
