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
const storageKey = 'art-atlas-artists-v1';
const movementStorageKey = 'art-atlas-movement-view-v1';
const movementCountryMigrationKey = 'art-atlas-movement-country-migration-v1';
const movementZoomCalibrationKey = 'art-atlas-movement-zoom-calibration-v2';
const detailImageHeightStorageKey = 'art-atlas-detail-image-height-v1';
const detailPanelWidthStorageKey = 'art-atlas-detail-panel-width-v1';
const lastPositionStorageKey = 'art-atlas-last-position-v1';
const favoriteWorksStorageKey = 'art-atlas-favorite-works-v1';
const accessSessionStorageKey = 'art-atlas-access-session-v1';
const uHangulModeStorageKey = 'ArtThroughTime.uHangulMode.v3';
const artistListEnglishStorageKey = 'ArtThroughTime.artistListEnglish.v1';
const artworkTitleModeStorageKey = 'ArtThroughTime.artworkTitleMode.v1';
// The app can be opened through the local server or directly as index.html.
// In the latter case, API calls must explicitly target the local server.
const apiUrl = endpoint => location.protocol === 'file:' ? `http://localhost:4173${endpoint}` : endpoint;
const startupParams = new URLSearchParams(location.search);
const movementAtlasStart = 1400;
const movementAtlasEnd = 2026;
const movementCountryEnd = 1950;
const movementVerticalZoomMax = 30;
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
const defaultMovementView = {countries:[...allMovementCountryIds],start:movementAtlasStart,end:movementAtlasEnd,showHistoricalEvents:true,verticalZoom:1};
let language = 'ko';
let uHangulMode = requestedUHangulMode === 'uhangul' || requestedUHangulMode === 'korean' ? requestedUHangulMode : (sessionStorage.getItem(uHangulModeStorageKey) === 'uhangul' ? 'uhangul' : 'korean');
let artistListEnglish = sessionStorage.getItem(artistListEnglishStorageKey) === 'true';
let artworkTitleMode = ['ko','en','original'].includes(sessionStorage.getItem(artworkTitleModeStorageKey)) ? sessionStorage.getItem(artworkTitleModeStorageKey) : 'ko';
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
if (localStorage.getItem(movementZoomCalibrationKey) !== 'v2') {
  movementView.verticalZoom = 1;
  localStorage.setItem(movementZoomCalibrationKey, 'v2');
}
let thumbnailObserver;
let thumbnailQueue = Promise.resolve();
const thumbnailRequests = new Set();
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
timeline.addEventListener('click', event => {
  const link = event.target.closest?.('.original-artist-name');
  if (!link || !timeline.contains(link)) return;
  event.preventDefault();
  const artist = artists.find(item => item.id === selectedId);
  if (artist) openArtistWikipedia(artist);
});

