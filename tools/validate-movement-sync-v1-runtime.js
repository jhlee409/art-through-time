#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {
  assertStableEditableStructure,
  parseMovementDocument,
  synchronizeTableArtistOrder,
  validateCompleteDocument
} = require('../movement-sync-v1');

const root = path.resolve(__dirname, '..');
const canonical = require('../data/art-movement-canonical.json');
const movements = require('../data/art-movements.json');
const migration = require('../data/art-movement-document-migration.json');
const artists = require('../data/artists.json');
const index = require('../data/미술사조/index.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function developmentId(categoryId) {
  return `dev--${categoryId.replace(/--/g, '-')}-${migration.categoryCountries[categoryId][0]}`;
}

const parentMap = new Map(canonical.parents.map(parent => [parent.id, parent]));
const categoryMap = new Map(canonical.categories.map(category => [category.id, category]));
const countryIds = new Set(movements.countries.map(country => country.id));
const reachedCategories = new Set();
const reachedDevelopments = new Set();
let boundBars = 0;

movements.countries.forEach(country => (country.movements || []).forEach(movement => {
  const binding = movement.canonical;
  if (!binding) return;
  boundBars += 1;
  const parent = parentMap.get(binding.parentId);
  const owner = parentMap.get(binding.documentOwnerId);
  assert(parent, `${country.id}/${movement.name?.en}: unknown canonical parent ${binding.parentId}`);
  assert(owner?.role === 'document', `${country.id}/${movement.name?.en}: invalid document owner ${binding.documentOwnerId}`);
  assert(parent.role === 'document' ? parent.id === owner.id : parent.documentOwnerId === owner.id, `${country.id}/${movement.name?.en}: parent/owner relationship differs from canonical taxonomy`);
  assert(binding.categoryIds.length === binding.developmentIds.length, `${country.id}/${movement.name?.en}: category/development binding count differs`);
  binding.categoryIds.forEach((categoryId, index) => {
    assert(categoryMap.get(categoryId)?.parentId === owner.id, `${categoryId}: category does not belong to ${owner.id}`);
    assert(binding.developmentIds[index] === developmentId(categoryId), `${categoryId}: development ID differs from the document contract`);
    reachedCategories.add(categoryId);
    reachedDevelopments.add(binding.developmentIds[index]);
  });
}));
assert(reachedCategories.size === canonical.counts.beginnerCategories, `Movement bars reach ${reachedCategories.size}/${canonical.counts.beginnerCategories} categories`);
assert(reachedDevelopments.size === canonical.counts.beginnerCategories, `Movement bars reach ${reachedDevelopments.size}/${canonical.counts.beginnerCategories} developments`);

const globalDevelopments = new Set();
let documents = 0;
let cards = 0;
canonical.parents.filter(parent => parent.role === 'document').forEach(parent => {
  const relative = index.documents?.[parent.documentKey]?.['1'];
  assert(relative, `${parent.documentKey}: document is not indexed`);
  const documentFile = path.join(root, relative);
  const html = fs.readFileSync(documentFile, 'utf8');
  const result = validateCompleteDocument(html, {canonical,artists,movements,documentFile});
  assertStableEditableStructure(html, html);
  assert(synchronizeTableArtistOrder(html) === html, `${parent.id}: table and card order are not stored identically`);
  const parsed = parseMovementDocument(html);
  parsed.rows.forEach(row => {
    assert(!globalDevelopments.has(row.developmentId), `${row.developmentId}: development ID is duplicated across documents`);
    globalDevelopments.add(row.developmentId);
  });
  documents += 1;
  cards += result.cards;
});
assert(documents === canonical.counts.documentParents, `Validated ${documents}/${canonical.counts.documentParents} complete documents`);
assert(globalDevelopments.size === canonical.counts.beginnerCategories, `Validated ${globalDevelopments.size}/${canonical.counts.beginnerCategories} unique developments`);

const sampleParent = canonical.parents.find(parent => parent.role === 'document');
const sampleFile = path.join(root, index.documents[sampleParent.documentKey]['1']);
const sample = fs.readFileSync(sampleFile, 'utf8');
const changedClassification = sample.replace(/(<article\b[^>]*data-art-atlas-development-id=")([^"]+)/i, '$1dev--forbidden-cross-category');
let rejected = false;
try { assertStableEditableStructure(sample, changedClassification); } catch (_) { rejected = true; }
assert(rejected, 'Save transaction did not reject a cross-development card mutation');

const sourceChecks = [
  ['server-content.js', "require('./movement-sync-v1')"],
  ['server-content.js', 'assertStableEditableStructure(current,source)'],
  ['app-detail.js', 'artAtlasDevelopmentId'],
  ['app-detail.js', 'art-atlas-movement-document-saved'],
  ['app-atlas.js', 'development::${entry.developmentId}'],
  ['app-atlas.js', 'clipped.canonical']
];
sourceChecks.forEach(([file, token]) => assert(fs.readFileSync(path.join(root, file), 'utf8').includes(token), `${file}: missing runtime sync token ${token}`));
assert(countryIds.has('global-contemporary'), 'Global contemporary country axis is missing');

console.log(JSON.stringify({documents,cards,developments:globalDevelopments.size,boundBars,reachedCategories:reachedCategories.size,transactionRejection:true}, null, 2));
