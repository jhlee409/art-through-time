const fs = require('node:fs');
const path = require('node:path');

const directory = path.join(__dirname, '..', 'data', '미술사조');
const previous = 'font-size:1.14rem;font-weight:500;line-height:1.55';
const next = 'font-size:.912rem;font-weight:500;line-height:1.55';
let updated = 0;
for (const name of fs.readdirSync(directory)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(directory, name);
  const source = fs.readFileSync(file, 'utf8');
  const revised = source
    .replaceAll(previous, next)
    .replace(/(<span class="movement-country-card-context-region">)\s*<b>지역<\/b>\s*/g, '$1');
  if (revised === source) continue;
  fs.writeFileSync(file, revised, 'utf8');
  updated++;
}
console.log(`Synchronized country-context presentation in ${updated} movement document(s).`);
