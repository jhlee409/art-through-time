const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const artistsPath = path.join(root, 'data', 'artists.json');
const reportPath = path.join(root, 'data', 'external-image-localization-report.json');
const maxRedirects = 6;
const timeoutMs = 45000;
const concurrency = Number(process.argv.find(arg => arg.startsWith('--concurrency='))?.split('=')[1] || 4);
const limit = Number(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || 0);
const delayMs = Number(process.argv.find(arg => arg.startsWith('--delay-ms='))?.split('=')[1] || 0);
const dryRun = process.argv.includes('--dry-run');

function isExternal(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function thumbnailUrl(url, width = 1200) {
  if (!url) return url;
  const parsed = new URL(url);
  if (parsed.hostname === 'commons.wikimedia.org' || parsed.hostname === 'upload.wikimedia.org') parsed.protocol = 'https:';
  url = parsed.href;
  if (url.includes('/thumb/')) return url;
  if (url.includes('commons.wikimedia.org/wiki/Special:FilePath/')) {
    const name = decodeURIComponent(parsed.pathname.split('/Special:FilePath/')[1] || '').replace(/ /g, '_');
    if (name) {
      const hash = crypto.createHash('md5').update(name).digest('hex');
      const encodedName = encodeURIComponent(name).replace(/%2F/gi, '/');
      const lower = name.toLowerCase();
      const renderedName = /\.(?:tif|tiff|svg|pdf)$/i.test(lower)
        ? `${width}px-${encodedName}.${/\.svg$/i.test(lower) ? 'png' : 'jpg'}`
        : `${width}px-${encodedName}`;
      return `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.slice(0, 2)}/${encodedName}/${renderedName}`;
    }
    parsed.searchParams.set('width', String(width));
    return parsed.href;
  }
  const match = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/(.+)\/([^/]+)$/);
  if (!match) return url;
  const [, repository, directories, fileName] = match;
  return `${repository}/thumb/${directories}/${fileName}/${width}px-${fileName}`;
}

function safeSegment(value, fallback = 'image') {
  return String(value || fallback)
    .normalize('NFKC')
    .replace(/[^0-9A-Za-z가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110) || fallback;
}

function extensionFrom(contentType, url) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/pjpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  const ext = path.extname(new URL(url).pathname).toLowerCase().replace(/^\./, '');
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return 'jpg';
}

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.get(parsed, {
      headers: {
        'User-Agent': 'Art-through-Time-localizer/1.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: timeoutMs
    }, response => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && location) {
        response.resume();
        if (redirects >= maxRedirects) return reject(new Error('Too many redirects'));
        return resolve(get(new URL(location, parsed).href, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: response.headers['content-type'] || '',
        finalUrl: parsed.href
      }));
    });
    request.on('timeout', () => request.destroy(new Error('Download timeout')));
    request.on('error', reject);
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await get(url);
    } catch (error) {
      lastError = error;
      if (!/HTTP 429|timeout|ECONNRESET|EAI_AGAIN|ENOTFOUND/i.test(error.message) || attempt === 3) break;
      await wait((attempt + 1) * 2500);
    }
  }
  throw lastError;
}

function displaySource(work) {
  const local = [work.thumbnail, work.image, work.highResImage].find(value => value && !isExternal(value));
  if (local) return '';
  return [work.thumbnail, work.image, work.highResImage, work.highResOriginal].find(isExternal) || '';
}

function collectTargets(payload) {
  const targets = [];
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      const source = displaySource(work);
      if (!source) continue;
      targets.push({artist, work, source});
    }
  }
  return limit > 0 ? targets.slice(0, limit) : targets;
}

async function processTarget(target) {
  const {artist, work, source} = target;
  const downloadUrl = thumbnailUrl(source);
  const artistId = safeSegment(artist.id || artist.qid || artist.name?.en || artist.name?.ko, 'artist');
  const workId = safeSegment(work.id || work.title?.en || work.title?.ko, 'work');
  try {
    if (dryRun) {
      return {status:'dry-run', artist:artist.name?.ko || artist.name?.en || artist.id, work:work.title?.ko || work.title?.en || work.id, source, downloadUrl};
    }
    const result = await getWithRetry(downloadUrl);
    if (!/^image\//i.test(result.contentType)) throw new Error(`Not an image: ${result.contentType || 'unknown content type'}`);
    if (result.buffer.length < 512) throw new Error(`Image response too small: ${result.buffer.length} bytes`);
    const ext = extensionFrom(result.contentType, result.finalUrl);
    const folder = path.join(root, 'data', 'thumbnails', artistId);
    const fileName = `${workId}.${ext}`;
    const localPath = path.join(folder, fileName);
    const localRef = path.relative(root, localPath).replace(/\\/g, '/');
    await fs.mkdir(folder, {recursive:true});
    await fs.writeFile(localPath, result.buffer);

    const previousExternalUrls = [work.thumbnail, work.image, work.highResImage, work.highResOriginal]
      .filter(isExternal)
      .filter((value, index, values) => values.indexOf(value) === index);
    if (previousExternalUrls.length) {
      work.externalImageUrls = [...new Set([...(work.externalImageUrls || []), ...previousExternalUrls])];
    }
    work.thumbnail = localRef;
    work.image = localRef;
    work.highResImage = localRef;
    work.highResOriginal = localRef;
    work.thumbnailValidation = 2;
    work.thumbnailCacheKey = new Date().toISOString();
    work.migration = work.migration || {};
    work.migration.image = {
      ...(work.migration.image || {}),
      status: 'ready',
      localThumbnail: localRef,
      highResolution: localRef,
      sourceUrls: [...new Set([...(work.migration.image?.sourceUrls || []), ...previousExternalUrls])]
    };
    return {
      status:'localized',
      artist:artist.name?.ko || artist.name?.en || artist.id,
      work:work.title?.ko || work.title?.en || work.id,
      source,
      local:localRef,
      bytes:result.buffer.length
    };
  } catch (error) {
    return {
      status:'failed',
      artist:artist.name?.ko || artist.name?.en || artist.id,
      work:work.title?.ko || work.title?.en || work.id,
      source,
      downloadUrl,
      error:error.message
    };
  }
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function next() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
      if (delayMs > 0) await wait(delayMs);
      const done = results.filter(Boolean).length;
      if (done % 10 === 0 || done === items.length) {
        const ok = results.filter(item => item?.status === 'localized').length;
        const failed = results.filter(item => item?.status === 'failed').length;
        console.log(`progress ${done}/${items.length} localized=${ok} failed=${failed}`);
      }
    }
  }
  await Promise.all(Array.from({length: Math.max(1, concurrency)}, next));
  return results;
}

async function main() {
  const payload = JSON.parse(await fs.readFile(artistsPath, 'utf8'));
  const targets = collectTargets(payload);
  const startedAt = new Date().toISOString();
  const results = await runPool(targets, processTarget);
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun,
    total: targets.length,
    localized: results.filter(item => item.status === 'localized').length,
    failed: results.filter(item => item.status === 'failed').length,
    failures: results.filter(item => item.status === 'failed')
  };
  if (!dryRun) {
    payload.metadata = {
      ...(payload.metadata || {}),
      updatedAt: summary.finishedAt,
      updatedBy: 'external image localization',
      revision: Number(payload.metadata?.revision || 0) + (summary.localized ? 1 : 0)
    };
    await fs.writeFile(artistsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fs.writeFile(reportPath, `${JSON.stringify({summary, results}, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
