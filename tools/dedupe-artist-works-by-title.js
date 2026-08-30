const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsPath = path.join(root, 'data', 'artists.json');
const reportPath = path.join(root, 'data', 'generated', 'artist-work-dedupe-report.json');
const write = process.argv.includes('--write');
const focusArg = process.argv.find(arg => arg.startsWith('--artist='));
const focusArtistId = focusArg ? focusArg.slice('--artist='.length) : '';

function loc(value) {
  if (!value || typeof value !== 'object') return String(value || '').trim();
  return String(value.ko || value.en || value.original || value.native || '').trim();
}

function titleValues(work) {
  const title = work?.title;
  if (!title) return [];
  if (typeof title !== 'object') return [String(title).trim()].filter(Boolean);
  return [title.ko, title.en, title.original, title.native, title.originalTitle, title.nativeTitle]
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function compact(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[àáâãäåā]/g, 'a')
    .replace(/[èéêëē]/g, 'e')
    .replace(/[ìíîïī]/g, 'i')
    .replace(/[òóôõöøō]/g, 'o')
    .replace(/[ùúûüū]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function artistNameParts(artist) {
  const aliases = Array.isArray(artist?.aliases)
    ? artist.aliases
    : Object.values(artist?.aliases || {}).flat();
  const names = [artist?.id, artist?.name?.ko, artist?.name?.en, artist?.fullName, ...aliases]
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const parts = new Set();
  names.forEach(name => {
    parts.add(name);
    name.split(/\s+/).filter(part => part.length > 2).forEach(part => parts.add(part));
  });
  return [...parts].sort((a, b) => b.length - a.length);
}

function cleanTitle(value, artist) {
  let text = String(value || '')
    .normalize('NFKC')
    .replace(/[《》〈〉"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  text = text
    .replace(/^\s*file:\s*/i, '')
    .replace(/\s*\(\s*(?:c\.?\s*)?\d{3,4}[^)]*\)\s*$/i, '')
    .replace(/\s*,\s*(?:c\.?\s*)?\d{3,4}(?:\s*[–-]\s*\d{2,4})?(?:\s*,.*)?$/i, '')
    .replace(/\s*,\s*(?:louvre|met|museum|gallery|collection).*$/i, '')
    .replace(/^\s*(?:the|a|an)\s+/i, '')
    .replace(/\s*\((?:after|follower of|circle of|school of)[^)]+\)\s*$/i, '');
  for (const name of artistNameParts(artist)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
    text = text
      .replace(new RegExp(`\\s+by\\s+${escaped}(?:\\s*,\\s*(?:early|late)?\\s*work)?(?:\\s*\\([^)]*\\))?(?:\\s*,.*)?$`, 'i'), '')
      .replace(new RegExp(`\\s*,\\s*(?:early|late)?\\s*work\\s*\\([^)]*\\)\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*\\(${escaped}\\)\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${escaped}(?:\\s*,.*)?$`, 'i'), '');
  }
  return text
    .replace(/\s+,\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:the|a|an)\s+/i, '')
    .trim();
}

function canonicalTitleKeys(work, artist) {
  return [...new Set(titleValues(work).map(value => compact(cleanTitle(value, artist))).filter(key => key.length >= 3))];
}

function isLocalImageSource(source) {
  return /^data[\\/]/i.test(String(source || ''));
}

function localPath(source) {
  const raw = String(source || '').replace(/\\/g, '/');
  if (!isLocalImageSource(raw)) return '';
  const absolute = path.resolve(root, raw);
  const dataRoot = path.resolve(root, 'data');
  return absolute.startsWith(`${dataRoot}${path.sep}`) ? absolute : '';
}

function imageSizeFromBuffer(buffer) {
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const length = buffer.readUInt16BE(offset + 2);
      const isFrame = (marker >= 0xc0 && marker <= 0xc3)
        || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb)
        || (marker >= 0xcd && marker <= 0xcf);
      if (isFrame) return {width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5)};
      offset += 2 + length;
    }
  }
  if (buffer.slice(0, 3).toString() === 'GIF') {
    return {width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8)};
  }
  return {width: 0, height: 0};
}

