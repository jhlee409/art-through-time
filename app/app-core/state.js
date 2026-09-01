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
let artMovementLearningMap = {movements:{}};
let movementView = parseMovementView();
let countryArtView = parseCountryArtView();
let artistListView = parseArtistListView();
let artistListManualMovementOrder = [];
let artistListScrollTopToRestore = null;
let countryArtResetZoomOnRender = true;
const countryArtWorkCache = new Map();
const countryArtWorkRequests = new Map();
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
