/*
 * Canonical person-name dictionary for source material.
 *
 * Only file contents are inspected: a name that appears solely in a file name
 * is intentionally ignored. Entries need both a foreign and Korean form; this
 * prevents guesses from being presented as a verified Korean name.
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildArtistMap, createNameRecord } = require('./build-uhangul-artist-map');

const root = path.resolve(__dirname, '..');
const dictionaryFile = path.join(root, 'data', 'person-name-dictionary.json');
const researchFile = path.join(root, 'data', 'person-name-research.json');
const artistsFile = path.join(root, 'data', 'artists.json');
const techniquesFile = path.join(root, 'data', 'techniques.json');
const curatedPersonOverrides = require('./important-artist-overrides.json');
const techniqueKoreanOverrides = {quadratura:'콰드라투라'};
const manualPersonOverrides = [
  {id:'albrecht-altdorfer', original:'Albrecht Altdorfer', korean:'알브레히트 알트도르퍼'},
  {id:'wolf-huber', original:'Wolf Huber', korean:'볼프 후버'},
  {id:'pontormo', original:'Pontormo', korean:'폰토르모'},
  {id:'parmigianino', original:'Parmigianino', korean:'파르미자니노'},
  {id:'bronzino', original:'Bronzino', korean:'브론치노'},
  {id:'rosso-fiorentino', original:'Rosso Fiorentino', korean:'로소 피오렌티노'},
  {id:'francesco-primaticcio', original:'Francesco Primaticcio', korean:'프리마티초'},
  {id:'el-greco', original:'El Greco', korean:'엘 그레코'},
  {id:'bartholomeus-spranger', original:'Bartholomeus Spranger', korean:'바르톨로메우스 슈프랑어'},
  {id:'giuseppe-arcimboldo', original:'Giuseppe Arcimboldo', korean:'주세페 아르침볼도'},
  // Names used in the regional / period comparison tables.  The short Korean
  // labels are intentional: table cells often omit a given name.
  {id:'masaccio-table', original:'Masaccio', korean:'마사초'},
  {id:'leonardo-table', original:'Leonardo da Vinci', korean:'레오나르도'},
  {id:'michelangelo-table', original:'Michelangelo Buonarroti', korean:'미켈란젤로'},
  {id:'raphael-table', original:'Raffaello Sanzio da Urbino', korean:'라파엘로'},
  {id:'giovanni-bellini', original:'Giovanni Bellini', korean:'조반니 벨리니'},
  {id:'giorgione', original:'Giorgione', korean:'조르조네'},
  {id:'titian-table', original:'Titian', korean:'티치아노'},
  {id:'jan-van-eyck-table', original:'Jan van Eyck', korean:'얀 반 에이크'},
  {id:'rogier-van-der-weyden', original:'Rogier van der Weyden', korean:'로히어르 반 데르 베이던'},
  {id:'albrecht-durer', original:'Albrecht Dürer', korean:'알브레히트 뒤러'},
  {id:'lucas-cranach', original:'Lucas Cranach the Elder', korean:'루카스 크라나흐'},
  {id:'hans-holbein-younger', original:'Hans Holbein the Younger', korean:'한스 홀바인 2세'},
  {id:'jean-clouet', original:'Jean Clouet', korean:'장 클루에'},
  {id:'francois-clouet', original:'François Clouet', korean:'프랑수아 클루에'},
  {id:'theodore-gericault', original:'Théodore Géricault', korean:'제리코'},
  {id:'eugene-delacroix', original:'Eugène Delacroix', korean:'들라크루아'},
  {id:'caspar-david-friedrich-table', original:'Caspar David Friedrich', korean:'카스파르 다비트 프리드리히'},
  {id:'turner-table', original:'J. M. W. Turner', korean:'터너'},
  {id:'constable-table', original:'John Constable', korean:'컨스터블'},
  {id:'francisco-goya', original:'Francisco Goya', korean:'프란시스코 고야'},
  {id:'thomas-cole', original:'Thomas Cole', korean:'토머스 콜'},
  {id:'frederic-edwin-church', original:'Frederic Edwin Church', korean:'프레더릭 에드윈 처치'},
  {id:'jacques-louis-david', original:'Jacques-Louis David', korean:'자크루이 다비드'},
  {id:'jean-auguste-dominique-ingres', original:'Jean-Auguste-Dominique Ingres', korean:'앵그르'},
  {id:'antonio-canova', original:'Antonio Canova', korean:'안토니오 카노바'},
  {id:'joshua-reynolds', original:'Joshua Reynolds', korean:'조슈아 레이놀즈'},
  {id:'robert-adam', original:'Robert Adam', korean:'로버트 애덤'},
  {id:'johann-joachim-winkelmann', original:'Johann Joachim Winckelmann', korean:'요한 요아힘 빙켈만'},
  {id:'anton-raphael-mengs', original:'Anton Raphael Mengs', korean:'안톤 라파엘 멩스'},
  {id:'benjamin-west', original:'Benjamin West', korean:'벤저민 웨스트'},
  {id:'thomas-jefferson', original:'Thomas Jefferson', korean:'토머스 제퍼슨'},
  {id:'jean-honore-fragonard', original:'Jean-Honoré Fragonard', korean:'프라고나르'},
  {id:'paul-gauguin', original:'Paul Gauguin', korean:'고갱'},
  {id:'georges-seurat', original:'Georges Seurat', korean:'쇠라'},
  {id:'henri-matisse', original:'Henri Matisse', korean:'마티스'},
  {id:'andre-derain', original:'André Derain', korean:'드랭'},
  {id:'maurice-vlaminck', original:'Maurice de Vlaminck', korean:'블라맹크'},
  {id:'ernst-ludwig-kirchner', original:'Ernst Ludwig Kirchner', korean:'키르히너'},
  {id:'erich-heckel', original:'Erich Heckel', korean:'헤켈'},
  {id:'bela-czobel', original:'Béla Czóbel', korean:'벨러 초벨'},
  {id:'natalia-goncharova', original:'Natalia Goncharova', korean:'나탈리아 곤차로바'},
  {id:'mikhail-larionov', original:'Mikhail Larionov', korean:'미하일 라리오노프'},
  {id:'gian-lorenzo-bernini', original:'Gian Lorenzo Bernini', korean:'베르니니'},
  {id:'anthony-van-dyck', original:'Anthony van Dyck', korean:'안토니 반 다이크'},
  {id:'rembrandt-table', original:'Rembrandt van Rijn', korean:'렘브란트'},
  {id:'johannes-vermeer-table', original:'Johannes Vermeer', korean:'베르메르'},
  {id:'diego-velazquez-table', original:'Diego Velázquez', korean:'벨라스케스'},
  {id:'francisco-zurbaran', original:'Francisco de Zurbarán', korean:'수르바란'},
  {id:'bartolome-esteban-murillo', original:'Bartolomé Esteban Murillo', korean:'무리요'},
  {id:'nicolas-poussin', original:'Nicolas Poussin', korean:'니콜라 푸생'},
  {id:'charles-le-brun', original:'Charles Le Brun', korean:'샤를 르브룅'},
  {id:'gustave-moreau', original:'Gustave Moreau', korean:'귀스타브 모로'},
  {id:'odilon-redon', original:'Odilon Redon', korean:'오딜롱 르동'},
  {id:'pierre-puvis-de-chavannes', original:'Pierre Puvis de Chavannes', korean:'퓌비 드 샤반'},
  {id:'fernand-khnopff', original:'Fernand Khnopff', korean:'페르낭 크노프'},
  {id:'james-ensor', original:'James Ensor', korean:'제임스 앙소르'},
  {id:'arnold-bocklin', original:'Arnold Böcklin', korean:'아르놀트 뵈클린'},
  {id:'franz-von-stuck', original:'Franz von Stuck', korean:'프란츠 폰 슈투크'},
  {id:'gustav-klimt', original:'Gustav Klimt', korean:'구스타프 클림트'},
  {id:'edvard-munch', original:'Edvard Munch', korean:'에드바르 뭉크'},
  {id:'mikhail-vrubel', original:'Mikhail Vrubel', korean:'미하일 브루벨'},
  {id:'viktor-borisov-musatov', original:'Viktor Borisov-Musatov', korean:'빅토르 보리소프무사토프'},
  {id:'gustave-courbet', original:'Gustave Courbet', korean:'쿠르베'},
  {id:'jean-francois-millet', original:'Jean-François Millet', korean:'밀레'},
  {id:'honore-daumier', original:'Honoré Daumier', korean:'도미에'},
  {id:'ilya-repin', original:'Ilya Repin', korean:'일리야 레핀'},
  {id:'vasily-perov', original:'Vasily Perov', korean:'바실리 페로프'},
  {id:'ivan-kramskoi', original:'Ivan Kramskoi', korean:'이반 크람스코이'},
  {id:'adolph-menzel', original:'Adolph Menzel', korean:'아돌프 멘첼'},
  {id:'winslow-homer', original:'Winslow Homer', korean:'윈슬로 호머'},
  {id:'thomas-eakins', original:'Thomas Eakins', korean:'토머스 에이킨스'},
  {id:'ivan-shishkin', original:'Ivan Shishkin', korean:'시시킨'},
  {id:'isaac-levitan', original:'Isaac Levitan', korean:'레비탄'},
  {id:'paul-cezanne', original:'Paul Cézanne', korean:'세잔'},
  {id:'henri-de-toulouse-lautrec-table', original:'Henri de Toulouse-Lautrec', korean:'툴루즈로트렉'},
  {id:'theo-van-rysselberghe', original:'Théo van Rysselberghe', korean:'테오 반 리셀베르허'},
  {id:'roger-fry', original:'Roger Fry', korean:'로저 프라이'},
  {id:'pablo-picasso', original:'Pablo Picasso', korean:'피카소'},
  {id:'georges-braque', original:'Georges Braque', korean:'브라크'},
  {id:'juan-gris', original:'Juan Gris', korean:'후안 그리스'},
  {id:'umberto-boccioni', original:'Umberto Boccioni', korean:'보초니'},
  {id:'giacomo-balla', original:'Giacomo Balla', korean:'발라'},
  {id:'gino-severini', original:'Gino Severini', korean:'세베리니'},
  {id:'kazimir-malevich', original:'Kazimir Malevich', korean:'말레비치'},
  {id:'lyubov-popova', original:'Lyubov Popova', korean:'포포바'},
  {id:'vladimir-tatlin', original:'Vladimir Tatlin', korean:'타틀린'},
  {id:'emil-filla', original:'Emil Filla', korean:'에밀 필라'},
  {id:'pavel-janak', original:'Pavel Janák', korean:'파벨 야나크'},
  {id:'wyndham-lewis', original:'Wyndham Lewis', korean:'윈덤 루이스'},
  {id:'edward-wadsworth', original:'Edward Wadsworth', korean:'에드워드 워즈워스'},
  {id:'andre-breton', original:'André Breton', korean:'앙드레 브르통'},
  {id:'andre-masson', original:'André Masson', korean:'앙드레 마송'},
  {id:'salvador-dali', original:'Salvador Dalí', korean:'살바도르 달리'},
  {id:'joan-miro', original:'Joan Miró', korean:'호안 미로'},
  {id:'rene-magritte', original:'René Magritte', korean:'르네 마그리트'},
  {id:'paul-delvaux', original:'Paul Delvaux', korean:'폴 델보'},
  {id:'remedios-varo', original:'Remedios Varo', korean:'레메디오스 바로'},
  {id:'leonora-carrington', original:'Leonora Carrington', korean:'레오노라 캐링턴'},
  {id:'arshile-gorky', original:'Arshile Gorky', korean:'아쉴 고키'},
  {id:'robert-motherwell', original:'Robert Motherwell', korean:'로버트 마더웰'},
  {id:'wassily-kandinsky', original:'Wassily Kandinsky', korean:'칸딘스키'},
  {id:'franz-marc', original:'Franz Marc', korean:'프란츠 마르크'},
  {id:'august-macke', original:'August Macke', korean:'아우구스트 마케'},
  {id:'egon-schiele', original:'Egon Schiele', korean:'에곤 실레'},
  {id:'oskar-kokoschka', original:'Oskar Kokoschka', korean:'오스카 코코슈카'},
  {id:'marcel-duchamp', original:'Marcel Duchamp', korean:'뒤샹'},
  {id:'francis-picabia', original:'Francis Picabia', korean:'피카비아'},
  {id:'man-ray', original:'Man Ray', korean:'만 레이'},
  {id:'hannah-hoch', original:'Hannah Höch', korean:'회흐'},
  {id:'raoul-hausmann', original:'Raoul Hausmann', korean:'하우스만'},
  {id:'george-grosz', original:'George Grosz', korean:'그로스'},
  {id:'john-heartfield', original:'John Heartfield', korean:'하트필드'},
  {id:'kurt-schwitters', original:'Kurt Schwitters', korean:'슈비터스'},
  {id:'hugo-ball', original:'Hugo Ball', korean:'후고 발'},
  {id:'emmy-hennings', original:'Emmy Hennings', korean:'에미 헤닝스'},
  {id:'tristan-tzara', original:'Tristan Tzara', korean:'차라'},
  {id:'hans-arp', original:'Hans Arp', korean:'아르프'},
  {id:'louis-aragon', original:'Louis Aragon', korean:'아라공'},
  {id:'alexander-rodchenko', original:'Alexander Rodchenko', korean:'알렉산드르 로드첸코'},
  {id:'varvara-stepanova', original:'Varvara Stepanova', korean:'스테파노바'},
  {id:'el-lissitzky', original:'El Lissitzky', korean:'리시츠키'},
  {id:'isaac-brodsky', original:'Isaac Brodsky', korean:'브로드스키'},
  {id:'alexander-deineka', original:'Alexander Deyneka', korean:'데이네카'},
  {id:'alexander-gerasimov', original:'Alexander Gerasimov', korean:'게라시모프'},
  {id:'antoine-watteau', original:'Antoine Watteau', korean:'와토'},
  {id:'francois-boucher', original:'François Boucher', korean:'부셰'},
  {id:'zimmermann-brothers', original:'Zimmermann brothers', korean:'치머만 형제'},
  {id:'balthasar-neumann', original:'Balthasar Neumann', korean:'노이만'},
  {id:'asam-brothers', original:'Asam brothers', korean:'아삼 형제'},
  {id:'giambattista-tiepolo', original:'Giambattista Tiepolo', korean:'티에폴로'},
  {id:'canaletto', original:'Canaletto', korean:'카날레토'},
  {id:'thomas-gainsborough', original:'Thomas Gainsborough', korean:'토머스 게인즈버러'},
  {id:'william-hogarth', original:'William Hogarth', korean:'윌리엄 호가스'},
  {id:'pierre-auguste-renoir', original:'Pierre-Auguste Renoir', korean:'르누아르'},
  {id:'edgar-degas', original:'Edgar Degas', korean:'드가'},
  {id:'berthed-morisot', original:'Berthe Morisot', korean:'모리조'},
  {id:'camille-pissarro', original:'Camille Pissarro', korean:'피사로'},
  {id:'mary-cassatt', original:'Mary Cassatt', korean:'메리 카사트'},
  {id:'childe-hassam', original:'Childe Hassam', korean:'차일드 해섬'},
  {id:'john-singer-sargent', original:'John Singer Sargent', korean:'존 싱어 사전트'},
  {id:'walter-sickert', original:'Walter Sickert', korean:'월터 시커트'},
  {id:'philip-wilson-steer', original:'Philip Wilson Steer', korean:'필립 윌슨 스티어'},
  {id:'tom-roberts', original:'Tom Roberts', korean:'톰 로버츠'},
  {id:'arthur-streeton', original:'Arthur Streeton', korean:'아서 스트리튼'}
];
const textExtensions = new Set(['.html', '.htm', '.json', '.js', '.md', '.txt']);
const skippedDirectories = new Set(['.git', 'node_modules', 'logs', 'backups', 'thumbnails', 'high-resolution', 'images', 'generated', 'delivery', '.uhangul-backup']);
const koreanName = '[가-힣]{2,}(?:\\s+[가-힣]{1,}){0,5}';
const foreignWord = "[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*";
const foreignJoiner = "(?:de|del|della|da|di|du|van|von|der|den|ten|ter|la|le|st\\.)";
const foreignName = `${foreignWord}(?:\\s+(?:${foreignWord}|${foreignJoiner})){1,5}`;
const pairedNamePattern = new RegExp(`(${koreanName})\\s*[（(]\\s*(${foreignName})\\s*[)）]`, 'g');
const linkedNamePattern = /data-uh-original="([^"]+)"[^>]*data-uh-korean="([^"]+)"/g;

function decodeHtml(value) {
  return String(value || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function idFor(original, korean) {
  return `name-${normalize(original || korean).slice(0, 96) || 'unknown'}`;
}

function cleanAliasList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim().replace(/\s+/g, ' ')).filter(item => item.length >= 2))];
}

function normalizeAliases(value = {}) {
  if (Array.isArray(value)) return {ko:cleanAliasList(value), en:[]};
  return {
    ko: cleanAliasList(value.ko),
    en: cleanAliasList(value.en)
  };
}

function mergeAliases(...values) {
  const merged = {ko:[], en:[]};
  for (const value of values) {
    const aliases = normalizeAliases(value);
    merged.ko.push(...aliases.ko);
    merged.en.push(...aliases.en);
  }
  return normalizeAliases(merged);
}

function isPersonLike(original, korean, strict = false) {
  if (!original || !korean || original.length > 90 || korean.length > 50) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(original) || !/[가-힣]/.test(korean)) return false;
  const blocked = /^(English|Korean|French|German|Italian|Spanish|Dutch|Latin|Greek|Japanese|Chinese|Wikipedia|Wikidata)$/i;
  const nonPerson = /\b(Art|Artist|Arts|Painting|Perspective|Technique|School|Movement|Expressionism|Impressionism|Cubism|Realism|Classicism|Renaissance|Baroque|Rococo|Mannerism|Surrealism|Futurism|Dada|Constructivism|Symbolism|Avant-Garde|Artisan|Craftsman|Workshop|Unknown)\b/i;
  const koreanNonPerson = /(주의|기법|원근법|미술|화파|예술|사조|파|갤러리|교회|별장|유산|성당)$/;
  // Do not reject a real person's surname merely because it can also be an
  // institution word (for example, landscape painter Frederic Edwin Church).
  const institution = /\b(Auberge|Brasserie|Église|Eglise|Cathedral|Museum|Gallery|Theatre|Theater|Palace|University|Folies)\b/i;
  const workTitleLead = /^(The|A|An|Le|La|Les|Die|Der|Das|Madame|Madonna|Salvator|Vitruvian|Russian|Silver)\b/i;
  const originalWords = original.trim().split(/\s+/).length;
  const koreanWords = korean.trim().split(/\s+/).length;
  return !blocked.test(original.trim()) && !nonPerson.test(original) && !koreanNonPerson.test(korean) && !institution.test(original) && !workTitleLead.test(original)
    && (!strict || (originalWords >= 2 && koreanWords <= originalWords + 1));
}

function addEntry(entries, original, korean, source, id, strict = false, kind = 'person', aliases = {}, displayKorean = '') {
  original = String(original || '').trim().replace(/\s+/g, ' ');
  korean = String(korean || '').trim().replace(/\s+/g, ' ');
  if (strict) {
    // In prose, the Korean capture can include a preceding clause. A person's
    // Korean name has no more parts than its foreign form (apart from particles
    // such as de/van), so retain the adjacent tail only.
    const limit = Math.min(5, original.split(/\s+/).length);
    const words = korean.split(/\s+/);
    if (words.length > limit) korean = words.slice(-limit).join(' ');
  }
  if (kind === 'person' && !isPersonLike(original, korean, strict)) return;
  if (kind === 'technique' && (!original || !korean)) return;
  const key = `${kind}\u001f${normalize(original)}\u001f${normalize(korean)}`;
  const nextRecord = createNameRecord({ id: id || idFor(original, korean), original, korean, displayKorean });
  const existing = entries.get(key);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    existing.aliases = mergeAliases(existing.aliases, nextRecord.aliases, aliases);
    if (displayKorean) {
      existing.id = id || existing.id;
      existing.displayKorean = nextRecord.displayKorean;
      existing.uhangul = nextRecord.uhangul;
    }
    return;
  }
  const record = {...nextRecord, aliases:mergeAliases(nextRecord.aliases, aliases)};
  entries.set(key, {...record, kind, sources:[source], status:'verified-pair'});
}

function collectLocalizedNames(value, source, entries, seen = new Set(), propertyName = '') {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value)) {
    const korean = typeof value.ko === 'string' ? value.ko : '';
    const original = typeof value.en === 'string' ? value.en : '';
    // Only explicit artist-name fields are accepted here. Generic `name` keys
    // also occur on movements, techniques, places, and artwork titles.
    if (/^artistName$/i.test(propertyName) && original && korean) addEntry(entries, original, korean, source, value.qid || value.id);
  }
  for (const [key, child] of Object.entries(value)) collectLocalizedNames(child, source, entries, seen, key);
}

function walk(directory, files = []) {
  let items = [];
  try { items = fs.readdirSync(directory, {withFileTypes:true}); }
  catch (_) { return files; }
  for (const item of items) {
    if (item.isDirectory()) {
      if (!skippedDirectories.has(item.name)) walk(path.join(directory, item.name), files);
    } else if (textExtensions.has(path.extname(item.name).toLowerCase())) {
      files.push(path.join(directory, item.name));
    }
  }
  return files;
}

function scanFile(file, entries) {
  const source = path.relative(root, file).replace(/\\/g, '/');
  let content = '';
  try { content = fs.readFileSync(file, 'utf8'); }
  catch (_) { return; }
  const extension = path.extname(file).toLowerCase();
  if (extension === '.json') {
    try { collectLocalizedNames(JSON.parse(content), source, entries); } catch (_) { /* plain-text scan below */ }
  }
  pairedNamePattern.lastIndex = 0;
  for (let match; (match = pairedNamePattern.exec(content));) addEntry(entries, match[2], match[1], source, '', true);
  linkedNamePattern.lastIndex = 0;
  for (let match; (match = linkedNamePattern.exec(content));) addEntry(entries, decodeHtml(match[1]), decodeHtml(match[2]), source);
}

