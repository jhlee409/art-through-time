const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');
const checkOnly = process.argv.includes('--check');

function normalizeHtml(source) {
  let changed = 0;
  const updated = source.replace(
    /(<div class="movement-work-body">\s*)<span class="mini-label"[^>]*>([\s\S]*?)<\/span>\s*<h3>([\s\S]*?)<\/h3>/g,
    (match, beforeBody, labelHtml, h3Html) => {
      const label = labelHtml.trim();
      const title = h3Html.trim();
      if (!label || !title.startsWith('《')) return match;
      changed++;
      return `${beforeBody}<h3>${label}, ${title}</h3>`;
    }
  );
  return {updated, changed};
}

const files = fs.readdirSync(movementDir)
  .filter(name => name.endsWith('.html'))
  .map(name => path.join(movementDir, name));

const changedFiles = [];
let changedCount = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const {updated, changed} = normalizeHtml(source);
  if (!changed) continue;
  changedFiles.push(path.relative(root, file).replace(/\\/g, '/'));
  changedCount += changed;
  if (!checkOnly) fs.writeFileSync(file, updated, 'utf8');
}

if (checkOnly && changedCount) {
  console.error(`Standalone movement-card artist label(s) remain before title-only headings: ${changedCount}`);
  changedFiles.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

console.log(`${checkOnly ? 'Checked' : 'Normalized'} ${changedCount} movement-card title line(s) in ${changedFiles.length} file(s).`);
