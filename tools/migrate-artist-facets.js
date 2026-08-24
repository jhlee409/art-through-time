const fs = require('fs');
const file = 'data/artists.json';
const taxonomy = JSON.parse(fs.readFileSync('data/art-taxonomy.json', 'utf8'));
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const movementMap = new Map([
  ['선르네상스',['선르네상스','']], ['Proto-Renaissance',['선르네상스','']],
  ['이탈리아 르네상스',['르네상스','초기 르네상스']], ['전성기 르네상스',['르네상스','전성기 르네상스']], ['베네치아 화파',['르네상스','베네치아파']], ['Venetian School',['르네상스','베네치아파']],
  ['르네상스',['르네상스','']], ['Renaissance',['르네상스','']], ['르네상스 · 베네치아 화파',['르네상스','베네치아파']], ['프랑스 르네상스',['르네상스','']],
  ['초기 네덜란드 회화',['북방 르네상스','초기 네덜란드 회화']], ['Early Netherlandish painting',['북방 르네상스','초기 네덜란드 회화']], ['플랑드르 르네상스',['북방 르네상스','플랑드르 르네상스']], ['Flemish Renaissance',['북방 르네상스','플랑드르 르네상스']],
  ['독일 르네상스',['북방 르네상스','독일 르네상스']], ['German Renaissance',['북방 르네상스','독일 르네상스']], ['도나우파',['북방 르네상스','도나우파']], ['Danube School',['북방 르네상스','도나우파']],
  ['매너리즘',['매너리즘','']], ['Mannerism',['매너리즘','']], ['바로크',['바로크','']], ['Baroque',['바로크','']], ['플랑드르 바로크 회화',['바로크','플랑드르 바로크']], ['네덜란드 황금기 회화',['바로크','네덜란드 황금기']], ['로코코',['로코코','']], ['Rococo',['로코코','']], ['신고전주의',['신고전주의','']], ['Neoclassicism',['신고전주의','']], ['낭만주의',['낭만주의','']], ['Romanticism',['낭만주의','']], ['독일 낭만주의',['낭만주의','']], ['사실주의',['사실주의','']], ['Realism',['사실주의','']], ['인상주의',['인상주의','']], ['Impressionism',['인상주의','']], ['후기 인상주의',['후기인상주의','']], ['후기인상주의',['후기인상주의','']], ['Post-Impressionism',['후기인상주의','']], ['Post-impressionism',['후기인상주의','']], ['신인상주의',['신인상주의','']], ['Neo-Impressionism',['신인상주의','']], ['상징주의',['상징주의','']], ['Symbolism',['상징주의','']], ['표현주의',['표현주의','']], ['Expressionism',['표현주의','']], ['입체주의',['입체주의','']], ['Cubism',['입체주의','']], ['다다',['다다','']], ['Dada',['다다','']], ['초현실주의',['초현실주의','']], ['Surrealism',['초현실주의','']], ['바우하우스',['바우하우스','']], ['Bauhaus',['바우하우스','']], ['데 스틸',['데 스틸','']], ['De Stijl',['데 스틸','']], ['신즉물주의',['신즉물주의','']], ['New Objectivity',['신즉물주의','']], ['아츠 앤 크래프츠 운동',['아츠 앤 크래프츠 운동','']]
]);
const regionMap = new Map([['이탈리아','이탈리아'],['프랑스','프랑스'],['독일','독일'],['오스트리아','오스트리아'],['스페인','스페인'],['영국','영국'],['러시아','러시아'],['미국','미국'],['멕시코','멕시코'],['덴마크','덴마크'],['노르웨이','노르웨이'],['스웨덴','스웨덴'],['스위스','스위스'],['네덜란드','네덜란드'],['벨기에','벨기에'],['브라반트 공국','플랑드르'],['플랑드르','플랑드르'],['소련','소련']]);
const activityRegionOverrides = {
  Q5597:['이탈리아'], Q301:['이탈리아','스페인'], Q42207:['이탈리아'], Q104884:['독일'], Q6394591:['러시아']
};
const exactActivityRegionOverrides = {
  // 루벤스의 주된 제작·후원 중심은 앤트워프의 플랑드르였다.
  Q5599:['플랑드르']
};
const submovementOverrides = {
  Q7824:['볼로냐파'], Q42207:['카라바조주의'], Q160538:['로마 바로크'],
  Q5599:['플랑드르 바로크'], Q150679:['플랑드르 바로크'],
  Q167654:['네덜란드 황금기'], Q5598:['네덜란드 황금기'], Q41264:['네덜란드 황금기'],
  Q209615:['스페인 바로크'], Q297:['스페인 바로크'], Q192062:['스페인 바로크'],
  Q41554:['프랑스 바로크'], Q9340:['프랑스 바로크']
};
function unique(values) { return [...new Set(values.filter(Boolean))]; }
for (const artist of data.artists) {
  const legacy = artist.movement?.ko || artist.movement?.en || '';
  const mapped = movementMap.get(legacy) || ['',''];
  artist.movements = unique([...(artist.movements || []), mapped[0]]);
  artist.submovements = unique([...(artist.submovements || []), mapped[1]]);
  artist.primaryMovement = artist.primaryMovement || mapped[0] || '';
  const nationality = artist.nationality?.ko || artist.nationality?.en || '';
  const inferredRegion = regionMap.get(nationality) || (/피렌체|베네치아|교황령|이탈리아/.test(nationality) ? '이탈리아' : (/네덜란드/.test(nationality) ? '네덜란드' : (/플랑드르|브라반트/.test(nationality) ? '플랑드르' : '')));
  artist.regions = unique([...(artist.regions || []), ...(activityRegionOverrides[artist.qid] || []), inferredRegion]);
  if (exactActivityRegionOverrides[artist.qid]) artist.regions = exactActivityRegionOverrides[artist.qid];
  if (submovementOverrides[artist.qid]) artist.submovements = submovementOverrides[artist.qid];
  const start = Number(artist.birth);
  const end = Number(artist.death || artist.birth);
  artist.periods = taxonomy.periods.filter(period => Number.isFinite(start) && Number.isFinite(end) && start <= period.end && end >= period.start).map(period => period.id);
}
data.metadata = {...data.metadata, updatedAt:new Date().toISOString(), revision:(Number(data.metadata?.revision)||0)+1};
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Migrated ${data.artists.length} artists with faceted classification fields.`);
