# 사조 HTML 작성 규칙

`data/미술사조/*.html`을 만들거나 수정할 때 적용한다. 재사용할 규칙·예외·레이아웃·검증 절차가 바뀌면 같은 작업에서 이 문서를 갱신한다.

## 구조와 이름

- 전면 재구축에서 부모 사조와 핵심 범주의 정본은 `data/art-movement-canonical.json`이다. 독립 HTML은 `role: document`인 부모 34개와 `contextReferences`의 이전 미술 참고 2개만 대상으로 하며, `role: absorbed`인 부모 10개는 `documentOwnerId` 문서 안에서 설명한다.
- 국가 전개 표 첫 열, 심화 대표작 카드 범주 제목, 화가 리스트의 세부 범주 박스는 정본의 같은 `categoryId`와 표시명을 사용해야 한다. 구체적인 HTML 속성과 저장 동기화 방식은 재구축 동기화 계약에 따르되, 이름을 문서별로 줄이거나 합치거나 새로 만들지 않는다.
- `coveredTopics`는 핵심 범주로 별도 노출하지 않고 해당 범주 설명 안에서 다룰 관련 화파·경향이다. 별칭이나 동일 사조로 간주하지 않는다.
- 동기화 버전 1의 구체적인 속성·권한·편집 트랜잭션은 `data/art-movement-sync-contract.json`을 따른다. 문서 루트에는 `data-art-atlas-sync-version="1"`, `data-art-atlas-sync-state`, 그리고 `data-art-atlas-parent-id` 또는 `data-art-atlas-context-id` 중 하나만 둔다. 대표작 심화 구역에는 `data-art-atlas-representative-section="works"`를 둔다.
- 4단계 구조 이관 문서는 `data-art-atlas-sync-state="structure"`로 둔다. 이 상태에서는 문서·범주·전개 ID와 68개 행·카드 묶음 자리만 신뢰한다.
- 5단계에서 표의 대표 화가와 카드의 화가·작품·선정 이유를 모두 맞춘 문서는 `data-art-atlas-sync-state="content"`로 올린다. `content`는 화면에서 읽을 수 있는 콘텐츠 완성 상태지만 카드 드래그, 대표 화가 편집, 저장, 화가 목록 반영은 잠근다.
- 6단계의 ID 기반 양방향 동기화와 저장 전 불변식 검사가 끝난 문서만 `data-art-atlas-sync-state="complete"`로 올린다.
- 현재 활성 부모 문서 34개는 `complete`, 이전 미술 참고 문서 2개는 정규 범주·대표작 카드가 없는 `structure` 상태를 유지한다. 활성 문서 수와 상태는 `data/미술사조/index.json` 및 검증 도구의 결과를 기준으로 한다.
- 정본 36개 색인에서 제외한 기존 하위 사조·중복 문서는 삭제하지 않고 `data/미술사조/legacy-index.json`에 소유 부모·범주·용도를 기록한다. 실제 폴더의 HTML 중 활성 36개를 제외한 모든 파일이 이 색인에 정확히 한 번 있어야 하며, 활성 문서와 레거시 문서가 중복 등록되어서는 안 된다.
- 국가 전개 표의 각 행과 대응 카드 묶음에는 같은 `data-art-atlas-development-id`·`data-art-atlas-category-id`·`data-art-atlas-country-ids`를 둔다. `developmentId`는 프로젝트 전체에서 유일하며 한 행과 한 카드 묶음만 연결한다.
- 버전 1 대표작 카드는 `data-artist-id`·`data-work-id`·`data-art-atlas-card-role`·`data-art-atlas-image-state`를 가지며 선정 이유와 작품 설명을 각각 `data-art-atlas-selection-reason`, `data-art-atlas-card-description`으로 구분한다. 대표 화가는 `cardRole="primary"`, 더 볼 화가는 `cardRole="further"`로 둔다. 이미지가 아직 없으면 외부 URL을 만들지 않고 `imageState="pending"`과 화면 문구 `다운로드 필요`를 사용한다.
- 독자적 조형 언어, 제도·집단, 선언 또는 분명한 내부 분화가 있는 항목만 별도 설명 HTML로 만든다. 한 국가에서 상위 사조를 수용·변형한 지역적 전개는 국가별 막대는 유지할 수 있지만, 별도 HTML을 복제하지 않고 상위 사조 문서의 `여러 국가에서의 전개`에서 설명한다.
- `<section id="countries">`, `<section class="movement-enhancement" id="movement-deepening">`를 둔다. 상단 고정 바는 서버가 문서의 사조명을 기본 내비게이션 글자 크기의 두 배(`2em`)로, 문서 폭 중앙에 표시하므로 목차 링크를 고정 내비게이션으로 사용하지 않는다.
- 사조 막대는 더블클릭으로 설명 HTML을 새 탭에 열며 별도 원문자 설명 아이콘을 넣지 않는다.
- uHangul v0.7 스타일시트와 런타임을 각각 한 번 포함한다.
- 화가 링크는 정식 한국어 이름(`data-uh-korean`), uHangul 표시명(`data-uh-display-korean`), 짧은 통용명(`data-uh-list-korean`)을 분리한다. `node tools/sync-artist-link-display-names.js`로 동기화한다.
- 공통 레이아웃 규칙(상단 고정 사조명, 심화 카드 제목의 국가별 지역·특징 설명, 해당 글자 크기·중복 레이블 제거)을 바꾸면 같은 작업에서 `node tools/sync-all-movement-html-rules.js`를 실행해 모든 저장 HTML에 반영한다. 서버의 화면 주입만으로 끝내지 않는다.

