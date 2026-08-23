const DATA_SCHEMA_VERSION = 1;
const LOCAL_ASSET_PREFIX = /^(?:data|contribution)\//;
const PLACEHOLDER_THUMBNAIL = 'data/thumbnails/_placeholder/artwork-placeholder.png';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function localized(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      ko:String(value.ko || ''),
      en:String(value.en || ''),
      ...(value.original ? {original:String(value.original)} : {}),
      ...(value.native ? {native:String(value.native)} : {}),
      ...(value.originalTitle ? {originalTitle:String(value.originalTitle)} : {}),
      ...(value.nativeTitle ? {nativeTitle:String(value.nativeTitle)} : {}),
      ...(value.sourceTitle ? {sourceTitle:String(value.sourceTitle)} : {})
    };
  }
  const text = String(value || '');
  return {ko:text, en:text};
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function timestamp(value, fallback) {
  return isIsoDate(value) ? value : fallback;
}

function urls(...values) {
  const flattened = values.flatMap(value => Array.isArray(value) ? value : [value]);
  return [...new Set(flattened.map(value => String(value || '').trim()).filter(value => /^https?:\/\//i.test(value)))];
}

function textList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim().replace(/\s+/g, ' ')).filter(Boolean))];
}

function localizedTextList(value) {
  if (Array.isArray(value)) return {ko:textList(value), en:[]};
  const object = asObject(value);
  return {ko:textList(object.ko), en:textList(object.en)};
}

function localizedSummaryList(value) {
  const summary = localizedTextList(value);
  return {
    ko:summary.ko.slice(0, 6),
    en:summary.en.slice(0, 6)
  };
}

const artistNationalityOverrides = {
  Q7803: {ko:'이탈리아', en:'Italy'},
  'artist-Q7803': {ko:'이탈리아', en:'Italy'}
};

function artistNationalityOverride(artist) {
  const value = asObject(artist);
  return artistNationalityOverrides[String(value.qid || '')] || artistNationalityOverrides[String(value.id || '')] || null;
}

function localAsset(value) {
  const text = String(value || '');
  return LOCAL_ASSET_PREFIX.test(text) ? text : '';
}

function imageStatus(work) {
  if (localAsset(work.highResImage) || (localAsset(work.thumbnail) && work.thumbnail !== PLACEHOLDER_THUMBNAIL)) return 'ready';
  if (String(work.image || work.offlineThumbnailSource || '').trim()) return 'pending';
  return 'missing';
}

function recordMetadata(record, fallbackDate, actor, touch, updateDate = fallbackDate) {
  const existing = asObject(record.metadata);
  const createdAt = timestamp(existing.createdAt, fallbackDate);
  return {
    createdAt,
    updatedAt: touch ? updateDate : timestamp(existing.updatedAt, createdAt),
    createdBy: normalizedEmail(existing.createdBy) || normalizedEmail(actor) || 'legacy-import',
    updatedBy: touch ? (normalizedEmail(actor) || normalizedEmail(existing.updatedBy) || 'legacy-import') : (normalizedEmail(existing.updatedBy) || normalizedEmail(actor) || 'legacy-import')
  };
}

function normalizeWork(work, artist, options) {
  const value = asObject(work);
  const migration = asObject(value.migration);
  const oldImage = asObject(migration.image);
  const sourceUrls = urls(value.source, value.image, value.offlineThumbnailSource, value.detail?.sources, oldImage.sourceUrls, oldImage.sourceUrl);
  const sourceDate = value.detail?.fetchedAt || artist.generated?.fetchedAt || artist.metadata?.createdAt || options.now;
  const localThumbnail = localAsset(value.thumbnail);
  const highResolution = localAsset(value.highResImage);
  const status = imageStatus(value);
  return {
    ...value,
    title: localized(value.title),
    country: localized(value.country),
    movement: localized(value.movement),
    description: localized(value.description),
    metadata: recordMetadata(value, timestamp(sourceDate, options.now), options.actor, options.touch, options.now),
    migration: {
      ...migration,
      schema: DATA_SCHEMA_VERSION,
      image: {
        ...oldImage,
        status,
        localThumbnail: localThumbnail && localThumbnail !== PLACEHOLDER_THUMBNAIL ? localThumbnail : '',
        highResolution,
        sourceUrl: sourceUrls[0] || '',
        sourceUrls,
        license: String(oldImage.license || ''),
        institution: String(oldImage.institution || '')
      }
    }
  };
}

