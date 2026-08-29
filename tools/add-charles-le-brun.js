const fs = require('node:fs');
const path = require('node:path');

const { downloadDirectories } = require('./local-image-sources');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const artistId = 'artist-Q170170';
const qid = 'Q170170';
const now = new Date().toISOString();
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const textSources = ['https://en.wikipedia.org/wiki/Charles_Le_Brun', `https://www.wikidata.org/wiki/${qid}`];

const works = [
  {
    id: 'le-brun-queens-of-persia-at-the-feet-of-alexander-1660-1661',
    fileIncludes: 'Les_reines_de_Perse_aux_pieds_d',
    title: {ko:'알렉산드로스 앞에 엎드린 페르시아 왕비들', en:'The Queens of Persia at the Feet of Alexander'},
    year: 1661,
    description: '알렉산드로스의 관용을 장대한 역사화 구도로 연출해 루이 14세 시대의 국가적 영웅 이미지를 암시한다.',
    popularity: 96,
    representative: true
  },
  {
    id: 'le-brun-entry-of-alexander-into-babylon-1665',
    fileIncludes: 'Alexandre_dans_Babylone',
    title: {ko:'알렉산드로스의 바빌론 입성', en:'The Entry of Alexander into Babylon'},
    year: 1665,
    description: '행렬과 건축, 승리의 제스처를 결합해 왕권의 장엄함을 시각화한 알렉산드로스 연작의 대표 장면이다.',
    popularity: 92,
    representative: true
  },
  {
    id: 'le-brun-chancellor-seguier-1660',
    fileIncludes: 'chancelier',
    title: {ko:'세기에 재상', en:'Chancellor Séguier'},
    year: 1660,
    description: '재상 피에르 세기에의 기마 행렬을 궁정적 위엄과 장식적 리듬으로 묘사한 프랑스 바로크 초상화다.',
    popularity: 90,
    representative: true
  },
  {
    id: 'le-brun-daedalus-and-icarus-1645',
    fileIncludes: 'Daedalus_and_Icarus',
    title: {ko:'다이달로스와 이카로스', en:'Daedalus and Icarus'},
    year: 1645,
    description: '고전 신화를 교훈적 서사와 균형 잡힌 인물 배치로 풀어낸 초기 작품이다.',
    popularity: 78
  },
  {
    id: 'le-brun-capture-of-ghent-1678',
    fileIncludes: 'citadelle_de_Gand',
    title: {ko:'6일 만에 이루어진 겐트 시와 요새 점령', en:'The Capture of the City and Citadel of Ghent in Six Days'},
    year: 1678,
    description: '루이 14세의 군사적 성공을 역사화 형식으로 기념한 전투화다.',
    popularity: 82
  },
  {
    id: 'le-brun-venus-clipping-cupids-wings-1650',
    fileIncludes: 'Venus_cort',
    title: {ko:'쿠피도의 날개를 자르는 비너스', en:'Venus Clipping Cupid’s Wings'},
    year: 1650,
    description: '사랑의 알레고리를 명료한 신체 표현과 극적인 제스처로 구성한 신화화다.',
    popularity: 76
  },
  {
    id: 'le-brun-alexander-and-porus-1673',
    fileIncludes: 'Alexander_and_Porus',
    title: {ko:'알렉산드로스와 포로스', en:'Alexander and Porus'},
    year: 1673,
    description: '정복자와 패자의 만남을 장엄한 궁정 역사화 문법으로 재구성한 알렉산드로스 주제 작품이다.',
    popularity: 84
  },
  {
    id: 'le-brun-apotheosis-of-louis-xiv-1677',
    fileIncludes: 'Charles_Le_Brun_001',
    title: {ko:'루이 14세의 신격화', en:'Apotheosis of Louis XIV'},
    year: 1677,
    description: '루이 14세를 고전적 영웅과 신화적 알레고리로 끌어올린 궁정 선전 이미지다.',
    popularity: 88,
    representative: true
  },
  {
    id: 'le-brun-equestrian-portrait-of-louis-xiv-1650',
    fileIncludes: 'Louis_XIV_Equestrian_Portrait',
    title: {ko:'루이 14세의 기마 초상', en:'Equestrian Portrait of Louis XIV'},
    year: 1650,
    description: '젊은 루이 14세의 군주적 위엄을 전장과 기마 초상 형식으로 결합한 궁정 초상화다.',
    popularity: 86,
    representative: true
  }
];

