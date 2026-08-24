const fs = require('fs');

const file = 'data/미술사조/37a05b9246dcdbd89a685d55-1.html';
let html = fs.readFileSync(file, 'utf8');
const replacements = [
  ['<tr><td>이탈리아</td>', '<tr><td>이탈리아 — 로마·볼로냐</td>'],
  ['<tr><td>플랑드르</td>', '<tr><td>플랑드르 — 플랑드르 바로크</td>'],
  ['<tr><td>네덜란드 공화국</td>', '<tr><td>네덜란드 공화국 — 네덜란드 황금기</td>'],
  ['<tr><td>스페인</td>', '<tr><td>스페인 — 스페인 바로크</td>'],
  ['<tr><td>프랑스</td>', '<tr><td>프랑스 — 프랑스 바로크</td>']
];
for (const [from, to] of replacements) {
  if (html.includes(to)) continue;
  if (!html.includes(from)) throw new Error(`표 행을 찾지 못했습니다: ${from}`);
  html = html.replace(from, to);
}
fs.writeFileSync(file, html);
console.log('Aligned Baroque country table labels with the faceted filter taxonomy.');
