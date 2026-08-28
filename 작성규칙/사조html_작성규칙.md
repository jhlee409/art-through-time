# 사조 HTML 작성 규칙

`data/미술사조/*.html`을 만들거나 수정할 때 적용한다. 재사용할 규칙·예외·레이아웃·검증 절차가 바뀌면 같은 작업에서 이 문서를 갱신한다.

## 구조와 이름

- 전면 재구축에서 부모 사조와 핵심 범주의 정본은 `data/art-movement-canonical.json`이다. 독립 HTML은 `role: document`인 부모 34개와 `contextReferences`의 이전 미술 참고 2개만 대상으로 하며, `role: absorbed`인 부모 10개는 `documentOwnerId` 문서 안에서 설명한다.
- 국가 전개 표 첫 열, 심화 대표작 카드 범주 제목, 화가 리스트의 세부 범주 박스는 정본의 같은 `categoryId`와 표시명을 사용해야 한다. 구체적인 HTML 속성과 저장 동기화 방식은 재구축 동기화 계약에 따르되, 이름을 문서별로 줄이거나 합치거나 새로 만들지 않는다.
- `coveredTopics`는 핵심 범주로 별도 노출하지 않고 해당 범주 설명 안에서 다룰 관련 화파·경향이다. 별칭이나 동일 사조로 간주하지 않는다.
- 동기화 버전 1의 구체적인 속성·권한·편집 트랜잭션은 `data/art-movement-sync-contract.json`을 따른다. 문서 루트에는 `data-art-atlas-sync-version="1"`, `data-art-atlas-sync-state`, 그리고 `data-art-atlas-parent-id` 또는 `data-art-atlas-context-id` 중 하나만 둔다. 대표작 심화 구역에는 `data-art-atlas-representative-section="works"`를 둔다.
- 4단계 구조 이관 문서는 `data-art-atlas-sync-state="structure"`로 둔다. 이 상태에서는 문서·범주·전개 ID와 68개 행·카드 묶음 자리만 신뢰하며 카드 드래그, 대표 화가 편집, 화가 목록 반영을 잠근다. 표의 대표 화가와 카드의 화가·작품·선정 이유를 모두 맞춘 문서만 5단계에서 `complete`로 올린다.
- 정본 36개 색인에서 제외한 기존 하위 사조 문서는 5단계 흡수 작업이 끝날 때까지 삭제하지 않고 `data/미술사조/legacy-index.json`에 소유 부모·범주·용도를 기록한다.
- 국가 전개 표의 각 행과 대응 카드 묶음에는 같은 `data-art-atlas-development-id`·`data-art-atlas-category-id`·`data-art-atlas-country-ids`를 둔다. `developmentId`는 프로젝트 전체에서 유일하며 한 행과 한 카드 묶음만 연결한다.
- 버전 1 대표작 카드는 `data-artist-id`·`data-work-id`·`data-art-atlas-image-state`를 가지며 선정 이유와 작품 설명을 각각 `data-art-atlas-selection-reason`, `data-art-atlas-card-description`으로 구분한다. 이미지가 아직 없으면 외부 URL을 만들지 않고 `imageState="pending"`으로 둔다.
- 독자적 조형 언어, 제도·집단, 선언 또는 분명한 내부 분화가 있는 항목만 별도 설명 HTML로 만든다. 한 국가에서 상위 사조를 수용·변형한 지역적 전개는 국가별 막대는 유지할 수 있지만, 별도 HTML을 복제하지 않고 상위 사조 문서의 `여러 국가에서의 전개`에서 설명한다.
- `<section id="countries">`, `<section class="movement-enhancement" id="movement-deepening">`를 둔다. 상단 고정 바는 서버가 문서의 사조명을 기본 내비게이션 글자 크기의 두 배(`2em`)로, 문서 폭 중앙에 표시하므로 목차 링크를 고정 내비게이션으로 사용하지 않는다.
- 사조 막대는 더블클릭으로 설명 HTML을 새 탭에 열며 별도 원문자 설명 아이콘을 넣지 않는다.
- uHangul v0.7 스타일시트와 런타임을 각각 한 번 포함한다.
- 화가 링크는 정식 한국어 이름(`data-uh-korean`), uHangul 표시명(`data-uh-display-korean`), 짧은 통용명(`data-uh-list-korean`)을 분리한다. `node tools/sync-artist-link-display-names.js`로 동기화한다.
- 공통 레이아웃 규칙(상단 고정 사조명, 심화 카드 제목의 국가별 지역·특징 설명, 해당 글자 크기·중복 레이블 제거)을 바꾸면 같은 작업에서 `node tools/sync-all-movement-html-rules.js`를 실행해 모든 저장 HTML에 반영한다. 서버의 화면 주입만으로 끝내지 않는다.

