// Network fence for browser suites: a page may reach only the test's own
// static server (and data:/blob:/static CDN GETs). Everything else —
// localhost:5500 (the real backend often runs there), Supabase, Render,
// orivenai.com, provider APIs — is aborted before it leaves the browser.
//
// Use right after launching the browser:
//   const browser = await chromium.launch(...);
//   require('./_fence').fenceBrowser(browser, BASE_URL);
//
// The fence is registered first on every page, so a test's own page.route()
// handlers (registered later) still take precedence over it.
//
// opts.backend401: answer the real backend's /api/* (localhost:5500) with a
// local 401 — what that backend tells a request without a valid session —
// instead of aborting it, for suites that expect a signed-out backend. The
// request still never leaves the browser.
const STATIC_CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

function fenceBrowser(browser, base, opts) {
  const origin = new URL(base).origin;
  const blocked = [];
  const allow = (opts && opts.allow) || null;
  const backend401 = !!(opts && opts.backend401);
  const install = async (page) => {
    await page.route('**/*', (route) => {
      const req = route.request();
      const u = req.url();
      if (u.startsWith(origin + '/') || u === origin || /^(data|blob|about):/.test(u)) return route.fallback();
      if (req.method() === 'GET' && STATIC_CDN.test(u)) return route.fallback();
      if (allow && allow.test(u)) return route.fallback();
      blocked.push(u);
      if (backend401 && u.startsWith('http://localhost:5500/api/')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Authentication required', code: 'AUTH_REQUIRED' }) });
      return route.abort('blockedbyclient');
    });
  };
  const wrap = (target) => {
    const orig = target.newPage.bind(target);
    target.newPage = async (...a) => { const p = await orig(...a); await install(p); return p; };
  };
  wrap(browser);
  const origCtx = browser.newContext.bind(browser);
  browser.newContext = async (...a) => { const c = await origCtx(...a); wrap(c); return c; };
  process.on('exit', () => {
    const outside = Array.from(new Set(blocked.map((u) => { try { return new URL(u).host; } catch (_) { return u; } })));
    if (process.env.FENCE_VERBOSE) { const paths = {}; blocked.forEach((u) => { try { const x = new URL(u); paths[x.host + x.pathname] = (paths[x.host + x.pathname] || 0) + 1; } catch (_) {} }); console.log('[fence] blocked paths:', JSON.stringify(paths)); }
    console.log('[fence] ' + blocked.length + ' request(s) blocked before leaving the browser' + (outside.length ? ' (' + outside.slice(0, 8).join(', ') + ')' : '') + '; nothing reached a host other than ' + origin + ' (and static CDN GETs).');
  });
  return { blocked };
}

module.exports = { fenceBrowser };
