const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artists = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists.json'), 'utf8')).artists.map(artist => artist.id));
const movementDir = path.join(root, 'data', '미술사조');

let files = 0;
let links = 0;
let missingTargets = 0;
let externalImgs = 0;
let nestedAnchors = 0;
const missing = [];

function countNestedAnchors(html) {
  let depth = 0;
  let nested = 0;
  for (const match of html.matchAll(/<\/?a\b[^>]*>/gi)) {
    if (/^<\//.test(match[0])) {
      depth = Math.max(0, depth - 1);
    } else {
      if (depth > 0) nested += 1;
      depth += 1;
    }
  }
  return nested;
}

for (const name of fs.readdirSync(movementDir).filter(file => /\.html?$/i.test(file))) {
  files += 1;
  const html = fs.readFileSync(path.join(movementDir, name), 'utf8');
  links += (html.match(/class="art-atlas-artist-link"/g) || []).length;
  externalImgs += (html.match(/<img[^>]+src=["']https?:\/\//gi) || []).length;
  nestedAnchors += countNestedAnchors(html);
  for (const match of html.matchAll(/index\.html\?artist=([^"'&>]+)/g)) {
    const id = decodeURIComponent(match[1]);
    if (!artists.has(id)) {
      missingTargets += 1;
      missing.push({file: name, id});
    }
  }
}

console.log(JSON.stringify({files, links, missingTargets, externalImgs, nestedAnchors, missing}, null, 2));
process.exitCode = missingTargets || externalImgs || nestedAnchors ? 1 : 0;
