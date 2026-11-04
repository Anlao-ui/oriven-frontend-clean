/* ════════════════════════════════════════════════════════════════
   "Scroll to top" in the shared footer (tools/seo/site-chrome.js,
   [data-scroll-top]). One delegated listener for every page. Scrolls the
   window and any scrolled container the button sits in (some views of the
   single-page site scroll inside their own container), smoothly unless the
   visitor prefers reduced motion, then moves keyboard focus to the top of
   the page (the navbar logo) without jumping.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.__siteTop) return;
  window.__siteTop = true;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function scrollTop(el) {
    var behavior = reduce.matches ? 'auto' : 'smooth';
    for (var n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (n.scrollTop > 0) { try { n.scrollTo({ top: 0, behavior: behavior }); } catch (_) { n.scrollTop = 0; } }
    }
    try { window.scrollTo({ top: 0, behavior: behavior }); } catch (_) { window.scrollTo(0, 0); }
    var target = document.querySelector('#lpNav .lp-logo') || document.querySelector('main, h1');
    if (target) {
      if (!target.hasAttribute('tabindex') && !/^(A|BUTTON)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (_) {}
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-scroll-top]');
    if (!b) return;
    e.preventDefault();
    scrollTop(b);
  });
})();
