#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const documentDir = path.join(dataDir, '미술사조');
const files = {
  canonical: path.join(dataDir, 'art-movement-canonical.json'),
  contract: path.join(dataDir, 'art-movement-sync-contract.json'),
  migration: path.join(dataDir, 'art-movement-document-migration.json'),
  movements: path.join(dataDir, 'art-movements.json'),
  index: path.join(documentDir, 'index.json'),
  legacy: path.join(documentDir, 'legacy-index.json'),
  report: path.join(documentDir, 'HTML_MIGRATION.md')
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function attr(tag, name) {
  return new RegExp(`\\s${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];
}

function unique(values, label) {
  const seen = new Set();
  values.forEach(value => {
    assert(!seen.has(value), `${label}: duplicate ${value}`);
    seen.add(value);
  });
}

function openingTags(html, element, className) {
  return [...html.matchAll(new RegExp(`<${element}\\b(?=[^>]*\\bclass=["'][^"']*${className})[^>]*>`, 'gi'))].map(match => match[0]);
}

function parentDocumentAudit(parent, html, categories, countries, attrs, globalDevelopments) {
  const rootTag = /<html\b[^>]*>/i.exec(html)?.[0] || '';
  assert(attr(rootTag, attrs.syncVersion) === '1', `${parent.documentKey}: sync version is not 1`);
  assert(['structure', 'content', 'complete'].includes(attr(rootTag, attrs.syncState)), `${parent.documentKey}: invalid sync state`);
  assert(attr(rootTag, attrs.parentId) === parent.id, `${parent.documentKey}: parent ID differs`);
  assert(attr(rootTag, attrs.contextId) == null, `${parent.documentKey}: parent document also has context ID`);

  const representativeSections = openingTags(html, 'section', 'movement-enhancement').filter(tag => attr(tag, attrs.representativeSection) === 'works');
  assert(representativeSections.length === 1, `${parent.documentKey}: expected one representative section, got ${representativeSections.length}`);
  const countryStart = /<section\b[^>]*\bid=["']countries["'][^>]*>/i.exec(html)?.index;
  assert(Number.isInteger(countryStart), `${parent.documentKey}: #countries is missing`);
  const tbodyStart = html.indexOf('<tbody', countryStart);
  const tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  assert(tbodyStart >= 0 && tbodyEnd > tbodyStart, `${parent.documentKey}: country tbody is missing`);
  const countryBody = html.slice(tbodyStart, tbodyEnd);
  const rowTags = [...countryBody.matchAll(/<tr\b[^>]*>/gi)].map(match => match[0]).filter(tag => attr(tag, attrs.developmentId));
  const rowByCategory = new Map();
  const rowByDevelopment = new Map();
  rowTags.forEach(tag => {
    const devId = attr(tag, attrs.developmentId);
    const categoryId = attr(tag, attrs.categoryId);
    const countryIds = (attr(tag, attrs.countryIds) || '').split(/\s+/).filter(Boolean);
    assert(/^dev--[a-z0-9]+(?:-[a-z0-9]+)*$/.test(devId), `${parent.documentKey}: invalid development ID ${devId}`);
    assert(!globalDevelopments.has(devId), `${parent.documentKey}: project duplicate development ID ${devId}`);
    globalDevelopments.add(devId);
    assert(categories.has(categoryId), `${parent.documentKey}: unknown category ${categoryId}`);
    assert(categories.get(categoryId).parentId === parent.id, `${parent.documentKey}: category ${categoryId} belongs to another parent`);
    assert(countryIds.length && countryIds.every(id => countries.has(id)), `${parent.documentKey}: invalid country IDs on ${devId}`);
    assert(!rowByCategory.has(categoryId), `${parent.documentKey}: category ${categoryId} has multiple canonical rows`);
    rowByCategory.set(categoryId, {devId, countryIds: countryIds.join(' ')});
    rowByDevelopment.set(devId, categoryId);
  });

  const representativeCells = [...countryBody.matchAll(/<td\b[^>]*>/gi)].filter(match => attr(match[0], attrs.representativeArtists) != null);
  assert(representativeCells.length === rowTags.length, `${parent.documentKey}: representative cell count differs from bound row count`);
  parent.categoryIds.forEach(categoryId => assert(rowByCategory.has(categoryId), `${parent.documentKey}: missing row for ${categoryId}`));

  const groupTags = openingTags(html, 'section', 'art-atlas-submovement-group').filter(tag => attr(tag, attrs.developmentId));
  const groupByCategory = new Map();
  groupTags.forEach(tag => {
    const devId = attr(tag, attrs.developmentId);
    const categoryId = attr(tag, attrs.categoryId);
    const countryIds = attr(tag, attrs.countryIds);
    assert(rowByDevelopment.get(devId) === categoryId, `${parent.documentKey}: group ${devId} has no matching row`);
    assert(rowByCategory.get(categoryId)?.countryIds === countryIds, `${parent.documentKey}: group countries differ for ${categoryId}`);
    assert(!groupByCategory.has(categoryId), `${parent.documentKey}: category ${categoryId} has multiple bound groups`);
    groupByCategory.set(categoryId, devId);
  });
  parent.categoryIds.forEach(categoryId => assert(groupByCategory.has(categoryId), `${parent.documentKey}: missing card group for ${categoryId}`));
  groupByCategory.forEach((devId, categoryId) => {
    const gridPattern = new RegExp(`<div\\b(?=[^>]*\\bclass=["'][^"']*movement-work-grid)[^>]*${attrs.developmentId}=["']${devId}["'][^>]*>`, 'i');
    assert(gridPattern.test(html), `${parent.documentKey}: group ${categoryId} has no bound grid`);
  });

  return {
    state: attr(rootTag, attrs.syncState),
    rows: rowTags.length,
    groups: groupTags.length,
    cards: openingTags(html, 'article', 'movement-work-card').length,
    scaffoldGroups: groupTags.filter(tag => /\bart-atlas-migration-scaffold\b/.test(tag)).length
  };
}

function contextDocumentAudit(context, html, attrs) {
  const rootTag = /<html\b[^>]*>/i.exec(html)?.[0] || '';
  assert(attr(rootTag, attrs.syncVersion) === '1', `${context.documentKey}: sync version is not 1`);
  assert(['structure', 'content', 'complete'].includes(attr(rootTag, attrs.syncState)), `${context.documentKey}: invalid sync state`);
  assert(attr(rootTag, attrs.contextId) === context.id, `${context.documentKey}: context ID differs`);
  assert(attr(rootTag, attrs.parentId) == null, `${context.documentKey}: context document also has parent ID`);
  const representativeSections = openingTags(html, 'section', 'movement-enhancement').filter(tag => attr(tag, attrs.representativeSection) === 'works');
  assert(representativeSections.length === 1, `${context.documentKey}: expected one representative section`);
  return {state: attr(rootTag, attrs.syncState), cards: openingTags(html, 'article', 'movement-work-card').length};
}

function makeReport(canonical, migration, parentResults, contextResults, legacy) {
  const parents = canonical.parents.filter(parent => parent.role === 'document');
  const modeCounts = parents.reduce((counts, parent) => ({...counts, [parent.categoryMode]: (counts[parent.categoryMode] || 0) + 1}), {});
  const levelCounts = parents.reduce((counts, parent) => ({...counts, [parent.documentLevel]: (counts[parent.documentLevel] || 0) + 1}), {});
  const rows = parents.map(parent => {
    const result = parentResults.get(parent.id);
    const source = migration.existingDocumentBindings[parent.documentKey] ? '기존 내용 이관' : '신규 골격';
    return `| ${parent.name.ko} | \`${parent.id}\` | ${parent.documentLevel} | ${parent.categoryMode} | ${parent.categoryIds.length} | ${source} | ${result.state} |`;
  }).join('\n');
  const contexts = canonical.contextReferences.map(context => `| ${context.name.ko} | \`${context.id}\` | ${contextResults.get(context.id).state} |`).join('\n');
  const legacyRows = Object.entries(legacy.documents || {}).map(([key, value]) => `| ${key} | ${value.ownerId ? `\`${value.ownerId}\`` : '-'} | ${value.categoryId ? `\`${value.categoryId}\`` : '-'} | ${value.placement} |`).join('\n');
  const totalRows = [...parentResults.values()].reduce((sum, result) => sum + result.rows, 0);
  const totalGroups = [...parentResults.values()].reduce((sum, result) => sum + result.groups, 0);
  const totalCards = [...parentResults.values()].reduce((sum, result) => sum + result.cards, 0) + [...contextResults.values()].reduce((sum, result) => sum + result.cards, 0);
  return `# 사조 HTML 4단계 이관 결과\n\n` +
    `이 문서는 \`data/art-movement-canonical.json\`과 현재 HTML을 검사해 자동 생성한다. \`structure\`는 4단계 구조 이관, \`content\`는 5단계 대표 콘텐츠 구축, \`complete\`는 6단계 편집 동기화 완료 상태다.\n\n` +
    `## 요약\n\n` +
    `- 정본 부모 문서: ${parents.length}개 (${modeCounts.linked}개 세부 범주 연동형, ${modeCounts.single}개 단일 부모형)\n` +
    `- 문서 수준: 상세 ${levelCounts.detailed}개, 연결 ${levelCounts.bridge}개, 참고 ${levelCounts.reference}개\n` +
    `- 이전 미술 참고 문서: ${canonical.contextReferences.length}개\n` +
    `- 초심자 핵심 범주 행·카드 묶음: ${totalRows}개 / ${totalGroups}개\n` +
    `- 보존된 기존 대표작 카드: ${totalCards}개\n` +
    `- 정본 색인 밖에 보존한 원문 문서: ${Object.keys(legacy.documents || {}).length}개\n\n` +
    `## 부모 문서\n\n| 문서 | 부모 ID | 수준 | 방식 | 범주 | 출처 | 상태 |\n|---|---|---|---|---:|---|---|\n${rows}\n\n` +
    `## 이전 미술 참고\n\n| 문서 | 참고 ID | 상태 |\n|---|---|---|\n${contexts}\n\n` +
    `## 색인 밖 보존 문서\n\n| 기존 문서 | 흡수 부모 | 흡수 범주 | 용도 |\n|---|---|---|---|\n${legacyRows}\n`;
}

function main() {
  const write = process.argv.includes('--write');
  const canonical = readJson(files.canonical);
  const contract = readJson(files.contract);
  const migration = readJson(files.migration);
  const movementData = readJson(files.movements);
  const index = readJson(files.index);
  const legacy = readJson(files.legacy);
  const attrs = contract.attributes;
  const parents = canonical.parents.filter(parent => parent.role === 'document');
  const contexts = canonical.contextReferences;
  const expectedKeys = [...parents.map(parent => parent.documentKey), ...contexts.map(context => context.documentKey)];
  const actualKeys = Object.keys(index.documents || {});
  assert(actualKeys.length === 36, `expected 36 indexed documents, got ${actualKeys.length}`);
  assert(expectedKeys.every(key => actualKeys.includes(key)) && actualKeys.every(key => expectedKeys.includes(key)), 'document index differs from canonical targets');
  unique(actualKeys.map(key => index.documents[key]?.['1']), 'document paths');
  const categories = new Map(canonical.categories.map(category => [category.id, category]));
  const countries = new Set(movementData.countries.map(country => country.id));
  const globalDevelopments = new Set();
  const parentResults = new Map();
  parents.forEach(parent => {
    const relative = index.documents[parent.documentKey]['1'];
    const absolute = path.join(root, relative);
    assert(fs.existsSync(absolute), `${parent.documentKey}: file is missing`);
    parentResults.set(parent.id, parentDocumentAudit(parent, fs.readFileSync(absolute, 'utf8'), categories, countries, attrs, globalDevelopments));
  });
  const contextResults = new Map();
  contexts.forEach(context => {
    const relative = index.documents[context.documentKey]['1'];
    const absolute = path.join(root, relative);
    assert(fs.existsSync(absolute), `${context.documentKey}: file is missing`);
    contextResults.set(context.id, contextDocumentAudit(context, fs.readFileSync(absolute, 'utf8'), attrs));
  });
  assert(globalDevelopments.size === 68, `expected 68 canonical development rows, got ${globalDevelopments.size}`);
  assert(Object.keys(legacy.documents || {}).length === 8, 'legacy index must preserve eight source documents');
  Object.entries(legacy.documents || {}).forEach(([key, value]) => assert(fs.existsSync(path.join(root, value['1'])), `${key}: legacy source file is missing`));
  const report = makeReport(canonical, migration, parentResults, contextResults, legacy);
  if (write) fs.writeFileSync(files.report, report, 'utf8');
  else {
    assert(fs.existsSync(files.report), 'HTML migration report is missing; run with --write');
    assert(fs.readFileSync(files.report, 'utf8') === report, 'HTML migration report is stale; run with --write');
  }
  const states = [...parentResults.values(), ...contextResults.values()].reduce((counts, result) => ({...counts, [result.state]: (counts[result.state] || 0) + 1}), {});
  console.log(JSON.stringify({documents: actualKeys.length, parents: parents.length, contexts: contexts.length, linked: parents.filter(parent => parent.categoryMode === 'linked').length, single: parents.filter(parent => parent.categoryMode === 'single').length, developments: globalDevelopments.size, states, legacyDocuments: Object.keys(legacy.documents).length, report: path.relative(root, files.report).replace(/\\/g, '/')}, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
