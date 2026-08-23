/* Art Atlas local server: stores local collection data and local image files. */
const http = require('node:http');
const https = require('node:https');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { URL } = require('node:url');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { normalizeArtistsPayload, validateArtistsPayload, firebaseExport } = require('./data-contract');
const { invalidArtworkThumbnail } = require('./thumbnail-validation');
const { buildArtistMap, writeArtistMap: writeUHangulArtistMap } = require('./tools/build-uhangul-artist-map');
const { syncPersonNameDictionary } = require('./tools/sync-person-name-dictionary');
process.once('uncaughtException', error => {
  if (error?.code === 'EADDRINUSE') {
    console.error('Art Atlas is already running on http://localhost:4173');
    process.exit(1);
  }
  throw error;
});
const root = __dirname, dataDir = path.join(root, 'data'), highResolutionDir = path.join(dataDir, 'high-resolution'), imageStagingDir = path.join(dataDir, '.image-staging'), artistsFile = path.join(dataDir, 'artists.json'), techniquesFile = path.join(dataDir, 'techniques.json'), topicsFile = path.join(dataDir, 'topics.json'), topicImageDir = path.join(dataDir, 'topic-images'), movementSectionLinksFile = path.join(dataDir, 'movement-section-links.json'), backupsDir = path.join(dataDir, 'backups'), accessControlFile = path.join(dataDir, 'access-control.json'), migrationAssetManifestFile = path.join(dataDir, 'migration-assets.json'), auditLogFile = path.join(dataDir, 'audit-log.jsonl');
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
const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.ART_ATLAS_FFMPEG || (fsSync.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg');
const artistImportedWorkLimit = 60;
const highResolutionStoredLimit = 10 * 1024 * 1024;
const sourceImageInputLimit = 500 * 1024 * 1024;
let nextWikimediaRequestAt = 0;
let artistsWriteQueue = Promise.resolve();
let lastArtistsBackupAt = 0;
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
function clearAdminSessions(email='') {
  const target = normalizedEmail(email);
  for (const [token,session] of adminSessions) {
    if (!target || normalizedEmail(session.email) === target) adminSessions.delete(token);
  }
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
  return req.method !== 'GET' && ['/api/artists','/api/techniques','/api/movement-documents','/api/movement-documents/refresh','/api/movement-section-links','/api/local-artwork-image','/api/topic-artworks','/api/topic-artwork-image','/api/topic-artwork','/api/normalize-artist-works','/api/rules/check-and-apply','/api/artwork-info','/api/local-thumbnail-image'].includes(pathname);
}
function isJsonRequest(req, pathname) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return false;
  if (pathname === '/api/movement-documents') return req.method === 'DELETE';
  return ['/api/auth/login','/api/artists','/api/techniques','/api/movement-documents/refresh','/api/movement-section-links','/api/normalize-artist-works','/api/rules/check-and-apply','/api/artwork-info'].includes(pathname);
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
const koreanArtistNameOverrides = {Q6394591:'바실리 푸키레프',Q104884:'카스파 다비드 프리드리히',Q5598:'렘브란트 하르먼손 반 레인'};
const englishArtistNameOverrides = {Q5598:'Rembrandt Harmenszoon van Rijn'};
const koreanArtworkTitleOverrides = {Q2030685:'성모의 결혼식',Q2277635:'라자로의 부활',Q3788158:'헷 펠스켄',Q596683:'새벽',Q1985071:'메디치 마돈나',Q1587929:'리젠게비르게의 아침',Q17493547:'독립전쟁 전몰자의 묘지',Q3649324:'숲속의 엽병',Q4310993:'범선 위에서',Q17321856:'정원 정자',Q18602479:'항구의 밤',Q18603131:'이른 아침 안개 속의 배',Q1423223:'바다 위의 달돋이',Q3139782:'달을 바라보는 남자와 여자',Q2517970:'눈 덮인 오두막',Q999836:'저녁 항구의 배들',Q17422064:'거인산맥의 엘데나 수도원 폐허',Q3822640:'드레스덴의 큰 울타리',Q4126323:'거인산맥의 추억',Q232087:'달을 바라보는 두 남자'};
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
  const idCounts = new Map();
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    const key = id && idCounts.get(id) > 1 ? `id:${id}` : selectionKey(work);
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
async function artistProfileFromQid(qid, fallbackName='') {
  const artistEntity=(await getEntities([qid]))[qid]; if(!artistEntity) throw new Error('Artist not found');
  const nationalityQid=entityId(artistEntity,'P27'), movementQid=entityId(artistEntity,'P135');
  const related=await getEntities([nationalityQid,movementQid].filter(Boolean));
  const nationalityEntity=related[nationalityQid], movementEntity=related[movementQid];
  return {id:`artist-${qid}`,qid,name:{ko:koreanArtistNameOverrides[qid] || artistEntity?.labels?.ko?.value || fallbackName || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')},movement:{ko:entityLabel(movementEntity,'ko'),en:entityLabel(movementEntity,'en')},works:[]};
}
const artistProfileLookupCache = new Map();
function hasLocalizedText(value) {
  return Boolean(String(value?.ko || value?.en || value || '').trim());
}
async function cachedArtistProfileFromQid(qid, fallbackName='') {
  const key=String(qid || '');
  if(!artistProfileLookupCache.has(key)) {
    artistProfileLookupCache.set(key, artistProfileFromQid(key,fallbackName).catch(error => {
      artistProfileLookupCache.delete(key);
      throw error;
    }));
  }
  return artistProfileLookupCache.get(key);
}
async function hydrateMissingArtistProfiles(payload) {
  if(!payload || !Array.isArray(payload.artists)) return payload;
  for(const artist of payload.artists) {
    const qid=String(artist?.qid || '');
    if(!/^Q\d+$/.test(qid)) continue;
    const needsName=!hasLocalizedText(artist.name);
    const needsNationality=!hasLocalizedText(artist.nationality);
    const needsMovement=!hasLocalizedText(artist.movement);
    const needsBirth=!artist.birth;
    const needsDeath=!artist.death;
    if(!needsName && !needsNationality && !needsMovement && !needsBirth && !needsDeath) continue;
    try {
      const profile=await cachedArtistProfileFromQid(qid,artist.name?.ko || artist.name?.en || '');
      if(needsName && hasLocalizedText(profile.name)) artist.name=profile.name;
      if(needsNationality && hasLocalizedText(profile.nationality)) artist.nationality=profile.nationality;
      if(needsMovement && hasLocalizedText(profile.movement)) artist.movement=profile.movement;
      if(needsBirth && profile.birth) artist.birth=profile.birth;
      if(needsDeath && profile.death) artist.death=profile.death;
    } catch (_) {
      /* Saving local edits should not fail just because Wikidata is temporarily unavailable. */
    }
  }
  return payload;
}
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
const textFromHtml = html => htmlDecode(String(html || '').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<noscript\b[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
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
function thumbnailLocation(email, artistId) {
  return {folder:path.join(root,'data','thumbnails',artistId), relativePrefix:`data/thumbnails/${artistId}`};
}
function thumbnailExtension(value='') { return (String(value).match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)?.[1] || '').toLowerCase().replace('jpeg','jpg'); }
async function removeThumbnailFiles(directory, workId) {
  const safeWorkId=safeUploadId(workId);
  await Promise.all(['jpg','png','webp','gif'].map(extension => fs.unlink(path.join(directory,`${safeWorkId}.${extension}`)).catch(()=>{})));
}
async function makePngUnderStorageLimit(input, folder, fileBase, widths) {
  const output=path.join(folder,`${fileBase}.png`);
  for (const width of widths) {
    await execFileAsync(ffmpegPath,['-y','-i',input,'-vf',`scale=min(${width}\\,iw):-2`,'-frames:v','1','-update','1','-compression_level','9','-pred','mixed',output],{windowsHide:true,timeout:300000});
    if ((await fs.stat(output)).size < highResolutionStoredLimit) return output;
  }
  throw new Error('Could not create a PNG image smaller than 10 MB');
}
async function reduceImageBufferForStorage(image, extension, fileBase) {
  if (image.length < highResolutionStoredLimit) return {image,extension};
  const staging=path.join(imageStagingDir,`thumbnail-${fileBase}-${Date.now()}-${randomBytes(4).toString('hex')}`);
  await fs.mkdir(staging,{recursive:true});
  const input=path.join(staging,`source.${extension || 'jpg'}`);
  try {
    await fs.writeFile(input,image);
    const output=await makePngUnderStorageLimit(input,staging,'display',[2400,2000,1600,1400,1200,1000,800,640,480]);
    const reduced=await fs.readFile(output);
    return {image:reduced,extension:'png',reduced:true};
  } finally {
    await fs.rm(staging,{recursive:true,force:true}).catch(()=>{});
  }
}
function localThumbnailIndexTarget(relativePath) {
  const clean=String(relativePath || '').trim().replace(/[?#].*$/,'').replace(/\\/g,'/');
  if(!/^data\/thumbnails\//.test(clean) || clean === offlineArtworkPlaceholder) return null;
  const target=path.resolve(root,clean);
  const relative=path.relative(root,target).replace(/\\/g,'/');
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? target : null;
}
async function thumbnailIndexImageHash(item) {
  if(item?.imageHash) return String(item.imageHash);
  const target=localThumbnailIndexTarget(item?.thumbnail);
  if(!target) return '';
  try {
    return createHash('sha256').update(await fs.readFile(target)).digest('hex');
  } catch (_) {
    return '';
  }
}
async function assertUniqueThumbnailImage(index, work, imageHash) {
  const workId=String(work?.id || '');
  for(const [otherId,item] of Object.entries(index || {})) {
    if(String(otherId) === workId) continue;
    const otherHash=await thumbnailIndexImageHash(item);
    if(otherHash && otherHash === imageHash) {
      throw new Error(`The thumbnail is identical to another artwork thumbnail (${otherId}); rejected to prevent repeated wrong images`);
    }
  }
}
async function saveThumbnailBuffer(artist,work,image,extension,verifiedBy,email=adminEmail) {
  if(invalidArtworkThumbnail(image)) throw new Error('Image is a small interface icon');
  if(!['jpg','png','webp','gif'].includes(extension)) throw new Error('Unsupported image file type');
  if(image.length > sourceImageInputLimit) throw new Error('Image source is larger than 500 MB');
  const stored=await reduceImageBufferForStorage(image,extension,safeUploadId(work.id));
  image=stored.image;
  extension=stored.extension;
  if(invalidArtworkThumbnail(image)) throw new Error('Image is a small interface icon');
  const location=thumbnailLocation(email,artist.id), directory=location.folder, fileName=`${work.id}.${extension}`, relative=`${location.relativePrefix}/${fileName}`;
  await fs.mkdir(directory,{recursive:true});
  const indexPath=path.join(directory,'index.json');
  let index={};
  try { index=JSON.parse(await fs.readFile(indexPath,'utf8')); } catch (_) {}
  const imageHash=createHash('sha256').update(image).digest('hex');
  await assertUniqueThumbnailImage(index,work,imageHash);
  await removeThumbnailFiles(directory,work.id);
  await fs.writeFile(path.join(directory,fileName),image);
  index[work.id]={thumbnail:relative,checkedAt:new Date().toISOString(),verifiedBy:stored.reduced ? `${verifiedBy}; reduced below 10 MB and original discarded` : verifiedBy,imageHash};
  await fs.writeFile(indexPath,JSON.stringify(index,null,2),'utf8');
  return relative;
}
async function saveThumbnailFromLocalUpload(artist,work,file,email=adminEmail) { const extension=uploadExtension(file); if(!extension) throw new Error('Image must be JPG, PNG, WEBP, or GIF'); if(!file?.data?.length) throw new Error('Image file is empty'); if(file.data.length > sourceImageInputLimit) throw new Error('Image source is larger than 500 MB'); return saveThumbnailBuffer(artist,work,file.data,extension,`Uploaded local image: ${path.basename(file.filename)}`,email); }
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
  const baseName = oldName.replace(/\.display\.(?:jpe?g|png)$/i, '');
  const files = await fs.readdir(folder).catch(() => []);
  const match = files.find(name => name === oldName)
    || files.find(name => name.startsWith(`${baseName}_`) && /\.display\.(?:jpe?g|png)$/i.test(name))
    || files.find(name => name.startsWith(`${safeWorkId}_`) && /\.display\.(?:jpe?g|png)$/i.test(name));
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
  payload=await hydrateMissingArtistProfiles(payload);
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
function koreanTimestamp(date=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}`;
}
function ruleCheckItem(artist,work) {
  return {artist:artist.fullName || artist.name?.ko || artist.name?.en || artist.id,artistId:artist.id,work:work.title?.ko || work.title?.en || '(제목 없음)',workId:work.id || ''};
}
function qidLikeTitle(work) {
  const titles=[work?.title?.ko,work?.title?.en].map(value=>String(value || '').trim()).filter(Boolean);
  return titles.length > 0 && titles.every(value=>/^Q\d+$/.test(value));
}
const koreanArtistDisplayOverridesForCheck = {
  Q7814:'디 본도네, 조토',
  Q43270:'브뤼헐, 피터르 대',
  Q213163:'비제 르 브룅, 엘리자베스 루이',
  Q82445:'툴루즈로트레크, 앙리 드',
  Q301:'엘 그레코',
  Q5592:'부오나로티, 미켈란젤로',
  Q5597:'산치오, 라파엘로',
  Q5598:'렘브란트 하르먼손 반 레인',
  Q312617:'로소 피오렌티노'
};
function koreanFamilyFirstForCheck(name, originalName) {
  if (String(name || '').includes(',')) return String(name || '').trim();
  const korean=String(name || '').trim().split(/\s+/).filter(Boolean), original=String(originalName || '').trim().split(/\s+/).filter(Boolean);
  if(korean.length < 2 || original.length < 2) return korean.join(' ');
  const familyPrefixes=new Set(['van','von','de','del','della','da','di','du','la','le','der','den','ten','ter','st.','saint']);
  let familyLength=1;
  for(let index=original.length - 2; index >= 0 && familyPrefixes.has(original[index].toLowerCase()); index--) familyLength++;
  if(familyLength >= korean.length) return korean.join(' ');
  return `${korean.slice(-familyLength).join(' ')}, ${korean.slice(0,-familyLength).join(' ')}`;
}
function expectedArtistDisplayNameForCheck(artist) {
  const korean=artist?.name?.ko || '';
  return koreanArtistDisplayOverridesForCheck[artist?.qid] || koreanFamilyFirstForCheck(korean, artist?.name?.en || '');
}
function actualArtistDisplayNameForCheck(artist) {
  return String(artist?.fullName || '').trim() || expectedArtistDisplayNameForCheck(artist) || artist?.name?.en || artist?.id || '';
}
function artistRuleItem(artist, message) {
  return {artist:actualArtistDisplayNameForCheck(artist),artistId:artist.id,work:message,workId:artist.qid || ''};
}
function hasHangul(value) { return /[가-힣]/.test(String(value || '')); }
function hasLatin(value) { return /[A-Za-z]/.test(String(value || '')); }
function compactCheckText(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g,''); }
function koreanDutchVanText(value) {
  return /(^|\s)판(?=\s|$)/.test(String(value || ''));
}
function dutchVanRomanizationIssues(artists) {
  const issues=[];
  for(const artist of artists) {
    const original=[artist?.name?.en,artist?.originalName,artist?.englishFullName].map(value=>String(value || '')).join(' ');
    if(!/\bvan\b/i.test(original)) continue;
    const aliases=Array.isArray(artist?.aliases) ? artist.aliases : [...(Array.isArray(artist?.aliases?.ko) ? artist.aliases.ko : [])];
    const values=[artist?.name?.ko,artist?.fullName,actualArtistDisplayNameForCheck(artist),...aliases].map(value=>String(value || '').trim()).filter(Boolean);
    const bad=values.find(koreanDutchVanText);
    if(bad) issues.push(artistRuleItem(artist,`네덜란드어 van 한국어 표기 확인: ${bad} → 반`));
  }
  return issues;
}
function localizedCheckValue(value) {
  if(value && typeof value === 'object' && !Array.isArray(value)) return String(value.ko || value.en || value.original || value.native || value.sourceTitle || '').trim();
  return String(value || '').trim();
}
const currentCountryByHistoricalCountryForCheck = {
  'Kingdom of the Netherlands': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'}, '네덜란드 왕국': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'},
  'Dutch Republic': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'}, '네덜란드 공화국': {ko:'네덜란드', en:'Netherlands',colorKey:'Netherlands'},
  'Kingdom of Prussia': {ko:'독일', en:'Germany',colorKey:'Germany'}, '프로이센 왕국': {ko:'독일', en:'Germany',colorKey:'Germany'},
  'Russian Empire': {ko:'러시아', en:'Russia',colorKey:'Russia'}, '러시아 제국': {ko:'러시아', en:'Russia',colorKey:'Russia'},
  'Papal States': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '교황령': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Holy Roman Empire': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '신성 로마 제국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Republic of Florence': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '피렌체 공화국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Duchy of Milan': {ko:'이탈리아', en:'Italy',colorKey:'Italy'}, '밀라노 공국': {ko:'이탈리아', en:'Italy',colorKey:'Italy'},
  'Duchy of Brabant': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '브라반트 공국': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Habsburg Netherlands': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '합스부르크 네덜란드': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Spanish Netherlands': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'}, '스페인령 네덜란드': {ko:'벨기에', en:'Belgium',colorKey:'Belgium'},
  'Crown of Castile': {ko:'스페인', en:'Spain',colorKey:'Spain'}, '카스티야 연합왕국': {ko:'스페인', en:'Spain',colorKey:'Spain'}
};
function countryInfoForCheck(value) {
  const original = localizedCheckValue(value);
  const keys = [original, value?.ko, value?.en].filter(Boolean);
  const current = keys.map(key => currentCountryByHistoricalCountryForCheck[key]).find(Boolean);
  const name = current ? localizedCheckValue(current) : original;
  return {original, name, label:original && name && original !== name ? `${original} (${name})` : name};
}
async function artistCountryIconIssues(artists) {
  const issues=[];
  const appText=await fs.readFile(path.join(root,'app.js'),'utf8').catch(()=>'');
  if(appText && !/title="\$\{esc\(countryLabel\)\}"/.test(appText)) issues.push({artist:'화가 목록',artistId:'artist-country-icon-title',work:'국가 아이콘 title에 국가명이 연결되지 않음',workId:'app.js'});
  if(appText && !/aria-label="\$\{esc\(countryLabel\)\}"/.test(appText)) issues.push({artist:'화가 목록',artistId:'artist-country-icon-aria-label',work:'국가 아이콘 aria-label에 국가명이 연결되지 않음',workId:'app.js'});
  for(const artist of artists) {
    const countryValue=artist.birthCountry || artist.nationality;
    const country=countryInfoForCheck(countryValue);
    if(!country.original || !country.name || country.label === '?') {
      issues.push(artistRuleItem(artist,'화가 목록 국가 아이콘에 표시할 국가명 누락'));
      continue;
    }
    if(!hasHangul(country.label) || hasLatin(country.label)) issues.push(artistRuleItem(artist,`국가 아이콘 한국어 국가명 확인: ${country.label}`));
  }
  return issues;
}
function collectionLabelsForCheck(work) {
  const values=work?.detail?.facts?.collection || work?.collection || [];
  const entries=Array.isArray(values) ? values : [values];
  return entries.map(localizedCheckValue).filter(Boolean);
}
function artistNamesForThumbnailCheck(artist) {
  const aliases=Array.isArray(artist?.aliases) ? artist.aliases : [...(Array.isArray(artist?.aliases?.ko) ? artist.aliases.ko : []), ...(Array.isArray(artist?.aliases?.en) ? artist.aliases.en : [])];
  return [...new Set([artist?.fullName, artist?.name?.ko, artist?.name?.en, actualArtistDisplayNameForCheck(artist), ...aliases].map(value=>String(value || '').trim()).filter(Boolean))];
}
function flexibleNamePatternForCheck(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s-]+');
}
function artworkThumbnailTitleForCheck(work, artist, sourceTitle) {
  let title=String(sourceTitle || '').replace(/\s+/g,' ').trim();
  title=title
    .replace(/^\s*file:\s*/i,'')
    .replace(/\s*\(\s*(?:c\.?\s*)?\d{3,4}[^)]*\)(?:\s*,.*)?$/i,'')
    .replace(/\s*,\s*(?:c\.?\s*)?\d{3,4}(?:\s*[–-]\s*\d{2,4})?(?:\s*,.*)?$/i,'')
    .replace(/\s*,\s*(?:private )?(?:museum|gallery|collection|museum collection|royal museums?).*$/i,'');
  for(const name of artistNamesForThumbnailCheck(artist)) {
    const namePattern=flexibleNamePatternForCheck(name);
    title=title
      .replace(new RegExp(`^\\s*${namePattern}\\s*(?:,|:|—|–|-)\\s*`,'i'),'')
      .replace(new RegExp(`\\s+(?:by|after|follower of|circle of|school of)\\s+${namePattern}\\s*$`,'i'),'')
      .replace(new RegExp(`\\s*\\((?:after|follower of|circle of|school of)\\s+${namePattern}\\)\\s*$`,'i'),'')
      .replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${namePattern}(?:\\s*,.*)?$`,'i'),'');
  }
  for(const collection of collectionLabelsForCheck(work)) {
    const collectionPattern=flexibleNamePatternForCheck(collection);
    title=title.replace(new RegExp(`\\s*(?:,|—|–|-)\\s*${collectionPattern}(?:\\s*,.*)?$`,'i'),'');
  }
  return title.trim() || String(sourceTitle || '').trim();
}
function thumbnailTitleHasExtraForCheck(work, artist, title) {
  const clean=artworkThumbnailTitleForCheck(work, artist, title);
  const cleanKey=compactCheckText(clean);
  if(!cleanKey) return false;
  for(const collection of collectionLabelsForCheck(work)) {
    const key=compactCheckText(collection);
    if(key && key.length >= 2 && cleanKey.includes(key)) return true;
  }
  return /\b(?:museum|gallery|collection|musee|museo|nationalmuseum|louvre|metropolitan)\b/i.test(clean);
}
function thumbnailTitleExtraItems(artists) {
  return artists.flatMap(artist=>(artist.works || []).flatMap(work=>{
    const titles=[work?.title?.ko,work?.title?.en,work?.title?.original,work?.title?.native,work?.title?.sourceTitle].map(value=>String(value || '').trim()).filter(Boolean);
    return titles.some(title=>thumbnailTitleHasExtraForCheck(work,artist,title)) ? [ruleCheckItem(artist,work)] : [];
  }));
}
function localImageFileForDuplicateCheck(value) {
  const src=String(value || '').trim().replace(/[?#].*$/,'').replace(/\\/g,'/');
  if(!/^data\/(?:thumbnails|high-resolution)\//.test(src) || src === offlineArtworkPlaceholder) return null;
  const target=path.resolve(root,src);
  const relative=path.relative(root,target).replace(/\\/g,'/');
  if(!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return {src,target};
}
async function localImageHashForDuplicateCheck(target) {
  try {
    const buffer=await fs.readFile(target);
    return createHash('sha256').update(buffer).digest('hex');
  } catch (_) {
    return '';
  }
}
async function duplicateArtworkImageIssues(artists) {
  const issues=[];
  const hashCache=new Map();
  for(const artist of artists) {
    const byHash=new Map();
    for(const work of artist.works || []) {
      const imageRefs=[['thumbnail',work.thumbnail],['highResImage',work.highResImage]];
      for(const [field,value] of imageRefs) {
        const file=localImageFileForDuplicateCheck(value);
        if(!file) continue;
        let hash=hashCache.get(file.target);
        if(hash === undefined) {
          hash=await localImageHashForDuplicateCheck(file.target);
          hashCache.set(file.target,hash);
        }
        if(!hash) continue;
        const workId=String(work.id || '');
        const bucket=byHash.get(hash) || {files:new Set(),works:new Map(),fields:new Set()};
        bucket.files.add(file.src);
        bucket.fields.add(field);
        if(!bucket.works.has(workId)) bucket.works.set(workId,work);
        byHash.set(hash,bucket);
      }
    }
    for(const [hash,bucket] of byHash) {
      const duplicatedWorks=[...bucket.works.values()];
      if(duplicatedWorks.length < 2) continue;
      const titles=duplicatedWorks.slice(0,8).map(work=>localizedCheckValue(work.title) || work.id).join(', ');
      const more=duplicatedWorks.length > 8 ? ` 외 ${duplicatedWorks.length - 8}점` : '';
      issues.push({
        artist:actualArtistDisplayNameForCheck(artist) || localizedCheckValue(artist.name) || artist.id,
        artistId:artist.qid || artist.id || '',
        work:`같은 이미지 파일 내용이 ${duplicatedWorks.length}개 작품에 반복 연결됨: ${titles}${more}`,
        workId:`${[...bucket.fields].join('+')} · ${[...bucket.files].slice(0,3).join(', ')} · sha256:${hash.slice(0,12)}`
      });
    }
  }
  return issues;
}
function movementFilterEntryForCheck(artist) {
  const movement=artist?.movement;
  const label=localizedCheckValue(movement);
  const id=compactCheckText(movement?.en || movement?.ko || label);
  return id && label ? {id,label} : null;
}
async function artistMovementFilterIssues(artists) {
  const issues=[];
  const appText=await fs.readFile(path.join(root,'app.js'),'utf8').catch(()=>'');
  if(appText && !/const artistMovement = loc\(artist\?\.movement\) \|\| loc\(artistMovementFallbacks\[artist\?\.qid\]\);[\s\S]*?if \(artistMovement\) return artistMovement;/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'artist-movement-primary',work:'목록 표시 대표 사조가 artist.movement를 우선하지 않음',workId:'app.js'});
  }
  if(appText && /\(artist\?\.works \|\| \[\]\)\.forEach\(work => entries\.push\(movementEntry\(work\?\.movement\)\)\)/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'artist-movement-work-tags',work:'사조 필터가 작품별 사조를 무조건 수집함',workId:'app.js'});
  }
  if(appText && !/self\.findIndex\(item => compactMovementName\(item\.label\) === compactMovementName\(option\.label\)\) === index/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'artist-movement-option-dedupe',work:'사조 드롭다운 라벨 중복 제거 확인 코드 누락',workId:'app.js'});
  }
  const entries=[];
  for(const artist of artists) {
    const entry=movementFilterEntryForCheck(artist);
    if(!entry) {
      issues.push(artistRuleItem(artist,'화가 대표 사조 누락: 사조 필터가 작품별 사조에 의존할 수 있음'));
      continue;
    }
    if(!hasHangul(entry.label)) issues.push(artistRuleItem(artist,`화가 대표 사조 한국어 표기 확인: ${entry.label}`));
    entries.push({...entry,artist});
  }
  const labelByKey=new Map();
  for(const entry of entries) {
    const key=compactCheckText(entry.label);
    if(!key) continue;
    const existing=labelByKey.get(key);
    if(existing && existing.id !== entry.id) {
      issues.push({artist:'화가 목록',artistId:'artist-movement-option-duplicate',work:`사조 드롭다운 중복 라벨 가능성: ${existing.label} / ${entry.label}`,workId:'data/artists.json'});
    } else labelByKey.set(key,entry);
  }
  const mannerismArtists=entries.filter(entry=>entry.id === compactCheckText('Mannerism') || entry.id === compactCheckText('매너리즘')).map(entry=>entry.artist.qid || entry.artist.id);
  if(mannerismArtists.includes('Q5592')) issues.push({artist:'화가 목록',artistId:'artist-movement-mannerism-match',work:'매너리즘 필터에 미켈란젤로가 포함될 위험 있음',workId:'data/artists.json'});
  return issues;
}
function sourceBlock(text='', startMarker='', endMarker='') {
  const start=String(text || '').indexOf(startMarker);
  if(start < 0) return '';
  const rest=String(text).slice(start);
  const end=endMarker ? rest.indexOf(endMarker) : -1;
  return end >= 0 ? rest.slice(0,end) : rest;
}
function movementRuleLabelsFromBlock(block='') {
  return [...String(block || '').matchAll(/\{ko:'([^']+)',\s*en:'([^']+)'/g)].map(match=>match[1]);
}
function movementOverrideIdsFromBlock(block='') {
  return new Set([...String(block || '').matchAll(/\b(Q\d+)\s*:/g)].map(match=>match[1]));
}
async function movementClassificationSyncIssues() {
  const issues=[];
  const appText=await fs.readFile(path.join(root,'app.js'),'utf8').catch(()=>'');
  const serverText=await fs.readFile(path.join(root,'server.js'),'utf8').catch(()=>'');
  const appRules=sourceBlock(appText,'const artistMovementDisplayRules = [','const artistMovementClassificationOverrides');
  const serverRules=sourceBlock(serverText,'const serverArtistMovementDisplayRules = [','const serverArtistMovementClassificationOverrides');
  const appLabels=movementRuleLabelsFromBlock(appRules);
  const serverLabels=new Set(movementRuleLabelsFromBlock(serverRules));
  if(!appRules) issues.push({artist:'사조 분류 기준',artistId:'movement-display-rules-app',work:'화가 목록·연표용 하부 사조 표시 규칙을 찾지 못함',workId:'app.js'});
  if(!serverRules) issues.push({artist:'사조 분류 기준',artistId:'movement-display-rules-server',work:'사조 설명 문서 카드용 하부 사조 표시 규칙을 찾지 못함',workId:'server.js'});
  for(const label of appLabels) {
    if(!serverLabels.has(label)) issues.push({artist:'사조 분류 기준',artistId:'movement-display-rule-sync',work:`화가 목록·연표에는 있으나 사조 설명 카드 표시 규칙에는 없는 하부 사조: ${label}`,workId:'app.js/server.js'});
  }
  const appOverrideBlock=sourceBlock(appText,'const artistMovementClassificationOverrides = {','function movementEntry');
  const serverOverrideBlock=sourceBlock(serverText,'const serverArtistMovementClassificationOverrides = {','const serverArtistMovementFallbacks');
  const appOverrideIds=movementOverrideIdsFromBlock(appOverrideBlock);
  const serverOverrideIds=movementOverrideIdsFromBlock(serverOverrideBlock);
  if(!appOverrideBlock) issues.push({artist:'사조 분류 기준',artistId:'movement-overrides-app',work:'화가 목록·연표용 화가별 하부 사조 override를 찾지 못함',workId:'app.js'});
  if(!serverOverrideBlock) issues.push({artist:'사조 분류 기준',artistId:'movement-overrides-server',work:'사조 설명 문서 카드용 화가별 하부 사조 override를 찾지 못함',workId:'server.js'});
  for(const qid of appOverrideIds) {
    if(!serverOverrideIds.has(qid)) issues.push({artist:'사조 분류 기준',artistId:'movement-overrides-sync',work:`화가 목록·연표 override에는 있으나 사조 설명 카드 override에는 없는 화가 QID: ${qid}`,workId:'app.js/server.js'});
  }
  if(serverText && !/injectMovementArtworkMovementLabels\(html\)/.test(serverText)) {
    issues.push({artist:'사조 설명 문서',artistId:'movement-document-artist-movement-labels',work:'사조 설명 문서 이미지 카드에 화가 사조를 주입하는 단계가 누락됨',workId:'server.js'});
  }
  if(appText && !/artistMovementDisplayInfo\(a\)\.parentLabel/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'movement-list-parent-label',work:'왼쪽 화가 목록이 대분류 사조만 표시하는 기준에서 벗어날 위험 있음',workId:'app.js'});
  }
  if(appText && !/const artistMovementInfo = artistMovementDisplayInfo\(artist\);[\s\S]*artistMovementInfo\.label/.test(appText)) {
    issues.push({artist:'화가 연표',artistId:'movement-timeline-detail-label',work:'화가 연표 상단 사조 표시가 하부 사조 - 상부 사조 기준을 쓰는지 확인 필요',workId:'app.js'});
  }
  return issues;
}
const expectedManualUHangulByArtistId = {
  Q68631:'[Vㅏㄴ] 데르 [Vㅔ]이던, [Rㅗ]히어르'
};
async function uHangulRuleIssues(artists) {
  const issues=[];
  const fontFile=path.join(root,'uhangul','assets','fonts','uHangul-v0.5.woff2');
  const runtimeFile=path.join(root,'uhangul','uhangul-runtime.js');
  const cssFile=path.join(root,'uhangul','uhangul-runtime.css');
  const exists=file=>fs.access(file).then(()=>true).catch(()=>false);
  if(!await exists(fontFile)) issues.push({artist:'uHangul',artistId:'uhangul-font',work:'uHangul 폰트 파일 누락',workId:'uhangul/assets/fonts/uHangul-v0.5.woff2'});
  if(!await exists(runtimeFile)) issues.push({artist:'uHangul',artistId:'uhangul-runtime',work:'uHangul 런타임 파일 누락',workId:'uhangul/uhangul-runtime.js'});
  if(!await exists(cssFile)) issues.push({artist:'uHangul',artistId:'uhangul-css',work:'uHangul CSS 파일 누락',workId:'uhangul/uhangul-runtime.css'});
  const runtimeText=await fs.readFile(runtimeFile,'utf8').catch(()=>'');
  if(runtimeText && !/byText\.get\(normalizeText\(el\.dataset\.uhDisplayKorean\)\)/.test(runtimeText)) issues.push({artist:'uHangul',artistId:'uhangul-runtime-attribute-resolution',work:'화면 data-uh-display-korean 속성이 uHangul 사전을 먼저 찾지 않음',workId:'uhangul/uhangul-runtime.js'});
  const records=buildArtistMap(artists);
  const byId=new Map(records.map(record=>[String(record.id || ''), record]));
  const byText=new Map();
  for(const record of records) {
    const aliases=Array.isArray(record.aliases) ? record.aliases : [...(Array.isArray(record.aliases?.ko) ? record.aliases.ko : []), ...(Array.isArray(record.aliases?.en) ? record.aliases.en : [])];
    [record.original,record.korean,record.displayKorean,...aliases].filter(Boolean).forEach(value=>byText.set(compactCheckText(value),record));
  }
  for(const artist of artists) {
    const key=String(artist.qid || artist.id || '');
    const record=byId.get(key);
    if(!record) { issues.push(artistRuleItem(artist,'uHangul 화가 맵 항목 누락')); continue; }
    if(!record.uhangul) issues.push(artistRuleItem(artist,'uHangul 표기 누락'));
    const expected=expectedArtistDisplayNameForCheck(artist);
    if(expected && record.displayKorean !== expected) issues.push(artistRuleItem(artist,`uHangul 표시명 불일치: ${record.displayKorean || '(없음)'} → ${expected}`));
    const manualExpected=expectedManualUHangulByArtistId[key];
    if(manualExpected && record.uhangul !== manualExpected) issues.push(artistRuleItem(artist,`uHangul 변환 표식 불일치: ${record.uhangul || '(없음)'} → ${manualExpected}`));
    const display=actualArtistDisplayNameForCheck(artist);
    if(display && !byText.get(compactCheckText(display))) issues.push(artistRuleItem(artist,`화면 표시명으로 uHangul 사전 항목을 찾을 수 없음: ${display}`));
  }
  return issues;
}
async function techniqueTitleLinkButtonIssues() {
  const issues=[];
  const techniqueText=await fs.readFile(path.join(root,'techniques.js'),'utf8').catch(()=>'');
  const serverText=await fs.readFile(path.join(root,'server.js'),'utf8').catch(()=>'');
  if(techniqueText && !/function setupTechniqueLinkEntry/.test(techniqueText)) issues.push({artist:'미술 기법 및 용어',artistId:'technique-link-entry',work:'기법 제목 옆 + 입력 처리 함수 누락',workId:'techniques.js'});
  if(techniqueText && !/if\(technique\.comparison\)\{[\s\S]*technique-title-row[\s\S]*\$\{linkAdd\}\$\{linkControls\}[\s\S]*setupTechniqueLinkEntry\(technique\)[\s\S]*setupTechniqueLinkButtons\(techniqueContent,technique\)/.test(techniqueText)) issues.push({artist:'미술 기법 및 용어',artistId:'technique-comparison-link-add',work:'비교 기법 제목 옆 + 자료 버튼 또는 링크 버튼 연결 누락',workId:'techniques.js'});
  if(serverText && !/comparisonTechniqueIds\.has\(techniqueId\)/.test(serverText)) issues.push({artist:'미술 기법 및 용어',artistId:'technique-comparison-link-save',work:'비교 기법 자료 링크 저장 허용 목록 누락',workId:'server.js'});
  if(serverText && !/data\.comparisonLinks\[techniqueId\]=nextLinks/.test(serverText)) issues.push({artist:'미술 기법 및 용어',artistId:'technique-comparison-link-storage',work:'비교 기법 자료 링크 저장 경로 누락',workId:'server.js'});
  return issues;
}
async function movementDocumentImageIssues() {
  const issues=[];
  const readable=file=>fs.open(file,'r').then(handle=>handle.close().then(()=>true,()=>true)).catch(()=>false);
  const entries=await fs.readdir(path.join(root,'data','미술사조'),{withFileTypes:true}).catch(()=>[]);
  for(const entry of entries) {
    if(!entry.isFile() || !/\.html?$/i.test(entry.name)) continue;
    const file=path.join(root,'data','미술사조',entry.name);
    const html=await fs.readFile(file,'utf8').catch(()=>'');
    for(const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const src=String(match[1] || '').trim();
      if(!src || /^(?:https?:)?\/\//i.test(src) || /^data:/i.test(src)) continue;
      const clean=src.replace(/[?#].*$/,'').replace(/\\/g,'/');
      const target=path.resolve(path.dirname(file),clean);
      const relative=path.relative(root,target).replace(/\\/g,'/');
      const outside=!relative || relative.startsWith('..') || path.isAbsolute(relative);
      const missing=outside || !await readable(target);
      const unstable=/^(?:\.\.\/)?(?:thumbnails|high-resolution)\//.test(clean) || /^data\/(?:thumbnails|high-resolution)\//.test(clean);
      if(missing || unstable) {
        const reason=missing ? '이미지 파일 누락 또는 읽기 불가' : 'Git에 올리지 않는 이미지 폴더 직접 참조';
        issues.push({artist:'미술사조 HTML',artistId:entry.name,work:`${reason}: ${src}`,workId:`data/미술사조/${entry.name}`});
      }
    }
  }
  return issues;
}
async function displayDataImageIssues() {
  const issues=[];
  const readable=file=>fs.open(file,'r').then(handle=>handle.close().then(()=>true,()=>true)).catch(()=>false);
  const displayFiles=['techniques.json','featured-works.json','topics.json'];
  const imageKeys=new Set(['image','thumbnail']);
  const walk=async (node,fileName,trail=[]) => {
    if(!node || typeof node !== 'object') return;
    if(Array.isArray(node)) {
      for(let index=0; index<node.length; index++) await walk(node[index],fileName,[...trail,`[${index}]`]);
      return;
    }
    for(const [key,value] of Object.entries(node)) {
      const nextTrail=[...trail,key];
      if(imageKeys.has(key) && typeof value === 'string' && value.trim()) {
        const src=value.trim();
        const external=/^(?:https?:)?\/\//i.test(src);
        const clean=src.replace(/[?#].*$/,'').replace(/\\/g,'/');
        const unstable=/^data\/(?:thumbnails|high-resolution)\//.test(clean) || /^(?:\.\.\/)?(?:thumbnails|high-resolution)\//.test(clean);
        let missing=false;
        if(!external && !/^data:/i.test(src)) {
          const target=path.resolve(root,clean);
          const relative=path.relative(root,target).replace(/\\/g,'/');
          const outside=!relative || relative.startsWith('..') || path.isAbsolute(relative);
          missing=outside || !await readable(target);
        }
        if(external || unstable || missing) {
          const reason=external ? '외부 이미지 URL 직접 참조' : (missing ? '이미지 파일 누락 또는 읽기 불가' : '캐시 이미지 폴더 직접 참조');
          issues.push({artist:'표시 데이터 이미지',artistId:fileName,work:`${reason}: ${nextTrail.join('.')} → ${src}`,workId:`data/${fileName}`});
        }
      }
      await walk(value,fileName,nextTrail);
    }
  };
  for(const fileName of displayFiles) {
    const file=path.join(dataDir,fileName);
    const data=await fs.readFile(file,'utf8').then(JSON.parse).catch(()=>null);
    await walk(data,fileName);
  }
  return issues;
}
async function oversizedLocalImageIssues() {
  const issues=[];
  const imagePattern=/\.(?:jpe?g|png|webp|gif)$/i;
  const walk=async folder => {
    const entries=await fs.readdir(folder,{withFileTypes:true}).catch(()=>[]);
    for(const entry of entries) {
      const file=path.join(folder,entry.name);
      if(entry.isDirectory()) {
        if(entry.name === 'backups') continue;
        await walk(file);
        continue;
      }
      if(!entry.isFile() || !imagePattern.test(entry.name)) continue;
      const stat=await fs.stat(file).catch(()=>null);
      if(!stat || stat.size <= highResolutionStoredLimit) continue;
      const relative=path.relative(root,file).replace(/\\/g,'/');
      const mb=(stat.size / 1024 / 1024).toFixed(2);
      issues.push({artist:'로컬 이미지',artistId:'image-size-limit',work:`10MB 초과 파일: ${mb}MB`,workId:relative});
    }
  };
  await walk(dataDir);
  return issues;
}
function htmlPlainText(value) {
  return String(value || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
async function movementPioneerContextIssues() {
  const issues=[];
  const index=await fs.readFile(path.join(root,'data','미술사조','index.json'),'utf8').then(JSON.parse).catch(()=>null);
  for(const [documentName,slots] of Object.entries(index?.documents || {})) {
    const expectedKey=movementPioneerDocumentContextByName[documentName] || '';
    if(!expectedKey) {
      issues.push({artist:'미술사조 HTML',artistId:documentName,work:'선구자 공통 문구의 index.json 기준 매핑 누락',workId:'data/미술사조/index.json'});
      continue;
    }
    if(!movementPioneerContexts[expectedKey]) {
      issues.push({artist:'미술사조 HTML',artistId:documentName,work:`선구자 공통 문구 본문 누락: ${expectedKey}`,workId:'server.js'});
      continue;
    }
    for(const documentPath of Object.values(slots || {})) {
      const relative=String(documentPath || '').replace(/\\/g,'/');
      const html=await fs.readFile(path.join(root,relative),'utf8').catch(()=>'');
      if(!html) continue;
      if(/data-art-atlas-pioneer-context/i.test(html)) {
        const expectedPlain=htmlPlainText(movementPioneerContexts[expectedKey]).slice(0,60);
        if(expectedPlain && !htmlPlainText(html).includes(expectedPlain)) {
          issues.push({artist:'미술사조 HTML',artistId:documentName,work:`정적 선구자 공통 문구가 index.json 기준과 다름: ${expectedKey}`,workId:relative});
        }
      }
    }
  }
  return issues;
}
async function writeRuleCheckReport(result) {
  const reportFolder=path.join(root,'변경사항');
  const reportFile=path.join(reportFolder,`규칙점검_${koreanTimestamp()}.md`);
  const rows=items => items.length ? items.map(item=>`- ${item.artist} · ${item.work}${item.workId ? ` (${item.workId})` : ''}`).join('\n') : '- 없음';
  let text=['# 전체 규칙 점검 보고서','',`- 점검 시각: ${new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`,`- 결과: ${result.changed ? '최신 공통 규칙을 적용하고 저장함' : '저장 데이터가 현재 공통 규칙과 일치함'}`,`- 데이터 버전: ${result.revision}`,'','## 대상','',`- 화가: ${result.stats.artists}명`,`- 작품: ${result.stats.works}점`,`- 이름 사전: ${result.stats.nameDictionary}개 항목 재생성`,`- 미술사조 문서의 화가 링크: 열 때마다 최신 별칭으로 동적 연결`,'','## 자동 적용한 범위','','- 최신 작품 정리·중복 처리 규칙','- 고해상도 이미지 경로 재확인','- 화가 이름 사전 및 uHangul 화가 맵 재생성','- 화가 목록·연표 제목의 한국어 표시명, 성·이름 순서, 네덜란드어 van=반 표기, uHangul 런타임·변환 표식 점검','- 화가 목록 국가 아이콘의 국가명 title·aria-label 연결 및 한국어 국가명 점검','- 기법 설명 오른쪽 페이지 제목 옆 + 자료 버튼 및 비교 기법 저장 경로 점검','- 미술사조 HTML 이미지 파일 누락 및 Git 비관리 이미지 폴더 직접 참조 점검','- 기법·대표작·주제-사건 표시 데이터의 외부 URL, 캐시 폴더 직접 참조, 이미지 파일 누락 점검','- 썸네일 제목의 소장처 정보 혼입 점검','- 화가별 로컬 썸네일·고해상도 이미지의 파일 내용 중복 점검','','수동 입력 작품, 대표작 선택, 직접 작성한 설명·이미지는 덮어쓰지 않았다. 외부 웹에서 작품을 재수집하거나 삭제하지 않았다.','','## 확인이 필요한 항목','',`### 이미지가 없는 작품 (${result.issues.missingPreview.length}점)`,'',rows(result.issues.missingPreview),'',`### 제목이 없는 작품 (${result.issues.missingTitle.length}점)`,'',rows(result.issues.missingTitle),'',`### QID가 제목으로 남은 작품 (${result.issues.qidTitle.length}점)`,'',rows(result.issues.qidTitle),'',`### 화가 목록·연표 표시명이 한국어가 아닌 항목 (${result.issues.artistDisplayKorean.length}점)`,'',rows(result.issues.artistDisplayKorean),'',`### 화가 목록·연표 표시명의 성, 이름 순서 확인 항목 (${result.issues.artistDisplayOrder.length}점)`,'',rows(result.issues.artistDisplayOrder),'',`### 네덜란드어 van 한국어 표기 확인 항목 (${result.issues.artistDutchVanRomanization.length}점)`,'',rows(result.issues.artistDutchVanRomanization),'',`### 화가 목록 국가 아이콘의 국가명 확인 항목 (${result.issues.artistCountryIcon.length}점)`,'',rows(result.issues.artistCountryIcon),'',`### uHangul 폰트·런타임·화가 맵·변환 표식 확인 항목 (${result.issues.uHangulConnection.length}점)`,'',rows(result.issues.uHangulConnection),'',`### 기법 설명 제목 옆 + 자료 버튼 확인 항목 (${result.issues.techniqueTitleLinkButton.length}점)`,'',rows(result.issues.techniqueTitleLinkButton),'',`### 미술사조 HTML 이미지 경로 확인 항목 (${result.issues.movementDocumentImage.length}점)`,'',rows(result.issues.movementDocumentImage),'',`### 표시 데이터 이미지 경로 확인 항목 (${result.issues.displayDataImage.length}점)`,'',rows(result.issues.displayDataImage),'',`### 썸네일 제목에 소장처 정보가 남은 작품 (${result.issues.thumbnailTitleExtra.length}점)`,'',rows(result.issues.thumbnailTitleExtra),'',`### 같은 이미지 파일 내용이 반복 연결된 작품 (${result.issues.duplicateArtworkImage.length}건)`,'',rows(result.issues.duplicateArtworkImage),'','## 참고 항목','',`### 공개 이미지 없음으로 표시한 작품 (${result.issues.reviewedNoPublicImage.length}점)`,'',rows(result.issues.reviewedNoPublicImage),'','## 다음 조치','','1. 위 목록의 화가 연표에서 작품의 이미지 또는 제목을 보완한다.','2. 다시 전체 규칙 점검을 실행한다.','3. 이 보고서 파일을 다음 작업 세션에 전달하거나, “가장 최근 규칙점검 보고서 확인”이라고 요청한다.',''].join('\\n');
  text=text.replace('- 미술사조 HTML 이미지 파일 누락 및 Git 비관리 이미지 폴더 직접 참조 점검\\n- 기법·대표작·주제-사건 표시 데이터의 외부 URL, 캐시 폴더 직접 참조, 이미지 파일 누락 점검','- 미술사조 HTML 이미지 파일 누락 및 Git 비관리 이미지 폴더 직접 참조 점검\\n- 미술사조 선구자 공통 문구의 index.json 기준 매핑 및 정적 문구 불일치 점검\\n- 기법·대표작·주제-사건 표시 데이터의 외부 URL, 캐시 폴더 직접 참조, 이미지 파일 누락 점검');
  text=text.replace('- 화가 목록 국가 아이콘의 국가명 title·aria-label 연결 및 한국어 국가명 점검\\n- 기법 설명 오른쪽 페이지 제목 옆 + 자료 버튼 및 비교 기법 저장 경로 점검','- 화가 목록 국가 아이콘의 국가명 title·aria-label 연결 및 한국어 국가명 점검\\n- 화가 목록 사조 드롭다운 중복, 대표 사조 누락, 작품별 사조 오매칭 방지 점검\\n- 사조 설명 문서의 하부 사조 변경 기준이 화가 목록, 화가 연표, 사조 설명 이미지 카드의 화가 사조 표시와 동기화되는지 점검\\n- 기법 설명 오른쪽 페이지 제목 옆 + 자료 버튼 및 비교 기법 저장 경로 점검');
  text=text.replace(/(### uHangul 폰트·런타임·화가 맵·변환 표식 확인 항목 \(\d+점\))/,
    `### 화가 목록 사조 필터 확인 항목 (${result.issues.artistMovementFilter.length}점)\\n\\n${rows(result.issues.artistMovementFilter)}\\n\\n### 사조 분류 동기화 확인 항목 (${result.issues.movementClassificationSync.length}점)\\n\\n${rows(result.issues.movementClassificationSync)}\\n\\n$1`);
  text=text.replace(/(### 표시 데이터 이미지 경로 확인 항목 \(\d+점\))/,
    `### 미술사조 선구자 공통 문구 확인 항목 (${result.issues.movementPioneerContext.length}점)\\n\\n${rows(result.issues.movementPioneerContext)}\\n\\n$1`);
  text=text.replace('- 썸네일 제목의 소장처 정보 혼입 점검\\n- 화가별 로컬 썸네일·고해상도 이미지의 파일 내용 중복 점검',
    '- 썸네일 제목의 소장처 정보 혼입 점검\\n- 로컬 이미지 10MB 초과 파일 점검\\n- 화가별 로컬 썸네일·고해상도 이미지의 파일 내용 중복 점검');
  text=text.replace(/(### 같은 이미지 파일 내용이 반복 연결된 작품 \(\d+건\))/,
    `### 10MB 초과 로컬 이미지 파일 (${result.issues.oversizedLocalImage.length}건)\\n\\n${rows(result.issues.oversizedLocalImage)}\\n\\n$1`);
  await fs.mkdir(reportFolder,{recursive:true});
  await fs.writeFile(reportFile,text,'utf8');
  return path.relative(root,reportFile).replace(/\\/g,'/');
}
async function checkAndApplyLatestRules(actor='') {
  const payload=await readArtistsFile();
  const before=JSON.stringify(payload.artists || []);
  const normalizedPayload=normalizeArtistsPayload(payload,{actor,touch:false});
  await resolveHighResolutionPaths(normalizedPayload);
  const after=JSON.stringify(normalizedPayload.artists || []);
  const artists=normalizedPayload.artists || [];
  const works=artists.flatMap(artist=>artist.works || []);
  const uHangulIssues=await uHangulRuleIssues(artists);
  const countryIconIssues=await artistCountryIconIssues(artists);
  const artistMovementFilterIssuesList=await artistMovementFilterIssues(artists);
  const movementClassificationSyncIssuesList=await movementClassificationSyncIssues();
  const techniqueTitleLinkButtonIssuesList=await techniqueTitleLinkButtonIssues();
  const movementDocumentImageIssuesList=await movementDocumentImageIssues();
  const movementPioneerContextIssuesList=await movementPioneerContextIssues();
  const displayDataImageIssuesList=await displayDataImageIssues();
  const oversizedLocalImageIssuesList=await oversizedLocalImageIssues();
  const duplicateArtworkImageIssuesList=await duplicateArtworkImageIssues(artists);
  const artistDutchVanRomanizationIssues=dutchVanRomanizationIssues(artists);
  const issues={
    missingPreview:artists.flatMap(artist=>(artist.works || []).filter(work=>!work.thumbnail && !work.image).map(work=>ruleCheckItem(artist,work))),
    missingTitle:artists.flatMap(artist=>(artist.works || []).filter(work=>!work.title?.ko && !work.title?.en).map(work=>ruleCheckItem(artist,work))),
    qidTitle:artists.flatMap(artist=>(artist.works || []).filter(qidLikeTitle).map(work=>ruleCheckItem(artist,work))),
    artistDisplayKorean:artists.filter(artist=>!hasHangul(actualArtistDisplayNameForCheck(artist)) || hasLatin(actualArtistDisplayNameForCheck(artist))).map(artist=>artistRuleItem(artist,`목록/연표 표시명 확인: ${actualArtistDisplayNameForCheck(artist) || '(없음)'}`)),
    artistDisplayOrder:artists.filter(artist=>actualArtistDisplayNameForCheck(artist) !== expectedArtistDisplayNameForCheck(artist)).map(artist=>artistRuleItem(artist,`성, 이름 표시 확인: ${actualArtistDisplayNameForCheck(artist)} → ${expectedArtistDisplayNameForCheck(artist)}`)),
    artistDutchVanRomanization:artistDutchVanRomanizationIssues,
    artistCountryIcon:countryIconIssues,
    artistMovementFilter:artistMovementFilterIssuesList,
    movementClassificationSync:movementClassificationSyncIssuesList,
    uHangulConnection:uHangulIssues,
    techniqueTitleLinkButton:techniqueTitleLinkButtonIssuesList,
    movementDocumentImage:movementDocumentImageIssuesList,
    movementPioneerContext:movementPioneerContextIssuesList,
    displayDataImage:displayDataImageIssuesList,
    oversizedLocalImage:oversizedLocalImageIssuesList,
    thumbnailTitleExtra:thumbnailTitleExtraItems(artists),
    duplicateArtworkImage:duplicateArtworkImageIssuesList,
    reviewedNoPublicImage:artists.flatMap(artist=>(artist.works || []).filter(work=>work.thumbnailInvalidReason === 'no-public-image-source').map(work=>ruleCheckItem(artist,work)))
  };
  const missingPreview=issues.missingPreview.length;
  const missingTitle=issues.missingTitle.length;
  const qidTitle=issues.qidTitle.length;
  const artistDisplayKorean=issues.artistDisplayKorean.length;
  const artistDisplayOrder=issues.artistDisplayOrder.length;
  const artistDutchVanRomanization=issues.artistDutchVanRomanization.length;
  const artistCountryIcon=issues.artistCountryIcon.length;
  const artistMovementFilter=issues.artistMovementFilter.length;
  const movementClassificationSync=issues.movementClassificationSync.length;
  const uHangulConnection=issues.uHangulConnection.length;
  const techniqueTitleLinkButton=issues.techniqueTitleLinkButton.length;
  const movementDocumentImage=issues.movementDocumentImage.length;
  const movementPioneerContext=issues.movementPioneerContext.length;
  const displayDataImage=issues.displayDataImage.length;
  const oversizedLocalImage=issues.oversizedLocalImage.length;
  const thumbnailTitleExtra=issues.thumbnailTitleExtra.length;
  const duplicateArtworkImage=issues.duplicateArtworkImage.length;
  let revision=Number(payload.metadata?.revision) || 0;
  const changed=before !== after;
  if (changed) {
    const saved=await writeArtistsFile(normalizedPayload,actor);
    revision=saved.revision;
  } else {
    writeUHangulArtistMap(artists);
    syncPersonNameDictionary({artists});
    await appendAudit({type:'rules.check-and-apply',actor:normalizedEmail(actor) || 'local-admin',revision,changed:false,stats:{artists:artists.length,works:works.length,missingPreview,missingTitle,qidTitle,artistDisplayKorean,artistDisplayOrder,artistDutchVanRomanization,artistCountryIcon,artistMovementFilter,movementClassificationSync,uHangulConnection,techniqueTitleLinkButton,movementDocumentImage,movementPioneerContext,displayDataImage,oversizedLocalImage,thumbnailTitleExtra,duplicateArtworkImage}});
  }
  const nameDictionary=syncPersonNameDictionary({artists}).records;
  const result={ok:true,changed,revision,stats:{artists:artists.length,works:works.length,missingPreview,missingTitle,qidTitle,artistDisplayKorean,artistDisplayOrder,artistDutchVanRomanization,artistCountryIcon,artistMovementFilter,movementClassificationSync,uHangulConnection,techniqueTitleLinkButton,movementDocumentImage,movementPioneerContext,displayDataImage,oversizedLocalImage,thumbnailTitleExtra,duplicateArtworkImage,reviewedNoPublicImage:issues.reviewedNoPublicImage.length,nameDictionary,movementDocuments:'dynamic-linking'},issues};
  result.reportFile=await writeRuleCheckReport(result);
  return result;
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
  const directNames=[...new Set(Object.values(uploadTypes))].flatMap(ext => [`${safeWorkId}.${ext}`,`${safeWorkId}.display.jpg`,`${safeWorkId}.display.png`]);
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
function safePath(urlPath) { const name=urlPath==='/'?'index.html':decodeURIComponent(urlPath).replace(/^\/+/, ''); if(name.startsWith('.') || ['server.js','data/access-control.json'].includes(name) || name.startsWith('data/backups/') || name.startsWith('data/audit') || name.startsWith('.git/')) return null; const output=path.resolve(root,name), relative=path.relative(root,output); return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? output : (name==='index.html' ? output : null); }
function techniqueLinks(value) {
  if (!Array.isArray(value) || value.length > 40) throw new Error('Invalid technique links');
  return value.map(link => {
    const raw=String(link?.url || link || '').trim(), parsed=new URL(raw);
    if (!['http:','https:'].includes(parsed.protocol)) throw new Error('Technique links must use HTTP or HTTPS');
    return {url:parsed.href};
  });
}
const comparisonTechniqueIds = new Set(['disegno-colorito','fresco-oil','tempera-oil','chiaroscuro-sfumato','linear-aerial-perspective','glazing-impasto']);
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
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function escapeAttribute(value) { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function normalizeMovementImageReference(value='') {
  const text=htmlDecode(String(value || '').trim()).replace(/\\/g,'/');
  if(!text || /^data:/i.test(text)) return text;
  try {
    const parsed=/^[a-z][a-z0-9+.-]*:/i.test(text)
      ? new URL(text)
      : new URL(text,'http://art-atlas.local/data/미술사조/document.html');
    if(parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      parsed.hash='';
      parsed.search='';
      return parsed.hostname === 'art-atlas.local'
        ? decodeURIComponent(parsed.pathname.replace(/^\/+/,''))
        : decodeURIComponent(parsed.href);
    }
  } catch (_) {}
  return text.replace(/[?#].*$/,'').replace(/^\.\//,'');
}
function movementHighResolutionSearchText(...values) {
  return values.map(value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/&[^;\s]+;/g,' ').replace(/[^0-9a-z가-힣]+/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean).join(' ');
}
async function movementHighResolutionEntries() {
  const payload=await readArtistsFile();
  const entries=[];
  for (const artist of payload.artists || []) {
    for (const work of artist.works || []) {
      const highRes=work.highResOriginal || work.highResImage || '';
      if(!highRes || !await highResolutionPathExists(highRes)) continue;
      const titleValues=[work.title?.ko,work.title?.en,work.title?.original,work.title?.native,work.title?.originalTitle,work.title?.nativeTitle,work.title?.sourceTitle].filter(Boolean);
      const artistValues=[artist.fullName,artist.name?.ko,artist.name?.en].filter(Boolean);
      const refs=[work.thumbnail,work.image,work.highResImage,work.highResOriginal].map(normalizeMovementImageReference).filter(Boolean);
      const artistKeys=artistValues.flatMap(value => {
        const full=movementHighResolutionSearchText(value);
        return [full,...full.split(' ').filter(part=>part.length >= 2)];
      }).filter(Boolean);
      entries.push({
        highRes:`/${highRes.replace(/\\/g,'/')}`,
        title:titleValues[0] || titleValues[1] || '',
        artist:artistValues[0] || artistValues[1] || '',
        refs,
        titleKeys:titleValues.map(value=>movementHighResolutionSearchText(value)).filter(value=>value.length >= 3),
        artistKeys:[...new Set(artistKeys)]
      });
    }
  }
  return entries;
}
function movementHighResolutionEntryForImage(tag, entries) {
  const attrs=tagAttrs(tag);
  const src=normalizeMovementImageReference(attrs.src || '');
  const direct=src && entries.find(entry => entry.refs.includes(src));
  if(direct) return direct;
  const alt=movementHighResolutionSearchText(attrs.alt, attrs.title, attrs['aria-label']);
  if(!alt) return null;
  return entries.find(entry => {
    const titleMatch=entry.titleKeys.some(key => alt.includes(key) || (key.length >= 8 && key.includes(alt)));
    const artistMatch=entry.artistKeys.some(key => alt.includes(key));
    return titleMatch && artistMatch;
  }) || null;
}
const movementHighResolutionViewer = `<style id="art-atlas-movement-highres-style">img[data-art-atlas-highres]{cursor:zoom-in}</style><script id="art-atlas-movement-highres-viewer">(function(){if(window.__artAtlasMovementHighresViewer)return;window.__artAtlasMovementHighresViewer=true;function esc(text){return String(text||'').replace(/[&<>]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[ch];});}function openViewer(src,title){var popup=window.open('','artAtlasMovementHighResolution','popup=yes,width=1180,height=860,noopener');if(!popup)return;var payload=JSON.stringify({src:new URL(src,location.href).href,title:title||''});popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title||'High-resolution image')+'</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#10120f;color:#f7f4ec;font-family:system-ui,sans-serif}#toolbar{height:42px;box-sizing:border-box;display:flex;align-items:center;padding:0 16px;background:#242820;font-size:12px;color:#c8cdc2}#stage{height:calc(100% - 42px);position:relative;overflow:hidden;touch-action:none;cursor:grab;user-select:none}#stage.dragging{cursor:grabbing}#artwork{position:absolute;top:50%;left:50%;max-width:none;max-height:none;transform:translate(-50%,-50%);pointer-events:none;user-select:none}</style></head><body><div id="toolbar">왼쪽 버튼을 누른 채 드래그: 이동 · 휠 위로: 확대 · 휠 아래로: 축소</div><div id="stage"><img id="artwork" alt=""></div><script>const payload='+payload+',stage=document.querySelector("#stage"),image=document.querySelector("#artwork");document.title=payload.title||"High-resolution image";image.src=payload.src;image.alt=payload.title||"";let zoom=1,x=0,y=0,drag=null;const clamp=()=>{const maxX=Math.max(0,(image.offsetWidth-stage.clientWidth)/2),maxY=Math.max(0,(image.offsetHeight-stage.clientHeight)/2);x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));};const draw=()=>{if(!image.naturalWidth)return;const base=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight);image.style.width=Math.max(1,image.naturalWidth*base*zoom)+"px";image.style.height=Math.max(1,image.naturalHeight*base*zoom)+"px";clamp();image.style.transform="translate(calc(-50% + "+x+"px), calc(-50% + "+y+"px))";};image.addEventListener("load",draw);window.addEventListener("resize",draw);stage.addEventListener("pointerdown",event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:x,startY:y};stage.setPointerCapture(event.pointerId);stage.classList.add("dragging");});stage.addEventListener("pointermove",event=>{if(!drag||event.pointerId!==drag.id)return;x=drag.startX+event.clientX-drag.x;y=drag.startY+event.clientY-drag.y;draw();});const stop=event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;stage.classList.remove("dragging");};stage.addEventListener("pointerup",stop);stage.addEventListener("pointercancel",stop);stage.addEventListener("wheel",event=>{event.preventDefault();const oldZoom=zoom,ratio=event.deltaY<0?1.1:1/1.1;zoom=Math.max(.5,Math.min(6,zoom*ratio));const actualRatio=zoom/oldZoom,rect=stage.getBoundingClientRect(),pointX=event.clientX-rect.left-stage.clientWidth/2,pointY=event.clientY-rect.top-stage.clientHeight/2;x=x*actualRatio+pointX*(1-actualRatio);y=y*actualRatio+pointY*(1-actualRatio);draw();},{passive:false});<\\/script></body></html>');popup.document.close();}document.addEventListener('dblclick',function(event){var image=event.target&&event.target.closest&&event.target.closest('img[data-art-atlas-highres]');if(!image)return;event.preventDefault();event.stopPropagation();openViewer(image.dataset.artAtlasHighres,image.dataset.artAtlasHighresTitle||image.getAttribute('alt')||document.title||'');},true);})();</script>`;
async function injectMovementHighResolutionViewer(html) {
  let source=String(html || '');
  if(/id=["']art-atlas-movement-highres-viewer["']/i.test(source)) return source;
  const entries=await movementHighResolutionEntries();
  if(!entries.length) return source;
  let matched=false;
  source=source.replace(/<img\b[^>]*>/gi,tag=>{
    if(/\bdata-art-atlas-highres=/i.test(tag)) return tag;
    const entry=movementHighResolutionEntryForImage(tag,entries);
    if(!entry) return tag;
    matched=true;
    return tag.replace(/\s*\/?>$/,match=>` data-art-atlas-highres="${escapeAttribute(entry.highRes)}" data-art-atlas-highres-title="${escapeAttribute([entry.artist,entry.title].filter(Boolean).join(' · '))}"${match}`);
  });
  if(!matched) return source;
  return /<\/body>/i.test(source) ? source.replace(/<\/body>/i,`${movementHighResolutionViewer}\n</body>`) : `${source}\n${movementHighResolutionViewer}`;
}
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
  const aliases=[artist?.fullName,artist?.name?.ko,artist?.name?.en,...recordAliases,...movementArtistAliasOverrides(artist)];
  return [...new Set(aliases.map(compactArtistName).filter(name=>name.length >= 2))];
}
async function movementArtistLinkEntries() {
  const data=await readArtistsFile();
  const entries=[];
  for(const artist of data.artists || []) {
    for(const alias of movementArtistAliases(artist)) entries.push({alias,id:artist.id,name:artist.fullName || artist.name?.ko || artist.name?.en || alias,korean:artist.fullName || artist.name?.ko || '',original:artist.name?.en || ''});
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
  const source=stripMovementArtworkMovementLabels(html);
  const data=await readArtistsFile();
  const artists=data.artists || [];
  if(!artists.length) return source;
  const aliasEntries=(await movementArtistLinkEntries()).sort((a,b)=>b.alias.length-a.alias.length);
  let changed=false;
  const output=source.replace(/<article\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-card|card)\b[^"']*["'])[\s\S]*?<\/article>/gi,card=>{
    const artist=movementCardArtist(card,artists,aliasEntries);
    const movement=artist && serverArtistMovementDisplayLabel(artist);
    if(!movement) return card;
    const next=injectMovementLabelIntoCard(card,movement,artist);
    if(next !== card) changed=true;
    return next;
  });
  if(!changed) return source;
  const style='<style id="art-atlas-work-movement-style">.art-atlas-work-movement{margin:.48rem 0 .12rem!important;color:#f0cf87!important;font:800 .82rem/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif!important}.art-atlas-work-movement strong{display:inline-block;margin-right:.45rem;padding:.16rem .5rem;border:1px solid rgba(240,207,135,.42)!important;border-radius:999px;background:rgba(216,170,75,.12)!important;color:#ffe4a6!important;font-size:.76rem!important}</style>';
  return /<\/head>/i.test(output) ? output.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${output}`;
}
const movementArtistLinkStyle = `.art-atlas-artist-link{font-weight:900;color:#191007!important;background:linear-gradient(180deg,rgba(255,232,151,.98),rgba(255,198,86,.9));border-bottom:2px solid #a96f12;border-radius:.22em;padding:0 .16em;text-decoration:none!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}.art-atlas-artist-link:hover{filter:brightness(1.08);box-shadow:0 0 0 2px rgba(255,214,102,.24)}`;
const uHangulDocumentIntegration = `<link rel="stylesheet" href="../../uhangul/uhangul-runtime.css" data-uhangul-integration="v0.4">\n<script defer src="../../uhangul/uhangul-runtime.js" data-uhangul-integration="v0.4"></script>`;
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
async function movementDocumentPioneerContextKey(relativeFile) {
  const normalized=String(relativeFile || '').replace(/\\/g,'/');
  const index=await fs.readFile(path.join(movementDocumentDir,'index.json'),'utf8').then(JSON.parse).catch(()=>null);
  for(const [documentName,slots] of Object.entries(index?.documents || {})) {
    for(const documentPath of Object.values(slots || {})) {
      if(String(documentPath || '').replace(/\\/g,'/') === normalized) return movementPioneerDocumentContextByName[documentName] || '';
    }
  }
  return '';
}
function movementPioneerContextForTitle(title) {
  const cleaned=String(title || '').replace(/<[^>]+>/g,'').trim();
  const primary=cleaned.split(/\s+[—–-]\s+/)[0]?.trim() || cleaned;
  for(const scope of [primary, cleaned]) {
    const context=[...Object.entries(movementPioneerContexts)]
      .map(([name,body])=>({name,body,index:scope.indexOf(name)}))
      .filter(item=>item.index >= 0)
      .sort((left,right)=>left.index-right.index || right.name.length-left.name.length)
      [0]?.body;
    if(context) return context;
  }
  return '';
}
function injectMovementPioneerContext(html, explicitContextKey='') {
  const source=String(html || '');
  if (/data-art-atlas-pioneer-context/i.test(source)) return source;
  const title=(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g,'').trim();
  const context=movementPioneerContexts[explicitContextKey] || movementPioneerContextForTitle(title);
  if (!context) return source;
  const block=`<aside data-art-atlas-pioneer-context style="max-width:1060px;margin:1.1rem 0 0;padding:1rem 1.15rem;border-left:4px solid #d7a74a;border-radius:0 10px 10px 0;background:rgba(215,167,74,.09);color:#e5e9ed;font-size:1rem;line-height:1.72"><strong style="display:block;margin-bottom:.28rem;color:#efcb80;letter-spacing:.03em">선구자들의 문제의식과 돌파</strong>${context}</aside>`;
  return source.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i,`$1\n${block}`);
}
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
function movementDocumentNeedsSetup(buffer) {
  const html=Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  return !(/<link\b[^>]*data-uhangul-integration/i.test(html)
    && /<script\b[^>]*data-uhangul-integration/i.test(html)
    && /data-uhangul-corner-bar/i.test(html)
    && /data-uhangul-corner-button/i.test(html)
    && /id=["']art-atlas-artist-link-style["']/i.test(html));
}
async function ensureStoredMovementDocumentControls() {
  let entries=[];
  try { entries=await fs.readdir(movementDocumentDir,{withFileTypes:true}); } catch(error) { if(error.code==='ENOENT') return; throw error; }
  const linkEntries=await movementArtistLinkEntries();
  let changed=false;
  await Promise.all(entries.filter(entry=>entry.isFile() && /^[a-f0-9]{24}-[12]\.html$/i.test(entry.name)).map(async entry=>{
    const file=path.join(movementDocumentDir,entry.name);
    const before=await fs.readFile(file);
    if (!movementDocumentNeedsSetup(before)) return;
    const after=await linkMovementDocumentArtists(injectUHangulDocumentIntegration(before), linkEntries);
    if(!before.equals(after)) { await fs.writeFile(file,after); changed=true; }
  }));
  if (changed) syncPersonNameDictionary();
}
const storedMovementDocumentControlsReady=ensureStoredMovementDocumentControls().catch(error=>console.error('Could not add uHangul controls to movement documents:',error.message));
function uploadExtension(file) { const ext=path.extname(String(file?.filename || '')).toLowerCase(); return uploadTypes[file?.contentType] || ({'.jpg':'jpg','.jpeg':'jpg','.jfif':'jpg','.png':'png','.webp':'webp','.gif':'gif'}[ext]); }
async function makeDisplayImage(input, folder, fileBase) {
  // Very large originals can exceed a browser's decoded-image or GPU texture
  // limit. Create a PNG display master under 10 MB; the uploaded original is discarded.
  return makePngUnderStorageLimit(input,folder,`${fileBase}.display`,[8000,6000,4800,3600,3000,2400,2000,1600,1200,1000,800,640]);
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
    if((await fs.stat(display)).size>highResolutionStoredLimit) throw new Error('Could not create a display image smaller than 10 MB');
    const thumbnail=await makeLocalArtworkThumbnail(display,artist,work);
    await fs.mkdir(location.folder,{recursive:true});
    await removeHighResolutionFiles(location.folder,workId);
    await fs.rename(display,path.join(location.folder,`${fileBase}.display.png`));
    const image=`${location.relativePrefix}/${fileBase}.display.png`;
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
    if((await fs.stat(display)).size>highResolutionStoredLimit) throw new Error('10MB 이하의 표시용 이미지를 만들 수 없습니다');
    const relative=`data/topic-images/${id}.display.png`;
    await fs.rename(display,path.join(topicImageDir,`${id}.display.png`));
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
    if((await fs.stat(display)).size>highResolutionStoredLimit) throw new Error('10MB 이하의 표시용 이미지를 만들 수 없습니다');
    const relative=`data/topic-images/${imageId}.display.png`, previous=String(work.thumbnail || '');
    await fs.rename(display,path.join(topicImageDir,`${imageId}.display.png`));
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
  if(/^data\/topic-images\/[A-Za-z0-9_-]+(?:\.display)?\.(?:jpe?g|png)$/.test(thumbnail)) await fs.unlink(path.join(root,thumbnail)).catch(()=>{});
  return {topics:data.topics};
}
const movementSectionLinkIds = new Set(['gothic-light-structure']);
function normalizedMovementSectionLinks(value) {
  const links = Array.isArray(value) ? value : [];
  return links.slice(0,40).flatMap(item => {
    try {
      const url = new URL(String(item?.url || item || '').trim());
      return ['http:','https:'].includes(url.protocol) ? [{url:url.href}] : [];
    } catch (_) { return []; }
  });
}
async function readMovementSectionLinks() {
  try {
    const data=JSON.parse(await fs.readFile(movementSectionLinksFile,'utf8'));
    const sections=data && typeof data.sections==='object' ? data.sections : {};
    return {schema:1,sections:Object.fromEntries(Object.entries(sections).filter(([id])=>movementSectionLinkIds.has(id)).map(([id,links])=>[id,normalizedMovementSectionLinks(links)]))};
  } catch(error) {
    if(error.code==='ENOENT') return {schema:1,sections:{}};
    throw error;
  }
}
async function saveMovementSectionLinks(sectionId, links) {
  if(!movementSectionLinkIds.has(sectionId)) throw new Error('Unknown movement document section');
  const data=await readMovementSectionLinks();
  data.sections[sectionId]=normalizedMovementSectionLinks(links);
  await fs.writeFile(movementSectionLinksFile,JSON.stringify(data,null,2)+'\n','utf8');
  return data;
}
http.createServer(async (req,res) => { const url=new URL(req.url,`http://${req.headers.host}`); res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization'); if(req.method==='OPTIONS') { res.writeHead(204); return res.end(); } if (!enforceJsonRequestLimit(req,res,url.pathname)) return;
  if (req.method==='GET' && url.pathname==='/api/access') { res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({adminConfigured:Boolean(adminPasswordHash)})); }
  if (req.method==='POST' && url.pathname==='/api/auth/login') { let body=''; req.on('data',chunk=>body+=chunk); req.on('end',async()=>{ try { await accessControlReady; if (!adminPasswordHash) throw new Error('관리자 설정 파일이 없어 보기 전용으로 실행 중입니다.'); const {email,password}=JSON.parse(body || '{}'), normalized=normalizedEmail(email); if (!isAdminEmail(normalized) || !samePassword(password)) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.'); activeAdminSession(); clearAdminSessions(normalized); const token=createAdminSession(normalized); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,email:normalized,role:'admin',token})); } catch(error) { res.writeHead(401,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  const session=adminSession(req);
  if (req.method==='POST' && url.pathname==='/api/auth/heartbeat') { if (!session) return sendAdminRequired(res); res.writeHead(204,{'Cache-Control':'no-store'}); return res.end(); }
  if (req.method==='POST' && url.pathname==='/api/auth/logout') { if (session) { const token=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1]; if (token) adminSessions.delete(token); } res.writeHead(204,{'Cache-Control':'no-store'}); res.end(); setTimeout(()=>process.exit(0),200); return; }
  if (requiresAdmin(req,url.pathname) && !session) return sendAdminRequired(res);
  if (req.method==='GET' && url.pathname==='/api/movement-section-links') { try { const data=await readMovementSectionLinks(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({schema:1,sections:{},error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/movement-section-links') { let body=''; req.on('data',chunk=>body+=chunk); req.on('end',async()=>{ try { const payload=JSON.parse(body || '{}'), data=await saveMovementSectionLinks(String(payload.sectionId || ''),payload.links); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,sections:data.sections})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='GET' && url.pathname==='/api/movement-documents') { try { const data=await readMovementDocuments(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({documents:{},error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/movement-documents/refresh') { let body=''; req.on('data',chunk=>body+=chunk); req.on('end',async()=>{ try { const payload=JSON.parse(body || '{}'), name=movementDocumentName(payload.name), slot=movementDocumentSlot(payload.slot), result=await refreshMovementDocumentLinks(name,slot); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/movement-documents') { try { const form=multipartForm(await readRequestBuffer(req,30*1024*1024),req.headers['content-type']), name=movementDocumentName(form.fields.name), slot=movementDocumentSlot(form.fields.slot), file=form.files.document, ext=path.extname(String(file?.filename || '')).toLowerCase(); if(!file || !['.html','.htm'].includes(ext) || !/^(text\/html|application\/xhtml\+xml|)$/.test(file.contentType)) throw new Error('Upload an HTML file'); if(!file.data.length) throw new Error('The HTML file is empty'); const data=await readMovementDocuments(), relative=movementDocumentRelative(name,slot), previous=data.documents?.[name]?.[slot], linkedHtml=await linkMovementDocumentArtists(injectUHangulDocumentIntegration(file.data)); await fs.mkdir(movementDocumentDir,{recursive:true}); const savedFile=path.join(root,relative); await fs.writeFile(savedFile,linkedHtml); if(previous && previous!==relative) await removeMovementDocument(previous); data.documents[name]={...(data.documents[name]||{}),[slot]:relative}; await writeMovementDocuments(data); syncPersonNameDictionary({additionalFiles:[savedFile]}); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,url:relative})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='DELETE' && url.pathname==='/api/movement-documents') { let body=''; req.on('data',chunk=>body+=chunk); req.on('end',async()=>{ try { const {name,slot}=JSON.parse(body), safeName=movementDocumentName(name), safeSlot=movementDocumentSlot(slot), data=await readMovementDocuments(), relative=data.documents?.[safeName]?.[safeSlot]; if(relative) await removeMovementDocument(relative); if(data.documents?.[safeName]) { delete data.documents[safeName][safeSlot]; if(!Object.keys(data.documents[safeName]).length) delete data.documents[safeName]; } await writeMovementDocuments(data); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ok:true})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/local-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveLocalArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artworks') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveTopicArtwork(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await replaceTopicArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='DELETE' && url.pathname==='/api/topic-artwork') { try { const body=JSON.parse((await readRequestBuffer(req,1024*1024)).toString('utf8') || '{}'), result=await deleteTopicArtwork(body); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/artists') { try { const data=await readArtistsFile(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artists:[],error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/techniques') { try { const data=JSON.parse(await fs.readFile(techniquesFile,'utf8')); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({techniques:[],error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/techniques') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {id,links}=JSON.parse(body || '{}'), techniqueId=String(id || ''), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=techniques.find(item=>item.id===techniqueId), nextLinks=techniqueLinks(links); if(target) target.links=nextLinks; else { if(!comparisonTechniqueIds.has(techniqueId)) throw new Error('Technique not found'); data.comparisonLinks=data.comparisonLinks && typeof data.comparisonLinks==='object' && !Array.isArray(data.comparisonLinks) ? data.comparisonLinks : {}; data.comparisonLinks[techniqueId]=nextLinks; } await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,technique:target || {id:techniqueId,links:nextLinks,comparison:true}})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='DELETE' && url.pathname==='/api/techniques') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {id}=JSON.parse(body || '{}'), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=String(id || ''); if(!target) throw new Error('Technique not found'); if(techniques.some(item=>item.id===target)) { data.techniques=techniques.filter(item=>item.id!==target); } else { if(!comparisonTechniqueIds.has(target)) throw new Error('Technique not found'); const hidden=new Set(Array.isArray(data.hiddenComparisonIds) ? data.hiddenComparisonIds : []); hidden.add(target); data.hiddenComparisonIds=[...hidden].sort(); if(data.comparisonLinks && typeof data.comparisonLinks==='object' && !Array.isArray(data.comparisonLinks)) delete data.comparisonLinks[target]; } await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,techniques:data.techniques,comparisonLinks:data.comparisonLinks || {},hiddenComparisonIds:data.hiddenComparisonIds || []})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if ((req.method==='PUT' || req.method==='POST') && url.pathname==='/api/artists') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const payload=JSON.parse(body), saved=await writeArtistsFile(payload,session.email); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,...saved})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/rules/check-and-apply') { try { const result=await checkAndApplyLatestRules(session.email); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/migration-export') { try { const result=await migrationExport(), stamp=new Date().toISOString().slice(0,10); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="art-through-time-firebase-${stamp}.json"`,'Cache-Control':'no-store'}); return res.end(JSON.stringify(result.export,null,2)); } catch(error) { res.writeHead(403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/normalize-artist-works') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const result=await normalizeArtistWorks(JSON.parse(body).artist); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } }); return; }
  if (req.method==='GET' && url.pathname==='/api/artist-profile') { try { const qid=url.searchParams.get('qid'); if(!/^Q\d+$/.test(qid || '')) throw new Error('Invalid artist'); const artistEntity=(await getEntities([qid]))[qid]; const nationalityQid=entityId(artistEntity,'P27'); const nationalityEntity=nationalityQid ? (await getEntities([nationalityQid]))[nationalityQid] : null; res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({name:{ko:koreanArtistNameOverrides[qid] || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')}})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/artwork-info') { let body=''; req.on('data',c=>body+=c); req.on('end',async()=>{ try { const {artist,work}=JSON.parse(body); const result=await artworkInfo(artist,work); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({work:result})); } catch(error) { res.writeHead(502,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } }); return; }
  if (req.method==='POST' && url.pathname==='/api/local-thumbnail-image') { try { const form=multipartForm(await readRequestBuffer(req,sourceImageInputLimit + 1024*1024),req.headers['content-type']), artist=JSON.parse(form.fields.artist || '{}'), work=JSON.parse(form.fields.work || '{}'); if(!artist?.id || !work?.id) throw new Error('Invalid artwork upload'); const thumbnail=await saveThumbnailFromLocalUpload(artist,work,form.files.image,adminEmail); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail,verified:true})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail:'',verified:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/search') { try { const query=url.searchParams.get('q')||'', kind=url.searchParams.get('type')||'artist'; const raw=kind==='artist' ? await artistSearchCandidates(query) : (await getJsonFast(api({action:'wbsearchentities',search:query,language:'ko',uselang:'ko',type:'item',limit:'20'}))).search?.map(item=>({id:item.id,label:item.label,description:item.description||''})) || []; const ranked=[...raw].sort((a,b)=>{const score=item=>similarityScore(query,item.label)+(kind==='artwork' ? /(회화|그림|painting|artwork|work of art)/i.test(item.description)?120:0 : /(화가|예술가|painter|visual artist|artist)/i.test(item.description)?120:0); return score(b)-score(a);}); const values=ranked.slice(0,8); res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify(values)); } catch(error) { res.writeHead(502,{'Content-Type':'application/json'}); return res.end(JSON.stringify([])); } }
  const file=safePath(url.pathname);if(!file){res.writeHead(403);return res.end();}try{let data=await fs.readFile(file);const relativeFile=path.relative(root,file).replace(/\\/g,'/');if(/^data[\\/]미술사조[\\/][a-f0-9]{24}-[12]\.html$/i.test(path.relative(root,file))) { let html=(await linkMovementDocumentArtists(data)).toString('utf8'); html=await injectMovementArtworkMovementLabels(html); html=injectMovementPioneerContext(html,await movementDocumentPioneerContextKey(relativeFile)); html=injectUHangulDocumentIntegration(html); html=injectMovementWikipediaHeading(html,url.searchParams.get('movementWiki') || '',url.searchParams.get('movementLabel') || ''); html=await injectMovementHighResolutionViewer(html); data=Buffer.from(html,'utf8'); }res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch(error){console.error('Static file error:',error?.stack || error?.message || error);res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log(`Art Atlas: http://localhost:4173${adminPasswordHash ? '' : ' (read-only: .env not found)'}`));
