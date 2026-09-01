module.exports = function install(context) {
  const { fs, path, URL, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists, thumbnailLocation, makePngUnderStorageLimit, assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument, highResolutionLocation, highResolutionArtistNameOverrides, commonHighResolutionArtistName, safeFileSegment, highResolutionFileBase, removeHighResolutionFiles, migrationExport, publicRootFiles, publicDataFiles, publicPathPrefixes, isPublicStaticPath, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, safeUploadId, uploadTypes, movementDocumentDir, movementDocumentIndex, movementDocumentName, movementDocumentSlot, readMovementDocuments, writeMovementDocuments, movementDocumentFileStem, movementDocumentRelative, isMovementDocumentRelative, escapeRegex, escapeAttribute, htmlDecode, tagAttrs, normalizeMovementImageReference, movementHighResolutionSearchText, movementHighResolutionEntries, movementHighResolutionEntryForImage, movementHighResolutionViewer, movementCardDoubleClickZoom, movementCardInteractiveZoom, movementContentLayoutStyle, movementCardImageFitStyle, injectMovementContentLayout, movementCardDocumentName, normalizeMovementCardPresentation, movementPlainText, movementCountryLabelKey, movementCountryCardContexts, injectMovementCountryCardContexts, injectMovementStickyTitle, matchingHtmlElementEnd, synchronizeMovementCountryTableArtistOrder, injectMovementHighResolutionViewer, compactArtistName, movementArtistAliasOverrides, movementArtistAliases, movementArtistLinkEntries, compactMovementName, movementNameKo, serverMovementSpec, serverArtistMovementDisplayRules, serverArtistMovementClassificationOverrides, serverArtistMovementFallbacks, serverArtistPrimaryMovement, serverArtistMovementDisplayLabel, stripMovementArtworkMovementLabels, movementCardArtist, normalizedMovementMiniLabelText, redundantArtistMiniLabelPattern, stripRedundantArtistMiniLabel, injectMovementLabelIntoCard, injectMovementArtworkMovementLabels, movementArtistLinkStyle, movementWikipediaTermLinkStyle, movementWikipediaTermLinks, uHangulDocumentIntegration, movementPioneerContexts, movementPioneerDocumentContextByName } = context;
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
function injectMovementWikipediaTermLinks(html) {
  let output=String(html || '');
  if(/data-art-atlas-wiki-term-links-ready/i.test(output)) return output;
  const aliases=movementWikipediaTermLinks.flatMap((entry,index)=>entry.terms.map(term=>({term,index,url:entry.url})))
    .filter(item=>item.term)
    .sort((left,right)=>right.term.length-left.term.length || left.term.localeCompare(right.term,'ko-KR'));
  if(!aliases.length) return output;
  const style=`<style id="art-atlas-wiki-term-link-style" data-art-atlas-wiki-term-links-ready>\n${movementWikipediaTermLinkStyle}\n</style>`;
  output=/<\/head>/i.test(output) ? output.replace(/<\/head>/i,`${style}\n</head>`) : `${style}\n${output}`;
  const byAlias=new Map(aliases.map(item=>[item.term.normalize('NFC').toLocaleLowerCase('ko-KR'),item]));
  const particles='에서|으로|부터|까지|처럼|보다|에게|께서|은|는|이|가|을|를|의|와|과|도|에|로|만';
  const pattern=new RegExp(`(?<![A-Za-z0-9가-힣])(${aliases.map(item=>escapeRegex(item.term)).join('|')})(${particles})?(?=$|[^A-Za-z0-9가-힣])`,'giu');
  const protectedPattern=/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<title\b[\s\S]*?<\/title>|<a\b[\s\S]*?<\/a>|<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>|<textarea\b[\s\S]*?<\/textarea>|<[^>]+>)/gi;
  const linkedEntryIndexes=new Set();
  output=output.split(protectedPattern).map(part=>{
    if(!part || isProtectedMovementHtmlChunk(part)) return part;
    return part.replace(pattern,(match,term,particle='')=>{
      const entry=byAlias.get(String(term || '').normalize('NFC').toLocaleLowerCase('ko-KR'));
      if(!entry || linkedEntryIndexes.has(entry.index)) return match;
      linkedEntryIndexes.add(entry.index);
      const label=term;
      return `<a class="art-atlas-wiki-term-link" href="${escapeAttribute(entry.url)}" target="_blank" rel="noopener" title="${escapeAttribute(label)} 위키피디아">${label}</a>${particle}`;
    });
  }).join('');
  return output;
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
  await Promise.all(entries.filter(entry=>entry.isFile() && /\.html$/i.test(entry.name)).map(async entry=>{
    const file=path.join(movementDocumentDir,entry.name);
    const before=await fs.readFile(file);
    if (!movementDocumentNeedsSetup(before)) return;
    const after=await linkMovementDocumentArtists(injectUHangulDocumentIntegration(before), linkEntries);
    if(!before.equals(after)) { await fs.writeFile(file,after); changed=true; }
  }));
  if (changed) syncPersonNameDictionary();
}
const storedMovementDocumentControlsReady=ensureStoredMovementDocumentControls().catch(error=>console.error('Could not add uHangul controls to movement documents:',error.message));
  Object.assign(context, { movementDocumentPioneerContextKey, movementPioneerContextForTitle, injectMovementPioneerContext, uHangulDocumentToolbar, injectUHangulDocumentIntegration, injectMovementArtistLinkStyle, injectMovementWikipediaHeading, injectMovementWikipediaTermLinks, stripMovementArtistLinks, isProtectedMovementHtmlChunk, linkMovementDocumentArtists, movementDocumentNeedsSetup, ensureStoredMovementDocumentControls, storedMovementDocumentControlsReady });
  return context;
};
