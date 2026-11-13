/* ════════════════════════════════════════════════════════════════
   The six tutorials on the public homepage live in "The real product, not
   a mock-up." (#inside): one tab per section, each tab's poster and Play
   button opening that section's tutorial in the shared player
   (js/ow-ui.js: subtitles in the picture, Esc closes and stops it). This script writes
   the films, captions, thumbnails and labels of those six tabs from the
   ONE tutorial list in js/tutorial-library.js (also used by the in-app
   Dashboard), so the two can't drift apart. It also removes the old
   standalone "Learn OrivenAI" section if it is still there.
   RUN: node tools/tutorials-section.js   (then the SEO pipeline: prerender)
   CHECK: node tools/tutorials-section.js --check
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const lib = fs.readFileSync(path.join(ROOT, 'js/tutorial-library.js'), 'utf8');
const LIST = vm.runInNewContext(lib.slice(lib.indexOf('var LIST = ['), lib.indexOf('];', lib.indexOf('var LIST = [')) + 2) + ' LIST');
const B = '/assets/films/tutorials/';
// #inside tab ids (unchanged; landing.js and the tabs use them) → tutorial key.
const SHOT = { business: 'control-center', research: 'research', create: 'create', launch: 'launch', campaigns: 'campaigns', autopilot: 'automations' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dur = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
const spoken = (s) => { const m = Math.floor(s / 60), r = Math.round(s % 60); return (m ? m + ' min ' : '') + (r ? r + ' s' : ''); };
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';

const shotHtml = (id, t, active) => `<div class="ik-shot${active ? ' is-active' : ''}" id="shot-${id}" data-tutorial="${t.key}" role="tabpanel" aria-labelledby="ik-shot-tab-${id}">
          <div class="ik-shot__media">
            <img src="${B}${t.key}-thumb.webp" width="960" height="540" alt="${esc(t.name + ' tutorial: ' + t.pages.join(', ') + ', recorded in the real OrivenAI app with a sample business')}" loading="lazy" decoding="async">
            <button type="button" class="ik-play" data-ik-play data-ow-video="${B}${t.key}.mp4" data-ow-poster="${B}${t.key}.jpg" data-ow-captions="${B}${t.key}.vtt" data-ow-title="${esc(t.name)} tutorial" aria-label="${esc('Play the ' + t.name + ' tutorial, ' + spoken(t.seconds) + ': ' + t.pages.join(', '))}">${PLAY}Watch tutorial <span class="ik-play__dur">${dur(t.seconds)}</span></button>
            <p class="ik-shot__pages" aria-hidden="true">${t.pages.map(esc).join(' · ')}</p>
          </div>
        </div>`;

let h = fs.readFileSync(INDEX, 'utf8');
const orig = h;
// 1. The old standalone section (between its markers) goes.
const S = h.indexOf('<!-- tutorials:start'), E = h.indexOf('<!-- tutorials:end -->');
if (S >= 0 && E > S) h = h.slice(0, S) + h.slice(E + '<!-- tutorials:end -->'.length).replace(/^\r?\n/, '');
// 2. The six #inside shots, rebuilt from the list (structure and ids kept).
for (const [id, key] of Object.entries(SHOT)) {
  const t = LIST.find((x) => x.key === key); if (!t) throw new Error('no tutorial ' + key);
  const a = h.indexOf('<div class="ik-shot'), start = h.indexOf('id="shot-' + id + '"');
  if (a < 0 || start < 0) throw new Error('#inside shot ' + id + ' not found');
  const s0 = h.lastIndexOf('<div class="ik-shot', start);
  // a shot ends after its media wrapper: "</div>\n        </div>"
  const mEnd = h.indexOf('</div>', h.indexOf('</button>', s0)); // closes .ik-shot__media (after the pages line)
  const pEnd = h.indexOf('</div>', h.indexOf('ik-shot__media', s0) > 0 ? h.indexOf('</div>', h.indexOf('<div class="ik-shot__media"', s0) + 30) + 6 : mEnd + 6);
  const active = /class="ik-shot is-active"/.test(h.slice(s0, s0 + 40));
  h = h.slice(0, s0) + shotHtml(id, t, active) + h.slice(pEnd + '</div>'.length);
}
// 3. The section's lead says what the tabs now hold.
h = h.replace(/(<p class="ik-lead">)Recorded in a sample workspace\. Pick a section to see it at work\.(<\/p>)/, '$1Pick a section and watch its tutorial: every page in it, recorded in the real app with a sample business.$2');

if (process.argv.includes('--check')) { if (h !== orig) { console.error('homepage tutorials out of date: run node tools/tutorials-section.js'); process.exit(1); } console.log('homepage tutorials up to date'); }
else { fs.writeFileSync(INDEX, h); console.log(h === orig ? 'Nothing changed' : 'homepage tutorials written into #inside (' + Object.keys(SHOT).length + ' tabs)'); }
