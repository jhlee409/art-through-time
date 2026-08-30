#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {writeArtistIndex} = require('./build-artist-index');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const baselineCommit = '9882348';
const artistId = 'claude-monet';
const workIds = [
  'wikidata-Q105099581',
  'wikidata-Q105099586',
  'wikidata-Q105099589',
  'wikidata-Q105099590',
  'wikidata-Q105099598',
  'wikidata-Q105099599',
  'wikidata-Q105099603',
  'wikidata-Q105099607',
  'wikidata-Q135087938',
  'wikidata-Q1650049',
  'wikidata-Q17002537',
  'wikidata-Q17491886',
  'wikidata-Q19564337',
  'wikidata-Q19912578',
  'wikidata-Q19914267',
  'wikidata-Q20890879',
  'wikidata-Q21712160',
  'wikidata-Q24046494',
  'wikidata-Q24058801',
  'wikidata-Q27665416',
  'wikidata-Q6082483',
  'wikidata-Q64174089',
  'wikidata-Q829572'
];
const titleOverrides = {
  'wikidata-Q105099581': {ko: '붓꽃', en: 'Iris'},
  'wikidata-Q105099586': {ko: '노란색과 연보라색 붓꽃', en: 'Yellow and Mauve Irises'},
  'wikidata-Q135087938': {ko: '붓꽃들', en: 'The Irises'}
};

const payload = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const baselinePayload = JSON.parse(execFileSync('git', ['show', `${baselineCommit}:data/artists.json`], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
}));
const artist = (payload.artists || []).find(item => item.id === artistId);
const baselineArtist = (baselinePayload.artists || []).find(item => item.id === artistId);
if (!artist || !baselineArtist) throw new Error(`Could not find ${artistId} in current data and baseline ${baselineCommit}`);

const currentIds = new Set((artist.works || []).map(work => work.id));
const currentById = new Map((artist.works || []).map(work => [work.id, work]));
const baselineById = new Map((baselineArtist.works || []).map(work => [work.id, work]));
const imageDirectory = path.join(root, 'data', 'images', artistId);
const imageFilenames = fs.readdirSync(imageDirectory);
const restored = [];
let relinked = 0;
for (const workId of workIds) {
  let work = currentById.get(workId);
  if (!work) {
    const baselineWork = baselineById.get(workId);
    if (!baselineWork) throw new Error(`Baseline work is missing: ${workId}`);
    work = structuredClone(baselineWork);
    restored.push(work);
    currentIds.add(workId);
    currentById.set(workId, work);
  }
  const expectedFilename = `${workId}.jpg`;
  const actualFilename = imageFilenames.find(filename => filename.toLowerCase() === expectedFilename.toLowerCase());
  if (!actualFilename) throw new Error(`Local artwork file is missing: data/images/${artistId}/${expectedFilename}`);
  const localPath = `data/images/${artistId}/${actualFilename}`;
  if ([work.image, work.thumbnail, work.highResImage, work.highResOriginal].some(value => value && value !== localPath)) relinked++;
  if (titleOverrides[workId]) work.title = titleOverrides[workId];
  work.image = localPath;
  work.thumbnail = localPath;
  work.highResImage = localPath;
  work.highResOriginal = localPath;
  work.imageUploadStatus = 'ready';
  work.thumbnailValidation = 2;
  work.migration = {
    ...(work.migration || {}),
    schema: 1,
    image: {
      ...(work.migration?.image || {}),
      status: 'ready',
      localThumbnail: localPath,
      highResolution: localPath
    }
  };
}

artist.works = [...(artist.works || []), ...restored].sort((left, right) => {
  const leftYear = Number(left.year) || Number.POSITIVE_INFINITY;
  const rightYear = Number(right.year) || Number.POSITIVE_INFINITY;
  return leftYear - rightYear || String(left.id).localeCompare(String(right.id));
});

fs.writeFileSync(artistsFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
writeArtistIndex(payload)
  .then(() => console.log(JSON.stringify({ok: true, artistId, restored: restored.length, relinked, works: artist.works.length}, null, 2)))
  .catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
