/* Movement atlas, country art, and artist list views. */
function atlasEventGroups(start, end, category) {
  const groups = new Map();
  [...atlasHistoricalEvents, ...customHistoricalEvents].filter(event => event.start <= end && (event.end || event.start) >= start && historicalEventCategory(event) === category).forEach(event => {
    const key = event.start;
    groups.set(key, [...(groups.get(key) || []), event]);
  });
  return [...groups.entries()].sort(([a],[b]) => a - b);
}
function atlasFitYearScale(start, end) {
  const scrollHeight = window.innerWidth <= 590
    ? window.innerHeight * .72
    : window.innerHeight - 76;
  const availableBarsHeight = Math.max(220, scrollHeight - 92);
  return availableBarsHeight / Math.max(movementMinimumRangeSpan, end - start);
}
function renderAtlasEvents(start, end, height, yearScale, category) {
  const groups = atlasEventGroups(start, end, category);
  const columnWidth = atlasEventColumnWidth(groups);
  const durationColors = ['#111111', '#c62828', '#1565c0', '#2e7d32'];
  let durationIndex = [...atlasHistoricalEvents, ...customHistoricalEvents].filter(event => event.start >= movementAtlasStart && event.start < start && event.end > event.start && historicalEventCategory(event) === category).length;
  return `<aside class="atlas-events" style="height:${height + 40}px;width:${columnWidth}px;--atlas-event-column-width:${columnWidth}px">${groups.map(([year, events]) => { const top = Math.max(0, year - start) * yearScale; return `<div class="atlas-event-group ${events.length > 1 ? 'same-year' : ''}" style="top:${top}px"><div class="atlas-event-labels">${events.map(event => { const endYear = Math.min(end, event.end || event.start), hasDuration = event.end && event.end > event.start, duration = hasDuration ? `<span class="atlas-event-duration" style="height:${Math.max(6, (endYear - event.start) * yearScale)}px;--atlas-event-duration-color:${durationColors[durationIndex++ % durationColors.length]}"></span>` : ''; const years = hasDuration ? `${event.start}–${event.end}` : event.start; const impact = loc(event.impact) || ''; return `<button class="atlas-event-label" type="button" data-event-wiki="${esc(event.wiki || event.name?.en || event.name?.ko || '')}" title="${esc(impact)}">${esc(loc(event.name))} (${years})${duration}</button>`; }).join('')}</div>${events.length > 1 ? '<span class="atlas-event-bracket"></span>' : ''}<span class="atlas-event-link"></span></div>`; }).join('')}</aside>`;
}
function atlasEventColumnWidth(groups) {
  const measure = document.createElement('canvas').getContext('2d');
  if (measure) measure.font = '10px "Noto Sans KR", sans-serif';
  const longestLabel = groups.flatMap(([, events]) => events).reduce((width, event) => {
    const years = event.end && event.end > event.start ? `${event.start}–${event.end}` : event.start;
    const label = `${loc(event.name)} (${years})`;
    return Math.max(width, measure ? measure.measureText(label).width : label.length * 9);
  }, 0);
  // Leave only a small left inset after reserving the label padding and the century-side link gap.
  return Math.max(48, Math.ceil(longestLabel + 24));
}
function clippedMovement(item, start, end) {
  const clippedStart = Math.max(start, item.start);
  const clippedEnd = Math.min(end, item.end);
  if (clippedEnd < clippedStart) return null;
  const parentId=item?.canonical?.parentId;
  const parent=(artMovementCanonical?.parents || []).find(candidate => candidate.id === parentId);
  // Country names describe the comparison column, not a second movement.
  // The canonical parent keeps shared visual principles together in all three views.
  return {...item,name:parent?.name || item.name,sourceName:item.sourceName || item.name,start:clippedStart,end:clippedEnd,sourceStart:item.start,sourceEnd:item.end};
}
function countryCanonicalMovements(country) {
  const merged = new Map();
  (country?.movements || []).forEach((movement, sourceOrder) => {
    const parentId=movement?.canonical?.parentId || '';
    const key=parentId ? `parent:${parentId}` : `movement:${compactMovementName(movement?.name?.en || movement?.name?.ko || '')}:${movement.start}:${movement.end}`;
    const parent=(artMovementCanonical?.parents || []).find(candidate => candidate.id === parentId);
    const previous=merged.get(key);
    const artistIds=[...new Set([...(previous?.artistIds || []), ...(movement.artistIds || [])])];
    const primaryArtistIds=[...new Set([...(previous?.primaryArtistIds || []), ...(movement.primaryArtistIds || [])])];
    const furtherArtistIds=[...new Set([...(previous?.furtherArtistIds || []), ...(movement.furtherArtistIds || [])])];
    const childrenById=new Map([...(previous?.atlasChildren || []), ...(movement.atlasChildren || [])].map(child => [child.id || `${loc(child.name)}:${child.start}:${child.end}`,child]));
    merged.set(key,{
      ...(previous || movement),
      name:parent?.name || movement.name,
      start:Math.min(previous?.start ?? movement.start,movement.start),
      end:Math.max(previous?.end ?? movement.end,movement.end),
      sourceName:previous?.sourceName || movement.name,
      sourceNames:[...(previous?.sourceNames || []),movement.name],
      canonical:parentId ? {...(previous?.canonical || movement.canonical || {}),parentId,documentOwnerId:parent?.id || movement.canonical?.documentOwnerId,categoryIds:[...new Set([...(previous?.canonical?.categoryIds || []),...(movement.canonical?.categoryIds || [])])],developmentIds:[...new Set([...(previous?.canonical?.developmentIds || []),...(movement.canonical?.developmentIds || [])])]} : movement.canonical,
      artistIds,
      primaryArtistIds,
      furtherArtistIds,
      atlasChildren:[...childrenById.values()],
      sourceOrder:previous?.sourceOrder ?? sourceOrder
    });
  });
  return [...merged.values()].sort((a,b) => a.start-b.start || a.end-b.end || a.sourceOrder-b.sourceOrder);
}
function atlasTickStep(start, end) {
  const span = end - start;
  if (span <= 60) return 5;
  if (span <= 150) return 10;
  if (span <= 420) return 20;
  if (span <= 760) return 50;
  return 100;
}
function openHistoricalEventEditor() {
  if (!currentUserIsAdmin) {
    alert(language === 'ko' ? '역사 사건 편집은 관리자만 사용할 수 있습니다.' : 'Only the administrator can edit historical events.');
    return;
  }
  const addLabel = language === 'ko' ? '중요 사건 추가' : 'Add important event', nameLabel = language === 'ko' ? '사건 이름' : 'Event name', startLabel = language === 'ko' ? '시작 연도' : 'Start year', endLabel = language === 'ko' ? '종료 연도 (선택)' : 'End year (optional)', categoryLabel = language === 'ko' ? '사건 분류' : 'Event category', saveLabel = language === 'ko' ? '추가하고 저장' : 'Add and save';
  historicalEventDialog.innerHTML = `<form method="dialog" class="event-editor-form"><button class="close" type="button">×</button><p class="eyebrow">HISTORICAL EVENTS</p><h2>${addLabel}</h2><label><span>${nameLabel}</span><input name="name" required></label><label><span>${categoryLabel}</span><select name="category">${historicalEventCategories.map(category => `<option value="${category}">${historicalEventCategoryLabel(category)}</option>`).join('')}</select></label><label><span>${startLabel}</span><input name="start" type="number" min="-500" max="2026" required></label><label><span>${endLabel}</span><input name="end" type="number" min="-500" max="2026"></label><button class="save" type="submit">${saveLabel}</button><div class="custom-event-list">${customHistoricalEvents.map(event => `<div><span>${esc(loc(event.name))} · ${historicalEventCategoryLabel(historicalEventCategory(event))} (${event.start}${event.end ? `–${event.end}` : ''})</span><button type="button" data-delete-event="${esc(event.id)}">×</button></div>`).join('') || `<p>${language === 'ko' ? '추가한 사건이 없습니다.' : 'No custom events yet.'}</p>`}</div></form>`;
  historicalEventDialog.querySelector('.close').onclick = () => historicalEventDialog.close();
  historicalEventDialog.querySelectorAll('[data-delete-event]').forEach(button => button.onclick = async () => { customHistoricalEvents = customHistoricalEvents.filter(event => event.id !== button.dataset.deleteEvent); await saveArtistsNow(); openHistoricalEventEditor(); });
  historicalEventDialog.querySelector('form').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.currentTarget), name = String(form.get('name') || '').trim(), category = String(form.get('category') || 'history'), start = Number(form.get('start')), end = Number(form.get('end')) || null; if (!name || !historicalEventCategories.includes(category) || !start || (end && end < start)) return; customHistoricalEvents.push({id:`custom-event-${Date.now()}`,name:{ko:name,en:name},category,start,end}); await saveArtistsNow(); historicalEventDialog.close(); renderMovementAtlas(); };
  historicalEventDialog.showModal();
}
const renaissanceAtlasParentColor = '#c8974f';
const renaissanceAtlasChildDefinitions = {
  italy: [
    {id:'renaissance--early', name:{ko:'초기 르네상스',en:'Early Renaissance'}, start:1400, end:1490, color:'#e2bd78', type:'phase', documentAnchor:'phase-early-renaissance'},
    {id:'renaissance--high', name:{ko:'전성기 르네상스',en:'High Renaissance'}, start:1490, end:1530, color:'#ce9256', type:'phase', documentAnchor:'phase-high-renaissance'},
    {id:'renaissance--venetian', name:{ko:'베네치아 화파',en:'Venetian School'}, start:1450, end:1600, color:'#a96f62', type:'school', documentAnchor:'school-venetian'}
  ]
};
function movementAtlasRenaissanceDisplay(country) {
  const movements = country?.movements || [];
  const compactName = movement => compactMovementName(movement?.name?.en || movement?.name?.ko || '');
  const isDanubeSchool = movement => ['danubeschool','도나우파'].includes(compactName(movement));
  const isHarlemRenaissance = movement => ['harlemrenaissance','할렘르네상스'].includes(compactName(movement));
  const isRenaissanceParent = movement => {
    const parentId = movement?.canonical?.parentId;
    return !isDanubeSchool(movement) && !isHarlemRenaissance(movement) && ['renaissance','northern-renaissance'].includes(parentId);
  };
  const parentSources = movements.filter(isRenaissanceParent);
  const sourceParent = parentSources.sort((a,b) => (b.end - b.start) - (a.end - a.start))[0];
  if (!sourceParent) return movements;
  const sourceChildren = movements.filter(isDanubeSchool).map(movement => ({
    ...movement,
    id:'renaissance--danube-school',
    name:{ko:'도나우파',en:'Danube School'},
    type:'school',
    documentAnchor:'school-danube'
  }));
  const configuredChildren = renaissanceAtlasChildDefinitions[country.id] || [];
  const categoryIds = [...new Set(parentSources.flatMap(movement => movement.canonical?.categoryIds || []))];
  const developmentIds = [...new Set(parentSources.flatMap(movement => movement.canonical?.developmentIds || []))];
  const parent = {
    ...sourceParent,
    name:{ko:'르네상스',en:'Renaissance'},
    start:Math.min(...parentSources.map(movement => movement.start)),
    end:Math.max(...parentSources.map(movement => movement.end)),
    color:renaissanceAtlasParentColor,
    kind:null,
    canonical:{
      ...(sourceParent.canonical || {}),
      parentId:'renaissance',
      documentOwnerId:'renaissance',
      categoryIds,
      developmentIds
    },
    atlasChildren:[...configuredChildren, ...sourceChildren]
  };
  return [...movements.filter(movement => !isRenaissanceParent(movement) && !isDanubeSchool(movement)), parent];
}
function renderMovementAtlas() {
  timeline.classList.remove('artist-timeline-panel');
  movementView = normalizeMovementView({...movementView, start: movementAtlasStart, end: movementAtlasEnd});
  const start = movementView.start;
  const end = movementView.end;
  const countryEnd = Math.min(movementCountryEnd,end);
  const countryOptions = movementCountries
    .filter(country => country.id !== sharedMovementId)
    .sort((a, b) => loc(a.name).localeCompare(loc(b.name), language));
  const countryById = new Map(countryOptions.map(country => [country.id, country]));
  const shared = movementCountries.find(country => country.id === sharedMovementId);
  const showHistoricalEvents = movementView.showHistoricalEvents !== false;
  const eventCategory = movementView.eventCategory;
  const density = movementView.density || 1;
  const yearScale = atlasFitYearScale(start,end) * density;
  const height = Math.max(1,(countryEnd - start) * yearScale);
  const pack = movements => {
    const ends = [];
    return [...movements].sort((a,b) => a.start - b.start).map(movement => { let lane = ends.findIndex(laneEnd => laneEnd < movement.start); if (lane < 0) lane = ends.length; ends[lane] = movement.end; return {...movement,lane}; });
  };
  const barWidth = () => 90;
  const layout = movements => {
    const packed = pack(movements);
    const laneCount = Math.max(1, ...packed.map(item => item.lane + 1));
    const laneWidths = Array.from({length:laneCount}, (_, lane) => Math.max(90, ...packed.filter(item => item.lane === lane).map(barWidth)));
    const laneOffsets = laneWidths.map((_, lane) => laneWidths.slice(0, lane).reduce((sum, width) => sum + width + 6, 0));
    return {
      entries:packed.map(item => ({...item, atlasLeft:8 + laneOffsets[item.lane], atlasWidth:barWidth(item)})),
      width:laneWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, laneCount - 1) * 6 + 16
    };
  };
  const yearLabel = year => Number(year) < 0 ? `${Math.abs(year)} BCE` : (year === movementAtlasEnd ? (language === 'ko' ? '현대' : 'Today') : String(year));
  const axis = (axisStart, axisEnd, axisHeight) => `<aside class="atlas-axis atlas-century-axis" style="height:${axisHeight}px">${timelineVerticalCenturyBands(axisStart, axisEnd, yearScale, 'atlas-century-band')}</aside>`;
  const atlasCenturyGrid = (axisStart, axisEnd, axisHeight) => `<div class="atlas-century-grid" aria-hidden="true" style="height:${axisHeight}px">${timelineVerticalCenturyBands(axisStart, axisEnd, yearScale, 'atlas-century-grid-band')}</div>`;
  const bar = (item, axisStart, axisEnd) => {
    const top = Math.max(0,item.start-axisStart) * yearScale;
    const barHeight = Math.max(18,(Math.min(axisEnd,item.end)-Math.max(axisStart,item.start)) * yearScale);
    const left = item.atlasLeft ?? (8 + item.lane * 96);
    const width = item.atlasWidth || 90;
    const years = `${yearLabel(item.sourceStart ?? item.start)}–${yearLabel(item.sourceEnd ?? item.end)}`;
    const rawMovementName = item.name.en || item.name.ko || '';
    const movementName = movementDocumentKey(rawMovementName) || rawMovementName;
    const hasOwnDocument = [item.name?.en, item.name?.ko].some(name => {
      const compact = compactMovementName(name);
      return compact && Object.keys(movementDocuments || {}).some(documentName => compactMovementName(documentName) === compact && movementDocuments?.[documentName]?.['1']);
    });
    const contextOnly = movementIsContextOnly(item);
    const kind = contextOnly ? (language === 'ko' ? '이전 미술 참고' : 'Earlier-art context') : loc(item.kind);
    const detail = kind ? `${years} · ${kind}` : years;
    const documentMarker = hasOwnDocument ? '<b class="movement-document-marker" aria-hidden="true">*</b>' : '';
    const childBars = (item.atlasChildren || []).map(child => {
      const childStart = Math.max(item.start, axisStart, child.start);
      const childEnd = Math.min(item.end, axisEnd, child.end);
      if (childEnd <= childStart) return '';
      const childTop = Math.max(0, (childStart - item.start) * yearScale);
      const childHeight = Math.min(barHeight - childTop, Math.max(20, (childEnd - childStart) * yearScale));
      const childType = child.type === 'phase'
        ? (language === 'ko' ? '시대 단계' : 'Period phase')
        : (language === 'ko' ? '화파·계보' : 'School & lineage');
      const childYears = `${yearLabel(child.start)}–${yearLabel(child.end)}`;
      return `<div class="movement-subbar movement-subbar--${esc(child.type)}" title="${esc(`${loc(child.name)} · ${childYears} · ${childType}`)}" data-movement-explanation="${esc(movementName)}" data-movement-label="${esc(loc(child.name))}" data-movement-child-id="${esc(child.id || '')}" data-movement-anchor="${esc(child.documentAnchor || '')}" style="top:${childTop}px;height:${childHeight}px;--movement-child-color:${esc(child.color)}"><span>${esc(loc(child.name))}</span><small>${esc(childYears)}<b>${esc(childType)}</b></small></div>`;
    }).join('');
    const compound = childBars ? ' movement-bar--compound' : '';
    const content = childBars
      ? `<span class="movement-bar-title">${esc(loc(item.name))}</span><small class="movement-bar-years">${esc(years)}</small><div class="movement-subbar-layer">${childBars}</div>`
      : `<span>${esc(loc(item.name))}</span><small>${esc(years)}${kind ? `<b>${esc(kind)}</b>` : ''}</small>`;
    return `<div class="movement-bar${compound}${kind ? ' movement-bar--typed' : ''}${contextOnly ? ' movement-bar--context' : ''}${hasOwnDocument ? ' movement-bar--has-document' : ''}" title="${esc(`${loc(item.name)} · ${detail}`)}" data-movement-explanation="${esc(movementName)}" data-movement-label="${esc(loc(item.name))}" style="top:${top}px;height:${barHeight}px;left:${left}px;width:${width}px;--movement-color:${esc(item.color)}">${documentMarker}${content}</div>`;
  };
  const countryColumns = start < countryEnd ? movementView.countries.map(id => countryById.get(id)).filter(Boolean).map(country => ({
    ...country,
    movements:movementAtlasRenaissanceDisplay({...country,movements:countryCanonicalMovements(country)}).map(item => clippedMovement(item,start,countryEnd)).filter(Boolean)
  })).filter(country => country.movements.length) : [];
  const columns = countryColumns;
  const columnLayouts = new Map(columns.map(column => [column.id, layout(column.movements)]));
  const widthFor = column => columnLayouts.get(column.id)?.width || 106;
  const eventGroups = showHistoricalEvents ? atlasEventGroups(start, countryEnd, eventCategory) : [];
  const eventColumnWidth = showHistoricalEvents ? atlasEventColumnWidth(eventGroups) : 0;
  const eventColumn = showHistoricalEvents ? renderAtlasEvents(start, countryEnd, height, yearScale, eventCategory) : '';
  const centuryStickyLeft = showHistoricalEvents ? eventColumnWidth + movementChartGap : 0;
  const chartColumns = `${showHistoricalEvents ? `${eventColumnWidth}px ` : ''}${movementCenturyAxisWidth}px ${columns.map(column => `${widthFor(column)}px`).join(' ')}`;
  const chartStickyStyle = `--atlas-century-sticky-left:${centuryStickyLeft}px;grid-template-columns:${chartColumns}`;
  const column = country => {
    const countryLayout = columnLayouts.get(country.id) || layout(country.movements);
    const entries = countryLayout.entries;
    const draggable = ` data-country-id="${esc(country.id)}"`;
    return `<section class="atlas-country"${draggable} style="min-width:${countryLayout.width}px"><h2 class="atlas-country-heading"${draggable}>${esc(loc(country.name))}</h2><div class="atlas-bars" style="height:${height}px">${atlasCenturyGrid(start, countryEnd, height)}${entries.map(item => bar(item, start, countryEnd)).join('')}</div></section>`;
  };
  const sharedStart = Math.max(start,movementCountryEnd);
  const sharedEnd = end;
  const sharedHeight = Math.max(1,(sharedEnd - sharedStart) * yearScale);
  const sharedItems = shared?.movements?.length && sharedEnd > sharedStart ? shared.movements.map(item => clippedMovement(item,sharedStart,sharedEnd)).filter(Boolean) : [];
  const sharedLayout = layout(sharedItems);
  const sharedEntries = sharedLayout.entries;
  const sharedEventGroups = showHistoricalEvents ? atlasEventGroups(sharedStart, sharedEnd, eventCategory) : [];
  const sharedEventColumnWidth = showHistoricalEvents ? atlasEventColumnWidth(sharedEventGroups) : 0;
  const sharedEvents = showHistoricalEvents ? renderAtlasEvents(sharedStart, sharedEnd, sharedHeight, yearScale, eventCategory) : '';
  const sharedCenturyStickyLeft = showHistoricalEvents ? sharedEventColumnWidth + movementChartGap : 0;
  const sharedBox = sharedEntries.length ? `<div class="atlas-shared-chart" style="--atlas-century-sticky-left:${sharedCenturyStickyLeft}px;grid-template-columns:${showHistoricalEvents ? `${sharedEventColumnWidth}px ` : ''}${movementCenturyAxisWidth}px ${sharedLayout.width}px">${sharedEvents}${axis(sharedStart, sharedEnd, sharedHeight)}<section class="atlas-country atlas-shared-country" style="min-width:${sharedLayout.width}px"><div class="atlas-bars" style="height:${sharedHeight}px">${atlasCenturyGrid(sharedStart, sharedEnd, sharedHeight)}${sharedEntries.map(item => bar(item, sharedStart, sharedEnd)).join('')}</div></section></div>` : '';
  const editEventsLabel = language === 'ko' ? '역사 사건 추가' : 'Add historical event';
  const eventEditorButton = `<button class="atlas-event-editor" type="button">${editEventsLabel}</button>`;
  const toggleEventsLabel = showHistoricalEvents ? (language === 'ko' ? '역사 사건 숨기기' : 'Hide historical events') : (language === 'ko' ? '역사 사건 보기' : 'Show historical events');
  const eventCategoryControls = `<section class="movement-event-category-controls" aria-label="${language === 'ko' ? '역사 사건 분류 선택' : 'Historical event category'}"><p>${language === 'ko' ? '표시할 사건 분류' : 'Event category to show'}</p><div>${historicalEventCategories.map(category => `<button type="button" class="movement-event-category${eventCategory === category ? ' active' : ''}" data-event-category="${category}" aria-pressed="${eventCategory === category}">${historicalEventCategoryLabel(category)}</button>`).join('')}</div></section>`;
  const sidebarActions = $('#movement-sidebar-actions');
  const selectedCountryCount = countryOptions.filter(country => movementView.countries.includes(country.id)).length;
  const countryControls = `<section class="movement-country-controls" aria-label="${language === 'ko' ? '국가 선택' : 'Country selection'}"><p>${language === 'ko' ? `국가 선택 ${selectedCountryCount}개` : `Countries ${selectedCountryCount}`}</p><div class="atlas-country-actions"><button type="button" data-country-select-all>${language === 'ko' ? '전체 선택' : 'Select all'}</button><button type="button" data-country-clear-all>${language === 'ko' ? '전체 해제' : 'Clear all'}</button></div><div class="atlas-country-options">${countryOptions.map(country => `<div class="atlas-country-option"><label><input type="checkbox" value="${esc(country.id)}" ${movementView.countries.includes(country.id) ? 'checked' : ''}>${esc(loc(country.name))}</label></div>`).join('')}</div></section>`;
  if (sidebarActions) sidebarActions.innerHTML = `<button class="atlas-event-toggle" type="button">${toggleEventsLabel}</button>${eventCategoryControls}${eventEditorButton}${countryControls}`;
  const artistListLabel = language === 'ko' ? '화가' : 'Artists';
  const techniquesLabel = language === 'ko' ? '기법·용어' : 'Techniques';
  const topicsLabel = language === 'ko' ? '주제-사건' : 'Topics & Events';
  const pageNav = `<nav class="page-nav-actions" aria-label="${language === 'ko' ? '탭 이동' : 'Tab navigation'}"><button class="atlas-nav-button movement-nav-artists" type="button">${artistListLabel}</button><button class="atlas-nav-button movement-nav-artist-list" type="button">${language === 'ko' ? '화가 리스트' : 'Artist List'}</button><button class="atlas-nav-button movement-nav-country-art" type="button">${language === 'ko' ? '국가별 미술' : 'Art by Country'}</button><button class="atlas-nav-button movement-nav-techniques" type="button">${techniquesLabel}</button><button class="atlas-nav-button movement-nav-topics" type="button">${topicsLabel}</button></nav>`;
  timeline.innerHTML = `${pageNav}<div class="atlas-scroll">${columns.length ? `<div class="atlas-chart" style="${chartStickyStyle}">${eventColumn}${axis(start, countryEnd, height)}${columns.map(column).join('')}</div>` : ''}${sharedBox ? `${columns.length ? '<div class="atlas-shared-divider"></div>' : ''}${sharedBox}` : ''}${!columns.length && !sharedBox ? `<p class="empty-timeline">${language === 'ko' ? '비교할 나라를 하나 이상 선택해 주세요.' : 'Select at least one country.'}</p>` : ''}</div>`;
  timeline.querySelector('.movement-nav-artists')?.addEventListener('click', openArtistListPage);
  timeline.querySelector('.movement-nav-artist-list')?.addEventListener('click', openPainterListPage);
  timeline.querySelector('.movement-nav-country-art')?.addEventListener('click', openCountryArtPage);
  timeline.querySelector('.movement-nav-techniques')?.addEventListener('click', openTechniquesPage);
  timeline.querySelector('.movement-nav-topics')?.addEventListener('click', openTopicsPage);
  const sidebarCountryControls = sidebarActions?.querySelector('.movement-country-controls');
  const rerenderCountries = () => { persistMovementView(); renderMovementAtlas(); };
  sidebarCountryControls?.querySelector('[data-country-select-all]')?.addEventListener('click', () => { movementView.countries = countryOptions.map(country => country.id); rerenderCountries(); });
  sidebarCountryControls?.querySelector('[data-country-clear-all]')?.addEventListener('click', () => { movementView.countries = []; rerenderCountries(); });
  sidebarCountryControls?.querySelectorAll('.atlas-country-options input').forEach(input => input.onchange = () => { movementView.countries = input.checked ? [...new Set([...movementView.countries, input.value])] : movementView.countries.filter(id => id !== input.value); rerenderCountries(); });
  sidebarActions?.querySelectorAll('[data-event-category]').forEach(button => button.addEventListener('click', () => { movementView.eventCategory = button.dataset.eventCategory; persistMovementView(); renderMovementAtlas(); }));
  const movementAtlasScroll = timeline.querySelector('.atlas-scroll');
  const setMovementDensity = (nextDensity, anchorClientY) => {
    if (!movementAtlasScroll) return;
    const rect = movementAtlasScroll.getBoundingClientRect();
    const anchorOffsetY = anchorClientY - rect.top;
    const anchorContentY = (movementAtlasScroll.scrollTop + anchorOffsetY) / Math.max(density, .001);
    movementView.density = Math.round(Math.max(movementDensityMinimum, Math.min(movementDensityMaximum, nextDensity)) * 100) / 100;
    persistMovementView();
    renderMovementAtlas();
    requestAnimationFrame(() => {
      const nextScroll = timeline.querySelector('.atlas-scroll');
      if (!nextScroll) return;
      nextScroll.scrollTop = Math.max(0, anchorContentY * movementView.density - anchorOffsetY);
    });
  };
  movementAtlasScroll?.addEventListener('wheel', event => {
    if (!event.deltaY) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    setMovementDensity(movementView.density * factor, event.clientY);
  }, {passive:false});
  timeline.querySelectorAll('.atlas-country-heading[data-country-id]').forEach(heading => {
    let startX = 0;
    const reset = () => { heading.classList.remove('dragging'); heading.style.transform = ''; };
    const insertionIndex = clientX => {
      const otherHeadings = [...timeline.querySelectorAll('.atlas-country-heading')].filter(item => item !== heading);
      const nextIndex = otherHeadings.findIndex(item => clientX < item.getBoundingClientRect().left + item.getBoundingClientRect().width / 2);
      return nextIndex < 0 ? otherHeadings.length : nextIndex;
    };
    heading.onpointerdown = event => {
      if (event.button !== 0) return;
      startX = event.clientX;
      heading.setPointerCapture(event.pointerId);
      heading.classList.add('dragging');
      event.preventDefault();
    };
    heading.onpointermove = event => {
      if (!heading.classList.contains('dragging')) return;
      heading.style.transform = `translateX(${event.clientX - startX}px)`;
    };
    heading.onpointerup = event => {
      if (!heading.classList.contains('dragging')) return;
      const countryId = heading.dataset.countryId;
      const ordered = movementView.countries.filter(id => id !== countryId);
      ordered.splice(insertionIndex(event.clientX), 0, countryId);
      reset();
      if (ordered.join('|') !== movementView.countries.join('|')) { movementView.countries = ordered; persistMovementView(); renderMovementAtlas(); }
    };
    heading.onpointercancel = reset;
  });
  const atlasScroll = timeline.querySelector('.atlas-scroll');
  let atlasPan = null;
  atlasScroll.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.atlas-country-heading, .movement-bar, .atlas-event-label, button, a, input, select, textarea, label')) return;
    atlasPan = {pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, scrollLeft:atlasScroll.scrollLeft, scrollTop:atlasScroll.scrollTop};
    atlasScroll.setPointerCapture(event.pointerId);
    atlasScroll.classList.add('atlas-panning');
    event.preventDefault();
  });
  atlasScroll.addEventListener('pointermove', event => {
    if (!atlasPan || event.pointerId !== atlasPan.pointerId) return;
    atlasScroll.scrollLeft = atlasPan.scrollLeft - (event.clientX - atlasPan.startX);
    atlasScroll.scrollTop = atlasPan.scrollTop - (event.clientY - atlasPan.startY);
  });
  const stopAtlasPan = event => {
    if (!atlasPan || event.pointerId !== atlasPan.pointerId) return;
    atlasPan = null;
    atlasScroll.classList.remove('atlas-panning');
  };
  atlasScroll.addEventListener('pointerup', stopAtlasPan);
  atlasScroll.addEventListener('pointercancel', stopAtlasPan);
  timeline.querySelectorAll('.movement-bar, .movement-subbar').forEach(bar => {
    bar.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      openMovementDocument(bar.dataset.movementExplanation, '1', bar.dataset.movementLabel, bar.dataset.movementAnchor);
    });
    bar.addEventListener('contextmenu', event => {
      if (!currentUserIsAdmin) return;
      showMovementDocumentMenu(event, bar.dataset.movementExplanation, '1', bar.dataset.movementLabel);
    });
  });
  timeline.querySelectorAll('.atlas-event-label').forEach(button => button.onclick = () => openHistoricalEventWikipedia(button.dataset.eventWiki));
  sidebarActions?.querySelector('.atlas-event-editor')?.addEventListener('click', openHistoricalEventEditor);
  sidebarActions?.querySelector('.atlas-event-toggle')?.addEventListener('click', () => { movementView.showHistoricalEvents = !showHistoricalEvents; persistMovementView(); renderMovementAtlas(); });
}
const countryArtAliases = {
  france:['프랑스','france'], germany:['독일','germany'], austria:['오스트리아','austria'], belgium:['벨기에','belgium','플랑드르','flanders'], switzerland:['스위스','switzerland'], netherlands:['네덜란드','netherlands','네덜란드 공화국','dutch'], italy:['이탈리아','italy'], 'united-kingdom':['영국','united kingdom','britain','british','england'], spain:['스페인','spain','spanish'], russia:['러시아','russia','russian','소련'], norway:['노르웨이','norway','norwegian'], sweden:['스웨덴','sweden','swedish'], denmark:['덴마크','denmark','danish'], greece:['그리스','greece','greek'], mexico:['멕시코','mexico','mexican'], 'united-states':['미국','united states','american']
};
