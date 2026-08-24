const fs = require('fs');

const file = 'data/미술사조/d3a0d1b58bda4f1f1ed342df-1.html';
const html = fs.readFileSync(file, 'utf8');
const tableArtists = [
  '얀 반 에이크', '로히어르 반 데르 베이던', '브뤼헐', '알브레히트 뒤러',
  '루카스 크라나흐', '한스 홀바인 2세', '알브레히트 알트도르퍼', '볼프 후버'
];
if (!tableArtists.every(name => html.includes(name))) {
  throw new Error('국가 전개 표의 대표 화가가 누락되었습니다.');
}

const heading = '<h3>여러 국가에서의 전개 — 대표 화가의 대표작</h3>';
const start = html.indexOf(heading);
const gridStart = html.indexOf('<div class="movement-work-grid three">', start);
const sectionEnd = html.indexOf('</section>', gridStart);
const grid = html.slice(gridStart, sectionEnd);
const cards = grid.match(/<article class="movement-work-card">[\s\S]*?<\/article>/g) || [];
const ids = cards.map(card => card.match(/data-artist-id="([^"]+)"/)?.[1] || '');
const germanOrder = ['artist-Q5580', 'artist-Q191748', 'artist-Q48319'];
if (germanOrder.some(id => ids.filter(value => value === id).length !== 1)) {
  throw new Error(`독일 르네상스 카드가 중복되었거나 누락되었습니다: ${ids.join(', ')}`);
}
if (ids.indexOf(germanOrder[0]) > ids.indexOf(germanOrder[1]) || ids.indexOf(germanOrder[1]) > ids.indexOf(germanOrder[2])) {
  throw new Error(`독일 르네상스 카드 순서가 잘못되었습니다: ${ids.join(', ')}`);
}
console.log('검증 완료: 표 대표 화가 8명 보존, 독일 카드 순서 뒤러·크라나흐·홀바인, 중복 없음.');
