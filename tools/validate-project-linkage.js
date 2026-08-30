#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {indexArtist} = require('./build-artist-index');

const root = path.resolve(__dirname, '..');
const checkImageIndexes = process.argv.includes('--image-indexes');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const normalizedPath = value => String(value || '').trim().replace(/[?#].*$/, '').replace(/\\/g, '/');
const artworkPath = value => {
  const localPath = normalizedPath(value);
  return localPath.startsWith('data/images/') && !localPath.startsWith('data/images/_placeholder/') ? localPath : '';
};
const imageValues = work => [...new Set([
  work?.localImage,
  work?.thumbnail,
  work?.image,
  work?.highResImage,
  work?.highResOriginal,
  work?.migration?.image?.localThumbnail,
  work?.migration?.image?.highResolution
].map(artworkPath).filter(Boolean))];

const issues = [];

function check(condition, message) {
  if (!condition) issues.push(message);
}

function indexedFiles(payload) {
  return Object.entries(payload.documents || {}).flatMap(([key, slots]) =>
    Object.entries(slots || {})
      .filter(([slot, value]) => /^\d+$/.test(slot) && typeof value === 'string')
      .map(([slot, file]) => ({key, slot, file:normalizedPath(file)}))
  );
}

function main() {
  const artistsPayload = readJson('data/artists.json');
  const artistIndex = readJson('data/artists-index.json');
  const catalog = readJson('data/image-catalog.json');
  const movementIndex = readJson('data/미술사조/index.json');
  const legacyMovementIndex = readJson('data/미술사조/legacy-index.json');
  const artists = artistsPayload.artists || [];
  const artistsById = new Map();
  const worksByKey = new Map();

  for (const artist of artists) {
    check(artist.id && !artistsById.has(artist.id), `Duplicate or empty artist ID: ${artist.id || '(empty)'}`);
    artistsById.set(artist.id, artist);
    const workIds = new Set();
    for (const work of artist.works || []) {
      check(work.id && !workIds.has(work.id), `Duplicate or empty work ID: ${artist.id}|${work.id || '(empty)'}`);
      workIds.add(work.id);
      worksByKey.set(`${artist.id}|${work.id}`, {artist, work});
    }
    for (const workId of artist.featuredWorkIds || []) {
      check(workIds.has(workId), `Unknown featured work: ${artist.id}|${workId}`);
    }
    if (artist.generated?.file) {
      check(fs.existsSync(path.join(root, normalizedPath(artist.generated.file))), `Generated artist file is missing: ${artist.id}|${artist.generated.file}`);
    }
  }

  const indexById = new Map((artistIndex.artists || []).map(artist => [artist.id, artist]));
  check(indexById.size === artists.length && (artistIndex.artists || []).length === artists.length, 'artists-index.json artist IDs differ from artists.json');
  for (const artist of artists) {
    check(JSON.stringify(indexArtist(artist)) === JSON.stringify(indexById.get(artist.id)), `Stale artist index entry: ${artist.id}`);
  }
  for (const field of ['dataSchema', 'metadata', 'deletedArtists', 'historicalEvents', 'favoriteWorks']) {
    const expected = artistsPayload[field] ?? (field === 'dataSchema' ? 1 : field === 'metadata' ? {} : []);
    const actual = artistIndex[field] ?? (field === 'dataSchema' ? 1 : field === 'metadata' ? {} : []);
    check(JSON.stringify(expected) === JSON.stringify(actual), `Stale artist index top-level field: ${field}`);
  }
  for (const favorite of artistsPayload.favoriteWorks || []) {
    const separator = favorite.indexOf('::');
    const artistId = separator < 0 ? '' : favorite.slice(0, separator);
    const workId = separator < 0 ? '' : favorite.slice(separator + 2);
    check(worksByKey.has(`${artistId}|${workId}`), `Favorite work target is missing: ${favorite}`);
  }

  const catalogByPath = new Map((catalog.images || []).map(image => [normalizedPath(image.path), image]));
  check(catalogByPath.size === (catalog.images || []).length, 'Duplicate image paths in image-catalog.json');
  let workImageReferences = 0;
  for (const [key, entry] of worksByKey) {
    for (const localPath of imageValues(entry.work)) {
      workImageReferences += 1;
      check(fs.existsSync(path.join(root, localPath)), `Work image is missing on disk: ${key}|${localPath}`);
      const image = catalogByPath.get(localPath);
      check(image, `Work image is absent from image catalog: ${key}|${localPath}`);
      if (image) check((image.works || []).some(reference => `${reference.artistId}|${reference.workId}` === key), `Image catalog lacks work reference: ${key}|${localPath}`);
    }
  }

  let catalogWorkReferences = 0;
  for (const image of catalog.images || []) {
    check(fs.existsSync(path.join(root, image.path)), `Catalog image is missing on disk: ${image.path}`);
    check((image.works || []).length > 0, `Catalog image is not linked: ${image.path}`);
    for (const reference of image.works || []) {
      catalogWorkReferences += 1;
      const key = `${reference.artistId}|${reference.workId}`;
      const entry = worksByKey.get(key);
      check(entry, `Catalog reference target is missing: ${image.path}|${key}`);
      if (entry) check(imageValues(entry.work).includes(normalizedPath(image.path)), `Catalog image is not used by the timeline work: ${image.path}|${key}`);
    }
  }

  let imageIndexFiles = 0;
  let imageIndexEntries = 0;
  const inaccessibleImageIndexFiles = [];
  const imagesRoot = path.join(root, 'data', 'images');
  for (const folder of checkImageIndexes ? fs.readdirSync(imagesRoot, {withFileTypes:true}) : []) {
    if (!folder.isDirectory() || folder.name === '_placeholder') continue;
    const indexFile = path.join(imagesRoot, folder.name, 'index.json');
    if (!fs.existsSync(indexFile)) continue;
    let index;
    try {
      index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
      inaccessibleImageIndexFiles.push(normalizedPath(path.relative(root, indexFile)));
      continue;
    }
    imageIndexFiles += 1;
    for (const [workId, item] of Object.entries(index || {})) {
      imageIndexEntries += 1;
      const key = `${folder.name}|${workId}`;
      const entry = worksByKey.get(key);
      const thumbnail = normalizedPath(item?.thumbnail);
      check(entry, `Image index target is missing: ${key}`);
      check(Boolean(thumbnail), `Image index thumbnail is empty: ${key}`);
      if (!thumbnail) continue;
      check(fs.existsSync(path.join(root, thumbnail)), `Image index thumbnail is missing on disk: ${key}|${thumbnail}`);
      if (entry && artworkPath(thumbnail)) {
        check(imageValues(entry.work).includes(thumbnail), `Image index overrides the timeline with an unlinked path: ${key}|${thumbnail}`);
      }
    }
  }

  const activeDocuments = indexedFiles(movementIndex);
  const legacyDocuments = indexedFiles(legacyMovementIndex);
  const movementFiles = fs.readdirSync(path.join(root, 'data', '미술사조'))
    .filter(file => /\.html?$/i.test(file))
    .map(file => `data/미술사조/${file}`)
    .sort();
  const registeredDocumentFiles = [...activeDocuments, ...legacyDocuments].map(item => item.file);
  check(new Set(registeredDocumentFiles).size === registeredDocumentFiles.length, 'A movement HTML file is registered more than once');
  check(JSON.stringify([...registeredDocumentFiles].sort()) === JSON.stringify(movementFiles), 'Movement HTML files and active/legacy indexes differ');
  for (const item of [...activeDocuments, ...legacyDocuments]) {
    check(fs.existsSync(path.join(root, item.file)), `Indexed movement HTML is missing: ${item.key}|${item.file}`);
  }

  console.log(JSON.stringify({
    ok: issues.length === 0,
    artists: artists.length,
    works: worksByKey.size,
    favorites: (artistsPayload.favoriteWorks || []).length,
    workImageReferences,
    catalogImages: catalogByPath.size,
    catalogWorkReferences,
    imageIndexFiles,
    imageIndexEntries,
    inaccessibleImageIndexFiles,
    activeMovementDocuments: activeDocuments.length,
    legacyMovementDocuments: legacyDocuments.length,
    physicalMovementDocuments: movementFiles.length,
    issues: issues.length
  }, null, 2));
  if (issues.length) {
    console.error(issues.slice(0, 200).join('\n'));
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
