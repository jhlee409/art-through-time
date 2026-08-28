#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contractFile = path.join(root, 'data', 'art-movement-sync-contract.json');
const canonicalFile = path.join(root, 'data', 'art-movement-canonical.json');
const movementsFile = path.join(root, 'data', 'art-movements.json');
const artistsFile = path.join(root, 'data', 'artists.json');
const indexFile = path.join(root, 'data', '미술사조', 'index.json');
const reportFile = path.join(root, 'data', '미술사조', 'SYNC_CONTRACT.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function unique(values, label) {
  const seen = new Set();
  values.forEach(value => {
    assert(!seen.has(value), `${label} contains a duplicate: ${value}`);
    seen.add(value);
  });
}

function validate(contract, canonical, movementData, artistsData) {
  assert(contract.schema === 1, 'sync contract schema must be 1');
  assert(contract.status === 'frozen-for-implementation', 'sync contract status must be frozen-for-implementation');
  assert(contract.canonicalTaxonomy === 'data/art-movement-canonical.json', 'canonical taxonomy path differs');
  assert(contract.documentSyncVersion === '1', 'document sync version must be 1');

  const parents = new Map(canonical.parents.map(parent => [parent.id, parent]));
  const categories = new Map(canonical.categories.map(category => [category.id, category]));
  const contexts = new Map((canonical.contextReferences || []).map(context => [context.id, context]));
  const countries = new Set((movementData.countries || []).map(country => country.id));
  const artists = new Set((artistsData.artists || []).map(artist => artist.id));
  const attributes = contract.attributes || {};
  const requiredAttributeKeys = ['syncVersion', 'syncState', 'parentId', 'contextId', 'categoryId', 'developmentId', 'countryIds', 'representativeArtists', 'representativeSection', 'artistId', 'workId', 'imageState', 'duplicateArtistReason', 'selectionReason', 'cardDescription'];
  requiredAttributeKeys.forEach(key => assert(attributes[key], `missing contract attribute: ${key}`));
  unique(Object.values(attributes), 'contract attributes');
  Object.values(attributes).forEach(attribute => assert(/^data-[a-z0-9-]+$/.test(attribute), `invalid data attribute: ${attribute}`));

  const identities = contract.identities || {};
  ['parentId', 'contextId', 'categoryId', 'developmentId', 'countryId', 'artistId', 'workId'].forEach(key => assert(identities[key], `missing identity: ${key}`));
  const developmentPattern = new RegExp(identities.developmentId.pattern);
  assert(developmentPattern.test(identities.developmentId.example), 'developmentId example does not match its pattern');
  assert(parents.has(identities.parentId.example), 'parentId example is not canonical');
  assert(contexts.has(identities.contextId.example), 'contextId example is not canonical');
  assert(categories.has(identities.categoryId.example), 'categoryId example is not canonical');
  assert(countries.has(identities.countryId.example), 'countryId example is not registered');
  assert(artists.has(identities.artistId.example), 'artistId example is not registered');

  const dom = contract.dom || {};
  ['documentRoot', 'parentDocumentRoot', 'contextDocumentRoot', 'countryTable', 'developmentRow', 'representativeSection', 'cardGroup', 'representativeCard'].forEach(key => assert(dom[key]?.selector, `missing DOM selector: ${key}`));
  Object.entries(dom).forEach(([key, definition]) => {
    (definition.requiredAttributes || []).forEach(attributeKey => {
      assert(attributes[attributeKey], `${key} references unknown attribute key: ${attributeKey}`);
      assert(definition.selector.includes(attributes[attributeKey]), `${key} selector does not include ${attributes[attributeKey]}`);
    });
  });

  const bindingFields = contract.dataBindings?.movementAtlasEntry?.fields || {};
  ['parentId', 'documentOwnerId', 'categoryIds', 'developmentIds'].forEach(key => assert(bindingFields[key], `movement binding is missing ${key}`));
  assert(contract.dataBindings?.artistListEntry?.key === 'developmentId', 'artist list binding key must be developmentId');

  const authority = contract.authority || {};
  ['parentAndCategoryNames', 'parentAndCategoryOrder', 'movementDatesAndColors', 'countryCategoryFeatureAndRepresentativeMembership', 'representativeArtistOrder', 'representativeWorkImageAndText', 'artistAndWorkIdentityMetadata', 'documentPath'].forEach(key => assert(authority[key], `missing authority rule: ${key}`));
  assert(Object.keys(contract.operations || {}).length === 7, 'sync contract must define seven editing operations');
  assert((contract.saveTransaction || []).length >= 5, 'save transaction is incomplete');
  assert((contract.invariants?.hard || []).length >= 14, 'hard invariants are incomplete');
  assert((contract.invariants?.warnings || []).length >= 4, 'warning invariants are incomplete');
  assert(contract.invariants?.profiles?.structure && contract.invariants?.profiles?.complete, 'structure and complete validation profiles are required');
  assert(contract.exceptions?.duplicateRepresentativeArtist?.requiredAttribute === 'duplicateArtistReason', 'duplicate artist exception must use duplicateArtistReason');
  assert(contract.readCompatibility?.idFirst === true, 'ID-first reading must be enabled');
  assert(contract.readCompatibility?.legacyFallback?.writesBack === false, 'legacy fallback must remain read-only');

  const example = contract.example || {};
  const exampleParent = parents.get(example.parentId);
  const exampleCategory = categories.get(example.categoryId);
  assert(exampleParent?.role === 'document', 'example parent is not a document parent');
  assert(exampleCategory?.parentId === example.parentId, 'example category does not belong to example parent');
  assert(developmentPattern.test(example.developmentId), 'example developmentId is invalid');
  assert((example.countryIds || []).length > 0 && example.countryIds.every(id => countries.has(id)), 'example has invalid countries');
  assert((example.representativeArtistIds || []).length > 0 && example.representativeArtistIds.every(id => artists.has(id)), 'example has invalid artists');
  unique(example.representativeArtistIds, 'example representative artists');

  return {
    version: contract.documentSyncVersion,
    identities: Object.keys(identities).length,
    attributes: Object.keys(attributes).length,
    domSurfaces: Object.keys(dom).length,
    operations: Object.keys(contract.operations).length,
    hardInvariants: contract.invariants.hard.length,
    warnings: contract.invariants.warnings.length
  };
}

