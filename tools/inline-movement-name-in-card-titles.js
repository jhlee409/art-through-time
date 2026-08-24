const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, '..', 'data', '미술사조');
const files = fs.readdirSync(directory).filter(name => name.endsWith('-1.html'));
let updatedCards = 0;
let removedLabels = 0;
let updatedFiles = 0;

function movementNameFromDocument(html, name) {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  const firstLine = heading.split(/<br\s*\/?>/i)[0]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const movement = firstLine.split(/\s*(?:—|:)\s*/)[0].trim();
  if (!movement) throw new Error(`사조명을 찾지 못했습니다: ${name}`);
  return movement;
}

for (const name of files) {
  const file = path.join(directory, name);
  const html = fs.readFileSync(file, 'utf8');
  if (!/<div class="(?:movement-work-body|caption)">/i.test(html)) continue;
  const movement = movementNameFromDocument(html, name);
  const tag = `<span class="movement-card-title-tag"> · ${movement}</span>`;
  let updated = html.replace(/(<div class="(?:movement-work-body|caption)">)\s*<span class="mini-label">[\s\S]*?<\/span>/gi, (_, body) => {
    removedLabels += 1;
    return body;
  });
  updated = updated.replace(/(<div class="(?:movement-work-body|caption)">\s*<h3>)([\s\S]*?)(<\/h3>)/gi, (_, open, title, close) => {
    if (title.includes('movement-card-title-tag')) return `${open}${title}${close}`;
    updatedCards += 1;
    return `${open}${title}${tag}${close}`;
  });
  if (!updated.includes('.movement-card-title-tag{')) {
    updated = updated.replace(
      /(<style>[\s\S]*?\.movement-enhancement \.work-meta\{[^}]*\})/,
      `$1\n.movement-enhancement .movement-card-title-tag{color:#9aa5af;font-size:.78em;font-weight:600;white-space:nowrap}`
    );
  }
  if (updated !== html) {
    fs.writeFileSync(file, updated, 'utf8');
    updatedFiles += 1;
  }
}

console.log(`Updated ${updatedCards} image-card titles and removed ${removedLabels} labels in ${updatedFiles} movement document(s).`);