## 국가 전개와 카드

- 국가별 전개 표의 화가·제작자는 상단 도판 유무와 관계없이 마지막 심화 카드에 모두 포함한다. 표에 없는 화가로 카드를 채우지 않는다.
- `여러 국가에서의 전개` 표는 화가 리스트 오른쪽 화면의 국가별 세부 사조와 대표 화가를 정하는 정본이다. 표에서 국가·지역명, 세부 사조명, 기간 또는 대표 화가를 바꾸면 HTML만 고치고 끝내지 않는다. 같은 작업에서 `data/art-movements.json`의 해당 국가·세부 사조 행(이름·기간)을 맞추고, `data/artists.json`의 해당 화가 `regions`·`movementActivityCountry`·`movements`·`submovements`·활동 시작과 작품 연도를 검토·갱신한다. 그 결과 화가 리스트의 같은 세부 사조 상자와 화가 이름 상자가 표의 국가·지역·대표 화가와 일치하는지 실제 화면에서 확인한다. 근거가 부족한 화가·기간은 임의로 화가 리스트에 넣지 않고 표 또는 데이터 중 어느 쪽을 보류할지 기록한다.
- 대표작 카드는 국가·지역별 세부 전개별 독립 `.movement-work-grid`에 둔다. 카드의 `movement-card-activity-region`은 해당 지역과 일치해야 한다.
- 동기화 버전 1 카드 묶음의 제목은 `categoryId`로 정본 표시명을 읽고, 국가·지역 및 특징은 같은 `developmentId`의 표 행에서 읽는다. 동일한 지역·특징 문구를 카드마다 반복하지 않는다. 기존 무버전 문서의 `data-art-atlas-submovement` 국가명 부분일치 방식은 이관 전 읽기 호환에만 사용한다.
- 국가별 전개 표에서 별도 편집을 허용하는 사조는 `#countries`에 `data-art-atlas-country-feature-editor="country-development"` 식별자를 둔다. 해당 구역은 문서 가로 폭 전체를 사용하고, 국가·지역과 대표 화가 열은 내용이 한 줄로 유지되는 최소 폭으로 두며 특징 열에 나머지 폭을 배정한다. 편집 아이콘은 관리자에게만 각 특징 칸의 오른쪽 위에 표시하고, 읽기 전용에서는 아이콘·입력·저장·취소 제어를 렌더링하지 않는다. 관리자 편집은 `1. 제목` 아래 `- 불릿` 형식만 저장하며, 한 특징 칸은 최대 40줄로 제한한다. 읽기 상태에서는 번호 제목·불릿 목록을 왼쪽 정렬하고 표 셀은 세로 가운데 정렬한다. 저장 시 편집 제어 요소·전용 스타일은 HTML 원본에 남기지 않는다.
- 국가별 전개 표에서 국가·지역·특징·대표 화가처럼 병렬 컬럼을 비교하는 편집형 표는 각 컬럼 사이를 흰색 `1px` 실선으로 구분한다. 마지막 컬럼 오른쪽에는 추가 선을 그리지 않는다.
- 전체 사조 설명 문서의 국가 전개 표를 이 기준으로 일괄 정리할 때는 먼저 `node tools/normalize-country-development-tables.js --dry-run`으로 3컬럼 표가 없는 예외를 확인하고, 내용 근거를 보완한 뒤 `node tools/normalize-country-development-tables.js`를 실행한다. 모든 문서는 `국가·지역·세부 사조`·`지역적 특징`·`대표 화가·제작자` 3컬럼과 특징 목록 형식을 유지한다.
- 심화 카드 묶음에서 국가명 뒤에 자동 표시하는 `지역`·`특징` 설명(`.movement-country-card-context`)은 기본 `0.912rem`으로 둔다. 이는 1.14rem 기준을 80%로 낮춘 크기이며, 국가명과 설명의 위계를 유지하면서도 스크롤 없이 읽을 수 있어야 한다.
- 카드 DOM 순서는 국가별 미술 탭의 표시 순서이며, 관리자가 같은 국가·세부 전개 그리드에서 카드 순서를 저장하면 그 그리드의 카드 화가 전체(기존 표에 없던 카드 화가 포함)를 국가 전개 표의 같은 행에 같은 순서로 자동 반영한다. 표에 있으나 카드가 아직 없는 화가는 저장 과정에서 삭제하지 않고, 먼저 같은 지역 그리드에 카드(로컬 이미지가 없으면 `이미지 추가 예정` 카드)를 보강한 뒤 다시 저장한다. 최종 상태에는 카드와 표의 화가 누락·중복을 남기지 않는다.
- 버전 1 카드 드래그는 같은 `developmentId`의 그리드 안에서만 허용하고 표의 대표 화가 링크 순서를 같은 저장 트랜잭션에서 바꾼다. 다른 전개·범주로 화가를 옮길 때는 카드 간 드래그를 사용하지 않고 국가 전개 표의 대표 화가 분류 명령으로 카드와 표를 함께 이동한다.
- 한 화가는 기본적으로 한 문서의 한 `developmentId`에만 둔다. 서로 다른 작품으로 두 범주의 차이를 설명하는 데 대체 불가능해 중복할 때에는 모든 해당 카드에 `data-art-atlas-duplicate-artist-reason`으로 교육적 이유를 기록한다.
- 카드 첫 줄은 `화가명, 《작품명》 · 사조 · 지역` 순서로 쓴다.
- 카드의 대표작은 단순히 유명한 작품이 아니라 해당 국가·세부 사조의 색채, 빛, 공간, 주제, 후원·사교 환경을 가장 잘 설명하는 작품으로 고른다. 더 적합한 작품으로 교체할 때는 이미지·대체 텍스트·고해상도 경로·작품명·연도·활동 지역·설명을 한 번에 교체한다.
- 카드의 활동 지역은 작가의 현대 국적과 혼동하지 않는다. 작품 제작 당시의 역사적 국가·도시권을 쓸 때에는 표·카드·화가 작품 데이터의 맥락을 맞춘다.

## 이미지와 검증

- 로컬 이미지 또는 기존 내장 이미지만 사용하며 외부 이미지 URL·다운로드 의존을 새로 만들지 않는다. 화가별 로컬 썸네일을 카드에 재사용할 때는 상대 경로와 `data-art-atlas-highres`가 같은 로컬 자산을 가리키는지 확인한다.
- `<img src="data:image/...">` 형태의 base64 인라인 이미지는 사조 HTML에 넣지 않는다. 사용해야 하는 기존 내장 이미지는 `data/미술사조/images/`의 로컬 파일로 분리한 뒤 상대 경로로 참조한다.
- 대표작 카드는 전체 폭 3열, 작은 화면 1열을 유지한다.
- 완료 전 `node tools/validate-movement-canonical.js`, `node tools/validate-movement-sync-contract.js`, `node tools/validate-movement-documents-v1.js`, `node tools/validate-movement-links.js`, `node tools/normalize-country-development-tables.js --dry-run`, `node --check server.js`, `node tools/check-project-health.js`, `git diff --check`를 실행한다. 사조 HTML 제공 경로나 서버 콘텐츠 서비스를 고쳤다면 서버 재시작 뒤 `index.json` 등록 문서 전체의 HTTP 200 응답도 확인한다.