function labelForOperation(key) {
  return ({
    editFeature: '지역 특징 편집',
    reorderRepresentativeCards: '대표작 카드 순서 변경',
    moveRepresentativeArtist: '대표 화가 범주 이동',
    addRepresentativeArtist: '대표 화가 추가',
    removeRepresentativeArtist: '대표 화가 제거',
    editRepresentativeCard: '대표작 카드 편집',
    renameCanonicalCategory: '정본 범주명 변경'
  })[key] || key;
}

function makeExampleMarkup(contract) {
  const a = contract.attributes;
  const e = contract.example;
  const artist = e.representativeArtistIds[0];
  return `<html ${a.syncVersion}="${contract.documentSyncVersion}" ${a.syncState}="complete" ${a.parentId}="${e.parentId}">\n` +
    `  <tr ${a.developmentId}="${e.developmentId}" ${a.categoryId}="${e.categoryId}" ${a.countryIds}="${e.countryIds.join(' ')}">\n` +
    `    <td>프랑스 — 프랑스 바로크</td>\n` +
    `    <td>지역적 특징</td>\n` +
    `    <td ${a.representativeArtists}><a ${a.artistId}="${artist}">푸생</a></td>\n` +
    `  </tr>\n` +
    `  <section class="movement-enhancement" ${a.representativeSection}="works">\n` +
    `   <section class="art-atlas-submovement-group" ${a.developmentId}="${e.developmentId}" ${a.categoryId}="${e.categoryId}" ${a.countryIds}="${e.countryIds.join(' ')}">\n` +
    `    <div class="movement-work-grid" ${a.developmentId}="${e.developmentId}">\n` +
    `      <article class="movement-work-card" ${a.developmentId}="${e.developmentId}" ${a.categoryId}="${e.categoryId}" ${a.artistId}="${artist}" ${a.workId}="work-id" ${a.imageState}="ready">\n` +
    `        <p ${a.selectionReason}>선정 이유</p>\n` +
    `        <p ${a.cardDescription}>작품에서 확인할 특징</p>\n` +
    `      </article>\n` +
    `    </div>\n` +
    `   </section>\n` +
    `  </section>\n` +
    `</html>`;
}

