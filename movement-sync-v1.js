const fs = require('node:fs');
const path = require('node:path');

const contract = require('./data/art-movement-sync-contract.json');
const learningMap = require('./data/art-movement-learning-map.json');
const attrs = contract.attributes;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function attribute(tag, name) {
  const match = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(String(tag || ''));
  return match?.[1] ?? match?.[2];
}

function openingTags(source, tagName, className = '') {
  const matches = [...String(source || '').matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))];
  if (!className) return matches;
  return matches.filter(match => new RegExp(`(?:^|\\s)${className}(?:\\s|$)`, 'i').test(attribute(match[0], 'class') || ''));
}

function matchingElementEnd(source, start, tagName) {
  const pattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  pattern.lastIndex = start;
  let depth = 0;
  for (let match; (match = pattern.exec(source));) {
    if (/^<\//.test(match[0])) depth -= 1;
    else if (!/\/>$/.test(match[0])) depth += 1;
    if (depth === 0) return pattern.lastIndex;
  }
  throw new Error(`Unclosed <${tagName}> element`);
}

function element(source, match, tagName) {
  return source.slice(match.index, matchingElementEnd(source, match.index, tagName));
}

function plainText(source) {
  return String(source || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function idsFromLinks(source) {
  return openingTags(source, 'a').map(match => attribute(match[0], attrs.artistId)).filter(Boolean);
}

function contentBoundTo(source, attributeName) {
  const opening = openingTags(source, '[a-z][\\w-]*').find(match => attribute(match[0], attributeName) !== undefined);
  if (!opening) return '';
  const tagName = /^<([a-z][\w-]*)/i.exec(opening[0])?.[1];
  return tagName ? plainText(element(source, opening, tagName)) : '';
}

function parseMovementDocument(html) {
  const source = String(html || '');
  const rootTag = /<html\b[^>]*>/i.exec(source)?.[0] || '';
  const representativeMatch = openingTags(source, 'section')
    .filter(match => attribute(match[0], attrs.representativeSection) === 'works');
  assert(representativeMatch.length === 1, `Expected one representative work section, got ${representativeMatch.length}`);
  const representativeSource = element(source, representativeMatch[0], 'section');

  const countryMatch = openingTags(source, 'section').find(match => attribute(match[0], 'id') === 'countries');
  assert(countryMatch, 'The #countries section is missing');
  const countrySource = element(source, countryMatch, 'section');
  const rows = [...countrySource.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .filter(match => attribute(/^<tr\b[^>]*>/i.exec(match[0])?.[0], attrs.developmentId))
    .map(match => {
      const markup = match[0];
      const tag = /^<tr\b[^>]*>/i.exec(markup)?.[0] || '';
      const learningNodeId = attribute(tag, attrs.learningNodeId) || '';
      const cellMatches = [...markup.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)];
      const representativeCell = cellMatches.find(cell => attribute(/^<td\b[^>]*>/i.exec(cell[0])?.[0], attrs.representativeArtists) !== undefined);
      const furtherCell = cellMatches.find(cell => attribute(/^<td\b[^>]*>/i.exec(cell[0])?.[0], attrs.furtherArtists) !== undefined);
      assert(representativeCell, `${attribute(tag, attrs.developmentId)}: representative artist cell is missing`);
      assert(furtherCell || learningNodeId, `${attribute(tag, attrs.developmentId)}: further artist cell is missing`);
      const representativeArtistIds = idsFromLinks(representativeCell[0]);
      const furtherArtistIds = furtherCell ? idsFromLinks(furtherCell[0]) : [];
      return {
        start: countryMatch.index + match.index,
        markup,
        tag,
        developmentId: attribute(tag, attrs.developmentId),
        learningNodeId,
        categoryId: attribute(tag, attrs.categoryId),
        countryIds: (attribute(tag, attrs.countryIds) || '').split(/\s+/).filter(Boolean),
        artistIds: [...representativeArtistIds, ...furtherArtistIds],
        representativeArtistIds,
        furtherArtistIds,
        representativeCell: {
          start: countryMatch.index + match.index + representativeCell.index,
          markup: representativeCell[0]
        },
        furtherCell: furtherCell ? {
          start: countryMatch.index + match.index + furtherCell.index,
          markup: furtherCell[0]
        } : null
      };
    });

  const groups = openingTags(representativeSource, 'section', 'art-atlas-submovement-group').map(match => {
    const markup = element(representativeSource, match, 'section');
    const developmentId = attribute(match[0], attrs.developmentId);
    const gridMatches = openingTags(markup, 'div', 'movement-work-grid');
      assert(gridMatches.length === 1, `${developmentId}: expected one representative card grid`);
    const cards = openingTags(markup, 'article', 'movement-work-card').map(cardMatch => {
      const cardMarkup = element(markup, cardMatch, 'article');
      return {
        markup: cardMarkup,
        tag: cardMatch[0],
        developmentId: attribute(cardMatch[0], attrs.developmentId),
        categoryId: attribute(cardMatch[0], attrs.categoryId),
        artistId: attribute(cardMatch[0], attrs.artistId),
        workId: attribute(cardMatch[0], attrs.workId),
        role: attribute(cardMatch[0], attrs.cardRole),
        imageState: attribute(cardMatch[0], attrs.imageState),
        duplicateArtistReason: attribute(cardMatch[0], attrs.duplicateArtistReason) || '',
        selectionReason: contentBoundTo(cardMarkup, attrs.selectionReason),
        description: contentBoundTo(cardMarkup, attrs.cardDescription),
        linkArtistIds: idsFromLinks(cardMarkup),
        imageTag: /<img\b[^>]*>/i.exec(cardMarkup)?.[0] || ''
      };
    });
    return {
      markup,
      tag: match[0],
      developmentId,
      learningNodeId: attribute(match[0], attrs.learningNodeId) || '',
      categoryId: attribute(match[0], attrs.categoryId),
      countryIds: (attribute(match[0], attrs.countryIds) || '').split(/\s+/).filter(Boolean),
      gridDevelopmentId: attribute(gridMatches[0][0], attrs.developmentId),
      cards
    };
  });

  return {
    source,
    root: {
      version: attribute(rootTag, attrs.syncVersion),
      state: attribute(rootTag, attrs.syncState),
      parentId: attribute(rootTag, attrs.parentId),
      contextId: attribute(rootTag, attrs.contextId)
    },
    rows,
    groups
  };
}

function sorted(values) {
  return [...values].sort();
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertStableEditableStructure(currentHtml, submittedHtml) {
  const current = parseMovementDocument(currentHtml);
  const submitted = parseMovementDocument(submittedHtml);
  assert(current.root.version === '1' && current.root.state === 'complete', 'The saved document is not a complete version 1 document');
  assert(submitted.root.version === '1' && submitted.root.state === 'complete', 'The submitted document must remain complete version 1');
  assert(current.root.parentId === submitted.root.parentId && !submitted.root.contextId, 'Document identity cannot be changed in the editor');

  const rowSignature = row => [row.developmentId, row.categoryId, row.countryIds.join(' ')].join('|');
  assert(sameValues(current.rows.map(rowSignature), submitted.rows.map(rowSignature)), 'Country development rows, categories, and countries cannot be changed in this editor');
  const groupSignature = group => [group.developmentId, group.categoryId, group.countryIds.join(' '), group.gridDevelopmentId].join('|');
  assert(sameValues(current.groups.map(groupSignature), submitted.groups.map(groupSignature)), 'Representative card groups cannot be changed in this editor');

  const currentGroups = new Map(current.groups.map(group => [group.developmentId, group]));
  submitted.groups.forEach(group => {
    const before = currentGroups.get(group.developmentId);
    assert(before, `${group.developmentId}: existing card group is missing`);
    const identity = card => `${card.developmentId}|${card.categoryId}|${card.artistId}|${card.workId}|${card.role}`;
    assert(sameValues(sorted(before.cards.map(identity)), sorted(group.cards.map(identity))), `${group.developmentId}: representative membership or work identity changed without a classification command`);
  });
  const currentRows = new Map(current.rows.map(row => [row.developmentId, row]));
  submitted.rows.forEach(row => {
    const before = currentRows.get(row.developmentId);
    assert(sameValues(sorted(before.representativeArtistIds), sorted(row.representativeArtistIds)), `${row.developmentId}: table representative membership changed without a classification command`);
    assert(sameValues(sorted(before.furtherArtistIds), sorted(row.furtherArtistIds)), `${row.developmentId}: table further artist membership changed without a classification command`);
  });
  return submitted;
}

function validateCompleteDocument(html, options = {}) {
  const parsed = parseMovementDocument(html);
  const canonical = options.canonical || require('./data/art-movement-canonical.json');
  const artistsData = options.artists || require('./data/artists.json');
  const movementData = options.movements || require('./data/art-movements.json');
  const parent = canonical.parents.find(item => item.id === parsed.root.parentId && item.role === 'document');
  assert(parsed.root.version === contract.documentSyncVersion, 'Document sync version must be 1');
  assert(parsed.root.state === 'complete', 'Document sync state must be complete');
  assert(parent && !parsed.root.contextId, `Unknown or invalid document parent ${parsed.root.parentId || '(missing)'}`);
  if (parent.id === 'neoclassicism') {
    const nodes = learningMap.movements?.neoclassicism?.nodes || [];
    assert(parsed.rows.length === nodes.length && parsed.groups.length === nodes.length, 'neoclassicism: learning map row or group count differs');
    nodes.forEach(node => {
      const row = parsed.rows.find(item => item.learningNodeId === node.id);
      const group = parsed.groups.find(item => item.learningNodeId === node.id);
      assert(row && group, `${node.id}: learning row or group is missing`);
      assert(row.developmentId === node.developmentId && group.developmentId === node.developmentId, `${node.id}: learning development ID differs`);
      assert(row.categoryId === node.canonicalCategoryId && group.categoryId === node.canonicalCategoryId, `${node.id}: learning category differs`);
      assert(row.representativeArtistIds.length === 1 && row.representativeArtistIds[0] === node.artist.id && !row.furtherArtistIds.length, `${node.id}: learning artist role differs`);
    });
    return {cards:nodes.length};
  }
  assert(sameValues(parsed.rows.map(row => row.categoryId), parent.categoryIds), `${parent.id}: country rows do not follow canonical category order`);
  assert(sameValues(parsed.groups.map(group => group.categoryId), parent.categoryIds), `${parent.id}: card groups do not follow canonical category order`);

  const categories = new Map(canonical.categories.map(category => [category.id, category]));
  const countryIds = new Set((movementData.countries || []).map(country => country.id));
  const artistMap = new Map((artistsData.artists || []).map(artist => [artist.id, artist]));
  const groups = new Map(parsed.groups.map(group => [group.developmentId, group]));
  const documentArtists = new Map();

  // Approved Neoclassicism pilot: David is a standalone reference point, not a parent for variations.
  const zeroFurtherArtistDevelopmentIds = new Set([
    'dev--neoclassicism-french-france',
    'dev--neoclassicism-canova-ideal-form-italy',
    'dev--neoclassicism-mengs-theoretical-order-germany',
    'dev--neoclassicism-kauffman-international-history-united-kingdom',
    'dev--neoclassicism-ingres-crossing-form-france'
  ]);
  parsed.rows.forEach(row => {
    assert(/^dev--[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.developmentId), `${row.developmentId}: invalid development ID`);
    assert(categories.get(row.categoryId)?.parentId === parent.id, `${row.developmentId}: category does not belong to ${parent.id}`);
    assert(row.countryIds.length && row.countryIds.every(id => countryIds.has(id)), `${row.developmentId}: unknown country ID`);
    const group = groups.get(row.developmentId);
    assert(group, `${row.developmentId}: representative card group is missing`);
    assert(group.categoryId === row.categoryId, `${row.developmentId}: row and group category IDs differ`);
    assert(sameValues(group.countryIds, row.countryIds), `${row.developmentId}: row and group country IDs differ`);
    assert(group.gridDevelopmentId === row.developmentId, `${row.developmentId}: grid development ID differs`);
    const primaryCards = group.cards.filter(card => card.role === 'primary');
    const furtherCards = group.cards.filter(card => card.role === 'further');
    const cardIds = group.cards.map(card => card.artistId);
    assert(primaryCards.length === 1 && group.cards[0] === primaryCards[0], `${row.developmentId}: expected one fixed primary card first`);
    assert((zeroFurtherArtistDevelopmentIds.has(row.developmentId) && furtherCards.length === 0) || (furtherCards.length >= 1 && furtherCards.length <= 4), `${row.developmentId}: expected ${zeroFurtherArtistDevelopmentIds.has(row.developmentId) ? 'no' : 'one to four'} further artist cards`);
    assert(sameValues(row.representativeArtistIds, primaryCards.map(card => card.artistId)), `${row.developmentId}: table and primary card order differs`);
    assert(sameValues(row.furtherArtistIds, furtherCards.map(card => card.artistId)), `${row.developmentId}: table and further card order differs`);
    assert(new Set(cardIds).size === cardIds.length, `${row.developmentId}: representative artist is duplicated inside one group`);

    group.cards.forEach(card => {
      assert(card.developmentId === row.developmentId && card.categoryId === row.categoryId, `${card.artistId}: card classification differs from its group`);
      assert(card.linkArtistIds.length === 1 && card.linkArtistIds[0] === card.artistId, `${card.artistId}: card heading artist link differs`);
      const artist = artistMap.get(card.artistId);
      assert(artist, `${card.artistId}: artist is missing from artists.json`);
      assert((artist.works || []).some(work => work.id === card.workId), `${card.workId}: work is missing from artist ${card.artistId}`);
      assert(card.selectionReason, `${card.workId}: selection reason is empty`);
      assert(card.description, `${card.workId}: card description is empty`);
      const previous = documentArtists.get(card.artistId) || [];
      documentArtists.set(card.artistId, [...previous, card]);
      if (card.imageState === 'ready') {
        const src = attribute(card.imageTag, 'src') || '';
        assert(src && !/^(?:https?:)?\/\//i.test(src), `${card.workId}: ready image must use a local path`);
        if (options.documentFile) {
          const imageFile = path.resolve(path.dirname(options.documentFile), src.split(/[?#]/)[0]);
          assert(fs.existsSync(imageFile), `${card.workId}: local image file is missing`);
        }
      } else {
        assert(card.imageState === 'pending', `${card.workId}: image state must be ready or pending`);
        assert(!card.imageTag, `${card.workId}: pending card cannot contain an image URL`);
      }
    });
  });

  documentArtists.forEach((cards, artistId) => {
    if (cards.length < 2) return;
    assert(cards.every(card => card.duplicateArtistReason.trim()), `${artistId}: duplicate representative cards need an educational reason`);
  });
  return {parentId: parent.id, rows: parsed.rows.length, cards: parsed.groups.reduce((sum, group) => sum + group.cards.length, 0)};
}

function synchronizeTableArtistOrder(html) {
  const parsed = parseMovementDocument(html);
  const groups = new Map(parsed.groups.map(group => [group.developmentId, group]));
  const replacements = [];
  const linkPattern = /<a\b(?=[^>]*\bdata-artist-id=(?:"[^"]+"|'[^']+'))[^>]*>[\s\S]*?<\/a>/gi;
  parsed.rows.forEach(row => {
    const cards = groups.get(row.developmentId)?.cards || [];
    const primaryOrder = cards.filter(card => card.role === 'primary').map(card => card.artistId);
    const furtherOrder = cards.filter(card => card.role === 'further').map(card => card.artistId);
    const synchronizeCell = (cell, currentIds, cardOrder, label) => {
      assert(sameValues(sorted(currentIds), sorted(cardOrder)), `${row.developmentId}: ${label} membership differs between table and cards`);
      const links = [...cell.markup.matchAll(linkPattern)].map(match => ({
        id: attribute(/^<a\b[^>]*>/i.exec(match[0])?.[0], attrs.artistId),
        markup: match[0]
      }));
      const byId = new Map(links.map(link => [link.id, link.markup]));
      let index = 0;
      const orderedMarkup = cell.markup.replace(linkPattern, () => byId.get(cardOrder[index++]) || '');
      replacements.push({start: cell.start, length: cell.markup.length, value: orderedMarkup});
    };
    synchronizeCell(row.representativeCell, row.representativeArtistIds, primaryOrder, 'representative');
    if (row.furtherCell) synchronizeCell(row.furtherCell, row.furtherArtistIds, furtherOrder, 'further artist');
  });
  return replacements.sort((left, right) => right.start - left.start).reduce((source, change) =>
    source.slice(0, change.start) + change.value + source.slice(change.start + change.length), parsed.source);
}

module.exports = {
  assertStableEditableStructure,
  attribute,
  parseMovementDocument,
  synchronizeTableArtistOrder,
  validateCompleteDocument
};
