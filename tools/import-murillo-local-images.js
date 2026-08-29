const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q192062';
const qid = 'Q192062';
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const relativeThumbnailDir = `data/images/${artistId}`;
const now = new Date().toISOString();
const actor = 'local download import';
const wiki = 'https://en.wikipedia.org/wiki/Bartolom%C3%A9_Esteban_Murillo';
const wikidata = 'https://www.wikidata.org/wiki/Q192062';
const country = {ko: '스페인', en: 'Spain'};
const movement = {ko: '바로크', en: 'Baroque'};
const commonSources = [wiki, wikidata];
const artistName = {ko: '바르톨로메 에스테반 무리요', en: 'Bartolome Esteban Murillo'};

const artistSummary = {
  ko: [
    '스페인의 라파엘로(Raffaello)라고 불린다.',
    '종교화로 가장 잘 알려져 있지만, 당대의 여성과 아이들을 그린 그림도 상당수 제작했다. 꽃 파는 소녀, 거리의 아이들, 거지들을 생생하고 사실적으로 묘사한 그의 초상화들은 당시 일상생활을 폭넓게 기록하고 있다.',
    '테네브리즘과 광채를 결합하여 가난하고 순수한 이들을 돕는 영광을 효과적으로 보여주었다.'
  ],
  en: [
    'He was called the Spanish Raphael (Raffaello).',
    'Although best known for religious painting, he also produced many images of contemporary women and children; his vivid, realistic depictions of flower girls, street children, and beggars broadly record everyday life.',
    'He combined tenebrism with radiance to show the glory of aiding the poor and innocent.'
  ]
};

