# Art Through Time

Art Through Time은 미술사 초심자가 작품과 화가를 외우기 전에 **시대 흐름, 국가별 전개, 사조 차이, 작품에서 보이는 시각적 근거**를 함께 이해하도록 돕는 로컬 학습 앱입니다.

## 학습 흐름

1. `미술 사조의 이해`에서 1400년 이후의 큰 흐름을 국가별로 비교합니다.
2. 사조 설명 문서에서 핵심 시각 기준과 인접 사조의 차이를 익힙니다.
3. `국가별 미술`에서 한 국가 안의 전개와 대표작을 연결합니다.
4. `화가 리스트`, `화가 및 작품`에서 화가·작품·시기별 흐름을 살펴봅니다.
5. `기법·용어`, `주제·사건`에서 작품을 읽는 개념과 도상 맥락을 보충합니다.

## 빠른 실행

Node.js 20 이상이 필요합니다. Windows에서는 `Art_through_Time.cmd`를 더블클릭하거나 터미널에서 실행합니다.

```powershell
npm start
```

기본 주소는 `http://127.0.0.1:4173/?login=1`입니다.

`Art_through_Time.cmd`는 4173 포트에 서버가 있으면 기존 서버를 사용하고, 새 서버 로그를 `logs/`에 남깁니다.

## 주요 화면

| 화면 | URL | 역할 |
| --- | --- | --- |
| 미술 사조의 이해 | `/?movementPopup=1` 또는 루트 기본 화면 | 1400년 이후 국가별 사조와 역사 사건 비교 |
| 국가별 미술 | `/?countryArt=1` | 한 국가에서 1400~1950년과 겹치는 모든 정규 사조 막대와 대표작 비교 |
| 화가 리스트 | `/?artistList=1` | 국가 전개 표에 연결된 세부 범주의 대표 화가와 더 볼 화가 비교 |
| 화가 및 작품 | `/?artists=1` | 화가별 대표작, 전체 작품, 시기별 연표 |
| 기법·용어 | 전용 탭 버튼 | 제작 기법과 미술 용어 |
| 주제·사건 | 전용 탭 버튼 | 반복 주제·도상·사건과 연결 작품 |

모든 탭은 `한 · u · 표` 이름 표기, 관리자 세션, 로그아웃 신호, 탭 이동 규칙을 공유합니다.

## 현재 사조 체계

사조 체계의 정본은 [`data/art-movement-canonical.json`](data/art-movement-canonical.json)입니다.

| 항목 | 수량 |
| --- | ---: |
| 부모 사조 | 44개 |
| 독립 설명 문서를 가진 부모 사조 | 34개 |
| 상위 문서에서 설명하는 흡수형 부모 사조 | 10개 |
| 이전 미술 참고 문서 | 2개 |
| 활성 사조 설명 문서 | 36개 |
| 초심자 핵심 범주 | 68개 |

후기 비잔틴 미술과 고딕 미술은 1400년 무렵의 연결 맥락만 제공하며 부모 사조 수에 포함하지 않습니다. 68개 핵심 범주의 이름은 사조 문서의 국가 전개 표, 대표작 카드 범주, 화가 리스트의 세부 범주에서 동일하게 사용합니다.

범주 연결은 표시 문자열이 아니라 `parentId`, `categoryId`, `developmentId`, `artistId`, `workId` 같은 ID로 처리합니다. 활성 문서는 [`data/미술사조/index.json`](data/미술사조/index.json), 활성 체계에서 제외한 기존 문서는 [`data/미술사조/legacy-index.json`](data/미술사조/legacy-index.json)에서 관리합니다.

## 데이터 원본

같은 내용을 여러 파일에서 따로 고치지 않습니다. 아래 원본을 먼저 수정하고 연결 화면을 동기화합니다.

| 원본 | 소유 내용 |
| --- | --- |
| `data/art-movement-canonical.json` | 부모 사조, 핵심 범주, 문서 역할과 표시 순서 |
| `data/art-movement-sync-contract.json` | 표·카드·화가 리스트의 ID 기반 동기화 규약 |
| `data/art-movement-learning-guides.json` | 활성 사조 문서의 초심자 학습 길잡이 원문 |
| `data/art-movement-representatives.json` | 핵심 범주의 특징, 대표 화가·더 볼 화가, 작품과 선정 이유 |
| `data/art-movements.json` | 국가별 사조 막대, 기간, 정본 연결 ID |
| `data/미술사조/*.html` | 국가 전개 표, 지역 특징, 대표·더 볼 화가 링크와 작품 카드 |
| `data/artists.json` | 화가와 작품의 전체 원본 |
| `data/artists-index.json` | 화면 로딩용 화가 색인 |
| `data/image-catalog.json` | 이미지 경로, 작품 ID·QID, 제목·연도, SHA-256과 이전 경로 별칭을 모은 전역 검색 색인 |
| `data/country-art-events.json` | 국가별 미술 사건 |
| `data/country-movement-backgrounds.json` | 국가별 사조 태동 배경과 사건 ID 연결 |
| `data/techniques.json` | 기법·용어와 대표 사례 |
| `data/topics.json` | 주제·사건과 연결 작품 |

