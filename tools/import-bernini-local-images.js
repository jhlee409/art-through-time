const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q160538';
const qid = 'Q160538';
const wiki = 'https://en.wikipedia.org/wiki/Gian_Lorenzo_Bernini';
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const relativeThumbnailDir = `data/images/${artistId}`;
const now = new Date().toISOString();

const imageWorks = [
  {
    id: 'bernini-rape-of-proserpina-1621-1622',
    file: 'Rape_of_Prosepina_September_2015-3a.jpg',
    out: 'bernini-rape-of-proserpina-1621-1622.jpg',
    year: 1621,
    yearEnd: 1622,
    popularity: 9800,
    title: {ko: '프로세르피나의 납치', en: 'The Rape of Proserpina'},
    subtitle: {ko: '대리석을 살처럼 보이게 한 초기 바로크 조각', en: 'Early Baroque marble made to feel like living flesh'},
    description: {
      ko: '보르게세 미술관의 대리석 군상으로, 손가락이 살을 파고드는 듯한 촉각성과 회전하는 동세가 베르니니 초기 바로크 조각의 극적인 현장감을 보여줍니다.',
      en: 'A Galleria Borghese marble group whose tactile handling of flesh and spiraling motion show Bernini’s early Baroque drama.'
    },
    collection: [{ko: '보르게세 미술관, 로마', en: 'Galleria Borghese, Rome'}],
    representative: true
  },
  {
    id: 'bernini-apollo-and-daphne-1622-1625',
    file: 'Apollo_and_Daphne_(Bernini)_(cropped).jpg',
    out: 'bernini-apollo-and-daphne-1622-1625.png',
    year: 1622,
    yearEnd: 1625,
    popularity: 10000,
    title: {ko: '아폴론과 다프네', en: 'Apollo and Daphne'},
    subtitle: {ko: '변신의 순간을 붙잡은 바로크 조각', en: 'A Baroque sculpture catching the instant of transformation'},
    description: {
      ko: '다프네가 월계수로 변하는 찰나를 대리석의 잎, 머리카락, 피부로 동시에 표현한 작품입니다. 서사적 절정과 관람자의 이동 시점이 결합된 베르니니의 대표작입니다.',
      en: 'A sculpture that turns Daphne’s transformation into marble leaves, hair, and skin, joining narrative climax with the viewer’s moving viewpoint.'
    },
    collection: [{ko: '보르게세 미술관, 로마', en: 'Galleria Borghese, Rome'}],
    representative: true
  },
  {
    id: 'bernini-david-1623-1624',
    file: "Bernini's_David_02.jpg",
    out: 'bernini-david-1623-1624.png',
    year: 1623,
    yearEnd: 1624,
    popularity: 9600,
    title: {ko: '다비드', en: 'David'},
    subtitle: {ko: '행동 직전의 긴장으로 바뀐 영웅상', en: 'A heroic figure transformed into a moment of action'},
    description: {
      ko: '돌을 던지기 직전 몸을 비트는 다비드를 묘사한 조각입니다. 정면의 안정된 영웅상이 아니라 관람 공간까지 끌어들이는 힘과 긴장으로 바로크 조각의 방향을 보여줍니다.',
      en: 'Bernini shows David twisting just before the throw, replacing static heroic calm with force, tension, and an implied surrounding space.'
    },
    collection: [{ko: '보르게세 미술관, 로마', en: 'Galleria Borghese, Rome'}]
  },
  {
    id: 'bernini-ecstasy-of-saint-teresa-1647-1652',
    file: 'Ecstasy_of_St._Teresa_HDR.jpg',
    out: 'bernini-ecstasy-of-saint-teresa-1647-1652.jpg',
    year: 1647,
    yearEnd: 1652,
    popularity: 9900,
    title: {ko: '성 테레사의 황홀경', en: 'Ecstasy of Saint Teresa'},
    subtitle: {ko: '조각, 건축, 빛이 합쳐진 종교적 극장', en: 'A religious theatre of sculpture, architecture, and light'},
    description: {
      ko: '코르나로 예배당의 조각 장치로, 성인의 신비 체험을 조각, 건축, 숨은 자연광, 관람석 같은 측면 인물군이 함께 연출합니다. 바로크의 종합 예술성을 잘 보여줍니다.',
      en: 'A Cornaro Chapel ensemble where sculpture, architecture, hidden light, and spectator-like side figures stage the saint’s mystical experience.'
    },
    collection: [{ko: '산타 마리아 델라 비토리아, 로마', en: 'Santa Maria della Vittoria, Rome'}],
    representative: true
  },
  {
    id: 'bernini-blessed-ludovica-albertoni-1671-1674',
    file: 'Beata_Ludovica_Albertoni_(Bernini).jpg',
    out: 'bernini-blessed-ludovica-albertoni-1671-1674.jpg',
    year: 1671,
    yearEnd: 1674,
    popularity: 9000,
    title: {ko: '복녀 루도비카 알베르토니', en: 'Blessed Ludovica Albertoni'},
    subtitle: {ko: '후기 베르니니의 신비 체험 표현', en: 'A late Bernini image of mystical experience'},
    description: {
      ko: '산 프란체스코 아 리파의 예배당에 설치된 후기 조각입니다. 침상, 천, 몸짓, 빛을 하나의 장면으로 묶어 죽음과 신비적 황홀의 경계를 극적으로 표현합니다.',
      en: 'A late chapel sculpture in San Francesco a Ripa, combining bed, drapery, gesture, and light to dramatize the threshold between death and mystical ecstasy.'
    },
    collection: [{ko: '산 프란체스코 아 리파, 로마', en: 'San Francesco a Ripa, Rome'}]
  }
];

