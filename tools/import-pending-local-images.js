const fs = require('node:fs');
const path = require('node:path');
const { findLocalImage } = require('./local-image-sources');
const {canonicalArtworkFilename} = require('./image-path-utils');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const maxBytes = 10 * 1024 * 1024;
const allowedExtensions = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif']);
const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const imported = [];
const pending = [];

for (const artist of data.artists || []) {
  for (const work of artist.works || []) {
    if (work.imageUploadStatus !== 'pending-upload') continue;
    const source = findLocalImage(work.localImageCandidates);
    if (!source) { pending.push({artistId:artist.id, workId:work.id, reason:'local file not found'}); continue; }
    const extension = path.extname(source).toLowerCase();
    const size = fs.statSync(source).size;
    if (!allowedExtensions.has(extension) || size > maxBytes) {
      pending.push({artistId:artist.id, workId:work.id, reason:!allowedExtensions.has(extension) ? 'unsupported image type' : 'image exceeds 10 MB', source});
      continue;
    }
    const destinationDir = path.join(root, 'data', 'images', artist.id);
    const destinationName = canonicalArtworkFilename(artist, work, extension);
    const destination = path.join(destinationDir, destinationName);
    fs.mkdirSync(destinationDir, {recursive:true});
    fs.copyFileSync(source, destination);
    const localPath = path.relative(root, destination).replace(/\\/g, '/');
    work.image = localPath;
    work.thumbnail = localPath;
    work.highResImage = localPath;
    work.imageUploadStatus = 'ready';
    work.localImageCandidates = [path.basename(source)];
    work.source = `local download import: ${path.basename(source)}`;
    imported.push({artistId:artist.id, workId:work.id, source, destination:localPath});
  }
}

if (imported.length) fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({imported, pending}, null, 2));
