/* Movement documents, local image uploads, and public static-file services. */
const {assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument} = require('./movement-sync-v1');
module.exports = function createContentService(deps) {
  const { fs, path, URL, createHash, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists } = deps;
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
const publicRootFiles = new Set([
  'index.html',
  'app.js',
  'app-core.js',
  'app-artists.js',
  'app-atlas.js',
  'app-detail.js',
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
  'data/generated/',
  'data/high-resolution/',
  'data/techniques/',
  'data/thumbnails/',
  'data/topic-images/',
  'uhangul/uhangul-runtime.css',
  'uhangul/uhangul-runtime.js'
];
function isPublicStaticPath(relative) {
  if (publicRootFiles.has(relative) || publicDataFiles.has(relative)) return true;
  if (/^data\/미술사조\/[a-f0-9]{24}-[12]\.html$/i.test(relative)) return true;
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
    return {url:parsed.href};
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
function movementDocumentRelative(name, slot) { return `data/미술사조/${createHash('sha256').update(`${name}:${slot}`,'utf8').digest('hex').slice(0,24)}-${slot}.html`; }
function movementDocumentSyncState(html) {
  return /<html\b[^>]*\bdata-art-atlas-sync-state=["']([^"']+)["']/i.exec(String(html || ''))?.[1] || '';
}
async function saveMovementDocumentHtml(name, slot, html) {
  const safeName=movementDocumentName(name), safeSlot=movementDocumentSlot(slot), source=String(html || '');
  if(!source.trim()) throw new Error('The HTML document is empty');
  if(Buffer.byteLength(source,'utf8') > jsonRequestBodyLimit) throw new Error('The HTML document exceeds the 12 MB limit');
  const data=await readMovementDocuments(), relative=data.documents?.[safeName]?.[safeSlot];
  if(!relative || !/^data\/미술사조\/[a-f0-9]{24}-[12]\.html$/.test(relative)) throw new Error('There is no saved movement document');
  const savedFile=path.join(root,relative), current=await fs.readFile(savedFile,'utf8');
  if(['structure','content'].includes(movementDocumentSyncState(current))) throw new Error('Movement document editing is locked until ID-based synchronization is complete');
  if(/<html\b[^>]*\bdata-art-atlas-sync-version=["']1["']/i.test(current)) {
    assertStableEditableStructure(current,source);
    const synchronized=synchronizeTableArtistOrder(source);
    const [canonical,artists,movements]=await Promise.all([
      fs.readFile(path.join(dataDir,'art-movement-canonical.json'),'utf8').then(JSON.parse),
      readArtistsFile(),
      fs.readFile(path.join(dataDir,'art-movements.json'),'utf8').then(JSON.parse)
    ]);
    validateCompleteDocument(synchronized,{canonical,artists,movements,documentFile:savedFile});
    const temporary=`${savedFile}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temporary,synchronized,'utf8');
      await fs.rename(temporary,savedFile);
    } catch(error) {
      await fs.unlink(temporary).catch(()=>{});
      throw error;
    }
    syncPersonNameDictionary({additionalFiles:[savedFile]});
    return {ok:true,url:relative,revision:`${Date.now()}-${randomBytes(4).toString('hex')}`};
  }
  const linkedHtml=synchronizeMovementCountryTableArtistOrder(await linkMovementDocumentArtists(normalizeMovementCardPresentation(injectUHangulDocumentIntegration(source))));
  await fs.writeFile(savedFile,linkedHtml,'utf8');
  syncPersonNameDictionary({additionalFiles:[savedFile]});
  return {ok:true,url:relative};
}
async function removeMovementDocument(relative) { if(!/^data\/미술사조\/[a-f0-9]{24}-[12]\.html$/.test(String(relative || ''))) return; await fs.unlink(path.join(root,relative)).catch(error => { if(error.code!=='ENOENT') throw error; }); }
async function refreshMovementDocumentLinks(name, slot) {
  const data=await readMovementDocuments(), relative=data.documents?.[name]?.[slot];
  if(!relative) throw new Error('There is no saved movement document');
  if(!/^data\/미술사조\/[a-f0-9]{24}-[12]\.html$/.test(String(relative || ''))) throw new Error('Invalid movement document path');
  const file=path.join(root,relative), before=await fs.readFile(file);
  if(['structure','content'].includes(movementDocumentSyncState(before))) return {ok:true,url:relative,changed:false,locked:true};
  if(/<html\b[^>]*\bdata-art-atlas-sync-version=["']1["']/i.test(before.toString('utf8'))) {
    const [canonical,artists,movements]=await Promise.all([
      fs.readFile(path.join(dataDir,'art-movement-canonical.json'),'utf8').then(JSON.parse),
      readArtistsFile(),
      fs.readFile(path.join(dataDir,'art-movements.json'),'utf8').then(JSON.parse)
    ]);
    validateCompleteDocument(before.toString('utf8'),{canonical,artists,movements,documentFile:file});
    return {ok:true,url:relative,changed:false,idSynchronized:true};
  }
  const after=synchronizeMovementCountryTableArtistOrder(await linkMovementDocumentArtists(normalizeMovementCardPresentation(injectUHangulDocumentIntegration(before))));
  const changed=!before.equals(after);
  if(changed) await fs.writeFile(file,after);
  return {ok:true,url:relative,changed};
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function escapeAttribute(value) { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function htmlDecode(value='') {
  const named={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(match,entity)=>{
    if(entity[0]==='#') { const number=entity[1]?.toLowerCase()==='x' ? parseInt(entity.slice(2),16) : parseInt(entity.slice(1),10); return Number.isFinite(number) ? String.fromCodePoint(number) : match; }
    return named[entity.toLowerCase()] ?? match;
  });
}
function tagAttrs(tag='') {
  const attrs={};
  for (const match of String(tag).matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[match[1].toLowerCase()]=htmlDecode(match[2] || match[3] || match[4] || '').trim();
  return attrs;
}
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
const movementCardDoubleClickZoom = `<style id="art-atlas-movement-card-zoom-style">.art-atlas-movement-card-zoom{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:6vh 4vw;background:rgba(5,7,10,.9);cursor:zoom-out}.art-atlas-movement-card-zoom img{display:block;flex:none;max-width:none;height:auto;box-shadow:0 18px 55px rgba(0,0,0,.55)}</style><script id="art-atlas-movement-card-zoom-viewer">(function(){if(window.__artAtlasMovementCardZoom)return;window.__artAtlasMovementCardZoom=true;var overlayId='art-atlas-movement-card-zoom';function close(){var overlay=document.getElementById(overlayId);if(overlay)overlay.remove();}document.addEventListener('dblclick',function(event){var open=document.getElementById(overlayId);if(open){if(event.target&&event.target.closest&&event.target.closest('#'+overlayId)){event.preventDefault();event.stopPropagation();close();}return;}var image=event.target&&event.target.closest&&event.target.closest('article.movement-work-card .movement-work-image img,article.card .movement-work-image img');if(!image)return;event.preventDefault();event.stopPropagation();var rect=image.getBoundingClientRect(),overlay=document.createElement('div'),zoomed=document.createElement('img');overlay.id=overlayId;overlay.className=overlayId;overlay.title='두 번 클릭하여 닫기';zoomed.src=image.currentSrc||image.src;zoomed.alt=image.alt||'';zoomed.style.width=Math.max(1,Math.round(rect.width*1.2))+'px';overlay.appendChild(zoomed);document.body.appendChild(overlay);},true);})();</script>`;
function movementCardDocumentName(html) {
  const heading=String(html || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  const text=heading.split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
  return text.split(/\s*(?:—|:)\s*/)[0].trim();
}
function normalizeMovementCardPresentation(html) {
  let source=stripMovementArtworkMovementLabels(html)
    .replace(/\s*<style\b[^>]*id=["']art-atlas-movement-card-presentation-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n');
  const movement=movementCardDocumentName(source);
  if(!movement || !/<article\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-card|card)\b[^"']*["'])/i.test(source)) return source;
  source=source.replace(/<article\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-card|card)\b[^"']*["'])[\s\S]*?<\/article>/gi,card=>card.replace(/(<div\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-body|caption)\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/div>)/i,(_,open,body,close)=>{
    const withoutLabel=body.replace(/^\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmini-label\b)[^>]*>[\s\S]*?<\/span>\s*/i,'');
    const titled=withoutLabel.replace(/(<h3\b[^>]*>)([\s\S]*?)(<\/h3>)/i,(_,headingOpen,title,headingClose)=>{
      const activityRegion=title.match(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-activity-region\b)[^>]*>[\s\S]*?<\/span>\s*/i)?.[0] || '';
      const cleanTitle=title
        .replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-title-tag\b)[^>]*>[\s\S]*?<\/span>\s*/gi,'')
        .replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-activity-region\b)[^>]*>[\s\S]*?<\/span>\s*/gi,'');
      return `${headingOpen}${cleanTitle}<span class="movement-card-title-tag"> · ${escapeAttribute(movement)}</span>${activityRegion}${headingClose}`;
    });
    return `${open}${titled}${close}`;
  }));
  const style='<style id="art-atlas-movement-card-presentation-style">.movement-card-title-tag,.movement-card-activity-region{color:#9aa5af;font-size:.78em;font-weight:600;white-space:nowrap}</style>';
  return /<\/head>/i.test(source) ? source.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${source}`;
}
function movementPlainText(value='') {
  return htmlDecode(String(value || '')).replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
}
function movementCountryLabelKey(value='') {
  return movementPlainText(value).replace(/\s+(?:공화국|왕국|제국)$/,'').replace(/\s+/g,'').trim();
}
function movementCountryCardContexts(html) {
  const source=String(html || '');
  const countriesStart=source.search(/<section\b[^>]*\bid=["']countries["'][^>]*>/i);
  if(countriesStart < 0) return [];
  const countriesEnd=matchingHtmlElementEnd(source,countriesStart,'section');
  if(countriesEnd < 0) return [];
  const contexts=[];
  for(const row of source.slice(countriesStart,countriesEnd).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell=>movementPlainText(cell[1]));
    if(cells.length < 2) continue;
    const [country='', region='']=cells[0].split(/\s*(?:—|–)\s*/,2);
    const key=movementCountryLabelKey(country);
    if(!key || !cells[1]) continue;
    contexts.push({country:country.trim(),region:region.trim(),feature:cells[1],key});
  }
  return contexts;
}
function injectMovementCountryCardContexts(html) {
  let source=String(html || '')
    .replace(/\s*<style\b[^>]*id=["']art-atlas-movement-country-card-context-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n');
  const contexts=movementCountryCardContexts(source);
  if(!contexts.length) return source;
  source=source.replace(/<section\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-group\b[^"']*["'])[^>]*>[\s\S]*?<\/section>/gi,group=>{
    const groupName=movementPlainText(group.match(/\bdata-art-atlas-submovement=["']([^"']+)["']/i)?.[1] || group.match(/<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
    const groupKey=movementCountryLabelKey(groupName);
    const context=contexts.find(item=>item.key===groupKey) || contexts.find(item=>item.key.includes(groupKey) || groupKey.includes(item.key));
    if(!context) return group;
    return group.replace(/(<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/h3>)/i,(_,open,title,close)=>{
      const cleanTitle=title.replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-country-card-context\b[^"']*["'])[^>]*>[\s\S]*?<\/span>\s*/gi,'');
      const region=context.region ? `<span class="movement-country-card-context-region">${escapeAttribute(context.region)}</span>` : '';
      return `${open}${cleanTitle}<span class="movement-country-card-context">${region}<span class="movement-country-card-context-feature"><b>특징</b> ${escapeAttribute(context.feature)}</span></span>${close}`;
    });
  });
  const style='<style id="art-atlas-movement-country-card-context-style">.movement-enhancement .art-atlas-submovement-heading{display:flex;flex-wrap:wrap;align-items:baseline;gap:.45rem}.movement-enhancement .movement-country-card-context{display:inline-flex;flex:1 1 20rem;flex-wrap:wrap;gap:.32rem .7rem;align-items:baseline;color:#aeb9c3;font-size:.912rem;font-weight:500;line-height:1.55}.movement-enhancement .movement-country-card-context b{color:#e6c98d;font-size:.92em;font-weight:800}.movement-enhancement .movement-country-card-context-region{white-space:nowrap}.movement-enhancement .movement-country-card-context-feature{min-width:12rem}</style>';
  return /<\/head>/i.test(source) ? source.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${source}`;
}
function injectMovementStickyTitle(html) {
  let source=String(html || '')
    .replace(/\s*<style\b[^>]*id=["']art-atlas-movement-sticky-title-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n');
  const title=movementCardDocumentName(source);
  if(!title) return source;
  const nav=/<nav\b[^>]*>[\s\S]*?<\/nav>/i;
  if(!nav.test(source)) return source;
  source=source.replace(nav,`<nav aria-label="현재 사조"><div class="wrap"><span class="art-atlas-movement-sticky-title">${escapeAttribute(title)}</span></div></nav>`);
  const style='<style id="art-atlas-movement-sticky-title-style">nav .wrap{display:flex;align-items:center;justify-content:center}nav .art-atlas-movement-sticky-title{display:block;width:100%;color:inherit;font-family:inherit;font-size:2em;font-weight:inherit;letter-spacing:inherit;line-height:inherit;text-align:center}</style>';
  return /<\/head>/i.test(source) ? source.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${source}`;
}
function matchingHtmlElementEnd(source, start, tagName) {
  const tag=new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tag.lastIndex=start;
  let depth=0;
  for(let match; (match=tag.exec(source));) {
    if(/^<\//.test(match[0])) {
      depth--;
      if(depth===0) return tag.lastIndex;
    } else if(!/\/>$/.test(match[0])) depth++;
  }
  return -1;
}
function synchronizeMovementCountryTableArtistOrder(html) {
  const source=String(html || '');
  const countriesStart=source.search(/<section\b[^>]*\bid=["']countries["'][^>]*>/i);
  if(countriesStart < 0) return source;
  const countriesEnd=matchingHtmlElementEnd(source,countriesStart,'section');
  const enhancementStarts=[...source.matchAll(/<section\b(?=[^>]*\bclass=["'][^"']*\bmovement-enhancement\b[^"']*["'])[^>]*>/gi)].map(match=>match.index);
  const deepeningStart=enhancementStarts.at(-1);
  if(countriesEnd < 0 || deepeningStart === undefined) return source;
  const deepeningEnd=matchingHtmlElementEnd(source,deepeningStart,'section');
  if(deepeningEnd < 0) return source;
  const artistLink=/<a\b(?=[^>]*\bdata-artist-id=["']([^"']+)["'])[^>]*>[\s\S]*?<\/a>/gi;
  const cardOrder=new Map();
  [...source.slice(deepeningStart,deepeningEnd).matchAll(/<article\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-card|card)\b[^"']*["'])[^>]*>[\s\S]*?<\/article>/gi)].forEach((card,index)=>{
    const artistId=card[0].match(/\bdata-artist-id=["']([^"']+)["']/i)?.[1];
    if(artistId && !cardOrder.has(artistId)) cardOrder.set(artistId,index);
  });
  if(!cardOrder.size) return source;
  const countries=source.slice(countriesStart,countriesEnd).replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi,row=>{
    const cells=[...row.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)];
    const artistCell=[...cells].reverse().find(cell=>artistLink.test(cell[0]));
    artistLink.lastIndex=0;
    if(!artistCell) return row;
    const links=[...artistCell[0].matchAll(artistLink)].map((match,index)=>({id:match[1],markup:match[0],index}));
    artistLink.lastIndex=0;
    const ordered=[...links].sort((a,b)=>{
      const aOrder=cardOrder.get(a.id), bOrder=cardOrder.get(b.id);
      if(aOrder === undefined && bOrder === undefined) return a.index-b.index;
      if(aOrder === undefined) return 1;
      if(bOrder === undefined) return -1;
      return aOrder-bOrder || a.index-b.index;
    });
    if(ordered.every((link,index)=>link === links[index])) return row;
    let next=0;
    const replacement=artistCell[0].replace(artistLink,()=>ordered[next++].markup);
    artistLink.lastIndex=0;
    return `${row.slice(0,artistCell.index)}${replacement}${row.slice(artistCell.index+artistCell[0].length)}`;
  });
  artistLink.lastIndex=0;
  return `${source.slice(0,countriesStart)}${countries}${source.slice(countriesEnd)}`;
}
async function injectMovementHighResolutionViewer(html) {
  let source=String(html || '');
  source=source
    .replace(/\s*<style\b[^>]*id=["']art-atlas-movement-highres-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n')
    .replace(/\s*<script\b[^>]*id=["']art-atlas-movement-highres-viewer["'][^>]*>[\s\S]*?<\/script>\s*/gi,'\n')
    .replace(/\s*<style\b[^>]*id=["']art-atlas-movement-card-zoom-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n')
    .replace(/\s*<script\b[^>]*id=["']art-atlas-movement-card-zoom-viewer["'][^>]*>[\s\S]*?<\/script>\s*/gi,'\n');
  const entries=await movementHighResolutionEntries();
  source=source.replace(/<img\b[^>]*>/gi,tag=>{
    if(/\bdata-art-atlas-highres=/i.test(tag)) return tag;
    const entry=entries.length && movementHighResolutionEntryForImage(tag,entries);
    if(!entry) return tag;
    return tag.replace(/\s*\/?>$/,match=>` data-art-atlas-highres="${escapeAttribute(entry.highRes)}" data-art-atlas-highres-title="${escapeAttribute([entry.artist,entry.title].filter(Boolean).join(' · '))}"${match}`);
  });
  return /<\/body>/i.test(source) ? source.replace(/<\/body>/i,`${movementCardDoubleClickZoom}\n</body>`) : `${source}\n${movementCardDoubleClickZoom}`;
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
const uHangulDocumentToolbar = `<div data-uhangul-document-toolbar role="group" aria-label="이름 표기 방식" style="position:fixed!important;top:14px!important;left:16px!important;z-index:2147483647!important;display:flex!important;gap:4px!important"><button type="button" data-uh-mode="korean" data-uh-local-mode="korean" aria-label="한국어" title="한국어" style="display:grid!important;width:28px!important;height:28px!important;place-items:center!important;padding:0!important;border:1px solid #aebba8!important;border-radius:50%!important;background:#fffdf8!important;color:#425043!important;font:700 10px/1 'Noto Sans KR',sans-serif!important;cursor:pointer!important">한</button><button type="button" data-uh-mode="uhangul" data-uh-local-mode="uhangul" aria-label="uHangul" title="uHangul" style="display:grid!important;width:28px!important;height:28px!important;place-items:center!important;padding:0!important;border:1px solid #aebba8!important;border-radius:50%!important;background:#fffdf8!important;color:#425043!important;font:700 10px/1 'Noto Sans KR',sans-serif!important;cursor:pointer!important">u</button><button type="button" data-uh-mode="original" data-uh-local-mode="original" aria-label="국제 표기" title="국제 표기" style="display:grid!important;width:28px!important;height:28px!important;place-items:center!important;padding:0!important;border:1px solid #aebba8!important;border-radius:50%!important;background:#fffdf8!important;color:#425043!important;font:700 10px/1 'Noto Sans KR',sans-serif!important;cursor:pointer!important">표</button></div>`;
function injectUHangulDocumentIntegration(html) {
  const source=String(html || '');
  const styleLink=uHangulDocumentIntegration.split('\n')[0];
  const runtimeScript=uHangulDocumentIntegration.split('\n')[1];
  const existingStyle=/<link\b[^>]*data-uhangul-integration[^>]*>/i;
  let documentHtml=existingStyle.test(source)
    ? source.replace(existingStyle,styleLink)
    : (/<\/head>/i.test(source) ? source.replace(/<\/head>/i,`${styleLink}\n</head>`) : `${styleLink}\n${source}`);
  const existingRuntime=/<script\b[^>]*data-uhangul-integration[^>]*>[\s\S]*?<\/script>/i;
  if (existingRuntime.test(documentHtml)) documentHtml=documentHtml.replace(existingRuntime,runtimeScript);
  const existingToolbar=/<div\b(?=[^>]*data-uhangul-document-toolbar)[\s\S]*?<\/div>/i;
  documentHtml=documentHtml.replace(existingToolbar,'');
  documentHtml=documentHtml.replace(/<div\b(?=[^>]*data-uhangul-corner-bar)[\s\S]*?<\/div>/i,'').replace(/<button\b(?=[^>]*data-uhangul-corner-button)[\s\S]*?<\/button>/i,'');
  documentHtml=documentHtml.replace(/\n?<a\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-movement-wiki-button\b)[^>]*>[\s\S]*?<\/a>/i,'');
  documentHtml=/<body\b[^>]*>/i.test(documentHtml) ? documentHtml.replace(/<body\b[^>]*>/i,match=>`${match}\n${uHangulDocumentToolbar}`) : `${uHangulDocumentToolbar}\n${documentHtml}`;
  if (existingRuntime.test(documentHtml)) return documentHtml;
  return /<\/body>/i.test(documentHtml) ? documentHtml.replace(/<\/body>/i,`${runtimeScript}\n</body>`) : `${documentHtml}\n${runtimeScript}`;
}
function injectMovementArtistLinkStyle(html) {
  if (/id=["']art-atlas-artist-link-style["']/i.test(html)) return html;
  const style=`<style id="art-atlas-artist-link-style">\n${movementArtistLinkStyle}\n</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${html}`;
}
function injectMovementWikipediaHeading(html, movementName='', movementLabel='') {
  let output=String(html || '').replace(/\n?<a\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-movement-wiki-button\b)[^>]*>[\s\S]*?<\/a>/i,'');
  const wikiName=String(movementName || '').trim();
  const label=String(movementLabel || movementName || '').trim();
  if(!wikiName || !label || /data-art-atlas-movement-wiki-ready/i.test(output)) return output;
  const href=`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiName)}`;
  const style='<style id="art-atlas-movement-wiki-title-style" data-art-atlas-movement-wiki-ready>.art-atlas-movement-wiki-title{color:inherit;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.18em}.art-atlas-movement-wiki-title:hover{filter:brightness(.82)}</style>';
  output=/<\/head>/i.test(output) ? output.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${output}`;
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
      return `<a class="art-atlas-artist-link" href="../../index.html?artist=${encodeURIComponent(entry.id)}" target="_blank" rel="noopener" data-artist-id="${escapeAttribute(entry.id)}" data-uh-original="${escapeAttribute(entry.original)}" data-uh-korean="${escapeAttribute(entry.korean)}" data-uh-display-korean="${escapeAttribute(entry.displayKorean || entry.name || entry.korean)}" data-uh-list-korean="${escapeAttribute(entry.listKorean || name)}" title="${escapeAttribute(entry.korean || entry.name)} 연표로 이동">${name}</a>${particle}`;
    });
  }).join('');
  return Buffer.from(injectMovementArtistLinkStyle(html),'utf8');
}
function movementDocumentNeedsSetup(buffer) {
  const html=Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  return !(/<link\b[^>]*data-uhangul-integration/i.test(html)
    && /<script\b[^>]*data-uhangul-integration/i.test(html)
    && /data-uhangul-document-toolbar/i.test(html)
    && !/data-uhangul-corner-bar|data-uhangul-corner-button|art-atlas-movement-wiki-button/i.test(html)
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
function applyCors(req, res) {
  const origin=String(req.headers.origin || '');
  const allowed=new Set(['http://localhost:4173','http://127.0.0.1:4173','null']);
  if(allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  }
}
  return {
    migrationExport, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm,
    movementDocumentDir, movementDocumentName, movementDocumentSlot, movementDocumentRelative, readMovementDocuments, writeMovementDocuments, removeMovementDocument, refreshMovementDocumentLinks, saveMovementDocumentHtml,
    normalizeMovementCardPresentation, synchronizeMovementCountryTableArtistOrder, linkMovementDocumentArtists, injectUHangulDocumentIntegration,
    injectMovementArtworkMovementLabels, injectMovementCountryCardContexts, injectMovementPioneerContext, movementDocumentPioneerContextKey, injectMovementWikipediaHeading, injectMovementStickyTitle, injectMovementHighResolutionViewer,
    saveLocalArtworkImage, saveTopicArtwork, replaceTopicArtworkImage, deleteTopicArtwork, readMovementSectionLinks, saveMovementSectionLinks, applyCors,
    movementPioneerContexts
  };
};
