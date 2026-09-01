module.exports = function install(context) {
  const { fs, path, URL, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists, thumbnailLocation, makePngUnderStorageLimit, assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument, highResolutionLocation, highResolutionArtistNameOverrides, commonHighResolutionArtistName, safeFileSegment, highResolutionFileBase, removeHighResolutionFiles, migrationExport, publicRootFiles, publicDataFiles, publicPathPrefixes, isPublicStaticPath, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, safeUploadId, uploadTypes, movementDocumentDir, movementDocumentIndex, movementDocumentName, movementDocumentSlot, readMovementDocuments, writeMovementDocuments, movementDocumentFileStem, movementDocumentRelative, isMovementDocumentRelative, escapeRegex, escapeAttribute, htmlDecode, tagAttrs, normalizeMovementImageReference, movementHighResolutionSearchText, movementHighResolutionEntries, movementHighResolutionEntryForImage, movementHighResolutionViewer, movementCardDoubleClickZoom, movementCardInteractiveZoom, movementContentLayoutStyle, movementCardImageFitStyle, injectMovementContentLayout, movementCardDocumentName, normalizeMovementCardPresentation, movementPlainText, movementCountryLabelKey, movementCountryCardContexts, injectMovementCountryCardContexts, injectMovementStickyTitle, matchingHtmlElementEnd, synchronizeMovementCountryTableArtistOrder, injectMovementHighResolutionViewer, compactArtistName, movementArtistAliasOverrides, movementArtistAliases, movementArtistLinkEntries, compactMovementName, movementNameKo, serverMovementSpec, serverArtistMovementDisplayRules, serverArtistMovementClassificationOverrides, serverArtistMovementFallbacks, serverArtistPrimaryMovement, serverArtistMovementDisplayLabel, stripMovementArtworkMovementLabels, movementCardArtist, normalizedMovementMiniLabelText, redundantArtistMiniLabelPattern, stripRedundantArtistMiniLabel, injectMovementLabelIntoCard, injectMovementArtworkMovementLabels, movementArtistLinkStyle, movementWikipediaTermLinkStyle, movementWikipediaTermLinks, uHangulDocumentIntegration, movementPioneerContexts, movementPioneerDocumentContextByName, movementDocumentPioneerContextKey, movementPioneerContextForTitle, injectMovementPioneerContext, uHangulDocumentToolbar, injectUHangulDocumentIntegration, injectMovementArtistLinkStyle, injectMovementWikipediaHeading, injectMovementWikipediaTermLinks, stripMovementArtistLinks, isProtectedMovementHtmlChunk, linkMovementDocumentArtists, movementDocumentNeedsSetup, ensureStoredMovementDocumentControls, storedMovementDocumentControlsReady } = context;
function movementDocumentSyncState(html) {
  return /<html\b[^>]*\bdata-art-atlas-sync-state=["']([^"']+)["']/i.exec(String(html || ''))?.[1] || '';
}
async function saveMovementDocumentHtml(name, slot, html) {
  const safeName=movementDocumentName(name), safeSlot=movementDocumentSlot(slot), source=String(html || '');
  if(!source.trim()) throw new Error('The HTML document is empty');
  if(Buffer.byteLength(source,'utf8') > jsonRequestBodyLimit) throw new Error('The HTML document exceeds the 12 MB limit');
  const data=await readMovementDocuments(), relative=data.documents?.[safeName]?.[safeSlot];
  if(!relative || !isMovementDocumentRelative(relative)) throw new Error('There is no saved movement document');
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
async function removeMovementDocument(relative) { if(!isMovementDocumentRelative(relative)) return; await fs.unlink(path.join(root,relative)).catch(error => { if(error.code!=='ENOENT') throw error; }); }
async function refreshMovementDocumentLinks(name, slot) {
  const data=await readMovementDocuments(), relative=data.documents?.[name]?.[slot];
  if(!relative) throw new Error('There is no saved movement document');
  if(!isMovementDocumentRelative(relative)) throw new Error('Invalid movement document path');
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
  Object.assign(context, { movementDocumentSyncState, saveMovementDocumentHtml, removeMovementDocument, refreshMovementDocumentLinks });
  return context;
};
