# 미술 사조 화면 동기화 계약

이 문서는 `data/art-movement-sync-contract.json`에서 자동 생성된다. 문서 동기화 버전은 `1`이며, 4단계 HTML 이관과 런타임 구현의 기준이다.

## 핵심 원칙

- `categoryId`는 68개 정본 범주의 신분이고, `developmentId`는 국가 전개 표 한 행과 카드 한 묶음을 연결하는 신분이다.
- 표는 국가·범주·특징·대표 화가·더 볼 화가 구성을 책임지고, 카드는 작품·이미지·선정 이유·설명을 책임진다.
- 대표 화가 카드는 첫 위치에 고정한다. 더 볼 화가끼리 드래그한 순서는 표의 더 볼 화가 셀에 동일하게 저장한다.
- 한 화가는 기본적으로 한 문서의 한 범주에만 둔다. 두 범주에 꼭 필요하면 각 카드에 중복의 교육적 이유를 기록한다.
- `syncState=structure`는 4단계 구조 이관 상태이고, `syncState=complete`는 대표 화가·작품까지 검증한 최종 동기화 상태다. 구조 상태에서는 콘텐츠 편집 연동을 잠근다.
- 버전 1 문서는 이름 부분일치나 국가 별칭으로 연결하지 않는다. 기존 무버전 문서만 읽기 전용 fallback을 사용한다.

## 식별자

| 이름 | 범위 | 정본 | 예 |
|---|---|---|---|
| `parentId` | project | data/art-movement-canonical.json#parents[].id | `baroque` |
| `contextId` | project | data/art-movement-canonical.json#contextReferences[].id | `previous-art--gothic` |
| `categoryId` | project | data/art-movement-canonical.json#categories[].id | `baroque--french` |
| `developmentId` | project | movement HTML #countries table row | `dev--baroque-french-france` |
| `countryId` | project | data/art-movements.json#countries[].id | `france` |
| `artistId` | project | data/artists.json#artists[].id | `artist-Q41554` |
| `workId` | artist | data/artists.json#artists[].works[].id | `poussin-death-of-germanicus-1627` |

## DOM 표면

| 요소 | 필수 선택자 |
|---|---|
| `documentRoot` | `html[data-art-atlas-sync-version][data-art-atlas-sync-state]` |
| `parentDocumentRoot` | `html[data-art-atlas-sync-version][data-art-atlas-sync-state][data-art-atlas-parent-id]` |
| `contextDocumentRoot` | `html[data-art-atlas-sync-version][data-art-atlas-sync-state][data-art-atlas-context-id]` |
| `countryTable` | `#countries[data-art-atlas-country-feature-editor="country-development"] table` |
| `developmentRow` | `#countries tbody tr[data-art-atlas-development-id][data-art-atlas-category-id][data-art-atlas-country-ids]` |
| `representativeSection` | `.movement-enhancement[data-art-atlas-representative-section="works"]` |
| `cardGroup` | `.movement-enhancement[data-art-atlas-representative-section="works"] .art-atlas-submovement-group[data-art-atlas-development-id][data-art-atlas-category-id][data-art-atlas-country-ids]` |
| `representativeCard` | `article.movement-work-card[data-art-atlas-development-id][data-art-atlas-category-id][data-artist-id][data-work-id][data-art-atlas-card-role][data-art-atlas-image-state]` |

## 데이터 권한

| 데이터 | 정본 위치 |
|---|---|
| `parentAndCategoryNames` | data/art-movement-canonical.json |
| `parentAndCategoryOrder` | data/art-movement-canonical.json |
| `movementDatesAndColors` | data/art-movements.json |
| `countryCategoryFeatureAndArtistMembership` | movement HTML #countries developmentRow |
| `artistRoleAndOrder` | 대표 화가 셀·더 볼 화가 셀과 cardRole별 카드 DOM 순서가 동일해야 한다 |
| `representativeWorkImageAndText` | movement HTML representativeCard |
| `artistAndWorkIdentityMetadata` | data/artists.json |
| `documentPath` | data/미술사조/index.json |

## 편집 명령

| 명령 | 시작점 | 함께 저장하는 값 | 금지 |
|---|---|---|---|
| 지역 특징 편집 | country table feature editor | developmentRow feature HTML | - |
| 더 볼 화가 카드 순서 변경 | drag further cards inside one card grid | further card DOM order<br>matching table further artist link order | representative card drag<br>cross-development drag<br>cross-category drag<br>implicit artist membership change |
| 대표 화가 범주 이동 | country table representative classification command | both table representative cells<br>card developmentId and categoryId<br>card group placement | - |
| 대표 화가 추가 | country table representative artist command | table representative link<br>matching card | - |
| 대표 화가 제거 | country table representative artist command | table representative link<br>matching card | - |
| 대표작 카드 편집 | card description editor | selection reason<br>editable description<br>work metadata or local image when explicitly changed | artist membership change<br>category rename |
| 정본 범주명 변경 | canonical taxonomy migration only | canonical display names | individual HTML-only rename |

