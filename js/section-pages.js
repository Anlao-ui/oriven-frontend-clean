/* ════════════════════════════════════════════════════════════════
   "Inside <section>" (the six product pages) and the Solutions cards:
   markup from tools/seo/product-pages.js, styles in css/site-chrome.css.
   • Each page card enters when it scrolls into view and resets once it is
     fully out of view, so it plays again on the way back (mirrored when it
     comes back from above). Opacity and transform only: no layout shift.
   • The page list marks the page being read (aria-current) and its links
     scroll to that page and move focus to it. Plain links: no scroll-jacking.
   • Without IntersectionObserver or under prefers-reduced-motion,
     everything is simply visible. No network requests.
   ════════════════════════════════════════════════════════════════ */
(function () {
  var roots = document.querySelectorAll('[data-pp]');
  if (!roots.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motion = !reduce && 'IntersectionObserver' in window;

  Array.prototype.forEach.call(roots, function (root) {
    var pages = Array.prototype.slice.call(root.querySelectorAll('[data-pp-page]'));
    var links = Array.prototype.slice.call(root.querySelectorAll('[data-pp-link]'));

    if (motion) {
      root.classList.add('pp-js');
      var inIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('is-in'); });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
      var outIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) return;
          var top = e.rootBounds ? e.rootBounds.top : 0;
          e.target.classList.remove('is-in');
          e.target.classList.toggle('pp-above', e.boundingClientRect.bottom <= top + 1);
        });
      }, { threshold: 0 });
      pages.forEach(function (p) { inIO.observe(p); outIO.observe(p); });
    }

    if (!links.length) return;
    var list = links[0].closest('ol');
    var current = -1;
    function setActive(i) {
      if (i === current) return; current = i;
      links.forEach(function (a, j) { a.classList.toggle('is-active', j === i); if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      // keep the active page name in view in the horizontal list (small screens)
      if (list && list.scrollWidth > list.clientWidth && links[i]) {
        var li = links[i].parentNode; list.scrollLeft = li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2;
      }
    }
    var queued = false;
    function sync() {
      queued = false;
      var line = (window.innerHeight || 800) * 0.45, idx = 0;
      pages.forEach(function (p, j) { if (p.getBoundingClientRect().top < line) idx = j; });
      setActive(idx);
    }
    function onScroll() { if (!queued) { queued = true; requestAnimationFrame(sync); } }
    // Public pages scroll either the document or their view container: listen to both.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    sync();

    links.forEach(function (a, j) {
      a.addEventListener('click', function (e) {
        var target = pages[j];
        if (!target || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
        setActive(j);
      });
    });
  });
})();
