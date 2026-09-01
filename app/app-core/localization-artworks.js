const t = (key) => copy[language][key] || key;
copy.ko.movementAtlas = '미술 사조의 이해';
copy.en.movementAtlas = 'Understanding Art Movements';
copy.ko.techniques = '미술 기법 및 용어';
copy.en.techniques = 'Art Techniques and Terms';
const koreanLabelFallbacks = {'Italian Renaissance':'이탈리아 르네상스','High Renaissance':'전성기 르네상스','Mannerism':'매너리즘'};
const brokenLabel = value => /\?/.test(String(value || ''));
const loc = (value) => {
  if (typeof value !== 'object' || !value) return value;
  const preferred = value[language] || value.en || value.ko;
  if (language === 'ko' && brokenLabel(preferred) && value.en) return koreanLabelFallbacks[value.en] || value.en;
  return preferred;
};
function localizedLines(value, limit=Infinity) {
  const text = Array.isArray(value)
    ? value
    : Array.isArray(value?.[language])
      ? value[language]
      : Array.isArray(value?.ko)
        ? value.ko
        : Array.isArray(value?.en)
          ? value.en
          : String(loc(value) || '').split(/\n+/);
  return text.map(line => String(line || '').trim()).filter(Boolean).slice(0, limit);
}
function cleanSummaryLine(line) {
  return String(line || '').replace(/^\s*(?:[-*•]\s*)?/, '').trim();
}
function setArtistSummaryLines(artist, lines) {
  const cleaned = (Array.isArray(lines) ? lines : String(lines || '').split(/\n+/))
    .map(cleanSummaryLine)
    .filter(Boolean);
  const current = artist.artistSummary && typeof artist.artistSummary === 'object' && !Array.isArray(artist.artistSummary)
    ? artist.artistSummary
    : {};
  if (!cleaned.length) {
    const next = {...current};
    delete next[language];
    if (Object.keys(next).length) artist.artistSummary = next;
    else delete artist.artistSummary;
    return;
  }
  artist.artistSummary = {...current, [language]:cleaned};
}
function artistSummaryEditorText(lines) {
  const items = localizedLines(lines);
  return items.length ? items.map(line => `- ${line}`).join('\n') : '- ';
}
const artworkTitleLocales = ['ko','en','original'];
function artworkTitleValue(title, mode) {
  if (!title || typeof title !== 'object') return mode === 'ko' || mode === 'en' ? String(title || '').trim() : '';
  const original = title.original || title.native || title.originalTitle || title.nativeTitle || title.sourceTitle || '';
  const values = {ko:title.ko, en:title.en, original};
  return String(values[mode] || '').trim();
}
function artworkDisplayTitle(work) {
  return artworkTitleLocales.map(mode => artworkTitleValue(work?.title, mode)).find(Boolean) || t('untitled');
}
function artworkThumbnailTitle(work, artist) {
  let title = artworkDisplayTitle(work).replace(/\s+/g, ' ').trim();
  // Imported catalogue labels occasionally append a date, artist, collection,
  // or descriptive sentence after the actual artwork title.  Keep only the
  // title on thumbnails; the collection remains in its own metadata line.
  title = title
    .replace(/^\s*file:\s*/i, '')
    .replace(/\s*\(\s*(?:c\.?\s*)?\d{3,4}[^)]*\)(?:\s*,.*)?$/i, '')
    .replace(/\s*,\s*(?:c\.?\s*)?\d{3,4}(?:\s*[–-]\s*\d{2,4})?(?:\s*,.*)?$/i, '')
    .replace(/\s*,\s*(?:private )?(?:museum|gallery|collection|museum collection|royal museums?).*$/i, '');
  const flexibleNamePattern = name => String(name).trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]+');
  const artistNames = [artist?.fullName, artist?.name?.ko, artist?.name?.en].filter(Boolean);
  for (const name of artistNames) {
    const namePattern = flexibleNamePattern(name);
    title = title
      .replace(new RegExp(`^\\s*${namePattern}\\s*(?:,|:|—|–|-)\\s*`, 'i'), '')
      .replace(new RegExp(`\\s+(?:by|after|follower of|circle of|school of)\\s+${namePattern}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*\\((?:after|follower of|circle of|school of)\\s+${namePattern}\\)\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${namePattern}(?:\\s*,.*)?$`, 'i'), '');
  }
  const collectionValues = work?.detail?.facts?.collection || work?.collection || [];
  const collections = (Array.isArray(collectionValues) ? collectionValues : [collectionValues]).map(loc).filter(Boolean);
  for (const collection of collections) {
    const collectionPattern = flexibleNamePattern(collection);
    title = title.replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${collectionPattern}(?:\\s*,.*)?$`, 'i'), '');
  }
  return title.trim() || artworkDisplayTitle(work);
}
function artworkTitleAliases(work) {
  const title = work?.title;
  if (!title) return [];
  if (typeof title !== 'object') return [String(title).trim()].filter(Boolean);
  return [...new Set(artworkTitleLocales.map(mode => artworkTitleValue(title, mode)).filter(Boolean))];
}
function wikipediaPageInfo(url) {
  try {
    const parsed = new URL(url, location.href);
    if (!/(^|\.)wikipedia\.org$/i.test(parsed.hostname) || !parsed.pathname.startsWith('/wiki/')) return null;
    const title = decodeURIComponent(parsed.pathname.slice('/wiki/'.length)).replace(/_/g, ' ').trim();
    if (!title || /^(?:special|file|category|help|wikipedia|template|portal|talk|user|module):/i.test(title)) return null;
    return {url:parsed.href, title, lang:parsed.hostname.split('.')[0] || 'en'};
  } catch (_) {
    return null;
  }
}
function wikipediaUrlFromTitle(languageCode, title) {
  const lang = languageCode === 'ko' ? 'ko' : 'en';
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(title || '').trim().replace(/ /g, '_'))}`;
}
function artworkQid(work) {
  const id = String(work?.id || '');
  const source = String(work?.source || '');
  return id.match(/^(?:wikidata|featured)-(Q\d+)$/)?.[1]
    || source.match(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/i)?.[1]
    || '';
}
function artworkWikipediaSources(work) {
  const linkUrls = (work?.links || []).map(link => typeof link === 'string' ? link : link?.url).filter(Boolean);
  return [
    ...(Array.isArray(work?.detail?.sources) ? work.detail.sources : []),
    work?.source,
    ...linkUrls
  ].filter(Boolean);
}
function wikipediaSourceMatchesArtwork(info, work) {
  const pageTitle = normalized(info?.title || '');
  const aliases = artworkTitleAliases(work).map(normalized).filter(value => value.length >= 2);
  return Boolean(pageTitle && aliases.some(alias => pageTitle.includes(alias)));
}
function explicitArtworkWikipediaUrl(work) {
  const candidates = artworkWikipediaSources(work)
    .map(wikipediaPageInfo)
    .filter(info => info && wikipediaSourceMatchesArtwork(info, work));
  if (!candidates.length) return '';
  const preferred = candidates.find(info => info.lang === language) || candidates.find(info => info.lang === 'en') || candidates[0];
  return preferred.url;
}
function wikipediaResultMatchesArtwork(page, work, artist) {
  const title = page?.title || '';
  const extract = page?.extract || '';
  const titleKey = normalized(title);
  const extractKey = normalized(extract);
  const aliases = artworkTitleAliases(work).map(normalized).filter(value => value.length >= 2);
  const artistNames = [artist?.name?.en, artist?.name?.ko, artistDisplayName(artist)]
    .filter(Boolean)
    .flatMap(name => {
      const parts = String(name).split(/\s+/).filter(part => part.length > 2);
      return [name, parts[parts.length - 1]];
    })
    .map(normalized)
    .filter(value => value.length >= 2);
  const titleMatches = aliases.some(alias => titleKey.includes(alias));
  const artistMatches = !artistNames.length || artistNames.some(name => titleKey.includes(name) || extractKey.includes(name));
  return titleMatches && artistMatches;
}
async function wikipediaExactTitleUrl(work, artist) {
  const languages = language === 'ko' ? ['ko','en'] : ['en','ko'];
  const aliases = artworkTitleAliases(work);
  for (const lang of languages) {
    for (const title of aliases) {
      try {
        const endpoint = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',redirects:'1',titles:title,prop:'info|extracts',inprop:'url',exintro:'1',explaintext:'1'})}`;
        const data = await fetch(endpoint).then(response => response.ok ? response.json() : null);
        const page = Object.values(data?.query?.pages || {}).find(item => item && !item.missing);
        if (page && page.fullurl && wikipediaResultMatchesArtwork(page, work, artist)) return page.fullurl;
      } catch (_) {}
    }
  }
  return '';
}
async function wikipediaSearchTitleUrl(work, artist) {
  const languages = language === 'ko' ? ['ko','en'] : ['en','ko'];
  const aliases = artworkTitleAliases(work);
  const artistName = artist?.name?.en || artist?.name?.ko || '';
  if (!artistName || !aliases.length) return '';
  for (const lang of languages) {
    for (const title of aliases) {
      try {
        const endpoint = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',generator:'search',gsrsearch:`"${title}" "${artistName}"`,gsrnamespace:'0',gsrlimit:'4',prop:'info|extracts',inprop:'url',exintro:'1',explaintext:'1'})}`;
        const data = await fetch(endpoint).then(response => response.ok ? response.json() : null);
        const page = Object.values(data?.query?.pages || {}).find(item => item?.fullurl && wikipediaResultMatchesArtwork(item, work, artist));
        if (page) return page.fullurl;
      } catch (_) {}
    }
  }
  return '';
}
async function resolveArtworkWikipediaUrl(work, artist) {
  const explicit = explicitArtworkWikipediaUrl(work);
  if (explicit) return explicit;
  const qid = artworkQid(work);
  if (qid) {
    try {
      const endpoint = `https://www.wikidata.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'wbgetentities',ids:qid,props:'sitelinks',sitefilter:'kowiki|enwiki'})}`;
      const data = await fetch(endpoint).then(response => response.ok ? response.json() : null);
      const sitelinks = data?.entities?.[qid]?.sitelinks || {};
      const sites = language === 'ko' ? ['kowiki','enwiki'] : ['enwiki','kowiki'];
      const site = sites.find(item => sitelinks[item]?.title);
      if (site) return wikipediaUrlFromTitle(site === 'kowiki' ? 'ko' : 'en', sitelinks[site].title);
    } catch (_) {}
  }
  return await wikipediaExactTitleUrl(work, artist) || await wikipediaSearchTitleUrl(work, artist);
}
function cachedArtworkWikipediaUrl(work, artist) {
  const key = `${language}:${work?.id || selectionKey(work)}:${artist?.id || ''}:${artworkTitleAliases(work).join('|')}`;
  if (!artworkWikipediaLinkChecks.has(key)) {
    artworkWikipediaLinkChecks.set(key, resolveArtworkWikipediaUrl(work, artist).catch(() => ''));
  }
  return artworkWikipediaLinkChecks.get(key);
}
function artworkCollectionLabel(work) {
  const values = work?.detail?.facts?.collection || work?.collection || [];
  const entries = Array.isArray(values) ? values : [values];
  return entries.map(loc).filter(Boolean).join(', ') || t('unknown');
}
const currentCountryByHistoricalCountry = {
  'Kingdom of the Netherlands': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'}, '네덜란드 왕국': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'},
  'Dutch Republic': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'}, '네덜란드 공화국': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'},
  'Kingdom of Prussia': {ko:'독일', en:'Germany',colorKey:'Germany'}, '프로이센 왕국': {ko:'독일', en:'Germany',colorKey:'Germany'},
  'Russian Empire': {ko:'러시아', en:'Russia',colorKey:'Russia'}, '러시아 제국': {ko:'러시아', en:'Russia',colorKey:'Russia'},
  'Papal States': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '교황령': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Holy Roman Empire': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '신성 로마 제국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Republic of Florence': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '피렌체 공화국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Duchy of Milan': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '밀라노 공국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Duchy of Brabant': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '브라반트 공국': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Habsburg Netherlands': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '합스부르크 네덜란드': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Spanish Netherlands': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '스페인령 네덜란드': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Flanders': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '플랑드르': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Flemish': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '플랑드르(벨기에)': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Crown of Castile': {ko:'스페인', en:'Spain',colorKey:'Spain'}, '카스티야 연합왕국': {ko:'스페인', en:'Spain',colorKey:'Spain'}
};
const artistNationalityOverrides = {
  Q7803: {ko:'이탈리아', en:'Italy'},
  'artist-Q7803': {ko:'이탈리아', en:'Italy'}
};
const artistBirthCountryOverrides = {
  Q301: {ko:'그리스', en:'Greece'},
  'artist-Q301': {ko:'그리스', en:'Greece'}
};