## 초심자 학습 길잡이

- 정본에 등록된 부모 사조 문서 34개와 이전 미술 참고 문서 2개는 모두 `<section id="movement-learning-guide">`를 `<main>`의 첫 학습 구역으로 둔다. 문서 루트와 구역에는 `data-art-atlas-learning-guide-version="1"`을 기록한다.
- 길잡이 원문은 `data/art-movement-learning-guides.json`이 소유한다. HTML에서 직접 문장을 고친 뒤 방치하지 않고 원문 JSON을 수정하고 `node tools/sync-movement-learning-guides.js`로 36개 문서에 동기화한다.
- 모든 길잡이는 `사조의 방향을 설명하는 개요`, `작품에서 볼 세 가지 기준`, `인접 사조와의 구분`, `흔한 오해 교정`을 빠짐없이 갖춘다. 화가·작품을 외우게 하기보다 무엇이 달라졌고 화면에서 무엇을 확인해야 하는지 먼저 설명한다.
- 부모 사조 문서의 `핵심 범주 비교`는 별도 문구를 복제하지 않는다. `data/art-movement-canonical.json`의 범주명과 `data/art-movement-representatives.json`의 핵심 특징을 동기화 도구가 읽어 구성한다.
- `detailed` 문서는 사조 내부의 조형적 차이와 다음 사조로의 전환을 설명하고, `bridge` 문서는 흡수된 사조·매체·지역 사이의 연결을 우선하며, `reference` 문서는 인접 핵심 사조와 혼동하지 않을 최소 경계를 명료하게 설명한다. 이전 미술 참고 문서는 1400년 이후 정규 부모 사조로 오해되지 않게 연결 맥락임을 첫 문단에서 밝힌다.
- 길잡이는 카드 UI로 만들지 않는다. 전체 폭의 학습 구역 안에서 구분선과 2열 정보 구조를 사용하고 작은 화면에서는 1열로 전환한다.
- 검증할 때 `node tools/sync-movement-learning-guides.js --check`를 실행해 36개 문서의 내용·스타일·버전이 원문과 정확히 일치하는지 확인한다.

## 국가 전개와 카드

