/* ════════════════════════════════════════════════════════════════
   OrivenAI — confirm the chosen plan before Stripe Checkout

   Every way to buy (the onboarding plans step, the in-app plan picker,
   Settings) goes through selectPlan() in js/auth.js, which opens this
   dialog. It shows exactly the plan that will be bought — name, price incl.
   VAT, access period, credits and how they arrive — from js/plans.js
   (which mirrors the server's services/pricing.js). Only the plan id is
   sent to the server; it decides price, duration and credits.

   orvConfirmPlan(id)                        → Promise<boolean> (confirmed?)
   orvConfirmPlan(id, { onContinue: fn })    → the dialog stays open while
     fn() asks the server for the Stripe Checkout session:
       fn() → Promise<{ ok: true, url } | { ok: false, message }>
     ok      the button keeps its spinner while the browser goes to Stripe;
             resolves true.
     not ok  the message shows in the dialog and the button offers
             "Try again". Resolves false only when the customer closes it.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var open = null;
  var GO_LABEL = 'Continue to secure payment';
  var BUSY_LABEL = 'Opening secure checkout…';
  var STALL_MS = 12000; // Stripe should have opened by now

  function credits(p) {
    var n = typeof orvFormatCredits === 'function' ? orvFormatCredits : function (x) { return x.toLocaleString('en-US'); };
    if (p.instalments > 1) return n(p.credits) + ' credits in total — ' + n(p.creditsPerInstalment) + ' added each month for ' + p.instalments + ' months';
    return n(p.credits) + ' credits, available right after payment';
  }
  // Plan prices are before VAT; Stripe adds the VAT for the customer's
  // country at checkout. The Dutch total (21 %) is shown as the example.
  function nlTotal(p) {
    var cents = Math.round(p.price * 100), vat = Math.round(cents * 0.21);
    var fmt = function (c) { return '€' + (c / 100).toFixed(2); };
    return { vat: fmt(vat), total: fmt(cents + vat) };
  }
  function period(p) { return p.days ? p.days + ' days of full access' : (p.months === 1 ? '1 month of full access' : p.months + ' months of full access'); }

  window.orvConfirmPlan = function (id, opts) {
    var p = typeof orvPeriodPlan === 'function' ? orvPeriodPlan(id) : null;
    if (!p) return Promise.resolve(false);
    var onContinue = opts && typeof opts.onContinue === 'function' ? opts.onContinue : null;
    if (open) open.finish(false);
    return new Promise(function (resolve) {
      var f = typeof orvPlanCardFacts === 'function' ? orvPlanCardFacts(p) : { price: '€' + p.price };
      var nl = nlTotal(p);
      var prev = document.activeElement;
      var el = document.createElement('div');
      el.className = 'pcf'; el.id = 'orvPlanConfirm';
      el.innerHTML = '<div class="pcf__scrim" data-pcf="cancel"></div>' +
        '<div class="pcf__card" role="dialog" aria-modal="true" aria-labelledby="pcfH" aria-describedby="pcfD">' +
          '<p class="pcf__eyebrow">Your plan</p>' +
          '<h2 id="pcfH" class="pcf__name" data-plan="' + esc(p.id) + '">' + esc(p.name) + '</h2>' +
          '<p class="pcf__price"><b>' + esc(f.price) + '</b><span>+ VAT · one-time payment</span></p>' +
          '<p class="pcf__vat" data-fact="vat">VAT is added at checkout for your country — in the Netherlands 21 %: ' + esc(f.price) + ' + ' + esc(nl.vat) + ' = <b>' + esc(nl.total) + '</b>. EU businesses outside the Netherlands with a valid VAT ID are usually charged no VAT (reverse charge).</p>' +
          (p.description ? '<p class="pcf__desc" id="pcfD">' + esc(p.description) + '</p>' : '') +
          '<ul class="pcf__facts">' +
            '<li data-fact="period">' + esc(period(p)) + '</li>' +
            '<li data-fact="credits">' + esc(credits(p)) + '</li>' +
            '<li data-fact="renewal">No automatic renewal — buy again only if you want to</li>' +
          '</ul>' +
          '<p class="pcf__err" role="alert" hidden></p>' +
          '<div class="pcf__acts"><button type="button" class="pcf__go" data-pcf="go"><span class="pcf__spin" aria-hidden="true"></span><span class="pcf__lbl">' + GO_LABEL + '</span></button>' +
            '<button type="button" class="pcf__back" data-pcf="cancel">Choose a different plan</button></div>' +
          '<p class="pcf__fine">Payment by Stripe. The exact total, with the VAT for your country, is shown before you pay.</p>' +
        '</div>';
      document.body.appendChild(el);
      var go = el.querySelector('[data-pcf="go"]'), back = el.querySelector('.pcf__back');
      var lbl = go.querySelector('.pcf__lbl'), err = el.querySelector('.pcf__err'), fine = el.querySelector('.pcf__fine');
      var busy = false, stall = 0;

      function setBusy(on) {
        busy = on;
        go.disabled = on; back.disabled = on;
        go.classList.toggle('is-busy', on);
        el.querySelector('.pcf__card').setAttribute('aria-busy', on ? 'true' : 'false');
        if (on) { lbl.textContent = BUSY_LABEL; err.hidden = true; err.textContent = ''; }
      }
      function finish(ok) {
        if (!open || open.el !== el) return;
        open = null;
        clearTimeout(stall);
        document.removeEventListener('keydown', onKey, true);
        el.remove();
        if (!ok && prev && document.contains(prev)) try { prev.focus(); } catch (_) {}
        resolve(!!ok);
      }
      function failed(message) {
        setBusy(false);
        lbl.textContent = 'Try again';
        err.textContent = message || 'Secure checkout couldn’t be opened. Nothing was charged — please try again.';
        err.hidden = false;
        try { go.focus(); } catch (_) {}
      }
      function proceed() {
        if (busy) return; // one request at a time
        if (!onContinue) { finish(true); return; }
        setBusy(true);
        var r;
        try { r = Promise.resolve(onContinue()); } catch (e) { r = Promise.reject(e); }
        r.then(function (res) {
          if (!open || open.el !== el) return;
          if (res && res.ok) {
            // The browser is on its way to Stripe; keep the spinner. Should
            // that not happen (a blocked navigation), offer Stripe's own link.
            stall = setTimeout(function () {
              if (!open || open.el !== el || !res.url) return;
              fine.innerHTML = 'Stripe hasn’t opened yet. <a class="pcf__link" href="' + esc(res.url) + '" rel="noopener">Open secure checkout</a>';
            }, STALL_MS);
            resolve(true);
            return;
          }
          if (res && res.busy) return; // a checkout from this page is already opening
          failed(res && res.message);
        }, function () { if (open && open.el === el) failed(); });
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); if (!busy) finish(false); }
        if (e.key === 'Tab') { // keep focus in the dialog
          var f2 = Array.prototype.filter.call(el.querySelectorAll('button, a[href]'), function (b) { return !b.disabled; });
          if (!f2.length) { e.preventDefault(); return; }
          var first = f2[0], last = f2[f2.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pcf]');
        if (!b) return;
        if (b.getAttribute('data-pcf') === 'go') proceed();
        else if (!busy) finish(false);
      });
      document.addEventListener('keydown', onKey, true);
      open = { el: el, finish: finish };
      setTimeout(function () { try { go.focus(); } catch (_) {} }, 20);
    });
  };

  // Back from Stripe with the browser's Back button: the page can come from
  // the back-forward cache with the dialog still "opening". Close it.
  window.addEventListener('pageshow', function (e) { if (e.persisted && open) open.finish(false); });
})();