function sourceFor(file) {
  return `local file: ${path.join(downloadDir, file)}`;
}

function workEntry(work) {
  const image = `${relativeThumbnailDir}/${work.out}`;
  const localSource = sourceFor(work.file);
  return {
    id: work.id,
    year: work.year,
    yearEnd: work.yearEnd,
    popularity: work.popularity,
    title: work.title,
    description: work.description,
    country: {ko: '이탈리아', en: 'Italy'},
    movement: {ko: '바로크', en: 'Baroque'},
    collection: work.collection,
    image,
    thumbnail: image,
    thumbnailValidation: 2,
    thumbnailCacheKey: now,
    highResImage: image,
    highResOriginal: image,
    source: `${wiki}; ${localSource}`,
    verified: true,
    representative: Boolean(work.representative),
    movementContribution: true,
    origin: 'manual',
    detail: {
      schema: 2,
      cachedFromExistingData: true,
      title: work.title,
      subtitle: work.subtitle,
      summary: work.description,
      sources: [wiki, localSource],
      facts: {
        artist: {ko: '잔 로렌초 베르니니', en: 'Gian Lorenzo Bernini'},
        year: work.year,
        country: {ko: '이탈리아', en: 'Italy'},
        movement: {ko: '바로크', en: 'Baroque'},
        collection: work.collection
      }
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: 'local image import',
      updatedBy: 'local image import'
    },
    migration: {
      schema: 1,
      image: {
        status: 'ready',
        localThumbnail: image,
        highResolution: image,
        sourceUrl: wiki,
        sourceUrls: [wiki],
        license: '',
        institution: work.collection?.[0]?.en || ''
      }
    }
  };
}

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const works = imageWorks.map(workEntry);
const artist = {
  id: artistId,
  qid,
  name: {ko: '잔 로렌초 베르니니', en: 'Gian Lorenzo Bernini'},
  fullName: '베르니니, 잔 로렌초',
  birth: 1598,
  death: 1680,
  nationality: {ko: '이탈리아', en: 'Italy'},
  birthCountry: {ko: '나폴리 왕국', en: 'Kingdom of Naples'},
  movement: {ko: '바로크', en: 'Baroque'},
  aliases: {
    ko: ['베르니니', '잔로렌초 베르니니', '조반니 로렌초 베르니니', '베르니니, 잔 로렌초'],
    en: ['Bernini', 'Gianlorenzo Bernini', 'Giovanni Lorenzo Bernini', 'Giovan Lorenzo Bernini']
  },
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata: 'https://www.wikidata.org/wiki/Q160538'
  },
  works,
  featuredWorkIds: [
    'bernini-apollo-and-daphne-1622-1625',
    'bernini-ecstasy-of-saint-teresa-1647-1652',
    'bernini-rape-of-proserpina-1621-1622'
  ],
  metadata: {
    createdAt: now,
    updatedAt: now,
    createdBy: 'local artist import',
    updatedBy: 'local artist import'
  }
};

const index = data.artists.findIndex(item => item.qid === qid || item.id === artistId);
if (index >= 0) data.artists[index] = artist;
else data.artists.push(artist);

const tintoretto = data.artists.find(item => item.qid === 'Q9319');
if (tintoretto) {
  tintoretto.works = (tintoretto.works || []).filter(work => !/^wikidata-/.test(String(work.id || '')));
  delete tintoretto.generated;
}

data.artists.sort((a, b) => (Number(a.birth) || 99999) - (Number(b.birth) || 99999) || String(a.name?.ko || '').localeCompare(String(b.name?.ko || ''), 'ko'));
data.metadata = {
  ...(data.metadata || {}),
  revision: Number(data.metadata?.revision || 0) + 1,
  updatedAt: now,
  updatedBy: 'local artist import'
};

fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const thumbnailIndex = {};
for (const work of works) {
  const file = path.join(root, work.thumbnail);
  thumbnailIndex[work.id] = {
    thumbnail: work.thumbnail,
    checkedAt: now,
    verifiedBy: `Bernini local file import; ${wiki}`,
    imageHash: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  };
}
fs.writeFileSync(path.join(thumbnailDir, 'index.json'), `${JSON.stringify(thumbnailIndex, null, 2)}\n`, 'utf8');

console.log(`Imported Bernini with ${works.length} local works.`);