- 국가별 전개 표는 `국가·지역·세부 사조`, `지역적 특징`, `대표 화가·제작자`, `더 볼 화가`의 4컬럼을 사용한다. 대표 화가는 초심자 기준점 1명, 더 볼 화가는 중급 확장 1~4명으로 제한한다.
- 더 볼 화가 수는 일률적으로 채우지 않는다. 범위가 좁거나 대표 화가만으로 핵심 차이가 충분하면 1명, 일반적인 범주는 2~3명, 매체·세대·지역적 변형처럼 서로 다른 학습 축을 비교해야 하는 핵심 범주만 최대 4명으로 둔다. 각 추가 화가는 대표 화가와 구별되는 중급 학습 이유가 있어야 한다.
- 표의 대표 화가와 더 볼 화가는 상단 도판 유무와 관계없이 `data-art-atlas-representative-section="works"`의 같은 `developmentId` 카드 묶음에 모두 포함한다. 표에 없는 화가로 카드를 채우지 않는다.
- 대표 화가 카드는 묶음의 첫 카드로 고정한다. 더 볼 화가 카드만 같은 묶음 안에서 드래그할 수 있고, 그 순서는 표의 `data-art-atlas-further-artists` 셀에 동기화한다.
- 더 볼 화가 카드 설명은 해당 작품에서 그 사조의 특징이 드러나는 부분과 그 화가만의 고유한 특성을 모두 설명한다. 선정 이유와 설명은 대표 카드와 동일한 편집 아이콘으로 나중에 수정할 수 있어야 한다.
- 여러 사조에 걸친 화가는 관련된 각 사조의 표와 카드에 모두 넣는다. 각 카드에는 다른 소속 사조를 명시하고, 여러 `developmentId`에 중복되는 모든 카드에 `data-art-atlas-duplicate-artist-reason`을 기록한다.
- `여러 국가에서의 전개` 표는 화가 리스트 오른쪽 화면의 국가별 세부 사조와 대표 화가를 정하는 정본이다. 표에서 국가·지역명, 세부 사조명, 기간 또는 대표 화가를 바꾸면 HTML만 고치고 끝내지 않는다. 같은 작업에서 `data/art-movements.json`의 해당 국가·세부 사조 행(이름·기간)을 맞추고, `data/artists.json`의 해당 화가 `regions`·`movementActivityCountry`·`movements`·`submovements`·활동 시작과 작품 연도를 검토·갱신한다. 그 결과 화가 리스트의 같은 세부 사조 상자와 화가 이름 상자가 표의 국가·지역·대표 화가와 일치하는지 실제 화면에서 확인한다. 근거가 부족한 화가·기간은 임의로 화가 리스트에 넣지 않고 표 또는 데이터 중 어느 쪽을 보류할지 기록한다.
- 국가 전개 표와 화가 목록에 동시에 연결된 대표·더 볼 화가의 로컬 이미지 일괄 보강은 사용자에게 해당 회차의 명시적 허락을 받은 경우에만 `tools/prepare-movement-table-artist-image-manifest.js`와 `tools/download-approved-movement-table-artist-images.js`를 사용한다. 두 스크립트는 `requireUrlFileDownloadApproval()`을 통과해야 하며, 작업 후에는 환경변수 승인값을 저장하지 않고 다음 다운로드부터 다시 허락을 받는다.
- `여러 국가에서의 전개` 표는 전수 목록이 아니다. 각 사조 문서를 초심자가 이해하는 데 꼭 필요한 국가별·지역별 핵심 세부 사조만 넣고, 보조적인 수용 지역·주변 사례·비교 설명은 본문 문단이나 패널에 둔다. 표에 넣는 순간 화가 리스트와 대표작 카드의 정본 행이 되므로, 독립 세부 사조 상자를 만들 의도가 없는 지역은 표 행으로 만들지 않는다.
- 대표작 카드는 국가·지역별 세부 전개별 독립 `.movement-work-grid`에 둔다. 카드의 `movement-card-activity-region`은 해당 지역과 일치해야 한다.
- 동기화 버전 1 카드 묶음의 제목은 `categoryId`로 정본 표시명을 읽고, 국가·지역 및 특징은 같은 `developmentId`의 표 행에서 읽는다. 동일한 지역·특징 문구를 카드마다 반복하지 않는다. 기존 무버전 문서의 `data-art-atlas-submovement` 국가명 부분일치 방식은 이관 전 읽기 호환에만 사용한다.
- 국가별 전개 표에서 별도 편집을 허용하는 사조는 `#countries`에 `data-art-atlas-country-feature-editor="country-development"` 식별자를 둔다. 해당 구역은 문서 가로 폭 전체를 사용하고, 국가·지역과 대표 화가 열은 내용이 한 줄로 유지되는 최소 폭으로 두며 특징 열에 나머지 폭을 배정한다. 편집 아이콘은 관리자에게만 각 특징 칸의 오른쪽 위에 표시하고, 읽기 전용에서는 아이콘·입력·저장·취소 제어를 렌더링하지 않는다. 관리자 편집은 `1. 제목` 아래 `- 불릿` 형식만 저장하며, 한 특징 칸은 최대 40줄로 제한한다. 읽기 상태에서는 번호 제목·불릿 목록을 왼쪽 정렬하고 표 셀은 세로 가운데 정렬한다. 저장 시 편집 제어 요소·전용 스타일은 HTML 원본에 남기지 않는다.
- 국가별 전개 표에서 국가·지역·특징·대표 화가처럼 병렬 컬럼을 비교하는 편집형 표는 각 컬럼 사이를 흰색 `1px` 실선으로 구분한다. 마지막 컬럼 오른쪽에는 추가 선을 그리지 않는다.
- 전체 사조 설명 문서의 국가 전개 표는 `국가·지역·세부 사조`·`지역적 특징`·`대표 화가·제작자`·`더 볼 화가` 4컬럼과 특징 목록 형식을 유지한다. 일괄 재생성에는 `node tools/rebuild-movement-representatives.js`를 사용하고 완료 후 대표·더 볼 셀과 카드 역할을 검증한다.
- 심화 카드 묶음에서 국가명 뒤에 자동 표시하는 `지역`·`특징` 설명(`.movement-country-card-context`)은 기본 `0.912rem`으로 둔다. 이는 1.14rem 기준을 80%로 낮춘 크기이며, 국가명과 설명의 위계를 유지하면서도 스크롤 없이 읽을 수 있어야 한다.
- 카드 DOM 순서는 국가별 미술 탭의 표시 순서다. 버전 1 `complete` 문서는 같은 `developmentId`에서 표의 대표·더 볼 화가 집합과 같은 역할의 카드 집합이 저장 전부터 각각 정확히 같아야 한다. 카드 드래그 저장으로 화가를 암묵적으로 추가·삭제하거나 대표 역할을 바꾸지 않는다.
- 버전 1 카드 드래그는 같은 `developmentId`의 `cardRole="further"` 카드끼리만 허용하고 표의 더 볼 화가 링크 순서를 같은 저장 트랜잭션에서 바꾼다. 대표 카드는 항상 첫 위치에 고정하며 다른 전개·범주로 화가를 옮길 때는 카드 드래그를 사용하지 않는다.
- 버전 1 `complete` 문서 저장은 현재 파일과 제출 DOM의 parent·category·development·country·artist·work ID를 먼저 비교한다. 특징, 선정 이유, 작품 설명과 같은 허용 필드 및 동일 전개 안의 카드 순서 외 구조 변경은 거부하며, 전체 hard 불변식을 통과한 HTML만 임시 파일을 거쳐 한 번 교체한다. 검증·기록 실패 시 화면의 카드와 표 순서를 모두 저장 전 상태로 되돌린다.
- 선정 이유와 작품 설명은 하나의 카드 편집 동작에서 각각 비어 있지 않은 값으로 저장한다. `imageState=pending` 카드도 텍스트 편집 대상이며, 이미지가 없다는 이유로 편집기나 화가 리스트 연동에서 제외하지 않는다.
- 한 화가는 기본적으로 한 문서의 한 `developmentId`에만 둔다. 서로 다른 작품으로 두 범주의 차이를 설명하는 데 대체 불가능해 중복할 때에는 모든 해당 카드에 `data-art-atlas-duplicate-artist-reason`으로 교육적 이유를 기록한다.
- 카드 첫 줄은 `화가명, 《작품명》 · 사조 · 지역` 순서로 쓴다.
- 카드의 화가 링크 대상은 `data-artist-id`와 같아야 하며, 작품명·연도·이미지는 `data-work-id`로 연결된 화가 연표 작품과 일치해야 한다. 같은 파일 여부는 경로 이름이 아니라 `data/image-catalog.json`의 SHA-256으로 검증한다.
- 카드의 대표작은 단순히 유명한 작품이 아니라 해당 국가·세부 사조의 색채, 빛, 공간, 주제, 후원·사교 환경을 가장 잘 설명하는 작품으로 고른다. 더 적합한 작품으로 교체할 때는 이미지·대체 텍스트·고해상도 경로·작품명·연도·활동 지역·설명을 한 번에 교체한다.
- 카드의 활동 지역은 작가의 현대 국적과 혼동하지 않는다. 작품 제작 당시의 역사적 국가·도시권을 쓸 때에는 표·카드·화가 작품 데이터의 맥락을 맞춘다.

