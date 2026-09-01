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
