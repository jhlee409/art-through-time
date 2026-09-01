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
    : countryCanonicalMovements(country).filter(item => !movementIsContextOnly(item)).map(item => clippedMovement(item,start,end)).filter(Boolean).sort((a,b) => a.start-b.start || a.end-b.end).map((item, column) => ({...item, column}));
  if (artistListMode) {
    entries=orderedArtistListMovementEntries(entries).map((entry,index) => ({
      ...entry,
      artistListParentColor:artistListParentMovementPalette[index % artistListParentMovementPalette.length]
    }));
  }
  const selectedCountryCount = artistListMode ? artistListView.countries.length : 1;
  const chartHeading = artistListMode
    ? (selectedCountryCount === countryOptions.length ? (language === 'ko' ? '전체 국가' : 'All countries') : (language === 'ko' ? `선택 국가 ${selectedCountryCount}개` : `${selectedCountryCount} countries`))
    : loc(country.name);
  const axisHeading = artistListMode
    ? (language === 'ko' ? `사조(${chartHeading})` : `Movements (${chartHeading})`)
    : (language === 'ko' ? '사조' : 'Movement');
  const yearLabel = year => Number(year) < 0 ? `${Math.abs(year)} BCE` : String(year);
  // The row and bar match the standardized card's maximum height, including list padding and bar borders.
  const movementRowHeight = artistListMode ? 58 : Math.ceil((window.innerWidth / 14) * .8) + 54;
  const axisHeight = artistListMode ? 38 : 76;
  const labelColumnWidth = artistListMode
    ? Math.max(Math.round(countryArtLabelColumnWidth * .6), Math.ceil(countryArtMeasureTextWidth(axisHeading) + 20))
    : countryArtLabelColumnWidth;
  // Country heading (about 37px) plus the time axis and all movement rows.
  const eventRailHeight = artistListMode ? 0 : countryArtEventRailHeight;
  let chartContentHeight = axisHeight + eventRailHeight + entries.length * movementRowHeight;
  const timelineRect = timeline.getBoundingClientRect();
  const timelineStyle = getComputedStyle(timeline);
  const timelineHorizontalPadding = parseFloat(timelineStyle.paddingLeft || 0) + parseFloat(timelineStyle.paddingRight || 0);
  const timelineVerticalPadding = parseFloat(timelineStyle.paddingTop || 0) + parseFloat(timelineStyle.paddingBottom || 0);
  const visibleChartWidth = Math.max(360, Math.floor((timelineRect.width || window.innerWidth) - timelineHorizontalPadding - 4));
  const visibleChartHeight = Math.max(220, Math.floor((timelineRect.height || window.innerHeight) - timelineVerticalPadding - 4));
  // Country-art fits the vertical rows into the view. Artist-list starts from
  // its fixed artist-name box height, so row height grows from stacked boxes.
  const defaultCountryArtDensity = Math.max(densityMinimum, Math.min(
    densityMaximum,
    (visibleChartHeight / chartContentHeight),
  ));
  const defaultFitDensity = Math.max(densityMinimum, Math.min(
    densityMaximum,
    artistListMode ? 1 : Math.floor(defaultCountryArtDensity * 1000) / 1000
  ));
  let defaultArtistListVerticalDensity = artistListMode ? 1 : defaultFitDensity;
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
  // Keep scrolling available after user zoom or narrow viewport constraints.
  const hideDefaultScrollbars = false;
  // The default time range stays fitted; user zoom can expand it later.
  const horizontalFitDensity = artistListMode ? defaultFitDensity : defaultCountryArtDensity;
  const horizontalScrollbarReserve = artistListMode ? 20 : 0;
  const baseTimeWidth = artistListMode
    ? Math.max(1, Math.floor((visibleChartWidth - horizontalScrollbarReserve) / horizontalFitDensity - labelColumnWidth))
    : Math.max(1, Math.ceil(visibleChartWidth / horizontalFitDensity - labelColumnWidth));
  const chartWidth = artistListMode ? Math.ceil(baseTimeWidth * 2) : baseTimeWidth;
  const yearScale = chartWidth / (end - start);
  if (artistListMode) {
    entries=entries.map(entry => {
      const artistListLayout=artistListSubmovementLayout(entry,start,end,yearScale);
      return {...entry,artistListLayout,artistListRowHeight:artistListLayout.rowHeight};
    });
    // The century header is screen-fixed at 38px. Its unscaled source height
    // is therefore inverse-compensated here, just like the frozen left cell.
    chartContentHeight=(axisHeight / Math.max(verticalDensity,.001)) + entries.reduce((sum,entry) => sum + entry.artistListRowHeight,0);
    defaultArtistListVerticalDensity=1;
    verticalDensity=verticalDensityFor(density);
  }
  const chartContentWidth = labelColumnWidth + chartWidth;
  const workSources = artistListMode ? new Map() : new Map(entries.map(entry => [entry, countryArtWorksFor(country, entry)]));
  const preferredWorksByImage = new Map();
  if (!artistListMode) entries.forEach(entry => {
    workSources.get(entry).works.forEach(work => {
      const preferred = preferredWorksByImage.get(work.src);
      if (!preferred || work.descriptionLength < preferred.work.descriptionLength) preferredWorksByImage.set(work.src, {entry, work});
    });
  });
  const displayedWorksByEntry = artistListMode ? new Map() : new Map(entries.map(entry => [entry, workSources.get(entry).works.filter(work => preferredWorksByImage.get(work.src)?.entry === entry)]));
  // In artist-list mode the complete chart is vertically scaled, whereas its
  // fixed century band is not. Use an inverse source height for both sides of
  // the chart so their screen-space boundary stays aligned at every zoom.
  const artistListAxisSourceHeight = artistListMode ? axisHeight / Math.max(verticalDensity,.001) : axisHeight;
  const artistListRowTops = new Map();
  if (artistListMode) {
    let rowTop = artistListAxisSourceHeight;
    entries.forEach(entry => {
      artistListRowTops.set(entry, rowTop);
      rowTop += entry.artistListRowHeight;
    });
  }
  const axisCornerStyle = artistListMode ? ` style="height:${artistListAxisSourceHeight}px;min-height:${artistListAxisSourceHeight}px"` : '';
  const axisCorner = `<div class="country-art-axis-corner"${axisCornerStyle}><span>${esc(axisHeading)}</span></div>`;
  // The frozen left header shares the exact source geometry of the chart cell.
  const frozenAxisCorner = axisCorner;
  const centuryBands = timelineCenturyBands(start, end, yearScale);
  const centuryGrid = `<div class="country-art-century-grid" aria-hidden="true" style="left:${labelColumnWidth}px;width:${chartWidth}px;height:${chartContentHeight}px">${centuryBands}</div>`;
  const axis = `${axisCorner}<div class="country-art-time-axis" style="width:${chartWidth}px;height:${artistListAxisSourceHeight}px;min-height:${artistListAxisSourceHeight}px">${centuryBands}</div>`;
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
  const frozenCountryHeading = artistListMode ? '' : `<div class="country-art-country-name" style="width:${labelColumnWidth}px;min-width:${labelColumnWidth}px">${esc(chartHeading)}</div>`;
  // Counter the non-uniform chart transform exactly so the frozen movement
  // labels retain their normal font proportions at the default view and zoom.
  const frozenLabelTextXScale = artistListMode ? 1 / Math.max(density, .001) : 1;
  const frozenLabelTextYScale = artistListMode ? 1 / Math.max(verticalDensity, .001) : 1;
  const frozenLabels = `<div class="country-art-frozen-labels" aria-hidden="true" style="width:${Math.ceil(labelColumnWidth * density)}px"><div class="country-art-frozen-labels-layer" style="width:${labelColumnWidth}px;transform:scale(${density}, ${verticalDensity});--artist-list-label-text-x-scale:${frozenLabelTextXScale};--artist-list-label-text-y-scale:${frozenLabelTextYScale}">${frozenCountryHeading}<div class="country-art-frozen-chart" style="width:${labelColumnWidth}px">${frozenAxisCorner}${frozenEventCorner}${frozenMovementLabels}</div></div></div>`;
  const frozenAxisVerticalDensity = artistListMode ? 1 : verticalDensity;
  const centuryLabelXScale = artistListMode ? 1 / Math.max(density, .001) : 1;
  const frozenTimeAxis = `<div class="country-art-frozen-time-axis" aria-hidden="true" style="width:${Math.ceil(chartContentWidth * density)}px"><div class="country-art-frozen-time-axis-layer" style="left:${Math.ceil(labelColumnWidth * density)}px;width:${Math.ceil(chartWidth * density)}px;height:${Math.ceil(axisHeight * frozenAxisVerticalDensity)}px"><div style="width:${chartWidth}px;transform:scale(${density}, ${frozenAxisVerticalDensity});--artist-list-century-label-x-scale:${centuryLabelXScale}"><div class="country-art-time-axis" style="width:${chartWidth}px;height:${axisHeight}px">${centuryBands}</div></div></div></div>`;
  const artistLifeOverlayPills = [];
  const workMarkup = (entry) => {
    const rowHeight=artistListMode ? entry.artistListRowHeight : movementRowHeight;
    const left = Math.max(0,entry.start-start)*yearScale;
    const barWidth = Math.max(92,(Math.min(end,entry.end)-Math.max(start,entry.start))*yearScale);
    if (artistListMode) {
      let submovementBoxes = '';
      let submovements = [];
      try {
        submovements=entry.artistListLayout.submovements;
        // Only an explicitly declared school, lineage, period, or exhibition
        // group receives a nested outline inside its parent movement.
        submovementBoxes=submovements.filter(child => child.isExplicitSubmovement).map(child => {
          const childLeft=Math.max(0,child.start-start)*yearScale;
          const childWidth=Math.max(2,(Math.min(end,child.end)-Math.max(start,child.start))*yearScale);
          const childTitle=`${loc(entry.name)} · ${loc(child.name)} · ${yearLabel(child.sourceStart ?? child.start)}–${yearLabel(child.sourceEnd ?? child.end)}`;
          return `<div class="artist-list-submovement-box" style="left:${childLeft}px;top:${child.submovementTop}px;width:${childWidth}px;height:${child.submovementHeight}px;--movement-color:${esc(entry.artistListParentColor)}" title="${esc(childTitle)}"><span class="artist-list-submovement-title" title="${esc(childTitle)}">${esc(loc(child.name))}</span></div>`;
        }).join('');
        submovements.forEach(child => artistLifeOverlayPills.push(artistListPackedArtistOverlayMarkup(child, start, end, yearScale, child.submovementTop, child.artistLayout, {
          rowTop:artistListRowTops.get(entry) || 0,
          labelColumnWidth,
          density,
          verticalDensity,
          defaultFitDensity
        })));
      } catch (error) {
        console.error('Artist list packing failed:', error);
      }
      // Keep the parent movement as the full-period container. School and phase boxes
      // are an overlay inside it; their dates must never redefine the parent width.
      const parentMovementBox = `<article class="country-art-movement artist-list-empty-movement" aria-hidden="true" style="left:${left}px;width:${barWidth}px;height:${rowHeight}px;--movement-color:${esc(entry.artistListParentColor)}" title="${esc(`${artistListMovementCountryLabel(entry)} · ${loc(entry.name)} · ${movementLabelMeta(entry)}`)}"><div class="country-art-work-list country-art-work-list-empty"></div></article>`;
      return `${movementLabelMarkup(entry)}<div class="country-art-time-row artist-list-time-row" style="width:${chartWidth}px;height:${rowHeight}px">${parentMovementBox}${submovementBoxes}</div>`;
    }
    const source = workSources.get(entry);
    const works = displayedWorksByEntry.get(entry).map(work => `<figure class="country-art-work"><img src="${esc(work.src)}" alt="${esc(work.alt)}" loading="lazy"><figcaption>${work.artistName ? `<strong class="country-art-work-artist">${esc(work.artistName)}</strong>` : ''}<span class="country-art-work-title">${esc(work.title)}</span>${work.year ? `<small>${esc(work.year)}</small>` : ''}</figcaption></figure>`).join('');
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
  const pageNav = `<nav class="page-nav-actions" aria-label="${language === 'ko' ? '탭 이동' : 'Tab navigation'}"><button class="atlas-nav-button country-art-nav-artists" type="button">${language === 'ko' ? '화가' : 'Artists'}</button><button class="atlas-nav-button country-art-nav-movements" type="button">${language === 'ko' ? '사조' : 'Movements'}</button>${countryArtButton}${painterListButton}<button class="atlas-nav-button country-art-nav-techniques" type="button">${language === 'ko' ? '기법·용어' : 'Techniques'}</button><button class="atlas-nav-button country-art-nav-topics" type="button">${language === 'ko' ? '주제-사건' : 'Topics & Events'}</button></nav>`;
  const defaultFitClass = hideDefaultScrollbars ? ' country-art-scroll-default-fit' : '';
  const chartCountryHeading = artistListMode ? '' : `<div class="country-art-country-name" style="width:${labelColumnWidth}px;min-width:${labelColumnWidth}px">${esc(chartHeading)}</div>`;
  const chartRows = entries.map(workMarkup).join('');
  const artistLifeOverlay = artistListMode && artistLifeOverlayPills.length ? `<div class="artist-life-overlay">${artistLifeOverlayPills.join('')}</div>` : '';
  timeline.innerHTML = `${pageNav}<div class="atlas-scroll country-art-scroll${defaultFitClass}">${frozenLabels}${frozenTimeAxis}<div class="country-art-zoom-viewport" style="width:${Math.ceil(chartContentWidth * density)}px;height:${Math.ceil(chartContentHeight * verticalDensity)}px"><div class="country-art-zoom-layer country-art-event-mode-${countryArtEventMode(density)}" style="width:${chartContentWidth}px;transform:scale(${density}, ${verticalDensity});--artist-list-label-text-x-scale:${frozenLabelTextXScale};--artist-list-label-text-y-scale:${frozenLabelTextYScale}">${chartCountryHeading}<div class="country-art-chart" style="width:${chartContentWidth}px;grid-template-columns:${labelColumnWidth}px ${chartWidth}px">${centuryGrid}${axis}${eventRail}${chartRows}</div></div>${artistLifeOverlay}</div></div>`;
  timeline.querySelector('.country-art-nav-artists')?.addEventListener('click', openArtistListPage);
  timeline.querySelector('.country-art-nav-movements')?.addEventListener('click', openMovementAtlas);
  timeline.querySelector('.country-art-nav-country-art')?.addEventListener('click', openCountryArtPage);
  timeline.querySelector('.country-art-nav-artist-list')?.addEventListener('click', openPainterListPage);
  timeline.querySelector('.country-art-nav-techniques')?.addEventListener('click', openTechniquesPage);
  timeline.querySelector('.country-art-nav-topics')?.addEventListener('click', openTopicsPage);
  const restoreArtistListChartPosition = action => {
    const scroll = timeline.querySelector('.country-art-scroll');
    const scrollLeft = scroll?.scrollLeft || 0;
    const scrollTop = scroll?.scrollTop || 0;
    const pageX = window.scrollX || 0;
    const pageY = window.scrollY || 0;
    action();
    const restore = () => {
      if (scroll?.isConnected) {
        scroll.scrollLeft = scrollLeft;
        scroll.scrollTop = scrollTop;
        scroll.dispatchEvent(new Event('scroll'));
      }
      window.scrollTo(pageX, pageY);
    };
    requestAnimationFrame(restore);
    setTimeout(restore, 0);
  };
  const bindArtistLifePill = button => button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    button.blur();
    restoreArtistListChartPosition(() => openArtistTimelinePage(button.dataset.artistId));
  });
  if (artistListMode) timeline.querySelectorAll('.artist-life-pill--overlay').forEach(bindArtistLifePill);
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
  const openCountryArtMovementPreview = source => {
    document.querySelector('.country-art-movement-preview')?.remove();
    document.querySelector('.country-art-image-magnifier')?.remove();
    const workList = source.querySelector('.country-art-work-list');
    // Use the unscaled width of every original card, not just the currently
    // visible part of its scroll area. This keeps image, caption and header
    // proportions identical while making the complete strip twice as large.
    const fullStripWidth = Math.max(source.offsetWidth, workList?.scrollWidth || 0);
    const stageHeight = source.offsetHeight;
    const previewWidth = Math.max(240, Math.round(window.innerWidth * .95));
    const previewScale = previewWidth / Math.max(1, fullStripWidth);
    const previewHeight = Math.max(210, Math.round(stageHeight * previewScale));
    const preview = document.createElement('section');
    preview.className = 'country-art-movement-preview';
    preview.style.width = `${previewWidth}px`;
    preview.style.height = `${previewHeight}px`;
    preview.style.left = `${Math.max(0, Math.round((window.innerWidth - previewWidth) / 2))}px`;
    preview.style.top = `${Math.max(0, Math.round((window.innerHeight - previewHeight) / 2))}px`;
    const clone = source.cloneNode(true);
    const color = source.style.getPropertyValue('--movement-color');
    clone.classList.add('country-art-movement-preview-content');
    clone.querySelectorAll('.country-art-background-button').forEach(button => button.remove());
    clone.removeAttribute('style');
    clone.style.setProperty('--movement-color', color);
    preview.innerHTML = `<div class="country-art-movement-preview-stage"></div><div class="country-art-movement-preview-caption"></div>`;
    const stage = preview.querySelector('.country-art-movement-preview-stage');
    const previewCaption = preview.querySelector('.country-art-movement-preview-caption');
    stage.style.width = `${fullStripWidth}px`;
    stage.style.height = `${stageHeight}px`;
    stage.style.transform = `scale(${previewScale})`;
    stage.append(clone);
    const closePreview = () => {
      document.querySelector('.country-art-image-magnifier')?.remove();
      preview.remove();
    };
    preview.addEventListener('dblclick', event => {
      if(event.target.closest('.country-art-work'))return;
      event.preventDefault();
      event.stopPropagation();
      closePreview();
    });
    document.body.append(preview);
    const workCaption = image => {
      const work=image.closest('.country-art-work');
      return [
        work?.querySelector('.country-art-work-artist')?.textContent?.trim(),
        work?.querySelector('.country-art-work-title')?.textContent?.trim(),
        work?.querySelector('figcaption small')?.textContent?.trim()
      ].filter(Boolean).join(' · ');
    };
    const showPreviewCaption = image => {
      previewCaption.textContent=workCaption(image);
      previewCaption.classList.toggle('hidden',!previewCaption.textContent);
    };
    const previewImages=[...clone.querySelectorAll('.country-art-work img')];
    if(previewImages[0])showPreviewCaption(previewImages[0]);
    const showMagnifier = image => {
      const src = image.currentSrc || image.getAttribute('src') || image.src || '';
      const alt = image.getAttribute('alt') || '';
      const caption = workCaption(image);
      if (!src) return;
      const current = document.querySelector('.country-art-image-magnifier');
      if (current?.dataset.imageSrc === src) {
        current.remove();
        return;
      }
      current?.remove();
      const naturalAspect = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : null;
      const imageRect = image.getBoundingClientRect();
      const aspect = naturalAspect || Math.max(.2, imageRect.width) / Math.max(.2, imageRect.height);
      const maxWidth = Math.max(120, window.innerWidth * .9);
      const maxHeight = Math.max(120, window.innerHeight * .9);
      let width = maxWidth;
      let height = width / aspect;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
      }
      width = Math.round(width);
      height = Math.round(height);
      const magnifier = document.createElement('aside');
      magnifier.className = 'country-art-image-magnifier';
      magnifier.dataset.imageSrc = src;
      magnifier.style.width = `${width}px`;
      magnifier.style.height = `${height}px`;
      magnifier.style.left = `${Math.max(0, Math.round((window.innerWidth - width) / 2))}px`;
      magnifier.style.top = `${Math.max(0, Math.round((window.innerHeight - height) / 2))}px`;
      magnifier.style.aspectRatio = String(aspect);
      magnifier.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}"><div class="country-art-image-magnifier-caption${caption ? '' : ' hidden'}">${esc(caption)}</div>`;
      document.body.append(magnifier);
      let interaction = null;
      // Pointer capture used for dragging retargets the completed double-click
      // to the box even though both presses begin on its full-size image.
      magnifier.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();
        magnifier.remove();
      });
      magnifier.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const rect = magnifier.getBoundingClientRect();
        interaction = {pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, left:rect.left, top:rect.top};
        magnifier.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      });
      magnifier.addEventListener('pointermove', event => {
        if (!interaction || interaction.pointerId !== event.pointerId) return;
        const dx = event.clientX - interaction.startX;
        const dy = event.clientY - interaction.startY;
        magnifier.style.left = `${Math.round(interaction.left + dx)}px`;
        magnifier.style.top = `${Math.round(interaction.top + dy)}px`;
        event.preventDefault();
      });
      const stop = event => { if (interaction?.pointerId === event.pointerId) interaction = null; };
      magnifier.addEventListener('pointerup', stop);
      magnifier.addEventListener('pointercancel', stop);
    };
    previewImages.forEach(image => {
      image.addEventListener('pointerenter',()=>showPreviewCaption(image));
      image.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();
        showPreviewCaption(image);
        showMagnifier(image);
      });
    });
  };
  timeline.querySelectorAll('.country-art-movement').forEach(box => {
    if (!box.querySelector('.country-art-work')) return;
    box.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      openCountryArtMovementPreview(event.currentTarget);
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
    if (event.button !== 0 || event.target.closest('input, button, .artist-list-submovement-box') || (artistListMode && event.target.closest('[data-artist-list-row-key]'))) return;
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
function openMovementAtlas() {
  if (!isMovementPage) {
    const pageUrl = new URL('index.html', location.href);
    pageUrl.searchParams.delete('artists');
    pageUrl.searchParams.delete('artistList');
    pageUrl.searchParams.delete('artist');
    pageUrl.searchParams.delete('artistId');
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
