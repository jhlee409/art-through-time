# 사조 HTML 작성 규칙

`data/미술사조/*.html`을 만들거나 수정할 때 적용한다. 재사용할 규칙·예외·레이아웃·검증 절차가 바뀌면 같은 작업에서 이 문서를 갱신한다.

## 구조와 이름

- `<section id="countries">`, `<section class="movement-enhancement" id="movement-deepening">`를 둔다. 상단 고정 바는 서버가 문서의 사조명을 같은 글자 크기로 표시하므로, 목차 링크를 고정 내비게이션으로 사용하지 않는다.
- 사조 막대는 더블클릭으로 설명 HTML을 새 탭에 열며 별도 원문자 설명 아이콘을 넣지 않는다.
- uHangul v0.7 스타일시트와 런타임을 각각 한 번 포함한다.
- 화가 링크는 정식 한국어 이름(`data-uh-korean`), uHangul 표시명(`data-uh-display-korean`), 짧은 통용명(`data-uh-list-korean`)을 분리한다. `node tools/sync-artist-link-display-names.js`로 동기화한다.

## 국가 전개와 카드

- 국가별 전개 표의 화가·제작자는 상단 도판 유무와 관계없이 마지막 심화 카드에 모두 포함한다. 표에 없는 화가로 카드를 채우지 않는다.
- 대표작 카드는 국가·지역별 세부 전개별 독립 `.movement-work-grid`에 둔다. 카드의 `movement-card-activity-region`은 해당 지역과 일치해야 한다.
- 국가별 심화 카드 묶음의 제목에는 `data-art-atlas-submovement`을 국가명으로 지정한다. 서버는 `#countries` 표의 `국가·지역` 및 `특징` 값을 제목 옆에 자동으로 표시하므로, 동일한 지역·특징 문구를 카드마다 반복하지 않는다.
- 카드 DOM 순서는 국가별 미술 탭의 표시 순서이며, 저장한 카드 순서는 표의 화가 링크 순서에도 자동 반영된다.
- 카드 첫 줄은 `화가명, 《작품명》 · 사조 · 지역` 순서로 쓴다.

## 이미지와 검증

- 로컬 이미지 또는 기존 내장 이미지만 사용하며 외부 이미지 URL·다운로드 의존을 새로 만들지 않는다.
- 대표작 카드는 전체 폭 3열, 작은 화면 1열을 유지한다.
- 완료 전 `node tools/validate-movement-links.js`, `node --check server.js`, `git diff --check`를 실행한다.
