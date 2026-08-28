#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = {
  canonical: path.join(root, 'data', 'art-movement-canonical.json'),
  contract: path.join(root, 'data', 'art-movement-sync-contract.json'),
  migration: path.join(root, 'data', 'art-movement-document-migration.json'),
  movements: path.join(root, 'data', 'art-movements.json'),
  taxonomy: path.join(root, 'data', 'art-taxonomy.json'),
  index: path.join(root, 'data', '미술사조', 'index.json'),
  report: path.join(root, 'data', '미술사조', 'SYNC_COMPLETE.md')
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function compact(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^0-9a-z가-힣]+/g, '');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function developmentId(categoryId, countries) {
  return `dev--${categoryId.replace(/--/g, '-')}-${countries[0]}`;
}

function parentAliases(canonical, taxonomy) {
  const taxonomyMap = new Map((taxonomy.movements || []).map(movement => [movement.id, movement]));
  return canonical.parents.map(parent => {
    const taxonomyMovement = taxonomyMap.get(parent.id);
    const categoryNames = canonical.categories.filter(category => {
      const absorbedOwner = canonical.parents.find(candidate => candidate.categoryId === category.id);
      return absorbedOwner ? absorbedOwner.id === parent.id : category.parentId === parent.id;
    })
      .flatMap(category => [category.name?.ko, category.name?.en]);
    const values = [parent.name?.ko, parent.name?.en, taxonomyMovement?.name, ...(taxonomyMovement?.submovements || []), ...categoryNames]
      .map(compact).filter(value => value.length >= 3);
    return {parent, values:[...new Set(values)]};
  });
}

function ensureCategoryCountryBars(movements, canonical, migration, aliases) {
  const defaults = {
    academicism:{start:1820,end:1900,color:'#8a7e68'},
    'social-realism':{start:1920,end:1950,color:'#a07b52'},
    'nouveau-realisme':{start:1960,end:1970,color:'#557f95'}
  };
  const countryMap = new Map(movements.countries.map(country => [country.id, country]));
  const categoryParent = category => canonical.parents.find(parent => parent.categoryId === category.id) || canonical.parents.find(parent => parent.id === category.parentId);
  canonical.categories.forEach(category => migration.categoryCountries[category.id].forEach(countryId => {
    const country = countryMap.get(countryId);
    const target = categoryParent(category);
    assert(country && target, `${category.id}: cannot resolve category country bar`);
    if ((country.movements || []).some(movement => resolveParent(movement, aliases)?.id === target.id)) return;
    const source = movements.countries.flatMap(item => item.movements || []).find(movement => resolveParent(movement, aliases)?.id === target.id);
    const fallback = source || defaults[target.id] || defaults[target.documentOwnerId];
    assert(fallback, `${category.id}: no dated source bar is available for ${target.id}`);
    country.movements.push({
      name:{...target.name},
      start:fallback.start,
      end:fallback.end,
      color:fallback.color,
      kind:{ko:'정본 범주 전개',en:'Canonical category development'}
    });
  }));
}

function resolveParent(movement, aliases) {
  const names = [compact(movement.name?.ko), compact(movement.name?.en)].filter(Boolean);
  const matches = aliases.flatMap(entry => entry.values.flatMap(alias => names.map(name => {
    if (name === alias) return {parent:entry.parent, score:10000 + alias.length};
    if (name.includes(alias)) return {parent:entry.parent, score:alias.length};
    return null;
  }).filter(Boolean)));
  return matches.sort((left, right) => right.score - left.score)[0]?.parent || null;
}

function canonicalBinding(parent, countryId, parentMap, migration) {
  const ownerId = parent.role === 'document' ? parent.id : parent.documentOwnerId;
  const owner = parentMap.get(ownerId);
  assert(owner?.role === 'document', `${parent.id}: document owner ${ownerId} is invalid`);
  const candidates = parent.categoryId ? [parent.categoryId] : owner.categoryIds;
  const categoryIds = candidates.filter(categoryId => migration.categoryCountries[categoryId]?.includes(countryId));
  return {
    parentId: parent.id,
    documentOwnerId: ownerId,
    categoryIds,
    developmentIds: categoryIds.map(categoryId => developmentId(categoryId, migration.categoryCountries[categoryId]))
  };
}

function makeReport(result) {
  const parentRows = [...result.parentCounts.entries()].sort((left, right) => right[1] - left[1])
    .map(([id, count]) => `| \`${id}\` | ${count} |`).join('\n');
  return `# 사조 HTML 6단계 ID 동기화 완료\n\n` +
    `이 보고서는 \`tools/complete-movement-sync-v1.js\`가 정본 분류와 실제 문서를 검사해 생성한다.\n\n` +
    `## 결과\n\n` +
    `- ID 편집이 활성화된 부모 문서: ${result.completeDocuments}개\n` +
    `- 구조 참고 상태를 유지한 이전 미술 문서: ${result.contextDocuments}개\n` +
    `- 정본 바인딩이 기록된 국가별 사조 막대: ${result.boundBars}개\n` +
    `- 화가 리스트에 범주를 만드는 막대: ${result.categoryBars}개\n` +
    `- 막대에서 도달 가능한 정본 범주/전개: ${result.reachedCategories.size}개 / ${result.reachedDevelopments.size}개\n` +
    `- 정본 범주가 없는 학술 지도 막대: ${result.emptyCategoryBars}개\n\n` +
    `## 부모별 연결 막대\n\n| 부모 ID | 막대 수 |\n|---|---:|\n${parentRows}\n`;
}