const copy = {
  ko: {collection:'나의 화가 목록',sort:'정렬',nameAsc:'이름순',birthAsc:'생년순',addArtist:'화가와 그림 일괄 추가',newRecord:'NEW RECORD',addTitle:'화가와 그림 일괄 추가',addHelp:'화가 설명 페이지나 그림 페이지의 웹주소를 입력해 저장하세요.',addArtwork:'그림 추가',addArtworkTitle:'그림 1점 추가',artworkPage:'작품 웹페이지 주소 또는 로컬 이미지 경로',artworkTitleInput:'작품 제목 (선택)',artworkYearInput:'제작 연도 (선택)',entryType:'추가할 항목',artist:'화가',painting:'그림 웹주소',webpage:'웹페이지 주소',name:'이름',birthYear:'Birth year (optional)',artistName:'화가 이름',madeYear:'제작 연도',save:'저장하기',timeline:'작품 연표',slideshow:'슬라이드 쇼',selectWork:'작품을 선택하면\n이곳에서 자세히 볼 수 있어요.',noWork:'아직 등록한 작품이 없습니다.',noImage:'이미지 없음',untitled:'제목 없는 작품',unknown:'정보 없음',country:'제작 국가',movement:'화파',year:'제작 연도',source:'저장된 출처',delete:'삭제',confirmDelete:'이 화가와 등록한 작품을 목록에서 삭제할까요?',confirmDeleteWork:'이 작품을 삭제할까요?',manualWorks:'직접 추가한 작품',movementAtlas:'미술 사조로 보기',countries:'비교할 나라',selectAllCountries:'전체 선택 / 해제',exportChanges:'변경사항_압축',migrationExport:'FIREBASE 내보내기',period:'기간',artistSpan:'선택 화가의 활동 기간',storedInfo:'저장된 작품 정보',loadingInfo:'작품 정보를 정리해 저장하는 중입니다.',noInfo:'저장된 설명이 아직 없습니다.',favorites:'MY FAVORITES',searchArtists:'화가 이름 검색',noSearchResult:'일치하는 화가가 없습니다.'},
  en: {collection:'MY ARTISTS',sort:'SORT',nameAsc:'Name',birthAsc:'Birth year',addArtist:'Add artist with artworks',newRecord:'NEW RECORD',addTitle:'Add artist with artworks',addHelp:'Paste a webpage about an artist or artwork to import source material.',addArtwork:'Add artwork',addArtworkTitle:'Add one artwork',artworkPage:'Artwork webpage URL or local image path',artworkTitleInput:'Artwork title (optional)',artworkYearInput:'Year made (optional)',entryType:'Add',artist:'Artist',painting:'Artwork webpage',webpage:'Webpage URL',name:'Name',birthYear:'Birth year (optional)',artistName:'Artist name',madeYear:'Year made',save:'Save',timeline:'WORKS TIMELINE',slideshow:'Slideshow',selectWork:'Select an artwork\nto view its details here.',noWork:'No artworks have been added yet.',noImage:'No image available',untitled:'Untitled',unknown:'Unknown',country:'Country made',movement:'Movement',year:'Year made',source:'Stored source',delete:'Delete this artist and their listed works?',confirmDeleteWork:'Delete this artwork?',manualWorks:'MANUALLY ADDED WORKS',movementAtlas:'Movement comparison',countries:'Countries',selectAllCountries:'Select / clear all',exportChanges:'EXPORT CHANGES',migrationExport:'EXPORT FOR FIREBASE',period:'Period',artistSpan:'Selected artist lifespan',storedInfo:'Stored artwork information',loadingInfo:'Preparing and saving artwork information.',noInfo:'No stored description yet.',favorites:'MY FAVORITES',searchArtists:'Search artists',noSearchResult:'No matching artists.'}
};
Object.assign(copy.ko, {
  artworkPage:'작품 웹페이지 주소',
  addFromWeb:'웹 주소로 추가',
  localArtwork:'로컬 이미지',
  chooseLocalImage:'파일 선택',
  localArtworkTitle:'작품 제목',
  localArtworkYear:'제작 연도 (예: 1500-1505)',
  addFromLocal:'연표에 추가'
});
Object.assign(copy.en, {
  artworkPage:'Artwork webpage URL',
  addFromWeb:'Add from webpage',
  localArtwork:'Local image',
  chooseLocalImage:'Choose image file',
  localArtworkTitle:'Artwork title',
  localArtworkYear:'Year made (for example, 1500-1505)',
  addFromLocal:'Add to timeline'
});
const t = (key) => copy[language][key] || key;
copy.ko.movementAtlas = '미술 사조의 이해';
copy.en.movementAtlas = 'Understanding Art Movements';
copy.ko.techniques = '미술 기법의 이해';
copy.en.techniques = 'Understanding Art Techniques';
const koreanLabelFallbacks = {'Italian Renaissance':'이탈리아 르네상스','High Renaissance':'전성기 르네상스','Mannerism':'매너리즘'};
const brokenLabel = value => /\?/.test(String(value || ''));
const loc = (value) => {
  if (typeof value !== 'object' || !value) return value;
  const preferred = value[language] || value.en || value.ko;
  if (language === 'ko' && brokenLabel(preferred) && value.en) return koreanLabelFallbacks[value.en] || value.en;
  return preferred;
};
const artworkTitleModeOrder = ['ko','en','original'];
const artworkTitleModeLabels = {ko:'KO',en:'EN',original:'OR'};
function artworkTitleValue(title, mode) {
  if (!title || typeof title !== 'object') return mode === 'ko' || mode === 'en' ? String(title || '').trim() : '';
  const original = title.original || title.native || title.originalTitle || title.nativeTitle || title.sourceTitle || '';
  const values = {ko:title.ko, en:title.en, original};
  return String(values[mode] || '').trim();
}
function artworkAvailableTitleModes(work) {
  return artworkTitleModeOrder.filter(mode => artworkTitleValue(work?.title, mode));
}
function artworkDisplayTitle(work, preferredMode=artworkTitleMode) {
  const modes = artworkAvailableTitleModes(work);
  if (!modes.length) return t('untitled');
  const start = artworkTitleModeOrder.indexOf(preferredMode);
  const ordered = start >= 0
    ? [...artworkTitleModeOrder.slice(start), ...artworkTitleModeOrder.slice(0,start)]
    : artworkTitleModeOrder;
  const mode = ordered.find(item => modes.includes(item)) || modes[0];
  return artworkTitleValue(work.title, mode) || t('untitled');
}
function artworkThumbnailTitle(work, artist) {
  let title = artworkDisplayTitle(work).replace(/\s+/g, ' ').trim();
  // Imported catalogue labels occasionally append a date, artist, collection,
  // or descriptive sentence after the actual artwork title.  Keep only the
  // title on thumbnails; the collection remains in its own metadata line.
  title = title
    .replace(/\s*\(\s*(?:c\.?\s*)?\d{3,4}[^)]*\)(?:\s*,.*)?$/i, '')
    .replace(/\s*,\s*(?:c\.?\s*)?\d{3,4}(?:\s*[–-]\s*\d{2,4})?(?:\s*,.*)?$/i, '')
    .replace(/\s*,\s*(?:private )?(?:museum|gallery|collection|museum collection|royal museums?).*$/i, '');
  const artistNames = [artist?.name?.ko, artist?.name?.en].filter(Boolean);
  for (const name of artistNames) {
    const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${escapedName}(?:\\s*,.*)?$`, 'i'), '');
  }
  return title.trim() || artworkDisplayTitle(work);
}
function availableArtworkTitleModesForWorks(works=[]) {
  return artworkTitleModeOrder.filter(mode => works.some(work => artworkTitleValue(work?.title, mode)));
}
function nextArtworkTitleMode(works=[]) {
  const available = availableArtworkTitleModesForWorks(works);
  if (!available.length) return 'ko';
  const current = available.includes(artworkTitleMode) ? artworkTitleMode : available[0];
  return available[(available.indexOf(current) + 1) % available.length];
}
function setArtworkTitleMode(mode) {
  artworkTitleMode = artworkTitleModeOrder.includes(mode) ? mode : 'ko';
  sessionStorage.setItem(artworkTitleModeStorageKey, artworkTitleMode);
}
function artworkTitleAliases(work) {
  const title = work?.title;
  if (!title) return [];
  if (typeof title !== 'object') return [String(title).trim()].filter(Boolean);
  return [...new Set(artworkTitleModeOrder.map(mode => artworkTitleValue(title, mode)).filter(Boolean))];
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
  'Crown of Castile': {ko:'스페인', en:'Spain',colorKey:'Spain'}, '카스티야 연합왕국': {ko:'스페인', en:'Spain',colorKey:'Spain'}
};
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
  return countryInfo(artist.birthCountry || artist.nationality);
}
function artistCountryLabel(artist) {
  return countryDisplayLabel(artist.birthCountry || artist.nationality);
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
  uHangulMode = mode === 'uhangul' ? 'uhangul' : 'korean';
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
  (works || []).forEach(work => {
    const key = selectionKey(work);
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
  Q43270: '브뤼헐, 피터르 대',
  Q213163: '비제 르 브룅, 엘리자베스 루이',
  Q82445: '툴루즈로트레크, 앙리 드',
  Q301: '엘 그레코',
  Q5592: '부오나로티, 미켈란젤로',
  Q5597: '산치오, 라파엘로',
  Q5598: '렘브란트 하르먼손 판 레인'
};
function artistDisplayName(artist) {
  if (language !== 'ko') return loc(artist?.name);
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
  return [artist?.name?.ko, artist?.name?.en, loc(artist?.name), artistDisplayName(artist), ...artistAliases(artist)].filter(Boolean).join(' ').toLocaleLowerCase();
}
function artistLinks(artist) {
  return Array.isArray(artist?.links) ? artist.links.filter(link => {
    try { return ['http:', 'https:'].includes(new URL(link.url || link).protocol); }
    catch (_) { return false; }
  }).map(link => typeof link === 'string' ? {url:link} : link) : [];
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
function readableNameFromPageUrl(pageUrl) {
  try {
    const parsed = new URL(pageUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
    return decodeURIComponent(lastSegment).replace(/_/g, ' ').replace(/\.[a-z0-9]{2,5}$/i, '').trim() || parsed.hostname;
  } catch (_) {
    return pageUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0] || pageUrl;
  }
}
function isNetworkImportError(error) {
  return /EACCES|ENOTFOUND|ECONNRESET|ETIMEDOUT|network|fetch|timeout|failed/i.test(error?.message || '');
}
function offlineArtistFromPageUrl(pageUrl) {
  const label = readableNameFromPageUrl(pageUrl);
  return {
    id:`artist-url-${Date.now()}`,
    name:{ko:label,en:label},
    birth:null,
    death:null,
    nationality:{ko:'',en:''},
    source:pageUrl,
    links:[{url:pageUrl,label:'source'}],
    works:[],
    generated:{schema:18,fetchedAt:new Date().toISOString(),source:pageUrl,importStatus:'offline-placeholder'}
  };
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
// Keep the card dimensions, but request a lightweight Wikimedia thumbnail.
function thumbnail(url, width = 240) {
  if (!url) return url;
  // Wikimedia gallery URLs may already be thumbnail URLs.
  if (url.includes('/thumb/')) return url;
  if (url.includes('commons.wikimedia.org/wiki/Special:FilePath/')) return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
  const match = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/(.+)\/([^/]+)$/);
  if (!match) return url;
  const [, repository, directories, fileName] = match;
  try { return `${repository}/thumb/${directories}/${fileName}/${width}px-${fileName}`; }
  catch (_) { return url; }
}
function isExternalImageSource(value) { return /^https?:\/\//i.test(String(value || '')); }
const offlineArtworkPlaceholder = 'data/thumbnails/_placeholder/artwork-placeholder.png';
function localArtworkImage(work) {
  const image = work?.thumbnail || '';
  if (!image || isExternalImageSource(image)) return offlineArtworkPlaceholder;
  if (image === offlineArtworkPlaceholder) return image;
  return work?.thumbnailCacheKey ? `${image}?v=${encodeURIComponent(work.thumbnailCacheKey)}` : image;
}
function artworkPreviewImage(work) {
  const image = localArtworkImage(work);
  return image === offlineArtworkPlaceholder ? '' : image;
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

function artistSnapshot() { return JSON.stringify({dataSchema:1,metadata:collectionMetadata,artists,deletedArtists:[],historicalEvents:customHistoricalEvents,favoriteWorks:[...favoriteWorkKeys].sort(),changeMeta:{actor:currentUserEmail,role:currentUserRole}}); }
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
  if (saved?.role === 'viewer') {
    enterViewerMode();
    return;
  }
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
  if (isMovementPopup) {
    enterViewerMode();
    return;
  }
  try {
    const response = await fetch(apiUrl('/api/access'), {cache:'no-store'});
    const access = response.ok ? await response.json() : null;
    if (access?.adminConfigured === false) {
      enterViewerMode();
      return;
    }
  } catch (_) {
    /* When the local server is unavailable, keep the manual viewer choice. */
  }
  return new Promise(resolve => {
    const email = $('#auth-email');
    const password = $('#auth-password');
    const message = $('#auth-message');
    const showMessage = text => { message.textContent = text; message.classList.remove('hidden'); };
    const finishAsViewer = () => {
      enterViewerMode();
      authDialog.close();
      resolve();
    };
    $('#auth-skip').onclick = finishAsViewer;
    $('#auth-form').onsubmit = async event => {
      event.preventDefault();
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
  if (!artist?.works?.some(work => /^wikidata-Q\d+$/.test(work.id || ''))) return;
  try {
    const response = await apiFetch('/api/normalize-artist-works', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artist})});
    const result = await response.json();
    if (response.ok && result.artist) Object.assign(artist, result.artist);
  } catch (_) { /* Preserve the imported record when the official source is temporarily unavailable. */ }
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
  artists = fileData.artists || [];
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
  requestAnimationFrame(() => centerSelectedArtistInList());
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
  const counts = new Map();
  (artist.works || []).forEach(work => { const movement = artworkMovement(work,artist); if (movement) counts.set(movement, (counts.get(movement) || 0) + 1); });
  return [...counts.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] || artworkMovement(null,artist) || '';
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
    'highrenaissance':'Renaissance',
    'rococopainting':'Rococo'
  };
  const alias = aliases[compact];
  return alias && movementDocuments?.[alias]?.['1'] ? alias : '';
}
function normalizeMovementView(value) {
  const verticalZoom = Number(value?.verticalZoom);
  const normalizedVerticalZoom = Number.isFinite(verticalZoom)
    ? Math.min(movementVerticalZoomMax, Math.max(1, verticalZoom))
    : 1;
  return {
    // An empty array is a valid "clear all" choice; only a missing or malformed value uses the default.
    countries: Array.isArray(value?.countries) ? value.countries : [...defaultMovementView.countries],
    start: movementAtlasStart,
    end: movementAtlasEnd,
    showHistoricalEvents: value?.showHistoricalEvents !== false,
    verticalZoom: normalizedVerticalZoom
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
  const artistListEnglishButton = $('#artist-list-en-button');
  if (artistListEnglishButton) {
    artistListEnglishButton.classList.toggle('active', artistListEnglish);
    artistListEnglishButton.setAttribute('aria-pressed', String(artistListEnglish));
  }
  window.dispatchEvent(new CustomEvent('uhangulmodechange', {detail:{mode:uHangulMode}}));
  const migrationExportButton = $('#migration-export-button');
  migrationExportButton.classList.toggle('hidden', !currentUserIsAdmin);
  migrationExportButton.textContent = t('migrationExport');
  $('#add-button').classList.toggle('hidden', !currentUserIsAdmin);
  $('#movement-atlas-button').classList.toggle('active', viewMode === 'movements');
}
function renderList() {
  const sort = $('#sort').value;
  const query = artistSearchQuery.toLocaleLowerCase();
  const compactQuery = normalized(artistSearchQuery);
  const ordered = [...artists].filter(a => {
    if (!query) return true;
    const searchText = artistSearchText(a);
    return searchText.includes(query) || (compactQuery && normalized(searchText).includes(compactQuery));
  }).sort((a,b) => sort === 'birth' ? (a.birth || 9999) - (b.birth || 9999) : artistDisplayName(a).localeCompare(artistDisplayName(b), language));
  list.innerHTML = ordered.length ? ordered.map(a => {
    const country = artistCountryInfo(a), countryLabel = artistCountryLabel(a), movement = primaryMovement(a);
    const displayName = artistListEnglish ? (a.name?.en || artistDisplayName(a)) : artistDisplayName(a);
    const nameAttributes = artistListEnglish ? ' data-uh-ignore="true"' : uHangulArtistAttributes(a, displayName);
    const historicalCountry = country.original !== country.name;
    return `<div class="artist-row ${a.id === selectedId ? 'active':''}"><button class="artist-item" data-id="${esc(a.id)}"><span class="avatar ${historicalCountry ? 'historical-country' : ''}" style="background:${countryColor(country.colorKey)};color:${countryInk(country.colorKey)}" title="${esc(countryLabel)}" aria-label="${esc(countryLabel)}">${esc(countryAvatarText(country))}</span><span class="artist-text"><span class="artist-name"${nameAttributes}>${esc(displayName)}</span><span class="artist-years">${years(a)}${movement ? ` · ${esc(movement)}` : ''}</span></span></button>${currentUserIsAdmin ? `<button class="delete-artist" data-id="${esc(a.id)}" aria-label="${t('delete')}">×</button>` : ''}</div>`;
  }).join('') : `<p class="artist-search-empty">${t('noSearchResult')}</p>`;
  list.querySelectorAll('.artist-item').forEach(button => button.onclick = async () => { viewMode = 'timeline'; selectedId = button.dataset.id; persist(); closeDetail(); const artist = artists.find(item => item.id === selectedId); await hydrateThumbnails(artist); renderList(); requestAnimationFrame(() => centerSelectedArtistInList('smooth')); renderTimeline(); await enrichArtist(); });
  list.querySelectorAll('.delete-artist').forEach(button => button.onclick = async () => { if (!currentUserIsAdmin || !confirm(t('confirmDelete'))) return; const deleted = artists.find(artist => artist.id === button.dataset.id); artists = artists.filter(artist => artist.id !== button.dataset.id); if (selectedId === button.dataset.id) selectedId = artists[0]?.id || null; persist(); if (!await saveArtistsNow()) { artists.push(deleted); if (!selectedId) selectedId = deleted.id; alert(language === 'ko' ? '삭제 내용을 저장하지 못해 복원했습니다.' : 'The deletion could not be saved, so it was restored.'); } render(); });
  $('#artist-names').innerHTML = artists.flatMap(a => [artistDisplayName(a), a.name?.ko, a.name?.en, ...artistAliases(a)]).filter(Boolean).filter((value,index,self) => self.indexOf(value) === index).map(value => `<option value="${esc(value)}"></option>`).join('');
}
function centerSelectedArtistInList(behavior='auto') {
  if (!selectedId || list.clientHeight <= 0 || list.scrollHeight <= list.clientHeight) return;
  const selectedButton = [...list.querySelectorAll('.artist-item')].find(button => button.dataset.id === selectedId);
  const selectedRow = selectedButton?.closest('.artist-row') || selectedButton;
  if (!selectedRow) return;
  const listBounds = list.getBoundingClientRect();
  const rowBounds = selectedRow.getBoundingClientRect();
  const idealTop = list.scrollTop + rowBounds.top - listBounds.top + rowBounds.height / 2 - list.clientHeight / 2;
  const maxTop = list.scrollHeight - list.clientHeight;
  list.scrollTo({top:Math.max(0, Math.min(maxTop, idealTop)), behavior});
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
  // Once the administrator has selected works, an empty list deliberately
  // means no highlights.  Until then, use the curator's initial five works.
  const leonardoFeaturedWorkIds = new Set(Array.isArray(artist.featuredWorkIds)
    ? artist.featuredWorkIds.map(String)
    : (defaultFeaturedWorks.length ? defaultFeaturedWorks : works.slice(0, 5)).map(work => String(work.id || '')));
  const leonardoFeaturedWorks = isLeonardoTimeline
    ? works.filter(work => leonardoFeaturedWorkIds.has(String(work.id || '')))
    : [];
  const leonardoLayoutKey = `art-atlas-timeline-layout-${artist.qid || artist.id}`;
  const leonardoLayout = isLeonardoTimeline && sessionStorage.getItem(leonardoLayoutKey) === 'chronology'
    ? 'chronology'
    : 'gallery';
  const availableTitleModes = availableArtworkTitleModesForWorks(works);
  if (availableTitleModes.length && !availableTitleModes.includes(artworkTitleMode)) setArtworkTitleMode(availableTitleModes[0]);
  const worksByYear = new Map();
  // A timeline row represents the year a work began.  Date ranges that share
  // the same start year therefore stay together on one horizontal row.
  works.forEach(work => { const year = work?.year || '—'; worksByYear.set(year, [...(worksByYear.get(year) || []), work]); });
  const addArtworkLinkLabel = language === 'ko' ? '해설 주소 추가' : 'Add explanation link';
  const artworkLinkInputLabel = language === 'ko' ? '유튜브 또는 해설 웹페이지 주소를 입력하세요' : 'Enter a YouTube or explanation webpage address';
  const confirmArtworkLinkLabel = language === 'ko' ? '확인' : 'Add';
  const card = w => {
    const image = artworkPreviewImage(w);
    const movementContribution = Boolean(w.movementContribution);
    const highRes = Boolean(w.highResImage);
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
    const fallbackImage = image && w.image && image !== thumbnail(w.image) ? thumbnail(w.image) : '';
    const highResBadge = highRes ? `<span class="high-resolution-badge hidden" data-highres-src="${esc(w.highResImage)}" title="${esc(language === 'ko' ? '고해상도 파일 확인 중' : 'Checking high-resolution file')}">Ⓗ</span>` : '';
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
    return `<div class="art-card${movementContribution ? ' movement-contribution-artwork' : ''}" data-work="${esc(w.id)}" data-preview-artist="${esc(previewArtist)}" data-preview-title="${esc(workTitle)}" data-preview-year="${esc(previewYear)}" data-preview-collection="${collection && collection !== t('unknown') ? esc(collection) : ''}" title="${movementContribution ? esc(contributionLabel) : ''}"><span class="art-thumb">${featuredToggle}${image ? `<img src="${esc(image)}" alt="${esc(workTitle)}" loading="lazy"${fallbackImage ? ` data-fallback-src="${esc(fallbackImage)}"` : ''} />` : `<span class="art-thumb-empty">${esc(t('noImage'))}</span>`}${previewButton}${controls}</span><span class="art-meta">${titleMarkup}${footerMarkup}</span></div>`;
  };
  const koreanName = artist.name?.ko || '', originalName = artist.name?.en || '';
  const savedLinks = artistLinks(artist);
  const addLinkLabel = language === 'ko' ? '주소 추가' : 'Add address';
  const linkInputLabel = language === 'ko' ? '열 주소를 입력하세요' : 'Enter an address to open';
  const confirmLinkLabel = language === 'ko' ? '확인' : 'Add';
  const linkButtons = savedLinks.map((link, index) => `<button class="artist-link-button${isYouTubeLink(link) ? ' artist-link-youtube' : ''}" type="button" data-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index + 1}. ${link.url}`)}">${index + 1}</button>`).join('');
  const linkControls = `<span class="artist-link-controls">${currentUserIsAdmin ? `<button class="artist-link-add" type="button" title="${esc(addLinkLabel)}" aria-label="${esc(addLinkLabel)}">+</button>` : ''}${linkButtons}</span>`;
  const nationalityLabel = loc(artist.nationality) ? countryDisplayLabel(artist.nationality) : '';
  const artistMovement = primaryMovement(artist);
  const artistMovementDocument = movementDocumentKey(artistMovement);
  const artistMovementLabel = artistMovementDocument
    ? `<button class="artist-movement-link" type="button" data-movement-document="${esc(artistMovementDocument)}">${esc(artistMovement)}</button>`
    : `<span class="artist-movement-label">${esc(artistMovement)}</span>`;
  const timelineArtistName = artistDisplayName(artist);
  const timelineArtistNameMarkup = `<span class="timeline-artist-name"${uHangulArtistAttributes(artist, timelineArtistName)}>${esc(timelineArtistName)}</span>`;
  const displayName = language === 'ko' && koreanName
    ? `${timelineArtistNameMarkup}${originalName && originalName !== koreanName ? ` <a class="original-artist-name" data-uh-ignore="true" href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(originalName)}" data-artist-wiki="${esc(artist.qid || '')}">${esc(originalName)}</a>` : ''}${linkControls}`
    : `${esc(loc(artist.name))}${linkControls}`;
  const slideshowHelp = language === 'ko' ? '전체 화면 슬라이드 쇼 시작 · 5초마다 다음 작품' : 'Start fullscreen slideshow · next artwork every 5 seconds';
  const titleModeButton = availableTitleModes.length > 1 ? `<button class="artwork-title-mode-button" type="button" title="${esc(language === 'ko' ? '작품 제목 표기 전환' : 'Switch artwork title language')}" aria-label="${esc(language === 'ko' ? '작품 제목 표기 전환' : 'Switch artwork title language')}">${esc(artworkTitleModeLabels[nextArtworkTitleMode(works)] || 'EN')}</button>` : '';
  const headerActions = titleModeButton;
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
    const featured = leonardoFeaturedWorks.length ? `<section class="leonardo-featured"><div class="leonardo-section-heading"><p class="eyebrow">${esc(featuredLabel)}</p><div class="leonardo-section-actions">${slideshowButton('featured', language === 'ko' ? '대표작 슬라이드 쇼 시작' : 'Start highlights slideshow')}</div><p>${esc(language === 'ko' ? '우선 크게 살펴볼 작품입니다. Ⓗ 표시는 고해상도 파일이 있음을 뜻하며, 이미지를 더블클릭하면 새 창에서 엽니다.' : 'A small set of works to study first. Ⓗ marks an available high-resolution file; double-click the image to open it.')}</p></div><div class="leonardo-featured-grid">${leonardoFeaturedWorks.map(work => `<div class="leonardo-featured-card">${card(work)}</div>`).join('')}</div></section>` : '';
    const allWorksAction = `${slideshowButton('all', language === 'ko' ? '전체 작품 슬라이드 쇼 시작' : 'Start all-works slideshow')}${currentUserIsAdmin ? `<button class="add-artwork-button leonardo-section-add-artwork" type="button" title="${esc(t('addArtwork'))}" aria-label="${esc(t('addArtwork'))}"><span>+</span><span>${esc(t('addArtwork'))}</span></button>` : ''}`;
    return `<div class="leonardo-timeline">${featured}${layoutControls}<section class="leonardo-all-works"><div class="leonardo-section-heading"><p class="eyebrow">${esc(leonardoLayout === 'gallery' ? galleryLabel : chronologyLabel)}</p><div class="leonardo-section-actions">${allWorksAction}</div><p>${esc(language === 'ko' ? `${works.length}점 · 왼쪽 위에서 오른쪽 아래로 갈수록 뒤의 작품입니다.` : `${works.length} works · Earlier works begin at the upper left.`)}</p></div>${leonardoLayout === 'gallery' ? gallery : chronology}</section></div>`;
  })();
  timeline.innerHTML = `${timelineHeader}${leonardoTimelineMarkup}`;
  timeline.querySelector('.add-artwork-button')?.addEventListener('click', () => openAddArtworkDialog(artist));
  timeline.querySelector('.artwork-title-mode-button')?.addEventListener('click', () => {
    setArtworkTitleMode(nextArtworkTitleMode(works));
    renderTimeline();
  });
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
      const selected = new Set(Array.isArray(previousSelection) ? previousSelection.map(String) : leonardoDefaultFeaturedWorkIds);
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
  timeline.querySelector('.artist-movement-link')?.addEventListener('click', () => openMovementDocumentInDetail(artistMovementDocument, artistMovement));
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
    if (!work?.highResImage || !image) return;
    highResolutionImageWidth(work.highResImage).then(width => {
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
        openArtworkImageWindow(work.highResImage, artworkDisplayTitle(work), {artist:artistDisplayName(artist), title:artworkDisplayTitle(work), year:workYearLabel(work)});
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
function atlasYearScale() {
  const groups = atlasEventGroups(movementAtlasStart, movementAtlasEnd);
  let scale = 2.45;
  groups.forEach(([year, events], index) => {
    if (!index) return;
    const [previousYear, previousEvents] = groups[index - 1];
    const gap = year - previousYear;
    const needed = ((events.length * 18 + previousEvents.length * 18) / 2 + 8) / gap;
    scale = Math.max(scale, needed);
  });
  return Math.ceil(scale * 10) / 10;
}
function atlasFitYearScale() {
  // At 100%, the full 1400–1950 country comparison fits in the visible chart area.
  const scrollHeight = window.innerWidth <= 590
    ? window.innerHeight * .72
    : window.innerHeight - 255;
  const availableBarsHeight = Math.max(220, scrollHeight - 48);
  return availableBarsHeight / (movementCountryEnd - movementAtlasStart);
}
function renderAtlasEvents(start, end, height, yearScale) {
  const groups = atlasEventGroups(start, end);
  return `<aside class="atlas-events" style="height:${height + 40}px">${groups.map(([year, events]) => { const top = Math.max(0, year - start) * yearScale; return `<div class="atlas-event-group ${events.length > 1 ? 'same-year' : ''}" style="top:${top}px"><div class="atlas-event-labels">${events.map(event => { const endYear = Math.min(end, event.end || event.start), duration = event.end && event.end > event.start ? `<span class="atlas-event-duration" style="height:${Math.max(6, (endYear - event.start) * yearScale)}px"></span>` : ''; const years = event.end && event.end > event.start ? `${event.start}–${event.end}` : event.start; const impact = loc(event.impact) || ''; return `<button class="atlas-event-label" type="button" data-event-wiki="${esc(event.wiki || event.name?.en || event.name?.ko || '')}" title="${esc(impact)}">${esc(loc(event.name))} (${years})${duration}</button>`; }).join('')}</div>${events.length > 1 ? '<span class="atlas-event-bracket"></span>' : ''}<span class="atlas-event-link"></span></div>`; }).join('')}</aside>`;
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
  const start = movementAtlasStart;
  const end = movementAtlasEnd;
  const countryEnd = movementCountryEnd;
  const countryOptions = movementCountries
    .filter(country => country.id !== sharedMovementId)
    .sort((a, b) => loc(a.name).localeCompare(loc(b.name), language));
  const countryById = new Map(countryOptions.map(country => [country.id, country]));
  const countries = movementView.countries.map(id => countryById.get(id)).filter(Boolean);
  const shared = movementCountries.find(country => country.id === sharedMovementId);
  const showHistoricalEvents = movementView.showHistoricalEvents !== false;
  // Keep the chart compact where possible, but reserve enough vertical space
  // for neighbouring historical-event labels so they never cover each other.
  const baseYearScale = atlasFitYearScale();
  const eventSafeZoom = Math.max(1, atlasYearScale() / baseYearScale);
  const maximumVerticalZoom = Math.min(movementVerticalZoomMax, eventSafeZoom);
  if (movementView.verticalZoom > maximumVerticalZoom) {
    movementView.verticalZoom = maximumVerticalZoom;
    persistMovementView();
  }
  const yearScale = baseYearScale * movementView.verticalZoom;
  const height = (countryEnd - start) * yearScale;
  const pack = movements => {
    const ends = [];
    return [...movements].sort((a,b) => a.start - b.start).map(movement => { let lane = ends.findIndex(laneEnd => laneEnd < movement.start); if (lane < 0) lane = ends.length; ends[lane] = movement.end; return {...movement,lane}; });
  };
  const yearLabel = year => Number(year) < 0 ? `${Math.abs(year)} BCE` : String(year);
  const axis = (axisStart, axisEnd, axisHeight, step = 20) => {
    const ticks = []; for (let year = Math.ceil(axisStart / step) * step; year <= axisEnd; year += step) ticks.push(year);
    return `<aside class="atlas-axis" style="height:${axisHeight + 40}px"><span class="atlas-axis-line"></span>${ticks.map(year => `<span class="atlas-tick" style="top:${(year-axisStart)*yearScale}px">${yearLabel(year)}</span>`).join('')}</aside>`;
  };
  const bar = (item, axisStart, axisEnd) => { const top=Math.max(0,item.start-axisStart)*yearScale, barHeight=Math.max(46,(Math.min(axisEnd,item.end)-Math.max(axisStart,item.start))*yearScale), left=8 + item.lane * 106, years=`${yearLabel(item.start)}–${yearLabel(item.end)}`, movementName=item.name.en || item.name.ko || ''; return `<div class="movement-bar" title="${esc(loc(item.name))} · ${years}" style="top:${top}px;height:${barHeight}px;left:${left}px;width:100px;--movement-color:${esc(item.color)}"><div class="movement-bar-links"><button class="movement-link movement-explanation-link" type="button" data-movement-explanation="${esc(movementName)}" data-movement-label="${esc(loc(item.name))}" aria-label="${esc(loc(item.name))} ${language === 'ko' ? '정리 설명' : 'explanation'}" title="${language === 'ko' ? '정리 설명 열기' : 'Open explanation'}">①</button></div><span>${esc(loc(item.name))}</span><small>${years}</small></div>`; };
  const widthFor = country => { const lanes = Math.max(1, ...pack(country.movements.filter(item => item.end >= start && item.start <= countryEnd)).map(item => item.lane + 1)); return lanes * 106 + 16; };
  const chartColumns = `${showHistoricalEvents ? '250px ' : ''}74px ${countries.map(country => `${widthFor(country)}px`).join(' ')}`;
  const column = country => {
    const entries = pack(country.movements.filter(item => item.end >= start && item.start <= countryEnd));
    const lanes = Math.max(1, ...entries.map(item => item.lane + 1));
    return `<section class="atlas-country" data-country-id="${esc(country.id)}" style="min-width:${lanes * 106 + 16}px"><h2 class="atlas-country-heading" data-country-id="${esc(country.id)}">${esc(loc(country.name))}</h2><div class="atlas-bars" style="height:${height}px">${entries.map(item => bar(item, start, countryEnd)).join('')}</div></section>`;
  };
  const sharedItems = shared?.movements?.length ? shared.movements.filter(item => item.end >= 1950 && item.start <= end) : [];
  const sharedStart = 1950;
  const sharedEnd = end;
  const sharedHeight = Math.max(260, (sharedEnd - sharedStart) * yearScale);
  const sharedEntries = pack(sharedItems);
  const sharedLanes = Math.max(1, ...sharedEntries.map(item => item.lane + 1));
  const sharedBox = sharedEntries.length ? `<div class="atlas-shared-chart" style="grid-template-columns:${showHistoricalEvents ? '250px ' : ''}74px ${sharedLanes * 106 + 16}px">${showHistoricalEvents ? renderAtlasEvents(sharedStart, sharedEnd, sharedHeight, yearScale) : ''}${axis(sharedStart, sharedEnd, sharedHeight, 10)}<section class="atlas-country atlas-shared-country" style="min-width:${sharedLanes * 106 + 16}px"><div class="atlas-bars" style="height:${sharedHeight}px">${sharedEntries.map(item => bar(item, sharedStart, sharedEnd)).join('')}</div></section></div>` : '';
  const editEventsLabel = language === 'ko' ? '역사 사건 추가' : 'Add historical event';
  const eventEditorButton = `<button class="atlas-event-editor" type="button">${editEventsLabel}</button>`;
  const toggleEventsLabel = showHistoricalEvents ? (language === 'ko' ? '역사 사건 숨기기' : 'Hide historical events') : (language === 'ko' ? '역사 사건 보기' : 'Show historical events');
  const allCountriesSelected = countryOptions.length > 0 && countryOptions.every(country => movementView.countries.includes(country.id));
  const artistListLabel = language === 'ko' ? '화가 목록' : 'Artist list';
  const techniquesLabel = language === 'ko' ? '기법' : 'Techniques';
  const topicsLabel = language === 'ko' ? '주제 - 사조' : 'Topics - movements';
  timeline.innerHTML = `<div class="timeline-title-row movement-title-row"><h1 class="timeline-title">${t('movementAtlas')}</h1><div class="timeline-title-actions movement-title-actions"><button class="atlas-nav-button movement-nav-artists" type="button">${artistListLabel}</button><button class="atlas-nav-button movement-nav-techniques" type="button">${techniquesLabel}</button><button class="atlas-nav-button movement-nav-topics" type="button">${topicsLabel}</button></div></div><div class="atlas-controls"><fieldset><legend>${t('countries')}</legend><div class="atlas-country-options"><div class="atlas-country-option atlas-country-option-all"><label><input class="atlas-country-select-all" type="checkbox" ${allCountriesSelected ? 'checked' : ''}>${t('selectAllCountries')}</label></div>${countryOptions.map(country => `<div class="atlas-country-option"><label><input type="checkbox" value="${esc(country.id)}" ${movementView.countries.includes(country.id) ? 'checked' : ''}>${esc(loc(country.name))}</label></div>`).join('')}</div></fieldset><button class="atlas-event-toggle" type="button">${toggleEventsLabel}</button>${eventEditorButton}<span class="atlas-range">${yearLabel(start)}–${yearLabel(countryEnd)} / ${yearLabel(sharedStart)}–${yearLabel(end)}</span></div><div class="atlas-scroll">${countries.length ? `<div class="atlas-chart" style="grid-template-columns:${chartColumns}">${showHistoricalEvents ? renderAtlasEvents(start, countryEnd, height, yearScale) : ''}${axis(start, countryEnd, height)}${countries.map(column).join('')}</div>` : `<p class="empty-timeline">${language === 'ko' ? '비교할 나라를 하나 이상 선택해 주세요.' : 'Select at least one country to compare.'}</p>`}${sharedBox ? `<div class="atlas-shared-divider"></div>${sharedBox}` : ''}</div>`;
  timeline.querySelector('.movement-nav-artists')?.addEventListener('click', openArtistListPage);
  timeline.querySelector('.movement-nav-techniques')?.addEventListener('click', openTechniquesPage);
  timeline.querySelector('.movement-nav-topics')?.addEventListener('click', openTopicsPage);
  const selectAll = timeline.querySelector('.atlas-country-select-all');
  selectAll.indeterminate = !allCountriesSelected && movementView.countries.some(id => countryOptions.some(country => country.id === id));
  selectAll.onchange = () => { movementView.countries = selectAll.checked ? countryOptions.map(country => country.id) : []; persistMovementView(); renderMovementAtlas(); };
  timeline.querySelectorAll('.atlas-country-options input:not(.atlas-country-select-all)').forEach(input => input.onchange = () => { movementView.countries = input.checked ? [...movementView.countries, input.value] : movementView.countries.filter(id => id !== input.value); persistMovementView(); renderMovementAtlas(); });
  timeline.querySelectorAll('.atlas-country-heading').forEach(heading => {
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
  atlasScroll.addEventListener('wheel', event => {
    if (!event.target.closest('.atlas-country')) return;
    event.preventDefault();
    const nextZoom = Math.min(maximumVerticalZoom, Math.max(1, movementView.verticalZoom * (event.deltaY < 0 ? 1.18 : 1 / 1.18)));
    if (nextZoom === movementView.verticalZoom) return;
    const scrollTop = atlasScroll.scrollTop;
    const cursorOffset = event.clientY - atlasScroll.getBoundingClientRect().top;
    const zoomRatio = nextZoom / movementView.verticalZoom;
    movementView.verticalZoom = nextZoom;
    persistMovementView();
    renderMovementAtlas();
    timeline.querySelector('.atlas-scroll').scrollTop = Math.max(0, (scrollTop + cursorOffset) * zoomRatio - cursorOffset);
  }, {passive:false});
  timeline.querySelectorAll('.movement-explanation-link').forEach(button => {
    button.onclick = event => { event.stopPropagation(); openMovementDocument(button.dataset.movementExplanation, '1', button.dataset.movementLabel); };
    button.oncontextmenu = event => {
      if (!currentUserIsAdmin) return;
      showMovementDocumentMenu(event, button.dataset.movementExplanation, '1', button.dataset.movementLabel);
    };
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
  movementView.countries = movementCountries.length ? movementCountries.filter(country => country.id !== sharedMovementId).map(country => country.id) : [...allMovementCountryIds];
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
  const image = work.highResImage || slideshowImage(work);
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
  detail.innerHTML = `<div class="detail-panel-resize" role="separator" aria-orientation="vertical" aria-label="${language === 'ko' ? '설명 창 너비 조절' : 'Resize detail panel'}"></div><button class="close-detail" type="button" aria-label="닫기">×</button>${image ? `<div class="detail-image-wrap" title="${esc(imageWindowHint)}"><img class="detail-image" src="${esc(image)}" alt="${esc(loc(work.title))}"></div><div class="detail-image-resize" role="separator" aria-orientation="horizontal" aria-label="${language === 'ko' ? '그림 창 높이 조절' : 'Resize image height'}"></div><div class="detail-image-actions">${currentUserIsAdmin ? `<button class="edit-artwork" type="button" title="${esc(editLabel)}" aria-label="${esc(editLabel)}">✎</button>` : ''}</div>` : `<div class="detail-image-unavailable">${esc(t('noImage'))}</div>`}${artworkTitle}${artworkLinkEntry}<dl class="detail-facts">${artworkFacts(work,artist).map(([label,value]) => `<div><dt>${esc(label)}</dt><dd${label===t('artist') ? uHangulArtistAttributes(artist,value) : ''}>${esc(value)}</dd></div>`).join('')}</dl><div class="detail-content">${body}</div><div class="detail-editor hidden"><textarea aria-label="${esc(editLabel)}">${esc(editedText)}</textarea><div><button class="cancel-artwork-edit" type="button">${esc(cancelLabel)}</button><button class="save-artwork-edit" type="button">${esc(polishSaveLabel)}</button></div></div><p class="source">${esc(savedNote)}</p>`;
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
  const favorites = selectedFavoriteWorks().map(({artist, work}) => ({
    artist: loc(artist.name), title: loc(work.title) || t('untitled'), year: workYearLabel(work) || t('unknown'),
    image: work.highResImage || slideshowImage(work),
    fileName: (work.highResImage || slideshowImage(work) || '').split('/').pop().split('?')[0]
  })).filter(item => item.image);
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
    runtimeStyle.dataset.uhangulIntegration = 'v0.5.4';
    const runtimeScript = popup.document.createElement('script');
    runtimeScript.defer = true;
    runtimeScript.src = new URL('uhangul/uhangul-runtime.js', location.href).href;
    runtimeScript.dataset.uhangulIntegration = 'v0.5.4';
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
  const local = localArtworkImage(work);
  return local === offlineArtworkPlaceholder ? '' : local;
}
function renderSlideshowSlide() {
  const work = slideshowWorks[slideshowIndex];
  if (!work) return closeSlideshow();
  const image = slideshowImage(work);
  slideshowStage.innerHTML = image ? `<img src="${esc(image)}" alt="${esc(loc(work.title))}">` : `<div class="slideshow-empty">${language === 'ko' ? '이미지를 준비하지 못했습니다.' : 'Image unavailable.'}</div>`;
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
  const popupWidth = Math.min(1000, window.screen.availWidth - 60);
  const popupHeight = Math.min(900, window.screen.availHeight - 100);
  const popupLeft = Math.max(30, window.screen.availWidth - popupWidth - 30);
  return window.open(url, 'artAtlasMovementExplanation', `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=50`);
}
function openExplanationUrl(url, popup=null, movementName='', movementLabel='') {
  const target = new URL(uHangulModeUrl(url));
  target.searchParams.set('documentVersion', 'uhangul-toolbar-v3');
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
async function openMovementDocumentInDetail(name, label) {
  const url = movementDocuments?.[name]?.['1'];
  if (!url) return;
  const loadingLabel = language === 'ko' ? '설명 페이지를 준비하는 중입니다.' : 'Preparing the explanation page.';
  detail.classList.add('show');
  $('.main-area').classList.add('detail-open');
  detail.innerHTML = `<div class="detail-panel-resize" role="separator" aria-orientation="vertical" aria-label="${language === 'ko' ? '설명 창 너비 조절' : 'Resize detail panel'}"></div><button class="close-detail" type="button" aria-label="${language === 'ko' ? '닫기' : 'Close'}">×</button><section class="movement-document-detail"><h2>${esc(label || name)}</h2><div class="movement-document-mode" role="group" aria-label="이름 표기 방식"><button type="button" data-movement-document-mode="korean" class="active" aria-pressed="true">한국어</button><button type="button" data-movement-document-mode="uhangul" aria-pressed="false">uHangul</button></div><p class="movement-document-loading">${esc(loadingLabel)}</p><iframe class="movement-document-frame" title="${esc(label || name)}" sandbox="allow-same-origin allow-scripts allow-popups"></iframe></section>`;
  detail.querySelector('.close-detail').onclick = closeDetail;
  setupDetailPanelResize();
  const frame = detail.querySelector('.movement-document-frame');
  const loading = detail.querySelector('.movement-document-loading');
  frame.addEventListener('load', () => loading.remove(), {once:true});
  let documentUrl;
  try { documentUrl = await refreshMovementDocument(name, '1'); }
  catch (_) { documentUrl = url; }
  const setDocumentMode = mode => {
    detail.querySelectorAll('[data-movement-document-mode]').forEach(button => {
      const active = button.dataset.movementDocumentMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    frame.src = uHangulModeUrl(documentUrl, mode);
  };
  detail.querySelectorAll('[data-movement-document-mode]').forEach(button => button.onclick = () => setDocumentMode(button.dataset.movementDocumentMode));
  setDocumentMode('korean');
}
async function openMovementDocument(name, slot, label) {
  const url = movementDocuments?.[name]?.[slot];
  if (url) {
    const popup = movementExplanationWindow();
    writeMovementDocumentLoading(popup, label || name);
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
function closeDetail() { detail.classList.remove('show'); $('.main-area').classList.remove('detail-open'); detail.innerHTML = placeholder(); setupDetailPanelResize(); }
function render() { renderText(); renderList(); if (viewMode === 'movements') renderMovementAtlas(); else renderTimeline(); closeDetail(); }

async function refreshThumbnail(artist, work) {
  try { const response = await apiFetch('/api/thumbnail', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artist,work})}); const result = await response.json(); if (!result.thumbnail) return false; work.thumbnail = result.thumbnail; work.thumbnailValidation = 2; persist(); return true; } catch (_) { return false; }
}
function queueOfflineThumbnail(artist, work, onSaved) {
  if (!artist || !work || (work.thumbnail && work.thumbnailValidation === 2)) return;
  const key = `${artist.id}:${work.id}`;
  if (thumbnailRequests.has(key)) return;
  thumbnailRequests.add(key);
  thumbnailQueue = thumbnailQueue.then(async () => {
    if (work.thumbnail && work.thumbnailValidation === 2) return;
    const saved = await refreshThumbnail(artist, work);
    if (saved) onSaved?.(artist, work);
  });
}
async function cacheThumbnailFromInput(artist, work, source) {
  const response=await apiFetch('/api/thumbnail-from-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artist,work,pageUrl:source})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || !result.thumbnail) throw new Error(result.error || 'Could not import the image');
  return result.thumbnail;
}
async function importThumbnailFromPage(artist, work, pageUrl) {
  try { work.thumbnail=await cacheThumbnailFromInput(artist,work,pageUrl); work.thumbnailValidation=2; persist(); await saveArtistsNow(); return true; } catch (_) { return false; }
}
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
      } else if (work.image && !localArtworkImage(work)) {
        work.thumbnail = thumbnail(work.image);
      }
    });
    persist();
  } catch (_) { /* No local thumbnail index exists for this artist yet. */ }
}
async function runThumbnailAgent() {
  if (!currentUserIsAdmin) return;
  const artist = artists.find(item => item.id === selectedId);
  if (!artist) return;
  if (thumbnailObserver) thumbnailObserver.disconnect();
  const queueWork = work => queueOfflineThumbnail(artist, work, savedArtist => {
    if (selectedId === savedArtist.id) renderTimeline();
  });
  // Secure the movement-contribution images first; these are the works that
  // best express the artist's known movement in the timeline.
  const contributionKeys = new Set(movementContributionWorksForArtist(artist).map(selectionKey));
  movementContributionWorksForArtist(artist).forEach(queueWork);
  (artist.works || []).filter(work => !contributionKeys.has(selectionKey(work))).forEach(queueWork);
  const cards = [...timeline.querySelectorAll('.art-card[data-work]')];
  const workFor = card => artist.works?.find(work => work.id === card.dataset.work);
  if (!('IntersectionObserver' in window)) { cards.slice(0, 8).forEach(card => queueWork(workFor(card))); return; }
  thumbnailObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { queueWork(workFor(entry.target)); thumbnailObserver.unobserve(entry.target); } });
  }, {root:timeline, rootMargin:'120px 0px'});
  cards.forEach(card => thumbnailObserver.observe(card));
}
async function cacheOfflineThumbnailCatalogue() {
  if (!currentUserIsAdmin) return;
  for (const artist of artists) await hydrateThumbnails(artist);
  artists.forEach(artist => {
    const contributionKeys = new Set(movementContributionWorksForArtist(artist).map(selectionKey));
    const orderedWorks = [...movementContributionWorksForArtist(artist), ...(artist.works || []).filter(work => !contributionKeys.has(selectionKey(work)))];
    orderedWorks.forEach(work => queueOfflineThumbnail(artist, work, savedArtist => {
      if (selectedId === savedArtist.id) renderTimeline();
    }));
  });
}

