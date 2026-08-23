const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const payload = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artists = Array.isArray(payload) ? payload : payload.artists;

if (!Array.isArray(artists)) {
  throw new Error('data/artists.json does not contain an artists array.');
}

const yearFixes = new Map(Object.entries({
  'wikidata-Q3889198': 1428,
  'wikidata-Q3948886': 1426,
  'wikidata-Q111244447': 1426,
  'wikidata-Q3705918': 1427,
  'wikidata-Q123528970': 1425,
  'wikipedia-Q5592-0': 1491,
  'wikipedia-Q5592-4': 1495,
  'wikipedia-Q5592-5': 1497,
  'wikipedia-Q5592-8': 1511,
  'wikipedia-Q5592-11': 1509,
  'wikipedia-Q5592-12': 1492,
  'wikipedia-Q5592-13': 1542,
  'wikipedia-Q5592-14': 1541,
  'wikipedia-Q5592-15': 1550,
  'wikidata-Q2182509': 1521,
  'wikidata-Q126127672': 1590,
  'wikidata-Q102852946': 1602,
  'wikidata-Q1212269': 1867,
  'wikidata-Q19883438': 1891
}));

const stats = {
  addedArtistSummary: 0,
  fixedPrimaticcioMovement: 0,
  fixedCaravaggioMovementKo: 0,
  fixedYears: 0
};

for (const artist of artists) {
  if (!artist.artistSummary || typeof artist.artistSummary !== 'object' || Array.isArray(artist.artistSummary)) {
    artist.artistSummary = {ko: [], en: []};
    stats.addedArtistSummary++;
  } else {
    if (!Array.isArray(artist.artistSummary.ko)) artist.artistSummary.ko = [];
    if (!Array.isArray(artist.artistSummary.en)) artist.artistSummary.en = [];
  }

  if (artist.id === 'artist-Q9645' || artist.qid === 'Q9645' || artist.name?.ko === '프란체스코 프리마티초') {
    if (artist.movement?.ko !== '매너리즘') {
      artist.movement = {...(artist.movement || {}), ko: '매너리즘'};
      stats.fixedPrimaticcioMovement++;
    }
  }

  for (const work of artist.works || []) {
    if (yearFixes.has(work.id) && work.year !== yearFixes.get(work.id)) {
      work.year = yearFixes.get(work.id);
      stats.fixedYears++;
    }

    if (artist.name?.ko === '카라바조' && work.movement?.ko === 'Italian Baroque painting') {
      work.movement.ko = '이탈리아 바로크 회화';
      stats.fixedCaravaggioMovementKo++;
    }
  }
}

fs.writeFileSync(artistsFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(stats, null, 2));
