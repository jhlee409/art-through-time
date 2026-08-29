#!/usr/bin/env node
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {requireUrlFileDownloadApproval} = require('./url-download-permission');
const {cleanLocalImagePath, existingLocalPathForWork} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const imagesRoot = path.join(root, 'data', 'images');
const generatedDir = path.join(root, 'data', 'generated');
const inventoryFile = path.join(generatedDir, 'unlinked-timeline-image-inventory.json');
const matchFile = path.join(generatedDir, 'unlinked-timeline-image-matches.json');
const metadataFile = path.join(generatedDir, 'unlinked-timeline-image-metadata.json');
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

function qidFromValue(value) {
  return String(value || '').match(/(?:^|[^A-Z0-9])(Q\d+)(?:[^0-9]|$)/i)?.[1].toUpperCase() || '';
}

function artworkQidFromFilename(value) {
  return path.basename(String(value || '')).match(/^wikidata-(Q\d+)(?:[._-]|$)/i)?.[1].toUpperCase() || '';
}

function normalized(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
}

function wikimediaFilename(value) {
  const raw = String(value || '').replace(/&amp;/g, '&').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.replace(/^http:/i, 'https:'));
    const decoded = decodeURIComponent(url.pathname);
    const special = decoded.match(/Special:(?:FilePath|Redirect\/file)\/(.+)$/i)?.[1];
    if (special) return special;
    const page = decoded.match(/\/wiki\/File:(.+)$/i)?.[1];
    if (page) return page;
    if (/upload\.wikimedia\.org/i.test(url.hostname)) {
      return path.basename(decoded).replace(/^\d+px-/i, '');
    }
  } catch (_) {
    // A plain filename is handled below.
  }
  return /\.(?:jpe?g|png|webp|gif|tiff?)$/i.test(raw) ? path.basename(raw) : '';
}

function filenameKey(value) {
  return normalized(wikimediaFilename(value).replace(/\.(?:jpe?g|png|webp|gif|tiff?)$/i, ''));
}

function claimIds(entity, property) {
  return [...new Set((entity?.claims?.[property] || [])
    .map(claim => claim?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean))];
}

function claimYear(entity) {
  const time = entity?.claims?.P571?.[0]?.mainsnak?.datavalue?.value?.time || '';
  return Number(String(time).match(/[+-](\d{1,6})-/)?.[1] || 0) || null;
}

function entityMetadata(entity) {
  return {
    qid: entity?.id || '',
    labelKo: entity?.labels?.ko?.value || '',
    labelEn: entity?.labels?.en?.value || '',
    year: claimYear(entity),
    creatorQids: claimIds(entity, 'P170'),
    collectionQids: claimIds(entity, 'P195'),
    imageFilename: entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || ''
  };
}

