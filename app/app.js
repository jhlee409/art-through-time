/* Application bootstrap and shared event bindings. Dependencies load before this file. */
$('#sort').onchange = renderList;
$('#artist-search').oninput = event => { artistSearchQuery = event.currentTarget.value.trim(); renderList(); };
$('#movement-atlas-button')?.addEventListener('click', openMovementAtlas);
$('#country-art-button')?.addEventListener('click', openCountryArtPage);
$('#artist-list-button')?.addEventListener('click', openPainterListPage);
$('#techniques-button')?.addEventListener('click', openTechniquesPage);
$('#topics-button')?.addEventListener('click', openTopicsPage);
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
function refreshMovementDocumentConsumers() {
  if (viewMode === 'country-art') renderCountryArt();
  if (viewMode === 'artist-list') renderCountryArt({artistListMode:true});
}
window.addEventListener('art-atlas-movement-document-saved', refreshMovementDocumentConsumers);
window.addEventListener('storage', event => {
  if (event.key === countryArtDocumentRevisionStorageKey && (isCountryArtPage || isPainterListPage)) {
    refreshMovementDocumentConsumers();
  }
  if (event.key !== 'art-atlas-logout-signal') return;
  try { sessionStorage.removeItem(accessSessionStorageKey); localStorage.removeItem(sharedAccessSessionStorageKey); } catch (_) {}
});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'art-through-time-uhangul-mode') return;
  setUHangulMode(event.data.mode);
  renderText();
});
async function startApp() {
  await chooseAccessMode();
  await loadCurrentUserRole();
  await loadData();
  revealInitialAppShell();
  await enrichArtist();
  restoreLastTimelinePosition();
  if (currentUserIsAdmin) {
    runThumbnailAgent();
  }
}
startApp();
