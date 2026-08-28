# 미술 사조 정본 분류

이 문서는 `data/art-movement-canonical.json`에서 자동 생성된다. 재구축 과정에서 국가 전개 표, 대표작 카드, 화가 리스트가 공유할 안정 ID의 기준이다.

## 고정 수치

- 부모 사조 44개: 독립 문서 34개, 상위 문서 흡수형 10개
- 독립 문서 34개: 상세형 20개, 연결형 6개, 참고형 8개
- 표시 구조: 세부 범주 연동형 24개, 단일 부모형 10개
- 초심자 핵심 범주 68개, 이전 미술 참고 문서 2개

## 사용 원칙

- 부모 ID는 기존 `data/art-taxonomy.json`과 동일하게 유지한다.
- 역사적 표시 순서는 `parentDisplayOrder`를 사용한다.
- 표, 카드, 화가 리스트는 표시 문자열이 아니라 `categoryId`로 연결한다.
- 흡수형 부모는 학술 지도 막대를 유지하되 독립 HTML을 만들지 않는다.
- 고딕 미술과 후기 비잔틴 미술은 부모 수에 넣지 않고 1400년 무렵의 이전 미술 참고로만 사용한다.

## 독립 문서 34개

| 부모 ID | 사조 | 문서 수준 | 표시 구조 | 정본 범주 |
|---|---|---|---|---|
| `renaissance` | 르네상스 | 상세형 | 세부 범주 연동형 | 초기 르네상스 (`renaissance--early`)<br>전성기 르네상스 (`renaissance--high`)<br>베네치아 르네상스 (`renaissance--venetian`) |
| `northern-renaissance` | 북방 르네상스 | 상세형 | 세부 범주 연동형 | 초기 네덜란드 회화 (`northern-renaissance--early-netherlandish`)<br>독일 르네상스 (`northern-renaissance--german`) |
| `mannerism` | 매너리즘 | 상세형 | 세부 범주 연동형 | 이탈리아 매너리즘 (`mannerism--italian`)<br>퐁텐블로파 (`mannerism--fontainebleau`) |
| `baroque` | 바로크 | 상세형 | 세부 범주 연동형 | 이탈리아 바로크 (`baroque--italian`)<br>플랑드르 바로크 (`baroque--flemish`)<br>네덜란드 황금기 회화 (`baroque--dutch-golden-age`)<br>스페인 바로크 (`baroque--spanish`)<br>프랑스 바로크 (`baroque--french`) |
| `rococo` | 로코코 | 상세형 | 세부 범주 연동형 | 프랑스 로코코 (`rococo--french`)<br>베네치아 로코코 (`rococo--venetian`) |
| `neoclassicism` | 신고전주의 | 상세형 | 세부 범주 연동형 | 프랑스 신고전주의 (`neoclassicism--french`)<br>로마 국제 신고전주의 (`neoclassicism--roman-international`) |
| `academicism` | 아카데미즘 | 참고형 | 단일 부모형 | 아카데미즘 (`academicism--core`) |
| `romanticism` | 낭만주의 | 상세형 | 세부 범주 연동형 | 독일 낭만주의 (`romanticism--german`)<br>영국 낭만주의 (`romanticism--british`)<br>프랑스 낭만주의 (`romanticism--french`)<br>스페인 낭만주의 (`romanticism--spanish`) |
| `realism` | 사실주의 | 상세형 | 세부 범주 연동형 | 프랑스 사실주의 (`realism--french`)<br>러시아 사실주의 (`realism--russian`) |
| `impressionism` | 인상주의 | 상세형 | 세부 범주 연동형 | 프랑스 인상주의 (`impressionism--french`)<br>미국 인상주의 (`impressionism--american`) |
| `post-impressionism` | 후기인상주의 | 상세형 | 세부 범주 연동형 | 후기인상주의 (`post-impressionism--core`)<br>신인상주의 (`post-impressionism--neo-impressionism`)<br>퐁타방파와 종합주의 (`post-impressionism--pont-aven-synthetism`) |
| `symbolism` | 상징주의 | 상세형 | 세부 범주 연동형 | 프랑스·벨기에 상징주의 (`symbolism--french-belgian`)<br>중부·북유럽 상징주의 (`symbolism--central-northern-european`) |
| `art-nouveau` | 아르누보 | 연결형 | 세부 범주 연동형 | 프랑스·벨기에 아르누보 (`art-nouveau--french-belgian`)<br>빈 분리파 (`art-nouveau--vienna-secession`) |
| `fauvism` | 야수주의 | 상세형 | 세부 범주 연동형 | 마티스·샤투 중심 야수파 (`fauvism--matisse-chatou`)<br>르아브르파 야수주의 (`fauvism--le-havre`) |
| `expressionism` | 표현주의 | 상세형 | 세부 범주 연동형 | 다리파 (`expressionism--brucke`)<br>청기사파 (`expressionism--blue-rider`)<br>오스트리아 표현주의 (`expressionism--austrian`) |
| `cubism` | 입체주의 | 상세형 | 세부 범주 연동형 | 분석적 입체주의 (`cubism--analytic`)<br>종합적 입체주의 (`cubism--synthetic`) |
| `futurism` | 미래주의 | 연결형 | 세부 범주 연동형 | 이탈리아 미래주의 (`futurism--italian`)<br>러시아 입체미래주의 (`futurism--russian-cubo`) |
| `russian-avant-garde` | 러시아 아방가르드 | 연결형 | 세부 범주 연동형 | 절대주의 (`russian-avant-garde--suprematism`)<br>구성주의 (`russian-avant-garde--constructivism`) |
| `dada` | 다다 | 상세형 | 세부 범주 연동형 | 취리히 다다 (`dada--zurich`)<br>베를린 다다 (`dada--berlin`)<br>뉴욕 다다 (`dada--new-york`) |
| `de-stijl` | 데 스틸 | 참고형 | 단일 부모형 | 데 스틸 (`de-stijl--core`) |
| `bauhaus` | 바우하우스 | 연결형 | 단일 부모형 | 바우하우스 (`bauhaus--core`) |
| `surrealism` | 초현실주의 | 상세형 | 세부 범주 연동형 | 자동기술적 초현실주의 (`surrealism--automatist`)<br>환영적 초현실주의 (`surrealism--illusionistic`) |
| `mexican-muralism` | 멕시코 벽화운동 | 참고형 | 단일 부모형 | 멕시코 벽화운동 (`mexican-muralism--core`) |
| `social-realism` | 사회적 사실주의 | 참고형 | 단일 부모형 | 사회적 사실주의 (`social-realism--core`) |
| `socialist-realism` | 사회주의적 사실주의 | 참고형 | 단일 부모형 | 사회주의적 사실주의 (`socialist-realism--core`) |
| `abstract-expressionism` | 추상표현주의 | 상세형 | 세부 범주 연동형 | 액션 페인팅 (`abstract-expressionism--action-painting`)<br>색면회화 (`abstract-expressionism--color-field`) |
| `art-informel` | 앵포르멜 | 참고형 | 단일 부모형 | 앵포르멜 (`art-informel--core`) |
| `pop-art` | 팝아트 | 상세형 | 세부 범주 연동형 | 영국 팝아트 (`pop-art--british`)<br>미국 팝아트 (`pop-art--american`) |
| `nouveau-realisme` | 누보 레알리슴 | 참고형 | 단일 부모형 | 누보 레알리슴 (`nouveau-realisme--core`) |
| `minimalism` | 미니멀리즘 | 상세형 | 단일 부모형 | 미니멀리즘 (`minimalism--core`) |
| `op-art` | 옵아트 | 참고형 | 단일 부모형 | 옵아트 (`op-art--core`) |
| `conceptual-art` | 개념미술 | 상세형 | 세부 범주 연동형 | 아이디어·언어 중심 개념미술 (`conceptual-art--idea-language`)<br>플럭서스 (`conceptual-art--fluxus`) |
| `postmodernism` | 포스트모더니즘 | 연결형 | 세부 범주 연동형 | 차용미술과 픽처스 제너레이션 (`postmodernism--appropriation-pictures`)<br>신표현주의 (`postmodernism--neo-expressionism`) |
| `contemporary-art` | 현대미술 | 연결형 | 세부 범주 연동형 | 설치·퍼포먼스 미술 (`contemporary-art--installation-performance`)<br>뉴미디어·디지털 아트 (`contemporary-art--new-media-digital`)<br>거리·참여 미술 (`contemporary-art--street-participatory`) |

