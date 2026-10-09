// ════════════════════════════════════════════════════════════════
// SEO / AEO / GEO checks for the public site (no network, no browser).
//   node tests/seo.test.js
// Covers: generated static pages (tools/seo/build.js), the seo-meta edge
// function, index.html head + structured data, sitemap.xml, robots.txt,
// internal links, and that product facts on public pages match plans.js.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://orivenai.com';
let pass = 0, fail = 0;
const check = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 400))); };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const all = (re, s) => { const out = []; let m; const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); while ((m = r.exec(s))) out.push(m); return out; };
const jsonLd = (html) => all(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, html).map((m) => JSON.parse(m[1].trim()));
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

(async () => {
  console.log('\nA. Generated static pages');
  let fresh = true;
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools/seo/build.js'), '--check'], { stdio: 'pipe' }); } catch (_) { fresh = false; }
  check('generated pages, sitemap block and edge function are up to date (build --check)', fresh);
  const { loadPages } = require(path.join(ROOT, 'tools/seo/build.js'));
  const pages = loadPages();
  check('9 pages: learn hub, 6 articles, 2 commercial pages', pages.length === 9 && pages.filter((p) => p.kind === 'article').length === 6 && pages.filter((p) => p.kind === 'commercial').length === 2, pages.map((p) => p.path));
  const titles = new Set(), descs = new Set();
  for (const p of pages) {
    const html = read(p.path.slice(1) + 'index.html');
    const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    const d = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    const canon = all(/<link rel="canonical" href="([^"]*)"/, html).map((m) => m[1]);
    const h1s = all(/<h1[\s>]/, html).length;
    const ld = jsonLd(html);
    const types = ld.map((x) => x['@type']);
    titles.add(t); descs.add(d);
    const ok = t && d && t.length <= 90 && d.length >= 90 && d.length <= 200 && canon.length === 1 && canon[0] === ORIGIN + p.path && h1s === 1
      && /<meta name="robots" content="index, follow">/.test(html) && html.includes(`<meta property="og:url" content="${ORIGIN + p.path}">`)
      && html.includes('og:image" content="https://orivenai.com/assets/og/orivenai-og.png"') && html.includes('twitter:card" content="summary_large_image"');
    check(`${p.path}: title, description, one self-canonical, one h1, robots, OG/Twitter`, ok, { t, tl: t && t.length, dl: d && d.length, canon, h1s });
    const need = ['Organization', 'BreadcrumbList'].concat(p.kind === 'article' ? ['Article'] : p.kind === 'hub' ? ['CollectionPage'] : ['WebPage', 'SoftwareApplication']);
    check(`${p.path}: JSON-LD valid and fits the page (${need.join(', ')})`, need.every((n) => types.includes(n)) && !types.includes('Review') && !types.includes('AggregateRating'), types);
    if (p.kind === 'article') {
      const a = ld.find((x) => x['@type'] === 'Article');
      check(`${p.path}: Article has a real publication date shown on the page`, /^\d{4}-\d{2}-\d{2}$/.test(a.datePublished) && html.includes(`<time datetime="${a.datePublished}">`));
    }
    const faqLd = ld.find((x) => x['@type'] === 'FAQPage');
    if (p.faq && p.faq.length) {
      const visible = all(/<details><summary>([\s\S]*?)<\/summary><div class="sp-faq-a">([\s\S]*?)<\/div><\/details>/, html).map((m) => [text(m[1]), text(m[2])]);
      const same = faqLd && faqLd.mainEntity.length === visible.length && faqLd.mainEntity.every((q, i) => q.name === visible[i][0] && q.acceptedAnswer.text === visible[i][1]);
      check(`${p.path}: FAQPage matches the visible Q&A exactly`, !!same, { ld: faqLd && faqLd.mainEntity.length, visible: visible.length });
    } else check(`${p.path}: no FAQPage without visible Q&A`, !faqLd);
    const bc = ld.find((x) => x['@type'] === 'BreadcrumbList');
    check(`${p.path}: breadcrumb ends at this page`, bc.itemListElement[bc.itemListElement.length - 1].item === ORIGIN + p.path && bc.itemListElement[0].item === ORIGIN + '/');
    check(`${p.path}: signup CTA present (/signup)`, all(/href="\/signup"/, html).length >= 2);
    check(`${p.path}: no fabricated trust signals`, !/(\d[\d,.]*\s*\+?\s*(customers|users|businesses|reviews))|btestimonials?b|★|bratings?b/i.test(text(html)), (text(html).match(/(\d[\d,.]*\s*\+?\s*(customers|users|businesses|reviews))|btestimonials?b|★|bratings?b/i) || [])[0]);
    check(`${p.path}: images have alt attributes`, all(/<img(?![^>]*\balt=)[^>]*>/, html).length === 0);
  }
  check('titles unique', titles.size === pages.length);
  check('descriptions unique', descs.size === pages.length);

  console.log('\nB. Internal links resolve');
  const idx = read('index.html');
  const viewMap = vm.runInNewContext('(' + idx.slice(idx.indexOf('var VIEW_MAP = {') + 'var VIEW_MAP = '.length, idx.indexOf('};', idx.indexOf('var VIEW_MAP = {')) + 1) + ')');
  const pageSeo = vm.runInNewContext('(' + idx.slice(idx.indexOf('var PAGE_SEO = {') + 'var PAGE_SEO = '.length, idx.indexOf('\n  };', idx.indexOf('var PAGE_SEO = {')) + 4) + ')');
  const spa = new Set(Object.keys(viewMap).concat(Object.values(pageSeo).map((s) => s.path).filter(Boolean)));
  const gen = new Set(pages.map((p) => p.path));
  const resolves = (href) => {
    if (/^mailto:|^https?:\/\//.test(href) || href.startsWith('#')) return true;
    const u = href.split('#')[0].split('?')[0];
    if (gen.has(u) || spa.has(u)) return true;
    return fs.existsSync(path.join(ROOT, u.replace(/^\//, '')));
  };
  const broken = [];
  for (const p of pages) for (const m of all(/href="([^"]+)"/, read(p.path.slice(1) + 'index.html'))) if (!resolves(m[1])) broken.push(p.path + ' → ' + m[1]);
  for (const m of all(/href="(\/(?:learn\/[^"]*|ppc-automation-software\/|cross-platform-ad-management\/))"/, idx)) if (!resolves(m[1])) broken.push('index.html → ' + m[1]);
  check('every internal link on generated pages (and new links in index.html) resolves', broken.length === 0, broken);
  check('no generated page links into the private app (/app)', !pages.some((p) => /href="\/app/.test(read(p.path.slice(1) + 'index.html'))));
  const inbound = (target) => pages.some((p) => p.path !== target && read(p.path.slice(1) + 'index.html').includes(`href="${target}"`)) || idx.includes(`href="${target}"`);
  check('no orphan pages: every generated page has an inbound link', pages.every((p) => inbound(p.path)), pages.filter((p) => !inbound(p.path)).map((p) => p.path));
  check('homepage nav + footer link to /learn/ and both solution pages', idx.includes('href="/learn/" class="lp-dd-item"') && idx.includes('href="/learn/" class="ov-footer-link"') && idx.includes('href="/ppc-automation-software/"') && idx.includes('href="/cross-platform-ad-management/"'));

  console.log('\nC. index.html head, structured data, homepage');
  const headTitle = (idx.match(/<title>([^<]*)<\/title>/) || [])[1];
  check('static <head> title/description = PAGE_SEO.landing (no raw vs rendered conflict on /)', headTitle === pageSeo.landing.title && idx.includes(`<meta name="description" content="${pageSeo.landing.desc}">`));
  check('one canonical tag, homepage self-reference', all(/rel="canonical"/, idx).length === 1 && idx.includes('<link rel="canonical" href="https://orivenai.com/" id="ovCanonical">'));
  const idxLd = jsonLd(idx);
  const org = idxLd.find((x) => x['@type'] === 'Organization'), app = idxLd.find((x) => x['@type'] === 'SoftwareApplication');
  check('index.html JSON-LD parses; Organization "OrivenAI" with alternate names', idxLd.length === 3 && org.name === 'OrivenAI' && org.alternateName.includes('ORIVEN'));
  check('PAGE_SEO titles unique and branded OrivenAI', new Set(Object.values(pageSeo).map((s) => s.title)).size === Object.keys(pageSeo).length && Object.values(pageSeo).every((s) => /OrivenAI/.test(s.title)));
  check('Google/Meta product pages target their commercial intent', /AI Google Ads Management/.test(pageSeo['product-google-ads'].title) && /Meta Ads Automation/.test(pageSeo['product-meta-ads'].title));
  check('homepage states the category above the brand headline', /<p class="ov-section-eyebrow ov-hero-category">AI advertising platform<\/p>\s*<h1 class="lp-hero-h1 ov-h1">Advertising gets complicated\.<br>ORIVEN puts it in ORDER\.<\/h1>/.test(idx));
  check('login/signup stay noindex', pageSeo.login.noindex === true && pageSeo.signup.noindex === true);

  console.log('\nD. Product facts match the product code');
  const ctx = { window: {}, document: { addEventListener() {}, querySelectorAll() { return []; }, getElementById() { return null; } }, console };
  vm.createContext(ctx); vm.runInContext(read('js/plans.js'), ctx);
  const P = vm.runInContext('typeof ORIVEN_PLANS !== "undefined" ? ORIVEN_PLANS : window.ORIVEN_PLANS', ctx);
  const C = vm.runInContext('typeof CREDIT_COSTS !== "undefined" ? CREDIT_COSTS : window.CREDIT_COSTS', ctx);
  const F = require(path.join(ROOT, 'tools/seo/facts.js'));
  check('plan prices on public pages = plans.js', F.plans.every((p) => P[p.id] && Number(P[p.id].price) === p.price), F.plans.map((p) => [p.id, P[p.id] && P[p.id].price]));
  check('image/video ad credit costs = plans.js', F.costs.imageAd === C.imageAdComplete && (C.videoAdComplete == null || F.costs.videoAd === C.videoAdComplete), [C.imageAdComplete, C.videoAdComplete]);
  check('SoftwareApplication offers in index.html = plans.js', app.offers.offers.every((o) => P[o.name.toLowerCase()] && Number(P[o.name.toLowerCase()].price) === Number(o.price)));
  const allHtml = pages.map((p) => read(p.path.slice(1) + 'index.html')).join('\n');
  check('pages never claim Autopilot on TikTok/Pinterest or team/agency features', !/autopilot[^.]{0,60}(tiktok|pinterest)[^.]{0,30}(yes|support)/i.test(text(allHtml)) && !/multi-client|agency dashboard|team seats|invite (your )?team/i.test(text(allHtml)));

  console.log('\nE. sitemap.xml and robots.txt');
  const sm = read('sitemap.xml');
  const locs = all(/<loc>([^<]+)<\/loc>/, sm).map((m) => m[1]);
  check('sitemap well-formed (urlset, one <loc> per <url>)', /^<\?xml version="1.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sm) && sm.trim().endsWith('</urlset>') && all(/<url>/, sm).length === locs.length && all(/<url>/, sm).length === all(/<\/url>/, sm).length);
  check('sitemap URLs unique, absolute, https://orivenai.com', new Set(locs).size === locs.length && locs.every((l) => l.startsWith(ORIGIN + '/')));
  check('sitemap includes every generated page', pages.every((p) => locs.includes(ORIGIN + p.path)));
  check('sitemap has no private, auth or noindex URLs', !locs.some((l) => /\/(app|login|signup|onboarding|plan)(\/|$)/.test(l.replace(ORIGIN, ''))));
  check('every sitemap URL is a real route', locs.every((l) => { const u = l.replace(ORIGIN, ''); return u === '/' || gen.has(u) || spa.has(u); }), locs.filter((l) => { const u = l.replace(ORIGIN, ''); return !(u === '/' || gen.has(u) || spa.has(u)); }));
  check('lastmod only on generated pages (real dates)', all(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/, sm).length === pages.length);
  const rb = read('robots.txt');
  check('robots.txt: allows the site, blocks /app, points to the sitemap', /User-agent: \*/.test(rb) && /Disallow: \/app\b/.test(rb) && /Sitemap: https:\/\/orivenai\.com\/sitemap\.xml/.test(rb) && !/Disallow: \/(learn|ppc|cross)/.test(rb) && !/Disallow: \/\s*$/m.test(rb));

  console.log('\nF. Edge function (crawler-visible metadata for SPA routes)');
  const edgeSrc = read('netlify/edge-functions/seo-meta.js');
  const tmp = path.join(require('os').tmpdir(), 'seo-meta-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, edgeSrc);
  const E = await import('file://' + tmp.replace(/\\/g, '/'));
  fs.unlinkSync(tmp);
  const routes = Object.keys(E.ROUTES);
  check('edge routes = every PAGE_SEO route except / and 404', routes.length === Object.values(pageSeo).filter((s) => s.path && s.path !== '/').length && routes.every((r) => spa.has(r)));
  check('config.path lists exactly those routes; onError bypass', JSON.stringify([...E.config.path].sort()) === JSON.stringify([...routes].sort()) && E.config.onError === 'bypass');
  let allOk = true; const bad = [];
  for (const r of routes) {
    const out = E.rewriteHead(idx, r); const s = E.ROUTES[r];
    const e = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ok = out.includes(`<title>${e(s.title)}</title>`) && out.includes(`<meta name="description" content="${e(s.desc)}">`)
      && out.includes(`<link rel="canonical" href="${ORIGIN + r}" id="ovCanonical">`) && out.includes(`content="${ORIGIN + r}" id="ovOgUrl"`)
      && out.includes(`content="${e(s.title)}" id="ovOgTitle"`) && out.includes(`content="${e(s.desc)}" id="ovTwDesc"`)
      && out.includes(`content="${s.noindex ? 'noindex, follow' : 'index, follow'}" id="ovRobotsMeta"`);
    const changed = idx.split('\n').filter((l, i) => l !== out.split('\n')[i]).length;
    if (!ok || changed > 9 || out.length < idx.length - 2000) { allOk = false; bad.push([r, ok, changed]); }
  }
  check('every SPA route: own title, description, canonical, OG/Twitter, robots in the HTML; nothing else changed', allOk, bad);
  check('/pricing raw HTML no longer canonicalizes to the homepage', E.rewriteHead(idx, '/pricing').includes('href="https://orivenai.com/pricing" id="ovCanonical"'));
  check('/login and /signup are noindex in the HTML itself', /content="noindex, follow" id="ovRobotsMeta"/.test(E.rewriteHead(idx, '/login')) && /content="noindex, follow" id="ovRobotsMeta"/.test(E.rewriteHead(idx, '/signup')));
  check('unknown path / homepage untouched', E.rewriteHead(idx, '/') === idx && E.rewriteHead(idx, '/nope') === idx);
  const mkRes = (body, type, status) => new Response(body, { status: status || 200, headers: { 'content-type': type, 'content-length': String(body.length), etag: 'x' } });
  const call = async (p, res) => E.default(new Request(ORIGIN + p), { next: async () => res });
  let r = await call('/pricing', mkRes(idx, 'text/html; charset=UTF-8'));
  const body = await r.text();
  check('handler: HTML 200 rewritten, stale content-length/etag dropped', body.includes('href="https://orivenai.com/pricing" id="ovCanonical"') && !r.headers.get('content-length') && !r.headers.get('etag') && r.status === 200);
  r = await call('/pricing', mkRes('{}', 'application/json'));
  check('handler: non-HTML passes through unchanged', (await r.text()) === '{}');
  r = await call('/learn/', mkRes(idx, 'text/html'));
  check('handler: routes it does not own are not touched (returns nothing → Netlify continues)', r === undefined);

  console.log(`\n${pass} checks run, ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