사조 HTML의 `여러 국가에서의 전개` 표는 화가 리스트에 표시할 국가별 범주, 대표 화가 1명, 더 볼 화가 1~4명의 화면 정본입니다. 같은 `developmentId`의 카드 묶음은 표와 역할별 화가 집합 및 순서가 같아야 합니다.

학습 길잡이 문장은 HTML에서 직접 고쳐 끝내지 않습니다.

```powershell
node tools/sync-movement-learning-guides.js
node tools/sync-movement-learning-guides.js --check
```

## 이미지 원칙

- 화면 이미지는 프로젝트의 로컬 파일만 사용합니다.
- 화가 작품은 `data/images/`에 둡니다. 고해상도 전용 `data/high-resolution/` 폴더는 사용하지 않습니다.
- 기존 이미지 파일은 일괄 개명하지 않고 `data/image-catalog.json`에서 `legacy`로 보존합니다. 수정·교체하는 파일만 점진적으로 표준명으로 전환합니다.
- 새 화가 작품 이미지는 `data/images/artist-id/간략이름_제목3단어_시작연도__workId.ext` 형식을 사용합니다. 작가명·작품명·연도·`workId`가 확정되지 않으면 임의 이름으로 등록하지 않고 대기 상태를 유지합니다.
- 이미지 연결의 기준은 파일명이 아니라 `artistId + workId`이며, 동일 파일 판정에는 SHA-256을 사용합니다. 파일명은 사람이 찾기 위한 보조 정보입니다.
- 이미지를 추가·교체·삭제한 뒤 `node tools/build-image-catalog.js`를 실행해 전역 색인을 갱신합니다. 새 비표준 파일명이나 카탈로그와 디스크의 불일치는 `npm test`에서 실패합니다.
- 다운로드 전에 `node tools/find-artwork-image.js`로 작가명·작품명·QID·`workId`·SHA-256을 검색합니다. 로컬 일치 파일이 있으면 외부 다운로드보다 기존 파일 연결을 복구합니다.
- 사조 이미지는 `data/미술사조/images/`, 기법 이미지는 `data/techniques/`, 주제 이미지는 `data/topic-images/`에 둡니다.
- 사용자가 "다운로드 폴더"라고 말하면 프로젝트 루트의 `다운로드용/`만 확인합니다.
- 로컬 파일이 없으면 외부 이미지 URL을 만들지 않고 `이미지 업로드 예정` 상태를 유지합니다.
- URL에서 이미지 파일을 찾거나 응답을 파일로 저장하는 작업은 대상 사이트와 파일을 밝히고 사용자의 명시적 승인을 받은 뒤에만 수행합니다.
- URL 다운로드 도구를 만들 때는 `tools/url-download-permission.js`의 승인 가드를 사용하고 `node tools/check-url-download-approval.js`를 통과해야 합니다.
- 수동 등록 작품의 `origin: "manual"`은 자동 정리 과정에서도 보존합니다.

대기 중인 로컬 이미지는 다음 순서로 확인합니다.

```powershell
node tools/check-pending-local-images.js
node tools/import-pending-local-images.js
```

이미지 카탈로그를 검색하고 갱신하는 기본 명령은 다음과 같습니다.

```powershell
node tools/find-artwork-image.js --artist "미켈란젤로" --title "최후의 심판"
node tools/find-artwork-image.js --qid Q4340473
node tools/build-image-catalog.js
node tools/build-image-catalog.js --check
```

## 로그인과 권한

- 보기 모드는 자료를 조회하지만 저장·삭제 기능을 사용할 수 없습니다.
- 관리자 모드는 화가, 작품, 사조 설명, 기법, 주제 자료를 편집할 수 있습니다.
- `.env`가 없거나 로그인을 건너뛰면 보기 모드로 동작합니다.
- 새 환경에서는 [`.env.example`](.env.example)을 참고해 `.env`를 만들고 관리자 정보를 설정합니다.
- `.env`의 실제 값은 Git, 문서, 변경 기록에 남기지 않습니다.

