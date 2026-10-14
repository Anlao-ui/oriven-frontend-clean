/* ════════════════════════════════════════════════════════════════
   OrivenAI — main navbar behaviour for the static pages (/learn/, /blog/…,
   solution pages). Same behaviour as the navbar scripts in index.html:
   desktop dropdowns open on hover (with a short close delay) or click, the
   hamburger opens the full-screen mobile menu, and its sections are
   accordions. The markup is copied from index.html by tools/seo/build.js.
   ════════════════════════════════════════════════════════════════ */
(function () {
  var OPEN = 'lp-dd-open', DELAY = 180;
  var items = Array.prototype.slice.call(document.querySelectorAll('.lp-has-dd'));
  var wide = function () { return window.innerWidth > 768; };

  function setOpen(el, open) {
    clearTimeout(el._ddTimer);
    el.classList.toggle(OPEN, open);
    var t = el.querySelector('.lp-dd-trig');
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll(except) { items.forEach(function (el) { if (el !== except) setOpen(el, false); }); }
  function later(el) { clearTimeout(el._ddTimer); el._ddTimer = setTimeout(function () { setOpen(el, false); }, DELAY); }

  items.forEach(function (el) {
    var dd = el.querySelector('.lp-dropdown');
    el.addEventListener('mouseenter', function () { if (wide()) { closeAll(el); setOpen(el, true); } });
    el.addEventListener('mouseleave', function () { if (wide()) later(el); });
    if (dd) {
      dd.addEventListener('mouseenter', function () { if (wide()) clearTimeout(el._ddTimer); });
      dd.addEventListener('mouseleave', function () { if (wide()) later(el); });
    }
    var trig = el.querySelector('.lp-dd-trig');
    if (trig) trig.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !el.classList.contains(OPEN);
      closeAll(el); setOpen(el, open);
    });
  });
  document.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('.lp-has-dd'))) closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAll();
    if (window.closeMobile) window.closeMobile();
  });

  // Mobile menu
  var ham = document.getElementById('lpHamburger');
  var menu = document.getElementById('lpMobileMenu');
  var mmClose = document.getElementById('lpMmClose');
  var mmScroll = document.getElementById('lpMmScroll');
  window.closeMobile = function () {
    if (!menu || !ham) return;
    menu.classList.remove('open'); ham.classList.remove('open');
    ham.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
  };
  if (ham && menu) {
    ham.setAttribute('aria-expanded', 'false');
    ham.setAttribute('aria-controls', 'lpMobileMenu');
    ham.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      ham.classList.toggle('open', open);
      ham.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (open && mmScroll) mmScroll.scrollTop = 0;
    });
  }
  if (mmClose) mmClose.addEventListener('click', function () { window.closeMobile(); });

  // Called from the markup's onclick attributes (same names as index.html).
  window.lpMmToggle = function (btn) {
    var item = btn.closest('.lp-mm-item');
    if (!item) return;
    var wasOpen = item.classList.contains('lp-mm-open');
    document.querySelectorAll('.lp-mm-item.lp-mm-open').forEach(function (i) {
      i.classList.remove('lp-mm-open');
      var t = i.querySelector('.lp-mm-dd-trig');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) { item.classList.add('lp-mm-open'); btn.setAttribute('aria-expanded', 'true'); }
  };
  window.lpCloseMm = function () { window.closeMobile(); };
})();