async function wikidataEntities(qids) {
  const output = {};
  const ids = [...new Set(qids.filter(Boolean))];
  for (let index = 0; index < ids.length; index += 40) {
    const batch = ids.slice(index, index + 40);
    const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      props: 'labels|claims',
      languages: 'ko|en',
      ids: batch.join('|')
    })}`;
    const entities = (await getJson(url)).entities || {};
    for (const [qid, entity] of Object.entries(entities)) output[qid] = entityMetadata(entity);
    if (index + 40 < ids.length) await delay(250);
  }
  return output;
}

function imageIndexes() {
  const byPath = new Map();
  for (const entry of fs.readdirSync(imagesRoot, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const indexFile = path.join(imagesRoot, entry.name, 'index.json');
    if (!fs.existsSync(indexFile)) continue;
    let index;
    try { index = readJson(indexFile); } catch (_) { continue; }
    for (const [workId, value] of Object.entries(index || {})) {
      const localPath = cleanLocalImagePath(value?.thumbnail).replace(/^data\/thumbnails\//, 'data/images/');
      if (!localPath) continue;
      const item = {folder: entry.name, workId, verifiedBy: value?.verifiedBy || '', thumbnail: localPath};
      const key = localPath.toLowerCase();
      byPath.set(key, [...(byPath.get(key) || []), item]);
    }
  }
  return byPath;
}

function originalFilenameFromIndex(value) {
  return String(value || '').match(/(?:^|:\s*)([^:/\\]+\.(?:jpe?g|png|webp|gif|tiff?))$/i)?.[1] || '';
}

function uniqueMetadataMatches(locals, missing) {
  const candidates = [];
  for (const local of locals) {
    const localKeys = new Set([
      filenameKey(local.entity?.imageFilename),
      ...local.indexEntries.map(item => filenameKey(originalFilenameFromIndex(item.verifiedBy))),
      filenameKey(path.basename(local.path))
    ].filter(key => key.length >= 8));
    if (!localKeys.size) continue;
    for (const work of missing) {
      const workKeys = new Set([
        filenameKey(work.entity?.imageFilename),
        ...work.sourceUrls.map(filenameKey)
      ].filter(key => key.length >= 8));
      const shared = [...localKeys].filter(key => workKeys.has(key));
      if (!shared.length) continue;
      candidates.push({
        key: work.key,
        artistId: work.artistId,
        workId: work.workId,
        artist: work.artist,
        title: work.title,
        year: work.year,
        localPath: local.path,
        localQid: local.qid,
        workQid: work.qid,
        reason: 'exact Wikimedia source filename',
        filenameKey: shared[0]
      });
    }
  }
  const localCounts = new Map();
  const workCounts = new Map();
  for (const candidate of candidates) {
    localCounts.set(candidate.localPath, (localCounts.get(candidate.localPath) || 0) + 1);
    workCounts.set(candidate.key, (workCounts.get(candidate.key) || 0) + 1);
  }
  return {
    confirmed: candidates.filter(item => localCounts.get(item.localPath) === 1 && workCounts.get(item.key) === 1),
    ambiguous: candidates.filter(item => localCounts.get(item.localPath) !== 1 || workCounts.get(item.key) !== 1)
  };
}

function historicalPayloads() {
  let commits;
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
    try { payloads.push(JSON.parse(batch.subarray(contentStart, contentEnd).toString('utf8'))); } catch (_) {
      // Ignore malformed historical snapshots.
    }
    offset = contentEnd + 1;
  }
  return payloads;
}

function artistIdentityKeys(artist) {
  return [...new Set([
    artist?.qid ? `qid:${String(artist.qid).toUpperCase()}` : '',
    qidFromValue(artist?.id) ? `qid:${qidFromValue(artist.id)}` : '',
    normalized(text(artist?.name)) ? `name:${normalized(text(artist.name))}` : '',
    normalized(artist?.name?.en) ? `name:${normalized(artist.name.en)}` : '',
    normalized(artist?.fullName) ? `name:${normalized(artist.fullName)}` : ''
  ].filter(Boolean))];
}

function historicalRestorations(locals, payload) {
  const currentArtists = payload.artists || [];
  const currentById = new Map(currentArtists.map(artist => [artist.id, artist]));
  const currentByIdentity = new Map();
  for (const artist of currentArtists) {
    for (const key of artistIdentityKeys(artist)) {
      currentByIdentity.set(key, [...(currentByIdentity.get(key) || []), artist]);
    }
  }
  const currentWorkIds = new Set(currentArtists.flatMap(artist => (artist.works || []).map(work => work.id)));
  const historicalByWorkId = new Map();
  const historicalByPath = new Map();
  for (const historical of historicalPayloads()) {
    for (const artist of historical.artists || []) {
      for (const work of artist.works || []) {
        const candidate = {artist, work};
        if (!historicalByWorkId.has(work.id)) historicalByWorkId.set(work.id, candidate);
        for (const localValue of workLocalValues(work)) {
          const key = relative(localValue).toLowerCase();
          if (!historicalByPath.has(key)) historicalByPath.set(key, candidate);
        }
      }
    }
  }
  const restorations = [];
  const unresolved = [];
  for (const local of locals) {
    const candidateIds = [...new Set([
      ...local.indexEntries.map(item => item.workId),
      local.qid ? `wikidata-${local.qid}` : ''
    ].filter(Boolean))];
    const candidates = [
      historicalByPath.get(local.path.toLowerCase()),
      ...candidateIds.map(id => historicalByWorkId.get(id))
    ].filter(Boolean);
    const unique = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const key = `${candidate.artist.id}|${candidate.work.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(candidate);
    }
    const exact = unique.filter(candidate => {
      const historicalPaths = workLocalValues(candidate.work).map(value => relative(value).toLowerCase());
      return historicalPaths.includes(local.path.toLowerCase()) || candidateIds.includes(candidate.work.id);
    });
    if (exact.length !== 1 || currentWorkIds.has(exact[0]?.work?.id)) {
      unresolved.push({...local, historicalCandidates: exact.map(item => `${item.artist.id}|${item.work.id}`)});
      continue;
    }
    const historicalArtist = exact[0].artist;
    let targets = currentById.has(local.folder) ? [currentById.get(local.folder)] : [];
    if (!targets.length && currentById.has(historicalArtist.id)) targets = [currentById.get(historicalArtist.id)];
    if (!targets.length) {
      const matches = new Map();
      for (const key of artistIdentityKeys(historicalArtist)) {
        for (const artist of currentByIdentity.get(key) || []) matches.set(artist.id, artist);
      }
      targets = [...matches.values()];
    }
    if (targets.length !== 1) {
      unresolved.push({...local, historicalCandidates: exact.map(item => `${item.artist.id}|${item.work.id}`)});
      continue;
    }
    const historicalYear = Number(exact[0].work.year || 0);
    if (historicalYear && ((targets[0].birth && historicalYear < targets[0].birth)
      || (targets[0].death && historicalYear > targets[0].death))) {
      unresolved.push({...local, historicalCandidates: exact.map(item => `${item.artist.id}|${item.work.id}`), reason: 'year outside artist lifespan'});
      continue;
    }
    restorations.push({
      key: `${targets[0].id}|${exact[0].work.id}`,
      artistId: targets[0].id,
      workId: exact[0].work.id,
      artist: text(targets[0].name),
      title: text(exact[0].work.title),
      year: exact[0].work.year || null,
      localPath: local.path,
      historicalArtistId: historicalArtist.id,
      reason: 'exact historical work ID/local path',
      work: exact[0].work
    });
  }
  const workCounts = new Map();
  for (const item of restorations) workCounts.set(item.key, (workCounts.get(item.key) || 0) + 1);
  const confirmed = restorations.filter(item => workCounts.get(item.key) === 1);
  for (const item of restorations.filter(value => workCounts.get(value.key) !== 1)) {
    unresolved.push({...item, historicalCandidates: [item.key], reason: 'multiple local files for one historical work'});
  }
  return {restorations: confirmed, unresolved};
}

