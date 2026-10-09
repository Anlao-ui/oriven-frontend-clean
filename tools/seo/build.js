#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// OrivenAI static public pages — generator
//
// Writes plain, crawler-ready HTML for every page in tools/seo/pages/*.js
// (commercial pages, the /learn/ hub and its articles) into the site root
// (<path>/index.html). No build step runs on Netlify: run this locally
// after editing content and commit the generated files.
//
//   node tools/seo/build.js            write pages + update sitemap.xml
//   node tools/seo/build.js --check    exit 1 if any generated file is stale
//
// Every page gets, in the static HTML: a unique <title>, meta description,
// self-referencing canonical, Open Graph + Twitter tags, JSON-LD (only
// types that fit the page: Organization, WebPage/Article, BreadcrumbList,
// FAQPage when the Q&A is visible on the page, SoftwareApplication on
// commercial pages), the same nav/footer, and the site's existing Google
// tag (no new analytics). Product facts live in tools/seo/facts.js so all
// pages describe OrivenAI the same way.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const F = require('./facts');

const ROOT = path.resolve(__dirname, '..', '..');
const ORIGIN = 'https://orivenai.com';
const OG_IMAGE = ORIGIN + '/assets/og/orivenai-og.png';
const CHECK = process.argv.includes('--check');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function loadPages() {
  const dir = path.join(__dirname, 'pages');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => {
    const p = require(path.join(dir, f));
    for (const k of ['path', 'title', 'description', 'h1', 'kind']) if (!p[k]) throw new Error(`${f}: missing ${k}`);
    if (!/^\/[a-z0-9/-]*\/$/.test(p.path)) throw new Error(`${f}: path must start and end with "/" (${p.path})`);
    return Object.assign({ file: f }, p);
  });
}

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/learn/', label: 'Learn' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
];

function nav(page) {
  const links = NAV.map((l) => `<a href="${l.href}"${page.path.startsWith(l.href) && l.href !== '/' ? ' aria-current="page"' : ''}>${l.label}</a>`).join('');
  return `<header class="sp-nav"><div class="sp-wrap sp-nav-in">
  <a class="sp-logo" href="/" aria-label="OrivenAI home"><img src="/assets/orivenlogo.png" alt="" width="30" height="30"><span>OrivenAI</span></a>
  <nav class="sp-links" aria-label="Main">${links}</nav>
  <div class="sp-actions">
    <a class="sp-login" href="/login">Login</a>
    <a class="sp-btn sp-btn-primary sp-btn-sm" href="/signup" data-cta="nav_signup">Get Started Free</a>
    <details class="sp-menu"><summary>Menu</summary><div class="sp-menu-panel">${links}<a href="/login">Login</a></div></details>
  </div>
</div></header>`;
}

function footer() {
  const col = (h, items) => `<div><h2>${h}</h2><ul>${items.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul></div>`;
  return `<footer class="sp-footer"><div class="sp-wrap">
  <div class="sp-footer-top">
    <div class="sp-footer-brand"><a class="sp-logo" href="/"><img src="/assets/orivenlogo.png" alt="" width="30" height="30"><span>OrivenAI</span></a><p>${esc(F.tagline)}</p></div>
    ${col('Product', [['/business', 'Control Center'], ['/research', 'Research'], ['/create', 'Create'], ['/launch', 'Launch'], ['/campaigns', 'Campaigns'], ['/autopilot', 'Autopilot']])}
    ${col('Solutions', [['/ppc-automation-software/', 'PPC automation'], ['/cross-platform-ad-management/', 'Cross-platform ad management'], ['/product/google-ads', 'Google Ads'], ['/product/meta-ads', 'Meta Ads'], ['/product/tiktok-ads', 'TikTok Ads'], ['/product/pinterest-ads', 'Pinterest Ads']])}
    ${col('Resources', [['/learn/', 'Learn'], ['/pricing', 'Pricing'], ['/faq', 'FAQ'], ['/blog', 'Blog'], ['/about', 'About']])}
    ${col('Legal', [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/cookie-policy', 'Cookie Policy'], ['#cookie-settings', 'Cookie settings'], ['mailto:contact@orivenai.com', 'Contact']])}
  </div>
  <div class="sp-footer-bottom"><span>&copy; 2026 OrivenAI (Oriven) &middot; KVK 42039993 &middot; Netherlands</span><a href="/signup" data-cta="footer_signup">Get started for free &rarr;</a></div>
</div></footer>`;
}

