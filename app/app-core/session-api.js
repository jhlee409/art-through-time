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
