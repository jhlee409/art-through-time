/* Persist the shared movement-document rules that the server also applies at render time. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'data', '미술사조');
const stickyStyle = '<style id="art-atlas-movement-sticky-title-style">nav .wrap{display:flex;align-items:center;justify-content:center}nav .art-atlas-movement-sticky-title{display:block;width:100%;color:inherit;font-family:inherit;font-size:2em;font-weight:inherit;letter-spacing:inherit;line-height:inherit;text-align:center}</style>';
const contextStyle = '<style id="art-atlas-movement-country-card-context-style">.movement-enhancement .art-atlas-submovement-heading{display:flex;flex-wrap:wrap;align-items:baseline;gap:.45rem}.movement-enhancement .movement-country-card-context{display:inline-flex;flex:1 1 20rem;flex-wrap:wrap;gap:.32rem .7rem;align-items:baseline;color:#aeb9c3;font-size:.912rem;font-weight:500;line-height:1.55}.movement-enhancement .movement-country-card-context b{color:#e6c98d;font-size:.92em;font-weight:800}.movement-enhancement .movement-country-card-context-region{white-space:nowrap}.movement-enhancement .movement-country-card-context-feature{min-width:12rem}</style>';

function plain(value = '') { return String(value).replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim(); }
function key(value = '') { return plain(value).replace(/\s+(?:공화국|왕국|제국)$/, '').replace(/\s+/g, ''); }
function escape(value = '') { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function contexts(source) {
  const countryBlock = source.match(/<section\b(?=[^>]*\bid=["']countries["'])[^>]*>([\s\S]*?)<\/section>/i)?.[1] || '';
  return [...countryBlock.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(row => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => plain(cell[1]));
    if (cells.length < 2) return [];
    const [country = '', region = ''] = cells[0].split(/\s*(?:—|–)\s*/, 2);
    return key(country) && cells[1] ? [{country, region, feature: cells[1], key: key(country)}] : [];
  });
}
function syncStickyTitle(source) {
  source = source.replace(/\s*<style\b[^>]*id=["']art-atlas-movement-sticky-title-style["'][^>]*>[\s\S]*?<\/style>\s*/gi, '\n');
  const title = plain(source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.split(/<br\s*\/?\s*>/i)[0] || '').split(/\s*(?:—|:)\s*/)[0];
  if (!title) return source;
  const nav = /<nav\b[^>]*>[\s\S]*?<\/nav>/i;
  if (nav.test(source)) source = source.replace(nav, `<nav aria-label="현재 사조"><div class="wrap"><span class="art-atlas-movement-sticky-title">${escape(title)}</span></div></nav>`);
  return /<\/head>/i.test(source) ? source.replace(/<\/head>/i, `${stickyStyle}\n</head>`) : `${stickyStyle}\n${source}`;
}
function syncCountryContexts(source) {
  source = source.replace(/\s*<style\b[^>]*id=["']art-atlas-movement-country-card-context-style["'][^>]*>[\s\S]*?<\/style>\s*/gi, '\n');
  const values = contexts(source);
  if (!values.length) return source;
  source = source.replace(/<section\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-group\b[^"']*["'])[^>]*>[\s\S]*?<\/section>/gi, group => {
    const name = group.match(/\bdata-art-atlas-submovement=["']([^"']+)["']/i)?.[1] || group.match(/<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '';
    const groupKey = key(name);
    const value = values.find(item => item.key === groupKey) || values.find(item => item.key.includes(groupKey) || groupKey.includes(item.key));
    if (!value) return group;
    return group.replace(/(<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/h3>)/i, (_, open, title, close) => {
      const clean = title.replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-country-card-context\b[^"']*["'])[^>]*>[\s\S]*?<\/span>\s*/gi, '');
      const region = value.region ? `<span class="movement-country-card-context-region">${escape(value.region)}</span>` : '';
      return `${open}${clean}<span class="movement-country-card-context">${region}<span class="movement-country-card-context-feature"><b>특징</b> ${escape(value.feature)}</span></span>${close}`;
    });
  });
  return /<\/head>/i.test(source) ? source.replace(/<\/head>/i, `${contextStyle}\n</head>`) : `${contextStyle}\n${source}`;
}

let changed = 0;
for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.html'))) {
  const file = path.join(directory, name);
  const source = fs.readFileSync(file, 'utf8');
  const revised = syncCountryContexts(syncStickyTitle(source));
  if (revised === source) continue;
  fs.writeFileSync(file, revised, 'utf8');
  changed++;
}
console.log(`Applied current shared movement HTML rules to ${changed} document(s).`);
