# 사조 설명 HTML 작성 규칙

새 미술 사조 설명 HTML을 만들거나 기존 문서를 크게 보완할 때는 이 문서를 기준으로 한다.

## 기본 원칙

- 기존 사조 설명 HTML의 공통 구조와 시각 언어를 따른다.
- 상단 내비게이션에는 주요 구간, 국가별 전개, 심화 학습 이동 링크를 둔다.
- 모든 앵커 링크는 실제 id와 일치해야 한다.

## uHangul 표기 통합

- 스타일시트와 런타임을 모두 아래 형식으로 사용한다.

~~~html
<link rel="stylesheet" href="../../uhangul/uhangul-runtime.css?v=0.6-draft" data-uhangul-integration="v0.6-draft">
<script defer src="../../uhangul/uhangul-runtime.js?v=0.6-draft" data-uhangul-integration="v0.6-draft"></script>
~~~

- 사람 이름과 기법명은 기존 데이터 속성 및 공통 런타임 규칙을 따른다.
- 이전 버전(v0.3~v0.5) 통합 표기를 넣지 않는다.

## 사조 막대와 설명 문서 열기

- 사조 연표의 막대에는 원문자 `①`을 비롯한 별도 설명 문서 열기 아이콘·버튼을 넣지 않는다.
- 사조 막대 자체를 더블클릭하면 해당 사조 설명 HTML을 **새 탭**으로 연다.
- 한 번 클릭은 기존 연표의 선택·강조 동작을 유지하며, 설명 문서를 열기 위한 동작으로 바꾸지 않는다.
- 새 사조를 연표에 추가할 때도 기존 `movement-explanation-link` 대상과 연결하고, 더블클릭 동작을 반드시 유지한다.

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

1. v0.6-draft 통합 표기가 스타일시트와 런타임에 각각 하나씩 있다.
2. id="countries", href="#countries", id="movement-deepening"이 모두 있다.
3. 국가별 전개 표의 화가·제작자가 카드에 모두 대응한다.
4. 외부 이미지 URL을 새로 추가하지 않았다.
5. 연표 막대에 `①` 아이콘이 없고, 더블클릭으로 설명 문서가 새 탭에 열린다.
6. 아래 검사를 통과한다.

~~~powershell
node tools/validate-movement-links.js
node --check server.js
git diff --check
~~~