async function enrichArtist() {
  if (!currentUserIsAdmin) return;
  const artist = artists.find(a => a.id === selectedId);
  const hasWorks = (artist?.works || []).length > 0;
  if (!artist || (artist.generated?.schema >= 20 && hasWorks) || (sessionStorage.getItem(`art-atlas-tried-20-${artist.id}`) && hasWorks)) return;
  sessionStorage.setItem(`art-atlas-tried-20-${artist.id}`, '1');
  const original = timeline.innerHTML;
  timeline.innerHTML = `${original}<p class="loading">${language === 'ko' ? 'Wikimedia에서 작품 자료를 불러와 저장하는 중…' : 'Saving artwork data from Wikimedia…'}</p>`;
  try {
    const response = await apiFetch('/api/enrich', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(artist)});
    if (!response.ok) throw new Error('Could not retrieve artwork data');
    const result = await response.json();
    if (result.works?.length) { const existingWorks = artist.works || [], existingByKey = new Map(existingWorks.map(work => [selectionKey(work), work])), generatedByKey = new Map(existingWorks.filter(isGeneratedWork).map(work => [selectionKey(work), work])), fetchedByKey = new Map(result.works.map(work => [selectionKey(work), {...work,origin:'generated'}])); const isUpdate = Boolean(artist.generated?.file && generatedByKey.size); const generatedWorks = isUpdate ? [...generatedByKey.values()].map(existing => { const fetched = fetchedByKey.get(selectionKey(existing)); return fetched ? {...fetched,description:existing.description || fetched.description,detail:existing.detail || fetched.detail,thumbnail:existing.thumbnail || fetched.thumbnail,thumbnailValidation:existing.thumbnailValidation || fetched.thumbnailValidation,highResImage:existing.highResImage || fetched.highResImage,highResOriginal:existing.highResOriginal || fetched.highResOriginal} : existing; }) : result.works.map(work => { const fetched = {...work,origin:'generated'}, existing = existingByKey.get(selectionKey(work)); return existing && !isManualWork(existing) ? {...fetched,description:existing.description || fetched.description,detail:existing.detail || fetched.detail,thumbnail:existing.thumbnail || fetched.thumbnail,thumbnailValidation:existing.thumbnailValidation || fetched.thumbnailValidation,highResImage:existing.highResImage || fetched.highResImage,highResOriginal:existing.highResOriginal || fetched.highResOriginal} : fetched; }); artist.works = [...existingWorks.filter(work => !isGeneratedWork(work)),...generatedWorks]; if (result.artist?.name?.ko || result.artist?.name?.en) { artist.name = result.artist.name; artist.birth = result.artist.birth || artist.birth; artist.death = result.artist.death || artist.death; artist.nationality = result.artist.nationality || artist.nationality; artist.movement = result.artist.movement || artist.movement; } artist.works = selectArtistWorks(artist.works, artistImportedWorkLimit, artist); artist.generated = {schema:result.schema || 20,file:generatedCatalogueFile({id:artist.id,qid:result.qid || artist.qid}),fetchedAt:result.fetchedAt}; await normalizeArtistWorksBeforeSave(artist); await hydrateThumbnails(artist); persist(); await saveArtistsNow(); render(); }
    else timeline.innerHTML = original;
  } catch (_) { timeline.innerHTML = original; }
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
  artworkDialog.showModal();
  $('#artwork-page-url').focus();
}

