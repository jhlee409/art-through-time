const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q167654';
const qid = 'Q167654';
const thumbnailDir = path.join(root, 'data', 'thumbnails', artistId);
const relativeThumbnailDir = `data/thumbnails/${artistId}`;
const now = new Date().toISOString();
const actor = 'local download import';
const wiki = 'https://en.wikipedia.org/wiki/Frans_Hals';
const wikidata = 'https://www.wikidata.org/wiki/Q167654';
const country = {ko: '네덜란드', en: 'Netherlands'};
const movement = {ko: '바로크', en: 'Baroque'};
const commonSources = [wiki, wikidata];

const imageWorks = [
  {
    id: 'frans-hals-laughing-cavalier-1624',
    file: 'Cavalier_soldier_Hals-1624x.jpg',
    out: 'frans-hals-laughing-cavalier-1624.jpg',
    year: 1624,
    popularity: 100,
    title: {ko: '웃는 기사', en: 'The Laughing Cavalier'},
    description: {
      ko: '화려한 의상과 순간적인 표정을 빠른 붓질로 살린 할스의 대표 초상화입니다.',
      en: 'A signature Hals portrait whose lively expression and flashing costume textures show his quick, open brushwork.'
    },
    collection: [{ko: '월리스 컬렉션, 런던', en: 'Wallace Collection, London'}],
    sources: ['local download: Cavalier_soldier_Hals-1624x.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'frans-hals-banquet-st-george-1616',
    file: 'Frans_Hals_-_Banket_van_de_officieren_van_de_Sint-Joris-Doelen.jpg',
    out: 'frans-hals-banquet-st-george-1616.jpg',
    year: 1616,
    popularity: 85,
    title: {ko: '성 게오르기우스 시민경비대 장교들의 연회', en: 'Banquet of the Officers of the St George Civic Guard'},
    description: {
      ko: '하를럼 시민 경비대의 집단 초상을 연회 장면처럼 생동감 있게 구성한 초기 대작입니다.',
      en: 'An early civic-guard group portrait staged as a lively banquet rather than a static roll call.'
    },
    collection: [{ko: '프란스 할스 미술관, 하를럼', en: 'Frans Hals Museum, Haarlem'}],
    sources: ['local download: Frans_Hals_-_Banket_van_de_officieren_van_de_Sint-Joris-Doelen.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'frans-hals-merry-drinker-1628',
    file: 'Frans_Hals_002.jpg',
    out: 'frans-hals-merry-drinker-1628.jpg',
    year: 1628,
    popularity: 80,
    title: {ko: '즐거운 술꾼', en: 'The Merry Drinker'},
    description: {
      ko: '잔을 든 인물의 웃음과 몸짓을 즉흥적인 활력으로 포착한 네덜란드 시민 초상입니다.',
      en: 'A spirited portrait that turns a raised glass and broad smile into a moment of social immediacy.'
    },
    collection: [{ko: '암스테르담 국립미술관', en: 'Rijksmuseum, Amsterdam'}],
    sources: ['local download: Frans_Hals_002.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'frans-hals-banquet-st-hadrian-1627',
    file: 'Frans_Hals_-_Banquet_of_the_Officers_of_the_St_Hadrian_Civic_Guard_Company_-_WGA11092.jpg',
    out: 'frans-hals-banquet-st-hadrian-1627.jpg',
    year: 1627,
    popularity: 72,
    title: {ko: '성 하드리아누스 시민경비대 장교들의 연회', en: 'Banquet of the Officers of the St Hadrian Civic Guard Company'},
    description: {
      ko: '집단 초상에 시선의 교차와 느슨한 대화를 넣어 시민 공동체의 활기를 보여준 작품입니다.',
      en: 'A civic-guard banquet animated by intersecting glances, informal grouping, and conversational movement.'
    },
    collection: [{ko: '프란스 할스 미술관, 하를럼', en: 'Frans Hals Museum, Haarlem'}],
    sources: ['local download: Frans_Hals_-_Banquet_of_the_Officers_of_the_St_Hadrian_Civic_Guard_Company_-_WGA11092.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'frans-hals-jester-with-lute-1623',
    file: 'Frans_Hals_-_Luitspelende_nar.jpg',
    out: 'frans-hals-jester-with-lute-1623.jpg',
    year: 1623,
    popularity: 70,
    title: {ko: '류트를 연주하는 광대', en: 'Jester with a Lute'},
    description: {
      ko: '노래와 몸짓이 막 터져 나오는 듯한 순간을 빠른 붓질과 밝은 표정으로 붙잡은 풍속적 초상입니다.',
      en: 'A genre-like portrait that catches song, gesture, and expression in a burst of quick handling.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Frans_Hals_-_Luitspelende_nar.jpg'],
    representative: true,
    movementContribution: false
  },
  {
    id: 'frans-hals-portrait-rene-descartes-1649',
    file: 'Frans_Hals_-_Portret_van_René_Descartes.jpg',
    out: 'frans-hals-portrait-rene-descartes-1649.jpg',
    year: 1649,
    popularity: 60,
    title: {ko: '르네 데카르트의 초상', en: 'Portrait of Rene Descartes'},
    description: {
      ko: '검은 의상과 절제된 표정 속에서 사상가의 인상을 간결하게 잡아낸 초상화입니다.',
      en: 'A compact portrait that gives the philosopher a restrained presence through dark dress and direct expression.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Frans_Hals_-_Portret_van_René_Descartes.jpg'],
    representative: false,
    movementContribution: false
  },
  {
    id: 'frans-hals-regentesses-old-mens-almshouse-1664',
    file: 'Frans_Hals_-_De_regentessen_van_het_oudemannenhuis.jpg',
    out: 'frans-hals-regentesses-old-mens-almshouse-1664.jpg',
    year: 1664,
    popularity: 68,
    title: {ko: '노인 구빈원 여자 이사들', en: "Regentesses of the Old Men's Almshouse"},
    description: {
      ko: '절제된 검은 의상과 노년의 표정을 빠르고 냉정한 붓질로 묶어낸 말년의 집단 초상입니다.',
      en: 'A late group portrait where austere black dress and aged faces are held together by brisk, unsentimental paint.'
    },
    collection: [{ko: '프란스 할스 미술관, 하를럼', en: 'Frans Hals Museum, Haarlem'}],
    sources: ['local download: Frans_Hals_-_De_regentessen_van_het_oudemannenhuis.jpg'],
    representative: true,
    movementContribution: false
  }
];

function relativeLocalSource(file) {
  return `local file: ${path.join(downloadDir, file)}`;
}

function copyLocalImage(source, target) {
  fs.copyFileSync(source, target);
}

function workEntry(work) {
  const image = `${relativeThumbnailDir}/${work.out}`;
  const sourceUrls = [...new Set([...work.sources, ...commonSources])];
  const localSource = relativeLocalSource(work.file);
  return {
    id: work.id,
    year: work.year,
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
      subtitle: {ko: '네덜란드 바로크의 즉흥적 붓질과 시민 초상 문화를 보여 주는 프란스 할스 작품', en: 'A Frans Hals work showing Dutch Baroque brushwork and civic portrait culture'},
      description: work.description,
      sources: [...sourceUrls, localSource],
      facts: {
        artist: {ko: '프란스 할스', en: 'Frans Hals'},
        year: work.year,
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
        sourceUrl: sourceUrls[0] || wiki,
        sourceUrls,
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
  copyLocalImage(source, target);
  const entry = workEntry(work);
  works.push(entry);
  thumbnailIndex[work.id] = {
    thumbnail: entry.thumbnail,
    checkedAt: now,
    verifiedBy: `Frans Hals local file import; ${wiki}`,
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
  name: {ko: '프란스 할스', en: 'Frans Hals'},
  fullName: '할스, 프란스',
  birth: 1582,
  death: 1666,
  nationality: country,
  birthCountry: {ko: '스페인령 네덜란드 안트베르펜', en: 'Antwerp, Spanish Netherlands'},
  movement,
  aliases: {
    ko: ['할스'],
    en: ['Hals', 'Frans Hals the Elder', 'Frans Franchoisz Hals']
  },
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata
  },
  works,
  featuredWorkIds: [
    'frans-hals-laughing-cavalier-1624',
    'frans-hals-banquet-st-george-1616',
    'frans-hals-merry-drinker-1628',
    'frans-hals-banquet-st-hadrian-1627',
    'frans-hals-regentesses-old-mens-almshouse-1664'
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
console.log(`Imported Frans Hals with ${works.length} local works.`);
