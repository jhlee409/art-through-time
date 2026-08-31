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

## 작업 전 필수 작성규칙

코드, JSON, HTML, 이미지, 문서를 수정하기 전에는 반드시 저장소 전체 규칙과 작업 대상에 맞는 작성규칙을 먼저 확인합니다. README는 길잡이이고, 실제 세부 기준은 `작성규칙/` 문서가 우선입니다.

1. [`AGENTS.md`](AGENTS.md)를 확인합니다.
2. [`작성규칙/새탭_template_작성규칙.md`](작성규칙/새탭_template_작성규칙.md)를 확인합니다.
3. 수정 대상 화면·데이터·문서에 해당하는 아래 작성규칙을 함께 확인합니다. 새 탭을 만드는 작업은 먼저 새 탭 템플릿의 기본 구성과 인증·동기화·검증 기준을 갖춘 뒤 구체적인 탭 기능을 구현합니다.
4. 완료 보고에 참고한 작성규칙, 적용한 관리자 예외 여부, 실행한 검증을 남깁니다.

작업 중 재사용할 규칙, 레이아웃 기준, 검증 절차, 이미지 보관 원칙이 새로 생기면 같은 변경에서 이 README와 관련 `작성규칙/` 문서를 갱신합니다. 특정 작품명·화가명 교정처럼 한 번만 쓰는 내용은 변경 기록에 남기고, 다른 화면에도 반복 적용할 기준만 작성규칙으로 올립니다.

관리자가 작성규칙의 분류·대표작·문구·파일명·화면 구성 기준과 다른 지시를 하면, 어떤 규칙과 충돌하는지 먼저 밝히고 이 작업에 한해 그대로 진행할지 확인합니다. 관리자가 명확히 확인하면 관리자 예외로 진행하고, 완료 보고에 예외 적용 사실과 검증 결과를 남깁니다. 단, 외부 URL 이미지 다운로드 승인, 시스템·보안·권한 절차, 저작권·개인정보·파괴적 명령 승인 같은 상위 규칙은 이 예외로 생략하지 않습니다.

| 작업 대상 | 반드시 함께 확인할 작성규칙 |
| --- | --- |
| 새 탭 기본 구성, 공통 사이드바, 탭 이동, 인증, 공용 레이아웃 | [새탭 template 작성 규칙](작성규칙/새탭_template_작성규칙.md) |
| 미술 사조의 이해 탭, 사조 막대, 역사 사건 | [미술사조 이해 탭](작성규칙/미술사조이해탭_작성규칙.md), [사조 HTML](작성규칙/사조html_template_작성규칙.md) |
| 기존 사조 설명 HTML의 분류·길잡이·표·심화 카드 재구성 | [사조 HTML 변환 규칙](작성규칙/사조html_변환규칙.md), [사조 HTML](작성규칙/사조html_template_작성규칙.md), [미술사조 이해 탭](작성규칙/미술사조이해탭_작성규칙.md) |
| 사조 설명 HTML, 국가 전개 표, 심화 대표작 카드 | [사조 HTML](작성규칙/사조html_template_작성규칙.md), [미술사조 이해 탭](작성규칙/미술사조이해탭_작성규칙.md) |
| 국가별 미술 탭 | [국가별 미술 탭](작성규칙/국가별미술탭_작성규칙.md), [사조 HTML](작성규칙/사조html_template_작성규칙.md) |
| 화가 리스트 탭 | [화가 리스트 탭](작성규칙/화가리스트탭_작성규칙.md), [사조 HTML](작성규칙/사조html_template_작성규칙.md) |
| 화가 및 작품 탭, 작품 연표, 작품 이미지 | [화가 및 작품 탭](작성규칙/화가및작품탭_작성규칙.md), [화가 설명](작성규칙/화가설명_작성규칙.md) |
| 화가 해설 업데이트, 자료 링크, 작품명 연결 | [화가 설명](작성규칙/화가설명_작성규칙.md), [화가 및 작품 탭](작성규칙/화가및작품탭_작성규칙.md) |
| 기법·용어 탭 | [기법 및 용어 탭](작성규칙/기법및용어탭_작성규칙.md) |
| 주제·사건 탭 | [주제·사건 탭](작성규칙/주제사건탭_작성규칙.md) |

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
| `data/art-movement-learning-map.json` | 정식 범주와 별개인 기준점·주요 변주·비교 축 학습 지도 |
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

사조 HTML의 `여러 국가에서의 전개` 표는 화가 리스트에 표시할 국가별 범주, 대표 화가 1명, 더 볼 화가 1~4명의 화면 정본입니다. 같은 `developmentId`의 카드 묶음은 표와 역할별 화가 집합 및 순서가 같아야 합니다. 단 `data-art-atlas-learning-node-id`가 있는 행은 `data/art-movement-learning-map.json`의 기준점·주요 변주 학습 항목이며, 정식 범주 수나 국가별 사조 막대의 정본 연결을 늘리지 않습니다.

