#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const canonical = readJson('data/art-movement-canonical.json');
const representatives = readJson('data/art-movement-representatives.json');
const artists = readJson('data/artists.json').artists || [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactIds(actual, expected, label) {
  assert(actual.length === new Set(actual).size, `${label} contains duplicate category IDs`);
  assert(actual.length === expected.length && expected.every(id => actual.includes(id)), `${label} differs from canonical categories`);
}

function imagePaths(work) {
  return [work.localImage, work.thumbnail, work.image, work.highResImage, work.highResOriginal].filter(Boolean);
}

function validateEntry(entry, categoryId, role, artistsById) {
  const artistId = entry.artist?.id;
  const workId = entry.work?.id;
  const artist = artistsById.get(artistId);
  assert(artist, `${categoryId}: ${role} artist is missing (${artistId || 'empty'})`);
  const work = (artist.works || []).find(item => item.id === workId);
  assert(work, `${categoryId}: ${role} work is missing (${artistId}|${workId || 'empty'})`);
  assert(entry.artist?.name?.ko && entry.artist?.name?.en, `${categoryId}: ${role} artist names are incomplete`);
  assert(entry.work?.title?.ko && entry.work?.title?.en, `${categoryId}: ${role} work titles are incomplete`);
  assert(entry.selectionReason?.trim() && entry.description?.trim(), `${categoryId}: ${role} explanation is incomplete`);
  if (entry.work.localImage) {
    assert(imagePaths(work).includes(entry.work.localImage), `${categoryId}: ${role} image differs from artists.json`);
    assert(fs.existsSync(path.join(root, entry.work.localImage)), `${categoryId}: ${role} image is missing (${entry.work.localImage})`);
  }
  return `${categoryId}|${artistId}|${workId}`;
}

function main() {
  const canonicalIds = canonical.categories.map(category => category.id);
  const categoryEntries = representatives.categories || [];
  const furtherGroups = representatives.furtherArtists || [];
  exactIds(categoryEntries.map(entry => entry.categoryId), canonicalIds, 'Representative categories');
  exactIds(furtherGroups.map(group => group.categoryId), canonicalIds, 'Further-artist groups');

  const artistsById = new Map(artists.map(artist => [artist.id, artist]));
  const identities = new Set();
  categoryEntries.forEach(entry => {
    assert(entry.feature?.trim(), `${entry.categoryId}: representative feature is missing`);
    const identity = validateEntry(entry, entry.categoryId, 'representative', artistsById);
    assert(!identities.has(identity), `${entry.categoryId}: duplicate representative identity`);
    identities.add(identity);
  });

  let furtherArtists = 0;
  furtherGroups.forEach(group => {
    assert(group.artists?.length >= 1 && group.artists.length <= 4, `${group.categoryId}: further artists must contain 1-4 entries`);
    group.artists.forEach(entry => {
      const identity = validateEntry(entry, group.categoryId, 'further', artistsById);
      assert(!identities.has(identity), `${group.categoryId}: duplicate representative/further identity`);
      identities.add(identity);
      furtherArtists += 1;
    });
  });

  console.log(JSON.stringify({categories: categoryEntries.length, representatives: categoryEntries.length, furtherArtists, identities: identities.size}, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
