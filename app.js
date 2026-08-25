const $ = (selector) => document.querySelector(selector);
const list = $('#artist-list');
const timeline = $('#timeline-panel');
const detail = $('#detail-panel');
const dialog = $('#add-dialog');
const artworkDialog = $('#add-artwork-dialog');
const historicalEventDialog = $('#historical-event-dialog');
const authDialog = $('#auth-dialog');
const slideshow = $('#slideshow');
const slideshowStage = $('#slideshow-stage');
const slideshowCaption = $('#slideshow-caption');
const timelineArtworkPicker = Object.assign(document.createElement('input'), {type:'file', multiple:true, hidden:true, accept:'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'});
document.body.append(timelineArtworkPicker);
const storageKey = 'art-atlas-artists-v1';
const movementStorageKey = 'art-atlas-movement-view-v1';
const movementCountryMigrationKey = 'art-atlas-movement-country-migration-v1';
const detailImageHeightStorageKey = 'art-atlas-detail-image-height-v1';
const detailPanelWidthStorageKey = 'art-atlas-detail-panel-width-v1';
const artistSidebarWidthStorageKey = 'art-atlas-artist-sidebar-width-v1';
const lastPositionStorageKey = 'art-atlas-last-position-v1';
const favoriteWorksStorageKey = 'art-atlas-favorite-works-v1';
const accessSessionStorageKey = 'art-atlas-access-session-v1';
const uHangulModeStorageKey = 'ArtThroughTime.uHangulMode.v3';
const artistListEnglishStorageKey = 'ArtThroughTime.artistListEnglish.v1';
// The app can be opened through the local server or directly as index.html.
// In the latter case, API calls must explicitly target the local server.
const apiUrl = endpoint => location.protocol === 'file:' ? `http://localhost:4173${endpoint}` : endpoint;
const startupParams = new URLSearchParams(location.search);
const movementAtlasMinimum = 1400;
const movementAtlasStart = 1400;
const movementAtlasEnd = 2026;
const movementCountryEnd = 1950;
const movementMinimumRangeSpan = 30;
const movementDensityMinimum = 1;
const movementDensityMaximum = 4;
const highResolutionMinimumWidth = 1600;
const artistImportedWorkLimit = 60;
const sharedMovementId = 'global-contemporary';
const artistMovementFallbacks = { Q104884:{ko:'독일 낭만주의',en:'German Romanticism'} };
const isMovementPopup = startupParams.get('movementPopup') === '1';
const forceLogin = startupParams.get('login') === '1';
if (forceLogin) {
  try { sessionStorage.removeItem(accessSessionStorageKey); } catch (_) {}
}
function clearLoginRequestFromUrl() {
  if (!forceLogin || !history.replaceState) return;
  const url = new URL(location.href);
  url.searchParams.delete('login');
  const clean = `${url.pathname}${url.search}${url.hash}`;
  history.replaceState(null, '', clean || 'index.html');
}
const requestedUHangulMode = startupParams.get('uhangul');
const requestedArtistId = startupParams.get('artist') || startupParams.get('artistId');
if (isMovementPopup) document.body.classList.add('movement-popup');
const legacyMovementCountryIds = ['france','germany','netherlands','italy','united-kingdom','spain','russia','sweden','denmark','greece','united-states'];
const allMovementCountryIds = ['france','germany','switzerland','netherlands','italy','united-kingdom','spain','russia','sweden','denmark','greece','united-states'];
const defaultMovementView = {countries:[...allMovementCountryIds],start:movementAtlasStart,end:movementAtlasEnd,showHistoricalEvents:true,density:1};
let language = 'ko';
let uHangulMode = ['uhangul','korean','original'].includes(requestedUHangulMode) ? requestedUHangulMode : (['uhangul','korean','original'].includes(sessionStorage.getItem(uHangulModeStorageKey)) ? sessionStorage.getItem(uHangulModeStorageKey) : 'korean');
let artists = [];
let selectedId = localStorage.getItem('art-atlas-selected');
let requestedArtistMissing = false;
let viewMode = isMovementPopup ? 'movements' : 'timeline';
let movementCountries = [];
let movementView = parseMovementView();
if (localStorage.getItem(movementCountryMigrationKey) !== 'v1') {
  if (legacyMovementCountryIds.every(id => movementView.countries.includes(id)) && !movementView.countries.includes('switzerland')) {
    movementView.countries = [...movementView.countries, 'switzerland'];
    persistMovementView();
  }
  localStorage.setItem(movementCountryMigrationKey, 'v1');
}
let thumbnailObserver;
const profileRequests = new Set();
const artworkInfoRequests = new Set();
let saveTimer;
let lastSavedSnapshot = '';
let collectionMetadata = {};
let customHistoricalEvents = [];
let slideshowTimer;
let slideshowWorks = [];
let slideshowArtist;
let slideshowIndex = 0;
let favoriteWorkKeys = new Set();
let movementDocuments = {};
let artworkHoverPreview;
let artistSearchQuery = '';
let artistMovementFilter = '';
let artistMovementFilterMenuOpen = false;
const expandedArtistMovementGroups = new Set();
let artTaxonomy = {periods:[], movements:[]};
const artistFacetFilters = {
  periods:new Set(startupParams.getAll('period')),
  regions:new Set(startupParams.getAll('region')),
  movements:new Set(startupParams.getAll('movement')),
  submovements:new Set(startupParams.getAll('submovement'))
};
// Set this to false to restore the previous, always-visible inline filter layout.
const useCompactArtistFacetPanel = true;
let artistFacetPanelOpen = false;
// Keep the filter classification tree compact until the visitor chooses a section to open.
const expandedArtistFacetGroups = new Set();
const highResolutionWidthChecks = new Map();
const artworkWikipediaLinkChecks = new Map();
let currentUserEmail = '';
let currentUserRole = 'viewer';
let currentUserIsAdmin = false;
let adminSessionToken = '';
let adminSessionHeartbeat;
let lastSaveError = '';
async function apiFetch(endpoint, options={}) {
  const headers = new Headers(options.headers || {});
  if (adminSessionToken) headers.set('Authorization', `Bearer ${adminSessionToken}`);
  return fetch(apiUrl(endpoint), {...options, headers});
}
let detailImageHeight = Math.min(900, Math.max(240, Number(localStorage.getItem(detailImageHeightStorageKey)) || 644));
let detailPanelWidth = Math.min(900, Math.max(330, Number(localStorage.getItem(detailPanelWidthStorageKey)) || 520));
function setDetailImageHeight(value) {
  detailImageHeight = Math.min(900, Math.max(240, Number(value) || 644));
  document.documentElement.style.setProperty('--detail-image-height', `${detailImageHeight}px`);
  localStorage.setItem(detailImageHeightStorageKey, String(detailImageHeight));
}
setDetailImageHeight(detailImageHeight);
function setDetailPanelWidth(value) {
  detailPanelWidth = Math.min(900, Math.max(330, Number(value) || 520));
  document.documentElement.style.setProperty('--detail-panel-width', `${detailPanelWidth}px`);
  if (window.innerWidth > 840) $('.main-area').style.gridTemplateColumns = `minmax(320px, 1fr) ${detailPanelWidth}px`;
  localStorage.setItem(detailPanelWidthStorageKey, String(detailPanelWidth));
}
setDetailPanelWidth(detailPanelWidth);
function setupArtistSidebarResize() {
  const shell = $('.app-shell');
  const sidebar = $('.sidebar');
  if (!shell || !sidebar) return;
  const mobileQuery = window.matchMedia('(max-width: 590px)');
  const compactQuery = window.matchMedia('(max-width: 840px)');
  const minWidth = () => compactQuery.matches ? 245 : 312;
  const maxWidth = () => Math.max(minWidth(), Math.min(compactQuery.matches ? 430 : 560, Math.floor(window.innerWidth * (compactQuery.matches ? 0.52 : 0.44))));
  const clearWidth = () => {
    sidebar.style.removeProperty('width');
    sidebar.style.removeProperty('max-width');
  };
  const setWidth = (value, save = false) => {
    if (mobileQuery.matches) {
      clearWidth();
      return;
    }
    const width = Math.round(Math.max(minWidth(), Math.min(maxWidth(), Number(value) || minWidth())));
    sidebar.style.width = `${width}px`;
    sidebar.style.maxWidth = `${maxWidth()}px`;
    if (save) localStorage.setItem(artistSidebarWidthStorageKey, String(width));
  };
  const savedWidth = Number(localStorage.getItem(artistSidebarWidthStorageKey));
  if (savedWidth) setWidth(savedWidth);
  const handle = document.createElement('div');
  handle.className = 'sidebar-resize-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', language === 'ko' ? '화가 목록 너비 조절' : 'Resize artist list');
  sidebar.append(handle);
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || mobileQuery.matches) return;
    event.preventDefault();
    document.body.classList.add('sidebar-resizing');
    let lastWidth = sidebar.getBoundingClientRect().width;
    const resize = move => {
      const shellRect = shell.getBoundingClientRect();
      lastWidth = move.clientX - shellRect.left;
      setWidth(lastWidth);
    };
    const stop = () => {
      document.removeEventListener('pointermove', resize);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', stop);
      document.body.classList.remove('sidebar-resizing');
      setWidth(lastWidth, true);
    };
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    document.addEventListener('pointermove', resize);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
  });
  window.addEventListener('resize', () => {
    const width = Number(localStorage.getItem(artistSidebarWidthStorageKey));
    if (width) setWidth(width);
    else if (mobileQuery.matches) clearWidth();
  });
}
setupArtistSidebarResize();
timeline.addEventListener('click', event => {
  const link = event.target.closest?.('.original-artist-name');
  if (!link || !timeline.contains(link)) return;
  event.preventDefault();
  const artist = artists.find(item => item.id === selectedId);
  if (artist) openArtistWikipedia(artist);
});