function makeReport(contract) {
  const identityRows = Object.entries(contract.identities).map(([key, value]) => `| \`${key}\` | ${value.scope} | ${value.source} | \`${value.example}\` |`).join('\n');
  const domRows = Object.entries(contract.dom).map(([key, value]) => `| \`${key}\` | \`${value.selector}\` |`).join('\n');
  const authorityRows = Object.entries(contract.authority).map(([key, value]) => `| \`${key}\` | ${value} |`).join('\n');
  const operationRows = Object.entries(contract.operations).map(([key, value]) => `| ${labelForOperation(key)} | ${value.entryPoint} | ${(value.writes || []).join('<br>')} | ${(value.forbidden || []).join('<br>') || '-'} |`).join('\n');
  const hard = contract.invariants.hard.map(item => `- ${item}`).join('\n');
  const warnings = contract.invariants.warnings.map(item => `- ${item}`).join('\n');
  return `# 미술 사조 화면 동기화 계약\n\n` +
    `이 문서는 \`data/art-movement-sync-contract.json\`에서 자동 생성된다. 문서 동기화 버전은 \`${contract.documentSyncVersion}\`이며, 4단계 HTML 이관과 런타임 구현의 기준이다.\n\n` +
    `## 핵심 원칙\n\n` +
    `- \`categoryId\`는 68개 정본 범주의 신분이고, \`developmentId\`는 국가 전개 표 한 행과 카드 한 묶음을 연결하는 신분이다.\n` +
    `- 표는 국가·범주·특징·대표 화가 구성을 책임지고, 카드는 작품·이미지·선정 이유·설명을 책임진다.\n` +
    `- 대표 화가 순서는 표와 카드에 동일하게 저장한다. 같은 묶음 안의 카드 드래그만 이 순서를 바꿀 수 있다.\n` +
    `- 한 화가는 기본적으로 한 문서의 한 범주에만 둔다. 두 범주에 꼭 필요하면 각 카드에 중복의 교육적 이유를 기록한다.\n` +
    `- \`syncState=structure\`는 4단계 구조 이관 상태이고, \`syncState=complete\`는 대표 화가·작품까지 검증한 최종 동기화 상태다. 구조 상태에서는 콘텐츠 편집 연동을 잠근다.\n` +
    `- 버전 1 문서는 이름 부분일치나 국가 별칭으로 연결하지 않는다. 기존 무버전 문서만 읽기 전용 fallback을 사용한다.\n\n` +
    `## 식별자\n\n| 이름 | 범위 | 정본 | 예 |\n|---|---|---|---|\n${identityRows}\n\n` +
    `## DOM 표면\n\n| 요소 | 필수 선택자 |\n|---|---|\n${domRows}\n\n` +
    `## 데이터 권한\n\n| 데이터 | 정본 위치 |\n|---|---|\n${authorityRows}\n\n` +
    `## 편집 명령\n\n| 명령 | 시작점 | 함께 저장하는 값 | 금지 |\n|---|---|---|---|\n${operationRows}\n\n` +
    `## 필수 불변식\n\n${hard}\n\n` +
    `## 경고 항목\n\n${warnings}\n\n` +
    `## 마크업 예\n\n\`\`\`html\n${makeExampleMarkup(contract)}\n\`\`\`\n\n` +
    `## 이관 전 호환성\n\n` +
    `정본 36개 문서는 버전 1의 구조 상태로 이관되었다. 정본 색인 밖에 보존한 기존 원문만 무버전 문자열 정규화 방식으로 읽을 수 있으며 fallback은 원본 HTML에 ID를 추측해 기록하지 않는다. 현재 준비도는 \`node tools/validate-movement-sync-contract.js --audit-html\`로 확인한다.\n`;
}