국가 전개 행을 바꿀 때는 HTML만 수정하지 않습니다. 같은 작업에서 `data/art-movements.json`의 국가·기간·정본 연결, `data/artists.json`의 화가·작품·활동 지역, `data/art-movement-representatives.json`의 카드 정보를 맞춥니다. `node tools/validate-cross-tab-linkage.js`는 이 연결이 국가별 미술·화가 리스트·화가 연표까지 이어지는지 전수 검사합니다.

학습 길잡이 문장은 HTML에서 직접 고쳐 끝내지 않습니다.

```powershell
node tools/sync-movement-learning-guides.js
node tools/sync-movement-learning-guides.js --check
```

## 이미지 원칙

- 화면 이미지는 프로젝트의 로컬 파일만 사용합니다.
- 화가 작품은 `data/images/`에 둡니다. 고해상도 전용 `data/high-resolution/` 폴더는 사용하지 않습니다.
- 기존 이미지 파일은 일괄 개명하지 않고 `data/image-catalog.json`에서 `legacy`로 보존합니다. 수정·교체하는 파일만 점진적으로 표준명으로 전환합니다.
- 새 화가 작품 이미지는 `data/images/artist-*/간략이름_제목3단어_시작연도__workId.ext` 형식을 사용합니다. 여기서 `artist-*`는 실제 화가 ID 폴더입니다. 작가명·작품명·연도·`workId`가 확정되지 않으면 임의 이름으로 등록하지 않고 대기 상태를 유지합니다.
- 이미지 연결의 기준은 파일명이 아니라 `artistId + workId`이며, 동일 파일 판정에는 SHA-256을 사용합니다. 파일명은 사람이 찾기 위한 보조 정보입니다.
- 이미지를 추가·교체·삭제한 뒤 `node tools/build-image-catalog.js`를 실행해 전역 색인을 갱신합니다. 새 비표준 파일명이나 카탈로그와 디스크의 불일치는 `npm test`에서 실패합니다.
- 다운로드 전에 `node tools/find-artwork-image.js`로 작가명·작품명·QID·`workId`·SHA-256을 검색합니다. 로컬 일치 파일이 있으면 외부 다운로드보다 기존 파일 연결을 복구합니다.
- 화가 연표에 등록된 작품은 사조·국가별 미술·기법·주제 화면에서도 `data/images/artist-*/`의 같은 정본 파일을 재사용합니다. `data/미술사조/images/`, `data/techniques/`, `data/topic-images/`에는 각 설명에만 쓰고 화가 작품과 연결되지 않는 전용 도판만 둡니다.
- 같은 바이트의 이미지를 여러 자산 폴더에 중복 보관하지 않습니다. 사조 폴더나 다른 화면 전용 폴더에 더 깔끔한 화가 작품 파일이 있으면 그 파일을 `data/images/artist-*/` 표준명 정본으로 옮기고, HTML·JSON·카탈로그·마이그레이션 참조를 모두 새 정본 경로로 맞춥니다. 이전 경로는 새 참조로 남기지 않고 필요하면 `data/image-catalog.json`의 `legacy` 별칭으로만 추적합니다.
- `data/미술사조/images/`에 화가 작품이 섞였는지는 `node tools/migrate-legacy-artwork-images.js`, 사조 이미지 캐시의 무효 경로는 `node tools/prune-movement-image-index.js`로 확인합니다.
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

### 화가 해설 업데이트

`화가 및 작품`의 화가 이름 옆 `+`로 유튜브 또는 블로그 주소를 추가한 뒤, 화가 해설 오른쪽 위의 `업데이트`를 누르면 아직 반영하지 않은 링크만 읽어 연도·나이순 해설로 병합합니다. 유튜브 링크가 있으면 `스크립트` 버튼이 함께 나타납니다. 이 버튼에서 링크를 선택하고 유튜브의 `스크립트 표시` 내용을 붙여넣어 저장하거나 수정·삭제할 수 있습니다. 저장 스크립트는 최대 80,000자이며 같은 링크의 자동 자막이나 영상 설명보다 우선 사용됩니다. 저장 후 내용이 바뀐 스크립트는 다음 `업데이트`에서 새 자료로 다시 반영됩니다.

