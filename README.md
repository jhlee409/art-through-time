# Art Through Time

Art Through Time은 미술사 초심자가 작품과 화가를 외우기 전에 **시대 흐름, 사조 차이, 국가별 역사 맥락, 작품에서 보이는 시각적 근거**를 함께 이해하도록 돕는 로컬 학습 앱입니다.

## 학습 흐름

1. `미술 사조의 이해`에서 1400년 이후의 큰 흐름을 국가별로 비교합니다.
2. 사조 설명 문서에서 핵심 시각 기준과 인접 사조의 차이를 익힙니다.
3. `국가별 미술`에서 한 국가 안의 사조 전개와 역사 배경을 연결합니다.
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

**탭 또는 HTML 문서를 다루는 작업은 작성규칙 확인 전에는 시작하지 않습니다.** 코드, JSON, HTML, 이미지, 문서를 수정하기 전에도 저장소 전체 규칙과 작업 대상에 맞는 작성규칙을 먼저 확인합니다. README는 적용 문서를 찾는 색인이며, 실제 세부 기준은 `작성규칙/` 문서가 우선입니다.

1. [`AGENTS.md`](AGENTS.md)를 확인합니다.
2. 탭·전용 화면·탭이 여는 HTML 작업이면 공통 정본인 [`작성규칙/새탭_template_작성규칙.md`](작성규칙/새탭_template_작성규칙.md)를 반드시 확인합니다.
3. 아래 표에서 수정 대상에 해당하는 세부 작성규칙을 모두 확인합니다. 여러 탭이나 정본 데이터가 연결되면 관련 문서를 하나만 고르지 않고 모두 적용합니다.
4. 규칙 사이에 충돌이 있으면 작업을 임의로 진행하지 않고 `AGENTS.md` → 대상별 작성규칙 → 공통 작성규칙 → README 순으로 적용합니다. 여전히 모순이면 먼저 규칙을 정리합니다.
5. 완료 보고에 확인한 작성규칙, 갱신한 정본과 연결 파일, 실행한 검증을 남깁니다. 이 기록이 없으면 탭·HTML 작업은 완료로 보지 않습니다.

작업 중 재사용할 규칙, 레이아웃 기준, 검증 절차, 이미지 보관 원칙이 새로 생기면 같은 변경에서 이 README와 관련 `작성규칙/` 문서를 갱신합니다. 특정 작품명·화가명 교정처럼 한 번만 쓰는 내용은 변경 기록에 남기고, 다른 화면에도 반복 적용할 기준만 작성규칙으로 올립니다.

| 작업 대상 | 반드시 함께 확인할 작성규칙 |
| --- | --- |
| 새 탭 기본 구성, 공통 사이드바, 탭 이동, 인증, 공용 레이아웃 | [공통 탭·전용 HTML 작성 규칙](작성규칙/새탭_template_작성규칙.md) |
| 미술 사조의 이해 탭, 사조 막대, 역사 사건 | [미술사조 이해 탭](작성규칙/미술사조이해탭_작성규칙.md), [사조 설명 HTML](작성규칙/사조설명html_작성규칙.md) |
| 사조 설명 HTML의 생성·수정·재구성·삭제·색인 연결 | [사조 설명 HTML](작성규칙/사조설명html_작성규칙.md), [미술사조 이해 탭](작성규칙/미술사조이해탭_작성규칙.md) |
| 국가별 미술 탭 | [국가별 미술 탭](작성규칙/국가별미술탭_작성규칙.md), [사조 설명 HTML](작성규칙/사조설명html_작성규칙.md) |
| 화가 리스트 탭 | [화가 리스트 탭](작성규칙/화가리스트탭_작성규칙.md), [사조 설명 HTML](작성규칙/사조설명html_작성규칙.md) |
| 화가 및 작품 탭, 작품 연표, 작품 이미지 | [화가 및 작품 탭](작성규칙/화가및작품탭_작성규칙.md), [화가 설명](작성규칙/화가설명_작성규칙.md) |
| 화가 해설 입력·스크립트·변환, 자료 링크, 작품명 연결 | [화가 설명](작성규칙/화가설명_작성규칙.md), [화가 및 작품 탭](작성규칙/화가및작품탭_작성규칙.md) |
| 기법·용어 탭 | [기법 및 용어 탭](작성규칙/기법및용어탭_작성규칙.md) |
| 주제·사건 탭 | [주제·사건 탭](작성규칙/주제사건탭_작성규칙.md) |

