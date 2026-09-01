module.exports = function install(context) {
  const { fs, path, URL, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists, thumbnailLocation, makePngUnderStorageLimit, assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument, highResolutionLocation, highResolutionArtistNameOverrides, commonHighResolutionArtistName, safeFileSegment, highResolutionFileBase, removeHighResolutionFiles, migrationExport, publicRootFiles, publicDataFiles, publicPathPrefixes, isPublicStaticPath, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, safeUploadId, uploadTypes, movementDocumentDir, movementDocumentIndex, movementDocumentName, movementDocumentSlot, readMovementDocuments, writeMovementDocuments, movementDocumentFileStem, movementDocumentRelative, isMovementDocumentRelative, escapeRegex, escapeAttribute, htmlDecode, tagAttrs, normalizeMovementImageReference, movementHighResolutionSearchText, movementHighResolutionEntries, movementHighResolutionEntryForImage, movementHighResolutionViewer, movementCardDoubleClickZoom, movementCardInteractiveZoom, movementContentLayoutStyle, movementCardImageFitStyle, injectMovementContentLayout, movementCardDocumentName, normalizeMovementCardPresentation, movementPlainText, movementCountryLabelKey, movementCountryCardContexts, injectMovementCountryCardContexts, injectMovementStickyTitle, matchingHtmlElementEnd, synchronizeMovementCountryTableArtistOrder, injectMovementHighResolutionViewer } = context;
function compactArtistName(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g,' ').trim();
}
function movementArtistAliasOverrides(artist) {
  const qid=artist?.qid;
  const aliases={
    Q5582:['반 고흐','고흐','Van Gogh'],
    Q296:['모네','Monet'],
    Q5588:['칼로','Kahlo'],
    Q104884:['카스파르 다비트 프리드리히','카스파르 다비드 프리드리히','카스파 다비트 프리드리히','Caspar Friedrich'],
    Q6394591:['푸키레프','Pukirev','Pukiryov'],
    Q40599:['마네','Manet'],
    Q762:['레오나르도','다 빈치','Leonardo'],
    Q7814:['조토','조토 디 본도네','Giotto di Bondone','Giotto'],
    Q42207:['카라바조','Caravaggio'],
    Q5592:['미켈란젤로','Michelangelo'],
    Q68631:['로히어르 반 데르 베이던','반 데르 베이던','로히어르','베이던','Rogier van der Weyden'],
    Q43270:['피터르 브뤼헐','브뤼헐','Pieter Bruegel','Pieter Brueghel','Bruegel','Brueghel'],
    Q213163:['비제 르 브룅','비제르브룅','Vigée Le Brun','Vigee Le Brun'],
    Q5599:['루벤스','Rubens'],
    Q5598:['렘브란트','Rembrandt'],
    Q47551:['티치아노','티치아노 베첼리오','Tiziano','Tiziano Vecellio','Titian'],
    Q187310:['라르손','Larsson'],
    Q82445:['툴루즈로트레크','툴루즈 로트레크','Toulouse-Lautrec','Toulouse Lautrec'],
    Q301:['엘 그레코','엘그레코','El Greco'],
    Q41264:['페르메이르','베르메르','Vermeer'],
    Q5597:['라파엘로','Raphael']
  };
  return aliases[qid] || [];
}
function movementArtistAliases(artist) {
  const recordAliases = Array.isArray(artist?.aliases)
    ? artist.aliases
    : [...(Array.isArray(artist?.aliases?.ko) ? artist.aliases.ko : []), ...(Array.isArray(artist?.aliases?.en) ? artist.aliases.en : [])];
  const aliases=[artist?.fullName,artist?.name?.ko,artist?.name?.en,...recordAliases,...movementArtistAliasOverrides(artist)];
  return [...new Set(aliases.map(compactArtistName).filter(name=>name.length >= 2))];
}
async function movementArtistLinkEntries() {
  const data=await readArtistsFile();
  const entries=[];
  for(const artist of data.artists || []) {
    for(const alias of movementArtistAliases(artist)) entries.push({alias,id:artist.id,name:artist.name?.ko || artist.fullName || artist.name?.en || alias,korean:artist.name?.ko || artist.fullName || '',original:artist.name?.en || '',displayKorean:artist.fullName || artist.name?.ko || '',listKorean:artist.listName?.ko || artist.shortName?.ko || artist.name?.ko || alias});
  }
  return entries.sort((a,b)=>b.alias.length-a.alias.length || a.alias.localeCompare(b.alias,'ko'));
}
function compactMovementName(value='') {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^0-9a-z가-힣]+/g,'');
}
function movementNameKo(value) {
  if(!value) return '';
  if(typeof value === 'string') return value.trim();
  return String(value.ko || value.en || '').trim();
}
function serverMovementSpec(label, includes=[], extra={}) {
  return {...extra,label,keys:new Set([label?.ko,label?.en,...includes].filter(Boolean).map(compactMovementName))};
}
const serverArtistMovementDisplayRules = [
  serverMovementSpec({ko:'이탈리아 르네상스',en:'Italian Renaissance'}, ['Italian Renaissance','High Renaissance','Proto-Renaissance','이탈리아 르네상스','전성기 르네상스','선르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'베네치아 화파',en:'Venetian School'}, ['Venetian School','Venetian school','Venetian Renaissance','베네치아 화파','베네치아 르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'북유럽 르네상스',en:'Northern Renaissance'}, ['Northern Renaissance','북유럽 르네상스','북방 르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'독일 르네상스',en:'German Renaissance'}, ['German Renaissance','독일 르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'도나우파',en:'Danube School'}, ['Danube School','도나우파'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'네덜란드·플랑드르 르네상스',en:'Netherlandish and Flemish Renaissance'}, ['Early Netherlandish painting','Dutch and Flemish Renaissance painting','Netherlandish and Flemish Renaissance painting','초기 네덜란드 회화','플랑드르파','네덜란드 및 플랑드르 르네상스 회화','네덜란드·플랑드르 르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'프랑스 르네상스',en:'French Renaissance'}, ['French Renaissance','프랑스 르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'덴마크 르네상스',en:'Danish Renaissance'}, ['Danish Renaissance','덴마크 르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'노르딕 르네상스',en:'Nordic Renaissance'}, ['Nordic Renaissance','노르딕 르네상스'], {parent:{ko:'르네상스',en:'Renaissance'}}),
  serverMovementSpec({ko:'플랑드르 바로크 회화',en:'Flemish Baroque painting'}, ['Flemish Baroque painting','플랑드르 바로크 회화'], {parent:{ko:'바로크',en:'Baroque'}}),
  serverMovementSpec({ko:'이탈리아 바로크 회화',en:'Italian Baroque painting'}, ['Italian Baroque painting','이탈리아 바로크 회화'], {parent:{ko:'바로크',en:'Baroque'}}),
  serverMovementSpec({ko:'네덜란드 황금기 회화',en:'Dutch Golden Age painting'}, ['Dutch Golden Age painting','Dutch Baroque','네덜란드 황금기 회화','네덜란드 바로크'], {parent:{ko:'바로크',en:'Baroque'}}),
  serverMovementSpec({ko:'바로크',en:'Baroque'}, ['Baroque art','바로크']),
  serverMovementSpec({ko:'피렌체·로마 매너리즘',en:'Florentine-Roman Mannerism'}, ['Florentine-Roman Mannerism','Florentine Mannerism','Roman Mannerism','피렌체-로마 매너리즘','피렌체·로마 매너리즘'], {parent:{ko:'매너리즘',en:'Mannerism'}}),
  serverMovementSpec({ko:'파르마·에밀리아 매너리즘',en:'Parma and Emilian Mannerism'}, ['Parma and Emilian Mannerism','Parma Mannerism','Emilian Mannerism','파르마와 에밀리아 계열','파르마·에밀리아 매너리즘'], {parent:{ko:'매너리즘',en:'Mannerism'}}),
  serverMovementSpec({ko:'퐁텐블로파',en:'School of Fontainebleau'}, ['School of Fontainebleau','Fontainebleau School','퐁텐블로파'], {parent:{ko:'매너리즘',en:'Mannerism'}}),
  serverMovementSpec({ko:'스페인 매너리즘',en:'Spanish Mannerism'}, ['Spanish Mannerism','스페인 매너리즘'], {parent:{ko:'매너리즘',en:'Mannerism'}}),
  serverMovementSpec({ko:'네덜란드 매너리즘',en:'Dutch Mannerism'}, ['Dutch Mannerism','Haarlem Mannerism','Netherlandish Mannerism','네덜란드 매너리즘','하를럼 매너리즘'], {parent:{ko:'매너리즘',en:'Mannerism'}}),
  serverMovementSpec({ko:'프라하 궁정 매너리즘',en:'Prague Court Mannerism'}, ['Prague Court Mannerism','Habsburg Court Mannerism','Rudolfine Mannerism','프라하 궁정 매너리즘','프라하·합스부르크 궁정','루돌프 2세 궁정 매너리즘'], {parent:{ko:'매너리즘',en:'Mannerism'}}),
  serverMovementSpec({ko:'독일 낭만주의',en:'German Romanticism'}, ['German Romanticism','독일 낭만주의'], {parent:{ko:'낭만주의',en:'Romanticism'}}),
  serverMovementSpec({ko:'낭만주의',en:'Romanticism'}, ['Romanticism','낭만주의']),
  serverMovementSpec({ko:'후기 인상주의',en:'Post-Impressionism'}, ['Post-Impressionism','Post-impressionism','후기 인상주의','후기인상주의'])
];
const serverArtistMovementClassificationOverrides = {
  Q17169:{ko:'베네치아 화파',en:'Venetian School'}, Q8459:{ko:'베네치아 화파',en:'Venetian School'}, Q47551:{ko:'베네치아 화파',en:'Venetian School'}, Q9319:{ko:'베네치아 화파',en:'Venetian School'}, Q9440:{ko:'베네치아 화파',en:'Venetian School'},
  Q102272:{ko:'초기 네덜란드 회화',en:'Early Netherlandish painting'}, Q68631:{ko:'초기 네덜란드 회화',en:'Early Netherlandish painting'}, Q43270:{ko:'플랑드르 르네상스',en:'Flemish Renaissance'}, Q5580:{ko:'독일 르네상스',en:'German Renaissance'}, Q48319:{ko:'독일 르네상스',en:'German Renaissance'}, Q191748:{ko:'독일 르네상스',en:'German Renaissance'},
  Q153746:{ko:'도나우파',en:'Danube School'}, Q610556:{ko:'도나우파',en:'Danube School'},
  Q207929:{ko:'피렌체·로마 매너리즘',en:'Florentine-Roman Mannerism'}, Q312617:{ko:'피렌체·로마 매너리즘',en:'Florentine-Roman Mannerism'}, Q9348:{ko:'파르마·에밀리아 매너리즘',en:'Parma and Emilian Mannerism'}, Q7803:{ko:'피렌체·로마 매너리즘',en:'Florentine-Roman Mannerism'}, Q333366:{ko:'퐁텐블로파',en:'School of Fontainebleau'}, Q301:{ko:'스페인 매너리즘',en:'Spanish Mannerism'}, Q165367:{ko:'네덜란드 매너리즘',en:'Dutch Mannerism'}, Q442484:{ko:'네덜란드 매너리즘',en:'Dutch Mannerism'}, Q329811:{ko:'네덜란드 매너리즘',en:'Dutch Mannerism'}, Q447682:{ko:'프라하 궁정 매너리즘',en:'Prague Court Mannerism'}, Q7751:{ko:'프라하 궁정 매너리즘',en:'Prague Court Mannerism'}
};
const serverArtistMovementFallbacks = {Q104884:{ko:'독일 낭만주의',en:'German Romanticism'}};
function serverArtistPrimaryMovement(artist) {
  const direct=movementNameKo(serverArtistMovementClassificationOverrides[artist?.qid] || serverArtistMovementClassificationOverrides[artist?.id] || artist?.movement || serverArtistMovementFallbacks[artist?.qid]);
  if(direct) return direct;
  const counts=new Map();
  for(const work of artist?.works || []) {
    const movement=movementNameKo(work?.movement);
    if(movement) counts.set(movement,(counts.get(movement) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
}
function serverArtistMovementDisplayLabel(artist) {
  const movement=serverArtistPrimaryMovement(artist);
  if(!movement) return '';
  const key=compactMovementName(movement);
  const rule=serverArtistMovementDisplayRules.find(item=>item.keys.has(key));
  if(!rule) return movement;
  const label=movementNameKo(rule.label) || movement;
  const parent=movementNameKo(rule.parent);
  return parent && compactMovementName(label) !== compactMovementName(parent) ? `${label} - ${parent}` : label;
}
function stripMovementArtworkMovementLabels(html) {
  return String(html || '')
    .replace(/\n?<style\b[^>]*id=["']art-atlas-work-movement-style["'][^>]*>[\s\S]*?<\/style>\n?/gi,'\n')
    .replace(/\s*<p\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-work-movement\b)[\s\S]*?<\/p>\s*/gi,'');
}
function movementCardArtist(card, artists, aliasEntries) {
  const id=String(card.match(/\bdata-artist-id=["']([^"']+)["']/i)?.[1] || '').trim();
  if(id) {
    const direct=artists.find(artist=>artist.id === id);
    if(direct) return direct;
  }
  const text=htmlDecode(String(card || '').replace(/<[^>]+>/g,' ')).normalize('NFC').toLocaleLowerCase('ko-KR');
  const entry=aliasEntries.find(item=>text.includes(item.alias.normalize('NFC').toLocaleLowerCase('ko-KR')));
  return entry ? artists.find(artist=>artist.id === entry.id) : null;
}
function normalizedMovementMiniLabelText(value='') {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^0-9a-z가-힣]+/g,'').trim();
}
function redundantArtistMiniLabelPattern(artist) {
  const labels=new Set([artist?.fullName,artist?.name?.ko,artist?.name?.en,...movementArtistAliasOverrides(artist)].filter(Boolean).map(normalizedMovementMiniLabelText).filter(Boolean));
  return labels;
}
function stripRedundantArtistMiniLabel(body, artist) {
  const labels=redundantArtistMiniLabelPattern(artist);
  if(!labels.size) return body;
  const match=body.match(/^\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmini-label\b)[^>]*>[\s\S]*?<\/span>\s*/i);
  if(!match) return body;
  const labelText=normalizedMovementMiniLabelText(textFromHtml(match[0]));
  return labels.has(labelText) ? body.slice(match[0].length) : body;
}
function injectMovementLabelIntoCard(card, label, artist) {
  if(!/<img\b/i.test(card) || /art-atlas-work-movement/i.test(card)) return card;
  const movementBlock=`<p class="art-atlas-work-movement"><strong>화가 사조</strong> ${escapeAttribute(label)}</p>`;
  const divPattern=/<div\b[^>]*>/gi;
  let match;
  while((match=divPattern.exec(card))) {
    const className=tagAttrs(match[0]).class || '';
    if(!/(^|\s)(movement-work-body|caption)(\s|$)/.test(className)) continue;
    const bodyStart=match.index + match[0].length;
    const bodyEnd=card.indexOf('</div>', bodyStart);
    if(bodyEnd < 0) return card;
    const before=card.slice(0,bodyStart), body=stripRedundantArtistMiniLabel(card.slice(bodyStart,bodyEnd),artist), after=card.slice(bodyEnd);
    if(/<\/small>/i.test(body)) return `${before}${body.replace(/<\/small>/i,`</small>\n${movementBlock}`)}${after}`;
    if(/<\/h[1-6]>/i.test(body)) return `${before}${body.replace(/<\/h[1-6]>/i,heading=>`${heading}\n${movementBlock}`)}${after}`;
    return `${before}${movementBlock}\n${body}${after}`;
  }
  return card;
}
async function injectMovementArtworkMovementLabels(html) {
  // The movement is now kept in the image-card title itself.  Old documents
  // may still contain the former separate “화가 사조” paragraph, so strip it
  // whenever a movement document is served instead of injecting it again.
  return stripMovementArtworkMovementLabels(html);
}
const movementArtistLinkStyle = `.art-atlas-artist-link{font-weight:900;color:#191007!important;background:linear-gradient(180deg,rgba(255,232,151,.98),rgba(255,198,86,.9));border-bottom:2px solid #a96f12;border-radius:.22em;padding:0 .16em;text-decoration:none!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}.art-atlas-artist-link:hover{filter:brightness(1.08);box-shadow:0 0 0 2px rgba(255,214,102,.24)}`;
const movementWikipediaTermLinkStyle = `.art-atlas-wiki-term-link{color:inherit;text-decoration:underline dotted;text-decoration-thickness:.08em;text-underline-offset:.18em}.art-atlas-wiki-term-link:hover{filter:brightness(.82)}`;
const movementWikipediaTermLinks = [
  {terms:['앙시앵 레짐','구체제'], url:'https://en.wikipedia.org/wiki/Ancien_R%C3%A9gime'},
  {terms:['계몽주의'], url:'https://en.wikipedia.org/wiki/Age_of_Enlightenment'},
  {terms:['프랑스 혁명'], url:'https://en.wikipedia.org/wiki/French_Revolution'},
  {terms:['미국 독립혁명','미국 혁명'], url:'https://en.wikipedia.org/wiki/American_Revolution'},
  {terms:['러시아 혁명'], url:'https://en.wikipedia.org/wiki/Russian_Revolution'},
  {terms:['제1차 세계대전'], url:'https://en.wikipedia.org/wiki/World_War_I'},
  {terms:['산업혁명'], url:'https://en.wikipedia.org/wiki/Industrial_Revolution'},
  {terms:['나폴레옹 전쟁'], url:'https://en.wikipedia.org/wiki/Napoleonic_Wars'},
  {terms:['나폴레옹 시대'], url:'https://en.wikipedia.org/wiki/Napoleonic_era'},
  {terms:['종교개혁'], url:'https://en.wikipedia.org/wiki/Reformation'},
  {terms:['반종교개혁'], url:'https://en.wikipedia.org/wiki/Counter-Reformation'},
  {terms:['고대 그리스'], url:'https://en.wikipedia.org/wiki/Ancient_Greece'},
  {terms:['고대 로마'], url:'https://en.wikipedia.org/wiki/Ancient_Rome'},
  {terms:['자연법'], url:'https://en.wikipedia.org/wiki/Natural_law'},
  {terms:['민족주의'], url:'https://en.wikipedia.org/wiki/Nationalism'},
  {terms:['마르크스주의'], url:'https://en.wikipedia.org/wiki/Marxism'},
  {terms:['정신분석'], url:'https://en.wikipedia.org/wiki/Psychoanalysis'},
  {terms:['무의식'], url:'https://en.wikipedia.org/wiki/Unconscious_mind'},
  {terms:['오리엔탈리즘'], url:'https://en.wikipedia.org/wiki/Orientalism'},
  {terms:['폼페이'], url:'https://en.wikipedia.org/wiki/Pompeii'},
  {terms:['헤르쿨라네움'], url:'https://en.wikipedia.org/wiki/Herculaneum'},
  {terms:['그랜드 투어'], url:'https://en.wikipedia.org/wiki/Grand_Tour'},
  {terms:['로열 아카데미'], url:'https://en.wikipedia.org/wiki/Royal_Academy_of_Arts'},
  {terms:['프랑스 아카데미'], url:'https://en.wikipedia.org/wiki/Acad%C3%A9mie_royale_de_peinture_et_de_sculpture'},
  {terms:['미술 아카데미'], url:'https://en.wikipedia.org/wiki/Art_school'},
  {terms:['낙선전'], url:'https://en.wikipedia.org/wiki/Salon_des_Refus%C3%A9s'},
  {terms:['살롱'], url:'https://en.wikipedia.org/wiki/Salon_(Paris)'},
  {terms:['오스만의 파리 개조'], url:'https://en.wikipedia.org/wiki/Haussmann%27s_renovation_of_Paris'},
  {terms:['로카유'], url:'https://en.wikipedia.org/wiki/Rocaille'},
  {terms:['페트 갈랑트'], url:'https://en.wikipedia.org/wiki/F%C3%AAte_galante'},
  {terms:['베두타'], url:'https://en.wikipedia.org/wiki/Veduta'},
  {terms:['프레스코'], url:'https://en.wikipedia.org/wiki/Fresco'},
  {terms:['템페라'], url:'https://en.wikipedia.org/wiki/Tempera'},
  {terms:['유화'], url:'https://en.wikipedia.org/wiki/Oil_painting'},
  {terms:['선원근법','원근법'], url:'https://en.wikipedia.org/wiki/Linear_perspective'},
  {terms:['키아로스쿠로','명암법'], url:'https://en.wikipedia.org/wiki/Chiaroscuro'},
  {terms:['테네브리즘'], url:'https://en.wikipedia.org/wiki/Tenebrism'},
  {terms:['스푸마토'], url:'https://en.wikipedia.org/wiki/Sfumato'},
  {terms:['단축법'], url:'https://en.wikipedia.org/wiki/Foreshortening'},
  {terms:['콘트라포스토'], url:'https://en.wikipedia.org/wiki/Contrapposto'},
  {terms:['디세뇨','disegno'], url:'https://en.wikipedia.org/wiki/Disegno'},
  {terms:['프리즈'], url:'https://en.wikipedia.org/wiki/Frieze'},
  {terms:['모자이크'], url:'https://en.wikipedia.org/wiki/Mosaic'},
  {terms:['스테인드글라스'], url:'https://en.wikipedia.org/wiki/Stained_glass'},
  {terms:['첨두아치'], url:'https://en.wikipedia.org/wiki/Pointed_arch'},
  {terms:['리브 볼트'], url:'https://en.wikipedia.org/wiki/Rib_vault'},
  {terms:['플라잉 버트레스'], url:'https://en.wikipedia.org/wiki/Flying_buttress'},
  {terms:['이콘'], url:'https://en.wikipedia.org/wiki/Icon'},
  {terms:['제단화'], url:'https://en.wikipedia.org/wiki/Altarpiece'},
  {terms:['패널화'], url:'https://en.wikipedia.org/wiki/Panel_painting'},
  {terms:['초상화'], url:'https://en.wikipedia.org/wiki/Portrait_painting'},
  {terms:['풍경화'], url:'https://en.wikipedia.org/wiki/Landscape_painting'},
  {terms:['정물화'], url:'https://en.wikipedia.org/wiki/Still_life'},
  {terms:['풍속화'], url:'https://en.wikipedia.org/wiki/Genre_art'},
  {terms:['역사화'], url:'https://en.wikipedia.org/wiki/History_painting'},
  {terms:['알레고리'], url:'https://en.wikipedia.org/wiki/Allegory'},
  {terms:['목판화'], url:'https://en.wikipedia.org/wiki/Woodcut'},
  {terms:['동판화'], url:'https://en.wikipedia.org/wiki/Engraving'},
  {terms:['에칭'], url:'https://en.wikipedia.org/wiki/Etching'},
  {terms:['석판화'], url:'https://en.wikipedia.org/wiki/Lithography'},
  {terms:['콜라주'], url:'https://en.wikipedia.org/wiki/Collage'},
  {terms:['아상블라주'], url:'https://en.wikipedia.org/wiki/Assemblage_(art)'},
  {terms:['레디메이드'], url:'https://en.wikipedia.org/wiki/Readymades_of_Marcel_Duchamp'},
  {terms:['포토몽타주'], url:'https://en.wikipedia.org/wiki/Photomontage'},
  {terms:['자동기술'], url:'https://en.wikipedia.org/wiki/Automatism_(art)'},
  {terms:['프로타주'], url:'https://en.wikipedia.org/wiki/Frottage_(art)'},
  {terms:['데칼코마니'], url:'https://en.wikipedia.org/wiki/Decalcomania'},
  {terms:['타이포그래피'], url:'https://en.wikipedia.org/wiki/Typography'},
  {terms:['선언문'], url:'https://en.wikipedia.org/wiki/Manifesto'}
];
const uHangulDocumentIntegration = `<link rel="stylesheet" href="../../uhangul/uhangul-runtime.css?v=0.7" data-uhangul-integration="v0.7">\n<script defer src="../../uhangul/uhangul-runtime.js?v=0.7" data-uhangul-integration="v0.7"></script>`;
const movementPioneerContexts = {
  '비잔틴 미술':'<b>문제의식:</b> 고대의 자연주의를 단순히 되살리기보다, 그리스도교의 초월적 진리와 전례 속 만남을 어떤 시각 언어로 보일지 탐구했다. <b>돌파:</b> 이콘·모자이크·프레스코, 금빛 바탕, 정면성·위계·상징색으로 성스러운 현존을 구성했으며, 후기에는 더 유연한 선·몸짓·서사와 공간의 암시를 더해 정서적 밀도를 높였다.',
  '고딕 미술':'<b>문제의식:</b> 로마네스크의 무거운 벽과 어두운 실내가 공동체의 빛·상승감·풍부한 성서 서사를 충분히 담지 못한다고 보았다. <b>돌파:</b> 첨두아치·리브 볼트·플라잉 버트레스로 하중을 분산하고 벽을 큰 창으로 열었으며, 스테인드글라스·포털 조각·필사본의 빛과 연속된 이야기로 신앙 경험을 확장했다.',
  '도나우파':'<b>문제의식:</b> 이탈리아 르네상스의 안정된 비례와 인간 중심의 질서가 북쪽의 거칠고 낯선 자연을 충분히 설명하지 못한다고 보았다. <b>돌파:</b> 알트도르퍼와 크라나흐 주변의 화가들은 인물을 작게 밀어 넣고, 빽빽한 숲·폭풍·낮은 시점·강한 명암과 녹갈색·청색의 층으로 자연 자체를 사건의 주인공으로 만들었다.',
  '낭만주의':'<b>문제의식:</b> 신고전주의의 이성·교훈·규범적 역사화가 개인의 공포, 열망, 자연의 압도적 힘을 지나치게 정돈한다고 비판했다. <b>돌파:</b> 여행 스케치와 현장 관찰, 극적인 빛과 색, 불안정한 구도, 문학·중세·이국적 소재를 통해 주관적 감정과 숭고를 화면의 중심으로 삼았다.',
  '르네상스':'<b>문제의식:</b> 중세의 상징적 위계와 평면적 공간만으로는 인간의 몸·도시·자연을 경험하는 현실감을 담기 어렵다고 보았다. <b>돌파:</b> 고대 문헌과 유적 연구, 해부·원근법·기하학·광학, 유화와 명암 모델링을 결합해 측정 가능한 공간과 설득력 있는 인간상을 구축했다.',
  '러시아 아방가르드':'<b>문제의식:</b> 아카데미의 재현·장식·부르주아 미술 제도가 급변하는 도시·혁명·기술의 감각을 따라가지 못한다고 비판했다. <b>돌파:</b> 원시미술·민속 이미지·큐비즘·미래주의를 흡수해 분절된 형태, 광선, 비대상 색면, 실험 전시와 선언문으로 새로운 시각 언어를 만들었다.',
  '신고전주의':'<b>문제의식:</b> 로코코의 사적 쾌락과 과잉 장식이 공적 책임·도덕·시민성의 요구를 흐린다고 보았다. <b>돌파:</b> 폼페이·헤르쿨라네움 발굴과 고고학 자료, 고대 조각의 선명한 윤곽, 절제된 색, 엄격한 구도와 역사화로 덕목을 시각화했다.',
  '야수주의':'<b>문제의식:</b> 인상주의의 관찰된 빛과 자연주의 색이 화가의 정서와 화면의 장식적 힘을 제한한다고 보았다. <b>돌파:</b> 튜브 물감의 강한 원색을 섞지 않고 넓게 바르고, 실제 색과 다른 보색·검은 윤곽·단순한 형태로 감각적 색 자체를 독립시켰다.',
  '바우하우스':'<b>문제의식:</b> 순수미술과 공예의 분리, 장식 과잉, 산업 생산품의 낮은 질이 현대 생활을 위한 통합 설계를 방해한다고 보았다. <b>돌파:</b> 기초과정, 작업장 교육, 재료 실험, 표준화·모듈·타이포그래피와 공장 협업을 통해 예술·기술·생활을 연결했다.',
  '바로크의 두 계열':'<b>문제의식:</b> 후기 르네상스와 매너리즘의 인공적 우아함이 신앙의 긴장과 현실의 육체성을 충분히 전달하지 못한다고 보았다. <b>돌파:</b> 카라바조 계열은 실제 모델·근접 구도·테네브리즘으로, 카라치 계열은 자연 관찰과 고전적 드로잉·프레스코 서사로 서로 다른 설득의 방식을 만들었다.',
  '상징주의':'<b>문제의식:</b> 사실주의와 인상주의가 눈에 보이는 사회·순간의 감각에 머물러 꿈, 죽음, 욕망, 신화의 내적 의미를 놓친다고 보았다. <b>돌파:</b> 문학·음악·신화의 연상, 평면적 장식, 비현실적 색과 반복되는 상징을 통해 직접 묘사보다 암시와 해석을 선택했다.',
  '비더마이어':'<b>문제의식:</b> 검열과 복고 정치 아래 거대한 영웅 서사나 노골적 정치 발언이 현실적 삶을 담지 못한다고 보았다. <b>돌파:</b> 작은 실내, 가족, 시민의 일상, 정확한 세부와 친밀한 시선으로 공적 격변 속 사적 세계를 기록했다.',
  '러시아 이콘화':'<b>문제의식:</b> 이미지를 단순한 현실 모사나 장식으로 다루는 방식 대신, 성스러운 인물과 만나는 매개가 필요하다고 보았다. <b>돌파:</b> 템페라와 금박, 역원근법, 정해진 도상·색·비례, 공방의 전승 규칙으로 시간 밖의 영적 현존을 형상화했다.',
  '매너리즘':'<b>문제의식:</b> 전성기 르네상스가 이룬 균형, 조화, 자연스러운 인체, 명료한 원근 공간이 너무 완성되어 더 이상 새롭지 않다고 보았다. 라파엘로식 안정과 미켈란젤로식 영웅적 인체를 그대로 반복하면 회화가 공식처럼 굳어질 위험이 있었다. <b>돌파:</b> 자연스러운 재현보다 화가의 세련된 방식, 의도적 왜곡, 길어진 인체, 불안정한 공간, 복잡한 자세, 차갑고 인공적인 색채, 지적인 알레고리를 앞세워 르네상스의 완성된 질서를 일부러 흔들었다.',
  '사실주의':'<b>문제의식:</b> 아카데미의 역사화와 낭만주의의 영웅·이국 취향이 노동, 빈곤, 도시의 현재를 배제한다고 비판했다. <b>돌파:</b> 현장 관찰, 사진과 판화, 거친 붓질, 큰 화면에 농민·노동자·평범한 사물을 올려 동시대 사회를 직접 다뤘다.',
  '신즉물주의':'<b>문제의식:</b> 전후 독일에서 표현주의의 격정적 왜곡이 상처 입은 사회의 구체적 권력·계급·도시 현실을 흐린다고 보았다. <b>돌파:</b> 차가운 윤곽, 매끈한 표면, 사진 같은 세부, 신랄한 초상과 풍자를 통해 관찰 가능한 현실을 거리 두고 해부했다.',
  '후기 인상주의':'<b>문제의식:</b> 인상주의의 순간적 빛과 느슨한 붓질만으로는 형태의 구조, 지속하는 감정, 상징과 질서를 충분히 만들기 어렵다고 보았다. <b>돌파:</b> 세잔의 기하학적 구축, 고흐의 방향성 붓질, 고갱의 평면색과 종합주의처럼 각자 색·선·형태를 자율적 구조로 재조직했다.',
  '입체주의':'<b>문제의식:</b> 한 시점의 원근법과 환영적 명암이 사물을 실제로 이해하는 여러 관점과 시간성을 숨긴다고 보았다. <b>돌파:</b> 피카소와 브라크는 대상을 면과 기하학으로 분해·동시 제시하고, 제한된 색·콜라주·신문·모래 같은 실제 재료로 평면의 물성을 드러냈다.',
  '이동파':'<b>문제의식:</b> 제국미술아카데미의 고전적 과제와 수도 중심 전시가 러시아 사회의 현실과 관객을 배제한다고 비판했다. <b>돌파:</b> 협회와 순회전시를 조직하고, 농민·노동·사회문제·자연을 사실적으로 그려 작품을 여러 도시의 대중에게 직접 보냈다.',
  '러시아 상징주의':'<b>문제의식:</b> 사실주의의 사회 관찰과 물질적 현실만으로는 종교·꿈·민족 신화·내면의 불안을 설명하기 어렵다고 보았다. <b>돌파:</b> 시·연극·음악과의 교류, 이콘·민속·중세 도상의 재해석, 장식적 색면과 암시적 인물로 보이지 않는 의미망을 만들었다.',
  '절대주의':'<b>문제의식:</b> 사물 재현과 서사, 회화의 대상 의존이 순수한 감각과 형태의 힘을 가로막는다고 보았다. <b>돌파:</b> 말레비치는 검은 사각형에서 출발해 사각형·원·십자가·흰 바탕과 제한된 색을 비대상적으로 배열하여 회화를 대상 없는 지각의 장으로 만들었다.',
  '초현실주의':'<b>문제의식:</b> 전쟁 뒤 이성·상식·도덕이 인간을 해방한다는 믿음과 의식적 통제가 욕망과 무의식을 억압한다고 보았다. <b>돌파:</b> 프로이트의 이론, 자동기술, 꿈 기록, 우연한 결합, 콜라주·프로타주·데칼코마니와 정밀 환영화를 통해 논리 밖의 이미지를 생산했다.',
  '표현주의':'<b>문제의식:</b> 자연주의와 인상주의의 시각적 정확성이 산업화·도시·전쟁 전야의 불안과 개인의 내면을 중립화한다고 보았다. <b>돌파:</b> 강렬한 비자연색, 거친 붓질, 목판화의 날카로운 선, 왜곡된 형태와 원시미술·민속미술의 단순화를 이용해 감정을 외부화했다.',
  '로코코':'<b>문제의식:</b> 바로크의 무거운 종교·왕권 연출이 섭정기와 귀족 살롱의 친밀한 사교 문화를 담기에 지나치게 장엄하다고 보았다. <b>돌파:</b> 작은 형식, 파스텔, 곡선 로카유 장식, 가벼운 붓질과 연극적·목가적 장면으로 사적 즐거움과 감각을 세련되게 만들었다.',
  '인상주의':'<b>문제의식:</b> 아카데미의 완성된 역사화와 스튜디오의 갈색 명암이 실제 눈앞에서 변하는 빛·대기·도시의 시간을 고정한다고 보았다. <b>돌파:</b> 휴대용 튜브 물감과 야외 제작, 빠른 분할 붓질, 밝은 팔레트와 보색을 이용해 순간의 시각 경험을 포착했다.',
  '사회주의적 사실주의':'<b>문제의식:</b> 혁명 이후의 추상 실험과 개인주의적 전위가 대중에게 읽히지 않고 사회주의 건설의 목표를 공유하지 못한다고 판단했다. <b>돌파:</b> 이해하기 쉬운 사실적 서사, 영웅적 노동자·농민, 밝은 미래 지향의 구성과 국가 전시·교육 제도를 통해 이념적 낙관을 조직했다.',
  '러시아 바로크':'<b>문제의식:</b> 중세 모스크바 전통만으로는 서구화와 제국화가 요구한 새로운 궁정·도시·국가 이미지를 만들기 어렵다고 보았다. <b>돌파:</b> 러시아 정교회 장식과 서유럽의 기둥·박공·대칭·화려한 파사드를 현지 장인·궁정 후원·새 수도 상트페테르부르크 건설에 결합했다.',
  '다다':'<b>문제의식:</b> 제1차 세계대전을 낳은 합리성, 민족주의, 제도화된 예술의 의미와 품위를 근본적으로 의심했다. <b>돌파:</b> 우연·무의미한 소리시·퍼포먼스, 레디메이드, 포토몽타주, 신문 조각과 반예술 전시로 작품의 저자성·기술·가치를 공격했다.',
  '구성주의':'<b>문제의식:</b> 독립된 이젤 그림과 고급 예술이 혁명 이후의 집단적 생산·생활과 분리돼 있다고 보았다. <b>돌파:</b> 산업 재료·구조 실험, 기하학, 사진몽타주, 포스터·타이포그래피·직물·무대·제품 설계로 예술가를 사회적 설계자로 재정의했다.'
};
const movementPioneerDocumentContextByName = {
  'Byzantine art':'비잔틴 미술',
  'Gothic art':'고딕 미술',
  'Mannerism':'매너리즘',
  'Baroque':'바로크의 두 계열',
  'Rococo':'로코코',
  'Neoclassicism':'신고전주의',
  'Romanticism':'낭만주의',
  'Realism':'사실주의',
  'Impressionism':'인상주의',
  'Post-Impressionism':'후기 인상주의',
  'Fauvism':'야수주의',
  'Cubism':'입체주의',
  'Surrealism':'초현실주의',
  'Dada':'다다',
  'Biedermeier':'비더마이어',
  'Symbolism':'상징주의',
  'Expressionism':'표현주의',
  'New Objectivity':'신즉물주의',
  'Bauhaus':'바우하우스',
  'Danube School':'도나우파',
  'Renaissance':'르네상스',
  'Northern Renaissance':'르네상스',
  'Danish Renaissance':'르네상스',
  'Nordic Renaissance':'르네상스',
  'Russian icon painting':'러시아 이콘화',
  'Russian Realism':'사실주의',
  'Peredvizhniki':'이동파',
  'Russian Baroque':'러시아 바로크',
  'Russian Symbolism':'러시아 상징주의',
  'Russian avant-garde':'러시아 아방가르드',
  'Suprematism':'절대주의',
  'Constructivism':'구성주의',
  'Socialist realism':'사회주의적 사실주의'
};
  Object.assign(context, { compactArtistName, movementArtistAliasOverrides, movementArtistAliases, movementArtistLinkEntries, compactMovementName, movementNameKo, serverMovementSpec, serverArtistMovementDisplayRules, serverArtistMovementClassificationOverrides, serverArtistMovementFallbacks, serverArtistPrimaryMovement, serverArtistMovementDisplayLabel, stripMovementArtworkMovementLabels, movementCardArtist, normalizedMovementMiniLabelText, redundantArtistMiniLabelPattern, stripRedundantArtistMiniLabel, injectMovementLabelIntoCard, injectMovementArtworkMovementLabels, movementArtistLinkStyle, movementWikipediaTermLinkStyle, movementWikipediaTermLinks, uHangulDocumentIntegration, movementPioneerContexts, movementPioneerDocumentContextByName });
  return context;
};
