/* Movement atlas, country art, artist list, and relations views. */
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
  return {...item,start:clippedStart,end:clippedEnd,sourceStart:item.start,sourceEnd:item.end};
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
  const yearLabel = year => Number(year) < 0 ? `${Math.abs(year)} BCE` : (year === movementAtlasEnd ? (language === 'ko' ? '현대' : 'Today') : String(year));
  const axis = (axisStart, axisEnd, axisHeight) => `<aside class="atlas-axis atlas-century-axis" style="height:${axisHeight}px">${timelineVerticalCenturyBands(axisStart, axisEnd, yearScale, 'atlas-century-band')}</aside>`;
  const atlasCenturyGrid = (axisStart, axisEnd, axisHeight) => `<div class="atlas-century-grid" aria-hidden="true" style="height:${axisHeight}px">${timelineVerticalCenturyBands(axisStart, axisEnd, yearScale, 'atlas-century-grid-band')}</div>`;
  const bar = (item, axisStart, axisEnd) => { const top=Math.max(0,item.start-axisStart)*yearScale, barHeight=Math.max(18,(Math.min(axisEnd,item.end)-Math.max(axisStart,item.start))*yearScale), left=8 + item.lane * 96, years=`${yearLabel(item.sourceStart ?? item.start)}–${yearLabel(item.sourceEnd ?? item.end)}`, movementName=item.name.en || item.name.ko || ''; return `<div class="movement-bar" title="${esc(loc(item.name))} · ${years}" data-movement-explanation="${esc(movementName)}" data-movement-label="${esc(loc(item.name))}" style="top:${top}px;height:${barHeight}px;left:${left}px;width:90px;--movement-color:${esc(item.color)}"><span>${esc(loc(item.name))}</span><small>${years}</small></div>`; };
  const countryColumns = start < countryEnd ? movementView.countries.map(id => countryById.get(id)).filter(Boolean).map(country => ({
    ...country,
    movements:(country.movements || []).map(item => clippedMovement(item,start,countryEnd)).filter(Boolean)
  })).filter(country => country.movements.length) : [];
  const columns = countryColumns;
  const widthFor = column => { const lanes = Math.max(1, ...pack(column.movements).map(item => item.lane + 1)); return lanes * 96 + 16; };
  const eventGroups = showHistoricalEvents ? atlasEventGroups(start, countryEnd, eventCategory) : [];
  const eventColumnWidth = showHistoricalEvents ? atlasEventColumnWidth(eventGroups) : 0;
  const eventColumn = showHistoricalEvents ? renderAtlasEvents(start, countryEnd, height, yearScale, eventCategory) : '';
  const centuryStickyLeft = showHistoricalEvents ? eventColumnWidth + movementChartGap : 0;
  const chartColumns = `${showHistoricalEvents ? `${eventColumnWidth}px ` : ''}${movementCenturyAxisWidth}px ${columns.map(column => `${widthFor(column)}px`).join(' ')}`;
  const chartStickyStyle = `--atlas-century-sticky-left:${centuryStickyLeft}px;grid-template-columns:${chartColumns}`;
  const column = country => {
    const entries = pack(country.movements);
    const lanes = Math.max(1, ...entries.map(item => item.lane + 1));
    const draggable = ` data-country-id="${esc(country.id)}"`;
    return `<section class="atlas-country"${draggable} style="min-width:${lanes * 96 + 16}px"><h2 class="atlas-country-heading"${draggable}>${esc(loc(country.name))}</h2><div class="atlas-bars" style="height:${height}px">${atlasCenturyGrid(start, countryEnd, height)}${entries.map(item => bar(item, start, countryEnd)).join('')}</div></section>`;
  };
  const sharedStart = Math.max(start,movementCountryEnd);
  const sharedEnd = end;
  const sharedHeight = Math.max(1,(sharedEnd - sharedStart) * yearScale);
  const sharedItems = shared?.movements?.length && sharedEnd > sharedStart ? shared.movements.map(item => clippedMovement(item,sharedStart,sharedEnd)).filter(Boolean) : [];
  const sharedEntries = pack(sharedItems);
  const sharedLanes = Math.max(1, ...sharedEntries.map(item => item.lane + 1));
  const sharedEventGroups = showHistoricalEvents ? atlasEventGroups(sharedStart, sharedEnd, eventCategory) : [];
  const sharedEventColumnWidth = showHistoricalEvents ? atlasEventColumnWidth(sharedEventGroups) : 0;
  const sharedEvents = showHistoricalEvents ? renderAtlasEvents(sharedStart, sharedEnd, sharedHeight, yearScale, eventCategory) : '';
  const sharedCenturyStickyLeft = showHistoricalEvents ? sharedEventColumnWidth + movementChartGap : 0;
  const sharedBox = sharedEntries.length ? `<div class="atlas-shared-chart" style="--atlas-century-sticky-left:${sharedCenturyStickyLeft}px;grid-template-columns:${showHistoricalEvents ? `${sharedEventColumnWidth}px ` : ''}${movementCenturyAxisWidth}px ${sharedLanes * 96 + 16}px">${sharedEvents}${axis(sharedStart, sharedEnd, sharedHeight)}<section class="atlas-country atlas-shared-country" style="min-width:${sharedLanes * 96 + 16}px"><div class="atlas-bars" style="height:${sharedHeight}px">${atlasCenturyGrid(sharedStart, sharedEnd, sharedHeight)}${sharedEntries.map(item => bar(item, sharedStart, sharedEnd)).join('')}</div></section></div>` : '';
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
  const pageNav = `<nav class="page-nav-actions" aria-label="${language === 'ko' ? '탭 이동' : 'Tab navigation'}"><button class="atlas-nav-button movement-nav-artists" type="button">${artistListLabel}</button><button class="atlas-nav-button movement-nav-artist-list" type="button">${language === 'ko' ? '화가 리스트' : 'Artist List'}</button><button class="atlas-nav-button movement-nav-country-art" type="button">${language === 'ko' ? '국가별 미술' : 'Art by Country'}</button><button class="atlas-nav-button movement-nav-techniques" type="button">${techniquesLabel}</button><button class="atlas-nav-button movement-nav-topics" type="button">${topicsLabel}</button><button class="rules-check-button" type="button" data-rules-check hidden></button></nav>`;
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
  timeline.querySelectorAll('.movement-bar').forEach(bar => {
    bar.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      openMovementDocument(bar.dataset.movementExplanation, '1', bar.dataset.movementLabel);
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
  france:['프랑스','france'], germany:['독일','germany'], austria:['오스트리아','austria'], belgium:['벨기에','belgium','플랑드르','flanders'], switzerland:['스위스','switzerland'], netherlands:['네덜란드','netherlands','네덜란드 공화국','dutch'], italy:['이탈리아','italy'], 'united-kingdom':['영국','united kingdom','britain','british','england'], spain:['스페인','spain','spanish'], russia:['러시아','russia','russian','소련'], norway:['노르웨이','norway','norwegian'], sweden:['스웨덴','sweden','swedish'], denmark:['덴마크','denmark','danish'], greece:['그리스','greece','greek'], 'united-states':['미국','united states','american']
};
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
  const region = card.querySelector('.movement-card-activity-region')?.textContent || '';
  if (countryArtTextMatches(region, countryId)) return true;
  const artistId = new URL(card.querySelector('.art-atlas-artist-link')?.href || '', location.href).searchParams.get('artist');
  const artist = artists.find(item => item.id === artistId);
  return countryArtTextMatches(`${artist?.nationality?.ko || ''} ${artist?.nationality?.en || ''}`, countryId);
}
function countryArtWorksFor(country, movement) {
  const documentName = movementDocumentKey(movement.name?.en || movement.name?.ko || '');
  const documentUrl = documentName && movementDocuments?.[documentName]?.['1'];
  if (!documentUrl) return {state:'missing',works:[]};
  const cacheKey = `${country.id}::${documentName}`;
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
      const representativeSection = enhancementSections.at(-1);
      const works = [...(representativeSection?.querySelectorAll('article.movement-work-card, article.card') || [])].filter(card => countryArtCardBelongs(card, country.id)).map(card => {
        const image = card.querySelector('img');
        if (!image?.getAttribute('src')) return null;
        const title = card.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim() || image.alt || (language === 'ko' ? '대표작' : 'Representative work');
        const year = card.querySelector('small')?.textContent?.trim() || '';
        const sortYear = Number((year.match(/-?\d{3,4}/) || [])[0]) || 9999;
        const description = card.querySelector('.movement-work-body p, .card-body p, p')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        return {src:new URL(image.getAttribute('src'), new URL(documentUrl, location.href)).href, alt:image.alt || title, title, year, sortYear, descriptionLength:description.length};
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
  return compactMovementName(movement?.name?.en || movement?.movement || movement?.name?.ko || '');
}
function countryMovementBackgroundFor(countryId, movement) {
  const keys = new Set([movement?.id, movement?.movement, movement?.name?.en, movement?.name?.ko].filter(Boolean).map(compactMovementName));
  return (countryMovementBackgrounds?.countries?.[countryId] || []).find(entry => {
    const entryKeys = [entry.id, entry.movement, entry.movementEn, entry.movementKo].filter(Boolean).map(compactMovementName);
    return entryKeys.some(key => keys.has(key));
  }) || null;
}
function countryMovementMatchesRelatedLabel(relatedLabel, movement) {
  const relatedKey = compactMovementName(relatedLabel);
  if (!relatedKey) return false;
  const movementKeys = [movement?.name?.en, movement?.name?.ko, movement?.movement].filter(Boolean).map(compactMovementName);
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
function artistListMovementLabelKey(movement) {
  return compactMovementName(movement?.name?.en || movement?.name?.ko || loc(movement?.name));
}
function artistListMovementDisplayRule(movement) {
  const key = artistListMovementLabelKey(movement);
  return artistMovementDisplayRules.find(rule => rule.keys.has(key)) || null;
}
function artistListMovementFamilyKey(label) {
  return compactMovementName(label?.en || label?.ko || loc(label));
}
function artistListMovementGroupKey(movement) {
  const key = artistListMovementLabelKey(movement);
  const rule = artistListMovementDisplayRule(movement);
  if (rule?.parent) return `parent:${artistListMovementFamilyKey(rule.parent)}`;
  const hierarchyGroup = artistMovementFilterHierarchy.find(group => movementFilterTreeKeys(group).has(key));
  if (hierarchyGroup) return `parent:${artistListMovementFamilyKey(hierarchyGroup.label)}`;
  const family = artistListMovementFamilySpecs.find(spec => spec.keys.has(key));
  return family ? `parent:${artistListMovementFamilyKey(family.label)}` : `movement:${key}`;
}
function artistListMovementCountryLabel(entry, compact=false) {
  const names = (entry.countryNames || [entry.countryName]).map(name => loc(name)).filter(Boolean);
  if (!compact || names.length <= 2) return names.join(', ');
  return language === 'ko' ? `${names[0]} 외 ${names.length - 1}개국` : `${names[0]} + ${names.length - 1}`;
}
function artistListMovementSortStart(entry) {
  const year = Number(entry?.sourceStart ?? entry?.start);
  return Number.isFinite(year) ? year : 0;
}
function artistListMovementSortEnd(entry) {
  const year = Number(entry?.sourceEnd ?? entry?.end);
  return Number.isFinite(year) ? year : artistListMovementSortStart(entry);
}
function artistListMovementKeyMatchesArtistEntry(rowMovementKey, artistEntry) {
  if (!artistEntry?.id) return false;
  if (artistEntry.id === rowMovementKey) return true;
  const rule = artistMovementDisplayRules.find(item => item.keys.has(artistEntry.id));
  const documentKey = compactMovementName(rule?.documentLabel?.en || rule?.documentLabel?.ko || loc(rule?.documentLabel));
  const parentKey = compactMovementName(rule?.parent?.en || rule?.parent?.ko || loc(rule?.parent));
  if (documentKey && documentKey === rowMovementKey) return true;
  if (parentKey && parentKey === rowMovementKey) return true;
  const rowAliases = {
    flemishbaroque: ['flemishbaroquepainting']
  };
  if ((rowAliases[rowMovementKey] || []).includes(artistEntry.id)) return true;
  const hierarchyMatches = node => {
    if (artistListMovementFamilyKey(node.label) === rowMovementKey && movementFilterTreeKeys(node).has(artistEntry.id)) return true;
    return (node.children || []).some(hierarchyMatches);
  };
  return artistMovementFilterHierarchy.some(hierarchyMatches);
}
function artistListPrimaryActivityCountry(artist) {
  if (artist?.movementActivityCountry) return artist.movementActivityCountry;
  const regions = (Array.isArray(artist?.regions) ? artist.regions : []).filter(Boolean);
  // When no movement-specific country is set, use the last recorded activity region.
  return regions.at(-1) || artistCountrySource(artist);
}
function artistListArtistCountryIds(artist) {
  const activityCountry = countryInfo(artistListPrimaryActivityCountry(artist));
  const countryId = allMovementCountryIds.find(id => countryArtTextMatches(activityCountry.name, id));
  return countryId ? [countryId] : [];
}
function artistListArtistLifeSpan(artist) {
  const birth = Number(artist?.birth);
  if (!Number.isFinite(birth)) return null;
  const death = Number(artist?.death);
  const end = Number.isFinite(death) ? death : Math.min(movementAtlasEnd, birth + 80);
  return {start:birth, end:Math.max(birth + 1, end)};
}
function artistListLastRegisteredWorkYear(artist) {
  return Math.max(...(artist?.works || []).map(work => {
    const explicitEnd=Number(work?.yearEnd);
    if (Number.isFinite(explicitEnd)) return explicitEnd;
    const values=String(work?.year ?? '').match(/\d{3,4}/g) || [];
    return Number(values.at(-1));
  }).filter(Number.isFinite), Number.NEGATIVE_INFINITY);
}
function artistListIndependentActivitySpan(artist, boxStart, boxEnd, activityStart=boxStart, activityEnd=boxEnd) {
  const activeFrom=Number(artist?.activeFrom);
  const lastWork=artistListLastRegisteredWorkYear(artist);
  if (!Number.isFinite(activeFrom) || !Number.isFinite(lastWork) || lastWork < activeFrom) return null;
  const start=Math.max(boxStart, activityStart, activeFrom);
  const end=Math.min(boxEnd, activityEnd, lastWork);
  if (end < start) return null;
  const span=Math.max(1, boxEnd-boxStart);
  return {start:((start-boxStart)/span)*100,end:((end-boxStart)/span)*100};
}
function artistListArtistsForMovement(entry) {
  const movementKey = artistListMovementLabelKey(entry);
  const movementStart = Number(entry.sourceStart ?? entry.start);
  const movementEnd = Number(entry.sourceEnd ?? entry.end);
  const countryIds = new Set(entry.countryIds || [entry.countryId].filter(Boolean));
  return (artists || []).map(artist => {
    const life = artistListArtistLifeSpan(artist);
    if (!life || life.start > movementEnd || life.end < movementStart) return null;
    const artistCountryIds = artistListArtistCountryIds(artist);
    if (!artistCountryIds.some(countryId => countryIds.has(countryId))) return null;
    const movementEntries = artistMovementEntries(artist);
    if (!movementEntries.some(artistEntry => artistListMovementKeyMatchesArtistEntry(movementKey, artistEntry))) return null;
    const countryLabel = artistCountryIds.filter(countryId => countryIds.has(countryId)).map(countryId => loc(movementCountries.find(country => country.id === countryId)?.name)).filter(Boolean).join(', ');
    return {artist, life, countryLabel};
  }).filter(Boolean);
}
const artistListPillBaseHeight = 9.6;
const artistListPillGap = 1;
const artistListSubmovementTopPadding = 6;
const artistListSubmovementBottomPadding = 8;
const artistListParentMovementPalette = ['#8cbfd6','#d9ab69','#9cbd91','#bc9ac7','#d48c83','#8dbab2'];
function artistListPackedArtistLayout(entry, chartStart, chartEnd, yearScale) {
  const candidates = artistListArtistsForMovement(entry).map(item => {
    const movementStart = Number(entry.sourceStart ?? entry.start);
    const movementEnd = Number(entry.sourceEnd ?? entry.end);
    const exceedsMovement = item.life.start < movementStart || item.life.end > movementEnd;
    const boxStart = Math.max(chartStart, exceedsMovement ? item.life.start : Math.max(item.life.start, movementStart));
    const boxEnd = Math.min(chartEnd, exceedsMovement ? item.life.end : Math.min(item.life.end, movementEnd));
    if (boxEnd <= boxStart) return null;
    return {...item, boxStart, boxEnd, exceedsMovement};
  }).filter(Boolean).sort((a, b) =>
    a.boxStart - b.boxStart
    || (b.boxEnd - b.boxStart) - (a.boxEnd - a.boxStart)
    || artistListKoreanName(a.artist).localeCompare(artistListKoreanName(b.artist), 'ko')
  );
  const gapYears = Math.max(1, 5 / Math.max(.01, yearScale));
  const lanes = [];
  const packed = candidates.map(item => {
    let lane = lanes.findIndex(end => item.boxStart >= end + gapYears);
    if (lane < 0) { lane = lanes.length; lanes.push(item.boxEnd); }
    else lanes[lane] = item.boxEnd;
    return {...item, lane};
  });
  return {packed, laneCount:Math.max(0,lanes.length)};
}
function artistListPackedArtistMarkup(entry, chartStart, chartEnd, yearScale, topOffset=0, layout=artistListPackedArtistLayout(entry,chartStart,chartEnd,yearScale)) {
  if (!layout.packed.length) return '';
  const movementStart=Number(entry.sourceStart ?? entry.start);
  const movementEnd=Number(entry.sourceEnd ?? entry.end);
  const boxHeight=artistListPillBaseHeight;
  const baseFontSize=Math.max(7,boxHeight*.62);
  const topBase=artistListSubmovementTopPadding;
  return layout.packed.map(item => {
    const left = (item.boxStart - chartStart) * yearScale;
    const width = Math.max(18, (item.boxEnd - item.boxStart) * yearScale);
    const top = topOffset + topBase + item.lane * (boxHeight + artistListPillGap);
    // Match the abbreviated Korean label used in the left artist list.
    const name = artistListKoreanName(item.artist);
    const yearsText = `${item.life.start}–${item.life.end}`;
    const countryText = item.countryLabel ? ` · ${item.countryLabel}` : '';
    const title = `${name}${countryText} · ${yearsText} · ${loc(entry.name)}`;
    const className = item.exceedsMovement ? ' artist-life-pill--extended' : '';
    // A lifetime box may extend outside its country-development box.  The blue
    // activity segment must nevertheless remain inside that box's time span.
    const activity=artistListIndependentActivitySpan(item.artist,item.boxStart,item.boxEnd,movementStart,movementEnd);
    const activityStyle=activity ? `--artist-active-start:${activity.start}%;--artist-active-end:${activity.end}%;` : '';
    return `<button class="artist-life-pill artist-life-pill--source${className}" type="button" tabindex="-1" aria-hidden="true" data-artist-id="${esc(item.artist.id)}" style="left:${left}px;top:${top}px;width:${width}px;height:${boxHeight}px;font-size:${baseFontSize}px;${activityStyle}" title="${esc(title)}"><span>${esc(name)}</span></button>`;
  }).join('');
}
function artistListParentMovementName(groupKey, rows) {
  const anchorKey = groupKey.replace(/^(?:parent|movement):/, '');
  const anchor = rows.find(row => artistListMovementLabelKey(row) === anchorKey);
  if (anchor) return anchor.name;
  const rule = rows.map(artistListMovementDisplayRule).find(item => item?.parent);
  if (rule?.parent) return rule.parent;
  const hierarchy = artistMovementFilterHierarchy.find(group => artistListMovementFamilyKey(group.label) === anchorKey);
  if (hierarchy) return hierarchy.label;
  const family = artistListMovementFamilySpecs.find(spec => artistListMovementFamilyKey(spec.label) === anchorKey);
  return family?.label || rows[0]?.name;
}
function artistListSubmovementLayout(entry, chartStart, chartEnd, yearScale) {
  const children = entry.children || [];
  const lanes = [];
  const laneHeights=[];
  const packed = [...children].sort((a,b) => artistListMovementSortStart(a) - artistListMovementSortStart(b) || artistListMovementSortEnd(a) - artistListMovementSortEnd(b)).map(child => {
    const childStart=artistListMovementSortStart(child);
    const childEnd=artistListMovementSortEnd(child);
    let lane=lanes.findIndex(end => childStart >= end);
    if (lane < 0) { lane=lanes.length; lanes.push(childEnd); laneHeights.push(0); }
    else lanes[lane]=childEnd;
    const artistLayout=artistListPackedArtistLayout(child,chartStart,chartEnd,yearScale);
    const childHeight=artistListSubmovementTopPadding + artistListSubmovementBottomPadding + Math.max(1,artistLayout.laneCount) * artistListPillBaseHeight + Math.max(0,artistLayout.laneCount-1) * artistListPillGap;
    laneHeights[lane]=Math.max(laneHeights[lane],childHeight);
    return {...child, submovementLane:lane, artistLayout, submovementHeight:childHeight};
  });
  const hasArtists=packed.some(child => child.artistLayout.laneCount > 0);
  if (!hasArtists) return {submovements:[], rowHeight:artistListSubmovementTopPadding + artistListSubmovementBottomPadding + 3 * artistListPillBaseHeight + 2 * artistListPillGap};
  const laneGap=8;
  const laneOffsets=[];
  let cursor=artistListSubmovementTopPadding;
  laneHeights.forEach(height => { laneOffsets.push(cursor); cursor += height + laneGap; });
  return {
    submovements:packed.map(child => ({...child, submovementTop:laneOffsets[child.submovementLane], submovementHeight:laneHeights[child.submovementLane]})),
    rowHeight:Math.max(artistListSubmovementTopPadding + artistListSubmovementBottomPadding + 3 * artistListPillBaseHeight + 2 * artistListPillGap, cursor - laneGap + artistListSubmovementBottomPadding)
  };
}
function artistListMovementEntries(countries, selectedCountryIds, start, end) {
  const selected = new Set(selectedCountryIds);
  const rows = [];
  const rowByName = new Map();
  countries.filter(country => selected.has(country.id)).forEach((country, countryOrder) => {
    (country.movements || []).forEach((movement, movementOrder) => {
      const clipped = clippedMovement(movement, start, end);
      if (!clipped) return;
      // Parent groups can combine a shared movement, but country-development
      // boxes must remain distinct even when their displayed movement names
      // are identical (for example, several countries' "Renaissance").
      const rowKey = `${country.id}|${artistListMovementLabelKey(clipped)}`;
      const existing = rowByName.get(rowKey);
      if (existing) {
        existing.start = Math.min(existing.start, clipped.start);
        existing.end = Math.max(existing.end, clipped.end);
        existing.sourceStart = Math.min(existing.sourceStart ?? clipped.sourceStart ?? clipped.start, clipped.sourceStart ?? clipped.start);
        existing.sourceEnd = Math.max(existing.sourceEnd ?? clipped.sourceEnd ?? clipped.end, clipped.sourceEnd ?? clipped.end);
        existing.countryIds.push(country.id);
        existing.countryNames.push(country.name);
        return;
      }
      const row = {
        ...clipped,
        country,
        countryId:country.id,
        countryIds:[country.id],
        countryName:country.name,
        countryNames:[country.name],
        countryOrder,
        movementOrder,
        sourceOrder:rows.length,
        groupKey:artistListMovementGroupKey(clipped)
      };
      rowByName.set(rowKey, row);
      rows.push(row);
    });
  });
  const groups = new Map();
  rows.forEach(row => {
    const rowStart = artistListMovementSortStart(row);
    const rowEnd = artistListMovementSortEnd(row);
    const groupAnchorKey = row.groupKey.replace(/^(?:parent|movement):/, '');
    const rowKey = artistListMovementLabelKey(row);
    const group = groups.get(row.groupKey);
    if (!group) {
      groups.set(row.groupKey, {
        key:row.groupKey,
        start:rowStart,
        end:rowEnd,
        anchorStart:rowKey === groupAnchorKey ? rowStart : Infinity,
        anchorEnd:rowKey === groupAnchorKey ? rowEnd : Infinity,
        sourceOrder:row.sourceOrder
      });
      return;
    }
    group.start = Math.min(group.start, rowStart);
    group.end = Math.min(group.end, rowEnd);
    if (rowKey === groupAnchorKey) {
      group.anchorStart = Math.min(group.anchorStart, rowStart);
      group.anchorEnd = Math.min(group.anchorEnd, rowEnd);
    }
    group.sourceOrder = Math.min(group.sourceOrder, row.sourceOrder);
  });
  const groupOrder = new Map([...groups.values()]
    .sort((a, b) => {
      const startA = Number.isFinite(a.anchorStart) ? a.anchorStart : a.start;
      const startB = Number.isFinite(b.anchorStart) ? b.anchorStart : b.start;
      const endA = Number.isFinite(a.anchorEnd) ? a.anchorEnd : a.end;
      const endB = Number.isFinite(b.anchorEnd) ? b.anchorEnd : b.end;
      return startA - startB || endA - endB || a.sourceOrder - b.sourceOrder;
    })
    .map((group, index) => [group.key, index]));
  return [...groups.values()].sort((a,b) => groupOrder.get(a.key) - groupOrder.get(b.key)).map(group => {
    const children=rows.filter(row => row.groupKey === group.key).sort((a,b) =>
      artistListMovementSortStart(a) - artistListMovementSortStart(b)
      || artistListMovementSortEnd(a) - artistListMovementSortEnd(b)
      || a.sourceOrder - b.sourceOrder
    );
    const countryIds=[...new Set(children.flatMap(child => child.countryIds || [child.countryId]).filter(Boolean))];
    const countryNames=children.flatMap(child => child.countryNames || [child.countryName]).filter(Boolean).filter((name,index,array) => array.findIndex(candidate => loc(candidate) === loc(name)) === index);
    const first=children[0];
    return {
      ...first,
      name:artistListParentMovementName(group.key,children),
      start:group.start,
      end:group.end,
      sourceStart:group.start,
      sourceEnd:group.end,
      countryIds,
      countryNames,
      groupKey:group.key,
      children,
      sourceOrder:group.sourceOrder
    };
  });
}
function artistListMovementRowKey(entry) {
  if (entry.children) return entry.groupKey;
  const countryIds = (entry.countryIds || [entry.countryId]).filter(Boolean).join(',');
  return [
    artistListMovementLabelKey(entry),
    entry.sourceStart ?? entry.start ?? '',
    entry.sourceEnd ?? entry.end ?? '',
    countryIds
  ].join('|');
}
function orderedArtistListMovementEntries(entries) {
  if (!artistListManualMovementOrder.length) return entries;
  const currentKeys = entries.map(artistListMovementRowKey);
  const currentKeySet = new Set(currentKeys);
  artistListManualMovementOrder = artistListManualMovementOrder.filter(key => currentKeySet.has(key));
  if (!artistListManualMovementOrder.length) return entries;
  const manualOrder = new Map(artistListManualMovementOrder.map((key, index) => [key, index]));
  const defaultOrder = new Map(currentKeys.map((key, index) => [key, index]));
  return [...entries].sort((a, b) => {
    const keyA = artistListMovementRowKey(a);
    const keyB = artistListMovementRowKey(b);
    const rankA = manualOrder.has(keyA) ? manualOrder.get(keyA) : artistListManualMovementOrder.length + defaultOrder.get(keyA);
    const rankB = manualOrder.has(keyB) ? manualOrder.get(keyB) : artistListManualMovementOrder.length + defaultOrder.get(keyB);
    return rankA - rankB;
  });
}
function renderCountryArt(options = {}) {
  const artistListMode = Boolean(options.artistListMode);
  closeCountryMovementBackgroundPanel();
  timeline.classList.remove('artist-timeline-panel');
  if (artistListMode) artistListView = normalizeArtistListView(artistListView);
  else countryArtView = normalizeCountryArtView(countryArtView);
  const activeView = artistListMode ? artistListView : countryArtView;
  const persistActiveView = artistListMode ? persistArtistListView : persistCountryArtView;
  const start = activeView.start, end = activeView.end;
  let density = activeView.density;
  const densityMinimum = artistListMode ? artistListDensityMinimum : countryArtDensityMinimum;
  const densityMaximum = artistListMode ? artistListDensityMaximum : countryArtDensityMaximum;
  const countriesByDataOrder = movementCountries.filter(country => country.id !== sharedMovementId);
  const countryOptions = [...countriesByDataOrder].sort((a,b) => loc(a.name).localeCompare(loc(b.name), language));
  const country = artistListMode ? null : (countryOptions.find(item => item.id === countryArtView.country) || countryOptions[0]);
  if (!countryOptions.length) { timeline.innerHTML = `<p class="empty-timeline">${language === 'ko' ? '국가별 사조 데이터가 없습니다.' : 'No country movement data is available.'}</p>`; return; }
  if (!artistListMode && country.id !== countryArtView.country) { countryArtView.country = country.id; persistCountryArtView(); }
  const selectedArtistListCountries = artistListMode ? activeView.countries.filter(id => countriesByDataOrder.some(country => country.id === id)) : [];
  if (artistListMode && selectedArtistListCountries.length !== activeView.countries.length) {
    artistListView.countries = selectedArtistListCountries;
    persistArtistListView();
  }
  let entries = artistListMode
    ? artistListMovementEntries(countriesByDataOrder, artistListView.countries, start, end)
    : (country.movements || []).map(item => clippedMovement(item,start,end)).filter(Boolean).sort((a,b) => a.start-b.start || a.end-b.end).map((item, column) => ({...item, column}));
  if (artistListMode) {
    entries=orderedArtistListMovementEntries(entries).map((entry,index) => ({
      ...entry,
      artistListParentColor:artistListParentMovementPalette[index % artistListParentMovementPalette.length]
    }));
  }
  const yearLabel = year => Number(year) < 0 ? `${Math.abs(year)} BCE` : String(year);
  // The row and bar match the standardized card's maximum height, including list padding and bar borders.
  const movementRowHeight = artistListMode ? 58 : Math.ceil((window.innerWidth / 14) * .8) + 54;
  const axisHeight = artistListMode ? 38 : 76;
  // Country heading (about 37px) plus the time axis and all movement rows.
  const eventRailHeight = artistListMode ? 0 : countryArtEventRailHeight;
  let chartContentHeight = axisHeight + eventRailHeight + entries.length * movementRowHeight;
  const timelineRect = timeline.getBoundingClientRect();
  const timelineStyle = getComputedStyle(timeline);
  const timelineHorizontalPadding = parseFloat(timelineStyle.paddingLeft || 0) + parseFloat(timelineStyle.paddingRight || 0);
  const timelineVerticalPadding = parseFloat(timelineStyle.paddingTop || 0) + parseFloat(timelineStyle.paddingBottom || 0);
  const visibleChartWidth = Math.max(360, Math.floor((timelineRect.width || window.innerWidth) - timelineHorizontalPadding - 4));
  const visibleChartHeight = Math.max(220, Math.floor((timelineRect.height || window.innerHeight) - timelineVerticalPadding - 4));
  // Fit the vertical set of rows first. The artist-list default then applies
  // its deliberate overview enlargement while preserving this base geometry.
  const defaultCountryArtDensity = Math.max(densityMinimum, Math.min(
    densityMaximum,
    (visibleChartHeight / chartContentHeight),
  ));
  const defaultViewScale = artistListMode ? artistListDefaultViewScale : 1;
  const defaultFitDensity = Math.max(densityMinimum, Math.min(
    densityMaximum,
    Math.floor(defaultCountryArtDensity * defaultViewScale * 1000) / 1000
  ));
  // Keep the established horizontal fit. In artist-list mode only, set the
  // default vertical scale from a readable fixed count of movement rows.
  let defaultArtistListVerticalDensity = artistListMode ? Math.max(
    densityMinimum,
    Math.min(densityMaximum, visibleChartHeight / (axisHeight + artistListDefaultVisibleMovementRows * movementRowHeight))
  ) : defaultFitDensity;
  if (countryArtResetZoomOnRender) {
    density = defaultFitDensity;
    activeView.density = density;
    persistActiveView();
    countryArtResetZoomOnRender = false;
  }
  const verticalDensityFor = value => {
    if (!artistListMode) return value;
    const ratio = value / Math.max(defaultFitDensity, .001);
    if (ratio <= 1) return defaultArtistListVerticalDensity * ratio;
    return defaultArtistListVerticalDensity * (1 + (ratio * ratio - 1) * artistListVerticalZoomBoost);
  };
  let verticalDensity = verticalDensityFor(density);
  // The artist-list overview intentionally starts taller than the viewport.
  // Keep scrolling available; the fitted base width prevents default x overflow.
  const hideDefaultScrollbars = false;
  // The artist-list defaults to its enlarged vertical view, but its horizontal
  // time range stays fitted. Reserve room for the visible vertical scrollbar.
  const horizontalFitDensity = artistListMode ? defaultFitDensity : defaultCountryArtDensity;
  const horizontalScrollbarReserve = artistListMode ? 20 : 0;
  const baseTimeWidth = artistListMode
    ? Math.max(1, Math.floor((visibleChartWidth - horizontalScrollbarReserve) / horizontalFitDensity - countryArtLabelColumnWidth))
    : Math.max(1, Math.ceil(visibleChartWidth / horizontalFitDensity - countryArtLabelColumnWidth));
  // Artist-list centuries deliberately use more horizontal room. Any area
  // beyond the viewport remains available through the existing scroll/pan.
  const chartWidth = artistListMode ? Math.ceil(baseTimeWidth * 1.3) : baseTimeWidth;
  const yearScale = chartWidth / (end - start);
  if (artistListMode) {
    entries=entries.map(entry => {
      const artistListLayout=artistListSubmovementLayout(entry,start,end,yearScale);
      return {...entry,artistListLayout,artistListRowHeight:artistListLayout.rowHeight};
    });
    chartContentHeight=axisHeight + entries.reduce((sum,entry) => sum + entry.artistListRowHeight,0);
    const defaultRowsHeight=entries.slice(0,artistListDefaultVisibleMovementRows).reduce((sum,entry) => sum + entry.artistListRowHeight,0);
    defaultArtistListVerticalDensity=Math.max(
      densityMinimum,
      Math.min(densityMaximum,visibleChartHeight / (axisHeight + defaultRowsHeight))
    );
    verticalDensity=verticalDensityFor(density);
  }
  const chartContentWidth = countryArtLabelColumnWidth + chartWidth;
  const workSources = artistListMode ? new Map() : new Map(entries.map(entry => [entry, countryArtWorksFor(country, entry)]));
  const preferredWorksByImage = new Map();
  if (!artistListMode) entries.forEach(entry => {
    workSources.get(entry).works.forEach(work => {
      const preferred = preferredWorksByImage.get(work.src);
      if (!preferred || work.descriptionLength < preferred.work.descriptionLength) preferredWorksByImage.set(work.src, {entry, work});
    });
  });
  const displayedWorksByEntry = artistListMode ? new Map() : new Map(entries.map(entry => [entry, workSources.get(entry).works.filter(work => preferredWorksByImage.get(work.src)?.entry === entry)]));
  const selectedCountryCount = artistListMode ? artistListView.countries.length : 1;
  const chartHeading = artistListMode
    ? (selectedCountryCount === countryOptions.length ? (language === 'ko' ? '전체 국가' : 'All countries') : (language === 'ko' ? `선택 국가 ${selectedCountryCount}개` : `${selectedCountryCount} countries`))
    : loc(country.name);
  const axisHeading = artistListMode
    ? (language === 'ko' ? `사조(${chartHeading})` : `Movements (${chartHeading})`)
    : (language === 'ko' ? '사조' : 'Movement');
  const axisCornerStyle = artistListMode ? ` style="height:${axisHeight}px;min-height:${axisHeight}px"` : '';
  const axisCorner = `<div class="country-art-axis-corner"${axisCornerStyle}><span>${esc(axisHeading)}</span></div>`;
  const centuryBands = timelineCenturyBands(start, end, yearScale);
  const centuryGrid = `<div class="country-art-century-grid" aria-hidden="true" style="left:${countryArtLabelColumnWidth}px;width:${chartWidth}px;height:${chartContentHeight}px">${centuryBands}</div>`;
  const axis = `${axisCorner}<div class="country-art-time-axis" style="width:${chartWidth}px">${centuryBands}</div>`;
  const eventRail = artistListMode ? '' : renderCountryArtEventRail(country.id, start, end, chartWidth, yearScale, density, yearLabel);
  const movementLabelMeta = entry => artistListMode
    ? `${artistListMovementCountryLabel(entry, true)} · ${yearLabel(entry.sourceStart ?? entry.start)}–${yearLabel(entry.sourceEnd ?? entry.end)}`
    : `${yearLabel(entry.sourceStart ?? entry.start)}–${yearLabel(entry.sourceEnd ?? entry.end)}`;
  const movementLabelMarkup = entry => {
    const dragAttributes = artistListMode ? ` draggable="true" data-artist-list-row-key="${esc(artistListMovementRowKey(entry))}"` : '';
    const rowHeight=artistListMode ? entry.artistListRowHeight : movementRowHeight;
    return `<div class="country-art-movement-label" style="height:${rowHeight}px"${dragAttributes}><strong>${esc(loc(entry.name))}</strong><small>${esc(movementLabelMeta(entry))}</small></div>`;
  };
  const frozenMovementLabels = entries.map(movementLabelMarkup).join('');
  const frozenEventCorner = artistListMode ? '' : `<div class="country-art-event-corner">${language === 'ko' ? '사건' : 'Events'}</div>`;
  const frozenCountryHeading = artistListMode ? '' : `<div class="country-art-country-name" style="width:${countryArtLabelColumnWidth}px;min-width:${countryArtLabelColumnWidth}px">${esc(chartHeading)}</div>`;
  // Counter the non-uniform chart transform exactly so the frozen movement
  // labels retain their normal font proportions at the default view and zoom.
  const frozenLabelTextXScale = artistListMode ? 1 / Math.max(density, .001) : 1;
  const frozenLabelTextYScale = artistListMode ? 1 / Math.max(verticalDensity, .001) : 1;
  const frozenLabels = `<div class="country-art-frozen-labels" aria-hidden="true" style="width:${Math.ceil(countryArtLabelColumnWidth * density)}px"><div class="country-art-frozen-labels-layer" style="width:${countryArtLabelColumnWidth}px;transform:scale(${density}, ${verticalDensity});--artist-list-label-text-x-scale:${frozenLabelTextXScale};--artist-list-label-text-y-scale:${frozenLabelTextYScale}">${frozenCountryHeading}<div class="country-art-frozen-chart" style="width:${countryArtLabelColumnWidth}px">${axisCorner}${frozenEventCorner}${frozenMovementLabels}</div></div></div>`;
  const frozenAxisVerticalDensity = artistListMode ? 1 : verticalDensity;
  const centuryLabelXScale = artistListMode ? 1 / Math.max(density, .001) : 1;
  const frozenTimeAxis = `<div class="country-art-frozen-time-axis" aria-hidden="true" style="width:${Math.ceil(chartContentWidth * density)}px"><div class="country-art-frozen-time-axis-layer" style="left:${Math.ceil(countryArtLabelColumnWidth * density)}px;width:${Math.ceil(chartWidth * density)}px;height:${Math.ceil(axisHeight * frozenAxisVerticalDensity)}px"><div style="width:${chartWidth}px;transform:scale(${density}, ${frozenAxisVerticalDensity});--artist-list-century-label-x-scale:${centuryLabelXScale}"><div class="country-art-time-axis" style="width:${chartWidth}px;height:${axisHeight}px">${centuryBands}</div></div></div></div>`;
  const workMarkup = (entry) => {
    const rowHeight=artistListMode ? entry.artistListRowHeight : movementRowHeight;
    const left = Math.max(0,entry.start-start)*yearScale;
    const barWidth = Math.max(92,(Math.min(end,entry.end)-Math.max(start,entry.start))*yearScale);
    if (artistListMode) {
      let artistPills = '';
      let submovementBoxes = '';
      let submovements = [];
      try {
        submovements=entry.artistListLayout.submovements;
        submovementBoxes=submovements.map(child => {
          const childLeft=Math.max(0,child.start-start)*yearScale;
          const childWidth=Math.max(2,(Math.min(end,child.end)-Math.max(start,child.start))*yearScale);
          const countryName=artistListMovementCountryLabel(child);
          const childTitle=`${countryName} · ${loc(child.name)} · ${yearLabel(child.sourceStart ?? child.start)}–${yearLabel(child.sourceEnd ?? child.end)}`;
          return `<div class="artist-list-submovement-box" style="left:${childLeft}px;top:${child.submovementTop}px;width:${childWidth}px;height:${child.submovementHeight}px;--movement-color:${esc(entry.artistListParentColor)}" title="${esc(childTitle)}"><span class="artist-list-submovement-title">${esc(`${countryName} · ${loc(child.name)}`)}</span></div>`;
        }).join('');
        artistPills = submovements.map(child => artistListPackedArtistMarkup(child, start, end, yearScale, child.submovementTop, child.artistLayout)).join('');
      } catch (error) {
        console.error('Artist list packing failed:', error);
      }
      const parentMovementBox = submovements.length ? '' : `<article class="country-art-movement artist-list-empty-movement" aria-hidden="true" style="left:${left}px;width:${barWidth}px;height:${rowHeight}px;--movement-color:${esc(entry.artistListParentColor)}" title="${esc(`${artistListMovementCountryLabel(entry)} · ${loc(entry.name)} · ${movementLabelMeta(entry)}`)}"><div class="country-art-work-list country-art-work-list-empty"></div></article>`;
      return `${movementLabelMarkup(entry)}<div class="country-art-time-row artist-list-time-row" style="width:${chartWidth}px;height:${rowHeight}px">${parentMovementBox}${submovementBoxes}${artistPills}</div>`;
    }
    const source = workSources.get(entry);
    const works = displayedWorksByEntry.get(entry).map(work => `<figure class="country-art-work"><img src="${esc(work.src)}" alt="${esc(work.alt)}" loading="lazy"><figcaption>${esc(work.title)}${work.year ? `<small>${esc(work.year)}</small>` : ''}</figcaption></figure>`).join('');
    const empty = source.state === 'loading' ? (language === 'ko' ? '대표작 자료를 불러오는 중' : 'Loading representative works') : (language === 'ko' ? '대표작 자료 없음' : 'No representative work available');
    const backgroundButton = renderCountryMovementBackgroundButton(country.id, entry);
    return `${movementLabelMarkup(entry)}<div class="country-art-time-row" style="width:${chartWidth}px;height:${rowHeight}px"><article class="country-art-movement" style="left:${left}px;width:${barWidth}px;height:${rowHeight}px;--movement-color:${esc(entry.color)}">${backgroundButton}<div class="country-art-work-list">${works || `<p>${empty}</p>`}</div></article></div>`;
  };
  const countryLabel = language === 'ko' ? '국가 선택' : 'Country selection';
  const sidebarActions = $('#movement-sidebar-actions');
  if (sidebarActions) {
    const countryInputs = artistListMode
      ? `<div class="atlas-country-actions"><button type="button" data-artist-list-country-select-all>${language === 'ko' ? '전체 선택' : 'Select all'}</button><button type="button" data-artist-list-country-clear-all>${language === 'ko' ? '전체 해제' : 'Clear all'}</button></div><div>${countryOptions.map(option => `<label><input type="checkbox" name="artist-list-country" value="${esc(option.id)}" ${artistListView.countries.includes(option.id) ? 'checked' : ''}>${esc(loc(option.name))}</label>`).join('')}</div>`
      : `<div>${countryOptions.map(option => `<label><input type="radio" name="country-art-country" value="${esc(option.id)}" ${option.id === country.id ? 'checked' : ''}>${esc(loc(option.name))}</label>`).join('')}</div>`;
    const countryLabelText = artistListMode ? `${countryLabel} ${selectedCountryCount}` : countryLabel;
    sidebarActions.innerHTML = `<section class="country-art-selector" aria-label="${countryLabel}"><p>${countryLabelText}</p>${countryInputs}</section>`;
  }
  const painterListButton = artistListMode ? '' : `<button class="atlas-nav-button country-art-nav-artist-list" type="button">${language === 'ko' ? '화가 리스트' : 'Artist List'}</button>`;
  const countryArtButton = artistListMode ? `<button class="atlas-nav-button country-art-nav-country-art" type="button">${language === 'ko' ? '국가별 미술' : 'Art by Country'}</button>` : '';
  const pageNav = `<nav class="page-nav-actions" aria-label="${language === 'ko' ? '탭 이동' : 'Tab navigation'}"><button class="atlas-nav-button country-art-nav-artists" type="button">${language === 'ko' ? '화가' : 'Artists'}</button><button class="atlas-nav-button country-art-nav-movements" type="button">${language === 'ko' ? '사조' : 'Movements'}</button>${countryArtButton}${painterListButton}<button class="atlas-nav-button country-art-nav-techniques" type="button">${language === 'ko' ? '기법·용어' : 'Techniques'}</button><button class="atlas-nav-button country-art-nav-topics" type="button">${language === 'ko' ? '주제-사건' : 'Topics & Events'}</button><button class="rules-check-button" type="button" data-rules-check hidden></button></nav>`;
  const defaultFitClass = hideDefaultScrollbars ? ' country-art-scroll-default-fit' : '';
  const chartCountryHeading = artistListMode ? '' : `<div class="country-art-country-name" style="width:${countryArtLabelColumnWidth}px;min-width:${countryArtLabelColumnWidth}px">${esc(chartHeading)}</div>`;
  timeline.innerHTML = `${pageNav}<div class="atlas-scroll country-art-scroll${defaultFitClass}">${frozenLabels}${frozenTimeAxis}<div class="country-art-zoom-viewport" style="width:${Math.ceil(chartContentWidth * density)}px;height:${Math.ceil(chartContentHeight * verticalDensity)}px"><div class="country-art-zoom-layer country-art-event-mode-${countryArtEventMode(density)}" style="width:${chartContentWidth}px;transform:scale(${density}, ${verticalDensity});--artist-list-label-text-x-scale:${frozenLabelTextXScale};--artist-list-label-text-y-scale:${frozenLabelTextYScale}">${chartCountryHeading}<div class="country-art-chart" style="width:${chartContentWidth}px;grid-template-columns:${countryArtLabelColumnWidth}px ${chartWidth}px">${centuryGrid}${axis}${eventRail}${entries.map(workMarkup).join('')}</div></div></div></div>`;
  timeline.querySelector('.country-art-nav-artists')?.addEventListener('click', openArtistListPage);
  timeline.querySelector('.country-art-nav-movements')?.addEventListener('click', openMovementAtlas);
  timeline.querySelector('.country-art-nav-country-art')?.addEventListener('click', openCountryArtPage);
  timeline.querySelector('.country-art-nav-artist-list')?.addEventListener('click', openPainterListPage);
  timeline.querySelector('.country-art-nav-techniques')?.addEventListener('click', openTechniquesPage);
  timeline.querySelector('.country-art-nav-topics')?.addEventListener('click', openTopicsPage);
  const bindArtistLifePill = button => button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openArtistTimelinePage(button.dataset.artistId);
  });
  if (artistListMode) {
    requestAnimationFrame(() => {
      const viewport = timeline.querySelector('.country-art-zoom-viewport');
      if (!viewport) return;
      const viewportRect = viewport.getBoundingClientRect();
      // Match every pill's height to its movement row's vertical expansion.
      // Its lifespan width follows the same horizontal time scale as the chart.
      const pillHeightZoomRatio = verticalDensity / Math.max(defaultFitDensity, .001);
      const overlay = document.createElement('div');
      overlay.className = 'artist-life-overlay';
      const sources = [...viewport.querySelectorAll('.artist-life-pill--source')];
      if (!sources.length) return;
      // One shared height is derived from the shortest packed box in the
      // complete chart. Do not enlarge or locally clamp individual boxes.
      const commonPillHeight = Math.min(...sources.map(source => source.offsetHeight));
      const smallestFontSize = Math.min(...sources.map(source => parseFloat(source.style.fontSize || 0)));
      sources.forEach(source => {
        const sourceRect = source.getBoundingClientRect();
        const sourceRow = source.closest('.artist-list-time-row');
        const sourceRowRect = sourceRow?.getBoundingClientRect();
        const clone = source.cloneNode(true);
        clone.classList.remove('artist-life-pill--source');
        clone.classList.add('artist-life-pill--overlay');
        clone.removeAttribute('tabindex');
        clone.removeAttribute('aria-hidden');
        clone.style.left = `${sourceRect.left - viewportRect.left}px`;
        const sourceTop = sourceRect.top - viewportRect.top;
        const baseOffset = source.offsetTop * defaultFitDensity;
        // The local box offset shares the movement row's vertical scale, so
        // top/bottom gaps and inter-box spacing stay proportional.
        const rowTop = sourceRowRect
          ? sourceRowRect.top - viewportRect.top
            + baseOffset * pillHeightZoomRatio
          : sourceTop;
        const pillHeight = commonPillHeight * pillHeightZoomRatio;
        // Reduce every shared-height pill about its own center. This preserves
        // the lifespan position while restoring a consistent gap between lanes.
        const reducedPillHeight = pillHeight * .78;
        clone.style.top = `${rowTop + (pillHeight - reducedPillHeight) / 2}px`;
        clone.style.width = `${sourceRect.width}px`;
        clone.style.height = `${reducedPillHeight}px`;
        clone.style.fontSize = `${smallestFontSize * pillHeightZoomRatio * .78}px`;
        overlay.append(clone);
        bindArtistLifePill(clone);
      });
      viewport.append(overlay);
    });
  }
  timeline.querySelectorAll('.country-art-event').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    openCountryArtEventWikipedia(button.dataset.countryEventWiki, button.dataset.countryEventName);
  }));
  const countryMovementEntriesByKey = new Map(entries.map(entry => [countryMovementDataKey(entry), entry]));
  timeline.querySelectorAll('.country-art-background-button').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const entry = countryMovementEntriesByKey.get(button.dataset.countryMovementKey);
    if (entry) showCountryMovementBackgroundPanel(button, country, entry);
  }));
  sidebarActions?.querySelectorAll('input[name="country-art-country"]').forEach(input => input.addEventListener('change', () => {
    closeCountryMovementBackgroundPanel();
    document.querySelector('.country-art-movement-preview')?.remove();
    document.querySelector('.country-art-image-magnifier')?.remove();
    countryArtView.country=input.value;
    countryArtResetZoomOnRender=true;
    persistCountryArtView();
    renderCountryArt(options);
  }));
  const renderArtistListCountries = () => {
    closeCountryMovementBackgroundPanel();
    document.querySelector('.country-art-movement-preview')?.remove();
    document.querySelector('.country-art-image-magnifier')?.remove();
    artistListView.countries = [...(sidebarActions?.querySelectorAll('input[name="artist-list-country"]:checked') || [])].map(input => input.value);
    artistListManualMovementOrder = [];
    countryArtResetZoomOnRender = true;
    persistArtistListView();
    renderCountryArt(options);
  };
  sidebarActions?.querySelectorAll('input[name="artist-list-country"]').forEach(input => input.addEventListener('change', renderArtistListCountries));
  sidebarActions?.querySelector('[data-artist-list-country-select-all]')?.addEventListener('click', () => {
    sidebarActions.querySelectorAll('input[name="artist-list-country"]').forEach(input => { input.checked = true; });
    renderArtistListCountries();
  });
  sidebarActions?.querySelector('[data-artist-list-country-clear-all]')?.addEventListener('click', () => {
    sidebarActions.querySelectorAll('input[name="artist-list-country"]').forEach(input => { input.checked = false; });
    renderArtistListCountries();
  });
  if (artistListMode) {
    const currentMovementKeys = entries.map(artistListMovementRowKey);
    const dragLabels = [...timeline.querySelectorAll('[data-artist-list-row-key]')];
    const setDragClass = (key, className, active) => {
      dragLabels.forEach(label => {
        if (label.dataset.artistListRowKey === key) label.classList.toggle(className, active);
      });
    };
    const clearDropMarkers = () => {
      dragLabels.forEach(label => label.classList.remove('artist-list-row-drop-before', 'artist-list-row-drop-after'));
    };
    const normalizedOrder = () => {
      const order = artistListManualMovementOrder.length ? artistListManualMovementOrder.filter(key => currentMovementKeys.includes(key)) : [];
      currentMovementKeys.forEach(key => { if (!order.includes(key)) order.push(key); });
      return order;
    };
    let draggedMovementKey = null;
    dragLabels.forEach(label => {
      label.addEventListener('dragstart', event => {
        draggedMovementKey = label.dataset.artistListRowKey;
        artistListManualMovementOrder = normalizedOrder();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedMovementKey);
        setDragClass(draggedMovementKey, 'artist-list-row-dragging', true);
      });
      label.addEventListener('dragover', event => {
        if (!draggedMovementKey) return;
        const targetKey = label.dataset.artistListRowKey;
        if (!targetKey || targetKey === draggedMovementKey) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        clearDropMarkers();
        const after = event.clientY > label.getBoundingClientRect().top + label.getBoundingClientRect().height / 2;
        setDragClass(targetKey, after ? 'artist-list-row-drop-after' : 'artist-list-row-drop-before', true);
      });
      label.addEventListener('drop', event => {
        if (!draggedMovementKey) return;
        const targetKey = label.dataset.artistListRowKey;
        if (!targetKey || targetKey === draggedMovementKey) return;
        event.preventDefault();
        const after = event.clientY > label.getBoundingClientRect().top + label.getBoundingClientRect().height / 2;
        const order = normalizedOrder().filter(key => key !== draggedMovementKey);
        const targetIndex = order.indexOf(targetKey);
        if (targetIndex < 0) return;
        order.splice(targetIndex + (after ? 1 : 0), 0, draggedMovementKey);
        artistListManualMovementOrder = order;
        draggedMovementKey = null;
        clearDropMarkers();
        renderCountryArt(options);
      });
      label.addEventListener('dragend', () => {
        if (draggedMovementKey) setDragClass(draggedMovementKey, 'artist-list-row-dragging', false);
        draggedMovementKey = null;
        clearDropMarkers();
      });
    });
  }
  const openCountryArtMovementPreview = (source, clientX, clientY) => {
    document.querySelector('.country-art-movement-preview')?.remove();
    document.querySelector('.country-art-image-magnifier')?.remove();
    const sourceRect = source.getBoundingClientRect();
    const sourceScale = source.offsetWidth ? sourceRect.width / source.offsetWidth : 1;
    const workList = source.querySelector('.country-art-work-list');
    // Use the unscaled width of every original card, not just the currently
    // visible part of its scroll area. This keeps image, caption and header
    // proportions identical while making the complete strip twice as large.
    const fullStripWidth = Math.max(source.offsetWidth, workList?.scrollWidth || 0);
    const stageHeight = source.offsetHeight;
    const desiredScale = sourceScale * 2 * 1.2;
    const availableWidth = Math.max(1, window.innerWidth - 32);
    const availableHeight = Math.max(1, window.innerHeight - 32);
    const previewScale = Math.min(desiredScale, availableWidth / fullStripWidth, availableHeight / stageHeight);
    const previewWidth = Math.max(276, Math.round(fullStripWidth * previewScale));
    const previewHeight = Math.max(210, Math.round(stageHeight * previewScale));
    const preview = document.createElement('section');
    preview.className = 'country-art-movement-preview';
    preview.style.width = `${previewWidth}px`;
    preview.style.height = `${previewHeight}px`;
    preview.style.left = `${Math.max(16, Math.min(clientX + 14, window.innerWidth - previewWidth - 16))}px`;
    preview.style.top = `${Math.max(16, Math.min(clientY + 14, window.innerHeight - previewHeight - 16))}px`;
    const clone = source.cloneNode(true);
    const color = source.style.getPropertyValue('--movement-color');
    clone.classList.add('country-art-movement-preview-content');
    clone.querySelectorAll('.country-art-background-button').forEach(button => button.remove());
    clone.removeAttribute('style');
    clone.style.setProperty('--movement-color', color);
    preview.innerHTML = `<button class="country-art-movement-preview-close" type="button" aria-label="${language === 'ko' ? '확대 창 닫기' : 'Close enlarged view'}">×</button><div class="country-art-movement-preview-stage"></div>`;
    const stage = preview.querySelector('.country-art-movement-preview-stage');
    stage.style.width = `${fullStripWidth}px`;
    stage.style.height = `${stageHeight}px`;
    stage.style.transform = `scale(${previewScale})`;
    stage.append(clone);
    const closePreview = () => {
      document.querySelector('.country-art-image-magnifier')?.remove();
      preview.remove();
    };
    preview.querySelector('.country-art-movement-preview-close').addEventListener('click', closePreview);
    document.body.append(preview);
    const showMagnifier = image => {
      document.querySelector('.country-art-image-magnifier')?.remove();
      const card = image.closest('.country-art-work');
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      const cardWidth = card.offsetWidth || cardRect.width;
      const cardHeight = card.offsetHeight || cardRect.height;
      const previewRect = preview.getBoundingClientRect();
      const edge = 16, gap = 12;
      const candidates = [
        {side:'right', maxWidth:window.innerWidth - previewRect.right - gap - edge, maxHeight:window.innerHeight - edge * 2},
        {side:'bottom', maxWidth:window.innerWidth - edge * 2, maxHeight:window.innerHeight - previewRect.bottom - gap - edge},
        {side:'top', maxWidth:window.innerWidth - edge * 2, maxHeight:previewRect.top - gap - edge},
        {side:'left', maxWidth:previewRect.left - gap - edge, maxHeight:window.innerHeight - edge * 2},
      ].map(candidate => ({...candidate, scale:Math.min(4, candidate.maxWidth / cardRect.width, candidate.maxHeight / cardRect.height)})).filter(candidate => candidate.scale > 0);
      // Keep the magnifier beside the work whenever possible. The left side
      // can be occupied by the country selector, so it is only a fallback.
      const placement = (candidates.filter(candidate => candidate.side !== 'left').sort((a, b) => b.scale - a.scale)[0] || candidates.sort((a, b) => b.scale - a.scale)[0]);
      if (!placement) return;
      const width = Math.round(cardRect.width * placement.scale);
      const height = Math.round(cardRect.height * placement.scale);
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const left = placement.side === 'right' ? previewRect.right + gap : placement.side === 'left' ? previewRect.left - gap - width : cardCenterX - width / 2;
      const top = placement.side === 'bottom' ? previewRect.bottom + gap : placement.side === 'top' ? previewRect.top - gap - height : cardCenterY - height / 2;
      const magnifier = document.createElement('aside');
      magnifier.className = 'country-art-image-magnifier';
      magnifier.style.width = `${width}px`;
      magnifier.style.height = `${height}px`;
      magnifier.style.left = `${Math.max(edge, Math.min(left, window.innerWidth - width - edge))}px`;
      magnifier.style.top = `${Math.max(edge, Math.min(top, window.innerHeight - height - edge))}px`;
      const stage = document.createElement('div');
      stage.className = 'country-art-image-magnifier-stage';
      stage.style.width = `${cardWidth}px`;
      stage.style.height = `${cardHeight}px`;
      stage.style.transform = `scale(${placement.scale * (cardRect.width / cardWidth)})`;
      stage.append(card.cloneNode(true));
      magnifier.append(stage);
      document.body.append(magnifier);
    };
    clone.querySelectorAll('.country-art-work img').forEach(image => {
      image.addEventListener('pointerenter', () => showMagnifier(image));
      image.addEventListener('pointerleave', () => document.querySelector('.country-art-image-magnifier')?.remove());
    });
  };
  timeline.querySelectorAll('.country-art-movement').forEach(box => {
    if (!box.querySelector('.country-art-work')) return;
    box.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      openCountryArtMovementPreview(event.currentTarget, event.clientX, event.clientY);
    });
  });
  const countryArtScroll = timeline.querySelector('.country-art-scroll');
  const frozenLabelColumn = timeline.querySelector('.country-art-frozen-labels');
  countryArtScroll?.classList.add('country-art-frozen-axis-active');
  const syncFrozenLabelColumn = () => {
    if (!frozenLabelColumn || !countryArtScroll) return;
    const isActive = countryArtScroll.scrollLeft > 1 && countryArtScroll.scrollWidth > countryArtScroll.clientWidth + 1;
    frozenLabelColumn.classList.toggle('country-art-frozen-labels-active', isActive);
    countryArtScroll.classList.toggle('country-art-frozen-labels-active', isActive);
  };
  countryArtScroll?.addEventListener('scroll', syncFrozenLabelColumn, {passive:true});
  syncFrozenLabelColumn();
  const setCountryArtDensity = (nextDensity, anchorClientX, anchorClientY) => {
    const rect = countryArtScroll.getBoundingClientRect();
    const anchorOffsetX = anchorClientX - rect.left;
    const anchorOffsetY = anchorClientY - rect.top;
    const anchorContentX = (countryArtScroll.scrollLeft + anchorOffsetX) / density;
    const anchorContentY = (countryArtScroll.scrollTop + anchorOffsetY) / verticalDensity;
    activeView.density = Math.round(Math.max(densityMinimum, Math.min(densityMaximum, nextDensity)) * 100) / 100;
    persistActiveView();
    renderCountryArt(options);
    requestAnimationFrame(() => {
      const nextScroll = timeline.querySelector('.country-art-scroll');
      if (!nextScroll) return;
      const nextVerticalDensity = verticalDensityFor(activeView.density);
      nextScroll.scrollLeft = Math.max(0, anchorContentX * activeView.density - anchorOffsetX);
      nextScroll.scrollTop = Math.max(0, anchorContentY * nextVerticalDensity - anchorOffsetY);
      nextScroll.dispatchEvent(new Event('scroll'));
    });
  };
  countryArtScroll?.addEventListener('wheel', event => {
    if (!event.deltaY) return;
    event.preventDefault();
    setCountryArtDensity(activeView.density + (event.deltaY < 0 ? .05 : -.05), event.clientX, event.clientY);
  }, {passive:false});
  const resetCountryArtZoom = () => { countryArtResetZoomOnRender=true; renderCountryArt(options); };
  countryArtScroll?.addEventListener('contextmenu', event => {
    event.preventDefault();
    document.querySelector('.country-art-zoom-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'country-art-zoom-menu';
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 164)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - 52)}px`;
    menu.innerHTML = `<button type="button">${language === 'ko' ? '기본 비율로 보기' : 'Reset to default zoom'}</button>`;
    menu.querySelector('button').addEventListener('click', () => { menu.remove(); resetCountryArtZoom(); });
    menu.addEventListener('pointerdown', item => item.stopPropagation());
    document.body.append(menu);
    setTimeout(() => document.addEventListener('pointerdown', () => menu.remove(), {once:true}), 0);
  });
  let countryArtPan = null;
  countryArtScroll?.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('input, button') || (artistListMode && event.target.closest('[data-artist-list-row-key]'))) return;
    // Do not suppress a normal click here: cards use the native dblclick event
    // to open their enlarged, non-modal preview. Panning begins only after a
    // real drag distance has been crossed.
    countryArtPan = {pointerId:event.pointerId, x:event.clientX, y:event.clientY, left:countryArtScroll.scrollLeft, top:countryArtScroll.scrollTop, moved:false};
    countryArtScroll.classList.add('country-art-panning');
  });
  countryArtScroll?.addEventListener('pointermove', event => {
    if (!countryArtPan || event.pointerId !== countryArtPan.pointerId) return;
    const deltaX = event.clientX - countryArtPan.x;
    const deltaY = event.clientY - countryArtPan.y;
    if (!countryArtPan.moved && Math.hypot(deltaX, deltaY) < 5) return;
    if (!countryArtPan.moved) {
      countryArtPan.moved = true;
      countryArtScroll.setPointerCapture(event.pointerId);
    }
    countryArtScroll.scrollLeft = countryArtPan.left - deltaX;
    countryArtScroll.scrollTop = countryArtPan.top - deltaY;
    event.preventDefault();
  });
  const stopCountryArtPan = event => {
    if (!countryArtPan || event.pointerId !== countryArtPan.pointerId) return;
    countryArtPan = null;
    countryArtScroll.classList.remove('country-art-panning');
  };
  countryArtScroll?.addEventListener('pointerup', stopCountryArtPan);
  countryArtScroll?.addEventListener('pointercancel', stopCountryArtPan);
}
function renderArtistRelations() {
  const artist = artists.find(item => item.id === selectedId);
  const pageNav = `<nav class="page-nav-actions" aria-label="${language === 'ko' ? '탭 이동' : 'Tab navigation'}"><button class="atlas-nav-button artist-relations-nav-artists" type="button">${language === 'ko' ? '화가' : 'Artists'}</button><button class="atlas-nav-button artist-relations-nav-movements" type="button">${language === 'ko' ? '사조' : 'Movements'}</button><button class="atlas-nav-button artist-relations-nav-country" type="button">${language === 'ko' ? '국가별 미술' : 'Art by Country'}</button><button class="atlas-nav-button artist-relations-nav-artist-list" type="button">${language === 'ko' ? '화가 리스트' : 'Artist List'}</button><button class="atlas-nav-button artist-relations-nav-techniques" type="button">${language === 'ko' ? '기법·용어' : 'Techniques'}</button><button class="atlas-nav-button artist-relations-nav-topics" type="button">${language === 'ko' ? '주제-사건' : 'Topics & Events'}</button><button class="rules-check-button" type="button" data-rules-check hidden></button></nav>`;
  if (!artist) {
    timeline.innerHTML = `${pageNav}<section class="artist-relations-empty"><h1>${esc(language === 'ko' ? '화가를 찾을 수 없습니다.' : 'Artist not found.')}</h1><p>${esc(language === 'ko' ? '화가 목록에서 연표 제목의 이름을 눌러 관계도를 다시 열어 주세요.' : 'Open the relationship map again from an artist timeline title.')}</p></section>`;
  } else {
    const relation = artistRelations?.artists?.[artist.id] || artistRelations?.artists?.[artist.qid] || {};
    const relationGroups = [
      {key:'study', label:language === 'ko' ? '연구·모사·학습한 선행 화가' : 'Earlier artists studied or copied', position:'study'},
      {key:'teachers', label:language === 'ko' ? '성장기에 사사 받은 스승' : 'Teachers and mentors', position:'teachers'},
      {key:'exchanges', label:language === 'ko' ? '교류한 미술가' : 'Artists in exchange', position:'exchanges'},
      {key:'rivals', label:language === 'ko' ? '대립·경쟁한 미술가' : 'Rivals and competitors', position:'rivals'}
    ];
    const relationNodes = group => {
      const nodes = (Array.isArray(relation[group.key]) ? relation[group.key] : [])
      .map(entry => {
        const id = typeof entry === 'string' ? entry : entry?.id;
        const registeredArtist = id ? artists.find(item => item.id === id || item.qid === id) : null;
        const name = registeredArtist ? (language === 'ko' ? artistListKoreanName(registeredArtist) : loc(registeredArtist.name)) : loc(entry?.name || entry?.label);
        if (!name) return '';
        const classes = `artist-relation-node artist-relation-node--${group.position}`;
        if (registeredArtist) {
          const title = language === 'ko' ? `${name} 화가 연표 보기` : `Open ${name} artist timeline`;
          const href = uHangulModeUrl(`index.html?artist=${encodeURIComponent(registeredArtist.id)}`);
          return `<a class="${classes} artist-relation-artist-link" href="${esc(href)}" target="artThroughTimeArtists" title="${esc(title)}"${uHangulArtistAttributes(registeredArtist, name)}>${esc(name)}</a>`;
        }
        const wikipedia = typeof entry?.wikipedia === 'string' ? entry.wikipedia.trim() : '';
        if (wikipedia) return `<a class="${classes} artist-relation-wikipedia-link" href="${esc(wikipedia)}" target="artAtlasArtistWikipedia" rel="noopener" title="${esc(language === 'ko' ? `${name} 영문 위키피디아 열기` : `Open ${name} on English Wikipedia`)}">${esc(name)}</a>`;
        const answer = entry?.agentAnswer || (language === 'ko' ? `${name}에 관한 확인 가능한 외부 링크가 아직 등록되지 않았습니다. 관계 데이터에 출처와 설명을 추가해 주세요.` : `No verified external link is recorded for ${name}. Add a source and explanation to the relationship data.`);
        return `<button class="${classes} artist-relation-agent-link" type="button" data-relation-agent-name="${esc(name)}" data-relation-agent-answer="${esc(answer)}" title="${esc(language === 'ko' ? `${name} AI 에이전트 안내 보기` : `View AI agent note for ${name}`)}">${esc(name)}</button>`;
      })
      .filter(Boolean);
      return nodes.length ? nodes.join('<span class="artist-relation-separator" aria-hidden="true">,</span>') : `<p class="artist-relation-none">${esc(language === 'ko' ? '등록된 관계 없음' : 'No relation recorded')}</p>`;
    };
    const lanes = relationGroups.map(group => `<section class="artist-relation-lane artist-relation-lane--${group.position}"><h2>${esc(group.label)}</h2><div>${relationNodes(group)}</div></section>`).join('');
    const impactEvents = Array.isArray(relation.impactEvents) ? relation.impactEvents : [];
    const impactEventsMarkup = impactEvents.length ? `<section class="artist-impact-events" aria-labelledby="artist-impact-events-title"><div class="artist-impact-events-heading"><p>${esc(language === 'ko' ? 'Artist timeline' : 'Artist timeline')}</p><h2 id="artist-impact-events-title">${esc(language === 'ko' ? '영향을 준 event' : 'Influential events')}</h2></div><div class="artist-impact-events-table" role="table"><div class="artist-impact-events-row artist-impact-events-row--head" role="row"><span role="columnheader">${esc(language === 'ko' ? '연도' : 'Year')}</span><span role="columnheader">${esc(language === 'ko' ? '사건' : 'Event')}</span><span role="columnheader">${esc(language === 'ko' ? '영향' : 'Impact')}</span></div>${impactEvents.map(event => `<div class="artist-impact-events-row" role="row"><time role="cell">${esc(event?.year || '')}</time><strong role="cell">${esc(loc(event?.title))}</strong><div role="cell"><p>${esc(loc(event?.impact))}</p></div></div>`).join('')}</div></section>` : '';
    const subtitle = language === 'ko'
      ? '검증된 관계만 표시합니다. 관계 정보가 없는 방향은 비워 둡니다.'
      : 'Only verified relationships are shown; directions without records remain empty.';
    timeline.innerHTML = `${pageNav}<header class="artist-relations-header"><p class="eyebrow">${esc(language === 'ko' ? '화가 관계도' : 'Artist Relationship Map')}</p><h1>${esc(artistDisplayName(artist))}</h1><p>${esc(subtitle)}</p></header><section class="artist-relation-map" aria-label="${esc(language === 'ko' ? `${artistDisplayName(artist)} 관계도` : `${artistDisplayName(artist)} relationship map`)}"><span class="artist-relation-connector artist-relation-connector--up" aria-hidden="true"></span><span class="artist-relation-connector artist-relation-connector--down" aria-hidden="true"></span><span class="artist-relation-connector artist-relation-connector--left" aria-hidden="true"></span><span class="artist-relation-connector artist-relation-connector--right" aria-hidden="true"></span>${lanes}<div class="artist-relation-center"><span class="artist-relation-node artist-relation-node--center"${uHangulArtistAttributes(artist, artistDisplayName(artist))}>${esc(artistDisplayName(artist))}</span></div></section>${impactEventsMarkup}`;
    timeline.querySelectorAll('[data-relation-agent-name]').forEach(button => button.addEventListener('click', () => showRelationAgentAnswer(button.dataset.relationAgentName, button.dataset.relationAgentAnswer)));
  }
  timeline.querySelector('.artist-relations-nav-artists')?.addEventListener('click', openArtistListPage);
  timeline.querySelector('.artist-relations-nav-movements')?.addEventListener('click', openMovementAtlas);
  timeline.querySelector('.artist-relations-nav-country')?.addEventListener('click', openCountryArtPage);
  timeline.querySelector('.artist-relations-nav-artist-list')?.addEventListener('click', openPainterListPage);
  timeline.querySelector('.artist-relations-nav-techniques')?.addEventListener('click', openTechniquesPage);
  timeline.querySelector('.artist-relations-nav-topics')?.addEventListener('click', openTopicsPage);
  queueMicrotask(() => window.dispatchEvent(new Event('art-through-time-rules-check-refresh')));
}
function showRelationAgentAnswer(name='', answer='') {
  document.querySelector('.artist-relation-agent-answer')?.remove();
  const panel = document.createElement('aside');
  panel.className = 'artist-relation-agent-answer';
  panel.setAttribute('role', 'status');
  panel.innerHTML = `<button type="button" aria-label="${esc(language === 'ko' ? '안내 닫기' : 'Close note')}">×</button><p>${esc(language === 'ko' ? 'AI 에이전트 안내' : 'AI agent note')}</p><h2>${esc(name)}</h2><div>${esc(answer)}</div>`;
  panel.querySelector('button')?.addEventListener('click', () => panel.remove());
  document.body.append(panel);
}
function openMovementAtlas() {
  if (!isMovementPage) {
    const pageUrl = new URL('index.html', location.href);
    pageUrl.searchParams.delete('artists');
    pageUrl.searchParams.delete('artistList');
    pageUrl.searchParams.delete('artist');
    pageUrl.searchParams.delete('artistId');
    pageUrl.searchParams.delete('artistRelations');
    pageUrl.searchParams.delete('countryArt');
    pageUrl.searchParams.set('movementPopup', '1');
    openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeMovements');
    return;
  }
  movementView = normalizeMovementView(movementView);
  persistMovementView();
  viewMode = 'movements';
  closeDetail();
  render();
}
function closeMovementAtlasPage() {
  const pageUrl = new URL(location.href);
  pageUrl.searchParams.delete('movementPopup');
  if (history.length > 1) history.back();
  else location.assign(pageUrl.href);
}
