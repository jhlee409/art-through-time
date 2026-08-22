const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const topicsPath = path.join(root, 'data', 'topics.json');
const artistsPath = path.join(root, 'data', 'artists.json');
const topicImageDir = path.join(root, 'data', 'topic-images');
const topicId = 'jesus-descent-from-the-cross';
const minimumWidth = 500;
const matchDescent = /(십자가.*(내려|내림|강하)|descent from the cross|deposition from the cross|deposition\b)/i;

function imageSize(file) {
  const buffer = fs.readFileSync(file);
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

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function slug(value) {
  return normalize(value).slice(0, 72) || 'image';
}

function displayTitle(title = {}) {
  const ko = String(title.ko || '').trim();
  if (/[가-힣]/.test(ko)) return ko;
  return String(title.en || ko || '').trim();
}

function loc(value = {}) {
  return value.ko || value.en || '';
}

function localPathCandidates(work) {
  const seen = new Set();
  return [work.highResImage, work.image, work.thumbnail]
    .filter(Boolean)
    .filter(value => String(value).startsWith('data/'))
    .filter(value => {
      if (seen.has(value)) return false;
      seen.add(value);
      return fs.existsSync(path.join(root, value));
    });
}

function imageInfo(relative) {
  const absolute = path.join(root, relative);
  const dimensions = imageSize(absolute);
  const bytes = fs.statSync(absolute).size;
  return {relative, absolute, ...dimensions, bytes, score: dimensions.width * dimensions.height || bytes};
}

function bestImage(paths) {
  return paths.map(imageInfo).sort((a, b) => b.score - a.score || b.bytes - a.bytes)[0] || null;
}

function workKey(work) {
  return [work.artist, work.title, work.year].map(normalize).join('|');
}

function chooseBetter(existing, incoming) {
  const existingScore = Number(existing.imageScore || 0);
  const incomingScore = Number(incoming.imageScore || 0);
  if (incomingScore > existingScore) return incoming;
  if (incomingScore === existingScore && Number(incoming.imageBytes || 0) > Number(existing.imageBytes || 0)) return incoming;
  return existing;
}

const topicsData = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const artistsData = JSON.parse(fs.readFileSync(artistsPath, 'utf8'));
const topic = (topicsData.topics || []).find(item => item.id === topicId);
if (!topic) throw new Error(`Topic not found: ${topicId}`);

const merged = new Map();
const added = [];
const skipped = [];
(topic.works || []).forEach(work => {
  const info = work.thumbnail && fs.existsSync(path.join(root, work.thumbnail))
    ? imageInfo(work.thumbnail)
    : {score: 0, bytes: 0, width: 0, height: 0};
  if (info.width && info.width < minimumWidth) {
    skipped.push({artist: work.artist || '', id: work.id, reason: `width under ${minimumWidth}px`});
    return;
  }
  merged.set(workKey(work), {...work, imageScore: info.score, imageBytes: info.bytes, imageWidth: info.width, imageHeight: info.height});
});

for (const artist of artistsData.artists || []) {
  for (const work of artist.works || []) {
    const searchText = [work.title?.ko, work.title?.en, work.description?.ko, work.description?.en].filter(Boolean).join(' ');
    if (!matchDescent.test(searchText)) continue;
    const source = bestImage(localPathCandidates(work));
    if (!source) {
      skipped.push({artist: artist.name?.ko || artist.name?.en || '', id: work.id, reason: 'no local image'});
      continue;
    }
    if (source.width < minimumWidth) {
      skipped.push({artist: artist.name?.ko || artist.name?.en || '', id: work.id, reason: `width under ${minimumWidth}px`});
      continue;
    }
    const title = displayTitle(work.title);
    const year = String(work.year || '').trim();
    const candidate = {
      id: `jesus-descent-saved-${slug(work.id || `${artist.qid}-${title}-${year}`)}`,
      title,
      artist: artist.name?.ko || artist.name?.en || '',
      year,
      sortYear: Number(work.year) || 9999,
      movement: loc(work.movement),
      thumbnail: '',
      description: String(work.description?.ko || work.description?.en || '').trim() || '현재 화가 목록에 저장된 예수의 강하 또는 십자가 내림 계열 작품입니다.',
      sourceArtistId: artist.id,
      sourceWorkId: work.id,
      imageScore: source.score,
      imageBytes: source.bytes,
      imageWidth: source.width,
      imageHeight: source.height
    };
    const key = workKey(candidate);
    const previous = merged.get(key);
    if (previous && chooseBetter(previous, candidate) === previous) continue;
    const extension = path.extname(source.relative).toLowerCase() || '.jpg';
    const outName = `${candidate.id}${extension}`;
    candidate.thumbnail = `data/topic-images/${outName}`;
    fs.copyFileSync(source.absolute, path.join(root, candidate.thumbnail));
    merged.set(key, candidate);
    added.push({artist: candidate.artist, title: candidate.title, year: candidate.year, width: candidate.imageWidth, height: candidate.imageHeight});
  }
}

topic.works = [...merged.values()]
  .sort((a, b) => (Number(a.sortYear) || 9999) - (Number(b.sortYear) || 9999) || String(a.artist).localeCompare(String(b.artist), 'ko'))
  .map((work, index) => {
    const {imageScore, imageBytes, imageWidth, imageHeight, ...clean} = work;
    return {...clean, sequence: index + 1};
  });

fs.writeFileSync(topicsPath, `${JSON.stringify(topicsData, null, 2)}\n`, 'utf8');
const referenced = new Set(topic.works.map(work => path.basename(String(work.thumbnail || ''))).filter(Boolean));
for (const name of fs.readdirSync(topicImageDir)) {
  if (!/^jesus-descent-saved-/i.test(name)) continue;
  if (!referenced.has(name)) fs.unlinkSync(path.join(topicImageDir, name));
}
console.log(JSON.stringify({works: topic.works.length, added, skipped}, null, 2));