const copy = {
  ko: {collection:'나의 화가 목록',sort:'정렬',nameAsc:'이름순',birthAsc:'생년순',addArtist:'화가 추가',newRecord:'NEW RECORD',addTitle:'화가 추가',addHelp:'이름을 입력한 뒤 자동완성 목록에서 정확한 후보를 선택해 저장하세요.',addArtwork:'그림 추가',addArtworkTitle:'그림 1점 추가',artworkPage:'로컬 이미지 파일',artworkTitleInput:'작품 제목 (선택)',artworkYearInput:'제작 연도 (선택)',entryType:'추가할 항목',artist:'화가',painting:'그림',webpage:'웹페이지 주소',name:'이름',birthYear:'Birth year (optional)',artistName:'화가 이름',madeYear:'제작 연도',save:'저장하기',timeline:'작품 연표',slideshow:'슬라이드 쇼',selectWork:'작품을 선택하면\n이곳에서 자세히 볼 수 있어요.',noWork:'아직 등록한 작품이 없습니다.',noImage:'이미지 없음',untitled:'제목 없는 작품',unknown:'정보 없음',country:'제작 국가',movement:'화파',year:'제작 연도',source:'저장된 출처',delete:'삭제',confirmDelete:'이 화가와 등록한 작품을 목록에서 삭제할까요?',confirmDeleteWork:'이 작품을 삭제할까요?',manualWorks:'직접 추가한 작품',movementAtlas:'미술 사조로 보기',countries:'비교할 나라',selectAllCountries:'전체 선택 / 해제',exportChanges:'변경사항_압축',migrationExport:'FIREBASE 내보내기',period:'기간',artistSpan:'선택 화가의 활동 기간',storedInfo:'저장된 작품 정보',loadingInfo:'작품 정보를 정리해 저장하는 중입니다.',noInfo:'저장된 설명이 아직 없습니다.',favorites:'MY FAVORITES',searchArtists:'화가 이름 검색',movementFilter:'사조 선택',allMovements:'전체 사조',clearMovementFilter:'사조 필터 해제',noSearchResult:'일치하는 화가가 없습니다.'},
  en: {collection:'MY ARTISTS',sort:'SORT',nameAsc:'Name',birthAsc:'Birth year',addArtist:'Add artist',newRecord:'NEW RECORD',addTitle:'Add artist',addHelp:'Enter a name, then choose the correct artist from suggestions.',addArtwork:'Add artwork',addArtworkTitle:'Add one artwork',artworkPage:'Local image file',artworkTitleInput:'Artwork title (optional)',artworkYearInput:'Year made (optional)',entryType:'Add',artist:'Artist',painting:'Artwork',webpage:'Webpage URL',name:'Name',birthYear:'Birth year (optional)',artistName:'Artist name',madeYear:'Year made',save:'Save',timeline:'WORKS TIMELINE',slideshow:'Slideshow',selectWork:'Select an artwork\nto view its details here.',noWork:'No artworks have been added yet.',noImage:'No image available',untitled:'Untitled',unknown:'Unknown',country:'Country made',movement:'Movement',year:'Year made',source:'Stored source',delete:'Delete this artist and their listed works?',confirmDeleteWork:'Delete this artwork?',manualWorks:'MANUALLY ADDED WORKS',movementAtlas:'Movement comparison',countries:'Countries',selectAllCountries:'Select / clear all',exportChanges:'EXPORT CHANGES',migrationExport:'EXPORT FOR FIREBASE',period:'Period',artistSpan:'Selected artist lifespan',storedInfo:'Stored artwork information',loadingInfo:'Preparing and saving artwork information.',noInfo:'No stored description yet.',favorites:'MY FAVORITES',searchArtists:'Search artists',movementFilter:'Movement filter',allMovements:'All movements',clearMovementFilter:'Clear movement filter',noSearchResult:'No matching artists.'}
};
Object.assign(copy.ko, {
  fullName:'Full Name (목록·연표·HTML 표기)',
  artistAliases:'별명·줄임말 (쉼표로 구분)',
  artworkPage:'로컬 이미지 파일',
  localArtwork:'로컬 이미지',
  chooseLocalImage:'파일 선택',
  localArtworkTitle:'작품 제목',
  localArtworkYear:'제작 연도 (예: 1500-1505)',
  addFromLocal:'연표에 추가'
});
Object.assign(copy.en, {
  fullName:'Full Name (display name)',
  artistAliases:'Aliases / short names (comma-separated)',
  artworkPage:'Local image file',
  localArtwork:'Local image',
  chooseLocalImage:'Choose image file',
  localArtworkTitle:'Artwork title',
  localArtworkYear:'Year made (for example, 1500-1505)',
  addFromLocal:'Add to timeline'
});
copy.ko.addArtistTooltip = '화가 추가';
copy.en.addArtistTooltip = 'Add artist';
const t = (key) => copy[language][key] || key;
copy.ko.movementAtlas = '미술 사조의 이해';
copy.en.movementAtlas = 'Understanding Art Movements';
copy.ko.techniques = '미술 기법 및 용어';
copy.en.techniques = 'Art Techniques and Terms';
const koreanLabelFallbacks = {'Italian Renaissance':'이탈리아 르네상스','High Renaissance':'전성기 르네상스','Mannerism':'매너리즘'};
const brokenLabel = value => /\?/.test(String(value || ''));
const loc = (value) => {
  if (typeof value !== 'object' || !value) return value;
  const preferred = value[language] || value.en || value.ko;
  if (language === 'ko' && brokenLabel(preferred) && value.en) return koreanLabelFallbacks[value.en] || value.en;
  return preferred;
};
function localizedLines(value, limit=Infinity) {
  const text = Array.isArray(value)
    ? value
    : Array.isArray(value?.[language])
      ? value[language]
      : Array.isArray(value?.ko)
        ? value.ko
        : Array.isArray(value?.en)
          ? value.en
          : String(loc(value) || '').split(/\n+/);
  return text.map(line => String(line || '').trim()).filter(Boolean).slice(0, limit);
}
function cleanSummaryLine(line) {
  return String(line || '').replace(/^\s*(?:[-*•]\s*)?/, '').trim();
}
function setArtistSummaryLines(artist, lines) {
  const cleaned = (Array.isArray(lines) ? lines : String(lines || '').split(/\n+/))
    .map(cleanSummaryLine)
    .filter(Boolean);
  const current = artist.artistSummary && typeof artist.artistSummary === 'object' && !Array.isArray(artist.artistSummary)
    ? artist.artistSummary
    : {};
  if (!cleaned.length) {
    const next = {...current};
    delete next[language];
    if (Object.keys(next).length) artist.artistSummary = next;
    else delete artist.artistSummary;
    return;
  }
  artist.artistSummary = {...current, [language]:cleaned};
}
function artistSummaryEditorText(lines) {
  const items = localizedLines(lines);
  return items.length ? items.map(line => `- ${line}`).join('\n') : '- ';
}
const artworkTitleLocales = ['ko','en','original'];
function artworkTitleValue(title, mode) {
  if (!title || typeof title !== 'object') return mode === 'ko' || mode === 'en' ? String(title || '').trim() : '';
  const original = title.original || title.native || title.originalTitle || title.nativeTitle || title.sourceTitle || '';
  const values = {ko:title.ko, en:title.en, original};
  return String(values[mode] || '').trim();
}
function artworkDisplayTitle(work) {
  return artworkTitleLocales.map(mode => artworkTitleValue(work?.title, mode)).find(Boolean) || t('untitled');
}
function artworkThumbnailTitle(work, artist) {
  let title = artworkDisplayTitle(work).replace(/\s+/g, ' ').trim();
  // Imported catalogue labels occasionally append a date, artist, collection,
  // or descriptive sentence after the actual artwork title.  Keep only the
  // title on thumbnails; the collection remains in its own metadata line.
  title = title
    .replace(/^\s*file:\s*/i, '')
    .replace(/\s*\(\s*(?:c\.?\s*)?\d{3,4}[^)]*\)(?:\s*,.*)?$/i, '')
    .replace(/\s*,\s*(?:c\.?\s*)?\d{3,4}(?:\s*[–-]\s*\d{2,4})?(?:\s*,.*)?$/i, '')
    .replace(/\s*,\s*(?:private )?(?:museum|gallery|collection|museum collection|royal museums?).*$/i, '');
  const flexibleNamePattern = name => String(name).trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]+');
  const artistNames = [artist?.fullName, artist?.name?.ko, artist?.name?.en].filter(Boolean);
  for (const name of artistNames) {
    const namePattern = flexibleNamePattern(name);
    title = title
      .replace(new RegExp(`^\\s*${namePattern}\\s*(?:,|:|—|–|-)\\s*`, 'i'), '')
      .replace(new RegExp(`\\s+(?:by|after|follower of|circle of|school of)\\s+${namePattern}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*\\((?:after|follower of|circle of|school of)\\s+${namePattern}\\)\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${namePattern}(?:\\s*,.*)?$`, 'i'), '');
  }
  const collectionValues = work?.detail?.facts?.collection || work?.collection || [];
  const collections = (Array.isArray(collectionValues) ? collectionValues : [collectionValues]).map(loc).filter(Boolean);
  for (const collection of collections) {
    const collectionPattern = flexibleNamePattern(collection);
    title = title.replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${collectionPattern}(?:\\s*,.*)?$`, 'i'), '');
  }
  return title.trim() || artworkDisplayTitle(work);
}
function artworkTitleAliases(work) {
  const title = work?.title;
  if (!title) return [];
  if (typeof title !== 'object') return [String(title).trim()].filter(Boolean);
  return [...new Set(artworkTitleLocales.map(mode => artworkTitleValue(title, mode)).filter(Boolean))];
}
function wikipediaPageInfo(url) {
  try {
    const parsed = new URL(url, location.href);
    if (!/(^|\.)wikipedia\.org$/i.test(parsed.hostname) || !parsed.pathname.startsWith('/wiki/')) return null;
    const title = decodeURIComponent(parsed.pathname.slice('/wiki/'.length)).replace(/_/g, ' ').trim();
    if (!title || /^(?:special|file|category|help|wikipedia|template|portal|talk|user|module):/i.test(title)) return null;
    return {url:parsed.href, title, lang:parsed.hostname.split('.')[0] || 'en'};
  } catch (_) {
    return null;
  }
}
function wikipediaUrlFromTitle(languageCode, title) {
  const lang = languageCode === 'ko' ? 'ko' : 'en';
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(title || '').trim().replace(/ /g, '_'))}`;
}
function artworkQid(work) {
  const id = String(work?.id || '');
  const source = String(work?.source || '');
  return id.match(/^(?:wikidata|featured)-(Q\d+)$/)?.[1]
    || source.match(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/i)?.[1]
    || '';
}
function artworkWikipediaSources(work) {
  const linkUrls = (work?.links || []).map(link => typeof link === 'string' ? link : link?.url).filter(Boolean);
  return [
    ...(Array.isArray(work?.detail?.sources) ? work.detail.sources : []),
    work?.source,
    ...linkUrls
  ].filter(Boolean);
}
function wikipediaSourceMatchesArtwork(info, work) {
  const pageTitle = normalized(info?.title || '');
  const aliases = artworkTitleAliases(work).map(normalized).filter(value => value.length >= 2);
  return Boolean(pageTitle && aliases.some(alias => pageTitle.includes(alias)));
}
function explicitArtworkWikipediaUrl(work) {
  const candidates = artworkWikipediaSources(work)
    .map(wikipediaPageInfo)
    .filter(info => info && wikipediaSourceMatchesArtwork(info, work));
  if (!candidates.length) return '';
  const preferred = candidates.find(info => info.lang === language) || candidates.find(info => info.lang === 'en') || candidates[0];
  return preferred.url;
}
function wikipediaResultMatchesArtwork(page, work, artist) {
  const title = page?.title || '';
  const extract = page?.extract || '';
  const titleKey = normalized(title);
  const extractKey = normalized(extract);
  const aliases = artworkTitleAliases(work).map(normalized).filter(value => value.length >= 2);
  const artistNames = [artist?.name?.en, artist?.name?.ko, artistDisplayName(artist)]
    .filter(Boolean)
    .flatMap(name => {
      const parts = String(name).split(/\s+/).filter(part => part.length > 2);
      return [name, parts[parts.length - 1]];
    })
    .map(normalized)
    .filter(value => value.length >= 2);
  const titleMatches = aliases.some(alias => titleKey.includes(alias));
  const artistMatches = !artistNames.length || artistNames.some(name => titleKey.includes(name) || extractKey.includes(name));
  return titleMatches && artistMatches;
}
async function wikipediaExactTitleUrl(work, artist) {
  const languages = language === 'ko' ? ['ko','en'] : ['en','ko'];
  const aliases = artworkTitleAliases(work);
  for (const lang of languages) {
    for (const title of aliases) {
      try {
        const endpoint = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',redirects:'1',titles:title,prop:'info|extracts',inprop:'url',exintro:'1',explaintext:'1'})}`;
        const data = await fetch(endpoint).then(response => response.ok ? response.json() : null);
        const page = Object.values(data?.query?.pages || {}).find(item => item && !item.missing);
        if (page && page.fullurl && wikipediaResultMatchesArtwork(page, work, artist)) return page.fullurl;
      } catch (_) {}
    }
  }
  return '';
}
async function wikipediaSearchTitleUrl(work, artist) {
  const languages = language === 'ko' ? ['ko','en'] : ['en','ko'];
  const aliases = artworkTitleAliases(work);
  const artistName = artist?.name?.en || artist?.name?.ko || '';
  if (!artistName || !aliases.length) return '';
  for (const lang of languages) {
    for (const title of aliases) {
      try {
        const endpoint = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',generator:'search',gsrsearch:`"${title}" "${artistName}"`,gsrnamespace:'0',gsrlimit:'4',prop:'info|extracts',inprop:'url',exintro:'1',explaintext:'1'})}`;
        const data = await fetch(endpoint).then(response => response.ok ? response.json() : null);
        const page = Object.values(data?.query?.pages || {}).find(item => item?.fullurl && wikipediaResultMatchesArtwork(item, work, artist));
        if (page) return page.fullurl;
      } catch (_) {}
    }
  }
  return '';
}
async function resolveArtworkWikipediaUrl(work, artist) {
  const explicit = explicitArtworkWikipediaUrl(work);
  if (explicit) return explicit;
  const qid = artworkQid(work);
  if (qid) {
    try {
      const endpoint = `https://www.wikidata.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'wbgetentities',ids:qid,props:'sitelinks',sitefilter:'kowiki|enwiki'})}`;
      const data = await fetch(endpoint).then(response => response.ok ? response.json() : null);
      const sitelinks = data?.entities?.[qid]?.sitelinks || {};
      const sites = language === 'ko' ? ['kowiki','enwiki'] : ['enwiki','kowiki'];
      const site = sites.find(item => sitelinks[item]?.title);
      if (site) return wikipediaUrlFromTitle(site === 'kowiki' ? 'ko' : 'en', sitelinks[site].title);
    } catch (_) {}
  }
  return await wikipediaExactTitleUrl(work, artist) || await wikipediaSearchTitleUrl(work, artist);
}
function cachedArtworkWikipediaUrl(work, artist) {
  const key = `${language}:${work?.id || selectionKey(work)}:${artist?.id || ''}:${artworkTitleAliases(work).join('|')}`;
  if (!artworkWikipediaLinkChecks.has(key)) {
    artworkWikipediaLinkChecks.set(key, resolveArtworkWikipediaUrl(work, artist).catch(() => ''));
  }
  return artworkWikipediaLinkChecks.get(key);
}
function artworkCollectionLabel(work) {
  const values = work?.detail?.facts?.collection || work?.collection || [];
  const entries = Array.isArray(values) ? values : [values];
  return entries.map(loc).filter(Boolean).join(', ') || t('unknown');
}
const currentCountryByHistoricalCountry = {
  'Kingdom of the Netherlands': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'}, '네덜란드 왕국': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'},
  'Dutch Republic': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'}, '네덜란드 공화국': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'},
  'Kingdom of Prussia': {ko:'독일', en:'Germany',colorKey:'Germany'}, '프로이센 왕국': {ko:'독일', en:'Germany',colorKey:'Germany'},
  'Russian Empire': {ko:'러시아', en:'Russia',colorKey:'Russia'}, '러시아 제국': {ko:'러시아', en:'Russia',colorKey:'Russia'},
  'Papal States': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '교황령': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Holy Roman Empire': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '신성 로마 제국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Republic of Florence': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '피렌체 공화국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Duchy of Milan': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '밀라노 공국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Duchy of Brabant': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '브라반트 공국': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Habsburg Netherlands': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '합스부르크 네덜란드': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Spanish Netherlands': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '스페인령 네덜란드': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Flanders': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '플랑드르': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Flemish': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '플랑드르(벨기에)': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Crown of Castile': {ko:'스페인', en:'Spain',colorKey:'Spain'}, '카스티야 연합왕국': {ko:'스페인', en:'Spain',colorKey:'Spain'}
};
const artistNationalityOverrides = {
  Q7803: {ko:'이탈리아', en:'Italy'},
  'artist-Q7803': {ko:'이탈리아', en:'Italy'}
};
const artistBirthCountryOverrides = {
  Q301: {ko:'그리스', en:'Greece'},
  'artist-Q301': {ko:'그리스', en:'Greece'}
};
function artistNationality(artist) {
  return artistNationalityOverrides[String(artist?.qid || '')] || artistNationalityOverrides[String(artist?.id || '')] || artist?.nationality;
}
function applyArtistOverrides(artist) {
  const nationalityOverride = artistNationalityOverrides[String(artist?.qid || '')] || artistNationalityOverrides[String(artist?.id || '')];
  return nationalityOverride ? {...artist, nationality:{...nationalityOverride}} : artist;
}
function artistCountrySource(artist) {
  return artistBirthCountryOverrides[String(artist?.qid || '')] || artistBirthCountryOverrides[String(artist?.id || '')] || artist?.birthCountry || artistNationality(artist);
}
function countryInfo(value) {
  const original = loc(value) || '?';
  const keys = [original, value?.ko, value?.en].filter(Boolean);
  const current = keys.map(key => currentCountryByHistoricalCountry[key]).find(Boolean);
  const name = current ? loc(current) : original;
  return {original, name, colorKey:current?.colorKey || value?.en || name};
}
function countryDisplayLabel(value) {
  const country = countryInfo(value);
  return country.original === country.name ? country.name : `${country.original} (${country.name})`;
}
function artistCountryInfo(artist) {
  const country = countryInfo(artistCountrySource(artist));
  return {...country, original:country.name};
}
function artistCountryLabel(artist) {
  return countryInfo(artistCountrySource(artist)).name;
}
function countryAvatarText(country) {
  if (!country || country.original === country.name) return (country?.name || '?').slice(0, 1);
  return `${country.original.slice(0, 1)}(${country.name.slice(0, 1)})`;
}
function countryColor(country) {
  const text = String(country || '?');
  const hue = [...text].reduce((value, character) => (value * 31 + character.codePointAt(0)) % 360, 0);
  return 'hsl(' + hue + ' 48% 78%)';
}
function countryInk(country) {
  const text = String(country || '?');
  const hue = [...text].reduce((value, character) => (value * 31 + character.codePointAt(0)) % 360, 0);
  return 'hsl(' + hue + ' 34% 28%)';
}
const esc = (text='') => String(text).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function uHangulArtistAttributes(artist, displayName) {
  const original = artist?.name?.en || '';
  const korean = artist?.name?.ko || '';
  const display = displayName || korean;
  if (!original && !korean && !display) return '';
  return ` data-uh-original="${esc(original)}" data-uh-korean="${esc(korean)}" data-uh-display-korean="${esc(display)}"`;
}
function setUHangulMode(mode) {
  uHangulMode = ['uhangul','original'].includes(mode) ? mode : 'korean';
  sessionStorage.setItem(uHangulModeStorageKey, uHangulMode);
  window.dispatchEvent(new CustomEvent('uhangulmodechange', {detail:{mode:uHangulMode}}));
}
function uHangulModeUrl(url, mode=uHangulMode) {
  const target = new URL(url, location.href);
  target.searchParams.set('uhangul', mode);
  return target.href;
}
function generatedCatalogueFile(artistOrResult={}) {
  return `data/generated/${artistOrResult.qid ? `qid-${artistOrResult.qid}` : artistOrResult.id}.json`;
}
function openArtistListPage() {
  window.open(uHangulModeUrl('index.html'), 'artThroughTimeArtists');
}
function openTechniquesPage() {
  window.open(uHangulModeUrl('techniques.html'), 'artThroughTimeTechniques');
}
function openTopicsPage() {
  window.open(uHangulModeUrl('topics.html'), 'artThroughTimeTopics');
}
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const selectionKey = work => {
  const qid = String(work.id || '').match(/^wikidata-Q\d+/)?.[0];
  if (qid) return qid;
  const title = normalized(work.title?.en || work.title?.ko);
  return title ? `${title}-${work.year || ''}` : String(work.id || '');
};
const isManualWork = work => work?.origin === 'manual';
const isGeneratedWork = work => !isManualWork(work) && /^(wikidata|wikipedia)-/.test(String(work.id || ''));
const workPopularity = work => Number.isFinite(Number(work.popularity)) ? Number(work.popularity) : 0;
const workYearForSort = work => {
  const value = String(work?.year ?? '').trim();
  const year = Number(value);
  return value && Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
};
const workMovementText = work => `${work?.movement?.ko || ''} ${work?.movement?.en || ''}`.toLocaleLowerCase();
function representativeScore(work, artist={}) {
  const source = String(work?.source || '');
  const movement = workMovementText(work);
  const artistMovement = `${artist?.movement?.ko || ''} ${artist?.movement?.en || ''}`.toLocaleLowerCase();
  let score = workPopularity(work);
  if (work?.origin === 'curated') score += 100000;
  if (work?.image || work?.thumbnail) score += 1200;
  if (work?.verified) score += 600;
  if (/wikidata\.org|commons\.wikimedia\.org|api\.artic\.edu|clevelandart\.org/i.test(source)) score += 420;
  if (/wikipedia\.org/i.test(source)) score -= 120;
  if (artistMovement && movement && (movement.includes(artistMovement) || artistMovement.includes(movement))) score += 900;
  if (movement) score += 240;
  if (work?.description?.ko || work?.description?.en) score += 120;
  return score;
}
function movementMatchesArtist(work, artist={}) {
  const movement = workMovementText(work);
  const artistMovement = `${artist?.movement?.ko || ''} ${artist?.movement?.en || ''}`.toLocaleLowerCase();
  return Boolean(artistMovement && movement && (movement.includes(artistMovement) || artistMovement.includes(movement)));
}
function movementContributionScore(work, artist={}) {
  let score = representativeScore(work, artist);
  if (movementMatchesArtist(work, artist)) score += 5000;
  if (work?.origin === 'curated') score += 1800;
  if (work?.verified) score += 500;
  return score;
}
const workYearLabel = work => {
  const start = work?.year;
  const end = work?.yearEnd;
  if (!start) return '';
  return end && Number(end) !== Number(start) ? `${start}–${end}` : String(start);
};
function selectArtistWorks(works, limit=artistImportedWorkLimit, artist={}) {
  const byKey = new Map();
  const idCounts = new Map();
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    const key = id && idCounts.get(id) > 1 ? `id:${id}` : selectionKey(work);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? {...work,...existing,popularity:Math.max(workPopularity(existing),workPopularity(work))} : work);
  });
  const unique = [...byKey.values()];
  const manualWorks = unique.filter(isManualWork).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const manualKeys = new Set(manualWorks.map(selectionKey));
  const curatedWorks = unique.filter(work => work?.origin === 'curated' && !manualKeys.has(selectionKey(work))).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const curatedKeys = new Set(curatedWorks.map(selectionKey));
  const generatedWorks = unique.filter(work => !manualKeys.has(selectionKey(work)) && !curatedKeys.has(selectionKey(work))).sort((a,b) => representativeScore(b,artist) - representativeScore(a,artist) || workYearForSort(a) - workYearForSort(b));
  const selected = [...manualWorks,...curatedWorks,...generatedWorks.slice(0,Math.max(0,limit-manualWorks.length-curatedWorks.length))];
  const aligned = selected.filter(work => movementMatchesArtist(work, artist));
  const contributionPool = aligned.length ? aligned : selected;
  const movementContributionKeys = new Set(
    contributionPool
      .sort((a,b) => movementContributionScore(b,artist) - movementContributionScore(a,artist) || workYearForSort(a) - workYearForSort(b))
      .slice(0,3)
      .map(selectionKey)
  );
  return selected.map(work => ({...work,movementContribution:movementContributionKeys.has(selectionKey(work)),movementContributionReason:movementContributionKeys.has(selectionKey(work)) ? 'artist-movement-characteristic' : undefined})).sort((a,b) => workYearForSort(a) - workYearForSort(b));
}
function koreanFamilyFirst(name, originalName) {
  if (String(name || '').includes(',')) return String(name || '').trim();
  const korean = String(name || '').trim().split(/\s+/), original = String(originalName || '').trim().split(/\s+/);
  if (korean.length < 2 || original.length < 2) return korean.join(' ');
  const familyPrefixes = new Set(['van','von','de','del','della','da','di','du','la','le','der','den','ten','ter','st.','saint']);
  let familyLength = 1;
  for (let index = original.length - 2; index >= 0 && familyPrefixes.has(original[index].toLowerCase()); index--) familyLength++;
  if (familyLength >= korean.length) return korean.join(' ');
  return `${korean.slice(-familyLength).join(' ')}, ${korean.slice(0, -familyLength).join(' ')}`;
}
const koreanArtistDisplayOverrides = {
  Q7814: '디 본도네, 조토',
  Q43270: '브뤼헐, 피터르 대',
  Q213163: '비제 르 브룅, 엘리자베스 루이',
  Q82445: '툴루즈로트레크, 앙리 드',
  Q301: '엘 그레코',
  Q5592: '부오나로티, 미켈란젤로',
  Q5597: '산치오, 라파엘로',
  Q5598: '렘브란트 하르먼손 반 레인',
  Q312617: '로소 피오렌티노'
};
function artistDisplayName(artist) {
  if (language !== 'ko') return loc(artist?.name);
  const fullName = String(artist?.fullName || '').trim();
  if (fullName) return fullName;
  const koreanName = artist?.name?.ko || loc(artist?.name) || '';
  return koreanArtistDisplayOverrides[artist?.qid] || koreanFamilyFirst(koreanName, artist?.name?.en || '');
}
function textList(value) {
  return (Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean);
}
function artistAliases(artist) {
  const aliases = artist?.aliases;
  if (Array.isArray(aliases)) return textList(aliases);
  return [...textList(aliases?.ko), ...textList(aliases?.en)];
}
function artistSearchText(artist) {
  return [artist?.fullName, artist?.name?.ko, artist?.name?.en, loc(artist?.name), artistDisplayName(artist), ...artistAliases(artist)].filter(Boolean).join(' ').toLocaleLowerCase();
}
function artistLinks(artist) {
  return Array.isArray(artist?.links) ? artist.links.filter(link => {
    try { return ['http:', 'https:'].includes(new URL(link.url || link).protocol); }
    catch (_) { return false; }
  }).map(link => typeof link === 'string' ? {url:link} : link) : [];
}
function artistWikipediaUrl(artist, originalName = '') {
  const direct = typeof artist?.links?.wikipedia === 'string' ? artist.links.wikipedia : '';
  try {
    if (direct && ['http:', 'https:'].includes(new URL(direct).protocol)) return direct;
  } catch (_) {}
  const saved = artistLinks(artist).find(link => /(^|\.)wikipedia\.org$/i.test(new URL(link.url).hostname));
  if (saved?.url) return saved.url;
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(originalName || artist?.name?.en || artist?.name?.ko || '')}`;
}
function artworkLinks(work) {
  return Array.isArray(work?.links) ? work.links.filter(link => {
    try { return ['http:', 'https:'].includes(new URL(link.url || link).protocol); }
    catch (_) { return false; }
  }).map(link => typeof link === 'string' ? {url:link} : link) : [];
}
function setArtworkLinks(artist, work, links) {
  const copies = (artist.works || []).filter(item => selectionKey(item) === selectionKey(work));
  copies.forEach(item => { item.links = links.map(link => ({...link})); });
  work.links = links.map(link => ({...link}));
}
function isYouTubeLink(link) {
  try { return /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/i.test(new URL(link?.url || link).hostname); }
  catch (_) { return false; }
}
function closeArtistLinkMenu() {
  document.querySelector('.artist-link-menu')?.remove();
}
function closeLinkMenus() {
  closeArtistLinkMenu();
  closeArtworkLinkMenu();
}
function showArtistLinkMenu(event, artist, linkIndex) {
  if (!currentUserIsAdmin) return;
  event.preventDefault();
  closeArtistLinkMenu();
  const menu = document.createElement('div');
  menu.className = 'artist-link-menu';
  menu.innerHTML = `<button type="button">${esc(language === 'ko' ? '삭제' : 'Delete')}</button>`;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 120)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 52)}px`;
  menu.querySelector('button').onclick = async () => {
    const previousLinks = artist.links;
    artist.links = artistLinks(artist).filter((_, index) => index !== linkIndex);
    closeArtistLinkMenu();
    persist();
    if (!await saveArtistsNow()) {
      artist.links = previousLinks;
      alert(saveFailureMessage());
    }
    renderTimeline();
  };
  document.body.append(menu);
}
function closeArtworkLinkMenu() {
  document.querySelector('.artwork-link-menu')?.remove();
}
function showArtworkLinkMenu(event, artist, work, linkIndex, renderAfterDelete = () => renderArtworkDetail(work, artist, false)) {
  if (!currentUserIsAdmin) return;
  event.preventDefault();
  closeArtworkLinkMenu();
  const menu = document.createElement('div');
  menu.className = 'artwork-link-menu';
  menu.innerHTML = `<button type="button">${esc(language === 'ko' ? '삭제' : 'Delete')}</button>`;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 120)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 52)}px`;
  menu.querySelector('button').onclick = async () => {
    const previousLinks = artworkLinks(work);
    setArtworkLinks(artist, work, previousLinks.filter((_, index) => index !== linkIndex));
    closeArtworkLinkMenu();
    persist();
    if (!await saveArtistsNow()) {
      setArtworkLinks(artist, work, previousLinks);
      persist();
      alert(saveFailureMessage());
    }
    renderAfterDelete();
  };
  document.body.append(menu);
}
document.addEventListener('click', closeArtistLinkMenu);
document.addEventListener('scroll', closeArtistLinkMenu, true);
document.addEventListener('click', closeArtworkLinkMenu);
document.addEventListener('scroll', closeArtworkLinkMenu, true);
function movedLinks(links, fromIndex, toIndex) {
  const next = links.map(link => ({...link}));
  const [item] = next.splice(fromIndex, 1);
  if (!item) return next;
  next.splice(toIndex, 0, item);
  return next;
}
function openSavedLink(link) {
  if (link?.url) window.open(link.url, '_blank', 'noopener');
}
function setupSortableLinkButtons(root, options) {
  const buttons = [...root.querySelectorAll(options.selector)];
  buttons.forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      if (button.dataset.suppressLinkClick === 'true') {
        delete button.dataset.suppressLinkClick;
        return;
      }
      openSavedLink(options.getLinks(button)[Number(button.dataset[options.indexAttribute])]);
    };
    button.oncontextmenu = event => options.contextMenu(event, Number(button.dataset[options.indexAttribute]), button);
  });
  if (!currentUserIsAdmin || buttons.length < 2) return;
  buttons.forEach(button => button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const controls = button.closest(options.controlsSelector);
    if (!controls || controls.querySelectorAll(options.selector).length < 2) return;
    const startIndex = Number(button.dataset[options.indexAttribute]);
    if (!Number.isFinite(startIndex)) return;
    event.preventDefault();
    event.stopPropagation();
    closeLinkMenus();
    let dragging = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const beginDrag = () => {
      dragging = true;
      controls.classList.add('link-reorder-active');
      button.classList.add('link-dragging');
    };
    const move = pointerEvent => {
      if (pointerEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
      if (!dragging && distance > 5) beginDrag();
      if (!dragging) return;
      const target = [...controls.querySelectorAll(options.selector)].find(item => {
        if (item === button) return false;
        const rect = item.getBoundingClientRect();
        return pointerEvent.clientX >= rect.left && pointerEvent.clientX <= rect.right
          && pointerEvent.clientY >= rect.top && pointerEvent.clientY <= rect.bottom;
      });
      if (!target) return;
      const ordered = [...controls.querySelectorAll(options.selector)];
      const buttonIndex = ordered.indexOf(button);
      const targetIndex = ordered.indexOf(target);
      if (buttonIndex < 0 || targetIndex < 0 || buttonIndex === targetIndex) return;
      controls.insertBefore(button, targetIndex > buttonIndex ? target.nextSibling : target);
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', cancel);
      controls.classList.remove('link-reorder-active');
      button.classList.remove('link-dragging');
      try { button.releasePointerCapture(pointerId); } catch (_) {}
    };
    const cancel = pointerEvent => {
      if (pointerEvent.pointerId !== pointerId) return;
      cleanup();
      options.render(button);
    };
    const stop = async pointerEvent => {
      if (pointerEvent.pointerId !== pointerId) return;
      const endIndex = [...controls.querySelectorAll(options.selector)].indexOf(button);
      cleanup();
      button.dataset.suppressLinkClick = 'true';
      setTimeout(() => delete button.dataset.suppressLinkClick, 500);
      if (!dragging) {
        openSavedLink(options.getLinks(button)[startIndex]);
        return;
      }
      if (endIndex < 0 || endIndex === startIndex) {
        options.render(button);
        return;
      }
      const previousLinks = options.getLinks(button);
      options.setLinks(movedLinks(previousLinks, startIndex, endIndex), button);
      controls.classList.add('link-renumber-pending');
      const renumberAfterDelay = new Promise(resolve => setTimeout(resolve, 3000));
      persist();
      if (!await saveArtistsNow()) {
        options.setLinks(previousLinks, button);
        persist();
        controls.classList.remove('link-renumber-pending');
        alert(saveFailureMessage());
        options.render(button);
        return;
      }
      await renumberAfterDelay;
      options.render(button);
    };
    button.setPointerCapture(pointerId);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', cancel);
  }));
}
function thumbnail(url, width = 240) { return ''; }
function isExternalImageSource(value) { return /^https?:\/\//i.test(String(value || '')); }
const offlineArtworkPlaceholder = 'data/thumbnails/_placeholder/artwork-placeholder.png';
function localArtworkImage(work) {
  const image = work?.thumbnail || '';
  if (!image || isExternalImageSource(image)) return offlineArtworkPlaceholder;
  if (image === offlineArtworkPlaceholder) return image;
  return work?.thumbnailCacheKey ? `${image}?v=${encodeURIComponent(work.thumbnailCacheKey)}` : image;
}
function externalArtworkImage(work, width = 240) {
  return '';
}
function artworkImageDisplay(work, {detail=false} = {}) {
  const highRes = work?.highResImage || '';
  if (detail && highRes && !isExternalImageSource(highRes)) return {src:highRes, urlDependent:false};
  const local = localArtworkImage(work);
  if (local && local !== offlineArtworkPlaceholder) return {src:local, urlDependent:false};
  const external = externalArtworkImage(work, detail ? 1200 : 240);
  return external ? {src:external, urlDependent:true} : {src:'', urlDependent:false};
}
function urlDependencyBadge() {
  return `<span class="url-dependency-badge" title="${esc(language === 'ko' ? '로컬 파일 없이 외부 URL에 의존하는 이미지입니다. 로컬 이미지 교체 버튼으로 바꿀 수 있습니다.' : 'This image depends on an external URL. Replace it with a local image when possible.')}">${esc(language === 'ko' ? 'URL 의존' : 'URL dependent')}</span>`;
}
function artworkPreviewImage(work) {
  return artworkImageDisplay(work).src;
}

async function loadArtistFile() {
  try {
    const response = await fetch(apiUrl('/api/artists'), {cache:'no-store'});
    if (response.ok) return await response.json();
  } catch (_) {
    /* Static-file fallback keeps the app readable if the save API is unavailable. */
  }
  try {
    const response = await fetch('data/artists.json', {cache:'no-store'});
    if (response.ok) return await response.json();
  } catch (_) {
    /* The local file is unavailable. */
  }
  return {artists:[],deletedArtists:[]};
}

function artistSnapshot() { return JSON.stringify({dataSchema:1,metadata:collectionMetadata,artists:artists.map(applyArtistOverrides),deletedArtists:[],historicalEvents:customHistoricalEvents,favoriteWorks:[...favoriteWorkKeys].sort(),changeMeta:{actor:currentUserEmail,role:currentUserRole}}); }
async function loadCurrentUserRole() {
  favoriteWorkKeys = currentUserIsAdmin ? readLocalFavoriteWorkKeys() : new Set();
  document.body.classList.remove('auth-pending');
  document.body.classList.add('auth-ready');
}
function enterViewerMode() {
  if (adminSessionHeartbeat) clearInterval(adminSessionHeartbeat);
  adminSessionHeartbeat = undefined;
  currentUserEmail = '';
  currentUserRole = 'viewer';
  currentUserIsAdmin = false;
  adminSessionToken = '';
  try { sessionStorage.setItem(accessSessionStorageKey, JSON.stringify({role:'viewer'})); } catch (_) {}
  clearLoginRequestFromUrl();
}
function saveAdminSession(email, token) {
  try { sessionStorage.setItem(accessSessionStorageKey, JSON.stringify({role:'admin',email,token})); } catch (_) {}
  clearLoginRequestFromUrl();
}
async function logoutEverywhere() {
  try { await apiFetch('/api/auth/logout',{method:'POST',cache:'no-store'}); } catch (_) {}
  if (adminSessionHeartbeat) clearInterval(adminSessionHeartbeat);
  try { sessionStorage.removeItem(accessSessionStorageKey); } catch (_) {}
  try { localStorage.setItem('art-atlas-logout-signal', String(Date.now())); } catch (_) {}
  location.assign(new URL('index.html?login=1', location.href).href);
}
function savedAccessSession() {
  try {
    const saved=JSON.parse(sessionStorage.getItem(accessSessionStorageKey) || 'null');
    return saved && ['admin','viewer'].includes(saved.role) ? saved : null;
  } catch (_) {
    return null;
  }
}
function startAdminSessionHeartbeat() {
  if (adminSessionHeartbeat) clearInterval(adminSessionHeartbeat);
  const keepAlive = async () => {
    if (!currentUserIsAdmin) return;
    try {
      const response = await apiFetch('/api/auth/heartbeat',{method:'POST',cache:'no-store'});
      if (!response.ok) throw new Error('관리자 세션이 종료되었습니다.');
    } catch (_) {
      enterViewerMode();
      render();
    }
  };
  adminSessionHeartbeat = setInterval(keepAlive,20000);
}
async function chooseAccessMode() {
  const saved=savedAccessSession();
  if (saved?.role === 'admin' && saved.token) {
    currentUserEmail=String(saved.email || '');
    currentUserRole='admin';
    currentUserIsAdmin=true;
    adminSessionToken=saved.token;
    try {
      const response=await apiFetch('/api/auth/heartbeat',{method:'POST',cache:'no-store'});
      if (!response.ok) throw new Error('Administrator session expired');
      startAdminSessionHeartbeat();
      clearLoginRequestFromUrl();
      return;
    } catch (_) {
      try { sessionStorage.removeItem(accessSessionStorageKey); } catch (_) {}
      currentUserEmail='';
      currentUserRole='viewer';
      currentUserIsAdmin=false;
      adminSessionToken='';
      if (isMovementPopup) return;
    }
  }
  if (requestedArtistId && !forceLogin) {
    enterViewerMode();
    return;
  }
  if (saved?.role === 'viewer') {
    enterViewerMode();
    return;
  }
  if (isMovementPopup) {
    enterViewerMode();
    return;
  }
  let adminUnavailableMessage = '';
  try {
    const response = await fetch(apiUrl('/api/access'), {cache:'no-store'});
    const access = response.ok ? await response.json() : null;
    if (access?.adminConfigured === false) {
      adminUnavailableMessage = '관리자 설정 파일(.env)이 없어 지금은 보기 전용으로 실행 중입니다. 건너뛰기를 누르면 자료를 볼 수 있습니다.';
    }
  } catch (_) {
    /* When the local server is unavailable, keep the manual viewer choice. */
  }
  return new Promise(resolve => {
    const email = $('#auth-email');
    const password = $('#auth-password');
    const message = $('#auth-message');
    const submit = $('#auth-form .save');
    const showMessage = text => { message.textContent = text; message.classList.remove('hidden'); };
    const finishAsViewer = () => {
      enterViewerMode();
      authDialog.close();
      resolve();
    };
    if (adminUnavailableMessage) {
      showMessage(adminUnavailableMessage);
      submit.disabled = true;
      email.disabled = true;
      password.disabled = true;
    } else {
      submit.disabled = false;
      email.disabled = false;
      password.disabled = false;
    }
    $('#auth-skip').onclick = finishAsViewer;
    $('#auth-form').onsubmit = async event => {
      event.preventDefault();
      if (adminUnavailableMessage) return;
      message.classList.add('hidden');
      try {
        const response = await fetch(apiUrl('/api/auth/login'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value,password:password.value})});
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.token) throw new Error(result.error || '인증에 실패했습니다.');
        currentUserEmail = result.email;
        currentUserRole = 'admin';
        currentUserIsAdmin = true;
        adminSessionToken = result.token;
        saveAdminSession(result.email, result.token);
        startAdminSessionHeartbeat();
        password.value = '';
        authDialog.close();
        resolve();
      } catch (error) {
        showMessage(error.message || '이메일 또는 비밀번호를 확인하세요.');
        password.focus();
      }
    };
    authDialog.showModal();
    email.focus();
  });
}
function readLocalFavoriteWorkKeys() {
  try {
    const keys = JSON.parse(localStorage.getItem(favoriteWorksStorageKey) || '[]');
    return new Set(Array.isArray(keys) ? keys : []);
  } catch (_) {
    return new Set();
  }
}

async function saveArtistsNow() {
  if (!currentUserIsAdmin) return false;
  const snapshot = artistSnapshot();
  if (snapshot === lastSavedSnapshot) return true;
  try {
    const response = await apiFetch('/api/artists', {method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    if (Number.isInteger(result.revision)) collectionMetadata = {...collectionMetadata,revision:result.revision};
    lastSavedSnapshot = artistSnapshot();
    lastSaveError = '';
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    // User data must be portable: never leave a new record only in this browser.
    lastSaveError = error?.message || '저장 요청을 처리하지 못했습니다.';
    localStorage.removeItem(storageKey);
    return false;
  }
}
function saveFailureMessage() {
  const reason = lastSaveError || (language === 'ko' ? '알 수 없는 오류' : 'Unknown error');
  return language === 'ko'
    ? `관리자 저장에 실패했습니다: ${reason}`
    : `Administrator save failed: ${reason}`;
}
async function normalizeArtistWorksBeforeSave(artist) {
  return artist;
}

function queueArtistSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveArtistsNow, 250);
}

async function loadData() {
  const browserFavoriteWorks = [...favoriteWorkKeys];
  const fileData = await loadArtistFile();
  collectionMetadata = fileData.metadata || collectionMetadata;
  customHistoricalEvents = Array.isArray(fileData.historicalEvents) ? fileData.historicalEvents : [];
  // Existing browser selections are imported once when moving to file-based storage.
  const fileFavoriteWorks = currentUserIsAdmin && Array.isArray(fileData.favoriteWorks) ? fileData.favoriteWorks : [];
  const savedFavoriteWorks = currentUserIsAdmin ? fileFavoriteWorks : [];
  favoriteWorkKeys = new Set([...savedFavoriteWorks, ...browserFavoriteWorks]);
  artists = (fileData.artists || []).map(applyArtistOverrides);
  lastSavedSnapshot = artistSnapshot();
  if (currentUserIsAdmin && !Array.isArray(fileData.favoriteWorks)) lastSavedSnapshot = '';
  localStorage.removeItem(storageKey);
  if (!currentUserIsAdmin) localStorage.removeItem(favoriteWorksStorageKey);
  try {
    const curated = await (await fetch('data/featured-works.json')).json();
    curated.artists.forEach(entry => { const artist = artists.find(item => item.id === entry.id || (entry.qid && item.qid === entry.qid)); if (!artist) return; entry.works.forEach(work => { const existing = (artist.works || []).find(item => item.id === work.id); if (existing) { const preserved = {description:existing.description,detail:existing.detail,thumbnail:existing.thumbnail,thumbnailValidation:existing.thumbnailValidation,highResImage:existing.highResImage,highResOriginal:existing.highResOriginal}; Object.assign(existing, work); if (!loc(work.description)) existing.description = preserved.description; if (preserved.detail) existing.detail = preserved.detail; if (preserved.thumbnail) existing.thumbnail = preserved.thumbnail; if (preserved.thumbnailValidation) existing.thumbnailValidation = preserved.thumbnailValidation; if (preserved.highResImage) existing.highResImage = preserved.highResImage; if (preserved.highResOriginal) existing.highResOriginal = preserved.highResOriginal; } else artist.works.push(work); }); artist.works = selectArtistWorks(artist.works || [], artistImportedWorkLimit, artist); });
    if (currentUserIsAdmin) await saveArtistsNow();
  } catch (_) { /* The main collection continues to work without the optional curated list. */ }
  await markLegacyManualWorks();
  if (currentUserIsAdmin) await saveArtistsNow();
  try { artTaxonomy = await (await fetch('data/art-taxonomy.json')).json(); } catch (_) { artTaxonomy = {periods:[], movements:[]}; }
  try { movementCountries = (await (await fetch('data/art-movements.json')).json()).countries || []; } catch (_) { movementCountries = []; }
  try { movementDocuments = (await (await fetch(apiUrl('/api/movement-documents'))).json()).documents || {}; } catch (_) { movementDocuments = {}; }
  const requestedArtist = requestedArtistId ? artists.find(a => a.id === requestedArtistId) : null;
  if (requestedArtist) {
    selectedId = requestedArtistId;
    viewMode = 'timeline';
    localStorage.setItem('art-atlas-selected', selectedId);
  } else if (requestedArtistId) {
    requestedArtistMissing = true;
    selectedId = null;
    viewMode = 'timeline';
    localStorage.removeItem('art-atlas-selected');
  }
  if (!requestedArtistMissing && (!selectedId || !artists.some(a => a.id === selectedId))) selectedId = artists[0]?.id;
  await hydrateThumbnails(artists.find(artist => artist.id === selectedId));
  render();
  restoreLastTimelinePosition();
  persistFavoriteWorks();
}
async function markLegacyManualWorks() {
  await Promise.all(artists.map(async artist => {
    if (!artist.generated?.file) return;
    try {
      const catalogue = await (await fetch(artist.generated.file)).json();
      const generatedKeys = new Set((catalogue.works || []).map(selectionKey));
      (artist.works || []).forEach(work => {
        if (!work.origin && !generatedKeys.has(selectionKey(work))) work.origin = 'manual';
      });
    } catch (_) { /* Without the prior catalogue, leave existing provenance untouched. */ }
  }));
}
function persist() { localStorage.setItem('art-atlas-selected', selectedId || ''); queueArtistSave(); }
function persistMovementView() { localStorage.setItem(movementStorageKey, JSON.stringify(movementView)); }
function readLastPosition() {
  try { return JSON.parse(localStorage.getItem(lastPositionStorageKey) || '{}') || {}; }
  catch (_) { return {}; }
}
function persistLastPosition(artist, work) {
  if (!artist?.id || !work?.id) return;
  localStorage.setItem(lastPositionStorageKey, JSON.stringify({
    artistId: artist.id,
    workId: work.id,
    scrollTop: timeline.scrollTop || 0
  }));
}
function rememberCurrentTimelineScroll() {
  if (viewMode !== 'timeline') return;
  const last = readLastPosition();
  if (last.artistId !== selectedId || !last.workId) return;
  localStorage.setItem(lastPositionStorageKey, JSON.stringify({...last, scrollTop:timeline.scrollTop || 0}));
}
function restoreLastTimelinePosition() {
  if (isMovementPopup || viewMode !== 'timeline' || requestedArtistMissing) return;
  const artist = artists.find(item => item.id === selectedId);
  if (!artist) return;
  const last = readLastPosition();
  const savedWork = last.artistId === artist.id && last.workId
    ? (artist.works || []).find(item => item.id === last.workId)
    : null;
  if (!savedWork) return;
  if (Number.isFinite(Number(last.scrollTop))) {
    requestAnimationFrame(() => { timeline.scrollTop = Math.max(0, Number(last.scrollTop)); });
  }
}
function years(artist) { return artist.birth ? `${artist.birth} — ${artist.death || '…'}` : t('unknown'); }
function artworkMovement(work, artist) { return loc(work?.movement) || loc(artistMovementFallbacks[artist?.qid]); }
function primaryMovement(artist) {
  if (artist?.qid === 'Q47551') return language === 'ko' ? '르네상스 · 베네치아 화파' : 'Renaissance · Venetian School';
  const artistMovement = loc(artist?.movement) || loc(artistMovementFallbacks[artist?.qid]);
  if (artistMovement) return artistMovement;
  const counts = new Map();
  (artist.works || []).forEach(work => { const movement = artworkMovement(work,artist); if (movement) counts.set(movement, (counts.get(movement) || 0) + 1); });
  return [...counts.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] || '';
}
function movementContributionWorksForArtist(artist, sourceWorks=artist?.works || []) {
  const visibleKeys = new Set((sourceWorks || []).map(selectionKey).filter(Boolean));
  const selected = selectArtistWorks(artist?.works || [], artistImportedWorkLimit, artist);
  return selected
    .filter(work => work.movementContribution)
    .sort((a,b) => movementContributionScore(b,artist) - movementContributionScore(a,artist) || workYearForSort(a) - workYearForSort(b))
    .slice(0,3)
    .map(work => (artist.works || []).find(item => selectionKey(item) === selectionKey(work)) || work)
    .filter(work => work && (!visibleKeys.size || visibleKeys.has(selectionKey(work)) || work.image || work.thumbnail));
}
function compactMovementName(value='') { return String(value).normalize('NFKC').toLocaleLowerCase().replace(/[^0-9a-z가-힣]+/g,''); }
function movementFilterSpec(label, includes=[], extra={}) {
  const keys = new Set([label?.ko, label?.en, ...includes].filter(Boolean).map(compactMovementName));
  return {
    ...extra,
    id: extra.id || compactMovementName(label?.en || label?.ko || ''),
    label,
    includes,
    keys
  };
}
const artistMovementFilterHierarchy = [
  movementFilterSpec({ko:'르네상스', en:'Renaissance'}, [
    'Italian Renaissance','High Renaissance','Northern Renaissance','German Renaissance','Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','French Renaissance','Danish Renaissance','Nordic Renaissance','Venetian School','Venetian school','Venetian Renaissance','Proto-Renaissance',
    '이탈리아 르네상스','전성기 르네상스','북유럽 르네상스','북방 르네상스','독일 르네상스','초기 네덜란드 회화','플랑드르파','네덜란드 및 플랑드르 르네상스 회화','프랑스 르네상스','덴마크 르네상스','북유럽 르네상스','베네치아 화파','베네치아 르네상스','선르네상스'
  ], {
    id: 'group:renaissance',
    children: [
      movementFilterSpec({ko:'이탈리아 르네상스', en:'Italian Renaissance'}, ['Italian Renaissance','High Renaissance','Proto-Renaissance','이탈리아 르네상스','전성기 르네상스','선르네상스']),
      movementFilterSpec({ko:'베네치아 화파', en:'Venetian School'}, ['Venetian School','Venetian school','Venetian Renaissance','베네치아 화파','베네치아 르네상스']),
      movementFilterSpec({ko:'북유럽 르네상스', en:'Northern Renaissance'}, ['Northern Renaissance','북유럽 르네상스','북방 르네상스','German Renaissance','독일 르네상스','Danube School','도나우파','Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','초기 네덜란드 회화','플랑드르파','플랑드르 르네상스','Flemish Renaissance','네덜란드 및 플랑드르 르네상스 회화','네덜란드·플랑드르 르네상스'], {
        children: [
          movementFilterSpec({ko:'독일 르네상스', en:'German Renaissance'}, ['German Renaissance','독일 르네상스','Danube School','도나우파'], {
            children: [
              movementFilterSpec({ko:'도나우파', en:'Danube School'}, ['Danube School','도나우파'])
            ]
          }),
          movementFilterSpec({ko:'저지대 르네상스', en:'Low Countries Renaissance'}, ['Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','초기 네덜란드 회화','플랑드르파','플랑드르 르네상스','Flemish Renaissance','네덜란드 및 플랑드르 르네상스 회화','네덜란드·플랑드르 르네상스'], {
            children: [
              movementFilterSpec({ko:'초기 네덜란드 회화', en:'Early Netherlandish painting'}, ['Early Netherlandish painting','초기 네덜란드 회화','플랑드르파']),
              movementFilterSpec({ko:'플랑드르 르네상스', en:'Flemish Renaissance'}, ['Flemish Renaissance','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','플랑드르 르네상스','네덜란드 및 플랑드르 르네상스 회화'])
            ]
          })
        ]
      }),
      movementFilterSpec({ko:'프랑스 르네상스', en:'French Renaissance'}, ['French Renaissance','프랑스 르네상스']),
      movementFilterSpec({ko:'덴마크 르네상스', en:'Danish Renaissance'}, ['Danish Renaissance','덴마크 르네상스']),
      movementFilterSpec({ko:'노르딕 르네상스', en:'Nordic Renaissance'}, ['Nordic Renaissance','북유럽 르네상스','노르딕 르네상스'])
    ]
  }),
  movementFilterSpec({ko:'매너리즘', en:'Mannerism'}, ['Mannerism','매너리즘'], {
    id:'mannerism',
    children: [
      movementFilterSpec({ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'}, ['Florentine-Roman Mannerism','Florentine Mannerism','Roman Mannerism','피렌체-로마 매너리즘','피렌체·로마 매너리즘']),
      movementFilterSpec({ko:'파르마·에밀리아 매너리즘', en:'Parma and Emilian Mannerism'}, ['Parma and Emilian Mannerism','Parma Mannerism','Emilian Mannerism','파르마와 에밀리아 계열','파르마·에밀리아 매너리즘']),
      movementFilterSpec({ko:'퐁텐블로파', en:'School of Fontainebleau'}, ['School of Fontainebleau','Fontainebleau School','퐁텐블로파']),
      movementFilterSpec({ko:'스페인 매너리즘', en:'Spanish Mannerism'}, ['Spanish Mannerism','스페인 매너리즘']),
      movementFilterSpec({ko:'네덜란드 매너리즘', en:'Dutch Mannerism'}, ['Dutch Mannerism','Haarlem Mannerism','Netherlandish Mannerism','네덜란드 매너리즘','하를럼 매너리즘']),
      movementFilterSpec({ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'}, ['Prague Court Mannerism','Habsburg Court Mannerism','Rudolfine Mannerism','프라하 궁정 매너리즘','프라하·합스부르크 궁정','루돌프 2세 궁정 매너리즘'])
    ]
  }),
  movementFilterSpec({ko:'바로크', en:'Baroque'}, ['Baroque art','Italian Baroque painting','Flemish Baroque painting','Spanish Baroque','Dutch Baroque','Dutch Golden Age painting','바로크','이탈리아 바로크 회화','플랑드르 바로크 회화','스페인 바로크','네덜란드 바로크','네덜란드 황금기 회화'], {
    id:'baroque',
    children: [
      movementFilterSpec({ko:'이탈리아 바로크 회화', en:'Italian Baroque painting'}, ['Italian Baroque painting','이탈리아 바로크 회화']),
      movementFilterSpec({ko:'플랑드르 바로크 회화', en:'Flemish Baroque painting'}, ['Flemish Baroque painting','플랑드르 바로크 회화']),
      movementFilterSpec({ko:'네덜란드 황금기 회화', en:'Dutch Golden Age painting'}, ['Dutch Golden Age painting','Dutch Baroque','네덜란드 황금기 회화','네덜란드 바로크'])
    ]
  }),
  movementFilterSpec({ko:'낭만주의', en:'Romanticism'}, ['German Romanticism','Romanticism','낭만주의','독일 낭만주의'], {id:'romanticism'})
];
function movementFilterTreeKeys(node) {
  return new Set([...(node?.keys || []), ...(node?.children || []).flatMap(child => [...movementFilterTreeKeys(child)])]);
}
function findMovementFilterNode(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const found = findMovementFilterNode(node.children, id);
    if (found) return found;
  }
  return null;
}
function filterMovementTreeForArtists(node, direct) {
  const children = (node.children || []).map(child => filterMovementTreeForArtists(child, direct)).filter(Boolean);
  return [...(node.keys || [])].some(key => direct.has(key)) || children.length ? {...node, children} : null;
}
const artistMovementFilterGroups = artistMovementFilterHierarchy.map(group => ({...group, keys:movementFilterTreeKeys(group)}));
const artistMovementFilterOrder = [
  'Mannerism','Baroque','Rococo','Neoclassicism','Romanticism','Realism','Impressionism','Post-Impressionism','Fauvism','Cubism','Dada','Surrealism',
  'Biedermeier','Symbolism','Expressionism','New Objectivity','Bauhaus','Danube School','Dutch Golden Age painting','Arts and Crafts movement'
].map((name, index) => [compactMovementName(name), index]);
const artistMovementFilterOrderIndex = new Map(artistMovementFilterOrder);
const artistMovementDisplayRules = [
  movementFilterSpec({ko:'이탈리아 르네상스', en:'Italian Renaissance'}, ['Italian Renaissance','High Renaissance','Proto-Renaissance','이탈리아 르네상스','전성기 르네상스','선르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'르네상스', en:'Renaissance'}}),
  movementFilterSpec({ko:'베네치아 화파', en:'Venetian School'}, ['Venetian School','Venetian school','Venetian Renaissance','베네치아 화파','베네치아 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'르네상스', en:'Renaissance'}}),
  movementFilterSpec({ko:'북유럽 르네상스', en:'Northern Renaissance'}, ['Northern Renaissance','북유럽 르네상스','북방 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'북유럽 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'독일 르네상스', en:'German Renaissance'}, ['German Renaissance','독일 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'북유럽 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'도나우파', en:'Danube School'}, ['Danube School','도나우파'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'도나우파', en:'Danube School'}}),
  movementFilterSpec({ko:'네덜란드·플랑드르 르네상스', en:'Netherlandish and Flemish Renaissance'}, ['Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','초기 네덜란드 회화','플랑드르파','네덜란드 및 플랑드르 르네상스 회화','네덜란드·플랑드르 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'북유럽 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'프랑스 르네상스', en:'French Renaissance'}, ['French Renaissance','프랑스 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'르네상스', en:'Renaissance'}}),
  movementFilterSpec({ko:'덴마크 르네상스', en:'Danish Renaissance'}, ['Danish Renaissance','덴마크 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'덴마크 르네상스', en:'Danish Renaissance'}}),
  movementFilterSpec({ko:'노르딕 르네상스', en:'Nordic Renaissance'}, ['Nordic Renaissance','북유럽 르네상스','노르딕 르네상스'], {parent:{ko:'르네상스', en:'Renaissance'}, documentLabel:{ko:'노르딕 르네상스', en:'Nordic Renaissance'}}),
  movementFilterSpec({ko:'플랑드르 바로크 회화', en:'Flemish Baroque painting'}, ['Flemish Baroque painting','플랑드르 바로크 회화'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'이탈리아 바로크 회화', en:'Italian Baroque painting'}, ['Italian Baroque painting','이탈리아 바로크 회화'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'네덜란드 황금기 회화', en:'Dutch Golden Age painting'}, ['Dutch Golden Age painting','Dutch Baroque','네덜란드 황금기 회화','네덜란드 바로크'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'바로크', en:'Baroque'}, ['Baroque art','바로크']),
  movementFilterSpec({ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'}, ['Florentine-Roman Mannerism','Florentine Mannerism','Roman Mannerism','피렌체-로마 매너리즘','피렌체·로마 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'파르마·에밀리아 매너리즘', en:'Parma and Emilian Mannerism'}, ['Parma and Emilian Mannerism','Parma Mannerism','Emilian Mannerism','파르마와 에밀리아 계열','파르마·에밀리아 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'퐁텐블로파', en:'School of Fontainebleau'}, ['School of Fontainebleau','Fontainebleau School','퐁텐블로파'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'스페인 매너리즘', en:'Spanish Mannerism'}, ['Spanish Mannerism','스페인 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'네덜란드 매너리즘', en:'Dutch Mannerism'}, ['Dutch Mannerism','Haarlem Mannerism','Netherlandish Mannerism','네덜란드 매너리즘','하를럼 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'}, ['Prague Court Mannerism','Habsburg Court Mannerism','Rudolfine Mannerism','프라하 궁정 매너리즘','프라하·합스부르크 궁정','루돌프 2세 궁정 매너리즘'], {parent:{ko:'매너리즘', en:'Mannerism'}, documentLabel:{ko:'매너리즘', en:'Mannerism'}}),
  movementFilterSpec({ko:'독일 낭만주의', en:'German Romanticism'}, ['German Romanticism','독일 낭만주의'], {parent:{ko:'낭만주의', en:'Romanticism'}, documentLabel:{ko:'낭만주의', en:'Romanticism'}}),
  movementFilterSpec({ko:'낭만주의', en:'Romanticism'}, ['Romanticism','낭만주의']),
  movementFilterSpec({ko:'후기 인상주의', en:'Post-Impressionism'}, ['Post-Impressionism','Post-impressionism','후기 인상주의','후기인상주의'])
];
const artistMovementClassificationOverrides = {
  Q17169:{ko:'베네치아 화파', en:'Venetian School'},
  Q8459:{ko:'베네치아 화파', en:'Venetian School'},
  Q47551:{ko:'베네치아 화파', en:'Venetian School'},
  Q9319:{ko:'베네치아 화파', en:'Venetian School'},
  Q9440:{ko:'베네치아 화파', en:'Venetian School'},
  Q102272:{ko:'초기 네덜란드 회화', en:'Early Netherlandish painting'},
  Q68631:{ko:'초기 네덜란드 회화', en:'Early Netherlandish painting'},
  Q43270:{ko:'플랑드르 르네상스', en:'Flemish Renaissance'},
  Q5580:{ko:'독일 르네상스', en:'German Renaissance'},
  Q48319:{ko:'독일 르네상스', en:'German Renaissance'},
  Q191748:{ko:'독일 르네상스', en:'German Renaissance'},
  Q153746:{ko:'도나우파', en:'Danube School'},
  Q610556:{ko:'도나우파', en:'Danube School'},
  Q207929:{ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'},
  Q312617:{ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'},
  Q9348:{ko:'파르마·에밀리아 매너리즘', en:'Parma and Emilian Mannerism'},
  Q7803:{ko:'피렌체·로마 매너리즘', en:'Florentine-Roman Mannerism'},
  Q333366:{ko:'퐁텐블로파', en:'School of Fontainebleau'},
  Q301:{ko:'스페인 매너리즘', en:'Spanish Mannerism'},
  Q165367:{ko:'네덜란드 매너리즘', en:'Dutch Mannerism'},
  Q442484:{ko:'네덜란드 매너리즘', en:'Dutch Mannerism'},
  Q329811:{ko:'네덜란드 매너리즘', en:'Dutch Mannerism'},
  Q447682:{ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'},
  Q7751:{ko:'프라하 궁정 매너리즘', en:'Prague Court Mannerism'}
};
function movementEntry(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const label = value.trim();
    return label ? {id:compactMovementName(label), label} : null;
  }
  const label = loc(value);
  const id = compactMovementName(value.en || value.ko || label);
  return id && label ? {id, label} : null;
}
function artistMovementEntries(artist) {
  const override = artistMovementClassificationOverrides[artist?.qid] || artistMovementClassificationOverrides[artist?.id];
  const entries = [movementEntry(override), movementEntry(artist?.movement), movementEntry(artistMovementFallbacks[artist?.qid])];
  if (!entries.some(Boolean)) entries.push(movementEntry(primaryMovement(artist)));
  const seen = new Set();
  return entries.filter(entry => entry && !seen.has(entry.id) && seen.add(entry.id));
}
function artistMovementDisplayInfo(artist) {
  const entry = artistMovementEntries(artist)[0] || movementEntry(primaryMovement(artist));
  if (!entry) return {label:'', documentLabel:''};
  const rule = artistMovementDisplayRules.find(item => item.keys.has(entry.id));
  if (!rule) return {label:entry.label, parentLabel:entry.label, documentLabel:entry.label};
  const label = loc(rule.label) || entry.label;
  const parent = loc(rule.parent);
  const display = parent && compactMovementName(label) !== compactMovementName(parent) ? `${label} - ${parent}` : label;
  return {label:display, parentLabel:parent || label, documentLabel:loc(rule.documentLabel) || label};
}
function artistMatchesMovementFilter(artist) {
  if (!artistMovementFilter) return true;
  const entries = artistMovementEntries(artist);
  const node = findMovementFilterNode(artistMovementFilterHierarchy, artistMovementFilter);
  if (node) return entries.some(entry => movementFilterTreeKeys(node).has(entry.id));
  return entries.some(entry => entry.id === artistMovementFilter);
}
function artistMovementFilterOptions() {
  const direct = new Map();
  (artists || []).forEach(artist => artistMovementEntries(artist).forEach(entry => {
    if (!direct.has(entry.id)) direct.set(entry.id, {id:entry.id, label:entry.label});
  }));
  const hierarchy = artistMovementFilterHierarchy.map(group => filterMovementTreeForArtists(group, direct)).filter(Boolean);
  const consumed = new Set(hierarchy.flatMap(group => [...movementFilterTreeKeys(group)]));
  const directOptions = [...direct.values()]
    .filter(option => option.label && !consumed.has(option.id))
    .filter((option,index,self) => self.findIndex(item => compactMovementName(item.label) === compactMovementName(option.label)) === index)
    .sort((a,b) => (artistMovementFilterOrderIndex.get(a.id) ?? 9999) - (artistMovementFilterOrderIndex.get(b.id) ?? 9999) || a.label.localeCompare(b.label, language));
  return [...hierarchy, ...directOptions];
}
function movementFilterLabelForValue(groups, value) {
  if (!value) return t('allMovements');
  return loc(findMovementFilterNode(groups, value)?.label) || t('allMovements');
}
function selectArtistMovementFilter(value='') {
  artistMovementFilter = value;
  artistMovementFilterMenuOpen = false;
  renderList();
}
function renderArtistMovementFilter() {
  const trigger = $('#artist-movement-filter-trigger');
  const menu = $('#artist-movement-filter-menu');
  if (!trigger || !menu) return;
  const groups = artistMovementFilterOptions();
  if (artistMovementFilter && !findMovementFilterNode(groups, artistMovementFilter)) artistMovementFilter = '';
  const expandSelectedAncestors = nodes => (nodes || []).some(node => {
    if (node.id === artistMovementFilter) return true;
    const containsSelection = expandSelectedAncestors(node.children);
    if (containsSelection) expandedArtistMovementGroups.add(node.id);
    return containsSelection;
  });
  expandSelectedAncestors(groups);
  trigger.textContent = movementFilterLabelForValue(groups, artistMovementFilter);
  trigger.title = t('movementFilter');
  trigger.setAttribute('aria-label', t('movementFilter'));
  trigger.setAttribute('aria-expanded', String(artistMovementFilterMenuOpen));
  menu.classList.toggle('hidden', !artistMovementFilterMenuOpen);
  const itemButton = (option, className='') => `<button type="button" class="artist-movement-filter-option ${className}${artistMovementFilter === option.id ? ' active' : ''}" role="option" aria-selected="${artistMovementFilter === option.id}" data-movement-filter-value="${esc(option.id)}">${esc(option.label)}</button>`;
  const groupMarkup = (group, depth=0) => {
    const children = group.children || [];
    if (!children.length) return itemButton(group, depth ? `artist-movement-filter-child depth-${depth}` : '');
    const collapsible = children.length > 1;
    const expanded = !collapsible || expandedArtistMovementGroups.has(group.id);
    const toggleLabel = expanded
      ? (language === 'ko' ? `${group.label} 하위 사조 접기` : `Collapse ${group.label}`)
      : (language === 'ko' ? `${group.label} 하위 사조 펼치기` : `Expand ${group.label}`);
    return `<div class="artist-movement-filter-group depth-${depth}${expanded ? ' expanded' : ''}" data-movement-filter-group="${esc(group.id)}"><div class="artist-movement-filter-group-row">${itemButton(group, depth ? 'artist-movement-filter-parent artist-movement-filter-child' : 'artist-movement-filter-parent')}${collapsible ? `<button type="button" class="artist-movement-filter-toggle" data-movement-filter-toggle="${esc(group.id)}" aria-expanded="${expanded}" aria-label="${esc(toggleLabel)}">${expanded ? '▴' : '▾'}</button>` : ''}</div>${expanded ? `<div class="artist-movement-filter-children">${children.map(child => groupMarkup(child, depth + 1)).join('')}</div>` : ''}</div>`;
  };
  menu.innerHTML = `<button type="button" class="artist-movement-filter-option artist-movement-filter-all${!artistMovementFilter ? ' active' : ''}" role="option" aria-selected="${!artistMovementFilter}" data-movement-filter-value="">${esc(t('allMovements'))}</button>${groups.map(groupMarkup).join('')}`;
  menu.querySelectorAll('[data-movement-filter-value]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      selectArtistMovementFilter(button.dataset.movementFilterValue || '');
    };
  });
  menu.querySelectorAll('[data-movement-filter-toggle]').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const groupId = button.dataset.movementFilterToggle;
      if (expandedArtistMovementGroups.has(groupId)) expandedArtistMovementGroups.delete(groupId);
      else expandedArtistMovementGroups.add(groupId);
      artistMovementFilterMenuOpen = true;
      renderArtistMovementFilter();
    };
  });
  const clear = $('#artist-movement-filter-clear');
  if (clear) {
    clear.hidden = !artistMovementFilter;
    clear.title = t('clearMovementFilter');
    clear.setAttribute('aria-label', t('clearMovementFilter'));
  }
}
function movementDocumentKey(label='') {
  const compact = compactMovementName(label);
  if (!compact) return '';
  const documentNames = Object.keys(movementDocuments || {});
  const direct = documentNames.find(name => compactMovementName(name) === compact);
  if (direct) return direct;
  const knownMovement = movementCountries.flatMap(country => country.movements || []).find(movement => [movement.name?.ko, movement.name?.en].some(name => compactMovementName(name) === compact));
  if (knownMovement?.name?.en && movementDocuments?.[knownMovement.name.en]?.['1']) return knownMovement.name.en;
  const aliases = {
    '후기인상주의':'Post-Impressionism',
    '이탈리아르네상스':'Renaissance',
    '전성기르네상스':'Renaissance',
    '선르네상스':'Renaissance',
    '베네치아화파':'Renaissance',
    '베네치아르네상스':'Renaissance',
    '플랑드르바로크회화':'Baroque',
    '이탈리아바로크회화':'Baroque',
    '네덜란드황금기회화':'Baroque',
    'dutchgoldenagepainting':'Baroque',
    '네덜란드바로크':'Baroque',
    'dutchbaroque':'Baroque',
    '독일낭만주의':'Romanticism',
    'highrenaissance':'Renaissance',
    'rococopainting':'Rococo'
  };
  const alias = aliases[compact];
  return alias && movementDocuments?.[alias]?.['1'] ? alias : '';
}
function normalizeMovementView(value) {
  let start = Number(value?.start);
  let end = Number(value?.end);
  if (!Number.isFinite(start)) start = defaultMovementView.start;
  if (!Number.isFinite(end)) end = defaultMovementView.end;
  start = Math.min(movementAtlasEnd - movementMinimumRangeSpan, Math.max(movementAtlasMinimum, Math.round(start)));
  end = Math.max(start + movementMinimumRangeSpan, Math.min(movementAtlasEnd, Math.round(end)));
  let density = Number(value?.density);
  if (!Number.isFinite(density)) density = defaultMovementView.density;
  density = Math.round(Math.min(movementDensityMaximum, Math.max(movementDensityMinimum, density)) * 10) / 10;
  return {
    // An empty array is a valid "clear all" choice; only a missing or malformed value uses the default.
    countries: Array.isArray(value?.countries) ? value.countries : [...defaultMovementView.countries],
    start,
    end,
    showHistoricalEvents: value?.showHistoricalEvents !== false,
    density,
  };
}
function parseMovementView() {
  try { return normalizeMovementView(JSON.parse(localStorage.getItem(movementStorageKey) || JSON.stringify(defaultMovementView))); }
  catch (_) { return normalizeMovementView(defaultMovementView); }
}
async function hydrateArtistProfile(artist) {
  const hasOriginalName = /[A-Za-z]/.test(artist?.name?.en || '');
  if (!artist?.qid || (artist.profileResolved && hasOriginalName) || profileRequests.has(artist.id)) return;
  profileRequests.add(artist.id);
  try {
    const response = await fetch(`/api/artist-profile?qid=${encodeURIComponent(artist.qid)}`);
    if (!response.ok) return;
    const profile = await response.json();
    if (profile.name?.en) { artist.name = {...profile.name, ko:/[가-힣]/.test(artist.name?.ko || '') ? artist.name.ko : profile.name.ko}; artist.birth = profile.birth || artist.birth; artist.death = profile.death || artist.death; artist.nationality = profile.nationality || artist.nationality; artist.profileResolved = true; persist(); if (selectedId === artist.id) render(); }
  } catch (_) { /* Keep the locally stored name if the profile cannot be read. */ }
}
function renderText() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-display-mode]').forEach(button => {
    const active = button.dataset.displayMode === uHangulMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  window.dispatchEvent(new CustomEvent('uhangulmodechange', {detail:{mode:uHangulMode}}));
  const migrationExportButton = $('#migration-export-button');
  migrationExportButton.classList.toggle('hidden', !currentUserIsAdmin);
  migrationExportButton.textContent = t('migrationExport');
  const addButton = $('#add-button');
  if (addButton) {
    addButton.classList.toggle('hidden', !currentUserIsAdmin);
    addButton.title = t('addArtistTooltip');
    addButton.setAttribute('aria-label', t('addArtistTooltip'));
  }
  $('#movement-atlas-button').classList.toggle('active', viewMode === 'movements');
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
  const effectiveSort = Object.values(artistFacetFilters).some(values => values.size) ? 'birth' : sort;
  const query = artistSearchQuery.toLocaleLowerCase();
  const compactQuery = normalized(artistSearchQuery);
  const ordered = [...artists].filter(a => {
    if (!artistMatchesFacetFilters(a)) return false;
    if (!query) return true;
    const searchText = artistSearchText(a);
    return searchText.includes(query) || (compactQuery && normalized(searchText).includes(compactQuery));
  }).sort((a,b) => effectiveSort === 'birth' ? (a.birth || 9999) - (b.birth || 9999) : artistDisplayName(a).localeCompare(artistDisplayName(b), language));
  list.innerHTML = ordered.length ? ordered.map(a => {
    const country = artistCountryInfo(a), countryLabel = artistCountryLabel(a), movement = artistMovementDisplayInfo(a).parentLabel;
    const displayName = artistDisplayName(a);
    const nameAttributes = uHangulArtistAttributes(a, displayName);
    const historicalCountry = country.original !== country.name;
    return `<div class="artist-row ${a.id === selectedId ? 'active':''}"><button class="artist-item" data-id="${esc(a.id)}"><span class="avatar ${historicalCountry ? 'historical-country' : ''}" style="background:${countryColor(country.colorKey)};color:${countryInk(country.colorKey)}" title="${esc(countryLabel)}" aria-label="${esc(countryLabel)}">${esc(countryAvatarText(country))}</span><span class="artist-text"><span class="artist-name"${nameAttributes}>${esc(displayName)}</span><span class="artist-years">${years(a)}${movement ? ` · ${esc(movement)}` : ''}</span></span></button>${currentUserIsAdmin ? `<button class="delete-artist" data-id="${esc(a.id)}" title="${esc(t('delete'))}" aria-label="${esc(t('delete'))}">×</button>` : ''}</div>`;
  }).join('') : `<p class="artist-search-empty">${t('noSearchResult')}</p>`;
  list.querySelectorAll('.artist-item').forEach(button => button.onclick = async () => { viewMode = 'timeline'; selectedId = button.dataset.id; persist(); closeDetail(); const artist = artists.find(item => item.id === selectedId); await hydrateThumbnails(artist); renderList(); renderTimeline(); await enrichArtist(); });
  list.querySelectorAll('.delete-artist').forEach(button => button.onclick = async event => { event.stopPropagation(); if (!currentUserIsAdmin || !confirm(t('confirmDelete'))) return; const deleted = artists.find(artist => artist.id === button.dataset.id); artists = artists.filter(artist => artist.id !== button.dataset.id); if (selectedId === button.dataset.id) selectedId = artists[0]?.id || null; persist(); if (!await saveArtistsNow()) { artists.push(deleted); if (!selectedId) selectedId = deleted.id; alert(language === 'ko' ? '삭제 내용을 저장하지 못해 복원했습니다.' : 'The deletion could not be saved, so it was restored.'); } render(); });
  $('#artist-names').innerHTML = artists.flatMap(a => [artistDisplayName(a), a.fullName, a.name?.ko, a.name?.en, ...artistAliases(a)]).filter(Boolean).filter((value,index,self) => self.indexOf(value) === index).map(value => `<option value="${esc(value)}"></option>`).join('');
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
    const movementContribution = Boolean(w.movementContribution);
    const highResSource = w.highResImage && !isExternalImageSource(w.highResImage) ? w.highResImage : '';
    const highRes = Boolean(highResSource);
    const featured = isLeonardoTimeline && leonardoFeaturedWorkIds.has(String(w.id || ''));
    const replaceLabel = language === 'ko' ? '로컬 이미지 교체' : 'Replace with local image';
    const contributionLabel = language === 'ko' ? '화가가 속한 사조의 특성을 잘 보여주는 기여 작품' : 'Work that strongly expresses the artist’s movement contribution';
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
    return `<div class="art-card${movementContribution ? ' movement-contribution-artwork' : ''}" data-work="${esc(w.id)}" data-preview-artist="${esc(previewArtist)}" data-preview-title="${esc(workTitle)}" data-preview-year="${esc(previewYear)}" data-preview-collection="${collection && collection !== t('unknown') ? esc(collection) : ''}" title="${movementContribution ? esc(contributionLabel) : ''}"><span class="art-thumb">${featuredToggle}${image ? `<img src="${esc(image)}" alt="${esc(workTitle)}" loading="lazy"${fallbackImage ? ` data-fallback-src="${esc(fallbackImage)}"` : ''} />${urlBadge}` : `<span class="art-thumb-empty">${esc(t('noImage'))}</span>`}${previewButton}${controls}</span><span class="art-meta">${titleMarkup}${footerMarkup}</span></div>`;
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
    : `${esc(loc(artist.name))}${linkControls}`;
  const slideshowHelp = language === 'ko' ? '전체 화면 슬라이드 쇼 시작 · 5초마다 다음 작품' : 'Start fullscreen slideshow · next artwork every 5 seconds';
  const rulesCheckButton = currentUserIsAdmin ? `<button class="rules-check-button" type="button" data-rules-check hidden></button>` : '';
  const headerActions = rulesCheckButton;
  const timelineHeader = `<header class="timeline-sticky-header"><p class="eyebrow">${t('timeline')}</p><div class="timeline-title-row"><h1 class="timeline-title">${displayName}</h1><div class="timeline-title-actions">${headerActions}</div></div>${currentUserIsAdmin ? `<form class="artist-link-entry hidden"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(linkInputLabel)}" required><button type="submit">${esc(confirmLinkLabel)}</button></form>` : ''}<p class="life">${years(artist)}${nationalityLabel ? ` · ${esc(nationalityLabel)}` : ''}${artistMovement ? ` · ${artistMovementLabel}` : ''}</p></header>`;
  const standardTimelineMarkup = `<div class="timeline">${works.length ? [...worksByYear.entries()].map(([year, group]) => `<div class="timeline-row"><span class="year">${year}</span><span class="node"></span><div class="artworks-at-year">${group.map(card).join('')}</div></div>`).join('') : `<p class="empty-timeline">${t('noWork')}</p>`}</div>`;
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
      const decade = Math.floor(year / 10) * 10;
      const label = Number.isFinite(year) ? (language === 'ko' ? `${decade}년대` : `${decade}s`) : (language === 'ko' ? '연도 미상' : 'Undated');
      periodGroups.set(label, [...(periodGroups.get(label) || []), work]);
    });
    const gallery = `<div class="leonardo-work-grid">${works.map(card).join('')}</div>`;
    const chronology = `<div class="leonardo-period-list">${[...periodGroups.entries()].map(([period, group]) => `<section class="leonardo-period"><h2>${esc(period)}</h2><div class="leonardo-work-grid">${group.map(card).join('')}</div></section>`).join('')}</div>`;
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
  {id:'royal-academy',start:1648,name:{ko:'프랑스 왕립회화조각아카데미 설립',en:'French Royal Academy founded'},impact:{ko:'아카데미 교육·살롱·장르 위계의 제도적 기반이 되었습니다.',en:'Established academic training, Salons, and the hierarchy of genres.'}},
  {id:'enlightenment',start:1680,end:1789,name:{ko:'계몽주의',en:'Enlightenment'},impact:{ko:'이성·공공성·고전 고대에 대한 관심이 신고전주의와 공적 미술 담론의 토대가 되었습니다.',en:'Its emphasis on reason, the public sphere, and classical antiquity helped ground Neoclassicism and public-art discourse.'}},
  {id:'herculaneum-excavations',start:1738,name:{ko:'헤르쿨라네움 발굴 시작',en:'Excavations at Herculaneum begin'},impact:{ko:'고대 로마 미술과 장식에 대한 직접적 관심을 높여 신고전주의의 고고학적 토대를 넓혔습니다.',en:'Heightened direct interest in Roman art and decoration, expanding Neoclassicism’s archaeological foundation.'}},
  {id:'pompeii-excavations',start:1748,name:{ko:'폼페이 발굴 시작',en:'Excavations at Pompeii begin'},impact:{ko:'고대 벽화·건축·일상 문화의 발견이 유럽의 신고전주의 양식과 장식 예술에 영향을 주었습니다.',en:'Discoveries of ancient murals, architecture, and daily life influenced European Neoclassicism and decorative arts.'}},
  {id:'industrial-revolution',start:1760,end:1840,name:{ko:'산업혁명',en:'Industrial Revolution'},impact:{ko:'도시화·새 계층·새 재료가 미술의 주제와 시장을 바꾸었습니다.',en:'Urbanisation, new classes, and new materials changed art subjects and markets.'}},
  {id:'american-revolution',start:1775,end:1783,name:{ko:'미국 독립혁명',en:'American Revolution'},impact:{ko:'공화주의와 시민적 역사화의 상징 언어를 확산했습니다.',en:'Spread republican and civic imagery in history painting.'}},
  {id:'french-revolution',start:1789,end:1799,name:{ko:'프랑스 혁명',en:'French Revolution'},impact:{ko:'왕정 후원과 공공 이미지의 체계를 뒤흔들고 신고전주의 정치미술을 부각했습니다.',en:'Disrupted royal patronage and made Neoclassical political imagery central.'}},
  {id:'congress-vienna',start:1815,name:{ko:'빈 체제 성립',en:'Congress of Vienna order'},impact:{ko:'나폴레옹 전쟁 이후 독일 연방과 복고 질서가 형성되어 독일 낭만주의·비더마이어의 정치적 배경이 되었습니다.',en:'After the Napoleonic Wars, the German Confederation and Restoration order framed German Romanticism and Biedermeier culture.'}},
  {id:'metternich-system',start:1815,end:1848,name:{ko:'메테르니히 체제',en:'Metternich system'},impact:{ko:'검열과 보수적 질서가 공적 정치 표현을 억제하면서 사적 실내문화, 풍경, 시민적 일상에 대한 관심을 강화했습니다.',en:'Censorship and conservative order constrained public politics while intensifying interest in private interiors, landscape, and bourgeois everyday life.'}},
  {id:'july-revolution',start:1830,name:{ko:'프랑스 7월 혁명',en:'July Revolution in France'}},
  {id:'victorian-era',start:1837,end:1901,name:{ko:'빅토리아 시대',en:'Victorian era'},impact:{ko:'산업화·제국주의·도덕관·디자인 개혁이 라파엘 전파와 유미주의의 배경이 되었습니다.',en:'Industrialisation, empire, morality, and design reform framed the Pre-Raphaelites and Aestheticism.'}},
  {id:'february-revolution',start:1848,name:{ko:'프랑스 2월 혁명',en:'February Revolution in France'}},
  {id:'german-revolutions-1848',start:1848,end:1849,name:{ko:'독일 3월 혁명',en:'German revolutions of 1848-1849'},impact:{ko:'자유주의와 민족통일 요구가 폭발하며 비더마이어 이후의 시민사회, 정치 풍자, 사실주의적 문제의식을 자극했습니다.',en:'Liberal and national-unification demands reshaped civic culture, political satire, and realist social concerns after Biedermeier.'}},
  {id:'photography',start:1839,name:{ko:'사진술 공표',en:'Photography announced'},impact:{ko:'재현의 역할을 재정의하고 사실주의·인상주의의 시각 언어에 영향을 주었습니다.',en:'Redefined representation and influenced Realism and Impressionist vision.'}},
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
function atlasEventGroups(start, end) {
  const groups = new Map();
  [...atlasHistoricalEvents, ...customHistoricalEvents].filter(event => event.start <= end && (event.end || event.start) >= start).forEach(event => {
    const key = event.start;
    groups.set(key, [...(groups.get(key) || []), event]);
  });
  return [...groups.entries()].sort(([a],[b]) => a - b);
}
function atlasFitYearScale(start, end) {
  const scrollHeight = window.innerWidth <= 590
    ? window.innerHeight * .72
    : window.innerHeight - 255;
  const availableBarsHeight = Math.max(220, scrollHeight - 92);
  return availableBarsHeight / Math.max(movementMinimumRangeSpan, end - start);
}
function renderAtlasEvents(start, end, height, yearScale) {
  const groups = atlasEventGroups(start, end);
  return `<aside class="atlas-events" style="height:${height + 40}px">${groups.map(([year, events]) => { const top = Math.max(0, year - start) * yearScale; return `<div class="atlas-event-group ${events.length > 1 ? 'same-year' : ''}" style="top:${top}px"><div class="atlas-event-labels">${events.map(event => { const endYear = Math.min(end, event.end || event.start), duration = event.end && event.end > event.start ? `<span class="atlas-event-duration" style="height:${Math.max(6, (endYear - event.start) * yearScale)}px"></span>` : ''; const years = event.end && event.end > event.start ? `${event.start}–${event.end}` : event.start; const impact = loc(event.impact) || ''; return `<button class="atlas-event-label" type="button" data-event-wiki="${esc(event.wiki || event.name?.en || event.name?.ko || '')}" title="${esc(impact)}">${esc(loc(event.name))} (${years})${duration}</button>`; }).join('')}</div>${events.length > 1 ? '<span class="atlas-event-bracket"></span>' : ''}<span class="atlas-event-link"></span></div>`; }).join('')}</aside>`;
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
  const addLabel = language === 'ko' ? '중요 사건 추가' : 'Add important event', nameLabel = language === 'ko' ? '사건 이름' : 'Event name', startLabel = language === 'ko' ? '시작 연도' : 'Start year', endLabel = language === 'ko' ? '종료 연도 (선택)' : 'End year (optional)', saveLabel = language === 'ko' ? '추가하고 저장' : 'Add and save';
  historicalEventDialog.innerHTML = `<form method="dialog" class="event-editor-form"><button class="close" type="button">×</button><p class="eyebrow">HISTORICAL EVENTS</p><h2>${addLabel}</h2><label><span>${nameLabel}</span><input name="name" required></label><label><span>${startLabel}</span><input name="start" type="number" min="-500" max="2026" required></label><label><span>${endLabel}</span><input name="end" type="number" min="-500" max="2026"></label><button class="save" type="submit">${saveLabel}</button><div class="custom-event-list">${customHistoricalEvents.map(event => `<div><span>${esc(loc(event.name))} (${event.start}${event.end ? `–${event.end}` : ''})</span><button type="button" data-delete-event="${esc(event.id)}">×</button></div>`).join('') || `<p>${language === 'ko' ? '추가한 사건이 없습니다.' : 'No custom events yet.'}</p>`}</div></form>`;
  historicalEventDialog.querySelector('.close').onclick = () => historicalEventDialog.close();
  historicalEventDialog.querySelectorAll('[data-delete-event]').forEach(button => button.onclick = async () => { customHistoricalEvents = customHistoricalEvents.filter(event => event.id !== button.dataset.deleteEvent); await saveArtistsNow(); openHistoricalEventEditor(); });
  historicalEventDialog.querySelector('form').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.currentTarget), name = String(form.get('name') || '').trim(), start = Number(form.get('start')), end = Number(form.get('end')) || null; if (!name || !start || (end && end < start)) return; customHistoricalEvents.push({id:`custom-event-${Date.now()}`,name:{ko:name,en:name},start,end}); await saveArtistsNow(); historicalEventDialog.close(); renderMovementAtlas(); };
  historicalEventDialog.showModal();
}
function renderMovementAtlas() {
  timeline.classList.remove('artist-timeline-panel');
  movementView = normalizeMovementView(movementView);
  const start = movementView.start;
  const end = movementView.end;
  const countryEnd = Math.min(movementCountryEnd,end);
  const countryOptions = movementCountries
    .filter(country => country.id !== sharedMovementId)
    .sort((a, b) => loc(a.name).localeCompare(loc(b.name), language));
  const countryById = new Map(countryOptions.map(country => [country.id, country]));
  const shared = movementCountries.find(country => country.id === sharedMovementId);
  const showHistoricalEvents = movementView.showHistoricalEvents !== false;
  const density = movementView.density || 1;
  const yearScale = atlasFitYearScale(start,end) * density;
  const height = Math.max(1,(countryEnd - start) * yearScale);
  const pack = movements => {
    const ends = [];
    return [...movements].sort((a,b) => a.start - b.start).map(movement => { let lane = ends.findIndex(laneEnd => laneEnd < movement.start); if (lane < 0) lane = ends.length; ends[lane] = movement.end; return {...movement,lane}; });
  };
  const yearLabel = year => Number(year) < 0 ? `${Math.abs(year)} BCE` : (year === movementAtlasEnd ? (language === 'ko' ? '현대' : 'Today') : String(year));
  const axis = (axisStart, axisEnd, axisHeight, step = atlasTickStep(axisStart,axisEnd)) => {
    const ticks = []; for (let year = Math.ceil(axisStart / step) * step; year <= axisEnd; year += step) ticks.push(year);
    return `<aside class="atlas-axis" style="height:${axisHeight + 40}px"><span class="atlas-axis-line"></span>${ticks.map(year => `<span class="atlas-tick" style="top:${(year-axisStart)*yearScale}px">${yearLabel(year)}</span>`).join('')}</aside>`;
  };
  const bar = (item, axisStart, axisEnd) => { const top=Math.max(0,item.start-axisStart)*yearScale, barHeight=Math.max(18,(Math.min(axisEnd,item.end)-Math.max(axisStart,item.start))*yearScale), left=8 + item.lane * 106, years=`${yearLabel(item.sourceStart ?? item.start)}–${yearLabel(item.sourceEnd ?? item.end)}`, movementName=item.name.en || item.name.ko || ''; return `<div class="movement-bar" title="${esc(loc(item.name))} · ${years}" style="top:${top}px;height:${barHeight}px;left:${left}px;width:100px;--movement-color:${esc(item.color)}"><div class="movement-bar-links"><button class="movement-link movement-explanation-link" type="button" data-movement-explanation="${esc(movementName)}" data-movement-label="${esc(loc(item.name))}" aria-label="${esc(loc(item.name))} ${language === 'ko' ? '정리 설명' : 'explanation'}" title="${language === 'ko' ? '정리 설명 열기' : 'Open explanation'}">①</button></div><span>${esc(loc(item.name))}</span><small>${years}</small></div>`; };
  const countryColumns = start < countryEnd ? movementView.countries.map(id => countryById.get(id)).filter(Boolean).map(country => ({
    ...country,
    movements:(country.movements || []).map(item => clippedMovement(item,start,countryEnd)).filter(Boolean)
  })).filter(country => country.movements.length) : [];
  const columns = countryColumns;
  const widthFor = column => { const lanes = Math.max(1, ...pack(column.movements).map(item => item.lane + 1)); return lanes * 106 + 16; };
  const chartColumns = `${showHistoricalEvents ? '250px ' : ''}74px ${columns.map(column => `${widthFor(column)}px`).join(' ')}`;
  const column = country => {
    const entries = pack(country.movements);
    const lanes = Math.max(1, ...entries.map(item => item.lane + 1));
    const draggable = ` data-country-id="${esc(country.id)}"`;
    return `<section class="atlas-country"${draggable} style="min-width:${lanes * 106 + 16}px"><h2 class="atlas-country-heading"${draggable}>${esc(loc(country.name))}</h2><div class="atlas-bars" style="height:${height}px">${entries.map(item => bar(item, start, countryEnd)).join('')}</div></section>`;
  };
  const sharedStart = Math.max(start,movementCountryEnd);
  const sharedEnd = end;
  const sharedHeight = Math.max(1,(sharedEnd - sharedStart) * yearScale);
  const sharedItems = shared?.movements?.length && sharedEnd > sharedStart ? shared.movements.map(item => clippedMovement(item,sharedStart,sharedEnd)).filter(Boolean) : [];
  const sharedEntries = pack(sharedItems);
  const sharedLanes = Math.max(1, ...sharedEntries.map(item => item.lane + 1));
  const sharedBox = sharedEntries.length ? `<div class="atlas-shared-chart" style="grid-template-columns:${showHistoricalEvents ? '250px ' : ''}74px ${sharedLanes * 106 + 16}px">${showHistoricalEvents ? renderAtlasEvents(sharedStart, sharedEnd, sharedHeight, yearScale) : ''}${axis(sharedStart, sharedEnd, sharedHeight)}<section class="atlas-country atlas-shared-country" style="min-width:${sharedLanes * 106 + 16}px"><div class="atlas-bars" style="height:${sharedHeight}px">${sharedEntries.map(item => bar(item, sharedStart, sharedEnd)).join('')}</div></section></div>` : '';
  const editEventsLabel = language === 'ko' ? '역사 사건 추가' : 'Add historical event';
  const eventEditorButton = `<button class="atlas-event-editor" type="button">${editEventsLabel}</button>`;
  const toggleEventsLabel = showHistoricalEvents ? (language === 'ko' ? '역사 사건 숨기기' : 'Hide historical events') : (language === 'ko' ? '역사 사건 보기' : 'Show historical events');
  const selectedCountryCount = countryOptions.filter(country => movementView.countries.includes(country.id)).length;
  const countryControls = `<details class="atlas-country-controls atlas-country-popover"><summary>${language === 'ko' ? `국가 선택 ${selectedCountryCount}개` : `Countries ${selectedCountryCount}`}</summary><div class="atlas-country-menu"><div class="atlas-country-actions"><button type="button" data-country-select-all>${language === 'ko' ? '전체 선택' : 'Select all'}</button><button type="button" data-country-clear-all>${language === 'ko' ? '전체 해제' : 'Clear all'}</button></div><div class="atlas-country-options">${countryOptions.map(country => `<div class="atlas-country-option"><label><input type="checkbox" value="${esc(country.id)}" ${movementView.countries.includes(country.id) ? 'checked' : ''}>${esc(loc(country.name))}</label></div>`).join('')}</div></div></details>`;
  const rangeText = `${yearLabel(start)}–${yearLabel(end)}`;
  const periodControls = `<fieldset class="atlas-period-control"><legend>${language === 'ko' ? '기간' : 'Period'}</legend><div class="atlas-period-sliders"><span class="atlas-period-min">${movementAtlasMinimum}</span><label aria-label="${language === 'ko' ? '시작 연도' : 'Start year'}"><input class="atlas-period-start" type="range" min="${movementAtlasMinimum}" max="${movementAtlasEnd}" step="1" value="${start}"></label><label aria-label="${language === 'ko' ? '끝 연도' : 'End year'}"><input class="atlas-period-end" type="range" min="${movementAtlasMinimum}" max="${movementAtlasEnd}" step="1" value="${end}"></label><span class="atlas-period-now">${language === 'ko' ? '현재' : 'Today'}</span></div><div class="atlas-period-entry"><label><span>${language === 'ko' ? '시작입력' : 'Start input'}</span><input class="atlas-period-start-value" type="number" min="${movementAtlasMinimum}" max="${movementAtlasEnd - movementMinimumRangeSpan}" step="1" value="${start}" aria-label="${language === 'ko' ? '시작 연도 입력' : 'Start year input'}"></label><div class="atlas-period-selected"><span>${language === 'ko' ? '선택된 연도' : 'Selected years'}</span><p class="atlas-range">${rangeText}</p></div><label><span>${language === 'ko' ? '끝입력' : 'End input'}</span><input class="atlas-period-end-value" type="number" min="${movementAtlasMinimum + movementMinimumRangeSpan}" max="${movementAtlasEnd}" step="1" value="${end}" aria-label="${language === 'ko' ? '끝 연도 입력' : 'End year input'}"></label></div></fieldset>`;
  const densityControls = `<fieldset class="atlas-density-control"><legend>${language === 'ko' ? '표시 밀도' : 'Display density'}</legend><div class="atlas-density-row"><span>1x</span><input class="atlas-density-slider" type="range" min="${movementDensityMinimum}" max="${movementDensityMaximum}" step="0.1" value="${density}" aria-label="${language === 'ko' ? '표시 밀도' : 'Display density'}"><span>${movementDensityMaximum}x</span><output>${density.toFixed(1)}x</output></div></fieldset>`;
  const artistListLabel = language === 'ko' ? '화가 목록' : 'Artist list';
  const techniquesLabel = language === 'ko' ? '기법·용어' : 'Techniques & Terms';
  const topicsLabel = language === 'ko' ? '주제 - 사조' : 'Topics - movements';
  timeline.innerHTML = `<div class="timeline-title-row movement-title-row"><h1 class="timeline-title">${t('movementAtlas')}</h1><div class="timeline-title-actions movement-title-actions"><button class="atlas-nav-button movement-nav-artists" type="button">${artistListLabel}</button><button class="atlas-nav-button movement-nav-techniques" type="button">${techniquesLabel}</button><button class="atlas-nav-button movement-nav-topics" type="button">${topicsLabel}</button></div></div><div class="atlas-controls">${countryControls}${periodControls}${densityControls}<div class="atlas-event-actions"><button class="atlas-event-toggle" type="button">${toggleEventsLabel}</button>${eventEditorButton}</div></div><div class="atlas-scroll">${columns.length ? `<div class="atlas-chart" style="grid-template-columns:${chartColumns}">${showHistoricalEvents ? renderAtlasEvents(start, countryEnd, height, yearScale) : ''}${axis(start, countryEnd, height)}${columns.map(column).join('')}</div>` : ''}${sharedBox ? `${columns.length ? '<div class="atlas-shared-divider"></div>' : ''}${sharedBox}` : ''}${!columns.length && !sharedBox ? `<p class="empty-timeline">${language === 'ko' ? '비교할 나라를 하나 이상 선택해 주세요.' : 'Select at least one country.'}</p>` : ''}</div>`;
  if (currentUserIsAdmin) timeline.querySelector('.movement-title-actions')?.insertAdjacentHTML('beforeend','<button class="rules-check-button" type="button" data-rules-check hidden></button>');
  timeline.querySelector('.movement-nav-artists')?.addEventListener('click', openArtistListPage);
  timeline.querySelector('.movement-nav-techniques')?.addEventListener('click', openTechniquesPage);
  timeline.querySelector('.movement-nav-topics')?.addEventListener('click', openTopicsPage);
  const countryPopover = timeline.querySelector('.atlas-country-popover');
  const rerenderCountryPopover = () => { persistMovementView(); renderMovementAtlas(); timeline.querySelector('.atlas-country-popover')?.setAttribute('open',''); };
  countryPopover?.querySelector('[data-country-select-all]')?.addEventListener('click', () => { movementView.countries = countryOptions.map(country => country.id); rerenderCountryPopover(); });
  countryPopover?.querySelector('[data-country-clear-all]')?.addEventListener('click', () => { movementView.countries = []; rerenderCountryPopover(); });
  countryPopover?.querySelectorAll('.atlas-country-options input').forEach(input => input.onchange = () => { movementView.countries = input.checked ? [...new Set([...movementView.countries, input.value])] : movementView.countries.filter(id => id !== input.value); rerenderCountryPopover(); });
  const startInput = timeline.querySelector('.atlas-period-start');
  const endInput = timeline.querySelector('.atlas-period-end');
  const startValueInput = timeline.querySelector('.atlas-period-start-value');
  const endValueInput = timeline.querySelector('.atlas-period-end-value');
  const previewPeriod = changed => {
    let nextStart = Number(changed === 'start-text' ? startValueInput.value : startInput.value);
    let nextEnd = Number(changed === 'end-text' ? endValueInput.value : endInput.value);
    if (!Number.isFinite(nextStart)) nextStart = movementView.start;
    if (!Number.isFinite(nextEnd)) nextEnd = movementView.end;
    if (nextEnd - nextStart < movementMinimumRangeSpan) {
      if (changed === 'start' || changed === 'start-text') {
        nextEnd = Math.min(movementAtlasEnd, nextStart + movementMinimumRangeSpan);
        if (nextEnd - nextStart < movementMinimumRangeSpan) nextStart = nextEnd - movementMinimumRangeSpan;
      } else {
        nextStart = Math.max(movementAtlasMinimum, nextEnd - movementMinimumRangeSpan);
        if (nextEnd - nextStart < movementMinimumRangeSpan) nextEnd = nextStart + movementMinimumRangeSpan;
      }
    }
    nextStart = Math.min(movementAtlasEnd - movementMinimumRangeSpan, Math.max(movementAtlasMinimum, nextStart));
    nextEnd = Math.max(movementAtlasMinimum + movementMinimumRangeSpan, Math.min(movementAtlasEnd, nextEnd));
    if (nextEnd - nextStart < movementMinimumRangeSpan) {
      if (changed === 'start' || changed === 'start-text') nextStart = nextEnd - movementMinimumRangeSpan;
      else nextEnd = nextStart + movementMinimumRangeSpan;
    }
    startInput.value = String(nextStart);
    endInput.value = String(nextEnd);
    startValueInput.value = String(nextStart);
    endValueInput.value = String(nextEnd);
    const rangeOutput = timeline.querySelector('.atlas-period-control .atlas-range');
    if (rangeOutput) rangeOutput.textContent = `${yearLabel(nextStart)}–${yearLabel(nextEnd)}`;
    return {nextStart,nextEnd};
  };
  const commitPeriod = changed => {
    const {nextStart,nextEnd} = previewPeriod(changed);
    if (movementView.start === nextStart && movementView.end === nextEnd) return;
    movementView.start = nextStart;
    movementView.end = nextEnd;
    movementView = normalizeMovementView(movementView);
    persistMovementView();
    renderMovementAtlas();
  };
  startInput?.addEventListener('input', () => previewPeriod('start'));
  endInput?.addEventListener('input', () => previewPeriod('end'));
  startInput?.addEventListener('change', () => commitPeriod('start'));
  endInput?.addEventListener('change', () => commitPeriod('end'));
  startValueInput?.addEventListener('change', () => commitPeriod('start-text'));
  endValueInput?.addEventListener('change', () => commitPeriod('end-text'));
  startValueInput?.addEventListener('keydown', event => { if (event.key === 'Enter') commitPeriod('start-text'); });
  endValueInput?.addEventListener('keydown', event => { if (event.key === 'Enter') commitPeriod('end-text'); });
  const densityInput = timeline.querySelector('.atlas-density-slider');
  const densityOutput = timeline.querySelector('.atlas-density-row output');
  densityInput?.addEventListener('input', () => {
    if (densityOutput) densityOutput.textContent = `${Number(densityInput.value).toFixed(1)}x`;
  });
  densityInput?.addEventListener('change', () => {
    movementView.density = Number(densityInput.value);
    movementView = normalizeMovementView(movementView);
    persistMovementView();
    renderMovementAtlas();
  });
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
    if (event.button !== 0 || !event.target.closest('.atlas-country') || event.target.closest('.atlas-country-heading, .movement-bar')) return;
    atlasPan = {pointerId:event.pointerId, startY:event.clientY, scrollTop:atlasScroll.scrollTop};
    atlasScroll.setPointerCapture(event.pointerId);
    atlasScroll.classList.add('atlas-panning');
    event.preventDefault();
  });
  atlasScroll.addEventListener('pointermove', event => {
    if (!atlasPan || event.pointerId !== atlasPan.pointerId) return;
    atlasScroll.scrollTop = atlasPan.scrollTop - (event.clientY - atlasPan.startY);
  });
  const stopAtlasPan = event => {
    if (!atlasPan || event.pointerId !== atlasPan.pointerId) return;
    atlasPan = null;
    atlasScroll.classList.remove('atlas-panning');
  };
  atlasScroll.addEventListener('pointerup', stopAtlasPan);
  atlasScroll.addEventListener('pointercancel', stopAtlasPan);
  timeline.querySelectorAll('.movement-explanation-link').forEach(button => {
    button.onclick = event => { event.stopPropagation(); openMovementDocument(button.dataset.movementExplanation, '1', button.dataset.movementLabel); };
    button.oncontextmenu = event => {
      if (!currentUserIsAdmin) return;
      showMovementDocumentMenu(event, button.dataset.movementExplanation, '1', button.dataset.movementLabel);
    };
  });
  timeline.querySelectorAll('.movement-bar').forEach(bar => {
    bar.addEventListener('dblclick', event => {
      const link = bar.querySelector('.movement-explanation-link');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      openMovementDocument(link.dataset.movementExplanation, '1', link.dataset.movementLabel);
    });
  });
  timeline.querySelectorAll('.atlas-event-label').forEach(button => button.onclick = () => openHistoricalEventWikipedia(button.dataset.eventWiki));
  timeline.querySelector('.atlas-event-editor')?.addEventListener('click', openHistoricalEventEditor);
  timeline.querySelector('.atlas-event-toggle').onclick = () => { movementView.showHistoricalEvents = !showHistoricalEvents; persistMovementView(); renderMovementAtlas(); };
}
function openMovementAtlas() {
  if (!isMovementPopup) {
    const pageUrl = new URL(location.href);
    pageUrl.searchParams.delete('artist');
    pageUrl.searchParams.delete('artistId');
    pageUrl.searchParams.set('movementPopup', '1');
    window.open(uHangulModeUrl(pageUrl.href), '_blank');
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
function placeholder() { return `<div class="detail-panel-resize" role="separator" aria-orientation="vertical" aria-label="${language === 'ko' ? '설명 창 너비 조절' : 'Resize detail panel'}"></div><div class="detail-placeholder">${t('selectWork').replace('\n','<br>')}</div>`; }
function storedArtworkText(work) {
  return loc(work?.detail?.userNote) || loc(work?.detail?.summary) || loc(work?.description) || '';
}
function isArtworkHeading(line, nextLine='') {
  const text=String(line || '').trim(), next=String(nextLine || '').trim();
  if (!text) return false;
  if (/^#{1,3}\s+/.test(text) || /^[^.!?。…]{1,60}:$/.test(text)) return true;
  if (/^\d+[.)]\s+/.test(text)) return Boolean(next) && !/^\d+[.)]\s+/.test(next);
  return Boolean(next) && text.length <= 45 && !/[.!?。…]$/.test(text) && !/^(?:[-*•])\s+/.test(text);
}
function polishArtworkText(value) {
  const tidySentence = text => {
    const tidy = text.replace(/\s+/g, ' ').replace(/\s*([,;:])\s*/g, '$1 ').replace(/([.!?。…])(?=[^\s”’"')\]])/g, '$1 ').trim();
    return tidy && !/[.!?。…]$/.test(tidy) ? `${tidy}.` : tidy;
  };
  const lines=String(value || '').replace(/\r\n?/g, '\n').split('\n');
  return lines.map((line,index) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const next=lines.slice(index+1).find(item => item.trim()) || '';
    if (isArtworkHeading(trimmed,next)) return trimmed;
    const item = trimmed.match(/^((?:[-*•])|(?:\d+[.)]))\s+(.+)$/);
    return item ? `${item[1]} ${tidySentence(item[2])}` : tidySentence(trimmed);
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function formattedArtworkText(value) {
  const blocks = String(value || '').trim().split(/\n\s*\n/).filter(Boolean);
  if (!blocks.length) return '';
  return blocks.map(block => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) return `<h3>${esc(lines[0].replace(/^#{1,3}\s+/, ''))}</h3>`;
    if (lines.length === 1 && /^[^.!?。…]{1,60}:$/.test(lines[0])) return `<h3>${esc(lines[0].slice(0,-1))}</h3>`;
    if (lines.length > 1 && isArtworkHeading(lines[0],lines[1])) {
      const heading=lines[0].replace(/^#{1,3}\s+/, '').replace(/^\d+[.)]\s+/, '').replace(/:$/, '');
      return `<section class="user-detail-section"><h3>${esc(heading)}</h3><p>${lines.slice(1).map(esc).join('<br>')}</p></section>`;
    }
    if (lines.every(line => /^(?:[-*•])\s+/.test(line))) return `<ul>${lines.map(line => `<li>${esc(line.replace(/^(?:[-*•])\s+/, ''))}</li>`).join('')}</ul>`;
    if (lines.every(line => /^\d+[.)]\s+/.test(line))) return `<ol>${lines.map(line => `<li>${esc(line.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}
function artworkFacts(work, artist) {
  return [
    [t('artist'), artistDisplayName(artist)],
    [t('year'), workYearLabel(work) || t('unknown')],
    [t('country'), loc(work?.country) ? countryDisplayLabel(work.country) : t('unknown')],
    [t('movement'), artworkMovement(work,artist) || t('unknown')]
  ];
}
function renderArtworkDetail(work, artist, loading=false) {
  const imageInfo = artworkImageDisplay(work, {detail:true});
  const image = imageInfo.src;
  const text = storedArtworkText(work);
  const sections = work?.detail?.sections?.[language] || [];
  detail.classList.add('show');
  $('.main-area').classList.add('detail-open');
  const savedNote = language === 'ko' ? '저장 위치: data/artists.json' : 'Stored in data/artists.json';
  const editLabel = language === 'ko' ? '설명 편집' : 'Edit description';
  const addArtworkLinkLabel = language === 'ko' ? '해설 주소 추가' : 'Add explanation link';
  const artworkLinkInputLabel = language === 'ko' ? '유튜브 또는 해설 웹페이지 주소를 입력하세요' : 'Enter a YouTube or explanation webpage address';
  const confirmArtworkLinkLabel = language === 'ko' ? '확인' : 'Add';
  const polishSaveLabel = language === 'ko' ? '문장 다듬어 저장' : 'Polish and save';
  const cancelLabel = language === 'ko' ? '취소' : 'Cancel';
  const editedText = loc(work?.detail?.userNote) || storedArtworkText(work);
  const body = sections.length
    && !loc(work?.detail?.userNote) ? `<div class="detail-sections">${sections.map(section => `<section><h3>${esc(section.title)}</h3><p>${esc(section.body)}</p></section>`).join('')}</div>`
    : formattedArtworkText(text || (loading ? t('loadingInfo') : t('noInfo')));
  const imageWindowHint = language === 'ko' ? '휠: 확대/축소 · 왼쪽 버튼 드래그: 이동 · 더블클릭: 별도 창' : 'Wheel: zoom · Left-drag: pan · Double-click: open in a new window';
  const savedArtworkLinks = artworkLinks(work);
  const artworkLinkButtons = savedArtworkLinks.map((link, index) => `<button class="artwork-link-button${isYouTubeLink(link) ? ' artwork-link-youtube' : ''}" type="button" data-artwork-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index + 1}. ${link.url}`)}">${index + 1}</button>`).join('');
  const artworkLinkControls = `<span class="artwork-link-controls">${currentUserIsAdmin ? `<button class="artwork-link-add" type="button" title="${esc(addArtworkLinkLabel)}" aria-label="${esc(addArtworkLinkLabel)}">+</button>` : ''}${artworkLinkButtons}</span>`;
  const artworkTitle = `<div class="detail-title-row"><h2>${esc(loc(work.title) || t('untitled'))}</h2>${artworkLinkControls}</div>`;
  const artworkLinkEntry = currentUserIsAdmin ? `<form class="artwork-link-entry hidden"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(artworkLinkInputLabel)}" required><button type="submit">${esc(confirmArtworkLinkLabel)}</button></form>` : '';
  detail.innerHTML = `<div class="detail-panel-resize" role="separator" aria-orientation="vertical" aria-label="${language === 'ko' ? '설명 창 너비 조절' : 'Resize detail panel'}"></div><button class="close-detail" type="button" aria-label="닫기">×</button>${image ? `<div class="detail-image-wrap" title="${esc(imageWindowHint)}"><img class="detail-image" src="${esc(image)}" alt="${esc(loc(work.title))}">${imageInfo.urlDependent ? urlDependencyBadge() : ''}</div><div class="detail-image-resize" role="separator" aria-orientation="horizontal" aria-label="${language === 'ko' ? '그림 창 높이 조절' : 'Resize image height'}"></div><div class="detail-image-actions">${currentUserIsAdmin ? `<button class="edit-artwork" type="button" title="${esc(editLabel)}" aria-label="${esc(editLabel)}">✎</button>` : ''}</div>` : `<div class="detail-image-unavailable">${esc(t('noImage'))}</div>`}${artworkTitle}${artworkLinkEntry}<dl class="detail-facts">${artworkFacts(work,artist).map(([label,value]) => `<div><dt>${esc(label)}</dt><dd${label===t('artist') ? uHangulArtistAttributes(artist,value) : ''}>${esc(value)}</dd></div>`).join('')}</dl><div class="detail-content">${body}</div><div class="detail-editor hidden"><textarea aria-label="${esc(editLabel)}">${esc(editedText)}</textarea><div><button class="cancel-artwork-edit" type="button">${esc(cancelLabel)}</button><button class="save-artwork-edit" type="button">${esc(polishSaveLabel)}</button></div></div><p class="source">${esc(savedNote)}</p>`;
  detail.querySelector('.close-detail').onclick = closeDetail;
  setupDetailPanelResize();
  detail.querySelector('.edit-artwork')?.addEventListener('click', () => { detail.querySelector('.detail-content').classList.add('hidden'); detail.querySelector('.detail-editor').classList.remove('hidden'); detail.querySelector('.detail-editor textarea').focus(); });
  detail.querySelector('.cancel-artwork-edit')?.addEventListener('click', () => { detail.querySelector('.detail-editor').classList.add('hidden'); detail.querySelector('.detail-content').classList.remove('hidden'); });
  detail.querySelector('.save-artwork-edit')?.addEventListener('click', async () => { const polished = polishArtworkText(detail.querySelector('.detail-editor textarea').value); if (!polished) return; work.detail = {...work.detail, userNote:{...(work.detail?.userNote || {}),[language]:polished}}; work.description = {...(typeof work.description === 'object' ? work.description : {}),[language]:polished}; (artist.works || []).filter(item => selectionKey(item) === selectionKey(work)).forEach(item => { item.detail = work.detail; item.description = work.description; }); persist(); await saveArtistsNow(); renderArtworkDetail(work, artist, false); });
  const artworkLinkEntryElement = detail.querySelector('.artwork-link-entry');
  detail.querySelector('.artwork-link-add')?.addEventListener('click', () => { artworkLinkEntryElement.classList.toggle('hidden'); if (!artworkLinkEntryElement.classList.contains('hidden')) artworkLinkEntryElement.querySelector('input').focus(); });
  if (artworkLinkEntryElement) artworkLinkEntryElement.onsubmit = async event => {
    event.preventDefault();
    const input = artworkLinkEntryElement.querySelector('input');
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
    renderArtworkDetail(work, artist, false);
  };
  setupSortableLinkButtons(detail, {
    selector:'.artwork-link-button',
    controlsSelector:'.artwork-link-controls',
    indexAttribute:'artworkLinkIndex',
    getLinks:() => artworkLinks(work),
    setLinks:links => setArtworkLinks(artist, work, links),
    render:() => renderArtworkDetail(work, artist, false),
    contextMenu:(event, index) => showArtworkLinkMenu(event, artist, work, index)
  });
  detail.querySelector('.detail-image-wrap')?.addEventListener('dblclick', () => openArtworkImageWindow(image, loc(work.title), {artist:artistDisplayName(artist), title:artworkDisplayTitle(work), year:workYearLabel(work)}));
  setupZoomPan(detail.querySelector('.detail-image-wrap'), detail.querySelector('.detail-image'));
  setupDetailImageResize();
}
function setupDetailPanelResize() {
  const handle = detail.querySelector('.detail-panel-resize');
  if (!handle) return;
  handle.onmousedown = event => {
    if (window.matchMedia('(max-width: 840px)').matches) return;
    event.preventDefault();
    const mainRect = $('.main-area').getBoundingClientRect();
    const maxWidth = Math.max(330, mainRect.width - 320);
    const resize = move => setDetailPanelWidth(Math.min(maxWidth, Math.max(330, mainRect.right - move.clientX)));
    const stop = () => { document.removeEventListener('mousemove', resize); document.removeEventListener('mouseup', stop); document.body.classList.remove('resizing-detail-panel'); };
    document.body.classList.add('resizing-detail-panel');
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stop, {once:true});
  };
}
function setupDetailImageResize() {
  const handle = detail.querySelector('.detail-image-resize');
  if (!handle) return;
  handle.addEventListener('pointerdown', event => {
    event.preventDefault();
    const startY = event.clientY, startHeight = detailImageHeight;
    const resize = move => setDetailImageHeight(startHeight + move.clientY - startY);
    const stop = () => { window.removeEventListener('pointermove', resize); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stop, {once:true});
  });
}
function setupZoomPan(stage, image) {
  if (!stage || !image) return;
  let zoom = 1, x = 0, y = 0, drag;
  const constrainPan = () => {
    const bounds = stage.getBoundingClientRect();
    const maxX = Math.max(0, (bounds.width * zoom - bounds.width) / 2);
    const maxY = Math.max(0, (bounds.height * zoom - bounds.height) / 2);
    x = Math.max(-maxX, Math.min(maxX, x));
    y = Math.max(-maxY, Math.min(maxY, y));
  };
  const draw = () => {
    constrainPan();
    image.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    stage.classList.toggle('is-zoomed', zoom > 1);
  };
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    const oldZoom = zoom;
    zoom = Math.max(1, Math.min(5, zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    if (zoom === 1) { x = 0; y = 0; }
    else {
      const rect = stage.getBoundingClientRect();
      const pointX = event.clientX - rect.left - rect.width / 2;
      const pointY = event.clientY - rect.top - rect.height / 2;
      const ratio = zoom / oldZoom;
      x = x * ratio + pointX * (1 - ratio);
      y = y * ratio + pointY * (1 - ratio);
    }
    draw();
  }, {passive:false});
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || zoom <= 1) return;
    event.preventDefault();
    event.stopPropagation();
    drag = {id:event.pointerId, startX:event.clientX, startY:event.clientY, x, y};
    try { stage.setPointerCapture(event.pointerId); } catch (_) { /* Pointer capture is unavailable in some embedded browsers. */ }
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    x = drag.x + event.clientX - drag.startX;
    y = drag.y + event.clientY - drag.startY;
    draw();
  });
  const stop = event => {
    if (!drag || event.pointerId !== drag.id) return;
    try { stage.releasePointerCapture(event.pointerId); } catch (_) { /* The pointer may already be released. */ }
    drag = null;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.addEventListener('lostpointercapture', stop);
}
function openFavoritesWindow() {
  const favorites = selectedFavoriteWorks().map(({artist, work}) => {
    const image = artworkImageDisplay(work, {detail:true}).src;
    return {
      artist: loc(artist.name), title: loc(work.title) || t('untitled'), year: workYearLabel(work) || t('unknown'),
      image,
      fileName: (image || '').split('/').pop().split('?')[0]
    };
  }).filter(item => item.image);
  if (!favorites.length) return alert(language === 'ko' ? '먼저 작품 썸네일 오른쪽 위의 동그란 선택 버튼을 눌러 그림을 고르세요.' : 'Select artworks with the round button at the top-right of each thumbnail first.');
  const popupWidth = Math.floor(window.screen.availWidth * 0.7);
  const popupHeight = Math.floor(window.screen.availHeight * 0.7);
  const popupLeft = Math.max(0, Math.floor((window.screen.availWidth - popupWidth) / 2));
  const popupTop = Math.max(0, Math.floor((window.screen.availHeight - popupHeight) / 2));
  const popup = window.open('', 'artAtlasFavorites', `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop}`);
  if (!popup) return alert(language === 'ko' ? '새 창을 열 수 없습니다. 팝업 차단을 해제해 주세요.' : 'Could not open a new window. Please allow pop-ups.');
  const data = JSON.stringify(favorites).replace(/</g, '\\u003c');
  const title = language === 'ko' ? 'MY FAVORITES · 작품 감상' : 'MY FAVORITES · Gallery';
  popup.document.write(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${title}</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#0d100d;color:#f7f4ec;font-family:system-ui,sans-serif}#stage{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;cursor:grab;user-select:none}#stage.dragging{cursor:grabbing}#art{position:absolute;left:50%;top:50%;max-width:none;max-height:none;pointer-events:none;user-select:none}.nav{position:fixed;z-index:2;top:50%;transform:translateY(-50%);width:52px;height:78px;border:0;background:#10140f80;color:white;font-size:42px;line-height:1}.nav:hover{background:#3d493a}.prev{left:0}.next{right:0}#caption{position:fixed;z-index:2;left:24px;bottom:21px;padding:9px 13px;background:#10140fb8;border-radius:5px;font-size:13px}#caption strong,#caption span,#caption small,#caption code{display:block}#caption span{font:600 18px Georgia,serif;margin:3px 0}#caption small{color:#c8cdc2}#caption code{margin-top:4px;color:#d7dccf;font-size:11px}.hint{position:fixed;z-index:2;right:20px;bottom:22px;color:#c8cdc2;font-size:12px;text-align:right;line-height:1.6}</style></head><body><button class="nav prev" aria-label="Previous">‹</button><button class="nav next" aria-label="Next">›</button><div id="stage"><img id="art" alt=""></div><div id="caption"></div><div class="hint">${language === 'ko' ? '휠: 확대/축소 · 왼쪽 드래그: 이동<br>← → 키로 다음 작품' : 'Wheel: zoom · Left-drag: pan<br>Use ← → to navigate'}</div><script>const works=${data},stage=document.querySelector('#stage'),art=document.querySelector('#art'),caption=document.querySelector('#caption');let index=0,zoom=1,x=0,y=0,drag;function clamp(){const mx=Math.max(0,(art.offsetWidth-stage.clientWidth)/2),my=Math.max(0,(art.offsetHeight-stage.clientHeight)/2);x=Math.max(-mx,Math.min(mx,x));y=Math.max(-my,Math.min(my,y));}function draw(){if(!art.naturalWidth)return;const base=Math.min(stage.clientWidth/art.naturalWidth,stage.clientHeight/art.naturalHeight);art.style.width=Math.max(1,art.naturalWidth*base*zoom)+'px';art.style.height=Math.max(1,art.naturalHeight*base*zoom)+'px';clamp();art.style.transform='translate(calc(-50% + '+x+'px),calc(-50% + '+y+'px))';}function show(step=0){index=(index+step+works.length)%works.length;const w=works[index];zoom=1;x=y=0;art.src=w.image;art.alt=w.title;const artistEl=document.createElement('strong'),titleEl=document.createElement('span'),metaEl=document.createElement('small');artistEl.textContent=w.artist;titleEl.textContent=w.title;metaEl.textContent=w.year+' · '+(index+1)+' / '+works.length;const children=[artistEl,titleEl,metaEl];if(w.fileName){const fileEl=document.createElement('code');fileEl.textContent=w.fileName;children.push(fileEl);}caption.replaceChildren(...children);}art.addEventListener('load',draw);window.addEventListener('resize',draw);document.querySelector('.prev').onclick=()=>show(-1);document.querySelector('.next').onclick=()=>show(1);window.onkeydown=e=>{if(e.key==='ArrowLeft')show(-1);if(e.key==='ArrowRight')show(1);if(e.key==='Escape')window.close();};stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:x,startY:y};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');});stage.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;x=drag.startX+e.clientX-drag.x;y=drag.startY+e.clientY-drag.y;draw();});const stop=e=>{if(drag&&e.pointerId===drag.id){drag=null;stage.classList.remove('dragging');}};stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',stop);stage.addEventListener('wheel',e=>{e.preventDefault();const old=zoom;zoom=Math.max(.5,Math.min(6,zoom*(e.deltaY<0?1.12:1/1.12)));const ratio=zoom/old,r=stage.getBoundingClientRect(),px=e.clientX-r.left-stage.clientWidth/2,py=e.clientY-r.top-stage.clientHeight/2;x=x*ratio+px*(1-ratio);y=y*ratio+py*(1-ratio);draw();},{passive:false});show();document.documentElement.requestFullscreen?.().catch(()=>{});</script></body></html>`);
  popup.document.close();
  try {
    popup.sessionStorage.setItem(uHangulModeStorageKey, uHangulMode);
    const runtimeStyle = popup.document.createElement('link');
    runtimeStyle.rel = 'stylesheet';
    runtimeStyle.href = new URL('uhangul/uhangul-runtime.css', location.href).href;
    runtimeStyle.dataset.uhangulIntegration = 'v0.6-draft';
    const runtimeScript = popup.document.createElement('script');
    runtimeScript.defer = true;
    runtimeScript.src = new URL('uhangul/uhangul-runtime.js?v=0.6-draft', location.href).href;
    runtimeScript.dataset.uhangulIntegration = 'v0.6-draft';
    popup.document.head.append(runtimeStyle, runtimeScript);
  } catch (_) { /* The popup still works if its document cannot be extended. */ }
  popup.document.exitFullscreen?.();
  popup.moveTo(popupLeft, popupTop);
  popup.resizeTo(popupWidth, popupHeight);
  popup.focus();
}
function openArtworkImageWindow(imageSrc, title, caption={}) {
  const width = Math.floor(window.screen.availWidth * 0.8);
  const height = Math.floor(window.screen.availHeight * 0.8);
  const left = Math.max(0, Math.floor((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.floor((window.screen.availHeight - height) / 2));
  const popup = window.open('', 'artAtlasArtworkImage', `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
  if (!popup) return alert(language === 'ko' ? '이미지 창을 열 수 없습니다. 팝업 차단을 해제해 주세요.' : 'Could not open the image window. Please allow pop-ups.');
  const imageUrl = JSON.stringify(String(imageSrc)).replace(/</g, '\\u003c');
  const imageTitle = JSON.stringify(String(title || '')).replace(/</g, '\\u003c');
  popup.document.write(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${esc(loc(title) || 'Artwork')}</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#10120f;color:#f7f4ec;font-family:system-ui,sans-serif}#toolbar{height:42px;box-sizing:border-box;display:flex;align-items:center;padding:0 16px;background:#242820;font-size:12px;color:#c8cdc2}#stage{height:calc(100% - 42px);position:relative;overflow:hidden;touch-action:none;cursor:grab;user-select:none}#stage.dragging{cursor:grabbing}#artwork{position:absolute;top:50%;left:50%;max-width:none;max-height:none;transform:translate(-50%,-50%);pointer-events:none;user-select:none}</style></head><body><div id="toolbar">${language === 'ko' ? '왼쪽 버튼을 누른 채 드래그: 이동 · 휠 위로: 확대 · 휠 아래로: 축소' : 'Left-drag: pan · Wheel up: zoom in · Wheel down: zoom out'}</div><div id="stage"><img id="artwork" alt=""></div><script>const src=${imageUrl}, title=${imageTitle}, stage=document.querySelector('#stage'), image=document.querySelector('#artwork');document.title=title||'Artwork';image.src=src;image.alt=title;let zoom=1,x=0,y=0,drag=null;const clamp=()=>{const maxX=Math.max(0,(image.offsetWidth-stage.clientWidth)/2),maxY=Math.max(0,(image.offsetHeight-stage.clientHeight)/2);x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));};const draw=()=>{if(!image.naturalWidth)return;const base=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight);image.style.width=Math.max(1,image.naturalWidth*base*zoom)+'px';image.style.height=Math.max(1,image.naturalHeight*base*zoom)+'px';clamp();image.style.transform='translate(calc(-50% + '+x+'px), calc(-50% + '+y+'px))';};image.addEventListener('load',draw);window.addEventListener('resize',draw);stage.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:x,startY:y};stage.setPointerCapture(event.pointerId);stage.classList.add('dragging');});stage.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;x=drag.startX+event.clientX-drag.x;y=drag.startY+event.clientY-drag.y;draw();});const stop=event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;stage.classList.remove('dragging');};stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',stop);stage.addEventListener('wheel',event=>{event.preventDefault();const oldZoom=zoom,ratio=event.deltaY<0?1.1:1/1.1;zoom=Math.max(.5,Math.min(6,zoom*ratio));const actualRatio=zoom/oldZoom,rect=stage.getBoundingClientRect(),pointX=event.clientX-rect.left-stage.clientWidth/2,pointY=event.clientY-rect.top-stage.clientHeight/2;x=x*actualRatio+pointX*(1-actualRatio);y=y*actualRatio+pointY*(1-actualRatio);draw();},{passive:false});<\/script></body></html>`);
  popup.document.close();
  const captionText = [caption.artist, caption.title, caption.year].filter(Boolean).join(' · ');
  if (captionText) {
    const captionElement = popup.document.createElement('div');
    captionElement.textContent = captionText;
    Object.assign(captionElement.style, {position:'absolute',zIndex:'2',left:'16px',bottom:'16px',maxWidth:'calc(100% - 32px)',padding:'8px 11px',borderRadius:'4px',background:'#050705ba',color:'#f7f4ec',fontSize:'13px',lineHeight:'1.35',pointerEvents:'none'});
    popup.document.querySelector('#stage')?.append(captionElement);
  }
  popup.resizeTo(width, height);
  popup.moveTo(left, top);
  popup.focus();
}
async function openArtworkDetail(work, artist, remember=true) {
  if (!work || !artist) return;
  if (remember) persistLastPosition(artist, work);
  renderArtworkDetail(work, artist, !storedArtworkText(work));
  if (!currentUserIsAdmin) return;
  if (storedArtworkText(work)) return;
  const key = `${artist.id}:${work.id}`;
  if (artworkInfoRequests.has(key)) return;
  artworkInfoRequests.add(key);
  try {
    const response = await apiFetch('/api/artwork-info', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artist,work})});
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || 'Could not load artwork information');
    Object.assign(work, {...result.work, id:work.id});
    (artist.works || []).filter(item => selectionKey(item) === selectionKey(work)).forEach(item => Object.assign(item, work));
    persist();
    await saveArtistsNow();
    if (selectedId === artist.id) renderArtworkDetail(work, artist, false);
  } catch (_) {
    renderArtworkDetail(work, artist, false);
  } finally {
    artworkInfoRequests.delete(key);
  }
}
function slideshowImage(work) {
  return artworkImageDisplay(work).src;
}
function renderSlideshowSlide() {
  const work = slideshowWorks[slideshowIndex];
  if (!work) return closeSlideshow();
  const imageInfo = artworkImageDisplay(work);
  const image = imageInfo.src;
  slideshowStage.innerHTML = image ? `<img src="${esc(image)}" alt="${esc(loc(work.title))}">${imageInfo.urlDependent ? urlDependencyBadge() : ''}` : `<div class="slideshow-empty">${language === 'ko' ? '이미지를 준비하지 못했습니다.' : 'Image unavailable.'}</div>`;
  slideshowCaption.innerHTML = `<span class="slideshow-caption-line"><span${uHangulArtistAttributes(slideshowArtist,artistDisplayName(slideshowArtist))}>${esc(artistDisplayName(slideshowArtist))}</span><span> · ${esc(loc(work.title))} · ${esc(workYearLabel(work) || t('unknown'))}</span></span>`;
}
function startSlideshow(artist, works) {
  if (!works.length) return;
  slideshowArtist = artist;
  slideshowWorks = works;
  slideshowIndex = 0;
  clearInterval(slideshowTimer);
  slideshow.classList.remove('hidden');
  renderSlideshowSlide();
  slideshowTimer = setInterval(() => { slideshowIndex = (slideshowIndex + 1) % slideshowWorks.length; renderSlideshowSlide(); }, 10000);
  slideshow.requestFullscreen?.().catch(() => {});
}
function closeSlideshow() {
  clearInterval(slideshowTimer);
  slideshowTimer = null;
  slideshow.classList.add('hidden');
  if (document.fullscreenElement === slideshow) document.exitFullscreen?.();
}
function openArtistWikipedia(artist) {
  const title = artist.name?.en || artist.name?.ko || '';
  const url = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`;
  const popupWidth = Math.min(920, window.screen.availWidth - 60);
  const popupHeight = Math.min(900, window.screen.availHeight - 100);
  const popupLeft = Math.max(30, window.screen.availWidth - popupWidth - 30);
  window.open(url, 'artAtlasArtistWikipedia', `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=50,noopener`);
}
function openMovementWikipedia(name) {
  const url = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`;
  const popupWidth = Math.min(920, window.screen.availWidth - 60);
  const popupHeight = Math.min(900, window.screen.availHeight - 100);
  const popupLeft = Math.max(30, window.screen.availWidth - popupWidth - 30);
  window.open(url, 'artAtlasMovementWikipedia', `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=50,noopener`);
}
function movementExplanationWindow(url='about:blank') {
  return window.open(url, '_blank');
}
function openExplanationUrl(url, popup=null, movementName='', movementLabel='') {
  const target = new URL(uHangulModeUrl(url));
  target.searchParams.set('documentVersion', 'uhangul-controls-v4');
  if (movementName) target.searchParams.set('movementWiki', movementName);
  if (movementLabel) target.searchParams.set('movementLabel', movementLabel);
  const targetUrl = target.href;
  popup = popup && !popup.closed ? popup : movementExplanationWindow(targetUrl);
  if (!popup) {
    window.location.href = targetUrl;
    return;
  }
  if (popup.location.href !== targetUrl) popup.location.href = targetUrl;
  popup.focus();
}
function writeMovementDocumentLoading(popup, label) {
  if (!popup) return;
  const message = language === 'ko' ? '현재 화가 목록 기준으로 링크를 업데이트하는 중입니다.' : 'Updating links from the current artist list.';
  try {
    popup.document.write(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${esc(label || t('movementAtlas'))}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f1e8;color:#18221e;font-family:system-ui,sans-serif}.box{max-width:520px;padding:28px;line-height:1.7}strong{display:block;font-size:20px;margin-bottom:8px}</style></head><body><div class="box"><strong>${esc(label || t('movementAtlas'))}</strong>${esc(message)}</div></body></html>`);
    popup.document.close();
  } catch (_) { /* A restricted popup can still be navigated below. */ }
}
async function refreshMovementDocument(name, slot) {
  if (!currentUserIsAdmin) return movementDocuments?.[name]?.[slot] || '';
  const response = await apiFetch('/api/movement-documents/refresh', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name, slot})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok || !result.url) throw new Error(result.error || 'Could not update movement document links');
  movementDocuments[name] = {...(movementDocuments[name] || {}), [slot]:result.url};
  return result.url;
}
function chooseMovementDocumentFile() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.html,.htm,text/html';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
function setupMovementImageDescriptionEditors(frame, name, slot='1') {
  if (!currentUserIsAdmin) return;
  const documentInFrame = frame.contentDocument || frame.document;
  if (!documentInFrame || documentInFrame.querySelector('#art-atlas-description-editor-style')) return;
  const editorStyle = documentInFrame.createElement('style');
  editorStyle.id = 'art-atlas-description-editor-style';
  editorStyle.textContent = '.movement-work-body,.caption{position:relative}.movement-work-body>h3:first-child,.caption>h3:first-child{padding-right:38px}.art-atlas-description-editor{position:absolute;top:10px;right:10px;z-index:2;display:flex;align-items:center;gap:7px}.art-atlas-description-editor button{border:1px solid #8e9b8b;border-radius:5px;width:28px;height:28px;padding:0;background:#f5f1e8;color:#18221e;font:700 16px/1 system-ui,sans-serif;cursor:pointer}.art-atlas-description-editor button[data-action="save"]{background:#18221e;color:#fff;border-color:#18221e}.art-atlas-description-editor.editing{position:static;width:100%;align-items:flex-start;margin-top:12px}.art-atlas-description-editor.editing button{width:auto;height:auto;padding:6px 9px;font-size:12px}.art-atlas-description-editor.editing textarea{width:100%;min-height:130px;resize:vertical;border:1px solid #8e9b8b;border-radius:6px;padding:10px;background:#fff;color:#18221e;font:14px/1.6 system-ui,sans-serif}';
  documentInFrame.head.append(editorStyle);
  const label = language === 'ko' ? '설명 편집' : 'Edit description';
  const saveLabel = language === 'ko' ? '저장' : 'Save';
  const cancelLabel = language === 'ko' ? '취소' : 'Cancel';
  const saveDocument = async () => {
    const copy = documentInFrame.documentElement.cloneNode(true);
    copy.querySelectorAll('[data-art-atlas-description-editor], #art-atlas-description-editor-style').forEach(element => element.remove());
    const response = await apiFetch('/api/movement-documents', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,slot,html:`<!doctype html>\n${copy.outerHTML}`})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Could not save description');
  };
  documentInFrame.querySelectorAll('article.movement-work-card, article.card').forEach(card => {
    if (!card.querySelector('img')) return;
    const body = card.querySelector('.movement-work-body, .caption');
    if (!body || body.querySelector('[data-art-atlas-description-editor]')) return;
    const paragraphs = [...body.querySelectorAll('p')].filter(paragraph => !paragraph.classList.contains('art-atlas-work-movement'));
    const description = paragraphs.at(-1) || body.appendChild(documentInFrame.createElement('p'));
    const controls = documentInFrame.createElement('div');
    controls.className = 'art-atlas-description-editor';
    controls.dataset.artAtlasDescriptionEditor = 'true';
    const editButton = documentInFrame.createElement('button');
    editButton.type = 'button'; editButton.textContent = '✎'; editButton.title = label; editButton.setAttribute('aria-label', label); editButton.dataset.artAtlasEditTrigger = 'true';
    controls.append(editButton); body.append(controls);
    editButton.addEventListener('click', () => {
      const original = description.textContent.trim();
      const textarea = documentInFrame.createElement('textarea');
      textarea.value = original;
      controls.classList.add('editing');
      controls.replaceChildren(textarea);
      const saveButton = documentInFrame.createElement('button');
      saveButton.type = 'button'; saveButton.dataset.action = 'save'; saveButton.textContent = saveLabel;
      const cancelButton = documentInFrame.createElement('button');
      cancelButton.type = 'button'; cancelButton.textContent = cancelLabel;
      controls.append(saveButton,cancelButton); textarea.focus();
      cancelButton.addEventListener('click', () => { controls.classList.remove('editing'); controls.replaceChildren(editButton); });
      saveButton.addEventListener('click', async () => {
        const next = textarea.value.trim();
        saveButton.disabled = true;
        try {
          description.textContent = next;
          await saveDocument();
          controls.classList.remove('editing');
          controls.replaceChildren(editButton);
        } catch (error) {
          description.textContent = original;
          alert(error.message || (language === 'ko' ? '설명을 저장하지 못했습니다.' : 'Could not save the description.'));
          saveButton.disabled = false;
        }
      });
    });
  });
}
async function openMovementDocumentInDetail(name, label) {
  const url = movementDocuments?.[name]?.['1'];
  if (!url) return;
  const loadingLabel = language === 'ko' ? '설명 페이지를 준비하는 중입니다.' : 'Preparing the explanation page.';
  detail.classList.add('show');
  $('.main-area').classList.add('detail-open');
  detail.innerHTML = `<div class="detail-panel-resize" role="separator" aria-orientation="vertical" aria-label="${language === 'ko' ? '설명 창 너비 조절' : 'Resize detail panel'}"></div><button class="close-detail" type="button" aria-label="${language === 'ko' ? '닫기' : 'Close'}">×</button><section class="movement-document-detail"><h2>${esc(label || name)}</h2><p class="movement-document-loading">${esc(loadingLabel)}</p><iframe class="movement-document-frame" title="${esc(label || name)}" sandbox="allow-same-origin allow-scripts allow-popups"></iframe></section>`;
  renderText();
  detail.querySelector('.close-detail').onclick = closeDetail;
  setupDetailPanelResize();
  const frame = detail.querySelector('.movement-document-frame');
  const loading = detail.querySelector('.movement-document-loading');
  frame.addEventListener('load', () => {
    loading?.remove();
    setupMovementImageDescriptionEditors(frame, name, '1');
  });
  let documentUrl;
  try { documentUrl = await refreshMovementDocument(name, '1'); }
  catch (_) { documentUrl = url; }
  detail.dataset.movementDocumentUrl = documentUrl;
  const updateFrameMode = () => { if (detail.contains(frame)) frame.src = uHangulModeUrl(documentUrl); };
  updateFrameMode();
}
async function openMovementDocument(name, slot, label) {
  const url = movementDocuments?.[name]?.[slot];
  if (url) {
    const popup = movementExplanationWindow();
    if (!currentUserIsAdmin) writeMovementDocumentLoading(popup, label || name);
    if (currentUserIsAdmin && popup) {
      let editorAttachAttempts = 0;
      let editorAttachTimer;
      const attachEditorsAfterDocumentLoad = () => {
        editorAttachAttempts += 1;
        try {
          if (popup.closed || !popup.document?.querySelector('article.movement-work-card, article.card')) return;
          setupMovementImageDescriptionEditors(popup, name, slot);
          clearInterval(editorAttachTimer);
          popup.removeEventListener('load', attachEditorsAfterDocumentLoad);
        } catch (_) { /* The new tab is still navigating; retry below. */ }
        if (editorAttachAttempts >= 80) {
          clearInterval(editorAttachTimer);
          popup.removeEventListener('load', attachEditorsAfterDocumentLoad);
        }
      };
      popup.addEventListener('load', attachEditorsAfterDocumentLoad);
      editorAttachTimer = setInterval(attachEditorsAfterDocumentLoad, 100);
    }
    try { return openExplanationUrl(await refreshMovementDocument(name, slot), popup, name, label || name); }
    catch (_) { return openExplanationUrl(url, popup, name, label || name); }
  }
  if (slot === '1') return openMovementWikipedia(name);
  alert(language === 'ko' ? `${label || name}의 설명 HTML이 없습니다. 아이콘을 마우스 오른쪽 버튼으로 눌러 추가해 주세요.` : `There is no explanation HTML for ${label || name}. Right-click the icon to add one.`);
}
function showMovementDocumentMenu(event, name, slot, label) {
  if (!currentUserIsAdmin) return;
  event.preventDefault(); event.stopPropagation(); document.querySelector('.movement-document-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'movement-document-menu';
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 150)}px`; menu.style.top = `${Math.min(event.clientY, window.innerHeight - 92)}px`;
  menu.innerHTML = `<button type="button" data-action="add">${language === 'ko' ? '추가 / 교체' : 'Add / replace'}</button><button type="button" data-action="remove">${language === 'ko' ? '삭제' : 'Delete'}</button>`;
  menu.addEventListener('pointerdown', item => item.stopPropagation());
  menu.querySelector('[data-action="add"]').onclick = async () => { menu.remove(); const file=await chooseMovementDocumentFile(); if(!file) return; const form=new FormData(); form.append('name',name); form.append('slot',slot); form.append('document',file); const response=await apiFetch('/api/movement-documents',{method:'POST',body:form}); const result=await response.json(); if(!response.ok || !result.ok) return alert(result.error || 'Could not save document'); movementDocuments[name]={...(movementDocuments[name]||{}),[slot]:result.url}; alert(language === 'ko' ? 'HTML을 자료 폴더에 저장했습니다.' : 'The HTML was saved in the materials folder.'); };
  menu.querySelector('[data-action="remove"]').onclick = async () => { menu.remove(); if(!movementDocuments?.[name]?.[slot]) return alert(language === 'ko' ? '삭제할 저장 문서가 없습니다.' : 'There is no saved document to delete.'); if(!confirm(language === 'ko' ? '저장된 HTML 문서를 삭제할까요?' : 'Delete the saved HTML document?')) return; const response=await apiFetch('/api/movement-documents',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,slot})}); const result=await response.json(); if(!response.ok || !result.ok) return alert(result.error || 'Could not delete document'); delete movementDocuments[name][slot]; if(!Object.keys(movementDocuments[name]).length) delete movementDocuments[name]; };
  document.body.append(menu); setTimeout(() => document.addEventListener('pointerdown', () => menu.remove(), {once:true}), 0);
}
function openHistoricalEventWikipedia(name) {
  const url = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`;
  const popupWidth = Math.min(920, window.screen.availWidth - 60);
  const popupHeight = Math.min(900, window.screen.availHeight - 100);
  const popupLeft = Math.max(30, window.screen.availWidth - popupWidth - 30);
  window.open(url, 'artAtlasHistoricalEventWikipedia', `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=50,noopener`);
}
function closeDetail() { delete detail.dataset.movementDocumentUrl; detail.classList.remove('show'); $('.main-area').classList.remove('detail-open'); detail.innerHTML = placeholder(); setupDetailPanelResize(); }
function render() { renderText(); renderList(); if (viewMode === 'movements') renderMovementAtlas(); else renderTimeline(); closeDetail(); }