function readManualRecords() {
  try {
    const prior = JSON.parse(fs.readFileSync(dictionaryFile, 'utf8'));
    return (prior.records || []).filter(record => record && record.status === 'manual');
  } catch (_) { return []; }
}

function readResearchRecords() {
  try {
    const payload = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
    return Array.isArray(payload.records) ? payload.records : [];
  } catch (_) { return []; }
}

function researchKey(record) {
  return `${record.kind || 'person'}\u001f${normalize(record.original)}\u001f${normalize(record.korean)}`;
}

function applyResearch(records) {
  const researched = new Map(readResearchRecords()
    .filter(record => record && record.status === 'matched' && record.original && record.korean)
    .map(record => [researchKey(record), record]));
  for (const record of records) {
    const research = researched.get(researchKey(record));
    if (!research) continue;
    record.aliases = mergeAliases(record.aliases, research.aliases);
    if (research.englishFullName) record.englishFullName = research.englishFullName;
    if (research.wikipediaTitle) record.wikipediaTitle = research.wikipediaTitle;
    if (research.wikidataQid) record.wikidataQid = research.wikidataQid;
    if (!record.sources.includes('Wikidata')) record.sources.push('Wikidata');
    record.note = 'Name, Wikipedia title, and aliases verified from Wikidata.';
  }
}

