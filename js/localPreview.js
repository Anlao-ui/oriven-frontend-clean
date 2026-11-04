/* ════════════════════════════════════════════════════════════════
   Local preview: every page can be inspected at localhost while Stripe
   products and access periods are still being set up.

   Active only when BOTH are true:
   - this page and the API are on this machine (ORIVEN_DEV, API_BASE_URL
     http://localhost…), and
   - the local server says so (GET /api/dev/local-preview — only registered
     off Render and outside NODE_ENV=production, so it doesn't exist in
     production).

   It opens page VIEWS only: the "choose a plan" overlays on Research and
   Automations step aside (js/orivenOps.js applyEntitlements reads
   window.ORV_LOCAL_PREVIEW). Nothing is shown for it. Every paid or AI
   action still goes to the server, which checks access, credits and
   idempotency exactly as before.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof ORIVEN_DEV === 'undefined' || !ORIVEN_DEV) return;
  var base = typeof API_BASE_URL !== 'undefined' ? String(API_BASE_URL) : '';
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) return;
  function on() {
    window.ORV_LOCAL_PREVIEW = true;
    document.body.classList.add('orv-local-preview');
    var ops = window.orvWorkspace && window.orvWorkspace.ops;
    if (ops && typeof ops.applyEntitlements === 'function') ops.applyEntitlements();
  }
  function check() {
    fetch(base + '/api/dev/local-preview', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.localPreview === true) on(); })
      .catch(function () { /* no local server, or an older one: nothing changes */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();
})();
