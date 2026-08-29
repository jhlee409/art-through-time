#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const imagesDir = path.join(root, 'data', 'images');
const analysisFile = path.join(root, 'data', 'generated', 'image-duplicate-analysis.json');
const planFile = path.join(root, 'data', 'generated', 'image-duplicate-cleanup-plan.json');
const apply = process.argv.includes('--apply');
const dataFiles = [
  path.join(root, 'data', 'artists.json'),
  path.join(root, 'data', 'art-movement-representatives.json'),
  path.join(root, 'data', 'artist-work-image-download-manifest.json'),
  path.join(root, 'data', 'further-artist-image-download-manifest.json'),
  path.join(root, 'data', 'movement-table-artist-image-download-manifest.json')
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function hasKorean(value) {
  return /[가-힣]/.test(String(value || ''));
}

function localPath(value) {
  const clean = String(value || '').replace(/[?#].*$/, '').replace(/\\/g, '/');
  return clean.startsWith('data/images/') ? clean : '';
}

function metadataByPath(artists, representatives) {
  const metadata = new Map();
  const folderFiles = new Map();
  const add = (value, title, directReference = true) => {
    const image = localPath(value);
    if (!image) return;
    const current = metadata.get(image) || {references: 0, koreanTitle: false, titles: new Set()};
    if (directReference) current.references += 1;
    const korean = title?.ko || '';
    const english = title?.en || '';
    current.koreanTitle ||= hasKorean(korean);
    if (korean || english) current.titles.add(korean || english);
    metadata.set(image, current);
  };
  for (const artist of artists.artists || []) {
    const folder = `data/images/${artist.id}/`;
    let files = folderFiles.get(artist.id);
    if (!files) {
      try { files = fs.readdirSync(path.join(imagesDir, artist.id)); } catch (_) { files = []; }
      folderFiles.set(artist.id, files);
    }
    for (const work of artist.works || []) {
      for (const value of [work.thumbnail, work.image, work.highResImage, work.highResOriginal, work.migration?.image?.localThumbnail, work.migration?.image?.highResolution]) {
        add(value, work.title);
      }
      const inferred = `${folder}${work.id}`.toLowerCase();
      for (const name of files) {
        const stem = name.replace(/\.(?:jpe?g|png|webp|gif)$/i, '').replace(/\.10mb$/i, '');
        if (`${folder}${stem}`.toLowerCase() === inferred) add(`${folder}${name}`, work.title, false);
      }
    }
  }
  const rows = [
    ...(representatives.categories || []).map(category => ({artist: category.artist, work: category.work})),
    ...(representatives.furtherArtists || []).flatMap(category => category.artists || [])
  ];
  for (const row of rows) {
    for (const value of [row.work?.localImage, row.work?.thumbnail, row.work?.image]) add(value, row.work?.title);
  }
  return metadata;
}

function chooseKeep(files, metadata) {
  return [...files].sort((left, right) => {
    if (right.bytes !== left.bytes) return right.bytes - left.bytes;
    const leftMeta = metadata.get(left.path) || {references: 0, koreanTitle: false};
    const rightMeta = metadata.get(right.path) || {references: 0, koreanTitle: false};
    if (rightMeta.koreanTitle !== leftMeta.koreanTitle) return Number(rightMeta.koreanTitle) - Number(leftMeta.koreanTitle);
    if (rightMeta.references !== leftMeta.references) return rightMeta.references - leftMeta.references;
    return left.path.localeCompare(right.path);
  })[0];
}

function safeImageFile(relative) {
  const clean = localPath(relative);
  if (!clean) throw new Error(`Unsafe image path: ${relative}`);
  const absolute = path.resolve(root, clean);
  const boundary = `${path.resolve(imagesDir)}${path.sep}`.toLowerCase();
  if (!absolute.toLowerCase().startsWith(boundary)) throw new Error(`Image path escaped data/images: ${relative}`);
  return absolute;
}

function replacePaths(value, replacements, stats) {
  if (typeof value === 'string') {
    const clean = value.replace(/\\/g, '/');
    const replacement = replacements.get(clean);
    if (replacement) {
      stats.references += 1;
      return replacement;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(item => replacePaths(item, replacements, stats));
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = replacePaths(value[key], replacements, stats);
  }
  return value;
}

function imageIndexFiles() {
  const files = [];
  for (const entry of fs.readdirSync(imagesDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const file = path.join(imagesDir, entry.name, 'index.json');
    if (fs.existsSync(file)) files.push(file);
  }
  return files;
}

function main() {
  const analysis = readJson(analysisFile);
  const artists = readJson(dataFiles[0]);
  const representatives = readJson(dataFiles[1]);
  const metadata = metadataByPath(artists, representatives);
  const groups = [];
  const replacements = new Map();
  for (const group of analysis.items || []) {
    const existing = group.files.filter(item => fs.existsSync(safeImageFile(item.path)));
    if (existing.length < 2) continue;
    const keep = chooseKeep(existing, metadata);
    const remove = existing.filter(item => item.path !== keep.path);
    for (const item of remove) replacements.set(item.path, keep.path);
    groups.push({
      keep: {...keep, metadata: metadata.get(keep.path) ? {...metadata.get(keep.path), titles: [...metadata.get(keep.path).titles]} : null},
      remove: remove.map(item => ({
        ...item,
        metadata: metadata.get(item.path) ? {...metadata.get(item.path), titles: [...metadata.get(item.path).titles]} : null
      }))
    });
  }
  const plan = {
    mode: apply ? 'apply' : 'check',
    groups: groups.length,
    deleteFiles: replacements.size,
    recoverableBytes: groups.reduce((sum, group) => sum + group.remove.reduce((total, item) => total + item.bytes, 0), 0),
    items: groups
  };
  writeJson(planFile, plan);
  if (!apply) {
    console.log(JSON.stringify({file: path.relative(root, planFile).replace(/\\/g, '/'), ...plan, items: undefined}, null, 2));
    return;
  }

  const stats = {references: 0, dataFiles: 0, indexFiles: 0, deleted: 0};
  for (const file of dataFiles) {
    const payload = readJson(file);
    const before = stats.references;
    replacePaths(payload, replacements, stats);
    if (stats.references > before) {
      writeJson(file, payload);
      stats.dataFiles += 1;
    }
  }
  for (const file of imageIndexFiles()) {
    const payload = readJson(file);
    const before = stats.references;
    replacePaths(payload, replacements, stats);
    if (stats.references > before) {
      writeJson(file, payload);
      stats.indexFiles += 1;
    }
  }
  for (const [remove] of replacements) {
    const file = safeImageFile(remove);
    if (!fs.existsSync(file)) continue;
    fs.unlinkSync(file);
    stats.deleted += 1;
  }
  console.log(JSON.stringify({
    file: path.relative(root, planFile).replace(/\\/g, '/'),
    groups: groups.length,
    deleteFiles: replacements.size,
    recoverableBytes: plan.recoverableBytes,
    ...stats
  }, null, 2));
}

main();
