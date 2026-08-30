/* Shared application state, access control, data, and common helpers. */
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
const countryArtStorageKey = 'art-atlas-country-art-view-v1';
const artistListStorageKey = 'art-atlas-artist-list-view-v2';
const countryArtDocumentRevisionStorageKey = 'art-atlas-country-art-document-revision-v1';
const movementCountryMigrationKey = 'art-atlas-movement-country-migration-v1';
const movementCountryExpansionKey = 'art-atlas-movement-country-expansion-v1';
const detailImageHeightStorageKey = 'art-atlas-detail-image-height-v1';
const detailPanelWidthStorageKey = 'art-atlas-detail-panel-width-v1';
const artistSidebarWidthStorageKey = 'art-atlas-artist-sidebar-width-v1';
const movementSidebarWidthStorageKey = 'art-atlas-movement-sidebar-width-v1';
const countryArtSidebarWidthStorageKey = 'art-atlas-country-art-sidebar-width-v1';
const lastPositionStorageKey = 'art-atlas-last-position-v1';
const favoriteWorksStorageKey = 'art-atlas-favorite-works-v1';
const accessSessionStorageKey = 'art-atlas-access-session-v1';
const sharedAccessSessionStorageKey = 'art-atlas-access-session-shared-v1';
const uHangulModeStorageKey = 'ArtThroughTime.uHangulMode.v7';
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
const movementDensityMinimum = .5;
const movementDensityMaximum = 11.25;
const movementCenturyAxisWidth = 59;
const movementChartGap = 14;
const countryArtDensityMinimum = .25;
const countryArtDensityMaximum = 1;
const artistListDensityMinimum = .03;
const artistListDensityMaximum = 2.25;
const artistListVerticalZoomBoost = 3;
const countryArtLabelColumnWidth = 211;
const countryArtEventRailHeight = 216;
const highResolutionMinimumWidth = 1600;
const artistImportedWorkLimit = 60;
const sharedMovementId = 'global-contemporary';
const artistMovementFallbacks = { Q104884:{ko:'독일 낭만주의',en:'German Romanticism'} };
const isMovementPopup = startupParams.get('movementPopup') === '1';
const isCountryArtPage = startupParams.get('countryArt') === '1';
const isPainterListPage = startupParams.get('artistList') === '1';
const forceLogin = startupParams.get('login') === '1';
if (forceLogin) {
  try {
    sessionStorage.removeItem(accessSessionStorageKey);
    localStorage.removeItem(sharedAccessSessionStorageKey);
  } catch (_) {}
}
function clearLoginRequestFromUrl() {
  if (!forceLogin || !history.replaceState) return;
  const url = new URL(location.href);
  url.searchParams.delete('login');
  const clean = `${url.pathname}${url.search}${url.hash}`;
  history.replaceState(null, '', clean || 'index.html');
}
const requestedUHangulMode = startupParams.get('uhangul');
const initialUHangulMode = ['uhangul','korean','original'].includes(requestedUHangulMode) ? requestedUHangulMode : 'korean';
const requestedArtistId = startupParams.get('artist') || startupParams.get('artistId');
const isArtistListPage = startupParams.get('artists') === '1';
const isDefaultMovementPage = !isMovementPopup && !isCountryArtPage && !isPainterListPage && !isArtistListPage && !requestedArtistId;
const isExplicitMovementPage = isMovementPopup && !isCountryArtPage && !isPainterListPage;
const isMovementPage = isExplicitMovementPage || isDefaultMovementPage;
window.name = isPainterListPage ? 'artThroughTimeArtistList' : (isCountryArtPage ? 'artThroughTimeCountryArt' : (isMovementPage ? 'artThroughTimeMovements' : 'artThroughTimeArtists'));
if (isMovementPage) document.body.classList.add('movement-popup');
if (isCountryArtPage) document.body.classList.add('country-art-page');
if (isPainterListPage) document.body.classList.add('country-art-page', 'artist-list-page');
const legacyMovementCountryIds = ['france','germany','netherlands','italy','united-kingdom','spain','russia','sweden','denmark','greece','united-states'];
const preExpansionMovementCountryIds = ['france','germany','switzerland','netherlands','italy','united-kingdom','spain','russia','sweden','denmark','greece','united-states'];
const allMovementCountryIds = ['france','germany','austria','belgium','switzerland','netherlands','italy','united-kingdom','spain','russia','norway','sweden','denmark','greece','mexico','united-states'];
const historicalEventCategories = ['history', 'religion-thought', 'science-economy', 'art'];
const defaultMovementView = {countries:[...allMovementCountryIds],start:movementAtlasStart,end:movementAtlasEnd,showHistoricalEvents:true,eventCategory:'history',density:1};
const defaultCountryArtView = {country:'france',start:movementAtlasStart,end:movementCountryEnd,density:1};
const defaultArtistListView = {countries:['netherlands','denmark','germany','belgium','spain','united-kingdom','austria','italy','france','russia','switzerland'],start:movementAtlasStart,end:movementCountryEnd,density:1};
let language = 'ko';
let uHangulMode = initialUHangulMode;
let artists = [];
let selectedId = localStorage.getItem('art-atlas-selected');
let requestedArtistMissing = false;
// The root screen opens with the movement atlas. Explicit artist, country, and
// movement-popup URLs still select their requested view later.
let viewMode = isPainterListPage ? 'artist-list' : (isCountryArtPage ? 'country-art' : (isMovementPage ? 'movements' : 'timeline'));
let movementCountries = [];
let movementContextOnlyNames = new Set();
let artMovementCanonical = {parents:[],categories:[]};
let movementView = parseMovementView();
let countryArtView = parseCountryArtView();
let artistListView = parseArtistListView();
let artistListManualMovementOrder = [];
let artistListScrollTopToRestore = null;
let countryArtResetZoomOnRender = true;
const countryArtWorkCache = new Map();
const countryArtWorkRequests = new Map();
const artistListCountryDevelopmentRepresentatives = new Map();
let artistListCountryDevelopmentRepresentativesReady = false;
let artistListCountryDevelopmentRepresentativesRequest = null;
let countryArtEvents = {schema:1,countries:{}};
let countryMovementBackgrounds = {schema:1,countries:{},mechanisms:{}};
if (localStorage.getItem(movementCountryMigrationKey) !== 'v1') {
  if (legacyMovementCountryIds.every(id => movementView.countries.includes(id)) && !movementView.countries.includes('switzerland')) {
    movementView.countries = [...movementView.countries, 'switzerland'];
    persistMovementView();
  }
  localStorage.setItem(movementCountryMigrationKey, 'v1');
}
if (localStorage.getItem(movementCountryExpansionKey) !== 'v1') {
  // Preserve a deliberately narrowed country selection; expand only a prior all-country view.
  if (preExpansionMovementCountryIds.every(id => movementView.countries.includes(id))) {
    movementView.countries = [...new Set([...movementView.countries, 'austria', 'belgium', 'norway'])];
    persistMovementView();
  }
  localStorage.setItem(movementCountryExpansionKey, 'v1');
}
let thumbnailObserver;
const profileRequests = new Set();
const artworkInfoRequests = new Set();
let saveTimer;
let saveInFlight;
let artistCollectionChangeVersion = 0;
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
function syncAdminSessionFromStorage() {
  const saved = savedAccessSession();
  if (saved?.role !== 'admin' || !saved.token || saved.token === adminSessionToken) return false;
  currentUserEmail = String(saved.email || '');
  currentUserRole = 'admin';
  currentUserIsAdmin = true;
  adminSessionToken = saved.token;
  return true;
}
async function apiFetch(endpoint, options={}) {
  syncAdminSessionFromStorage();
  const headers = new Headers(options.headers || {});
  if (adminSessionToken) headers.set('Authorization', `Bearer ${adminSessionToken}`);
  let response = await fetch(apiUrl(endpoint), {...options, headers});
  if (response.status === 401 && syncAdminSessionFromStorage()) {
    const retryHeaders = new Headers(options.headers || {});
    if (adminSessionToken) retryHeaders.set('Authorization', `Bearer ${adminSessionToken}`);
    response = await fetch(apiUrl(endpoint), {...options, headers:retryHeaders});
  }
  return response;
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
  const isCountryArtLayoutPage = isCountryArtPage || isPainterListPage;
  const sidebarWidthStorageKey = isCountryArtLayoutPage ? countryArtSidebarWidthStorageKey : (isMovementPage ? movementSidebarWidthStorageKey : artistSidebarWidthStorageKey);
  if (!shell || !sidebar) return;
  const mobileQuery = window.matchMedia('(max-width: 590px)');
  const compactQuery = window.matchMedia('(max-width: 840px)');
  const minWidth = () => compactQuery.matches ? (isCountryArtLayoutPage ? 221 : 245) : (isCountryArtLayoutPage ? 281 : 312);
  const maxWidth = () => Math.max(
    minWidth(),
    Math.min(
      compactQuery.matches ? (isCountryArtLayoutPage ? 387 : 430) : (isCountryArtLayoutPage ? 504 : 560),
      Math.floor(window.innerWidth * (compactQuery.matches ? (isCountryArtLayoutPage ? 0.468 : 0.52) : (isCountryArtLayoutPage ? 0.396 : 0.44))),
    ),
  );
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
    if (save) localStorage.setItem(sidebarWidthStorageKey, String(width));
  };
  const savedWidth = Number(localStorage.getItem(sidebarWidthStorageKey));
  if (savedWidth) setWidth(savedWidth);
  const handle = document.createElement('div');
  handle.className = 'sidebar-resize-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', isMovementPage ? (language === 'ko' ? '사조 목록 너비 조절' : 'Resize movement list') : (language === 'ko' ? '화가 목록 너비 조절' : 'Resize artist list'));
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
    const width = Number(localStorage.getItem(sidebarWidthStorageKey));
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
  ko: {artistWorksTitle:'화가 및 작품',collection:'나의 화가 목록',sort:'정렬',nameAsc:'이름오름차순',nameDesc:'이름내림차순',birthAsc:'생년순',addArtist:'화가 추가',newRecord:'NEW RECORD',addTitle:'화가 추가',addHelp:'이름을 입력한 뒤 자동완성 목록에서 정확한 후보를 선택해 저장하세요.',addArtwork:'그림 추가',addArtworkTitle:'그림 1점 추가',artworkPage:'로컬 이미지 파일',artworkTitleInput:'작품 제목 (선택)',artworkYearInput:'제작 연도 (선택)',entryType:'추가할 항목',artist:'화가',painting:'그림',webpage:'웹페이지 주소',name:'이름',birthYear:'Birth year (optional)',artistName:'화가 이름',madeYear:'제작 연도',save:'저장하기',timeline:'작품 연표',slideshow:'슬라이드 쇼',selectWork:'작품을 선택하면\n이곳에서 자세히 볼 수 있어요.',noWork:'아직 등록한 작품이 없습니다.',noImage:'이미지 없음',imagePendingUpload:'이미지 업로드 예정',untitled:'제목 없는 작품',unknown:'정보 없음',country:'제작 국가',movement:'화파',year:'제작 연도',source:'저장된 출처',delete:'삭제',confirmDelete:'이 화가와 등록한 작품을 목록에서 삭제할까요?',confirmDeleteWork:'이 작품을 삭제할까요?',manualWorks:'직접 추가한 작품',movementAtlas:'미술 사조로 보기',countries:'비교할 나라',selectAllCountries:'전체 선택 / 해제',exportChanges:'변경사항_압축',period:'기간',artistSpan:'선택 화가의 활동 기간',storedInfo:'저장된 작품 정보',loadingInfo:'작품 정보를 정리해 저장하는 중입니다.',noInfo:'저장된 설명이 아직 없습니다.',favorites:'MY FAVORITES',searchArtists:'화가 이름 검색',movementFilter:'사조 선택',allMovements:'전체 사조',clearMovementFilter:'사조 필터 해제',noSearchResult:'일치하는 화가가 없습니다.'},
  en: {artistWorksTitle:'Artists and Works',collection:'MY ARTISTS',sort:'SORT',nameAsc:'Name ascending',nameDesc:'Name descending',birthAsc:'Birth year',addArtist:'Add artist',addTitle:'Add artist',addHelp:'Enter a name, then choose the correct artist from suggestions.',addArtwork:'Add artwork',addArtworkTitle:'Add one artwork',artworkPage:'Local image file',artworkTitleInput:'Artwork title (optional)',artworkYearInput:'Year made (optional)',entryType:'Add',artist:'Artist',painting:'Artwork',webpage:'Webpage URL',name:'Name',birthYear:'Birth year (optional)',artistName:'Artist name',madeYear:'Year made',save:'Save',timeline:'WORKS TIMELINE',slideshow:'Slideshow',selectWork:'Select an artwork\nto view its details here.',noWork:'No artworks have been added yet.',noImage:'No image available',imagePendingUpload:'Image scheduled for upload',untitled:'Untitled',unknown:'Unknown',country:'Country made',movement:'Movement',year:'Year made',source:'Stored source',delete:'Delete this artist and their listed works?',confirmDeleteWork:'Delete this artwork?',manualWorks:'MANUALLY ADDED WORKS',movementAtlas:'Movement comparison',countries:'Countries',selectAllCountries:'Select / clear all',exportChanges:'EXPORT CHANGES',period:'Period',artistSpan:'Selected artist lifespan',storedInfo:'Stored artwork information',loadingInfo:'Preparing and saving artwork information.',noInfo:'No stored description yet.',favorites:'MY FAVORITES',searchArtists:'Search artists',movementFilter:'Movement filter',allMovements:'All movements',clearMovementFilter:'Clear movement filter',noSearchResult:'No matching artists.'}
};
Object.assign(copy.ko, {
  fullName:'정식 한국어 이름 (선택)',
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
function ordinalSuffix(number) {
  const value = Math.abs(Number(number) || 0);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  return {1:'st', 2:'nd', 3:'rd'}[value % 10] || 'th';
}
function timelineCenturyStart(year) {
  const value = Number(year);
  return Number.isFinite(value) ? Math.floor(value / 100) * 100 : null;
}
function timelineCenturyLabelFromStart(start) {
  const value = Number(start);
  if (!Number.isFinite(value)) return language === 'ko' ? '연도 미상' : 'Undated';
  const century = Math.floor(value / 100) + 1;
  return language === 'ko' ? `${century}세기` : `${century}${ordinalSuffix(century)} century`;
}
function timelineCenturyBands(start, end, yearScale) {
  const first = timelineCenturyStart(start);
  if (first === null) return '';
  const axisEnd = Math.max(start + 1, end);
  const bands = [];
  let index = 0;
  for (let year = first; year < axisEnd; year += 100) {
    const clippedStart = Math.max(start, year);
    const clippedEnd = Math.min(axisEnd, year + 100);
    if (clippedEnd <= clippedStart) {
      index++;
      continue;
    }
    const left = (clippedStart - start) * yearScale;
    const width = Math.max(1, (clippedEnd - clippedStart) * yearScale);
    bands.push(`<span class="timeline-century-band ${index % 2 ? '' : 'timeline-century-band--tinted'}" style="left:${left}px;width:${width}px"><span>${esc(timelineCenturyLabelFromStart(year))}</span></span>`);
    index++;
  }
  return bands.join('');
}
function timelineVerticalCenturyBands(start, end, yearScale, className='timeline-century-y-band') {
  const first = timelineCenturyStart(start);
  if (first === null) return '';
  const axisEnd = Math.max(start + 1, end);
  const bands = [];
  let index = 0;
  for (let year = first; year < axisEnd; year += 100) {
    const clippedStart = Math.max(start, year);
    const clippedEnd = Math.min(axisEnd, year + 100);
    if (clippedEnd <= clippedStart) {
      index++;
      continue;
    }
    const top = (clippedStart - start) * yearScale;
    const height = Math.max(1, (clippedEnd - clippedStart) * yearScale);
    bands.push(`<span class="${className} ${index % 2 ? '' : `${className}--tinted`}" style="top:${top}px;height:${height}px"><span>${esc(timelineCenturyLabelFromStart(year))}</span></span>`);
    index++;
  }
  return bands.join('');
}
function uHangulArtistAttributes(artist, displayName) {
  const original = artist?.name?.en || '';
  const korean = artistStandardKoreanName(artist);
  const display = artistUHangulDisplayName(artist) || korean;
  const listKorean = displayName || korean;
  if (!original && !korean && !display && !listKorean) return '';
  return ` data-uh-original="${esc(original)}" data-uh-korean="${esc(korean)}" data-uh-display-korean="${esc(display)}" data-uh-list-korean="${esc(listKorean)}"`;
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
function openNamedPage(url, targetName) {
  const opened = window.open('', targetName);
  if (!opened) return;
  try {
    if (opened.location.href !== url) opened.location.href = url;
  } catch (_) {
    opened.location.href = url;
  }
  if (typeof opened.focus === 'function') opened.focus();
}
function generatedCatalogueFile(artistOrResult={}) {
  return `data/generated/${artistOrResult.qid ? `qid-${artistOrResult.qid}` : artistOrResult.id}.json`;
}
function openArtistListPage() {
  const pageUrl = new URL('index.html', location.href);
  pageUrl.searchParams.delete('artistList');
  pageUrl.searchParams.delete('countryArt');
  pageUrl.searchParams.delete('movementPopup');
  pageUrl.searchParams.set('artists', '1');
  openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeArtists');
}
function openArtistTimelinePage(artistId) {
  if (!artistId) return;
  const pageUrl = new URL('index.html', location.href);
  pageUrl.searchParams.delete('artistList');
  pageUrl.searchParams.delete('countryArt');
  pageUrl.searchParams.delete('movementPopup');
  pageUrl.searchParams.set('artists', '1');
  pageUrl.searchParams.set('artist', artistId);
  openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeArtists');
}
function openPainterListPage() {
  if (!isPainterListPage) {
    const pageUrl = new URL('index.html', location.href);
    pageUrl.searchParams.delete('artists');
    pageUrl.searchParams.delete('artist');
    pageUrl.searchParams.delete('artistId');
    pageUrl.searchParams.delete('countryArt');
    pageUrl.searchParams.delete('movementPopup');
    pageUrl.searchParams.set('artistList', '1');
    openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeArtistList');
    return;
  }
  artistListView = normalizeArtistListView(artistListView);
  persistArtistListView();
  countryArtResetZoomOnRender = true;
  viewMode = 'artist-list';
  closeDetail();
  render();
}
function openTechniquesPage() {
  openNamedPage(uHangulModeUrl('techniques.html'), 'artThroughTimeTechniques');
}
function openTopicsPage() {
  openNamedPage(uHangulModeUrl('topics.html'), 'artThroughTimeTopics');
}
function openCountryArtPage() {
  if (!isCountryArtPage) {
    const pageUrl = new URL('index.html', location.href);
    pageUrl.searchParams.delete('artists');
    pageUrl.searchParams.delete('artistList');
    pageUrl.searchParams.delete('artist');
    pageUrl.searchParams.delete('artistId');
    pageUrl.searchParams.delete('movementPopup');
    pageUrl.searchParams.set('countryArt', '1');
    openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeCountryArt');
    return;
  }
  countryArtView = normalizeCountryArtView(countryArtView);
  persistCountryArtView();
  viewMode = 'country-art';
  closeDetail();
  render();
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
const isLocalArtworkPath = value => String(value || '').trim().replace(/\\/g,'/').startsWith('data/images/');
const hasLocalArtworkAsset = work => [
  work?.localImage,
  work?.thumbnail,
  work?.image,
  work?.highResImage,
  work?.highResOriginal,
  work?.migration?.image?.localThumbnail,
  work?.migration?.image?.highResolution
].some(isLocalArtworkPath);
const workPopularity = work => Number.isFinite(Number(work.popularity)) ? Number(work.popularity) : 0;
const workYearForSort = work => {
  const value = String(work?.year ?? '').trim();
  const year = Number(value);
  return value && Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
};
const movementNameParts = value => [...new Set(
  (typeof value === 'string' ? [value] : [value?.ko,value?.en])
    .map(item => String(item || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim())
    .filter(Boolean)
)];
const movementNameContains = (longer,shorter) => {
  const compactLonger = longer.replace(/[^\p{L}\p{N}]+/gu,'');
  const compactShorter = shorter.replace(/[^\p{L}\p{N}]+/gu,'');
  const index = compactLonger.indexOf(compactShorter);
  if (index < 0) return false;
  const prefix = compactLonger.slice(0,index);
  return !/(?:post|neo|néo|후기|신)$/.test(prefix);
};
function movementNamesMatch(left,right) {
  const leftNames = movementNameParts(left);
  const rightNames = movementNameParts(right);
  return leftNames.some(leftName => rightNames.some(rightName =>
    leftName === rightName || movementNameContains(leftName,rightName) || movementNameContains(rightName,leftName)
  ));
}
const workMovementText = work => movementNameParts(work?.movement).join(' ');
function representativeScore(work, artist={}) {
  const source = String(work?.source || '');
  const movement = workMovementText(work);
  let score = workPopularity(work);
  if (work?.origin === 'curated') score += 100000;
  if (work?.image || work?.thumbnail) score += 1200;
  if (work?.verified) score += 600;
  if (/wikidata\.org|commons\.wikimedia\.org|api\.artic\.edu|clevelandart\.org/i.test(source)) score += 420;
  if (/wikipedia\.org/i.test(source)) score -= 120;
  if (movementNamesMatch(work?.movement,artist?.movement)) score += 900;
  if (movement) score += 240;
  if (work?.description?.ko || work?.description?.en) score += 120;
  return score;
}
function movementMatchesArtist(work, artist={}) {
  return movementNamesMatch(work?.movement,artist?.movement);
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
  const localWorks = unique.filter(work => !manualKeys.has(selectionKey(work)) && !curatedKeys.has(selectionKey(work)) && hasLocalArtworkAsset(work)).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const localKeys = new Set(localWorks.map(selectionKey));
  const generatedWorks = unique.filter(work => !manualKeys.has(selectionKey(work)) && !curatedKeys.has(selectionKey(work)) && !localKeys.has(selectionKey(work))).sort((a,b) => representativeScore(b,artist) - representativeScore(a,artist) || workYearForSort(a) - workYearForSort(b));
  const selected = [...manualWorks,...curatedWorks,...localWorks,...generatedWorks.slice(0,Math.max(0,limit-manualWorks.length-curatedWorks.length-localWorks.length))];
  const authoritativeContributions = selected.filter(work =>
    work?.movementContribution && work?.movementContributionReason !== 'artist-movement-characteristic'
  );
  const aligned = selected.filter(work => movementMatchesArtist(work, artist));
  const contributionPool = aligned.length ? aligned : selected;
  const movementContributionKeys = new Set(
    (authoritativeContributions.length ? authoritativeContributions : contributionPool
      .sort((a,b) => movementContributionScore(b,artist) - movementContributionScore(a,artist) || workYearForSort(a) - workYearForSort(b))
      .slice(0,3))
      .map(selectionKey)
  );
  return selected.map(work => {
    const movementContribution = movementContributionKeys.has(selectionKey(work));
    const next = {...work,movementContribution};
    if (!movementContribution) delete next.movementContributionReason;
    else if (!authoritativeContributions.length) next.movementContributionReason = 'artist-movement-characteristic';
    return next;
  }).sort((a,b) => workYearForSort(a) - workYearForSort(b));
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
const koreanArtistListNameOverrides = {
  Q7814: '조토',
  Q102272: '반 에이크',
  Q68631: '반 데르 베이던',
  Q762: '다 빈치',
  Q5592: '미켈란젤로',
  Q5597: '라파엘로',
  Q47551: '티치아노',
  Q312617: '로소',
  Q48319: '홀바인',
  Q7803: '브론치노',
  Q9348: '파르미자니노',
  Q9319: '틴토레토',
  Q43270: '브뤼헐',
  Q301: '엘 그레코',
  Q42207: '카라바조',
  Q5598: '렘브란트',
  Q82445: '툴루즈로트레크',
  Q155151: '바토',
  Q296: '모네'
};
const koreanNameParticles = new Set(['반', '판', '폰', '데', '드', '델', '다', '디', '더', '르', '라', '레', '테르']);
function koreanNameFirst(name) {
  const source = String(name || '').trim();
  if (!source.includes(',')) return source;
  const [family, given] = source.split(',').map(part => part.trim()).filter(Boolean);
  return [given, family].filter(Boolean).join(' ') || source;
}
function artistDisplayName(artist) {
  if (language !== 'ko') return loc(artist?.name);
  return artistStandardKoreanName(artist);
}
function artistStandardKoreanName(artist) {
  return koreanNameFirst(artist?.name?.ko || loc(artist?.name) || artist?.fullName || '');
}
function artistUHangulDisplayName(artist) {
  const koreanName = artistStandardKoreanName(artist);
  return koreanArtistDisplayOverrides[artist?.qid] || koreanFamilyFirst(koreanName, artist?.name?.en || '');
}
function artistListKoreanName(artist) {
  const explicit = artist?.listName?.ko || artist?.shortName?.ko;
  if (explicit) return explicit;
  const qid = artist?.qid;
  if (koreanArtistListNameOverrides[qid]) return koreanArtistListNameOverrides[qid];
  const aliases = textList(artist?.aliases?.ko || []);
  const standard = artistStandardKoreanName(artist);
  const alias = aliases.find(value => {
    const text = String(value || '').trim();
    return text && !text.includes(',') && text !== standard && text.split(/\s+/).length <= 3;
  });
  if (alias) return alias;
  const words = standard.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length <= 1) return standard;
  let start = words.length - 1;
  while (start > 0 && koreanNameParticles.has(words[start - 1])) start--;
  return words.slice(start).join(' ');
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
  return [artist?.fullName, artist?.name?.ko, artist?.name?.en, loc(artist?.name), artistDisplayName(artist), artistUHangulDisplayName(artist), artistListKoreanName(artist), ...artistAliases(artist)].filter(Boolean).join(' ').toLocaleLowerCase();
}
function compareArtistsByName(a, b) {
  return artistListKoreanName(a).localeCompare(artistListKoreanName(b), 'ko');
}
function compareArtistsForSort(a, b, sort) {
  if (sort === 'birth') return (a.birth || 9999) - (b.birth || 9999) || compareArtistsByName(a, b);
  const byName = compareArtistsByName(a, b);
  return sort === 'nameDesc' ? -byName : byName;
}
function artistLinks(artist) {
  return Array.isArray(artist?.links) ? artist.links.filter(link => {
    try { return ['http:', 'https:'].includes(new URL(link.url || link).protocol); }
    catch (_) { return false; }
  }).map(link => typeof link === 'string' ? {url:link} : link) : [];
}
function linkEmphasisField() {
  const label=language==='ko'?'강조':'Emphasize';
  return `<label class="link-emphasis-field"><input type="checkbox" data-link-emphasis><span>${esc(label)}</span></label>`;
}
function savedLinkFromEntry(url, form) {
  return {url:url.href,...(form?.querySelector('[data-link-emphasis]')?.checked?{emphasized:true}:{})};
}
function linkEmphasisClass(link) {
  return link?.emphasized===true?' link-emphasized':'';
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
    if (!await saveArtistPresentationNow(artist,{artistLinks:artist.links})) {
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
    if (!await saveArtistPresentationNow(artist,{workId:work.id,workLinks:artworkLinks(work)})) {
      setArtworkLinks(artist, work, previousLinks);
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
      const nextLinks = options.getLinks(button);
      if (!await options.saveLinks(nextLinks, button)) {
        options.setLinks(previousLinks, button);
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
const offlineArtworkPlaceholder = 'data/images/_placeholder/artwork-placeholder.png';
function localArtworkImage(work) {
  const image = [work?.thumbnail, work?.image, work?.highResImage, work?.highResOriginal]
    .find(value => value && !isExternalImageSource(value)) || '';
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
function unavailableImageLabel(work) {
  return work?.imageUploadStatus === 'pending-upload' ? t('imagePendingUpload') : t('noImage');
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
}
function revealInitialAppShell() {
  document.body.classList.remove('auth-pending');
  document.body.classList.add('auth-ready');
}
function enterViewerMode({clearShared=false} = {}) {
  if (adminSessionHeartbeat) clearInterval(adminSessionHeartbeat);
  adminSessionHeartbeat = undefined;
  currentUserEmail = '';
  currentUserRole = 'viewer';
  currentUserIsAdmin = false;
  adminSessionToken = '';
  try { sessionStorage.setItem(accessSessionStorageKey, JSON.stringify({role:'viewer'})); } catch (_) {}
  if (clearShared) try { localStorage.removeItem(sharedAccessSessionStorageKey); } catch (_) {}
  clearLoginRequestFromUrl();
}
function saveAdminSession(email, token) {
  const session = JSON.stringify({role:'admin',email,token});
  try { sessionStorage.setItem(accessSessionStorageKey, session); } catch (_) {}
  try { localStorage.setItem(sharedAccessSessionStorageKey, session); } catch (_) {}
  clearLoginRequestFromUrl();
}
function removeSavedAdminSession(token='') {
  const removeMatchingSession = (storage, key) => {
    try {
      const saved = JSON.parse(storage.getItem(key) || 'null');
      if (!token || saved?.token === token) storage.removeItem(key);
    } catch (_) {
      storage.removeItem(key);
    }
  };
  removeMatchingSession(sessionStorage, accessSessionStorageKey);
  removeMatchingSession(localStorage, sharedAccessSessionStorageKey);
}
async function logoutEverywhere() {
  if (typeof window.artThroughTimeLogoutAll === 'function') return window.artThroughTimeLogoutAll();
  try { await apiFetch('/api/auth/logout',{method:'POST',cache:'no-store'}); } catch (_) {}
  if (adminSessionHeartbeat) clearInterval(adminSessionHeartbeat);
  try { sessionStorage.removeItem(accessSessionStorageKey); localStorage.removeItem(sharedAccessSessionStorageKey); } catch (_) {}
  try { localStorage.setItem('art-atlas-logout-signal', String(Date.now())); } catch (_) {}
  location.assign(new URL('index.html?login=1', location.href).href);
}
function savedAccessSession() {
  try {
    const privateSession=JSON.parse(sessionStorage.getItem(accessSessionStorageKey) || 'null');
    const sharedSession=JSON.parse(localStorage.getItem(sharedAccessSessionStorageKey) || 'null');
    if (sharedSession?.role === 'admin' && sharedSession.token) return sharedSession;
    return privateSession && ['admin','viewer'].includes(privateSession.role) ? privateSession : null;
  } catch (_) {
    return null;
  }
}
function startAdminSessionHeartbeat() {
  if (adminSessionHeartbeat) clearInterval(adminSessionHeartbeat);
  const keepAlive = async () => {
    if (!currentUserIsAdmin) return;
    const checkedToken = adminSessionToken;
    try {
      const response = await apiFetch('/api/auth/heartbeat',{method:'POST',cache:'no-store'});
      if (!response.ok) throw new Error('관리자 세션이 종료되었습니다.');
    } catch (_) {
      if (adminSessionToken !== checkedToken || syncAdminSessionFromStorage()) return;
      removeSavedAdminSession(checkedToken);
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
      removeSavedAdminSession(adminSessionToken);
      currentUserEmail='';
      currentUserRole='viewer';
      currentUserIsAdmin=false;
      adminSessionToken='';
      if (isExplicitMovementPage) return;
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
  if (isExplicitMovementPage) {
    enterViewerMode();
    return;
  }
  let adminUnavailableMessage = '';
  try {
    const response = await fetch(apiUrl('/api/access'), {cache:'no-store'});
    const access = response.ok ? await response.json() : null;
    if (access?.adminConfigured === false) {
      adminUnavailableMessage = '관리자 설정 파일(.env)이 없어 지금은 보기 전용으로 실행 중입니다. 읽기 전용을 누르면 자료를 볼 수 있습니다.';
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
  if (!currentUserIsAdmin && !syncAdminSessionFromStorage()) {
    lastSaveError = language === 'ko' ? '관리자 세션을 찾지 못했습니다.' : 'Administrator session was not found.';
    return false;
  }
  clearTimeout(saveTimer);
  if (saveInFlight) await saveInFlight.catch(() => false);
  const snapshot = artistSnapshot();
  const saveVersion = artistCollectionChangeVersion;
  if (snapshot === lastSavedSnapshot) return true;
  const request = saveInFlight = (async () => {
    const response = await apiFetch('/api/artists', {method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot});
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error(language === 'ko' ? '관리자 세션이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.' : 'Administrator session expired. Refresh the page and sign in again.');
    }
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    if (Number.isInteger(result.revision)) collectionMetadata = {...collectionMetadata,revision:result.revision};
    lastSavedSnapshot = artistCollectionChangeVersion === saveVersion ? artistSnapshot() : '';
    lastSaveError = '';
    localStorage.removeItem(storageKey);
    return true;
  })();
  try {
    return await saveInFlight;
  } catch (error) {
    // User data must be portable: never leave a new record only in this browser.
    lastSaveError = error?.message || '저장 요청을 처리하지 못했습니다.';
    localStorage.removeItem(storageKey);
    return false;
  } finally {
    if (saveInFlight === request) saveInFlight = undefined;
  }
}
async function saveArtistPresentationNow(artist, patch) {
  if (!currentUserIsAdmin && !syncAdminSessionFromStorage()) {
    lastSaveError = language === 'ko' ? '관리자 세션을 찾지 못했습니다.' : 'Administrator session was not found.';
    return false;
  }
  if (saveInFlight) await saveInFlight.catch(() => false);
  const request = saveInFlight = (async () => {
    const response = await apiFetch('/api/artist-presentation', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({artistId:artist.id,...patch})});
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error(language === 'ko' ? '관리자 세션이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.' : 'Administrator session expired. Refresh the page and sign in again.');
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    if (result.artist) Object.assign(artist,result.artist);
    if (Number.isInteger(result.revision)) collectionMetadata = {...collectionMetadata,revision:result.revision};
    lastSavedSnapshot = artistSnapshot();
    lastSaveError = '';
    return true;
  })();
  try {
    return await request;
  } catch (error) {
    lastSaveError = error?.message || '저장 요청을 처리하지 못했습니다.';
    return false;
  } finally {
    if (saveInFlight === request) saveInFlight = undefined;
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
function markArtistCollectionChanged() { artistCollectionChangeVersion += 1; }

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
  } catch (_) { /* The main collection continues to work without the optional curated list. */ }
  await markLegacyManualWorks();
  // Loading may overlay curated data and legacy provenance in memory, but a
  // read-only page visit must never rewrite the administrator's data files.
  try { artTaxonomy = await (await fetch('data/art-taxonomy.json')).json(); } catch (_) { artTaxonomy = {periods:[], movements:[]}; }
  try { artMovementCanonical = await (await fetch('data/art-movement-canonical.json')).json(); } catch (_) { artMovementCanonical = {parents:[],categories:[]}; }
  try {
    const movementData = await (await fetch('data/art-movements.json')).json();
    movementCountries = movementData.countries || [];
    movementContextOnlyNames = new Set((movementData.contextOnlyMovements || []).map(compactMovementName));
  } catch (_) {
    movementCountries = [];
    movementContextOnlyNames = new Set();
  }
  try { countryArtEvents = await (await fetch('data/country-art-events.json', {cache:'no-store'})).json(); } catch (_) { countryArtEvents = {schema:1,countries:{}}; }
  try { countryMovementBackgrounds = await (await fetch('data/country-movement-backgrounds.json', {cache:'no-store'})).json(); } catch (_) { countryMovementBackgrounds = {schema:1,countries:{},mechanisms:{}}; }
  try { movementDocuments = (await (await fetch(apiUrl('/api/movement-documents'))).json()).documents || {}; } catch (_) { movementDocuments = {}; }
  const requestedArtist = requestedArtistId ? artists.find(a => a.id === requestedArtistId) : null;
  if (requestedArtist) {
    selectedId = requestedArtistId;
    if (!isCountryArtPage && !isPainterListPage && !isMovementPage) viewMode = 'timeline';
    localStorage.setItem('art-atlas-selected', selectedId);
  } else if (requestedArtistId) {
    requestedArtistMissing = true;
    selectedId = null;
    if (!isCountryArtPage && !isPainterListPage && !isMovementPage) viewMode = 'timeline';
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
function persistSelection() { localStorage.setItem('art-atlas-selected', selectedId || ''); }
function persist() { persistSelection(); markArtistCollectionChanged(); queueArtistSave(); }
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
function movementIsContextOnly(movement) {
  const names = typeof movement === 'string' ? [movement] : [movement?.name?.en, movement?.name?.ko];
  return names.some(name => movementContextOnlyNames.has(compactMovementName(name)));
}
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
  movementFilterSpec({ko:'덴마크 르네상스', en:'Danish Renaissance'}, ['Danish Renaissance','덴마크 르네상스'], {parent:{ko:'북방 르네상스', en:'Northern Renaissance'}, documentLabel:{ko:'북방 르네상스', en:'Northern Renaissance'}}),
  movementFilterSpec({ko:'노르딕 르네상스', en:'Nordic Renaissance'}, ['Nordic Renaissance','북유럽 르네상스','노르딕 르네상스'], {parent:{ko:'북방 르네상스', en:'Northern Renaissance'}, documentLabel:{ko:'북방 르네상스', en:'Northern Renaissance'}}),
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
  movementFilterSpec({ko:'러시아 바로크', en:'Russian Baroque'}, ['Russian Baroque','러시아 바로크'], {parent:{ko:'바로크', en:'Baroque'}, documentLabel:{ko:'바로크', en:'Baroque'}}),
  movementFilterSpec({ko:'러시아 사실주의', en:'Russian Realism'}, ['Russian Realism','러시아 사실주의'], {parent:{ko:'사실주의', en:'Realism'}, documentLabel:{ko:'사실주의', en:'Realism'}}),
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
  // Country-level movements often share a single explanation document with
  // their parent movement. Resolve that documented parent before falling back
  // to an external encyclopedia search.
  const displayRule = artistMovementDisplayRules.find(rule => rule.keys.has(compact));
  const hierarchyGroup = artistMovementFilterHierarchy.find(group => movementFilterTreeKeys(group).has(compact));
  const documentedCandidate = [
    displayRule?.documentLabel?.en,
    displayRule?.documentLabel?.ko,
    displayRule?.parent?.en,
    displayRule?.parent?.ko,
    hierarchyGroup?.label?.en,
    hierarchyGroup?.label?.ko
  ].find(candidate => candidate && movementDocuments?.[candidate]?.['1']);
  if (documentedCandidate) return documentedCandidate;
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
  density = Math.round(Math.min(movementDensityMaximum, Math.max(movementDensityMinimum, density)) * 100) / 100;
  const eventCategory = historicalEventCategories.includes(value?.eventCategory) ? value.eventCategory : defaultMovementView.eventCategory;
  return {
    // An empty array is a valid "clear all" choice; only a missing or malformed value uses the default.
    countries: Array.isArray(value?.countries) ? value.countries : [...defaultMovementView.countries],
    start,
    end,
    showHistoricalEvents: value?.showHistoricalEvents !== false,
    eventCategory,
    density,
  };
}
function parseMovementView() {
  try { return normalizeMovementView(JSON.parse(localStorage.getItem(movementStorageKey) || JSON.stringify(defaultMovementView))); }
  catch (_) { return normalizeMovementView(defaultMovementView); }
}
function normalizeCountryArtView(value) {
  let start = Number(value?.start), end = Number(value?.end), density = Number(value?.density);
  if (!Number.isFinite(start)) start = defaultCountryArtView.start;
  if (!Number.isFinite(end)) end = defaultCountryArtView.end;
  if (!Number.isFinite(density)) density = defaultCountryArtView.density;
  start = Math.min(movementCountryEnd - movementMinimumRangeSpan, Math.max(movementAtlasMinimum, Math.round(start)));
  end = Math.max(start + movementMinimumRangeSpan, Math.min(movementCountryEnd, Math.round(end)));
  density = Math.round(Math.min(countryArtDensityMaximum, Math.max(countryArtDensityMinimum, density)) * 100) / 100;
  return {country:allMovementCountryIds.includes(value?.country) ? value.country : defaultCountryArtView.country, start, end, density};
}
function parseCountryArtView() {
  try { return normalizeCountryArtView(JSON.parse(localStorage.getItem(countryArtStorageKey) || JSON.stringify(defaultCountryArtView))); }
  catch (_) { return normalizeCountryArtView(defaultCountryArtView); }
}
function persistCountryArtView() { localStorage.setItem(countryArtStorageKey, JSON.stringify(countryArtView)); }
function normalizeArtistListView(value) {
  let start = Number(value?.start), end = Number(value?.end), density = Number(value?.density);
  if (!Number.isFinite(start)) start = defaultArtistListView.start;
  if (!Number.isFinite(end)) end = defaultArtistListView.end;
  if (!Number.isFinite(density)) density = defaultArtistListView.density;
  start = Math.min(movementCountryEnd - movementMinimumRangeSpan, Math.max(movementAtlasMinimum, Math.round(start)));
  end = Math.max(start + movementMinimumRangeSpan, Math.min(movementCountryEnd, Math.round(end)));
  density = Math.round(Math.min(artistListDensityMaximum, Math.max(artistListDensityMinimum, density)) * 100) / 100;
  const countries = [...new Set((Array.isArray(value?.countries) ? value.countries : defaultArtistListView.countries).filter(id => allMovementCountryIds.includes(id)))];
  return {countries, start, end, density};
}
function parseArtistListView() {
  try { return normalizeArtistListView(JSON.parse(localStorage.getItem(artistListStorageKey) || JSON.stringify(defaultArtistListView))); }
  catch (_) { return normalizeArtistListView(defaultArtistListView); }
}
function persistArtistListView() { localStorage.setItem(artistListStorageKey, JSON.stringify(artistListView)); }
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
