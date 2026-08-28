#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const documentDir = path.join(dataDir, '미술사조');
const canonicalFile = path.join(dataDir, 'art-movement-canonical.json');
const contractFile = path.join(dataDir, 'art-movement-sync-contract.json');
const representativesFile = path.join(dataDir, 'art-movement-representatives.json');
const migrationFile = path.join(dataDir, 'art-movement-document-migration.json');
const movementsFile = path.join(dataDir, 'art-movements.json');
const artistsFile = path.join(dataDir, 'artists.json');
const artistIndexFile = path.join(dataDir, 'artists-index.json');
const indexFile = path.join(documentDir, 'index.json');
const reportFile = path.join(documentDir, 'REPRESENTATIVE_CONTENT.md');
const generatedAt = '2026-08-28T00:00:00.000Z';

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
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function attr(tag, name) {
  return new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(Boolean) || '';
}

function addAttribute(tag, name, value) {
  const without = tag.replace(new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`, 'i'), '');
  return without.replace(/\s*\/?>(\s*)$/, ` ${name}="${escapeHtml(value)}">$1`);
}

function openingTags(source, tagName, className = '') {
  const matches = [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))];
  return className ? matches.filter(match => new RegExp(`\\bclass=(?:"[^"]*\\b${className}\\b[^"]*"|'[^']*\\b${className}\\b[^']*')`, 'i').test(match[0])) : matches;
}

function elementEnd(source, start, tagName) {
  const pattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  pattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = pattern.exec(source))) {
    const closing = /^<\//.test(match[0]);
    const selfClosing = /\/>$/.test(match[0]);
    if (closing) depth -= 1;
    else if (!selfClosing) depth += 1;
    if (depth === 0) return pattern.lastIndex;
  }
  throw new Error(`Unclosed <${tagName}> at ${start}`);
}

function removeElements(source, tagName, predicate) {
  const ranges = openingTags(source, tagName).filter(match => predicate(match[0])).map(match => ({
    start: match.index,
    end: elementEnd(source, match.index, tagName)
  }));
  ranges.sort((a, b) => b.start - a.start).forEach(range => {
    source = source.slice(0, range.start) + source.slice(range.end);
  });
  return source;
}

function rootRelativeImage(documentFile, projectRelative) {
  return path.relative(path.dirname(documentFile), path.join(root, projectRelative)).replace(/\\/g, '/');
}

function artistLink(artist) {
  const id = escapeHtml(artist.id);
  const ko = escapeHtml(artist.name.ko);
  const en = escapeHtml(artist.name.en);
  return `<a class="art-atlas-artist-link" href="../../index.html?artist=${id}" target="_blank" rel="noopener" data-artist-id="${id}" data-uh-original="${en}" data-uh-korean="${ko}" title="${ko} 연표로 이동">${ko}</a>`;
}

function cardMarkup(entry, parent, documentFile, developmentId, countryIds, countryNames) {
  const artist = entry.artist;
  const work = entry.work;
  const localFile = work.localImage ? path.join(root, work.localImage) : '';
  const ready = Boolean(localFile && fs.existsSync(localFile));
  const image = ready
    ? `<div class="movement-work-image"><img src="${escapeHtml(rootRelativeImage(documentFile, work.localImage))}" alt="${escapeHtml(`${artist.name.ko}, ${work.title.ko}`)}"></div>`
    : '<div class="movement-work-image art-atlas-image-pending" role="img" aria-label="이미지 업로드 예정"><span>이미지 업로드 예정</span></div>';
  const regions = countryIds.map(id => countryNames.get(id)?.ko || id).join('·');
  return `<article class="movement-work-card" data-art-atlas-development-id="${escapeHtml(developmentId)}" data-art-atlas-category-id="${escapeHtml(entry.categoryId)}" data-artist-id="${escapeHtml(artist.id)}" data-work-id="${escapeHtml(work.id)}" data-art-atlas-image-state="${ready ? 'ready' : 'pending'}">` +
    image +
    `<div class="movement-work-body"><h3>${artistLink(artist)}, 《${escapeHtml(work.title.ko)}》<span class="movement-card-title-tag"> · ${escapeHtml(parent.name.ko)}</span><span class="movement-card-activity-region"> · ${escapeHtml(regions)}</span></h3>` +
    `<p class="work-meta">${escapeHtml(work.yearLabel || work.year)}</p>` +
    `<p class="movement-selection-reason" data-art-atlas-selection-reason=""><strong>선정 이유</strong> ${escapeHtml(entry.selectionReason)}</p>` +
    `<p class="movement-work-description" data-art-atlas-card-description="">${escapeHtml(entry.description)}</p></div></article>`;
}

function groupMarkup(entry, parent, documentFile, developmentId, countryIds, countryNames) {
  const categoryName = entry.category.name.ko;
  const regions = countryIds.map(id => countryNames.get(id)?.ko || id).join('·');
  return `<section class="art-atlas-submovement-group" data-art-atlas-development-id="${escapeHtml(developmentId)}" data-art-atlas-category-id="${escapeHtml(entry.categoryId)}" data-art-atlas-country-ids="${escapeHtml(countryIds.join(' '))}">` +
    `<h3 class="art-atlas-submovement-heading">${escapeHtml(categoryName)}<span class="movement-country-card-context"><span class="movement-country-card-context-region">${escapeHtml(regions)}</span><span class="movement-country-card-context-feature"><b>핵심 특징</b> ${escapeHtml(entry.feature)}</span></span></h3>` +
    `<div class="movement-work-grid art-atlas-work-sortable" data-art-atlas-development-id="${escapeHtml(developmentId)}">${cardMarkup(entry, parent, documentFile, developmentId, countryIds, countryNames)}</div></section>`;
}

function updateDevelopmentRows(html, entries, countryNames, attrs) {
  const entryMap = new Map(entries.map(entry => [entry.categoryId, entry]));
  const seen = new Set();
  const sectionOpening = openingTags(html, 'section').find(match => attr(match[0], 'id') === 'countries');
  assert(sectionOpening, 'Country development section is missing');
  const end = elementEnd(html, sectionOpening.index, 'section');
  let section = html.slice(sectionOpening.index, end);
  section = section.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, row => {
    if (/<td\b/i.test(row) && !new RegExp(`\\b${attrs.categoryId}=`, 'i').test(row)) return '';
    return row;
  });
  section = section.replace(/<tr\b[^>]*\bdata-art-atlas-category-id=(?:"[^"]+"|'[^']+')[^>]*>[\s\S]*?<\/tr>/gi, row => {
    const opening = /^<tr\b[^>]*>/i.exec(row)[0];
    const categoryId = attr(opening, attrs.categoryId);
    const entry = entryMap.get(categoryId);
    if (!entry) return row;
    assert(!seen.has(categoryId), `${categoryId}: duplicate development row`);
    seen.add(categoryId);
    const developmentId = attr(opening, attrs.developmentId);
    const countryIds = attr(opening, attrs.countryIds).split(/\s+/).filter(Boolean);
    assert(developmentId && countryIds.length, `${categoryId}: row identity is incomplete`);
    const regions = countryIds.map(id => countryNames.get(id)?.ko || id).join('·');
    return `${opening}<td><strong>${escapeHtml(regions)} — ${escapeHtml(entry.category.name.ko)}</strong></td>` +
      `<td><ol class="art-atlas-country-feature-list"><li><strong>핵심 특징</strong><ul><li>${escapeHtml(entry.feature)}</li></ul></li></ol></td>` +
      `<td ${attrs.representativeArtists}="">${artistLink(entry.artist)}</td></tr>`;
  });
  entries.forEach(entry => assert(seen.has(entry.categoryId), `${entry.categoryId}: development row is missing`));
  const tbodyOpen = /<tbody\b[^>]*>/i.exec(section);
  assert(tbodyOpen, 'Country development table body is missing');
  const tbodyStart = tbodyOpen.index + tbodyOpen[0].length;
  const tbodyEnd = section.indexOf('</tbody>', tbodyStart);
  assert(tbodyEnd > tbodyStart, 'Country development table body is not closed');
  const rowsByCategory = new Map([...section.slice(tbodyStart, tbodyEnd).matchAll(/<tr\b[^>]*\bdata-art-atlas-category-id=(?:"[^"]+"|'[^']+')[^>]*>[\s\S]*?<\/tr>/gi)].map(match => [
    attr(/^<tr\b[^>]*>/i.exec(match[0])[0], attrs.categoryId),
    match[0]
  ]));
  const orderedRows = entries.map(entry => rowsByCategory.get(entry.categoryId)).join('\n');
  assert(entries.every(entry => rowsByCategory.has(entry.categoryId)), 'Country development row ordering source is incomplete');
  section = section.slice(0, tbodyStart) + `\n${orderedRows}\n` + section.slice(tbodyEnd);
  return html.slice(0, sectionOpening.index) + section + html.slice(end);
}

function rebuildRepresentativeSection(html, entries, parent, documentFile, countryNames, attrs) {
  const sectionOpening = openingTags(html, 'section').find(match => attr(match[0], attrs.representativeSection) === 'works');
  assert(sectionOpening, `${parent.id}: representative section is missing`);
  const end = elementEnd(html, sectionOpening.index, 'section');
  let section = html.slice(sectionOpening.index, end);
  section = removeElements(section, 'div', tag => /\bart-atlas-representative-groups\b/i.test(attr(tag, 'class')));
  section = removeElements(section, 'section', tag => /\bart-atlas-submovement-group\b/i.test(attr(tag, 'class')));
  section = removeElements(section, 'div', tag => /\bmovement-work-grid\b/i.test(attr(tag, 'class')));
  section = removeElements(section, 'article', tag => /\bmovement-work-card\b/i.test(attr(tag, 'class')));
  const rows = [...html.matchAll(/<tr\b[^>]*\bdata-art-atlas-category-id=(?:"[^"]+"|'[^']+')[^>]*>/gi)];
  const rowMap = new Map(rows.map(match => [attr(match[0], attrs.categoryId), {
    developmentId: attr(match[0], attrs.developmentId),
    countryIds: attr(match[0], attrs.countryIds).split(/\s+/).filter(Boolean)
  }]));
  const groups = entries.map(entry => {
    const row = rowMap.get(entry.categoryId);
    assert(row, `${entry.categoryId}: row identity is missing while building cards`);
    return groupMarkup(entry, parent, documentFile, row.developmentId, row.countryIds, countryNames);
  }).join('\n');
  const close = section.lastIndexOf('</section>');
  assert(close > 0, `${parent.id}: representative section closing tag is missing`);
  const wrapper = `<div class="wrap art-atlas-representative-groups" data-art-atlas-content-source="data/art-movement-representatives.json">${groups}</div>`;
  section = section.slice(0, close).replace(/\s*$/, '') + `\n${wrapper}\n` + section.slice(close);
  html = html.slice(0, sectionOpening.index) + section + html.slice(end);
  html = html.replace(/<style\b[^>]*\bid=["']art-atlas-representative-content-style["'][^>]*>[\s\S]*?<\/style>/gi, '');
  const style = '<style id="art-atlas-representative-content-style">.art-atlas-representative-groups{width:min(1534px,94vw);max-width:none;margin:0 auto}.art-atlas-representative-groups .art-atlas-submovement-group{margin:34px 0}.art-atlas-representative-groups .movement-work-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.art-atlas-representative-groups .movement-work-card{border:1px solid var(--line,#3a3f44);border-radius:8px;background:var(--panel,#181b1e);overflow:hidden}.art-atlas-representative-groups .movement-work-image{aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#0e1114}.art-atlas-representative-groups .movement-work-image img{width:100%;height:100%;object-fit:cover}.art-atlas-representative-groups .art-atlas-image-pending{color:var(--muted,#b8bdc2);border-bottom:1px dashed var(--line,#3a3f44)}.art-atlas-representative-groups .movement-work-body{padding:16px}.art-atlas-representative-groups .movement-work-body h3{font-size:1.08rem;line-height:1.45;margin:0 0 8px}.art-atlas-representative-groups .work-meta{color:var(--muted,#b8bdc2);margin:.25rem 0 .85rem}.art-atlas-representative-groups .movement-selection-reason{padding:.75rem;border-left:3px solid var(--accent,#e2b85f);background:rgba(226,184,95,.08)}.art-atlas-representative-groups .movement-country-card-context{display:block;margin-top:.4rem;color:var(--muted,#b8bdc2);font-size:.85em;font-weight:400}.art-atlas-representative-groups .movement-country-card-context-region{display:block;color:var(--accent,#e2b85f);font-weight:700}.art-atlas-representative-groups .movement-country-card-context-feature{display:block}@media(max-width:980px){.art-atlas-representative-groups .movement-work-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.art-atlas-representative-groups .movement-work-grid{grid-template-columns:1fr}}</style>';
  return html.replace(/<\/head>/i, `${style}</head>`);
}

function upsertArtist(artists, entry, parent) {
  let artist = artists.find(item => item.id === entry.artist.id);
  if (!artist) {
    artist = {
      id: entry.artist.id,
      name: entry.artist.name,
      birth: entry.artist.birth,
      death: entry.artist.death,
      nationality: entry.artist.nationality,
      movement: parent.name,
      works: [],
      featuredWorkIds: [entry.work.id],
      profileResolved: true,
      movements: [parent.name.ko],
      submovements: [entry.category.name.ko],
      primaryMovement: parent.name.ko,
      regions: [entry.artist.nationality.ko],
      activeFrom: entry.artist.birth ? entry.artist.birth + 20 : undefined,
      activeTo: entry.artist.death,
      listName: {ko: entry.artist.name.ko.split(' ').at(-1)},
      metadata: {createdAt: generatedAt, updatedAt: generatedAt, createdBy: 'phase-5-rebuild', updatedBy: 'phase-5-rebuild'}
    };
    Object.keys(artist).forEach(key => artist[key] === undefined && delete artist[key]);
    artists.push(artist);
  }
  artist.works ||= [];
  let work = artist.works.find(item => item.id === entry.work.id);
  if (!work) {
    work = {id: entry.work.id};
    artist.works.push(work);
  }
  work.title = entry.work.title;
  work.year = entry.work.year;
  work.popularity = Math.max(Number(work.popularity || 0), 90);
  work.country = entry.artist.nationality;
  work.movement = parent.name;
  work.description ||= {ko: entry.description, en: ''};
  work.representative = true;
  work.movementContribution = true;
  work.movementContributionReason = 'canonical-movement-representative';
  work.verified = true;
  work.origin ||= 'art-movement-representatives';
  if (entry.work.localImage && fs.existsSync(path.join(root, entry.work.localImage))) {
    work.thumbnail = entry.work.localImage;
    delete work.imageUploadStatus;
  } else if (!work.thumbnail || !fs.existsSync(path.join(root, work.thumbnail))) {
    delete work.thumbnail;
    work.imageUploadStatus = 'pending-upload';
  }
  work.migration = {
    schema: 1,
    image: {
      status: work.thumbnail ? 'ready' : 'missing',
      localThumbnail: work.thumbnail || '',
      highResolution: work.migration?.image?.highResolution || '',
      sourceUrl: work.migration?.image?.sourceUrl || '',
      sourceUrls: work.migration?.image?.sourceUrls || [],
      license: work.migration?.image?.license || '',
      institution: work.migration?.image?.institution || ''
    }
  };
  artist.featuredWorkIds = [...new Set([entry.work.id, ...(artist.featuredWorkIds || [])])];
  artist.works.forEach(candidate => {
    if (candidate.id === entry.work.id || candidate.movementContributionReason !== 'artist-movement-characteristic') return;
    candidate.movementContribution = false;
    delete candidate.movementContributionReason;
  });
  artist.movements = [...new Set([...(artist.movements || []), parent.name.ko])];
  artist.submovements = [...new Set([...(artist.submovements || []), entry.category.name.ko])];
  artist.metadata ||= {};
  artist.metadata.updatedAt = generatedAt;
  artist.metadata.updatedBy = 'phase-5-rebuild';
}

function main() {
  const canonical = readJson(canonicalFile);
  const contract = readJson(contractFile);
  const representatives = readJson(representativesFile);
  const migration = readJson(migrationFile);
  const movementData = readJson(movementsFile);
  const artistsData = readJson(artistsFile);
  const index = readJson(indexFile);
  const attrs = contract.attributes;
  const categories = new Map(canonical.categories.map(category => [category.id, category]));
  const parents = canonical.parents.filter(parent => parent.role === 'document');
  const parentMap = new Map(parents.map(parent => [parent.id, parent]));
  const countryNames = new Map(movementData.countries.map(country => [country.id, country.name]));
  const entries = representatives.categories.map(entry => ({...entry, category: categories.get(entry.categoryId)}));
  const entryIds = new Set(entries.map(entry => entry.categoryId));
  assert(entries.length === canonical.counts.beginnerCategories, `Expected ${canonical.counts.beginnerCategories} representative categories, got ${entries.length}`);
  assert(entryIds.size === entries.length, 'Representative category IDs must be unique');
  canonical.categories.forEach(category => assert(entryIds.has(category.id), `${category.id}: representative entry is missing`));
  entries.forEach(entry => {
    assert(entry.category, `${entry.categoryId}: unknown canonical category`);
    assert(entry.feature && entry.selectionReason && entry.description, `${entry.categoryId}: explanatory text is incomplete`);
    assert(entry.artist?.id && entry.work?.id, `${entry.categoryId}: artist or work identity is incomplete`);
  });

  const staged = [];
  parents.forEach(parent => {
    const parentEntries = parent.categoryIds.map(categoryId => entries.find(entry => entry.categoryId === categoryId));
    assert(parentEntries.every(Boolean), `${parent.id}: category entries are incomplete`);
    const relative = index.documents?.[parent.documentKey]?.['1'];
    assert(relative, `${parent.documentKey}: document is not indexed`);
    const documentFile = path.join(root, relative);
    let html = fs.readFileSync(documentFile, 'utf8');
    assert(attr(/<html\b[^>]*>/i.exec(html)?.[0] || '', attrs.parentId) === parent.id, `${parent.id}: document root mismatch`);
    html = removeElements(html, 'section', tag => /\bart-atlas-submovement-group\b/i.test(attr(tag, 'class')));
    html = updateDevelopmentRows(html, parentEntries, countryNames, attrs);
    html = rebuildRepresentativeSection(html, parentEntries, parent, documentFile, countryNames, attrs);
    html = html.replace(/<html\b[^>]*>/i, tag => addAttribute(tag, attrs.syncState, 'content'));
    staged.push({file: documentFile, html});
    parentEntries.forEach(entry => upsertArtist(artistsData.artists, entry, parentMap.get(parent.id)));
  });

  const ready = entries.filter(entry => entry.work.localImage && fs.existsSync(path.join(root, entry.work.localImage))).length;
  const pending = entries.length - ready;
  const duplicateArtists = entries.filter((entry, index, list) => list.findIndex(other => other.artist.id === entry.artist.id) !== index);
  assert(!duplicateArtists.length, `Representative artists must be unique in phase 5: ${duplicateArtists.map(entry => entry.artist.id).join(', ')}`);
  staged.forEach(item => fs.writeFileSync(item.file, item.html, 'utf8'));
  artistsData.metadata ||= {};
  artistsData.metadata.updatedAt = generatedAt;
  artistsData.metadata.updatedBy = 'phase-5-rebuild';
  artistsData.metadata.representativeContentSchema = representatives.schema;
  writeJson(artistsFile, artistsData);
  writeJson(artistIndexFile, {
    dataSchema: artistsData.dataSchema || 1,
    metadata: artistsData.metadata || {},
    artists: artistsData.artists.map(({works, ...artist}) => ({...artist, workCount: Array.isArray(works) ? works.length : 0, _detailLoaded: false})),
    deletedArtists: Array.isArray(artistsData.deletedArtists) ? artistsData.deletedArtists : [],
    historicalEvents: Array.isArray(artistsData.historicalEvents) ? artistsData.historicalEvents : [],
    favoriteWorks: Array.isArray(artistsData.favoriteWorks) ? artistsData.favoriteWorks : []
  });
  fs.writeFileSync(reportFile,
    '# 5단계 대표 화가·대표작 콘텐츠\n\n' +
    `- 정본 범주: ${entries.length}개\n` +
    `- 부모 사조 문서: ${parents.length}개\n` +
    `- 기준점 화가·대표작 카드: ${entries.length}개\n` +
    `- 로컬 이미지 연결: ${ready}개\n` +
    `- 이미지 업로드 예정: ${pending}개\n` +
    '- 문서 상태: `content` (6단계 ID 기반 편집 동기화 전까지 저장 잠금)\n\n' +
    '각 범주는 `data/art-movement-representatives.json`의 기준점 화가 1명으로 시작한다. 두 번째 화가는 첫 화가와 다른 핵심 축을 설명할 때만 이후 검토에서 추가한다. 외부 이미지 URL은 새로 만들지 않았다.\n',
    'utf8'
  );
  console.log(JSON.stringify({parents: parents.length, categories: entries.length, ready, pending, artists: artistsData.artists.length}, null, 2));
}

main();