function crumbs(page) {
  const items = [{ name: 'Home', path: '/' }].concat(page.breadcrumbs || []).concat([{ name: page.crumb || page.h1, path: page.path }]);
  const html = `<nav class="sp-crumbs sp-wrap" aria-label="Breadcrumb"><ol>${items.map((c, i) => i === items.length - 1
    ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${c.path}">${esc(c.name)}</a></li>`).join('')}</ol></nav>`;
  const json = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: ORIGIN + c.path })) };
  return { html, json };
}

function faqBlock(page) {
  if (!page.faq || !page.faq.length) return { html: '', json: null };
  const html = `<section class="sp-section" aria-labelledby="faq-h"><div class="sp-wrap"><h2 id="faq-h">${esc(page.faqTitle || 'Frequently asked questions')}</h2><div class="sp-faq">${
    page.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="sp-faq-a">${a}</div></details>`).join('')}</div></div></section>`;
  // FAQPage only from the Q&A rendered above (identical text).
  const json = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) };
  return { html, json };
}

function related(page, all) {
  const list = (page.related || []).map((p) => {
    const target = all.find((x) => x.path === p) || F.sitePages[p];
    if (!target) throw new Error(`${page.file}: related link to unknown page ${p}`);
    return `<a href="${p}"><strong>${esc(target.crumb || target.h1 || target.name)}</strong><span>${esc(target.teaser || target.description)}</span></a>`;
  });
  if (!list.length) return '';
  return `<section class="sp-section" aria-labelledby="rel-h"><div class="sp-wrap"><h2 id="rel-h">${esc(page.relatedTitle || 'Keep reading')}</h2><div class="sp-related">${list.join('')}</div></div></section>`;
}

function band(page) {
  const b = Object.assign({ title: 'Start with a free OrivenAI account', text: F.freePlanLine, label: 'Get Started Free' }, page.cta || {});
  return `<div class="sp-wrap"><div class="sp-band"><div><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></div><a class="sp-btn sp-btn-primary" href="/signup" data-cta="band_signup">${esc(b.label)} &rarr;</a></div></div>`;
}

