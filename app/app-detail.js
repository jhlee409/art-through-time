/* Artwork detail, slideshow, movement documents, and local artwork editing. */
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
  const artworkLinkButtons = savedArtworkLinks.map((link, index) => `<button class="artwork-link-button${isYouTubeLink(link) ? ' artwork-link-youtube' : ''}${linkEmphasisClass(link)}" type="button" data-artwork-link-index="${index}" title="${esc(link.url)}" aria-label="${esc(`${index + 1}. ${link.url}`)}">${index + 1}</button>`).join('');
  const artworkLinkControls = `<span class="artwork-link-controls">${currentUserIsAdmin ? `<button class="artwork-link-add" type="button" title="${esc(addArtworkLinkLabel)}" aria-label="${esc(addArtworkLinkLabel)}">+</button>` : ''}${artworkLinkButtons}</span>`;
  const artworkTitle = `<div class="detail-title-row"><h2>${esc(loc(work.title) || t('untitled'))}</h2>${artworkLinkControls}</div>`;
  const artworkLinkEntry = currentUserIsAdmin ? `<form class="artwork-link-entry hidden"><input type="url" inputmode="url" placeholder="https://" aria-label="${esc(artworkLinkInputLabel)}" required>${linkEmphasisField()}<button type="submit">${esc(confirmArtworkLinkLabel)}</button></form>` : '';
  detail.innerHTML = `<div class="detail-panel-resize" role="separator" aria-orientation="vertical" aria-label="${language === 'ko' ? '설명 창 너비 조절' : 'Resize detail panel'}"></div><button class="close-detail" type="button" aria-label="닫기">×</button>${image ? `<div class="detail-image-wrap" title="${esc(imageWindowHint)}"><img class="detail-image" src="${esc(image)}" alt="${esc(loc(work.title))}">${imageInfo.urlDependent ? urlDependencyBadge() : ''}</div><div class="detail-image-resize" role="separator" aria-orientation="horizontal" aria-label="${language === 'ko' ? '그림 창 높이 조절' : 'Resize image height'}"></div><div class="detail-image-actions">${currentUserIsAdmin ? `<button class="edit-artwork" type="button" title="${esc(editLabel)}" aria-label="${esc(editLabel)}">✎</button>` : ''}</div>` : `<div class="detail-image-unavailable">${esc(unavailableImageLabel(work))}</div>`}${artworkTitle}${artworkLinkEntry}<dl class="detail-facts">${artworkFacts(work,artist).map(([label,value]) => `<div><dt>${esc(label)}</dt><dd${label===t('artist') ? uHangulArtistAttributes(artist,value) : ''}>${esc(value)}</dd></div>`).join('')}</dl><div class="detail-content">${body}</div><div class="detail-editor hidden"><textarea aria-label="${esc(editLabel)}">${esc(editedText)}</textarea><div><button class="cancel-artwork-edit" type="button">${esc(cancelLabel)}</button><button class="save-artwork-edit" type="button">${esc(polishSaveLabel)}</button></div></div><p class="source">${esc(savedNote)}</p>`;
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
    setArtworkLinks(artist, work, [...previousLinks, savedLinkFromEntry(url,artworkLinkEntryElement)]);
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
  detail.querySelector('.detail-image-wrap')?.addEventListener('dblclick', () => openArtworkImageWindow(image, loc(work.title), {artist:language === 'ko' ? artistListKoreanName(artist) : loc(artist.name), title:artworkDisplayTitle(work), year:workYearLabel(work)}));
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
    runtimeStyle.dataset.uhangulIntegration = 'v0.7';
    const runtimeScript = popup.document.createElement('script');
    runtimeScript.defer = true;
    runtimeScript.src = new URL('uhangul/uhangul-runtime.js?v=0.7', location.href).href;
    runtimeScript.dataset.uhangulIntegration = 'v0.7';
    popup.document.head.append(runtimeStyle, runtimeScript);
  } catch (_) { /* The popup still works if its document cannot be extended. */ }
  popup.document.exitFullscreen?.();
  popup.moveTo(popupLeft, popupTop);
  popup.resizeTo(popupWidth, popupHeight);
  popup.focus();
}
function openArtworkImageWindow(imageSrc, title, caption={}) {
  const existingViewer = document.querySelector('.artwork-image-viewer');
  if(existingViewer) (existingViewer.closeArtworkViewer || (()=>existingViewer.remove()))();
  const viewer = document.createElement('section');
  viewer.className = 'artwork-image-viewer artist-timeline-image-viewer';
  viewer.tabIndex = -1;
  viewer.setAttribute('role','dialog');
  viewer.setAttribute('aria-modal','true');
  viewer.setAttribute('aria-label',String(title || (language === 'ko' ? '작품 이미지 확대' : 'Enlarged artwork')));
  viewer.innerHTML = `<div class="artwork-image-viewer-stage"><img class="artwork-image-viewer-image" src="${esc(imageSrc)}" alt="${esc(title || '')}"><div class="artwork-image-viewer-lens" aria-hidden="true"><img src="${esc(imageSrc)}" alt=""></div></div><div class="artwork-image-viewer-caption"></div>`;
  const stage = viewer.querySelector('.artwork-image-viewer-stage');
  const image = stage.querySelector('.artwork-image-viewer-image');
  const lens = stage.querySelector('.artwork-image-viewer-lens');
  const lensImage = lens.querySelector('img');
  const captionElement = viewer.querySelector('.artwork-image-viewer-caption');
  captionElement.textContent = [caption.artist,caption.title,caption.year].filter(Boolean).join(' · ');
  captionElement.classList.toggle('hidden',!captionElement.textContent);
  const fitViewer = () => {
    if(!image.naturalWidth || !image.naturalHeight) return;
    const aspect=image.naturalWidth/image.naturalHeight,maxWidth=window.innerWidth*.9,maxHeight=window.innerHeight*.9;
    let width=maxWidth,height=width/aspect;
    if(height>maxHeight){height=maxHeight;width=height*aspect;}
    viewer.style.width=`${Math.max(120,Math.round(width))}px`;
    viewer.style.height=`${Math.max(120,Math.round(height))}px`;
  };
  const draw = () => {
    if(!image.naturalWidth || !image.naturalHeight) return;
    const base=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight);
    const width=image.naturalWidth*base,height=image.naturalHeight*base;
    image.style.width=`${Math.max(1,width)}px`;
    image.style.height=`${Math.max(1,height)}px`;
    image.style.transform='translate(-50%,-50%)';
    lens.classList.remove('visible');
  };
  const closeViewer = () => {window.removeEventListener('resize',resizeViewer);document.removeEventListener('keydown',onKeyDown);viewer.remove();};
  const resizeViewer = () => {fitViewer();draw();};
  const onKeyDown = event => {if(event.key==='Escape') closeViewer();};
  const moveLens = event => {
    const imageRect=image.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
    const imageX=event.clientX-imageRect.left,imageY=event.clientY-imageRect.top;
    if(imageX<0 || imageY<0 || imageX>imageRect.width || imageY>imageRect.height){lens.classList.remove('visible');return;}
    const diameter=imageRect.height*2/3;
    lens.style.width=`${diameter}px`;
    lens.style.height=`${diameter}px`;
    lens.style.left=`${event.clientX-stageRect.left-diameter/2}px`;
    lens.style.top=`${event.clientY-stageRect.top-diameter/2}px`;
    lensImage.style.width=`${imageRect.width*3}px`;
    lensImage.style.height=`${imageRect.height*3}px`;
    lensImage.style.left=`${diameter/2-imageX*3}px`;
    lensImage.style.top=`${diameter/2-imageY*3}px`;
    lens.classList.add('visible');
  };
  image.addEventListener('load',resizeViewer);
  image.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();closeViewer();});
  stage.addEventListener('pointermove',moveLens);
  stage.addEventListener('pointerleave',()=>lens.classList.remove('visible'));
  window.addEventListener('resize',resizeViewer);
  document.addEventListener('keydown',onKeyDown);
  viewer.closeArtworkViewer=closeViewer;
  document.body.append(viewer);
  if(image.complete) resizeViewer();
  viewer.focus();
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
async function latestMovementDocumentUrl(name, slot, fallback='') {
  try {
    const response = await fetch(apiUrl('/api/movement-documents'), {cache:'no-store'});
    const result = await response.json();
    const documents = result?.documents;
    const latest = documents?.[name]?.[slot] || '';
    if (response.ok && documents && typeof documents === 'object') movementDocuments = documents;
    return latest || fallback;
  } catch (_) {
    return fallback;
  }
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
  const documentInFrame = frame.contentDocument || frame.document;
  if (!documentInFrame || documentInFrame.querySelector('#art-atlas-description-editor-style')) return;
  if (!currentUserIsAdmin) return;
  const syncRoot = documentInFrame.documentElement.dataset;
  if (syncRoot.artAtlasSyncVersion === '1' && syncRoot.artAtlasSyncState !== 'complete') return;
  const idSyncComplete = syncRoot.artAtlasSyncVersion === '1' && syncRoot.artAtlasSyncState === 'complete';
  const artistGuide = syncRoot.artAtlasDocumentModel === 'artist-guide';
  const editorStyle = documentInFrame.createElement('style');
  editorStyle.id = 'art-atlas-description-editor-style';
  editorStyle.textContent = '.movement-work-body,.caption{position:relative}.movement-work-body>h3:first-child,.caption>h3:first-child{padding-right:38px}.art-atlas-description-editor{position:absolute;top:10px;right:10px;z-index:2;display:flex;align-items:center;gap:7px}.art-atlas-description-editor button{border:1px solid #8e9b8b;border-radius:5px;width:28px;height:28px;padding:0;background:#f5f1e8;color:#18221e;font:700 16px/1 system-ui,sans-serif;cursor:pointer}.art-atlas-description-editor button[data-action="save"]{background:#18221e;color:#fff;border-color:#18221e}.art-atlas-description-editor.editing{position:static;width:100%;flex-wrap:wrap;align-items:flex-start;margin-top:12px}.art-atlas-description-editor.editing label{display:block;width:100%;color:inherit;font:700 12px/1.5 system-ui,sans-serif}.art-atlas-description-editor.editing button{width:auto;height:auto;padding:6px 9px;font-size:12px}.art-atlas-description-editor.editing textarea{display:block;width:100%;min-height:110px;margin-top:4px;resize:vertical;border:1px solid #8e9b8b;border-radius:6px;padding:10px;background:#fff;color:#18221e;font:14px/1.6 system-ui,sans-serif}.movement-work-grid.art-atlas-work-sortable{outline:1px dashed rgba(142,155,139,.72);outline-offset:7px}.movement-work-card[data-art-atlas-sortable-work="true"]{cursor:grab}.movement-work-card[data-art-atlas-card-role="primary"]:not([data-art-atlas-sortable-work="true"]){cursor:default}.movement-work-card.art-atlas-work-dragging{opacity:.45;cursor:grabbing}';
  documentInFrame.head.append(editorStyle);
  const label = language === 'ko' ? '설명 편집' : 'Edit description';
  const saveLabel = language === 'ko' ? '저장' : 'Save';
  const cancelLabel = language === 'ko' ? '취소' : 'Cancel';
  const saveDocument = async () => {
    const representativeSnapshots = [...documentInFrame.querySelectorAll('td[data-art-atlas-representative-artists],td[data-art-atlas-further-artists]')].map(cell => [cell,cell.innerHTML]);
    try {
      const copy = documentInFrame.documentElement.cloneNode(true);
      copy.querySelectorAll('[data-art-atlas-description-editor], [data-art-atlas-country-feature-editor-control], #art-atlas-description-editor-style, #art-atlas-generic-country-feature-editor-style, #art-atlas-movement-highres-style, #art-atlas-movement-highres-viewer, #art-atlas-movement-card-zoom-style, #art-atlas-movement-card-zoom-viewer').forEach(element => element.remove());
      copy.querySelectorAll('[data-art-atlas-sortable-work]').forEach(card => {
        card.removeAttribute('data-art-atlas-sortable-work');
        card.removeAttribute('draggable');
        card.classList.remove('art-atlas-work-dragging');
      });
      copy.querySelectorAll('.art-atlas-work-sortable').forEach(grid => grid.classList.remove('art-atlas-work-sortable'));
      copy.querySelectorAll('img[data-art-atlas-highres]').forEach(image => {
        image.removeAttribute('data-art-atlas-highres');
        image.removeAttribute('data-art-atlas-highres-title');
      });
      const response = await apiFetch('/api/movement-documents', {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,slot,html:`<!doctype html>\n${copy.outerHTML}`})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not save description');
      const revision = result.revision || `${Date.now()}-${Math.random()}`;
      localStorage.setItem(countryArtDocumentRevisionStorageKey, revision);
      window.dispatchEvent(new CustomEvent('art-atlas-movement-document-saved',{detail:{name,slot,revision}}));
    } catch(error) {
      representativeSnapshots.forEach(([cell,markup]) => { cell.innerHTML=markup; });
      throw error;
    }
  };
  documentInFrame.querySelectorAll('article.movement-work-card, article.card').forEach(card => {
    if (!idSyncComplete && !card.querySelector('img')) return;
    const body = card.querySelector('.movement-work-body, .caption');
    if (!body || body.querySelector('[data-art-atlas-description-editor]')) return;
    const paragraphs = [...body.querySelectorAll('p')].filter(paragraph => !paragraph.classList.contains('art-atlas-work-movement'));
    const description = idSyncComplete ? card.querySelector('[data-art-atlas-card-description]') : (paragraphs.at(-1) || body.appendChild(documentInFrame.createElement('p')));
    const selectionReason = idSyncComplete ? card.querySelector('[data-art-atlas-selection-reason]') : null;
    if (!description || (idSyncComplete && !selectionReason)) return;
    const controls = documentInFrame.createElement('div');
    controls.className = 'art-atlas-description-editor';
    controls.dataset.artAtlasDescriptionEditor = 'true';
    const editButton = documentInFrame.createElement('button');
    editButton.type = 'button'; editButton.textContent = '✎'; editButton.title = label; editButton.setAttribute('aria-label', label); editButton.dataset.artAtlasEditTrigger = 'true';
    controls.append(editButton); body.append(controls);
    editButton.addEventListener('click', () => {
      const fields = idSyncComplete
        ? [{element:selectionReason,label:language === 'ko' ? '선정 이유' : 'Selection reason'},{element:description,label:language === 'ko' ? '작품 설명' : 'Artwork description'}]
        : [{element:description,label:language === 'ko' ? '설명' : 'Description'}];
      const originals = fields.map(field => field.element.textContent.trim());
      const inputs = fields.map((field,index) => {
        const wrapper = documentInFrame.createElement('label');
        wrapper.textContent = field.label;
        const textarea = documentInFrame.createElement('textarea');
        textarea.value = originals[index];
        wrapper.append(textarea);
        return {wrapper,textarea};
      });
      controls.classList.add('editing');
      controls.replaceChildren(...inputs.map(input => input.wrapper));
      const saveButton = documentInFrame.createElement('button');
      saveButton.type = 'button'; saveButton.dataset.action = 'save'; saveButton.textContent = saveLabel;
      const cancelButton = documentInFrame.createElement('button');
      cancelButton.type = 'button'; cancelButton.textContent = cancelLabel;
      controls.append(saveButton,cancelButton); inputs[0].textarea.focus();
      cancelButton.addEventListener('click', () => { controls.classList.remove('editing'); controls.replaceChildren(editButton); });
      saveButton.addEventListener('click', async () => {
        const next = inputs.map(input => input.textarea.value.trim());
        if (next.some(value => !value)) return;
        saveButton.disabled = true;
        try {
          fields.forEach((field,index) => { field.element.textContent = next[index]; });
          await saveDocument();
          controls.classList.remove('editing');
          controls.replaceChildren(editButton);
        } catch (error) {
          fields.forEach((field,index) => { field.element.textContent = originals[index]; });
          alert(error.message || (language === 'ko' ? '설명을 저장하지 못했습니다.' : 'Could not save the description.'));
          saveButton.disabled = false;
        }
      });
    });
  });
  const enhancementSections = [...documentInFrame.querySelectorAll('.movement-enhancement')];
  const representativeSection = enhancementSections.at(-1);
  representativeSection?.querySelectorAll('.movement-work-grid').forEach(grid => {
    const developmentId = idSyncComplete ? grid.dataset.artAtlasDevelopmentId : '';
    const cards = [...grid.querySelectorAll(':scope > article.movement-work-card, :scope > article.card')]
      .filter(card => artistGuide || !idSyncComplete || card.dataset.artAtlasDevelopmentId === developmentId)
      .filter(card => idSyncComplete || card.querySelector('img'))
      .filter(card => artistGuide || !idSyncComplete || card.dataset.artAtlasCardRole === 'further');
    if (cards.length < 2) return;
    // Artist-guide cards stay within their learning tier. Legacy complete
    // documents continue to sort only further-study cards by development.
    grid.classList.add('art-atlas-work-sortable');
    let dragged = null;
    let originalOrder = [];
    cards.forEach(card => {
      card.draggable = true;
      card.dataset.artAtlasSortableWork = 'true';
      card.addEventListener('dragstart', event => {
        if (event.target.closest('button, input, textarea, a, form')) { event.preventDefault(); return; }
        if (artistGuide && card.dataset.artAtlasArtistTier !== grid.dataset.artAtlasArtistTier) { event.preventDefault(); return; }
        if (!artistGuide && idSyncComplete && (!developmentId || card.dataset.artAtlasDevelopmentId !== developmentId)) { event.preventDefault(); return; }
        dragged = card;
        originalOrder = [...grid.children];
        card.classList.add('art-atlas-work-dragging');
        event.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', async () => {
        const moved = dragged;
        dragged = null;
        if (!moved) return;
        moved.classList.remove('art-atlas-work-dragging');
        if (originalOrder.filter(item => item.matches?.('article.movement-work-card, article.card')).every((item, index) => item === [...grid.querySelectorAll(':scope > article.movement-work-card, :scope > article.card')][index])) return;
        try { await saveDocument(); }
        catch (error) {
          originalOrder.forEach(item => grid.append(item));
          alert(error.message || (language === 'ko' ? '카드 순서를 저장하지 못했습니다.' : 'Could not save card order.'));
        }
      });
    });
    grid.addEventListener('dragover', event => {
      if (!dragged || (artistGuide && dragged.dataset.artAtlasArtistTier !== grid.dataset.artAtlasArtistTier) || (!artistGuide && idSyncComplete && dragged.dataset.artAtlasDevelopmentId !== developmentId)) return;
      event.preventDefault();
      const targetSelector = artistGuide ? ':scope > article.movement-work-card' : ':scope > article.movement-work-card[data-art-atlas-card-role="further"], :scope > article.card';
      const targets = [...grid.querySelectorAll(targetSelector)].filter(card => card !== dragged);
      const before = targets.find(card => {
        const rect = card.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2 || (event.clientY <= rect.bottom && event.clientX < rect.left + rect.width / 2);
      });
      if (before) grid.insertBefore(dragged, before); else grid.append(dragged);
    });
  });
}
function movementDocumentOwnerName(name) {
  const aliases = new Set(['Northern Renaissance', 'German Renaissance', 'Nordic Renaissance', 'Danish Renaissance', 'Danube School', '북방 르네상스', '독일 르네상스', '도나우파']);
  return aliases.has(name) ? 'Renaissance' : name;
}
function movementDocumentUrlWithAnchor(url, anchor) {
  return anchor ? `${String(url).split('#')[0]}#${encodeURIComponent(anchor)}` : url;
}
async function openMovementDocumentInDetail(name, label) {
  name = movementDocumentOwnerName(name);
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
async function openMovementDocument(name, slot, label, anchor) {
  name = movementDocumentOwnerName(name);
  const url = movementDocuments?.[name]?.[slot];
  if (url) {
    const popup = movementExplanationWindow();
    if (!currentUserIsAdmin) writeMovementDocumentLoading(popup, label || name);
    if (popup) {
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
    try {
      const latestUrl = await latestMovementDocumentUrl(name, slot, url);
      const documentUrl = currentUserIsAdmin ? await refreshMovementDocument(name, slot) : latestUrl;
      return openExplanationUrl(movementDocumentUrlWithAnchor(documentUrl, anchor), popup, name, label || name);
    }
    catch (_) { return openExplanationUrl(movementDocumentUrlWithAnchor(url, anchor), popup, name, label || name); }
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
  menu.querySelector('[data-action="add"]').onclick = async () => { menu.remove(); const file=await chooseMovementDocumentFile(); if(!file) return; const form=new FormData(); form.append('name',name); form.append('fileName',label || name); form.append('slot',slot); form.append('document',file); const response=await apiFetch('/api/movement-documents',{method:'POST',body:form}); const result=await response.json(); if(!response.ok || !result.ok) return alert(result.error || 'Could not save document'); movementDocuments[name]={...(movementDocuments[name]||{}),[slot]:result.url}; alert(language === 'ko' ? 'HTML을 자료 폴더에 저장했습니다.' : 'The HTML was saved in the materials folder.'); };
  menu.querySelector('[data-action="remove"]').onclick = async () => { menu.remove(); if(!movementDocuments?.[name]?.[slot]) return alert(language === 'ko' ? '삭제할 저장 문서가 없습니다.' : 'There is no saved document to delete.'); if(!confirm(language === 'ko' ? '저장된 HTML 문서를 삭제할까요?' : 'Delete the saved HTML document?')) return; const response=await apiFetch('/api/movement-documents',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,slot})}); const result=await response.json(); if(!response.ok || !result.ok) return alert(result.error || 'Could not delete document'); delete movementDocuments[name][slot]; if(!Object.keys(movementDocuments[name]).length) delete movementDocuments[name]; };
  document.body.append(menu); setTimeout(() => document.addEventListener('pointerdown', () => menu.remove(), {once:true}), 0);
}
function openHistoricalEventWikipedia(name) {
  const url = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`;
  window.open(url, '_blank', 'noopener');
}
function closeDetail() { delete detail.dataset.movementDocumentUrl; detail.classList.remove('show'); $('.main-area').classList.remove('detail-open'); detail.innerHTML = placeholder(); setupDetailPanelResize(); }
function render() { renderText(); renderList(); if (viewMode === 'movements') renderMovementAtlas(); else if (viewMode === 'country-art') renderCountryArt(); else if (viewMode === 'artist-list') renderCountryArt({artistListMode:true}); else renderTimeline(); closeDetail(); }

async function uploadLocalArtworkImage(artist, work, file) {
  if (!currentUserIsAdmin || !file) throw new Error(language === 'ko' ? '관리자 권한과 이미지 파일이 필요합니다.' : 'Administrator access and an image file are required.');
  const form=new FormData();
  form.append('artistId',artist.id);
  form.append('workId',work.id);
  form.append('image',file);
  const response=await apiFetch('/api/local-artwork-image',{method:'POST',body:form});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || !result.image || !result.thumbnail || !result.artist || !result.work) throw new Error(result.error || `Upload failed (HTTP ${response.status})`);
  applySavedArtworkMutation(artist,result);
  return result;
}
function applySavedArtworkMutation(artist, result) {
  Object.assign(artist,result.artist);
  if(Number.isInteger(result.revision)) collectionMetadata={...collectionMetadata,revision:result.revision};
  lastSavedSnapshot=artistSnapshot();
  lastSaveError='';
  localStorage.removeItem(storageKey);
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

async function saveLocalArtworkFromFile(artist, work, file) {
  const form=new FormData();
  form.append('artist',JSON.stringify({id:artist.id}));
  form.append('work',JSON.stringify(work));
  form.append('image',file,file.name);
  const response=await apiFetch('/api/local-thumbnail-image',{method:'POST',body:form});
  const result=await response.json().catch(()=>({}));
  if(!response.ok || !result.thumbnail || !result.artist || !result.work) throw new Error(result.error || 'Could not upload the image');
  applySavedArtworkMutation(artist,result);
  return result;
}

async function addLocalArtworkToSelectedArtist(file, title, yearInput) {
  const artist=artists.find(item => item.id === artworkDialog.dataset.artistId);
  if(!artist) throw new Error('Selected artist is no longer available');
  if(!file) throw new Error(language === 'ko' ? '이미지 파일을 선택하세요.' : 'Choose an image file.');
  const {year,yearEnd}=localArtworkYear(yearInput || inferredArtworkYear(file));
  const name=title || inferredArtworkTitle(file) || t('untitled');
  const work={id:`manual-local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,year,...(yearEnd ? {yearEnd} : {}),title:{ko:name,en:name},country:{ko:'',en:''},movement:{ko:'',en:''},description:{ko:'',en:''},origin:'manual',imageOwnershipVerification:{status:'pending'}};
  if((artist.works || []).some(item => selectionKey(item) === selectionKey(work))) throw new Error(language === 'ko' ? '같은 제목과 제작 연도의 작품이 이미 등록되어 있습니다.' : 'An artwork with this title and year is already listed.');
  const result=await saveLocalArtworkFromFile(artist,work,file);
  return result.work;
}

async function addLocalArtworksToSelectedArtist(files, title, yearInput) {
  if(!files.length) throw new Error(language === 'ko' ? '이미지 파일을 선택하세요.' : 'Choose image files.');
  for(const [index,file] of files.entries()) {
    setArtworkDialogBusy(true, files.length > 1 ? (language === 'ko' ? `이미지를 저장하는 중입니다… ${index+1}/${files.length}` : `Saving images… ${index+1}/${files.length}`) : (language === 'ko' ? '이미지를 저장하는 중입니다.' : 'Saving image.'));
    await addLocalArtworkToSelectedArtist(file, files.length > 1 ? '' : title, yearInput);
  }
}