function normalizeArtist(artist, options) {
  const value = asObject(artist);
  const sourceDate = value.generated?.fetchedAt || value.metadata?.createdAt || options.now;
  const normalized = {
    ...value,
    name: localized(value.name),
    aliases: localizedTextList(value.aliases),
    artistSummary: localizedSummaryList(value.artistSummary),
    nationality: localized(artistNationalityOverride(value) || value.nationality),
    metadata: recordMetadata(value, timestamp(sourceDate, options.now), options.actor, options.touch, options.now)
  };
  normalized.works = (Array.isArray(value.works) ? value.works : []).map(work => normalizeWork(work, normalized, options));
  return normalized;
}

function normalizeArtistsPayload(payload, options = {}) {
  const value = asObject(payload);
  const now = timestamp(options.now, new Date().toISOString());
  const actor = normalizedEmail(options.actor || value.changeMeta?.actor);
  const normalized = {
    ...value,
    dataSchema: DATA_SCHEMA_VERSION,
    metadata: recordMetadata(value, timestamp(value.metadata?.createdAt, now), actor, Boolean(options.touch), now),
    artists: (Array.isArray(value.artists) ? value.artists : []).map(artist => normalizeArtist(artist, {now, actor, touch:Boolean(options.touch)})),
    deletedArtists: Array.isArray(value.deletedArtists) ? [...new Set(value.deletedArtists.map(value => String(value || '')).filter(Boolean))] : [],
    historicalEvents: Array.isArray(value.historicalEvents) ? value.historicalEvents : [],
    favoriteWorks: Array.isArray(value.favoriteWorks) ? [...new Set(value.favoriteWorks.map(value => String(value || '')).filter(Boolean))] : []
  };
  delete normalized.changeMeta;
  return normalized;
}

function validateArtistsPayload(payload) {
  const errors = [];
  const warnings = [];
  const artistIds = new Set();
  const stats = {artists:0, works:0, images:{ready:0, pending:0, missing:0}, assetsWithoutSource:0};
  if (!payload || !Array.isArray(payload.artists)) return {valid:false, errors:['artists must be an array'], warnings, stats};
  payload.artists.forEach((artist, artistIndex) => {
    stats.artists++;
    const artistId = String(artist?.id || '');
    if (!artistId) errors.push(`artist at index ${artistIndex} has no stable id`);
    else if (artistIds.has(artistId)) errors.push(`duplicate artist id: ${artistId}`);
    else artistIds.add(artistId);
    const workIds = new Set();
    (artist?.works || []).forEach((work, workIndex) => {
      stats.works++;
      const workId = String(work?.id || '');
      if (!workId) errors.push(`work at ${artistId || artistIndex}:${workIndex} has no stable id`);
      else if (workIds.has(workId)) errors.push(`duplicate work id: ${artistId}:${workId}`);
      else workIds.add(workId);
      const status = imageStatus(work || {});
      stats.images[status]++;
      if (!urls(work?.source, work?.image, work?.detail?.sources).length) {
        stats.assetsWithoutSource++;
        warnings.push(`work has no source URL: ${artistId}:${workId || workIndex}`);
      }
    });
  });
  return {valid:errors.length === 0, errors, warnings, stats};
}

function firebaseExport(payload, movements, accessControl, assets, exportedAt = new Date().toISOString()) {
  const artists = (payload.artists || []).map(artist => {
    const {works, ...artistDocument} = artist;
    return {...artistDocument, workCount:(works || []).length};
  });
  const artworks = (payload.artists || []).flatMap(artist => (artist.works || []).map(work => ({
    ...work,
    artistId: artist.id,
    artistQid: artist.qid || '',
    artistName: artist.name || {ko:'', en:''}
  })));
  return {
    exportSchema: 1,
    exportedAt,
    source: {application:'Art Through Time', dataSchema:payload.dataSchema || DATA_SCHEMA_VERSION},
    firestore: {collections:{artists, artworks, movements:movements?.countries || []}},
    storage: {assets:Array.isArray(assets) ? assets : []},
    accessControl: accessControl || {schema:1, roles:{}, defaultRole:'contributor'}
  };
}

module.exports = {DATA_SCHEMA_VERSION, imageStatus, normalizeArtistsPayload, validateArtistsPayload, firebaseExport};
