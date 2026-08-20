const fs = require('node:fs/promises');
const path = require('node:path');
const {imageDimensions, invalidArtworkThumbnail} = require('../thumbnail-validation');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const placeholder = 'data/thumbnails/_placeholder/artwork-placeholder.png';
const artistId = process.argv.find(value => value.startsWith('--artist='))?.slice('--artist='.length);

async function main() {
  const data = JSON.parse(await fs.readFile(artistsFile, 'utf8'));
  const artists = artistId ? data.artists.filter(artist => artist.id === artistId) : data.artists;
  if (!artists.length) throw new Error(`No matching artist: ${artistId || 'all'}`);
  const repaired = [];
  for (const artist of artists) {
    const indexFile = path.join(root, 'data', 'thumbnails', artist.id, 'index.json');
    let index = {};
    try { index = JSON.parse(await fs.readFile(indexFile, 'utf8')); } catch (_) { continue; }
    let changed = false;
    for (const work of artist.works || []) {
      const stored = index[work.id]?.thumbnail || work.thumbnail;
      if (stored === placeholder && index[work.id]?.invalidReason === 'thumbnail-is-small-interface-icon') {
        if (work.thumbnail !== placeholder || work.thumbnailInvalidReason !== index[work.id].invalidReason || work.thumbnailValidation !== 0) {
          work.thumbnail = placeholder;
          work.thumbnailInvalidReason = index[work.id].invalidReason;
          work.thumbnailValidation = 0;
          changed = true;
        }
        continue;
      }
      if (!stored || !/^data\//.test(stored) || stored === placeholder) continue;
      let buffer;
      try { buffer = await fs.readFile(path.join(root, stored)); } catch (_) { continue; }
      if (!invalidArtworkThumbnail(buffer)) {
        if (work.thumbnail !== stored || work.thumbnailValidation !== 2 || work.thumbnailInvalidReason) {
          work.thumbnail = stored;
          work.thumbnailValidation = 2;
          delete work.thumbnailInvalidReason;
          changed = true;
        }
        continue;
      }
      const dimensions = imageDimensions(buffer);
      index[work.id] = {...(index[work.id] || {}), thumbnail:placeholder, checkedAt:new Date().toISOString(), verifiedBy:'Rejected local interface icon', invalidReason:'thumbnail-is-small-interface-icon'};
      work.thumbnail = placeholder;
      work.thumbnailValidation = 0;
      work.thumbnailInvalidReason = 'thumbnail-is-small-interface-icon';
      repaired.push({artistId:artist.id, workId:work.id, title:work.title?.ko || work.title?.en || '', dimensions, bytes:buffer.length});
      changed = true;
    }
    if (changed) await fs.writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  }
  if (repaired.length) await fs.writeFile(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({checkedArtists:artists.length, repaired}, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
