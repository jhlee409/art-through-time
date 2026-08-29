#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {cleanLocalImagePath, existingLocalPathForWork} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const representativesFile = path.join(root, 'data', 'art-movement-representatives.json');
const metadataReportFile = path.join(root, 'data', 'generated', 'unlinked-timeline-image-metadata.json');
const imagesRoot = path.join(root, 'data', 'images');
const apply = process.argv.includes('--apply');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function absolute(localPath) {
  return path.resolve(root, cleanLocalImagePath(localPath).replace(/^data\/thumbnails\//, 'data/images/'));
}

function assertWorkspaceFile(localPath) {
  const file = absolute(localPath);
  const workspace = `${root}${path.sep}`.toLowerCase();
  if (!file.toLowerCase().startsWith(workspace)) throw new Error(`Path outside workspace: ${localPath}`);
  return file;
}

function bytes(localPath) {
  return fs.statSync(assertWorkspaceFile(localPath)).size;
}

function sha256(localPath) {
  return createHash('sha256').update(fs.readFileSync(assertWorkspaceFile(localPath))).digest('hex');
}

function containsHangul(value) {
  return /[가-힣]/.test(path.basename(value));
}

function preferredEqualSizePath(paths) {
  return [...paths].sort((left, right) => {
    const language = Number(containsHangul(right)) - Number(containsHangul(left));
    if (language) return language;
    return path.basename(right).length - path.basename(left).length;
  })[0];
}

function workLocalPaths(work) {
  return [...new Set([
    work.thumbnail,
    work.image,
    work.highResImage,
    work.highResOriginal,
    work.migration?.image?.localThumbnail,
    work.migration?.image?.highResolution
  ].map(cleanLocalImagePath).filter(value => value && fs.existsSync(absolute(value))))];
}

function markReady(work, localPath) {
  work.thumbnail = localPath;
  work.highResImage = localPath;
  work.highResOriginal = localPath;
  work.imageUploadStatus = 'ready';
  work.thumbnailValidation = 2;
  if (!/^https?:/i.test(String(work.image || ''))) work.image = localPath;
  work.migration = work.migration && typeof work.migration === 'object' ? work.migration : {schema: 1};
  work.migration.image = work.migration.image && typeof work.migration.image === 'object' ? work.migration.image : {};
  work.migration.image.status = 'ready';
  work.migration.image.localThumbnail = localPath;
  work.migration.image.highResolution = localPath;
}

function artistAndWork(payload, artistId, workId) {
  const artist = (payload.artists || []).find(item => item.id === artistId);
  const work = (artist?.works || []).find(item => item.id === workId);
  if (!artist || !work) throw new Error(`Missing work: ${artistId}|${workId}`);
  return {artist, work};
}

function replaceStrings(value, replacements) {
  if (typeof value === 'string') return replacements.get(value) || value;
  if (Array.isArray(value)) return value.map(item => replaceStrings(item, replacements));
  if (!value || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) value[key] = replaceStrings(value[key], replacements);
  return value;
}

function makeWork({id, year, titleKo, titleEn, localPath, movement, source, descriptionKo}) {
  const now = new Date().toISOString();
  const work = {
    id,
    year,
    popularity: 1,
    title: {ko: titleKo, en: titleEn},
    country: {ko: '', en: ''},
    movement: {ko: movement, en: movement},
    image: localPath,
    description: {ko: descriptionKo || '', en: ''},
    source,
    verified: true,
    representative: false,
    movementContribution: false,
    metadata: {createdAt: now, updatedAt: now, createdBy: 'local-metadata-recovery', updatedBy: 'local-metadata-recovery'}
  };
  markReady(work, localPath);
  return work;
}

function updateIndexes(replacements, upserts, deletedPaths) {
  const deleted = new Set(deletedPaths);
  const indexes = [];
  for (const folder of fs.readdirSync(imagesRoot, {withFileTypes: true})) {
    if (!folder.isDirectory()) continue;
    const file = path.join(imagesRoot, folder.name, 'index.json');
    if (!fs.existsSync(file)) continue;
    const index = readJson(file);
    let changed = false;
    for (const [workId, item] of Object.entries(index)) {
      const current = cleanLocalImagePath(item?.thumbnail);
      if (deleted.has(current)) {
        delete index[workId];
        changed = true;
      } else if (replacements.has(current)) {
        item.thumbnail = replacements.get(current);
        item.checkedAt = new Date().toISOString();
        item.verifiedBy = 'Consolidated by file size and metadata';
        item.imageHash = sha256(item.thumbnail);
        changed = true;
      }
    }
    if (changed) indexes.push({file, index});
  }
  for (const item of upserts) {
    const file = path.join(imagesRoot, item.artistId, 'index.json');
    let entry = indexes.find(value => value.file === file);
    if (!entry) {
      entry = {file, index: fs.existsSync(file) ? readJson(file) : {}};
      indexes.push(entry);
    }
    entry.index[item.workId] = {
      thumbnail: item.localPath,
      checkedAt: new Date().toISOString(),
      verifiedBy: 'Matched from local artist and artwork metadata',
      imageHash: fs.existsSync(absolute(item.localPath)) ? sha256(item.localPath) : ''
    };
  }
  if (apply) for (const item of indexes) writeJson(item.file, item.index);
  return indexes.length;
}

function main() {
  const payload = readJson(artistsFile);
  const metadataReport = readJson(metadataReportFile);
  const workById = new Map();
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) workById.set(work.id, {artist, work});
  }
  const replacements = new Map();
  const deletedPaths = new Set();
  const copied = [];
  const decisions = [];
  const indexUpserts = [];

  for (const item of metadataReport.unresolvedLocalFiles || []) {
    if (!item.qid) continue;
    const current = workById.get(`wikidata-${item.qid}`);
    if (!current) continue;
    const orphan = item.path;
    if (item.qid === 'Q19898216') {
      deletedPaths.add(orphan);
      decisions.push({workId: current.work.id, action: 'delete-invalid-icon', deleted: orphan});
      continue;
    }
    const linked = workLocalPaths(current.work)[0];
    if (!linked || linked === orphan) continue;
    const orphanBytes = bytes(orphan);
    const linkedBytes = bytes(linked);
    let winner = linked;
    if (orphanBytes > linkedBytes) winner = orphan;
    else if (orphanBytes === linkedBytes && sha256(orphan) === sha256(linked)) {
      winner = preferredEqualSizePath([orphan, linked]);
    }
    const loser = winner === orphan ? linked : orphan;
    if (winner === orphan && path.extname(winner).toLowerCase() === path.extname(linked).toLowerCase()) {
      copied.push({from: winner, to: linked});
      deletedPaths.add(winner);
      decisions.push({workId: current.work.id, action: 'promote-larger-content', from: winner, canonical: linked, deleted: winner});
    } else {
      if (winner !== linked) {
        replacements.set(linked, winner);
        markReady(current.work, winner);
      }
      deletedPaths.add(loser);
      decisions.push({workId: current.work.id, action: 'keep-preferred-file', kept: winner, deleted: loser});
    }
    indexUpserts.push({artistId: current.artist.id, workId: current.work.id, localPath: winner === orphan && path.extname(winner).toLowerCase() === path.extname(linked).toLowerCase() ? linked : winner});
  }

  const manualPairs = [
    ['artist-Q167654', 'frans-hals-laughing-cavalier-1624', 'data/images/artist-Q167654/frans-hals-laughing-cavalier-1624.png', false],
    ['artist-Q312617', 'rosso-fiorentino-allegory-of-salvation-1522', 'data/images/artist-Q312617/rosso-fiorentino-allegory-of-salvation-1522.png', false],
    ['artist-Q47551', 'manual-local-1787199069405', 'data/images/artist-Q47551/manual-local-1787199069405.png', false],
    ['artist-Q9319', 'tintoretto-finding-of-the-body-of-st-mark-1562-1566', 'data/images/artist-Q9319/tintoretto-finding-of-the-body-of-st-mark-1562-1566.10mb.png', false],
    ['artist-Q7824', 'manual-local-1787031331308', 'data/images/artist-Q7824/manual-triumph-of-bacchus-and-ariadne.jpg', false],
    ['vincent-van-gogh', 'wikidata-Q45585', 'data/images/vincent-van-gogh/starry-night.jpg', true],
    ['vincent-van-gogh', 'wikidata-Q157541', 'data/images/vincent-van-gogh/sunflowers.jpg', false]
  ];
  for (const [artistId, workId, manualPath, preferValid] of manualPairs) {
    const {work} = artistAndWork(payload, artistId, workId);
    const linked = existingLocalPathForWork(work, artistId);
    if (!linked || linked === manualPath) continue;
    const manualWins = preferValid || bytes(manualPath) > bytes(linked)
      || (bytes(manualPath) === bytes(linked) && preferredEqualSizePath([manualPath, linked]) === manualPath);
    if (manualWins && path.extname(manualPath).toLowerCase() === path.extname(linked).toLowerCase()) {
      copied.push({from: manualPath, to: linked});
      deletedPaths.add(manualPath);
      decisions.push({workId, action: preferValid ? 'replace-corrupt-image' : 'promote-larger-content', from: manualPath, canonical: linked, deleted: manualPath});
    } else if (manualWins) {
      replacements.set(linked, manualPath);
      markReady(work, manualPath);
      deletedPaths.add(linked);
      decisions.push({workId, action: 'keep-larger-file', kept: manualPath, deleted: linked});
    } else {
      deletedPaths.add(manualPath);
      decisions.push({workId, action: 'delete-smaller-manual-file', kept: linked, deleted: manualPath});
    }
    indexUpserts.push({artistId, workId, localPath: manualWins && path.extname(manualPath).toLowerCase() !== path.extname(linked).toLowerCase() ? manualPath : linked});
  }

  artistAndWork(payload, 'artist-Q191748', 'cranach-weimar-altarpiece').work.year = 1552;
  artistAndWork(payload, 'artist-Q313122', 'artist-Q313122-pastoral-landscape').work.year = null;

  const additions = [
    {
      artistId: 'artist-url-1786879941678',
      workId: 'rubens-self-portrait-1623',
      sourcePath: 'data/images/artist-Q5599/wikipedia-Q5599-10.jpg',
      localPath: 'data/images/artist-url-1786879941678/루벤스_모자를 쓴 자화상_1623__rubens-self-portrait-1623.jpg',
      work: makeWork({id: 'rubens-self-portrait-1623', year: 1623, titleKo: '모자를 쓴 자화상', titleEn: 'Self-Portrait with a Hat', localPath: 'data/images/artist-url-1786879941678/루벤스_모자를 쓴 자화상_1623__rubens-self-portrait-1623.jpg', movement: '바로크', source: 'https://commons.wikimedia.org/wiki/Peter_Paul_Rubens/Self-portraits', descriptionKo: '검은 모자와 어두운 복장으로 자신을 표현한 루벤스의 1623년경 자화상입니다.'})
    },
    {
      artistId: 'artist-Q9340',
      workId: 'claude-lorrain-sunrise-1646',
      sourcePath: 'data/images/artist-Q9340/Amanecer,_1646–47,_Claude_Lorrain.jpg',
      localPath: 'data/images/artist-Q9340/로랭_해돋이_1646__claude-lorrain-sunrise-1646.jpg',
      work: makeWork({id: 'claude-lorrain-sunrise-1646', year: 1646, titleKo: '해돋이', titleEn: 'Sunrise', localPath: 'data/images/artist-Q9340/로랭_해돋이_1646__claude-lorrain-sunrise-1646.jpg', movement: '바로크', source: 'https://commons.wikimedia.org/wiki/File:Amanecer,_1646%E2%80%9347,_Claude_Lorrain.jpg', descriptionKo: '목동과 가축이 있는 이상적 풍경을 새벽빛으로 통합한 1646~1647년 작품입니다.'})
    },
    {
      artistId: 'artist-Q9340',
      workId: 'claude-lorrain-acis-galatea-1657',
      sourcePath: 'data/images/artist-Q9340/Claude_Lorrain_001.jpg',
      localPath: 'data/images/artist-Q9340/로랭_아키스와 갈라테이아_1657__claude-lorrain-acis-galatea-1657.jpg',
      work: makeWork({id: 'claude-lorrain-acis-galatea-1657', year: 1657, titleKo: '아키스와 갈라테이아가 있는 해안 풍경', titleEn: 'Coastal Landscape with Acis and Galatea', localPath: 'data/images/artist-Q9340/로랭_아키스와 갈라테이아_1657__claude-lorrain-acis-galatea-1657.jpg', movement: '바로크', source: 'https://commons.wikimedia.org/wiki/File:Claude_Lorrain_001.jpg', descriptionKo: '아키스와 갈라테이아의 신화를 해안 풍경 속 작은 인물 장면으로 배치한 1657년 작품입니다.'})
    }
  ];
  for (const item of additions) {
    const artist = (payload.artists || []).find(value => value.id === item.artistId);
    if (!artist) throw new Error(`Missing artist: ${item.artistId}`);
    if (!(artist.works || []).some(work => work.id === item.workId)) artist.works.push(item.work);
    copied.push({from: item.sourcePath, to: item.localPath});
    deletedPaths.add(item.sourcePath);
    indexUpserts.push({artistId: item.artistId, workId: item.workId, localPath: item.localPath});
  }

  replaceStrings(payload, replacements);
  let representatives = fs.existsSync(representativesFile) ? readJson(representativesFile) : null;
  if (representatives) replaceStrings(representatives, replacements);

  if (apply) {
    for (const item of copied) fs.copyFileSync(assertWorkspaceFile(item.from), assertWorkspaceFile(item.to));
    for (const item of copied) replacements.set(item.from, item.to);
    replaceStrings(payload, replacements);
    if (representatives) replaceStrings(representatives, replacements);
    writeJson(artistsFile, payload);
    if (representatives) writeJson(representativesFile, representatives);
  }
  const indexFiles = updateIndexes(replacements, indexUpserts, deletedPaths);
  if (apply) {
    for (const localPath of deletedPaths) {
      const file = assertWorkspaceFile(localPath);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }

  console.log(JSON.stringify({
    apply,
    qidDecisions: decisions.length,
    copied: copied.length,
    deleted: deletedPaths.size,
    addedWorks: additions.length,
    normalizedYears: 2,
    indexFiles,
    decisions,
    additions: additions.map(item => ({artistId: item.artistId, workId: item.workId, localPath: item.localPath}))
  }, null, 2));
}

main();
