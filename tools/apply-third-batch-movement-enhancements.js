const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');

const style = `<style id="art-atlas-movement-enhancement-style">
.movement-enhancement{padding:58px 0;border-bottom:1px solid var(--line,#2a3037);color:var(--text,#f2efe9)}
.movement-enhancement h2{color:#f1d18b}
.movement-enhancement h3{color:#f2efe9}
.movement-enhancement p{color:#cfd6dd}
.movement-enhancement .enhancement-intro{font-size:1.07rem;color:#d6dce2;max-width:1060px}
.movement-enhancement .enhancement-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:22px 0}
.movement-enhancement .enhancement-panel{border:1px solid var(--line,#2a3037);border-radius:14px;background:rgba(18,22,27,.88);padding:22px;color:#cfd6dd}
.movement-enhancement .enhancement-panel h3{margin:.05rem 0 .7rem;font-size:1.18rem}
.movement-enhancement .enhancement-panel ul{margin:0;padding-left:1.18rem}
.movement-enhancement .enhancement-panel li{margin:.48rem 0;line-height:1.72;color:#cfd6dd}
.movement-enhancement .movement-work-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:22px}
.movement-enhancement .movement-work-card{border:1px solid var(--line,#2a3037);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--panel2,#181d23),var(--panel,#12161b));box-shadow:0 12px 28px rgba(0,0,0,.2)}
.movement-enhancement .movement-work-image{background:#07090b;display:flex;align-items:center;justify-content:center;min-height:260px}
.movement-enhancement .movement-work-image img{display:block;width:100%;height:320px;object-fit:contain}
.movement-enhancement .movement-work-body{padding:16px 18px 18px}
.movement-enhancement .movement-work-body h3{font-size:1.05rem;margin:.35rem 0 .2rem}
.movement-enhancement .movement-work-body small{display:block;color:var(--muted,#aab3bc);margin-bottom:.7rem}
.movement-enhancement .movement-work-body p{margin:.5rem 0 0;color:#cfd6dd;line-height:1.64}
.movement-enhancement .mini-label{display:inline-block;border:1px solid rgba(216,170,75,.38);background:rgba(216,170,75,.09);color:#f0cf87;border-radius:999px;padding:3px 8px;font-size:.74rem;font-weight:800}
@media(max-width:980px){.movement-enhancement .enhancement-grid,.movement-enhancement .movement-work-grid{grid-template-columns:1fr}.movement-enhancement .movement-work-image img{height:auto;max-height:430px}}
</style>`;

function card(label, title, meta, image, alt, body) {
  return `<article class="movement-work-card">
  <div class="movement-work-image"><img src="${image}" alt="${alt}"></div>
  <div class="movement-work-body">
    <span class="mini-label">${label}</span>
    <h3>${title}</h3>
    <small>${meta}</small>
    <p>${body}</p>
  </div>
</article>`;
}

