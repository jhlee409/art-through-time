const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const documentsDir = path.join(root, 'data', '미술사조');
const artists = JSON.parse(fs.readFileSync(path.join(root, 'data', 'artists.json'), 'utf8')).artists || [];
const write = process.argv.includes('--write');
const manualRegions = {
  '샤를 르브룅':'프랑스', 'Charles Le Brun':'프랑스',
  '자코모 바로치 다 비뇰라':'이탈리아', 'Giacomo Barozzi da Vignola':'이탈리아',
  '보로미니':'이탈리아', 'Francesco Borromini':'이탈리아'
};
const regionsByArtistId = new Map(artists.map(artist => [String(artist.id || ''), [...new Set(artist.regions || [])].filter(Boolean).join('·') || artist.nationality?.ko || '']));
const regionsByName = new Map(Object.entries(manualRegions));
for (const artist of artists) {
  const region = regionsByArtistId.get(String(artist.id || ''));
  for (const name of [artist.fullName, artist.name?.ko, artist.name?.en, ...(artist.aliases?.ko || []), ...(artist.aliases?.en || [])]) {
    if (name && region) regionsByName.set(String(name).trim(), region);
  }
}

function text(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/&(?:nbsp|amp);/gi, ' ').replace(/\s+/g, ' ').trim();
}

function regionFor(card, title) {
  const id = /\bdata-artist-id=["']([^"']+)["']/i.exec(card)?.[1] || '';
  if (regionsByArtistId.get(id)) return regionsByArtistId.get(id);
  const name = text(title).split(/,\s*《/)[0].trim();
  return regionsByName.get(name) || '';
}

function documentMovement(html) {
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || '';
  return text(heading.split(/<br\s*\/?>/i)[0]).split(/\s*(?:—|:|\|)\s*/)[0].trim();
}

function updateCard(card, movement, missing) {
  if (!/\bclass=["'][^"']*\b(?:movement-work-card|card)\b/i.test(card)) return card;
  return card.replace(/(<div\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-body|caption)\b[^"']*["'])[^>]*>[\s\S]*?<h3\b[^>]*>)([\s\S]*?)(<\/h3>)/i, (whole, open, title, close) => {
    const resolvedRegion = regionFor(card, title);
    const region = resolvedRegion || '확인 필요';
    if (!resolvedRegion) missing.push(text(title));
    const clean = title.replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-activity-region\b[^"']*["'])[^>]*>[\s\S]*?<\/span>\s*/gi, '')
      .replace(/(<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-title-tag\b[^"']*["'])[^>]*>\s*·\s*)르네상스인간과 현실의 세계를 다시 구축하다(<\/span>)/gi, '$1르네상스$2');
    const label = `<span class="movement-card-activity-region"> · ${region}</span>`;
    const updated = /movement-card-title-tag/.test(clean)
      ? clean.replace(/(<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-title-tag\b[^"']*["'])[^>]*>[\s\S]*?<\/span>)/i, `$1${label}`)
      : `${clean}<span class="movement-card-title-tag"> · ${movement || '사조 확인 필요'}</span>${label}`;
    return `${open}${updated}${close}`;
  });
}

const files = fs.readdirSync(documentsDir).filter(name => /^[a-f0-9]{24}-[12]\.html$/i.test(name));
const result = {files:files.length, changed:[], missing:[]};
for (const name of files) {
  const file = path.join(documentsDir, name);
  const before = fs.readFileSync(file, 'utf8');
  const missing = [];
  const movement = documentMovement(before);
  const after = before.replace(/<article\b[\s\S]*?<\/article>/gi, card => updateCard(card, movement, missing));
  if (before !== after) { result.changed.push(name); if (write) fs.writeFileSync(file, after, 'utf8'); }
  for (const title of missing) result.missing.push({file:name, title});
}
console.log(JSON.stringify({files:result.files, changed:result.changed, unresolvedCount:result.missing.length, unresolvedSample:result.missing.slice(0,12), wrote:write}, null, 2));