async function uploadLocalArtworkImage(artist, work, file) {
  if (!currentUserIsAdmin || !file) throw new Error(language === 'ko' ? '관리자 권한과 이미지 파일이 필요합니다.' : 'Administrator access and an image file are required.');
  const form=new FormData();
  form.append('artistId',artist.id);
  form.append('workId',work.id);
  form.append('artistName',artist.name?.ko || loc(artist.name) || artist.id);
  form.append('artistQid',artist.qid || '');
  form.append('image',file);
  const response=await apiFetch('/api/local-artwork-image',{method:'POST',body:form});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || !result.image || !result.thumbnail) throw new Error(result.error || `Upload failed (HTTP ${response.status})`);
  (artist.works || []).filter(item => selectionKey(item) === selectionKey(work)).forEach(item => {
    item.thumbnail=result.thumbnail;
    item.thumbnailValidation=2;
    item.thumbnailCacheKey=String(Date.now());
    item.highResImage=result.image;
    item.highResOriginal=result.image;
  });
  work.thumbnail=result.thumbnail;
  work.thumbnailValidation=2;
  work.thumbnailCacheKey=String(Date.now());
  work.highResImage=result.image;
  work.highResOriginal=result.image;
  persist();
  if(!await saveArtistsNow()) throw new Error(saveFailureMessage());
  return result;
}
async function hydrateThumbnails(artist) {
  if (!artist) return;
  try {
    const index = await (await fetch(`data/thumbnails/${encodeURIComponent(artist.id)}/index.json`)).json();
    (artist.works || []).forEach(work => {
      if (index[work.id]?.thumbnail) {
        work.thumbnail = index[work.id].thumbnail;
        work.thumbnailCacheKey = index[work.id].checkedAt || '';
        work.thumbnailValidation = work.thumbnail === offlineArtworkPlaceholder ? 0 : 2;
      }
    });
    persist();
  } catch (_) { /* No local thumbnail index exists for this artist yet. */ }
}
async function runThumbnailAgent() {
  if (thumbnailObserver) thumbnailObserver.disconnect();
}
async function enrichArtist() {
  return;
}

