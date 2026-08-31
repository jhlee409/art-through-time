# 사조 설명 HTML 작성 규칙

이 문서는 `data/미술사조/*.html`에 새 사조 설명 HTML을 만들거나 기존 해시 HTML을 전면 재구축할 때 적용한다. 형식 기준은 `data/미술사조/신고전주의.html`이다. 내용은 각 사조에 맞게 새로 쓰되, 문서 모델, 연결 방식, 대표 미술가 표와 대표작 카드의 구조, 검증 절차는 신고전주의 문서와 같은 수준으로 맞춘다.

작업 전에는 README의 `작업 전 필수 작성규칙`, `AGENTS.md`, [새탭 template 작성 규칙](새탭_template_작성규칙.md), [미술사조 이해 탭 작성 규칙](미술사조이해탭_작성규칙.md)을 함께 확인한다.

## 문서 모델

- 새로 만들거나 전면 재구축하는 활성 사조 설명 HTML은 `data-art-atlas-document-model="artist-guide"`를 사용한다.
- `<html>`에는 최소한 `data-art-atlas-sync-version="1"`, `data-art-atlas-sync-state="complete"`, `data-art-atlas-parent-id`, `data-art-atlas-document-model="artist-guide"`, `data-art-atlas-learning-guide-version="1"`을 기록한다.
- 국가·지역은 작가 분류 기준으로 쓰지 않는다. `초심자 핵심` 대표 미술가를 먼저 두고, 이어서 `중급 확장` 미술가를 배치한다.
- 활동 국가는 작가의 이동, 후원 환경, 제도적 배경을 설명하는 참고 정보로만 쓴다.
- 명백히 성립한 화파, 작업실 계보, 선언적 집단이 있을 때만 별도 화파 표를 둔다. 단순 국가별 수용을 화파처럼 만들지 않는다.

## 기본 화면 형식

- `신고전주의.html`처럼 넓은 전체 폭 레이아웃을 사용한다. 본문을 좁은 카드나 랜딩 페이지처럼 만들지 않는다.
- 첫 화면은 사조명, 초심자용 요약, 핵심 명제를 바로 보여 준다.
- 상단에는 현재 사조명을 보여 주는 sticky nav를 둔다.
- `#movement-learning-guide`는 `data/art-movement-learning-guides.json`과 `data/art-movement-learning-map.json`의 학습 길잡이 구조를 따른다.
- 본문은 사조별 내용에 맞게 조정하되, 최소한 다음 흐름을 갖춘다: 사조 정의, 태동 배경, 확립 과정, 작품에서 볼 조형 기준, 대표 미술가 표, 대표작 카드, 인접 사조와의 차이, 참고 출처.
- 모바일에서는 표가 읽을 수 있는 단일 열 구조로 바뀌고, 카드와 이미지가 겹치거나 잘리지 않아야 한다.

## 태동·확립·비판의 2작품 비교