## 검증

전체 정적 검사, JSON 파싱, 링크·데이터 불변식, 사조 동기화 검사는 다음 한 명령으로 실행합니다.

```powershell
npm test
```

OneDrive 이미지 보조 색인과 실행 중인 로컬 서버까지 확인할 때는 다음 검사를 추가합니다.

```powershell
node tools/validate-project-linkage.js --image-indexes
node tools/check-app-http.js http://127.0.0.1:4173
```

사조 정본이나 설명 문서를 바꾼 작업에서는 필요한 경우 아래 검사를 개별 실행합니다.

```powershell
node tools/validate-movement-canonical.js
node tools/validate-movement-sync-contract.js
node tools/validate-movement-documents-v1.js
node tools/validate-movement-representatives.js
node tools/validate-movement-sync-v1-runtime.js
node tools/complete-movement-sync-v1.js
node tools/sync-movement-learning-guides.js --check
node tools/validate-movement-links.js
```

사조 HTML 제공 경로나 서버 콘텐츠 코드를 바꾸면 서버를 재시작한 뒤 활성 36개 문서를 HTTP로 확인합니다.

```powershell
node tools/check-movement-http.js http://127.0.0.1:4173
```

마지막으로 문서와 코드의 공백 오류를 확인합니다.

```powershell
git diff --check
```

검증을 마친 변경은 Asia/Seoul 날짜의 변경 기록에 남깁니다.

```powershell
node tools/record-change.js --section "섹션 이름" --item "변경 내용"
```

## 작성 규칙

작업 전 저장소 전체 규칙인 [`AGENTS.md`](AGENTS.md)를 확인하고, 수정하는 화면에 맞는 작성규칙 문서를 적용합니다. 규칙이 충돌하면 더 구체적인 탭 문서를 따르되, 정본 JSON과 동기화 계약의 ID·데이터 소유권을 우선합니다.

| 문서 | 책임 |
| --- | --- |
| [공통 탭 구조](작성규칙/공통_탭구조.md) | 공통 사이드바, 탭 이동, 인증, 모듈 경계, 로컬 자산, 공통 검증 |
| [미술사조 이해 탭](작성규칙/미술사조이해탭_작성규칙.md) | 1400년 이후 학술 사조 지도, 44개 부모 사조와 이전 미술 참고 표시 |
| [사조 HTML](작성규칙/사조html_template_작성규칙.md) | 활성 36개 설명 문서, 68개 범주, 학습 길잡이, 국가 전개 표와 대표작 카드 |
| [국가별 미술 탭](작성규칙/국가별미술탭_작성규칙.md) | 한 국가의 연표, 사건·배경, 사조 HTML 대표작의 읽기 전용 표시 |
| [화가 리스트 탭](작성규칙/화가리스트탭_작성규칙.md) | 국가 전개 표의 `developmentId`별 범주와 대표 화가 생애 배치 |
| [화가 및 작품 탭](작성규칙/화가및작품탭_작성규칙.md) | 화가·작품 원본, 작품 연표, 수동 이미지와 대표작 연결 |
| [기법 및 용어 탭](작성규칙/기법및용어탭_작성규칙.md) | 기법·용어 분류, 정의, 로컬 대표 사례 |
| [주제·사건 탭](작성규칙/주제사건탭_작성규칙.md) | 주제·도상·사건과 로컬 작품 자료 |

다른 사조·화가·탭에도 다시 적용할 규칙, 예외, 레이아웃 표준, 검증 절차가 생기면 해당 작성규칙 문서를 같은 작업에서 갱신합니다. 한 작품명이나 한 문장처럼 일회성인 데이터 교정은 작성규칙에 넣지 않습니다.

## 저장소 관리

코드, JSON, 사조 HTML, 문서는 Git으로 관리합니다. `.env`, 로그, 로컬 이미지, 백업, 배포 결과물은 Git에 올리지 않습니다. 이미지 폴더가 Junction인 환경에서는 저장소 이동·백업 시 실제 대상 폴더도 별도로 확인합니다.

Firebase 관련 코드는 향후 이관 준비용입니다. 현재 운영 데이터의 원본은 로컬 JSON이며 외부 서비스로 자동 전송하지 않습니다. 자세한 내용은 [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)를 참고합니다.
