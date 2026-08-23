const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const scanDirs = ['tools'];
const ignoredFiles = new Set([
  'tools/check-url-download-approval.js',
  'tools/url-download-permission.js'
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  return entries.flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return absolute;
  });
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function looksLikeNetworkFileDownload(source) {
  const hasNetworkRead = /\b(?:https?|node:https|node:http)\b[\s\S]{0,5000}\.(?:get|request)\s*\(/.test(source)
    || /\bfetch\s*\(/.test(source);
  const hasBinarySink = /fs\.(?:writeFileSync|createWriteStream)\s*\([^)]*(?:buffer|Buffer\.concat|chunk|response|res|arrayBuffer|blob|download)/i.test(source)
    || /fs\.promises\.writeFile\s*\([^)]*(?:buffer|Buffer\.concat|chunk|response|res|arrayBuffer|blob|download)/i.test(source)
    || /\bpipe\s*\(\s*fs\.createWriteStream/i.test(source);
  const imageOrDownloadContext = /image|thumbnail|high-?res|jpg|jpeg|png|gif|webp|tiff?|Special:FilePath|commons|download/i.test(source);
  return hasNetworkRead && hasBinarySink && imageOrDownloadContext;
}

const violations = [];
for (const dirName of scanDirs) {
  const dir = path.join(root, dirName);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (path.extname(file) !== '.js') continue;
    const rel = relative(file);
    if (ignoredFiles.has(rel)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (looksLikeNetworkFileDownload(source) && !source.includes('requireUrlFileDownloadApproval')) {
      violations.push(rel);
    }
  }
}

if (violations.length) {
  console.error('URL file download code must call tools/url-download-permission.js before saving files.');
  violations.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

console.log('URL file download approval guard check passed.');
