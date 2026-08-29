const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const sourceDir = path.join(root, '다운로드용');
const targetDir = path.join(root, 'data', 'images', 'artist-Q313122');
const artistId = 'artist-Q313122';
const works = [
  ['triumph-of-venus', '3840px-The_Triumph_of_Venus,_by_François_Boucher.jpg', '비너스의 승리', 'The Triumph of Venus', '1740', '바다에서 떠오른 비너스를 중심에 둔 신화 장면으로, 부셰 특유의 밝은 색과 관능적 장식을 보여준다.', 'A mythological scene centred on Venus rising from the sea, showing Boucher’s luminous colour and sensual decoration.'],
  ['diana-leaving-bath', 'Boucher_Diane_sortant_du_bain_Louvre_2712.jpg', '목욕을 마친 디아나', 'Diana Leaving the Bath', '1742', '사냥의 여신을 사적인 목욕 장면으로 바꾸어 로코코의 친밀하고 우아한 신화화를 보여준다.', 'Transforms the huntress goddess into an intimate bathing scene, characteristic of Rococo mythological painting.'],
  ['pompadour-1756', 'Boucher_Marquise_de_Pompadour_1756.jpg', '퐁파두르 후작부인', 'Marquise de Pompadour', '1756', '주요 후원자 퐁파두르를 궁정의 지성과 취향을 지닌 인물로 묘사한 초상이다.', 'A portrait of his principal patron, presenting Pompadour as a figure of courtly intellect and taste.'],
  ['vulcan-venus-arms', 'Boucher_Vulcan_Presenting_Venus_with_Arms_for_Aeneas.jpg', '불카누스가 비너스에게 아이네아스의 무구를 건네다', 'Vulcan Presenting Venus with Arms for Aeneas', '1732', '고전 신화를 부드러운 색과 장식적 군상으로 풀어낸 초기 역사화다.', 'An early history painting that renders classical myth with soft colour and decorative groups.'],
  ['pompadour-1759', 'François_Boucher_-_Madame_de_Pompadour,_1759.jpg', '마담 드 퐁파두르', 'Madame de Pompadour', '1759', '퐁파두르의 후원이 부셰의 궁정 장식·초상 작업과 결합했음을 보여주는 대표 초상이다.', 'A key portrait showing how Pompadour’s patronage connected Boucher to court decoration and portraiture.'],
  ['pastoral-landscape', 'François_Boucher_007.jpg', '목가 풍경', 'Pastoral Landscape', '연도 미상', '다운로드 파일의 작품명은 확인되지 않아 목가 풍경으로 임시 표기했다. 제목·연도는 소장처 자료 확인 후 보완한다.', 'The downloaded file lacks a confirmed title, so it is provisionally labelled Pastoral Landscape pending collection-record verification.'],
  ['resting-girl', 'Resting_Girl_by_François_Boucher_(1753)_-_Alte_Pinakothek_-_Munich_-_Germany_2017_(crop).jpg', '휴식하는 소녀', 'The Resting Girl', '1753', '사적인 인물상과 부드러운 살결 표현으로 부셰의 관능적 로코코 양식을 보여준다.', 'An intimate figure image whose soft treatment of flesh exemplifies Boucher’s sensual Rococo manner.'],
  ['toilet-of-venus', 'The_Toilet_of_Venus,_by_François_Boucher.jpg', '비너스의 단장', 'The Toilet of Venus', '1751', '신화를 도덕적 교훈보다 관능적 장식과 우아한 색채의 장으로 바꾼 로코코 대표작이다.', 'A Rococo masterwork that turns myth into a field of sensual decoration and graceful colour rather than moral instruction.'],
  ['venus-consoling-love', 'Venus_Consoling_Love,_François_Boucher,_1751.jpg', '비너스가 사랑을 위로하다', 'Venus Consoling Love', '1751', '사랑의 신화를 친밀한 감정과 섬세한 색채로 풀어낸 작품이다.', 'A treatment of mythological love through intimate feeling and delicate colour.']
];

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = data.artists?.find(item => item.id === artistId);
if (!artist) throw new Error('François Boucher was not found');
fs.mkdirSync(targetDir, {recursive: true});
for (const [key, filename, ko, en, year, koDescription, enDescription] of works) {
  const source = path.join(sourceDir, filename);
  if (!fs.existsSync(source)) throw new Error(`Missing local image: ${filename}`);
  const workId = key === 'toilet-of-venus' ? `${artistId}-representative-work` : `${artistId}-${key}`;
  const extension = path.extname(filename).toLowerCase() === '.jpeg' ? '.jpg' : path.extname(filename).toLowerCase();
  const destination = path.join(targetDir, `${workId}${extension}`);
  fs.copyFileSync(source, destination);
  const localPath = path.relative(root, destination).replace(/\\/g, '/');
  const work = {
    id: workId,
    title: {ko, en},
    year,
    popularity: key === 'toilet-of-venus' ? 100 : 76,
    description: {ko: koDescription, en: enDescription},
    country: {ko: '프랑스', en: 'France'},
    movement: {ko: '로코코', en: 'Rococo'},
    image: localPath,
    thumbnail: localPath,
    highResImage: localPath,
    highResOriginal: localPath,
    source: `local download import: ${filename}`,
    verified: key !== 'pastoral-landscape',
    origin: 'manual'
  };
  const index = (artist.works || []).findIndex(item => item.id === workId);
  if (index >= 0) artist.works[index] = {...artist.works[index], ...work};
  else artist.works.push(work);
}
artist.artistSummary = artist.artistSummary || {ko: [], en: []};
artist.artistSummary.ko = [
  '프랑스의 화가·소묘가·판화가로, 신화·목가·장식적 알레고리를 관능적이고 부드러운 색채로 풀어 프랑스 로코코를 대표했다.',
  '초기에는 목가와 풍경을 생동감 있게 다루었고, 이후에는 고전 신화를 사적이고 친밀한 감정의 장면으로 바꾸었다.',
  '퐁파두르의 후원과 베르사유 장식 수주를 통해 궁정 취향의 중심 화가가 되었다.'
];
artist.artistSummary.en = [
  'A French painter, draughtsman, and printmaker who made myth, pastoral subjects, and decorative allegory central to French Rococo through sensual, soft colour.',
  'His early work treated pastoral landscape vividly, while later mythological scenes became intimate rather than conventionally epic.',
  'Pompadour’s patronage and Versailles commissions made him a central painter of courtly taste.'
];
data.metadata = {...data.metadata, updatedAt: new Date().toISOString(), revision: (Number(data.metadata?.revision) || 0) + 1};
fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported ${works.length} local François Boucher images.`);
