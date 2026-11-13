/* ════════════════════════════════════════════════════════════════
   The six product tutorials (assets/films/tutorials/<key>.mp4, .jpg,
   .vtt, -thumb.webp): one per main section, each covering every page of
   it. Build-time data only: tools/tutorials-section.js writes them into
   the public homepage ("The real product, not a mock-up.", #inside).
   The tutorials are not shown inside the signed-in app.
   seconds: the real length of each file (tests/tutorials.test.js checks it).
   ════════════════════════════════════════════════════════════════ */
module.exports = [
  { key: 'control-center', n: '01', name: 'Control Center', seconds: 77, pages: ['Dashboard', 'Marketing Plan', 'Progress'] },
  { key: 'research', n: '02', name: 'Research', seconds: 81, pages: ['Research', 'Insights', 'Competitor Analysis'] },
  { key: 'create', n: '03', name: 'Create', seconds: 89, pages: ['Create', 'Creative Testing', 'My Content'] },
  { key: 'launch', n: '04', name: 'Launch', seconds: 50, pages: ['Audience Builder', 'Ad Studio'] },
  { key: 'campaigns', n: '05', name: 'Campaigns', seconds: 66, pages: ['Campaign Overview', 'Campaign Comparison', 'Campaign Builder'] },
  { key: 'automations', n: '06', name: 'Automations', seconds: 80, pages: ['Overview', 'Scheduler', 'Rules', 'Activity'] },
];