async function addArtworkToSelectedArtist(pageUrl) {
  const artist = artists.find(item => item.id === artworkDialog.dataset.artistId);
  if (!artist) throw new Error('Selected artist is no longer available');
  const response = await apiFetch('/api/artist-from-url', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pageUrl})
  });
  const imported = await response.json();
  if (!response.ok || imported.error) throw new Error(imported.error || 'Artwork unavailable');
  const candidates = [imported.work, ...(imported.works || [])].filter(Boolean);
  const work = candidates.find(item => item.id || selectionKey(item));
  if (!work) throw new Error(language === 'ko' ? '주소에서 작품 정보를 찾지 못했습니다.' : 'No artwork information was found at that address.');
  const existing = (artist.works || []).find(item => item.id === work.id || selectionKey(item) === selectionKey(work));
  if (existing) {
    const previous = {...existing};
    Object.assign(existing, {
      ...existing,
      ...work,
      origin:'manual',
      detail:existing.detail || work.detail,
      thumbnail:existing.thumbnail || work.thumbnail,
      thumbnailValidation:existing.thumbnailValidation || work.thumbnailValidation,
      highResImage:existing.highResImage || work.highResImage,
      highResOriginal:existing.highResOriginal || work.highResOriginal
    });
    await normalizeArtistWorksBeforeSave(artist);
    persist();
    if (!await saveArtistsNow()) {
      Object.assign(existing, previous);
      throw new Error(language === 'ko' ? '저장 파일을 업데이트하지 못했습니다.' : 'Could not update the saved collection.');
    }
    queueOfflineThumbnail(artist, existing, savedArtist => {
      if (selectedId === savedArtist.id) renderTimeline();
    });
    return existing;
  }
  const added = {...work, origin:'manual'};
  artist.works = selectArtistWorks([...(artist.works || []), added], artistImportedWorkLimit, artist);
  const savedWork = artist.works.find(item => item.id === added.id || selectionKey(item) === selectionKey(added));
  await normalizeArtistWorksBeforeSave(artist);
  persist();
  if (!await saveArtistsNow()) {
    artist.works = (artist.works || []).filter(item => item.id !== added.id);
    throw new Error(language === 'ko' ? '저장 파일을 업데이트하지 못했습니다.' : 'Could not update the saved collection.');
  }
  queueOfflineThumbnail(artist, savedWork, savedArtist => {
    if (selectedId === savedArtist.id) renderTimeline();
  });
  return savedWork;
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