function setArtworkDialogBusy(busy, message='') {
  const buttons = [...document.querySelectorAll('#add-artwork-form button[type="submit"]')];
  const notice = $('#add-artwork-message');
  buttons.forEach(button => {
    button.disabled = busy;
    button.textContent = busy ? (language === 'ko' ? '저장 중...' : 'Saving...') : t(button.dataset.i18n || 'save');
  });
  if (message) {
    notice.textContent = message;
    notice.classList.remove('hidden');
  } else if (!busy) {
    notice.classList.add('hidden');
  }
}

function openAddArtworkDialog(artist) {
  if (!artist) return;
  $('#add-artwork-form').reset();
  artworkDialog.dataset.artistId = artist.id;
  $('#add-artwork-message').classList.add('hidden');
  setLocalArtworkDetails(null);
  setArtworkDialogBusy(false);
  timelineArtworkPicker.value='';
  timelineArtworkPicker.click();
}

function cleanedArtworkInput(value='') {
  const source=String(value).trim();
  return /^(["']).*\1$/.test(source) ? source.slice(1,-1).trim() : source;
}

function isLocalArtworkInput(value='') {
  const source=cleanedArtworkInput(value);
  return /^file:/i.test(source) || /^[a-z]:[\\/]/i.test(source) || /^\\\\/.test(source) || /^\.{1,2}[\\/]/.test(source) || /^data[\\/]/i.test(source);
}

function inferredArtworkTitle(source='') {
  const fileName=(typeof source === 'object' && source?.name ? source.name : String(source)).split(/[\\/]/).pop().split('?')[0];
  try { return decodeURIComponent(fileName).replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_-]+/g,' ').trim(); }
  catch (_) { return fileName.replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_-]+/g,' ').trim(); }
}

