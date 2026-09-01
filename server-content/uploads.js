module.exports = function install(context) {
  const { fs, path, URL, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, techniquesFile, topicsFile, topicImageDir, movementSectionLinksFile, migrationAssetManifestFile, adminEmail, highResolutionStoredLimit, sourceImageInputLimit, jsonRequestBodyLimit, normalizeArtistsPayload, validateArtistsPayload, firebaseExport, invalidArtworkThumbnail, syncPersonNameDictionary, readAccessControl, readArtistsFile, writeArtistsFile, saveThumbnailBuffer, highResolutionPathExists, thumbnailLocation, makePngUnderStorageLimit, assertStableEditableStructure, synchronizeTableArtistOrder, validateCompleteDocument, highResolutionLocation, highResolutionArtistNameOverrides, commonHighResolutionArtistName, safeFileSegment, highResolutionFileBase, removeHighResolutionFiles, migrationExport, publicRootFiles, publicDataFiles, publicPathPrefixes, isPublicStaticPath, safePath, techniqueLinks, comparisonTechniqueIds, readRequestBuffer, readJsonRequest, sendJsonBodyError, multipartForm, safeUploadId, uploadTypes, movementDocumentDir, movementDocumentIndex, movementDocumentName, movementDocumentSlot, readMovementDocuments, writeMovementDocuments, movementDocumentFileStem, movementDocumentRelative, isMovementDocumentRelative, escapeRegex, escapeAttribute, htmlDecode, tagAttrs, normalizeMovementImageReference, movementHighResolutionSearchText, movementHighResolutionEntries, movementHighResolutionEntryForImage, movementHighResolutionViewer, movementCardDoubleClickZoom, movementCardInteractiveZoom, movementContentLayoutStyle, movementCardImageFitStyle, injectMovementContentLayout, movementCardDocumentName, normalizeMovementCardPresentation, movementPlainText, movementCountryLabelKey, movementCountryCardContexts, injectMovementCountryCardContexts, injectMovementStickyTitle, matchingHtmlElementEnd, synchronizeMovementCountryTableArtistOrder, injectMovementHighResolutionViewer, compactArtistName, movementArtistAliasOverrides, movementArtistAliases, movementArtistLinkEntries, compactMovementName, movementNameKo, serverMovementSpec, serverArtistMovementDisplayRules, serverArtistMovementClassificationOverrides, serverArtistMovementFallbacks, serverArtistPrimaryMovement, serverArtistMovementDisplayLabel, stripMovementArtworkMovementLabels, movementCardArtist, normalizedMovementMiniLabelText, redundantArtistMiniLabelPattern, stripRedundantArtistMiniLabel, injectMovementLabelIntoCard, injectMovementArtworkMovementLabels, movementArtistLinkStyle, movementWikipediaTermLinkStyle, movementWikipediaTermLinks, uHangulDocumentIntegration, movementPioneerContexts, movementPioneerDocumentContextByName, movementDocumentPioneerContextKey, movementPioneerContextForTitle, injectMovementPioneerContext, uHangulDocumentToolbar, injectUHangulDocumentIntegration, injectMovementArtistLinkStyle, injectMovementWikipediaHeading, injectMovementWikipediaTermLinks, stripMovementArtistLinks, isProtectedMovementHtmlChunk, linkMovementDocumentArtists, movementDocumentNeedsSetup, ensureStoredMovementDocumentControls, storedMovementDocumentControlsReady, movementDocumentSyncState, saveMovementDocumentHtml, removeMovementDocument, refreshMovementDocumentLinks } = context;
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
  Object.assign(context, { uploadExtension, makeDisplayImage, makeLocalArtworkThumbnail, saveLocalArtworkImage, saveTopicArtwork, replaceTopicArtworkImage, deleteTopicArtwork, movementSectionLinkIds });
  return context;
};
