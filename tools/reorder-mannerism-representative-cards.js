const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', '미술사조', '790ffc9c0cd5d4e4a28fb6a6-1.html');
let html = fs.readFileSync(file, 'utf8');

function matchingDivEnd(source, start) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  for (let match; (match = tags.exec(source));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  throw new Error('Unclosed div');
}

function reorderTableArtistCell(rowLabel, artistIds) {
  const start = html.indexOf(`<td>${rowLabel}</td>`);
  const end = html.indexOf('</tr>', start);
  if (start < 0 || end < 0) throw new Error(`${rowLabel} row not found`);
  const row = html.slice(start, end);
  const cells = [...row.matchAll(/<td>[\s\S]*?<\/td>/g)];
  if (cells.length !== 3) throw new Error(`${rowLabel} row must have three cells`);
  const links = new Map([...cells[2][0].matchAll(/<a\b[^>]*data-artist-id="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)].map(match => [match[1], match[0]]));
  const missing = artistIds.filter(id => !links.has(id));
  if (missing.length) throw new Error(`${rowLabel} missing: ${missing.join(', ')}`);
  const replacement = `<td>${artistIds.map(id => links.get(id)).join(', ')}</td>`;
  const cell = cells[2];
  html = `${html.slice(0, start)}${row.slice(0, cell.index)}${replacement}${row.slice(cell.index + cell[0].length)}${html.slice(end)}`;
}

// Activity sequence within the Prague court development: Arcimboldo's court work
// precedes Spranger's later Rudolf II mannerism.
reorderTableArtistCell('프라하·합스부르크 궁정', ['artist-Q7751', 'artist-Q447682']);

const countriesStart = html.indexOf('<section id="countries">');
const countriesEnd = html.indexOf('<!-- art-atlas-enhancement:start -->', countriesStart);
const tableOrder = [...html.slice(countriesStart, countriesEnd).matchAll(/data-artist-id="([^"]+)"/g)].map(match => match[1]);
const uniqueOrder = [...new Set(tableOrder)];

const enhancementStart = html.indexOf('<!-- art-atlas-enhancement:start -->');
const gridStart = html.indexOf('<div class="movement-work-grid">', enhancementStart);
if (gridStart < 0) throw new Error('Mannerism representative-work grid not found');
const gridEnd = matchingDivEnd(html, gridStart);
const cards = [...html.slice(gridStart, gridEnd).matchAll(/<article class="movement-work-card">[\s\S]*?<\/article>/g)].map(match => match[0]);
const byArtist = new Map();
for (const card of cards) {
  const id = card.match(/data-artist-id="([^"]+)"/)?.[1];
  if (id) byArtist.set(id, card);
}

const links = {
  'artist-Q207929': '<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q207929" target="_blank" rel="noopener" data-artist-id="artist-Q207929" data-uh-original="Pontormo" data-uh-korean="야코포 다 폰토르모" data-uh-display-korean="폰토르모" title="야코포 다 폰토르모 연표로 이동">폰토르모</a>',
  'artist-Q9348': '<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q9348" target="_blank" rel="noopener" data-artist-id="artist-Q9348" data-uh-original="Parmigianino" data-uh-korean="파르미자니노" data-uh-display-korean="파르미자니노" title="파르미자니노 연표로 이동">파르미자니노</a>',
  'artist-Q7803': '<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q7803" target="_blank" rel="noopener" data-artist-id="artist-Q7803" data-uh-original="Bronzino" data-uh-korean="브론치노" data-uh-display-korean="브론치노" title="브론치노 연표로 이동">브론치노</a>',
  'artist-Q165367': '<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q165367" target="_blank" rel="noopener" data-artist-id="artist-Q165367" data-uh-original="Hendrick Goltzius" data-uh-korean="헨드릭 골치우스" data-uh-display-korean="헨드릭 골치우스" title="헨드릭 골치우스 연표로 이동">헨드릭 골치우스</a>',
  'artist-Q442484': '<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q442484" target="_blank" rel="noopener" data-artist-id="artist-Q442484" data-uh-original="Cornelis van Haarlem" data-uh-korean="코르넬리스 반 하를렘" data-uh-display-korean="코르넬리스 반 하를렘" title="코르넬리스 반 하를렘 연표로 이동">코르넬리스 반 하를렘</a>',
  'artist-Q329811': '<a class="art-atlas-artist-link" href="../../index.html?artist=artist-Q329811" target="_blank" rel="noopener" data-artist-id="artist-Q329811" data-uh-original="Abraham Bloemaert" data-uh-korean="아브라함 블로에마르트" data-uh-display-korean="아브라함 블로에마르트" title="아브라함 블로에마르트 연표로 이동">아브라함 블로에마르트</a>',
};

const newCards = {
  'artist-Q207929': `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Jacopo-20Pontormo-20004-2dcaf20c0708.jpg" alt="폰토르모, 《십자가에서 내려지는 그리스도》"></div><div class="movement-work-body"><span class="mini-label">${links['artist-Q207929']}</span><h3>${links['artist-Q207929']}, 《십자가에서 내려지는 그리스도》</h3><p class="work-meta">1525–1528 · 산타 펠리치타 성당, 피렌체</p><p>떠 있는 듯한 인물과 차갑고 밝은 색채, 중심을 잃은 공간이 초기 매너리즘의 불안한 긴장을 압축한다.</p></div></article>`,
  'artist-Q9348': `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Parmigianino-Madonna-dal-collo-lungo-Google-Art-Project-0558c795727f.jpg" alt="파르미자니노, 《긴 목의 성모》"></div><div class="movement-work-body"><span class="mini-label">${links['artist-Q9348']}</span><h3>${links['artist-Q9348']}, 《긴 목의 성모》</h3><p class="work-meta">1534–1540 · 우피치 미술관, 피렌체</p><p>비현실적으로 길어진 목과 손, 비례를 벗어난 공간이 우아한 인공성을 매너리즘의 미적 원리로 만든다.</p></div></article>`,
  'artist-Q7803': `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Angelo-20Bronzino-20-20Venus-20Cupid-20Folly-20and-20Time-20-20Nationa-72f45c00b9b9.jpg" alt="브론치노, 《비너스와 큐피드의 알레고리》"></div><div class="movement-work-body"><span class="mini-label">${links['artist-Q7803']}</span><h3>${links['artist-Q7803']}, 《비너스와 큐피드의 알레고리》</h3><p class="work-meta">1544–1545 · 내셔널 갤러리, 런던</p><p>차갑게 빛나는 피부와 복잡한 상징을 결합해 궁정 매너리즘의 지적이고 세련된 긴장을 보여준다.</p></div></article>`,
  'artist-Q165367': `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Hendrick-Goltzius-The-Great-Hercules.jpg" alt="헨드릭 골치우스, 《위대한 헤라클레스》"></div><div class="movement-work-body"><span class="mini-label">${links['artist-Q165367']}</span><h3>${links['artist-Q165367']}, 《위대한 헤라클레스》</h3><p class="work-meta">1589 · 하를럼</p><p>과장된 근육과 판화적인 선의 밀도가 네덜란드 매너리즘이 인체를 지적인 기교의 장으로 바꾼 방식을 드러낸다.</p></div></article>`,
  'artist-Q442484': `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Cornelis-Cornelisz-van-Haarlem-Fall-of-the-Titans.jpg" alt="코르넬리스 반 하를렘, 《티탄들의 몰락》"></div><div class="movement-work-body"><span class="mini-label">${links['artist-Q442484']}</span><h3>${links['artist-Q442484']}, 《티탄들의 몰락》</h3><p class="work-meta">1588–1590 · 하를럼</p><p>뒤엉킨 누드와 극단적인 자세를 거대한 군상으로 쌓아 하를럼 매너리즘의 과장된 운동감과 신화적 긴장을 만든다.</p></div></article>`,
  'artist-Q329811': `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Abraham-Bloemaert-Apollo-Diana-Niobe.jpg" alt="아브라함 블로에마르트, 《아폴론과 디아나가 니오베의 자식들을 죽이다》"></div><div class="movement-work-body"><span class="mini-label">${links['artist-Q329811']}</span><h3>${links['artist-Q329811']}, 《아폴론과 디아나가 니오베의 자식들을 죽이다》</h3><p class="work-meta">1591 · 위트레흐트</p><p>강한 몸의 비틀림과 신화적 비극을 결합해 네덜란드 매너리즘이 바로크 직전의 극적 표현으로 향하는 모습을 보여준다.</p></div></article>`,
};

for (const [id, card] of Object.entries(newCards)) byArtist.set(id, card);
const missing = uniqueOrder.filter(id => !byArtist.has(id));
if (missing.length) throw new Error(`Missing cards for table artists: ${missing.join(', ')}`);

const replacement = `<div class="movement-work-grid">\n${uniqueOrder.map(id => byArtist.get(id)).join('\n')}\n</div>`;
html = `${html.slice(0, gridStart)}${replacement}${html.slice(gridEnd)}`;
html = html.replace('표에는 나오지만 문서 상단에 도판이 없던 대표작', '국가별 전개 표의 대표작');
html = html.replace(/아래 카드는 앞부분에서 이미 크게 보여준[\s\S]*?필요한 작품만 골랐다\.<\/p>/, '아래 카드는 국가별 전개 표에 나온 대표 화가를 활동 시기 순으로 다시 모은 것이다. 앞부분에서 이미 소개한 화가도 빠뜨리지 않고 함께 제시한다.</p>');
fs.writeFileSync(file, html, 'utf8');
console.log(`Reordered ${uniqueOrder.length} Mannerism representative-work cards from the country table.`);
