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
    const index = await (await fetch(`data/images/${encodeURIComponent(artist.id)}/index.json`)).json();
    (artist.works || []).forEach(work => {
      const indexedThumbnail = String(index[work.id]?.thumbnail || '')
        .replace(/^data\/thumbnails\//, 'data/images/');
      if (indexedThumbnail) {
        work.thumbnail = indexedThumbnail;
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

