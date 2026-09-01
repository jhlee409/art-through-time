function textList(value) {
  return (Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean);
}
function artistAliases(artist) {
  const aliases = artist?.aliases;
  if (Array.isArray(aliases)) return textList(aliases);
  return [...textList(aliases?.ko), ...textList(aliases?.en)];
}
function artistSearchText(artist) {
  return [artist?.fullName, artist?.name?.ko, artist?.name?.en, loc(artist?.name), artistDisplayName(artist), artistUHangulDisplayName(artist), artistListKoreanName(artist), ...artistAliases(artist)].filter(Boolean).join(' ').toLocaleLowerCase();
}
function compareArtistsByName(a, b) {
  return artistListKoreanName(a).localeCompare(artistListKoreanName(b), 'ko');
}
function compareArtistsForSort(a, b, sort) {
  if (sort === 'birth') return (a.birth || 9999) - (b.birth || 9999) || compareArtistsByName(a, b);
  const byName = compareArtistsByName(a, b);
  return sort === 'nameDesc' ? -byName : byName;
}
function artistLinks(artist) {
  return Array.isArray(artist?.links) ? artist.links.filter(link => {
    try { return ['http:', 'https:'].includes(new URL(link.url || link).protocol); }
    catch (_) { return false; }
  }).map(link => typeof link === 'string' ? {url:link} : link) : [];
}
function linkEmphasisField() {
  const label=language==='ko'?'강조':'Emphasize';
  return `<label class="link-emphasis-field"><input type="checkbox" data-link-emphasis><span>${esc(label)}</span></label>`;
}
function savedLinkFromEntry(url, form) {
  return {url:url.href,...(form?.querySelector('[data-link-emphasis]')?.checked?{emphasized:true}:{})};
}
function linkEmphasisClass(link) {
  return link?.emphasized===true?' link-emphasized':'';
}
function artistWikipediaUrl(artist, originalName = '') {
  const direct = typeof artist?.links?.wikipedia === 'string' ? artist.links.wikipedia : '';
  try {
    if (direct && ['http:', 'https:'].includes(new URL(direct).protocol)) return direct;
  } catch (_) {}
  const saved = artistLinks(artist).find(link => /(^|\.)wikipedia\.org$/i.test(new URL(link.url).hostname));
  if (saved?.url) return saved.url;
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(originalName || artist?.name?.en || artist?.name?.ko || '')}`;
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
    if (!await saveArtistPresentationNow(artist,{artistLinks:artist.links})) {
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
    if (!await saveArtistPresentationNow(artist,{workId:work.id,workLinks:artworkLinks(work)})) {
      setArtworkLinks(artist, work, previousLinks);
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
      const nextLinks = options.getLinks(button);
      if (!await options.saveLinks(nextLinks, button)) {
        options.setLinks(previousLinks, button);
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
function thumbnail(url, width = 240) { return ''; }
function isExternalImageSource(value) { return /^https?:\/\//i.test(String(value || '')); }
const offlineArtworkPlaceholder = 'data/images/_placeholder/artwork-placeholder.png';
function localArtworkImage(work) {
  const image = [work?.thumbnail, work?.image, work?.highResImage, work?.highResOriginal]
    .find(value => value && !isExternalImageSource(value)) || '';
  if (!image || isExternalImageSource(image)) return offlineArtworkPlaceholder;
  if (image === offlineArtworkPlaceholder) return image;
  return work?.thumbnailCacheKey ? `${image}?v=${encodeURIComponent(work.thumbnailCacheKey)}` : image;
}
function externalArtworkImage(work, width = 240) {
  return '';
}
function artworkImageDisplay(work, {detail=false} = {}) {
  const highRes = work?.highResImage || '';
  if (detail && highRes && !isExternalImageSource(highRes)) return {src:highRes, urlDependent:false};
  const local = localArtworkImage(work);
  if (local && local !== offlineArtworkPlaceholder) return {src:local, urlDependent:false};
  const external = externalArtworkImage(work, detail ? 1200 : 240);
  return external ? {src:external, urlDependent:true} : {src:'', urlDependent:false};
}
function urlDependencyBadge() {
  return `<span class="url-dependency-badge" title="${esc(language === 'ko' ? '로컬 파일 없이 외부 URL에 의존하는 이미지입니다. 로컬 이미지 교체 버튼으로 바꿀 수 있습니다.' : 'This image depends on an external URL. Replace it with a local image when possible.')}">${esc(language === 'ko' ? 'URL 의존' : 'URL dependent')}</span>`;
}
function artworkPreviewImage(work) {
  return artworkImageDisplay(work).src;
}
function unavailableImageLabel(work) {
  return work?.imageUploadStatus === 'pending-upload' ? t('imagePendingUpload') : t('noImage');
}