function section(title, intro, panels, cardIntro, cards) {
  return `<!-- art-atlas-enhancement:start -->
${style}
<section class="movement-enhancement" id="movement-deepening">
<div class="wrap">
  <h2>${title}</h2>
  <p class="enhancement-intro">${intro}</p>
  <div class="enhancement-grid">
    ${panels.map((panel) => `<div class="enhancement-panel">
      <h3>${panel.title}</h3>
      <ul>${panel.items.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>`).join('\n    ')}
  </div>
  <div class="enhancement-panel">
    <h3>상단 도판에 없던 화가 대표작 카드</h3>
    <p class="enhancement-intro">${cardIntro}</p>
    <div class="movement-work-grid">
      ${cards.join('\n      ')}
    </div>
  </div>
</div>
</section>
<!-- art-atlas-enhancement:end -->`;
}

const blocks = {
  '4e7a664301ed396184c3cb5d-1.html': section(
    '심화 보강 - 상징주의의 문학, 신화, 세기말 심리',
    '상징주의는 보이는 현실을 버린 것이 아니라, 현실의 표면만으로는 설명되지 않는 죽음, 욕망, 종교, 꿈, 음악성, 불안을 다른 이미지로 암시하려 한 운동이다. 그래서 상징주의는 하나의 필법보다 주제와 태도, 문학과 회화의 긴밀한 관계로 이해해야 한다.',
    [
      {
        title: '따로 HTML로 나누지 않은 내부 화파',
        items: [
          '프랑스 상징주의는 문학적 분위기와 회화가 강하게 결합했다. 모로와 르동은 신화와 꿈을 통해 내면의 수수께끼를 만들었고, 퓌비 드 샤반은 벽화 같은 단순한 형태와 침묵의 정조로 상징적 장면을 공공미술의 규모로 확장했다.',
          '벨기에 상징주의는 브뤼셀의 전위 네트워크, 세기말 문학, 고독과 죽음의 감수성이 강하다. 크노프의 닫힌 실내와 앙소르의 가면 군중은 모두 인간이 사회 속에서 자기 자신과도 낯설어지는 감각을 보여준다.',
          '독일어권과 스위스의 상징주의는 신화, 유혹, 죄, 죽음의 이미지를 무겁고 극적인 형태로 만들었다. 뵈클린은 풍경을 죽음의 무대로 만들었고, 프란츠 폰 슈투크는 몸과 어둠, 뱀의 이미지를 통해 금기와 욕망을 압축했다.',
          '오스트리아 빈 분리파는 상징주의를 장식과 평면성으로 밀어붙였다. 클림트의 금빛 표면은 단순한 화려함이 아니라 에로스, 죽음, 성스러움, 장식이 한 화면에서 뒤섞이는 세기말적 감각이다.',
          '북유럽과 러시아에서는 상징주의가 심리와 종교성으로 깊어졌다. 뭉크는 사랑과 불안, 죽음을 현대인의 실존적 감정으로 다루었고, 브루벨은 러시아 문학과 정교회적 색채, 모자이크 같은 면을 통해 신화적 내면을 만들었다.'
        ]
      },
      {
        title: '국가별 발전 방식',
        items: [
          '프랑스에서는 자연주의와 실증주의가 강해질수록, 예술은 측정할 수 없는 정신의 영역을 찾았다. 살롱 회화와 문학 잡지, 시인들의 선언이 서로 맞물리며 상징주의라는 이름이 이론화되었다.',
          '벨기에는 프랑스보다 작은 미술 시장과 국제 전시 네트워크를 바탕으로 실험적 이미지를 빠르게 수용했다. 앙소르와 크노프는 현실 묘사를 유지하면서도 얼굴, 가면, 침묵, 폐쇄된 공간을 통해 의미를 모호하게 만들었다.',
          '독일, 스위스, 오스트리아에서는 뮌헨 분리파와 빈 분리파 같은 제도 밖 전시 운동이 중요했다. 신화와 알레고리는 더 이상 고전 교양의 장식이 아니라 성, 죽음, 죄의식을 탐구하는 현대적 장치가 되었다.',
          '북유럽에서는 긴 겨울, 고립, 사랑과 죽음의 반복 주제가 심리적 상징주의로 발전했다. 뭉크의 그림은 표현주의로 이어지지만, 출발점은 보이는 장면 뒤의 감정적 진동을 상징으로 바꾸는 데 있었다.',
          '러시아에서는 유럽 상징주의가 은시대 문학, 정교회적 영성, 민속, 무대미술과 결합했다. 이 흐름은 브루벨과 청장미파를 거쳐 러시아 아방가르드의 색채와 평면성에도 밑바탕을 제공했다.'
        ]
      }
    ],
    '앞부분에서 이미 모로, 르동, 뵈클린, 크노프의 도판이 제시되었으므로 여기서는 표에는 나오지만 상단에 없던 퓌비 드 샤반, 앙소르, 슈투크, 클림트, 뭉크, 브루벨을 골랐다.',
    [
      card('퓌비 드 샤반', '퓌비 드 샤반, 《가난한 어부》', '1881, 오르세 미술관', 'images/Puvis-The-Poor-Fisherman.jpg', '퓌비 드 샤반, 가난한 어부', '인물과 풍경은 세부 묘사보다 침묵과 정지된 리듬으로 조직된다. 슬픔을 직접 설명하지 않고 빈 공간, 낮은 색조, 단순한 자세로 암시한다는 점에서 프랑스 상징주의의 벽화적이고 명상적인 방향을 보여준다.'),
      card('제임스 앙소르', '앙소르, 《1889년 브뤼셀에 입성하는 그리스도》', '1888, 게티 미술관', 'images/Ensor-Christ-Entry-into-Brussels.jpg', '제임스 앙소르, 브뤼셀에 입성하는 그리스도', '가면 쓴 군중과 정치적 표어가 종교적 장면을 어지럽힌다. 앙소르는 상징주의의 환상을 사회 풍자와 세기말 불안으로 바꾸어, 가면이 인간의 얼굴보다 더 진실해지는 역설을 보여준다.'),
      card('프란츠 폰 슈투크', '슈투크, 《죄》', '1893, 노이에 피나코테크 계열', 'images/Stuck-The-Sin.jpg', '프란츠 폰 슈투크, 죄', '어둠 속의 인물과 뱀은 신화나 종교 이야기를 현대적 욕망과 금기의 이미지로 압축한다. 상징주의에서 몸은 해부학적 대상이 아니라 죄, 유혹, 불안이 겹쳐지는 심리적 표면이 된다.'),
      card('구스타프 클림트', '클림트, 《키스》', '1907-1908, 벨베데레', 'images/Klimt-The-Kiss.jpg', '구스타프 클림트, 키스', '금빛 장식과 평면적 무늬가 인물을 거의 성상처럼 감싼다. 사랑의 장면이지만 동시에 에로스, 장식, 성스러움, 소멸의 감각이 뒤섞여 빈 분리파의 상징주의적 장식성을 잘 보여준다.'),
      card('에드바르 뭉크', '뭉크, 《절규》', '1893, 노르웨이 국립미술관 계열', 'images/Munch-The-Scream.jpg', '에드바르 뭉크, 절규', '다리와 하늘, 얼굴이 모두 불안의 파동처럼 휘어진다. 뭉크는 자연 풍경을 객관적 배경이 아니라 내면의 공포가 밖으로 번진 장면으로 만들며 상징주의와 표현주의 사이의 연결을 보여준다.'),
      card('미하일 브루벨', '브루벨, 《앉아 있는 악마》', '1890, 트레티야코프 미술관', 'images/Vrubel-Demon-Seated.jpg', '미하일 브루벨, 앉아 있는 악마', '보석처럼 쪼개진 색면과 고독한 자세는 러시아 상징주의의 신화적 내면을 대표한다. 악마는 단순한 악의 상징이 아니라 힘과 절망, 정신적 분열이 함께 담긴 세기말적 자아가 된다.')
    ]
  ),

  '236b5b248aa3129573179c3b-1.html': section(
    '심화 보강 - 야수주의의 색채 해방과 국제적 변형',
    '야수주의는 오래 지속된 제도적 운동이 아니라 1905년 전후 프랑스에서 짧게 폭발한 색채 혁명이다. 핵심은 자연의 실제색을 충실히 따르는 것이 아니라, 화면의 강도와 조화, 감정의 직접성을 위해 색을 독립된 조형 언어로 사용했다는 데 있다.',
    [
      {
        title: '따로 HTML로 나누지 않은 내부 화파',
        items: [
          '샤투파는 드랭과 블라맹크가 센강 주변에서 함께 작업하며 형성한 야수주의의 거친 축이다. 마티스가 색채의 조화와 장식적 균형을 중시했다면, 블라맹크는 반 고흐의 영향 아래 두꺼운 붓질과 원색의 충돌로 더 즉흥적이고 격렬한 화면을 만들었다.',
          '콜리우르 계열은 마티스와 드랭이 남프랑스의 강한 빛을 경험하며 색채를 완전히 해방한 흐름이다. 그림자는 어두운 갈색이 아니라 보라, 파랑, 초록이 될 수 있고, 창과 바다는 깊이보다 색면의 관계로 조직된다.',
          '르아브르와 노르망디 계열에는 뒤피, 프리에스, 브라크 초기 작업이 연결된다. 이들은 야수주의의 순색과 단순화를 받아들였지만 곧 장식적 리듬, 항구 풍경, 또는 입체주의적 구조로 방향을 달리했다.',
          '독일 다리파는 야수주의의 독일 지부가 아니라 동시대에 강렬한 색채를 공유한 별도 표현주의 운동이다. 키르히너와 헤켈은 색을 장식적 조화보다 도시의 긴장, 원시성, 불안, 인간 몸의 왜곡에 더 강하게 연결했다.',
          '헝가리의 네오스와 러시아 신원시주의, 광선주의는 프랑스 색채 해방을 각자의 민속, 도시, 전위 실험으로 번역했다. 그래서 야수주의의 국제성은 복제보다 변형으로 이해해야 한다.'
        ]
      },
      {
        title: '국가별 발전 방식',
        items: [
          '프랑스에서는 1905년 가을 살롱이 결정적이었다. 마티스, 드랭, 블라맹크는 실제색을 벗어난 순색과 단순화된 윤곽으로 관람객에게 충격을 주었지만, 이 그룹은 곧 각자의 방향으로 흩어졌다.',
          '독일에서는 드레스덴 다리파가 강렬한 색을 사회적, 심리적 표현으로 바꾸었다. 야수주의가 색의 조화와 해방을 강조했다면, 독일 표현주의는 색의 불협화음과 날카로운 선으로 근대 도시의 긴장을 드러냈다.',
          '헝가리에서는 파리 유학과 마티스 아카데미 경험을 통해 강한 색채가 전해졌다. 벨러 초벨 같은 화가들은 프랑스식 순색을 수용했지만, 지역 전시와 네오스 그룹 안에서 더 구조적이고 표현주의적인 성격으로 발전했다.',
          '러시아에서는 색채 해방이 곧 민속 목판화, 이콘, 간판, 도시 속도와 결합했다. 곤차로바와 라리오노프는 야수주의의 색을 받아들이면서도 신원시주의, 입체미래주의, 광선주의로 빠르게 이동했다.',
          '블라맹크, 헤켈, 초벨처럼 저작권 또는 공개 도판 조건이 까다로운 작가는 이 문서에서 설명을 강화하고, 마지막 카드는 안정적으로 로컬 보존이 가능한 공개 이미지 중심으로 구성했다.'
        ]
      }
    ],
    '앞부분에서 이미 반 고흐, 고갱, 마티스, 드랭, 블라맹크 관련 도판이 반복적으로 등장하므로, 마지막 카드는 독일 표현주의와 러시아 전위로 변형된 색채 해방을 보여주는 공개 도판으로 제한했다.',
    [
      card('에른스트 루트비히 키르히너', '키르히너, 《거리 장면》', '1910년대, 드레스덴/독일 표현주의 계열', 'images/Kirchner-Street-Dresden.jpg', '키르히너, 거리 장면', '인물의 몸과 도시 공간이 날카로운 색과 선으로 불안하게 압축된다. 야수주의와 같은 강한 색을 쓰지만, 독일 다리파에서는 색이 장식적 조화보다 근대 도시의 긴장과 심리적 압박을 드러내는 도구가 된다.'),
      card('나탈리아 곤차로바', '곤차로바, 《자전거 타는 사람》', '1913, 러시아 미술관', 'images/Goncharova-Cyclist.jpg', '나탈리아 곤차로바, 자전거 타는 사람', '순색과 반복되는 글자, 분절된 움직임이 결합한다. 프랑스 야수주의의 색채 해방은 러시아에서 민속적 단순화와 도시 속도, 입체미래주의의 동세로 바뀌었다.'),
      card('미하일 라리오노프', '라리오노프, 《붉고 푸른 광선주의》', '1911, 루트비히 미술관', 'images/Larionov-Red-Blue-Rayonism.jpg', '미하일 라리오노프, 붉고 푸른 광선주의', '대상은 거의 사라지고 색의 광선과 방향성이 화면을 조직한다. 야수주의가 색을 현실에서 해방했다면, 라리오노프는 그 색을 빛의 힘과 추상적 운동으로 밀어붙여 러시아 전위미술의 길을 열었다.')
    ]
  ),

  '83e1fbbdad822f464a299cf3-1.html': section(
    '심화 보강 - 입체주의의 단계, 살롱, 국제 확산',
    '입체주의는 대상을 네모나게 그리는 양식이 아니라, 르네상스 이후 회화가 당연하게 여겼던 하나의 시점, 하나의 순간, 하나의 소실점을 해체한 사건이다. 피카소와 브라크의 작업실 실험에서 시작했지만 곧 살롱, 이론, 디자인, 건축, 미래주의, 러시아 전위로 확산되었다.',
    [
      {
        title: '따로 HTML로 나누지 않은 내부 화파',
        items: [
          '분석적 입체주의는 1909년에서 1912년 사이 피카소와 브라크가 대상을 작은 면과 제한된 색으로 분해한 단계다. 대상과 배경은 서로 맞물리고, 기타나 병 같은 사물은 여러 시점의 정보가 겹쳐진 구조로 바뀐다.',
          '종합적 입체주의는 1912년 이후 콜라주와 종이붙이기를 통해 그림을 다시 조립한 단계다. 신문, 벽지, 문자, 나뭇결 같은 현실의 조각이 화면에 들어오면서 회화는 현실을 모사하는 창이 아니라 실제 재료와 기호가 놓이는 평면이 되었다.',
          '살롱 입체주의는 글레즈, 메챙제, 레제, 들로네, 라 포코니에 등이 공개 전시와 저술을 통해 입체주의를 국제 운동으로 만든 흐름이다. 이들은 피카소와 브라크보다 더 큰 화면, 더 선명한 이론, 더 사회적인 전시 전략을 사용했다.',
          '오르피즘은 들로네 부부를 중심으로 입체주의의 구조를 색채 리듬과 현대 도시의 빛으로 바꾸었다. 에펠탑과 창문, 원형 색면은 대상을 분석하면서도 색 자체가 음악처럼 움직이는 효과를 만든다.',
          '체코 입체주의, 러시아 입체미래주의, 영국 보티시즘은 입체주의가 회화 안에 머물지 않았음을 보여준다. 형태의 분해는 가구와 건축, 속도와 기계, 전쟁과 산업 이미지로 번역되었다.'
        ]
      },
      {
        title: '국가별 발전 방식',
        items: [
          '프랑스 파리는 입체주의의 중심지였지만, 그 안에서도 작업실 입체주의와 살롱 입체주의가 달랐다. 피카소와 브라크는 밀도 높은 사적 실험을 했고, 글레즈와 메챙제는 이를 전시와 이론의 언어로 넓혔다.',
          '스페인 출신 피카소와 후안 그리스는 파리에서 입체주의의 국제성을 보여준다. 그리스는 분석적 분해보다 명료한 구조와 종합적 질서를 강조해 입체주의를 더 읽기 쉬운 조형 체계로 만들었다.',
          '이탈리아에서는 입체주의의 분해된 형태가 미래주의의 속도와 결합했다. 보초니, 발라, 세베리니는 정지된 사물보다 도시, 춤, 기계, 몸의 연속 운동을 표현하려 했다.',
          '러시아에서는 입체주의와 미래주의가 민속미술, 이콘, 혁명 전위와 결합했다. 말레비치, 포포바, 타틀린은 입체미래주의를 거쳐 절대주의와 구성주의로 이동하며 회화를 사물과 공간의 문제로 확장했다.',
          '체코와 영국에서는 입체주의가 지역적으로 매우 독특하게 바뀌었다. 체코는 가구와 건축에 각진 구조를 적용했고, 영국 보티시즘은 기계적 에너지와 전쟁의 시각 경험을 결합했다.'
        ]
      }
    ],
    '앞부분에서 이미 세잔, 피카소, 후안 그리스, 글레즈의 도판이 있으므로 여기서는 상단에 없던 들로네, 보초니, 세베리니, 포포바, 야나크, 워즈워스를 골랐다. 브라크와 일부 작가는 공개 로컬 도판 확보가 제한되어 설명에서 비중을 보강했다.',
    [
      card('로베르 들로네', '들로네, 《에펠탑》', '1911, 구겐하임 미술관', 'images/Delaunay-Eiffel-Tower.jpg', '로베르 들로네, 에펠탑', '에펠탑은 한 시점의 건축물이 아니라 여러 각도와 색면이 동시에 움직이는 도시의 상징이 된다. 들로네는 입체주의의 구조를 더 밝은 색채와 리듬으로 확장해 오르피즘으로 나아갔다.'),
      card('움베르토 보초니', '보초니, 《공간 속에서 연속하는 유일한 형태》', '1913, 미래주의 조각', 'images/Boccioni-Unique-Forms.jpg', '움베르토 보초니, 공간 속에서 연속하는 유일한 형태', '입체주의가 형태를 분해했다면, 보초니는 그 분해를 운동하는 몸의 연속성으로 바꾸었다. 조각은 고정된 인체가 아니라 공기와 속도 속에서 밀려나가는 힘의 흔적처럼 보인다.'),
      card('지노 세베리니', '세베리니, 《푸른 무희》', '1912, 미래주의 계열', 'images/Severini-Blue-Dancer.jpg', '지노 세베리니, 푸른 무희', '춤추는 몸은 하나의 자세로 멈추지 않고 분절된 면과 반복되는 리듬으로 나타난다. 세베리니는 파리의 입체주의 구조를 이탈리아 미래주의의 움직임과 도시 오락의 감각으로 연결했다.'),
      card('류보프 포포바', '포포바, 《여인의 초상》', '1915, 루트비히 미술관', 'images/Popova-Portrait-of-a-Lady.jpg', '류보프 포포바, 여인의 초상', '초상은 얼굴의 닮음보다 겹치는 평면, 강한 색, 구조적 긴장으로 이루어진다. 러시아 입체미래주의는 입체주의의 분해를 색채와 공간의 실험으로 확장했고, 포포바는 이를 구성주의로 이어갈 핵심 인물이다.'),
      card('파벨 야나크', '야나크, 《입체주의 의자》', '1911, 체코 입체주의 디자인', 'images/Janak-Cubist-Chair.jpg', '파벨 야나크, 입체주의 의자', '체코 입체주의는 회화의 면 분해를 실제 가구와 건축으로 옮겼다. 의자의 등받이와 구조가 각진 평면으로 접히며, 입체주의가 화면 밖의 생활 공간까지 바꿀 수 있었음을 보여준다.'),
      card('에드워드 워즈워스', '워즈워스, 《리버풀 드라이독의 다즐 선박》', '1919, 캐나다 국립미술관', 'images/Wadsworth-Dazzle-Ships.jpg', '에드워드 워즈워스, 리버풀 드라이독의 다즐 선박', '선박의 위장무늬와 산업 공간이 날카로운 기하학으로 조직된다. 영국 보티시즘은 입체주의의 구조적 분해를 전쟁, 기계, 항구의 시각 경험과 연결했다.')
    ]
  )
};

const markerPattern = /<!-- art-atlas-enhancement:start -->[\s\S]*?<!-- art-atlas-enhancement:end -->/;

for (const [fileName, block] of Object.entries(blocks)) {
  const filePath = path.join(movementDir, fileName);
  const oldHtml = fs.readFileSync(filePath, 'utf8');
  if (!markerPattern.test(oldHtml)) {
    throw new Error(`Missing enhancement marker: ${fileName}`);
  }
  fs.writeFileSync(filePath, oldHtml.replace(markerPattern, block), 'utf8');
  console.log(`updated ${fileName}`);
}
