// ════════════════════════════════════════════════════════════════
// Public site checks against a local server that emulates Netlify's
// _redirects (rules in order; a real file shadows a non-forced rule; "!"
// forces; "/*" splat; 200 rewrite, 301/302 redirect, 404 with body).
// No network: external requests are blocked in the browser.
//   node tests/seo-site.test.js
// Covers: every sitemap URL (status, single H1, canonical, title,
// description, robots, valid JSON-LD, unique body), unknown URLs (real
// 404), trailing slashes, app routes, internal links, content visible
// without JavaScript, page errors, in-page navigation, login/signup
// buttons, pricing cards, mobile layout, image weight.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://orivenai.com';
const PORT = 8896, BASE = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const check = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + n + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 400))); };

// ── Netlify-like server ──
const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [from, to, st] = l.split(/\s+/); return { from, to, status: parseInt(st, 10), force: /!$/.test(st) }; });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json' };
function fileFor(p) {
  const f = path.join(ROOT, decodeURIComponent(p));
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  if (fs.existsSync(path.join(f, 'index.html'))) return path.join(f, 'index.html');
  if (!p.endsWith('/') && fs.existsSync(f + '.html')) return f + '.html'; // Netlify pretty URLs
  return null;
}
function send(res, status, file, extra) { fs.readFile(file, (e, b) => { res.writeHead(status, Object.assign({ 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }, extra || {})); res.end(b); }); }
const server = http.createServer((req, res) => {
  const u = new URL(req.url, BASE); const p = u.pathname;
  // Directory without trailing slash → Netlify adds it (e.g. /learn/x → /learn/x/).
  const dir = path.join(ROOT, decodeURIComponent(p));
  if (!p.endsWith('/') && fs.existsSync(path.join(dir, 'index.html')) && !fs.existsSync(dir + '.html')) { res.writeHead(301, { location: p + '/' }); return res.end(); }
  const existing = fileFor(p);
  for (const r of rules) {
    const m = r.from.endsWith('/*') ? p.startsWith(r.from.slice(0, -1)) : (p === r.from || p === r.from + '/'); // Netlify ignores a trailing slash when matching
    if (!m) continue;
    if (existing && !r.force) break; // a real file shadows a non-forced rule
    if (r.status === 301 || r.status === 302) { res.writeHead(r.status, { location: r.to }); return res.end(); }
    const target = fileFor(r.to.split('?')[0]);
    if (target) return send(res, r.status, target);
  }
  if (existing) return send(res, 200, existing);
  res.writeHead(404); res.end('not found');
}).listen(PORT, run);