## 흡수형 부모 10개

| 부모 ID | 사조 | 설명 문서 | 배치 |
|---|---|---|---|
| `proto-renaissance` | 선르네상스 | 르네상스 | 문서 안 맥락 |
| `biedermeier` | 비더마이어 | 낭만주의 | 문서 안 맥락 |
| `pre-raphaelite` | 라파엘 전파 | 상징주의 | 문서 안 맥락 |
| `neo-impressionism` | 신인상주의 | 후기인상주의 | 핵심 범주 `post-impressionism--neo-impressionism` |
| `new-objectivity` | 신즉물주의 | 표현주의 | 문서 안 맥락 |
| `fluxus` | 플럭서스 | 개념미술 | 핵심 범주 `conceptual-art--fluxus` |
| `arte-povera` | 아르테 포베라 | 개념미술 | 문서 안 맥락 |
| `photorealism` | 포토리얼리즘 | 포스트모더니즘 | 문서 안 맥락 |
| `neo-expressionism` | 신표현주의 | 포스트모더니즘 | 핵심 범주 `postmodernism--neo-expressionism` |
| `street-art` | 거리미술 | 현대미술 | 핵심 범주 `contemporary-art--street-participatory` |

## 이전 미술 참고 2개

| 참고 ID | 이름 | 문서 키 |
|---|---|---|
| `previous-art--late-byzantine` | 후기 비잔틴 미술 | `Late Byzantine art` |
| `previous-art--gothic` | 고딕 미술 | `Gothic art` |

## 분류 근거

- [The Metropolitan Museum of Art: Art Nouveau](https://www.metmuseum.org/toah/hd/artn/hd_artn.htm): 아르누보의 국제적 지역 변형과 프랑스·벨기에 중심
- [The Museum of Modern Art: Dada](https://www.moma.org/collection/terms/dada): 취리히·뉴욕에서 형성되어 베를린·파리 등으로 확산된 국제 운동
- [The Museum of Modern Art: The Wild Beasts: Fauvism and Its Affinities](https://www.moma.org/documents/moma_catalogue_2470_300298256.pdf): 마티스 화실 계열·샤투파·르아브르 출신 화가들의 세 집단 구분
- [The Museum of Modern Art: Modern Art and Ideas 8](https://www.moma.org/momaorg/shared/pdfs/moma_learning/docs/MAI8_Full.pdf): 추상표현주의의 액션 페인팅과 색면회화 구분
- [The Museum of Modern Art: Surrealist Prints: An Overview](https://www.moma.org/documents/moma_catalogue_1728_300200577.pdf): 초현실주의의 자동기술 계열과 환영적 꿈 이미지 계열 구분
