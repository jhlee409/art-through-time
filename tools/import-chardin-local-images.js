const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistId = 'artist-Q312309';
const artistsFile = path.join(root, 'data', 'artists.json');
const sourceDir = path.join(root, '다운로드용');
const targetDir = path.join(root, 'data', 'images', artistId);
const works = [
  ['good-education', '3840px-Chardin,_Jean-Siméon_-_The_Good_Education_-_Google_Art_Project.jpg', '좋은 교육', 'The Good Education', 1753, '아이의 교육을 조용한 가정 장면으로 다루며, 로코코의 유희와 다른 절제된 도덕적 분위기를 보여준다.', 'A quiet domestic image of education whose restrained moral tone differs from Rococo playfulness.'],
  ['portrait-godefroy', '3840px-Chardin,_Jean_Siméon_-_Godefroy,_Auguste_Gabriel_-_Museu_de_Arte_de_São_Paulo_-_Google_Art_Project.jpg', '오귀스트 가브리엘 고드프루아의 초상', 'Portrait of Auguste Gabriel Godefroy', null, '인물의 표정과 물성을 절제된 색조로 관찰한 초상이다. 제작 연도는 소장처 기록 확인이 필요하다.', 'A portrait observed through restrained colour and close attention to expression and material presence; its date requires collection-record confirmation.'],
  ['soap-bubbles', 'Soap_Bubbles_1733-5_Jean-Baptiste-Simeon_Chardin.jpg', '비눗방울', 'Soap Bubbles', 1734, '일상적인 놀이를 덧없음에 대한 조용한 성찰로 바꾼 풍속화다.', 'A genre painting that turns an everyday game into a quiet reflection on transience.'],
  ['prayer-before-meal', 'Jean_Siméon_Chardin_-_The_Prayer_before_Meal_-_WGA04770.jpg', '식사 전 기도', 'The Prayer before Meal', 1740, '중산층 가정의 식사 장면을 부드러운 빛과 절제된 몸짓으로 묘사한 대표 풍속화다.', 'A major genre scene of a middle-class meal, painted with soft light and restrained gesture.'],
  ['governess', 'Jean_Siméon_Chardin_-_La_Gouvernante_(The_Governess)_-_WGA04762.jpg', '가정교사', 'The Governess', 1739, '가정 안의 돌봄과 교육을 평범한 사물의 질감과 함께 존엄하게 다룬다.', 'Treats domestic care and education with dignity through the texture of ordinary things.'],
  ['basket-peaches', 'Jean_Siméon_Chardin_-_Basket_of_Peaches,_with_Walnuts,_Knife_and_Glass_of_Wine_-_WGA04783.jpg', '복숭아 바구니와 호두, 칼, 와인잔', 'Basket of Peaches, with Walnuts, Knife and Glass of Wine', 1768, '과일·유리·금속의 무게와 표면을 균형 잡힌 구도로 다룬 후기 정물화다.', 'A late still life balancing the weight and surfaces of fruit, glass, and metal.'],
  ['attributes-sciences', 'Chardin_-_Les_attributs_des_Sciences.jpg', '과학의 속성', 'The Attributes of the Sciences', 1766, '학문 도구를 정물의 언어로 바꾸어 지식과 물질 세계를 차분히 연결한다.', 'Transforms scholarly instruments into a still-life meditation on knowledge and material life.'],
  ['basket-plums', 'Chardin_-_Basket_of_Plums,_1765.jpg', '자두 바구니', 'Basket of Plums', 1765, '제철 과일과 그릇을 단순한 배열로 놓고 색·질감·공간의 미묘한 균형을 만든다.', 'Uses a simple arrangement of seasonal fruit and vessels to balance colour, texture, and space.'],
  ['attributes-arts', 'Chardin,_Jean-Baptiste_Siméon_-_Still_Life_with_Attributes_of_the_Arts_-_1766.jpg', '예술의 속성이 있는 정물', 'Still Life with Attributes of the Arts', 1766, '음악과 회화의 도구를 화려한 장식 대신 조용한 물성의 관계로 보여준다.', 'Shows the tools of music and painting as quiet relationships of material presence rather than ornate display.'],
  ['jar-apricots', '3840px-Jean-Siméon_Chardin_-_Jar_of_Apricots_-_Google_Art_Project.jpg', '살구 단지', 'Jar of Apricots', 1758, '살구·도자기·식기를 통해 빛과 표면의 미세한 차이를 집중해 관찰한 정물화다.', 'A still life focused on subtle differences of light and surface among apricots, ceramic, and tableware.']
];

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = data.artists?.find(item => item.id === artistId);
if (!artist) throw new Error('Jean-Simeon Chardin was not found');
fs.mkdirSync(targetDir, {recursive:true});
for (const [key, filename, ko, en, year, koDescription, enDescription] of works) {
  const source = path.join(sourceDir, filename);
  if (!fs.existsSync(source)) throw new Error(`Missing local image: ${filename}`);
  const workId = `${artistId}-${key}`;
  const destination = path.join(targetDir, `${workId}${path.extname(filename).toLowerCase()}`);
  fs.copyFileSync(source, destination);
  const localPath = path.relative(root, destination).replace(/\\/g, '/');
  const next = {id:workId,title:{ko,en},...(year ? {year} : {}),popularity:key === 'prayer-before-meal' ? 92 : 76,description:{ko:koDescription,en:enDescription},country:{ko:'프랑스',en:'France'},movement:{ko:'로코코 시대 프랑스 회화',en:'French painting in the Rococo era'},image:localPath,thumbnail:localPath,highResImage:localPath,highResOriginal:localPath,source:`local download import: ${filename}`,verified:Boolean(year),origin:'manual'};
  const index = (artist.works || []).findIndex(work => work.id === workId);
  if (index >= 0) artist.works[index] = {...artist.works[index],...next};
  else artist.works.push(next);
}
data.metadata = {...data.metadata,updatedAt:new Date().toISOString(),revision:(Number(data.metadata?.revision)||0)+1};
fs.writeFileSync(artistsFile, `${JSON.stringify(data,null,2)}\n`, 'utf8');
console.log(`Imported ${works.length} local Jean-Simeon Chardin images.`);
