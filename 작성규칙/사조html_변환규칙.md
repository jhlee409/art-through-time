# 사조 설명 HTML 변환 규칙

기존 `data/미술사조/*.html`을 초심자 중심의 새 구조로 바꾸는 작업에 적용한다. 단순 문장 교정이나 작품 한 점의 교체에는 적용하지 않으며, 한 사조의 분류·길잡이·국가 전개 표·심화 카드를 함께 재구성할 때 사용한다.

## 시작 전 확인

1. `README.md`, `사조html_template_작성규칙.md`, `미술사조이해탭_작성규칙.md`를 먼저 읽는다.
2. 현재 정식 분류는 `data/art-movement-canonical.json`과 `data/art-movement-sync-contract.json`에서 확인한다.
3. 국가별 정식 범주만으로 초심자에게 충분히 설명되는지 먼저 판단한다. 충분하면 정식 `categoryId` 체계를 유지한다.
4. 국가·지역 분류가 화가의 실제 조형 지향을 왜곡할 때만 `data/art-movement-learning-map.json`에 기준점·주요 변주·비교 축을 둔다. 이는 정식 범주·국가별 사조 막대·정본 수를 늘리지 않는 학습용 예외다.
5. 한 회차에는 승인된 대상 사조만 바꾼다. 다른 사조 문서의 내용·카드·레이아웃을 함께 바꾸지 않는다.

## 분류와 내용 설계

- 사조의 공통 특징과 이전 사조와의 차이를 먼저 설명하고, 그 뒤 가장 뚜렷한 조형 기준점과 주요 변주를 제시한다.
- 기준점은 그 화가가 해당 사조 작품만 제작했다는 뜻이 아니다. 화가별 작품이 기준점의 어느 요소를 따르거나 교차하는지 작품 단위로 설명한다.
- 국적, 활동 도시, 후원 환경은 형성·활동 맥락으로 쓰며 조형 지향과 혼동하지 않는다.
- 특정 정치인·사건·후원자의 도상은 사조 전체 또는 화가 전체를 대표하는 새 분류가 아니라 여러 작품을 잇는 비교 축으로 둔다.
- 각 기준점·변주에는 대표 화가 1명과 그 성격을 가장 잘 보여 주는 대표작 1점을 둔다.

## 데이터와 HTML 반영 순서

1. 학습용 예외가 필요하면 학습 지도에 `learningNodeId`, 역할(`anchor`, `variation`, `comparison`), 기존 `canonicalCategoryId`, 화가·작품·설명을 기록한다.
2. `data/art-movement-learning-guides.json`에서 개요, 작품에서 볼 세 기준, 인접 사조와의 구분, 흔한 오해를 갱신한다.
3. 대상 HTML의 국가 전개 표와 심화 카드 묶음에 같은 `learningNodeId`를 붙인다. 정식 분류를 유지하는 문서는 기존 `categoryId`·`developmentId` 규약을 따른다.
4. `node tools/sync-movement-learning-guides.js`로 길잡이를 동기화한다. 길잡이 본문을 HTML에서만 고쳐 끝내지 않는다.
5. 화가·작품·이미지의 ID, 지역, 연도, 로컬 경로는 `data/artists.json`과 이미지 카탈로그의 정본에 맞춘다.

## 화면 구성

- 문서 본문·표·학습 길잡이는 화면 가로 전체를 사용하되 일반적인 좌우 여백을 둔다.
- 제목 위계는 큰 제목, 중간 제목, 작은 제목, 소제목, 본문 1, 본문 2의 기능을 문서 안에서 일관되게 쓴다.
- 학습 지도 사조의 길잡이는 기준점·주요 변주·비교 축으로 표시하며, 기존 국가명 핵심 범주 비교로 되돌리지 않는다.
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
