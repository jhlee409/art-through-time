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
const { writeArtistMap: writeUHangulArtistMap } = require('./tools/build-uhangul-artist-map');
const { syncPersonNameDictionary } = require('./tools/sync-person-name-dictionary');
process.once('uncaughtException', error => {
  if (error?.code === 'EADDRINUSE') {
    console.error('Art Atlas is already running on http://localhost:4173');
    process.exit(1);
  }
  throw error;
});
const root = __dirname, dataDir = path.join(root, 'data'), highResolutionDir = path.join(dataDir, 'images'), imageStagingDir = path.join(dataDir, '.image-staging'), artistsFile = path.join(dataDir, 'artists.json'), techniquesFile = path.join(dataDir, 'techniques.json'), topicsFile = path.join(dataDir, 'topics.json'), topicImageDir = path.join(dataDir, 'topic-images'), movementSectionLinksFile = path.join(dataDir, 'movement-section-links.json'), backupsDir = path.join(dataDir, 'backups'), accessControlFile = path.join(dataDir, 'access-control.json'), migrationAssetManifestFile = path.join(dataDir, 'migration-assets.json'), auditLogFile = path.join(dataDir, 'audit-log.jsonl');
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
  return req.method !== 'GET' && ['/api/artists','/api/artist-presentation','/api/artist-summary-update','/api/techniques','/api/movement-documents','/api/movement-documents/refresh','/api/movement-section-links','/api/local-artwork-image','/api/topic-artworks','/api/topic-artwork-image','/api/topic-artwork','/api/normalize-artist-works','/api/artwork-info','/api/local-thumbnail-image'].includes(pathname);
}
function isJsonRequest(req, pathname) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return false;
  if (pathname === '/api/movement-documents') return ['DELETE','PUT'].includes(req.method);
  return ['/api/auth/login','/api/artists','/api/artist-presentation','/api/artist-summary-update','/api/techniques','/api/movement-documents/refresh','/api/movement-section-links','/api/normalize-artist-works','/api/artwork-info'].includes(pathname);
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
const artistData = createArtistDataService({https,fs,path,URL,createHash,randomBytes,execFileAsync,ffmpegPath,root,dataDir,highResolutionDir,imageStagingDir,artistsFile,backupsDir,auditLogFile,adminEmail,artistImportedWorkLimit,highResolutionStoredLimit,sourceImageInputLimit,normalizeArtistsPayload,validateArtistsPayload,invalidArtworkThumbnail,writeUHangulArtistMap,syncPersonNameDictionary});
const { artistSearchCandidates, normalizeArtistWorks, artworkInfo, getJsonFast, api, similarityScore, getEntities, entityId, entityYear, entityLabel, koreanArtistNameOverrides, saveThumbnailBuffer, saveThumbnailFromLocalUpload, readArtistsFile, readArtistsIndex, readArtistDetail, writeArtistsFile, updateArtistPresentation, updateArtistSummaryFromLinks, highResolutionPathExists } = artistData;
const { researchArtistSummary } = require('./server-artist-research')();
const createContentService = require('./server-content');
const contentService = createContentService({fs,path,URL,createHash,randomBytes,execFileAsync,ffmpegPath,root,dataDir,highResolutionDir,imageStagingDir,techniquesFile,topicsFile,topicImageDir,movementSectionLinksFile,migrationAssetManifestFile,adminEmail,highResolutionStoredLimit,sourceImageInputLimit,jsonRequestBodyLimit,normalizeArtistsPayload,validateArtistsPayload,firebaseExport,invalidArtworkThumbnail,syncPersonNameDictionary,readAccessControl,readArtistsFile,writeArtistsFile,saveThumbnailBuffer,highResolutionPathExists});
const { migrationExport, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, movementDocumentDir, movementDocumentName, movementDocumentSlot, movementDocumentRelative, readMovementDocuments, writeMovementDocuments, removeMovementDocument, refreshMovementDocumentLinks, saveMovementDocumentHtml, normalizeMovementCardPresentation, synchronizeMovementCountryTableArtistOrder, linkMovementDocumentArtists, injectUHangulDocumentIntegration, injectMovementArtworkMovementLabels, injectMovementCountryCardContexts, injectMovementPioneerContext, movementDocumentPioneerContextKey, injectMovementWikipediaHeading, injectMovementWikipediaTermLinks, injectMovementStickyTitle, injectMovementContentLayout, injectMovementHighResolutionViewer, saveLocalArtworkImage, saveTopicArtwork, replaceTopicArtworkImage, deleteTopicArtwork, readMovementSectionLinks, saveMovementSectionLinks, applyCors } = contentService;
http.createServer(async (req,res) => { const url=new URL(req.url,`http://${req.headers.host}`); applyCors(req,res); if(req.method==='OPTIONS') { res.writeHead(204); return res.end(); } if (!enforceJsonRequestLimit(req,res,url.pathname)) return;
  if (req.method==='GET' && url.pathname==='/api/access') { res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({adminConfigured:Boolean(adminPasswordHash)})); }
  if (req.method==='POST' && url.pathname==='/api/auth/login') { try { await accessControlReady; if (!adminPasswordHash) throw new Error('관리자 설정 파일이 없어 보기 전용으로 실행 중입니다.'); const {email,password}=JSON.parse(await readJsonRequest(req) || '{}'), normalized=normalizedEmail(email); if (!isAdminEmail(normalized) || !samePassword(password)) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.'); activeAdminSession(); const token=createAdminSession(normalized); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,email:normalized,role:'admin',token})); } catch(error) { const isTooLarge=error?.message === 'JSON request body exceeds the 12 MB limit'; res.writeHead(isTooLarge ? 413 : 401,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:false,error:error.message})); } return; }
  const session=adminSession(req);
  if (req.method==='POST' && url.pathname==='/api/auth/heartbeat') { if (!session) return sendAdminRequired(res); res.writeHead(204,{'Cache-Control':'no-store'}); return res.end(); }
  if (req.method==='POST' && url.pathname==='/api/auth/logout') { if (session) { const token=/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1]; if (token) adminSessions.delete(token); } res.writeHead(204,{'Cache-Control':'no-store'}); res.end(); return; }
  if (requiresAdmin(req,url.pathname) && !session) return sendAdminRequired(res);
  if (req.method==='GET' && url.pathname==='/api/movement-section-links') { try { const data=await readMovementSectionLinks(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({schema:1,sections:{},error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/movement-section-links') { try { const payload=JSON.parse(await readJsonRequest(req) || '{}'), data=await saveMovementSectionLinks(String(payload.sectionId || ''),payload.links); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,sections:data.sections})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='GET' && url.pathname==='/api/movement-documents') { try { const data=await readMovementDocuments(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({documents:{},error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/movement-documents/refresh') { try { const payload=JSON.parse(await readJsonRequest(req) || '{}'), name=movementDocumentName(payload.name), slot=movementDocumentSlot(payload.slot), result=await refreshMovementDocumentLinks(name,slot); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(result)); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='POST' && url.pathname==='/api/movement-documents') { try { const form=multipartForm(await readRequestBuffer(req,30*1024*1024),req.headers['content-type']), name=movementDocumentName(form.fields.name), fileName=movementDocumentName(form.fields.fileName || name), slot=movementDocumentSlot(form.fields.slot), file=form.files.document, ext=path.extname(String(file?.filename || '')).toLowerCase(); if(!file || !['.html','.htm'].includes(ext) || !/^(text\/html|application\/xhtml\+xml|)$/.test(file.contentType)) throw new Error('Upload an HTML file'); if(!file.data.length) throw new Error('The HTML file is empty'); const data=await readMovementDocuments(), relative=movementDocumentRelative(fileName,slot), previous=data.documents?.[name]?.[slot], linkedHtml=synchronizeMovementCountryTableArtistOrder(await linkMovementDocumentArtists(normalizeMovementCardPresentation(injectUHangulDocumentIntegration(file.data)))); await fs.mkdir(movementDocumentDir,{recursive:true}); const savedFile=path.join(root,relative); await fs.writeFile(savedFile,linkedHtml); if(previous && previous!==relative) await removeMovementDocument(previous); data.documents[name]={...(data.documents[name]||{}),[slot]:relative}; await writeMovementDocuments(data); syncPersonNameDictionary({additionalFiles:[savedFile]}); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,url:relative})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/movement-documents') { try { const payload=JSON.parse(await readJsonRequest(req) || '{}'), result=await saveMovementDocumentHtml(payload.name,payload.slot,payload.html); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(result)); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='DELETE' && url.pathname==='/api/movement-documents') { try { const {name,slot}=JSON.parse(await readJsonRequest(req) || '{}'), safeName=movementDocumentName(name), safeSlot=movementDocumentSlot(slot), data=await readMovementDocuments(), relative=data.documents?.[safeName]?.[safeSlot]; if(relative) await removeMovementDocument(relative); if(data.documents?.[safeName]) { delete data.documents[safeName][safeSlot]; if(!Object.keys(data.documents[safeName]).length) delete data.documents[safeName]; } await writeMovementDocuments(data); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({ok:true})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='POST' && url.pathname==='/api/local-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveLocalArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artworks') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await saveTopicArtwork(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/topic-artwork-image') { try { const form=multipartForm(await readRequestBuffer(req,500*1024*1024),req.headers['content-type']), result=await replaceTopicArtworkImage(form); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='DELETE' && url.pathname==='/api/topic-artwork') { try { const body=JSON.parse((await readRequestBuffer(req,1024*1024)).toString('utf8') || '{}'), result=await deleteTopicArtwork(body); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,...result})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/artists-index') { try { const data=await readArtistsIndex(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artists:[],error:error.message})); } }
  if (req.method==='GET' && /^\/api\/artists\/[^/]+$/.test(url.pathname)) { try { const artist=await readArtistDetail(decodeURIComponent(url.pathname.slice(13))); if(!artist) { res.writeHead(404,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({error:'Artist not found'})); } res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artist})); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/artists') { try { const data=await readArtistsFile(); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({artists:[],error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/artist-presentation') { try { const result=await updateArtistPresentation(JSON.parse(await readJsonRequest(req) || '{}'),session.email); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,...result})); } catch(error) { console.error('Artist presentation save failed:',error?.stack || error?.message || error); sendJsonBodyError(res,error); } return; }
  if (req.method==='POST' && url.pathname==='/api/artist-summary-update') { try { const body=JSON.parse(await readJsonRequest(req) || '{}'); if(body.consent!==true) throw new Error('OpenAI API 전송에 대한 명시적 동의가 필요합니다.'); const result=await updateArtistSummaryFromLinks(body.artistId,session.email,researchArtistSummary,{confirmationToken:body.confirmationToken,decisions:body.decisions}); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,...result})); } catch(error) { console.error('Artist summary update failed:',error?.stack || error?.message || error); sendJsonBodyError(res,error); } return; }
  if (req.method==='GET' && url.pathname==='/api/topics') { try { const data=JSON.parse(await fs.readFile(topicsFile,'utf8')); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({topics:[],error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/techniques') { try { const data=JSON.parse(await fs.readFile(techniquesFile,'utf8')); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify(data)); } catch(error) { res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({techniques:[],error:error.message})); } }
  if (req.method==='PUT' && url.pathname==='/api/techniques') { try { const {id,links}=JSON.parse(await readJsonRequest(req) || '{}'), techniqueId=String(id || ''), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=techniques.find(item=>item.id===techniqueId), nextLinks=techniqueLinks(links); if(target) target.links=nextLinks; else { if(!comparisonTechniqueIds.has(techniqueId)) throw new Error('Technique not found'); data.comparisonLinks=data.comparisonLinks && typeof data.comparisonLinks==='object' && !Array.isArray(data.comparisonLinks) ? data.comparisonLinks : {}; data.comparisonLinks[techniqueId]=nextLinks; } await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,technique:target || {id:techniqueId,links:nextLinks,comparison:true}})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='DELETE' && url.pathname==='/api/techniques') { try { const {id}=JSON.parse(await readJsonRequest(req) || '{}'), data=JSON.parse(await fs.readFile(techniquesFile,'utf8')), techniques=Array.isArray(data.techniques) ? data.techniques : [], target=String(id || ''); if(!target) throw new Error('Technique not found'); if(techniques.some(item=>item.id===target)) { data.techniques=techniques.filter(item=>item.id!==target); } else { if(!comparisonTechniqueIds.has(target)) throw new Error('Technique not found'); const hidden=new Set(Array.isArray(data.hiddenComparisonIds) ? data.hiddenComparisonIds : []); hidden.add(target); data.hiddenComparisonIds=[...hidden].sort(); if(data.comparisonLinks && typeof data.comparisonLinks==='object' && !Array.isArray(data.comparisonLinks)) delete data.comparisonLinks[target]; } await fs.writeFile(techniquesFile,JSON.stringify(data,null,2)+'\n','utf8'); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,techniques:data.techniques,comparisonLinks:data.comparisonLinks || {},hiddenComparisonIds:data.hiddenComparisonIds || []})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if ((req.method==='PUT' || req.method==='POST') && url.pathname==='/api/artists') { try { const payload=JSON.parse(await readJsonRequest(req)), saved=await writeArtistsFile(payload,session.email); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:true,...saved})); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='GET' && url.pathname==='/api/migration-export') { try { const result=await migrationExport(), stamp=new Date().toISOString().slice(0,10); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="art-through-time-firebase-${stamp}.json"`,'Cache-Control':'no-store'}); return res.end(JSON.stringify(result.export,null,2)); } catch(error) { res.writeHead(403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:false,error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/normalize-artist-works') { try { const result=await normalizeArtistWorks(JSON.parse(await readJsonRequest(req)).artist); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(result)); } catch(error) { sendJsonBodyError(res,error); } return; }
  if (req.method==='GET' && url.pathname==='/api/artist-profile') { try { const qid=url.searchParams.get('qid'); if(!/^Q\d+$/.test(qid || '')) throw new Error('Invalid artist'); const artistEntity=(await getEntities([qid]))[qid]; const nationalityQid=entityId(artistEntity,'P27'); const nationalityEntity=nationalityQid ? (await getEntities([nationalityQid]))[nationalityQid] : null; res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({name:{ko:koreanArtistNameOverrides[qid] || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')}})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:error.message})); } }
  if (req.method==='POST' && url.pathname==='/api/artwork-info') { try { const {artist,work}=JSON.parse(await readJsonRequest(req)); const result=await artworkInfo(artist,work); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({work:result})); } catch(error) { const status=error?.message === 'JSON request body exceeds the 12 MB limit' ? 413 : 502; res.writeHead(status,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); } return; }
  if (req.method==='POST' && url.pathname==='/api/local-thumbnail-image') { try { const form=multipartForm(await readRequestBuffer(req,sourceImageInputLimit + 1024*1024),req.headers['content-type']), artist=JSON.parse(form.fields.artist || '{}'), work=JSON.parse(form.fields.work || '{}'); if(!artist?.id || !work?.id) throw new Error('Invalid artwork upload'); const thumbnail=await saveThumbnailFromLocalUpload(artist,work,form.files.image,adminEmail); res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail,verified:true})); } catch(error) { res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({thumbnail:'',verified:false,error:error.message})); } }
  if (req.method==='GET' && url.pathname==='/api/search') { try { const query=url.searchParams.get('q')||'', kind=url.searchParams.get('type')||'artist'; const raw=kind==='artist' ? await artistSearchCandidates(query) : (await getJsonFast(api({action:'wbsearchentities',search:query,language:'ko',uselang:'ko',type:'item',limit:'20'}))).search?.map(item=>({id:item.id,label:item.label,description:item.description||''})) || []; const ranked=[...raw].sort((a,b)=>{const score=item=>similarityScore(query,item.label)+(kind==='artwork' ? /(회화|그림|painting|artwork|work of art)/i.test(item.description)?120:0 : /(화가|예술가|painter|visual artist|artist)/i.test(item.description)?120:0); return score(b)-score(a);}); const values=ranked.slice(0,8); res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify(values)); } catch(error) { res.writeHead(502,{'Content-Type':'application/json'}); return res.end(JSON.stringify([])); } }
  if (req.method==='GET' && url.pathname==='/favicon.ico') { res.writeHead(204,{'Cache-Control':'public, max-age=86400'}); return res.end(); }
  const file=safePath(url.pathname);if(!file){res.writeHead(403);return res.end();}try{let data=await fs.readFile(file);const relativeFile=path.relative(root,file).replace(/\\/g,'/');if(/^data[\\/]미술사조[\\/][^\\/]+\.html$/i.test(path.relative(root,file))) { const source=data.toString('utf8'); const idSynchronized=/<html\b[^>]*\bdata-art-atlas-sync-version=["']1["']/i.test(source); let html=idSynchronized ? source : (await linkMovementDocumentArtists(data)).toString('utf8'); const migrationLocked=/<html\b[^>]*\bdata-art-atlas-sync-state=["'](?:structure|content)["']/i.test(html); if(!idSynchronized){html=await injectMovementArtworkMovementLabels(html); html=normalizeMovementCardPresentation(html); if(!migrationLocked){html=synchronizeMovementCountryTableArtistOrder(html); html=injectMovementCountryCardContexts(html); html=injectMovementPioneerContext(html,await movementDocumentPioneerContextKey(relativeFile));}} html=injectUHangulDocumentIntegration(html); html=injectMovementWikipediaHeading(html,url.searchParams.get('movementWiki') || '',url.searchParams.get('movementLabel') || ''); html=injectMovementWikipediaTermLinks(html); html=injectMovementStickyTitle(html); html=injectMovementContentLayout(html); html=await injectMovementHighResolutionViewer(html); data=Buffer.from(html,'utf8'); }res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch(error){if(error?.code!=='ENOENT') console.error('Static file error:',error?.stack || error?.message || error);res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log(`Art Atlas: http://localhost:4173${adminPasswordHash ? '' : ' (read-only: .env not found)'}`));