저장 스크립트가 없을 때 유튜브는 공개 자막을 우선 사용하고, 자막 본문을 받을 수 없으면 충분한 길이의 영상 설명란을 사용합니다. 영상 파일이나 음원은 내려받지 않습니다. 블로그는 화면의 텍스트 본문을 사용합니다. 이 기능은 링크 텍스트를 구조화된 연표로 정리하기 위해 OpenAI API를 사용합니다. `업데이트`를 누르면 새 링크 또는 저장 스크립트의 텍스트와 중복 확인에 필요한 기존 해설을 전송한다는 확인창이 먼저 열리고, 동의한 경우에만 요청합니다. 외부 웹 자료는 추가 검색하지 않습니다. `.env`에 `OPENAI_API_KEY`를 설정하고 서버를 다시 시작해야 하며, 필요하면 `ART_ATLAS_SUMMARY_MODEL`로 모델을 바꿀 수 있습니다. 생성 결과는 출처명과 `연도 미상` 문구 없이 연도·나이순으로 표시되며 기존 `편집` 기능으로 직접 교정할 수 있습니다.

업데이트는 기존 해설을 기본 자료로 보존합니다. 의미가 같은 내용은 한 항목으로 합치고, 새 자료에 나오지 않는 기존 내용은 삭제하지 않습니다. 새 자료와 기존 해설이 양립할 수 없다고 판단되면 바로 저장하지 않고 항목별로 `새 자료로 교체` 또는 `기존 해설 유지`를 확인합니다. 연도와 나이가 확인된 항목을 먼저 정렬하고 날짜가 확인되지 않은 기존 항목은 `[확인 필요]`로 표시해 뒤에 둡니다. 새 링크가 없거나 새 자료에서 추가할 해설을 찾지 못하면 `추가할 자료가 없습니다.`라고 안내합니다. 해설은 기본 4줄만 표시되며 `업데이트` 오른쪽 화살표로 전체 내용을 펼치거나 접을 수 있습니다. 펼칠 때에는 현재 작품·이미지 목록을 다시 대조해 작품명 링크를 갱신합니다. 링크를 누르면 화면 중앙의 원본 비율 이미지 박스를 엽니다. 이미지의 긴 변은 화면 가로·세로 한도의 40%에 맞고 이미지를 더블클릭하면 닫힙니다.

## 검증

전체 정적 검사, JSON 파싱, 링크·데이터 불변식, 사조 동기화 검사는 다음 한 명령으로 실행합니다.

```powershell
npm test
```

OneDrive 이미지 보조 색인·파일 해시와 실행 중인 로컬 서버까지 확인할 때는 다음 검사를 추가합니다. 로컬 서버 검사를 제외한 심화 검증은 `npm run test:deep`으로, 실행 중인 서버 HTTP 검사는 `npm run test:http`로 실행할 수 있습니다.

```powershell
node tools/validate-project-linkage.js --image-indexes
node tools/build-image-catalog.js --check --hashes
node tools/check-app-http.js http://127.0.0.1:4173
npm run test:deep
npm run test:http
```

사조 정본이나 설명 문서를 바꾼 작업에서는 필요한 경우 아래 검사를 개별 실행합니다.

```powershell
node tools/validate-movement-canonical.js
node tools/validate-movement-sync-contract.js
node tools/validate-movement-documents-v1.js
node tools/validate-movement-representatives.js
node tools/validate-cross-tab-linkage.js
node tools/validate-movement-image-paths.js
node tools/validate-movement-sync-v1-runtime.js
node tools/complete-movement-sync-v1.js
node tools/sync-movement-learning-guides.js --check
node tools/validate-movement-links.js
```

사조 HTML 제공 경로나 `server-content.js`의 서버 주입 코드를 바꾸면 서버를 재시작합니다. 공통 사조 HTML 레이아웃을 바꾼 경우 서버 주입만 고치지 말고 `node tools/sync-all-movement-html-rules.js`로 저장 HTML에도 같은 규칙을 반영합니다. `check-app-http.js`는 주요 탭 진입점, 활성 사조 문서 36개, 문서 안의 모든 로컬 이미지 경로를 실제 HTTP 응답으로 확인합니다.

```powershell
node tools/sync-all-movement-html-rules.js
node tools/check-app-http.js http://127.0.0.1:4173
```

마지막으로 문서와 코드의 공백 오류를 확인합니다.

```powershell
git diff --check
```

검증을 마친 변경은 Asia/Seoul 날짜의 변경 기록에 남깁니다.

```powershell
node tools/record-change.js --section "섹션 이름" --item "변경 내용"
```

## 저장소 관리

코드, JSON, 사조 HTML, 문서는 Git으로 관리합니다. `.env`, 로그, 로컬 이미지, 백업, 배포 결과물은 Git에 올리지 않습니다. 이미지 폴더가 Junction인 환경에서는 저장소 이동·백업 시 실제 대상 폴더도 별도로 확인합니다.

Firebase 관련 코드는 향후 이관 준비용입니다. 현재 운영 데이터의 원본은 로컬 JSON이며 외부 서비스로 자동 전송하지 않습니다. 자세한 내용은 [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)를 참고합니다.
