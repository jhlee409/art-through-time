const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');
const imageDir = path.join(movementDir, 'images');
const extensionByMime = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function htmlRelative(fromFile, toFile) {
  return path.relative(path.dirname(fromFile), toFile).replace(/\\/g, '/');
}

function safeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    || 'movement-inline-image';
}

function movementTitle(html) {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSlug(title, fileName) {
  const korean = title.split(/\s*[—-]\s*/)[0] || title;
  const ascii = safeName(korean);
  return ascii === 'movement-inline-image'
    ? path.basename(fileName, path.extname(fileName))
    : ascii;
}

function uniqueDestination(base, extension, content) {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  const first = path.join(imageDir, `${base}-${hash}.${extension}`);
  if (!fs.existsSync(first)) return first;
  if (fs.readFileSync(first).equals(content)) return first;
  for (let index = 2; index < 100; index++) {
    const candidate = path.join(imageDir, `${base}-${hash}-${index}.${extension}`);
    if (!fs.existsSync(candidate) || fs.readFileSync(candidate).equals(content)) return candidate;
  }
  throw new Error(`No unused destination for ${base}.${extension}`);
}

function extractFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const base = titleSlug(movementTitle(html), file);
  let imageIndex = 0;
  const replacements = [];
  const updated = html.replace(/src=(["'])(data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+))\1/gi, (match, quote, dataUri, mime, encoded) => {
    const extension = extensionByMime[mime.toLowerCase()];
    if (!extension) throw new Error(`Unsupported inline image type in ${relative(file)}: ${mime}`);
    imageIndex += 1;
    const buffer = Buffer.from(encoded.replace(/\s+/g, ''), 'base64');
    const destination = uniqueDestination(`${base}-${String(imageIndex).padStart(2, '0')}`, extension, buffer);
    fs.writeFileSync(destination, buffer);
    const src = htmlRelative(file, destination);
    replacements.push(src);
    return `src=${quote}${src}${quote}`;
  });
  if (updated !== html) fs.writeFileSync(file, updated, 'utf8');
  return replacements;
}

function main() {
  fs.mkdirSync(imageDir, {recursive: true});
  const changed = [];
  for (const name of fs.readdirSync(movementDir).filter(file => /\.html?$/i.test(file))) {
    const file = path.join(movementDir, name);
    const replacements = extractFile(file);
    if (replacements.length) changed.push({file: relative(file), images: replacements});
  }
  console.log(JSON.stringify({changedFiles: changed.length, images: changed.reduce((sum, item) => sum + item.images.length, 0), changed}, null, 2));
}

main();
