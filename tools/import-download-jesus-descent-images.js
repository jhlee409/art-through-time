const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const downloadDir = 'C:\\Users\\jhlee\\OneDrive - UOU\\AI-Programming\\Art_through_Time\\download';
const topicsPath = path.join(root, 'data', 'topics.json');
const topicImageDir = path.join(root, 'data', 'topic-images');
const topicId = 'jesus-descent-from-the-cross';
const minimumWidth = 500;

const groups = [
  {
    id: 'jesus-descent-download-daniele-da-volterra-1545',
    title: '십자가에서 내려지는 그리스도',
    artist: '다 볼테라, 다니엘레',
    year: '1545경',
    sortYear: 1545,
    movement: '매너리즘',
    outName: 'jesus-descent-download-daniele-da-volterra-1545.jpg',
    files: ['(c. 1545),Daniele da Volterra - Trinità dei Monti, .jpg'],
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Descentfromthecross.jpg',
    description: '로마 트리니타 데이 몬티의 오르시니 예배당을 위해 제작된 다니엘레 다 볼테라의 대표적 십자가 강하 장면입니다. 미켈란젤로적 인체와 복잡한 하강 동선이 매너리즘의 긴장을 보여 줍니다.'
  },
  {
    id: 'jesus-descent-saved-rubensdescentantwerp1612',
    title: '십자가에서 내려지는 그리스도',
    artist: '루벤스, 페테르 파울',
    year: '1612–1614',
    sortYear: 1612,
    movement: '바로크',
    outName: 'jesus-descent-download-rubens-antwerp-1612-1614.jpg',
    files: [
      'Peter_Paul_Rubens_-_The_Descent_from_the_Cross_(Antwerp_Cathedral).,_c._1613.jpg',
      'Peter_Paul_Rubens_-_Die_Kreuzabnahme_-_1612.jpg',
      'peter_paul_rubens_deposition 1612.jpg'
    ],
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Peter_Paul_Rubens_-_The_Descent_from_the_Cross_(Antwerp_Cathedral).,_c._1613.jpg',
    description: '앤트워프 성모 대성당을 위해 제작된 루벤스 삼면화의 중앙 패널입니다. 흰 수의와 대각선 구도를 통해 그리스도의 몸을 극적으로 끌어내리는 바로크적 장면 구성이 두드러집니다.'
  },
  {
    id: 'jesus-descent-download-rubens-lille-1617',
    title: '십자가에서 내려지는 그리스도',
    artist: '루벤스, 페테르 파울',
    year: '1617',
    sortYear: 1617,
    movement: '바로크',
    outName: 'jesus-descent-download-rubens-lille-1617.jpg',
    files: ['Peter_Paul_Rubens_-_Descent_from_the_cross_(1617).jpg'],
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Peter_Paul_Rubens_-_Descent_from_the_cross_(1617).jpg',
    description: '프랑스 릴 미술관 소장작으로, 커다란 캔버스에 인물들의 중량감과 장대한 움직임을 결합한 루벤스의 1617년 십자가 강하 장면입니다.'
  },
  {
    id: 'jesus-descent-download-rubens-hermitage-1617-1618',
    title: '십자가에서 내려지는 그리스도',
    artist: '루벤스, 페테르 파울',
    year: '1617–1618경',
    sortYear: 1617,
    movement: '바로크',
    outName: 'jesus-descent-download-rubens-hermitage-1617-1618.jpg',
    files: ['Descente_de_croix_rubens.jpg'],
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Descente_de_croix_rubens.jpg',
    description: '상트페테르부르크 에르미타주 미술관 소장작으로 알려진 루벤스의 십자가 강하 장면입니다. 어두운 배경 속에서 인물과 천의 밝은 면을 집중시키는 바로크적 명암이 특징입니다.'
  }
];

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

function bestFile(fileNames) {
  return fileNames
    .map(name => {
      const absolute = path.join(downloadDir, name);
      if (!fs.existsSync(absolute)) return null;
      const dimensions = imageSize(absolute);
      const bytes = fs.statSync(absolute).size;
      return {name, absolute, bytes, ...dimensions, score: dimensions.width * dimensions.height || bytes};
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.bytes - a.bytes)[0] || null;
}

const data = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const topic = (data.topics || []).find(item => item.id === topicId);
if (!topic) throw new Error(`Topic not found: ${topicId}`);
fs.mkdirSync(topicImageDir, {recursive: true});

const added = [];
const updated = [];
const skipped = [];

for (const group of groups) {
  const source = bestFile(group.files);
  if (!source) {
    skipped.push({id: group.id, reason: 'source file not found'});
    continue;
  }
  if (source.width < minimumWidth) {
    skipped.push({id: group.id, reason: `width under ${minimumWidth}px`, file: source.name, width: source.width, height: source.height});
    continue;
  }

  const target = path.join(topicImageDir, group.outName);
  fs.copyFileSync(source.absolute, target);
  const work = {
    id: group.id,
    title: group.title,
    artist: group.artist,
    year: group.year,
    sortYear: group.sortYear,
    movement: group.movement,
    thumbnail: `data/topic-images/${group.outName}`,
    description: group.description,
    sourcePage: group.sourcePage,
    sourceFile: source.name
  };

  const index = topic.works.findIndex(item => item.id === group.id);
  if (index >= 0) {
    topic.works[index] = {...topic.works[index], ...work};
    updated.push({id: group.id, file: source.name, width: source.width, height: source.height});
  } else {
    topic.works.push(work);
    added.push({id: group.id, file: source.name, width: source.width, height: source.height});
  }
}

topic.works.sort((a, b) =>
  (Number(a.sortYear) || 9999) - (Number(b.sortYear) || 9999)
  || String(a.artist || '').localeCompare(String(b.artist || ''), 'ko')
  || String(a.title || '').localeCompare(String(b.title || ''), 'ko')
);
topic.works = topic.works.map((work, index) => ({...work, sequence: index + 1}));
fs.writeFileSync(topicsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({added, updated, skipped, works: topic.works.length}, null, 2));
