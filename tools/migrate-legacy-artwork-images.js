#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {canonicalArtworkPath} = require('./image-catalog');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const oldPrefix = 'data/미술사조/images/';
const artistsFile = path.join(root, 'data', 'artists.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const catalogFile = path.join(root, 'data', 'image-catalog.json');
const imagesRoot = path.join(root, 'data', 'images');
const movementRoot = path.join(root, 'data', '미술사조');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function imagePaths(work) {
  return [
    work?.localImage,
    work?.thumbnail,
    work?.image,
    work?.highResImage,
    work?.highResOriginal,
    work?.migration?.image?.localThumbnail,
    work?.migration?.image?.highResolution
  ].map(value => String(value || '').replace(/\\/g, '/'));
}

function replaceStrings(value, replacements) {
  if (typeof value === 'string') {
    let next = value;
    for (const [from, to] of replacements) next = next.replaceAll(from, to);
    return next;
  }
  if (Array.isArray(value)) return value.map(item => replaceStrings(item, replacements));
  if (!value || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) value[key] = replaceStrings(value[key], replacements);
  return value;
}

function absolute(localPath) {
  return path.join(root, localPath);
}

function main() {
  const artistsPayload = readJson(artistsFile);
  const representatives = readJson(representativesFile);
  const catalog = readJson(catalogFile);
  const catalogByHash = new Map();
  for (const image of catalog.images || []) {
    if (!image.sha256) continue;
    catalogByHash.set(image.sha256, [...(catalogByHash.get(image.sha256) || []), image]);
  }

  const linked = new Map();
  for (const artist of artistsPayload.artists || []) {
    for (const work of artist.works || []) {
      for (const localPath of imagePaths(work)) {
        if (!localPath.startsWith(oldPrefix)) continue;
        const entries = linked.get(localPath) || [];
        if (!entries.some(item => item.artist.id === artist.id && item.work.id === work.id)) entries.push({artist, work});
        linked.set(localPath, entries);
      }
    }
  }

  const replacements = new Map();
  const migrations = [];
  for (const [oldPath, references] of linked) {
    const oldFile = absolute(oldPath);
    if (!fs.existsSync(oldFile)) throw new Error(`Legacy artwork image is missing: ${oldPath}`);
    const hash = sha256(oldFile);
    const referenceKeys = new Set(references.map(({artist, work}) => `${artist.id}|${work.id}`));
    const matchingCatalog = catalogByHash.get(hash) || [];
    const existing = matchingCatalog.find(image => (image.works || []).some(work => referenceKeys.has(`${work.artistId}|${work.workId}`)))
      || matchingCatalog.find(image => references.some(({artist}) => image.path.startsWith(`data/images/${artist.id}/`)));
    const {artist, work} = references[0];
    const destination = existing?.path || canonicalArtworkPath(artist, work, path.extname(oldFile));
    const destinationFile = absolute(destination);
    if (fs.existsSync(destinationFile) && sha256(destinationFile) !== hash) {
      throw new Error(`Canonical destination contains different bytes: ${destination}`);
    }
    replacements.set(oldPath, destination);
    migrations.push({oldPath, destination, references, copy:!fs.existsSync(destinationFile), hash, reason:'artist-work'});
  }

  const oldImagesRoot = path.join(movementRoot, 'images');
  for (const name of fs.readdirSync(oldImagesRoot)) {
    if (!/\.(?:jpe?g|jfif|png|webp|gif)$/i.test(name)) continue;
    const oldPath = `${oldPrefix}${name}`;
    if (replacements.has(oldPath)) continue;
    const oldFile = absolute(oldPath);
    const hash = sha256(oldFile);
    const existing = (catalogByHash.get(hash) || [])[0];
    if (!existing) continue;
    replacements.set(oldPath, existing.path);
    migrations.push({oldPath, destination:existing.path, references:[], copy:false, hash, reason:'duplicate-bytes'});
  }

  const report = {
    ok: apply || migrations.length === 0,
    mode: apply ? 'apply' : 'check',
    artworkImages: migrations.filter(item => item.reason === 'artist-work').length,
    duplicateMovementImages: migrations.filter(item => item.reason === 'duplicate-bytes').length,
    reusedExisting: migrations.filter(item => !item.copy).length,
    copiedToImages: migrations.filter(item => item.copy).length,
    workLinks: migrations.reduce((sum, item) => sum + item.references.length, 0)
  };
  if (!apply) {
    console.log(JSON.stringify({...report, migrations:migrations.map(item => ({
      from:item.oldPath,
      to:item.destination,
      action:item.copy ? 'copy' : 'reuse',
      reason:item.reason,
      works:item.references.map(({artist, work}) => `${artist.id}|${work.id}`)
    }))}, null, 2));
    if (migrations.length) process.exitCode = 1;
    return;
  }

  for (const item of migrations.filter(value => value.copy)) {
    const destinationFile = absolute(item.destination);
    fs.mkdirSync(path.dirname(destinationFile), {recursive:true});
    fs.copyFileSync(absolute(item.oldPath), destinationFile);
  }

  replaceStrings(artistsPayload, replacements);
  replaceStrings(representatives, replacements);
  writeJson(artistsFile, artistsPayload);
  writeJson(representativesFile, representatives);

  for (const relative of ['data/featured-works.json', 'data/techniques.json']) {
    const file = absolute(relative);
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, 'utf8');
    const payload = JSON.parse(original);
    replaceStrings(payload, replacements);
    if (JSON.stringify(JSON.parse(original)) !== JSON.stringify(payload)) writeJson(file, payload);
  }

  const textFiles = [
    ...fs.readdirSync(movementRoot).filter(name => name.endsWith('.html')).map(name => path.join(movementRoot, name)),
    ...fs.readdirSync(path.join(root, 'tools')).filter(name => name.endsWith('.js')).map(name => path.join(root, 'tools', name))
  ];
  for (const file of textFiles) {
    const original = fs.readFileSync(file, 'utf8');
    let next = original;
    for (const [from, to] of replacements) {
      next = next.replaceAll(from, to);
      if (file.endsWith('.html')) next = next.replaceAll(`images/${path.basename(from)}`, `../${to.slice('data/'.length)}`);
    }
    if (next !== original) fs.writeFileSync(file, next, 'utf8');
  }

  for (const item of migrations) {
    for (const {artist, work} of item.references) {
      const indexFile = path.join(imagesRoot, artist.id, 'index.json');
      const index = fs.existsSync(indexFile) ? readJson(indexFile) : {};
      index[work.id] = {
        thumbnail:item.destination,
        checkedAt:new Date().toISOString(),
        verifiedBy:'Migrated from the legacy movement artwork folder',
        imageHash:item.hash
      };
      fs.mkdirSync(path.dirname(indexFile), {recursive:true});
      writeJson(indexFile, index);
    }
  }

  for (const item of migrations) fs.unlinkSync(absolute(item.oldPath));
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
