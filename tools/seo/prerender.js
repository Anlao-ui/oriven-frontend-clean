#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// Prerender the single-page-app marketing routes into static HTML.
//
// index.html holds every public page as a hidden view (#view-pricing,
// #view-product-meta-ads, …) and JavaScript shows the one matching the URL,
// so every route used to return the same 480 KB body. This script renders
// each route once in a real browser (local server, external requests
// blocked, reduced motion), then writes <route>.html containing:
//   • index.html's head with this route's title, description, canonical,
//     Open Graph/Twitter and robots values (the same values the page's own
//     PAGE_SEO table applies in the browser),
//   • structured data that fits the page (Organization, WebPage,
//     BreadcrumbList, FAQPage from questions visible on the page,
//     SoftwareApplication on product and pricing pages),
//   • ONLY this route's view, already rendered (visible without
//     JavaScript, one H1), plus the site's scripts so it behaves exactly
//     as before. Links to other pages load those pages normally.
// It also writes 404.html and _redirects (prerendered routes, trailing-slash
// redirects, explicit app routes, and a real 404 for everything else).
//
//   node tools/seo/prerender.js         (after editing index.html views)
//   node tools/seo/prerender.js --check (exit 1 if any output is stale)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const http = require('http');
const F = require('./facts');

const ROOT = path.resolve(__dirname, '..', '..');
const ORIGIN = 'https://orivenai.com';
const CHECK = process.argv.includes('--check');
const PORT = 8897;

// Route → view key (mirrors the viewMap in index.html). /login and /signup
// stay on index.html (noindex, app entry points).
const ROUTES = {
  '/about': 'about', '/blog': 'blog', '/product': 'product', '/solutions': 'solutions', '/case-studies': 'case-studies',
  '/pricing': 'pricing', '/faq': 'faq', '/terms': 'terms', '/privacy': 'privacy', '/refund-policy': 'refund-policy',
  '/cookie-policy': 'cookie-policy', '/security': 'security', '/contact': 'contact',
  '/product/google-ads': 'product-google-ads', '/product/meta-ads': 'product-meta-ads', '/product/tiktok-ads': 'product-tiktok-ads',
  '/product/pinterest-ads': 'product-pinterest-ads', '/create': 'product-create', '/launch': 'product-launch',
  '/campaigns': 'product-campaigns', '/research': 'product-research', '/autopilot': 'product-autopilot', '/business': 'product-business',
};
// Pages kept out of search: illustrative case studies (no real customer
// proof yet — founder input needed) and the 404 page.
const NOINDEX = new Set(['/case-studies']);
const PRODUCT = new Set(['/product', '/pricing', '/create', '/launch', '/campaigns', '/research', '/autopilot', '/business',
  '/product/google-ads', '/product/meta-ads', '/product/tiktok-ads', '/product/pinterest-ads']);
const CRUMB_PARENT = { '/product/google-ads': '/product', '/product/meta-ads': '/product', '/product/tiktok-ads': '/product', '/product/pinterest-ads': '/product' };

const outFile = (route) => route.slice(1) + '.html';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ldTag = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

// ── Local server that serves the SPA shell for app routes ──
function serve() {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.woff2': 'font/woff2' };
  return http.createServer((q, s) => {
    const p = decodeURIComponent(q.url.split('?')[0]);
    let f = path.join(ROOT, p);
    if (ROUTES[p] || p === '/' || p === '/404-probe') f = path.join(ROOT, 'index.html');
    fs.readFile(f, (e, b) => { s.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(e ? '' : b); });
  }).listen(PORT);
}

// Strip animation leftovers (inline opacity/transform/visibility set by
// scroll or entrance animations) so content is visible without JavaScript.
const CLEAN_STYLE = `(root) => {
  root.querySelectorAll('[style]').forEach((el) => {
    const st = el.style;
    ['opacity', 'transform', 'visibility', 'filter', 'translate', 'will-change', 'clip-path'].forEach((p) => st.removeProperty(p));
    if (!el.getAttribute('style').trim()) el.removeAttribute('style');
  });
}`;