function serializeMovements(data) {
  const context = JSON.stringify(data.contextOnlyMovements || [], null, 2).split('\n').map((line, index) => index ? `  ${line}` : line).join('\n');
  const countries = data.countries.map(country => {
    const heading = `    {"id":${JSON.stringify(country.id)},"name":${JSON.stringify(country.name)},"movements":[`;
    const movementRows = (country.movements || []).map(movement => `      ${JSON.stringify(movement)}`).join(',\n');
    return `${heading}\n${movementRows}\n    ]}`;
  }).join(',\n');
  return `{\n  "contextOnlyMovements": ${context},\n  "countries": [\n${countries}\n  ]\n}\n`;
}

function build(write) {
  const canonical = readJson(files.canonical);
  const contract = readJson(files.contract);
  const migration = readJson(files.migration);
  const movements = readJson(files.movements);
  const taxonomy = readJson(files.taxonomy);
  const index = readJson(files.index);
  const parentMap = new Map(canonical.parents.map(parent => [parent.id, parent]));
  const aliases = parentAliases(canonical, taxonomy);
  ensureCategoryCountryBars(movements, canonical, migration, aliases);
  const reachedCategories = new Set();
  const reachedDevelopments = new Set();
  const parentCounts = new Map();
  let boundBars = 0;
  let categoryBars = 0;
  let emptyCategoryBars = 0;

  movements.countries.forEach(country => (country.movements || []).forEach(movement => {
    const parent = resolveParent(movement, aliases);
    if (!parent) {
      delete movement.canonical;
      return;
    }
    movement.canonical = canonicalBinding(parent, country.id, parentMap, migration);
    boundBars += 1;
    parentCounts.set(parent.id, (parentCounts.get(parent.id) || 0) + 1);
    if (movement.canonical.categoryIds.length) categoryBars += 1;
    else emptyCategoryBars += 1;
    movement.canonical.categoryIds.forEach(id => reachedCategories.add(id));
    movement.canonical.developmentIds.forEach(id => reachedDevelopments.add(id));
  }));

  const missingCategories = canonical.categories.map(category => category.id).filter(id => !reachedCategories.has(id));
  assert(reachedCategories.size === canonical.counts.beginnerCategories, `Only ${reachedCategories.size}/${canonical.counts.beginnerCategories} canonical categories are reachable from movement bars: ${missingCategories.join(', ')}`);
  const expectedDevelopments = canonical.categories.map(category => developmentId(category.id, migration.categoryCountries[category.id]));
  const missingDevelopments = expectedDevelopments.filter(id => !reachedDevelopments.has(id));
  assert(reachedDevelopments.size === canonical.counts.beginnerCategories, `Only ${reachedDevelopments.size}/${canonical.counts.beginnerCategories} developments are reachable from movement bars: ${missingDevelopments.join(', ')}`);

  let completeDocuments = 0;
  canonical.parents.filter(parent => parent.role === 'document').forEach(parent => {
    const relative = index.documents?.[parent.documentKey]?.['1'];
    assert(relative, `${parent.documentKey}: indexed HTML is missing`);
    const file = path.join(root, relative);
    const before = fs.readFileSync(file, 'utf8');
    const rootTag = /<html\b[^>]*>/i.exec(before)?.[0] || '';
    assert(new RegExp(`\\b${contract.attributes.parentId}=["']${parent.id}["']`, 'i').test(rootTag), `${parent.id}: root parent ID mismatch`);
    assert(new RegExp(`\\b${contract.attributes.syncState}=["'](?:content|complete)["']`, 'i').test(rootTag), `${parent.id}: document is not ready for phase 6`);
    const after = before.replace(new RegExp(`(${contract.attributes.syncState}=["'])content(["'])`, 'i'), '$1complete$2');
    if (write && before !== after) fs.writeFileSync(file, after, 'utf8');
    completeDocuments += 1;
  });

  const result = {
    completeDocuments,
    contextDocuments: canonical.contextReferences.length,
    boundBars,
    categoryBars,
    emptyCategoryBars,
    reachedCategories,
    reachedDevelopments,
    parentCounts
  };
  const report = makeReport(result);
  if (write) {
    fs.writeFileSync(files.movements, serializeMovements(movements), 'utf8');
    fs.writeFileSync(files.report, report, 'utf8');
  } else if (fs.existsSync(files.report)) {
    assert(fs.readFileSync(files.report, 'utf8') === report, 'Phase 6 report is stale; run with --write');
  }
  return result;
}

try {
  const result = build(process.argv.includes('--write'));
  console.log(JSON.stringify({
    completeDocuments:result.completeDocuments,
    contextDocuments:result.contextDocuments,
    boundBars:result.boundBars,
    categoryBars:result.categoryBars,
    emptyCategoryBars:result.emptyCategoryBars,
    reachedCategories:result.reachedCategories.size,
    reachedDevelopments:result.reachedDevelopments.size,
    parentBindings:result.parentCounts.size
  }, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
