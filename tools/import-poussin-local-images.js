const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const downloadDir = path.join(root, '다운로드용');
const artistId = 'artist-Q41554';
const qid = 'Q41554';
const thumbnailDir = path.join(root, 'data', 'images', artistId);
const relativeThumbnailDir = `data/images/${artistId}`;
const now = new Date().toISOString();
const actor = 'local download import';
const wiki = 'https://en.wikipedia.org/wiki/Nicolas_Poussin';
const wikidata = 'https://www.wikidata.org/wiki/Q41554';
const country = {ko: '프랑스', en: 'France'};
const movement = {ko: '바로크', en: 'Baroque'};
const commonSources = [wiki, wikidata];
const artistName = {ko: '니콜라 푸생', en: 'Nicolas Poussin'};

const artistSummary = {
  ko: [
    '라파엘로의 작품에 감화되어, 1624년에 로마로 가서 당시의 유행 작풍이었던 카라치파의 작품을 배웠다.',
    '그의 작품 대부분은 종교적이고 신화적인 주제를 다루었고, 말년에는 풍경화를 더욱 중요하게 다루었다.',
    '그의 작품은 명료함, 논리성, 질서가 특징이며, 색채보다는 선을 중시한다. 20세기까지 그는 자크 루이 다비드, 장 오귀스트 도미니크 앵그르, 폴 세잔과 같은 고전주의 성향의 예술가들에게 큰 영감을 주었다.'
  ],
  en: [
    'Inspired by Raphael, he went to Rome in 1624 and studied the Carracci school, which was then influential.',
    'Most of his works treated religious and mythological subjects, while landscape became increasingly important in his later years.',
    'His work is marked by clarity, logic, and order, and gives priority to line over colour. Into the twentieth century, he strongly inspired classicizing artists such as Jacques-Louis David, Jean-Auguste-Dominique Ingres, and Paul Cezanne.'
  ]
};

