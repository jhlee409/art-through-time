const fs = require('fs');
const file = 'data/미술사조/c0d228e179032941f8d9ebfb-1.html';
let html = fs.readFileSync(file, 'utf8');
const people = {
  '바토':['artist-Q155151','Antoine Watteau','앙투안 바토','바토, 앙투안','바토'], '부셰':['artist-Q313122','François Boucher','프랑수아 부셰','부셰, 프랑수아','부셰'], '프라고나르':['artist-Q313898','Jean-Honoré Fragonard','장오노레 프라고나르','프라고나르, 장오노레','프라고나르'], '비제 르 브룅':['artist-Q213163','Élisabeth Louise Vigée Le Brun','엘리자베스 루이 비제 르 브룅','비제 르 브룅, 엘리자베스 루이','르 브룅'],
  '티에폴로':['artist-Q162048','Giovanni Battista Tiepolo','조반니 바티스타 티에폴로','티에폴로, 조반니 바티스타','티에폴로'], '카날레토':['artist-Q161866','Canaletto','카날레토','카날레토','카날레토'], '게인즈버러':['artist-Q180117','Thomas Gainsborough','토머스 게인즈버러','게인즈버러, 토머스','게인즈버러'], '호가스':['artist-Q189621','William Hogarth','윌리엄 호가스','호가스, 윌리엄','호가스'], '샤르댕':['artist-Q312309','Jean-Baptiste-Siméon Chardin','장바티스트 시메옹 샤르댕','샤르댕, 장바티스트 시메옹','샤르댕'], '로살바 카리에라':['artist-Q235547','Rosalba Carriera','로살바 카리에라','카리에라, 로살바','카리에라']
};
const link = name => { const [id,en,ko,display,list] = people[name]; return `<a class="art-atlas-artist-link" href="../../index.html?artist=${id}" target="_blank" rel="noopener" data-artist-id="${id}" data-uh-original="${en}" data-uh-korean="${ko}" data-uh-display-korean="${display}" data-uh-list-korean="${list}" title="${ko} 연표로 이동">${list}</a>`; };
const start = html.indexOf('<section id="countries">');
const end = html.indexOf('</section>', start);
if (start < 0 || end < 0) throw new Error('로코코 국가 전개 표를 찾지 못했습니다.');
let table = html.slice(start, end);
for (const name of ['바토','부셰','프라고나르','티에폴로','카날레토','게인즈버러','호가스']) table = table.replace(name, link(name));
table = table.replace(`${link('프라고나르')}</td>`, `${link('프라고나르')}, ${link('비제 르 브룅')}</td>`);
html = html.slice(0, start) + table + html.slice(end);
html = html.replace('<h3>표에는 나오지만 문서 상단에 도판이 없던 대표작</h3>', '<h3>사조의 주요 화가를 모두 보는 대표작</h3>');
html = html.replace('아래 카드는 앞부분의 바토, 부셰, 프라고나르, 티에폴로, 리고를 반복하지 않고 로코코의 주변부와 확장 영역을 보여준다.', '국가 전개 표의 화가를 앞부분의 도판 여부와 관계없이 모두 모았고, 로코코의 주변부와 확장 영역도 함께 배치했다.');
const cards = [
  `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Antoine-20Watteau-20-20Pilgrimage-20to-20Cythera-20-20WGA25454-de23e298c518.jpg" alt="바토, 키테라섬으로의 순례"></div><div class="movement-work-body"><h3>${link('바토')}, 《키테라섬으로의 순례》<span class="movement-card-title-tag"> · 로코코</span></h3><p class="work-meta">1717</p><p>우아한 야외 사교와 덧없는 사랑의 감정을 통해 페트 갈랑트의 출발점을 만든다.</p></div></article>`,
  `<article class="movement-work-card"><div class="movement-work-image"><img src="images/The-20Toilet-20of-20Venus-20by-20Fran-C3-A7ois-20Boucher-fc27175742d6.jpg" alt="부셰, 비너스의 단장"></div><div class="movement-work-body"><h3>${link('부셰')}, 《비너스의 단장》<span class="movement-card-title-tag"> · 로코코</span></h3><p class="work-meta">1751</p><p>신화와 장식성을 결합한 프랑스 살롱 로코코의 대표작이다.</p></div></article>`,
  `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Fragonard-The-Swing-af227c46d654.jpg" alt="프라고나르, 그네"></div><div class="movement-work-body"><h3>${link('프라고나르')}, 《그네》<span class="movement-card-title-tag"> · 로코코</span></h3><p class="work-meta">1767년경</p><p>빠른 붓질과 은밀한 연애의 서사가 로코코의 유희성을 극대화한다.</p></div></article>`,
  `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Vigee-Le-Brun-Self-Portrait.jpg" alt="비제 르 브룅, 자화상"></div><div class="movement-work-body"><h3>${link('비제 르 브룅')}, 《자화상》<span class="movement-card-title-tag"> · 로코코</span></h3><p class="work-meta">18세기 후반</p><p>후기 로코코의 우아한 초상 양식을 신고전주의 시기까지 이어 간 프랑스의 대표적 여성 화가다.</p></div></article>`,
  `<article class="movement-work-card"><div class="movement-work-image"><img src="images/Giovanni-20Battista-20Tiepolo-20-20Apollo-20and-20the-20Continents-20-4da05d03665b.jpg" alt="티에폴로, 아폴론과 대륙들"></div><div class="movement-work-body"><h3>${link('티에폴로')}, 《아폴론과 대륙들》<span class="movement-card-title-tag"> · 로코코</span></h3><p class="work-meta">1752년경</p><p>밝은 색채와 솟구치는 원근법으로 베네치아 천장화의 환영을 만든다.</p></div></article>`
].join('');
const heading = '사조의 주요 화가를 모두 보는 대표작';
const grid = '<div class="movement-work-grid">';
const gridStart = html.indexOf(grid, html.indexOf(heading));
if (gridStart < 0) throw new Error('로코코 대표작 카드 그리드를 찾지 못했습니다.');
if (!html.includes('alt="바토, 키테라섬으로의 순례"')) html = html.slice(0, gridStart + grid.length) + cards + html.slice(gridStart + grid.length);
for (const name of ['샤르댕','카날레토','로살바 카리에라','게인즈버러','호가스']) html = html.replace(`<h3>${name},`, `<h3>${link(name)},`);
fs.writeFileSync(file, html);
console.log('Linked Rococo country-table painters and added Vigée Le Brun to the French row.');
