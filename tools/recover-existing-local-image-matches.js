#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {
  cleanLocalImagePath,
  existingLocalPath,
  existingLocalPathForWork,
  findExistingWorkImageById
} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const apply = process.argv.includes('--apply');
const suggest = process.argv.includes('--suggest');
const suggestionFile = path.join(root, 'data', 'generated', 'missing-local-image-investigation.json');
const imageUrlPattern = /(?:special:filepath|upload\.wikimedia|\.(?:jpe?g|png|webp|gif)(?:[?#/]|$))/i;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function text(value) {
  if (value && typeof value === 'object') return String(value.ko || value.en || '');
  return String(value || '');
}

function normalizedTitle(value) {
  return text(value).toLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣]+/g, '');
}

function imageUrls(work) {
  return [
    work?.image,
    work?.offlineThumbnailSource,
    work?.migration?.image?.sourceUrl,
    ...(work?.migration?.image?.sourceUrls || [])
  ].filter(value => /^https?:/i.test(String(value || '')) && imageUrlPattern.test(String(value)));
}

function imageUrlKey(value) {
  try {
    const url = new URL(String(value).replace(/^http:/i, 'https:'));
    return decodeURIComponent(url.pathname)
      .toLowerCase()
      .replace(/^.*\/special:filepath\//, '')
      .replace(/^.*\/\d+px-/, '')
      .replace(/[^a-z0-9가-힣]+/g, '');
  } catch (_) {
    return '';
  }
}

function sourceKeys(work) {
  return new Set(imageUrls(work).map(imageUrlKey).filter(key => key.length >= 8));
}

function recordedLocalPath(work) {
  return [
    work?.thumbnail,
    work?.image,
    work?.highResImage,
    work?.highResOriginal,
    work?.migration?.image?.localThumbnail,
    work?.migration?.image?.highResolution
  ].map(existingLocalPath).find(Boolean) || '';
}

function titleKeys(work) {
  return new Set([work?.title?.ko, work?.title?.en].map(normalizedTitle).filter(key => key.length >= 3));
}

function yearsClose(left, right) {
  const a = Number(left || 0);
  const b = Number(right || 0);
  return a > 0 && b > 0 && Math.abs(a - b) <= 1;
}

function bigrams(value) {
  const source = normalizedTitle(value);
  if (source.length < 2) return source ? [source] : [];
  return Array.from({length: source.length - 1}, (_, index) => source.slice(index, index + 2));
}

function diceCoefficient(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.length || !b.length) return 0;
  const counts = new Map();
  for (const item of a) counts.set(item, (counts.get(item) || 0) + 1);
  let shared = 0;
  for (const item of b) {
    const count = counts.get(item) || 0;
    if (!count) continue;
    shared += 1;
    counts.set(item, count - 1);
  }
  return (2 * shared) / (a.length + b.length);
}

function workTitleSimilarity(left, right) {
  const leftTitles = [left?.title?.ko, left?.title?.en].filter(Boolean);
  const rightTitles = [right?.title?.ko, right?.title?.en].filter(Boolean);
  let best = 0;
  for (const a of leftTitles) for (const b of rightTitles) best = Math.max(best, diceCoefficient(a, b));
  return best;
}

function suggestedMatches(work, candidates) {
  const workSources = sourceKeys(work);
  const byPath = new Map();
  for (const candidate of candidates || []) {
    const sourceMatch = [...sourceKeys(candidate.work)].some(key => workSources.has(key));
    const similarity = workTitleSimilarity(work, candidate.work);
    const leftYear = Number(work.year || 0);
    const rightYear = Number(candidate.work.year || 0);
    const yearDistance = leftYear && rightYear ? Math.abs(leftYear - rightYear) : null;
    let score = sourceMatch ? 100 : Math.round(similarity * 80);
    if (!sourceMatch) {
      if (yearDistance !== null && yearDistance <= 1) score += 20;
      else if (yearDistance !== null && yearDistance <= 5) score += 10;
    }
    if (score < 65) continue;
    const item = {
      path: candidate.localPath,
      score,
      similarity: Number(similarity.toFixed(3)),
      sourceMatch,
      historicalWorkId: candidate.work.id,
      historicalTitle: text(candidate.work.title),
      historicalEnglishTitle: candidate.work.title?.en || '',
      historicalYear: candidate.work.year || null,
      historicalImage: candidate.work.image || '',
      historicalSources: imageUrls(candidate.work),
      yearDistance
    };
    const previous = byPath.get(candidate.localPath);
    if (!previous || item.score > previous.score) byPath.set(candidate.localPath, item);
  }
  return [...byPath.values()].sort((left, right) => right.score - left.score).slice(0, 3);
}

