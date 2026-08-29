const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const root = path.resolve(__dirname, '..');
const imagesRoot = path.join(root, 'data', 'images');
const artistsFile = path.join(root, 'data', 'artists.json');
const catalogFile = path.join(root, 'data', 'image-catalog.json');
const imagePattern = /\.(?:jpe?g|jfif|png|webp|gif)$/i;

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function normalizeLocalPath(value) {
  const clean = String(value || '').trim().replace(/[?#].*$/, '').replace(/\\/g, '/');
  return clean.startsWith('data/images/') ? clean : '';
}

function walkImages(directory = imagesRoot, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== '_placeholder') walkImages(absolute, result);
    else if (entry.isFile() && imagePattern.test(entry.name)) result.push(absolute);
  }
  return result;
}

function qidFromValue(value) {
  return String(value || '').match(/(?:^|[^A-Z0-9])(Q\d+)(?:$|[^A-Z0-9])/i)?.[1]?.toUpperCase() || '';
}

function localizedText(value, language = 'ko') {
  if (typeof value === 'string') return value;
  return String(value?.[language] || value?.ko || value?.en || '').trim();
}

function imageValues(work) {
  return [...new Set([
    work?.localImage,
    work?.thumbnail,
    work?.image,
    work?.highResImage,
    work?.highResOriginal,
    work?.migration?.image?.localThumbnail,
    work?.migration?.image?.highResolution
  ].map(normalizeLocalPath).filter(Boolean))];
}

function sanitizeFilenamePart(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
}

function canonicalArtworkFilename(artist, work, extension = '.jpg') {
  const artistName = sanitizeFilenamePart(artist?.listName?.ko || artist?.name?.ko || artist?.name?.en);
  const titleWords = sanitizeFilenamePart(work?.title?.ko || work?.title?.en).split(/\s+/).filter(Boolean).slice(0, 3);
  const year = String(work?.year ?? work?.yearLabel ?? '').match(/\b(\d{3,4})\b/)?.[1] || '';
  const workId = sanitizeFilenamePart(work?.id).replace(/\s+/g, '-');
  const rawExtension = String(extension || '.jpg').toLowerCase();
  const normalizedExtension = ['.jpeg', '.jfif'].includes(rawExtension) ? '.jpg' : rawExtension;
  if (!artistName || !titleWords.length || !year || !workId) {
    throw new Error(`Cannot create canonical image filename without artist name, title, year, and workId: ${artist?.id || ''}|${work?.id || ''}`);
  }
  return `${artistName}_${titleWords.join(' ')}_${year}__${workId}${normalizedExtension}`;
}

function canonicalArtworkPath(artist, work, extension = '.jpg') {
  return `data/images/${artist.id}/${canonicalArtworkFilename(artist, work, extension)}`;
}

function conformsToFilenameStandard(filePath, workIds = []) {
  const filename = path.basename(filePath);
  const parsed = path.parse(filename);
  const separator = parsed.name.lastIndexOf('__');
  if (separator <= 0) return false;
  const prefix = parsed.name.slice(0, separator);
  const workId = parsed.name.slice(separator + 2);
  const parts = prefix.split('_');
  if (parts.length !== 3 || parts.some(part => !part.trim())) return false;
  if (!/^\d{3,4}$/.test(parts[2])) return false;
  if (!workId.trim()) return false;
  return !workIds.length || workIds.includes(workId);
}

function workReference(artist, work) {
  return {
    artistId: artist.id,
    artistQid: String(artist.qid || qidFromValue(artist.id)),
    artistNameKo: localizedText(artist.name, 'ko'),
    artistNameEn: localizedText(artist.name, 'en'),
    workId: String(work.id || ''),
    workQid: qidFromValue(work.id) || qidFromValue(work.source),
    titleKo: localizedText(work.title, 'ko'),
    titleEn: localizedText(work.title, 'en'),
    year: work.year ?? null
  };
}

function addReference(map, localPath, reference) {
  const normalized = normalizeLocalPath(localPath);
  if (!normalized) return;
  const references = map.get(normalized) || [];
  const key = `${reference.artistId}|${reference.workId}`;
  if (!references.some(item => `${item.artistId}|${item.workId}` === key)) references.push(reference);
  map.set(normalized, references);
}