## 주요 화면

| 화면 | URL | 역할 |
| --- | --- | --- |
| 미술 사조의 이해 | `/?movementPopup=1` 또는 루트 기본 화면 | 1400년 이후 국가별 사조와 역사 사건 비교 |
| 국가별 미술 | `/?countryArt=1` | 한 국가에서 1400~1950년과 겹치는 모든 정규 사조 막대와 역사 배경 비교 |
| 화가 리스트 | `/?artistList=1` | 공통 부모 사조와 명시 화파·단계에 배치한 대표 화가 비교 |
| 화가 및 작품 | `/?artists=1` | 화가별 대표작, 전체 작품, 시기별 연표 |
| 기법·용어 | 전용 탭 버튼 | 제작 기법과 미술 용어 |
| 주제·사건 | 전용 탭 버튼 | 반복 주제·도상·사건과 연결 작품 |

모든 탭은 `한 · u · 표` 이름 표기, 관리자 세션, 로그아웃 신호, 탭 이동 규칙을 공유합니다.

## 현재 사조 체계

사조 체계의 정본은 [`data/art-movement-canonical.json`](data/art-movement-canonical.json)입니다.

| 항목 | 수량 |
| --- | ---: |
| 부모 사조 | 44개 |
| 정본상 독립 설명 문서 부모 | 34개 |
| 정본상 상위 문서 흡수형 부모 | 10개 |
| 이전 미술 참고 문서 | 2개 |
| 정본상 활성 문서 목표 | 36개 |
| 현재 활성 색인 | 8개 |
| 초심자 핵심 범주 | 68개 |

후기 비잔틴 미술과 고딕 미술은 1400년 무렵의 연결 맥락만 제공하며 부모 사조 수에 포함하지 않습니다. 정본 사조와 명시 화파·단계의 이름은 사조 문서, 대표작 카드, 화가 리스트에서 동일하게 사용합니다.

> 국가·지역 중심으로 분류된 기존 문서를 폐기하고 사조별 문서를 다시 만드는 전환 중이다. 현재 활성 색인은 기존 한글 파일명 문서 8개만 유지하며, 나머지 정본 문서는 전면 재구축해 `사조이름.html`로 등록하기 전까지 미등록 상태로 둔다. 북방 르네상스·독일 르네상스·도나우파 호출은 [`르네상스.html`](data/미술사조/르네상스.html)로 정규화한다.

범주 연결은 표시 문자열이 아니라 `parentId`, `categoryId`, `developmentId`, `artistId`, `workId` 같은 ID로 처리합니다. 활성 문서는 [`data/미술사조/index.json`](data/미술사조/index.json), 활성 체계에서 제외한 기존 문서는 [`data/미술사조/legacy-index.json`](data/미술사조/legacy-index.json)에서 관리합니다.

## 사조 설명 HTML 표준

사조 설명 HTML을 만들거나 수정하기 전에는 [`작성규칙/사조설명html_작성규칙.md`](작성규칙/사조설명html_작성규칙.md)를 반드시 확인합니다. 현재 형식 기준 문서는 Git 이력상 가장 최근에 완성된 [`인상주의.html`](data/미술사조/인상주의.html)이며, 새 문서는 그 문서의 전체 폭 레이아웃, 섹션 순서, 클래스, 반응형 동작을 복제한 뒤 내용과 정본 ID만 대상 사조에 맞게 바꿉니다. 기준 문서가 바뀌는 절차와 필수 데이터 속성·동기화·검증 조건은 사조 설명 작성규칙만을 정본으로 삼습니다.

## 데이터 원본

