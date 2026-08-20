const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');
const markerStart = '<!-- art-atlas-enhancement:start -->';
const markerEnd = '<!-- art-atlas-enhancement:end -->';

const style = `
<style id="art-atlas-movement-enhancement-style">
.movement-enhancement{padding:58px 0;border-bottom:1px solid var(--line,#2a3037);color:var(--text,#f2efe9)}
.movement-enhancement h2{color:#f1d18b}
.movement-enhancement h3{color:#f2efe9}
.movement-enhancement p{color:#cfd6dd}
.movement-enhancement .enhancement-intro{font-size:1.07rem;color:#d6dce2;max-width:1080px}
.movement-enhancement .enhancement-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:22px 0}
.movement-enhancement .enhancement-panel{border:1px solid var(--line,#2a3037);border-radius:14px;background:rgba(18,22,27,.9);padding:22px;color:#cfd6dd}
.movement-enhancement .enhancement-panel h3{margin:.05rem 0 .7rem;font-size:1.18rem}
.movement-enhancement .enhancement-panel ul{margin:0;padding-left:1.18rem}
.movement-enhancement .enhancement-panel li{margin:.48rem 0;line-height:1.72;color:#cfd6dd}
.movement-enhancement .movement-work-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:22px}
.movement-enhancement .movement-work-card{border:1px solid var(--line,#2a3037);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--panel2,#181d23),var(--panel,#12161b));box-shadow:0 12px 28px rgba(0,0,0,.22)}
.movement-enhancement .movement-work-image{background:#07090b;display:flex;align-items:center;justify-content:center;min-height:260px}
.movement-enhancement .movement-work-image img{display:block;width:100%;height:320px;object-fit:contain}
.movement-enhancement .movement-work-body{padding:16px 18px 18px}
.movement-enhancement .movement-work-body h3{font-size:1.05rem;margin:.35rem 0 .2rem}
.movement-enhancement .movement-work-body small{display:block;color:var(--muted,#aab3bc);margin-bottom:.7rem}
.movement-enhancement .movement-work-body p{margin:.5rem 0 0;color:#cfd6dd;line-height:1.64}
.movement-enhancement .mini-label{display:inline-block;border:1px solid rgba(216,170,75,.38);background:rgba(216,170,75,.09);color:#f0cf87;border-radius:999px;padding:3px 8px;font-size:.74rem;font-weight:800}
.movement-enhancement .source-note{font-size:.82rem;color:#aab3bc;margin-top:.45rem}
@media(max-width:980px){.movement-enhancement .enhancement-grid,.movement-enhancement .movement-work-grid{grid-template-columns:1fr}.movement-enhancement .movement-work-image img{height:auto;max-height:430px}}
</style>`;

function card({artist, title, meta, src, alt, body, credit = ''}) {
  return `<article class="movement-work-card">
  <div class="movement-work-image"><img src="${src}" alt="${alt}"></div>
  <div class="movement-work-body">
    <span class="mini-label">${artist}</span>
    <h3>${title}</h3>
    <small>${meta}</small>
    <p>${body}</p>${credit ? `<p class="source-note">${credit}</p>` : ''}
  </div>
</article>`;
}

