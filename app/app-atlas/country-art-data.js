function countryArtTextMatches(value, countryId) {
  const text = String(value || '').toLowerCase();
  return (countryArtAliases[countryId] || []).some(alias => {
    const normalizedAlias = alias.toLowerCase();
    // Latin country labels need word boundaries: "Prussia" must not match
    // the "russia" alias simply because it contains the same letters.
    if (/[a-z]/i.test(normalizedAlias)) {
      const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z])`, 'i').test(text);
    }
    return text.includes(normalizedAlias);
  });
}
function countryArtCardBelongs(card, countryId) {
  const canonicalCountries = (card.closest('[data-art-atlas-country-ids]')?.dataset.artAtlasCountryIds || '').split(/\s+/).filter(Boolean);
  if (canonicalCountries.length) return canonicalCountries.includes(countryId);
  const region = card.querySelector('.movement-card-activity-region')?.textContent || '';
  if (countryArtTextMatches(region, countryId)) return true;
  const artistId = new URL(card.querySelector('.art-atlas-artist-link')?.href || '', location.href).searchParams.get('artist');
  const artist = artists.find(item => item.id === artistId);
  return countryArtTextMatches(`${artist?.nationality?.ko || ''} ${artist?.nationality?.en || ''}`, countryId);
}
function countryArtCleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
function countryArtBriefArtistName(card) {
  const artistLink = card.querySelector('h3 .art-atlas-artist-link, .art-atlas-artist-link');
  if (artistLink) {
    const listName = language === 'ko' ? artistLink.dataset.uhListKorean : '';
    const originalName = language !== 'ko' ? artistLink.dataset.uhOriginal : '';
    return countryArtCleanText(listName || originalName || artistLink.textContent);
  }
  return countryArtCleanText(card.querySelector('h3 .movement-card-artist-name, .movement-card-artist-name')?.textContent);
}
function countryArtWorkTitle(card, image) {
  const heading = card.querySelector('h3');
  if (!heading) return countryArtCleanText(image.alt) || (language === 'ko' ? '대표작' : 'Representative work');
  const copy = heading.cloneNode(true);
  copy.querySelectorAll('.movement-card-title-tag, .movement-card-activity-region, .movement-country-card-context').forEach(node => node.remove());
  const artistNode = copy.querySelector('.art-atlas-artist-link, .movement-card-artist-name');
  const artistText = countryArtCleanText(artistNode?.textContent);
  if (artistNode) artistNode.remove();
  const title = countryArtCleanText(copy.textContent).replace(/^[-–—,·:;\s]+/, '');
  return title || countryArtCleanText(heading.textContent).replace(artistText, '').replace(/^[-–—,·:;\s]+/, '') || countryArtCleanText(image.alt) || (language === 'ko' ? '대표작' : 'Representative work');
}
function countryArtBriefYear(card) {
  const meta = countryArtCleanText(card.querySelector('.work-meta, small')?.textContent);
  return countryArtCleanText(meta.split(/\s*·\s*|\s*\|\s*|;\s*/)[0]);
}
function countryArtMovementDocumentName(movement) {
  const ownerId = movement?.canonical?.documentOwnerId;
  const owner = ownerId && (artMovementCanonical.parents || []).find(parent => parent.id === ownerId);
  const ownerDocument = owner?.documentKey;
  if (ownerDocument && movementDocuments?.[ownerDocument]?.['1']) return ownerDocument;
  return movementDocumentKey(movement?.name?.en || movement?.name?.ko || '');
}
function countryArtWorksFor(country, movement) {
  const documentName = countryArtMovementDocumentName(movement);
  const documentUrl = documentName && movementDocuments?.[documentName]?.['1'];
  if (!documentUrl) return {state:'missing',works:[]};
  const developmentIds = new Set(movement?.canonical?.developmentIds || []);
  const developmentKey = developmentIds.size ? [...developmentIds].join(',') : 'all';
  const cacheKey = `${country.id}::${documentName}::${developmentKey}`;
  if (countryArtWorkCache.has(cacheKey)) return {state:'ready',works:countryArtWorkCache.get(cacheKey)};
  if (!countryArtWorkRequests.has(cacheKey)) {
    countryArtWorkRequests.set(cacheKey, fetch(documentUrl).then(response => response.ok ? response.text() : '').then(html => {
      const source = new DOMParser().parseFromString(html, 'text/html');
      const sourceImages = [...source.querySelectorAll('main section:not(.movement-enhancement) img')];
      source.querySelectorAll('.movement-enhancement img[data-art-atlas-reuse-image]').forEach(image => {
        const original = sourceImages[Number(image.dataset.artAtlasReuseImage)];
        if (original?.getAttribute('src')) image.setAttribute('src', original.getAttribute('src'));
      });
      // Comparison illustrations at the start of a movement document are contextual only.
      // The final enhancement section is the canonical representative-work card collection.
      const enhancementSections = [...source.querySelectorAll('.movement-enhancement')];
      const representativeSection = source.querySelector('.movement-enhancement[data-art-atlas-representative-section="works"]') || enhancementSections.at(-1);
      const works = [...(representativeSection?.querySelectorAll('article.movement-work-card, article.card') || [])].filter(card => {
        const developmentId = card.dataset.artAtlasDevelopmentId || card.closest('[data-art-atlas-development-id]')?.dataset.artAtlasDevelopmentId || '';
        return (!developmentIds.size || developmentIds.has(developmentId)) && countryArtCardBelongs(card, country.id);
      }).map(card => {
        const image = card.querySelector('img');
        if (!image?.getAttribute('src')) return null;
        const artistName = countryArtBriefArtistName(card);
        const title = countryArtWorkTitle(card, image);
        const year = countryArtBriefYear(card);
        const sortYear = Number((year.match(/-?\d{3,4}/) || [])[0]) || 9999;
        const description = (card.querySelector('[data-art-atlas-card-description]') || card.querySelector('.movement-work-body p, .card-body p, p'))?.textContent?.replace(/\s+/g, ' ').trim() || '';
        return {src:new URL(image.getAttribute('src'), new URL(documentUrl, location.href)).href, alt:image.alt || title, artistName, title, year, sortYear, descriptionLength:description.length};
      }).filter(Boolean);
      countryArtWorkCache.set(cacheKey, works);
    }).catch(() => countryArtWorkCache.set(cacheKey, [])).finally(() => {
      countryArtWorkRequests.delete(cacheKey);
      if (viewMode === 'country-art') renderCountryArt();
    }));
  }
  return {state:'loading',works:[]};
}
const countryArtEventCategories = ['war-revolution', 'social-political', 'religion-thought', 'patronage', 'art-institution', 'technology-economy'];
const countryArtEventCategoryLabel = category => ({
  'war-revolution': language === 'ko' ? '전쟁·혁명' : 'War & revolution',
  'social-political': language === 'ko' ? '사회·정치' : 'Social & political',
  'religion-thought': language === 'ko' ? '종교·사상' : 'Religion & thought',
  patronage: language === 'ko' ? '후원·궁정' : 'Patronage & court',
  'art-institution': language === 'ko' ? '미술 제도' : 'Art institutions',
  'technology-economy': language === 'ko' ? '기술·경제' : 'Technology & economy'
}[category] || category);
const countryArtWarOutcomeLabel = outcome => ({
  victory: language === 'ko' ? '승전' : 'victory',
  defeat: language === 'ko' ? '패전' : 'defeat',
  unclear: language === 'ko' ? '불명확' : 'unclear'
}[outcome] || (language === 'ko' ? '불명확' : 'unclear'));
function countryArtEventKind(event) {
  return String(event?.eventKind || event?.kind || '').trim().toLowerCase();
}
function countryArtWarOutcome(event) {
  const outcome = String(event?.countryOutcome || event?.warOutcome || '').trim().toLowerCase();
  return ['victory', 'defeat'].includes(outcome) ? outcome : 'unclear';
}
function countryArtEventsFor(countryId, start, end) {
  return (countryArtEvents?.countries?.[countryId] || [])
    .map(event => ({...event,start:Number(event.start),end:event.end === undefined || event.end === null ? null : Number(event.end),importance:Number(event.importance) || 1}))
    .filter(event => Number.isFinite(event.start) && event.start <= end && (Number.isFinite(event.end) ? event.end : event.start) >= start)
    .sort((a,b) => a.start - b.start || b.importance - a.importance || loc(a.name).localeCompare(loc(b.name), language));
}
function countryArtEventMode(density) {
  if (density >= .72) return 'expanded';
  if (density >= .5) return 'labels';
  if (density >= .34) return 'key';
  return 'dots';
}
function countryArtMeasureTextWidth(text, font='700 14px "Noto Sans KR", sans-serif') {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return String(text || '').length * 14;
  context.font = font;
  return context.measureText(String(text || '')).width;
}
function openCountryArtEventWikipedia(wiki, fallback) {
  const url = String(wiki || '').trim();
  if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
  else openHistoricalEventWikipedia(url || fallback || '');
}
function renderCountryArtEventRail(countryId, start, end, chartWidth, yearScale, density, yearLabel) {
  const events = countryArtEventsFor(countryId, start, end);
  const mode = countryArtEventMode(density);
  const categoryIndex = category => Math.max(0, countryArtEventCategories.indexOf(category));
  const visibleCategories = [...new Set(events.map(event => event.category).filter(Boolean))];
  const legend = visibleCategories.length
    ? `<div class="country-art-event-legend">${visibleCategories.map(category => `<span data-country-event-category="${esc(category)}">${esc(countryArtEventCategoryLabel(category))}</span>`).join('')}</div>`
    : '';
  const eventButtons = events.map(event => {
    const eventEnd = Number.isFinite(event.end) ? event.end : event.start;
    const clippedStart = Math.max(start, event.start);
    const clippedEnd = Math.min(end, eventEnd);
    const left = Math.max(0, (clippedStart - start) * yearScale);
    const width = Math.max(2, (clippedEnd - clippedStart) * yearScale);
    const lane = categoryIndex(event.category) % countryArtEventCategories.length;
    const top = 34 + lane * 28;
    const years = Number.isFinite(event.end) && event.end > event.start ? `${yearLabel(event.start)}–${yearLabel(event.end)}` : yearLabel(event.start);
    const isWarEvent = countryArtEventKind(event) === 'war';
    const warOutcome = countryArtWarOutcome(event);
    const title = `${loc(event.name)} · ${years}${isWarEvent ? ` · ${countryArtWarOutcomeLabel(warOutcome)}` : ''}${loc(event.impact) ? `\n${loc(event.impact)}` : ''}`;
    const duration = Number.isFinite(event.end) && event.end > event.start ? `<span class="country-art-event-duration" style="width:${width}px"></span>` : '';
    const classes = [
      'country-art-event',
      `country-art-event-importance-${Math.min(3, Math.max(1, event.importance))}`,
      isWarEvent ? 'country-art-event-war' : '',
      isWarEvent ? `country-art-war-outcome-${warOutcome}` : ''
    ].filter(Boolean).join(' ');
    const outcomeLine = isWarEvent ? `<small class="country-art-war-outcome-label">${esc(countryArtWarOutcomeLabel(warOutcome))}</small>` : '';
    return `<button class="${classes}" type="button" data-country-event-wiki="${esc(event.wiki || '')}" data-country-event-name="${esc(event.name?.en || event.name?.ko || '')}" data-country-event-category="${esc(event.category || '')}" data-country-event-kind="${esc(countryArtEventKind(event))}" data-country-war-outcome="${esc(isWarEvent ? warOutcome : '')}" style="left:${left}px;top:${top}px" title="${esc(title)}" aria-label="${esc(title)}">${duration}<span class="country-art-event-marker"></span><span class="country-art-event-label"><strong>${esc(loc(event.name))}</strong><small>${esc(years)}</small>${outcomeLine}${mode === 'expanded' && loc(event.impact) ? `<em>${esc(loc(event.impact))}</em>` : ''}</span></button>`;
  }).join('');
  const empty = language === 'ko' ? '등록된 국가별 사건 없음' : 'No country events';
  return `<div class="country-art-event-corner">${language === 'ko' ? '사건' : 'Events'}</div><div class="country-art-event-rail country-art-event-mode-${mode}" style="width:${chartWidth}px;height:${countryArtEventRailHeight}px">${legend}${eventButtons || `<p>${empty}</p>`}</div>`;
}
function countryMovementDataKey(movement) {
  return compactMovementName(movement?.sourceName?.en || movement?.sourceName?.ko || movement?.name?.en || movement?.movement || movement?.name?.ko || '');
}
function countryMovementBackgroundFor(countryId, movement) {
  const keys = new Set([movement?.id, movement?.movement, movement?.sourceName?.en, movement?.sourceName?.ko, movement?.name?.en, movement?.name?.ko, ...(movement?.sourceNames || []).flatMap(name => [name?.en,name?.ko])].filter(Boolean).map(compactMovementName));
  return (countryMovementBackgrounds?.countries?.[countryId] || []).find(entry => {
    const entryKeys = [entry.id, entry.movement, entry.movementEn, entry.movementKo].filter(Boolean).map(compactMovementName);
    return entryKeys.some(key => keys.has(key));
  }) || null;
}
function countryMovementMatchesRelatedLabel(relatedLabel, movement) {
  const relatedKey = compactMovementName(relatedLabel);
  if (!relatedKey) return false;
  const movementKeys = [movement?.name?.en, movement?.name?.ko, movement?.movement, ...(movement?.sourceNames || []).flatMap(name => [name?.en,name?.ko])].filter(Boolean).map(compactMovementName);
  return movementKeys.some(key => key === relatedKey || key.includes(relatedKey) || relatedKey.includes(key));
}
function normalizedCountryArtEvents(countryId) {
  return (countryArtEvents?.countries?.[countryId] || [])
    .map(event => ({...event,start:Number(event.start),end:event.end === undefined || event.end === null ? null : Number(event.end),importance:Number(event.importance) || 1}))
    .filter(event => Number.isFinite(event.start));
}
function countryMovementBackgroundEvents(countryId, movement, background=null) {
  return countryMovementBackgroundEventGroups(countryId, movement, background).all;
}
function countryMovementBackgroundEventGroups(countryId, movement, background=null) {
  const events = normalizedCountryArtEvents(countryId);
  const byId = new Map(events.map(event => [event.id, event]));
  const selected = [];
  [...(background?.preludeEventIds || []), ...(background?.eventIds || [])].forEach(id => {
    const event = byId.get(id);
    if (event && !selected.some(item => item.id === event.id)) selected.push(event);
  });
  events.forEach(event => {
    const related = Array.isArray(event.relatedMovements) ? event.relatedMovements : [];
    if (!related.some(label => countryMovementMatchesRelatedLabel(label, movement))) return;
    if (!selected.some(item => item.id === event.id)) selected.push(event);
  });
  const movementStart = Number(movement?.sourceStart ?? movement?.start);
  const all = selected.sort((a,b) => a.start - b.start || b.importance - a.importance);
  if (!Number.isFinite(movementStart)) return {prelude:all, crystallization:[], all};
  return {
    prelude: all.filter(event => event.start <= movementStart),
    crystallization: all.filter(event => event.start > movementStart),
    all,
  };
}
function countryMovementMechanismLabel(id) {
  return loc(countryMovementBackgrounds?.mechanisms?.[id]) || id;
}
function renderCountryMovementBackgroundButton(countryId, movement) {
  const background = countryMovementBackgroundFor(countryId, movement);
  const events = countryMovementBackgroundEvents(countryId, movement, background);
  if (!background && !events.length) return '';
  const label = language === 'ko' ? '사조 시작 배경 보기' : 'Show movement emergence background';
  return `<button class="country-art-background-button" type="button" data-country="${esc(countryId)}" data-country-movement-key="${esc(countryMovementDataKey(movement))}" title="${esc(label)}" aria-label="${esc(label)}">!</button>`;
}
function closeCountryMovementBackgroundPanel() {
  document.querySelector('.country-art-background-panel')?.remove();
}
function showCountryMovementBackgroundPanel(anchor, country, movement) {
  closeCountryMovementBackgroundPanel();
  const background = countryMovementBackgroundFor(country.id, movement);
  const eventGroups = countryMovementBackgroundEventGroups(country.id, movement, background);
  if (!background && !eventGroups.all.length) return;
  const panel = document.createElement('aside');
  panel.className = 'country-art-background-panel';
  const years = `${movement.sourceStart ?? movement.start}–${movement.sourceEnd ?? movement.end}`;
  const mechanismItems = (background?.mechanisms || []).map(id => `<span>${esc(countryMovementMechanismLabel(id))}</span>`).join('');
  const thesis = loc(background?.thesis);
  const eventButton = event => {
    const eventYears = Number.isFinite(event.end) && event.end > event.start ? `${event.start}–${event.end}` : event.start;
    return `<button type="button" data-country-event-wiki="${esc(event.wiki || '')}" data-country-event-name="${esc(event.name?.en || event.name?.ko || '')}"><strong>${esc(loc(event.name))}</strong><small>${esc(eventYears)} · ${esc(countryArtEventCategoryLabel(event.category))}</small>${loc(event.impact) ? `<em>${esc(loc(event.impact))}</em>` : ''}</button>`;
  };
  const preludeItems = eventGroups.prelude.map(eventButton).join('');
  const crystallizationItems = eventGroups.crystallization.map(eventButton).join('');
  const noThesis = language === 'ko'
    ? '이 사조와 연결된 사건을 시작 이전 조건과 이후의 공식화 과정으로 나누어 읽어 볼 수 있습니다.'
    : 'Read this movement through the events linked to its emergence.';
  const preludeBlock = preludeItems ? `<div class="country-art-background-events"><h3>${language === 'ko' ? '태동 전 조건' : 'Before emergence'}</h3>${preludeItems}</div>` : '';
  const crystallizationBlock = crystallizationItems ? `<div class="country-art-background-events country-art-background-events-later"><h3>${language === 'ko' ? '공식화·확산 사건' : 'Crystallization and spread'}</h3>${crystallizationItems}</div>` : '';
  const emptyPrelude = !preludeItems && crystallizationItems ? `<p class="country-art-background-note">${language === 'ko' ? '현재 연결된 사건은 사조가 이미 태동한 뒤의 공개·제도화 사건입니다. 더 이른 배경 사건은 별도로 보강할 수 있습니다.' : 'The linked events currently mark public or institutional crystallization after emergence. Earlier background events can be added separately.'}</p>` : '';
  panel.innerHTML = `<button class="country-art-background-close" type="button" aria-label="${language === 'ko' ? '닫기' : 'Close'}">×</button><p class="country-art-background-eyebrow">${esc(loc(country.name))}</p><h2>${esc(loc(movement.name))}</h2><small class="country-art-background-years">${esc(years)}</small><p>${esc(thesis || noThesis)}</p>${mechanismItems ? `<div class="country-art-background-mechanisms">${mechanismItems}</div>` : ''}${emptyPrelude}${preludeBlock}${crystallizationBlock}`;
  const rect = anchor.getBoundingClientRect();
  document.body.append(panel);
  const width = Math.min(420, window.innerWidth - 24);
  panel.style.width = `${width}px`;
  const left = Math.max(12, Math.min(rect.right + 10, window.innerWidth - width - 12));
  const top = Math.max(12, Math.min(rect.top - 10, window.innerHeight - panel.offsetHeight - 12));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.querySelector('.country-art-background-close')?.addEventListener('click', closeCountryMovementBackgroundPanel);
  panel.querySelectorAll('[data-country-event-wiki]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    openCountryArtEventWikipedia(button.dataset.countryEventWiki, button.dataset.countryEventName);
  }));
}
const artistListMovementFamilySpecs = [
  movementFilterSpec({ko:'로마네스크', en:'Romanesque'}, ['Romanesque','Romanesque art','Norman Romanesque','로마네스크','노르만·로마네스크']),
  movementFilterSpec({ko:'고딕', en:'Gothic'}, ['Gothic','Gothic art','Northern Gothic','English Gothic','고딕','고딕 미술','북유럽 고딕','영국 고딕']),
  movementFilterSpec({ko:'비잔틴', en:'Byzantine'}, ['Byzantine','Italo-Byzantine','Icon','Byzantine icon','비잔틴','비잔틴 미술','이탈로-비잔틴 미술','이콘','비잔틴 이콘화','러시아 이콘화']),
  movementFilterSpec({ko:'매너리즘', en:'Mannerism'}, ['Mannerism','매너리즘']),
  movementFilterSpec({ko:'바로크', en:'Baroque'}, ['Baroque','Baroque art','Austrian Baroque','Swiss Baroque','Russian Baroque','Norwegian Baroque','Swedish Baroque','Danish Baroque','Flemish Baroque','바로크','오스트리아 바로크','스위스 바로크','러시아 바로크','노르웨이 바로크','스웨덴 바로크','덴마크 바로크','플랑드르 바로크']),
  movementFilterSpec({ko:'로코코', en:'Rococo'}, ['Rococo','Georgian','로코코','로코코와 조지안 미술','로코코와 신고전주의']),
  movementFilterSpec({ko:'신고전주의', en:'Neoclassicism'}, ['Neoclassicism','신고전주의','미국 신고전주의','로코코와 신고전주의']),
  movementFilterSpec({ko:'낭만주의', en:'Romanticism'}, ['Romanticism','Pre-Raphaelite','Hudson River School','Romanticism pioneer','낭만주의','벨기에 낭만주의','노르웨이 낭만주의','라파엘 전파','허드슨 리버 스쿨']),
  movementFilterSpec({ko:'사실주의', en:'Realism'}, ['Realism','Naturalism','Peredvizhniki','Ashcan School','Regionalism','Socialist Realism','사실주의','자연주의','이동파','애슈캔 스쿨','지역주의','사회주의 사실주의']),
  movementFilterSpec({ko:'인상주의', en:'Impressionism'}, ['Impressionism','Macchiaioli','Skagen Painters','암스테르담 인상주의','미국 인상주의','인상주의','마키아이올리','스카겐 화가들']),
  movementFilterSpec({ko:'후기 인상주의', en:'Post-Impressionism'}, ['Post-Impressionism','Post-impressionism','Divisionism','Neo-Impressionism','후기 인상주의','후기인상주의','분할주의','신인상주의']),
  movementFilterSpec({ko:'상징주의', en:'Symbolism'}, ['Symbolism','Aestheticism','Les XX','National Romanticism','상징주의','유미주의','레 벵','국민낭만주의','러시아 상징주의']),
  movementFilterSpec({ko:'표현주의', en:'Expressionism'}, ['Expressionism','CoBrA','Abstract Expressionism','표현주의','벨기에 표현주의','오스트리아 표현주의','추상표현주의']),
  movementFilterSpec({ko:'입체주의', en:'Cubism'}, ['Cubism','Vorticism','입체주의','보티시즘']),
  movementFilterSpec({ko:'다다', en:'Dada'}, ['Dada','다다']),
  movementFilterSpec({ko:'초현실주의', en:'Surrealism'}, ['Surrealism','Metaphysical painting','초현실주의','형이상학 회화']),
  movementFilterSpec({ko:'모더니즘', en:'Modernism'}, ['Modernism','Bauhaus','De Stijl','Futurism','Russian avant-garde','Suprematism','Constructivism','Precisionism','모더니즘','바우하우스','데 스테일','미래주의','러시아 아방가르드','절대주의','구성주의','정밀주의'])
];