function render(page, all) {
  const url = ORIGIN + page.path;
  const c = crumbs(page);
  const fq = faqBlock(page);
  const org = F.organizationLd;
  const lds = [org];
  if (page.kind === 'article') {
    lds.push({ '@context': 'https://schema.org', '@type': 'Article', headline: page.h1, description: page.description, url,
      mainEntityOfPage: url, datePublished: page.datePublished, dateModified: page.dateModified || page.datePublished, inLanguage: 'en',
      author: { '@type': 'Organization', name: 'OrivenAI', url: ORIGIN + '/' }, publisher: { '@type': 'Organization', name: 'OrivenAI', logo: { '@type': 'ImageObject', url: ORIGIN + '/assets/orivenlogo.png' } },
      image: OG_IMAGE, about: page.about || undefined });
  } else {
    lds.push({ '@context': 'https://schema.org', '@type': page.kind === 'hub' ? 'CollectionPage' : 'WebPage', name: page.title, description: page.description, url, inLanguage: 'en', isPartOf: { '@type': 'WebSite', name: 'OrivenAI', url: ORIGIN + '/' } });
  }
  if (page.kind === 'commercial') lds.push(F.softwareLd);
  lds.push(c.json);
  if (fq.json) lds.push(fq.json);

  const hero = page.kind === 'article'
    ? `<header class="sp-hero sp-wrap"><p class="sp-eyebrow">${esc(page.eyebrow || 'Learn')}</p><h1>${esc(page.h1)}</h1>
       <p class="sp-meta"><span>By the OrivenAI team</span><span>Published <time datetime="${page.datePublished}">${F.fmtDate(page.datePublished)}</time></span>${page.readMinutes ? `<span>${page.readMinutes} min read</span>` : ''}</p></header>`
    : `<header class="sp-hero sp-wrap"><p class="sp-eyebrow">${esc(page.eyebrow)}</p><h1>${esc(page.h1)}</h1><p class="sp-lede">${page.lede}</p>
       <div class="sp-cta-row"><a class="sp-btn sp-btn-primary" href="/signup" data-cta="hero_signup">${esc((page.cta && page.cta.label) || 'Get Started Free')} &rarr;</a>${page.secondary ? `<a class="sp-btn sp-btn-ghost" href="${page.secondary.href}">${esc(page.secondary.label)}</a>` : ''}</div>
       ${page.heroNote ? `<p class="sp-note">${page.heroNote}</p>` : ''}</header>`;

  const body = page.kind === 'article'
    ? `<section class="sp-section" style="border-top:0;padding-top:8px"><div class="sp-wrap"><article class="sp-article">${page.body}</article></div></section>`
    : page.body;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="${page.kind === 'article' ? 'article' : 'website'}">
<meta property="og:site_name" content="OrivenAI">
<meta property="og:title" content="${esc(page.ogTitle || page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="OrivenAI, the AI advertising platform">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.ogTitle || page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${OG_IMAGE}">
${page.kind === 'article' ? `<meta property="article:published_time" content="${page.datePublished}">\n` : ''}<link rel="icon" href="/assets/orivenlogo.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/seo.css">
${lds.map(ld).join('\n')}
<!-- Consent first (js/consent.js): the Google Ads tag loads only after the visitor
     accepts advertising. js/site-analytics.js: OrivenAI's own cookieless statistics. -->
<script src="/js/consent.js"></script>
<script src="/js/site-analytics.js" defer></script>
<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a&&window.orvConsent&&orvConsent.adsAllowed())gtag('event','cta_click',{cta:a.getAttribute('data-cta'),page_path:location.pathname});});</script>
</head>
<body>
<a class="sp-skip" href="#main">Skip to content</a>
${nav(page)}
<main id="main">
${c.html}
${hero}
${body}
${fq.html}
${related(page, all)}
${band(page)}
</main>
${footer()}
</body>
</html>
`;
}

// ── sitemap: the generated pages live between two markers ──
function sitemapBlock(pages) {
  return pages.map((p) => `  <url>\n    <loc>${ORIGIN}${p.path}</loc>\n    <lastmod>${p.dateModified || p.datePublished || p.lastmod}</lastmod>\n  </url>`).join('\n');
}

// ── Edge function: crawler-visible <head> for the single-page-app routes ──
// index.html is one document served for every public URL (catch-all rewrite
// in _redirects), so its static <head> always carried the homepage title and
// canonical; per-route values were only applied by JavaScript (PAGE_SEO /
// _applyPageSeo). The edge function rewrites those tags in the HTML response
// itself. Its route table is GENERATED from index.html's PAGE_SEO, so the
// browser and the server can't drift apart.
function readPageSeo() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('var PAGE_SEO = {');
  const end = html.indexOf('\n  };', start);
  if (start < 0 || end < 0) throw new Error('PAGE_SEO not found in index.html');
  const literal = html.slice(start + 'var PAGE_SEO = '.length, end + 4);
  return require('vm').runInNewContext('(' + literal + ')');
}

function edgeFunctionSource() {
  const seo = readPageSeo();
  const routes = {};
  for (const k of Object.keys(seo)) {
    const s = seo[k];
    if (!s.path || s.path === '/') continue; // '/' is index.html's own static <head>
    routes[s.path] = { title: s.title, desc: s.desc, noindex: !!s.noindex };
  }
  const paths = Object.keys(routes).sort();
  return `// GENERATED by tools/seo/build.js from index.html PAGE_SEO — do not edit by hand.
// Netlify Edge Function: gives each single-page-app route its own <title>,
// meta description, canonical, Open Graph/Twitter tags and robots directive
// in the HTML that crawlers receive (index.html is served for every route,
// and only JavaScript used to apply these per route). If anything fails,
// Netlify serves the unmodified page (onError: 'bypass').
export const ROUTES = ${JSON.stringify(routes, null, 2)};