같은 내용을 여러 파일에서 따로 고치지 않습니다. 아래 원본을 먼저 수정하고 연결 화면을 동기화합니다.

공용 앱과 서버 코드를 수정할 때는 반드시 [공통 탭·전용 HTML 작성 규칙](작성규칙/새탭_template_작성규칙.md)의 코드 구성 기준을 확인합니다. 현재 고전 스크립트는 파일 내부 함수 선언의 끌어올림과 전역 로딩 순서에 의존하므로 `app/app-core.js`, `app/app-artists.js`, `app/app-atlas.js`, `app/app-detail.js`, `server-content.js`, `extras.css`를 짧은 호환 진입점과 하위 조각 파일로 분할하지 않습니다.

| 원본 | 소유 내용 |
| --- | --- |
| `data/art-movement-canonical.json` | 부모 사조, 핵심 범주, 문서 역할과 표시 순서 |
| `data/art-movement-sync-contract.json` | 표·카드·화가 리스트의 ID 기반 동기화 규약 |
| `data/art-movement-learning-guides.json` | 활성 사조 문서의 초심자 학습 길잡이 원문 |
| `data/art-movement-learning-map.json` | 정식 범주와 별개인 기준점·주요 변주·비교 축 학습 지도 |
| `data/art-movement-representatives.json` | 핵심 범주의 특징, 대표 화가·더 볼 화가, 작품과 선정 이유 |
| `data/art-movements.json` | 국가별 비교 위치, 기간, 공통 부모 사조·명시 화파 연결 ID |
| `data/미술사조/*.html` | 사조 학습 본문, 3단계 역사 비교, 대표 미술가 표와 작품 카드. 이전 문서는 국가 전개 구조를 전환 전까지 유지 |
| `data/보조학습자료/index.json` 및 하위 HTML | 사조 본문에서 여는 사건·작품 배경·비교 주제의 보조 학습자료 색인과 원문 |
| `data/artists.json` | 화가와 작품의 전체 원본 |
| `data/artists-index.json` | 화면 로딩용 화가 색인 |
| `data/image-catalog.json` | 이미지 경로, 작품 ID·QID, 제목·연도, SHA-256과 이전 경로 별칭을 모은 전역 검색 색인 |
| `data/country-art-events.json` | 국가별 미술 사건 |
| `data/country-movement-backgrounds.json` | 국가별 사조 태동 배경과 사건 ID 연결 |
| `data/techniques.json` | 기법·용어와 대표 사례 |
| `data/topics.json` | 주제·사건과 연결 작품 |

사조 설명의 분류, 파일명, 표·카드 순서, 해시 HTML 금지, 동기화 대상은 README에 중복 정의하지 않고 [사조 설명 HTML 작성 규칙](작성규칙/사조설명html_작성규칙.md)을 따릅니다. 학습 길잡이 원문을 바꾼 뒤에는 다음 동기화 검사를 실행합니다.

```powershell
node tools/sync-movement-learning-guides.js
node tools/sync-movement-learning-guides.js --check
```

## 이미지 원칙

이미지 작업도 수정 대상 탭·HTML의 작성규칙과 [공통 탭·전용 HTML 작성 규칙](작성규칙/새탭_template_작성규칙.md)을 먼저 확인합니다. 세부 파일명, 정본 폴더, 카탈로그 갱신과 검증 명령은 공통 규칙과 [화가 및 작품 탭 작성 규칙](작성규칙/화가및작품탭_작성규칙.md)을 정본으로 삼습니다.

### 화가 연표 이미지 저장 정책

> **앞으로 화가 연표에 사용하는 이미지 파일은 이 Git 프로젝트 폴더에 직접 저장하지 않습니다.** 모든 신규 이미지와 교체 이미지는 OneDrive의 이미지 정본 폴더에 저장하고, 프로젝트는 `data/images` Windows Junction을 통해 그 파일을 사용합니다.

