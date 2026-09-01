module.exports = function install(context) {
  const { fs, path, URL, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists, thumbnailLocation, makePngUnderStorageLimit, assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument } = context;
function highResolutionLocation(email, artistId) {
  return {folder:path.join(highResolutionDir,artistId), relativePrefix:`data/images/${artistId}`};
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
  await Promise.all(entries.filter(name => name.startsWith(`${safeWorkId}_`) && /\.(?:jpe?g|jfif|png|webp|gif)$/i.test(name)).map(name => fs.unlink(path.join(folder,name)).catch(()=>{})));
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
const publicRootFiles = new Set([
  'index.html',
  'app/app.js',
  'app/app-core.js',
  'app/app-artists.js',
  'app/app-atlas.js',
  'app/app-detail.js',
  'styles.css',
  'extras.css',
  'tab-session.js',
  'techniques.html',
  'techniques.css',
  'techniques.js',
  'topics.html',
  'topics.css',
  'topics.js'
]);
const publicDataFiles = new Set([
  'data/artists.json',
  'data/artists-index.json',
  'data/art-taxonomy.json',
  'data/art-movement-canonical.json',
  'data/art-movements.json',
  'data/country-art-events.json',
  'data/country-movement-backgrounds.json',
  'data/featured-works.json',
  'data/movement-section-links.json',
  'data/미술사조/index.json',
  'data/person-name-dictionary.json',
  'data/techniques.json',
  'data/topics.json'
]);
const publicPathPrefixes = [
  'app/',
  'extras/',
  'data/generated/',
  'data/techniques/',
  'data/images/',
  'data/topic-images/',
  'uhangul/uhangul-runtime.css',
  'uhangul/uhangul-runtime.js'
];
function isPublicStaticPath(relative) {
  if (publicRootFiles.has(relative) || publicDataFiles.has(relative)) return true;
  if (isMovementDocumentRelative(relative)) return true;
  if (/^data\/미술사조\/images\/[^/]+\.(?:jpe?g|png|webp|gif|json)$/i.test(relative)) return true;
  if (/^uhangul\/assets\/fonts\/[^/]+\.ttf$/i.test(relative)) return true;
  return publicPathPrefixes.some(prefix => relative === prefix || relative.startsWith(prefix));
}
function safePath(urlPath) {
  const name=urlPath==='/'?'index.html':decodeURIComponent(urlPath).replace(/^\/+/, '').replace(/\\/g,'/');
  const output=path.resolve(root,name);
  const relative=path.relative(root,output).replace(/\\/g,'/');
  if(!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if(!isPublicStaticPath(relative)) return null;
  return output;
}
function techniqueLinks(value) {
  if (!Array.isArray(value) || value.length > 40) throw new Error('Invalid technique links');
  return value.map(link => {
    const raw=String(link?.url || link || '').trim(), parsed=new URL(raw);
    if (!['http:','https:'].includes(parsed.protocol)) throw new Error('Technique links must use HTTP or HTTPS');
    return {url:parsed.href,...(link?.emphasized===true?{emphasized:true}:{})};
  });
}
const comparisonTechniqueIds = new Set(['disegno-colorito','fresco-oil','tempera-oil','chiaroscuro-sfumato','linear-aerial-perspective','glazing-impasto']);
function readRequestBuffer(req, limit=500*1024*1024, tooLargeMessage='File is larger than 500 MB') { return new Promise((resolve,reject) => { const chunks=[]; let size=0, rejected=false; req.on('data',chunk=>{ if(rejected) return; size+=chunk.length; if(size>limit) { rejected=true; chunks.length=0; reject(new Error(tooLargeMessage)); req.resume(); return; } chunks.push(chunk); }); req.on('end',()=>{ if(!rejected) resolve(Buffer.concat(chunks)); }); req.on('error',error=>{ if(!rejected) reject(error); }); }); }
async function readJsonRequest(req) {
  return (await readRequestBuffer(req,jsonRequestBodyLimit,'JSON request body exceeds the 12 MB limit')).toString('utf8');
}
function sendJsonBodyError(res, error, status=422) {
  const isTooLarge=error?.message === 'JSON request body exceeds the 12 MB limit';
  res.writeHead(isTooLarge ? 413 : status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({ok:false,error:error?.message || 'Invalid request body'}));
}
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
function movementDocumentFileStem(value) {
  const stem=String(value || '').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/\s+/g,' ').replace(/[. ]+$/g,'').trim();
  if(!stem) throw new Error('Invalid movement document file name');
  return stem.slice(0,140).replace(/[. ]+$/g,'').trim();
}
function movementDocumentRelative(name, slot) { const stem=movementDocumentFileStem(name); return `data/미술사조/${stem}${String(slot)==='1'?'':`-${slot}`}.html`; }
function isMovementDocumentRelative(value) { return /^data\/미술사조\/[^/\\]+\.html$/i.test(String(value || '').replace(/\\/g,'/')); }
  Object.assign(context, { highResolutionLocation, highResolutionArtistNameOverrides, commonHighResolutionArtistName, safeFileSegment, highResolutionFileBase, removeHighResolutionFiles, migrationExport, publicRootFiles, publicDataFiles, publicPathPrefixes, isPublicStaticPath, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, safeUploadId, uploadTypes, movementDocumentDir, movementDocumentIndex, movementDocumentName, movementDocumentSlot, readMovementDocuments, writeMovementDocuments, movementDocumentFileStem, movementDocumentRelative, isMovementDocumentRelative });
  return context;
};
