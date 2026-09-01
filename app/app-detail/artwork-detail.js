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
