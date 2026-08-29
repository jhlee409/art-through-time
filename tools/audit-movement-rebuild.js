const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const defaultJson = path.join(root, 'data', '미술사조', 'REBUILD_BASELINE.json');
const defaultMarkdown = path.join(root, 'data', '미술사조', 'REBUILD_BASELINE.md');

function parseArgs(argv) {
  const args = {json: defaultJson, markdown: defaultMarkdown, write: true};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (key === '--json') args.json = path.resolve(root, argv[++index] || '');
    else if (key === '--markdown') args.markdown = path.resolve(root, argv[++index] || '');
    else if (key === '--no-write') args.write = false;
    else if (key === '--help' || key === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${key}`);
  }
  return args;
}

function usage() {
  console.log([
    'Usage: node tools/audit-movement-rebuild.js [options]',
    '',
    'Options:',
    '  --json PATH       JSON output path.',
    '  --markdown PATH   Markdown output path.',
    '  --no-write        Print the summary without writing reports.'
  ].join('\n'));
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function decodeHtml(value) {
  const named = {amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"'};
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function plainText(value) {
  return decodeHtml(String(value || ''))
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelKey(value) {
  return plainText(value).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^0-9a-z가-힣]+/g, '');
}

function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return decodeHtml(tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '');
}

function hasClass(tag, name) {
  return attribute(tag, 'class').split(/\s+/).includes(name);
}

function matchingElementEnd(source, start, tagName) {
  const tag = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tag.lastIndex = start;
  let depth = 0;
  for (let match; (match = tag.exec(source));) {
    if (/^<\//.test(match[0])) {
      depth--;
      if (depth === 0) return tag.lastIndex;
    } else if (!/\/>$/.test(match[0])) {
      depth++;
    }
  }
  return -1;
}

function elementAt(source, start, tagName) {
  const end = matchingElementEnd(source, start, tagName);
  return end < 0 ? '' : source.slice(start, end);
}

function elements(source, tagName, predicate = () => true) {
  const starts = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const found = [];
  for (let match; (match = starts.exec(source));) {
    if (!predicate(match[0])) continue;
    const html = elementAt(source, match.index, tagName);
    if (html) found.push({start: match.index, open: match[0], html});
  }
  return found;
}

function firstElement(source, tagName, predicate) {
  return elements(source, tagName, predicate)[0]?.html || '';
}

function artistLinks(source) {
  return [...String(source || '').matchAll(/<a\b(?=[^>]*\bdata-artist-id=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => ({id: match[1], name: plainText(match[2])}));
}

function countryRows(section) {
  const table = firstElement(section, 'table', () => true);
  if (!table) return {headers: [], rows: [], representativeIndex: -1, furtherIndex: -1};
  const headerRow = elements(table, 'tr').find(row => /<th\b/i.test(row.html))?.html || '';
  const headers = elements(headerRow, 'th').map(cell => plainText(cell.html));
  const representativeIndex = headers.findIndex(header => /(대표.*(?:화가|제작)|(?:화가|제작).*대표)/.test(header));
  const furtherIndex = headers.findIndex(header => /더\s*볼\s*(?:화가|제작)/.test(header));
  const rows = elements(table, 'tr')
    .filter(row => /<td\b/i.test(row.html))
    .map(row => {
      const cells = elements(row.html, 'td').map(cell => cell.html);
      const label = plainText(cells[0]);
      const parts = label.split(/\s*(?:—|–)\s*/, 2);
      const representativeCell = representativeIndex >= 0 ? cells[representativeIndex] : '';
      const furtherCell = furtherIndex >= 0 ? cells[furtherIndex] : '';
      const representativeArtists = artistLinks(representativeCell);
      const furtherArtists = artistLinks(furtherCell);
      return {
        label,
        country: parts[0] || '',
        detail: parts[1] || '',
        feature: plainText(cells[1]),
        developmentId: attribute(row.open, 'data-art-atlas-development-id'),
        categoryId: attribute(row.open, 'data-art-atlas-category-id'),
        representativeArtists,
        furtherArtists,
        artists: [...representativeArtists, ...furtherArtists]
      };
    });
  return {headers, rows, representativeIndex, furtherIndex};
}

function workCards(section) {
  return elements(section, 'article', tag => hasClass(tag, 'movement-work-card')).map((card, order) => {
    const imageTag = card.html.match(/<img\b[^>]*>/i)?.[0] || '';
    const heading = card.html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '';
    const description = card.html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
    const artistId = card.html.match(/\bdata-artist-id=["']([^"']+)["']/i)?.[1] || '';
    const activityRegion = plainText(card.html.match(/<span\b(?=[^>]*\bclass=["'][^"']*movement-card-activity-region)[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '').replace(/^·\s*/, '');
    return {
      order,
      artistId,
      developmentId: attribute(card.open, 'data-art-atlas-development-id'),
      categoryId: attribute(card.open, 'data-art-atlas-category-id'),
      cardRole: attribute(card.open, 'data-art-atlas-card-role'),
      imageState: attribute(card.open, 'data-art-atlas-image-state'),
      title: plainText(heading),
      image: attribute(imageTag, 'src'),
      reuseImage: attribute(imageTag, 'data-art-atlas-reuse-image'),
      hasImageElement: Boolean(imageTag),
      activityRegion,
      descriptionLength: plainText(description).length
    };
  });
}

function cardGroups(section, cards) {
  const groups = elements(section, 'section', tag => hasClass(tag, 'art-atlas-submovement-group')).map(group => {
    const heading = group.html.match(/<h3\b(?=[^>]*\bclass=["'][^"']*art-atlas-submovement-heading)[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '';
    const name = attribute(group.open, 'data-art-atlas-submovement') || plainText(heading);
    return {
      name,
      source: 'section',
      developmentId: attribute(group.open, 'data-art-atlas-development-id'),
      categoryId: attribute(group.open, 'data-art-atlas-category-id'),
      cards: workCards(group.html)
    };
  });
  if (groups.length) return groups;

  const grids = elements(section, 'div', tag => hasClass(tag, 'movement-work-grid') && Boolean(attribute(tag, 'data-art-atlas-submovement')))
    .map(grid => ({name: attribute(grid.open, 'data-art-atlas-submovement'), source: 'grid', cards: workCards(grid.html)}));
  if (grids.length) return grids;

  const byRegion = new Map();
  cards.forEach(card => {
    const name = card.activityRegion || '문서 전체';
    if (!byRegion.has(name)) byRegion.set(name, []);
    byRegion.get(name).push(card);
  });
  return [...byRegion].map(([name, groupedCards]) => ({name, source: 'card-region', cards: groupedCards}));
}

function orderedIds(items) {
  return items.map(item => item.id ?? item.artistId).filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sameOrder(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function matchingGroup(row, groups) {
  if (row.developmentId) {
    return groups.find(group => group.developmentId === row.developmentId);
  }
  const keys = [row.detail, row.label, row.country].map(labelKey).filter(Boolean);
  return groups.find(group => {
    const groupKey = labelKey(group.name);
    return keys.some(key => key === groupKey || (key.length >= 3 && groupKey.includes(key)) || (groupKey.length >= 3 && key.includes(groupKey)));
  });
}

function auditDocument(key, slot, relative, profile = 'complete') {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return {key, slot, file: relative, missingFile: true, issues: ['등록 경로에 HTML 파일이 없음']};
  const html = fs.readFileSync(absolute, 'utf8');
  const countrySection = firstElement(html, 'section', tag => attribute(tag, 'id') === 'countries');
  const enhancements = elements(html, 'section', tag => hasClass(tag, 'movement-enhancement'));
  const representativeSection = enhancements.at(-1)?.html || '';
  const table = countryRows(countrySection);
  const cards = workCards(representativeSection);
  const groups = cardGroups(representativeSection, cards);
  const tableArtistIds = table.rows.flatMap(row => orderedIds(row.artists));
  const cardArtistIds = orderedIds(cards);
  const tableOnlyArtistIds = unique(tableArtistIds.filter(id => !cardArtistIds.includes(id)));
  const cardOnlyArtistIds = unique(cardArtistIds.filter(id => !tableArtistIds.includes(id)));
  const rowGroupChecks = table.rows.map(row => {
    const group = matchingGroup(row, groups);
    const rowArtistIds = orderedIds(row.artists);
    const groupArtistIds = group ? orderedIds(group.cards) : [];
    return {
      row: row.label,
      group: group?.name || '',
      matched: Boolean(group),
      artistOrderMatches: Boolean(group) && sameOrder(rowArtistIds, groupArtistIds),
      tableArtistIds: rowArtistIds,
      cardArtistIds: groupArtistIds
    };
  });
  const title = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  const issues = [];
  if (profile === 'complete') {
    if (!countrySection) issues.push('국가 전개 표 구역 없음');
    if (table.representativeIndex < 0) issues.push('대표 화가 열을 찾지 못함');
    if (table.furtherIndex < 0) issues.push('더 볼 화가 열을 찾지 못함');
    if (table.rows.length && !representativeSection) issues.push('대표작 심화 구역 없음');
    if (table.rows.length && !cards.length) issues.push('대표작 카드 없음');
    if (cards.some(card => !card.artistId)) issues.push(`화가 ID 없는 카드 ${cards.filter(card => !card.artistId).length}개`);
    const invalidReadyImages = cards.filter(card => card.imageState === 'ready' && !card.hasImageElement);
    if (invalidReadyImages.length) issues.push(`ready 상태이나 이미지 요소 없는 카드 ${invalidReadyImages.length}개`);
    if (tableOnlyArtistIds.length) issues.push(`표에만 있는 화가 ${tableOnlyArtistIds.length}명`);
    if (cardOnlyArtistIds.length) issues.push(`카드에만 있는 화가 ${cardOnlyArtistIds.length}명`);
    if (rowGroupChecks.some(check => !check.matched)) issues.push(`표-카드 범주 연결 실패 ${rowGroupChecks.filter(check => !check.matched).length}행`);
    if (rowGroupChecks.some(check => check.matched && !check.artistOrderMatches)) issues.push(`표-카드 범주별 화가 순서 불일치 ${rowGroupChecks.filter(check => check.matched && !check.artistOrderMatches).length}행`);
  }
  return {
    key,
    slot,
    file: relative,
    profile,
    title,
    missingFile: false,
    countryTable: {...table, rowCount: table.rows.length},
    enhancementCount: enhancements.length,
    representativeCards: cards,
    cardGroups: groups,
    comparison: {tableOnlyArtistIds, cardOnlyArtistIds, rowGroupChecks},
    issues
  };
}

function movementNameMap(countries) {
  const map = new Map();
  countries.flatMap(country => country.movements || []).forEach(movement => {
    const ko = labelKey(movement.name?.ko);
    const en = movement.name?.en;
    if (!ko || !en) return;
    if (!map.has(ko)) map.set(ko, new Set());
    map.get(ko).add(en);
  });
  return map;
}

function makeAudit() {
  const taxonomy = readJson('data/art-taxonomy.json');
  const movementData = readJson('data/art-movements.json');
  const canonical = readJson('data/art-movement-canonical.json');
  const index = readJson('data/미술사조/index.json');
  const legacyIndex = readJson('data/미술사조/legacy-index.json');
  const registered = Object.entries(index.documents || {}).flatMap(([key, slots]) =>
    Object.entries(slots || {}).map(([slot, file]) => ({key, slot, file: normalizePath(file)}))
  );
  const contextKeys = new Set((canonical.contextReferences || []).map(item => item.documentKey));
  const documents = registered.map(item => auditDocument(item.key, item.slot, item.file, contextKeys.has(item.key) ? 'structure' : 'complete'));
  const legacyRegistered = Object.entries(legacyIndex.documents || {}).flatMap(([key, slots]) =>
    Object.entries(slots || {}).filter(([slot, value]) => /^\d+$/.test(slot) && typeof value === 'string').map(([slot, file]) => ({key, slot, file: normalizePath(file)}))
  );
  const registeredFiles = new Set([...registered, ...legacyRegistered].map(item => item.file));
  const movementDir = path.join(root, 'data', '미술사조');
  const physicalFiles = fs.readdirSync(movementDir).filter(file => /\.html?$/i.test(file)).map(file => `data/미술사조/${file}`).sort();
  const unregisteredFiles = physicalFiles.filter(file => !registeredFiles.has(file));
  const missingRegisteredFiles = registered.filter(item => !fs.existsSync(path.join(root, item.file)));
  const names = movementNameMap(movementData.countries || []);
  const documentKeys = new Map(Object.keys(index.documents || {}).map(key => [labelKey(key), key]));
  const parentCoverage = (taxonomy.movements || []).map(parent => {
    const slugName = parent.id.split('-').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ');
    const candidates = unique([...(names.get(labelKey(parent.name)) || []), slugName]);
    const documentKey = candidates.map(name => documentKeys.get(labelKey(name))).find(Boolean) || '';
    return {id: parent.id, name: parent.name, englishNames: candidates, documentKey, hasDocument: Boolean(documentKey)};
  });
  const parentDocumentKeys = new Set(parentCoverage.map(item => item.documentKey).filter(Boolean));
  const contextOnly = new Set((movementData.contextOnlyMovements || []).map(labelKey));
  const nonParentDocuments = Object.keys(index.documents || {}).filter(key => !parentDocumentKeys.has(key)).map(key => ({
    key,
    contextOnly: contextOnly.has(labelKey(key))
  }));
  const totals = {
    countryRows: documents.reduce((sum, doc) => sum + (doc.countryTable?.rowCount || 0), 0),
    tableArtistReferences: documents.reduce((sum, doc) => sum + (doc.countryTable?.rows || []).flatMap(row => row.artists).length, 0),
    representativeCards: documents.reduce((sum, doc) => sum + (doc.representativeCards?.length || 0), 0),
    cardsWithoutArtistId: documents.filter(doc => doc.profile === 'complete').reduce((sum, doc) => sum + (doc.representativeCards || []).filter(card => !card.artistId).length, 0),
    cardsWithoutImage: documents.filter(doc => doc.profile === 'complete').reduce((sum, doc) => sum + (doc.representativeCards || []).filter(card => card.imageState === 'ready' && !card.hasImageElement).length, 0),
    reusedImageCards: documents.reduce((sum, doc) => sum + (doc.representativeCards || []).filter(card => card.reuseImage !== '').length, 0),
    documentsWithIssues: documents.filter(doc => doc.issues?.length).length
  };
  const summary = {
    taxonomyParents: taxonomy.movements?.length || 0,
    taxonomyParentsWithChildren: (taxonomy.movements || []).filter(item => item.submovements?.length).length,
    taxonomySubmovementEntries: (taxonomy.movements || []).reduce((sum, item) => sum + (item.submovements?.length || 0), 0),
    registeredDocuments: registered.length,
    legacyDocuments: legacyRegistered.length,
    physicalHtmlFiles: physicalFiles.length,
    unregisteredHtmlFiles: unregisteredFiles.length,
    missingRegisteredFiles: missingRegisteredFiles.length,
    currentParentDocuments: parentCoverage.filter(item => item.hasDocument).length,
    currentNonParentDocuments: nonParentDocuments.length,
    ...totals
  };
  return {
    schema: 1,
    purpose: '미술 사조 전면 재구축 전 현재 구조 기준선',
    sources: ['data/art-taxonomy.json', 'data/art-movements.json', 'data/미술사조/index.json', 'data/미술사조/*.html'],
    agreedWorkingTarget: {
      taxonomyParents: 44,
      regularParentDocuments: 34,
      contextReferenceDocuments: 2,
      linkedParentDocuments: 24,
      singleParentDocuments: 10,
      note: '분류 ID와 68개 핵심 범주의 최종 목록은 다음 단계에서 확정한다.'
    },
    summary,
    parentCoverage,
    nonParentDocuments,
    unregisteredFiles,
    missingRegisteredFiles,
    documents
  };
}

function markdownList(values, empty = '없음') {
  return values.length ? values.map(value => `\`${value}\``).join(', ') : empty;
}

