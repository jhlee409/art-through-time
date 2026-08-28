#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const canonicalFile = path.join(root, 'data', 'art-movement-canonical.json');
const taxonomyFile = path.join(root, 'data', 'art-taxonomy.json');
const documentIndexFile = path.join(root, 'data', '미술사조', 'index.json');
const reportFile = path.join(root, 'data', '미술사조', 'CANONICAL_TAXONOMY.md');
const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function unique(items, label) {
  const seen = new Set();
  items.forEach(item => {
    assert(!seen.has(item), `${label} contains a duplicate: ${item}`);
    seen.add(item);
  });
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    counts[item[field]] = (counts[item[field]] || 0) + 1;
    return counts;
  }, {});
}

function validate(data, taxonomy, documentIndex) {
  const parents = data.parents || [];
  const categories = data.categories || [];
  const contexts = data.contextReferences || [];
  const taxonomyParents = taxonomy.movements || [];
  const documents = parents.filter(parent => parent.role === 'document');
  const absorbed = parents.filter(parent => parent.role === 'absorbed');
  const parentById = new Map(parents.map(parent => [parent.id, parent]));
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const parentDisplayOrder = data.parentDisplayOrder || [];
  const validLevels = new Set(Object.keys(data.documentLevels || {}));
  const validKinds = new Set(Object.keys(data.categoryKinds || {}));

  assert(data.status === 'frozen-for-migration', 'canonical status must be frozen-for-migration');
  assert(parents.length === data.counts.parents, 'parent count differs from declared count');
  assert(categories.length === data.counts.beginnerCategories, 'category count differs from declared count');
  assert(contexts.length === data.counts.contextReferences, 'context reference count differs from declared count');
  assert(taxonomyParents.length === parents.length, 'canonical parents differ from art-taxonomy parent count');

  unique(parents.map(parent => parent.id), 'parent IDs');
  unique(parentDisplayOrder, 'parent display order');
  unique(categories.map(category => category.id), 'category IDs');
  unique(documents.map(parent => parent.documentKey), 'document keys');
  unique(contexts.map(context => context.id), 'context IDs');
  parents.forEach(parent => assert(stableId.test(parent.id), `invalid parent ID: ${parent.id}`));
  assert(parentDisplayOrder.length === parents.length, 'parent display order must contain every parent');
  assert(parentDisplayOrder.every(id => parentById.has(id)), 'parent display order contains an unknown parent');
  categories.forEach(category => assert(stableId.test(category.id) && category.id.includes('--'), `invalid category ID: ${category.id}`));
  contexts.forEach(context => assert(stableId.test(context.id) && context.id.includes('--'), `invalid context ID: ${context.id}`));

  taxonomyParents.forEach((source, index) => {
    const canonical = parents[index];
    assert(canonical.id === source.id, `parent order or ID differs from art-taxonomy at index ${index}: ${canonical.id} / ${source.id}`);
    assert(canonical.name?.ko === source.name, `Korean parent name differs for ${source.id}`);
  });

  assert(documents.length === data.counts.documentParents, 'document parent count differs from declared count');
  assert(absorbed.length === data.counts.absorbedParents, 'absorbed parent count differs from declared count');
  const levels = countBy(documents, 'documentLevel');
  const modes = countBy(documents, 'categoryMode');
  assert(levels.detailed === data.counts.detailedDocuments, 'detailed document count differs from declared count');
  assert(levels.bridge === data.counts.bridgeDocuments, 'bridge document count differs from declared count');
  assert(levels.reference === data.counts.referenceDocuments, 'reference document count differs from declared count');
  assert(modes.linked === data.counts.linkedDocuments, 'linked document count differs from declared count');
  assert(modes.single === data.counts.singleDocuments, 'single document count differs from declared count');

  documents.forEach(parent => {
    assert(validLevels.has(parent.documentLevel), `invalid document level for ${parent.id}`);
    assert(['linked', 'single'].includes(parent.categoryMode), `invalid category mode for ${parent.id}`);
    assert(parent.documentKey, `documentKey is required for ${parent.id}`);
    const categoryIds = parent.categoryIds || [];
    assert(parent.categoryMode === 'linked' ? categoryIds.length >= 2 : categoryIds.length === 1, `category count does not match mode for ${parent.id}`);
    unique(categoryIds, `${parent.id} categoryIds`);
    categoryIds.forEach(categoryId => {
      const category = categoryById.get(categoryId);
      assert(category, `${parent.id} references missing category ${categoryId}`);
      assert(category.parentId === parent.id, `${categoryId} belongs to ${category.parentId}, not ${parent.id}`);
    });
  });

  absorbed.forEach(parent => {
    const owner = parentById.get(parent.documentOwnerId);
    assert(owner?.role === 'document', `${parent.id} has invalid documentOwnerId: ${parent.documentOwnerId}`);
    assert(['context', 'category'].includes(parent.placement), `${parent.id} has invalid placement`);
    assert(!parent.documentKey && !parent.categoryIds, `${parent.id} must not define its own document or category list`);
    if (parent.placement === 'category') {
      const category = categoryById.get(parent.categoryId);
      assert(category?.parentId === owner.id, `${parent.id} category is not owned by ${owner.id}`);
      assert((category.includesParentIds || []).includes(parent.id), `${parent.categoryId} must include absorbed parent ${parent.id}`);
    }
  });

  categories.forEach(category => {
    const parent = parentById.get(category.parentId);
    assert(parent?.role === 'document', `${category.id} has invalid parent ${category.parentId}`);
    assert(parent.categoryIds.includes(category.id), `${category.id} is absent from ${category.parentId}.categoryIds`);
    assert(validKinds.has(category.kind), `${category.id} has invalid category kind: ${category.kind}`);
    assert(category.name?.ko && category.name?.en, `${category.id} needs Korean and English names`);
    (category.includesParentIds || []).forEach(parentId => {
      const included = parentById.get(parentId);
      assert(included?.role === 'absorbed', `${category.id} includes a non-absorbed parent: ${parentId}`);
      assert(included.documentOwnerId === category.parentId, `${parentId} is absorbed into ${included.documentOwnerId}, not ${category.parentId}`);
    });
  });

  contexts.forEach(context => {
    assert(context.name?.ko && context.name?.en && context.documentKey, `invalid context reference: ${context.id}`);
    assert(documentIndex.documents?.[context.documentKey], `context document is not registered: ${context.documentKey}`);
    assert(!parentById.has(context.id), `context reference collides with a parent: ${context.id}`);
  });

  return {parents: parents.length, documents: documents.length, absorbed: absorbed.length, categories: categories.length, levels, modes, contexts: contexts.length};
}

