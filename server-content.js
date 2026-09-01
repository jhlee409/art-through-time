/* Movement documents, local image uploads, and public static-file services. */
const {assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument} = require('./movement-sync-v1');

module.exports = function createContentService(deps) {
  const context = {
    ...deps,
    assertStableEditableStructure,
    synchronizeTableArtistOrder,
    validateCompleteDocument
  };
  [
    './server-content/foundation',
    './server-content/presentation',
    './server-content/artists',
    './server-content/integration',
    './server-content/documents',
    './server-content/uploads',
    './server-content/section-links'
  ].forEach(modulePath => require(modulePath)(context));

  const {
    migrationExport, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm,
    movementDocumentDir, movementDocumentName, movementDocumentSlot, movementDocumentRelative, readMovementDocuments, writeMovementDocuments, removeMovementDocument, refreshMovementDocumentLinks, saveMovementDocumentHtml,
    normalizeMovementCardPresentation, synchronizeMovementCountryTableArtistOrder, linkMovementDocumentArtists, injectUHangulDocumentIntegration,
    injectMovementArtworkMovementLabels, injectMovementCountryCardContexts, injectMovementPioneerContext, movementDocumentPioneerContextKey, injectMovementWikipediaHeading, injectMovementWikipediaTermLinks, injectMovementStickyTitle, injectMovementContentLayout, injectMovementHighResolutionViewer,
    saveLocalArtworkImage, saveTopicArtwork, replaceTopicArtworkImage, deleteTopicArtwork, readMovementSectionLinks, saveMovementSectionLinks, applyCors,
    movementPioneerContexts
  } = context;
  return {
    migrationExport, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm,
    movementDocumentDir, movementDocumentName, movementDocumentSlot, movementDocumentRelative, readMovementDocuments, writeMovementDocuments, removeMovementDocument, refreshMovementDocumentLinks, saveMovementDocumentHtml,
    normalizeMovementCardPresentation, synchronizeMovementCountryTableArtistOrder, linkMovementDocumentArtists, injectUHangulDocumentIntegration,
    injectMovementArtworkMovementLabels, injectMovementCountryCardContexts, injectMovementPioneerContext, movementDocumentPioneerContextKey, injectMovementWikipediaHeading, injectMovementWikipediaTermLinks, injectMovementStickyTitle, injectMovementContentLayout, injectMovementHighResolutionViewer,
    saveLocalArtworkImage, saveTopicArtwork, replaceTopicArtworkImage, deleteTopicArtwork, readMovementSectionLinks, saveMovementSectionLinks, applyCors,
    movementPioneerContexts
  };
};