function setLocalArtworkDetails(file) {
  const details=$('#local-artwork-details');
  const title=$('#local-artwork-title-input');
  const year=$('#local-artwork-year-input');
  const selected=Boolean(file);
  details.classList.toggle('hidden',!selected);
  title.disabled=!selected;
  year.disabled=!selected;
  if(selected && !title.value.trim()) title.value=inferredArtworkTitle(file);
}

async function cacheThumbnailFromFile(artist, work, file) {
  const form=new FormData();
  form.append('artist',JSON.stringify({id:artist.id}));
  form.append('work',JSON.stringify(work));
  form.append('image',file,file.name);
  const response=await apiFetch('/api/thumbnail-upload',{method:'POST',body:form});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || !result.thumbnail) throw new Error(result.error || 'Could not upload the image');
  return result.thumbnail;
}

async function addLocalArtworkToSelectedArtist(file, title, yearInput) {
  const artist=artists.find(item => item.id === artworkDialog.dataset.artistId);
  if(!artist) throw new Error('Selected artist is no longer available');
  if(!file) throw new Error(language === 'ko' ? '이미지 파일을 선택하세요.' : 'Choose an image file.');
  const {year,yearEnd}=localArtworkYear(yearInput);
  const name=title || inferredArtworkTitle(file) || t('untitled');
  const work={id:`manual-local-${Date.now()}`,year,...(yearEnd ? {yearEnd} : {}),title:{ko:name,en:name},country:{ko:'',en:''},movement:{ko:'',en:''},description:{ko:'',en:''},origin:'manual'};
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
$('#add-button').onclick = () => { if (!currentUserIsAdmin) return; $('#add-form').reset(); setAddFormBusy(false); delete $('#entry-name').dataset.qid; $('#suggestions').classList.add('hidden'); $('#form-message').classList.add('hidden'); changeEntryType(); dialog.showModal(); };
$('#local-artwork-file').addEventListener('change', event => {
  setLocalArtworkDetails(event.currentTarget.files?.[0] || null);
  $('#add-artwork-message').classList.add('hidden');
});
$('#add-artwork-form').addEventListener('submit', async event => {
  event.preventDefault();
  const source=event.submitter?.value || 'web';
  const localImage=source === 'local';
  const file=$('#local-artwork-file').files?.[0];
  let pageUrl='';
  if (!localImage) {
    const rawUrl=cleanedArtworkInput($('#artwork-page-url').value);
    try {
      const parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
      pageUrl = parsed.href;
    } catch (_) {
      setArtworkDialogBusy(false, language === 'ko' ? 'HTTPS 웹페이지 주소를 입력하세요.' : 'Enter an HTTPS webpage URL.');
      return;
    }
  }
  setArtworkDialogBusy(true, localImage ? (language === 'ko' ? '이미지를 저장하는 중입니다.' : 'Saving image.') : (language === 'ko' ? '작품 정보를 가져오는 중입니다.' : 'Importing artwork information.'));
  try {
    if (localImage) await addLocalArtworkToSelectedArtist(file, $('#local-artwork-title-input').value.trim(), $('#local-artwork-year-input').value);
    else await addArtworkToSelectedArtist(pageUrl);
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
  const type = $('#entry-type').value, name = $('#entry-name').value.trim();
  if (!name) return;
  setAddFormBusy(true, language === 'ko' ? '페이지 정보를 가져오는 중입니다.' : 'Importing page information.');
  let skipEnrichAfterSave = false;
  let postSaveNotice = '';
  try {
    if (type === 'url' || type === 'artist') {
      const pageUrl = /^https?:\/\//i.test(name) ? name : 'https://' + name;
      try {
        const response=await apiFetch('/api/artist-from-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pageUrl})});
        const imported=await response.json();
        if(!response.ok || imported.error) throw new Error(imported.error || 'Page unavailable');
        let artist=artists.find(item => (imported.artist.qid && item.qid === imported.artist.qid) || item.id === imported.artist.id || (imported.artist.source && item.source === imported.artist.source));
        if(!artist){ artist=imported.artist; artists.push(artist); }
        else Object.assign(artist,{...imported.artist,works:artist.works || []});
        if (imported.work) { const existing = (artist.works || []).find(work => work.id === imported.work.id); if (existing) existing.origin = 'manual'; else artist.works.push({...imported.work,origin:'manual'}); }
        (imported.works || []).forEach(work => { const existing = (artist.works || []).find(item => selectionKey(item) === selectionKey(work) || item.id === work.id); if (existing) Object.assign(existing,{...work,origin:'manual'}); else artist.works.push({...work,origin:'manual'}); });
        artist.works = selectArtistWorks(artist.works || [],artistImportedWorkLimit,artist);
        selectedId=artist.id;
      } catch (error) {
        let validPageUrl;
        try {
          validPageUrl = new URL(pageUrl);
          if (!['http:', 'https:'].includes(validPageUrl.protocol)) throw new Error('Invalid protocol');
        } catch (_) {
          const message=$('#form-message');
          message.textContent=language === 'ko' ? 'http 또는 https로 시작하는 웹페이지 주소를 입력해 주세요.' : 'Enter a webpage URL beginning with http or https.';
          message.classList.remove('hidden');
          return;
        }
        let artist = artists.find(item => item.source === pageUrl || artistLinks(item).some(link => link.url === pageUrl));
        if (!artist) {
          artist = offlineArtistFromPageUrl(pageUrl);
          artists.push(artist);
        } else {
          artist.links = artistLinks(artist).some(link => link.url === pageUrl) ? artistLinks(artist) : [...artistLinks(artist), {url:pageUrl,label:'source'}];
          artist.source = artist.source || pageUrl;
        }
        selectedId = artist.id;
        skipEnrichAfterSave = true;
        const networkBlocked = isNetworkImportError(error);
        postSaveNotice = language === 'ko'
          ? (networkBlocked
            ? '서버가 지금 외부 웹페이지를 읽지 못해 작품 자동 가져오기는 건너뛰고, 입력한 주소를 출처로 가진 기본 화가 항목으로 저장했습니다.'
            : '이 페이지에서 작품 자료를 자동으로 찾지 못했지만, 입력한 주소를 출처로 가진 기본 화가 항목으로 저장했습니다.')
          : (networkBlocked
            ? 'The server could not read the external page right now, so the app saved a basic artist entry with the URL as its source.'
            : 'The app could not find artwork data on this page, but saved a basic artist entry with the URL as its source.');
      }
    } else if (type === 'artist') {
      const resolved = await resolveArtist($('#entry-name'));
      if (!resolved) { const message = $('#form-message'); message.textContent = language === 'ko' ? '자동완성 목록에서 화가 후보를 선택해 주세요.' : 'Select an artist from the suggestion list.'; message.classList.remove('hidden'); return; }
      const savedName = resolved.label;
      const id = `artist-${Date.now()}`;
      const artist = {id, name:{ko:savedName,en:savedName}, qid:resolved.qid, birth:Number($('#entry-birth').value) || null, death:null, nationality:{ko:'',en:''}, works:[]};
      artists.push(artist); selectedId = id;
    } else {
      const qid = $('#entry-name').dataset.qid;
      if (!qid) { const message=$('#form-message'); message.textContent=language === 'ko' ? '목록에서 작품 후보를 선택해 주세요.' : 'Select an artwork from the suggestion list.'; message.classList.remove('hidden'); return; }
      try {
        const response=await apiFetch('/api/artwork',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qid})});
        if(!response.ok) throw new Error('Artwork unavailable');
        const imported=await response.json(); let artist=artists.find(item=>item.qid===imported.artist.qid);
        if(!artist){ artist=imported.artist; artists.push(artist); }
        const existing = (artist.works || []).find(work => work.id === imported.work.id);
        if (existing) existing.origin = 'manual'; else artist.works.push({...imported.work,origin:'manual'});
        selectedId=artist.id;
      } catch (_) { const message=$('#form-message'); message.textContent=language === 'ko' ? '작품 정보를 가져오지 못했습니다. 다른 후보를 선택해 주세요.' : 'Could not import this artwork. Choose another suggestion.'; message.classList.remove('hidden'); return; }
    }
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
    if (postSaveNotice) alert(postSaveNotice);
    if (!skipEnrichAfterSave) {
      await enrichArtist();
      await normalizeArtistWorksBeforeSave(selectedArtist);
      await saveArtistsNow();
    }
  } finally {
    setAddFormBusy(false);
  }
});
document.querySelectorAll('[data-display-mode]').forEach(button => button.addEventListener('click', () => {
  language = 'ko';
  setUHangulMode(button.dataset.displayMode);
  render();
}));
$('#logout-button').onclick = logoutEverywhere;
$('#movement-logout-button').onclick = logoutEverywhere;
window.addEventListener('storage', event => {
  if (event.key !== 'art-atlas-logout-signal') return;
  try { sessionStorage.removeItem(accessSessionStorageKey); } catch (_) {}
  location.assign(new URL('index.html?login=1', location.href).href);
});
$('#artist-list-en-button')?.addEventListener('click', () => {
  artistListEnglish = !artistListEnglish;
  sessionStorage.setItem(artistListEnglishStorageKey, String(artistListEnglish));
  renderText();
  renderList();
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
    await cacheOfflineThumbnailCatalogue();
    runThumbnailAgent();
  }
}
startApp();
