#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const imagesRoot = path.join(root, 'data', 'images');
const write = process.argv.includes('--write');
const artists = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists.json'), 'utf8')).artists || [];
const artistsById = new Map(artists.map(artist => [artist.id, artist]));

function localPath(value) {
  const normalized = String(value || '').trim().replace(/[?#].*$/, '').replace(/\\/g, '/');
  return normalized.startsWith('data/images/') && !normalized.startsWith('data/images/_placeholder/') ? normalized : '';
}

function imageValues(work) {
  return [...new Set([
    work?.thumbnail,
    work?.image,
    work?.highResImage,
    work?.highResOriginal,
    work?.migration?.image?.localThumbnail,
    work?.migration?.image?.highResolution
  ].map(localPath).filter(Boolean))];
}

const totals = {files:0, changedFiles:0, kept:0, removedMissingWorks:0, removedMissingImages:0, repairedPaths:0};

for (const folder of fs.readdirSync(imagesRoot, {withFileTypes:true})) {
  if (!folder.isDirectory() || folder.name === '_placeholder') continue;
  const indexFile = path.join(imagesRoot, folder.name, 'index.json');
  if (!fs.existsSync(indexFile)) continue;
  totals.files += 1;
  const current = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const artist = artistsById.get(folder.name);
  const worksById = new Map((artist?.works || []).map(work => [String(work.id), work]));
  const next = {};

  for (const [workId, item] of Object.entries(current || {})) {
    const work = worksById.get(workId);
    if (!work) {
      totals.removedMissingWorks += 1;
      continue;
    }
    const candidates = imageValues(work).filter(value => fs.existsSync(path.join(root, value)));
    if (!candidates.length) {
      totals.removedMissingImages += 1;
      continue;
    }
    const previous = localPath(item?.thumbnail);
    const thumbnail = candidates.includes(previous) ? previous : candidates[0];
    if (thumbnail !== previous) totals.repairedPaths += 1;
    totals.kept += 1;
    next[workId] = {...item, thumbnail};
  }

  if (JSON.stringify(current) === JSON.stringify(next)) continue;
  totals.changedFiles += 1;
  if (write) fs.writeFileSync(indexFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({ok:true, mode:write ? 'write' : 'check', ...totals}, null, 2));
