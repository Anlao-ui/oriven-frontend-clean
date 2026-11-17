/* ════════════════════════════════════════════════════════════════
   End of the 2-week Flex plan: a short prompt to choose a regular plan.

   - 3 days or less before Flex access ends: "Your 2 weeks end in N days".
   - When it has ended (up to 30 days after): "Your 2 weeks have ended".
   Shown at most once a day per message (this browser), never in /demo.
   "See plans" opens the plan modal with the longer plans highlighted
   (window.ORV_PLANS_HIGHLIGHT_LONG, read by plans.js renderPWPricingCards):
   they cost the least per month. Reads the account's access from auth.js
   orvAccess(); nothing is sent anywhere.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.ORV_DEMO || window.orvFlexReminder) return;
  var DAY = 864e5, SOON_DAYS = 3, ENDED_DAYS = 30;

  function state(acc, now) {
    if (!acc || acc.plan !== 'flex' || !acc.expiresAt) return null;
    var end = new Date(acc.expiresAt).getTime();
    if (isNaN(end)) return null;
    var left = end - now;
    if (acc.active && left > 0 && left <= SOON_DAYS * DAY) return { kind: 'ending', end: end, days: Math.max(1, Math.round(left / DAY)) };
    if (!acc.active && left <= 0 && -left <= ENDED_DAYS * DAY) return { kind: 'ended', end: end };
    return null;
  }
  function seenKey(kind, now) { return 'orv_flex_prompt_' + kind + '_' + new Date(now).toISOString().slice(0, 10); }
  function seen(kind, now) { try { return !!localStorage.getItem(seenKey(kind, now)); } catch (_) { return false; } }
  function markSeen(kind, now) { try { localStorage.setItem(seenKey(kind, now), '1'); } catch (_) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function annualPerMonth() {
    var a = typeof orvPeriodPlan === 'function' ? orvPeriodPlan('annual') : null;
    return a && a.perMonth ? '€' + (Math.round(a.perMonth) === a.perMonth ? a.perMonth : a.perMonth.toFixed(2)) : null;
  }

  function close(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  function show(st, now) {
    if (document.querySelector('.orv-flex-prompt')) return;
    var pm = annualPerMonth();
    var when = st.kind === 'ended' ? '' : st.days <= 1 ? (new Date(st.end).toDateString() === new Date(now).toDateString() ? 'today' : 'tomorrow') : 'in ' + st.days + ' days';
    var title = st.kind === 'ended' ? 'Your 2 weeks have ended' : 'Your 2 weeks end ' + when;
    var body = st.kind === 'ended'
      ? 'Your campaigns, research and plan are saved. Choose a plan to keep going.'
      : 'Keep your campaigns, research and plan going with a regular plan.';
    body += ' Longer plans cost less per month' + (pm ? ': Annual works out at ' + pm + ' a month.' : '.');
    var el = document.createElement('div');
    el.className = 'orv-flex-prompt';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'orvFlexPromptT');
    el.setAttribute('data-kind', st.kind);
    el.innerHTML = '<p class="orv-flex-prompt__t" id="orvFlexPromptT">' + esc(title) + '</p>' +
      '<p class="orv-flex-prompt__d">' + esc(body) + '</p>' +
      (typeof window.ORIVEN_GUARANTEE_TEXT === 'string' ? '<p class="orv-flex-prompt__g">' + esc(window.ORIVEN_GUARANTEE_TEXT) + '</p>' : '') +
      '<div class="orv-flex-prompt__row"><button type="button" class="orv-flex-prompt__go" data-flex-plans>See plans</button>' +
      '<button type="button" class="orv-flex-prompt__later" data-flex-later>Later</button></div>';
    el.querySelector('[data-flex-plans]').addEventListener('click', function () {
      close(el);
      window.ORV_PLANS_HIGHLIGHT_LONG = true;
      if (typeof window.openPaywall === 'function') window.openPaywall();
      else window.location.href = '/pricing';
    });
    el.querySelector('[data-flex-later]').addEventListener('click', function () { close(el); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(el); });
    document.body.appendChild(el);
    markSeen(st.kind, now);
  }

  function check() {
    var acc = typeof window.orvAccess === 'function' ? window.orvAccess() : null;
    if (!acc) return false;
    var now = Date.now(), st = state(acc, now);
    if (st && !seen(st.kind, now)) {
      var pw = document.getElementById('modal-paywall');
      if (!(pw && pw.classList.contains('open'))) show(st, now);
    }
    return true;
  }
  // The access row arrives after sign-in: look for it for up to a minute.
  var tries = 0;
  function poll() { if (check() || ++tries > 60) return; setTimeout(poll, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(poll, 1500); });
  else setTimeout(poll, 1500);

  window.orvFlexReminder = { state: state, check: check };
})();
