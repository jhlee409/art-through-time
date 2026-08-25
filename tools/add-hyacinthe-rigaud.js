const fs = require('node:fs');
const path = require('node:path');

const { downloadDirectories } = require('./local-image-sources');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const artistId = 'artist-Q49898';
const qid = 'Q49898';
const now = new Date().toISOString();
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const textSources = [
  'https://www.chateauversailles.fr/decouvrir/histoire/grands-personnages/hyacinthe-rigaud',
  'https://www.chateauversailles.fr/ressources-pedagogiques/domaines-artistiques/peinture/louis-xiv-grand-costume-royal-hyacinthe-rigaud',
  `https://www.wikidata.org/wiki/${qid}`
];

const work = {
  id: 'rigaud-louis-xiv-royal-costume-1701',
  fileIncludes: 'Hyacinthe_Rigaud_-_Louis_XIV',
  title: { ko: '루이 14세의 초상', en: 'Portrait of Louis XIV' },
  year: 1701,
  description:
    '대관 예복, 왕권 표장, 극적인 직물과 자세를 결합해 프랑스 절대왕정의 공식 이미지를 확정한 초상화다.',
  popularity: 99,
  collection: { ko: '루브르 박물관, 파리', en: 'Louvre Museum, Paris' }
};

function normalize(value) {
  return String(value || '').toLocaleLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
}

function findDownloadFile(needle) {
  const wanted = normalize(needle);
  for (const folder of downloadDirectories()) {
    if (!fs.existsSync(folder)) continue;
    const queue = [folder];
    while (queue.length) {
      const current = queue.shift();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
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

function copyWorkImage(source) {
  const extension = path.extname(source).toLowerCase() === '.jpeg' ? '.jpg' : path.extname(source).toLowerCase();
  const destinationDir = path.join(root, 'data', 'thumbnails', artistId);
  const destination = path.join(destinationDir, `${work.id}${extension}`);
  fs.mkdirSync(destinationDir, { recursive: true });
  fs.copyFileSync(source, destination);
  return path.relative(root, destination).replace(/\\/g, '/');
}

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
if (data.artists.some(artist => artist.id === artistId || artist.qid === qid)) {
  console.log('Hyacinthe Rigaud already exists; no changes made.');
  process.exit(0);
}

const source = findDownloadFile(work.fileIncludes);
if (!source) {
  throw new Error('No Hyacinthe Rigaud local image file was found in the configured download folders.');
}

const localPath = copyWorkImage(source);
data.artists.push({
  id: artistId,
  qid,
  name: { ko: '야생트 리고', en: 'Hyacinthe Rigaud' },
  fullName: '야생트 리고',
  birth: 1659,
  death: 1743,
  nationality: { ko: '프랑스', en: 'France' },
  birthCountry: { ko: '스페인 제국령 카탈루냐(페르피냥)', en: 'Perpignan, Spanish Empire' },
  movement: { ko: '바로크', en: 'Baroque' },
  aliases: {
    ko: ['이아생트 리고', '히아생트 리고', '아생트 리고', '야생트 리고'],
    en: ['Hyacinthe Rigaud', 'Hyacinthe Rigault', 'Hyacinthe Rigaud y Ros']
  },
  artistSummary: {
    ko: [
      '페르피냥에서 태어난 카탈루냐계 화가로, 1681년 파리에 정착해 루이 14세와 궁정 귀족의 공식 초상을 그렸다.',
      '샤를 르브룅의 조언에 따라 초상화에 집중했고, 대관 예복을 입은 루이 14세의 초상으로 프랑스 절대왕정의 시각적 표준을 세웠다.',
      '장엄한 자세, 화려한 직물, 왕권 표장을 결합해 프랑스 바로크의 궁정 초상 문법을 유럽 전역에 확산시켰다.'
    ],
    en: []
  },
  links: {
    wikipedia: 'https://en.wikipedia.org/wiki/Hyacinthe_Rigaud',
    wikidata: `https://www.wikidata.org/wiki/${qid}`,
    versailles: 'https://www.chateauversailles.fr/decouvrir/histoire/grands-personnages/hyacinthe-rigaud'
  },
  works: [
    {
      id: work.id,
      year: work.year,
      popularity: work.popularity,
      title: work.title,
      description: { ko: work.description, en: '' },
      detail: { sources: textSources },
      medium: { ko: '캔버스에 유화', en: 'Oil on canvas' },
      country: { ko: '프랑스', en: 'France' },
      movement: { ko: '바로크', en: 'Baroque' },
      collection: [work.collection],
      image: localPath,
      thumbnail: localPath,
      highResImage: localPath,
      highResOriginal: localPath,
      source: `local download: ${path.basename(source)}`,
      verified: true,
      status: 'verified',
      representative: true,
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
    }
  ],
  featuredWorkIds: [work.id],
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
  periods: ['1650-1750'],
  activeFrom: 1681,
  activeTo: 1743
});

data.metadata = {
  ...(data.metadata || {}),
  updatedAt: now,
  revision: (Number(data.metadata?.revision) || 0) + 1
};

fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ added: artistId, imported: 1, source }, null, 2));