| 구분 | 위치와 역할 |
| --- | --- |
| 실제 이미지 정본 | 각 컴퓨터에 존재하는 OneDrive 대상 경로 하나 |
| 프로젝트 접근 경로 | `data/images` Junction |
| 코드·JSON에 기록할 경로 | `data/images/...` 상대 경로만 사용 |
| Git 관리 대상 | 이미지 참조가 있는 데이터와 `data/image-catalog.json`; 대량 이미지 파일은 제외 |

허용하는 OneDrive Junction 대상 후보는 다음 두 경로입니다.

- `C:\Users\admin\OneDrive - UOU\AI-Programming\Art_through_Time\data\images`
- `C:\Users\jhlee\OneDrive - UOU\AI-Programming\Art_through_Time\data\images`

각 컴퓨터에서는 실제로 존재하는 후보 하나만 Junction 대상으로 사용합니다. 관리자 화면에서 이미지를 추가하거나 교체해도 파일은 `data/images` Junction을 통과해 OneDrive 정본에 저장됩니다. `Art_through_Time.cmd`는 정상인 기존 Junction을 보존하고, Junction이 없을 때만 `tools/ensure-image-junction.ps1`로 두 후보를 순서대로 확인해 생성합니다. `data/images`를 일반 폴더로 바꾸거나 이미지 파일을 프로젝트 안에 복사해 Git에 추가하지 않습니다.

### 공통 원칙

- 화면에는 프로젝트 상대 경로의 이미지만 사용하고, 화가 작품은 모든 탭에서 `artistId + workId`로 연결된 `data/images/artist-*/` 정본을 재사용합니다.
- 로컬 파일이 없으면 외부 이미지 URL을 만들지 않고 `이미지 업로드 예정` 또는 `다운로드 필요` 상태를 유지합니다.
- 사용자가 "다운로드 폴더"라고 말하면 프로젝트 루트의 `다운로드용/`만 확인합니다.
- URL 이미지 다운로드나 URL 응답 저장은 대상 사이트와 파일을 밝히고 사용자의 명시적 승인을 받은 뒤에만 수행합니다.
- 이미지 변경 뒤에는 `data/image-catalog.json`을 갱신하고 해당 작성규칙의 검증을 실행합니다. 관리자 화면의 작품 이미지 추가·교체 API는 이미지 파일, `data/images/*/index.json`, `data/artists.json`, `data/artists-index.json`, `data/image-catalog.json`을 한 서버 요청에서 함께 갱신합니다.

## 로그인과 권한

- 보기 모드는 자료를 조회하지만 저장·삭제 기능을 사용할 수 없습니다.
- 관리자 모드는 화가, 작품, 사조 설명, 기법, 주제 자료를 편집할 수 있습니다.
- `.env`가 없거나 로그인을 건너뛰면 보기 모드로 동작합니다.
- 새 환경에서는 [`.env.example`](.env.example)을 참고해 `.env`를 만들고 관리자 정보를 설정합니다.
- `.env`의 실제 값은 Git, 문서, 변경 기록에 남기지 않습니다.

### 화가 해설 입력과 변환

화가 해설 오른쪽 위의 `편집`은 일반 텍스트와 블로그 본문을 직접 입력해 저장하는 기능입니다. `편집` 오른쪽의 `md 업로드`는 로컬 `.md` 또는 `.markdown` 파일을 브라우저에서 읽어 `## md 업로드: 파일명` 블록으로 편집창 뒤쪽에 추가합니다. 블로그 글이나 사용자가 조사한 문장은 외부 웹을 읽지 않고 편집창에 직접 붙여 넣거나 md 파일로 불러옵니다.

`md 업로드` 오른쪽의 `스크립트 요약`은 긴 스크립트를 붙여 넣어 OpenAI API로 먼저 줄이는 기능입니다. 원문 스크립트는 해설에 저장하지 않고, 요약 결과만 `## 스크립트 요약: 제목` 블록으로 해설에 저장합니다. 스크립트 요약 입력은 최대 120,000자입니다. 영상 파일이나 음원은 내려받지 않습니다.

