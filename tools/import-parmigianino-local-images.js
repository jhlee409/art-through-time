const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q9348';
const qid = 'Q9348';
const fetchedAt = new Date().toISOString();
const thumbnailDir = path.join(root, 'data', 'thumbnails', artistId);
const generatedFile = path.join(root, 'data', 'generated', `qid-${qid}.json`);

const wiki = 'https://en.wikipedia.org/wiki/Parmigianino';
const artist = {
  name: {ko: '파르미자니노', en: 'Parmigianino'},
  birth: 1503,
  death: 1540,
  nationality: {ko: '이탈리아', en: 'Italian'},
  movement: {ko: '매너리즘', en: 'Mannerism'},
  aliases: {
    ko: ['프란체스코 마촐라', '지롤라모 프란체스코 마리아 마촐라', '마촐라, 프란체스코', '일 파르미자니노'],
    en: ['Francesco Mazzola', 'Girolamo Francesco Maria Mazzola', 'Francesco Mazzuoli', 'Il Parmigianino', 'Parmigiano']
  }
};

const works = [
  {
    id: 'parmigianino-saint-barbara-1522',
    file: 'Parmigianino_-_Saint_Barbara.jpg',
    out: 'parmigianino-saint-barbara-1522.jpg',
    year: 1522,
    popularity: 7600,
    title: {ko: '성녀 바르바라', en: 'Saint Barbara'},
    description: {
      ko: '프라도 미술관 소장작으로, 젊은 파르미자니노의 길어진 인물 비례와 매끈한 표면, 우아하게 비튼 자세가 초기 매너리즘의 세련미를 보여줍니다.',
      en: 'A Prado panel whose elongated proportions, polished surface, and elegant contrapposto show Parmigianino’s early Mannerist refinement.'
    },
    collection: [{ko: '프라도 미술관', en: 'Museo del Prado'}],
    representative: false,
    movementContribution: true
  },
  {
    id: 'parmigianino-self-portrait-convex-mirror-1524',
    file: 'Parmigianino_Selfportrait.jpg',
    out: 'parmigianino-self-portrait-convex-mirror-1524.jpg',
    year: 1524,
    popularity: 9800,
    title: {ko: '볼록 거울 속 자화상', en: 'Self-portrait in a Convex Mirror'},
    description: {
      ko: '볼록 거울의 왜곡을 작은 원형 패널에 옮긴 대표작으로, 손과 얼굴의 비례 변형을 통해 파르미자니노의 기교와 매너리즘적 인공성을 압축합니다.',
      en: 'A small round panel that transfers convex-mirror distortion into paint, condensing Parmigianino’s virtuosity and Mannerist artifice.'
    },
    collection: [{ko: '빈 미술사박물관', en: 'Kunsthistorisches Museum, Vienna'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'parmigianino-vision-of-saint-jerome-1526-1527',
    file: 'Parmigianino_-_The_Madonna_and_Child_with_Saints_(The_Vision_of_St_Jerome).jpg',
    out: 'parmigianino-vision-of-saint-jerome-1526-1527.jpg',
    year: 1527,
    popularity: 9600,
    title: {ko: '성 히에로니무스의 환시', en: 'Vision of Saint Jerome'},
    description: {
      ko: '로마에서 주문받은 대형 제단화로, 길어진 성모자와 잠든 성 히에로니무스, 세례자 요한의 상승하는 몸짓이 전성기 르네상스의 안정성을 매너리즘적 환상으로 바꿉니다.',
      en: 'A Roman altarpiece in which the elongated Madonna and Child, sleeping Jerome, and rising Saint John transform High Renaissance order into Mannerist vision.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'parmigianino-lovers-1527-1530',
    file: 'Liefdespaar,_RP-P-OB-12.233.jpg',
    out: 'parmigianino-lovers-1527-1530.jpg',
    year: 1527,
    yearEnd: 1530,
    popularity: 7300,
    title: {ko: '연인들', en: 'Lovers'},
    description: {
      ko: '볼로냐 시기 판화 실험과 연결되는 작품으로, 가늘고 민첩한 선과 장식적인 인물 자세가 파르미자니노가 이탈리아 판화에 남긴 영향을 보여줍니다.',
      en: 'A print linked to Parmigianino’s Bologna experiments, showing the agile line and decorative figure language that made him important for Italian printmaking.'
    },
    collection: [{ko: '암스테르담 국립미술관', en: 'Rijksmuseum'}],
    representative: false,
    movementContribution: true
  },
  {
    id: 'parmigianino-madonna-long-neck-1534-1540',
    file: 'Parmigianino_-_Madonna_and_Child_with_Angels,_known_as_the_Madonna_with_the_Long_Neck.jpg',
    out: 'parmigianino-madonna-long-neck-1534-1540.jpg',
    year: 1534,
    yearEnd: 1540,
    popularity: 10000,
    title: {ko: '긴 목의 성모', en: 'Madonna with the Long Neck'},
    description: {
      ko: '우피치 미술관 소장 미완성 제단화로, 길게 늘어난 성모의 목과 몸, 비현실적으로 압축된 공간, 차갑고 우아한 인물들이 매너리즘의 대표적 형식 실험을 보여줍니다.',
      en: 'An unfinished Uffizi altarpiece whose elongated Madonna, compressed unreal space, and cool elegance make it an icon of Mannerist form.'
    },
    collection: [{ko: '우피치 미술관', en: 'Uffizi Gallery'}],
    representative: true,
    movementContribution: true
  }
];

function workEntry(work) {
  const image = `data/thumbnails/${artistId}/${work.out}`;
  const source = `${wiki}; local file: ${path.join(downloadDir, work.file)}`;
  return {
    id: work.id,
    year: work.year,
    ...(work.yearEnd ? {yearEnd: work.yearEnd} : {}),
    popularity: work.popularity,
    title: work.title,
    description: work.description,
    country: {ko: '이탈리아', en: 'Italy'},
    movement: {ko: '매너리즘', en: 'Mannerism'},
    collection: work.collection,
    image,
    thumbnail: image,
    thumbnailValidation: 2,
    thumbnailCacheKey: fetchedAt,
    highResImage: image,
    highResOriginal: image,
    source,
    verified: true,
    representative: Boolean(work.representative),
    movementContribution: Boolean(work.movementContribution),
    origin: 'manual',
    detail: {
      schema: 2,
      cachedFromExistingData: true,
      summary: work.description,
      sources: [wiki, `local file: ${path.join(downloadDir, work.file)}`],
      facts: {
        artist: artist.name,
        year: work.year,
        country: {ko: '이탈리아', en: 'Italy'},
        movement: {ko: '매너리즘', en: 'Mannerism'},
        collection: work.collection
      }
    },
    metadata: {
      createdAt: fetchedAt,
      updatedAt: fetchedAt,
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

fs.mkdirSync(thumbnailDir, {recursive: true});
for (const work of works) {
  const source = path.join(downloadDir, work.file);
  const target = path.join(thumbnailDir, work.out);
  if (!fs.existsSync(source)) throw new Error(`Missing download image: ${source}`);
  fs.copyFileSync(source, target);
}

const payload = {
  schema: 20,
  artistId,
  qid,
  artist,
  fetchedAt,
  works: works.map(workEntry)
};

fs.mkdirSync(path.dirname(generatedFile), {recursive: true});
fs.writeFileSync(generatedFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Imported ${payload.works.length} Parmigianino works into ${path.relative(root, generatedFile)}`);
