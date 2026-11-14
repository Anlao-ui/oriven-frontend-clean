// ════════════════════════════════════════════════════════════════
// Applies the shared public chrome to the views in index.html. Called by
// tools/seo/apply-product-depth.js (so the pipeline stays: build.js →
// apply-product-depth.js → prerender.js). Idempotent: every inserted block
// sits between markers and is replaced on each run.
//   • the shared footer (tools/seo/site-chrome.js) in every public view
//   • the shared bottom CTA (dot-field background) on the content pages,
//     keeping each page's own heading and text
//   • "Inside <section>" on the six product views (tools/seo/product-pages.js),
//     replacing their old generic "How it works / What you get" blocks
//   • the five Solutions concepts
// ════════════════════════════════════════════════════════════════
const { footer, cta } = require('./site-chrome');
const PP = require('./product-pages');

const VIEWS = ['about', 'blog', 'product', 'solutions', 'case-studies', 'pricing', 'faq', 'terms', 'privacy', 'refund-policy', 'cookie-policy', 'security', 'contact',
  'product-google-ads', 'product-meta-ads', 'product-tiktok-ads', 'product-pinterest-ads', 'product-snapchat-ads',
  'product-business', 'product-research', 'product-create', 'product-launch', 'product-campaigns', 'product-autopilot', '404'];

const START = ['/signup', 'Get started', ' onclick="lpGetStarted(event)"'];
const NEXT = (k) => { const d = PP.D[k]; return d.next[0] === '/business' ? ['/product', 'See all six sections'] : [d.next[0], 'Next: ' + d.next[1]]; };
// Bottom CTA per view. title/text default to the view's existing CTA copy.
const CTA = {
  product: { eyebrow: 'Six sections · one workspace', secondary: ['/solutions', 'Explore solutions'] },
  solutions: { eyebrow: 'Solutions', secondary: ['/product', 'See the six sections'] },
  about: { eyebrow: 'About', secondary: ['/blog/why-we-built-oriven', 'Why we built OrivenAI'] },
  'case-studies': { eyebrow: 'Case studies', secondary: ['/product', 'Explore the product'] },
  faq: { eyebrow: 'FAQ', primary: ['mailto:contact@orivenai.com', 'Contact us'], secondary: ['/learn/', 'Read the guides'] },
  blog: { eyebrow: 'Blog', title: 'Read about it,<br>then try it.', text: 'See the plans, from 14 days to a year, or keep reading in the guides.', secondary: ['/learn/', 'Continue learning'] },
  pricing: { eyebrow: 'Pricing', secondary: ['/faq', 'Read the FAQ'] },
  'product-google-ads': { eyebrow: 'Google Ads', secondary: ['/product', 'All platforms and sections'] },
  'product-meta-ads': { eyebrow: 'Meta Ads', secondary: ['/product', 'All platforms and sections'] },
  'product-tiktok-ads': { eyebrow: 'TikTok Ads', secondary: ['/product', 'All platforms and sections'] },
  'product-pinterest-ads': { eyebrow: 'Pinterest Ads', secondary: ['/product', 'All platforms and sections'] },
  'product-snapchat-ads': { eyebrow: 'Snapchat Ads', secondary: ['/product', 'All platforms and sections'] },
};
// The six product pages close with their own words (product-pages.js D[k].cta).
const PCTA = {
  'product-business': ['Start where everything<br>comes together.', 'See what needs you, plan what’s next and keep your business context in one place. Included in every plan.'],
  'product-research': ['Know your market<br>before you spend.', 'Market, competitor, audience and opportunity research, included in every plan.'],
  'product-create': ['Make your next ad,<br>step by step.', 'Image and video ads for Google, Meta, TikTok, Pinterest and Snapchat, built from your own business context.'],
  'product-launch': ['Check it.<br>Then publish it.', 'Every draft checked against what the platform needs, and created paused, so you decide when it starts.'],
  'product-campaigns': ['Every campaign,<br>one view.', 'Connect your ad accounts and follow spend, clicks and cost per result in one place.'],
  'product-autopilot': ['Set the rules.<br>Keep the control.', 'Schedules and rules that notify you, ask first or act within your limits. Included in every plan.'],
};
for (const k of Object.keys(PP.D)) CTA[k] = { eyebrow: PP.D[k].num + ' · ' + PP.D[k].name, title: PCTA[k][0], text: PCTA[k][1], secondary: NEXT(k) };

// One-time copy corrections in views (applied only while the old text is there).
const FIXES = [
  ['<h1 class="ov-sp-h1">One brain, behind<br>every generation.</h1>', '<h1 class="ov-sp-h1">Where every<br>session starts.</h1>'],
  ['Control Center keeps your business profile and Brand Identity next to your advertising overview and plan, so every campaign, copy and creative starts from the same context and actually sounds like you.',
    'Control Center brings your dashboard, your marketing plan and your business context together: what is happening, what needs you and what comes next, in one place.'],
  ['<h1 class="ov-sp-h1">From idea to live campaign.<br>In minutes.</h1>', '<h1 class="ov-sp-h1">From draft<br>to live campaign.</h1>'],
  ['<h1 class="ov-sp-h1">Six problems.<br>Six real answers.</h1>', '<h1 class="ov-sp-h1">Five reasons<br>to use OrivenAI.</h1>'],
  ['Every solution below maps to one real Oriven product. No audience segments, no generic promises, just the actual thing that fixes it.',
    'Each one maps to sections that exist in OrivenAI today: what it helps with, where it happens, and what still needs you.'],
];

