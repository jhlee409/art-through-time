#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const documentDir = path.join(dataDir, '미술사조');
const canonicalFile = path.join(dataDir, 'art-movement-canonical.json');
const contractFile = path.join(dataDir, 'art-movement-sync-contract.json');
const migrationFile = path.join(dataDir, 'art-movement-document-migration.json');
const movementsFile = path.join(dataDir, 'art-movements.json');
const indexFile = path.join(documentDir, 'index.json');
const legacyIndexFile = path.join(documentDir, 'legacy-index.json');
const countryTableStyle = '<style id="art-atlas-country-development-table-style">#countries[data-art-atlas-country-feature-editor] .wrap{width:100%;max-width:none;padding-left:3vw;padding-right:3vw}#countries[data-art-atlas-country-feature-editor] table{min-width:0}#countries[data-art-atlas-country-feature-editor] th:not(:last-child),#countries[data-art-atlas-country-feature-editor] td:not(:last-child){border-right:1px solid #fff}#countries[data-art-atlas-country-feature-editor] th:first-child,#countries[data-art-atlas-country-feature-editor] td:first-child,#countries[data-art-atlas-country-feature-editor] th:nth-child(3),#countries[data-art-atlas-country-feature-editor] td:nth-child(3){width:1%;white-space:nowrap}#countries[data-art-atlas-country-feature-editor] td:nth-child(2){position:relative;padding-right:48px;text-align:left;vertical-align:middle}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list{margin:.1em 0;padding-left:1.45em;text-align:left}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list>li{margin:.38em 0}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list strong{display:block}#countries[data-art-atlas-country-feature-editor] .art-atlas-country-feature-list ul{margin:.25em 0 0;padding-left:1.2em}</style>';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function addAttributes(openingTag, attributes) {
  let tag = openingTag;
  Object.entries(attributes).forEach(([name, value]) => {
    tag = tag.replace(new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`, 'i'), '');
    const insertion = ` ${name}="${escapeHtml(value)}"`;
    tag = tag.replace(/\s*\/?>$/, ending => `${insertion}${ending.includes('/') ? ' />' : '>'}`);
  });
  return tag;
}

function replaceAt(source, start, length, replacement) {
  return source.slice(0, start) + replacement + source.slice(start + length);
}

function developmentId(categoryId, countryIds) {
  return `dev--${categoryId.replace(/--/g, '-')}-${countryIds[0]}`;
}

function ensureMexico(source) {
  if ((JSON.parse(source).countries || []).some(country => country.id === 'mexico')) return source;
  const marker = '    {"id":"global-contemporary"';
  assert(source.includes(marker), 'global contemporary country marker is missing');
  const mexico = '    {"id":"mexico","name":{"ko":"멕시코","en":"Mexico"},"movements":[\n' +
    '      {"name":{"ko":"멕시코 벽화운동","en":"Mexican Muralism"},"start":1920,"end":1950,"color":"#a85f48"}\n' +
    '    ]},\n';
  return source.replace(marker, mexico + marker);
}

function markDocumentRoot(html, attributes) {
  return html.replace(/<html\b[^>]*>/i, tag => addAttributes(tag, attributes));
}

function markRepresentativeSection(html, representativeAttribute) {
  const matches = [...html.matchAll(/<section\b(?=[^>]*\bclass=["'][^"']*movement-enhancement)[^>]*>/gi)];
  assert(matches.length, 'representative enhancement section is missing');
  const match = matches[matches.length - 1];
  const replacement = addAttributes(match[0], {[representativeAttribute]: 'works'});
  return replaceAt(html, match.index, match[0].length, replacement);
}

function markRepresentativeCell(row, representativeAttribute) {
  const cells = [...row.matchAll(/<td\b[^>]*>/gi)];
  assert(cells.length >= 3, 'country development row does not have three cells');
  const cell = cells[2];
  const replacement = addAttributes(cell[0], {[representativeAttribute]: ''});
  return replaceAt(row, cell.index, cell[0].length, replacement);
}

function scaffoldRow(category, countries, attrs, countryNames) {
  const devId = developmentId(category.id, countries);
  const region = countries.map(id => countryNames.get(id)?.ko || id).join('·');
  return `\n<tr ${attrs.developmentId}="${devId}" ${attrs.categoryId}="${category.id}" ${attrs.countryIds}="${countries.join(' ')}">` +
    `<td><strong>${escapeHtml(region)} — ${escapeHtml(category.name.ko)}</strong></td>` +
    `<td><ul class="art-atlas-country-feature-list"><li><strong>전개</strong>${escapeHtml(category.name.ko)}는 ${escapeHtml(region)}에서 확인할 수 있는 핵심 전개 범주다.</li></ul></td>` +
    `<td ${attrs.representativeArtists}=""></td></tr>`;
}

function bindCountryRows(html, parent, categories, binding, migration, attrs, countryNames) {
  const sectionMatch = /<section\b[^>]*\bid=["']countries["'][^>]*>/i.exec(html);
  assert(sectionMatch, `${parent.documentKey}: #countries section is missing`);
  const tbodyOpen = html.indexOf('<tbody', sectionMatch.index);
  assert(tbodyOpen >= 0, `${parent.documentKey}: country table tbody is missing`);
  const tbodyStart = html.indexOf('>', tbodyOpen) + 1;
  const tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  assert(tbodyEnd >= 0, `${parent.documentKey}: country table tbody is not closed`);
  let body = html.slice(tbodyStart, tbodyEnd);
  const rows = [...body.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].filter(match => /<td\b/i.test(match[0]));
  const replacements = [];
  const bound = new Set(rows.flatMap(match => {
    const category = new RegExp(`${attrs.categoryId}=["']([^"']+)["']`, 'i').exec(match[0]);
    return category ? [category[1]] : [];
  }));

  categories.forEach(category => {
    if (bound.has(category.id)) return;
    const rowIndex = binding.rows?.[category.id];
    if (!Number.isInteger(rowIndex)) return;
    const rowMatch = rows[rowIndex];
    assert(rowMatch, `${parent.documentKey}: configured row ${rowIndex} is missing for ${category.id}`);
    const countries = migration.categoryCountries[category.id];
    const devId = developmentId(category.id, countries);
    const opening = /^<tr\b[^>]*>/i.exec(rowMatch[0]);
    let row = replaceAt(rowMatch[0], opening.index, opening[0].length, addAttributes(opening[0], {
      [attrs.developmentId]: devId,
      [attrs.categoryId]: category.id,
      [attrs.countryIds]: countries.join(' ')
    }));
    row = markRepresentativeCell(row, attrs.representativeArtists);
    replacements.push({start: rowMatch.index, length: rowMatch[0].length, value: row});
    bound.add(category.id);
  });

  replacements.sort((a, b) => b.start - a.start).forEach(change => {
    body = replaceAt(body, change.start, change.length, change.value);
  });
  const additions = categories.filter(category => !bound.has(category.id)).map(category =>
    scaffoldRow(category, migration.categoryCountries[category.id], attrs, countryNames)
  ).join('');
  body += additions;
  return replaceAt(html, tbodyStart, tbodyEnd - tbodyStart, body);
}

function groupMarkup(category, countries, attrs) {
  const devId = developmentId(category.id, countries);
  return `\n<section class="art-atlas-submovement-group art-atlas-migration-scaffold" ${attrs.developmentId}="${devId}" ${attrs.categoryId}="${category.id}" ${attrs.countryIds}="${countries.join(' ')}">` +
    `<h3 class="art-atlas-submovement-heading">${escapeHtml(category.name.ko)}</h3>` +
    `<div class="movement-work-grid art-atlas-work-sortable" ${attrs.developmentId}="${devId}"></div>` +
    `</section>`;
}

function bindExistingGroups(html, parent, categories, binding, migration, attrs) {
  const groupMatches = [...html.matchAll(/<section\b(?=[^>]*\bclass=["'][^"']*art-atlas-submovement-group)[^>]*>/gi)];
  const configured = categories.map(category => ({category, index: binding.groups?.[category.id]})).filter(item => Number.isInteger(item.index));
  configured.sort((a, b) => b.index - a.index).forEach(({category, index}) => {
    const match = groupMatches[index];
    assert(match, `${parent.documentKey}: configured group ${index} is missing for ${category.id}`);
    const nextStart = groupMatches[index + 1]?.index || html.indexOf('<!-- art-atlas-expanded-document-width:start -->', match.index);
    const end = nextStart > match.index ? nextStart : html.indexOf('</main>', match.index);
    let segment = html.slice(match.index, end);
    const countries = migration.categoryCountries[category.id];
    const devId = developmentId(category.id, countries);
    const opening = /^<section\b[^>]*>/i.exec(segment);
    segment = replaceAt(segment, opening.index, opening[0].length, addAttributes(opening[0], {
      [attrs.developmentId]: devId,
      [attrs.categoryId]: category.id,
      [attrs.countryIds]: countries.join(' ')
    }));
    const grid = /<div\b(?=[^>]*\bclass=["'][^"']*movement-work-grid)[^>]*>/i.exec(segment);
    if (grid) segment = replaceAt(segment, grid.index, grid[0].length, addAttributes(grid[0], {[attrs.developmentId]: devId}));
    segment = segment.replace(/<article\b(?=[^>]*\bclass=["'][^"']*movement-work-card)[^>]*>/gi, tag => addAttributes(tag, {
      [attrs.developmentId]: devId,
      [attrs.categoryId]: category.id
    }));
    html = replaceAt(html, match.index, end - match.index, segment);
  });
  return html;
}

function appendMissingGroups(html, categories, migration, attrs) {
  const groupCategories = new Set([...html.matchAll(/<section\b(?=[^>]*\bclass=["'][^"']*art-atlas-submovement-group)[^>]*>/gi)].flatMap(match => {
    const category = new RegExp(`${attrs.categoryId}=["']([^"']+)["']`, 'i').exec(match[0]);
    return category ? [category[1]] : [];
  }));
  const missing = categories.filter(category => !groupCategories.has(category.id));
  if (!missing.length) return html;
  const enhancements = [...html.matchAll(/<section\b(?=[^>]*\bclass=["'][^"']*movement-enhancement)[^>]*>/gi)];
  const representative = enhancements.filter(match => new RegExp(`${attrs.representativeSection}=["']works["']`, 'i').test(match[0])).at(-1);
  assert(representative, 'bound representative section is missing');
  let boundary = html.indexOf('<!-- art-atlas-expanded-document-width:start -->', representative.index);
  if (boundary < 0) boundary = html.indexOf('</main>', representative.index);
  assert(boundary > representative.index, 'representative section boundary is missing');
  const insertion = html.lastIndexOf('</section>', boundary);
  assert(insertion > representative.index, 'representative section closing tag is missing');
  const markup = missing.map(category => groupMarkup(category, migration.categoryCountries[category.id], attrs)).join('');
  return html.slice(0, insertion) + markup + '\n' + html.slice(insertion);
}

function migrateExistingParent(html, parent, categories, binding, migration, attrs, countryNames) {
  html = markDocumentRoot(html, {
    [attrs.syncVersion]: migration.syncVersion,
    [attrs.syncState]: migration.syncState,
    [attrs.parentId]: parent.id
  });
  html = markRepresentativeSection(html, attrs.representativeSection);
  html = bindCountryRows(html, parent, categories, binding, migration, attrs, countryNames);
  html = bindExistingGroups(html, parent, categories, binding, migration, attrs);
  html = appendMissingGroups(html, categories, migration, attrs);
  return html;
}

function skeletonDocument(parent, categories, migration, attrs, countryNames) {
  const rows = categories.map(category => scaffoldRow(category, migration.categoryCountries[category.id], attrs, countryNames)).join('');
  const groups = categories.map(category => groupMarkup(category, migration.categoryCountries[category.id], attrs)).join('');
  const level = ({detailed: '상세 사조', bridge: '연결 사조', reference: '참고 사조'})[parent.documentLevel] || '사조';
  return `<!doctype html>\n<html lang="ko" ${attrs.syncVersion}="${migration.syncVersion}" ${attrs.syncState}="${migration.syncState}" ${attrs.parentId}="${parent.id}">\n<head>\n` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(parent.name.ko)} · Art Through Time</title>` +
    `<style>:root{--bg:#101214;--panel:#181b1e;--line:#3a3f44;--text:#f4f1e9;--muted:#b8bdc2;--accent:#e2b85f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,"Pretendard","Noto Sans KR",Arial,sans-serif;line-height:1.65}.wrap{width:min(1180px,92vw);margin:auto}header,section{padding:42px 0;border-bottom:1px solid var(--line)}h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2rem,5vw,4rem);margin:.2rem 0}h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.5rem,3vw,2.5rem)}.kicker{color:var(--accent);font-weight:800}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;min-width:760px;background:var(--panel)}th,td{padding:14px 16px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}th{color:#f0d79f}td:first-child,td:last-child{white-space:nowrap}.art-atlas-country-feature-list{margin:0;padding-left:1.2rem}.art-atlas-submovement-group{margin:34px 0}.movement-work-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;min-height:1px}.movement-work-card{border:1px solid var(--line);border-radius:8px;background:var(--panel);overflow:hidden}@media(max-width:800px){.movement-work-grid{grid-template-columns:1fr}}</style>` +
    `${countryTableStyle}</head><body><header><div class="wrap"><div class="kicker">${level}</div><h1>${escapeHtml(parent.name.ko)}</h1><p>${escapeHtml(parent.name.en)}</p></div></header>` +
    `<main><section id="overview"><div class="wrap"><h2>개요</h2><p>${escapeHtml(parent.name.ko)}의 시대적 배경과 시각적 특징을 국가별 전개 속에서 살펴본다.</p></div></section>` +
    `<section id="countries" data-art-atlas-country-feature-editor="country-development"><div class="wrap"><h2>여러 국가에서의 전개</h2><div class="table-wrap"><table><thead><tr><th>국가·지역·세부 사조</th><th>지역적 특징</th><th>대표 화가·제작자</th></tr></thead><tbody>${rows}\n</tbody></table></div></div></section>` +
    `<section class="movement-enhancement" ${attrs.representativeSection}="works"><div class="wrap"><h2>대표 화가와 작품</h2>${groups}\n</div></section></main>` +
    `<script defer src="../../uhangul/uhangul-runtime.js?v=0.7" data-uhangul-integration="v0.7"></script></body></html>\n`;
}

function migrateContext(html, context, migration, attrs) {
  html = markDocumentRoot(html, {
    [attrs.syncVersion]: migration.syncVersion,
    [attrs.syncState]: migration.syncState,
    [attrs.contextId]: context.id
  });
  return markRepresentativeSection(html, attrs.representativeSection);
}

function targetPath(documentKey) {
  const stem = String(documentKey || '').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim();
  if (!stem) throw new Error('Invalid movement document file name');
  return `data/미술사조/${stem}.html`;
}

function main() {
  const canonical = readJson(canonicalFile);
  const contract = readJson(contractFile);
  const migration = readJson(migrationFile);
  const movementSource = fs.readFileSync(movementsFile, 'utf8');
  const nextMovementSource = ensureMexico(movementSource);
  const movementData = JSON.parse(nextMovementSource);
  const oldIndex = readJson(indexFile);
  const attrs = contract.attributes;
  const documentParents = canonical.parents.filter(parent => parent.role === 'document');
  const categories = new Map(canonical.categories.map(category => [category.id, category]));
  const configuredCategories = Object.keys(migration.categoryCountries);
  assert(configuredCategories.length === canonical.categories.length, 'migration country map must cover all canonical categories');
  canonical.categories.forEach(category => assert(migration.categoryCountries[category.id]?.length, `missing countries for ${category.id}`));

  const countryNames = new Map(movementData.countries.map(country => [country.id, country.name]));
  configuredCategories.forEach(categoryId => migration.categoryCountries[categoryId].forEach(countryId =>
    assert(countryNames.has(countryId), `${categoryId}: unknown country ${countryId}`)
  ));

  const nextDocuments = {};
  let created = 0;
  let migrated = 0;
  documentParents.forEach(parent => {
    const categoryList = parent.categoryIds.map(id => categories.get(id));
    const existing = oldIndex.documents?.[parent.documentKey]?.['1'];
    const relative = existing || targetPath(parent.documentKey);
    const absolute = path.join(root, relative);
    let html;
    if (existing) {
      html = migrateExistingParent(fs.readFileSync(absolute, 'utf8'), parent, categoryList, migration.existingDocumentBindings[parent.documentKey] || {rows:{},groups:{}}, migration, attrs, countryNames);
      migrated += 1;
    } else {
      html = skeletonDocument(parent, categoryList, migration, attrs, countryNames);
      created += 1;
    }
    fs.writeFileSync(absolute, html, 'utf8');
    nextDocuments[parent.documentKey] = {'1': relative.replace(/\\/g, '/')};
  });

  const contexts = new Map(canonical.contextReferences.map(context => [context.documentKey, context]));
  contexts.forEach((context, documentKey) => {
    const relative = oldIndex.documents?.[documentKey]?.['1'];
    assert(relative, `${documentKey}: context document is missing from old index`);
    const absolute = path.join(root, relative);
    const html = migrateContext(fs.readFileSync(absolute, 'utf8'), context, migration, attrs);
    fs.writeFileSync(absolute, html, 'utf8');
    nextDocuments[documentKey] = {'1': relative.replace(/\\/g, '/')};
    migrated += 1;
  });

  const targetKeys = new Set(Object.keys(nextDocuments));
  const legacyDocuments = {...(migration.legacyDocuments || {})};
  Object.entries(oldIndex.documents || {}).forEach(([key, slots]) => {
    if (!targetKeys.has(key) && !legacyDocuments[key]) legacyDocuments[key] = {...slots, placement: 'legacy-reference'};
  });
  writeJson(indexFile, {documents: nextDocuments});
  writeJson(legacyIndexFile, {
    schema: 1,
    purpose: '정본 36개 문서 색인에서 제외했지만 5단계 내용 흡수 전까지 삭제하지 않는 기존 사조 문서',
    documents: legacyDocuments
  });
  if (nextMovementSource !== movementSource) fs.writeFileSync(movementsFile, nextMovementSource, 'utf8');

  console.log(JSON.stringify({documents: Object.keys(nextDocuments).length, parents: documentParents.length, contexts: contexts.size, migrated, created, legacyPreserved: Object.keys(legacyDocuments).length, movementCountries: movementData.countries.length}, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