`변환`은 현재 저장된 일반 텍스트·블로그 본문·md 업로드 블록·스크립트 요약 블록을 OpenAI API로 보내 문서형 해설로 다듬고 바로 저장합니다. 기존에 이미 변환된 내용은 삭제하지 않고, 사용자가 입력한 순서와 제목 블록 구분을 유지합니다. 서로 다른 자료의 내용을 하나로 통합하거나 재배치하지 않고, 각 입력 블록 안에서만 문장을 읽기 좋게 다듬습니다. 이미지 URL이나 이미지 마크다운은 새 외부 이미지 의존을 만들지 않고, 작품명과 연도를 확인할 수 있을 때만 텍스트로 남깁니다. `.env`에 `OPENAI_API_KEY`를 설정하고 서버를 다시 시작해야 하며, 필요하면 `ART_ATLAS_SUMMARY_MODEL`로 모델을 바꿀 수 있습니다.

해설은 기본 4줄만 표시되며 오른쪽 화살표로 전체 내용을 펼치거나 접을 수 있습니다. 펼칠 때에는 현재 작품·이미지 목록을 다시 대조해 작품명 링크를 갱신합니다. 링크를 누르면 화면 중앙의 원본 비율 이미지 박스를 엽니다. 이미지의 긴 변은 화면 가로·세로 한도의 40%에 맞고 이미지를 더블클릭하면 닫힙니다.

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

수동으로 추가한 로컬 작품 이미지는 정기적으로 아래 명령으로 Wikidata의 작품 창작자(P170)와 현재 화가를 대조한다. 대조 결과는 `data/artists.json`에 저장되며, QID가 없거나 창작자가 일치하지 않는 항목은 `npm run images:ownership-check`에서 확인할 수 있다.

```powershell
npm run images:ownership-audit
npm run images:ownership-check
```

사조 정본이나 설명 문서를 바꾼 작업에서는 재구축 진행 상태와 관계없이 아래 연결 검사를 실행합니다.

```powershell
node tools/validate-movement-canonical.js
node tools/validate-movement-sync-contract.js
node tools/validate-movement-representatives.js
node tools/validate-cross-tab-linkage.js
node tools/validate-movement-image-paths.js
node tools/validate-movement-links.js
node tools/validate-project-linkage.js
```

정본 목표 36개 문서가 모두 등록된 뒤에는 아래 HTML 완성 검사를 추가합니다.

```powershell
node tools/validate-movement-documents-v1.js
node tools/validate-movement-sync-v1-runtime.js
node tools/complete-movement-sync-v1.js
node tools/sync-movement-learning-guides.js --check
```

사조 HTML 제공 경로나 `server-content.js`의 서버 주입 코드를 바꾸면 서버를 재시작합니다. 공통 사조 HTML 레이아웃을 바꾼 경우 서버 주입만 고치지 말고 `node tools/sync-all-movement-html-rules.js`로 저장 HTML에도 같은 규칙을 반영합니다. `check-app-http.js`는 주요 탭 진입점, 활성 사조 문서와 문서 안의 모든 로컬 이미지 경로를 실제 HTTP 응답으로 확인합니다. 정본 목표는 36개지만 전면 재구축 전환 중인 현재 활성 색인은 기존 한글명 문서 8개이므로, 수량 검사는 `data/미술사조/index.json`의 등록 수를 기준으로 합니다.

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

코드, JSON, 사조 HTML, 문서는 Git으로 관리합니다. `.env`, 로그, 이미지 파일, 백업, 배포 결과물은 Git에 올리지 않습니다. 화가 연표 이미지의 저장 위치와 연결 방식은 위의 [화가 연표 이미지 저장 정책](#화가-연표-이미지-저장-정책)을 따릅니다. 저장소를 이동하거나 백업할 때는 프로젝트와 OneDrive 이미지 정본을 각각 확인합니다.

Firebase 관련 코드는 향후 이관 준비용입니다. 현재 운영 데이터의 원본은 로컬 JSON이며 외부 서비스로 자동 전송하지 않습니다. 자세한 내용은 [FIREBASE_MIGRATION.md](FIREBASE_MIGRATION.md)를 참고합니다.