function syncPersonNameDictionary({artists, additionalFiles = []} = {}) {
  const entries = new Map();
  for (const record of readManualRecords()) {
    if (!isPersonLike(record.original, record.korean)) continue;
    entries.set(`${record.kind || 'person'}\u001f${normalize(record.original)}\u001f${normalize(record.korean)}`, {...record, aliases:normalizeAliases(record.aliases), sources:Array.isArray(record.sources) ? record.sources : []});
  }
  const sourceArtists = Array.isArray(artists) ? artists : JSON.parse(fs.readFileSync(artistsFile, 'utf8')).artists || [];
  for (const person of [...manualPersonOverrides, ...curatedPersonOverrides]) addEntry(entries, person.original, person.korean, 'data/미술사조/manual-person-overrides', person.id);
  const artistDisplayRecords = new Map(buildArtistMap(sourceArtists).map(record => [String(record.id || ''), record]));
  for (const artist of sourceArtists) {
    const artistId = artist?.qid || artist?.id;
    const displayKorean = artistDisplayRecords.get(String(artistId || ''))?.displayKorean || artist?.fullName || '';
    addEntry(entries, artist?.name?.en, artist?.name?.ko, 'data/artists.json', artistId, false, 'person', mergeAliases(artist?.aliases, {ko:[artist?.name?.ko], en:[artist?.name?.en]}), displayKorean);
  }
  const techniques = JSON.parse(fs.readFileSync(techniquesFile, 'utf8')).techniques || [];
  for (const technique of techniques) {
    const original = technique?.name?.en;
    const korean = techniqueKoreanOverrides[technique?.id] || technique?.name?.ko;
    addEntry(entries, original, korean, 'data/techniques.json', technique?.id, false, 'technique');
    for (const example of technique?.examples || []) addEntry(entries, example?.artist?.en, example?.artist?.ko, 'data/techniques.json', '', false, 'person');
  }
  const files = [...new Set([...walk(root), ...additionalFiles.map(file => path.resolve(file))])];
  for (const file of files) {
    if (file === dictionaryFile || !fs.existsSync(file)) continue;
    scanFile(file, entries);
  }
  const records = [...entries.values()];
  applyResearch(records);
  records.sort((a, b) => a.kind.localeCompare(b.kind) || a.original.localeCompare(b.original, 'en'));
  const payload = {schema:2, generatedAt:new Date().toISOString(), description:'Foreign person names and art techniques paired with standard Korean and uHangul notation. File names are not scanned.', records};
  fs.mkdirSync(path.dirname(dictionaryFile), {recursive:true});
  fs.writeFileSync(dictionaryFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return {records:records.length, file:path.relative(root, dictionaryFile).replace(/\\/g, '/')};
}

if (require.main === module) console.log(JSON.stringify(syncPersonNameDictionary(), null, 2));

module.exports = {syncPersonNameDictionary};
