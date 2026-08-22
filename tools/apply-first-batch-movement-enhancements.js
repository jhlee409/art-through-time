const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');

const style = `<style>
.movement-enhancement{margin:38px auto 0;padding:26px;border:1px solid var(--line,#2a3037);background:linear-gradient(180deg,var(--panel2,#181d23),var(--panel,#12161b));border-radius:18px;box-shadow:0 18px 45px rgba(0,0,0,.24);color:var(--text,#f2efe9)}
.movement-enhancement h2{margin:0 0 14px;font-size:clamp(1.55rem,2.2vw,2.15rem);color:#f1d18b}
.movement-enhancement h3{margin:0 0 10px;font-size:1.05rem;color:#f2efe9}
.movement-enhancement p{line-height:1.82;color:#cfd6dd}
.movement-enhancement ul{margin:0;padding-left:1.15rem}
.movement-enhancement li{margin:.45rem 0;line-height:1.72;color:#cfd6dd}
.movement-enhancement .enhancement-intro{margin:0 0 20px;color:#d6dce2}
.movement-enhancement .enhancement-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:20px 0 26px}
.movement-enhancement .enhancement-panel{padding:18px;border:1px solid var(--line,#2a3037);border-radius:12px;background:rgba(10,12,15,.48);color:#cfd6dd}
.movement-enhancement .movement-work-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:16px}
.movement-enhancement .movement-work-card{overflow:hidden;border:1px solid var(--line,#2a3037);border-radius:12px;background:linear-gradient(180deg,var(--panel2,#181d23),var(--panel,#12161b));box-shadow:0 12px 28px rgba(0,0,0,.22)}
.movement-enhancement .movement-work-image{background:#090b0d;display:flex;align-items:center;justify-content:center;min-height:260px}
.movement-enhancement .movement-work-image img{display:block;width:100%;height:320px;object-fit:contain}
.movement-enhancement .movement-work-body{padding:16px;color:#cfd6dd}
.movement-enhancement .mini-label{display:inline-flex;margin-bottom:8px;padding:4px 8px;border-radius:999px;background:rgba(216,170,75,.14);border:1px solid #544323;color:#f0ce83;font-size:.82rem;font-weight:700}
.movement-enhancement .work-meta{margin:.2rem 0 .8rem;color:#9aa5af;font-size:.93rem}
@media(max-width:900px){.movement-enhancement{padding:18px}.movement-enhancement .enhancement-grid,.movement-enhancement .movement-work-grid{grid-template-columns:1fr}.movement-enhancement .movement-work-image img{height:auto;max-height:420px}}
</style>`;

const a = {
  michelangelo: `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q5592" target="_blank" rel="noopener" data-artist-id="artist-Q5592" data-uh-original="Michelangelo Buonarroti" data-uh-korean="미켈란젤로 부오나로티" data-uh-display-korean="미켈란젤로" title="미켈란젤로 부오나로티 연표로 이동">미켈란젤로</a>`,
  elgreco: `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q301" target="_blank" rel="noopener" data-artist-id="artist-Q301" data-uh-original="El Greco" data-uh-korean="엘 그레코" data-uh-display-korean="엘 그레코" title="엘 그레코 연표로 이동">엘 그레코</a>`,
  titian: `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q47551" target="_blank" rel="noopener" data-artist-id="artist-Q47551" data-uh-original="Titian" data-uh-korean="티치아노" data-uh-display-korean="티치아노" title="티치아노 연표로 이동">티치아노</a>`,
  rubens: `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-url-1786879941678" target="_blank" rel="noopener" data-artist-id="artist-url-1786879941678" data-uh-original="Peter Paul Rubens" data-uh-korean="페테르 파울 루벤스" data-uh-display-korean="루벤스" title="페테르 파울 루벤스 연표로 이동">루벤스</a>`,
  rembrandt: `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-rembrandt" target="_blank" rel="noopener" data-artist-id="artist-rembrandt" data-uh-original="Rembrandt Harmenszoon van Rijn" data-uh-korean="렘브란트 하르먼손 반 레인" data-uh-display-korean="렘브란트" title="렘브란트 하르먼손 반 레인 연표로 이동">렘브란트</a>`,
  vermeer: `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q41264" target="_blank" rel="noopener" data-artist-id="artist-Q41264" data-uh-original="Johannes Vermeer" data-uh-korean="요하네스 페르메이르" data-uh-display-korean="베르메르" title="요하네스 페르메이르 연표로 이동">베르메르</a>`,
  vigee: `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q213163" target="_blank" rel="noopener" data-artist-id="artist-Q213163" data-uh-original="Élisabeth Louise Vigée Le Brun" data-uh-korean="엘리자베스 루이 비제 르 브룅" data-uh-display-korean="비제 르 브룅" title="엘리자베스 루이 비제 르 브룅 연표로 이동">비제 르 브룅</a>`
};

