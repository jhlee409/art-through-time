const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q9440';
const qid = 'Q9440';
const thumbnailDir = path.join(root, 'data', 'thumbnails', artistId);
const relativeThumbnailDir = `data/thumbnails/${artistId}`;
const now = new Date().toISOString();

const worksToAdd = [
  {
    id: 'veronese-st-mark-crowning-the-virtues-1554',
    file: 'St. Mark Crowning the Virtue 1554.jpg',
    out: 'veronese-st-mark-crowning-the-virtues-1554.jpg',
    year: 1554,
    popularity: 9400,
    title: {ko: '성 마르코가 신학적 덕목들에 관을 씌우다', en: 'St. Mark Crowning the Virtues'},
    description: {
      ko: '두칼레 궁전 부솔라 홀 천장을 위해 그린 알레고리화로, 성 마르코가 믿음·희망·사랑을 상징하는 덕목들을 공화국의 도덕적 질서로 끌어올립니다.',
      en: 'A ceiling allegory for the Doge’s Palace in which Saint Mark crowns the theological virtues, linking Venetian civic authority to moral order.'
    },
    technique: {ko: '천장화, 알레고리, 단축법, 베네치아 공화국 상징', en: 'Ceiling painting, allegory, foreshortening, Venetian civic symbolism'},
    collection: [{ko: '루브르 박물관, 파리', en: 'Musée du Louvre, Paris'}],
    sources: [
      'https://commons.wikimedia.org/wiki/File:Saint_Marc_r%C3%A9compensant_les_vertus_-_Paul_V%C3%A9ron%C3%A8se_-_Mus%C3%A9e_du_Louvre_Peintures_INV_148.jpg',
      'https://www.cavallinitoveronese.co.uk/veronese/'
    ],
    representative: true,
    movementContribution: true
  },
  {
    id: 'veronese-wedding-feast-at-cana-1562-1563',
    file: 'The Wedding at Cana 1563.jpg',
    out: 'veronese-wedding-feast-at-cana-1562-1563.jpg',
    year: 1562,
    yearEnd: 1563,
    popularity: 10000,
    title: {ko: '가나의 혼인잔치', en: 'The Wedding Feast at Cana'},
    description: {
      ko: '산 조르조 마조레 수도원 식당을 위해 제작된 거대한 연회 장면으로, 성서 이야기를 베네치아식 건축 무대와 화려한 동시대 복식 속에 펼칩니다.',
      en: 'A monumental refectory painting that transposes the biblical wedding at Cana into a lavish Venetian architectural stage and contemporary dress.'
    },
    technique: {ko: '대형 텔레로, 건축적 무대, 연회 장면, 베네치아 색채', en: 'Large telero, architectural staging, banquet scene, Venetian colour'},
    collection: [{ko: '루브르 박물관, 파리', en: 'Musée du Louvre, Paris'}],
    sources: [
      'https://collections.louvre.fr/en/ark:/53355/cl010064382',
      'https://www.louvre.fr/en/explore/visitor-trails/the-louvre-s-masterpieces/a-superstar-and-a-wedding-crowd',
      'https://boutique.louvre.fr/en/product/33646-poster-paolo-veronese-the-wedding-feast-at-cana-50-70-cm.html'
    ],
    representative: true,
    movementContribution: true
  }
];

function sourceFor(file) {
  return `local file: ${path.join(downloadDir, file)}`;
}

function workEntry(work) {
  const image = `${relativeThumbnailDir}/${work.out}`;
  const localSource = sourceFor(work.file);
  const sourceUrls = [...new Set([
    ...work.sources,
    'https://en.wikipedia.org/wiki/Paolo_Veronese',
    'https://www.wikidata.org/wiki/Q9440'
  ])];
  return {
    id: work.id,
    year: work.year,
    ...(work.yearEnd ? {yearEnd: work.yearEnd} : {}),
    popularity: work.popularity,
    title: work.title,
    description: work.description,
    technique: work.technique,
    medium: {ko: '유화', en: 'Oil on canvas'},
    country: {ko: '이탈리아', en: 'Italy'},
    movement: {ko: '베네치아 르네상스', en: 'Venetian Renaissance'},
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
      subtitle: {ko: '다운로드 폴더의 로컬 이미지로 추가한 베로네세 작품', en: 'A Veronese work added from the local download folder'},
      description: work.description,
      technique: work.technique,
      sources: [...sourceUrls, localSource],
      facts: {
        artist: {ko: '파올로 베로네세', en: 'Paolo Veronese'},
        year: work.year,
        ...(work.yearEnd ? {yearEnd: work.yearEnd} : {}),
        country: {ko: '이탈리아', en: 'Italy'},
        movement: {ko: '베네치아 르네상스', en: 'Venetian Renaissance'},
        collection: work.collection
      }
    },
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
        localThumbnail: image,
        highResolution: image,
        sourceUrl: sourceUrls[0] || '',
        sourceUrls,
        checkedAt: now,
        license: '',
        institution: work.collection?.[0]?.en || ''
      }
    }
  };
}

fs.mkdirSync(thumbnailDir, {recursive: true});
const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = data.artists.find(item => item.qid === qid || item.id === artistId);
if (!artist) throw new Error(`Missing artist ${artistId}`);

const indexFile = path.join(thumbnailDir, 'index.json');
const thumbnailIndex = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
const incoming = [];

for (const work of worksToAdd) {
  const source = path.join(downloadDir, work.file);
  if (!fs.existsSync(source)) throw new Error(`Missing download image: ${source}`);
  const target = path.join(thumbnailDir, work.out);
  fs.copyFileSync(source, target);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  thumbnailIndex[work.id] = {
    thumbnail: `${relativeThumbnailDir}/${work.out}`,
    checkedAt: now,
    verifiedBy: `Veronese download folder import: ${work.file}`,
    imageHash: hash
  };
  incoming.push(workEntry(work));
}

const byId = new Map((artist.works || []).map(work => [work.id, work]));
for (const work of incoming) byId.set(work.id, work);
artist.works = [...byId.values()].sort((a, b) =>
  (Number(a.year) || 0) - (Number(b.year) || 0)
  || (Number(a.yearEnd) || Number(a.year) || 0) - (Number(b.yearEnd) || Number(b.year) || 0)
  || String(a.title?.ko || a.title?.en || '').localeCompare(String(b.title?.ko || b.title?.en || ''), 'ko')
);

const validIds = new Set(artist.works.map(work => work.id));
const preferredFeatured = [
  'veronese-wedding-feast-at-cana-1562-1563',
  'veronese-feast-in-the-house-of-levi-1573',
  'veronese-st-mark-crowning-the-virtues-1554'
];
artist.featuredWorkIds = [...new Set([
  ...preferredFeatured,
  ...(Array.isArray(artist.featuredWorkIds) ? artist.featuredWorkIds : [])
])].filter(id => validIds.has(id)).slice(0, 3);

artist.metadata = {
  ...(artist.metadata || {}),
  updatedAt: now,
  updatedBy: 'local download import'
};
data.metadata = {
  ...(data.metadata || {}),
  revision: Number(data.metadata?.revision || 0) + 1,
  updatedAt: now,
  updatedBy: 'local download import'
};

fs.writeFileSync(indexFile, `${JSON.stringify(thumbnailIndex, null, 2)}\n`, 'utf8');
fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Added or updated ${incoming.length} Veronese works from the download folder.`);