function auditHtml(contract) {
  const index = readJson(indexFile);
  const files = Object.values(index.documents || {}).flatMap(slots => Object.values(slots || {}));
  const attribute = contract.attributes;
  const counts = {documents: files.length, versionedDocuments: 0, structureDocuments: 0, completeDocuments: 0, parentBoundDocuments: 0, contextBoundDocuments: 0, enhancementSections: 0, boundRepresentativeSections: 0, developmentRows: 0, boundRows: 0, cardGroups: 0, boundGroups: 0, representativeCards: 0, boundCards: 0};
  files.forEach(relative => {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    if (new RegExp(`${attribute.syncVersion}=["']${contract.documentSyncVersion}["']`, 'i').test(html)) counts.versionedDocuments++;
    if (new RegExp(`${attribute.syncState}=["']structure["']`, 'i').test(html)) counts.structureDocuments++;
    if (new RegExp(`${attribute.syncState}=["']complete["']`, 'i').test(html)) counts.completeDocuments++;
    if (new RegExp(`${attribute.parentId}=["'][^"']+["']`, 'i').test(html)) counts.parentBoundDocuments++;
    if (new RegExp(`${attribute.contextId}=["'][^"']+["']`, 'i').test(html)) counts.contextBoundDocuments++;
    const enhancements = [...html.matchAll(/<section\b(?=[^>]*\bclass=["'][^"']*movement-enhancement)[^>]*>/gi)];
    counts.enhancementSections += enhancements.length;
    counts.boundRepresentativeSections += enhancements.filter(match => new RegExp(`${attribute.representativeSection}=["']works["']`, 'i').test(match[0])).length;
    const country = html.match(/<section\b[^>]*\bid=["']countries["'][^>]*>[\s\S]*?<\/section>/i)?.[0] || '';
    const rows = [...country.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].filter(match => /<td\b/i.test(match[0]));
    counts.developmentRows += rows.length;
    counts.boundRows += rows.filter(match => [attribute.developmentId, attribute.categoryId, attribute.countryIds].every(name => new RegExp(`${name}=["'][^"']+["']`, 'i').test(match[0]))).length;
    const groups = [...html.matchAll(/<section\b(?=[^>]*\bclass=["'][^"']*art-atlas-submovement-group)[^>]*>/gi)];
    counts.cardGroups += groups.length;
    counts.boundGroups += groups.filter(match => [attribute.developmentId, attribute.categoryId, attribute.countryIds].every(name => new RegExp(`${name}=["'][^"']+["']`, 'i').test(match[0]))).length;
    const cards = [...html.matchAll(/<article\b(?=[^>]*\bclass=["'][^"']*movement-work-card)[^>]*>/gi)];
    counts.representativeCards += cards.length;
    counts.boundCards += cards.filter(match => [attribute.developmentId, attribute.categoryId, attribute.artistId, attribute.workId, attribute.imageState].every(name => new RegExp(`${name}=["'][^"']+["']`, 'i').test(match[0]))).length;
  });
  return counts;
}

function main() {
  const write = process.argv.includes('--write');
  const includeHtmlAudit = process.argv.includes('--audit-html');
  const contract = readJson(contractFile);
  const canonical = readJson(canonicalFile);
  const movementData = readJson(movementsFile);
  const artistsData = readJson(artistsFile);
  const summary = validate(contract, canonical, movementData, artistsData);
  const report = makeReport(contract);
  if (write) fs.writeFileSync(reportFile, report, 'utf8');
  else {
    assert(fs.existsSync(reportFile), 'sync contract report is missing; run with --write');
    assert(fs.readFileSync(reportFile, 'utf8') === report, 'sync contract report is stale; run with --write');
  }
  console.log(JSON.stringify({...summary, report:path.relative(root, reportFile).replace(/\\/g, '/'), ...(includeHtmlAudit ? {htmlReadiness:auditHtml(contract)} : {})}, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
