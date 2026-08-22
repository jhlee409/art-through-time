const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const topicsPath = path.join(root, 'data', 'topics.json');
const topicImageDir = path.join(root, 'data', 'topic-images');
const topicId = 'jesus-descent-from-the-cross';
const minimumWidth = 500;

const candidates = [
  {
    id: 'jesus-descent-online-tintoretto-1547',
    title: '십자가에서 내려지는 그리스도',
    artist: '틴토레토, 야코포',
    year: '1547',
    sortYear: 1547,
    movement: '매너리즘',
    fileName: 'Tintoretto - Descent from the Cross GG 1565.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Tintoretto_-_Descent_from_the_Cross_GG_1565.jpg',
    description: '빈 미술사박물관 소장작으로, 비스듬한 인물 배치와 극적인 동세가 매너리즘적 긴장을 보여 주는 십자가 강하 장면입니다.'
  },
  {
    id: 'jesus-descent-online-barocci-1569',
    title: '십자가에서 내려지는 그리스도',
    artist: '바로치, 페데리코',
    year: '1567–1569',
    sortYear: 1567,
    movement: '매너리즘',
    fileName: 'Deposizione dalla croce (Barocci) - 2023.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Deposizione_dalla_croce_(Barocci)_-_2023.jpg',
    description: '페루자 산 로렌초 대성당의 제단화로, 부드러운 색채와 감정적 몸짓을 통해 후기 르네상스와 초기 바로크 사이의 전환을 보여 줍니다.'
  },
  {
    id: 'jesus-descent-online-rembrandt-1633',
    title: '십자가에서 내려지는 그리스도',
    artist: '렘브란트 판 레인',
    year: '1633',
    sortYear: 1633,
    movement: '바로크',
    fileName: 'Rembrandt - Deposition from the Cross - WGA19112.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/Category:The_Descent_from_the_Cross_(Rembrandt,_Germany)',
    description: '알테 피나코테크 소장작으로, 깊은 명암과 인물들의 조심스러운 움직임을 통해 수난 장면의 인간적 무게를 강조한 렘브란트의 바로크 작품입니다.'
  },
  {
    id: 'jesus-descent-online-tournier-1632',
    title: '십자가에서 내려지는 그리스도',
    artist: '투르니에, 니콜라',
    year: '1632–1635',
    sortYear: 1632,
    movement: '바로크',
    fileName: 'Augustins - Le Christ descendu de la Croix - Nicolas Tournier 2004 1 285.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Augustins_-_Le_Christ_descendu_de_la_Croix_-_Nicolas_Tournier_2004_1_285.jpg',
    description: '툴루즈 오귀스탱 미술관 소장작으로, 어두운 배경과 집중된 인물 군상을 통해 프랑스 카라바조풍 바로크의 극적인 감정을 보여 줍니다.'
  },
  {
    id: 'jesus-descent-online-jouvenet-1697',
    title: '십자가에서 내려지는 그리스도',
    artist: '주브네, 장',
    year: '1697',
    sortYear: 1697,
    movement: '바로크',
    fileName: 'Jean-Baptiste Jouvenet - Descent from the Cross - WGA12030.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Jean-Baptiste_Jouvenet_-_Descent_from_the_Cross_-_WGA12030.jpg',
    description: '루브르 소장 대형 제단화로, 상승과 하강이 교차하는 인물 배치와 장대한 동세가 프랑스 바로크의 장엄한 성격을 드러냅니다.'
  },
  {
    id: 'jesus-descent-online-rottmayr-1712',
    title: '십자가에서 내려지는 그리스도',
    artist: '로트마이어, 요한 미하엘',
    year: '1712경',
    sortYear: 1712,
    movement: '바로크',
    fileName: 'Johann Michael Rottmayr - The Deposition from the Cross - Walters 37788.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Johann_Michael_Rottmayr_-_The_Deposition_from_the_Cross_-_Walters_37788.jpg',
    description: '월터스 미술관 소장 유화 스케치로, 오스트리아 바로크 제단화 제작을 위한 역동적인 구상과 빠른 붓질을 보여 줍니다.'
  },
  {
    id: 'jesus-descent-online-bonington-1820s',
    title: '십자가에서 내려지는 그리스도',
    artist: '보닝턴, 리처드 파크스',
    year: '1820–1830',
    sortYear: 1820,
    movement: '낭만주의',
    fileName: 'Richard Parkes Bonington - Descent from the Cross - 129260 - National Museum in Warsaw.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/Category:Paintings_by_Richard_Parkes_Bonington',
    description: '바르샤바 국립박물관 소장작으로, 19세기 낭만주의적 명암과 정서가 수난 장면에 더해진 예입니다.'
  },
  {
    id: 'jesus-descent-online-ribot-1870',
    title: '십자가에서 내려지는 그리스도',
    artist: '리보, 오귀스탱 테오뒬',
    year: '1870경',
    sortYear: 1870,
    movement: '사실주의',
    fileName: 'Augustin Théodule Ribot (1823-1891) - The Deposition from the Cross - KINCM-2005.6112 - Ferens Art Gallery.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Augustin_Th%C3%A9odule_Ribot_(1823-1891)_-_The_Deposition_from_the_Cross_-_KINCM-2005.6112_-_Ferens_Art_Gallery.jpg',
    description: '페렌스 미술관 소장작으로, 19세기 사실주의 화가 리보가 십자가 강하 장면을 어둡고 물질감 있는 화면으로 해석한 작품입니다.'
  }
];

