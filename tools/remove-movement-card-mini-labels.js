const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, '..', 'data', '미술사조');
const files = fs.readdirSync(directory).filter(name => name.endsWith('-1.html'));
let removed = 0;

for (const name of files) {
  const file = path.join(directory, name);
  const html = fs.readFileSync(file, 'utf8');
  const updated = html.replace(/(<div class="movement-work-body">)\s*<span class="mini-label">[\s\S]*?<\/span>/g, (_, body) => {
    removed += 1;
    return body;
  });
  if (updated !== html) fs.writeFileSync(file, updated, 'utf8');
}

console.log(`Removed ${removed} image-card labels from movement documents.`);