function metadataRecreations(locals, payload, excludedPaths) {
  const currentArtists = payload.artists || [];
  const currentById = new Map(currentArtists.map(artist => [artist.id, artist]));
  const currentByQid = new Map();
  for (const artist of currentArtists) {
    for (const qid of [artist.qid, qidFromValue(artist.id)].filter(Boolean)) {
      const key = String(qid).toUpperCase();
      currentByQid.set(key, [...(currentByQid.get(key) || []), artist]);
    }
  }
  const currentWorkIds = new Set(currentArtists.flatMap(artist => (artist.works || []).map(work => work.id)));
  const recreations = [];
  const unresolved = [];
  for (const local of locals) {
    if (excludedPaths.has(local.path)) continue;
    const entity = local.entity;
    const workId = local.qid ? `wikidata-${local.qid}` : '';
    if (!entity || !workId || currentWorkIds.has(workId)) {
      unresolved.push({...local, reason: 'no unique QID metadata record'});
      continue;
    }
    let targets = currentById.has(local.folder) ? [currentById.get(local.folder)] : [];
    if (!targets.length) {
      const matches = new Map();
      for (const creatorQid of entity.creatorQids || []) {
        for (const artist of currentByQid.get(creatorQid) || []) matches.set(artist.id, artist);
      }
      targets = [...matches.values()];
    }
    if (targets.length !== 1) {
      unresolved.push({...local, reason: 'creator does not map to one current artist'});
      continue;
    }
    const artist = targets[0];
    const year = Number(entity.year || 0) || null;
    if (year && ((artist.birth && year < artist.birth) || (artist.death && year > artist.death))) {
      unresolved.push({...local, reason: 'year outside artist lifespan'});
      continue;
    }
    const now = new Date().toISOString();
    const work = {
      id: workId,
      year,
      popularity: 1,
      title: {ko: entity.labelKo || entity.labelEn || local.qid, en: entity.labelEn || entity.labelKo || local.qid},
      country: {ko: '', en: ''},
      movement: {ko: artist.primaryMovement || text(artist.movement), en: artist.primaryMovement || text(artist.movement)},
      image: local.path,
      description: {ko: '', en: ''},
      source: `https://www.wikidata.org/entity/${local.qid}`,
      verified: true,
      representative: false,
      movementContribution: false,
      metadata: {createdAt: now, updatedAt: now, createdBy: 'metadata-recovery', updatedBy: 'metadata-recovery'}
    };
    markReady(work, local.path);
    recreations.push({
      key: `${artist.id}|${workId}`,
      artistId: artist.id,
      workId,
      artist: text(artist.name),
      title: text(work.title),
      year,
      localPath: local.path,
      reason: 'Wikidata QID, creator, and local image metadata',
      work
    });
  }
  return {recreations, unresolved};
}