- 새로 만들거나 전면 재구축하는 모든 사조 설명 HTML에는 `태동`, `확립`, `비판과 전환`의 세 단계를 두고, 각 단계에 작품을 정확히 2점씩 나란히 배치한다. 따라서 역사 전개 비교 도판은 기본적으로 총 6개다.
- `태동`의 첫 작품은 새 사조가 문제 삼거나 벗어나려 했던 직전 사조·기존 시각 질서의 대표작이어야 한다. 둘째 작품은 새 사조 태동기의 해결책을 분명히 보여 주는 작품으로 정한다. 단절을 과장하지 말고 두 작품 사이에 계승된 요소와 달라진 요소를 함께 설명한다.
- `확립`의 두 작품은 같은 사조 안에서 초기 실험이 확립된 조형 언어로 진화하는 순서를 보여 주어야 한다. 단순히 유명한 작품 두 점을 놓지 말고 공간, 인체, 색채, 주제, 매체 또는 후원 기능 가운데 무엇이 발전했는지 비교 문장으로 명시한다.
- `비판과 전환`의 첫 작품은 다음 사조가 규범적 한계로 인식하거나 극복하려 했던 현 사조의 대표작으로 정한다. 둘째 작품은 다음 사조 초기의 대안적 특징을 가장 분명하게 보여 주는 작품으로 정한다.
- 여기서 `비판`은 실제 선언이나 문헌상의 비난이 확인되지 않는 경우 형식적 대응과 세대적 전환을 뜻한다. 후대 사조가 앞선 사조를 직접 비난했다고 근거 없이 단정하지 않는다.
- 각 비교 묶음은 `history-stage-grid`와 `data-art-atlas-visual-sequence="{parentId}-birth|{parentId}-establishment|{parentId}-transition"`을 사용한다. 각 작품은 `movement-history-stage`, 정본 `data-work-id`, 로컬 이미지, 작가·작품명, 연도, 단계상 역할, 작품 설명, 두 작품을 대조해 볼 관찰 지점을 포함한다.
- 이 여섯 작품은 역사 전개를 설명하는 비교 도판이므로 `movement-work-card`를 사용하지 않으며 대표 미술가 표·대표작 카드의 1:1 동기화 수량에 포함하지 않는다. 필요하면 대표작 카드와 같은 작품을 다시 사용할 수 있지만 각 단계의 비교 목적에 맞는 별도 설명을 쓴다.
- 외부 이미지 URL을 사용하지 않는다. 정본 로컬 이미지가 없으면 임의 작품으로 대체하지 말고 `이미지 업로드 예정` 상태로 남긴다.
- 각 단계의 작품 위 설명부는 `historical-stage-heading` 단일 박스로 구성한다. 단계 번호·역할을 나타내는 작은 표제, 부제목, 설명문을 위에서 아래 순서로 배치하고, 설명문은 부제목 다음 줄에서 박스 전체 폭으로 시작한다.
- 단계 설명부에서 부제목과 설명문을 좌우 2열로 나누지 않는다. 부제목 옆에 설명문을 붙이거나 화면 폭에 따라 두 영역이 한 줄에 늘어서게 만들지 않는다.
- 2열은 작품 비교 영역에만 적용한다. 데스크톱에서는 각 단계의 두 작품을 좌우 2열로, 모바일에서는 같은 순서를 유지한 단일 열로 표시한다.

## 대표 미술가 표

- 대표 미술가 표에는 학습 단계, 미술가와 분야, 주요 활동 국가, 미술가 고유의 특징, 사조 특징을 가장 잘 보여 주는 대표 작품과 연도를 적는다.
- 기본 표의 작가 순서는 학습 순서다. `초심자 핵심`을 먼저, `중급 확장`을 나중에 둔다.
- 르네상스처럼 공인된 시대 단계·화파·계보 자체를 비교하는 것이 핵심인 문서는 단계·화파 그룹을 먼저 묶고 각 그룹 안에서 출생 연도순으로 배열할 수 있다. 이때 학습 단계 표시는 유지하되 초심자·중급 배지가 그룹 정렬을 깨지 않으며, 대표작 카드도 표와 완전히 같은 그룹·작가 순서를 따른다.
- 시대 단계와 화파·계보가 함께 있는 문서는 전체 대표 미술가 표와 별도로 `명확히 확인되는 시대 단계와 화파·계보` 표를 둔다. 시대 단계와 화파는 배타적 분류가 아니며, 어느 하위 분류로 한정하기 어려운 작가는 상위 사조 공통 범주에 둔다.
- 표에 없는 작가를 대표작 카드 수를 채우기 위해 추가하지 않는다.
- 화가 목록에 등록된 미술가는 `artistId` 기반 연표 링크를 연결한다. 문자열 이름이 같다는 이유만으로 임의 연결하지 않는다.

## 대표작 카드

- 대표작 카드는 대표 미술가 표에 있는 미술가와 대표 작품을 같은 순서로 모두 포함한다.
- 카드는 전체 폭 3열 레이아웃을 기본으로 하며, 각 카드에는 이미지, 미술가명·작품명, 연도·사조 정보, 선정 이유, 작품 설명을 둔다.
- 작품 설명은 그 작품이 해당 사조의 조형 기준을 어떻게 보여 주는지 말해야 한다. 단순 전기 요약이나 유명도 설명으로 대체하지 않는다.
- 화가 및 작품 탭에 등록된 작품은 `artistId + workId`를 기준으로 연결하고, 이미지도 같은 정본 파일을 사용한다.
- 로컬 이미지가 없으면 외부 URL을 새로 연결하지 않고 `이미지 업로드 예정` 상태로 남긴다.

## 파일명과 색인 연결

