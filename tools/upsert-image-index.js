#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {root, normalizeLocalPath} = require('./image-catalog');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

const artistId = option('--artist-id');
const workId = option('--work-id');
const thumbnail = normalizeLocalPath(option('--path'));
const verifiedBy = option('--verified-by') || 'Matched from local artist and artwork metadata';
if (!artistId || !workId || !thumbnail) {
  console.error('Usage: node tools/upsert-image-index.js --artist-id ID --work-id ID --path data/images/... [--verified-by text]');
  process.exit(1);
}
const imageFile = path.resolve(root, thumbnail);
const expectedRoot = `${path.resolve(root, 'data', 'images')}${path.sep}`.toLowerCase();
if (!imageFile.toLowerCase().startsWith(expectedRoot) || !fs.existsSync(imageFile)) {
  throw new Error(`Image path is missing or outside data/images: ${thumbnail}`);
}
const indexFile = path.join(root, 'data', 'images', artistId, 'index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
index[workId] = {
  thumbnail,
  checkedAt: new Date().toISOString(),
  verifiedBy,
  imageHash: createHash('sha256').update(fs.readFileSync(imageFile)).digest('hex')
};
fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({artistId, workId, thumbnail, indexFile: path.relative(root, indexFile).replace(/\\/g, '/')}, null, 2));