async function buildMetadataReport(inventory, payload) {
  const indexes = imageIndexes();
  const qids = [
    ...inventory.unlinked.map(item => artworkQidFromFilename(item.path)),
    ...inventory.missing.map(item => item.qid)
  ];
  const entities = await wikidataEntities(qids);
  const artistById = new Map((payload.artists || []).map(artist => [artist.id, artist]));
  const locals = inventory.unlinked.map(item => {
    const qid = artworkQidFromFilename(item.path);
    return {
      ...item,
      qid,
      folderArtist: artistById.has(item.folder) ? {
        id: item.folder,
        qid: artistById.get(item.folder).qid || qidFromValue(item.folder),
        name: text(artistById.get(item.folder).name)
      } : null,
      indexEntries: indexes.get(item.path.toLowerCase()) || [],
      entity: entities[qid] || null
    };
  });
  const missing = inventory.missing.map(item => ({...item, entity: entities[item.qid] || null}));
  const matches = uniqueMetadataMatches(locals, missing);
  const history = historicalRestorations(locals, payload);
  const recreated = metadataRecreations(locals, payload, new Set(history.restorations.map(item => item.localPath)));
  return {
    createdAt: new Date().toISOString(),
    stats: {
      unlinked: locals.length,
      missing: missing.length,
      localQids: locals.filter(item => item.qid).length,
      indexedLocalFiles: locals.filter(item => item.indexEntries.length).length,
      confirmed: matches.confirmed.length,
      ambiguous: matches.ambiguous.length,
      historicalRestorations: history.restorations.length,
      metadataRecreations: recreated.recreations.length,
      unresolvedLocalFiles: recreated.unresolved.length
    },
    confirmed: matches.confirmed,
    ambiguous: matches.ambiguous,
    historicalRestorations: history.restorations,
    metadataRecreations: recreated.recreations,
    unresolvedLocalFiles: recreated.unresolved,
    locals,
    missing
  };
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

function updateImageIndexes(applied) {
  const byArtist = new Map();
  for (const item of applied) byArtist.set(item.artistId, [...(byArtist.get(item.artistId) || []), item]);
  for (const [artistId, items] of byArtist) {
    const indexFile = path.join(imagesRoot, artistId, 'index.json');
    let index = {};
    try { index = readJson(indexFile); } catch (_) { /* A missing index is created below. */ }
    for (const item of items) {
      const absolute = path.resolve(root, item.localPath);
      const imageHash = fs.existsSync(absolute)
        ? createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')
        : '';
      index[item.workId] = {
        thumbnail: item.localPath,
        checkedAt: new Date().toISOString(),
        verifiedBy: `Recovered by metadata: ${item.reason}`,
        imageHash
      };
    }
    writeJson(indexFile, index);
  }
}

function applyMatches(payload, reportFile = matchFile) {
  const report = readJson(reportFile);
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
  if (applied.length) updateImageIndexes(applied);
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

function restoreReportedWorks(payload, includeRecreated = false) {
  const report = readJson(metadataFile);
  const byArtist = new Map((payload.artists || []).map(artist => [artist.id, artist]));
  const restored = [];
  const items = [
    ...(report.historicalRestorations || []),
    ...(includeRecreated ? report.metadataRecreations || [] : [])
  ];
  for (const item of items) {
    const artist = byArtist.get(item.artistId);
    if (!artist || (artist.works || []).some(work => work.id === item.workId)) continue;
    const work = JSON.parse(JSON.stringify(item.work));
    markReady(work, item.localPath);
    artist.works = [...(artist.works || []), work];
    restored.push(item);
  }
  if (restored.length) {
    updateImageIndexes(restored);
    writeJson(artistsFile, payload);
  }
  return restored;
}

function compactRecoveryDiff(payload) {
  const baseline = JSON.parse(execFileSync('git', ['show', 'HEAD:data/artists.json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024
  }));
  const currentByArtist = new Map((payload.artists || []).map(artist => [artist.id, artist]));
  let additions = 0;
  for (const artist of baseline.artists || []) {
    const current = currentByArtist.get(artist.id);
    if (!current) continue;
    const baselineIds = new Set((artist.works || []).map(work => work.id));
    const recovered = (current.works || []).filter(work => !baselineIds.has(work.id));
    artist.works = [...(artist.works || []), ...recovered];
    additions += recovered.length;
  }
  writeJson(artistsFile, baseline);
  return additions;
}

function pruneInvalidMetadataRecovery(payload) {
  const removed = [];
  for (const artist of payload.artists || []) {
    artist.works = (artist.works || []).filter(work => {
      if (work?.metadata?.createdBy !== 'metadata-recovery') return true;
      const localPath = existingLocalPathForWork(work, artist.id) || cleanLocalImagePath(work.thumbnail || work.image);
      const localQid = artworkQidFromFilename(localPath);
      const valid = localQid && work.id === `wikidata-${localQid}`;
      if (!valid) removed.push({artistId: artist.id, workId: work.id, localPath});
      return valid;
    });
  }
  if (!removed.length) return removed;
  writeJson(artistsFile, payload);
  for (const item of removed) {
    const indexFile = path.join(imagesRoot, item.artistId, 'index.json');
    if (!fs.existsSync(indexFile)) continue;
    const index = readJson(indexFile);
    if (String(index[item.workId]?.verifiedBy || '').startsWith('Recovered by metadata:')) {
      delete index[item.workId];
      writeJson(indexFile, index);
    }
  }
  return removed;
}

async function main() {
  const payload = readJson(artistsFile);
  if (process.argv.includes('--metadata')) {
    const inventory = buildInventory(payload);
    writeJson(inventoryFile, inventory);
    const report = await buildMetadataReport(inventory, payload);
    writeJson(metadataFile, report);
    console.log(JSON.stringify({...report.stats, report: relative(metadataFile)}, null, 2));
    return;
  }
  if (process.argv.includes('--apply-metadata')) {
    const applied = applyMatches(payload, metadataFile);
    console.log(JSON.stringify({applied: applied.length, items: applied}, null, 2));
    return;
  }
  if (process.argv.includes('--restore-history')) {
    const restored = restoreReportedWorks(payload);
    console.log(JSON.stringify({restored: restored.length, items: restored.map(item => ({
      key: item.key,
      title: item.title,
      year: item.year,
      localPath: item.localPath
    }))}, null, 2));
    return;
  }
  if (process.argv.includes('--restore-metadata')) {
    const restored = restoreReportedWorks(payload, true);
    console.log(JSON.stringify({restored: restored.length, items: restored.map(item => ({
      key: item.key,
      title: item.title,
      year: item.year,
      localPath: item.localPath
    }))}, null, 2));
    return;
  }
  if (process.argv.includes('--prune-invalid-recovery')) {
    const removed = pruneInvalidMetadataRecovery(payload);
    console.log(JSON.stringify({removed: removed.length, items: removed}, null, 2));
    return;
  }
  if (process.argv.includes('--compact-recovery-diff')) {
    const additions = compactRecoveryDiff(payload);
    console.log(JSON.stringify({additions}, null, 2));
    return;
  }
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
