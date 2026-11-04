#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// Writes the FAQ from tools/seo/faq.js into index.html, in both places:
//   • the homepage FAQ (#faq in #view-landing): the core questions
//   • the /faq page (#view-faq): the core questions, then the page-only ones
// Each keeps its own markup and behaviour (details/summary on the
// homepage, the .ov-faq accordion on /faq). Run the prerender afterwards
// so home.html and faq.html follow (node tools/seo/prerender.js).
//
//   node tools/seo/faq-sync.js           write index.html
//   node tools/seo/faq-sync.js --check   exit 1 if index.html is out of sync
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const FAQ = require('./faq');

const INDEX = path.resolve(__dirname, '..', '..', 'index.html');
const CHECK = process.argv.includes('--check');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const landing = FAQ.core.map(([q, a]) => `
      <details><summary>${esc(q)}<i aria-hidden="true"></i></summary><div><p>${a}</p></div></details>`).join('') + '\n    ';
const page = FAQ.all.map(([q, a]) => `
        <div class="ov-faq ov-vis"><button class="ov-faq-q" onclick="ovFaq(this)"><span>${esc(q)}</span><span class="ov-faq-ic">+</span></button><div class="ov-faq-a">${a}</div></div>`).join('') + '\n      ';

function between(src, startMark, endMark, from, body, label) {
  const s = src.indexOf(startMark, from);
  if (s < 0) throw new Error(label + ': start marker not found');
  const b = s + startMark.length, e = src.indexOf(endMark, b);
  if (e < 0) throw new Error(label + ': end marker not found');
  return { out: src.slice(0, b) + body + src.slice(e), same: src.slice(b, e) === body };
}

const src = fs.readFileSync(INDEX, 'utf8');
const vl = src.indexOf('<div id="view-landing"'), vf = src.indexOf('<div id="view-faq"');
if (vl < 0 || vf < 0) throw new Error('views not found');
let r1 = between(src, '<div class="ik-qa" data-reveal="stagger">', '</div>\n  </div>\n</section>', vl, landing, 'homepage FAQ');
let r2 = between(r1.out, '<div class="ov-faq-list" style="width:100%;">', '</div>\n    </div>\n  </section>', r1.out.indexOf('<div id="view-faq"'), page, '/faq page');
if (CHECK) {
  if (!r1.same || !r2.same) { console.error('FAQ out of sync with tools/seo/faq.js: run node tools/seo/faq-sync.js'); process.exit(1); }
  console.log('FAQ in sync (' + FAQ.core.length + ' on the homepage, ' + FAQ.all.length + ' on /faq)');
} else {
  fs.writeFileSync(INDEX, r2.out);
  console.log('FAQ written: ' + FAQ.core.length + ' on the homepage, ' + FAQ.all.length + ' on /faq');
}