function referenceMap(artists) {
  const map = new Map();
  const artistsById = new Map((artists || []).map(artist => [artist.id, artist]));
  for (const artist of artists || []) {
    for (const work of artist.works || []) {
      const reference = workReference(artist, work);
      for (const localPath of imageValues(work)) addReference(map, localPath, reference);
    }
  }
  for (const entry of fs.readdirSync(imagesRoot, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const artist = artistsById.get(entry.name);
    const index = readJson(path.join(imagesRoot, entry.name, 'index.json'), {});
    for (const [workId, item] of Object.entries(index || {})) {
      const work = (artist?.works || []).find(candidate => String(candidate.id) === String(workId));
      if (!artist || !work) continue;
      addReference(map, item?.thumbnail, workReference(artist, work));
    }
  }
  return map;
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function mimeFromExtension(extension) {
  return ({'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'})[extension.toLowerCase()] || 'application/octet-stream';
}

function buildCatalog({bootstrap = false} = {}) {
  const payload = readJson(artistsFile, {artists: []});
  const previous = readJson(catalogFile, {images: []});
  const previousByPath = new Map((previous.images || []).map(item => [item.path, item]));
  const previousByHash = new Map();
  for (const item of previous.images || []) {
    if (!item.sha256) continue;
    previousByHash.set(item.sha256, [...(previousByHash.get(item.sha256) || []), item]);
  }
  const references = referenceMap(payload.artists || []);
  const images = walkImages().map(absolute => {
    const localPath = relative(absolute);
    const stat = fs.statSync(absolute);
    const hash = sha256(absolute);
    const linkedWorks = references.get(localPath) || [];
    const existing = previousByPath.get(localPath);
    const historical = previousByHash.get(hash) || [];
    const aliases = [...new Set([
      ...(existing?.aliases || []),
      ...historical.flatMap(item => [item.path, ...(item.aliases || [])])
    ].filter(value => value && value !== localPath))].sort();
    const standard = conformsToFilenameStandard(localPath, linkedWorks.map(item => item.workId));
    const namingStatus = standard ? 'standard' : (existing?.namingStatus || (bootstrap ? 'legacy' : 'new-nonstandard'));
    return {
      path: localPath,
      filename: path.basename(localPath),
      bytes: stat.size,
      sha256: hash,
      mime: mimeFromExtension(path.extname(localPath)),
      namingStatus,
      ...(namingStatus === 'legacy' ? {grandfatheredAt: existing?.grandfatheredAt || new Date().toISOString()} : {}),
      aliases,
      works: linkedWorks
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
  const linkedImages = images.filter(item => item.works.length).length;
  const duplicateHashes = new Map();
  for (const image of images) duplicateHashes.set(image.sha256, (duplicateHashes.get(image.sha256) || 0) + 1);
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    namingStandard: 'shortArtist_titleFirst3Words_startYear__workId.ext',
    stats: {
      images: images.length,
      linkedImages,
      unlinkedImages: images.length - linkedImages,
      standardNames: images.filter(item => item.namingStatus === 'standard').length,
      legacyNames: images.filter(item => item.namingStatus === 'legacy').length,
      newNonstandardNames: images.filter(item => item.namingStatus === 'new-nonstandard').length,
      duplicateHashGroups: [...duplicateHashes.values()].filter(count => count > 1).length
    },
    images
  };
}

function writeCatalog(catalog) {
  fs.writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

function validateCatalog({checkHashes = false} = {}) {
  const catalog = readJson(catalogFile);
  if (!catalog || catalog.schema !== 1 || !Array.isArray(catalog.images)) throw new Error('data/image-catalog.json is missing or invalid');
  const artists = readJson(artistsFile, {artists: []}).artists || [];
  const workByKey = new Map();
  for (const artist of artists) {
    for (const work of artist.works || []) workByKey.set(`${artist.id}|${work.id}`, {artist, work});
  }
  const disk = walkImages().map(relative).sort();
  const listed = catalog.images.map(item => item.path).sort();
  const duplicatePaths = listed.filter((item, index) => item === listed[index - 1]);
  const diskSet = new Set(disk);
  const listedSet = new Set(listed);
  const missingFromCatalog = disk.filter(item => !listedSet.has(item));
  const missingFromDisk = listed.filter(item => !diskSet.has(item));
  const changed = [];
  for (const item of catalog.images) {
    const absolute = path.join(root, item.path);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.statSync(absolute);
    if (stat.size !== item.bytes) changed.push({path: item.path, reason: 'bytes'});
    else if (checkHashes && sha256(absolute) !== item.sha256) changed.push({path: item.path, reason: 'sha256'});
  }
  const newNonstandard = catalog.images.filter(item => item.namingStatus === 'new-nonstandard').map(item => item.path);
  const unlinkedImages = catalog.images.filter(item => !(item.works || []).length).map(item => item.path);
  const staleReferences = [];
  const catalogReferenceKeys = new Set();
  for (const image of catalog.images) {
    for (const reference of image.works || []) {
      const key = `${reference.artistId}|${reference.workId}`;
      catalogReferenceKeys.add(`${image.path}|${key}`);
      const current = workByKey.get(key);
      if (!current) {
        staleReferences.push({path: image.path, key, reason: 'missing-work'});
        continue;
      }
      const expected = workReference(current.artist, current.work);
      if (JSON.stringify(reference) !== JSON.stringify(expected)) {
        staleReferences.push({path: image.path, key, reason: 'metadata'});
      }
    }
  }
  const missingWorkReferences = [];
  for (const {artist, work} of workByKey.values()) {
    for (const localPath of imageValues(work)) {
      if (!fs.existsSync(path.join(root, localPath))) continue;
      const key = `${localPath}|${artist.id}|${work.id}`;
      if (!catalogReferenceKeys.has(key)) missingWorkReferences.push({path: localPath, key: `${artist.id}|${work.id}`});
    }
  }
  return {
    valid: !duplicatePaths.length
      && !missingFromCatalog.length
      && !missingFromDisk.length
      && !changed.length
      && !newNonstandard.length
      && !unlinkedImages.length
      && !staleReferences.length
      && !missingWorkReferences.length,
    images: disk.length,
    duplicatePaths,
    missingFromCatalog,
    missingFromDisk,
    changed,
    newNonstandard,
    unlinkedImages,
    staleReferences,
    missingWorkReferences
  };
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function searchCatalog(catalog, criteria = {}) {
  const queryTokens = normalizeSearch(criteria.query).split(/\s+/).filter(Boolean);
  const exactWorkId = normalizeSearch(criteria.workId);
  const exactQid = String(criteria.qid || '').toUpperCase();
  const exactHash = String(criteria.sha256 || '').toLowerCase();
  const artistTokens = normalizeSearch(criteria.artist).split(/\s+/).filter(Boolean);
  const titleTokens = normalizeSearch(criteria.title).split(/\s+/).filter(Boolean);
  const results = [];
  for (const image of catalog.images || []) {
    let best = 0;
    let matchedWork = null;
    for (const work of image.works || []) {
      const artist = normalizeSearch(`${work.artistNameKo} ${work.artistNameEn} ${work.artistId} ${work.artistQid}`);
      const title = normalizeSearch(`${work.titleKo} ${work.titleEn} ${work.workId} ${work.workQid} ${work.year || ''}`);
      const combined = `${artist} ${title} ${normalizeSearch(image.filename)} ${normalizeSearch((image.aliases || []).join(' '))}`;
      const artistMatches = !artistTokens.length || artistTokens.every(token => artist.includes(token));
      const titleMatches = !titleTokens.length || titleTokens.every(token => title.includes(token));
      if (!artistMatches || !titleMatches) continue;
      let score = 0;
      if (exactWorkId && normalizeSearch(work.workId) === exactWorkId) score += 120;
      if (exactQid && [work.workQid, work.artistQid].includes(exactQid)) score += 120;
      if (artistTokens.length) score += 50;
      if (titleTokens.length) score += 50;
      score += queryTokens.filter(token => combined.includes(token)).length * 10;
      if (score > best) {
        best = score;
        matchedWork = work;
      }
    }
    if (exactHash && image.sha256.toLowerCase() === exactHash) best += 200;
    if (best > 0) results.push({score: best, image, work: matchedWork});
  }
  return results.sort((left, right) => right.score - left.score || right.image.bytes - left.image.bytes);
}

module.exports = {
  root,
  catalogFile,
  imagePattern,
  readJson,
  normalizeLocalPath,
  canonicalArtworkFilename,
  canonicalArtworkPath,
  conformsToFilenameStandard,
  buildCatalog,
  writeCatalog,
  validateCatalog,
  searchCatalog
};
