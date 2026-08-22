const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const downloadDir = 'C:\\Users\\jhlee\\OneDrive - UOU\\AI-Programming\\Art_through_Time\\download';
const topicsFile = path.join(root, 'data', 'topics.json');
const topicImageDir = path.join(root, 'data', 'topic-images');
const topicId = 'jesus-descent-from-the-cross';
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const known = [
  {
    match: /^Duccio,_Passion_of_Christ_21,_Deposition/i,
    title: '십자가에서 내려지는 그리스도',
    artist: '두초 디 부오닌세냐',
    year: '1308–1311',
    sortYear: 1308,
    movement: '고딕 · 시에나 화파',
    description: '두초의 마에스타 제단화 수난 장면 중 하나로, 중세 말 시에나 회화의 정교한 서사성과 금빛 배경 전통을 보여 줍니다.'
  },
  {
    match: /안젤리코/,
    title: '십자가에서 내려지는 그리스도',
    artist: '프라 안젤리코',
    year: '1432–1434경',
    sortYear: 1432,
    movement: '초기 르네상스',
    description: '장식적 색채와 고요한 인물 표현을 통해 수난 장면을 명상적으로 보여 주는 초기 르네상스 작품입니다.'
  },
  {
    match: /Daniel_of_Uranc/i,
    title: '십자가에서 내려지는 그리스도',
    artist: '다니엘 오브 우랑크',
    year: '1463',
    sortYear: 1463,
    movement: '후기 고딕',
    description: '1463년 작품으로 알려진 십자가 강하 장면입니다.'
  },
  {
    match: /Novgorod_school/i,
    title: '십자가에서 내려지는 그리스도',
    artist: '노브고로드 화파',
    year: '15세기 후반',
    sortYear: 1475,
    movement: '러시아 이콘',
    description: '노브고로드 화파의 이콘 전통 안에서 십자가 강하 장면을 도식적이고 상징적으로 구성한 작품입니다.'
  },
  {
    match: /Rosso_Fiorentino_002/i,
    title: '십자가에서 내려지는 그리스도',
    artist: '로소 피오렌티노',
    year: '1521',
    sortYear: 1521,
    movement: '매너리즘',
    description: '볼테라의 대표 제단화로, 위태로운 사다리와 긴장된 인물 배치가 르네상스적 안정성을 의도적으로 흔드는 매너리즘 작품입니다.'
  },
  {
    match: /야코포 틴토|Tintoretto/i,
    title: '십자가에서 내려지는 그리스도',
    artist: '야코포 틴토레토',
    year: '',
    sortYear: 9999,
    movement: '매너리즘',
    description: '파일명상 틴토레토의 십자가 강하 장면으로 분류했습니다. 정확한 제작 연도는 확인하지 못해 비워 두었습니다.'
  },
  {
    match: /Rembrandt_Harmensz/i,
    title: '십자가에서 내려지는 그리스도',
    artist: '렘브란트 판 레인',
    year: '',
    sortYear: 9999,
    movement: '바로크',
    description: '파일명상 렘브란트의 십자가 강하 장면으로 분류했습니다. 정확한 제작 연도는 확인하지 못해 비워 두었습니다.'
  },
  {
    match: /Stylianos_Stavrakis/i,
    title: '십자가에서 내려지는 그리스도',
    artist: '스틸리아노스 스타브라키스',
    year: '',
    sortYear: 9999,
    movement: '이콘',
    description: '파일명상 스틸리아노스 스타브라키스의 십자가 강하 장면으로 분류했습니다. 정확한 제작 연도는 확인하지 못해 비워 두었습니다.'
  },
  {
    match: /Stations_of_the_Cross/i,
    title: '십자가의 길 제13처',
    artist: '',
    year: '',
    sortYear: 9999,
    movement: '',
    description: '십자가의 길 제13처, 곧 예수가 십자가에서 내려지는 장면입니다.'
  }
];

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'image';
}

