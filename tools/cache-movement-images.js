const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');
const imageDir = path.join(movementDir, 'images');
const manifestPath = path.join(imageDir, 'index.json');
const imageSrcPattern = /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi;

const contentExtensions = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
};

function hash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}

function safeSlug(value) {
  return String(value || 'image')
    .replace(/\?.*$/, '')
    .replace(/%20/g, ' ')
    .replace(/%2C/gi, ',')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .split('/')
    .pop()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'image';
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : '';
}

function downloadUrlFor(sourceUrl) {
  const parsed = new URL(sourceUrl);
  const isWikimediaFilePath = /(^|\.)wikimedia\.org$/i.test(parsed.hostname) && /\/wiki\/Special:FilePath\//i.test(parsed.pathname);
  const isWikipediaFilePath = /(^|\.)wikipedia\.org$/i.test(parsed.hostname) && /\/wiki\/Special:FilePath\//i.test(parsed.pathname);
  if (isWikimediaFilePath || isWikipediaFilePath) parsed.searchParams.set('width', '640');
  return parsed.href;
}

function requestBuffer(rawUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(rawUrl);
    const client = parsed.protocol === 'http:' ? http : https;
    const request = client.get(parsed, {
      headers: {'User-Agent': 'ArtAtlasLocalImageCache/1.0'}
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
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase(),
        finalUrl: response.responseUrl || rawUrl
      }));
    });
    request.setTimeout(45000, () => request.destroy(new Error(`Timed out: ${rawUrl}`)));
    request.on('error', reject);
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function requestBufferWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await requestBuffer(url);
    } catch (error) {
      lastError = error;
      if (![429, 500, 502, 503, 504].includes(error.statusCode) || attempt === 1) break;
      const wait = Math.max(error.retryAfter * 1000, 4000 + attempt * 3000);
      console.error(`retry ${attempt + 1}/1 after ${wait}ms: ${url}`);
      await sleep(wait);
    }
  }
  throw lastError;
}

async function readManifest() {
  try { return JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
  catch (_) { return {schema: 1, cachedAt: null, images: {}}; }
}

async function main() {
  await fs.mkdir(imageDir, {recursive: true});
  const manifest = await readManifest();
  manifest.images = manifest.images || {};
  const htmlFiles = (await fs.readdir(movementDir)).filter(file => file.endsWith('.html'));
  const externalUrls = new Set();

  for (const file of htmlFiles) {
    const html = await fs.readFile(path.join(movementDir, file), 'utf8');
    for (const match of html.matchAll(imageSrcPattern)) {
      if (/^https?:\/\//i.test(match[2])) externalUrls.add(match[2]);
    }
  }

  const activeFailures = (manifest.failures || []).filter(item => item?.url && externalUrls.has(item.url));
  manifest.failures = activeFailures;

  if (process.env.ART_ATLAS_REWRITE_ONLY === '1') {
    await rewriteHtmlFiles(htmlFiles, manifest);
    manifest.cachedAt = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({rewritten: true, cachedImages: Object.keys(manifest.images).length}, null, 2));
    return;
  }

  const previousFailures = new Map(activeFailures.map(item => [item.url, item.error || '']));
  const failureMap = new Map(previousFailures);
  const limit = Number(process.env.ART_ATLAS_IMAGE_CACHE_LIMIT || 0);
  let attempted = 0;
  for (const url of externalUrls) {
    if (manifest.images[url]?.local && await exists(path.join(movementDir, manifest.images[url].local))) continue;
    if (/HTTP 404/.test(previousFailures.get(url) || '')) continue;
    if (limit && attempted >= limit) break;
    attempted++;
    try {
      await sleep(900);
      const downloadUrl = downloadUrlFor(url);
      const downloaded = await requestBufferWithRetry(downloadUrl);
      const ext = contentExtensions[downloaded.contentType] || extensionFromUrl(downloaded.finalUrl) || extensionFromUrl(url) || 'jpg';
      const local = `images/${safeSlug(url)}-${hash(url)}.${ext}`;
      await fs.writeFile(path.join(movementDir, local), downloaded.buffer);
      manifest.images[url] = {
        local,
        source: url,
        downloadUrl,
        finalUrl: downloaded.finalUrl,
        contentType: downloaded.contentType,
        bytes: downloaded.buffer.length,
        cachedAt: new Date().toISOString()
      };
      failureMap.delete(url);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      console.log(`cached ${local}`);
    } catch (error) {
      failureMap.set(url, error.message);
      console.error(`failed ${url}: ${error.message}`);
    }
  }

  await rewriteHtmlFiles(htmlFiles, manifest);

  manifest.cachedAt = new Date().toISOString();
  manifest.failures = [...failureMap.entries()].filter(([url]) => externalUrls.has(url)).map(([url, error]) => ({url, error}));
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    uniqueExternalUrls: externalUrls.size,
    cachedImages: Object.keys(manifest.images).length,
    attempted,
    failures: manifest.failures.length
  }, null, 2));

  if (manifest.failures.length) process.exitCode = 2;
}

async function rewriteHtmlFiles(htmlFiles, manifest) {
  for (const file of htmlFiles) {
    const filePath = path.join(movementDir, file);
    const html = await fs.readFile(filePath, 'utf8');
    const updated = html.replace(imageSrcPattern, (full, before, src, after) => {
      const local = manifest.images[src]?.local;
      return local ? `${before}${local}${after}` : full;
    });
    if (updated !== html) await fs.writeFile(filePath, updated, 'utf8');
  }
}

async function exists(file) {
  try { await fs.access(file); return true; }
  catch (_) { return false; }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
