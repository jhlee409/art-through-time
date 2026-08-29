const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q312617';
const qid = 'Q312617';
const fetchedAt = new Date().toISOString();
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const generatedFile = path.join(root, 'data', 'generated', `qid-${qid}.json`);

const wiki = 'https://en.wikipedia.org/wiki/Rosso_Fiorentino';
const artist = {
  name: {ko: '로소 피오렌티노', en: 'Rosso Fiorentino'},
  birth: 1495,
  death: 1540,
  nationality: {ko: '피렌체 공화국', en: 'Republic of Florence'},
  movement: {ko: '매너리즘', en: 'Mannerism'},
  aliases: {
    ko: ['로소', '일 로소', '조반니 바티스타 디 야코포', '로소 피오렌티노, 조반니 바티스타 디 야코포'],
    en: ['Rosso', 'Il Rosso', 'Giovanni Battista di Jacopo', 'Giovanni Battista di Jacopo di Guasparre Rosso']
  }
};

const works = [
  {
    id: 'rosso-fiorentino-holy-family-infant-saint-john-1521',
    file: 'The_Holy_Family_with_the_Infant_Saint_John_the_Baptist.jpg',
    out: 'rosso-fiorentino-holy-family-infant-saint-john-1521.jpg',
    year: 1521,
    popularity: 8100,
    title: {ko: '아기 세례자 요한과 함께 있는 성가족', en: 'The Holy Family with the Infant Saint John the Baptist'},
    description: {
      ko: '월터스 미술관의 미완성 패널화로, 길어진 손과 날카로운 윤곽, 노출된 밑그림이 로소 피오렌티노의 예민한 초기 매너리즘을 보여줍니다.',
      en: 'An unfinished panel whose elongated hands, sharp contours, and visible underdrawing show Rosso Fiorentino’s tense early Mannerism.'
    },
    collection: [{ko: '월터스 미술관', en: 'Walters Art Museum'}],
    representative: false,
    movementContribution: true
  },
  {
    id: 'rosso-fiorentino-infant-saint-john-1521',
    file: 'Rosso_fiorentino,_san_giovannino,_collezione_privata_firenze.jpg',
    out: 'rosso-fiorentino-infant-saint-john-1521.jpg',
    year: 1521,
    popularity: 7200,
    title: {ko: '아기 세례자 요한', en: 'The Infant Saint John the Baptist'},
    description: {
      ko: '볼테라 시기 작품들과 가까운 긴장된 윤곽과 거친 붓질을 지닌 초기 종교화입니다.',
      en: 'An early devotional work related to the Volterra period, with nervous contour lines and lean brushwork.'
    },
    collection: [{ko: '개인 소장, 피렌체', en: 'Private collection, Florence'}],
    representative: false,
    movementContribution: false
  },
  {
    id: 'rosso-fiorentino-angel-playing-the-lute-1521',
    file: 'Rosso_Fiorentino_-_Madonna_dello_Spedalingo_-_Google_Art_Project.jpg',
    out: 'rosso-fiorentino-angel-playing-the-lute-1521.jpg',
    year: 1521,
    popularity: 7800,
    title: {ko: '류트를 연주하는 천사', en: 'Angel Playing the Lute'},
    description: {
      ko: '스페달링고 제단화의 일부로 알려진 작은 패널로, 섬세한 음악적 주제와 선명한 색채가 초기 피렌체 매너리즘의 장식성을 보여줍니다.',
      en: 'A small panel associated with the Spedalingo altarpiece, joining a musical subject with the bright artifice of early Florentine Mannerism.'
    },
    collection: [{ko: '우피치 미술관', en: 'Uffizi Gallery'}],
    representative: false,
    movementContribution: false
  },
  {
    id: 'rosso-fiorentino-allegory-of-salvation-1522',
    file: 'Rosso_Fiorentino_001.jpg',
    out: 'rosso-fiorentino-allegory-of-salvation-1522.jpg',
    year: 1522,
    popularity: 7900,
    title: {ko: '구원의 알레고리', en: 'Allegory of Salvation'},
    description: {
      ko: '성모와 아기 그리스도, 성 엘리사벳, 아기 세례자 요한 등을 배치한 복합적인 성화로, 경직된 자세와 긴장된 표정이 로소의 인공적 표현을 드러냅니다.',
      en: 'A complex sacred composition whose strained poses and heightened expressions reveal Rosso’s artificial, intellectual manner.'
    },
    collection: [{ko: '로스앤젤레스 카운티 미술관', en: 'Los Angeles County Museum of Art'}],
    representative: false,
    movementContribution: true
  },
  {
    id: 'rosso-fiorentino-descent-from-cross-1521',
    file: 'Rosso_Fiorentino_002.jpg',
    out: 'rosso-fiorentino-descent-from-cross-1521.jpg',
    year: 1521,
    popularity: 10000,
    title: {ko: '십자가에서 내려지는 그리스도', en: 'Descent from the Cross'},
    description: {
      ko: '볼테라의 대표 제단화로, 위태로운 사다리와 급박한 인물 동선, 어두운 하늘이 르네상스적 안정성을 의도적으로 흔드는 대표작입니다.',
      en: 'The Volterra altarpiece, where precarious ladders, hurried figures, and a somber sky deliberately disturb Renaissance stability.'
    },
    collection: [{ko: '피나코테카 코무날레, 볼테라', en: 'Pinacoteca Comunale di Volterra'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'rosso-fiorentino-moses-daughters-jethro-1523',
    file: 'Rosso_Fiorentino_005.jpg',
    out: 'rosso-fiorentino-moses-daughters-jethro-1523.jpg',
    year: 1523,
    popularity: 8700,
    title: {ko: '이드로의 딸들을 지키는 모세', en: 'Moses Defending the Daughters of Jethro'},
    description: {
      ko: '미켈란젤로적 인체의 힘을 받아들이면서도 부자연스러운 조명과 과장된 자세로 매너리즘적 긴장을 만든 작품입니다.',
      en: 'A work that absorbs Michelangelesque anatomy while using unnatural light and exaggerated poses to create Mannerist tension.'
    },
    collection: [{ko: '우피치 미술관', en: 'Uffizi Gallery'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'rosso-fiorentino-marriage-virgin-saints-1523',
    file: 'Rosso_fiorentino,_sposalizio_della_vergine_e_santi,_1523,_02.jpg',
    out: 'rosso-fiorentino-marriage-virgin-saints-1523.jpg',
    year: 1523,
    popularity: 8000,
    title: {ko: '성모의 결혼과 성인들', en: 'Marriage of the Virgin and Saints'},
    description: {
      ko: '산 로렌초 성당 내부의 제단화로, 장중한 종교 장면 안에 길어진 인물 비례와 날카로운 색채 대비를 결합했습니다.',
      en: 'An altarpiece in San Lorenzo, combining a solemn sacred scene with elongated figures and sharpened color contrasts.'
    },
    collection: [{ko: '산 로렌초 성당, 피렌체', en: 'Basilica of San Lorenzo, Florence'}],
    representative: false,
    movementContribution: true
  },
  {
    id: 'rosso-fiorentino-bacchus-venus-cupid-1530s',
    file: 'Rosso_fiorentino_(attr.),_bacco,_venere_e_marte.jpg',
    out: 'rosso-fiorentino-bacchus-venus-cupid-1530s.jpg',
    year: 1531,
    yearEnd: 1539,
    popularity: 7600,
    title: {ko: '바쿠스, 비너스와 큐피드', en: 'Bacchus, Venus and Cupid'},
    description: {
      ko: '로소에게 귀속되는 1530년대 신화화로, 관능적 주제와 길어진 몸, 장식적 자세가 퐁텐블로 취향과 맞닿아 있습니다.',
      en: 'An attributed mythological painting from the 1530s, linking sensual subject matter, elongated bodies, and decorative posture to Fontainebleau taste.'
    },
    collection: [{ko: '국립고고학역사미술박물관, 룩셈부르크', en: 'National Museum of Archaeology, History and Art, Luxembourg'}],
    representative: false,
    movementContribution: false
  },
  {
    id: 'rosso-fiorentino-elephant-fontainebleau-1533-1539',
    file: 'Fontainebleau_interior_francois_I_gallery_02.jpeg',
    out: 'rosso-fiorentino-elephant-fontainebleau-1533-1539.jpg',
    year: 1533,
    yearEnd: 1539,
    popularity: 8300,
    title: {ko: '코끼리', en: 'Elephant'},
    description: {
      ko: '프랑수아 1세 갤러리 장식의 한 장면으로, 로소가 프랑스 궁정에서 퐁텐블로파 형성에 참여했음을 보여줍니다.',
      en: 'A scene from the Gallery of Francis I, showing Rosso’s role in shaping the First School of Fontainebleau at the French court.'
    },
    country: {ko: '프랑스', en: 'France'},
    collection: [{ko: '퐁텐블로 궁전', en: 'Chateau de Fontainebleau'}],
    representative: true,
    movementContribution: true
  },
  {
    id: 'rosso-fiorentino-pieta-1537-1540',
    file: 'Rosso_Fiorentino_-_Pietà_-_WGA20135.jpg',
    out: 'rosso-fiorentino-pieta-1537-1540.jpg',
    year: 1537,
    yearEnd: 1540,
    popularity: 8400,
    title: {ko: '피에타', en: 'Pieta'},
    description: {
      ko: '프랑스 체류 말기의 어둡고 밀집된 종교화로, 인물의 비통한 표정과 압축된 화면이 후기 매너리즘의 정서적 강도를 보여줍니다.',
      en: 'A dark, crowded late religious work from Rosso’s French years, marked by compressed composition and emotional intensity.'
    },
    country: {ko: '프랑스', en: 'France'},
    collection: [{ko: '루브르 박물관', en: 'Louvre Museum'}],
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
    ...(work.yearEnd ? {yearEnd: work.yearEnd} : {}),
    popularity: work.popularity,
    title: work.title,
    description: work.description,
    country: work.country || {ko: '이탈리아', en: 'Italy'},
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
        country: work.country || {ko: '이탈리아', en: 'Italy'},
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
console.log(`Imported ${payload.works.length} Rosso Fiorentino works into ${path.relative(root, generatedFile)}`);
