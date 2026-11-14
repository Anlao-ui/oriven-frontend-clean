// ════════════════════════════════════════════════════════════════
// Snapchat Ads on the public website: the homepage "Works with the ad
// platforms you already use" network (five platforms around the centred
// logo, symmetric, no overflow at desktop / tablet / mobile), the five-row
// list, /product/snapchat-ads (generated page, routing, sitemap, footer),
// and consistent platform wording. Fenced: only this test's static server.
// RUN: node tests/snapchat-public.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8964, BASE = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const check = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 400))); };
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, BASE).pathname);
  // the Netlify rewrites (200!) decide which file a path serves
  const m = redirects.split(/\r?\n/).map((l) => l.trim().split(/\s+/)).find((x) => x[0] === p && x[2] === '200!');
  if (m) p = m[1];
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const browser = await chromium.launch();
  fenceBrowser(browser, BASE);
  const errors = [];
  for (const [w, h] of [[1440, 900], [820, 1100], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + '/');
    await page.locator('#integrations').scrollIntoViewIfNeeded();
    const d = await page.evaluate(() => {
      const svg = document.querySelector('#integrations .ik-net'), r = svg.getBoundingClientRect();
      const hub = document.querySelector('#integrations .ik-net__hub').getBoundingClientRect();
      const c = (b) => [b.x + b.width / 2 - r.x, b.y + b.height / 2 - r.y];
      const nodes = {}; document.querySelectorAll('#integrations .ik-net__node').forEach((n) => { nodes[n.dataset.int] = c(n.getBoundingClientRect()); });
      return { w: r.width, hub: c(hub), nodes, pulses: Array.from(document.querySelectorAll('#integrations .ik-net__pulse')).map((p) => p.dataset.int), rows: Array.from(document.querySelectorAll('#integrations .ik-int')).map((e) => e.dataset.int), snapHref: (document.querySelector('#integrations .ik-int[data-int="snapchat"] .ik-int__more') || {}).getAttribute && document.querySelector('#integrations .ik-int[data-int="snapchat"] .ik-int__more').getAttribute('href'), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    const ids = ['google', 'meta', 'tiktok', 'pinterest', 'snapchat'];
    const n = d.nodes, hc = d.hub, close = (a, b) => Math.abs(a - b) <= 2;
    const dist = (k) => Math.hypot(n[k][0] - hc[0], n[k][1] - hc[1]);
    check(w + ' · five platform nodes, five lines and five list rows, in the same order', ids.every((k) => n[k]) && d.pulses.join() === ids.join() && d.rows.join() === ids.join(), d);
    check(w + ' · the OrivenAI logo is centred in the network', close(hc[0], d.w / 2) && close(hc[1], d.w / 2), { hub: hc, w: d.w });
    check(w + ' · nodes on one circle around the logo (regular pentagon)', ids.every((k) => Math.abs(dist(k) - dist('google')) <= 2), ids.map((k) => Math.round(dist(k))));
    check(w + ' · mirror-symmetric: Google on the axis, Meta/Snapchat and TikTok/Pinterest level and equidistant', close(n.google[0], hc[0]) && close(n.meta[1], n.snapchat[1]) && close(n.tiktok[1], n.pinterest[1]) && close(n.meta[0] - hc[0], hc[0] - n.snapchat[0]) && close(n.tiktok[0] - hc[0], hc[0] - n.pinterest[0]), n);
    check(w + ' · Snapchat row links to its product page; nothing scrolls sideways', d.snapHref === '/product/snapchat-ads' && d.overflow <= 0, d);
    await page.close();
  }
  // Product page
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const resp = await page.goto(BASE + '/product/snapchat-ads');
  const p = await page.evaluate(() => ({ title: document.title, canonical: (document.querySelector('link[rel="canonical"]') || {}).href, h1: (document.querySelector('#view-product-snapchat-ads .ov-sp-h1') || {}).textContent, depth: (document.querySelector('#deep-product-snapchat-ads-h') || {}).textContent, foot: !!document.querySelector('.site-foot a[href="/product/snapchat-ads"]'), login: /Login Kit|Public Profile API/.test(document.body.innerText), traffic: /Traffic and Awareness campaigns only/.test(document.body.innerText) }));
  check('/product/snapchat-ads is served (Netlify rewrite) with its own title and canonical', resp.status() === 200 && /Snapchat Ads Tool/.test(p.title) && /\/product\/snapchat-ads$/.test(p.canonical || ''), p);
  check('product page: hero, generated "In detail" section, footer link', /Snapchat Ads,\s*fully connected/.test(p.h1 || '') && /What OrivenAI builds on Snapchat/.test(p.depth || '') && p.foot, p);
  check('product page states the real limits (Traffic/Awareness only) and never calls it Login Kit / Public Profile API', p.traffic && !p.login, p);
  await page.close();
  await browser.close(); srv.close();
  // Files
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  check('sitemap lists /product/snapchat-ads', /\/product\/snapchat-ads</.test(sitemap));
  const home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8'), product = fs.readFileSync(path.join(ROOT, 'product.html'), 'utf8');
  check('"Five platforms." on /product, no "Four platforms." left', /Five platforms\./.test(product) && !/Four platforms\./.test(product + home));
  check('homepage FAQ names all five platforms', /TikTok Ads, Pinterest Ads and Snapchat Ads/.test(home));
  check('Audience Builder wording stays four platforms (no Snapchat targeting there)', /Targeting suggestions for Meta, Google, TikTok and Pinterest/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
  check('no page errors', !errors.length, errors);
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