const get = (p) => new Promise((r) => http.get(BASE + p, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => r({ status: res.statusCode, location: res.headers.location, body: b })); }));
const all = (re, s) => [...s.matchAll(new RegExp(re.source, 'g'))];
const textOf = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function run() {
  try {
    console.log('\nA. Sitemap URLs: status, head, structured data');
    const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const locs = all(/<loc>([^<]+)<\/loc>/, sm).map((m) => m[1]);
    const lastmods = all(/<lastmod>([^<]+)<\/lastmod>/, sm).length;
    check('sitemap: every URL has a lastmod', locs.length > 0 && lastmods === locs.length, { locs: locs.length, lastmods });
    check('sitemap: no duplicates', new Set(locs).size === locs.length);
    const titles = new Map(), descs = new Map(), bodies = new Map();
    let bad = [];
    for (const loc of locs) {
      const p = loc.replace(ORIGIN, '') || '/';
      const r = await get(p);
      const h = r.body;
      const t = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
      const d = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];
      const canon = all(/<link rel="canonical" href="([^"]*)"/, h).map((m) => m[1]);
      const robots = (h.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
      const lds = all(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, h).map((m) => { try { return JSON.parse(m[1]); } catch (_) { return 'INVALID'; } });
      const body = h.slice(h.indexOf('<body'));
      const h1 = all(/<h1[\s>]/, body).length;
      const words = textOf(body).split(' ').length;
      const problems = [];
      if (r.status !== 200) problems.push('status ' + r.status);
      const tDec = (t || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      if (!t || tDec.length > 80) problems.push('title ' + tDec.length);
      if (!d || d.length < 70 || d.length > 175) problems.push('description ' + (d || '').length);
      if (canon.length !== 1 || canon[0] !== loc) problems.push('canonical ' + canon.join(','));
      if (!/index, follow/.test(robots)) problems.push('robots ' + robots);
      if (lds.some((x) => x === 'INVALID') || !lds.length) problems.push('json-ld');
      if (lds.some((x) => x !== 'INVALID' && /"aggregateRating"|"@type":"Review"|"reviewRating"/.test(JSON.stringify(x)))) problems.push('ratings in schema');
      if (h1 !== 1) problems.push('h1=' + h1);
      if (all(/class="pub-view"/, body).length > (p === '/' ? 1 : 0)) problems.push('hidden views in body');
      if (words < 250 && !/terms|privacy|refund|cookie|contact|security|blog$/.test(p)) problems.push('thin ' + words + ' words');
      if (titles.has(t)) problems.push('duplicate title with ' + titles.get(t)); titles.set(t, p);
      if (descs.has(d)) problems.push('duplicate description'); descs.set(d, p);
      const bh = require('crypto').createHash('md5').update(body).digest('hex');
      if (bodies.has(bh)) problems.push('identical body to ' + bodies.get(bh)); bodies.set(bh, p);
      if (problems.length) bad.push(p + ': ' + problems.join('; '));
    }
    check('every sitemap URL: 200, one H1, own title/description/canonical, index robots, valid JSON-LD, no ratings, unique body, not thin', bad.length === 0, bad);

    console.log('\nB. Status codes and redirects');
    let r = await get('/this-page-does-not-exist-xyz');
    check('unknown URL → real 404 with the designed 404 page (noindex)', r.status === 404 && /noindex/.test(r.body) && /view-404/.test(r.body), r.status);
    r = await get('/learn/not-a-real-guide/');
    check('unknown Learn URL → 404', r.status === 404, r.status);
    r = await get('/assets/fonts/Fuuld-Bold.woff2');
    check('missing asset → 404 (no longer the 470 KB homepage)', r.status === 404, r.status);
    for (const [from, canon] of [['/pricing/', '/pricing'], ['/product/meta-ads/', '/product/meta-ads'], ['/faq/', '/faq']]) {
      r = await get(from);
      check(`${from} serves the same page with canonical ${canon}`, r.status === 200 && r.body.includes('href="' + ORIGIN + canon + '" id="ovCanonical"'), r.status);
    }
    r = await get('/learn/how-to-test-ad-creatives');
    check('/learn/how-to-test-ad-creatives → 301 to the trailing-slash URL', r.status === 301 && r.location === '/learn/how-to-test-ad-creatives/', r);
    for (const p of ['/app', '/login', '/signup']) { r = await get(p); check(`${p} still served (200)`, r.status === 200, r.status); }
    r = await get('/onboarding'); check('/onboarding → 302 to the app tour', r.status === 302 && /\/app\?tour=1/.test(r.location));
    r = await get('/login');
    check('/login: noindex, SPA shell', /noindex/.test(r.body) && /id="view-login"/.test(r.body));
    r = await get('/robots.txt');
    check('robots.txt allows the site, blocks the app, points to the sitemap', /Allow: \//.test(r.body) && /Disallow: \/app/.test(r.body) && /Sitemap: https:\/\/orivenai\.com\/sitemap\.xml/.test(r.body));
    r = await get('/case-studies');
    check('/case-studies: noindex (illustrative, no real proof) and not in the sitemap', /noindex/.test(r.body) && !locs.includes(ORIGIN + '/case-studies'));

    console.log('\nC. Internal links');
    const broken = new Set();
    for (const loc of locs) {
      const h = (await get(loc.replace(ORIGIN, '') || '/')).body;
      const hrefs = all(/href="(\/[^"#?]*)/, h).map((m) => m[1]).filter((x) => !/^\/(assets|css|js|fonts)\//.test(x) && !/\.(css|js|png|webp|svg|ico|xml|txt)$/.test(x));
      for (const x of new Set(hrefs)) {
        const s = await get(x);
        if (!(s.status === 200 || (s.status === 301 && s.location && (await get(s.location)).status === 200))) broken.add(loc.replace(ORIGIN, '') + ' → ' + x + ' (' + s.status + ')');
      }
    }
    check('no broken internal links from any sitemap page', broken.size === 0, [...broken].slice(0, 10));

    console.log('\nD. Browser: rendering, navigation, no-JS content, mobile');
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const block = (page) => page.route(/^https?:\/\/(?!127\.0\.0\.1:8896)/, (rt) => (/cdn\.jsdelivr\.net/.test(rt.request().url()) ? rt.continue() : rt.abort()));
    const pages = ['/pricing', '/create', '/product/meta-ads', '/faq', '/research', '/learn/ad-character-limits/', '/'];
    for (const [w, hgt, tag] of [[1366, 900, 'desktop'], [390, 844, 'mobile']]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt } });
      for (const p of pages) {
        const page = await ctx.newPage(); await block(page);
        const errs = []; page.on('pageerror', (e) => errs.push(e.message));
        let imgBytes = 0; page.on('response', async (res) => { if (res.request().resourceType() === 'image') { try { imgBytes += (await res.body()).length; } catch (_) {} } });
        await page.goto(BASE + p, { waitUntil: 'load' }); await page.waitForTimeout(900);
        const st = await page.evaluate(() => ({
          h1: [...document.querySelectorAll('h1')].filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          pricing: document.querySelectorAll('#lpPricingGrid > *').length,
        }));
        const okP = errs.length === 0 && st.h1 === 1 && st.overflow <= 1 && (p !== '/pricing' || st.pricing >= 4);
        check(`${tag} ${p}: no errors, one visible H1, no horizontal overflow${p === '/pricing' ? ', plan cards rendered' : ''}; images ${Math.round(imgBytes / 1024)} KB`, okP, { errs, st });
        await page.close();
      }
      await ctx.close();
    }
    // Navigation from a prerendered page.
    let ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    let page = await ctx.newPage(); await block(page);
    await page.goto(BASE + '/pricing', { waitUntil: 'load' });
    await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => {}), page.evaluate(() => window.lpNavigate('/create'))]);
    check('in-page navigation from a prerendered page loads the other page', /\/create$/.test(page.url()) && (await page.textContent('h1')).length > 5, page.url());
    await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => {}), page.evaluate(() => window.lpGetStarted())]);
    check('"Get started" from a prerendered page opens /signup', /\/signup$/.test(page.url()) && (await page.evaluate(() => !!document.getElementById('view-signup') && getComputedStyle(document.getElementById('view-signup')).display !== 'none')), page.url());
    await ctx.close();
    // Homepage (home.html: landing view only).
    ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    page = await ctx.newPage(); await block(page);
    const homeErrs = []; page.on('pageerror', (e) => homeErrs.push(e.message));
    await page.goto(BASE + '/', { waitUntil: 'load' }); await page.waitForTimeout(1200);
    const home = await page.evaluate(() => ({ views: 1 + ['pricing', 'signup', 'login', 'faq', 'product-create'].filter((k) => document.getElementById('view-' + k)).length, landing: !!document.getElementById('view-landing') && getComputedStyle(document.getElementById('view-landing')).display !== 'none', h1: (document.querySelector('#view-landing h1') || {}).textContent || '' }));
    check('homepage: only the landing view, visible, no script errors', home.views === 1 && home.landing && home.h1.length > 5 && homeErrs.length === 0, { home, homeErrs });
    await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => {}), page.evaluate(() => window.lpNavigate('/pricing'))]);
    check('homepage → /pricing loads the pricing page with plan cards', /\/pricing$/.test(page.url()) && (await page.evaluate(() => document.querySelectorAll('#lpPricingGrid > *').length)) >= 4, page.url());
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => {}), page.evaluate(() => window.lpGetStarted())]);
    check('homepage "Get started" opens /signup', /\/signup$/.test(page.url()) && (await page.evaluate(() => getComputedStyle(document.getElementById('view-signup')).display !== 'none')), page.url());
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => {}), page.evaluate(() => window.lpNavigate('/login'))]);
    check('homepage → /login shows the login form', /\/login$/.test(page.url()) && (await page.evaluate(() => getComputedStyle(document.getElementById('view-login')).display !== 'none')), page.url());
    await ctx.close();
    // No JavaScript: content still there.
    ctx = await browser.newContext({ javaScriptEnabled: false });
    page = await ctx.newPage();
    for (const p of ['/create', '/pricing', '/product/tiktok-ads']) {
      await page.goto(BASE + p, { waitUntil: 'load' });
      const vis = await page.evaluate(() => { const h = document.querySelector('h1'); const r = h && h.getBoundingClientRect(); return { h1: h && h.textContent.trim().slice(0, 50), visible: !!(r && r.width && r.height), steps: document.querySelectorAll('.ov-deep-steps li, .ov-price-table tr').length }; });
      check(`no JavaScript: ${p} shows its H1 and in-depth content`, vis.visible && vis.steps >= 3, vis);
    }
    await ctx.close();
    // Character counter tool.
    ctx = await browser.newContext(); page = await ctx.newPage(); await block(page);
    await page.goto(BASE + '/learn/ad-character-limits/', { waitUntil: 'load' });
    await page.fill('#ccText', 'Linen shirts that stay cool all summer long');
    const out = await page.textContent('#ccOut');
    check('character counter: counts and reports over/left against the selected limit', /43/.test(out) && /13 over/.test(out), out);
    await ctx.close();
    await browser.close();
  } catch (e) { console.log('CRASH', e && e.stack || e); fail++; }
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  server.close();
  setTimeout(() => process.exit(fail ? 1 : 0), 50);
}
