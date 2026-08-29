const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistId = 'artist-Q313898';
const workId = `${artistId}-representative-work`;
const source = path.join(root, '다운로드용', 'The_Swing_(P430).jpg');
const destination = path.join(root, 'data', 'images', artistId, `${workId}.jpg`);
const artistsFile = path.join(root, 'data', 'artists.json');

if (!fs.existsSync(source)) throw new Error(`Missing local image: ${source}`);
fs.mkdirSync(path.dirname(destination), {recursive: true});
fs.copyFileSync(source, destination);

const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = data.artists?.find(item => item.id === artistId);
const work = artist?.works?.find(item => item.id === workId);
if (!work) throw new Error('Fragonard The Swing was not found');
const localPath = path.relative(root, destination).replace(/\\/g, '/');
Object.assign(work, {
  image: localPath,
  thumbnail: localPath,
  highResImage: localPath,
  highResOriginal: localPath,
  source: 'local download import: The_Swing_(P430).jpg',
  verified: true,
  status: 'verified',
  origin: 'manual'
});
work.migration = {
  ...(work.migration || {}),
  schema: 1,
  image: {
    status: 'ready',
    localThumbnail: localPath,
    highResolution: localPath,
    sourceUrl: '',
    sourceUrls: [],
    license: '',
    institution: ''
  }
};
data.metadata = {...data.metadata, updatedAt: new Date().toISOString(), revision: (Number(data.metadata?.revision) || 0) + 1};
fs.writeFileSync(artistsFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Replaced ${workId} with ${localPath}`);
