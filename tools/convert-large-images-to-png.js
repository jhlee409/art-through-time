const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const limitBytes = Number(process.env.ART_ATLAS_IMAGE_LIMIT_BYTES || 10 * 1024 * 1024);
const ffmpegPath = process.env.ART_ATLAS_FFMPEG
  || (fsSync.existsSync('C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe') ? 'C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe'
    : (fsSync.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg'));
const imagePattern = /\.(?:jpe?g|png|webp|gif)$/i;
const textPattern = /\.(?:json|jsonl|js|html?|css|md)$/i;
const skipDirs = new Set(['.git', 'node_modules', 'backups']);

function insideRoot(file) {
  const relative = path.relative(root, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function relativePath(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

async function walk(folder, predicate, output = []) {
  const entries = await fs.readdir(folder, {withFileTypes: true}).catch(() => []);
  for (const entry of entries) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      await walk(file, predicate, output);
      continue;
    }
    if (entry.isFile() && predicate(file)) output.push(file);
  }
  return output;
}

async function largeImages() {
  const roots = ['high-resolution', 'thumbnails', 'topic-images', path.join('미술사조', 'images')]
    .map(folder => path.join(dataDir, folder))
    .filter(folder => fsSync.existsSync(folder));
  const files = [];
  for (const folder of roots) await walk(folder, file => imagePattern.test(file), files);
  const large = [];
  for (const file of files) {
    const stat = await fs.stat(file);
    if (stat.size > limitBytes) large.push({file, size: stat.size});
  }
  return large;
}

async function destinationFor(source) {
  const parsed = path.parse(source);
  let destination = path.join(parsed.dir, `${parsed.name}.png`);
  if (path.resolve(destination) === path.resolve(source)) destination = path.join(parsed.dir, `${parsed.name}.10mb.png`);
  if (fsSync.existsSync(destination) && fsSync.statSync(destination).size <= limitBytes) return destination;
  if (!fsSync.existsSync(destination)) return destination;
  for (let index = 1; index < 100; index++) {
    const candidate = path.join(parsed.dir, `${parsed.name}.${index}.png`);
    if (fsSync.existsSync(candidate) && fsSync.statSync(candidate).size <= limitBytes) return candidate;
    if (!fsSync.existsSync(candidate)) return candidate;
  }
  throw new Error(`No unused PNG destination for ${relativePath(source)}`);
}

function convertUnderLimit(source, destination) {
  const staging = fsSync.mkdtempSync(path.join(os.tmpdir(), 'art-atlas-image-'));
  const tmp = path.join(staging, 'display.png');
  const sizes = [2400, 2000, 1600, 1200, 1000, 800, 640, 480, 360];
  try {
    for (const size of sizes) {
      execFileSync(ffmpegPath, ['-y', '-i', source, '-vf', `scale=min(${size}\\,iw):-2`, '-frames:v', '1', '-update', '1', '-compression_level', '9', '-pred', 'mixed', tmp], {stdio: 'ignore', windowsHide: true});
      const stat = fsSync.statSync(tmp);
      if (stat.size <= limitBytes) {
        fsSync.copyFileSync(tmp, destination);
        return stat.size;
      }
    }
  } finally {
    fsSync.rmSync(staging, {recursive: true, force: true});
  }
  throw new Error(`Could not reduce ${relativePath(source)} below 10 MB as PNG`);
}

async function replaceReferences(changes) {
  const files = await walk(root, file => textPattern.test(file));
  let editedFiles = 0;
  for (const file of files) {
    let text = await fs.readFile(file, 'utf8');
    const before = text;
    for (const change of changes) {
      const oldForward = change.oldRel;
      const oldBackslash = oldForward.replace(/\//g, '\\');
      text = text.split(oldForward).join(change.newRel);
      text = text.split(oldBackslash).join(change.newRel);
    }
    if (text !== before) {
      await fs.writeFile(file, text, 'utf8');
      editedFiles++;
    }
  }
  return editedFiles;
}

async function refreshThumbnailHashes(changes) {
  if (!changes.length) return 0;
  const byNewRel = new Map(changes.map(change => [change.newRel, change.newFile]));
  const indexes = await walk(path.join(dataDir, 'thumbnails'), file => path.basename(file) === 'index.json');
  let updated = 0;
  for (const file of indexes) {
    const index = JSON.parse(await fs.readFile(file, 'utf8'));
    let changed = false;
    for (const entry of Object.values(index)) {
      const thumbnail = String(entry?.thumbnail || '').replace(/\\/g, '/');
      const imageFile = byNewRel.get(thumbnail);
      if (!imageFile) continue;
      entry.imageHash = createHash('sha256').update(await fs.readFile(imageFile)).digest('hex');
      changed = true;
    }
    if (changed) {
      await fs.writeFile(file, JSON.stringify(index, null, 2) + '\n', 'utf8');
      updated++;
    }
  }
  return updated;
}

async function repairMissingPngReferences() {
  const files = await walk(root, file => textPattern.test(file));
  const localImageReference = /data\/(?:high-resolution|thumbnails|topic-images|미술사조\/images)\/[^"'\s)]+?\.(?:jpe?g|webp)/g;
  let editedFiles = 0;
  let replacements = 0;
  for (const file of files) {
    let text = await fs.readFile(file, 'utf8').catch(() => null);
    if (text === null) continue;
    const before = text;
    text = text.replace(localImageReference, source => {
      const oldFile = path.join(root, source);
      const newReference = source.replace(/\.(?:jpe?g|webp)$/i, '.png');
      const newFile = path.join(root, newReference);
      if (fsSync.existsSync(oldFile) || !fsSync.existsSync(newFile)) return source;
      replacements++;
      return newReference;
    });
    if (text !== before) {
      await fs.writeFile(file, text, 'utf8');
      editedFiles++;
    }
  }
  return {editedFiles, replacements};
}

async function refreshAllThumbnailHashes() {
  const indexes = await walk(path.join(dataDir, 'thumbnails'), file => path.basename(file) === 'index.json');
  let updated = 0;
  for (const file of indexes) {
    const index = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => null);
    if (!index) continue;
    let changed = false;
    for (const entry of Object.values(index)) {
      const thumbnail = String(entry?.thumbnail || '').replace(/\\/g, '/');
      if (!thumbnail) continue;
      const imageFile = path.join(root, thumbnail);
      if (!fsSync.existsSync(imageFile)) continue;
      const buffer = await fs.readFile(imageFile).catch(() => null);
      if (!buffer) continue;
      const imageHash = createHash('sha256').update(buffer).digest('hex');
      if (entry.imageHash !== imageHash) {
        entry.imageHash = imageHash;
        changed = true;
      }
    }
    if (changed) {
      await fs.writeFile(file, JSON.stringify(index, null, 2) + '\n', 'utf8');
      updated++;
    }
  }
  return updated;
}

async function main() {
  if (!insideRoot(dataDir)) throw new Error(`Refusing to operate outside workspace: ${dataDir}`);
  const targets = await largeImages();
  const changes = [];
  for (const {file, size} of targets) {
    const destination = await destinationFor(file);
    if (!insideRoot(file) || !insideRoot(destination)) throw new Error(`Unsafe path: ${file} -> ${destination}`);
    const newSize = fsSync.existsSync(destination) && fsSync.statSync(destination).size <= limitBytes
      ? fsSync.statSync(destination).size
      : convertUnderLimit(file, destination);
    console.error(`converted ${relativePath(file)} -> ${relativePath(destination)} (${newSize} bytes)`);
    changes.push({oldFile: file, newFile: destination, oldRel: relativePath(file), newRel: relativePath(destination), oldSize: size, newSize});
  }
  const editedFiles = await replaceReferences(changes);
  const updatedIndexes = await refreshThumbnailHashes(changes);
  const repairedReferences = await repairMissingPngReferences();
  const refreshedIndexes = await refreshAllThumbnailHashes();
  for (const change of changes) {
    if (!insideRoot(change.oldFile)) throw new Error(`Refusing to delete outside workspace: ${change.oldFile}`);
    await fs.unlink(change.oldFile);
  }
  const remaining = await largeImages();
  console.log(JSON.stringify({converted: changes.map(change => ({
    from: change.oldRel,
    to: change.newRel,
    oldBytes: change.oldSize,
    newBytes: change.newSize
  })), editedFiles, updatedIndexes, repairedReferences, refreshedIndexes, remaining: remaining.map(item => ({file: relativePath(item.file), bytes: item.size}))}, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
