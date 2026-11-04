// ════════════════════════════════════════════════════════════════
// Shared public chrome: ONE footer and ONE bottom call-to-action for every
// public page (homepage, prerendered views in index.html, and the generated
// Learn/Blog pages). Styles: css/site-chrome.css. The animated dot field in
// the CTA is mounted by js/dot-field.js (the same engine as everywhere else).
//
// Used by: tools/seo/apply-product-depth.js (index.html views),
// tools/seo/build.js (generated pages), the homepage builder (#view-landing).
// ════════════════════════════════════════════════════════════════

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const COLS = [
  ['Product', [['/product', 'All six sections'], ['/business', 'Control Center'], ['/research', 'Research'], ['/create', 'Create'], ['/launch', 'Launch'], ['/campaigns', 'Campaigns'], ['/autopilot', 'Automations']]],
  ['Assistants', [['scout', 'Scout'], ['vector', 'Vector'], ['nova', 'Nova'], ['momentum', 'Momentum'], ['metric', 'Metric'], ['flux', 'Flux']].map(([k, n]) => ['/#agent-' + k, n, ` data-ik-goto="${k}"`])],
  ['Platforms', [['/product/google-ads', 'Google Ads'], ['/product/meta-ads', 'Meta Ads'], ['/product/tiktok-ads', 'TikTok Ads'], ['/product/pinterest-ads', 'Pinterest Ads'], ['/cross-platform-ad-management/', 'Cross-platform ads'], ['/ppc-automation-software/', 'PPC automation']]],
  ['Resources', [['/solutions', 'Solutions'], ['/learn/', 'Learn'], ['/blog', 'Blog'], ['/faq', 'FAQ'], ['/case-studies', 'Case Studies'], ['/pricing', 'Pricing']]],
  ['Company', [['/about', 'About'], ['mailto:contact@orivenai.com', 'Contact'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/cookie-policy', 'Cookie Policy'], ['/refund-policy', 'Refund Policy'], ['/security', 'Security'], ['#cookie-settings', 'Cookie settings', ' data-cookie-settings']]],
];

function footer() {
  return `<footer class="site-foot" data-site-footer>
  <div class="site-foot__in">
    <div class="site-foot__top">
      <div class="site-foot__brand">
        <a href="/" aria-label="OrivenAI home"><img src="/assets/orivenlogo-256.webp" width="48" height="48" alt="OrivenAI" loading="lazy"></a>
        <p>The connected AI marketing workspace: research, plan, create, launch and improve, in one place.</p>
      </div>
${COLS.map(([h, links]) => `      <nav class="site-foot__col" aria-label="${h}"><h2>${h}</h2>${links.map(([href, label, extra]) => `<a href="${href}"${extra || ''}>${label}</a>`).join('')}</nav>`).join('\n')}
    </div>
    <div class="site-foot__bottom">
      <span>&copy; 2026 Oriven &middot; KVK: 42039993 &middot; Netherlands &middot; All rights reserved.</span>
      <button type="button" class="site-foot__totop" data-scroll-top>Scroll to top <span aria-hidden="true">&uarr;</span></button>
    </div>
  </div>
</footer>`;
}

// The closing section of a page: heading, one line, a primary and an optional
// secondary action. Every destination must be an existing route.
// o = { eyebrow, title, text, primary: [href, label, extraAttrs], secondary: [href, label] }
function cta(o) {
  const p = o.primary || ['/signup', 'Get started'];
  return `<section class="site-cta" data-site-cta aria-label="${esc(o.label || 'Get started')}">
  <div class="site-cta__in">
    ${o.eyebrow ? `<p class="site-cta__eyebrow">${esc(o.eyebrow)}</p>` : ''}
    <h2 class="site-cta__h">${o.title}</h2>
    ${o.text ? `<p class="site-cta__p">${o.text}</p>` : ''}
    <div class="site-cta__actions">
      <a class="site-btn site-btn--primary" href="${p[0]}"${p[2] || ''}>${esc(p[1])} <span aria-hidden="true">&rarr;</span></a>
      ${o.secondary ? `<a class="site-btn site-btn--ghost" href="${o.secondary[0]}">${esc(o.secondary[1])}</a>` : ''}
    </div>
  </div>
</section>`;
}

module.exports = { footer, cta, esc };