const blocks = {
  '790ffc9c0cd5d4e4a28fb6a6-1.html': `<!-- art-atlas-enhancement:start -->
${style}
<section class="movement-enhancement">
  <h2>심화 보강 - 지역 화파와 대표작으로 보는 매너리즘</h2>
  <p class="enhancement-intro">매너리즘은 르네상스가 실패해서 생긴 양식이 아니라, 르네상스의 완성도가 너무 높아진 뒤 예술가들이 일부러 균형을 비틀며 새 표현의 출구를 찾은 흐름이다. 안정된 삼각 구도, 명확한 원근법, 자연스러운 인체 비례를 그대로 반복하기보다, 늘어진 몸, 불안정한 공간, 차갑고 산성적인 색, 어렵고 지적인 알레고리를 통해 "완벽함 다음의 긴장"을 보여준다.</p>
  <div class="enhancement-grid">
    <div class="enhancement-panel">
      <h3>따로 HTML로 나누지 않은 내부 화파</h3>
      <ul>
        <li>피렌체-로마 매너리즘은 로마 약탈 이후의 정치적 불안, 메디치 궁정의 세련된 취향, 라파엘로와 ${a.michelangelo} 이후의 부담이 합쳐진 양식이다. 폰토르모와 로소 피오렌티노는 안정된 제단화 구도를 일부러 흔들고, 인물의 무게 중심을 모호하게 하며, 감정이 폭발하기 직전의 정지 상태를 만들었다.</li>
        <li>파르마와 에밀리아 계열은 파르미자니노, 코레조 주변에서 더 우아하고 감각적인 방향으로 전개되었다. 길어진 목과 손, 미끄러지는 듯한 곡선, 천상 공간과 현실 공간이 이어지는 착시는 종교화를 엄숙한 서사보다 세련된 시각적 수수께끼로 만든다.</li>
        <li>베네치아의 후기 르네상스와 매너리즘은 별도 사조라기보다 르네상스 문서의 베네치아 화파가 뒤로 갈수록 극적으로 변형된 흐름이다. ${a.titian}의 늦은 붓질, 틴토레토의 사선 구도, 베로네세의 화려한 색과 무대식 공간은 피렌체식 선묘보다 색채, 빛, 대형 장면의 움직임을 앞세웠다.</li>
        <li>퐁텐블로파는 이탈리아 매너리즘이 프랑스 궁정 장식으로 옮겨간 사례다. 로소 피오렌티노와 프리마티초가 프랑수아 1세 궁정에서 만든 벽화와 치장 회화는 신화, 누드, 장식 문양, 길어진 신체를 결합해 프랑스 궁정미의 기초가 되었다.</li>
        <li>스페인 매너리즘은 ${a.elgreco}에게서 가장 강하게 보인다. 그는 이탈리아식 인체 변형과 베네치아 색채를 톨레도의 신비주의적 종교 감정과 결합해, 현실 공간보다 영적 상승감이 먼저 느껴지는 회화를 만들었다.</li>
      </ul>
    </div>
    <div class="enhancement-panel">
      <h3>국가별 발전 방식</h3>
      <ul>
        <li>이탈리아에서는 피렌체, 로마, 파르마, 베네치아가 서로 다른 방식으로 르네상스의 유산을 재해석했다. 피렌체와 로마가 선, 포즈, 인체의 인위성을 강화했다면 베네치아는 색채와 빛의 흔들림, 대형 화면의 연극성을 키웠다.</li>
        <li>프랑스에서는 매너리즘이 독립 회화 운동보다 왕실 궁전 장식 양식으로 수용되었다. 퐁텐블로의 회랑 장식은 회화, 조각, 스투코, 장식 문양을 한 화면처럼 묶어 궁정 권위와 감각적 우아함을 동시에 보여주었다.</li>
        <li>스페인에서는 종교개혁 이후 가톨릭 신앙의 긴장과 결합했다. ${a.elgreco}의 길어진 인물은 단순한 해부학적 왜곡이 아니라 지상에서 하늘로 끌려 올라가는 듯한 영성의 형태가 되었다.</li>
        <li>북유럽에서는 매너리즘이 판화와 궁정 네트워크를 통해 퍼졌다. 하를럼과 프라하 궁정의 화가들은 복잡한 자세, 세련된 누드, 지적 알레고리를 선호했고, 이는 후대 바로크의 극적 몸짓으로 이어졌다.</li>
      </ul>
    </div>
  </div>
  <h3>표에는 나오지만 문서 상단에 도판이 없던 대표작</h3>
  <p class="enhancement-intro">아래 카드는 앞부분에서 이미 크게 보여준 폰토르모, 파르미자니노, 브론치노, 카라바조를 반복하지 않고, 매너리즘의 확장과 변형을 이해하는 데 필요한 작품만 골랐다.</p>
  <div class="movement-work-grid">
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="../thumbnails/artist-Q5592/michelangelo-last-judgment.jpg" alt="미켈란젤로, 최후의 심판"></div>
      <div class="movement-work-body"><span class="mini-label">${a.michelangelo}</span><h3>${a.michelangelo}, 《최후의 심판》</h3><p class="work-meta">1536-1541, 시스티나 성당</p><p>르네상스의 안정된 인체가 거대한 소용돌이 속으로 빨려 들어간다. 영웅적인 몸은 남아 있지만 화면 전체가 균형보다 심판의 압력과 불안을 향해 움직여, 매너리즘이 어디에서 출발했는지 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Rosso-Fiorentino-Deposition-WGA20130.jpg" alt="로소 피오렌티노, 십자가에서 내려짐"></div>
      <div class="movement-work-body"><span class="mini-label">로소 피오렌티노</span><h3>로소 피오렌티노, 《십자가에서 내려짐》</h3><p class="work-meta">1528, 산 로렌초, 산세폴크로</p><p>사다리, 인물, 천이 서로 어긋나며 화면을 날카롭게 절단한다. 비극을 자연스러운 공간에 놓지 않고 불안정한 장식 구조로 압축해 피렌체-로마 매너리즘의 긴장을 드러낸다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Tintoretto-Last-Supper-WGA22649.jpg" alt="틴토레토, 최후의 만찬"></div>
      <div class="movement-work-body"><span class="mini-label">틴토레토</span><h3>틴토레토, 《최후의 만찬》</h3><p class="work-meta">1592-1594, 산 조르조 마조레, 베네치아</p><p>식탁을 정면에 놓는 전통을 버리고 사선으로 깊숙이 밀어 넣는다. 연기, 빛, 천사의 움직임이 현실 공간을 흔들어 베네치아 매너리즘이 바로크적 역동성으로 넘어가는 지점을 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="../thumbnails/artist-Q301/wikidata-Q883994.jpg" alt="엘 그레코, 오르가스 백작의 매장"></div>
      <div class="movement-work-body"><span class="mini-label">${a.elgreco}</span><h3>${a.elgreco}, 《오르가스 백작의 매장》</h3><p class="work-meta">1586-1588, 산토 토메 성당, 톨레도</p><p>아래의 장례 장면과 위의 천상 장면이 서로 다른 현실처럼 맞물린다. 길어진 인체와 차가운 빛은 스페인 매너리즘이 종교적 환시로 변한 모습을 선명하게 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Primaticcio-Ulysses-and-Penelope-WGA18409.jpg" alt="프리마티초, 율리시스와 페넬로페"></div>
      <div class="movement-work-body"><span class="mini-label">프란체스코 프리마티초</span><h3>프리마티초, 《율리시스와 페넬로페》</h3><p class="work-meta">1560년경, 톨레도 미술관</p><p>신화 장면을 궁정 장식처럼 길고 유연한 몸, 매끈한 표면, 계산된 자세로 구성했다. 퐁텐블로파가 이탈리아 매너리즘을 프랑스 궁정의 세련된 장식 언어로 바꾼 방식을 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Spranger-Venus-and-Adonis.jpg" alt="바르톨로메우스 슈프랑거, 비너스와 아도니스"></div>
      <div class="movement-work-body"><span class="mini-label">바르톨로메우스 슈프랑거</span><h3>슈프랑거, 《비너스와 아도니스》</h3><p class="work-meta">1587년경, 암스테르담 국립미술관</p><p>프라하 궁정 매너리즘은 복잡한 누드 포즈와 지적인 신화 알레고리를 즐겼다. 서로 꼬이는 몸과 차가운 관능성은 자연스러운 서사보다 궁정 취향의 세련된 난해함을 앞세운다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Arcimboldo-Rudolf-II-as-Vertumnus.jpg" alt="주세페 아르침볼도, 베르툼누스로 분장한 루돌프 2세"></div>
      <div class="movement-work-body"><span class="mini-label">주세페 아르침볼도</span><h3>아르침볼도, 《베르툼누스로 분장한 루돌프 2세》</h3><p class="work-meta">1590년경, 스코클로스테르 성</p><p>과일과 꽃으로 황제의 얼굴을 구성한 초상은 매너리즘의 지적 유희와 궁정 알레고리를 극단적으로 보여준다. 닮음, 자연, 권력의 상징이 하나의 시각적 수수께끼로 겹친다.</p></div>
    </article>
  </div>
</section>
<!-- art-atlas-enhancement:end -->`,

  '37a05b9246dcdbd89a685d55-1.html': `<!-- art-atlas-enhancement:start -->
${style}
<section class="movement-enhancement">
  <h2>심화 보강 - 지역 화파와 대표작으로 보는 바로크</h2>
  <p class="enhancement-intro">바로크는 단순히 장식이 많은 양식이 아니다. 종교개혁 이후 가톨릭 교회가 감각적으로 강한 이미지를 필요로 했고, 절대왕정과 도시 시민 사회가 각자 다른 시각 언어를 요구하면서 빛, 몸짓, 공간, 관람자의 위치가 모두 극적으로 바뀐 사조다.</p>
  <div class="enhancement-grid">
    <div class="enhancement-panel">
      <h3>따로 HTML로 나누지 않은 내부 화파</h3>
      <ul>
        <li>카라바조주의는 강한 명암 대비, 거리의 실제 인물 같은 모델, 화면 밖에서 들어오는 빛을 통해 성스러운 사건을 관람자의 현재로 끌어온다. 리베라, 조르주 드 라 투르, 위트레흐트 화가들은 이 빛의 연출을 각 지역의 종교화와 풍속화에 맞게 바꾸었다.</li>
        <li>볼로냐 고전주의는 카라치 가문을 중심으로 자연 관찰과 르네상스의 조화, 고대적 질서를 결합했다. 격렬한 명암보다 탄탄한 구성과 이상화된 신체를 중시해 푸생과 프랑스 고전주의 바로크로 이어졌다.</li>
        <li>플랑드르 바로크는 ${a.rubens}를 중심으로 가톨릭 제단화, 왕실 외교, 신화화가 결합한 대형 화면의 언어를 만들었다. 풍부한 살색, 붉고 금빛 도는 색채, 밀려드는 몸의 운동이 특징이며 반 다이크의 귀족 초상으로도 확장되었다.</li>
        <li>네덜란드 바로크는 교회 제단화보다 시민 시장이 중심이었다. ${a.rembrandt}는 빛으로 인간 내면을 파고들었고, ${a.vermeer}는 조용한 실내와 일상의 순간을 엄격한 빛의 구조로 만들었다. 같은 바로크라도 영웅적 장면보다 초상, 풍속, 정물, 풍경이 핵심이 되었다.</li>
        <li>로마 바로크 조각과 건축은 베르니니, 보로미니를 통해 회화적 공간을 실제 도시와 성당 내부로 확장했다. 조각은 고정된 물체가 아니라 빛과 시선, 제단 장치 속에서 하나의 사건처럼 작동했다.</li>
      </ul>
    </div>
    <div class="enhancement-panel">
      <h3>국가별 발전 방식</h3>
      <ul>
        <li>이탈리아에서는 반종교개혁의 요구가 강했다. 로마의 성당과 예배당은 교리를 설명하는 장소이자 감정을 움직이는 무대가 되었고, 회화와 조각, 건축이 하나의 종교적 체험으로 결합했다.</li>
        <li>스페인에서는 강한 가톨릭 신앙과 궁정 문화가 만났다. 수르바란의 수도원적 엄숙함, 리베라의 육체적 현실감, 벨라스케스의 궁정 초상과 복합적 시선은 스페인 바로크의 폭을 보여준다.</li>
        <li>프랑스에서는 절대왕정 아래 바로크의 에너지가 궁정 질서로 통제되었다. 베르사유의 미술은 운동감보다 권위, 축, 의례, 국가 이미지를 강조했고, 푸생은 고전주의적 구성으로 바로크를 절제했다.</li>
        <li>플랑드르는 가톨릭과 합스부르크 후원 아래 대형 제단화와 궁정화가 번성했고, 네덜란드 공화국은 시장경제 속에서 소형 회화, 집단 초상, 일상 실내, 정물이 발달했다. 두 지역의 차이가 바로크의 지역성을 가장 선명하게 보여준다.</li>
      </ul>
    </div>
  </div>
  <h3>표에는 나오지만 문서 상단에 도판이 없던 대표작</h3>
  <p class="enhancement-intro">아래 카드는 앞부분에서 이미 제시한 카라바조, 아르테미시아, 안니발레 카라치를 반복하지 않고 바로크가 각 지역에서 어떻게 달라졌는지를 보여준다.</p>
  <div class="movement-work-grid">
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="../thumbnails/artist-url-1786879941678/rubens-descent-antwerp-1612.jpg" alt="루벤스, 십자가에서 내려짐"></div>
      <div class="movement-work-body"><span class="mini-label">${a.rubens}</span><h3>${a.rubens}, 《십자가에서 내려짐》</h3><p class="work-meta">1612-1614, 안트베르펜 성모 대성당</p><p>인물들이 십자가에서 사선으로 쏟아져 내려오며 화면 전체가 하나의 몸짓이 된다. 풍부한 색채와 육체적 무게, 집단적 감정이 플랑드르 바로크의 핵심을 압축한다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="../thumbnails/artist-rembrandt/rijksmuseum-SK-C-5.jpg" alt="렘브란트, 야경"></div>
      <div class="movement-work-body"><span class="mini-label">${a.rembrandt}</span><h3>${a.rembrandt}, 《야경》</h3><p class="work-meta">1642, 암스테르담 국립미술관</p><p>집단 초상을 행진 직전의 사건처럼 만들었다. 빛은 인물을 단순히 밝히는 장치가 아니라 시민 공동체의 활력과 심리적 긴장을 조직하는 힘으로 작동한다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="../thumbnails/artist-Q41264/wikidata-Q185372.jpg" alt="베르메르, 진주 귀걸이를 한 소녀"></div>
      <div class="movement-work-body"><span class="mini-label">${a.vermeer}</span><h3>${a.vermeer}, 《진주 귀걸이를 한 소녀》</h3><p class="work-meta">1665년경, 마우리츠하위스</p><p>거대한 사건은 없지만, 어둠 속에서 얼굴과 진주가 떠오르는 순간이 강한 집중을 만든다. 네덜란드 바로크가 일상의 고요함 속에서도 빛의 드라마를 만들 수 있음을 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Bernini-Ecstasy-Saint-Teresa.jpg" alt="베르니니, 성 테레사의 황홀경"></div>
      <div class="movement-work-body"><span class="mini-label">베르니니</span><h3>베르니니, 《성 테레사의 황홀경》</h3><p class="work-meta">1647-1652, 산타 마리아 델라 비토리아, 로마</p><p>조각, 건축, 숨은 창의 빛, 관람석 같은 측면 장치가 합쳐져 성인의 환시를 실제 무대처럼 경험하게 한다. 바로크가 매체의 경계를 넘어 관람자를 사건 안으로 끌어들이는 방식을 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Van-Dyck-Charles-I-at-the-Hunt-WGA07382.jpg" alt="반 다이크, 사냥 중인 찰스 1세"></div>
      <div class="movement-work-body"><span class="mini-label">안토니 반 다이크</span><h3>반 다이크, 《사냥 중인 찰스 1세》</h3><p class="work-meta">1635년경, 루브르</p><p>루벤스의 육체적 에너지와 달리 반 다이크는 길고 우아한 자세, 느슨한 귀족적 태도, 세련된 의상을 통해 권위를 부드럽게 연출했다. 플랑드르 바로크가 궁정 초상의 국제 양식으로 퍼진 사례다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Frans-Hals-Laughing-Cavalier.jpg" alt="프란스 할스, 웃는 기사"></div>
      <div class="movement-work-body"><span class="mini-label">프란스 할스</span><h3>프란스 할스, 《웃는 기사》</h3><p class="work-meta">1624, 월리스 컬렉션</p><p>빠르고 열린 붓질, 순간적으로 살아나는 표정, 화려한 소매의 질감이 네덜란드 시민 초상의 생동감을 만든다. 할스의 바로크성은 극적인 사건보다 사람의 사회적 활력과 눈앞의 현존감에 있다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Velazquez-Las-Meninas.jpg" alt="벨라스케스, 시녀들"></div>
      <div class="movement-work-body"><span class="mini-label">디에고 벨라스케스</span><h3>벨라스케스, 《시녀들》</h3><p class="work-meta">1656, 프라도 미술관</p><p>궁정 초상, 작업실, 거울 속 왕과 왕비, 관람자의 위치가 한 화면에서 뒤섞인다. 스페인 바로크가 단순한 사실 묘사를 넘어 시선과 권력의 구조까지 회화의 주제로 삼았음을 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Zurbaran-Saint-Serapion.jpg" alt="수르바란, 성 세라피온"></div>
      <div class="movement-work-body"><span class="mini-label">프란시스코 데 수르바란</span><h3>수르바란, 《성 세라피온》</h3><p class="work-meta">1628, 워즈워스 애서니엄</p><p>흰 수도복의 무게와 침묵이 화면을 지배한다. 카라바조적 명암을 받아들이되 폭발적 행동보다 순교 직후의 정적과 물질감으로 스페인 수도원 바로크의 엄숙함을 드러낸다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Murillo-The-Young-Beggar-WGA16348.jpg" alt="무리요, 어린 거지"></div>
      <div class="movement-work-body"><span class="mini-label">바르톨로메 에스테반 무리요</span><h3>무리요, 《어린 거지》</h3><p class="work-meta">1645-1650년경, 루브르</p><p>세비야의 거리 현실을 부드러운 빛과 온화한 정서로 바라본다. 무리요는 스페인 바로크의 종교적 감수성을 일상적 빈곤과 인간적 연민의 장면으로 확장했다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Poussin-Et-in-Arcadia-Ego-WGA18305.jpg" alt="니콜라 푸생, 아르카디아에도 나는 있다"></div>
      <div class="movement-work-body"><span class="mini-label">니콜라 푸생</span><h3>푸생, 《아르카디아에도 나는 있다》</h3><p class="work-meta">1637-1638년경, 루브르</p><p>감정의 폭발을 절제하고 인물의 위치, 제스처, 고전적 풍경을 엄격하게 배열한다. 프랑스 바로크가 격정보다 이성적 구성과 도덕적 사유를 중시한 방향을 대표한다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Claude-Lorrain-Embarkation-Queen-of-Sheba-WGA05002.jpg" alt="클로드 로랭, 시바 여왕의 승선이 있는 항구"></div>
      <div class="movement-work-body"><span class="mini-label">클로드 로랭</span><h3>클로드 로랭, 《시바 여왕의 승선이 있는 항구》</h3><p class="work-meta">1648, 내셔널 갤러리, 런던</p><p>주제는 성서 이야기지만 화면의 주인공은 새벽빛과 고전적 항구 공간이다. 클로드는 바로크의 극적 빛을 격렬한 명암이 아니라 이상적 풍경의 질서와 원경으로 바꾸었다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Le-Brun-Chancellor-Seguier-WGA12547.jpg" alt="샤를 르 브룅, 세귀에 재상"></div>
      <div class="movement-work-body"><span class="mini-label">샤를 르 브룅</span><h3>르 브룅, 《세귀에 재상》</h3><p class="work-meta">1660-1661년경, 루브르</p><p>프랑스 바로크의 에너지는 궁정 의례와 국가적 위계로 정리된다. 말, 수행원, 의상, 행렬의 질서가 개인 초상을 왕권 주변의 공식 이미지로 확장한다.</p></div>
    </article>
  </div>
</section>
<!-- art-atlas-enhancement:end -->`,

  'c0d228e179032941f8d9ebfb-1.html': `<!-- art-atlas-enhancement:start -->
${style}
<section class="movement-enhancement">
  <h2>심화 보강 - 지역 화파와 대표작으로 보는 로코코</h2>
  <p class="enhancement-intro">로코코는 바로크의 장대한 권위가 사라진 뒤, 귀족 살롱과 사적 실내, 장식예술, 감각적 대화 속에서 발전한 18세기 양식이다. 가볍고 밝아 보이지만, 실제로는 절대왕정의 공식 이미지에서 사적인 취향과 소비문화로 중심이 이동했다는 사회적 변화를 담고 있다.</p>
  <div class="enhancement-grid">
    <div class="enhancement-panel">
      <h3>따로 HTML로 나누지 않은 내부 화파</h3>
      <ul>
        <li>프랑스 로코코의 페트 갈랑트는 와토가 대표한다. 야외 축제와 연애 장면은 단순한 풍속화가 아니라 귀족 사회가 스스로를 우아한 놀이와 덧없는 감정의 세계로 상상한 결과다.</li>
        <li>부셰와 프라고나르의 살롱 회화는 신화, 목가, 실내 장식, 애정 장면을 부드러운 색과 곡선으로 연결했다. 여기서 그림은 독립된 엄숙한 역사화라기보다 방의 벽, 가구, 직물, 도자기와 어울리는 감각적 환경의 일부가 된다.</li>
        <li>파스텔 초상은 로코코의 중요한 하위 흐름이다. 로살바 카리에라와 라 투르는 피부, 레이스, 표정, 사교적 지성을 부드러운 가루 안료로 표현해 궁정과 살롱의 친밀한 이미지를 만들었다.</li>
        <li>베네치아 로코코는 티에폴로의 천장화와 카날레토의 도시 풍경으로 갈라진다. 티에폴로가 하늘로 열리는 장대한 환영을 만들었다면, 카날레토는 여행자와 그랜드 투어 시장을 위한 정밀한 도시 이미지를 발전시켰다.</li>
        <li>영국에서는 프랑스식 로코코가 그대로 정착하기보다 초상, 풍속, 판화, 실내 장식에서 선택적으로 수용되었다. 게인즈버러는 초상의 색채와 옷감, 자연 배경을 우아하게 결합했고, 호가스는 로코코적 상류 취향을 풍자적 서사로 비틀었다.</li>
      </ul>
    </div>
    <div class="enhancement-panel">
      <h3>국가별 발전 방식</h3>
      <ul>
        <li>프랑스에서는 베르사유식 국가 권위보다 파리의 살롱, 귀족 저택, 후원자의 사적 취향이 중요해졌다. 곡선 장식, 거울, 밝은 벽면, 작은 크기의 회화가 서로 어울리며 로코코의 생활 공간을 만들었다.</li>
        <li>독일과 오스트리아에서는 로코코가 교회와 궁전 실내 장식으로 크게 발전했다. 밝은 회반죽 장식, 금빛 장식, 천장화가 결합해 무거운 바로크 성당을 빛이 넘치는 환영적 공간으로 바꾸었다.</li>
        <li>이탈리아, 특히 베네치아에서는 공화국의 축제 문화와 여행 산업이 로코코를 지탱했다. 티에폴로의 국제적 명성과 카날레토의 베두타는 베네치아가 18세기 유럽 시각문화의 관광 이미지 생산지였음을 보여준다.</li>
        <li>영국에서는 프랑스풍 우아함과 시민적 도덕 풍자가 나란히 발전했다. 초상화는 사회적 신분 상승을 보여주는 매체가 되었고, 호가스식 풍속 서사는 사치와 허영에 대한 비판적 관찰을 제공했다.</li>
      </ul>
    </div>
  </div>
  <h3>표에는 나오지만 문서 상단에 도판이 없던 대표작</h3>
  <p class="enhancement-intro">아래 카드는 앞부분의 와토, 부셰, 프라고나르, 티에폴로, 리고를 반복하지 않고 로코코의 주변부와 확장 영역을 보여준다.</p>
  <div class="movement-work-grid">
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Chardin-The-Ray-WGA04738.jpg" alt="샤르댕, 가오리"></div>
      <div class="movement-work-body"><span class="mini-label">샤르댕</span><h3>샤르댕, 《가오리》</h3><p class="work-meta">1727-1728, 루브르</p><p>샤르댕은 로코코의 연애와 신화 대신 부엌의 사물과 표면을 조용히 관찰했다. 화려한 궁정 취향과 달리, 질감과 빛의 절제가 18세기 프랑스 회화의 또 다른 방향을 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Canaletto-Stonemasons-Yard.jpg" alt="카날레토, 석공의 마당"></div>
      <div class="movement-work-body"><span class="mini-label">카날레토</span><h3>카날레토, 《석공의 마당》</h3><p class="work-meta">1725년경, 내셔널 갤러리, 런던</p><p>축제의 베네치아가 아니라 노동과 도시의 틈새를 정밀하게 보여준다. 그럼에도 맑은 빛, 건축적 질서, 여행자의 시선은 베네치아 로코코가 도시 풍경으로 확장된 방식을 드러낸다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Rosalba-Carriera-Self-Portrait-WGA04503.jpg" alt="로살바 카리에라, 자화상"></div>
      <div class="movement-work-body"><span class="mini-label">로살바 카리에라</span><h3>로살바 카리에라, 《자화상》</h3><p class="work-meta">1740년대, 베네치아 아카데미아 미술관</p><p>파스텔의 부드러운 표면은 로코코 초상이 추구한 친밀함과 섬세한 사교성을 잘 보여준다. 카리에라는 베네치아와 파리를 잇는 국제적 초상 취향을 대표한다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Gainsborough-The-Blue-Boy-1770.jpg" alt="토머스 게인즈버러, 파란 소년"></div>
      <div class="movement-work-body"><span class="mini-label">토머스 게인즈버러</span><h3>게인즈버러, 《파란 소년》</h3><p class="work-meta">1770년경, 헌팅턴 도서관</p><p>영국 초상화는 로코코의 우아한 옷감과 색채를 받아들이면서도 신분, 취향, 자연 배경을 결합했다. 푸른 의상과 느슨한 붓질은 사교적 세련미와 회화적 생동감을 동시에 만든다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Hogarth-Marriage-Settlement.jpg" alt="윌리엄 호가스, 결혼 계약"></div>
      <div class="movement-work-body"><span class="mini-label">윌리엄 호가스</span><h3>호가스, 《결혼 계약》</h3><p class="work-meta">1743년경, 내셔널 갤러리, 런던</p><p>로코코의 사교적 실내와 유행 복식이 등장하지만, 화면은 귀족의 허영과 결혼 시장을 풍자하는 이야기로 구성된다. 영국은 프랑스식 우아함을 받아들이면서도 도덕적 풍속화로 비판했다.</p></div>
    </article>
  </div>
</section>
<!-- art-atlas-enhancement:end -->`,

  '1d8f8238c19b2e2743dd5ed5-1.html': `<!-- art-atlas-enhancement:start -->
${style}
<section class="movement-enhancement">
  <h2>심화 보강 - 지역 전개와 대표작으로 보는 신고전주의</h2>
  <p class="enhancement-intro">신고전주의는 로코코의 사적 취향에 대한 반작용이면서, 고고학 발굴, 계몽주의, 시민 윤리, 혁명 정치가 결합한 국제 양식이다. 고대 그리스와 로마를 단순히 모방한 것이 아니라, 직선적 구도와 절제된 색, 명확한 윤곽으로 새로운 공적 도덕과 국가 이미지를 만들었다.</p>
  <div class="enhancement-grid">
    <div class="enhancement-panel">
      <h3>따로 HTML로 나누지 않은 내부 화파</h3>
      <ul>
        <li>프랑스 혁명기 신고전주의는 다비드를 중심으로 시민적 덕목, 희생, 법, 공화국의 이미지를 만들었다. 고대 로마의 이야기와 현대 정치 사건은 같은 화면 언어로 번역되었고, 그림은 사적인 장식보다 공적 설득의 매체가 되었다.</li>
        <li>제국 양식은 나폴레옹 시대의 신고전주의다. 로마 황제의 도상, 독수리, 월계관, 붉은 벨벳, 대칭 구도가 정치 권력을 시각화했고, 앵그르는 이 질서를 초상화의 표면과 선으로 극단적으로 정제했다.</li>
        <li>로마 국제 신고전주의는 유럽 예술가들이 고대 유적과 발굴품을 직접 보며 학습한 현장이다. 빙켈만의 고전미 이론, 그랜드 투어, 로마 아카데미 네트워크가 합쳐져 회화와 조각 모두에 절제와 명료성을 요구했다.</li>
        <li>조각에서는 카노바가 핵심이다. 흰 대리석, 매끄러운 표면, 감정의 절제, 고대 신화의 선택은 신고전주의가 회화에만 머문 사조가 아니라 신체와 공간의 이상을 다시 세운 운동임을 보여준다.</li>
        <li>여성 화가의 위치도 중요하다. ${a.vigee}와 앙겔리카 카우프만은 초상과 역사화에서 고전적 절제와 감정의 품위를 결합했고, 남성 영웅 중심 서사 바깥의 신고전주의를 보여준다.</li>
      </ul>
    </div>
    <div class="enhancement-panel">
      <h3>국가별 발전 방식</h3>
      <ul>
        <li>프랑스에서는 혁명과 제국이 신고전주의의 속도를 결정했다. 다비드의 엄격한 구도는 공화국의 희생 윤리를, 앵그르의 제국 초상은 나폴레옹 권력의 의례와 위계를 시각화했다.</li>
        <li>이탈리아와 로마는 신고전주의의 현장 학습실이었다. 폼페이와 헤르쿨라네움 발굴, 고대 조각 수집, 아카데미 교육은 "고대적인 것"을 유럽 공통의 미술 언어로 만들었다.</li>
        <li>영국에서는 고고학, 건축, 초상, 역사화가 신고전주의를 받아들였다. 로열 아카데미와 그랜드 투어 문화는 고대의 권위를 교양 있는 상류층의 정체성과 연결했다.</li>
        <li>독일권에서는 신고전주의가 철학과 미학의 언어로 발전했다. 고대 그리스의 단순함과 고귀함은 정치 선전보다 교육, 도덕, 미적 이상을 논하는 기준이 되었다.</li>
      </ul>
    </div>
  </div>
  <h3>표에는 나오지만 문서 상단에 도판이 없던 대표작</h3>
  <p class="enhancement-intro">아래 카드는 앞부분에서 이미 보여준 다비드의 세 작품과 프라고나르를 반복하지 않고, 신고전주의가 제국 초상, 여성 초상, 조각, 국제 역사화로 확장되는 방식을 보여준다.</p>
  <div class="movement-work-grid">
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="../thumbnails/artist-Q213163/wikidata-Q23037740.jpg" alt="비제 르 브룅, 자화상"></div>
      <div class="movement-work-body"><span class="mini-label">${a.vigee}</span><h3>${a.vigee}, 《자화상》</h3><p class="work-meta">1790년경, 우피치 미술관</p><p>부드러운 표정과 자연스러운 몸짓 속에서도 윤곽과 자세가 명료하다. 로코코 궁정 초상의 우아함이 신고전주의의 절제와 결합하는 과도기를 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Ingres-Napoleon-on-Imperial-Throne.jpg" alt="앵그르, 황제의 옥좌에 앉은 나폴레옹"></div>
      <div class="movement-work-body"><span class="mini-label">앵그르</span><h3>앵그르, 《황제의 옥좌에 앉은 나폴레옹》</h3><p class="work-meta">1806, 파리 군사박물관</p><p>인물은 현실의 정치가라기보다 로마 황제와 성상화가 합쳐진 권위의 기호처럼 보인다. 정면성, 대칭, 선명한 장식은 신고전주의가 제국 권력을 어떻게 시각화했는지 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Canova-Psyche-Revived-by-Cupids-Kiss.jpg" alt="카노바, 큐피드의 키스로 되살아난 프시케"></div>
      <div class="movement-work-body"><span class="mini-label">안토니오 카노바</span><h3>카노바, 《큐피드의 키스로 되살아난 프시케》</h3><p class="work-meta">1793, 루브르</p><p>감정적인 순간을 다루지만 표면은 차갑고 매끄럽게 절제되어 있다. 인물의 교차 곡선은 고전적 균형과 감각적 생명력을 동시에 품은 신고전주의 조각의 특징을 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Kauffman-Cornelia-Mother-of-the-Gracchi.jpg" alt="앙겔리카 카우프만, 그라쿠스 형제의 어머니 코르넬리아"></div>
      <div class="movement-work-body"><span class="mini-label">앙겔리카 카우프만</span><h3>카우프만, 《그라쿠스 형제의 어머니 코르넬리아》</h3><p class="work-meta">1788, 바르샤바 왕궁</p><p>화려한 보석 대신 자녀를 덕의 상징으로 내세우는 장면이다. 고대 로마의 모범, 도덕적 선택, 차분한 구도가 신고전주의 역사화의 교육적 성격을 잘 보여준다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Reynolds-Mrs-Siddons-as-Tragic-Muse.jpg" alt="조슈아 레이놀즈, 비극의 뮤즈로 분장한 세라 시던스"></div>
      <div class="movement-work-body"><span class="mini-label">조슈아 레이놀즈</span><h3>레이놀즈, 《비극의 뮤즈로 분장한 세라 시던스》</h3><p class="work-meta">1783-1784년경, 헌팅턴 도서관</p><p>초상화를 단순한 닮음보다 고전적 알레고리와 역사화의 품격으로 끌어올린다. 영국 신고전주의가 로열 아카데미의 그랜드 매너를 통해 교양과 사회적 권위를 표현한 방식이다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Mengs-Parnassus.jpg" alt="안톤 라파엘 멩스, 파르나소스"></div>
      <div class="movement-work-body"><span class="mini-label">안톤 라파엘 멩스</span><h3>멩스, 《파르나소스》</h3><p class="work-meta">1761년 이후, 에르미타주 미술관</p><p>라파엘로적 균형과 고대 신화의 절제된 인물 배치를 결합했다. 멩스는 빙켈만의 고전미 이론을 회화로 옮기며 독일어권 신고전주의의 규범적 방향을 세웠다.</p></div>
    </article>
    <article class="movement-work-card">
      <div class="movement-work-image"><img src="images/Benjamin-West-Death-of-General-Wolfe.jpg" alt="벤저민 웨스트, 울프 장군의 죽음"></div>
      <div class="movement-work-body"><span class="mini-label">벤저민 웨스트</span><h3>웨스트, 《울프 장군의 죽음》</h3><p class="work-meta">1770, 캐나다 국립미술관 판본</p><p>고대 영웅이 아니라 당대 군복을 입은 현대 인물을 역사화의 주인공으로 세웠다. 미국 출신 화가가 영국에서 신고전주의 역사화의 형식을 현대 정치와 제국의 기억에 적용한 사례다.</p></div>
    </article>
  </div>
</section>
<!-- art-atlas-enhancement:end -->`
};

function replaceBlock(fileName, block) {
  const filePath = path.join(movementDir, fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  const next = html.replace(/<!-- art-atlas-enhancement:start -->[\s\S]*?<!-- art-atlas-enhancement:end -->/, block);
  if (next === html) {
    throw new Error(`No enhancement block replaced in ${fileName}`);
  }
  fs.writeFileSync(filePath, next, 'utf8');
  console.log(`updated ${fileName}`);
}

for (const [fileName, block] of Object.entries(blocks)) {
  replaceBlock(fileName, block);
}