async function capture(browser, route) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:8897)/, (r) => {
    const u = r.request().url();
    // Script libraries (GSAP, supabase-js) load so the page runs as it does
    // live; calls to Supabase itself, analytics and fonts are blocked.
    if (/^https:\/\/cdn\.jsdelivr\.net\//.test(u)) return r.continue();
    return r.abort();
  });
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const viewKey = ROUTES[route] || '404';
  const data = await page.evaluate(([key, cleanSrc]) => {
    const clean = eval(cleanSrc);
    const v = document.getElementById('view-' + key);
    const copy = v.cloneNode(true);
    copy.classList.remove('pub-view');
    clean(copy);
    const meta = (sel) => { const el = document.querySelector(sel); return el ? (el.getAttribute('content') || el.getAttribute('href')) : null; };
    const faqs = [...v.querySelectorAll('.ov-deep-faq details, .ov-faq')].map((d) => {
      const q = d.querySelector('summary, .ov-faq-q span'); const a = d.querySelector('details > p, .ov-faq-a');
      return q && a ? [q.textContent.trim(), a.textContent.trim()] : null;
    }).filter(Boolean);
    const lds = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch (_) { return null; } }).filter(Boolean);
    return {
      html: copy.outerHTML,
      title: document.title,
      description: meta('meta[name="description"]'),
      canonical: meta('link[rel="canonical"]'),
      robots: meta('meta[name="robots"]'),
      h1: (v.querySelector('h1') || {}).textContent || null,
      faqs, lds,
    };
  }, [viewKey, CLEAN_STYLE]);
  await ctx.close();
  return Object.assign({ route, viewKey, errors }, data);
}

// Compose the static page from the raw index.html.
function compose(raw, cap, opts) {
  const route = cap.route;
  const url = opts.is404 ? null : ORIGIN + route;
  const title = cap.title, desc = cap.description || '';
  const robots = opts.is404 || NOINDEX.has(route) ? 'noindex, follow' : 'index, follow';
  let h = raw;
  // Head values (tags marked with ids ov* in index.html).
  const setContent = (s, id, v) => s.replace(new RegExp('(<meta[^>]*\\bcontent=")[^"]*("[^>]*\\bid="' + id + '")'), '$1' + esc(v) + '$2');
  h = h.replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>');
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + esc(desc) + '$2');
  if (url) h = h.replace(/(<link rel="canonical" href=")[^"]*(" id="ovCanonical")/, '$1' + url + '$2');
  else h = h.replace(/\s*<link rel="canonical" href="[^"]*" id="ovCanonical">/, '');
  h = setContent(h, 'ovOgTitle', title); h = setContent(h, 'ovOgDesc', desc); if (url) h = setContent(h, 'ovOgUrl', url);
  h = setContent(h, 'ovTwTitle', title); h = setContent(h, 'ovTwDesc', desc); h = setContent(h, 'ovRobotsMeta', robots);
  // Structured data: replace index.html's homepage set with what fits this page.
  h = h.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const lds = [F.organizationLd];
  if (!opts.is404) {
    lds.push({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url, inLanguage: 'en', isPartOf: { '@type': 'WebSite', name: 'OrivenAI', url: ORIGIN + '/' }, publisher: { '@id': ORIGIN + '/#organization' } });
    const crumbs = [{ name: 'Home', item: ORIGIN + '/' }];
    if (CRUMB_PARENT[route]) crumbs.push({ name: 'Platforms', item: ORIGIN + CRUMB_PARENT[route] });
    crumbs.push({ name: (cap.h1 || title).replace(/\s+/g, ' ').trim().slice(0, 80), item: url });
    lds.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => Object.assign({ '@type': 'ListItem', position: i + 1 }, c)) });
    if (PRODUCT.has(route)) lds.push(F.softwareLd);
    if (cap.faqs.length) lds.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: cap.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  }
  h = h.replace('</head>', lds.map(ldTag).join('\n') + '\n</head>');
  // Body: only this view (rendered), every other view removed.
  h = h.replace(/<div id="view-([a-z0-9-]+)" class="pub-view"[^>]*>[\s\S]*?<!-- \/view-\1 -->/g, (m, key) => (key === cap.viewKey ? cap.html + '<!-- /view-' + key + ' -->' : ''));
  // The router marks this page as prerendered (also shows global nav).
  h = h.replace('<body', '<body data-prerendered="' + (opts.is404 ? '404' : route) + '"');
  return h;
}

