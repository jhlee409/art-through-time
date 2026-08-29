const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');

const root = path.resolve(__dirname, '..');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q7803';
const qid = 'Q7803';
const fetchedAt = new Date().toISOString();
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const generatedFile = path.join(root, 'data', 'generated', `qid-${qid}.json`);
const indexFile = path.join(thumbnailDir, 'index.json');
const imageLimit = 10 * 1024 * 1024;
const ffmpegPath = process.env.ART_ATLAS_FFMPEG
  || (fs.existsSync('C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe') ? 'C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe'
    : (fs.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg'));

const wiki = 'https://en.wikipedia.org/wiki/Bronzino';
const artist = {
  name: {ko: '브론치노', en: 'Bronzino'},
  birth: 1503,
  death: 1572,
  nationality: {ko: '이탈리아', en: 'Italy'},
  movement: {ko: '매너리즘', en: 'Mannerism'},
  aliases: {
    ko: ['아뇰로 브론치노', '아뇰로 디 코시모', '일 브론치노', '브론치노, 아뇰로'],
    en: ['Agnolo Bronzino', 'Agnolo di Cosimo', 'Agnolo di Cosimo di Mariano', 'Il Bronzino', 'Angelo Bronzino']
  }
};

const works = [
  {
    id: 'bronzino-venus-cupid-folly-and-time-1544-1545',
    file: 'Angelo_Bronzino_-_Venus,_Cupid,_Folly_and_Time_-_National_Gallery,_London.jpg',
    out: 'bronzino-venus-cupid-folly-and-time-1544-1545.png',
    year: 1544,
    yearEnd: 1545,
    popularity: 10000,
    title: {ko: '비너스, 큐피드, 어리석음과 시간', en: 'Venus, Cupid, Folly and Time'},
    description: {
      ko: '런던 내셔널 갤러리의 알레고리화로, 매끈한 표면과 차가운 색채, 복잡하게 얽힌 인체와 수수께끼 같은 상징이 피렌체 궁정 매너리즘의 지적이고 인공적인 성격을 보여줍니다.',
      en: 'A courtly allegory whose polished surface, cool color, entwined bodies, and enigmatic symbols show the intellectual artifice of Florentine Mannerism.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    representative: true,
    movementContribution: true
  }
];

function pngUnderLimit(source, target) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'art-atlas-bronzino-'));
  const temporary = path.join(staging, 'display.png');
  try {
    for (const size of [2400, 2000, 1600, 1200, 1000, 800, 640, 480]) {
      execFileSync(ffmpegPath, ['-y', '-i', source, '-vf', `scale=min(${size}\\,iw):-2`, '-frames:v', '1', '-update', '1', '-compression_level', '9', '-pred', 'mixed', temporary], {stdio: 'ignore', windowsHide: true});
      const stat = fs.statSync(temporary);
      if (stat.size <= imageLimit) {
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
  const image = `data/images/${artistId}/${work.out}`;
  const source = `${wiki}; local file: ${path.join(downloadDir, work.file)}`;
  return {
    id: work.id,
    year: work.year,
    yearEnd: work.yearEnd,
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
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
for (const work of works) {
  const source = path.join(downloadDir, work.file);
  const target = path.join(thumbnailDir, work.out);
  if (!fs.existsSync(source)) throw new Error(`Missing download image: ${source}`);
  pngUnderLimit(source, target);
  const relative = `data/images/${artistId}/${work.out}`;
  index[work.id] = {
    thumbnail: relative,
    checkedAt: fetchedAt,
    verifiedBy: `Bronzino local file import; ${wiki}`,
    imageHash: createHash('sha256').update(fs.readFileSync(target)).digest('hex')
  };
}
fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

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
console.log(`Imported ${payload.works.length} Bronzino works into ${path.relative(root, generatedFile)}`);