function makeMarkdown(audit) {
  const s = audit.summary;
  const missingParents = audit.parentCoverage.filter(item => !item.hasDocument).map(item => item.name);
  const issueRows = audit.documents.filter(doc => doc.issues?.length).map(doc =>
    `| ${doc.key} | ${doc.countryTable?.rowCount || 0} | ${doc.representativeCards?.length || 0} | ${doc.cardGroups?.length || 0} | ${doc.issues.join('; ')} |`
  );
  return `# 미술 사조 재구축 기준선\n\n` +
    `이 문서는 재구축 전의 현재 상태를 고정한 자동 생성 보고서다. 목표 분류의 안정 ID와 최종 핵심 세부 범주는 다음 단계에서 확정한다.\n\n` +
    `## 합의된 작업 목표\n\n` +
    `- 부모 사조: ${audit.agreedWorkingTarget.taxonomyParents}개\n` +
    `- 정규 부모 사조 HTML: ${audit.agreedWorkingTarget.regularParentDocuments}개\n` +
    `- 이전 미술 참고 HTML: ${audit.agreedWorkingTarget.contextReferenceDocuments}개\n` +
    `- 세부 범주 연동형 / 단일 부모형: ${audit.agreedWorkingTarget.linkedParentDocuments}개 / ${audit.agreedWorkingTarget.singleParentDocuments}개\n` +
    `- 주의: ${audit.agreedWorkingTarget.note}\n\n` +
    `## 현재 수치\n\n` +
    `| 항목 | 수치 |\n|---|---:|\n` +
    `| 분류표 부모 사조 | ${s.taxonomyParents} |\n` +
    `| 현재 하위 사조가 정의된 부모 | ${s.taxonomyParentsWithChildren} |\n` +
    `| 현재 하위 사조 문자열 | ${s.taxonomySubmovementEntries} |\n` +
    `| index 등록 문서 | ${s.registeredDocuments} |\n` +
    `| 실제 HTML 파일 | ${s.physicalHtmlFiles} |\n` +
    `| 미등록 HTML 파일 | ${s.unregisteredHtmlFiles} |\n` +
    `| 현재 부모 사조와 직접 연결된 문서 | ${s.currentParentDocuments} |\n` +
    `| 부모가 아닌 등록 문서 | ${s.currentNonParentDocuments} |\n` +
    `| 국가 전개 표 행 | ${s.countryRows} |\n` +
    `| 표의 화가 링크(중복 포함) | ${s.tableArtistReferences} |\n` +
    `| 마지막 심화 구역의 대표작 카드 | ${s.representativeCards} |\n` +
    `| 화가 ID가 없는 대표작 카드 | ${s.cardsWithoutArtistId} |\n` +
    `| 이미지가 없는 대표작 카드 | ${s.cardsWithoutImage} |\n` +
    `| 상단 도판 재사용 방식의 대표작 카드 | ${s.reusedImageCards} |\n` +
    `| 구조 이슈가 감지된 등록 문서 | ${s.documentsWithIssues} |\n\n` +
    `## 문서 공백\n\n` +
    `현재 부모 사조와 직접 연결된 문서는 ${s.currentParentDocuments}/${s.taxonomyParents}개다. 직접 연결 문서가 없는 부모는 다음과 같다.\n\n` +
    `${markdownList(missingParents)}\n\n` +
    `부모 사조가 아닌 등록 문서: ${markdownList(audit.nonParentDocuments.map(item => item.key))}\n\n` +
    `index에 등록되지 않은 HTML: ${markdownList(audit.unregisteredFiles)}\n\n` +
    `## 구조 이슈\n\n` +
    `표와 카드는 전체 화가 집합뿐 아니라 범주별 순서까지 비교한다. 기존 문서 상당수에는 안정된 세부 범주 표식이 없어, 범주 연결 실패 역시 기준선 이슈로 기록한다.\n\n` +
    `| 문서 | 표 행 | 대표작 카드 | 카드 범주 | 감지 내용 |\n|---|---:|---:|---:|---|\n` +
    `${issueRows.length ? issueRows.join('\n') : '| - | 0 | 0 | 0 | 없음 |'}\n\n` +
    `## 다음 단계 입력\n\n` +
    `이 기준선의 다음 작업은 44개 부모 중 34개 정규 문서, 10개 흡수·참고 부모, 2개 이전 미술 참고 문서의 역할을 안정 ID로 확정하는 것이다. 그 뒤 국가 전개 표의 첫 열, 카드 범주, 화가 리스트 세부 박스가 같은 ID를 사용하도록 데이터 계약을 정한다.\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const audit = makeAudit();
  if (args.write) {
    fs.mkdirSync(path.dirname(args.json), {recursive: true});
    fs.mkdirSync(path.dirname(args.markdown), {recursive: true});
    fs.writeFileSync(args.json, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    fs.writeFileSync(args.markdown, makeMarkdown(audit), 'utf8');
  }
  console.log(JSON.stringify(audit.summary, null, 2));
  if (args.write) {
    console.log(normalizePath(path.relative(root, args.json)));
    console.log(normalizePath(path.relative(root, args.markdown)));
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