const ORIGIN = 'https://orivenai.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rewrites only the tags index.html marks for this purpose (ids ov*), plus
// <title> and the meta description. Returns the HTML unchanged if a tag is missing.
export function rewriteHead(html, pathname) {
  const seo = ROUTES[pathname];
  if (!seo) return html;
  const url = ORIGIN + pathname;
  const t = esc(seo.title), d = esc(seo.desc);
  const setContent = (h, id, v) => h.replace(new RegExp('(<meta[^>]*\\\\bcontent=")[^"]*("[^>]*\\\\bid="' + id + '")'), '$1' + v + '$2');
  let h = html.replace(/<title>[^<]*<\\/title>/, '<title>' + t + '</title>');
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + d + '$2');
  h = h.replace(/(<link rel="canonical" href=")[^"]*(" id="ovCanonical")/, '$1' + url + '$2');
  h = setContent(h, 'ovOgTitle', t);
  h = setContent(h, 'ovOgDesc', d);
  h = setContent(h, 'ovOgUrl', url);
  h = setContent(h, 'ovTwTitle', t);
  h = setContent(h, 'ovTwDesc', d);
  h = setContent(h, 'ovRobotsMeta', seo.noindex ? 'noindex, follow' : 'index, follow');
  return h;
}

export default async (request, context) => {
  const { pathname } = new URL(request.url);
  if (!ROUTES[pathname]) return;
  const res = await context.next();
  const type = res.headers.get('content-type') || '';
  if (res.status !== 200 || !type.includes('text/html')) return res;
  const html = await res.text();
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(rewriteHead(html, pathname), { status: res.status, headers });
};

export const config = {
  path: ${JSON.stringify(paths)},
  onError: 'bypass',
};
`;
}

function main() {
  const pages = loadPages();
  const edgePath = path.join(ROOT, 'netlify', 'edge-functions', 'seo-meta.js');
  const edgeSrc = edgeFunctionSource();
  const edgeCur = fs.existsSync(edgePath) ? fs.readFileSync(edgePath, 'utf8') : null;
  const paths = new Set();
  const titles = new Set(), descs = new Set();
  for (const p of pages) {
    if (paths.has(p.path)) throw new Error('duplicate path ' + p.path);
    if (titles.has(p.title)) throw new Error('duplicate title ' + p.title);
    if (descs.has(p.description)) throw new Error('duplicate description ' + p.path);
    paths.add(p.path); titles.add(p.title); descs.add(p.description);
    if (!(p.dateModified || p.datePublished || p.lastmod)) throw new Error(p.file + ': needs a real date (datePublished / lastmod)');
  }
  let stale = [];
  if (edgeCur !== edgeSrc) {
    stale.push('netlify/edge-functions/seo-meta.js');
    if (!CHECK) { fs.mkdirSync(path.dirname(edgePath), { recursive: true }); fs.writeFileSync(edgePath, edgeSrc); }
  }
  for (const p of pages) {
    const out = path.join(ROOT, p.path, 'index.html');
    const html = render(p, pages);
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    if (cur !== html) {
      stale.push(p.path);
      if (!CHECK) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html); }
    }
  }
  const smPath = path.join(ROOT, 'sitemap.xml');
  const sm = fs.readFileSync(smPath, 'utf8');
  const START = '  <!-- seo-pages:start (generated by tools/seo/build.js) -->', END = '  <!-- seo-pages:end -->';
  const block = START + '\n' + sitemapBlock(pages) + '\n' + END;
  let next;
  if (sm.includes(START)) next = sm.replace(new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), block);
  else next = sm.replace('</urlset>', block + '\n\n</urlset>');
  if (next !== sm) { stale.push('sitemap.xml'); if (!CHECK) fs.writeFileSync(smPath, next); }
  if (CHECK) {
    if (stale.length) { console.error('Stale generated files: ' + stale.join(', ') + '\nRun: node tools/seo/build.js'); process.exit(1); }
    console.log('All ' + pages.length + ' generated pages and the sitemap are up to date.');
  } else {
    console.log((stale.length ? 'Wrote: ' + stale.join(', ') : 'Nothing changed') + ' (' + pages.length + ' pages)');
  }
}

if (require.main === module) main();
module.exports = { loadPages, render };
