#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {
  cleanLocalImagePath,
  existingLocalPath,
  existingLocalPathForWork,
  resolveExistingLocalImagePath
} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const imagesDir = path.join(root, 'data', 'images');
const manifestFiles = [
  path.join(root, 'data', 'artist-work-image-download-manifest.json'),
  path.join(root, 'data', 'further-artist-image-download-manifest.json'),
  path.join(root, 'data', 'movement-table-artist-image-download-manifest.json')
];

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function setNestedImage(record, keys, value) {
  let node = record;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    node[key] = node[key] && typeof node[key] === 'object' ? node[key] : {};
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
}

function getNestedImage(record, keys) {
  return keys.reduce((node, key) => node?.[key], record);
}

function repairImageField(record, keys, changes, context) {
  const current = getNestedImage(record, keys);
  const clean = cleanLocalImagePath(current);
  if (!clean || existingLocalPath(clean)) return '';
  const resolved = resolveExistingLocalImagePath(clean);
  if (!resolved) return '';
  setNestedImage(record, keys, resolved);
  changes.push({...context, field: keys.join('.'), from: clean, to: resolved});
  return resolved;
}

function clearMissingImageField(record, keys, changes, context) {
  const current = getNestedImage(record, keys);
  const clean = cleanLocalImagePath(current);
  if (!clean || !clean.startsWith('data/images/') || existingLocalPath(clean) || resolveExistingLocalImagePath(clean)) return false;
  setNestedImage(record, keys, '');
  changes.push({...context, field: keys.join('.'), from: clean, to: ''});
  return true;
}

function markWorkReady(work, localPath) {
  if (!localPath) return;
  if (!existingLocalPath(work.thumbnail)) work.thumbnail = localPath;
  if (!existingLocalPath(work.highResImage)) work.highResImage = localPath;
  if (!existingLocalPath(work.highResOriginal)) work.highResOriginal = localPath;
  work.imageUploadStatus = 'ready';
  work.thumbnailValidation = 2;
  work.thumbnailCacheKey = work.thumbnailCacheKey || new Date().toISOString();
  work.migration = work.migration && typeof work.migration === 'object' ? work.migration : {schema: 1};
  work.migration.image = work.migration.image && typeof work.migration.image === 'object' ? work.migration.image : {};
  if (!existingLocalPath(work.migration.image.localThumbnail)) work.migration.image.localThumbnail = localPath;
  if (!existingLocalPath(work.migration.image.highResolution)) work.migration.image.highResolution = localPath;
  work.migration.image.status = 'ready';
}

function markWorkPendingIfNoLocal(work) {
  if (existingLocalPathForWork(work)) return;
  work.imageUploadStatus = 'pending-upload';
  work.thumbnailValidation = 0;
  if (work.migration?.image) work.migration.image.status = 'pending-upload';
}

function repairArtistWorks(artistsPayload) {
  const changes = [];
  for (const artist of artistsPayload.artists || []) {
    for (const work of artist.works || []) {
      const context = {artistId: artist.id, workId: work.id, artist: artist.name?.ko || artist.name?.en || artist.id};
      const repaired = [
        repairImageField(work, ['thumbnail'], changes, context),
        repairImageField(work, ['image'], changes, context),
        repairImageField(work, ['highResImage'], changes, context),
        repairImageField(work, ['highResOriginal'], changes, context),
        repairImageField(work, ['migration', 'image', 'localThumbnail'], changes, context),
        repairImageField(work, ['migration', 'image', 'highResolution'], changes, context)
      ].find(Boolean);
      const localPath = repaired || existingLocalPathForWork(work, artist.id);
      if (localPath) markWorkReady(work, localPath);
      else {
        const cleared = [
          clearMissingImageField(work, ['thumbnail'], changes, context),
          clearMissingImageField(work, ['image'], changes, context),
          clearMissingImageField(work, ['highResImage'], changes, context),
          clearMissingImageField(work, ['highResOriginal'], changes, context),
          clearMissingImageField(work, ['migration', 'image', 'localThumbnail'], changes, context),
          clearMissingImageField(work, ['migration', 'image', 'highResolution'], changes, context)
        ].some(Boolean);
        if (cleared) markWorkPendingIfNoLocal(work);
      }
    }
  }
  return changes;
}

function representativeRows(representatives) {
  return [
    ...(representatives.categories || []).map(category => ({categoryId: category.categoryId, artist: category.artist, work: category.work})),
    ...(representatives.furtherArtists || []).flatMap(category => (category.artists || []).map(item => ({categoryId: category.categoryId, artist: item.artist, work: item.work})))
  ].filter(row => row.artist && row.work);
}

