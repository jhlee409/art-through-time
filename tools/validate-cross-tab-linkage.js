#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const canonical = readJson('data/art-movement-canonical.json');
const movementData = readJson('data/art-movements.json');
const artistsData = readJson('data/artists.json');
const movementIndex = readJson('data/미술사조/index.json');
const contract = readJson('data/art-movement-sync-contract.json');
const attrs = contract.attributes;
const issues = [];

function check(condition, message) {
  if (!condition) issues.push(message);
}

function attr(tag, name) {
  return new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(value => value !== undefined) || '';
}

function openingTags(source, tagName) {
  return [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))];
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

function artistIds(source) {
  return openingTags(source, 'a').map(match => attr(match[0], attrs.artistId)).filter(Boolean);
}

function numericYear(value) {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

function artistListSpan(artist) {
  const workYears = (artist?.works || []).flatMap(work => String(work?.yearLabel ?? work?.year ?? '').match(/\d{3,4}/g) || []).map(Number).filter(Number.isFinite);
  const birth = numericYear(artist?.birth);
  const activeFrom = numericYear(artist?.activeFrom);
  const firstWork = workYears.length ? Math.min(...workYears) : null;
  const start = Number.isFinite(birth) ? birth : (Number.isFinite(activeFrom) ? activeFrom : firstWork);
  if (!Number.isFinite(start)) return null;
  const death = numericYear(artist?.death);
  const activeTo = numericYear(artist?.activeTo);
  const lastWork = workYears.length ? Math.max(...workYears) : null;
  const unknownDeathEnd = Number.isFinite(birth)
    ? Math.min(2026, Math.max(birth + 80, Number.isFinite(lastWork) ? lastWork : birth + 80))
    : 2026;
  const end = Number.isFinite(death)
    ? death
    : (Number.isFinite(activeTo) ? activeTo : (artist?.death === null ? 2026 : unknownDeathEnd));
  return {start, end:Math.max(start + 1, end)};
}

function countryRows(parent) {
  const relative = movementIndex.documents?.[parent.documentKey]?.['1'];
  check(Boolean(relative), `${parent.id}: movement document is not indexed`);
  if (!relative) return [];
  const html = fs.readFileSync(path.join(root, relative), 'utf8');
  const rootTag = /<html\b[^>]*>/i.exec(html)?.[0] || '';
  check(attr(rootTag, attrs.parentId) === parent.id, `${parent.id}: document parent ID mismatch`);
  const sectionMatch = openingTags(html, 'section').find(match => attr(match[0], 'id') === 'countries');
  check(Boolean(sectionMatch), `${parent.id}: country development section is missing`);
  if (!sectionMatch) return [];
  const section = element(html, sectionMatch, 'section');
  return [...section.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].filter(match => /<td\b/i.test(match[0])).map(match => {
    const row = match[0];
    const rowTag = /^<tr\b[^>]*>/i.exec(row)?.[0] || '';
    const cells = [...row.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)].map(cell => cell[0]);
    const primaryCell = cells.find(cell => new RegExp(`\\b${attrs.representativeArtists}=`, 'i').test(cell)) || '';
    const furtherCell = cells.find(cell => new RegExp(`\\b${attrs.furtherArtists}=`, 'i').test(cell)) || '';
    return {
      parentId: parent.id,
      developmentId: attr(rowTag, attrs.developmentId),
      categoryId: attr(rowTag, attrs.categoryId),
      countryIds: attr(rowTag, attrs.countryIds).split(/\s+/).filter(Boolean),
      primaryArtistIds: artistIds(primaryCell),
      furtherArtistIds: artistIds(furtherCell)
    };
  });
}

