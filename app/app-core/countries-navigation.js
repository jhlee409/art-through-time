function artistNationality(artist) {
  return artistNationalityOverrides[String(artist?.qid || '')] || artistNationalityOverrides[String(artist?.id || '')] || artist?.nationality;
}
function applyArtistOverrides(artist) {
  const nationalityOverride = artistNationalityOverrides[String(artist?.qid || '')] || artistNationalityOverrides[String(artist?.id || '')];
  return nationalityOverride ? {...artist, nationality:{...nationalityOverride}} : artist;
}
function artistCountrySource(artist) {
  return artistBirthCountryOverrides[String(artist?.qid || '')] || artistBirthCountryOverrides[String(artist?.id || '')] || artist?.birthCountry || artistNationality(artist);
}
function countryInfo(value) {
  const original = loc(value) || '?';
  const keys = [original, value?.ko, value?.en].filter(Boolean);
  const current = keys.map(key => currentCountryByHistoricalCountry[key]).find(Boolean);
  const name = current ? loc(current) : original;
  return {original, name, colorKey:current?.colorKey || value?.en || name};
}
function countryDisplayLabel(value) {
  const country = countryInfo(value);
  return country.original === country.name ? country.name : `${country.original} (${country.name})`;
}
function artistCountryInfo(artist) {
  const country = countryInfo(artistCountrySource(artist));
  return {...country, original:country.name};
}
function artistCountryLabel(artist) {
  return countryInfo(artistCountrySource(artist)).name;
}
function countryAvatarText(country) {
  if (!country || country.original === country.name) return (country?.name || '?').slice(0, 1);
  return `${country.original.slice(0, 1)}(${country.name.slice(0, 1)})`;
}
function countryColor(country) {
  const text = String(country || '?');
  const hue = [...text].reduce((value, character) => (value * 31 + character.codePointAt(0)) % 360, 0);
  return 'hsl(' + hue + ' 48% 78%)';
}
function countryInk(country) {
  const text = String(country || '?');
  const hue = [...text].reduce((value, character) => (value * 31 + character.codePointAt(0)) % 360, 0);
  return 'hsl(' + hue + ' 34% 28%)';
}
const esc = (text='') => String(text).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function ordinalSuffix(number) {
  const value = Math.abs(Number(number) || 0);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  return {1:'st', 2:'nd', 3:'rd'}[value % 10] || 'th';
}
function timelineCenturyStart(year) {
  const value = Number(year);
  return Number.isFinite(value) ? Math.floor(value / 100) * 100 : null;
}
function timelineCenturyLabelFromStart(start) {
  const value = Number(start);
  if (!Number.isFinite(value)) return language === 'ko' ? '연도 미상' : 'Undated';
  const century = Math.floor(value / 100) + 1;
  return language === 'ko' ? `${century}세기` : `${century}${ordinalSuffix(century)} century`;
}
function timelineDecadeStart(year) {
  const value = Number(year);
  return Number.isFinite(value) ? Math.floor(value / 10) * 10 : null;
}
function timelineDecadeLabelFromStart(start) {
  const value = Number(start);
  if (!Number.isFinite(value)) return language === 'ko' ? '연도 미상' : 'Undated';
  return language === 'ko' ? `${value}년대` : `${value}s`;
}
function timelineCenturyBands(start, end, yearScale) {
  const first = timelineCenturyStart(start);
  if (first === null) return '';
  const axisEnd = Math.max(start + 1, end);
  const bands = [];
  let index = 0;
  for (let year = first; year < axisEnd; year += 100) {
    const clippedStart = Math.max(start, year);
    const clippedEnd = Math.min(axisEnd, year + 100);
    if (clippedEnd <= clippedStart) {
      index++;
      continue;
    }
    const left = (clippedStart - start) * yearScale;
    const width = Math.max(1, (clippedEnd - clippedStart) * yearScale);
    bands.push(`<span class="timeline-century-band ${index % 2 ? '' : 'timeline-century-band--tinted'}" style="left:${left}px;width:${width}px"><span>${esc(timelineCenturyLabelFromStart(year))}</span></span>`);
    index++;
  }
  return bands.join('');
}
function timelineVerticalCenturyBands(start, end, yearScale, className='timeline-century-y-band') {
  const first = timelineCenturyStart(start);
  if (first === null) return '';
  const axisEnd = Math.max(start + 1, end);
  const bands = [];
  let index = 0;
  for (let year = first; year < axisEnd; year += 100) {
    const clippedStart = Math.max(start, year);
    const clippedEnd = Math.min(axisEnd, year + 100);
    if (clippedEnd <= clippedStart) {
      index++;
      continue;
    }
    const top = (clippedStart - start) * yearScale;
    const height = Math.max(1, (clippedEnd - clippedStart) * yearScale);
    bands.push(`<span class="${className} ${index % 2 ? '' : `${className}--tinted`}" style="top:${top}px;height:${height}px"><span>${esc(timelineCenturyLabelFromStart(year))}</span></span>`);
    index++;
  }
  return bands.join('');
}
function uHangulArtistAttributes(artist, displayName) {
  const original = artist?.name?.en || '';
  const korean = artistStandardKoreanName(artist);
  const display = artistUHangulDisplayName(artist) || korean;
  const listKorean = displayName || korean;
  if (!original && !korean && !display && !listKorean) return '';
  return ` data-uh-original="${esc(original)}" data-uh-korean="${esc(korean)}" data-uh-display-korean="${esc(display)}" data-uh-list-korean="${esc(listKorean)}"`;
}
function setUHangulMode(mode) {
  uHangulMode = ['uhangul','original'].includes(mode) ? mode : 'korean';
  sessionStorage.setItem(uHangulModeStorageKey, uHangulMode);
  window.dispatchEvent(new CustomEvent('uhangulmodechange', {detail:{mode:uHangulMode}}));
}
function uHangulModeUrl(url, mode=uHangulMode) {
  const target = new URL(url, location.href);
  target.searchParams.set('uhangul', mode);
  return target.href;
}
function openNamedPage(url, targetName) {
  const opened = window.open('', targetName);
  if (!opened) return;
  try {
    if (opened.location.href !== url) opened.location.href = url;
  } catch (_) {
    opened.location.href = url;
  }
  if (typeof opened.focus === 'function') opened.focus();
}
function generatedCatalogueFile(artistOrResult={}) {
  return `data/generated/${artistOrResult.qid ? `qid-${artistOrResult.qid}` : artistOrResult.id}.json`;
}
function openArtistListPage() {
  const pageUrl = new URL('index.html', location.href);
  pageUrl.searchParams.delete('artistList');
  pageUrl.searchParams.delete('countryArt');
  pageUrl.searchParams.delete('movementPopup');
  pageUrl.searchParams.set('artists', '1');
  openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeArtists');
}
function openArtistTimelinePage(artistId) {
  if (!artistId) return;
  const pageUrl = new URL('index.html', location.href);
  pageUrl.searchParams.delete('artistList');
  pageUrl.searchParams.delete('countryArt');
  pageUrl.searchParams.delete('movementPopup');
  pageUrl.searchParams.set('artists', '1');
  pageUrl.searchParams.set('artist', artistId);
  openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeArtists');
}
function openPainterListPage() {
  if (!isPainterListPage) {
    const pageUrl = new URL('index.html', location.href);
    pageUrl.searchParams.delete('artists');
    pageUrl.searchParams.delete('artist');
    pageUrl.searchParams.delete('artistId');
    pageUrl.searchParams.delete('countryArt');
    pageUrl.searchParams.delete('movementPopup');
    pageUrl.searchParams.set('artistList', '1');
    openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeArtistList');
    return;
  }
  artistListView = normalizeArtistListView(artistListView);
  persistArtistListView();
  countryArtResetZoomOnRender = true;
  viewMode = 'artist-list';
  closeDetail();
  render();
}
function openTechniquesPage() {
  openNamedPage(uHangulModeUrl('techniques.html'), 'artThroughTimeTechniques');
}
function openTopicsPage() {
  openNamedPage(uHangulModeUrl('topics.html'), 'artThroughTimeTopics');
}
function openCountryArtPage() {
  if (!isCountryArtPage) {
    const pageUrl = new URL('index.html', location.href);
    pageUrl.searchParams.delete('artists');
    pageUrl.searchParams.delete('artistList');
    pageUrl.searchParams.delete('artist');
    pageUrl.searchParams.delete('artistId');
    pageUrl.searchParams.delete('movementPopup');
    pageUrl.searchParams.set('countryArt', '1');
    openNamedPage(uHangulModeUrl(pageUrl.href), 'artThroughTimeCountryArt');
    return;
  }
  countryArtView = normalizeCountryArtView(countryArtView);
  persistCountryArtView();
  viewMode = 'country-art';
  closeDetail();
  render();
}
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const selectionKey = work => {
  const qid = String(work.id || '').match(/^wikidata-Q\d+/)?.[0];
  if (qid) return qid;
  const title = normalized(work.title?.en || work.title?.ko);
  return title ? `${title}-${work.year || ''}` : String(work.id || '');
};
const isManualWork = work => work?.origin === 'manual';
const isGeneratedWork = work => !isManualWork(work) && /^(wikidata|wikipedia)-/.test(String(work.id || ''));
const isLocalArtworkPath = value => String(value || '').trim().replace(/\\/g,'/').startsWith('data/images/');
const hasLocalArtworkAsset = work => [
  work?.localImage,
  work?.thumbnail,
  work?.image,
  work?.highResImage,
  work?.highResOriginal,
  work?.migration?.image?.localThumbnail,
  work?.migration?.image?.highResolution
].some(isLocalArtworkPath);
const workPopularity = work => Number.isFinite(Number(work.popularity)) ? Number(work.popularity) : 0;
const workYearForSort = work => {
  const value = String(work?.year ?? '').trim();
  const year = Number(value);
  return value && Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
};
const movementNameParts = value => [...new Set(
  (typeof value === 'string' ? [value] : [value?.ko,value?.en])
    .map(item => String(item || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim())
    .filter(Boolean)
)];
