const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', '미술사조', '37a05b9246dcdbd89a685d55-1.html');
let html = fs.readFileSync(file, 'utf8');

function anchor(id, original, korean, display) {
  return `<a class="art-atlas-artist-link" href="../../index.html?artist=artist-${id}" target="_blank" rel="noopener" data-artist-id="artist-${id}" data-uh-original="${original}" data-uh-korean="${korean}" data-uh-display-korean="${display}" title="${korean} 연표로 이동">${display}</a>`;
}

const caravaggio = anchor('1786371252483', 'Caravaggio', '카라바조', '카라바조');
const carracci = anchor('Q7824', 'Annibale Carracci', '안니발레 카라치', '카라치');
const bernini = anchor('Q160538', 'Gian Lorenzo Bernini', '베르니니, 잔 로렌초', '베르니니');
const hals = anchor('Q167654', 'Frans Hals', '할스, 프란스', '프란스 할스');
const rembrandt = anchor('rembrandt', 'Rembrandt Harmenszoon van Rijn', '렘브란트 하르먼손 반 레인', '렘브란트');
const vermeer = anchor('Q41264', 'Johannes Vermeer', '요하네스 페르메이르', '베르메르');
const zurbaran = anchor('Q209615', 'Francisco de Zurbaran', '프란시스코 데 수르바란', '수르바란');
const velazquez = anchor('Q297', 'Diego Velazquez', '디에고 벨라스케스', '벨라스케스');
const murillo = anchor('Q192062', 'Bartolome Esteban Murillo', '바르톨로메 에스테반 무리요', '무리요');
const poussin = anchor('Q41554', 'Nicolas Poussin', '니콜라 푸생', '푸생');
const lorrain = anchor('name-claudelorrain', 'Claude Lorrain', '클로드 로랭', '클로드 로랭');
const leBrun = anchor('charles-le-brun', 'Charles Le Brun', '샤를 르브룅', '샤를 르브룅');

// The long-name record for Caravaggio had previously been split into Michelangelo + Caravaggio.
const brokenCaravaggio = /(?:<a\b(?=[^>]*data-artist-id="artist-Q5592")[^>]*>미켈란젤로<\/a>\s*메리시\s*)+<a\b(?=[^>]*data-artist-id="artist-1786371252483")[^>]*>다 카라바조<\/a>/g;
html = html.replace(brokenCaravaggio, caravaggio);
html = html.replace(`${caravaggio}(통칭 ${caravaggio})`, caravaggio);

const countriesStart = html.indexOf('<section id="countries">');
const countriesEnd = html.indexOf('</section>', countriesStart);
let countries = html.slice(countriesStart, countriesEnd);
countries = countries.replace(/(<tr><td>이탈리아<\/td><td>[\s\S]*?<\/td><td>)[\s\S]*?(<\/td><\/tr>)/, `$1${carracci}, ${caravaggio}, ${bernini}$2`);
countries = countries.replace(/(<tr><td>네덜란드 공화국<\/td><td>[\s\S]*?<\/td><td>)[\s\S]*?(<\/td><\/tr>)/, `$1${hals}, ${rembrandt}, ${vermeer}$2`);
countries = countries.replace(/(<tr><td>스페인<\/td><td>[\s\S]*?<\/td><td>)[\s\S]*?(<\/td><\/tr>)/, `$1${zurbaran}, ${velazquez}, ${murillo}$2`);
countries = countries.replace(/(<tr><td>프랑스<\/td><td>[\s\S]*?<\/td><td>)[\s\S]*?(<\/td><\/tr>)/, `$1${poussin}, ${lorrain}, ${leBrun}$2`);
html = html.slice(0, countriesStart) + countries + html.slice(countriesEnd);

const gridStart = html.indexOf('<div class="movement-work-grid">', countriesEnd);
const gridEnd = html.indexOf('\n  </div>\n</section>', gridStart);
if (gridStart < 0 || gridEnd < 0) throw new Error('대표작 카드 영역을 찾지 못했습니다.');
const grid = html.slice(gridStart, gridEnd);
const cards = [...grid.matchAll(/    <article class="movement-work-card">[\s\S]*?\n    <\/article>/g)].map(m => m[0]);
const findCard = (needle) => {
  const card = cards.find(item => item.includes(needle));
  if (!card) throw new Error(`카드를 찾지 못했습니다: ${needle}`);
  return card;
};

let leBrunCard = findCard('Le-Brun-Chancellor-Seguier');
leBrunCard = leBrunCard.replace(/<a\b(?=[^>]*data-artist-id="artist-Q213163")[^>]*>르 브룅<\/a>/g, leBrun);
leBrunCard = leBrunCard.replace(`<span class="mini-label">샤를 ${leBrun}</span>`, `<span class="mini-label">${leBrun}</span>`);

const orderedCards = [
  findCard('The-20Triumph-20of-20Bacchus'),
  findCard('Caravaggio-27s-The-Calling'),
  findCard('Bernini-Ecstasy-Saint-Teresa'),
  findCard('rubens-descent-antwerp'),
  findCard('Van-Dyck-Charles-I-at-the-Hunt'),
  findCard('Frans-Hals-Laughing-Cavalier'),
  findCard('rijksmuseum-SK-C-5'),
  findCard('wikidata-Q185372'),
  findCard('Zurbaran-Saint-Serapion'),
  findCard('Velazquez-Las-Meninas'),
  findCard('Murillo-The-Young-Beggar'),
  findCard('Poussin-Et-in-Arcadia'),
  findCard('Claude-Lorrain-Embarkation').replace('<span class="mini-label">클로드 로랭</span><h3>클로드 로랭', `<span class="mini-label">${lorrain}</span><h3>${lorrain}`),
  leBrunCard
];
html = html.slice(0, gridStart) + '<div class="movement-work-grid">\n' + orderedCards.join('\n') + html.slice(gridEnd);

const tableArtists = [...countries.matchAll(/<tr><td>[^<]+<\/td><td>[\s\S]*?<\/td><td>([\s\S]*?)<\/td><\/tr>/g)]
  .flatMap(row => [...row[1].matchAll(/data-artist-id="([^"]+)"/g)].map(match => match[1]));
const cardArtists = orderedCards.map(card => (card.match(/data-artist-id="([^"]+)"/) || [])[1]);
if (JSON.stringify(tableArtists) !== JSON.stringify(cardArtists)) {
  throw new Error(`표와 카드의 화가 순서가 일치하지 않습니다. 표=${tableArtists.join(',')} 카드=${cardArtists.join(',')}`);
}
for (const card of orderedCards) {
  const source = (card.match(/<img src="([^"]+)"/) || [])[1];
  if (!source || !fs.existsSync(path.resolve(path.dirname(file), source))) throw new Error(`카드 이미지를 찾지 못했습니다: ${source}`);
}
fs.writeFileSync(file, html, 'utf8');
console.log(`Updated ${path.relative(process.cwd(), file)} with ${orderedCards.length} cards in table order.`);
