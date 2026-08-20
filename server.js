/* Art Atlas local server: fetches Wikimedia metadata once, then stores it locally. */
const http = require('node:http');
const https = require('node:https');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const dns = require('node:dns/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { URL, fileURLToPath } = require('node:url');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { normalizeArtistsPayload, validateArtistsPayload, firebaseExport } = require('./data-contract');
const { invalidArtworkThumbnail } = require('./thumbnail-validation');
const { writeArtistMap: writeUHangulArtistMap } = require('./tools/build-uhangul-artist-map');
const { syncPersonNameDictionary } = require('./tools/sync-person-name-dictionary');
const root = __dirname, dataDir = path.join(root, 'data'), generatedDir = path.join(dataDir, 'generated'), highResolutionDir = path.join(dataDir, 'high-resolution'), imageStagingDir = path.join(dataDir, '.image-staging'), artistsFile = path.join(dataDir, 'artists.json'), techniquesFile = path.join(dataDir, 'techniques.json'), topicsFile = path.join(dataDir, 'topics.json'), topicImageDir = path.join(dataDir, 'topic-images'), backupsDir = path.join(dataDir, 'backups'), accessControlFile = path.join(dataDir, 'access-control.json'), migrationAssetManifestFile = path.join(dataDir, 'migration-assets.json'), auditLogFile = path.join(dataDir, 'audit-log.jsonl');
function loadLocalEnvironment() {
  try {
    for (const line of fsSync.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/,'$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
loadLocalEnvironment();
const adminEmail = String(process.env.ART_ATLAS_ADMIN_EMAIL || 'jhlee409@gmail.com').trim().toLowerCase();
const adminPassword = String(process.env.ART_ATLAS_ADMIN_PASSWORD || '');
const adminPasswordHash = adminPassword ? createHash('sha256').update(adminPassword,'utf8').digest() : null;
const adminSessions = new Map();
const adminSessionDurationMs = 12 * 60 * 60 * 1000;
const adminSessionIdleMs = 90 * 1000;
const jsonRequestBodyLimit = 12 * 1024 * 1024;
let accessControl = {schema:1,defaultRole:'viewer',roles:{[adminEmail]:'admin'}};
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2'};
const catalogueSchema = 20;
const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.ART_ATLAS_FFMPEG || (fsSync.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg');
const artistImportedWorkLimit = 60;
const highResolutionStoredLimit = 30 * 1024 * 1024;
const sourceImageInputLimit = 500 * 1024 * 1024;
let nextWikimediaRequestAt = 0;
let artistsWriteQueue = Promise.resolve();
let lastArtistsBackupAt = 0;
const externalHostValidation = new Map();
function normalizedEmail(value='') { return String(value || '').trim().toLowerCase(); }
function samePassword(value='') {
  if (!adminPasswordHash) return false;
  const candidate = createHash('sha256').update(String(value),'utf8').digest();
  return timingSafeEqual(candidate, adminPasswordHash);
}
function createAdminSession(email) {
  const now=Date.now();
  const token = randomBytes(32).toString('base64url');
  adminSessions.set(token,{email:normalizedEmail(email),expiresAt:now+adminSessionDurationMs,lastSeenAt:now});
  return token;
}
function activeAdminSession() {
  const now=Date.now();
  for (const [token,session] of adminSessions) {
    if (session.expiresAt <= now || now-session.lastSeenAt > adminSessionIdleMs) {
      adminSessions.delete(token);
      continue;
    }
    return session;
  }
  return null;
}
function adminSession(req) {
  const token = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1];
  const session = token && adminSessions.get(token);
  const now=Date.now();
  if (!session || session.expiresAt <= now || now-session.lastSeenAt > adminSessionIdleMs || !isAdminEmail(session.email)) { if (token) adminSessions.delete(token); return null; }
  session.lastSeenAt=now;
  return session;
}
function sendAdminRequired(res) { res.writeHead(401,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:'Administrator authentication is required'})); }
function requiresAdmin(req, pathname) {
  if (pathname === '/api/migration-export') return true;
  return req.method !== 'GET' && ['/api/artists','/api/techniques','/api/movement-documents','/api/movement-documents/refresh','/api/local-artwork-image','/api/topic-artworks','/api/topic-artwork-image','/api/topic-artwork','/api/artist-from-url','/api/normalize-artist-works','/api/artwork','/api/artwork-info','/api/thumbnail-from-url','/api/thumbnail-upload','/api/thumbnail','/api/enrich'].includes(pathname);
}
function isJsonRequest(req, pathname) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return false;
  if (pathname === '/api/movement-documents') return req.method === 'DELETE';
  return ['/api/auth/login','/api/artists','/api/techniques','/api/movement-documents/refresh','/api/artist-from-url','/api/normalize-artist-works','/api/artwork','/api/artwork-info','/api/thumbnail-from-url','/api/thumbnail','/api/enrich'].includes(pathname);
}
function enforceJsonRequestLimit(req, res, pathname) {
  if (!isJsonRequest(req, pathname)) return true;
  const declaredLength=Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > jsonRequestBodyLimit) {
    res.writeHead(413,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:false,error:'JSON request body exceeds the 12 MB limit'}));
    req.resume();
    return false;
  }
  let received=0, rejected=false;
  req.on('data',chunk => {
    received+=chunk.length;
    if (!rejected && received > jsonRequestBodyLimit) {
      rejected=true;
      res.writeHead(413,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify({ok:false,error:'JSON request body exceeds the 12 MB limit'}));
      req.destroy();
    }
  });
  return true;
}
async function readAccessControl() {
  try {
    const saved=JSON.parse(await fs.readFile(accessControlFile,'utf8'));
    if (saved && typeof saved.roles === 'object') accessControl={schema:1,defaultRole:saved.defaultRole || 'viewer',roles:saved.roles};
  } catch(error) { if(error.code !== 'ENOENT') throw error; }
  return accessControl;
}
function accessRole(email='') {
  const role=accessControl.roles?.[normalizedEmail(email)] || accessControl.defaultRole || 'viewer';
  return ['admin','viewer'].includes(role) ? role : 'viewer';
}
function isAdminEmail(email='') { return Boolean(adminPasswordHash) && normalizedEmail(email) === adminEmail && accessRole(email) === 'admin'; }
const accessControlReady=readAccessControl().catch(error => console.error('Could not read access control:',error.message));
function getJson(url, attempt=0) {
  const host=new URL(url).hostname, isWikimedia=host.endsWith('wikipedia.org') || host.endsWith('wikimedia.org');
  const wait=Math.max(0,nextWikimediaRequestAt-Date.now());
  if (wait) return new Promise(resolve=>setTimeout(resolve,wait)).then(()=>getJson(url,attempt));
  if (isWikimedia) nextWikimediaRequestAt=Date.now()+650;
  return new Promise((resolve, reject) => {
    const request=https.get(url,{headers:{'User-Agent':'ArtAtlasLocal/1.0 (educational project)'}},res=>{
      let body=''; res.setEncoding('utf8'); res.on('data',chunk=>body+=chunk);
      res.on('end',()=>{
        if(res.statusCode>=300 && res.statusCode<400 && res.headers.location) return getJson(new URL(res.headers.location,url).href,attempt).then(resolve,reject);
        if((res.statusCode===429 || res.statusCode>=500) && attempt<3) { const retryWait=Number(res.headers['retry-after'] || 2)*1000*(attempt+1); return setTimeout(()=>getJson(url,attempt+1).then(resolve,reject),retryWait); }
        if(res.statusCode!==200) return reject(new Error('Wikimedia returned '+res.statusCode));
        try { resolve(JSON.parse(body)); } catch(error) { reject(error); }
      });
    });
    request.setTimeout(12000,()=>request.destroy(new Error('Wikimedia request timed out')));
    request.on('error',reject);
  });
}
function getJsonFast(url) { return new Promise((resolve,reject) => { const request=https.get(url,{headers:{'User-Agent':'ArtAtlasLocal/1.0 (interactive search)'}},res=>{const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)request.destroy(new Error('Search response is too large'));else chunks.push(chunk);});res.on('end',()=>{if(res.statusCode!==200)return reject(new Error(`Search returned ${res.statusCode}`));try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}});}); request.setTimeout(12000,()=>request.destroy(new Error('Search request timed out'))); request.on('error',reject); }); }
const api = params => `https://www.wikidata.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',...params})}`;
const koreanArtistNameOverrides = {Q6394591:'바실리 푸키레프',Q104884:'카스파 다비드 프리드리히',Q5598:'렘브란트 하르먼손 판 레인'};
const englishArtistNameOverrides = {Q5598:'Rembrandt Harmenszoon van Rijn'};
const koreanArtworkTitleOverrides = {Q2030685:'성모의 결혼식',Q2277635:'라자로의 부활',Q3788158:'헷 펠스켄',Q596683:'새벽',Q1985071:'메디치 마돈나',Q1587929:'리젠게비르게의 아침',Q17493547:'독립전쟁 전몰자의 묘지',Q3649324:'숲속의 엽병',Q4310993:'범선 위에서',Q17321856:'정원 정자',Q18602479:'항구의 밤',Q18603131:'이른 아침 안개 속의 배',Q1423223:'바다 위의 달돋이',Q3139782:'달을 바라보는 남자와 여자',Q2517970:'눈 덮인 오두막',Q999836:'저녁 항구의 배들',Q17422064:'거인산맥의 엘데나 수도원 폐허',Q3822640:'드레스덴의 큰 울타리',Q4126323:'거인산맥의 추억',Q232087:'달을 바라보는 두 남자'};
const sparseArtistFeaturedWorks = {
  Q6394591:[{id:'featured-Q3918079',year:1862,title:{ko:'불평등한 결혼',en:'The Unequal Marriage'},country:{ko:'러시아 제국',en:'Russian Empire'},movement:{ko:'사실주의',en:'Realism'},image:'https://commons.wikimedia.org/wiki/Special:FilePath/Vasily_Pukirev_-_%D0%9D%D0%B5%D1%80%D0%B0%D0%B2%D0%BD%D1%8B%D0%B9_%D0%B1%D1%80%D0%B0%D0%BA_-_Google_Art_Project.jpg',description:{ko:'',en:''},source:'https://en.wikipedia.org/wiki/Vasili_Pukirev',verified:true,representative:true,popularity:1000}],
  Q762:[{id:'wikidata-Q128910',year:1495,title:{ko:'최후의 만찬',en:'The Last Supper'},country:{ko:'밀라노 공국',en:'Duchy of Milan'},movement:{ko:'전성기 르네상스',en:'High Renaissance'},image:'https://commons.wikimedia.org/wiki/Special:FilePath/Leonardo%20da%20Vinci%20%281452-1519%29%20-%20The%20Last%20Supper%20%281495-1498%29.jpg',description:{ko:'밀라노 산타 마리아 델레 그라치에 수도원 식당 벽에 그린 레오나르도의 대표 벽화입니다.',en:"Leonardo's landmark mural for the refectory of Santa Maria delle Grazie in Milan."},source:'https://en.wikipedia.org/wiki/The_Last_Supper_(Leonardo)',verified:true,representative:true,popularity:10000}],
  Q5592:[{id:'michelangelo-last-judgment',year:1541,title:{ko:'최후의 심판',en:'The Last Judgment'},country:{ko:'교황령',en:'Papal States'},movement:{ko:'매너리즘',en:'Mannerism'},image:'https://commons.wikimedia.org/wiki/Special:FilePath/Last%20Judgement%20%28Michelangelo%29.jpg',thumbnail:'https://commons.wikimedia.org/wiki/Special:FilePath/Last%20Judgement%20%28Michelangelo%29.jpg?width=240',description:{ko:'시스티나 성당 제단벽에 그린 미켈란젤로의 대형 프레스코화입니다.',en:"Michelangelo's monumental fresco on the altar wall of the Sistine Chapel."},source:'https://en.wikipedia.org/wiki/The_Last_Judgment_(Michelangelo)',verified:true,representative:true,popularity:10000}],
  Q42207:[{id:'wikidata-Q2277635',year:1609,title:{ko:'라자로의 부활',en:'The Raising of Lazarus'},country:{ko:'이탈리아',en:'Italy'},movement:{ko:'바로크',en:'Baroque'},image:'http://commons.wikimedia.org/wiki/Special:FilePath/Michelangelo%20Caravaggio%20006.jpg',thumbnail:'http://commons.wikimedia.org/wiki/Special:FilePath/Michelangelo%20Caravaggio%20006.jpg?width=240',description:{ko:'카라바조가 1609년경 메시나에서 제작한 대형 종교화입니다.',en:'Caravaggio painted this large religious work around 1609 in Messina.'},source:'https://en.wikipedia.org/wiki/The_Raising_of_Lazarus_(Caravaggio)',verified:true,representative:true,popularity:10000}]
};
// Only show entries described by Wikidata as painters or visual artists.  A name
// match alone is not enough: it often finds a surname, a philosopher, or a city.
async function artistSearchCandidates(query) {
  const request = language => getJsonFast(api({action:'wbsearchentities',search:query,language,uselang:'ko',type:'item',limit:'20'}));
  // Wikidata's Korean search does not always connect a common Korean surname
  // with its internationally catalogued painter (for example 프리드리히).
  const aliases = [
    ...(query.includes('프리드리히') ? [{query:'Caspar David Friedrich',label:'카스파 다비드 프리드리히'}] : []),
    ...(/바실리/.test(query) && /(푸키|프키)/.test(query) ? [{query:'Vassili Vladimirovich Pukiryov',label:'바실리 푸키레프'}] : [])
  ];
  const [korean, english, ...aliasResults] = await Promise.all([request('ko'), request('en'), ...aliases.map(alias => getJsonFast(api({action:'wbsearchentities',search:alias.query,language:'en',uselang:'ko',type:'item',limit:'5'})))]);
  const aliasLabels = new Map(aliasResults.flatMap((result,index) => (result.search || []).map(item => [item.id, aliases[index].label])));
  const raw = [...(korean.search || []), ...(english.search || []), ...aliasResults.flatMap(result => result.search || [])]
    .map(item => ({id:item.id,label:aliasLabels.get(item.id) || koreanArtistNameOverrides[item.id] || item.label,description:item.description || ''}))
    .filter((item,index,self) => self.findIndex(other => other.id === item.id) === index);
  return raw.filter(item => /painter|visual artist|화가|예술가/i.test(item.description));
}
const commonsApi = params => `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',...params})}`;
const wikipediaApi = params => `https://en.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',...params})}`;
const openverseApi = params => `https://api.openverse.org/v1/images?${new URLSearchParams(params)}`;
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
const selectionKey = work => {
  const qid = String(work.id || '').match(/^wikidata-Q\d+/)?.[0];
  if (qid) return qid;
  const title = normalized(work.title?.en || work.title?.ko);
  return title ? `${title}-${work.year || ''}` : String(work.id || '');
};
const isManualWork = work => work?.origin === 'manual';
const isGeneratedWork = work => !isManualWork(work) && /^(wikidata|wikipedia)-/.test(String(work.id || ''));
const workPopularity = work => Number.isFinite(Number(work.popularity)) ? Number(work.popularity) : 0;
const workYearForSort = work => {
  const year = Number(work?.year);
  return Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
};
const workMovementText = work => `${work?.movement?.ko || ''} ${work?.movement?.en || ''}`.toLocaleLowerCase();
function representativeScore(work, artist={}) {
  const source = String(work?.source || '');
  const movement = workMovementText(work);
  const artistMovement = `${artist?.movement?.ko || ''} ${artist?.movement?.en || ''}`.toLocaleLowerCase();
  let score = workPopularity(work);
  if (work?.origin === 'curated') score += 100000;
  if (work?.image || work?.thumbnail) score += 1200;
  if (work?.verified) score += 600;
  if (/wikidata\.org|commons\.wikimedia\.org|api\.artic\.edu|clevelandart\.org/i.test(source)) score += 420;
  if (/wikipedia\.org/i.test(source)) score -= 120;
  if (artistMovement && movement && (movement.includes(artistMovement) || artistMovement.includes(movement))) score += 900;
  if (movement) score += 240;
  if (work?.description?.ko || work?.description?.en) score += 120;
  return score;
}
function movementMatchesArtist(work, artist={}) {
  const movement = workMovementText(work);
  const artistMovement = `${artist?.movement?.ko || ''} ${artist?.movement?.en || ''}`.toLocaleLowerCase();
  return Boolean(artistMovement && movement && (movement.includes(artistMovement) || artistMovement.includes(movement)));
}
function movementContributionScore(work, artist={}) {
  let score = representativeScore(work, artist);
  if (movementMatchesArtist(work, artist)) score += 5000;
  if (work?.origin === 'curated') score += 1800;
  if (work?.verified) score += 500;
  return score;
}
function selectArtistWorks(works, limit=artistImportedWorkLimit, artist={}) {
  const byKey = new Map();
  (works || []).forEach(work => {
    const key = selectionKey(work);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? {...work,...existing,popularity:Math.max(workPopularity(existing),workPopularity(work))} : work);
  });
  const unique = [...byKey.values()];
  const manualWorks = unique.filter(isManualWork).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const manualKeys = new Set(manualWorks.map(selectionKey));
  const generatedWorks = unique.filter(work => !manualKeys.has(selectionKey(work))).sort((a,b) => representativeScore(b,artist) - representativeScore(a,artist) || workYearForSort(a) - workYearForSort(b));
  const selected = [...manualWorks,...generatedWorks.slice(0,Math.max(0,limit-manualWorks.length))];
  const aligned = selected.filter(work => movementMatchesArtist(work, artist));
  const contributionPool = aligned.length ? aligned : selected;
  const movementContributionKeys = new Set(
    contributionPool
      .sort((a,b) => movementContributionScore(b,artist) - movementContributionScore(a,artist) || workYearForSort(a) - workYearForSort(b))
      .slice(0,3)
      .map(selectionKey)
  );
  return selected.map(work => ({...work,movementContribution:movementContributionKeys.has(selectionKey(work)),movementContributionReason:movementContributionKeys.has(selectionKey(work)) ? 'artist-movement-characteristic' : undefined})).sort((a,b) => workYearForSort(a) - workYearForSort(b));
}
const searchKey = value => String(value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\s\-_'.,()]/g,'');
function editDistance(left, right) { const a=searchKey(left), b=searchKey(right); const row=Array.from({length:b.length+1},(_,index)=>index); for(let i=1;i<=a.length;i++){let diagonal=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const above=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=above;}} return row[b.length]; }
function similarityScore(query, label) { const input=searchKey(query), candidate=searchKey(label); if(!input || !candidate) return 0; if(input===candidate) return 1000; if(candidate.includes(input)) return 800 + input.length / candidate.length * 100; if(input.includes(candidate)) return 650 + candidate.length / input.length * 100; return Math.max(0, 500 - editDistance(input,candidate) * 24); }
const claimValue = (entity, property) => entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
const entityId = (entity, property) => claimValue(entity,property)?.id || '';
const entityYear = (entity, property) => Number((claimValue(entity,property)?.time || '').slice(1,5)) || null;
const entityLabel = (entity, language) => entity?.labels?.[language]?.value || entity?.labels?.en?.value || entity?.labels?.ko?.value || '';
async function getEntities(ids) { const data=await getJson(api({action:'wbgetentities',ids:ids.join('|'),props:'labels|descriptions|claims',languages:'ko|en'})); return data.entities || {}; }
async function normalizeArtistWorks(artist) {
  const works=Array.isArray(artist?.works) ? artist.works : [], ids=[...new Set(works.map(work=>String(work.id||'').replace(/^wikidata-/, '')).filter(id=>/^Q\d+$/.test(id)))];
  const entities={}; for(let index=0;index<ids.length;index+=40) Object.assign(entities,await getEntities(ids.slice(index,index+40)));
  const countryIds=[...new Set(Object.values(entities).map(entity=>entityId(entity,'P495')).filter(Boolean))], countries={}; for(let index=0;index<countryIds.length;index+=40) Object.assign(countries,await getEntities(countryIds.slice(index,index+40)));
  let verified=0, unverified=0;
  works.forEach(work=>{ const qid=String(work.id||'').replace(/^wikidata-/,''), entity=entities[qid]; if(!entity) { unverified++; return; } const title={ko:koreanArtworkTitleOverrides[qid] || entityLabel(entity,'ko'),en:entityLabel(entity,'en')}, made=entityYear(entity,'P571'), country=countries[entityId(entity,'P495')]; if(title.ko&&title.en) work.title=title; if(made) work.year=made; if(country) work.country={ko:entityLabel(country,'ko'),en:entityLabel(country,'en')}; work.metadataVerifiedAt=new Date().toISOString(); verified++; });
  return {artist,verified,unverified};
}
async function artworkDetails(qid) {
  const initial=await getEntities([qid]); const artwork=initial[qid]; const artistQid=entityId(artwork,'P170'); if(!artwork || !artistQid) throw new Error('Artwork creator is not available');
  const countryQid=entityId(artwork,'P495'), movementQid=entityId(artwork,'P135');
  const more=await getEntities([artistQid,countryQid,movementQid].filter(Boolean)); const artistEntity=more[artistQid];
  const nationalityQid=entityId(artistEntity,'P27'); if(nationalityQid) Object.assign(more,await getEntities([nationalityQid]));
  const file=claimValue(artwork,'P18'); const name={ko:koreanArtistNameOverrides[artistQid] || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[artistQid] || entityLabel(artistEntity,'en')};
  return {artist:{id:`artist-${artistQid}`,qid:artistQid,name,birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(more[nationalityQid],'ko'),en:entityLabel(more[nationalityQid],'en')},works:[]},work:{id:`wikidata-${qid}`,title:{ko:koreanArtworkTitleOverrides[qid] || entityLabel(artwork,'ko'),en:entityLabel(artwork,'en')},year:entityYear(artwork,'P571'),country:{ko:entityLabel(more[countryQid],'ko'),en:entityLabel(more[countryQid],'en')},movement:{ko:entityLabel(more[movementQid],'ko'),en:entityLabel(more[movementQid],'en')},image:file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}` : '',description:{ko:'',en:''},source:`https://www.wikidata.org/wiki/${qid}`}};
}
function privateNetworkAddress(address='') {
  const value=String(address || '').toLowerCase().replace(/^\[|\]$/g,'');
  if (value === '::1' || value === '::' || /^fe[89ab][0-9a-f]:/i.test(value) || /^f[cd][0-9a-f]{2}:/i.test(value)) return true;
  const mapped=value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] || value;
  const ipv4=mapped.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) return false;
  const [first,second]=ipv4.slice(1).map(Number);
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 100 && second >= 64 && second <= 127);
}
async function publicHttpsUrl(rawUrl) {
  const parsed=new URL(rawUrl);
  const host=parsed.hostname.toLowerCase();
  if(parsed.protocol !== 'https:' || host === 'localhost' || host.endsWith('.localhost') || privateNetworkAddress(host)) throw new Error('Only public HTTPS pages are allowed');
  const cached=externalHostValidation.get(host);
  if (cached && cached.expiresAt > Date.now()) { if (!cached.public) throw new Error('The page resolves to a private network address'); return parsed; }
  const addresses=await dns.lookup(host,{all:true,verbatim:true});
  const isPublic=addresses.length > 0 && addresses.every(item => !privateNetworkAddress(item.address));
  externalHostValidation.set(host,{public:isPublic,expiresAt:Date.now()+15*60*1000});
  if (!isPublic) throw new Error('The page resolves to a private network address');
  return parsed;
}
async function artistProfileFromQid(qid, fallbackName='') {
  const artistEntity=(await getEntities([qid]))[qid]; if(!artistEntity) throw new Error('Artist not found');
  const nationalityQid=entityId(artistEntity,'P27'), movementQid=entityId(artistEntity,'P135');
  const related=await getEntities([nationalityQid,movementQid].filter(Boolean));
  const nationalityEntity=related[nationalityQid], movementEntity=related[movementQid];
  return {id:`artist-${qid}`,qid,name:{ko:koreanArtistNameOverrides[qid] || artistEntity?.labels?.ko?.value || fallbackName || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')},movement:{ko:entityLabel(movementEntity,'ko'),en:entityLabel(movementEntity,'en')},works:[]};
}
function simpleHash(value='') { let hash=2166136261; for (const ch of String(value)) { hash^=ch.charCodeAt(0); hash=Math.imul(hash,16777619); } return (hash>>>0).toString(36); }
function htmlDecode(value='') {
  const named={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(match,entity)=>{
    if(entity[0]==='#') { const number=entity[1]?.toLowerCase()==='x' ? parseInt(entity.slice(2),16) : parseInt(entity.slice(1),10); return Number.isFinite(number) ? String.fromCodePoint(number) : match; }
    return Object.prototype.hasOwnProperty.call(named,entity.toLowerCase()) ? named[entity.toLowerCase()] : match;
  });
}
function tagAttrs(tag='') {
  const attrs={};
  for (const match of String(tag).matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[match[1].toLowerCase()]=htmlDecode(match[2] || match[3] || match[4] || '').trim();
  return attrs;
}
function firstSrcFromSet(value='') { return String(value || '').split(',').map(item=>item.trim().split(/\s+/)[0]).find(Boolean) || ''; }
function cleanPageTitle(value='') {
  return textFromHtml(value).slice(0,160)
    .replace(/\s*[|｜–—]\s*.*$/,'')
    .replace(/\s+-\s+(?:네이버 블로그|블로그|티스토리|Daum.*|NAVER.*|Google.*)$/i,'')
    .trim();
}
function cleanArtistNameFromTitle(value='') {
  const text=cleanPageTitle(value);
  const korean=text.match(/(?:화가|작가|서양화가|동양화가)\s*[:：]?\s*([가-힣]{2,8})(?:의|과|와|,|\s|$)/);
  if(korean) return korean[1];
  const english=text.match(/(?:artist|painter)\s*[:：]?\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4})/i);
  if(english) return english[1].trim();
  return text
    .replace(/^(?:화가|작가|서양화가|동양화가|artist|painter)\s*[:：]?\s*/i,'')
    .replace(/\s*(?:의\s*)?(?:생애|일생|작품세계|작품\s*세계|대표작|작품|그림|화풍|전시|소개|연보|미술).*$/i,'')
    .trim() || text || '웹페이지 화가';
}
function pageTitleCandidates(html='') {
  const metas=[...String(html).matchAll(/<meta\b[^>]*>/gi)].map(match=>tagAttrs(match[0]));
  return [
    ...metas.filter(attrs=>/^(og:title|twitter:title|title)$/i.test(attrs.property || attrs.name || '')).map(attrs=>attrs.content),
    ...[...String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match=>match[1]),
    String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  ].filter(Boolean);
}
function imageFromAttrs(attrs, baseUrl) {
  const source=attrs.src || attrs['data-src'] || attrs['data-original'] || attrs['data-lazy-src'] || firstSrcFromSet(attrs.srcset || attrs['data-srcset']);
  if(!source || /^data:/i.test(source) || /\.svg(?:\?|$)/i.test(source)) return '';
  try {
    const url=new URL(source.replace(/&amp;/g,'&'),baseUrl);
    if(!/^https?:$/.test(url.protocol)) return '';
    return url.href;
  } catch (_) { return ''; }
}
function cleanWorkTitle(value='', fallback='') {
  const text=shortText(textFromHtml(value),140)
    .replace(/^(?:작품명|제목|title)\s*[:：]\s*/i,'')
    .replace(/\s*(?:이미지|사진|출처|copyright|all rights reserved).*$/i,'')
    .replace(/\s+/g,' ')
    .trim();
  const sentence=(text.match(/^(.{2,90}?)(?:[.!?。]|$)/)?.[1] || text).trim();
  return sentence && sentence.length <= 90 ? sentence : fallback;
}
function extractYear(text='') { return Number(String(text).match(/\b(1[4-9]\d{2}|20\d{2})\b/)?.[1]) || null; }
function contextTextAround(html, index, radius=900) {
  const start=Math.max(0,index-radius), end=Math.min(html.length,index+radius);
  return shortText(textFromHtml(html.slice(start,end)),700);
}
function pageWorksFromHtml(html, baseUrl) {
  const works=[], seen=new Set(), pageHost=new URL(baseUrl).hostname;
  const add = (image, titleText, descriptionText, index) => {
    if(!image || seen.has(image)) return;
    seen.add(image);
    const title=cleanWorkTitle(titleText, `자료 이미지 ${works.length + 1}`);
    const description=shortText(descriptionText || titleText || '',760);
    if(title === `자료 이미지 ${works.length + 1}` && description.length < 20) return;
    const hasKorean=/[가-힣]/.test(`${title} ${description}`);
    const summary=hasKorean ? {ko:description,en:''} : {ko:'',en:description};
    works.push({id:`webpage-${simpleHash(image)}`,year:extractYear(`${title} ${description}`),title:{ko:title,en:title},country:{ko:'',en:''},movement:{ko:'',en:''},image,thumbnail:image,description:summary,detail:{schema:2,fetchedAt:new Date().toISOString(),summary,sections:hasKorean ? {ko:[{title:'웹페이지 설명',body:description}],en:[]} : {ko:[],en:[{title:'Webpage description',body:description}]},sources:[baseUrl],facts:{}},source:baseUrl,verified:false,representative:index < 12,popularity:500-index});
  };
  for (const match of String(html).matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)) {
    const block=match[0], img=block.match(/<img\b[^>]*>/i)?.[0], attrs=tagAttrs(img || ''), image=imageFromAttrs(attrs,baseUrl);
    const caption=block.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || attrs.alt || attrs.title || '';
    add(image,caption,shortText([caption,contextTextAround(html,match.index || 0,500)].filter(Boolean).join(' '),760),works.length);
  }
  for (const match of String(html).matchAll(/<img\b[^>]*>/gi)) {
    const attrs=tagAttrs(match[0]), width=Number(attrs.width || 0), height=Number(attrs.height || 0);
    if((width && width < 100) || (height && height < 100)) continue;
    const image=imageFromAttrs(attrs,baseUrl);
    if(!image || /(?:logo|icon|avatar|profile|banner|button|sprite)/i.test(image)) continue;
    const nearby=contextTextAround(html,match.index || 0);
    add(image,attrs.alt || attrs.title || nearby,nearby,works.length);
  }
  return selectArtistWorks(works,artistImportedWorkLimit).map(work=>({...work,sourceHost:pageHost}));
}
function contentFrameUrl(html='', baseUrl) {
  const frames=[...String(html).matchAll(/<iframe\b[^>]*>/gi)].map(match=>tagAttrs(match[0]));
  const frame=frames.find(attrs=>/mainframe|postview|article|content|blog/i.test(`${attrs.id || ''} ${attrs.name || ''} ${attrs.src || ''}`)) || frames[0];
  if(!frame?.src) return '';
  try {
    const url=new URL(frame.src.replace(/&amp;/g,'&'),baseUrl);
    return url.protocol === 'https:' ? url.href : '';
  } catch (_) { return ''; }
}
async function artistFromGenericWebPage(parsed, html) {
  let sourceUrl=parsed.href, sourceHtml=html, works=pageWorksFromHtml(sourceHtml,sourceUrl);
  if(!works.length) {
    const frame=contentFrameUrl(html,parsed.href);
    if(frame) { sourceUrl=frame; sourceHtml=await getText(frame); works=pageWorksFromHtml(sourceHtml,sourceUrl); }
  }
  const title=[...pageTitleCandidates(sourceHtml),...pageTitleCandidates(html)].map(cleanArtistNameFromTitle).find(Boolean) || cleanArtistNameFromTitle(parsed.pathname.split('/').filter(Boolean).pop() || '');
  if(!works.length) throw new Error('No artwork images found on this page');
  const artist={id:`artist-web-${simpleHash(parsed.href)}`,name:{ko:title,en:title},birth:null,death:null,nationality:{ko:'',en:''},source:parsed.href,works,generated:{schema:catalogueSchema,fetchedAt:new Date().toISOString(),source:parsed.href,contentSource:sourceUrl,fromWebpage:true}};
  return {artist,works};
}
async function artistFromUrl(pageUrl) {
  const parsed=await publicHttpsUrl(pageUrl);
  if (parsed.hostname.endsWith('wikipedia.org') && (parsed.pathname.startsWith('/wiki/') || parsed.pathname === '/w/index.php')) {
    const pageTitle=parsed.pathname.startsWith('/wiki/')
      ? decodeURIComponent(parsed.pathname.slice('/wiki/'.length)).replace(/_/g,' ')
      : (parsed.searchParams.get('title') || '').replace(/_/g,' ');
    if(!pageTitle) throw new Error('Wikipedia page title is missing');
    const wiki=`https://${parsed.hostname}/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',redirects:'1',titles:pageTitle,prop:'pageprops'})}`;
    const page=Object.values((await getJson(wiki)).query?.pages || {})[0]; const qid=page?.pageprops?.wikibase_item;
    if(!qid) throw new Error('No Wikidata item linked to this page');
    const entity=(await getEntities([qid]))[qid];
    if(entityId(entity,'P170')) return artworkDetails(qid);
    return {artist:await artistProfileFromQid(qid,pageTitle)};
  }
  const html=await getText(parsed.href);
  return artistFromGenericWebPage(parsed,html);
}
async function openverseThumbnail(work, artist) {
  try {
    const result=await getJson(openverseApi({q:`${work.title.en || work.title.ko} ${artist.name.en || artist.name.ko}`,page_size:'12',mature:'false'}));
    const titleKey=normalized(work.title.en || work.title.ko);
    const titleWords=[...new Set(String(work.title.en || work.title.ko || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter(word=>!['the','and','with','from','for','into','over'].includes(word));
    const artistKey=normalized((artist.name.en || artist.name.ko).split(' ').pop());
    const candidates=(result.results || []).map(item => {
      const haystack=normalized(`${item.title} ${item.creator} ${item.tags?.map(tag=>tag.name).join(' ')}`);
      const candidateWords=new Set(String(`${item.title} ${item.tags?.map(tag=>tag.name).join(' ')}`).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
      const sharedWords=titleWords.filter(word=>candidateWords.has(word)).length;
      const titleMatch=titleKey.length > 5 && (haystack.includes(titleKey) || titleKey.includes(normalized(item.title)) || sharedWords >= Math.min(2,titleWords.length));
      const artistMatch=artistKey.length > 2 && haystack.includes(artistKey);
      return {...item,score:(titleMatch ? 2 : 0) + (artistMatch ? 2 : 0)};
    }).filter(item=>item.thumbnail && item.score >= 4).sort((a,b)=>b.score-a.score);
    return candidates[0]?.thumbnail || '';
  } catch (_) { return ''; }
}
const artInstituteApi = params => `https://api.artic.edu/api/v1/artworks/search?${new URLSearchParams(params)}`;
const clevelandMuseumApi = params => `https://openaccess-api.clevelandart.org/api/artworks/?${new URLSearchParams(params)}`;
const metMuseumApi = path => `https://collectionapi.metmuseum.org/public/collection/v1/${path}`;
function museumArtworkMatches(work, artist, title, creator='') {
  const titleKey=normalized(work.title.en || work.title.ko), candidateTitle=normalized(title);
  const artistKey=normalized((artist.name.en || artist.name.ko || '').split(' ').pop()), candidateCreator=normalized(creator);
  return titleKey.length > 5 && artistKey.length > 2
    && (candidateTitle.includes(titleKey) || titleKey.includes(candidateTitle))
    && candidateCreator.includes(artistKey);
}
async function artInstituteThumbnail(work, artist) {
  const result=await getJson(artInstituteApi({q:`${work.title.en || work.title.ko} ${artist.name.en || artist.name.ko}`,limit:'10',fields:'id,title,artist_display,image_id,is_public_domain'}));
  const match=(result.data || []).find(item => item.is_public_domain && item.image_id && museumArtworkMatches(work,artist,item.title,item.artist_display));
  return match ? `https://www.artic.edu/iiif/2/${encodeURIComponent(match.image_id)}/full/843,/0/default.jpg` : '';
}
async function clevelandMuseumThumbnail(work, artist) {
  const result=await getJson(clevelandMuseumApi({q:`${work.title.en || work.title.ko} ${artist.name.en || artist.name.ko}`,has_image:'1',cc0:'1',limit:'10'}));
  const match=(result.data || []).find(item => {
    const creator=(item.creators || []).map(person => person.description || person.name || '').join(' ');
    return item.share_license_status === 'CC0' && museumArtworkMatches(work,artist,item.title,creator);
  });
  return match?.images?.web?.url || '';
}
async function metMuseumThumbnail(work, artist) {
  const search=await getJson(metMuseumApi(`search?${new URLSearchParams({q:work.title.en || work.title.ko,title:'true'})}`));
  for (const id of (search.objectIDs || []).slice(0,8)) {
    const item=await getJson(metMuseumApi(`objects/${id}`));
    if (item.isPublicDomain && item.primaryImageSmall && museumArtworkMatches(work,artist,item.title,item.artistDisplayName)) return item.primaryImageSmall;
  }
  return '';
}
async function publicMuseumThumbnail(work, artist) {
  for (const find of [artInstituteThumbnail,clevelandMuseumThumbnail,metMuseumThumbnail]) {
    try { const image=await find(work,artist); if(image) return image; } catch (_) { /* Try the next open-collection source. */ }
  }
  return '';
}
async function mapLimit(items, limit, mapper) { const output = new Array(items.length); let next = 0; await Promise.all(Array.from({length:Math.min(limit,items.length)}, async () => { while (next < items.length) { const index = next++; output[index] = await mapper(items[index], index); } })); return output; }
function fileNameFromUrl(url='') { try { return decodeURIComponent(url.split('/').pop().split('?')[0]); } catch (_) { return ''; } }
const textFromHtml = html => htmlDecode(String(html || '').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<noscript\b[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
async function wikipediaWorksForArtist(qid, artist) {
  try {
    const entity=await getJson(api({action:'wbgetentities',ids:qid,props:'sitelinks'}));
    const title=entity.entities?.[qid]?.sitelinks?.enwiki?.title; if(!title) return [];
    const parsed=await getJson(wikipediaApi({action:'parse',page:title,prop:'text'})); const html=parsed.parse?.text?.['*'] || '';
    const heading=html.match(/<h2\b[^>]*\bid=["']Works["'][^>]*>[\s\S]*?<\/h2>/i); if(!heading || heading.index === undefined) return [];
    const section=html.slice(heading.index + heading[0].length).split(/<h2\b/i)[0];
    return [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match,index) => {
      const item=match[1], image=item.match(/<img[^>]+src=["']([^"']+)/i)?.[1], caption=textFromHtml(item.match(/class=["'][^"']*gallerytext[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || item.match(/alt=["']([^"']+)/i)?.[1]);
      if(!image || !caption) return null;
      const year=Number(caption.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1]) || null; const cleanTitle=caption.replace(/\s*\(\d{4}\)\s*$/,'').trim();
      if(!cleanTitle) return null;
      return {id:`wikipedia-${qid}-${index}`,year,title:{ko:cleanTitle,en:cleanTitle},country:{ko:artist.nationality?.ko || '',en:artist.nationality?.en || ''},movement:{ko:'',en:''},image:`https:${image.startsWith('//') ? image : `//${image.replace(/^https?:\/\//,'')}`}`.replace(/&amp;/g,'&'),description:{ko:'',en:''},source:`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}`,verified:true,popularity:999-index};
    }).filter(Boolean);
  } catch (_) { return []; }
}
async function wikipediaTitleForWork(work) {
  const fromSource=work.source?.match(/en\.wikipedia\.org\/wiki\/([^?#]+)/)?.[1];
  if (fromSource) return fromSource;
  const qid=work.id?.match(/^wikidata-(Q\d+)$/)?.[1];
  if (!qid) return '';
  try { const entity=await getJson(api({action:'wbgetentities',ids:qid,props:'sitelinks'})); return entity.entities?.[qid]?.sitelinks?.enwiki?.title?.replace(/ /g,'_') || ''; } catch (_) { return ''; }
}
const entityDescription = (entity, language) => entity?.descriptions?.[language]?.value || '';
const qidFromWork = work => {
  const id=String(work?.id || ''), source=String(work?.source || '');
  return id.match(/^(?:wikidata|featured)-(Q\d+)/)?.[1] || source.match(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/)?.[1] || '';
};
const locLabel = (value, language) => typeof value === 'object' ? (value?.[language] || value?.en || value?.ko || '') : String(value || '');
const localizedDescription = (value, language) => {
  const candidate = typeof value === 'object' ? (value?.[language] || value?.en || value?.ko || '') : value;
  return language === 'ko' && candidate && !/[가-힣]/.test(candidate) ? '' : String(candidate || '');
};
function shortText(text='', limit=520) {
  const sentences=String(text || '').replace(/\s+/g,' ').trim().match(/[^.!?。]+[.!?。]?/g) || [];
  const clean=sentences.reduce((items,sentence) => { const value=sentence.trim(); if(value && value !== items[items.length - 1]) items.push(value); return items; },[]).join(' ');
  if (clean.length <= limit) return clean;
  const sentence=clean.slice(0,limit).replace(/\s+\S*$/,'').replace(/[.,;:]*$/,'');
  return sentence ? `${sentence}.` : clean.slice(0,limit);
}
async function wikipediaExtract(title, language) {
  if (!title) return '';
  try {
    const data=await getJson(`https://${language}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',redirects:'1',titles:title.replace(/_/g,' '),prop:'extracts',exintro:'1',explaintext:'1',exsentences:'3'})}`);
    return shortText(Object.values(data.query?.pages || {}).map(page => page.extract).find(Boolean) || '');
  } catch (_) { return ''; }
}
async function wikipediaSearchExtract(query, language) {
  try {
    const search=await getJson(`https://${language}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',list:'search',srsearch:query,srlimit:'1'})}`);
    const title=search.query?.search?.[0]?.title || '';
    return wikipediaExtract(title,language);
  } catch (_) { return ''; }
}
async function wikipediaExtractForWork(work, artist, language) {
  const qid=qidFromWork(work);
  if (qid) {
    try {
      const data=await getJson(api({action:'wbgetentities',ids:qid,props:'sitelinks'}));
      const title=data.entities?.[qid]?.sitelinks?.[`${language}wiki`]?.title;
      const extract=await wikipediaExtract(title,language);
      if (extract) return extract;
    } catch (_) { /* Search fallback below. */ }
  }
  const sourceTitle=work.source?.match(new RegExp(`${language}\\.wikipedia\\.org\\/wiki\\/([^?#]+)`))?.[1];
  const fromSource=await wikipediaExtract(sourceTitle,language);
  if (fromSource) return fromSource;
  return wikipediaSearchExtract(`${work.title?.[language] || work.title?.en || work.title?.ko || ''} ${artist.name?.[language] || artist.name?.en || artist.name?.ko || ''}`,language);
}
function composeArtworkSummary(work, artist, description, language) {
  const title=work.title?.[language] || work.title?.en || work.title?.ko || 'Untitled';
  const artistName=artist.name?.[language] || artist.name?.en || artist.name?.ko || '';
  const year=work.year ? (language === 'ko' ? `${work.year}년경` : `around ${work.year}`) : '';
  const movement=work.movement?.[language] || work.movement?.en || work.movement?.ko || '';
  const country=work.country?.[language] || work.country?.en || work.country?.ko || '';
  if (language === 'ko') {
    const base=`${title}은/는 ${artistName ? `${artistName}의 ` : ''}${year ? `${year} 제작된 ` : ''}작품입니다.`;
    if (description.startsWith(`${title}은/는`) && description.includes('작품입니다')) return shortText(description,760);
    const facts=[movement ? `${movement} 흐름과 관련됩니다.` : '', country ? `${country}와 관련된 작품으로 기록되어 있습니다.` : ''].filter(Boolean).join(' ');
    return shortText([base,facts,description].filter(Boolean).join(' '),760);
  }
  const base=`${title} is ${artistName ? `a work by ${artistName}` : 'an artwork'}${year ? ` made ${year}` : ''}.`;
  if (description.startsWith(`${title} is `)) return shortText(description,760);
  const facts=[movement ? `It is associated with ${movement}.` : '', country ? `It is recorded in connection with ${country}.` : ''].filter(Boolean).join(' ');
  return shortText([base,facts,description].filter(Boolean).join(' '),760);
}
async function artworkInfo(artist, work) {
  const qid=qidFromWork(work);
  const entity=qid ? (await getEntities([qid]))[qid] : null;
  const koSource=shortText(localizedDescription(work.description,'ko') || entityDescription(entity,'ko') || await wikipediaExtractForWork(work,artist,'ko'));
  const enSource=shortText(work.description?.en || entityDescription(entity,'en') || await wikipediaExtractForWork(work,artist,'en'));
  const ko=composeArtworkSummary(work,artist,koSource || enSource,'ko');
  const en=composeArtworkSummary(work,artist,enSource || koSource,'en');
  const sources=[work.source, qid ? `https://www.wikidata.org/wiki/${qid}` : ''].filter(Boolean).filter((value,index,self)=>self.indexOf(value)===index);
  const sections={
    ko:[
      {title:'개요',body:ko},
      {title:'자료 항목',body:[work.year ? `제작 연도: ${work.year}` : '', locLabel(work.movement,'ko') ? `사조: ${locLabel(work.movement,'ko')}` : '', locLabel(work.country,'ko') ? `국가: ${locLabel(work.country,'ko')}` : ''].filter(Boolean).join(' · ')}
    ].filter(section=>section.body),
    en:[
      {title:'Overview',body:en},
      {title:'Data points',body:[work.year ? `Year: ${work.year}` : '', locLabel(work.movement,'en') ? `Movement: ${locLabel(work.movement,'en')}` : '', locLabel(work.country,'en') ? `Country: ${locLabel(work.country,'en')}` : ''].filter(Boolean).join(' · ')}
    ].filter(section=>section.body)
  };
  return {...work,description:{ko,en},detail:{schema:2,fetchedAt:new Date().toISOString(),summary:{ko,en},sections,sources,facts:{artist:artist.name,year:work.year || null,country:work.country || {},movement:work.movement || {}}}};
}
async function findThumbnailUrl(work, artist) {
  const sourceTitle = await wikipediaTitleForWork(work);
  const imageFile=fileNameFromUrl(work.image);
  const directWorkImage = String(work.image || '').replace(/^http:\/\//i,'https://');
  if (/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\//i.test(directWorkImage)) return directWorkImage;
  // P18 is an image statement on this exact artwork: it is stronger evidence
  // than the first image found in an article or a loose Commons text search.
  if (imageFile) {
    const commons=await getJson(commonsApi({action:'query',titles:`File:${imageFile}`,prop:'imageinfo',iiprop:'url',iiurlwidth:'1200'}));
    const direct=Object.values(commons.query?.pages||{}).map(page=>page.imageinfo?.[0]?.thumburl||page.imageinfo?.[0]?.url).find(Boolean);
    if (direct) return direct;
  }
  const sourceIsArtistGallery = artist?.qid && String(work.id || '').startsWith(`wikipedia-${artist.qid}-`);
  if (sourceTitle && !sourceIsArtistGallery) {
    try {
      const page=await getJson(wikipediaApi({action:'query',titles:decodeURIComponent(sourceTitle).replace(/_/g,' '),prop:'pageimages',pithumbsize:'1200'}));
      const articleThumb=Object.values(page.query?.pages||{}).map(item=>item.thumbnail?.source).find(Boolean);
      if (articleThumb) return articleThumb;
    } catch (_) { /* Continue with verified search fallbacks. */ }
  }
  const fileTitle=normalized(work.title.en || work.title.ko), artistFamily=normalized((artist.name.en || artist.name.ko || '').split(' ').pop());
  if (fileTitle.length > 5 && artistFamily.length > 2) {
    const commons=await getJson(commonsApi({action:'query',generator:'search',gsrsearch:`${work.title.en} ${artist.name.en || artist.name.ko}`,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url',iiurlwidth:'1200'}));
    const exactFile=Object.values(commons.query?.pages||{}).find(page => { const key=normalized(page.title); return key.includes(fileTitle) && key.includes(artistFamily); });
    const commonThumb=exactFile?.imageinfo?.[0]?.thumburl || exactFile?.imageinfo?.[0]?.url;
    if (commonThumb) return commonThumb;
  }
  const encyclopedia=await getJson(wikipediaApi({action:'query',generator:'search',gsrsearch:`${work.title.en} ${artist.name.en || artist.name.ko}`,gsrnamespace:'0',gsrlimit:'5',prop:'pageimages|extracts',pithumbsize:'1200',exintro:'1',explaintext:'1'}));
  const artistName=(artist.name.en || artist.name.ko || '').toLowerCase();
  const title=(work.title.en || work.title.ko || '').toLowerCase().replace(/[^a-z0-9]/g,'');
  const valid=Object.values(encyclopedia.query?.pages||{}).find(page => {
    const pageTitle=(page.title || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const exactTitle=pageTitle === title;
    const artistInSummary=page.extract?.toLowerCase().includes(artistName);
    return page.thumbnail?.source && (exactTitle || artistInSummary && (pageTitle.includes(title) || title.includes(pageTitle)));
  });
  if (valid?.thumbnail?.source) return valid.thumbnail.source;
  // Do not take an arbitrary article image here: it can be an exhibition view
  // or a framed reproduction rather than the artwork itself.
  return (await publicMuseumThumbnail(work,artist)) || openverseThumbnail(work,artist);
}
async function getBinary(url, attempt=0, redirects=0) {
  const source=String(url || '').replace(/^http:/i,'https:');
  const parsed=await publicHttpsUrl(source);
  return new Promise((resolve,reject) => {
    const request=https.get(parsed,{headers:{'User-Agent':'ArtAtlasLocal/1.0 (educational project)'}},res => {
      if(res.statusCode>=300 && res.statusCode<400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) return reject(new Error('Too many image redirects'));
        return getBinary(new URL(res.headers.location,parsed).href,attempt,redirects+1).then(resolve,reject);
      }
      if(res.statusCode===429 && attempt<3) {
        res.resume();
        const retryAfter=Math.min(15000,Math.max(1000,Number(res.headers['retry-after'] || 0)*1000 || (attempt+1)*2500));
        return setTimeout(()=>getBinary(parsed.href,attempt+1,redirects).then(resolve,reject),retryAfter);
      }
      if(res.statusCode!==200) { res.resume(); return reject(new Error(`Image returned ${res.statusCode}`)); }
      const chunks=[]; let size=0;
      res.on('data',chunk=>{ size+=chunk.length; if(size>sourceImageInputLimit) request.destroy(new Error('Image source is larger than 500 MB')); else chunks.push(chunk); });
      res.on('end',()=>resolve(Buffer.concat(chunks)));
    });
    request.setTimeout(20000,()=>request.destroy(new Error('Image download timed out')));
    request.on('error',reject);
  });
}
async function getText(url, redirects=0) {
  const parsed=await publicHttpsUrl(url);
  return new Promise((resolve,reject) => {
    const request=https.get(parsed,{headers:{'User-Agent':'ArtAtlasLocal/1.0 (educational project)'}},res => {
      if(res.statusCode>=300 && res.statusCode<400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) return reject(new Error('Too many page redirects'));
        return getText(new URL(res.headers.location,parsed).href,redirects+1).then(resolve,reject);
      }
      if(res.statusCode!==200) { res.resume(); return reject(new Error(`Page returned ${res.statusCode}`)); }
      const chunks=[]; let size=0; const limit=3*1024*1024;
      res.on('data',chunk=>{ size+=chunk.length; if(size>limit) request.destroy(new Error('Page is too large')); else chunks.push(chunk); });
      res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
    });
    request.setTimeout(15000,()=>request.destroy(new Error('Page request timed out')));
    request.on('error',reject);
  });
}
function thumbnailLocation(email, artistId) {
  return {folder:path.join(root,'data','thumbnails',artistId), relativePrefix:`data/thumbnails/${artistId}`};
}
function thumbnailExtension(value='') { return (String(value).match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)?.[1] || '').toLowerCase().replace('jpeg','jpg'); }
async function removeThumbnailFiles(directory, workId) {
  const safeWorkId=safeUploadId(workId);
  await Promise.all(['jpg','png','webp','gif'].map(extension => fs.unlink(path.join(directory,`${safeWorkId}.${extension}`)).catch(()=>{})));
}
async function reduceImageBufferForStorage(image, extension, fileBase) {
  if (image.length <= highResolutionStoredLimit) return {image,extension};
  const staging=path.join(imageStagingDir,`thumbnail-${fileBase}-${Date.now()}-${randomBytes(4).toString('hex')}`);
  await fs.mkdir(staging,{recursive:true});
  const input=path.join(staging,`source.${extension || 'jpg'}`);
  const output=path.join(staging,'display.jpg');
  try {
    await fs.writeFile(input,image);
    await execFileAsync(ffmpegPath,['-y','-i',input,'-vf','scale=min(2400\\,iw):-2','-q:v','5',output],{windowsHide:true,timeout:300000});
    let reduced=await fs.readFile(output);
    if(reduced.length > highResolutionStoredLimit) {
      await execFileAsync(ffmpegPath,['-y','-i',input,'-vf','scale=min(1600\\,iw):-2','-q:v','7',output],{windowsHide:true,timeout:300000});
      reduced=await fs.readFile(output);
    }
    if(reduced.length > highResolutionStoredLimit) throw new Error('Could not reduce the image below 30 MB');
    return {image:reduced,extension:'jpg',reduced:true};
  } finally {
    await fs.rm(staging,{recursive:true,force:true}).catch(()=>{});
  }
}
async function saveThumbnailBuffer(artist,work,image,extension,verifiedBy,email=adminEmail) { if(invalidArtworkThumbnail(image)) throw new Error('Image is a small interface icon'); if(!['jpg','png','webp','gif'].includes(extension)) throw new Error('Unsupported image file type'); if(image.length > sourceImageInputLimit) throw new Error('Image source is larger than 500 MB'); const stored=await reduceImageBufferForStorage(image,extension,safeUploadId(work.id)); image=stored.image; extension=stored.extension; if(invalidArtworkThumbnail(image)) throw new Error('Image is a small interface icon'); const location=thumbnailLocation(email,artist.id), directory=location.folder, fileName=`${work.id}.${extension}`, relative=`${location.relativePrefix}/${fileName}`; await fs.mkdir(directory,{recursive:true}); await removeThumbnailFiles(directory,work.id); await fs.writeFile(path.join(directory,fileName),image); const indexPath=path.join(directory,'index.json'); let index={}; try { index=JSON.parse(await fs.readFile(indexPath,'utf8')); } catch (_) {} index[work.id]={thumbnail:relative,checkedAt:new Date().toISOString(),verifiedBy:stored.reduced ? `${verifiedBy}; reduced below 30 MB and original discarded` : verifiedBy}; await fs.writeFile(indexPath,JSON.stringify(index,null,2),'utf8'); return relative; }
async function saveThumbnail(artist,work,thumbUrl,verifiedBy,email=adminEmail) { const extension=thumbnailExtension(thumbUrl) || 'jpg', image=await getBinary(thumbUrl); return saveThumbnailBuffer(artist,work,image,extension,verifiedBy,email); }
async function cacheThumbnail(artist, work, email=adminEmail) { const iconRejected=work.thumbnailInvalidReason === 'thumbnail-is-small-interface-icon'; if(iconRejected) { const fallback=await openverseThumbnail(work,artist).catch(()=> ''); if(fallback) return saveThumbnail(artist,work,fallback,'Openverse fallback after local interface icon rejection',email); } const thumbUrl=await findThumbnailUrl(work,artist); if(!thumbUrl) throw new Error('No verified thumbnail candidate'); const sourceImage=String(work.image || '').replace(/^http:\/\//i,'https://'); const verifiedBy=thumbUrl.includes('openverse.org') ? 'Openverse: title and artist metadata match' : (sourceImage && thumbUrl === sourceImage ? 'Artwork image cached for offline use' : (work.image ? 'Wikidata image statement' : 'Wikipedia article title and artist match')); try { return await saveThumbnail(artist,work,thumbUrl,verifiedBy,email); } catch(error) { const fallback=await openverseThumbnail(work,artist).catch(()=> ''); if(!fallback || fallback===thumbUrl) throw error; return saveThumbnail(artist,work,fallback,'Openverse fallback after image download retry',email); } }
function wikimediaFilePageThumbnail(pageUrl) { try { const parsed=new URL(pageUrl); if(!/(^|\.)wikipedia\.org$/i.test(parsed.hostname) || !parsed.pathname.startsWith('/wiki/')) return ''; const title=decodeURIComponent(parsed.pathname.slice('/wiki/'.length)).replace(/_/g,' '); const fileName=title.replace(/^(?:file|파일)\s*:/i,'').trim(); return /\.(jpe?g|png|webp|gif)$/i.test(fileName) ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640` : ''; } catch (_) { return ''; } }
async function cacheThumbnailFromPage(artist,work,pageUrl,email=adminEmail) { const parsed=await publicHttpsUrl(pageUrl); const directFile=wikimediaFilePageThumbnail(parsed.href); let source=directFile, verifiedBy=directFile ? 'Wikimedia file page supplied by user' : ''; if(!source) { const html=await getText(parsed.href); const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(match=>match[0]); const tag=metas.find(meta=>/\b(?:property|name)=["'](?:og:image|twitter:image)["']/i.test(meta)); const candidate=tag?.match(/\bcontent=["']([^"']+)["']/i)?.[1] || html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]; if(!candidate) throw new Error('No image found on the supplied page'); source=new URL(candidate.replace(/&amp;/g,'&'),parsed.href).href; verifiedBy=`User-supplied page: ${parsed.hostname}`; } try { return await saveThumbnail(artist,work,source,verifiedBy,email); } catch(error) { const fallback=await openverseThumbnail(work,artist).catch(()=> ''); if(!fallback || fallback===source) throw error; return saveThumbnail(artist,work,fallback,'Openverse fallback after supplied page download retry',email); } }
function localImagePath(source) { let value=String(source || '').trim(); if(/^(["']).*\1$/.test(value)) value=value.slice(1,-1).trim(); if(!value) throw new Error('Local image path is required'); if(/^file:/i.test(value)) { let fileUrl=value.replace(/\\/g,'/'); if(/^file:\/\/[a-z]:\//i.test(fileUrl)) fileUrl=fileUrl.replace(/^file:\/\//i,'file:///'); return fileURLToPath(new URL(fileUrl)); } return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root,value); }
async function cacheThumbnailFromLocalPath(artist,work,source,email=adminEmail) { const file=localImagePath(source), extension=thumbnailExtension(file); if(!extension) throw new Error('Local file must be JPG, PNG, WEBP, or GIF'); const info=await fs.stat(file); if(!info.isFile()) throw new Error('Local image path must point to a file'); if(info.size > sourceImageInputLimit) throw new Error('Image source is larger than 500 MB'); const image=await fs.readFile(file); return saveThumbnailBuffer(artist,work,image,extension,`Local image file: ${path.basename(file)}`,email); }
async function cacheThumbnailFromUpload(artist,work,file,email=adminEmail) { const extension=uploadExtension(file); if(!extension) throw new Error('Image must be JPG, PNG, WEBP, or GIF'); if(!file?.data?.length) throw new Error('Image file is empty'); if(file.data.length > sourceImageInputLimit) throw new Error('Image source is larger than 500 MB'); return saveThumbnailBuffer(artist,work,file.data,extension,`Uploaded local image: ${path.basename(file.filename)}`,email); }
async function highResolutionPathExists(relativePath) {
  if (!relativePath) return false;
  try { await fs.access(path.join(root, relativePath)); return true; }
  catch (_) { return false; }
}
async function resolvedHighResolutionPath(artistId, workId, relativePath) {
  if (!relativePath || await highResolutionPathExists(relativePath)) return relativePath;
  const safeArtistId = safeUploadId(artistId), safeWorkId = safeUploadId(workId);
  const folder = path.join(highResolutionDir, safeArtistId);
  const oldName = path.basename(relativePath);
  const baseName = oldName.replace(/\.display\.jpg$/i, '');
  const files = await fs.readdir(folder).catch(() => []);
  const match = files.find(name => name === oldName)
    || files.find(name => name.startsWith(`${baseName}_`) && /\.display\.jpg$/i.test(name))
    || files.find(name => name.startsWith(`${safeWorkId}_`) && /\.display\.jpg$/i.test(name));
  return match ? `data/high-resolution/${safeArtistId}/${match}` : relativePath;
}
async function resolveHighResolutionPaths(payload) {
  if (!payload || !Array.isArray(payload.artists)) return payload;
  for (const artist of payload.artists) {
    for (const work of artist.works || []) {
      if (work.highResImage) work.highResImage = await resolvedHighResolutionPath(artist.id, work.id, work.highResImage);
      if (work.highResOriginal) work.highResOriginal = await resolvedHighResolutionPath(artist.id, work.id, work.highResOriginal);
    }
  }
  return payload;
}
async function readArtistsFile() { return resolveHighResolutionPaths(JSON.parse(await fs.readFile(artistsFile,'utf8'))); }
const offlineArtworkPlaceholder = 'data/thumbnails/_placeholder/artwork-placeholder.png';
async function sanitizeRubensLegacyThumbnails(payload) {
  const artist=(payload.artists || []).find(item=>item.id==='artist-Q5599' || item.qid==='Q5599');
  if(!artist) return payload;
  let index={};
  try { index=JSON.parse(await fs.readFile(path.join(root,'data','thumbnails','artist-Q5599','index.json'),'utf8')); } catch (_) { index={}; }
  for(const work of artist.works || []) {
    const item=index[work.id] || {};
    const thumbnail=String(work.thumbnail || '');
    const isRubensLocal=/^data\/thumbnails\/artist-Q5599\//.test(thumbnail);
    const isLegacyIndex=item.thumbnail && item.thumbnail!==offlineArtworkPlaceholder && !item.source && !item.finalUrl && !item.bytes;
    if(isRubensLocal && isLegacyIndex) {
      if(/^https?:/i.test(String(work.image || ''))) work.offlineThumbnailSource=work.offlineThumbnailSource || work.image;
      work.thumbnail=offlineArtworkPlaceholder;
      work.thumbnailValidation=0;
    }
  }
  return payload;
}
async function appendAudit(event) {
  await fs.mkdir(dataDir,{recursive:true});
  await fs.appendFile(auditLogFile,`${JSON.stringify({at:new Date().toISOString(),...event})}\n`,'utf8');
}
async function backupArtistsFile(previousRevision) {
  const now=Date.now();
  // Frequent thumbnail updates can save repeatedly. Preserve a recoverable
  // pre-save snapshot at most once every five minutes, retaining twenty.
  if (now-lastArtistsBackupAt < 5*60*1000) return '';
  await fs.mkdir(backupsDir,{recursive:true});
  const stamp=new Date(now).toISOString().replace(/[:.]/g,'-');
  const backup=path.join(backupsDir,`artists-r${previousRevision}-${stamp}.json`);
  await fs.copyFile(artistsFile,backup).catch(error => { if(error.code !== 'ENOENT') throw error; });
  lastArtistsBackupAt=now;
  const backups=(await fs.readdir(backupsDir)).filter(name=>/^artists-r\d+-.*\.json$/i.test(name)).sort();
  await Promise.all(backups.slice(0,Math.max(0,backups.length-20)).map(name=>fs.unlink(path.join(backupsDir,name)).catch(()=>{})));
  return path.relative(root,backup).replace(/\\/g,'/');
}
async function writeArtistsFileNow(payload, actor='') {
  if (!payload || !Array.isArray(payload.artists)) throw new Error('Invalid artists payload');
  let previous={metadata:{}};
  try { previous=JSON.parse(await fs.readFile(artistsFile,'utf8')); } catch(error) { if(error.code !== 'ENOENT') throw error; }
  const previousRevision=Math.max(0,Number(previous?.metadata?.revision) || 0);
  payload=normalizeArtistsPayload(payload,{actor,touch:true});
  payload.metadata={...payload.metadata,revision:previousRevision+1};
  const validation=validateArtistsPayload(payload);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  payload=await sanitizeRubensLegacyThumbnails(payload);
  payload=await resolveHighResolutionPaths(payload);
  await fs.mkdir(dataDir,{recursive:true});
  const backup=await backupArtistsFile(previousRevision);
  const temporary = `${artistsFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary,JSON.stringify({dataSchema:payload.dataSchema,metadata:payload.metadata,artists:payload.artists,deletedArtists:[],historicalEvents:Array.isArray(payload.historicalEvents) ? payload.historicalEvents : [],favoriteWorks:Array.isArray(payload.favoriteWorks) ? payload.favoriteWorks : []},null,2) + '\n','utf8');
  await fs.rename(temporary,artistsFile);
  writeUHangulArtistMap(payload.artists);
  syncPersonNameDictionary({artists:payload.artists});
  await appendAudit({type:'artists.save',actor:normalizedEmail(actor) || 'local-admin',revision:payload.metadata.revision,backup,stats:validation.stats});
  return {revision:payload.metadata.revision,backup};
}
function writeArtistsFile(payload, actor='') {
  const queued=artistsWriteQueue.then(() => writeArtistsFileNow(payload,actor));
  artistsWriteQueue=queued.catch(()=>{});
  return queued;
}
function highResolutionLocation(email, artistId) {
  return {folder:path.join(highResolutionDir,artistId), relativePrefix:`data/high-resolution/${artistId}`};
}
const highResolutionArtistNameOverrides = {Q5592:'미켈란젤로',Q5597:'라파엘로',Q301:'엘그레코',Q43270:'브뤼헐',Q213163:'비제르브룅',Q82445:'툴루즈로트레크'};
function commonHighResolutionArtistName(name='', qid='') {
  if (highResolutionArtistNameOverrides[qid]) return highResolutionArtistNameOverrides[qid];
  const text=String(name || '').trim();
  const matches=[['미켈란젤로','미켈란젤로'],['라파엘로','라파엘로'],['카라바조','카라바조'],['반 고흐','반고흐'],['고흐','고흐'],['프리드리히','프리드리히'],['푸키레프','푸키레프'],['브뤼헐','브뤼헐'],['비제 르 브룅','비제르브룅'],['엘 그레코','엘그레코'],['페르메이르','페르메이르'],['마네','마네'],['모네','모네'],['루벤스','루벤스'],['라르손','라르손']];
  const found=matches.find(([needle]) => text.includes(needle));
  return found?.[1] || text.split(/\s+/).filter(Boolean).pop() || 'artist';
}
function safeFileSegment(value) { return String(value || 'artist').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]+/g,'').replace(/\s+/g,'').replace(/^\.+|\.+$/g,'').slice(0,60) || 'artist'; }
function highResolutionFileBase(workId, artistName) { return `${safeUploadId(workId)}_${safeFileSegment(artistName)}`; }
async function removeHighResolutionFiles(folder, workId) {
  const safeWorkId=safeUploadId(workId);
  const directNames=[...new Set(Object.values(uploadTypes))].flatMap(ext => [`${safeWorkId}.${ext}`,`${safeWorkId}.display.jpg`]);
  await Promise.all(directNames.map(name => fs.unlink(path.join(folder,name)).catch(()=>{})));
  const entries=await fs.readdir(folder).catch(()=>[]);
  await Promise.all(entries.filter(name => name.startsWith(`${safeWorkId}_`) && /\.(?:jpe?g|png|webp|gif)$/i.test(name)).map(name => fs.unlink(path.join(folder,name)).catch(()=>{})));
}
async function migrationExport() {
  const artists=normalizeArtistsPayload(await readArtistsFile(),{touch:false});
  const validation=validateArtistsPayload(artists);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  let movements={countries:[]}, assets=[];
  try { movements=JSON.parse(await fs.readFile(path.join(dataDir,'art-movements.json'),'utf8')); } catch (_) {}
  try { assets=JSON.parse(await fs.readFile(migrationAssetManifestFile,'utf8')).assets || []; } catch (_) {}
  const control=await readAccessControl();
  return {export:firebaseExport(artists,movements,control,assets),validation};
}
async function enrich(artist) {
  const cacheFile = path.join(generatedDir, `${artist.qid ? `qid-${artist.qid}` : artist.id}.json`);
  try { const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8')); if (cached.schema === catalogueSchema) return cached; } catch (_) { /* cache miss */ }
  const search = artist.qid ? null : await getJson(api({action:'wbsearchentities',search:artist.name.en || artist.name.ko,language:'en',type:'item',limit:'1'}));
  const qid = artist.qid || search.search?.[0]?.id; if (!qid) throw new Error('Artist not found in Wikidata.');
  const artistEntity = (await getEntities([qid]))[qid];
  const nationalityQid = entityId(artistEntity,'P27'), movementQid = entityId(artistEntity,'P135');
  const relatedEntities = await getEntities([nationalityQid,movementQid].filter(Boolean));
  const nationalityEntity = relatedEntities[nationalityQid], movementEntity = relatedEntities[movementQid];
  const artistProfile = {name:{ko:koreanArtistNameOverrides[qid] || artistEntity?.labels?.ko?.value || artist.name?.ko || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')},movement:{ko:entityLabel(movementEntity,'ko'),en:entityLabel(movementEntity,'en')}};
  const wikipediaWorks = await wikipediaWorksForArtist(qid,{...artist,nationality:artistProfile.nationality});
  const query = `SELECT ?work ?workLabel ?workDescription ?year ?image ?countryLabel ?movementLabel ?sitelinks WHERE {
    ?work wdt:P170 wd:${qid}; wikibase:sitelinks ?sitelinks.
    ?work wdt:P571 ?date.
    BIND(YEAR(?date) AS ?year)
    OPTIONAL { ?work wdt:P18 ?image }
    OPTIONAL { ?work wdt:P495 ?country }
    OPTIONAL { ?work wdt:P135 ?movement }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
  } ORDER BY DESC(?sitelinks) LIMIT ${artistImportedWorkLimit}`;
  let results = {results:{bindings:[]}};
  try { results = await getJson(`https://query.wikidata.org/sparql?${new URLSearchParams({query,format:'json'})}`); }
  catch (_) { /* Wikipedia gallery results still keep the artist usable if SPARQL is unavailable. */ }
  const normalize = (row,index,representative=false) => { const workQid=row.work?.value?.split('/').pop() || ''; return {id:`wikidata-${workQid || index}`,year:Number(row.year?.value || row.date?.value?.slice(0,4))||null,popularity:Number(row.sitelinks?.value || 0),title:{ko:koreanArtworkTitleOverrides[workQid] || row.workLabel?.value||`Untitled ${index+1}`,en:row.workLabel?.value||`Untitled ${index+1}`},country:{ko:row.countryLabel?.value||'',en:row.countryLabel?.value||''},movement:{ko:row.movementLabel?.value||'',en:row.movementLabel?.value||''},image:row.image?.value||'',description:{ko:row.workDescription?.value||'',en:row.workDescription?.value||''},source:row.sourceUrl?.value||row.work?.value||'',verified:!representative,representative}; };
  const verifiedWorks = (results.results?.bindings || []).map((row,index) => normalize(row,index))
    .filter(work => !work.year || ((!artist.birth || work.year >= artist.birth) && (!artist.death || work.year <= artist.death)))
    .filter((work,index,self)=>self.findIndex(item=>item.id===work.id)===index);
  // Keep curated masterworks first, then fill to 60 by public-documentation
  // popularity. Movement-contribution labels are normalized for every artist.
  const works = selectArtistWorks([...(sparseArtistFeaturedWorks[qid] || []),...wikipediaWorks,...verifiedWorks],artistImportedWorkLimit,artistProfile);
  // Return the verified catalogue immediately. Thumbnail files are intentionally
  // fetched later by the browser only for cards that enter the viewport.
  const output={schema:catalogueSchema,artistId:artist.id,qid,artist:artistProfile,fetchedAt:new Date().toISOString(),works}; await fs.mkdir(generatedDir,{recursive:true}); await fs.writeFile(cacheFile,JSON.stringify(output,null,2),'utf8'); return output;
}
function safePath(urlPath) { const name=urlPath==='/'?'index.html':decodeURIComponent(urlPath).replace(/^\/+/, ''); if(name.startsWith('.') || ['server.js','data/access-control.json'].includes(name) || name.startsWith('data/backups/') || name.startsWith('data/audit') || name.startsWith('.git/')) return null; const output=path.resolve(root,name), relative=path.relative(root,output); return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? output : (name==='index.html' ? output : null); }
function techniqueLinks(value) {
  if (!Array.isArray(value) || value.length > 40) throw new Error('Invalid technique links');
  return value.map(link => {
    const raw=String(link?.url || link || '').trim(), parsed=new URL(raw);
    if (!['http:','https:'].includes(parsed.protocol)) throw new Error('Technique links must use HTTP or HTTPS');
    return {url:parsed.href};
  });
}
function readRequestBuffer(req, limit=500*1024*1024) { return new Promise((resolve,reject) => { const chunks=[]; let size=0; req.on('data',chunk=>{ size+=chunk.length; if(size>limit) { reject(new Error('File is larger than 500 MB')); req.destroy(); return; } chunks.push(chunk); }); req.on('end',()=>resolve(Buffer.concat(chunks))); req.on('error',reject); }); }
function multipartForm(buffer, contentType) {
  const boundary=/boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || '')?.[1] || /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || '')?.[2];
  if (!boundary) throw new Error('Invalid upload form');
  const fields={}, files={};
  for (const raw of buffer.toString('latin1').split(`--${boundary}`).slice(1,-1)) {
    const part=raw.replace(/^\r\n/, '').replace(/\r\n$/, ''), split=part.indexOf('\r\n\r\n'); if(split<0) continue;
    const header=part.slice(0,split), value=Buffer.from(part.slice(split+4),'latin1');
    const disposition=/name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(header); if(!disposition) continue;
    const name=disposition[1], filename=disposition[2];
    if(filename !== undefined) files[name]={filename, contentType:/content-type:\s*([^\r\n;]+)/i.exec(header)?.[1]?.toLowerCase() || '', data:value};
    else fields[name]=value.toString('utf8');
  }
  return {fields,files};
}
function safeUploadId(value) { if(!/^[A-Za-z0-9_-]{1,140}$/.test(String(value || ''))) throw new Error('Invalid artwork identifier'); return String(value); }
const uploadTypes={'image/jpeg':'jpg','image/jpg':'jpg','image/pjpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
const movementDocumentDir = path.join(dataDir, '미술사조');
const movementDocumentIndex = path.join(movementDocumentDir, 'index.json');
const movementImageDir = path.join(movementDocumentDir, 'images');
const movementImageManifestPath = path.join(movementImageDir, 'index.json');
const movementImageSrcPattern = /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi;
const imageContentExtensions = {'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'};
function movementDocumentName(value) { if(!String(value || '').trim() || String(value).length > 180) throw new Error('Invalid movement name'); return String(value).trim(); }
function movementDocumentSlot(value) { if(!['1','2'].includes(String(value))) throw new Error('Invalid document slot'); return String(value); }
async function readMovementDocuments() { try { const data=JSON.parse(await fs.readFile(movementDocumentIndex,'utf8')); return data && typeof data.documents==='object' ? data : {documents:{}}; } catch(error) { if(error.code==='ENOENT') return {documents:{}}; throw error; } }
async function writeMovementDocuments(data) { await fs.mkdir(movementDocumentDir,{recursive:true}); await fs.writeFile(movementDocumentIndex,JSON.stringify(data,null,2)+'\n','utf8'); }
function movementDocumentRelative(name, slot) { return `data/미술사조/${createHash('sha256').update(`${name}:${slot}`,'utf8').digest('hex').slice(0,24)}-${slot}.html`; }
async function removeMovementDocument(relative) { if(!/^data\/미술사조\/[a-f0-9]{24}-[12]\.html$/.test(String(relative || ''))) return; await fs.unlink(path.join(root,relative)).catch(error => { if(error.code!=='ENOENT') throw error; }); }
async function refreshMovementDocumentLinks(name, slot) {
  const data=await readMovementDocuments(), relative=data.documents?.[name]?.[slot];
  if(!relative) throw new Error('There is no saved movement document');
  if(!/^data\/미술사조\/[a-f0-9]{24}-[12]\.html$/.test(String(relative || ''))) throw new Error('Invalid movement document path');
  const file=path.join(root,relative), before=await fs.readFile(file), after=await linkMovementDocumentArtists(injectUHangulDocumentIntegration(before));
  const changed=!before.equals(after);
  if(changed) await fs.writeFile(file,after);
  return {ok:true,url:relative,changed};
}
async function readMovementImageManifest() { try { const data=JSON.parse(await fs.readFile(movementImageManifestPath,'utf8')); return data && typeof data.images==='object' ? data : {schema:1,cachedAt:null,images:{},failures:[]}; } catch(error) { if(error.code==='ENOENT') return {schema:1,cachedAt:null,images:{},failures:[]}; throw error; } }
async function writeMovementImageManifest(data) { await fs.mkdir(movementImageDir,{recursive:true}); data.cachedAt=new Date().toISOString(); await fs.writeFile(movementImageManifestPath,JSON.stringify(data,null,2)+'\n','utf8'); }
function movementImageSlug(value) {
  return String(value || 'image').replace(/\?.*$/,'').replace(/%20/g,' ').replace(/%2C/gi,',').replace(/%28/gi,'(').replace(/%29/gi,')').split('/').pop()
    .replace(/\.[a-z0-9]{2,5}$/i,'').normalize('NFKD').replace(/[^a-zA-Z0-9가-힣]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70) || 'image';
}
function movementImageExtension(url, contentType='') {
  const ext=imageContentExtensions[String(contentType).split(';')[0].trim().toLowerCase()];
  if(ext) return ext;
  try { return new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase().replace('jpeg','jpg') || 'jpg'; }
  catch (_) { return 'jpg'; }
}
function movementImageDownloadUrl(sourceUrl) {
  const parsed=new URL(sourceUrl);
  if ((/(^|\.)wikimedia\.org$/i.test(parsed.hostname) || /(^|\.)wikipedia\.org$/i.test(parsed.hostname)) && /\/wiki\/Special:FilePath\//i.test(parsed.pathname)) parsed.searchParams.set('width','640');
  return parsed.href;
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function escapeAttribute(value) { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
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
    Q42207:['카라바조','Caravaggio'],
    Q5592:['미켈란젤로','Michelangelo'],
    Q43270:['피터르 브뤼헐','브뤼헐','Pieter Bruegel','Pieter Brueghel','Bruegel','Brueghel'],
    Q213163:['비제 르 브룅','비제르브룅','Vigée Le Brun','Vigee Le Brun'],
    Q5599:['루벤스','Rubens'],
    Q47551:['티치아노','티치아노 베첼리오','Tiziano','Tiziano Vecellio','Titian'],
    Q187310:['라르손','Larsson'],
    Q82445:['툴루즈로트레크','툴루즈 로트레크','Toulouse-Lautrec','Toulouse Lautrec'],
    Q301:['엘 그레코','엘그레코','El Greco'],
    Q41264:['페르메이르','Vermeer'],
    Q5597:['라파엘로','Raphael']
  };
  return aliases[qid] || [];
}
function movementArtistAliases(artist) {
  const recordAliases = Array.isArray(artist?.aliases)
    ? artist.aliases
    : [...(Array.isArray(artist?.aliases?.ko) ? artist.aliases.ko : []), ...(Array.isArray(artist?.aliases?.en) ? artist.aliases.en : [])];
  const aliases=[artist?.name?.ko,artist?.name?.en,...recordAliases,...movementArtistAliasOverrides(artist)];
  return [...new Set(aliases.map(compactArtistName).filter(name=>name.length >= 2))];
}
async function movementArtistLinkEntries() {
  const data=await readArtistsFile();
  const entries=[];
  for(const artist of data.artists || []) {
    for(const alias of movementArtistAliases(artist)) entries.push({alias,id:artist.id,name:artist.name?.ko || artist.name?.en || alias,korean:artist.name?.ko || '',original:artist.name?.en || ''});
  }
  return entries.sort((a,b)=>b.alias.length-a.alias.length || a.alias.localeCompare(b.alias,'ko'));
}
const movementArtistLinkStyle = `.art-atlas-artist-link{font-weight:900;color:#191007!important;background:linear-gradient(180deg,rgba(255,232,151,.98),rgba(255,198,86,.9));border-bottom:2px solid #a96f12;border-radius:.22em;padding:0 .16em;text-decoration:none!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}.art-atlas-artist-link:hover{filter:brightness(1.08);box-shadow:0 0 0 2px rgba(255,214,102,.24)}`;
const uHangulDocumentIntegration = `<link rel="stylesheet" href="../../uhangul/uhangul-runtime.css" data-uhangul-integration="v0.4">\n<script defer src="../../uhangul/uhangul-runtime.js" data-uhangul-integration="v0.4"></script>`;
const uHangulDocumentToolbar = `<div data-uhangul-document-toolbar data-uhangul-ui role="group" aria-label="이름 표기 방식" style="float:right!important;position:relative!important;z-index:2147483647!important;display:flex!important;gap:4px!important;margin:14px!important;padding:5px!important;background:#18221e!important;color:#fff!important;border:1px solid #526356!important;border-radius:8px!important;box-shadow:0 4px 18px rgba(0,0,0,.35)!important;font:600 12px/1 'Noto Sans KR',sans-serif!important;visibility:visible!important;opacity:1!important"><button type="button" data-uh-mode="korean" data-uh-local-mode="korean" aria-pressed="true" style="display:block!important;border:0!important;border-radius:4px!important;padding:7px 10px!important;background:#f5f1e8!important;color:#18221e!important;font:inherit!important;cursor:pointer!important">한국어</button><button type="button" data-uh-mode="uhangul" data-uh-local-mode="uhangul" aria-pressed="false" style="display:block!important;border:0!important;border-radius:4px!important;padding:7px 10px!important;background:transparent!important;color:#fff!important;font:inherit!important;cursor:pointer!important">uHangul</button></div>`;
const uHangulDocumentCornerButton = `<div data-uhangul-corner-bar style="position:sticky!important;top:0!important;z-index:2147483647!important;clear:both!important;height:64px!important;display:flex!important;align-items:center!important;padding:10px 18px!important;background:#0c1014!important;border-bottom:1px solid #2d3540!important"><button type="button" data-uhangul-corner-button aria-label="uHangul 켜기" title="uHangul 켜기" aria-pressed="false" style="position:relative!important;z-index:2147483647!important;display:block!important;border:2px solid #f4c55b!important;border-radius:50%!important;width:38px!important;height:38px!important;padding:0!important;background:#18221e!important;color:#f4c55b!important;font:800 23px/34px Georgia,serif!important;text-align:center!important;cursor:pointer!important;visibility:visible!important;opacity:1!important">u</button></div>`;
function injectUHangulDocumentIntegration(html) {
  const source=String(html || '');
  const styleLink=uHangulDocumentIntegration.split('\n')[0];
  const runtimeScript=uHangulDocumentIntegration.split('\n')[1];
  const hasStyle=/\bdata-uhangul-integration\b[^>]*>/i.test(source) && /<link\b[^>]*data-uhangul-integration/i.test(source);
  let documentHtml=hasStyle ? source : (/<\/head>/i.test(source) ? source.replace(/<\/head>/i,`${styleLink}\n</head>`) : `${styleLink}\n${source}`);
  const existingRuntime=/<script\b[^>]*data-uhangul-integration[^>]*>[\s\S]*?<\/script>/i;
  if (existingRuntime.test(documentHtml)) documentHtml=documentHtml.replace(existingRuntime,runtimeScript);
  const existingToolbar=/<div\b(?=[^>]*data-uhangul-document-toolbar)[\s\S]*?<\/div>/i;
  documentHtml=documentHtml.replace(existingToolbar,'');
  documentHtml=documentHtml.replace(/<div\b(?=[^>]*data-uhangul-corner-bar)[\s\S]*?<\/div>/i,'').replace(/<button\b(?=[^>]*data-uhangul-corner-button)[\s\S]*?<\/button>/i,'');
  documentHtml=/<body\b[^>]*>/i.test(documentHtml) ? documentHtml.replace(/<body\b[^>]*>/i,match=>`${match}\n${uHangulDocumentCornerButton}`) : `${uHangulDocumentCornerButton}\n${documentHtml}`;
  if (existingRuntime.test(documentHtml)) return documentHtml;
  return /<\/body>/i.test(documentHtml) ? documentHtml.replace(/<\/body>/i,`${runtimeScript}\n</body>`) : `${documentHtml}\n${runtimeScript}`;
}
function injectMovementArtistLinkStyle(html) {
  if (/id=["']art-atlas-artist-link-style["']/i.test(html)) return html;
  const style=`<style id="art-atlas-artist-link-style">\n${movementArtistLinkStyle}\n</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${html}`;
}
function injectMovementWikipediaHeading(html, movementName='', movementLabel='') {
  const wikiName=String(movementName || '').trim();
  const label=String(movementLabel || movementName || '').trim();
  if(!wikiName || !label || /data-art-atlas-movement-wiki-ready/i.test(html)) return html;
  const href=`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiName)}`;
  const style='<style id="art-atlas-movement-wiki-title-style" data-art-atlas-movement-wiki-ready>.art-atlas-movement-wiki-title{color:inherit;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.18em}.art-atlas-movement-wiki-title:hover{filter:brightness(.82)}.art-atlas-movement-wiki-button{position:fixed;top:14px;right:16px;z-index:2147483646;display:inline-flex;align-items:center;min-height:34px;padding:8px 12px;border:1px solid #8e9b8b;border-radius:6px;background:#fffdf8;color:#18221e;text-decoration:none;font:700 12px/1 system-ui,sans-serif;box-shadow:0 4px 16px rgba(24,34,30,.16)}.art-atlas-movement-wiki-button:hover{background:#eef4ea}</style>';
  let output=/<\/head>/i.test(html) ? html.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${html}`;
  const button=`<a class="art-atlas-movement-wiki-button" href="${escapeAttribute(href)}" target="_blank" rel="noopener">위키피디아</a>`;
  output=/<body\b[^>]*>/i.test(output) ? output.replace(/<body\b[^>]*>/i,match=>`${match}\n${button}`) : `${button}\n${output}`;
  const link=`<a class="art-atlas-movement-wiki-title" data-art-atlas-movement-wiki-title href="${escapeAttribute(href)}" target="_blank" rel="noopener">${escapeAttribute(label)}</a>`;
  const headingPattern=/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/i;
  if(headingPattern.test(output)) {
    return output.replace(headingPattern,(match,level,attrs,content)=>{
      if(/<a\b/i.test(content)) return match;
      return `<h${level}${attrs}>${link}</h${level}>`;
    });
  }
  const titleBlock=`<h1 style="margin:24px 28px 8px;font:700 28px/1.25 system-ui,sans-serif">${link}</h1>`;
  return /<body\b[^>]*>/i.test(output) ? output.replace(/<body\b[^>]*>/i,match=>`${match}\n${titleBlock}`) : `${titleBlock}\n${output}`;
}
function stripMovementArtistLinks(html) {
  return String(html || '')
    .replace(/\n?<style\b[^>]*id=["']art-atlas-artist-link-style["'][^>]*>[\s\S]*?<\/style>\n?/gi,'\n')
    .replace(/<a\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-artist-link\b)[^>]*>([\s\S]*?)<\/a>/gi,'$1');
}
function isProtectedMovementHtmlChunk(part) {
  return /^<(script|style|title|a|pre|code|textarea)\b/i.test(part) || /^<[^>]+>$/.test(part);
}
async function linkMovementDocumentArtists(buffer, linkEntries=null) {
  let html=stripMovementArtistLinks(Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || ''));
  const entries=linkEntries || await movementArtistLinkEntries();
  if(!entries.length) return Buffer.from(injectMovementArtistLinkStyle(html),'utf8');
  const byAlias=new Map(entries.map(entry=>[entry.alias.normalize('NFC').toLocaleLowerCase('ko-KR'),entry]));
  const particles='은는이가을를의와과에도로';
  const pattern=new RegExp(`(?<![A-Za-z0-9가-힣])(${entries.map(entry=>escapeRegex(entry.alias)).join('|')})([${particles}]?)(?=$|[^A-Za-z0-9가-힣])`,'gu');
  const protectedPattern=/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<title\b[\s\S]*?<\/title>|<a\b[\s\S]*?<\/a>|<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>|<textarea\b[\s\S]*?<\/textarea>|<[^>]+>)/gi;
  html=html.split(protectedPattern).map(part=>{
    if(!part || isProtectedMovementHtmlChunk(part)) return part;
    return part.replace(pattern,(match,name,particle='')=>{
      const entry=byAlias.get(name.normalize('NFC').toLocaleLowerCase('ko-KR'));
      if(!entry) return match;
      return `<a class="art-atlas-artist-link" href="../../index.html?artist=${encodeURIComponent(entry.id)}" target="_blank" rel="noopener" data-artist-id="${escapeAttribute(entry.id)}" data-uh-original="${escapeAttribute(entry.original)}" data-uh-korean="${escapeAttribute(entry.korean)}" data-uh-display-korean="${escapeAttribute(name)}" title="${escapeAttribute(entry.name)} 연표로 이동">${name}</a>${particle}`;
    });
  }).join('');
  return Buffer.from(injectMovementArtistLinkStyle(html),'utf8');
}
async function ensureStoredMovementDocumentControls() {
  let entries=[];
  try { entries=await fs.readdir(movementDocumentDir,{withFileTypes:true}); } catch(error) { if(error.code==='ENOENT') return; throw error; }
  const linkEntries=await movementArtistLinkEntries();
  await Promise.all(entries.filter(entry=>entry.isFile() && /^[a-f0-9]{24}-[12]\.html$/i.test(entry.name)).map(async entry=>{
    const file=path.join(movementDocumentDir,entry.name);
    const before=await fs.readFile(file);
    const after=await linkMovementDocumentArtists(injectUHangulDocumentIntegration(before), linkEntries);
    if(!before.equals(after)) await fs.writeFile(file,after);
  }));
  syncPersonNameDictionary();
}
const storedMovementDocumentControlsReady=ensureStoredMovementDocumentControls().catch(error=>console.error('Could not add uHangul controls to movement documents:',error.message));
async function requestBinary(rawUrl, redirects=0) {
  const parsed=await publicHttpsUrl(String(rawUrl || '').replace(/^http:/i,'https:'));
  return new Promise((resolve,reject) => {
    const request=https.get(parsed,{headers:{'User-Agent':'ArtAtlasLocal/1.0 (local image cache)'}},res=>{
      if(res.statusCode>=300 && res.statusCode<400 && res.headers.location) { res.resume(); if(redirects>5) return reject(new Error('Too many redirects')); return resolve(requestBinary(new URL(res.headers.location,parsed).href,redirects+1)); }
      if(res.statusCode!==200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks=[]; let size=0; const limit=25*1024*1024;
      res.on('data',chunk=>{ size+=chunk.length; if(size>limit) request.destroy(new Error('Image is larger than 25 MB')); else chunks.push(chunk); });
      res.on('end',()=>resolve({buffer:Buffer.concat(chunks),contentType:String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase(),finalUrl:res.responseUrl || rawUrl}));
    });
    request.setTimeout(60000,()=>request.destroy(new Error('Image download timed out')));
    request.on('error',reject);
  });
}
async function localMovementImage(sourceUrl, manifest) {
  manifest.images = manifest.images || {};
  const existing=manifest.images[sourceUrl]?.local;
  if(existing && await fs.access(path.join(movementDocumentDir,existing)).then(()=>true).catch(()=>false)) return existing;
  const downloadUrl=movementImageDownloadUrl(sourceUrl);
  const downloaded=await requestBinary(downloadUrl);
  const ext=movementImageExtension(downloaded.finalUrl || downloadUrl, downloaded.contentType);
  const local=`images/${movementImageSlug(sourceUrl)}-${createHash('sha256').update(sourceUrl,'utf8').digest('hex').slice(0,12)}.${ext}`;
  await fs.mkdir(movementImageDir,{recursive:true});
  await fs.writeFile(path.join(movementDocumentDir,local),downloaded.buffer);
  manifest.images[sourceUrl]={local,source:sourceUrl,downloadUrl,finalUrl:downloaded.finalUrl,contentType:downloaded.contentType,bytes:downloaded.buffer.length,cachedAt:new Date().toISOString()};
  return local;
}
async function localizeMovementDocumentImages(buffer) {
  let html=buffer.toString('utf8');
  const sources=[...new Set([...html.matchAll(movementImageSrcPattern)].map(match=>match[2]).filter(src=>/^https?:\/\//i.test(src)))];
  if(!sources.length) return Buffer.from(html,'utf8');
  const manifest=await readMovementImageManifest();
  const replacements=new Map();
  for(const source of sources) replacements.set(source,await localMovementImage(source,manifest));
  manifest.failures=(manifest.failures || []).filter(item=>!replacements.has(item.url));
  await writeMovementImageManifest(manifest);
  html=html.replace(movementImageSrcPattern,(full,before,src,after)=>replacements.has(src) ? `${before}${replacements.get(src)}${after}` : full);
  return Buffer.from(html,'utf8');
}
function uploadExtension(file) { const ext=path.extname(String(file?.filename || '')).toLowerCase(); return uploadTypes[file?.contentType] || ({'.jpg':'jpg','.jpeg':'jpg','.jfif':'jpg','.png':'png','.webp':'webp','.gif':'gif'}[ext]); }
async function makeDisplayImage(input, folder, fileBase) {
  const output=path.join(folder,`${fileBase}.display.jpg`);
  // Very large originals can exceed a browser's decoded-image or GPU texture
  // limit. Create an 8K display master; the uploaded original is discarded.
  await execFileAsync(ffmpegPath,['-y','-i',input,'-vf','scale=min(8000\\,iw):-2','-q:v','2',output],{windowsHide:true,timeout:300000});
  return output;
}
async function makeLocalArtworkThumbnail(input, artist, work, email=adminEmail) {
  const location=thumbnailLocation(email,artist.id);
  await fs.mkdir(location.folder,{recursive:true});
  const temporary=path.join(location.folder,`${safeUploadId(work.id)}.local-upload.jpg`);
  await execFileAsync(ffmpegPath,['-y','-i',input,'-vf','scale=min(720\\,iw):-2','-q:v','5',temporary],{windowsHide:true,timeout:300000});
  try {
    const image=await fs.readFile(temporary);
    return await saveThumbnailBuffer(artist,work,image,'jpg','Local high-resolution image reduced for timeline',email);
  } finally { await fs.unlink(temporary).catch(()=>{}); }
}
async function saveLocalArtworkImage(form) {
  const artistId=safeUploadId(form.fields.artistId), workId=safeUploadId(form.fields.workId), file=form.files.image, extension=uploadExtension(file);
  if(!file || !extension) throw new Error('Upload a JPEG, PNG, WebP, or GIF image (up to 500 MB)');
  if(!file.data.length) throw new Error('The image file is empty');
  const artist={id:artistId}, work={id:workId}, location=highResolutionLocation(adminEmail,artistId);
  const artistName=commonHighResolutionArtistName(form.fields.artistName,form.fields.artistQid), fileBase=highResolutionFileBase(workId,artistName);
  const staging=path.join(imageStagingDir,`${workId}-${Date.now()}-${randomBytes(4).toString('hex')}`);
  await fs.mkdir(staging,{recursive:true});
  const input=path.join(staging,`${fileBase}.${extension}`);
  await fs.writeFile(input,file.data);
  try {
    const display=await makeDisplayImage(input,staging,fileBase);
    if((await fs.stat(display)).size>highResolutionStoredLimit) throw new Error('Could not create a display image smaller than 30 MB');
    const thumbnail=await makeLocalArtworkThumbnail(display,artist,work);
    await fs.mkdir(location.folder,{recursive:true});
    await removeHighResolutionFiles(location.folder,workId);
    await fs.rename(display,path.join(location.folder,`${fileBase}.display.jpg`));
    const image=`${location.relativePrefix}/${fileBase}.display.jpg`;
    return {image,thumbnail};
  } finally { await fs.rm(staging,{recursive:true,force:true}).catch(()=>{}); }
}
async function saveTopicArtwork(form) {
  const topicId=safeUploadId(form.fields.topicId), title=String(form.fields.title || '').trim(), startYear=Number(form.fields.startYear), endYear=Number(form.fields.endYear), file=form.files.image, extension=uploadExtension(file);
  if(!title) throw new Error('작품 제목을 입력하세요');
  if(!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear<1 || endYear<startYear) throw new Error('올바른 시작·끝 연도를 입력하세요');
  if(!file || !extension || !file.data?.length) throw new Error('JPG, PNG, WebP 또는 GIF 이미지 파일을 선택하세요');
  const data=JSON.parse(await fs.readFile(topicsFile,'utf8')), topic=(data.topics || []).find(item=>item.id===topicId);
  if(!topic) throw new Error('주제·사건을 찾을 수 없습니다');
  const id=`topic-${Date.now()}-${randomBytes(4).toString('hex')}`, staging=path.join(imageStagingDir,`${id}-${Date.now()}`), input=path.join(staging,`${id}.${extension}`);
  await fs.mkdir(staging,{recursive:true});
  await fs.writeFile(input,file.data);
  try {
    await fs.mkdir(topicImageDir,{recursive:true});
    const display=await makeDisplayImage(input,staging,id);
    if((await fs.stat(display)).size>highResolutionStoredLimit) throw new Error('30MB 이하의 표시용 이미지를 만들 수 없습니다');
    const relative=`data/topic-images/${id}.display.jpg`;
    await fs.rename(display,path.join(topicImageDir,`${id}.display.jpg`));
    const work={id,title,artist:'',year:startYear===endYear?String(startYear):`${startYear}–${endYear}`,sortYear:startYear,movement:'추가 작품',thumbnail:relative,description:''};
    topic.works=Array.isArray(topic.works)?topic.works:[];
    topic.works.push(work);
    await fs.writeFile(topicsFile,JSON.stringify(data,null,2)+'\n','utf8');
    return {work,topics:data.topics};
  } finally { await fs.rm(staging,{recursive:true,force:true}).catch(()=>{}); }
}
async function replaceTopicArtworkImage(form) {
  const topicId=safeUploadId(form.fields.topicId), workId=safeUploadId(form.fields.workId), file=form.files.image, extension=uploadExtension(file);
  if(!file || !extension || !file.data?.length) throw new Error('JPG, PNG, WebP 또는 GIF 이미지 파일을 선택하세요');
  const data=JSON.parse(await fs.readFile(topicsFile,'utf8')), topic=(data.topics || []).find(item=>item.id===topicId), work=topic?.works?.find(item=>item.id===workId);
  if(!work) throw new Error('교체할 작품을 찾을 수 없습니다');
  const imageId=`${workId}-${Date.now()}-${randomBytes(4).toString('hex')}`, staging=path.join(imageStagingDir,`${imageId}-${Date.now()}`), input=path.join(staging,`${imageId}.${extension}`);
  await fs.mkdir(staging,{recursive:true});
  await fs.writeFile(input,file.data);
  try {
    await fs.mkdir(topicImageDir,{recursive:true});
    const display=await makeDisplayImage(input,staging,imageId);
    if((await fs.stat(display)).size>highResolutionStoredLimit) throw new Error('30MB 이하의 표시용 이미지를 만들 수 없습니다');
    const relative=`data/topic-images/${imageId}.display.jpg`, previous=String(work.thumbnail || '');
    await fs.rename(display,path.join(topicImageDir,`${imageId}.display.jpg`));
    work.thumbnail=relative;
    await fs.writeFile(topicsFile,JSON.stringify(data,null,2)+'\n','utf8');
    if(/^data\/topic-images\/[A-Za-z0-9_-]+\.display\.jpg$/.test(previous)) await fs.unlink(path.join(root,previous)).catch(()=>{});
    return {work,topics:data.topics};
  } finally { await fs.rm(staging,{recursive:true,force:true}).catch(()=>{}); }
}
async function deleteTopicArtwork(body) {
  const topicId=safeUploadId(body.topicId), workId=safeUploadId(body.workId);
  const data=JSON.parse(await fs.readFile(topicsFile,'utf8')), topic=(data.topics || []).find(item=>item.id===topicId), work=topic?.works?.find(item=>item.id===workId);
  if(!work) throw new Error('삭제할 작품을 찾을 수 없습니다');
  const thumbnail=String(work.thumbnail || '');
  topic.works=topic.works.filter(item=>item.id!==workId);
  await fs.writeFile(topicsFile,JSON.stringify(data,null,2)+'\n','utf8');
  if(/^data\/topic-images\/[A-Za-z0-9_-]+(?:\.display)?\.jpg$/.test(thumbnail)) await fs.unlink(path.join(root,thumbnail)).catch(()=>{});
  return {topics:data.topics};
}
http.createServer(async (req,res) => { const url=new URL(req.url,`http://${req.headers.host}`); res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization'); if(req.method==='OPTIONS') { res.writeHead(204); return res.end(); } if (!enforceJsonRequestLimit(req,res,url.pathname)) return;
  if (req.method==='GET' && url.pathname==='/api/access') { res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({adminConfigured:Boolean(adminPasswordHash)})); }
  if (req.method==='POST' && url.pathname==='/api/auth/login') { let body=''; req.on('data',chunk=>body+=chunk); req.on('end',async()=>{ try { await accessControlReady; if (!adminPasswordHash) throw new Error('관리자 설정 파일이 없어 보기 전용으로 실행 중입니다.'); const {email,password}=JSON.parse(body || '{}'), normalized=normalizedEmail(email); if (!isAdminEmail(normalized) || !samePassword(password)) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.'); if (activeAdminSession()) { res.writeHead(409,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:'이미 다른 창에서 관리자 모드가 열려 있습니다. 그 창을 닫은 뒤 다시 시도하세요.'})); } const token=createAdminSession(normalized); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,email:normalized,role:'admin',token})); } catch(error) { res.writeHead(401,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  const session=adminSession(req);
  if (req.method==='POST' && url.pathname==='/api/auth/heartbeat') { if (!session) return sendAdminRequired(res); res.writeHead(204,{'Cache-Control':'no-store'}); return res.end(); }
  if (req.method==='POST' && url.pathname==='/api/auth/logout') { if (session) { const token=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1]; if (token) adminSessions.delete(token); } res.writeHead(204,{'Cache-Control':'no-store'}); return res.end(); }
  if (requiresAdmin(req,url.pathname) && !session) return sendAdminRequired(res);
  if (req.method==='GET' && url.pathname==='/api/movement-documents') { try { const data=await readMovementDocuments(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({documents:{},error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/movement-documents/refresh') { let body=''; req.on('data',chunk=>body+=chunk); req.on('end',async()=>{ try { const payload=JSON.parse(body || '{}'), name=movementDocumentName(payload.name), slot=movementDocumentSlot(payload.slot), result=await refreshMovementDocumentLinks(name,slot); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/movement-documents') { try { const form=multipartForm(await readRequestBuffer(req,30*1024*1024),req.headers['content-type']), name=movementDocumentName(form.fields.name), slot=movementDocumentSlot(form.fields.slot), file=form.files.document, ext=path.extname(String(file?.filename || '')).toLowerCase(); if(!file || !['.html','.htm'].includes(ext) || !/^(text\/html|application\/xhtml\+xml|)$/.test(file.contentType)) throw new Error('Upload an HTML file'); if(!file.data.length) throw new Error('The HTML file is empty'); const data=await readMovementDocuments(), relative=movementDocumentRelative(name,slot), previous=data.documents?.[name]?.[slot], localHtml=await localizeMovementDocumentImages(file.data), linkedHtml=await linkMovementDocumentArtists(injectUHangulDocumentIntegration(localHtml)); await fs.mkdir(movementDocumentDir,{recursive:true}); const savedFile=path.join(root,relative); await fs.writeFile(savedFile,linkedHtml); if(previous && previous!==relative) await removeMovementDocument(previous); data.documents[name]={...(data.documents[name]||{}),[slot]:relative}; await writeMovementDocuments(data); syncPersonNameDictionary({additionalFiles:[savedFile]}); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,url:relative})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='DELETE' && url.pathname==='/api/movement-documents') { let body=''; req.on('data',chunk=>body+=chunk); req.on('end',async()=>{ try { const {name,slot}=JSON.parse(body), safeName=movementDocumentName(name), safeSlot=movementDocumentSlot(slot), data=await readMovementDocuments(), relative=data.documents?.[safeName]?.[safeSlot]; if(relative) await removeMovementDocument(relative); if(data.documents?.[safeName]) { delete data.documents[safeName][safeSlot]; if(!Object.keys(data.documents[safeName]).length) delete data.documents[safeName]; } await writeMovementDocuments(data); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ok:true})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/local-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveLocalArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artworks') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveTopicArtwork(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await replaceTopicArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='DELETE' && url.pathname==='/api/topic-artwork') { try { const body=JSON.parse((await readRequestBuffer(req,1024*1024)).toString('utf8') || '{}'), result=await deleteTopicArtwork(body); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/artists') { try { const data=await readArtistsFile(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artists:[],error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/techniques') { try { const data=JSON.parse(await fs.readFile(techniquesFile,'utf8')); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({techniques:[],error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/techniques') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {id,links}=JSON.parse(body || '{}'), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=techniques.find(item=>item.id===String(id || '')); if(!target) throw new Error('Technique not found'); target.links=techniqueLinks(links); await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,technique:target})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='DELETE' && url.pathname==='/api/techniques') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {id}=JSON.parse(body || '{}'), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=String(id || ''); if(!target || !techniques.some(item=>item.id===target)) throw new Error('Technique not found'); data.techniques=techniques.filter(item=>item.id!==target); await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,techniques:data.techniques})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if ((req.method==='PUT' || req.method==='POST') && url.pathname==='/api/artists') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const payload=JSON.parse(body), saved=await writeArtistsFile(payload,session.email); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,...saved})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='GET' && url.pathname==='/api/migration-export') { try { const result=await migrationExport(), stamp=new Date().toISOString().slice(0,10); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="art-through-time-firebase-${stamp}.json"`,'Cache-Control':'no-store'}); return res.end(JSON.stringify(result.export,null,2)); } catch(error) { res.writeHead(403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/artist-from-url') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const result=await artistFromUrl(JSON.parse(body).pageUrl); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/normalize-artist-works') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const result=await normalizeArtistWorks(JSON.parse(body).artist); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } }); return; }
  if (req.method==='GET' && url.pathname==='/api/artist-profile') { try { const qid=url.searchParams.get('qid'); if(!/^Q\d+$/.test(qid || '')) throw new Error('Invalid artist'); const artistEntity=(await getEntities([qid]))[qid]; const nationalityQid=entityId(artistEntity,'P27'); const nationalityEntity=nationalityQid ? (await getEntities([nationalityQid]))[nationalityQid] : null; res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({name:{ko:koreanArtistNameOverrides[qid] || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')}})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/artwork') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const result=await artworkDetails(JSON.parse(body).qid); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/artwork-info') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {artist,work}=JSON.parse(body); const result=await artworkInfo(artist,work); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({work:result})); } catch(error) { res.writeHead(502,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/thumbnail-from-url') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {artist,work,pageUrl}=JSON.parse(body), source=String(pageUrl || '').trim(); const localSource=/^file:/i.test(source) || !/^[a-z][a-z0-9+.-]*:\/\//i.test(source); const thumbnail=localSource ? await cacheThumbnailFromLocalPath(artist,work,source,adminEmail) : await cacheThumbnailFromPage(artist,work,source,adminEmail); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({thumbnail,verified:true})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); res.end(JSON.stringify({thumbnail:'',verified:false,error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/thumbnail-upload') { try { const form=multipartForm(await readRequestBuffer(req,sourceImageInputLimit + 1024*1024),req.headers['content-type']), artist=JSON.parse(form.fields.artist || '{}'), work=JSON.parse(form.fields.work || '{}'); if(!artist?.id || !work?.id) throw new Error('Invalid artwork upload'); const thumbnail=await cacheThumbnailFromUpload(artist,work,form.files.image,adminEmail); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail,verified:true})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail:'',verified:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/thumbnail') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {artist,work}=JSON.parse(body); const thumbnail=await cacheThumbnail(artist,work,adminEmail); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({thumbnail,verified:Boolean(thumbnail)})); } catch(error) { res.writeHead(502,{'Content-Type':'application/json'}); res.end(JSON.stringify({thumbnail:'',verified:false,error:error.message})); } }); return; }
  if (req.method==='GET' && url.pathname==='/api/search') { try { const query=url.searchParams.get('q')||'', kind=url.searchParams.get('type')||'artist'; const raw=kind==='artist' ? await artistSearchCandidates(query) : (await getJsonFast(api({action:'wbsearchentities',search:query,language:'ko',uselang:'ko',type:'item',limit:'20'}))).search?.map(item=>({id:item.id,label:item.label,description:item.description||''})) || []; const ranked=[...raw].sort((a,b)=>{const score=item=>similarityScore(query,item.label)+(kind==='artwork' ? /(회화|그림|painting|artwork|work of art)/i.test(item.description)?120:0 : /(화가|예술가|painter|visual artist|artist)/i.test(item.description)?120:0); return score(b)-score(a);}); const values=ranked.slice(0,8); res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify(values)); } catch(error) { res.writeHead(502,{'Content-Type':'application/json'}); return res.end(JSON.stringify([])); } }
  if(req.method==='POST'&&url.pathname==='/api/enrich'){let body='';req.on('data',c=>body+=c);req.on('end',async()=>{try{const result=await enrich(JSON.parse(body));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));}catch(error){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}});return;} const file=safePath(url.pathname);if(!file){res.writeHead(403);return res.end();}try{let data=await fs.readFile(file);if(/^data[\\/]미술사조[\\/][a-f0-9]{24}-[12]\.html$/i.test(path.relative(root,file))) { let html=injectUHangulDocumentIntegration(data); html=injectMovementWikipediaHeading(html,url.searchParams.get('movementWiki') || '',url.searchParams.get('movementLabel') || ''); data=Buffer.from(html,'utf8'); }res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch(_){res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log(`Art Atlas: http://localhost:4173${adminPasswordHash ? '' : ' (read-only: .env not found)'}`));