const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function replaceBetween(view, start, end, body) {
  const a = view.indexOf(start), b = view.indexOf(end, a);
  if (a < 0 || b < 0) return null;
  return view.slice(0, a) + body + view.slice(b + end.length);
}

function applyView(key, view) {
  for (const [x, y] of FIXES) if (view.includes(x)) view = view.replace(x, y);

  // ── Inside <section> (six product views) ──
  if (PP.D[key]) {
    const block = PP.block(key, PP.D[key]);
    const r = replaceBetween(view, '<!-- pages:start -->', '<!-- pages:end -->', block);
    if (r) view = r;
    else {
      const heroEnd = view.indexOf('</section>', view.indexOf('class="ov-sp-hero"')) + '</section>'.length;
      const depth = view.indexOf('<!-- depth:start -->');
      if (heroEnd < 20 || depth < 0) throw new Error('product view layout not found: ' + key);
      view = view.slice(0, heroEnd) + '\n\n  ' + block + '\n\n  ' + view.slice(depth);
    }
  }
  // ── Solutions ──
  if (key === 'solutions') {
    const block = PP.solutionsBlock();
    const r = replaceBetween(view, '<!-- solutions:start -->', '<!-- solutions:end -->', block);
    if (r) view = r;
    else {
      const heroEnd = view.indexOf('</section>', view.indexOf('class="ov-sp-hero"')) + '</section>'.length;
      const ctaAt = view.indexOf('<section class="ov-sp-cta"');
      if (heroEnd < 20 || ctaAt < 0) throw new Error('solutions layout not found');
      view = view.slice(0, heroEnd) + '\n\n  ' + block + '\n\n  ' + view.slice(view.lastIndexOf('\n', ctaAt) + 1);
    }
  }
  // ── Bottom CTA ──
  if (CTA[key]) {
    const c = CTA[key];
    let title = c.title, text = c.text, primary = c.primary;
    const old = view.match(/<section class="ov-sp-cta"[^>]*>[\s\S]*?<\/section>/);
    if (old) {
      const h = old[0].match(/class="ov-sp-cta-h"[^>]*>([\s\S]*?)<\/h2>/), p = old[0].match(/class="ov-sp-cta-sub"[^>]*>([\s\S]*?)<\/p>/);
      if (!title && h) title = h[1].trim();
      if (!text && p) text = p[1].trim();
      if (!primary) { const a = old[0].match(/<a [^>]*class="ov-btn-primary"[^>]*>([\s\S]*?)<\/a>/); const href = a && (a[0].match(/href="([^"]*)"/) || [])[1]; primary = a && href && href !== '#' ? [href, strip(a[1])] : [START[0], a ? strip(a[1]).replace(/\s*→$/, '') : START[1], START[2]]; }
    }
    if (!old && !view.includes('<!-- site-cta:start -->') && !title) throw new Error('no CTA copy for ' + key);
    const html = `<!-- site-cta:start -->\n  ${cta({ eyebrow: c.eyebrow, title: title || '', text, primary: primary || START, secondary: c.secondary })}\n  <!-- site-cta:end -->`;
    if (old) view = view.replace(old[0], html);
    else if (view.includes('<!-- site-cta:start -->')) {
      // Re-run: keep the copy that is already there, refresh the markup.
      const cur = view.slice(view.indexOf('<!-- site-cta:start -->'), view.indexOf('<!-- site-cta:end -->'));
      const h = cur.match(/class="site-cta__h">([\s\S]*?)<\/h2>/), p = cur.match(/class="site-cta__p">([\s\S]*?)<\/p>/);
      const a = cur.match(/class="site-btn site-btn--primary" href="([^"]*)"([^>]*)>([\s\S]*?) <span/);
      const fresh = `<!-- site-cta:start -->\n  ${cta({ eyebrow: c.eyebrow, title: c.title || (h && h[1]) || '', text: c.text || (p && p[1]), primary: c.primary || (a ? [a[1], strip(a[3]), a[2]] : START), secondary: c.secondary })}\n  <!-- site-cta:end -->`;
      view = replaceBetween(view, '<!-- site-cta:start -->', '<!-- site-cta:end -->', fresh);
    } else {
      // No CTA yet (Blog): add one just before the footer.
      const f = view.search(/<!-- site-footer:start -->|<footer class="(ov-sub-footer|lp-legal-footer)"/);
      view = view.slice(0, f) + html + '\n  ' + view.slice(f);
    }
  }
  // ── Footer ──
  const foot = `<!-- site-footer:start -->\n  ${footer()}\n  <!-- site-footer:end -->`;
  const r = replaceBetween(view, '<!-- site-footer:start -->', '<!-- site-footer:end -->', foot);
  if (r) view = r;
  else {
    const m = view.match(/<footer class="(ov-sub-footer|lp-legal-footer)">[\s\S]*?<\/footer>/);
    if (!m) throw new Error('no footer in ' + key);
    view = view.replace(m[0], foot);
  }
  return view;
}

module.exports = function applySiteChrome(html) {
  for (const key of VIEWS) {
    const startTag = `<div id="view-${key}" class="pub-view"`, endTag = `<!-- /view-${key} -->`;
    const a = html.indexOf(startTag), b = html.indexOf(endTag, a);
    if (a < 0 || b < 0) throw new Error('view not found: ' + key);
    html = html.slice(0, a) + applyView(key, html.slice(a, b)) + html.slice(b);
  }
  return html;
};
