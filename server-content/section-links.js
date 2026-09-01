module.exports = function install(context) {
  const { fs, path, URL, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists, thumbnailLocation, makePngUnderStorageLimit, assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument, highResolutionLocation, highResolutionArtistNameOverrides, commonHighResolutionArtistName, safeFileSegment, highResolutionFileBase, removeHighResolutionFiles, migrationExport, publicRootFiles, publicDataFiles, publicPathPrefixes, isPublicStaticPath, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, safeUploadId, uploadTypes, movementDocumentDir, movementDocumentIndex, movementDocumentName, movementDocumentSlot, readMovementDocuments, writeMovementDocuments, movementDocumentFileStem, movementDocumentRelative, isMovementDocumentRelative, escapeRegex, escapeAttribute, htmlDecode, tagAttrs, normalizeMovementImageReference, movementHighResolutionSearchText, movementHighResolutionEntries, movementHighResolutionEntryForImage, movementHighResolutionViewer, movementCardDoubleClickZoom, movementCardInteractiveZoom, movementContentLayoutStyle, movementCardImageFitStyle, injectMovementContentLayout, movementCardDocumentName, normalizeMovementCardPresentation, movementPlainText, movementCountryLabelKey, movementCountryCardContexts, injectMovementCountryCardContexts, injectMovementStickyTitle, matchingHtmlElementEnd, synchronizeMovementCountryTableArtistOrder, injectMovementHighResolutionViewer, compactArtistName, movementArtistAliasOverrides, movementArtistAliases, movementArtistLinkEntries, compactMovementName, movementNameKo, serverMovementSpec, serverArtistMovementDisplayRules, serverArtistMovementClassificationOverrides, serverArtistMovementFallbacks, serverArtistPrimaryMovement, serverArtistMovementDisplayLabel, stripMovementArtworkMovementLabels, movementCardArtist, normalizedMovementMiniLabelText, redundantArtistMiniLabelPattern, stripRedundantArtistMiniLabel, injectMovementLabelIntoCard, injectMovementArtworkMovementLabels, movementArtistLinkStyle, movementWikipediaTermLinkStyle, movementWikipediaTermLinks, uHangulDocumentIntegration, movementPioneerContexts, movementPioneerDocumentContextByName, movementDocumentPioneerContextKey, movementPioneerContextForTitle, injectMovementPioneerContext, uHangulDocumentToolbar, injectUHangulDocumentIntegration, injectMovementArtistLinkStyle, injectMovementWikipediaHeading, injectMovementWikipediaTermLinks, stripMovementArtistLinks, isProtectedMovementHtmlChunk, linkMovementDocumentArtists, movementDocumentNeedsSetup, ensureStoredMovementDocumentControls, storedMovementDocumentControlsReady, movementDocumentSyncState, saveMovementDocumentHtml, removeMovementDocument, refreshMovementDocumentLinks, uploadExtension, makeDisplayImage, makeLocalArtworkThumbnail, saveLocalArtworkImage, saveTopicArtwork, replaceTopicArtworkImage, deleteTopicArtwork, movementSectionLinkIds } = context;
function normalizedMovementSectionLinks(value) {
  const links = Array.isArray(value) ? value : [];
  return links.slice(0,40).flatMap(item => {
    try {
      const url = new URL(String(item?.url || item || '').trim());
      return ['http:','https:'].includes(url.protocol) ? [{url:url.href,...(item?.emphasized===true?{emphasized:true}:{})}] : [];
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
  Object.assign(context, { normalizedMovementSectionLinks, readMovementSectionLinks, saveMovementSectionLinks, applyCors });
  return context;
};
