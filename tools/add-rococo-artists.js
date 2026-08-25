const fs = require('fs');

const file = 'data/artists.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const asset = name => `data/미술사조/images/${name}`;
const artists = [
  ['artist-Q155151','Q155151','앙투안 바토','Antoine Watteau',1684,1721,'프랑스','France',1702,1721,'바토','Pilgrimage to Cythera','키테라섬으로의 순례',1717,'Antoine-20Watteau-20-20Pilgrimage-20to-20Cythera-20-20WGA25454-de23e298c518.jpg','페트 갈랑트를 통해 귀족의 사교와 덧없는 감정을 섬세한 색조로 그렸다.'],
  ['artist-Q313122','Q313122','프랑수아 부셰','François Boucher',1703,1770,'프랑스','France',1723,1770,'부셰','The Toilet of Venus','비너스의 단장',1751,'The-20Toilet-20of-20Venus-20by-20Fran-C3-A7ois-20Boucher-fc27175742d6.jpg','신화와 장식, 관능적인 색채를 결합해 프랑스 로코코의 살롱 취향을 대표했다.'],
  ['artist-Q313898','Q313898','장오노레 프라고나르','Jean-Honoré Fragonard',1732,1806,'프랑스','France',1752,1806,'프라고나르','The Swing','그네',1767,'Fragonard-The-Swing-af227c46d654.jpg','가볍고 빠른 붓질과 은밀한 연애의 서사로 로코코의 유희성을 극대화했다.'],
  ['artist-Q162048','Q162048','조반니 바티스타 티에폴로','Giovanni Battista Tiepolo',1696,1770,'이탈리아','Italy',1715,1770,'티에폴로','Apollo and the Continents','아폴론과 대륙들',1752,'Giovanni-20Battista-20Tiepolo-20-20Apollo-20and-20the-20Continents-20-4da05d03665b.jpg','밝은 색채와 솟구치는 원근법으로 베네치아 로코코 천장화의 환영을 만들었다.'],
  ['artist-Q161866','Q161866','카날레토','Canaletto',1697,1768,'이탈리아','Italy',1718,1768,'카날레토','The Stonemason’s Yard','석공의 마당',1725,'Canaletto-Stonemasons-Yard.jpg','정밀한 도시 풍경에 맑은 빛과 여행자의 시선을 결합해 베네치아의 시각적 이미지를 만들었다.'],
  ['artist-Q180117','Q180117','토머스 게인즈버러','Thomas Gainsborough',1727,1788,'영국','United Kingdom',1745,1788,'게인즈버러','The Blue Boy','파란 소년',1770,'Gainsborough-The-Blue-Boy-1770.jpg','우아한 의상과 자연 배경, 느슨한 붓질로 영국 초상화에 로코코적 세련미를 더했다.'],
  ['artist-Q189621','Q189621','윌리엄 호가스','William Hogarth',1697,1764,'영국','United Kingdom',1720,1764,'호가스','Marriage Settlement','결혼 계약',1743,'Hogarth-Marriage-Settlement.jpg','로코코의 사교적 실내와 소비문화를 풍자적 연속 서사로 비틀었다.'],
  ['artist-Q312309','Q312309','장바티스트 시메옹 샤르댕','Jean-Baptiste-Siméon Chardin',1699,1779,'프랑스','France',1720,1779,'샤르댕','The Ray','가오리',1728,'Chardin-The-Ray-WGA04738.jpg','사물의 질감과 조용한 빛을 통해 프랑스 로코코의 또 다른, 절제된 방향을 보여준다.'],
  ['artist-Q235547','Q235547','로살바 카리에라','Rosalba Carriera',1675,1757,'이탈리아','Italy',1695,1757,'카리에라','Self-Portrait','자화상',1746,'Rosalba-Carriera-Self-Portrait-WGA04503.jpg','파스텔 초상을 국제적 궁정·살롱 문화의 핵심 매체로 끌어올렸다.']
];
for (const [id,qid,ko,en,birth,death,region,regionEn,activeFrom,activeTo,alias,titleEn,titleKo,year,imageName,summary] of artists) {
  if (data.artists.some(artist => artist.id === id)) continue;
  const image = asset(imageName);
  data.artists.push({
    id, qid, name:{ko,en}, fullName:ko, birth, death,
    nationality:{ko:region,en:regionEn}, movement:{ko:'로코코',en:'Rococo'},
    aliases:{ko:[alias],en:[]}, artistSummary:{ko:[summary],en:[]},
    links:{wikidata:`https://www.wikidata.org/wiki/${qid}`},
    works:[{id:`${id}-representative-work`,year,popularity:90,title:{ko:titleKo,en:titleEn},description:{ko:summary,en:''},medium:{ko:'유화',en:'Oil painting'},country:{ko:region,en:regionEn},movement:{ko:'로코코',en:'Rococo'},image,thumbnail:image,highResImage:image,highResOriginal:image,source:`existing local project asset: ${image}`,verified:true,status:'verified',representative:true,movementContribution:true,origin:'manual'}],
    featuredWorkIds:[`${id}-representative-work`], profileResolved:true,
    metadata:{createdAt:'2026-08-24T00:00:00Z',updatedAt:'2026-08-24T00:00:00Z',createdBy:'manual entry',updatedBy:'manual entry'},
    movements:['로코코'],submovements:[],primaryMovement:'로코코',regions:[region],periods:['1600-1700','1700-1780','1750-1830'],activeFrom,activeTo
  });
}
const vigee = data.artists.find(artist => artist.id === 'artist-Q213163');
if (vigee) {
  vigee.artistSummary = {ko:['마리 앙투아네트의 초상화가로 알려진 프랑스의 대표적 여성 화가다. 후기 로코코의 우아한 초상 양식을 신고전주의 시기까지 이어 갔다.'],en:[]};
  vigee.featuredWorkIds = vigee.featuredWorkIds?.length ? vigee.featuredWorkIds : [vigee.works?.[0]?.id].filter(Boolean);
  vigee.movements = ['로코코']; vigee.primaryMovement = '로코코'; vigee.regions = ['프랑스'];
}
data.metadata = {...data.metadata, updatedAt:new Date().toISOString(), revision:(Number(data.metadata?.revision)||0)+1};
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('Added 9 Rococo painters using existing local movement-document assets.');
