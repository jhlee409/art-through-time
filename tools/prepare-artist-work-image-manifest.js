#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {requireUrlFileDownloadApproval} = require('./url-download-permission');
const {workHasLocalImage, canonicalArtworkPath} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const manifestFile = path.join(root, 'data', 'artist-work-image-download-manifest.json');
const commonsApi = 'https://commons.wikimedia.org/w/api.php';
const stopWords = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'the', 'to', 'untitled', 'with']);
const pendingUploadOnly = process.argv.includes('--pending-upload-only');
const excludePendingUpload = process.argv.includes('--exclude-pending-upload');

requireUrlFileDownloadApproval({
  purpose: 'Build the one-time user-approved Wikimedia Commons image manifest for artist works without local images.',
  url: commonsApi
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter(token => token.length > 2 && !stopWords.has(token));
}

function candidateScore(candidate, artistName, workTitle) {
  const title = normalize(candidate.fileTitle.replace(/^File:/i, '').replace(/\.[^.]+$/, ''));
  const artistTokens = tokens(artistName);
  const workTokens = tokens(workTitle);
  const artistMatches = artistTokens.filter(token => title.includes(token)).length;
  const workMatches = workTokens.filter(token => title.includes(token)).length;
  const compactTitle = title.replace(/\s+/g, '');
  const compactWork = normalize(workTitle).replace(/\s+/g, '');
  const exactWork = compactWork.length > 5 && compactTitle.includes(compactWork);
  const derivative = /\b(detail|study|page|poster|postcard|copy|after|sketch|photograph|portrait of|tomb|grave|logo|stamp|coin)\b/.test(title);
  return {
    score: artistMatches * 4 + workMatches * 3 + (exactWork ? 8 : 0) - (derivative ? 14 : 0),
    artistMatches,
    workMatches,
    exactWork,
    derivative
  };
}

function extensionFor(mime, fileTitle) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  const extension = path.extname(fileTitle).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension) ? extension : '.jpg';
}

async function searchCommons(item) {
  const artistName = item.artistName.en || item.artistName.ko;
  const workTitle = item.workTitle.en || item.workTitle.ko;
  const found = new Map();
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${artistName} ${workTitle}`,
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '1400',
    format: 'json',
    formatversion: '2',
    origin: '*'
  });
  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`${commonsApi}?${params}`, {
      headers: {'User-Agent': 'ArtThroughTime/0.1 (one-time user-approved educational artist image manifest)'},
      signal: AbortSignal.timeout(15000)
    });
    if (response.status !== 429) break;
    await new Promise(resolve => setTimeout(resolve, 4000 * (attempt + 1)));
  }
  if (!response.ok) throw new Error(`${item.artistId}: Commons API ${response.status}`);
  const payload = await response.json();
  for (const page of payload.query?.pages || []) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !String(info.mime || '').startsWith('image/')) continue;
    const scored = candidateScore({fileTitle: page.title}, artistName, workTitle);
    found.set(page.title, {
      ...scored,
      fileTitle: page.title,
      pageUrl: info.descriptionurl,
      downloadUrl: info.thumburl,
      mime: info.mime,
      width: info.thumbwidth || info.width,
      height: info.thumbheight || info.height,
      license: info.extmetadata?.LicenseShortName?.value || '',
      credit: info.extmetadata?.Credit?.value || '',
      artistCredit: info.extmetadata?.Artist?.value || ''
    });
  }
  return [...found.values()].sort((a, b) => b.score - a.score);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        results[index] = {error: error.message};
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return results;
}

async function main() {
  const artists = readJson(artistsFile).artists || [];
  const missingWorks = artists.flatMap(artist => (artist.works || []).map(work => ({artist, work})))
    .filter(({artist, work}) => !workHasLocalImage(work, artist.id));
  const scopedMissingWorks = missingWorks.filter(({work}) => {
    if (pendingUploadOnly) return work.imageUploadStatus === 'pending-upload';
    if (excludePendingUpload) return work.imageUploadStatus !== 'pending-upload';
    return true;
  });
  const pending = artists.flatMap(artist => (artist.works || [])
    .filter(work => !workHasLocalImage(work, artist.id))
    .filter(work => !pendingUploadOnly || work.imageUploadStatus === 'pending-upload')
    .filter(work => !excludePendingUpload || work.imageUploadStatus !== 'pending-upload')
    .map(work => ({
      artistId: artist.id,
      artistName: artist.name || {},
      workId: work.id,
      workTitle: work.title || {},
      year: work.year || work.yearLabel || '',
      movement: work.movement || artist.movement || {}
    })))
    .filter(item => tokens(item.artistName.en || item.artistName.ko).length && tokens(item.workTitle.en || item.workTitle.ko).length);

  const searches = await mapLimit(pending, 3, async (item, index) => {
    console.error(`search ${index + 1}/${pending.length} ${item.artistName.ko || item.artistName.en} - ${item.workTitle.ko || item.workTitle.en}`);
    return searchCommons(item);
  });

  const items = pending.map((item, index) => {
    const candidates = Array.isArray(searches[index]) ? searches[index] : [];
    const top = candidates[0];
    const workTokenCount = tokens(item.workTitle.en || item.workTitle.ko).length;
    const requiredWorkMatches = Math.min(2, Math.max(1, workTokenCount));
    const confident = Boolean(top && !top.derivative && top.artistMatches >= 1 && (top.exactWork || top.workMatches >= requiredWorkMatches));
    const extension = top ? extensionFor(top.mime, top.fileTitle) : '.jpg';
    return {
      ...item,
      targetPath: canonicalArtworkPath(
        {id: item.artistId, name: item.artistName},
        {id: item.workId, title: item.workTitle, year: item.year},
        extension
      ),
      reviewStatus: confident ? 'candidate' : 'unresolved',
      selected: confident ? top : null,
      candidates: candidates.slice(0, 3),
      ...(searches[index]?.error ? {error: searches[index].error} : {})
    };
  });

  const manifest = {
    schema: 1,
    scope: 'user-approved-temporary-artist-work-image-download',
    sourceSite: 'Wikimedia Commons',
    sourceApi: commonsApi,
    generatedAt: new Date().toISOString(),
    policy: '전체 화가 작품 중 로컬 이미지가 없는 작품을 대상으로 하며, Commons 후보에서 작가명과 작품명이 충분히 일치한 candidate만 다운로드한다.',
    counts: {
      pending: items.length,
      candidates: items.filter(item => item.reviewStatus === 'candidate').length,
      unresolved: items.filter(item => item.reviewStatus === 'unresolved').length,
      skippedNoSearchTokens: scopedMissingWorks.length - pending.length,
      totalMissingLocalImages: missingWorks.length,
      scopedToPendingUploadOnly: pendingUploadOnly,
      scopedToExcludePendingUpload: excludePendingUpload
    },
    items
  };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(manifest.counts, null, 2));
  console.log(path.relative(root, manifestFile).replace(/\\/g, '/'));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
