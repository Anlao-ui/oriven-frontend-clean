/* ════════════════════════════════════════════════════════════════
   Writes the homepage section "The real product, not a mock-up." (#inside)
   from tools/product-films.js: one tab per section of the app, each
   showing that section's screen recording, muted and looping, inside the
   browser frame. js/landing.js plays the visible tab's recording while
   the section is on screen (never with reduced motion) and offers
   Pause/Play. Replaces the earlier tutorial tabs (tools/tutorials-section.js).
   RUN:   node tools/product-films-section.js   (then the SEO pipeline: prerender)
   CHECK: node tools/product-films-section.js --check
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const LIST = require('./product-films');
const B = '/assets/films/product/';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
const PAUSE = '<svg class="ik-film-ic ik-film-ic--pause" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/></svg>';
const PLAY = '<svg class="ik-film-ic ik-film-ic--play" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3v10l8-5z"/></svg>';

const shot = (t, i) => `        <div class="ik-shot${i === 0 ? ' is-active' : ''}" id="shot-${t.key}" role="tabpanel" aria-labelledby="ik-shot-tab-${t.key}">
          <div class="ik-shot__media">
            <video class="ik-film" muted loop playsinline preload="${i === 0 ? 'metadata' : 'none'}" poster="${B}${t.key}.jpg" width="1920" height="1080" aria-label="${esc('Screen recording of ' + t.name + ' in the OrivenAI app (sample workspace): ' + t.pages.join(', '))}"><source src="${B}${t.key}.mp4" type="video/mp4"></video>
          </div>
        </div>`;

const stage = `<!-- inside:start (written by tools/product-films-section.js from tools/product-films.js) -->
    <div class="ik-inside__stage" data-ik-inside data-reveal="scale">
      <div class="ik-frame">
        <div class="ik-frame__bar"><span class="ik-frame__path">orivenai.com/app · <b data-ik-shot-name>${esc(LIST[0].name)}</b></span><span class="ik-frame__right"><span class="ik-mono">Sample workspace</span><button type="button" class="ik-film-toggle" data-ik-film-toggle aria-pressed="false" aria-label="Pause the recording">${PAUSE}${PLAY}<span data-ik-film-label>Pause</span></button></span></div>
${LIST.map(shot).join('\n')}
      </div>
      <div class="ik-inside__bar">
        <div class="ik-tabs" role="tablist" aria-label="Product sections">${LIST.map((t, i) => `<button type="button" class="ik-tab" role="tab" id="ik-shot-tab-${t.key}" aria-controls="shot-${t.key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-shot="${t.key}"><span>${t.n}</span>${esc(t.name)}</button>`).join('')}</div>
        <p class="ik-shot__pagesline" aria-live="polite">${LIST.map((t, i) => `<span class="ik-shot__pg${i === 0 ? ' is-active' : ''}" data-pg="${t.key}">${t.pages.map(esc).join(' · ')}</span>`).join('')}</p>
        <div class="ik-caps">${LIST.map((t, i) => `<a class="ik-shot__cap ik-link${i === 0 ? ' is-active' : ''}" data-cap="${t.key}" href="${t.page}">Explore ${esc(t.name)} ${ARROW}</a>`).join('')}</div>
      </div>
    </div>
    <!-- inside:end -->`;

let h = fs.readFileSync(INDEX, 'utf8');
const orig = h;
const NL = h.includes('\r\n') ? '\r\n' : '\n';
const block = stage.replace(/\r?\n/g, NL);
const S = h.indexOf('<!-- inside:start'), E = h.indexOf('<!-- inside:end -->');
if (S >= 0 && E > S) h = h.slice(0, S) + block + h.slice(E + '<!-- inside:end -->'.length);
else {
  // First run: the earlier tutorial stage, from its opening div to the end of its tab bar.
  const a = h.indexOf('<div class="ik-inside__stage" data-ik-inside');
  const barAt = h.indexOf('<div class="ik-inside__bar">', a);
  const capsEnd = h.indexOf('</div>', h.indexOf('<div class="ik-caps">', barAt)) + 6; // .ik-caps
  const barEnd = h.indexOf('</div>', capsEnd) + 6; // .ik-inside__bar
  const stageEnd = h.indexOf('</div>', barEnd) + 6; // .ik-inside__stage
  if (a < 0 || barAt < 0) throw new Error('#inside stage not found');
  h = h.slice(0, a) + block + h.slice(stageEnd);
}
// The section's lead says what the tabs hold.
h = h.replace(/(<h2 class="ik-h2" id="ik-inside-title">The real product, not a mock-up\.<\/h2>\s*<p class="ik-lead">)[^<]*(<\/p>)/, '$1Six sections, recorded in the real app with a sample business. Pick one to see it.$2');

if (process.argv.includes('--check')) { if (h !== orig) { console.error('homepage product films out of date: run node tools/product-films-section.js'); process.exit(1); } console.log('homepage product films up to date'); }
else { fs.writeFileSync(INDEX, h); console.log(h === orig ? 'Nothing changed' : 'product films written into #inside (' + LIST.length + ' tabs)'); }
