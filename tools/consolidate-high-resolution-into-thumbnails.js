#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const highResolutionDir = path.join(root, 'data', 'high-resolution');
const thumbnailsDir = path.join(root, 'data', 'images');
const artistsFile = path.join(root, 'data', 'artists.json');
const artistIndexFile = path.join(root, 'data', 'artists-index.json');
const migrationAssetsFile = path.join(root, 'data', 'migration-assets.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walk(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, result);
    else if (/\.(?:jpe?g|png|webp|gif)$/i.test(entry.name)) result.push(absolute);
  }
  return result;
}

function highResolutionReference(value) {
  return /^data\/high-resolution\//.test(String(value || '').replace(/\\/g, '/'));
}

function normalizeExtension(extension) {
  return extension.toLowerCase() === '.jpeg' ? '.jpg' : extension.toLowerCase();
}

function inferredWorkId(file) {
  const base = path.basename(file, path.extname(file));
  if (base.includes('_')) return base.split('_')[0];
  if (/-highres$/i.test(base)) return '';
  return base;
}

function buildReferenceMap(artists) {
  const map = new Map();
  for (const artist of artists) {
    for (const work of artist.works || []) {
      const fields = [
        work.image,
        work.thumbnail,
        work.highResImage,
        work.highResOriginal,
        work.migration?.image?.localThumbnail,
        work.migration?.image?.highResolution
      ];
      for (const value of fields) {
        const key = String(value || '').replace(/\\/g, '/');
        if (key) map.set(key, {artist, work});
      }
    }
  }
  return map;
}

function thumbnailIndexFile(artistId) {
  return path.join(thumbnailsDir, artistId, 'index.json');
}

function updateThumbnailIndex(artistId, workId, thumbnail) {
  const file = thumbnailIndexFile(artistId);
  const index = fs.existsSync(file) ? readJson(file) : {};
  index[workId] = {
    ...(index[workId] || {}),
    thumbnail,
    checkedAt: new Date().toISOString(),
    verifiedBy: 'high-resolution consolidation'
  };
  writeJson(file, index);
}

function setWorkImage(work, targetPath) {
  work.image = targetPath;
  work.thumbnail = targetPath;
  work.highResImage = targetPath;
  work.highResOriginal = targetPath;
  if (work.imageUploadStatus === 'pending-upload') work.imageUploadStatus = 'ready';
  work.thumbnailValidation = 2;
  work.thumbnailCacheKey = new Date().toISOString();
  work.migration = {
    ...(work.migration || {}),
    schema: 1,
    image: {
      ...(work.migration?.image || {}),
      status: 'ready',
      localThumbnail: targetPath,
      highResolution: targetPath
    }
  };
}

function removeHighResolutionFields(work) {
  for (const key of ['image', 'thumbnail', 'highResImage', 'highResOriginal']) {
    if (!highResolutionReference(work[key])) continue;
    const candidates = [work.thumbnail, work.image, work.migration?.image?.localThumbnail]
      .filter(value => value && !highResolutionReference(value));
    const existing = candidates.find(value => fs.existsSync(path.join(root, value)));
    if (existing) work[key] = existing;
    else delete work[key];
  }
  if (work.migration?.image) {
    for (const key of ['localThumbnail', 'highResolution']) {
      if (!highResolutionReference(work.migration.image[key])) continue;
      const candidates = [work.thumbnail, work.image].filter(Boolean);
      const existing = candidates.find(value => !highResolutionReference(value) && fs.existsSync(path.join(root, value)));
      work.migration.image[key] = existing || '';
    }
    work.migration.image.status = work.thumbnail ? 'ready' : 'missing';
  }
}

function main() {
  const artistsPayload = readJson(artistsFile);
  const referenceMap = buildReferenceMap(artistsPayload.artists || []);
  const moved = [];
  const skipped = [];

  for (const source of walk(highResolutionDir)) {
    const oldPath = relative(source);
    const artistId = path.relative(highResolutionDir, path.dirname(source)).split(path.sep)[0];
    const referenced = referenceMap.get(oldPath);
    const workId = referenced?.work?.id || inferredWorkId(source);
    if (!artistId || !workId) {
      skipped.push({source: oldPath, reason: 'cannot infer artistId or workId'});
      continue;
    }
    const extension = normalizeExtension(path.extname(source));
    const target = path.join(thumbnailsDir, artistId, `${workId}${extension}`);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, fs.readFileSync(source));
    const targetPath = relative(target);
    const artist = referenced?.artist || (artistsPayload.artists || []).find(item => item.id === artistId);
    const work = referenced?.work || (artist?.works || []).find(item => item.id === workId);
    if (work) {
      setWorkImage(work, targetPath);
      updateThumbnailIndex(artistId, work.id, targetPath);
    }
    moved.push({source: oldPath, target: targetPath, artistId, workId, updatedWork: Boolean(work)});
  }

  for (const artist of artistsPayload.artists || []) {
    for (const work of artist.works || []) removeHighResolutionFields(work);
  }

  writeJson(artistsFile, artistsPayload);

  if (fs.existsSync(artistIndexFile)) {
    const indexPayload = readJson(artistIndexFile);
    indexPayload.artists = (artistsPayload.artists || []).map(({works, ...artist}) => ({
      ...artist,
      workCount: Array.isArray(works) ? works.length : 0,
      _detailLoaded: false
    }));
    writeJson(artistIndexFile, indexPayload);
  }

  let removedMigrationAssets = 0;
  if (fs.existsSync(migrationAssetsFile)) {
    const migrationAssets = readJson(migrationAssetsFile);
    if (Array.isArray(migrationAssets.assets)) {
      const before = migrationAssets.assets.length;
      migrationAssets.assets = migrationAssets.assets.filter(asset => !highResolutionReference(asset.path));
      removedMigrationAssets = before - migrationAssets.assets.length;
      writeJson(migrationAssetsFile, migrationAssets);
    }
  }

  console.log(JSON.stringify({moved:moved.length, skipped, removedMigrationAssets, movedSamples:moved.slice(0, 20)}, null, 2));
}

main();
