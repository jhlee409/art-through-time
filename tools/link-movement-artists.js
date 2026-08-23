const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistsFile = path.join(root, 'data', 'artists.json');
const movementDir = path.join(root, 'data', '미술사조');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}

function compactArtistName(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function aliasOverrides(artist) {
  const aliases = {
    Q5582:['반 고흐', '고흐', 'Van Gogh'],
    Q296:['모네', 'Monet'],
    Q5588:['칼로', 'Kahlo'],
    Q104884:['카스파르 다비트 프리드리히', '카스파르 다비드 프리드리히', '카스파 다비트 프리드리히', 'Caspar Friedrich'],
    Q6394591:['푸키레프', 'Pukirev', 'Pukiryov'],
    Q40599:['마네', 'Manet'],
    Q762:['레오나르도', '다 빈치', 'Leonardo'],
    Q42207:['카라바조', 'Caravaggio'],
    Q5592:['미켈란젤로', 'Michelangelo'],
    Q43270:['피터르 브뤼헐', '브뤼헐', 'Pieter Bruegel', 'Pieter Brueghel', 'Bruegel', 'Brueghel'],
    Q213163:['비제 르 브룅', '비제르브룅', 'Vigée Le Brun', 'Vigee Le Brun'],
    Q5599:['루벤스', 'Rubens'],
    Q47551:['티치아노', '티치아노 베첼리오', 'Tiziano', 'Tiziano Vecellio', 'Titian'],
    Q9440:['베로네세', '파올로 베로네세', 'Paolo Veronese', 'Veronese'],
    Q187310:['라르손', 'Larsson'],
    Q82445:['툴루즈로트레크', '툴루즈 로트레크', 'Toulouse-Lautrec', 'Toulouse Lautrec'],
    Q301:['엘 그레코', '엘그레코', 'El Greco'],
    Q41264:['페르메이르', 'Vermeer'],
    Q5597:['라파엘로', 'Raphael']
  };
  return aliases[artist?.qid] || [];
}

function artistAliases(artist) {
  return [...new Set([artist?.name?.ko, artist?.name?.en, ...aliasOverrides(artist)]
    .map(compactArtistName)
    .filter(name => name.length >= 2))];
}

async function linkEntries() {
  const data = JSON.parse(await fs.readFile(artistsFile, 'utf8'));
  const entries = [];
  for (const artist of data.artists || []) {
    for (const alias of artistAliases(artist)) entries.push({
      alias,
      id: artist.id,
      name: artist.name?.ko || artist.name?.en || alias,
      korean: artist.name?.ko || '',
      original: artist.name?.en || ''
    });
  }
  return entries.sort((a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias, 'ko'));
}

const styleId = 'art-atlas-artist-link-style';
const linkStyle = `.art-atlas-artist-link{font-weight:900;color:#191007!important;background:linear-gradient(180deg,rgba(255,232,151,.98),rgba(255,198,86,.9));border-bottom:2px solid #a96f12;border-radius:.22em;padding:0 .16em;text-decoration:none!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}.art-atlas-artist-link:hover{filter:brightness(1.08);box-shadow:0 0 0 2px rgba(255,214,102,.24)}`;

function injectStyle(html) {
  if (new RegExp(`id=["']${styleId}["']`, 'i').test(html)) return html;
  const style = `<style id="${styleId}">\n${linkStyle}\n</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}\n</head>`) : `${style}\n${html}`;
}

function stripAutoLinks(html) {
  return String(html || '')
    .replace(/\n?<style\b[^>]*id=["']art-atlas-artist-link-style["'][^>]*>[\s\S]*?<\/style>\n?/gi, '\n')
    .replace(/<a\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-artist-link\b)[^>]*>([\s\S]*?)<\/a>/gi, '$1');
}

function isProtectedChunk(part) {
  return /^<(script|style|title|a|pre|code|textarea)\b/i.test(part) || /^<[^>]+>$/.test(part);
}

function linkHtml(html, entries) {
  html = stripAutoLinks(html);
  const byAlias = new Map(entries.map(entry => [entry.alias.normalize('NFC').toLocaleLowerCase('ko-KR'), entry]));
  const particles = '은는이가을를의와과에도로';
  const artistPattern = new RegExp(`(?<![A-Za-z0-9가-힣])(${entries.map(entry => escapeRegex(entry.alias)).join('|')})([${particles}]?)(?=$|[^A-Za-z0-9가-힣])`, 'gu');
  const splitPattern = /(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<title\b[\s\S]*?<\/title>|<a\b[\s\S]*?<\/a>|<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>|<textarea\b[\s\S]*?<\/textarea>|<[^>]+>)/gi;
  const linked = html.split(splitPattern).map(part => {
    if (!part || isProtectedChunk(part)) return part;
    return part.replace(artistPattern, (match, name, particle = '') => {
      const entry = byAlias.get(name.normalize('NFC').toLocaleLowerCase('ko-KR'));
      if (!entry) return match;
      return `<a class="art-atlas-artist-link" href="../../index.html?artist=${encodeURIComponent(entry.id)}" target="_blank" rel="noopener" data-artist-id="${escapeAttribute(entry.id)}" data-uh-original="${escapeAttribute(entry.original)}" data-uh-korean="${escapeAttribute(entry.korean)}" data-uh-display-korean="${escapeAttribute(name)}" title="${escapeAttribute(entry.name)} 연표로 이동">${name}</a>${particle}`;
    });
  }).join('');
  return injectStyle(linked);
}

async function main() {
  const entries = await linkEntries();
  const files = (await fs.readdir(movementDir)).filter(name => /\.html?$/i.test(name));
  let changed = 0;
  let totalLinks = 0;
  for (const name of files) {
    const file = path.join(movementDir, name);
    const before = await fs.readFile(file, 'utf8');
    const after = linkHtml(before, entries);
    if (after !== before) {
      await fs.writeFile(file, after, 'utf8');
      changed += 1;
    }
    totalLinks += (after.match(/class="art-atlas-artist-link"/g) || []).length;
  }
  console.log(JSON.stringify({files: files.length, changed, totalLinks}, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