function categoryNames(parent, categoryById) {
  return parent.categoryIds.map(id => `${categoryById.get(id).name.ko} (\`${id}\`)`).join('<br>');
}

function makeReport(data) {
  const displayPosition = new Map(data.parentDisplayOrder.map((id, index) => [id, index]));
  const byDisplayOrder = (left, right) => displayPosition.get(left.id) - displayPosition.get(right.id);
  const documents = data.parents.filter(parent => parent.role === 'document').sort(byDisplayOrder);
  const absorbed = data.parents.filter(parent => parent.role === 'absorbed').sort(byDisplayOrder);
  const categoryById = new Map(data.categories.map(category => [category.id, category]));
  const levelLabel = {detailed: '상세형', bridge: '연결형', reference: '참고형'};
  const modeLabel = {linked: '세부 범주 연동형', single: '단일 부모형'};
  const documentRows = documents.map(parent => `| \`${parent.id}\` | ${parent.name.ko} | ${levelLabel[parent.documentLevel]} | ${modeLabel[parent.categoryMode]} | ${categoryNames(parent, categoryById)} |`).join('\n');
  const absorbedRows = absorbed.map(parent => {
    const owner = data.parents.find(item => item.id === parent.documentOwnerId);
    const placement = parent.placement === 'category' ? `핵심 범주 \`${parent.categoryId}\`` : '문서 안 맥락';
    return `| \`${parent.id}\` | ${parent.name.ko} | ${owner.name.ko} | ${placement} |`;
  }).join('\n');
  const contextRows = data.contextReferences.map(context => `| \`${context.id}\` | ${context.name.ko} | \`${context.documentKey}\` |`).join('\n');
  const sourceRows = data.sources.map(source => `- [${source.publisher}: ${source.title}](${source.url}): ${source.supports.join(', ')}`).join('\n');
  return `# 미술 사조 정본 분류\n\n` +
    `이 문서는 \`data/art-movement-canonical.json\`에서 자동 생성된다. 재구축 과정에서 국가 전개 표, 대표작 카드, 화가 리스트가 공유할 안정 ID의 기준이다.\n\n` +
    `## 고정 수치\n\n` +
    `- 부모 사조 44개: 독립 문서 34개, 상위 문서 흡수형 10개\n` +
    `- 독립 문서 34개: 상세형 20개, 연결형 6개, 참고형 8개\n` +
    `- 표시 구조: 세부 범주 연동형 24개, 단일 부모형 10개\n` +
    `- 초심자 핵심 범주 68개, 이전 미술 참고 문서 2개\n\n` +
    `## 사용 원칙\n\n` +
    `- 부모 ID는 기존 \`data/art-taxonomy.json\`과 동일하게 유지한다.\n` +
    `- 역사적 표시 순서는 \`parentDisplayOrder\`를 사용한다.\n` +
    `- 표, 카드, 화가 리스트는 표시 문자열이 아니라 \`categoryId\`로 연결한다.\n` +
    `- 흡수형 부모는 학술 지도 막대를 유지하되 독립 HTML을 만들지 않는다.\n` +
    `- 고딕 미술과 후기 비잔틴 미술은 부모 수에 넣지 않고 1400년 무렵의 이전 미술 참고로만 사용한다.\n\n` +
    `## 독립 문서 34개\n\n` +
    `| 부모 ID | 사조 | 문서 수준 | 표시 구조 | 정본 범주 |\n|---|---|---|---|---|\n${documentRows}\n\n` +
    `## 흡수형 부모 10개\n\n` +
    `| 부모 ID | 사조 | 설명 문서 | 배치 |\n|---|---|---|---|\n${absorbedRows}\n\n` +
    `## 이전 미술 참고 2개\n\n` +
    `| 참고 ID | 이름 | 문서 키 |\n|---|---|---|\n${contextRows}\n\n` +
    `## 분류 근거\n\n${sourceRows}\n`;
}

function main() {
  const write = process.argv.includes('--write');
  const data = JSON.parse(fs.readFileSync(canonicalFile, 'utf8'));
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyFile, 'utf8'));
  const documentIndex = JSON.parse(fs.readFileSync(documentIndexFile, 'utf8'));
  const summary = validate(data, taxonomy, documentIndex);
  const report = makeReport(data);
  if (write) fs.writeFileSync(reportFile, report, 'utf8');
  else {
    assert(fs.existsSync(reportFile), 'canonical taxonomy report is missing; run with --write');
    assert(fs.readFileSync(reportFile, 'utf8') === report, 'canonical taxonomy report is stale; run with --write');
  }
  console.log(JSON.stringify({...summary, report:path.relative(root, reportFile).replace(/\\/g, '/')}, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