const imageWorks = [
  {
    id: 'poussin-victory-of-joshua-over-amorites-1625-1626',
    file: 'Nicolas_Poussin_-_The_Victory_of_Joshua_over_Amorites_-_Pushkin_museum.jpg',
    out: 'poussin-victory-of-joshua-over-amorites-1625-1626.jpg',
    year: 1625,
    yearEnd: 1626,
    popularity: 72,
    title: {ko: '아모리 사람들에게 승리한 여호수아', en: 'The Victory of Joshua over the Amorites'},
    description: {
      ko: '성서의 전투 장면을 질서 있는 인물 배치와 명료한 동작으로 구성해 푸생 초기 역사화의 구조적 감각을 보여 줍니다.',
      en: 'A biblical battle scene organized through clear action and ordered figure placement, showing Poussin\'s early structural sense.'
    },
    collection: [{ko: '푸시킨 미술관, 모스크바', en: 'Pushkin Museum, Moscow'}],
    sources: ['local download: Nicolas_Poussin_-_The_Victory_of_Joshua_over_Amorites_-_Pushkin_museum.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-death-of-germanicus-1627',
    file: 'Nicolas_Poussin_-_La_Mort_de_Germanicus.jpg',
    out: 'poussin-death-of-germanicus-1627.jpg',
    year: 1627,
    popularity: 94,
    title: {ko: '게르마니쿠스의 죽음', en: 'The Death of Germanicus'},
    description: {
      ko: '죽음과 충성을 고전적 무대처럼 배열해 감정보다 역사적 품위와 논리적 구성을 앞세운 푸생의 대표 역사화입니다.',
      en: 'A major history painting that stages death and loyalty with classical dignity and logical composition rather than emotional excess.'
    },
    collection: [{ko: '미니애폴리스 미술관', en: 'Minneapolis Institute of Art'}],
    sources: ['local download: Nicolas_Poussin_-_La_Mort_de_Germanicus.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-cephalus-and-aurora-1627-1630',
    file: 'Cephalus_and_Aurora_-_Poussin_-_1627-30_National_Gallery,_London.jpg',
    out: 'poussin-cephalus-and-aurora-1627-1630.jpg',
    year: 1627,
    yearEnd: 1630,
    popularity: 76,
    title: {ko: '케팔로스와 오로라', en: 'Cephalus and Aurora'},
    description: {
      ko: '신화적 사랑 이야기를 고전적 인체와 풍경 속에 배치해 푸생의 신화화와 명료한 화면 질서를 함께 보여 줍니다.',
      en: 'A mythological love scene that joins classical bodies, landscape, and Poussin\'s lucid pictorial order.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    sources: ['local download: Cephalus_and_Aurora_-_Poussin_-_1627-30_National_Gallery,_London.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-martyrdom-of-saint-erasmus-1628-1629',
    file: 'Nicolas_Poussin_-_Le_Martyre_de_Saint_Érasme.jpg',
    out: 'poussin-martyrdom-of-saint-erasmus-1628-1629.jpg',
    year: 1628,
    yearEnd: 1629,
    popularity: 82,
    title: {ko: '성 에라스무스의 순교', en: 'The Martyrdom of Saint Erasmus'},
    description: {
      ko: '순교 장면의 고통을 극적인 바로크 감정보다 계산된 제스처와 균형 잡힌 구성으로 통제한 종교화입니다.',
      en: 'A martyrdom scene whose suffering is controlled through calculated gesture and balanced composition rather than theatrical excess.'
    },
    collection: [{ko: '바티칸 미술관', en: 'Vatican Museums'}],
    sources: ['local download: Nicolas_Poussin_-_Le_Martyre_de_Saint_Érasme.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-acis-and-galatea-1629',
    file: 'Acis_and_galatea_-_Poussin_-1629_-_Dublin_National_Gallery_of_Art.jpg',
    out: 'poussin-acis-and-galatea-1629.jpg',
    year: 1629,
    popularity: 74,
    title: {ko: '아키스와 갈라테이아', en: 'Acis and Galatea'},
    description: {
      ko: '오비디우스의 신화를 목가적 풍경과 균형 잡힌 인물 배열로 해석해 푸생의 고전적 신화 세계를 보여 줍니다.',
      en: 'An Ovidian myth interpreted through pastoral landscape and balanced figure arrangement, typical of Poussin\'s classical mythology.'
    },
    collection: [{ko: '아일랜드 국립미술관, 더블린', en: 'National Gallery of Ireland, Dublin'}],
    sources: ['local download: Acis_and_galatea_-_Poussin_-1629_-_Dublin_National_Gallery_of_Art.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-mars-and-venus-1630',
    file: 'Nicolas_Poussin_-_Mars_and_Venus_-_Google_Art_Project_(559039).jpg',
    out: 'poussin-mars-and-venus-1630.jpg',
    year: 1630,
    popularity: 70,
    title: {ko: '마르스와 비너스', en: 'Mars and Venus'},
    description: {
      ko: '사랑과 전쟁의 신화를 안정된 구도와 고전적 인체로 정리해 색채보다 선과 배치를 중시한 화면입니다.',
      en: 'A mythological image of love and war organized by stable composition and classical bodies, privileging line and placement.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Nicolas_Poussin_-_Mars_and_Venus_-_Google_Art_Project_(559039).jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-massacre-of-the-innocents-1630',
    file: 'Nicolas_Poussin_-_Le_massacre_des_Innocents_-_Google_Art_Project.jpg',
    out: 'poussin-massacre-of-the-innocents-1630.jpg',
    year: 1630,
    popularity: 84,
    title: {ko: '무고한 아이들의 학살', en: 'The Massacre of the Innocents'},
    description: {
      ko: '잔혹한 사건을 좁고 강한 구도로 압축해 비극적 감정을 명료한 동작과 선으로 통제한 작품입니다.',
      en: 'A compressed tragic scene in which violent feeling is controlled by sharply legible action and line.'
    },
    collection: [{ko: '콩데 미술관, 샹티이', en: 'Musee Conde, Chantilly'}],
    sources: ['local download: Nicolas_Poussin_-_Le_massacre_des_Innocents_-_Google_Art_Project.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-bacchanal-1631-1633',
    file: 'Bacchanale_-_Poussin_-_musée_du_Prado.jpg',
    out: 'poussin-bacchanal-1631-1633.jpg',
    year: 1631,
    yearEnd: 1633,
    popularity: 73,
    title: {ko: '바쿠스제', en: 'Bacchanal'},
    description: {
      ko: '술과 축제의 신화를 고전적 리듬과 균형으로 다루어 바로크적 활기를 절제된 질서 안에 넣은 작품입니다.',
      en: 'A mythic festival scene that places Baroque vitality within classical rhythm and balance.'
    },
    collection: [{ko: '프라도 미술관, 마드리드', en: 'Museo del Prado, Madrid'}],
    sources: ['local download: Bacchanale_-_Poussin_-_musée_du_Prado.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-birth-of-venus-1635-1636',
    file: 'Nicolas_Poussin,_French_-_The_Birth_of_Venus_-_Google_Art_Project.jpg',
    out: 'poussin-birth-of-venus-1635-1636.jpg',
    year: 1635,
    yearEnd: 1636,
    popularity: 72,
    title: {ko: '비너스의 탄생', en: 'The Birth of Venus'},
    description: {
      ko: '비너스 신화를 부드러운 움직임과 정돈된 인물군으로 구성해 푸생의 신화적 상상과 고전적 질서를 보여 줍니다.',
      en: 'A Venus myth organized through gentle movement and ordered figure groups, joining imagination to classical control.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Nicolas_Poussin,_French_-_The_Birth_of_Venus_-_Google_Art_Project.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-triumph-of-pan-1636',
    file: 'Nicolas_Poussin_-_The_Triumph_of_Pan,_1636.jpg',
    out: 'poussin-triumph-of-pan-1636.jpg',
    year: 1636,
    popularity: 78,
    title: {ko: '판의 승리', en: 'The Triumph of Pan'},
    description: {
      ko: '고대 축제의 활기를 명확한 구도와 인물 리듬으로 정리해 푸생의 고전주의적 바로크를 보여 줍니다.',
      en: 'An antique festival image whose energy is ordered by clear composition and rhythmic figure placement.'
    },
    collection: [{ko: '내셔널 갤러리, 런던', en: 'National Gallery, London'}],
    sources: ['local download: Nicolas_Poussin_-_The_Triumph_of_Pan,_1636.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-et-in-arcadia-ego-1637-1638',
    file: 'Nicolas_Poussin_-_Et_in_Arcadia_ego_(deuxième_version).jpg',
    out: 'poussin-et-in-arcadia-ego-1637-1638.jpg',
    year: 1637,
    yearEnd: 1638,
    popularity: 100,
    title: {ko: '아르카디아에도 나는 있다', en: 'Et in Arcadia ego'},
    description: {
      ko: '목가적 풍경 속 인물들이 묘비의 문구를 읽는 장면으로, 죽음과 기억을 명료한 제스처와 고전적 질서 속에 배치한 대표작입니다.',
      en: 'A signature work where shepherds read a tomb inscription, placing death and memory within lucid gesture and classical order.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Nicolas_Poussin_-_Et_in_Arcadia_ego_(deuxième_version).jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-sacrament-of-ordination-1636-1640',
    file: 'Nicolas_Poussin_-_The_Sacrament_of_Ordination_(Christ_Presenting_the_Keys_to_Saint_Peter)_-_Google_Art_Project.jpg',
    out: 'poussin-sacrament-of-ordination-1636-1640.jpg',
    year: 1636,
    yearEnd: 1640,
    popularity: 77,
    title: {ko: '성품성사', en: 'The Sacrament of Ordination'},
    description: {
      ko: '그리스도가 베드로에게 열쇠를 주는 장면을 엄격한 종교적 질서와 인물 배열로 구성한 작품입니다.',
      en: 'A sacramental scene in which Christ presenting the keys to Saint Peter is arranged through strict devotional order.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Nicolas_Poussin_-_The_Sacrament_of_Ordination_(Christ_Presenting_the_Keys_to_Saint_Peter)_-_Google_Art_Project.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-rape-of-the-sabine-women-1637-1638',
    file: "L'Enlèvement_des_Sabines_–_Nicolas_Poussin_–_Musée_du_Louvre,_INV_7290_–_Q3110586.jpg",
    out: 'poussin-rape-of-the-sabine-women-1637-1638.jpg',
    year: 1637,
    yearEnd: 1638,
    popularity: 88,
    title: {ko: '사비니 여인들의 납치', en: 'The Rape of the Sabine Women'},
    description: {
      ko: '혼란스러운 사건을 건축적 공간과 계산된 인물 동선으로 정리해 푸생의 역사화가 지닌 논리성과 질서를 보여 줍니다.',
      en: 'A violent historical scene made intelligible through architectural space and carefully calculated figure movement.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ["local download: L'Enlèvement_des_Sabines_–_Nicolas_Poussin_–_Musée_du_Louvre,_INV_7290_–_Q3110586.jpg"],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-time-rescuing-truth-1641',
    file: "Nicolas_Poussin_-_Le_Temps_soustrait_la_Vérité_aux_atteintes_de_l'Envie_et_de_la_Discorde.jpg",
    out: 'poussin-time-rescuing-truth-1641.jpg',
    year: 1641,
    popularity: 71,
    title: {ko: '시간이 진리를 시기와 불화로부터 구하다', en: 'Time Rescuing Truth from Envy and Discord'},
    description: {
      ko: '알레고리 인물들을 명확한 역할과 선적인 구성으로 배열해 도덕적 의미를 논리적으로 읽히게 한 작품입니다.',
      en: 'An allegorical work whose clear roles and linear organization make its moral meaning legible.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ["local download: Nicolas_Poussin_-_Le_Temps_soustrait_la_Vérité_aux_atteintes_de_l'Envie_et_de_la_Discorde.jpg"],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-miracle-of-saint-francis-xavier-1641-1642',
    file: 'Poussin_Miracle_de_saint_François_Xavier_Louvre.jpg',
    out: 'poussin-miracle-of-saint-francis-xavier-1641-1642.jpg',
    year: 1641,
    yearEnd: 1642,
    popularity: 79,
    title: {ko: '성 프란치스코 하비에르의 기적', en: 'The Miracle of Saint Francis Xavier'},
    description: {
      ko: '기적의 순간을 과장된 소란보다 명료한 시선과 제스처로 조직해 종교적 사건을 이성적 화면으로 바꾼 작품입니다.',
      en: 'A miracle scene organized through clear gazes and gestures, turning religious drama into a rational pictorial structure.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Poussin_Miracle_de_saint_François_Xavier_Louvre.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-holy-family-1649',
    file: 'Sainte_Famille_-_Poussin_-_National_Gallery_of_Ireland.jpg',
    out: 'poussin-holy-family-1649.jpg',
    year: 1649,
    popularity: 70,
    title: {ko: '성가족', en: 'The Holy Family'},
    description: {
      ko: '성가족을 안정된 삼각형 구도와 절제된 감정으로 그려 푸생 종교화의 균형 잡힌 고전성을 보여 줍니다.',
      en: 'A Holy Family arranged with stable geometry and restrained feeling, showing Poussin\'s balanced classicism.'
    },
    collection: [{ko: '아일랜드 국립미술관, 더블린', en: 'National Gallery of Ireland, Dublin'}],
    sources: ['local download: Sainte_Famille_-_Poussin_-_National_Gallery_of_Ireland.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-judgment-of-solomon-1649',
    file: 'Le_Jugement_de_Salomon_-_1649_-_Nicolas_Poussin_-_Louvre_-_INV_7277_;_MR_2316.jpg',
    out: 'poussin-judgment-of-solomon-1649.jpg',
    year: 1649,
    popularity: 83,
    title: {ko: '솔로몬의 심판', en: 'The Judgment of Solomon'},
    description: {
      ko: '왕의 판단과 주변 인물의 반응을 좌우 대칭과 명료한 몸짓으로 읽히게 한 성서 역사화입니다.',
      en: 'A biblical history painting where royal judgment and human reaction are made legible through symmetry and gesture.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Le_Jugement_de_Salomon_-_1649_-_Nicolas_Poussin_-_Louvre_-_INV_7277_;_MR_2316.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-landscape-with-a-calm-1650-1651',
    file: 'Nicolas_Poussin_(French_-_Landscape_with_a_Calm_-_Google_Art_Project.jpg',
    out: 'poussin-landscape-with-a-calm-1650-1651.jpg',
    year: 1650,
    yearEnd: 1651,
    popularity: 82,
    title: {ko: '고요한 풍경', en: 'Landscape with a Calm'},
    description: {
      ko: '말년으로 갈수록 중요해진 풍경화의 방향을 보여 주며, 자연을 감정의 배경이 아니라 질서 있는 세계로 구성합니다.',
      en: 'A later landscape in which nature becomes an ordered world rather than a mere emotional backdrop.'
    },
    collection: [{ko: 'J. 폴 게티 미술관, 로스앤젤레스', en: 'J. Paul Getty Museum, Los Angeles'}],
    sources: ['local download: Nicolas_Poussin_(French_-_Landscape_with_a_Calm_-_Google_Art_Project.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-death-of-sapphira-1653',
    file: 'La_mort_de_Saphire_-_circa_1653_-_Nicolas_Poussin_-_Louvre_-_INV_7286_;_MR_2322.jpg',
    out: 'poussin-death-of-sapphira-1653.jpg',
    year: 1653,
    popularity: 75,
    title: {ko: '사피라의 죽음', en: 'The Death of Sapphira'},
    description: {
      ko: '사도행전의 도덕적 사건을 건축적 공간과 엄격한 인물 배치로 정리해 명료한 교훈성을 강조합니다.',
      en: 'A moral scene from Acts, ordered through architecture and strict figure placement to clarify its lesson.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: La_mort_de_Saphire_-_circa_1653_-_Nicolas_Poussin_-_Louvre_-_INV_7286_;_MR_2322.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-discovery-of-achilles-on-skyros-1656',
    file: 'Discovery_of_Achilles_on_Skyros_by_Nicholas_Poussin_ca._1656_pubdom.jpg',
    out: 'poussin-discovery-of-achilles-on-skyros-1656.jpg',
    year: 1656,
    popularity: 76,
    title: {ko: '스키로스섬의 아킬레우스 발견', en: 'The Discovery of Achilles on Skyros'},
    description: {
      ko: '고대 영웅 이야기를 궁정적 의상과 명확한 서사 제스처로 풀어낸 후기 신화화입니다.',
      en: 'A later mythological painting that unfolds an ancient heroic story through courtly dress and readable narrative gesture.'
    },
    collection: [{ko: '개별 소장처 정보 확인 필요', en: 'Collection to verify'}],
    sources: ['local download: Discovery_of_Achilles_on_Skyros_by_Nicholas_Poussin_ca._1656_pubdom.jpg'],
    representative: false,
    movementContribution: true
  },
  {
    id: 'poussin-spring-1660-1664',
    file: 'Nicolas_Poussin_-_Le_Printemps.jpg',
    out: 'poussin-spring-1660-1664.jpg',
    year: 1660,
    yearEnd: 1664,
    popularity: 87,
    title: {ko: '봄', en: 'Spring'},
    description: {
      ko: '사계 연작 중 하나로, 말년의 풍경화에서 성서 주제와 자연의 질서를 결합한 푸생의 후기 세계를 보여 줍니다.',
      en: 'Part of the Four Seasons, this late landscape joins biblical subject matter with the order of nature.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Nicolas_Poussin_-_Le_Printemps.jpg'],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-summer-ruth-and-boaz-1660-1664',
    file: "Nicolas_Poussin_-_L'Été_ou_Ruth_et_Booz.jpg",
    out: 'poussin-summer-ruth-and-boaz-1660-1664.jpg',
    year: 1660,
    yearEnd: 1664,
    popularity: 86,
    title: {ko: '여름 또는 룻과 보아스', en: 'Summer, or Ruth and Boaz'},
    description: {
      ko: '풍경과 노동, 성서 이야기를 하나의 질서 있는 세계로 엮어 푸생 말년 풍경화의 고전적 깊이를 보여 줍니다.',
      en: 'A late landscape that binds labor, biblical narrative, and nature into a deeply ordered classical world.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ["local download: Nicolas_Poussin_-_L'Été_ou_Ruth_et_Booz.jpg"],
    representative: true,
    movementContribution: true
  },
  {
    id: 'poussin-apollo-and-daphne-1664',
    file: 'Nicolas_Poussin_-_Apollo_and_Daphne_-_WGA18345.jpg',
    out: 'poussin-apollo-and-daphne-1664.jpg',
    year: 1664,
    popularity: 74,
    title: {ko: '아폴론과 다프네', en: 'Apollo and Daphne'},
    description: {
      ko: '변신의 신화를 후기의 절제된 풍경과 인물 배열로 풀어낸 작품으로, 서사보다 질서와 사유가 앞선다.',
      en: 'A late mythological landscape where the story of transformation is subordinated to order and reflection.'
    },
    collection: [{ko: '루브르 박물관, 파리', en: 'Musee du Louvre, Paris'}],
    sources: ['local download: Nicolas_Poussin_-_Apollo_and_Daphne_-_WGA18345.jpg'],
    representative: false,
    movementContribution: true
  }
];

function relativeLocalSource(file) {
  return `local file: ${path.join(downloadDir, file)}`;
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
      subtitle: {
        ko: '프랑스 바로크 안의 고전주의적 질서와 명료한 구성을 보여 주는 푸생 작품',
        en: 'A Poussin work showing classical order and lucid composition within French Baroque'
      },
      description: work.description,
      sources: [...sourceUrls, localSource],
      facts: {
        artist: artistName,
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
      createdBy: actor,
      updatedBy: actor
    },
    migration: {
      schema: 1,
      image: {
        status: 'ready',
        localThumbnail: image,
        highResolution: image,
        sourceUrl: sourceUrls.find(value => /^https?:\/\//i.test(value)) || wiki,
        sourceUrls: sourceUrls.filter(value => /^https?:\/\//i.test(value)),
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
  fs.copyFileSync(source, target);
  const entry = workEntry(work);
  works.push(entry);
  thumbnailIndex[work.id] = {
    thumbnail: entry.thumbnail,
    checkedAt: now,
    verifiedBy: `Poussin local file import; ${wiki}`,
    imageHash: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
  };
}
works.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
fs.writeFileSync(path.join(thumbnailDir, 'index.json'), `${JSON.stringify(thumbnailIndex, null, 2)}\n`, 'utf8');

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const previous = data.artists.find(item => item.qid === qid || item.id === artistId);
const artist = {
  id: artistId,
  qid,
  name: artistName,
  fullName: '푸생, 니콜라',
  birth: 1594,
  death: 1665,
  nationality: country,
  birthCountry: {ko: '프랑스 레장들리', en: 'Les Andelys, France'},
  movement,
  aliases: {
    ko: ['푸생', '푸셍', '니콜라 푸생', '니콜라 푸셍'],
    en: ['Poussin', 'Nicolas Poussin', 'Nicholas Poussin']
  },
  artistSummary,
  profileResolved: true,
  links: {
    wikipedia: wiki,
    wikidata
  },
  works,
  featuredWorkIds: [
    'poussin-et-in-arcadia-ego-1637-1638',
    'poussin-death-of-germanicus-1627',
    'poussin-rape-of-the-sabine-women-1637-1638',
    'poussin-judgment-of-solomon-1649',
    'poussin-spring-1660-1664',
    'poussin-summer-ruth-and-boaz-1660-1664'
  ],
  metadata: {
    createdAt: previous?.metadata?.createdAt || now,
    updatedAt: now,
    createdBy: previous?.metadata?.createdBy || actor,
    updatedBy: actor
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
  updatedBy: actor
};

fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported Poussin with ${works.length} local works.`);
