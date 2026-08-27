const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexFile = path.join(root, 'data', '미술사조', 'index.json');

function text(value = '') {
  return String(value).replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function countryKey(value = '') {
  return text(value).replace(/\s+(?:공화국|왕국|제국)$/, '').replace(/\s+/g, '');
}
function elementEnd(source, start, tagName) {
  const tag = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tag.lastIndex = start;
  let depth = 0;
  for (let match; (match = tag.exec(source));) {
    if (match[0].startsWith('</')) {
      depth--;
      if (depth === 0) return tag.lastIndex;
    } else if (!/\/>$/.test(match[0])) depth++;
  }
  return -1;
}
function countryContexts(source) {
  const start = source.search(/<section\b[^>]*\bid=["']countries["'][^>]*>/i);
  if (start < 0) return [];
  const end = elementEnd(source, start, 'section');
  if (end < 0) return [];
  const contexts = [];
  for (const row of source.slice(start, end).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => text(cell[1]));
    if (cells.length < 2) continue;
    const [country = '', region = ''] = cells[0].split(/\s*(?:—|–)\s*/, 2);
    const key = countryKey(country);
    if (key && cells[1]) contexts.push({key, region: region.trim(), feature: cells[1]});
  }
  return contexts;
}
function documentTitle(source) {
  const heading = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  return text(heading).split(/\s*(?:—|:)\s*/)[0].trim();
}
function addHeadStyle(source, id, css) {
  const without = source.replace(new RegExp(`\\s*<style\\b[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`, 'gi'), '\n');
  const style = `<style id="${id}">${css}</style>`;
  return /<\/head>/i.test(without) ? without.replace(/<\/head>/i, `${style}\n</head>`) : `${style}\n${without}`;
}
function transform(source) {
  let next = source;
  const title = documentTitle(next);
  if (title && /<nav\b[^>]*>[\s\S]*?<\/nav>/i.test(next)) {
    next = next.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/i, `<nav aria-label="현재 사조"><div class="wrap"><span class="art-atlas-movement-sticky-title">${escapeHtml(title)}</span></div></nav>`);
  }
  next = addHeadStyle(next, 'art-atlas-movement-sticky-title-style', 'nav .wrap{display:flex;align-items:center}nav .art-atlas-movement-sticky-title{display:block;color:inherit;font:inherit;font-weight:inherit;letter-spacing:inherit;line-height:inherit}');
  const contexts = countryContexts(next);
  next = next.replace(/<section\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-group\b[^"']*["'])[^>]*>[\s\S]*?<\/section>/gi, group => {
    const name = text(group.match(/\bdata-art-atlas-submovement=["']([^"']+)["']/i)?.[1] || group.match(/<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
    const key = countryKey(name);
    const context = contexts.find(item => item.key === key) || contexts.find(item => item.key.includes(key) || key.includes(item.key));
    if (!context) return group;
    return group.replace(/(<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/h3>)/i, (_, open, heading, close) => {
      const clean = heading.replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-country-card-context\b[^"']*["'])[^>]*>[\s\S]*?<\/span>\s*/gi, '');
      const region = context.region ? `<span class="movement-country-card-context-region"><b>지역</b> ${escapeHtml(context.region)}</span>` : '';
      return `${open}${clean}<span class="movement-country-card-context">${region}<span class="movement-country-card-context-feature"><b>특징</b> ${escapeHtml(context.feature)}</span></span>${close}`;
    });
  });
  return addHeadStyle(next, 'art-atlas-movement-country-card-context-style', '.movement-enhancement .art-atlas-submovement-heading{display:flex;flex-wrap:wrap;align-items:baseline;gap:.45rem}.movement-enhancement .movement-country-card-context{display:inline-flex;flex:1 1 20rem;flex-wrap:wrap;gap:.32rem .7rem;align-items:baseline;color:#aeb9c3;font-size:.76rem;font-weight:500;line-height:1.55}.movement-enhancement .movement-country-card-context b{color:#e6c98d;font-size:.92em;font-weight:800}.movement-enhancement .movement-country-card-context-region{white-space:nowrap}.movement-enhancement .movement-country-card-context-feature{min-width:12rem}');
}

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const files = [...new Set(Object.values(index.documents || {}).flatMap(slots => Object.values(slots || {})))];
let changed = 0;
for (const relative of files) {
  const file = path.join(root, relative);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) continue;
  fs.writeFileSync(file, after, 'utf8');
  changed++;
}
console.log(`Updated ${changed}/${files.length} movement documents.`);
