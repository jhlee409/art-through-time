/* Persist the shared movement-document rules that the server also applies at render time. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'data', '미술사조');
const stickyStyle = '<style id="art-atlas-movement-sticky-title-style">nav .wrap{display:flex;align-items:center;justify-content:center}nav .art-atlas-movement-sticky-title{display:block;width:100%;color:inherit;font-family:inherit;font-size:2em;font-weight:inherit;letter-spacing:inherit;line-height:inherit;text-align:center}</style>';
const contextStyle = '<style id="art-atlas-movement-country-card-context-style">.movement-enhancement{--art-atlas-enhancement-edge-gutter:clamp(18px,3vw,26px)}.movement-enhancement>h3,.movement-enhancement>p.enhancement-intro,.movement-enhancement>.wrap>h3,.movement-enhancement>.wrap>p.enhancement-intro{width:calc(100vw - (var(--art-atlas-enhancement-edge-gutter)*2));max-width:none;margin-left:calc(50% - 50vw + var(--art-atlas-enhancement-edge-gutter));margin-right:calc(50% - 50vw + var(--art-atlas-enhancement-edge-gutter));box-sizing:border-box;text-align:left}.movement-enhancement .art-atlas-submovement-heading{display:flex;width:100vw;max-width:none;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);padding-left:var(--art-atlas-enhancement-edge-gutter);padding-right:2vw;box-sizing:border-box;flex-wrap:wrap;align-items:baseline;gap:.45rem;text-align:left}.movement-enhancement .art-atlas-submovement-title{display:block;flex:0 0 100%;width:100%;text-align:left}.movement-enhancement .movement-country-card-context{display:flex;flex:1 1 100%;width:100%;flex-wrap:wrap;gap:.32rem .7rem;align-items:baseline;color:#aeb9c3;font-size:.912rem;font-weight:500;line-height:1.55}.movement-enhancement .movement-country-card-context b{color:#e6c98d;font-size:.92em;font-weight:800}.movement-enhancement .movement-country-card-context-region{white-space:nowrap}.movement-enhancement .movement-country-card-context-feature{min-width:12rem}</style>';
const cardStyle = '<style id="art-atlas-movement-card-presentation-style">.movement-card-title-tag,.movement-card-activity-region{color:#9aa5af;font-size:.78em;font-weight:600;white-space:nowrap}.movement-card-heading-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:.45rem;margin:0 0 .85rem}.movement-card-heading-row h3{min-width:0;margin:0!important}.movement-card-heading-row .work-meta{margin:.08rem 0 0!important;text-align:right;white-space:nowrap}</style>';
const contentLayoutStyle = '<style id="art-atlas-movement-content-layout-style">body{--art-atlas-document-gutter:clamp(20px,3vw,48px)}header.hero>.wrap,main>section>.wrap{width:100%;max-width:none;margin-left:0;margin-right:0;padding-left:var(--art-atlas-document-gutter);padding-right:var(--art-atlas-document-gutter)}.hero p,.lead{max-width:none}main>section:not(#movement-learning-guide)>.wrap>h2,main>section:not(#movement-learning-guide)>h2{margin:0 0 1.15rem;font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.9rem,3.4vw,3.1rem);line-height:1.18}main>section:not(#movement-learning-guide)>.wrap>h3,main>section:not(#movement-learning-guide)>h3,.movement-enhancement .art-atlas-submovement-heading{font-size:clamp(1.3rem,2.25vw,1.75rem);line-height:1.32}.movement-enhancement .art-atlas-submovement-heading{margin-top:2.1rem;margin-bottom:.7rem}.movement-enhancement .art-atlas-submovement-heading+.movement-work-grid{margin-top:0}main>section:not(#movement-learning-guide)>.wrap>h4,main>section:not(#movement-learning-guide)>h4{font-size:1.12rem;line-height:1.42;margin:1.5rem 0 .5rem}main>section:not(#movement-learning-guide)>.wrap>p:not(.work-meta):not(.movement-selection-reason),main>section:not(#movement-learning-guide)>p:not(.work-meta):not(.movement-selection-reason){max-width:none;font-size:1.08rem;line-height:1.8}main>section:not(#movement-learning-guide)>.wrap>p:not(.work-meta):not(.movement-selection-reason)~p,main>section:not(#movement-learning-guide)>p:not(.work-meta):not(.movement-selection-reason)~p{font-size:1rem;line-height:1.75}.table-wrap,main>section>.wrap>table,main>section>table{width:100%;max-width:none}.table-wrap table,main>section>.wrap>table,main>section>table{width:100%}@media(max-width:720px){body{--art-atlas-document-gutter:18px}}</style>';

function plain(value = '') { return String(value).replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim(); }
function key(value = '') { return plain(value).replace(/\s+(?:공화국|왕국|제국)$/, '').replace(/\s+/g, ''); }
function escape(value = '') { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function attr(tag, name) { return new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(value => value !== undefined) || ''; }
function elementEnd(source, start, tagName) { const tags=new RegExp(`<\\/?${tagName}\\b[^>]*>`,'gi'); tags.lastIndex=start; let depth=0; for(let match;(match=tags.exec(source));){if(/^<\//.test(match[0]))depth--;else if(!/\/>$/.test(match[0]))depth++;if(depth===0)return tags.lastIndex;}return -1; }
function insertSharedStyle(source, style) { const guide=/<style\b[^>]*id=["']art-atlas-learning-guide-style["'][^>]*>/i; if(guide.test(source)) return source.replace(guide,`${style}$&`); return /<\/head>/i.test(source) ? source.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${source}`; }
function contexts(source) {
  const countryBlock = source.match(/<section\b(?=[^>]*\bid=["']countries["'])[^>]*>([\s\S]*?)<\/section>/i)?.[1] || '';
  return [...countryBlock.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(row => {
    const opening=row[0].match(/^<tr\b[^>]*>/i)?.[0] || '', cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => plain(cell[1]));
    if (cells.length < 2) return [];
    const [country = '', category = ''] = cells[0].split(/\s*(?:—|–)\s*/, 2);
    return key(country) && cells[1] ? [{country:country.trim(),category:category.trim(),feature:cells[1].replace(/^핵심 특징\s*/,'').trim(),countryKey:key(country),categoryKey:key(category),categoryId:attr(opening,'data-art-atlas-category-id'),developmentId:attr(opening,'data-art-atlas-development-id')}] : [];
  });
}
function syncStickyTitle(source) {
  source = source.replace(/\s*<style\b[^>]*id=["']art-atlas-movement-sticky-title-style["'][^>]*>[\s\S]*?<\/style>\s*/gi, '\n');
  const title = plain(source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.split(/<br\s*\/?\s*>/i)[0] || '').split(/\s*(?:—|:)\s*/)[0];
  if (!title) return source;
  const nav = /<nav\b[^>]*>[\s\S]*?<\/nav>/i;
  if (nav.test(source)) source = source.replace(nav, `<nav aria-label="현재 사조"><div class="wrap"><span class="art-atlas-movement-sticky-title">${escape(title)}</span></div></nav>`);
  return insertSharedStyle(source, stickyStyle);
}
function syncCountryContexts(source) {
  source = source.replace(/\s*<style\b[^>]*id=["']art-atlas-movement-country-card-context-style["'][^>]*>[\s\S]*?<\/style>\s*/gi, '\n');
  const values = contexts(source);
  if (!values.length) return source;
  source = source.replace(/<section\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-group\b[^"']*["'])[^>]*>[\s\S]*?<\/section>/gi, group => {
    const opening=group.match(/^<section\b[^>]*>/i)?.[0] || '', heading = group.match(/<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '';
    const existingTitle=heading.match(/<span\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-title\b)[^>]*>([\s\S]*?)<\/span>/i)?.[1] || heading.split(/<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-country-card-context\b)/i)[0];
    const name = group.match(/\bdata-art-atlas-submovement=["']([^"']+)["']/i)?.[1] || existingTitle;
    const groupKey = key(name);
    const value = values.find(item=>item.categoryId && item.categoryId===attr(opening,'data-art-atlas-category-id')) || values.find(item=>item.developmentId && item.developmentId===attr(opening,'data-art-atlas-development-id')) || values.find(item => item.categoryKey === groupKey) || values.find(item => item.countryKey === groupKey);
    if (!value) return group;
    return group.replace(/(<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/h3>)/i, (_, open, title, close) => {
      const region = value.country ? `<span class="movement-country-card-context-region">${escape(value.country)}</span>` : '';
      return `${open}<span class="art-atlas-submovement-title">${escape(value.category || plain(name))}</span><span class="movement-country-card-context">${region}<span class="movement-country-card-context-feature"><b>핵심 특징</b> ${escape(value.feature)}</span></span>${close}`;
    });
  });
  return insertSharedStyle(source, contextStyle);
}
function syncCardPresentation(source) {
  source = source.replace(/\s*<style\b[^>]*id=["']art-atlas-movement-card-presentation-style["'][^>]*>[\s\S]*?<\/style>\s*/gi, '\n');
  source = source.replace(/<article\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-card|card)\b[^"']*["'])[\s\S]*?<\/article>/gi, card => {
    const bodyOpen=/<div\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-body|caption)\b[^"']*["'])[^>]*>/i.exec(card);
    if(!bodyOpen) return card;
    const bodyEnd=elementEnd(card,bodyOpen.index,'div'), bodyStart=bodyOpen.index+bodyOpen[0].length, closeStart=bodyEnd-6;
    if(bodyEnd<0 || closeStart<bodyStart) return card;
    let body=card.slice(bodyStart,closeStart);
    while(/<div class="movement-card-heading-row">\s*<div class="movement-card-heading-row">/i.test(body)) body=body.replace(/<div class="movement-card-heading-row">\s*<div class="movement-card-heading-row">/gi,'<div class="movement-card-heading-row">').replace(/<\/div>\s*<\/div>(?=\s*<p\b(?=[^>]*\bclass=["'][^"']*\bmovement-selection-reason\b))/gi,'</div>');
    const headed = /\bmovement-card-heading-row\b/i.test(body) ? body : body.replace(/(<h3\b[^>]*>[\s\S]*?<\/h3>)\s*(<p\b(?=[^>]*\bclass=["'][^"']*\bwork-meta\b)[^>]*>[\s\S]*?<\/p>)/i, '<div class="movement-card-heading-row">$1$2</div>');
    const labelled = headed.replace(/<strong>\s*(선정 이유|더 볼 이유)\s*:?\s*<\/strong>/gi, '<strong>$1:</strong>');
    return card.slice(0,bodyStart)+labelled+card.slice(closeStart);
  });
  return insertSharedStyle(source, cardStyle);
}
function syncContentLayout(source) {
  source = source.replace(/\s*<style\b[^>]*id=["']art-atlas-movement-content-layout-style["'][^>]*>[\s\S]*?<\/style>\s*/gi, '\n');
  return insertSharedStyle(source, contentLayoutStyle);
}

let changed = 0;
for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.html'))) {
  const file = path.join(directory, name);
  const source = fs.readFileSync(file, 'utf8');
  const revised = syncContentLayout(syncCardPresentation(syncCountryContexts(syncStickyTitle(source))));
  if (revised === source) continue;
  fs.writeFileSync(file, revised, 'utf8');
  changed++;
}
console.log(`Applied current shared movement HTML rules to ${changed} document(s).`);
