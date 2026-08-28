#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const canonical = require('../data/art-movement-canonical.json');
const contract = require('../data/art-movement-sync-contract.json');
const representatives = require('../data/art-movement-representatives.json');
const artistsData = require('../data/artists.json');
const index = require('../data/미술사조/index.json');
const attrs = contract.attributes;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function attr(tag, name) {
  return new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(value => value !== undefined) || '';
}

function openingTags(source, tagName, className = '') {
  const matches = [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))];
  return className ? matches.filter(match => new RegExp(`\\b${className}\\b`, 'i').test(attr(match[0], 'class'))) : matches;
}

function elementEnd(source, start, tagName) {
  const pattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  pattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = pattern.exec(source))) {
    if (/^<\//.test(match[0])) depth -= 1;
    else if (!/\/>$/.test(match[0])) depth += 1;
    if (depth === 0) return pattern.lastIndex;
  }
  throw new Error(`Unclosed <${tagName}> at ${start}`);
}

function element(source, match, tagName) {
  return source.slice(match.index, elementEnd(source, match.index, tagName));
}

function textContent(source) {
  return source.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function artistIds(source) {
  return openingTags(source, 'a').map(match => attr(match[0], attrs.artistId)).filter(Boolean);
}

function localImageFile(documentFile, src) {
  return path.resolve(path.dirname(documentFile), src.split(/[?#]/)[0]);
}

function validateDocument(parent, entries, artistMap) {
  const relative = index.documents?.[parent.documentKey]?.['1'];
  assert(relative, `${parent.id}: indexed document is missing`);
  const documentFile = path.join(root, relative);
  const html = fs.readFileSync(documentFile, 'utf8');
  const rootTag = /<html\b[^>]*>/i.exec(html)?.[0] || '';
  assert(attr(rootTag, attrs.syncVersion) === contract.documentSyncVersion, `${parent.id}: sync version mismatch`);
  assert(attr(rootTag, attrs.syncState) === 'content', `${parent.id}: phase 5 document must be in content state`);
  assert(attr(rootTag, attrs.parentId) === parent.id, `${parent.id}: parent ID mismatch`);

  const countrySectionMatch = openingTags(html, 'section').find(match => attr(match[0], 'id') === 'countries');
  assert(countrySectionMatch, `${parent.id}: #countries is missing`);
  const countrySection = element(html, countrySectionMatch, 'section');
  const bodyRows = [...countrySection.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].filter(match => /<td\b/i.test(match[0]));
  assert(bodyRows.length === entries.length, `${parent.id}: expected ${entries.length} data rows, got ${bodyRows.length}`);
  const rowCategoryOrder = bodyRows.map(match => attr(/^<tr\b[^>]*>/i.exec(match[0])?.[0] || '', attrs.categoryId));
  assert(JSON.stringify(rowCategoryOrder) === JSON.stringify(parent.categoryIds), `${parent.id}: country row category order mismatch`);

  const representativeSectionMatches = openingTags(html, 'section').filter(match => attr(match[0], attrs.representativeSection) === 'works');
  assert(representativeSectionMatches.length === 1, `${parent.id}: representative section count is ${representativeSectionMatches.length}`);
  const representativeSection = element(html, representativeSectionMatches[0], 'section');
  const groups = openingTags(representativeSection, 'section', 'art-atlas-submovement-group');
  assert(groups.length === entries.length, `${parent.id}: expected ${entries.length} card groups, got ${groups.length}`);
  const groupCategoryOrder = groups.map(match => attr(match[0], attrs.categoryId));
  assert(JSON.stringify(groupCategoryOrder) === JSON.stringify(parent.categoryIds), `${parent.id}: card group category order mismatch`);
  const allCards = openingTags(html, 'article', 'movement-work-card');
  assert(allCards.length === entries.length, `${parent.id}: legacy or missing representative cards (${allCards.length}/${entries.length})`);

  let ready = 0;
  let pending = 0;
  entries.forEach((entry, index) => {
    const row = bodyRows[index][0];
    const rowTag = /^<tr\b[^>]*>/i.exec(row)[0];
    const developmentId = attr(rowTag, attrs.developmentId);
    const countryIds = attr(rowTag, attrs.countryIds);
    const cell = [...row.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)].find(match => new RegExp(`\\b${attrs.representativeArtists}=`, 'i').test(match[0]))?.[0] || '';
    assert(JSON.stringify(artistIds(cell)) === JSON.stringify([entry.artist.id]), `${entry.categoryId}: table artist order mismatch`);
    assert(textContent(row).includes(entry.feature), `${entry.categoryId}: feature text mismatch`);

    const groupMatch = groups[index];
    const group = element(representativeSection, groupMatch, 'section');
    assert(attr(groupMatch[0], attrs.developmentId) === developmentId, `${entry.categoryId}: group development ID mismatch`);
    assert(attr(groupMatch[0], attrs.countryIds) === countryIds, `${entry.categoryId}: group country IDs mismatch`);
    const grids = openingTags(group, 'div', 'movement-work-grid');
    assert(grids.length === 1, `${entry.categoryId}: card grid count is ${grids.length}`);
    assert(attr(grids[0][0], attrs.developmentId) === developmentId, `${entry.categoryId}: grid development ID mismatch`);
    const cardMatches = openingTags(group, 'article', 'movement-work-card');
    assert(cardMatches.length === 1, `${entry.categoryId}: expected one beginner anchor card`);
    const cardTag = cardMatches[0][0];
    const card = element(group, cardMatches[0], 'article');
    assert(attr(cardTag, attrs.developmentId) === developmentId, `${entry.categoryId}: card development ID mismatch`);
    assert(attr(cardTag, attrs.categoryId) === entry.categoryId, `${entry.categoryId}: card category ID mismatch`);
    assert(attr(cardTag, attrs.artistId) === entry.artist.id, `${entry.categoryId}: card artist ID mismatch`);
    assert(attr(cardTag, attrs.workId) === entry.work.id, `${entry.categoryId}: card work ID mismatch`);
    assert(JSON.stringify(artistIds(card)) === JSON.stringify([entry.artist.id]), `${entry.categoryId}: card artist link mismatch`);
    assert(textContent(card).includes(entry.selectionReason), `${entry.categoryId}: selection reason mismatch`);
    assert(textContent(card).includes(entry.description), `${entry.categoryId}: card description mismatch`);
    assert(new RegExp(`\\b${attrs.selectionReason}=`, 'i').test(card), `${entry.categoryId}: selection reason binding missing`);
    assert(new RegExp(`\\b${attrs.cardDescription}=`, 'i').test(card), `${entry.categoryId}: description binding missing`);

    const artist = artistMap.get(entry.artist.id);
    assert(artist, `${entry.categoryId}: artist ${entry.artist.id} is absent from artists.json`);
    assert((artist.works || []).some(work => work.id === entry.work.id), `${entry.categoryId}: work ${entry.work.id} is absent from artists.json`);
    const imageState = attr(cardTag, attrs.imageState);
    const imageTag = /<img\b[^>]*>/i.exec(card)?.[0] || '';
    if (imageState === 'ready') {
      ready += 1;
      const src = attr(imageTag, 'src');
      assert(src && !/^(?:https?:)?\/\//i.test(src), `${entry.categoryId}: ready image must be local`);
      assert(fs.existsSync(localImageFile(documentFile, src)), `${entry.categoryId}: local image is missing (${src})`);
    } else {
      pending += 1;
      assert(imageState === 'pending', `${entry.categoryId}: invalid image state ${imageState}`);
      assert(!imageTag, `${entry.categoryId}: pending card must not depend on an image URL`);
      assert(card.includes('이미지 업로드 예정'), `${entry.categoryId}: pending image label is missing`);
    }
  });
  return {ready, pending, cards: entries.length};
}

function main() {
  const categories = new Map(canonical.categories.map(category => [category.id, category]));
  const entries = representatives.categories.map(entry => ({...entry, category: categories.get(entry.categoryId)}));
  const entryMap = new Map(entries.map(entry => [entry.categoryId, entry]));
  const artistMap = new Map(artistsData.artists.map(artist => [artist.id, artist]));
  assert(entries.length === canonical.counts.beginnerCategories, `Representative count must be ${canonical.counts.beginnerCategories}`);
  assert(entryMap.size === entries.length, 'Representative category IDs must be unique');
  canonical.categories.forEach(category => assert(entryMap.has(category.id), `${category.id}: representative entry is missing`));
  const selectedArtists = entries.map(entry => entry.artist.id);
  assert(new Set(selectedArtists).size === selectedArtists.length, 'Phase 5 anchor artists must not be duplicated across categories');

  const totals = {parents: 0, categories: 0, cards: 0, ready: 0, pending: 0};
  canonical.parents.filter(parent => parent.role === 'document').forEach(parent => {
    const parentEntries = parent.categoryIds.map(categoryId => entryMap.get(categoryId));
    const result = validateDocument(parent, parentEntries, artistMap);
    totals.parents += 1;
    totals.categories += parentEntries.length;
    totals.cards += result.cards;
    totals.ready += result.ready;
    totals.pending += result.pending;
  });
  assert(totals.categories === canonical.counts.beginnerCategories, 'Validated category total mismatch');
  assert(totals.cards === totals.categories, 'Each category must have exactly one phase 5 anchor card');
  console.log(JSON.stringify(totals, null, 2));
}

main();