function historicalPayloads() {
  let commits = [];
  try {
    commits = execFileSync('git', ['rev-list', '--all', '--', 'data/artists.json'], {
      cwd: root,
      encoding: 'utf8'
    }).trim().split(/\r?\n/).filter(Boolean);
  } catch (_) {
    return [];
  }
  if (!commits.length) return [];
  let batch;
  try {
    batch = execFileSync('git', ['cat-file', '--batch'], {
      cwd: root,
      input: `${commits.map(commit => `${commit}:data/artists.json`).join('\n')}\n`,
      maxBuffer: 1024 * 1024 * 1024
    });
  } catch (_) {
    return [];
  }
  const payloads = [];
  let offset = 0;
  for (const commit of commits) {
    const headerEnd = batch.indexOf(10, offset);
    if (headerEnd < 0) break;
    const header = batch.subarray(offset, headerEnd).toString('utf8');
    const size = Number(header.split(' ').pop());
    if (!Number.isFinite(size)) break;
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    try {
      payloads.push(JSON.parse(batch.subarray(contentStart, contentEnd).toString('utf8')));
    } catch (_) {
      // A malformed historical snapshot is not a match source.
    }
    offset = contentEnd + 1;
  }
  return payloads;
}

function imageFileCatalog() {
  const catalog = new Map();
  const imagesRoot = path.join(root, 'data', 'images');
  let artistIds = [];
  try {
    artistIds = fs.readdirSync(imagesRoot, {withFileTypes: true})
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (_) {
    return catalog;
  }
  for (const artistId of artistIds) {
    const folder = path.join(imagesRoot, artistId);
    let names = [];
    try {
      names = fs.readdirSync(folder, {withFileTypes: true})
        .filter(entry => entry.isFile() && /\.(?:jpe?g|png|webp|gif)$/i.test(entry.name))
        .map(entry => entry.name);
    } catch (_) {
      // An unavailable OneDrive folder contributes no match candidates.
    }
    const paths = names.map(name => `data/images/${artistId}/${name}`);
    const sourceEntries = [];
    try {
      const index = readJson(path.join(folder, 'index.json'));
      for (const [workId, value] of Object.entries(index)) {
        const importedName = String(value?.verifiedBy || '').match(/:\s*(.+\.(?:jpe?g|png|webp|gif|tiff?))$/i)?.[1] || '';
        if (!importedName) continue;
        const indexedLocalPath = existingLocalPath(String(value?.thumbnail || '').replace(/^data\/thumbnails\//, 'data/images/'));
        const localPath = indexedLocalPath || paths.find(value => path.basename(value).toLowerCase().startsWith(String(workId).toLowerCase())) || '';
        if (localPath) sourceEntries.push({workId, localPath, importedName, key: normalizedTitle(importedName)});
      }
    } catch (_) {
      // Index metadata is optional.
    }
    catalog.set(artistId, {paths, pathSet: new Set(paths), sourceEntries});
  }
  return catalog;
}

function indexedSourceMatches(work, catalog) {
  const keys = sourceKeys(work);
  if (!keys.size) return [];
  const matches = [];
  for (const [artistId, item] of catalog) {
    for (const entry of item.sourceEntries || []) {
      if (!keys.has(entry.key)) continue;
      matches.push({artistId, ...entry});
    }
  }
  return matches;
}

function artistKeys(artist) {
  return [...new Set([
    `id:${String(artist?.id || '').toLowerCase()}`,
    `name:${normalizedTitle(artist?.name?.ko)}`,
    `name:${normalizedTitle(artist?.name?.en)}`
  ].filter(value => !value.endsWith(':')))];
}

function catalogLocalPath(work, artistId, catalog) {
  const files = catalog.get(artistId);
  if (!files) return '';
  const direct = [
    work?.localImage,
    work?.thumbnail,
    work?.image,
    work?.highResImage,
    work?.highResOriginal,
    work?.migration?.image?.localThumbnail,
    work?.migration?.image?.highResolution
  ].map(cleanLocalImagePath).find(value => files.pathSet.has(value));
  if (direct) return direct;
  const workId = String(work?.id || '').toLowerCase();
  if (!workId) return '';
  return files.paths.find(value => {
    const stem = path.basename(value).replace(/\.(?:jpe?g|png|webp|gif)$/i, '').replace(/\.10mb$/i, '').toLowerCase();
    return stem === workId || stem.startsWith(`${workId}.`) || stem.startsWith(`${workId}_`) || stem.endsWith(`__${workId}`);
  }) || '';
}

function candidateRecords(current, history, catalog) {
  const byArtist = new Map();
  const seen = new Set();
  for (const payload of [current, ...history]) {
    for (const artist of payload.artists || []) {
      for (const work of artist.works || []) {
        const localPath = catalogLocalPath(work, artist.id, catalog);
        if (!localPath) continue;
        const key = [
          artist.id,
          work.id,
          localPath,
          [...titleKeys(work)].sort().join(','),
          work.year || '',
          [...sourceKeys(work)].sort().join(',')
        ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const row = {artistId: artist.id, work, localPath};
        for (const artistKey of artistKeys(artist)) {
          byArtist.set(artistKey, [...(byArtist.get(artistKey) || []), row]);
        }
      }
    }
  }
  return byArtist;
}

function candidatesForArtist(candidates, artist) {
  const rows = artistKeys(artist).flatMap(key => candidates.get(key) || []);
  const seen = new Set();
  return rows.filter(row => {
    const key = [
      row.artistId,
      row.work.id,
      row.localPath,
      [...titleKeys(row.work)].sort().join(','),
      row.work.year || '',
      [...sourceKeys(row.work)].sort().join(',')
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function indexedPath(artistId, workId) {
  const indexFile = path.join(root, 'data', 'images', artistId, 'index.json');
  try {
    const index = readJson(indexFile);
    const value = String(index[workId]?.thumbnail || '').replace(/^data\/thumbnails\//, 'data/images/');
    return existingLocalPath(value);
  } catch (_) {
    return '';
  }
}

function scoreCandidate(work, candidate) {
  if (String(work.id || '') === String(candidate.work.id || '')) return {score: 100, reason: '작품 ID 일치'};
  const workSources = sourceKeys(work);
  const sourceMatch = [...sourceKeys(candidate.work)].some(key => workSources.has(key));
  if (sourceMatch) return {score: 98, reason: '원본 이미지 출처 일치'};
  const workTitles = titleKeys(work);
  const titleMatch = [...titleKeys(candidate.work)].some(key => workTitles.has(key));
  if (titleMatch && yearsClose(work.year, candidate.work.year)) return {score: 94, reason: '작품명과 제작 연도 일치'};
  return {score: 0, reason: ''};
}

function matchWork(artist, work, candidates) {
  const direct = findExistingWorkImageById(artist.id, work.id) || indexedPath(artist.id, work.id);
  if (direct) return {path: direct, reason: '작품 ID 일치', score: 100};
  const scored = (candidates || [])
    .map(candidate => ({candidate, ...scoreCandidate(work, candidate)}))
    .filter(item => item.score >= 94);
  const paths = [...new Set(scored.map(item => item.candidate.localPath))];
  if (paths.length !== 1) return null;
  const best = scored.sort((left, right) => right.score - left.score)[0];
  return {path: paths[0], reason: best.reason, score: best.score, matchedWorkId: best.candidate.work.id};
}

function markReady(work, localPath) {
  work.thumbnail = localPath;
  work.highResImage = localPath;
  work.highResOriginal = localPath;
  work.imageUploadStatus = 'ready';
  work.thumbnailValidation = 2;
  work.migration = work.migration && typeof work.migration === 'object' ? work.migration : {schema: 1};
  work.migration.image = work.migration.image && typeof work.migration.image === 'object' ? work.migration.image : {};
  work.migration.image.status = 'ready';
  work.migration.image.localThumbnail = localPath;
  work.migration.image.highResolution = localPath;
}

function representativeRows(payload) {
  return [
    ...(payload.categories || []).map(category => ({
      categoryId: category.categoryId,
      role: 'primary',
      artist: category.artist,
      work: category.work
    })),
    ...(payload.furtherArtists || []).flatMap(category => (category.artists || []).map(item => ({
      categoryId: category.categoryId,
      role: 'further',
      artist: item.artist,
      work: item.work
    })))
  ].filter(row => row.artist?.id && row.work?.id);
}

function markRepresentativeReady(work, localPath) {
  work.localImage = localPath;
  work.thumbnail = localPath;
  if (!work.image || !/^https?:/i.test(String(work.image))) work.image = localPath;
  work.imageStatus = 'ready';
}

function main() {
  const payload = readJson(artistsFile);
  const representatives = readJson(representativesFile);
  const history = historicalPayloads();
  const catalog = imageFileCatalog();
  const candidates = candidateRecords(payload, history, catalog);
  const indexedSourceMatchesFound = [];
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      if (recordedLocalPath(work)) continue;
      const matches = indexedSourceMatches(work, catalog);
      if (matches.length) indexedSourceMatchesFound.push({
        artistId: artist.id,
        artist: text(artist.name) || artist.id,
        workId: work.id,
        title: text(work.title) || work.id,
        matches
      });
    }
  }
  const artistMatches = [];
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      if (recordedLocalPath(work)) continue;
      const match = matchWork(artist, work, candidatesForArtist(candidates, artist));
      if (!match) continue;
      artistMatches.push({
        artistId: artist.id,
        artist: text(artist.name) || artist.id,
        workId: work.id,
        title: text(work.title) || work.id,
        year: work.year || null,
        ...match
      });
      if (apply) markReady(work, match.path);
    }
  }
  const representativeMatches = [];
  const currentWorks = new Map((payload.artists || []).flatMap(artist => (artist.works || []).map(work => [`${artist.id}|${work.id}`, work])));
  for (const row of representativeRows(representatives)) {
    if (recordedLocalPath(row.work) || existingLocalPath(row.work.localImage)) continue;
    const match = matchWork(row.artist, row.work, candidatesForArtist(candidates, row.artist));
    if (!match) continue;
    representativeMatches.push({
      categoryId: row.categoryId,
      role: row.role,
      artistId: row.artist.id,
      artist: text(row.artist.name) || row.artist.id,
      workId: row.work.id,
      title: text(row.work.title) || row.work.id,
      year: row.work.year || null,
      ...match
    });
    if (apply) {
      markRepresentativeReady(row.work, match.path);
      const artistWork = currentWorks.get(`${row.artist.id}|${row.work.id}`);
      if (artistWork && !recordedLocalPath(artistWork)) markReady(artistWork, match.path);
    }
  }
  if (apply && (artistMatches.length || representativeMatches.length)) writeJson(artistsFile, payload);
  if (apply && representativeMatches.length) writeJson(representativesFile, representatives);
  const suggestions = [];
  if (suggest) {
    for (const artist of payload.artists || []) {
      for (const work of artist.works || []) {
        if (recordedLocalPath(work)) continue;
        const items = suggestedMatches(work, candidatesForArtist(candidates, artist));
        if (!items.length) continue;
        suggestions.push({
          artistId: artist.id,
          artist: text(artist.name) || artist.id,
          workId: work.id,
          title: text(work.title) || work.id,
          englishTitle: work.title?.en || '',
          year: work.year || null,
          image: work.image || '',
          sources: imageUrls(work),
          candidates: items
        });
      }
    }
    fs.mkdirSync(path.dirname(suggestionFile), {recursive: true});
    writeJson(suggestionFile, {
      historicalSnapshots: history.length,
      exactImportedFilenameMatches: indexedSourceMatchesFound.length,
      importedFilenameItems: indexedSourceMatchesFound,
      works: suggestions.length,
      items: suggestions
    });
  }
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'check',
    historicalSnapshots: history.length,
    artistMatches: artistMatches.length,
    representativeMatches: representativeMatches.length,
    exactImportedFilenameMatches: indexedSourceMatchesFound.length,
    suggestionFile: suggest ? path.relative(root, suggestionFile).replace(/\\/g, '/') : '',
    suggestions: suggestions.length,
    artists: artistMatches,
    representatives: representativeMatches,
    ...(suggest ? {suggestionSummary: suggestions.map(item => ({
      artist: item.artist,
      workId: item.workId,
      title: item.title,
      topScore: item.candidates[0].score,
      topPath: item.candidates[0].path
    }))} : {})
  }, null, 2));
}

main();