- 새 사조 설명 HTML은 반드시 `신고전주의.html`처럼 사람이 식별할 수 있는 한국어 또는 영어 사조 이름을 파일명으로 사용한다. 해시 파일명으로 새 문서를 만들지 않는다.
- `data/미술사조/index.json`에서 해당 사조의 문서 키가 새 HTML 경로를 직접 가리키게 한다. 예: `"Neoclassicism": { "1": "data/미술사조/신고전주의.html" }`.
- `data/art-movement-canonical.json`의 `documentKey`, `data/art-movements.json`의 `canonical.documentOwnerId`, 앱의 `movementDocumentKey()` 흐름이 같은 문서 키로 이어지는지 확인한다.
- `미술 사조의 이해` 탭 오른쪽 사조 막대는 더블클릭 시 `app/app-atlas.js`의 막대 `dblclick` 이벤트에서 `openMovementDocument(...)`로 이동한다. 따라서 새 문서가 만들어진 뒤에는 해당 막대를 더블클릭하면 반드시 `data/미술사조/index.json`에 등록된 새 HTML만 열려야 한다.
- 이미 열려 있던 탭이 예전 경로를 쓰지 않도록 `/api/movement-documents`의 최신 응답과 `refreshMovementDocument()` 경로도 새 HTML을 반환해야 한다.

## 이전 해시 HTML 제거

- 기존 해시화 HTML을 새 이름 HTML로 전면 교체하는 작업에서는 이전 해시 HTML 파일을 활성 폴더에서 삭제한다.
- 이전 해시 경로는 `data/미술사조/index.json`, `data/미술사조/legacy-index.json`, 앱 코드, 서버 코드, 보조 데이터, 추적 문서, 일회성 도구 어디에서도 새 문서의 연결·fallback·redirect·대체 경로로 남기지 않는다.
- 해시 파일을 찾아 새 이름 HTML로 리다이렉트하는 호환 처리를 만들지 않는다.
- 기존 연결을 지운 뒤에는 이전 해시 파일명과 경로로 `rg` 검색을 실행해 참조가 남지 않았는지 확인한다.
- 단순 역사 기록으로 보관된 문서라도 새 활성 문서를 여는 기능에 영향을 주면 제거한다. 사용자가 "기존 연결을 철저히 삭제"하라고 요청한 전환 작업에서는 이력 색인보다 새 정본 연결을 우선한다.

## 동기화 대상

- 사조 설명 HTML만 단독으로 고쳐 끝내지 않는다. 필요한 경우 아래 정본 데이터를 함께 맞춘다: `data/art-movement-canonical.json`, `data/art-movement-learning-guides.json`, `data/art-movement-learning-map.json`, `data/art-movement-representatives.json`, `data/art-movements.json`, `data/artists.json`, `data/artists-index.json`, `data/image-catalog.json`.
- 학습 길잡이 문장은 HTML에 직접만 쓰지 않고 `data/art-movement-learning-guides.json`을 원본으로 동기화한다.
- 대표 미술가와 대표작 정보는 `data/art-movement-representatives.json`의 `artistId`, `workId`, 선정 이유와 맞춘다.
- 국가별 사조 막대는 역사 비교용 위치 정보다. 사조 설명 문서의 작가 분류를 국가별 막대 구조에 맞춰 만들지 않는다.

## 검증

- 새 HTML 파일 존재와 이전 해시 파일 부재를 확인한다: `Test-Path`, `Get-ChildItem data/미술사조 -Filter *.html`, 이전 해시 경로 `rg`.
- 색인 연결을 확인한다: `data/미술사조/index.json`의 해당 문서 키가 새 HTML만 가리키는지 확인한다.
- 막대 더블클릭 연결을 확인한다: 해당 사조 막대 이름이 `movementDocumentKey()`로 문서 키에 정규화되고, `openMovementDocument()`가 새 HTML URL을 여는지 확인한다.
- 실행 권장 검증: `node tools/validate-movement-canonical.js`, `node tools/validate-movement-sync-contract.js`, `node tools/validate-movement-documents-v1.js`, `node tools/validate-cross-tab-linkage.js`, `node tools/validate-movement-image-paths.js`, `node tools/sync-movement-learning-guides.js --check`, `node tools/validate-movement-links.js`, `npm test`, `git diff --check`.
- 사조 HTML 제공 경로, 서버 보강, 색인 응답을 바꿨다면 서버 재시작 뒤 `node tools/check-app-http.js http://127.0.0.1:4173` 또는 `npm run test:http`로 새 HTML이 HTTP 200인지 확인한다.

## 완료 보고

- 완료 보고에는 참고한 작성규칙, 새 HTML 경로, 삭제한 이전 해시 HTML 경로, 갱신한 색인·정본 데이터, 실행한 검증과 실패한 검증의 이유를 남긴다.
- 사조 HTML을 수정했지만 이 규칙 파일에 추가할 새 기준이 없었다면, 기존 규칙을 그대로 적용한 단순 데이터·문구 변경임을 명시한다.