## 필수 불변식

- 버전 1 문서는 syncState가 structure, content 또는 complete이며 parentId와 contextId 중 정확히 하나를 가진다.
- documentRoot parentId는 canonical에서 role=document인 부모이고 contextId는 contextReferences에 있어야 한다.
- 대표작 심화 구역은 representativeSection=works로 표시된 요소가 정확히 하나다.
- 모든 developmentId는 프로젝트 전체에서 유일하고 지정 패턴을 만족한다.
- 각 developmentRow에는 canonical에 존재하고 문서 부모에 속하는 categoryId 하나가 있다.
- 각 developmentRow에는 art-movements 국가 ID 한 개 이상이 공백 구분 목록으로 있다.
- 각 developmentRow에는 같은 developmentId·categoryId·countryIds를 가진 cardGroup이 정확히 하나 있다.
- 각 cardGroup에는 같은 developmentId를 가진 grid가 정확히 하나 있다.
- 각 행에는 대표 화가가 정확히 1명, 더 볼 화가가 1~4명 있다.
- 각 카드 묶음에는 role=primary 카드가 정확히 1개이고 첫 카드이며 role=further 카드가 1~4개 있다.
- 표의 대표·더 볼 artistId 집합과 같은 역할 카드의 artistId 집합은 각각 같고 순서도 같다.
- 한 문서에서 artistId가 여러 developmentId에 속하면 모든 해당 카드에 duplicateArtistReason을 기록해야 한다.
- 카드의 artistId와 제목의 대표 화가 링크 artistId가 같다.
- 카드의 workId는 해당 artistId의 artists.json 작품에 존재한다.
- imageState=ready인 카드는 로컬 img src를 가지며 imageState=pending인 카드는 외부 URL을 만들지 않는다.
- selectionReason과 cardDescription은 각각 비어 있지 않으며 더 볼 화가 설명은 사조 특징과 화가 고유 특성을 함께 밝힌다.
- 다른 사조에도 속하는 화가는 해당 카드 설명에 다른 소속 사조를 명시한다.
- 세부 범주 연동형 문서의 canonical categoryIds가 적어도 한 developmentRow에서 사용된다.
- 단일 부모형 문서의 모든 developmentRow는 그 부모의 유일한 categoryId를 사용한다.

## 경고 항목

- 표 대표 화가의 artists.json 국가·활동 시기·사조 메타데이터가 developmentRow와 다르다.
- imageState=pending 카드가 남아 있다.
- canonical coveredTopics가 별도 categoryId처럼 화면에 노출된다.
- 한 categoryId에 연결된 국가 막대가 없거나 기간이 대표 화가 활동 시기와 크게 어긋난다.

## 마크업 예

```html
<html data-art-atlas-sync-version="1" data-art-atlas-sync-state="complete" data-art-atlas-parent-id="baroque">
  <tr data-art-atlas-development-id="dev--baroque-french-france" data-art-atlas-category-id="baroque--french" data-art-atlas-country-ids="france">
    <td>프랑스 — 프랑스 바로크</td>
    <td>지역적 특징</td>
    <td data-art-atlas-representative-artists><a data-artist-id="artist-Q41554">푸생</a></td>
    <td data-art-atlas-further-artists><a data-artist-id="artist-Q9340">클로드 로랭</a></td>
  </tr>
  <section class="movement-enhancement" data-art-atlas-representative-section="works">
   <section class="art-atlas-submovement-group" data-art-atlas-development-id="dev--baroque-french-france" data-art-atlas-category-id="baroque--french" data-art-atlas-country-ids="france">
    <div class="movement-work-grid" data-art-atlas-development-id="dev--baroque-french-france">
      <article class="movement-work-card" data-art-atlas-development-id="dev--baroque-french-france" data-art-atlas-category-id="baroque--french" data-artist-id="artist-Q41554" data-work-id="work-id" data-art-atlas-card-role="primary" data-art-atlas-image-state="ready">
        <p data-art-atlas-selection-reason>선정 이유</p>
        <p data-art-atlas-card-description>작품에서 확인할 특징</p>
      </article>
      <article class="movement-work-card" data-art-atlas-development-id="dev--baroque-french-france" data-art-atlas-category-id="baroque--french" data-artist-id="artist-Q9340" data-work-id="further-work-id" data-art-atlas-card-role="further" data-art-atlas-image-state="pending">
        <p data-art-atlas-selection-reason>더 볼 이유</p>
        <p data-art-atlas-card-description>사조 특징과 화가 고유 특성</p>
      </article>
    </div>
   </section>
  </section>
</html>
```

## 이관 전 호환성

정본 36개 문서는 버전 1의 구조 상태로 이관되었다. 정본 색인 밖에 보존한 기존 원문만 무버전 문자열 정규화 방식으로 읽을 수 있으며 fallback은 원본 HTML에 ID를 추측해 기록하지 않는다. 현재 준비도는 `node tools/validate-movement-sync-contract.js --audit-html`로 확인한다.
