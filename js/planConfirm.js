/* ════════════════════════════════════════════════════════════════
   OrivenAI — confirm the chosen plan before Stripe Checkout

   Every way to buy (the onboarding plans step, the in-app plan picker)
   goes through selectPlan() in js/auth.js, which asks here first. The
   dialog shows exactly the plan that will be bought — name, price incl.
   VAT, access period, credits and how they arrive — from js/plans.js
   (which mirrors the server's services/pricing.js). Only the plan id is
   sent to the server; it decides price, duration and credits.
   orvConfirmPlan(id) → Promise<boolean>.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var open = null;

  function credits(p) {
    var n = typeof orvFormatCredits === 'function' ? orvFormatCredits : function (x) { return x.toLocaleString('en-US'); };
    if (p.instalments > 1) return n(p.credits) + ' credits in total — ' + n(p.creditsPerInstalment) + ' added each month for ' + p.instalments + ' months';
    return n(p.credits) + ' credits, available right after payment';
  }
  function period(p) { return p.days ? p.days + ' days of full access' : (p.months === 1 ? '1 month of full access' : p.months + ' months of full access'); }

  window.orvConfirmPlan = function (id) {
    var p = typeof orvPeriodPlan === 'function' ? orvPeriodPlan(id) : null;
    if (!p) return Promise.resolve(false);
    if (open) open.finish(false);
    return new Promise(function (resolve) {
      var f = typeof orvPlanCardFacts === 'function' ? orvPlanCardFacts(p) : { price: '€' + p.price };
      var prev = document.activeElement;
      var el = document.createElement('div');
      el.className = 'pcf'; el.id = 'orvPlanConfirm';
      el.innerHTML = '<div class="pcf__scrim" data-pcf="cancel"></div>' +
        '<div class="pcf__card" role="dialog" aria-modal="true" aria-labelledby="pcfH" aria-describedby="pcfD">' +
          '<p class="pcf__eyebrow">Your plan</p>' +
          '<h2 id="pcfH" class="pcf__name" data-plan="' + esc(p.id) + '">' + esc(p.name) + '</h2>' +
          '<p class="pcf__price"><b>' + esc(f.price) + '</b><span>one-time payment, incl. VAT where it applies</span></p>' +
          (p.description ? '<p class="pcf__desc" id="pcfD">' + esc(p.description) + '</p>' : '') +
          '<ul class="pcf__facts">' +
            '<li data-fact="period">' + esc(period(p)) + '</li>' +
            '<li data-fact="credits">' + esc(credits(p)) + '</li>' +
            '<li data-fact="renewal">No automatic renewal — buy again only if you want to</li>' +
          '</ul>' +
          '<div class="pcf__acts"><button type="button" class="pcf__go" data-pcf="go">Continue to secure payment</button>' +
            '<button type="button" class="pcf__back" data-pcf="cancel">Choose a different plan</button></div>' +
          '<p class="pcf__fine">Payment by Stripe. The final amount, including any VAT for your country, is shown before you pay.</p>' +
        '</div>';
      document.body.appendChild(el);
      var go = el.querySelector('[data-pcf="go"]');
      function finish(ok) {
        if (!open) return;
        open = null;
        document.removeEventListener('keydown', onKey, true);
        el.remove();
        if (!ok && prev && document.contains(prev)) try { prev.focus(); } catch (_) {}
        resolve(!!ok);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
        if (e.key === 'Tab') { // keep focus in the dialog
          var f2 = el.querySelectorAll('button'), first = f2[0], last = f2[f2.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      el.addEventListener('click', function (e) { var b = e.target.closest('[data-pcf]'); if (b) finish(b.getAttribute('data-pcf') === 'go'); });
      document.addEventListener('keydown', onKey, true);
      open = { finish: finish };
      setTimeout(function () { try { go.focus(); } catch (_) {} }, 20);
    });
  };
})();
