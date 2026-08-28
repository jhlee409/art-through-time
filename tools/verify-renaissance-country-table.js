const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const canonical = require('../data/art-movement-canonical.json');
const representatives = require('../data/art-movement-representatives.json');
const index = require('../data/미술사조/index.json');
const parent = canonical.parents.find(entry => entry.id === 'renaissance');
const file = path.join(root, index.documents[parent.documentKey]['1']);
const html = fs.readFileSync(file, 'utf8');
const entries = new Map(representatives.categories.map(entry => [entry.categoryId, entry]));

if (!/<html\b[^>]*data-art-atlas-sync-state="complete"/i.test(html)) {
  throw new Error('르네상스 문서가 6단계 complete 상태가 아닙니다.');
}

for (const categoryId of parent.categoryIds) {
  const entry = entries.get(categoryId);
  if (!entry) throw new Error(`르네상스 정본 대표 콘텐츠가 누락되었습니다: ${categoryId}`);
  const rowPattern = new RegExp(`<tr\\b[^>]*data-art-atlas-category-id="${categoryId}"[\\s\\S]*?<\\/tr>`, 'i');
  const cardPattern = new RegExp(`<article\\b[^>]*data-art-atlas-category-id="${categoryId}"[^>]*data-artist-id="${entry.artist.id}"[^>]*data-work-id="${entry.work.id}"[\\s\\S]*?<\\/article>`, 'i');
  const row = rowPattern.exec(html)?.[0] || '';
  if (!row.includes(`data-artist-id="${entry.artist.id}"`)) throw new Error(`르네상스 표 대표 화가가 누락되었습니다: ${categoryId}`);
  if (!cardPattern.test(html)) throw new Error(`르네상스 대표작 카드가 누락되었습니다: ${categoryId}`);
}

const boundRows = html.match(/<tr\b[^>]*data-art-atlas-category-id=/gi) || [];
const cards = html.match(/<article\b[^>]*class="[^"]*movement-work-card/gi) || [];
if (boundRows.length !== parent.categoryIds.length || cards.length !== parent.categoryIds.length) {
  throw new Error(`르네상스 3개 범주와 표·카드 수가 일치하지 않습니다: rows=${boundRows.length}, cards=${cards.length}`);
}

console.log('검증 완료: 르네상스 3개 정본 범주의 표·대표 화가·대표작 카드가 일치합니다.');
