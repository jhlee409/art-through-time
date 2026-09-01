/* Artist list, timeline, and artist detail rendering. */
const expandedArtistSummaryIds=new Set();
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
  const restoreListScrollTop = Number.isFinite(artistListScrollTopToRestore) ? artistListScrollTopToRestore : null;
  if (restoreListScrollTop !== null) requestAnimationFrame(() => {
    const maximumTop = Math.max(0, list.scrollHeight - list.clientHeight);
    list.scrollTop = Math.max(0, Math.min(restoreListScrollTop, maximumTop));
    artistListScrollTopToRestore = null;
  });
  // Keep the active artist easy to find on initial timeline renders without
  // touching the right-hand timeline scroll position or changing selection.
  else if (viewMode === 'timeline' && selectedId) requestAnimationFrame(() => {
    const activeRow = list.querySelector('.artist-row.active');
    if (!activeRow) return;
    const centeredTop = activeRow.offsetTop - (list.clientHeight - activeRow.offsetHeight) / 2;
    const maximumTop = Math.max(0, list.scrollHeight - list.clientHeight);
    list.scrollTo({top:Math.max(0, Math.min(centeredTop, maximumTop)), behavior:'auto'});
  });
  list.querySelectorAll('.artist-item').forEach(button => button.onclick = async () => { artistListScrollTopToRestore = list.scrollTop || 0; viewMode = 'timeline'; selectedId = button.dataset.id; persistSelection(); closeDetail(); const artist = artists.find(item => item.id === selectedId); await hydrateThumbnails(artist); renderList(); renderTimeline(); await enrichArtist(); });
  list.querySelectorAll('.delete-artist').forEach(button => button.onclick = async event => { event.stopPropagation(); if (!currentUserIsAdmin || !confirm(t('confirmDelete'))) return; const deleted = artists.find(artist => artist.id === button.dataset.id); artists = artists.filter(artist => artist.id !== button.dataset.id); if (selectedId === button.dataset.id) selectedId = artists[0]?.id || null; persist(); if (!await saveArtistsNow()) { artists.push(deleted); if (!selectedId) selectedId = deleted.id; alert(language === 'ko' ? '삭제 내용을 저장하지 못해 복원했습니다.' : 'The deletion could not be saved, so it was restored.'); } render(); });
  $('#artist-names').innerHTML = artists.flatMap(a => [artistListKoreanName(a), artistDisplayName(a), artistUHangulDisplayName(a), a.fullName, a.name?.ko, a.name?.en, ...artistAliases(a)]).filter(Boolean).filter((value,index,self) => self.indexOf(value) === index).map(value => `<option value="${esc(value)}"></option>`).join('');
}
function artistSummaryArtworkKey(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,''); }
function artistSummaryArtworkSource(work) {
  const highResolution=work?.highResImage && !isExternalImageSource(work.highResImage) ? work.highResImage : '';
  return highResolution || artworkImageDisplay(work,{detail:true}).src || '';
}
function artistSummaryLineMarkup(line, artist) {
  const text=String(line || ''), works=Array.isArray(artist?.works)?artist.works:[], titleRecords=[];
  works.forEach(work=>{
    if(!artistSummaryArtworkSource(work)) return;
    const titles=[work.title?.ko,work.title?.en,work.title?.original,work.title?.native].map(value=>String(value || '').trim()).filter(value=>value.length>=2);
    titles.forEach(title=>titleRecords.push({title,key:artistSummaryArtworkKey(title),work}));
  });
  titleRecords.sort((left,right)=>right.title.length-left.title.length);
  const byKey=new Map(titleRecords.map(item=>[item.key,item])), ranges=[];
  const addRange=(start,end,work)=>{
    if(start<0 || end<=start || ranges.some(range=>start<range.end && end>range.start)) return;
    ranges.push({start,end,work});
  };
  for(const match of text.matchAll(/[《〈<]([^》〉>]{2,100})[》〉>]/g)) {
    const record=byKey.get(artistSummaryArtworkKey(match[1]));
    if(record) addRange(match.index+1,match.index+1+match[1].length,record.work);
  }
  const lower=text.toLocaleLowerCase();
  titleRecords.forEach(record=>{
    const needle=record.title.toLocaleLowerCase();
    let start=lower.indexOf(needle);
    while(start>=0) { addRange(start,start+record.title.length,record.work); start=lower.indexOf(needle,start+needle.length); }
  });
  if(!ranges.length) return esc(text);
  ranges.sort((left,right)=>left.start-right.start);
  let cursor=0, markup='';
  ranges.forEach(range=>{
    markup+=esc(text.slice(cursor,range.start));
    markup+=`<button class="artist-summary-work-link" type="button" data-summary-work="${esc(range.work.id)}" title="${esc(language==='ko'?'이 작품으로 이동':'Go to this artwork')}">${esc(text.slice(range.start,range.end))}</button>`;
    cursor=range.end;
  });
  return markup+esc(text.slice(cursor));
}

