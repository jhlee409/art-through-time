# 사조 설명 HTML 작성 규칙

새 미술 사조 설명 HTML을 만들거나 기존 문서를 크게 보완할 때는 이 문서를 기준으로 한다.

## 기본 원칙

- 기존 사조 설명 HTML의 공통 구조와 시각 언어를 따른다.
- 상단 내비게이션에는 주요 구간, 국가별 전개, 심화 학습 이동 링크를 둔다.
- 모든 앵커 링크는 실제 id와 일치해야 한다.

## 규칙 문서 동기화

- 사조 HTML을 수정하면서 다른 사조 문서에도 적용할 수 있는 새 기준·예외·레이아웃·검증 절차가 생기거나 바뀌면, 같은 작업에서 이 문서의 맞는 절에 반영한다.
- 같은 내용의 규칙은 새 항목으로 반복하지 않고 기존 항목을 최신 기준으로 고친다.
- 특정 작품·화가의 문구, 단순 오탈자, 해당 문서에만 쓰이는 사실 정보는 이 문서가 아니라 HTML 데이터에만 반영한다.
- HTML 수정 완료 전에는 이 문서의 관련 항목과 실제 마크업을 대조한다.

## uHangul 표기 통합

- 스타일시트와 런타임을 모두 아래 형식으로 사용한다.

~~~html
<link rel="stylesheet" href="../../uhangul/uhangul-runtime.css?v=0.7" data-uhangul-integration="v0.7">
<script defer src="../../uhangul/uhangul-runtime.js?v=0.7" data-uhangul-integration="v0.7"></script>
~~~

- 사람 이름과 기법명은 기존 데이터 속성 및 공통 런타임 규칙을 따른다.
- uHangul은 v0.7 통합 표기만 넣는다.
- `한 · u · 표` 표기 선택기의 기본값은 항상 `한`(한국어)으로 둔다. URL의 `uhangul` 값처럼 사용자가 명시적으로 넘긴 선택만 초기 표시값으로 존중한다.
- 화가명 링크의 한국어 화면 표기는 `data-uh-korean`, `data-uh-display-korean`, `data-uh-list-korean`을 분리해 쓴다.
- `data-uh-korean`에는 정식 한국어 이름을 이름-성 순으로 넣는다. 예: `앙투안 바토`, `알브레히트 뒤러`, `레오나르도 다 빈치`.
- `data-uh-display-korean`에는 uHangul 모드에서 보일 성-이름 순 표기를 넣는다. 예: `바토, 앙투안`, `뒤러, 알브레히트`, `다 빈치, 레오나르도`.
- `data-uh-list-korean`과 링크 안의 기본 텍스트에는 한국어 모드에서 실제로 보일 짧은 통용명을 넣는다. 예: `바토`, `뒤러`, `다 빈치`.
- 단일명·별명 자체가 통용명인 화가(`미켈란젤로`, `라파엘로`, `티치아노`, `엘 그레코`, `카라바조` 등)는 짧은 통용명을 우선하고, 억지로 성·이름을 나누지 않는다.
- 사조 설명 HTML의 화가 링크 표기는 `node tools/sync-artist-link-display-names.js`로 `data/artists.json` 기준에 맞춘다.

## 사조 막대와 설명 문서 열기

- 사조 연표의 막대에는 원문자 `①`을 비롯한 별도 설명 문서 열기 아이콘·버튼을 넣지 않는다.
- 사조 막대 자체를 더블클릭하면 해당 사조 설명 HTML을 **새 탭**으로 연다.
- 한 번 클릭은 기존 연표의 선택·강조 동작을 유지하며, 설명 문서를 열기 위한 동작으로 바꾸지 않는다.
- 새 사조를 연표에 추가할 때는 막대의 `data-movement-explanation`과 `data-movement-label`을 지정하고, 더블클릭 동작을 반드시 유지한다.

## 국가별 전개

- 문서에는 반드시 <section id="countries">를 둔다.
- 상단 내비게이션에는 반드시 <a href="#countries">국가별 전개</a>를 둔다.
- 표에는 국가·권역, 전개 방식, 대표 화가·제작자를 넣는다.
- 표에 실명으로 적은 모든 화가·제작자는 심화 학습의 대표작 카드에 반드시 포함한다.
- 표에 없는 화가를 카드 수를 늘리기 위해 추가하지 않는다.

## 심화 학습과 대표작 카드

- 문서 끝부분에 <section class="movement-enhancement" id="movement-deepening">를 둔다.
- 상단 내비게이션에는 <a href="#movement-deepening">심화 학습</a>를 둔다.
- 대표작 카드는 전체 폭 3열 레이아웃을 사용하고, 작은 화면에서는 1열로 바뀌어야 한다.
- 카드는 이미지, 화가명·작품명, 연도·지역 또는 사조 정보, 짧은 설명으로 구성한다.

### 세부 전개 그리드와 카드 순서

