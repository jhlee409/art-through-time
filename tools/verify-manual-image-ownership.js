const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const enforceFrom = new Date('2026-09-03T00:00:00.000Z');
const strict = process.argv.includes('--strict');
const verify = process.argv.includes('--verify');
const write = process.argv.includes('--write');

if (write && !verify) {
  throw new Error('--write requires --verify.');
}

const isLocalImage = work => [
  work?.localImage,
  work?.thumbnail,
  work?.image,
  work?.highResImage,
  work?.highResOriginal,
  work?.migration?.image?.localThumbnail,
  work?.migration?.image?.highResolution
].some(value => String(value || '').replace(/\\/g, '/').startsWith('data/images/'));

const qidFrom = value => String(value || '').match(/(?:^|[^A-Z0-9])(Q\d+)(?:$|[^A-Z0-9])/i)?.[1]?.toUpperCase() || '';
const isNewManualImage = work => {
  if (work?.origin !== 'manual' || !isLocalImage(work)) return false;
  const createdAt = new Date(work?.metadata?.createdAt || '');
  return Number.isFinite(createdAt.getTime()) && createdAt >= enforceFrom;
};

async function creatorsFor(workQid) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities', format: 'json', props: 'claims', ids: workQid
  }).toString();
  const response = await fetch(url, {headers: {'user-agent': 'ArtThroughTime-manual-image-audit/1.0'}});
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);
  const json = await response.json();
  return (json.entities?.[workQid]?.claims?.P170 || [])
    .map(claim => claim?.mainsnak?.datavalue?.value?.id)
    .filter(value => /^Q\d+$/.test(value || ''));
}

async function main() {
  const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
  const pending = [];
  const verified = [];
  const unmatched = [];
  const unverifiable = [];
  let changed = false;

  for (const artist of data.artists || []) {
    for (const work of artist.works || []) {
      if (!isNewManualImage(work)) continue;
      const record = {artistId: artist.id, workId: work.id};
      const ownership = work.imageOwnershipVerification || {};
      if (ownership.status === 'verified') {
        verified.push(record);
        continue;
      }
      if (!verify) {
        pending.push({...record, status: ownership.status || 'missing'});
        continue;
      }
      const artistQid = qidFrom(artist.qid || artist.id);
      const workQid = qidFrom(work.id) || qidFrom(work.source);
      if (!artistQid || !workQid) {
        unverifiable.push({...record, reason: 'artist or work QID missing'});
        continue;
      }
      const creators = await creatorsFor(workQid);
      if (!creators.includes(artistQid)) {
        unmatched.push({...record, artistQid, workQid, creators});
        continue;
      }
      work.imageOwnershipVerification = {
        status: 'verified',
        source: 'wikidata-P170',
        artistQid,
        sourceWorkId: work.id,
        verifiedAt: new Date().toISOString()
      };
      changed = true;
      verified.push(record);
    }
  }

  if (write && changed) fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  const issues = [...pending, ...unmatched, ...unverifiable];
  console.log(JSON.stringify({
    ok: !strict || issues.length === 0,
    enforceFrom: enforceFrom.toISOString(),
    checked: verified.length + issues.length,
    verified: verified.length,
    pending,
    unmatched,
    unverifiable,
    wrote: write && changed
  }, null, 2));
  if (strict && issues.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
