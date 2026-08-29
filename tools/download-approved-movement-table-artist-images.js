#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {requireUrlFileDownloadApproval} = require('./url-download-permission');
const {existingLocalPathForWork, resolveExistingLocalImagePath, canonicalArtworkPath} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const manifestFile = path.join(root, 'data', 'movement-table-artist-image-download-manifest.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const maxBytes = 15 * 1024 * 1024;

requireUrlFileDownloadApproval({
  purpose: 'Download the one-time user-approved Wikimedia Commons images for movement country-development table artists.',
  url: 'https://upload.wikimedia.org/'
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function representativeWorkMap(representatives) {
  const entries = [];
  for (const category of representatives.categories || []) {
    if (category.artist && category.work) entries.push([`${category.artist.id}|${category.work.id}`, category.work]);
  }
  for (const category of representatives.furtherArtists || []) {
    for (const item of category.artists || []) {
      if (item.artist && item.work) entries.push([`${item.artist.id}|${item.work.id}`, item.work]);
    }
  }
  return new Map(entries);
}

function approvedDownloadUrl(item) {
  const raw = item.selected?.downloadUrl;
  if (!raw) throw new Error(`${item.artistId}: missing selected download URL`);
  const url = new URL(raw);
  const approvedHost = url.hostname === 'upload.wikimedia.org'
    || (url.hostname === 'commons.wikimedia.org' && url.pathname.startsWith('/wiki/Special:Redirect/file/'));
  if (url.protocol !== 'https:' || !approvedHost) {
    throw new Error(`${item.artistId}: unapproved image host ${url.hostname}`);
  }
  return url;
}

async function fetchImage(url, artistId) {
  let response;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(url, {
      headers: {'User-Agent': 'ArtThroughTime/0.1 (one-time user-approved educational image download)'},
      signal: AbortSignal.timeout(30000)
    });
    if (response.status !== 429) break;
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    const waitMs = Math.min(30000, Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  if (!response.ok) throw new Error(`${artistId}: image download ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`${artistId}: expected image response, got ${contentType}`);
  const declaredBytes = Number(response.headers.get('content-length') || 0);
  if (declaredBytes > maxBytes) throw new Error(`${artistId}: image exceeds ${maxBytes} bytes`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > maxBytes) throw new Error(`${artistId}: invalid image size ${buffer.length}`);
  return buffer;
}

async function main() {
  const manifest = readJson(manifestFile);
  const representatives = readJson(representativesFile);
  const workMap = representativeWorkMap(representatives);
  const approved = (manifest.items || []).filter(item => item.reviewStatus === 'candidate' && item.selected && !item.selected.derivative);
  const results = [];
  const errors = [];

  const persist = () => {
    manifest.counts = {
      pending: manifest.items.length,
      downloaded: manifest.items.filter(item => item.reviewStatus === 'downloaded').length,
      candidates: manifest.items.filter(item => item.reviewStatus === 'candidate').length,
      unresolved: manifest.items.filter(item => item.reviewStatus === 'unresolved').length,
      failed: manifest.items.filter(item => item.reviewStatus === 'failed').length
    };
    writeJson(representativesFile, representatives);
    writeJson(manifestFile, manifest);
  };

  for (const item of approved) {
    try {
      const work = workMap.get(`${item.artistId}|${item.workId}`);
      if (!work) throw new Error(`${item.artistId}: representative work is missing`);
      const canonicalTarget = canonicalArtworkPath(
        {id:item.artistId, name:item.artistName},
        work,
        path.extname(item.targetPath) || '.jpg'
      );
      let localPath = existingLocalPathForWork(work, item.artistId) || resolveExistingLocalImagePath(item.targetPath);
      let absolute = localPath ? path.join(root, localPath) : path.join(root, item.targetPath);
      let buffer;
      if (localPath && fs.existsSync(absolute) && fs.statSync(absolute).size > 0) {
        buffer = fs.readFileSync(absolute);
      } else {
        const url = approvedDownloadUrl(item);
        buffer = await fetchImage(url, item.artistId);
        localPath = canonicalTarget;
        absolute = path.join(root, localPath);
        fs.mkdirSync(path.dirname(absolute), {recursive: true});
        fs.writeFileSync(absolute, buffer);
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
      item.targetPath = localPath;
      work.localImage = localPath;
      work.sourceUrl = item.selected.pageUrl;
      work.sourceUrls = [...new Set([item.selected.pageUrl, item.selected.downloadUrl].filter(Boolean))];
      work.license = item.selected.license || '';
      work.institution = 'Wikimedia Commons';
      item.reviewStatus = 'downloaded';
      item.downloadedAt = new Date().toISOString();
      item.bytes = buffer.length;
      results.push({artistId: item.artistId, workId: item.workId, targetPath: localPath, bytes: buffer.length});
      persist();
      console.log(`downloaded ${item.artistId} (${buffer.length} bytes)`);
    } catch (error) {
      item.reviewStatus = 'failed';
      item.error = error.message;
      errors.push({artistId: item.artistId, workId: item.workId, message: error.message});
      persist();
      console.error(error.message);
    }
  }
  persist();
  console.log(JSON.stringify({downloaded: results.length, failed: errors.length, results, errors}, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