function refreshArtistSummaryArtworkLinks(box, artist) {
  const list=box?.querySelector('.artist-summary-lines');
  if(!list) return;
  const lines=localizedLines(artist?.artistSummary);
  [...list.children].forEach((item,index)=>{
    item.innerHTML=artistSummaryLineMarkup(lines[index] || '',artist);
  });
}

function openArtistSummaryArtworkPreview(work) {
  const source=artistSummaryArtworkSource(work);
  if(!source) return;
  const previous=document.querySelector('.artist-summary-image-preview');
  if(typeof previous?.closeArtistSummaryPreview==='function') previous.closeArtistSummaryPreview();
  else previous?.remove();
  closeDetail();
  artworkHoverPreview?.classList.add('hidden');
  const preview=document.createElement('section'), frame=document.createElement('div'), image=document.createElement('img');
  preview.className='artist-summary-image-preview';
  preview.tabIndex=-1;
  preview.setAttribute('role','dialog');
  preview.setAttribute('aria-modal','true');
  preview.setAttribute('aria-label',language==='ko'?`${artworkDisplayTitle(work)} 이미지`:`Image of ${artworkDisplayTitle(work)}`);
  frame.className='artist-summary-image-preview-frame';
  image.src=source;
  image.alt=artworkDisplayTitle(work);
  frame.append(image);
  preview.append(frame);
  const fit=()=>{
    if(!image.naturalWidth || !image.naturalHeight) return;
    const maximumWidth=Math.max(1,window.innerWidth*.8), maximumHeight=Math.max(1,window.innerHeight*.8);
    const scale=Math.min(maximumWidth/image.naturalWidth,maximumHeight/image.naturalHeight);
    frame.style.width=`${Math.max(1,Math.round(image.naturalWidth*scale))}px`;
    frame.style.height=`${Math.max(1,Math.round(image.naturalHeight*scale))}px`;
  };
  const onKeyDown=event=>{ if(event.key==='Escape') close(); };
  const close=()=>{
    window.removeEventListener('resize',fit);
    document.removeEventListener('keydown',onKeyDown);
    preview.remove();
  };
  preview.closeArtistSummaryPreview=close;
  image.addEventListener('load',fit);
  image.addEventListener('error',close);
  image.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();close();});
  window.addEventListener('resize',fit);
  document.addEventListener('keydown',onKeyDown);
  document.body.append(preview);
  if(image.complete) fit();
  preview.focus();
}

