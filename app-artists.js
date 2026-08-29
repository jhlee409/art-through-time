/* Artist list, timeline, and artist detail rendering. */
function renderText() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  if (isMovementPage || isCountryArtPage || isPainterListPage) {
    const title = document.querySelector('.sidebar-page-title');
    if (title) title.textContent = isPainterListPage ? (language === 'ko' ? '화가 리스트' : 'Artist List') : (isCountryArtPage ? (language === 'ko' ? '국가별 미술' : 'Art by Country') : t('movementAtlas'));
  }
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-display-mode]').forEach(button => {
    const active = button.dataset.displayMode === uHangulMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  window.dispatchEvent(new CustomEvent('uhangulmodechange', {detail:{mode:uHangulMode}}));
  const addButton = $('#add-button');
  if (addButton) {
    addButton.classList.toggle('hidden', !currentUserIsAdmin);
    addButton.title = t('addArtistTooltip');
    addButton.setAttribute('aria-label', t('addArtistTooltip'));
  }
  $('#movement-atlas-button')?.classList.toggle('active', viewMode === 'movements');
  $('#country-art-button')?.classList.toggle('active', viewMode === 'country-art');
  $('#artist-list-button')?.classList.toggle('active', viewMode === 'artist-list');
}
function artistFacetValues(artist, key) { return Array.isArray(artist?.[key]) ? artist[key] : []; }
function artistMatchesFacetFilters(artist) {
  return Object.entries(artistFacetFilters).every(([key, selected]) => !selected.size || artistFacetValues(artist, key).some(value => selected.has(value)));
}
function syncArtistFacetUrl() {
  const url = new URL(location.href);
  ['period','region','movement','submovement'].forEach(key => url.searchParams.delete(key));
  [['period','periods'],['region','regions'],['movement','movements'],['submovement','submovements']].forEach(([param,key]) => artistFacetFilters[key].forEach(value => url.searchParams.append(param,value)));
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}
function facetOptions(key) {
  if (key === 'periods') return (artTaxonomy.periods || []).map(item => ({id:item.id,label:item.name}));
  if (key === 'movements') return (artTaxonomy.movements || []).map(item => ({id:item.name,label:item.name}));
  if (key === 'submovements') {
    const selectedMovements = artistFacetFilters.movements;
    const source = selectedMovements.size ? (artTaxonomy.movements || []).filter(item => selectedMovements.has(item.name)) : (artTaxonomy.movements || []);
    return [...new Set(source.flatMap(item => item.submovements || []))].map(name => ({id:name,label:name}));
  }
  return [...new Set(artists.flatMap(artist => artistFacetValues(artist,'regions')))].sort((a,b) => a.localeCompare(b,'ko')).map(name => ({id:name,label:name}));
}
function facetCount(key, value) {
  return artists.filter(artist => Object.entries(artistFacetFilters).every(([otherKey, selected]) => otherKey === key || !selected.size || artistFacetValues(artist, otherKey).some(item => selected.has(item))) && artistFacetValues(artist,key).includes(value)).length;
}
function renderArtistFacetFilters() {
  const root = $('#artist-facet-filters');
  if (!root) return;
  root.classList.toggle('artist-facet-inline', !useCompactArtistFacetPanel);
  const labels = {periods:'연대',regions:'활동 지역',movements:'사조',submovements:'세부사조·학파'};
  const active = Object.entries(artistFacetFilters).flatMap(([key,values]) => [...values].map(value => ({key,value,label:facetOptions(key).find(item => item.id === value)?.label || value})));
  const group = key => {
    const expanded = expandedArtistFacetGroups.has(key);
    const hasContext = Object.entries(artistFacetFilters).some(([otherKey, values]) => otherKey !== key && values.size);
    const options = facetOptions(key).filter(option => !hasContext || artistFacetFilters[key].has(option.id) || facetCount(key, option.id) > 0);
    return `<section class="artist-facet-group"><button type="button" class="artist-facet-heading" data-facet-toggle="${key}" aria-expanded="${expanded}"><span>${labels[key]}</span><span>${expanded ? '▴' : '▾'}</span></button>${expanded ? `<div class="artist-facet-options">${options.map(option => `<label><input type="checkbox" data-facet-key="${key}" value="${esc(option.id)}"${artistFacetFilters[key].has(option.id) ? ' checked' : ''}><span>${esc(option.label)}</span><small>${facetCount(key,option.id)}</small></label>`).join('') || '<p>선택 가능한 항목이 없습니다.</p>'}</div>` : ''}</section>`;
  };
  const filterContent = `<div class="artist-facet-title-row"><div class="artist-facet-title">${useCompactArtistFacetPanel ? '분류 필터' : '화가 찾기'}</div><div class="artist-facet-all-actions" role="group" aria-label="필터 전체 펼치기 및 접기"><button type="button" data-facet-expand-all title="전체 펼치기" aria-label="전체 펼치기">▾</button><button type="button" data-facet-collapse-all title="전체 접기" aria-label="전체 접기">▴</button></div></div>${active.length ? `<div class="artist-facet-chips">${active.map(item => `<button type="button" data-facet-remove="${item.key}" data-facet-value="${esc(item.value)}">${esc(item.label)} ×</button>`).join('')}</div>` : ''}<button type="button" class="artist-facet-clear"${active.length ? '' : ' hidden'}>모든 필터 초기화</button>${['regions','movements','submovements','periods'].map(group).join('')}`;
  root.innerHTML = useCompactArtistFacetPanel
    ? `<button type="button" class="artist-facet-trigger" data-facet-panel-toggle aria-expanded="${artistFacetPanelOpen}" aria-controls="artist-facet-popover">화가 찾기${active.length ? ` <span>${active.length}</span>` : ''}<b aria-hidden="true">${artistFacetPanelOpen ? '▴' : '▾'}</b></button>${artistFacetPanelOpen ? `<div id="artist-facet-popover" class="artist-facet-popover">${filterContent}</div>` : ''}`
    : filterContent;
  root.querySelector('[data-facet-panel-toggle]')?.addEventListener('click', () => { artistFacetPanelOpen = !artistFacetPanelOpen; renderArtistFacetFilters(); });
  root.querySelector('[data-facet-expand-all]')?.addEventListener('click', () => { ['regions','movements','submovements','periods'].forEach(key => expandedArtistFacetGroups.add(key)); renderArtistFacetFilters(); });
  root.querySelector('[data-facet-collapse-all]')?.addEventListener('click', () => { expandedArtistFacetGroups.clear(); renderArtistFacetFilters(); });
  root.querySelectorAll('[data-facet-toggle]').forEach(button => button.onclick = () => { const key=button.dataset.facetToggle; expandedArtistFacetGroups.has(key) ? expandedArtistFacetGroups.delete(key) : expandedArtistFacetGroups.add(key); renderArtistFacetFilters(); });
  root.querySelectorAll('[data-facet-key]').forEach(input => input.onchange = () => { const key=input.dataset.facetKey; input.checked ? artistFacetFilters[key].add(input.value) : artistFacetFilters[key].delete(input.value); if (key === 'movements') { const valid = new Set(facetOptions('submovements').map(item => item.id)); artistFacetFilters.submovements = new Set([...artistFacetFilters.submovements].filter(value => valid.has(value))); } syncArtistFacetUrl(); renderList(); });
  root.querySelectorAll('[data-facet-remove]').forEach(button => button.onclick = () => { artistFacetFilters[button.dataset.facetRemove].delete(button.dataset.facetValue); syncArtistFacetUrl(); renderList(); });
  root.querySelector('.artist-facet-clear')?.addEventListener('click', () => { Object.values(artistFacetFilters).forEach(values => values.clear()); syncArtistFacetUrl(); renderList(); });
}
function renderList() {
  renderArtistFacetFilters();
  const artistCount = $('#artist-count');
  if (artistCount) artistCount.textContent = language === 'ko' ? `총 ${artists.length}명` : `${artists.length} artists`;
  const sort = $('#sort').value;
  const effectiveSort = sort === 'name' ? 'nameAsc' : sort;
  const query = artistSearchQuery.toLocaleLowerCase();
  const compactQuery = normalized(artistSearchQuery);
  const ordered = [...artists].filter(a => {
    if (!artistMatchesFacetFilters(a)) return false;
    if (!query) return true;
    const searchText = artistSearchText(a);
    return searchText.includes(query) || (compactQuery && normalized(searchText).includes(compactQuery));
  }).sort((a,b) => compareArtistsForSort(a, b, effectiveSort));
  list.innerHTML = ordered.length ? ordered.map(a => {
    const country = artistCountryInfo(a), countryLabel = artistCountryLabel(a), movement = artistMovementDisplayInfo(a).parentLabel;
    const displayName = language === 'ko' ? artistListKoreanName(a) : loc(a.name);
    const nameAttributes = uHangulArtistAttributes(a, displayName);
    const historicalCountry = country.original !== country.name;
    return `<div class="artist-row ${a.id === selectedId ? 'active':''}"><button class="artist-item" data-id="${esc(a.id)}"><span class="avatar ${historicalCountry ? 'historical-country' : ''}" style="background:${countryColor(country.colorKey)};color:${countryInk(country.colorKey)}" title="${esc(countryLabel)}" aria-label="${esc(countryLabel)}">${esc(countryAvatarText(country))}</span><span class="artist-text"><span class="artist-name"${nameAttributes}>${esc(displayName)}</span><span class="artist-years">${years(a)}${movement ? ` · ${esc(movement)}` : ''}</span></span></button>${currentUserIsAdmin ? `<button class="delete-artist" data-id="${esc(a.id)}" title="${esc(t('delete'))}" aria-label="${esc(t('delete'))}">×</button>` : ''}</div>`;
  }).join('') : `<p class="artist-search-empty">${t('noSearchResult')}</p>`;
  // Keep the active artist easy to find without touching the right-hand
  // timeline scroll position or changing the user's selection.
  if (viewMode === 'timeline' && selectedId) requestAnimationFrame(() => {
    const activeRow = list.querySelector('.artist-row.active');
    if (!activeRow) return;
    const centeredTop = activeRow.offsetTop - (list.clientHeight - activeRow.offsetHeight) / 2;
    const maximumTop = Math.max(0, list.scrollHeight - list.clientHeight);
    list.scrollTo({top:Math.max(0, Math.min(centeredTop, maximumTop)), behavior:'auto'});
  });
  list.querySelectorAll('.artist-item').forEach(button => button.onclick = async () => { viewMode = 'timeline'; selectedId = button.dataset.id; persist(); closeDetail(); const artist = artists.find(item => item.id === selectedId); await hydrateThumbnails(artist); renderList(); renderTimeline(); await enrichArtist(); });
  list.querySelectorAll('.delete-artist').forEach(button => button.onclick = async event => { event.stopPropagation(); if (!currentUserIsAdmin || !confirm(t('confirmDelete'))) return; const deleted = artists.find(artist => artist.id === button.dataset.id); artists = artists.filter(artist => artist.id !== button.dataset.id); if (selectedId === button.dataset.id) selectedId = artists[0]?.id || null; persist(); if (!await saveArtistsNow()) { artists.push(deleted); if (!selectedId) selectedId = deleted.id; alert(language === 'ko' ? '삭제 내용을 저장하지 못해 복원했습니다.' : 'The deletion could not be saved, so it was restored.'); } render(); });
  $('#artist-names').innerHTML = artists.flatMap(a => [artistListKoreanName(a), artistDisplayName(a), artistUHangulDisplayName(a), a.fullName, a.name?.ko, a.name?.en, ...artistAliases(a)]).filter(Boolean).filter((value,index,self) => self.indexOf(value) === index).map(value => `<option value="${esc(value)}"></option>`).join('');
}
function setupArtistSummaryEditor(artist) {
  const box = timeline.querySelector('.artist-summary-box');
  if (!box || !currentUserIsAdmin) return;
  const read = box.querySelector('.artist-summary-read');
  const editor = box.querySelector('.artist-summary-editor');
  const textarea = editor?.querySelector('textarea');
  const editButton = box.querySelector('.artist-summary-edit-button');
  const cancelButton = box.querySelector('.artist-summary-cancel');
  if (!read || !editor || !textarea || !editButton || !cancelButton) return;
  const showEditor = show => {
    read.classList.toggle('hidden', show);
    editor.classList.toggle('hidden', !show);
    editButton.classList.toggle('hidden', show);
    if (show) textarea.focus();
  };
  editButton.addEventListener('click', () => showEditor(true));
  cancelButton.addEventListener('click', () => {
    textarea.value = artistSummaryEditorText(artist.artistSummary);
    showEditor(false);
  });
  textarea.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || start;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const insertion = '\n- ';
    textarea.value = `${before}${insertion}${after}`;
    const nextPosition = before.length + insertion.length;
    textarea.setSelectionRange(nextPosition, nextPosition);
  });
  editor.addEventListener('submit', async event => {
    event.preventDefault();
    const previousSummary = artist.artistSummary ? JSON.parse(JSON.stringify(artist.artistSummary)) : undefined;
    setArtistSummaryLines(artist, textarea.value);
    persist();
    if (!await saveArtistsNow()) {
      if (previousSummary === undefined) delete artist.artistSummary;
      else artist.artistSummary = previousSummary;
      persist();
      alert(saveFailureMessage());
    }
    renderTimeline();
  });
}
function favoriteKey(artist, work) { return `${artist?.id || ''}::${work?.id || selectionKey(work)}`; }
function selectedFavoriteWorks() {
  const selected = [];
  artists.forEach(artist => (artist.works || []).forEach(work => {
    if (favoriteWorkKeys.has(favoriteKey(artist, work))) selected.push({artist, work});
  }));
  return selected;
}
function persistFavoriteWorks() {
  if (currentUserIsAdmin) localStorage.setItem(favoriteWorksStorageKey, JSON.stringify([...favoriteWorkKeys]));
  else localStorage.removeItem(favoriteWorksStorageKey);
  queueArtistSave();
}
function renderTimeline() {
  timeline.classList.add('artist-timeline-panel');
  const artist = artists.find(a => a.id === selectedId);
  if (!artist) {
    timeline.innerHTML = requestedArtistMissing
      ? `<p class="eyebrow">${t('timeline')}</p><h1 class="timeline-title">${language === 'ko' ? '화가 목록에 없는 항목입니다' : 'Artist not found'}</h1><p class="empty-timeline">${language === 'ko' ? '이 링크가 가리키는 화가는 현재 화가 목록에 없습니다. 미술사조 HTML의 링크를 최신 화가 목록 기준으로 다시 정리해 주세요.' : 'This link points to an artist that is not currently in the artist list.'}</p>`
      : '';
    return;
  }
  hydrateArtistProfile(artist);
  const displayWorks = selectArtistWorks(artist.works || [], artistImportedWorkLimit, artist);
  // Do not show a source record whose date falls outside the artist's lifetime.
  const uniqueWorks = new Map();
  displayWorks.forEach(work => {
    const key = `${work.title?.en || work.title?.ko || loc(work.title)}-${work.year || ''}`;
    const existing = uniqueWorks.get(key);
    uniqueWorks.set(key, existing ? {
      ...existing, ...work,
      title: existing.title || work.title,
      image: work.image || existing.image,
      thumbnail: work.thumbnail || existing.thumbnail,
      description: existing.description || work.description,
      movementContribution: Boolean(existing.movementContribution || work.movementContribution)
    } : work);
  });
  const works = [...uniqueWorks.values()]
    .filter(work => !work.year || ((!artist.birth || work.year >= artist.birth) && (!artist.death || work.year <= artist.death)))
    // Keep the public timeline visual: source records without a verified local
    // image stay in the data file for later research, but do not render empty cards.
    .filter(work => Boolean(artworkPreviewImage(work)))
    .sort((a,b) => workYearForSort(a) - workYearForSort(b));
  // Every artist uses the study-first gallery timeline.  Featured selections
  // stay on the artist record so each artist can be curated independently.
  const isLeonardoTimeline = true;
  const leonardoDefaultFeaturedWorkIds = new Set([
    'wikidata-Q1217213', // Annunciation
    'wikidata-Q215486',  // Vitruvian Man
    'wikidata-Q128910',  // The Last Supper
    'wikidata-Q12418',   // Mona Lisa
    'wikidata-Q563727'   // The Virgin and Child with Saint Anne
  ]);
  const defaultFeaturedWorks = artist.qid === 'Q762'
    ? works.filter(work => leonardoDefaultFeaturedWorkIds.has(String(work.id || '')))
    : [...works].filter(work => work.representative).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 5);
  const defaultFeaturedSelection = defaultFeaturedWorks.length ? defaultFeaturedWorks : works.slice(0, 5);
  const defaultFeaturedWorkIds = new Set(defaultFeaturedSelection.map(work => String(work.id || '')));
  // Once the administrator has selected works, an empty list deliberately
  // means no highlights.  Until then, use the curator's initial five works.
  const savedFeaturedWorkIdOrder = Array.isArray(artist.featuredWorkIds)
    ? artist.featuredWorkIds.map(String).filter(Boolean)
    : null;
  const leonardoFeaturedWorkIdOrder = savedFeaturedWorkIdOrder || [...defaultFeaturedWorkIds];
  const leonardoFeaturedWorkIds = new Set(leonardoFeaturedWorkIdOrder);
  const worksById = new Map(works.map(work => [String(work.id || ''), work]));
  const orderedFeaturedWorks = leonardoFeaturedWorkIdOrder
    .map(id => worksById.get(id))
    .filter(Boolean);
  const orderedFeaturedWorkIds = new Set(orderedFeaturedWorks.map(work => String(work.id || '')));
  const leonardoFeaturedWorks = isLeonardoTimeline
    ? [
        ...orderedFeaturedWorks,
        ...works.filter(work => {
          const id = String(work.id || '');
          return leonardoFeaturedWorkIds.has(id) && !orderedFeaturedWorkIds.has(id);
        })
      ]
    : [];
  const leonardoLayoutKey = `art-atlas-timeline-layout-${artist.qid || artist.id}`;
  const leonardoLayout = isLeonardoTimeline && sessionStorage.getItem(leonardoLayoutKey) === 'chronology'
    ? 'chronology'
    : 'gallery';
  const worksByYear = new Map();
  // A timeline row represents the year a work began.  Date ranges that share
  // the same start year therefore stay together on one horizontal row.
  works.forEach(work => { const year = work?.year || '—'; worksByYear.set(year, [...(worksByYear.get(year) || []), work]); });
  const addArtworkLinkLabel = language === 'ko' ? '해설 주소 추가' : 'Add explanation link';
  const artworkLinkInputLabel = language === 'ko' ? '유튜브 또는 해설 웹페이지 주소를 입력하세요' : 'Enter a YouTube or explanation webpage address';
  const confirmArtworkLinkLabel = language === 'ko' ? '확인' : 'Add';
  const card = w => {
    const imageInfo = artworkImageDisplay(w);
    const image = imageInfo.src;
    const primaryMovementArtwork = Boolean(
      w.movementContribution && w.movementContributionReason === 'canonical-movement-representative'
    );
    const highResSource = w.highResImage && !isExternalImageSource(w.highResImage) ? w.highResImage : '';
    const highRes = Boolean(highResSource);
    const featured = isLeonardoTimeline && leonardoFeaturedWorkIds.has(String(w.id || ''));
    const replaceLabel = language === 'ko' ? '로컬 이미지 교체' : 'Replace with local image';
    const primaryMovementArtworkLabel = language === 'ko'
      ? '사조 설명의 대표 화가·대표작'
      : 'Primary artist and representative work in the movement guide';
    const collection = artworkCollectionLabel(w);
    const collectionMarkup = collection && collection !== t('unknown') ? `<small class="art-country art-collection" title="${esc(collection)}">${esc(collection)}</small>` : '';
    const workTitle = artworkThumbnailTitle(w, artist);
    const featuredToggle = isLeonardoTimeline && currentUserIsAdmin
      ? `<label class="leonardo-feature-toggle" title="${esc(language === 'ko' ? '대표작에 표시' : 'Show in highlights')}"><input type="checkbox" data-featured-work="${esc(w.id)}"${featured ? ' checked' : ''} aria-label="${esc(language === 'ko' ? `${workTitle} 대표작에 표시` : `Show ${workTitle} in highlights`)}"><span aria-hidden="true"></span></label>`
      : '';
    const previewLabel = language === 'ko' ? `${workTitle} 크게 보기` : `Enlarge ${workTitle}`;
    const previewButton = image ? `<button class="artwork-preview-button" type="button" title="${esc(previewLabel)}" aria-label="${esc(previewLabel)}">⌕</button>` : '';
    const previewYear = workYearLabel(w) || (language === 'ko' ? '연도 미상' : 'Year unknown');
    const previewArtist = artistDisplayName(artist);
    const fallbackImage = '';
    const urlBadge = imageInfo.urlDependent ? urlDependencyBadge() : '';
    const highResBadge = highRes ? `<span class="high-resolution-badge hidden" data-highres-src="${esc(highResSource)}" title="${esc(language === 'ko' ? '고해상도 파일 확인 중' : 'Checking high-resolution file')}">Ⓗ</span>` : '';
    const wikipediaUrl = explicitArtworkWikipediaUrl(w);
    const wikipediaLabel = language === 'ko' ? '작품 위키피디아 페이지 열기' : 'Open artwork Wikipedia page';
    const wikipediaAttrs = wikipediaUrl
      ? `href="${esc(wikipediaUrl)}" title="${esc(wikipediaLabel)}"`
      : `href="#" data-wikipedia-pending="true" aria-disabled="true" title=""`;
    const titleLink = `<a class="art-title artwork-wikipedia-link" ${wikipediaAttrs} data-work="${esc(w.id)}" target="_blank" rel="noopener">${esc(workTitle)}</a>`;
    const savedArtworkLinks = artworkLinks(w);
    const artworkLinkButtons = savedArtworkLinks.map((link, index) => `<button class="artwork-link-button thumbnail-artwork-link-button${isYouTubeLink(link) ? ' artwork-link-youtube' : ''}" type="button" data-work="${esc(w.id)}" data-artwork-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index + 1}. ${link.url}`)}">${index + 1}</button>`).join('');
    const artworkLinkControls = currentUserIsAdmin || savedArtworkLinks.length
      ? `<span class="artwork-link-controls thumbnail-artwork-link-controls">${currentUserIsAdmin ? `<button class="artwork-link-add thumbnail-artwork-link-add" type="button" data-work="${esc(w.id)}" title="${esc(addArtworkLinkLabel)}" aria-label="${esc(addArtworkLinkLabel)}">+</button>` : ''}${artworkLinkButtons}</span>`
      : '';
    const artworkLinkEntry = currentUserIsAdmin ? `<form class="artwork-link-entry thumbnail-artwork-link-entry hidden" data-work="${esc(w.id)}"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(artworkLinkInputLabel)}" required><button type="submit">${esc(confirmArtworkLinkLabel)}</button></form>` : '';
    const titleMarkup = `<span class="art-title-row"><span class="art-title-with-links">${titleLink}${artworkLinkControls}</span>${highResBadge}</span>${artworkLinkEntry}`;
    const footerMarkup = collectionMarkup ? `<span class="art-card-footer">${collectionMarkup}</span>` : '';
    const controls = currentUserIsAdmin ? `<button class="delete-artwork" data-work="${esc(w.id)}" title="${esc(t('delete'))}" aria-label="${esc(t('delete'))}">×</button><button class="replace-local-image" data-work="${esc(w.id)}" title="${esc(replaceLabel)}" aria-label="${esc(replaceLabel)}">↗</button>` : '';
    return `<div class="art-card${primaryMovementArtwork ? ' primary-movement-artwork' : ''}" data-work="${esc(w.id)}" data-preview-artist="${esc(previewArtist)}" data-preview-title="${esc(workTitle)}" data-preview-year="${esc(previewYear)}" data-preview-collection="${collection && collection !== t('unknown') ? esc(collection) : ''}" title="${primaryMovementArtwork ? esc(primaryMovementArtworkLabel) : ''}"><span class="art-thumb">${featuredToggle}${image ? `<img src="${esc(image)}" alt="${esc(workTitle)}" loading="lazy"${fallbackImage ? ` data-fallback-src="${esc(fallbackImage)}"` : ''} />${urlBadge}` : `<span class="art-thumb-empty">${esc(unavailableImageLabel(work))}</span>`}${previewButton}${controls}</span><span class="art-meta">${titleMarkup}${footerMarkup}</span></div>`;
  };
  const koreanName = artist.name?.ko || '', originalName = artist.name?.en || '';
  const savedLinks = artistLinks(artist);
  const addLinkLabel = language === 'ko' ? '주소 추가' : 'Add address';
  const linkInputLabel = language === 'ko' ? '열 주소를 입력하세요' : 'Enter an address to open';
  const confirmLinkLabel = language === 'ko' ? '확인' : 'Add';
  const linkButtons = savedLinks.map((link, index) => `<button class="artist-link-button${isYouTubeLink(link) ? ' artist-link-youtube' : ''}" type="button" data-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index + 1}. ${link.url}`)}">${index + 1}</button>`).join('');
  const linkControls = `<span class="artist-link-controls">${currentUserIsAdmin ? `<button class="artist-link-add" type="button" title="${esc(addLinkLabel)}" aria-label="${esc(addLinkLabel)}">+</button>` : ''}${linkButtons}</span>`;
  const nationality = artistNationality(artist);
  const nationalityLabel = loc(nationality) ? countryDisplayLabel(nationality) : '';
  const artistMovementInfo = artistMovementDisplayInfo(artist);
  const artistMovement = artistMovementInfo.label;
  const artistMovementDocument = movementDocumentKey(artistMovementInfo.documentLabel || artistMovement);
  const artistMovementLabel = artistMovementDocument
    ? `<button class="artist-movement-link" type="button" data-movement-document="${esc(artistMovementDocument)}">${esc(artistMovement)}</button>`
    : `<span class="artist-movement-label">${esc(artistMovement)}</span>`;
  const timelineArtistName = artistDisplayName(artist);
  const timelineArtistNameMarkup = `<span class="timeline-artist-name"${uHangulArtistAttributes(artist, timelineArtistName)}>${esc(timelineArtistName)}</span>`;
  const originalArtistWikipediaUrl = artistWikipediaUrl(artist, originalName);
  const displayName = language === 'ko' && koreanName
    ? `${timelineArtistNameMarkup}${originalName && originalName !== koreanName ? ` <a class="original-artist-name" data-uh-ignore="true" href="${esc(originalArtistWikipediaUrl)}" data-artist-wiki="${esc(artist.qid || '')}">${esc(originalName)}</a>` : ''}${linkControls}`
    : `${timelineArtistNameMarkup}${linkControls}`;
  const slideshowHelp = language === 'ko' ? '전체 화면 슬라이드 쇼 시작 · 5초마다 다음 작품' : 'Start fullscreen slideshow · next artwork every 5 seconds';
  const headerActions = '';
  const timelineHeader = `<header class="timeline-sticky-header"><p class="eyebrow">${t('timeline')}</p><div class="timeline-title-row"><h1 class="timeline-title">${displayName}</h1><div class="timeline-title-actions">${headerActions}</div></div>${currentUserIsAdmin ? `<form class="artist-link-entry hidden"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(linkInputLabel)}" required><button type="submit">${esc(confirmLinkLabel)}</button></form>` : ''}<p class="life">${years(artist)}${nationalityLabel ? ` · ${esc(nationalityLabel)}` : ''}${artistMovement ? ` · ${artistMovementLabel}` : ''}</p></header>`;
  const standardYearGroups = new Map();
  [...worksByYear.entries()].forEach(([year, group]) => {
    const centuryStart = timelineCenturyStart(year);
    const key = centuryStart === null ? 'undated' : String(centuryStart);
    standardYearGroups.set(key, [...(standardYearGroups.get(key) || []), [year, group]]);
  });
  const standardTimelineSections = [...standardYearGroups.entries()]
    .sort(([left], [right]) => {
      if (left === 'undated') return 1;
      if (right === 'undated') return -1;
      return Number(left) - Number(right);
    })
    .map(([period, rows]) => `<section class="timeline-century-section"><h2 class="timeline-century-label">${esc(period === 'undated' ? (language === 'ko' ? '연도 미상' : 'Undated') : timelineCenturyLabelFromStart(Number(period)))}</h2><div class="timeline-century-rows">${rows.map(([year, group]) => `<div class="timeline-row"><span class="node"></span><span class="timeline-work-year">${esc(year)}</span><div class="artworks-at-year">${group.map(card).join('')}</div></div>`).join('')}</div></section>`);
  const standardTimelineMarkup = `<div class="timeline timeline-century-axis">${works.length ? standardTimelineSections.join('') : `<p class="empty-timeline">${t('noWork')}</p>`}</div>`;
  const leonardoTimelineMarkup = (() => {
    const galleryLabel = language === 'ko' ? '전체 작품' : 'All works';
    const chronologyLabel = language === 'ko' ? '시기별 연표' : 'By period';
    const featuredLabel = language === 'ko' ? '대표작' : 'Highlights';
    const guide = language === 'ko'
      ? '대표작을 먼저 감상한 뒤, 모든 작품을 제작 시작 연도순으로 자유롭게 훑어보세요.'
      : 'Start with key works, then browse every work in chronological order.';
    const periodGroups = new Map();
    works.forEach(work => {
      const year = Number(work.year);
      const centuryStart = timelineCenturyStart(year);
      const key = centuryStart === null ? 'undated' : String(centuryStart);
      periodGroups.set(key, [...(periodGroups.get(key) || []), work]);
    });
    const sortedPeriodGroups = [...periodGroups.entries()].sort(([left], [right]) => {
      if (left === 'undated') return 1;
      if (right === 'undated') return -1;
      return Number(left) - Number(right);
    });
    const gallery = `<div class="leonardo-work-grid">${works.map(card).join('')}</div>`;
    const chronology = `<div class="leonardo-period-list artist-century-timeline">${sortedPeriodGroups.map(([period, group]) => `<section class="leonardo-period artist-century-section"><h2>${esc(period === 'undated' ? (language === 'ko' ? '연도 미상' : 'Undated') : timelineCenturyLabelFromStart(Number(period)))}</h2><div class="leonardo-work-grid">${group.map(card).join('')}</div></section>`).join('')}</div>`;
    const slideshowButton = (scope, label) => `<button class="start-slideshow leonardo-section-slideshow" type="button" data-slideshow-scope="${scope}" aria-label="${esc(label)}" title="${esc(label)}"><span>▶</span><span>${esc(t('slideshow'))}</span></button>`;
    const layoutControls = `<div class="leonardo-layout-controls" role="group" aria-label="${esc(language === 'ko' ? '작품 보기 방식' : 'Artwork view')}"><button class="leonardo-layout-button${leonardoLayout === 'gallery' ? ' active' : ''}" type="button" data-leonardo-layout="gallery">${esc(galleryLabel)}</button><button class="leonardo-layout-button${leonardoLayout === 'chronology' ? ' active' : ''}" type="button" data-leonardo-layout="chronology">${esc(chronologyLabel)}</button></div><p class="leonardo-layout-guide">${esc(guide)}</p>`;
    const canDragFeaturedWorks = currentUserIsAdmin && leonardoFeaturedWorks.length > 1;
    const summaryLines = localizedLines(artist.artistSummary);
    const summaryTitle = language === 'ko' ? '화가 해설' : 'Artist Notes';
    const summaryEditLabel = language === 'ko' ? '편집' : 'Edit';
    const summarySaveLabel = language === 'ko' ? '저장' : 'Save';
    const summaryCancelLabel = language === 'ko' ? '취소' : 'Cancel';
    const summaryHelp = language === 'ko' ? '항목 수 제한 없이 입력할 수 있습니다. Enter를 누르면 새 불릿이 생기고, 빈 항목은 저장할 때 제거됩니다.' : 'Add as many items as needed. Press Enter to add a new bullet; blank items are removed when saved.';
    const summaryPlaceholder = language === 'ko'
      ? '화가가 무엇을 그렸고, 어떤 기법과 영향을 받았으며, 어떻게 평가되는지 적어 주세요.'
      : 'Describe subjects, techniques, influences, reception, and later impact.';
    const summaryBody = summaryLines.length
      ? `<ul class="artist-summary-lines">${summaryLines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>`
      : `<p class="artist-summary-empty">${esc(language === 'ko' ? '아직 화가 해설이 없습니다.' : 'No artist notes yet.')}</p>`;
    const summaryBox = `<section class="artist-summary-box"><div class="artist-summary-heading"><p class="eyebrow">${esc(summaryTitle)}</p>${currentUserIsAdmin ? `<button class="artist-summary-edit-button" type="button">${esc(summaryEditLabel)}</button>` : ''}</div><div class="artist-summary-read">${summaryBody}</div>${currentUserIsAdmin ? `<form class="artist-summary-editor hidden"><textarea rows="6" aria-label="${esc(summaryTitle)}" placeholder="${esc(summaryPlaceholder)}">${esc(artistSummaryEditorText(summaryLines))}</textarea><p>${esc(summaryHelp)}</p><div><button type="button" class="artist-summary-cancel">${esc(summaryCancelLabel)}</button><button type="submit">${esc(summarySaveLabel)}</button></div></form>` : ''}</section>`;
    const featured = leonardoFeaturedWorks.length ? `<section class="leonardo-featured"><div class="leonardo-section-heading"><p class="eyebrow">${esc(featuredLabel)}</p><div class="leonardo-section-actions">${slideshowButton('featured', language === 'ko' ? '대표작 슬라이드 쇼 시작' : 'Start highlights slideshow')}</div><p>${esc(language === 'ko' ? '우선 크게 살펴볼 작품입니다. Ⓗ 표시는 고해상도 파일이 있음을 뜻하며, 이미지를 더블클릭하면 새 창에서 엽니다.' : 'A small set of works to study first. Ⓗ marks an available high-resolution file; double-click the image to open it.')}</p></div><div class="leonardo-featured-grid">${leonardoFeaturedWorks.map(work => `<div class="leonardo-featured-card" data-featured-work="${esc(work.id)}"${canDragFeaturedWorks ? ' draggable="true"' : ''}>${card(work)}</div>`).join('')}</div></section>` : '';
    const allWorksAction = `${slideshowButton('all', language === 'ko' ? '전체 작품 슬라이드 쇼 시작' : 'Start all-works slideshow')}${currentUserIsAdmin ? `<button class="add-artwork-button leonardo-section-add-artwork" type="button" title="${esc(t('addArtwork'))}" aria-label="${esc(t('addArtwork'))}"><span>+</span><span>${esc(t('addArtwork'))}</span></button>` : ''}`;
    return `<div class="leonardo-timeline">${summaryBox}${featured}${layoutControls}<section class="leonardo-all-works"><div class="leonardo-section-heading"><p class="eyebrow">${esc(leonardoLayout === 'gallery' ? galleryLabel : chronologyLabel)}</p><div class="leonardo-section-actions">${allWorksAction}</div><p>${esc(language === 'ko' ? `${works.length}점 · 왼쪽 위에서 오른쪽 아래로 갈수록 뒤의 작품입니다.` : `${works.length} works · Earlier works begin at the upper left.`)}</p></div>${leonardoLayout === 'gallery' ? gallery : chronology}</section></div>`;
  })();
  timeline.innerHTML = `${timelineHeader}${leonardoTimelineMarkup}`;
  setupArtistSummaryEditor(artist);
  timeline.querySelector('.add-artwork-button')?.addEventListener('click', () => openAddArtworkDialog(artist));
  timeline.querySelectorAll('.start-slideshow').forEach(button => button.onclick = () => startSlideshow(artist, button.dataset.slideshowScope === 'featured' ? leonardoFeaturedWorks : works));
  timeline.querySelectorAll('.leonardo-layout-button').forEach(button => button.addEventListener('click', () => {
    sessionStorage.setItem(leonardoLayoutKey, button.dataset.leonardoLayout || 'gallery');
    renderTimeline();
  }));
  timeline.querySelectorAll('.leonardo-feature-toggle input').forEach(input => {
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('change', async event => {
      event.stopPropagation();
      const workId = String(input.dataset.featuredWork || '');
      if (!workId) return;
      const hadSavedSelection = Object.prototype.hasOwnProperty.call(artist, 'featuredWorkIds');
      const previousSelection = artist.featuredWorkIds;
      const selected = new Set(Array.isArray(previousSelection) ? previousSelection.map(String) : defaultFeaturedWorkIds);
      if (input.checked) selected.add(workId);
      else selected.delete(workId);
      artist.featuredWorkIds = [...selected];
      persist();
      if (!await saveArtistsNow()) {
        if (hadSavedSelection) artist.featuredWorkIds = previousSelection;
        else delete artist.featuredWorkIds;
        alert(saveFailureMessage());
      }
      renderTimeline();
    });
  });
  const featuredGrid = timeline.querySelector('.leonardo-featured-grid');
  if (featuredGrid && currentUserIsAdmin) {
    const featuredCards = [...featuredGrid.querySelectorAll('.leonardo-featured-card')];
    const featuredOrder = () => [...featuredGrid.querySelectorAll('.leonardo-featured-card')]
      .map(item => String(item.dataset.featuredWork || ''))
      .filter(Boolean);
    const dropTargetForFeaturedWork = (x, y) => {
      const siblings = [...featuredGrid.querySelectorAll('.leonardo-featured-card:not(.featured-work-dragging)')];
      return siblings.find(item => {
        const box = item.getBoundingClientRect();
        return y < box.top + box.height / 2 || (y <= box.bottom && x < box.left + box.width / 2);
      }) || null;
    };
    let draggedFeaturedCard = null;
    let dragStartOrder = '';
    featuredCards.forEach(cardElement => {
      if (featuredCards.length < 2) return;
      cardElement.addEventListener('dragstart', event => {
        if (event.target.closest('button, input, label, a, form')) {
          event.preventDefault();
          return;
        }
        draggedFeaturedCard = cardElement;
        dragStartOrder = featuredOrder().join('\u001f');
        cardElement.classList.add('featured-work-dragging');
        featuredGrid.classList.add('featured-work-grid-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(cardElement.dataset.featuredWork || ''));
      });
      cardElement.addEventListener('dragend', async () => {
        const dragged = draggedFeaturedCard;
        draggedFeaturedCard = null;
        featuredGrid.classList.remove('featured-work-grid-dragging');
        if (dragged) dragged.classList.remove('featured-work-dragging');
        const nextOrder = featuredOrder();
        if (!nextOrder.length || dragStartOrder === nextOrder.join('\u001f')) return;
        const hadSavedSelection = Object.prototype.hasOwnProperty.call(artist, 'featuredWorkIds');
        const previousSelection = artist.featuredWorkIds;
        artist.featuredWorkIds = nextOrder;
        persist();
        if (!await saveArtistsNow()) {
          if (hadSavedSelection) artist.featuredWorkIds = previousSelection;
          else delete artist.featuredWorkIds;
          alert(saveFailureMessage());
        }
        renderTimeline();
      });
    });
    featuredGrid.addEventListener('dragover', event => {
      if (!draggedFeaturedCard) return;
      event.preventDefault();
      const before = dropTargetForFeaturedWork(event.clientX, event.clientY);
      if (before && before !== draggedFeaturedCard) featuredGrid.insertBefore(draggedFeaturedCard, before);
      else if (!before) featuredGrid.appendChild(draggedFeaturedCard);
    });
  }
  timeline.querySelector('.artist-movement-link')?.addEventListener('click', () => openMovementDocument(artistMovementDocument, '1', artistMovement));
  const linkEntry = timeline.querySelector('.artist-link-entry');
  timeline.querySelector('.artist-link-add')?.addEventListener('click', () => { linkEntry.classList.toggle('hidden'); if (!linkEntry.classList.contains('hidden')) linkEntry.querySelector('input').focus(); });
  if (linkEntry) linkEntry.onsubmit = async event => {
    event.preventDefault();
    const input = linkEntry.querySelector('input');
    let url;
    try {
      url = new URL(input.value.trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    } catch (_) {
      input.setCustomValidity(language === 'ko' ? 'http 또는 https 주소를 입력하세요.' : 'Enter an http or https address.');
      input.reportValidity();
      input.setCustomValidity('');
      return;
    }
    const previousLinks = artist.links;
    artist.links = [...artistLinks(artist), {url:url.href}];
    persist();
    if (!await saveArtistsNow()) {
      artist.links = previousLinks;
      alert(saveFailureMessage());
    }
    renderTimeline();
  };
  setupSortableLinkButtons(timeline, {
    selector:'.artist-link-button',
    controlsSelector:'.artist-link-controls',
    indexAttribute:'linkIndex',
    getLinks:() => artistLinks(artist),
    setLinks:links => { artist.links = links.map(link => ({...link})); },
    render:renderTimeline,
    contextMenu:(event, index) => showArtistLinkMenu(event, artist, index)
  });
  timeline.querySelectorAll('.replace-local-image').forEach(button => button.onclick = event => { event.stopPropagation(); const work=artist.works.find(item=>item.id===button.dataset.work); if(!work) return; const input=document.createElement('input'); input.type='file'; input.accept='image/jpeg,image/png,image/webp,image/gif'; input.onchange=async () => { const file=input.files?.[0]; if(!file) return; button.classList.add('searching'); try { await uploadLocalArtworkImage(artist,work,file); renderTimeline(); } catch(error) { alert((language === 'ko' ? '이미지 교체 실패: ' : 'Image replacement failed: ') + error.message); } finally { button.classList.remove('searching'); } }; input.click(); });
  timeline.querySelectorAll('.delete-artwork').forEach(button => button.onclick = async event => { event.stopPropagation(); const work = artist.works.find(item => item.id === button.dataset.work); if (!work || !confirm(t('confirmDeleteWork'))) return; artist.works = (artist.works || []).filter(item => item.id !== work.id); favoriteWorkKeys.delete(favoriteKey(artist, work)); persist(); if (!await saveArtistsNow()) return alert(saveFailureMessage()); closeDetail(); render(); });
  setupArtworkWikipediaLinks(artist, works);
  setupThumbnailArtworkLinks(artist, works);
  setupArtworkImageFallbacks();
  setupHighResolutionBadges(artist, works);
  setupArtworkHoverPreview();
  if (currentUserIsAdmin) runThumbnailAgent();
}
function setupThumbnailArtworkLinks(artist, works) {
  const worksById = new Map((works || []).map(work => [String(work.id || ''), work]));
  const workForButton = button => worksById.get(String(button?.dataset?.work || ''));
  timeline.querySelectorAll('.thumbnail-artwork-link-add').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const card = button.closest('.art-card');
      const entry = card?.querySelector('.thumbnail-artwork-link-entry');
      if (!entry) return;
      entry.classList.toggle('hidden');
      if (!entry.classList.contains('hidden')) entry.querySelector('input')?.focus();
    });
  });
  timeline.querySelectorAll('.thumbnail-artwork-link-entry').forEach(entry => {
    entry.onsubmit = async event => {
      event.preventDefault();
      const work = worksById.get(String(entry.dataset.work || ''));
      const input = entry.querySelector('input');
      if (!work || !input) return;
      let url;
      try {
        url = new URL(input.value.trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
      } catch (_) {
        input.setCustomValidity(language === 'ko' ? 'http 또는 https 주소를 입력하세요.' : 'Enter an http or https address.');
        input.reportValidity();
        input.setCustomValidity('');
        return;
      }
      const previousLinks = artworkLinks(work);
      setArtworkLinks(artist, work, [...previousLinks, {url:url.href}]);
      persist();
      if (!await saveArtistsNow()) {
        setArtworkLinks(artist, work, previousLinks);
        persist();
        alert(saveFailureMessage());
      }
      renderTimeline();
    };
  });
  setupSortableLinkButtons(timeline, {
    selector:'.thumbnail-artwork-link-button',
    controlsSelector:'.thumbnail-artwork-link-controls',
    indexAttribute:'artworkLinkIndex',
    getLinks:button => artworkLinks(workForButton(button)),
    setLinks:(links, button) => { const work = workForButton(button); if (work) setArtworkLinks(artist, work, links); },
    render:renderTimeline,
    contextMenu:(event, index, button) => {
      const work = workForButton(button);
      if (work) showArtworkLinkMenu(event, artist, work, index, renderTimeline);
    }
  });
}
function setupArtworkImageFallbacks() {
  timeline.querySelectorAll('.art-thumb img[data-fallback-src]').forEach(image => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.fallbackSrc || '';
      if (!fallback || image.dataset.fallbackApplied === 'true') return;
      image.dataset.fallbackApplied = 'true';
      image.src = fallback;
    });
  });
}
function setupArtworkWikipediaLinks(artist, works) {
  const worksById = new Map((works || []).map(work => [String(work.id || ''), work]));
  const unavailableLabel = language === 'ko' ? '작품 위키피디아 페이지가 확인되지 않았습니다.' : 'No artwork Wikipedia page was confirmed.';
  const wikipediaLabel = language === 'ko' ? '작품 위키피디아 페이지 열기' : 'Open artwork Wikipedia page';
  timeline.querySelectorAll('.artwork-wikipedia-link[data-wikipedia-pending="true"]').forEach(link => {
    const work = worksById.get(String(link.dataset.work || ''));
    if (!work) return;
    cachedArtworkWikipediaUrl(work, artist).then(url => {
      if (!link.isConnected) return;
      if (!url) {
        const title = document.createElement('strong');
        title.className = 'art-title';
        title.textContent = link.textContent;
        title.title = unavailableLabel;
        link.replaceWith(title);
        return;
      }
      link.href = url;
      link.title = wikipediaLabel;
      link.removeAttribute('data-wikipedia-pending');
      link.removeAttribute('aria-disabled');
    });
  });
}
function highResolutionImageWidth(src) {
  const key = String(src || '');
  if (!key) return Promise.resolve(0);
  if (!highResolutionWidthChecks.has(key)) {
    highResolutionWidthChecks.set(key, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth || 0);
      image.onerror = () => resolve(0);
      image.src = key;
    }));
  }
  return highResolutionWidthChecks.get(key);
}
function setupHighResolutionBadges(artist, works) {
  const label = language === 'ko'
    ? `가로 ${highResolutionMinimumWidth}px 이상 고해상도 이미지입니다. 이미지를 더블클릭하면 새 창에서 엽니다.`
    : `High-resolution image at least ${highResolutionMinimumWidth}px wide. Double-click the image to open it in a new window.`;
  const worksById = new Map((works || []).map(work => [String(work.id || ''), work]));
  timeline.querySelectorAll('.art-card[data-work]').forEach(card => {
    const work = worksById.get(String(card.dataset.work || ''));
    const image = card.querySelector('.art-thumb img');
    const highResSource = work?.highResImage && !isExternalImageSource(work.highResImage) ? work.highResImage : '';
    if (!highResSource || !image) return;
    highResolutionImageWidth(highResSource).then(width => {
      if (!image.isConnected || width < highResolutionMinimumWidth) return;
      image.classList.add('high-resolution-artwork');
      image.title = `${label} (${width}px)`;
      const badge = card.querySelector('.high-resolution-badge[data-highres-src]');
      if (badge) {
        badge.classList.remove('hidden');
        badge.title = `${label} (${width}px)`;
      }
      image.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();
        openArtworkImageWindow(highResSource, artworkDisplayTitle(work), {artist:artistDisplayName(artist), title:artworkDisplayTitle(work), year:workYearLabel(work)});
      });
    });
  });
}
function setupArtworkHoverPreview() {
  if (!artworkHoverPreview) {
    artworkHoverPreview = document.createElement('div');
    artworkHoverPreview.className = 'artwork-hover-preview hidden';
    artworkHoverPreview.innerHTML = '<img alt=""><div class="artwork-hover-caption"><span class="artwork-hover-main"></span><span class="artwork-hover-collection"></span></div>';
    document.body.append(artworkHoverPreview);
  }
  const previewImage = artworkHoverPreview.querySelector('img');
  const previewMain = artworkHoverPreview.querySelector('.artwork-hover-main');
  const previewCollection = artworkHoverPreview.querySelector('.artwork-hover-collection');
  const hide = () => artworkHoverPreview.classList.add('hidden');
  timeline.querySelectorAll('.art-thumb').forEach(thumb => {
    const image = thumb.querySelector('img');
    const button = thumb.querySelector('.artwork-preview-button');
    if (!image || !button) return;
    button.addEventListener('mouseenter', () => {
      const workId = thumb.closest('.art-card')?.dataset.work || '';
      const rect = thumb.getBoundingClientRect();
      const captionHeight = 44;
      const scale = Math.min(6, (window.innerWidth - 30) / rect.width, (window.innerHeight - captionHeight - 20) / rect.height) * .96;
      const previewWidth = rect.width * scale, imageHeight = rect.height * scale, previewHeight = imageHeight + captionHeight, gap = 14;
      const preferRight = rect.right + gap + previewWidth <= window.innerWidth - 10;
      const left = preferRight ? rect.right + gap : Math.max(10, rect.left - gap - previewWidth);
      const top = Math.max(10, Math.min(window.innerHeight - previewHeight - 10, rect.top - (previewHeight - rect.height) / 2));
      const card = thumb.closest('.art-card');
      const artist = artists.find(item => item.id === selectedId);
      const work = artist?.works?.find(item => item.id === card?.dataset.work);
      previewImage.src = image.currentSrc || image.src;
      previewImage.alt = image.alt;
      previewImage.style.height = `${imageHeight}px`;
      const artistLabel = card?.dataset.previewArtist || (artist ? artistDisplayName(artist) : '');
      const titleLabel = card?.dataset.previewTitle || (work ? loc(work.title) : image.alt);
      const yearLabel = card?.dataset.previewYear || workYearLabel(work) || (language === 'ko' ? '연도 미상' : 'Year unknown');
      const collectionLabel = card?.dataset.previewCollection || '';
      previewMain.textContent = [artistLabel, titleLabel, yearLabel].filter(Boolean).join(' · ');
      previewCollection.textContent = collectionLabel;
      previewCollection.classList.toggle('hidden', !collectionLabel);
      artworkHoverPreview.style.width = `${previewWidth}px`;
      artworkHoverPreview.style.height = `${previewHeight}px`;
      artworkHoverPreview.style.left = `${left}px`;
      artworkHoverPreview.style.top = `${top}px`;
      artworkHoverPreview.dataset.work = workId;
      artworkHoverPreview.classList.remove('hidden');
    });
    button.addEventListener('mouseleave', hide);
  });
}
const atlasHistoricalEvents = [
  {id:'printing-press',start:1450,name:{ko:'인쇄술의 확산',en:'Printing press spreads'},impact:{ko:'판화·도상·이론서의 대량 유통을 촉진했습니다.',en:'Accelerated the circulation of prints, images, and art theory.'}},
  {id:'fall-constantinople',start:1453,name:{ko:'콘스탄티노폴리스 함락',en:'Fall of Constantinople'},impact:{ko:'그리스어 고전 문헌과 학자들의 이탈리아 유입을 촉진했습니다.',en:'Helped bring Greek texts and scholars into Italian humanist circles.'}},
  {id:'reformation',start:1517,name:{ko:'종교 개혁',en:'Protestant Reformation'},impact:{ko:'성상 논쟁과 후원 구조 변화로 북유럽 종교 이미지의 역할을 바꾸었습니다.',en:'Reshaped religious imagery and patronage through iconoclasm and reform.'}},
  {id:'sack-of-rome',start:1527,name:{ko:'로마 약탈',en:'Sack of Rome'},impact:{ko:'황제군의 약탈은 교황권과 로마의 미술 후원 체계를 흔들고 화가들의 이동을 촉진해, 전성기 르네상스 이후 매너리즘의 불안정한 분위기를 강화했습니다.',en:'The imperial sack destabilized papal authority and Roman patronage, dispersing artists and intensifying the unsettled climate of Mannerism after the High Renaissance.'}},
  {id:'council-trent',start:1545,end:1563,name:{ko:'트리엔트 공의회',en:'Council of Trent'},impact:{ko:'가톨릭 미술의 명료성·감정성·교화 기능을 강화했습니다.',en:'Encouraged clarity, emotion, and didactic purpose in Catholic art.'}},
  {id:'scientific-revolution',start:1540,end:1700,name:{ko:'과학혁명',en:'Scientific Revolution'},impact:{ko:'관찰·실험·측정의 문화가 자연, 시각, 지식 재현의 방식을 새롭게 했습니다.',en:'Its culture of observation, experiment, and measurement reshaped ways of seeing nature and knowledge.'}},
  {id:'thirty-years-war',start:1618,end:1648,name:{ko:'30년 전쟁',en:'Thirty Years’ War'},impact:{ko:'유럽의 종교·정치 질서와 궁정·교회 후원을 크게 재편했습니다.',en:'Reordered European politics, religion, and systems of patronage.'}},
  {id:'italian-plague-1629',start:1629,end:1631,name:{ko:'이탈리아 페스트 유행',en:'Italian plague epidemic'},impact:{ko:'북부 이탈리아의 인구·도시 경제·후원망에 큰 충격을 주어 바로크 미술의 제작과 수요 환경에도 영향을 미쳤습니다.',en:'It disrupted population, urban economies, and patronage networks in northern Italy, affecting Baroque production and demand.'}},
  {id:'royal-academy',start:1648,name:{ko:'프랑스 왕립회화조각아카데미 설립',en:'French Royal Academy founded'},impact:{ko:'아카데미 교육·살롱·장르 위계의 제도적 기반이 되었습니다.',en:'Established academic training, Salons, and the hierarchy of genres.'}},
  {id:'great-plague-london',start:1665,end:1666,name:{ko:'런던 대페스트',en:'Great Plague of London'},impact:{ko:'도시 인구와 공공생활의 위기는 런던의 건축·출판·시각문화 환경을 일시적으로 크게 바꾸었습니다.',en:'The crisis in population and public life temporarily reshaped London’s architecture, publishing, and visual culture.'}},
  {id:'enlightenment',start:1680,end:1789,name:{ko:'계몽주의',en:'Enlightenment'},impact:{ko:'이성·공공성·고전 고대에 대한 관심이 신고전주의와 공적 미술 담론의 토대가 되었습니다.',en:'Its emphasis on reason, the public sphere, and classical antiquity helped ground Neoclassicism and public-art discourse.'}},
  {id:'marseille-plague',start:1720,end:1722,name:{ko:'마르세유 대페스트',en:'Great Plague of Marseille'},impact:{ko:'지중해 무역항의 검역·교역·도시 생활을 흔들어 프랑스 남부의 경제와 시각문화 유통에 영향을 주었습니다.',en:'It disrupted quarantine, trade, and urban life at a Mediterranean port, affecting southern French economies and visual circulation.'}},
  {id:'herculaneum-excavations',start:1738,name:{ko:'헤르쿨라네움 발굴 시작',en:'Excavations at Herculaneum begin'},impact:{ko:'고대 로마 미술과 장식에 대한 직접적 관심을 높여 신고전주의의 고고학적 토대를 넓혔습니다.',en:'Heightened direct interest in Roman art and decoration, expanding Neoclassicism’s archaeological foundation.'}},
  {id:'pompeii-excavations',start:1748,name:{ko:'폼페이 발굴 시작',en:'Excavations at Pompeii begin'},impact:{ko:'고대 벽화·건축·일상 문화의 발견이 유럽의 신고전주의 양식과 장식 예술에 영향을 주었습니다.',en:'Discoveries of ancient murals, architecture, and daily life influenced European Neoclassicism and decorative arts.'}},
  {id:'industrial-revolution',start:1760,end:1840,name:{ko:'산업혁명',en:'Industrial Revolution'},impact:{ko:'도시화·새 계층·새 재료가 미술의 주제와 시장을 바꾸었습니다.',en:'Urbanisation, new classes, and new materials changed art subjects and markets.'}},
  {id:'american-revolution',start:1775,end:1783,name:{ko:'미국 독립혁명',en:'American Revolution'},impact:{ko:'공화주의와 시민적 역사화의 상징 언어를 확산했습니다.',en:'Spread republican and civic imagery in history painting.'}},
  {id:'french-revolution',start:1789,end:1799,name:{ko:'프랑스 혁명',en:'French Revolution'},impact:{ko:'왕정 후원과 공공 이미지의 체계를 뒤흔들고 신고전주의 정치미술을 부각했습니다.',en:'Disrupted royal patronage and made Neoclassical political imagery central.'}},
  {id:'congress-vienna',start:1815,name:{ko:'빈 체제 성립',en:'Congress of Vienna order'},impact:{ko:'나폴레옹 전쟁 이후 독일 연방과 복고 질서가 형성되어 독일 낭만주의·비더마이어의 정치적 배경이 되었습니다.',en:'After the Napoleonic Wars, the German Confederation and Restoration order framed German Romanticism and Biedermeier culture.'}},
  {id:'metternich-system',start:1815,end:1848,name:{ko:'메테르니히 체제',en:'Metternich system'},impact:{ko:'검열과 보수적 질서가 공적 정치 표현을 억제하면서 사적 실내문화, 풍경, 시민적 일상에 대한 관심을 강화했습니다.',en:'Censorship and conservative order constrained public politics while intensifying interest in private interiors, landscape, and bourgeois everyday life.'}},
  {id:'railway-expansion',start:1830,end:1870,name:{ko:'철도의 보급',en:'Railway expansion'},impact:{ko:'사람·상품·이미지의 이동 속도를 높이고 도시화와 관광, 풍경을 바라보는 감각을 바꾸었습니다.',en:'It accelerated the movement of people, goods, and images, reshaping urbanisation, tourism, and perceptions of landscape.'}},
  {id:'july-revolution',start:1830,name:{ko:'프랑스 7월 혁명',en:'July Revolution in France'}},
  {id:'victorian-era',start:1837,end:1901,name:{ko:'빅토리아 시대',en:'Victorian era'},impact:{ko:'산업화·제국주의·도덕관·디자인 개혁이 라파엘 전파와 유미주의의 배경이 되었습니다.',en:'Industrialisation, empire, morality, and design reform framed the Pre-Raphaelites and Aestheticism.'}},
  {id:'february-revolution',start:1848,name:{ko:'프랑스 2월 혁명',en:'February Revolution in France'}},
  {id:'german-revolutions-1848',start:1848,end:1849,name:{ko:'독일 3월 혁명',en:'German revolutions of 1848-1849'},impact:{ko:'자유주의와 민족통일 요구가 폭발하며 비더마이어 이후의 시민사회, 정치 풍자, 사실주의적 문제의식을 자극했습니다.',en:'Liberal and national-unification demands reshaped civic culture, political satire, and realist social concerns after Biedermeier.'}},
  {id:'photography',start:1839,name:{ko:'사진술 공표',en:'Photography announced'},impact:{ko:'재현의 역할을 재정의하고 사실주의·인상주의의 시각 언어에 영향을 주었습니다.',en:'Redefined representation and influenced Realism and Impressionist vision.'}},
  {id:'camera-adoption',start:1840,end:1880,name:{ko:'사진기의 보급',en:'Camera adoption'},impact:{ko:'초상·기록·보도의 이미지 생산과 유통을 넓혀 회화와 대중 시각문화의 관계를 새롭게 만들었습니다.',en:'It expanded image-making and circulation for portraiture, documentation, and news, reshaping painting’s relationship with mass visual culture.'}},
  {id:'paint-tube',start:1841,name:{ko:'튜브 유화 물감 특허',en:'Oil paint tube patented'},impact:{ko:'야외 제작을 실용화해 인상주의의 작업 방식을 뒷받침했습니다.',en:'Made portable outdoor painting practical and supported Impressionist practice.'}},
  {id:'great-exhibition',start:1851,name:{ko:'런던 만국박람회',en:'Great Exhibition'},impact:{ko:'산업 디자인·재료·전시 문화에 대한 관심을 높였습니다.',en:'Elevated attention to industrial design, materials, and exhibition culture.'}},
  {id:'napoleon-iii-accession',start:1852,name:{ko:'나폴레옹 3세 즉위',en:'Napoleon III becomes Emperor'},impact:{ko:'제2제정기의 대규모 도시 정비·살롱 제도·국가 후원이 파리의 미술 환경을 크게 바꾸었습니다.',en:'Second Empire urban renewal, the Salon system, and state patronage profoundly reshaped Paris’s art world.'}},
  {id:'paris-commune',start:1871,name:{ko:'파리 코뮌',en:'Paris Commune'},impact:{ko:'파리의 정치·도시 문화와 예술가들의 사회적 참여 논쟁에 영향을 주었습니다.',en:'Affected Parisian political culture and debates over artists’ civic roles.'}},
  {id:'franco-prussian-war',start:1870,end:1871,name:{ko:'보불 전쟁',en:'Franco-Prussian War'},impact:{ko:'프랑스 제2제정 붕괴와 파리의 문화·제도 변화를 가져왔습니다.',en:'Brought the collapse of the Second Empire and transformed Parisian institutions.'}},
  {id:'cinema',start:1895,name:{ko:'영화의 공개 상영',en:'Public cinema screening'},impact:{ko:'움직임·시간·대중 시각문화에 대한 새로운 감각을 만들었습니다.',en:'Created new ways of seeing movement, time, and mass visual culture.'}},
  {id:'interpretation-of-dreams',start:1900,name:{ko:'프로이트 『꿈의 해석』 출간',en:'Freud publishes The Interpretation of Dreams'},impact:{ko:'무의식·꿈·욕망에 대한 관심을 확산시켜 초현실주의의 사상적 배경이 되었습니다.',en:'Popularised ideas of the unconscious, dreams, and desire that informed Surrealism.'}},
  {id:'world-war-i',start:1914,end:1918,name:{ko:'제1차 세계대전',en:'World War I'},impact:{ko:'전쟁 경험은 다다·표현주의·전위예술의 급진화를 촉발했습니다.',en:'War experience radicalised Dada, Expressionism, and the avant-garde.'}},
  {id:'russian-revolution',start:1917,name:{ko:'러시아 혁명',en:'Russian Revolution'},impact:{ko:'구성주의와 생산주의를 포함한 예술·디자인의 사회적 역할을 재정의했습니다.',en:'Redefined art and design’s social role through Constructivism and Productivism.'}},
  {id:'bauhaus',start:1919,name:{ko:'바우하우스 설립',en:'Bauhaus founded'},impact:{ko:'미술·공예·건축·산업 디자인의 통합 교육을 확산했습니다.',en:'Advanced integrated teaching across art, craft, architecture, and design.'}},
  {id:'great-depression',start:1929,end:1939,name:{ko:'대공황',en:'Great Depression'},impact:{ko:'공공미술 사업과 사회 현실을 다루는 미술을 확대했습니다.',en:'Expanded public-art programmes and socially engaged art.'}},
  {id:'world-war-ii',start:1939,end:1945,name:{ko:'제2차 세계대전',en:'World War II'},impact:{ko:'망명·파괴·전후 질서가 추상과 국제 미술 중심의 이동에 영향을 주었습니다.',en:'Exile, destruction, and postwar order reshaped abstraction and art centres.'}},
  {id:'television',start:1951,name:{ko:'텔레비전 대중화',en:'Television mass adoption'},impact:{ko:'대중매체 이미지가 팝아트와 비디오아트의 주요 재료가 되었습니다.',en:'Mass-media imagery became material for Pop Art and video art.'}},
  {id:'may-1968',start:1968,name:{ko:'1968년 5월 운동',en:'May 1968 protests'},impact:{ko:'제도 비판·참여·페미니즘·개념미술의 사회적 맥락을 강화했습니다.',en:'Strengthened social contexts for institutional critique, participation, and feminism.'}},
  {id:'moon-landing',start:1969,name:{ko:'달 착륙',en:'Moon landing'},impact:{ko:'기술·과학·지구 이미지에 대한 새로운 상상력을 자극했습니다.',en:'Stimulated new artistic imaginations of technology, science, and Earth.'}},
  {id:'berlin-wall',start:1989,name:{ko:'베를린 장벽 붕괴',en:'Fall of the Berlin Wall'},impact:{ko:'동서유럽 미술계의 교류와 전시 지형을 재편했습니다.',en:'Reconfigured exchange and exhibition networks across Europe.'}},
  {id:'world-wide-web',start:1991,name:{ko:'월드 와이드 웹 공개',en:'World Wide Web released'},impact:{ko:'넷아트와 온라인 유통·참여형 작업의 기반을 만들었습니다.',en:'Enabled net art, online circulation, and participatory practices.'}},
  {id:'september-11',start:2001,name:{ko:'9·11 테러',en:'September 11 attacks'},impact:{ko:'전쟁·감시·이주를 다루는 동시대 미술의 문제의식을 강화했습니다.',en:'Intensified contemporary art’s engagement with war, surveillance, and migration.'}},
  {id:'smartphone',start:2007,name:{ko:'스마트폰 시대의 시작',en:'Smartphone era begins'},impact:{ko:'이미지 제작·공유·관람의 일상적 경로를 바꾸었습니다.',en:'Changed everyday production, sharing, and viewing of images.'}},
  {id:'covid-19',start:2020,end:2023,name:{ko:'코로나19 팬데믹',en:'COVID-19 pandemic'},impact:{ko:'온라인 전시·원격 협업·디지털 관람을 빠르게 확산했습니다.',en:'Accelerated online exhibitions, remote collaboration, and digital viewing.'}},
  {id:'generative-ai',start:2022,name:{ko:'생성형 AI의 대중화',en:'Generative AI mainstreaming'},impact:{ko:'저작·창작·이미지 생산의 경계를 둘러싼 논의를 확장했습니다.',en:'Expanded debates over authorship, creativity, and image production.'}}
];
const religiousThoughtEventIds = new Set(['reformation', 'council-trent', 'enlightenment', 'interpretation-of-dreams']);
const scienceEconomyEventIds = new Set(['printing-press', 'italian-plague-1629', 'scientific-revolution', 'great-plague-london', 'marseille-plague', 'industrial-revolution', 'railway-expansion', 'camera-adoption', 'great-depression', 'moon-landing', 'covid-19']);
const artEventIds = new Set(['royal-academy', 'herculaneum-excavations', 'pompeii-excavations', 'photography', 'paint-tube', 'great-exhibition', 'cinema', 'bauhaus', 'television', 'world-wide-web', 'smartphone', 'generative-ai']);
const historicalEventCategory = event => {
  if (historicalEventCategories.includes(event?.category)) return event.category;
  if (religiousThoughtEventIds.has(event?.id)) return 'religion-thought';
  if (scienceEconomyEventIds.has(event?.id)) return 'science-economy';
  if (artEventIds.has(event?.id)) return 'art';
  return 'history';
};
const historicalEventCategoryLabel = category => ({
  history: language === 'ko' ? '사회·정치' : 'Social & political',
  'religion-thought': language === 'ko' ? '종교·사상' : 'Religion & thought',
  'science-economy': language === 'ko' ? '과학·경제' : 'Science & economy',
  art: language === 'ko' ? '미술사' : 'Art history'
}[category] || category);