function normalize(value) {
  return String(value || '').toLocaleLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
}

function findDownloadFile(needle) {
  const wanted = normalize(needle);
  for (const folder of downloadDirectories()) {
    const queue = [folder];
    while (queue.length) {
      const current = queue.shift();
      for (const entry of fs.readdirSync(current, {withFileTypes:true})) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) queue.push(absolute);
        else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
          if (normalize(entry.name).includes(wanted)) return absolute;
        }
      }
    }
  }
  return '';
}

function copyWorkImage(work, source) {
  const extension = path.extname(source).toLowerCase() === '.jpeg' ? '.jpg' : path.extname(source).toLowerCase();
  const destinationDir = path.join(root, 'data', 'images', artistId);
  const destination = path.join(destinationDir, `${work.id}${extension}`);
  fs.mkdirSync(destinationDir, {recursive:true});
  fs.copyFileSync(source, destination);
  return path.relative(root, destination).replace(/\\/g, '/');
}

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
if (data.artists.some(artist => artist.id === artistId || artist.qid === qid)) {
  console.log('Charles Le Brun already exists; no changes made.');
  process.exit(0);
}

const importedWorks = [];
const missing = [];
for (const work of works) {
  const source = findDownloadFile(work.fileIncludes);
  if (!source) {
    missing.push(work.id);
    continue;
  }
  const localPath = copyWorkImage(work, source);
  importedWorks.push({
    id: work.id,
    year: work.year,
    popularity: work.popularity,
    title: work.title,
    description: {ko:work.description, en:''},
    detail: {sources:textSources},
    medium: {ko:'유화', en:'Oil painting'},
    country: {ko:'프랑스', en:'France'},
    movement: {ko:'바로크', en:'Baroque'},
    image: localPath,
    thumbnail: localPath,
    highResImage: localPath,
    highResOriginal: localPath,
    source: `local download: ${path.basename(source)}`,
    verified: true,
    status: 'verified',
    representative: Boolean(work.representative),
    movementContribution: true,
    origin: 'manual',
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: 'local download import',
      updatedBy: 'local download import'
    },
    migration: {
      schema: 1,
      image: {
        status: 'ready',
        localThumbnail: localPath,
        highResolution: localPath,
        sourceUrl: '',
        sourceUrls: textSources,
        license: '',
        institution: ''
      }
    }
  });
}

if (!importedWorks.length) {
  throw new Error('No Charles Le Brun local image files were found in the configured download folders.');
}

data.artists.push({
  id: artistId,
  qid,
  name: {ko:'샤를 르브룅', en:'Charles Le Brun'},
  fullName: '샤를 르브룅',
  birth: 1619,
  death: 1690,
  nationality: {ko:'프랑스', en:'France'},
  birthCountry: {ko:'프랑스', en:'France'},
  movement: {ko:'바로크', en:'Baroque'},
  aliases: {ko:['르브룅', '샤를 르 브룅'], en:['Le Brun', 'Charles Lebrun']},
  artistSummary: {
    ko: [
      '니콜라 푸생에게서 큰 영향을 받은 프랑스 바로크 화가로, 베르사유 궁전과 특히 거울의 방 장식으로 유명하다.',
      '루이 14세의 궁정 화가였으며, 1648년 프랑스 왕립 회화 및 조각 아카데미 설립을 주도했다.',
      '루이 14세 스타일의 형성에 핵심적 역할을 했고, 대형 제단화와 전투화, 국가적 역사화를 제작했다.'
    ],
    en: []
  },
  links: {
    wikipedia: 'https://en.wikipedia.org/wiki/Charles_Le_Brun',
    wikidata: `https://www.wikidata.org/wiki/${qid}`
  },
  works: importedWorks,
  featuredWorkIds: importedWorks.filter(work => work.representative).map(work => work.id),
  profileResolved: true,
  metadata: {
    createdAt: now,
    updatedAt: now,
    createdBy: 'local download import',
    updatedBy: 'local download import'
  },
  movements: ['바로크'],
  submovements: ['프랑스 바로크'],
  primaryMovement: '바로크',
  regions: ['프랑스'],
  periods: ['1600-1700'],
  activeFrom: 1640,
  activeTo: 1690
});

data.metadata = {
  ...(data.metadata || {}),
  updatedAt: now,
  revision: (Number(data.metadata?.revision) || 0) + 1
};

fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({added:artistId, imported:importedWorks.length, missing}, null, 2));
