const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q209615';
const qid = 'Q209615';
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const relativeThumbnailDir = `data/images/${artistId}`;
const now = new Date().toISOString();
const actor = 'local download import';
const wiki = 'https://en.wikipedia.org/wiki/Francisco_de_Zurbar%C3%A1n';
const wikidata = 'https://www.wikidata.org/wiki/Q209615';
const country = {ko: '스페인', en: 'Spain'};
const movement = {ko: '바로크', en: 'Baroque'};
const commonSources = [wiki, wikidata];
const artistName = {ko: '프란시스코 데 수르바란', en: 'Francisco de Zurbaran'};

const imageWorks = [
  {
    id: 'zurbaran-crucifixion-with-a-painter',
    file: 'Francisco_de_Zurbarán_046.jpg',
    out: 'zurbaran-crucifixion-with-a-painter.jpg',
    year: 1650,
    popularity: 78,
    title: {ko: '십자가 위의 그리스도와 화가', en: 'Christ on the Cross with a Painter'},
    description: {
      ko: '어둠 속 십자가와 인물을 강한 명암으로 분리해 종교적 응시와 육체의 고통을 절제된 화면으로 묶은 작품입니다.',
      en: 'A crucifixion scene whose severe light isolates Christ and the witness in a restrained image of devotion and bodily suffering.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Francisco_de_Zurbarán_046.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'zurbaran-saint-francis-in-meditation',
    file: 'Francisco_de_Zurbarán_053.jpg',
    out: 'zurbaran-saint-francis-in-meditation.jpg',
    year: 1635,
    yearEnd: 1639,
    popularity: 86,
    title: {ko: '명상하는 성 프란치스코', en: 'Saint Francis in Meditation'},
    description: {
      ko: '무릎 꿇은 수도자의 얼굴과 손, 해골을 극적인 빛으로 드러내며 금욕적 경건과 죽음의 묵상을 강조한 작품입니다.',
      en: 'A meditative image that uses dramatic light on the friar, hands, and skull to stress ascetic devotion and mortality.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    sources: ['local download: Francisco_de_Zurbarán_053.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'zurbaran-saint-bonaventure',
    file: 'Francisco_de_Zurbarán_058.jpg',
    out: 'zurbaran-saint-bonaventure.jpg',
    year: 1629,
    popularity: 70,
    title: {ko: '성 보나벤투라', en: 'Saint Bonaventure'},
    description: {
      ko: '흰 수도복과 어두운 배경의 대비로 학자 성인의 엄격한 정신성과 수도원적 질서를 강조한 단일 인물상입니다.',
      en: 'A single-figure saint image where white monastic cloth and a dark ground create a disciplined spiritual presence.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Francisco_de_Zurbarán_058.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'zurbaran-saint-francis-of-assisi',
    file: "Saint_François_d'Assise_-_Francisco_de_Zurbaran_(A_115).jpg",
    out: 'zurbaran-saint-francis-of-assisi.jpg',
    year: 1630,
    yearEnd: 1635,
    popularity: 82,
    title: {ko: '아시시의 성 프란치스코', en: 'Saint Francis of Assisi'},
    description: {
      ko: '수도복을 입은 성인을 어둠과 단단한 빛 속에 세워 침묵, 금욕, 내면의 경건을 한 인물에 집중시킨 작품입니다.',
      en: 'A standing Franciscan image that concentrates silence, austerity, and inward devotion in one strongly lit figure.'
    },
    collection: [{ko: '리옹 미술관', en: 'Musee des Beaux-Arts de Lyon'}],
    sources: ["local download: Saint_François_d'Assise_-_Francisco_de_Zurbaran_(A_115).jpg"],
    representative: true,
    movementContribution: true
  },
  {
    id: 'zurbaran-saint-serapion-1628',
    file: 'San_Serapio,_por_Francisco_de_Zurbarán.jpg',
    out: 'zurbaran-saint-serapion-1628.jpg',
    year: 1628,
    popularity: 100,
    title: {ko: '성 세라피온', en: 'Saint Serapion'},
    description: {
      ko: '흰 수도복의 물질감과 거의 정지한 순교자의 몸을 어두운 배경에서 떠오르게 한 수르바란의 대표작입니다.',
      en: 'Zurbaran\'s signature martyr image, where a white habit and suspended body emerge from a dark ground with austere force.'
    },
    collection: [{ko: '워즈워스 애서니엄, 하트퍼드', en: 'Wadsworth Atheneum, Hartford'}],
    sources: ['local download: San_Serapio,_por_Francisco_de_Zurbarán.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'zurbaran-body-of-saint-bonaventure',
    file: 'Zurbaran.jpg',
    out: 'zurbaran-body-of-saint-bonaventure.jpg',
    year: 1629,
    popularity: 76,
    title: {ko: '성 보나벤투라의 시신 안치', en: 'The Body of Saint Bonaventure Lying in State'},
    description: {
      ko: '장례 장면을 검은 배경, 흰 수도복, 낮은 감정의 밀도로 구성해 스페인 수도원 바로크의 엄숙함을 보여 줍니다.',
      en: 'A funeral scene organized by black ground, white monastic cloth, and restrained emotion, typical of Spanish monastic Baroque.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Zurbaran.jpg'],
    representative: true,
    movementContribution: true
  }
];

function relativeLocalSource(file) {
  return `local file: ${path.join(downloadDir, file)}`;
}

function workEntry(work) {
  const image = `${relativeThumbnailDir}/${work.out}`;
  const sourceUrls = [...new Set([...work.sources, ...commonSources])];
  const localSource = relativeLocalSource(work.file);
  return {
    id: work.id,
    year: work.year,
    ...(work.yearEnd ? {yearEnd: work.yearEnd} : {}),
    popularity: work.popularity,
    title: work.title,
    description: work.description,
    medium: {ko: '유화', en: 'Oil on canvas'},
    country,
    movement,
    collection: work.collection,
    image,
    thumbnail: image,
    thumbnailValidation: 2,
    thumbnailCacheKey: now,
    highRes: image,
    highResImage: image,
    highResOriginal: image,
    source: `${sourceUrls.join('; ')}; ${localSource}`,
    verified: true,
    status: 'verified',
    representative: Boolean(work.representative),
    movementContribution: Boolean(work.movementContribution),
    origin: 'manual',
    detail: {
      schemaVersion: 2,
      title: work.title,
      subtitle: {
        ko: '스페인 바로크의 금욕적 경건과 극적인 명암을 보여 주는 수르바란 작품',
        en: 'A Zurbaran work showing Spanish Baroque ascetic devotion and dramatic light'
      },
      description: work.description,
      sources: [...sourceUrls, localSource],
      facts: {
        artist: artistName,
        year: work.year,
        ...(work.yearEnd ? {yearEnd: work.yearEnd} : {}),
        country,
        movement,
        collection: work.collection
      }
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor
    },
    migration: {
      schema: 1,
      image: {
        status: 'ready',
        localThumbnail: image,
        highResolution: image,
        sourceUrl: sourceUrls.find(value => /^https?:\/\//i.test(value)) || wiki,
        sourceUrls: sourceUrls.filter(value => /^https?:\/\//i.test(value)),
        checkedAt: now,
        license: '',
        institution: work.collection?.[0]?.en || ''
      }
    }
  };
}

fs.mkdirSync(thumbnailDir, {recursive: true});
const works = [];
const thumbnailIndex = {};
for (const work of imageWorks) {
  const source = path.join(downloadDir, work.file);
  if (!fs.existsSync(source)) throw new Error(`Missing download image: ${source}`);
  const target = path.join(thumbnailDir, work.out);
  fs.copyFileSync(source, target);
  const entry = workEntry(work);
  works.push(entry);
  thumbnailIndex[work.id] = {
    thumbnail: entry.thumbnail,
    checkedAt: now,
    verifiedBy: `Zurbaran local file import; ${wiki}`,
    imageHash: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
  };
}
works.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
fs.writeFileSync(path.join(thumbnailDir, 'index.json'), `${JSON.stringify(thumbnailIndex, null, 2)}\n`, 'utf8');

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const previous = data.artists.find(item => item.qid === qid || item.id === artistId);
const artist = {
  id: artistId,
  qid,
  name: artistName,
  fullName: '수르바란, 프란시스코 데',
  birth: 1598,
  death: 1664,
  nationality: country,
  birthCountry: {ko: '스페인 푸엔테 데 칸토스', en: 'Fuente de Cantos, Spain'},
  movement,
  aliases: {
    ko: ['수르바란', '프란시스코 수르바란', '프란시스코 데 수르바란'],
    en: ['Zurbaran', 'Zurbarán', 'Francisco Zurbaran', 'Francisco de Zurbarán', 'Francisco de Zurbaran Salazar']
  },
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata
  },
  works,
  featuredWorkIds: [
    'zurbaran-saint-serapion-1628',
    'zurbaran-saint-francis-in-meditation',
    'zurbaran-saint-francis-of-assisi',
    'zurbaran-body-of-saint-bonaventure'
  ],
  metadata: {
    createdAt: previous?.metadata?.createdAt || now,
    updatedAt: now,
    createdBy: previous?.metadata?.createdBy || actor,
    updatedBy: actor
  }
};

const index = data.artists.findIndex(item => item.qid === qid || item.id === artistId);
if (index >= 0) data.artists[index] = artist;
else data.artists.push(artist);

data.artists.sort((a, b) => (Number(a.birth) || 99999) - (Number(b.birth) || 99999) || String(a.name?.ko || '').localeCompare(String(b.name?.ko || ''), 'ko'));
data.metadata = {
  ...(data.metadata || {}),
  revision: Number(data.metadata?.revision || 0) + 1,
  updatedAt: now,
  updatedBy: actor
};

fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported Zurbaran with ${works.length} local works.`);
