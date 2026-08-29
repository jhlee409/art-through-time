#!/usr/bin/env node
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const {createHash} = require('node:crypto');
const {requireUrlFileDownloadApproval} = require('./url-download-permission');
const {cleanLocalImagePath, existingLocalPathForWork} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const imagesRoot = path.join(root, 'data', 'images');
const generatedDir = path.join(root, 'data', 'generated');
const inventoryFile = path.join(generatedDir, 'unlinked-timeline-image-inventory.json');
const matchFile = path.join(generatedDir, 'unlinked-timeline-image-matches.json');
const temporaryDir = path.join(generatedDir, 'tmp-image-match-references');
const imageExtensionPattern = /\.(?:jpe?g|png|webp|gif)$/i;
const imageUrlPattern = /(?:special:filepath|special:redirect\/file|upload\.wikimedia|commons\.wikimedia\.org\/wiki\/file:|\.(?:jpe?g|png|webp|gif)(?:[?#/]|$))/i;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function text(value) {
  if (value && typeof value === 'object') return String(value.ko || value.en || '');
  return String(value || '');
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function absoluteLocal(value) {
  const clean = cleanLocalImagePath(value).replace(/^data\/thumbnails\//, 'data/images/');
  return clean ? path.resolve(root, clean) : '';
}

function workLocalValues(work) {
  return [
    work?.localImage,
    work?.thumbnail,
    work?.image,
    work?.highResImage,
    work?.highResOriginal,
    work?.migration?.image?.localThumbnail,
    work?.migration?.image?.highResolution
  ].map(absoluteLocal).filter(Boolean);
}

function walkImageFiles(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walkImageFiles(file));
    else if (entry.isFile() && imageExtensionPattern.test(entry.name)) output.push(file);
  }
  return output;
}

function sourceValues(work) {
  return [
    work?.image,
    work?.offlineThumbnailSource,
    work?.migration?.image?.sourceUrl,
    ...(work?.migration?.image?.sourceUrls || [])
  ].flatMap(value => String(value || '').match(/https?:\/\/[^;\s]+/gi) || [])
    .filter(value => imageUrlPattern.test(value));
}

function qidFromWork(work) {
  return String(work?.id || '').match(/(?:^|-)Q\d+$/i)?.[0].replace(/^-/, '').toUpperCase()
    || String(work?.source || '').match(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/i)?.[1].toUpperCase()
    || '';
}

function referenceUrl(value) {
  const raw = String(value || '').replace(/&amp;/g, '&').trim();
  if (!raw) return '';
  const commonsFile = raw.match(/commons\.wikimedia\.org\/wiki\/File:([^?#;]+)/i)?.[1];
  if (commonsFile) {
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(decodeURIComponent(commonsFile))}?width=512`;
  }
  if (/special:(?:filepath|redirect\/file)/i.test(raw)) {
    const url = new URL(raw.replace(/^http:/i, 'https:'));
    url.searchParams.set('width', '512');
    return url.href;
  }
  if (/upload\.wikimedia\.org/i.test(raw)) return raw.replace(/^http:/i, 'https:');
  return raw;
}

function buildInventory(payload) {
  const visibleReferences = new Map();
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      const visibleByDate = !work.year
        || ((!artist.birth || work.year >= artist.birth) && (!artist.death || work.year <= artist.death));
      if (!visibleByDate) continue;
      for (const file of workLocalValues(work)) {
        const key = file.toLowerCase();
        visibleReferences.set(key, [...(visibleReferences.get(key) || []), `${artist.id}|${work.id}`]);
      }
    }
  }
  const unlinked = walkImageFiles(imagesRoot)
    .filter(file => !file.toLowerCase().includes(`${path.sep}_placeholder${path.sep}`))
    .filter(file => !visibleReferences.has(file.toLowerCase()))
    .map(file => ({
      path: relative(file),
      folder: path.relative(imagesRoot, file).split(path.sep)[0],
      bytes: fs.statSync(file).size
    }));
  const missing = [];
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      if (existingLocalPathForWork(work, artist.id)) continue;
      const sources = sourceValues(work);
      missing.push({
        key: `${artist.id}|${work.id}`,
        artistId: artist.id,
        artist: text(artist.name) || artist.id,
        workId: work.id,
        title: text(work.title) || work.id,
        englishTitle: work.title?.en || '',
        year: work.year || null,
        qid: qidFromWork(work),
        sourceUrls: sources,
        referenceUrl: referenceUrl(sources[0] || '')
      });
    }
  }
  return {createdAt: new Date().toISOString(), unlinked, missing};
}

function getJson(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {headers: {'User-Agent': 'ArtThroughTime/1.0 local image matching'}}, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        if (response.statusCode === 200) {
          try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
          return;
        }
        if ((response.statusCode === 429 || response.statusCode >= 500) && attempt < 5) {
          delay(1500 * (attempt + 1)).then(() => getJson(url, attempt + 1)).then(resolve, reject);
          return;
        }
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
      });
    });
    request.setTimeout(20000, () => request.destroy(new Error('request timed out')));
    request.on('error', reject);
  });
}

async function addWikidataReferences(inventory) {
  const targets = inventory.missing.filter(item => !item.referenceUrl && item.qid);
  for (let index = 0; index < targets.length; index += 40) {
    const batch = targets.slice(index, index + 40);
    const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      props: 'claims',
      ids: batch.map(item => item.qid).join('|')
    })}`;
    const entities = (await getJson(url)).entities || {};
    for (const item of batch) {
      const filename = entities[item.qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!filename) continue;
      item.referenceUrl = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=512`;
      item.referenceSource = 'Wikidata P18';
    }
    await delay(300);
  }
}

function commonsFilename(value) {
  try {
    const url = new URL(String(value || ''));
    const decoded = decodeURIComponent(url.pathname);
    const special = decoded.match(/Special:(?:FilePath|Redirect\/file)\/(.+)$/i)?.[1];
    if (special) return special;
    const page = decoded.match(/\/wiki\/File:(.+)$/i)?.[1];
    if (page) return page;
  } catch (_) {
    return '';
  }
  return '';
}

async function addCommonsThumbnailUrls(inventory) {
  const targets = inventory.missing
    .map(item => ({item, filename: commonsFilename(item.referenceUrl)}))
    .filter(value => value.filename);
  for (let index = 0; index < targets.length; index += 25) {
    const batch = targets.slice(index, index + 25);
    const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '512',
      titles: batch.map(value => `File:${value.filename}`).join('|')
    })}`;
    const pages = Object.values((await getJson(url)).query?.pages || {});
    const byTitle = new Map(pages.map(page => [String(page.title || '').replace(/^File:/i, '').replace(/_/g, ' '), page]));
    for (const value of batch) {
      const page = byTitle.get(value.filename.replace(/_/g, ' '));
      const imageInfo = page?.imageinfo?.[0];
      const thumbnailUrl = imageInfo?.thumburl || imageInfo?.url || '';
      if (thumbnailUrl) value.item.referenceUrl = thumbnailUrl;
    }
    await delay(700);
  }
}

function extensionFromType(type) {
  if (/png/i.test(type)) return '.png';
  if (/webp/i.test(type)) return '.webp';
  if (/gif/i.test(type)) return '.gif';
  return '.jpg';
}

function downloadImage(url, baseFile, redirectCount = 0, attempt = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {headers: {
      'User-Agent': 'ArtThroughTime/1.0 temporary low-resolution comparison',
      'Referer': 'https://commons.wikimedia.org/',
      'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8'
    }}, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirectCount < 8) {
        response.resume();
        downloadImage(new URL(response.headers.location, url).href, baseFile, redirectCount + 1, attempt).then(resolve, reject);
        return;
      }
      if (response.statusCode === 429 && attempt < 5) {
        response.resume();
        delay(5000 * (attempt + 1)).then(() => downloadImage(url, baseFile, redirectCount, attempt + 1)).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const type = String(response.headers['content-type'] || '');
      if (!/^image\//i.test(type)) {
        response.resume();
        reject(new Error(`unexpected content type: ${type || 'unknown'}`));
        return;
      }
      const chunks = [];
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 8 * 1024 * 1024) request.destroy(new Error('comparison image exceeds 8 MB'));
        else chunks.push(chunk);
      });
      response.on('end', async () => {
        try {
          const file = `${baseFile}${extensionFromType(type)}`;
          await fsp.writeFile(file, Buffer.concat(chunks));
          resolve(file);
        } catch (error) { reject(error); }
      });
    });
    request.setTimeout(30000, () => request.destroy(new Error('request timed out')));
    request.on('error', reject);
  });
}

