const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = 'C:\\Users\\jhlee\\OneDrive - UOU\\AI-Programming\\Art_through_Time\\download';
const artistId = 'artist-Q150679';
const qid = 'Q150679';
const wiki = 'https://en.wikipedia.org/wiki/Anthony_van_Dyck';
const wikidata = 'https://www.wikidata.org/wiki/Q150679';
const thumbnailDir = path.join(root, 'data', 'thumbnails', artistId);
const relativeThumbnailDir = `data/thumbnails/${artistId}`;
const imageLimit = 10 * 1024 * 1024;
const now = new Date().toISOString();
const ffmpegPath = process.env.ART_ATLAS_FFMPEG
  || (fs.existsSync('C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe') ? 'C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe'
    : (fs.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg'));

const commonSources = [
  wiki,
  wikidata,
  'https://www.nationalgallery.org.uk/artists/anthony-van-dyck',
  'https://www.nga.gov/artists/1259-sir-anthony-van-dyck'
];

const country = {ko: '스페인령 네덜란드', en: 'Spanish Netherlands'};
const movement = {ko: '플랑드르 바로크 회화', en: 'Flemish Baroque painting'};

const imageWorks = [
  {
    id: 'van-dyck-christ-crowned-with-thorns-1620',
    file: 'Anthonis_van_Dyck_004.jpg',
    out: 'van-dyck-christ-crowned-with-thorns-1620.jpg',
    year: 1620,
    popularity: 9100,
    title: {ko: '가시관을 쓴 그리스도', en: 'Christ Crowned with Thorns'},
    description: {
      ko: '젊은 반 다이크가 루벤스의 강렬한 인물극과 베네치아적 색채를 흡수해, 고통과 조롱의 순간을 촘촘한 군상과 빛의 대비로 압축한 종교화입니다.',
      en: 'An early religious scene in which Van Dyck absorbs Rubensian drama and Venetian colour, compressing mockery and suffering through dense figures and sharp light.'
    },
    technique: {ko: '극적인 명암, 밀집 군상, 루벤스식 역동성', en: 'Dramatic chiaroscuro, crowded figural grouping, Rubensian energy'},
    collection: [{ko: '프라도 미술관, 마드리드', en: 'Museo del Prado, Madrid'}],
    sources: [
      'https://commons.wikimedia.org/wiki/File:Anthonis_van_Dyck_004.jpg',
      'https://www.museodelprado.es/en/the-collection/art-work/the-crown-of-thorns/'
    ],
    representative: false,
    movementContribution: true
  },
  {
    id: 'van-dyck-samson-and-delilah-1628-1630',
    file: 'Anton_van_Dyck_-_Samson_and_Delilah_-_Google_Art_Project.jpg',
    out: 'van-dyck-samson-and-delilah-1628-1630.jpg',
    year: 1628,
    yearEnd: 1630,
    popularity: 9400,
    title: {ko: '삼손과 들릴라', en: 'Samson and Delilah'},
    description: {
      ko: '삼손이 배신당하는 순간을 격렬한 대각선 구성과 감정이 흔들리는 표정으로 보여 주며, 바로크적 사건성과 반 다이크 특유의 서정성을 함께 드러냅니다.',
      en: 'The betrayal of Samson becomes a diagonal surge of bodies and conflicted expressions, joining Baroque action to Van Dyck’s characteristic emotional lyricism.'
    },
    technique: {ko: '대각선 구도, 감정적 표정, 역사화적 극성', en: 'Diagonal composition, emotional expression, history-painting drama'},
    collection: [{ko: '빈 미술사박물관', en: 'Kunsthistorisches Museum Wien'}],
    sources: ['https://artsandculture.google.com/asset/samson-and-delilah-0097/ggFmBL7gYcnEbg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'van-dyck-self-portrait-with-a-sunflower-1632',
    file: 'Anthony_van_Dyck_-_Self-portrait_with_a_Sunflower.jpg',
    out: 'van-dyck-self-portrait-with-a-sunflower-1632.jpg',
    year: 1632,
    yearEnd: 1633,
    popularity: 9800,
    title: {ko: '해바라기가 있는 자화상', en: 'Self-portrait with a Sunflower'},
    description: {
      ko: '화려한 의상과 해바라기, 금사슬을 통해 왕실 화가로서의 위상과 후원자 찰스 1세에 대한 충성을 세련된 궁정 이미지로 표현한 자화상입니다.',
      en: 'With brilliant dress, a sunflower, and a gold chain, Van Dyck fashions himself as a court artist whose elegance signals status and loyalty to Charles I.'
    },
    technique: {ko: '궁정 초상, 상징적 정물, 비단 질감 표현', en: 'Court portraiture, symbolic still-life motif, silk texture'},
    collection: [{ko: '웨스트민스터 공작 소장', en: 'Duke of Westminster Collection'}],
    sources: [
      'https://commons.wikimedia.org/wiki/Category:Self-portrait_with_a_Sunflower_(Anthony_van_Dyck)',
      'https://quod.lib.umich.edu/h/hart/x-736194/02D101228'
    ],
    representative: true,
    movementContribution: true
  },
  {
    id: 'van-dyck-charles-i-and-henrietta-maria-with-children-1632',
    file: 'Anthony_van_Dyck_-_Charles_I_and_Henrietta_Maria_with_their_two_eldest_children,_Prince_Charles_and_Princess_Mary.jpg',
    out: 'van-dyck-charles-i-and-henrietta-maria-with-children-1632.jpg',
    year: 1632,
    popularity: 9550,
    title: {ko: '찰스 1세와 헨리에타 마리아, 그리고 두 장자녀', en: 'Charles I and Henrietta Maria with their Two Eldest Children'},
    description: {
      ko: '찰스 1세의 궁정화가가 된 직후 제작된 대형 가족 초상으로, 공식 국가 초상과 사적인 가족 대화 장면을 부드럽게 결합합니다.',
      en: 'Painted just after Van Dyck became court painter to Charles I, this large family portrait blends official state image and intimate dynastic conversation.'
    },
    technique: {ko: '왕실 가족 초상, 비단 광택, 고전적 기둥 배경', en: 'Royal family portrait, shimmering silk, classical column setting'},
    collection: [{ko: '영국 왕실 컬렉션', en: 'Royal Collection Trust'}],
    sources: ['https://www.rct.uk/collection/publications/the-royal-portrait/charles-i-and-henrietta-maria-with-their-two-eldest-children-prince-charles-and-princess-mary'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'van-dyck-charles-i-with-m-de-st-antoine-1633',
    file: 'Anthony_van_Dyck_-_Charles_I_(1600-49)_with_M._de_St_Antoine_-_Google_Art_Project.jpg',
    out: 'van-dyck-charles-i-with-m-de-st-antoine-1633.jpg',
    year: 1633,
    popularity: 9700,
    title: {ko: '찰스 1세와 생앙투안 씨', en: 'Charles I with M. de St Antoine'},
    description: {
      ko: '백마에 오른 찰스 1세와 승마 교관 생앙투안을 배치해 군주의 권위, 승마 문화, 궁정의 화려함을 장대한 세로 화면에 담았습니다.',
      en: 'Charles I appears on horseback with his riding master M. de St Antoine, turning royal authority, horsemanship, and court spectacle into a monumental portrait.'
    },
    technique: {ko: '기마 초상, 궁정 의례, 장대한 세로 구도', en: 'Equestrian portraiture, court ceremony, monumental vertical composition'},
    collection: [{ko: '영국 왕실 컬렉션, 윈저성', en: 'Royal Collection Trust, Windsor Castle'}],
    sources: [
      'https://commons.wikimedia.org/wiki/File:Anthony_van_Dyck_-_Charles_I_(1600-49)_with_M._de_St_Antoine_-_Google_Art_Project.jpg',
      'https://www.rct.uk/collection/stories/charles-lost-collection'
    ],
    representative: true,
    movementContribution: true
  },
  {
    id: 'van-dyck-lamentation-over-dead-christ-1635',
    file: 'Bewening_van_Christus,_Anthony_van_Dyck,_(1635),_Koninklijk_Museum_voor_Schone_Kunsten_Antwerpen,_404.jpg',
    out: 'van-dyck-lamentation-over-dead-christ-1635.jpg',
    year: 1635,
    popularity: 9300,
    title: {ko: '죽은 그리스도를 애도함', en: 'The Lamentation over the Dead Christ'},
    description: {
      ko: '십자가에서 내려진 그리스도를 둘러싼 인물들의 슬픔을 긴 가로 화면에 펼치며, 종교적 감정과 인체의 부드러운 리듬을 결합한 후기 종교화입니다.',
      en: 'In a broad horizontal format, mourners surround the dead Christ, joining religious feeling to Van Dyck’s supple rhythm of bodies and gestures.'
    },
    technique: {ko: '애도 장면, 감정적 제스처, 넓은 가로 화면', en: 'Lamentation scene, emotional gesture, broad horizontal format'},
    collection: [{ko: '안트베르펜 왕립미술관', en: 'Royal Museum of Fine Arts Antwerp'}],
    sources: [
      'https://commons.wikimedia.org/wiki/File:Bewening_van_Christus,_Anthony_van_Dyck,_(1635),_Koninklijk_Museum_voor_Schone_Kunsten_Antwerpen,_404.jpg',
      'https://www.wikidata.org/wiki/Wikidata:WikiProject_sum_of_all_paintings/Collection/Royal_Museum_of_Fine_Arts_Antwerp'
    ],
    representative: false,
    movementContribution: true
  },
  {
    id: 'van-dyck-charles-i-at-the-hunt-1635',
    file: 'Charles_I_of_England.jpg',
    out: 'van-dyck-charles-i-at-the-hunt-1635.jpg',
    year: 1635,
    popularity: 9850,
    title: {ko: '사냥 중인 찰스 1세', en: 'Charles I at the Hunt'},
    description: {
      ko: '왕이 말에서 내려 관람자를 향해 서 있는 비공식적 순간을 빌려, 자연스러운 자세 속에서도 절제된 군주의 위엄을 만들어 낸 대표적 궁정 초상입니다.',
      en: 'By showing the king dismounted during a hunt, Van Dyck creates a seemingly informal yet carefully controlled image of royal poise and authority.'
    },
    technique: {ko: '궁정 초상, 풍경 배경, 자연스러운 권위 연출', en: 'Court portraiture, landscape setting, informal royal authority'},
    collection: [{ko: '루브르 박물관, 파리', en: 'Louvre Museum, Paris'}],
    sources: ['https://commons.wikimedia.org/wiki/File:Charles_I_of_England.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'van-dyck-princess-mary-daughter-of-charles-i-1637',
    file: 'Anthony_van_Dyck_-_Princess_Mary,_Daughter_of_Charles_I_-_Google_Art_Project.jpg',
    out: 'van-dyck-princess-mary-daughter-of-charles-i-1637.jpg',
    year: 1637,
    popularity: 9250,
    title: {ko: '찰스 1세의 딸 메리 공주', en: 'Princess Mary, Daughter of Charles I'},
    description: {
      ko: '어린 공주를 전신 초상 형식으로 세워 은빛 의복, 장식 천, 정제된 자세를 통해 왕실 초상의 품격과 섬세함을 보여 줍니다.',
      en: 'A full-length portrait of the young princess in which silver costume, ornamental fabric, and restrained pose refine the language of royal portraiture.'
    },
    technique: {ko: '전신 초상, 은빛 직물 묘사, 정제된 궁정 자세', en: 'Full-length portrait, silver textile detail, poised courtly stance'},
    collection: [{ko: '보스턴 미술관', en: 'Museum of Fine Arts, Boston'}],
    sources: [
      'https://commons.wikimedia.org/wiki/File:Anthony_van_Dyck_-_Princess_Mary,_Daughter_of_Charles_I_-_Google_Art_Project.jpg',
      'https://www.wikidata.org/wiki/Q20537525'
    ],
    representative: false,
    movementContribution: true
  },
  {
    id: 'van-dyck-equestrian-portrait-of-charles-i-1638-1639',
    file: 'Anthonis_van_Dyck_-_Equestrian_Portrait_of_Charles_I_-_National_Gallery,_London.jpg',
    out: 'van-dyck-equestrian-portrait-of-charles-i-1638-1639.jpg',
    year: 1638,
    yearEnd: 1639,
    popularity: 9900,
    title: {ko: '찰스 1세의 기마 초상', en: 'Equestrian Portrait of Charles I'},
    description: {
      ko: '거대한 말 위의 찰스 1세를 낮은 시점에서 올려 보게 하며, 기마 초상의 전통을 영국 왕권의 위엄과 결합한 반 다이크의 대표작입니다.',
      en: 'Seen from below, Charles I towers on horseback, fusing the equestrian portrait tradition with a grand image of British royal authority.'
    },
    technique: {ko: '대형 기마 초상, 낮은 시점, 티치아노식 권위 이미지', en: 'Monumental equestrian portrait, low viewpoint, Titianesque authority image'},
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    sources: ['https://www.nationalgallery.org.uk/paintings/anthony-van-dyck-equestrian-portrait-of-charles-i'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'van-dyck-mary-stuart-and-william-ii-1641',
    file: 'Anthonis_van_Dyck_036.jpg',
    out: 'van-dyck-mary-stuart-and-william-ii-1641.jpg',
    year: 1641,
    popularity: 9500,
    title: {ko: '메리 스튜어트와 빌럼 2세', en: 'Mary Stuart and William II'},
    description: {
      ko: '1641년 혼인을 기념해 그린 이중 초상으로, 어린 왕녀와 오라녜 공을 손을 맞잡은 전신상으로 세워 영국과 네덜란드 왕가의 결합을 보여 줍니다.',
      en: 'Painted for their 1641 marriage, this double portrait presents the child bride and Prince of Orange hand in hand as an image of dynastic alliance.'
    },
    technique: {ko: '이중 전신 초상, 혼인 상징, 궁정 의복 묘사', en: 'Double full-length portrait, marriage symbolism, court costume detail'},
    collection: [{ko: '암스테르담 국립미술관', en: 'Rijksmuseum, Amsterdam'}],
    sources: [
      'https://www.rijksmuseum.nl/en/collection/object/Mary-Stuart-and-William-II--3f2d2d5e6f1647e9b157e335c15985de',
      'https://artsandculture.google.com/asset/william-ii-prince-of-orange-and-his-bride-mary-stuart-dyck-anthony-van/ZQFrg3nK-U4BXQ'
    ],
    representative: true,
    movementContribution: true
  }
];

function relativeLocalSource(file) {
  return `local file: ${path.join(downloadDir, file)}`;
}

function jpgUnderLimit(source, target) {
  if (fs.statSync(source).size <= imageLimit) {
    fs.copyFileSync(source, target);
    return;
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'art-atlas-van-dyck-'));
  const temporary = path.join(staging, 'display.jpg');
  try {
    for (const size of [3200, 2800, 2400, 2200, 2000, 1800, 1600, 1400, 1200, 1000]) {
      for (const quality of [3, 5, 7, 9, 12]) {
        execFileSync(ffmpegPath, ['-y', '-i', source, '-vf', `scale=min(${size}\\,iw):-2`, '-frames:v', '1', '-update', '1', '-q:v', String(quality), temporary], {stdio: 'ignore', windowsHide: true});
        if (fs.statSync(temporary).size <= imageLimit) {
          fs.copyFileSync(temporary, target);
          return;
        }
      }
    }
    throw new Error(`Could not reduce ${path.basename(source)} below 10 MB as JPEG`);
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
      subtitle: {ko: '플랑드르 바로크의 우아한 궁정 초상과 종교적 극성을 보여 주는 반 다이크 작품', en: 'A Van Dyck work showing Flemish Baroque courtly elegance and religious drama'},
      description: work.description,
      technique: work.technique,
      sources: [...sourceUrls, localSource],
      facts: {
        artist: {ko: '안토니 반 다이크', en: 'Anthony van Dyck'},
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
  jpgUnderLimit(source, target);
  const entry = workEntry(work);
  works.push(entry);
  thumbnailIndex[work.id] = {
    thumbnail: entry.thumbnail,
    checkedAt: now,
    verifiedBy: `Anthony van Dyck local file import; ${wiki}`,
    imageHash: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
  };
}
works.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0) || (Number(a.yearEnd) || Number(a.year) || 0) - (Number(b.yearEnd) || Number(b.year) || 0));
fs.writeFileSync(path.join(thumbnailDir, 'index.json'), `${JSON.stringify(thumbnailIndex, null, 2)}\n`, 'utf8');

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = {
  id: artistId,
  qid,
  name: {ko: '안토니 반 다이크', en: 'Anthony van Dyck'},
  fullName: '반 다이크, 안토니',
  birth: 1599,
  death: 1641,
  nationality: {ko: '플랑드르', en: 'Flemish'},
  birthCountry: country,
  movement,
  aliases: {
    ko: ['반 다이크', '안토니 판 다이크', '안톤 반 다이크', '안토니스 반 다이크', '반 다이크, 안토니'],
    en: ['Sir Anthony van Dyck', 'Anthony Vandyke', 'Antoon van Dyck', 'Anthonis van Dyck', 'Anton van Dyck', 'van Dyck', 'Vandyke']
  },
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata
  },
  works,
  featuredWorkIds: [
    'van-dyck-equestrian-portrait-of-charles-i-1638-1639',
    'van-dyck-charles-i-at-the-hunt-1635',
    'van-dyck-self-portrait-with-a-sunflower-1632'
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
console.log(`Imported Anthony van Dyck with ${works.length} local works.`);