const imageWorks = [
  {
    id: 'murillo-the-young-beggar-1645-1650',
    file: 'Bartolomé_Esteban_Murillo_-_The_Young_Beggar.jpeg',
    out: 'murillo-the-young-beggar-1645-1650.jpeg',
    year: 1645,
    yearEnd: 1650,
    popularity: 100,
    title: {ko: '어린 거지', en: 'The Young Beggar'},
    description: {
      ko: '세비야 거리의 아이를 부드러운 빛과 사실적 관찰로 그려 스페인 바로크의 종교적 연민을 일상적 빈곤의 장면으로 확장한 작품입니다.',
      en: 'A compassionate image of a Seville street child, joining soft light and close observation in a Spanish Baroque scene of everyday poverty.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Bartolomé_Esteban_Murillo_-_The_Young_Beggar.jpeg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'murillo-grape-and-melon-eaters-1645-1650',
    file: 'Bartolomé_Esteban_Perez_Murillo_-_Trauben-_und_Melonenesser.jpg',
    out: 'murillo-grape-and-melon-eaters-1645-1650.jpg',
    year: 1645,
    yearEnd: 1650,
    popularity: 88,
    title: {ko: '포도와 멜론을 먹는 아이들', en: 'The Grape and Melon Eaters'},
    description: {
      ko: '가난한 아이들의 몸짓과 표정을 생생하게 포착해 무리요가 종교화뿐 아니라 당대 거리 생활도 폭넓게 다루었음을 보여 줍니다.',
      en: 'A lively image of poor children whose gestures and expressions show Murillo moving beyond religious painting into contemporary street life.'
    },
    collection: [{ko: '알테 피나코테크, 뮌헨', en: 'Alte Pinakothek, Munich'}],
    sources: ['local download: Bartolomé_Esteban_Perez_Murillo_-_Trauben-_und_Melonenesser.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'murillo-holy-family-with-little-bird-1650',
    file: 'Bartolomé_Esteban_Perez_Murillo_008.jpg',
    out: 'murillo-holy-family-with-little-bird-1650.jpg',
    year: 1650,
    popularity: 84,
    title: {ko: '작은 새가 있는 성가족', en: 'The Holy Family with a Little Bird'},
    description: {
      ko: '성가족을 친밀한 가정 장면처럼 구성해 종교적 주제를 온화한 인간미와 일상의 빛으로 바꾼 작품입니다.',
      en: 'A Holy Family scene that turns devotion into an intimate domestic image lit with warmth and everyday humanity.'
    },
    collection: [{ko: '프라도 미술관, 마드리드', en: 'Museo del Prado, Madrid'}],
    sources: ['local download: Bartolomé_Esteban_Perez_Murillo_008.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'murillo-adoration-of-the-shepherds-1650',
    file: '3840px-Adoration_of_the_Shepherds,_Murillo_(Prado_Museum).jpg',
    out: 'murillo-adoration-of-the-shepherds-1650.jpg',
    year: 1650,
    popularity: 82,
    title: {ko: '목자들의 경배', en: 'Adoration of the Shepherds'},
    description: {
      ko: '어두운 공간 속에서 아기 예수 주변의 빛을 모아 테네브리즘과 부드러운 광채를 함께 보여 주는 종교화입니다.',
      en: 'A religious painting that gathers light around the Christ Child, combining tenebrism with Murillo\'s softened radiance.'
    },
    collection: [{ko: '프라도 미술관, 마드리드', en: 'Museo del Prado, Madrid'}],
    sources: ['local download: 3840px-Adoration_of_the_Shepherds,_Murillo_(Prado_Museum).jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'murillo-saint-peter-in-tears-1650-1655',
    file: 'Bartolomé_Esteban_Murillo_-_Saint_Peter_in_Tears_-_Google_Art_Project.jpg',
    out: 'murillo-saint-peter-in-tears-1650-1655.jpg',
    year: 1650,
    yearEnd: 1655,
    popularity: 76,
    title: {ko: '눈물 흘리는 성 베드로', en: 'Saint Peter in Tears'},
    description: {
      ko: '참회하는 성인을 어둠과 집중된 빛 속에 배치해 인간적 후회와 종교적 회심을 감상적으로 전달합니다.',
      en: 'A penitential saint set in darkness and focused light, turning remorse and conversion into a moving devotional image.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Bartolomé_Esteban_Murillo_-_Saint_Peter_in_Tears_-_Google_Art_Project.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'murillo-adoration-of-the-magi-1655-1660',
    file: 'Bartolomé_Esteban_Murillo_-_Adoration_of_the_Magi_-_Google_Art_Project.jpg',
    out: 'murillo-adoration-of-the-magi-1655-1660.jpg',
    year: 1655,
    yearEnd: 1660,
    popularity: 78,
    title: {ko: '동방박사의 경배', en: 'Adoration of the Magi'},
    description: {
      ko: '경배 장면을 부드러운 명암과 풍부한 인물 배치로 구성해 세비야 바로크의 종교적 온기를 보여 줍니다.',
      en: 'A warm devotional scene in which soft chiaroscuro and rich figure grouping shape Murillo\'s Sevillian Baroque tone.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Bartolomé_Esteban_Murillo_-_Adoration_of_the_Magi_-_Google_Art_Project.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'murillo-two-women-at-a-window-1655-1660',
    file: '3840px-Bartolomé_Esteban_Perez_Murillo_014.jpg',
    out: 'murillo-two-women-at-a-window-1655-1660.jpg',
    year: 1655,
    yearEnd: 1660,
    popularity: 86,
    title: {ko: '창가의 두 여인', en: 'Two Women at a Window'},
    description: {
      ko: '창가의 두 인물을 자연스러운 미소와 시선으로 그려 무리요의 세속 장면이 지닌 생동감과 관찰력을 보여 줍니다.',
      en: 'Two figures at a window, painted with natural smiles and gazes that show Murillo\'s liveliness in secular observation.'
    },
    collection: [{ko: '내셔널 갤러리 오브 아트, 워싱턴', en: 'National Gallery of Art, Washington'}],
    sources: ['local download: 3840px-Bartolomé_Esteban_Perez_Murillo_014.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'murillo-annunciation-1660',
    file: 'Bartolomé_Esteban_Perez_Murillo_023.jpg',
    out: 'murillo-annunciation-1660.jpg',
    year: 1660,
    popularity: 74,
    title: {ko: '수태고지', en: 'The Annunciation'},
    description: {
      ko: '마리아와 천사의 만남을 온화한 색조와 열린 빛으로 정리해 무리요 종교화의 부드러운 신비감을 드러냅니다.',
      en: 'A soft-toned Annunciation whose open light gives Murillo\'s devotional painting a gentle sense of mystery.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Bartolomé_Esteban_Perez_Murillo_023.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'murillo-saint-ildefonso-1660',
    file: 'Bartolome_murillo-san_ildefonso.jpg',
    out: 'murillo-saint-ildefonso-1660.jpg',
    year: 1660,
    popularity: 72,
    title: {ko: '성 일데폰소에게 제의를 수여하는 성모', en: 'The Virgin Presenting Saint Ildephonsus with the Chasuble'},
    description: {
      ko: '성모와 성인을 빛나는 종교적 환시로 구성해 가톨릭 경건과 영광의 감각을 결합한 작품입니다.',
      en: 'A visionary Catholic devotional scene in which the Virgin and saint are joined through glowing light and sacred honor.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Bartolome_murillo-san_ildefonso.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'murillo-healing-of-the-paralytic-1670',
    file: 'Curacion_del_paralitico_Murillo_1670.jpg',
    out: 'murillo-healing-of-the-paralytic-1670.jpg',
    year: 1670,
    popularity: 80,
    title: {ko: '중풍병자의 치유', en: 'Christ Healing the Paralytic at the Pool of Bethesda'},
    description: {
      ko: '가난하고 병든 이를 돕는 그리스도의 행동을 밝은 은총과 어두운 공간의 대비 속에서 펼쳐 보이는 작품입니다.',
      en: 'A healing scene where Christ\'s aid to the poor and sick unfolds through the contrast between dark space and luminous grace.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    sources: ['local download: Curacion_del_paralitico_Murillo_1670.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'murillo-madonna-del-latte-1670',
    file: 'Murillo,_madonna_del_latte_01.jpg',
    out: 'murillo-madonna-del-latte-1670.jpg',
    year: 1670,
    popularity: 75,
    title: {ko: '젖 먹이는 성모', en: 'Madonna del Latte'},
    description: {
      ko: '성모와 아기 예수를 친밀하고 온화한 모성의 이미지로 나타내 무리요 후기 종교화의 부드러운 광채를 보여 줍니다.',
      en: 'A tender image of the Virgin and Child that shows the gentle radiance of Murillo\'s later devotional painting.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Murillo,_madonna_del_latte_01.jpg'],
    representative: false,
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
        ko: '스페인 바로크의 부드러운 종교성과 일상적 사실성을 보여 주는 무리요 작품',
        en: 'A Murillo work showing Spanish Baroque tenderness and everyday realism'
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
    verifiedBy: `Murillo local file import; ${wiki}`,
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
  fullName: '무리요, 바르톨로메 에스테반',
  birth: 1617,
  death: 1682,
  nationality: country,
  birthCountry: {ko: '스페인 세비야', en: 'Seville, Spain'},
  movement,
  aliases: {
    ko: ['무리요', '바르톨로메 무리요', '바르톨로메 에스테반 무리요'],
    en: ['Murillo', 'Bartolome Murillo', 'Bartolomé Esteban Murillo', 'Bartolome Esteban Murillo']
  },
  artistSummary,
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata
  },
  works,
  featuredWorkIds: [
    'murillo-the-young-beggar-1645-1650',
    'murillo-two-women-at-a-window-1655-1660',
    'murillo-grape-and-melon-eaters-1645-1650',
    'murillo-holy-family-with-little-bird-1650',
    'murillo-healing-of-the-paralytic-1670'
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
console.log(`Imported Murillo with ${works.length} local works.`);