async function downloadReferences(inventory) {
  requireUrlFileDownloadApproval({purpose: 'Temporary low-resolution reference images for matching 279 local files to 237 hidden timeline works'});
  await fsp.mkdir(temporaryDir, {recursive: true});
  const failures = [];
  for (let index = 0; index < inventory.missing.length; index += 1) {
    const item = inventory.missing[index];
    if (!item.referenceUrl) continue;
    const token = createHash('sha1').update(item.key).digest('hex').slice(0, 16);
    const existing = fs.readdirSync(temporaryDir).find(name => name.startsWith(`${token}.`));
    if (existing) {
      item.referenceFile = relative(path.join(temporaryDir, existing));
      continue;
    }
    try {
      const file = await downloadImage(item.referenceUrl, path.join(temporaryDir, token));
      item.referenceFile = relative(file);
    } catch (error) {
      failures.push({key: item.key, url: item.referenceUrl, error: error.message});
    }
    if ((index + 1) % 20 === 0) console.log(`reference progress ${index + 1}/${inventory.missing.length}`);
    await delay(900);
  }
  inventory.downloadFailures = failures;
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

function applyMatches(payload) {
  const report = readJson(matchFile);
  const confirmed = report.confirmed || [];
  const byWork = new Map(confirmed.map(item => [item.key, item]));
  const applied = [];
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      const item = byWork.get(`${artist.id}|${work.id}`);
      if (!item || existingLocalPathForWork(work, artist.id)) continue;
      markReady(work, item.localPath);
      applied.push(item);
    }
  }
  if (applied.length) writeJson(artistsFile, payload);
  if (applied.length && fs.existsSync(representativesFile)) {
    const representatives = readJson(representativesFile);
    const map = new Map(applied.map(item => [item.key, item.localPath]));
    const rows = [
      ...(representatives.categories || []).map(item => ({artist: item.artist, work: item.work})),
      ...(representatives.furtherArtists || []).flatMap(item => (item.artists || []).map(value => ({artist: value.artist, work: value.work})))
    ];
    let changed = false;
    for (const row of rows) {
      const localPath = map.get(`${row.artist?.id}|${row.work?.id}`);
      if (!localPath) continue;
      row.work.localImage = localPath;
      row.work.thumbnail = localPath;
      row.work.imageStatus = 'ready';
      changed = true;
    }
    if (changed) writeJson(representativesFile, representatives);
  }
  return applied;
}

async function main() {
  const payload = readJson(artistsFile);
  if (process.argv.includes('--apply')) {
    const applied = applyMatches(payload);
    console.log(JSON.stringify({applied: applied.length, items: applied}, null, 2));
    return;
  }
  const inventory = buildInventory(payload);
  const downloadRequested = process.argv.includes('--download-references');
  const resolveRequested = downloadRequested || process.argv.includes('--resolve-references');
  if (resolveRequested) {
    await addWikidataReferences(inventory);
    await addCommonsThumbnailUrls(inventory);
  }
  if (downloadRequested) {
    await downloadReferences(inventory);
  }
  writeJson(inventoryFile, inventory);
  console.log(JSON.stringify({
    unlinked: inventory.unlinked.length,
    missing: inventory.missing.length,
    references: inventory.missing.filter(item => item.referenceUrl).length,
    downloaded: inventory.missing.filter(item => item.referenceFile).length,
    failures: inventory.downloadFailures?.length || 0,
    inventory: relative(inventoryFile),
    temporaryDirectory: relative(temporaryDir)
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
