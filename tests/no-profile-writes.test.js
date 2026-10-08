// Static guard (no network, no Supabase): the browser must never write to
// public.profiles. The database denies it (oriven-backend
// docs/migrations/2026-10-profiles-lockdown.sql); every profile write goes
// through the backend. This fails if a direct insert/update/upsert/delete on
// profiles is added to any frontend file again.
// RUN: node tests/no-profile-writes.test.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const files = ['app.html', 'index.html'].concat(fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f));
let fail = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /\.from\(\s*["'`]profiles["'`]\s*\)([\s\S]{0,200})/g;
  let m;
  while ((m = re.exec(src))) {
    const chain = m[1].split(/;|\n\s*\n/)[0];
    if (/\.(insert|update|upsert|delete)\s*\(/.test(chain)) {
      const line = src.slice(0, m.index).split('\n').length;
      console.log('  FAIL — direct profiles write in ' + f + ':' + line);
      fail++;
    }
  }
}
const reads = files.reduce((n, f) => n + (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/\.from\(\s*["'`]profiles["'`]\s*\)/g) || []).length, 0);
console.log((fail ? '' : '  PASS — no direct writes to profiles in ' + files.length + ' frontend files (' + reads + ' read-only queries)'));
process.exit(fail ? 1 : 0);
