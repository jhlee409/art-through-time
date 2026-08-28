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
const { recordArtistRelationImpactAudit } = require('./tools/artist-relation-impact-audit');
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
const adminSessionIdleMs = 10 * 60 * 1000;
const jsonRequestBodyLimit = 12 * 1024 * 1024;
let accessControl = {schema:1,defaultRole:'viewer',roles:{[adminEmail]:'admin'}};
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.jfif':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2'};
const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.ART_ATLAS_FFMPEG || (fsSync.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg');
const artistImportedWorkLimit = 60;
const highResolutionStoredLimit = 10 * 1024 * 1024;
const sourceImageInputLimit = 500 * 1024 * 1024;
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
  if (pathname === '/api/movement-documents') return ['DELETE','PUT'].includes(req.method);
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
const createArtistDataService = require('./server-data');
const artistData = createArtistDataService({https,fs,path,URL,createHash,randomBytes,execFileAsync,ffmpegPath,root,dataDir,highResolutionDir,imageStagingDir,artistsFile,backupsDir,auditLogFile,adminEmail,artistImportedWorkLimit,highResolutionStoredLimit,sourceImageInputLimit,normalizeArtistsPayload,validateArtistsPayload,invalidArtworkThumbnail,buildArtistMap,writeUHangulArtistMap,syncPersonNameDictionary,recordArtistRelationImpactAudit});
const { artistSearchCandidates, normalizeArtistWorks, artworkInfo, getJsonFast, api, similarityScore, getEntities, entityId, entityYear, entityLabel, koreanArtistNameOverrides, saveThumbnailBuffer, saveThumbnailFromLocalUpload, readArtistsFile, readArtistsIndex, readArtistDetail, writeArtistsFile } = artistData;
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
  const appText=await readAppSourceText();
  if(appText && !/title="\$\{esc\(countryLabel\)\}"/.test(appText)) issues.push({artist:'화가 목록',artistId:'artist-country-icon-title',work:'국가 아이콘 title에 국가명이 연결되지 않음',workId:'app-artists.js'});
  if(appText && !/aria-label="\$\{esc\(countryLabel\)\}"/.test(appText)) issues.push({artist:'화가 목록',artistId:'artist-country-icon-aria-label',work:'국가 아이콘 aria-label에 국가명이 연결되지 않음',workId:'app-artists.js'});
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
function hasLocalArtworkPreviewForCheck(work) {
  return Boolean(localImageFileForDuplicateCheck(work?.thumbnail) || localImageFileForDuplicateCheck(work?.highResImage));
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
  const appText=await readAppSourceText();
  if(appText && !/const artistMovement = loc\(artist\?\.movement\) \|\| loc\(artistMovementFallbacks\[artist\?\.qid\]\);[\s\S]*?if \(artistMovement\) return artistMovement;/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'artist-movement-primary',work:'목록 표시 대표 사조가 artist.movement를 우선하지 않음',workId:'app-core.js'});
  }
  if(appText && /\(artist\?\.works \|\| \[\]\)\.forEach\(work => entries\.push\(movementEntry\(work\?\.movement\)\)\)/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'artist-movement-work-tags',work:'사조 필터가 작품별 사조를 무조건 수집함',workId:'app-core.js'});
  }
  if(appText && !/self\.findIndex\(item => compactMovementName\(item\.label\) === compactMovementName\(option\.label\)\) === index/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'artist-movement-option-dedupe',work:'사조 드롭다운 라벨 중복 제거 확인 코드 누락',workId:'app-artists.js'});
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
const appSourceFiles=['app.js','app-core.js','app-artists.js','app-atlas.js','app-detail.js'];
async function readAppSourceText() {
  return (await Promise.all(appSourceFiles.map(file=>fs.readFile(path.join(root,file),'utf8').catch(()=>'')))).join('\n');
}
function movementOverrideIdsFromBlock(block='') {
  return new Set([...String(block || '').matchAll(/\b(Q\d+)\s*:/g)].map(match=>match[1]));
}
async function movementClassificationSyncIssues() {
  const issues=[];
  const appText=await readAppSourceText();
  const serverText=await fs.readFile(path.join(root,'server-content.js'),'utf8').catch(()=>'');
  const appRules=sourceBlock(appText,'const artistMovementDisplayRules = [','const artistMovementClassificationOverrides');
  const serverRules=sourceBlock(serverText,'const serverArtistMovementDisplayRules = [','const serverArtistMovementClassificationOverrides');
  const appLabels=movementRuleLabelsFromBlock(appRules);
  const serverLabels=new Set(movementRuleLabelsFromBlock(serverRules));
  if(!appRules) issues.push({artist:'사조 분류 기준',artistId:'movement-display-rules-app',work:'화가 목록·연표용 하부 사조 표시 규칙을 찾지 못함',workId:'app-core.js'});
  if(!serverRules) issues.push({artist:'사조 분류 기준',artistId:'movement-display-rules-server',work:'사조 설명 문서 카드용 하부 사조 표시 규칙을 찾지 못함',workId:'server-content.js'});
  for(const label of appLabels) {
    if(!serverLabels.has(label)) issues.push({artist:'사조 분류 기준',artistId:'movement-display-rule-sync',work:`화가 목록·연표에는 있으나 사조 설명 카드 표시 규칙에는 없는 하부 사조: ${label}`,workId:'app-core.js/server-content.js'});
  }
  const appOverrideBlock=sourceBlock(appText,'const artistMovementClassificationOverrides = {','function movementEntry');
  const serverOverrideBlock=sourceBlock(serverText,'const serverArtistMovementClassificationOverrides = {','const serverArtistMovementFallbacks');
  const appOverrideIds=movementOverrideIdsFromBlock(appOverrideBlock);
  const serverOverrideIds=movementOverrideIdsFromBlock(serverOverrideBlock);
  if(!appOverrideBlock) issues.push({artist:'사조 분류 기준',artistId:'movement-overrides-app',work:'화가 목록·연표용 화가별 하부 사조 override를 찾지 못함',workId:'app-core.js'});
  if(!serverOverrideBlock) issues.push({artist:'사조 분류 기준',artistId:'movement-overrides-server',work:'사조 설명 문서 카드용 화가별 하부 사조 override를 찾지 못함',workId:'server-content.js'});
  for(const qid of appOverrideIds) {
    if(!serverOverrideIds.has(qid)) issues.push({artist:'사조 분류 기준',artistId:'movement-overrides-sync',work:`화가 목록·연표 override에는 있으나 사조 설명 카드 override에는 없는 화가 QID: ${qid}`,workId:'app-core.js/server-content.js'});
  }
  if(serverText && !/injectMovementArtworkMovementLabels\(html\)/.test(serverText)) {
    issues.push({artist:'사조 설명 문서',artistId:'movement-document-artist-movement-labels',work:'사조 설명 문서 이미지 카드에 화가 사조를 주입하는 단계가 누락됨',workId:'server-content.js'});
  }
  if(appText && !/artistMovementDisplayInfo\(a\)\.parentLabel/.test(appText)) {
    issues.push({artist:'화가 목록',artistId:'movement-list-parent-label',work:'왼쪽 화가 목록이 대분류 사조만 표시하는 기준에서 벗어날 위험 있음',workId:'app-artists.js'});
  }
  if(appText && !/const artistMovementInfo = artistMovementDisplayInfo\(artist\);[\s\S]*artistMovementInfo\.label/.test(appText)) {
    issues.push({artist:'화가 연표',artistId:'movement-timeline-detail-label',work:'화가 연표 상단 사조 표시가 하부 사조 - 상부 사조 기준을 쓰는지 확인 필요',workId:'app-artists.js'});
  }
  return issues;
}
const expectedManualUHangulByArtistId = {
  Q68631:'[Vㅏㄴ] 데르 [Vㅔ]이던, 로히어르'
};
async function uHangulRuleIssues(artists) {
  const issues=[];
  const fontFile=path.join(root,'uhangul','assets','fonts','uHangul-v0.7.ttf');
  const runtimeFile=path.join(root,'uhangul','uhangul-runtime.js');
  const cssFile=path.join(root,'uhangul','uhangul-runtime.css');
  const exists=file=>fs.access(file).then(()=>true).catch(()=>false);
  if(!await exists(fontFile)) issues.push({artist:'uHangul',artistId:'uhangul-font',work:'uHangul v0.7 폰트 파일 누락',workId:'uhangul/assets/fonts/uHangul-v0.7.ttf'});
  if(!await exists(runtimeFile)) issues.push({artist:'uHangul',artistId:'uhangul-runtime',work:'uHangul 런타임 파일 누락',workId:'uhangul/uhangul-runtime.js'});
  if(!await exists(cssFile)) issues.push({artist:'uHangul',artistId:'uhangul-css',work:'uHangul CSS 파일 누락',workId:'uhangul/uhangul-runtime.css'});
  const runtimeText=await fs.readFile(runtimeFile,'utf8').catch(()=>'');
  if(runtimeText && !/byText\.get\(normalizeText\(el\.dataset\.uhDisplayKorean\)\)/.test(runtimeText)) issues.push({artist:'uHangul',artistId:'uhangul-runtime-attribute-resolution',work:'화면 data-uh-display-korean 속성이 uHangul 사전을 먼저 찾지 않음',workId:'uhangul/uhangul-runtime.js'});
  if(runtimeText && /\[[A-Z]+_[A-Z_]*[ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ]/.test(runtimeText)) issues.push({artist:'uHangul',artistId:'uhangul-runtime-retired-token',work:'uHangul v0.7에서 제외한 확장 토큰이 런타임에 남아 있음',workId:'uhangul/uhangul-runtime.js'});
  const dictionaryFile=path.join(root,'data','person-name-dictionary.json');
  const dictionary=await fs.readFile(dictionaryFile,'utf8').then(JSON.parse).catch(()=>null);
  const dictionaryRecords=Array.isArray(dictionary?.records) ? dictionary.records : [];
  if(!dictionaryRecords.length) issues.push({artist:'uHangul',artistId:'uhangul-dictionary',work:'v0.7 이름 사전을 읽을 수 없음',workId:'data/person-name-dictionary.json'});
  for(const record of dictionaryRecords) {
    if(record.uhangulVersion !== '0.7' || !record.language) {
      issues.push({artist:'uHangul',artistId:`uhangul-dictionary-${record.id || 'unknown'}`,work:'이름 사전에 v0.7 버전 또는 언어 메타데이터가 없음',workId:'data/person-name-dictionary.json'});
      break;
    }
    if(/\[[A-Z]+_[A-Z_]*[ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ]/.test(String(record.uhangul || ''))) {
      issues.push({artist:'uHangul',artistId:`uhangul-dictionary-${record.id || 'unknown'}`,work:'이름 사전에 v0.7 제외 토큰이 남아 있음',workId:'data/person-name-dictionary.json'});
      break;
    }
  }
  const records=buildArtistMap(artists);
  const byId=new Map(records.map(record=>[String(record.id || ''), record]));
  const byText=new Map();
  for(const record of records) {
    const aliases=Array.isArray(record.aliases) ? record.aliases : [...(Array.isArray(record.aliases?.ko) ? record.aliases.ko : []), ...(Array.isArray(record.aliases?.en) ? record.aliases.en : [])];
    [record.original,record.korean,record.displayKorean,record.listKorean,...aliases].filter(Boolean).forEach(value=>byText.set(compactCheckText(value),record));
  }
  for(const artist of artists) {
    const key=String(artist.qid || artist.id || '');
    const record=byId.get(key);
    if(!record) { issues.push(artistRuleItem(artist,'uHangul 화가 맵 항목 누락')); continue; }
    if(!record.uhangul) issues.push(artistRuleItem(artist,'uHangul 표기 누락'));
    if(record.uhangulVersion !== '0.7' || !record.language) issues.push(artistRuleItem(artist,'uHangul v0.7 버전 또는 언어 메타데이터 누락'));
    if(/\[[A-Z]+_[A-Z_]*[ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ]/.test(String(record.uhangul || ''))) issues.push(artistRuleItem(artist,'uHangul v0.7 제외 토큰 잔재'));
    const expected=expectedArtistDisplayNameForCheck(artist);
    if(expected && record.displayKorean !== expected) issues.push(artistRuleItem(artist,`uHangul 표시명 불일치: ${record.displayKorean || '(없음)'} → ${expected}`));
    if(!record.listKorean) issues.push(artistRuleItem(artist,'왼쪽 목록용 한국어 표시명 누락'));
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
      issues.push({artist:'미술사조 HTML',artistId:documentName,work:`선구자 공통 문구 본문 누락: ${expectedKey}`,workId:'server-content.js'});
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
    missingPreview:artists.flatMap(artist=>(artist.works || []).filter(work=>!hasLocalArtworkPreviewForCheck(work)).map(work=>ruleCheckItem(artist,work))),
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
const createContentService = require('./server-content');
const contentService = createContentService({fs,path,URL,createHash,randomBytes,execFileAsync,ffmpegPath,root,dataDir,highResolutionDir,imageStagingDir,techniquesFile,topicsFile,topicImageDir,movementSectionLinksFile,migrationAssetManifestFile,adminEmail,highResolutionStoredLimit,sourceImageInputLimit,jsonRequestBodyLimit,normalizeArtistsPayload,validateArtistsPayload,firebaseExport,invalidArtworkThumbnail,syncPersonNameDictionary,recordArtistRelationImpactAudit,readAccessControl,readArtistsFile,writeArtistsFile,saveThumbnailBuffer});
const { migrationExport, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, movementDocumentDir, movementDocumentName, movementDocumentSlot, movementDocumentRelative, readMovementDocuments, writeMovementDocuments, removeMovementDocument, refreshMovementDocumentLinks, saveMovementDocumentHtml, normalizeMovementCardPresentation, synchronizeMovementCountryTableArtistOrder, linkMovementDocumentArtists, injectUHangulDocumentIntegration, injectMovementArtworkMovementLabels, injectMovementCountryCardContexts, injectMovementPioneerContext, movementDocumentPioneerContextKey, injectMovementWikipediaHeading, injectMovementStickyTitle, injectMovementHighResolutionViewer, saveLocalArtworkImage, saveTopicArtwork, replaceTopicArtworkImage, deleteTopicArtwork, readMovementSectionLinks, saveMovementSectionLinks, applyCors, movementPioneerContexts } = contentService;
http.createServer(async (req,res) => { const url=new URL(req.url,`http://${req.headers.host}`); applyCors(req,res); if(req.method==='OPTIONS') { res.writeHead(204); return res.end(); } if (!enforceJsonRequestLimit(req,res,url.pathname)) return;
  if (req.method==='GET' && url.pathname==='/api/access') { res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({adminConfigured:Boolean(adminPasswordHash)})); }
  if (req.method==='POST' && url.pathname==='/api/auth/login') { try { await accessControlReady; if (!adminPasswordHash) throw new Error('관리자 설정 파일이 없어 보기 전용으로 실행 중입니다.'); const {email,password}=JSON.parse(await readJsonRequest(req) || '{}'), normalized=normalizedEmail(email); if (!isAdminEmail(normalized) || !samePassword(password)) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.'); activeAdminSession(); clearAdminSessions(normalized); const token=createAdminSession(normalized); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,email:normalized,role:'admin',token})); } catch(error) { const isTooLarge=error?.message === 'JSON request body exceeds the 12 MB limit'; res.writeHead(isTooLarge ? 413 : 401,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } return; }
  const session=adminSession(req);
  if (req.method==='POST' && url.pathname==='/api/auth/heartbeat') { if (!session) return sendAdminRequired(res); res.writeHead(204,{'Cache-Control':'no-store'}); return res.end(); }
  if (req.method==='POST' && url.pathname==='/api/auth/logout') { if (session) { const token=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1]; if (token) adminSessions.delete(token); } res.writeHead(204,{'Cache-Control':'no-store'}); res.end(); return; }
  if (requiresAdmin(req,url.pathname) && !session) return sendAdminRequired(res);
  if (req.method==='GET' && url.pathname==='/api/movement-section-links') { try { const data=await readMovementSectionLinks(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({schema:1,sections:{},error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/movement-section-links') { try { const payload=JSON.parse(await readJsonRequest(req) || '{}'), data=await saveMovementSectionLinks(String(payload.sectionId || ''),payload.links); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,sections:data.sections})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='GET' && url.pathname==='/api/movement-documents') { try { const data=await readMovementDocuments(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({documents:{},error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/movement-documents/refresh') { try { const payload=JSON.parse(await readJsonRequest(req) || '{}'), name=movementDocumentName(payload.name), slot=movementDocumentSlot(payload.slot), result=await refreshMovementDocumentLinks(name,slot); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(result)); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='POST' && url.pathname==='/api/movement-documents') { try { const form=multipartForm(await readRequestBuffer(req,30*1024*1024),req.headers['content-type']), name=movementDocumentName(form.fields.name), slot=movementDocumentSlot(form.fields.slot), file=form.files.document, ext=path.extname(String(file?.filename || '')).toLowerCase(); if(!file || !['.html','.htm'].includes(ext) || !/^(text\/html|application\/xhtml\+xml|)$/.test(file.contentType)) throw new Error('Upload an HTML file'); if(!file.data.length) throw new Error('The HTML file is empty'); const data=await readMovementDocuments(), relative=movementDocumentRelative(name,slot), previous=data.documents?.[name]?.[slot], linkedHtml=synchronizeMovementCountryTableArtistOrder(await linkMovementDocumentArtists(normalizeMovementCardPresentation(injectUHangulDocumentIntegration(file.data)))); await fs.mkdir(movementDocumentDir,{recursive:true}); const savedFile=path.join(root,relative); await fs.writeFile(savedFile,linkedHtml); if(previous && previous!==relative) await removeMovementDocument(previous); data.documents[name]={...(data.documents[name]||{}),[slot]:relative}; await writeMovementDocuments(data); syncPersonNameDictionary({additionalFiles:[savedFile]}); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,url:relative})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/movement-documents') { try { const payload=JSON.parse(await readJsonRequest(req) || '{}'), result=await saveMovementDocumentHtml(payload.name,payload.slot,payload.html); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(result)); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='DELETE' && url.pathname==='/api/movement-documents') { try { const {name,slot}=JSON.parse(await readJsonRequest(req) || '{}'), safeName=movementDocumentName(name), safeSlot=movementDocumentSlot(slot), data=await readMovementDocuments(), relative=data.documents?.[safeName]?.[safeSlot]; if(relative) await removeMovementDocument(relative); if(data.documents?.[safeName]) { delete data.documents[safeName][safeSlot]; if(!Object.keys(data.documents[safeName]).length) delete data.documents[safeName]; } await writeMovementDocuments(data); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ok:true})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='POST' && url.pathname==='/api/local-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveLocalArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artworks') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveTopicArtwork(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await replaceTopicArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='DELETE' && url.pathname==='/api/topic-artwork') { try { const body=JSON.parse((await readRequestBuffer(req,1024*1024)).toString('utf8') || '{}'), result=await deleteTopicArtwork(body); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/artists-index') { try { const data=await readArtistsIndex(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artists:[],error:error.message})); } }
  if (req.method==='GET' && /^\/api\/artists\/[^/]+$/.test(url.pathname)) { try { const artist=await readArtistDetail(decodeURIComponent(url.pathname.slice(13))); if(!artist) { res.writeHead(404,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({error:'Artist not found'})); } res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artist})); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/artists') { try { const data=await readArtistsFile(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artists:[],error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/topics') { try { const data=JSON.parse(await fs.readFile(topicsFile,'utf8')); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({topics:[],error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/techniques') { try { const data=JSON.parse(await fs.readFile(techniquesFile,'utf8')); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({techniques:[],error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/techniques') { try { const {id,links}=JSON.parse(await readJsonRequest(req) || '{}'), techniqueId=String(id || ''), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=techniques.find(item=>item.id===techniqueId), nextLinks=techniqueLinks(links); if(target) target.links=nextLinks; else { if(!comparisonTechniqueIds.has(techniqueId)) throw new Error('Technique not found'); data.comparisonLinks=data.comparisonLinks && typeof data.comparisonLinks==='object' && !Array.isArray(data.comparisonLinks) ? data.comparisonLinks : {}; data.comparisonLinks[techniqueId]=nextLinks; } await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,technique:target || {id:techniqueId,links:nextLinks,comparison:true}})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='DELETE' && url.pathname==='/api/techniques') { try { const {id}=JSON.parse(await readJsonRequest(req) || '{}'), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=String(id || ''); if(!target) throw new Error('Technique not found'); if(techniques.some(item=>item.id===target)) { data.techniques=techniques.filter(item=>item.id!==target); } else { if(!comparisonTechniqueIds.has(target)) throw new Error('Technique not found'); const hidden=new Set(Array.isArray(data.hiddenComparisonIds) ? data.hiddenComparisonIds : []); hidden.add(target); data.hiddenComparisonIds=[...hidden].sort(); if(data.comparisonLinks && typeof data.comparisonLinks==='object' && !Array.isArray(data.comparisonLinks)) delete data.comparisonLinks[target]; } await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,techniques:data.techniques,comparisonLinks:data.comparisonLinks || {},hiddenComparisonIds:data.hiddenComparisonIds || []})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if ((req.method==='PUT' || req.method==='POST') && url.pathname==='/api/artists') { try { const payload=JSON.parse(await readJsonRequest(req)), saved=await writeArtistsFile(payload,session.email); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,...saved})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='POST' && url.pathname==='/api/rules/check-and-apply') { try { const result=await checkAndApplyLatestRules(session.email); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(result)); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/migration-export') { try { const result=await migrationExport(), stamp=new Date().toISOString().slice(0,10); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="art-through-time-firebase-${stamp}.json"`,'Cache-Control':'no-store'}); return res.end(JSON.stringify(result.export,null,2)); } catch(error) { res.writeHead(403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/normalize-artist-works') { try { const result=await normalizeArtistWorks(JSON.parse(await readJsonRequest(req)).artist); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(result)); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='GET' && url.pathname==='/api/artist-profile') { try { const qid=url.searchParams.get('qid'); if(!/^Q\d+$/.test(qid || '')) throw new Error('Invalid artist'); const artistEntity=(await getEntities([qid]))[qid]; const nationalityQid=entityId(artistEntity,'P27'); const nationalityEntity=nationalityQid ? (await getEntities([nationalityQid]))[nationalityQid] : null; res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({name:{ko:koreanArtistNameOverrides[qid] || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')}})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/artwork-info') { try { const {artist,work}=JSON.parse(await readJsonRequest(req)); const result=await artworkInfo(artist,work); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({work:result})); } catch(error) { const status=error?.message === 'JSON request body exceeds the 12 MB limit' ? 413 : 502; res.writeHead(status,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } return; }
  if (req.method==='POST' && url.pathname==='/api/local-thumbnail-image') { try { const form=multipartForm(await readRequestBuffer(req,sourceImageInputLimit + 1024*1024),req.headers['content-type']), artist=JSON.parse(form.fields.artist || '{}'), work=JSON.parse(form.fields.work || '{}'); if(!artist?.id || !work?.id) throw new Error('Invalid artwork upload'); const thumbnail=await saveThumbnailFromLocalUpload(artist,work,form.files.image,adminEmail), relationImpactAudit=recordArtistRelationImpactAudit({artistId:artist.id,workId:work.id,trigger:'timeline-thumbnail-image-added'}); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail,verified:true,relationImpactAudit})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail:'',verified:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/search') { try { const query=url.searchParams.get('q')||'', kind=url.searchParams.get('type')||'artist'; const raw=kind==='artist' ? await artistSearchCandidates(query) : (await getJsonFast(api({action:'wbsearchentities',search:query,language:'ko',uselang:'ko',type:'item',limit:'20'}))).search?.map(item=>({id:item.id,label:item.label,description:item.description||''})) || []; const ranked=[...raw].sort((a,b)=>{const score=item=>similarityScore(query,item.label)+(kind==='artwork' ? /(회화|그림|painting|artwork|work of art)/i.test(item.description)?120:0 : /(화가|예술가|painter|visual artist|artist)/i.test(item.description)?120:0); return score(b)-score(a);}); const values=ranked.slice(0,8); res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify(values)); } catch(error) { res.writeHead(502,{'Content-Type':'application/json'}); return res.end(JSON.stringify([])); } }
  if (req.method==='GET' && url.pathname==='/favicon.ico') { res.writeHead(204,{'Cache-Control':'public, max-age=86400'}); return res.end(); }
  const file=safePath(url.pathname);if(!file){res.writeHead(403);return res.end();}try{let data=await fs.readFile(file);const relativeFile=path.relative(root,file).replace(/\\/g,'/');if(/^data[\\/]미술사조[\\/][a-f0-9]{24}-[12]\.html$/i.test(path.relative(root,file))) { let html=(await linkMovementDocumentArtists(data)).toString('utf8'); html=await injectMovementArtworkMovementLabels(html); html=normalizeMovementCardPresentation(html); html=synchronizeMovementCountryTableArtistOrder(html); html=injectMovementCountryCardContexts(html); html=injectMovementPioneerContext(html,await movementDocumentPioneerContextKey(relativeFile)); html=injectUHangulDocumentIntegration(html); html=injectMovementWikipediaHeading(html,url.searchParams.get('movementWiki') || '',url.searchParams.get('movementLabel') || ''); html=injectMovementStickyTitle(html); html=await injectMovementHighResolutionViewer(html); data=Buffer.from(html,'utf8'); }res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch(error){if(error?.code!=='ENOENT') console.error('Static file error:',error?.stack || error?.message || error);res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log(`Art Atlas: http://localhost:4173${adminPasswordHash ? '' : ' (read-only: .env not found)'}`));
