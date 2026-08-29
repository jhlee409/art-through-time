/* Wikidata access, artist persistence, and thumbnail storage services. */
module.exports = function createArtistDataService(deps) {
  const { https, fs, path, URL, createHash, randomBytes, execFileAsync, ffmpegPath, root, dataDir, highResolutionDir, imageStagingDir, artistsFile, backupsDir, auditLogFile, adminEmail, artistImportedWorkLimit, highResolutionStoredLimit, sourceImageInputLimit, normalizeArtistsPayload, validateArtistsPayload, invalidArtworkThumbnail, buildArtistMap, writeUHangulArtistMap, syncPersonNameDictionary } = deps;
  const uploadTypes = {'image/jpeg':'jpg','image/jpg':'jpg','image/pjpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
  const safeUploadId = value => { if (!/^[A-Za-z0-9_-]{1,140}$/.test(String(value || ''))) throw new Error('Invalid artwork identifier'); return String(value); };
  const uploadExtension = file => { const ext=path.extname(String(file?.filename || '')).toLowerCase(); return uploadTypes[file?.contentType] || ({'.jpg':'jpg','.jpeg':'jpg','.jfif':'jpg','.png':'png','.webp':'webp','.gif':'gif'}[ext]); };
  let nextWikimediaRequestAt = 0;
  let artistsWriteQueue = Promise.resolve();
  let lastArtistsBackupAt = 0;
function getJson(url, attempt=0) {
  const host=new URL(url).hostname, isWikimedia=host.endsWith('wikipedia.org') || host.endsWith('wikimedia.org');
  const wait=Math.max(0,nextWikimediaRequestAt-Date.now());
  if (wait) return new Promise(resolve=>setTimeout(resolve,wait)).then(()=>getJson(url,attempt));
  if (isWikimedia) nextWikimediaRequestAt=Date.now()+650;
  return new Promise((resolve, reject) => {
    const request=https.get(url,{headers:{'User-Agent':'ArtAtlasLocal/1.0 (educational project)'}},res=>{
      let body=''; res.setEncoding('utf8'); res.on('data',chunk=>body+=chunk);
      res.on('end',()=>{
        if(res.statusCode>=300 && res.statusCode<400 && res.headers.location) return getJson(new URL(res.headers.location,url).href,attempt).then(resolve,reject);
        if((res.statusCode===429 || res.statusCode>=500) && attempt<3) { const retryWait=Number(res.headers['retry-after'] || 2)*1000*(attempt+1); return setTimeout(()=>getJson(url,attempt+1).then(resolve,reject),retryWait); }
        if(res.statusCode!==200) return reject(new Error('Wikimedia returned '+res.statusCode));
        try { resolve(JSON.parse(body)); } catch(error) { reject(error); }
      });
    });
    request.setTimeout(12000,()=>request.destroy(new Error('Wikimedia request timed out')));
    request.on('error',reject);
  });
}
function getJsonFast(url) { return new Promise((resolve,reject) => { const request=https.get(url,{headers:{'User-Agent':'ArtAtlasLocal/1.0 (interactive search)'}},res=>{const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)request.destroy(new Error('Search response is too large'));else chunks.push(chunk);});res.on('end',()=>{if(res.statusCode!==200)return reject(new Error(`Search returned ${res.statusCode}`));try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}});}); request.setTimeout(12000,()=>request.destroy(new Error('Search request timed out'))); request.on('error',reject); }); }
const api = params => `https://www.wikidata.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',...params})}`;
const koreanArtistNameOverrides = {Q6394591:'바실리 푸키레프',Q104884:'카스파 다비드 프리드리히',Q5598:'렘브란트 하르먼손 반 레인'};
const englishArtistNameOverrides = {Q5598:'Rembrandt Harmenszoon van Rijn'};
const koreanArtworkTitleOverrides = {Q2030685:'성모의 결혼식',Q2277635:'라자로의 부활',Q3788158:'헷 펠스켄',Q596683:'새벽',Q1985071:'메디치 마돈나',Q1587929:'리젠게비르게의 아침',Q17493547:'독립전쟁 전몰자의 묘지',Q3649324:'숲속의 엽병',Q4310993:'범선 위에서',Q17321856:'정원 정자',Q18602479:'항구의 밤',Q18603131:'이른 아침 안개 속의 배',Q1423223:'바다 위의 달돋이',Q3139782:'달을 바라보는 남자와 여자',Q2517970:'눈 덮인 오두막',Q999836:'저녁 항구의 배들',Q17422064:'거인산맥의 엘데나 수도원 폐허',Q3822640:'드레스덴의 큰 울타리',Q4126323:'거인산맥의 추억',Q232087:'달을 바라보는 두 남자'};
// Only show entries described by Wikidata as painters or visual artists.  A name
// match alone is not enough: it often finds a surname, a philosopher, or a city.
async function artistSearchCandidates(query) {
  const request = language => getJsonFast(api({action:'wbsearchentities',search:query,language,uselang:'ko',type:'item',limit:'20'}));
  // Wikidata's Korean search does not always connect a common Korean surname
  // with its internationally catalogued painter (for example 프리드리히).
  const aliases = [
    ...(query.includes('프리드리히') ? [{query:'Caspar David Friedrich',label:'카스파 다비드 프리드리히'}] : []),
    ...(/바실리/.test(query) && /(푸키|프키)/.test(query) ? [{query:'Vassili Vladimirovich Pukiryov',label:'바실리 푸키레프'}] : [])
  ];
  const [korean, english, ...aliasResults] = await Promise.all([request('ko'), request('en'), ...aliases.map(alias => getJsonFast(api({action:'wbsearchentities',search:alias.query,language:'en',uselang:'ko',type:'item',limit:'5'})))]);
  const aliasLabels = new Map(aliasResults.flatMap((result,index) => (result.search || []).map(item => [item.id, aliases[index].label])));
  const raw = [...(korean.search || []), ...(english.search || []), ...aliasResults.flatMap(result => result.search || [])]
    .map(item => ({id:item.id,label:aliasLabels.get(item.id) || koreanArtistNameOverrides[item.id] || item.label,description:item.description || ''}))
    .filter((item,index,self) => self.findIndex(other => other.id === item.id) === index);
  return raw.filter(item => /painter|visual artist|화가|예술가/i.test(item.description));
}
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
const selectionKey = work => {
  const qid = String(work.id || '').match(/^wikidata-Q\d+/)?.[0];
  if (qid) return qid;
  const title = normalized(work.title?.en || work.title?.ko);
  return title ? `${title}-${work.year || ''}` : String(work.id || '');
};
const isManualWork = work => work?.origin === 'manual';
const isGeneratedWork = work => !isManualWork(work) && /^(wikidata|wikipedia)-/.test(String(work.id || ''));
const workPopularity = work => Number.isFinite(Number(work.popularity)) ? Number(work.popularity) : 0;
const workYearForSort = work => {
  const year = Number(work?.year);
  return Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
};
const workMovementText = work => `${work?.movement?.ko || ''} ${work?.movement?.en || ''}`.toLocaleLowerCase();
function representativeScore(work, artist={}) {
  const source = String(work?.source || '');
  const movement = workMovementText(work);
  const artistMovement = `${artist?.movement?.ko || ''} ${artist?.movement?.en || ''}`.toLocaleLowerCase();
  let score = workPopularity(work);
  if (work?.origin === 'curated') score += 100000;
  if (work?.image || work?.thumbnail) score += 1200;
  if (work?.verified) score += 600;
  if (/wikidata\.org|commons\.wikimedia\.org|api\.artic\.edu|clevelandart\.org/i.test(source)) score += 420;
  if (/wikipedia\.org/i.test(source)) score -= 120;
  if (artistMovement && movement && (movement.includes(artistMovement) || artistMovement.includes(movement))) score += 900;
  if (movement) score += 240;
  if (work?.description?.ko || work?.description?.en) score += 120;
  return score;
}
function movementMatchesArtist(work, artist={}) {
  const movement = workMovementText(work);
  const artistMovement = `${artist?.movement?.ko || ''} ${artist?.movement?.en || ''}`.toLocaleLowerCase();
  return Boolean(artistMovement && movement && (movement.includes(artistMovement) || artistMovement.includes(movement)));
}
function movementContributionScore(work, artist={}) {
  let score = representativeScore(work, artist);
  if (movementMatchesArtist(work, artist)) score += 5000;
  if (work?.origin === 'curated') score += 1800;
  if (work?.verified) score += 500;
  return score;
}
function selectArtistWorks(works, limit=artistImportedWorkLimit, artist={}) {
  const byKey = new Map();
  const idCounts = new Map();
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });
  (works || []).forEach(work => {
    const id = String(work?.id || '');
    const key = id && idCounts.get(id) > 1 ? `id:${id}` : selectionKey(work);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? {...work,...existing,popularity:Math.max(workPopularity(existing),workPopularity(work))} : work);
  });
  const unique = [...byKey.values()];
  const manualWorks = unique.filter(isManualWork).sort((a,b) => workYearForSort(a) - workYearForSort(b));
  const manualKeys = new Set(manualWorks.map(selectionKey));
  const generatedWorks = unique.filter(work => !manualKeys.has(selectionKey(work))).sort((a,b) => representativeScore(b,artist) - representativeScore(a,artist) || workYearForSort(a) - workYearForSort(b));
  const selected = [...manualWorks,...generatedWorks.slice(0,Math.max(0,limit-manualWorks.length))];
  const aligned = selected.filter(work => movementMatchesArtist(work, artist));
  const contributionPool = aligned.length ? aligned : selected;
  const movementContributionKeys = new Set(
    contributionPool
      .sort((a,b) => movementContributionScore(b,artist) - movementContributionScore(a,artist) || workYearForSort(a) - workYearForSort(b))
      .slice(0,3)
      .map(selectionKey)
  );
  return selected.map(work => ({...work,movementContribution:movementContributionKeys.has(selectionKey(work)),movementContributionReason:movementContributionKeys.has(selectionKey(work)) ? 'artist-movement-characteristic' : undefined})).sort((a,b) => workYearForSort(a) - workYearForSort(b));
}
const searchKey = value => String(value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\s\-_'.,()]/g,'');
function editDistance(left, right) { const a=searchKey(left), b=searchKey(right); const row=Array.from({length:b.length+1},(_,index)=>index); for(let i=1;i<=a.length;i++){let diagonal=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const above=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=above;}} return row[b.length]; }
function similarityScore(query, label) { const input=searchKey(query), candidate=searchKey(label); if(!input || !candidate) return 0; if(input===candidate) return 1000; if(candidate.includes(input)) return 800 + input.length / candidate.length * 100; if(input.includes(candidate)) return 650 + candidate.length / input.length * 100; return Math.max(0, 500 - editDistance(input,candidate) * 24); }
const claimValue = (entity, property) => entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
const entityId = (entity, property) => claimValue(entity,property)?.id || '';
const entityYear = (entity, property) => Number((claimValue(entity,property)?.time || '').slice(1,5)) || null;
const entityLabel = (entity, language) => entity?.labels?.[language]?.value || entity?.labels?.en?.value || entity?.labels?.ko?.value || '';
async function getEntities(ids) { const data=await getJson(api({action:'wbgetentities',ids:ids.join('|'),props:'labels|descriptions|claims',languages:'ko|en'})); return data.entities || {}; }
async function normalizeArtistWorks(artist) {
  const works=Array.isArray(artist?.works) ? artist.works : [], ids=[...new Set(works.map(work=>String(work.id||'').replace(/^wikidata-/, '')).filter(id=>/^Q\d+$/.test(id)))];
  const entities={}; for(let index=0;index<ids.length;index+=40) Object.assign(entities,await getEntities(ids.slice(index,index+40)));
  const countryIds=[...new Set(Object.values(entities).map(entity=>entityId(entity,'P495')).filter(Boolean))], countries={}; for(let index=0;index<countryIds.length;index+=40) Object.assign(countries,await getEntities(countryIds.slice(index,index+40)));
  let verified=0, unverified=0;
  works.forEach(work=>{ const qid=String(work.id||'').replace(/^wikidata-/,''), entity=entities[qid]; if(!entity) { unverified++; return; } const title={ko:koreanArtworkTitleOverrides[qid] || entityLabel(entity,'ko'),en:entityLabel(entity,'en')}, made=entityYear(entity,'P571'), country=countries[entityId(entity,'P495')]; if(title.ko&&title.en) work.title=title; if(made) work.year=made; if(country) work.country={ko:entityLabel(country,'ko'),en:entityLabel(country,'en')}; work.metadataVerifiedAt=new Date().toISOString(); verified++; });
  return {artist,verified,unverified};
}
async function artistProfileFromQid(qid, fallbackName='') {
  const artistEntity=(await getEntities([qid]))[qid]; if(!artistEntity) throw new Error('Artist not found');
  const nationalityQid=entityId(artistEntity,'P27'), movementQid=entityId(artistEntity,'P135');
  const related=await getEntities([nationalityQid,movementQid].filter(Boolean));
  const nationalityEntity=related[nationalityQid], movementEntity=related[movementQid];
  return {id:`artist-${qid}`,qid,name:{ko:koreanArtistNameOverrides[qid] || artistEntity?.labels?.ko?.value || fallbackName || entityLabel(artistEntity,'ko'),en:englishArtistNameOverrides[qid] || entityLabel(artistEntity,'en')},birth:entityYear(artistEntity,'P569'),death:entityYear(artistEntity,'P570'),nationality:{ko:entityLabel(nationalityEntity,'ko'),en:entityLabel(nationalityEntity,'en')},movement:{ko:entityLabel(movementEntity,'ko'),en:entityLabel(movementEntity,'en')},works:[]};
}
const artistProfileLookupCache = new Map();
function hasLocalizedText(value) {
  return Boolean(String(value?.ko || value?.en || value || '').trim());
}
async function cachedArtistProfileFromQid(qid, fallbackName='') {
  const key=String(qid || '');
  if(!artistProfileLookupCache.has(key)) {
    artistProfileLookupCache.set(key, artistProfileFromQid(key,fallbackName).catch(error => {
      artistProfileLookupCache.delete(key);
      throw error;
    }));
  }
  return artistProfileLookupCache.get(key);
}
async function hydrateMissingArtistProfiles(payload) {
  if(!payload || !Array.isArray(payload.artists)) return payload;
  for(const artist of payload.artists) {
    const qid=String(artist?.qid || '');
    if(!/^Q\d+$/.test(qid)) continue;
    const needsName=!hasLocalizedText(artist.name);
    const needsNationality=!hasLocalizedText(artist.nationality);
    const needsMovement=!hasLocalizedText(artist.movement);
    const needsBirth=!artist.birth;
    const needsDeath=!artist.death;
    if(!needsName && !needsNationality && !needsMovement && !needsBirth && !needsDeath) continue;
    try {
      const profile=await cachedArtistProfileFromQid(qid,artist.name?.ko || artist.name?.en || '');
      if(needsName && hasLocalizedText(profile.name)) artist.name=profile.name;
      if(needsNationality && hasLocalizedText(profile.nationality)) artist.nationality=profile.nationality;
      if(needsMovement && hasLocalizedText(profile.movement)) artist.movement=profile.movement;
      if(needsBirth && profile.birth) artist.birth=profile.birth;
      if(needsDeath && profile.death) artist.death=profile.death;
    } catch (_) {
      /* Saving local edits should not fail just because Wikidata is temporarily unavailable. */
    }
  }
  return payload;
}
function htmlDecode(value='') {
  const named={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(match,entity)=>{
    if(entity[0]==='#') { const number=entity[1]?.toLowerCase()==='x' ? parseInt(entity.slice(2),16) : parseInt(entity.slice(1),10); return Number.isFinite(number) ? String.fromCodePoint(number) : match; }
    return Object.prototype.hasOwnProperty.call(named,entity.toLowerCase()) ? named[entity.toLowerCase()] : match;
  });
}
function tagAttrs(tag='') {
  const attrs={};
  for (const match of String(tag).matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[match[1].toLowerCase()]=htmlDecode(match[2] || match[3] || match[4] || '').trim();
  return attrs;
}
const textFromHtml = html => htmlDecode(String(html || '').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<noscript\b[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
async function wikipediaTitleForWork(work) {
  const fromSource=work.source?.match(/en\.wikipedia\.org\/wiki\/([^?#]+)/)?.[1];
  if (fromSource) return fromSource;
  const qid=work.id?.match(/^wikidata-(Q\d+)$/)?.[1];
  if (!qid) return '';
  try { const entity=await getJson(api({action:'wbgetentities',ids:qid,props:'sitelinks'})); return entity.entities?.[qid]?.sitelinks?.enwiki?.title?.replace(/ /g,'_') || ''; } catch (_) { return ''; }
}
const entityDescription = (entity, language) => entity?.descriptions?.[language]?.value || '';
const qidFromWork = work => {
  const id=String(work?.id || ''), source=String(work?.source || '');
  return id.match(/^(?:wikidata|featured)-(Q\d+)/)?.[1] || source.match(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/)?.[1] || '';
};
const locLabel = (value, language) => typeof value === 'object' ? (value?.[language] || value?.en || value?.ko || '') : String(value || '');
const localizedDescription = (value, language) => {
  const candidate = typeof value === 'object' ? (value?.[language] || value?.en || value?.ko || '') : value;
  return language === 'ko' && candidate && !/[가-힣]/.test(candidate) ? '' : String(candidate || '');
};
function shortText(text='', limit=520) {
  const sentences=String(text || '').replace(/\s+/g,' ').trim().match(/[^.!?。]+[.!?。]?/g) || [];
  const clean=sentences.reduce((items,sentence) => { const value=sentence.trim(); if(value && value !== items[items.length - 1]) items.push(value); return items; },[]).join(' ');
  if (clean.length <= limit) return clean;
  const sentence=clean.slice(0,limit).replace(/\s+\S*$/,'').replace(/[.,;:]*$/,'');
  return sentence ? `${sentence}.` : clean.slice(0,limit);
}
async function wikipediaExtract(title, language) {
  if (!title) return '';
  try {
    const data=await getJson(`https://${language}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',redirects:'1',titles:title.replace(/_/g,' '),prop:'extracts',exintro:'1',explaintext:'1',exsentences:'3'})}`);
    return shortText(Object.values(data.query?.pages || {}).map(page => page.extract).find(Boolean) || '');
  } catch (_) { return ''; }
}
async function wikipediaSearchExtract(query, language) {
  try {
    const search=await getJson(`https://${language}.wikipedia.org/w/api.php?${new URLSearchParams({format:'json',origin:'*',action:'query',list:'search',srsearch:query,srlimit:'1'})}`);
    const title=search.query?.search?.[0]?.title || '';
    return wikipediaExtract(title,language);
  } catch (_) { return ''; }
}
async function wikipediaExtractForWork(work, artist, language) {
  const qid=qidFromWork(work);
  if (qid) {
    try {
      const data=await getJson(api({action:'wbgetentities',ids:qid,props:'sitelinks'}));
      const title=data.entities?.[qid]?.sitelinks?.[`${language}wiki`]?.title;
      const extract=await wikipediaExtract(title,language);
      if (extract) return extract;
    } catch (_) { /* Search fallback below. */ }
  }
  const sourceTitle=work.source?.match(new RegExp(`${language}\\.wikipedia\\.org\\/wiki\\/([^?#]+)`))?.[1];
  const fromSource=await wikipediaExtract(sourceTitle,language);
  if (fromSource) return fromSource;
  return wikipediaSearchExtract(`${work.title?.[language] || work.title?.en || work.title?.ko || ''} ${artist.name?.[language] || artist.name?.en || artist.name?.ko || ''}`,language);
}
function composeArtworkSummary(work, artist, description, language) {
  const title=work.title?.[language] || work.title?.en || work.title?.ko || 'Untitled';
  const artistName=artist.name?.[language] || artist.name?.en || artist.name?.ko || '';
  const year=work.year ? (language === 'ko' ? `${work.year}년경` : `around ${work.year}`) : '';
  const movement=work.movement?.[language] || work.movement?.en || work.movement?.ko || '';
  const country=work.country?.[language] || work.country?.en || work.country?.ko || '';
  if (language === 'ko') {
    const base=`${title}은/는 ${artistName ? `${artistName}의 ` : ''}${year ? `${year} 제작된 ` : ''}작품입니다.`;
    if (description.startsWith(`${title}은/는`) && description.includes('작품입니다')) return shortText(description,760);
    const facts=[movement ? `${movement} 흐름과 관련됩니다.` : '', country ? `${country}와 관련된 작품으로 기록되어 있습니다.` : ''].filter(Boolean).join(' ');
    return shortText([base,facts,description].filter(Boolean).join(' '),760);
  }
  const base=`${title} is ${artistName ? `a work by ${artistName}` : 'an artwork'}${year ? ` made ${year}` : ''}.`;
  if (description.startsWith(`${title} is `)) return shortText(description,760);
  const facts=[movement ? `It is associated with ${movement}.` : '', country ? `It is recorded in connection with ${country}.` : ''].filter(Boolean).join(' ');
  return shortText([base,facts,description].filter(Boolean).join(' '),760);
}
async function artworkInfo(artist, work) {
  const qid=qidFromWork(work);
  const entity=qid ? (await getEntities([qid]))[qid] : null;
  const koSource=shortText(localizedDescription(work.description,'ko') || entityDescription(entity,'ko') || await wikipediaExtractForWork(work,artist,'ko'));
  const enSource=shortText(work.description?.en || entityDescription(entity,'en') || await wikipediaExtractForWork(work,artist,'en'));
  const ko=composeArtworkSummary(work,artist,koSource || enSource,'ko');
  const en=composeArtworkSummary(work,artist,enSource || koSource,'en');
  const sources=[work.source, qid ? `https://www.wikidata.org/wiki/${qid}` : ''].filter(Boolean).filter((value,index,self)=>self.indexOf(value)===index);
  const sections={
    ko:[
      {title:'개요',body:ko},
      {title:'자료 항목',body:[work.year ? `제작 연도: ${work.year}` : '', locLabel(work.movement,'ko') ? `사조: ${locLabel(work.movement,'ko')}` : '', locLabel(work.country,'ko') ? `국가: ${locLabel(work.country,'ko')}` : ''].filter(Boolean).join(' · ')}
    ].filter(section=>section.body),
    en:[
      {title:'Overview',body:en},
      {title:'Data points',body:[work.year ? `Year: ${work.year}` : '', locLabel(work.movement,'en') ? `Movement: ${locLabel(work.movement,'en')}` : '', locLabel(work.country,'en') ? `Country: ${locLabel(work.country,'en')}` : ''].filter(Boolean).join(' · ')}
    ].filter(section=>section.body)
  };
  return {...work,description:{ko,en},detail:{schema:2,fetchedAt:new Date().toISOString(),summary:{ko,en},sections,sources,facts:{artist:artist.name,year:work.year || null,country:work.country || {},movement:work.movement || {}}}};
}
function thumbnailLocation(email, artistId) {
  return {folder:path.join(root,'data','thumbnails',artistId), relativePrefix:`data/thumbnails/${artistId}`};
}
function thumbnailExtension(value='') { return (String(value).match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)?.[1] || '').toLowerCase().replace('jpeg','jpg'); }
async function removeThumbnailFiles(directory, workId) {
  const safeWorkId=safeUploadId(workId);
  await Promise.all(['jpg','png','webp','gif'].map(extension => fs.unlink(path.join(directory,`${safeWorkId}.${extension}`)).catch(()=>{})));
}
async function makePngUnderStorageLimit(input, folder, fileBase, widths) {
  const output=path.join(folder,`${fileBase}.png`);
  for (const width of widths) {
    await execFileAsync(ffmpegPath,['-y','-i',input,'-vf',`scale=min(${width}\\,iw):-2`,'-frames:v','1','-update','1','-compression_level','9','-pred','mixed',output],{windowsHide:true,timeout:300000});
    if ((await fs.stat(output)).size < highResolutionStoredLimit) return output;
  }
  throw new Error('Could not create a PNG image smaller than 10 MB');
}
async function reduceImageBufferForStorage(image, extension, fileBase) {
  if (image.length < highResolutionStoredLimit) return {image,extension};
  const staging=path.join(imageStagingDir,`thumbnail-${fileBase}-${Date.now()}-${randomBytes(4).toString('hex')}`);
  await fs.mkdir(staging,{recursive:true});
  const input=path.join(staging,`source.${extension || 'jpg'}`);
  try {
    await fs.writeFile(input,image);
    const output=await makePngUnderStorageLimit(input,staging,'display',[2400,2000,1600,1400,1200,1000,800,640,480]);
    const reduced=await fs.readFile(output);
    return {image:reduced,extension:'png',reduced:true};
  } finally {
    await fs.rm(staging,{recursive:true,force:true}).catch(()=>{});
  }
}
function localThumbnailIndexTarget(relativePath) {
  const clean=String(relativePath || '').trim().replace(/[?#].*$/,'').replace(/\\/g,'/');
  if(!/^data\/thumbnails\//.test(clean) || clean === offlineArtworkPlaceholder) return null;
  const target=path.resolve(root,clean);
  const relative=path.relative(root,target).replace(/\\/g,'/');
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? target : null;
}
async function thumbnailIndexImageHash(item) {
  if(item?.imageHash) return String(item.imageHash);
  const target=localThumbnailIndexTarget(item?.thumbnail);
  if(!target) return '';
  try {
    return createHash('sha256').update(await fs.readFile(target)).digest('hex');
  } catch (_) {
    return '';
  }
}
async function assertUniqueThumbnailImage(index, work, imageHash) {
  const workId=String(work?.id || '');
  for(const [otherId,item] of Object.entries(index || {})) {
    if(String(otherId) === workId) continue;
    const otherHash=await thumbnailIndexImageHash(item);
    if(otherHash && otherHash === imageHash) {
      throw new Error(`The thumbnail is identical to another artwork thumbnail (${otherId}); rejected to prevent repeated wrong images`);
    }
  }
}
async function saveThumbnailBuffer(artist,work,image,extension,verifiedBy,email=adminEmail) {
  if(invalidArtworkThumbnail(image)) throw new Error('Image is a small interface icon');
  if(!['jpg','png','webp','gif'].includes(extension)) throw new Error('Unsupported image file type');
  if(image.length > sourceImageInputLimit) throw new Error('Image source is larger than 500 MB');
  const stored=await reduceImageBufferForStorage(image,extension,safeUploadId(work.id));
  image=stored.image;
  extension=stored.extension;
  if(invalidArtworkThumbnail(image)) throw new Error('Image is a small interface icon');
  const location=thumbnailLocation(email,artist.id), directory=location.folder, fileName=`${work.id}.${extension}`, relative=`${location.relativePrefix}/${fileName}`;
  await fs.mkdir(directory,{recursive:true});
  const indexPath=path.join(directory,'index.json');
  let index={};
  try { index=JSON.parse(await fs.readFile(indexPath,'utf8')); } catch (_) {}
  const imageHash=createHash('sha256').update(image).digest('hex');
  await assertUniqueThumbnailImage(index,work,imageHash);
  await removeThumbnailFiles(directory,work.id);
  await fs.writeFile(path.join(directory,fileName),image);
  index[work.id]={thumbnail:relative,checkedAt:new Date().toISOString(),verifiedBy:stored.reduced ? `${verifiedBy}; reduced below 10 MB and original discarded` : verifiedBy,imageHash};
  await fs.writeFile(indexPath,JSON.stringify(index,null,2),'utf8');
  return relative;
}
async function saveThumbnailFromLocalUpload(artist,work,file,email=adminEmail) { const extension=uploadExtension(file); if(!extension) throw new Error('Image must be JPG, PNG, WEBP, or GIF'); if(!file?.data?.length) throw new Error('Image file is empty'); if(file.data.length > sourceImageInputLimit) throw new Error('Image source is larger than 500 MB'); return saveThumbnailBuffer(artist,work,file.data,extension,`Uploaded local image: ${path.basename(file.filename)}`,email); }
async function highResolutionPathExists(relativePath) {
  if (!relativePath) return false;
  try { await fs.access(path.join(root, relativePath)); return true; }
  catch (_) { return false; }
}
async function resolvedHighResolutionPath(artistId, workId, relativePath) {
  if (!relativePath || await highResolutionPathExists(relativePath)) return relativePath;
  const safeArtistId = safeUploadId(artistId), safeWorkId = safeUploadId(workId);
  const folder = path.join(highResolutionDir, safeArtistId);
  const oldName = path.basename(relativePath);
  const baseName = oldName.replace(/\.display\.(?:jpe?g|png)$/i, '');
  const files = await fs.readdir(folder).catch(() => []);
  const match = files.find(name => name === oldName)
    || files.find(name => name.startsWith(`${baseName}_`) && /\.display\.(?:jpe?g|png)$/i.test(name))
    || files.find(name => name.startsWith(`${safeWorkId}_`) && /\.display\.(?:jpe?g|png)$/i.test(name));
  return match ? `data/high-resolution/${safeArtistId}/${match}` : relativePath;
}
async function resolveHighResolutionPaths(payload) {
  if (!payload || !Array.isArray(payload.artists)) return payload;
  for (const artist of payload.artists) {
    for (const work of artist.works || []) {
      if (work.highResImage) work.highResImage = await resolvedHighResolutionPath(artist.id, work.id, work.highResImage);
      if (work.highResOriginal) work.highResOriginal = await resolvedHighResolutionPath(artist.id, work.id, work.highResOriginal);
    }
  }
  return payload;
}
async function readArtistsFile() { return resolveHighResolutionPaths(JSON.parse(await fs.readFile(artistsFile,'utf8'))); }
function artistIndexRecord(artist) { const {works,...summary}=artist || {}; return {...summary,workCount:Array.isArray(works)?works.length:0,_detailLoaded:false}; }
async function readArtistsIndex() { const payload=await readArtistsFile(); return {...payload,artists:(payload.artists||[]).map(artistIndexRecord)}; }
async function readArtistDetail(id) { const payload=await readArtistsFile(), artist=(payload.artists||[]).find(item=>item.id===id); return artist ? {...artist,_detailLoaded:true} : null; }
const offlineArtworkPlaceholder = 'data/thumbnails/_placeholder/artwork-placeholder.png';
async function sanitizeRubensLegacyThumbnails(payload) {
  const artist=(payload.artists || []).find(item=>item.id==='artist-Q5599' || item.qid==='Q5599');
  if(!artist) return payload;
  let index={};
  try { index=JSON.parse(await fs.readFile(path.join(root,'data','thumbnails','artist-Q5599','index.json'),'utf8')); } catch (_) { index={}; }
  for(const work of artist.works || []) {
    const item=index[work.id] || {};
    const thumbnail=String(work.thumbnail || '');
    const isRubensLocal=/^data\/thumbnails\/artist-Q5599\//.test(thumbnail);
    const isLegacyIndex=item.thumbnail && item.thumbnail!==offlineArtworkPlaceholder && !item.source && !item.finalUrl && !item.bytes;
    if(isRubensLocal && isLegacyIndex) {
      if(/^https?:/i.test(String(work.image || ''))) work.offlineThumbnailSource=work.offlineThumbnailSource || work.image;
      work.thumbnail=offlineArtworkPlaceholder;
      work.thumbnailValidation=0;
    }
  }
  return payload;
}
async function appendAudit(event) {
  await fs.mkdir(dataDir,{recursive:true});
  await fs.appendFile(auditLogFile,`${JSON.stringify({at:new Date().toISOString(),...event})}\n`,'utf8');
}
async function backupArtistsFile(previousRevision) {
  const now=Date.now();
  // Frequent thumbnail updates can save repeatedly. Preserve a recoverable
  // pre-save snapshot at most once every five minutes, retaining twenty.
  if (now-lastArtistsBackupAt < 5*60*1000) return '';
  await fs.mkdir(backupsDir,{recursive:true});
  const stamp=new Date(now).toISOString().replace(/[:.]/g,'-');
  const backup=path.join(backupsDir,`artists-r${previousRevision}-${stamp}.json`);
  await fs.copyFile(artistsFile,backup).catch(error => { if(error.code !== 'ENOENT') throw error; });
  lastArtistsBackupAt=now;
  const backups=(await fs.readdir(backupsDir)).filter(name=>/^artists-r\d+-.*\.json$/i.test(name)).sort();
  await Promise.all(backups.slice(0,Math.max(0,backups.length-20)).map(name=>fs.unlink(path.join(backupsDir,name)).catch(()=>{})));
  return path.relative(root,backup).replace(/\\/g,'/');
}
function recordValueForChange(value, omitWorks=false) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item=>recordValueForChange(item));
  return Object.fromEntries(Object.entries(value).filter(([key])=>key !== 'metadata' && (!omitWorks || key !== 'works')).map(([key,item])=>[key,recordValueForChange(item)]));
}
function recordChanged(current, previous, omitWorks=false) {
  if (!previous) return true;
  return JSON.stringify(recordValueForChange(current,omitWorks)) !== JSON.stringify(recordValueForChange(previous,omitWorks));
}
function savedRecordMetadata(current, previous, changed, actor, now) {
  const incoming=current?.metadata && typeof current.metadata === 'object' ? current.metadata : {};
  const existing=previous?.metadata && typeof previous.metadata === 'object' ? previous.metadata : {};
  const base={...existing,...incoming};
  const createdAt=existing.createdAt || incoming.createdAt || now;
  return {
    ...base,
    createdAt,
    updatedAt:changed ? now : (existing.updatedAt || incoming.updatedAt || createdAt),
    createdBy:existing.createdBy || incoming.createdBy || normalizedEmail(actor) || 'legacy-import',
    updatedBy:changed ? (normalizedEmail(actor) || existing.updatedBy || incoming.updatedBy || 'legacy-import') : (existing.updatedBy || incoming.updatedBy || normalizedEmail(actor) || 'legacy-import')
  };
}
function touchChangedArtistRecords(payload, previous, actor, now) {
  const previousArtists=new Map((previous.artists || []).map(artist=>[artist.id,artist]));
  payload.artists=(payload.artists || []).map(artist=>{
    const before=previousArtists.get(artist.id);
    const previousWorks=new Map((before?.works || []).map(work=>[work.id,work]));
    const currentWorks=artist.works || [];
    const currentWorkIds=new Set(currentWorks.map(work=>work.id));
    let workChanged=previousWorks.size !== currentWorks.length || [...previousWorks.keys()].some(id=>!currentWorkIds.has(id));
    artist.works=currentWorks.map(work=>{
      const previousWork=previousWorks.get(work.id);
      const changed=recordChanged(work,previousWork);
      workChanged=workChanged || changed;
      return {...work,metadata:savedRecordMetadata(work,previousWork,changed,actor,now)};
    });
    return {...artist,metadata:savedRecordMetadata(artist,before,workChanged || recordChanged(artist,before,true),actor,now)};
  });
  return payload;
}
async function writeArtistsFileNow(payload, actor='') {
  if (!payload || !Array.isArray(payload.artists)) throw new Error('Invalid artists payload');
  let previous={metadata:{}};
  try { previous=JSON.parse(await fs.readFile(artistsFile,'utf8')); } catch(error) { if(error.code !== 'ENOENT') throw error; }
  const previousRevision=Math.max(0,Number(previous?.metadata?.revision) || 0);
  const previousArtists=new Map((previous.artists || []).map(artist=>[artist.id,artist]));
  payload={...payload,artists:(payload.artists || []).map(artist=>{
    const existing=previousArtists.get(artist?.id);
    return artist?._detailLoaded === false && existing ? {...artist,works:existing.works || []} : artist;
  })};
  (payload.artists || []).forEach(artist=>{ if(artist && typeof artist==='object') delete artist._detailLoaded; });
  payload=await hydrateMissingArtistProfiles(payload);
  payload=normalizeArtistsPayload(payload,{actor,touch:false});
  const now=new Date().toISOString();
  payload=touchChangedArtistRecords(payload,previous,actor,now);
  payload.metadata={...payload.metadata,updatedAt:now,updatedBy:normalizedEmail(actor) || payload.metadata.updatedBy || 'local-admin',revision:previousRevision+1};
  const validation=validateArtistsPayload(payload);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  payload=await sanitizeRubensLegacyThumbnails(payload);
  payload=await resolveHighResolutionPaths(payload);
  await fs.mkdir(dataDir,{recursive:true});
  const backup=await backupArtistsFile(previousRevision);
  const temporary = `${artistsFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary,JSON.stringify({dataSchema:payload.dataSchema,metadata:payload.metadata,artists:payload.artists,deletedArtists:[],historicalEvents:Array.isArray(payload.historicalEvents) ? payload.historicalEvents : [],favoriteWorks:Array.isArray(payload.favoriteWorks) ? payload.favoriteWorks : []},null,2) + '\n','utf8');
  await fs.rename(temporary,artistsFile);
  await require('./tools/build-artist-index').writeArtistIndex(payload);
  writeUHangulArtistMap(payload.artists);
  syncPersonNameDictionary({artists:payload.artists});
  await appendAudit({type:'artists.save',actor:normalizedEmail(actor) || 'local-admin',revision:payload.metadata.revision,backup,stats:validation.stats});
  return {revision:payload.metadata.revision,backup};
}
function writeArtistsFile(payload, actor='') {
  const queued=artistsWriteQueue.then(() => writeArtistsFileNow(payload,actor));
  artistsWriteQueue=queued.catch(()=>{});
  return queued;
}
  return {
    artistSearchCandidates, normalizeArtistWorks, artistProfileFromQid, artworkInfo,
    getJsonFast, api, similarityScore,
    getEntities, entityId, entityYear, entityLabel, koreanArtistNameOverrides,
    saveThumbnailBuffer, saveThumbnailFromLocalUpload, removeThumbnailFiles,
    readArtistsFile, readArtistsIndex, readArtistDetail, writeArtistsFile, highResolutionPathExists, resolvedHighResolutionPath,
    resolveHighResolutionPaths, safeUploadId, uploadExtension
  };
};