- 마지막 심화 영역의 대표작 카드는 국가·지역별 세부 전개 단위로 독립된 `.movement-work-grid`에 둔다. 한 그리드에 서로 다른 세부 전개 카드를 섞지 않는다.
- 세부 전개가 둘 이상이면 각 그리드를 `.art-atlas-submovement-group`으로 감싸고, 그리드 바로 앞에 해당 국가·지역 또는 세부 사조 제목을 둔다.
- 카드의 `movement-card-activity-region` 표기는 세부 전개 그리드의 국가·지역과 일치해야 한다. 국가별 미술은 이 표기를 우선해 카드를 판정한다.
- 카드의 DOM 순서는 국가별 미술의 같은 국가·사조 막대에 표시되는 순서다. 국가별 미술에서 연도순으로 다시 정렬하지 않는다.
- 관리자 화면의 카드 드래그 정렬은 같은 세부 전개 그리드 안에서만 허용한다. 저장하면 열려 있는 국가별 미술 탭도 자동으로 새 순서를 반영한다.

### 이미지 규칙

- 프로젝트 내부의 로컬 이미지 또는 문서 안의 기존 내장 이미지만 사용한다.
- 외부 이미지 URL을 새로 의존하지 않는다.
- 로컬 이미지가 없으면 아래 이미지 없음 카드를 만든다. 외부에서 다운로드하지 않는다.

~~~html
<div class="movement-work-image movement-work-image--missing"
     role="img"
     aria-label="화가명, 《작품명》 이미지 없음">
  <span>이미지 없음<br>대표작 추가 예정</span>
</div>
~~~

### 카드 제목·활동 지역 표기

- 심화 학습의 대표작 카드 첫 줄은 반드시 `화가명, 《작품명》 · 사조 · 지역` 순서로 쓴다. 지역 앞에 `활동 지역:` 같은 접두어는 쓰지 않는다.
- 지역은 화가 데이터의 `regions`를 우선 사용한다. 여러 지역에서 활동했으면 `·`으로 함께 표기한다.
- 이 표기는 출생국이나 작품 소장처가 아니라, 화가가 해당 사조를 전개한 주요 활동 지역을 보여 주기 위한 것이다.
- 화가 데이터에 활동 지역이 아직 없으면 임의로 추정하지 않고 `확인 필요`로 표기해 후속 데이터 보강 대상으로 남긴다.
- 카드 제목에서는 `movement-card-title-tag` 뒤에 `movement-card-activity-region`을 둔다.
- 카드 제목의 화가명은 한 사람 이름이 중간에서 줄바꿈되어 두 사람처럼 보이지 않도록 묶는다. 링크 화가명은 `.art-atlas-artist-link{white-space:nowrap}`를 포함하고, 링크가 아닌 카드 첫머리 화가명은 `<span class="movement-card-artist-name">화가명</span>`로 감싼다. 작품명 이후의 사조·지역 태그는 기존처럼 `white-space:nowrap`를 유지한다.

~~~css
.movement-enhancement .movement-work-image--missing{
  padding:24px;
  background:repeating-linear-gradient(135deg,#171d23 0 12px,#11161b 12px 24px);
  color:#cfd6dd;
  text-align:center;
  font-weight:700;
}
~~~

## 카드 레이아웃

~~~css
.movement-enhancement .movement-work-grid,
.movement-enhancement .movement-work-grid.three{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:18px;
  margin-top:16px;
}
.movement-enhancement .wrap .movement-work-grid{
  width:100vw;
  max-width:none;
  margin-left:calc(50% - 50vw);
  margin-right:calc(50% - 50vw);
}
@media(max-width:900px){
  .movement-enhancement .movement-work-grid,
  .movement-enhancement .movement-work-grid.three{grid-template-columns:1fr;}
}
~~~

## 금지 및 주의

- 이전 언어 선택 UI, EN 전용 버튼, 중복 표기 선택기를 새로 만들지 않는다.
- 표와 카드의 화가 목록, 카드의 화가·작품·연도·이미지 연결을 반드시 대조한다.
- 새 이미지 URL 다운로드에는 별도 사용자 허가가 필요하다.

## 완료 전 검증

1. v0.7 통합 표기가 스타일시트와 런타임에 각각 하나씩 있다.
2. id="countries", href="#countries", id="movement-deepening"이 모두 있다.
3. 국가별 전개 표의 화가·제작자가 카드에 모두 대응한다.
4. 외부 이미지 URL을 새로 추가하지 않았다.
5. 연표 막대에 `①` 아이콘이 없고, 더블클릭으로 설명 문서가 새 탭에 열린다.
6. 심화 대표작 카드 첫 줄에 사조와 활동 지역이 모두 표기되었는지 확인한다.
7. 아래 검사를 통과한다.

~~~powershell
node tools/validate-movement-links.js
node --check server.js
git diff --check
~~~

8. 새로 도입하거나 변경한 재사용 규칙이 있으면 이 문서에 반영했는지 확인한다.