function imageInfo(work) {
  const source = String(work?.highResImage || work?.image || work?.thumbnail || '').trim();
  const absolute = localPath(source);
  if (absolute && fs.existsSync(absolute)) {
    try {
      const buffer = fs.readFileSync(absolute);
      const dimensions = imageSizeFromBuffer(buffer);
      const bytes = fs.statSync(absolute).size;
      return {source, local: true, known: true, bytes, ...dimensions, score: dimensions.width * dimensions.height || bytes};
    } catch (error) {
      return {source, local: true, known: false, inaccessible: error.code || 'read-error', bytes: 0, width: 0, height: 0, score: 0};
    }
  }
  const thumbMatch = source.match(/\/(\d{2,5})px-[^/?#]+(?:[?#]|$)/i);
  if (thumbMatch) {
    const width = Number(thumbMatch[1]);
    return {source, local: false, known: true, bytes: 0, width, height: 0, score: width * width};
  }
  return {source, local: false, known: false, bytes: 0, width: 0, height: 0, score: 0};
}

function hasKoreanTitle(work) {
  const ko = String(work?.title?.ko || '').trim();
  if (!ko || /[A-Za-z]{3,}/.test(ko)) return false;
  return /[가-힣]/.test(ko);
}

function workIdQid(work) {
  return String(work?.id || '').match(/Q\d+/)?.[0] || '';
}

function imageSourceKey(work) {
  const source = String(work?.highResImage || work?.image || work?.thumbnail || '').trim();
  if (!source) return '';
  try {
    const url = new URL(source);
    url.search = '';
    url.hash = '';
    return url.href.toLocaleLowerCase();
  } catch (_) {
    return source.replace(/\\/g, '/').toLocaleLowerCase();
  }
}

function workYear(work) {
  const year = Number(work?.year);
  return Number.isFinite(year) ? year : null;
}

function yearsClose(left, right) {
  const leftYear = workYear(left), rightYear = workYear(right);
  return leftYear !== null && rightYear !== null && Math.abs(leftYear - rightYear) <= 1;
}

function isCommonRepeatedTitleKey(key) {
  return new Set([
    'selfportrait','portrait','portraitofaman','portraitofawoman',
    'madonnaandchild','pieta','crucifix','judith','visitation',
    'adorationoftheshepherds','assumptionofthevirgin',
    'martyrdomofsaintsebastian','transfigurationofchrist',
    'waterlilies','japanesebridge','moonriseoverthesea'
  ]).has(key);
}

function duplicatePair(left, right, key) {
  const leftImage = imageSourceKey(left), rightImage = imageSourceKey(right);
  if (leftImage && rightImage && leftImage === rightImage) return true;
  if (yearsClose(left, right) && !isCommonRepeatedTitleKey(key)) return true;
  return false;
}

function duplicateGroups(artist) {
  const works = artist.works || [];
  const parent = new Map();
  const find = id => {
    if (!parent.has(id)) parent.set(id, id);
    const next = parent.get(id);
    if (next === id) return id;
    const root = find(next);
    parent.set(id, root);
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left), rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  const candidates = new Map();
  const keysByWork = new Map();
  for (const work of works) {
    find(String(work.id || ''));
    const keys = new Set(canonicalTitleKeys(work, artist));
    const qid = workIdQid(work);
    if (qid) keys.add(`qid:${qid}`);
    keysByWork.set(String(work.id || ''), keys);
    for (const key of keys) {
      if (!candidates.has(key)) candidates.set(key, []);
      candidates.get(key).push(work);
    }
  }
  for (const [key, keyWorks] of candidates.entries()) {
    if (key.startsWith('qid:')) continue;
    const uniqueWorks = [...new Map(keyWorks.map(work => [String(work.id || ''), work])).values()];
    for (let left = 0; left < uniqueWorks.length; left++) {
      for (let right = left + 1; right < uniqueWorks.length; right++) {
        if (duplicatePair(uniqueWorks[left], uniqueWorks[right], key)) {
          union(String(uniqueWorks[left].id || ''), String(uniqueWorks[right].id || ''));
        }
      }
    }
  }
  const components = new Map();
  works.forEach(work => {
    const root = find(String(work.id || ''));
    components.set(root, [...(components.get(root) || []), work]);
  });
  return [...components.values()].filter(group => group.length > 1).map(group => {
    const sharedKeys = new Set();
    for (let left = 0; left < group.length; left++) {
      for (let right = left + 1; right < group.length; right++) {
        const leftKeys = keysByWork.get(String(group[left].id || '')) || new Set();
        const rightKeys = keysByWork.get(String(group[right].id || '')) || new Set();
        [...leftKeys].filter(key => !key.startsWith('qid:') && rightKeys.has(key) && duplicatePair(group[left], group[right], key)).forEach(key => sharedKeys.add(key));
      }
    }
    return [[...sharedKeys][0] || 'duplicate', group];
  });
}

function workRank(work) {
  const info = imageInfo(work);
  const titleBonus = hasKoreanTitle(work) ? 100000000 : 0;
  const localBonus = info.local ? 10000000 : 0;
  const knownBonus = info.known ? 1000000 : 0;
  return info.score + titleBonus + localBonus + knownBonus;
}

function chooseKeeper(works) {
  return [...works].sort((left, right) => {
    const leftInfo = imageInfo(left), rightInfo = imageInfo(right);
    return (rightInfo.score - leftInfo.score)
      || (Number(hasKoreanTitle(right)) - Number(hasKoreanTitle(left)))
      || (Number(rightInfo.local) - Number(leftInfo.local))
      || String(left.id || '').localeCompare(String(right.id || ''));
  })[0];
}

const data = JSON.parse(fs.readFileSync(artistsPath, 'utf8'));
const artists = data.artists || [];
const reports = [];
const removedByArtist = new Map();

for (const artist of artists) {
  if (focusArtistId && artist.id !== focusArtistId) continue;
  const groups = duplicateGroups(artist);
  const removeIds = new Set();
  const artistReports = [];
  for (const [key, works] of groups) {
    const activeWorks = works.filter(work => !removeIds.has(String(work.id || '')));
    if (activeWorks.length < 2) continue;
    const keeper = chooseKeeper(activeWorks);
    const removed = activeWorks.filter(work => work !== keeper);
    removed.forEach(work => removeIds.add(String(work.id || '')));
    artistReports.push({
      key,
      keep: {id: keeper.id, title: keeper.title, year: keeper.year, image: imageInfo(keeper)},
      remove: removed.map(work => ({id: work.id, title: work.title, year: work.year, image: imageInfo(work)}))
    });
  }
  if (artistReports.length) {
    reports.push({artistId: artist.id, artistName: artist.name, groups: artistReports});
    removedByArtist.set(artist.id, removeIds);
  }
}

if (write) {
  for (const artist of artists) {
    const ids = removedByArtist.get(artist.id);
    if (!ids?.size) continue;
    artist.works = (artist.works || []).filter(work => !ids.has(String(work.id || '')));
    if (Array.isArray(artist.featuredWorkIds)) {
      artist.featuredWorkIds = artist.featuredWorkIds.filter(id => !ids.has(String(id)));
    }
  }
  fs.writeFileSync(artistsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const summary = {
  write,
  artistCount: reports.length,
  removedWorkCount: reports.reduce((sum, artist) => sum + artist.groups.reduce((subtotal, group) => subtotal + group.remove.length, 0), 0),
  reports
};

fs.mkdirSync(path.dirname(reportPath), {recursive: true});
fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  write: summary.write,
  artistCount: summary.artistCount,
  removedWorkCount: summary.removedWorkCount,
  report: path.relative(root, reportPath).replace(/\\/g, '/')
}, null, 2));