function redirectsFile() {
  const lines = [
    '# ORIVEN — Netlify routing (generated by tools/seo/prerender.js; edit there)',
    '# 200 = rewrite (serve file, keep URL)   301/302 = redirect   404 = not found',
    '',
    '# App entry points (single-page app shells)',
    '/app            /app.html       200',
    '/signup         /index.html     200',
    '/login          /index.html     200',
    '/plan           /app            302',
    '/onboarding     /app?tour=1     302',
    '',
    '# Prerendered marketing pages: one static file per route',
    ...Object.keys(ROUTES).map((r) => `${r.padEnd(26)} /${outFile(r).padEnd(30)} 200!`),
    '',
    '# Trailing-slash variants redirect to the canonical URL',
    ...Object.keys(ROUTES).map((r) => `${(r + '/').padEnd(26)} ${r.padEnd(31)} 301`),
    '',
    '# Everything else that is not a real file: a genuine 404',
    '/*              /404.html       404',
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const raw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const server = serve();
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const outputs = {};
  let failed = false;
  try {
    for (const route of Object.keys(ROUTES)) {
      const cap = await capture(browser, route);
      if (cap.errors.length) { console.error('page errors on', route, cap.errors); failed = true; }
      if (!cap.h1) { console.error('no H1 in', route); failed = true; }
      outputs[outFile(route)] = compose(raw, cap, {});
      console.log('rendered', route.padEnd(24), '|', cap.title, '|', cap.faqs.length, 'FAQ');
    }
    const c404 = await capture(browser, '/404-probe');
    c404.route = '/404'; c404.title = 'Page not found | OrivenAI'; c404.description = 'This page doesn’t exist. Go to the OrivenAI homepage, Learn guides or pricing.';
    outputs['404.html'] = compose(raw, c404, { is404: true });
  } finally {
    await browser.close(); server.close();
  }
  outputs['_redirects'] = redirectsFile();
  // Sitemap: the hand-maintained top part is generated here (homepage +
  // every indexable prerendered route). lastmod moves only when the page's
  // content changes; noindex pages are left out.
  {
    const smPath = path.join(ROOT, 'sitemap.xml');
    const sm = fs.readFileSync(smPath, 'utf8');
    const NL = '\n';
    const prev = {};
    for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)) prev[m[1]] = m[2];
    const today = new Date().toISOString().slice(0, 10);
    const entry = (loc, changed) => '  <url>' + NL + '    <loc>' + loc + '</loc>' + NL + '    <lastmod>' + (changed || !prev[loc] ? today : prev[loc]) + '</lastmod>' + NL + '  </url>';
    let anyChanged = false;
    const routeItems = Object.keys(ROUTES).filter((r) => !NOINDEX.has(r)).map((r) => {
      const file = outFile(r); const p = path.join(ROOT, file);
      const changed = !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== outputs[file];
      if (changed) anyChanged = true;
      return entry(ORIGIN + r, changed);
    });
    // The homepage shares index.html with every route above.
    const items = [entry(ORIGIN + '/', anyChanged)].concat(routeItems);
    const start = sm.indexOf('  <!-- seo-pages:start');
    outputs['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>' + NL + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + NL +
      '  <!-- Marketing pages (generated by tools/seo/prerender.js) -->' + NL + items.join(NL) + NL + NL + sm.slice(start);
  }
  let stale = [];
  for (const [file, content] of Object.entries(outputs)) {
    const p = path.join(ROOT, file);
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (cur !== content) { stale.push(file); if (!CHECK) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); } }
  }
  if (CHECK) { if (stale.length) { console.error('stale:', stale.join(', ')); process.exit(1); } console.log('prerender up to date'); }
  else console.log('wrote', stale.length, 'files' + (stale.length ? ': ' + stale.join(', ') : ''));
  if (failed) process.exit(1);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { ROUTES, NOINDEX, outFile };
