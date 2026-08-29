#!/usr/bin/env node
const {catalogFile, readJson, searchCatalog} = require('./image-catalog');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

const knownOptions = new Set(['--artist', '--title', '--work-id', '--qid', '--sha256']);
const positional = process.argv.slice(2).filter((value, index, values) => {
  if (value.startsWith('--')) return false;
  return index === 0 || !knownOptions.has(values[index - 1]);
});
const criteria = {
  query: positional.join(' '),
  artist: option('--artist'),
  title: option('--title'),
  workId: option('--work-id'),
  qid: option('--qid'),
  sha256: option('--sha256')
};
if (!Object.values(criteria).some(Boolean)) {
  console.error('Usage: node tools/find-artwork-image.js [query] [--artist name] [--title title] [--work-id id] [--qid Q123] [--sha256 hash]');
  process.exit(1);
}
const catalog = readJson(catalogFile);
if (!catalog) throw new Error('Run node tools/build-image-catalog.js --bootstrap first.');
const results = searchCatalog(catalog, criteria).slice(0, 30).map(item => ({
  score: item.score,
  path: item.image.path,
  bytes: item.image.bytes,
  sha256: item.image.sha256,
  namingStatus: item.image.namingStatus,
  artist: item.work?.artistNameKo || item.work?.artistNameEn || '',
  workId: item.work?.workId || '',
  title: item.work?.titleKo || item.work?.titleEn || '',
  year: item.work?.year ?? null,
  aliases: item.image.aliases || []
}));
console.log(JSON.stringify({criteria, count: results.length, results}, null, 2));
