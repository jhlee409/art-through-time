const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q9440';
const qid = 'Q9440';
const wiki = 'https://en.wikipedia.org/wiki/Paolo_Veronese';
const wikidata = 'https://www.wikidata.org/wiki/Q9440';
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const relativeThumbnailDir = `data/images/${artistId}`;
const imageLimit = 10 * 1024 * 1024;
const now = new Date().toISOString();
const ffmpegPath = process.env.ART_ATLAS_FFMPEG
  || (fs.existsSync('C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe') ? 'C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe'
    : (fs.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg'));

const commonSources = [
  wiki,
  wikidata,
  'https://www.nationalgallery.org.uk/artists/paolo-veronese',
  'https://www.nga.gov/artists/1952-veronese'
];

const imageWorks = [
  {
    id: 'veronese-lamentation-over-the-dead-christ-1547',
    file: 'Castelvecchio06q-Veronese.jpg',
    out: 'veronese-lamentation-over-the-dead-christ-1547.png',
    year: 1547,
    popularity: 8800,
    title: {ko: '죽은 그리스도를 애도함', en: 'Lamentation over the Dead Christ'},
    description: {
      ko: '베로나 카스텔베키오 미술관의 초기작으로, 파르미자니노식 인체와 베네치아식 색채를 결합해 젊은 베로네세의 세련된 서정성을 보여줍니다.',
      en: 'An early Castelvecchio painting whose refined colour and Parmigianino-derived figure language show Veronese forming a lyrical Venetian style.'
    },
    technique: {ko: '서정적 색채, 사선 구도, 초기 베네치아-베로나 양식', en: 'Lyrical colour, diagonal grouping, early Veneto-Veronese style'},
    collection: [{ko: '카스텔베키오 미술관, 베로나', en: 'Museo Civico di Castelvecchio, Verona'}],
    sources: ['https://www.wga.hu/html/v/veronese/01_1540s/2castel2.html'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'veronese-conversion-of-mary-magdalene-1548',
    file: 'Paolo_Veronese,_The_Conversion_of_Mary_Magdalene.jpg',
    out: 'veronese-conversion-of-mary-magdalene-1548.png',
    year: 1548,
    popularity: 9300,
    title: {ko: '마리아 막달레나의 회심', en: 'The Conversion of Mary Magdalene'},
    description: {
      ko: '런던 내셔널 갤러리의 초기 대표작으로, 화려한 옷감과 보석, 연극적 손짓을 통해 세속적 감각과 회심의 서사를 한 화면에 겹칩니다.',
      en: 'An early National Gallery work where luxurious fabrics, jewels, and theatrical gesture set worldly splendour against spiritual conversion.'
    },
    technique: {ko: '연극적 몸짓, 밝은 색채, 호화로운 표면 묘사', en: 'Theatrical gesture, bright colour, luxurious surface detail'},
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    sources: ['https://www.nationalgallery.org.uk/paintings/paolo-veronese-the-conversion-of-mary-magdalene'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'veronese-sacrificial-death-of-marcus-curtius-1550-1552',
    file: 'Veronese.Marcus_Curtius01.jpg',
    out: 'veronese-sacrificial-death-of-marcus-curtius-1550-1552.png',
    year: 1550,
    yearEnd: 1552,
    popularity: 8900,
    title: {ko: '마르쿠스 쿠르티우스의 희생', en: 'The Sacrificial Death of Marcus Curtius'},
    description: {
      ko: '원형 천장화 형식의 영웅 장면으로, 아래에서 올려다보는 단축법과 회전하는 말의 동세가 베로네세의 장식 회화 재능을 드러냅니다.',
      en: 'A circular ceiling painting whose upward foreshortening and rearing horse reveal Veronese’s gift for decorative drama.'
    },
    technique: {ko: '소토 인 수, 원형 천장화, 영웅적 동세', en: 'Sotto in su, round ceiling painting, heroic movement'},
    collection: [{ko: '빈 미술사박물관', en: 'Kunsthistorisches Museum, Vienna'}],
    sources: ['https://www.khm.at/en/artworks/sacrificial-death-of-marcus-curtius-386-1'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'veronese-juno-showering-gifts-on-venice-1554-1556',
    file: 'Paolo_Veronese_-_Juno_Showering_Gifts_on_Venetia_-_WGA24937.jpg',
    out: 'veronese-juno-showering-gifts-on-venice-1554-1556.png',
    year: 1554,
    yearEnd: 1556,
    popularity: 9000,
    title: {ko: '유노가 베네치아에 선물을 내리다', en: 'Juno Showering Gifts on Venice'},
    description: {
      ko: '두칼레 궁전 천장화로, 베네치아를 여성 인격화로 세우고 보석과 금화를 쏟아내며 공화국의 권위와 번영을 장식적 환영으로 표현합니다.',
      en: 'A Doge’s Palace ceiling painting in which Juno showers jewels and coins onto personified Venice, turning civic power into decorative vision.'
    },
    technique: {ko: '천장 단축법, 알레고리, 베네치아 공화국 상징', en: 'Ceiling foreshortening, allegory, Venetian civic symbolism'},
    collection: [{ko: '두칼레 궁전, 베네치아', en: 'Palazzo Ducale, Venice'}],
    sources: ['https://www.wga.hu/html/v/veronese/08/dieci/3dieci.html', 'https://dh.scu.edu/exhibits/items/show/660'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'veronese-feast-in-the-house-of-levi-1573',
    file: 'The_Feast_in_the_House_of_Levi_by_Paolo_Veronese_(edited_2).jpg',
    out: 'veronese-feast-in-the-house-of-levi-1573.png',
    year: 1573,
    popularity: 10000,
    title: {ko: '레위 집의 향연', en: 'The Feast in the House of Levi'},
    description: {
      ko: '아카데미아 미술관의 대형 연회 장면으로, 건축 무대와 수많은 인물을 통해 베네치아 르네상스의 색채, 장식, 사회적 스펙터클을 집약합니다.',
      en: 'A vast Accademia banquet scene whose staged architecture and crowded figures condense Venetian Renaissance colour, ornament, and social spectacle.'
    },
    technique: {ko: '대형 텔레로, 건축적 무대, 연회 장면, 베네치아 색채', en: 'Large telero, architectural staging, banquet scene, Venetian colour'},
    collection: [{ko: '아카데미아 미술관, 베네치아', en: "Gallerie dell'Accademia, Venice"}],
    sources: ['https://www.gallerieaccademia.it/opera/convito-in-casa-di-levi/', 'https://catalogo.beniculturali.it/detail/HistoricOrArtisticProperty/0500401474'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'veronese-perseus-freeing-andromeda-1576-1578',
    file: 'Veronese-persée-rennes.jpg',
    out: 'veronese-perseus-freeing-andromeda-1576-1578.png',
    year: 1576,
    yearEnd: 1578,
    popularity: 9200,
    title: {ko: '페르세우스가 안드로메다를 구하다', en: 'Perseus Freeing Andromeda'},
    description: {
      ko: '렌 미술관의 신화화로, 바다 괴물과 영웅의 충돌보다 안드로메다의 밝은 몸과 색채의 조화를 앞세워 베로네세 특유의 우아한 극성을 보여줍니다.',
      en: 'A Rennes mythological scene that favours Andromeda’s luminous figure and colour harmony over violence, showing Veronese’s elegant drama.'
    },
    technique: {ko: '신화화, 색채 대비, 우아한 인체, 공간 깊이', en: 'Mythological painting, colour contrast, elegant figure, spatial depth'},
    collection: [{ko: '렌 미술관', en: 'Musée des Beaux-Arts de Rennes'}],
    sources: ['https://pop.culture.gouv.fr/notice/joconde/00000094573', 'https://utpictura18.univ-amu.fr/notice/1439-persee-delivre-andromede-veronese', 'https://bretagnemusees.bzh/collection/persee-delivrant-andromede/'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'veronese-saint-jerome-in-penance-1570-1580',
    file: '(Venice)_Saint_Jerome_in_Penance_by_Veronese_(Accademia).jpg',
    out: 'veronese-saint-jerome-in-penance-1570-1580.png',
    year: 1570,
    yearEnd: 1580,
    popularity: 9100,
    title: {ko: '참회하는 성 히에로니무스', en: 'Saint Jerome in Penance'},
    description: {
      ko: '아카데미아 미술관의 후기 제단화로, 거친 풍경과 붉은 천, 성인의 응시가 베로네세 말년의 풍부한 색채와 깊어진 종교적 정서를 보여줍니다.',
      en: 'A late Accademia altarpiece whose rough landscape, red drapery, and concentrated gaze show Veronese’s mature colour and deepened religious feeling.'
    },
    technique: {ko: '후기 붓질, 풍경 속 성인상, 붉은 색채 악센트', en: 'Late brushwork, saint in landscape, red colour accent'},
    collection: [{ko: '아카데미아 미술관, 베네치아', en: "Gallerie dell'Accademia, Venice"}],
    sources: ['https://www.gallerieaccademia.it/en/opera/san-girolamo-penitente/', 'https://www.savevenice.org/project/saint-jerome-penitent'],
    representative: true,
    movementContribution: true
  }
];

function relativeLocalSource(file) {
  return `local file: ${path.join(downloadDir, file)}`;
}

function pngUnderLimit(source, target) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'art-atlas-veronese-'));
  const temporary = path.join(staging, 'display.png');
  try {
    for (const size of [2600, 2200, 1800, 1500, 1200, 1000, 800, 640, 520]) {
      execFileSync(ffmpegPath, ['-y', '-i', source, '-vf', `scale=min(${size}\\,iw):-2`, '-frames:v', '1', '-update', '1', '-compression_level', '9', '-pred', 'mixed', temporary], {stdio: 'ignore', windowsHide: true});
      if (fs.statSync(temporary).size <= imageLimit) {
        fs.copyFileSync(temporary, target);
        return;
      }
    }
    throw new Error(`Could not reduce ${path.basename(source)} below 10 MB as PNG`);
  } finally {
    fs.rmSync(staging, {recursive: true, force: true});
  }
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
      subtitle: {ko: '베네치아 르네상스의 색채와 연극성을 보여 주는 베로네세 작품', en: 'A Veronese work showing Venetian Renaissance colour and theatricality'},
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
  pngUnderLimit(source, target);
  const entry = workEntry(work);
  works.push(entry);
  thumbnailIndex[work.id] = {
    thumbnail: entry.thumbnail,
    checkedAt: now,
    verifiedBy: `Veronese local file import; ${wiki}`,
    imageHash: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
  };
}
works.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0) || (Number(a.yearEnd) || Number(a.year) || 0) - (Number(b.yearEnd) || Number(b.year) || 0));
fs.writeFileSync(path.join(thumbnailDir, 'index.json'), `${JSON.stringify(thumbnailIndex, null, 2)}\n`, 'utf8');

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = {
  id: artistId,
  qid,
  name: {ko: '파올로 베로네세', en: 'Paolo Veronese'},
  fullName: '베로네세, 파올로',
  birth: 1528,
  death: 1588,
  nationality: {ko: '이탈리아', en: 'Italy'},
  birthCountry: {ko: '베네치아 공화국', en: 'Republic of Venice'},
  movement: {ko: '르네상스 · 베네치아 화파', en: 'Renaissance · Venetian School'},
  aliases: {
    ko: ['베로네세', '파올로 칼리아리', '파올로 칼리아리 베로네세', '일 베로네세', '베로네세, 파올로'],
    en: ['Veronese', 'Paolo Caliari', 'Paolo Cagliari', 'Paolo Caliari Veronese', 'Il Veronese', 'Paul Veronese']
  },
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata
  },
  works,
  featuredWorkIds: [
    'veronese-feast-in-the-house-of-levi-1573',
    'veronese-perseus-freeing-andromeda-1576-1578',
    'veronese-conversion-of-mary-magdalene-1548'
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

data.artists.sort((a, b) => (Number(a.birth) || 99999) - (Number(b.birth) || 99999) || String(a.name?.ko || '').localeCompare(String(b.name?.ko || ''), 'ko'));
data.metadata = {
  ...(data.metadata || {}),
  revision: Number(data.metadata?.revision || 0) + 1,
  updatedAt: now,
  updatedBy: 'local artist import'
};

fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported Veronese with ${works.length} local works.`);
