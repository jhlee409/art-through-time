const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', '미술사조', 'd3a0d1b58bda4f1f1ed342df-1.html');
let html = fs.readFileSync(file, 'utf8');

function matchingDivEnd(source, start) {
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 0;
  for (let match; (match = tag.exec(source));) {
    if (match[0][1] === '/') {
      depth -= 1;
      if (depth === 0) return tag.lastIndex;
    } else {
      depth += 1;
    }
  }
  throw new Error('Unclosed div');
}

// Keep Rogier's full Korean name inside the artist link so no unlinked name is
// left before it in prose or a card title.
html = html.replace(
  /로히어르 반 데르\s*<a\b([^>]*data-artist-id="artist-Q68631"[^>]*)>베이던<\/a>/g,
  '<a$1>로히어르 반 데르 베이던</a>',
);
html = html.replace(
  /(data-artist-id="artist-Q68631"[^>]*data-uh-display-korean=")베이던"/g,
  '$1로히어르 반 데르 베이던"',
);

const bruegelLink = '<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q43270" target="_blank" rel="noopener" data-artist-id="artist-Q43270" data-uh-original="Pieter Brueghel the Elder" data-uh-korean="대 피터르 브뤼헐" data-uh-display-korean="브뤼헐, 피터르 대" title="대 피터르 브뤼헐 연표로 이동" data-uh-list-korean="브뤼헐">브뤼헐</a>';
const flandersRowStart = html.indexOf('<td>네덜란드·플랑드르</td>');
const flandersRowEnd = html.indexOf('</tr>', flandersRowStart);
if (flandersRowStart < 0 || flandersRowEnd < 0) throw new Error('Netherlands–Flanders row not found');
const flandersRow = html.slice(flandersRowStart, flandersRowEnd);
if (!flandersRow.includes('artist-Q43270')) {
  const updatedRow = flandersRow
    .replace('로히어르 반 데르 베이던의 압축된 감정 표현이 함께 이 흐름을 이끈다.', '로히어르 반 데르 베이던의 압축된 감정, 브뤼헐의 농민과 풍경이 함께 이 흐름을 이끈다.')
    .replace(/<\/td>\s*$/, `, ${bruegelLink}</td>`);
  html = `${html.slice(0, flandersRowStart)}${updatedRow}${html.slice(flandersRowEnd)}`;
}

function reorderRepresentativeCell(rowLabel, artistIds) {
  const start = html.indexOf(`<td>${rowLabel}</td>`);
  const end = html.indexOf('</tr>', start);
  if (start < 0 || end < 0) throw new Error(`${rowLabel} row not found`);
  const row = html.slice(start, end);
  const cells = [...row.matchAll(/<td>[\s\S]*?<\/td>/g)];
  if (cells.length !== 3) throw new Error(`${rowLabel} row must have three cells`);
  const links = new Map([...cells[2][0].matchAll(/<a\b[^>]*data-artist-id="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)].map((match) => [match[1], match[0]]));
  const missing = artistIds.filter((id) => !links.has(id));
  if (missing.length) throw new Error(`${rowLabel} missing artists: ${missing.join(', ')}`);
  const replacement = `<td>${artistIds.map((id) => links.get(id)).join(', ')}</td>`;
  const cell = cells[2];
  const reorderedRow = `${row.slice(0, cell.index)}${replacement}${row.slice(cell.index + cell[0].length)}`;
  html = `${html.slice(0, start)}${reorderedRow}${html.slice(end)}`;
}

reorderRepresentativeCell('이탈리아 — 피렌체·로마', [
  'artist-Q7814', 'artist-url-1787307872488', 'artist-1786369007570',
  'artist-Q5592', 'artist-Q8459', 'artist-Q5597',
]);

const enhancement = html.indexOf('<!-- art-atlas-enhancement:start -->');
const gridStart = html.indexOf('<div class="movement-work-grid three">', enhancement);
if (gridStart < 0) throw new Error('Representative-work grid not found');
const gridEnd = matchingDivEnd(html, gridStart);
const grid = html.slice(gridStart, gridEnd);
const cards = [...grid.matchAll(/<article class="movement-work-card">[\s\S]*?<\/article>/g)].map((match) => match[0]);

const byArtist = new Map();
for (const card of cards) {
  const id = card.match(/data-artist-id="([^"]+)"/)?.[1];
  if (!id) throw new Error('Card without an artist link');
  byArtist.set(id, card);
}

const veronese = `<article class="movement-work-card">
  <div class="movement-work-image"><img src="images/Veronese-Wedding-Feast-at-Cana.jpg" alt="파올로 베로네세, 《가나의 혼인잔치》"></div>
  <div class="movement-work-body">
    <h3><a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q9440" target="_blank" rel="noopener" data-artist-id="artist-Q9440" data-uh-original="Paolo Veronese" data-uh-korean="파올로 베로네세" data-uh-display-korean="베로네세, 파올로" title="파올로 베로네세 연표로 이동" data-uh-list-korean="베로네세">베로네세</a>, 《가나의 혼인잔치》</h3>
    <small>1562–1563 · 루브르 박물관, 파리</small>
    <p>거대한 연회 장면을 건축과 음악, 화려한 색채의 무대로 만들며 베네치아 르네상스의 장식적 장엄함을 보여준다.</p>
  </div>
</article>`;

const bruegel = `<article class="movement-work-card">
  <div class="movement-work-image"><img src="../thumbnails/artist-Q43270/wikidata-Q699091.jpg" alt="대 피터르 브뤼헐, 《바벨탑》"></div>
  <div class="movement-work-body">
    <h3>${bruegelLink}, 《바벨탑》</h3>
    <small>1563 · 미술사 박물관, 빈</small>
    <p>세속의 일과 풍경을 압도적 규모의 서사로 엮어, 플랑드르 르네상스가 관찰한 현실과 도덕적 상상력을 함께 보여준다.</p>
  </div>
</article>`;

const order = [
  'artist-Q7814', 'artist-url-1787307872488', 'artist-1786369007570',
  'artist-Q5592', 'artist-Q8459', 'artist-Q5597', 'artist-Q17169',
  'artist-Q47551', 'artist-Q9319', 'artist-Q9440', 'artist-Q102272',
  'artist-Q68631', 'artist-Q43270', 'artist-Q5580', 'artist-Q48319', 'artist-Q191748',
  'artist-Q153746', 'artist-Q610556', 'artist-Q378800', 'artist-Q336747',
];
byArtist.set('artist-Q9440', veronese);
byArtist.set('artist-Q43270', bruegel);
const missing = order.filter((id) => !byArtist.has(id));
if (missing.length) throw new Error(`Missing cards: ${missing.join(', ')}`);

const replacement = `<div class="movement-work-grid three">\n${order.map((id) => byArtist.get(id)).join('\n')}\n</div>`;
html = `${html.slice(0, gridStart)}${replacement}${html.slice(gridEnd)}`;
fs.writeFileSync(file, html, 'utf8');
console.log(`Reordered ${order.length} Renaissance representative-work cards.`);
