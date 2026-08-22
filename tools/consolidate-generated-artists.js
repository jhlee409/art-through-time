const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const generatedDir = path.join(dataDir, 'generated');
const thumbnailsDir = path.join(dataDir, 'thumbnails');
const artistsPath = path.join(dataDir, 'artists.json');
const featuredPath = path.join(dataDir, 'featured-works.json');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const workKey = work => {
  const qid = String(work.id || '').match(/^wikidata-Q\d+/)?.[0];
  if (qid) return qid;
  const title = normalized(work.title?.en || work.title?.ko);
  return title ? `${title}-${work.year || ''}` : String(work.id || '');
};
const isGeneratedWork = work => /^(wikidata|wikipedia)-/.test(String(work.id || ''));
const workPopularity = work => Number.isFinite(Number(work.popularity)) ? Number(work.popularity) : 0;

function selectArtistWorks(works, limit = 60) {
  const byKey = new Map();
  (works || []).forEach(work => {
    const key = workKey(work);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? {...work, ...existing, representative:Boolean(existing.representative || work.representative), popularity:Math.max(workPopularity(existing), workPopularity(work))} : work);
  });
  const unique = [...byKey.values()];
  const manualRepresentatives = unique.filter(work => work.representative && !isGeneratedWork(work)).sort((a, b) => (a.year || 0) - (b.year || 0));
  const manualKeys = new Set(manualRepresentatives.map(workKey));
  const remaining = unique.filter(work => !manualKeys.has(workKey(work))).sort((a, b) => workPopularity(b) - workPopularity(a) || (a.year || 9999) - (b.year || 9999));
  const selected = [...manualRepresentatives.slice(0, limit), ...remaining.slice(0, Math.max(0, limit - manualRepresentatives.length))];
  const representativeKeys = new Set(manualRepresentatives.slice(0, limit).map(workKey));
  const target = Math.min(12, selected.length);
  selected.filter(work => !representativeKeys.has(workKey(work))).sort((a, b) => workPopularity(b) - workPopularity(a) || (a.year || 9999) - (b.year || 9999)).slice(0, Math.max(0, target - representativeKeys.size)).forEach(work => representativeKeys.add(workKey(work)));
  return selected.map(work => ({...work, representative:representativeKeys.has(workKey(work))})).sort((a, b) => (a.year || 0) - (b.year || 0));
}

function mergeWorks(existingWorks = [], incomingWorks = []) {
  const byId = new Map(existingWorks.map(work => [workKey(work), work]));
  incomingWorks.forEach(work => {
    const key = workKey(work);
    if (!key) return;
    if (byId.has(key)) byId.set(key, {...byId.get(key), ...work});
    else byId.set(key, work);
  });
  return selectArtistWorks([...byId.values()]);
}

function thumbnailCount(artistId) {
  const folder = path.join(thumbnailsDir, artistId || '');
  if (!artistId || !fs.existsSync(folder)) return 0;
  return fs.readdirSync(folder).filter(name => /\.(jpe?g|png|webp|gif)$/i.test(name)).length;
}

function hydrateThumbnails(artist) {
  const indexPath = path.join(thumbnailsDir, artist.id, 'index.json');
  if (!fs.existsSync(indexPath)) return artist;
  const index = readJson(indexPath);
  artist.works = (artist.works || []).map(work => index[work.id]?.thumbnail ? {...work, thumbnail:index[work.id].thumbnail, thumbnailValidation:2} : work);
  return artist;
}

const file = readJson(artistsPath);
const deletedArtistKeys = new Set(Array.isArray(file.deletedArtists) ? file.deletedArtists : []);
const artistDeleteKeys = artist => [`id:${artist?.id || ''}`, `qid:${artist?.qid || ''}`].filter(key => !key.endsWith(':'));
const isDeletedArtist = artist => artistDeleteKeys(artist).some(key => deletedArtistKeys.has(key));
const artists = (file.artists || []).filter(artist => !isDeletedArtist(artist));
const preferredByQid = new Map();

fs.readdirSync(generatedDir).filter(name => name.endsWith('.json')).forEach(name => {
  const generated = readJson(path.join(generatedDir, name));
  if (!generated.qid || !(generated.works || []).length) return;
  const candidate = {
    id: /^any-|^diagnostic-/.test(generated.artistId || '') ? `artist-${generated.qid}` : (generated.artistId || `artist-${generated.qid}`),
    qid: generated.qid,
    name: generated.artist?.name,
    birth: generated.artist?.birth || null,
    death: generated.artist?.death || null,
    nationality: generated.artist?.nationality || {ko:'', en:''},
    movement: generated.artist?.movement || null,
    aliases: generated.artist?.aliases || null,
    works: generated.works || [],
    generated: {schema:generated.schema, file:`data/generated/${name}`, fetchedAt:generated.fetchedAt}
  };
  if (isDeletedArtist(candidate)) return;
  const current = preferredByQid.get(candidate.qid);
  const currentScore = current ? ((current.generated?.schema >= 18 ? 100000 : 0) + current.works.length * 1000 + current.works.filter(work => work.popularity != null).length * 100 + thumbnailCount(current.id)) : -1;
  const candidateScore = (candidate.generated?.schema >= 18 ? 100000 : 0) + candidate.works.length * 1000 + candidate.works.filter(work => work.popularity != null).length * 100 + thumbnailCount(candidate.id);
  if (!current || candidateScore > currentScore) preferredByQid.set(candidate.qid, candidate);
});

const byQid = new Map(artists.filter(artist => artist.qid).map(artist => [artist.qid, artist]));

preferredByQid.forEach(candidate => {
  const existing = byQid.get(candidate.qid) || artists.find(artist => artist.id === candidate.id);
  if (existing) {
    existing.qid = existing.qid || candidate.qid;
    existing.name = existing.name || candidate.name;
    existing.birth = existing.birth || candidate.birth;
    existing.death = existing.death || candidate.death;
    existing.nationality = existing.nationality || candidate.nationality;
    existing.movement = existing.movement || candidate.movement;
    existing.aliases = existing.aliases || candidate.aliases;
    existing.generated = candidate.generated;
    existing.works = mergeWorks((existing.works || []).filter(work => !isGeneratedWork(work)), candidate.works);
    hydrateThumbnails(existing);
    return;
  }
  if (!candidate.name) return;
  hydrateThumbnails(candidate);
  candidate.works = selectArtistWorks(candidate.works || []);
  artists.push(candidate);
});

if (fs.existsSync(featuredPath)) {
  const featured = readJson(featuredPath);
  (featured.artists || []).forEach(entry => {
    if (isDeletedArtist(entry)) return;
    const artist = artists.find(item => item.id === entry.id || (entry.qid && item.qid === entry.qid));
    if (!artist) return;
    artist.works = mergeWorks(artist.works || [], entry.works || []);
  });
}

artists.forEach(artist => { artist.works = selectArtistWorks(artist.works || []); });

writeJson(artistsPath, {artists,deletedArtists:[...deletedArtistKeys].sort()});
console.log(`Consolidated ${artists.length} artists into data/artists.json`);
