const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const movementDir = path.join(root, 'data', '미술사조');
const cardStyle = '.movement-card-title-tag{color:#9aa5af;font-size:.78em;font-weight:600;white-space:nowrap}.movement-card-artist-name{white-space:nowrap}';

const files = fs.readdirSync(movementDir).filter(name => /\.html?$/i.test(name));
let changedFiles = 0;
let linkStyles = 0;
let cardStyles = 0;
let wrappedNames = 0;

function updateArtistLinkStyle(html) {
  return html.replace(/\.art-atlas-artist-link\{([^}]*)\}/g, (match, body) => {
    if (/white-space\s*:\s*nowrap/i.test(body)) return match;
    linkStyles += 1;
    const next = /box-decoration-break/i.test(body)
      ? body.replace(/box-decoration-break/i, 'white-space:nowrap;box-decoration-break')
      : `${body};white-space:nowrap`;
    return `.art-atlas-artist-link{${next}}`;
  });
}

function updateCardPresentationStyle(html) {
  if (!html.includes('movement-card-title-tag')) return html;
  if (/<style\b[^>]*id=["']art-atlas-movement-card-presentation-style["'][^>]*>/i.test(html)) {
    return html.replace(
      /<style\b([^>]*id=["']art-atlas-movement-card-presentation-style["'][^>]*)>[\s\S]*?<\/style>/i,
      (match, attrs) => {
        if (match.includes('movement-card-artist-name') && /white-space\s*:\s*nowrap/i.test(match)) return match;
        cardStyles += 1;
        return `<style${attrs}>${cardStyle}</style>`;
      }
    );
  }
  cardStyles += 1;
  const style = `<style id="art-atlas-movement-card-presentation-style">${cardStyle}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}\n</head>`) : `${style}\n${html}`;
}

function normalizeStyleOpenTags(html) {
  return html.replace(/<style\s+(?=\s*id=["']art-atlas-movement-card-presentation-style["'])/gi, '<style ');
}

function wrapPlainCardArtistNames(html) {
  return html.replace(/<h3>([\s\S]*?)<\/h3>/g, (match, inner) => {
    if (!inner.includes('movement-card-title-tag') || inner.includes('movement-card-artist-name')) return match;
    let changed = false;
    let next = inner.replace(/^(\s*)([^<《,][^<,]{1,90}),\s*/, (text, lead, artist) => {
      changed = true;
      return `${lead}<span class="movement-card-artist-name">${artist.trim()}</span>, `;
    });
    if (!changed) {
      next = inner.replace(/^(\s*)([^<《][^<]{1,90})(?=<span class="movement-card-title-tag")/, (text, lead, artist) => {
        changed = true;
        return `${lead}<span class="movement-card-artist-name">${artist.trim()}</span>`;
      });
    }
    if (changed) wrappedNames += 1;
    return `<h3>${next}</h3>`;
  });
}

for (const name of files) {
  const file = path.join(movementDir, name);
  const before = fs.readFileSync(file, 'utf8');
  let after = updateArtistLinkStyle(before);
  after = updateCardPresentationStyle(after);
  after = normalizeStyleOpenTags(after);
  after = wrapPlainCardArtistNames(after);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changedFiles += 1;
  }
}

console.log(JSON.stringify({files: files.length, changedFiles, linkStyles, cardStyles, wrappedNames}, null, 2));
