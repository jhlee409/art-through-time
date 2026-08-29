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
  return text(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9가-힣]+/g, '');
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

function imageFileCatalog(current) {
  const catalog = new Map();
  for (const artist of current.artists || []) {
    const folder = path.join(root, 'data', 'images', artist.id);
    let names = [];
    try {
      names = fs.readdirSync(folder, {withFileTypes: true})
        .filter(entry => entry.isFile() && /\.(?:jpe?g|png|webp|gif)$/i.test(entry.name))
        .map(entry => entry.name);
    } catch (_) {
      // An unavailable OneDrive folder contributes no match candidates.
    }
    const paths = names.map(name => `data/images/${artist.id}/${name}`);
    catalog.set(artist.id, {paths, pathSet: new Set(paths)});
  }
  return catalog;
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
        byArtist.set(artist.id, [...(byArtist.get(artist.id) || []), row]);
      }
    }
  }
  return byArtist;
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
  const catalog = imageFileCatalog(payload);
  const candidates = candidateRecords(payload, history, catalog);
  const artistMatches = [];
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      if (recordedLocalPath(work)) continue;
      const match = matchWork(artist, work, candidates.get(artist.id));
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
    const match = matchWork(row.artist, row.work, candidates.get(row.artist.id));
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
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'check',
    historicalSnapshots: history.length,
    artistMatches: artistMatches.length,
    representativeMatches: representativeMatches.length,
    artists: artistMatches,
    representatives: representativeMatches
  }, null, 2));
}

main();
