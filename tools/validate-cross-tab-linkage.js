#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const canonical = readJson('data/art-movement-canonical.json');
const movements = readJson('data/art-movements.json');
const migration = readJson('data/art-movement-document-migration.json');
const index = readJson('data/미술사조/index.json');
const guides = readJson('data/art-movement-learning-guides.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function developmentId(categoryId) {
  const countries = migration.categoryCountries?.[categoryId];
  assert(countries?.length, `${categoryId}: category countries are missing`);
  return `dev--${categoryId.replace(/--/g, '-')}-${countries[0]}`;
}

function main() {
  const parents = canonical.parents || [];
  const contexts = canonical.contextReferences || [];
  const categories = canonical.categories || [];
  const parentById = new Map(parents.map(parent => [parent.id, parent]));
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const countryIds = new Set();
  const reachedCategories = new Set();
  const reachedDevelopments = new Set();
  let boundBars = 0;

  for (const country of movements.countries || []) {
    assert(country.id && !countryIds.has(country.id), `Duplicate or empty country ID: ${country.id || '(empty)'}`);
    countryIds.add(country.id);
    for (const movement of country.movements || []) {
      const binding = movement.canonical;
      if (!binding) continue;
      boundBars += 1;
      const parent = parentById.get(binding.parentId);
      const owner = parentById.get(binding.documentOwnerId);
      assert(parent, `${country.id}: unknown parent ${binding.parentId}`);
      assert(owner?.role === 'document', `${country.id}: invalid document owner ${binding.documentOwnerId}`);
      assert(parent.role === 'document' ? parent.id === owner.id : parent.documentOwnerId === owner.id, `${country.id}: parent/owner relationship differs for ${parent.id}`);
      assert(Array.isArray(binding.categoryIds) && Array.isArray(binding.developmentIds), `${country.id}/${parent.id}: canonical arrays are missing`);
      assert(binding.categoryIds.length === binding.developmentIds.length, `${country.id}/${parent.id}: category/development counts differ`);
      binding.categoryIds.forEach((categoryId, position) => {
        assert(categoryById.get(categoryId)?.parentId === owner.id, `${country.id}: ${categoryId} does not belong to ${owner.id}`);
        assert(migration.categoryCountries[categoryId].includes(country.id), `${country.id}: ${categoryId} is not assigned to this country`);
        const expectedDevelopmentId = developmentId(categoryId);
        assert(binding.developmentIds[position] === expectedDevelopmentId, `${country.id}: ${categoryId} development ID differs`);
        reachedCategories.add(categoryId);
        reachedDevelopments.add(expectedDevelopmentId);
      });
    }
  }

  assert(reachedCategories.size === categories.length, `Movement bars reach ${reachedCategories.size}/${categories.length} canonical categories`);
  assert(reachedDevelopments.size === categories.length, `Movement bars reach ${reachedDevelopments.size}/${categories.length} canonical developments`);

  const documentByKey = new Map([
    ...parents.filter(parent => parent.role === 'document').map(parent => [parent.documentKey, parent.id]),
    ...contexts.map(context => [context.documentKey, context.id])
  ]);
  for (const [documentKey, slots] of Object.entries(index.documents || {})) {
    assert(documentByKey.has(documentKey), `Unknown active document key: ${documentKey}`);
    const relative = slots?.['1'];
    assert(relative && fs.existsSync(path.join(root, relative)), `${documentKey}: active document file is missing`);
  }

  const guideIds = new Set(Object.keys(guides.documents || {}));
  const canonicalGuideIds = new Set(documentByKey.values());
  assert(guideIds.size === canonicalGuideIds.size && [...canonicalGuideIds].every(id => guideIds.has(id)), 'Learning guide IDs differ from canonical document targets');

  console.log(JSON.stringify({countries: countryIds.size, boundBars, categories: reachedCategories.size, developments: reachedDevelopments.size, activeDocuments: Object.keys(index.documents || {}).length, learningGuides: guideIds.size}, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
