const fs = require('node:fs');
const path = require('node:path');
const { buildArtistMap } = require('./build-uhangul-artist-map');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const movementDir = path.join(root, 'data', '미술사조');

function htmlEscape(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function attrValue(attributes, name) {
  const match = attributes.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : '';
}

function setAttr(attributes, name, value) {
  const escaped = htmlEscape(value);
  const pattern = new RegExp(`\\s${name}="[^"]*"`);
  if (pattern.test(attributes)) return attributes.replace(pattern, ` ${name}="${escaped}"`);
  return `${attributes} ${name}="${escaped}"`;
}

function artistKeys(artist) {
  return [
    artist.id,
    artist.qid,
    artist.qid ? `artist-${artist.qid}` : ''
  ].filter(Boolean).map(String);
}

function syncHtml(html, artistsById, recordsById) {
  let changed = 0;
  const next = html.replace(/<a\b([^>]*\bart-atlas-artist-link\b[^>]*)>([\s\S]*?)<\/a>/g, (match, attributes) => {
    const artistId = attrValue(attributes, 'data-artist-id');
    const artist = artistsById.get(artistId);
    if (!artist) return match;
    const record = recordsById.get(String(artist.qid || artist.id)) || recordsById.get(String(artist.id));
    const standardKorean = record?.korean || artist.name?.ko || '';
    const original = record?.original || artist.name?.en || '';
    const uhangulDisplay = record?.displayKorean || standardKorean;
    const listKorean = record?.listKorean || artist.listName?.ko || standardKorean;
    if (!listKorean) return match;
    let nextAttributes = attributes;
    nextAttributes = setAttr(nextAttributes, 'data-uh-original', original);
    nextAttributes = setAttr(nextAttributes, 'data-uh-korean', standardKorean);
    nextAttributes = setAttr(nextAttributes, 'data-uh-display-korean', uhangulDisplay);
    nextAttributes = setAttr(nextAttributes, 'data-uh-list-korean', listKorean);
    nextAttributes = setAttr(nextAttributes, 'title', `${standardKorean} 연표로 이동`);
    changed += 1;
    return `<a${nextAttributes}>${htmlEscape(listKorean)}</a>`;
  });
  return {html: next, changed};
}

function main() {
  const payload = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
  const artists = payload.artists || [];
  const records = buildArtistMap(artists);
  const artistsById = new Map();
  for (const artist of artists) for (const key of artistKeys(artist)) artistsById.set(key, artist);
  const recordsById = new Map(records.map(record => [String(record.id), record]));
  let files = 0;
  let links = 0;
  for (const entry of fs.readdirSync(movementDir, {withFileTypes: true})) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.html') continue;
    const file = path.join(movementDir, entry.name);
    const html = fs.readFileSync(file, 'utf8');
    const result = syncHtml(html, artistsById, recordsById);
    if (result.html !== html) {
      fs.writeFileSync(file, result.html, 'utf8');
      files += 1;
    }
    links += result.changed;
  }
  console.log(JSON.stringify({files, links}, null, 2));
}

if (require.main === module) main();

module.exports = {syncHtml};
