const fs = require('node:fs');
const path = require('node:path');

const qid = process.argv[2];
if (!/^Q\d+$/.test(qid || '')) {
  console.error('Usage: node tools/merge-one-generated-artist.js QID');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const artistsPath = path.join(root, 'data', 'artists.json');
const generatedPath = path.join(root, 'data', 'generated', `qid-${qid}.json`);

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const workKey = work => {
  const title = normalized(work?.title?.en || work?.title?.ko);
  return title ? `${title}-${work?.year || ''}` : String(work?.id || '');
};
const workPopularity = work => Number.isFinite(Number(work?.popularity)) ? Number(work.popularity) : 0;

function mergeWorks(existingWorks = [], incomingWorks = []) {
  const byKey = new Map();
  [...existingWorks, ...incomingWorks].forEach(work => {
    const id = String(work?.id || '');
    const key = id || workKey(work);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? {
      ...existing,
      ...work,
      representative: typeof existing.representative === 'boolean' ? existing.representative : Boolean(work.representative),
      movementContribution: typeof existing.movementContribution === 'boolean' ? existing.movementContribution : Boolean(work.movementContribution),
      popularity: Math.max(workPopularity(existing), workPopularity(work))
    } : work);
  });
  return [...byKey.values()].sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
}

const generated = readJson(generatedPath);
if (generated.qid !== qid) throw new Error(`Generated file qid mismatch: expected ${qid}, got ${generated.qid}`);

const file = readJson(artistsPath);
const artists = Array.isArray(file.artists) ? file.artists : [];
const artistId = generated.artistId || `artist-${qid}`;
const index = artists.findIndex(artist => artist.qid === qid || artist.id === artistId);
const incoming = {
  id: artistId,
  qid,
  name: generated.artist?.name || {ko: '', en: ''},
  birth: generated.artist?.birth || null,
  death: generated.artist?.death || null,
  nationality: generated.artist?.nationality || {ko: '', en: ''},
  movement: generated.artist?.movement || null,
  aliases: generated.artist?.aliases || null,
  works: generated.works || [],
  generated: {schema: generated.schema, file: `data/generated/qid-${qid}.json`, fetchedAt: generated.fetchedAt}
};

if (index >= 0) {
  const existing = artists[index];
  artists[index] = {
    ...existing,
    qid: existing.qid || incoming.qid,
    name: incoming.name || existing.name,
    birth: incoming.birth || existing.birth,
    death: incoming.death || existing.death,
    nationality: incoming.nationality || existing.nationality,
    movement: incoming.movement || existing.movement,
    aliases: incoming.aliases || existing.aliases,
    generated: incoming.generated,
    works: mergeWorks(existing.works || [], incoming.works)
  };
}
else {
  artists.push(incoming);
}

writeJson(artistsPath, {...file, artists});
console.log(`${index >= 0 ? 'Updated' : 'Added'} ${artistId} with ${incoming.works.length} generated works`);
