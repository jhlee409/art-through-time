const fs = require('node:fs');
const path = require('node:path');

const directory = path.join(__dirname, '..', 'data', '미술사조');
const previous = 'nav .wrap{display:flex;align-items:center}nav .art-atlas-movement-sticky-title{display:block;color:inherit;font:inherit;font-weight:inherit;letter-spacing:inherit;line-height:inherit}';
const next = 'nav .wrap{display:flex;align-items:center;justify-content:center}nav .art-atlas-movement-sticky-title{display:block;width:100%;color:inherit;font-family:inherit;font-size:2em;font-weight:inherit;letter-spacing:inherit;line-height:inherit;text-align:center}';
let updated = 0;
for (const name of fs.readdirSync(directory)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(directory, name);
  const source = fs.readFileSync(file, 'utf8');
  const revised = source.replaceAll(previous, next);
  if (revised === source) continue;
  fs.writeFileSync(file, revised, 'utf8');
  updated++;
}
console.log(`Synchronized sticky-title presentation in ${updated} movement document(s).`);