function localArtworkYear(value='') {
  const match=String(value).trim().match(/^(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?$/);
  if(!match) throw new Error(language === 'ko' ? '제작 연도는 1500 또는 1500-1505 형식으로 입력하세요.' : 'Enter a year such as 1500 or a range such as 1500-1505.');
  const year=Number(match[1]), yearEnd=match[2] ? Number(match[2]) : null;
  if(year < 1 || year > 2100 || (yearEnd && (yearEnd < year || yearEnd > 2100))) throw new Error(language === 'ko' ? '제작 연도 범위를 확인하세요.' : 'Check the year range.');
  return {year,yearEnd};
}

function inferredArtworkYear(source='') {
  const fileName=typeof source === 'object' && source?.name ? source.name : String(source);
  const match=fileName.match(/(?:^|[^0-9])([12][0-9]{3})(?:\s*[-–]\s*([12][0-9]{3}))?(?:[^0-9]|$)/);
  return match ? `${match[1]}${match[2] ? `-${match[2]}` : ''}` : '';
}

let pendingLocalArtworkFiles = [];
function setLocalArtworkDetails(fileOrFiles) {
  const files=Array.isArray(fileOrFiles) ? fileOrFiles : (fileOrFiles ? [fileOrFiles] : []);
  const details=$('#local-artwork-details');
  const title=$('#local-artwork-title-input');
  const year=$('#local-artwork-year-input');
  const selected=files.length>0;
  const multiple=files.length>1;
  pendingLocalArtworkFiles=files;
  details.classList.toggle('hidden',!selected);
  title.disabled=!selected || multiple;
  title.required=!multiple;
  year.disabled=!selected;
  if(!selected) { title.value=''; year.value=''; return; }
  title.value=multiple ? (language === 'ko' ? '파일명에서 자동 입력' : 'Filled from filenames') : (title.value.trim() || inferredArtworkTitle(files[0]));
  if(!year.value.trim()) year.value=inferredArtworkYear(files[0]);
  const notice=$('#add-artwork-message');
  notice.textContent=multiple ? (language === 'ko' ? `선택한 파일: ${files.length}개` : `${files.length} files selected`) : (language === 'ko' ? `선택한 파일: ${files[0].name}` : `Selected file: ${files[0].name}`);
  notice.classList.remove('hidden');
}

async function cacheThumbnailFromFile(artist, work, file) {
  const form=new FormData();
  form.append('artist',JSON.stringify({id:artist.id}));
  form.append('work',JSON.stringify(work));
  form.append('image',file,file.name);
  const response=await apiFetch('/api/local-thumbnail-image',{method:'POST',body:form});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || !result.thumbnail) throw new Error(result.error || 'Could not upload the image');
  return result.thumbnail;
}

