const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q207929';
const qid = 'Q207929';
const fetchedAt = new Date().toISOString();
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const generatedFile = path.join(root, 'data', 'generated', `qid-${qid}.json`);

const wiki = 'https://en.wikipedia.org/wiki/Pontormo';
const artist = {
  name: {ko: '야코포 다 폰토르모', en: 'Jacopo da Pontormo'},
  birth: 1494,
  death: 1557,
  nationality: {ko: '피렌체 공화국', en: 'Republic of Florence'},
  movement: {ko: '매너리즘', en: 'Mannerism'},
  aliases: {
    ko: ['폰토르모', '다 폰토르모', '야코포 폰토르모', '폰토르모, 야코포 다', '카루치, 야코포'],
    en: ['Pontormo', 'Jacopo da Pontormo', 'Jacopo Pontormo', 'Jacopo Carucci', 'Jacopo Carrucci']
  }
};

const works = [
  {
    id: 'pontormo-visitation-1514-1516',
    file: 'Pontormo,_Visitation,_1516,_SS_Annunziata,_Chiostrino_dei_Voti,_Florence.jpg',
    out: 'pontormo-visitation-1514-1516.jpg',
    year: 1516,
    popularity: 8200,
    title: {ko: '방문', en: 'Visitation'},
    description: {
      ko: '초기 피렌체 르네상스 질서를 유지하면서도 인물의 움직임과 색채가 점차 매너리즘으로 기울기 시작한 초기 프레스코입니다.',
      en: 'An early fresco that still holds Florentine Renaissance order while its movement and color begin to lean toward Mannerism.'
    },
    collection: [{ko: '산티시마 안눈치아타, 피렌체', en: 'Santissima Annunziata, Florence'}],
    representative: false,
    movementContribution: false
  },
  {
    id: 'pontormo-joseph-in-egypt-1515-1518',
    file: 'Jacopo_Pontormo_066.jpg',
    out: 'pontormo-joseph-in-egypt-1515-1518.jpg',
    year: 1518,
    popularity: 8600,
    title: {ko: '이집트의 요셉', en: 'Joseph in Egypt'},
    description: {
      ko: '분산된 서사, 높아진 시점, 복잡한 인물 배치가 전성기 르네상스의 안정된 공간을 벗어나는 폰토르모의 초기 실험을 보여줍니다.',
      en: 'Its dispersed narrative, high viewpoint, and complex figure groups show Pontormo moving beyond stable High Renaissance space.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'pontormo-vertumnus-and-pomona-1520-1521',
    file: 'Pontormo, Jacopa da 1541.jpg',
    out: 'pontormo-vertumnus-and-pomona-1520-1521.jpg',
    year: 1521,
    popularity: 7600,
    title: {ko: '베르툼누스와 포모나', en: 'Vertumnus and Pomona'},
    description: {
      ko: '포조 아 카이아노의 메디치 별장에 그린 루네트 프레스코로, 고전 신화를 목가적 장면과 결합한 폰토르모의 궁정적 실험입니다.',
      en: 'A lunette fresco for the Medici villa at Poggio a Caiano, joining classical myth with an unusual pastoral mode.'
    },
    collection: [{ko: '메디치 별장, 포조 아 카이아노', en: 'Medici Villa at Poggio a Caiano'}],
    representative: false,
    movementContribution: false
  },
  {
    id: 'pontormo-supper-at-emmaus-1525',
    file: 'Pontormo,_Supper_at_Emmaus,_1525,_Uffizi.jpg',
    out: 'pontormo-supper-at-emmaus-1525.jpg',
    year: 1525,
    popularity: 8800,
    title: {ko: '엠마오의 저녁 식사', en: 'Supper at Emmaus'},
    description: {
      ko: '수도원적 긴장과 뒤러 판화의 영향이 결합된 작품으로, 절제된 공간 속 정면성 강한 인물들이 폰토르모의 예민한 종교성을 보여줍니다.',
      en: 'A work shaped by monastic tension and Duerer’s prints, with frontal figures in a restrained space.'
    },
    collection: [{ko: '우피치 미술관', en: 'Uffizi Gallery'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'pontormo-deposition-from-the-cross-1525-1528',
    file: 'Jacopo_Pontormo_-_Kreuzabnahme_Christi.jpg',
    out: 'pontormo-deposition-from-the-cross-1525-1528.jpg',
    year: 1528,
    popularity: 10000,
    title: {ko: '십자가에서 내려지는 그리스도', en: 'The Deposition from the Cross'},
    description: {
      ko: '산타 펠리치타 카포니 예배당의 제단화로, 떠 있는 듯한 인물, 불안정한 공간, 차갑고 밝은 색채가 매너리즘의 핵심을 압축한 폰토르모의 대표작입니다.',
      en: 'The Capponi Chapel altarpiece, whose floating figures, unstable space, and brilliant cool colors concentrate Pontormo’s Mannerism.'
    },
    collection: [{ko: '산타 펠리치타 카포니 예배당, 피렌체', en: 'Capponi Chapel, Santa Felicita, Florence'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'pontormo-annunciation-1527-1528',
    file: 'Pontormoannunciation.jpg',
    out: 'pontormo-annunciation-1527-1528.jpg',
    year: 1528,
    popularity: 7900,
    title: {ko: '수태고지', en: 'Annunciation'},
    description: {
      ko: '카포니 예배당 벽면의 프레스코로, 단순화된 배경 속 천사와 성모의 비현실적 색채와 흔들리는 자세가 매너리즘적 긴장을 만듭니다.',
      en: 'A Capponi Chapel fresco whose simplified ground, unstable posture, and unreal color create Mannerist tension.'
    },
    collection: [{ko: '산타 펠리치타 카포니 예배당, 피렌체', en: 'Capponi Chapel, Santa Felicita, Florence'}],
    representative: false,
    movementContribution: true
  },
  {
    id: 'pontormo-visitation-carmignano-1528-1529',
    file: 'Pontormo-visitation-after-restorationRGB.jpg',
    out: 'pontormo-visitation-carmignano-1528-1529.jpg',
    year: 1529,
    popularity: 9200,
    title: {ko: '방문', en: 'Visitation'},
    description: {
      ko: '카르미냐노의 성 미카엘 성당 작품으로, 가까이 밀려오는 인물군과 떠 있는 듯한 몸, 강렬한 색채가 폰토르모의 성숙한 매너리즘을 잘 보여줍니다.',
      en: 'The Carmignano Visitation, with close figures, floating bodies, and intense color, is a key mature Mannerist work.'
    },
    collection: [{ko: '산 미켈레 에 산 프란체스코, 카르미냐노', en: 'San Michele e San Francesco, Carmignano'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'pontormo-madonna-and-child-young-john-1534',
    file: 'Pontormo,_Madonna_and_Child_with_Young_John_the_Baptist,_1534,_Uffizi.jpg',
    out: 'pontormo-madonna-and-child-young-john-1534.jpg',
    year: 1534,
    popularity: 7800,
    title: {ko: '아기 세례자 요한과 함께 있는 성모자', en: 'Madonna and Child with Young John the Baptist'},
    description: {
      ko: '부드러운 종교 주제 안에서도 늘어진 몸과 긴장된 시선, 인공적인 색조가 폰토르모 후기 양식의 예민함을 보여줍니다.',
      en: 'Even in a tender devotional subject, elongated bodies, tense gazes, and artificial color show Pontormo’s later sensitivity.'
    },
    collection: [{ko: '우피치 미술관', en: 'Uffizi Gallery'}],
    representative: false,
    movementContribution: false
  },
  {
    id: 'pontormo-portrait-maria-salviati-1543-1545',
    file: "Pontormo_-_Portrait_of_Maria_Salviati_de'_Medici_with_Giulia_de'_Medici_-_Walters_37596.jpg",
    out: 'pontormo-portrait-maria-salviati-1543-1545.jpg',
    year: 1545,
    popularity: 8000,
    title: {ko: '마리아 살비아티와 줄리아 데 메디치의 초상', en: "Portrait of Maria Salviati de' Medici with Giulia de' Medici"},
    description: {
      ko: '메디치 가문의 여성을 엄격하고 차분한 초상 형식으로 그린 작품으로, 폰토르모의 궁정 초상과 브론치노로 이어지는 차가운 세련미를 보여줍니다.',
      en: 'A restrained Medici portrait that points toward the cool refinement of court portraiture and Bronzino.'
    },
    collection: [{ko: '월터스 미술관', en: 'Walters Art Museum'}],
    representative: true,
    movementContribution: true
  }
];

function workEntry(work) {
  const image = `data/images/${artistId}/${work.out}`;
  const source = `${wiki}; local file: ${path.join(downloadDir, work.file)}`;
  return {
    id: work.id,
    year: work.year,
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
console.log(`Imported ${payload.works.length} Pontormo works into ${path.relative(root, generatedFile)}`);