function specialFilePath(fileName) {
  const params = new URLSearchParams({f: fileName, w: '960'});
  return `https://commons.wikimedia.org/w/thumb.php?${params.toString()}`;
}

function extensionFor(fileName, contentType = '') {
  const ext = path.extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  if (/png/i.test(contentType)) return '.png';
  if (/gif/i.test(contentType)) return '.gif';
  if (/webp/i.test(contentType)) return '.webp';
  return '.jpg';
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

function download(url, target, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Art-through-Time/1.0 (local educational archive)'
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
      stream.on('finish', () => {
        stream.close(() => resolve(response.headers['content-type'] || ''));
      });
      stream.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(60000, () => {
      request.destroy(new Error(`download timeout: ${url}`));
    });
  });
}

function existingKey(work) {
  return [work.artist, work.title, work.year]
    .map(value => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
    .join('|');
}

async function main() {
  fs.mkdirSync(topicImageDir, {recursive: true});
  const topicsData = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
  const topic = (topicsData.topics || []).find(item => item.id === topicId);
  if (!topic) throw new Error(`Topic not found: ${topicId}`);

  const existingIds = new Set((topic.works || []).map(work => work.id));
  const existingKeys = new Set((topic.works || []).map(existingKey));
  const added = [];
  const skipped = [];

  for (const candidate of candidates) {
    const key = existingKey(candidate);
    if (existingIds.has(candidate.id) || existingKeys.has(key)) {
      skipped.push({id: candidate.id, reason: 'already exists'});
      continue;
    }

    const temp = path.join(topicImageDir, `.${candidate.id}.download`);
    const url = specialFilePath(candidate.fileName);
    let contentType = '';
    try {
      contentType = await download(url, temp);
      const dimensions = imageSize(temp);
      if (dimensions.width < minimumWidth) {
        fs.unlinkSync(temp);
        skipped.push({...candidate, reason: `width under ${minimumWidth}px`, ...dimensions});
        continue;
      }
      const outName = `${candidate.id}${extensionFor(candidate.fileName, contentType)}`;
      const outPath = path.join(topicImageDir, outName);
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
  fs.writeFileSync(topicsPath, `${JSON.stringify(topicsData, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({added, skipped, works: topic.works.length}, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