async function addLocalArtworkToSelectedArtist(file, title, yearInput) {
  const artist=artists.find(item => item.id === artworkDialog.dataset.artistId);
  if(!artist) throw new Error('Selected artist is no longer available');
  if(!file) throw new Error(language === 'ko' ? '이미지 파일을 선택하세요.' : 'Choose an image file.');
  const {year,yearEnd}=localArtworkYear(yearInput || inferredArtworkYear(file));
  const name=title || inferredArtworkTitle(file) || t('untitled');
  const work={id:`manual-local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,year,...(yearEnd ? {yearEnd} : {}),title:{ko:name,en:name},country:{ko:'',en:''},movement:{ko:'',en:''},description:{ko:'',en:''},origin:'manual'};
  if((artist.works || []).some(item => selectionKey(item) === selectionKey(work))) throw new Error(language === 'ko' ? '같은 제목과 제작 연도의 작품이 이미 등록되어 있습니다.' : 'An artwork with this title and year is already listed.');
  work.thumbnail=await cacheThumbnailFromFile(artist,work,file);
  work.thumbnailValidation=2;
  artist.works=selectArtistWorks([...(artist.works || []),work],artistImportedWorkLimit,artist);
  await normalizeArtistWorksBeforeSave(artist);
  persist();
  if(!await saveArtistsNow()) {
    artist.works=(artist.works || []).filter(item => item.id !== work.id);
    throw new Error(language === 'ko' ? '저장 파일을 업데이트하지 못했습니다.' : 'Could not update the saved collection.');
  }
  return artist.works.find(item => item.id === work.id) || work;
}

async function addLocalArtworksToSelectedArtist(files, title, yearInput) {
  if(!files.length) throw new Error(language === 'ko' ? '이미지 파일을 선택하세요.' : 'Choose image files.');
  for(const [index,file] of files.entries()) {
    setArtworkDialogBusy(true, files.length > 1 ? (language === 'ko' ? `이미지를 저장하는 중입니다… ${index+1}/${files.length}` : `Saving images… ${index+1}/${files.length}`) : (language === 'ko' ? '이미지를 저장하는 중입니다.' : 'Saving image.'));
    await addLocalArtworkToSelectedArtist(file, files.length > 1 ? '' : title, yearInput);
  }
}

$('#sort').onchange = renderList;
$('#artist-search').oninput = event => { artistSearchQuery = event.currentTarget.value.trim(); renderList(); };
$('#movement-atlas-button').onclick = openMovementAtlas;
$('#techniques-button').onclick = openTechniquesPage;
$('#topics-button').onclick = openTopicsPage;
$('#close-add-dialog').onclick = () => dialog.close();
$('#close-add-artwork-dialog').onclick = () => artworkDialog.close();
$('#close-slideshow').onclick = closeSlideshow;
window.addEventListener('beforeunload', rememberCurrentTimelineScroll);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !slideshow.classList.contains('hidden')) closeSlideshow(); });
const addButton = $('#add-button');
if (addButton) {
  addButton.onclick = () => { if (!currentUserIsAdmin) return; $('#add-form').reset(); setAddFormBusy(false); delete $('#entry-name').dataset.qid; $('#suggestions').classList.add('hidden'); $('#form-message').classList.add('hidden'); changeEntryType(); dialog.showModal(); };
}
$('#local-artwork-file').addEventListener('change', event => {
  setLocalArtworkDetails([...(event.currentTarget.files || [])]);
});
timelineArtworkPicker.addEventListener('change', event => {
  const files=[...(event.currentTarget.files || [])];
  if(!files.length) return;
  $('#add-artwork-form').reset();
  setArtworkDialogBusy(false);
  setLocalArtworkDetails(files);
  artworkDialog.showModal();
  $('#local-artwork-year-input').focus();
});
$('#add-artwork-form').addEventListener('submit', async event => {
  event.preventDefault();
  const files=pendingLocalArtworkFiles.length ? pendingLocalArtworkFiles : [...($('#local-artwork-file').files || [])];
  if (!files.length) {
    setArtworkDialogBusy(false, language === 'ko' ? '로컬 이미지 파일만 추가할 수 있습니다.' : 'Only local image files can be added.');
    return;
  }
  setArtworkDialogBusy(true, files.length > 1 ? (language === 'ko' ? `이미지를 저장하는 중입니다… 1/${files.length}` : `Saving images… 1/${files.length}`) : (language === 'ko' ? '이미지를 저장하는 중입니다.' : 'Saving image.'));
  try {
    await addLocalArtworksToSelectedArtist(files, $('#local-artwork-title-input').value.trim(), $('#local-artwork-year-input').value);
    pendingLocalArtworkFiles=[];
    artworkDialog.close();
    render();
  } catch (error) {
    setArtworkDialogBusy(false, error.message || (language === 'ko' ? '작품을 추가하지 못했습니다.' : 'Could not add the artwork.'));
  }
});
$('#entry-type').onchange = changeEntryType;
let suggestionTimer;
$('#entry-name').addEventListener('input', event => { delete event.currentTarget.dataset.qid; clearTimeout(suggestionTimer); suggestionTimer = setTimeout(findSuggestions, 280); });
$('#entry-name').addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.currentTarget.dataset.qid) return;
  event.preventDefault();
  clearTimeout(suggestionTimer);
  findSuggestions();
});
async function findSuggestions() {
  const input = $('#entry-name'), box = $('#suggestions'), query = input.value.trim();
  if (['url','artist'].includes($('#entry-type').value)) { box.classList.add('hidden'); return; }
  if (query.length < 2) { box.classList.add('hidden'); return; }
  try {
    const type = $('#entry-type').value;
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`);
    const values = await response.json();
    box.innerHTML = values.map(item => `<button type="button" class="suggestion" data-value="${esc(item.label)}" data-qid="${esc(item.id)}"><strong>${esc(item.label)}</strong><small>${esc(item.description || '')}</small></button>`).join('');
    box.classList.toggle('hidden', !values.length);
    const message = $('#form-message');
    if (!values.length && type === 'artist') { message.textContent = language === 'ko' ? '화가 후보가 없습니다. 이름을 조금 더 입력해 주세요.' : 'No painter found. Please enter more of the name.'; message.classList.remove('hidden'); }
    else message.classList.add('hidden');
    box.querySelectorAll('.suggestion').forEach(button => button.onclick = () => { input.value = button.dataset.value; input.dataset.qid = button.dataset.qid; $('#form-message').classList.add('hidden'); box.classList.add('hidden'); });
  } catch (_) { box.classList.add('hidden'); }
}
function changeEntryType() {
  const input=$('#entry-name'), type=$('#entry-type').value;
  delete input.dataset.qid;
  $('#suggestions').classList.add('hidden');
  document.querySelectorAll('.artwork-field').forEach(x => x.classList.add('hidden'));
  document.querySelector('.artist-field').classList.add('hidden');
  document.querySelector('.artist-full-name-field').classList.toggle('hidden', type !== 'artist');
  document.querySelector('.artist-aliases-field').classList.toggle('hidden', type !== 'artist');
  $('#entry-name-label').textContent = t('webpage');
  input.placeholder = type === 'artist'
    ? (language === 'ko' ? 'https://... 화가를 설명한 페이지' : 'https://... page about the artist')
    : 'https://...';
}
async function resolveArtist(input) {
  if (input.dataset.qid) return {label:input.value.trim(), qid:input.dataset.qid};
  return null;
}
function setAddFormBusy(busy, text='') {
  const button = $('#add-form .save'), message = $('#form-message');
  button.disabled = busy;
  button.textContent = busy ? (language === 'ko' ? '저장 중...' : 'Saving...') : t('save');
  if (text) {
    message.textContent = text;
    message.classList.remove('hidden');
  } else if (!busy) {
    message.classList.add('hidden');
  }
}
$('#add-form').addEventListener('submit', async event => {
  event.preventDefault();
  const type = $('#entry-type').value, name = $('#entry-name').value.trim(), fullName = $('#entry-full-name').value.trim();
  const aliases = $('#entry-artist-aliases').value.split(',').map(value => value.trim()).filter(Boolean);
  if (!name) return;
  setAddFormBusy(true, language === 'ko' ? '화가 항목을 저장하는 중입니다.' : 'Saving artist.');
  try {
    if (type !== 'artist') {
      const message=$('#form-message');
      message.textContent=language === 'ko' ? '웹 URL 또는 외부 작품 QID 가져오기는 제거되었습니다. 화가 항목은 로컬 이미지 파일로만 보강하세요.' : 'Web URL and external artwork QID import have been removed. Add images from local files only.';
      message.classList.remove('hidden');
      return;
    }
    const resolved = await resolveArtist($('#entry-name'));
    if (!resolved) { const message = $('#form-message'); message.textContent = language === 'ko' ? '자동완성 목록에서 화가 후보를 선택해 주세요.' : 'Select an artist from the suggestion list.'; message.classList.remove('hidden'); return; }
    const savedName = resolved.label;
    const id = `artist-${Date.now()}`;
    const artist = {id, name:{ko:savedName,en:savedName}, qid:resolved.qid, birth:Number($('#entry-birth').value) || null, death:null, nationality:{ko:'',en:''}, artistSummary:{ko:[],en:[]}, works:[]};
    if (fullName) artist.fullName = fullName;
    if (aliases.length) artist.aliases = aliases;
    artists.push(artist); selectedId = id;
    const selectedArtist=artists.find(artist=>artist.id===selectedId);
    await normalizeArtistWorksBeforeSave(selectedArtist);
    persist();
    if (!await saveArtistsNow()) {
      const message=$('#form-message');
      message.textContent=language === 'ko' ? '저장 파일을 업데이트하지 못했습니다. 서버가 실행 중인지 확인한 뒤 다시 저장해 주세요.' : 'Could not update the save file. Check that the server is running, then save again.';
      message.classList.remove('hidden');
      return;
    }
    dialog.close();
    render();
  } finally {
    setAddFormBusy(false);
  }
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-display-mode]');
  if (!button) return;
  language = 'ko';
  setUHangulMode(button.dataset.displayMode);
  const openFrame = detail.querySelector('.movement-document-frame');
  if (openFrame && detail.dataset.movementDocumentUrl) {
    renderText();
    openFrame.src = uHangulModeUrl(detail.dataset.movementDocumentUrl);
    return;
  }
  render();
});
$('#logout-button').onclick = logoutEverywhere;
$('#movement-logout-button').onclick = logoutEverywhere;
window.addEventListener('storage', event => {
  if (event.key !== 'art-atlas-logout-signal') return;
  try { sessionStorage.removeItem(accessSessionStorageKey); } catch (_) {}
  location.assign(new URL('index.html?login=1', location.href).href);
});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'art-through-time-uhangul-mode') return;
  setUHangulMode(event.data.mode);
  renderText();
});
$('#migration-export-button').onclick = async () => {
  if (!currentUserIsAdmin) return;
  const button = $('#migration-export-button');
  button.disabled = true;
  try {
    await saveArtistsNow();
    const response = await apiFetch('/api/migration-export', {cache:'no-store'});
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'Could not create export'); }
    const file = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `art-through-time-firebase-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) {
    alert(language === 'ko' ? `Firebase 내보내기를 만들지 못했습니다. ${error.message || ''}` : `Could not create the Firebase export. ${error.message || ''}`);
  } finally {
    button.disabled = false;
  }
};
async function startApp() {
  await chooseAccessMode();
  await loadCurrentUserRole();
  await loadData();
  await enrichArtist();
  restoreLastTimelinePosition();
  if (currentUserIsAdmin) {
    runThumbnailAgent();
  }
}
startApp();
