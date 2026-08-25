const fs = require('node:fs');
const path = require('node:path');
const { downloadDirectories, findLocalImage } = require('./local-image-sources');

const root = path.resolve(__dirname, '..');
const artists = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists.json'), 'utf8')).artists || [];
const pending = artists.flatMap(artist => (artist.works || [])
  .filter(work => work.imageUploadStatus === 'pending-upload')
  .map(work => ({artistId:artist.id, workId:work.id, title:work.title?.ko || work.title?.en || '', candidates:work.localImageCandidates || [], file:findLocalImage(work.localImageCandidates)})));

console.log(JSON.stringify({
  searchedDirectories:downloadDirectories(),
  pending:pending.map(({file, ...item}) => ({...item, status:file ? 'local-file-found' : 'pending-upload', file}))
}, null, 2));
