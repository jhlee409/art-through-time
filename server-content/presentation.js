module.exports = function install(context) {
  const { fs, path, URL, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists, thumbnailLocation, makePngUnderStorageLimit, assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument, highResolutionLocation, highResolutionArtistNameOverrides, commonHighResolutionArtistName, safeFileSegment, highResolutionFileBase, removeHighResolutionFiles, migrationExport, publicRootFiles, publicDataFiles, publicPathPrefixes, isPublicStaticPath, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, safeUploadId, uploadTypes, movementDocumentDir, movementDocumentIndex, movementDocumentName, movementDocumentSlot, readMovementDocuments, writeMovementDocuments, movementDocumentFileStem, movementDocumentRelative, isMovementDocumentRelative } = context;
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
const movementCardDoubleClickZoom = `<style id="art-atlas-movement-card-zoom-style">.art-atlas-movement-card-zoom{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;box-sizing:border-box;overflow:hidden;padding:2vh 2vw;background:rgba(5,7,10,.9);cursor:zoom-out}.art-atlas-movement-card-zoom img{display:block;flex:none;max-width:none;max-height:none;object-fit:contain;box-shadow:0 18px 55px rgba(0,0,0,.55);cursor:zoom-out;user-select:none;-webkit-user-drag:none}</style><script id="art-atlas-movement-card-zoom-viewer">(function(){if(window.__artAtlasMovementCardZoom)return;window.__artAtlasMovementCardZoom=true;var overlayId='art-atlas-movement-card-zoom',fitViewer=null;function close(){var overlay=document.getElementById(overlayId);if(overlay)overlay.remove();if(fitViewer)window.removeEventListener('resize',fitViewer);fitViewer=null;}document.addEventListener('dblclick',function(event){var open=document.getElementById(overlayId);if(open){if(event.target&&event.target.closest&&event.target.closest('#'+overlayId)){event.preventDefault();event.stopPropagation();close();}return;}var image=event.target&&event.target.closest&&event.target.closest('article.movement-work-card .movement-work-image img,article.card .movement-work-image img');if(!image)return;event.preventDefault();event.stopPropagation();var overlay=document.createElement('div'),zoomed=document.createElement('img');overlay.id=overlayId;overlay.className=overlayId;overlay.title='두 번 클릭하여 닫기';zoomed.src=image.dataset.artAtlasHighres||image.currentSrc||image.src;zoomed.alt=image.alt||'';zoomed.draggable=false;fitViewer=function(){if(!zoomed.naturalWidth||!zoomed.naturalHeight)return;var maxWidth=Math.max(1,window.innerWidth*.96),maxHeight=Math.max(1,window.innerHeight*.96),scale=Math.min(maxWidth/zoomed.naturalWidth,maxHeight/zoomed.naturalHeight);zoomed.style.width=Math.max(1,Math.round(zoomed.naturalWidth*scale))+'px';zoomed.style.height=Math.max(1,Math.round(zoomed.naturalHeight*scale))+'px';};zoomed.addEventListener('load',fitViewer,{once:true});overlay.appendChild(zoomed);document.body.appendChild(overlay);window.addEventListener('resize',fitViewer);if(zoomed.complete)fitViewer();},true);})();</script>`;
const movementCardInteractiveZoom = `<style id="art-atlas-movement-card-zoom-style">
article.movement-work-card .movement-work-image img,article.card .movement-work-image img,.movement-history-stage .movement-work-image img{cursor:zoom-in}
.art-atlas-movement-card-zoom{position:fixed;inset:0;z-index:2147483647;box-sizing:border-box;overflow:hidden;background:rgba(5,7,10,.94);touch-action:none}
.art-atlas-movement-card-zoom-stage{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none;user-select:none}
.art-atlas-movement-card-zoom-stage.dragging{cursor:grabbing}
.art-atlas-movement-card-zoom img{position:absolute;top:50%;left:50%;display:block;max-width:none;max-height:none;object-fit:contain;transform:translate(-50%,-50%);box-shadow:0 18px 55px rgba(0,0,0,.55);pointer-events:none;user-select:none;-webkit-user-drag:none}
.art-atlas-movement-card-zoom-controls{position:absolute;top:16px;right:16px;z-index:2;display:flex;gap:7px;padding:7px;border:1px solid #4b555f;border-radius:8px;background:rgba(18,22,27,.92)}
.art-atlas-movement-card-zoom-controls button{display:grid;width:38px;height:38px;place-items:center;padding:0;border:1px solid #68737d;border-radius:50%;background:#12161b;color:#f2efe9;font:700 1.25rem/1 system-ui,sans-serif;cursor:pointer}
.art-atlas-movement-card-zoom-controls button:hover,.art-atlas-movement-card-zoom-controls button:focus-visible{border-color:#d6a74a;color:#efc875;outline:none}
</style><script id="art-atlas-movement-card-zoom-viewer">(function(){
if(window.__artAtlasMovementCardInteractiveZoom)return;
window.__artAtlasMovementCardInteractiveZoom=true;
var overlayId='art-atlas-movement-card-zoom',resizeViewer=null,keyViewer=null;
function close(){var overlay=document.getElementById(overlayId);if(overlay)overlay.remove();if(resizeViewer)window.removeEventListener('resize',resizeViewer);if(keyViewer)window.removeEventListener('keydown',keyViewer);resizeViewer=null;keyViewer=null;}
function openViewer(sourceImage){
  var overlay=document.createElement('div'),stage=document.createElement('div'),zoomed=document.createElement('img'),controls=document.createElement('div');
  overlay.id=overlayId;overlay.className='art-atlas-movement-card-zoom';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','작품 이미지 확대 보기');
  stage.className='art-atlas-movement-card-zoom-stage';controls.className='art-atlas-movement-card-zoom-controls';
  controls.innerHTML='<button type="button" data-action="out" aria-label="축소" title="축소">−</button><button type="button" data-action="in" aria-label="확대" title="확대">＋</button><button type="button" data-action="reset" aria-label="화면 맞춤" title="화면 맞춤">↺</button><button type="button" data-action="close" aria-label="닫기" title="닫기">×</button>';
  zoomed.src=sourceImage.dataset.artAtlasHighres||sourceImage.currentSrc||sourceImage.src;zoomed.alt=sourceImage.alt||'';zoomed.draggable=false;
  var zoom=1,x=0,y=0,drag=null;
  function draw(){
    if(!zoomed.naturalWidth||!zoomed.naturalHeight)return;
    var base=Math.min(stage.clientWidth*.90/zoomed.naturalWidth,stage.clientHeight*.90/zoomed.naturalHeight),width=Math.max(1,zoomed.naturalWidth*base*zoom),height=Math.max(1,zoomed.naturalHeight*base*zoom),maxX=Math.abs(width-stage.clientWidth)/2,maxY=Math.abs(height-stage.clientHeight)/2;
    x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));zoomed.style.width=width+'px';zoomed.style.height=height+'px';zoomed.style.transform='translate(calc(-50% + '+x+'px), calc(-50% + '+y+'px))';
  }
  function setZoom(next,clientX,clientY){var old=zoom;zoom=Math.max(1,Math.min(8,next));var ratio=zoom/old,rect=stage.getBoundingClientRect(),pointX=(typeof clientX==='number'?clientX:rect.left+stage.clientWidth/2)-rect.left-stage.clientWidth/2,pointY=(typeof clientY==='number'?clientY:rect.top+stage.clientHeight/2)-rect.top-stage.clientHeight/2;x=x*ratio+pointX*(1-ratio);y=y*ratio+pointY*(1-ratio);draw();}
  function reset(){zoom=1;x=0;y=0;draw();}
  zoomed.addEventListener('load',draw,{once:true});
  stage.addEventListener('pointerdown',function(event){if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:x,startY:y};stage.setPointerCapture(event.pointerId);stage.classList.add('dragging');});
  stage.addEventListener('pointermove',function(event){if(!drag||event.pointerId!==drag.id)return;x=drag.startX+event.clientX-drag.x;y=drag.startY+event.clientY-drag.y;draw();});
  function stopDrag(event){if(!drag||event.pointerId!==drag.id)return;drag=null;stage.classList.remove('dragging');}
  stage.addEventListener('pointerup',stopDrag);stage.addEventListener('pointercancel',stopDrag);
  stage.addEventListener('wheel',function(event){event.preventDefault();setZoom(zoom*(event.deltaY<0?1.15:1/1.15),event.clientX,event.clientY);},{passive:false});
  controls.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();var action=event.target.closest('button')&&event.target.closest('button').dataset.action;if(action==='in')setZoom(zoom*1.25);else if(action==='out')setZoom(zoom/1.25);else if(action==='reset')reset();else if(action==='close')close();});
  overlay.appendChild(stage);stage.appendChild(zoomed);overlay.appendChild(controls);document.body.appendChild(overlay);
  resizeViewer=draw;keyViewer=function(event){if(event.key==='Escape')close();};window.addEventListener('resize',resizeViewer);window.addEventListener('keydown',keyViewer);if(zoomed.complete)draw();controls.querySelector('[data-action="close"]').focus();
}
document.addEventListener('dblclick',function(event){var active=document.getElementById(overlayId);if(active){if(event.target&&event.target.closest&&event.target.closest('.art-atlas-movement-card-zoom-controls'))return;if(event.target&&event.target.closest&&event.target.closest('#'+overlayId)){event.preventDefault();event.stopPropagation();close();}return;}var image=event.target&&event.target.closest&&event.target.closest('article.movement-work-card .movement-work-image img,article.card .movement-work-image img,.movement-history-stage .movement-work-image img');if(!image)return;event.preventDefault();event.stopPropagation();openViewer(image);},true);
})();</script>`;
const movementContentLayoutStyle = '<style id="art-atlas-movement-content-layout-style">body{--art-atlas-document-gutter:clamp(20px,3vw,48px)}header.hero>.wrap,main>section>.wrap{width:100%;max-width:none;margin-left:0;margin-right:0;padding-left:var(--art-atlas-document-gutter);padding-right:var(--art-atlas-document-gutter)}.hero p,.hero-summary,.hero-thesis,.lead{max-width:none}main>section:not(#movement-learning-guide)>.wrap>h2,main>section:not(#movement-learning-guide)>h2{margin:0 0 1.15rem;font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.9rem,3.4vw,3.1rem);line-height:1.18}main>section:not(#movement-learning-guide)>.wrap>h3,main>section:not(#movement-learning-guide)>h3,.movement-enhancement .art-atlas-submovement-heading{font-size:clamp(1.3rem,2.25vw,1.75rem);line-height:1.32}.movement-enhancement .art-atlas-submovement-heading{margin-top:2.1rem;margin-bottom:.7rem}.movement-enhancement .art-atlas-submovement-heading+.movement-work-grid{margin-top:0}main>section:not(#movement-learning-guide)>.wrap>h4,main>section:not(#movement-learning-guide)>h4{font-size:1.12rem;line-height:1.42;margin:1.5rem 0 .5rem}main>section:not(#movement-learning-guide)>.wrap>p:not(.work-meta):not(.movement-selection-reason),main>section:not(#movement-learning-guide)>p:not(.work-meta):not(.movement-selection-reason){max-width:none;font-size:1.08rem;line-height:1.8}main>section:not(#movement-learning-guide)>.wrap>p:not(.work-meta):not(.movement-selection-reason)~p,main>section:not(#movement-learning-guide)>p:not(.work-meta):not(.movement-selection-reason)~p{font-size:1rem;line-height:1.75}.table-wrap,main>section>.wrap>table,main>section>table{width:100%;max-width:none}.table-wrap table,main>section>.wrap>table,main>section>table{width:100%}@media(max-width:720px){body{--art-atlas-document-gutter:18px}}</style>';
const movementCardImageFitStyle = '<style id="art-atlas-movement-card-image-fit-style">.movement-enhancement .movement-work-image>img{width:90%!important;height:90%!important;max-width:90%!important;max-height:90%!important;object-fit:contain!important}</style>';
function injectMovementContentLayout(html) {
  const source=String(html || '').replace(/\s*<style\b[^>]*id=["']art-atlas-movement-content-layout-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n').replace(/\s*<style\b[^>]*id=["']art-atlas-movement-card-image-fit-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n');
  const styles=`${movementContentLayoutStyle}\n${movementCardImageFitStyle}`;
  return /<\/head>/i.test(source) ? source.replace(/<\/head>/i,`${styles}\n</head>`) : `${styles}\n${source}`;
}
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
  source=source.replace(/<article\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-card|card)\b[^"']*["'])[\s\S]*?<\/article>/gi,card=>{
    const bodyOpen=/<div\b(?=[^>]*\bclass=["'][^"']*\b(?:movement-work-body|caption)\b[^"']*["'])[^>]*>/i.exec(card);
    if(!bodyOpen) return card;
    const bodyEnd=matchingHtmlElementEnd(card,bodyOpen.index,'div'), bodyStart=bodyOpen.index+bodyOpen[0].length, closeStart=bodyEnd-6;
    if(bodyEnd<0 || closeStart<bodyStart) return card;
    let body=card.slice(bodyStart,closeStart);
    const withoutLabel=body.replace(/^\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmini-label\b)[^>]*>[\s\S]*?<\/span>\s*/i,'');
    let normalized=withoutLabel;
    while(/<div class="movement-card-heading-row">\s*<div class="movement-card-heading-row">/i.test(normalized)) normalized=normalized.replace(/<div class="movement-card-heading-row">\s*<div class="movement-card-heading-row">/gi,'<div class="movement-card-heading-row">').replace(/<\/div>\s*<\/div>(?=\s*<p\b(?=[^>]*\bclass=["'][^"']*\bmovement-selection-reason\b))/gi,'</div>');
    const titled=normalized.replace(/(<h3\b[^>]*>)([\s\S]*?)(<\/h3>)/i,(_,headingOpen,title,headingClose)=>{
      const activityRegion=title.match(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-activity-region\b)[^>]*>[\s\S]*?<\/span>\s*/i)?.[0] || '';
      const cleanTitle=title
        .replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-title-tag\b)[^>]*>[\s\S]*?<\/span>\s*/gi,'')
        .replace(/\s*<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-card-activity-region\b)[^>]*>[\s\S]*?<\/span>\s*/gi,'');
      return `${headingOpen}${cleanTitle}<span class="movement-card-title-tag"> · ${escapeAttribute(movement)}</span>${activityRegion}${headingClose}`;
    });
    const withHeadingRow=/\bmovement-card-heading-row\b/i.test(titled) ? titled : titled.replace(/(<h3\b[^>]*>[\s\S]*?<\/h3>)\s*(<p\b(?=[^>]*\bclass=["'][^"']*\bwork-meta\b)[^>]*>[\s\S]*?<\/p>)/i,'<div class="movement-card-heading-row">$1$2</div>');
    const withReasonColons=withHeadingRow.replace(/<strong>\s*(선정 이유|더 볼 이유)\s*:?\s*<\/strong>/gi,'<strong>$1:</strong>');
    return card.slice(0,bodyStart)+withReasonColons+card.slice(closeStart);
  });
  const style='<style id="art-atlas-movement-card-presentation-style">.movement-card-title-tag,.movement-card-activity-region{color:#9aa5af;font-size:.78em;font-weight:600;white-space:nowrap}.movement-card-heading-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:.45rem;margin:0 0 .85rem}.movement-card-heading-row h3{min-width:0;margin:0!important}.movement-card-heading-row .work-meta{margin:.08rem 0 0!important;text-align:right;white-space:nowrap}</style>';
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
  for(const row of source.slice(countriesStart,countriesEnd).matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const cells=[...row[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell=>movementPlainText(cell[1]));
    if(cells.length < 2) continue;
    const [country='', category='']=cells[0].split(/\s*(?:—|–)\s*/,2);
    const attrs=tagAttrs(`<tr${row[1]}>`), countryKey=movementCountryLabelKey(country), categoryKey=movementCountryLabelKey(category);
    if(!countryKey || !cells[1]) continue;
    contexts.push({country:country.trim(),category:category.trim(),feature:cells[1].replace(/^핵심 특징\s*/,'').trim(),countryKey,categoryKey,categoryId:attrs['data-art-atlas-category-id'] || '',developmentId:attrs['data-art-atlas-development-id'] || '',learningNodeId:attrs['data-art-atlas-learning-node-id'] || ''});
  }
  return contexts;
}
function injectMovementCountryCardContexts(html) {
  let source=String(html || '')
    .replace(/\s*<style\b[^>]*id=["']art-atlas-movement-country-card-context-style["'][^>]*>[\s\S]*?<\/style>\s*/gi,'\n');
  const contexts=movementCountryCardContexts(source);
  if(!contexts.length) return source;
  source=source.replace(/<section\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-group\b[^"']*["'])[^>]*>[\s\S]*?<\/section>/gi,group=>{
    const groupAttrs=tagAttrs(group.match(/^<section\b[^>]*>/i)?.[0] || ''), heading=group.match(/<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '';
    // 학습 지도 묶음은 정식 국가별 범주가 아니라 각 기준점의 고유한 제목을 사용한다.
    // 일반 국가·범주 맥락 주입이 그 제목을 다시 해석하거나 덮어쓰지 않게 원문을 유지한다.
    if(groupAttrs['data-art-atlas-learning-node-id']) return group;
    const existingTitle=heading.match(/<span\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-title\b)[^>]*>([\s\S]*?)<\/span>/i)?.[1] || heading.split(/<span\b(?=[^>]*\bclass=["'][^"']*\bmovement-country-card-context\b)/i)[0];
    const groupName=movementPlainText(group.match(/\bdata-art-atlas-submovement=["']([^"']+)["']/i)?.[1] || existingTitle);
    const groupKey=movementCountryLabelKey(groupName);
    const learningNodeId=groupAttrs['data-art-atlas-learning-node-id'] || '';
    const context=contexts.find(item=>learningNodeId && item.learningNodeId===learningNodeId) || contexts.find(item=>item.developmentId && item.developmentId===groupAttrs['data-art-atlas-development-id']) || contexts.find(item=>item.categoryId && item.categoryId===groupAttrs['data-art-atlas-category-id']) || contexts.find(item=>item.categoryKey===groupKey) || contexts.find(item=>item.countryKey===groupKey);
    if(!context) return group;
    return group.replace(/(<h3\b(?=[^>]*\bclass=["'][^"']*\bart-atlas-submovement-heading\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/h3>)/i,(_,open,title,close)=>{
      const titleText=learningNodeId ? groupName : (context.category || groupName);
      const region=!learningNodeId && context.country ? `<span class="movement-country-card-context-region">${escapeAttribute(context.country)}</span>` : '';
      return `${open}<span class="art-atlas-submovement-title">${escapeAttribute(titleText)}</span><span class="movement-country-card-context">${region}<span class="movement-country-card-context-feature"><b>핵심 특징</b> ${escapeAttribute(context.feature)}</span></span>${close}`;
    });
  });
  const style='<style id="art-atlas-movement-country-card-context-style">.movement-enhancement{--art-atlas-enhancement-edge-gutter:clamp(18px,3vw,26px)}.movement-enhancement>h3,.movement-enhancement>p.enhancement-intro,.movement-enhancement>.wrap>h3,.movement-enhancement>.wrap>p.enhancement-intro{width:calc(100vw - (var(--art-atlas-enhancement-edge-gutter)*2));max-width:none;margin-left:calc(50% - 50vw + var(--art-atlas-enhancement-edge-gutter));margin-right:calc(50% - 50vw + var(--art-atlas-enhancement-edge-gutter));box-sizing:border-box;text-align:left}.movement-enhancement .art-atlas-submovement-heading{display:flex;width:100vw;max-width:none;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);padding-left:var(--art-atlas-enhancement-edge-gutter);padding-right:2vw;box-sizing:border-box;flex-wrap:wrap;align-items:baseline;gap:.45rem;text-align:left}.movement-enhancement .art-atlas-submovement-title{display:block;flex:0 0 100%;width:100%;text-align:left}.movement-enhancement .movement-country-card-context{display:flex;flex:1 1 100%;width:100%;flex-wrap:wrap;gap:.32rem .7rem;align-items:baseline;color:#aeb9c3;font-size:.912rem;font-weight:500;line-height:1.55}.movement-enhancement .movement-country-card-context b{color:#e6c98d;font-size:.92em;font-weight:800}.movement-enhancement .movement-country-card-context-region{white-space:nowrap}.movement-enhancement .movement-country-card-context-feature{min-width:12rem}</style>';
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
  // The high-resolution lookup only enriches a document.  A missing or
  // temporarily unreadable artists payload must never make the document
  // itself unavailable.
  let entries=[];
  try {
    entries=await movementHighResolutionEntries();
  } catch(error) {
    console.warn('Movement high-resolution annotations disabled:',error?.message || error);
  }
  source=source.replace(/<img\b[^>]*>/gi,tag=>{
    if(/\bdata-art-atlas-highres=/i.test(tag)) return tag;
    const entry=entries.length && movementHighResolutionEntryForImage(tag,entries);
    if(!entry) return tag;
    return tag.replace(/\s*\/?>$/,match=>` data-art-atlas-highres="${escapeAttribute(entry.highRes)}" data-art-atlas-highres-title="${escapeAttribute([entry.artist,entry.title].filter(Boolean).join(' · '))}"${match}`);
  });
  return /<\/body>/i.test(source) ? source.replace(/<\/body>/i,`${movementCardInteractiveZoom}\n</body>`) : `${source}\n${movementCardInteractiveZoom}`;
}
  Object.assign(context, { escapeRegex, escapeAttribute, htmlDecode, tagAttrs, normalizeMovementImageReference, movementHighResolutionSearchText, movementHighResolutionEntries, movementHighResolutionEntryForImage, movementHighResolutionViewer, movementCardDoubleClickZoom, movementCardInteractiveZoom, movementContentLayoutStyle, movementCardImageFitStyle, injectMovementContentLayout, movementCardDocumentName, normalizeMovementCardPresentation, movementPlainText, movementCountryLabelKey, movementCountryCardContexts, injectMovementCountryCardContexts, injectMovementStickyTitle, matchingHtmlElementEnd, synchronizeMovementCountryTableArtistOrder, injectMovementHighResolutionViewer });
  return context;
};
