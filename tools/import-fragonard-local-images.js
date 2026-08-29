const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const sourceDir = path.join(root, '다운로드용');
const targetDir = path.join(root, 'data', 'images', 'artist-Q313898');
const artistId = 'artist-Q313898';

// 작품명과 연도는 소장처·미술관 자료를 대조했다. 같은 작품의 중복 파일은 해상도가 큰 파일 하나만 사용한다.
const works = [
  ['angora-cat', 'P1110627Wallraf_museum_J.H._Fragonard_Le_chat_angora_WRM3652_rwk.jfif', '앙고라 고양이', 'The Angora Cat', 1783, null, '실내의 아이와 고양이를 다루며, 말년에도 유지된 가볍고 친밀한 관찰을 보여준다.', 'An intimate interior with a child and cat, showing his continued light and close observation in later life.'],
  ['bathers', 'Las_bañistas,_por_Jean-Honoré_Fragonard.jfif', '목욕하는 여인들', 'The Bathers', 1765, null, '울창한 자연 속 여성 군상을 빠른 붓질과 빛나는 색으로 그린 로코코 풍속화다.', 'A Rococo genre scene of women in lush nature, painted with rapid brushwork and luminous colour.'],
  ['coresus-callirhoe', 'Jean-Honoré_Fragonard_-_El_sacrificio_de_Caliroe_-_Google_Art_Project.jpg', '코레소스와 칼리로에', 'Coresus Sacrificing Himself to Save Callirhoe', 1765, null, '왕립 아카데미 입회작으로, 비극적 고전 주제를 대형 역사화로 다룬 드문 사례다.', 'His Royal Academy reception piece, a rare large-scale history painting on a tragic classical subject.'],
  ['blind-mans-bluff', '3840px-Jean-Honoré_Fragonard_-_Blind-Man’s_Buff_-_Google_Art_Project.jpg', '눈가림 놀이', "Blind Man's Bluff", 1750, 1752, '정원에서의 놀이와 몸짓을 통해 로코코 특유의 유희적 친밀감을 표현한다.', 'A garden game whose lively gestures convey Rococo playfulness and intimacy.'],
  ['aurora-over-night', 'Jean-Honoré_Fragonard_-_Aurora_Triumphing_over_Night_-_2013.62_-_Museum_of_Fine_Arts.jpg', '아우로라가 밤을 이기다', 'Aurora Triumphing over Night', 1755, 1756, '새벽의 여신을 역동적인 대각 구도와 밝은 색으로 묘사한 초기 신화화다.', 'An early mythological painting of the dawn goddess in a dynamic diagonal composition and bright colour.'],
  ['musical-contest', 'Fragonard_musical.jpg', '음악 경연', 'The Musical Contest', 1754, 1755, '공원에서의 음악과 구애를 우아한 군상으로 엮은 초기 로코코 장면이다.', 'An early Rococo scene of music and courtship in a garden, arranged as an elegant group.'],
  ['see-saw', 'Fragonard,_The_See-Saw.jpg', '시소', 'The See-Saw', 1750, 1752, '놀이의 흔들림과 인물들의 시선을 결합해 로코코의 가벼운 리듬을 만든다.', 'The movement of play and the figures’ gazes create a light Rococo rhythm.'],
  ['stolen-kiss', '3840px-Jean-Honoré_Fragonard_-_The_Stolen_Kiss.jpg', '훔친 입맞춤', 'The Stolen Kiss', 1785, 1789, '실내에서의 짧고 은밀한 순간을 섬세한 빛과 긴장으로 포착한 후기 작품이다.', 'A late work that catches a fleeting private moment indoors with delicate light and tension.'],
  ['progress-of-love-meeting', "3840px-Jean-Honoré_Fragonard_-_Les_Progrès_de_l'amour_-_Le_rendez-vous_-_Google_Art_Project.jpg", '사랑의 진전: 만남', 'The Progress of Love: The Meeting', 1771, 1772, '마담 뒤바리의 주문으로 제작된 연작의 한 장면으로, 정원과 연애 서사를 장식적으로 결합한다.', 'A panel from the series commissioned by Madame du Barry, joining garden setting and courtship narrative decoratively.'],
  ['girl-with-dog', '1770_Fragonard_Maedchen_mit_Hund_anagoria.jpg', '개와 있는 소녀', 'Girl with a Dog', 1765, 1772, '소녀와 반려견의 사적인 장면을 부드러운 색과 즉흥적인 붓질로 그렸다.', 'An intimate image of a girl and dog, painted with soft colour and spontaneous brushwork.']
];

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = data.artists?.find(item => item.id === artistId);
if (!artist) throw new Error('Jean-Honore Fragonard was not found');
fs.mkdirSync(targetDir, {recursive: true});

for (const [key, filename, ko, en, year, yearEnd, koDescription, enDescription] of works) {
  const source = path.join(sourceDir, filename);
  if (!fs.existsSync(source)) throw new Error(`Missing local image: ${filename}`);
  const extension = path.extname(filename).toLowerCase();
  const workId = `${artistId}-${key}`;
  const destination = path.join(targetDir, `${workId}${extension}`);
  fs.copyFileSync(source, destination);
  const localPath = path.relative(root, destination).replace(/\\/g, '/');
  const work = {
    id: workId,
    title: {ko, en},
    year,
    ...(yearEnd ? {yearEnd} : {}),
    popularity: key === 'progress-of-love-meeting' ? 92 : 76,
    description: {ko: koDescription, en: enDescription},
    country: {ko: '프랑스', en: 'France'},
    movement: {ko: '로코코', en: 'Rococo'},
    image: localPath,
    thumbnail: localPath,
    highResImage: localPath,
    highResOriginal: localPath,
    source: `local download import: ${filename}`,
    verified: true,
    origin: 'manual'
  };
  const index = (artist.works || []).findIndex(item => item.id === workId);
  if (index >= 0) artist.works[index] = {...artist.works[index], ...work};
  else artist.works.push(work);
}

artist.artistSummary = {
  ko: [
    '프랑스의 화가·소묘가·판화가로, 친밀감과 은근한 에로티시즘을 담은 풍속화·연애 장면으로 로코코의 쾌락주의적 면모를 대표했다.',
    '루이 15세 시대의 부유한 궁정 후원자들은 사랑과 관능의 장면을 주문했고, 프라고나르는 부드러운 색채와 능숙하고 빠른 붓질로 이에 응답했다.',
    '후기에는 로코코의 장식성과 유동성을 유지하면서도 신고전주의적 구성과 표면을 실험했다.'
  ],
  en: [
    'A French painter, draughtsman, and printmaker whose intimate, subtly erotic genre and courtship scenes embody Rococo hedonism.',
    'Wealthy patrons of Louis XV’s court sought images of love and sensuality, to which Fragonard responded with soft colour and fluent, rapid brushwork.',
    'Later he experimented with Neoclassical composition and surface while retaining aspects of Rococo freedom.'
  ]
};
data.metadata = {...data.metadata, updatedAt: new Date().toISOString(), revision: (Number(data.metadata?.revision) || 0) + 1};
fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported ${works.length} local Jean-Honore Fragonard images.`);
