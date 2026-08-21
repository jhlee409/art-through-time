const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const { invalidArtworkThumbnail } = require('../thumbnail-validation');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const thumbnailsDir = path.join(root, 'data', 'thumbnails');
const width = Number(process.env.ART_ATLAS_THUMBNAIL_WIDTH || 640);
const limit = Number(process.env.ART_ATLAS_THUMBNAIL_CACHE_LIMIT || 0);
const perArtistDownloadLimit = Number(process.env.ART_ATLAS_THUMBNAIL_PER_ARTIST_LIMIT ?? 20);
const localizeOnly = process.env.ART_ATLAS_LOCALIZE_ONLY === '1';
const skipPreviousFailures = process.env.ART_ATLAS_SKIP_FAILURES === '1';
const retryAttempts = Number(process.env.ART_ATLAS_THUMBNAIL_RETRIES || 1);
const onlyArtistId = String(process.env.ART_ATLAS_ARTIST_ID || '').trim();
const refreshExisting = process.env.ART_ATLAS_REFRESH === '1';
const externalOnly = process.env.ART_ATLAS_EXTERNAL_ONLY === '1';
const offlineArtworkPlaceholder = 'data/thumbnails/_placeholder/artwork-placeholder.png';

const contentExtensions = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isExternal = value => /^https?:\/\//i.test(String(value || ''));
const isLocal = value => value && !isExternal(value);
const isPlaceholder = value => String(value || '') === offlineArtworkPlaceholder;
const workPopularity = work => Number.isFinite(Number(work?.popularity)) ? Number(work.popularity) : 0;
const workYearForSort = work => {
  const value = String(work?.year ?? '').trim();
  const year = Number(value);
  return value && Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
};

function thumbnailDownloadScore(work, featuredWorkIds = new Set()) {
  let score = workPopularity(work);
  if (work?.representative) score += 100000;
  if (work?.movementContribution) score += 50000;
  if (featuredWorkIds.has(String(work?.id || ''))) score += 40000;
  if (work?.image || work?.thumbnail || work?.offlineThumbnailSource) score += 1200;
  if (work?.verified) score += 600;
  if (work?.description?.ko || work?.description?.en) score += 120;
  return score;
}

function prioritizedWorksForDownload(artist) {
  const works = [...(artist.works || [])].filter(work => String(work.id || ''));
  const featuredWorkIds = new Set(Array.isArray(artist?.featuredWorkIds) ? artist.featuredWorkIds.map(String) : []);
  works.sort((a,b) => thumbnailDownloadScore(b, featuredWorkIds) - thumbnailDownloadScore(a, featuredWorkIds) || workYearForSort(a) - workYearForSort(b));
  return perArtistDownloadLimit > 0 ? works.slice(0, perArtistDownloadLimit) : works;
}

function downloadUrlFor(sourceUrl) {
  const parsed = new URL(sourceUrl.replace(/^http:\/\//i, 'https://'));
  const isSpecialFilePath = (/(^|\.)wikimedia\.org$/i.test(parsed.hostname) || /(^|\.)wikipedia\.org$/i.test(parsed.hostname))
    && /\/wiki\/Special:FilePath\//i.test(parsed.pathname);
  if (isSpecialFilePath && !parsed.searchParams.has('width')) parsed.searchParams.set('width', String(width));
  if (parsed.hostname === 'upload.wikimedia.org' && !parsed.pathname.includes('/thumb/')) return parsed.href;
  return parsed.href;
}

function extensionFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : '';
  } catch (_) {
    return '';
  }
}

function requestBuffer(rawUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(rawUrl);
    const client = parsed.protocol === 'http:' ? http : https;
    const request = client.get(parsed, {
      headers: {'User-Agent': 'ArtAtlasLocal/1.0 (offline thumbnail cache)'}
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects > 8) return reject(new Error(`Too many redirects: ${rawUrl}`));
        return resolve(requestBuffer(new URL(response.headers.location, rawUrl).href, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        const error = new Error(`HTTP ${response.statusCode}: ${rawUrl}`);
        error.statusCode = response.statusCode;
        error.retryAfter = Number(response.headers['retry-after'] || 0);
        return reject(error);
      }
      const chunks = [];
      let size = 0;
      const maxSize = 35 * 1024 * 1024;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxSize) request.destroy(new Error(`Image is larger than ${maxSize} bytes`));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase(),
        finalUrl: response.responseUrl || rawUrl
      }));
    });
    request.setTimeout(60000, () => request.destroy(new Error(`Timed out: ${rawUrl}`)));
    request.on('error', reject);
  });
}

async function requestBufferWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      await sleep(2500);
      return await requestBuffer(url);
    } catch (error) {
      lastError = error;
      if (![429, 500, 502, 503, 504].includes(error.statusCode) || attempt === retryAttempts) break;
      const wait = Math.max(error.retryAfter * 1000, 5000 + attempt * 5000);
      console.error(`retry ${attempt + 1}/${retryAttempts} after ${wait}ms: ${url}`);
      await sleep(wait);
    }
  }
  throw lastError;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (_) { return fallback; }
}

async function exists(file) {
  try { await fs.access(file); return true; }
  catch (_) { return false; }
}

