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
  const storedLeonardoLayout = isLeonardoTimeline ? sessionStorage.getItem(leonardoLayoutKey) : '';
  const leonardoLayout = ['chronology','portrait-series'].includes(storedLeonardoLayout)
    ? storedLeonardoLayout
    : 'chronology';
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
    const workDescription = String(loc(w.description) || '').replace(/\s+/g,' ').trim();
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
    const artworkLinkButtons = savedArtworkLinks.map((link, index) => `<button class="artwork-link-button thumbnail-artwork-link-button${isYouTubeLink(link) ? ' artwork-link-youtube' : ''}${linkEmphasisClass(link)}" type="button" data-work="${esc(w.id)}" data-artwork-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index + 1}. ${link.url}`)}">${index + 1}</button>`).join('');
    const artworkLinkControls = currentUserIsAdmin || savedArtworkLinks.length
      ? `<span class="artwork-link-controls thumbnail-artwork-link-controls">${currentUserIsAdmin ? `<button class="artwork-link-add thumbnail-artwork-link-add" type="button" data-work="${esc(w.id)}" title="${esc(addArtworkLinkLabel)}" aria-label="${esc(addArtworkLinkLabel)}">+</button>` : ''}${artworkLinkButtons}</span>`
      : '';
    const artworkLinkEntry = currentUserIsAdmin ? `<form class="artwork-link-entry thumbnail-artwork-link-entry hidden" data-work="${esc(w.id)}"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(artworkLinkInputLabel)}" required>${linkEmphasisField()}<button type="submit">${esc(confirmArtworkLinkLabel)}</button></form>` : '';
    const titleMarkup = `<span class="art-title-row"><span class="art-title-with-links">${titleLink}${artworkLinkControls}</span>${highResBadge}</span>${artworkLinkEntry}`;
    const footerMarkup = `<span class="art-card-footer"><small class="art-work-year">${esc(previewYear)}</small>${collectionMarkup}</span>`;
    const descriptionMarkup = workDescription ? `<small class="art-work-description" title="${esc(workDescription)}">${esc(workDescription)}</small>` : '';
    const controls = currentUserIsAdmin ? `<button class="delete-artwork" data-work="${esc(w.id)}" title="${esc(t('delete'))}" aria-label="${esc(t('delete'))}">×</button><button class="replace-local-image" data-work="${esc(w.id)}" title="${esc(replaceLabel)}" aria-label="${esc(replaceLabel)}">↗</button>` : '';
    return `<div class="art-card${primaryMovementArtwork ? ' primary-movement-artwork' : ''}" data-work="${esc(w.id)}" data-preview-artist="${esc(previewArtist)}" data-preview-title="${esc(workTitle)}" data-preview-year="${esc(previewYear)}" data-preview-collection="${collection && collection !== t('unknown') ? esc(collection) : ''}" title="${primaryMovementArtwork ? esc(primaryMovementArtworkLabel) : ''}"><span class="art-thumb">${featuredToggle}${image ? `<img src="${esc(image)}" alt="${esc(workTitle)}" loading="lazy"${fallbackImage ? ` data-fallback-src="${esc(fallbackImage)}"` : ''} />${urlBadge}` : `<span class="art-thumb-empty">${esc(unavailableImageLabel(work))}</span>`}${previewButton}${controls}</span><span class="art-meta">${titleMarkup}${footerMarkup}${descriptionMarkup}</span></div>`;
  };
  const koreanName = artist.name?.ko || '', originalName = artist.name?.en || '';
  const savedLinks = artistLinks(artist);
  const addLinkLabel = language === 'ko' ? '주소 추가' : 'Add address';
  const linkInputLabel = language === 'ko' ? '열 주소를 입력하세요' : 'Enter an address to open';
  const confirmLinkLabel = language === 'ko' ? '확인' : 'Add';
  const linkButtons = savedLinks.map((link, index) => `<button class="artist-link-button${isYouTubeLink(link) ? ' artist-link-youtube' : ''}${linkEmphasisClass(link)}" type="button" data-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index + 1}. ${link.url}`)}">${index + 1}</button>`).join('');
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
  const timelineHeader = `<header class="timeline-sticky-header"><p class="eyebrow">${t('timeline')}</p><div class="timeline-title-row"><h1 class="timeline-title">${displayName}</h1><div class="timeline-title-actions">${headerActions}</div></div>${currentUserIsAdmin ? `<form class="artist-link-entry hidden"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(linkInputLabel)}" required>${linkEmphasisField()}<button type="submit">${esc(confirmLinkLabel)}</button></form>` : ''}<p class="life">${years(artist)}${nationalityLabel ? ` · ${esc(nationalityLabel)}` : ''}${artistMovement ? ` · ${artistMovementLabel}` : ''}</p></header>`;
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
    const chronologyLabel = language === 'ko' ? '10년 연표' : 'By decade';
    const portraitSeriesLabel = language === 'ko' ? '초상화·연작' : 'Portraits & series';
    const featuredLabel = language === 'ko' ? '대표작' : 'Highlights';
    const layoutLabels = {gallery:galleryLabel, chronology:chronologyLabel, 'portrait-series':portraitSeriesLabel};
    const guide = {
      gallery: language === 'ko'
        ? '대표작을 먼저 감상한 뒤, 모든 작품을 제작 시작 연도순으로 자유롭게 훑어보세요.'
        : 'Start with key works, then browse every work in chronological order.',
      chronology: language === 'ko'
        ? '작품을 제작 시작 연도 기준 10년 단위로 나누어 봅니다.'
        : 'Works are grouped by starting decade.',
      'portrait-series': language === 'ko'
        ? '초상화는 두 점 이상일 때만, 연작은 반복되는 작품명이 두 점 이상일 때만 한 줄로 묶어 보여줍니다.'
        : 'Portraits appear only when there are at least two; repeated-title series appear only when at least two works match.'
    }[leonardoLayout];
    const periodGroups = new Map();
    works.forEach(work => {
      const year = Number(work.year);
      const decadeStart = timelineDecadeStart(year);
      const key = decadeStart === null ? 'undated' : String(decadeStart);
      periodGroups.set(key, [...(periodGroups.get(key) || []), work]);
    });
    const sortedPeriodGroups = [...periodGroups.entries()].sort(([left], [right]) => {
      if (left === 'undated') return 1;
      if (right === 'undated') return -1;
      return Number(left) - Number(right);
    });
    const gallery = `<div class="leonardo-work-grid">${works.map(card).join('')}</div>`;
    const chronology = `<div class="leonardo-period-list artist-century-timeline">${sortedPeriodGroups.map(([period, group]) => `<section class="leonardo-period artist-century-section"><h2>${esc(period === 'undated' ? (language === 'ko' ? '연도 미상' : 'Undated') : timelineDecadeLabelFromStart(Number(period)))}</h2><div class="leonardo-work-grid">${group.map(card).join('')}</div></section>`).join('')}</div>`;
    const portraitWorks = works.filter(work => isPortraitArtwork(work, artist));
    const seriesGroups = buildArtworkSeriesGroups(works, artist);
    const groupedRows = [
      ...(portraitWorks.length >= 2 ? [{key:'portrait', label:language === 'ko' ? '초상화' : 'Portraits', works:portraitWorks}] : []),
      ...seriesGroups.map(group => ({...group, label:language === 'ko' ? `${group.label} 연작` : `${group.label} series`}))
    ];
    const portraitSeries = groupedRows.length
      ? `<div class="leonardo-special-list">${groupedRows.map(group => `<section class="leonardo-special-row"><h2>${esc(group.label)}</h2><div class="leonardo-work-grid">${group.works.map(card).join('')}</div></section>`).join('')}</div>`
      : `<p class="leonardo-special-empty">${esc(language === 'ko' ? '두 점 이상으로 묶을 초상화나 반복 작품명이 아직 없습니다.' : 'No portrait set or repeated-title series has at least two works yet.')}</p>`;
    const slideshowButton = (scope, label) => `<button class="start-slideshow leonardo-section-slideshow" type="button" data-slideshow-scope="${scope}" aria-label="${esc(label)}" title="${esc(label)}"><span>▶</span><span>${esc(t('slideshow'))}</span></button>`;
    const layoutControls = `<div class="leonardo-layout-controls" role="group" aria-label="${esc(language === 'ko' ? '작품 보기 방식' : 'Artwork view')}"><button class="leonardo-layout-button${leonardoLayout === 'gallery' ? ' active' : ''}" type="button" data-leonardo-layout="gallery">${esc(galleryLabel)}</button><button class="leonardo-layout-button${leonardoLayout === 'chronology' ? ' active' : ''}" type="button" data-leonardo-layout="chronology">${esc(chronologyLabel)}</button><button class="leonardo-layout-button${leonardoLayout === 'portrait-series' ? ' active' : ''}" type="button" data-leonardo-layout="portrait-series">${esc(portraitSeriesLabel)}</button></div><p class="leonardo-layout-guide">${esc(guide)}</p>`;
    const canDragFeaturedWorks = currentUserIsAdmin && leonardoFeaturedWorks.length > 1;
    const summaryLines = localizedLines(artist.artistSummary);
    const summaryTitle = language === 'ko' ? '화가 해설' : 'Artist Notes';
    const summaryEditLabel = language === 'ko' ? '편집' : 'Edit';
    const summaryUpdateLabel = language === 'ko' ? '업데이트' : 'Update';
    const transcriptLabel = language === 'ko' ? '스크립트' : 'Transcript';
    const summarySaveLabel = language === 'ko' ? '저장' : 'Save';
    const summaryCancelLabel = language === 'ko' ? '취소' : 'Cancel';
    const summaryHelp = language === 'ko' ? '항목 수 제한 없이 입력할 수 있습니다. Enter를 누르면 새 불릿이 생기고, 빈 항목은 저장할 때 제거됩니다.' : 'Add as many items as needed. Press Enter to add a new bullet; blank items are removed when saved.';
    const summaryPlaceholder = language === 'ko'
      ? '화가가 무엇을 그렸고, 어떤 기법과 영향을 받았으며, 어떻게 평가되는지 적어 주세요.'
      : 'Describe subjects, techniques, influences, reception, and later impact.';
    const summaryExpanded=expandedArtistSummaryIds.has(artist.id);
    const summaryBody = summaryLines.length
      ? `<ul class="artist-summary-lines${summaryExpanded?' expanded':''}">${summaryLines.map(line => `<li>${artistSummaryLineMarkup(line,artist)}</li>`).join('')}</ul>`
      : `<p class="artist-summary-empty">${esc(language === 'ko' ? '아직 화가 해설이 없습니다.' : 'No artist notes yet.')}</p>`;
    const youtubeLinks=savedLinks.filter(isYouTubeLink), savedTranscriptCount=youtubeLinks.filter(link=>String(link.transcript || '').trim()).length;
    const transcriptControl=currentUserIsAdmin && youtubeLinks.length ? `<button class="artist-summary-transcript-button" type="button" title="${esc(language==='ko'?`저장된 스크립트 ${savedTranscriptCount}개`:`${savedTranscriptCount} saved transcript(s)`)}">${esc(transcriptLabel)}${savedTranscriptCount?` <span>${savedTranscriptCount}</span>`:''}</button>` : '';
    const expandControl=summaryLines.length>4?`<button class="artist-summary-expand-button" type="button" aria-expanded="${summaryExpanded}" title="${esc(language==='ko'?(summaryExpanded?'해설 접기':'해설 펼치기'):(summaryExpanded?'Collapse notes':'Expand notes'))}">${summaryExpanded?'▴':'▾'}</button>`:'';
    const summaryBox = `<section class="artist-summary-box"><div class="artist-summary-heading"><p class="eyebrow">${esc(summaryTitle)}</p><div class="artist-summary-actions">${currentUserIsAdmin ? `<button class="artist-summary-edit-button" type="button">${esc(summaryEditLabel)}</button>${transcriptControl}<button class="artist-summary-update-button" type="button" title="${esc(language === 'ko' ? '화가 이름 옆에 새로 추가한 링크와 저장 스크립트를 해설에 반영' : 'Add newly linked sources and saved transcripts to the artist notes')}">${esc(summaryUpdateLabel)}</button>` : ''}${expandControl}</div></div><div class="artist-summary-read">${summaryBody}</div>${currentUserIsAdmin ? `<form class="artist-summary-editor hidden"><textarea rows="6" aria-label="${esc(summaryTitle)}" placeholder="${esc(summaryPlaceholder)}">${esc(artistSummaryEditorText(summaryLines))}</textarea><p>${esc(summaryHelp)}</p><div><button type="button" class="artist-summary-cancel">${esc(summaryCancelLabel)}</button><button type="submit">${esc(summarySaveLabel)}</button></div></form>` : ''}</section>`;
    const featured = leonardoFeaturedWorks.length ? `<section class="leonardo-featured"><div class="leonardo-section-heading"><p class="eyebrow">${esc(featuredLabel)}</p><div class="leonardo-section-actions">${slideshowButton('featured', language === 'ko' ? '대표작 슬라이드 쇼 시작' : 'Start highlights slideshow')}</div><p>${esc(language === 'ko' ? '우선 크게 살펴볼 작품입니다. Ⓗ 표시는 고해상도 파일이 있음을 뜻합니다.' : 'A small set of works to study first. Ⓗ marks an available high-resolution file.')}</p></div><div class="leonardo-featured-grid">${leonardoFeaturedWorks.map(work => `<div class="leonardo-featured-card" data-featured-work="${esc(work.id)}"${canDragFeaturedWorks ? ' draggable="true"' : ''}>${card(work)}</div>`).join('')}</div></section>` : '';
    const allWorksAction = `${slideshowButton('all', language === 'ko' ? '전체 작품 슬라이드 쇼 시작' : 'Start all-works slideshow')}${currentUserIsAdmin ? `<button class="add-artwork-button leonardo-section-add-artwork" type="button" title="${esc(t('addArtwork'))}" aria-label="${esc(t('addArtwork'))}"><span>+</span><span>${esc(t('addArtwork'))}</span></button>` : ''}`;
    const layoutDescription = {
      gallery: language === 'ko' ? `${works.length}점 · 왼쪽 위에서 오른쪽 아래로 갈수록 뒤의 작품입니다.` : `${works.length} works · Earlier works begin at the upper left.`,
      chronology: language === 'ko' ? `${works.length}점 · 10년 단위로 묶은 제작 연표입니다.` : `${works.length} works · Grouped by decade.`,
      'portrait-series': language === 'ko' ? `초상화 ${portraitWorks.length >= 2 ? portraitWorks.length : 0}점 · 연작 ${seriesGroups.length}묶음` : `${portraitWorks.length >= 2 ? portraitWorks.length : 0} portraits · ${seriesGroups.length} series`
    }[leonardoLayout];
    const layoutMarkup = leonardoLayout === 'gallery' ? gallery : (leonardoLayout === 'chronology' ? chronology : portraitSeries);
    return `<div class="leonardo-timeline">${summaryBox}${featured}${layoutControls}<section class="leonardo-all-works"><div class="leonardo-section-heading"><p class="eyebrow">${esc(layoutLabels[leonardoLayout] || galleryLabel)}</p><div class="leonardo-section-actions">${allWorksAction}</div><p>${esc(layoutDescription)}</p></div>${layoutMarkup}</section></div>`;
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
      if (!await saveArtistPresentationNow(artist,{featuredWorkIds:artist.featuredWorkIds})) {
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
        if (!await saveArtistPresentationNow(artist,{featuredWorkIds:nextOrder})) {
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
    artist.links = [...artistLinks(artist), savedLinkFromEntry(url,linkEntry)];
    if (!await saveArtistPresentationNow(artist,{artistLinks:artist.links})) {
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
    saveLinks:links => saveArtistPresentationNow(artist,{artistLinks:links}),
    render:renderTimeline,
    contextMenu:(event, index) => showArtistLinkMenu(event, artist, index)
  });
  timeline.querySelectorAll('.replace-local-image').forEach(button => button.onclick = event => { event.stopPropagation(); const work=artist.works.find(item=>item.id===button.dataset.work); if(!work) return; const input=document.createElement('input'); input.type='file'; input.accept='image/jpeg,image/png,image/webp,image/gif'; input.onchange=async () => { const file=input.files?.[0]; if(!file) return; button.classList.add('searching'); try { await uploadLocalArtworkImage(artist,work,file); renderTimeline(); } catch(error) { alert((language === 'ko' ? '이미지 교체 실패: ' : 'Image replacement failed: ') + error.message); } finally { button.classList.remove('searching'); } }; input.click(); });
  timeline.querySelectorAll('.delete-artwork').forEach(button => button.onclick = async event => { event.stopPropagation(); const work = artist.works.find(item => item.id === button.dataset.work); if (!work || !confirm(t('confirmDeleteWork'))) return; artist.works = (artist.works || []).filter(item => item.id !== work.id); favoriteWorkKeys.delete(favoriteKey(artist, work)); persist(); if (!await saveArtistsNow()) return alert(saveFailureMessage()); closeDetail(); render(); });
  setupArtworkWikipediaLinks(artist, works);
  setupThumbnailArtworkLinks(artist, works);
  setupArtworkImageFallbacks();
  setupHighResolutionBadges(artist, works);
  setupArtworkImageViewer(artist, works);
  setupArtworkHoverPreview();
  if (currentUserIsAdmin) runThumbnailAgent();
}
