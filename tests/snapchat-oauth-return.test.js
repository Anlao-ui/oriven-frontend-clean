// ════════════════════════════════════════════════════════════════
// Snapchat OAuth return messages (js/auth.js). The backend callback sends
// ?snapchat_connected=1, or ?snapchat_error=…[&snapchat_reason=…]; the app
// must say exactly what happened — success only on success, and the real
// reason (e.g. invalid_client) instead of a generic "Connection failed".
// Fenced: the page can reach only this test's static server.
// RUN: node tests/snapchat-oauth-return.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8963, BASE = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const check = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 300))); };

const PAGE = '<!doctype html><meta charset="utf-8"><title>t</title><div class="app"></div><div id="authOverlay"></div>'
  + '<script>window.__toasts=[];window.toast=function(m,k){window.__toasts.push([m,k||"ok"]);};window.navigate=function(){};</script>'
  + '<script src="/js/auth.js"></script>';
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, BASE);
  if (u.pathname === '/t.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(PAGE); }
  if (u.pathname === '/js/auth.js') { r.writeHead(200, { 'Content-Type': 'application/javascript' }); return r.end(fs.readFileSync(path.join(ROOT, 'js/auth.js'))); }
  r.writeHead(404); r.end();
});

(async () => {
  await new Promise((res) => srv.listen(PORT, res));
  const browser = await chromium.launch();
  fenceBrowser(browser, BASE);
  const run = async (qs) => {
    const page = await browser.newPage();
    await page.goto(BASE + '/t.html?' + qs);
    await page.evaluate(() => { window._detectPendingOAuthReturn(); window.showApp(); });
    await page.waitForTimeout(800);
    const t = await page.evaluate(() => window.__toasts.slice());
    await page.close();
    return t;
  };
  let t = await run('snapchat_connected=1');
  check('1. backend connected → success message, no error', t.length === 1 && /Snapchat Ads connected successfully/.test(t[0][0]) && t[0][1] !== 'err', t);
  t = await run('snapchat_error=token_exchange&snapchat_reason=invalid_client');
  check('2. invalid_client → says Snapchat didn’t accept OrivenAI’s app credentials (error)', t.length === 1 && t[0][1] === 'err' && /didn't accept OrivenAI's app credentials \(invalid_client\)/.test(t[0][0]), t);
  t = await run('snapchat_error=token_exchange&snapchat_reason=invalid_grant');
  check('3. invalid_grant → sign-in expired or already used, connect again', t.length === 1 && t[0][1] === 'err' && /expired or was already used/.test(t[0][0]), t);
  t = await run('snapchat_error=token_exchange&snapchat_reason=http_502');
  check('4. any other reason is shown by its code', t.length === 1 && /\(http_502\)/.test(t[0][0]), t);
  t = await run('snapchat_error=token_exchange&snapchat_reason=%3Cimg%20src%3Dx%3E');
  check('5. a reason can’t inject markup (letters, digits and _ only)', t.length === 1 && !/[<>]/.test(t[0][0]), t);
  t = await run('snapchat_error=invalid_state');
  check('6. invalid state keeps its own message', t.length === 1 && /session expired/.test(t[0][0]), t);
  t = await run('snapchat_error=token_exchange');
  check('7. token_exchange without a reason (older backend) keeps the generic message', t.length === 1 && /connection failed — please try again/.test(t[0][0]), t);
  t = await run('pinterest_error=token_exchange');
  check('8. other platforms unchanged', t.length === 1 && /Pinterest Ads connection failed — please try again/.test(t[0][0]), t);
  await browser.close(); srv.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