function main() {
  const parents = new Map(canonical.parents.map(parent => [parent.id, parent]));
  const categories = new Map(canonical.categories.map(category => [category.id, category]));
  const countries = new Map((movementData.countries || []).map(country => [country.id, country]));
  const artists = new Map((artistsData.artists || []).map(artist => [artist.id, artist]));
  const rows = canonical.parents.filter(parent => parent.role === 'document').flatMap(countryRows);
  const rowsByDevelopment = new Map();

  for (const row of rows) {
    check(row.developmentId && !rowsByDevelopment.has(row.developmentId), `Duplicate or empty development ID: ${row.developmentId || '(empty)'}`);
    rowsByDevelopment.set(row.developmentId, row);
    const category = categories.get(row.categoryId);
    check(category?.parentId === row.parentId, `${row.developmentId}: category does not belong to document parent`);
    check(row.countryIds.length > 0 && row.countryIds.every(countryId => countries.has(countryId)), `${row.developmentId}: unknown or empty country IDs`);
    check(row.primaryArtistIds.length === 1, `${row.developmentId}: expected one primary artist`);
    check(row.furtherArtistIds.length >= 1 && row.furtherArtistIds.length <= 4, `${row.developmentId}: expected one to four further artists`);
    const rowArtistIds = [...row.primaryArtistIds, ...row.furtherArtistIds];
    check(new Set(rowArtistIds).size === rowArtistIds.length, `${row.developmentId}: duplicate artist in table row`);
    for (const artistId of rowArtistIds) {
      const artist = artists.get(artistId);
      check(Boolean(artist), `${row.developmentId}: unknown artist ${artistId}`);
      check(Boolean(artistListSpan(artist)), `${row.developmentId}: ${artistId} has no usable life or activity span`);
    }
  }

  const bindingCounts = new Map();
  let movementBindings = 0;
  for (const country of movementData.countries || []) {
    for (const movement of country.movements || []) {
      const binding = movement.canonical;
      if (!binding) continue;
      const parent = parents.get(binding.parentId);
      const owner = parents.get(binding.documentOwnerId);
      check(Boolean(parent), `${country.id}/${movement.name?.ko}: unknown canonical parent ${binding.parentId}`);
      check(owner?.role === 'document', `${country.id}/${movement.name?.ko}: invalid document owner ${binding.documentOwnerId}`);
      if (parent?.role === 'absorbed') check(parent.documentOwnerId === binding.documentOwnerId, `${country.id}/${movement.name?.ko}: absorbed parent owner mismatch`);
      if (parent?.role === 'document') check(parent.id === binding.documentOwnerId, `${country.id}/${movement.name?.ko}: document parent owner mismatch`);
      const categoryIds = binding.categoryIds || [];
      const developmentIds = binding.developmentIds || [];
      check(categoryIds.length === developmentIds.length, `${country.id}/${movement.name?.ko}: category/development binding length mismatch`);
      check(new Set(developmentIds).size === developmentIds.length, `${country.id}/${movement.name?.ko}: duplicate development binding`);
      developmentIds.forEach((developmentId, index) => {
        movementBindings += 1;
        const row = rowsByDevelopment.get(developmentId);
        const categoryId = categoryIds[index];
        check(Boolean(row), `${country.id}/${movement.name?.ko}: unknown development ${developmentId}`);
        if (!row) return;
        check(row.categoryId === categoryId, `${country.id}/${movement.name?.ko}: ${developmentId} category mismatch`);
        check(row.parentId === binding.documentOwnerId, `${country.id}/${movement.name?.ko}: ${developmentId} document owner mismatch`);
        check(row.countryIds.includes(country.id), `${country.id}/${movement.name?.ko}: ${developmentId} does not include this country`);
        const bindingKey = `${country.id}|${developmentId}`;
        bindingCounts.set(bindingKey, (bindingCounts.get(bindingKey) || 0) + 1);

        const start = Number(movement.start);
        const end = Number(movement.end);
        check(Number.isFinite(start) && Number.isFinite(end) && end >= start, `${country.id}/${movement.name?.ko}: invalid movement period`);
        for (const artistId of [...row.primaryArtistIds, ...row.furtherArtistIds]) {
          const artist = artists.get(artistId);
          const span = artistListSpan(artist);
          check(!span || (span.start <= end && span.end >= start), `${country.id}/${movement.name?.ko}: ${artistId} life or activity does not overlap the bound movement period`);
        }
      });
    }
  }

  for (const row of rows) {
    for (const countryId of row.countryIds) {
      const count = bindingCounts.get(`${countryId}|${row.developmentId}`) || 0;
      check(count === 1, `${row.developmentId}: expected one ${countryId} movement binding, got ${count}`);
    }
  }

  const appSource = fs.readFileSync(path.join(root, 'app-atlas.js'), 'utf8');
  check(appSource.includes('group.end = Math.max(group.end, rowEnd);'), 'Artist-list parent movement must use the latest child end year');

  console.log(JSON.stringify({
    ok: issues.length === 0,
    documents: canonical.parents.filter(parent => parent.role === 'document').length,
    developmentRows: rows.length,
    movementBindings,
    artistsReferenced: new Set(rows.flatMap(row => [...row.primaryArtistIds, ...row.furtherArtistIds])).size,
    issues: issues.length
  }, null, 2));
  if (issues.length) {
    console.error(issues.slice(0, 200).join('\n'));
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