function repairRepresentativeWorks(representatives, artistsByWork) {
  const changes = [];
  for (const row of representativeRows(representatives)) {
    const context = {artistId: row.artist.id, workId: row.work.id, artist: row.artist.name?.ko || row.artist.name?.en || row.artist.id, categoryId: row.categoryId};
    const repaired = [
      repairImageField(row.work, ['localImage'], changes, context),
      repairImageField(row.work, ['thumbnail'], changes, context),
      repairImageField(row.work, ['image'], changes, context)
    ].find(Boolean);
    const artistWork = artistsByWork.get(`${row.artist.id}|${row.work.id}`);
    const localPath = repaired || existingLocalPathForWork(row.work, row.artist.id) || existingLocalPathForWork(artistWork, row.artist.id);
    if (localPath && !existingLocalPath(row.work.localImage)) {
      const previous = row.work.localImage || '';
      row.work.localImage = localPath;
      changes.push({...context, field: 'localImage', from: previous, to: localPath});
    } else if (!localPath) {
      clearMissingImageField(row.work, ['localImage'], changes, context);
    }
  }
  return changes;
}

function repairManifest(file, artistsByWork, representativesByWork) {
  const manifest = readJson(file);
  if (!manifest?.items) return {changed: false, changes: []};
  const changes = [];
  for (const item of manifest.items) {
    const key = `${item.artistId}|${item.workId}`;
    const localPath = resolveExistingLocalImagePath(item.targetPath)
      || existingLocalPathForWork(artistsByWork.get(key), item.artistId)
      || existingLocalPathForWork(representativesByWork.get(key), item.artistId);
    if (!localPath) continue;
    if (item.targetPath !== localPath) {
      changes.push({artistId: item.artistId, workId: item.workId, field: 'targetPath', from: item.targetPath, to: localPath});
      item.targetPath = localPath;
    }
    if (['candidate', 'failed', 'unresolved'].includes(item.reviewStatus)) {
      const previousStatus = item.reviewStatus;
      item.reviewStatus = 'downloaded';
      item.downloadedAt = item.downloadedAt || new Date().toISOString();
      item.bytes = fs.statSync(path.join(root, localPath)).size;
      changes.push({artistId: item.artistId, workId: item.workId, field: 'reviewStatus', from: previousStatus, to: 'downloaded'});
    }
  }
  if (changes.length) {
    manifest.counts = {
      ...manifest.counts,
      pending: manifest.items.length,
      downloaded: manifest.items.filter(item => item.reviewStatus === 'downloaded').length,
      candidates: manifest.items.filter(item => item.reviewStatus === 'candidate').length,
      unresolved: manifest.items.filter(item => item.reviewStatus === 'unresolved').length,
      failed: manifest.items.filter(item => item.reviewStatus === 'failed').length
    };
    writeJson(file, manifest);
  }
  return {changed: changes.length > 0, changes};
}

function repairThumbnailIndexes() {
  const changes = [];
  const errors = [];
  let folders = [];
  try {
    folders = fs.readdirSync(imagesDir, {withFileTypes: true}).filter(entry => entry.isDirectory());
  } catch (error) {
    return {changes, errors: [{file: 'data/images', error: error.message}]};
  }
  for (const folder of folders) {
    const file = path.join(imagesDir, folder.name, 'index.json');
    if (!fs.existsSync(file)) continue;
    let index;
    try {
      index = readJson(file, {});
      let changed = false;
      for (const [workId, item] of Object.entries(index || {})) {
        if (!item || typeof item !== 'object') continue;
        const current = String(item.thumbnail || '').replace(/\\/g, '/');
        const normalized = current.replace(/^data\/thumbnails\//, 'data/images/');
        if (!normalized || normalized === current) continue;
        item.thumbnail = normalized;
        changes.push({artistId: folder.name, workId, field: 'thumbnail', from: current, to: normalized});
        changed = true;
      }
      if (changed) writeJson(file, index);
    } catch (error) {
      errors.push({file: path.relative(root, file).replace(/\\/g, '/'), error: error.message});
    }
  }
  return {changes, errors};
}

function main() {
  const artistsPayload = readJson(artistsFile, {artists: []});
  const representatives = readJson(representativesFile, {categories: [], furtherArtists: []});
  const artistChanges = repairArtistWorks(artistsPayload);
  const artistsByWork = new Map((artistsPayload.artists || []).flatMap(artist => (artist.works || []).map(work => [`${artist.id}|${work.id}`, work])));
  const repChanges = repairRepresentativeWorks(representatives, artistsByWork);
  const representativesByWork = new Map(representativeRows(representatives).map(row => [`${row.artist.id}|${row.work.id}`, row.work]));
  const manifestChanges = manifestFiles.map(file => ({file, ...repairManifest(file, artistsByWork, representativesByWork)}));
  const thumbnailIndexes = repairThumbnailIndexes();

  if (artistChanges.length) writeJson(artistsFile, artistsPayload);
  if (repChanges.length) writeJson(representativesFile, representatives);

  console.log(JSON.stringify({
    artists: artistChanges.length,
    representatives: repChanges.length,
    thumbnailIndexes: thumbnailIndexes.changes.length,
    thumbnailIndexErrors: thumbnailIndexes.errors,
    manifests: manifestChanges.map(item => ({
      file: path.relative(root, item.file).replace(/\\/g, '/'),
      changes: item.changes.length
    }))
  }, null, 2));
}

main();
