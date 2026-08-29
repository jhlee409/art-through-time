const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q297';
const qid = 'Q297';
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const relativeThumbnailDir = `data/images/${artistId}`;
const now = new Date().toISOString();
const actor = 'local download import';
const wiki = 'https://en.wikipedia.org/wiki/Diego_Velazquez';
const wikidata = 'https://www.wikidata.org/wiki/Q297';
const country = {ko: '스페인', en: 'Spain'};
const movement = {ko: '바로크', en: 'Baroque'};
const commonSources = [wiki, wikidata];

const imageWorks = [
  {
    id: 'velazquez-surrender-of-breda-1634-1635',
    file: 'Velazquez-The_Surrender_of_Breda.jpg',
    out: 'velazquez-surrender-of-breda-1634-1635.jpg',
    year: 1634,
    yearEnd: 1635,
    popularity: 94,
    title: {ko: '브레다의 항복', en: 'The Surrender of Breda'},
    description: {
      ko: '승전 장면을 과장된 영웅극보다 절제된 만남과 관대한 제스처로 구성한 역사화입니다.',
      en: 'A history painting that turns military victory into a restrained encounter marked by dignity and clemency.'
    },
    collection: [{ko: '프라도 미술관, 마드리드', en: 'Museo del Prado, Madrid'}],
    sources: ['local download: Velazquez-The_Surrender_of_Breda.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'velazquez-rokeby-venus-1647-1651',
    file: 'Diego_Velázquez_-_Rokeby_Venus.jpg',
    out: 'velazquez-rokeby-venus-1647-1651.jpg',
    year: 1647,
    yearEnd: 1651,
    popularity: 91,
    title: {ko: '로크비 비너스', en: 'Rokeby Venus'},
    description: {
      ko: '거울 속 얼굴과 등을 보인 누드를 통해 신화적 주제와 현실적 육체감, 시선의 구조를 함께 다룬 작품입니다.',
      en: 'A reclining nude that joins myth, bodily presence, and the play of looking through the mirror image.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    sources: ['local download: Diego_Velázquez_-_Rokeby_Venus.jpg'],
    representative: true,
    movementContribution: false
  },
  {
    id: 'velazquez-portrait-pope-innocent-x-1650',
    file: 'Retrato_del_Papa_Inocencio_X._Roma,_by_Diego_Velázquez.jpg',
    out: 'velazquez-portrait-pope-innocent-x-1650.jpg',
    year: 1650,
    popularity: 96,
    title: {ko: '교황 인노첸시오 10세의 초상', en: 'Portrait of Pope Innocent X'},
    description: {
      ko: '붉은 색조와 날카로운 시선, 절제된 붓질로 권력자의 심리와 물질적 현존감을 동시에 세운 초상화입니다.',
      en: 'A portrait where red tonal control, piercing gaze, and economical brushwork create both authority and psychological presence.'
    },
    collection: [{ko: '도리아 팜필리 미술관, 로마', en: 'Doria Pamphilj Gallery, Rome'}],
    sources: ['local download: Retrato_del_Papa_Inocencio_X._Roma,_by_Diego_Velázquez.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'velazquez-las-meninas-1656',
    file: '3840px-Las_Meninas,_by_Diego_Velázquez,_from_Prado_in_Google_Earth.jpg',
    out: 'velazquez-las-meninas-1656.jpg',
    year: 1656,
    popularity: 100,
    title: {ko: '시녀들', en: 'Las Meninas'},
    description: {
      ko: '공주, 시녀, 화가, 거울 속 왕과 왕비, 관람자의 위치를 한 화면에 얽어 회화와 시선의 관계를 묻는 대표작입니다.',
      en: 'A masterwork that entangles princess, attendants, painter, mirror, monarchs, and viewer into a meditation on painting and looking.'
    },
    collection: [{ko: '프라도 미술관, 마드리드', en: 'Museo del Prado, Madrid'}],
    sources: ['local download: 3840px-Las_Meninas,_by_Diego_Velázquez,_from_Prado_in_Google_Earth.jpg'],
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
      subtitle: {ko: '스페인 바로크의 사실적 존재감과 절제된 붓질을 보여 주는 벨라스케스 작품', en: 'A Velazquez work showing Spanish Baroque presence and restrained brushwork'},
      description: work.description,
      sources: [...sourceUrls, localSource],
      facts: {
        artist: {ko: '디에고 벨라스케스', en: 'Diego Velazquez'},
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
    verifiedBy: `Velazquez local file import; ${wiki}`,
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
  name: {ko: '디에고 벨라스케스', en: 'Diego Velazquez'},
  fullName: '벨라스케스, 디에고',
  birth: 1599,
  death: 1660,
  nationality: country,
  birthCountry: {ko: '스페인 세비야', en: 'Seville, Spain'},
  movement,
  aliases: {
    ko: ['벨라스케스', '디에고 벨라스케스', '디에고 로드리게스 데 실바 이 벨라스케스'],
    en: ['Velazquez', 'Velázquez', 'Diego Velázquez', 'Diego Rodríguez de Silva y Velázquez']
  },
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata
  },
  works,
  featuredWorkIds: [
    'velazquez-las-meninas-1656',
    'velazquez-portrait-pope-innocent-x-1650',
    'velazquez-surrender-of-breda-1634-1635',
    'velazquez-rokeby-venus-1647-1651'
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
console.log(`Imported Velazquez with ${works.length} local works.`);
