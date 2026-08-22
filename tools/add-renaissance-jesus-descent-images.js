const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const topicsPath = path.join(root, 'data', 'topics.json');
const topicImageDir = path.join(root, 'data', 'topic-images');
const topicId = 'jesus-descent-from-the-cross';
const minimumWidth = 500;
const thumbnailWidth = 960;

const candidates = [
  {
    id: 'jesus-descent-renaissance-raphael-1507',
    title: '그리스도의 강하',
    artist: '산치오, 라파엘로',
    year: '1507',
    sortYear: 1507,
    movement: '전성기 르네상스',
    fileName: 'Raffaello, deposizione borghese, 1507.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Raffaello,_deposizione_borghese,_1507.jpg',
    description: '바글리오니 제단화의 중앙 패널로, 라파엘로가 르네상스적 균형과 인물의 감정 표현을 결합해 그리스도의 강하와 매장으로 이어지는 장면을 구성한 작품입니다.'
  },
  {
    id: 'jesus-descent-renaissance-filippino-lippi-1504',
    title: '십자가에서 내려지는 그리스도',
    artist: '리피, 필리피노',
    year: '1504경',
    sortYear: 1504,
    movement: '르네상스',
    fileName: 'Filippino Lippi - Deposition from the Cross - WGA13102.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Filippino_Lippi_-_Deposition_from_the_Cross_-_WGA13102.jpg',
    description: '안눈치아타 다폭 제단화의 일부로, 십자가에서 내려지는 그리스도를 긴장된 인물 군상과 고전적 질서 안에 배치한 르네상스 작품입니다.'
  },
  {
    id: 'jesus-descent-renaissance-lorenzo-lotto-1512',
    title: '십자가에서 내려지는 그리스도',
    artist: '로토, 로렌초',
    year: '1512',
    sortYear: 1512,
    movement: '르네상스 · 베네치아 화파',
    fileName: 'Lorenzo lotto, deposizione di jesi, 1512, 03.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Lorenzo_lotto,_deposizione_di_jesi,_1512,_03.jpg',
    description: '예시 시립미술관의 로렌초 로토 작품으로, 십자가 강하와 매장으로 이어지는 장면을 강한 색채와 압축된 인물 배치로 보여 주는 르네상스 회화입니다.'
  }
];

function commonsThumbUrl(fileName) {
  const params = new URLSearchParams({f: fileName, w: String(thumbnailWidth)});
  return `https://commons.wikimedia.org/w/thumb.php?${params.toString()}`;
}

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

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function workKey(work) {
  return [work.artist, work.title, work.year].map(normalize).join('|');
}

function download(url, target, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Art-through-Time/1.0 (local educational archive)',
        Accept: 'image/*,*/*;q=0.8'
      }
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects > 8) reject(new Error(`too many redirects: ${url}`));
        else resolve(download(new URL(response.headers.location, url).toString(), target, redirects + 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`download failed ${response.statusCode}: ${url}`));
        return;
      }
      const stream = fs.createWriteStream(target);
      response.pipe(stream);
      stream.on('finish', () => stream.close(resolve));
      stream.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(60000, () => request.destroy(new Error(`download timeout: ${url}`)));
  });
}

async function main() {
  fs.mkdirSync(topicImageDir, {recursive: true});
  const data = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
  const topic = (data.topics || []).find(item => item.id === topicId);
  if (!topic) throw new Error(`Topic not found: ${topicId}`);

  const existingIds = new Set((topic.works || []).map(work => work.id));
  const existingKeys = new Set((topic.works || []).map(workKey));
  const added = [];
  const skipped = [];

  for (const candidate of candidates) {
    if (existingIds.has(candidate.id) || existingKeys.has(workKey(candidate))) {
      skipped.push({id: candidate.id, reason: 'already exists'});
      continue;
    }

    const temp = path.join(topicImageDir, `.${candidate.id}.download`);
    const outName = `${candidate.id}.jpg`;
    const outPath = path.join(topicImageDir, outName);
    try {
      await download(commonsThumbUrl(candidate.fileName), temp);
      const dimensions = imageSize(temp);
      if (dimensions.width < minimumWidth) {
        fs.unlinkSync(temp);
        skipped.push({id: candidate.id, reason: `width under ${minimumWidth}px`, ...dimensions});
        continue;
      }
      fs.renameSync(temp, outPath);
      topic.works.push({
        id: candidate.id,
        title: candidate.title,
        artist: candidate.artist,
        year: candidate.year,
        sortYear: candidate.sortYear,
        movement: candidate.movement,
        thumbnail: `data/topic-images/${outName}`,
        description: candidate.description,
        sourcePage: candidate.sourcePage,
        sourceFile: candidate.fileName
      });
      added.push({id: candidate.id, artist: candidate.artist, year: candidate.year, width: dimensions.width, height: dimensions.height});
    } catch (error) {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
      skipped.push({id: candidate.id, reason: error.message});
    }
  }

  topic.works.sort((a, b) =>
    (Number(a.sortYear) || 9999) - (Number(b.sortYear) || 9999)
    || String(a.artist || '').localeCompare(String(b.artist || ''), 'ko')
    || String(a.title || '').localeCompare(String(b.title || ''), 'ko')
  );
  topic.works = topic.works.map((work, index) => ({...work, sequence: index + 1}));
  fs.writeFileSync(topicsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({added, skipped, works: topic.works.length}, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
