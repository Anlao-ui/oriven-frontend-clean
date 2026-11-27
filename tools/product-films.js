/* ════════════════════════════════════════════════════════════════
   The six product recordings on the public homepage ("The real product,
   not a mock-up.", #inside): one per section of the app, in the order of
   the app's sidebar (js/appNav.js SECTIONS). Each is a plain screen
   recording of the real app (/demo-app: the read-only sample workspace),
   scrolling through the section's pages. No captions, no voice, no
   generated imagery. Files: assets/films/product/<key>.mp4 and <key>.jpg
   (the first frame, used as the poster).
   names/pages: exactly as the app shows them (tests/product-films.test.js
   compares them with js/appNav.js). page: the public page about it.
   seconds: the real length of each file (the test checks it).
   ════════════════════════════════════════════════════════════════ */
module.exports = [
  { key: 'overview', n: '01', name: 'Overview', page: '/business', seconds: 15, pages: ['Dashboard', 'AI Plans & Tasks', 'Needs Attention'] },
  { key: 'campaigns', n: '02', name: 'Campaigns', page: '/launch', seconds: 14, pages: ['Campaign Studio', 'Ad Simulator'] },
  { key: 'creative-studio', n: '03', name: 'Creative Studio', page: '/create', seconds: 15, pages: ['Create Ads', 'My Creatives', 'Creative Testing'] },
  { key: 'analytics', n: '04', name: 'Analytics', page: '/campaigns', seconds: 15, pages: ['Performance Overview', 'Cross-platform Comparison', 'Ads vs Ads'] },
  { key: 'research', n: '05', name: 'Research', page: '/research', seconds: 15, pages: ['Audience Research', 'Competitive Research', 'Saved Research'] },
  { key: 'autopilot', n: '06', name: 'Autopilot', page: '/autopilot', seconds: 15, pages: ['Automation Overview', 'My Automations', 'Automation History'] },
];
