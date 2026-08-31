# 사조 설명 HTML 변환 규칙

기존 `data/미술사조/*.html`을 초심자 중심의 새 구조로 바꾸는 작업에 적용한다. 단순 문장 교정이나 작품 한 점의 교체에는 적용하지 않으며, 한 사조의 분류·길잡이·국가 전개 표·심화 카드를 함께 재구성할 때 사용한다.

## 시작 전 확인

1. `README.md`, `사조html_template_작성규칙.md`, `미술사조이해탭_작성규칙.md`를 먼저 읽는다.
2. 현재 정식 분류는 `data/art-movement-canonical.json`과 `data/art-movement-sync-contract.json`에서 확인한다.
3. 새로 만들거나 전면 재구축하는 문서는 `data-art-atlas-document-model="artist-guide"`를 사용하고 국가·지역별 분류를 만들지 않는다. 기존 국가 전개형 정본 데이터는 해당 사조와 연결 탭이 새 모델로 이관될 때까지 호환 데이터로만 유지한다.
4. 대표 미술가는 `초심자 핵심`을 먼저 선정하고, 더 깊은 맥락이 필요한 미술가는 `중급 확장`으로 추가한다. 활동 국가와 도시는 이동·교육·후원 환경을 설명하는 정보이며 학습 단계나 카드 묶음의 분류 키가 아니다.
5. 한 회차에는 승인된 대상 사조만 바꾼다. 다른 사조 문서의 내용·카드·레이아웃을 함께 바꾸지 않는다.

## 분류와 내용 설계

- 사조의 공통 특징과 이전 사조와의 차이를 먼저 설명하고, 그 뒤 가장 뚜렷한 조형 기준점과 주요 변주를 제시한다.
- 기준점은 그 화가가 해당 사조 작품만 제작했다는 뜻이 아니다. 화가별 작품이 기준점의 어느 요소를 따르거나 교차하는지 작품 단위로 설명한다.
- 국적, 활동 국가·도시, 후원 환경은 형성·활동 맥락으로만 쓰며 미술가를 묶는 분류로 사용하지 않는다.
- 특정 정치인·사건·후원자의 도상은 사조 전체 또는 화가 전체를 대표하는 새 분류가 아니라 여러 작품을 잇는 비교 축으로 둔다.
- 초심자 핵심과 중급 확장의 각 미술가에는 그 성격을 가장 잘 보여 주는 대표작 1점을 둔다.

## 데이터와 HTML 반영 순서

1. 문서 루트에 `data-art-atlas-document-model="artist-guide"`를 기록하고 대표 미술가 표 행과 작품 카드에 같은 `artistId`, `workId`, 학습 단계(`beginner` 또는 `intermediate`)를 기록한다.
2. `data/art-movement-learning-guides.json`에서 개요, 작품에서 볼 세 기준, 인접 사조와의 구분, 흔한 오해를 갱신한다.
3. 대상 HTML에는 국가 전개 표를 만들지 않는다. 대표 미술가 표와 대표작 카드의 미술가·작품 집합 및 순서를 같게 하고, 활동 국가는 텍스트 정보로만 표시한다.
4. `node tools/sync-movement-learning-guides.js`로 길잡이를 동기화한다. 길잡이 본문을 HTML에서만 고쳐 끝내지 않는다.
5. 화가·작품·이미지의 ID, 지역, 연도, 로컬 경로는 `data/artists.json`과 이미지 카탈로그의 정본에 맞춘다.

## 화면 구성

- 문서 본문·표·학습 길잡이는 화면 가로 전체를 사용하되 일반적인 좌우 여백을 둔다.
- 제목 위계는 큰 제목, 중간 제목, 작은 제목, 소제목, 본문 1, 본문 2의 기능을 문서 안에서 일관되게 쓴다.
- 학습 길잡이는 공통 조형 특징과 대표 미술가의 차이를 표시하며 국가명 핵심 범주 비교로 되돌리지 않는다.
- 학습 지도 항목의 제목, 형성 맥락, 핵심 특징은 각 `learningNodeId`의 원문을 표시한다. 같은 `categoryId`라는 이유로 CSS 의사 요소나 서버 보정으로 공통 제목을 덮어쓰지 않는다.
- 문장 안의 단어·조사가 분리되어 읽히지 않게 `word-break: keep-all`을 적용한다. 데스크톱에서는 짧은 설명 한 문장이 한 줄로 유지되는지 확인한다.
- 심화 카드의 이미지 영역 크기와 카드 내부 정보 구조는 바꾸지 않는다. 작품 이미지는 검은 이미지 영역 안에서 원본 비율을 유지하며 긴 변이 약 90%를 사용한다.
- 학습 지도 카드가 여러 개면 넓은 화면 3열, 중간 화면 2열, 작은 화면 1열을 사용한다. 각 열의 제목·맥락·카드는 그 열 안에서만 배치한다.

## 검증과 기록

```powershell
node tools/sync-movement-learning-guides.js --check
node tools/validate-movement-canonical.js
node tools/validate-movement-sync-contract.js
node tools/validate-movement-documents-v1.js
node tools/validate-movement-representatives.js
node tools/validate-cross-tab-linkage.js
node tools/validate-movement-links.js
npm test
git diff --check
```

`server-content.js`나 HTML 제공 경로를 고쳤다면 서버를 재시작한 뒤 `node tools/check-app-http.js http://127.0.0.1:4173`도 실행한다. 완료한 변환은 `node tools/record-change.js`로 기록하고, 새로 생긴 재사용 규칙은 이 문서와 `사조html_template_작성규칙.md`에 함께 반영한다.
