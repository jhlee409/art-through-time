const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '..', 'data', '미술사조', 'c0d228e179032941f8d9ebfb-1.html');
let html = fs.readFileSync(file, 'utf8');
const replacements = [
  ['images/Vigee-Le-Brun-Self-Portrait.jpg', '../thumbnails/artist-Q213163/wikidata-Q18719540.jpg'],
  ['alt="비제 르 브룅, 자화상"', 'alt="르 브룅, 밀짚모자를 쓴 자화상" data-art-atlas-highres="/data/thumbnails/artist-Q213163/wikidata-Q18719540.jpg" data-art-atlas-highres-title="르 브룅 · 밀짚모자를 쓴 자화상"'],
  ['르 브룅</a>, 《자화상》<span class="movement-card-title-tag"> · 로코코</span><span class="movement-card-activity-region"> · 프랑스</span>', '르 브룅</a>, 《밀짚모자를 쓴 자화상》<span class="movement-card-title-tag"> · 로코코·신고전주의</span><span class="movement-card-activity-region"> · 프랑스</span>'],
  ['<p class="work-meta">18세기 후반</p><p>후기 로코코의 우아한 초상 양식을 신고전주의 시기까지 이어 간 프랑스의 대표적 여성 화가다.</p>', '<p class="work-meta">1782</p><p>투명한 빛과 자연스러운 시선이 궁정 초상의 우아함, 로코코의 부드러움, 신고전주의의 명료한 형태감을 함께 보여준다.</p>']
];
for (const [before, after] of replacements) {
  if (!html.includes(before)) throw new Error(`Rococo card marker not found: ${before}`);
  html = html.replace(before, after);
}
fs.writeFileSync(file, html, 'utf8');
console.log('Updated the Rococo Vigée Le Brun representative-work card.');