## 이미지와 검증

- 로컬 이미지 또는 기존 내장 이미지만 사용하며 외부 이미지 URL·다운로드 의존을 새로 만들지 않는다. 화가별 로컬 썸네일을 카드에 재사용할 때는 상대 경로와 `data-art-atlas-highres`가 같은 로컬 자산을 가리키는지 확인한다.
- 화가 연표에 등록된 작품을 사조 대표작 카드나 본문 도판에 재사용할 때는 `data/images/artist-*/`의 정본 파일을 함께 사용한다. `data/미술사조/images/`에는 화가 작품 데이터와 연결되지 않는 사조 설명 전용 도판만 두며, 같은 바이트의 작품 이미지를 두 폴더에 중복 보관하지 않는다.
- 옛 사조 이미지 폴더에 화가 작품 또는 동일 바이트 복사본이 남았는지는 `node tools/migrate-legacy-artwork-images.js`로 확인한다. 캐시 `data/미술사조/images/index.json`의 실제 파일 없는 항목은 `node tools/prune-movement-image-index.js`로 검사하며, 필요할 때만 각 도구의 `--apply`로 정리한다.
- 사용자가 특정 작업에 한해 인터넷 이미지 다운로드를 명시적으로 승인한 경우에도 검토된 공개 라이선스 원본만 승인 목록에 작품별로 기록한 뒤 받는다. 화가마다 사조 특징을 설명할 대표작 1개를 우선하며 로컬 경로·원본 페이지·라이선스를 함께 보존한다. 공개 상태가 불명확하거나 적절한 도판을 확인하지 못한 카드는 다른 작품으로 임의 대체하지 않고 `다운로드 필요`로 남긴다.
- 승인 다운로드 도구는 `tools/url-download-permission.js`의 `requireUrlFileDownloadApproval()`을 호출하고, 실행 전 `node tools/check-url-download-approval.js`를 통과해야 한다. 묶음 다운로드에서는 성공한 항목을 즉시 기록해 뒤 항목의 실패가 이미 받은 파일과 출처 기록을 취소하지 않게 한다.
- `<img src="data:image/...">` 형태의 base64 인라인 이미지는 사조 HTML에 넣지 않는다. 사용해야 하는 기존 내장 이미지는 `data/미술사조/images/`의 로컬 파일로 분리한 뒤 상대 경로로 참조한다.
- 대표작 카드는 전체 폭 3열, 작은 화면 1열을 유지한다.
- 완료 전 `node tools/validate-movement-canonical.js`, `node tools/validate-movement-sync-contract.js`, `node tools/validate-movement-documents-v1.js`, `node tools/validate-movement-representatives.js`, `node tools/validate-cross-tab-linkage.js`, `node tools/validate-movement-image-paths.js`, `node tools/validate-movement-sync-v1-runtime.js`, `node tools/complete-movement-sync-v1.js`, `node tools/sync-movement-learning-guides.js --check`, `node tools/validate-movement-links.js`, `node --check server.js`, `npm test`, `git diff --check`를 실행한다. 사조 HTML 제공 경로나 서버 콘텐츠 서비스를 고쳤다면 서버 재시작 뒤 `node tools/check-app-http.js http://127.0.0.1:4173`으로 활성 문서와 이미지 응답을 확인한다.