async function findExistingThumbnailFile(artistDir, relativePrefix, workId) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
    const fileName = `${workId}.${ext}`;
    if (await exists(path.join(artistDir, fileName))) return `${relativePrefix}/${fileName}`;
  }
  return '';
}

async function writeIndex(artistDir, index) {
  await fs.mkdir(artistDir, {recursive: true});
  await fs.writeFile(path.join(artistDir, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
}

async function main() {
  const data = await readJson(artistsFile, null);
  if (!data || !Array.isArray(data.artists)) throw new Error('Invalid data/artists.json');

  let attempted = 0;
  let cached = 0;
  let localized = 0;
  let missing = 0;
  const failures = [];
  const previousFailureKeys = new Set();
  if (skipPreviousFailures) {
    const previousFailures = await readJson(path.join(thumbnailsDir, 'failures.json'), {failures: []});
    for (const item of previousFailures.failures || []) previousFailureKeys.add(`${item.artistId}:${item.workId}`);
  }

  for (const artist of data.artists) {
    const artistId = String(artist.id || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!artistId) continue;
    if (onlyArtistId && artistId !== onlyArtistId) continue;
    const artistDir = path.join(thumbnailsDir, artistId);
    const relativePrefix = `data/thumbnails/${artistId}`;
    const indexPath = path.join(artistDir, 'index.json');
    const index = await readJson(indexPath, {});
    let indexChanged = false;
    const downloadableWorkIds = new Set(prioritizedWorksForDownload(artist).map(work => String(work.id || '')));

    for (const work of artist.works || []) {
      const workId = String(work.id || '');
      if (externalOnly && !isExternal(work.thumbnail)) continue;
      const indexed = index[workId]?.thumbnail;
      if (!refreshExisting && isLocal(indexed) && !isPlaceholder(indexed) && await exists(path.join(root, indexed))) {
        if (work.thumbnail !== indexed || work.thumbnailValidation !== 2) {
          work.thumbnail = indexed;
          work.thumbnailValidation = 2;
          localized++;
        }
        continue;
      }
      if (!refreshExisting && isLocal(work.thumbnail) && !isPlaceholder(work.thumbnail) && await exists(path.join(root, work.thumbnail))) {
        index[workId] = {...(index[workId] || {}), thumbnail: work.thumbnail, checkedAt: new Date().toISOString(), verifiedBy: 'Existing local thumbnail'};
        work.thumbnailValidation = 2;
        indexChanged = true;
        localized++;
        continue;
      }
      const existingFile = refreshExisting ? '' : await findExistingThumbnailFile(artistDir, relativePrefix, workId);
      if (existingFile) {
        index[workId] = {...(index[workId] || {}), thumbnail: existingFile, checkedAt: new Date().toISOString(), verifiedBy: 'Existing thumbnail file'};
        work.thumbnail = existingFile;
        work.thumbnailValidation = 2;
        indexChanged = true;
        localized++;
        continue;
      }
      if (!downloadableWorkIds.has(workId)) continue;

      const source = isExternal(work.offlineThumbnailSource) ? work.offlineThumbnailSource : (isExternal(work.image) ? work.image : (isExternal(work.thumbnail) ? work.thumbnail : ''));
      if (!source) {
        missing++;
        continue;
      }
      if (previousFailureKeys.has(`${artistId}:${workId}`)) continue;
      if (localizeOnly) continue;
      if (limit && attempted >= limit) continue;
      attempted++;

      try {
        const downloadUrl = downloadUrlFor(source);
        const downloaded = await requestBufferWithRetry(downloadUrl);
        if (invalidArtworkThumbnail(downloaded.buffer)) {
          throw new Error('Downloaded thumbnail is a small interface icon');
        }
        const ext = contentExtensions[downloaded.contentType] || extensionFromUrl(downloaded.finalUrl) || extensionFromUrl(source) || 'jpg';
        const fileName = `${workId}.${ext}`;
        const relative = `${relativePrefix}/${fileName}`;
        await fs.mkdir(artistDir, {recursive: true});
        await fs.writeFile(path.join(artistDir, fileName), downloaded.buffer);
        index[workId] = {
          thumbnail: relative,
          source,
          downloadUrl,
          finalUrl: downloaded.finalUrl,
          contentType: downloaded.contentType,
          bytes: downloaded.buffer.length,
          checkedAt: new Date().toISOString(),
          verifiedBy: 'Artwork image cached for offline use'
        };
        work.thumbnail = relative;
        work.thumbnailValidation = 2;
        indexChanged = true;
        cached++;
        await writeIndex(artistDir, index);
        await fs.writeFile(artistsFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`cached ${relative}`);
      } catch (error) {
        failures.push({artistId, workId, title: work.title?.ko || work.title?.en || '', source, error: error.message});
        console.error(`failed ${artistId}/${workId}: ${error.message}`);
      }
    }

    if (indexChanged) await writeIndex(artistDir, index);
  }

  await fs.writeFile(artistsFile, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({attempted, cached, localized, missing, failures: failures.length}, null, 2));
  if (failures.length) {
    await fs.writeFile(path.join(thumbnailsDir, 'failures.json'), JSON.stringify({createdAt: new Date().toISOString(), failures}, null, 2) + '\n', 'utf8');
    process.exitCode = 2;
  } else {
    await fs.unlink(path.join(thumbnailsDir, 'failures.json')).catch(() => {});
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
