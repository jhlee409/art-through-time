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
      countryArtWorkCache.clear();
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