const data = {
  'e9d8a876f1b83c5c174c2bbc-1.html': `
${style}
<section class="movement-enhancement" id="movement-deepening">
  <div class="wrap">
    <h2>심화 보강 — 다다의 도시별 실험과 반예술 전략</h2>
    <p class="enhancement-intro">다다는 “이런 양식으로 그려라”라는 규칙을 만든 사조가 아니라, 전쟁과 합리주의, 국가주의, 미술 제도 전체가 정말 믿을 만한가를 공격한 운동이다. 그래서 다다를 이해할 때는 하나의 화풍보다 도시별 집단, 공연과 출판, 콜라주와 레디메이드, 정치 풍자와 우연의 방법을 함께 봐야 한다.</p>

    <div class="enhancement-grid">
      <div class="enhancement-panel">
        <h3>따로 HTML로 나누지 않은 내부 화파</h3>
        <ul><li>취리히 다다는 중립국 스위스의 망명 공간에서 시작되었다. 카바레 볼테르는 미술관보다 무대에 가까웠고, 후고 발, 에미 헤닝스, 트리스탄 차라, 한스 아르프는 낭송, 소리시, 가면, 즉흥 음악, 우연한 언어를 통해 전쟁을 가능하게 한 “정상적 언어” 자체를 의심했다.</li><li>뉴욕 다다는 마르셀 뒤샹, 프란시스 피카비아, 만 레이를 중심으로 예술작품의 조건을 물었다. 손으로 잘 만든 물건보다 선택, 명명, 전시 맥락이 중요해지며 레디메이드와 기계 이미지가 미술의 정의를 흔들었다.</li><li>베를린 다다는 패전과 혁명, 바이마르 공화국의 불안 속에서 가장 정치적이었다. 한나 회흐, 라울 하우스만, 존 하트필드, 게오르게 그로스는 신문 사진과 광고 이미지를 잘라 붙여 군국주의, 언론 조작, 젠더 규범, 부르주아 권력을 공격했다.</li><li>하노버의 메르츠는 슈비터스 개인의 독자적 분파에 가깝다. 그는 버스표, 포장지, 낡은 인쇄물처럼 버려진 현실의 조각을 회화와 공간 구성으로 바꾸며 다다의 파괴성을 일상 재료의 새로운 질서로 전환했다.</li><li>파리 다다는 차라의 선언과 문학 네트워크를 통해 확산되었지만, 브르통과의 갈등 속에서 오래 지속되기보다 초현실주의로 재편되었다. 따라서 파리에서는 다다가 “끝난 사조”라기보다 무의식과 자동기술로 넘어가는 과도기였다.</li></ul>
      </div>
      <div class="enhancement-panel">
        <h3>국가별 발전 방식</h3>
        <ul><li>스위스에서는 전쟁 중립지라는 조건이 중요했다. 여러 국적의 망명 예술가가 모였고, 특정 국가 양식보다 언어와 국경을 무너뜨리는 국제적 반응이 먼저 형성되었다.</li><li>미국에서는 상업 도시 뉴욕의 기계 문명, 사진, 잡지 문화가 다다의 재료가 되었다. 피카비아의 기계 그림은 인간 감정과 성적 관계마저 부품처럼 번역했고, 뒤샹은 미술관 제도의 승인 체계를 작품의 일부로 만들었다.</li><li>독일에서는 다다가 사회 비판의 그래픽 언어가 되었다. 인쇄 매체가 강한 베를린에서 포토몽타주는 단순한 형식 실험이 아니라 신문이 생산하는 현실을 다시 찢어 붙이는 정치적 기술이었다.</li><li>프랑스에서는 문학과 선언이 중요했다. 차라와 브르통 주변의 갈등은 다다의 전면 부정이 계속될 수 있는지, 아니면 꿈과 무의식이라는 새 창작 원리로 이동해야 하는지를 둘러싼 논쟁이었다.</li><li>이탈리아와 러시아 전위와도 느슨하게 연결된다. 미래주의의 소음과 공연, 러시아 구성주의의 인쇄 실험은 다다와 직접 같은 운동은 아니지만, 전통 예술의 경계를 해체한다는 점에서 20세기 전위의 공통 지대를 만든다.</li></ul>
      </div>
      <div class="enhancement-panel">
        <h3>기법과 매체가 뜻을 만드는 방식</h3>
        <ul><li>레디메이드는 “만드는 기술”을 “선택하는 행위”로 바꾸었다. 뒤샹의 충격은 소변기라는 물건 자체보다, 작가의 서명과 전시 신청만으로 예술의 조건이 성립하는가를 묻는 데 있다.</li><li>포토몽타주는 사진의 사실성을 믿지 않는다. 오히려 사진 조각을 충돌시켜 대중매체가 현실을 어떻게 조립하고 선전하는지 폭로한다.</li><li>소리시는 의미 있는 문장이 아니라 음절, 리듬, 몸의 발성으로 언어를 되돌린다. 이는 전쟁 선전과 합리적 논리가 망가뜨린 언어에 대한 반응이었다.</li><li>우연은 무책임한 장난이 아니다. 아르프의 우연 콜라주처럼 작가의 통제를 줄이고, 질서가 항상 의도에서만 나온다는 믿음을 깨는 방법이다.</li><li>출판물, 잡지, 전단, 선언은 작품만큼 중요했다. 다다는 미술관의 벽보다 인쇄와 낭독, 소문과 논쟁을 통해 퍼진 운동이었다.</li></ul>
      </div>
      <div class="enhancement-panel">
        <h3>이름이 나온 작가를 작품과 연결해 읽기</h3>
        <ul><li>피카비아는 기계 도상을 통해 인간과 욕망을 차갑고 우스꽝스러운 부품 관계로 바꾸었다. 이는 뉴욕 다다의 냉소와 도시적 감각을 잘 보여준다.</li><li>조피 토이버아르프는 다다가 파괴와 풍자만이 아니라 추상, 무용, 공예, 디자인, 인형극과도 연결될 수 있음을 보여준다. 그의 다다 머리는 놀이처럼 보이지만 얼굴과 인체의 전통적 위계를 해체한다.</li><li>후고 발의 소리시는 의미를 전달하기보다 의미가 붕괴되는 순간을 무대화한다. 전쟁의 언어가 너무 그럴듯했기 때문에, 다다는 때로 이해 불가능한 말로 저항했다.</li><li>만 레이의 오브제와 사진은 뉴욕 다다와 파리 초현실주의를 잇는다. 다만 이번 카드에는 안정적으로 확보된 공개 로컬 이미지를 우선 사용했고, 본문 설명에서 그의 역할을 보강했다.</li><li>하트필드, 하우스만, 그로스의 정치적 이미지는 저작권과 공개 도판 조건 때문에 카드화하지 않았지만, 베를린 다다 설명 안에서 각각의 기능을 충분히 읽을 수 있게 했다.</li></ul>
      </div>
    </div>

    <h3>반복 없이 보는 추가 대표작</h3>
    <p class="enhancement-intro">아래 카드는 문서 위쪽에서 이미 크게 보여준 《샘》, 한나 회흐, 슈비터스, 카바레 볼테르 이미지를 반복하지 않고, 표와 본문에 등장하지만 시각적으로 덜 설명된 작가와 매체를 보강한다.</p>
    <div class="movement-work-grid">
      ${card({artist:'프란시스 피카비아', title:'피카비아, 《Machine Turn Quickly》', meta:'1916/1918, 뉴욕 다다의 기계 이미지', src:'images/Picabia-Machine-Turn-Quickly.jpg', alt:'프란시스 피카비아, Machine Turn Quickly', body:'기어와 숫자, 성별 표기가 결합해 인간관계와 욕망을 기계 장치처럼 바꾼다. 피카비아는 회화의 감정적 표현보다 다이어그램, 광고, 공업 이미지의 차가운 언어로 다다의 조롱을 만들었다.'})}
      ${card({artist:'조피 토이버아르프', title:'토이버아르프, 《Dada Head》', meta:'1920, 목조 오브제', src:'images/Taeuber-Arp-Dada-Head.jpg', alt:'조피 토이버아르프, Dada Head', body:'머리는 초상도 장식품도 아닌 기하학적 오브제로 제시된다. 다다가 단순한 파괴 운동만이 아니라 무용, 공예, 디자인, 추상 조형으로 확장될 수 있었음을 보여준다.', credit:'이미지: Sailko, CC BY 3.0, Wikimedia Commons'})}
      ${card({artist:'후고 발', title:'후고 발, 《Karawane》', meta:'1917 발표, 1920년 다다 연감 수록', src:'images/Hugo-Ball-Karawane.png', alt:'후고 발, Karawane', body:'의미 있는 문장 대신 낯선 음절과 활자 배열이 전면에 나온다. 다다의 소리시는 언어를 정보 전달 수단에서 떼어내 몸, 리듬, 부조리의 재료로 되돌렸다.'})}
    </div>
  </div>
</section>`,
  'b6f307845ec9a6f73e9d4e44-1.html': `
${style}
<section class="movement-enhancement" id="movement-deepening">
  <div class="wrap">
    <h2>심화 보강 — 초현실주의의 내부 계열과 국제적 변형</h2>
    <p class="enhancement-intro">초현실주의는 이상한 사물을 그리는 취향이 아니라, 꿈과 현실, 의식과 무의식, 말과 이미지의 관계를 새로 조직하려는 운동이다. 다다의 부정에서 출발했지만 파괴에 머물지 않고, 자동기술·꿈 이미지·우연한 기법·오브제·사진·망명 네트워크를 통해 20세기 후반 미술까지 이어지는 생산적 방법을 만들었다.</p>

    <div class="enhancement-grid">
      <div class="enhancement-panel">
        <h3>따로 HTML로 나누지 않은 내부 화파</h3>
        <ul><li>자동기술 계열은 앙드레 브르통의 이론, 앙드레 마송의 선, 호안 미로의 생물형태적 기호에서 출발한다. 여기서 중요한 것은 완성된 꿈 장면보다 의식이 통제하기 전의 손 움직임, 말의 연상, 우연한 형태가 이미지로 굳어지는 과정이다.</li><li>환영적 사실주의 계열은 달리, 마그리트, 탕기처럼 매우 정밀한 묘사로 불가능한 상황을 실제처럼 보이게 한다. 이 방향은 초현실주의가 추상적 충동만이 아니라 고전적 기법과도 결합할 수 있음을 보여준다.</li><li>오브제와 사진 계열은 만 레이, 메레 오펜하임, 브라사이 등을 통해 발전했다. 익숙한 사물은 기능을 잃고 욕망, 농담, 불안, 페티시의 대상으로 바뀌며, 사진은 현실의 기록이 아니라 현실을 낯설게 만드는 장치가 된다.</li><li>콜라주와 프로타주 계열은 막스 에른스트가 대표한다. 서로 맞지 않는 판화 조각이나 우연한 표면 질감은 작가가 의식적으로 발명한 이미지보다 더 낯선 세계를 끌어내는 장치가 되었다.</li><li>망명 이후의 뉴욕 계열은 탕기, 마타, 고키, 마더웰 등으로 이어진다. 유럽 초현실주의자들이 전쟁을 피해 미국으로 이동하면서 자동성과 무의식의 방법은 추상표현주의의 제스처와 색면으로 변형되었다.</li></ul>
      </div>
      <div class="enhancement-panel">
        <h3>국가별 발전 방식</h3>
        <ul><li>프랑스 파리는 선언과 잡지, 전시, 문학 모임의 중심지였다. 브르통은 초현실주의를 단순한 스타일이 아니라 정신의 해방과 삶의 변화라는 프로그램으로 제시했고, 이론적 권위를 통해 운동을 조직했다.</li><li>스페인과 카탈루냐에서는 달리와 미로가 서로 반대에 가까운 길을 만들었다. 달리는 환각적 정밀 묘사로 욕망과 불안을 극장처럼 구성했고, 미로는 기호와 선, 원색의 리듬으로 무의식의 흐름을 더 추상적으로 풀었다.</li><li>벨기에는 마그리트와 델보를 통해 차갑고 논리적인 초현실주의를 만들었다. 이들은 격렬한 붓질보다 일상 사물과 언어, 실내와 거리, 반복되는 인물 배치를 통해 현실의 규칙이 얼마나 쉽게 무너지는지 보여준다.</li><li>독일과 프랑스를 오간 에른스트는 다다의 콜라주를 초현실주의의 이미지 발명법으로 바꾸었다. 전쟁, 폐허, 숲, 괴물, 새 인간의 이미지는 독일 낭만주의와 근대적 불안을 동시에 끌어온다.</li><li>멕시코와 라틴아메리카에서는 유럽 망명자와 현지 신화, 식민 경험, 여성 정체성, 민속적 상징이 만났다. 프리다 칼로를 초현실주의자로 부르는 것은 논쟁적이지만, 자전적 신체와 상징의 결합은 초현실주의가 유럽 밖에서 어떻게 다시 읽혔는지 보여준다.</li></ul>
      </div>
      <div class="enhancement-panel">
        <h3>화가별 대표작을 읽는 기준</h3>
        <ul><li>브르통은 화가라기보다 이론가이지만, 《초현실주의 선언》은 작품만큼 중요하다. 선언은 초현실주의가 기법 목록이 아니라 사고의 해방을 목표로 한 운동임을 분명히 했다.</li><li>탕기의 텅 빈 풍경은 달리처럼 물체를 정밀하게 그리지만, 사물들이 어떤 세계에 속하는지 끝내 설명하지 않는다. 이는 꿈의 장면보다 더 근본적인 “낯선 공간”을 만든다.</li><li>고키는 엄밀히 말해 초현실주의자라기보다 초현실주의와 추상표현주의 사이의 연결점이다. 유기적 형태와 자동적 선은 뉴욕 회화가 재현에서 제스처와 추상으로 이동하는 다리 역할을 한다.</li><li>프리다 칼로는 브르통이 초현실주의와 연결해 보았지만, 본인은 자신의 그림을 꿈이 아니라 삶의 현실로 보았다. 따라서 칼로는 “초현실주의의 일부”라기보다, 초현실주의가 비유럽 문화와 자전적 상징을 만나며 흔들린 사례로 읽는 것이 정확하다.</li><li>마타, 레오노라 캐링턴, 레메디오스 바로 같은 작가들은 저작권과 공개 도판 조건 때문에 모두 카드화하기 어렵지만, 라틴아메리카와 망명 초현실주의를 설명할 때 빠뜨리면 안 되는 이름이다.</li></ul>
      </div>
      <div class="enhancement-panel">
        <h3>다음 사조로 이어지는 방식</h3>
        <ul><li>초현실주의의 자동기술은 추상표현주의의 드리핑, 제스처, 즉흥적 화면 구성에 큰 영향을 주었다. 폴록의 몸짓은 초현실주의의 무의식적 선이 거대한 캔버스 위로 확장된 사례로 볼 수 있다.</li><li>마그리트의 언어와 이미지에 대한 의심은 개념미술로 이어진다. “이미지는 사물이 아니다”라는 문제는 뒤에 텍스트, 표지판, 광고, 사진을 다루는 미술의 중요한 출발점이 된다.</li><li>오브제 실험은 네오 다다와 팝아트, 설치미술의 선례가 되었다. 일상 사물이 기능을 잃고 미술적 맥락에서 새 의미를 얻는 방식은 뒤샹 이후 초현실주의를 거쳐 계속 살아남는다.</li><li>전쟁기 망명은 중심지를 파리에서 뉴욕으로 이동시켰다. 이 과정에서 초현실주의는 유럽 운동으로 끝나지 않고 미국 현대미술의 형성 조건이 되었다.</li><li>여성 초현실주의자들의 재평가는 이 사조를 남성 중심의 꿈과 욕망 서사에서 꺼내 신체, 정체성, 신화, 자전적 이미지의 문제로 다시 읽게 한다.</li></ul>
      </div>
    </div>

    <h3>반복 없이 보는 추가 대표작</h3>
    <p class="enhancement-intro">아래 카드는 이미 본문 위쪽에서 보여준 데 키리코, 미로, 달리, 마그리트, 에른스트 이미지를 반복하지 않고, 문서에서 언급되지만 이미지로 충분히 설명되지 않은 이론·망명·비유럽 수용의 축을 보강한다.</p>
    <div class="movement-work-grid">
      ${card({artist:'앙드레 브르통', title:'브르통, 《초현실주의 선언》 표지', meta:'1924, 초현실주의 이론의 출발점', src:'images/Breton-Surrealist-Manifesto.png', alt:'앙드레 브르통, 초현실주의 선언 표지', body:'브르통은 화가가 아니지만 이 선언은 초현실주의의 방법과 목표를 규정한 핵심 자료다. 꿈과 자동기술, 이성의 통제를 벗어난 사고가 회화와 문학을 묶는 공통 원리가 되었다.'})}
      ${card({artist:'이브 탕기', title:'탕기, 《Indefinite Divisibility》', meta:'1942, 망명기 초현실주의', src:'images/Tanguy-Indefinite-Divisibility.jpg', alt:'이브 탕기, Indefinite Divisibility', body:'불명확한 생물체 같은 형태가 사막도 바다도 아닌 공간에 떠 있다. 탕기는 달리식 정밀 묘사를 쓰면서도 서사보다 낯선 공간감과 무의식적 사물의 고독을 강조했다.'})}
      ${card({artist:'아쉴 고키', title:'고키, 《The Liver is the Cock’s Comb》', meta:'1944, 초현실주의와 추상표현주의의 연결', src:'images/Gorky-Liver-Cocks-Comb.jpg', alt:'아쉴 고키, The Liver is the Cock’s Comb', body:'유기적 형태, 자동적인 선, 강한 색면이 구체적 사물과 추상 사이에서 흔들린다. 고키는 유럽 초현실주의의 자동성과 뉴욕 추상표현주의의 제스처를 이어 주는 핵심 연결점이다.'})}
      ${card({artist:'프리다 칼로', title:'칼로, 《두 명의 프리다》', meta:'1939, 멕시코의 자전적 상징', src:'../thumbnails/frida-kahlo/wikidata-Q3232010.jpg', alt:'프리다 칼로, 두 명의 프리다', body:'두 자아, 노출된 심장, 혈관은 꿈의 장면처럼 보이지만 칼로에게는 개인사와 신체의 현실이었다. 이 작품은 초현실주의라는 분류가 유럽 밖에서 어떻게 논쟁적으로 확장되는지 보여준다.'})}
    </div>
  </div>
</section>`
};

function replaceEnhancement(html, replacement) {
  const start = html.indexOf(markerStart);
  const end = html.indexOf(markerEnd);
  if (start === -1 || end === -1 || end < start) {
    return `${html.trimEnd()}\n\n${markerStart}${replacement}\n${markerEnd}\n`;
  }
  return `${html.slice(0, start + markerStart.length)}${replacement}\n${html.slice(end)}`;
}

let changed = 0;
for (const [fileName, replacement] of Object.entries(data)) {
  const filePath = path.join(movementDir, fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  const next = replaceEnhancement(html, replacement);
  if (next !== html) {
    fs.writeFileSync(filePath, next);
    changed += 1;
    console.log(`updated ${fileName}`);
  }
}

console.log(`Updated ${changed} movement document(s).`);
