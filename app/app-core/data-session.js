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
  try { artMovementLearningMap = await (await fetch('data/art-movement-learning-map.json')).json(); } catch (_) { artMovementLearningMap = {movements:{}}; }
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