function openArtistTranscriptDialog(artist) {
  const youtubeLinks=artistLinks(artist).map((link,index)=>({link,index})).filter(item=>isYouTubeLink(item.link));
  if(!youtubeLinks.length) {
    alert(language==='ko' ? '먼저 화가 이름 옆 + 버튼으로 유튜브 주소를 추가해 주세요.' : 'Add a YouTube address beside the artist name first.');
    return;
  }
  document.querySelector('.artist-transcript-dialog')?.remove();
  const dialog=document.createElement('dialog');
  dialog.className='artist-transcript-dialog';
  dialog.innerHTML=`<form class="artist-transcript-form"><button class="artist-transcript-close" type="button" title="${esc(language==='ko'?'닫기':'Close')}" aria-label="${esc(language==='ko'?'닫기':'Close')}">×</button><p class="eyebrow">${esc(language==='ko'?'연결 자료':'LINKED SOURCE')}</p><h2>${esc(language==='ko'?'유튜브 스크립트':'YouTube Transcript')}</h2><label><span>${esc(language==='ko'?'유튜브 링크':'YouTube link')}</span><select class="artist-transcript-source">${youtubeLinks.map((item,position)=>`<option value="${item.index}">${position+1} · ${esc(item.link.url)}</option>`).join('')}</select></label><a class="artist-transcript-open" href="#" target="_blank" rel="noopener">${esc(language==='ko'?'선택한 영상 열기':'Open selected video')}</a><label><span>${esc(language==='ko'?'스크립트':'Transcript')}</span><textarea class="artist-transcript-text" maxlength="80000" spellcheck="false"></textarea></label><div class="artist-transcript-meta"><span class="artist-transcript-count">0 / 80,000</span><span class="artist-transcript-state"></span></div><div class="artist-transcript-actions"><button class="artist-transcript-delete" type="button">${esc(language==='ko'?'스크립트 삭제':'Delete transcript')}</button><span><button class="artist-transcript-cancel" type="button">${esc(language==='ko'?'취소':'Cancel')}</button><button class="artist-transcript-save" type="submit">${esc(language==='ko'?'저장':'Save')}</button></span></div></form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form'), select=dialog.querySelector('.artist-transcript-source'), textarea=dialog.querySelector('textarea');
  const openLink=dialog.querySelector('.artist-transcript-open'), count=dialog.querySelector('.artist-transcript-count'), state=dialog.querySelector('.artist-transcript-state');
  const deleteButton=dialog.querySelector('.artist-transcript-delete'), saveButton=dialog.querySelector('.artist-transcript-save');
  const selectedItem=()=>youtubeLinks.find(item=>item.index===Number(select.value));
  const updateCount=()=>{ count.textContent=`${textarea.value.length.toLocaleString()} / 80,000`; };
  const loadSelection=()=>{
    const item=selectedItem();
    textarea.value=String(item?.link?.transcript || '');
    openLink.href=item?.link?.url || '#';
    deleteButton.disabled=!textarea.value.trim();
    const updatedAt=Date.parse(item?.link?.transcriptUpdatedAt || '');
    state.textContent=Number.isNaN(updatedAt) ? '' : new Intl.DateTimeFormat(language==='ko'?'ko-KR':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(updatedAt);
    updateCount();
  };
  const close=()=>dialog.close();
  const setBusy=busy=>{
    select.disabled=busy;
    textarea.disabled=busy;
    deleteButton.disabled=busy || !textarea.value.trim();
    saveButton.disabled=busy;
    saveButton.textContent=busy ? (language==='ko'?'저장 중…':'Saving…') : (language==='ko'?'저장':'Save');
  };
  const saveTranscript=async text=>{
    const item=selectedItem();
    if(!item) return;
    const normalized=String(text || '').replace(/\r\n?/g,'\n').trim();
    if(normalized.length>80000) return alert(language==='ko'?'스크립트는 80,000자까지 저장할 수 있습니다.':'Transcripts can contain up to 80,000 characters.');
    const previousLinks=artist.links;
    const nextLinks=artistLinks(artist).map(link=>({...link}));
    if(normalized) {
      nextLinks[item.index].transcript=normalized;
      nextLinks[item.index].transcriptUpdatedAt=new Date().toISOString();
    } else {
      delete nextLinks[item.index].transcript;
      delete nextLinks[item.index].transcriptUpdatedAt;
    }
    artist.links=nextLinks;
    setBusy(true);
    if(!await saveArtistPresentationNow(artist,{artistLinks:nextLinks})) {
      artist.links=previousLinks;
      setBusy(false);
      alert(saveFailureMessage());
      return;
    }
    close();
    renderTimeline();
  };
  select.addEventListener('change',loadSelection);
  textarea.addEventListener('input',()=>{ deleteButton.disabled=!textarea.value.trim(); updateCount(); });
  dialog.querySelector('.artist-transcript-close').addEventListener('click',close);
  dialog.querySelector('.artist-transcript-cancel').addEventListener('click',close);
  deleteButton.addEventListener('click',()=>{
    if(confirm(language==='ko'?'이 링크에 저장한 스크립트를 삭제할까요?':'Delete the transcript saved for this link?')) saveTranscript('');
  });
  form.addEventListener('submit',event=>{ event.preventDefault(); saveTranscript(textarea.value); });
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.addEventListener('click',event=>{ if(event.target===dialog) close(); });
  loadSelection();
  dialog.showModal();
  textarea.focus();
}

function setupArtistSummaryEditor(artist) {
  const box = timeline.querySelector('.artist-summary-box');
  if (!box) return;
  const summaryLines=box.querySelector('.artist-summary-lines'), expandButton=box.querySelector('.artist-summary-expand-button');
  expandButton?.addEventListener('click',()=>{
    const expanded=!summaryLines?.classList.contains('expanded');
    if(expanded) refreshArtistSummaryArtworkLinks(box,artist);
    summaryLines?.classList.toggle('expanded',expanded);
    expandButton.setAttribute('aria-expanded',String(expanded));
    expandButton.textContent=expanded?'▴':'▾';
    expandButton.title=language==='ko'?(expanded?'해설 접기':'해설 펼치기'):(expanded?'Collapse notes':'Expand notes');
    expanded ? expandedArtistSummaryIds.add(artist.id) : expandedArtistSummaryIds.delete(artist.id);
  });
  box.addEventListener('click',event=>{
    const button=event.target.closest('[data-summary-work]');
    if(!button || !box.contains(button)) return;
    const work=(artist.works || []).find(item=>String(item.id || '')===String(button.dataset.summaryWork || ''));
    if(!work) return;
    openArtistSummaryArtworkPreview(work);
  });
  if (!currentUserIsAdmin) return;
  const read = box.querySelector('.artist-summary-read');
  const editor = box.querySelector('.artist-summary-editor');
  const textarea = editor?.querySelector('textarea');
  const editButton = box.querySelector('.artist-summary-edit-button');
  const updateButton = box.querySelector('.artist-summary-update-button');
  const transcriptButton = box.querySelector('.artist-summary-transcript-button');
  const cancelButton = box.querySelector('.artist-summary-cancel');
  if (!read || !editor || !textarea || !editButton || !cancelButton) return;
  const showEditor = show => {
    read.classList.toggle('hidden', show);
    editor.classList.toggle('hidden', !show);
    editButton.classList.toggle('hidden', show);
    expandButton?.classList.toggle('hidden', show);
    transcriptButton?.classList.toggle('hidden', show);
    updateButton?.classList.toggle('hidden', show);
    if (show) textarea.focus();
  };
  editButton.addEventListener('click', () => showEditor(true));
  transcriptButton?.addEventListener('click',()=>openArtistTranscriptDialog(artist));
  updateButton?.addEventListener('click', async () => {
    const consentMessage = language === 'ko'
      ? '새 링크 또는 저장 스크립트의 텍스트와 현재 화가 해설을 연표로 정리하기 위해 OpenAI API로 전송합니다. 계속할까요?'
      : 'Text from new links or saved transcripts and the current artist notes will be sent to the OpenAI API to build the chronology. Continue?';
    if (!confirm(consentMessage)) return;
    const originalLabel = updateButton.textContent;
    updateButton.disabled = true;
    editButton.disabled = true;
    if(transcriptButton) transcriptButton.disabled = true;
    updateButton.textContent = language === 'ko' ? '정리 중…' : 'Updating…';
    updateButton.setAttribute('aria-busy', 'true');
    try {
      const requestUpdate=async payload=>{
        const response=await apiFetch('/api/artist-summary-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artistId:artist.id,consent:true,...payload})});
        const result=await response.json().catch(()=>({}));
        if(response.status===401) throw new Error(language==='ko'?'관리자 세션이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.':'Administrator session expired. Refresh and sign in again.');
        if(!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
        return result;
      };
      let result=await requestUpdate({});
      if(result.needsConfirmation) {
        const decisions=(result.contradictions || []).map((conflict,index)=>{
          const message=language==='ko'
            ? `모순 가능성이 있는 내용 ${index+1}/${result.contradictions.length}\n\n기존 해설:\n${conflict.existingText}\n\n새 자료:\n${conflict.newText}\n\n[확인] 새 자료로 교체\n[취소] 기존 해설 유지`
            : `Possible contradiction ${index+1}/${result.contradictions.length}\n\nExisting note:\n${conflict.existingText}\n\nNew source:\n${conflict.newText}\n\nOK: replace with new source\nCancel: keep existing note`;
          return confirm(message)?'replace':'keep';
        });
        result=await requestUpdate({confirmationToken:result.confirmationToken,decisions});
      }
      if (result.noChanges) {
        alert(language === 'ko' ? '추가할 자료가 없습니다.' : 'There is no new material to add.');
        return;
      }
      if (result.artist) Object.assign(artist, result.artist);
      if (Number.isInteger(result.revision)) collectionMetadata = {...collectionMetadata,revision:result.revision};
      const failureDetails = (result.failures || []).slice(0, 3).map(item => `\n- ${item.error}`).join('');
      const failureNotice = result.failures?.length
        ? `\n${language === 'ko' ? `읽지 못한 링크 ${result.failures.length}개가 있습니다.` : `${result.failures.length} link(s) could not be read.`}${failureDetails}`
        : '';
      const remainingNotice = result.remainingCount
        ? `\n${language === 'ko' ? `남은 새 링크 ${result.remainingCount}개는 업데이트를 다시 눌러 처리합니다.` : `${result.remainingCount} new link(s) remain; press Update again.`}`
        : '';
      const usage = result.usage || {};
      const usageNotice = usage.totalTokens
        ? `\n${language === 'ko' ? `사용량: 입력 ${Number(usage.inputTokens || 0).toLocaleString()} · 출력 ${Number(usage.outputTokens || 0).toLocaleString()} · 합계 ${Number(usage.totalTokens).toLocaleString()} 토큰${Number.isFinite(usage.estimatedUsd) ? ` · 예상 $${Number(usage.estimatedUsd).toFixed(4)}` : ''}` : `Usage: ${Number(usage.totalTokens).toLocaleString()} tokens${Number.isFinite(usage.estimatedUsd) ? ` · est. $${Number(usage.estimatedUsd).toFixed(4)}` : ''}`}`
        : '';
      const updateMessage=Number(result.addedCount || 0)>0
        ? (language === 'ko' ? `새 자료 ${result.sourceCount || 0}개에서 해설 ${result.addedCount || 0}개를 정리했습니다.` : `Added ${result.addedCount || 0} notes from ${result.sourceCount || 0} new sources.`)
        : (language === 'ko' ? '추가할 자료가 없습니다.' : 'There is no new material to add.');
      alert(`${updateMessage}${usageNotice}${failureNotice}${remainingNotice}`);
      renderTimeline();
    } catch (error) {
      alert(`${language === 'ko' ? '화가 해설 업데이트 실패: ' : 'Artist notes update failed: '}${error.message}`);
    } finally {
      updateButton.disabled = false;
      editButton.disabled = false;
      if(transcriptButton) transcriptButton.disabled = false;
      updateButton.textContent = originalLabel;
      updateButton.removeAttribute('aria-busy');
    }
  });
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