function fileTitle(name) {
  try {
    return decodeURIComponent(name);
  } catch (_) {
    return name;
  }
}

function inferredWork(name, index) {
  const metadata = known.find(item => item.match.test(name));
  if (metadata) return {...metadata, known: true};
  const base = fileTitle(path.basename(name, path.extname(name))).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const generic = /^(images?|img)(\s*\(\d+\))?$/i.test(base)
    || /^(ie\d+|saam[\d\s.]+|th\d+|sophiako|[a-f0-9]{16,}|[a-z0-9]{24,}|\d[\d\s]+)$/i.test(base);
  return {
    title: base && !generic ? base : `예수의 강하 ${String(index).padStart(2, '0')}`,
    artist: '',
    year: '',
    sortYear: 9999,
    movement: '',
    description: '연도와 사조를 확정하지 못한 이미지입니다. 다운로드 파일 기준으로 예수의 강하 항목에 순서대로 나열했습니다.',
    known: false
  };
}

function imageHash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const data = JSON.parse(fs.readFileSync(topicsFile, 'utf8'));
const files = fs.readdirSync(downloadDir)
  .filter(name => imageExtensions.has(path.extname(name).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, 'ko'));

fs.mkdirSync(topicImageDir, {recursive: true});
for (const entry of fs.readdirSync(topicImageDir)) {
  if (/^jesus-descent-\d+-/i.test(entry)) fs.unlinkSync(path.join(topicImageDir, entry));
}
const seenHashes = new Set();
const entries = [];
for (const name of files) {
  const source = path.join(downloadDir, name);
  const hash = imageHash(source);
  if (seenHashes.has(hash)) continue;
  seenHashes.add(hash);
  const metadata = inferredWork(name, entries.length + 1);
  const category = metadata.sortYear < 9999 ? 0 : (metadata.known ? 1 : 2);
  entries.push({name, source, metadata, category});
}

entries.sort((a, b) =>
  a.category - b.category ||
  (a.metadata.sortYear || 9999) - (b.metadata.sortYear || 9999) ||
  a.name.localeCompare(b.name, 'ko')
);

const works = [];
let sequence = 1;
for (const entry of entries) {
  const {name, source, metadata} = entry;
  if (!metadata.known && /^예수의 강하 \d+$/.test(metadata.title)) metadata.title = `예수의 강하 ${String(sequence).padStart(2, '0')}`;
  const ext = path.extname(name).toLowerCase() || '.jpg';
  const outName = `jesus-descent-${String(sequence).padStart(2, '0')}-${slug(metadata.artist || metadata.title)}${ext}`;
  const relative = `data/topic-images/${outName}`;
  fs.copyFileSync(source, path.join(root, relative));
  works.push({
    id: `jesus-descent-${String(sequence).padStart(2, '0')}`,
    sequence,
    title: metadata.title,
    artist: metadata.artist,
    year: metadata.year,
    sortYear: metadata.sortYear,
    movement: metadata.movement,
    thumbnail: relative,
    description: metadata.description,
    sourceFile: name
  });
  sequence += 1;
}

const topic = {
  id: topicId,
  name: {ko: '예수 - 강하', en: 'Jesus - Descent from the Cross'},
  keywords: ['예수', '그리스도', '강하', '십자가에서 내려지는 그리스도', '십자가의 길', '제13처', 'deposition', 'descent from the cross', 'jesus'],
  description: {
    ko: '예수가 십자가에서 내려지는 장면을 다룬 이미지들을 모았습니다. 연도와 사조를 확정할 수 없는 이미지는 정보 없이 순서대로 나열했습니다.'
  },
  works
};

const topics = Array.isArray(data.topics) ? data.topics : [];
const index = topics.findIndex(item => item.id === topicId);
if (index >= 0) topics[index] = topic;
else topics.push(topic);

fs.writeFileSync(topicsFile, `${JSON.stringify({...data, topics}, null, 2)}\n`, 'utf8');
console.log(`Imported topic "${topic.name.ko}" with ${works.length} images`);
